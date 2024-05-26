# Use an official Node.js runtime as a parent image
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat && rm -rf /var/cache/apk/*

# Copy project files and build your app
FROM base AS builder
COPY node_modules ./node_modules
COPY .yarn-cache /usr/local/share/.cache/yarn/v6
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
