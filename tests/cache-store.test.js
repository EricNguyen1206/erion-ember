import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import SemanticCache from '../src/lib/semantic-cache.js';
import EmbeddingService from '../src/services/embedding-service.js';
import { handleCacheStore } from '../src/tools/cache-store.js';

describe('handleCacheStore', () => {
  let cache;
  let embeddingService;

  beforeEach(() => {
    cache = new SemanticCache({ dim: 384, maxElements: 100 });
    embeddingService = new EmbeddingService();
  });

  afterEach(() => {
    cache.destroy();
  });

  test('should store with pre-computed embedding', async () => {
    const embedding = Array(384).fill(0).map(() => Math.random());
    const result = await handleCacheStore(
      { prompt: 'Test prompt', response: 'Test response', embedding },
      cache,
      embeddingService
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.hasEmbedding).toBe(true);
  });

  test('should generate embedding when not provided', async () => {
    const result = await handleCacheStore(
      { prompt: 'What is AI?', response: 'AI is artificial intelligence.' },
      cache,
      embeddingService
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