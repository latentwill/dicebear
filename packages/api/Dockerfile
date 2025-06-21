FROM node:18-alpine

# Install jq for JSON manipulation
RUN apk add --no-cache jq

# Set working directory
WORKDIR /app

# Copy package files for workspace setup
COPY package*.json ./
COPY lerna.json ./

# Copy all package.json files to establish workspace structure
COPY packages/api/package.json ./packages/api/
COPY packages/dicebear/package.json ./packages/dicebear/

# Copy each @dicebear package.json individually to avoid conflicts
COPY packages/@dicebear/adventurer/package.json ./packages/@dicebear/adventurer/
COPY packages/@dicebear/adventurer-neutral/package.json ./packages/@dicebear/adventurer-neutral/
COPY packages/@dicebear/avataaars/package.json ./packages/@dicebear/avataaars/
COPY packages/@dicebear/avataaars-neutral/package.json ./packages/@dicebear/avataaars-neutral/
COPY packages/@dicebear/big-ears/package.json ./packages/@dicebear/big-ears/
COPY packages/@dicebear/big-ears-neutral/package.json ./packages/@dicebear/big-ears-neutral/
COPY packages/@dicebear/big-smile/package.json ./packages/@dicebear/big-smile/
COPY packages/@dicebear/bottts/package.json ./packages/@dicebear/bottts/
COPY packages/@dicebear/bottts-neutral/package.json ./packages/@dicebear/bottts-neutral/
COPY packages/@dicebear/collection/package.json ./packages/@dicebear/collection/
COPY packages/@dicebear/converter/package.json ./packages/@dicebear/converter/
COPY packages/@dicebear/core/package.json ./packages/@dicebear/core/
COPY packages/@dicebear/croodles/package.json ./packages/@dicebear/croodles/
COPY packages/@dicebear/croodles-neutral/package.json ./packages/@dicebear/croodles-neutral/
COPY packages/@dicebear/dylan/package.json ./packages/@dicebear/dylan/
COPY packages/@dicebear/fun-emoji/package.json ./packages/@dicebear/fun-emoji/
COPY packages/@dicebear/glass/package.json ./packages/@dicebear/glass/
COPY packages/@dicebear/icons/package.json ./packages/@dicebear/icons/
COPY packages/@dicebear/identicon/package.json ./packages/@dicebear/identicon/
COPY packages/@dicebear/initials/package.json ./packages/@dicebear/initials/
COPY packages/@dicebear/lorelei/package.json ./packages/@dicebear/lorelei/
COPY packages/@dicebear/lorelei-neutral/package.json ./packages/@dicebear/lorelei-neutral/
COPY packages/@dicebear/micah/package.json ./packages/@dicebear/micah/
COPY packages/@dicebear/miniavs/package.json ./packages/@dicebear/miniavs/
COPY packages/@dicebear/notionists/package.json ./packages/@dicebear/notionists/
COPY packages/@dicebear/notionists-neutral/package.json ./packages/@dicebear/notionists-neutral/
COPY packages/@dicebear/open-peeps/package.json ./packages/@dicebear/open-peeps/
COPY packages/@dicebear/personas/package.json ./packages/@dicebear/personas/
COPY packages/@dicebear/pixel-art/package.json ./packages/@dicebear/pixel-art/
COPY packages/@dicebear/pixel-art-neutral/package.json ./packages/@dicebear/pixel-art-neutral/
COPY packages/@dicebear/rings/package.json ./packages/@dicebear/rings/
COPY packages/@dicebear/shapes/package.json ./packages/@dicebear/shapes/
COPY packages/@dicebear/thumbs/package.json ./packages/@dicebear/thumbs/

# Create a Docker-specific package.json that only includes packages workspace
RUN jq '.workspaces.packages = ["packages/dicebear", "packages/@dicebear/*", "packages/api"]' package.json > package-docker.json && \
    mv package-docker.json package.json

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
