# Pharma LIMS — Architecture Decision Records (ADRs)
### Architecture Document · v1.0 · 2026-05-27

---

## ADR-001: PostgreSQL over SQL Server

**Date:** 2026-01-15  
**Status:** Accepted

### Context
Need a relational database that is Azure-hosted, cost-effective, and supports all required compliance data types (TIMESTAMPTZ, JSONB, BYTEA for PDF blobs).

### Decision
Use **Azure Database for PostgreSQL (Flexible Server)**.

### Consequences
- ✅ Open source — no per-core licensing cost
- ✅ Native `TIMESTAMPTZ` (vs SQL Server's `DATETIMEOFFSET`) — cleaner UTC handling
- ✅ `JSONB` for `old_values`/`new_values` audit columns
- ✅ EF Core 8 Npgsql provider — full code-first support
- ⚠ Table names default to PascalCase in EF; must use `builder.ToTable("snake_case")` for compliance with LIMS naming convention

---

## ADR-002: Clean Architecture + CQRS with MediatR

**Date:** 2026-01-20  
**Status:** Accepted

### Context
Need an architecture that supports testability, clear separation of concerns, and the ability to add new modules without touching existing code.

### Decision
Use **Clean Architecture** (Domain → Application → Infrastructure → API) with **CQRS** pattern via **MediatR**.

### Consequences
- ✅ Commands (mutate) and Queries (read) are separate — easier to audit and test
- ✅ Business rules live in Application layer — controllers are thin
- ✅ Infrastructure (EF, external services) can be swapped without touching business logic
- ⚠ More files per feature (Command + Handler + DTO) — accepted trade-off for compliance traceability

---

## ADR-003: INSERT-Only Audit Tables at the Database Level

**Date:** 2026-01-25  
**Status:** Accepted (non-negotiable regulatory requirement)

### Context
21 CFR §11.10(e) requires that audit records cannot be modified or deleted by any role. Application-level enforcement is insufficient — a misconfigured permission or future code change could bypass it.

### Decision
All audit/compliance tables (`electronic_signatures`, `login_audit_logs`, `master_data_audit_log`, etc.) enforce immutability at the **database level**: no UPDATE or DELETE paths in any application code; DB triggers reject any such attempt.

### Consequences
- ✅ Tamper-evident at the storage layer — even DB Admin cannot silently edit
- ✅ Satisfies §11.10(e) evidence requirement for FDA PAI
- ⚠ Correction of erroneous audit entries is impossible — accepted (this is the regulatory requirement)

---

## ADR-004: No SignalR in v1 (Polling Acceptable for MVP)

**Date:** 2026-02-01  
**Status:** Accepted (revisit in v2)

### Context
Design documents specify SignalR push for real-time Work Queue and TAT alerts. SignalR requires sticky sessions and additional infrastructure configuration.

### Decision
Skip SignalR in v1. Use standard HTTP polling (page load / manual refresh) for Work Queue and alerts.

### Consequences
- ✅ Simplified deployment — no WebSocket infrastructure
- ✅ Faster time to production
- ⚠ Alerts not real-time — analyst must reload page
- ⚠ Background jobs still run and update DB — data is correct, just not pushed
- 📋 Revisit for v2 with Azure SignalR Service

---

## ADR-005: Groq (Not Azure OpenAI) for AI Chatbot

**Date:** 2026-02-10  
**Status:** Accepted

### Context
LIMS includes a chatbot assistant. Azure OpenAI is expensive and has complex provisioning. Groq provides extremely fast inference at low cost.

### Decision
Use **Groq** with `llama-3.1-8b-instant` model via HTTP client.

### Consequences
- ✅ ~10x faster inference vs Azure OpenAI for this model size
- ✅ Simple REST API — no SDK dependency
- ✅ Cost-effective for lab assistant use case
- ⚠ No PII data must be sent to Groq (chatbot prompt engineering must enforce)
- ⚠ External dependency — Groq outage = chatbot unavailable (not a core workflow)

---

## ADR-006: Inline Styles in React (No CSS Framework)

**Date:** 2026-01-15  
**Status:** Accepted

### Context
Frontend needs a consistent, maintainable visual design without the overhead of configuring a CSS framework like Tailwind or MUI in a regulated-environment codebase.

### Decision
Use **React inline styles** throughout. Shared primitives (`Modal`, `Field`, `ModalFooter`, `inp`, `PageHeader`, `StatusBadge`) exported from `LaboratoriesPage.tsx`.

### Consequences
- ✅ Zero build-time CSS configuration
- ✅ All styles co-located with components — easy to review during validation
- ⚠ No responsive design (lab LIMS is desktop-only — accepted)
- ⚠ Verbose component code — mitigated by shared primitives

---

## ADR-007: Manual SQL for Emergency Migrations

**Date:** 2026-05-27  
**Status:** Accepted

### Context
When the backend process is running, it holds a lock on the compiled DLL files. `dotnet ef migrations add` cannot compile when locked. Azure DB is remote — `psql` can reach it directly.

### Decision
For emergency column additions (e.g., `IntendedShelfLifeMonths` on `stability_protocols`):
1. Write manual migration `.cs` file following EF naming conventions
2. Apply via direct `psql` connection: `ALTER TABLE stability_protocols ADD COLUMN IF NOT EXISTS ...`
3. Record in `__EFMigrationsHistory` manually

### Consequences
- ✅ Unblocks deployment without restarting backend
- ⚠ Manual SQL must use exact DB table name (snake_case from `builder.ToTable(...)`) — not the EF entity class name
- ⚠ Must add Designer.cs snapshot or run `dotnet ef migrations add` later to keep model snapshot current

---

## ADR-008: Per-Execution Re-assign (AssignTestMethodCommand)

**Date:** 2026-05-27  
**Status:** Accepted (LabVantage parity requirement)

### Context
Initial WAP design assigns at the sample level (`AssignWorkQueueItemCommand`). LabVantage parity requires the ability to override the analyst and instrument on a specific test execution independently, without re-assigning the whole sample.

### Decision
Add `AssignTestMethodCommand` as a **separate command** (not modifying the existing `AssignWorkQueueItemCommand`). Endpoint: `POST /test-executions/{id}/assign`. Same training + calibration gates enforced.

### Consequences
- ✅ Both assignment modes coexist independently
- ✅ Lab Manager can fix a wrong assignment without affecting other executions on the same sample
- ✅ Full compliance enforcement on re-assign (not a backdoor)
- ⚠ Two code paths for assignment — mitigated by shared validation logic

---

## ADR-009: Post-Sign Amendment (AmendLogbookEntryCommand)

**Date:** 2026-05-27  
**Status:** Accepted (21 CFR §11.10(e) requirement)

### Context
After an analyst signs a digital logbook entry, errors may be discovered. The entry must be correctable without violating ALCOA+ Enduring (original must be preserved).

### Decision
Amendment creates a **new Pending entry** with the corrected value. The original entry's `status` → `Superseded`, and `amendment_reason` + `amendment_signature_id` are recorded on it. Both rows remain permanently in the DB.

### Consequences
- ✅ Original entry preserved — ALCOA+ Enduring satisfied
- ✅ Amendment reason + e-sig recorded — §11.10(e) satisfied
- ✅ Complete audit chain: Signed → Superseded → (new) Pending → Signed
- ⚠ Queries must filter `status != 'Superseded'` to show only active results
