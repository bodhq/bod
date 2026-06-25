# 🤝 Pravidla vývoje a GitHub Workflow

Tento dokument definuje závazná pravidla pro proces vývoje, začleňování kódu a kontrolu kvality v repozitáři projektu `bod`. Systém využívá metodologii **Trunk-Based Development** pro minimalizaci integračních konfliktů.

> [!IMPORTANT]
> Přímý zápis (push) do větve `main` je z bezpečnostních důvodů striktně uzamčen. Začlenění veškerého kódu je možné výhradně prostřednictvím schváleného Pull Requestu (PR).

## 📖 Obsah
- [Názvové konvence pro větve](#1-názvové-konvence-pro-větve-branching)
- [Pull Requesty a Scopes](#2-pull-requesty-a-scopes-conventional-commits)
- [Schvalovací proces (CODEOWNERS)](#3-schvalovací-proces-codeowners)
- [Kontinuální integrace (CI)](#4-kontinuální-integrace-github-actions-ci)
- [Automatizace závislostí](#5-automatizace-závislostí-dependabot)

---

## 1. Názvové konvence pro větve (Branching)

V repozitáři je aktivní automatizovaná kontrola prostřednictvím GitHub Actions. Systém neumožní integraci větví, jejichž názvy neodpovídají formátu:

| Prefix | Účel větve | Příklad |
| ------ | ----------- | ------- |
| `feat/` | Implementace nové funkcionality. | `feat/login-page` |
| `fix/` | Oprava identifikované chyby (bugfix). | `fix/db-connection` |
| `docs/` | Úpravy či rozšíření dokumentace. | `docs/readme-update` |
| `chore/` | Údržba systému a aktualizace konfigurací. | `chore/update-react` |
| `refactor/`| Restrukturalizace kódu beze změny logiky. | `refactor/api-routes` |
| `test/` | Implementace nebo úprava testů. | `test/login-form` |
| `infra/` | Změny infrastruktury (Docker, CI).| `infra/caddy-port` |

---

## 2. Pull Requesty a Scopes (Conventional Commits)

Názvy Pull Requestů a případných merge commitů musí povinně dodržovat standard **Conventional Commits**, včetně definovaného pole Scope (oblasti změny).

| Povolené Scopes | Příslušná doména |
| --------------- | ---------------- |
| `(web)` | Klientská vrstva (Next.js, React). |
| `(api)` | Serverová vrstva (FastAPI, SQLModel). |
| `(e2e)` | Automatizované End-to-End testy (Playwright). |
| `(deps)` | Aktualizace systémových závislostí (NPM, Python). |
| `(chore)` | Obecná údržba repozitáře (skripty). |
| `(docs)` | Změny v textové dokumentaci projektu. |
| `(infra)` | Konfigurace infrastruktury a CI/CD. |

> [!TIP]
> **Správný formát:** `feat(api): implementace endpointu pro uživatele`  
> **Špatný formát:** `opravil jsem chybu v loginu`

---

## 3. Schvalovací proces (CODEOWNERS)

Proces revize kódu je vyžadován a automatizován prostřednictvím souboru `.github/CODEOWNERS`.

Každý Pull Request musí získat minimálně jeden status *Approve* od oprávněných správců repozitáře (Elias `@ejaprrr` nebo Filip `@zorkonator`). Bez tohoto schválení systém znemožní Merge do hlavní větve.

---

## 4. Kontinuální integrace (GitHub Actions CI)

Každý otevřený Pull Request spouští izolovanou kontrolní pipelinu složenou z automatizovaných kroků. Pokud jeden z kroků selže, PR nelze spojit.

1. **OpenAPI Sync:** Ověření konzistence sdíleného `openapi.json`.
2. **Gen API:** Transpilace TypeScript klienta z API schématu.
3. **Linting a Formátování:** Kontrola pravidel pomocí `Biome` (TS) a `Ruff` (Python).
4. **Typová kontrola:** Statická analýza přes `tsc` a `mypy`.
5. **Testy:** Exekuce automatizovaných testovacích sad (`Vitest`, `Pytest`, `Playwright`).
6. **Build:** Verifikační produkční kompilace projektu (Next.js).

> [!NOTE]
> Lokální simulace celého CI procesu je proveditelná příkazem `pnpm check`. Důrazně se doporučuje tuto verifikaci vykonat před každým začleněním kódu (commit).

---

## 5. Automatizace závislostí (Dependabot)

V repozitáři je integrována služba GitHub Dependabot, která kontinuálně monitoruje dostupné verze využívaných knihoven (NPM, Python) a Docker obrazů. V případě detekce stabilní novější verze nebo bezpečnostní záplaty systém automaticky vytvoří izolovaný Pull Request s úpravou verzí.
