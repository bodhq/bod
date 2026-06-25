# Pravidla vývoje a GitHub Workflow

Tento dokument definuje závazná pravidla pro proces vývoje, začleňování kódu a kontrolu kvality v repozitáři projektu `bod`. Systém využívá metodologii **Trunk-Based Development** pro minimalizaci integračních konfliktů.

## 1. Názvové konvence pro větve (Branching)

V repozitáři je aktivní automatizovaná kontrola prostřednictvím GitHub Actions. Systém neumožní integraci větví, jejichž názvy neodpovídají specifikovanému formátu. 

| Prefix | Účel větve | Příklad |
| --- | --- | --- |
| `feat/` | Implementace nové funkcionality. | `feat/login-page` |
| `fix/` | Oprava identifikované chyby (bugfix). | `fix/db-connection` |
| `docs/` | Úpravy či rozšíření dokumentace. | `docs/readme-update` |
| `chore/` | Údržba systému, aktualizace konfigurací a závislostí. | `chore/update-react` |
| `refactor/`| Restrukturalizace kódu bez změny chování systému. | `refactor/api-routes` |
| `test/` | Implementace nebo úprava testovacích sad. | `test/login-form` |
| `infra/` | Změny konfigurace infrastruktury (Docker, Caddy, CI).| `infra/caddy-port` |

## 2. Pull Requesty a Scopes (Conventional Commits)

Názvy Pull Requestů musí povinně dodržovat standard **Conventional Commits**, včetně definovaného pole Scope (oblasti změny). 

| Povolené Scopes | Příslušná doména |
| --- | --- |
| `(web)` | Úpravy klientské vrstvy (Next.js, UI komponenty). |
| `(api)` | Úpravy serverové vrstvy (FastAPI, modely, endpoints). |
| `(e2e)` | Úpravy automatizovaných End-to-End testů (Playwright). |
| `(deps)` | Aktualizace systémových a knihovních závislostí. |
| `(chore)` | Obecná údržba repozitáře bez vlivu na logiku. |
| `(docs)` | Změny v textové dokumentaci projektu. |
| `(infra)` | Konfigurace infrastruktury a CI/CD procesů. |

*Závazné příklady:*
- `feat(web): implementace přihlašovacího formuláře`
- `fix(api): oprava validační logiky pro JWT`

Během vytváření Pull Requestu je vyžadováno vyplnění přednastavené šablony a verifikace splnění všech kontrolních bodů (Checklist).

## 3. Schvalovací proces (CODEOWNERS)

Přímý zápis (push) do větve `main` je z bezpečnostních důvodů uzamčen. Začlenění kódu je možné výhradně prostřednictvím schváleného Pull Requestu.

Konfigurace `.github/CODEOWNERS` vyžaduje provedení revize kódu (Code Review). Každý Pull Request musí získat status *Approve* od oprávněných správců repozitáře (Elias `@ejaprrr` nebo Filip `@zorkonator`). Bez tohoto schválení systém znemožní fúzi kódu.

## 4. Kontinuální integrace (GitHub Actions CI)

Každý otevřený Pull Request spouští izolovanou kontrolní pipelinu (Continuous Integration), složenou z následujících automatizovaných kroků:
1. Ověření aktuálnosti sdíleného `openapi.json` (OpenAPI Sync).
2. Transpilace TypeScript klienta na základě API schématu (Gen API).
3. Kontrola formátování a pravidel lintingu (`Biome` a `Ruff`).
4. Statická analýza typů (`tsc` a `mypy`).
5. Exekuce automatizovaných testů (`Vitest`, `Pytest`, `Playwright`).
6. Verifikační kompilace projektu (Next.js Build).

Selhání kteréhokoliv z těchto kroků má za následek zablokování Pull Requestu. Lokální simulace tohoto procesu se provádí příkazem `pnpm check`.

## 5. Automatizace závislostí (Dependabot)
V repozitáři je integrována služba Dependabot, která kontinuálně monitoruje dostupné verze využívaných softwarových balíčků (NPM, Python, GitHub Actions). V případě detekce novější verze nebo bezpečnostní záplaty služba automaticky generuje odpovídající Pull Request.
