/**
 * Metadata Store - Manages cache metadata with LRU eviction
 * Uses O(1) LRU implementation with doubly-linked list
 */
class MetadataStore {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100000;
    this.metadata = new Map();
    this.promptHashIndex = new Map();
    
    this.lruHead = null;
    this.lruTail = null;
    this.lruNodes = new Map();
  }

  /**
   * Store metadata
   * @param {string} id - Entry ID
   * @param {object} data - Metadata
   * @param {number} [ttl] - Time to live in seconds
   */
  set(id, data, ttl) {
    if (this.metadata.size >= this.maxSize && !this.metadata.has(id)) {
      this._evictLRU();
    }
    
    this._touchLRU(id);
    
    const expiresAt = ttl ? Date.now() + (ttl * 1000) : null;

    this.metadata.set(id, {
      ...data,
      expiresAt,
      lastAccessed: Date.now()
    });
    
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
      if (data.expiresAt && Date.now() > data.expiresAt) {
        this.delete(id);
        return undefined;
      }

      data.lastAccessed = Date.now();
      data.accessCount = (data.accessCount || 0) + 1;
      this._touchLRU(id);
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
        if (data.expiresAt && Date.now() > data.expiresAt) {
          this.delete(id);
          return undefined;
        }

        data.lastAccessed = Date.now();
        data.accessCount = (data.accessCount || 0) + 1;
        this._touchLRU(id);
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
    this.lruNodes.clear();
    this.lruHead = null;
    this.lruTail = null;
  }

  /**
   * Touch/move ID to most recently used position
   * @private
   */
  _touchLRU(id) {
    this._removeFromLRU(id);
    
    const node = { id, prev: null, next: null };
    this.lruNodes.set(id, node);
    
    if (!this.lruTail) {
      this.lruHead = node;
      this.lruTail = node;
    } else {
      node.prev = this.lruTail;
      this.lruTail.next = node;
      this.lruTail = node;
    }
  }

  /**
   * Remove from LRU list
   * @private
   */
  _removeFromLRU(id) {
    const node = this.lruNodes.get(id);
    if (!node) return;
    
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.lruHead = node.next;
    }
    
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.lruTail = node.prev;
    }
    
    this.lruNodes.delete(id);
  }

  /**
   * Evict least recently used entry
   * @private
   */
  _evictLRU() {
    if (!this.lruHead) return;
    
    const idToEvict = this.lruHead.id;
    this.delete(idToEvict);
  }
}

export default MetadataStore;