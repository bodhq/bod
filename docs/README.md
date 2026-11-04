# Dokumentace

Návody popisují aktuální způsob práce a technická reference současný stav projektu.

## Vývoj a provoz

- [Lokální vývoj](guides/development.md) — instalace, konfigurace a první správce.
- [Nasazení](guides/deployment.md) — produkční Compose a trvalá data.
- [Řešení potíží](guides/troubleshooting.md) — Python importy a údržba profilových fotografií.
- [Testování](testing.md) — příkazy, rozsah testů a jejich omezení.
- [Pravidla spolupráce](../CONTRIBUTING.md) — větve, PR, CI a Dependabot.

## Technická reference

- [Architektura](architecture.md) — moduly, vrstvy, API klient a databázové migrace.
- [Validace API](validation.md) — vstupy, chybové odpovědi a export kontraktu.
- [OpenAPI kontrakt](openapi.json) — generovaný soubor; dokumentační kopie kontraktu z `apps/api/schema/openapi.json`.

## Školní podklady a historie

- Původní zadání: [Filip (PDF)](nagyfilip23-zadani.pdf), [Filip (DOCX)](nagyfilip23-zadani.docx), [Eliáš (PDF)](prochazkaelias23-zadani.pdf), [Eliáš (DOCX)](prochazkaelias23-zadani.docx).
- [Sprint reviews](sprint-reviews/README.md) — průběh práce a šablona záznamu.
- [Backendový audit z 1. 11. 2026](backend-review-2026-11-01.md) — historický podklad, aktuální stav popisuje technická reference.

Nový návod patří do `guides/`. Stejný postup neudržuj ve více dokumentech;
README jednotlivých aplikací mohou odkázat na společný návod.
