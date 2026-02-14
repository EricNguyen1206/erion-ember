import { SemanticCache } from '../lib/semantic-cache.js';
import { ToolResult } from '../types/index.js';

/**
 * Cache Stats tool handler
 * Get cache statistics and savings metrics
 * @param _params - Tool parameters (unused)
 * @param cache - Cache instance
 * @returns Tool result
 */
export async function handleCacheStats(
  _params: Record<string, unknown>,
  cache: SemanticCache
): Promise<ToolResult> {
  const stats = await cache.getStats();

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            totalEntries: stats.totalEntries,
            memoryUsage: stats.memoryUsage,
            compressionRatio: stats.compressionRatio,
            cacheHits: stats.cacheHits,
            cacheMisses: stats.cacheMisses,
            hitRate: stats.hitRate,
            totalQueries: stats.totalQueries,
            savedTokens: stats.savedTokens,
            savedUsd: stats.savedUsd,
          },
          null,
          2
        ),
      },
    ],
  };
}

export default handleCacheStats;
