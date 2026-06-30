from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import is_admin
from ..services.audit import audit_log
from ..services.notification_service import create_notification
from ..services.serialization import model_to_dict, models_to_dicts

router = APIRouter(prefix="/messages", tags=["messages"])


def _thread_query(db: Session):
    return db.query(models.MessageThread).options(joinedload(models.MessageThread.participants))


def _can_access_thread(thread: models.MessageThread, user: models.User) -> bool:
    return is_admin(user) or thread.created_by_id == user.id or user.id in thread.participant_ids


def _thread_dict(thread: models.MessageThread, db: Session, user: models.User) -> dict:
    data = model_to_dict(thread)
    data["participant_ids"] = thread.participant_ids
    participant = next((row for row in thread.participants if row.user_id == user.id), None)
    message_query = db.query(models.Message).filter(models.Message.thread_id == thread.id)
    latest = message_query.order_by(models.Message.created_at.desc()).first()
    unread_query = message_query.filter(models.Message.sender_id != user.id)
    if participant and participant.last_read_at:
        unread_query = unread_query.filter(models.Message.created_at > participant.last_read_at)
    data["unread_count"] = unread_query.count() if participant else 0
    data["latest_message"] = latest.body[:180] if latest else None
    data["latest_message_at"] = latest.created_at if latest else thread.updated_at
    return data


@router.get("/threads")
def list_threads(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    query = _thread_query(db)
    if not is_admin(current_user):
        query = query.outerjoin(models.MessageThreadParticipant).filter(
            or_(
                models.MessageThreadParticipant.user_id == current_user.id,
                models.MessageThread.created_by_id == current_user.id,
            )
        ).distinct()
    threads = query.order_by(models.MessageThread.updated_at.desc()).limit(100).all()
    return [_thread_dict(thread, db, current_user) for thread in threads]


@router.post("/threads")
def create_thread(payload: schemas.MessageThreadCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    participant_ids = list(dict.fromkeys([current_user.id, *payload.participant_ids]))
    users = db.query(models.User).filter(
        models.User.id.in_(participant_ids),
        models.User.account_status.in_(["Active", "Pending"]),
    ).all()
    if len(users) != len(participant_ids):
        raise HTTPException(status_code=400, detail="One or more recipients are unavailable")
    values = payload.model_dump(exclude={"participant_ids"})
    thread = models.MessageThread(**values, created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(thread)
    db.flush()
    for user_id in participant_ids:
        thread.participants.append(
            models.MessageThreadParticipant(
                user_id=user_id,
                role="owner" if user_id == current_user.id else "member",
                created_by_id=current_user.id,
                updated_by_id=current_user.id,
            )
        )
    audit_log(
        db,
        action="message_thread.create",
        target_type="MessageThread",
        target_id=thread.id,
        actor=current_user,
        new_value={**payload.model_dump(), "participant_ids": participant_ids},
        request=request,
    )
    db.commit()
    thread = _thread_query(db).filter(models.MessageThread.id == thread.id).one()
    return _thread_dict(thread, db, current_user)


@router.get("/threads/{thread_id}/messages")
def list_messages(thread_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    thread = _thread_query(db).filter(models.MessageThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if not _can_access_thread(thread, current_user):
        raise HTTPException(status_code=403, detail="Conversation access required")
    return models_to_dicts(db.query(models.Message).filter(models.Message.thread_id == thread_id).order_by(models.Message.created_at).limit(200).all())


@router.post("/threads/{thread_id}/messages")
def create_message(thread_id: str, payload: schemas.MessageCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    thread = _thread_query(db).filter(models.MessageThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if not _can_access_thread(thread, current_user):
        raise HTTPException(status_code=403, detail="Conversation access required")
    message = models.Message(thread_id=thread_id, sender_id=current_user.id, body=payload.body, created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(message)
    db.flush()
    recipients = [participant.user_id for participant in thread.participants if participant.user_id != current_user.id and participant.status == "Active"]
    for user_id in recipients:
        create_notification(
            db,
            user_id=user_id,
            title=thread.title,
            body=f"{current_user.display_name}: {payload.body[:180]}",
            notification_type="message_received",
            target_type="message_thread",
            target_id=thread.id,
            target_url=f"#messages/{thread.id}",
            actor_id=current_user.id,
        )
    thread.updated_by_id = current_user.id
    audit_log(
        db,
        action="message.create",
        target_type="Message",
        target_id=message.id,
        actor=current_user,
        request=request,
        notification_sent=bool(recipients),
    )
    db.commit()
    db.refresh(message)
    return model_to_dict(message)


@router.post("/threads/{thread_id}/read")
def mark_thread_read(thread_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    participant = db.query(models.MessageThreadParticipant).filter(
        models.MessageThreadParticipant.thread_id == thread_id,
        models.MessageThreadParticipant.user_id == current_user.id,
    ).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Conversation participant not found")
    participant.last_read_at = datetime.now(timezone.utc)
    participant.updated_by_id = current_user.id
    db.commit()
    return {"ok": True}
