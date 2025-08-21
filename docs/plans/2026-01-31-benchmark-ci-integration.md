# Benchmark CI Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement automated benchmark system for LLM Semantic Cache with CI/CD integration, publishing results to GitHub Pages

**Architecture:** Two-tier benchmark system (exact match + semantic match) with Ollama integration for real LLM comparison, metrics collection, and GitHub Actions automation with visualization dashboard

**Tech Stack:** Node.js, GitHub Actions, Ollama (local), github-action-benchmark, GitHub Pages

---

## Prerequisites

Before starting, ensure:
- Node.js 18+ installed
- Ollama running locally on port 11434
- Git repository initialized with remote
- GitHub Pages enabled for the repository

---

## Task 1: Project Structure Setup

**Files:**
- Create: `benchmark/package.json`
- Create: `benchmark/.gitignore`
- Create: `benchmark/README.md`

**Step 1: Create benchmark directory structure**

```bash
mkdir -p benchmark/{src,tests,data,results}
touch benchmark/package.json
```

**Step 2: Write failing test for package.json existence**

Create: `benchmark/tests/setup.test.js`

```javascript
const fs = require('fs');
const path = require('path');

describe('Benchmark Setup', () => {
  test('package.json exists', () => {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
  });

  test('package.json has correct name', () => {
    const pkg = require('../package.json');
    expect(pkg.name).toBe('semantic-cache-benchmark');
  });
});
```

**Step 3: Run test to verify it fails**

```bash
cd benchmark
npm test
```

Expected: FAIL - "Cannot find module '../package.json'"

**Step 4: Create minimal package.json**

Create: `benchmark/package.json`

```json
{
  "name": "semantic-cache-benchmark",
  "version": "1.0.0",
  "description": "Benchmark suite for LLM Semantic Cache",
  "main": "src/index.js",
  "scripts": {
    "test": "node --test tests/**/*.test.js",
    "benchmark": "node src/runner.js",
    "benchmark:ollama": "USE_OLLAMA=true node src/runner.js",
    "benchmark:mock": "USE_MOCK=true node src/runner.js"
  },
  "dependencies": {
    "axios": "^1.6.0"
  },
  "devDependencies": {},
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Step 5: Run test to verify it passes**

```bash
cd benchmark
npm test
```

Expected: PASS - both tests pass

**Step 6: Commit**

```bash
git add benchmark/
git commit -m "feat(benchmark): initialize benchmark project structure"
```

---

## Task 2: Ollama Client Implementation

**Files:**
- Create: `benchmark/src/ollama-client.js`
- Test: `benchmark/tests/ollama-client.test.js`

**Step 1: Write failing test for Ollama client**

Create: `benchmark/tests/ollama-client.test.js`

```javascript
const { describe, test, before } = require('node:test');
const assert = require('node:assert');
const OllamaClient = require('../src/ollama-client');

