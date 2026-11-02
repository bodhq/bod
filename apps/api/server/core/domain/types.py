"""Portable representation of the Monday constraint; production is PostgreSQL."""

from typing import Any

from sqlalchemy import Boolean, literal_column
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql.functions import FunctionElement


class MondayCheck(FunctionElement[bool]):
    type = Boolean()
    inherit_cache = True

    def __init__(self, name: str) -> None:
        super().__init__(literal_column(name))


@compiles(MondayCheck)
def compile_monday(element: MondayCheck, compiler: Any, **kw: Any) -> str:
    value = compiler.process(list(element.clauses)[0], **kw)
    return f"extract(isodow FROM {value}) = 1"


@compiles(MondayCheck, "sqlite")
def compile_sqlite_monday(element: MondayCheck, compiler: Any, **kw: Any) -> str:
    value = compiler.process(list(element.clauses)[0], **kw)
    return f"strftime('%w', {value}) = '1'"
