from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from app.core.config import settings

Base = declarative_base()

# SQLite requires specific connect args for foreign keys and async operation
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
engine_kwargs = {}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True

engine = create_async_engine(settings.DATABASE_URL, echo=False, **engine_kwargs)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()

async def set_rls_care_profile(session: AsyncSession, care_profile_id: str | None) -> None:
    """Sets PostgreSQL Row-Level Security session context, or no-op on SQLite."""
    if not is_sqlite and care_profile_id:
        from sqlalchemy import text
        await session.execute(
            text("SET LOCAL app.current_care_profile_id = :pid"),
            {"pid": care_profile_id}
        )
