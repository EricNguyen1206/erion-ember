package cache

import (
	"math"
	"strings"
	"sync"
	"unicode"
)

const (
	bm25K1 = 1.2
	bm25B  = 0.75
	bm25W  = 0.6 // weight for BM25 in combined score
	jaccW  = 0.4 // weight for Jaccard in combined score
)

// Scorer computes BM25 + Jaccard hybrid similarity between token slices.
// It maintains incremental IDF state updated on every Set/Delete.
type Scorer struct {
	mu    sync.RWMutex
	df    map[string]int // document frequency per term
	n     int            // total number of documents
	sumDL int            // sum of all document lengths (in tokens)
}

// NewScorer creates a new Scorer.
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

// Score returns a combined [0,1] similarity: 0.6×BM25_normalized + 0.4×Jaccard.
func (s *Scorer) Score(query, doc []string) float32 {
	return float32(bm25W)*s.bm25Normalized(query, doc) + float32(jaccW)*s.Jaccard(query, doc)
}

// BM25 returns a raw IDF-weighted BM25 score (not normalized to [0,1]).
// Higher = more relevant. Rare terms (high IDF) naturally score higher than common ones.
// Use Score() for a bounded [0,1] metric suitable for threshold comparison.
func (s *Scorer) BM25(query, doc []string) float32 {
	s.mu.RLock()
	n := s.n
	sumDL := s.sumDL
	df := s.df
	s.mu.RUnlock()

	if n == 0 || len(doc) == 0 || len(query) == 0 {
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
	for _, t := range query {
		docFreq := df[t]
		idf := math.Log((float64(n-docFreq)+0.5)/(float64(docFreq)+0.5) + 1.0)
		if idf < 0 {
			idf = 0
		}
		termTF := float64(tf[t])
		if termTF == 0 {
			continue // term not in doc → zero contribution
		}
		numerator := termTF * (bm25K1 + 1)
		denominator := termTF + bm25K1*(1-bm25B+bm25B*docLen/avgdl)
		score += idf * numerator / denominator
	}

	return float32(score)
}

// bm25Normalized returns BM25 score normalized to [0,1].
// Denominator = sum of max possible per-term BM25 (IDF × (k1+1), achieved when TF→∞).
func (s *Scorer) bm25Normalized(query, doc []string) float32 {
	s.mu.RLock()
	n := s.n
	df := s.df
	s.mu.RUnlock()

	raw := float64(s.BM25(query, doc))

	var maxScore float64
	for _, t := range query {
		docFreq := df[t]
		idf := math.Log((float64(n-docFreq)+0.5)/(float64(docFreq)+0.5) + 1.0)
		if idf < 0 {
			idf = 0
		}
		maxScore += idf * (bm25K1 + 1)
	}

	if maxScore == 0 {
		return 0
	}
	normalized := raw / maxScore
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
// Exported so SemanticCache and Scorer share one implementation.
func Tokenize(text string) []string {
	return strings.FieldsFunc(text, func(r rune) bool {
		return unicode.IsSpace(r) || unicode.IsPunct(r)
	})
}
