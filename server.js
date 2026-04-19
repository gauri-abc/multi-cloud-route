// ============================================================
//  Multi-Cloud-Route – Express Backend (STRICT REGION MODE)
//  Each cloud ONLY serves its assigned region
//  Uses Cloudflare header: cf-ipcountry
// ============================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.set("trust proxy", true);
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Cloud Config ──────────────────────────────────────────────
const CLOUD_CONFIG = {
  AWS: {
    countries: ["IN", "PK", "BD", "LK", "NP", "BT", "MV"],
    region: "ap-south-1",
    regionLabel: "India (Mumbai)",
    color: "#FF9900",
  },
  AZURE: {
    countries: [
      "GB", "DE", "FR", "IT", "ES", "NL", "SE", "NO", "DK", "FI",
      "PL", "AT", "BE", "CH", "PT", "CZ", "HU", "RO", "GR", "IE",
    ],
    region: "westeurope",
    regionLabel: "Europe (Netherlands)",
    color: "#0089D6",
  },
  GCP: {
    countries: [
      "JP", "CN", "SG", "AU", "KR", "TH", "MY", "ID", "PH", "VN",
      "NZ", "HK", "TW",
    ],
    region: "asia-east1",
    regionLabel: "APAC (Taiwan)",
    color: "#4285F4",
  },
};

// ── STRICT ROUTING FUNCTION ───────────────────────────────────
function resolveCloud(countryCode) {
  const currentCloud = process.env.CLOUD_PROVIDER?.toUpperCase();

  // ❗ No location → reject
  if (!countryCode) {
    return {
      cloud: "UNKNOWN",
      region: "Unknown",
      regionLabel: "Location not detected",
      color: "#999999",
      allowed: false,
    };
  }

  // ❗ Invalid cloud config
  if (!currentCloud || !CLOUD_CONFIG[currentCloud]) {
    return {
      cloud: "UNKNOWN",
      region: "Unknown",
      regionLabel: "Invalid server config",
      color: "#999999",
      allowed: false,
    };
  }

  const config = CLOUD_CONFIG[currentCloud];

  // ✅ If user belongs to this cloud's region
  if (config.countries.includes(countryCode)) {
    return {
      cloud: currentCloud,
      region: config.region,
      regionLabel: config.regionLabel,
      color: config.color,
      allowed: true,
    };
  }

  // ❌ If NOT from this region → reject
  return {
    cloud: "REJECTED",
    region: "Outside service region",
    regionLabel: `This ${currentCloud} node only serves ${config.regionLabel}`,
    color: "#999999",
    allowed: false,
  };
}

// ── Routes ────────────────────────────────────────────────────
app.get("/api/route", async (req, res) => {
  try {
    const rawIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.split(":")[0] ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    const countryCode = req.headers["cf-ipcountry"] || null;

    const routing = resolveCloud(countryCode);

    const payload = {
      user_ip: rawIp,
      user_country: countryCode || "Unknown",
      user_country_code: countryCode,
      cloud: routing.cloud,
      region: routing.regionLabel,
      region_code: routing.region,
      allowed: routing.allowed,
      message: routing.allowed
        ? "Request served successfully"
        : "This region is not served by this cloud node",
      timestamp: new Date().toISOString(),
      server_node: process.env.CLOUD_PROVIDER || "UNKNOWN",
    };

    res.json(payload);
  } catch (err) {
    console.error("Route resolution error:", err.message);
    res.status(500).json({
      error: "Could not determine routing",
      detail: err.message,
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    cloud: process.env.CLOUD_PROVIDER,
    region: process.env.REGION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Frontend fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🌐 Server running on port ${PORT}`);
  console.log(`☁ Cloud node: ${process.env.CLOUD_PROVIDER}`);
});
