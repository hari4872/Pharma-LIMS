# Pharma LIMS — Architecture Quick Reference
### Single-page reference card · v1.0 · 2026-05-27

---

## Stack at a Glance

| Layer | Tech | Location |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | `D:\Pharma-LIMS\frontend\` |
| Backend | .NET 8 + Clean Architecture + CQRS | `D:\Pharma-LIMS\backend\src\` |
| Database | PostgreSQL 16 (Azure) | Host: 52.230.33.120:5432 / DB: limslite |
| ORM | EF Core 8 (code-first) | 29 migrations applied |
| Auth | JWT Bearer + BCrypt | §11.300 independent password re-entry |
| AI | Groq llama-3.1-8b-instant | Chatbot only — no core workflow dependency |

---

## Critical File Paths

| File | Purpose |
|---|---|
| `backend/src/LIMS.API/Program.cs` | DI registration, middleware, CORS, background jobs |
| `backend/src/LIMS.Infrastructure/Persistence/LimsDbContext.cs` | EF DbContext, DbSet registrations |
| `backend/src/LIMS.Infrastructure/Migrations/` | 29 migration files |
| `backend/src/LIMS.Infrastructure/Persistence/PhaseBConfiguration.cs` | EF fluent config — **snake_case table names** |
| `frontend/src/api/client.ts` | Axios instance, baseURL, JWT interceptor |
| `frontend/src/pages/master-data/LaboratoriesPage.tsx` | Shared UI primitives (Modal, Field, inp, PageHeader) |
| `frontend/vite.config.ts` | Proxy: `/api` → `http://localhost:5204` |

---

## Key Conventions

### Backend
- **All business logic in Application layer** — controllers are thin (no logic, just MediatR.Send)
- **CQRS**: Commands mutate state; Queries read state — never mix
- **Error codes**: machine-readable string in `{ "error": "CODE" }` response body
- **UTC everywhere**: `DateTime.UtcNow` in handlers; `TIMESTAMPTZ DEFAULT NOW()` in DB
- **DB table names**: snake_case per `builder.ToTable("snake_case")` — NOT EF class name
- **No hardcoded values**: all thresholds from `lab_config` table keyed by `(lab_id, key)`

### Frontend
- **Shared primitives** from `LaboratoriesPage.tsx`: `Modal`, `Field`, `ModalFooter`, `inp` style, `PageHeader`, `StatusBadge`
- **Toast notifications**: `import { toast } from '@/components/Toast'`
- **API calls**: `import api from '@/api/client'` — Axios with baseURL + JWT header
- **Inline styles** throughout — no CSS classes or Tailwind

---

## Compliance Quick Reference

| Need | Control | Code |
|---|---|---|
| Every e-sig | `IElectronicSignatureService.CreateSignature()` | BCrypt.Verify → INSERT electronic_signatures |
| Login lockout | `AuthController.Login()` | 5 failures → `LockedUntil = UTC+30min` |
| Audit log | `MasterDataAuditLog` | INSERT-only; never UPDATE/DELETE |
| LOGIN audit | `LoginAuditLogs` | Every attempt; outcome: Success/Failed/LockedOut |
| Result immutability | `digital_logbook_entries` | INSERT-only after Signed; amendment = new row |
| Training gate | `AssignWorkQueueItemCommand` | `valid_until > today` or TRAINING_EXPIRED |
| Cal gate | `AssignWorkQueueItemCommand` | `calibration_due > today` or INSTRUMENT_OOC |
| OOS auto-raise | `OosDetectionService` | If `result < spec_min || result > spec_max` |

---

## API Quick Reference

