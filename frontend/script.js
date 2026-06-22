
const API_BASE = "http://127.0.0.1:8000"; 
const DAILY_LIMIT = 20;

let currentResult  = "";
let micRecognition = null;
let micActive      = false;
let authToken      = localStorage.getItem("cc_token") || null;

// ──────────────────────────────────────────────
//  BOOT
// ──────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  const user = localStorage.getItem("cc_user");
  if (authToken && user) showApp(user);

  document.getElementById("login-password").addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });
  document.getElementById("topic")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generate("title");
  });
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); generate("title"); }
    if ((e.ctrlKey || e.metaKey) && e.key === "k")    { e.preventDefault(); document.getElementById("topic")?.focus(); }
    if (e.key === "Escape") document.getElementById("export-menu")?.classList.add("hidden");
  });
});

// ──────────────────────────────────────────────
//  AUTH HELPERS
// ──────────────────────────────────────────────
function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${authToken}`
  };
}

// ──────────────────────────────────────────────
//  LOGIN
// ──────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const err      = document.getElementById("login-error");

  if (!username || !password) { err.textContent = "⚠ Fill in all fields."; return; }
  err.textContent = "Signing in…";

  try {
    // FastAPI expects form data for /token
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);

    const res  = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form
    });
    const data = await res.json();

    if (!res.ok) { err.textContent = "⚠ " + (data.detail || "Login failed."); return; }

    authToken = data.access_token;
    localStorage.setItem("cc_token", authToken);
    localStorage.setItem("cc_user",  username);
    err.textContent = "";
    showApp(username);
  } catch (e) {
    err.textContent = "⚠ Cannot connect to server.";
  }
}

// ──────────────────────────────────────────────
//  REGISTER
// ──────────────────────────────────────────────
async function doRegister() {
  const username = document.getElementById("reg-username").value.trim();
  const email    = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const err      = document.getElementById("reg-error");

  if (!username || !email || !password) { err.textContent = "⚠ Fill in all fields."; return; }
  if (password.length < 4) { err.textContent = "⚠ Password must be at least 4 characters."; return; }

  err.textContent = "Creating account…";

  try {
    const res  = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();

    if (!res.ok) { err.textContent = "⚠ " + (data.detail || "Registration failed."); return; }

    showToast("Account created! Please sign in.", "success");
    showLogin();
  } catch (e) {
    err.textContent = "⚠ Cannot connect to server.";
  }
}

function showRegister() {
  document.querySelector(".login-card:not(#register-card)").classList.add("hidden");
  document.getElementById("register-card").classList.remove("hidden");
}

function showLogin() {
  document.getElementById("register-card").classList.add("hidden");
  document.querySelector(".login-card:not(#register-card)").classList.remove("hidden");
}

// ──────────────────────────────────────────────
//  LOCAL STORAGE HELPERS (primary data store)
// ──────────────────────────────────────────────
function getLocalFavorites() {
  try { return JSON.parse(localStorage.getItem("cc_favorites") || "[]"); } catch { return []; }
}
function saveLocalFavorites(favs) {
  localStorage.setItem("cc_favorites", JSON.stringify(favs));
}
function getLocalHistory() {
  try { return JSON.parse(localStorage.getItem("cc_history") || "[]"); } catch { return []; }
}
function saveLocalHistory(hist) {
  localStorage.setItem("cc_history", JSON.stringify(hist));
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ──────────────────────────────────────────────
//  LOGOUT
// ──────────────────────────────────────────────
function doLogout() {
  authToken = null;
  localStorage.removeItem("cc_token");
  localStorage.removeItem("cc_user");
  document.getElementById("app-page").classList.add("hidden");
  document.getElementById("login-page").classList.remove("hidden");
  document.body.classList.remove("app-active");
  currentResult = "";
}

function togglePw(id = "login-password", btn) {
  const el = document.getElementById(id);
  el.type = el.type === "password" ? "text" : "password";
  if (btn) btn.textContent = el.type === "password" ? "👁" : "🙈";
}

function showApp(user) {
  document.getElementById("login-page").classList.add("hidden");
  document.getElementById("app-page").classList.remove("hidden");
  document.getElementById("welcome-msg").textContent  = `👋 ${user}`;
  document.getElementById("user-avatar").textContent  = user[0].toUpperCase();
  document.body.classList.add("app-active");
  updateUsageBar();
  updateBadges();
}

// ──────────────────────────────────────────────
//  USAGE BAR (local tracking)
// ──────────────────────────────────────────────
function getTodayKey()    { return "cc_usage_" + new Date().toDateString(); }
function getTodayUsage()  { return parseInt(localStorage.getItem(getTodayKey()) || "0"); }
function incrementUsage() { localStorage.setItem(getTodayKey(), getTodayUsage() + 1); updateUsageBar(); }

function updateUsageBar() {
  const used = getTodayUsage();
  const pct  = Math.min((used / DAILY_LIMIT) * 100, 100);
  const fill = document.getElementById("usage-fill");
  const cnt  = document.getElementById("usage-count");
  if (fill) {
    fill.style.width = pct + "%";
    fill.style.background = pct > 80
      ? "linear-gradient(90deg,#ff6b6b,#ff4444)"
      : "linear-gradient(90deg,#00c8ff,#7b61ff)";
  }
  if (cnt) cnt.textContent = `${used} / ${DAILY_LIMIT}`;
}

// ──────────────────────────────────────────────
//  UI HELPERS
// ──────────────────────────────────────────────
function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = `toast toast--${type} show`;
  setTimeout(() => t.className = "toast", 3000);
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

function switchTab(name, btn) {
  document.querySelectorAll(".tab-section").forEach(s => { s.classList.remove("active"); s.classList.add("hidden"); });
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  const tab = document.getElementById("tab-" + name);
  tab.classList.remove("hidden");
  tab.classList.add("active");
  btn.classList.add("active");
  if (name === "history")   renderHistory();
  if (name === "favorites") renderFavorites();
  if (window.innerWidth < 768) document.getElementById("sidebar").classList.remove("open");
}

function selectChip(el, groupId) {
  document.querySelectorAll(`#${groupId} .chip`).forEach(c => c.classList.remove("active"));
  el.classList.add("active");
}

