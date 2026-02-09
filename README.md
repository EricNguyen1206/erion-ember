# 🚀 Erion Ember

LLM Semantic Cache MCP Server - Production-ready semantic caching for AI coding assistants via the Model Context Protocol.

## Overview

Erion Ember provides an MCP server that caches LLM responses using semantic similarity matching. It integrates with AI coding assistants like Claude Code, Opencode, and Codex to reduce API costs and latency.

## Features

- ✅ **MCP Protocol**: Standardized tool interface for AI assistants
- ✅ **Semantic Caching**: Intelligent cache with vector similarity matching
- ✅ **Multi-Provider**: Works with any AI provider (Claude, OpenAI, Groq, etc.)
- ✅ **Dual Vector Backends**: 
  - **Annoy.js** (default): Pure JavaScript, works immediately
  - **HNSW** (optimized): C++ implementation, maximum performance via Docker
- ✅ **Embedding Generation**: Built-in embedding service (OpenAI or mock)
- ✅ **Cost Tracking**: Monitor token savings and cost reductions
- ✅ **Bun Runtime**: Blazing fast JavaScript runtime

## Quick Start

### Prerequisites

- Bun runtime (v1.0+)
- Docker (optional, for hnswlib optimization)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/erion-ember.git
cd erion-ember

# Install dependencies
bun install
```

### Development (Annoy.js - Works Immediately)

```bash
# Works immediately, no build tools needed
bun run dev
```

The server uses **Annoy.js** by default - a pure JavaScript vector search library that requires no native compilation.

### Production (HNSW - Maximum Performance)

```bash
# Build Docker image with hnswlib compiled
bun run docker:build

# Run with hnswlib backend
bun run docker:run
```

## Vector Index Backends

### Annoy.js (Default)

- ✅ **Zero dependencies** - Pure JavaScript
- ✅ **Immediate startup** - No build tools needed
- ✅ **Cross-platform** - Works everywhere
- ⚡ **Performance**: ~1-5ms search for 10K vectors
- 📦 **Best for**: Development, testing, smaller caches

### HNSW (Optimized)

- 🚀 **Maximum performance** - State-of-the-art C++ implementation
- 📈 **Scales to millions** - Efficient for large vector sets
- 🐳 **Docker recommended** - Pre-built with all dependencies
- ⚡ **Performance**: ~0.1-1ms search for 100K+ vectors
- 📦 **Best for**: Production, large-scale deployments

### Selecting Backend

Via environment variable:
```bash
# Annoy.js (default, pure JS)
VECTOR_INDEX_BACKEND=annoy bun run dev

# HNSW (C++, requires build tools or Docker)
VECTOR_INDEX_BACKEND=hnsw bun run dev
```

## Usage with MCP Clients

### Claude Code

Add to Claude Code configuration:

```json
{
  "mcpServers": {
    "erion-ember": {
      "command": "bun",
      "args": ["run", "/path/to/erion-ember/src/mcp-server.js"],
      "env": {
        "EMBEDDING_PROVIDER": "mock"
      }
    }
  }
}
```

### Opencode

Add to `.opencode/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "erion-ember",
      "command": "bun run /path/to/erion-ember/src/mcp-server.js",
      "env": {
        "EMBEDDING_PROVIDER": "mock"
      }
    }
  ]
}
```

## Available Tools

### `ai_complete`

Check cache for a prompt and return cached response or indicate cache miss.

**Parameters:**
- `prompt` (string, required): The prompt to complete
- `embedding` (number[], optional): Pre-computed embedding vector
- `metadata` (object, optional): Additional metadata to store
- `similarityThreshold` (number, optional): Override similarity threshold (0-1)

**Response (cache hit):**
```json
{
  "cached": true,
  "response": "Cached response text...",
  "similarity": 0.95,
  "isExactMatch": false,
  "cachedAt": "2026-02-08T10:30:00.000Z"
}
```

**Response (cache miss):**
```json
{
  "cached": false,
  "message": "Cache miss. Please call your AI provider..."
}
```

### `cache_store`

Store a prompt/response pair in the cache.

**Parameters:**
- `prompt` (string, required): The prompt to cache
- `response` (string, required): The AI response
- `embedding` (number[], optional): Pre-computed embedding
- `metadata` (object, optional): Additional metadata
- `ttl` (number, optional): Time-to-live in seconds (preserved across cache save/load)

### `cache_check`

Check if a prompt exists in cache without storing.

**Parameters:**
- `prompt` (string, required): The prompt to check
- `embedding` (number[], optional): Pre-computed embedding
- `similarityThreshold` (number, optional): Override similarity threshold

### `generate_embedding`

Generate embedding vector for text.

**Parameters:**
- `text` (string, required): Text to embed
- `model` (string, optional): Embedding model to use (OpenAI only; mock echoes label)

**Response:**
```json
{
  "embedding": [0.1, 0.2, ...],
  "model": "mock-embedding-model",
  "dimension": 1536
}
```

### `cache_stats`

Get cache statistics.

**Response:**
```json
{
  "totalEntries": 100,
  "memoryUsage": { "vectors": 153600, "metadata": 10240 },
  "compressionRatio": "0.45",
  "cacheHits": 250,
  "cacheMisses": 50,
  "hitRate": "0.8333",
  "totalQueries": 300,
  "savedTokens": 15000,
  "savedUsd": 0.45
}
```

## Workflow Example

```javascript
// 1. Check cache first
const result = await mcpClient.callTool('ai_complete', {
  prompt: 'Explain quantum computing'
});

