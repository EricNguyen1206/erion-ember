import { z } from 'zod';

const cacheStoreSchema = z.object({
  prompt: z.string().min(1),
  response: z.string().min(1),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.any()).optional(),
  ttl: z.number().positive().optional()
});

/**
 * Cache Store tool handler
 * Store a prompt/response pair in the cache
 * @param {object} params - Tool parameters
 * @param {SemanticCache} cache - Cache instance
 * @param {EmbeddingService} embeddingService - Embedding service instance
 * @returns {object} Tool result
 */
export async function handleCacheStore(params, cache, embeddingService) {
  const validated = cacheStoreSchema.parse(params);
  const { prompt, response, embedding, metadata, ttl } = validated;

  // Use provided embedding or generate one
  let vector = embedding;
  if (!vector && embeddingService.isConfigured()) {
    const embeddingResult = await embeddingService.generate(prompt);
    if (embeddingResult) {
      vector = embeddingResult.embedding;
    }
  }

  // Store in cache (exact-match only if no embedding)
  await cache.set(prompt, response, vector || new Array(1536).fill(0), {
    ttl,
    metadata
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        message: 'Response stored in cache',
        hasEmbedding: Boolean(vector)
      }, null, 2)
    }]
  };
}

export default handleCacheStore;
