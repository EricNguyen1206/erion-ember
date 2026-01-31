# Semantic LLM Cache Design Document

**Date:** 2026-01-31  
**Author:** AI Assistant  
**Status:** Draft  
**Approach:** Option 1 - In-Memory HNSW + Compressed Cache  
**Library:** hnswlib-node (C++ bindings)

---

## 1. Executive Summary

Xây dựng semantic cache cho LLM queries sử dụng HNSW (Hierarchical Navigable Small World) index để tìm kiếm vector tương đồng với hiệu suất cao. Hệ thống cache cả vector embeddings và LLM responses, sử dụng compression để tối ưu memory usage.

**Key Metrics Target:**
- Query latency: < 10ms (P95)
- Memory reduction: 60-70% so với Redis thuần
- Cache hit rate: > 80% cho repeated queries
- Support: Up to 100K vectors trong RAM

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (LLM Application)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Parser     │  │   Router     │  │   Monitor    │      │
│  │ (Normalize)  │  │ (Cache/LLM)  │  │ (Metrics)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
│         │                 │                                 │
│         ▼                 ▼                                 │
│  ┌──────────────────────────────────────────────┐          │
│  │         Semantic Cache Core                   │          │
│  │  ┌──────────────┐      ┌──────────────┐      │          │
│  │  │   HNSW Index │      │   Metadata   │      │          │
│  │  │   (C++)      │◄────►│   Store      │      │          │
│  │  │              │      │   (Node.js)  │      │          │
│  │  └──────────────┘      └──────┬───────┘      │          │
│  │                               │              │          │
│  │         ┌─────────────────────┘              │          │
│  │         ▼                                    │          │
│  │  ┌──────────────┐      ┌──────────────┐      │          │
│  │  │  Compressed  │      │  Compressed  │      │          │
│  │  │   Vectors    │      │  Responses   │      │          │
│  │  │ (Quantized)  │      │   (LZ4)      │      │          │
│  │  └──────────────┘      └──────────────┘      │          │
│  └──────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Core Components

### 3.1 HNSW Index Layer (hnswlib-node)

