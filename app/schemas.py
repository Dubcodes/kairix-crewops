from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SetupStatus(BaseModel):
    setup_complete: bool
    organisation_name: str | None = None


class SetupRequest(BaseModel):
    organisation_name: str = Field(min_length=2, max_length=200)
    organisation_short_name: str = Field(min_length=1, max_length=80)
    website_url: str | None = None
    country: str = "New Zealand"
    timezone: str = "Pacific/Auckland"
    admin_username: str = Field(min_length=3, max_length=80)
    admin_email: EmailStr
    admin_display_name: str = Field(min_length=2, max_length=200)
    admin_password: str = Field(min_length=10)
    default_regions: list[str] = Field(default_factory=lambda: ["Upper North Island", "Lower North Island"])
    enabled_modules: list[str] | None = None
    onboarding_mode: str = "region_approval"
    xp_settings: dict[str, Any] | None = None
    finance_approval_thresholds: dict[str, Any] | None = None


class BaseOut(BaseModel):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    email: EmailStr
    display_name: str
    password: str = Field(min_length=10)
    account_status: str = "Active"
    member_type: str = "Member"
    permission_tags: list[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    display_name: str | None = None
    email: EmailStr | None = None
    account_status: str | None = None
    member_type: str | None = None
    phone: str | None = None
    search_visibility: str | None = None
    message_privacy: str | None = None


class UserOut(BaseOut):
    username: str
    email: EmailStr
    display_name: str
    account_status: str
    member_type: str
    xp_total: int
    level: int
    permission_tags: list[str] = Field(default_factory=list)


class OrganisationOut(BaseOut):
    name: str
    short_name: str
    website_url: str | None
    country: str
    timezone: str
    setup_complete: bool


class OrganisationUpdate(BaseModel):
    name: str | None = None
    short_name: str | None = None
    website_url: str | None = None
    country: str | None = None
    timezone: str | None = None


class SettingUpsert(BaseModel):
    key: str
    value: Any
    category: str = "general"


class VisitorCreate(BaseModel):
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    notes: str | None = None
    associated_region_id: str | None = None
    associated_team_id: str | None = None
    source_event_id: str | None = None
    source_project_id: str | None = None
    newsletter_tier: str | None = None


class VisitorOut(BaseOut):
    name: str
    email: EmailStr | None
    phone: str | None
    notes: str | None
    linked_user_id: str | None


class RegionCreate(BaseModel):
    name: str
    description: str | None = None
    parent_region_id: str | None = None


class TeamCreate(BaseModel):
    name: str
    description: str | None = None
    region_id: str | None = None


class RegionOut(BaseOut):
    name: str
    description: str | None
    parent_region_id: str | None
    is_active: bool


class TeamOut(BaseOut):
    name: str
    description: str | None
    region_id: str | None
    is_active: bool


class ProjectCreate(BaseModel):
    title: str
    description: str | None = None
    project_type_name: str | None = None
    status: str = "Draft"
    region_id: str | None = None
    team_id: str | None = None
    visibility: str = "Internal"
    sensitivity: str = "Internal"
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    project_manager_id: str | None = None
    external_folder_url: str | None = None
    is_public: bool = False
    location_label: str | None = None
    address_text: str | None = None
    map_url: str | None = None


class ProjectOut(BaseOut):
    title: str
    description: str | None
    project_type_name: str | None
    status: str
    visibility: str
    sensitivity: str
    starts_at: datetime | None
    ends_at: datetime | None
    is_public: bool


class RoleSlotCreate(BaseModel):
    title: str
    description: str | None = None
    spots_available: int = 1
    required_skills: list[str] = Field(default_factory=list)
    required_training: list[str] = Field(default_factory=list)


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    assigned_to_id: str | None = None
    due_at: datetime | None = None
    priority: str = "Normal"
    status: str = "To Do"
    attached_entity_type: str | None = None
    attached_entity_id: str | None = None
    visibility: str = "Internal"
    sensitivity: str = "Internal"
    xp_value: int = 0
    requires_approval: bool = False
    checklist: list[Any] = Field(default_factory=list)


class TaskOut(BaseOut):
    title: str
    description: str | None
    assigned_to_id: str | None
    due_at: datetime | None
    priority: str
    status: str
    attached_entity_type: str | None
    attached_entity_id: str | None
    xp_value: int


class EventCreate(BaseModel):
    title: str
    description: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    region_id: str | None = None
    team_id: str | None = None
    project_id: str | None = None
    event_type: str = "General"
    location_label: str | None = None
    address_text: str | None = None
    capacity: int | None = None
    visibility: str = "Internal"
    approval_required: bool = False
    attendance_enabled: bool = True


class EventOut(BaseOut):
    title: str
    description: str | None
    starts_at: datetime
    ends_at: datetime | None
    event_type: str
    location_label: str | None
    visibility: str
    attendance_enabled: bool


class EquipmentCreate(BaseModel):
    name: str
    description: str | None = None
    category: str = "General"
    serial_number: str | None = None
    condition: str = "Good"
    storage_location: str | None = None
    region_id: str | None = None
    status: str = "Available"


class BudgetRequestCreate(BaseModel):
    title: str
    description: str | None = None
    amount: float
    currency: str = "NZD"
    project_id: str | None = None
    event_id: str | None = None


class HRRecordCreate(BaseModel):
    user_id: str
    record_type: str = "Note"
    title: str
    body: str | None = None
    status: str = "Open"


class FileRecordCreate(BaseModel):
    local_path: str
    original_filename: str
    label: str | None = None
    file_type: str | None = None
    attached_entity_type: str | None = None
    attached_entity_id: str | None = None
    sensitivity: str = "Internal"
    visibility: str = "Internal"
    source_provider: str | None = None
    source_message_id: str | None = None
    source_attachment_name: str | None = None
    local_copy: bool = True
    checksum: str | None = None


class LinkRecordCreate(BaseModel):
    url: str
    label: str
    provider: str = "external"
    manual_icon: str | None = None
    attached_entity_type: str | None = None
    attached_entity_id: str | None = None
    visibility: str = "Internal"
    sensitivity: str = "Internal"


class MessageThreadCreate(BaseModel):
    title: str
    thread_type: str = "direct"
    attached_entity_type: str | None = None
    attached_entity_id: str | None = None
    visibility: str = "Internal"


class MessageCreate(BaseModel):
    body: str


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    category: str = "General"
    status: str = "Draft"
    visibility: str = "Internal"


class BackupRecordCreate(BaseModel):
    backup_type: str = "manual"
    status: str = "Recorded"
    storage_location: str | None = None
    checksum: str | None = None
    size_bytes: int | None = None


class AuditOut(BaseOut):
    actor_user_id: str | None
    action: str
    target_type: str
    target_id: str | None
    reason: str | None
    sensitivity: str
    reauth_required: bool
    notification_sent: bool

