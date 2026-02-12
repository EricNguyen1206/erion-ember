import { z } from 'zod';
import { SemanticCache } from '../lib/semantic-cache.js';
import { ToolResult } from '../types/index.js';

const cacheCheckSchema = z.object({
  prompt: z.string().min(1),
  embedding: z.array(z.number()).optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
});

/**
 * Cache Check tool handler
 * Check if a prompt exists in cache without storing anything
 * @param params - Tool parameters
 * @param cache - Cache instance
 * @returns Tool result
 */
export async function handleCacheCheck(
  params: Record<string, unknown>,
  cache: SemanticCache
): Promise<ToolResult> {
  const validated = cacheCheckSchema.parse(params as unknown);
  const { prompt, embedding, similarityThreshold } = validated;

  const cacheResult = await cache.get(prompt, embedding ?? null, {
    minSimilarity: similarityThreshold,
  });

  if (cacheResult) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              found: true,
              response: cacheResult.response,
              similarity: cacheResult.similarity,
              isExactMatch: cacheResult.isExactMatch,
              cachedAt: cacheResult.cachedAt,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            found: false,
            message: 'No matching entry found in cache',
          },
          null,
          2
        ),
      },
    ],
  };
}

export default handleCacheCheck;
