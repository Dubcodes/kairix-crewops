from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import FINANCE_TAGS, can_access_finance, can_write_finance, has_any_tag, is_admin
from ..services.audit import audit_log
from ..services.sensitive_access import require_reauth
from ..services.serialization import model_to_dict, models_to_dicts

router = APIRouter(prefix="/finance", tags=["finance"])


def oversight_finance_access(user: models.User) -> bool:
    return not has_any_tag(user, FINANCE_TAGS)


@router.get("/budget-requests")
def list_budget_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_active_user),
    x_reauth_password: str | None = Header(default=None),
    x_access_reason: str | None = Header(default=None),
):
    if not can_access_finance(current_user):
        raise HTTPException(status_code=403, detail="Finance or governance access required")
    audit_reason = x_access_reason
    if oversight_finance_access(current_user):
        audit_reason = require_reauth(current_user, x_reauth_password, x_access_reason, "Finance access")
    audit_log(db, action="budget_request.list", target_type="BudgetRequest", actor=current_user, reason=audit_reason, sensitivity="Finance-sensitive", reauth_required=oversight_finance_access(current_user), notification_sent=is_admin(current_user) and oversight_finance_access(current_user))
    rows = db.query(models.BudgetRequest).order_by(models.BudgetRequest.created_at.desc()).limit(100).all()
    db.commit()
    return models_to_dicts(rows)


@router.post("/budget-requests")
def create_budget_request(payload: schemas.BudgetRequestCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    budget = models.BudgetRequest(**payload.model_dump(), requester_id=current_user.id, created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(budget)
    db.flush()
    audit_log(db, action="budget_request.create", target_type="BudgetRequest", target_id=budget.id, actor=current_user, new_value=payload.model_dump(), sensitivity="Finance-sensitive", request=request)
    db.commit()
    db.refresh(budget)
    return model_to_dict(budget)


@router.post("/budget-requests/{budget_id}/approve")
def approve_budget_request(
    budget_id: str,
    notes: str | None = None,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_active_user),
    x_reauth_password: str | None = Header(default=None),
    x_access_reason: str | None = Header(default=None),
):
    if not can_write_finance(current_user):
        raise HTTPException(status_code=403, detail="Finance approval access required")
    audit_reason = require_reauth(current_user, x_reauth_password, x_access_reason, "Finance approval access") if oversight_finance_access(current_user) else None
    budget = db.query(models.BudgetRequest).filter(models.BudgetRequest.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget request not found")
    old_status = budget.status
    budget.status = "Approved"
    budget.approved_by_id = current_user.id
    budget.approval_notes = notes
    audit_log(db, action="budget_request.approve", target_type="BudgetRequest", target_id=budget.id, actor=current_user, old_value={"status": old_status}, new_value={"status": budget.status, "notes": notes}, reason=audit_reason, sensitivity="Finance-sensitive", reauth_required=bool(audit_reason), request=request)
    db.commit()
    return {"ok": True}


@router.get("/records")
def list_finance_records(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_active_user),
    x_reauth_password: str | None = Header(default=None),
    x_access_reason: str | None = Header(default=None),
):
    if not can_access_finance(current_user):
        raise HTTPException(status_code=403, detail="Finance or governance access required")
    audit_reason = x_access_reason
    if oversight_finance_access(current_user):
        audit_reason = require_reauth(current_user, x_reauth_password, x_access_reason, "Finance access")
    audit_log(db, action="finance_record.list", target_type="FinanceRecord", actor=current_user, reason=audit_reason, sensitivity="Finance-sensitive", reauth_required=oversight_finance_access(current_user), notification_sent=is_admin(current_user) and oversight_finance_access(current_user))
    rows = db.query(models.FinanceRecord).order_by(models.FinanceRecord.created_at.desc()).limit(100).all()
    db.commit()
    return models_to_dicts(rows)


@router.post("/records")
def create_finance_record(
    payload: schemas.FinanceRecordCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_active_user),
    x_reauth_password: str | None = Header(default=None),
    x_access_reason: str | None = Header(default=None),
):
    if not can_write_finance(current_user):
        raise HTTPException(status_code=403, detail="Finance write access required")
    audit_reason = require_reauth(current_user, x_reauth_password, x_access_reason, "Finance write access") if oversight_finance_access(current_user) else None
    record = models.FinanceRecord(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(record)
    db.flush()
    audit_log(db, action="finance_record.create", target_type="FinanceRecord", target_id=record.id, actor=current_user, new_value=payload.model_dump(), reason=audit_reason, sensitivity="Finance-sensitive", reauth_required=bool(audit_reason), request=request)
    db.commit()
    db.refresh(record)
    return model_to_dict(record)
