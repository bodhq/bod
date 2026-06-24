<div align="center">
  <h2>bod | Development & Runtime</h2>
  <p><i>Knowledge Base / Technická dokumentace</i></p>
  
  [![Návrat do README](https://img.shields.io/badge/⬅_Zpět_na_README-181717?style=flat-square)](../README.md)
</div>

---

Tento dokument definuje systémové prerekvizity a standardní postup pro inicializaci vývojového prostředí projektu.

## Systémové požadavky
- **Node.js** (>= 20.19.0)
- **pnpm** (>= 9.0.0) – Výchozí správce balíčků pro monorepo.
- **Python** (>= 3.12)
- **uv** (>= 0.11.0) – Správce závislostí a prostředí pro Python komponenty.
- **Docker Desktop** (příp. OrbStack) – Požadováno pro běh kontejnerizované vývojové databáze.

## Prvotní inicializace (Instalace závislostí)

Po stažení repozitáře je nezbytné provést inicializaci softwarových závislostí pro oba technologické ekosystémy:

```bash
# Instalace sdílených a frontendových závislostí v pnpm workspaces
pnpm install

# Instalace Python závislostí a tvorba izolovaného .venv prostředí pro backend
uv sync --dev
```

## Lokální běhové prostředí

Orchestrace vývojového prostředí využívá Turborepo pro paralelní exekuci služeb bez nutnosti spouštět separátní procesy uživatelem.

### 1. Inicializace lokální databáze
Repozitář obsahuje izolovanou definici infrastruktury pro lokální vývoj souboru `docker-compose.dev.yml`. Následující příkaz inicializuje kontejner s PostgreSQL databází naslouchající na portu `5432`:

```bash
pnpm db:dev
```

*(Kontejner vytváří datovou persistenci prostřednictvím Docker svazků (volumes). V případě potřeby resetu databáze je nutné provést odstranění svazku příkazem `docker compose -f infra/docker-compose.dev.yml down -v`.)*

### 2. Paralelní spuštění aplikačních serverů
Spuštění klientské a serverové instance se provádí jediným příkazem:

```bash
pnpm dev
```
Specifikace běžících procesů:
- **Backend vrstva (FastAPI)**: Spuštěna pomocí `uv run uvicorn server.main:app`, dostupná na síťovém rozhraní `http://localhost:8000`.
- **Frontend vrstva (Next.js)**: Spuštěna přes `next dev`, dostupná na síťovém rozhraní `http://localhost:3000`.

## Lokální kontrola kvality (Quality Assurance)

Proces automatizované integrace (CI) implementuje striktní kontrolu zdrojových kódů. Před odesláním požadavku na začlenění kódu (Pull Request) je vyžadováno lokální ověření funkčnosti prostřednictvím příkazu:

```bash
pnpm check
```

Provedené operace:
1. **Statická analýza a linting**: Zpracování TypeScriptu (Biome) a Pythonu (Ruff).
2. **Ověření typové integrity**: Zpracování statického typování (`tsc` a `mypy`).
3. **Integrační build**: Zkušební kompilace generátoru API a následný build Next.js aplikace.

Úspěšné (bezchybné) proběhnutí tohoto příkazu je podmínkou pro úspěšnou integraci do hlavní větve.
