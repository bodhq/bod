<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./apps/web/public/logo-white.svg">
    <source media="(prefers-color-scheme: light)" srcset="./apps/web/public/logo-black.svg">
    <img alt="bod logo" src="./apps/web/public/logo-white.svg" width="200">
  </picture>
  <p><strong>Modulární informační systém pro moderní výukové instituce</strong></p>
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](#)
  [![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white)](#)
  [![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](#)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white)](#)
  [![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=flat-square&logo=turborepo&logoColor=white)](#)
  [![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](#)
</div>

---

> [!NOTE]
> **bod** vzniká jako návrh moderního a modulárního školního informačního systému. Jedná se o dlouhodobý středoškolský maturitní projekt, jehož cílem je vytvořit plnohodnotnou alternativu k existujícím zastaralým řešením pro správu školních agend.

## Obsah

- [Řešitelé a vedení práce](#řešitelé-a-vedení-práce)
- [Filozofie a architektura](#filozofie-a-architektura)
- [Rozdělení odpovědností a technologie](#rozdělení-odpovědností-a-technologie)
- [Klíčová dokumentace](#klíčová-dokumentace)
- [Infrastruktura a nasazení](#infrastruktura-a-nasazení)
- [Příručka pro spuštění](#příručka-pro-spuštění)
- [Životní cyklus a deployment](#životní-cyklus-a-deployment)

---

## Řešitelé a vedení práce

**Řešitelé projektu:**

- **Eliáš Jan Procházka** (@prochazkaelias23)
- **Filip Nagy** (@nagyfilip23)

**Vedení projektu:**

- **Vedoucí práce:** @haut
- **Oponent práce:** @svitek1

---

## Filozofie a architektura

Základní filozofií projektu je striktní oddělení jádra systému od jednotlivých aplikačních modulů:

- **Jádro (Core):** Poskytuje jednotný datový model, zabezpečení (autentizaci) a sdílenou infrastrukturu.
- **Moduly (Feature Slices):** Rozšiřují funkcionalitu systému zcela nezávisle na sobě (např. rozvrh, klasifikace, zprávy), čímž minimalizují riziko narušení existujících částí aplikace při přidávání nových funkcí.

Cílem není pouze implementace funkční aplikace, ale především návrh vysoce škálovatelného systému, který reflektuje moderní přístupy k softwarové architektuře (_Domain-Driven Design_, _Vertical Slicing_, _End-to-End Type Safety_).

---

## Rozdělení odpovědností a technologie

Projekt je postaven jako asymetrická fullstack aplikace (oddělený klient a server) strukturovaná v prostředí monorepa pomocí nástroje Turborepo.

| Vrstva                        | Vývojář             | Technologie                                       |
| ----------------------------- | ------------------- | ------------------------------------------------- |
| **Backend a Databáze**        | Filip Nagy          | FastAPI, Python 3.12, PostgreSQL, Redis, SQLModel |
| **Frontend a UI/UX**          | Eliáš Jan Procházka | Next.js 16, React 19, Tailwind CSS v4             |
| **Infrastruktura a Nasazení** | Eliáš Jan Procházka | Docker, Ubuntu Server                             |

> [!TIP]
> Systémová analýza, logická architektura a návrh datových struktur vznikají společným úsilím celého týmu.

---

## Klíčová dokumentace

Díky přísným konvencím a silné architektuře je dokumentace udržována v minimalistické, ale vysoce deskriptivní podobě. Vše je koncentrováno na třech hlavních místech:

- [**Architektura a API kontrakt** (docs/architecture.md)](docs/architecture.md) – Hlavní technická specifikace vrstvené architektury a autogenerování API.
- [**Testovací metodika** (docs/testing.md)](docs/testing.md) – Metodika pro unit a E2E testování (Pytest, Vitest, Playwright).
- [**Pravidla a workflow** (CONTRIBUTING.md)](CONTRIBUTING.md) – Procesy a standardy pro správu verzí a návrhy změn (Pull Requests).

---

## Infrastruktura a nasazení

Pro zajištění plynulého chodu aplikace v produkčním prostředí (školní provoz) byla navržena kontejnerová architektura. Systém je dimenzován tak, aby zvládl ranní výkonnostní špičky a náročné buildovací procesy (Server-Side Rendering kompilace).

**Doporučená hardwarová specifikace (Produkce):**

- **CPU:** 4 vCPU (Nezbytné pro paralelní zpracování Node.js a databázových operací)
- **RAM:** 8 GB (Klíčové pro prevenci _Out of Memory_ chyb při buildu Next.js a běhu PostgreSQL)
- **Úložiště:** 60 - 80 GB SSD/NVMe (Prostor pro OS, zdrojové kódy, Docker images, aplikační data a zálohy)
- **OS:** Ubuntu 24.04 LTS (Nebo 22.04 LTS)

Hlavní dokumentace projektu:

- 🏗️ [**Architektura a API Kontrakt** (docs/architecture.md)](docs/architecture.md) – Hlavní technická specifikace vrstvené architektury a autogenerování API.
- 🧪 [**Testování (Testing Guidelines)** (docs/testing.md)](docs/testing.md) – Metodika pro unit a E2E testování (Pytest, Vitest, Playwright).
- 📊 [**Sprint reviews** (docs/sprint-reviews/README.md)](docs/sprint-reviews/README.md) – Průběžný přehled práce, týmového úsilí a navazujících úkolů pro Eliáše a Filipa.
- [**Účty, role a oprávnění**](docs/access.md) – Pravidla přístupu, API, migrace a vytvoření prvního správce.
- [**Vysvětlení implementace s kódem**](docs/access-implementation.md) a [**návrh generování účtů žáků a rodičů**](docs/account-generation.md).
- 🤝 [**Pravidla a Workflow** (CONTRIBUTING.md)](CONTRIBUTING.md) – GitHub procesy a standardy pro psaní PR.

---

## Příručka pro spuštění

Aplikace vyžaduje lokálně nainstalované prostředí `Node.js` (>=20), `pnpm`, `Python` (>=3.12), správce balíčků `uv` a `Docker` (pro lokální databázi).

> [!IMPORTANT]
> Pro bezproblémový běh backendu je využíván nástroj `uv` pro izolovanou správu Python prostředí.

```bash
# 1. Instalace Node závislostí a inicializace Python prostředí
pnpm install
uv sync --all-packages --all-groups --frozen

# 2. Příprava konfigurace
cp .env.example .env

# 3. Spuštění infrastruktury (PostgreSQL + Redis v Dockeru)
pnpm db:dev

# Pro lokální HTTP nastavte v .env COOKIE_SECURE=false.
# První správce (vypíše náhodné dočasné heslo):
# cd apps/api && uv run python -m server.scripts.bootstrap_admin

# 4. Spuštění aplikačních serverů (Frontend: 3000, Backend: 8000)
pnpm dev
```

_Databázové tabulky se během lokálního vývoje inicializují automaticky při startu backendového serveru (Auto-Init)._

---

## Životní cyklus a deployment

### API testy bez Dockeru

```sh
uv run pytest
```

Běžné API testy používají dočasnou SQLite databázi. Pět integračních testů
PostgreSQL migrací je volitelných; podrobnosti jsou v [testovací příručce](docs/testing.md).

### Lokální Validace (Quality Assurance)

Před každým vytvořením Pull Requestu se provádí komplexní lokální kontrola celého monorepa, která simuluje CI server:

```bash
pnpm check
```

Tento příkaz paralelně ověřuje formátování (Biome, Ruff), statické typy (TSC, Mypy) a spouští všechny připravené testy.

### Nasazení (Deployment Lifecycle)

Produkční nasazení respektuje kontejnerovou architekturu a bezestavový (stateless) přístup:

1. **CI/CD Pipeline:** Při sloučení kódu do hlavní větve `main` se spouští GitHub Actions pro konečnou verifikaci.
2. **Kontejnerizace:** Backend i Frontend jsou odděleně zabaleny do vysoce optimalizovaných Docker obrazů (images).
3. **Infrastruktura:** PostgreSQL ukládá trvalá data a přihlašovací relace, Redis omezuje pokusy o přihlášení. Samotné běhové servery aplikací jsou plně horizontálně škálovatelné.
