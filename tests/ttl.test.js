import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

// Mock RedisVectorStore
// This needs to support TTL logic:
// 1. `set` should work (store data).
// 2. `expire` should work (mocked).
// 3. `get` should respect TTL (if we simulate it) or just return data.
// However, the test relies on `setTimeout` to wait for expiration.
// Since we are mocking the store, we need to simulate expiration ourselves in the mock
// based on the time passed or just rely on the fact that `SemanticCache` calls `expire`.

// Actually, `SemanticCache` relies on Redis to handle expiration.
// If we mock RedisVectorStore, we are responsible for implementing the expiration logic in the mock
// if we want the test to pass with `setTimeout`.

mock.module('../src/lib/redis-vector-store.js', () => {
  return {
    default: class MockRedisVectorStore {
      constructor() {
        this.data = new Map();
        this.expirations = new Map();
      }
      async createIndex() {}
      async add(id, vector, metadata) {
        this.data.set(id, { vector, metadata, createdAt: Date.now() });
      }
      async get(id) {
        this._checkExpiration(id);
        const item = this.data.get(id);
        return item ? item.metadata : null;
      }
      async search(vector, k) {
        // Mock search: return all valid items
        const results = [];
        for (const [id, item] of this.data.entries()) {
          this._checkExpiration(id);
          if (this.data.has(id)) {
             results.push({
                id: item.metadata.id,
                distance: 0.05,
                metadata: item.metadata
             });
          }
        }
        return results;
      }
      async delete(id) {
        return this.data.delete(id) ? 1 : 0;
      }
      async expire(id, seconds) {
        // Set expiration time
        const expiresAt = Date.now() + (seconds * 1000);
        this.expirations.set(id, expiresAt);
      }
      disconnect() {}

      _checkExpiration(id) {
        const expiresAt = this.expirations.get(id);
        if (expiresAt && Date.now() > expiresAt) {
          this.data.delete(id);
          this.expirations.delete(id);
        }
      }
    }
  };
});

const { default: SemanticCache } = await import('../src/lib/semantic-cache.js');

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
