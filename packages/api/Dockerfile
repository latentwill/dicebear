FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files for workspace setup
COPY package*.json ./
COPY lerna.json ./

# Copy all package.json files to establish workspace structure
COPY packages/api/package.json ./packages/api/
COPY packages/@dicebear/core/package.json ./packages/@dicebear/core/
COPY packages/@dicebear/collection/package.json ./packages/@dicebear/collection/
COPY packages/dicebear/package.json ./packages/dicebear/

# Install all dependencies (including devDependencies needed for building)
RUN npm install

# Copy source code
COPY packages/ ./packages/

# Build dependencies first (core and collection packages)
RUN npm run build --workspace=@dicebear/core
RUN npm run build --workspace=@dicebear/collection

# Build the API
WORKDIR /app/packages/api
RUN npm run build

# Remove devDependencies to reduce image size
WORKDIR /app
RUN npm prune --production

# Expose port
EXPOSE 3000

# Start the server
WORKDIR /app/packages/api
CMD ["npm", "start"]
