# bod API

FastAPI služba pro školní informační systém bod. Python balíček se jmenuje `server`.

## Příkazy

```bash
uv sync
uv run uvicorn server.main:app --reload
uv run python -m server.openapi ../../docs/openapi.json
```

OpenAPI schéma se generuje z FastAPI aplikace a spotřebovává ho balíček `packages/api-client`.
