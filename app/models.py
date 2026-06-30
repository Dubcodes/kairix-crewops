import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class IntegrationMixin:
    source: Mapped[str] = mapped_column(String(80), default="crewops")
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sync_status: Mapped[str] = mapped_column(String(40), default="local")
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ActorMixin:
    created_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)


class EntityMixin(TimestampMixin, IntegrationMixin, ActorMixin):
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)


class Organisation(EntityMixin, Base):
    __tablename__ = "organisations"

    name: Mapped[str] = mapped_column(String(200))
    short_name: Mapped[str] = mapped_column(String(80))
    website_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_file_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    favicon_file_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    country: Mapped[str] = mapped_column(String(80), default="New Zealand")
    timezone: Mapped[str] = mapped_column(String(80), default="Pacific/Auckland")
    setup_complete: Mapped[bool] = mapped_column(Boolean, default=False)

    settings: Mapped[list["OrganisationSetting"]] = relationship(back_populates="organisation")


class OrganisationSetting(EntityMixin, Base):
    __tablename__ = "organisation_settings"
    __table_args__ = (UniqueConstraint("organisation_id", "key", name="uq_org_setting_key"),)

    organisation_id: Mapped[str] = mapped_column(String(36), ForeignKey("organisations.id"))
    key: Mapped[str] = mapped_column(String(120))
    value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSON, nullable=True)
    category: Mapped[str] = mapped_column(String(80), default="general")

    organisation: Mapped[Organisation] = relationship(back_populates="settings")


class User(EntityMixin, Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(200))
    hashed_password: Mapped[str] = mapped_column(String(255))
    account_status: Mapped[str] = mapped_column(String(40), default="Active")
    member_type: Mapped[str] = mapped_column(String(60), default="Member")
    xp_total: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    search_visibility: Mapped[str] = mapped_column(String(40), default="members")
    message_privacy: Mapped[str] = mapped_column(String(40), default="members")
    avatar_file_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(80), nullable=True)
    emergency_contact: Mapped[str | None] = mapped_column(Text, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delete_after_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    permission_tags: Mapped[list["UserPermissionTag"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserPermissionTag.user_id",
    )
    regions: Mapped[list["UserRegion"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserRegion.user_id",
    )
    teams: Mapped[list["UserTeam"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserTeam.user_id",
    )


class Visitor(EntityMixin, Base):
    __tablename__ = "visitors"

    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    associated_region_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("regions.id"), nullable=True)
    associated_team_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("teams.id"), nullable=True)
    source_event_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("calendar_events.id"), nullable=True)
    source_project_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("projects.id"), nullable=True)
    linked_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    newsletter_tier: Mapped[str | None] = mapped_column(String(60), nullable=True)


class PermissionTag(EntityMixin, Base):
    __tablename__ = "permission_tags"

    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(80), default="general")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    grants_sensitive_access: Mapped[bool] = mapped_column(Boolean, default=False)


class UserPermissionTag(EntityMixin, Base):
    __tablename__ = "user_permission_tags"
    __table_args__ = (UniqueConstraint("user_id", "permission_tag_id", name="uq_user_permission_tag"),)

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    permission_tag_id: Mapped[str] = mapped_column(String(36), ForeignKey("permission_tags.id"))
    scope_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    scope_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    assigned_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped[User] = relationship(back_populates="permission_tags", foreign_keys=[user_id])
    permission_tag: Mapped[PermissionTag] = relationship()


