from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import is_admin
from ..services.audit import audit_log

router = APIRouter(prefix="/tasks", tags=["tasks"])


def can_manage_task(task: models.Task, user: models.User) -> bool:
    return is_admin(user) or task.created_by_id == user.id or task.assigned_to_id == user.id


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


@router.patch("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: str, payload: schemas.TaskUpdate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not can_manage_task(task, current_user):
        raise HTTPException(status_code=403, detail="Only the task creator, assignee, or administrator can update this task")

    old_value = {
        "title": task.title,
        "description": task.description,
        "assigned_to_id": task.assigned_to_id,
        "due_at": task.due_at.isoformat() if task.due_at else None,
        "priority": task.priority,
        "status": task.status,
    }
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(task, key, value)
    if updates.get("status") == "Complete":
        task.completed_by_id = current_user.id
    elif "status" in updates and updates["status"] != "Complete":
        task.completed_by_id = None
    task.updated_by_id = current_user.id
    audit_log(db, action="task.update", target_type="Task", target_id=task.id, actor=current_user, old_value=old_value, new_value=payload.model_dump(exclude_unset=True, mode="json"), request=request)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}/status")
def update_task_status(task_id: str, status: str, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not can_manage_task(task, current_user):
        raise HTTPException(status_code=403, detail="Only the task creator, assignee, or administrator can update this task")
    old_status = task.status
    task.status = status
    task.updated_by_id = current_user.id
    if status == "Complete":
        task.completed_by_id = current_user.id
    else:
        task.completed_by_id = None
    audit_log(db, action="task.status_update", target_type="Task", target_id=task.id, actor=current_user, old_value={"status": old_status}, new_value={"status": status}, request=request)
    db.commit()
    return {"ok": True}
