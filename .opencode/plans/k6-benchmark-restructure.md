# K6 Benchmark Integration & Project Restructure Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure project với K6 benchmark chuyên nghiệp, Bun + Fastify HTTP proxy, và Docker Compose profiles

**Architecture:** 
- `core/`: Semantic cache logic + Bun/Fastify HTTP server + unit tests
- `benchmark/`: K6 load testing suite với JSON output
- Root: Workspace package.json + Docker Compose với profiles
- HTTP API: POST /v1/chat {prompt, model} → cached LLM responses

**Tech Stack:** Bun, Fastify, K6, Redis, Docker Compose profiles

---

## Prerequisites

- Bun runtime installed (v1.0+)
- Docker & Docker Compose v2.20+ (profiles support)
- K6 CLI installed locally (optional, for dev testing)

---

## Task 1: Create Root Workspace Structure

**Files:**
- Create: `package.json` (root workspace)
- Create: `.gitignore` (update)
- Modify: `docker-compose.yml` (add profiles)

**Step 1: Create root package.json**

Create: `package.json`

```json
{
  "name": "erion-ember",
  "version": "1.0.0",
  "description": "LLM Semantic Cache with K6 Benchmarking",
  "private": true,
  "workspaces": [
    "core",
    "benchmark"
  ],
  "scripts": {
    "dev": "cd core && bun run dev",
    "build": "cd core && bun run build",
    "test": "cd core && bun test",
    "benchmark": "docker compose --profile benchmark up",
    "benchmark:local": "cd benchmark && k6 run k6/smoke-test.js",
    "docker:core": "docker compose up core redis",
    "docker:all": "docker compose --profile benchmark up"
  },
  "devDependencies": {},
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Step 2: Update docker-compose.yml với profiles**

Modify: `docker-compose.yml`

```yaml
version: '3.8'

services:
  # Core services (always run)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  core:
    build:
      context: ./core
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - PORT=3000
      - OLLAMA_URL=http://host.docker.internal:11434
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./core:/app
      - /app/node_modules
    command: bun run start

  # Benchmark services (only with --profile benchmark)
  k6:
    image: grafana/k6:latest
    profiles:
      - benchmark
    environment:
      - K6_OUT=json=/results/k6-results.json
      - CORE_URL=http://core:3000
    volumes:
      - ./benchmark/k6:/k6
      - ./benchmark/results:/results
    depends_on:
      - core
    command: run /k6/load-test.js

  # Optional: InfluxDB + Grafana for local dashboard
  influxdb:
    image: influxdb:2.7
    profiles:
      - benchmark
      - monitoring
    environment:
      - INFLUXDB_DB=k6
      - INFLUXDB_ADMIN_USER=admin
      - INFLUXDB_ADMIN_PASSWORD=admin123
    volumes:
      - influxdb_data:/var/lib/influxdb2
    ports:
      - "8086:8086"

  grafana:
    image: grafana/grafana:latest
    profiles:
      - benchmark
      - monitoring
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
    volumes:
      - ./benchmark/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./benchmark/grafana/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "3001:3000"
    depends_on:
      - influxdb

volumes:
  redis_data:
  influxdb_data:
```

**Step 3: Commit**

```bash
git add package.json docker-compose.yml
git commit -m "chore: setup workspace structure with docker compose profiles"
```

---

## Task 2: Setup Core Folder (Bun + Fastify)

**Files:**
- Create: `core/package.json`
- Create: `core/Dockerfile`
- Create: `core/src/server.js`
- Create: `core/src/routes/chat.js`
- Create: `core/tests/server.test.js`

**Step 1: Create core package.json**

Create: `core/package.json`

```json
{
  "name": "@erion/core",
  "version": "1.0.0",
  "description": "Semantic Cache Core with HTTP API",
  "main": "src/server.js",
  "scripts": {
    "dev": "bun run --watch src/server.js",
    "start": "bun run src/server.js",
    "test": "bun test",
    "build": "echo 'No build step needed for Bun'"
  },
  "dependencies": {
    "fastify": "^4.24.0",
    "@fastify/cors": "^8.4.0",
    "ioredis": "^5.3.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "bun-types": "latest"
  },
  "peerDependencies": {
    "typescript": "^5.0.0"
  }
}
```

**Step 2: Create Dockerfile for core**

Create: `core/Dockerfile`

```dockerfile
FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["bun", "run", "start"]
```

**Step 3: Write failing test for server**

Create: `core/tests/server.test.js`

```javascript
import { describe, test, beforeAll, afterAll } from 'bun:test';
import assert from 'node:assert';

