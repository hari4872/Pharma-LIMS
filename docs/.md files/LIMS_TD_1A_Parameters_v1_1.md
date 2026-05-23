# PHARMA LIMS — Parameters (Phase 1a)
### Technical Design Document · v1.1 · CONFIDENTIAL
> **v1.1 Changes:** Critical flag · Column-level frequency · Regulatory spec tier · OOT threshold · Table-lookup formula type

---
## Document Metadata

| Field | Value |
|---|---|
| Module | Parameters (Phase 1a) |
| Depends On | Master Data v1.2 |
| Frontend | React 18 + TypeScript + Vite + Redux Toolkit |
| Backend | .NET Core 8 Web API · Clean Architecture · MediatR · EF Core 8 · SignalR |
| Database | PostgreSQL 16 (Neon — DB-portable via connection string only) |
| Compliance | 21 CFR Part 11 · EU GMP Annex 11 · GMP · ICH Q10 · ALCOA+ · GAMP 5 |
| Governance | Contracts 1, 2, 4 — all clauses enforced in every section |
| Version | v1.1 |
| Status | Implemented · Live · May 2026 |
| Classification | CONFIDENTIAL |

---

## Governance Contracts

### Contract 1 — General Architecture

| Clause | Enforced Rule |
|---|---|
| No code duplication | Every business rule owned by exactly one named service class. If logic exists in two places, one is wrong. |
| FK-only references | No module copies master data (parameter names, spec values, form layouts) into its own tables. All via FK to single source table. |
| Single source of truth | `digital_logbook_entries` is the single results store consumed by Results Management, QA Review, CoA, and Traceability. No separate results copy. |
| DB-portable | Database accessed via connection string only. Zero code changes needed to migrate to any cloud PostgreSQL host. |
| Clean separation | .NET Core 8 owns all logic. React submits and renders. PostgreSQL stores. No business logic in React components or stored procedures. |
| No dead code | Inactive records use soft-delete (`is_active = FALSE`). Never physically deleted. |

### Contract 2 — Backend Services

| Clause | Enforced Rule |
|---|---|
| All compute on server | Every calculation, formula, OOS/OOT comparison, status change runs in .NET Core 8 handlers. React renders results — never computes. |
| All push via SignalR | Every alert, status change, and real-time update pushed from server. React does not poll — no `setInterval`, no repeated GET. |
| No hardcoded values | Every threshold, limit, timing, configuration, and business rule stored in PostgreSQL. No magic numbers in handlers or React. |
| Normalizer views | `vw_*` prefix: defined in PostgreSQL, queried by API. Same view drives every UI panel showing the same data — no per-screen recalculation. |
| Background jobs | All scheduled jobs (`*Job.cs`) run as `IHostedService` server-side. Timing from DB config — not hardcoded. |
| UTC timestamps | All timestamps server-side UTC. No client-supplied timestamps accepted for any compliance record (ALCOA+ Contemporaneous). |

### Contract 4 — Authentication & Access Control

| Clause | Enforced Rule |
|---|---|
| Login page | **Username · Password · Forgot-password link · Remember-me checkbox** — all four mandatory. No exceptions. |
| First run | Tenant Admin creation screen before any other user or module access. |
| Two user types | Admin and Regular User only. Roles are Regular User variants with explicit module-level write grants. |
| CRUD role model | Every entity follows Create/Read/Update/Delete permission boundaries. Role table drives access — no hardcoded role names. |
| Regular User default | View-only. Write access must be explicitly granted per module. |
| Segregation of duties | Enforced by system: analyst cannot approve own results; QC Lead cannot enter raw data; QA cannot be analyst on same sample. |
| No shared credentials | Unique `user_id` constraint at DB level. Violations rejected at DB — not only application layer. |

## 1. Purpose & Scope

A **Parameter** = one measurable property (e.g. H₂SO₄%, pH, Turbidity, Purity). Defined **ONCE** in a Test Method. Reused identically across Checkpoints, Form Templates, test forms, Digital Logbook rows, and CoA lines via `parameter_id` FK (Contract 1). `ParameterCalculationService` is the single formula engine — both Expression and TableLookup types. `OOSDetectionService` covers both OOS and OOT in the same service class.

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR §11.10(e) | Every parameter result is an electronic record. Immutable after e-sig. Audit log captures old/new values. |
| 21 CFR §11.50 | E-sig on result: `full_name + signed_at UTC + meaning + reason`. Displayed on logbook row and CoA. |
| ALCOA+ Original | Calculated result server-computed (Contract 2). Analyst cannot override `calculated_result`. |
| ALCOA+ Consistent | `parameter_id` FK throughout — zero duplication (Contract 1). |
| ICH Q6A / 21 CFR 211.194 | Approved spec limits (in-house + regulatory) required before OOS/OOT detection. Both shown on CoA. |
| FDA OOS Guidance 2006 | OOS auto-raised server-side. OOT auto-raised for trending. Single `OOSDetectionService` (Contract 1). |

