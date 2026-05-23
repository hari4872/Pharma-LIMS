# PHARMA LIMS — Checkpoints (Phase 1b)
### Technical Design Document · v1.1 · CONFIDENTIAL
> **v1.1 Changes:** All 4 trigger modes · Grouped checkpoints · Process Log · Dispatch Event trigger · Critical flag enforcement

---

## Document Metadata

| Field | Value |
|---|---|
| Module | Checkpoints (Phase 1b) |
| Depends On | Master Data v1.2, Parameters v1.1 |
| Version | v1.1 |
| Status | Implemented · Live · May 2026 |
| Compliance | 21 CFR Part 11 · EU GMP Annex 11 · GMP · ALCOA+ · GAMP 5 |
| Governance | Contracts 1, 2, 4 — all clauses enforced |

---

## Governance Contracts

### Contract 1 — General Architecture
- **No code duplication.** Every business rule owned by exactly one named service class. FK-only references — no master data copied into consuming tables.
- **Single source of truth.** `digital_logbook_entries` drives Results Management, QA Review, CoA, and Traceability. No separate results store.
- **DB-portable.** Connection string swappable. Clean BE/FE/DB separation. No business logic in React or stored procedures.
- **No dead code.** Inactive records use soft-delete (`is_active = FALSE`). Never physically deleted.

### Contract 2 — Backend Services
- **All compute on server** (.NET Core 8). React renders — never computes.
- **All push via SignalR** from server. React does not poll — no `setInterval`, no repeated GET.
- **No hardcoded values.** Every threshold, timing, format from PostgreSQL.
- **Normalizer views** (`vw_*` prefix). Same view drives every UI panel.
- **All background jobs** run as `IHostedService` (server-side). Timing from DB config.
- **UTC timestamps server-side** on all compliance records (ALCOA+ Contemporaneous).

### Contract 4 — Authentication & Access Control
- **Login page:** username · password · forgot-password link · remember-me checkbox — **all four mandatory, no exceptions.**
- **First run:** Tenant Admin creation before any other user or module access.
- **Two user types only:** Admin and Regular User. Roles are Regular User variants with explicit write grants.
- **CRUD role model.** Role table drives access — no hardcoded role names in business logic.
- **Regular User default:** view-only. Write access must be explicitly granted per module.
- **Segregation of duties** enforced by system: analyst cannot approve own results; QA cannot be analyst on same sample.
- **No shared credentials.** Unique `user_id` constraint at DB level.

## 1. Purpose & Scope

A **Checkpoint** groups parameters tested at the same location and frequency. v1.1 covers all **four trigger modes**: Mode 1 (Time-Based), Mode 2 (Operator Scan), Mode 3 (Process Log — shift-based), Mode 4 (Dispatch Event — DO-triggered). All modes produce tasks via the single `CheckpointTriggerService` (Contract 1). **Grouped checkpoints** allow one trigger to cover multiple locations with independent per-column spec limits (FK only — Contract 1).

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR §11.50 | Row sign-off e-sig: `full_name + signed_at UTC + meaning + reason`. Row immutable after e-sig. |
| 21 CFR 211.68 | Mode 1 time-based triggers: server-side job (Contract 2) ensures consistent scheduled execution. |
| EU GMP Annex 11 §4.3 | Offline scan queued and synced atomically on reconnect. No result loss. |
| ALCOA+ Contemporaneous | `triggered_at UTC` set server-side on all 4 modes (Contract 2). |
| ALCOA+ Complete | Critical parameters enforced every slot — system blocks sign-off if blank. |

---

## 3. All 4 Trigger Modes

| Mode | Name | How It Triggers | Output |
|---|---|---|---|
| 1 | **Time-Based** | `CheckpointSchedulerJob` (`IHostedService` — Contract 2). Configured clock time from DB. | Work Queue task for all checkpoint parameters. |
| 2 | **Operator Scan** | Operator scans QR/barcode. `CheckpointTriggerService` (Contract 1) creates task. Offline-capable — queued and synced atomically on reconnect. | Work Queue task linked from sample registration barcode. |
| 3 | **Process Log (Shift-Based)** | `ProcessLogSchedulerJob` (`IHostedService` — Contract 2). Configurable shift intervals from DB. Pre-populated time-slot grid. Shaded cells = not due. | Process Log screen row (separate from Work Queue). Row e-signed and locked after entry §11.50. |
| 4 | **Dispatch Event (DO-Triggered)** | DO raised in ERP (auto-push) or manual entry. `DispatchEventJob` (Contract 2) creates outgoing QC task. Product, container, and lot auto-assigned. Test set configurable per product type in Master Data — not hardcoded (Contract 2). | Outgoing QC task. Pass → CLEARED. Fail → BLOCKED + OOS investigation. |

