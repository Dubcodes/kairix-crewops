from sqlalchemy.orm import Session

from .. import models


def create_notification(
    db: Session,
    *,
    user_id: str,
    title: str,
    body: str | None,
    notification_type: str,
    target_type: str | None = None,
    target_id: str | None = None,
    target_url: str | None = None,
    actor_id: str | None = None,
) -> models.Notification:
    notification = models.Notification(
        user_id=user_id,
        title=title,
        body=body,
        notification_type=notification_type,
        target_type=target_type,
        target_id=target_id,
        target_url=target_url,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )
    db.add(notification)
    return notification
