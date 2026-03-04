# AGENTS.md - Coding Guidelines for Erion Ember

Welcome, AI coding agent! These guidelines instruct you on how to navigate, build, test, and write code in the Erion Ember repository. 
Please read this file completely before you begin working.

## Build/Lint/Test Commands

We use **Bun** as our package manager and runtime, along with **TypeScript** for the core logic.

### Dependency Management & Execution
- **Install dependencies**: `bun install`
- **Start development server** (watch mode): `bun run dev`
- **Start production server**: `bun run start`
- **Run Typechecking**: `bun run typecheck`
- **Build TypeScript**: `bun run build`

### Testing (Using Bun's built-in test runner)
- **Run all tests**: `bun test`
- **Run a single test file**: `bun test tests/semantic-cache.test.js`
- **Run tests in watch mode**: `bun run test:watch`

### Docker Commands
- **Build Docker image**: `npm run docker:build`
- **Run in Docker**: `npm run docker:run`

*(Note: There are currently no Cursor rules or Copilot instructions configured for this repository)*

## Code Style Guidelines

### 1. Project Structure
- **Core Runtime**: TypeScript (`src/`) tested with Bun.
- **Entry point**: `src/mcp-server.ts`
- **Core Logic**: `src/lib/` (e.g., `semantic-cache.ts`, `metadata-store.ts`)
- **MCP Tool Handlers**: `src/tools/`
- **External Integrations**: `src/services/`
- **Types/Interfaces**: `src/types/`
- **Vector Indexes**: `src/lib/vector-index/` (HNSW, ANNOY implementations)
- **Tests**: `tests/` (Currently written in `.test.js` files using Bun's test runner, Jest-compatible assertions).

### 2. Naming Conventions & Module System
- **Classes/Types**: PascalCase (e.g., `SemanticCache`, `CacheConfig`).
- **Methods/Variables**: camelCase (e.g., `getCacheStats`, `similarityThreshold`).
- **Private Properties/Methods**: Prefix with an underscore (e.g., `_trackSavings`) or use `private`.
- **Constants**: UPPER_SNAKE_CASE (e.g., `COST_PER_1K_TOKENS`, `DEFAULT_TTL`).
- **Files/Directories**: kebab-case.ts/js (e.g., `semantic-cache.ts`).
- **Tool handlers**: camelCase function matching the tool name (e.g., `handleAiComplete`).
- **Imports**: Even though we write `.ts` files, **always use the `.js` extension when importing local files**. This is required for Node.js native ESM (`nodenext` resolution).
  ```typescript
  import { CacheConfig } from '../types/index.js'; // MUST have .js extension
  import Quantizer from './quantizer.js';
  ```
- **Import Ordering**: Built-in Node modules → External packages → Local paths.
- Use **named exports** for utility functions and types, and **default exports** for main classes.

### 3. Code Formatting & Types
- **Indentation**: 2 spaces.
- **Quotes**: Single quotes (`'`) for strings. Double quotes only for JSON.
- **Semicolons**: Required.
- **Line Length**: Soft wrap at ~100 characters.
- **TypeScript**: Use explicit TS types. Do not use `any`. Interfaces belong in `src/types/index.ts`.
- **Validation**: Use **Zod** for runtime schema validation on inputs (e.g., MCP tool parameters).

### 4. Error Handling & Logging
- **NO Console Logging to `stdout`**: This is an MCP server. `stdout` is exclusively reserved for the MCP JSON-RPC protocol. **If you use `console.log`, the server protocol will break.**
- **Log to `stderr`**: Use `console.error` for all debug, info, and error logging.
- **Async Operations**: Wrap asynchronous logic in `try-catch` blocks, especially in MCP handlers.
- **Tool Handlers**: If a tool handler encounters an error, catch it and return a descriptive object with an `isError: true` flag.
  ```typescript
  try {
    const validated = schema.parse(params);
  } catch (error) {
    const err = error as Error;
    console.error('Error:', err.message);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
      isError: true
    };
  }
  ```

### 5. Testing Standards
- We use Bun's built-in test runner which exposes a Jest-like API.
- Use `describe` to group test suites and `test` for individual specs.
- Always use `beforeEach` and `afterEach` to manage state.
- **Resource Cleanup**: Any test that spins up native resources (like HNSW indices) must explicitly call their `.destroy()` or cleanup methods in `afterEach()` to prevent memory leaks and dangling handles.

```javascript
// tests/semantic-cache.test.js
import SemanticCache from '../src/lib/semantic-cache.js';

describe('SemanticCache', () => {
  let cache;

  beforeEach(() => {
    cache = new SemanticCache({ dim: 128 });
  });

  afterEach(() => {
    cache.destroy(); // MUST clean up to prevent memory leaks!
  });

  test('should store and retrieve value', async () => {
    // Write test implementation here
  });
});
```

### 6. Environment Variables
- Core variables include `VECTOR_INDEX_BACKEND`, `CACHE_SIMILARITY_THRESHOLD`, `CACHE_MAX_ELEMENTS`, `CACHE_DEFAULT_TTL`.
- Always provide fallback defaults when reading `process.env`.
- Refer to `.env.example` if adding new keys.

### 7. Domain Knowledge & Performance Optimizations
- **Vector Indexes**: Support both HNSW (`hnswlib-node`) and ANNOY (`annoy.js`) backends. Use `createVectorIndex()` factory instead of direct instantiations.
- **LRU Cache**: `MetadataStore` uses an O(1) doubly-linked list for LRU eviction (avoiding O(n) array operations).
- **Hashing**: `Normalizer` uses `xxhash-addon` instead of crypto `sha256` for 10x faster hashing.
- **Quantization**: `Quantizer` class converts float32 vectors to int8 to reduce memory footprint by 4x.
- **Compression**: `Compressor` class uses `lz4js` for fast response compression/decompression.
- **Graceful Shutdown**: Handle `SIGINT` and `SIGTERM` signals and call `cache.destroy()` to safely free native resources.

### 8. Security
- Validate all inputs with Zod schemas.
- Never log sensitive data (API keys, tokens, user content).
- Return safe error messages instead of raw stack traces.
