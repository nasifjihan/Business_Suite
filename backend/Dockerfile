# syntax=docker/dockerfile:1.7

# ================================
# STAGE 1/4: BASE
# Minimal base: Node 22 alpine, non-root user, dumb-init
# ================================
FROM node:22-alpine AS base

RUN apk add --no-cache dumb-init openssl \
  && addgroup -S nodegrp \
  && adduser -S nodeuser -G nodegrp

ENV NODE_ENV=production \
  NPM_CONFIG_FUND=false \
  NPM_CONFIG_AUDIT=false

WORKDIR /app
RUN chown -R nodeuser:nodegrp /app

# ================================
# STAGE 2/4: DEPS
# Full devDependencies (typescript, prisma, vitest) for build tools
# ================================
FROM base AS deps
ENV NODE_ENV=development

COPY --chown=nodeuser:nodegrp package.json package-lock.json* ./
COPY --chown=nodeuser:nodegrp tsconfig.json tsconfig.build.json* ./

USER nodeuser
RUN npm ci --include=dev --no-audit --no-fund

# ================================
# STAGE 3/4: BUILDER
# Prisma generate Linux musl engine + tsc compile dist/
# ================================
FROM deps AS builder

COPY --chown=nodeuser:nodegrp prisma/ ./prisma/
COPY --chown=nodeuser:nodegrp src/ ./src/

RUN npx prisma generate \
  && npm run build

# ================================
# STAGE 4/4: PRODUCTION (FINAL IMAGE ~250MB)
# Only runtime deps + compiled dist + generated prisma client
# ================================
FROM base AS production

COPY --chown=nodeuser:nodegrp package.json package-lock.json* ./
USER nodeuser
RUN npm ci --omit=dev --no-audit --no-fund

COPY --chown=nodeuser:nodegrp --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=nodeuser:nodegrp --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --chown=nodeuser:nodegrp --from=builder /app/dist ./dist
COPY --chown=nodeuser:nodegrp prisma/ ./prisma/

ENV PORT=4000
EXPOSE 4000

# Idempotent startup: run pending migrations first, then app server
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
