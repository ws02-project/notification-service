# Build stage
FROM node:22-alpine AS builder

# Install pnpm and git
RUN apk add --no-cache git && \
    corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files and lockfile
COPY package.json pnpm-lock.yaml ./

# Install dependencies using frozen lockfile (skip prepare script for Docker builds)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Proto files will be copied here during build (see GitHub Actions workflow)
# They should be at ./proto/ relative to the Dockerfile

# Build the application
RUN pnpm build

# Production stage
FROM node:22-alpine AS production

# Install pnpm and remove npm (contains vulnerable glob@10.4.5)
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    npm uninstall -g npm && \
    rm -rf /usr/local/lib/node_modules/npm

WORKDIR /app

# Copy package files and lockfile
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only using frozen lockfile (skip prepare script for Docker builds)
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy proto files
COPY --from=builder /app/proto ./proto

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/server.js"]

