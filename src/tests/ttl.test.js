import SemanticCache from '../lib/semantic-cache.js';

describe('TTL Functionality', () => {
  let cache;
  const dim = 128;

  beforeEach(() => {
    cache = new SemanticCache({
      dim,
      maxElements: 1000,
      similarityThreshold: 0.85,
      defaultTTL: 1 // 1 second default
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('should expire exact match after TTL', async () => {
    const prompt = 'Exact match expiry test';
    const response = 'Response';
    const embedding = Array(dim).fill(0).map(() => Math.random());
    const ttl = 0.5; // 0.5 seconds

    await cache.set(prompt, response, embedding, { ttl });

    // Immediate check
    const immediate = await cache.get(prompt);
    expect(immediate).not.toBeNull();
    expect(immediate.response).toBe(response);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 600));

    // Check after expiry
    const expired = await cache.get(prompt);
    expect(expired).toBeNull(); // Should return null because it's expired
  });

  test('should expire semantic match after TTL', async () => {
    const prompt = 'Semantic match expiry test';
    const response = 'Response';
    const embedding = Array(dim).fill(0).map(() => Math.random());
    const ttl = 0.5; // 0.5 seconds

    await cache.set(prompt, response, embedding, { ttl });

    // Immediate check with semantic search
    const immediate = await cache.get(prompt, embedding);
    expect(immediate).not.toBeNull();
    expect(immediate.response).toBe(response);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 600));

    // Check after expiry
    const expired = await cache.get(prompt, embedding);
    expect(expired).toBeNull(); // Should return null because it's expired
  });

  test('should use default TTL if not specified', async () => {
    const prompt = 'Default TTL test';
    const response = 'Response';
    const embedding = Array(dim).fill(0).map(() => Math.random());

    // Default TTL is 1 second (set in beforeEach)
    await cache.set(prompt, response, embedding);

    // Immediate check
    const immediate = await cache.get(prompt);
    expect(immediate).not.toBeNull();

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Check after expiry
    const expired = await cache.get(prompt);
    expect(expired).toBeNull();
  });
});