describe('OllamaClient', () => {
  test('should instantiate with default config', () => {
    const client = new OllamaClient();
    assert.strictEqual(client.baseUrl, 'http://localhost:11434');
    assert.strictEqual(client.embeddingModel, 'nomic-embed-text');
    assert.strictEqual(client.llmModel, 'llama3.2');
  });

  test('should accept custom config', () => {
    const client = new OllamaClient({
      baseUrl: 'http://custom:11434',
      embeddingModel: 'custom-embed',
      llmModel: 'custom-llm'
    });
    assert.strictEqual(client.baseUrl, 'http://custom:11434');
    assert.strictEqual(client.embeddingModel, 'custom-embed');
    assert.strictEqual(client.llmModel, 'custom-llm');
  });

  test('should check availability', async () => {
    const client = new OllamaClient();
    const isAvailable = await client.isAvailable();
    assert.strictEqual(typeof isAvailable, 'boolean');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd benchmark
npm test tests/ollama-client.test.js
```

Expected: FAIL - "Cannot find module '../src/ollama-client'"

**Step 3: Write minimal implementation**

Create: `benchmark/src/ollama-client.js`

```javascript
/**
 * Ollama API Client for embeddings and LLM inference
 */
class OllamaClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.embeddingModel = options.embeddingModel || 'nomic-embed-text';
    this.llmModel = options.llmModel || 'llama3.2';
    this.timeout = options.timeout || 30000;
  }

  /**
   * Check if Ollama service is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate embedding for text
   * @param {string} text - Input text
   * @returns {Promise<number[]>} - Embedding vector
   */
  async embed(text) {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.embeddingModel,
        prompt: text
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      throw new Error(`Embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  }

  /**
   * Generate LLM response
   * @param {string} prompt - Input prompt
   * @returns {Promise<{response: string, tokens: number}>}
   */
  async generate(prompt) {
    const startTime = Date.now();
    
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.llmModel,
        prompt: prompt,
        stream: false
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      throw new Error(`Generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;
    
    // Estimate tokens (rough approximation: 4 chars per token)
    const estimatedTokens = Math.ceil((prompt.length + data.response.length) / 4);
    
    return {
      response: data.response,
      tokens: estimatedTokens,
      latency: latency
    };
  }
}

module.exports = OllamaClient;
```

**Step 4: Run test to verify it passes**

```bash
cd benchmark
npm test tests/ollama-client.test.js
```

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add benchmark/src/ollama-client.js benchmark/tests/ollama-client.test.js
git commit -m "feat(benchmark): add Ollama client for embeddings and LLM inference"
```

---

## Task 3: Metrics Collector Implementation

**Files:**
- Create: `benchmark/src/metrics-collector.js`
- Test: `benchmark/tests/metrics-collector.test.js`

**Step 1: Write failing test for metrics collector**

Create: `benchmark/tests/metrics-collector.test.js`

```javascript
const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert');
const MetricsCollector = require('../src/metrics-collector');

describe('MetricsCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  test('should initialize with empty metrics', () => {
    const metrics = collector.getMetrics();
    assert.strictEqual(metrics.totalQueries, 0);
    assert.strictEqual(metrics.cacheHits, 0);
    assert.strictEqual(metrics.cacheMisses, 0);
  });

  test('should record cache hit', () => {
    collector.recordHit({ latency: 50, isExact: true });
    const metrics = collector.getMetrics();
    assert.strictEqual(metrics.cacheHits, 1);
    assert.strictEqual(metrics.exactHits, 1);
    assert.strictEqual(metrics.semanticHits, 0);
  });

  test('should record cache miss', () => {
    collector.recordMiss({ latency: 2000, tokens: 150 });
    const metrics = collector.getMetrics();
    assert.strictEqual(metrics.cacheMisses, 1);
    assert.strictEqual(metrics.totalTokens, 150);
  });

  test('should calculate hit rate correctly', () => {
    collector.recordHit({ latency: 50, isExact: true });
    collector.recordHit({ latency: 60, isExact: false });
    collector.recordMiss({ latency: 2000, tokens: 100 });
    
    const metrics = collector.getMetrics();
    assert.strictEqual(metrics.hitRate, 0.6667);
    assert.strictEqual(metrics.exactHitRate, 0.3333);
    assert.strictEqual(metrics.semanticHitRate, 0.3333);
  });

  test('should calculate latency percentiles', () => {
    collector.recordHit({ latency: 10, isExact: true });
    collector.recordHit({ latency: 20, isExact: true });
    collector.recordHit({ latency: 30, isExact: true });
    collector.recordHit({ latency: 40, isExact: true });
    collector.recordHit({ latency: 50, isExact: true });
    
    const metrics = collector.getMetrics();
    assert.strictEqual(metrics.latencyP50, 30);
    assert.strictEqual(metrics.latencyP95, 50);
    assert.strictEqual(metrics.latencyP99, 50);
  });

  test('should export to JSON format', () => {
    collector.recordHit({ latency: 50, isExact: true });
    collector.recordMiss({ latency: 2000, tokens: 100 });
    
    const json = collector.toJSON();
    assert.ok(json.timestamp);
    assert.strictEqual(json.totalQueries, 2);
    assert.strictEqual(json.cacheHits, 1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd benchmark
npm test tests/metrics-collector.test.js
```

Expected: FAIL - "Cannot find module '../src/metrics-collector'"

**Step 3: Write minimal implementation**

Create: `benchmark/src/metrics-collector.js`

```javascript
/**
 * Collects and calculates benchmark metrics
 */
class MetricsCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = Date.now();
    this.totalQueries = 0;
    this.cacheHits = 0;
    this.exactHits = 0;
    this.semanticHits = 0;
    this.cacheMisses = 0;
    this.hitLatencies = [];
    this.missLatencies = [];
    this.totalTokens = 0;
    this.tokensSaved = 0;
  }

  /**
   * Record a cache hit
   * @param {Object} data - Hit data
   * @param {number} data.latency - Response latency in ms
   * @param {boolean} data.isExact - Whether exact match or semantic
   */
  recordHit({ latency, isExact }) {
    this.totalQueries++;
    this.cacheHits++;
    this.hitLatencies.push(latency);
    
    if (isExact) {
      this.exactHits++;
    } else {
      this.semanticHits++;
    }
  }

  /**
   * Record a cache miss
   * @param {Object} data - Miss data
   * @param {number} data.latency - LLM inference latency in ms
   * @param {number} data.tokens - Tokens used
   */
  recordMiss({ latency, tokens }) {
    this.totalQueries++;
    this.cacheMisses++;
    this.missLatencies.push(latency);
    this.totalTokens += tokens;
    this.tokensSaved += tokens; // Tokens that would have been used on hit
  }

  /**
   * Calculate percentile from array
   * @private
   */
  _percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get current metrics
   * @returns {Object} - Metrics summary
   */
  getMetrics() {
    const hitRate = this.totalQueries > 0 ? this.cacheHits / this.totalQueries : 0;
    const exactHitRate = this.totalQueries > 0 ? this.exactHits / this.totalQueries : 0;
    const semanticHitRate = this.totalQueries > 0 ? this.semanticHits / this.totalQueries : 0;
    
    const avgHitLatency = this.hitLatencies.length > 0
      ? this.hitLatencies.reduce((a, b) => a + b, 0) / this.hitLatencies.length
      : 0;
    
    const avgMissLatency = this.missLatencies.length > 0
      ? this.missLatencies.reduce((a, b) => a + b, 0) / this.missLatencies.length
      : 0;

    return {
      // Query stats
      totalQueries: this.totalQueries,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      
      // Hit rates
      hitRate: parseFloat(hitRate.toFixed(4)),
      exactHitRate: parseFloat(exactHitRate.toFixed(4)),
      semanticHitRate: parseFloat(semanticHitRate.toFixed(4)),
      
      // Latency (ms)
      avgHitLatency: parseFloat(avgHitLatency.toFixed(2)),
      avgMissLatency: parseFloat(avgMissLatency.toFixed(2)),
      latencyP50: this._percentile(this.hitLatencies, 50),
      latencyP95: this._percentile(this.hitLatencies, 95),
      latencyP99: this._percentile(this.hitLatencies, 99),
      
      // Token savings
      totalTokens: this.totalTokens,
      tokensSaved: this.tokensSaved,
      estimatedCostSaved: parseFloat((this.tokensSaved * 0.00001).toFixed(4)), // $0.01 per 1K tokens
      
      // Performance
      speedupFactor: avgMissLatency > 0 ? parseFloat((avgMissLatency / avgHitLatency).toFixed(2)) : 0,
      
      // Duration
      duration: Date.now() - this.startTime
    };
  }

  /**
   * Export metrics to JSON format for github-action-benchmark
   * @returns {Object} - Benchmark JSON format
   */
  toJSON() {
    const metrics = this.getMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      metrics: [
        { name: 'hit_rate', value: metrics.hitRate, unit: 'percent' },
        { name: 'semantic_hit_rate', value: metrics.semanticHitRate, unit: 'percent' },
        { name: 'exact_hit_rate', value: metrics.exactHitRate, unit: 'percent' },
        { name: 'avg_hit_latency', value: metrics.avgHitLatency, unit: 'ms' },
        { name: 'p95_hit_latency', value: metrics.latencyP95, unit: 'ms' },
        { name: 'avg_miss_latency', value: metrics.avgMissLatency, unit: 'ms' },
        { name: 'speedup_factor', value: metrics.speedupFactor, unit: 'x' },
        { name: 'tokens_saved', value: metrics.tokensSaved, unit: 'count' },
        { name: 'cost_saved', value: metrics.estimatedCostSaved, unit: 'USD' }
      ],
      raw: metrics
    };
  }
}

module.exports = MetricsCollector;
```

**Step 4: Run test to verify it passes**

```bash
cd benchmark
npm test tests/metrics-collector.test.js
```

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add benchmark/src/metrics-collector.js benchmark/tests/metrics-collector.test.js
git commit -m "feat(benchmark): add metrics collector for performance tracking"
```

---

## Task 4: Workload Generator Implementation

**Files:**
- Create: `benchmark/src/workload-generator.js`
- Create: `benchmark/data/workloads.json`
- Test: `benchmark/tests/workload-generator.test.js`

**Step 1: Write failing test for workload generator**

Create: `benchmark/tests/workload-generator.test.js`

```javascript
const { describe, test } = require('node:test');
const assert = require('node:assert');
const WorkloadGenerator = require('../src/workload-generator');

describe('WorkloadGenerator', () => {
  test('should load workloads from JSON', () => {
    const generator = new WorkloadGenerator();
    assert.ok(generator.workloads);
    assert.ok(generator.workloads.rag);
    assert.ok(generator.workloads.classification);
    assert.ok(generator.workloads.code);
  });

  test('should generate RAG queries', () => {
    const generator = new WorkloadGenerator();
    const queries = generator.generateRAG(10);
    assert.strictEqual(queries.length, 10);
    assert.ok(queries[0].query);
    assert.ok(queries[0].category);
    assert.strictEqual(queries[0].type, 'rag');
  });

  test('should generate classification queries', () => {
    const generator = new WorkloadGenerator();
    const queries = generator.generateClassification(10);
    assert.strictEqual(queries.length, 10);
    assert.ok(queries[0].text);
    assert.ok(queries[0].category);
    assert.strictEqual(queries[0].type, 'classification');
  });

  test('should generate code queries', () => {
    const generator = new WorkloadGenerator();
    const queries = generator.generateCode(10);
    assert.strictEqual(queries.length, 10);
    assert.ok(queries[0].prompt);
    assert.ok(queries[0].language);
    assert.strictEqual(queries[0].type, 'code');
  });

  test('should generate mixed workload', () => {
    const generator = new WorkloadGenerator();
    const queries = generator.generateMixed({
      rag: 10,
      classification: 10,
      code: 10
    });
    assert.strictEqual(queries.length, 30);
    
    const ragCount = queries.filter(q => q.type === 'rag').length;
    const classCount = queries.filter(q => q.type === 'classification').length;
    const codeCount = queries.filter(q => q.type === 'code').length;
    
    assert.strictEqual(ragCount, 10);
    assert.strictEqual(classCount, 10);
    assert.strictEqual(codeCount, 10);
  });

  test('should create semantic variations', () => {
    const generator = new WorkloadGenerator();
    const base = { query: 'What is the capital of France?' };
    const variations = generator.createVariations(base, 3);
    
    assert.strictEqual(variations.length, 3);
    assert.ok(variations.every(v => v.query !== base.query));
    assert.ok(variations.every(v => v.semanticGroup === base.query));
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd benchmark
npm test tests/workload-generator.test.js
```

Expected: FAIL - "Cannot find module '../src/workload-generator'"

**Step 3: Create workload data file**

Create: `benchmark/data/workloads.json`

```json
{
  "rag": {
    "templates": [
      {
        "base": "What is {topic}?",
        "variations": [
          "Tell me about {topic}",
          "Explain {topic}",
          "Give me information on {topic}",
          "Describe {topic}",
          "What can you tell me about {topic}?"
        ],
        "topics": [
          "machine learning", "neural networks", "deep learning",
          "cloud computing", "microservices", "Docker",
          "JavaScript", "Python", "TypeScript",
          "Redis", "MongoDB", "PostgreSQL",
          "REST API", "GraphQL", "WebSocket",
          "agile methodology", "scrum", "kanban",
          "blockchain", "cryptocurrency", "smart contracts",
          "artificial intelligence", "natural language processing", "computer vision"
        ]
      },
      {
        "base": "How does {technology} work?",
        "variations": [
          "Explain how {technology} works",
          "What is the mechanism behind {technology}?",
          "Can you describe {technology} functionality?",
          "Tell me the working principle of {technology}"
        ],
        "topics": [
          "TCP/IP", "HTTP/2", "WebRTC",
          "virtual memory", "garbage collection", "event loop",
          "blockchain consensus", "proof of work", "proof of stake",
          "transformer models", "attention mechanism", "BERT"
        ]
      }
    ]
  },
  "classification": {
    "categories": [
      "technology", "science", "business", "health", "entertainment",
      "sports", "politics", "education", "travel", "food"
    ],
    "templates": [
      {
        "category": "technology",
        "texts": [
          "New AI model achieves human-level performance on standardized tests",
          "Tech company announces breakthrough in quantum computing",
          "Software update brings revolutionary features to mobile devices",
          "Cloud infrastructure experiences major outage affecting millions",
          "Open source project reaches one million GitHub stars"
        ]
      },
      {
        "category": "science",
        "texts": [
          "Researchers discover new species in deep ocean expedition",
          "Study shows correlation between sleep and cognitive performance",
          "Climate scientists publish alarming new data on global warming",
          "Space telescope captures unprecedented images of distant galaxies",
          "Medical breakthrough promises cure for previously untreatable disease"
        ]
      },
      {
        "category": "business",
        "texts": [
          "Stock market reaches all-time high amid economic optimism",
          "Major corporation announces record quarterly earnings",
          "Startup secures billion-dollar valuation in latest funding round",
          "Retail chain announces closure of hundreds of stores nationwide",
          "Merger between industry giants receives regulatory approval"
        ]
      }
    ]
  },
  "code": {
    "languages": ["JavaScript", "Python", "SQL"],
    "templates": [
      {
        "language": "JavaScript",
        "prompts": [
          "Write a function to reverse a string",
          "Create a debounce function for event handling",
          "Implement a deep clone function for objects",
          "Write a function to flatten a nested array",
          "Create a promise-based sleep function",
          "Implement a LRU cache class",
          "Write a function to validate email addresses",
          "Create a throttle function for API calls"
        ]
      },
      {
        "language": "Python",
        "prompts": [
          "Write a function to find prime numbers up to n",
          "Create a decorator for measuring function execution time",
          "Implement a context manager for database connections",
          "Write a generator function for Fibonacci sequence",
          "Create a class to handle CSV file operations",
          "Implement a recursive function for binary search",
          "Write a function to parse JSON with error handling",
          "Create a multiprocessing pool for parallel processing"
        ]
      },
      {
        "language": "SQL",
        "prompts": [
          "Write a query to find duplicate records in a table",
          "Create a query to calculate running totals",
          "Implement a recursive CTE for hierarchical data",
          "Write a query to pivot data from rows to columns",
          "Create an optimized query with proper indexing",
          "Write a query to find gaps in sequential data",
          "Implement window functions for ranking data",
          "Create a query for time-series aggregation"
        ]
      }
    ]
  }
}
```

**Step 4: Write minimal implementation**

Create: `benchmark/src/workload-generator.js`

```javascript
const fs = require('fs');
const path = require('path');

/**
 * Generates benchmark workloads with semantic variations
 */
class WorkloadGenerator {
  constructor(dataPath = null) {
    this.dataPath = dataPath || path.join(__dirname, '..', 'data', 'workloads.json');
    this.workloads = this._loadWorkloads();
  }

  _loadWorkloads() {
    const data = fs.readFileSync(this.dataPath, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Generate RAG (Retrieval-Augmented Generation) queries
   * @param {number} count - Number of queries to generate
   * @returns {Array} - Query objects
   */
  generateRAG(count) {
    const queries = [];
    const templates = this.workloads.rag.templates;
    
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      const topic = template.topics[i % template.topics.length];
      
      const baseQuery = template.base.replace('{topic}', topic);
      queries.push({
        id: `rag-${i}`,
        type: 'rag',
        query: baseQuery,
        category: topic,
        semanticGroup: baseQuery
      });
    }
    
    return queries;
  }

  /**
   * Generate classification queries
   * @param {number} count - Number of queries to generate
   * @returns {Array} - Query objects
   */
  generateClassification(count) {
    const queries = [];
    const templates = this.workloads.classification.templates;
    
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      const text = template.texts[i % template.texts.length];
      
      queries.push({
        id: `class-${i}`,
        type: 'classification',
        text: text,
        category: template.category,
        expectedCategory: template.category,
        semanticGroup: text
      });
    }
    
    return queries;
  }

  /**
   * Generate code generation queries
   * @param {number} count - Number of queries to generate
   * @returns {Array} - Query objects
   */
  generateCode(count) {
    const queries = [];
    const templates = this.workloads.code.templates;
    
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      const prompt = template.prompts[i % template.prompts.length];
      
      queries.push({
        id: `code-${i}`,
        type: 'code',
        prompt: prompt,
        language: template.language,
        semanticGroup: `${template.language}: ${prompt}`
      });
    }
    
    return queries;
  }

  /**
   * Generate mixed workload
   * @param {Object} distribution - Query type distribution
   * @returns {Array} - Mixed query objects
   */
  generateMixed(distribution = { rag: 400, classification: 300, code: 300 }) {
    const queries = [
      ...this.generateRAG(distribution.rag || 0),
      ...this.generateClassification(distribution.classification || 0),
      ...this.generateCode(distribution.code || 0)
    ];
    
    // Shuffle queries
    for (let i = queries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queries[i], queries[j]] = [queries[j], queries[i]];
    }
    
    return queries;
  }

  /**
   * Create semantic variations of a query
   * @param {Object} baseQuery - Base query object
   * @param {number} count - Number of variations
   * @returns {Array} - Variation objects
   */
  createVariations(baseQuery, count) {
    const variations = [];
    
    // Simple variation strategies
    const strategies = [
      (q) => q.replace('What is', 'Tell me about'),
      (q) => q.replace('How does', 'Explain how'),
      (q) => q.replace('?', ' please?'),
      (q) => `Can you ${q.charAt(0).toLowerCase() + q.slice(1)}`,
      (q) => `I need to know: ${q}`
    ];
    
    const queryText = baseQuery.query || baseQuery.text || baseQuery.prompt;
    
    for (let i = 0; i < count; i++) {
      const strategy = strategies[i % strategies.length];
      const varied = strategy(queryText);
      
      variations.push({
        ...baseQuery,
        id: `${baseQuery.id}-var-${i}`,
        query: varied,
        text: varied,
        prompt: varied,
        isVariation: true,
        semanticGroup: baseQuery.semanticGroup || queryText
      });
    }
    
    return variations;
  }
}

module.exports = WorkloadGenerator;
```

**Step 5: Run test to verify it passes**

```bash
cd benchmark
npm test tests/workload-generator.test.js
```

Expected: PASS - all tests pass

**Step 6: Commit**

```bash
git add benchmark/src/workload-generator.js benchmark/data/workloads.json benchmark/tests/workload-generator.test.js
git commit -m "feat(benchmark): add workload generator with RAG, classification, and code queries"
```

---

## Task 5: Benchmark Runner Implementation

**Files:**
- Create: `benchmark/src/runner.js`
- Modify: `benchmark/package.json` (add start script)
- Test: `benchmark/tests/runner.test.js`

**Step 1: Write failing test for runner**

Create: `benchmark/tests/runner.test.js`

```javascript
const { describe, test } = require('node:test');
const assert = require('node:assert');
const BenchmarkRunner = require('../src/runner');

describe('BenchmarkRunner', () => {
  test('should instantiate with default options', () => {
    const runner = new BenchmarkRunner();
    assert.ok(runner.metrics);
    assert.ok(runner.workloadGenerator);
    assert.strictEqual(runner.queryCount, 100);
  });

  test('should accept custom options', () => {
    const runner = new BenchmarkRunner({
      queryCount: 50,
      useOllama: true,
      similarityThreshold: 0.9
    });
    assert.strictEqual(runner.queryCount, 50);
    assert.strictEqual(runner.useOllama, true);
    assert.strictEqual(runner.similarityThreshold, 0.9);
  });

  test('should run benchmark and return results', async () => {
    const runner = new BenchmarkRunner({
      queryCount: 5,
      useOllama: false,
      useMock: true
    });
    
    const results = await runner.run();
    assert.ok(results);
    assert.ok(results.timestamp);
    assert.ok(results.metrics);
    assert.strictEqual(results.metrics.totalQueries, 5);
  });

  test('should save results to file', async () => {
    const runner = new BenchmarkRunner({
      queryCount: 3,
      useMock: true,
      outputPath: './results/test-output.json'
    });
    
    await runner.run();
    const fs = require('fs');
    assert.ok(fs.existsSync('./results/test-output.json'));
    
    // Cleanup
    fs.unlinkSync('./results/test-output.json');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd benchmark
npm test tests/runner.test.js
```

Expected: FAIL - "Cannot find module '../src/runner'"

**Step 3: Write minimal implementation**

Create: `benchmark/src/runner.js`

```javascript
const fs = require('fs').promises;
const path = require('path');
const OllamaClient = require('./ollama-client');
const MetricsCollector = require('./metrics-collector');
const WorkloadGenerator = require('./workload-generator');

/**
 * Main benchmark runner
 */
class BenchmarkRunner {
  constructor(options = {}) {
    this.queryCount = options.queryCount || 100;
    this.useOllama = options.useOllama || process.env.USE_OLLAMA === 'true';
    this.useMock = options.useMock || process.env.USE_MOCK === 'true' || !this.useOllama;
    this.similarityThreshold = options.similarityThreshold || 0.85;
    this.outputPath = options.outputPath || './results/benchmark-results.json';
    
    this.ollama = new OllamaClient();
    this.metrics = new MetricsCollector();
    this.workloadGenerator = new WorkloadGenerator();
    
    // Simple in-memory cache for benchmark
    this.cache = new Map();
    this.vectorCache = new Map();
  }

  /**
   * Check if Ollama is available
   */
  async checkOllama() {
    if (this.useMock) return false;
    return await this.ollama.isAvailable();
  }

  /**
   * Get embedding for text (with caching)
   */
  async getEmbedding(text) {
    if (this.vectorCache.has(text)) {
      return this.vectorCache.get(text);
    }
    
    if (this.useMock) {
      // Generate mock embedding (random vector)
      const mockEmbedding = Array.from({ length: 768 }, () => Math.random());
      this.vectorCache.set(text, mockEmbedding);
      return mockEmbedding;
    }
    
    const embedding = await this.ollama.embed(text);
    this.vectorCache.set(text, embedding);
    return embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Query cache with semantic search
   */
  async queryCache(query, embedding) {
    const startTime = Date.now();
    
    // Check exact match first
    if (this.cache.has(query)) {
      const entry = this.cache.get(query);
      return {
        hit: true,
        isExact: true,
        response: entry.response,
        latency: Date.now() - startTime
      };
    }
    
    // Semantic search
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      const cachedEmbedding = entry.embedding;
      const similarity = this.cosineSimilarity(embedding, cachedEmbedding);
      
      if (similarity > bestSimilarity && similarity >= this.similarityThreshold) {
        bestSimilarity = similarity;
        bestMatch = entry;
      }
    }
    
    if (bestMatch) {
      return {
        hit: true,
        isExact: false,
        response: bestMatch.response,
        similarity: bestSimilarity,
        latency: Date.now() - startTime
      };
    }
    
    return { hit: false, latency: Date.now() - startTime };
  }

  /**
   * Get response from LLM (or mock)
   */
  async getLLMResponse(query) {
    const startTime = Date.now();
    
    if (this.useMock) {
      // Simulate LLM latency (1-3 seconds)
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
      
      return {
        response: `Mock response for: ${query}`,
        tokens: Math.ceil(query.length / 4) + 50,
        latency: Date.now() - startTime
      };
    }
    
    return await this.ollama.generate(query);
  }

  /**
   * Store in cache
   */
  async storeInCache(query, embedding, response) {
    this.cache.set(query, {
      query,
      embedding,
      response: response.response,
      timestamp: Date.now()
    });
  }

  /**
   * Process a single query
   */
  async processQuery(queryObj) {
    const queryText = queryObj.query || queryObj.text || queryObj.prompt;
    
    // Get embedding
    const embedding = await this.getEmbedding(queryText);
    
    // Try cache
    const cacheResult = await this.queryCache(queryText, embedding);
    
    if (cacheResult.hit) {
      this.metrics.recordHit({
        latency: cacheResult.latency,
        isExact: cacheResult.isExact
      });
      return { cached: true, ...cacheResult };
    }
    
    // Cache miss - get from LLM
    const llmResult = await this.getLLMResponse(queryText);
    
    // Store in cache
    await this.storeInCache(queryText, embedding, llmResult);
    
    this.metrics.recordMiss({
      latency: llmResult.latency,
      tokens: llmResult.tokens
    });
    
    return { cached: false, ...llmResult };
  }

  /**
   * Run benchmark
   */
  async run() {
    console.log('🚀 Starting Semantic Cache Benchmark');
    console.log(`📊 Configuration: ${this.queryCount} queries`);
    console.log(`🎯 Similarity threshold: ${this.similarityThreshold}`);
    console.log(`🔧 Mode: ${this.useOllama ? 'Ollama' : 'Mock'}\n`);

    // Check Ollama availability
    if (this.useOllama) {
      const isAvailable = await this.checkOllama();
      if (!isAvailable) {
        console.log('⚠️  Ollama not available, falling back to mock mode');
        this.useOllama = false;
        this.useMock = true;
      }
    }

    // Generate workload
    console.log('📋 Generating workload...');
    const queries = this.workloadGenerator.generateMixed({
      rag: Math.floor(this.queryCount * 0.4),
      classification: Math.floor(this.queryCount * 0.3),
      code: Math.floor(this.queryCount * 0.3)
    });
    console.log(`✅ Generated ${queries.length} queries\n`);

    // Add semantic variations (simulate repeated similar queries)
    const variations = [];
    for (let i = 0; i < queries.length; i += 5) {
      const base = queries[i];
      const vars = this.workloadGenerator.createVariations(base, 2);
      variations.push(...vars);
    }
    queries.push(...variations);
    
    console.log(`📝 Total queries with variations: ${queries.length}\n`);

    // Run benchmark
    console.log('⏱️  Running benchmark...');
    const startTime = Date.now();
    
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      await this.processQuery(query);
      
      if ((i + 1) % 50 === 0) {
        console.log(`  Progress: ${i + 1}/${queries.length} queries`);
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ Benchmark completed in ${(duration / 1000).toFixed(2)}s\n`);

    // Get results
    const results = this.metrics.toJSON();
    
    // Add metadata
    results.metadata = {
      queryCount: this.queryCount,
      totalQueries: queries.length,
      useOllama: this.useOllama,
      similarityThreshold: this.similarityThreshold,
      duration: duration,
      timestamp: new Date().toISOString()
    };

    // Save results
    await this.saveResults(results);
    
    // Print summary
    this.printSummary(results);
    
    return results;
  }

  /**
   * Save results to file
   */
  async saveResults(results) {
    const dir = path.dirname(this.outputPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.outputPath, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to ${this.outputPath}\n`);
  }

  /**
   * Print summary to console
   */
  printSummary(results) {
    const m = results.raw;
    
    console.log('📊 BENCHMARK RESULTS');
    console.log('═'.repeat(50));
    console.log(`Total Queries:      ${m.totalQueries}`);
    console.log(`Cache Hits:         ${m.cacheHits} (${(m.hitRate * 100).toFixed(2)}%)`);
    console.log(`  Exact Hits:       ${m.exactHits} (${(m.exactHitRate * 100).toFixed(2)}%)`);
    console.log(`  Semantic Hits:    ${m.semanticHits} (${(m.semanticHitRate * 100).toFixed(2)}%)`);
    console.log(`Cache Misses:       ${m.cacheMisses}`);
    console.log('');
    console.log('⚡ PERFORMANCE');
    console.log(`Avg Cache Latency:  ${m.avgHitLatency.toFixed(2)} ms`);
    console.log(`P95 Cache Latency:  ${m.latencyP95} ms`);
    console.log(`Avg LLM Latency:    ${m.avgMissLatency.toFixed(2)} ms`);
    console.log(`Speedup Factor:     ${m.speedupFactor}x`);
    console.log('');
    console.log('💰 COST SAVINGS');
    console.log(`Tokens Saved:       ${m.tokensSaved}`);
    console.log(`Est. Cost Saved:    $${m.estimatedCostSaved}`);
    console.log('═'.repeat(50));
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new BenchmarkRunner({
    queryCount: parseInt(process.env.QUERY_COUNT) || 100,
    useOllama: process.env.USE_OLLAMA === 'true',
    useMock: process.env.USE_MOCK === 'true',
    similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.85,
    outputPath: process.env.OUTPUT_PATH || './results/benchmark-results.json'
  });
  
  runner.run().catch(err => {
    console.error('❌ Benchmark failed:', err);
    process.exit(1);
  });
}

module.exports = BenchmarkRunner;
```

**Step 4: Run test to verify it passes**

```bash
cd benchmark
npm test tests/runner.test.js
```

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add benchmark/src/runner.js benchmark/tests/runner.test.js
git commit -m "feat(benchmark): add benchmark runner with cache simulation and metrics"
```

---

## Task 6: GitHub Actions Workflow Setup

**Files:**
- Create: `.github/workflows/benchmark.yml`
- Create: `.github/workflows/scripts/check-ollama.sh`

**Step 1: Create GitHub Actions workflow**

Create: `.github/workflows/benchmark.yml`

```yaml
name: Benchmark

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
    types: [ opened, synchronize, labeled ]
  schedule:
    # Run weekly on Sundays at 00:00 UTC
    - cron: '0 0 * * 0'
  workflow_dispatch:
    inputs:
      query_count:
        description: 'Number of queries to run'
        required: false
        default: '100'
        type: string

jobs:
  benchmark:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      deployments: write
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
        cache-dependency-path: benchmark/package-lock.json
    
    - name: Install dependencies
      working-directory: ./benchmark
      run: |
        npm ci
    
    - name: Check Ollama availability
      id: ollama-check
      run: |
        chmod +x .github/workflows/scripts/check-ollama.sh
        if .github/workflows/scripts/check-ollama.sh; then
          echo "available=true" >> $GITHUB_OUTPUT
          echo "✅ Ollama is available"
        else
          echo "available=false" >> $GITHUB_OUTPUT
          echo "⚠️ Ollama not available, using mock mode"
        fi
      continue-on-error: true
    
    - name: Run Benchmark with Ollama
      if: steps.ollama-check.outputs.available == 'true'
      working-directory: ./benchmark
      run: |
        npm run benchmark:ollama
      env:
        QUERY_COUNT: ${{ github.event.inputs.query_count || '100' }}
        SIMILARITY_THRESHOLD: '0.85'
        OUTPUT_PATH: './results/benchmark-results.json'
    
    - name: Run Benchmark (Mock Mode)
      if: steps.ollama-check.outputs.available != 'true'
      working-directory: ./benchmark
      run: |
        npm run benchmark:mock
      env:
        QUERY_COUNT: ${{ github.event.inputs.query_count || '100' }}
        SIMILARITY_THRESHOLD: '0.85'
        OUTPUT_PATH: './results/benchmark-results.json'
    
    - name: Upload benchmark results
      uses: actions/upload-artifact@v4
      with:
        name: benchmark-results
        path: benchmark/results/benchmark-results.json
        retention-days: 30
    
    - name: Store benchmark result
      uses: benchmark-action/github-action-benchmark@v1
      with:
        tool: 'customSmallerIsBetter'
        output-file-path: benchmark/results/benchmark-results.json
        github-token: ${{ secrets.GITHUB_TOKEN }}
        auto-push: true
        comment-on-alert: true
        alert-threshold: '200%'
        fail-on-alert: false
        benchmark-data-dir-path: 'docs/bench'
    
    - name: Generate benchmark report
      working-directory: ./benchmark
      run: |
        node -e "
          const fs = require('fs');
          const results = JSON.parse(fs.readFileSync('./results/benchmark-results.json', 'utf8'));
          
          let report = '# Benchmark Report\n\n';
          report += '**Timestamp:** ' + results.timestamp + '\n\n';
          report += '## Metrics\n\n';
          report += '| Metric | Value | Unit |\n';
          report += '|--------|-------|------|\n';
          
          results.metrics.forEach(m => {
            report += '| ' + m.name + ' | ' + m.value + ' | ' + m.unit + '|\n';
          });
          
          report += '\n## Metadata\n\n';
          report += '- **Query Count:** ' + results.metadata.queryCount + '\n';
          report += '- **Total Queries:** ' + results.metadata.totalQueries + '\n';
          report += '- **Use Ollama:** ' + results.metadata.useOllama + '\n';
          report += '- **Similarity Threshold:** ' + results.metadata.similarityThreshold + '\n';
          report += '- **Duration:** ' + results.metadata.duration + 'ms\n';
          
          fs.writeFileSync('./results/benchmark-report.md', report);
          console.log('Report generated');
        "
    
    - name: Upload benchmark report
      uses: actions/upload-artifact@v4
      with:
        name: benchmark-report
        path: benchmark/results/benchmark-report.md
        retention-days: 30

  deploy-results:
    needs: benchmark
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    permissions:
      contents: write
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Download benchmark results
      uses: actions/download-artifact@v4
      with:
        name: benchmark-results
        path: docs/bench/latest
    
    - name: Setup GitHub Pages
      uses: actions/configure-pages@v4
      
    - name: Build GitHub Pages
      run: |
        mkdir -p _site
        cp -r docs/bench/* _site/
        
        # Create index.html
        cat > _site/index.html << 'EOF'
        <!DOCTYPE html>
        <html>
        <head>
          <title>Semantic Cache Benchmark</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            .metric { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; }
            .metric-name { font-weight: bold; color: #666; }
            .metric-value { font-size: 24px; color: #333; }
          </style>
        </head>
        <body>
          <h1>🚀 Semantic Cache Benchmark Results</h1>
          <p>View detailed benchmark results and trends below.</p>
          <div id="metrics"></div>
          <script>
            fetch('latest/benchmark-results.json')
              .then(r => r.json())
              .then(data => {
                const container = document.getElementById('metrics');
                data.metrics.forEach(m => {
                  const div = document.createElement('div');
                  div.className = 'metric';
                  div.innerHTML = '<div class="metric-name">' + m.name + '</div><div class="metric-value">' + m.value + ' ' + m.unit + '</div>';
                  container.appendChild(div);
                });
              });
          </script>
        </body>
        </html>
        EOF
    
    - name: Upload GitHub Pages artifact
      uses: actions/upload-pages-artifact@v3
      with:
        path: _site
    
    - name: Deploy to GitHub Pages
      id: deployment
      uses: actions/deploy-pages@v4
```

**Step 2: Create Ollama check script**

Create: `.github/workflows/scripts/check-ollama.sh`

```bash
#!/bin/bash

# Check if Ollama is available
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "Ollama is running locally"
  exit 0
elif curl -s http://host.docker.internal:11434/api/tags > /dev/null 2>&1; then
  echo "Ollama is running on host"
  exit 0
else
  echo "Ollama is not available"
  exit 1
fi
```

**Step 3: Make script executable and commit**

```bash
chmod +x .github/workflows/scripts/check-ollama.sh
git add .github/workflows/benchmark.yml
git add .github/workflows/scripts/check-ollama.sh
git commit -m "ci(benchmark): add GitHub Actions workflow for automated benchmarking"
```

---

## Task 7: Documentation and README

**Files:**
- Create: `benchmark/README.md`
- Modify: `README.md` (root)

**Step 1: Write failing test for README existence**

Create: `benchmark/tests/readme.test.js`

```javascript
const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('Documentation', () => {
  test('README.md exists', () => {
    const readmePath = path.join(__dirname, '..', 'README.md');
    assert.ok(fs.existsSync(readmePath), 'README.md should exist');
  });

  test('README.md contains required sections', () => {
    const readmePath = path.join(__dirname, '..', 'README.md');
    const content = fs.readFileSync(readmePath, 'utf8');
    
    assert.ok(content.includes('Benchmark'), 'Should mention Benchmark');
    assert.ok(content.includes('Usage'), 'Should have Usage section');
    assert.ok(content.includes('Metrics'), 'Should mention Metrics');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd benchmark
npm test tests/readme.test.js
```

Expected: FAIL - README.md not found

**Step 3: Create benchmark README**

Create: `benchmark/README.md`

```markdown
# Semantic Cache Benchmark

Automated benchmark suite for measuring LLM Semantic Cache performance.

## Overview

This benchmark suite measures:
- **Cache Hit Rate**: Percentage of queries served from cache
- **Latency**: Response time for cache hits vs LLM inference
- **Token Savings**: Estimated cost savings from caching
- **Throughput**: Queries per second under load

## Quick Start

### Prerequisites

- Node.js 18+
- Ollama running locally (optional, for real LLM comparison)

### Installation

```bash
cd benchmark
npm install
```

### Run Benchmark

```bash
# With Ollama (recommended for accurate results)
npm run benchmark:ollama

# With mock data (for CI/testing)
npm run benchmark:mock

# Or use environment variables
USE_OLLAMA=true npm run benchmark
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `QUERY_COUNT` | 100 | Number of queries to run |
| `SIMILARITY_THRESHOLD` | 0.85 | Minimum similarity for semantic match |
| `USE_OLLAMA` | false | Use real Ollama LLM |
| `USE_MOCK` | true | Use mock LLM responses |
| `OUTPUT_PATH` | ./results/benchmark-results.json | Results file path |
| `OLLAMA_URL` | http://localhost:11434 | Ollama server URL |

## Metrics

The benchmark collects the following metrics:

### Performance Metrics
- **hit_rate**: Overall cache hit percentage
- **semantic_hit_rate**: Hits from semantic similarity
- **exact_hit_rate**: Hits from exact match
- **avg_hit_latency**: Average cache response time (ms)
- **p95_hit_latency**: 95th percentile cache latency (ms)
- **avg_miss_latency**: Average LLM inference time (ms)
- **speedup_factor**: How much faster cache is vs LLM

### Cost Metrics
- **tokens_saved**: Total tokens saved by caching
- **cost_saved**: Estimated cost savings in USD

## Workload Types

The benchmark generates three types of queries:

1. **RAG (40%)**: Retrieval-Augmented Generation queries
   - "What is machine learning?"
   - "Explain neural networks"

2. **Classification (30%)**: Text classification tasks
   - Categorizing news articles
   - Sentiment analysis

3. **Code Generation (30%)**: Programming queries
   - "Write a function to reverse a string"
   - "Create a debounce function"

## CI/CD Integration

The benchmark runs automatically on:
- Every push to main/master
- Pull requests
- Weekly schedule (Sundays)

Results are published to GitHub Pages.

## Results Format

Results are saved in JSON format:

```json
{
  "timestamp": "2026-01-31T12:00:00Z",
  "metrics": [
    { "name": "hit_rate", "value": 0.65, "unit": "percent" },
    ...
  ],
  "raw": {
    "totalQueries": 100,
    "cacheHits": 65,
    ...
  },
  "metadata": {
    "queryCount": 100,
    "useOllama": true,
    ...
  }
}
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/ollama-client.test.js
```

## License

MIT
```

**Step 4: Run test to verify it passes**

```bash
cd benchmark
npm test tests/readme.test.js
```

Expected: PASS

**Step 5: Update root README**

Modify: `README.md` (add benchmark section before License)

```markdown
## Benchmark

We provide an automated benchmark suite to measure Semantic Cache performance:

- **Cache Hit Rate**: Semantic vs Exact match
- **Latency**: Cache response time vs LLM inference
- **Token Savings**: Estimated cost reduction
- **Throughput**: Queries per second

### Run Benchmark

```bash
cd benchmark
npm install

# With Ollama (accurate results)
npm run benchmark:ollama

# With mock data (fast testing)
npm run benchmark:mock
```

View latest results: [Benchmark Dashboard](https://yourusername.github.io/erion-ember/)

The benchmark runs automatically via GitHub Actions on every push to main.
```

**Step 6: Commit**

```bash
git add benchmark/README.md
git add benchmark/tests/readme.test.js
git add README.md
git commit -m "docs(benchmark): add comprehensive documentation for benchmark suite"
```

---

## Task 8: Final Integration Test

**Step 1: Run all tests**

```bash
cd benchmark
npm test
```

Expected: PASS - all tests pass

**Step 2: Test benchmark locally**

```bash
cd benchmark
npm run benchmark:mock
```

Expected: 
- Benchmark runs successfully
- Results saved to `results/benchmark-results.json`
- Console shows summary with metrics

**Step 3: Verify results file structure**

```bash
cat benchmark/results/benchmark-results.json | head -50
```

Expected: Valid JSON with metrics array and metadata

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(benchmark): complete benchmark CI integration with GitHub Actions and Pages"
```

---

## Summary

### What Was Built

1. **Ollama Client** (`src/ollama-client.js`) - Interface to local Ollama for embeddings and LLM
2. **Metrics Collector** (`src/metrics-collector.js`) - Tracks hit rates, latency, token savings
3. **Workload Generator** (`src/workload-generator.js`) - Creates RAG, classification, code queries
4. **Benchmark Runner** (`src/runner.js`) - Orchestrates benchmark execution
5. **GitHub Actions Workflow** (`.github/workflows/benchmark.yml`) - CI/CD automation
6. **Documentation** - README and inline docs

### Key Features

- ✅ Two-tier caching (exact + semantic)
- ✅ Ollama integration with fallback to mock
- ✅ Comprehensive metrics (hit rate, latency, cost)
- ✅ Mixed workload (RAG, classification, code)
- ✅ CI/CD with GitHub Actions
- ✅ GitHub Pages visualization
- ✅ Test-driven development

### Next Steps

1. Enable GitHub Pages in repository settings
2. Add `BENCHER_API_TOKEN` secret if using Bencher
3. Run first benchmark: `npm run benchmark:ollama`
4. View results on GitHub Pages

---

## Plan Complete

**Plan saved to:** `docs/plans/2026-01-31-benchmark-ci-integration.md`

**Execution Options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks

**2. Parallel Session (separate)** - Open new session with executing-plans skill

Which approach would you like to use?
