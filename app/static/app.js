const state = {
  token: localStorage.getItem("crewopsToken"),
  me: null,
  settings: {},
  activeModule: "dashboard",
  data: {},
};

const moduleList = [
  { id: "dashboard", label: "Dashboard", icon: "⌂", summary: "Calendar, tasks, contacts, and module status." },
  { id: "calendar", label: "Calendar", icon: "◇", summary: "Events, workshops, shoots, meetings, and attendance-ready dates." },
  { id: "projects", label: "Projects", icon: "▣", summary: "Operational projects, productions, workshops, and public activities." },
  { id: "tasks", label: "Tasks", icon: "✓", summary: "Global tasks attached to any operational record." },
  { id: "members", label: "Members", icon: "◌", summary: "Accounts, membership state, XP, and permission tags." },
  { id: "visitors", label: "Visitors", icon: "◎", summary: "Lightweight non-member records that can later link to accounts." },
  { id: "regions", label: "Teams/Regions", icon: "⌘", summary: "Editable regions and teams for scoped access." },
  { id: "training", label: "Workshops/Training", icon: "✦", summary: "Workshop records, skills, and training history." },
  { id: "equipment", label: "Equipment", icon: "▤", summary: "Assets, gear status, storage notes, and loan planning." },
  { id: "finance", label: "Finance", icon: "$", summary: "Budget requests, approvals, and finance-sensitive records." },
  { id: "hr", label: "HR", icon: "◈", summary: "Compartmentalised HR notes and sensitive people records." },
  { id: "messages", label: "Messages", icon: "✉", summary: "Internal threads for people, projects, events, and teams." },
  { id: "notifications", label: "Notifications", icon: "●", summary: "Personal alerts and official system notifications." },
  { id: "announcements", label: "Announcements", icon: "◍", summary: "Noticeboard posts, newsletters, and important updates." },
  { id: "xp", label: "XP", icon: "↗", summary: "Experience awards connected to attendance, tasks, projects, and training." },
  { id: "forms", label: "Forms", icon: "▥", summary: "Form definitions and submissions for operational workflows." },
  { id: "files", label: "Files/Documents", icon: "□", summary: "Local file metadata and compact external links." },
  { id: "integrations", label: "Integrations", icon: "⇄", summary: "Future connections to Google, Xero, email, files, and automation." },
  { id: "audit", label: "Reports/Audit", icon: "≡", summary: "Audit history and oversight records." },
  { id: "settings", label: "Settings", icon: "⚙", summary: "Organisation branding, defaults, modules, and thresholds." },
  { id: "admin", label: "Admin/System", icon: "⌬", summary: "Health, backups, permissions, and system operations." },
  { id: "help", label: "Help", icon: "?", summary: "Module guide and v1 operating notes." },
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
    endpoint: "/hr/records?reason=Routine%20HR%20module%20review",
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

function toast(message) {
  const box = $("toast");
  box.textContent = String(message);
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 4200);
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || response.statusText);
  }
  return response.json();
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
    .map((module) => `<button data-module="${module.id}" class="${module.id === state.activeModule ? "active" : ""}" title="${escapeHtml(module.label)}"><b>${module.icon}</b><span>${escapeHtml(module.label)}</span></button>`)
    .join("");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function compactId(value) {
  return value ? `id ${String(value).slice(0, 8)}` : "";
}

function tags(values) {
  return Array.isArray(values) && values.length ? values.join(", ") : "";
}

function item(title, meta = "", extra = "") {
  return `<div class="item"><strong>${escapeHtml(title || "Untitled")}</strong><span>${escapeHtml(meta || "")}</span>${extra}</div>`;
}

function renderEmpty(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
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
  const rows = await api(config.endpoint).catch((error) => {
    toast(error.message);
    return [];
  });
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
  const [budgets, records] = await Promise.all([api("/finance/budget-requests").catch(() => []), api("/finance/records").catch(() => [])]);
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
        <div class="panel-title"><h2>New planned connection</h2></div>
        <form class="form-grid" data-create-endpoint="/integrations/connections" data-module="integrations">
          ${fieldHtml({ name: "provider", label: "Provider", required: true })}
          ${fieldHtml({ name: "display_name", label: "Display name", required: true })}
          ${fieldHtml({ name: "status", label: "Status", value: "Planned" })}
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
  $("moduleContent").innerHTML = `
    <section class="panel">
      <h2>V1 operating notes</h2>
      <div class="list">
        ${item("Broad but shallow", "Each module starts with core create/list workflows and audited API records.")}
        ${item("Sensitive areas", "HR and finance routes are permission-checked and create audit records.")}
        ${item("Portainer deployment", "Deploy from the public GitHub repository and keep secrets in stack environment variables.")}
        ${item("Stable v1", "The system has reachable create/list workflows across the core modules, with audit logging on operational changes.")}
      </div>
    </section>`;
}

