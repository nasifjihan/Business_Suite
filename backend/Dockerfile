# syntax=docker/dockerfile:1.7

# ================================
# STAGE 1/4: BASE
# Minimal base: Node 22 alpine, non-root user, dumb-init
# ================================
FROM node:22-alpine AS base

RUN apk add --no-cache dumb-init openssl \
  && addgroup -S nodegrp \
  && adduser -S nodeuser -G nodegrp

# npm network tuning. The default 5-minute fetch timeout and 2 retries are not
# enough on a slow or unstable link: `npm ci` pulls the whole dependency tree,
# and BuildKit runs the deps and production stages in PARALLEL, so two npm
# processes compete for the same bandwidth. Symptom without this:
#   npm error code EIDLETIMEOUT / Idle timeout reached for host registry.npmjs.org
# maxsockets is lowered deliberately - fewer concurrent connections is FASTER on
# a constrained link, because each gets a usable share of the bandwidth instead
# of all of them stalling into an idle timeout.
ENV NODE_ENV=production \
  NPM_CONFIG_FUND=false \
  NPM_CONFIG_AUDIT=false \
  NPM_CONFIG_FETCH_TIMEOUT=1800000 \
  NPM_CONFIG_FETCH_RETRIES=5 \
  NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
  NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=180000 \
  NPM_CONFIG_MAXSOCKETS=3

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
# NOTE: prisma.config.ts is deliberately NOT copied into this stage.
# It calls env("DATABASE_URL"), which throws when the variable is absent — and
# it is absent during `docker build`, as it should be (never bake a database URL
# into an image layer). `prisma generate` only needs prisma/schema.prisma, which
# it finds by convention. The config file is copied into the production stage
# instead, where DATABASE_URL is supplied at run time.

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
# Required by `prisma migrate deploy` in the CMD below: under Prisma 7 the
# datasource url lives here, not in schema.prisma. Without it the container
# crash-loops with "The datasource.url property is required in your Prisma
# config file when using prisma migrate deploy."
COPY --chown=nodeuser:nodegrp prisma.config.ts ./

ENV PORT=4000
EXPOSE 4000

# Idempotent startup: run pending migrations first, then app server
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
