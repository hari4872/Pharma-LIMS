# Pharma LIMS — Deployment Architecture
### Architecture Document · v1.0 · 2026-05-27

---

## 1. Production Infrastructure

```
Azure Cloud (Southeast Asia region)
│
├── Azure App Service (Linux, .NET 8)
│     ├── LIMS.API (published build)
│     ├── URL: limslite.websynergiesdigital.com
│     ├── Port: 5204 (internal) → 80/443 (external)
│     └── Environment Variables:
│           ConnectionStrings__DefaultConnection = "Host=...;..."
│           Jwt__Key = "<256-bit secret>"
│           Groq__ApiKey = "<key>"  ← never in source
│
├── Azure Database for PostgreSQL (Flexible Server)
│     ├── Host: 52.230.33.120
│     ├── Port: 5432
│     ├── Database: limslite
│     ├── User: limsliteuser
│     ├── SSL Mode: Prefer + Trust Server Certificate
│     ├── Daily automated backup (RPO ≤ 24h)
│     └── Geo-redundant backup: enabled
│
└── Static Web Hosting (optional)
      └── Vite dist/ → Azure Static Web Apps or served by App Service
```

---

## 2. Development Environment

```
Local Machine (Windows)
├── Backend
│   ├── Source: D:\Pharma-LIMS\backend\src\
│   ├── Published: D:\Pharma-LIMS\backend\publish\
│   ├── Port: 5204
│   └── Start: dotnet run / start-dev.ps1
│
├── Frontend
│   ├── Source: D:\Pharma-LIMS\frontend\src\
│   ├── Port: 5173 (Vite dev server)
│   ├── Proxy: /api/* → http://localhost:5204
│   └── Start: npm run dev
│
└── Database
      └── Remote Azure PostgreSQL (same as production)
            Host: 52.230.33.120:5432
```

---

## 3. Build & Publish

### Backend

```powershell
cd D:\Pharma-LIMS\backend
dotnet publish src\LIMS.API\LIMS.API.csproj -c Release -o publish\
```

### Frontend

```bash
cd D:\Pharma-LIMS\frontend
npm run build
# Output: dist/ (static files for deployment)
```

### Database Migrations

```bash
# Generate migration (requires backend not running — DLL lock)
dotnet ef migrations add <MigrationName> \
  --project src\LIMS.Infrastructure \
  --startup-project src\LIMS.API

# Apply migrations
dotnet ef database update \
  --project src\LIMS.Infrastructure \
  --startup-project src\LIMS.API

# Emergency: apply SQL directly via psql
psql "Host=52.230.33.120;..." -c "ALTER TABLE ..."
```

**⚠ Critical:** `stability_protocols` table name is snake_case. Manual SQL must use `"stability_protocols"` not `"StabilityProtocols"`.

---

## 4. Configuration Files

| File | Purpose | Committed |
|---|---|---|
| `appsettings.json` | Base config; Groq API key **redacted** | ✅ (key empty) |
| `appsettings.Development.json` | Dev overrides | ✅ |
| `appsettings.Production.json` | Prod overrides (key populated via env vars) | ✅ (no secrets) |
| `frontend/.env` | Vite env vars (VITE_API_URL) | ✅ |
| `frontend/.env.production` | Production Vite env | ✅ |

**Secret handling:** All secrets (DB password, JWT key, Groq key) injected at runtime via Azure environment variables. Never committed to git.

---

## 5. GitHub Repository

| Item | Value |
|---|---|
| **Repository** | https://github.com/hari4872/Pharma-LIMS |
| **Branch** | `main` |
| **Push protection** | GitHub secret scanning enabled |
| **Note** | This repo is LIMS ONLY — never push MES code here |

---

## 6. Background Jobs Runtime

All 13 background jobs run as `IHostedService` within the same App Service process:

| Job | Schedule | What it does |
|---|---|---|
| `CalibrationDueDateJob` | Daily 02:00 UTC | Marks instruments OOC if past `calibration_due`; sends T-7/T-1 alerts |
| `TrainingExpiryJob` | Daily 02:30 UTC | Flags expired training records; sends T-7 alert |
| `TATBreachJob` | Hourly | Detects samples past TAT; flags OVERDUE in Work Queue |
| `PullReminderJob` | Daily 03:00 UTC | T-7/T-1 reminders for stability pulls |
| `MissedPullJob` | Daily 03:30 UTC | Escalates missed stability pull events |
| `DestructionAlertJob` | Daily 04:00 UTC | T-90/T-30/T-7 alerts for retain sample destruction |
| `PMReminderJob` | Daily 04:30 UTC | Preventive maintenance T-7/T-1 |
| `UtilisationSummaryJob` | Daily 05:00 UTC | Builds `instrument_utilisation_summary` (7/30/90-day windows) |

All schedules configurable from `lab_config` — no hardcoded intervals (Contract 2).

---

## 7. Security Perimeter

```
Internet
  │
  ▼ HTTPS (port 443)
Azure App Service (TLS 1.2+)
  │
  ▼ Internal HTTP (port 5204)
LIMS.API
  │
  ▼ PostgreSQL wire protocol (port 5432, SSL)
Azure PostgreSQL
```

- TLS 1.2+ enforced at App Service level
- PostgreSQL connection uses SSL Prefer
- No direct DB access from internet — DB in Azure VNet (or firewall rule: App Service IP only)
- JWT tokens expire after 480 minutes; no persistent cookies in default config

---

## 8. Monitoring & Alerting

| Signal | Tool | Threshold |
|---|---|---|
| API errors (5xx) | Azure App Insights | Alert if > 5 in 5 min |
| DB connection failures | App Insights / retry policy logs | Alert on 3rd retry |
| Calibration OOC | LIMS `CalibrationDueDateJob` | In-app alert to Lab Manager |
| TAT breach | LIMS `TATBreachJob` | In-app OVERDUE badge |
| Login lockout | `LoginAuditLogs` | Compliance panel shows in real-time |
