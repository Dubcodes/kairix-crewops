from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import can_access_finance, can_access_hr, is_admin
from ..services.audit import audit_log
from ..services.notification_service import create_notification
from ..services.task_assignment import resolve_task_assignees
from ..services.xp_service import award_xp, get_xp_settings

router = APIRouter(prefix="/tasks", tags=["tasks"])

DONE_STATUSES = {"Done", "Complete"}


def normalise_task_status(status: str | None) -> str | None:
    return "Done" if status == "Complete" else status


def can_manage_task(task: models.Task, user: models.User) -> bool:
    return is_admin(user) or task.created_by_id == user.id or user.id in task.assignee_ids


def _task_query(db: Session):
    return db.query(models.Task).options(joinedload(models.Task.assignees))


def _task_out(task: models.Task) -> schemas.TaskOut:
    return schemas.TaskOut.model_validate(task)


def _replace_assignees(
    db: Session,
    *,
    task: models.Task,
    direct_ids: list[str],
    assignment_groups: list,
    actor: models.User,
    notify_new: bool,
) -> None:
    resolved = resolve_task_assignees(
        db,
        direct_user_ids=direct_ids,
        assignment_groups=assignment_groups,
        actor=actor,
    )
    previous_ids = {assignment.user_id for assignment in task.assignees}
    task.assignees.clear()
    db.flush()
    for user_id, source_type, source_id in resolved:
        task.assignees.append(
            models.TaskAssignee(
                user_id=user_id,
                assignment_source_type=source_type,
                assignment_source_id=source_id,
                assigned_by_id=actor.id,
                created_by_id=actor.id,
                updated_by_id=actor.id,
            )
        )
        if notify_new and user_id not in previous_ids:
            due_text = f" Due {task.due_at.isoformat()}." if task.due_at else ""
            create_notification(
                db,
                user_id=user_id,
                title=task.title,
                body=f"{actor.display_name} assigned this task to you.{due_text}",
                notification_type="task_assigned",
                target_type="task",
                target_id=task.id,
                target_url=f"#tasks/{task.id}",
                actor_id=actor.id,
            )
    task.assigned_to_id = resolved[0][0] if resolved else None


