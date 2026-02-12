import Redis from 'ioredis';

/**
 * Redis Vector Store - Distributed vector storage and retrieval
 * Uses Redis Stack (RediSearch + RedisJSON)
 */
class RedisVectorStore {
  constructor(options = {}) {
    this.redisUrl = options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    this.indexName = options.indexName || process.env.VECTOR_INDEX_NAME || 'idx:erion_ember';
    this.distanceMetric = options.distanceMetric || process.env.DISTANCE_METRIC || 'COSINE';
    this.dim = options.dim || 1536;
    this.prefix = 'ember:';

    // Initialize Redis client
    this.redis = new Redis(this.redisUrl);

    // Handle connection errors
    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }

  /**
   * Initialize Redis index
   */
  async createIndex() {
    try {
      await this.redis.call('FT.INFO', this.indexName);
    } catch (e) {
      if (e.message && e.message.includes('Unknown Index')) {
        console.log(`Creating Redis index: ${this.indexName}`);
        await this.redis.call(
          'FT.CREATE',
          this.indexName,
          'ON', 'HASH',
          'PREFIX', '1', this.prefix,
          'SCHEMA',
          'vector', 'VECTOR', 'HNSW', '6',
            'TYPE', 'FLOAT32',
            'DIM', this.dim,
            'DISTANCE_METRIC', this.distanceMetric
        );
      } else {
        throw e;
      }
    }
  }

  /**
   * Add item to store
   * @param {string} id - Unique ID (e.g., promptHash)
   * @param {number[]} vector - Quantized vector (int array)
   * @param {object} metadata - Metadata object
   */
  async add(id, vector, metadata) {
    const key = `${this.prefix}${id}`;

    // Convert int8 quantized vector to Float32 buffer
    // We treat the quantized integers (0-255) as floats for Redis HNSW
    const float32 = new Float32Array(vector);
    const vectorBuffer = Buffer.from(float32.buffer);

    // Prepare metadata for Redis
    const redisData = { ...metadata };

    // Convert buffers to base64 strings for storage
    if (Buffer.isBuffer(redisData.compressedPrompt)) {
      redisData.compressedPrompt = redisData.compressedPrompt.toString('base64');
    }
    if (Buffer.isBuffer(redisData.compressedResponse)) {
      redisData.compressedResponse = redisData.compressedResponse.toString('base64');
    }

    // Store vector as blob
    redisData.vector = vectorBuffer;

    // Use HSET to store hash
    await this.redis.hset(key, redisData);

    // Set TTL if provided in metadata (though not explicitly passed in add args, usually SemanticCache handles this)
    // SemanticCache passes `options` to `set` but `add` receives `metadata`.
    // We can add a ttl parameter or extract from metadata if available.
    // For now, we follow the interface. If TTL is needed, we should support it.
    // SemanticCache uses `options.ttl`. We should probably update SemanticCache to pass TTL to add.
  }

  /**
   * Search for similar vectors
   * @param {number[]} vector - Query vector (quantized)
   * @param {number} k - Number of results
   * @returns {Promise<Array>} Search results
   */
  async search(vector, k = 5) {
    const float32 = new Float32Array(vector);
    const vectorBuffer = Buffer.from(float32.buffer);

    try {
      // FT.SEARCH index "*=>[KNN k @vector $blob]" PARAMS 2 blob buffer RETURN 1 distance SORTBY distance ASC DIALECT 2
      const response = await this.redis.call(
        'FT.SEARCH',
        this.indexName,
        `*=>[KNN ${k} @vector $blob]`,
        'PARAMS', '2', 'blob', vectorBuffer,
        'RETURN', '1', 'distance',
        'SORTBY', 'distance', 'ASC',
        'DIALECT', '2'
      );

      // Response format: [total_count, key1, [field1, val1], key2, [field2, val2], ...]
      const count = response[0];
      const results = [];

      // Fetch full metadata for found keys
      const pipeline = this.redis.pipeline();

      for (let i = 1; i < response.length; i += 2) {
        const key = response[i];
        const fields = response[i + 1]; // ['distance', '0.123']

        let distance = 0;
        for (let j = 0; j < fields.length; j += 2) {
          if (fields[j] === 'distance') {
            distance = parseFloat(fields[j+1]);
          }
        }

        results.push({ id: key, distance });
        pipeline.hgetall(key);
      }

      if (results.length === 0) {
        return [];
      }

      const metadataList = await pipeline.exec();

      return results.map((result, index) => {
        const [err, data] = metadataList[index];
        if (err || !data) return null;

        // Restore types
        const metadata = this._restoreMetadata(data);
        // Ensure ID matches (remove prefix)
        metadata.id = result.id.replace(this.prefix, '');

        return {
          id: metadata.id,
          distance: result.distance,
          metadata
        };
      }).filter(item => item !== null);

    } catch (e) {
      console.error('Redis search error:', e);
      return [];
    }
  }

  /**
   * Get item by ID (Exact Match)
   * @param {string} id
   */
  async get(id) {
    const key = `${this.prefix}${id}`;
    const data = await this.redis.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return this._restoreMetadata(data);
  }

  /**
   * Delete item by ID
   * @param {string} id
   */
  async delete(id) {
    const key = `${this.prefix}${id}`;
    return await this.redis.del(key);
  }

  /**
   * Set TTL for an item
   * @param {string} id
   * @param {number} seconds
   */
  async expire(id, seconds) {
    const key = `${this.prefix}${id}`;
    return await this.redis.expire(key, seconds);
  }

  /**
   * Restore metadata types from Redis strings
   * @private
   */
  _restoreMetadata(data) {
    const metadata = { ...data };

    // Numeric fields
    ['createdAt', 'lastAccessed', 'accessCount', 'originalPromptSize', 'originalResponseSize', 'compressedPromptSize', 'compressedResponseSize', 'vectorId'].forEach(field => {
      if (metadata[field]) metadata[field] = Number(metadata[field]);
    });

    // Restore Buffers
    if (metadata.compressedPrompt) {
      metadata.compressedPrompt = Buffer.from(metadata.compressedPrompt, 'base64');
    }
    if (metadata.compressedResponse) {
      metadata.compressedResponse = Buffer.from(metadata.compressedResponse, 'base64');
    }

    // Remove internal vector field from metadata object if present
    delete metadata.vector;

    return metadata;
  }

  /**
   * Close connection
   */
  disconnect() {
    this.redis.disconnect();
  }
}

export default RedisVectorStore;
