"""Run the same invariants with PostgreSQL row and advisory locks in CI."""

import pytest
from . import test_access

pytestmark = pytest.mark.postgres


def test_concurrent_bootstrap(db_engine):
    test_access.test_concurrent_bootstrap_creates_only_one_admin(db_engine)


def test_concurrent_admin_deactivation(admin):
    test_access.test_concurrent_admin_deactivation_preserves_one_admin(admin)


def test_normalized_username_lookup_can_use_index(db_engine):
    from sqlalchemy import text

    with db_engine.begin() as connection:
        # Check index eligibility even on the tiny, empty fixture table.
        connection.execute(text("SET LOCAL enable_seqscan = off"))
        plan = (
            connection.execute(
                text("EXPLAIN SELECT * FROM users WHERE username = 'normalized.user'")
            )
            .scalars()
            .all()
        )
        assert any("Index" in line for line in plan), plan
