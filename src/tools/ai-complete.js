import { z } from 'zod';

const aiCompleteSchema = z.object({
  prompt: z.string().min(1),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.any()).optional(),
  similarityThreshold: z.number().min(0).max(1).optional()
});

/**
 * AI Complete tool handler
 * Checks cache for similar prompts and returns cached response if found
 * @param {object} params - Tool parameters
 * @param {SemanticCache} cache - Cache instance
 * @returns {object} Tool result
 */
export async function handleAiComplete(params, cache) {
  const validated = aiCompleteSchema.parse(params);
  const { prompt, embedding, metadata, similarityThreshold } = validated;

  // Check cache
  const cacheResult = await cache.get(prompt, embedding, {
    minSimilarity: similarityThreshold
  });

  if (cacheResult) {
    // Cache hit
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          cached: true,
          response: cacheResult.response,
          similarity: cacheResult.similarity,
          isExactMatch: cacheResult.isExactMatch,
          cachedAt: cacheResult.cachedAt
        }, null, 2)
      }]
    };
  }

  // Cache miss - client needs to call AI provider
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        cached: false,
        message: 'Cache miss. Please call your AI provider and then use cache_store to save the response.'
      }, null, 2)
    }]
  };
}

export default handleAiComplete;