---

## 4. Grouped Checkpoint

One trigger covers multiple locations on one form. Each column has its own independent `spec_limit_id` FK — no spec values copied into the form (Contract 1). Per-column OOS check runs against column-specific spec limit independently. Number of locations, parameters, and specs are all configurable — no limit.

---

## 5. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | Create checkpoint: location, trigger mode, frequency/time slots from DB config | Admin/QA | Must Have | GMP / Contract 2 |
| FR-02 | Mode 1: `CheckpointSchedulerJob` (`IHostedService`) fires at configured clock time (Contract 2) | System | Must Have | 21 CFR 211.68 |
| FR-03 | Mode 2: scan trigger via `CheckpointTriggerService` (Contract 1) | Analyst | Must Have | EU Annex 11 §4.3 |
| FR-04 | All modes feed Work Queue or Process Log via same service (Contract 1 — no duplicate trigger path) | System | Must Have | Contract 1 |
| FR-05 | Every trigger logged INSERT-only: `checkpoint_id`, mode, `triggered_by`, `triggered_at UTC` | System | Must Have | ALCOA+ Contemporaneous |
| FR-06 | Missed trigger: `MissedTriggerEscalationJob` server-side (Contract 2) | System | Must Have | GMP |
| FR-07 | Offline scan queued and synced atomically on reconnect | System | Must Have | EU Annex 11 §4.3 |
| FR-08 | SignalR push on trigger (Contract 2 — no polling, no setInterval) | System | Must Have | Contract 2 |
| **FR-11** | **Mode 3 — Process Log: `ProcessLogSchedulerJob`. Time-slot grid for current day. Shift intervals from DB config.** | System | Must Have | GMP / Contract 2 |
| **FR-12** | **Mode 3 — Row unlocks at slot time; analyst enters parameters; e-signed §11.50 and locked.** | Analyst | Must Have | 21 CFR §11.50 |
| **FR-13** | **Mode 3 — Shaded/locked cells for parameters not due — enforced server-side (Contract 2).** | System | Must Have | Contract 2 |
| **FR-14** | **Mode 3 — OOS auto-flagged via `OOSDetectionService` (Contract 1 — same service as in-batch testing).** | System | Must Have | FDA OOS Guidance |
| **FR-15** | **Mode 4 — DO raised triggers outgoing QC task (`DispatchEventJob` — Contract 2).** | System | Must Have | GMP |
| **FR-16** | **Mode 4 — Test set configurable per product type in Master Data — not hardcoded (Contract 2).** | System | Must Have | Contract 2 |
| **FR-17** | **Grouped Checkpoint: one trigger, multiple locations, each column holds `spec_limit_id` FK (Contract 1 — no spec copy).** | Admin/QA | Must Have | GMP / Contract 1 |
| **FR-18** | **Per-column OOS check runs against column-specific spec limit independently.** | System | Must Have | FDA OOS Guidance |
| **FR-19** | **Critical parameter (`is_critical`): enforced every slot regardless of `column_frequency` (single enforcement in `CheckpointTriggerService` — Contract 1).** | System | Must Have | GMP |
| **FR-20** | **Non-critical parameters testable at column-level frequency; skippable with reason when not due.** | Analyst | Must Have | GMP / Contract 2 |

---

## 6. Data Model (PostgreSQL 16)