function updateLenLabel(v) {
  document.getElementById("len-label").textContent = ["","Short","Medium","Long"][v];
}

function toggleTheme() {
  const html  = document.documentElement;
  const dark  = html.getAttribute("data-theme") === "dark";
  html.setAttribute("data-theme", dark ? "light" : "dark");
  document.getElementById("theme-icon").textContent  = dark ? "☀️" : "🌙";
  document.getElementById("theme-label").textContent = dark ? "Light Mode" : "Dark Mode";
}

function toggleExportMenu() {
  document.getElementById("export-menu").classList.toggle("hidden");
}

async function updateBadges() {
  const hist = getLocalHistory();
  const favs = getLocalFavorites();
  const histBadge = document.getElementById("hist-badge");
  const favBadge  = document.getElementById("fav-badge");
  if (histBadge) histBadge.textContent = hist.length;
  if (favBadge)  favBadge.textContent  = favs.length;
}

// ──────────────────────────────────────────────
//  PROMPT BUILDER
// ──────────────────────────────────────────────
function buildPrompt(type, topic) {
  const platform = document.querySelector("#platform-chips .chip.active")?.textContent.trim() || "YouTube";
  const tone     = document.querySelector("#tone-chips .chip.active")?.textContent.trim() || "Professional";
  const lang     = document.getElementById("lang-select")?.value || "English";
  const lenVal   = document.getElementById("len-slider")?.value || 2;
  const lenMap   = { 1: "short and concise (under 80 words)", 2: "medium length (150-220 words)", 3: "long and detailed (300+ words)" };
  const length   = lenMap[lenVal];

  const prompts = {
    title:   `Generate 5 highly engaging ${platform} titles about "${topic}". Tone: ${tone}. Output in ${lang}. Number them 1-5. Make them click-worthy and optimized.`,
    script:  `Write a ${length} ${platform} video script about "${topic}". Tone: ${tone}. Output in ${lang}. Structure: [HOOK], [MAIN CONTENT], [CTA]. Format clearly with labels.`,
    hashtag: `Generate 25 relevant hashtags for a ${platform} post about "${topic}". Tone: ${tone}. Output in ${lang}. Group them: #Niche (5), #Trending (10), #Broad (10). Use real hashtag format.`
  };

  return prompts[type] || `Generate ${type} content about "${topic}". Platform: ${platform}. Tone: ${tone}. Language: ${lang}.`;
}

