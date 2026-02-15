import Redis from 'ioredis';
import { CacheMetadata, SearchResult } from '../types/index.js';

export interface RedisVectorStoreConfig {
  redisUrl?: string;
  indexName?: string;
  distanceMetric?: 'COSINE' | 'L2' | 'IP';
}

export class RedisVectorStore {
  private client: Redis;
  private indexName: string;
  private distanceMetric: string;

  constructor(config: RedisVectorStoreConfig = {}) {
    const redisUrl = config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    const redisOptions = {
      retryStrategy: (times: number) => {
        // Stop retrying immediately in test environment
        if (process.env.NODE_ENV === 'test') {
          return null;
        }
        return Math.min(times * 50, 2000);
      }
    };

    this.client = new Redis(redisUrl, redisOptions);
    this.indexName = config.indexName || process.env.VECTOR_INDEX_NAME || 'idx:erion_ember';
    this.distanceMetric = config.distanceMetric || process.env.DISTANCE_METRIC || 'COSINE';

    this.client.on('error', (err) => {
      // Log error but don't crash
      console.error('Redis connection error:', err);
    });
  }

  async createIndex(dim: number): Promise<void> {
    try {
      await this.client.call('FT.INFO', this.indexName);
    } catch (e) {
      console.log(`Creating Redis Vector Index: ${this.indexName}`);
      await this.client.call(
        'FT.CREATE',
        this.indexName,
        'ON',
        'HASH',
        'PREFIX',
        '1',
        'ember:',
        'SCHEMA',
        'vector',
        'VECTOR',
        'HNSW',
        '6',
        'TYPE',
        'FLOAT32',
        'DIM',
        dim.toString(),
        'DISTANCE_METRIC',
        this.distanceMetric,
        'promptHash',
        'TAG',
        'createdAt',
        'NUMERIC',
        'SORTABLE'
      );
    }
  }

  async add(id: string, vector: number[], metadata: CacheMetadata): Promise<void> {
    const key = `ember:${id}`;
    const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);

    // Flatten metadata for HSET
    // Ensure all values are string, number, or Buffer
    const fields: (string | Buffer | number)[] = [
      'vector', vectorBuffer,
      'id', metadata.id,
      'vectorId', metadata.vectorId,
      'promptHash', metadata.promptHash,
      'normalizedPrompt', metadata.normalizedPrompt,
      'originalPromptSize', metadata.originalPromptSize,
      'originalResponseSize', metadata.originalResponseSize,
      'compressedPromptSize', metadata.compressedPromptSize,
      'compressedResponseSize', metadata.compressedResponseSize,
      'createdAt', metadata.createdAt,
      'lastAccessed', metadata.lastAccessed,
      'accessCount', metadata.accessCount,
      'compressedPrompt', metadata.compressedPrompt,
      'compressedResponse', metadata.compressedResponse
    ];

    if (metadata.expiresAt) {
      fields.push('expiresAt', metadata.expiresAt);
    }

    await this.client.hset(key, ...fields);

    if (metadata.expiresAt) {
      const ttl = Math.ceil((metadata.expiresAt - Date.now()) / 1000);
      if (ttl > 0) {
        await this.client.expire(key, ttl);
      }
    }
  }

  async search(vector: number[], k: number): Promise<SearchResult[]> {
    const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);
    // KNN query syntax
    const query = `*=>[KNN ${k} @vector $BLOB AS distance]`;

    try {
      const res = await this.client.call(
        'FT.SEARCH',
        this.indexName,
        query,
        'PARAMS',
        '2',
        'BLOB',
        vectorBuffer,
        'SORTBY',
        'distance',
        'ASC',
        'DIALECT',
        '2',
        'RETURN',
        '2',
        'id',
        'distance'
      ) as any[];

      // res format: [count, result1_key, [field, val, ...], result2_key, ...]
      // Note: First element is total count.
      const results: SearchResult[] = [];

      for (let i = 1; i < res.length; i += 2) {
        // const key = res[i];
        const fields = res[i+1] as any[];

        let id = '';
        let distance = 0;

        for (let j = 0; j < fields.length; j += 2) {
          const fieldName = fields[j];
          const fieldValue = fields[j+1];
          if (fieldName === 'id') id = fieldValue;
          else if (fieldName === 'distance') distance = parseFloat(fieldValue);
        }

        if (!id) {
          // Fallback to extracting from key
          const key = res[i] as string;
          id = key.replace('ember:', '');
        }

        results.push({ id, distance });
      }

      return results;
    } catch (e) {
      console.error('Redis search error:', e);
      return [];
    }
  }

  async findByPromptHash(hash: string): Promise<CacheMetadata | null> {
    // Escape special chars in tag query if necessary
    const query = `@promptHash:{${hash.replace(/[-]/g, '\\-')}}`;

    try {
      const res = await this.client.call(
        'FT.SEARCH',
        this.indexName,
        query,
        'LIMIT',
        '0',
        '1',
        'DIALECT',
        '2'
      ) as any[];

      if (!res || res[0] === 0) return null;

      const key = res[1] as string;
      const id = key.replace('ember:', '');
      return this.get(id);
    } catch (e) {
      return null;
    }
  }

  async get(id: string): Promise<CacheMetadata | null> {
    const key = `ember:${id}`;
    // Use callBuffer to retrieve raw binary data
    const result = await this.client.callBuffer('HGETALL', key) as Buffer[];

    if (!result || result.length === 0) return null;

    const data: Record<string, Buffer> = {};
    for (let i = 0; i < result.length; i += 2) {
      data[result[i].toString()] = result[i+1];
    }

    const toStr = (k: string) => data[k] ? data[k].toString('utf8') : undefined;
    const toNum = (k: string) => data[k] ? parseInt(data[k].toString('utf8'), 10) : 0;

    if (!toStr('id')) return null;

    return {
      id: toStr('id')!,
      vectorId: toNum('vectorId'),
      promptHash: toStr('promptHash')!,
      normalizedPrompt: toStr('normalizedPrompt')!,
      originalPromptSize: toNum('originalPromptSize'),
      originalResponseSize: toNum('originalResponseSize'),
      compressedPromptSize: toNum('compressedPromptSize'),
      compressedResponseSize: toNum('compressedResponseSize'),
      createdAt: toNum('createdAt'),
      lastAccessed: toNum('lastAccessed'),
      accessCount: toNum('accessCount'),
      compressedPrompt: data['compressedPrompt'],
      compressedResponse: data['compressedResponse'],
      expiresAt: data['expiresAt'] ? toNum('expiresAt') : undefined
    };
  }

  async delete(id: string): Promise<boolean> {
    const key = `ember:${id}`;
    const res = await this.client.del(key);
    return res > 0;
  }

  async clear(): Promise<void> {
    try {
      // Drop index and data
      await this.client.call('FT.DROPINDEX', this.indexName, 'DD');
    } catch (e) {
      // Ignore
    }
  }

  async getStats(): Promise<{ totalEntries: number }> {
    try {
      const info = await this.client.call('FT.INFO', this.indexName) as any[];
      let numDocs = 0;
      // info array: [field, value, field, value...]
      for (let i = 0; i < info.length; i += 2) {
        if (info[i] === 'num_docs') {
          numDocs = parseInt(info[i+1]);
          break;
        }
      }
      return { totalEntries: numDocs };
    } catch (e) {
      return { totalEntries: 0 };
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}