if (result.cached) {
  // Use cached response
  return result.response;
}

// 2. Cache miss - call your AI provider
const aiResponse = await callClaudeAPI('Explain quantum computing');

// 3. Store in cache for future use
await mcpClient.callTool('cache_store', {
  prompt: 'Explain quantum computing',
  response: aiResponse
});

return aiResponse;
```

## Development

```bash
# Run in development mode (Annoy.js backend)
bun run dev

# Run tests
bun test

# Run specific test file
bun test tests/vector-index/annoy-index.test.js

# Build Docker image
bun run docker:build

# Run Docker container with hnswlib
bun run docker:run
```

## Testing

The project includes comprehensive tests:

- **Unit tests**: Individual components (SemanticCache, EmbeddingService)
- **Integration tests**: Full MCP protocol workflow
- **Vector index tests**: Both Annoy.js and HNSW implementations

```bash
# Run all tests
bun test

# Run vector index tests only
bun test tests/vector-index/

# Run with coverage
bun test --coverage
```

## Project Structure

```
erion-ember/
├── src/
│   ├── mcp-server.js          # MCP server entry point
│   ├── lib/                   # Core caching logic
│   │   ├── semantic-cache.js
│   │   ├── vector-index/      # Pluggable vector search
│   │   │   ├── interface.js   # Abstract interface
│   │   │   ├── index.js       # Factory
│   │   │   ├── annoy-index.js # Pure JS implementation
│   │   │   └── hnsw-index.js  # C++ implementation
│   │   ├── quantizer.js
│   │   ├── compressor.js
│   │   ├── normalizer.js
│   │   └── metadata-store.js
│   ├── services/
│   │   └── embedding-service.js
│   └── tools/                 # MCP tool handlers
│       ├── ai-complete.js
│       ├── cache-check.js
│       ├── cache-store.js
│       ├── cache-stats.js
│       └── generate-embedding.js
├── tests/
│   ├── lib/                   # Core library tests
│   ├── services/              # Service tests
│   ├── vector-index/          # Vector index tests
│   └── mcp-server.test.js     # Server protocol tests
├── Dockerfile                 # Multi-stage build with hnswlib
├── .env.example               # Environment configuration
└── package.json
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VECTOR_INDEX_BACKEND` | Vector search backend: `annoy` or `hnsw` | `annoy` |
| `EMBEDDING_PROVIDER` | Embedding provider: `mock` or `openai` | `mock` |
| `OPENAI_API_KEY` | OpenAI API key (if provider=openai) | - |
| `CACHE_SIMILARITY_THRESHOLD` | Minimum similarity for cache hits | `0.85` |
| `CACHE_MAX_ELEMENTS` | Maximum cache entries | `100000` |
| `CACHE_DEFAULT_TTL` | Default TTL in seconds | `3600` |
| `NODE_ENV` | Environment mode | `development` |

## Performance Comparison

| Backend | Search Time (10K vectors) | Search Time (100K vectors) | Build Time | Dependencies |
|---------|---------------------------|----------------------------|------------|--------------|
| **Annoy.js** | ~2-5ms | ~10-20ms | Fast | None (pure JS) |
| **HNSW** | ~0.5-1ms | ~1-3ms | Medium | C++ build tools |

## Troubleshooting

### C++ Build Errors (hnswlib)

If you encounter C++ build errors with hnswlib:

```bash
# Option 1: Use Annoy.js (recommended for development)
VECTOR_INDEX_BACKEND=annoy bun run dev

# Option 2: Use Docker
bun run docker:build
bun run docker:run
```

### MCP Connection Issues

- Ensure the server is outputting valid JSON-RPC to stdout
- Check stderr for error messages
- Verify environment variables are set correctly

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Bun](https://bun.sh/)
- Vector search: [Annoy.js](https://github.com/DanielKRing1/Annoy.js) (pure JS) and [hnswlib-node](https://github.com/yahoojapan/hnswlib-node) (C++)
- MCP Protocol: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol)
- Protocol: [Model Context Protocol](https://modelcontextprotocol.io/)