```sql
CREATE TABLE checkpoints (
  checkpoint_id    SERIAL PRIMARY KEY,
  checkpoint_code  VARCHAR(50) NOT NULL UNIQUE,
  lab_id           INT NOT NULL REFERENCES laboratories(lab_id),
  trigger_mode     VARCHAR(20) NOT NULL,
  -- TimeBased | OperatorScan | ProcessLog | DispatchEvent
  checkpoint_type  VARCHAR(20) NOT NULL DEFAULT 'Single',  -- Single | Grouped
  time_slots       JSONB,           -- from DB config (Contract 2 — never hardcoded)
  shift_interval_hrs INT,           -- Mode 3 interval
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- Grouped checkpoint columns — FK only (Contract 1)
CREATE TABLE checkpoint_locations (
  location_id    SERIAL PRIMARY KEY,
  checkpoint_id  INT NOT NULL REFERENCES checkpoints(checkpoint_id),
  column_order   INT NOT NULL,
  location_name  VARCHAR(200) NOT NULL,
  spec_limit_id  INT REFERENCES spec_limits(spec_limit_id)
);

-- INSERT-only trigger log — all 4 modes
CREATE TABLE checkpoint_trigger_log (
  trigger_id      BIGSERIAL PRIMARY KEY,
  checkpoint_id   INT NOT NULL REFERENCES checkpoints(checkpoint_id),
  trigger_mode    VARCHAR(20) NOT NULL,
  triggered_by    VARCHAR(100),
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_order  VARCHAR(100),       -- Mode 4 reference
  is_offline_sync BOOLEAN NOT NULL DEFAULT FALSE
);

-- Process Log rows (Mode 3)
CREATE TABLE process_log_rows (
  row_id        SERIAL PRIMARY KEY,
  checkpoint_id INT NOT NULL REFERENCES checkpoints(checkpoint_id),
  slot_time     TIMESTAMPTZ NOT NULL,
  slot_label    VARCHAR(20) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'Open',  -- Open | Signed | Locked
  signature_id  INT REFERENCES electronic_signatures(signature_id)
);
```

---

## 7. State Transitions

| Entity | From | To | Trigger | Compliance |
|---|---|---|---|---|
| Checkpoint Task | (triggered) | Open | Mode 1/2/3/4 fires `CheckpointTriggerService` | ALCOA+ Contemporaneous |
| Process Log Row | Open | Signed | Analyst e-sign §11.50 at slot time | 21 CFR §11.50 |
| Process Log Row | Signed | Locked | Server locks row after sign-off | ALCOA+ Enduring |
| Work Queue Task | Open | OOS | `OOSDetectionService` detects result outside spec | FDA OOS Guidance |
| Dispatch Task | Completed | CLEARED | All parameters PASS; no OOS open | GMP |
| Dispatch Task | Completed | BLOCKED | Any parameter FAIL or OOS open | FDA OOS Guidance |

---

## Audit & Compliance Summary

| Standard | Control |
|---|---|
| **21 CFR §11.50** | Every e-sig: `full_name + signed_at UTC + meaning + reason`. All four fields immutable after capture. Visible on CoA PDF and printed output. |
| **21 CFR §11.300** | `IElectronicSignatureService` verifies password independently of session token before accepting any signature. |
| **21 CFR §11.10(e)** | All audit logs INSERT-only at DB level. No UPDATE/DELETE by any role. Old/new values (JSONB) captured on every change. |
| **21 CFR §11.10(i)** | User training enforced at test gate. Expired training = hard block. `TrainingExpiryJob` runs daily (Contract 2). |
| **EU GMP Annex 11 §9** | Unique credentials required. Unique constraint on `users.user_id` — no shared credentials. |
| **EU GMP Annex 11 §10** | Audit trail immutable, computer-generated, date/time-stamped. Cannot be disabled or edited. |
| **EU GMP Annex 11 §12.4** | Annual periodic review. Evidence in `validation_review_logs`. |
| **EU GMP Annex 11 §7.1** | Daily encrypted backup. RPO <= 24 h, RTO <= 4 h. |
| **ALCOA+ Enduring** | Soft-delete only. INSERT-only audit logs. No hard delete at any level. |
| **ALCOA+ Contemporaneous** | All timestamps server-side UTC (Contract 2). Analyst cannot backdate any compliance record. |
| **Contract 1** | Single-service ownership per concern. FK-only references. No duplication. |
| **Contract 2** | All compute and timestamps server-side. All push via SignalR. No hardcoded values. |
| **Contract 4** | Login: 4 elements mandatory. Tenant Admin first-run. Segregation of duties enforced by system. |

