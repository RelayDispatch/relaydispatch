# docker/Dockerfile
# ──────────────────────────────────────────────────────────────────────────────
# RelayDispatch — Multi-stage Production Dockerfile
#
# Build targets:
#   api     — Hono API server  (port 3001)
#   web     — React SSR + static dashboard (port 3000)
#   worker  — Temporal workflow worker (compiled JS)
#
# Security hardening:
#   - All final stages run as non-root (node user, uid 1000)
#   - devDependencies excluded from production images
#   - API stage includes a HEALTHCHECK
#
# Build command examples:
#   docker build --target api    -t relaydispatch-api    .
#   docker build --target web    -t relaydispatch-web    .
#   docker build --target worker -t relaydispatch-worker .
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: prod-deps ────────────────────────────────────────────────────────
# Install production-only dependencies into a clean layer.
# This layer is reused by all final stages and cached independently of source.
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# ── Stage 2: build ────────────────────────────────────────────────────────────
# Full install (including devDeps) + compile TypeScript for all targets.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ── Stage 3: api ──────────────────────────────────────────────────────────────
# Hono API server — uses compiled JS output only.
FROM node:22-alpine AS api
WORKDIR /app

# Copy prod-only node_modules (excludes devDeps — smaller image)
COPY --from=prod-deps /app/node_modules ./node_modules
# Copy compiled API bundle
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json .

ENV NODE_ENV=production

# Run as non-root
USER node

EXPOSE 3001

# Health check: verify the /health endpoint responds within 10s
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/apps/api/src/index.js"]

# ── Stage 4: web ──────────────────────────────────────────────────────────────
# React SSR server — serves the compiled web dashboard.
FROM node:22-alpine AS web
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json .

ENV NODE_ENV=production

USER node

EXPOSE 3000

CMD ["node", "dist/server.cjs"]

# ── Stage 5: worker ───────────────────────────────────────────────────────────
# Temporal workflow worker — compiled TypeScript, no tsx at runtime.
FROM node:22-alpine AS worker
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
# Worker sources are compiled into dist/apps/worker/ by tsc
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json .

ENV NODE_ENV=production

USER node

CMD ["node", "dist/apps/worker/src/index.js"]
