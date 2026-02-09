import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import SemanticCache from './lib/semantic-cache.js';
import EmbeddingService from './services/embedding-service.js';
import handleAiComplete from './tools/ai-complete.js';
import handleCacheCheck from './tools/cache-check.js';
import handleCacheStore from './tools/cache-store.js';
import handleCacheStats from './tools/cache-stats.js';
import handleGenerateEmbedding from './tools/generate-embedding.js';

// Configuration from environment
const config = {
  similarityThreshold: parseFloat(process.env.CACHE_SIMILARITY_THRESHOLD) || 0.85,
  maxElements: parseInt(process.env.CACHE_MAX_ELEMENTS) || 100000,
  defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL) || 3600,
  embeddingProvider: process.env.EMBEDDING_PROVIDER || 'mock',
  openaiApiKey: process.env.OPENAI_API_KEY || null
};

// Initialize services
const cache = new SemanticCache({
  dim: 1536,
  maxElements: config.maxElements,
  similarityThreshold: config.similarityThreshold,
  defaultTTL: config.defaultTTL
});

const embeddingService = new EmbeddingService({
  provider: config.embeddingProvider,
  apiKey: config.openaiApiKey,
  dimension: 1536
});

// Log startup info to stderr (not stdout - that's for MCP messages)
console.error('🚀 Starting Erion Ember MCP Server');
console.error(`   Embedding provider: ${config.embeddingProvider}`);
console.error(`   Similarity threshold: ${config.similarityThreshold}`);

// Create MCP server
const server = new Server(
  {
    name: 'erion-ember-semantic-cache',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'ai_complete',
        description: 'Complete a prompt using AI with semantic caching. Checks cache first, returns cached response if found, or indicates cache miss.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt to complete'
            },
            embedding: {
              type: 'array',
              items: { type: 'number' },
              description: 'Optional pre-computed embedding vector for semantic search'
            },
            metadata: {
              type: 'object',
              description: 'Optional metadata to store with the cached entry'
            },
            similarityThreshold: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Override default similarity threshold (0-1)'
            }
          },
          required: ['prompt']
        }
      },
      {
        name: 'cache_check',
        description: 'Check if a prompt exists in cache without storing anything. Useful for pre-flight checks.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt to check'
            },
            embedding: {
              type: 'array',
              items: { type: 'number' },
              description: 'Optional pre-computed embedding vector'
            },
            similarityThreshold: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Override default similarity threshold (0-1)'
            }
          },
          required: ['prompt']
        }
      },
      {
        name: 'cache_store',
        description: 'Store a prompt and its AI response in the semantic cache. Optionally generates embedding if not provided.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt that was sent to the AI'
            },
            response: {
              type: 'string',
              description: 'The AI response to cache'
            },
            embedding: {
              type: 'array',
              items: { type: 'number' },
              description: 'Optional pre-computed embedding vector'
            },
            metadata: {
              type: 'object',
              description: 'Optional metadata to store'
            },
            ttl: {
              type: 'number',
              description: 'Time-to-live in seconds'
            }
          },
          required: ['prompt', 'response']
        }
      },
      {
        name: 'cache_stats',
        description: 'Get cache statistics including hit rate, memory usage, and cost savings',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'generate_embedding',
        description: 'Generate embedding vector for text. Useful when you want to manage embeddings yourself.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to generate embedding for'
            },
            model: {
              type: 'string',
              description: 'Optional model override'
            }
          },
          required: ['text']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'ai_complete':
        return await handleAiComplete(args, cache);
      
      case 'cache_check':
        return await handleCacheCheck(args, cache);
      
      case 'cache_store':
        return await handleCacheStore(args, cache, embeddingService);
      
      case 'cache_stats':
        return await handleCacheStats(args, cache);
      
      case 'generate_embedding':
        return await handleGenerateEmbedding(args, embeddingService);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Error handling tool ${name}:`, error.message);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error.message,
          tool: name
        }, null, 2)
      }],
      isError: true
    };
  }
});

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\n🔄 Shutting down gracefully...');
    cache.destroy();
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('\n🔄 Shutting down gracefully...');
    cache.destroy();
    await server.close();
    process.exit(0);
  });

  await server.connect(transport);
  console.error('✅ MCP Server ready');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
