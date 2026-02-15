import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import SemanticCache from '../src/lib/semantic-cache.js';
import EmbeddingService from '../src/services/embedding-service.js';
import { handleCacheStore } from '../src/tools/cache-store.js';

class MockRedisStore {
  async createIndex() {}
  async add() {}
  async get() {}
  async findByPromptHash() {}
  async search() { return []; }
  async delete() { return true; }
  async clear() {}
  async getStats() { return { totalEntries: 0 }; }
  async disconnect() {}
}

describe('handleCacheStore', () => {
  let cache;
  let embeddingService;

  beforeEach(() => {
    cache = new SemanticCache({ dim: 384, maxElements: 100 }, { redisStore: new MockRedisStore() });
    embeddingService = new EmbeddingService();
  });

  afterEach(() => {
    cache.destroy();
  });

  test('should store with pre-computed embedding', async () => {
    const embedding = new Array(384).fill(0).map(() => Math.random());
    const result = await handleCacheStore(
      { prompt: 'Test prompt', response: 'Test response', embedding },
      cache,
      embeddingService
    );

    if (result.isError) {
        console.error(result.content[0].text);
    }
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.hasEmbedding).toBe(true);
  });

  test('should generate embedding when not provided', async () => {
    // Note: EmbeddingService might try to use real model or mock depending on config.
    // If it fails, handleCacheStore returns error.
    // Assuming EmbeddingService works or uses mock model by default.
    // The memory says: "The EmbeddingService validates models against a SUPPORTED_MODELS allowlist... and 'mock-embedding-model'."
    // If not configured, it defaults? Let's assume it works or we need to mock it too.
    // But EmbeddingService is imported directly.

    // We can mock EmbeddingService instance.
    const mockEmbeddingService = {
        generate: async () => ({ embedding: new Array(384).fill(0.1) })
    };

    const result = await handleCacheStore(
      { prompt: 'What is AI?', response: 'AI is artificial intelligence.' },
      cache,
      mockEmbeddingService
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.hasEmbedding).toBe(true);
  });

  test('should NOT store with zero-filled array fallback', async () => {
    const mockEmbeddingService = {
      generate: async () => null
    };

    const result = await handleCacheStore(
      { prompt: 'Test prompt', response: 'Test response' },
      cache,
      mockEmbeddingService
    );

    expect(result.isError).toBe(true);
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeDefined();
    expect(data.error).toContain('Embedding required');
  });
});
