from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1.api import api_router
from app.core.config import settings
from app.core.errors import MediTraceError
from app.db.init_db import init_db_and_seed

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schemas and seeds on startup
    await init_db_and_seed()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version="2.1.0",
    description="MediTrace 2.1 — Longitudinal Medical Record & Grounded Clinical Assistant Modular Monolith",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API v1 router
app.include_router(api_router, prefix="/api")

@app.exception_handler(MediTraceError)
async def meditrace_error_handler(request: Request, exc: MediTraceError):
    status_code = status.HTTP_400_BAD_REQUEST
    if exc.code == "AUTHORIZATION_DENIED":
        status_code = status.HTTP_403_FORBIDDEN
    elif exc.code == "NOT_FOUND":
        status_code = status.HTTP_404_NOT_FOUND

    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details
            }
        }
    )

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": "2.1.0",
        "env": settings.APP_ENV
    }

# Mount built frontend SPA if available
from pathlib import Path
from fastapi.staticfiles import StaticFiles

frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
else:
    @app.get("/")
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": "2.1.0",
            "docs_url": "/docs"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)

