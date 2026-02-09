const Fastify = require('fastify');

const fastify = Fastify();

fastify.addHook('onRequest', async (request, reply) => {
  console.log('onRequest - url:', request.url);
  console.log('onRequest - routerPath:', request.routerPath);
  console.log('onRequest - routeOptions:', request.routeOptions);
});

fastify.get('/health', async () => ({ status: 'ok' }));

fastify.listen({ port: 3009 }, (err) => {
  if (err) throw err;
  console.log('Server listening on port 3009');

  // Test request
  fetch('http://localhost:3009/health?q=1').then(async (res) => {
    console.log('Response:', await res.json());
    process.exit(0);
  });
});
