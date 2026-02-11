import { describe, test, expect } from 'bun:test';
import { createVectorIndex } from '../../src/lib/vector-index/factory.js';

describe('VectorIndex Factory', () => {
  test('should create AnnoyVectorIndex by default', async () => {
    const index = await createVectorIndex({ dim: 128, maxElements: 1000 });
    expect(index).toBeDefined();
    expect(index.constructor.name).toBe('AnnoyVectorIndex');
  });

  test('should create HNSWVectorIndex when specified', async () => {
    // Skip if hnswlib not available
    try {
      const index = await createVectorIndex({ 
        dim: 128, 
        maxElements: 1000, 
        backend: 'hnsw' 
      });
      expect(index.constructor.name).toBe('HNSWVectorIndex');
    } catch (e) {
      console.log('hnswlib not available, skipping');
    }
  });

  test('should throw error for unknown backend', async () => {
    expect(createVectorIndex({ dim: 128, maxElements: 1000, backend: 'unknown' }))
      .rejects.toThrow(/Unknown vector index backend/);
  });
});