**Library:** [hnswlib-node](https://github.com/yahoojapan/hnswlib-node) - Node.js bindings cho hnswlib C++

**Configuration:**
```javascript
{
  space: "cosine",        // Cosine similarity cho text embeddings
  dim: 1536,              // OpenAI text-embedding-ada-002
  maxElements: 100000,    // Max vectors
  M: 16,                  // Connections per layer (trade-off: accuracy vs memory)
  efConstruction: 200,    // Build time accuracy
  ef: 100,                // Search time accuracy
  randomSeed: 100
}
```

**Memory Calculation:**
- Raw float32 vector: 1536 × 4 bytes = 6,144 bytes
- HNSW overhead: ~20-30%
- Total per vector: ~7,500-8,000 bytes
- 100K vectors: ~750-800 MB (raw)

### 3.2 Vector Quantization

**Phương pháp:** Product Quantization (PQ) hoặc Scalar Quantization

**Scalar Quantization (Đơn giản, recommended):**
- FP32 → INT8: Giảm 75% memory
- Range mapping: [-1, 1] → [0, 255]
- Memory per vector: 1536 bytes (thay vì 6,144)
- Accuracy loss: < 2% (acceptable cho cache)

**Implementation:**
```javascript
// Trước khi thêm vào HNSW
function quantizeVector(vector) {
  return vector.map(v => Math.round((v + 1) * 127.5));
}

// Sau khi lấy từ HNSW (dequantize)
function dequantizeVector(quantized) {
  return quantized.map(v => (v / 127.5) - 1);
}
```

### 3.3 Response Compression

**Algorithm:** LZ4 (nhanh, compression ratio tốt cho text)

**Compression Strategy:**
- LLM responses thường dài và repetitive
- Expected compression ratio: 60-80%
- Decompression time: < 1ms cho responses < 10KB

**Storage Structure:**
```javascript
{
  id: "uuid",
  vectorId: "hnsw_index_id",
  originalPrompt: "compressed_prompt",     // LZ4 compressed
  normalizedPrompt: "cache_key",           // For deduplication
  response: "compressed_response",         // LZ4 compressed
  metadata: {
    model: "gpt-4",
    timestamp: 1234567890,
    compressionRatio: 0.25,
    hitCount: 5
  }
}
```

### 3.4 Metadata Store

**Data Structure:** Map (JavaScript) với custom indexing

**Indexes:**
1. **vectorId → metadata**: O(1) lookup
2. **normalizedPrompt → vectorId**: Deduplication
3. **LRU queue**: Eviction policy

**Fields:**
```javascript
{
  id: string,                    // UUID
  vectorId: number,              // HNSW internal ID
  promptHash: string,            // SHA256 của normalized prompt
  createdAt: number,             // Timestamp
  lastAccessed: number,          // For LRU
  accessCount: number,           // For LFU hybrid
  compressedSize: number,        // Bytes sau compression
  originalSize: number,          // Bytes trước compression
  similarity: number,            // Cosine similarity với query
  ttl: number                    // Optional expiration
}
```

---

## 4. Data Flow

### 4.1 Cache Query Flow

```
1. Client gửi: { prompt: "What is machine learning?" }
   ↓
2. Normalize prompt (lowercase, trim, remove extra spaces)
   ↓
3. Check exact match cache (promptHash lookup)
   ├─ Hit: Return decompressed response (1-2ms)
   └─ Miss: Continue
   ↓
4. Generate embedding (hoặc từ external service)
   ↓
5. Quantize vector (FP32 → INT8)
   ↓
6. HNSW search (k=5, ef=100)
   ├─ similarity > 0.95: Return cached response
   ├─ similarity > 0.85: Return cached response + flag (similar)
   └─ similarity < 0.85: Cache miss → Query LLM
   ↓
7. Nếu miss: Query LLM, compress response, cache mới
```

### 4.2 Cache Write Flow

```
1. Nhận: { prompt, response, embedding }
   ↓
2. Normalize prompt
   ↓
3. Compress prompt (LZ4)
   ↓
4. Compress response (LZ4)
   ↓
5. Quantize embedding (FP32 → INT8)
   ↓
6. Thêm vào HNSW index
   ↓
7. Lưu metadata
   ├─ Update vectorId → metadata map
   ├─ Update promptHash → vectorId map
   └─ Thêm vào LRU queue
   ↓
8. Check memory limit
   └─ Nếu > threshold: Evict LRU entries
```

---

## 5. API Design

### 5.1 Core API

```typescript
interface SemanticCache {
  // Query cache
  get(query: string, options?: QueryOptions): Promise<CacheResult | null>;
  
  // Add to cache
  set(prompt: string, response: string, embedding: number[]): Promise<void>;
  
  // Delete entry
  delete(prompt: string): Promise<boolean>;
  
  // Stats
  stats(): CacheStats;
  
  // Maintenance
  clear(): Promise<void>;
  save(path: string): Promise<void>;
  load(path: string): Promise<void>;
}

interface QueryOptions {
  minSimilarity?: number;      // Default: 0.85
  maxResults?: number;         // Default: 5
  includeSimilar?: boolean;    // Return similar results
}

interface CacheResult {
  response: string;
  similarity: number;
  isExactMatch: boolean;
  cachedAt: Date;
  metadata: ResultMetadata;
}

interface CacheStats {
  totalEntries: number;
  memoryUsage: {
    vectors: number;           // Bytes
    responses: number;         // Bytes
    metadata: number;          // Bytes
    total: number;             // Bytes
  };
  compressionRatio: number;
  cacheHits: number;
  cacheMisses: number;
  avgQueryTime: number;        // ms
}
```

### 5.2 Usage Example

```javascript
const { SemanticCache } = require('./semantic-cache');

// Initialize
const cache = new SemanticCache({
  dim: 1536,                    // Embedding dimension
  maxElements: 100000,          // Max cache size
  quantization: 'int8',         // FP32 → INT8
  compression: 'lz4',           // Response compression
  similarityThreshold: 0.85,    // Min similarity để cache hit
  memoryLimit: '1gb'            // Max memory usage
});

// Query
const result = await cache.get("What is AI?", {
  minSimilarity: 0.90
});

if (result) {
  console.log(`Cache hit! Similarity: ${result.similarity}`);
  console.log(`Response: ${result.response}`);
} else {
  // Query LLM
  const response = await llm.query("What is AI?");
  const embedding = await embed("What is AI?");
  
  // Cache result
  await cache.set("What is AI?", response, embedding);
}
```

---

## 6. Memory Optimization Strategies

### 6.1 Quantization Strategy

**FP32 → INT8 (Recommended):**
- Compression ratio: 4x (75% reduction)
- Accuracy loss: < 2% cosine similarity
- Implementation đơn giản, không cần training

**Product Quantization (Advanced):**
- Compression ratio: 10-20x
- Accuracy loss: 5-10%
- Phức tạp hơn, cần codebook training
- Chỉ nên dùng nếu memory cực kỳ hạn chế

### 6.2 Response Compression

**LZ4 Configuration:**
- Compression level: 1 (fastest)
- Expected ratio: 60-80% cho LLM text
- Decompression: ~500MB/s

**Deduplication:**
- Normalized prompt làm cache key
- SHA256 hash để check duplicate
- Tránh lưu trùng lặp prompts tương tự

### 6.3 Memory Budget Calculation

**Với 100K entries:**

| Component | Raw Size | Compressed | Savings |
|-----------|----------|------------|---------|
| Vectors (FP32) | 614 MB | 154 MB (INT8) | 75% |
| HNSW Index | ~150 MB | ~150 MB | - |
| Responses (avg 2KB) | 200 MB | 60 MB (LZ4) | 70% |
| Metadata | ~50 MB | ~50 MB | - |
| **Total** | **~1 GB** | **~414 MB** | **~60%** |

---

## 7. Implementation Details

### 7.1 Project Structure

```
services/semantic-cache/
├── src/
│   ├── index.js                    # Entry point
│   ├── semantic-cache.js           # Main class
│   ├── hnsw-index.js               # HNSW wrapper
│   ├── quantizer.js                # Vector quantization
│   ├── compressor.js               # LZ4 compression
│   ├── metadata-store.js           # Metadata management
│   ├── normalizer.js               # Prompt normalization
│   └── utils.js                    # Helpers
├── test/
│   ├── semantic-cache.test.js
│   ├── quantizer.test.js
│   └── compressor.test.js
├── package.json
└── README.md
```

### 7.2 Dependencies

```json
{
  "dependencies": {
    "hnswlib-node": "^2.0.0",
    "lz4": "^0.6.0",
    "xxhash-addon": "^2.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
```

### 7.3 Key Implementation Classes

**HNSWIndex (Wrapper):**
```javascript
class HNSWIndex {
  constructor(dim, maxElements, space = 'cosine') {
    this.index = new hnswlib.HierarchicalNSW(
      space,
      dim,
      maxElements,
      16,  // M
      200  // efConstruction
    );
    this.dim = dim;
    this.currentId = 0;
  }
  
  addItem(vector, id = null) {
    const itemId = id !== null ? id : this.currentId++;
    this.index.addPoint(vector, itemId);
    return itemId;
  }
  
  search(queryVector, k = 5, ef = 100) {
    this.index.setEf(ef);
    return this.index.searchKnn(queryVector, k);
  }
}
```

**Quantizer:**
```javascript
class Quantizer {
  constructor(precision = 'int8') {
    this.precision = precision;
  }
  
  quantize(vector) {
    // FP32 → INT8
    return vector.map(v => {
      const normalized = Math.max(-1, Math.min(1, v));
      return Math.round((normalized + 1) * 127.5);
    });
  }
  
  dequantize(quantized) {
    // INT8 → FP32
    return quantized.map(v => (v / 127.5) - 1);
  }
}
```

---

## 8. Performance Optimization

### 8.1 Query Optimization

**Batch Search:**
- Gộp nhiều queries thành batch
- Parallel HNSW search
- Giảm overhead context switching

**Caching Strategy:**
- Hot data giữ trong memory
- Warm data có thể evict
- Preload frequently accessed prompts

### 8.2 Concurrency

**Node.js Event Loop:**
- HNSW operations là CPU-intensive
- Dùng worker threads cho search operations
- Main thread giữ I/O và coordination

**Worker Pool:**
```javascript
const workerPool = new WorkerPool(4, './search-worker.js');

// Search trong worker thread
const result = await workerPool.execute('search', {
  vector: queryVector,
  k: 5
});
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Quantizer:**
- Test round-trip quantization/dequantization
- Verify accuracy loss < 2%
- Edge cases (NaN, Infinity)

**Compressor:**
- Test compression/decompression
- Verify data integrity
- Performance benchmarks

**HNSW Index:**
- Test add/search operations
- Verify recall rate > 95%
- Memory usage validation

### 9.2 Integration Tests

**End-to-End:**
- Full cache query flow
- Cache hit/miss scenarios
- Eviction policy validation

**Performance:**
- Query latency benchmarks
- Memory usage under load
- Throughput testing

### 9.3 Benchmarks

```javascript
// Benchmark script
const benchmark = {
  async run() {
    const cache = new SemanticCache({ dim: 1536 });
    
    // Insert 10K vectors
    console.time('insert');
    for (let i = 0; i < 10000; i++) {
      await cache.set(`prompt ${i}`, `response ${i}`, generateVector());
    }
    console.timeEnd('insert');
    
    // Query performance
    console.time('query');
    for (let i = 0; i < 1000; i++) {
      await cache.get(`prompt ${i % 100}`);
    }
    console.timeEnd('query');
    
    // Memory usage
    console.log('Memory:', cache.stats().memoryUsage);
  }
};
```

---

## 10. Deployment & Operations

### 10.1 Docker Configuration

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

### 10.2 Monitoring

**Metrics:**
- Cache hit rate
- Query latency (P50, P95, P99)
- Memory usage
- Compression ratio
- HNSW index size

**Health Checks:**
- Index integrity
- Memory limit check
- Response time check

### 10.3 Backup & Recovery

**Snapshot:**
```javascript
// Save index to disk
await cache.save('/data/cache-snapshot.bin');

// Load from disk
await cache.load('/data/cache-snapshot.bin');
```

**Periodic Backup:**
- Hourly snapshots
- 7-day retention
- S3/GCS storage

---

## 11. Future Enhancements

### 11.1 Short-term
- [ ] Implement LFU eviction policy
- [ ] Add TTL support cho cache entries
- [ ] Implement batch operations
- [ ] Add metrics exporter (Prometheus)

### 11.2 Long-term
- [ ] Multi-modal support (images, audio)
- [ ] Distributed cache (Redis/Valkey backend)
- [ ] GPU acceleration cho vector operations
- [ ] Adaptive quantization (FP16/INT8/INT4)

---

## 12. References

1. **HNSW Paper:** Malkov & Yashunin, "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs" (2018)
2. **hnswlib:** https://github.com/nmslib/hnswlib
3. **hnswlib-node:** https://github.com/yahoojapan/hnswlib-node
4. **Product Quantization:** Jégou et al., "Product Quantization for Nearest Neighbor Search" (2011)
5. **DragonflyDB:** https://www.dragonflydb.io/ (multi-threaded Redis alternative)

---

## 13. Appendix

### A. Memory Calculation Formula

```
Total Memory = Vectors + Index + Responses + Metadata

Vectors = numEntries × dim × precisionBytes
Index ≈ numEntries × M × 4 bytes (connections)
Responses = numEntries × avgResponseSize × compressionRatio
Metadata = numEntries × metadataSize (~500 bytes)
```

### B. Cosine Similarity Thresholds

| Similarity | Interpretation | Action |
|------------|----------------|--------|
| 0.98 - 1.0 | Nearly identical | Cache hit (exact) |
| 0.90 - 0.98 | Very similar | Cache hit (high confidence) |
| 0.85 - 0.90 | Similar | Cache hit (medium confidence) |
| 0.70 - 0.85 | Somewhat related | Return with warning |
| < 0.70 | Not similar | Cache miss |

### C. Normalization Rules

1. Convert to lowercase
2. Trim whitespace
3. Remove extra spaces (normalize to single space)
4. Remove punctuation (optional)
5. Remove stop words (optional, configurable)

---

**End of Document**
