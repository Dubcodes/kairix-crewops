from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import HR_TAGS, can_access_hr, can_write_hr, has_any_tag, is_admin
from ..services.audit import audit_log
from ..services.sensitive_access import require_reauth
from ..services.serialization import model_to_dict, models_to_dicts

router = APIRouter(prefix="/hr", tags=["hr"])


def admin_emergency_hr_access(user: models.User) -> bool:
    return is_admin(user) and not has_any_tag(user, HR_TAGS)


@router.get("/records")
def list_hr_records(
    reason: str | None = None,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_active_user),
    x_reauth_password: str | None = Header(default=None),
    x_access_reason: str | None = Header(default=None),
):
    if not can_access_hr(current_user):
        raise HTTPException(status_code=403, detail="HR access required")
    emergency = admin_emergency_hr_access(current_user)
    audit_reason = reason or x_access_reason
    if emergency:
        audit_reason = require_reauth(current_user, x_reauth_password, audit_reason, "Emergency HR access")
    audit_log(
        db,
        action="hr_record.list",
        target_type="HRRecord",
        actor=current_user,
        reason=audit_reason,
        sensitivity="HR-only",
        reauth_required=emergency,
        notification_sent=emergency,
        request=request,
    )
    db.commit()
    return models_to_dicts(db.query(models.HRRecord).order_by(models.HRRecord.created_at.desc()).limit(100).all())


@router.post("/records")
def create_hr_record(
    payload: schemas.HRRecordCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_active_user),
    x_reauth_password: str | None = Header(default=None),
    x_access_reason: str | None = Header(default=None),
):
    if not can_write_hr(current_user):
        raise HTTPException(status_code=403, detail="HR write access required")
    emergency = admin_emergency_hr_access(current_user)
    audit_reason = require_reauth(current_user, x_reauth_password, x_access_reason, "Emergency HR write access") if emergency else None
    record = models.HRRecord(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(record)
    db.flush()
    audit_log(
        db,
        action="hr_record.create",
        target_type="HRRecord",
        target_id=record.id,
        actor=current_user,
        new_value={"user_id": payload.user_id, "record_type": payload.record_type, "title": payload.title},
        reason=audit_reason,
        sensitivity="HR-only",
        reauth_required=emergency,
        notification_sent=emergency,
        request=request,
    )
    db.commit()
    db.refresh(record)
    return model_to_dict(record)
