from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..permissions import has_any_tag
from ..services.audit import audit_log
from ..services.serialization import model_to_dict, models_to_dicts

router = APIRouter(prefix="/forms", tags=["forms"])


def can_manage_forms(user: models.User) -> bool:
    return has_any_tag(user, {"Administrator", "System Owner", "Operations Admin", "Content Manager", "Content Editor"})


@router.get("/definitions")
def list_form_definitions(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return models_to_dicts(db.query(models.FormDefinition).order_by(models.FormDefinition.created_at.desc()).limit(100).all())


@router.post("/definitions")
def create_form_definition(payload: schemas.FormDefinitionCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not can_manage_forms(current_user):
        raise HTTPException(status_code=403, detail="Form management access required")
    form_data = payload.model_dump()
    form_data["schema"] = form_data.pop("json_schema")
    form = models.FormDefinition(**form_data, created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(form)
    db.flush()
    audit_log(db, action="form_definition.create", target_type="FormDefinition", target_id=form.id, actor=current_user, new_value=form_data, request=request)
    db.commit()
    db.refresh(form)
    return model_to_dict(form)


@router.get("/submissions")
def list_form_submissions(form_definition_id: str | None = None, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    query = db.query(models.FormSubmission)
    if form_definition_id:
        query = query.filter(models.FormSubmission.form_definition_id == form_definition_id)
    return models_to_dicts(query.order_by(models.FormSubmission.created_at.desc()).limit(100).all())


@router.post("/submissions")
def create_form_submission(payload: schemas.FormSubmissionCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not db.query(models.FormDefinition).filter(models.FormDefinition.id == payload.form_definition_id).first():
        raise HTTPException(status_code=404, detail="Form definition not found")
    submission = models.FormSubmission(
        **payload.model_dump(exclude={"submitted_by_user_id"}),
        submitted_by_user_id=payload.submitted_by_user_id or current_user.id,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(submission)
    db.flush()
    audit_log(db, action="form_submission.create", target_type="FormSubmission", target_id=submission.id, actor=current_user, new_value={"form_definition_id": payload.form_definition_id, "status": payload.status}, request=request)
    db.commit()
    db.refresh(submission)
    return model_to_dict(submission)
