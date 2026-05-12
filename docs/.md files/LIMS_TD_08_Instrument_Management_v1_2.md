# PHARMA LIMS — Instrument Management (Phase 8)
### Technical Design Document · v1.2 · CONFIDENTIAL
> **v1.2 Changes:** Breakdown/Repair workflow · In-Use status (server-side) · Maintenance status · Utilisation tracking (`UtilisationSummaryJob`)

---

## Document Metadata

| Field | Value |
|---|---|
| Module | Instrument Management (Phase 8) |
| Depends On | Master Data v1.2 |
| Version | v1.2 |
| Status | Draft · May 2026 |
| Compliance | 21 CFR Part 11 · EU GMP Annex 11 · GMP · ISO 17025 · ALCOA+ · GAMP 5 |
| Governance | Contracts 1, 2, 4 — all clauses enforced |

---

## Governance Contracts (all clauses — applies to every section)

**Contract 1:** No code duplication. FK-only references. Single service per concern. `InstrumentStatusService` owns all status transitions. `OOCImpactService` owns all OOC flagging — single service for cal-OOC and breakdown-OOC. `BreakdownRepairService` owns breakdown/repair lifecycle. DB-portable. Soft-delete only.

**Contract 2:** All compute server-side. React renders only. All push via SignalR — no polling. No hardcoded values. Normalizer views (`vw_instrument_status`). UTC timestamps server-side. All background jobs (`CalibrationDueDateJob`, `PMReminderJob`, `UtilisationSummaryJob`) run as `IHostedService`. Intervals from DB config.

**Contract 4:** Login page: username · password · forgot-password · remember-me — all four mandatory. First run: Tenant Admin first. Admin or maintenance tech (with explicit write grant): records cal, PM, breakdown/repair. QA: approves calibration + return-to-service (§11.50 e-sig). Analyst: views status and usage log. No role can suppress OOC.

## 1. Purpose & Scope

Instrument Management covers full lifecycle: IQ/OQ/PQ, calibration scheduling, usage logging per Digital Logbook row, preventive maintenance, OOC impact. v1.2 adds all **four instrument statuses** from the PPT workflow: **Available**, **In-Use** (set server-side from active test executions — Contract 2), **Maintenance** (set on PM or Breakdown open — Contract 1 via `BreakdownRepairService`), **OutOfCalibration** (set by `CalibrationDueDateJob` — Contract 2). Also new: **Breakdown/Repair workflow** with QA return-to-service e-sig §11.50, and **utilisation tracking** (`UtilisationSummaryJob` — Contract 2).

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR §11.50 | Calibration approval + return-to-service approval: `full_name + signed_at UTC + meaning + reason`. |
| 21 CFR 211.68 | OOC instrument hard-blocks test start — system-enforced. No workaround. |
| EU GMP Ch 6 / ISO 17025 | All instruments qualified before first use. Cal traceable to national standards. OOC hard-blocks. |
| EU Annex 11 §12.4 | IQ/OQ/PQ in annual periodic re-validation. Evidence in `validation_review_logs`. |
| GMP — Maintenance | Breakdown logged with issue description. Repair recorded. Instrument blocked during repair. QA e-sig §11.50 for return-to-service. |

---

## 3. Instrument Status Model — All 4 States

| Status | Set When | Effect on Testing | Cleared When |
|---|---|---|---|
| **Available** | Initial registration; Cal approved; Repair complete + QA approved | Tests can be assigned and started | → In-Use on test start; → OOC on cal expiry; → Maintenance on PM/Breakdown |
| **In-Use** | `test_executions` row with this `instrument_id` has `status = InProgress` (server-side `InstrumentStatusService` — Contract 2) | Tests can continue. New assignment possible. Not blocked. | All in-progress executions for this instrument complete |
| **Maintenance** | PM record created OR Breakdown opened (`BreakdownRepairService` — Contract 1) | **Hard-blocks** new test start. WAP flags pending assignments for reallocation. | PM completed (Admin) OR Repair + QA return-to-service e-sig §11.50 |
| **OutOfCalibration** | `CalibrationDueDateJob` detects `cal_due < today` (daily IHostedService — Contract 2) | **Hard-blocks** test start. `OOCImpactService` flags all logbook rows in OOC window. | New calibration + QA e-sig approval |

