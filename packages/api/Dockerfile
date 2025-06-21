FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY lerna.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/@dicebear/*/package.json ./packages/@dicebear/*/
COPY packages/dicebear/package.json ./packages/dicebear/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY packages/ ./packages/

# Build the API
WORKDIR /app/packages/api
RUN npm run build

# Expose port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
