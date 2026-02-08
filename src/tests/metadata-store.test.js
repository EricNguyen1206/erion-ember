import MetadataStore from '../lib/metadata-store.js';

describe('MetadataStore', () => {
  let store;

  beforeEach(() => {
    store = new MetadataStore({ maxSize: 100 });
  });

  test('should store and retrieve metadata', () => {
    const metadata = {
      id: 'uuid-1',
      vectorId: 0,
      promptHash: 'abc123',
      compressedPrompt: Buffer.from('compressed'),
      compressedResponse: Buffer.from('response'),
      originalSize: 100,
      compressedSize: 50,
      createdAt: Date.now()
    };
    
    store.set('uuid-1', metadata);
    const retrieved = store.get('uuid-1');
    
    // Check key fields (accessCount and lastAccessed are dynamic)
    expect(retrieved.id).toBe(metadata.id);
    expect(retrieved.vectorId).toBe(metadata.vectorId);
    expect(retrieved.promptHash).toBe(metadata.promptHash);
    expect(retrieved.accessCount).toBe(1); // First access
  });

  test('should find by prompt hash', () => {
    store.set('uuid-1', { promptHash: 'hash1', vectorId: 0 });
    
    const result = store.findByPromptHash('hash1');
    expect(result.promptHash).toBe('hash1');
    expect(result.vectorId).toBe(0);
    expect(result.accessCount).toBe(1); // First access
  });

  test('should implement LRU eviction', () => {
    // Fill store to capacity
    for (let i = 0; i < 100; i++) {
      store.set(`uuid-${i}`, { 
        id: `uuid-${i}`,
        promptHash: `hash-${i}`,
        vectorId: i,
        lastAccessed: i
      });
    }
    
    // Access first item to make it recently used
    store.get('uuid-0');
    
    // Add one more - should evict least recently used
    store.set('uuid-100', { 
      id: 'uuid-100',
      promptHash: 'hash-100',
      vectorId: 100,
      lastAccessed: 100
    });
    
    // uuid-0 should still exist (recently accessed)
    expect(store.get('uuid-0')).toBeDefined();
    
    // uuid-1 should be evicted (least recently used)
    expect(store.get('uuid-1')).toBeUndefined();
  });

  test('should return stats', () => {
    store.set('uuid-1', { compressedSize: 100 });
    store.set('uuid-2', { compressedSize: 200 });
    
    const stats = store.stats();
    expect(stats.totalEntries).toBe(2);
    expect(stats.totalCompressedSize).toBe(300);
  });
});
