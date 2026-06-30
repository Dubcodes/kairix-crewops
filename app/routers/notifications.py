from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import has_any_tag
from ..services.audit import audit_log
from ..services.notification_service import create_notification as create_notification_record
from ..services.serialization import model_to_dict, models_to_dicts

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(unread_only: bool = False, notification_type: str | None = None, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    query = db.query(models.Notification).filter(models.Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(models.Notification.read_at.is_(None))
    if notification_type:
        if notification_type == "task":
            query = query.filter(models.Notification.notification_type.like("task_%"))
        elif notification_type == "message":
            query = query.filter(models.Notification.notification_type == "message_received")
        else:
            query = query.filter(models.Notification.notification_type == notification_type)
    return models_to_dicts(query.order_by(models.Notification.created_at.desc()).limit(100).all())


@router.post("")
def create_notification(payload: schemas.NotificationCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not has_any_tag(current_user, {"Administrator", "System Owner", "Operations Admin", "Message Moderator", "Newsletter Manager"}):
        raise HTTPException(status_code=403, detail="Notification management access required")
    if not db.query(models.User).filter(models.User.id == payload.user_id).first():
        raise HTTPException(status_code=404, detail="User not found")
    notification = create_notification_record(db, **payload.model_dump(), actor_id=current_user.id)
    db.flush()
    audit_log(db, action="notification.create", target_type="Notification", target_id=notification.id, actor=current_user, new_value=payload.model_dump(), request=request)
    db.commit()
    db.refresh(notification)
    return model_to_dict(notification)


@router.post("/{notification_id}/read")
def mark_notification_read(notification_id: str, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    notification = db.query(models.Notification).filter(models.Notification.id == notification_id, models.Notification.user_id == current_user.id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.read_at = datetime.now(timezone.utc)
    audit_log(db, action="notification.read", target_type="Notification", target_id=notification.id, actor=current_user, request=request)
    db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all_notifications_read(request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    now = datetime.now(timezone.utc)
    rows = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.read_at.is_(None),
    ).all()
    for notification in rows:
        notification.read_at = now
        notification.updated_by_id = current_user.id
    audit_log(db, action="notification.read_all", target_type="Notification", actor=current_user, new_value={"count": len(rows)}, request=request)
    db.commit()
    return {"ok": True, "count": len(rows)}