async function renderModule(id) {
  const module = moduleById[id] || moduleById.dashboard;
  setActiveNav(module.id);
  if (module.id === "dashboard") {
    await loadDashboard();
    show("dashboardView");
    return;
  }
  $("moduleTitle").textContent = module.label;
  $("moduleSubtitle").textContent = module.summary;
  $("moduleActions").innerHTML = `<button data-refresh-module="${module.id}">Refresh</button>`;
  $("moduleContent").innerHTML = renderEmpty("Loading...");
  show("moduleView");

  if (module.id === "equipment") await renderEquipmentModule();
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
    .map((module) => `<button class="module" data-module="${module.id}"><strong>${module.icon} ${escapeHtml(module.label)}</strong><span>${escapeHtml(module.summary)}</span></button>`)
    .join("");
}

async function loadDashboard() {
  const [settings, events, tasks, users] = await Promise.all([
    api("/org/settings").catch(() => ({})),
    api("/calendar/events").catch(() => []),
    api("/tasks?assigned_to_me=false").catch(() => []),
    api("/users").catch(() => []),
  ]);
  state.settings = settings;
  renderModules(settings);
  $("calendarList").innerHTML = events.length
    ? events.map((event) => item(event.title, `${event.event_type || "Event"} · ${formatDate(event.starts_at)}`)).join("")
    : item("No calendar events yet", "Create one when your first workshop, shoot, or meeting is known.");
  $("taskList").innerHTML = tasks.length
    ? tasks.map((task) => item(task.title, `${task.status} · ${task.priority}`)).join("")
    : item("No tasks yet", "Operational tasks can attach to projects, events, finance, HR, equipment, or general admin.");
  $("contactList").innerHTML = users.length
    ? users.slice(0, 8).map((user) => item(user.display_name, `${user.member_type} · ${user.account_status}`)).join("")
    : item("No members yet", "The first administrator was created during setup.");
  setActiveNav("dashboard");
}

async function boot() {
  renderNav();
  const setup = await api("/setup/status");
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
    $("welcome").textContent = `Welcome, ${state.me.display_name}`;
    $("avatar").textContent = state.me.display_name.slice(0, 1).toUpperCase();
    $("levelLabel").textContent = `Level ${state.me.level}`;
    $("xpFill").style.width = `${Math.min(100, state.me.xp_total % 100)}%`;
    $("brandName").textContent = setup.organisation_name || "CrewOps";
    await renderModule(state.activeModule || "dashboard");
  } catch (error) {
    localStorage.removeItem("crewopsToken");
    state.token = null;
    show("loginView");
  }
}

$("toggleSidebar").addEventListener("click", () => $("sidebar").classList.toggle("collapsed"));
$("refresh").addEventListener("click", () => loadDashboard().then(() => toast("Dashboard refreshed")).catch((error) => toast(error.message)));
$("settingsButton").addEventListener("click", () => renderModule("settings").catch((error) => toast(error.message)));
$("helpButton").addEventListener("click", () => renderModule("help").catch((error) => toast(error.message)));
$("notificationButton").addEventListener("click", () => renderModule("notifications").catch((error) => toast(error.message)));
$("avatar").addEventListener("click", () => {
  if (confirm("Log out of CrewOps?")) {
    localStorage.removeItem("crewopsToken");
    state.token = null;
    show("loginView");
  }
});

$("search").addEventListener("input", (event) => {
  const needle = event.target.value.trim().toLowerCase();
  for (const row of document.querySelectorAll(".item, .module")) {
    row.style.display = !needle || row.textContent.toLowerCase().includes(needle) ? "" : "none";
  }
});

$("nav").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-module]");
  if (!button) return;
  renderModule(button.dataset.module).catch((error) => toast(error.message));
});

$("moduleGrid").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-module]");
  if (!button) return;
  renderModule(button.dataset.module).catch((error) => toast(error.message));
});

$("moduleContent").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-refresh-module]");
  if (!button) return;
  renderModule(button.dataset.refreshModule).catch((error) => toast(error.message));
});

$("moduleActions").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-refresh-module]");
  if (!button) return;
  renderModule(button.dataset.refreshModule).catch((error) => toast(error.message));
});

$("moduleContent").addEventListener("submit", async (event) => {
  const form = event.target.closest("form");
  if (!form) return;
  event.preventDefault();
  const payload = payloadFromForm(form);
  const endpoint = form.dataset.createEndpoint || form.dataset.updateEndpoint;
  const method = form.dataset.updateEndpoint ? "PATCH" : "POST";
  try {
    await api(endpoint, { method, body: JSON.stringify(payload) });
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
  const title = prompt("Task title");
  if (!title) return;
  await api("/tasks", { method: "POST", body: JSON.stringify({ title }) });
  await loadDashboard();
});

$("quickEvent").addEventListener("click", async () => {
  const title = prompt("Event title");
  if (!title) return;
  const starts_at = new Date(Date.now() + 86400000).toISOString();
  await api("/calendar/events", { method: "POST", body: JSON.stringify({ title, starts_at }) });
  await loadDashboard();
});

boot().catch((error) => toast(error.message));