| Action | Method + Route |
|---|---|
| Login | `POST /api/v1/auth/login` |
| Register sample | `POST /api/v1/samples` |
| Sign SRF | `POST /api/v1/samples/{id}/sign-srf` |
| Split containers | `POST /api/v1/samples/{id}/containers` |
| Destroy container | `POST /api/v1/samples/{id}/containers/{cid}/destroy` |
| Assign WAP task | `POST /api/v1/test-executions` |
| Re-assign execution | `POST /api/v1/test-executions/{id}/assign` |
| Start task | `POST /api/v1/test-executions/{id}/start` |
| Submit results | `POST /api/v1/test-executions/{id}/results` |
| Sign off step | `POST /api/v1/test-executions/{id}/sign-off` |
| Amend logbook entry | `POST /api/v1/digital-logbook/{id}/amend` |
| Export logbook CSV | `GET /api/v1/digital-logbook/export` |
| ICH regression | `GET /api/v1/stability-trend/{protocolId}/{parameterId}` |
| Login audit | `GET /api/v1/audit/login-history` |
| Unlock user | `POST /api/v1/users/{id}/unlock` |
| Close OOS | `POST /api/v1/oos-investigations/{id}/close` |

---

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `ESIGN_AUTH_FAILED` | 422 | Wrong password on e-sig |
| `TRAINING_EXPIRED` | 422 | Analyst training not current |
| `INSTRUMENT_OOC` | 422 | Instrument out of calibration |
| `ACCOUNT_LOCKED` | 423 | 5 failed logins — 30-min lockout |
| `INVALID_STATE` | 422 | Entity in wrong state for action |
| `SPEC_NOT_FOUND` | 422 | No approved spec for material |
| `LOT_EXPIRED` | 422 | Material lot past expiry |

---

## Database Entities (Key)

| Entity | Table | Status |
|---|---|---|
| User | `users` | ✅ Built (includes lockout fields) |
| Sample | `samples` | ✅ Built |
| SampleContainer | `SampleContainers` | ✅ Built (LabVantage parity) |
| TestExecution | `test_executions` | ✅ Built |
| DigitalLogbookEntry | `digital_logbook_entries` | ✅ Built (includes amendment fields) |
| OosInvestigation | `oos_investigations` | ✅ Built |
| ElectronicSignature | `electronic_signatures` | ✅ Built (INS-ONLY) |
| LoginAuditLog | `LoginAuditLogs` | ✅ Built (INS-ONLY, LabVantage parity) |
| StabilityProtocol | `stability_protocols` | ✅ Built (snake_case!) |
| StabilityTrendPoint | `StabilityTrendPoints` | ✅ Built (LabVantage parity) |
| Instrument | `instruments` | ✅ Built |
| CalibrationRecord | `calibration_records` | ✅ Built |
| SpecLimit | `spec_limits` | ✅ Built |
| TestMethod | `test_methods` | ✅ Built |
| CoA | `coas` | 🔲 Planned |
| CoaApproval | `coa_approvals` | 🔲 Planned |

---

## Documentation Index

| Doc | Purpose |
|---|---|
| `01_System_Overview.md` | Executive summary, capabilities, tech stack |
| `02_C4_Model.md` | Context → Container → Component → Code diagrams |
| `03_ARC42.md` | Full ARC42 architecture documentation |
| `04_Domain_Model.md` | Aggregates, value objects, domain services, invariants |
| `05_API_Architecture.md` | All endpoints, conventions, error codes |
| `06_Data_Architecture.md` | Schema, migrations, data flows, indexes |
| `07_Security_Architecture.md` | Auth, e-sig, lockout, RBAC, CORS |
| `08_Deployment_Architecture.md` | Azure infra, build, background jobs |
| `09_ADRs.md` | Architecture Decision Records (9 decisions) |
| `10_Runtime_Flows.md` | 7 key runtime sequences with step-by-step detail |
| `11_Validation_and_Compliance.md` | GAMP 5, IQ/OQ/PQ, §11 clause mapping, ALCOA+ evidence |
| `12_Technical_Debt.md` | 12 items (3 high, 5 medium, 4 low) |
| `13_User_Role_Permission_Matrix.md` | Permission matrix + segregation of duties |
| `ERD.md` | Full entity relationship diagram (all phases) |
| `DFD.md` | Data flow diagram |
| `.md files/` | Per-module Technical Design Documents (TDDs) |
