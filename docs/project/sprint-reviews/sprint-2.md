# Sprint 2

**Sprint ukončen:** 13. 11. 2026

## Cíl a výsledek sprintu

- **Plánovaný cíl:** Implementovat školní agendy, učitele a rozvrhy, dokončit vizuální identitu
  a doplnit dokumentaci projektu.
- **Výsledek:** Všech šest issues v milníku sprintu je uzavřeno. Dokončena je také
  refaktorizace a příprava nasazení v #14, které není přiřazené k milníku.

## Eliáš Jan Procházka — frontend a UX

### Kolik a co udělal

**3 uzavřená issues:**

- **#14 — Refaktorizace a deployment.** Sjednocení struktury projektu a kontrol,
  příprava nasazení, aktualizací, záloh a obnovy.
- **#16 — Implementace front-end modulů.** Evidence školy, učebny, rozvrh, třídnice,
  docházka a omluvenky propojené s backendem.
- **#17 — Dodělání vizuální identity.** Společný vzhled a komponenty, světlý a tmavý
  motiv a přizpůsobení rozhraní mobilním zařízením.

## Filip Nagy — backend a databáze

### Kolik a co udělal

**3 uzavřená issues:**

- **#12 — Implementace ER-modelu.** Datový model školních agend, migrace a API.
- **#18 — Implementace rozvrhů.** Plány výuky, úvazky, varianty rozvrhu,
  kontroly kolizí a publikace.
- **#19 — Implementace učitelů.** Učitelské role, přiřazení výuky, nedostupnost
  a přístup k vlastním hodinám a třídnici.

## Týmové review

### Práce v týmu a úsilí

- Frontend a backend byly propojeny a společné školní postupy ověřeny v běžící aplikaci.
- **#11 — Dokumentace.** Společný výstup je dokončený a issue je uzavřené.

### Dlouhodobý výhled

Dlouhodobě se zaměřit na tři oblasti:

- Rozšiřovat a vyladit práci s rozvrhem: zjednodušit tvorbu a úpravy, zpřehlednit
  kontrolu kolizí a usnadnit ověření rozvrhu před jeho zveřejněním.
- Průběžně refaktorovat části aplikace tak, aby se snížila duplicita a změny šly
  bezpečněji testovat a rozvíjet bez nechtěných regresí.
- Zpevnit proces nasazování: mít opakovatelný postup, automatické kontroly před
  nasazením a ověření základního provozu po něm.

### Společné poznámky a rizika

- Celkem je uzavřeno 7 uvedených issues: 3 přiřazená Eliášovi, 3 Filipovi a 1 společné.
  Z toho 6 patří do milníku sprintu; #14 je mimo milník.
- Aplikace prošla kontrolami a testy včetně mobilního ovládání, nasazení, zálohy a obnovy.
