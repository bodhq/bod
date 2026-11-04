# Nasazení

Produkční služby jsou v `infra/docker-compose.yml`, HTTPS proxy v
`infra/Caddyfile`. Příkazy spouštěj z kořene repozitáře. Potřebuješ Linux
s Docker Engine a Compose; pro ověřovací override Compose alespoň 2.24.4
(kvůli [nahrazení portů pomocí `!override`](https://docs.docker.com/reference/compose-file/merge/)).
Lokální Node a Python při sestavení v Dockeru nejsou potřeba.

## První nasazení

Při první instalaci vytvoř `.env` podle `.env.example`, existující konfiguraci
nepřepisuj. Nastav:

- `DOMAIN`: veřejnou doménu, která směřuje na server.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: vlastní databázový účet a heslo.
- `DOCKER_DATABASE_URL`: stejný účet a databázi na interním hostu `db:5432`;
  speciální znaky hesla v URL musí být URL-enkódované.
- `ALLOWED_ORIGINS`: JSON seznam veřejných HTTPS původů, například `["https://skola.example.cz"]`.

Lokální `DATABASE_URL` s `localhost:5433` není připojení používané produkčním
API v Compose. Redis dostane API přes interní adresu; produkční Compose
nastavuje `DEBUG=false` a zabezpečené cookies.

```sh
docker compose --env-file .env -f infra/docker-compose.yml up -d --build --wait --wait-timeout 180
docker compose --env-file .env -f infra/docker-compose.yml exec api python -m server.scripts.bootstrap_admin
```

Bootstrap vypíše dočasné heslo prvního správce; při prvním přihlášení je
nutná změna. Heslo ani `.env` neukládej do repozitáře. Bootstrap je
idempotentní: existujícího správce ani jeho heslo nepřepisuje.

Caddy zveřejňuje 80/443, API, web, databáze a Redis mají jen vnitřní porty.
Pro veřejný certifikát musí být doména i porty dostupné z internetu.
`DOMAIN=localhost` slouží lokálnímu ověření s vlastní certifikační autoritou.
Web se sestavuje s interním API `http://api:8000`; při změně topologie uprav
build argument i runtime proměnnou `API_INTERNAL_URL` a web znovu sestav.

API při startu provede existující verzované migrace. Zdraví API, webu,
databáze, Redisu a zálohovací služby ověřuje Compose. `/health` přes Caddy
kontroluje API a připojení k databázi; samostatně netestuje Redis ani celé UI.
API i web běží pod nepřivilegovaným uživatelem. Logy mají rotaci 3 × 10 MB
na službu. CI provádí kontroly a test produkčních obrazů, nenasazuje na server.

## Data, zálohy a obnova

PostgreSQL, média školy a data Caddy mají samostatné pojmenované volumes.
`db-backup` vytváří denní SQL zálohy do `backups/`, s denní, týdenní a měsíční
retencí. Ruční zálohu lze vyvolat takto:

```sh
docker compose --env-file .env -f infra/docker-compose.yml exec -T db-backup /backup.sh
```

SQL záloha nezahrnuje `school-media`, Caddy konfiguraci ani `.env`. Úplná
obnova potřebuje i tyto součásti a kopii mimo server. Níže je ověření obnovy
do **nové testovací databáze**, nikdy nepoužívej název provozní databáze:

```sh
set -o pipefail
docker compose --env-file .env -f infra/docker-compose.yml exec -T db sh -c \
  'createdb -U "$POSTGRES_USER" bod_restore_verify'
docker compose --env-file .env -f infra/docker-compose.yml exec -T db-backup sh -c \
  'gzip -dc "/backups/last/$POSTGRES_DB-latest.sql.gz"' | \
  docker compose --env-file .env -f infra/docker-compose.yml exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d bod_restore_verify'
```

Ověř očekávané počty záznamů a aplikaci v izolovaném prostředí. Provozní
aktualizace musí počítat se zálohou před migrací; vrácení staršího obrazu
samo nevrátí změny v databázi. Běžné zastavení `docker compose down` volumes
zachovává. Přepínač `--volumes` používej jen při rušení testovací instalace.

## Izolovaný produkční test

`infra/docker-compose.verify.yml` nahrazuje veřejné porty za loopback
18080/18443 a zálohy ukládá do vlastního volume. Databázi a Redis zveřejní
jen na loopback 55432/56379 pro integrační testy. Vždy použij jiný název
projektu a vlastní dočasný env soubor, například `/tmp/bod-verify.env`:

```dotenv
POSTGRES_USER=bod_verify
POSTGRES_PASSWORD=disposable-local-test-only
POSTGRES_DB=bod_verify
DOCKER_DATABASE_URL=postgresql://bod_verify:disposable-local-test-only@db:5432/bod_verify
ALLOWED_ORIGINS=["https://localhost:18443"]
```

```sh
export COMPOSE_PROJECT_NAME=bod-verify
export COMPOSE_FILE=infra/docker-compose.yml:infra/docker-compose.verify.yml
docker compose --env-file /tmp/bod-verify.env up -d --build --wait --wait-timeout 180
curl --fail --insecure https://localhost:18443/health
```

`--insecure` zde slouží výhradně lokálnímu certifikátu. Test v CI navíc
ověřuje anonymní `401`, dostupnost všech odkazovaných statických souborů,
Secure cookie, změnu dočasného hesla a skutečné vykreslení `/app` po
přihlášení bez přesměrování zpět na login. Prohlížeč lze připojit podle
[testovací příručky](../testing.md). Po ověření smaž pouze tento projekt:

```sh
docker compose --env-file /tmp/bod-verify.env down --volumes --remove-orphans
unset COMPOSE_FILE COMPOSE_PROJECT_NAME
```

## Spotřeba a výchozí požadavky

Ověřeno 4. 11. 2026 na této provozní větvi z `origin/develop` (`2184e1e`).
Host: macOS ARM64, 8 CPU a 16 GiB RAM. Docker Desktop poskytoval Linuxu
4 CPU a 3,827 GiB RAM. Běžely i jiné projekty; níže se započítávají jen
kontejnery samostatného projektu `bod-readiness-20261104`.

Testovací databáze obsahovala 201 účtů. Po ověření HTTPS, všech 16 statických
souborů loginu, Secure cookie a změny hesla se přihlásilo 20 relací jednoho
správce. Po 20 sekundách klidu běželo 45 sekund 20 HTTP workerů bez pauz,
střídavě `GET /api/v1/auth/me`, `GET /api/v1/admin/users?offset=0&limit=50`
a skutečné SSR `GET /app`. Každá odpověď musela mít stav 200; přesměrování
na login se počítalo jako chyba. Následně prošlo odhlášení a odmítnutí
zneplatněné relace.

| Výsledek | Hodnota |
| --- | ---: |
| Dokončené požadavky | 12 243 |
| Chybné odpovědi a timeouty | 0 |
| Průměrná propustnost | 271,8 požadavku/s |
| Latence P50 / P95 / P99 | 69,5 / 116,0 / 148,6 ms |
| RAM všech šesti služeb, klidový medián | 260,3 MiB |
| RAM všech šesti služeb, nejvyšší společný vzorek při zátěži | 373,0 MiB |
| CPU při zátěži, průměr / nejvyšší společný vzorek | 1,85 / 2,00 CPU |

Paměť a CPU zaznamenával `docker stats --no-stream` každé 2 sekundy:
9 kompletních klidových a 22 zátěžových vzorků. CPU 100 % v tomto výpisu
odpovídá jednomu jádru. Jde o spotřebu vykazovanou Dockerem, bez paměti
hostitelského OS, celé VM a části souborové cache. Vzorkování nemusí zachytit
krátké špičky.

| Služba | Klidový medián RAM | Maximum RAM při zátěži |
| --- | ---: | ---: |
| API | 125,2 MiB | 131,9 MiB |
| Web | 56,1 MiB | 134,7 MiB |
| PostgreSQL | 44,8 MiB | 67,0 MiB |
| Redis | 9,2 MiB | 9,2 MiB |
| Caddy | 20,6 MiB | 27,9 MiB |
| Zálohování | 4,4 MiB | 4,8 MiB |

Maxima jednotlivých služeb nastávají v různých okamžicích, jejich součet
není společné maximum. Obrazy hlášené `docker image ls` měly přibližně
322 MB pro web a 490 MB pro API; databáze, Redis, proxy a zálohování přidávají
další obrazy. Velikosti zahrnují sdílené vrstvy a nejsou součtem skutečně
obsazeného disku. Nová databáze po přípravě testů zabrala přibližně 85 MiB.

Lokální build s Node 22.23.4 měřený `/usr/bin/time -l` trval při prvním
sestavení 12,92 s s maximem RSS 1,32 GiB; opakované sestavení finálního webu
trvalo 5,91 s s maximem RSS 498,5 MiB. RSS z tohoto nástroje není součtem
všech současně běžících workerů. Časy nezahrnují instalaci závislostí.
Docker build prošel v uvedené 4GB VM; stažení závislostí na této síti trvalo
řádově minuty. Pro build a provoz proto plánuj paměť odděleně.

**Výchozí rozpočet pro pilot:** 2 vCPU, 4 GiB RAM, alespoň 30 GB SSD a
samostatně dimenzované místo na školní data, média a zálohy. Před buildem
ponech alespoň 10 GB volného místa v úložišti Dockeru i na hostiteli. Během
ověřování došlo k `ENOSPC` při kopírování standalone serveru; pomohl cílený
úklid 1,05 GB vlastní dočasné build cache. Nemaž kvůli tomu provozní volumes.
Při souvislé zátěži podobné testu už 2 CPU nemají významnou rezervu;
pro takový provoz začni se 4 vCPU a ověř skutečný školní scénář.

To jsou výchozí odhady pro pilot a rezervu, ne prokázaná minimální konfigurace.
Test neposuzuje celou školu: neobsahoval velké rozvrhy, složité skupiny,
uploady, dávky souběžných přihlášení ani paralelní zálohování. Dvacet HTTP
workerů nenahrazuje dvacet plných prohlížečů. Měřený frontend odpovídá této
provozní větvi; po začlenění rozpracovaných obrazovek měření zopakuj.

Samostatně prošly SQLite testy (320 úspěšných, 18 integrací přeskočeno,
1 původní scénář vyřazen), PostgreSQL/Redis integrace (18 úspěšných), webové
unit testy (9 úspěšných), základní Chromium test a produkční build.
Vyřazené staré testovací soubory a důvody popisuje [testovací příručka](../testing.md).
Byla ověřena i SQL záloha a obnova 201 účtů do jiné nové databáze.
Chromium ověřilo přihlášení přes skutečný formulář a obnovení přihlášené
stránky bez JavaScriptových chyb.
Po restartu API a webu zůstala funkční přihlášená relace i školní účty.
OpenAPI export přímo z produkčního obrazu přesně odpovídal uloženým snapshotům.
