# Build stage for native dependencies
FROM node:20-alpine AS builder

# Install build dependencies for hnswlib-node
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    clang \
    linux-headers

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies (including native modules)
RUN npm install

# Production stage
FROM oven/bun:latest

WORKDIR /app

# Copy node_modules from builder (includes compiled hnswlib)
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY src/ ./src/
COPY package.json ./

# Set environment to use hnswlib
ENV VECTOR_INDEX_BACKEND=hnsw
ENV NODE_ENV=production

# MCP server uses stdio transport, no ports needed
# Health check removed - stdio transport doesn't use HTTP

# Start MCP server
CMD ["bun", "run", "src/mcp-server.ts"]
