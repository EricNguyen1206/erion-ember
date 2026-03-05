package embedding

import "context"

// FixedEmbedder always returns the same pre-set vector.
// Use in tests to simulate semantic similarity without needing ONNX:
//   - Set a prompt using embedder that returns vecA
//   - Later Get a DIFFERENT prompt using the same embedder → returns vecA → semantic HIT
type FixedEmbedder struct {
	dim int
	vec []float32
}

func NewFixedEmbedder(vec []float32) Embedder {
	return &FixedEmbedder{dim: len(vec), vec: vec}
}

func (f *FixedEmbedder) Embed(_ context.Context, _ string) ([]float32, error) {
	out := make([]float32, len(f.vec))
	copy(out, f.vec)
	return out, nil
}
func (f *FixedEmbedder) Dim() int { return f.dim }
