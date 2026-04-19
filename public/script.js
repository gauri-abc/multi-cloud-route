/*
 * Multi-Cloud-Route - Frontend Script (FINAL PRODUCTION VERSION)
 */

// ── Config ────────────────────────────────────────────────────
const API_URL = "/api/route";
const MAX_LOG_ENTRIES = 5;

// ── State ─────────────────────────────────────────────────────
let requestLog = [];

// ── DOM Refs ──────────────────────────────────────────────────
const detectBtn        = document.getElementById("detect-btn");
const btnLabel         = document.getElementById("btn-label");
const resultCards      = document.getElementById("result-cards");
const logList          = document.getElementById("log-list");
const animCaption      = document.getElementById("anim-caption");
const plane            = document.getElementById("plane");
const flightPath       = document.getElementById("flight-path");
const flightPathActive = document.getElementById("flight-path-active");

const valCountry = document.getElementById("val-country");
const valIp      = document.getElementById("val-ip");
const valCloud   = document.getElementById("val-cloud");
const cloudIcon  = document.getElementById("cloud-icon");
const valRegion  = document.getElementById("val-region");

// ── Cloud Meta ────────────────────────────────────────────────
const CLOUD_META = {
  AWS:   { icon: "☁️", label: "Amazon Web Services", color: "#FF9900" },
  AZURE: { icon: "🔷", label: "Microsoft Azure",     color: "#0089D6" },
  GCP:   { icon: "🌐", label: "Google Cloud",        color: "#4285F4" },
};

// ── Region Labels (for caption clarity) ───────────────────────
const REGION_LABELS = {
  AWS: "India (Mumbai)",
  AZURE: "Europe (Netherlands)",
  GCP: "APAC (Taiwan)",
};

// ── Detect Route ──────────────────────────────────────────────
async function detectRoute() {
  if (detectBtn.classList.contains("loading")) return;

  detectBtn.classList.add("loading");
  btnLabel.textContent = "Detecting…";

  try {
    const res = await fetch(API_URL);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    // Safe UI execution
    try {
      updateCards(data);
      handleRouting(data);
      addLogEntry(data);
      resultCards.classList.remove("hidden");
    } catch (uiError) {
      console.error("UI error:", uiError);
      stopAnimation();
      animCaption.innerHTML = `⚠ UI rendering issue`;
    }

  } catch (err) {
    console.error("Fetch error:", err);
    stopAnimation();
    animCaption.innerHTML = `⚠ Network / API error`;
  } finally {
    detectBtn.classList.remove("loading");
    btnLabel.textContent = "Detect My Route";
  }
}

// ── HANDLE ROUTING ────────────────────────────────────────────
function handleRouting(data) {

  // ❌ Unknown location
  if (data.cloud === "UNKNOWN") {
    stopAnimation();
    animCaption.innerHTML = `⚠ ${data.message || "Location not detected"}`;
    return;
  }

  // ❌ Rejected region
  if (!data.allowed) {
    stopAnimation();
    animCaption.innerHTML = `🚫 ${data.message}`;
    return;
  }

  // ✅ Allowed → animate
  updateAnimation(data.cloud);
}

// ── STOP ANIMATION ────────────────────────────────────────────
function stopAnimation() {
  plane.classList.add("hidden");

  flightPath.setAttribute("d", "");
  flightPathActive.setAttribute("d", "");

  document.querySelectorAll(".node").forEach(n => n.classList.remove("active"));
}

// ── Update Cards ──────────────────────────────────────────────
function updateCards(data) {
  try {
    valCountry.textContent = data.user_country || "Unknown";
    valIp.textContent      = `IP: ${data.user_ip || "—"}`;

    if (!data.allowed) {
      cloudIcon.textContent = "🚫";
      valCloud.textContent  = `${data.cloud} (Rejected)`;
      valRegion.textContent = data.message;
      return;
    }

    const meta = CLOUD_META[data.cloud];

    if (!meta) throw new Error("Invalid cloud");

    cloudIcon.textContent = meta.icon;
    valCloud.textContent  = meta.label;
    valRegion.textContent = data.region;

  } catch (err) {
    console.error("updateCards failed:", err);
  }
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
  try {
    const from = NODE_POS.USER;
    const to   = NODE_POS[cloud];

    if (!to) throw new Error("Invalid node");

    const meta = CLOUD_META[cloud];
    const arc  = buildArcPath(from, to);

    flightPath.setAttribute("d", arc);
    flightPathActive.setAttribute("d", arc);
    flightPathActive.setAttribute("stroke", meta.color);

    flyPlane(from, to, meta.color);

    animCaption.innerHTML = `
      ✈ Routing to 
      <strong style="color:${meta.color}">
        ${meta.label}
      </strong>
      · ${REGION_LABELS[cloud] || ""}
    `;

  } catch (err) {
    console.error("Animation error:", err);
  }
}

// ── Plane Animation ───────────────────────────────────────────
function flyPlane(from, to, color) {
  plane.classList.remove("hidden");
  plane.style.color = color;

  let progress = 0;

  function animate() {
    progress += 0.02;

    const x = from.x + (to.x - from.x) * progress;
    const y = from.y + (to.y - from.y) * progress;

    plane.style.left = x + "px";
    plane.style.top  = y + "px";

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      plane.classList.add("hidden");
    }
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
    <div>
      📍 ${e.country} → ☁ ${e.cloud} (${e.region})
    </div>
  `).join("");
}

// ── Init ──────────────────────────────────────────────────────
window.detectRoute = detectRoute;
