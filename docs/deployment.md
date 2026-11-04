# Instalace a správa školního serveru

Každá škola má vlastní Linux VM, databázi a média. Podporované výchozí
prostředí je Ubuntu Server 24.04, Docker Engine, Docker Compose alespoň
2.24.4 a systémový Python 3.12. Aplikační závislosti jsou uvnitř obrazů;
na školním serveru se nepoužívá pnpm, uv ani sestavení zdrojového kódu.

## Příprava školy

IT správce připraví VM a doménu, například `bod.skola.cz`. Výchozí rozpočet
pro pilot je 2 vCPU, 4 GiB RAM, 30 GB SSD a místo na školní data a zálohy.
Instalátor ověřuje alespoň 3 GiB volného místa na instalačním i Docker
filesystemu. Před instalací nebo aktualizací ponech alespoň 10 GiB volných
a další místo podle velikosti školních dat.
Pro trvalou zátěž podobnou níže uvedenému testu plánuj rezervu CPU.

Vyber jeden způsob přístupu:

- **Direct:** Caddy v balíčku obsluhuje HTTPS. Doména musí směrovat na server;
  pro automatický veřejný certifikát musí fungovat síťové podmínky ACME.
  Výchozí porty jsou 80 a 443.
- **Proxy:** HTTPS zajišťuje existující školní proxy. Balíček zpřístupní HTTP
  na `127.0.0.1:8080`; školní proxy na něj přeposílá celou doménu včetně
  `/api/`. Veřejná adresa nadále používá HTTPS. Certifikáty a konfiguraci
  této vnější proxy spravuje a zálohuje školní IT.

Doména má vlastní kořen webu, například `https://bod.skola.cz/`.
Postup nepočítá s instalací do podcesty jiného webu.
Databáze, Redis a samostatné API nemají veřejné porty.

## První instalace

Od vydavatele převezmi balíček odpovídající platformě VM a soubor `.sha256`.
Například pro AMD64 vydání 0.1.0:

```sh
sha256sum -c bod-0.1.0-linux-amd64.sha256
mkdir bod-installer
tar -xzf bod-0.1.0-linux-amd64.tar.gz -C bod-installer
cd bod-installer
sudo ./bod install
```

Průvodce se ptá na doménu, režim HTTPS, jméno prvního správce a adresář záloh.
Interní databázové heslo a navazující adresy vytvoří sám. Po spuštění ověří
služby a HTTPS, vypíše dočasné heslo správce a přidá příkaz `bod`.
Při prvním přihlášení je nutná změna hesla. Potom vytvoř první úplnou zálohu:

```sh
sudo bod status
sudo bod doctor
sudo bod backup
```

Instalace je v `/opt/bod`. Konfigurace a zálohy obsahují citlivé údaje;
mají omezená oprávnění. Opakování `install` existující konfiguraci a hesla
nepřepisuje. `--root` dovoluje zvolit jiný samostatný instalační adresář.

Balíček obsahuje všech pět hotových obrazů včetně PostgreSQL, Redisu a Caddy.
Instalace nevyžaduje přihlášení do registru ani přístup ke zdrojovému repozitáři.
Automatické veřejné HTTPS potřebuje spojení s certifikační autoritou;
v uzavřené síti použij školní proxy a certifikát důvěryhodný pro klienty.

## Běžná správa

| Příkaz | Výsledek |
| --- | --- |
| `sudo bod status` | Verze, stav služeb, adresář a poslední úspěšná záloha |
| `sudo bod doctor` | Kontrola prostředí, dostupnosti webu a databáze přes HTTPS |
| `sudo bod start` | Opakované spuštění právě zvolené verze |
| `sudo bod backup` | Úplná konzistentní záloha s krátkou odstávkou aplikace |
| `sudo bod update --bundle /cesta/bod-verze-platforma.tar.gz` | Řízená aktualizace |
| `sudo bod restore /cesta/zaloha.tar.gz` | Obnova do nových datových volumes |

Systémový timer `bod-backup.timer` spouští zálohu denně od 02:30 v časové zóně
Europe/Prague, s náhodným odkladem do 20 minut. Výsledek úlohy je v systemd:

```sh
sudo systemctl status bod-backup.timer bod-backup.service
sudo journalctl -u bod-backup.service
```

Kontroluj i stáří poslední úspěšné zálohy. OS a Docker aktualizuje školní IT;
`bod update` spravuje vydání aplikace.

## Zálohy

Záloha zahrnuje databázi, školní média, data a konfiguraci našeho Caddy,
nastavení instalace a identifikaci vydání. Výchozí retence je posledních
7 úplných záloh této instalace. Během kopírování jsou aplikační služby zastavené,
aby soubory a databáze odpovídaly jednomu stavu. Při chybě zálohy se nástroj
pokusí původně běžící služby znovu spustit.

Výchozí `/opt/bod/backups` je lokální kopie. Pro obnovu po ztrátě VM je nutná
kopie mimo server, například do připojené NAS zvolené při instalaci. Dostupnost
síťového úložiště zajišťuje školní IT. Archiv není sám šifrovaný; uložiště
musí chránit školní data i databázové přihlašovací údaje, které záloha obsahuje.

Hotové obrazy nejsou součástí každé zálohy. Uchovej i původní instalační
balíček pro verzi uvedenou v záloze; na prázdném serveru je potřebný pro obnovu.

## Aktualizace

Převezmi novou verzi a ověř její checksum. Potom:

```sh
sudo bod update --bundle /cesta/bod-0.2.0-linux-amd64.tar.gz
```

