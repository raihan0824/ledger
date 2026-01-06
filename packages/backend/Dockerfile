# Backend Dockerfile
# Multi-stage build for production-ready, non-root container

# --------------> Build stage
FROM node:22-alpine AS build

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for potential build steps)
RUN npm install

# Copy source code
COPY . .

# --------------> Production stage
FROM node:22-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set production environment
ENV NODE_ENV=production

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev && npm cache clean --force

# Copy application code
COPY --chown=node:node src ./src

# Switch to non-root user (node user has uid 1000)
USER node

# Expose port (non-privileged port)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Use dumb-init to handle signals properly
CMD ["dumb-init", "node", "src/index.js"]
