/*
 * Multi-Cloud-Route - Frontend Script
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

// Card value refs
const valCountry = document.getElementById("val-country");
const valCity    = document.getElementById("val-city");
const valIp      = document.getElementById("val-ip");
const valCloud   = document.getElementById("val-cloud");
const cloudIcon  = document.getElementById("cloud-icon");
const valRegion  = document.getElementById("val-region");
const valTime    = document.getElementById("val-time");
const valLatency = document.getElementById("val-latency");
const cardCloud  = document.getElementById("card-cloud");

// ── Starfield ─────────────────────────────────────────────────
(function initStarfield() {
  const canvas = document.getElementById("starfield");
  const ctx    = canvas.getContext("2d");
  let W, H, stars = [];

  const STAR_COUNT = 180;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createStars() {
    stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.2,
      a: Math.random(),
      speed: Math.random() * 0.004 + 0.001,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    stars.forEach(s => {
      s.a += s.speed;
      const alpha = 0.3 + 0.5 * Math.abs(Math.sin(s.a));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 225, 255, ${alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  resize();
  createStars();
  draw();
  window.addEventListener("resize", () => { resize(); createStars(); });
})();

// ── Health Check ──────────────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch(HEALTH_URL);
    if (res.ok) {
      healthBadge.textContent = "● Server Online";
      healthBadge.classList.add("ok");
    }
  } catch {
    healthBadge.textContent = "● Offline";
  }
}
checkHealth();

// ── Cloud Utils ───────────────────────────────────────────────
const CLOUD_META = {
  AWS:   { icon: "☁️",  label: "Amazon Web Services", class: "aws",   color: "#FF9900" },
  AZURE: { icon: "🔷",  label: "Microsoft Azure",     class: "azure", color: "#0089D6" },
  GCP:   { icon: "🌐",  label: "Google Cloud",        class: "gcp",   color: "#4285F4" },
};

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Main Detect Function ──────────────────────────────────────
async function detectRoute() {
  if (detectBtn.classList.contains("loading")) return;

  // Loading state
  detectBtn.classList.add("loading");
  btnLabel.textContent = "Detecting…";

  const t0 = performance.now();

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    const latency = Math.round(performance.now() - t0);

    updateCards(data, latency);
    if (data.cloud === "UNKNOWN") {
      animCaption.innerHTML = `<span style="color:#f87171">⚠ Unable to detect location. Routing skipped.</span>`;
    } else {
      updateAnimation(data.cloud);
    }
    addLogEntry(data);
    showResultCards();
  } catch (err) {
    console.error("Detection failed:", err);
    animCaption.innerHTML = `<span style="color:#f87171">⚠ Could not detect: ${err.message}</span>`;
  } finally {
    detectBtn.classList.remove("loading");
    btnLabel.textContent = "Detect My Route";
  }
}

// ── Update Info Cards ─────────────────────────────────────────
function updateCards(data, latency) {
  // Country card
  valCountry.textContent = data.user_country || "Unknown";
  valCity.textContent    = data.user_city    || "";
  valIp.textContent      = `IP: ${data.user_ip || "—"}`;

  // Cloud card
  const meta = CLOUD_META[data.cloud] || { icon: "🚫", label: "Unknown", class: "unknown", color: "#999999" };
  cloudIcon.textContent  = meta.icon;
  valCloud.textContent   = meta.label;
  valRegion.textContent  = data.region;

  // Remove old cloud classes and apply new
  cardCloud.classList.remove("aws", "azure", "gcp");
  cardCloud.classList.add(meta.class);

  // Time card
  valTime.textContent    = formatTime(data.timestamp);
  valLatency.textContent = `Response time: ${latency}ms`;
}

function showResultCards() {
  resultCards.classList.remove("hidden");
}

// ── Node + SVG Animation ──────────────────────────────────────
// Map cloud name → absolute position {x,y} in the 500×300 SVG viewBox
// These match the .node CSS positions (node--user at ~8%, cloud nodes at ~88% right)
const NODE_POS = {
  USER:  { x: 55,  y: 150 },   // left side
  AWS:   { x: 435, y: 60  },   // top right
  AZURE: { x: 435, y: 150 },   // middle right
  GCP:   { x: 435, y: 234 },   // bottom right
};

function buildArcPath(from, to) {
  // Quadratic bezier arc for a smooth flight curve
  const mx = (from.x + to.x) / 2;
  const my = Math.min(from.y, to.y) - 60;   // arc peak above midpoint
  return `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
}

function updateAnimation(cloud) {
  // Reset all node highlights
  document.querySelectorAll(".node").forEach(n => n.classList.remove("active"));

  const from = NODE_POS.USER;
  const to   = NODE_POS[cloud] || NODE_POS.AWS;
  const arc  = buildArcPath(from, to);

  const meta  = CLOUD_META[cloud] || CLOUD_META.AWS;
  const color = meta.color;

  // Draw ghost path
  flightPath.setAttribute("d", arc);

  // Draw active glowing path
  flightPathActive.setAttribute("d", arc);
  flightPathActive.setAttribute("stroke", color);
  flightPathActive.style.strokeDasharray = "300";
  flightPathActive.style.strokeDashoffset = "300";

  // Trigger path draw animation
  requestAnimationFrame(() => {
    flightPathActive.classList.remove("fly");
    void flightPathActive.offsetWidth; // reflow
    flightPathActive.classList.add("fly");
  });

  // Activate destination node
  const nodeId = "node-" + cloud.toLowerCase();
  const destNode = document.getElementById(nodeId);
  if (destNode) destNode.classList.add("active");
  document.getElementById("node-user").classList.add("active");

  // Fly the plane along the arc
  flyPlane(from, to, color, cloud);

  // Update caption
  const cloudLabel = meta.label;
  const cloudRegion = { AWS: "India (Mumbai)", AZURE: "Europe (Netherlands)", GCP: "APAC (Taiwan)" }[cloud] || "";
  animCaption.innerHTML = `✈ Routing to <strong style="color:${color}">${cloudLabel}</strong> · ${cloudRegion}`;
}

// ── Plane Flight Animation ─────────────────────────────────────
function flyPlane(from, to, color, cloud) {
  const wrapper   = document.querySelector(".globe-wrapper");
  const wRect     = wrapper.getBoundingClientRect();
  const svgW      = 500;
  const svgH      = 300;
  const scaleX    = wRect.width  / svgW;
  const scaleY    = wRect.height / svgH;

  plane.classList.remove("hidden");
  plane.style.color = color;

  const STEPS    = 80;
  const DURATION = 1500; // ms
  let   step     = 0;

  // Quadratic bezier helper
  const mx = (from.x + to.x) / 2;
  const my = Math.min(from.y, to.y) - 60;

  function bezier(t) {
    const u = 1 - t;
    return {
      x: u * u * from.x + 2 * u * t * mx + t * t * to.x,
      y: u * u * from.y + 2 * u * t * my + t * t * to.y,
    };
  }

  function getAngle(t) {
    const dt = 0.01;
    const p1 = bezier(Math.max(0, t - dt));
    const p2 = bezier(Math.min(1, t + dt));
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
  }

  const interval = DURATION / STEPS;
  let startTime  = null;

  function animate(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    const t = Math.min(elapsed / DURATION, 1);

    const pos   = bezier(t);
    const angle = getAngle(t);

    // Convert SVG coords → real DOM pixels
    plane.style.left      = (pos.x * scaleX - 12) + "px";
    plane.style.top       = (pos.y * scaleY - 12) + "px";
    plane.style.transform = `rotate(${angle}deg)`;

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      // Land: briefly show, then fade
      setTimeout(() => {
        plane.classList.add("hidden");
        // Remove active states after landing
        setTimeout(() => {
          document.querySelectorAll(".node").forEach(n => n.classList.remove("active"));
        }, 800);
      }, 400);
    }
  }

  // Start with a small delay so path draw goes first
  setTimeout(() => requestAnimationFrame(animate), 200);
}

// ── Log Section ───────────────────────────────────────────────
function addLogEntry(data) {
  const entry = {
    country: data.user_country,
    cloud:   data.cloud,
    region:  data.region,
    time:    formatTime(data.timestamp),
  };

  requestLog.unshift(entry);
  if (requestLog.length > MAX_LOG_ENTRIES) requestLog.pop();

  renderLog();
}

function renderLog() {
  if (requestLog.length === 0) {
    logList.innerHTML = '<div class="log-empty">No requests yet. Hit the button above!</div>';
    return;
  }

  logList.innerHTML = requestLog.map((entry, i) => {
    const cloudClass = entry.cloud.toLowerCase();
    return `
      <div class="log-item" style="animation-delay:${i * 0.05}s">
        <span class="log-country">📍 ${entry.country}</span>
        <span class="log-arrow">→</span>
        <span class="log-cloud ${cloudClass}">☁ ${entry.cloud}</span>
        <span class="log-region">${entry.region}</span>
        <span class="log-time">${entry.time}</span>
      </div>`;
  }).join("");
}

// ── Make detectRoute globally accessible ──────────────────────
window.detectRoute = detectRoute;
