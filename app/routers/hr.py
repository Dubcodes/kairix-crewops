from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import HR_TAGS, can_access_hr, can_write_hr, has_any_tag, is_admin
from ..services.audit import audit_log
from ..services.serialization import model_to_dict, models_to_dicts

router = APIRouter(prefix="/hr", tags=["hr"])


@router.get("/records")
def list_hr_records(reason: str | None = None, request: Request = None, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not can_access_hr(current_user):
        raise HTTPException(status_code=403, detail="HR access required")
    emergency = is_admin(current_user) and not has_any_tag(current_user, HR_TAGS)
    audit_log(
        db,
        action="hr_record.list",
        target_type="HRRecord",
        actor=current_user,
        reason=reason,
        sensitivity="HR-only",
        reauth_required=emergency,
        notification_sent=emergency,
        request=request,
    )
    db.commit()
    return models_to_dicts(db.query(models.HRRecord).order_by(models.HRRecord.created_at.desc()).limit(100).all())


@router.post("/records")
def create_hr_record(payload: schemas.HRRecordCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not can_write_hr(current_user):
        raise HTTPException(status_code=403, detail="HR write access required")
    record = models.HRRecord(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(record)
    db.flush()
    audit_log(db, action="hr_record.create", target_type="HRRecord", target_id=record.id, actor=current_user, new_value={"user_id": payload.user_id, "record_type": payload.record_type, "title": payload.title}, sensitivity="HR-only", request=request)
    db.commit()
    db.refresh(record)
    return model_to_dict(record)