---

## 3. Parameter Attributes — Full Specification

| Attribute | Field | Notes |
|---|---|---|
| Parameter Name | `parameter_name` | Human-readable (e.g. Concentration%, pH, Turbidity NTU) |
| Parameter Code | `parameter_code` | Short code used in formulas and logbook column headers |
| Unit of Measure | `uom` | ppm / % / g/ml / NTU / uS/cm — from DB config (Contract 2) |
| Data Type | `data_type` | `Numeric` \| `Text` \| `PassFail` — drives UI field type |
| **Formula Type** | `formula_type` | **`Expression` \| `TableLookup` — NEW v1.1** |
| Calc Formula | `calc_formula` | Standard expression (server-side only — Contract 2) |
| **Table-Lookup Ref** | `lookup_table_id` | **FK to `parameter_lookup_tables` (e.g. `SG_TEMP_CONC`) — NEW v1.1** |
| Required Instrument Type | `instrument_type` | Configurable per parameter — no hardcoded list |
| **Critical Flag** | `is_critical` | **`TRUE` = mandatory every slot/trigger regardless of frequency — NEW v1.1** |
| **Column Frequency** | `column_frequency` | **`Daily` \| `Weekly` \| `Periodic` — for non-critical params only — NEW v1.1** |

---

## 4. Spec Limits — In-House + Regulatory + OOT

| Field | Purpose |
|---|---|
| `min_value` / `max_value` | In-house OOS limits. FAIL = OOS auto-raised. Mandatory investigation before batch proceeds. |
| **`regulatory_tier`** | **Standard label shown on CoA (e.g. USP, EP, ISO, MS). Shown alongside in-house spec. NEW v1.1** |
| **`regulatory_min` / `regulatory_max`** | **Regulatory acceptance limits. Shown side-by-side with in-house on CoA. NEW v1.1** |
| **`oot_min_value` / `oot_max_value`** | **Out-of-Trend limits. Outside OOT = trending alert. `OOSDetectionService` OOT mode. NEW v1.1** |
| `version` | Auto-incremented on edit. Previous version archived — never deleted. |
| `status` | `Draft` \| `Approved`. Only Approved spec limits used in testing. QA e-sig §11.50 required. |

---

## 5. Critical Flag — Enforcement Rules

| Context | Behaviour |
|---|---|
| Checkpoint / Process Log | Critical parameters must be entered every slot/trigger regardless of `column_frequency`. System blocks row sign-off if blank. |
| Testing Execution | Evidence attachment (`evidence_file_ref`) mandatory before step sign-off when `is_critical = TRUE`. System blocks if absent. |
| QA Review (Checklist Item 8) | Every logbook row where `is_critical = TRUE` must have `evidence_file_ref NOT NULL`. Hard block on QA approval. |
| WAP Assignment | Only analysts trained on critical methods are assigned tasks involving critical parameters. |

---

## 6. Table-Lookup Formula

Derives a result from raw measurements via a pre-loaded reference table rather than a mathematical expression. Example: SG measured at actual temperature → Concentration% at 25°C standard temperature.

- Table loaded **once** in Master Data — referenced by `parameter_id` FK (Contract 1 — no data copy per parameter)
- `ParameterCalculationService` resolves lookup **server-side** (Contract 2)
- UI entry fields match input columns; calculated result shown read-only after lookup
- OOS/OOT applied identically to expression-formula results (`OOSDetectionService` — Contract 1)

---

## 7. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | Create parameter: name, UOM, data type, formula, instrument type | Admin/QA | Must Have | ICH Q6A / Contract 1 |
| FR-02 | Formula (Expression) applied server-side; result read-only in UI | System | Must Have | ALCOA+ / Contract 2 |
| FR-03 | Spec limits per parameter — QA e-sig §11.50 required | QA | Must Have | 21 CFR §11.50 |
| FR-04 | OOS auto-raised if result outside in-house spec (server-side `OOSDetectionService`) | System | Must Have | FDA OOS Guidance |
| FR-05 | `parameter_id` FK reused by Checkpoints, Logbook, CoA (Contract 1) | System | Must Have | ALCOA+ Consistent |
| FR-06 | Spec limit snapshot on logbook row at test time — immutable (ALCOA+ Enduring) | System | Must Have | ALCOA+ Enduring |
| FR-07 | All create/update/approval audit-logged INSERT-only | System | Must Have | 21 CFR §11.10(e) |
| FR-08 | Login: forgot-password + remember-me; Tenant Admin first-run | System | Must Have | Contract 4 |
| **FR-09** | **Critical flag (`is_critical`): enforced server-side every slot — single enforcement point (Contract 1)** | System | Must Have | GMP / Contract 1 |
| **FR-10** | **Column-level frequency (`column_frequency`): Daily/Weekly/Periodic — from DB config (Contract 2)** | Admin/QA | Must Have | GMP / Contract 2 |
| **FR-11** | **Regulatory spec tier: `regulatory_min/max` + tier label stored on spec limits; both compared server-side** | System | Must Have | ICH Q6A / 21 CFR 211.194 |
| **FR-12** | **OOT threshold: `oot_min_value`/`oot_max_value` — OOT auto-raised by `OOSDetectionService`** | System | Must Have | GMP trending |
| **FR-13** | **Table-lookup formula: `ParameterCalculationService` resolves via `parameter_lookup_tables` FK — server-side only** | System | Must Have | ALCOA+ / Contract 2 |
| **FR-14** | **Lookup table CRUD in Master Data: loaded once; referenced by all parameters via FK (Contract 1)** | Admin | Must Have | Contract 1 |