// ──────────────────────────────────────────────
//  GENERATE (calls backend)
// ──────────────────────────────────────────────
async function generate(type, retryCount = 0) {
  const topic  = document.getElementById("topic").value.trim();
  const output = document.getElementById("output");

  if (!topic) { showToast("Please enter a topic first!", "error"); return; }
  if (!authToken) { showToast("Please sign in first!", "error"); return; }

  if (getTodayUsage() >= DAILY_LIMIT) {
    output.innerHTML = `<span class="placeholder-text">⛔ Daily limit of ${DAILY_LIMIT} reached. Come back tomorrow!</span>`;
    return;
  }

  const labels = { title:"🎯 Titles", script:"📝 Script", hashtag:"🏷 Hashtags" };
  document.getElementById("result-title").textContent = labels[type] || type;
  document.getElementById("word-count").textContent   = "";
  document.getElementById("fav-btn").textContent      = "♡";

  output.innerHTML = retryCount > 0
    ? `<span class="placeholder-text">🔄 Retrying… (${retryCount}/3)</span>`
    : `<span class="placeholder-text typing-anim">✨ AI is generating</span>`;

  try {
    const res  = await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        type,
        topic,
        platform: document.querySelector("#platform-chips .chip.active")?.textContent.trim() || "YouTube",
        tone:     document.querySelector("#tone-chips .chip.active")?.textContent.trim() || "Professional",
        language: document.getElementById("lang-select")?.value || "English",
        length:   parseInt(document.getElementById("len-slider")?.value || 2)
      })
    });

    if (res.status === 401) { showToast("Session expired. Please log in again.", "error"); doLogout(); return; }
    if (res.status === 503 && retryCount < 3) { setTimeout(() => generate(type, retryCount + 1), 2500); return; }

    const data = await res.json();

    if (!res.ok) { output.innerHTML = `<span class="placeholder-text">❌ ${data.detail || "Please try again."}</span>`; return; }

    currentResult = data.result;
    streamResult(data.result);
    incrementUsage();

    // Save to local history
    const hist = getLocalHistory();
    hist.unshift({
      id: genId(),
      topic,
      result: data.result,
      type: { title:"🎯 Titles", script:"📝 Script", hashtag:"🏷 Hashtags" }[type] || type,
      platform: document.querySelector("#platform-chips .chip.active")?.textContent.trim() || "",
      tone:     document.querySelector("#tone-chips .chip.active")?.textContent.trim() || "",
      created_at: new Date().toISOString()
    });
    if (hist.length > 100) hist.splice(100);
    saveLocalHistory(hist);

    updateBadges();

  } catch (err) {
    output.innerHTML = `<span class="placeholder-text">❌ Cannot connect to server. Is the backend running?</span>`;
  }
}

function streamResult(text) {
  const output = document.getElementById("output");
  output.textContent = "";
  const words    = text.split(" ");
  let i = 0;
  const step = Math.max(1, Math.floor(words.length / 60));

  const iv = setInterval(() => {
    if (i >= words.length) {
      clearInterval(iv);
      output.textContent = text;
      updateWordCount(text);
      return;
    }
    output.textContent += (i === 0 ? "" : " ") + words.slice(i, i + step).join(" ");
    i += step;
  }, 28);
}

function updateWordCount(text) {
  const words = text.trim().split(/\s+/).length;
  document.getElementById("word-count").textContent = `${words} words · ${text.length} chars`;
}

// ──────────────────────────────────────────────
//  COPY
// ──────────────────────────────────────────────
function copyResult() {
  if (!currentResult) { showToast("Nothing to copy yet!", "error"); return; }
  navigator.clipboard.writeText(currentResult).then(() => {
    const btn = document.getElementById("copy-btn");
    btn.textContent = "✅";
    setTimeout(() => btn.textContent = "📋", 2000);
    showToast("Copied to clipboard!", "success");
  });
}

