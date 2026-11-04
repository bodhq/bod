# Produkční image pro Next.js web.
# Používá Next.js standalone output — self-contained server bundle bez pnpm symlinků.
# API klient se během buildu generuje z uloženého OpenAPI kontraktu.

FROM node:22-alpine AS builder

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /workspace

ARG API_INTERNAL_URL=http://api:8000
ENV API_INTERNAL_URL=${API_INTERNAL_URL}

RUN corepack enable

# Závislosti (layer cache — přeinstaluje se jen při změně package souborů)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/api-client/package.json packages/api-client/
COPY packages/config-typescript/package.json packages/config-typescript/
RUN pnpm install --frozen-lockfile

# Zdrojový kód + build
COPY apps/web apps/web/
COPY packages/api-client packages/api-client/
COPY packages/config-typescript packages/config-typescript/
COPY apps/api/schema/openapi.json apps/api/schema/
COPY openapi-ts.config.ts ./
RUN pnpm gen:client
RUN pnpm --filter @bod/web build

# --- Runner image ---
# Standalone output obsahuje vše potřebné — node_modules zkopírované Next.js buildem.
FROM node:22-alpine AS runner

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
