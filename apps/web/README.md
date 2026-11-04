# bod web

Next.js a React frontend. Příkazy spouštěj z kořene repozitáře:

```sh
pnpm gen:api
pnpm --filter @bod/web dev
pnpm --filter @bod/web build
pnpm --filter @bod/web test
```

Instalace a konfigurace: [lokální vývoj](../../docs/guides/development.md).
Produkční image používá standalone server; postup a požadavky jsou v
[nasazení](../../docs/guides/deployment.md). Kontrakt klienta vzniká z backendu,
generované soubory v `packages/api-client/src` se ručně neupravují.
