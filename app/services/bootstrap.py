from sqlalchemy.orm import Session

from .. import models
from ..permissions import seed_permission_tags


DEFAULT_PROJECT_TYPES = {
    "Film": ["Director", "Producer", "DP", "Camera Operator", "Gaffer", "Sound Recordist", "Editor", "Actor", "Runner"],
    "Workshop": ["Workshop Leader", "Workshop Assistant", "Peer Tutor", "Attendee"],
    "Event": ["Event Coordinator", "Event Assistant", "Attendance Manager"],
    "Administration": ["Project Lead", "Operations Admin", "Reviewer"],
}

DEFAULT_SENSITIVITIES = [
    ("Public", "Visible to the public.", False, False),
    ("Member-visible", "Visible to authenticated members.", False, False),
    ("Internal", "Internal operational information.", False, False),
    ("Confidential", "Restricted confidential information.", True, True),
    ("HR-only", "HR-controlled private people records.", True, True),
    ("Finance-sensitive", "Finance-controlled sensitive records.", True, True),
    ("Admin-restricted", "Administrator/data-management restricted records.", True, True),
    ("Emergency-access-only", "Break-glass access only with reason and audit.", True, True),
]

DEFAULT_SETTINGS = {
    "enabled_modules": [
        "dashboard",
        "calendar",
        "projects",
        "tasks",
        "members",
        "visitors",
        "teams_regions",
        "training",
        "equipment",
        "finance",
        "hr",
        "messages",
        "notifications",
        "announcements",
        "xp",
        "forms",
        "files",
        "integrations",
        "audit",
        "settings",
    ],
    "onboarding_mode": "region_approval",
    "xp_settings": {"task_default": 5, "attendance_default": 3, "new_member_level_threshold": 2, "level_thresholds": [0, 50, 150, 300, 600]},
    "finance_approval_thresholds": {
        "Finance Assistant": 100,
        "Finance Officer": 500,
        "Finance Manager": 2000,
        "Treasurer": 5000,
        "Board Required Above": 5000,
    },
    "privacy_defaults": {"search_visibility": "members", "message_privacy": "members"},
}


def seed_defaults(db: Session, actor_id: str | None = None) -> None:
    seed_permission_tags(db, actor_id=actor_id)

    for name, suggestions in DEFAULT_PROJECT_TYPES.items():
        exists = db.query(models.ProjectType).filter(models.ProjectType.name == name).first()
        if not exists:
            db.add(models.ProjectType(name=name, default_role_suggestions=suggestions, created_by_id=actor_id, updated_by_id=actor_id))

    for name, description, sensitive, reauth in DEFAULT_SENSITIVITIES:
        exists = db.query(models.DataSensitivity).filter(models.DataSensitivity.name == name).first()
        if not exists:
            db.add(
                models.DataSensitivity(
                    name=name,
                    description=description,
                    is_sensitive=sensitive,
                    requires_reauth=reauth,
                    created_by_id=actor_id,
                    updated_by_id=actor_id,
                )
            )

    db.flush()


def upsert_setting(db: Session, organisation_id: str, key: str, value, category: str, actor_id: str | None = None) -> models.OrganisationSetting:
    setting = (
        db.query(models.OrganisationSetting)
        .filter(models.OrganisationSetting.organisation_id == organisation_id, models.OrganisationSetting.key == key)
        .first()
    )
    if setting:
        setting.value = value
        setting.category = category
        setting.updated_by_id = actor_id
    else:
        setting = models.OrganisationSetting(
            organisation_id=organisation_id,
            key=key,
            value=value,
            category=category,
            created_by_id=actor_id,
            updated_by_id=actor_id,
        )
        db.add(setting)
    db.flush()
    return setting
