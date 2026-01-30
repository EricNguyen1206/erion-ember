#!/usr/bin/env node

/**
 * Semantic Cache Server
 * High-performance semantic cache for LLM queries
 */

const SemanticCache = require('./semantic-cache');

class CacheServer {
  constructor(options = {}) {
    this.cache = new SemanticCache({
      dim: options.dim || 1536,
      maxElements: options.maxElements || 100000,
      similarityThreshold: options.similarityThreshold || 0.85
    });
    
    this.port = options.port || 3000;
  }

  async start() {
    console.log('🚀 Starting Semantic Cache Server...');
    console.log(`📊 Configuration: ${this.cache.maxElements} max entries`);
    console.log(`🎯 Similarity threshold: ${this.cache.similarityThreshold}`);
    console.log('✅ Cache server ready');
    
    // Print stats every 30 seconds
    setInterval(() => {
      const stats = this.cache.getStats();
      console.log('📈 Stats:', JSON.stringify(stats, null, 2));
    }, 30000);
  }

  stop() {
    console.log('🛑 Stopping server...');
    this.cache.destroy();
    process.exit(0);
  }
}

// Start if run directly
if (require.main === module) {
  const server = new CacheServer({
    dim: parseInt(process.env.CACHE_DIM) || 1536,
    maxElements: parseInt(process.env.CACHE_MAX_ELEMENTS) || 100000,
    similarityThreshold: parseFloat(process.env.CACHE_THRESHOLD) || 0.85,
    port: parseInt(process.env.CACHE_PORT) || 3000
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => server.stop());
  process.on('SIGTERM', () => server.stop());
  
  server.start().catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { CacheServer, SemanticCache };
