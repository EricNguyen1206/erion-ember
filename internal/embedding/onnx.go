package embedding

import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/knights-analytics/hugot"
	"github.com/knights-analytics/hugot/pipelines"
)

// ONNXEmbedder loads a HuggingFace sentence-transformer model via ONNX Runtime.
// Requires MODEL_DIR to contain a model downloaded by hugot or manually placed.
//
// Recommended model: all-MiniLM-L6-v2 (384-dim, ~22MB)
// Download: hugot.DownloadModel("sentence-transformers/all-MiniLM-L6-v2", modelDir, ...)
type ONNXEmbedder struct {
	session  *hugot.Session
	pipeline *pipelines.FeatureExtractionPipeline
	dim      int
}

// NewONNXEmbedder initialises a hugot pipeline from modelDir.
// modelDir should contain model.onnx and tokenizer.json.
func NewONNXEmbedder(modelDir string) (*ONNXEmbedder, error) {
	session, err := hugot.NewSession(
		hugot.WithOnnxLibraryPath(""), // uses bundled ONNX Runtime
		hugot.WithTelemetry(false),
	)
	if err != nil {
		return nil, fmt.Errorf("hugot session: %w", err)
	}

	pipelineCfg := hugot.FeatureExtractionConfig{
		ModelPath:    filepath.Clean(modelDir),
		Name:         "embedder",
		OnnxFilename: "model.onnx",
	}
	pipe, err := hugot.NewPipeline[pipelines.FeatureExtractionPipeline](session, pipelineCfg)
	if err != nil {
		session.Destroy()
		return nil, fmt.Errorf("hugot pipeline: %w", err)
	}

	// Detect dimension from a probe embedding.
	probe, err := pipe.RunPipeline([]string{"probe"})
	if err != nil || len(probe.Embeddings) == 0 || len(probe.Embeddings[0]) == 0 {
		session.Destroy()
		return nil, fmt.Errorf("hugot probe failed: %w", err)
	}
	dim := len(probe.Embeddings[0])

	return &ONNXEmbedder{session: session, pipeline: pipe, dim: dim}, nil
}

// Embed generates a mean-pooled, L2-normalised embedding for text.
func (e *ONNXEmbedder) Embed(_ context.Context, text string) ([]float32, error) {
	result, err := e.pipeline.RunPipeline([]string{text})
	if err != nil {
		return nil, fmt.Errorf("hugot embed: %w", err)
	}
	if len(result.Embeddings) == 0 {
		return nil, fmt.Errorf("hugot: empty result")
	}
	return result.Embeddings[0], nil
}

func (e *ONNXEmbedder) Dim() int { return e.dim }

// Close releases the ONNX session.
func (e *ONNXEmbedder) Close() error {
	if e.session != nil {
		return e.session.Destroy()
	}
	return nil
}
