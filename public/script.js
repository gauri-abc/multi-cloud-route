/*
 * Multi-Cloud-Route - Frontend Script (FIXED)
 * Handles: API calls, card updates, plane animation, starfield, log
 */

// ── Config ────────────────────────────────────────────────────
const API_URL = "/api/route";
const HEALTH_URL = "/api/health";
const MAX_LOG_ENTRIES = 5;

// ── State ─────────────────────────────────────────────────────
let requestLog = [];

// ── DOM Refs ──────────────────────────────────────────────────
const detectBtn        = document.getElementById("detect-btn");
const btnLabel         = document.getElementById("btn-label");
const resultCards      = document.getElementById("result-cards");
const healthBadge      = document.getElementById("health-badge");
const logList          = document.getElementById("log-list");
const animCaption      = document.getElementById("anim-caption");
const plane            = document.getElementById("plane");
const flightPath       = document.getElementById("flight-path");
const flightPathActive = document.getElementById("flight-path-active");

const valCountry = document.getElementById("val-country");
const valCity    = document.getElementById("val-city");
const valIp      = document.getElementById("val-ip");
const valCloud   = document.getElementById("val-cloud");
const cloudIcon  = document.getElementById("cloud-icon");
const valRegion  = document.getElementById("val-region");
const valTime    = document.getElementById("val-time");
const valLatency = document.getElementById("val-latency");
const cardCloud  = document.getElementById("card-cloud");

// ── Cloud Meta ────────────────────────────────────────────────
const CLOUD_META = {
  AWS:   { icon: "☁️", label: "Amazon Web Services", class: "aws",   color: "#FF9900" },
  AZURE: { icon: "🔷", label: "Microsoft Azure",     class: "azure", color: "#0089D6" },
  GCP:   { icon: "🌐", label: "Google Cloud",        class: "gcp",   color: "#4285F4" },
};

// ── Detect Route ──────────────────────────────────────────────
async function detectRoute() {
  if (detectBtn.classList.contains("loading")) return;

  detectBtn.classList.add("loading");
  btnLabel.textContent = "Detecting…";

  const t0 = performance.now();

  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    const latency = Math.round(performance.now() - t0);

    updateCards(data, latency);
    handleRouting(data);
    addLogEntry(data);
    showResultCards();

  } catch (err) {
    console.error(err);
    animCaption.innerHTML = `⚠ Error detecting route`;
  } finally {
    detectBtn.classList.remove("loading");
    btnLabel.textContent = "Detect My Route";
  }
}

// ── HANDLE ROUTING (🔥 FIX HERE) ──────────────────────────────
function handleRouting(data) {
  const cloud = data.cloud;

  if (cloud === "UNKNOWN" || cloud === "REJECTED") {
    stopAnimation();

    animCaption.innerHTML = `
      <span style="color:#f87171">
        ⚠ ${data.message || "Routing not available for this region"}
      </span>
    `;
    return;
  }

  updateAnimation(cloud);
}

// ── STOP ANIMATION (NEW) ──────────────────────────────────────
function stopAnimation() {
  plane.classList.add("hidden");
  plane.style.animation = "none";

  flightPath.setAttribute("d", "");
  flightPathActive.setAttribute("d", "");

  document.querySelectorAll(".node").forEach(n => n.classList.remove("active"));
}

// ── Update Cards ──────────────────────────────────────────────
function updateCards(data, latency) {
  valCountry.textContent = data.user_country || "Unknown";
  valIp.textContent      = `IP: ${data.user_ip || "—"}`;

  const meta = CLOUD_META[data.cloud] || { icon: "🚫", label: "Unknown", class: "unknown", color: "#999" };

  cloudIcon.textContent = meta.icon;
  valCloud.textContent  = meta.label;
  valRegion.textContent = data.region;

  cardCloud.classList.remove("aws", "azure", "gcp");
  cardCloud.classList.add(meta.class);

  valTime.textContent    = new Date(data.timestamp).toLocaleTimeString();
  valLatency.textContent = `Response time: ${latency}ms`;
}

// ── Animation Logic ───────────────────────────────────────────
const NODE_POS = {
  USER:  { x: 55,  y: 150 },
  AWS:   { x: 435, y: 60  },
  AZURE: { x: 435, y: 150 },
  GCP:   { x: 435, y: 234 },
};

function buildArcPath(from, to) {
  const mx = (from.x + to.x) / 2;
  const my = Math.min(from.y, to.y) - 60;
  return `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
}

function updateAnimation(cloud) {
  const from = NODE_POS.USER;
  const to   = NODE_POS[cloud]; // ❗ no fallback anymore

  if (!to) return; // safety

  const arc  = buildArcPath(from, to);
  const meta = CLOUD_META[cloud];

  flightPath.setAttribute("d", arc);
  flightPathActive.setAttribute("d", arc);
  flightPathActive.setAttribute("stroke", meta.color);

  flyPlane(from, to, meta.color);

  animCaption.innerHTML = `✈ Routing to <strong style="color:${meta.color}">${meta.label}</strong>`;
}

// ── Plane Animation ───────────────────────────────────────────
function flyPlane(from, to, color) {
  plane.classList.remove("hidden");
  plane.style.color = color;

  const duration = 1500;
  let start = null;

  function animate(ts) {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);

    const x = from.x + (to.x - from.x) * progress;
    const y = from.y + (to.y - from.y) * progress;

    plane.style.left = x + "px";
    plane.style.top  = y + "px";

    if (progress < 1) requestAnimationFrame(animate);
    else plane.classList.add("hidden");
  }

  requestAnimationFrame(animate);
}

// ── Log ───────────────────────────────────────────────────────
function addLogEntry(data) {
  requestLog.unshift({
    country: data.user_country,
    cloud: data.cloud,
    region: data.region,
    time: new Date().toLocaleTimeString()
  });

  if (requestLog.length > MAX_LOG_ENTRIES) requestLog.pop();

  logList.innerHTML = requestLog.map(e => `
    <div>📍 ${e.country} → ☁ ${e.cloud} (${e.region})</div>
  `).join("");
}

// ── Init ──────────────────────────────────────────────────────
window.detectRoute = detectRoute;