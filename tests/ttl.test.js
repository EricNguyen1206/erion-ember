import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import SemanticCache from '../src/lib/semantic-cache.js';

class MockRedisStore {
  constructor() {
    this.data = new Map();
    this.index = [];
    this.expirations = new Map();
  }
  async createIndex(dim) {}
  async add(id, vector, metadata) {
    this.data.set(id, metadata);
    this.index.push({ id, vector });
    if (metadata.expiresAt) {
      this.expirations.set(id, metadata.expiresAt);
    }
  }
  async get(id) {
    if (this.expirations.has(id)) {
        if (Date.now() > this.expirations.get(id)) {
            this.data.delete(id);
            this.expirations.delete(id);
            // remove from index? lazy removal is fine for get(id) return null
            return null;
        }
    }
    return this.data.get(id) || null;
  }
  async findByPromptHash(hash) {
    // hash is ID in SemanticCache implementation now
    return this.get(hash);
  }
  async search(vector, k) {
    // Return all items that are not expired
    // Filter expired
    const validItems = [];
    for (const item of this.index) {
        if (this.expirations.has(item.id)) {
             if (Date.now() > this.expirations.get(item.id)) {
                 continue;
             }
        }
        validItems.push({ id: item.id, distance: 0.1 });
    }
    return validItems.slice(0, k);
  }
  async delete(id) {
    this.expirations.delete(id);
    return this.data.delete(id);
  }
  async clear() {
    this.data.clear();
    this.index = [];
    this.expirations.clear();
  }
  async getStats() { return { totalEntries: this.data.size }; }
  async disconnect() {}
}

describe('TTL Functionality', () => {
  let cache;
  const dim = 128;

  beforeEach(() => {
    cache = new SemanticCache({
      dim,
      maxElements: 1000,
      similarityThreshold: 0.85,
      defaultTTL: 1 // 1 second default
    }, {
      redisStore: new MockRedisStore()
    });
  });

  afterEach(async () => {
    await cache.destroy();
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
