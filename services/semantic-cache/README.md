# Semantic Cache

High-performance semantic cache for LLM queries with HNSW vector search.

## Features

- **HNSW Vector Search**: C++ bindings for fast approximate nearest neighbor search
- **INT8 Quantization**: 75% memory reduction for vector embeddings
- **LZ4 Compression**: 60-80% compression for LLM responses
- **Semantic Matching**: Cache hit for similar prompts (not just exact matches)

## Quick Start

```bash
npm install
npm test
npm start
```

## API

See [API.md](API.md) for detailed documentation.

## License

MIT
