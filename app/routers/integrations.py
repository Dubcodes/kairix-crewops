from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import is_admin
from ..services.audit import audit_log
from ..services.serialization import model_to_dict, models_to_dicts

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/connections")
def list_connections(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Administrator or System Owner required")
    return models_to_dicts(db.query(models.IntegrationConnection).order_by(models.IntegrationConnection.created_at.desc()).limit(100).all())


@router.post("/connections")
def create_connection(payload: schemas.IntegrationConnectionCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Administrator or System Owner required")
    connection = models.IntegrationConnection(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(connection)
    db.flush()
    audit_log(db, action="integration_connection.create", target_type="IntegrationConnection", target_id=connection.id, actor=current_user, new_value={"provider": payload.provider, "display_name": payload.display_name, "status": payload.status}, sensitivity="Admin-restricted", request=request)
    db.commit()
    db.refresh(connection)
    return model_to_dict(connection)