// ──────────────────────────────────────────────
//  SHARE LINK
// ──────────────────────────────────────────────
function shareResult() {
  if (!currentResult) { showToast("Generate something first!", "error"); return; }
  const encoded = btoa(encodeURIComponent(currentResult.substring(0, 500)));
  const url = `${location.origin}${location.pathname}?shared=${encoded}`;
  navigator.clipboard.writeText(url).then(() => showToast("Share link copied!", "success"));
}

// ──────────────────────────────────────────────
//  EXPORT
// ──────────────────────────────────────────────
function exportAs(format) {
  document.getElementById("export-menu").classList.add("hidden");
  if (!currentResult) { showToast("Nothing to export!", "error"); return; }
  const topic = document.getElementById("topic").value || "content";
  const title = document.getElementById("result-title").textContent;

  if (format === "txt") {
    download(`${topic}.txt`, currentResult);
  } else if (format === "md") {
    const md = `# ${title} — ${topic}\n\n_Generated by AI Content Creator Hub · ${new Date().toLocaleString()}_\n\n---\n\n${currentResult}`;
    download(`${topic}.md`, md);
  } else if (format === "pdf") {
    window.print();
  }
  showToast(`Exported as ${format.toUpperCase()}!`, "success");
}

function download(filename, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = filename;
  a.click();
}

// ──────────────────────────────────────────────
//  FAVORITES
// ──────────────────────────────────────────────
async function favoriteResult() {
  if (!currentResult) { showToast("Generate something first!", "error"); return; }
  const topic    = document.getElementById("topic").value || "Untitled";
  const type     = document.getElementById("result-title").textContent;
  const platform = document.querySelector("#platform-chips .chip.active")?.textContent.trim() || "";
  const tone     = document.querySelector("#tone-chips .chip.active")?.textContent.trim() || "";

  const favs = getLocalFavorites();
  favs.unshift({ id: genId(), topic, result: currentResult, type, platform, tone, created_at: new Date().toISOString() });
  saveLocalFavorites(favs);

  document.getElementById("fav-btn").textContent = "❤️";
  showToast("Added to favorites!", "success");
  updateBadges();

  // Also try backend (non-blocking)
  if (authToken) {
    fetch(`${API_BASE}/api/favorites`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ topic, result: currentResult, type, platform, tone })
    }).catch(() => {});
  }
}

function removeFavorite(id) {
  const favs = getLocalFavorites().filter(f => f.id !== id && f._id !== id);
  saveLocalFavorites(favs);
  renderFavorites();
  updateBadges();
  showToast("Removed from favorites.");
  // Also try backend
  if (authToken) fetch(`${API_BASE}/api/favorites/${id}`, { method: "DELETE", headers: authHeaders() }).catch(() => {});
}

function renderFavorites() {
  const list = document.getElementById("favorites-list");
  const favs = getLocalFavorites();
  if (!favs.length) {
    list.innerHTML = `<p class="empty-state">No favorites yet. Generate content and click ♡ to save.</p>`;
    return;
  }
  list.innerHTML = favs.map(f => cardHTML(f, "fav")).join("");
}

// ──────────────────────────────────────────────
//  HISTORY
// ──────────────────────────────────────────────
function renderHistory() {
  const search = (document.getElementById("history-search")?.value || "").toLowerCase();
  const filter = document.getElementById("history-filter")?.value || "";
  const list   = document.getElementById("history-list");

  let hist = getLocalHistory();
  if (search) hist = hist.filter(h => h.topic?.toLowerCase().includes(search) || h.result?.toLowerCase().includes(search));
  if (filter) hist = hist.filter(h => h.type?.toLowerCase().includes(filter));

  if (!hist.length) {
    list.innerHTML = `<p class="empty-state">${search || filter ? "No results match your filter." : "No history yet. Generate some content first!"}</p>`;
    return;
  }
  list.innerHTML = hist.map(h => cardHTML(h, "hist")).join("");
}

