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
	// No docs registered → score >= 0
	got := s.BM25(q, d)
	if got < 0 {
		t.Errorf("BM25 should be >= 0, got %f", got)
	}
}

func TestBM25HighForRareTerms(t *testing.T) {
	s := cache.NewScorer()
	// Register 10 docs, only 1 contains "goroutine"
	common := []string{"go", "language"}
	rare := []string{"goroutine", "channel"}
	for i := 0; i < 9; i++ {
		s.UpdateIDF(common)
	}
	s.UpdateIDF(rare)

	scoreRare := s.BM25([]string{"goroutine"}, rare)
	scoreCommon := s.BM25([]string{"go"}, common)
	if scoreRare <= scoreCommon {
		t.Errorf("rare term should score higher: rare=%f common=%f", scoreRare, scoreCommon)
	}
}

func TestScoreSameTokensHigh(t *testing.T) {
	s := cache.NewScorer()
	toks := []string{"what", "is", "golang"}
	s.UpdateIDF(toks)
	// With a single-doc corpus every term has df=n=1 → IDF is low → BM25 contribution modest.
	// Jaccard = 1.0 for identical sets, so combined score ≥ 0.4 (jaccW) + BM25 contribution.
	// We verify the lower bound that identical tokens always score above 0.6.
	got := s.Score(toks, toks)
	if got < 0.6 {
		t.Errorf("identical tokens: want >=0.6 score, got %f", got)
	}
}

// TestScoreParaphraseHigherThanUnrelated verifies that BM25+Jaccard discriminates:
// a paraphrase (overlapping tokens) must score higher than an unrelated doc.
func TestScoreParaphraseHigherThanUnrelated(t *testing.T) {
	s := cache.NewScorer()
	query := []string{"explain", "goroutines", "go"}
	paraphrase := []string{"goroutines", "go", "concurrency"}  // 2 tokens in common
	unrelated := []string{"docker", "kubernetes", "container"} // 0 tokens in common
	s.UpdateIDF(query)
	s.UpdateIDF(paraphrase)
	s.UpdateIDF(unrelated)

	scoreParaphrase := s.Score(query, paraphrase)
	scoreUnrelated := s.Score(query, unrelated)
	if scoreParaphrase <= scoreUnrelated {
		t.Errorf("paraphrase (%f) should score higher than unrelated (%f)", scoreParaphrase, scoreUnrelated)
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

func BenchmarkScorer_Score(b *testing.B) {
	s := cache.NewScorer()
	query := []string{"explain", "goroutines", "go", "concurrency", "performance"}
	doc := []string{"goroutines", "go", "lightweight", "threads", "managed", "by", "runtime"}
	s.UpdateIDF(doc)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = s.Score(query, doc)
	}
}

func BenchmarkScorer_UpdateIDF(b *testing.B) {
	s := cache.NewScorer()
	tokens := []string{"this", "is", "a", "list", "of", "tokens", "to", "update", "idf"}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		s.UpdateIDF(tokens)
	}
}
