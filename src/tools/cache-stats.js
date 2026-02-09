/**
 * Cache Stats tool handler
 * Get cache statistics and savings metrics
 * @param {object} params - Tool parameters (unused)
 * @param {SemanticCache} cache - Cache instance
 * @returns {object} Tool result
 */
export async function handleCacheStats(params, cache) {
  const stats = cache.getStats();

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        totalEntries: stats.totalEntries,
        memoryUsage: stats.memoryUsage,
        compressionRatio: stats.compressionRatio,
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        hitRate: stats.hitRate,
        totalQueries: stats.totalQueries,
        savedTokens: stats.savedTokens,
        savedUsd: stats.savedUsd
      }, null, 2)
    }]
  };
}

export default handleCacheStats;
