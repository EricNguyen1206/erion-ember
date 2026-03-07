# BM25 + Jaccard Hybrid — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace SimHash fingerprinting with a BM25 + Jaccard weighted scorer for better semantic similarity detection while keeping zero CGO, zero new dependencies, single static binary.

**Architecture:** New `Scorer` struct in `internal/cache/scorer.go` maintains incremental IDF state and computes `0.6×BM25 + 0.4×Jaccard` score at query time. `Entry` stores `Tokens []string` instead of `SimHash uint64`. Slow path in `SemanticCache.Get()` iterates entries and scores against query tokens.

**Tech Stack:** Go stdlib only — `math`, `sort`, `sync`. xxhash already present for fast path (unchanged). No new `go get`.

---

## Task 1: Add `Scorer` (with tests)

**Files:**
- Create: `internal/cache/scorer.go`
- Create: `internal/cache/scorer_test.go`

**Step 1: Write failing test**

Create `internal/cache/scorer_test.go`:
```go
package cache_test

import (
    "testing"
    "github.com/EricNguyen1206/erion-ember/internal/cache"
)

func TestJaccardIdentical(t *testing.T) {
    s := cache.NewScorer()
    toks := []string{"go", "language", "fast"}
    got := s.Jaccard(toks, toks)
    if got != 1.0 {
        t.Errorf("identical sets: want 1.0, got %f", got)
    }
}

func TestJaccardDisjoint(t *testing.T) {
    s := cache.NewScorer()
    a := []string{"go", "language"}
    b := []string{"python", "django"}
    got := s.Jaccard(a, b)
    if got != 0.0 {
        t.Errorf("disjoint sets: want 0.0, got %f", got)
    }
}

func TestJaccardPartial(t *testing.T) {
    s := cache.NewScorer()
    a := []string{"go", "language", "fast"}
    b := []string{"go", "language", "slow"}
    // intersection: {go, language} = 2; union: 4 → 0.5
    got := s.Jaccard(a, b)
    if got < 0.49 || got > 0.51 {
        t.Errorf("partial overlap: want ~0.5, got %f", got)
    }
}

func TestBM25ZeroWithoutDocs(t *testing.T) {
    s := cache.NewScorer()
    q := []string{"goroutine", "channel"}
    d := []string{"goroutine", "channel"}
    // No docs registered → IDF = log(1.5/1.5+1) ~ 0 → score 0
    got := s.BM25(q, d)
    if got < 0 {
        t.Errorf("BM25 should be >= 0, got %f", got)
    }
}

func TestBM25HighForRareTerms(t *testing.T) {
    s := cache.NewScorer()
    // Register 10 docs, only 1 contains "goroutine"
    common := []string{"go", "language"}
    rare   := []string{"goroutine", "channel"}
    for i := 0; i < 9; i++ {
        s.UpdateIDF(common)
    }
    s.UpdateIDF(rare)

    scoreRare   := s.BM25([]string{"goroutine"}, rare)
    scoreCommon := s.BM25([]string{"go"}, common)
    if scoreRare <= scoreCommon {
        t.Errorf("rare term should score higher: rare=%f common=%f", scoreRare, scoreCommon)
    }
}

func TestScoreSameTokensHigh(t *testing.T) {
    s := cache.NewScorer()
    toks := []string{"what", "is", "golang"}
    s.UpdateIDF(toks)
    got := s.Score(toks, toks)
    if got < 0.95 {
        t.Errorf("identical tokens: want >=0.95 score, got %f", got)
    }
}

func TestScoreUnrelatedLow(t *testing.T) {
    s := cache.NewScorer()
    a := []string{"cloud", "aws", "kubernetes", "deployment"}
    b := []string{"goroutine", "channel", "concurrency", "mutex"}
    s.UpdateIDF(a)
    s.UpdateIDF(b)
    got := s.Score(a, b)
    if got > 0.15 {
        t.Errorf("unrelated tokens: want <0.15 score, got %f", got)
    }
}
```

**Step 2: Run — expect FAIL**
```bash
go test ./internal/cache/... -run "TestJaccard|TestBM25|TestScore" -v
```
Expected: `undefined: cache.NewScorer`

