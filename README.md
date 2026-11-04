# bod

Modulární školní informační systém vznikající jako středoškolský maturitní projekt.
Backend tvoří FastAPI, SQLModel, PostgreSQL a Redis; frontend Next.js, React a Tailwind CSS.
Monorepo používá pnpm, uv a Turborepo.

## Odpovědnosti

| Oblast | Odpovědnost |
| --- | --- |
| Backend a databáze | Filip Nagy |
| Frontend, UI, infrastruktura a CI | Eliáš Jan Procházka |
| Analýza a architektura | Společně |

Vedoucí práce: @haut. Oponent: @svitek1.

## Spuštění pro vývoj

Potřebuješ Node.js alespoň 22.18 (viz `.nvmrc`), pnpm podle `packageManager`
v `package.json`, Python alespoň 3.12, uv a běžící Docker.
Příkazy spouštěj z kořene repozitáře.

```sh
pnpm install --frozen-lockfile
uv sync --all-packages --all-groups --frozen
cp .env.example .env
```

V `.env` nastav pro lokální HTTP `COOKIE_SECURE=false`. Potom:

```sh
pnpm db:dev
pnpm gen:api
pnpm dev
```

Web běží na `http://localhost:3000`, API na `http://localhost:8000`.
[Podrobný postup](docs/guides/development.md) zahrnuje vytvoření prvního správce.

## Orientace v repozitáři

```text
apps/        API a webová aplikace
packages/    Generovaný API klient a sdílená TypeScript konfigurace
tests/       API, webové a prohlížečové testy
infra/       Docker Compose a Caddy
scripts/     Pomocné kontroly repozitáře
docs/        Technická dokumentace, návody a zadání
.github/     CI, Dependabot a pravidla GitHub workflow
```

Kořenové konfigurace patří nástrojům pro celý workspace a zůstávají v kořeni.

## Dokumentace

- [Rozcestník dokumentace](docs/README.md)
- [Architektura a API kontrakt](docs/architecture.md)
- [Testování](docs/testing.md)
- [Nasazení](docs/guides/deployment.md)
- [Pravidla spolupráce a údržby závislostí](CONTRIBUTING.md)

Lokální kontrolu závislostí, lintů, typů, testů a buildu spustí `pnpm check`.
Před prvním během testů nainstaluj Chromium podle [testovací příručky](docs/testing.md).
