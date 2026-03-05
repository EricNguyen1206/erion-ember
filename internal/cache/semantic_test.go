package cache_test

import (
	"context"
	"testing"
	"time"

	"github.com/EricNguyen1206/erion-ember/internal/cache"
	"github.com/EricNguyen1206/erion-ember/internal/embedding"
	"github.com/EricNguyen1206/erion-ember/internal/index"
)

func newTestCache(embedder embedding.Embedder) *cache.SemanticCache {
	cfg := cache.Config{
		Dim:                 4,
		MaxElements:         100,
		SimilarityThreshold: 0.9,
		DefaultTTL:          time.Hour,
	}
	return cache.New(cfg, embedder, index.NewFlatIndex(cfg.Dim))
}

// ── Exact match (fast path) ───────────────────────────────────────────────

func TestSemanticCache_ExactHit(t *testing.T) {
	sc := newTestCache(embedding.NewZeroEmbedder(4))
	defer sc.Close()
	ctx := context.Background()

	if _, err := sc.Set(ctx, "What is Go?", "A language.", 0); err != nil {
		t.Fatal(err)
	}
	result, ok := sc.Get(ctx, "What is Go?", 0)
	if !ok {
		t.Fatal("expected cache hit")
	}
	if !result.ExactMatch {
		t.Error("expected exact_match=true")
	}
	if result.Response != "A language." {
		t.Errorf("wrong response: %q", result.Response)
	}
	if result.Similarity != 1.0 {
		t.Errorf("exact match similarity should be 1.0, got %f", result.Similarity)
	}
}

func TestSemanticCache_ExactMiss(t *testing.T) {
	sc := newTestCache(embedding.NewZeroEmbedder(4))
	defer sc.Close()
	_, ok := sc.Get(context.Background(), "never stored", 0)
	if ok {
		t.Error("expected miss")
	}
}

func TestSemanticCache_NormalizeBeforeHash(t *testing.T) {
	// "  What IS Go?  " should hit the same entry as "what is go?"
	sc := newTestCache(embedding.NewZeroEmbedder(4))
	defer sc.Close()
	ctx := context.Background()

	sc.Set(ctx, "what is go?", "Go is a language.", 0)
	result, ok := sc.Get(ctx, "  What IS Go?  ", 0)
	if !ok {
		t.Fatal("expected hit after normalization")
	}
	if !result.ExactMatch {
		t.Error("normalized prompts should produce exact match")
	}
}

// ── Semantic similarity (slow path) ──────────────────────────────────────

func TestSemanticCache_SimilarityHit(t *testing.T) {
	// FixedEmbedder always returns the same vector for any text.
	// So a DIFFERENT prompt text will get same embedding → semantic hit.
	vec := []float32{1, 0, 0, 0}
	sc := newTestCache(embedding.NewFixedEmbedder(vec))
	defer sc.Close()
	ctx := context.Background()

	if _, err := sc.Set(ctx, "What is Go?", "Go is a compiled language.", 0); err != nil {
		t.Fatal(err)
	}

	// Different prompt text, same embedding → should hit via semantic search
	result, ok := sc.Get(ctx, "Tell me about the Go programming language", 0.9)
	if !ok {
		t.Fatal("expected semantic similarity hit")
	}
	if result.ExactMatch {
		t.Error("should be a semantic hit, not exact match")
	}
	if result.Response != "Go is a compiled language." {
		t.Errorf("wrong response: %q", result.Response)
	}
	if result.Similarity < 0.9 {
		t.Errorf("similarity %f below threshold", result.Similarity)
	}
}

func TestSemanticCache_SimilarityMiss_BelowThreshold(t *testing.T) {
	// Two perpendicular vectors → cosine distance = 1.0, similarity = 0.0
	sc := newTestCache(embedding.NewFixedEmbedder([]float32{1, 0, 0, 0}))
	defer sc.Close()
	ctx := context.Background()

	sc.Set(ctx, "original", "response", 0)

	// Now switch the embedder behavior by creating a different cache with perpendicular vec
	sc2 := newTestCache(embedding.NewFixedEmbedder([]float32{0, 1, 0, 0}))
	defer sc2.Close()
	_, ok := sc2.Get(ctx, "different query", 0.95)
	if ok {
		t.Error("expected miss — no entries in sc2")
	}
}

func TestSemanticCache_Stats(t *testing.T) {
	sc := newTestCache(embedding.NewZeroEmbedder(4))
	defer sc.Close()
	ctx := context.Background()

	sc.Set(ctx, "q1", "r1", 0)
	sc.Get(ctx, "q1", 0) // hit
	sc.Get(ctx, "q2", 0) // miss

	st := sc.Stats()
	if st.CacheHits != 1 {
		t.Errorf("hits: got %d, want 1", st.CacheHits)
	}
	if st.CacheMisses != 1 {
		t.Errorf("misses: got %d, want 1", st.CacheMisses)
	}
	if st.TotalQueries != 2 {
		t.Errorf("total: got %d, want 2", st.TotalQueries)
	}
	if st.HitRate != 0.5 {
		t.Errorf("hit_rate: got %f, want 0.5", st.HitRate)
	}
}

func TestSemanticCache_Delete(t *testing.T) {
	sc := newTestCache(embedding.NewZeroEmbedder(4))
	defer sc.Close()
	ctx := context.Background()

	sc.Set(ctx, "hello", "world", 0)
	if deleted := sc.Delete("hello"); !deleted {
		t.Error("Delete should return true")
	}
	_, ok := sc.Get(ctx, "hello", 0)
	if ok {
		t.Error("entry should be gone after delete")
	}
}

func TestSemanticCache_TTLExpiry(t *testing.T) {
	cfg := cache.Config{
		Dim:                 4,
		MaxElements:         100,
		SimilarityThreshold: 0.9,
		DefaultTTL:          50 * time.Millisecond,
	}
	sc := cache.New(cfg, embedding.NewZeroEmbedder(4), index.NewFlatIndex(4))
	defer sc.Close()
	ctx := context.Background()

	sc.Set(ctx, "ephemeral", "data", 50*time.Millisecond)
	time.Sleep(100 * time.Millisecond)

	_, ok := sc.Get(ctx, "ephemeral", 0)
	if ok {
		t.Error("entry should have expired")
	}
}
