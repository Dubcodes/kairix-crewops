from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import has_any_tag
from ..services.audit import audit_log
from ..services.serialization import model_to_dict, models_to_dicts

router = APIRouter(prefix="/xp", tags=["xp"])


def can_award_xp(user: models.User) -> bool:
    return has_any_tag(user, {"Administrator", "System Owner", "Operations Admin", "Project Manager", "Workshop Leader", "Attendance Manager"})


@router.get("/records")
def list_xp_records(user_id: str | None = None, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    query = db.query(models.XPRecord)
    if user_id:
        query = query.filter(models.XPRecord.user_id == user_id)
    return models_to_dicts(query.order_by(models.XPRecord.created_at.desc()).limit(100).all())


@router.post("/records")
def create_xp_record(payload: schemas.XPRecordCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not can_award_xp(current_user):
        raise HTTPException(status_code=403, detail="XP award access required")
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    record = models.XPRecord(**payload.model_dump(), awarded_by_id=current_user.id, created_by_id=current_user.id, updated_by_id=current_user.id)
    user.xp_total += payload.amount
    user.level = max(1, user.xp_total // 100 + 1)
    db.add(record)
    db.flush()
    audit_log(db, action="xp.award", target_type="XPRecord", target_id=record.id, actor=current_user, new_value=payload.model_dump(), request=request)
    db.commit()
    db.refresh(record)
    return model_to_dict(record)
