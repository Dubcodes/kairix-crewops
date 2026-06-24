from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..services.audit import audit_log
from ..services.serialization import model_to_dict, models_to_dicts

router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("")
def list_announcements(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return models_to_dicts(db.query(models.Announcement).order_by(models.Announcement.created_at.desc()).limit(100).all())


@router.post("")
def create_announcement(payload: schemas.AnnouncementCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    published_at = datetime.now(timezone.utc) if payload.status == "Published" else None
    announcement = models.Announcement(**payload.model_dump(), published_at=published_at, created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(announcement)
    db.flush()
    audit_log(db, action="announcement.create", target_type="Announcement", target_id=announcement.id, actor=current_user, new_value=payload.model_dump(), request=request)
    db.commit()
    db.refresh(announcement)
    return model_to_dict(announcement)
