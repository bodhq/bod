# Lokální vývoj

Základní instalace a spuštění jsou v [hlavním README](../../README.md).
Následující příkazy počítají s kořenem repozitáře jako pracovním adresářem.
Soubor `.env` vytvářej z `.env.example` pouze při první instalaci; existující konfiguraci nepřepisuj.

Node.js používá řadu 22 (`.nvmrc`), Python řadu 3.12 (`.python-version`).
`pnpm install --frozen-lockfile` a `uv sync --all-packages --all-groups --frozen`
používají verzované lockfiles; kvůli běžnému spuštění je neaktualizuj.

## Služby a konfigurace

`pnpm db:dev` spustí PostgreSQL a Redis z vývojového Compose.
Výchozí PostgreSQL je dostupný na `localhost:5433`, Redis na `localhost:6379`.
Pro HTTP vývoj nastav `COOKIE_SECURE=false`; povolený původ odpovídá
webu `http://localhost:3000`.

API při startu provede verzovanou inicializaci databáze. Podrobnosti a omezení
změn existujících tabulek popisuje [architektura](../architecture.md).

## První správce

Po spuštění databáze a dokončení její inicializace vytvoř účet:

```sh
(cd apps/api && uv run python -m server.scripts.bootstrap_admin)
```

Skript vypíše náhodné dočasné heslo. Přihlašovací údaje neukládej do repozitáře.

## API klient

Při první instalaci a po změně backendového kontraktu spusť:

```sh
pnpm gen:api
```

Příkaz exportuje `apps/api/schema/openapi.json` i dokumentační kopii
`docs/openapi.json` a vytvoří TypeScript klienta v `packages/api-client`
z kontraktu v `apps/api/schema`. Generované zdroje klienta se ručně neupravují.
`pnpm gen:client` regeneruje jen klienta z existujícího kontraktu.

## Kontroly

[Testovací příručka](../testing.md) popisuje běhy jednotlivých sad.
`pnpm check` postupně spouští kontrolu závislostí, lint, typy, testy a build;
není to náhrada kontroly aktuálnosti verzovaného OpenAPI kontraktu v CI.
[Řešení potíží](troubleshooting.md) obsahuje poznámky k Python prostředí.
