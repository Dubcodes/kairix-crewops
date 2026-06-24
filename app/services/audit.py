from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from .. import models


def audit_log(
    db: Session,
    *,
    action: str,
    target_type: str,
    target_id: str | None = None,
    actor: models.User | None = None,
    old_value: Any = None,
    new_value: Any = None,
    reason: str | None = None,
    sensitivity: str = "Internal",
    reauth_required: bool = False,
    notification_sent: bool = False,
    request: Request | None = None,
) -> models.AuditLog:
    entry = models.AuditLog(
        actor_user_id=actor.id if actor else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        old_value=old_value,
        new_value=new_value,
        reason=reason,
        sensitivity=sensitivity,
        reauth_required=reauth_required,
        notification_sent=notification_sent,
        ip_address=request.client.host if request and request.client else None,
    )
    db.add(entry)
    db.flush()
    return entry

