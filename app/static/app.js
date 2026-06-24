const state = {
  token: localStorage.getItem("crewopsToken"),
  me: null,
  settings: {},
  activeModule: "dashboard",
  data: {},
  reauth: {},
  selectedTaskId: null,
};

const PRODUCT_NAME = "Kairix CrewOps";

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
  { id: "messages", label: "Messages", icon: "messages", summary: "Internal threads for people, projects, events, and teams." },
  { id: "notifications", label: "Notifications", icon: "notifications", summary: "Personal alerts and operational notices." },
  { id: "announcements", label: "Announcements", icon: "announcements", summary: "Noticeboard posts, newsletters, and important updates." },
  { id: "xp", label: "XP", icon: "xp", summary: "Experience awards connected to attendance, tasks, and projects." },
  { id: "forms", label: "Forms", icon: "forms", summary: "Forms and submissions for operational workflows." },
  { id: "files", label: "Files/Documents", icon: "files", summary: "File records, uploads, and external document links." },
  { id: "integrations", label: "Integrations", icon: "integrations", summary: "Connection records for external services and sync activity." },
  { id: "audit", label: "Reports/Audit", icon: "audit", summary: "Audit history and oversight records." },
  { id: "settings", label: "Settings", icon: "settings", summary: "Organisation branding, defaults, modules, and thresholds." },
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
      { name: "status", label: "Status", type: "select", options: ["To Do", "In Progress", "Waiting", "Complete", "Cancelled"], value: "To Do" },
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
  $("nav").innerHTML = moduleList
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

function item(title, meta = "", extra = "") {
  return `<div class="item"><strong>${escapeHtml(title || "Untitled")}</strong><span>${escapeHtml(meta || "")}</span>${extra}</div>`;
}

function taskListItem(task) {
  const selected = state.selectedTaskId === task.id ? " selected" : "";
  const meta = [task.status, task.priority, formatDate(task.due_at), task.description].filter(Boolean).join(" · ");
  return `<button type="button" class="item item-button${selected}" data-task-id="${escapeHtml(task.id)}">
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
    return `<label>${escapeHtml(field.label)}<select name="${field.name}"${required}>${users.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.display_name)} (${escapeHtml(user.username)})</option>`).join("")}</select></label>`;
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
  const tasks = await api("/tasks?assigned_to_me=false").catch((error) => {
    toast(error.message);
    return [];
  });
  state.data.tasks = tasks;
  if (state.selectedTaskId && !tasks.some((task) => task.id === state.selectedTaskId)) {
    state.selectedTaskId = null;
  }
  const selectedTask = tasks.find((task) => task.id === state.selectedTaskId) || tasks[0] || null;
  if (!state.selectedTaskId && selectedTask) state.selectedTaskId = selectedTask.id;

  $("moduleContent").innerHTML = `
    <div class="module-layout">
      <section class="panel">
        <div class="panel-title"><h2>Tasks</h2><button data-refresh-module="tasks">Refresh</button></div>
        <div class="list module-records">
          ${tasks.length ? tasks.map(taskListItem).join("") : renderEmpty("No tasks yet.")}
        </div>
      </section>
      <section class="panel">
        ${selectedTask ? renderTaskDetails(selectedTask) : `<div class="panel-title"><h2>Task details</h2></div>${renderEmpty("Select a task to edit it, or create a new one below.")}`}
      </section>
      <section class="panel wide">
        <div class="panel-title"><h2>New task</h2></div>
        ${renderTaskCreateForm()}
      </section>
    </div>`;
}

function renderTaskCreateForm() {
  return `<form class="form-grid" data-create-endpoint="/tasks" data-module="tasks">
    ${fieldHtml({ name: "title", label: "Title", required: true })}
    ${fieldHtml({ name: "priority", label: "Priority", type: "select", options: ["Low", "Normal", "High", "Urgent"], value: "Normal" })}
    ${fieldHtml({ name: "status", label: "Status", type: "select", options: ["To Do", "In Progress", "Waiting", "Complete", "Cancelled"], value: "To Do" })}
    ${fieldHtml({ name: "due_at", label: "Due", type: "datetime-local" })}
    ${fieldHtml({ name: "description", label: "Description", type: "textarea" })}
    <button class="primary" type="submit">Create task</button>
  </form>`;
}

