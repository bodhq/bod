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
</div>

---

> [!NOTE]
> **bod** vzniká jako návrh moderního a modulárního školního informačního systému, který má sloužit jako plnohodnotná alternativa k existujícím řešením pro správu školních agend. Projekt je výsledkem společné maturitní práce dvou studentů.

## 📖 Obsah
- [Filozofie a Architektura](#-filozofie-a-architektura)
- [Rozdělení odpovědností](#-rozdělení-odpovědností-a-technologie)
- [Klíčová dokumentace](#-klíčová-dokumentace)
- [Začínáme (Getting Started)](#-začínáme-getting-started)
- [Životní cyklus a Deployment](#-životní-cyklus-a-deployment)

---

## 🏛 Filozofie a Architektura

Základní filozofií projektu je **striktní oddělení jádra systému od jednotlivých aplikačních modulů**:

- **Jádro (Core):** Poskytuje jednotný datový model, zabezpečení (autentizaci) a sdílenou infrastrukturu.
- **Moduly (Feature Slices):** Rozšiřují funkcionalitu systému zcela nezávisle na sobě (např. rozvrh, klasifikace, zprávy), čímž minimalizují riziko narušení existujících částí aplikace při přidávání nových funkcí.

Cílem není pouze implementace funkční aplikace, ale především návrh vysoce škálovatelného systému, který reflektuje moderní přístupy k softwarové architektuře (*Domain-Driven Design*, *Vertical Slicing*, *End-to-End Type Safety*).

---

## 🛠 Rozdělení odpovědností a Technologie

Projekt je postaven jako asymetrická fullstack aplikace (oddělený klient a server) strukturovaná v prostředí monorepa pomocí nástroje Turborepo.

| Vrstva | Vývojář | Technologie |
| ------ | -------- | ----------- |
| **Backend & DB** | Filip Nagy | FastAPI, Python 3.12, PostgreSQL, Redis, SQLModel |
| **Frontend & UX** | Eliáš Jan Procházka | Next.js 16, React 19, Tailwind CSS v4 |

> [!TIP]
> Analytika, návrh datové struktury a architektury vzniká společným úsilím celého týmu.

---

## 📚 Klíčová dokumentace

Díky přísným konvencím a silné architektuře udržujeme dokumentaci minimalistickou, ale vysoce deskriptivní. Vše najdete koncentrované na třech místech:

- 🏗️ [**Architektura a API Kontrakt** (docs/architecture.md)](docs/architecture.md) – Hlavní technická specifikace vrstvené architektury a autogenerování API.
- 🧪 [**Testování (Testing Guidelines)** (docs/testing.md)](docs/testing.md) – Metodika pro unit a E2E testování (Pytest, Vitest, Playwright).
- 🤝 [**Pravidla a Workflow** (CONTRIBUTING.md)](CONTRIBUTING.md) – GitHub procesy a standardy pro psaní PR.

---

## 🚀 Začínáme (Getting Started)

Aplikace vyžaduje lokálně nainstalované `Node.js` (>=20), `pnpm`, `Python` (>=3.12), `uv` a `Docker` (pro lokální databázi).

> [!IMPORTANT]
> Pro bezproblémový běh backendu využíváme nástroj `uv` pro bleskovou a izolovanou správu Python prostředí.

```bash
# 1. Instalace Node závislostí a inicializace Python prostředí
pnpm install
uv sync --dev

# 2. Příprava konfigurace
cp .env.example .env

# 3. Spuštění infrastruktury (PostgreSQL + Redis v Dockeru)
pnpm db:dev

# 4. Spuštění aplikačních serverů (Frontend: 3000, Backend: 8000)
pnpm dev
```

*Databázové tabulky se během lokálního vývoje inicializují automaticky při startu backendového serveru (Auto-Init).*

---

## 🔄 Životní cyklus a Deployment

### Lokální Validace (Quality Assurance)
Před každým vytvořením Pull Requestu se provádí komplexní lokální kontrola celého monorepa, která simuluje CI server:

```bash
pnpm check
```
Tento příkaz paralelně ověřuje formátování (Biome, Ruff), statické typy (TSC, Mypy) a spouští všechny testy.

### Nasazení (Deployment Lifecycle)
Produkční nasazení respektuje kontejnerovou architekturu a bezestavový (stateless) přístup:

1. **CI/CD Pipeline:** Při sloučení kódu do hlavní větve `main` se spouští GitHub Actions pro konečnou verifikaci.
2. **Kontejnerizace:** Backend i Frontend jsou odděleně zabaleny do vysoce optimalizovaných Docker obrazů (images).
3. **Infrastruktura:** Produkční prostředí vyžaduje spravovanou instanci PostgreSQL pro trvalá data a Redis pro bezpečné ukládání relací. Samotné běhové servery aplikací jsou plně horizontálně škálovatelné.
