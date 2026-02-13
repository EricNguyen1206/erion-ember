import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { RedisVectorStore } from '../src/lib/redis-vector-store.js';

describe('RedisVectorStore', () => {
  let store: RedisVectorStore;

  beforeEach(() => {
    // NODE_ENV=test should be set by bun test
    store = new RedisVectorStore({
        indexName: 'test_idx',
        distanceMetric: 'COSINE'
    });
  });

  afterEach(async () => {
    const client = (store as any).client;
    if (client) {
        await client.flushall();
    }
  });

  test('should connect and create index', async () => {
    await store.connect();
    // Verification relies on mock not throwing
    await store.createIndex(128);
    expect(true).toBe(true);
  });

  test('should add and get item', async () => {
    await store.connect();
    const id = '123';
    const vector = Array(128).fill(0.1);
    const metadata = {
        id,
        vectorId: 1,
        promptHash: 'hash123',
        normalizedPrompt: 'prompt',
        compressedPrompt: Buffer.from('compressed'),
        compressedResponse: Buffer.from('response'),
        originalPromptSize: 10,
        originalResponseSize: 10,
        compressedPromptSize: 10,
        compressedResponseSize: 10,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0
    };

    await store.add(id, vector, metadata);

    const retrieved = await store.get(id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(id);
    expect(retrieved?.promptHash).toBe('hash123');
    // Buffer comparison
    expect(retrieved?.compressedPrompt.toString()).toBe('compressed');
  });

  test('should find by prompt hash', async () => {
      await store.connect();
      const client = (store as any).client;

      // Override call for this test to simulate FT.SEARCH return
      const originalCall = client.call;
      client.call = async (cmd: string, ...args: any[]) => {
          if (cmd === 'FT.SEARCH' && args[1].includes('@promptHash')) {
               // Return a match. Format: [count, result1]
               // result1: [key, [fields]] (DIALECT 2 without scores)
               const metadata = {
                    id: '123',
                    compressedPrompt: Buffer.from('prompt').toString('base64'),
                    compressedResponse: Buffer.from('response').toString('base64'),
                    createdAt: Date.now()
               };
               return [1, ['ember:123', ['metadata', JSON.stringify(metadata)]]];
          }
          return [0];
      };

      const result = await store.findByPromptHash('somehash');
      // restore call
      client.call = originalCall;

      expect(result).not.toBeNull();
      expect(result?.id).toBe('123');
  });

  test('should search vectors', async () => {
      await store.connect();
      const client = (store as any).client;

      // Override call for search
      const originalCall = client.call;
      client.call = async (cmd: string, ...args: any[]) => {
          if (cmd === 'FT.SEARCH' && args[1].includes('KNN')) {
               // Return [count, result1]
               // result1: [key, score, [fields]] (DIALECT 2 with scores)
               return [1, ['ember:1', '0.1', ['id', '1']]];
          }
          return [0];
      };

      const results = await store.search(Array(128).fill(0), 1);
      // restore call
      client.call = originalCall;

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(1);
      expect(results[0].distance).toBe(0.1);
  });

  test('should set TTL if expiresAt provided', async () => {
    await store.connect();
    const client = (store as any).client;
    // Spy on expire
    let expiredKey: string | null = null;
    let expiredTtl: number | null = null;

    // Override expire
    client.expire = async (key: string, ttl: number) => {
        expiredKey = key;
        expiredTtl = ttl;
    };

    const id = 'expire1';
    const metadata = {
        id,
        vectorId: 1,
        promptHash: 'hash',
        normalizedPrompt: 'prompt',
        compressedPrompt: Buffer.from('compressed'),
        compressedResponse: Buffer.from('response'),
        originalPromptSize: 10,
        originalResponseSize: 10,
        compressedPromptSize: 10,
        compressedResponseSize: 10,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        expiresAt: Date.now() + 10000 // 10s
    };

    await store.add(id, Array(128).fill(0), metadata);

    expect(expiredKey).toBe('ember:expire1');
    expect(expiredTtl).toBeGreaterThan(0);
    expect(expiredTtl).toBeLessThanOrEqual(10);
  });
});
