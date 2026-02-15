import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import SemanticCache from '../src/lib/semantic-cache.js';

// Mock RedisVectorStore for testing SemanticCache logic without real Redis
class MockRedisStore {
  constructor() {
    this.data = new Map();
    this.index = [];
  }

  async createIndex(dim) {}

  async add(id, vector, metadata) {
    this.data.set(id, metadata);
    this.index.push({ id, vector });
  }

  async get(id) {
    return this.data.get(id) || null;
  }

  async findByPromptHash(hash) {
    return this.data.get(hash) || null;
  }

  async search(vector, k) {
    // Return all items with a fixed distance for testing
    // This simulates finding similar items
    return this.index.map(item => ({
      id: item.id,
      distance: 0.1 // Similarity 0.9
    })).slice(0, k);
  }

  async delete(id) {
    return this.data.delete(id);
  }

  async clear() {
    this.data.clear();
    this.index = [];
  }

  async getStats() {
    return { totalEntries: this.data.size };
  }

  async disconnect() {}
}

describe('SemanticCache', () => {
  let cache;
  const dim = 128;
  let mockStore;

  beforeEach(() => {
    mockStore = new MockRedisStore();
    cache = new SemanticCache({
      dim,
      maxElements: 1000,
      similarityThreshold: 0.85
    }, {
      redisStore: mockStore
    });
  });

  afterEach(async () => {
    await cache.destroy();
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
    
    // Mock store returns distance 0.1 (similarity 0.9)
    // Slightly different embedding for similar prompt
    const similarEmbedding = embedding.map(v => v + (Math.random() - 0.5) * 0.1);
    const result = await cache.get(prompt2, similarEmbedding, { minSimilarity: 0.80 });
    
    // Should find similar result (if similarity > threshold)
    if (result) {
      expect(result.similarity).toBeGreaterThan(0.80);
    } else {
        // If it failed, check why. The mock returns 0.9 similarity.
        // But SemanticCache.get also checks exact match first.
        // Here we expect semantic match.
        expect(result).not.toBeNull();
    }
  });

  test('should return null for cache miss', async () => {
    // Ensure mock store search returns empty if no data
    mockStore.search = async () => [];

    const result = await cache.get('Non-existent prompt', []);
    expect(result).toBeNull();
  });

  test('should return stats', async () => {
    const embedding = Array(dim).fill(0).map(() => Math.random());
    await cache.set('test', 'response', embedding);
    
    const stats = await cache.getStats();
    expect(stats.totalEntries).toBe(1);
    expect(stats.cacheHits).toBe(0);
    expect(stats.cacheMisses).toBe(0);
  });

  test('should track cache hits and misses', async () => {
    const prompt = 'Test prompt';
    const response = 'Test response';
    const embedding = Array(dim).fill(0).map(() => Math.random());
    
    // Ensure miss first
    mockStore.search = async () => [];
    await cache.get(prompt, embedding);
    
    // Add to cache
    await cache.set(prompt, response, embedding);
    
    // Restore search behavior or use exact match logic
    // exact match should work via findByPromptHash which uses data map

    // Second access - hit
    await cache.get(prompt, embedding);
    
    const stats = await cache.getStats();
    expect(stats.cacheMisses).toBe(1);
    expect(stats.cacheHits).toBe(1);
  });
});
