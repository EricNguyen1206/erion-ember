# Development environment for semantic-cache
FROM node:20-bullseye

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies)
RUN npm install

# Copy source code
COPY . .

# Default command
CMD ["npm", "test"]
