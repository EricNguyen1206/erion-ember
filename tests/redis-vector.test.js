import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import RedisMock from "ioredis-mock";

// Mock ioredis module
mock.module("ioredis", () => {
  return {
    default: RedisMock
  };
});

// Import the class after mocking
const { RedisVectorStore } = await import("../src/lib/redis-vector-store.ts");

describe('RedisVectorStore', () => {
  let store;

  beforeEach(() => {
    store = new RedisVectorStore();

    // Access the private client
    const client = store['client'];

    // Patch call method for FT commands
    // ioredis-mock doesn't support call/callBuffer natively for custom commands well
    client.call = async (command, ...args) => {
      const cmd = command.toUpperCase();

      if (cmd === 'FT.INFO') {
        throw new Error('Unknown Index name');
      }

      if (cmd === 'FT.CREATE') {
        return 'OK';
      }

      if (cmd === 'FT.SEARCH') {
        // Return mock empty result by default
        return [0];
      }

      if (cmd === 'FT.DROPINDEX') {
        return 'OK';
      }

      // Fallback to internal implementation if possible, or ignore
      return 'OK';
    };

    // Patch callBuffer for HGETALL to return Buffers
    client.callBuffer = async (command, ...args) => {
      if (command.toUpperCase() === 'HGETALL') {
        const key = args[0];
        // Use the mock's hgetall which returns { field: value_string }
        const data = await client.hgetall(key);
        const result = [];
        if (data) {
          for (const k of Object.keys(data)) {
            result.push(Buffer.from(k));
            result.push(Buffer.from(data[k]));
          }
        }
        return result;
      }
      return [];
    };
  });

  afterEach(async () => {
    await store.disconnect();
  });

  test('createIndex should send FT.CREATE command', async () => {
    let commandSent = false;
    const client = store['client'];
    const originalCall = client.call;
    client.call = async (cmd, ...args) => {
      if (cmd === 'FT.CREATE') commandSent = true;
      return originalCall(cmd, ...args);
    };

    await store.createIndex(128);
    expect(commandSent).toBe(true);
  });

  test('add should store vector and metadata', async () => {
    const id = 'test-id';
    const vector = new Array(128).fill(0.5);
    const metadata = {
      id,
      vectorId: 0,
      promptHash: 'hash123',
      normalizedPrompt: 'test prompt',
      originalPromptSize: 10,
      originalResponseSize: 20,
      compressedPromptSize: 5,
      compressedResponseSize: 10,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      compressedPrompt: Buffer.from('compressed prompt'),
      compressedResponse: Buffer.from('compressed response')
    };

    await store.add(id, vector, metadata);

    // Verify data in mock
    const key = `ember:${id}`;
    const stored = await store['client'].hgetall(key);
    expect(stored).toBeDefined();
    expect(stored.id).toBe(id);
    expect(stored.promptHash).toBe('hash123');
    // ioredis-mock stores buffers as strings usually?
    // We can verify get() method

    const retrieved = await store.get(id);
    expect(retrieved).not.toBeNull();
    expect(retrieved.id).toBe(id);
    expect(retrieved.compressedPrompt.toString()).toBe('compressed prompt');
  });

  test('search should return results', async () => {
    // Mock search result
    const client = store['client'];
    client.call = async (cmd, ...args) => {
      if (cmd === 'FT.SEARCH') {
        // [count, key, [field, val, field, val]]
        return [1, 'ember:res1', ['id', 'res1', 'distance', '0.1']];
      }
      return 'OK';
    };

    const results = await store.search(new Array(128).fill(0), 5);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('res1');
    expect(results[0].distance).toBe(0.1);
  });

  test('findByPromptHash should find exact match', async () => {
      const id = 'hash123';
      const metadata = {
          id,
          vectorId: 0,
          promptHash: 'hash123',
          normalizedPrompt: 'test prompt',
          originalPromptSize: 10,
          originalResponseSize: 20,
          compressedPromptSize: 5,
          compressedResponseSize: 10,
          createdAt: Date.now(),
          lastAccessed: Date.now(),
          accessCount: 1,
          compressedPrompt: Buffer.from('cp'),
          compressedResponse: Buffer.from('cr')
      };

      // Add data
      await store.add(id, [], metadata);

      // Mock findByPromptHash search query
      const client = store['client'];
      const originalCall = client.call;
      client.call = async (cmd, ...args) => {
          if (cmd === 'FT.SEARCH') {
               // Check if query contains promptHash
               if (args[1].includes('@promptHash:{hash123}')) {
                   return [1, 'ember:hash123'];
               }
               return [0];
          }
          return originalCall(cmd, ...args);
      };

      const res = await store.findByPromptHash('hash123');
      expect(res).not.toBeNull();
      expect(res.id).toBe('hash123');
  });
});
