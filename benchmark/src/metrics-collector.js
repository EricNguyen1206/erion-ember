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
      exactHits: this.exactHits,
      semanticHits: this.semanticHits,
      
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
      totalQueries: metrics.totalQueries,
      cacheHits: metrics.cacheHits,
      cacheMisses: metrics.cacheMisses,
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
