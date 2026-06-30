from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import has_any_tag
from ..services.serialization import model_to_dict, models_to_dicts
from ..services.xp_service import award_xp, get_next_level_progress, get_xp_settings

router = APIRouter(prefix="/xp", tags=["xp"])


def can_award_xp(user: models.User) -> bool:
    return has_any_tag(user, {"Administrator", "System Owner", "Operations Admin", "Project Manager", "Workshop Leader", "Attendance Manager"})


@router.get("/status")
def xp_status(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    settings = get_xp_settings(db)
    progress = get_next_level_progress(current_user.xp_total, settings.get("level_thresholds", [0]))
    return {"xp_total": current_user.xp_total, **progress}


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
    record = award_xp(
        db,
        user_id=payload.user_id,
        amount=payload.amount,
        reason=payload.reason,
        source_entity_type=payload.source_entity_type,
        source_entity_id=payload.source_entity_id,
        awarded_by_id=current_user.id,
        actor=current_user,
        request=request,
    )
    db.commit()
    db.refresh(record)
    return model_to_dict(record)
