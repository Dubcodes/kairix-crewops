from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import has_any_tag
from ..services.audit import audit_log

router = APIRouter(prefix="/backups", tags=["backups"])


def require_data_management(user: models.User) -> None:
    if not has_any_tag(user, {"Data Management", "Administrator", "System Owner"}):
        raise HTTPException(status_code=403, detail="Data Management access required")


@router.get("")
def list_backups(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    require_data_management(current_user)
    return db.query(models.BackupRecord).order_by(models.BackupRecord.created_at.desc()).limit(100).all()


@router.post("")
def create_backup_record(payload: schemas.BackupRecordCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    require_data_management(current_user)
    backup = models.BackupRecord(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(backup)
    db.flush()
    audit_log(db, action="backup.record", target_type="BackupRecord", target_id=backup.id, actor=current_user, new_value=payload.model_dump(), sensitivity="Admin-restricted", request=request)
    db.commit()
    return backup


@router.post("/{backup_id}/verify")
def verify_backup(backup_id: str, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    require_data_management(current_user)
    backup = db.query(models.BackupRecord).filter(models.BackupRecord.id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    backup.status = "Verified"
    backup.verified_at = datetime.now(timezone.utc)
    audit_log(db, action="backup.verify", target_type="BackupRecord", target_id=backup.id, actor=current_user, sensitivity="Admin-restricted", request=request)
    db.commit()
    return {"ok": True}

