from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from .. import models
from .audit import audit_log


DEFAULT_XP_SETTINGS = {
    "task_default": 5,
    "attendance_default": 3,
    "new_member_level_threshold": 2,
    "level_thresholds": [0, 50, 150, 300, 600],
}


def get_xp_settings(db: Session) -> dict:
    org = db.query(models.Organisation).first()
    if not org:
        return dict(DEFAULT_XP_SETTINGS)
    setting = db.query(models.OrganisationSetting).filter(
        models.OrganisationSetting.organisation_id == org.id,
        models.OrganisationSetting.key == "xp_settings",
    ).first()
    configured = setting.value if setting and isinstance(setting.value, dict) else {}
    return {**DEFAULT_XP_SETTINGS, **configured}


def calculate_level(xp_total: int, level_thresholds: list[int]) -> int:
    thresholds = sorted({int(value) for value in level_thresholds if int(value) >= 0}) or [0]
    return max(1, sum(1 for threshold in thresholds if xp_total >= threshold))


def get_next_level_progress(xp_total: int, level_thresholds: list[int]) -> dict:
    thresholds = sorted({int(value) for value in level_thresholds if int(value) >= 0}) or [0]
    current_level = calculate_level(xp_total, thresholds)
    current_threshold = thresholds[min(current_level - 1, len(thresholds) - 1)]
    if current_level >= len(thresholds):
        return {"level": current_level, "progress": 100, "remaining": 0}
    next_threshold = thresholds[current_level]
    span = max(1, next_threshold - current_threshold)
    progress = max(0, min(100, round(((xp_total - current_threshold) / span) * 100)))
    return {"level": current_level, "progress": progress, "remaining": max(0, next_threshold - xp_total)}


def award_xp(
    db: Session,
    *,
    user_id: str,
    amount: int,
    reason: str,
    source_entity_type: str | None = None,
    source_entity_id: str | None = None,
    awarded_by_id: str | None = None,
    actor: models.User | None = None,
    request: Request | None = None,
) -> models.XPRecord:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    record = models.XPRecord(
        user_id=user_id,
        amount=amount,
        reason=reason,
        source_entity_type=source_entity_type,
        source_entity_id=source_entity_id,
        awarded_by_id=awarded_by_id,
        created_by_id=awarded_by_id,
        updated_by_id=awarded_by_id,
    )
    user.xp_total += amount
    settings = get_xp_settings(db)
    user.level = calculate_level(user.xp_total, settings.get("level_thresholds", [0]))
    user.updated_by_id = awarded_by_id
    db.add(record)
    db.flush()
    audit_log(
        db,
        action="xp.award",
        target_type="XPRecord",
        target_id=record.id,
        actor=actor,
        new_value={
            "user_id": user_id,
            "amount": amount,
            "reason": reason,
            "source_entity_type": source_entity_type,
            "source_entity_id": source_entity_id,
            "xp_total": user.xp_total,
            "level": user.level,
        },
        request=request,
    )
    return record
