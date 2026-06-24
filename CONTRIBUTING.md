# Pravidla pro vývoj a přispívání (Contributing)

Tento dokument definuje závazná pravidla pro vývoj systému `bod`. Projekt využívá metodiku **Trunk-Based Development** s důrazem na typovou bezpečnost a automatizovanou kontrolu kvality kódu. Cílem je udržet hlavní větev (`main`) v permanentně nasaditelném stavu.

## 1. Technická dokumentace (Knowledge Base)
Před zahájením prací je vyžadováno seznámení s architekturou v adresáři `docs/`. Klíčové dokumenty zahrnují definici [Workflow](docs/workflow.md) a pravidla generování [API Kontraktu](docs/api.md).

## 2. Standardní pracovní postup (Workflow)

1. **Větvení:** Nové větve musí vždy vycházet z aktuálního stavu větve `main`.
2. **Názvosloví větví:** Je vyžadováno používat jasné prefixy reflektující účel úpravy (např. `feat/název`, `fix/název`, `docs/název`).
3. **Single Source of Truth:** 
   Při jakékoliv úpravě backendových modelů nebo rout (FastAPI) je **povinné** přegenerovat TypeScript klienta:
   ```bash
   pnpm gen:api
   ```
   *(Při nesplnění tohoto kroku dojde k selhání automatizované kontroly `Verify OpenAPI Sync` v rámci CI/CD pipeliny.)*
4. **Lokální ověření (Quality Assurance):** Před založením Pull Requestu je nutné spustit kompletní sadu testů:
   ```bash
   pnpm check
   ```
   *(Tento příkaz paralelně ověřuje linting, statickou typovou analýzu a provádí zkušební build.)*

## 3. Pull Requesty a konvence commitů

Integrace kódu do větve `main` probíhá výhradně prostřednictvím Pull Requestů. Je striktně vyžadováno dodržování standardu **Conventional Commits** v názvech Pull Requestů i jednotlivých commitů. Dodržování tohoto pravidla je vynucováno automatizovanou kontrolou na GitHubu.

Příklady platných názvů:
- `feat: přidání komponenty pro rozvrh` (Nová funkcionalita)
- `fix: oprava pádu při chybějících datech` (Oprava chyby)
- `docs: aktualizace instalačního návodu` (Úprava dokumentace)
- `refactor: optimalizace databázového dotazu` (Úprava kódu bez změny chování)

## 4. Architektonická omezení a pravidla

- **Frontend (`apps/web`):** Je zakázáno používat nativní funkci `fetch` pro volání API. Datová integrace probíhá výhradně přes autogenerovaný balíček `@bod/api-client`.
- **Backend (`apps/api`):** Architektura nevyužívá horizontální vrstvení (např. oddělené složky pro controllers/services). Logika je vertikálně dělena do doménových modulů (např. `server/modules/timetable`).
- **Autogenerovaný kód:** Je zakázáno provádět manuální úpravy v adresáři `packages/api-client/src`. Kód je plně spravován transpilátorem.
- **Infrastruktura (`infra/`):** Změny v síťové konfiguraci a proxy probíhají výhradně úpravou Docker a Caddy konfigurací. Porty služeb se nepublikují na hostitelský systém.
- **Konfigurace prostředí (`.env`):** Soubor `.env` slouží výhradně pro lokální vývoj a nesmí obsahovat produkční tajemství. Struktura proměnných je verzována v souboru `.env.example`.
