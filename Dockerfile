# Use an official Node.js runtime as a parent image
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat && rm -rf /var/cache/apk/*

ARG GIT_BRANCH
ARG GIT_COMMIT
ARG GIT_REMOTE

ENV GIT_BRANCH=$GIT_BRANCH
ENV GIT_COMMIT=$GIT_COMMIT
ENV GIT_REMOTE=$GIT_REMOTE

# Install production dependencies.
FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile --ignore-scripts --prefer-offline && cp -R $(yarn cache dir) ./ycache

# Copy project files and build your app
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/ycache /usr/local/share/.cache/yarn/v6
COPY . .
RUN yarn build

# Create final image
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
ENV HOSTNAME="0.0.0.0" PORT=3000 NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
