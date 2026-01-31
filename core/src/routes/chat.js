import { z } from 'zod';
import { SimpleCache } from '../cache/simple-cache.js';

const chatSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().default('llama3.2')
});

// Initialize cache
const cache = new SimpleCache({
  similarityThreshold: 0.85
});

export async function chatRoute(fastify, options) {
  fastify.post('/chat', async (request, reply) => {
    try {
      const { prompt, model } = chatSchema.parse(request.body);
      
      // Try cache first
      const cached = await cache.get(prompt);
      if (cached) {
        return {
          response: cached.response,
          cached: true,
          similarity: cached.similarity,
          model,
          timestamp: new Date().toISOString()
        };
      }
      
      // TODO: Call Ollama for generation
      const response = `Generated response for: ${prompt}`;
      
      // Store in cache
      await cache.set(prompt, response);
      
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