**Step 3: Implement** `internal/cache/scorer.go`:
```go
package cache

import (
    "math"
    "sort"
    "sync"
    "unicode"
    "strings"
)

const (
    bm25K1 = 1.2
    bm25B  = 0.75
    bm25W  = 0.6  // weight for BM25 in combined score
    jaccW  = 0.4  // weight for Jaccard in combined score
)

// Scorer computes BM25 + Jaccard hybrid similarity between token slices.
// It maintains incremental IDF state updated on every Set/Delete.
type Scorer struct {
    mu    sync.RWMutex
    df    map[string]int // document frequency per term
    n     int            // total number of documents
    sumDL int            // sum of all document lengths (in tokens)
}

func NewScorer() *Scorer {
    return &Scorer{df: make(map[string]int)}
}

// UpdateIDF registers a new document's tokens into the IDF index.
// Call this after storing a new entry.
func (s *Scorer) UpdateIDF(tokens []string) {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.n++
    s.sumDL += len(tokens)
    seen := make(map[string]bool)
    for _, t := range tokens {
        if !seen[t] {
            s.df[t]++
            seen[t] = true
        }
    }
}

// RemoveDoc de-registers a document's tokens from the IDF index.
// Call this when deleting or evicting an entry.
func (s *Scorer) RemoveDoc(tokens []string) {
    s.mu.Lock()
    defer s.mu.Unlock()
    if s.n <= 0 {
        return
    }
    s.n--
    s.sumDL -= len(tokens)
    seen := make(map[string]bool)
    for _, t := range tokens {
        if !seen[t] {
            s.df[t]--
            if s.df[t] <= 0 {
                delete(s.df, t)
            }
            seen[t] = true
        }
    }
}

// Score returns a combined [0,1] similarity: 0.6×BM25 + 0.4×Jaccard.
func (s *Scorer) Score(query, doc []string) float32 {
    return float32(bm25W)*s.BM25(query, doc) + float32(jaccW)*s.Jaccard(query, doc)
}

// BM25 returns a normalized BM25 score in [0,1].
func (s *Scorer) BM25(query, doc []string) float32 {
    s.mu.RLock()
    n := s.n
    sumDL := s.sumDL
    df := s.df
    s.mu.RUnlock()

    if n == 0 || len(doc) == 0 {
        return 0
    }

    avgdl := float64(sumDL) / float64(n)
    docLen := float64(len(doc))

    // term frequency in doc
    tf := make(map[string]int, len(doc))
    for _, t := range doc {
        tf[t]++
    }

    var score float64
    var maxScore float64

    for _, t := range query {
        docFreq := df[t]
        idf := math.Log(float64(n-docFreq)+0.5)/float64(docFreq+1) + 1.0
        // IDF floor at 0
        if idf < 0 {
            idf = 0
        }
        termTF := float64(tf[t])
        numerator := termTF * (bm25K1 + 1)
        denominator := termTF + bm25K1*(1-bm25B+bm25B*docLen/avgdl)
        score += idf * numerator / denominator
        // max possible: tf = large, same term in doc at full weight
        maxScore += idf * (bm25K1 + 1)
    }

    if maxScore == 0 {
        return 0
    }
    normalized := score / maxScore
    if normalized > 1.0 {
        normalized = 1.0
    }
    return float32(normalized)
}

// Jaccard returns |A∩B| / |A∪B| for two token slices.
func (s *Scorer) Jaccard(a, b []string) float32 {
    if len(a) == 0 && len(b) == 0 {
        return 1.0
    }
    setA := toSet(a)
    setB := toSet(b)

    var inter int
    for t := range setA {
        if setB[t] {
            inter++
        }
    }
    union := len(setA) + len(setB) - inter
    if union == 0 {
        return 0
    }
    return float32(inter) / float32(union)
}

func toSet(tokens []string) map[string]bool {
    m := make(map[string]bool, len(tokens))
    for _, t := range tokens {
        m[t] = true
    }
    return m
}

// Tokenize splits normalized text into lowercase word tokens.
// Exported so semantic.go and scorer.go share one implementation.
func Tokenize(text string) []string {
    return strings.FieldsFunc(text, func(r rune) bool {
        return unicode.IsSpace(r) || unicode.IsPunct(r)
    })
}

// ensure sort is importable for future banding optimization
var _ = sort.Strings
```

**Step 4: Run — expect PASS**
```bash
go test ./internal/cache/... -run "TestJaccard|TestBM25|TestScore" -v
```
Expected: all PASS.

