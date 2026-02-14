import Redis from 'ioredis';
import { CacheMetadata, SearchResult } from '../types/index.js';

interface RedisVectorStoreConfig {
  url?: string;
  indexName?: string;
  distanceMetric?: 'COSINE' | 'L2' | 'IP';
  dim?: number;
}

export class RedisVectorStore {
  private redis: Redis;
  private indexName: string;
  private distanceMetric: string;
  private dim: number;

  constructor(config: RedisVectorStoreConfig = {}) {
    this.redis = new Redis(config.url || process.env.REDIS_URL || 'redis://localhost:6379');
    this.indexName = config.indexName || process.env.VECTOR_INDEX_NAME || 'idx:erion_ember';
    this.distanceMetric = config.distanceMetric || process.env.DISTANCE_METRIC || 'COSINE';
    this.dim = config.dim || 1536;
  }

  async createIndex(): Promise<void> {
    try {
      await this.redis.call('FT.INFO', this.indexName);
    } catch (e) {
      // Index does not exist, create it
      // Standard HNSW parameters can be tuned: M=16, EF_CONSTRUCTION=200
      await this.redis.call(
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
        this.dim,
        'DISTANCE_METRIC',
        this.distanceMetric,
        'promptHash',
        'TAG'
      );
    }
  }

  async add(id: string, vector: number[], metadata: CacheMetadata): Promise<void> {
    const key = `ember:${id}`;
    const vectorBlob = Buffer.from(new Float32Array(vector).buffer);

    // Prepare metadata for storage (encode Buffers to base64)
    const serializableMetadata = {
        ...metadata,
        compressedPrompt: metadata.compressedPrompt.toString('base64'),
        compressedResponse: metadata.compressedResponse.toString('base64'),
        // Ensure expiresAt is handled if present
        expiresAt: metadata.expiresAt
    };

    // Use HSET to store vector, hash for exact match, and full metadata blob
    await this.redis.hset(key, {
        vector: vectorBlob,
        promptHash: metadata.promptHash,
        metadata: JSON.stringify(serializableMetadata)
    });

    // Handle TTL if expiresAt is set
    if (metadata.expiresAt) {
        const ttl = Math.ceil((metadata.expiresAt - Date.now()) / 1000);
        if (ttl > 0) {
            await this.redis.expire(key, ttl);
        }
    }
  }

  async search(vector: number[], topK: number): Promise<(SearchResult & { metadata: CacheMetadata })[]> {
    const vectorBlob = Buffer.from(new Float32Array(vector).buffer);
    const k = topK;

    try {
        const res = await this.redis.call(
            'FT.SEARCH',
            this.indexName,
            `*=>[KNN ${k} @vector $blob AS score]`,
            'PARAMS',
            '2',
            'blob',
            vectorBlob,
            'SORTBY',
            'score',
            'ASC',
            'DIALECT',
            '2'
        ) as any[];

        const results: (SearchResult & { metadata: CacheMetadata })[] = [];
        // res[0] is count
        for (let i = 1; i < res.length; i += 2) {
            const key = res[i];
            const fields = res[i+1];
            const fieldMap: any = {};
            for (let j = 0; j < fields.length; j += 2) {
                fieldMap[fields[j]] = fields[j+1];
            }

            const score = parseFloat(fieldMap.score);
            if (fieldMap.metadata) {
                const metadata = this.parseMetadata(fieldMap.metadata);
                results.push({
                    id: key.replace('ember:', ''), // Remove prefix implies ID is stored without prefix in metadata.id
                    distance: score,
                    metadata
                });
            }
        }
        return results;
    } catch (e) {
        console.error('Search error:', e);
        return [];
    }
  }

  async findByPromptHash(hash: string): Promise<CacheMetadata | null> {
      try {
        const query = `@promptHash:{${hash}}`;
        const res = await this.redis.call(
            'FT.SEARCH',
            this.indexName,
            query,
            'LIMIT',
            '0',
            '1',
            'DIALECT',
            '2'
        ) as any[];

        if (res[0] === 0) return null;

        const fields = res[2];
        const fieldMap: any = {};
        for (let j = 0; j < fields.length; j += 2) {
            fieldMap[fields[j]] = fields[j+1];
        }

        if (fieldMap.metadata) {
            return this.parseMetadata(fieldMap.metadata);
        }
        return null;
      } catch (e) {
          console.error('FindByPromptHash error:', e);
          return null;
      }
  }

  private parseMetadata(jsonStr: string): CacheMetadata {
      const parsed = JSON.parse(jsonStr);
      return {
          ...parsed,
          compressedPrompt: Buffer.from(parsed.compressedPrompt, 'base64'),
          compressedResponse: Buffer.from(parsed.compressedResponse, 'base64')
      };
  }

  async getStats(): Promise<any> {
     try {
         const info = await this.redis.call('FT.INFO', this.indexName) as any[];
         // Parse info array if needed, but returning raw is often enough or mapped
         const stats: any = {};
         for(let i=0; i<info.length; i+=2) {
             stats[info[i]] = info[i+1];
         }
         return stats;
     } catch(e) {
         return {};
     }
  }

  async clear(): Promise<void> {
      try {
        await this.redis.call('FT.DROPINDEX', this.indexName, 'DD');
      } catch (e) {
          // ignore if index doesn't exist
      }
      await this.createIndex();
  }

  async delete(id: string): Promise<boolean> {
      const key = `ember:${id}`;
      const res = await this.redis.del(key);
      return res > 0;
  }

  disconnect() {
      this.redis.disconnect();
  }
}

export default RedisVectorStore;
