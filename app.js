// Data lives in briefs/index.json (newest first: {id, date, label}) and briefs/<id>.json ({date, label, html, rain}).
const $ = id => document.getElementById(id);
let briefs = [];       // newest first: {id, date, label}
const full = {};       // id -> loaded brief body
let current = null;    // id of the brief on screen
let pinned = false;    // true once the viewer picked a day

function todayLocal() {
  const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function shortDate(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", {weekday: "short", day: "numeric", month: "short"});
}

function drawRain(svg, data) {
  if (!svg || !Array.isArray(data) || !data.length) return;
  svg.textContent = "";
  const NS = "http://www.w3.org/2000/svg";
  const x0 = 30, x1 = 336, top = 8, base = 92;
  const max = Math.max(2, Math.ceil(Math.max(...data.map(d => +d.mm || 0))));
  const y = v => base - (v / max) * (base - top);
  const el = (tag, attrs, text) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    svg.appendChild(n); return n;
  };
  const ticks = max <= 2 ? [0, 1, 2] : [0, Math.round(max / 2), max];
  ticks.forEach(t => {
    el("line", {x1: x0, x2: x1, y1: y(t), y2: y(t), stroke: "var(--line)", "stroke-width": 1});
    el("text", {x: x0 - 6, y: y(t) + 4, "text-anchor": "end", "font-size": 10, fill: "var(--muted)", "font-family": "var(--mono)"}, t + (t === max ? " mm" : ""));
  });
  const step = (x1 - x0) / data.length, bw = step * 0.62;
  data.forEach((d, i) => {
    const mm = +d.mm || 0, cx = x0 + step * i + step / 2, h = Math.max(2, base - y(mm));
    el("rect", {x: cx - bw / 2, y: base - h, width: bw, height: h, rx: 2, fill: mm > 0 ? "var(--rain)" : "var(--line)"});
    if (i % 3 === 0) el("text", {x: cx, y: 110, "text-anchor": "middle", "font-size": 10, fill: "var(--muted)", "font-family": "var(--mono)"}, d.h + ":00");
  });
}

function showState(title, text) {
  $("brief").innerHTML = "";
  const box = document.createElement("div"); box.className = "state";
  const s = document.createElement("strong"); s.textContent = title;
  const p = document.createElement("span"); p.textContent = text;
  box.append(s, p); $("brief").append(box);
}

async function getJSON(path) {
  const res = await fetch(path, {cache: "no-cache"});
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

async function loadBrief(id) {
  if (!full[id]) full[id] = await getJSON("briefs/" + encodeURIComponent(id) + ".json");
  return full[id];
}

async function render() {
  const i = briefs.findIndex(b => b.id === current);
  const b = briefs[i];
  $("prev").disabled = !b || i >= briefs.length - 1;
  $("next").disabled = !b || i <= 0;
  if (!b) {
    $("dateTxt").textContent = "—";
    $("dayTitle").textContent = "Your briefs";
    $("sub").textContent = "Nothing here yet.";
    showState("No briefs yet", "Your first brief arrives on the next weekday before 07:00. Every brief after that is kept here.");
    return;
  }
  const isToday = b.date === todayLocal();
  $("dateTxt").textContent = shortDate(b.date);
  $("dayTitle").textContent = b.label || shortDate(b.date);
  $("sub").textContent = isToday ? "Today's brief · about a 5-minute read."
    : (i === 0 ? "Latest brief · about a 5-minute read." : "From the archive · news as it stood that morning.");
  try { if (location.hash.slice(1) !== b.id) history.replaceState(null, "", "#" + b.id); } catch (e) {}

  let body;
  try { body = await loadBrief(b.id); }
  catch (e) { if (current === b.id) showState("Couldn't load this brief", "It isn't saved on this device yet. Connect to the internet and try again."); return; }
  if (current !== b.id) return; // the viewer moved on while it loaded
  const el = $("brief");
  el.innerHTML = body.html || "";
  el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
  drawRain(el.querySelector("#rainChart"), body.rain);
  // Warm the neighbours so swiping offline still works.
  [briefs[i - 1], briefs[i + 1]].forEach(n => { if (n) loadBrief(n.id).catch(() => {}); });
}

function go(delta) {
  const i = briefs.findIndex(b => b.id === current);
  const j = i + delta;
  if (j < 0 || j >= briefs.length) return;
  current = briefs[j].id; pinned = true; render(); window.scrollTo({top: 0});
}
$("prev").addEventListener("click", () => go(1));
$("next").addEventListener("click", () => go(-1));

// Swipe between days
let sx = null, sy = null;
document.addEventListener("touchstart", e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, {passive: true});
document.addEventListener("touchend", e => {
  if (sx == null || !$("sheet").hidden) return;
  const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
  sx = null;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) go(dx > 0 ? 1 : -1);
}, {passive: true});
document.addEventListener("keydown", e => {
  if (!$("sheet").hidden) { if (e.key === "Escape") closeSheet(); return; }
  if (e.key === "ArrowLeft") go(1);
  if (e.key === "ArrowRight") go(-1);
});

