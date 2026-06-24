<div align="center">
  <h1>bod</h1>
  <p><strong>Modulární informační systém pro výukové instituce</strong></p>
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](#)
  [![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white)](#)
  [![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](#)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white)](#)
  [![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=flat-square&logo=turborepo&logoColor=white)](#)
  [![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](#)
  [![Caddy](https://img.shields.io/badge/Caddy-00ADD8?style=flat-square&logo=caddy&logoColor=white)](#)
</div>

---

**bod** je vysoce modulární, výkonný informační systém postavený na asymetrické architektuře klient-server. Využívá striktní separaci domén (Domain-Driven Design), pnpm workspaces a plně automatizované generování API kontraktů pro dosažení maximální typové bezpečnosti (End-to-End Type Safety).

## Klíčové vlastnosti

- **Symmetrical Modular Design**: Obě vrstvy (Next.js i FastAPI) sdílejí identickou adresářovou strukturu doménových modulů, což eliminuje vznik monolitických závislostí.
- **Single Source of Truth (SSOT)**: Datové transportní objekty (DTO) jsou na frontendu exkluzivně odvozeny z `OpenAPI` specifikace backendu přes automatizovaný transpilátor.
- **Auto-Init Lifecycle**: Eliminace asynchronních databázových migrací pro lokální vývoj – inicializace tabulek probíhá programaticky při vzniku instance aplikace.
- **Zero-Config Monorepo**: Turborepo orchestrace s odděleným `uv` prostředím pro Python a `pnpm` workspace pro Node.js komponenty.

## Technická dokumentace (Knowledge Base)

Oficiální architektonická a procesní dokumentace je k dispozici v adresáři `/docs`:

- [Přehled Systému](docs/overview.md) — Identifikace technologického stacku a izolace.
- [Architektura a Moduly](docs/architecture.md) — Zásady strukturálního návrhu, datový tok, konvence modulů a inicializace databáze (obsahuje Mermaid diagramy).
- [Vývojové Prostředí](docs/development.md) — Instalace závislostí, definice instancí v Docker Compose a exekuce lokálního běhu.
- [API Kontrakt a Tok Dat](docs/api.md) — Definice Single Source of Truth principu a generativního typování.
- [Workflow a Verze](docs/workflow.md) — Branching strategie (Trunk-Based) a integrační standardy (CI).

## Rychlý start (Local Environment)

### Prerekvizity
- `Node.js >= 20.19.0` & `pnpm 9.x`
- `Python >= 3.12` & `uv >= 0.11`
- `Docker Desktop` (pro PostgreSQL kontejner)

### Inicializace

```bash
# 1. Instalace klientských závislostí
pnpm install

# 2. Inicializace Python prostředí a závislostí backendu
uv sync --dev

# 3. Překopírování lokálních proměnných prostředí
cp .env.example .env
```

### Spuštění

```bash
# A. Inicializace PostgreSQL (Běží na pozadí)
pnpm db:dev

# B. Souběžné spuštění Next.js (port 3000) a FastAPI (port 8000)
pnpm dev

# C. Naplnění databáze testovacími daty (volitelné)
pnpm db:seed
```

*(Systém automaticky provede Auto-Init proceduru databázových tabulek přes SQLModel.)*

## Produkční nasazení (Self-Hosted)

Systém je navržen pro Self-Hosted nasazení s izolovanými porty, automatickými denními zálohami databáze a reverzní proxy (Caddy). Každá instituce provozuje vlastní instanci systému.

```bash
# Nastav doménu v .env
DOMAIN=bod.skola.cz

# Spustí produkční kontejnery na pozadí (Caddy, API, Web, DB, Backups)
docker compose -f infra/docker-compose.yml up -d --build
```
*Caddy automaticky vyjedná TLS certifikát přes Let's Encrypt.*

## Kontrola kvality kódu (Quality Assurance)

Před odesláním Pull Requestu je nutné garantovat technologickou stabilitu kódu. Spuštění lokální CI verifikace:

```bash
pnpm check
```
*(Paralelně vyvolá: Biome & Ruff Linting, tsc & mypy Typechecking, generování API a Next.js Build.)*
