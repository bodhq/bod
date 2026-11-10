# Nasazení na školní server

Škola provozuje vlastní Linux server, databázi a média. Potřebuje Docker
Engine s Compose, Python 3.12 a internet pro stažení hotových obrazů.
Na serveru se aplikace nesestavuje. Offline distribuce zatím není podporovaná.

## Příprava

Pro pilot počítej s 2 vCPU, 4 GiB RAM, 30 GB SSD a dalším místem na data
a zálohy. Jde o výchozí odhad, ne ověřenou kapacitu celé školy.
Výchozí systém je Ubuntu Server 24.04. Před změnou instalace nástroj ověřuje
alespoň 3 GiB volných na instalačním disku; další místo potřebuje i úložiště Dockeru.

| Režim HTTPS | Nastavení |
| --- | --- |
| Přímé HTTPS | Doména míří na server, porty 80/443 obsluhuje Caddy |
| Školní proxy | Školní HTTPS proxy předává celou doménu na `127.0.0.1:8080` |

Databáze, Redis a samostatné API nemají veřejné porty. Aplikace používá
vlastní kořen domény; instalace do podcesty není podporovaná.

## Instalace

Z publikovaného vydání převezmi malý archiv konfigurace a jeho `.sha256`.
Obsahuje Compose, Caddyfile, `bod.py` a odkazy na obrazy v `images.env`.

```sh
sha256sum -c bod-v0.1.0.sha256
tar -xzf bod-v0.1.0.tar.gz
cd deploy
python3 bod.py install --domain bod.skola.cz
```

Za školní HTTPS proxy přidej `--proxy`. Příkaz vytvoří náhodné databázové
heslo v `config.env`, stáhne obrazy, spustí služby a vypíše dočasné heslo
správce. Při prvním přihlášení jej změň. Opakovaná instalace zachová konfiguraci.

Instalační adresář obsahuje citlivé údaje. Uchovej ho na trvalém disku
s přístupem jen pro školního správce. Příkazy spouští účet s přístupem k Dockeru.

## Správa

Příkazy spouštěj v instalačním adresáři:

| Příkaz | Výsledek |
| --- | --- |
| `python3 bod.py status` | Stav služeb |
| `python3 bod.py backup /mnt/skolni-nas/bod/zaloha-2026-11-09` | Záloha do nové prázdné složky |
| `python3 bod.py update /cesta/nove-images.env` | Stažení obrazů, záloha a aktualizace |
| `python3 bod.py restore /cesta/zaloha` | Obnova do nového Docker projektu |

Záloha obsahuje databázi, média, konfiguraci a odkazy na aplikační obrazy.
Aplikační služby jsou během vytváření krátce zastavené; po chybě se znovu
spustí dříve běžící služby. Dokončenou zálohu označuje `.complete`.

Zálohy nejsou šifrované. Ukládej je na chráněné úložiště mimo server.
Plánování a retenci nastav ve školním zálohování nebo cronu; nástroj
neinstaluje vlastní systemd služby. Uchovej i instalační archiv a zajisti,
že obrazy ze zálohy zůstávají dostupné v registru.

## Aktualizace a obnova

Nový `images.env` vezmi z ověřeného vydání. Stávající soubor před spuštěním
`update` nepřepisuj. Aktualizace nejprve stáhne obrazy a vytvoří zálohu.
Příkaz mění aplikační obrazy; změny Compose nebo správy instalace se řídí
návodem konkrétního vydání. Migrace provádí backend při startu. Při neúspěchu zůstávají zvolené nové
obrazy; po změně databáze se starý obraz automaticky nespouští.

Obnova načte databázi a média do nového projektu. Původní služby zastaví
až při přepnutí. Při jeho chybě znovu spustí původní služby; původní volumes
nemaže. Po úspěchu zůstávají stará data na disku, dokud je správce po
ověření obnovy výslovně neodstraní.

Na čistém serveru rozbal stejný instalační archiv a spusť `restore` nad
kopií zálohy. Certifikáty Caddy se vytvoří znovu. Doménu přesměruje školní IT.
Převod staršího offline instalátoru není automatický. Hlavní verzi
PostgreSQL tento postup neaktualizuje.

## Vydávání

Číslo vydání určuje Git tag, například `v0.1.0`. Sdílený `scripts/ci`
sestaví a otestuje obrazy; GitHub z téhož testovaného sestavení publikuje
obrazy a připraví draft vydání. Archiv obsahuje odkazy podle digestu.
Testovací zálohy ani přihlašovací údaje se nepublikují.

