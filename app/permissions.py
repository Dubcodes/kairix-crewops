from sqlalchemy.orm import Session

from . import models


SYSTEM_TAGS: list[tuple[str, str, str, bool]] = [
    ("Administrator", "technical", "Technical/system administrator.", True),
    ("System Owner", "technical", "Overall system ownership.", True),
    ("Data Management", "technical", "Backups, restore requests, and data health.", True),
    ("Board Member", "governance", "Board oversight.", False),
    ("Founding Board Member", "governance", "Founding board status marker.", False),
    ("Chair", "governance", "Chair/governance oversight.", False),
    ("HR Trainee", "hr", "Draft or limited HR work.", True),
    ("HR Assistant", "hr", "Limited HR tasks.", True),
    ("HR Officer", "hr", "Normal HR records and processes.", True),
    ("HR Manager", "hr", "Top HR domain authority.", True),
    ("Finance Trainee", "finance", "Draft or limited finance work.", True),
    ("Finance Assistant", "finance", "Small finance tasks.", True),
    ("Finance Officer", "finance", "Finance workflow authority.", True),
    ("Finance Manager", "finance", "Top finance domain authority.", True),
    ("Treasurer", "finance", "Finance/governance oversight.", True),
    ("Project Manager", "operations", "Manage projects.", False),
    ("Project Lead", "operations", "Lead project work.", False),
    ("Department Lead", "operations", "Lead department work.", False),
    ("Team Lead", "operations", "Lead team work.", False),
    ("Workshop Leader", "operations", "Manage workshops.", False),
    ("Event Coordinator", "operations", "Create and manage events.", False),
    ("Attendance Manager", "operations", "Manage attendance.", False),
    ("Regional Coordinator", "operations", "Regional coordination.", False),
    ("Regional Manager", "operations", "Regional operations authority.", False),
    ("Equipment Submitter", "equipment", "Submit equipment records.", False),
    ("Equipment Reviewer", "equipment", "Review equipment records.", False),
    ("Equipment Manager", "equipment", "Manage equipment.", False),
    ("Gear Loan Approver", "equipment", "Approve gear loans.", False),
    ("Website Manager", "content", "Manage public/site content.", False),
    ("Content Manager", "content", "Manage content workflows.", False),
    ("Content Editor", "content", "Edit content.", False),
    ("Content Reviewer", "content", "Review content.", False),
    ("Message Moderator", "communication", "Moderate messages.", False),
    ("Newsletter Manager", "communication", "Manage announcements/newsletters.", False),
    ("Operations Admin", "administration", "Paperwork and operational administration.", False),
    ("Admin Clerk", "administration", "Clerical/admin processing.", False),
]

ADMIN_TAGS = {"Administrator", "System Owner"}
HR_TAGS = {"HR Trainee", "HR Assistant", "HR Officer", "HR Manager"}
HR_WRITE_TAGS = {"HR Officer", "HR Manager", "Administrator", "System Owner"}
FINANCE_TAGS = {"Finance Trainee", "Finance Assistant", "Finance Officer", "Finance Manager", "Treasurer"}
FINANCE_WRITE_TAGS = {"Finance Officer", "Finance Manager", "Treasurer", "Administrator", "System Owner"}


def seed_permission_tags(db: Session, actor_id: str | None = None) -> dict[str, models.PermissionTag]:
    existing = {tag.name: tag for tag in db.query(models.PermissionTag).all()}
    for name, category, description, sensitive in SYSTEM_TAGS:
        if name not in existing:
            tag = models.PermissionTag(
                name=name,
                category=category,
                description=description,
                grants_sensitive_access=sensitive,
                created_by_id=actor_id,
                updated_by_id=actor_id,
            )
            db.add(tag)
            existing[name] = tag
    db.flush()
    return existing


def user_tag_names(user: models.User) -> set[str]:
    return {assignment.permission_tag.name for assignment in user.permission_tags if assignment.permission_tag}


def has_any_tag(user: models.User, allowed: set[str]) -> bool:
    tags = user_tag_names(user)
    return bool(tags & allowed)


def is_admin(user: models.User) -> bool:
    return has_any_tag(user, ADMIN_TAGS)


def can_access_hr(user: models.User) -> bool:
    return is_admin(user) or has_any_tag(user, HR_TAGS)


def can_write_hr(user: models.User) -> bool:
    return has_any_tag(user, HR_WRITE_TAGS)


def can_access_finance(user: models.User) -> bool:
    return is_admin(user) or has_any_tag(user, FINANCE_TAGS | {"Board Member", "Founding Board Member", "Chair"})


def can_write_finance(user: models.User) -> bool:
    return has_any_tag(user, FINANCE_WRITE_TAGS)

