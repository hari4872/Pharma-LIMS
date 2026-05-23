# PHARMA LIMS — Testing Execution (Phase 3)
### Technical Design Document · v1.2 · CONFIDENTIAL
> **v1.2 Changes:** WAP (Lab Manager assigns via `WAPAssignmentService`) · Barcode scan to start · File import (`FileImportService`) · Auto-correction (`AutoCorrectionService`) · OOT detection · Process Log screen

---

## Document Metadata

| Field | Value |
|---|---|
| Module | Testing Execution (Phase 3) |
| Depends On | Sample Registration v1.2, Parameters v1.1, Digital Logbook v1.1 |
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
- **UTC timestamps server-side** on all compliance records (ALCOA+ Contemporaneous).

### Contract 4 — Authentication & Access Control
- **Login page:** username · password · forgot-password · remember-me — **all four mandatory.**
- **First run:** Tenant Admin creation before any other user or module access.
- **Two user types only:** Admin and Regular User. Roles are Regular User variants with explicit write grants.
- **Segregation of duties** enforced by system.

## 1. Purpose & Scope

Testing Execution covers the full analyst workflow from Work Queue to signed result. v1.2 adds:
- **WAP (Work & Resource Planning):** Lab Manager assigns tasks via `WAPAssignmentService` (Contract 1) before analysts open queue. Smart rules: trained analyst + instrument availability + urgency + capacity — all from DB config (Contract 2).
- **Barcode scan at Step 2:** Container label scan opens task — zero typing, zero transcription.
- **File import:** `FileImportService` parses instrument data file server-side (Contract 1).
- **Auto-correction:** `AutoCorrectionService` applies corrections server-side before formula (e.g. SG→25°C). Correction table from DB (Contract 2 — not hardcoded).
- **OOT detection:** `OOSDetectionService` OOT mode alongside OOS (Contract 1 — same service).
- **Process Log screen:** Separate from Work Queue for continuous monitoring (Mode 3).

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR §11.50 | Step sign-off e-sig: `full_name + signed_at UTC + meaning + reason`. Result immutable after e-sig. |
| 21 CFR §11.10(e) | All execution actions audit-logged INSERT-only. |
| 21 CFR 211.68 | Instrument OOC hard-blocks test start — enforced by `CalibrationDueDateJob` (Contract 2). |
| FDA OOS Guidance 2006 | OOS auto-raised server-side by `OOSDetectionService` (Contract 1). Phase 1 investigation mandatory. |
| ALCOA+ Original | `calculated_result` server-computed. Analyst cannot override. |
| ALCOA+ Contemporaneous | `started_at` UTC logged server-side on task open (Contract 2). |
| ALCOA+ Accurate | Auto-correction via `AutoCorrectionService` — correction table from DB, auditable. |

---

## 3. Work & Resource Planning (WAP)

| Feature | Lab Manager Action | Analyst Impact |
|---|---|---|
| Calendar view | See all pending tests by due date and priority | Work Queue shows only pre-assigned tasks — no searching required |
| Analyst capacity | Check availability and workload across team | Never over-assigned; capacity limits from DB config |
| Training validation | System confirms analyst trained on required method | Training match validated on task start — hard block if not current |
| Instrument certification | Check instrument availability and cal status | Only calibrated, available instruments assigned |
| Urgency sort | Prioritise TAT-critical and overdue tasks | Urgent tasks appear at top of analyst's queue |

---

## 4. Testing Execution Steps

| Step | Name | Key Rule | Actor |
|---|---|---|---|
| 1 | Open Work Queue | WAP pre-assigned — no searching needed | Analyst |
| **2** | **Scan or Select** | **Container label scan opens task instantly — zero typing. `ScanToTaskService` (Contract 1).** | Analyst |
| 3 | Verify Instrument | Cal check server-side. Hard block if OOC or Maintenance. | System |
| 4 | Enter Results | Manual entry OR file import (`FileImportService` — Contract 1). `AutoCorrectionService` applies correction server-side before formula (Contract 1+2). `ParameterCalculationService` computes result. | Analyst |
| 5 | OOS/OOT Check | `OOSDetectionService` server-side. OOS = outside in-house spec (FAIL). OOT = outside trend limit (flag). Both auto-raised. | System |
| 6 | Attach Evidence | Mandatory for `is_critical = TRUE` parameters. Blocks sign-off if absent. | Analyst |
| 7 | Analyst Signs Off | §11.50 e-sig: password re-entry + full name + date/time + meaning. `digital_logbook_entries` row created atomically. | Analyst |

---

