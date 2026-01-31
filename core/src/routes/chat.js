import { z } from 'zod';

const chatSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().default('llama3.2')
});

export async function chatRoute(fastify, options) {
  fastify.post('/chat', async (request, reply) => {
    try {
      // Validate input
      const { prompt, model } = chatSchema.parse(request.body);
      
      // TODO: Integrate with semantic cache
      // For now, return mock response
      const isCached = Math.random() > 0.5;
      
      return {
        response: isCached 
          ? `Cached: ${prompt}` 
          : `Generated: ${prompt}`,
        cached: isCached,
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
