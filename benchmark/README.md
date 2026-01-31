# K6 Benchmark Suite

Professional load testing for LLM Semantic Cache using K6.

## Quick Start

```bash
# Run all services + benchmark
docker compose --profile benchmark up

# Or run specific test locally
k6 run k6/smoke-test.js
```

## Test Types

- **smoke-test.js**: Quick validation (10 VU, 30s)
  - Fast feedback during development
  - Validates basic functionality

- **load-test.js**: Normal load (200 VU, 16m)
  - Simulates typical production traffic
  - Tests performance under normal conditions

- **stress-test.js**: Breaking point (500 VU, 12m)
  - Finds system limits
  - Tests graceful degradation

- **soak-test.js**: Memory leak detection (50 VU, 70m)
  - Long-running test
  - Detects memory leaks and performance degradation over time

## Metrics

K6 collects the following metrics:

- **Throughput**: Requests per second (RPS)
- **Latency**: p50, p95, p99 percentiles
- **Cache Hit Rate**: Percentage of cache hits
- **Token Savings**: Estimated tokens saved by caching
- **Error Rate**: Percentage of failed requests

## Workload Data

The benchmark uses realistic workload data from `k6/lib/data.js`:

- **RAG Queries**: Questions about technical topics
- **Classification**: Text categorization tasks
- **Code Generation**: Programming prompts

## Configuration

### Environment Variables

- `CORE_URL`: HTTP endpoint for the core service (default: `http://localhost:3000`)
- `K6_OUT`: Output format (default: `json`)

### Docker Compose Profiles

```bash
# Core only
docker compose up core redis

# With benchmark
docker compose --profile benchmark up

# With monitoring (Grafana + InfluxDB)
docker compose --profile monitoring up

# Full stack
docker compose --profile benchmark --profile monitoring up
```

## Dashboard

Access Grafana at http://localhost:3001 (when using --profile monitoring)

Default credentials:
- Username: `admin`
- Password: `admin`

## Local Testing

Install K6 locally:
```bash
# macOS
brew install k6

# Linux
sudo gpg -k hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

Run tests:
```bash
# Smoke test
k6 run k6/smoke-test.js

# Load test
k6 run k6/load-test.js

# Stress test
k6 run k6/stress-test.js

# Soak test
k6 run k6/soak-test.js
```

## Results

Results are saved in JSON format:
- `benchmark/results/k6-results.json`: Full K6 output

## License

MIT