Číslo je příklad budoucí verze. Instalátor nejprve ověří obsah, platformu,
povolenou předchozí verzi a shodu hlavní verze PostgreSQL. Načte obrazy,
vytvoří úplnou zálohu, přepne vydání a spustí služby. Stávající backend
provede své migrace při startu. Nakonec se ověří dostupnost.

Po změně databáze se nástroj automaticky nevrací ke starému obrazu. Při chybě
zůstává zvolená nová verze a cesta k předaktualizační záloze; správce může
odstranit provozní příčinu a použít `bod start`, nebo provést výslovnou obnovu.
Hlavní verze PostgreSQL se tímto postupem nemění.

Aktualizace používá výslovně předaný lokální balíček; nástroj sám nevybírá
vzdálené vydání ani nevyžaduje přístup do soukromého GitHub repozitáře.
`--yes` slouží automatizaci již schválené aktualizace nebo obnovy.

## Obnova

Na existujícím serveru:

```sh
sudo bod restore /cesta/bod-backup-identita-cas.tar.gz
```

Obnova vytvoří jiný Docker projekt a nové volumes. Původní data zůstávají
zachovaná; po neúspěchu kandidáta se nástroj pokusí obnovit původní provoz.
Zálohu jiné instalace lze obnovit jen do prázdného instalačního adresáře.
Po úspěšné obnově staré volumes zabírají místo dál. Odstraň je až po ověření
obnovy a dostupnosti nezávislé zálohy; jejich identifikace je v metadatech instalace.

Na novém serveru s Dockerem a rozbaleným odpovídajícím instalačním balíčkem:

```sh
sudo ./bod restore /cesta/zaloha.tar.gz \
  --bundle /cesta/bod-0.1.0-linux-amd64.tar.gz \
  --backup-dir /mnt/skolni-nas/bod
```

Verze balíčku musí přesně odpovídat záloze. Účty a jejich hesla se obnoví
z databáze; bootstrap správce se znovu neprovádí. IT správce nasměruje původní
doménu na nový server. Ruční instalace vytvořené pouze původním Compose
nemají metadata tohoto formátu a vyžadují samostatný převod.

## Vydávání a ověření pro vývojáře

Metadata vydání jsou v `infra/release.json`; `upgrade_from` obsahuje pouze
skutečně ověřené předchozí verze. Balíček se generuje z
`infra/docker-compose.yml`, takže nemá druhou ručně udržovanou konfiguraci.
Zdrojový Compose i distribuce mají stejných pět služeb. Úplnou zálohu
spravuje příkaz `bod` a systemd timer; samostatný SQL zálohovací kontejner
se nepoužívá.

```sh
pnpm release:package --output /tmp/bod-dist \
  --api-image bod-ci-production-api --web-image bod-ci-production-web
```

Obrazy musí být předem sestavené a dostupné v lokálním Dockeru. Balíček
obsahuje jejich přesný obsah a kontrolní součty souborů. Při instalaci se
vždy načítá ověřený archiv, nepoužívá se vzdálený `latest` ani build na škole.

Tag `v0.1.0` musí odpovídat verzi v metadatech. Workflow School release nejprve
spustí celé CI, instalaci, aktualizaci a obnovu na dvou čistých Linux VM.
Potom připraví **draft release** s balíčkem a checksumem. Vydavatel jej
zkontroluje a publikuje. Testovací zálohy ani přihlašovací údaje se do
release nepřenášejí. Postup testů a jejich limity jsou v [testovacím návodu](testing.md).

## Naměřená spotřeba

Předchozí technický Compose se šesti službami při 20 souběžných relacích
nad 201 účty zvládl 12 243 požadavků za 45 s bez chyby, P95 116 ms a společné
vzorkované maximum 373 MiB RAM. Šlo o Docker Desktop se 4 CPU a 3,827 GiB RAM,
nikoli o kapacitní test celé školy. Lokální první build webu měl maximum RSS
1,32 GiB; warm build 498,5 MiB. RSS není součtem všech workerů.

Distribuční balíček s pěti službami byl 4. 11. 2026 otestovaný na Ubuntu
24.04 ARM64 VM se 2 vCPU a 3 GiB RAM. Instalace, HTTPS, školní proxy,
systemd zálohy, aktualizace, obnova dat i restart serveru prošly. Následná
obnova zálohy na druhé čisté VM zachovala účty, přihlášení i binární média.
Komprimovaný offline balíček měl přibližně 326 MiB.

Při 201 účtech a 20 souběžných přihlášených HTTP relacích během 45 s prošlo
10 515 požadavků bez chyby, přibližně 233/s, P95 139 ms. Mix obsahoval
`auth/me`, seznam 50 účtů a autentizované SSR `/app`. Zátěž běžela přímo
ve VM; při měření přes QEMU port forwarding se objevily TCP resety, takže
výsledek nepopisuje chování veřejné sítě. Součet vzorkované kontejnerové RAM
měl v klidu medián 391 MiB a při zátěži maximum 518 MiB; nezahrnuje OS ani
veškerou souborovou cache. Součet CPU při zátěži měl průměr 154 % a maximum
164 %; 100 % znamená jedno jádro. Generátor běžel na téže VM a soutěžil s
aplikací o CPU, jeho spotřeba není v součtu kontejnerů.

Uvedený rozpočet je výchozí odhad pro pilot. Test neobsahoval skládání
velkých rozvrhů, složité skupiny ani velká média a neurčuje kapacitu celé
školy. Pro školní špičky a reálné scénáře je potřeba vlastní měření.
