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
