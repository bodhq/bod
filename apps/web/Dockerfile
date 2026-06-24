# Produkční image pro Next.js web.
# Používá Next.js standalone output — self-contained server bundle bez pnpm symlinků.
# api-client/src je commitovaný — není potřeba ho generovat uvnitř buildu.

FROM node:20-alpine AS builder

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /workspace

RUN corepack enable

# Závislosti (layer cache — přeinstaluje se jen při změně package souborů)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/api-client/package.json packages/api-client/
RUN pnpm install --frozen-lockfile

# Zdrojový kód + build
COPY apps/web apps/web/
COPY packages/api-client packages/api-client/
COPY docs/openapi.json docs/
RUN pnpm exec openapi-ts -i ./docs/openapi.json -o packages/api-client/src
RUN pnpm --filter @bod/web build

# --- Runner image ---
# Standalone output obsahuje vše potřebné — node_modules zkopírované Next.js buildem.
FROM node:20-alpine AS runner

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /workspace/apps/web/.next/standalone ./
COPY --from=builder /workspace/apps/web/.next/static ./.next/static
COPY --from=builder /workspace/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
