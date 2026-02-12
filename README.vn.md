# Erion Ember

LLM Semantic Cache MCP Server - Semantic caching cho AI coding assistants qua Model Context Protocol.

[English](README.md) | **Tieng Viet**

## Tong quan

Erion Ember cung cap MCP server luu cache phan hoi LLM dua tren do tuong dong ngu nghia. Tich hop voi cac AI coding assistant nhu Claude Code, Opencode, Codex de giam chi phi API va do tre.

## Tinh nang

- **MCP Protocol**: Giao dien tool chuan cho AI assistants
- **Semantic Caching**: Cache thong minh voi vector similarity matching
- **Multi-Provider**: Hoat dong voi moi AI provider (Claude, OpenAI, Groq, v.v.)
- **Dual Vector Backends**:
  - **Annoy.js** (mac dinh): Pure JavaScript, chay ngay khong can build
  - **HNSW** (toi uu): C++ implementation, hieu nang toi da qua Docker
- **Embedding Generation**: Dich vu embedding tich hop (OpenAI hoac mock)
- **Cost Tracking**: Theo doi token tiet kiem va giam chi phi
- **Bun Runtime**: JavaScript runtime toc do cao

## Bat dau nhanh

### Yeu cau

- Bun runtime (v1.0+)
- Docker (tuy chon, cho HNSW toi uu)

### Cai dat

```bash
git clone https://github.com/EricNguyen1206/erion-ember.git
cd erion-ember
bun install
```

### Development (Annoy.js - Chay ngay)

```bash
bun run dev
```

Server mac dinh su dung **Annoy.js** - thu vien vector search pure JavaScript, khong can native compilation.

### Production (HNSW - Hieu nang toi da)

```bash
bun run docker:build
bun run docker:run
```

## Vector Index Backends

### Annoy.js (Mac dinh)

- **Zero dependencies** - Pure JavaScript
- **Khoi dong ngay** - Khong can build tools
- **Cross-platform** - Chay moi noi
- **Hieu nang**: ~1-5ms search cho 10K vectors
- **Phu hop**: Development, testing, cache nho

### HNSW (Toi uu)

- **Hieu nang toi da** - C++ implementation
- **Scale toi hang trieu** - Hieu qua cho vector sets lon
- **Docker khuyen dung** - Pre-built voi moi dependencies
- **Hieu nang**: ~0.1-1ms search cho 100K+ vectors
- **Phu hop**: Production, trien khai quy mo lon

### Chon Backend

```bash
# Annoy.js (mac dinh, pure JS)
VECTOR_INDEX_BACKEND=annoy bun run dev

# HNSW (C++, can build tools hoac Docker)
VECTOR_INDEX_BACKEND=hnsw bun run dev
```

## Su dung voi MCP Clients

### Claude Code

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

Them vao `.opencode/config.json`:

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

## Cac MCP Tools

| Tool | Muc dich |
|------|----------|
| `ai_complete` | Kiem tra cache va tra ve ket qua hoac cache miss |
| `cache_store` | Luu cap prompt/response voi optional embedding |
| `cache_check` | Kiem tra ton tai trong cache |
| `generate_embedding` | Tao vector embedding |
| `cache_stats` | Thong ke cache va chi phi tiet kiem |

## Vi du Workflow

```javascript
// 1. Kiem tra cache truoc
const result = await mcpClient.callTool('ai_complete', {
  prompt: 'Giai thich quantum computing'
});

if (result.cached) {
  return result.response;
}

// 2. Cache miss - goi AI provider
const aiResponse = await callClaudeAPI('Giai thich quantum computing');

// 3. Luu vao cache
await mcpClient.callTool('cache_store', {
  prompt: 'Giai thich quantum computing',
  response: aiResponse
});

return aiResponse;
```

## Development

```bash
# Chay development (Annoy.js backend)
bun run dev

# Chay tests
bun test

# Chay test cu the
bun test tests/vector-index/annoy-index.test.js

# Build Docker image
bun run docker:build

# Chay Docker container voi hnswlib
bun run docker:run
```

## Cau truc du an

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
├── tests/
├── Dockerfile
├── .env.example
└── package.json
```

## Bien moi truong

| Bien | Mo ta | Mac dinh |
|------|-------|----------|
| `VECTOR_INDEX_BACKEND` | Vector search backend: `annoy` hoac `hnsw` | `annoy` |
| `EMBEDDING_PROVIDER` | Embedding provider: `mock` hoac `openai` | `mock` |
| `OPENAI_API_KEY` | OpenAI API key (neu provider=openai) | - |
| `CACHE_SIMILARITY_THRESHOLD` | Nguong tuong dong toi thieu | `0.85` |
| `CACHE_MAX_ELEMENTS` | So luong cache entries toi da | `100000` |
| `CACHE_DEFAULT_TTL` | TTL mac dinh (giay) | `3600` |
| `NODE_ENV` | Che do moi truong | `development` |

## So sanh hieu nang

| Backend | Search Time (10K vectors) | Search Time (100K vectors) | Build Time | Dependencies |
|---------|---------------------------|----------------------------|------------|--------------|
| **Annoy.js** | ~2-5ms | ~10-20ms | Nhanh | Khong (pure JS) |
| **HNSW** | ~0.5-1ms | ~1-3ms | Trung binh | C++ build tools |

## Xu ly su co

### Loi build C++ (hnswlib)

```bash
# Dung Annoy.js (khuyen dung cho development)
VECTOR_INDEX_BACKEND=annoy bun run dev

# Hoac dung Docker
bun run docker:build
bun run docker:run
```

### Loi ket noi MCP

- Dam bao server xuat JSON-RPC hop le qua stdout
- Kiem tra stderr de xem loi
- Xac nhan cac bien moi truong dung

## Giay phep

MIT License - xem file [LICENSE](LICENSE).

## Loi cam on

- Built with [Bun](https://bun.sh/)
- Vector search: [Annoy.js](https://github.com/DanielKRing1/Annoy.js) (pure JS) va [hnswlib-node](https://github.com/yahoojapan/hnswlib-node) (C++)
- MCP Protocol: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol)
- Protocol: [Model Context Protocol](https://modelcontextprotocol.io/)
