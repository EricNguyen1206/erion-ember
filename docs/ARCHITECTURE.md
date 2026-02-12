# Erion Ember - Architecture Documentation

## Overview

Erion Ember is a high-performance semantic caching layer for LLM applications. It reduces costs and latency by intelligently caching responses and serving them for semantically similar queries.

## System Architecture

```
Client Layer
  └── MCP Client

MCP Server Layer
  └── Stdio MCP Server
      ├── Tool Handlers
      └── Zod Validator

Core Layer
  └── SemanticCache
      ├── Normalizer
      ├── Quantizer
      ├── Compressor
      ├── VectorIndex (Annoy/HNSW)
      ├── MetadataStore
      └── EmbeddingService

External Services
  └── Embedding API (OpenAI or Mock)
```

## Component Architecture

### 1. MCP Server Layer

Components:
- MCP Server: src/mcp-server.js - MCP server entry point and tool registration
- Tool Handlers: src/tools/*.js - ai_complete, cache_check, cache_store, cache_stats, generate_embedding
- MCP SDK: @modelcontextprotocol/sdk - Protocol handling and transport
- Zod Validation: zod - Tool input validation

### 2. Core Layer - SemanticCache

Cache flow:
1. get/set prompt
2. Normalize
3. Hash prompt
4. Check exact match
   - Yes: Cache hit
   - No: Vector search
5. Check similarity >= threshold
   - Yes: Cache hit
   - No: Cache miss → Call LLM → Store in cache

Core Components:
- SemanticCache: src/lib/semantic-cache.js - Main cache orchestrator
- VectorIndex Interface: src/lib/vector-index/interface.js - Shared vector index contract
- VectorIndex Factory: src/lib/vector-index/index.js - Backend selection (annoy or hnsw)
- AnnoyVectorIndex: src/lib/vector-index/annoy-index.js - Pure JS approximate nearest neighbor search
- HNSWVectorIndex: src/lib/vector-index/hnsw-index.js - C++ HNSW approximate nearest neighbor search
- Quantizer: src/lib/quantizer.js - INT8 vector quantization
- Compressor: src/lib/compressor.js - LZ4 text compression
- Normalizer: src/lib/normalizer.js - Text normalization and hashing
- MetadataStore: src/lib/metadata-store.js - LRU metadata storage

### 3. Vector Index Backends

Erion Ember supports two vector index backends:
- Annoy.js: Pure JavaScript, no native dependencies
- HNSW: C++ HNSW implementation via hnswlib-node

HNSW (Hierarchical Navigable Small World) provides O(log n) approximate nearest neighbor search.

Key Parameters:
- M (max connections): 16
- efConstruction (build quality): 200
- efSearch (search quality): 50
- Metric: Cosine similarity

### 4. Data Flow

#### Cache Read Flow

1. MCP Client → tool call (ai_complete)
2. MCP Server → SemanticCache.get(prompt, embedding)
3. SemanticCache → Normalizer.normalize(prompt)
4. SemanticCache → MetadataStore.findByPromptHash(hash)
5. If exact match: return cached response
6. If no exact match: VectorIndex.search(embedding, k=5)
7. If similar match: return cached response with similarity
8. If no match: return cache miss

#### Cache Write Flow

1. SemanticCache receives prompt, response, embedding
2. Normalizer.normalize(prompt)
3. Normalizer.hash(prompt)
4. Compressor.compress(prompt)
5. Compressor.compress(response)
6. Quantizer.quantize(embedding)
7. VectorIndex.addItem(quantizedVector) → returns vectorId
8. MetadataStore.set(id, metadata, ttl)

## Memory Architecture

Memory layout:
- Vector Storage: Vector Index (Annoy/HNSW) with INT8 Vectors
- Metadata Storage: Prompt Hash Map, Compressed Data, TTL Timers

Memory Optimization:
- INT8 Quantization: 75% reduction (Float32 → INT8 vectors)
- LZ4 Compression: 60-80% reduction (text compression)
- Exact Match Index: O(1) hash-based lookup

## Deployment Architecture

### Docker Compose Profiles

Default Profile:
- erion-ember service

Benchmark Profile:
- k6 load testing

Monitoring Profile:
- influxdb
- grafana

### Container Configuration

| Service | Image | Port | Health Check |
|---------|-------|------|--------------|
| erion-ember | Custom Bun | - | Process health / exit code |
| k6 | grafana/k6 | - | - |
| influxdb | influxdb:2.7 | 8086 | - |
| grafana | grafana/grafana | 3001 | - |

## API Architecture

### MCP Tools

| Tool | Purpose |
|------|---------|
| ai_complete | Cache lookup and response (hit or miss) |
| cache_check | Cache lookup without storing |
| cache_store | Store prompt/response pair |
| cache_stats | Cache metrics and savings |
| generate_embedding | Generate embedding vector |

### Request/Response Schema

```typescript
// ai_complete Request
interface AiCompleteRequest {
  prompt: string;                 // Required, min 1 char
  embedding?: number[];           // Optional pre-computed embedding
  similarityThreshold?: number;   // Optional override (0-1)
}

// ai_complete Response
interface AiCompleteResponse {
  cached: boolean;
  response?: string;
  similarity?: number;            // Only if cached
  isExactMatch?: boolean;         // Only if cached
  cachedAt?: string;              // ISO 8601
}
```

## Security Architecture

Security layers:
- Process Isolation → Input Validation → Safe Errors

Security Features:
- Process Isolation: OS process + stdio transport, run MCP server as separate process
- Input Validation: Zod schemas for all tools
- Error Sanitization: Tool handlers return safe errors

## Performance Characteristics

### Latency Targets

| Operation | Target | Typical |
|-----------|--------|---------|
| Cache Hit (exact) | < 5ms | 1-2ms |
| Cache Hit (semantic) | < 20ms | 5-15ms |
| Cache Miss | < 2s | 500ms-1.5s |

### Throughput

| Test Type | VUs | RPS Target |
|-----------|-----|------------|
| Smoke | 10 | 100+ |
| Load | 200 | 1000+ |
| Stress | 500 | 2000+ |

## Technology Stack

Runtime: Bun v1.0+

Protocol: @modelcontextprotocol/sdk

Core Libraries:
- annoy.js
- hnswlib-node
- lz4js
- xxhash-addon
- Zod

Infrastructure:
- Docker
- K6

## Future Considerations

### Scalability

- Horizontal Scaling: Stateless design allows multiple instances
- Embedding Service: Dedicated microservice for vector generation

### Observability

- OpenTelemetry: Distributed tracing
- Prometheus Metrics: Detailed performance metrics
- Structured Logging: JSON logs for aggregation