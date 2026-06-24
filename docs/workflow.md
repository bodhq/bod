<div align="center">
  <h2>bod | Workflow & Version Control Strategy</h2>
  <p><i>Knowledge Base / Technická dokumentace</i></p>
  
  [![Návrat do README](https://img.shields.io/badge/⬅_Zpět_na_README-181717?style=flat-square)](../README.md)
</div>

---

Jsme malý, dvoučlenný tým. Nechceme ztrácet hodiny na code review nebo utopeni v obrovských gitových konfiktech. Proto jedeme **Trunk-Based Development**. Hlavní myšlenka? Krátce žijící větve, rychlé začlenění kódu, neustále stabilní `main`.

## TBD (Trunk-Based Development) v praxi

U nás neexistuje žádná `develop`, `staging` nebo `release` větev. Je tu jen jedna pravda: **větev `main`**. Ta musí být v jakýkoliv okamžik zkompilovatelná a bez chyb.

### Jak vypadá denní workflow?

1. **Vytvoř si vlastní branch**:
   Z hlavní větve `main` si vytvoř krátce žijící větvičku. 
   ```bash
   git checkout -b feature/pridani-studentu
   # nebo
   git checkout -b fix/oprava-rozvrhu
   ```
2. **Kóďte, commituj, pusuj**:
   Dělej malé logické commity. Na nic nečekej a posílej to na GitHub.
3. **Pull Request (PR)**:
   Jakmile je fičura (nebo aspoň logická část, co funguje sama o sobě) hotová, založ PR do `main`.
4. **Verifikace a Review**:
   Na GitHubu projede CI pipeline (vykoná se `pnpm check`). Pokud něco neprojde, GitHub Actions tě zastaví.
5. **Merge**:
   Pokud testy projdou a kód dává smysl, okamžitě to integrujeme zpět do `main`. Tvoje větev se smaže.

## Zlatá pravidla

- **Necommituj nesmysly**: Žádné `.env` soubory. Žádný vygenerovaný API klient (`packages/api-client/src`). Žádné kompiláty (`.next`, `__pycache__`). Udržuj Git historii čistou.
- **Rychlé iterace**: Větev nesmí "žít" déle než pár dní. Velké updaty znamenají peklo s merge konflikty. Děl to na kousky.
- **Zelený Check**: Nikdy nemergeuj kód, který rozbíjí build. Lokálně spouštěj `pnpm check` jako prevenci.

## Konvence zpráv u Commitů

Snažíme se dodržovat Conventional Commits, abychom měli přehled o historii a abychom si z toho výhledově mohli generovat changelog.

Příklady:
- `feat: přidání komponenty pro rozvrh`
- `fix: oprava routování pro přihlášení`
- `docs: přepis dokumentace do profi tónu`
- `chore: update závislostí`
