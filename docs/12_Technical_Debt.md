# Pharma LIMS — Technical Debt Register
### Architecture Document · v1.0 · 2026-05-27

---

## Summary

| Priority | Count | Description |
|---|---|---|
| 🔴 High | 3 | Must resolve before next audit / scale-up |
| 🟡 Medium | 5 | Should resolve within next 2 sprints |
| 🟢 Low | 4 | Improvements for v2 |

---

## 🔴 High Priority

### TD-001: No SignalR — Real-Time Push Not Implemented

**Description:** All design contracts specify SignalR push for Work Queue updates, TAT alerts, and OOS notifications. Currently, users must manually refresh pages.

**Impact:** Analysts may miss overdue alerts; Lab Manager cannot see real-time queue changes.

**Effort:** Medium (2 sprints — requires Azure SignalR Service + client subscription setup)

**Mitigation (current):** `TATBreachJob` marks items OVERDUE in DB hourly; badge visible on next page load.

**Resolution:** Add Azure SignalR Service; wire `IHubContext` in background jobs; update React pages to subscribe.

---

### TD-002: Groq API Key Redacted in appsettings.json

**Description:** The Groq API key was committed to `appsettings.json` in an earlier commit (removed in commit `c75fc4d`). The key has been rotated. Future deploys must inject via environment variable, not config file.

**Impact:** If old commit is checked out, an invalid key is present. Chatbot will fail until key injected.

**Resolution:** Document environment variable injection procedure in `08_Deployment_Architecture.md`. ✅ Done.

**Prevention:** Add `appsettings.json` to `.gitattributes` secret scanning. GitHub push protection now blocks.

---

### TD-003: EF Migration Designer.cs Files Incomplete

**Description:** `20260527120000_Add_IntendedShelfLife.cs` was created manually without a corresponding `.Designer.cs` snapshot file. EF model snapshot (`LimsDbContextModelSnapshot.cs`) may be out of sync.

**Impact:** Running `dotnet ef migrations add` may generate an incorrect diff until snapshot is regenerated.

**Effort:** Low (30 minutes — stop backend, run `dotnet ef migrations add EmptySync`, delete the empty migration, push)

**Resolution:**
```bash
# With backend stopped:
dotnet ef migrations add SyncSnapshot \
  --project backend/src/LIMS.Infrastructure \
  --startup-project backend/src/LIMS.API
# Review generated migration — should be empty
# If empty: commit .Designer.cs + updated ModelSnapshot; delete the migration itself
```

---

## 🟡 Medium Priority

### TD-004: No Unit Tests

**Description:** No unit test project exists. All validation has been done via Playwright E2E tests and manual API testing via curl.

**Impact:** Regression risk on business rule changes (OOS detection, WAP assignment gates, e-sig validation).

**Effort:** Large (4–6 sprints for adequate coverage)

**Priority areas:**
- `OosDetectionService` (OOS + OOT logic)
- `ParameterCalculationService` (formula evaluation)
- `IElectronicSignatureService` (§11.300 BCrypt path)
- `AssignTestMethodCommand` (training + cal gate)
- `AmendLogbookEntryCommand` (state guards + amendment chain)

---

### TD-005: Normalizer Views Not Yet Created in DB

**Description:** `06_Data_Architecture.md` and `12_Compliance_Governance` reference `vw_*` views (`vw_instrument_status`, `vw_wip_summary`, etc.). These are designed but not yet materialised in the DB.

**Impact:** Dashboard panels query base tables directly (works but slower; not the single-view pattern per Contract 2).

**Effort:** Medium (1 sprint — SQL view definitions + query refactors)

---

### TD-006: Soft-Delete Not Enforced on All Tables

**Description:** Some tables (e.g. `wap_assignments`, `process_log_rows`) may not have `is_active` column. EF `SaveChanges` could issue a hard DELETE on orphan cleanup.

**Impact:** Potential ALCOA+ Enduring violation if EF cascade delete fires on a compliance record.

**Resolution:** Audit all EF entity configurations for `OnDelete(DeleteBehavior.Restrict)` or `DeleteBehavior.NoAction`. Add `is_active` where missing.

---

### TD-007: No PDF Generation for CoA

**Description:** CoA entity and approval workflow are implemented, but PDF generation (`CoAGenerationService` with locked PDF blob) is not yet implemented.

**Impact:** CoA exists in DB but cannot be physically printed or distributed. ERP integration not possible without PDF.

**Effort:** Medium (1 sprint — ReportLab equivalent in .NET, e.g. QuestPDF or iTextSharp)

---

### TD-008: Stability Trend Regression Is Client-Computed

**Description:** `GetStabilityTrendQuery` computes linear regression in C#. For large datasets (100+ time points), this may be slow.

**Impact:** Low at current scale (7 ICH time points maximum). Will need DB-side computation at scale.

**Resolution (future):** Push regression to PostgreSQL using `regr_slope()`, `regr_intercept()` aggregate functions.

---

## 🟢 Low Priority (v2 Improvements)

### TD-009: Vite Proxy Target Hardcoded to Port 5204

**Description:** `vite.config.ts` proxies `/api` to `http://localhost:5204`. If backend port changes, this must be manually updated.

**Resolution:** Read proxy target from `VITE_API_URL` env variable in `vite.config.ts`.

---

### TD-010: No Pagination on Audit Trail Export

**Description:** `GET /digital-logbook/export` streams all records matching the filter. For large labs (years of data), this could time out.

**Resolution:** Add streaming CSV with chunked response, or limit export to 90-day windows with pagination.

---

### TD-011: EF ModelSnapshot Out of Sync Warning

**Description:** Running migrations on a team member's machine may show "snapshot was generated with a newer version" warning due to the manually-created migration without Designer.cs.

**Resolution:** See TD-003 (same fix).

---

### TD-012: No Rate Limiting on API

**Description:** No rate limiting on `/auth/login` or other public endpoints beyond the 5-strike lockout.

**Impact:** Brute-force is limited by lockout but not by request rate — a script could enumerate usernames.

**Resolution:** Add ASP.NET Core rate limiting middleware (`builder.Services.AddRateLimiter()`): 10 req/min on `/auth/login`.

---

## Resolved Technical Debt (Completed 2026-05-27)

| Item | Resolution |
|---|---|
| ✅ `GET /stability-trend/1/1` returning 500 | `IntendedShelfLifeMonths` column added via manual ALTER TABLE + migration file |
| ✅ Vite proxy port mismatch (5000 → 5204) | `vite.config.ts` updated |
| ✅ Admin password wrong hash in seed | EF migration `Fix_AdminPassword_For_Tests` applied |
| ✅ UserType='Internal' in seed data | EF migration `Fix_UserType_Internal_To_RegularUser` applied |
| ✅ Login button missing `type="submit"` | `LoginPage.tsx` fixed |
