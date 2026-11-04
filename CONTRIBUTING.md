# Spolupráce

Změny začleňuj přes Pull Request do `develop` nebo `main`. Před sloučením
vyžádej review podle `.github/CODEOWNERS`. Vynucení review a povinných kontrol
se nastavuje v pravidlech větví na GitHubu; samotný CODEOWNERS je nezapíná.

## Větve a commity

Název větve má formát `prefix/kratky-popis`, malými písmeny, číslicemi
a pomlčkami, celkem nejvýše 50 znaků. Workflow `branch-name.yml` připouští:

| Prefix | Účel |
| --- | --- |
| `feat/` | Nová funkce |
| `fix/` | Oprava chyby |
| `docs/` | Dokumentace |
| `chore/` | Údržba repozitáře |
| `refactor/` | Změna struktury kódu |
| `test/` | Testy |
| `infra/` | Infrastruktura a CI |

Větev drž na nejvýše **dvou commitech**. Související opravy před review
sluč do stávajících commitů. Větev `dependabot/…` spravuje automatizace.

## Pull Request

Název má formát `typ(scope): popis`, například
`chore(infra): simplify school deployment`. Popis začíná malým písmenem.
Povolené scopes ve workflow `pr-title.yml` jsou `api`, `web`, `e2e`, `deps`,
`deps-dev`, `chore`, `docs` a `infra`.

V popisu uveď řešený problém, výsledné chování a skutečně provedené ověření.
Lokální kontroly a další CI joby popisuje [testování](docs/testing.md).

## Závislosti

Dependabot seskupuje běžné minor/patch aktualizace npm, uv a GitHub Actions
měsíčně, se sedmidenním cooldownem. Bezpečnostní aktualizace mají vlastní
skupiny. Automatické slučování není nastavené.

React/React DOM a Vitest/coverage se aktualizují společně;
shodu verzí ověřuje `pnpm deps:check`. Verze a lockfiles měň ve stejném PR.
