from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import require_active_user
from ..services.audit import audit_log
from ..services.serialization import model_to_dict

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    return db.query(models.Project).order_by(models.Project.created_at.desc()).limit(100).all()


@router.post("", response_model=schemas.ProjectOut)
def create_project(payload: schemas.ProjectCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    project = models.Project(**payload.model_dump(), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(project)
    db.flush()
    audit_log(db, action="project.create", target_type="Project", target_id=project.id, actor=current_user, new_value=payload.model_dump(mode="json"), request=request)
    db.commit()
    db.refresh(project)
    return project


@router.patch("/{project_id}", response_model=schemas.ProjectOut)
def update_project(project_id: str, payload: schemas.ProjectCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    old = {"title": project.title, "status": project.status}
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    project.updated_by_id = current_user.id
    audit_log(db, action="project.update", target_type="Project", target_id=project.id, actor=current_user, old_value=old, new_value=payload.model_dump(mode="json"), request=request)
    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/role-slots")
def create_role_slot(project_id: str, payload: schemas.RoleSlotCreate, request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    if not db.query(models.Project).filter(models.Project.id == project_id).first():
        raise HTTPException(status_code=404, detail="Project not found")
    title = payload.title.strip().title()
    slot = models.ProjectRoleSlot(project_id=project_id, title=title, **payload.model_dump(exclude={"title"}), created_by_id=current_user.id, updated_by_id=current_user.id)
    db.add(slot)
    db.flush()
    audit_log(db, action="project_role_slot.create", target_type="ProjectRoleSlot", target_id=slot.id, actor=current_user, new_value=payload.model_dump(), request=request)
    db.commit()
    db.refresh(slot)
    return model_to_dict(slot)


@router.get("/role-suggestions")
def role_suggestions(project_type: str | None = None, q: str | None = None, db: Session = Depends(get_db), current_user: models.User = Depends(require_active_user)):
    suggestions: set[str] = set()
    query = db.query(models.ProjectType)
    if project_type:
        query = query.filter(models.ProjectType.name.ilike(project_type))
    for row in query.all():
        suggestions.update(row.default_role_suggestions or [])
    suggestions.update(title for (title,) in db.query(models.ProjectRoleSlot.title).distinct().all())
    ordered = sorted(suggestions)
    if q:
        needle = q.lower()
        ordered = [item for item in ordered if needle in item.lower()]
    return ordered[:20]