class Region(EntityMixin, Base):
    __tablename__ = "regions"

    name: Mapped[str] = mapped_column(String(160), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_region_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("regions.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Team(EntityMixin, Base):
    __tablename__ = "teams"

    name: Mapped[str] = mapped_column(String(160), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    region_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("regions.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class UserRegion(EntityMixin, Base):
    __tablename__ = "user_regions"
    __table_args__ = (UniqueConstraint("user_id", "region_id", name="uq_user_region"),)

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    region_id: Mapped[str] = mapped_column(String(36), ForeignKey("regions.id"))
    role: Mapped[str] = mapped_column(String(60), default="member")

    user: Mapped[User] = relationship(back_populates="regions", foreign_keys=[user_id])
    region: Mapped[Region] = relationship()


class UserTeam(EntityMixin, Base):
    __tablename__ = "user_teams"
    __table_args__ = (UniqueConstraint("user_id", "team_id", name="uq_user_team"),)

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id"))
    role: Mapped[str] = mapped_column(String(60), default="member")

    user: Mapped[User] = relationship(back_populates="teams", foreign_keys=[user_id])
    team: Mapped[Team] = relationship()


class ProjectType(EntityMixin, Base):
    __tablename__ = "project_types"

    name: Mapped[str] = mapped_column(String(120), unique=True)
    default_role_suggestions: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Project(EntityMixin, Base):
    __tablename__ = "projects"

    title: Mapped[str] = mapped_column(String(240), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_type_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("project_types.id"), nullable=True)
    project_type_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(60), default="Draft")
    region_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("regions.id"), nullable=True)
    team_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("teams.id"), nullable=True)
    visibility: Mapped[str] = mapped_column(String(60), default="Internal")
    sensitivity: Mapped[str] = mapped_column(String(60), default="Internal")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    project_manager_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    external_folder_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    location_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    map_url: Mapped[str | None] = mapped_column(String(500), nullable=True)


class ProjectRoleSlot(EntityMixin, Base):
    __tablename__ = "project_role_slots"

    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"))
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    spots_available: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(40), default="Open")
    required_skills: Mapped[list] = mapped_column(JSON, default=list)
    required_training: Mapped[list] = mapped_column(JSON, default=list)


class ProjectAssignment(EntityMixin, Base):
    __tablename__ = "project_assignments"

    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"))
    role_slot_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("project_role_slots.id"), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    visitor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("visitors.id"), nullable=True)
    role_title: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(60), default="Pending")
    approval_status: Mapped[str] = mapped_column(String(60), default="Pending")


class Task(EntityMixin, Base):
    __tablename__ = "tasks"

    title: Mapped[str] = mapped_column(String(240), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    priority: Mapped[str] = mapped_column(String(40), default="Normal")
    status: Mapped[str] = mapped_column(String(40), default="To Do")
    attached_entity_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    attached_entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    visibility: Mapped[str] = mapped_column(String(60), default="Internal")
    sensitivity: Mapped[str] = mapped_column(String(60), default="Internal")
    xp_value: Mapped[int] = mapped_column(Integer, default=0)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    halted_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    halted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    halted_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    xp_awarded_record_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("xp_records.id"), nullable=True)
    assignment_mode: Mapped[str] = mapped_column(String(40), default="first_completer")
    approved_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    checklist: Mapped[list] = mapped_column(JSON, default=list)

    assignees: Mapped[list["TaskAssignee"]] = relationship(back_populates="task", cascade="all, delete-orphan")

    @property
    def assignee_ids(self) -> list[str]:
        ids = [assignment.user_id for assignment in self.assignees]
        if self.assigned_to_id and self.assigned_to_id not in ids:
            ids.insert(0, self.assigned_to_id)
        return ids


class TaskAssignee(EntityMixin, Base):
    __tablename__ = "task_assignees"
    __table_args__ = (UniqueConstraint("task_id", "user_id", name="uq_task_assignee"),)

    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id"))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    assignment_source_type: Mapped[str] = mapped_column(String(60), default="direct")
    assignment_source_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    assigned_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(40), default="Assigned")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    task: Mapped[Task] = relationship(back_populates="assignees")


