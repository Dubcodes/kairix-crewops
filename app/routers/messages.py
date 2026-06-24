from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..services.audit import audit_log

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/threads")
def list_threads(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return db.query(models.MessageThread).order_by(models.MessageThread.updated_at.desc()).limit(100).all()


@router.post("/threads")
def create_thread(payload: schemas.MessageThreadCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    thread = models.MessageThread(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(thread)
    db.flush()
    audit_log(db, action="message_thread.create", target_type="MessageThread", target_id=thread.id, actor=current_user, new_value=payload.model_dump(), request=request)
    db.commit()
    return thread


@router.get("/threads/{thread_id}/messages")
def list_messages(thread_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return db.query(models.Message).filter(models.Message.thread_id == thread_id).order_by(models.Message.created_at).limit(200).all()


@router.post("/threads/{thread_id}/messages")
def create_message(thread_id: str, payload: schemas.MessageCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not db.query(models.MessageThread).filter(models.MessageThread.id == thread_id).first():
        raise HTTPException(status_code=404, detail="Thread not found")
    message = models.Message(thread_id=thread_id, sender_id=current_user.id, body=payload.body, created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(message)
    db.flush()
    audit_log(db, action="message.create", target_type="Message", target_id=message.id, actor=current_user, request=request)
    db.commit()
    return message

