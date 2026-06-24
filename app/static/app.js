const state = {
  token: localStorage.getItem("crewopsToken"),
  me: null,
  settings: {},
};

const modules = [
  ["Dashboard", "⌂"],
  ["Calendar", "◇"],
  ["Projects", "▣"],
  ["Tasks", "✓"],
  ["Members", "◌"],
  ["Visitors", "◎"],
  ["Teams/Regions", "⌘"],
  ["Workshops/Training", "✦"],
  ["Equipment", "▤"],
  ["Finance", "$"],
  ["HR", "◈"],
  ["Messages", "✉"],
  ["Announcements", "◍"],
  ["Files/Documents", "□"],
  ["Reports/Audit", "≡"],
  ["Settings", "⚙"],
  ["Admin/System", "⌬"],
  ["Help", "?"],
];

function $(id) {
  return document.getElementById(id);
}

function toast(message) {
  const box = $("toast");
  box.textContent = message;
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 3800);
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

function renderNav() {
  $("nav").innerHTML = modules
    .map(([label, icon], index) => `<button class="${index === 0 ? "active" : ""}" title="${label}"><b>${icon}</b><span>${label}</span></button>`)
    .join("");
}

function renderModules(settings) {
  const enabled = settings.enabled_modules || modules.map(([label]) => label.toLowerCase().replace(/[^a-z]+/g, "_"));
  $("moduleGrid").innerHTML = modules
    .filter(([label]) => {
      const key = label.toLowerCase().replace(/[^a-z]+/g, "_").replace(/_$/, "");
      return enabled.includes(key) || enabled.includes(label);
    })
    .map(([label, icon]) => `<div class="module"><strong>${icon} ${label}</strong><span>Ready for records and workflows</span></div>`)
    .join("");
}

function item(title, meta) {
  return `<div class="item"><strong>${title}</strong><span>${meta || ""}</span></div>`;
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
    ? events.map((event) => item(event.title, `${event.event_type || "Event"} · ${new Date(event.starts_at).toLocaleString()}`)).join("")
    : item("No calendar events yet", "Create one when your first workshop, shoot, or meeting is known.");
  $("taskList").innerHTML = tasks.length
    ? tasks.map((task) => item(task.title, `${task.status} · ${task.priority}`)).join("")
    : item("No tasks yet", "Operational tasks can attach to projects, events, finance, HR, equipment, or general admin.");
  $("contactList").innerHTML = users.length
    ? users.slice(0, 8).map((user) => item(user.display_name, `${user.member_type} · ${user.account_status}`)).join("")
    : item("No members yet", "The first administrator was created during setup.");
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
    await loadDashboard();
    show("dashboardView");
  } catch (error) {
    localStorage.removeItem("crewopsToken");
    state.token = null;
    show("loginView");
  }
}

$("toggleSidebar").addEventListener("click", () => $("sidebar").classList.toggle("collapsed"));
$("refresh").addEventListener("click", () => loadDashboard().then(() => toast("Dashboard refreshed")).catch((error) => toast(error.message)));

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
