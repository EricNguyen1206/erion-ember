import { z } from 'zod';
import SemanticCache from '../lib/semantic-cache.js';

const chatSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().default('llama3.2')
});

// Initialize cache
// Note: In production, you might want to move this to a singleton or inject it
const cache = new SemanticCache({
  similarityThreshold: 0.85,
  dim: 1536 // OpenAI ada-002 dimension, adjust if using different embedding model
});

export async function chatRoute(fastify, options) {
  fastify.post('/chat', async (request, reply) => {
    try {
      const { prompt, model } = chatSchema.parse(request.body);

      // TODO: Generate embedding for the prompt using an embedding model (e.g. OpenAI, Ollama)
      // const embedding = await getEmbedding(prompt);
      const embedding = null; // Placeholder: Semantic search requires an embedding

      // Try cache first
      // If embedding is null, it performs exact match only (using hash)
      const cached = await cache.get(prompt, embedding);

      if (cached) {
        return {
          response: cached.response,
          cached: true,
          similarity: cached.similarity,
          model,
          timestamp: new Date().toISOString(),
          metadata: cached.metadata
        };
      }

      // TODO: Call Ollama for generation
      const response = `Generated response for: ${prompt}`;

      // Store in cache
      // We need an embedding to store it for future semantic retrieval
      // If embedding is null, it's stored but only retrievable by exact match
      // For now, we pass a dummy embedding if we want to test vector storage,
      // but strictly we should wait for real embedding.
      // cache.set() expects an embedding for indexing.
      // If we pass null to set(), SemanticCache.set() might crash depending on implementation.
      // Let's check SemanticCache.set().

      // Checking source:
      // const quantizedVector = this.quantizer.quantize(embedding);
      // It will crash if embedding is null.

      // So we can only cache if we have an embedding.
      if (embedding) {
          await cache.set(prompt, response, embedding);
      } else {
          // If we want to support exact-match-only caching without embeddings,
          // SemanticCache needs modification or we provide a zero vector.
          // For now, we skip caching if no embedding, or we can use the old SimpleCache logic temporarily?
          // No, we must use SemanticCache.
          // Let's assume for this refactor we just skip 'set' if no embedding.
          // Or providing a dummy zero vector?
          // A zero vector would cluster everything together. Bad idea.

          // I'll skip cache.set if no embedding, effectively disabling cache writes until embeddings are implemented.
          // This is safer than corrupting the index.
          console.warn('Skipping cache set: No embedding available. Implement embedding generation.');
      }

      return {
        response,
        cached: false,
        model,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.status(400);
        return { error: 'Invalid input', details: error.errors };
      }
      throw error;
    }
  });
}
