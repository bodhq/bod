# Testování

Příkazy spouštěj z kořene repozitáře po instalaci podle
[vývojového návodu](development.md). Testy používají dočasné databáze
a explicitní `TEST_*` adresy místo provozní databáze z `.env`.

## Úplná kontrola

```sh
pnpm --filter @bod/e2e exec playwright install chromium
pnpm gen:api
pnpm check
```

`pnpm check` ověří spojené verze React/Vitest, lint, typy, unit testy,
prohlížečový test a produkční build. CI navíc kontroluje aktuálnost autoritativního
OpenAPI snapshotu, skutečné PostgreSQL/Redis integrace a běh
produkčních obrazů přes HTTPS proxy. Testování není automatické nasazení.

## Bezpečnost závislostí

```sh
pnpm audit
```

CI blokuje vysoké a kritické npm nálezy. React/React DOM i Vitest/coverage
musí dál mít spojené verze. Bezpečnostní minima vybraných tranzitivních balíčků
jsou v `package.json:pnpm.overrides`; při údržbě kontroluj i je a `uv.lock`.
Dependabot sleduje npm i Python workspace, ale jeho seznam alertů na default
větvi nemusí odpovídat rozpracované pracovní větvi.

## API

```sh
uv run pytest
uv run pytest apps/api/tests --no-cov
```

Kořenová konfigurace zahrnuje `apps/api/tests` i `tests/api`; stejně jako
konfigurace v `apps/api/pytest.ini` zachovává výjimky převzaté z backendové
větve: staré `tests/api/test_timetable.py`, `tests/api/test_validation.py`
a scénář `test_active_role_is_session_local_and_permissions_are_not_combined`.
Tyto testy dosud používají odstraněný prototyp rozvrhu. Jejich migrace na
nový kontrakt patří backendu a není součástí provozních oprav. Zelený běh
proto neznamená, že tyto vyřazené scénáře prošly.

Běžné testy používají dočasné SQLite a lokální limiter. Pokrytí API má práh
80 %. SQLite nenahrazuje ověření PostgreSQL zámků, triggerů a migrací.
Pro ně použij samostatnou testovací databázi, nikdy produkční adresu:

```sh
TEST_POSTGRES_URL=postgresql+psycopg://bod:bod@localhost:55432/bod_test \
TEST_REDIS_URL=redis://localhost:56379/0 \
  uv run pytest -m 'postgres or redis' --no-cov
```

PostgreSQL testy vytvářejí schémata s náhodným názvem a po testu je odstraní;
role potřebuje právo vytvořit schéma. Redis testy používají vlastní náhodné
klíče. Bez příslušných `TEST_*` proměnných se integrace přeskočí. CI používá
PostgreSQL 16 a Redis 7, stejné hlavní verze jako produkční Compose.

## Web

```sh
pnpm --filter @bod/web test
pnpm --filter @bod/web typecheck
pnpm --filter @bod/web lint
```

Vitest načítá testy z `tests/web`; závislosti a aliasy řeší vůči `apps/web`,
aby fungoval i čistý checkout bez hoistovaných balíčků. Jednotkové testy
mockují síť a nepotřebují běžící API.

## Prohlížeč

```sh
pnpm --filter @bod/e2e test
```

Playwright sám spustí vývojový web na `http://localhost:3000`. Základní test
ověřuje pouze načtení stránky a titul. Nepokrývá kompletní školní workflow.
Pro existující produkční server z [lokálního ověřovacího postupu](development.md#lokální-produkční-ověření):

```sh
PLAYWRIGHT_BASE_URL=https://localhost:18443 \
PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_IGNORE_HTTPS_ERRORS=1 \
  pnpm --filter @bod/e2e test
```

Ignorování TLS chyb zde slouží pouze lokálnímu Caddy certifikátu.
V běžné produkci se používá důvěryhodný certifikát.

## Nasazovací nástroje

```sh
pnpm infra:check
```

Samostatné unit testy v `tests/infra/test_deployment.py` ověřují poškozené
balíčky, nebezpečné cesty, souběh údržby, odmítnutí nepodporované aktualizace,
obnovení služeb po chybě zálohy a zachování původních dat při chybě obnovy.

`tests/infra/acceptance.py` se spouští přes sudo pouze na dočasné Linux VM.
Provádí skutečnou instalaci, přihlášení, změnu hesla, založení účtu, kontrolu
binárních médií, update, návrat ze zálohy a provoz za HTTPS proxy. První
update používá synteticky vyšší verzi stejného obsahu a ověřuje mechanismus;
nenahrazuje migrační test dvou skutečných vydání. Před přidáním verze do
`infra/release.json:upgrade_from` musí vydavatel ověřit i skutečnou dvojici.

```sh
sudo python3 tests/infra/acceptance.py \
  --bundle /tmp/bod-0.1.0-linux-amd64.tar.gz \
  --root /tmp/bod-school-test --output /tmp/bod-test-result --cleanup
```

CI spouští tento průchod na Ubuntu 24.04 a obnovu výsledné zálohy na další
čisté VM. Testovací archiv obsahuje pouze vytvořené testovací účty. Do
release se přenášejí výhradně instalační balíček a jeho checksum, nikoli
záloha nebo testovací přihlašovací údaje.
