const HNSWIndex = require('../src/lib/hnsw-index');

describe('HNSWIndex', () => {
  let index;
  const dim = 128;
  const maxElements = 1000;

  beforeEach(() => {
    index = new HNSWIndex(dim, maxElements, 'cosine');
  });

  afterEach(() => {
    index.destroy();
  });

  test('should add and search vectors', () => {
    const vector = Array(dim).fill(0).map(() => Math.random());
    const id = index.addItem(vector);
    
    expect(id).toBe(0);
    
    const results = index.search(vector, 1);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(0);
    expect(results[0].distance).toBeLessThan(0.001);
  });

  test('should search multiple vectors', () => {
    // Add 10 vectors
    for (let i = 0; i < 10; i++) {
      const vector = Array(dim).fill(0).map(() => Math.random());
      index.addItem(vector, i);
    }
    
    const query = Array(dim).fill(0).map(() => Math.random());
    const results = index.search(query, 5);
    
    expect(results).toHaveLength(5);
    results.forEach(r => {
      expect(r.id).toBeGreaterThanOrEqual(0);
      expect(r.id).toBeLessThan(10);
      expect(r.distance).toBeGreaterThanOrEqual(0);
    });
  });

  test('should save and load index', () => {
    const vector = Array(dim).fill(0).map(() => Math.random());
    index.addItem(vector, 42);
    
    const tempFile = '/app/test-index.bin';
    index.save(tempFile);
    
    const newIndex = new HNSWIndex(dim, maxElements, 'cosine');
    newIndex.load(tempFile);
    
    const results = newIndex.search(vector, 1);
    expect(results[0].id).toBe(42);
    
    newIndex.destroy();
  });
});
