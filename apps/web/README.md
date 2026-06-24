# bod web

Aplikace bod postavená na Next.js App Routeru.

Používejte příkazy z kořene monorepa:

```bash
pnpm install
pnpm web:dev
pnpm --filter web build
pnpm --filter web typecheck
```

API typy a klientské funkce se generují v `packages/api-client` z OpenAPI schématu backendu ve FastAPI.