@router.get("", response_model=list[schemas.TaskOut])
def list_tasks(status: str | None = None, assigned_to_me: bool = False, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    query = _task_query(db).outerjoin(models.TaskAssignee)
    own_task = or_(
        models.Task.created_by_id == current_user.id,
        models.TaskAssignee.user_id == current_user.id,
        models.Task.assigned_to_id == current_user.id,
    )
    if not is_admin(current_user):
        query = query.filter(or_(models.Task.visibility != "Private", own_task))
    if not can_access_hr(current_user):
        query = query.filter(
            models.Task.sensitivity != "HR-only",
            or_(models.Task.attached_entity_type.is_(None), func.lower(models.Task.attached_entity_type) != "hr"),
        )
    if not can_access_finance(current_user):
        query = query.filter(
            models.Task.sensitivity != "Finance-sensitive",
            or_(models.Task.attached_entity_type.is_(None), func.lower(models.Task.attached_entity_type) != "finance"),
        )
    if status:
        query = query.filter(models.Task.status == normalise_task_status(status))
    if assigned_to_me:
        query = query.filter(
            or_(models.TaskAssignee.user_id == current_user.id, models.Task.assigned_to_id == current_user.id)
        )
    tasks = query.distinct().order_by(models.Task.due_at.nulls_last(), models.Task.created_at.desc()).limit(100).all()
    return [_task_out(task) for task in tasks]


@router.post("", response_model=schemas.TaskOut)
def create_task(payload: schemas.TaskCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    values = payload.model_dump(exclude={"assignee_ids", "assignment_groups"})
    legacy_assignee = values.pop("assigned_to_id", None)
    task = models.Task(**values, created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(task)
    db.flush()
    direct_ids = list(payload.assignee_ids)
    if legacy_assignee and legacy_assignee not in direct_ids:
        direct_ids.insert(0, legacy_assignee)
    _replace_assignees(
        db,
        task=task,
        direct_ids=direct_ids,
        assignment_groups=payload.assignment_groups,
        actor=current_user,
        notify_new=True,
    )
    audit_log(
        db,
        action="task.create",
        target_type="Task",
        target_id=task.id,
        actor=current_user,
        new_value={**payload.model_dump(mode="json"), "resolved_assignee_ids": task.assignee_ids},
        notification_sent=bool(task.assignee_ids),
        request=request,
    )
    db.commit()
    task = _task_query(db).filter(models.Task.id == task.id).one()
    return _task_out(task)


@router.patch("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: str, payload: schemas.TaskUpdate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    task = _task_query(db).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not can_manage_task(task, current_user):
        raise HTTPException(status_code=403, detail="Only the task creator, an assignee, or an administrator can update this task")

    updates = payload.model_dump(exclude_unset=True, exclude={"assignee_ids", "assignment_groups"})
    if updates.get("status") in DONE_STATUSES | {"Halted"}:
        raise HTTPException(status_code=400, detail="Use the task status action for Done or Halted")
    if "status" in updates:
        updates["status"] = normalise_task_status(updates["status"])
    old_value = {
        "title": task.title,
        "assigned_to_id": task.assigned_to_id,
        "assignee_ids": task.assignee_ids,
        "due_at": task.due_at.isoformat() if task.due_at else None,
        "priority": task.priority,
        "status": task.status,
    }
    for key, value in updates.items():
        if key != "assigned_to_id":
            setattr(task, key, value)
    if payload.assignee_ids is not None or payload.assignment_groups is not None or "assigned_to_id" in updates:
        direct_ids = list(payload.assignee_ids or [])
        legacy_assignee = updates.get("assigned_to_id")
        if legacy_assignee and legacy_assignee not in direct_ids:
            direct_ids.insert(0, legacy_assignee)
        _replace_assignees(
            db,
            task=task,
            direct_ids=direct_ids,
            assignment_groups=payload.assignment_groups or [],
            actor=current_user,
            notify_new=True,
        )
    task.updated_by_id = current_user.id
    audit_log(
        db,
        action="task.update",
        target_type="Task",
        target_id=task.id,
        actor=current_user,
        old_value=old_value,
        new_value={**payload.model_dump(exclude_unset=True, mode="json"), "resolved_assignee_ids": task.assignee_ids},
        request=request,
    )
    db.commit()
    task = _task_query(db).filter(models.Task.id == task.id).one()
    return _task_out(task)


@router.patch("/{task_id}/status")
def update_task_status(task_id: str, status: str, reason: str | None = None, request: Request = None, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    task = _task_query(db).with_for_update().filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not can_manage_task(task, current_user):
        raise HTTPException(status_code=403, detail="Only the task creator, an assignee, or an administrator can update this task")

    now = datetime.now(timezone.utc)
    old_status = task.status
    new_status = normalise_task_status(status)
    if new_status == "Halted" and not reason:
        raise HTTPException(status_code=400, detail="Halted tasks require a short reason")

    xp_record = None
    notification_sent = False
    if new_status == "Done":
        if task.status in DONE_STATUSES:
            return {"ok": True, "already_done": True, "xp_awarded": False}
        task.completed_by_id = current_user.id
        task.completed_at = now
        task.halted_by_id = None
        task.halted_at = None
        task.halted_reason = None
        for assignment in task.assignees:
            assignment.status = "Completed"
            assignment.completed_at = now
            assignment.updated_by_id = current_user.id
        is_assignee = current_user.id in task.assignee_ids
        if is_assignee and not task.xp_awarded_record_id:
            xp_settings = get_xp_settings(db)
            amount = task.xp_value or int(xp_settings.get("task_default", 5))
            if amount > 0:
                xp_record = award_xp(
                    db,
                    user_id=current_user.id,
                    amount=amount,
                    reason=f"Completed task: {task.title}",
                    source_entity_type="Task",
                    source_entity_id=task.id,
                    awarded_by_id=current_user.id,
                    actor=current_user,
                    request=request,
                )
                task.xp_awarded_record_id = xp_record.id
        if task.created_by_id and task.created_by_id != current_user.id:
            create_notification(
                db,
                user_id=task.created_by_id,
                title=f"Task completed: {task.title}",
                body=f"{current_user.display_name} marked this task Done.",
                notification_type="task_completed",
                target_type="task",
                target_id=task.id,
                target_url=f"#tasks/{task.id}",
                actor_id=current_user.id,
            )
            notification_sent = True
    elif new_status == "Halted":
        task.completed_by_id = None
        task.completed_at = None
        task.halted_by_id = current_user.id
        task.halted_at = now
        task.halted_reason = reason
        for assignment in task.assignees:
            assignment.status = "Halted"
            assignment.updated_by_id = current_user.id
        if task.created_by_id and task.created_by_id != current_user.id:
            create_notification(
                db,
                user_id=task.created_by_id,
                title=f"Task halted: {task.title}",
                body=f"{current_user.display_name}: {reason}",
                notification_type="task_halted",
                target_type="task",
                target_id=task.id,
                target_url=f"#tasks/{task.id}",
                actor_id=current_user.id,
            )
            notification_sent = True
    else:
        task.completed_by_id = None
        task.completed_at = None
        if new_status != "Halted":
            task.halted_by_id = None
            task.halted_at = None
            task.halted_reason = None
        for assignment in task.assignees:
            assignment.status = "Assigned"
            assignment.completed_at = None
            assignment.updated_by_id = current_user.id

    task.status = new_status
    task.updated_by_id = current_user.id
    audit_log(
        db,
        action="task.status_update",
        target_type="Task",
        target_id=task.id,
        actor=current_user,
        old_value={"status": old_status},
        new_value={
            "status": new_status,
            "completed_by_id": task.completed_by_id,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "halted_by_id": task.halted_by_id,
            "halted_at": task.halted_at.isoformat() if task.halted_at else None,
            "xp_record_id": xp_record.id if xp_record else None,
        },
        reason=reason,
        notification_sent=notification_sent,
        request=request,
    )
    db.commit()
    return {"ok": True, "xp_awarded": bool(xp_record), "xp_record_id": xp_record.id if xp_record else None}
