FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1 \
    PATH="/workspace/.venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:0.11.0 /uv /uvx /bin/

WORKDIR /workspace/apps/api

COPY pyproject.toml uv.lock /workspace/
COPY apps/api/pyproject.toml apps/api/README.md ./
RUN uv sync --frozen --no-dev --package api --no-install-project
COPY apps/api ./
RUN uv sync --frozen --no-dev --no-editable --package api

RUN groupadd --gid 10001 appuser \
    && useradd --uid 10001 --gid 10001 --create-home appuser \
    && mkdir -p /var/lib/bod/media \
    && chown -R appuser /var/lib/bod
USER appuser

EXPOSE 8000
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
