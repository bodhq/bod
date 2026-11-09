# bod web

Frontend v Next.js a Reactu. Příkazy spouštěj z kořene repozitáře.

| Část | Odpovědnost |
| --- | --- |
| `src/app` | Routy a serverové hranice |
| `src/core` | Sdílené UI, shell, autentizace a API klient |
| `src/modules` | Konkrétní views, layouty, hooky a části obrazovek |
| `public/brand` | Tokeny a generované podklady identity |

```sh
pnpm web:dev
```

Před prvním spuštěním připrav prostředí a API klienta podle
[vývojového návodu](../../docs/development.md).

[Architektura](../../docs/architecture.md) ·
[Vizuální identita a UI](../../docs/design-system.md) ·
[Testování](../../docs/testing.md#web) ·
[Nasazení](../../docs/deployment.md)
