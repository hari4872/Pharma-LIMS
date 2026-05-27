# PHARMA LIMS — Digital Logbook (Phase 3a)
### Technical Design Document · v1.2 · CONFIDENTIAL
> **v1.2 Changes:** Post-sign Amendment (§11.10(e)) — original row preserved as Superseded, new Pending entry requires e-sig re-auth; CSV export on demand (§11.10(b))
> **v1.1 Changes:** `trigger_source` field on every row · `evidence_file_ref` per row · Process Log rows via same service · `is_oot` flag

---

## Document Metadata

| Field | Value |
|---|---|
| Module | Digital Logbook (Phase 3a) |
| Depends On | Testing Execution v1.2, Parameters v1.1 |
| Version | v1.2 |
| Status | Implemented · Live · May 2026 |
| Compliance | 21 CFR Part 11 · EU GMP Annex 11 · GMP · ALCOA+ · GAMP 5 |
| Governance | Contracts 1, 2, 4 — all clauses enforced |

---

## Governance Contracts

### Contract 1 — General Architecture
- **No code duplication.** Every business rule owned by exactly one named service class. FK-only references throughout.
- **Single source of truth.** `digital_logbook_entries` drives Results Management, QA Review, CoA, and Traceability.
- **DB-portable.** Clean BE/FE/DB separation. No business logic in React or stored procedures.
- **No dead code.** Soft-delete (`is_active = FALSE`). Never physically deleted.

### Contract 2 — Backend Services
- **All compute on server** (.NET Core 8). React renders — never computes.
- **All push via SignalR** from server. No polling.
- **No hardcoded values.** Every threshold, timing, format from PostgreSQL.
- **Normalizer views** (`vw_*` prefix). Same view drives every UI panel.
- **UTC timestamps server-side** on all compliance records.

### Contract 4 — Authentication & Access Control
- **Login page:** username · password · forgot-password · remember-me — **all four mandatory.**
- **First run:** Tenant Admin creation before any other user or module access.
- **Segregation of duties** enforced by system. CRUD role model.

## 1. Purpose & Scope

The Digital Logbook is the **real-time, permanent scientific record** of every parameter result — the electronic replacement for the paper lab notebook. `digital_logbook_entries` is the **single source of truth** consumed by Results Management, QA Review, CoA, and Traceability (Contract 1 — no separate results store). v1.1 adds: **`trigger_source`** on every row (all 4 trigger modes recorded); **`evidence_file_ref`** mandatory for critical parameters; **Process Log rows** written via the same `DigitalLogbookService` (Contract 1 — no separate writer); and **`is_oot`** flag.

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR §11.50 | Analyst e-sig on every row: `full_name + signed_at UTC + meaning + reason`. Row immutable after e-sig. |
| 21 CFR §11.10(b) | Logbook exportable as human-readable PDF/CSV on demand. All §11.50 fields visible. |
| 21 CFR §11.10(e) | New rows pushed to audit trail; no existing row ever modified. |
| ALCOA+ Original | `calculated_result` server-computed (Contract 2). Analyst cannot override. |
| ALCOA+ Attributable | `analyst_id` FK + §11.50 `full_name` on every row. |
| ALCOA+ Contemporaneous | `created_at` UTC server-side (Contract 2). Never editable by any role. |
| ALCOA+ Enduring | Row immutable after e-sig. Correction creates new `Superseded` row — original preserved. |

---

## 3. Logbook vs Audit Trail

| Aspect | Digital Logbook | Audit Trail |
|---|---|---|
| Records | Scientific data: what tested, result, spec, pass/fail | Every data change: who/what/old/new/when |
| Created by | System auto on parameter result capture + analyst e-sig | System auto on every DB create/update/delete |
| Purpose | Replace paper lab notebook (GMP) | Detect unauthorised changes (21 CFR §11.10(e)) |
| Immutable after | Analyst §11.50 e-sig on each row | Always — INSERT-only; no role can edit or delete |

---

## 4. Logbook Row — Complete Field Specification

