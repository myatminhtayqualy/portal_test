const feedEl = document.querySelector("#feed");
const statusEl = document.querySelector("#status");
const userChip = document.querySelector("#user-chip");
const authDialog = document.querySelector("#auth-dialog");
const postDialog = document.querySelector("#post-dialog");
const detailDialog = document.querySelector("#detail-dialog");
const authForm = document.querySelector("#auth-form");
const postForm = document.querySelector("#post-form");

const ui = {
  login: document.querySelector("#btn-login"),
  register: document.querySelector("#btn-register"),
  logout: document.querySelector("#btn-logout"),
  create: document.querySelector("#btn-new"),
};

let currentUser = null;
let posts = [];
let filter = "all";
let authMode = "login";

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function renderAuth() {
  const signedIn = Boolean(currentUser);
  userChip.classList.toggle("hidden", !signedIn);
  ui.logout.classList.toggle("hidden", !signedIn);
  ui.create.classList.toggle("hidden", !signedIn);
  ui.login.classList.toggle("hidden", signedIn);
  ui.register.classList.toggle("hidden", signedIn);
  if (signedIn) {
    userChip.textContent = `${currentUser.name} · ${currentUser.role}`;
  }
}

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString();
}

function cardHtml(post) {
  const image = post.image_url
    ? `<img src="${post.image_url}" alt="" />`
    : "";
  return `
    <button class="card" data-id="${post.id}" type="button">
      ${image}
      <div class="card-body">
        <span class="badge ${post.severity}">${post.severity}</span>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.content.slice(0, 140))}${post.content.length > 140 ? "…" : ""}</p>
        <p class="meta">${escapeHtml(post.author_name || "Unknown")} · ${formatTime(post.created_at)}</p>
      </div>
    </button>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderFeed() {
  const visible = posts.filter((post) => filter === "all" || post.severity === filter);
  if (!visible.length) {
    feedEl.innerHTML = "";
    setStatus("No alerts in this view yet.");
    return;
  }
  setStatus(`${visible.length} alert${visible.length === 1 ? "" : "s"}`);
  feedEl.innerHTML = visible.map(cardHtml).join("");
}

async function loadSession() {
  const data = await api("/api/auth/me");
  currentUser = data.user;
  renderAuth();
}

async function loadPosts() {
  const data = await api("/api/posts");
  posts = data.posts;
  renderFeed();
}

function openAuth(mode) {
  authMode = mode;
  document.querySelector("#auth-title").textContent = mode === "login" ? "Sign in" : "Create account";
  document.querySelector("#auth-hint").textContent =
    mode === "login"
      ? "Use your email to access posting tools."
      : "The first account becomes admin automatically.";
  document.querySelector("#auth-name").closest("label").classList.toggle("hidden", mode === "login");
  document.querySelector("#auth-error").textContent = "";
  authForm.reset();
  authDialog.showModal();
}

async function showDetail(id) {
  const data = await api(`/api/posts/${id}`);
  const post = data.post;
  document.querySelector("#detail-body").innerHTML = `
    <div class="detail">
      <span class="badge ${post.severity}">${post.severity}</span>
      <h3>${escapeHtml(post.title)}</h3>
      <p class="meta">${escapeHtml(post.author_name || "Unknown")} · ${formatTime(post.created_at)}</p>
      ${post.image_url ? `<img src="${post.image_url}" alt="" />` : ""}
      <p>${escapeHtml(post.content)}</p>
    </div>
  `;
  detailDialog.showModal();
}

ui.login.addEventListener("click", () => openAuth("login"));
ui.register.addEventListener("click", () => openAuth("register"));
document.querySelector("#auth-cancel").addEventListener("click", () => authDialog.close());
document.querySelector("#post-cancel").addEventListener("click", () => postDialog.close());
document.querySelector("#detail-close").addEventListener("click", () => detailDialog.close());

ui.create.addEventListener("click", () => {
  document.querySelector("#post-error").textContent = "";
  postForm.reset();
  postDialog.showModal();
});

ui.logout.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  currentUser = null;
  renderAuth();
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = document.querySelector("#auth-error");
  errorEl.textContent = "";
  try {
    const payload = {
      email: document.querySelector("#auth-email").value,
      password: document.querySelector("#auth-password").value,
    };
    if (authMode === "register") {
      payload.name = document.querySelector("#auth-name").value;
    }
    const data = await api(`/api/auth/${authMode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    currentUser = data.user;
    renderAuth();
    authDialog.close();
  } catch (error) {
    errorEl.textContent = error.message;
  }
});

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = document.querySelector("#post-error");
  errorEl.textContent = "";
  try {
    const body = new FormData(postForm);
    const data = await api("/api/posts", { method: "POST", body });
    posts.unshift({
      ...data.post,
      created_at: new Date().toISOString(),
    });
    renderFeed();
    postDialog.close();
  } catch (error) {
    errorEl.textContent = error.message;
  }
});

feedEl.addEventListener("click", (event) => {
  const card = event.target.closest("[data-id]");
  if (card) showDetail(card.dataset.id);
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((el) => el.classList.remove("active"));
    button.classList.add("active");
    filter = button.dataset.filter;
    renderFeed();
  });
});

(async function init() {
  try {
    await Promise.all([loadSession(), loadPosts()]);
  } catch (error) {
    setStatus(error.message);
  }
})();
