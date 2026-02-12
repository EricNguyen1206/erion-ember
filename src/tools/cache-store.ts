import { z } from 'zod';
import { SemanticCache } from '../lib/semantic-cache.js';
import { EmbeddingService } from '../services/embedding-service.js';
import { ToolResult } from '../types/index.js';

const cacheStoreSchema = z.object({
  prompt: z.string().min(1),
  response: z.string().min(1),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ttl: z.number().positive().optional(),
});

/**
 * Cache Store tool handler
 * Store a prompt and its AI response in the semantic cache
 * @param params - Tool parameters
 * @param cache - Cache instance
 * @param embeddingService - Embedding service instance
 * @returns Tool result
 */
export async function handleCacheStore(
  params: Record<string, unknown>,
  cache: SemanticCache,
  embeddingService: EmbeddingService
): Promise<ToolResult> {
  const { prompt, response, embedding, metadata, ttl } = cacheStoreSchema.parse(params as unknown);

  let vector: number[] | undefined = embedding;
  if (!vector) {
    const result = await embeddingService.generate(prompt);
    if (result) vector = result.embedding;
  }

  if (!vector) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: 'Embedding required for semantic cache. Could not generate embedding.',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  await cache.set(prompt, response, vector, { ttl, metadata });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            message: 'Response stored in cache',
            hasEmbedding: Boolean(vector),
          },
          null,
          2
        ),
      },
    ],
  };
}

export default handleCacheStore;
