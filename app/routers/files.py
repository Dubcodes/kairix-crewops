import hashlib
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import get_settings
from ..database import get_db
from ..deps import require_active_user
from ..services.audit import audit_log
from ..services.serialization import model_to_dict, models_to_dicts

router = APIRouter(prefix="/files", tags=["files"])
settings = get_settings()


@router.get("/records")
def list_file_records(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return models_to_dicts(db.query(models.FileRecord).order_by(models.FileRecord.created_at.desc()).limit(100).all())


@router.post("/records")
def create_file_record(payload: schemas.FileRecordCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    record = models.FileRecord(**payload.model_dump(), uploaded_by_id=current_user.id, created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(record)
    db.flush()
    audit_log(db, action="file_record.create", target_type="FileRecord", target_id=record.id, actor=current_user, new_value=payload.model_dump(), sensitivity=payload.sensitivity, request=request)
    db.commit()
    db.refresh(record)
    return model_to_dict(record)


@router.post("/upload")
def upload_file(
    request: Request,
    upload: UploadFile = File(...),
    label: str | None = Form(default=None),
    attached_entity_type: str | None = Form(default=None),
    attached_entity_id: str | None = Form(default=None),
    sensitivity: str = Form(default="Internal"),
    visibility: str = Form(default="Internal"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_active_user),
):
    original_name = upload.filename or "upload.bin"
    storage_dir = Path(settings.upload_dir) / current_user.id
    storage_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4()}{Path(original_name).suffix}"
    destination = storage_dir / stored_name
    digest = hashlib.sha256()
    with destination.open("wb") as output:
        while chunk := upload.file.read(1024 * 1024):
            digest.update(chunk)
            output.write(chunk)

    record = models.FileRecord(
        local_path=str(destination),
        original_filename=original_name,
        label=label,
        file_type=upload.content_type,
        attached_entity_type=attached_entity_type,
        attached_entity_id=attached_entity_id,
        uploaded_by_id=current_user.id,
        sensitivity=sensitivity,
        visibility=visibility,
        source_provider="direct_upload",
        local_copy=True,
        checksum=digest.hexdigest(),
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(record)
    db.flush()
    audit_log(db, action="file.upload", target_type="FileRecord", target_id=record.id, actor=current_user, new_value={"original_filename": original_name, "sensitivity": sensitivity}, sensitivity=sensitivity, request=request)
    db.commit()
    db.refresh(record)
    return model_to_dict(record)


@router.get("/links")
def list_links(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return models_to_dicts(db.query(models.LinkRecord).order_by(models.LinkRecord.created_at.desc()).limit(100).all())


@router.post("/links")
def create_link(payload: schemas.LinkRecordCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    link = models.LinkRecord(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(link)
    db.flush()
    audit_log(db, action="link_record.create", target_type="LinkRecord", target_id=link.id, actor=current_user, new_value=payload.model_dump(), request=request)
    db.commit()
    db.refresh(link)
    return model_to_dict(link)
