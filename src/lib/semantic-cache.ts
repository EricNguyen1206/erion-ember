import {
  CacheConfig,
  CacheOptions,
  CacheResult,
  QueryOptions,
  CacheMetadata,
  CacheStats,
  InternalStatistics,
} from '../types/index.js';
import { RedisVectorStore } from './redis-vector-store.js';
import Quantizer from './quantizer.js';
import Compressor from './compressor.js';
import Normalizer from './normalizer.js';

/**
 * Semantic Cache - High-performance cache for LLM queries with vector search
 */
export interface SemanticCacheDependencies {
  quantizer?: Quantizer;
  compressor?: Compressor;
  normalizer?: Normalizer;
  redisStore?: RedisVectorStore;
}

export class SemanticCache {
  readonly dim: number;
  readonly maxElements: number;
  readonly similarityThreshold: number;
  readonly memoryLimit: string;
  readonly defaultTTL: number;

  private quantizer: Quantizer;
  private compressor: Compressor;
  private normalizer: Normalizer;
  private redisStore: RedisVectorStore;
  private _statistics: InternalStatistics;
  private storePromise: Promise<void> | null = null;

  constructor(options: CacheConfig = {}, deps: SemanticCacheDependencies = {}) {
    this.dim = options.dim ?? 1536;
    this.maxElements = options.maxElements ?? 100000;
    this.similarityThreshold = options.similarityThreshold ?? 0.85;
    this.memoryLimit = options.memoryLimit ?? '1gb';
    this.defaultTTL = options.defaultTTL ?? 3600;

    this.quantizer = deps.quantizer ?? new Quantizer();
    this.compressor = deps.compressor ?? new Compressor();
    this.normalizer = deps.normalizer ?? new Normalizer();
    this.redisStore = deps.redisStore ?? new RedisVectorStore();

    this._statistics = {
      hits: 0,
      misses: 0,
      totalQueries: 0,
      savedTokens: 0,
      savedUsd: 0,
    };

    this.storePromise = this._initStore().catch(err => {
      console.error('Failed to initialize Redis Vector Store:', err);
    });
  }

  /**
   * Initialize vector store asynchronously
   * @private
   */
  private async _initStore(): Promise<void> {
    await this.redisStore.createIndex(this.dim);
  }

  /**
   * Ensure store is initialized
   * @private
   */
  private async _ensureStore(): Promise<void> {
    if (this.storePromise) {
      await this.storePromise;
    }
  }

  /**
   * Track savings from a cache hit
   * @param tokens - Number of tokens saved
   * @param usd - USD amount saved
   */
  trackSavings(tokens: number, usd: number): void {
    this._statistics.savedTokens += tokens;
    this._statistics.savedUsd += usd;
  }

  /**
   * Query cache
   * @param prompt - Query prompt
   * @param embedding - Query embedding vector
   * @param options - Query options
   * @returns Cache result or null
   */
  async get(
    prompt: string,
    embedding: number[] | null = null,
    options: QueryOptions = {}
  ): Promise<CacheResult | null> {
    await this._ensureStore();

    this._statistics.totalQueries++;
    const minSimilarity = options.minSimilarity ?? this.similarityThreshold;

    const normalized = this.normalizer.normalize(prompt);
    const promptHash = this.normalizer.hash(normalized, true);

    // Check exact match first
    const exactMatch = await this.redisStore.findByPromptHash(promptHash);
    if (exactMatch) {
      this._statistics.hits++;
      const response = this._decompressResponse(exactMatch);
      return {
        response,
        similarity: 1.0,
        isExactMatch: true,
        cachedAt: new Date(exactMatch.createdAt),
        metadata: exactMatch,
      };
    }

    // If no embedding provided, can't do semantic search
    if (!embedding) {
      this._statistics.misses++;
      return null;
    }

    // Search similar vectors
    const quantizedQuery = this.quantizer.quantize(embedding);
    // Use larger K to reduce round trips, assuming network latency > compute
    const searchK = 20;

    const searchResults = await this.redisStore.search(quantizedQuery, searchK);

    for (const result of searchResults) {
      const similarity = 1 - result.distance;

      if (similarity >= minSimilarity) {
        // Fetch full metadata
        const metadata = await this.redisStore.get(result.id);
        if (metadata) {
          this._statistics.hits++;
          const response = this._decompressResponse(metadata);
          return {
            response,
            similarity,
            isExactMatch: false,
            cachedAt: new Date(metadata.createdAt),
            metadata,
          };
        }
      }
    }

    this._statistics.misses++;
    return null;
  }

  /**
   * Add entry to cache
   * @param prompt - Original prompt
   * @param response - LLM response
   * @param embedding - Vector embedding
   * @param options - Cache options (e.g., ttl)
   */
  async set(
    prompt: string,
    response: string,
    embedding: number[],
    options: CacheOptions = {}
  ): Promise<void> {
    await this._ensureStore();

    const normalized = this.normalizer.normalize(prompt);
    const promptHash = this.normalizer.hash(normalized, true);

    const compressedPrompt = this.compressor.compress(prompt);
    const compressedResponse = this.compressor.compress(response);

    const quantizedVector = this.quantizer.quantize(embedding);

    // Use promptHash as ID
    const id = promptHash;
    const now = Date.now();

    const metadata: CacheMetadata = {
      id,
      vectorId: 0,
      promptHash,
      normalizedPrompt: normalized,
      compressedPrompt,
      compressedResponse,
      originalPromptSize: Buffer.byteLength(prompt, 'utf8'),
      originalResponseSize: Buffer.byteLength(response, 'utf8'),
      compressedPromptSize: compressedPrompt.length,
      compressedResponseSize: compressedResponse.length,
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
    };

    if (options.ttl) {
        metadata.expiresAt = now + options.ttl * 1000;
    } else {
        metadata.expiresAt = now + this.defaultTTL * 1000;
    }

    await this.redisStore.add(id, quantizedVector, metadata);
  }

  /**
   * Delete entry from cache
   * @param prompt - Prompt to delete
   * @returns Whether deletion was successful
   */
  async delete(prompt: string): Promise<boolean> {
    const normalized = this.normalizer.normalize(prompt);
    const promptHash = this.normalizer.hash(normalized, true);
    return await this.redisStore.delete(promptHash);
  }

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  async getStats(): Promise<CacheStats> {
    const storeStats = await this.redisStore.getStats();
    const hitRate =
      this._statistics.totalQueries > 0
        ? this._statistics.hits / this._statistics.totalQueries
        : 0;

    return {
      totalEntries: storeStats.totalEntries,
      memoryUsage: {
        vectors: storeStats.totalEntries * this.dim * 4,
        metadata: 0,
        total: 0,
      },
      compressionRatio: '0.00',
      cacheHits: this._statistics.hits,
      cacheMisses: this._statistics.misses,
      hitRate: hitRate.toFixed(4),
      totalQueries: this._statistics.totalQueries,
      savedTokens: this._statistics.savedTokens,
      savedUsd: Number(this._statistics.savedUsd.toFixed(5)),
    };
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    await this.redisStore.clear();
    await this.redisStore.createIndex(this.dim);
    this._statistics = { hits: 0, misses: 0, totalQueries: 0, savedTokens: 0, savedUsd: 0 };
  }

  /**
   * Destroy cache and free resources
   */
  async destroy(): Promise<void> {
    await this.redisStore.disconnect();
  }

  /**
   * Decompress response from metadata
   * @private
   */
  private _decompressResponse(metadata: CacheMetadata): string {
    return this.compressor.decompress(
      metadata.compressedResponse,
      metadata.originalResponseSize
    );
  }
}

export default SemanticCache;
