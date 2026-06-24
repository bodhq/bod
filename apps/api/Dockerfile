FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy

COPY --from=ghcr.io/astral-sh/uv:0.11.0 /uv /uvx /bin/

WORKDIR /workspace/apps/api

COPY pyproject.toml uv.lock /workspace/
COPY apps/api/pyproject.toml apps/api/README.md ./
RUN uv sync --frozen --no-dev --package api --no-install-project
COPY apps/api ./

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
