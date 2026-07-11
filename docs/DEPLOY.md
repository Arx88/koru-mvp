# Koru MVP — Plan de Despliegue y Monitoring

> Fase 4.10 — Documento de referencia para llevar Koru de dev a producción.

## Arquitectura de despliegue

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Vercel/Netlify │────▶│  Railway/Fly.io  │────▶│  NVIDIA API     │
│   (frontend)     │     │  (backend Express)│     │  (LLM provider) │
│   React build    │     │  Node.js server   │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                        │
         │                        ├────▶ Open-Meteo (weather)
         │                        ├────▶ OSRM (routes)
         │                        ├────▶ Wikipedia (knowledge)
         │                        ├────▶ GDELT (news)
         │                        ├────▶ Frankfurter (currency)
         │                        ├────▶ z-ai-web-dev-sdk (ASR + VLM)
         │                        └────▶ Overpass (transport)
         │
         └────▶ Sentry (error tracking)
         └────▶ Plausible (analytics)
```

## Pasos de despliegue

### 1. Extraer backend a Express (Fase 3.11 — pendiente)
- Mover `koruBackend.ts` + middlewares de `vite.config.ts` a `server/index.ts`
- `npm run server` arranca sin Vite
- Variables de entorno server-side (sin `VITE_`)

### 2. Frontend en Vercel/Netlify
```bash
npm run build  # genera dist/
# Vercel: conectar repo, build command: npm run build, output: dist
```

### 3. Backend en Railway/Fly.io
```bash
# Dockerfile mínimo
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3001
CMD ["node", "server/index.js"]
```

### 4. Variables de entorno de producción
```env
NVIDIA_API_KEY=nvapi-xxx
NVIDIA_BASE_URL=https://integrate.api.nvidia.com
NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b
# Opcional: OpenRouter fallback
OPENROUTER_API_KEY=sk-or-xxx
# z-ai-web-dev-sdk (ASR + VLM) — se configura automáticamente
```

### 5. Monitoring

#### Sentry (errores)
```bash
npm install @sentry/node @sentry/react
```
- Frontend: `Sentry.init()` en `main.tsx`
- Backend: `Sentry.init()` en `server/index.ts`
- Capturar errores en `catch` blocks críticos

#### Plausible (analytics)
- Sin cookies, GDPR compliant
- Script en `index.html`
- Eventos: `turno enviado`, `tool ejecutada`, `card renderizada`

#### Health check
```
GET /api/health → { status: "ok", provider: "nvidia", model: "..." }
```

## Checklist pre-producción

- [ ] `.env` no commiteado (gitignored ✓)
- [ ] API keys en variables server-side (sin `VITE_` ✓)
- [ ] CORS configurado para dominio de frontend
- [ ] Rate limiting en `/api/koru/turn`
- [ ] Compresión gzip en responses
- [ ] Health check endpoint
- [ ] Sentry inicializado
- [ ] Build de producción sin warnings
- [ ] Tests pasando (vitest + playwright)
- [ ] `.env.example` actualizado ✓
