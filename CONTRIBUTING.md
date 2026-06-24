# Contributing do systému bod

Vítáme tě! Tento repozitář používá **Trunk-Based Development** a klade extrémní důraz na automatizovanou typovou bezpečnost. Abychom udrželi hlavní větev (`main`) vždy 100% nasaditelnou, prosíme o dodržování našich Zero-Mistake pravidel.

## 📚 Nastuduj si Knowledge Base
Před prvním zásahem do kódu doporučujeme přečíst oficiální dokumentaci ve složce `docs/`. Zásadní jsou zejména dokumenty [Workflow](docs/workflow.md) a pravidla [API Kontraktu](docs/api.md).

## 🔄 Pracovní postup (Workflow)

1. **Vycházej z `main`:** Vždy začínej z nejaktuálnější verze hlavní větve.
2. **Krátce žijící větve:** Vytvoř si vlastní pracovní větev (doporučené prefixy jsou `feat/...`, `fix/...`, `docs/...`).
3. **Single Source of Truth (Změny v API):** Pokud upravuješ backendové modely nebo routy ve FastAPI, **musíš** následně vygenerovat nového TypeScript klienta:
   ```bash
   pnpm gen:api
   ```
   *(Pokud upravený `openapi.json` necommitneš, tvůj PR selže na CI zkoušce `Verify OpenAPI Sync`.)*
4. **Lokální Quality Assurance (QA):** Než vytvoříš Pull Request, absolutní nutností je spustit kontrolu:
   ```bash
   pnpm check
   ```
   *(Tento mocný příkaz automaticky ověří linting (Biome, Ruff), projde všechny TypeScript a Python typy a zkusí zbuildovat projekt. Zelený výstup je podmínkou pro PR.)*

## 📝 Conventional Commits & Pull Requesty

Při otevírání Pull Requestu (PR) do `main` striktně vyžadujeme jmennou konvenci **Conventional Commits** v samotném názvu PR. Kód hlídá robot (`amannn/action-semantic-pull-request`), který PR zablokuje, pokud konvenci nedodržíš.

Příklady správných názvů PR:
- `feat: přidání komponenty pro rozvrh` (Nová funkcionalita)
- `fix: oprava pádů při prázdné databázi` (Oprava chyby)
- `docs: aktualizace readme` (Úprava dokumentace)
- `refactor: přesun Caddyfile do rootu` (Přepis kódu bez změny funkčnosti)

## 🏛️ Základní Architektonická Pravidla

- **Frontend (`apps/web`):** Žádný "surový" `fetch`. Data fetchujeme **výhradně** skrze funkce z autogenerovaného balíčku `@bod/api-client`.
- **Backend (`apps/api`):** Logika se nedrobí do technických vrstev (controllers/services), ale do vertikálních doménových modulů (např. `server/modules/timetable`).
- **Autogenerovaný kód:** Do `packages/api-client/src` **nikdy** nezasahuj ručně. Tento kód je plně v moci transpilátoru.
- **Infrastruktura (`infra/`):** Změny v proxy a orchestraci prováděj vždy přes `docker-compose` soubory a `Caddyfile`. Nikdy neodhaluj porty (3000, 8000, 5432) ven na hostitelskou mašinu.
- **Tajemství (`.env`):** Nikdy necommituj produkční hesla! Pro vývoj vždy používej vzorové proměnné z `.env.example`.
