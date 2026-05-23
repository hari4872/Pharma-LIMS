# PHARMA LIMS — Sample Inventory & Pull Planning (Phase 7)
### Technical Design Document · v1.2 · CONFIDENTIAL
> **v1.2 Changes:** Sample Storage Management sub-module · Condition excursion logging · Location transfer chain of custody · T-90/T-30 destruction alerts · Short pull deviation auto-logging

---

## Document Metadata

| Field | Value |
|---|---|
| Module | Sample Inventory & Pull Planning (Phase 7) |
| Depends On | Master Data v1.2, Sample Registration v1.2 |
| Version | v1.2 |
| Status | Implemented · Live · May 2026 |
| Compliance | 21 CFR Part 11 · EU GMP Annex 11 · GMP · ICH Q1A · ALCOA+ · GAMP 5 |
| Governance | Contracts 1, 2, 4 — all clauses enforced |

---

## Governance Contracts (all clauses — applies to every section)

**Contract 1:** No code duplication. FK-only references. Single named service per concern. `digital_logbook_entries` is the single results source. DB-portable. Clean BE/FE/DB separation. Soft-delete only — never physically deleted.

**Contract 2:** All compute server-side. React renders only. All push via SignalR — no polling. No hardcoded values — all from PostgreSQL. Normalizer views (`vw_*`). UTC timestamps server-side.

**Contract 4:** Login page: username · password · forgot-password · remember-me — all four mandatory. First run: Tenant Admin creation first. Two user types only: Admin and Regular User. CRUD role model. Segregation of duties enforced by system.

## 1. Purpose & Scope

Sample Inventory & Pull Planning manages physical sample existence before testing. v1.2 adds a **full Sample Storage Management sub-module**: storage location master (room/chamber/shelf) with conditions per location (temp/humidity/light); real-time inventory count; **condition excursion logging** with impact assessment (`ExcursionImpactService` — Contract 1); **location transfer log** with chain of custody (21 CFR 211.170). Also new: **T-90 and T-30 destruction due date alerts** via `DestructionAlertJob` (Contract 2); and **short pull deviation auto-logging** when actual quantity < required.

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR §11.50 | Pull confirmation e-sig + destruction approval e-sig: `full_name + signed_at UTC + meaning + reason`. |
| 21 CFR 211.170 | Retain records INSERT-only. Chain of custody (location transfer log) immutable. |
| ICH Q1A | Pull time-points enforced. Missed pull escalated server-side (Contract 2). Short pull deviation logged. |
| EU Annex 11 §7.1 | `stability_pulls` + `retain_samples` + `storage_locations` in daily backup. Retention from DB config. |
| GMP — Condition Control | Storage condition excursions logged with impact assessment. Excursion window cross-referenced with affected samples. |

---

## 3. Module Sub-Sections

| Sub-Module | Scope |
|---|---|
| **2.1 Sample Storage Management** | Storage location master, conditions per location, real-time inventory, low-stock alerts, location transfer chain of custody |
| **2.2 Condition Excursion Logging** | Excursion detection (temp/humidity/light), impact assessment, affected sample flagging, QA notification via SignalR |
| **2.3 Stability Pull Scheduling** | ICH Q1A time-points, T-7/T-1 reminders, missed pull escalation, required quantity per time-point |
| **2.4 Retain Sample Management** | Retain lot registration, retention period tracking, T-90/T-30/T-7 destruction alerts, early destruction with QA e-sig |
| **2.5 Pull Execution** | Analyst pull task from Work Queue, quantity recording, short pull deviation, inventory deduction, auto-registration trigger |

---

## 4. Sample Storage Management — Detail (New v1.2)

| Feature | Specification |
|---|---|
| Storage Location Master | Room / Chamber / Shelf hierarchy. Each location: `location_code`, `location_type` (`Ambient`, `Cold`, `Freezer`, `StabilityChamber`). Condition limits: `temp_min_c`, `temp_max_c`, `humidity_min_pct`, `humidity_max_pct`. |
| Condition Limits | From `storage_locations` — not hardcoded (Contract 2). Excursion = recorded value outside limits. |
| Real-time Inventory | `vw_storage_inventory` normalizer (Contract 2): count of samples/lots per location. Low-stock alert threshold configurable per location from DB config. |
| Location Transfer Log | INSERT-only: `from_location_id`, `to_location_id`, `transferred_by`, `transferred_at UTC`, reason. 21 CFR 211.170 chain of custody. |
| Condition Excursion | Analyst or sensor records excursion: location, type (temp/humidity), measured value, duration. `ExcursionImpactService` (Contract 1): flags all samples in location during excursion window. QA notified via SignalR (Contract 2). |

---

