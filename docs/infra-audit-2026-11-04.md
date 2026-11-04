# Audit infrastruktury — 4. 11. 2026

## Závěr

Větev `chore/production-readiness` má po opravách smysluplný rozsah pro první
školní pilot a je připravená k review. Před sloučením musí projít
CI v GitHubu včetně čistého buildu obrazů a instalace/obnovy na Linuxu.
Tento audit není potvrzení, že už proběhlo nasazení do školy nebo vydání
produkčního releasu.

Největší opravené problémy byly zranitelné závislosti, návrat služeb po chybě zálohy, opakování
neúspěšné instalace/obnovy a možnost vytvořit prázdné volume při zálohování
chybějících médií. Odstraněné jsou dva souběžné způsoby záloh a předčasné
volby vlastních portů a online aktualizačního kanálu.

Školní GitLab při prvních pokusech nepřijímal spojení na portu 443.
Opakovaný pokus už prošel: HTTPS vrátilo HTTP 302 a `git ls-remote gitlab HEAD`
úspěšně načetl vzdálený repozitář. Následně prošla i první automatická
synchronizace z GitHub runneru. Nové zúžení na dlouhodobé větve a release
tagy je samostatně ověřené pomocí dry-run.

## Rozsah a hranice

- Srovnávací základ: aktuálně načtený `origin/develop`, commit
  `2184e1e248f310cf65489f09dfaa02b6b83e605f`.
- Posouzené jsou Dockerfiles, všechny Compose konfigurace, Caddy,
  instalátor a jeho runtime, balení releasu, CI/release/mirror workflow,
  dependency policy, testovací infrastruktura a provozní dokumentace.
- `apps/api/server/` se vůči tomuto základu neliší. Žádné změny endpointů,
  doménových modelů, služeb ani migrací nejsou součástí větve.
