# Dockerfile — Koru MVP production
# Multi-stage build: build frontend, then serve with Node

# ── Stage 1: Build frontend ──
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --production=false

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Bundle server with esbuild
RUN npx esbuild server/index.ts --bundle --platform=node --format=esm --outfile=server-bundle.mjs --external:z-ai-web-dev-sdk --external:playwright

# ── Stage 2: Production server ──
FROM node:22-slim AS production

WORKDIR /app

# Copy only what we need
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server-bundle.mjs ./
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

EXPOSE 3000

# Start server
CMD ["node", "--max-old-space-size=512", "server-bundle.mjs"]
