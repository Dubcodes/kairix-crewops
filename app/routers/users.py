from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import FINANCE_TAGS, HR_TAGS, can_access_finance, can_access_hr, is_admin, seed_permission_tags, user_tag_names
from ..routers.auth import user_out
from ..security import get_password_hash
from ..services.audit import audit_log

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[schemas.UserOut])
def list_users(q: str | None = None, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    query = db.query(models.User).options(joinedload(models.User.permission_tags).joinedload(models.UserPermissionTag.permission_tag))
    if not is_admin(current_user):
        query = query.filter(
            or_(
                models.User.id == current_user.id,
                (models.User.search_visibility != "private") & (models.User.message_privacy != "private"),
            )
        )
    if q:
        if len(q.strip()) < 2:
            return []
        like = f"%{q}%"
        query = query.filter((models.User.display_name.ilike(like)) | (models.User.username.ilike(like)) | (models.User.email.ilike(like)))
    users = query.order_by(models.User.display_name).limit(100).all()
    if not is_admin(current_user):
        hidden_system_tags = {"Administrator", "System Owner", "Data Management"}
        can_see_hr = can_access_hr(current_user)
        can_see_finance = can_access_finance(current_user)
        users = [
            user
            for user in users
            if user.id == current_user.id
            or not (
                user_tag_names(user) & hidden_system_tags
                or (user_tag_names(user) & HR_TAGS and not can_see_hr)
                or (user_tag_names(user) & FINANCE_TAGS and not can_see_finance)
            )
        ]
    return [user_out(user) for user in users]


@router.post("", response_model=schemas.UserOut)
def create_user(payload: schemas.UserCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Administrator or System Owner required")
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    user = models.User(
        username=payload.username,
        email=str(payload.email),
        display_name=payload.display_name,
        hashed_password=get_password_hash(payload.password),
        account_status=payload.account_status,
        member_type=payload.member_type,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(user)
    db.flush()
    tags = seed_permission_tags(db, actor_id=current_user.id)
    for tag_name in payload.permission_tags:
        tag = tags.get(tag_name)
        if tag:
            db.add(models.UserPermissionTag(user_id=user.id, permission_tag_id=tag.id, created_by_id=current_user.id, updated_by_id=current_user.id))
    audit_log(db, action="user.create", target_type="User", target_id=user.id, actor=current_user, new_value=payload.model_dump(exclude={"password"}), request=request)
    db.commit()
    db.refresh(user)
    user = db.query(models.User).options(joinedload(models.User.permission_tags).joinedload(models.UserPermissionTag.permission_tag)).filter(models.User.id == user.id).one()
    return user_out(user)


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: str, payload: schemas.UserUpdate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not is_admin(current_user) and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    old = {field: getattr(user, field) for field in payload.model_dump(exclude_unset=True)}
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    user.updated_by_id = current_user.id
    audit_log(db, action="user.update", target_type="User", target_id=user.id, actor=current_user, old_value=old, new_value=payload.model_dump(exclude_unset=True), request=request)
    db.commit()
    user = db.query(models.User).options(joinedload(models.User.permission_tags).joinedload(models.UserPermissionTag.permission_tag)).filter(models.User.id == user_id).one()
    return user_out(user)


@router.post("/{user_id}/permission-tags/{tag_name}")
def add_permission_tag(user_id: str, tag_name: str, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Administrator or System Owner required")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    tags = seed_permission_tags(db, actor_id=current_user.id)
    tag = tags.get(tag_name)
    if not tag:
        raise HTTPException(status_code=404, detail="Permission tag not found")
    existing = db.query(models.UserPermissionTag).filter(models.UserPermissionTag.user_id == user_id, models.UserPermissionTag.permission_tag_id == tag.id).first()
    if not existing:
        db.add(models.UserPermissionTag(user_id=user_id, permission_tag_id=tag.id, assigned_reason="Manual assignment", created_by_id=current_user.id, updated_by_id=current_user.id))
    audit_log(db, action="permission_tag.add", target_type="User", target_id=user_id, actor=current_user, new_value={"tag": tag_name}, request=request)
    db.commit()
    return {"ok": True}
