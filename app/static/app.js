const state = {
  token: localStorage.getItem("crewopsToken"),
  me: null,
  settings: {},
  activeModule: "dashboard",
  data: {},
  reauth: {},
  selectedTaskId: null,
  taskFilter: "assigned",
  taskPanel: "view",
  selectedThreadId: null,
  messagePanel: "thread",
  selectedHelpId: null,
};

const PRODUCT_NAME = "CrewOps";

const moduleList = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", summary: "Calendar, tasks, contacts, updates, and progress." },
  { id: "calendar", label: "Calendar", icon: "calendar", summary: "Events, workshops, shoots, meetings, and attendance dates." },
  { id: "projects", label: "Projects", icon: "projects", summary: "Films, workshops, events, and internal operational work." },
  { id: "tasks", label: "Tasks", icon: "tasks", summary: "Work items linked to people, projects, events, or operations." },
  { id: "members", label: "Members", icon: "members", summary: "Accounts, membership state, XP, teams, and permissions." },
  { id: "visitors", label: "Visitors", icon: "visitors", summary: "Guest and non-member contact records." },
  { id: "regions", label: "Teams/Regions", icon: "regions", summary: "Regions and teams used for access and organisation." },
  { id: "training", label: "Workshops/Training", icon: "training", summary: "Workshop records, skills, attendance, and training history." },
  { id: "equipment", label: "Equipment", icon: "equipment", summary: "Assets, gear status, storage notes, and loans." },
  { id: "finance", label: "Finance", icon: "finance", summary: "Budget requests, approvals, and finance records." },
  { id: "hr", label: "HR", icon: "hr", summary: "Restricted HR notes and sensitive people records." },
  { id: "messages", label: "Messages", icon: "messages", summary: "Coordinate work across direct, project, event, and team conversations." },
  { id: "notifications", label: "Notifications", icon: "notifications", summary: "Personal alerts and operational notices." },
  { id: "announcements", label: "Announcements", icon: "announcements", summary: "Noticeboard posts, newsletters, and important updates." },
  { id: "xp", label: "XP", icon: "xp", summary: "Experience awards connected to attendance, tasks, and projects." },
  { id: "forms", label: "Forms", icon: "forms", summary: "Forms and submissions for operational workflows." },
  { id: "files", label: "Files/Documents", icon: "files", summary: "File records, uploads, and external document links." },
  { id: "integrations", label: "Integrations", icon: "integrations", summary: "Connection records for external services and sync activity." },
  { id: "audit", label: "Reports/Audit", icon: "audit", summary: "Audit history and oversight records." },
  { id: "settings", label: "Settings", icon: "settings", summary: "Your profile, privacy, notifications, display, and account preferences." },
  { id: "admin", label: "Admin/System", icon: "admin", summary: "Health, backups, permissions, and system operations." },
  { id: "help", label: "Help", icon: "help", summary: "Guidance for using each area of the system." },
];

const moduleById = Object.fromEntries(moduleList.map((module) => [module.id, module]));
const moduleAliases = {
  notifications: ["notifications"],
  xp: ["experience", "xp_records"],
  forms: ["forms", "form_definitions"],
  regions: ["teams_regions", "teams/regions"],
  training: ["workshops_training", "workshops/training"],
  files: ["files_documents", "files/documents"],
  integrations: ["integrations", "integration_connections"],
  audit: ["reports_audit", "reports/audit"],
  admin: ["admin_system", "admin/system"],
};

