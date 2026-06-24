<div align="center">
  <h2>bod | System Overview</h2>
  <p><i>Knowledge Base / Technická dokumentace</i></p>
  
  [![Návrat do README](https://img.shields.io/badge/⬅_Zpět_na_README-181717?style=flat-square)](../README.md)
</div>

---

Tento dokument slouží jako stručný přehled pro vývojáře a hodnotitele. Poskytuje shrnutí technologického zásobníku systému `bod` a definuje strukturu repozitáře.

## Účel systému

`bod` je moderní školní informační systém navržený s důrazem na modularitu, typovou bezpečnost a automatizaci rutinních procesů. Cílem návrhu je eliminace monolitických struktur prostřednictvím **izolace domén**, garantování **100% End-to-End typové bezpečnosti** a plná **automatizace** vývojových operací (od generování API klientů po Auto-Init proces databáze).

## Technologický zásobník

Architektura využívá moderní a prověřené technologie. Backend a Frontend existují jako oddělené entity, jejichž komunikace probíhá striktně přes generovaný API kontrakt.

- **Frontend (Web)**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend (API)**: FastAPI, Pydantic v2, Python 3.12+, SQLModel
- **Databáze**: PostgreSQL 16 (kontejnerizováno přes Docker)
- **Monorepo a Tooling**: pnpm workspaces, Turborepo, `uv` (pro správu balíčků Python)
- **Statická analýza**: Biome (TypeScript linting a formátování), Ruff & mypy (Python)

## Struktura Monorepa

Systém využívá `pnpm workspaces` pro organizaci softwarových komponent. Projekt je logicky rozdělen do produkčních aplikací (`apps/`), sdílených knihoven (`packages/`) a infrastruktury (`infra/`).

```text
bod/
├── apps/
│   ├── api/                # FastAPI backend (izolováno přes uv)
│   └── web/                # Next.js frontend (pnpm)
├── packages/
│   ├── api-client/         # Typově bezpečný TypeScript klient (autogenerovaný)
│   └── config-typescript/  # Sdílená základní TypeScript konfigurace
├── infra/                  # Konfigurace Docker Compose a Caddyfile
├── docs/                   # Oficiální technická dokumentace
└── .github/                # GitHub Actions CI a pravidla repozitáře
```

Podrobnější specifikace návrhových vzorů je uvedena v dokumentu [Architektura](./architecture.md). Instrukce pro lokální nasazení jsou obsaženy v [Development & Runtime](./development.md).