---

## 8. Data Model (PostgreSQL 16)

```sql
-- Contract 1: parameter defined ONCE
CREATE TABLE test_method_parameters (
  parameter_id     SERIAL PRIMARY KEY,
  method_id        INT NOT NULL REFERENCES test_methods(method_id),
  parameter_name   VARCHAR(200) NOT NULL,
  uom              VARCHAR(30)  NOT NULL,
  data_type        VARCHAR(20)  NOT NULL,   -- Numeric | Text | PassFail
  formula_type     VARCHAR(20)  NOT NULL DEFAULT 'Expression',
  calc_formula     VARCHAR(500),            -- server-side only (Contract 2)
  lookup_table_id  INT REFERENCES parameter_lookup_tables(lookup_table_id),
  instrument_type  VARCHAR(100),
  is_critical      BOOLEAN NOT NULL DEFAULT FALSE,
  column_frequency VARCHAR(20)              -- Daily | Weekly | Periodic
);

-- Spec limits with regulatory tier and OOT thresholds (NEW v1.1)
CREATE TABLE spec_limits (
  spec_limit_id    SERIAL PRIMARY KEY,
  parameter_id     INT NOT NULL REFERENCES test_method_parameters(parameter_id),
  material_id      INT REFERENCES materials(material_id),
  stage            VARCHAR(50) NOT NULL,
  min_value        DECIMAL(18,6),
  max_value        DECIMAL(18,6),
  regulatory_tier  VARCHAR(100),   -- USP | EP | ISO | MS
  regulatory_min   DECIMAL(18,6),
  regulatory_max   DECIMAL(18,6),
  oot_min_value    DECIMAL(18,6),
  oot_max_value    DECIMAL(18,6),
  status           VARCHAR(20) NOT NULL DEFAULT 'Draft',
  version          VARCHAR(10) NOT NULL DEFAULT '1.0',
  signature_id     INT REFERENCES electronic_signatures(signature_id),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- Table-lookup reference data
CREATE TABLE parameter_lookup_tables (
  lookup_table_id  SERIAL PRIMARY KEY,
  lookup_code      VARCHAR(50)  NOT NULL UNIQUE,  -- e.g. SG_TEMP_CONC
  input_col_1      VARCHAR(50)  NOT NULL,
  input_col_2      VARCHAR(50),
  result_col       VARCHAR(50)  NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
);
```
---

## Audit & Compliance Summary

| Standard | Control |
|---|---|
| **21 CFR §11.50** | Every e-sig: `full_name + signed_at UTC + meaning + reason`. All four fields immutable after capture. Visible on CoA PDF and printed output without system access. |
| **21 CFR §11.300** | `IElectronicSignatureService` verifies password independently of session token. Session token alone cannot authorise a signature. |
| **21 CFR §11.10(e)** | All audit logs INSERT-only at DB level. No UPDATE/DELETE by any role including Admin. Old/new values (JSONB) captured on every change. |
| **21 CFR §11.10(i)** | User training enforced at test gate. Expired training = hard block. `TrainingExpiryJob` runs daily server-side (Contract 2). |
| **EU GMP Annex 11 §9** | Unique credentials required. Unique constraint on `users.user_id` at DB level — no shared credentials permitted. |
| **EU GMP Annex 11 §10** | Audit trail immutable, computer-generated, date/time-stamped. Cannot be disabled or edited. Available on demand for inspection. |
| **EU GMP Annex 11 §12.4** | Annual periodic review. Evidence in `validation_review_logs`. |
| **EU GMP Annex 11 §7.1** | Daily encrypted backup. RPO ≤ 24 h, RTO ≤ 4 h. |
| **ALCOA+ Enduring** | Soft-delete only. INSERT-only audit logs. No hard delete at any level. |
| **ALCOA+ Contemporaneous** | All timestamps server-side UTC (Contract 2). Analyst cannot backdate any compliance record. |
| **Contract 1** | Single-service ownership per concern. FK-only references. No code duplication. |
| **Contract 2** | All compute and timestamps server-side. All push via SignalR. No hardcoded values. No polling. |
| **Contract 4** | Login: 4 elements mandatory. Tenant Admin first-run. Segregation of duties enforced by system — not policy. |

