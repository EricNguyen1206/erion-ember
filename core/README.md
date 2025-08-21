# Core Service

Bun + Fastify HTTP API for Semantic Cache.

## Features

- ✅ Bun runtime for optimal performance
- ✅ Fastify web framework
- ✅ Semantic caching for LLM responses
- ✅ Health check endpoint
- ✅ Input validation with Zod
- ✅ In-memory cache with similarity matching

## Quick Start

```bash
# Install dependencies
bun install

# Development mode
bun run dev

# Production mode
bun run start

# Run tests
bun test
```

## API Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-31T22:00:00.000Z"
}
```

### POST /v1/chat

Chat with semantic caching.

**Request:**
```json
{
  "prompt": "What is machine learning?",
  "model": "llama3.2"
}
```

**Response (cached):**
```json
{
  "response": "Generated response for: What is machine learning?",
  "cached": true,
  "similarity": 1.0,
  "model": "llama3.2",
  "timestamp": "2026-01-31T22:00:00.000Z"
}
```

**Response (not cached):**
```json
{
  "response": "Generated response for: What is machine learning?",
  "cached": false,
  "model": "llama3.2",
  "timestamp": "2026-01-31T22:00:00.000Z"
}
```

## Development

### Project Structure

```
core/
├── src/
│   ├── cache/              # Semantic cache implementation
│   │   ├── simple-cache.js  # In-memory cache
│   │   └── index.js        # Cache exports
│   ├── routes/
│   │   └── chat.js        # Chat endpoint
│   └── server.js          # Fastify server
├── tests/
│   └── server.test.js      # Server tests
├── package.json
└── Dockerfile
```

### Adding New Endpoints

1. Create route file in `src/routes/`
2. Register in `src/server.js`
3. Add tests in `tests/`

Example:
```javascript
// src/routes/example.js
export async function exampleRoute(fastify, options) {
  fastify.get('/example', async (request, reply) => {
    return { message: 'Hello' };
  });
}

// src/server.js
fastify.register(exampleRoute, { prefix: '/v1' });
```

## Testing

Run tests with Bun:
```bash
bun test
```

Tests include:
- Server startup
- API endpoints
- Input validation
- Cache functionality

## Docker

Build and run with Docker:
```bash
# Build image
docker build -t erion-core .

# Run container
docker run -p 3000:3000 erion-core
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `REDIS_URL`: Redis connection URL (optional)
- `OLLAMA_URL`: Ollama API URL (optional)
- `NODE_ENV`: Environment (development/production)

## License

MIT
