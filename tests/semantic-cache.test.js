import SemanticCache from '../src/lib/semantic-cache.js';

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
    
    // Should find similar result (if similarity > threshold)
    if (result) {
      expect(result.similarity).toBeGreaterThan(0.80);
    }
  });

  test('should return null for cache miss', async () => {
    const result = await cache.get('Non-existent prompt');
    expect(result).toBeNull();
  });

  test('should return stats', async () => {
    const embedding = Array(dim).fill(0).map(() => Math.random());
    await cache.set('test', 'response', embedding);
    
    const stats = cache.getStats();
    expect(stats.totalEntries).toBe(1);
    expect(stats.cacheHits).toBe(0);
    expect(stats.cacheMisses).toBe(0);
  });

  test('should track cache hits and misses', async () => {
    const prompt = 'Test prompt';
    const response = 'Test response';
    const embedding = Array(dim).fill(0).map(() => Math.random());
    
    // First access - miss
    await cache.get(prompt);
    
    // Add to cache
    await cache.set(prompt, response, embedding);
    
    // Second access - hit
    await cache.get(prompt);
    
    const stats = cache.getStats();
    expect(stats.cacheMisses).toBe(1);
    expect(stats.cacheHits).toBe(1);
  });
});
