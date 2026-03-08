# Erion Ember Benchmarks

This document provides detailed performance benchmarks for the Erion Ember Go implementation. Erion Ember is designed for extreme speed and low overhead by avoiding heavy embedding models and CGO.

## Component Latency

Measured on an Apple M1 machine using `go test -bench`.

| Component | Operation | Latency (avg) |
|-----------|-----------|---------------|
| **Normalizer** | Normalize + Hash | 0.6 µs |
| **Compressor** | LZ4 Compress | 1.9 µs |
| **Compressor** | LZ4 Decompress | 1.1 µs |
| **Scorer** | BM25+Jaccard Match | 0.6 µs / doc |
| **Scorer** | Incremental IDF Update | 0.4 µs |

## End-to-End Latency

The latency of `Get` depends on whether it's an exact match (fast path) or requires a semantic scan (slow path).

| Dataset Size (N) | Exact Hit (Fast Path) | Semantic Hit (Slow Path) |
|------------------|-----------------------|--------------------------|
| 1,000            | < 1 µs                | ~0.6 ms                  |
| 10,000           | < 1 µs                | ~6.0 ms                  |
| 50,000           | < 1 µs                | ~30.0 ms                 |
| 100,000          | < 1 µs                | ~60.0 ms                 |

> [!NOTE]
> Semantic hits perform an $O(N)$ scan over all cached tokens. For larger datasets (>100k), we recommend lowering the threshold or using sharding to maintain sub-100ms latency.

## Memory Usage

Erion Ember minimizes memory footprint by storing tokens and compressed responses.

| Component | Est. Overhead per Entry |
|-----------|-------------------------|
| **Metadata** | ~200 - 400 bytes |
| **Tokens** | ~10 bytes / token |
| **Response** | Variable (LZ4 compressed) |

*A cache with 100,000 entries typically consumes between **40MB and 100MB** of RAM (excluding response data).*

## Throughput (Operations/Sec)

| Backend | Set (Store + Index) | Get (Exact Hit) | Get (Semantic 1k sets) |
|---------|---------------------|-----------------|-------------------------|
| **Go (Core)** | ~720,000 ops/s | ~3,000,000 ops/s | ~1,600 ops/s |

## Methodology

- **Similarity**: Hybrid BM25 (token-based relevance) + Jaccard (token overlap).
- **Compression**: LZ4 (Fastest compression with reasonable ratios).
- **Hashing**: XXHash (Non-cryptographic, high-speed collision-resistant hashing).
- **Environment**: Go 1.22+, tests run on Apple M1.

---
*Last updated: March 2026*