function renderTaskDetails(task) {
  const canComplete = task.status !== "Complete";
  return `<div class="panel-title"><h2>Edit task</h2><span class="pill">${escapeHtml(task.status)}</span></div>
    <form class="form-grid" data-update-endpoint="/tasks/${escapeHtml(task.id)}" data-module="tasks">
      ${fieldHtml({ name: "title", label: "Title", required: true, value: task.title || "" })}
      ${fieldHtml({ name: "priority", label: "Priority", type: "select", options: ["Low", "Normal", "High", "Urgent"], value: task.priority || "Normal" })}
      ${fieldHtml({ name: "status", label: "Status", type: "select", options: ["To Do", "In Progress", "Waiting", "Complete", "Cancelled"], value: task.status || "To Do" })}
      ${fieldHtml({ name: "due_at", label: "Due", type: "datetime-local", value: formatDatetimeLocal(task.due_at) })}
      ${fieldHtml({ name: "description", label: "Description", type: "textarea", value: task.description || "" })}
      <div class="actions">
        <button class="primary" type="submit">Save task</button>
        <button type="button" data-task-status-id="${escapeHtml(task.id)}" data-task-status="${canComplete ? "Complete" : "To Do"}">${canComplete ? "Mark complete" : "Reopen"}</button>
      </div>
    </form>`;
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
  const [org, settings] = await Promise.all([api("/org").catch(() => null), api("/org/settings").catch(() => ({}))]);
  $("moduleContent").innerHTML = `
    <div class="module-layout">
      <section class="panel">
        <div class="panel-title"><h2>Organisation</h2></div>
        ${org ? item(org.name, [org.short_name, org.website_url, org.country, org.timezone].filter(Boolean).join(" · ")) : renderEmpty("Organisation not loaded.")}
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Edit organisation</h2></div>
        <form class="form-grid" data-update-endpoint="/org" data-module="settings">
          ${fieldHtml({ name: "name", label: "Organisation name", value: org?.name || "", required: true })}
          ${fieldHtml({ name: "short_name", label: "Short name", value: org?.short_name || "", required: true })}
          ${fieldHtml({ name: "website_url", label: "Website URL", value: org?.website_url || "" })}
          ${fieldHtml({ name: "country", label: "Country", value: org?.country || "New Zealand" })}
          ${fieldHtml({ name: "timezone", label: "Timezone", value: org?.timezone || "Pacific/Auckland" })}
          <button class="primary" type="submit">Save organisation</button>
        </form>
      </section>
      <section class="panel wide">
        <div class="panel-title"><h2>Current settings</h2></div>
        <div class="list">${Object.keys(settings).length ? Object.entries(settings).map(([key, value]) => item(key, JSON.stringify(value))).join("") : renderEmpty("No settings found.")}</div>
      </section>
    </div>`;
}

async function renderAdminModule() {
  const [health, backups, permissions] = await Promise.all([
    api("/health").catch((error) => ({ status: error.message })),
    api("/backups").catch(() => []),
    api("/org/permissions").catch(() => []),
  ]);
  $("moduleContent").innerHTML = `
    <div class="module-layout">
      <section class="panel">
        <div class="panel-title"><h2>System health</h2><button data-refresh-module="admin">Refresh</button></div>
        ${item("API health", health.status || "unknown")}
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Record backup</h2></div>
        <form class="form-grid" data-create-endpoint="/backups" data-module="admin">
          ${fieldHtml({ name: "backup_type", label: "Backup type", value: "manual" })}
          ${fieldHtml({ name: "status", label: "Status", value: "Recorded" })}
          ${fieldHtml({ name: "storage_location", label: "Storage location" })}
          <button class="primary" type="submit">Record backup</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Backups</h2></div>
        <div class="list">${backups.length ? backups.map((row) => item(row.backup_type, [row.status, row.storage_location, formatDate(row.verified_at)].filter(Boolean).join(" · "))).join("") : renderEmpty("No backup records yet.")}</div>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>Permission tags</h2></div>
        <div class="pill-row">${permissions.length ? permissions.map((row) => `<span class="pill">${escapeHtml(row.name)}</span>`).join("") : renderEmpty("No permission tags loaded.")}</div>
      </section>
    </div>`;
}

