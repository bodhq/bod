# Řešení potíží

Příkazy spouštěj z kořene repozitáře. Základní nastavení popisuje
[lokální vývoj](development.md).

### Importy ve VS Code / Pylance

Otevři jako workspace kořen `bod`, aby se načetl `pyrightconfig.json`.
V paletě příkazů vyber **Python: Select Interpreter** a nastav
`<kořen projektu>/.venv/bin/python`. Po změně konfigurace spusť
**Python: Restart Language Server**. Konfigurace obsahuje cesty `apps/api`
a `tests/api`, takže importy `server.*` z testů vedou na skutečný backend.

Ověření instalace z kořene projektu:

```sh
uv run python -c 'import server; print(server.__file__)'
```

Pokud tento příkaz na macOS hlásí chybějící modul i po `uv sync`, zkontroluj
`ls -lO .venv/lib/python*/site-packages/*api*.pth`. Python přeskakuje `.pth`
s příznakem `hidden`; tento příznak lze odstranit příkazem:

```sh
chflags nohidden .venv/lib/python*/site-packages/_editable_impl_api.pth
```

### Převod profilovek a dostupnost databáze

SQLite je určeno pro automatické testy. Údržbový příkaz
`python -m server.scripts.convert_avatars` pracuje s databází z `.env`
a vyžaduje dostupný PostgreSQL. `Connection refused` na portu 5433 znamená,
že server na nastavené adrese nepřijímá připojení.

Spusť Docker Desktop a z kořene projektu:

```sh
docker compose -f infra/docker-compose.dev.yml up -d --wait db redis
(cd apps/api && uv run python -m server.scripts.convert_avatars)
```

Při nedostupné databázi nejprve ověř její adresu a stav služby;
SQLite nepoužívej jako náhradní provozní úložiště.
