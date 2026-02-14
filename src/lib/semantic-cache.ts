import {
  CacheConfig,
  CacheOptions,
  CacheResult,
  QueryOptions,
  CacheMetadata,
  CacheStats,
  InternalStatistics,
} from '../types/index.js';
import RedisVectorStore from './redis-vector-store.js';
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
  private store: RedisVectorStore;
  private _statistics: InternalStatistics;
  private initPromise: Promise<void>;

  constructor(options: CacheConfig = {}, deps: SemanticCacheDependencies = {}) {
    this.dim = options.dim ?? 1536;
    this.maxElements = options.maxElements ?? 100000;
    this.similarityThreshold = options.similarityThreshold ?? 0.85;
    this.memoryLimit = options.memoryLimit ?? '1gb';
    this.defaultTTL = options.defaultTTL ?? 3600;

    this.quantizer = deps.quantizer ?? new Quantizer();
    this.compressor = deps.compressor ?? new Compressor();
    this.normalizer = deps.normalizer ?? new Normalizer();

    this.store = new RedisVectorStore({
        dim: this.dim,
        distanceMetric: 'COSINE',
        indexName: process.env.VECTOR_INDEX_NAME,
        url: process.env.REDIS_URL
    });

    this._statistics = {
      hits: 0,
      misses: 0,
      totalQueries: 0,
      savedTokens: 0,
      savedUsd: 0,
    };

    this.initPromise = this.store.createIndex();
  }

  /**
   * Ensure index is initialized
   * @private
   */
  private async _ensureIndex(): Promise<void> {
    await this.initPromise;
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
    await this._ensureIndex();

    this._statistics.totalQueries++;
    const minSimilarity = options.minSimilarity ?? this.similarityThreshold;

    const normalized = this.normalizer.normalize(prompt);
    const promptHash = this.normalizer.hash(normalized, true);

    // Check exact match first
    const exactMatch = await this.store.findByPromptHash(promptHash);
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

    const quantizedQuery = this.quantizer.quantize(embedding);
    // Search for top K results
    const k = 10;

    const searchResults = await this.store.search(quantizedQuery, k);

    for (const result of searchResults) {
        // Redis HNSW cosine distance: 0 is identical, 1 is orthogonal/opposite?
        // Actually metric is 1 - CosineSimilarity.
        // So Similarity = 1 - Distance.
        const similarity = 1 - result.distance;

        if (similarity >= minSimilarity) {
            const metadata = result.metadata;
            this._statistics.hits++;
            const response = this._decompressResponse(metadata);
            return {
                response,
                similarity,
                isExactMatch: false,
                cachedAt: new Date(metadata.createdAt),
                metadata
            };
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
    await this._ensureIndex();

    const normalized = this.normalizer.normalize(prompt);
    const promptHash = this.normalizer.hash(normalized, true);

    const compressedPrompt = this.compressor.compress(prompt);
    const compressedResponse = this.compressor.compress(response);

    const quantizedVector = this.quantizer.quantize(embedding);

    // Use promptHash as the ID for deduplication
    const id = promptHash;

    const metadata: CacheMetadata = {
      id,
      vectorId: 0, // Not used with Redis backend
      promptHash,
      normalizedPrompt: normalized,
      compressedPrompt,
      compressedResponse,
      originalPromptSize: Buffer.byteLength(prompt, 'utf8'),
      originalResponseSize: Buffer.byteLength(response, 'utf8'),
      compressedPromptSize: compressedPrompt.length,
      compressedResponseSize: compressedResponse.length,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
      expiresAt: options.ttl ? Date.now() + options.ttl * 1000 : undefined
    };

    await this.store.add(id, quantizedVector, metadata);
  }

  /**
   * Delete entry from cache
   * @param prompt - Prompt to delete
   * @returns Whether deletion was successful
   */
  async delete(prompt: string): Promise<boolean> {
    const normalized = this.normalizer.normalize(prompt);
    const promptHash = this.normalizer.hash(normalized, true);
    return this.store.delete(promptHash);
  }

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  async getStats(): Promise<CacheStats> {
    const redisStats = await this.store.getStats();
    const totalEntries = parseInt(redisStats['num_docs'] || '0');

    // Parse memory info if available
    const vectorMem = parseFloat(redisStats['vector_index_sz_mb'] || '0') * 1024 * 1024;

    const hitRate =
      this._statistics.totalQueries > 0
        ? this._statistics.hits / this._statistics.totalQueries
        : 0;

    return {
      totalEntries,
      memoryUsage: {
        vectors: vectorMem,
        metadata: 0, // Difficult to estimate without expensive scan
        total: vectorMem,
      },
      compressionRatio: 'N/A', // Not available efficiently
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
    await this.store.clear();
    this._statistics = { hits: 0, misses: 0, totalQueries: 0, savedTokens: 0, savedUsd: 0 };
  }

  /**
   * Save cache to disk
   * @deprecated Not supported with Redis backend
   */
  async save(path: string): Promise<void> {
    throw new Error('Save to disk not supported with Redis backend');
  }

  /**
   * Load cache from disk
   * @deprecated Not supported with Redis backend
   */
  async load(path: string): Promise<void> {
    throw new Error('Load from disk not supported with Redis backend');
  }

  /**
   * Destroy cache and free resources
   */
  destroy(): void {
    this.store.disconnect();
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

  /**
   * Calculate overall compression ratio
   * @private
   */
  private _calculateCompressionRatio(): string {
    return '0';
  }
}

export default SemanticCache;
