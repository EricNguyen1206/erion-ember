# Changelog

All notable changes to Erion Ember will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] - 2026-03-06

### Overview
Complete rewrite from TypeScript/Bun/MCP to a standalone Go service. The service is now deployable like Redis — a single binary with a REST API. Semantic similarity is handled by pure-Go SimHash (Charikar locality-sensitive hashing), requiring **zero model files, zero CGO, and zero external services**.

### Added

#### Core Engine
- **SimHash semantic similarity** (`internal/cache/simhash.go`) — pure-Go Charikar 64-bit fingerprinting. Similar prompts produce fingerprints with small Hamming distance; threshold configurable via `CACHE_SIMILARITY_THRESHOLD`.
- **Two-tier cache lookup**: fast path (xxhash exact match, O(1), ~0µs) + slow path (SimHash Hamming scan, O(n), ~Nµs).
- **LRU metadata store** (`internal/cache/metadata.go`) — thread-safe, doubly-linked list, optional TTL, `ScanAll()` for SimHash search.
- **LZ4 compressor** (`internal/cache/compressor.go`) — transparent compress/decompress with prefix byte.
- **Text normalizer** (`internal/cache/normalizer.go`) — lowercase + collapse whitespace + xxhash (v2).

#### REST API (`internal/server/http.go`)
- `POST /v1/cache/get` — lookup with similarity threshold
- `POST /v1/cache/set` — store prompt/response pair with optional TTL
- `POST /v1/cache/delete` — delete by prompt
- `GET /v1/stats` — hits, misses, hit rate, total entries
- `GET /health` — liveness probe

#### Infrastructure
- `cmd/server/main.go` — single binary, graceful shutdown on SIGTERM/SIGINT
- `Makefile` — `build`, `test`, `test-race`, `run`, `clean`
- `Dockerfile` — multi-stage Alpine build, `CGO_ENABLED=0`, ~20MB image
- `docker-compose.yml` — single service, no external dependencies
- `scripts/test-docker.sh` — curl-based integration test (9 assertions)
- `.github/workflows/core-tests.yml` — Go test + Docker build CI

### Removed
- All TypeScript/Bun/Node.js source code
- MCP protocol handling (`@modelcontextprotocol/sdk`)
- HTTP API frameworks (Fastify)
- Vector backends: Annoy.js, HNSW (hnswlib), Qdrant, Turso
- Embedding services: OpenAI, hugot (ONNX Runtime), Ollama HTTP
- `proto/` directory (gRPC replaced by plain REST)
- `k6-benchmark.yml` workflow
- CGO requirement — binary is fully static

### Changed
- **Language**: TypeScript → Go 1.23
- **Similarity engine**: Neural embeddings (float32 vectors) → SimHash (uint64 fingerprints)
- **Docker image size**: ~500MB (Debian + ONNX) → ~20MB (Alpine, static binary)
- **Startup time**: ~500ms → <50ms
- **External dependencies at runtime**: Multiple services → **None**

### Performance (v3 vs v2)

| Metric | v2 (TypeScript + HNSW) | v3 (Go + SimHash) |
|--------|------------------------|-------------------|
| Exact match latency | ~1–2ms | ~0.1µs |
| Similarity latency (10K entries) | ~0.5–1ms | ~50µs |
| Memory per 100K entries | ~200MB | ~50MB |
| Docker image size | ~500MB | ~20MB |
| External services required | 1+ | **None** |

---

## [2.1.0] - 2026-02-12

### Fixed
- **Embedding Fallback** — `cache_store` no longer stores zero vectors on embedding failure
- **LRU Cache** — MetadataStore refactored from O(n) array to O(1) doubly-linked list

### Changed
- **Hashing** — Replaced `crypto.sha256` with `xxhash-addon` (10x faster)
- **Compressor** — Removed unused `compressionLevel` variable
- **Quantizer** — Simplified constructor

---

## [2.0.0] - 2026-02-09

### Overview
TypeScript/Bun rewrite. MCP protocol. Dual vector search (Annoy.js default, HNSW optimised). Provider-agnostic: Claude, OpenAI, Groq.

### Added
- MCP Server (`@modelcontextprotocol/sdk`) with 5 tools: `ai_complete`, `cache_store`, `cache_check`, `generate_embedding`, `cache_stats`
- Annoy.js backend (pure JS, zero native deps)
- HNSW backend (C++ via hnswlib-node)
- Qdrant Cloud and Turso backends
- Mock and OpenAI embedding providers

### Removed
- Fastify HTTP server / REST endpoints
- Groq service integration
- K6/Grafana benchmarking stack

---

## [1.0.0] - 2026-02-08

Initial production release. Fastify HTTP server, HNSW vector search, Groq API, LZ4 compression, rate limiting, Docker support.

---

## [0.1.0] - 2026-01-15

Initial project structure.

---

[Unreleased]: https://github.com/EricNguyen1206/erion-ember/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/EricNguyen1206/erion-ember/compare/v2.1.0...v3.0.0
[2.1.0]: https://github.com/EricNguyen1206/erion-ember/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/EricNguyen1206/erion-ember/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/EricNguyen1206/erion-ember/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/EricNguyen1206/erion-ember/releases/tag/v0.1.0
