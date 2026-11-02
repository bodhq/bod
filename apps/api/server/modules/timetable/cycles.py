"""Custom weekly recurrence. Calendar overrides never shift subsequent phases."""

from datetime import date, timedelta
from typing import Any
from uuid import UUID

from server.core.domain.services import require


def cycle_type(anchor: date, monday: date, steps: list[dict[str, Any]]) -> UUID:
    ordered = sorted(steps, key=lambda step: step["position"])
    require(bool(ordered), "Cyklus musí mít alespoň jeden krok.")
    require(
        [s["position"] for s in ordered] == list(range(1, len(ordered) + 1)),
        "Pozice kroků cyklu musí tvořit souvislou řadu od 1.",
    )
    duration = sum(step["duration_weeks"] for step in ordered)
    require(duration > 0, "Cyklus musí mít kladnou délku.")
    offset = ((monday - anchor).days // 7) % duration
    for step in ordered:
        if offset < step["duration_weeks"]:
            result: UUID = step["cycle_week_id"]
            return result
        offset -= step["duration_weeks"]
    raise ValueError("Invalid cycle")


def mondays(start: date, end: date) -> list[date]:
    current = start - timedelta(days=start.weekday())
    result = []
    while current < end:
        result.append(current)
        current += timedelta(days=7)
    return result
