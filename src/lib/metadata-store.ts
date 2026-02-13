import {
  CacheMetadata,
  MetadataStoreConfig,
  MetadataStoreStats,
  LRUNode,
} from '../types/index.js';

/**
 * Metadata Store - Manages cache metadata with LRU eviction
 * Uses O(1) LRU implementation with doubly-linked list
 */
export class MetadataStore {
  readonly maxSize: number;
  private metadata: Map<string, CacheMetadata>;
  private promptHashIndex: Map<string, string>;
  private lruHead: LRUNode | null;
  private lruTail: LRUNode | null;
  private lruNodes: Map<string, LRUNode>;

  constructor(options: MetadataStoreConfig = {}) {
    this.maxSize = options.maxSize ?? 100000;
    this.metadata = new Map();
    this.promptHashIndex = new Map();
    this.lruHead = null;
    this.lruTail = null;
    this.lruNodes = new Map();
  }

  /**
   * Store metadata
   * @param id - Entry ID
   * @param data - Metadata
   * @param ttl - Time to live in seconds
   */
  set(id: string, data: CacheMetadata, ttl?: number): void {
    if (this.metadata.size >= this.maxSize && !this.metadata.has(id)) {
      this._evictLRU();
    }

    this._touchLRU(id);

    const expiresAt = ttl != null ? Date.now() + ttl * 1000 : null;

    const updatedData: CacheMetadata = {
      ...data,
      expiresAt: expiresAt ?? undefined,
      lastAccessed: Date.now(),
    };

    this.metadata.set(id, updatedData);

    if (data.promptHash) {
      this.promptHashIndex.set(data.promptHash, id);
    }
  }

  /**
   * Get metadata by ID
   * @param id - Entry ID
   * @returns Metadata or undefined if not found/expired
   */
  get(id: string): CacheMetadata | undefined {
    const data = this.metadata.get(id);
    if (data) {
      if (data.expiresAt && Date.now() > data.expiresAt) {
        this.delete(id);
        return undefined;
      }

      const updatedData: CacheMetadata = {
        ...data,
        lastAccessed: Date.now(),
        accessCount: (data.accessCount || 0) + 1,
      };
      this.metadata.set(id, updatedData);
      this._touchLRU(id);
      return updatedData;
    }
    return undefined;
  }

  /**
   * Find metadata by prompt hash
   * @param promptHash - Hash of normalized prompt
   * @returns Metadata or undefined if not found/expired
   */
  findByPromptHash(promptHash: string): CacheMetadata | undefined {
    const id = this.promptHashIndex.get(promptHash);
    if (id) {
      const data = this.metadata.get(id);
      if (data) {
        if (data.expiresAt && Date.now() > data.expiresAt) {
          this.delete(id);
          return undefined;
        }

        const updatedData: CacheMetadata = {
          ...data,
          lastAccessed: Date.now(),
          accessCount: (data.accessCount || 0) + 1,
        };
        this.metadata.set(id, updatedData);
        this._touchLRU(id);
        return updatedData;
      }
    }
    return undefined;
  }

  /**
   * Delete metadata
   * @param id - Entry ID
   * @returns Whether deletion was successful
   */
  delete(id: string): boolean {
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
   * @returns Store statistics
   */
  stats(): MetadataStoreStats {
    let totalCompressedSize = 0;
    for (const data of this.metadata.values()) {
      // Support both compressedResponseSize (standard) and compressedSize (legacy/test compatibility)
      totalCompressedSize += (data.compressedResponseSize ?? data.compressedSize ?? 0);
    }

    return {
      totalEntries: this.metadata.size,
      totalCompressedSize,
      memoryLimit: this.maxSize,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.metadata.clear();
    this.promptHashIndex.clear();
    this.lruNodes.clear();
    this.lruHead = null;
    this.lruTail = null;
  }

  /**
   * Iterate over all metadata entries
   * @yields Cache metadata entries
   */
  *values(): IterableIterator<CacheMetadata> {
    yield* this.metadata.values();
  }

  /**
   * Iterate over all metadata entries with IDs
   * @yields [id, metadata] tuples
   */
  *entries(): IterableIterator<[string, CacheMetadata]> {
    yield* this.metadata.entries();
  }

  /**
   * Touch/move ID to most recently used position
   * @private
   */
  private _touchLRU(id: string): void {
    this._removeFromLRU(id);

    const node: LRUNode = { id, prev: null, next: null };
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
  private _removeFromLRU(id: string): void {
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
  private _evictLRU(): void {
    if (!this.lruHead) return;

    const idToEvict = this.lruHead.id;
    this.delete(idToEvict);
  }
}

export default MetadataStore;