class CalendarEvent(EntityMixin, Base):
    __tablename__ = "calendar_events"

    title: Mapped[str] = mapped_column(String(240), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    region_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("regions.id"), nullable=True)
    team_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("teams.id"), nullable=True)
    project_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("projects.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(80), default="General")
    location_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    map_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    visibility: Mapped[str] = mapped_column(String(60), default="Internal")
    approval_required: Mapped[bool] = mapped_column(Boolean, default=False)
    attendance_enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class EventAttendance(EntityMixin, Base):
    __tablename__ = "event_attendance"

    event_id: Mapped[str] = mapped_column(String(36), ForeignKey("calendar_events.id"))
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    visitor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("visitors.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="Registered")
    xp_awarded: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class WorkshopRecord(EntityMixin, Base):
    __tablename__ = "workshop_records"

    event_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("calendar_events.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(240))
    instructor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    region_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("regions.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class TrainingRecord(EntityMixin, Base):
    __tablename__ = "training_records"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    workshop_record_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("workshop_records.id"), nullable=True)
    training_name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(60), default="Completed")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    public_badge: Mapped[str | None] = mapped_column(String(120), nullable=True)
    sensitivity: Mapped[str] = mapped_column(String(60), default="HR-only")
    private_notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Skill(EntityMixin, Base):
    __tablename__ = "skills"

    name: Mapped[str] = mapped_column(String(160), unique=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class UserSkill(EntityMixin, Base):
    __tablename__ = "user_skills"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id"))
    level: Mapped[str] = mapped_column(String(60), default="Beginner")
    verified_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EquipmentItem(EntityMixin, Base):
    __tablename__ = "equipment_items"

    name: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), default="General")
    serial_number: Mapped[str | None] = mapped_column(String(160), nullable=True)
    condition: Mapped[str] = mapped_column(String(60), default="Good")
    storage_location: Mapped[str | None] = mapped_column(String(240), nullable=True)
    owner_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    region_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("regions.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(60), default="Available")
    sensitivity: Mapped[str] = mapped_column(String(60), default="Internal")


class EquipmentLoanRequest(EntityMixin, Base):
    __tablename__ = "equipment_loan_requests"

    equipment_item_id: Mapped[str] = mapped_column(String(36), ForeignKey("equipment_items.id"))
    requester_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    project_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("projects.id"), nullable=True)
    event_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("calendar_events.id"), nullable=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(60), default="Requested")
    approved_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    condition_out: Mapped[str | None] = mapped_column(Text, nullable=True)
    condition_in: Mapped[str | None] = mapped_column(Text, nullable=True)


class BudgetRequest(EntityMixin, Base):
    __tablename__ = "budget_requests"

    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(12), default="NZD")
    project_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("projects.id"), nullable=True)
    event_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("calendar_events.id"), nullable=True)
    requester_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(60), default="Submitted")
    approved_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    approval_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sensitivity: Mapped[str] = mapped_column(String(60), default="Finance-sensitive")


class FinanceRecord(EntityMixin, Base):
    __tablename__ = "finance_records"

    title: Mapped[str] = mapped_column(String(240))
    record_type: Mapped[str] = mapped_column(String(80), default="Expense")
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(12), default="NZD")
    budget_request_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("budget_requests.id"), nullable=True)
    project_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("projects.id"), nullable=True)
    event_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("calendar_events.id"), nullable=True)
    receipt_file_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    status: Mapped[str] = mapped_column(String(60), default="Draft")
    sensitivity: Mapped[str] = mapped_column(String(60), default="Finance-sensitive")


class HRRecord(EntityMixin, Base):
    __tablename__ = "hr_records"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    record_type: Mapped[str] = mapped_column(String(100), default="Note")
    title: Mapped[str] = mapped_column(String(240))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(60), default="Open")
    sensitivity: Mapped[str] = mapped_column(String(60), default="HR-only")


class FileRecord(EntityMixin, Base):
    __tablename__ = "file_records"

    local_path: Mapped[str] = mapped_column(String(800))
    original_filename: Mapped[str] = mapped_column(String(255))
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    file_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    attached_entity_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    attached_entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    uploaded_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    sensitivity: Mapped[str] = mapped_column(String(60), default="Internal")
    visibility: Mapped[str] = mapped_column(String(60), default="Internal")
    source_provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_attachment_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    local_copy: Mapped[bool] = mapped_column(Boolean, default=True)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)


class LinkRecord(EntityMixin, Base):
    __tablename__ = "link_records"

    url: Mapped[str] = mapped_column(String(1000))
    label: Mapped[str] = mapped_column(String(240))
    provider: Mapped[str] = mapped_column(String(80), default="external")
    manual_icon: Mapped[str | None] = mapped_column(String(80), nullable=True)
    attached_entity_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    attached_entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    visibility: Mapped[str] = mapped_column(String(60), default="Internal")
    sensitivity: Mapped[str] = mapped_column(String(60), default="Internal")


class MessageThread(EntityMixin, Base):
    __tablename__ = "message_threads"

    title: Mapped[str] = mapped_column(String(240))
    thread_type: Mapped[str] = mapped_column(String(80), default="direct")
    attached_entity_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    attached_entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    visibility: Mapped[str] = mapped_column(String(60), default="Internal")
    moderated: Mapped[bool] = mapped_column(Boolean, default=False)

    participants: Mapped[list["MessageThreadParticipant"]] = relationship(back_populates="thread", cascade="all, delete-orphan")

    @property
    def participant_ids(self) -> list[str]:
        return [participant.user_id for participant in self.participants]


