<div align="center">
  <p>
    <img src="./docs/assets/banner.svg" alt="bod" width="100%">
  </p>
  <p>
    <strong>Nová generace školních systémů.</strong><br>
    Navrženo pro lepší školu. Od studentů, pro studenty.
  </p>
  <p><sub>#myslimenabudoucnost</sub></p>
  <p>
    <a href="https://github.com/bodhq/bod/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/bodhq/bod/ci.yml?branch=main&amp;style=flat-square&amp;label=CI&amp;labelColor=202329" alt="CI — main"></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-202329?style=flat-square" alt="Licence MIT"></a>
  </p>
  <p>
    <a href="./apps/web/README.md"><img src="https://img.shields.io/badge/TypeScript-202329?style=flat-square&amp;logo=typescript&amp;logoColor=B9FF08" alt="TypeScript"></a>
    <a href="./apps/web/README.md"><img src="https://img.shields.io/badge/Next.js-202329?style=flat-square&amp;logo=nextdotjs&amp;logoColor=B9FF08" alt="Next.js"></a>
    <a href="./apps/api/README.md"><img src="https://img.shields.io/badge/FastAPI-202329?style=flat-square&amp;logo=fastapi&amp;logoColor=B9FF08" alt="FastAPI"></a>
    <a href="./apps/api/README.md"><img src="https://img.shields.io/badge/PostgreSQL-202329?style=flat-square&amp;logo=postgresql&amp;logoColor=B9FF08" alt="PostgreSQL"></a>
    <a href="./docs/architecture.md"><img src="https://img.shields.io/badge/Turborepo-202329?style=flat-square&amp;logo=turborepo&amp;logoColor=B9FF08" alt="Turborepo"></a>
    <a href="./docs/deployment.md"><img src="https://img.shields.io/badge/Docker-202329?style=flat-square&amp;logo=docker&amp;logoColor=B9FF08" alt="Docker"></a>
  </p>
  <p>
    <a href="./docs/development.md">Spuštění</a> ·
    <a href="./docs/architecture.md">Architektura</a> ·
    <a href="./docs/deployment.md">Nasazení</a> ·
    <a href="./docs/README.md">Dokumentace</a>
  </p>
</div>

bod je modulární školní informační systém ve vývoji. Vzniká jako dlouhodobý
maturitní projekt. Zaměřujeme se na rozvrh, učebny, skupiny a třídnici.

## Spuštění

Potřebuješ Node.js, pnpm, Python, uv a Docker. Verze a nastavení prostředí
jsou ve [vývojovém návodu](docs/development.md).

```sh
pnpm install --frozen-lockfile
uv sync --all-packages --all-groups --frozen
cp -n .env.example .env
pnpm db:dev
pnpm gen:api
pnpm dev
```

Web: `http://localhost:3000`. API: `http://localhost:8000`.
[Vytvoření prvního správce](docs/development.md#první-správce).

## Architektura

Monorepo odděluje web, API a sdílený kontrakt. `core` obsahuje společné UI
a infrastrukturu. `modules` skládají konkrétní agendy a obrazovky.
TypeScript klient vzniká z OpenAPI; typy API se ručně nepřepisují.

[Struktura projektu a pravidla závislostí](docs/architecture.md).

## Tým

| Oblast | Autor | Technologie |
| --- | --- | --- |
| Frontend a UI | Eliáš Jan Procházka — @prochazkaelias23 | Next.js, React, TypeScript, Tailwind CSS |
| Backend a databáze | Filip Nagy — @nagyfilip23 | FastAPI, Python, SQLModel, PostgreSQL, Redis |
| Infrastruktura a CI | Eliáš Jan Procházka | Docker, Caddy, Ubuntu Server, GitHub Actions |

Analýza a architektura jsou společné.
Vedoucí: @haut. Oponent: @svitek1. Konzultant: @olsavska.

## Dokumentace

- [Vývoj](docs/development.md) a [testování](docs/testing.md).
- [Instalace na školní server](docs/deployment.md), aktualizace a zálohy.
- [Vizuální identita a UI](docs/design-system.md).
- [Pravidla spolupráce](CONTRIBUTING.md) a [sprint reviews](docs/project/sprint-reviews/README.md).

Školní instalace používá hotové obrazy. Požadavky a správu instalace
popisuje [nasazení](docs/deployment.md#příprava).

| Maturitní zadání | PDF | DOCX |
| --- | --- | --- |
| Eliáš Jan Procházka | [PDF](docs/project/assignments/prochazkaelias23-zadani.pdf) | [DOCX](docs/project/assignments/prochazkaelias23-zadani.docx) |
| Filip Nagy | [PDF](docs/project/assignments/nagyfilip23-zadani.pdf) | [DOCX](docs/project/assignments/nagyfilip23-zadani.docx) |
