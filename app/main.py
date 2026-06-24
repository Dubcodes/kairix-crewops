from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import init_db
from .routers import announcements, audit, auth, backups, calendar, equipment, files, finance, health, hr, messages, org, projects, setup, tasks, training, users, visitors

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=static_dir), name="static")

app.include_router(health.router, prefix="/api")
app.include_router(setup.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(org.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(visitors.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(training.router, prefix="/api")
app.include_router(equipment.router, prefix="/api")
app.include_router(finance.router, prefix="/api")
app.include_router(hr.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(announcements.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(backups.router, prefix="/api")


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.backup_dir).mkdir(parents=True, exist_ok=True)


@app.get("/")
def index():
    return FileResponse(static_dir / "index.html")
