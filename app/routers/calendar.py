from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..services.audit import audit_log
from ..services.serialization import model_to_dict

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events", response_model=list[schemas.EventOut])
def list_events(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return db.query(models.CalendarEvent).order_by(models.CalendarEvent.starts_at).limit(100).all()


@router.post("/events", response_model=schemas.EventOut)
def create_event(payload: schemas.EventCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    event = models.CalendarEvent(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(event)
    db.flush()
    audit_log(db, action="calendar_event.create", target_type="CalendarEvent", target_id=event.id, actor=current_user, new_value=payload.model_dump(mode="json"), request=request)
    db.commit()
    db.refresh(event)
    return event


@router.post("/events/{event_id}/attendance")
def record_attendance(event_id: str, user_id: str | None = None, visitor_id: str | None = None, status: str = "Attended", request: Request = None, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not user_id and not visitor_id:
        raise HTTPException(status_code=400, detail="user_id or visitor_id is required")
    event = db.query(models.CalendarEvent).filter(models.CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    attendance = models.EventAttendance(event_id=event_id, user_id=user_id, visitor_id=visitor_id, status=status, created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(attendance)
    db.flush()
    audit_log(db, action="attendance.record", target_type="EventAttendance", target_id=attendance.id, actor=current_user, new_value={"event_id": event_id, "user_id": user_id, "visitor_id": visitor_id, "status": status}, request=request)
    db.commit()
    db.refresh(attendance)
    return model_to_dict(attendance)
