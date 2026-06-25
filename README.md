<div align="center">
  <h1>bod</h1>
  <p><strong>Modulární informační systém pro výukové instituce</strong></p>
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](#)
  [![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white)](#)
  [![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](#)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white)](#)
  [![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=flat-square&logo=turborepo&logoColor=white)](#)
</div>

---

**bod** je moderní informační systém postavený na asymetrické architektuře klient-server. Projekt je strukturován jako monorepo a klade důraz na striktní typovou bezpečnost (End-to-End Type Safety), modularitu a automatizaci vývojových procesů.

## Klíčová dokumentace
- 🏗️ [**Architektura a API Kontrakt** (docs/architecture.md)](docs/architecture.md) – Specifikace technologického stacku, struktury modulů a autogenerování API klienta.
- 🧪 [**Testování (Testing Guidelines)** (docs/testing.md)](docs/testing.md) – Přehledný návod, jak, kde a co testovat na frontendu a backendu.
- 🤝 [**Pravidla a Workflow** (CONTRIBUTING.md)](CONTRIBUTING.md) – Závazná pravidla pro verzování, strukturu PR, GitHub Actions a schvalovací procesy.

---

## Vývojové prostředí (Local Environment)

Tato sekce obsahuje standardizovaný postup pro inicializaci vývojového prostředí.

### 1. Systémové požadavky
- **Node.js** (>= 20.19.0) a **pnpm** (>= 9.0.0) pro správu frontendových a sdílených balíčků.
- **Python** (>= 3.12) a **uv** (>= 0.11.0) pro izolované běhové prostředí backendu.
- **Docker Desktop** pro lokální instanci PostgreSQL.

### 2. Inicializace projektu
Následující příkazy provedou instalaci NPM závislostí, vytvoření virtuálního prostředí pro Python a přípravu lokální konfigurace.

```bash
pnpm install
uv sync --dev
cp .env.example .env
```

### 3. Spuštění aplikací
Infrastruktura se spouští ve dvou oddělených procesech.

**Spuštění databáze (Docker):**
Tento příkaz inicializuje kontejner s PostgreSQL na pozadí.
```bash
pnpm db:dev
```

**Spuštění vývojových serverů:**
Tento příkaz prostřednictvím nástroje Turborepo paralelně spustí frontend (Next.js na `localhost:3000`) a backend (FastAPI na `localhost:8000`).
```bash
pnpm dev
```
*Poznámka: Databázové tabulky jsou v rámci lokálního vývoje inicializovány automaticky při startu backendu (Auto-Init).*

### 4. Lokální validace kódu (Quality Assurance)
Před začleněním kódu do repozitáře (vytvoření Pull Requestu) je vyžadována lokální kontrola konzistence kódu.

```bash
pnpm check
```
Příkaz provádí linting, statickou typovou analýzu a testovací kompilaci, čímž simuluje validaci prováděnou na CI serveru.
