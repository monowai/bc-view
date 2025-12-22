# Use an official Node.js runtime as a parent image
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Build arguments
ARG GIT_BRANCH
ARG GIT_COMMIT
ARG BUILD_ID

# Environment variables
ENV GIT_BRANCH=$GIT_BRANCH
ENV GIT_COMMIT=$GIT_COMMIT
ENV BUILD_ID=$BUILD_ID
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Build stage - copy pre-built artifacts from CI
FROM base AS builder
COPY . .

# If node_modules exists from CI, use it; otherwise install
RUN if [ -d "node_modules" ]; then \
      echo "Using pre-built node_modules from CI"; \
    else \
      echo "Installing dependencies in Docker"; \
      yarn install --frozen-lockfile --prefer-offline --production=false; \
    fi

# If .next exists from CI, use it; otherwise build
RUN if [ -d ".next" ]; then \
      echo "Using pre-built .next from CI"; \
    else \
      echo "Building application in Docker"; \
      yarn build; \
    fi

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
COPY --from=builder --chown=nextjs:nodejs /app/next-i18next.config.js ./

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