const resourceModules = {
  calendar: {
    endpoint: "/calendar/events",
    createEndpoint: "/calendar/events",
    listTitle: "Events",
    createTitle: "New event",
    empty: "No calendar events yet.",
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "event_type", label: "Type", value: "General" },
      { name: "starts_at", label: "Starts", type: "datetime-local", required: true },
      { name: "location_label", label: "Location label" },
      { name: "visibility", label: "Visibility", value: "Internal" },
    ],
    render: (row) => item(row.title, [row.event_type, formatDate(row.starts_at), row.location_label, row.visibility].filter(Boolean).join(" · ")),
  },
  projects: {
    endpoint: "/projects",
    createEndpoint: "/projects",
    listTitle: "Projects",
    createTitle: "New project",
    empty: "No projects yet.",
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "project_type_name", label: "Type", value: "Film" },
      { name: "status", label: "Status", value: "Draft" },
      { name: "description", label: "Description", type: "textarea" },
    ],
    render: (row) => item(row.title, [row.project_type_name, row.status, row.visibility, row.description].filter(Boolean).join(" · ")),
  },
  tasks: {
    endpoint: "/tasks?assigned_to_me=false",
    createEndpoint: "/tasks",
    listTitle: "Tasks",
    createTitle: "New task",
    empty: "No tasks yet.",
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "priority", label: "Priority", type: "select", options: ["Low", "Normal", "High", "Urgent"], value: "Normal" },
      { name: "status", label: "Status", type: "select", options: ["To Do", "In Progress", "Halted", "Done", "Cancelled"], value: "To Do" },
      { name: "due_at", label: "Due", type: "datetime-local" },
      { name: "description", label: "Description", type: "textarea" },
    ],
    render: (row) => item(row.title, [row.status, row.priority, formatDate(row.due_at), row.description].filter(Boolean).join(" · ")),
  },
  members: {
    endpoint: "/users",
    createEndpoint: "/users",
    listTitle: "Members",
    createTitle: "New member account",
    empty: "No member accounts found.",
    fields: [
      { name: "display_name", label: "Display name", required: true },
      { name: "username", label: "Username", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "password", label: "Temporary password", type: "password", required: true },
      { name: "member_type", label: "Member type", value: "Member" },
      { name: "account_status", label: "Status", type: "select", options: ["Pending", "Active", "Suspended", "Archived"], value: "Active" },
    ],
    render: (row) => item(row.display_name, [row.username, row.member_type, row.account_status, `Level ${row.level}`, tags(row.permission_tags)].filter(Boolean).join(" · ")),
  },
  visitors: {
    endpoint: "/visitors",
    createEndpoint: "/visitors",
    listTitle: "Visitors",
    createTitle: "New visitor",
    empty: "No visitor records yet.",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "email", label: "Email", type: "email" },
      { name: "phone", label: "Phone" },
      { name: "newsletter_tier", label: "Newsletter tier" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    render: (row) => item(row.name, [row.email, row.phone, row.linked_user_id ? "Linked to member" : "Unlinked visitor", row.notes].filter(Boolean).join(" · ")),
  },
  equipment: {
    endpoint: "/equipment/items",
    createEndpoint: "/equipment/items",
    listTitle: "Equipment",
    createTitle: "New equipment item",
    empty: "No equipment items yet.",
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "category", label: "Category", value: "General" },
      { name: "condition", label: "Condition", value: "Good" },
      { name: "storage_location", label: "Storage location" },
      { name: "serial_number", label: "Serial number" },
      { name: "description", label: "Description", type: "textarea" },
    ],
    render: (row) => item(row.name, [row.category, row.status, row.condition, row.storage_location].filter(Boolean).join(" · ")),
  },
  finance: {
    endpoint: "/finance/budget-requests",
    createEndpoint: "/finance/budget-requests",
    listTitle: "Budget requests",
    createTitle: "New budget request",
    empty: "No budget requests yet.",
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "amount", label: "Amount", type: "number", step: "0.01", required: true },
      { name: "currency", label: "Currency", value: "NZD" },
      { name: "description", label: "Reason / description", type: "textarea" },
    ],
    render: (row) => item(row.title, [`${row.currency || "NZD"} ${row.amount}`, row.status, row.description].filter(Boolean).join(" · ")),
  },
  notifications: {
    endpoint: "/notifications",
    createEndpoint: "/notifications",
    listTitle: "My notifications",
    createTitle: "New notification",
    empty: "No notifications yet.",
    preload: ["users"],
    fields: [
      { name: "user_id", label: "Recipient", type: "user-select", required: true },
      { name: "title", label: "Title", required: true },
      { name: "notification_type", label: "Type", value: "general" },
      { name: "target_url", label: "Target URL" },
      { name: "body", label: "Body", type: "textarea" },
    ],
    render: (row) => item(row.title, [row.notification_type, row.read_at ? "Read" : "Unread", row.body].filter(Boolean).join(" · ")),
  },
  xp: {
    endpoint: "/xp/records",
    createEndpoint: "/xp/records",
    listTitle: "XP records",
    createTitle: "Award XP",
    empty: "No XP records yet.",
    preload: ["users"],
    fields: [
      { name: "user_id", label: "Person", type: "user-select", required: true },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "reason", label: "Reason", required: true },
      { name: "source_entity_type", label: "Source entity type" },
      { name: "source_entity_id", label: "Source entity id" },
    ],
    render: (row) => item(row.reason, [`${row.amount} XP`, compactId(row.user_id), row.source_entity_type].filter(Boolean).join(" · ")),
  },
  hr: {
    endpoint: "/hr/records",
    createEndpoint: "/hr/records",
    listTitle: "HR records",
    createTitle: "New HR record",
    empty: "No HR records yet.",
    preload: ["users"],
    fields: [
      { name: "user_id", label: "Person", type: "user-select", required: true },
      { name: "record_type", label: "Record type", value: "Note" },
      { name: "title", label: "Title", required: true },
      { name: "status", label: "Status", value: "Open" },
      { name: "body", label: "Private note", type: "textarea" },
    ],
    render: (row) => item(row.title, [row.record_type, row.status, compactId(row.user_id)].filter(Boolean).join(" · ")),
  },
  messages: {
    endpoint: "/messages/threads",
    createEndpoint: "/messages/threads",
    listTitle: "Threads",
    createTitle: "New thread",
    empty: "No message threads yet.",
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "thread_type", label: "Thread type", value: "general" },
      { name: "visibility", label: "Visibility", value: "Internal" },
    ],
    render: (row) => item(row.title, [row.thread_type, row.visibility, row.moderated ? "Moderated" : ""].filter(Boolean).join(" · ")),
  },
  announcements: {
    endpoint: "/announcements",
    createEndpoint: "/announcements",
    listTitle: "Announcements",
    createTitle: "New announcement",
    empty: "No announcements yet.",
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "category", label: "Category", value: "General" },
      { name: "status", label: "Status", type: "select", options: ["Draft", "Published", "Archived"], value: "Draft" },
      { name: "visibility", label: "Visibility", value: "Internal" },
      { name: "body", label: "Body", type: "textarea", required: true },
    ],
    render: (row) => item(row.title, [row.category, row.status, row.visibility].filter(Boolean).join(" · ")),
  },
};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function iconSvg(name) {
  const icons = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path>',
    projects: '<path d="M4 6h6l2 2h8v10a2 2 0 0 1-2 2H4z"></path>',
    tasks: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>',
    members: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.9"></path><path d="M16 3.1a4 4 0 0 1 0 7.8"></path>',
    visitors: '<path d="M19 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="11.5" cy="7" r="4"></circle><path d="M20 8v6M23 11h-6"></path>',
    regions: '<path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11z"></path><circle cx="12" cy="10" r="2"></circle>',
    training: '<path d="M22 10L12 5 2 10l10 5 10-5z"></path><path d="M6 12v5c3 2 9 2 12 0v-5"></path>',
    equipment: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"></path><path d="M3.3 7L12 12l8.7-5"></path><path d="M12 22V12"></path>',
    finance: '<path d="M3 6h18v12H3z"></path><circle cx="12" cy="12" r="3"></circle><path d="M7 12h.01M17 12h.01"></path>',
    hr: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12h6M12 9v6"></path>',
    messages: '<path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>',
    notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M13.7 21a2 2 0 0 1-3.4 0"></path>',
    announcements: '<path d="M3 11v2a2 2 0 0 0 2 2h3l7 4V5l-7 4H5a2 2 0 0 0-2 2z"></path><path d="M19 9a3 3 0 0 1 0 6"></path>',
    xp: '<path d="M3 17l6-6 4 4 8-8"></path><path d="M14 7h7v7"></path>',
    forms: '<path d="M8 3h8l4 4v14H4V3z"></path><path d="M14 3v5h5M8 13h8M8 17h6"></path>',
    files: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path>',
    integrations: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"></path><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"></path>',
    audit: '<path d="M4 5h16M4 12h16M4 19h16"></path><path d="M8 5v14"></path>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>',
    admin: '<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M9 9h6v6H9z"></path><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3"></path>',
    help: '<circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 1 1 5.8 1c-.6 1-1.6 1.5-2.4 2.2-.6.5-.9 1.1-.9 1.8"></path><path d="M12 18h.01"></path>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"></path>',
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[name] || icons.help}</svg>`;
}

function renderShellIcons() {
  $("toggleSidebar").innerHTML = iconSvg("menu");
  $("notificationButton").innerHTML = iconSvg("notifications");
  $("helpButton").innerHTML = iconSvg("help");
  $("settingsButton").innerHTML = iconSvg("settings");
  $("floatingMessages").innerHTML = iconSvg("messages");
}

function toast(message) {
  const box = $("toast");
  box.textContent = String(message);
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 4200);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    const apiError = new Error(error.detail || response.statusText);
    apiError.status = response.status;
    if (response.status === 401 && !options.allowUnauthenticated) {
      resetAuth();
    }
    throw apiError;
  }
  return response.json();
}

function setAuthenticatedUi(isAuthenticated) {
  document.body.classList.toggle("auth-locked", !isAuthenticated);
  $("search").disabled = !isAuthenticated;
  $("toggleSidebar").disabled = !isAuthenticated;
  $("notificationButton").disabled = !isAuthenticated;
  $("helpButton").disabled = !isAuthenticated;
  $("settingsButton").disabled = !isAuthenticated;
  $("avatar").disabled = !isAuthenticated;
}

function resetAuth() {
  localStorage.removeItem("crewopsToken");
  state.token = null;
  state.me = null;
  state.reauth = {};
  state.selectedTaskId = null;
  $("moduleContent").innerHTML = "";
  $("moduleGrid").innerHTML = "";
  setAuthenticatedUi(false);
  show("loginView");
}

function requireSession() {
  if (state.token && state.me) return true;
  resetAuth();
  return false;
}

function show(viewId) {
  for (const view of document.querySelectorAll(".view")) view.classList.add("hidden");
  $(viewId).classList.remove("hidden");
}

function setActiveNav(id) {
  state.activeModule = id;
  for (const button of document.querySelectorAll("nav button")) {
    button.classList.toggle("active", button.dataset.module === id);
  }
}

function renderNav() {
  $("nav").innerHTML = visibleModules(state.settings)
    .map((module) => `<button data-module="${module.id}" class="${module.id === state.activeModule ? "active" : ""}" title="${escapeHtml(module.label)}">${iconSvg(module.icon)}<span>${escapeHtml(module.label)}</span></button>`)
    .join("");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function formatDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function compactId(value) {
  return value ? `id ${String(value).slice(0, 8)}` : "";
}

function tags(values) {
  return Array.isArray(values) && values.length ? values.join(", ") : "";
}

function hasAnyPermission(names) {
  const assigned = new Set(state.me?.permission_tags || []);
  return names.some((name) => assigned.has(name));
}

function isAdministrator() {
  return hasAnyPermission(["System Owner", "Administrator"]);
}

function canAccessModule(moduleId) {
  if (!state.me) return true;
  if (moduleId === "hr") return isAdministrator() || hasAnyPermission(["HR Trainee", "HR Assistant", "HR Officer", "HR Manager"]);
  if (moduleId === "finance") return isAdministrator() || hasAnyPermission(["Treasurer", "Finance Trainee", "Finance Assistant", "Finance Officer", "Finance Manager", "Board Member", "Founding Board Member", "Chair"]);
  if (moduleId === "admin" || moduleId === "integrations") return isAdministrator() || hasAnyPermission(["Data Management"]);
  if (moduleId === "audit") return isAdministrator() || hasAnyPermission(["Data Management", "Board Member", "Founding Board Member", "Chair"]);
  return true;
}

function item(title, meta = "", extra = "") {
  return `<div class="item"><strong>${escapeHtml(title || "Untitled")}</strong><span>${escapeHtml(meta || "")}</span>${extra}</div>`;
}

function statusLabel(status) {
  return status === "Complete" ? "Done" : status || "To Do";
}

function isDoneStatus(status) {
  return ["Done", "Complete"].includes(status);
}

function userName(id) {
  const user = (state.data.users || []).find((row) => row.id === id);
  return user?.display_name || (id ? compactId(id) : "Unassigned");
}

function taskLinkedLabel(task) {
  return task.attached_entity_type ? [task.attached_entity_type, compactId(task.attached_entity_id)].filter(Boolean).join(" ") : "General";
}

function canEditTask(task) {
  return isAdministrator() || task.created_by_id === state.me?.id || task.assigned_to_id === state.me?.id;
}

function isOverdueTask(task) {
  return task.due_at && !isDoneStatus(task.status) && statusLabel(task.status) !== "Cancelled" && new Date(task.due_at) < new Date();
}

function filterTasks(tasks) {
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return tasks.filter((task) => {
    const status = statusLabel(task.status);
    if (state.taskFilter === "assigned") return task.assigned_to_id === state.me?.id && !isDoneStatus(task.status) && status !== "Cancelled";
    if (state.taskFilter === "created") return task.created_by_id === state.me?.id;
    if (state.taskFilter === "all") return true;
    if (state.taskFilter === "done") return isDoneStatus(task.status);
    if (state.taskFilter === "halted") return status === "Halted";
    if (state.taskFilter === "overdue") return isOverdueTask(task);
    if (state.taskFilter === "soon") return task.due_at && new Date(task.due_at) <= soon && !isDoneStatus(task.status);
    return true;
  });
}

function taskListItem(task) {
  const selected = state.selectedTaskId === task.id ? " selected" : "";
  const status = statusLabel(task.status);
  const overdue = isOverdueTask(task) ? " overdue" : "";
  const meta = [
    status,
    task.priority,
    `Assigned to ${userName(task.assigned_to_id)}`,
    `Created by ${userName(task.created_by_id)}`,
    task.due_at ? `Due ${formatDate(task.due_at)}` : "",
    taskLinkedLabel(task),
    task.xp_value ? `${task.xp_value} XP` : "",
  ].filter(Boolean).join(" · ");
  return `<button type="button" class="item item-button task-card${selected}${overdue}" data-task-id="${escapeHtml(task.id)}" title="Open task details">
    <span class="status-dot ${escapeHtml(status.toLowerCase().replaceAll(" ", "-"))}"></span>
    <strong>${escapeHtml(task.title || "Untitled")}</strong>
    <span>${escapeHtml(meta)}</span>
  </button>`;
}

function renderEmpty(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function sensitiveOptions(moduleId) {
  const access = state.reauth[moduleId];
  if (!access) return {};
  return {
    headers: {
      "X-Reauth-Password": access.password,
      "X-Access-Reason": access.reason,
    },
  };
}

function renderReauthPanel(moduleId, message) {
  $("moduleContent").innerHTML = `
    <section class="panel narrow">
      <h2>Re-authentication required</h2>
      <p>${escapeHtml(message)}</p>
      <form class="form-grid" data-reauth-module="${escapeHtml(moduleId)}">
        ${fieldHtml({ name: "reason", label: "Access reason", required: true })}
        ${fieldHtml({ name: "password", label: "Re-enter password", type: "password", required: true })}
        <button class="primary" type="submit">Continue</button>
      </form>
    </section>`;
}

function fieldHtml(field, data = {}) {
  const value = field.value ?? "";
  const required = field.required ? " required" : "";
  const step = field.step ? ` step="${escapeHtml(field.step)}"` : "";
  if (field.type === "textarea") {
    return `<label>${escapeHtml(field.label)}<textarea name="${field.name}"${required}>${escapeHtml(value)}</textarea></label>`;
  }
  if (field.type === "select") {
    return `<label>${escapeHtml(field.label)}<select name="${field.name}"${required}>${field.options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
  }
  if (field.type === "user-select") {
    const users = data.users || [];
    const emptyOption = field.required ? "" : `<option value="">Unassigned</option>`;
    return `<label>${escapeHtml(field.label)}<select name="${field.name}"${required}>${emptyOption}${users.map((user) => `<option value="${escapeHtml(user.id)}" ${user.id === value ? "selected" : ""}>${escapeHtml(user.display_name)} (${escapeHtml(user.username)})</option>`).join("")}</select></label>`;
  }
  const type = field.type || "text";
  return `<label>${escapeHtml(field.label)}<input name="${field.name}" type="${type}" value="${escapeHtml(value)}"${required}${step} /></label>`;
}

