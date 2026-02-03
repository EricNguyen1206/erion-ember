import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { chatRoute } from './routes/chat.js';

const fastify = Fastify({
  logger: true
});

// Register plugins
await fastify.register(cors);
await fastify.register(rateLimit, {
  max: process.env.RATE_LIMIT_MAX || 60,
  timeWindow: '1 minute'
});

// Authentication Hook
fastify.addHook('onRequest', async (request, reply) => {
  // Use routeOptions.url (Fastify v4+) or fallback to routerPath (deprecated)
  const routePath = request.routeOptions?.url || request.routerPath;
  if (routePath === '/health' || request.url === '/health') {
    return;
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return; // Allow access if server key is not configured
  }

  const clientKey = request.headers['x-api-key'];
  if (clientKey !== apiKey) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing API key' });
  }
});

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// API routes
fastify.register(chatRoute, { prefix: '/v1' });

// Start server
const start = async () => {
  try {
    if (!process.env.API_KEY) {
      console.warn('⚠️ WARNING: process.env.API_KEY is missing. API is open to the public.');
    }

    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