Před prvním veřejným vydáním nastav balíčkům `bod/api` a `bod/web` v GHCR
veřejnou viditelnost. Vydávací skript ověřuje anonymní dostupnost obrazů.
Veřejnost Git repozitáře nestačí. Draft zkontroluje a zveřejní vydavatel.

Ověření a podmínky GitLab runneru popisuje [testování](testing.md).
Výběrová instalace modulů zatím není podporovaná; stav uvádí
[architektura](architecture.md#moduly).

## Automatické vývojové nasazení

Vývojová instance je oddělená od školních instalací. Push do `develop`
projde kontrolami a integračními testy. Produkční job sestaví a ověří obrazy,
publikuje je do GHCR a jako poslední krok zveřejní jejich společný manifest
ve vývojovém prerelease `development`. Při neúspěšných kontrolách se verze
nezmění. Opožděný běh staršího commitu vývojové vydání nepřepíše.

VPS si manifest stahuje samo. Nepotřebuje přístup z GitHub runneru do
školní sítě, SSH heslo v CI ani GitHub token. Přijímá pouze dvojici obrazů
`bod/api` a `bod/web` podle digestu. Updater nepřijme školní instalaci jako
vývojovou. Před aktualizací používá stejnou zálohu a kontrolu zdraví jako
`bod.py update`.

### První příprava

V GHCR musí být balíčky `bod/api` a `bod/web` veřejné, stejně jako pro
běžné vydávání. CI používá vlastní `GITHUB_TOKEN` s oprávněními
`contents: write` a `packages: write`; další SSH tajemství se nenastavují.

Po prvním úspěšném CI stáhni z vývojového prerelease `development.tar.gz`,
rozbal jej do samostatného adresáře a nastav adresu instance:

```sh
mkdir -p ~/bod-development
cd ~/bod-development
wget https://github.com/bodhq/bod/releases/download/development/development.tar.gz
tar -xzf development.tar.gz --strip-components=1
python3 development.py init --origin https://10.202.30.201
python3 development.py update
```

Na Alpine stačí Docker s Compose a Python 3.12 nebo novější. Dokumentace
ani aplikační obrazy se na VPS nesestavují. Konfigurace se při opakovaném
`init` nepřepisuje. Údaje prvního správce jsou v `.first-admin.txt`; soubor
má přístup jen pro vlastníka a po změně hesla jej odstraň.

Updater lze spouštět každé dvě minuty z cronu účtu s přístupem k Dockeru:

```cron
*/2 * * * * cd /home/student/bod-development && /usr/bin/python3 development.py update >> development.log 2>&1
```

Shodné obrazy znovu nenasazuje. Před aktualizací vyžaduje alespoň 3 GiB
volného místa. Zálohy a staré obrazy nemaže automaticky; průběžně kontroluj
jejich velikost. Pro delší provoz rozšiř disk alespoň na výchozích 30 GB.

### Adresa a přístup

Cílová adresa první instance je `https://10.202.30.201`, dostupná jen
ze školní sítě nebo VPN. Caddy pro privátní IP používá vlastní certifikační
autoritu. Její veřejný kořenový certifikát musíš jednou ověřit a přidat do
důvěryhodných na testovacích počítačích. Nestačí jen přeskočit varování
prohlížeče; některé editory potřebují důvěryhodný HTTPS kontext.

Po prvním spuštění exportuj pouze veřejný certifikát, nikoliv soukromý klíč:

```sh
docker cp bod-development-caddy-1:/data/caddy/pki/authorities/local/root.crt ./development-root.crt
```

Soubor přenes přes ověřené SSH spojení, porovnej jeho otisk a důvěru nastav
ručně ve správě certifikátů systému či prohlížeče. HTTPS ponechává `Secure`
cookies zapnuté. HTTP je v updateru dostupné pro samostatné lokální použití,
ale nezajišťuje funkčnost všech editorů při přístupu přes síť.

Pro stálou adresu použij `dev.bodhq.cz`. Záznam A na `10.202.30.201`
zjednoduší název, ale nezajistí přístup z internetu ani veřejný certifikát.
HTTPS pro privátní server musí řešit školní proxy nebo DNS ověření domény;
samotný veřejný DNS záznam nestačí. Přechod adresy vyžaduje úpravu
`SITE_ADDRESS`, `ALLOWED_ORIGINS`, portů a `COOKIE_SECURE` v konfiguraci.

Aktualizace mění obrazy, ne instalační skripty. Pokud vydání mění Compose,
Caddyfile nebo updater, převezmi příslušné soubory z nového archivu podle
jeho pokynů; existující `config.env` a data zachovej.
