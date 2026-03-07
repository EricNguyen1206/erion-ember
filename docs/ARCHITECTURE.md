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
│                 │  │      BM25 + Jaccard        │ │  │
│                 │  │       Hybrid Scorer        │ │  │
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

### Slow Path (BM25+Jaccard similarity, ~Nµs)

```
GET request (exact miss)
    │
    ▼
Tokenize(normalized)           → []string tokens
    │
    ▼
MetadataStore.ScanAll()        → []Entry snapshot
    │
    ▼
for each entry: Scorer.Score(queryTokens, entry.Tokens)
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
    ├── Tokenize(normalized)                → tokens ([]string)
    ├── Compressor.Compress(prompt)         → []byte
    ├── Compressor.Compress(response)       → []byte
    ├── MetadataStore.Set(promptHash, Entry{Tokens, ...}, ttl)
    └── Scorer.UpdateIDF(tokens)            → incremental state update
```

## Hybrid Scoring Algorithm

Combines term importance (BM25) with word overlap (Jaccard) to achieve robust paraphrase detection without heavy models.

### BM25 (Best Matching 25)
Estimates term relevance based on Inverse Document Frequency (IDF) and Term Frequency (TF). 
- **Rare terms** (low frequency in corpus) are weighted more heavily.
- **Incremental IDF**: The global IDF state is updated on every `Set` and `Delete`, ensuring the scorer evolves with the cache.

### Jaccard Similarity
Measures simpler token overlap: `|A ∩ B| / |A ∪ B|`. This ensures that even if IDF is not yet representative (small corpus), identical or nearly identical word sets are detected.

### Combined Metric
`Similarity = 0.6 × BM25_normalized + 0.4 × Jaccard`

## Data Model

```go
type Entry struct {
    ID                   string
    PromptHash           uint64        // xxhash of normalised prompt
    Tokens               []string      // normalized tokens for similarity scan
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
- `ScanAll() []*Entry` — O(n) snapshot for similarity scan

## Configuration

| Env Var | Default | Notes |
|---------|---------|-------|
| `HTTP_PORT` | `8080` | Listen port |
| `CACHE_SIMILARITY_THRESHOLD` | `0.85` | Similarity threshold [0,1] |
| `CACHE_MAX_ELEMENTS` | `100000` | LRU max entries |
| `CACHE_DEFAULT_TTL` | `3600s` | 0 = no expiry |

## Scalability Notes

The similarity slow path is **O(n)** over stored entries. 

| Entries | Slow path latency |
|---------|-------------------|
| 1,000 | ~10 µs |
| 10,000 | ~100 µs |
| 100,000 | ~1 ms |
| 1,000,000 | ~10 ms |

The BM25+Jaccard approach is slightly slower (~2x) than the previous SimHash implementation but significantly more accurate for paraphrase detection.

For >100K entries with high slow-path traffic, consider:
- **Banding**: Inverted indexing for top candidate selection.
- **HNSW**: Building a vector index on the token space if latencies exceed 10ms.
