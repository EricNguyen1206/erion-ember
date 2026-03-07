# BM25 + Jaccard Hybrid — Design Document

**Date:** 2026-03-08  
**Status:** Approved  
**Author:** brainstorming session

---

## Problem

Current SimHash implementation only detects near-duplicate prompts that share the **same tokens** (word-order invariant). It fails to match semantically equivalent paraphrases:

- `"What is Golang?"` vs `"Tell me about Go language"` → **SimHash MISS** (different tokens)
- `"Explain goroutines please"` vs `"How do goroutines work"` → **SimHash MISS**

## Constraints

- **Single static binary** — no CGO, no `.so` model files (`CGO_ENABLED=0`)
- **Zero new external dependencies** (only xxhash + lz4 already in `go.mod`)
- **No external services** — fully standalone, no HTTP calls to Ollama/OpenAI

## Decision

Replace `SimHash (uint64 fingerprint)` with a **BM25 + Jaccard weighted score** computed at query time against all stored entries.

---

## Algorithm Design

### Scoring Formula

```
score(query, entry) = 0.6 × BM25(query, entry) + 0.4 × Jaccard(query, entry)
```

The threshold (default `0.85`) is applied directly to this `[0, 1]` score.

### BM25 (Okapi BM25)

Standard TF-IDF weighting that boosts rare, important terms:

```
BM25(q, d) = Σ IDF(t) × (tf(t,d) × (k1+1)) / (tf(t,d) + k1×(1 - b + b×|d|/avgdl))
```

- `k1 = 1.2`, `b = 0.75` (standard defaults)
- `IDF(t) = log((N - df(t) + 0.5) / (df(t) + 0.5) + 1)` — smoothed
- Score is normalized to `[0, 1]` by dividing by max possible BM25 score for query

**IDF is maintained incrementally:** `Scorer.UpdateIDF(tokens)` called on every `Set()`.

### Jaccard Similarity

```
Jaccard(A, B) = |A ∩ B| / |A ∪ B|
```

Where A, B are **sets** of tokens (duplicates removed). Fast O(n+m) with sorted token lists.

---

## Data Model Changes

### Entry struct (`internal/cache/metadata.go`)

```diff
- SimHash  uint64   // Charikar fingerprint
+ Tokens   []string // normalized tokens of the prompt (for scoring)
```

The `NormalizedPrompt` field is already stored — tokens can be re-derived from it, but storing `Tokens []string` avoids re-tokenizing on every slow-path scan.

### New file: `internal/cache/scorer.go`

```go
type Scorer struct {
    mu      sync.RWMutex
    df      map[string]int  // document frequency per term
    n       int             // total documents (for IDF)
    avgdl   float64         // running average document length in tokens
}

func NewScorer() *Scorer
func (s *Scorer) UpdateIDF(tokens []string)         // called on Set()
func (s *Scorer) RemoveDoc(tokens []string)          // called on Delete() / eviction
func (s *Scorer) Score(query, entry []string) float32
func (s *Scorer) BM25(query, doc []string) float32
func (s *Scorer) Jaccard(a, b []string) float32
```

### `internal/cache/simhash.go` → **Deleted**

`HammingDistance`, `Similarity` functions removed. `tokenize()` moved to `scorer.go`.

### `internal/cache/semantic.go`

- Replace `simhasher *SimHasher` → `scorer *Scorer`
- Slow path: iterate `store.ScanAll()`, call `scorer.Score(queryTokens, e.Tokens)`
- `Set()`: call `scorer.UpdateIDF(tokens)` after storing
- `Delete()`: call `scorer.RemoveDoc(tokens)` before removing

---

## Performance Profile

| Scenario | SimHash | BM25+Jaccard |
|---|---|---|
| Slow path, 1K entries | ~5 µs | ~20–40 µs |
| Slow path, 10K entries | ~50 µs | ~200–400 µs |
| Slow path, 100K entries | ~500 µs | ~2–4 ms |
| Paraphrase accuracy | Low | Medium–High |
| Memory overhead/entry | +8 bytes | +~100-300 bytes (tokens slice) |
| New binary dependencies | 0 | 0 |

> For >100K entries with high slow-path traffic, future optimization: LSH banding over token sets.

---

## What Does NOT Change

- `internal/cache/normalizer.go` — unchanged
- `internal/cache/compressor.go` — unchanged  
- `internal/cache/metadata.go` — only swap `SimHash uint64` → `Tokens []string`
- `internal/server/http.go` — unchanged (API contract identical)
- `cmd/server/main.go` — unchanged
- `Dockerfile`, `docker-compose.yml` — unchanged
- `go.mod` — no new dependencies
