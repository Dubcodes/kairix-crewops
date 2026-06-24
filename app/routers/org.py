from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import is_admin
from ..services.audit import audit_log
from ..services.bootstrap import upsert_setting

router = APIRouter(prefix="/org", tags=["organisation"])


@router.get("", response_model=schemas.OrganisationOut)
def get_organisation(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    org = db.query(models.Organisation).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation has not been configured")
    return org


@router.patch("", response_model=schemas.OrganisationOut)
def update_organisation(
    payload: schemas.OrganisationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_active_user),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Administrator or System Owner required")
    org = db.query(models.Organisation).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation has not been configured")
    old = {"name": org.name, "short_name": org.short_name, "website_url": org.website_url}
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    org.updated_by_id = current_user.id
    audit_log(db, action="organisation.update", target_type="Organisation", target_id=org.id, actor=current_user, old_value=old, new_value=payload.model_dump(exclude_unset=True), request=request)
    db.commit()
    db.refresh(org)
    return org


@router.get("/settings")
def list_settings(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    org = db.query(models.Organisation).first()
    if not org:
        return {}
    rows = db.query(models.OrganisationSetting).filter(models.OrganisationSetting.organisation_id == org.id).all()
    return {row.key: row.value for row in rows}


@router.put("/settings")
def put_setting(
    payload: schemas.SettingUpsert,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_active_user),
):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Administrator or System Owner required")
    org = db.query(models.Organisation).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation has not been configured")
    setting = upsert_setting(db, org.id, payload.key, payload.value, payload.category, actor_id=current_user.id)
    audit_log(db, action="organisation_setting.upsert", target_type="OrganisationSetting", target_id=setting.id, actor=current_user, new_value=payload.model_dump(), request=request)
    db.commit()
    return {"key": setting.key, "value": setting.value, "category": setting.category}


@router.get("/permissions")
def list_permission_tags(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    rows = db.query(models.PermissionTag).order_by(models.PermissionTag.category, models.PermissionTag.name).all()
    return rows


@router.get("/regions", response_model=list[schemas.RegionOut])
def list_regions(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return db.query(models.Region).order_by(models.Region.name).all()


@router.post("/regions", response_model=schemas.RegionOut)
def create_region(payload: schemas.RegionCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Administrator or System Owner required")
    region = models.Region(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(region)
    db.flush()
    audit_log(db, action="region.create", target_type="Region", target_id=region.id, actor=current_user, new_value=payload.model_dump(), request=request)
    db.commit()
    db.refresh(region)
    return region


@router.get("/teams", response_model=list[schemas.TeamOut])
def list_teams(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return db.query(models.Team).order_by(models.Team.name).all()


@router.post("/teams", response_model=schemas.TeamOut)
def create_team(payload: schemas.TeamCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Administrator or System Owner required")
    team = models.Team(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(team)
    db.flush()
    audit_log(db, action="team.create", target_type="Team", target_id=team.id, actor=current_user, new_value=payload.model_dump(), request=request)
    db.commit()
    db.refresh(team)
    return team

