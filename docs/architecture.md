# Architektura a API Kontrakt

Tento dokument poskytuje technickou specifikaci architektury systému `bod`, definici jeho doménových modulů a mechanismy komunikačního rozhraní mezi klientskou a serverovou vrstvou.

## 1. Technologický stack

Systém implementuje asymetrickou architekturu distribuovanou v prostředí monorepa pomocí nástroje **Turborepo**.

**Frontend (`apps/web`)**
- Next.js 16 (App Router) a React 19 pro vykreslování uživatelského rozhraní.
- TypeScript pro statickou typovou analýzu a bezpečnost.
- Tailwind CSS v4 pro styling komponent bez nutnosti dedikovaných CSS modulů.

**Backend (`apps/api`)**
- FastAPI a Python 3.12 pro vysokovýkonné asynchronní API služby.
- SQLModel pro unifikovanou definici objektově-relačního mapování (ORM) a validačních schémat.
- Balíčkovací manažer `uv` pro rychlou a izolovanou správu běhového prostředí.

**Infrastruktura a Data**
- PostgreSQL 16 kontejnerizovaný prostřednictvím Dockeru jako primární databázový systém.
- Biome a Ruff pro striktní statickou analýzu zdrojových kódů.
- Playwright pro vykonávání komplexních End-to-End testů.

## 2. Strukturální návrh (Doménové moduly)

Projekt používá architektonický vzor **Vertical Slicing**. Kód není rozdělen plošně podle typu (všechny komponenty na hromadu, všechny API cesty na hromadu), ale je rozdělen "vertikálně" podle byznys logiky (např. modul pro rozvrh, modul pro uživatele). 

Backend i Frontend tuto architekturu symetricky zrcadlí:

> 👉 **Tvorba nového API (Backend):** [Návod a Boilerplate zde](api-boilerplate.md)
> 👉 **Tvorba nového UI (Frontend):** [Návod a Boilerplate zde](web-boilerplate.md)

### Byznys Moduly (`server/modules/`)
Tady se odehrává veškerá funkcionalita. Projekt je dělen vertikálně (Domain-Driven Design). Každá logická oblast (např. `timetable`, `users`) má vlastní složku a dodržuje **Striktní 5-vrstvou Enterprise Architekturu**:

1. **`models.py`** – Databázové tabulky (`SQLModel`). Žádná HTTP struktura.
2. **`schemas.py`** – DTOs (Data Transfer Objects, `Pydantic`). Určují přesný tvar JSONu pro frontend. Tím zabraňují úniku databázových sloupců ven.
3. **`repository.py`** – Data Access Layer. Jediné místo v projektu s povoleným přístupem do databáze (SQL dotazy).
4. **`services.py`** – Byznys logika ("dirigent"). Zpracovává výpočty, volá `repository` a nesahá na HTTP kontext. 
5. **`router.py`** – HTTP Endpoints. Zcela hloupá HTTP obálka, která pouze zavolá `services` a zabalí výstup do `schemas`.

Tato izolace zajišťuje extrémní testovatelnost a naprostou bezpečnost. 
> 👉 **Potřebujete vytvořit nový modul?** Použijte přesný návod a ukázkový kód v dokumentu [Tvorba nového API Modulu (Boilerplate)](api-boilerplate.md).

### Infrastruktura (`server/core/` a `server/api/`)
Zatímco doménové moduly řeší specifické problémy (rozvrh, známky), infrastrukturní vrstva se stará o celkový chod aplikace:
- `core/`: Nastavení (Environment proměnné), připojení k DB, bezpečnost a globální výjimky.
- `api/`: Root router (přijímá všechny moduly a dává jim prefix `/api/v1`) a globální middlewares.

## 3. Komunikační kontrakt (Single Source of Truth)

Klientská aplikace komunikuje se serverovou vrstvou výhradně prostřednictvím autogenerovaného klienta. Tím je zajištěno striktní typování na obou stranách síťové komunikace (Single Source of Truth).

**Proces aktualizace kontraktu:**
1. Po modifikaci API endpoints nebo databázových modelů na backendu je vyžadována spuštění synchronizační úlohy:
   ```bash
   pnpm gen:api
   ```
2. Skript extrahuje OpenAPI schéma a transpiluje jej do TypeScript balíčku `@bod/api-client`.
3. Datové interakce na frontendu následně probíhají striktně voláním staticky typovaných funkcí. Příklad v implementaci:

```tsx
import { getTimetableApiV1TimetableClassIdGet } from "@bod/api-client";

const { data } = await getTimetableApiV1TimetableClassIdGet({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    path: { class_id: 1 },
});
```

*Tento přístup systematicky eliminuje vznik runtime výjimek plynoucích z nesouladu mezi očekávaným a dodaným datovým strukturám.*

## 4. Inicializace databáze (Auto-Init)

V prostředí lokálního vývoje nevyužívá systém explicitní migrační skripty (jako je např. Alembic). K udržování databázové synchronizace s kódem je využíván Auto-Init proces v rámci životního cyklu aplikačního serveru.

Při spuštění služby `pnpm dev` dojde k instanciaci backendového frameworku. Systém dynamicky porovná definované SQLModel třídy s existující strukturou databáze v PostgreSQL a případné neexistující relace automaticky vytvoří. Tím odpadá administrativa spojená se správou migrací.

## 5. Zajištění kvality (Testování a Seedování)

Aplikace vyžaduje dodržování 80% pokrytí kódu testy na backendu (`cov-fail-under=80`). Architektura zaručuje konzistenci a testovatelnost:

1. **Seedování Dat:** V `apps/api/server/scripts/seed.py` je definován skript pro naplnění lokální/testovací databáze deterministickými (předvídatelnými) daty. Seed data slouží jako sdílený základ pro všechny vývojáře a izolované End-to-End testy.
2. **Backend (Pytest):** Testy se nachází centrálně ve složce `tests/api/`. Jsou koncipovány pomocí **AAA vzoru (Arrange-Act-Assert)** s využitím `In-Memory SQLite` databáze pro rychlé izolované testování business logiky.
3. **Frontend (Vitest):** Místo křehkých testů UI komponent testujeme výhradně frontendovou byznys logiku (React Hooks a API wrappery). Testovací soubory sídlí centrálně ve složce `tests/web/`. Pomocí izolačního mockování zajišťujeme spolehlivost datového toku, aniž bychom testovali Tailwind třídy.