function payloadFromForm(form) {
  const payload = {};
  for (const [key, rawValue] of new FormData(form).entries()) {
    if (rawValue === "") continue;
    const input = form.elements[key];
    if (input?.type === "number") {
      payload[key] = Number(rawValue);
    } else if (input?.type === "datetime-local") {
      payload[key] = new Date(rawValue).toISOString();
    } else {
      payload[key] = rawValue;
    }
  }
  return payload;
}

async function loadPreload(keys = []) {
  const data = {};
  if (keys.includes("users")) data.users = await api("/users").catch(() => []);
  return data;
}

async function renderResourceModule(id) {
  const config = resourceModules[id];
  const preload = await loadPreload(config.preload || []);
  const rows = await api(config.endpoint, sensitiveOptions(id)).catch((error) => {
    if (id === "hr" || id === "finance") {
      renderReauthPanel(id, error.message);
      return null;
    }
    toast(error.message);
    return [];
  });
  if (rows === null) return;
  state.data[id] = rows;
  $("moduleContent").innerHTML = `
    <div class="module-layout">
      <section class="panel">
        <div class="panel-title"><h2>${escapeHtml(config.listTitle)}</h2><button data-refresh-module="${id}">Refresh</button></div>
        <div class="list module-records">
          ${rows.length ? rows.map(config.render).join("") : renderEmpty(config.empty)}
        </div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>${escapeHtml(config.createTitle)}</h2></div>
        <form class="form-grid" data-create-endpoint="${escapeHtml(config.createEndpoint)}" data-module="${id}">
          ${config.fields.map((field) => fieldHtml(field, preload)).join("")}
          <button class="primary" type="submit">Create</button>
        </form>
      </section>
    </div>`;
}

async function renderTasksModule() {
  const [tasks, users] = await Promise.all([
    api("/tasks?assigned_to_me=false").catch((error) => {
      toast(error.message);
      return [];
    }),
    api("/users").catch(() => []),
  ]);
  state.data.tasks = tasks;
  state.data.users = users;
  const filtered = filterTasks(tasks);
  if (state.selectedTaskId && !filtered.some((task) => task.id === state.selectedTaskId)) {
    state.selectedTaskId = null;
    state.taskPanel = "view";
  }
  const selectedTask = filtered.find((task) => task.id === state.selectedTaskId) || filtered[0] || null;
  if (!state.selectedTaskId && selectedTask) state.selectedTaskId = selectedTask.id;
  const activeTask = tasks.find((task) => task.id === state.selectedTaskId) || selectedTask;

  $("moduleContent").innerHTML = `
    <div class="task-layout">
      <section class="panel task-list-panel">
        <div class="panel-title">
          <h2>Tasks</h2>
          <div class="actions">
            <button data-task-panel="create" title="Create task">Create task</button>
            <button data-refresh-module="tasks" title="Reload tasks">Refresh</button>
          </div>
        </div>
        <div class="tab-row" role="tablist">
          ${taskFilterButton("assigned", "Assigned to me")}
          ${taskFilterButton("created", "Created by me")}
          ${taskFilterButton("all", "All accessible")}
          ${taskFilterButton("done", "Done")}
          ${taskFilterButton("halted", "Halted")}
          ${taskFilterButton("overdue", "Overdue")}
          ${taskFilterButton("soon", "Due soon")}
        </div>
        <div class="list module-records">
          ${filtered.length ? filtered.map(taskListItem).join("") : renderEmpty(taskEmptyMessage())}
        </div>
      </section>
      <section class="panel task-detail-panel">
        ${renderTaskPanel(activeTask, users)}
      </section>
    </div>`;
}