**Step 5: Commit**
```bash
git add internal/cache/scorer.go internal/cache/scorer_test.go
git commit -m "feat: add BM25+Jaccard scorer"
```

---

## Task 2: Update `Entry` — swap `SimHash` for `Tokens`

**Files:**
- Modify: `internal/cache/metadata.go`

**Step 1: Update `Entry` struct**

In `internal/cache/metadata.go`, find the `Entry` struct and replace:
```diff
- SimHash              uint64
+ Tokens               []string // normalized tokens for BM25+Jaccard scoring
```

Remove any import of unused packages if `SimHash` was the only user of `math/bits`.

**Step 2: Update `ScanAll`** (if it returns `SimHash` — check it doesn't). No change needed if Entry fields are just embedded.

**Step 3: Build**
```bash
go build ./...
```
Expected: compile errors in `semantic.go` (uses `SimHash` and `simhasher`) — intentional, fixed in Task 3.

**Step 4: Commit**
```bash
git add internal/cache/metadata.go
git commit -m "feat: replace SimHash uint64 with Tokens []string in Entry"
```

---

## Task 3: Update `SemanticCache` — wire Scorer, remove SimHasher

**Files:**
- Modify: `internal/cache/semantic.go`
- Delete: `internal/cache/simhash.go`

**Step 1: Update `SemanticCache` struct**

In `internal/cache/semantic.go`:
```diff
 type SemanticCache struct {
     cfg        Config
     normalizer *Normalizer
     compressor *Compressor
     store      *MetadataStore
-    simhasher  *SimHasher
+    scorer     *Scorer
     hits       atomic.Int64
     misses     atomic.Int64
     total      atomic.Int64
     nextID     atomic.Int64
 }
```

**Step 2: Update `New()`**
```diff
 func New(cfg Config) *SemanticCache {
     return &SemanticCache{
         cfg:        cfg,
         normalizer: NewNormalizer(),
         compressor: NewCompressor(),
         store:      NewMetadataStore(cfg.MaxElements),
-        simhasher:  NewSimHasher(),
+        scorer:     NewScorer(),
     }
 }
```

**Step 3: Update `Get()` slow path**

Replace the SimHash section with BM25+Jaccard:
```go
// ── Slow path: BM25 + Jaccard similarity scan ─────────────────────────────
queryTokens := Tokenize(normalized)
entries := c.store.ScanAll()

var bestEntry *Entry
var bestScore float32

for _, e := range entries {
    s := c.scorer.Score(queryTokens, e.Tokens)
    if s > bestScore {
        bestScore = s
        bestEntry = e
    }
}

if bestEntry != nil && bestScore >= threshold {
    if e := c.store.FindByHash(bestEntry.PromptHash); e != nil {
        resp, err := c.compressor.Decompress(e.CompressedResponse, e.OriginalResponseSize)
        if err == nil {
            c.hits.Add(1)
            return &GetResult{Response: resp, Similarity: bestScore, ExactMatch: false, CachedAt: e.CreatedAt}, true
        }
    }
}
```

Remove old imports: `"math/bits"` (if present in semantic.go).

**Step 4: Update `Set()` — populate `Tokens` and call `UpdateIDF`**
```diff
 func (c *SemanticCache) Set(_ context.Context, prompt, response string, ttl time.Duration) (string, error) {
     ...
     normalized := c.normalizer.Normalize(prompt)
     hash := c.normalizer.Hash(normalized)
-    simhash := c.simhasher.Hash(normalized)
+    tokens := Tokenize(normalized)

     compPrompt := c.compressor.Compress(prompt)
     compResp   := c.compressor.Compress(response)

     id  := fmt.Sprintf("%d", c.nextID.Add(1))
     now := time.Now()
     c.store.Set(hash, &Entry{
         ID:                   id,
         PromptHash:           hash,
-        SimHash:              simhash,
+        Tokens:               tokens,
         NormalizedPrompt:     normalized,
         CompressedPrompt:     compPrompt,
         CompressedResponse:   compResp,
         OriginalPromptSize:   len(prompt),
         OriginalResponseSize: len(response),
         CreatedAt:            now,
         LastAccessed:         now,
     }, ttl)
+    c.scorer.UpdateIDF(tokens)
     return id, nil
 }
```

**Step 5: Update `Delete()` — call `RemoveDoc`**
```diff
 func (c *SemanticCache) Delete(prompt string) bool {
     hash := c.normalizer.Hash(c.normalizer.Normalize(prompt))
+    if e := c.store.FindByHash(hash); e != nil {
+        c.scorer.RemoveDoc(e.Tokens)
+    }
     return c.store.Delete(hash)
 }
```

**Step 6: Delete `simhash.go`**
```bash
rm internal/cache/simhash.go
```

**Step 7: Build**
```bash
go build ./...
```
Expected: no errors.

**Step 8: Commit**
```bash
git add internal/cache/semantic.go
git rm internal/cache/simhash.go
git commit -m "feat: wire BM25+Jaccard scorer into SemanticCache, remove SimHasher"
```

---

## Task 4: Update tests + verify all pass

**Files:**
- Modify: `internal/cache/semantic_test.go`

**Step 1: Update `TestSemanticCache_SimHashSimilarityHit`**

The existing test uses word-order rearrangement. With BM25+Jaccard this still works (same tokens → score=1.0). However, the test name mentions SimHash — rename it and optionally add a paraphrase test:

```go
// Rename test
func TestSemanticCache_SimilarityHit_SameTokens(t *testing.T) {
    // Same tokens, different order → should still hit
    sc := newTestCache()
    ctx := context.Background()
    sc.Set(ctx, "go language fast compiled", "Cached response.", 0)
    result, ok := sc.Get(ctx, "compiled fast language go", 0.85)
    if !ok {
        t.Fatal("expected similarity hit for same-token rearrangement")
    }
    if result.ExactMatch {
        t.Error("different word order should not be an exact match")
    }
    if result.Similarity < 0.85 {
        t.Errorf("similarity %f should be >= 0.85", result.Similarity)
    }
}

// NEW: paraphrase test (BM25+Jaccard advantage over SimHash)
func TestSemanticCache_SimilarityHit_Paraphrase(t *testing.T) {
    sc := newTestCache()
    ctx := context.Background()
    // Store one entry
    sc.Set(ctx, "explain goroutines in go", "Goroutines are lightweight threads.", 0)
    // Paraphrase with different but overlapping tokens
    result, ok := sc.Get(ctx, "how do goroutines work in go", 0.5)
    if !ok {
        t.Fatal("expected paraphrase hit — goroutines+go in common")
    }
    if result.Response != "Goroutines are lightweight threads." {
        t.Errorf("wrong response: %q", result.Response)
    }
}
```

**Step 2: Run all cache tests**
```bash
go test ./internal/cache/... -v
```
Expected: all PASS. If `TestSemanticCache_SimHashMiss_Unrelated` fails, check threshold — unrelated prompts (zero token overlap) should score 0.

**Step 3: Run full test suite**
```bash
go test ./... -v
```
Expected: all PASS.

**Step 4: Commit**
```bash
git add internal/cache/semantic_test.go
git commit -m "test: update semantic tests for BM25+Jaccard, add paraphrase test"
```

---

## Task 5: Update Architecture docs

**Files:**
- Modify: `docs/ARCHITECTURE.md`

**Step 1: Update the Slow Path section**

Replace the SimHash algorithm section with BM25+Jaccard description. Key changes:
- Slow path header: `BM25 + Jaccard similarity scan`
- Algorithm section: replace Charikar SimHash with BM25+Jaccard formulas
- Data model: `SimHash uint64` → `Tokens []string`
- Scalability table: update latency numbers (×4-8 for slow path)

**Step 2: Commit**
```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: update ARCHITECTURE.md for BM25+Jaccard replacement"
```

---

## Verification Summary

Run in order:

```bash
# 1. Unit tests for scorer
go test ./internal/cache/... -run "TestJaccard|TestBM25|TestScore" -v

# 2. Full cache integration tests
go test ./internal/cache/... -v

# 3. Full suite
go test ./... -v

# 4. Build check  
go build ./cmd/server/

# 5. Smoke test (manual)
./bin/erion-ember &
curl -s -XPOST http://localhost:8080/v1/cache/set \
  -d '{"prompt":"explain goroutines in go","response":"Goroutines are lightweight concurrent functions."}' | jq
curl -s -XPOST http://localhost:8080/v1/cache/get \
  -d '{"prompt":"how goroutines work go","similarity_threshold":0.5}' | jq
# Expected: {"hit":true,"response":"Goroutines are lightweight concurrent functions.","similarity":...,"exact_match":false}
```
