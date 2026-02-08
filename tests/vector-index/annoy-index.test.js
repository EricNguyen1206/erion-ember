import { describe, test, expect, beforeEach } from 'bun:test';
import AnnoyVectorIndex from '../../src/lib/vector-index/annoy-index.js';

describe('AnnoyVectorIndex', () => {
  let index;
  const dim = 128;
  const maxElements = 1000;

  beforeEach(() => {
    index = new AnnoyVectorIndex(dim, maxElements, 'cosine');
  });

  test('should add and retrieve items', () => {
    const vector = new Array(dim).fill(0).map((_, i) => i / dim);
    const id = index.addItem(vector);
    
    expect(id).toBe(0);
    expect(index.getCount()).toBe(1);
  });

  test('should search for nearest neighbors', () => {
    // Add two vectors
    const vec1 = new Array(dim).fill(0).map(() => Math.random());
    const vec2 = new Array(dim).fill(0).map(() => Math.random());
    
    index.addItem(vec1, 0);
    index.addItem(vec2, 1);
    
    // Search with first vector
    const results = index.search(vec1, 2);
    
    expect(results.length).toBe(2);
    expect(results[0].id).toBe(0); // First result should be exact match
    expect(results[0].distance).toBeLessThan(0.01); // Very small distance
  });

  test('should save and load index', async () => {
    const vector = new Array(dim).fill(0.5);
    index.addItem(vector, 42);
    
    const tempPath = '/tmp/test-annoy-index.json';
    index.save(tempPath);
    
    const newIndex = new AnnoyVectorIndex(dim, maxElements, 'cosine');
    newIndex.load(tempPath);
    
    // getCount() returns currentId (next available ID), not item count
    // Adding item with ID 42 sets currentId to 43
    expect(newIndex.getCount()).toBe(43);
    
    // Clean up
    await import('fs').then(fs => fs.promises.unlink(tempPath));
  });

  test('should destroy index', () => {
    index.destroy();
    expect(index.annoy).toBeNull();
  });
});
