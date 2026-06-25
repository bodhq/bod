# Testovací příručka (Testing Guidelines)

Tento dokument slouží jako jednoduchý a jasný průvodce testováním v našem projektu. Pokud se cítíš přehlcený (overwhelmed), nezoufej – testování tu má jasná a striktní pravidla, aby se z toho nestal chaos.

## Základní příkazy

Všechny testy v projektu můžeš spustit jedním příkazem z kořenové složky:

```bash
# Spustí všechny testy (Frontend, Backend i E2E)
pnpm test

# Spustí testy spolu s buildem a lintingem (tzv. CI kontrola)
pnpm check
```

---

## 1. Backend: FastAPI (Pytest)

Na backendu testujeme **byznys logiku** a **HTTP API**. Cílem je dosáhnout 80% pokrytí kódu (`cov-fail-under=80`).

- **Umístění:** `tests/api/`
- **Spuštění izolovaně:** `cd apps/api && uv run pytest`
- **Pravidla:**
  - Vždy používáme in-memory SQLite databázi (viz `tests/api/test_timetable.py`), takže si neničíme lokální PostgreSQL data.
  - Testy se píší pomocí **AAA vzoru (Arrange - Act - Assert)**:
    1. *Arrange*: Připrav (namockuj) data, vlož do DB.
    2. *Act*: Zavolej náš endpoint nebo service funkci.
    3. *Assert*: Zkontroluj, zda HTTP status je 200/404 a zda výsledek sedí.

**💡 Ukázkový příklad:** Podívej se do `tests/api/test_timetable.py`. Najdeš tam dokonalý "Prod Grade" příklad testu pro úspěšné získání rozvrhu i pro selhání (404).

---

## 2. Frontend: React a Next.js (Vitest)

Zde **netestujeme** vizuální komponenty (např. jestli se vyrenderovalo tlačítko správnou barvou). Takové testy jsou křehké a při každé změně designu se rozbijí. 
Testujeme pouze **Byznys Logiku Frontendu** – tedy naše **React Hooky** a API integrace.

- **Umístění:** Všechny frontend testy jsou izolované v rootu ve složce `tests/web/`
- **Spuštění izolovaně:** `pnpm --filter @bod/web test`
- **Pravidla:**
  - Testujeme Hooky (`useTimetable.ts`), které obalují volání našeho autogenerovaného API klienta.
  - Pro testování hooků používáme funkci `renderHook` z `@testing-library/react`.
  - Vždy mockujeme samotného API klienta pomocí `vi.spyOn(api, "jméno_funkce")`.

**💡 Ukázkový příklad:** Podívej se do `tests/web/timetable/useTimetable.test.tsx`. Krásně ukazuje, jak ověřit načítání, úspěšná data i chybové stavy bez nutnosti testovat DOM.

---

## 3. End-to-End (Playwright)

Pro zajištění toho, že systém funguje jako celek (frontend si správně povídá s backendem a databází), máme E2E testy.

- **Umístění:** `tests/e2e/` (nebo v balíčku `apps/e2e`)
- **Pravidla:** Tyto testy spouští opravdový prohlížeč a "klikají" jako uživatel. Slouží k otestování nejkritičtějších uživatelských flow (např. "přihlášení uživatele").