class MessageThreadParticipant(EntityMixin, Base):
    __tablename__ = "message_thread_participants"
    __table_args__ = (UniqueConstraint("thread_id", "user_id", name="uq_message_thread_participant"),)

    thread_id: Mapped[str] = mapped_column(String(36), ForeignKey("message_threads.id"))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    role: Mapped[str] = mapped_column(String(40), default="member")
    status: Mapped[str] = mapped_column(String(40), default="Active")

    thread: Mapped[MessageThread] = relationship(back_populates="participants")


class Message(EntityMixin, Base):
    __tablename__ = "messages"

    thread_id: Mapped[str] = mapped_column(String(36), ForeignKey("message_threads.id"))
    sender_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(60), default="Sent")
    reported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Announcement(EntityMixin, Base):
    __tablename__ = "announcements"

    title: Mapped[str] = mapped_column(String(240))
    body: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(80), default="General")
    status: Mapped[str] = mapped_column(String(60), default="Draft")
    visibility: Mapped[str] = mapped_column(String(60), default="Internal")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class NewsletterPreference(EntityMixin, Base):
    __tablename__ = "newsletter_preferences"

    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    visitor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("visitors.id"), nullable=True)
    email: Mapped[str] = mapped_column(String(255))
    tier: Mapped[str] = mapped_column(String(80), default="Regular Newsletter")
    status: Mapped[str] = mapped_column(String(40), default="Subscribed")


class XPRecord(EntityMixin, Base):
    __tablename__ = "xp_records"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(240))
    source_entity_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source_entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    awarded_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)


class AuditLog(TimestampMixin, Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    actor_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    target_type: Mapped[str] = mapped_column(String(120), index=True)
    target_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    old_value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSON, nullable=True)
    new_value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(120), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    sensitivity: Mapped[str] = mapped_column(String(60), default="Internal")
    reauth_required: Mapped[bool] = mapped_column(Boolean, default=False)
    notification_sent: Mapped[bool] = mapped_column(Boolean, default=False)


class BackupRecord(EntityMixin, Base):
    __tablename__ = "backup_records"

    backup_type: Mapped[str] = mapped_column(String(80), default="manual")
    status: Mapped[str] = mapped_column(String(80), default="Recorded")
    storage_location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    restore_requested_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    restore_approved_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    restore_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    domain_approval_type: Mapped[str | None] = mapped_column(String(80), nullable=True)


class DataSensitivity(EntityMixin, Base):
    __tablename__ = "data_sensitivities"

    name: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_reauth: Mapped[bool] = mapped_column(Boolean, default=False)


class FormDefinition(EntityMixin, Base):
    __tablename__ = "form_definitions"

    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    form_type: Mapped[str] = mapped_column(String(100), default="general")
    schema: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(60), default="Draft")


class FormSubmission(EntityMixin, Base):
    __tablename__ = "form_submissions"

    form_definition_id: Mapped[str] = mapped_column(String(36), ForeignKey("form_definitions.id"))
    submitted_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    submitted_by_visitor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("visitors.id"), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(60), default="Submitted")
    attached_entity_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    attached_entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class Notification(EntityMixin, Base):
    __tablename__ = "notifications"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(240))
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    notification_type: Mapped[str] = mapped_column(String(80), default="general")
    target_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    target_url: Mapped[str | None] = mapped_column(String(500), nullable=True)


class IntegrationConnection(EntityMixin, Base):
    __tablename__ = "integration_connections"

    provider: Mapped[str] = mapped_column(String(120))
    display_name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(80), default="Planned")
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class ExternalSyncRecord(EntityMixin, Base):
    __tablename__ = "external_sync_records"

    integration_connection_id: Mapped[str] = mapped_column(String(36), ForeignKey("integration_connections.id"))
    local_entity_type: Mapped[str] = mapped_column(String(120))
    local_entity_id: Mapped[str] = mapped_column(String(36))
    external_id: Mapped[str] = mapped_column(String(255))
    sync_direction: Mapped[str] = mapped_column(String(40), default="outbound")
    sync_status: Mapped[str] = mapped_column(String(60), default="pending")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
