# 🏗️ Architektura a API Kontrakt

Tento dokument poskytuje kompletní technickou specifikaci architektury systému `bod`, definici jeho doménových modulů a mechanismy komunikačního rozhraní mezi klientskou a serverovou vrstvou.

> [!NOTE]
> Veškerá architektura je navržena pro maximální testovatelnost a dlouhodobou udržitelnost kódu, přičemž těží ze silné typové bezpečnosti (End-to-End Type Safety).

## 📖 Obsah
- [Technologický Stack](#1-technologický-stack)
- [Strukturální návrh (Jádro vs Moduly)](#2-strukturální-návrh-jádro-vs-moduly)
- [Tvorba Modulů (Backend a Frontend)](#3-tvorba-modulů)
- [Komunikační kontrakt (OpenAPI)](#4-komunikační-kontrakt-single-source-of-truth)
- [Inicializace databáze a Lifecycle](#5-inicializace-databáze-a-lifecycle)

---

## 1. Technologický stack

Systém implementuje asymetrickou architekturu distribuovanou v prostředí monorepa pomocí nástroje **Turborepo**.

### Frontend (`apps/web`)
- **Next.js 16** (App Router) a **React 19** pro vykreslování uživatelského rozhraní.
- **TypeScript** pro statickou typovou analýzu a bezpečnost.
- **Tailwind CSS v4** pro moderní utility-first styling.

### Backend (`apps/api`)
- **FastAPI** a **Python 3.12** pro vysokovýkonné asynchronní API služby.
- **SQLModel** pro unifikovanou definici objektově-relačního mapování (ORM) a validačních schémat.
- **PostgreSQL 16** jako primární databázový systém.
- **Redis** jako vrstva pro caching a výkonnou správu relací (Sliding Sessions).

### Infrastruktura a Kvalita
- Nástroje **uv** a **pnpm** pro správu prostředí a závislostí.
- **Biome** a **Ruff** pro bleskovou statickou analýzu a formátování kódu.
- **Playwright**, **Vitest** a **Pytest** pro pokročilé testování.

---

## 2. Strukturální návrh (Jádro vs Moduly)

Projekt používá architektonický vzor **Vertical Slicing** kombinovaný s přísným oddělením **Jádra (Core)** a **Modulů**. 

> [!IMPORTANT]
> **Jádro** poskytuje jednotný datový model a společnou infrastrukturu (uživatele, autentizaci, připojení k DB). **Moduly** (např. rozvrhy, známky) rozšiřují funkcionalitu nezávisle na sobě nad tímto sdíleným jádrem.

---

## 3. Tvorba Modulů

Pro zajištění konzistence musí každý nový modul na backendu i frontendu dodržovat přesně specifikovanou vrstvenou architekturu.

### Backend Modul (`apps/api/server/modules/`)
Každá logická oblast dodržuje striktní 5-vrstvou Enterprise Architekturu. Pro zajištění dlouhodobé udržitelnosti a prevence architektonické degradace je přeskakování vrstev striktně zakázáno.

1. **`models.py`** – Databázové tabulky (`SQLModel`). Nesmí obsahovat HTTP struktury.
2. **`schemas.py`** – DTOs (Data Transfer Objects). Určují přesný tvar JSONu a chrání databázové struktury před únikem ven.
3. **`repository.py`** – Data Access vrstva. Jediné místo v modulu, kde je povoleno sahat do databáze (SQL dotazy a transakce).
4. **`services.py`** – Byznys logika. Dirigent, který provádí výpočty a volá repozitář. Neinteraguje s HTTP požadavky.
5. **`router.py`** – HTTP Endpointy. Tenká obálka, která přijme požadavek, ověří oprávnění a předá úkol service vrstvě.

### Frontend Modul (`apps/web/src/modules/`)
Frontend zrcadlí backend pomocí 4-vrstvého modelu:

1. **`api.ts`** – Komunikační vrstva. Funkce volající automaticky generovaného API klienta.
2. **`hooks/`** – Logika a Stav (např. `useTimetable.ts`). Řeší načítání a cachování dat.
3. **`components/`** – Prezentační UI. Komponenty, které nepřemýšlí – pouze renderují data předaná z hooks.
4. **`app/` (Stránky)** – Kompoziční vrstva v Next.js. Skládá komponenty dohromady a poskytuje routing.

---

## 4. Komunikační kontrakt (Single Source of Truth)

Klientská aplikace komunikuje se serverovou vrstvou výhradně prostřednictvím autogenerovaného TypeScript klienta. 

> [!TIP]
> Neexistují žádná ručně psaná `fetch()` volání pro interní API. Vše se generuje ze schématu.

**Proces aktualizace kontraktu:**
1. Změna struktury endpointu nebo DTO na backendu.
2. Backend vygeneruje novou OpenAPI specifikaci do `docs/openapi.json`.
3. Vývojář frontendu spustí `pnpm gen:api`, což transpiluje schéma do NPM balíčku `@bod/api-client`.
4. Frontend striktně využívá nové, plně otypované metody z tohoto balíčku.

---

## 5. Inicializace databáze a Lifecycle

V prostředí lokálního vývoje nevyužívá systém migrační skripty. Místo toho se spoléháme na proces **Auto-Init**.

Při spuštění `pnpm dev` backend analyzuje definované `SQLModel` třídy a porovná je s tabulkami v databázi PostgreSQL. Chybějící struktury (tabulky, relace) jsou automaticky vytvořeny za chodu, což dramaticky zrychluje vývojovou iteraci. Pro produkční prostředí a údržbu je nicméně uvažováno o nasazení plnohodnotného migračního nástroje (Alembic).
