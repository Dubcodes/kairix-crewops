from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..permissions import can_access_finance, can_access_hr, has_any_tag, is_admin


TASK_ASSIGNMENT_TAGS = {
    "Board Member",
    "Founding Board Member",
    "Chair",
    "Operations Admin",
    "Regional Manager",
    "Regional Coordinator",
    "Project Manager",
    "Project Lead",
    "Workshop Leader",
    "Event Coordinator",
    "HR Officer",
    "HR Manager",
    "Finance Officer",
    "Finance Manager",
    "Treasurer",
}


def can_assign_to_others(user: models.User) -> bool:
    return is_admin(user) or has_any_tag(user, TASK_ASSIGNMENT_TAGS)


def _validate_group_access(user: models.User, source_type: str, source_id: str, db: Session) -> None:
    if not can_assign_to_others(user):
        raise HTTPException(status_code=403, detail="Task assignment access required")
    if source_type == "permission_tag":
        tag = db.query(models.PermissionTag).filter(models.PermissionTag.id == source_id).first()
        if not tag:
            raise HTTPException(status_code=404, detail="Permission tag not found")
        if tag.category == "hr" and not can_access_hr(user):
            raise HTTPException(status_code=403, detail="HR assignment access required")
        if tag.category == "finance" and not can_access_finance(user):
            raise HTTPException(status_code=403, detail="Finance assignment access required")


def resolve_task_assignees(
    db: Session,
    *,
    direct_user_ids: list[str],
    assignment_groups: list,
    actor: models.User,
) -> list[tuple[str, str, str | None]]:
    resolved: dict[str, tuple[str, str | None]] = {}
    unique_direct = list(dict.fromkeys(user_id for user_id in direct_user_ids if user_id))
    if unique_direct:
        users = db.query(models.User).filter(models.User.id.in_(unique_direct), models.User.account_status.in_(["Active", "Pending"])).all()
        found = {user.id for user in users}
        missing = [user_id for user_id in unique_direct if user_id not in found]
        if missing:
            raise HTTPException(status_code=400, detail="One or more assignees are unavailable")
        if any(user_id != actor.id for user_id in unique_direct) and not can_assign_to_others(actor):
            raise HTTPException(status_code=403, detail="You may only assign tasks to yourself")
        for user_id in unique_direct:
            resolved[user_id] = ("direct", None)

    for group in assignment_groups:
        source_type = group.source_type
        source_id = group.source_id
        _validate_group_access(actor, source_type, source_id, db)
        if source_type == "region":
            ids = [row.user_id for row in db.query(models.UserRegion).filter(models.UserRegion.region_id == source_id).all()]
        elif source_type == "team":
            ids = [row.user_id for row in db.query(models.UserTeam).filter(models.UserTeam.team_id == source_id).all()]
        elif source_type == "permission_tag":
            ids = [row.user_id for row in db.query(models.UserPermissionTag).filter(models.UserPermissionTag.permission_tag_id == source_id).all()]
        elif source_type == "project":
            ids = [row.user_id for row in db.query(models.ProjectAssignment).filter(models.ProjectAssignment.project_id == source_id, models.ProjectAssignment.user_id.is_not(None)).all()]
        elif source_type == "event":
            ids = [row.user_id for row in db.query(models.EventAttendance).filter(models.EventAttendance.event_id == source_id, models.EventAttendance.user_id.is_not(None)).all()]
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported assignment group: {source_type}")
        for user_id in ids:
            resolved.setdefault(user_id, (source_type, source_id))

    return [(user_id, source[0], source[1]) for user_id, source in resolved.items()]
