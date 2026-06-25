# 🧪 Testovací příručka (Testing Guidelines)

Tento dokument definuje testovací strategie, nástroje a standardy využívané v repozitáři `bod`. Hlavním cílem je zajištění spolehlivosti klíčové byznys logiky a prevence regresních chyb prostřednictvím standardizovaných postupů.

> [!TIP]
> Testovací architektura využívá striktně vymezené hranice a standardizované šablony. Pro implementaci nových testů se doporučuje replikovat strukturu existujících testovacích sad.

## 📖 Obsah
- [Základní příkazy](#-základní-příkazy)
- [Backend: FastAPI (Pytest)](#1-backend-fastapi-pytest)
- [Frontend: Next.js (Vitest)](#2-frontend-react-a-nextjs-vitest)
- [End-to-End: Playwright](#3-end-to-end-playwright)

---

## ⚡ Základní příkazy

Všechny testy napříč monorepem jsou symetricky zmapovány do hlavního skriptu v kořenové složce.

```bash
# Spuštění kompletní sady testů (Frontend, Backend, E2E)
pnpm test

# Komplexní QA (Testy + Linting + Build) - simulace CI
pnpm check
```

---

## 1. Backend: FastAPI (Pytest)

Na backendu je testování zaměřeno na ověřování výstupů Byznys Logiky (Services) a HTTP Kontraktů (Routers). Cílové pokrytí (Code Coverage) je stanoveno na 80 % (`cov-fail-under=80`).

- **Umístění testů:** `apps/api/tests/`
- **Spuštění modulu:** `cd apps/api && uv run pytest`

### Metodika testování
Používáme standardní vzor **AAA (Arrange - Act - Assert)** nad dočasnou In-Memory SQLite databází:

1. **Arrange (Příprava):** Seedování potřebných mockovaných záznamů do DB.
2. **Act (Zavolání):** Vykonání logiky skrz API router nebo zavolání Service metody.
3. **Assert (Ověření):** Validace, že výstup odpovídá očekávání (status kód, JSON data).

> [!IMPORTANT]
> Nikdy nespouštějte testy proti produkční nebo vývojové PostgreSQL databázi. Pytest fixtures automaticky izolují testy do bezpečné paměťové SQLite. Příklad správného nastavení testu naleznete v `tests/api/test_timetable.py`.

---

## 2. Frontend: React a Next.js (Vitest)

V prostředí frontendu **netestujeme vizuální vrstvu** (prezentační React komponenty a Tailwind třídy). Testování UI je často nestabilní a narušuje rychlost vývoje. Zaměřujeme se výhradně na datovou vrstvu frontendu.

- **Umístění testů:** `apps/web/tests/web/`
- **Spuštění modulu:** `pnpm --filter @bod/web test`

### Metodika testování (Hooks a API)
1. Cílem je testování výlučně **Custom Hooks** (např. `useTimetable.ts`), které zprostředkovávají datový most.
2. Používáme knihovnu `@testing-library/react` (zejména funkci `renderHook`).
3. Veškerá komunikace na backend se izolačně mockuje přímo na úrovni autogenerovaného API klienta přes `vi.spyOn()`. Tím testujeme, jak hook správně mění stav při načítání a chybách.

> [!NOTE]
> Pro ukázkovou architekturu testování React Hooks si prohlédněte soubor `tests/web/timetable/useTimetable.test.tsx`.

---

## 3. End-to-End (Playwright)

Zatímco Unit testy (Pytest, Vitest) ověřují izolované jednotky kódu, E2E testování slouží k prověření zdraví celého distribuovaného systému (Frontend ↔ Backend ↔ Databáze).

- **Umístění testů:** `tests/e2e/`
- **Spuštění modulu:** K dispozici globální skript, vyžaduje běžící aplikaci a nasazená seed data.

Tyto testy využívají engine Playwright k inicializaci prostředí reálného prohlížeče, který automatizovaně simuluje interakce uživatele s aplikací. Nasazují se výhradně pro kritické cesty (uživatelská flow, např. úspěšné přihlášení nebo zobrazení rozvrhu). End-to-End testy pokrývají fundamentální chování systému a garantují jeho základní funkčnost.
