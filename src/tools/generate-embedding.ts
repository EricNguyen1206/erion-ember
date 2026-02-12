import { z } from 'zod';
import { EmbeddingService } from '../services/embedding-service.js';
import { ToolResult } from '../types/index.js';

const generateEmbeddingSchema = z.object({
  text: z.string().min(1),
  model: z.string().optional(),
});

/**
 * Generate Embedding tool handler
 * Generate embedding vector for text
 * @param params - Tool parameters
 * @param embeddingService - Embedding service instance
 * @returns Tool result
 */
export async function handleGenerateEmbedding(
  params: Record<string, unknown>,
  embeddingService: EmbeddingService
): Promise<ToolResult> {
  const { text } = generateEmbeddingSchema.parse(params as unknown);
  const result = await embeddingService.generate(text);

  if (!result) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: 'Failed to generate embedding' }, null, 2),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            embedding: result.embedding,
            model: result.model,
            dimension: result.embedding.length,
          },
          null,
          2
        ),
      },
    ],
  };
}

export default handleGenerateEmbedding;
