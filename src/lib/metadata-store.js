/**
 * Metadata Store - Manages cache metadata with LRU eviction
 */
class MetadataStore {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100000;
    this.metadata = new Map(); // id -> metadata
    this.promptHashIndex = new Map(); // promptHash -> id
    this.lruQueue = []; // Ordered list for LRU
  }

  /**
   * Store metadata
   * @param {string} id - Entry ID
   * @param {object} data - Metadata
   */
  set(id, data) {
    // Check if we need to evict
    if (this.metadata.size >= this.maxSize && !this.metadata.has(id)) {
      this._evictLRU();
    }
    
    // Update LRU queue
    this._updateLRU(id);
    
    // Store metadata
    this.metadata.set(id, {
      ...data,
      lastAccessed: Date.now()
    });
    
    // Update prompt hash index
    if (data.promptHash) {
      this.promptHashIndex.set(data.promptHash, id);
    }
  }

  /**
   * Get metadata by ID
   * @param {string} id - Entry ID
   * @returns {object|undefined}
   */
  get(id) {
    const data = this.metadata.get(id);
    if (data) {
      // Update access time and LRU
      data.lastAccessed = Date.now();
      data.accessCount = (data.accessCount || 0) + 1;
      this._updateLRU(id);
      // Return a copy to prevent external modification
      return { ...data };
    }
    return undefined;
  }

  /**
   * Find metadata by prompt hash
   * @param {string} promptHash - Hash of normalized prompt
   * @returns {object|undefined}
   */
  findByPromptHash(promptHash) {
    const id = this.promptHashIndex.get(promptHash);
    if (id) {
      const data = this.metadata.get(id);
      if (data) {
        // Update access time and LRU
        data.lastAccessed = Date.now();
        data.accessCount = (data.accessCount || 0) + 1;
        this._updateLRU(id);
        return { ...data };
      }
    }
    return undefined;
  }

  /**
   * Delete metadata
   * @param {string} id - Entry ID
   * @returns {boolean}
   */
  delete(id) {
    const data = this.metadata.get(id);
    if (data) {
      this.promptHashIndex.delete(data.promptHash);
      this.metadata.delete(id);
      this._removeFromLRU(id);
      return true;
    }
    return false;
  }

  /**
   * Get store statistics
   * @returns {object}
   */
  stats() {
    let totalCompressedSize = 0;
    for (const data of this.metadata.values()) {
      totalCompressedSize += data.compressedSize || 0;
    }
    
    return {
      totalEntries: this.metadata.size,
      totalCompressedSize,
      memoryLimit: this.maxSize
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.metadata.clear();
    this.promptHashIndex.clear();
    this.lruQueue = [];
  }

  /**
   * Update LRU queue
   * @private
   */
  _updateLRU(id) {
    // Remove from current position
    this._removeFromLRU(id);
    // Add to end (most recently used)
    this.lruQueue.push(id);
  }

  /**
   * Remove from LRU queue
   * @private
   */
  _removeFromLRU(id) {
    const index = this.lruQueue.indexOf(id);
    if (index > -1) {
      this.lruQueue.splice(index, 1);
    }
  }

  /**
   * Evict least recently used entry
   * @private
   */
  _evictLRU() {
    if (this.lruQueue.length === 0) return;
    
    const idToEvict = this.lruQueue[0]; // First = least recently used
    this.delete(idToEvict);
  }
}

module.exports = MetadataStore;