- Změny testovacích fixtures, importů a spouštění kontrol jsou provozní.
  Výjimky starých backendových testů jsou převzaté a popsané v
  [testovacím návodu](testing.md#api), nikoli nově přidané kvůli zelenému CI.
- OpenAPI snapshot se liší pouze 235 popisky HTTP odpovědí mezi verzemi
  Pythonu: 229× popis 422 a 6× popis 413. Cesty, typy a schémata jsou stejné.
- Rozpracovaný frontend je v původní pracovní složce `bod`. Tato větev
  je oddělená v `bod-production-readiness`; frontendový redesign neobsahuje.
- Větev má zůstat na dvou commitech. Opravy auditu se slučují do druhého.

## Výsledná provozní podoba

Jedna škola provozuje jednu aplikaci na Ubuntu Server 24.04 s lokálním
Docker Engine, Compose a Pythonem 3.12. Aplikační závislosti jsou v obrazech;
školní server neinstaluje Node.js, pnpm ani Python balíčky přes pip.

| Služba | Úloha | Trvalá data |
| --- | --- | --- |
| Caddy | HTTPS a směrování na web/API | Certifikáty a stav Caddy |
| Next.js | Web a serverové vykreslení | Aplikační data ukládá backend |
| FastAPI | Backend a migrace při startu | Školní média |
| PostgreSQL 16 | Školní data, účty, relace, oprávnění a audit | Databázové volume |
| Redis 7 | Dočasný limiter přihlašování | Bez zálohovaného volume |

Redis neukládá přihlašovací relace, proto není součástí úplné zálohy.
Zdrojový Compose a distribuční balíček mají shodných pět služeb.

Podporované síťové varianty jsou dvě: přímé HTTPS na 80/443, nebo školní
HTTPS proxy s interním HTTP na `127.0.0.1:8080`. API, databáze a Redis
nemají ve školním balíčku veřejné porty. Ověřovací Compose dovoluje
loopback porty pro testovací databázi a Redis; toto rozšíření se nebalí.

Distribuce obsahuje hotové obrazy všech pěti služeb, instalátor a manifest
s kontrolními součty. Instalace ani aktualizace nesestavují kód ve škole.
Aktualizace přijímá konkrétní lokální balíček, který správce převezme od
vydavatele. Verze a povolené předchozí verze mají jediný zdroj v
`infra/release.json`.

## Nálezy a provedené opravy

### P1 — Zranitelné závislosti v obou lockfiles

Při pushnutí GitHub upozornil na 66 alertů default větve. Následná kontrola
skutečné pracovní větve našla 51 npm advisory záznamů, z toho 3 kritické,
a čtyři použitelné Python alerty pro dva balíčky. Nešlo tedy pouze o starý
stav `main`.

Aktualizované jsou Next.js `16.4.1`, Zod `4.6.7`, spojené Vitest/coverage
`4.1.12` a odpovídající Vite `8.1.6`. Zranitelné tranzitivní balíčky mají
bezpečnostní minima v existujících major verzích přes pět pnpm overrides:
PostCSS, Undici, js-yaml, nanoid a source-map-js. Nebyla vypnutá přísná
kontrola peer dependencies. AnyIO a certifi se v `uv.lock` cíleně změnily
na `4.14.2` a `2026.10.18`; backendový zdrojový kód ani přímý seznam jeho
závislostí se nemění.

Výsledný `pnpm audit --json` hlásí nulu ve všech závažnostech. Žádný z
načtených Python alertů se už nevztahuje na aktuální `uv.lock`. CI nově
spouští `pnpm audit --audit-level=high`, takže vysoké a kritické nálezy
nezávisí jen na ručním čtení upozornění při pushi. GitHub seznam na default
větvi může zůstávat otevřený do přenosu oprav do `main`.

Změny vycházejí z primárních advisory
[Next.js](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr),
[AnyIO](https://github.com/agronholm/anyio/security/advisories/GHSA-82r6-8w77-94w6)
a [certifi](https://github.com/certifi/python-certifi/security/advisories/GHSA-6q48-6c7w-9gw2).


### P1 — Záloha mohla nechat aplikaci zastavenou

Příkaz pro zastavení služeb byl mimo `try/finally`. Když se zastavila jen
část služeb a Docker poté vrátil chybu, návrat aplikace se vůbec neprovedl.
Další okno vznikalo při selhání zápisu `last-backup.json`: záloha už byla
označená za dokončenou a příprava aktualizace mohla skončit s vypnutou aplikací.

Zastavení je nyní uvnitř chráněného bloku a dokončení se nastavuje až po
zápisu metadat a retenci. Při neúspěchu se nástroj pokusí spustit původně
běžící služby i tehdy, když šlo o předaktualizační zálohu. Regresní testy
ověřují selhání dumpu, částečného zastavení i zápisu metadat. Pokud není
funkční samotný Docker daemon, nelze automatický restart garantovat.

### P1 — Chybějící média mohla být zálohovaná jako prázdná

Pomocná metoda volala `docker volume create` i při záloze. Chybějící zdrojové
volume tak vzniklo prázdné a archiv mohl působit jako úspěšná záloha.
Zálohování nyní vyžaduje existující volume přes `inspect`; vytvoření je
povolené pouze při obnově do nového projektu. Ověřeno samostatným testem.

### P1 — Po časné chybě nešla instalace nebo obnova zopakovat

Chyba načítání obrazů mohla zanechat adresář `releases/` bez rozpoznané
instalace. Další pokus adresář odmítl jako neprázdný. Obdobně se mohl
zaseknout první restore. Opakovaná instalace navíc nastavovala `ready`
před úspěšným bootstrapem správce.

Po selhání operace, která začala v prázdném adresáři, se odstraňují jen
vlastní soubory instalátoru. U obnovy až po úspěšném odstranění kandidáta;
při selhání jeho úklidu zůstane konfigurace zachovaná pro zásah správce.
Existující instalace a původní volumes se tímto úklidem nemažou.
Opakovaný bootstrap nastaví `ready` až po dokončení. Testy opakují oba
neúspěšné první pokusy a ověřují zachování zdrojového balíčku i archivu.

### P2 — Dva různé způsoby zálohy

Zdrojový Compose měl SQL-only zálohovací kontejner, zatímco distribuční
balíček ho odstraňoval a používal úplnou hostitelskou zálohu. Vývoj a škola
tak měly jiné počty služeb a jiné chování záloh.

SQL-only kontejner a jeho ověřovací volume jsou odstraněné. Zůstává jedna
úplná záloha přes `bod backup`, plánovaná systemd timerem. Zjednodušilo se
Compose, balení i dokumentace a odpadl jeden obraz třetí strany.

### P2 — Nestabilní vlastník médií a zbytečná cache v obrazu

API uživatel dostával automaticky přidělené UID podle obsahu základního
obrazu. Příští build tak mohl změnit vlastníka souborů vůči obnoveným médiím.
API nyní používá pevné UID/GID `10001`; web měl pevné UID už před auditem.
Reálný zápis do média pod tímto uživatelem prošel.

`UV_NO_CACHE=1` zabraňuje přibalení download cache do API obrazu. Stejné
měření `docker image ls` na Docker Desktopu ukázalo pokles z 490 na 382 MB.
Čísla zahrnují způsob účtování tohoto enginu a nejsou požadavkem na RAM.
Nepřibyla další build vrstva ani nástroj pro správu instalace.

### P2 — První HTTPS se kontrolovalo příliš brzy

Compose `--wait` nepotvrzuje vydání veřejného certifikátu Caddy. Jediný
okamžitý HTTPS pokus proto mohl označit zdravou instalaci za neúspěšnou.
Kontrola nyní opakuje pokusy přibližně minutu, kontroluje HTTP stav,
přesměrování i výsledek health odpovědi. Každý HTTP pokus má timeout.
Regresní testy ověřují pozdější dostupnost a odmítnutí cizího přesměrování.
Veřejné ACME s opravdovou školní doménou zůstává krokem skutečného nasazení.

### P2 — Kontrola místa neviděla plný Docker disk

Původní minimum 1 GiB kontrolovalo jen instalační adresář. Při lokálním
ověřování měl hostitel volné místo, ale samostatný 8GiB Docker disk už jen
asi 267 MiB. Build skončil chybou `ENOSPC` při rozbalování závislostí.

Instalátor nyní vyžaduje alespoň 3 GiB volných na instalačním i Docker
filesystemu. Návod doporučuje 10 GiB před údržbou a další rezervu na data.
To je základní preflight, nikoli výpočet kapacity libovolně velké obnovy.
Regresní test ověřuje plný Docker disk při současně volném instalačním disku.

### P2 — Vnořené konfigurace se mohly dostat do buildu

`.dockerignore` neobsahoval explicitní pravidla pro vnořené `.env` soubory.
Doplněné jsou `**/.env` a `**/.env.*`. Ověřeno skutečným buildem s dočasným
neškodným souborem v `apps/api`, který v obrazu není. Pravidla Docker
kontextu a `**` popisuje [oficiální dokumentace](https://docs.docker.com/build/concepts/context/#dockerignore-files).

### P2 — Zbytečné volby a nejednoznačné výchozí nastavení

Odstraněný je vlastní klient pro stahování releasů a přepínač aktualizace
podle vzdáleného `latest`. Balení už nepřepisuje verzi a `upgrade_from`
parametry příkazové řádky. Odpadlo dvojí zadávání stejného rozhodnutí.

Odstraněné jsou také nepoužité volby vlastních portů, bind adresy a názvu
Docker projektu. Vlastní HTTPS port nebyl úplně sladěný s automatickým HTTP
přesměrováním Caddy. První podporovaná instalace má nyní jen dokumentované
porty pro dvě síťové varianty. Oddělené Docker projekty nástroj pojmenovává sám.

`.env.example` je výslovně pro lokální HTTP vývoj. Produkční Compose dál
vynucuje bezpečné HTTPS cookies a instalátor si generuje vlastní konfiguraci.

### P2 — CI bez časových limitů a souběžný mirror

CI má timeouty 20/10/30/15 minut pro validaci, DB integrace, produkční
průchod a obnovu. Starý běh PR lze zrušit novějším; vydání se takto neruší.
Mirror má maximální dobu 5 minut a společnou frontu, aby si souběžné běhy
nepřepisovaly stav. Kopírují se `main`, `develop` a release tagy `v*`, bez
automatického mazání a bez force push. Pracovní větve se při limitu dvou
commitů amendují, proto nepatří do této synchronizace. Divergentní historii musí posoudit správce. Původní
`--mirror` zahrnoval i destruktivní synchronizaci; automatická kontrola
zamítla úpravu s prune, proto je výsledná varianta výslovně nedestruktivní.
Před pushnutím byla ověřená shoda názvů vzdálených větví/tagů, bez unikátních
GitLab položek. Při budoucím mazání větví na GitHubu může být potřebný
samostatně schválený úklid GitLabu. Význam souběhu dokumentuje
[GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

Produkční CI vědomě načte servisní a základní obrazy, pak ověří a zabalí
jejich konkrétní obsah. Školní instalace potom používá obsah balíčku s
`pull_policy: never`. Bezpečnostní aktualizace základních obrazů vyžadují nové
ověřené vydání, nemění se na škole samovolně.

## Posouzení složitosti

Instalátor má přibližně tisíc řádků Pythonu, tedy už nejde o triviální
wrapper kolem Compose. Tuto část je potřeba udržovat a testovat. Její
opodstatnění je v konzistentní záloze, obnovení dat, práci s vydáními a
řešení chyb bez přepsání školy. Zkrácení na několik shell příkazů by tyto
kroky přesunulo na IT správce.

| Část | Rozhodnutí a důvod |
| --- | --- |
| Docker Compose | Ponechat pro jednu školní VM; samostatný cluster není potřeba |
| Python ze standardního Ubuntu | Ponechat; instalátor nepřidává pip závislosti ani vlastní daemon |
| Malý runtime vedle CLI | Ponechat pro společné čtení manifestů a bezpečnou práci s archivy |
| Nové volumes při obnově | Ponechat; původní data zůstávají dostupná při neúspěchu |
| Verzované releasy a atomický `current` | Ponechat pro obnovu správné verze; není to automatický rollback DB |
| Offline archive všech pěti obrazů | Ponechat pro opakovatelné nasazení bez školního buildu a registry loginu |
| Druhý zálohovací kontejner | Odstraněn; duplicitní a neúplný postup |
| Online aktualizační kanál a volby vlastní sítě | Odstraněny z první verze |
| Další platformy, orchestrace a cloud provisioning | Nejsou součástí tohoto kroku |

Po těchto úpravách rozsah odpovídá požadavku na správu školní instalace.
Největší cena zůstává obnova; její ochrany se nemají zkracovat jen kvůli
počtu řádků. Současné rozhraní nepotřebuje další obecné konfigurační vrstvy.

## Zálohování, aktualizace a obnova

Záloha obsahuje DB dump, školní média, stav Caddy, konfiguraci a identitu
vydání. Databáze a média se kopírují při zastavených aplikačních službách.
Je to plánovaná krátká odstávka. Výchozí retence je sedm úplných archivů.
Neexistuje šifrování archivu ani přímá integrace s konkrétním NAS/cloudem;
umístění, oprávnění a kopii mimo server zajišťuje správce školy.

Aktualizace předem kontroluje platformu, povolenou předchozí verzi a hlavní
verzi PostgreSQL. Při selhání migrace nepřepne automaticky starý obraz nad
změněnou databázi. Zůstává určená nová verze a předaktualizační záloha.
Přechod mezi hlavními verzemi PostgreSQL tento nástroj neprovádí.

Obnova kontroluje archiv ještě před odstavením existující školy a vytváří
nový Docker projekt. Při neúspěchu odstraňuje pouze kandidáta a pokouší se
obnovit původní provoz. Staré volumes po úspěchu zůstávají; jejich pozdější
úklid vyžaduje samostatné ověření. Záloha sama neobsahuje Docker obrazy,
proto je pro obnovu na prázdném serveru nutný i odpovídající instalační balíček.

Podrobný provozní postup má jediné místo v [návodu k nasazení](deployment.md).

## Ověření a jeho limity

| Ověření | Výsledek lokálního auditu |
| --- | --- |
| Ruff a formát nasazovacích nástrojů | Prošlo |
| Regrese instalace, záloh, obnovy a manifestů | 27 testů prošlo |
| Kompletní kontrola aplikace | Lint, typy, testy a build prošly |
| API | 320 prošlo, 18 přeskočeno, 1 vyřazený scénář; pokrytí 89,17 % |
| PostgreSQL 16 a Redis 7 | 18 skutečných integrací prošlo |
| Webové unit testy | 9 prošlo |
| Chromium | Základní prohlížečový test prošel |
| GitHub Actions syntax a závislosti jobů | Actionlint 1.7.12 prošel |
| npm po bezpečnostních aktualizacích | 0 zranitelností |
| Python alerty proti aktuálnímu lockfile | Žádný z nalezených alertů už nesedí |
| Opravený API Dockerfile | Nový obraz se sestavil, UID 10001 a média ověřena |
| Pět produkčních služeb přes HTTPS | Health, 16 statických assetů, login, změna hesla, založení účtu a SSR prošly |
| Docker build context | Vnořený testovací `.env` není v obrazu; uv cache je vyřazená |

ARM64 testovací balíček před bezpečnostní aktualizací měl přibližně
305 MiB, oproti dřívějším 326 MiB. Tyto testovací obrazy se nemají použít
jako školní vydání; obsahují předchozí verze závislostí. Kontroluje se jeho checksum, obsah a shoda nasazovacích skriptů
se zdroji větve. Skutečný publikační artefakt musí vzniknout až v CI z
čistého checkoutu.

Nový Next.js 16.4.1 po bezpečnostních aktualizacích prošel lokálním
produkčním buildem, Chromium testem a kompletním `pnpm check`. Následující
Docker/velikostní měření pocházejí z předchozí fáze auditu.

Lokální čistý společný build API a webu narazil na kapacitu Docker disku.
Následně se sestavilo opravené API samostatně a použil se dříve ověřený webový
obraz. Shoda jeho aplikačních zdrojů, závislostí a Dockerfile byla ověřená
vůči prvnímu commitu této větve. To nenahrazuje čistý společný build v CI. Širší úklid sdílené cache byl
automatickou kontrolou zamítnut kvůli riziku zásahu do dalších projektů;
byly použité jen bezpečně vybrané nesdílené záznamy, bez mazání cizích dat.

Dřívější skutečný průchod na dvou Ubuntu 24.04 ARM64 VM ověřil instalaci,
systemd, proxy režim, aktualizaci, obnovu, reboot a přihlášení v Chromiu.
Byl proveden před posledními opravami auditu. Na PR [#47](https://github.com/bodhq/bod/pull/47) následně prošel i
[AMD64 CI běh](https://github.com/bodhq/bod/actions/runs/41865259800)
s opravenou infrastrukturou. Poslední bezpečnostní aktualizace vznikly
potom; nový běh nad konečným commitem musí znovu ověřit příslušné obrazy. Aktualizační test používá
synteticky vyšší verzi se stejným aplikačním obsahem; skutečnou migrační
dvojici je nutné ověřit před přidáním do `upgrade_from`.

Naměřená RAM a odezvy jsou v [provozním návodu](deployment.md#naměřená-spotřeba).
Zátěž 201 účtů a 20 souběžných relací nezahrnovala skládání velkých rozvrhů
ani velká média a neurčuje kapacitu celé školy.

## Otevřené provozní body

1. **GitLab mirror:** opakovaná kontrola HTTPS, čtení repozitáře i
   [první Actions synchronizace](https://github.com/bodhq/bod/actions/runs/41865064883)
   prošly. Následné zúžení na dlouhodobé větve a release tagy bylo ověřené
   přes `git push --dry-run` nad čerstvým klonem. Nové pracovní commity se
   do GitLabu už automaticky nekopírují; aktuální review je na GitHubu.
   Dosavadní snímek pracovní větve z prvního průchodu na GitLabu zůstává;
   jeho případné odstranění vyžaduje samostatný úklid.
2. **Pravidla větví:** GitHub API pro `develop` vrátilo „Branch not protected“.
   CODEOWNERS vybírá recenzenty, ale nevynucuje úspěšné kontroly ani review.
   Zapnutí ochrany je samostatné rozhodnutí vlastníka repozitáře; audit
   nepřepisuje organizační nastavení bez něj.
3. **První škola:** před produkčním provozem ověřit skutečné DNS/TLS,
   zálohu mimo server, dostupnost úložiště a reprezentativní školní data.
   Podporovaný základ je Ubuntu 24.04, 2 vCPU, 4 GiB RAM a 30 GB SSD plus
   data/zálohy. Pro vyšší zátěž je potřeba vlastní měření a CPU rezerva.
4. **Testovací závislosti:** běh hlásí jednu upstream deprecaci FastAPI/
   Starlette test klienta s `httpx`. Testy procházejí; aktualizace této
   závislosti nebyla přimíchaná do provozních oprav.

## Podmínky uzavření prvního kroku

Větev byla pushnutá a má draft PR [#47](https://github.com/bodhq/bod/pull/47)
do `develop`.
Ke sloučení musí projít aktuální vzdálené CI a review změn. První technický
krok je pak uzavřený; publikační tag, draft release a skutečné nasazení
školy jsou další samostatné úkony. Žádný z nich se tímto auditem automaticky
neprovádí. První ostrý běh zúženého GitLab workflow nad změněnou dlouhodobou
větví se zkontroluje po merge; read/dry-run ověření ho plně nenahrazuje.
