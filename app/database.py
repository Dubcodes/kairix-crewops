from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models

    Base.metadata.create_all(bind=engine)
    _run_additive_migrations()

    db = SessionLocal()
    try:
        legacy_tasks = db.query(models.Task).filter(models.Task.assigned_to_id.is_not(None)).all()
        for task in legacy_tasks:
            exists = db.query(models.TaskAssignee).filter(
                models.TaskAssignee.task_id == task.id,
                models.TaskAssignee.user_id == task.assigned_to_id,
            ).first()
            if not exists:
                db.add(
                    models.TaskAssignee(
                        task_id=task.id,
                        user_id=task.assigned_to_id,
                        assignment_source_type="direct",
                        assigned_by_id=task.created_by_id or task.assigned_to_id,
                        created_by_id=task.created_by_id,
                        updated_by_id=task.updated_by_id,
                    )
                )
        db.commit()
    finally:
        db.close()


def _run_additive_migrations() -> None:
    additions = {
        "tasks": {
            "completed_at": "TIMESTAMP",
            "halted_by_id": "VARCHAR(36)",
            "halted_at": "TIMESTAMP",
            "halted_reason": "TEXT",
            "xp_awarded_record_id": "VARCHAR(36)",
            "assignment_mode": "VARCHAR(40) DEFAULT 'first_completer'",
        },
        "notifications": {
            "target_type": "VARCHAR(80)",
            "target_id": "VARCHAR(36)",
        },
    }
    with engine.begin() as connection:
        inspector = inspect(connection)
        existing_tables = set(inspector.get_table_names())
        for table, columns in additions.items():
            if table not in existing_tables:
                continue
            existing_columns = {column["name"] for column in inspector.get_columns(table)}
            for name, sql_type in columns.items():
                if name not in existing_columns:
                    connection.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {sql_type}'))
