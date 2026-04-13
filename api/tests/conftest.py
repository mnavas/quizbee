"""
Test configuration and shared fixtures.

Requires a running PostgreSQL instance. In CI this is provided by the
postgres service container declared in .github/workflows/ci.yml.
Locally, run:  docker compose up -d db
and set TEST_DATABASE_URL in your environment (or .env.test).

The test DB is distinct from the dev DB to prevent data contamination.
"""

import asyncio
import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import Base, get_db
from app.main import app
from app.models.core import Tenant, User  # noqa: F401 — ensure models are registered
from app.auth import hash_password

# ── Database URL ──────────────────────────────────────────────────────────────

TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://quizbee:quizbee@localhost:5432/quizbee_test",
)

# ── Engine & session factory ──────────────────────────────────────────────────

test_engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


# ── Schema management ─────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    """Single event loop for the whole session — required for session-scoped async fixtures."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    """Create all tables at session start; drop them at session end."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ── DB session fixture ────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def db() -> AsyncSession:
    """
    Per-test DB session. Uses a dedicated test database so isolation is achieved
    by the session-scoped create_tables / drop_all rather than per-test rollback.
    Each test creates data with unique UUIDs so there are no cross-test conflicts.
    """
    async with TestSessionLocal() as session:
        yield session


# ── App client fixture ────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncClient:
    """AsyncClient wired to the FastAPI app with the test DB session."""
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ── Tenant + admin user fixture ───────────────────────────────────────────────

@pytest_asyncio.fixture
async def admin_token(client: AsyncClient, db: AsyncSession) -> str:
    """
    Create a tenant + admin user, log in, return the JWT access token.
    Each test that uses this fixture gets a fresh isolated user.
    """
    import uuid
    suffix = uuid.uuid4().hex[:8]

    tenant = Tenant(name=f"test-tenant-{suffix}", slug=f"test-{suffix}")
    db.add(tenant)
    await db.flush()

    user = User(
        tenant_id=tenant.id,
        email=f"admin-{suffix}@test.com",
        password_hash=hash_password("testpass123"),
        role="admin",
        is_active=True,
    )
    db.add(user)
    await db.commit()

    resp = await client.post("/api/v1/auth/login", json={
        "email": f"admin-{suffix}@test.com",
        "password": "testpass123",
    })
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]
