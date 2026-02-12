import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

// Import Real SemanticCache which imports Real RedisVectorStore
// We will rely on dependency injection logic if we can access the internal store
// SemanticCache doesn't expose constructor options for redisClient directly?
// Wait, SemanticCache constructor does NOT take `redisClient`.
// It creates `this.store = new RedisVectorStore(...)`.
// So we cannot inject mock client into SemanticCache easily without refactoring SemanticCache.

// Refactor SemanticCache to accept redisClient option or store option.
// Let's modify SemanticCache first to accept `store` or `redisClient` option.

// BUT, I can just continue mocking `RedisVectorStore` in THIS file, but I need to make sure
// it doesn't affect other files.
// `mock.module` is global for the process in Bun?
// The docs say: "Mocks are scoped to the test file".
// However, if tests run in the same process, it might be tricky.
// The CI failure suggests interference.

// Let's go with the safest route: Refactor SemanticCache to allow injecting the store or client.
// Then I can pass the InMemoryRedisClient to SemanticCache -> RedisVectorStore.

// Step 1: Update SemanticCache to accept options.store or options.redisClient.
// Step 2: Update this test to use it.

// Wait, I cannot change SemanticCache constructor signature too much if it breaks existing code.
// It takes `options`. I can add `redisClient` to options.

const { default: SemanticCache } = await import('../src/lib/semantic-cache.js');

// We need to define the InMemoryRedisClient class here to pass it.
class InMemoryRedisClient {
  constructor() {
    this.data = new Map();
    this.expirations = new Map();
    this.on = () => {};
  }

  async call(cmd, ...args) {
    if (cmd === 'FT.INFO') throw new Error('Unknown Index');
    if (cmd === 'FT.CREATE') return 'OK';
    if (cmd === 'FT.SEARCH') {
        // Simple mock search returning everything
        // Format: [count, key1, [field1, val1, ...], ...]
        const results = [0];
        for (const [key, value] of this.data.entries()) {
            if (key.startsWith('ember:') && value.vector) {
                this._checkExpiration(key);
                if (this.data.has(key)) {
                    results[0]++;
                    results.push(key);
                    // Return distance and other fields if needed, but search logic in store parses it.
                    // Store expects: 'distance', val
                    results.push(['distance', '0.05']);
                }
            }
        }
        return results;
    }
    return null;
  }

  async hset(key, data) {
    this.data.set(key, { ...data, createdAt: Date.now() });
    return 1;
  }

  async hgetall(key) {
    this._checkExpiration(key);
    return this.data.get(key) || {};
  }

  async del(key) {
    return this.data.delete(key) ? 1 : 0;
  }

  async expire(key, seconds) {
    const expiresAt = Date.now() + (seconds * 1000);
    this.expirations.set(key, expiresAt);
    return 1;
  }

  pipeline() {
      // Mock pipeline for search metadata retrieval
      return {
          hgetall: (key) => {
              // We need to store this request and execute it later
              // For simplicity, we can just return a promise that resolves immediately?
              // No, pipeline.exec returns an array of results.
              this._pendingKeys = this._pendingKeys || [];
              this._pendingKeys.push(key);
          },
          exec: async () => {
              const results = [];
              if (this._pendingKeys) {
                  for (const key of this._pendingKeys) {
                      const data = await this.hgetall(key);
                      // Pipeline result format: [error, result]
                      results.push([null, data]);
                  }
                  this._pendingKeys = [];
              }
              return results;
          }
      }
  }

  disconnect() {}

  _checkExpiration(key) {
    const expiresAt = this.expirations.get(key);
    if (expiresAt && Date.now() > expiresAt) {
      this.data.delete(key);
      this.expirations.delete(key);
    }
  }
}

describe('TTL Functionality', () => {
  let cache;
  const dim = 128;

  beforeEach(() => {
    // We need to inject the mock client.
    // SemanticCache constructor: constructor(options = {})
    // It creates: this.store = new RedisVectorStore({ dim, ... });
    // It does NOT pass extra options to RedisVectorStore currently.
    // I need to update SemanticCache to pass options to RedisVectorStore.

    // Assuming I updated SemanticCache (I will in the next step),
    // I can pass redisClient here.
    const mockClient = new InMemoryRedisClient();

    cache = new SemanticCache({
      dim,
      maxElements: 1000,
      similarityThreshold: 0.85,
      defaultTTL: 1, // 1 second default
      redisClient: mockClient // Inject mock client
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
    expect(expired).toBeNull();
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
    expect(expired).toBeNull();
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
