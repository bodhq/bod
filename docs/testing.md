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

`pnpm check` ověří nástroje nasazení, lint, typy, unit testy,
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
uv run pytest tests/api/domain --no-cov
```

API testy mají jednu kořenovou konfiguraci `pytest.ini` a společné místo:

| Složka | Obsah |
| --- | --- |
| `tests/api/core` | Účty, relace, oprávnění, média a limity přihlášení |
| `tests/api/domain` | Školní agendy, jejich pravidla a kontrakt |
| `tests/api/legacy` | Dva vyřazené testy odstraněného prototypu |

Konfigurace zachovává také dosavadní výjimku scénáře
`test_active_role_is_session_local_and_permissions_are_not_combined`.
Přesun nemění tyto výjimky ani obsah scénářů. Jejich migrace patří backendu;
zelený běh neznamená, že vyřazené testy prošly.

Běžné testy používají dočasné SQLite a lokální limiter. Pokrytí API má práh
80 %. SQLite nenahrazuje ověření PostgreSQL zámků, triggerů a migrací.
Společný příkaz `scripts/ci integration` vytvoří vlastní PostgreSQL a Redis,
spustí integrační scénáře a testovací služby odstraní.

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
mockují síť a nepotřebují běžící API. Ověřují také relace, změny rolí,
cache mezi účty a [hranice frontendových vrstev](architecture.md#frontend).
Produktové tokeny a použití značky popisuje [vizuální identita](design-system.md#tokeny-a-podklady).

## Prohlížeč

```sh
pnpm --filter @bod/e2e test
```

Playwright spustí vývojový web na `http://localhost:3000`. Testy ověřují
načtení stránky, chyby přihlášení, styly formulářů, logo, veřejné soubory
přihlášení a omezení pohybu. Síťové chyby přihlášení se simulují v prohlížeči.
Kompletní školní workflow tím pokryté není.

Existující testovací server lze předat přes `PLAYWRIGHT_BASE_URL`
a `PLAYWRIGHT_SKIP_WEBSERVER=1`. `PLAYWRIGHT_IGNORE_HTTPS_ERRORS=1` patří
pouze k lokálnímu testu s nedůvěryhodným certifikátem.

## Nasazení

```sh
pnpm deploy:check
scripts/ci production
```

Unit testy v `tests/deploy` pokrývají souběh údržby, neúplné zálohy,
nebezpečné archivy, obnovení služeb po chybě a zachování původních dat při
neúspěšné obnově. Smoke test používá skutečný Docker a dočasná data:
HTTPS, statické soubory, secure cookie, změnu hesla, SSR, aktualizaci, zálohu médií
a obnovu do jiného projektu. Aktualizační test používá stejné obrazy; ověřuje
mechanismus, nikoli migraci mezi dvěma skutečnými vydáními. Nejde o kapacitní test celé školy.

## GitHub a GitLab

Obě konfigurace spouštějí stejný [`scripts/ci`](../scripts/ci):

| Příkaz | Účel |
| --- | --- |
| `scripts/ci install` | Závislosti podle lockfiles |
| `scripts/ci check` | Kontrakt, klient, audit závislostí a úplná kontrola |
| `scripts/ci integration` | PostgreSQL/Redis testy v izolovaných Docker službách |
| `scripts/ci production` | Sestavení a provozní smoke test |

Integrace si vytvoří vlastní databáze. Existující testovací služby můžeš
předat oběma proměnnými `TEST_POSTGRES_URL` a `TEST_REDIS_URL`.
Nepředávej adresy školní instalace.

GitLab vyžaduje Linux shell runner označený `bod-linux`, s Node.js podle
`.nvmrc`, Corepackem, uv, Docker Compose a přístupem k Dockeru. Runner pro
nedůvěryhodné projekty nesmí sdílet provozní školní server.
Samotný mirror repozitáře runner nezřizuje.

Publikování obrazů a draftů vydání zajišťuje GitHub. GitLab spouští ověření,
aby nevznikala dvě nezávislá vydání stejných verzí.
