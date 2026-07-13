# Koru MVP — Deployment Guide

## Quick Deploy (Railway)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Create project
railway init

# 4. Set environment variables
railway variables set NVIDIA_API_KEY=nvapi-xxx
railway variables set NVIDIA_BASE_URL=https://integrate.api.nvidia.com
railway variables set NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b
railway variables set NVIDIA_FAST_MODEL=stepfun-ai/step-3.5-flash

# 5. Deploy
railway up
```

## Quick Deploy (Fly.io)

```bash
# 1. Install Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Login
fly auth login

# 3. Create app
fly launch --no-deploy

# 4. Set secrets
fly secrets set NVIDIA_API_KEY=nvapi-xxx
fly secrets set NVIDIA_BASE_URL=https://integrate.api.nvidia.com
fly secrets set NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b
fly secrets set NVIDIA_FAST_MODEL=stepfun-ai/step-3.5-flash

# 5. Deploy
fly deploy
```

## Quick Deploy (Docker)

```bash
# 1. Build
docker build -t koru-mvp .

# 2. Run
docker run -p 3000:3000 \
  -e NVIDIA_API_KEY=nvapi-xxx \
  -e NVIDIA_BASE_URL=https://integrate.api.nvidia.com \
  -e NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b \
  -e NVIDIA_FAST_MODEL=stepfun-ai/step-3.5-flash \
  koru-mvp
```

## Local Production (no Docker)

```bash
# 1. Build frontend
npm run build

# 2. Bundle server
npx esbuild server/index.ts --bundle --platform=node --format=esm --outfile=server-bundle.mjs --external:z-ai-web-dev-sdk --external:playwright

# 3. Run
NVIDIA_API_KEY=nvapi-xxx node --max-old-space-size=512 server-bundle.mjs
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| NVIDIA_API_KEY | Yes | — | NVIDIA Integrate API key |
| NVIDIA_BASE_URL | No | https://integrate.api.nvidia.com | NVIDIA API base URL |
| NVIDIA_MODEL | No | nvidia/nemotron-3-ultra-550b-a55b | Primary LLM model |
| NVIDIA_FAST_MODEL | No | stepfun-ai/step-3.5-flash | Fast model for trivial inputs |
| PORT | No | 3000 | Server port |
| NODE_ENV | No | production | Environment |