## 5. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | Stability protocol: version-controlled, QA-approved §11.50 | QA | Must Have | ICH Q1A |
| FR-02 | Pull due dates server-side from T0 + time-points from DB (Contract 2) | System | Must Have | ICH Q1A |
| FR-03 | T-7 + T-1 reminders via `PullReminderJob` (IHostedService — Contract 2) | System | Must Have | ICH Q1A |
| FR-04 | Missed pull: `MissedPullJob` escalates server-side (Contract 2) | System | Must Have | ICH Q1A |
| FR-05 | Pull e-sig §11.50: full name + date/time UTC + meaning | Analyst | Must Have | 21 CFR §11.50 |
| FR-06 | Inventory deduction atomic in `PullExecutionService` (Contract 1) | System | Must Have | Contract 1 |
| FR-07 | Pull triggers `RegisterSampleCommand` (Contract 1: same command — no duplicate) | System | Must Have | Contract 1 |
| FR-08 | Retain destruction: QA §11.50 e-sig + reason; INSERT-only | QA | Must Have | 21 CFR 211.170 |
| FR-09 | Retention period from DB config (Contract 2 — not hardcoded) | System | Must Have | EU Annex 11 §7.1 |
| **FR-10** | **Storage location master: CRUD for room/chamber/shelf with condition limits per location. NEW v1.2** | Admin | Must Have | GMP / ICH Q1A |
| **FR-11** | **Real-time inventory via `vw_storage_inventory` normalizer (Contract 2). Low-stock alert threshold configurable. NEW v1.2** | System | Must Have | GMP |
| **FR-12** | **Location transfer log: INSERT-only chain of custody (21 CFR 211.170). NEW v1.2** | Analyst/Admin | Must Have | 21 CFR 211.170 |
| **FR-13** | **Condition excursion: `ExcursionImpactService` (Contract 1) flags affected samples; QA notified via SignalR. NEW v1.2** | Analyst | Must Have | GMP Condition Control |
| **FR-14** | **T-90 + T-30 destruction alerts via `DestructionAlertJob` (IHostedService — Contract 2). Alert days from DB config. NEW v1.2** | System | Must Have | 21 CFR 211.170 |
| **FR-15** | **Short pull deviation: auto-logged when actual < required. Analyst cannot complete pull without logging. NEW v1.2** | System | Must Have | ICH Q1A / ALCOA+ Complete |

---

## 6. Data Model Additions (v1.2)

```sql
CREATE TABLE storage_locations (
  location_id      SERIAL PRIMARY KEY,
  lab_id           INT NOT NULL REFERENCES laboratories(lab_id),
  location_code    VARCHAR(50) NOT NULL UNIQUE,
  location_name    VARCHAR(200) NOT NULL,
  location_type    VARCHAR(30) NOT NULL,  -- Ambient|Cold|Freezer|StabilityChamber
  temp_min_c       DECIMAL(5,1),          -- from DB -- not hardcoded (Contract 2)
  temp_max_c       DECIMAL(5,1),
  humidity_min_pct DECIMAL(5,1),
  humidity_max_pct DECIMAL(5,1),
  low_stock_threshold INT,                -- configurable alert threshold
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- INSERT-only chain of custody (21 CFR 211.170)
CREATE TABLE storage_transfer_log (
  transfer_id      SERIAL PRIMARY KEY,
  sample_id        INT NOT NULL REFERENCES samples(sample_id),
  from_location_id INT NOT NULL REFERENCES storage_locations(location_id),
  to_location_id   INT NOT NULL REFERENCES storage_locations(location_id),
  transferred_by   VARCHAR(100) NOT NULL,
  transferred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason           TEXT
);

CREATE TABLE condition_excursions (
  excursion_id     SERIAL PRIMARY KEY,
  location_id      INT NOT NULL REFERENCES storage_locations(location_id),
  excursion_type   VARCHAR(20) NOT NULL,  -- Temperature|Humidity|Light
  measured_value   DECIMAL(8,2) NOT NULL,
  limit_exceeded   VARCHAR(10) NOT NULL,  -- Min | Max
  excursion_start  TIMESTAMPTZ NOT NULL,
  excursion_end    TIMESTAMPTZ,
  recorded_by      VARCHAR(100) NOT NULL,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  impact_assessed  BOOLEAN NOT NULL DEFAULT FALSE,
  impact_outcome   TEXT
);

CREATE TABLE short_pull_deviations (
  deviation_id    SERIAL PRIMARY KEY,
  pull_id         INT NOT NULL REFERENCES stability_pulls(pull_id),
  required_qty    DECIMAL(10,3) NOT NULL,
  actual_qty      DECIMAL(10,3) NOT NULL,
  shortfall       DECIMAL(10,3) NOT NULL,
  reason          TEXT NOT NULL,         -- mandatory before pull can complete
  logged_by       VARCHAR(100) NOT NULL,
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Audit & Compliance Summary

| Standard | Control |
|---|---|
| **21 CFR §11.50** | Every e-sig: `full_name + signed_at UTC + meaning + reason`. Immutable after capture. |
| **21 CFR §11.300** | Password verified independently of session token. |
| **21 CFR §11.10(e)** | All audit logs INSERT-only. Old/new values captured. |
| **EU GMP Annex 11 §7.1** | Daily encrypted backup. RPO <= 24 h, RTO <= 4 h. |
| **ALCOA+ Enduring** | Soft-delete only. INSERT-only audit logs. No hard delete. |
| **Contract 1** | Single-service ownership. FK-only references. No duplication. |
| **Contract 2** | All compute server-side. All push via SignalR. No hardcoded values. |

