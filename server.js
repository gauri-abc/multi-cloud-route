// ============================================================
//  Multi-Cloud-Route  – Express Backend
//  Detects user IP → country → maps to cloud provider
//  Environment variables control which cloud "owns" this node
// ============================================================

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();
app.set("trust proxy", true);
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve the static frontend from /public
app.use(express.static(path.join(__dirname, "public")));

// ── Cloud Routing Logic ───────────────────────────────────────
// This is the core business rule that maps a country/continent
// to a cloud provider.  The CLOUD_PROVIDER env-var overrides it
// when we want a specific node to always claim a certain cloud.

const CLOUD_CONFIG = {
  AWS: {
    // Primary regions that route to AWS (India)
    countries: ["IN", "PK", "BD", "LK", "NP", "BT", "MV"],
    region: "ap-south-1",
    regionLabel: "India (Mumbai)",
    color: "#FF9900",
  },
  AZURE: {
    // Primary regions that route to Azure (Europe)
    countries: [
      "GB", "DE", "FR", "IT", "ES", "NL", "SE", "NO", "DK", "FI",
      "PL", "AT", "BE", "CH", "PT", "CZ", "HU", "RO", "GR", "IE",
    ],
    region: "westeurope",
    regionLabel: "Europe (Netherlands)",
    color: "#0089D6",
  },
  GCP: {
    // Primary regions that route to GCP (APAC)
    countries: [
      "JP", "CN", "SG", "AU", "KR", "TH", "MY", "ID", "PH", "VN",
      "NZ", "HK", "TW",
    ],
    region: "asia-east1",
    regionLabel: "APAC (Taiwan)",
    color: "#4285F4",
  },
};

// Default cloud when no env override is set and country doesn't match
const DEFAULT_CLOUD = "AWS";

/**
 * Determine which cloud should serve this request.
 * Priority: ENV variable → country-based lookup → default (AWS)
 */
function resolveCloud(countryCode) {
  // ❗ If no location → DON'T route
  if (!countryCode) {
    return {
      cloud: "UNKNOWN",
      region: "Unknown",
      regionLabel: "Location not detected",
      color: "#999999",
    };
  }

  const envCloud = process.env.CLOUD_PROVIDER?.toUpperCase();

  if (envCloud && CLOUD_CONFIG[envCloud]) {
    return { cloud: envCloud, ...CLOUD_CONFIG[envCloud] };
  }

  for (const [cloud, config] of Object.entries(CLOUD_CONFIG)) {
    if (config.countries.includes(countryCode)) {
      return { cloud, ...config };
    }
  }

  return {
    cloud: "UNKNOWN",
    region: "Unknown",
    regionLabel: "No matching region",
    color: "#999999",
  };
}

// ── IP Geolocation ────────────────────────────────────────────
/**
 * Get geolocation data for an IP address using ip-api.com (free, no key needed)
 * Falls back to a demo payload when using localhost / private IPs.
 */
async function getGeoData(ip) {
  // Private / loopback IPs → return demo data
  const isLocal =
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.");

  if (isLocal) {
    return {
      country: "India (Demo - localhost)",
      countryCode: "IN",
      city: "Mumbai",
      isp: "Local Development",
      ip: ip,
    };
  }

  try {
    const token = process.env.IPINFO_TOKEN || "YOUR_TOKEN";
    const response = await axios.get(`https://ipinfo.io/${ip}/json?token=${token}`, {
      timeout: 5000,
    });

    if (response.data.error) {
      throw new Error("Geolocation lookup failed: " + response.data.error.message);
    }

    return {
      country: response.data.country,       // ipinfo returns the 2-letter code here
      countryCode: response.data.country,   // We use this for routing logic
      city: response.data.city,
      isp: response.data.org,               // ipinfo uses "org" for ISP/ASN info
      ip: response.data.ip || ip,
    };
  } catch (err) {
    // 👇 Fallback (VERY IMPORTANT)
    return {
      country: "Unknown",
      countryCode: null,
      city: "Unknown",
      isp: "Unknown",
      ip: ip,
    };
  }
}

// ── Routes ────────────────────────────────────────────────────

/**
 * GET /api/route
 * Main routing decision endpoint.
 * Returns geo info + which cloud handles this request.
 */
app.get("/api/route", async (req, res) => {
  try {
    // Extract real IP (works behind proxies / load balancers)
    const rawIp =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    const geo = await getGeoData(rawIp);
    const routing = resolveCloud(geo.countryCode);

    const payload = {
      user_ip: geo.ip,
      user_country: geo.country,
      user_country_code: geo.countryCode,
      user_city: geo.city,
      cloud: routing.cloud,
      region: routing.regionLabel,
      region_code: routing.region,
      color: routing.color,
      timestamp: new Date().toISOString(),
      server_node: process.env.CLOUD_PROVIDER || "AUTO",
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

/**
 * GET /api/health
 * Quick health-check used by load-balancers / monitors.
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    cloud: process.env.CLOUD_PROVIDER || "AUTO",
    region: process.env.REGION || "AUTO",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Catch-all: send the frontend for any unmatched route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start Server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌐 Multi-Cloud-Route server running at http://localhost:${PORT}`);
  console.log(`   Cloud node  : ${process.env.CLOUD_PROVIDER || "AUTO (country-based)"}`);
  console.log(`   Region      : ${process.env.REGION || "AUTO"}`);
  console.log(`   Environment : ${process.env.NODE_ENV || "development"}\n`);
});
