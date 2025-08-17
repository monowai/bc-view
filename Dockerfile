# Use an official Node.js runtime as a parent image
FROM node:20-alpine AS base
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

# Install dependencies stage (includes dev dependencies for building)
FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --prefer-offline --production=false

# Build stage (uses dev dependencies to build the app)
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

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
