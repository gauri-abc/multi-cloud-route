# ✈ Multi Cloud Route

> A full-stack demo showing **geo-based multi-cloud routing** — detect your country and watch your request fly to the right cloud (AWS / Azure / GCP) in real time.

---

## 📁 Folder Structure

```
Multi-Cloud-Route/
├── server.js           ← Node.js + Express backend
├── package.json
├── .env                ← Cloud config (CLOUD_PROVIDER, REGION, PORT)
├── .gitignore
└── public/             ← Static frontend (served by Express)
    ├── index.html
    ├── style.css
    └── script.js
```

---

## 🚀 Running Locally

### Prerequisites
- Node.js v18+ installed

### Steps

```bash
# 1. Enter the project directory
cd Multi-Cloud-Route

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

Open your browser at **http://localhost:3000**

For auto-reload during development:
```bash
npm run dev
```

---

## ⚙️ Environment Variables (`.env`)

| Variable         | Values               | Description                     |
|------------------|----------------------|---------------------------------|
| `CLOUD_PROVIDER` | `AWS` / `AZURE` / `GCP` | Forces a specific cloud label   |
| `REGION`         | `India` / `Europe` / `APAC` | Human-readable region label  |
| `PORT`           | `3000` (default)     | Port the server listens on      |

### Routing Logic

| User Region  | Default Cloud | Region               |
|--------------|--------------|----------------------|
| India / South Asia | **AWS**  | ap-south-1 (Mumbai)  |
| Europe       | **Azure** | westeurope (Netherlands) |
| APAC         | **GCP**   | asia-east1 (Taiwan)   |
| Everything else | **AWS** | ap-south-1 (default) |

> **Tip:** When `CLOUD_PROVIDER` is set in `.env`, that value always wins over the country-based lookup. This is how you'd pin each deployed node.

---

## ☁️ Deploying to Multiple Clouds

The **same codebase** runs on all clouds. Only the `.env` differs:

### AWS (India node)
```env
CLOUD_PROVIDER=AWS
REGION=India
PORT=3000
```

### Azure (Europe node)
```env
CLOUD_PROVIDER=AZURE
REGION=Europe
PORT=3000
```

### GCP (APAC node)
```env
CLOUD_PROVIDER=GCP
REGION=APAC
PORT=3000
```

A global load balancer (AWS Route 53 / Azure Front Door / GCP Traffic Manager)
routes users geographically to the nearest node.

---

## 🌐 API Endpoints

### `GET /api/route`
Returns routing decision for the caller's IP.

**Response:**
```json
{
  "user_ip": "103.x.x.x",
  "user_country": "India",
  "user_country_code": "IN",
  "user_city": "Mumbai",
  "cloud": "AWS",
  "region": "India (Mumbai)",
  "region_code": "ap-south-1",
  "color": "#FF9900",
  "timestamp": "2025-04-17T09:00:00.000Z",
  "server_node": "AUTO"
}
```

### `GET /api/health`
Health check for load balancers.

---

## 🎨 Features

- 🌍 **IP Geolocation** via [ip-api.com](http://ip-api.com) (free, no key needed)
- ✈️ **Bezier plane animation** flying from user → cloud node
- 🌟 **Animated starfield** background
- 📋 **Live request log** showing last 5 routings
- 🎨 **Dark glassmorphism** UI with cloud-specific colour accents
- 📱 **Fully responsive** layout
