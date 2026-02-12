import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Buffer } from 'buffer';

// Mock Redis methods
const mockRedisCall = mock(() => Promise.resolve([]));
const mockRedisHset = mock(() => Promise.resolve(1));
const mockRedisHgetall = mock(() => Promise.resolve({}));
const mockRedisDel = mock(() => Promise.resolve(1));
const mockRedisExpire = mock(() => Promise.resolve(1));
const mockPipelineExec = mock(() => Promise.resolve([]));
const mockPipelineHgetall = mock(() => {});
const mockRedisPipeline = mock(() => ({
  hgetall: mockPipelineHgetall,
  exec: mockPipelineExec
}));

// Mock ioredis module
mock.module('ioredis', () => {
  return {
    default: class Redis {
      constructor() {
        this.call = mockRedisCall;
        this.hset = mockRedisHset;
        this.hgetall = mockRedisHgetall;
        this.del = mockRedisDel;
        this.expire = mockRedisExpire;
        this.pipeline = mockRedisPipeline;
        this.disconnect = mock(() => {});
        this.on = mock(() => {});
      }
    }
  };
});

describe('RedisVectorStore', async () => {
  // Dynamic import to ensure mock is applied
  const { default: RedisVectorStore } = await import('../src/lib/redis-vector-store.js');

  let store;

  beforeEach(() => {
    store = new RedisVectorStore({
      redisUrl: 'redis://mock:6379',
      indexName: 'test_idx'
    });
    mockRedisCall.mockClear();
    mockRedisHset.mockClear();
    mockRedisHgetall.mockClear();
    mockRedisPipeline.mockClear();
    mockPipelineExec.mockClear();
    mockPipelineHgetall.mockClear();
  });

  it('should create index if not exists', async () => {
    // First call to FT.INFO throws error (simulating index not found)
    mockRedisCall.mockImplementationOnce(() => Promise.reject(new Error('Unknown Index')));
    // Second call to FT.CREATE resolves
    mockRedisCall.mockImplementationOnce(() => Promise.resolve('OK'));

    await store.createIndex();

    expect(mockRedisCall).toHaveBeenCalledTimes(2);
    expect(mockRedisCall.mock.calls[0][0]).toBe('FT.INFO');
    expect(mockRedisCall.mock.calls[1][0]).toBe('FT.CREATE');
    expect(mockRedisCall.mock.calls[1][1]).toBe('test_idx');
  });

  it('should add item with vector and metadata', async () => {
    const id = 'test-id';
    const vector = [0, 255, 128]; // Quantized vector
    const metadata = { prompt: 'hello' };

    await store.add(id, vector, metadata);

    expect(mockRedisHset).toHaveBeenCalledTimes(1);
    const args = mockRedisHset.mock.calls[0];
    // Check key
    expect(args[0]).toBe('ember:test-id');
    // Check data
    const storedData = args[1];
    expect(storedData.vector).toBeInstanceOf(Buffer);
    expect(storedData.prompt).toBe('hello');
  });

  it('should search and return results', async () => {
    const vector = [0, 255, 128];
    const k = 5;

    // Mock FT.SEARCH response
    // [count, key1, [field1, val1], ...]
    const mockResponse = [
      1,
      'ember:res1', ['distance', '0.1']
    ];
    mockRedisCall.mockResolvedValue(mockResponse);

    // Mock pipeline.hgetall and exec
    // The store calls pipeline.hgetall for each key found
    mockPipelineExec.mockResolvedValue([
      [null, { id: 'res1', prompt: 'result1' }] // hgetall result for res1
    ]);

    const results = await store.search(vector, k);

    // Verify FT.SEARCH call
    expect(mockRedisCall).toHaveBeenCalledTimes(1);
    const callArgs = mockRedisCall.mock.calls[0];
    expect(callArgs[0]).toBe('FT.SEARCH');
    expect(callArgs[1]).toBe('test_idx');
    // Check for KNN query part
    expect(callArgs[2]).toContain('KNN 5');
    // Check for blob param
    expect(callArgs[4]).toBe('2'); // PARAMS 2 ...
    expect(callArgs[6]).toBeInstanceOf(Buffer); // blob

    // Verify pipeline calls
    expect(mockRedisPipeline).toHaveBeenCalled();
    expect(mockPipelineHgetall).toHaveBeenCalledWith('ember:res1');
    expect(mockPipelineExec).toHaveBeenCalled();

    // Verify results
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('res1');
    expect(results[0].distance).toBe(0.1);
    expect(results[0].metadata.prompt).toBe('result1');
  });

  it('should get item by id', async () => {
    const id = 'test-id';
    mockRedisHgetall.mockResolvedValue({ prompt: 'found' });

    const result = await store.get(id);

    expect(mockRedisHgetall).toHaveBeenCalledWith('ember:test-id');
    expect(result.prompt).toBe('found');
  });
});
