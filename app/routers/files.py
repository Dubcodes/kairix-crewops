from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..services.audit import audit_log
from ..services.serialization import model_to_dict, models_to_dicts

router = APIRouter(prefix="/files", tags=["files"])


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
