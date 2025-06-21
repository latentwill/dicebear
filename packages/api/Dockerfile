FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files for workspace setup
COPY package*.json ./
COPY lerna.json ./

# Copy all package.json files to establish workspace structure
COPY packages/api/package.json ./packages/api/
COPY packages/@dicebear/*/package.json ./packages/@dicebear/*/
COPY packages/dicebear/package.json ./packages/dicebear/

# Install all dependencies (including devDependencies needed for building)
RUN npm install

# Copy source code
COPY packages/ ./packages/

# Build packages in dependency order using lerna
RUN echo "=== Starting build process ===" && \
    echo "Building packages in topological order..." && \
    npx lerna run build --stream --sort && \
    echo "=== Build process completed ==="

# Remove devDependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 3000

# Start the server
WORKDIR /app/packages/api
CMD ["npm", "start"]
