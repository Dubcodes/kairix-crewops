from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import has_any_tag

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[schemas.AuditOut])
def list_audit_logs(target_type: str | None = None, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not has_any_tag(current_user, {"Administrator", "System Owner", "Board Member", "Founding Board Member", "Chair", "Data Management"}):
        raise HTTPException(status_code=403, detail="Audit access required")
    query = db.query(models.AuditLog)
    if target_type:
        query = query.filter(models.AuditLog.target_type == target_type)
    return query.order_by(models.AuditLog.created_at.desc()).limit(200).all()

