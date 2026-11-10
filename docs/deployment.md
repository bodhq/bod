# Nasazení na školní server

Instalace je ruční. CI připraví hotové Docker obrazy; na školním serveru
se aplikace nesestavuje. Stejný instalační balíček funguje bez přístupu
k registry. GitHub a GitLab runner nejsou na školním serveru potřeba.

## Příprava

Podporovaný základ je Linux, Docker Engine s Compose a Python 3.12+.
Docker a Python musí být nainstalované předem; balíček je neinstaluje.
Pro pilot počítej s 2 vCPU, 4 GiB RAM a 30 GB SSD plus místem na zálohy.
Jde o výchozí odhad, ne ověřenou kapacitu celé školy.

| Přístup | Nastavení |
| --- | --- |
| Přímé HTTPS | Doména míří na server; Caddy používá porty 80/443 |
| Školní HTTPS proxy | Přidej `--proxy`; proxy předává provoz na `127.0.0.1:8080` |

Databáze, Redis a API nemají veřejné porty. Aplikace používá kořen domény.
Bez internetu zajisti školní HTTPS proxy nebo interní certifikát.
Veřejný certifikát Caddy potřebuje přístup k certifikační autoritě.

## Instalační balíček

Z GitHub Releases stáhni `bod-<verze>-linux-<architektura>.tar.gz` a jeho
`.sha256`. Archiv obsahuje `bod.py`, Compose, Caddyfile, `images.env` a
`images.tar` s obrazy aplikace, PostgreSQL, Redis a Caddy.

Vývojový balíček připravíš ručním spuštěním workflow **CI** nad vybranou
větví v GitHub Actions. Stáhni artefakt `deployment-<commit>`; uchovává se
jeden den. Ruční spuštění workflow musí být dostupné na výchozí větvi
repozitáře. GitLab připravuje stejný balíček při ručním spuštění pipeline.

Ze školní sítě přenes archiv a checksum na VPS přes SCP nebo SFTP.
Přístup přes eduroam nezpřístupňuje server GitHub runnerům z internetu.

## První instalace

Ověř checksum a rozbal archiv do nového trvalého adresáře:

```sh
sha256sum -c bod-v0.1.0-linux-amd64.tar.gz.sha256
tar -xzf bod-v0.1.0-linux-amd64.tar.gz
chmod 700 deploy
cd deploy
python3 bod.py install --offline --domain bod.skola.cz
```

Za školní HTTPS proxy přidej `--proxy`. Instalátor načte přiložené obrazy,
vytvoří soukromý `config.env`, spustí služby a vypíše dočasné heslo správce.
Při prvním přihlášení heslo změň. Konfigurace se při opakované instalaci
nepřepisuje. Příkazy spouští správce s přístupem k Dockeru.

Instalační adresář obsahuje hesla. Uchovej ho na trvalém disku s přístupem
jen pro správce. Archiv instalace a jeho checksum si ponech pro obnovu.

## Aktualizace

Nový balíček rozbal do samostatného adresáře. Spusť nový nástroj nad
stávající instalací:

```sh
python3 /srv/bod-new/deploy/bod.py --root /srv/bod update /srv/bod-new/deploy/images.env --offline
```

Původní `images.env` před příkazem nepřepisuj. Aktualizace načte nové obrazy,
vytvoří zálohu databáze a médií a čeká na zdravé služby. Vyžaduje alespoň
3 GiB volného místa, další místo potřebují načítané obrazy a záloha.
Konkrétní změny Compose nebo Caddyfile přebírej podle pokynů vydání.

Po neúspěšné migraci se starý obraz automaticky nespouští nad změněnou
databází. Zálohy ani staré obrazy se automaticky nemažou.

## Správa

Příkazy spouštěj v instalačním adresáři:

| Příkaz | Výsledek |
| --- | --- |
| `python3 bod.py status` | Stav služeb |
| `python3 bod.py backup /mnt/skolni-nas/bod/zaloha` | Záloha do prázdného adresáře |
| `python3 bod.py restore /cesta/zaloha` | Obnova do nového Docker projektu |

Záloha obsahuje databázi, média, konfiguraci a odkazy na obrazy.
Aplikační služby se během zálohování krátce zastaví. Dokončenou zálohu
poznáš podle `.complete`. Ukládej ji na chráněné úložiště mimo server;
není šifrovaná. Retenci nastav ve školním zálohování nebo cronu.

Při obnově bez internetu nejdřív načti `images.tar` odpovídajícího vydání
příkazem `docker image load --input images.tar`. Obnova zachová původní
volumes; správce je odstraní až po ověření nového projektu. Hlavní verzi
PostgreSQL tento postup neaktualizuje.

## Vývojová VPS

První instance používá `https://10.202.30.201` ve školní síti.
Caddy pro privátní IP vytváří vlastní certifikační autoritu. Její veřejný
kořenový certifikát ověř a přidej do důvěryhodných na testovacích počítačích.
Samotné přeskočení varování prohlížeče nezajistí důvěryhodný HTTPS kontext.

Certifikát zkopíruj z Caddy kontejneru zvoleného podle `bod.py status`:

```sh
docker cp <caddy-kontejner>:/data/caddy/pki/authorities/local/root.crt ./development-root.crt
```

Přenášej pouze veřejný certifikát přes ověřené SSH spojení. Porovnej jeho
otisk a důvěru nastav ručně. Pro stálou adresu lze později použít
`dev.bodhq.cz`; DNS samo nezajistí veřejný přístup ani HTTPS.

## Vydávání

Obě CI používají [stejné příkazy](testing.md#github-a-gitlab).
Push tagu `vX.Y.Z` na GitHub sestaví a otestuje obrazy, připraví offline
archiv a založí draft vydání. Obrazy se publikují také do GHCR; stejná
publikace stabilních větví slouží k vývoji. Balíček před zveřejněním projde
také instalací a aktualizací z přiloženého `images.tar`. Ruční instalace veřejné
GHCR balíčky nevyžaduje. Draft před zveřejněním zkontroluje vydavatel.

CI na školní server nic nenasazuje. Výběrová instalace modulů zatím
není podporovaná; stav popisuje [architektura](architecture.md#moduly).
