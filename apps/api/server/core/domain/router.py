from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from server.core.exceptions import ErrorResponse

ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 422, 503)
}


class Pagination(BaseModel):
    model_config = ConfigDict(extra="forbid")
    offset: int = Field(default=0, ge=0, le=2_147_483_647)
    limit: int = Field(default=50, ge=1, le=100)
