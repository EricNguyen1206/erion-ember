package cache_test

import (
	"strings"
	"testing"

	"github.com/EricNguyen1206/erion-ember/internal/cache"
)

func TestCompressRoundtrip(t *testing.T) {
	c := cache.NewCompressor()
	original := "The quick brown fox jumps over the lazy dog."
	got, err := c.Decompress(c.Compress(original), len(original))
	if err != nil {
		t.Fatal(err)
	}
	if got != original {
		t.Errorf("roundtrip failed: got %q", got)
	}
}

func TestCompressEmpty(t *testing.T) {
	c := cache.NewCompressor()
	got, err := c.Decompress(c.Compress(""), 0)
	if err != nil {
		t.Fatal(err)
	}
	if got != "" {
		t.Errorf("expected empty, got %q", got)
	}
}

func TestCompressRepeated(t *testing.T) {
	c := cache.NewCompressor()
	text := strings.Repeat("hello world semantic cache ", 100)
	got, err := c.Decompress(c.Compress(text), len(text))
	if err != nil {
		t.Fatal(err)
	}
	if got != text {
		t.Error("roundtrip failed for repeated text")
	}
}

func BenchmarkCompressor_Compress(b *testing.B) {
	c := cache.NewCompressor()
	text := strings.Repeat("This is a moderately long string that will be compressed using LZ4. It contains some repetitive patterns to see how well it scales. ", 50)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = c.Compress(text)
	}
}

func BenchmarkCompressor_Decompress(b *testing.B) {
	c := cache.NewCompressor()
	text := strings.Repeat("This is a moderately long string that will be compressed using LZ4. It contains some repetitive patterns to see how well it scales. ", 50)
	compressed := c.Compress(text)
	originalLen := len(text)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = c.Decompress(compressed, originalLen)
	}
}
