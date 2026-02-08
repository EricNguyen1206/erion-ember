# Migration Guide: v1.x to v2.0.0

## Overview

Erion Ember v2.0.0 introduces **breaking changes** with the migration from HTTP API to MCP protocol. This guide helps you transition existing integrations.

## Key Changes

| v1.x (HTTP API) | v2.0.0 (MCP) | Impact |
|----------------|--------------|---------|
| Fastify HTTP server | MCP stdio transport | High - Protocol change |
| POST /v1/chat endpoint | `ai_complete` tool | High - Client update required |
| Groq API integration | Provider-agnostic | Medium - Bring your own LLM |
| HNSW only | Annoy.js + HNSW | Low - Better compatibility |
| Rate limiting | Removed | Medium - Client responsibility |
| API key auth | Removed | Medium - Process isolation |

## Migration Steps

### 1. Update Client Integration

#### Before (HTTP API)
```javascript
// v1.x - HTTP Client
const response = await fetch('http://localhost:3000/v1/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'What is machine learning?',
    model: 'llama3.2'
  })
});

const result = await response.json();
if (result.cached) {
  return result.response;
} else {
  // Get response from LLM
  const aiResponse = await callLLM(result.prompt);
  return aiResponse;
}
```

#### After (MCP Protocol)
```javascript
// v2.0.0 - MCP Client
const client = new MCPClient({
  command: 'bun run src/mcp-server.js'
});

// Step 1: Check cache
const checkResult = await client.callTool('ai_complete', {
  prompt: 'What is machine learning?'
});

if (checkResult.cached) {
  return checkResult.response;
}

// Step 2: Call LLM on cache miss
const aiResponse = await callLLM('What is machine learning?');

// Step 3: Store in cache
await client.callTool('cache_store', {
  prompt: 'What is machine learning?',
  response: aiResponse
});

return aiResponse;
```

### 2. Update Environment Configuration

#### Before (.env v1.x)
```bash
PORT=3000
GROQ_API_KEY=sk-...
REDIS_URL=redis://localhost:6379
API_KEY=optional-secret
SIMILARITY_THRESHOLD=0.85
```

#### After (.env v2.0.0)
```bash
# Vector backend (new)
VECTOR_INDEX_BACKEND=annoy

# Embedding (changed)
EMBEDDING_PROVIDER=mock
# OPENAI_API_KEY=sk-...  # If using OpenAI

# Cache config (unchanged)
CACHE_SIMILARITY_THRESHOLD=0.85
CACHE_MAX_ELEMENTS=100000
CACHE_DEFAULT_TTL=3600

# Server
NODE_ENV=production
```

### 3. Update Deployment

#### Before (Docker v1.x)
```yaml
# docker-compose.yml
services:
  erion-ember:
    build: .
    ports:
      - "3000:3000"
    environment:
      - GROQ_API_KEY=${GROQ_API_KEY}
```

#### After (Docker v2.0.0)
```yaml
# docker-compose.yml
services:
  erion-ember:
    build: .
    # No ports needed - uses stdio
    environment:
      - VECTOR_INDEX_BACKEND=hnsw
      - EMBEDDING_PROVIDER=openai
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

### 4. Update Tests

#### Before (HTTP Testing)
```javascript
// v1.x
const response = await request(app)
  .post('/v1/chat')
  .send({ prompt: 'test' });
expect(response.status).toBe(200);
```

#### After (MCP Testing)
```javascript
// v2.0.0
const result = await mcpClient.callTool('ai_complete', {
  prompt: 'test'
});
expect(result.content).toBeDefined();
```

## Feature Mapping

### API Endpoints → MCP Tools

| v1.x Endpoint | v2.0.0 Tool | Notes |
|--------------|------------|-------|
| `POST /v1/chat` | `ai_complete` | Returns cache hit or miss |
| `GET /stats` | `cache_stats` | Returns metrics |
| `GET /health` | N/A | Use process health checks |

### Request/Response Changes

#### Cache Hit Response

**v1.x:**
```json
{
  "response": "Cached text...",
  "cached": true,
  "similarity": 0.95,
  "model": "llama3.2"
}
```

**v2.0.0:**
```json
{
  "content": [{
    "type": "text",
    "text": "{\"cached\":true,\"response\":\"Cached text...\",\"similarity\":0.95}"
  }]
}
```

## Breaking Changes

### 1. Protocol Change (High Impact)
- **What:** HTTP REST → MCP stdio
- **Why:** Standardization, security, simplicity
- **Action:** Complete client rewrite required

### 2. Groq Removal (High Impact)
- **What:** Integrated Groq API → Bring your own LLM
- **Why:** Provider agnosticism
- **Action:** Implement LLM calls in your client

### 3. No HTTP Health Checks (Medium Impact)
- **What:** Removed /health endpoint
- **Why:** MCP uses stdio, not HTTP
- **Action:** Use process health checks instead

### 4. No Rate Limiting (Medium Impact)
- **What:** Removed rate limiting middleware
- **Why:** Client-side responsibility in MCP
- **Action:** Implement rate limiting in client if needed

### 5. No API Key Auth (Low Impact)
- **What:** Removed API key authentication
- **Why:** Process isolation provides security
- **Action:** None - security handled by OS

## Rollback Strategy

If you need to rollback to v1.x:

```bash
# Checkout v1.0.0 tag
git checkout v1.0.0

# Install v1 dependencies
bun install

# Start HTTP server
bun run start
```

## Troubleshooting

### Issue: MCP client can't connect
**Solution:** Ensure the server executable has correct permissions and environment variables are set.

### Issue: Cache always returns miss
**Solution:** Verify embedding generation is working. Check `cache_stats` tool output.

### Issue: HNSW backend fails to start
**Solution:** Use Annoy.js backend for development: `VECTOR_INDEX_BACKEND=annoy`

### Issue: Performance slower than v1.x
**Solution:** Ensure you're using appropriate backend. Annoy.js is slower but requires no build.

## Benefits of Migration

1. **Standard Protocol** - MCP is emerging as the standard for AI tools
2. **Better Security** - Process isolation vs network exposure
3. **Provider Flexibility** - Works with any LLM provider
4. **Simpler Deployment** - No port management, no reverse proxy needed
5. **Zero Build Friction** - Annoy.js backend works immediately

## Timeline

- **Immediate:** Update client code to use MCP protocol
- **Week 1:** Test with Annoy.js backend
- **Week 2:** Migrate to Docker with HNSW for production
- **Ongoing:** Monitor cache hit rates and performance

## Support

- **Issues:** https://github.com/yourusername/erion-ember/issues
- **Documentation:** See README.md and docs/
- **Examples:** Check `examples/` directory

---

**Need Help?** Open a GitHub discussion for migration support.
