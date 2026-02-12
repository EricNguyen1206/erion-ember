import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

// Mock RedisVectorStore
mock.module('../src/lib/redis-vector-store.js', () => {
  return {
    default: class MockRedisVectorStore {
      constructor() {
        this.data = new Map();
      }
      async createIndex() {}
      async add(id, vector, metadata) {
        this.data.set(id, { vector, metadata });
      }
      async get(id) {
        const item = this.data.get(id);
        return item ? item.metadata : null;
      }
      async search(vector, k) {
        // Mock search: return all items with high similarity
        return Array.from(this.data.values()).map(item => ({
            id: item.metadata.id,
            distance: 0.05, // 0.95 similarity
            metadata: item.metadata
        }));
      }
      async delete(id) {
        return this.data.delete(id) ? 1 : 0;
      }
      async expire() {}
      disconnect() {}
    }
  };
});

const { default: SemanticCache } = await import('../src/lib/semantic-cache.js');

describe('SemanticCache', () => {
  let cache;
  const dim = 128;

  beforeEach(() => {
    cache = new SemanticCache({
      dim,
      maxElements: 1000,
      similarityThreshold: 0.85
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('should cache and retrieve exact match', async () => {
    const prompt = 'What is machine learning?';
    const response = 'Machine learning is a subset of AI.';
    const embedding = Array(dim).fill(0).map(() => Math.random());
    
    await cache.set(prompt, response, embedding);
    const result = await cache.get(prompt);
    
    expect(result).not.toBeNull();
    expect(result.response).toBe(response);
    expect(result.isExactMatch).toBe(true);
    expect(result.similarity).toBe(1.0);
  });

  test('should find similar prompts', async () => {
    const prompt1 = 'What is machine learning?';
    const prompt2 = 'Explain machine learning'; // Similar meaning
    const response = 'Machine learning is...';
    const embedding = Array(dim).fill(0).map(() => Math.random());
    
    await cache.set(prompt1, response, embedding);
    
    // Slightly different embedding for similar prompt
    const similarEmbedding = embedding.map(v => v + (Math.random() - 0.5) * 0.1);
    const result = await cache.get(prompt2, similarEmbedding, { minSimilarity: 0.80 });
    
    // Should find similar result (mock returns 0.95 similarity)
    if (result) {
      expect(result.similarity).toBeGreaterThan(0.80);
    } else {
        // Fail if not found (mock should return it)
        expect(result).not.toBeNull();
    }
  });

  test('should return null for cache miss', async () => {
    // Assuming mock search returns empty if no data?
    // Wait, my mock search returns EVERYTHING.
    // If cache is empty, it returns empty array.
    const result = await cache.get('Non-existent prompt', Array(dim).fill(0));
    // If cache is empty, result is null.
    expect(result).toBeNull();
  });

  test('should return stats', async () => {
    const embedding = Array(dim).fill(0).map(() => Math.random());
    await cache.set('test', 'response', embedding);
    
    const stats = cache.getStats();
    // totalEntries is -1 in Redis implementation
    expect(stats.totalEntries).toBe(-1);
    expect(stats.cacheHits).toBe(0);
    expect(stats.cacheMisses).toBe(0);
  });

  test('should track cache hits and misses', async () => {
    const prompt = 'Test prompt';
    const response = 'Test response';
    const embedding = Array(dim).fill(0).map(() => Math.random());
    
    // First access - miss (cache is empty)
    await cache.get(prompt, embedding);
    
    // Add to cache
    await cache.set(prompt, response, embedding);
    
    // Second access - hit (exact match)
    await cache.get(prompt, embedding);
    
    const stats = cache.getStats();
    expect(stats.cacheMisses).toBe(1);
    expect(stats.cacheHits).toBe(1);
  });
});
