# Use an official Node.js runtime as a parent image
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Build arguments
ARG GIT_BRANCH
ARG GIT_COMMIT
ARG BUILD_ID
# Public Sentry DSN — must be present at build time so Next.js can inline it
# into the client bundle (process.env.NEXT_PUBLIC_* is substituted by the
# bundler at compile, not read at runtime). Passed from CI via --build-arg.
ARG NEXT_PUBLIC_SENTRY_DSN
# Days the cached registration check survives in localStorage before the
# browser revalidates against /api/register. Inlined at build time; defaults
# in code to 30 if absent. Configurable via repo Variable NEXT_PUBLIC_REGISTRATION_TTL_DAYS.
ARG NEXT_PUBLIC_REGISTRATION_TTL_DAYS

# Environment variables - Build info
ENV GIT_BRANCH=$GIT_BRANCH
ENV GIT_COMMIT=$GIT_COMMIT
ENV BUILD_ID=$BUILD_ID
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Sentry defaults - SENTRY_DSN, SENTRY_ENVIRONMENT, SENTRY_TRACES_SAMPLE_RATE via bc-deploy
ENV SENTRY_ENABLED="true"
ENV SENTRY_DEBUG="false"

# Build stage — accepts either:
#   (a) a pre-built .next/ from the CI artifact handoff (main + workflow_dispatch only)
#   (b) a fresh in-container build when .next is absent (PR builds, local builds)
# Either way, the post-build assertion runs against the final .next that the
# runner stage will COPY, so a missing DSN cannot ship.
FROM base AS builder
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_REGISTRATION_TTL_DAYS
ENV NEXT_PUBLIC_REGISTRATION_TTL_DAYS=$NEXT_PUBLIC_REGISTRATION_TTL_DAYS
COPY . .

RUN yarn install --frozen-lockfile --prefer-offline --production=false

RUN if [ -d ".next" ] && [ -n "$(ls -A .next 2>/dev/null)" ]; then \
      echo "Using pre-built .next from CI artifact."; \
    else \
      echo "Building application in Docker."; \
      yarn build; \
    fi

# Post-build assertion: the instrumentation-client chunk must contain BOTH the
# DSN's project ID AND its ingest host. Project-ID-only would false-pass if a
# DSN rotated to a different region (e.g. us → de) or with a different public
# key but the same project ID got inlined instead of the intended one. Fails
# the image build if NEXT_PUBLIC_SENTRY_DSN was not inlined correctly (build-arg
# missing, CI artifact built without the secret, Turbopack reused a stale
# cached module).
RUN PROJECT_ID="${NEXT_PUBLIC_SENTRY_DSN##*/}"; \
    DSN_HOST="${NEXT_PUBLIC_SENTRY_DSN#*://}"; \
    DSN_HOST="${DSN_HOST#*@}"; \
    DSN_HOST="${DSN_HOST%%/*}"; \
    if [ -z "$PROJECT_ID" ] || [ -z "$DSN_HOST" ]; then \
      echo "NEXT_PUBLIC_SENTRY_DSN build-arg missing or malformed — pass it via docker build --build-arg." >&2; \
      exit 1; \
    fi; \
    CHUNK=$(grep -lrF "instrumentation-client.ts loading" .next/static/chunks | head -1); \
    if [ -z "$CHUNK" ]; then \
      echo "Could not locate instrumentation-client chunk in .next/static/chunks." >&2; \
      exit 1; \
    fi; \
    if ! grep -qF "$PROJECT_ID" "$CHUNK" || ! grep -qF "$DSN_HOST" "$CHUNK"; then \
      echo "Sentry DSN NOT fully inlined into $CHUNK (project_id=$PROJECT_ID host=$DSN_HOST) — browser tracing would be dead." >&2; \
      exit 1; \
    fi; \
    echo "Sentry DSN inlined into $CHUNK (project_id=$PROJECT_ID host=$DSN_HOST)."

# Production stage (only production dependencies)
FROM base AS runner
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
