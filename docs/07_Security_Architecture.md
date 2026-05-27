# Pharma LIMS — Security Architecture
### Architecture Document · v1.0 · 2026-05-27
**Standard:** 21 CFR Part 11 §11.10, §11.50, §11.300 / EU GMP Annex 11 §6, §9 / ALCOA+

---

## 1. Authentication

### JWT Bearer Token

```
POST /api/v1/auth/login
Body: { "username": "...", "password": "..." }

Response:
  200 OK → { "accessToken": "eyJ...", "expiresIn": 28800 }
  423 Locked → { "error": "ACCOUNT_LOCKED", "lockedUntil": "2026-05-27T09:30:00Z" }
  401 → { "error": "INVALID_CREDENTIALS" }
```

- Token lifetime: **480 minutes** (8 hours = one shift)
- Algorithm: HS256
- Claims: `userId`, `username`, `role`, `userType`, `labId`
- All protected endpoints require: `Authorization: Bearer <token>`

### Password Hashing

- Algorithm: **BCrypt** with work factor 12
- Password re-entry on every e-sig event verified independently of session token (**21 CFR §11.300**)
- `BCrypt.Verify(enteredPassword, storedHash)` called server-side in `IElectronicSignatureService`

---

## 2. Login Lockout — 21 CFR §11.10(d)

| Event | System Action |
|---|---|
| Failed login | `users.FailedLoginCount++`; login attempt written to `LoginAuditLogs` |
| 5th consecutive failure | `users.LockedUntil = UTC.Now + 30min`; response: HTTP 423 `ACCOUNT_LOCKED` |
| Successful login | `users.FailedLoginCount = 0`; `LastLoginAt` + `LastLoginIp` updated |
| Admin unlock | `POST /users/{id}/unlock` — resets count + clears `LockedUntil`; audit-logged |
| Lockout expiry | System auto-releases after 30 minutes; no manual action needed |

**Every login attempt** (success, failure, lockout) is written to `LoginAuditLogs` as an INSERT-only record including: `username_attempt`, `outcome`, `ip_address`, `user_agent`, `attempted_at` (UTC).

---

## 3. Electronic Signatures — 21 CFR §11.50 + §11.300

All compliance actions require an **electronic signature** with four mandatory fields:

| Field | Source | Compliance |
|---|---|---|
| `full_name` | From `users.full_name` at sign time | §11.50(a)(1) |
| `signed_at` | UTC server-side (`DateTime.UtcNow`) | §11.50(a)(2) |
| `meaning` | Selected from controlled vocabulary | §11.50(a)(3) |
| `reason` | Free-text (mandatory where indicated) | §11.50(a)(3) |

**Password re-entry flow (every e-sig):**
```
1. Analyst enters password in UI
2. Frontend POSTs { password, meaning, reason } to API
3. IElectronicSignatureService.CreateSignature():
   a. Loads user from DB
   b. BCrypt.Verify(password, user.PasswordHash)   ← §11.300
   c. If match: INSERT electronic_signatures row
   d. If mismatch: throw ESIGN_AUTH_FAILED
4. Session token NOT sufficient — password required every time
```

### E-Sig Events

| Module | Event | Enforced By |
|---|---|---|
| Sample Registration | SRF sign-off | `SignSrfCommand` |
| Testing Execution | Step sign-off | `SignOffTestExecutionCommand` |
| Digital Logbook | Post-sign Amendment | `AmendLogbookEntryCommand` |
| OOS Investigation | Phase 1 / Phase 2 close | `CloseOosInvestigationCommand` |
| QA Review | CoA approval | `ApproveCoACommand` |
| Spec Limits | Approve spec | `ApproveSpecLimitCommand` |
| Instrument | Calibration approval | `ApproveCalibrationCommand` |
| Sample Inventory | Pull confirmation / Destroy | Various commands |

---

## 4. Role-Based Access Control (RBAC)

### User Types

| Type | Description |
|---|---|
| `Admin` | System admin — user management, config, unlock |
| `RegularUser` | All lab users — role-restricted |

### Roles (RegularUser variants)

| Role | Typical Permissions |
|---|---|
| `Analyst` | Register samples, enter results, e-sign steps |
| `QA` | Approve specs, review CoA, close OOS, approve calibration |
| `QCLead` | QC lead verification (4-eyes step 3) |
| `LabManager` | WAP assignment, re-assign tasks |
| `Supervisor` | Cross-module read + limited write |
| `ReadOnly` | View-only across all modules |

### Segregation of Duties (enforced at API level)

| Rule | Enforcement |
|---|---|
| Analyst cannot peer-review own results | `reviewer_id ≠ analyst_id` check in handler |
| QC Lead cannot be the Analyst or Peer Reviewer | Three-way ≠ check |
| QA cannot also be the testing Analyst | Role check at sign-off |
| Admin cannot delete results or audit entries | No DELETE endpoint exists |

---

## 5. Data Security

| Control | Implementation |
|---|---|
| **Transport** | HTTPS enforced in production (Azure App Service) |
| **DB credentials** | Not in source — environment variable / Azure Key Vault |
| **API keys** | Groq key not committed to source (redacted in `appsettings.json`) |
| **JWT secret** | 256-bit minimum; stored in environment config |
| **No secrets in logs** | Password never logged; token not logged at DEBUG |
| **Soft delete** | No `DELETE` SQL on compliance entities — `is_active = false` |
| **INSERT-only audit** | DB-level: no application code has UPDATE/DELETE on audit tables |

---

## 6. Audit Trail — 21 CFR §11.10(e)

Every state change on a compliance entity generates an **INSERT-only** audit record:

```sql
-- Enforced at DB level — triggers reject UPDATE/DELETE on audit tables
CREATE TABLE master_data_audit_log (
  log_id      BIGINT IDENTITY,
  entity_type VARCHAR NOT NULL,
  entity_id   INT NOT NULL,
  action      VARCHAR NOT NULL,  -- Create | Update | Approve | Retire
  changed_by  VARCHAR NOT NULL,
  changed_at  TIMESTAMPTZ NOT NULL,
  old_values  JSONB,
  new_values  JSONB
);
```

- **Who:** `changed_by` (username) + `analyst_id` FK
- **When:** `changed_at` UTC server-side — never client-supplied
- **What:** `action` + `old_values` / `new_values` JSONB diff
- **Where:** Entity type + entity ID

---

## 7. CORS Configuration

```json
"Frontend": {
  "Origins": [
    "http://localhost:5173",
    "http://limslite.websynergiesdigital.com",
    "https://limslite.websynergiesdigital.com"
  ]
}
```

Credentials allowed: `true` (required for JWT cookie fallback).

---

## 8. Input Validation

| Layer | Tool | What |
|---|---|---|
| **Frontend** | TypeScript typing | Compile-time shape validation |
| **API Controller** | ASP.NET Model binding | Null / type checks |
| **Application Handler** | FluentValidation | Business rule validation (required fields, ranges, state) |
| **Database** | PostgreSQL constraints | NOT NULL, UNIQUE, FK RESTRICT |

Server-side validation is **authoritative** — frontend validation is convenience only. No business rule lives solely in React.
