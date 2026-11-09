# Lokální vývoj

Příkazy spouštěj z kořene repozitáře. Potřebuješ běžící Docker a tyto nástroje:

| Nástroj | Verze |
| --- | --- |
| Node.js | [`.nvmrc`](../.nvmrc) |
| pnpm | `packageManager` v [`package.json`](../package.json) |
| Python | [`.python-version`](../.python-version) |
| uv | Aktuální stabilní verze |

## První spuštění

```sh
pnpm install --frozen-lockfile
uv sync --all-packages --all-groups --frozen
cp -n .env.example .env
pnpm db:dev
pnpm gen:api
pnpm dev
```

Existující `.env` nepřepisuj. Pro lokální HTTP má obsahovat
`COOKIE_SECURE=false` a původ `http://localhost:3000`, stejně jako
[`.env.example`](../.env.example). Lockfiles při běžné instalaci neměň.

| Služba | Adresa |
| --- | --- |
| Web | `http://localhost:3000` |
| API | `http://localhost:8000` |
| PostgreSQL | `localhost:5433` |
| Redis | `localhost:6379` |

API při startu provede verzovanou inicializaci databáze.
Podrobnosti jsou v [migracích API](../apps/api/README.md#migrace).

## První správce

Po dokončení startu API spusť v druhém terminálu:

```sh
uv run python -m server.scripts.bootstrap_admin
```

Skript vypíše náhodné dočasné heslo. Při prvním přihlášení aplikace vyžádá
jeho změnu. Přihlašovací údaje neukládej do repozitáře.

## API klient

Po změně backendového kontraktu spusť:

```sh
pnpm gen:api
```

Příkaz exportuje kontrakt do `apps/api/schema/openapi.json` a vytvoří
TypeScript klienta v `packages/api-client/src`. `pnpm gen:client` obnoví
pouze klienta z existujícího kontraktu. Generované zdroje se neverzují
a ručně se neupravují. Běžící API nabízí `/openapi.json` a dokumentaci `/docs`.

Kontroly změn popisuje [testování](testing.md), pravidla členění
[architektura](architecture.md) a práci s tokeny [vizuální identita](design-system.md).

## Editor a lokální potíže

Ve VS Code otevři kořen repozitáře a jako Python interpreter vyber
`.venv/bin/python`. Projekt používá kořenový `pyrightconfig.json`.
Po změně prostředí restartuj Python language server.

| Problém | Ověření |
| --- | --- |
| Chybí Python balíčky | Zopakuj `uv sync --all-packages --all-groups --frozen` |
| Editor nenachází `server` | Spusť `uv run python -c 'import server; print(server.__file__)'` |
| API se nepřipojí k databázi | Ověř Docker, `pnpm db:dev` a adresu v `.env` |

SQLite slouží testům; provozní databází je PostgreSQL.

## Lokální produkční ověření

Tento postup sestavuje obrazy pro vývoj. Školní instalace používá
[hotový distribuční balíček](deployment.md).

Compose pro ověření má oddělený projekt, porty 18080/18443 na loopbacku
a vlastní zálohovací volume. Připrav `/tmp/bod-verify.env` podle `.env.example`:

- Nastav vlastní `POSTGRES_*` a odpovídající `DOCKER_DATABASE_URL` na `db:5432`.
- Nastav `ALLOWED_ORIGINS=["https://localhost:18443"]`.

```sh
docker compose --env-file /tmp/bod-verify.env -p bod-verify \
  -f infra/docker-compose.yml -f infra/docker-compose.verify.yml up -d --build --wait
curl --fail --insecure https://localhost:18443/health
```

Po ověření odstraň pouze tuto testovací instalaci:

```sh
docker compose --env-file /tmp/bod-verify.env -p bod-verify \
  -f infra/docker-compose.yml -f infra/docker-compose.verify.yml down --volumes
```

Ve školním provozu volumes nemaž. Další ověření popisují
[prohlížečové testy](testing.md#prohlížeč) a [nasazovací nástroje](testing.md#nasazovací-nástroje).