function taskFilterButton(id, label) {
  return `<button type="button" class="${state.taskFilter === id ? "active" : ""}" data-task-filter="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
}

function taskEmptyMessage() {
  const messages = {
    assigned: "No tasks assigned to you.",
    created: "You have not assigned any tasks yet.",
    all: "No tasks available.",
    done: "No done tasks yet.",
    halted: "No halted tasks.",
    overdue: "No overdue tasks.",
    soon: "No tasks due soon.",
  };
  return messages[state.taskFilter] || "No tasks available.";
}

function renderTaskPanel(task, users) {
  if (state.taskPanel === "create") return renderTaskCreatePanel(users);
  if (!task) return `<div class="panel-title"><h2>Task details</h2></div>${renderEmpty("Select a task or create one when work needs an owner.")}`;
  if (state.taskPanel === "edit") return renderTaskEditPanel(task, users);
  if (state.taskPanel === "halt") return renderTaskHaltPanel(task);
  return renderTaskDetails(task);
}

function renderTaskCreatePanel(users) {
  return `<div class="panel-title"><h2>Create task</h2><button type="button" data-task-panel="view">Cancel</button></div>${renderTaskCreateForm(users)}`;
}

function renderTaskCreateForm(users = []) {
  return `<form class="form-grid" data-create-endpoint="/tasks" data-module="tasks">
    ${fieldHtml({ name: "title", label: "Title", required: true })}
    ${fieldHtml({ name: "description", label: "Description", type: "textarea" })}
    ${fieldHtml({ name: "assigned_to_id", label: "Assigned to", type: "user-select" }, { users })}
    ${fieldHtml({ name: "due_at", label: "Due date", type: "datetime-local" })}
    ${fieldHtml({ name: "priority", label: "Priority", type: "select", options: ["Low", "Normal", "High", "Urgent"], value: "Normal" })}
    ${fieldHtml({ name: "attached_entity_type", label: "Linked record type", type: "select", options: ["General", "Project", "Event", "Member", "Equipment", "Finance", "HR", "File"], value: "General" })}
    ${fieldHtml({ name: "attached_entity_id", label: "Linked record ID" })}
    ${fieldHtml({ name: "xp_value", label: "XP value", type: "number", value: "0" })}
    ${fieldHtml({ name: "visibility", label: "Visibility", type: "select", options: ["Internal", "Private", "Team", "Public"], value: "Internal" })}
    ${fieldHtml({ name: "sensitivity", label: "Sensitivity", type: "select", options: ["Internal", "HR-only", "Finance-sensitive"], value: "Internal" })}
    <button class="primary" type="submit">Create task</button>
  </form>`;
}

function renderTaskDetails(task) {
  const status = statusLabel(task.status);
  return `<div class="panel-title">
      <h2>${escapeHtml(task.title || "Untitled task")}</h2>
      <span class="pill">${escapeHtml(status)}</span>
    </div>
    <div class="detail-grid">
      ${detailRow("Assigned to", userName(task.assigned_to_id))}
      ${detailRow("Created by", userName(task.created_by_id))}
      ${detailRow("Due", formatDate(task.due_at) || "No due date")}
      ${detailRow("Priority", task.priority || "Normal")}
      ${detailRow("Linked record", taskLinkedLabel(task))}
      ${detailRow("XP", task.xp_value ? `${task.xp_value} XP` : "No XP set")}
    </div>
    ${task.description ? `<p class="detail-note">${escapeHtml(task.description)}</p>` : ""}
    <div class="actions task-actions">
      ${!isDoneStatus(task.status) ? `<button class="primary" type="button" data-task-status-id="${escapeHtml(task.id)}" data-task-status="Done" title="Mark this task done">Done</button>` : `<button type="button" data-task-status-id="${escapeHtml(task.id)}" data-task-status="To Do" title="Reopen this task">Reopen</button>`}
      <button type="button" data-task-panel="halt" title="Record why this task cannot continue on time">Halted</button>
      ${canEditTask(task) ? `<button type="button" data-task-panel="edit" title="Edit task details">Edit</button>` : ""}
    </div>`;
}

function renderTaskEditPanel(task, users = []) {
  return `<div class="panel-title"><h2>Edit task</h2><button type="button" data-task-panel="view">Cancel</button></div>
    <form class="form-grid" data-update-endpoint="/tasks/${escapeHtml(task.id)}" data-module="tasks">
      ${fieldHtml({ name: "title", label: "Title", required: true, value: task.title || "" })}
      ${fieldHtml({ name: "description", label: "Description", type: "textarea", value: task.description || "" })}
      ${fieldHtml({ name: "assigned_to_id", label: "Assigned to", type: "user-select", value: task.assigned_to_id || "" }, { users })}
      ${fieldHtml({ name: "due_at", label: "Due date", type: "datetime-local", value: formatDatetimeLocal(task.due_at) })}
      ${fieldHtml({ name: "priority", label: "Priority", type: "select", options: ["Low", "Normal", "High", "Urgent"], value: task.priority || "Normal" })}
      ${fieldHtml({ name: "status", label: "Status", type: "select", options: ["To Do", "In Progress", "Halted", "Done", "Cancelled"], value: statusLabel(task.status) })}
      ${fieldHtml({ name: "attached_entity_type", label: "Linked record type", type: "select", options: ["General", "Project", "Event", "Member", "Equipment", "Finance", "HR", "File"], value: task.attached_entity_type || "General" })}
      ${fieldHtml({ name: "attached_entity_id", label: "Linked record ID", value: task.attached_entity_id || "" })}
      ${fieldHtml({ name: "xp_value", label: "XP value", type: "number", value: String(task.xp_value || 0) })}
      <div class="actions">
        <button class="primary" type="submit">Save task</button>
      </div>
    </form>`;
}

function renderTaskHaltPanel(task) {
  return `<div class="panel-title"><h2>Halt task</h2><button type="button" data-task-panel="view">Cancel</button></div>
    <p class="detail-note">Use Halted when a task is blocked or cannot be completed on time. The task creator will be notified.</p>
    <form class="form-grid" data-task-halt-id="${escapeHtml(task.id)}">
      ${fieldHtml({ name: "reason", label: "Reason", type: "textarea", required: true })}
      <button class="primary" type="submit">Mark as halted</button>
    </form>`;
}

function detailRow(label, value) {
  return `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "")}</strong></div>`;
}

async function renderRegionsModule() {
  const [regions, teams] = await Promise.all([api("/org/regions").catch(() => []), api("/org/teams").catch(() => [])]);
  $("moduleContent").innerHTML = `
    <div class="module-layout">
      <section class="panel">
        <div class="panel-title"><h2>Regions</h2><button data-refresh-module="regions">Refresh</button></div>
        <div class="list">${regions.length ? regions.map((row) => item(row.name, [row.description, row.is_active ? "Active" : "Inactive"].filter(Boolean).join(" · "))).join("") : renderEmpty("No regions yet.")}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>New region</h2></div>
        <form class="form-grid" data-create-endpoint="/org/regions" data-module="regions">
          ${fieldHtml({ name: "name", label: "Name", required: true })}
          ${fieldHtml({ name: "description", label: "Description", type: "textarea" })}
          <button class="primary" type="submit">Create region</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Teams</h2></div>
        <div class="list">${teams.length ? teams.map((row) => item(row.name, [row.description, row.is_active ? "Active" : "Inactive"].filter(Boolean).join(" · "))).join("") : renderEmpty("No teams yet.")}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>New team</h2></div>
        <form class="form-grid" data-create-endpoint="/org/teams" data-module="regions">
          ${fieldHtml({ name: "name", label: "Name", required: true })}
          ${fieldHtml({ name: "description", label: "Description", type: "textarea" })}
          <button class="primary" type="submit">Create team</button>
        </form>
      </section>
    </div>`;
}

async function renderTrainingModule() {
  const [workshops, skills, users] = await Promise.all([
    api("/training/workshops").catch(() => []),
    api("/training/skills").catch(() => []),
    api("/users").catch(() => []),
  ]);
  $("moduleContent").innerHTML = `
    <div class="module-layout">
      <section class="panel">
        <div class="panel-title"><h2>Workshops</h2><button data-refresh-module="training">Refresh</button></div>
        <div class="list">${workshops.length ? workshops.map((row) => item(row.title, row.notes || "Workshop record")).join("") : renderEmpty("No workshop records yet.")}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>New workshop</h2></div>
        <form class="form-grid" data-create-endpoint="/training/workshops" data-module="training">
          ${fieldHtml({ name: "title", label: "Title", required: true })}
          ${fieldHtml({ name: "notes", label: "Notes", type: "textarea" })}
          <button class="primary" type="submit">Create workshop</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Skills</h2></div>
        <div class="list">${skills.length ? skills.map((row) => item(row.name, [row.category, row.description].filter(Boolean).join(" · "))).join("") : renderEmpty("No skills yet.")}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>New training record</h2></div>
        <form class="form-grid" data-create-endpoint="/training/records" data-module="training">
          ${fieldHtml({ name: "user_id", label: "Person", type: "user-select", required: true }, { users })}
          ${fieldHtml({ name: "training_name", label: "Training name", required: true })}
          ${fieldHtml({ name: "public_badge", label: "Public badge" })}
          ${fieldHtml({ name: "private_notes", label: "Private notes", type: "textarea" })}
          <button class="primary" type="submit">Add training record</button>
        </form>
      </section>
    </div>`;
}

async function renderEquipmentModule() {
  const [items, loans] = await Promise.all([api("/equipment/items").catch(() => []), api("/equipment/loans").catch(() => [])]);
  $("moduleContent").innerHTML = `
    <div class="module-layout">
      <section class="panel">
        <div class="panel-title"><h2>Equipment</h2><button data-refresh-module="equipment">Refresh</button></div>
        <div class="list">${items.length ? items.map((row) => item(row.name, [row.category, row.status, row.condition, row.storage_location].filter(Boolean).join(" · "))).join("") : renderEmpty("No equipment items yet.")}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>New equipment item</h2></div>
        <form class="form-grid" data-create-endpoint="/equipment/items" data-module="equipment">
          ${fieldHtml({ name: "name", label: "Name", required: true })}
          ${fieldHtml({ name: "category", label: "Category", value: "General" })}
          ${fieldHtml({ name: "condition", label: "Condition", value: "Good" })}
          ${fieldHtml({ name: "storage_location", label: "Storage location" })}
          ${fieldHtml({ name: "description", label: "Description", type: "textarea" })}
          <button class="primary" type="submit">Create item</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Loan requests</h2></div>
        <div class="list">${loans.length ? loans.map((row) => item(row.status, [compactId(row.equipment_item_id), formatDate(row.starts_at), formatDate(row.ends_at)].filter(Boolean).join(" · "))).join("") : renderEmpty("No loan requests yet.")}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>New loan request</h2></div>
        ${items.length ? `<form class="form-grid" data-create-endpoint="/equipment/loans" data-module="equipment">
          <label>Equipment item<select name="equipment_item_id" required>${items.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join("")}</select></label>
          ${fieldHtml({ name: "starts_at", label: "Starts", type: "datetime-local" })}
          ${fieldHtml({ name: "ends_at", label: "Ends", type: "datetime-local" })}
          ${fieldHtml({ name: "condition_out", label: "Condition out", type: "textarea" })}
          <button class="primary" type="submit">Request loan</button>
        </form>` : renderEmpty("Create an equipment item before requesting a loan.")}
      </section>
    </div>`;
}

async function renderFinanceModule() {
  const options = sensitiveOptions("finance");
  const [budgets, records] = await Promise.all([
    api("/finance/budget-requests", options).catch((error) => ({ error })),
    api("/finance/records", options).catch((error) => ({ error })),
  ]);
  const error = budgets.error || records.error;
  if (error) {
    renderReauthPanel("finance", error.message);
    return;
  }
  $("moduleContent").innerHTML = `
    <div class="module-layout">
      <section class="panel">
        <div class="panel-title"><h2>Budget requests</h2><button data-refresh-module="finance">Refresh</button></div>
        <div class="list">${budgets.length ? budgets.map((row) => item(row.title, [`${row.currency || "NZD"} ${row.amount}`, row.status, row.description].filter(Boolean).join(" · "))).join("") : renderEmpty("No budget requests yet.")}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>New budget request</h2></div>
        <form class="form-grid" data-create-endpoint="/finance/budget-requests" data-module="finance">
          ${fieldHtml({ name: "title", label: "Title", required: true })}
          ${fieldHtml({ name: "amount", label: "Amount", type: "number", step: "0.01", required: true })}
          ${fieldHtml({ name: "currency", label: "Currency", value: "NZD" })}
          ${fieldHtml({ name: "description", label: "Description", type: "textarea" })}
          <button class="primary" type="submit">Submit request</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Finance records</h2></div>
        <div class="list">${records.length ? records.map((row) => item(row.title, [`${row.currency || "NZD"} ${row.amount}`, row.record_type, row.status].filter(Boolean).join(" · "))).join("") : renderEmpty("No finance records yet.")}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>New finance record</h2></div>
        <form class="form-grid" data-create-endpoint="/finance/records" data-module="finance">
          ${fieldHtml({ name: "title", label: "Title", required: true })}
          ${fieldHtml({ name: "record_type", label: "Record type", value: "Expense" })}
          ${fieldHtml({ name: "amount", label: "Amount", type: "number", step: "0.01", required: true })}
          ${fieldHtml({ name: "currency", label: "Currency", value: "NZD" })}
          <button class="primary" type="submit">Create finance record</button>
        </form>
      </section>
    </div>`;
}

async function renderFilesModule() {
  const [files, links] = await Promise.all([api("/files/records").catch(() => []), api("/files/links").catch(() => [])]);
  $("moduleContent").innerHTML = `
    <div class="module-layout">
      <section class="panel">
        <div class="panel-title"><h2>File records</h2><button data-refresh-module="files">Refresh</button></div>
        <div class="list">${files.length ? files.map((row) => item(row.label || row.original_filename, [row.file_type, row.attached_entity_type, row.sensitivity].filter(Boolean).join(" · "))).join("") : renderEmpty("No file metadata records yet.")}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>New file record</h2></div>
        <form class="form-grid" data-create-endpoint="/files/records" data-module="files">
          ${fieldHtml({ name: "original_filename", label: "Original filename", required: true })}
          ${fieldHtml({ name: "local_path", label: "Local storage path", required: true })}
          ${fieldHtml({ name: "label", label: "Label" })}
          ${fieldHtml({ name: "attached_entity_type", label: "Attached entity type" })}
          <button class="primary" type="submit">Record file</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Upload local copy</h2></div>
        <form class="form-grid" data-upload-endpoint="/files/upload" data-module="files" enctype="multipart/form-data">
          <label>File<input name="upload" type="file" required /></label>
          ${fieldHtml({ name: "label", label: "Label" })}
          ${fieldHtml({ name: "attached_entity_type", label: "Attached entity type" })}
          ${fieldHtml({ name: "sensitivity", label: "Sensitivity", value: "Internal" })}
          <button class="primary" type="submit">Upload file</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Links</h2></div>
        <div class="list">${links.length ? links.map((row) => item(row.label, [row.provider, row.url].filter(Boolean).join(" · "))).join("") : renderEmpty("No links yet.")}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>New link</h2></div>
        <form class="form-grid" data-create-endpoint="/files/links" data-module="files">
          ${fieldHtml({ name: "label", label: "Label", required: true })}
          ${fieldHtml({ name: "url", label: "URL", required: true })}
          ${fieldHtml({ name: "provider", label: "Provider", value: "external" })}
          <button class="primary" type="submit">Create link</button>
        </form>
      </section>
    </div>`;
}

async function renderFormsModule() {
  const [definitions, submissions] = await Promise.all([api("/forms/definitions").catch(() => []), api("/forms/submissions").catch(() => [])]);
  $("moduleContent").innerHTML = `
    <div class="module-layout">
      <section class="panel">
        <div class="panel-title"><h2>Form definitions</h2><button data-refresh-module="forms">Refresh</button></div>
        <div class="list">${definitions.length ? definitions.map((row) => item(row.name, [row.form_type, row.status, row.description].filter(Boolean).join(" · "))).join("") : renderEmpty("No form definitions yet.")}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>New form definition</h2></div>
        <form class="form-grid" data-create-endpoint="/forms/definitions" data-module="forms">
          ${fieldHtml({ name: "name", label: "Name", required: true })}
          ${fieldHtml({ name: "form_type", label: "Form type", value: "general" })}
          ${fieldHtml({ name: "status", label: "Status", value: "Draft" })}
          ${fieldHtml({ name: "description", label: "Description", type: "textarea" })}
          <button class="primary" type="submit">Create form</button>
        </form>
      </section>
      <section class="panel wide">
        <div class="panel-title"><h2>Submissions</h2></div>
        <div class="list">${submissions.length ? submissions.map((row) => item(row.status, [compactId(row.form_definition_id), row.attached_entity_type].filter(Boolean).join(" · "))).join("") : renderEmpty("No form submissions yet.")}</div>
      </section>
    </div>`;
}

async function renderIntegrationsModule() {
  const connections = await api("/integrations/connections").catch((error) => {
    toast(error.message);
    return [];
  });
  $("moduleContent").innerHTML = `
    <div class="module-layout">
      <section class="panel">
        <div class="panel-title"><h2>Connections</h2><button data-refresh-module="integrations">Refresh</button></div>
        <div class="list">${connections.length ? connections.map((row) => item(row.display_name, [row.provider, row.status].filter(Boolean).join(" · "))).join("") : renderEmpty("No integration connections yet.")}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>New connection</h2></div>
        <form class="form-grid" data-create-endpoint="/integrations/connections" data-module="integrations">
          ${fieldHtml({ name: "provider", label: "Provider", required: true })}
          ${fieldHtml({ name: "display_name", label: "Display name", required: true })}
          ${fieldHtml({ name: "status", label: "Status", value: "Configured" })}
          <button class="primary" type="submit">Record connection</button>
        </form>
      </section>
    </div>`;
}

async function renderMessagesModule() {
  const [threads, users] = await Promise.all([
    api("/messages/threads").catch((error) => {
      toast(error.message);
      return [];
    }),
    api("/users").catch(() => []),
  ]);
  state.data.users = users;
  const threadMessages = {};
  await Promise.all(
    threads.slice(0, 20).map(async (thread) => {
      threadMessages[thread.id] = await api(`/messages/threads/${thread.id}/messages`).catch(() => []);
    })
  );
  state.data.messageThreads = threads;
  state.data.threadMessages = threadMessages;
  if (state.selectedThreadId && !threads.some((thread) => thread.id === state.selectedThreadId)) state.selectedThreadId = null;
  const selectedThread = threads.find((thread) => thread.id === state.selectedThreadId) || threads[0] || null;
  if (!state.selectedThreadId && selectedThread) state.selectedThreadId = selectedThread.id;
  const selectedMessages = selectedThread ? threadMessages[selectedThread.id] || (await api(`/messages/threads/${selectedThread.id}/messages`).catch(() => [])) : [];

  $("moduleContent").innerHTML = `
    <div class="messages-layout">
      <section class="panel conversation-list-panel">
        <div class="panel-title">
          <h2>Conversations</h2>
          <button type="button" data-message-panel="new" title="Start a conversation">New message</button>
        </div>
        <label>Search conversations<input class="conversation-search" data-conversation-search /></label>
        <div class="conversation-groups">
          <h3>Recent</h3>
          <div class="list conversation-list">
            ${threads.length ? threads.map((thread) => threadListItem(thread, threadMessages[thread.id] || [])).join("") : renderEmpty("No message threads yet. Start a conversation.")}
          </div>
        </div>
      </section>
      <section class="panel message-main-panel">
        ${state.messagePanel === "new" ? renderNewMessagePanel(users) : renderConversationPanel(selectedThread, selectedMessages)}
      </section>
      <section class="panel conversation-detail-panel">
        ${selectedThread ? renderConversationDetails(selectedThread) : renderEmpty("Select a conversation to see details.")}
      </section>
    </div>`;
}

function threadListItem(thread, messages = []) {
  const recentMessage = messages[messages.length - 1];
  const selected = state.selectedThreadId === thread.id ? " selected" : "";
  const label = threadTypeLabel(thread.thread_type);
  const meta = [recentMessage?.body || "No messages yet", formatDate(recentMessage?.created_at || thread.updated_at), label].filter(Boolean).join(" · ");
  return `<button type="button" class="item item-button conversation-row${selected}" data-thread-id="${escapeHtml(thread.id)}" title="Open conversation">
    <span class="conversation-avatar">${escapeHtml((thread.title || "?").slice(0, 1).toUpperCase())}</span>
    <strong>${escapeHtml(thread.title || "Untitled conversation")}</strong>
    <span>${escapeHtml(meta)}</span>
  </button>`;
}

function threadTypeLabel(type) {
  const labels = {
    direct: "Direct message",
    group: "Group message",
    project: "Project thread",
    event: "Event thread",
    team: "Team or region",
    official: "Official thread",
  };
  return labels[type] || "Conversation";
}

function renderConversationPanel(thread, messages = []) {
  if (!thread) return `<div class="panel-title"><h2>Messages</h2></div>${renderEmpty("No message threads yet. Start a conversation.")}`;
  return `<div class="conversation-view">
    <div class="conversation-header">
      <div>
        <h2>${escapeHtml(thread.title)}</h2>
        <p>${escapeHtml(threadTypeLabel(thread.thread_type))}</p>
      </div>
      <button type="button" data-refresh-module="messages" title="Reload conversation">Refresh</button>
    </div>
    <div class="message-history">
      ${messages.length ? messages.map(renderMessageBubble).join("") : renderEmpty("No messages in this conversation yet.")}
    </div>
    <form class="message-composer" data-message-thread-id="${escapeHtml(thread.id)}">
      <label class="sr-only" for="messageBody">Message</label>
      <textarea id="messageBody" name="body" required aria-label="Message"></textarea>
      <button class="primary" type="submit" title="Send message">Send</button>
    </form>
  </div>`;
}

function renderMessageBubble(message) {
  const own = message.sender_id === state.me?.id ? " own" : "";
  return `<article class="message-bubble${own}">
    <strong>${escapeHtml(userName(message.sender_id))}</strong>
    <p>${escapeHtml(message.body)}</p>
    <span>${escapeHtml(formatDate(message.created_at))}</span>
  </article>`;
}

function renderNewMessagePanel(users = []) {
  return `<div class="panel-title"><h2>New message</h2><button type="button" data-message-panel="thread">Cancel</button></div>
    <form class="form-grid" data-new-conversation>
      <label>Recipient, group, project, or event<input name="title" required list="messageTargets" /></label>
      <datalist id="messageTargets">${users.map((user) => `<option value="${escapeHtml(user.display_name)}"></option>`).join("")}</datalist>
      <label>Conversation category<select name="thread_type">
        <option value="direct">Direct message</option>
        <option value="group">Group message</option>
        <option value="project">Project thread</option>
        <option value="event">Event thread</option>
        <option value="team">Team or region thread</option>
        <option value="official">Official/admin thread</option>
      </select></label>
      <label>First message<textarea name="first_message" required></textarea></label>
      <details>
        <summary>Advanced options</summary>
        ${fieldHtml({ name: "attached_entity_type", label: "Linked record type" })}
        ${fieldHtml({ name: "attached_entity_id", label: "Linked record ID" })}
        ${fieldHtml({ name: "visibility", label: "Visibility", value: "Internal" })}
      </details>
      <button class="primary" type="submit">Start conversation</button>
    </form>`;
}

function renderConversationDetails(thread) {
  return `<div class="panel-title"><h2>Details</h2></div>
    <div class="detail-grid">
      ${detailRow("Type", threadTypeLabel(thread.thread_type))}
      ${detailRow("Visibility", thread.visibility || "Internal")}
      ${detailRow("Linked record", thread.attached_entity_type ? [thread.attached_entity_type, compactId(thread.attached_entity_id)].filter(Boolean).join(" ") : "None")}
      ${detailRow("Updated", formatDate(thread.updated_at))}
    </div>`;
}

async function renderAuditModule() {
  const audits = await api("/audit").catch((error) => {
    toast(error.message);
    return [];
  });
  $("moduleContent").innerHTML = `
    <section class="panel">
      <div class="panel-title"><h2>Recent audit entries</h2><button data-refresh-module="audit">Refresh</button></div>
      <div class="list">${audits.length ? audits.map((row) => item(row.action, [row.target_type, compactId(row.target_id), row.sensitivity, formatDate(row.created_at)].filter(Boolean).join(" · "))).join("") : renderEmpty("No audit entries available.")}</div>
    </section>`;
}

async function renderSettingsModule() {
  const me = state.me || (await api("/auth/me"));
  $("moduleContent").innerHTML = `
    <div class="module-layout">
      <section class="panel">
        <div class="panel-title"><h2>Account details</h2></div>
        <form class="form-grid" data-update-endpoint="/users/${escapeHtml(me.id)}" data-module="settings">
          ${fieldHtml({ name: "display_name", label: "Display name", value: me.display_name || "", required: true })}
          ${fieldHtml({ name: "email", label: "Email", type: "email", value: me.email || "", required: true })}
          ${fieldHtml({ name: "phone", label: "Phone", value: me.phone || "" })}
          ${fieldHtml({ name: "search_visibility", label: "Search visibility", type: "select", options: ["members", "teams", "private"], value: me.search_visibility || "members" })}
          ${fieldHtml({ name: "message_privacy", label: "Message privacy", type: "select", options: ["members", "teams", "private"], value: me.message_privacy || "members" })}
          <button class="primary" type="submit">Save profile</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Security</h2></div>
        ${item("Password", "Password changes should be handled by an authorised account workflow.")}
        ${item("Sensitive access", "HR and finance areas may ask you to re-enter your password and provide an access reason.")}
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Notifications</h2></div>
        ${item("Message alerts", "Message and task alerts appear in Notifications.")}
        ${item("Privacy", "Use message privacy and search visibility to control how others find and contact you.")}
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Display</h2></div>
        ${item("Theme", "Default professional theme")}
        ${item("Dashboard", "Calendar, tasks, notifications, progress, contacts, and modules")}
        ${item("XP visibility", `Top bar shows Level ${escapeHtml(me.level)} · ${escapeHtml(me.xp_total)} XP`)}
      </section>
    </div>`;
}

function settingValue(settings, key, fallback) {
  return settings[key] ?? fallback;
}

function settingList(value) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not configured";
  if (value && typeof value === "object") return Object.entries(value).map(([key, itemValue]) => `${key}: ${Array.isArray(itemValue) ? itemValue.join(", ") : itemValue}`).join(" · ");
  return value ?? "Not configured";
}

async function renderAdminModule() {
  const [org, settings, health, backups, permissions, regions, teams] = await Promise.all([
    api("/org").catch(() => null),
    api("/org/settings").catch(() => ({})),
    api("/health").catch((error) => ({ status: error.message })),
    api("/backups").catch(() => []),
    api("/org/permissions").catch(() => []),
    api("/org/regions").catch(() => []),
    api("/org/teams").catch(() => []),
  ]);
  const modules = settingValue(settings, "enabled_modules", []);
  const xp = settingValue(settings, "xp_settings", {});
  const finance = settingValue(settings, "finance_approval_thresholds", {});
  $("moduleContent").innerHTML = `
    <div class="admin-grid">
      <section class="panel admin-card">
        <div class="panel-title"><h2>Organisation profile</h2></div>
        ${org ? `<form class="form-grid" data-update-endpoint="/org" data-module="admin">
          ${fieldHtml({ name: "name", label: "Organisation name", value: org.name || "", required: true })}
          ${fieldHtml({ name: "short_name", label: "Short name", value: org.short_name || "", required: true })}
          ${fieldHtml({ name: "website_url", label: "Website URL", value: org.website_url || "" })}
          ${fieldHtml({ name: "country", label: "Country", value: org.country || "New Zealand" })}
          ${fieldHtml({ name: "timezone", label: "Timezone", value: org.timezone || "Pacific/Auckland" })}
          <button class="primary" type="submit">Save organisation</button>
        </form>` : renderEmpty("Organisation not configured.")}
      </section>
      <section class="panel admin-card">
        <div class="panel-title"><h2>Modules</h2></div>
        ${item("Enabled modules", settingList(modules))}
        ${item("Visibility", "Sidebar and Help hide areas the user cannot access.")}
      </section>
      <section class="panel admin-card">
        <div class="panel-title"><h2>Onboarding</h2></div>
        ${item("Mode", settingList(settings.onboarding_mode || "region approval"))}
        ${item("Regions", regions.length ? regions.map((row) => row.name).join(", ") : "No regions configured.")}
        ${item("Teams", teams.length ? teams.map((row) => row.name).join(", ") : "No teams configured.")}
      </section>
      <section class="panel admin-card">
        <div class="panel-title"><h2>Permissions and roles</h2></div>
        <div class="pill-row">${permissions.length ? permissions.map((row) => `<span class="pill">${escapeHtml(row.name)}</span>`).join("") : renderEmpty("No permission tags loaded.")}</div>
      </section>
      <section class="panel admin-card">
        <div class="panel-title"><h2>XP settings</h2></div>
        ${item("Defaults", settingList(xp))}
      </section>
      <section class="panel wide">
        <div class="panel-title"><h2>Finance thresholds</h2></div>
        ${item("Approval limits", settingList(finance))}
      </section>
      <section class="panel admin-card">
        <div class="panel-title"><h2>Privacy and security</h2></div>
        ${item("Search defaults", "Managed through personal settings and organisation policy.")}
        ${item("Sensitive records", "HR and finance access can require re-authentication and an access reason.")}
      </section>
      <section class="panel admin-card">
        <div class="panel-title"><h2>Backup and data management</h2></div>
        <div class="list">${backups.length ? backups.map((row) => item(row.backup_type, [row.status, row.storage_location, formatDate(row.verified_at)].filter(Boolean).join(" · "))).join("") : renderEmpty("No backup records yet.")}</div>
        <form class="form-grid" data-create-endpoint="/backups" data-module="admin">
          ${fieldHtml({ name: "backup_type", label: "Backup type", value: "manual" })}
          ${fieldHtml({ name: "status", label: "Status", value: "Recorded" })}
          ${fieldHtml({ name: "storage_location", label: "Storage location" })}
          <button class="primary" type="submit">Record backup</button>
        </form>
      </section>
      <section class="panel admin-card">
        <div class="panel-title"><h2>Integrations</h2></div>
        ${item("Connections", "Manage connection records in Integrations.")}
      </section>
      <section class="panel admin-card">
        <div class="panel-title"><h2>System health</h2><button data-refresh-module="admin">Refresh</button></div>
        ${item("API health", health.status || "unknown")}
        ${item("App", PRODUCT_NAME)}
      </section>
      <section class="panel wide">
        <details>
          <summary>Advanced settings</summary>
          <div class="list">${Object.keys(settings).length ? Object.entries(settings).map(([key, value]) => item(key, settingList(value))).join("") : renderEmpty("No settings found.")}</div>
        </details>
      </section>
    </div>`;
}

function renderHelpModule() {
  const cards = visibleModules(state.settings).filter((module) => module.id !== "help");
  const selectedId = state.selectedHelpId && cards.some((module) => module.id === state.selectedHelpId) ? state.selectedHelpId : cards[0]?.id;
  const selected = moduleById[selectedId];
  $("moduleContent").innerHTML = `
    <section class="panel help-panel">
      <div class="panel-title"><h2>Help centre</h2></div>
      <div class="help-layout">
        <div class="help-grid">
          ${cards.map((module) => `<button type="button" class="help-item ${module.id === selectedId ? "active" : ""}" data-help-id="${escapeHtml(module.id)}">
            ${iconSvg(module.icon)}
            <h3>${escapeHtml(module.label)}</h3>
            <p>${escapeHtml(module.summary)}</p>
          </button>`).join("")}
        </div>
        <article class="help-article">
          ${selected ? renderHelpArticle(selected.id) : renderEmpty("No help articles available for your current access.")}
        </article>
      </div>
    </section>`;
}

function renderHelpArticle(moduleId) {
  const articles = {
    dashboard: ["Dashboard", "The Dashboard brings together your calendar, assigned tasks, notifications, announcements, contacts, modules, and XP progress.", "Everyone with a CrewOps account can use it.", "Start here at the beginning of a work session, then open the module that needs attention."],
    calendar: ["Calendar", "Calendar records schedule workshops, shoots, meetings, events, and other operational dates.", "People with access to the calendar can review upcoming work and create events when authorised.", "Calendar records can connect to attendance, workshops, projects, and tasks."],
    projects: ["Projects", "Projects organise films, workshops, events, and internal work.", "Project records can connect roles, tasks, calendar events, files, equipment, messages, and budget records.", "Use projects when work needs a shared place to track people, dates, files, and decisions."],
    tasks: ["Tasks", "Tasks assign specific work to people. Use Assigned to me for your work, Created by me for work you assigned, and Halted when a task is blocked or cannot be completed on time.", "Task actions are audited. Users can edit tasks they created, tasks assigned to them, or tasks they are authorised to manage.", "Tasks may link to projects, events, members, finance records, equipment, files, HR records, or general administration."],
    members: ["Members", "Members are account holders and ongoing participants.", "Administrators manage account state and permission tags. Ordinary users can review accessible member records.", "Member privacy settings affect search visibility and messaging."],
    visitors: ["Visitors", "Visitors are guests, contacts, or non-members who should not yet have an account.", "Use visitor records for event guests, newsletter contacts, or people who may later become members.", "Visitor records can be connected to events, projects, teams, or member accounts."],
    regions: ["Teams and Regions", "Teams and Regions organise people by location, responsibility, or operating group.", "They support scoped access and clearer coordination.", "Administrators maintain the region and team lists."],
    training: ["Workshops and Training", "Training records track workshops, skills, badges, and private training notes.", "Workshop leaders and authorised users can keep training history current.", "Training may connect to events, attendance, and member skills."],
    equipment: ["Equipment", "Equipment records track assets, storage, condition, availability, and loans.", "Use equipment records before lending gear or planning project resources.", "Sensitive storage notes should stay visible only to authorised users."],
    finance: ["Finance", "Finance is used for budget requests, approvals, and finance records.", "Only authorised finance and governance users can access this area.", "Finance actions may require password re-entry and are recorded in audit history."],
    hr: ["HR", "HR is used for restricted people records.", "Only authorised HR users can access this area.", "Use HR carefully: records may require password re-entry, access reasons, and audit history."],
    messages: ["Messages", "Messages help people coordinate work across direct, project, event, team, and official conversations.", "Use New message to start a conversation, then continue from the conversation list.", "Message notifications appear for relevant users when a message is received."],
    notifications: ["Notifications", "Notifications show task alerts, message alerts, and operational prompts.", "Use unread notifications to find items needing attention.", "Notification records are personal to the recipient."],
    announcements: ["Announcements", "Announcements are organisation-wide notices, newsletter items, and important updates.", "Authorised users can draft and publish announcements.", "Use announcements for organisation-wide information, not private conversation."],
    xp: ["XP", "XP records recognise participation and completed work.", "XP appears in the top bar and Dashboard progress panel.", "XP awards should be tied to meaningful attendance, tasks, projects, or training."],
    forms: ["Forms", "Forms collect structured information for operational workflows.", "Use forms for reports, requests, and submissions that need consistent fields.", "Submissions can connect to other records where appropriate."],
    files: ["Files and Documents", "Files and Documents record uploads, storage paths, sensitivity, and external links.", "Use file records to keep project, event, finance, HR, and administration documents findable.", "Choose sensitivity carefully when recording private material."],
    integrations: ["Integrations", "Integrations record external service connections and sync activity.", "Only authorised administrators and data managers should manage connections.", "Keep credentials and service configuration outside ordinary user notes."],
    audit: ["Reports and Audit", "Reports and Audit show important changes across the system.", "Governance, data management, and administrators use audit records for oversight.", "Audit records help explain who changed what and when."],
    settings: ["Settings", "Settings are personal account, privacy, notification, display, and XP visibility preferences.", "Every user can manage their own profile and privacy settings.", "Organisation controls live in Admin/System."],
    admin: ["Admin/System", "Admin/System contains organisation profile, modules, onboarding, permissions, regions, XP, finance thresholds, backups, integrations, and health.", "Only authorised administrators and data managers should use this area.", "Use this area carefully because changes can affect the whole organisation."],
  };
  const article = articles[moduleId] || [moduleById[moduleId]?.label || "Help", moduleById[moduleId]?.summary || "", "Use this area when your role requires it.", "Open the module from the sidebar to continue."];
  return `<h2>${escapeHtml(article[0])}</h2>
    <div class="list">
      ${item("What it is for", article[1])}
      ${item("Who can use it", article[2])}
      ${item("Where to go next", article[3])}
    </div>`;
}

async function renderModule(id) {
  if (!requireSession()) return;
  const module = moduleById[id] || moduleById.dashboard;
  if (!canAccessModule(module.id)) {
    setActiveNav("dashboard");
    $("moduleTitle").textContent = module.label;
    $("moduleSubtitle").textContent = "Only authorised users can access this area.";
    $("moduleActions").innerHTML = "";
    $("moduleContent").innerHTML = renderEmpty("You do not have permission to view this area.");
    show("moduleView");
    return;
  }
  setActiveNav(module.id);
  if (module.id === "dashboard") {
    await loadDashboard();
    if (!state.me) return;
    show("dashboardView");
    return;
  }
  $("moduleTitle").textContent = module.label;
  $("moduleSubtitle").textContent = module.summary;
  $("moduleActions").innerHTML = `<button data-refresh-module="${module.id}">Refresh</button>`;
  $("moduleContent").innerHTML = renderEmpty("Loading...");
  show("moduleView");

  if (module.id === "tasks") await renderTasksModule();
  else if (module.id === "equipment") await renderEquipmentModule();
  else if (module.id === "finance") await renderFinanceModule();
  else if (module.id === "messages") await renderMessagesModule();
  else if (resourceModules[module.id]) await renderResourceModule(module.id);
  else if (module.id === "regions") await renderRegionsModule();
  else if (module.id === "training") await renderTrainingModule();
  else if (module.id === "forms") await renderFormsModule();
  else if (module.id === "integrations") await renderIntegrationsModule();
  else if (module.id === "files") await renderFilesModule();
  else if (module.id === "audit") await renderAuditModule();
  else if (module.id === "settings") await renderSettingsModule();
  else if (module.id === "admin") await renderAdminModule();
  else if (module.id === "help") renderHelpModule();
}

function enabledModules(settings) {
  const enabled = settings.enabled_modules || [];
  const modules = !enabled.length ? moduleList : moduleList.filter((module) => {
    if (module.id === "dashboard" || module.id === "help") return true;
    const aliases = [module.id, module.label, ...(moduleAliases[module.id] || [])];
    return aliases.some((alias) => enabled.includes(alias));
  });
  return modules;
}

function visibleModules(settings) {
  return enabledModules(settings).filter((module) => canAccessModule(module.id));
}

function renderModules(settings) {
  $("moduleGrid").innerHTML = visibleModules(settings)
    .filter((module) => module.id !== "dashboard")
    .map((module) => `<button class="module" data-module="${module.id}"><span class="module-title">${iconSvg(module.icon)}<strong>${escapeHtml(module.label)}</strong></span><span>${escapeHtml(module.summary)}</span></button>`)
    .join("");
}

async function loadDashboard() {
  if (!requireSession()) return;
  const [settings, events, tasks, users, notifications, announcements, threads] = await Promise.all([
    api("/org/settings").catch(() => ({})),
    api("/calendar/events").catch(() => []),
    api("/tasks?assigned_to_me=true").catch(() => []),
    api("/users").catch(() => []),
    api("/notifications").catch(() => []),
    api("/announcements").catch(() => []),
    api("/messages/threads").catch(() => []),
  ]);
  state.settings = settings;
  renderNav();
  renderModules(settings);
  $("calendarList").innerHTML = events.length
    ? events.map((event) => item(event.title, `${event.event_type || "Event"} · ${formatDate(event.starts_at)}`)).join("")
    : item("No calendar events yet", "Create your first workshop, shoot, meeting, or event when a date is known.");
  $("taskList").innerHTML = tasks.length
    ? tasks.slice(0, 6).map((task) => item(task.title, `${task.status} · ${task.priority}${task.due_at ? ` · ${formatDate(task.due_at)}` : ""}`)).join("")
    : item("No tasks assigned to you", "Tasks assigned to you will appear here.");
  $("notificationList").innerHTML = notifications.length
    ? notifications.slice(0, 5).map((note) => item(note.title, [note.read_at ? "Read" : "Unread", note.body].filter(Boolean).join(" · "))).join("")
    : item("No notifications", "Personal alerts and action prompts will appear here.");
  $("announcementList").innerHTML = announcements.length
    ? announcements.slice(0, 4).map((announcement) => item(announcement.title, [announcement.category, announcement.status].filter(Boolean).join(" · "))).join("")
    : item("No announcements", "Published organisation updates will appear here.");
  $("messageList").innerHTML = threads.length
    ? threads.slice(0, 4).map((thread) => item(thread.title, [threadTypeLabel(thread.thread_type), formatDate(thread.updated_at)].filter(Boolean).join(" · "))).join("")
    : item("No recent messages", "Conversations will appear here once messages are active.");
  const level = state.me?.level || 1;
  const xp = state.me?.xp_total || 0;
  const progress = Math.min(100, xp % 100);
  $("progressCard").innerHTML = `
    <div class="progress-row"><strong>Level ${escapeHtml(level)}</strong><span>${escapeHtml(xp)} XP</span></div>
    <div class="progress-track"><span style="width: ${progress}%"></span></div>
    <p>${100 - progress} XP to the next level.</p>`;
  $("contactList").innerHTML = users.length
    ? users.slice(0, 8).map((user) => item(user.display_name, `${user.member_type} · ${user.account_status}`)).join("")
    : item("No members yet", "Create member accounts when people need access.");
  setActiveNav("dashboard");
}

async function boot() {
  setAuthenticatedUi(false);
  renderShellIcons();
  renderNav();
  const setup = await api("/setup/status", { allowUnauthenticated: true });
  if (!setup.setup_complete) {
    show("setupView");
    return;
  }
  if (!state.token) {
    show("loginView");
    return;
  }
  try {
    state.me = await api("/auth/me");
    setAuthenticatedUi(true);
    $("welcome").textContent = `Welcome, ${state.me.display_name}`;
    $("avatar").textContent = state.me.display_name.slice(0, 1).toUpperCase();
    $("levelLabel").textContent = `Level ${state.me.level} · ${state.me.xp_total} XP`;
    $("xpFill").style.width = `${Math.min(100, state.me.xp_total % 100)}%`;
    $("brandName").textContent = setup.organisation_name || PRODUCT_NAME;
    document.title = setup.organisation_name || PRODUCT_NAME;
    await renderModule(state.activeModule || "dashboard");
  } catch (error) {
    resetAuth();
  }
}

$("toggleSidebar").addEventListener("click", () => $("sidebar").classList.toggle("collapsed"));
$("refresh").addEventListener("click", () => {
  if (!requireSession()) return;
  loadDashboard().then(() => toast("Dashboard refreshed")).catch((error) => toast(error.message));
});
$("settingsButton").addEventListener("click", () => renderModule("settings").catch((error) => toast(error.message)));
$("helpButton").addEventListener("click", () => renderModule("help").catch((error) => toast(error.message)));
$("notificationButton").addEventListener("click", () => renderModule("notifications").catch((error) => toast(error.message)));
$("floatingMessages").addEventListener("click", () => renderModule("messages").catch((error) => toast(error.message)));
$("avatar").addEventListener("click", () => {
  if (!requireSession()) return;
  resetAuth();
  toast("Signed out");
});

$("search").addEventListener("input", (event) => {
  const needle = event.target.value.trim().toLowerCase();
  for (const row of document.querySelectorAll(".item, .module")) {
    row.style.display = !needle || row.textContent.toLowerCase().includes(needle) ? "" : "none";
  }
});

$("moduleContent").addEventListener("input", (event) => {
  const search = event.target.closest("[data-conversation-search]");
  if (!search) return;
  const needle = search.value.trim().toLowerCase();
  for (const row of document.querySelectorAll(".conversation-row")) {
    row.style.display = !needle || row.textContent.toLowerCase().includes(needle) ? "" : "none";
  }
});

$("nav").addEventListener("click", (event) => {
  if (!requireSession()) return;
  const button = event.target.closest("button[data-module]");
  if (!button) return;
  renderModule(button.dataset.module).catch((error) => toast(error.message));
});

$("moduleGrid").addEventListener("click", (event) => {
  if (!requireSession()) return;
  const button = event.target.closest("button[data-module]");
  if (!button) return;
  renderModule(button.dataset.module).catch((error) => toast(error.message));
});

$("moduleContent").addEventListener("click", (event) => {
  if (!requireSession()) return;
  const filterButton = event.target.closest("button[data-task-filter]");
  if (filterButton) {
    state.taskFilter = filterButton.dataset.taskFilter;
    state.selectedTaskId = null;
    state.taskPanel = "view";
    renderTasksModule().catch((error) => toast(error.message));
    return;
  }
  const panelButton = event.target.closest("button[data-task-panel]");
  if (panelButton) {
    state.taskPanel = panelButton.dataset.taskPanel;
    renderTasksModule().catch((error) => toast(error.message));
    return;
  }
  const messagePanelButton = event.target.closest("button[data-message-panel]");
  if (messagePanelButton) {
    state.messagePanel = messagePanelButton.dataset.messagePanel;
    renderMessagesModule().catch((error) => toast(error.message));
    return;
  }
  const threadButton = event.target.closest("button[data-thread-id]");
  if (threadButton) {
    state.selectedThreadId = threadButton.dataset.threadId;
    state.messagePanel = "thread";
    renderMessagesModule().catch((error) => toast(error.message));
    return;
  }
  const helpButton = event.target.closest("button[data-help-id]");
  if (helpButton) {
    state.selectedHelpId = helpButton.dataset.helpId;
    renderHelpModule();
    return;
  }
  const taskButton = event.target.closest("button[data-task-id]");
  if (taskButton) {
    state.selectedTaskId = taskButton.dataset.taskId;
    state.taskPanel = "view";
    renderTasksModule().catch((error) => toast(error.message));
    return;
  }
  const statusButton = event.target.closest("button[data-task-status-id]");
  if (statusButton) {
    api(`/tasks/${statusButton.dataset.taskStatusId}/status?status=${encodeURIComponent(statusButton.dataset.taskStatus)}`, { method: "PATCH" })
      .then(() => {
        toast(statusButton.dataset.taskStatus === "Done" ? "Task marked done" : "Task reopened");
        return renderTasksModule();
      })
      .catch((error) => toast(error.message));
    return;
  }
  const button = event.target.closest("button[data-refresh-module]");
  if (!button) return;
  renderModule(button.dataset.refreshModule).catch((error) => toast(error.message));
});

$("moduleActions").addEventListener("click", (event) => {
  if (!requireSession()) return;
  const button = event.target.closest("button[data-refresh-module]");
  if (!button) return;
  renderModule(button.dataset.refreshModule).catch((error) => toast(error.message));
});

$("moduleContent").addEventListener("submit", async (event) => {
  if (!requireSession()) return;
  const form = event.target.closest("form");
  if (!form) return;
  event.preventDefault();
  if (form.dataset.taskHaltId) {
    const payload = payloadFromForm(form);
    try {
      await api(`/tasks/${form.dataset.taskHaltId}/status?status=Halted&reason=${encodeURIComponent(payload.reason || "")}`, { method: "PATCH" });
      toast("Task marked halted");
      state.taskPanel = "view";
      await renderTasksModule();
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (form.dataset.messageThreadId) {
    const payload = payloadFromForm(form);
    try {
      await api(`/messages/threads/${form.dataset.messageThreadId}/messages`, { method: "POST", body: JSON.stringify({ body: payload.body }) });
      toast("Message sent");
      form.reset();
      await renderMessagesModule();
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (form.hasAttribute("data-new-conversation")) {
    const payload = payloadFromForm(form);
    const firstMessage = payload.first_message;
    delete payload.first_message;
    try {
      const thread = await api("/messages/threads", { method: "POST", body: JSON.stringify(payload) });
      if (firstMessage) {
        await api(`/messages/threads/${thread.id}/messages`, { method: "POST", body: JSON.stringify({ body: firstMessage }) });
      }
      state.selectedThreadId = thread.id;
      state.messagePanel = "thread";
      toast("Conversation started");
      await renderMessagesModule();
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (form.dataset.reauthModule) {
    const payload = payloadFromForm(form);
    state.reauth[form.dataset.reauthModule] = { password: payload.password, reason: payload.reason };
    form.reset();
    await renderModule(form.dataset.reauthModule);
    return;
  }
  if (form.dataset.uploadEndpoint) {
    try {
      await api(form.dataset.uploadEndpoint, { method: "POST", body: new FormData(form) });
      toast("Uploaded");
      form.reset();
      await renderModule(form.dataset.module || state.activeModule);
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  const payload = payloadFromForm(form);
  const endpoint = form.dataset.createEndpoint || form.dataset.updateEndpoint;
  const method = form.dataset.updateEndpoint ? "PATCH" : "POST";
  const options = { method, body: JSON.stringify(payload) };
  if (form.dataset.module === "hr" || form.dataset.module === "finance") {
    Object.assign(options, sensitiveOptions(form.dataset.module));
  }
  try {
    const saved = await api(endpoint, options);
    if (form.dataset.module === "tasks" && saved?.id) {
      state.selectedTaskId = saved.id;
      state.taskPanel = "view";
    }
    toast("Saved");
    form.reset();
    await renderModule(form.dataset.module || state.activeModule);
  } catch (error) {
    toast(error.message);
  }
});

$("setupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  payload.default_regions = String(payload.default_regions)
    .split(/\r?\n|,/)
    .map((region) => region.trim())
    .filter(Boolean);
  try {
    const token = await api("/setup/complete", { method: "POST", body: JSON.stringify(payload) });
    state.token = token.access_token;
    localStorage.setItem("crewopsToken", state.token);
    toast("Organisation created");
    await boot();
  } catch (error) {
    toast(error.message);
  }
});

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = new URLSearchParams();
  body.set("username", form.get("username"));
  body.set("password", form.get("password"));
  try {
    const token = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    state.token = token.access_token;
    localStorage.setItem("crewopsToken", state.token);
    await boot();
  } catch (error) {
    toast(error.message);
  }
});

$("quickTask").addEventListener("click", async () => {
  if (!requireSession()) return;
  await renderModule("tasks");
  $("moduleContent").querySelector('form[data-create-endpoint="/tasks"] input[name="title"]')?.focus();
});

$("quickEvent").addEventListener("click", async () => {
  if (!requireSession()) return;
  await renderModule("calendar");
  $("moduleContent").querySelector('form[data-create-endpoint="/calendar/events"] input[name="title"]')?.focus();
});

boot().catch((error) => toast(error.message));