---

## 4. Breakdown/Repair Workflow (New v1.2)

| Step | Name | What Happens | Actor | Compliance |
|---|---|---|---|---|
| 1 | Raise Breakdown | `BreakdownRepairService` (Contract 1) creates `instrument_breakdowns` row. Status → Maintenance instantly. WAP assignments to this instrument flagged for reallocation. | Analyst / Admin | GMP — block on issue |
| 2 | Record Repair | Repair details: `repair_date`, technician, description, parts used, repair method. Evidence attachment optional. | Admin / Maintenance Tech | GMP audit trail |
| 3 | QA Return-to-Service | QA reviews repair record. §11.50 e-sig required: full name + date/time + meaning + reason. Status → Available only on QA approval. | QA | 21 CFR §11.50 |
| 4 | Recalibration Check | If breakdown window spans calibration due date, `CalibrationDueDateJob` flags for immediate recalibration before first test use. | System (auto) | EU GMP Ch 6 / ISO 17025 |
| 5 | OOC Impact Check | If instrument used during breakdown window, `OOCImpactService` (Contract 1) flags affected logbook rows for QA review. | System (auto) | EU GMP Ch 6 / Contract 1 |

---

## 5. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | IQ/OQ/PQ with §11.50 e-sig on approval | Admin/QA | Must Have | GAMP 5 / EU GMP Ch 6 |
| FR-02 | Cal schedule: frequency from DB (Contract 2 — not hardcoded) | Admin | Must Have | EU GMP Ch 6 / ISO 17025 |
| FR-03 | Cal approval: QA §11.50 e-sig | QA | Must Have | 21 CFR §11.50 |
| FR-04 | OOC: `CalibrationDueDateJob` daily IHostedService (Contract 2) | System | Must Have | 21 CFR 211.68 |
| FR-05 | OOC impact: `OOCImpactService` flags logbook rows (Contract 1) | System | Must Have | EU GMP Ch 6 |
| FR-06 | Cal cert ID on every logbook row at measurement time (FK — Contract 1) | System | Must Have | ISO 17025 |
| FR-07 | IQ/OQ/PQ in annual periodic review (`IPeriodicReviewService`) | Admin/QA | Must Have | EU Annex 11 §12.4 |
| FR-08 | SignalR push on OOC detection (Contract 2 — no polling) | System | Must Have | Contract 2 |
| FR-09 | Login: forgot-password + remember-me; Tenant Admin first run (Contract 4) | System | Must Have | Contract 4 |
| **FR-10** | **Breakdown/Repair workflow: raise → record → QA return-to-service e-sig §11.50. `BreakdownRepairService` (Contract 1). NEW v1.2** | Admin/QA | Must Have | GMP / 21 CFR §11.50 |
| **FR-11** | **Maintenance hard-block: new test start blocked during Maintenance. WAP flags pending assignments for reallocation. NEW v1.2** | System | Must Have | GMP |
| **FR-12** | **In-Use status: set/cleared server-side by `InstrumentStatusService` (Contract 2). React never sets this flag. NEW v1.2** | System | Must Have | Contract 2 |
| **FR-13** | **Maintenance status: set on PM start OR Breakdown open. Cleared on PM completion or QA-approved repair. NEW v1.2** | System | Must Have | GMP |
| **FR-14** | **PM reminder: `PMReminderJob` (IHostedService — Contract 2) fires T-7 and T-1. PM interval from DB config. NEW v1.2** | System | Must Have | EU GMP Ch 6 |
| **FR-15** | **Utilisation tracking: `UtilisationSummaryJob` (IHostedService — Contract 2). Window (7/30/90 days) from DB config. NEW v1.2** | System | Must Have | Operational best practice |
| **FR-16** | **OOC impact after breakdown: `OOCImpactService` (Contract 1 — same service as cal-OOC). NEW v1.2** | System | Must Have | EU GMP Ch 6 |

---

## 6. User Roles & Permissions

