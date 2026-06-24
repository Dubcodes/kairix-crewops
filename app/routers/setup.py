from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..permissions import seed_permission_tags
from ..security import create_access_token, get_password_hash
from ..services.audit import audit_log
from ..services.bootstrap import DEFAULT_SETTINGS, seed_defaults, upsert_setting

router = APIRouter(prefix="/setup", tags=["setup"])


@router.get("/status", response_model=schemas.SetupStatus)
def setup_status(db: Session = Depends(get_db)):
    org = db.query(models.Organisation).first()
    return schemas.SetupStatus(setup_complete=bool(org and org.setup_complete), organisation_name=org.name if org else None)


@router.post("/complete", response_model=schemas.Token)
def complete_setup(payload: schemas.SetupRequest, request: Request, db: Session = Depends(get_db)):
    existing = db.query(models.Organisation).first()
    if existing and existing.setup_complete:
        raise HTTPException(status_code=409, detail="Setup has already been completed")

    if db.query(models.User).filter(models.User.username == payload.admin_username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    if db.query(models.User).filter(models.User.email == payload.admin_email).first():
        raise HTTPException(status_code=409, detail="Email already exists")

    org = existing or models.Organisation(name=payload.organisation_name, short_name=payload.organisation_short_name)
    org.name = payload.organisation_name
    org.short_name = payload.organisation_short_name
    org.website_url = payload.website_url
    org.country = payload.country
    org.timezone = payload.timezone
    org.setup_complete = True
    db.add(org)
    db.flush()

    admin = models.User(
        username=payload.admin_username,
        email=str(payload.admin_email),
        display_name=payload.admin_display_name,
        hashed_password=get_password_hash(payload.admin_password),
        account_status="Active",
        member_type="Member",
    )
    db.add(admin)
    db.flush()

    tags = seed_permission_tags(db, actor_id=admin.id)
    for tag_name in ("Administrator", "System Owner", "Data Management"):
        db.add(models.UserPermissionTag(user_id=admin.id, permission_tag_id=tags[tag_name].id, assigned_reason="Initial setup"))

    for region_name in payload.default_regions:
        clean_name = region_name.strip()
        if clean_name and not db.query(models.Region).filter(models.Region.name == clean_name).first():
            db.add(models.Region(name=clean_name, created_by_id=admin.id, updated_by_id=admin.id))

    seed_defaults(db, actor_id=admin.id)

    merged_settings = dict(DEFAULT_SETTINGS)
    if payload.enabled_modules is not None:
        merged_settings["enabled_modules"] = payload.enabled_modules
    if payload.xp_settings is not None:
        merged_settings["xp_settings"] = payload.xp_settings
    if payload.finance_approval_thresholds is not None:
        merged_settings["finance_approval_thresholds"] = payload.finance_approval_thresholds
    merged_settings["onboarding_mode"] = payload.onboarding_mode

    for key, value in merged_settings.items():
        category = "modules" if key == "enabled_modules" else "settings"
        upsert_setting(db, org.id, key, value, category, actor_id=admin.id)

    audit_log(db, action="setup.complete", target_type="Organisation", target_id=org.id, actor=admin, request=request)
    db.commit()
    return schemas.Token(access_token=create_access_token(admin.id))

