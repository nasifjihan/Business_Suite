# syntax=docker/dockerfile:1.7

# ==============================================================================
# Next.js 16 production image (multi-stage).
#
# Mirrors the backend's structure: a fat build stage with all devDependencies,
# then a lean runtime stage that carries only what is needed to serve.
#
# Production deployment still goes to Vercel, which builds from source and
# ignores this file. This image exists so `docker compose up` starts the WHOLE
# application - database, API, proxy and UI - with one command.
# ==============================================================================

# ==============================================================================
# STAGE 1/4: BASE
# ==============================================================================
FROM node:22-alpine AS base

RUN apk add --no-cache dumb-init \
  && addgroup -S nodegrp \
  && adduser -S nodeuser -G nodegrp

# npm network tuning - same reasoning as backend/Dockerfile: the default
# 5-minute timeout and 2 retries are not enough on a slow link, and fewer
# concurrent sockets finish FASTER than many stalled ones.
ENV NPM_CONFIG_FUND=false \
  NPM_CONFIG_AUDIT=false \
  NPM_CONFIG_FETCH_TIMEOUT=1800000 \
  NPM_CONFIG_FETCH_RETRIES=5 \
  NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
  NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=180000 \
  NPM_CONFIG_MAXSOCKETS=3

WORKDIR /app
RUN chown -R nodeuser:nodegrp /app

# ==============================================================================
# STAGE 2/4: DEPS
# Copied separately from the source so this layer stays cached: editing a
# component must not trigger a reinstall of every package.
# ==============================================================================
FROM base AS deps

COPY --chown=nodeuser:nodegrp package.json package-lock.json* ./
USER nodeuser
RUN npm ci

# ==============================================================================
# STAGE 3/4: BUILDER
# ==============================================================================
FROM deps AS builder

COPY --chown=nodeuser:nodegrp . .

# ---- NEXT_PUBLIC_* must be present at BUILD time, not run time ----------------
# Next.js does not read these from the environment when the server starts. It
# textually INLINES them into the JavaScript bundle during `next build`, because
# the values have to reach the browser, and the browser cannot read a container's
# environment.
#
# So they arrive as build args here. Setting NEXT_PUBLIC_API_URL in the compose
# `environment:` block instead would silently do nothing: the bundle would keep
# whatever value was baked in at build time (or the code's fallback), and the
# app would call the wrong API with no error anywhere.
#
# Consequence worth knowing: changing one of these requires a REBUILD, not a
# restart. That is the trade-off for values that must live inside client-side JS.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ==============================================================================
# STAGE 4/4: RUNNER
# Only the standalone server, static assets, and public files.
# No node_modules install, no source, no TypeScript.
# ==============================================================================
FROM base AS runner

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  HOSTNAME=0.0.0.0

USER nodeuser

# public/ holds static files served as-is (favicon, svgs).
COPY --chown=nodeuser:nodegrp --from=builder /app/public ./public

# .next/standalone contains server.js plus the traced subset of node_modules.
# Note it is copied to the WORKDIR root, so the entrypoint is ./server.js.
COPY --chown=nodeuser:nodegrp --from=builder /app/.next/standalone ./

# .next/static is NOT included in standalone output and must be copied
# separately, or every CSS and JS chunk 404s and the page renders unstyled.
COPY --chown=nodeuser:nodegrp --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# HOSTNAME=0.0.0.0 above matters: Next defaults to localhost, which inside a
# container means "this container only" - Docker could not route traffic to it.
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
