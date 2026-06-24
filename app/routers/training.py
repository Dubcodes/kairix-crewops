from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..services.audit import audit_log

router = APIRouter(prefix="/training", tags=["training"])


@router.get("/workshops")
def list_workshops(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return db.query(models.WorkshopRecord).order_by(models.WorkshopRecord.created_at.desc()).limit(100).all()


@router.post("/workshops")
def create_workshop(payload: schemas.WorkshopRecordCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    workshop = models.WorkshopRecord(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(workshop)
    db.flush()
    audit_log(db, action="workshop.create", target_type="WorkshopRecord", target_id=workshop.id, actor=current_user, new_value=payload.model_dump(), request=request)
    db.commit()
    return workshop


@router.get("/records")
def list_training_records(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return db.query(models.TrainingRecord).order_by(models.TrainingRecord.created_at.desc()).limit(100).all()


@router.post("/records")
def create_training_record(payload: schemas.TrainingRecordCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    record = models.TrainingRecord(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(record)
    db.flush()
    audit_log(db, action="training_record.create", target_type="TrainingRecord", target_id=record.id, actor=current_user, new_value={"user_id": payload.user_id, "training_name": payload.training_name}, sensitivity="HR-only", request=request)
    db.commit()
    return record


@router.get("/skills")
def list_skills(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return db.query(models.Skill).order_by(models.Skill.name).limit(100).all()


@router.post("/skills")
def create_skill(payload: schemas.SkillCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    skill = models.Skill(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(skill)
    db.flush()
    audit_log(db, action="skill.create", target_type="Skill", target_id=skill.id, actor=current_user, new_value=payload.model_dump(), request=request)
    db.commit()
    return skill
