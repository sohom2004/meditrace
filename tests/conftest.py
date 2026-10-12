import asyncio
import os
import sys
from pathlib import Path
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Add backend to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Use SQLite in-memory or dedicated test db for tests
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_meditrace.db"
os.environ["APP_ENV"] = "test"

from app.db.init_db import init_db_and_seed
from app.db.session import Base, async_session_maker, engine
from app.main import app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await init_db_and_seed()
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    async with async_session_maker() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
