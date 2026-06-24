<div align="center">
  <h2>bod | Development & Runtime</h2>
  <p><i>Knowledge Base / Technická dokumentace</i></p>
  
  [![Návrat do README](https://img.shields.io/badge/⬅_Zpět_na_README-181717?style=flat-square)](../README.md)
</div>

---

Rozjet projekt u sebe na noťasu nesmí trvat víc než dvě minuty. Tento dokument ukazuje, co k tomu potřebuješ a jak systém probudit k životu.

## Co musíš mít nainstalováno?
- **Node.js** (>= 20.19.0)
- **pnpm** (>= 9.0.0) – Náš defaultní package manager pro monorepo.
- **Python** (>= 3.12)
- **uv** (>= 0.11.0) – Neuvěřitelně rychlý package manager pro Python.
- **Docker Desktop** (nebo OrbStack) – Na vytočení lokální databáze.

## První start (Klonování & Instalace)

Právě jsi stáhl repozitář? Super, nainstalujme závislosti do obou ekosystémů:

```bash
# Instaluje všechno potřebné pro Next.js a balíčky v pnpm workspaces
pnpm install

# Stáhne Python závislosti a vytvoří izolované .venv pro náš backend
uv sync --dev
```

## Nahození motorů (Lokální Běh)

Turborepo nám umožňuje pustit všechno najednou. Už žádné otevírání tří různých terminálů!

### 1. Spuštění lokální databáze
Repozitář obsahuje izolovanou definici infrastruktury pro vývoj v `docker-compose.dev.yml`. Následující příkaz spustí PostgreSQL kontejner na portu `5432` na pozadí:

```bash
pnpm db:dev
```

*(Kontejner vytváří persistenci prostřednictvím Docker volumes. Ke smazání svazku a resetu databáze je nutné spustit `docker compose -f infra/docker-compose.dev.yml down -v`.)*

### 2. Zapni servery
Tenhle příkaz kouzlem zvedne obě aplikace naráz:

```bash
pnpm dev
```
Co přesně se stane?
- **Backend (FastAPI)** nastartuje přes `uv run uvicorn server.main:app` a poběží na `http://localhost:8000`.
- **Frontend (Next.js)** nastartuje přes `next dev` a najdeš ho na `http://localhost:3000`.

## Quality Assurance (Před Commitem!)

Náš CI (Continuous Integration) server je nemilosrdný. Než otevřeš Pull Request, ušetři sobě i ostatním čas a proklepni si kód lokálně:

```bash
pnpm check
```

Tenhle mocný příkaz za tebe:
1. **Prolintuje** TypeScript (přes Biome) a Python (přes Ruff).
2. **Zkontroluje typy** (přes `tsc` a `mypy`).
3. **Zkusí to zkompilovat** (Next.js Build & API Generation).

Pokud `pnpm check` projde zeleně, jsi ready poslat kód do světa!
