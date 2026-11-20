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

Test aktivních rolí používá aktuální rozvrhové API a běží bez výjimky.
Testy editoru rozvrhu i regresní scénáře školních workflow jsou v
`tests/api/domain`; běžný příkaz je automaticky zahrnuje. Duplicitní testy
odstraněného prototypu byly odstraněny; validace a přístup k rozvrhu se ověřují
nad současnými UUID identitami a verzovaným API.

Běžné testy používají dočasné SQLite a lokální limiter. Pokrytí API má práh
80 %. SQLite adaptér převádí zapisované časy do UTC a datum výuky do školního
pásma, aby neztrácel význam offsetů. Nenahrazuje ověření PostgreSQL zámků,
triggerů a migrací. Scénáře s markerem `postgres` ověřují i nezávislé zápisy
docházky a převod dříve neukončených intervalů.
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
přihlášení, omezení pohybu, automatickou přístupnost ve světlém a tmavém motivu
a ovládání přihlášení při zvětšení textu na 200 %. Síťové chyby přihlášení se simulují v prohlížeči.
Kompletní školní workflow tím pokryté není.

Vitest používá nejvýše dva workery, Playwright jeden. Kontroly tak nezatěžují
stejný počítač neomezeným počtem souběžných prohlížečů a procesů. Turbo sleduje
i OpenAPI snapshot a konfiguraci generátoru klienta; změna kontraktu zneplatní
výsledky. Cache Next.js se nebalí do cache výstupů Turba.

Regresní testy webu ověřují také výběr propojeného dítěte pro vlastní rodičovskou
roli, načítání dalších stránek osobních záznamů, uložení docházky podle seznamu
žáků hodiny a rozhodnutí o konkrétní absenci ze schránky omluvenek. Tyto testy
simulují HTTP odpovědi; oprávnění a transakce nad skutečnou databází ověřuje
integrační sada API.

`personal-attendance.test.tsx` ověřuje datum, předmět, minuty a stav žádosti,
výlučný konec období ve všech stránkách API, hromadný výběr nejvýše 100
záznamů, potvrzení změny dítěte a zachování rozepsaného důvodu při chybě.
Při konfliktu 409 se zablokuje opakované podání vybraných záznamů; žádost se
bez zásahu uživatele nezúží ani znovu neodešle. HTTP odpovědi odpovídají
původnímu kontraktu: docházka neobsahuje termín, názvy ani stav žádosti.
Frontend je spojuje z existujících endpointů a čekající stav označuje pouze
podle detailu vlastního podání. Stav druhého rodiče bez důkazu neodvozuje.

Existující testovací server lze předat přes `PLAYWRIGHT_BASE_URL`
a `PLAYWRIGHT_SKIP_WEBSERVER=1`. `PLAYWRIGHT_IGNORE_HTTPS_ERRORS=1` patří
pouze k lokálnímu testu s nedůvěryhodným certifikátem.

### Audit naplněné školy

```sh
node tests/e2e/audit-school.cjs /cesta/access.json .local-notes/ux-audit/current
```

Použij izolovanou testovací školu. Soubor mimo Git obsahuje `origin`, `day`
(den se zapsanou hodinou), `teacher` a `manager`, každý účet s `username` a
`password`. Správce má oprávnění pro školu, učebny a rozvrh; učitel vlastní
nepodepsanou hodinu se 30 účastníky včetně Adama Bartoše. Jde o konkrétní
regresní scénář testovacích dat, nikoliv příkaz pro provozní školu.

Skript ověřuje hlavní obrazovky, změny velikosti textu a šířky, ovládání rádia
klávesnicí, ochranu rozepsaného profilu a fokus dialogu. Neukládá testovací
změny do školy. Výsledkem jsou screenshoty, metriky a `report.json`; přístupové
údaje se do výstupu nevypisují. Automatická pravidla nenahrazují testování
se skutečnými uživateli. Závěry shrnuje [UX audit](ux-audit.md).

### Mobilní pracovní postupy

```sh
node tests/e2e/mobile-workflows.cjs .local-notes/classbook-preview/access.json .local-notes/mobile-review-final/workflows
```

Použij pouze izolovanou lokální školu s `project` začínajícím `bod-preview-`
a adresou na `127.0.0.1`. Fixture obsahuje `teacher`, `parent`, `manager`
a volitelně `admin`. Učitel má rozpracovanou hodinu se 30 žáky; Adam Bartoš
slouží ke kontrolní změně docházky. Skript kontroluje zavření menu, odhlášení
na portrétu i naležato, šířky 320/390 px, dvojnásobné písmo, axe, dostupnost
prvního žáka nad ukládacím panelem, obnovu po chybě a skutečné uložení i reload.
Ukládá pouze do této fixture a ve `finally` obnoví původní hodnoty docházky.

`accessible-workflows.test.tsx` simuluje původní HTTP kontrakt a ověřuje další
stránky účtů a historie, hledání za první stránkou a bez diakritiky, oprávnění
k dohledání autora, změněné hodnoty, detail rozhodnutí omluvenky, úpravu profilu,
odstranění fotografie a potvrzené odstranění prázdného vlastního návrhu hodiny.

### Backendové přehledy ve frontendu

Regresní sada `tests/web/timetable-overview.test.tsx` ověřuje názvy učitelských
hodin bez oprávnění správy školy, editor pouze s `timetable.edit`, serverové
počty úvazků, zákaz úprav i opakování neúspěšného načtení přehledu. Při úpravě
položky odděluje popisky místností od `expected_state`, aby přísný kontrakt
backendu přijal revizní stav. Příprava úvazků se testuje i bez existující varianty.
HTTP odpovědi v této sadě jsou simulované; skutečný zápis a následné načtení
byly ověřené také v izolované preview škole.

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

Oba poskytovatelé spouštějí stejný [`scripts/ci`](../scripts/ci):

| Příkaz | Účel |
| --- | --- |
| `metadata` | Názvy větví a PR/MR: stejné prefixy, scopes a Conventional Commits |
| `install` | Závislosti podle lockfiles |
| `check` | Kontrakt, generování klienta, audit, lint, typy, testy a build |
| `integration` | PostgreSQL/Redis testy v izolovaných službách |
| `production` | Docker build a provozní smoke test |
| `package` | Offline instalační archiv z právě ověřených obrazů |
| `docs` | Společné PDF maturitní dokumentace |

Metadata používají `BOD_BRANCH` a `BOD_TITLE`. Balíček vyžaduje
`BOD_VERSION`: tag `vX.Y.Z` nebo plný SHA commitu. Ruční pipeline připraví
archiv s checksumem; běžné PR/MR zbytečně neukládají velké instalační artefakty.

GitHub navíc publikuje obrazy (`publish`), připravuje drafty vydání (`release`)
a synchronizuje stabilní větve do školního GitLabu (`mirror`). Vydání používá
stejné obrazy, které prošly smoke testem. Produkční build se neopakuje.

GitLab vyžaduje Linux shell runner `bod-linux`, Node.js podle `.nvmrc`,
Corepack, uv, Python 3.12 a Docker Compose. Runner pro ověřování nesdílí
provozní školní server. Mirror sám runner nezřizuje.

Instalace na VPS je [ruční](deployment.md). CI nepotřebuje školní VPN,
přístupové údaje k serveru ani nasazovací runner ve školní síti.
