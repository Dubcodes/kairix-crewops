from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..services.audit import audit_log

router = APIRouter(prefix="/visitors", tags=["visitors"])


@router.get("", response_model=list[schemas.VisitorOut])
def list_visitors(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return db.query(models.Visitor).order_by(models.Visitor.created_at.desc()).limit(100).all()


@router.post("", response_model=schemas.VisitorOut)
def create_visitor(payload: schemas.VisitorCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    visitor = models.Visitor(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(visitor)
    db.flush()
    audit_log(db, action="visitor.create", target_type="Visitor", target_id=visitor.id, actor=current_user, new_value=payload.model_dump(), request=request)
    db.commit()
    db.refresh(visitor)
    return visitor


@router.post("/{visitor_id}/link/{user_id}")
def link_visitor(visitor_id: str, user_id: str, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    visitor = db.query(models.Visitor).filter(models.Visitor.id == visitor_id).first()
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not visitor or not user:
        raise HTTPException(status_code=404, detail="Visitor or user not found")
    visitor.linked_user_id = user.id
    visitor.updated_by_id = current_user.id
    audit_log(db, action="visitor.link_user", target_type="Visitor", target_id=visitor.id, actor=current_user, new_value={"user_id": user.id}, request=request)
    db.commit()
    return {"ok": True}

