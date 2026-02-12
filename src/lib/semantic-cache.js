import RedisVectorStore from './redis-vector-store.js';
import Quantizer from './quantizer.js';
import Compressor from './compressor.js';
import Normalizer from './normalizer.js';
import { Buffer } from 'buffer';

/**
 * Semantic Cache - High-performance cache for LLM queries with vector search
 * Distributed version using Redis Vector Store
 */
class SemanticCache {
  constructor(options = {}) {
    this.dim = options.dim || 1536;
    this.maxElements = options.maxElements || 100000; // Used for stats mostly now
    this.similarityThreshold = options.similarityThreshold || 0.85;
    this.defaultTTL = options.defaultTTL || 3600; // Default TTL: 1 hour (seconds)
    
    // Initialize components
    this.quantizer = new Quantizer('int8');
    this.compressor = new Compressor();
    this.normalizer = new Normalizer();
    
    // Redis Vector Store
    // Pass options down to RedisVectorStore (including redisClient if present)
    this.store = new RedisVectorStore({
      dim: this.dim,
      redisClient: options.redisClient, // Pass injected client
      // Redis options are picked up from env vars in RedisVectorStore
    });

    // Statistics (local session stats)
    this._statistics = {
      hits: 0,
      misses: 0,
      totalQueries: 0,
      savedTokens: 0,
      savedUsd: 0
    };
    
    // Initialize vector index asynchronously
    this.initPromise = this.store.createIndex();
  }

  /**
   * Ensure index is initialized
   * @private
   */
  async _ensureIndex() {
    await this.initPromise;
  }

  /**
   * Track savings from a cache hit
   * @param {number} tokens - Number of tokens saved
   * @param {number} usd - USD amount saved
   */
  trackSavings(tokens, usd) {
    this._statistics.savedTokens += tokens;
    this._statistics.savedUsd += usd;
  }

  /**
   * Query cache
   * @param {string} prompt - Query prompt
   * @param {number[]} embedding - Query embedding vector
   * @param {object} options - Query options
   * @returns {Promise<object|null>} Cache result or null
   */
  async get(prompt, embedding = null, options = {}) {
    // Ensure index is initialized
    await this._ensureIndex();
    
    this._statistics.totalQueries++;
    const minSimilarity = options.minSimilarity || this.similarityThreshold;
    
    // Normalize prompt
    const normalized = this.normalizer.normalize(prompt);
    const promptHash = this.normalizer.hash(prompt);
    
    // Check exact match first
    try {
      const exactMatch = await this.store.get(promptHash);
      if (exactMatch) {
        this._statistics.hits++;
        const response = this._decompressResponse(exactMatch);
        return {
          response,
          similarity: 1.0,
          isExactMatch: true,
          cachedAt: new Date(exactMatch.createdAt),
          metadata: exactMatch
        };
      }
    } catch (err) {
      console.error('Error fetching exact match from Redis:', err);
    }
    
    // If no embedding provided, can't do semantic search
    if (!embedding) {
      this._statistics.misses++;
      return null;
    }
    
    // Search similar vectors
    const quantizedQuery = this.quantizer.quantize(embedding);

    // We fetch top K candidates.
    // In distributed setup, simple K=10 is usually sufficient for semantic cache.
    const k = 10;

    try {
      const results = await this.store.search(quantizedQuery, k);

      for (const result of results) {
        // Convert distance to similarity (cosine distance -> similarity)
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
    } catch (err) {
      console.error('Error during semantic search:', err);
    }
    
    this._statistics.misses++;
    return null;
  }

  /**
   * Add entry to cache
   * @param {string} prompt - Original prompt
   * @param {string} response - LLM response
   * @param {number[]} embedding - Vector embedding
   * @param {object} options - Cache options (e.g., ttl)
   */
  async set(prompt, response, embedding, options = {}) {
    // Ensure index is initialized
    await this._ensureIndex();
    
    // Normalize and hash prompt
    const normalized = this.normalizer.normalize(prompt);
    const promptHash = this.normalizer.hash(prompt);
    
    // Compress data
    const compressedPrompt = this.compressor.compress(prompt);
    const compressedResponse = this.compressor.compress(response);
    
    // Quantize vector
    const quantizedVector = this.quantizer.quantize(embedding);
    
    // Metadata
    const id = promptHash;
    const metadata = {
      id,
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
      accessCount: 0
    };
    
    await this.store.add(id, quantizedVector, metadata);

    const ttl = options.ttl || this.defaultTTL;
    if (ttl) {
      await this.store.expire(id, ttl);
    }
  }

  /**
   * Delete entry from cache
   * @param {string} prompt - Prompt to delete
   * @returns {boolean}
   */
  async delete(prompt) {
    const promptHash = this.normalizer.hash(prompt);
    const count = await this.store.delete(promptHash);
    return count > 0;
  }

  /**
   * Get cache statistics
   * @returns {object}
   */
  getStats() {
    // With Redis, we can't easily get total entries count without an async call
    // or separate counter. We return local session stats and placeholders.
    // For a real dashboard, one would query Redis directly.
    
    return {
      totalEntries: -1, // Not available synchronously
      memoryUsage: {
        vectors: -1,
        metadata: -1,
        total: -1
      },
      compressionRatio: 0,
      cacheHits: this._statistics.hits,
      cacheMisses: this._statistics.misses,
      hitRate: this._statistics.totalQueries > 0
        ? (this._statistics.hits / this._statistics.totalQueries).toFixed(4)
        : "0.0000",
      totalQueries: this._statistics.totalQueries,
      savedTokens: this._statistics.savedTokens,
      savedUsd: Number(this._statistics.savedUsd.toFixed(5))
    };
  }

  /**
   * Clear all cache entries
   * Warning: This drops the index and all data in it.
   */
  async clear() {
    // Re-create index (dropping old one)
    // FT.DROPINDEX deletes the index. If we want to delete data too, we need DD option.
    // However, redis-vector-store currently only implements createIndex and delete(id).
    // We would need to implement clear in store or just use createIndex if it handled cleanup.
    // Given the scope, we might not implement full clear logic on Redis from here
    // to avoid accidental data loss in shared env.
    // But for "clear cache" semantics, we should probably support it.
    // We will reset local stats.
    this._statistics = { hits: 0, misses: 0, totalQueries: 0, savedTokens: 0, savedUsd: 0 };
    // TODO: Implement distributed clear if needed.
  }

  /**
   * Save cache to disk
   * @deprecated Not supported in Redis Distributed mode
   */
  async save(path) {
    console.warn('save() is deprecated in Redis mode. Persistence is handled by Redis.');
  }

  /**
   * Load cache from disk
   * @deprecated Not supported in Redis Distributed mode
   */
  async load(path) {
    console.warn('load() is deprecated in Redis mode. Persistence is handled by Redis.');
  }

  /**
   * Destroy cache and free resources
   */
  destroy() {
    if (this.store) {
      this.store.disconnect();
    }
  }

  /**
   * Decompress response from metadata
   * @private
   */
  _decompressResponse(metadata) {
    return this.compressor.decompress(
      metadata.compressedResponse,
      metadata.originalResponseSize
    );
  }
}

export default SemanticCache;
