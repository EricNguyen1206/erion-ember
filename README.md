# 🚀 Erion Ember

LLM Semantic Cache with K6 Benchmarking - Production-ready solution for caching LLM responses with semantic similarity matching.

## Overview

Erion Ember provides a high-performance semantic caching layer for LLM applications, reducing costs and latency by serving cached responses for semantically similar queries.

## Features

- ✅ **Bun Runtime**: Blazing fast JavaScript runtime
- ✅ **Fastify HTTP API**: High-performance web framework
- ✅ **Semantic Caching**: Intelligent cache with similarity matching
- ✅ **K6 Benchmarking**: Professional load testing suite
- ✅ **Docker Ready**: Containerized deployment with profiles
- ✅ **Monitoring**: Optional Grafana + InfluxDB integration

## Project Structure

```
erion-ember/
├── core/                           # Bun + Fastify HTTP API + Semantic Cache
│   ├── src/
│   │   ├── cache/              # Semantic cache implementation
│   │   ├── routes/            # API endpoints
│   │   └── server.js          # Fastify server
│   ├── tests/                 # Unit tests
│   ├── Dockerfile
│   └── README.md
├── benchmark/                      # K6 load testing suite
│   ├── k6/
│   │   ├── smoke-test.js      # Quick validation
│   │   ├── load-test.js       # Normal load
│   │   ├── stress-test.js     # Breaking point
│   │   └── soak-test.js      # Memory leak detection
│   └── grafana/              # Dashboard config
├── services/
│   ├── mini-redis-core/       # Redis-compatible server
│   └── semantic-cache/       # Legacy semantic cache
├── docker-compose.yml              # Orchestration with profiles
└── package.json                   # Root workspace
```

## Quick Start

### Prerequisites

- Bun runtime (v1.0+)
- Docker & Docker Compose v2.20+
- K6 CLI (optional, for local testing)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/erion-ember.git
cd erion-ember

# Install dependencies
bun install
```

### Running the Services

#### Option 1: Core + Redis only

```bash
# Start core service and Redis
docker compose up core redis

# Or with npm script
npm run docker:core
```

#### Option 2: Core + Benchmark

```bash
# Start core, redis, and K6 benchmark
docker compose --profile benchmark up

# Or with npm script
npm run benchmark
```

#### Option 3: Full Stack (with Monitoring)

```bash
# Start all services including Grafana + InfluxDB
docker compose --profile benchmark --profile monitoring up
```

### Local Development

```bash
# Development mode with hot reload
npm run dev

# Run tests
npm test

# Build
npm run build
```

## API Documentation

### POST /v1/chat

Chat with semantic caching.

**Request:**
```json
{
  "prompt": "What is machine learning?",
  "model": "llama3.2"
}
```

**Response (cached):**
```json
{
  "response": "Machine learning is a subset of AI...",
  "cached": true,
  "similarity": 1.0,
  "model": "llama3.2",
  "timestamp": "2026-01-31T22:00:00.000Z"
}
```

**Response (not cached):**
```json
{
  "response": "Generated response for: What is machine learning?",
  "cached": false,
  "model": "llama3.2",
  "timestamp": "2026-01-31T22:00:00.000Z"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-31T22:00:00.000Z"
}
```

## Benchmarking

### Quick Benchmark

```bash
# Run smoke test locally
npm run benchmark:local

# Or with K6 directly
cd benchmark
k6 run k6/smoke-test.js
```

### Test Types

| Test | Virtual Users | Duration | Purpose |
|------|--------------|----------|---------|
| **smoke-test.js** | 10 VU | 30s | Quick validation |
| **load-test.js** | 200 VU | 16m | Normal load testing |
| **stress-test.js** | 500 VU | 12m | Find breaking point |
| **soak-test.js** | 50 VU | 70m | Memory leak detection |

### Metrics Collected

- **Throughput**: Requests per second (RPS)
- **Latency**: p50, p95, p99 percentiles
- **Cache Hit Rate**: Percentage of cache hits
- **Token Savings**: Estimated tokens saved
- **Error Rate**: Percentage of failed requests

### Dashboard

Access Grafana dashboard at http://localhost:3001 (when using --profile monitoring)

**Default credentials:**
- Username: `admin`
- Password: `admin`

## Docker Compose Profiles

```bash
# Core services only
docker compose up core redis

# With benchmark
docker compose --profile benchmark up

# With monitoring
docker compose --profile monitoring up

# Full stack
docker compose --profile benchmark --profile monitoring up

# Legacy Mini-Redis
docker compose --profile legacy up
```

## Mini-Redis (Legacy)

The project also includes a Redis-compatible server implementation.

```bash
# Start Mini-Redis with RedisInsight
docker compose --profile legacy --profile insight up

# Run MemTier benchmark
docker compose --profile benchmark up

# Access RedisInsight
open http://localhost:8080
```

For detailed Mini-Redis documentation, see [services/mini-redis-core/README.md](services/mini-redis-core/README.md).

## Development

### Project Workspaces

This project uses npm workspaces:

```json
{
  "workspaces": ["core", "benchmark"]
}
```

### Adding New Features

1. **Core Service**: Add endpoints in `core/src/routes/`
2. **Benchmark**: Add test scenarios in `benchmark/k6/`
3. **Tests**: Write unit tests in `core/tests/`

### Testing

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage
```

## Environment Variables

### Core Service

- `PORT`: Server port (default: 3000)
- `REDIS_URL`: Redis connection URL
- `OLLAMA_URL`: Ollama API URL (default: `http://host.docker.internal:11434`)
- `NODE_ENV`: Environment (development/production)

### Benchmark

- `CORE_URL`: HTTP endpoint for core (default: `http://localhost:3000`)
- `K6_OUT`: Output format (default: `json`)

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Bun](https://bun.sh/)
- Powered by [Fastify](https://fastify.io/)
- Benchmarked with [K6](https://k6.io/)
- Monitored with [Grafana](https://grafana.com/)
