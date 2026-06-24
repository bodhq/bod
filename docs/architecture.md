<div align="center">
  <h2>bod | System Architecture</h2>
  <p><i>Knowledge Base / Technická dokumentace</i></p>
  
  [![Návrat do README](https://img.shields.io/badge/⬅_Zpět_na_README-181717?style=flat-square)](../README.md)
</div>

---

Architektura `bod` kašle na tradiční špagetový kód. Jedeme striktní Domain-Driven Design (Feature-Driven), 100% End-to-End typovou bezpečnost a naprostou symetrii mezi tím, co běží v prohlížeči, a tím, co sedí na serveru.

## Jak spolu věci mluví?

Komunikace běží přes klasické REST API. Rozdíl je v tom, že Frontend nikdy netipuje, jaká data z Backend API přijdou. Vše se automaticky generuje z OpenAPI specifikace přímo do TypeScript klienta.

```mermaid
flowchart TD
  User((Uživatel)) --> |HTTP/HTTPS| FE[Frontend<br>Next.js App Router]
  
  subgraph Monorepo ["Monorepo Workspace"]
    FE --> |Generovaný TS Klient| APIContract[(API Kontrakt<br>@bod/api-client)]
    APIContract --> |REST / JSON| BE[Backend<br>FastAPI]
  end

  BE --> |SQLAlchemy / SQLModel| DB[(PostgreSQL 16)]
```

## Moduly, ne vrstvy

Zapomeňte na gigantické složky `routes/`, `models/` a `controllers/`. Kód dělíme výhradně podle byznys domén (např. *Timetable*, *Grades*). Pokud přidáváš funkci do rozvrhu, sáhneš do jediné složky.

### Striktní Frontend/Backend Symetrie

Každá byznys doména má svou složku na Backend u (FastAPI) i na Frontendu (Next.js). Pokud backend pošle data z modulu `timetable`, frontend je chytá a renderuje v odpovídajícím modulu `timetable`. Žádný zmatek.

```mermaid
flowchart LR
  subgraph Backend ["apps/api/server/modules/"]
    B_Timetable[timetable/]
    B_Grades[grades/]
  end

  subgraph Frontend ["apps/web/src/modules/"]
    F_Timetable[timetable/]
    F_Grades[grades/]
  end

  B_Timetable -.-> |"Doménově namapováno"| F_Timetable
  B_Grades -.-> |"Doménově namapováno"| F_Grades
```

- **Backend modul** řeší databázi (SQLModel), byznys logiku a API endpointy (FastAPI).
- **Frontend modul** konzumuje vygenerovaného klienta a stará se o UI (React Server/Client komponenty).

## Auto-Init Databáze (No Migrations)

Jsme malý tým. Nechceme ztrácet čas řešením zničených migračních skriptů z Alembicu. Databáze se u nás aktualizuje sama přes **Auto-Init (Lifespan)**.

1. Při startu Uvicorn serveru se spustí FastAPI `lifespan` hook.
2. Aplikace si osahá modely (`SQLModel`) a zkontroluje PostgreSQL.
3. Zavolá se `SQLModel.metadata.create_all()`. Nové tabulky se založí, chybějící sloupečky se vytvoří.

Díky tomu můžeš beztrestně iterovat nad Python modely, stačí jen restartovat server!
