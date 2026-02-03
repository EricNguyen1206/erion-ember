import { promises as fs } from 'fs';
import HNSWIndex from './hnsw-index.js';
import Quantizer from './quantizer.js';
import Compressor from './compressor.js';
import Normalizer from './normalizer.js';
import MetadataStore from './metadata-store.js';

/**
 * Semantic Cache - High-performance cache for LLM queries with vector search
 */
class SemanticCache {
  constructor(options = {}) {
    this.dim = options.dim || 1536;
    this.maxElements = options.maxElements || 100000;
    this.similarityThreshold = options.similarityThreshold || 0.85;
    this.memoryLimit = options.memoryLimit || '1gb';
    this.defaultTTL = options.defaultTTL || 3600; // Default TTL: 1 hour (seconds)
    
    // Initialize components
    this.index = new HNSWIndex(this.dim, this.maxElements, 'cosine');
    this.quantizer = new Quantizer('int8');
    this.compressor = new Compressor();
    this.normalizer = new Normalizer();
    this.metadataStore = new MetadataStore({ maxSize: this.maxElements });
    
    // Statistics (private)
    this._statistics = {
      hits: 0,
      misses: 0,
      totalQueries: 0,
      savedTokens: 0,
      savedUsd: 0
    };
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
    this._statistics.totalQueries++;
    const minSimilarity = options.minSimilarity || this.similarityThreshold;
    
    // Normalize prompt
    const normalized = this.normalizer.normalize(prompt);
    const promptHash = this.normalizer.hash(prompt);
    
    // Check exact match first
    const exactMatch = this.metadataStore.findByPromptHash(promptHash);
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
    
    // If no embedding provided, can't do semantic search
    if (!embedding) {
      this._statistics.misses++;
      return null;
    }
    
    // Search similar vectors
    const quantizedQuery = this.quantizer.quantize(embedding);
    const searchResults = this.index.search(quantizedQuery, 5);
    
    // Find best match above threshold
    for (const result of searchResults) {
      // Convert distance to similarity (cosine distance -> similarity)
      const similarity = 1 - result.distance;
      
      if (similarity >= minSimilarity) {
        const metadata = this.metadataStore.get(result.id.toString());
        if (metadata) {
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
    // Normalize and hash prompt
    const normalized = this.normalizer.normalize(prompt);
    const promptHash = this.normalizer.hash(prompt);
    
    // Compress data
    const compressedPrompt = this.compressor.compress(prompt);
    const compressedResponse = this.compressor.compress(response);
    
    // Quantize vector
    const quantizedVector = this.quantizer.quantize(embedding);
    
    // Add to HNSW index
    const vectorId = this.index.addItem(quantizedVector);
    
    // Store metadata
    const id = vectorId.toString();
    const metadata = {
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
      accessCount: 0
    };
    
    const ttl = options.ttl || this.defaultTTL;
    this.metadataStore.set(id, metadata, ttl);
  }

  /**
   * Delete entry from cache
   * @param {string} prompt - Prompt to delete
   * @returns {boolean}
   */
  delete(prompt) {
    const promptHash = this.normalizer.hash(prompt);
    const metadata = this.metadataStore.findByPromptHash(promptHash);
    
    if (metadata) {
      return this.metadataStore.delete(metadata.id);
    }
    return false;
  }

  /**
   * Get cache statistics
   * @returns {object}
   */
  getStats() {
    const storeStats = this.metadataStore.stats();
    const hitRate = this._statistics.totalQueries > 0 
      ? (this._statistics.hits / this._statistics.totalQueries) 
      : 0;
    
    return {
      totalEntries: storeStats.totalEntries,
      memoryUsage: {
        vectors: storeStats.totalEntries * this.dim, // INT8 bytes
        metadata: storeStats.totalCompressedSize,
        total: storeStats.totalEntries * this.dim + storeStats.totalCompressedSize
      },
      compressionRatio: this._calculateCompressionRatio(),
      cacheHits: this._statistics.hits,
      cacheMisses: this._statistics.misses,
      hitRate: hitRate.toFixed(4),
      totalQueries: this._statistics.totalQueries,
      savedTokens: this._statistics.savedTokens,
      savedUsd: Number(this._statistics.savedUsd.toFixed(5))
    };
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.metadataStore.clear();
    this.index = new HNSWIndex(this.dim, this.maxElements, 'cosine');
    this._statistics = { hits: 0, misses: 0, totalQueries: 0, savedTokens: 0, savedUsd: 0 };
  }

  /**
   * Save cache to disk
   * @param {string} path - Directory path
   */
  async save(path) {
    // Save HNSW index
    this.index.save(`${path}/index.bin`);
    
    // Save metadata
    const metadata = {
      stats: this._statistics,
      store: Array.from(this.metadataStore.metadata.entries()),
      config: {
        dim: this.dim,
        maxElements: this.maxElements,
        similarityThreshold: this.similarityThreshold
      }
    };
    await fs.writeFile(`${path}/metadata.json`, JSON.stringify(metadata, null, 2));
  }

  /**
   * Load cache from disk
   * @param {string} path - Directory path
   */
  async load(path) {
    // Load HNSW index
    this.index.load(`${path}/index.bin`);
    
    // Load metadata
    const data = await fs.readFile(`${path}/metadata.json`, 'utf8');
    const metadata = JSON.parse(data);
    
    // Restore metadata store
    this.metadataStore.clear();
    for (const [id, data] of metadata.store) {
      this.metadataStore.set(id, data);
    }
    
    // Restore stats
    this._statistics = metadata.stats;
  }

  /**
   * Destroy cache and free resources
   */
  destroy() {
    this.index.destroy();
    this.metadataStore.clear();
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

  /**
   * Calculate overall compression ratio
   * @private
   */
  _calculateCompressionRatio() {
    let totalOriginal = 0;
    let totalCompressed = 0;
    
    for (const data of this.metadataStore.metadata.values()) {
      totalOriginal += data.originalResponseSize;
      totalCompressed += data.compressedResponseSize;
    }
    
    return totalOriginal > 0 ? (totalCompressed / totalOriginal).toFixed(2) : 0;
  }
}

export default SemanticCache;
