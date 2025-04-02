# Use an official Node.js runtime as a parent image
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

ARG GIT_BRANCH
ARG GIT_COMMIT
ARG BUILD_ID

ENV GIT_BRANCH=$GIT_BRANCH
ENV GIT_COMMIT=$GIT_COMMIT
ENV BUILD_ID=$BUILD_ID

# Install production dependencies
FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-scripts --prefer-offline

# Copy project files and build your app
FROM base AS builder
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN yarn build

# Create final image
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER nextjs
ENV HOSTNAME="0.0.0.0" PORT=3000 NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
