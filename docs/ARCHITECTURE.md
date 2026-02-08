# Erion Ember - Architecture Documentation

## Overview

Erion Ember is a high-performance semantic caching layer for LLM applications. It reduces costs and latency by intelligently caching responses and serving them for semantically similar queries.

## System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        C[Client Application]
    end
    
    subgraph "API Layer"
        F[Fastify Server]
        RL[Rate Limiter]
        AK[API Key Auth]
        V[Zod Validator]
    end
    
    subgraph "Core Layer"
        SC[SemanticCache]
        N[Normalizer]
        Q[Quantizer]
        COMP[Compressor]
        HNSW[HNSWIndex]
        MS[MetadataStore]
    end
    
    subgraph "External Services"
        GROQ[Groq API]
        REDIS[(Redis)]
    end
    
    C --> F
    F --> RL --> AK --> V
    V --> SC
    SC --> N
    SC --> Q
    SC --> COMP
    SC --> HNSW
    SC --> MS
    SC -.-> GROQ
    MS -.-> REDIS
```

## Component Architecture

### 1. API Layer

```mermaid
graph LR
    subgraph "Fastify Server"
        R[Routes] --> M[Middleware]
        M --> H[Handlers]
    end
    
    subgraph "Middleware Stack"
        CORS[CORS]
        RL[Rate Limit]
        AUTH[API Auth]
        VAL[Validation]
    end
    
    M --> CORS --> RL --> AUTH --> VAL
```

#### Components

| Component | File | Description |
|-----------|------|-------------|
| **Server** | `src/server.js` | Fastify server initialization and plugin registration |
| **Chat Route** | `src/routes/chat.js` | Main chat endpoint with caching logic |
| **Rate Limiter** | `@fastify/rate-limit` | 60 requests/minute per IP |
| **CORS** | `@fastify/cors` | Cross-origin resource sharing |

### 2. Core Layer - SemanticCache

```mermaid
graph TB
    subgraph "SemanticCache"
        GET[get] --> NORM[Normalize]
        SET[set] --> NORM
        
        NORM --> HASH[Hash Prompt]
        HASH --> EXACT{Exact Match?}
        
        EXACT -->|Yes| HIT[Cache Hit]
        EXACT -->|No| VEC[Vector Search]
        
        VEC --> SIM{Similarity >= Threshold?}
        SIM -->|Yes| HIT
        SIM -->|No| MISS[Cache Miss]
        
        MISS --> LLM[Call LLM API]
        LLM --> STORE[Store in Cache]
    end
```

#### Core Components

| Component | File | Purpose |
|-----------|------|---------|
| **SemanticCache** | `src/lib/semantic-cache.js` | Main cache orchestrator |
| **HNSWIndex** | `src/lib/hnsw-index.js` | Fast approximate nearest neighbor search |
| **Quantizer** | `src/lib/quantizer.js` | INT8 vector quantization |
| **Compressor** | `src/lib/compressor.js` | LZ4 text compression |
| **Normalizer** | `src/lib/normalizer.js` | Text normalization and hashing |
| **MetadataStore** | `src/lib/metadata-store.js` | TTL-based metadata storage |

### 3. HNSW Index

HNSW (Hierarchical Navigable Small World) provides O(log n) approximate nearest neighbor search.

```mermaid
graph TB
    subgraph "HNSW Structure"
        L2[Layer 2 - Sparse]
        L1[Layer 1 - Medium]
        L0[Layer 0 - Dense]
        
        L2 --> L1
        L1 --> L0
    end
    
    Q[Query Vector] --> L2
    L0 --> R[Top-K Results]
```

**Key Parameters:**
- **M** (max connections): 16
- **efConstruction** (build quality): 200
- **efSearch** (search quality): 50
- **Metric**: Cosine similarity

### 4. Data Flow

#### Cache Read Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant F as Fastify
    participant SC as SemanticCache
    participant N as Normalizer
    participant MS as MetadataStore
    participant H as HNSWIndex
    participant G as Groq API
    
    C->>F: POST /v1/chat
    F->>SC: get(prompt, embedding)
    SC->>N: normalize(prompt)
    SC->>MS: findByPromptHash(hash)
    
    alt Exact Match Found
        MS-->>SC: metadata
        SC-->>F: {cached: true, similarity: 1.0}
    else No Exact Match
        SC->>H: search(embedding, k=5)
        H-->>SC: similar vectors
        alt Similar Match Found
            SC-->>F: {cached: true, similarity: 0.92}
        else No Match
            SC->>G: chat/completions
            G-->>SC: response
            SC->>MS: set(metadata)
            SC->>H: addItem(vector)
            SC-->>F: {cached: false}
        end
    end
    
    F-->>C: Response JSON
```