## 5. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | Work Queue: WAP pre-assigned tasks only; no searching by analyst | Analyst | Must Have | GMP |
| FR-02 | Instrument OOC check server-side; hard block (Contract 2) | System | Must Have | 21 CFR 211.68 |
| FR-03 | Formula applied server-side; result read-only in UI (Contract 2) | System | Must Have | ALCOA+ Original |
| FR-04 | OOS auto-raised: `OOSDetectionService` vs in-house spec (Contract 1) | System | Must Have | FDA OOS Guidance |
| FR-05 | Logbook row created atomically on step sign-off (Contract 1 — `CompleteStepHandler`) | System | Must Have | GMP / ALCOA+ |
| FR-06 | Analyst §11.50 e-sig: password re-entry + full name + date/time + meaning | Analyst | Must Have | 21 CFR §11.50 |
| FR-07 | All execution actions audit-logged INSERT-only | System | Must Have | 21 CFR §11.10(e) |
| FR-08 | SignalR push on task status changes (Contract 2 — no polling) | System | Must Have | Contract 2 |
| FR-09 | Login: forgot-password + remember-me; Tenant Admin first run (Contract 4) | System | Must Have | Contract 4 |
| **FR-13** | **WAP: `WAPAssignmentService` (Contract 1). Lab Manager assigns tasks before analyst opens queue. Smart rules from DB config.** | Lab Manager | Must Have | GMP / Contract 1 |
| **FR-14** | **WAP: trained analyst + instrument availability + urgency + capacity — all from DB config (Contract 2).** | System | Must Have | Contract 2 |
| **FR-15** | **Barcode scan at Step 2: `ScanToTaskService` (Contract 1) opens task instantly — zero manual ID lookup.** | Analyst | Must Have | GMP Chain of Custody |
| **FR-16** | **File import: `FileImportService` parses instrument data file server-side (Contract 1). Values pre-populate entry fields.** | Analyst | Must Have | ALCOA+ / Contract 2 |
| **FR-17** | **Auto-correction: `AutoCorrectionService` server-side before formula (Contract 1). Correction table from DB (Contract 2 — not hardcoded). Logged on logbook row.** | System | Must Have | ALCOA+ Accurate |
| **FR-18** | **OOT detection: `OOSDetectionService` OOT mode vs `oot_min_value`/`oot_max_value`. Separate `is_oot` flag.** | System | Must Have | GMP trending |
| **FR-19** | **Evidence mandatory for `is_critical = TRUE`. System blocks sign-off if `evidence_file_ref` is NULL.** | Analyst | Must Have | GMP / GAMP 5 |
| **FR-20** | **Process Log screen (Mode 3): separate from Work Queue. Time-slot grid. Row e-signed §11.50 and locked.** | Analyst | Must Have | GMP / Contract 2 |
| **FR-21** | **Process Log OOS: same `OOSDetectionService` (Contract 1 — no duplicate logic).** | System | Must Have | FDA OOS Guidance |
| **FR-22** | **Work Queue start time: server-side UTC on task open click (ALCOA+ Contemporaneous — Contract 2).** | System | Must Have | ALCOA+ |

---

## 6. Data Model (PostgreSQL 16)

```sql
CREATE TABLE test_executions (
  execution_id    SERIAL PRIMARY KEY,
  sample_id       INT NOT NULL REFERENCES samples(sample_id),
  instrument_id   INT NOT NULL REFERENCES instruments(instrument_id),
  analyst_id      INT NOT NULL REFERENCES users(user_id),
  assigned_by     INT REFERENCES users(user_id),  -- Lab Manager (WAP)
  form_template_id INT REFERENCES form_templates(form_template_id),
  status          VARCHAR(20) NOT NULL DEFAULT 'InProgress',
  entry_method    VARCHAR(20) NOT NULL DEFAULT 'Manual', -- Manual | FileImport
  auto_corrected  BOOLEAN NOT NULL DEFAULT FALSE,
  correction_type VARCHAR(100),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- UTC server-side
);

CREATE TABLE wap_assignments (
  assignment_id  SERIAL PRIMARY KEY,
  execution_id   INT NOT NULL REFERENCES test_executions(execution_id),
  assigned_to    INT NOT NULL REFERENCES users(user_id),
  assigned_by    INT NOT NULL REFERENCES users(user_id),
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  priority_score INT
);

CREATE TABLE oos_investigations (
  oos_id        SERIAL PRIMARY KEY,
  execution_id  INT NOT NULL REFERENCES test_executions(execution_id),
  parameter_id  INT NOT NULL REFERENCES test_method_parameters(parameter_id),
  flag_type     VARCHAR(10) NOT NULL DEFAULT 'OOS',  -- OOS | OOT
  phase         VARCHAR(10) NOT NULL DEFAULT 'Phase1',
  status        VARCHAR(20) NOT NULL DEFAULT 'Open',
  root_cause    TEXT,
  capa_ref      VARCHAR(100),
  signature_id  INT REFERENCES electronic_signatures(signature_id),
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at     TIMESTAMPTZ
);
```

---

## 7. State Transitions

| Entity | From | To | Trigger | Compliance |
|---|---|---|---|---|
| Sample | Pending Testing | Assigned (WAP) | Lab Manager assigns via `WAPAssignmentService` | GMP / Contract 4 |
| Test Task | Assigned | In Progress | Analyst scans barcode; `started_at` UTC logged server-side | ALCOA+ Contemporaneous |
| Test Task | In Progress | Completed | §11.50 e-sig + logbook row created in same transaction | 21 CFR §11.50 |
| Test Task | In Progress | OOS Open | `OOSDetectionService` detects result outside in-house spec | FDA OOS Guidance |
| Test Task | In Progress | OOT Flagged | `OOSDetectionService` OOT mode detects result outside trend | GMP trending |
| Result | Completed | Superseded | New official retest signed | ALCOA+ Enduring |

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
| **ALCOA+ Contemporaneous** | All timestamps server-side UTC (Contract 2). Analyst cannot backdate. |
| **Contract 1** | Single-service ownership. FK-only references. No duplication. |
| **Contract 2** | All compute server-side. All push via SignalR. No hardcoded values. |
| **Contract 4** | Login: 4 elements mandatory. Tenant Admin first-run. Segregation of duties enforced. |

