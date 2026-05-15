# Build for Linux (e.g. `docker buildx build --platform linux/amd64 ...`).
# Runtime: Node serves the Next.js standalone server.

FROM oven/bun:1.2-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.2-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Satisfy Better Auth during `next build` (SSG data collection); override at runtime.
ENV BETTER_AUTH_SECRET="docker-build-only-do-not-use-in-prod-min-32"
ENV BETTER_AUTH_URL="http://localhost:3000"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
