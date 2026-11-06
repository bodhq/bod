<div align="center">
  <img alt="bod logo" src="./docs/assets/logo.svg" width="200">
</div>

# bod

Modulární školní informační systém vznikající jako středoškolský maturitní projekt.
Backend používá FastAPI a PostgreSQL, frontend Next.js a React.

- [Spustit projekt pro vývoj](docs/development.md)
- [Nainstalovat aplikaci na školní server](docs/deployment.md)
- [Spustit kontroly a testy](docs/testing.md)
- [Dokumentace a projektové podklady](docs/README.md)
- [Pravidla spolupráce](CONTRIBUTING.md)

## Repozitář

| Cesta | Obsah |
| --- | --- |
| `apps/api/` | Backend, jeho doménové testy a zdrojový API kontrakt |
| `apps/web/` | Webová aplikace |
| `packages/` | Generovaný API klient a sdílená TypeScript konfigurace |
| `tests/` | Testy jádra API, webu, prohlížeče a nasazení |
| `infra/` | Produkční a vývojové služby, instalátor, metadata vydání |
| `scripts/` | Kontrola závislostí a sestavení distribučního balíčku |
| `docs/` | Návody, architektura a školní projektové podklady |
| `.github/` | CI, vydávání, Dependabot a pravidla PR |

## Tým

Backend a databáze: Filip Nagy. Frontend, UI, infrastruktura a CI: Eliáš Jan
Procházka. Analýza a architektura jsou společné.
Vedoucí práce: @haut. Oponent: @svitek1. Konzultant: @olsavska.
