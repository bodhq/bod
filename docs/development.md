# Lokální vývoj

Všechny příkazy spouštěj z kořene repozitáře. Potřebuješ Node.js podle
`.nvmrc`, pnpm podle `packageManager` v `package.json`, Python podle
`.python-version`, uv a běžící Docker. Lockfiles `pnpm-lock.yaml` a `uv.lock`
se při běžné instalaci nemění.

## První spuštění

```sh
pnpm install --frozen-lockfile
uv sync --all-packages --all-groups --frozen
cp -n .env.example .env
```

Existující `.env` nepřepisuj. Příklad už obsahuje lokální HTTP nastavení
`COOKIE_SECURE=false` a původ `http://localhost:3000`. U staršího `.env`
tyto hodnoty ověř. Produkční instalátor vytváří vlastní konfiguraci.

```sh
pnpm db:dev
pnpm gen:api
pnpm dev
```

Vývojový Compose spustí PostgreSQL na `localhost:5433` a Redis na
`localhost:6379`. Web běží na `http://localhost:3000`, API na
`http://localhost:8000`. API při startu provede verzovanou inicializaci DB.
Podrobnosti migrací jsou v [README API](../apps/api/README.md#migrace).

## První správce

Až API dokončí start, otevři druhý terminál v kořeni projektu:

```sh
uv run python -m server.scripts.bootstrap_admin
```

Skript vypíše náhodné dočasné heslo; neukládej ho do repozitáře.
Při prvním přihlášení aplikace vyžádá jeho změnu.

## API klient

Po změně backendového kontraktu spusť:

```sh
pnpm gen:api
```

Příkaz exportuje autoritativní `apps/api/schema/openapi.json` a vytvoří
TypeScript klienta v `packages/api-client/src`. Generované zdroje klienta
se neverzují a ručně se neupravují. `pnpm gen:client` regeneruje pouze
klienta z existujícího kontraktu. Živé OpenAPI je na API serveru v
`/openapi.json`, interaktivní dokumentace v `/docs`.

Běhy kontrol a rozsah CI popisuje [testovací návod](testing.md).

## Editor a lokální potíže

Ve VS Code otevři kořen repozitáře, aby se načetl `pyrightconfig.json`,
a jako Python interpreter vyber `.venv/bin/python`. Po změně prostředí
restartuj Python language server. Instalaci balíčku ověří:

```sh
uv run python -c 'import server; print(server.__file__)'
```

Při neúplném prostředí zopakuj `uv sync --all-packages --all-groups --frozen`.
Při chybě připojení k PostgreSQL ověř Docker, `pnpm db:dev` a adresu DB
v `.env`. SQLite slouží automatickým testům; nenahrazuje provozní PostgreSQL.

## Lokální produkční ověření

Tento postup slouží vývoji obrazů. Školní instalace používá
[hotový distribuční balíček](deployment.md).

`infra/docker-compose.yml` obsahuje build konfiguraci pěti služeb pro
technické ověření. `infra/docker-compose.verify.yml` přepíná
porty na loopback 18080/18443 a používá oddělené zálohovací volume.
Vytvoř samostatný dočasný env soubor podle `.env.example`, s vlastními
`POSTGRES_*`, odpovídající `DOCKER_DATABASE_URL` na `db:5432` a
`ALLOWED_ORIGINS=["https://localhost:18443"]`. Potom:

```sh
docker compose --env-file /tmp/bod-verify.env -p bod-verify \
  -f infra/docker-compose.yml -f infra/docker-compose.verify.yml up -d --build --wait
curl --fail --insecure https://localhost:18443/health
```

Po testu lze stejným příkazem Compose zavolat `down --volumes` a odstranit
pouze tuto testovací instalaci. Ve školním provozu volumes nemaž.