| Field | Source | Notes |
|---|---|---|
| `entry_id` | SERIAL PRIMARY KEY | System-generated. |
| `sample_id` | FK from `samples` | Links upstream to registration, lot, material. |
| `execution_id` | FK from `test_executions` | Links to the test that produced this result. |
| `parameter_id` | FK from `test_method_parameters` | **Contract 1 — no parameter name copied.** |
| **`trigger_source`** | Server-set (Contract 2) | **`TimeBased` / `OperatorScan` / `ProcessLog` / `DispatchEvent` — NEW v1.1** |
| `raw_value` | Analyst entry / file import | As-entered. Immutable after e-sig. |
| `calculated_result` | `ResultCalculationService` (Contract 2) | Formula applied server-side. Read-only in UI. |
| `auto_correction_applied` | Boolean, server-set | `TRUE` if `AutoCorrectionService` adjusted raw value. |
| `correction_detail` | Server-set | Type and delta of correction (e.g. SG temp normalisation). |
| `spec_min_snapshot` / `spec_max_snapshot` | Captured at test time | Immutable snapshot — **ALCOA+ Enduring.** |
| `regulatory_tier_snapshot` | Captured at test time | Regulatory spec at time of test — shown on CoA. |
| `pass_fail` | `OOSDetectionService` (Contract 1) | `PASS` / `FAIL` vs in-house spec. |
| `is_oos` | Boolean, server-set | OOS flag. Analyst cannot suppress. |
| **`is_oot`** | **Boolean, server-set** | **OOT flag from `OOSDetectionService` OOT mode — NEW v1.1** |
| `instrument_id` | FK from `instruments` | Cal cert ID captured at measurement time. |
| `analyst_id` | FK from `users` | **ALCOA+ Attributable.** |
| `signature_id` | FK from `electronic_signatures` | §11.50: `full_name + signed_at + meaning + reason`. |
| **`evidence_file_ref`** | Analyst upload | **Mandatory for `is_critical = TRUE` parameters — NEW v1.1** |
| `created_at` | Server UTC (Contract 2) | **ALCOA+ Contemporaneous — not editable by any role.** |
| `status` | State machine | `Pending` → `Signed` → `Superseded` |
| `superseded_by` | FK from `digital_logbook_entries` | Points to new official row. Original never deleted. |

---

## 5. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | One row per parameter per execution; auto-created atomically in `CompleteStepHandler` transaction (Contract 1) | System | Must Have | GMP / ALCOA+ |
| FR-02 | Row values computed server-side and written atomically (Contract 2) | System | Must Have | ALCOA+ Original |
| **FR-03** | **`trigger_source` field set server-side: all 4 trigger modes recorded on every row (Contract 2)** | System | Must Have | ALCOA+ Contemporaneous |
| **FR-04** | **`evidence_file_ref` mandatory for `is_critical` parameters. Sign-off blocked if absent.** | Analyst | Must Have | GMP / GAMP 5 |
| **FR-05** | **Process Log row completions written via same `DigitalLogbookService` — no separate writer (Contract 1).** | System | Must Have | Contract 1 |
| **FR-06** | **`is_oot` flag set server-side by `OOSDetectionService` when outside OOT threshold.** | System | Must Have | GMP trending |
| FR-07 | Analyst §11.50 e-sig: password re-entry + full name + date/time + meaning | Analyst | Must Have | 21 CFR §11.50 |
| FR-08 | Row immutable after e-sig. Correction creates new `Superseded` row — original preserved. | System | Must Have | ALCOA+ Enduring |
| FR-09 | PDF/CSV export with all §11.50 manifestations on demand (§11.10(b)) | QA, Admin | Must Have | 21 CFR §11.10(b) |
| FR-10 | New rows pushed via SignalR (Contract 2 — no polling) | System | Must Have | Contract 2 |
| FR-11 | Spec snapshot captured at test time — immutable regardless of subsequent spec changes | System | Must Have | ALCOA+ Enduring |
| FR-12 | All actions audit-logged INSERT-only | System | Must Have | 21 CFR §11.10(e) |
| **FR-13** | **Post-sign Amendment: `POST /digital-logbook/{id}/amend`. Original row status → Superseded (immutable). New Pending row created with amended `raw_value` and mandatory `amendment_reason`. Requires password re-auth (§11.300).** | Analyst/QA | Must Have | 21 CFR §11.10(e) / ALCOA+ Enduring |
| **FR-14** | **Amendment blocked if original row is not in `Signed` status — prevents amending already-amended or pending rows.** | System | Must Have | 21 CFR §11.10(e) |
| **FR-15** | **Amendment e-sig: same `IElectronicSignatureService` (Contract 1). `amendment_reason` + `amendment_signature_id` stored on the superseded row.** | System | Must Have | 21 CFR §11.50 / Contract 1 |
| **FR-16** | **CSV export: `GET /digital-logbook/export?sampleId=&status=&from=&to=`. All §11.50 fields included. On demand (§11.10(b)).** | QA/Admin | Must Have | 21 CFR §11.10(b) |

