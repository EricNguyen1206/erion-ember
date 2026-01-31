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
