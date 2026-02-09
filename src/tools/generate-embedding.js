import { z } from 'zod';

const generateEmbeddingSchema = z.object({
  text: z.string().min(1),
  model: z.string().optional()
});

/**
 * Generate Embedding tool handler
 * Generate embedding vector for text
 * @param {object} params - Tool parameters
 * @param {EmbeddingService} embeddingService - Embedding service instance
 * @returns {object} Tool result
 */
export async function handleGenerateEmbedding(params, embeddingService) {
  const validated = generateEmbeddingSchema.parse(params);
  const { text, model } = validated;

  if (!embeddingService.isConfigured()) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Embedding service not configured',
          message: 'Please set OPENAI_API_KEY environment variable or use mock provider'
        }, null, 2)
      }],
      isError: true
    };
  }

  const result = await embeddingService.generate(text, model);

  if (!result) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Failed to generate embedding'
        }, null, 2)
      }],
      isError: true
    };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        embedding: result.embedding,
        model: result.model,
        dimension: result.embedding.length
      }, null, 2)
    }]
  };
}

export default handleGenerateEmbedding;
