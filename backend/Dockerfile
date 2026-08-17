# ==========================================
# GullyBid API — Production Dockerfile
# Multi-stage build for minimal image size
# ==========================================

# ─── Stage 1: Dependencies ───
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ─── Stage 2: Production ───
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 gullybid

COPY --from=deps --chown=gullybid:nodejs /app/node_modules ./node_modules
COPY --chown=gullybid:nodejs . .

USER gullybid

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["npm", "start"]