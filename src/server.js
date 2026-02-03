import Fastify from 'fastify';
import cors from '@fastify/cors';
import { chatRoute } from './routes/chat.js';

const fastify = Fastify({
  logger: true
});

// Register plugins
await fastify.register(cors);

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// API routes
fastify.register(chatRoute, { prefix: '/v1' });

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
