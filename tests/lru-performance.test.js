import MetadataStore from '../src/lib/metadata-store.js';

describe('MetadataStore LRU Performance', () => {
  test('LRU operations should be O(1)', () => {
    const store = new MetadataStore({ maxSize: 10000 });
    
    // Fill store
    for (let i = 0; i < 5000; i++) {
      store.set(`id-${i}`, { promptHash: `hash-${i}`, vectorId: i });
    }
    
    // Measure time for 1000 get operations
    const startGet = performance.now();
    for (let i = 0; i < 1000; i++) {
      store.get(`id-${i % 5000}`);
    }
    const getDuration = performance.now() - startGet;
    
    // Should be fast (< 50ms for 1000 ops with O(1))
    expect(getDuration).toBeLessThan(50);
  });

  test('LRU should evict least recently used correctly', () => {
    const store = new MetadataStore({ maxSize: 5 });
    
    // Add items
    for (let i = 0; i < 5; i++) {
      store.set(`id-${i}`, { promptHash: `hash-${i}`, vectorId: i });
    }
    
    // Access id-0 (make it recently used)
    store.get('id-0');
    
    // Add a new item - should evict id-1 (LRU)
    store.set('id-5', { promptHash: 'hash-5', vectorId: 5 });
    
    expect(store.get('id-0')).toBeDefined();
    expect(store.get('id-1')).toBeUndefined();
    expect(store.get('id-5')).toBeDefined();
  });

  test('LRU should handle access updates correctly', () => {
    const store = new MetadataStore({ maxSize: 3 });
    
    store.set('a', { promptHash: 'ha' });
    store.set('b', { promptHash: 'hb' });
    store.set('c', { promptHash: 'hc' });
    
    // Access 'a' to make it recently used
    store.get('a');
    
    // Add new item - should evict 'b' (LRU)
    store.set('d', { promptHash: 'hd' });
    
    expect(store.get('a')).toBeDefined();
    expect(store.get('b')).toBeUndefined();
    expect(store.get('c')).toBeDefined();
    expect(store.get('d')).toBeDefined();
  });
});