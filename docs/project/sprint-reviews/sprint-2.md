# Sprint 2

**Plánovaný konec sprintu:** 13. 11. 2026 podle [milníku Sprint 2](https://gitlab.spseplzen.cz/studentske-projekty/projekty-2026-2027/mtp1/navrh-a-implementace-modularniho-skolniho-informacniho-systemu/-/milestones/2).
**Review a kontrola skutečného stavu:** 20. 11. 2026.

## Cíl a výsledek

Cílem bylo rozšířit základ ze sprintu 1 o školní agendy, učitele a rozvrhy,
doplnit vizuální identitu, dokumentaci a algoritmizaci rozvrhu. Issues nemají
podrobná akceptační kritéria; posouzení vychází z jejich názvů, implementace,
API kontraktu a provedených kontrol.

Před sepsáním review byly zkontrolovány všechny otevřené úkoly. K 20. 11.
je **5 ze 7 issues milníku dokončených a uzavřených**: #12, #16, #17, #18 a #19.
Zůstalé štítky „In progress“ byly z hotových úkolů odstraněny. #11 a #13
zůstávají otevřené. Mimo milník bylo uzavřeno také #14; do součtu sprintových
issues se nezapočítává. Tato kontrola nepotvrzuje, že všechny výstupy byly
hotové již k původnímu termínu 13. 11.; zahrnuje i následné integrační opravy.

Výsledkem je funkční vývojová aplikace pro ověřené školní postupy. Není
hotová automatická optimalizace rozvrhu ani celý životní cyklus školní evidence.
Rozsah a provozní mezery popisuje [produktový audit](../../product-review.md).

## Eliáš Jan Procházka — frontend a UX

**2 dokončené issues v milníku:**

- [#16 — implementace front-end modulů](https://gitlab.spseplzen.cz/studentske-projekty/projekty-2026-2027/mtp1/navrh-a-implementace-modularniho-skolniho-informacniho-systemu/-/work_items/16): evidence školy a žáků, skupiny, učebny,
  příprava a ruční editor rozvrhu, třídnice, docházka a omluvenky. Frontend
  používá generovaný API kontrakt a respektuje role. Integrace doplňuje obory
  studia, budovy, patra a umístění učeben z aktuálního backendu.
- [#17 — dodělání vizuální identity](https://gitlab.spseplzen.cz/studentske-projekty/projekty-2026-2027/mtp1/navrh-a-implementace-modularniho-skolniho-informacniho-systemu/-/work_items/17): společné tokeny, komponenty a vzhled,
  světlý/tmavý motiv, navigace, mobilní ovládání a opravy při zvětšení textu.
  Implementaci a integrační opravy obsahuje [PR #60](https://github.com/bodhq/bod/pull/60).

**Další dokončená práce mimo milník:** [#14 — refaktorizace a deployment](https://gitlab.spseplzen.cz/studentske-projekty/projekty-2026-2027/mtp1/navrh-a-implementace-modularniho-skolniho-informacniho-systemu/-/work_items/14) —
společné kontroly pro GitHub/GitLab, ruční nasazení hotových obrazů, aktualizace,
zálohy a obnova. Navazuje na [PR #52](https://github.com/bodhq/bod/pull/52)
a [PR #53](https://github.com/bodhq/bod/pull/53); sjednocení dokončuje PR #60.

Rozpracované zůstává dokončení frontendové části maturitního textu v #11.
Místní editor pravidel přesunů není automaticky propojen se sdíleným plánem
budov; jde o navazující práci, nikoli o dokončenou synchronizaci obou pohledů.

## Filip Nagy — backend a databáze

**3 dokončené issues v milníku:**

- [#12 — implementace er-modelu](https://gitlab.spseplzen.cz/studentske-projekty/projekty-2026-2027/mtp1/navrh-a-implementace-modularniho-skolniho-informacniho-systemu/-/work_items/12): doménový model školních roků,
  tříd, zařazení a skupin, učeben, rozvrhu a třídnice, explicitní API schémata,
  migrace a doménové kontroly. Aktuální rozšíření odděluje obory od zaměření
  a ukládá budovy, patra i souřadnice učeben.
- [#18 — implementace rozvrhů](https://gitlab.spseplzen.cz/studentske-projekty/projekty-2026-2027/mtp1/navrh-a-implementace-modularniho-skolniho-informacniho-systemu/-/work_items/18): plány a úvazky, cykly, varianty,
  umísťování hodin, kontroly kolizí, publikace a přehledy. Model přesunů je
  volitelný. Dokončení tohoto issue označuje rozvrhovou agendu; automatický
  optimalizátor zůstává samostatným otevřeným úkolem #13.
- [#19 — implementace učitelů](https://gitlab.spseplzen.cz/studentske-projekty/projekty-2026-2027/mtp1/navrh-a-implementace-modularniho-skolniho-informacniho-systemu/-/work_items/19): učitelské účty a role,
  přiřazení výuky, nedostupnost, vlastní hodiny a oprávnění pro zápis třídnice.

Podklady jsou v backendových commitech
[`0f7f5111`](https://github.com/bodhq/bod/commit/0f7f5111)
a [`9b73d1c6`](https://github.com/bodhq/bod/commit/9b73d1c6) na `develop`.
Rozpracovaná zůstává backendová část maturitního textu v #11 a algoritmizace #13.

## Ověření výsledku

- `pnpm check`: lint, typy, 250 frontendových testů, 383 API testů
  s pokrytím 91,25 %, 9 prohlížečových scénářů a produkční build. Běžná API sada
  přeskočila 22 externích integrací; samostatné `scripts/ci integration`
  všech 22 ověřilo proti PostgreSQL a Redis.
- `scripts/ci production`: sestavení obrazů a úspěšná zkouška HTTPS,
  statických souborů, secure přihlášení, SSR, aktualizace, zálohy a obnovy.
  Šlo o dočasnou instalaci, nikoli nasazení na školní server.
- Mobilní audit produkčního buildu: učitel, rodič, správce školy a admin,
  portrét i krajina, šířky 320/390 px, 200% text a axe. Ověřeno skutečné uložení
  docházky, reload, zachování změn při chybě a následné obnovení fixture.
- V izolované škole ověřeno uložení oboru, navázaného zaměření, budovy,
  patra a umístění učebny i jejich čtení po reloadu. Kontrolní záznamy byly
  odstraněny a původní umístění obnoveno.
- `pnpm audit` po aktualizaci Next.js na 16.4.5: žádné známé zranitelnosti.
  OpenAPI snapshot byl obnoven v projektovém Pythonu 3.12; odlišný text
  popisu HTTP 422 z jiné verze Pythonu již nezpůsobuje drift proti CI.

Lokální důkazy jsou v ignorovaném `.local-notes/sprint-2`; přihlašovací údaje
nejsou součástí verzované dokumentace. Kontroly nejsou kapacitní zkouškou celé
školy ani potvrzením úplnosti evidence či právního souladu.

## Tým a další sprint

Společným výsledkem je napojení frontendu na backend a ověření celých postupů.
V týmovém součtu je každý dokončený sprintový úkol započten jednou: 2 frontendové
+ 3 backendové = 5. Počet issues sám o sobě nevyjadřuje velikost práce obou autorů.

Při integraci bylo nutné zachovat původní necommitnuté UI změny, dopojit nový
kontrakt a opravit mobilní přetékání. Nedostatek místa na vývojovém počítači
vyřešilo odstranění obnovitelných cache. Vzdálené CI odhalilo krátký časový limit
regrese se 101 řádky; tento konkrétní test má delší limit při zachované kontrole
maximálně 100 vybraných absencí.

| Navazující práce | Stav a vlastník | Závislosti |
| --- | --- | --- |
| [#11 — dokumentace](https://gitlab.spseplzen.cz/studentske-projekty/projekty-2026-2027/mtp1/navrh-a-implementace-modularniho-skolniho-informacniho-systemu/-/work_items/11) | Otevřeno; navržení vlastníci Eliáš a Filip, každý svou autorskou část | Technické kapitoly LaTeXu dosud obsahují zástupné texty; funkční PDF build nestačí k uzavření. |
| [#13 — algoritmizace a optimalizace rozvrhů](https://gitlab.spseplzen.cz/studentske-projekty/projekty-2026-2027/mtp1/navrh-a-implementace-modularniho-skolniho-informacniho-systemu/-/work_items/13) | Otevřeno; navržený vlastník Filip, Eliáš naváže rozhraní | Existuje ruční editor a validace, chybí automatické sestavení a optimalizace rozvrhu. |
| Sjednocení sdílených prostorů a editoru přesunů | Navržený vlastník Eliáš; kontrakt společně s Filipem | Oddělit fyzické umístění a pravidla přesunů, zachovat publikovanou historii. |
| Provozní dokončení třídnice a větší datová zkouška | Navržení vlastníci oba | Uzávěrky, archivní výstupy a ověření souběhu i objemu podle produktového auditu. |

U dosud nepřiřazených #11 a #13 jde o návrh odpovědnosti pro další plánování,
ne o změnu řešitele na GitLabu. Nové termíny nebyly stanoveny.

**Týmové potvrzení:** záznam je připraven k potvrzení Eliášem Janem Procházkou
a Filipem Nagyem. Jejich osobní hodnocení spolupráce ani schválení se tímto
technickým review nenahrazuje.
