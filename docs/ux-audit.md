# UX audit pro starší uživatele

Audit 16. 11. 2026 se zaměřuje na rychlé čtení, jistotu při ukládání,
ovládání myší i klávesnicí a orientaci mezi agendami. Kontrolované oblasti:
přihlášení, přehled, třídnice, škola, učebny, rozvrh, osobní údaje, vzhled
a zabezpečení. Použita izolovaná škola s fiktivními účty a třídou o 30 žácích.

## Nálezy a opravy

| Priorita | Nález | Výsledná změna |
| --- | --- | --- |
| Vysoká | Volby docházky měly 11px text a 30px výšku. | Společná rádia s nejméně 44px výškou; jména žáků mají velikost hlavního textu. |
| Vysoká | Pevné malé popisky v agendách a navigaci obcházely nastavení čitelnosti. | Společné tokeny pro text, popisky a hustotu; stejné utility v celém UI. |
| Vysoká | Stav uložení třídnice na telefonu mizel. | Trvale viditelný `SaveStatus`, včetně neuložených změn, průběhu, chyby a potvrzení uložení. |
| Vysoká | Bez přístupu k číselníku formulář žádal technické ID. | Výběr názvů z dostupného rozvrhu, jinak vysvětlení chybějících dat. Povinný prázdný výběr nelze odeslat. |
| Střední | Dialogy neměly viditelné zavření. | Společné Zavřít, Escape a zadržení fokusu; při probíhajícím uložení se dialog nezavírá. |
| Střední | Profil neměl ochranu rozepsaných změn ani trvalé potvrzení. | Stejná ochrana odchodu odkazy a zavření stránky jako u agend, sdílený stav a akce formuláře. |
| Střední | Zvýraznění pozdního příchodu těsně nesplňovalo kontrast (4,49 : 1). | Tmavší společná varovná barva, ověřená na skutečné docházce. |
| Střední | Při 200% textu se mohla tlačítka ukládání překrývat. | Zalamování společných tlačítek a přeskupení akcí i docházky podle dostupného místa. |
| Střední | Pětisekundová oznámení mohou zmizet před přečtením. | Běžná oznámení 10 sekund, chyby do ručního zavření; formulář drží podstatný stav na místě. |
| Střední | Modulové výjimky zmenšovaly společné ovládání. | Odstraněné 28–30px výjimky a kopie stylů rádií; vstup minut používá společný Input. |
| Střední | Neomezený souběh testů způsoboval nahodilé timeouty. | Dva workery Vitestu a jeden Playwrightu pro místní běh i CI. |
| Střední | Cache kontrol neodrážela změnu kontraktu a ukládala i cache Next.js. | Explicitní závislost na OpenAPI a generátoru; vyloučení `.next/cache` z výstupů Turba. |

Pravidla a odpovědnosti společných komponent popisuje
[design systém](design-system.md#čitelnost-a-společné-chování).

## Ověření a meze

Výchozí automatický audit devíti hlavních obrazovek nehlásil nálezy pravidel
WCAG 2 A/AA, 2.1 AA a 2.2 AA dostupných v axe. Ruční kontrola přesto odhalila
výše uvedené překážky. Samotný nulový počet hlášení neprokazuje použitelnost.

Po opravách prošlo osm přihlášených agend a samostatně učitelská třídnice
ve světlém a tmavém motivu bez nálezů sledovaných pravidel axe. Kontrola
320, 390 a 1440 px při 100% i 200% textu nehlásila přetečení rámce stránky
ani oříznutí textů tlačítek. Fokus poznámky posledního žáka nezakrývá lišta
ukládání. Dialog chrání rozepsaný profil a udrží fokus při tabulátoru.

| Naměřeno v běžném nastavení | Před úpravou | Po úpravě |
| --- | --- | --- |
| Hlavní text | 15 px | 16 px |
| Jméno žáka | 14 px | 16 px |
| Text voleb docházky | 11 px | 14 px |
| Výška voleb docházky | 30 px | 44 px |
| Výška akce uložit | 40 px | 44 px |
| Stav uložení | 12 px, na mobilu skrytý | 14 px, viditelný i na mobilu |

Prošla celá sada `pnpm check`: 222 webových testů, 347 API testů,
9 prohlížečových testů, 20 testů nástrojů nasazení, lint, typy a produkční
build. V běžné API sadě se 21 testů externích PostgreSQL/Redis integrací
přeskakuje. Prošel také produkční Docker build a samostatný HTTPS smoke test
přihlášení, SSR, aktualizace, zálohy a obnovy. Audit npm nehlásil známé zranitelnosti.

Reprodukovatelný audit naplněné školy a běžné regresní kontroly popisuje
[testování](testing.md). Screenshoty a výsledky lokální testovací školy jsou
v ignorovaném `.local-notes/ux-audit`; přístupové údaje nejsou verzované.

Toto je technický audit. Neběhlo pozorování skutečných starších učitelů ani
samostatný test se čtečkou obrazovky. Před plošným nasazením je vhodné nechat
učitele bez návodu otevřít dnešní hodinu, označit absenci, zapsat látku,
uložit ji a znovu najít uložený zápis. Pozorovat omyly a nejistotu při ukládání.

Oprávnění API nadále určují dostupnost číselníků. Učitel může vybrat názvy
z dostupného rozvrhu; úplný školní číselník bez příslušných oprávnění frontend
nezískává. Rozvrhová mřížka a mapa školy zůstávají prostorové pohledy a mají
vlastní posun či zvětšení; audit reflow se týká rámce stránky a formulářů.

## Podklady

- [WCAG: změna velikosti textu](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) stanoví zachování obsahu a funkčnosti při zvětšení textu na 200 %.
- [WCAG: minimální velikost cíle](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) uvádí 24 × 24 CSS px s výjimkami. Produktové minimum 44 px pro hlavní ovládání je vlastní přísnější volba.
- [WCAG: nezakrytý fokus](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) vysvětluje riziko překrytí prvků pevnými lištami.
- [WCAG: stavové zprávy](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) popisuje oznámení výsledku bez přesouvání fokusu.
