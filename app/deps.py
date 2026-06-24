from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt import InvalidTokenError
from sqlalchemy.orm import Session, joinedload

from . import models
from .database import get_db
from .security import decode_access_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise credentials_error
    except InvalidTokenError as exc:
        raise credentials_error from exc

    user = (
        db.query(models.User)
        .options(joinedload(models.User.permission_tags).joinedload(models.UserPermissionTag.permission_tag))
        .filter(models.User.id == user_id)
        .first()
    )
    if not user or user.account_status not in {"Active", "Pending"}:
        raise credentials_error
    return user


def require_active_user(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.account_status != "Active":
        raise HTTPException(status_code=403, detail="Account is not active")
    return current_user

