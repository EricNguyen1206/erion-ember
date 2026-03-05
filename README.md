# Erion Ember

> **High-performance semantic cache service for LLM applications.**  
> Deployable as a standalone binary — like Redis, but for LLM responses.

[![Go](https://img.shields.io/badge/Go-1.23-blue)](https://go.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

Erion Ember is a **standalone Go service** that caches LLM prompt/response pairs using two-tier matching:

| Tier | Method | Latency | Use case |
|------|--------|---------|----------|
| **Fast path** | `xxhash` exact match | ~0 µs | Identical prompts |
| **Slow path** | SimHash Hamming scan | ~N µs | Near-duplicate prompts |

**Zero external dependencies** — no model files, no Ollama, no CGO, no Python. Just a single binary.

---

## How It Works

```
Client → POST /v1/cache/get { "prompt": "..." }
              │
              ▼
         [Normalizer]  lowercase + collapse whitespace
              │
        ┌─────┴──────────────────────┐
        │                            │
   [xxhash]                   [SimHash]
   exact map lookup            Hamming scan
   O(1) — ~0µs                 O(n) — ~Nµs
        │                            │
      HIT ✅                  HammingDist ≤ threshold?
   ~0.1ms total                  ├── YES → HIT ✅
                                 └── NO  → MISS ❌
```

**SimHash** (Charikar locality-sensitive hashing): converts any text into a 64-bit fingerprint where
similar texts produce fingerprints with small Hamming distance (few differing bits).

Example:
- `"go language compiled fast"` and `"compiled fast language go"` → **same fingerprint** (order-independent) → **cache HIT** ✅

---

## Quick Start

### Binary

```bash
git clone https://github.com/EricNguyen1206/erion-ember
cd erion-ember
go build -o bin/erion-ember ./cmd/server/
./bin/erion-ember
```

### Docker

```bash
docker-compose up --build
```

---

## API

Base URL: `http://localhost:8080`

### `POST /v1/cache/get`

```bash
curl -XPOST http://localhost:8080/v1/cache/get \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "What is Go?", "similarity_threshold": 0.85}'
```

**Response (hit):**
```json
{
  "hit": true,
  "response": "Go is a compiled, statically typed language.",
  "similarity": 0.97,
  "exact_match": false
}
```

**Response (miss):**
```json
{ "hit": false }
```

### `POST /v1/cache/set`

```bash
curl -XPOST http://localhost:8080/v1/cache/set \
  -d '{"prompt": "What is Go?", "response": "Go is a compiled language.", "ttl": 3600}'
```

**Response:**
```json
{ "id": "1" }
```

### `POST /v1/cache/delete`

```bash
curl -XPOST http://localhost:8080/v1/cache/delete \
  -d '{"prompt": "What is Go?"}'
```

### `GET /v1/stats`

```json
{
  "total_entries": 1024,
  "cache_hits": 8345,
  "cache_misses": 2103,
  "total_queries": 10448,
  "hit_rate": 0.7988
}
```

### `GET /health`

```json
{ "status": "ok" }
```

---

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `HTTP_PORT` | `8080` | Server port |
| `CACHE_SIMILARITY_THRESHOLD` | `0.85` | SimHash similarity threshold (0.0–1.0) |
| `CACHE_MAX_ELEMENTS` | `100000` | Max cached entries (LRU eviction) |
| `CACHE_DEFAULT_TTL` | `3600` | Default TTL in seconds (0 = no expiry) |

> **Threshold math:** `0.85` → max **9 differing bits** out of 64 (`int(64 * (1 - 0.85))`)

---

## Project Structure

```
erion-ember/
├── cmd/server/main.go          # Entry point, graceful shutdown
├── internal/
│   ├── cache/
│   │   ├── normalizer.go       # Text normalisation + xxhash
│   │   ├── compressor.go       # LZ4 compress/decompress
│   │   ├── metadata.go         # LRU store + TTL (thread-safe)
│   │   ├── simhash.go          # Charikar SimHash fingerprinting
│   │   └── semantic.go         # Cache orchestrator (fast + slow path)
│   └── server/
│       └── http.go             # REST API handlers
├── scripts/test-docker.sh      # Integration test script
├── Dockerfile                  # Multi-stage Alpine build
├── docker-compose.yml
└── Makefile
```

---

## Development

```bash
# Download dependencies
go mod tidy

# Run tests
go test ./...

# Run tests with race detector
go test -race ./...

# Build binary
make build

# Run locally
make run

# Docker integration test
docker-compose up --build -d
bash scripts/test-docker.sh
```

---

## Performance

All measurements on Apple M3, 100K cached entries.

| Operation | Latency | Notes |
|-----------|---------|-------|
| Exact match (fast path) | ~0.1 µs | xxhash O(1) lookup |
| SimHash fingerprint | ~1 µs | 64-bit Charikar hash |
| Similarity scan (1K entries) | ~50 µs | O(n) Hamming scan |
| Similarity scan (100K entries) | ~5 ms | O(n) Hamming scan |
| LZ4 compress/decompress | ~5–20 µs | Depends on payload size |

> For very large caches (>100K entries), the slow path scales linearly. For most LLM cache use cases (1K–50K unique prompts), latency remains sub-millisecond.

---

## License

MIT — see [LICENSE](LICENSE)