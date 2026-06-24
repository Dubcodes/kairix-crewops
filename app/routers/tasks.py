from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..services.audit import audit_log

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[schemas.TaskOut])
def list_tasks(status: str | None = None, assigned_to_me: bool = False, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    query = db.query(models.Task)
    if status:
        query = query.filter(models.Task.status == status)
    if assigned_to_me:
        query = query.filter(models.Task.assigned_to_id == current_user.id)
    return query.order_by(models.Task.due_at.nulls_last(), models.Task.created_at.desc()).limit(100).all()


@router.post("", response_model=schemas.TaskOut)
def create_task(payload: schemas.TaskCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    task = models.Task(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(task)
    db.flush()
    audit_log(db, action="task.create", target_type="Task", target_id=task.id, actor=current_user, new_value=payload.model_dump(mode="json"), request=request)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}/status")
def update_task_status(task_id: str, status: str, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    old_status = task.status
    task.status = status
    task.updated_by_id = current_user.id
    if status == "Complete":
        task.completed_by_id = current_user.id
    audit_log(db, action="task.status_update", target_type="Task", target_id=task.id, actor=current_user, old_value={"status": old_status}, new_value={"status": status}, request=request)
    db.commit()
    return {"ok": True}