| Action | Admin | QA | Lab Manager | Analyst |
|---|---|---|---|---|
| Register instrument / IQ/OQ/PQ | ✅ | ❌ | ❌ | ❌ |
| Record calibration | ✅ | ❌ | ❌ | ❌ |
| Approve calibration + return-to-service (§11.50) | ❌ | ✅ | ❌ | ❌ |
| Raise breakdown | ✅ | ❌ | ❌ | ✅ |
| Record repair details | ✅ | ❌ | ❌ | ❌ |
| View instrument status + usage log | ✅ | ✅ | ✅ | ✅ |
| View utilisation summary | ✅ | ✅ | ✅ | ❌ |
| Suppress OOC | ❌ | ❌ | ❌ | ❌ |

---

## 7. Data Model (PostgreSQL 16)

```sql
-- Breakdown records
CREATE TABLE instrument_breakdowns (
  breakdown_id  SERIAL PRIMARY KEY,
  instrument_id INT NOT NULL REFERENCES instruments(instrument_id),
  raised_by     INT NOT NULL REFERENCES users(user_id),
  raised_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  issue_desc    TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'Open', -- Open|InRepair|Resolved
  return_sig_id INT REFERENCES electronic_signatures(signature_id)
);

-- Repair records
CREATE TABLE instrument_repairs (
  repair_id     SERIAL PRIMARY KEY,
  breakdown_id  INT NOT NULL REFERENCES instrument_breakdowns(breakdown_id),
  technician    VARCHAR(200) NOT NULL,
  repair_date   DATE NOT NULL,
  repair_desc   TEXT NOT NULL,
  parts_used    TEXT,
  recorded_by   VARCHAR(100) NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Utilisation summary
CREATE TABLE instrument_utilisation_summary (
  summary_id       SERIAL PRIMARY KEY,
  instrument_id    INT NOT NULL REFERENCES instruments(instrument_id),
  window_days      INT NOT NULL,           -- 7 | 30 | 90 -- from DB config
  window_start     TIMESTAMPTZ NOT NULL,
  window_end       TIMESTAMPTZ NOT NULL,
  total_tests      INT NOT NULL DEFAULT 0,
  total_hours      DECIMAL(10,2) NOT NULL DEFAULT 0,
  utilisation_pct  DECIMAL(5,2),
  calculated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Normalizer view -- same in all UI panels (Contract 2)
-- CREATE VIEW vw_instrument_status AS
-- SELECT i.*, current status derived from test_executions + breakdowns + cal records
```

---

## 8. State Transitions

| Entity | From | To | Trigger | Compliance |
|---|---|---|---|---|
| Instrument | Available | In-Use | `test_executions` row starts for this instrument (server-side) | Contract 2 |
| Instrument | In-Use | Available | All in-progress executions for this instrument complete | Contract 2 |
| Instrument | Available | Maintenance | PM record created OR Breakdown opened | GMP |
| Instrument | Maintenance | Available | PM complete (Admin) OR Repair + QA e-sig §11.50 | 21 CFR §11.50 |
| Instrument | Available | OutOfCalibration | `CalibrationDueDateJob` daily: `cal_due < today` | 21 CFR 211.68 |
| Instrument | OOC | Available | New calibration + QA e-sig approved | ISO 17025 |

---

## Audit & Compliance Summary

| Standard | Control |
|---|---|
| **21 CFR §11.50** | Every e-sig: `full_name + signed_at UTC + meaning + reason`. Immutable after capture. |
| **21 CFR §11.300** | Password verified independently of session token. |
| **21 CFR §11.10(e)** | All audit logs INSERT-only. Old/new values captured. |
| **EU GMP Annex 11 §10** | Audit trail immutable, computer-generated, date/time-stamped. |
| **EU GMP Annex 11 §7.1** | Daily encrypted backup. RPO <= 24 h, RTO <= 4 h. |
| **ALCOA+ Enduring** | Soft-delete only. INSERT-only audit logs. No hard delete at any level. |
| **Contract 1** | Single-service ownership. FK-only references. No duplication. |
| **Contract 2** | All compute server-side. All push via SignalR. No hardcoded values. |

