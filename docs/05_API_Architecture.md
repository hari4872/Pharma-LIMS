# Pharma LIMS — API Architecture
### Architecture Document · v1.0 · 2026-05-27

---

## 1. Overview

All LIMS functionality is exposed through a single **RESTful JSON API** built with ASP.NET Core 8. The API follows Clean Architecture — controllers are thin, all business logic lives in CQRS handlers.

| Aspect | Detail |
|---|---|
| **Base URL** | `http://localhost:5204/api/v1/` |
| **Protocol** | HTTP/JSON |
| **Authentication** | JWT Bearer token (header: `Authorization: Bearer <token>`) |
| **Versioning** | URI prefix `/api/v1/` |
| **Swagger** | `/swagger` |
| **CORS** | Configured origins: localhost:5173, limslite.websynergiesdigital.com |

---

## 2. Authentication Endpoints

| Method | Route | Description | Auth |
|---|---|---|---|
| POST | `/auth/login` | Username + password → JWT access token | None |
| POST | `/auth/refresh` | Refresh expired token | None |
| POST | `/auth/change-password` | Change own password (requires old password) | Bearer |

**Login lockout (21 CFR §11.10(d)):** 5 failed attempts → `LockedUntil = UTC+30min`. Response: 423 with `ACCOUNT_LOCKED` error code. Every attempt logged to `LoginAuditLogs`.

---

## 3. Master Data Endpoints

| Method | Route | Description |
|---|---|---|
| GET/POST | `/laboratories` | List + create labs |
| GET/PUT | `/laboratories/{id}` | Get + update lab |
| GET/POST | `/materials` | List + create materials |
| GET/PUT/DELETE | `/materials/{id}` | Manage material |
| GET/POST | `/instruments` | List + create instruments |
| GET/PUT | `/instruments/{id}` | Manage instrument |
| POST | `/instruments/{id}/calibration` | Log calibration record |
| GET/POST | `/test-methods` | List + create test methods |
| GET/POST | `/test-methods/{id}/parameters` | Manage parameters |
| GET/POST | `/spec-limits` | List + create spec limits |
| PUT | `/spec-limits/{id}/approve` | Approve spec limit (QA e-sig) |
| GET/POST | `/users` | List + create users |
| PUT | `/users/{id}` | Update user |
| POST | `/users/{id}/unlock` | Admin unlock locked account (§11.10(d)) |

---

## 4. Sample Registration Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/samples` | List samples (filter: status, material, date) |
| POST | `/samples` | Register new sample (runs 5 GMP pre-checks) |
| GET | `/samples/{id}` | Get sample detail |
| POST | `/samples/{id}/sign-srf` | E-sign SRF → status: PendingTesting |
| GET | `/samples/{id}/containers` | List containers for sample |
| POST | `/samples/{id}/containers` | Split into aliquots (Registered/PendingTesting only) |
| POST | `/samples/{id}/containers/{cid}/destroy` | Destroy container (password + reason required) |

---

## 5. Work Queue (WAP) Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/test-executions` | Work queue list (filter: status) |
| POST | `/test-executions` | Assign task (WAP: trained analyst + calibrated instrument) |
| POST | `/test-executions/{id}/start` | Start execution (logs `started_at` UTC) |
| POST | `/test-executions/{id}/assign` | Per-execution re-assign (training + cal checks enforced) |
| POST | `/test-executions/{id}/results` | Submit results |
| POST | `/test-executions/{id}/sign-off` | Analyst e-sign step |
| GET | `/test-executions/suggest-instrument` | Auto-suggest calibrated instruments (sorted by priority) |

**Error codes on assign/re-assign:**
- `TRAINING_EXPIRED` → 422 (21 CFR §11.10(i))
- `INSTRUMENT_OOC` → 422 (21 CFR 211.68)
- `CAPACITY_EXCEEDED` → 422

---

## 6. Digital Logbook Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/digital-logbook` | List entries (filter: sample, status, date, parameter) |
| GET | `/digital-logbook/export` | CSV export with all §11.50 fields (§11.10(b)) |
| POST | `/digital-logbook/{id}/amend` | Post-sign amendment — requires password + reason |

**Amendment rules:** Original row status → `Superseded`. New `Pending` row created. Password re-auth enforced (§11.300). Error code: `ESIGN_AUTH_FAILED`.

---

## 7. Stability Study Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/stability-protocols` | List protocols |
| POST | `/stability-protocols` | Create protocol |
| GET | `/stability-trend/{protocolId}/{parameterId}` | ICH Q1A regression analysis |

**Regression response fields:** `slope`, `intercept`, `mean`, `stdDev`, `predictedShelfLifeMonths`, `flag` (0=Stable, 1=WatchNeeded, 2=ActionRequired), `timePoints[]`.

---

## 8. Compliance & Audit Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/audit/login-history` | Login audit log (filter: outcome, from, to) |
| GET | `/audit/trail` | General audit trail |
| GET | `/compliance/signatures` | Electronic signature log |

---

## 9. OOS Investigations Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/oos-investigations` | List investigations |
| GET | `/oos-investigations/{id}` | Get investigation detail |
| POST | `/oos-investigations/{id}/close` | Close investigation (root cause + CAPA + QA e-sig) |

---

## 10. Error Response Format

All errors return a structured JSON body:

```json
{
  "message": "Human-readable error description",
  "error": "MACHINE_READABLE_ERROR_CODE",
  "statusCode": 422
}
```

**Common error codes:**

| Code | Meaning |
|---|---|
| `ESIGN_AUTH_FAILED` | BCrypt password verification failed (§11.300) |
| `TRAINING_EXPIRED` | Analyst training record expired (§11.10(i)) |
| `INSTRUMENT_OOC` | Instrument out of calibration (211.68) |
| `ACCOUNT_LOCKED` | User account locked after 5 failed logins (§11.10(d)) |
| `INVALID_STATE` | Entity is in wrong state for requested operation |
| `SPEC_NOT_FOUND` | No approved spec for material |
| `LOT_EXPIRED` | Material lot past expiry date |

---

## 11. API Conventions

| Convention | Detail |
|---|---|
| **IDs** | Integer SERIAL PKs throughout |
| **Timestamps** | All timestamps in UTC ISO-8601 (`2026-05-27T09:00:00Z`) |
| **Soft delete** | No DELETE endpoints for compliance entities — `is_active = false` |
| **Pagination** | `?page=1&pageSize=50` on list endpoints |
| **Sorting** | `?sortBy=createdAt&sortDir=desc` |
| **Filtering** | Query string params per endpoint |
| **Content-Type** | `application/json` on all requests/responses |
