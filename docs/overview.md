<div align="center">
  <h2>bod | System Overview</h2>
  <p><i>Knowledge Base / Technická dokumentace</i></p>
  
  [![Návrat do README](https://img.shields.io/badge/⬅_Zpět_na_README-181717?style=flat-square)](../README.md)
</div>

---

Tento dokument slouží jako rychlý přehled pro vývojáře. Představuje technologický stack `bod` a mapuje strukturu našeho monorepa.

## K čemu to je?

`bod` je školní informační systém navržený od základů pro rychlou iteraci a maximální vývojářský komfort. Namísto těžkopádných monolitů sází na **izolaci domén**, **100% typovou bezpečnost (End-to-End)** a absolutní **automatizaci** (od generování API po lokální Auto-Init databáze).

## Tech Stack

Sázíme na moderní, rychlé a prověřené technologie. Backend a Frontend žijí vedle sebe, ale mluví spolu striktně přes API kontrakt.

- **Frontend (Web)**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend (API)**: FastAPI, Pydantic v2, Python 3.12+, SQLModel
- **Databáze**: PostgreSQL 16 (lokálně přes Docker)
- **Monorepo & Tooling**: pnpm workspaces, Turborepo, `uv` (pro Python balíčky)
- **Code Quality**: Biome (rychlý linting TS/JS), Ruff & mypy (Python)

## Struktura Monorepa

Používáme `pnpm workspaces` pro orchestraci balíčků. Projekt je logicky rozdělen do aplikací (`apps/`), sdílených balíčků (`packages/`) a infrastruktury (`infra/`).

```text
bod/
├── apps/
│   ├── api/                # FastAPI backend (izolováno přes uv)
│   └── web/                # Next.js frontend (pnpm)
├── packages/
│   ├── api-client/         # Typově bezpečný TS klient (autogenerovaný z backendu)
│   └── config-typescript/  # Sdílená základní TS konfigurace
├── infra/                  # Docker Compose a Caddyfile (Produkce i Dev)
├── docs/                   # Tato technická dokumentace
└── .github/                # GitHub Actions CI a šablony PR
```

Pro detaily k fungování modulů přeskoč na [Architekturu](./architecture.md). Potřebuješ to hned spustit? Zamiř do [Development & Runtime](./development.md).
