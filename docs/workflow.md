<div align="center">
  <h2>bod | Workflow & Version Control Strategy</h2>
  <p><i>Knowledge Base / Technická dokumentace</i></p>
  
  [![Návrat do README](https://img.shields.io/badge/⬅_Zpět_na_README-181717?style=flat-square)](../README.md)
</div>

---

Tento dokument specifikuje pracovní postup verzování zdrojového kódu a integrace funkcionalit. Projekt využívá metodologii **Trunk-Based Development** s cílem minimalizovat vznik komplexních merge konfliktů a garantovat permanentní integritu hlavní větve (`main`).

## Koncept Trunk-Based Development (TBD)

V repozitáři se nevyužívají dedikované větve typu `develop`, `staging` nebo `release`. Existuje pouze jediná finální větev **`main`**, která podléhá striktním požadavkům na stabilitu a kompilovatelnost.

### Denní pracovní postup (Workflow)

1. **Vytvoření pracovní větve**:
   Nová vývojová větev musí vždy vycházet z aktuálního stavu větve `main`. Název větve musí jasně specifikovat povahu změn.
   ```bash
   git checkout -b feature/pridani-studentu
   # nebo
   git checkout -b fix/oprava-rozvrhu
   ```
2. **Vývoj a revize lokálního kódu**:
   Je doporučeno provádět frekventované a logicky strukturované commity.
3. **Založení Pull Requestu (PR)**:
   Po dokončení implementace izolované části funkcionality je vyžadováno založení Pull Requestu směřujícího do větve `main`.
4. **Verifikace a CI/CD**:
   GitHub automaticky provede spuštění CI verifikace (odpovídající lokálnímu příkazu `pnpm check`). Jakékoliv selhání zamezí možnosti začlenění kódu.
5. **Integrace (Merge)**:
   Při úspěšném vyhodnocení CI pipeliny je kód neprodleně integrován do větve `main` a zdrojová větev je odstraněna.

## Závazná pravidla integrace

- **Čistota verzované historie**: Je zakázáno commitovat lokální a autogenerované soubory. To se týká lokálních konfigurací (`.env`), autogenerovaného API klienta (`packages/api-client/src`), a jakýchkoliv kompilátů (`.next`, `__pycache__`).
- **Krátký životní cyklus větví**: Vývojové větve nesmí existovat po delší časové období (řádově by měly být integrovány v rámci dnů), aby se předešlo regresím a složitým merge konfliktům.
- **Bezpečnostní limit**: Začlenění kódu obsahujícího chyby identifikované statickou analýzou nebo procesem sestavení je striktně zakázáno. Před otevřením Pull Requestu je vyžadována lokální prevence přes příkaz `pnpm check`.

## Konvence commit zpráv

Repozitář dodržuje specifikaci **Conventional Commits**. Tato standardizace umožňuje konzistentní sledování historie změn a automatizované generování changelogu.

Příklady povolených prefixů:
- `feat: přidání komponenty pro rozvrh`
- `fix: oprava routování pro autentizaci`
- `docs: aktualizace dokumentačních souborů`
- `chore: aktualizace softwarových závislostí`
