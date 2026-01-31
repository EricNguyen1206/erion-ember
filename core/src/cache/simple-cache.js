/**
 * Simple in-memory cache for demonstration
 * TODO: Replace with full semantic cache implementation
 */
class SimpleCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.similarityThreshold = options.similarityThreshold || 0.85;
  }

  async get(prompt) {
    // Check exact match first
    if (this.cache.has(prompt)) {
      const entry = this.cache.get(prompt);
      return {
        response: entry.response,
        similarity: 1.0,
        isExactMatch: true,
        cachedAt: new Date(entry.timestamp)
      };
    }
    
    // Simple semantic matching (exact word overlap for now)
    for (const [key, entry] of this.cache.entries()) {
      const similarity = this._calculateSimilarity(prompt, key);
      if (similarity >= this.similarityThreshold) {
        return {
          response: entry.response,
          similarity,
          isExactMatch: false,
          cachedAt: new Date(entry.timestamp)
        };
      }
    }
    
    return null;
  }

  async set(prompt, response, embedding) {
    this.cache.set(prompt, {
      response,
      timestamp: Date.now()
    });
  }

  _calculateSimilarity(str1, str2) {
    // Simple word overlap similarity
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  getStats() {
    return {
      totalEntries: this.cache.size,
      memoryUsage: this.cache.size * 100 // rough estimate
    };
  }
}

export { SimpleCache };
