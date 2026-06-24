from fastapi import HTTPException

from .. import models
from ..security import verify_password


def require_reauth(user: models.User, password: str | None, reason: str | None, detail: str) -> str:
    clean_reason = (reason or "").strip()
    if not clean_reason:
        raise HTTPException(status_code=403, detail=f"{detail}: access reason required")
    if not password or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=403, detail=f"{detail}: password re-entry required")
    return clean_reason
