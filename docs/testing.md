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

Ruční průchod účty, rolemi a oprávněními popisuje [návod pro Postman](postman.md)
s připravenou importovatelnou kolekcí. Nevyžaduje spuštění webové aplikace.

Na backendu je testování zaměřeno na ověřování výstupů Byznys Logiky (Services) a HTTP Kontraktů (Routers). Cílové pokrytí (Code Coverage) je stanoveno na 80 % (`cov-fail-under=80`).

- **Umístění testů:** `tests/api/`
- **Spuštění modulu:** `uv run pytest` z kořene projektu, případně `cd apps/api && uv run pytest ../../tests/api`

### Metodika testování

Běžné API testy používají **SQLite v dočasném souboru pro každý test**.
Docker, PostgreSQL server ani Redis nejsou pro tento běh potřeba. Databáze
se vytvoří automaticky v pytest tmp adresáři, profilové fotky také směřují
do tmp adresáře. HTTP požadavky používají vlastní transakce a připojení.

```sh
uv sync --all-packages --all-groups --frozen
uv run pytest
```

Používáme vzor **AAA (Arrange - Act - Assert)**:

1. **Arrange:** vytvoření potřebných záznamů v izolované SQLite databázi.
2. **Act:** volání API nebo služby.
3. **Assert:** ověření odpovědi a uložených dat.

`tests/api/conftest.py` přepíše nastavení testovacího připojení bez ohledu
na DATABASE_URL v `.env`. Provozní databázi nepoužívá. Redis limiter je
nahrazen lokálním testovacím objektem.

`tests/api/sqlite_support.py` řeší rozdíly databází pouze uvnitř testů:

- zapíná cizí klíče (`PRAGMA foreign_keys=ON`), včetně složené vazby aktivní role,
- mapuje SQL typ JSONB na SQLite JSON a doplňuje funkci btrim,
- doplňuje UTC k časům načteným SQLite driverem,
- nahrazuje správní advisory lock lokálním zámkem drženým do konce transakce.

Tímto během se ověřuje funkční chování API a pravidla souběžných změn.
PostgreSQL advisory locky, row locky a PostgreSQL migrační SQL tímto během
ověřené nejsou. Provozní implementace ani migrace se kvůli SQLite nemění.

### Volitelné PostgreSQL migrace

Pět testů migrací má značku `postgres`. Bez `TEST_POSTGRES_URL` se přeskočí;
nejde o povinnou závislost běžných testů. Pokud je chceš ověřit proti
PostgreSQL, spusť například:

```sh
TEST_POSTGRES_URL=postgresql+psycopg://bod:bod@localhost:5433/bod \
  uv run pytest -m postgres --no-cov
```

Tyto testy mají na určeném PostgreSQL serveru vlastní dočasné schéma
`bod_test_<uuid>`, které se po testu odstraní. Používej lokální nebo testovací
server; role musí smět vytvářet schémata. Pro úplný běh včetně pokrytí stačí
stejnou proměnnou nastavit při `uv run pytest` bez filtru značky.

CI používá pro běžnou sadu SQLite a nepotřebuje PostgreSQL service.

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