// Light / dark toggle
function syncThemeColor() {
  $("themeColor").setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
}
$("themeBtn").addEventListener("click", () => {
  const root = document.documentElement, attr = root.getAttribute("data-theme");
  const next = attr === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try { localStorage.setItem("brief-theme", next); } catch (e) {}
  syncThemeColor();
});
syncThemeColor();

// Archive sheet
function openSheet() {
  const list = $("archList"); list.innerHTML = "";
  if (!briefs.length) { const p = document.createElement("p"); p.className = "sub"; p.textContent = "No briefs saved yet."; list.append(p); }
  let month = null, ul = null;
  briefs.forEach((b, i) => {
    const m = new Date(b.date + "T12:00:00").toLocaleDateString("en-GB", {month: "long", year: "numeric"});
    if (m !== month) {
      month = m;
      const h = document.createElement("div"); h.className = "month"; h.textContent = m; list.append(h);
      ul = document.createElement("ul"); ul.className = "arch"; list.append(ul);
    }
    const li = document.createElement("li"), btn = document.createElement("button");
    const a = document.createElement("span"); a.textContent = b.label || b.date;
    const d = document.createElement("span"); d.className = "d"; d.textContent = i === 0 ? "latest" : b.date;
    btn.append(a, d);
    if (b.id === current) btn.setAttribute("aria-current", "true");
    btn.addEventListener("click", () => { current = b.id; pinned = true; closeSheet(); render(); window.scrollTo({top: 0}); });
    li.append(btn); ul.append(li);
  });
  $("sheetBg").hidden = false; $("sheet").hidden = false; $("closeSheet").focus();
}
function closeSheet() { $("sheetBg").hidden = true; $("sheet").hidden = true; $("dateBtn").focus(); }
$("dateBtn").addEventListener("click", openSheet);
$("closeSheet").addEventListener("click", closeSheet);
$("sheetBg").addEventListener("click", closeSheet);

// Data
const want = location.hash.slice(1);
async function refresh() {
  $("refreshBtn").classList.add("spin");
  try {
    const list = await getJSON("briefs/index.json");
    briefs = (Array.isArray(list) ? list : []).filter(b => b && b.id && b.date)
      .sort((a, b) => b.date.localeCompare(a.date));
    // A brief may have been rewritten since it was opened; drop cached bodies for the latest.
    if (briefs[0]) delete full[briefs[0].id];
    if (!pinned) {
      current = (want && briefs.some(b => b.id === want)) ? want : (briefs[0] && briefs[0].id);
      if (want) pinned = true;
    } else if (!briefs.some(b => b.id === current)) {
      current = briefs[0] && briefs[0].id;
    }
    $("offline").hidden = navigator.onLine;
    await render();
  } catch (e) {
    if (!briefs.length) { $("sub").textContent = ""; showState("Couldn't load briefs", "Check your connection and tap ↻ to try again."); }
  } finally {
    $("refreshBtn").classList.remove("spin");
  }
}
$("refreshBtn").addEventListener("click", () => { pinned = false; refresh(); });
// Opening the app from the home screen after a while: pick up the new morning's brief.
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (Date.now() - hiddenAt > 5 * 60 * 1000) { if (current === (briefs[0] && briefs[0].id)) pinned = false; refresh(); }
});
window.addEventListener("online", () => { $("offline").hidden = true; refresh(); });
window.addEventListener("offline", () => { $("offline").hidden = false; });
refresh();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
