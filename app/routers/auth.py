from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..security import create_access_token, verify_password
from ..services.audit import audit_log

router = APIRouter(prefix="/auth", tags=["auth"])


def user_out(user: models.User) -> schemas.UserOut:
    return schemas.UserOut(
        id=user.id,
        created_at=user.created_at,
        updated_at=user.updated_at,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        account_status=user.account_status,
        member_type=user.member_type,
        xp_total=user.xp_total,
        level=user.level,
        permission_tags=[assignment.permission_tag.name for assignment in user.permission_tags if assignment.permission_tag],
    )


@router.post("/login", response_model=schemas.Token)
def login(form: OAuth2PasswordRequestForm = Depends(), request: Request = None, db: Session = Depends(get_db)):
    user = (
        db.query(models.User)
        .options(joinedload(models.User.permission_tags).joinedload(models.UserPermissionTag.permission_tag))
        .filter((models.User.username == form.username) | (models.User.email == form.username))
        .first()
    )
    if not user or not verify_password(form.password, user.hashed_password):
        audit_log(db, action="auth.login_failed", target_type="User", reason=form.username, request=request)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    if user.account_status not in {"Active", "Pending"}:
        raise HTTPException(status_code=403, detail="Account is not allowed to log in")

    audit_log(db, action="auth.login", target_type="User", target_id=user.id, actor=user, request=request)
    db.commit()
    return schemas.Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return user_out(current_user)

