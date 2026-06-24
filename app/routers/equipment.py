from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..services.audit import audit_log
from ..services.serialization import model_to_dict, models_to_dicts

router = APIRouter(prefix="/equipment", tags=["equipment"])


@router.get("/items")
def list_equipment(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return models_to_dicts(db.query(models.EquipmentItem).order_by(models.EquipmentItem.name).limit(100).all())


@router.post("/items")
def create_equipment(payload: schemas.EquipmentCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    item = models.EquipmentItem(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(item)
    db.flush()
    audit_log(db, action="equipment_item.create", target_type="EquipmentItem", target_id=item.id, actor=current_user, new_value=payload.model_dump(), request=request)
    db.commit()
    db.refresh(item)
    return model_to_dict(item)


@router.get("/loans")
def list_loans(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return models_to_dicts(db.query(models.EquipmentLoanRequest).order_by(models.EquipmentLoanRequest.created_at.desc()).limit(100).all())


@router.post("/loans")
def create_loan_request(payload: schemas.EquipmentLoanCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    item = db.query(models.EquipmentItem).filter(models.EquipmentItem.id == payload.equipment_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Equipment item not found")
    loan = models.EquipmentLoanRequest(
        **payload.model_dump(),
        requester_id=current_user.id,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(loan)
    db.flush()
    audit_log(db, action="equipment_loan.create", target_type="EquipmentLoanRequest", target_id=loan.id, actor=current_user, new_value=payload.model_dump(mode="json"), request=request)
    db.commit()
    db.refresh(loan)
    return model_to_dict(loan)
