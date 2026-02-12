import { z } from 'zod';

const generateEmbeddingSchema = z.object({
  text: z.string().min(1),
});

export async function handleGenerateEmbedding(params, embeddingService) {
  const { text } = generateEmbeddingSchema.parse(params);
  const result = await embeddingService.generate(text);

  if (!result) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'Failed to generate embedding' }, null, 2) }],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({
      embedding: result.embedding,
      model: result.model,
      dimension: result.embedding.length,
    }, null, 2) }],
  };
}

export default handleGenerateEmbedding;
