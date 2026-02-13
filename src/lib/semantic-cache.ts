import {
  CacheConfig,
  CacheOptions,
  CacheResult,
  QueryOptions,
  CacheMetadata,
  CacheStats,
  InternalStatistics,
  SearchResult,
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
  private vectorStore: RedisVectorStore;
  private _statistics: InternalStatistics;

  // Track initialization
  private initPromise: Promise<void> | null = null;

  constructor(options: CacheConfig = {}, deps: SemanticCacheDependencies = {}) {
    this.dim = options.dim ?? 1536;
    this.maxElements = options.maxElements ?? 100000;
    this.similarityThreshold = options.similarityThreshold ?? 0.85;
    this.memoryLimit = options.memoryLimit ?? '1gb';
    this.defaultTTL = options.defaultTTL ?? 3600;

    this.quantizer = deps.quantizer ?? new Quantizer();
    this.compressor = deps.compressor ?? new Compressor();
    this.normalizer = deps.normalizer ?? new Normalizer();

    // Initialize RedisVectorStore
    // We rely on env vars for Redis config, but could extend CacheConfig to support it.
    this.vectorStore = new RedisVectorStore();

    this._statistics = {
      hits: 0,
      misses: 0,
      totalQueries: 0,
      savedTokens: 0,
      savedUsd: 0,
    };

    this.initPromise = this._init();
  }

  /**
   * Initialize vector store asynchronously
   * @private
   */
  private async _init(): Promise<void> {
    await this.vectorStore.connect();
    await this.vectorStore.createIndex(this.dim);
  }

  /**
   * Ensure store is initialized
   * @private
   */
  private async _ensureInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
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
    await this._ensureInit();

    this._statistics.totalQueries++;
    const minSimilarity = options.minSimilarity ?? this.similarityThreshold;

    const normalized = this.normalizer.normalize(prompt);
    const promptHash = this.normalizer.hash(normalized, true);

    // Check exact match first
    const exactMatch = await this.vectorStore.findByPromptHash(promptHash);
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
    // KNN search. We use a fixed k or dynamic?
    // The original code increased k.
    // Redis KNN is efficient. We can just ask for top K (e.g. 5 or 10).
    // If we want "all above threshold", we might need range search (FT.SEARCH @vector:[VECTOR_RANGE ...])
    // But HNSW usually supports KNN.
    // Let's use KNN 10.
    const k = 10;

    const searchResults = await this.vectorStore.search(quantizedQuery, k);

    for (const result of searchResults) {
      // result.distance is cosine distance (0..2).
      // similarity = 1 - distance.
      // Wait, if distance > 1 (vectors opposite), similarity < 0.
      // Usually we care about > threshold (0.85).
      const similarity = 1 - result.distance;

      if (similarity >= minSimilarity) {
        const metadata = await this.vectorStore.get(result.id.toString());
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
    await this._ensureInit();

    const normalized = this.normalizer.normalize(prompt);
    const promptHash = this.normalizer.hash(normalized, true);

    const compressedPrompt = this.compressor.compress(prompt);
    const compressedResponse = this.compressor.compress(response);

    const quantizedVector = this.quantizer.quantize(embedding);

    const vectorId = await this.vectorStore.generateId();
    const id = vectorId.toString();

    const metadata: CacheMetadata = {
      id,
      vectorId,
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
    };

    if (options.ttl) {
        metadata.expiresAt = Date.now() + options.ttl * 1000;
    }

    await this.vectorStore.add(id, quantizedVector, metadata);
  }

  /**
   * Delete entry from cache
   * @param prompt - Prompt to delete
   * @returns Whether deletion was successful
   */
  async delete(prompt: string): Promise<boolean> {
    await this._ensureInit();
    const normalized = this.normalizer.normalize(prompt);
    const promptHash = this.normalizer.hash(normalized, true);
    const metadata = await this.vectorStore.findByPromptHash(promptHash);

    if (metadata) {
      return await this.vectorStore.delete(metadata.id);
    }
    return false;
  }

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  async getStats(): Promise<CacheStats> {
    await this._ensureInit();
    // We could implement getStats in RedisVectorStore to return DB size.
    // For now returning partial stats.
    const storeStats = await this.vectorStore.getStats();

    const hitRate =
      this._statistics.totalQueries > 0
        ? this._statistics.hits / this._statistics.totalQueries
        : 0;

    return {
      totalEntries: storeStats.totalEntries || 0,
      memoryUsage: {
        vectors: 0,
        metadata: 0,
        total: 0,
      },
      compressionRatio: '0',
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
    await this._ensureInit();
    await this.vectorStore.clear();
    await this.vectorStore.createIndex(this.dim);
    this._statistics = { hits: 0, misses: 0, totalQueries: 0, savedTokens: 0, savedUsd: 0 };
  }

  /**
   * Save cache to disk
   * @deprecated Not supported with Redis backend
   */
  async save(path: string): Promise<void> {
    console.warn('save() is deprecated when using Redis Vector Store. Data is persisted in Redis.');
  }

  /**
   * Load cache from disk
   * @deprecated Not supported with Redis backend
   */
  async load(path: string): Promise<void> {
    console.warn('load() is deprecated when using Redis Vector Store.');
  }

  /**
   * Destroy cache and free resources
   */
  destroy(): void {
    // No-op for now
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