function clearHistory() {
  if (!confirm("Clear all history?")) return;
  saveLocalHistory([]);
  renderHistory();
  updateBadges();
  showToast("History cleared.");
  if (authToken) fetch(`${API_BASE}/api/history`, { method: "DELETE", headers: authHeaders() }).catch(() => {});
}

function deleteHistoryItem(id) {
  const hist = getLocalHistory().filter(h => h.id !== id && h._id !== id);
  saveLocalHistory(hist);
  renderHistory();
  updateBadges();
  if (authToken) fetch(`${API_BASE}/api/history/${id}`, { method: "DELETE", headers: authHeaders() }).catch(() => {});
}

// ──────────────────────────────────────────────
//  CARD HTML
// ──────────────────────────────────────────────
const typeEmoji = { "🎯 Titles":"🎯", "📝 Script":"📝", "🏷 Hashtags":"🏷", title:"🎯", script:"📝", hashtag:"🏷" };

function cardHTML(item, mode) {
  const emoji = typeEmoji[item.type] || "⚡";
  const isFav = mode === "fav";
  return `
  <div class="content-card">
    <div class="card-top">
      <span class="card-tag">${emoji} ${item.type || "content"}</span>
      <span class="card-topic">${esc(item.topic)}</span>
      <span class="card-time">${item.created_at ? new Date(item.created_at).toLocaleString() : item.time || ""}</span>
    </div>
    ${item.platform ? `<div class="card-meta">📱 ${item.platform}${item.tone ? " · 🎭 "+item.tone : ""}</div>` : ""}
    <div class="card-preview">${esc((item.result||"").substring(0,120))}…</div>
    <div class="card-actions">
      <button class="card-btn" onclick="loadItem('${item._id || item.id}','${mode}')">📂 Load</button>
      <button class="card-btn" onclick="copyItem('${item._id || item.id}','${mode}')">📋 Copy</button>
      ${isFav
        ? `<button class="card-btn card-btn--danger" onclick="removeFavorite('${item._id || item.id}')">🗑 Remove</button>`
        : `<button class="card-btn card-btn--danger" onclick="deleteHistoryItem('${item._id || item.id}')">🗑</button>`
      }
    </div>
  </div>`;
}

function loadItem(id, mode) {
  const list = mode === "fav" ? getLocalFavorites() : getLocalHistory();
  const item = list.find(x => (x.id || x._id) === id);
  if (!item) { showToast("Could not load item.", "error"); return; }
  document.getElementById("topic").value = item.topic;
  currentResult = item.result;
  streamResult(item.result);
  document.getElementById("result-title").textContent = item.type || "Output";
  document.querySelector("[onclick=\"switchTab('generator',this)\"]").click();
  showToast("Loaded!", "success");
}

function copyItem(id, mode) {
  const list = mode === "fav" ? getLocalFavorites() : getLocalHistory();
  const item = list.find(x => (x.id || x._id) === id);
  if (!item) return;
  navigator.clipboard.writeText(item.result).then(() => showToast("Copied!", "success"));
}

// ──────────────────────────────────────────────
//  VOICE INPUT
// ──────────────────────────────────────────────
function toggleMic() {
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    showToast("Voice input not supported in this browser.", "error"); return;
  }
  if (micActive) { micRecognition?.stop(); return; }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  micRecognition = new SR();
  micRecognition.lang = "en-US";
  micRecognition.continuous = false;
  micRecognition.interimResults = false;

  micRecognition.onstart = () => { micActive = true; document.getElementById("mic-btn").textContent = "🔴"; showToast("Listening…"); };
  micRecognition.onresult = e => { document.getElementById("topic").value = e.results[0][0].transcript; };
  micRecognition.onend   = () => { micActive = false; document.getElementById("mic-btn").textContent = "🎙"; };
  micRecognition.onerror = () => { micActive = false; document.getElementById("mic-btn").textContent = "🎙"; showToast("Voice failed.", "error"); };
  micRecognition.start();
}

function closeScheduleModal() { document.getElementById("schedule-modal").classList.add("hidden"); }
function esc(str="") { return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
