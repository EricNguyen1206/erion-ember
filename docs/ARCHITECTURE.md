# Architecture — Erion Ember v3

## Overview

Erion Ember v3 is a **standalone Go binary** that provides LLM response caching via a REST/JSON API. It is designed to be deployed like Redis — no orchestration, no sidecar services, no model files.

## Components

```
┌─────────────────────────────────────────────────────┐
│                 erion-ember (binary)                │
│                                                     │
│  ┌──────────┐   ┌───────────────────────────────┐  │
│  │HTTP Server│   │       SemanticCache           │  │
│  │:8080     │──▶│                               │  │
│  └──────────┘   │  ┌──────────┐ ┌────────────┐  │  │
│                 │  │Normalizer│ │ Compressor │  │  │
│                 │  │ xxhash   │ │    LZ4     │  │  │
│                 │  └────┬─────┘ └────────────┘  │  │
│                 │       │                        │  │
│                 │  ┌────▼──────────────────────┐ │  │
│                 │  │     MetadataStore (LRU)   │ │  │
│                 │  │  map[uint64]*Entry + list  │ │  │
│                 │  └───────────────────────────┘ │  │
│                 │                               │  │
│                 │  ┌───────────────────────────┐ │  │
│                 │  │       SimHasher            │ │  │
│                 │  │  text → uint64 fingerprint │ │  │
│                 │  └───────────────────────────┘ │  │
│                 └───────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Request Flow

### Fast Path (exact match, ~0.1 µs)

```
GET request
    │
    ▼
Normalizer.Normalize(prompt)   → "what is go"
    │
    ▼
Normalizer.Hash(normalized)    → uint64 key (xxhash)
    │
    ▼
MetadataStore.FindByHash(key)  → Entry found?
    │
   YES → Compressor.Decompress(entry.CompressedResponse)
       → return { hit: true, exact_match: true, similarity: 1.0 }
```

### Slow Path (SimHash similarity, ~Nµs)

```
GET request (exact miss)
    │
    ▼
SimHasher.Hash(normalized)     → uint64 fingerprint (Charikar)
    │
    ▼
MetadataStore.ScanAll()        → []Entry snapshot
    │
    ▼
for each entry: HammingDistance(queryFP, entry.SimHash)
    │
    ▼
best match within threshold?
    ├── YES → return { hit: true, exact_match: false, similarity: X }
    └── NO  → return { hit: false }
```

### Write Path (Set)

```
SET request { prompt, response, ttl }
    │
    ├── Normalizer.Normalize + Hash         → promptHash (xxhash)
    ├── SimHasher.Hash(normalized)          → simHash (uint64)
    ├── Compressor.Compress(prompt)         → []byte
    ├── Compressor.Compress(response)       → []byte
    └── MetadataStore.Set(promptHash, Entry{SimHash, ...}, ttl)
```

## SimHash Algorithm

Charikar locality-sensitive hashing — creates a 64-bit fingerprint:

```
tokens = split(normalizedText)

v = [64]int32{0}
for token in tokens:
    h = xxhash(token)           // 64-bit hash
    for i in 0..63:
        v[i] += h.bit(i) ? +1 : -1

fingerprint = bits: if v[i] > 0 → 1, else → 0
```

**Key property**: texts sharing most tokens produce fingerprints with small Hamming distance.

**Similarity formula**: `sim = (64 - HammingBits) / 64`  
**Threshold conversion**: `threshold=0.85 → maxBits = 64 × (1-0.85) = 9 bits`

## Data Model

```go
type Entry struct {
    ID                   string
    PromptHash           uint64        // xxhash of normalised prompt
    SimHash              uint64        // Charikar fingerprint
    NormalizedPrompt     string
    CompressedPrompt     []byte        // LZ4
    CompressedResponse   []byte        // LZ4
    OriginalPromptSize   int
    OriginalResponseSize int
    CreatedAt            time.Time
    LastAccessed         time.Time
    AccessCount          int
    ExpiresAt            *time.Time    // nil = no expiry
}
```

## MetadataStore

Thread-safe LRU cache:
- `byHash map[uint64]*list.Element` — O(1) exact lookup
- `lru *list.List` — eviction order (LRU tail evicted when maxSize exceeded)
- `ScanAll() []*Entry` — O(n) snapshot for SimHash search

## Configuration

| Env Var | Default | Notes |
|---------|---------|-------|
| `HTTP_PORT` | `8080` | Listen port |
| `CACHE_SIMILARITY_THRESHOLD` | `0.85` | Converted to `int(64*(1-t))` max Hamming bits |
| `CACHE_MAX_ELEMENTS` | `100000` | LRU max entries |
| `CACHE_DEFAULT_TTL` | `3600s` | 0 = no expiry |

## Scalability Notes

The SimHash slow path is **O(n)** over stored entries. Typical LLM cache sizes:

| Entries | Slow path latency |
|---------|-------------------|
| 1,000 | ~5 µs |
| 10,000 | ~50 µs |
| 100,000 | ~500 µs |
| 1,000,000 | ~5 ms |

For >100K entries with high slow-path traffic, consider:
- Banding (divide 64-bit fingerprint into 8×8-bit bands → multi-bucket lookup)
- HNSW over SimHash vectors (e.g., via `usearch`)
