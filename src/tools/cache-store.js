import { z } from 'zod';

const cacheStoreSchema = z.object({
  prompt: z.string().min(1),
  response: z.string().min(1),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.any()).optional(),
  ttl: z.number().positive().optional(),
});

export async function handleCacheStore(params, cache, embeddingService) {
  const { prompt, response, embedding, metadata, ttl } = cacheStoreSchema.parse(params);

  let vector = embedding;
  if (!vector) {
    const result = await embeddingService.generate(prompt);
    if (result) vector = result.embedding;
  }

  if (!vector) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: 'Embedding required for semantic cache. Could not generate embedding.',
      }, null, 2) }],
      isError: true,
    };
  }

  await cache.set(prompt, response, vector, { ttl, metadata });

  return {
    content: [{ type: 'text', text: JSON.stringify({
      success: true,
      message: 'Response stored in cache',
      hasEmbedding: Boolean(vector),
    }, null, 2) }],
  };
}

export default handleCacheStore;