function renderHelpModule() {
  const canFinance = isAdministrator() || hasAnyPermission(["Treasurer", "Finance Trainee", "Finance Assistant", "Finance Officer", "Finance Manager", "Board Member", "Founding Board Member", "Chair"]);
  const canHr = isAdministrator() || hasAnyPermission(["HR Trainee", "HR Assistant", "HR Officer", "HR Manager"]);
  const canAdmin = isAdministrator() || hasAnyPermission(["Data Management"]);
  const sections = [
    ["Getting started", `Sign in, review the Dashboard, then use ${state.settings.organisation_short_name || "CrewOps"} modules to record the work your organisation is managing. Use Settings to keep organisation details current.`],
    ["Dashboard", "Use the Dashboard for today’s calendar, open tasks, notifications, announcements, recent contacts, and level progress."],
    ["Calendar", "Use Calendar to schedule workshops, shoots, meetings, events, and other dates. Calendar records can support attendance and operational planning."],
    ["Projects", "Use Projects to organise films, workshops, events, and internal work. A project can include roles, tasks, calendar events, files, equipment requests, messages, and budget records."],
    ["Tasks", "Use Tasks to assign work, track priority and due dates, and mark items complete. You can edit tasks you created, tasks assigned to you, or tasks you are authorised to manage."],
    ["Members and visitors", "Use Members for account holders and ongoing participants. Use Visitors for guests, contacts, and people who should not yet have a login."],
    ["Teams and regions", "Use Teams and Regions to group people, scope access, and keep work organised across locations or operating groups."],
    ["Equipment", "Use Equipment to record assets, storage locations, condition, availability, and loans."],
    ["Finance", canFinance ? "Use Finance to raise budget requests, review approvals, and record finance-sensitive information." : "Finance is available to authorised finance and governance users."],
    ["HR", canHr ? "Use HR for restricted people records that require additional care and audit history." : "HR is available only to authorised people-team users."],
    ["Messages and notifications", "Use Messages for internal threads and Notifications for personal alerts or action prompts."],
    ["Files and documents", "Use Files and Documents to record uploaded files, local storage details, sensitivity, and external links."],
    ["Reports and audit", "Use Reports and Audit to review important changes and support oversight."],
    ["Settings", "Use Settings to update organisation details, defaults, enabled areas, and operational thresholds."],
    ["Admin/system tools", canAdmin ? "Use Admin/System for health checks, backup records, permission tags, and system-level operations." : "Admin/System tools are available to authorised administrators and data managers."],
  ];
  $("moduleContent").innerHTML = `
    <section class="panel help-panel">
      <div class="panel-title"><h2>Using CrewOps</h2></div>
      <div class="help-grid">
        ${sections.map(([title, body]) => `<article class="help-item"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></article>`).join("")}
      </div>
    </section>`;
}

async function renderModule(id) {
  if (!requireSession()) return;
  const module = moduleById[id] || moduleById.dashboard;
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
  if (!enabled.length) return moduleList;
  return moduleList.filter((module) => {
    if (module.id === "dashboard" || module.id === "help") return true;
    const aliases = [module.id, module.label, ...(moduleAliases[module.id] || [])];
    return aliases.some((alias) => enabled.includes(alias));
  });
}

function renderModules(settings) {
  $("moduleGrid").innerHTML = enabledModules(settings)
    .filter((module) => module.id !== "dashboard")
    .map((module) => `<button class="module" data-module="${module.id}"><span class="module-title">${iconSvg(module.icon)}<strong>${escapeHtml(module.label)}</strong></span><span>${escapeHtml(module.summary)}</span></button>`)
    .join("");
}

async function loadDashboard() {
  if (!requireSession()) return;
  const [settings, events, tasks, users, notifications, announcements] = await Promise.all([
    api("/org/settings").catch(() => ({})),
    api("/calendar/events").catch(() => []),
    api("/tasks?assigned_to_me=false").catch(() => []),
    api("/users").catch(() => []),
    api("/notifications").catch(() => []),
    api("/announcements").catch(() => []),
  ]);
  state.settings = settings;
  renderModules(settings);
  $("calendarList").innerHTML = events.length
    ? events.map((event) => item(event.title, `${event.event_type || "Event"} · ${formatDate(event.starts_at)}`)).join("")
    : item("No calendar events yet", "Create your first workshop, shoot, meeting, or event when a date is known.");
  $("taskList").innerHTML = tasks.length
    ? tasks.slice(0, 6).map((task) => item(task.title, `${task.status} · ${task.priority}${task.due_at ? ` · ${formatDate(task.due_at)}` : ""}`)).join("")
    : item("No tasks yet", "Create your first task to track operational work and ownership.");
  $("notificationList").innerHTML = notifications.length
    ? notifications.slice(0, 5).map((note) => item(note.title, [note.read_at ? "Read" : "Unread", note.body].filter(Boolean).join(" · "))).join("")
    : item("No notifications", "Personal alerts and action prompts will appear here.");
  $("announcementList").innerHTML = announcements.length
    ? announcements.slice(0, 4).map((announcement) => item(announcement.title, [announcement.category, announcement.status].filter(Boolean).join(" · "))).join("")
    : item("No announcements", "Published organisation updates will appear here.");
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
  const taskButton = event.target.closest("button[data-task-id]");
  if (taskButton) {
    state.selectedTaskId = taskButton.dataset.taskId;
    renderTasksModule().catch((error) => toast(error.message));
    return;
  }
  const statusButton = event.target.closest("button[data-task-status-id]");
  if (statusButton) {
    api(`/tasks/${statusButton.dataset.taskStatusId}/status?status=${encodeURIComponent(statusButton.dataset.taskStatus)}`, { method: "PATCH" })
      .then(() => {
        toast(statusButton.dataset.taskStatus === "Complete" ? "Task completed" : "Task reopened");
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
