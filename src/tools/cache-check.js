import { z } from 'zod';

const cacheCheckSchema = z.object({
  prompt: z.string().min(1),
  embedding: z.array(z.number()).optional(),
  similarityThreshold: z.number().min(0).max(1).optional()
});

/**
 * Cache Check tool handler
 * Check if a prompt exists in cache without storing anything
 * @param {object} params - Tool parameters
 * @param {SemanticCache} cache - Cache instance
 * @returns {object} Tool result
 */
export async function handleCacheCheck(params, cache) {
  const validated = cacheCheckSchema.parse(params);
  const { prompt, embedding, similarityThreshold } = validated;

  const cacheResult = await cache.get(prompt, embedding, {
    minSimilarity: similarityThreshold
  });

  if (cacheResult) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          found: true,
          response: cacheResult.response,
          similarity: cacheResult.similarity,
          isExactMatch: cacheResult.isExactMatch,
          cachedAt: cacheResult.cachedAt
        }, null, 2)
      }]
    };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        found: false,
        message: 'No matching entry found in cache'
      }, null, 2)
    }]
  };
}

export default handleCacheCheck;
