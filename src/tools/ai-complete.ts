import { z } from 'zod';
import { SemanticCache } from '../lib/semantic-cache.js';
import { ToolResult } from '../types/index.js';

const aiCompleteSchema = z.object({
  prompt: z.string().min(1),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
});

/**
 * AI Complete tool handler
 * Checks cache for similar prompts and returns cached response if found
 * @param params - Tool parameters
 * @param cache - Cache instance
 * @returns Tool result
 */
export async function handleAiComplete(
  params: Record<string, unknown>,
  cache: SemanticCache
): Promise<ToolResult> {
  const validated = aiCompleteSchema.parse(params as unknown);
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
              cached: true,
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
            cached: false,
            message: 'Cache miss. Please call your AI provider and then use cache_store to save the response.',
          },
          null,
          2
        ),
      },
    ],
  };
}

export default handleAiComplete;