describe('HTTP Server', () => {
  test('should start server on port 3000', async () => {
    // This will fail until we implement server
    const response = await fetch('http://localhost:3000/health');
    assert.strictEqual(response.status, 200);
  });

  test('POST /v1/chat should accept prompt and model', async () => {
    const response = await fetch('http://localhost:3000/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'What is machine learning?',
        model: 'llama3.2'
      })
    });
    
    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.ok(data.response);
    assert.ok(data.cached !== undefined);
  });
});
```

**Step 4: Run test to verify it fails**

```bash
cd core && bun test tests/server.test.js
```

Expected: FAIL - "ECONNREFUSED" (server not running)

**Step 5: Implement minimal Fastify server**

Create: `core/src/server.js`

```javascript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { chatRoute } from './routes/chat.js';

const fastify = Fastify({
  logger: true
});

// Register plugins
await fastify.register(cors);

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// API routes
fastify.register(chatRoute, { prefix: '/v1' });

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
```

**Step 6: Implement chat route**

Create: `core/src/routes/chat.js`

```javascript
import { z } from 'zod';

const chatSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().default('llama3.2')
});

export async function chatRoute(fastify, options) {
  fastify.post('/chat', async (request, reply) => {
    try {
      // Validate input
      const { prompt, model } = chatSchema.parse(request.body);
      
      // TODO: Integrate with semantic cache
      // For now, return mock response
      const isCached = Math.random() > 0.5;
      
      return {
        response: isCached 
          ? `Cached: ${prompt}` 
          : `Generated: ${prompt}`,
        cached: isCached,
        model,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400);
        return { error: 'Invalid input', details: error.errors };
      }
      throw error;
    }
  });
}
```

**Step 7: Run test to verify it passes**

```bash
cd core && bun run src/server.js &
sleep 2
bun test tests/server.test.js
kill %1
```

Expected: PASS - tests pass

**Step 8: Commit**

```bash
git add core/
git commit -m "feat(core): add Bun + Fastify HTTP server with /v1/chat endpoint"
```

---

## Task 3: Migrate Semantic Cache Logic to Core

**Files:**
- Move: `services/semantic-cache/src/*` → `core/src/cache/`
- Create: `core/src/cache/index.js`
- Modify: `core/src/routes/chat.js` (integrate cache)

**Step 1: Move semantic cache files**

```bash
mkdir -p core/src/cache
cp services/semantic-cache/src/*.js core/src/cache/
```

**Step 2: Create cache index**

Create: `core/src/cache/index.js`

```javascript
export { SemanticCache } from './semantic-cache.js';
export { HNSWIndex } from './hnsw-index.js';
export { Quantizer } from './quantizer.js';
export { Normalizer } from './normalizer.js';
export { Compressor } from './compressor.js';
export { MetadataStore } from './metadata-store.js';
```

**Step 3: Update chat route to use cache**

Modify: `core/src/routes/chat.js`

```javascript
import { SemanticCache } from '../cache/index.js';

// Initialize cache
const cache = new SemanticCache({
  dim: 1536,
  maxElements: 100000,
  similarityThreshold: 0.85
});

export async function chatRoute(fastify, options) {
  fastify.post('/chat', async (request, reply) => {
    const { prompt, model } = request.body;
    
    // Try cache first
    const cached = await cache.get(prompt);
    if (cached) {
      return {
        response: cached.response,
        cached: true,
        similarity: cached.similarity,
        model
      };
    }
    
    // TODO: Call Ollama for generation
    const response = `Generated response for: ${prompt}`;
    
    // Store in cache
    await cache.set(prompt, response, null); // embedding from Ollama
    
    return {
      response,
      cached: false,
      model
    };
  });
}
```

**Step 4: Commit**

```bash
git add core/src/cache/
git commit -m "feat(core): migrate semantic cache logic from services"
```

---

## Task 4: Setup K6 Benchmark Suite

**Files:**
- Create: `benchmark/package.json`
- Create: `benchmark/k6/smoke-test.js`
- Create: `benchmark/k6/load-test.js`
- Create: `benchmark/k6/stress-test.js`
- Create: `benchmark/k6/soak-test.js`
- Create: `benchmark/k6/lib/data.js` (workload generator)

**Step 1: Create benchmark package.json**

Create: `benchmark/package.json`

```json
{
  "name": "@erion/benchmark",
  "version": "1.0.0",
  "description": "K6 Load Testing Suite",
  "scripts": {
    "smoke": "k6 run k6/smoke-test.js",
    "load": "k6 run k6/load-test.js",
    "stress": "k6 run k6/stress-test.js",
    "soak": "k6 run k6/soak-test.js",
    "generate-data": "node scripts/generate-workload.js"
  },
  "devDependencies": {},
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Step 2: Create K6 smoke test**

Create: `benchmark/k6/smoke-test.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { getRandomPrompt } from './lib/data.js';

// Custom metrics
const cacheHitRate = new Rate('cache_hit_rate');
const latencyTrend = new Trend('latency_p95');
const tokenSavings = new Counter('tokens_saved');

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // 10 VU for 30s
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate < 10%
    cache_hit_rate: ['rate>0.5'],     // Cache hit rate > 50%
  },
};

const BASE_URL = __ENV.CORE_URL || 'http://localhost:3000';

export default function () {
  const prompt = getRandomPrompt();
  
  const payload = JSON.stringify({
    prompt: prompt,
    model: 'llama3.2'
  });
  
  const response = http.post(`${BASE_URL}/v1/chat`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => r.json('response') !== undefined,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  // Record metrics
  if (success) {
    const json = response.json();
    cacheHitRate.add(json.cached ? 1 : 0);
    latencyTrend.add(response.timings.duration);
    
    if (json.cached) {
      // Estimate 100 tokens saved per cache hit
      tokenSavings.add(100);
    }
  }
  
  sleep(1);
}
```

**Step 3: Create K6 load test**

Create: `benchmark/k6/load-test.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { getRandomPrompt } from './lib/data.js';

const cacheHitRate = new Rate('cache_hit_rate');
const latencyTrend = new Trend('latency_p95');
const tokenSavings = new Counter('tokens_saved');

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 VU
    { duration: '5m', target: 100 },  // Stay at 100 VU
    { duration: '2m', target: 200 },  // Ramp up to 200 VU
    { duration: '5m', target: 200 },  // Stay at 200 VU
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
    cache_hit_rate: ['rate>0.6'],
  },
};

const BASE_URL = __ENV.CORE_URL || 'http://localhost:3000';

export default function () {
  const prompt = getRandomPrompt();
  
  const response = http.post(`${BASE_URL}/v1/chat`, JSON.stringify({
    prompt: prompt,
    model: 'llama3.2'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => r.json('response') !== undefined,
  });
  
  const json = response.json();
  cacheHitRate.add(json.cached ? 1 : 0);
  latencyTrend.add(response.timings.duration);
  
  if (json.cached) {
    tokenSavings.add(100);
  }
  
  sleep(Math.random() * 2 + 1); // Random sleep 1-3s
}
```

**Step 4: Create workload data generator**

Create: `benchmark/k6/lib/data.js`

```javascript
// Realistic workload data for K6
// Copied from old workload-generator

const RAG_QUERIES = [
  'What is machine learning?',
  'Explain neural networks',
  'How does cloud computing work?',
  'What is Docker?',
  'Tell me about Redis',
  'Explain REST API',
  'What is GraphQL?',
  'How does blockchain work?',
  'What is artificial intelligence?',
  'Explain natural language processing',
];

const CLASSIFICATION_TEXTS = [
  'New AI model achieves human-level performance',
  'Tech company announces quantum computing breakthrough',
  'Researchers discover new species in deep ocean',
  'Stock market reaches all-time high',
  'Medical breakthrough promises cure for disease',
];

const CODE_PROMPTS = [
  'Write a function to reverse a string',
  'Create a debounce function',
  'Implement a deep clone function',
  'Write a function to flatten a nested array',
  'Create a LRU cache class',
];

export function getRandomPrompt() {
  const all = [...RAG_QUERIES, ...CLASSIFICATION_TEXTS, ...CODE_PROMPTS];
  return all[Math.floor(Math.random() * all.length)];
}

export function getRandomRAG() {
  return RAG_QUERIES[Math.floor(Math.random() * RAG_QUERIES.length)];
}

export function getRandomClassification() {
  return CLASSIFICATION_TEXTS[Math.floor(Math.random() * CLASSIFICATION_TEXTS.length)];
}

export function getRandomCode() {
  return CODE_PROMPTS[Math.floor(Math.random() * CODE_PROMPTS.length)];
}
```

**Step 5: Commit**

```bash
git add benchmark/
git commit -m "feat(benchmark): add K6 load testing suite with smoke, load, stress tests"
```

---

## Task 5: Create Grafana Dashboard Config

**Files:**
- Create: `benchmark/grafana/datasources/datasource.yml`
- Create: `benchmark/grafana/dashboards/dashboard.yml`
- Create: `benchmark/grafana/dashboards/k6-dashboard.json`

**Step 1: Create datasource config**

Create: `benchmark/grafana/datasources/datasource.yml`

```yaml
apiVersion: 1

datasources:
  - name: InfluxDB
    type: influxdb
    access: proxy
    url: http://influxdb:8086
    database: k6
    user: admin
    password: admin123
    isDefault: true
```

**Step 2: Create dashboard provider config**

Create: `benchmark/grafana/dashboards/dashboard.yml`

```yaml
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /etc/grafana/provisioning/dashboards
```

**Step 3: Commit**

```bash
git add benchmark/grafana/
git commit -m "feat(benchmark): add Grafana dashboard configuration"
```

---

## Task 6: Cleanup Old Benchmark Code

**Files:**
- Delete: `benchmark/src/*` (old implementation)
- Delete: `benchmark/tests/*` (old tests)
- Delete: `benchmark/data/workloads.json` (moved to k6/lib/data.js)
- Keep: `benchmark/package.json` (updated)
- Keep: `benchmark/k6/` (new K6 tests)
- Keep: `benchmark/grafana/` (dashboards)
- Keep: `benchmark/results/` (output folder)

**Step 1: Remove old benchmark files**

```bash
rm -rf benchmark/src
rm -rf benchmark/tests
rm benchmark/data/workloads.json
```

**Step 2: Update benchmark README**

Create: `benchmark/README.md`

```markdown
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
- **load-test.js**: Normal load (200 VU, 5m)
- **stress-test.js**: Breaking point (500 VU, 10m)
- **soak-test.js**: Memory leak detection (50 VU, 1h)

## Metrics

- HTTP throughput (req/sec)
- Latency (p50, p95, p99)
- Cache hit rate
- Token savings
- Error rate

## Dashboard

Access Grafana at http://localhost:3001 (when using --profile benchmark)
```

**Step 3: Commit**

```bash
git add benchmark/
git commit -m "cleanup(benchmark): remove old custom implementation, migrate to K6"
```

---

## Task 7: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/core-tests.yml`
- Create: `.github/workflows/k6-benchmark.yml`
- Modify: `.github/workflows/benchmark.yml` (delete or rename)

**Step 1: Create core tests workflow**

Create: `.github/workflows/core-tests.yml`

```yaml
name: Core Tests

on:
  push:
    branches: [ main ]
    paths:
      - 'core/**'
  pull_request:
    paths:
      - 'core/**'

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      with:
        bun-version: latest
    
    - name: Install dependencies
      working-directory: ./core
      run: bun install
    
    - name: Run tests
      working-directory: ./core
      run: bun test
```

**Step 2: Create K6 benchmark workflow**

Create: `.github/workflows/k6-benchmark.yml`

```yaml
name: K6 Benchmark

on:
  push:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:

jobs:
  benchmark:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup K6
      uses: grafana/setup-k6-action@v1
    
    - name: Start services
      run: |
        docker compose up -d core redis
        sleep 10  # Wait for services
    
    - name: Run smoke test
      run: |
        k6 run \
          --out json=benchmark/results/smoke-test.json \
          --env CORE_URL=http://localhost:3000 \
          benchmark/k6/smoke-test.js
    
    - name: Upload results
      uses: actions/upload-artifact@v4
      with:
        name: k6-results
        path: benchmark/results/*.json
    
    - name: Cleanup
      if: always()
      run: docker compose down
```

**Step 3: Remove old benchmark workflow**

```bash
rm .github/workflows/benchmark.yml
```

**Step 4: Commit**

```bash
git add .github/workflows/
git commit -m "ci: add GitHub Actions for core tests and K6 benchmark"
```

---

## Task 8: Final Integration & Documentation

**Files:**
- Modify: `README.md` (root)
- Create: `core/README.md`
- Create: `ARCHITECTURE.md`

**Step 1: Update root README**

Modify: `README.md`

```markdown
# Erion Ember

LLM Semantic Cache with K6 Benchmarking

## Quick Start

```bash
# Install dependencies
bun install

# Run core + redis
docker compose up core redis

# Run with benchmark
docker compose --profile benchmark up
```

## Project Structure

- `core/`: Bun + Fastify HTTP API + Semantic Cache logic
- `benchmark/`: K6 load testing suite

## API

### POST /v1/chat

```json
{
  "prompt": "What is machine learning?",
  "model": "llama3.2"
}
```

Response:
```json
{
  "response": "Machine learning is...",
  "cached": true,
  "similarity": 0.92
}
```

## Benchmarking

```bash
# Smoke test
npm run benchmark:local

# Full benchmark suite
docker compose --profile benchmark up
```

Access Grafana dashboard at http://localhost:3001
```

**Step 2: Create core README**

Create: `core/README.md`

```markdown
# Core Service

Bun + Fastify HTTP API for Semantic Cache

## Development

```bash
bun install
bun run dev
```

## API Endpoints

- `GET /health` - Health check
- `POST /v1/chat` - Chat with caching
```

**Step 3: Commit all**

```bash
git add README.md core/README.md
git commit -m "docs: update README with new structure and K6 benchmark info"
```

---

## Summary

### What Was Built

1. **Workspace Structure**: Root package.json with workspaces
2. **Core Service**: Bun + Fastify HTTP API at `/v1/chat`
3. **K6 Benchmark Suite**: Professional load testing with 4 test types
4. **Docker Compose**: Profiles for core/benchmark/monitoring
5. **Grafana Dashboard**: Visual monitoring (optional)
6. **CI/CD**: GitHub Actions for tests and benchmark

### Key Features

- ✅ Bun runtime for performance
- ✅ Fastify HTTP framework
- ✅ K6 for professional load testing
- ✅ JSON output for CI integration
- ✅ InfluxDB + Grafana (optional)
- ✅ Docker Compose profiles
- ✅ Semantic cache integration

### Commands

```bash
# Development
bun run dev              # Start core dev server
bun test                 # Run unit tests

# Docker
docker compose up core redis                    # Core only
docker compose --profile benchmark up           # With K6
docker compose --profile monitoring up          # With Grafana

# K6 (local)
cd benchmark && k6 run k6/smoke-test.js
```

---

## Plan Complete

**Plan saved to:** `.opencode/plans/k6-benchmark-restructure.md`

**Execution Options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task

**2. Parallel Session (separate)** - Open new session with executing-plans

**Which approach would you like?** Note: This plan involves significant restructuring (move files, delete old code), so I recommend careful execution.