---

## 6. Data Model (PostgreSQL 16)

```sql
-- Single source of truth for all results (Contract 1)
CREATE TABLE digital_logbook_entries (
  entry_id                 SERIAL PRIMARY KEY,
  sample_id                INT NOT NULL REFERENCES samples(sample_id),
  execution_id             INT NOT NULL REFERENCES test_executions(execution_id),
  parameter_id             INT NOT NULL REFERENCES test_method_parameters(parameter_id),
  trigger_source           VARCHAR(20) NOT NULL,
  -- TimeBased | OperatorScan | ProcessLog | DispatchEvent
  raw_value                TEXT NOT NULL,
  calculated_result        DECIMAL(18,6),
  auto_correction_applied  BOOLEAN NOT NULL DEFAULT FALSE,
  correction_detail        TEXT,
  spec_min_snapshot        DECIMAL(18,6),
  spec_max_snapshot        DECIMAL(18,6),
  regulatory_tier_snapshot TEXT,
  pass_fail                VARCHAR(10) NOT NULL,  -- PASS | FAIL
  is_oos                   BOOLEAN NOT NULL DEFAULT FALSE,
  is_oot                   BOOLEAN NOT NULL DEFAULT FALSE,
  instrument_id            INT REFERENCES instruments(instrument_id),
  analyst_id               INT NOT NULL REFERENCES users(user_id),
  signature_id             INT REFERENCES electronic_signatures(signature_id),
  evidence_file_ref        VARCHAR(500),  -- mandatory for is_critical parameters
  status                   VARCHAR(20) NOT NULL DEFAULT 'Pending',
  -- Pending | Signed | Superseded
  superseded_by_id         INT REFERENCES digital_logbook_entries(entry_id),
  amendment_reason         TEXT,         -- mandatory when row is being superseded by amendment
  amendment_signature_id   INT REFERENCES electronic_signatures(signature_id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- UTC server-side
);
```

---

## 7. State Transitions

| Entity | From | To | Trigger | Compliance |
|---|---|---|---|---|
| Logbook Row | Pending | Signed | Analyst §11.50 e-sig | 21 CFR §11.50 |
| Logbook Row | Signed | Superseded | New official retest signed — original preserved | ALCOA+ Enduring |
| Logbook Row | Signed | Superseded | Post-sign Amendment: password re-auth + reason captured; new Pending row created | 21 CFR §11.10(e) / ALCOA+ Enduring |
| Logbook Row | (new Pending) | Signed | Analyst signs amended row with §11.50 e-sig | 21 CFR §11.50 |
| OOS Flag | FALSE | TRUE | `OOSDetectionService`: result outside in-house spec | FDA OOS Guidance |
| OOT Flag | FALSE | TRUE | `OOSDetectionService` OOT mode: outside `oot_min/max` | GMP trending |

---

## Audit & Compliance Summary

| Standard | Control |
|---|---|
| **21 CFR §11.50** | Every e-sig: `full_name + signed_at UTC + meaning + reason`. All four fields immutable after capture. |
| **21 CFR §11.300** | Password verified independently of session token before any signature. |
| **21 CFR §11.10(e)** | All audit logs INSERT-only at DB level. Old/new values captured on every change. |
| **EU GMP Annex 11 §10** | Audit trail immutable, computer-generated, date/time-stamped. |
| **EU GMP Annex 11 §7.1** | Daily encrypted backup. RPO <= 24 h, RTO <= 4 h. |
| **ALCOA+ Enduring** | Soft-delete only. INSERT-only audit logs. No hard delete at any level. |
| **Contract 1** | Single-service ownership. FK-only references. No duplication. |
| **Contract 2** | All compute server-side. All push via SignalR. No hardcoded values. |