#### Cache Write Flow

```mermaid
sequenceDiagram
    participant SC as SemanticCache
    participant N as Normalizer
    participant C as Compressor
    participant Q as Quantizer
    participant H as HNSWIndex
    participant MS as MetadataStore
    
    SC->>N: normalize(prompt)
    SC->>N: hash(prompt)
    SC->>C: compress(prompt)
    SC->>C: compress(response)
    SC->>Q: quantize(embedding)
    SC->>H: addItem(quantizedVector)
    H-->>SC: vectorId
    SC->>MS: set(id, metadata, ttl)
```

## Memory Architecture

```mermaid
graph TB
    subgraph "Memory Layout"
        subgraph "Vector Storage"
            VS[HNSW Index]
            VD[INT8 Vectors]
        end
        
        subgraph "Metadata Storage"
            PM[Prompt Hash Map]
            CM[Compressed Data]
            TM[TTL Timers]
        end
    end
    
    VS --> VD
    PM --> CM
    CM --> TM
```

### Memory Optimization

| Technique | Savings | Description |
|-----------|---------|-------------|
| **INT8 Quantization** | 75% | Float32 → INT8 vectors |
| **LZ4 Compression** | 60-80% | Text compression |
| **Exact Match Index** | O(1) | Hash-based lookup |

## Deployment Architecture

### Docker Compose Profiles

```mermaid
graph TB
    subgraph "Default Profile"
        E[erion-ember]
        R[redis]
    end
    
    subgraph "Benchmark Profile"
        K[k6]
    end
    
    subgraph "Monitoring Profile"
        I[influxdb]
        G[grafana]
    end
    
    E --> R
    K --> E
    G --> I
    K -.-> I
```

### Container Configuration

| Service | Image | Port | Health Check |
|---------|-------|------|--------------|
| erion-ember | Custom Bun | 3000 | GET /health |
| redis | redis:7-alpine | 6379 | redis-cli ping |
| k6 | grafana/k6 | - | - |
| influxdb | influxdb:2.7 | 8086 | - |
| grafana | grafana/grafana | 3001 | - |

## API Architecture

### Endpoints

```
┌─────────────────────────────────────────────────────────┐
│ Erion Ember API v1                                       │
├─────────────────────────────────────────────────────────┤
│ POST /v1/chat        │ Chat with semantic caching        │
│ GET  /health         │ Health check                      │
│ GET  /v1/stats       │ Cache statistics                  │
└─────────────────────────────────────────────────────────┘
```

### Request/Response Schema

```typescript
// POST /v1/chat Request
interface ChatRequest {
  prompt: string;      // Required, min 1 char
  model?: string;      // Default: "openai/gpt-oss-120b"
}

// POST /v1/chat Response
interface ChatResponse {
  response: string;
  cached: boolean;
  similarity?: number; // Only if cached
  model: string;
  timestamp: string;   // ISO 8601
  metadata?: object;   // Only if cached
  savings: {
    tokens_saved: number;
    usd_saved: number;
  };
}
```

## Security Architecture

```mermaid
graph LR
    subgraph "Security Layers"
        RL[Rate Limiting] --> AK[API Key Auth]
        AK --> IV[Input Validation]
        IV --> SE[Safe Errors]
    end
    
    R[Request] --> RL
    SE --> RS[Response]
```

### Security Features

| Feature | Implementation | Configuration |
|---------|---------------|---------------|
| Rate Limiting | @fastify/rate-limit | 60 req/min per IP |
| API Key Auth | Custom middleware | Optional `x-api-key` header |
| Input Validation | Zod schemas | All endpoints |
| Error Sanitization | Custom handler | Production only |

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

```mermaid
graph TB
    subgraph "Runtime"
        BUN[Bun v1.0+]
    end
    
    subgraph "Framework"
        FAST[Fastify v4]
    end
    
    subgraph "Core Libraries"
        HNSW[hnswlib-node]
        LZ4[lz4js]
        XX[xxhash-addon]
        ZOD[Zod]
    end
    
    subgraph "Infrastructure"
        REDIS[Redis 7]
        DOCKER[Docker]
        K6[K6]
    end
    
    BUN --> FAST
    FAST --> HNSW
    FAST --> LZ4
    FAST --> XX
    FAST --> ZOD
```

## Future Considerations

### Scalability

- **Horizontal Scaling**: Stateless design allows multiple instances
- **Redis Cluster**: For distributed caching
- **Embedding Service**: Dedicated microservice for vector generation

### Observability

- **OpenTelemetry**: Distributed tracing
- **Prometheus Metrics**: Detailed performance metrics
- **Structured Logging**: JSON logs for aggregation
