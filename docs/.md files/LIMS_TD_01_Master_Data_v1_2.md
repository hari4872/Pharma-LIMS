# PHARMA LIMS — Master Data (Phase 1)
### Technical Design Document · v1.2 · CONFIDENTIAL
> **v1.2 Changes:** Form Template entity · Dependency Tier model · Sample Type fields · Configurable Sample ID format

---

## Document Metadata

| Field | Value |
|---|---|
| Module | Master Data (Phase 1) |
| Depends On | None — root phase |
| Frontend | React 18 + TypeScript + Vite + Redux Toolkit |
| Backend | .NET Core 8 Web API · Clean Architecture · MediatR · EF Core 8 · SignalR |
| Database | PostgreSQL 16 (Neon — DB-portable via connection string only) |
| Compliance | 21 CFR Part 11 · EU GMP Annex 11 · GMP · ICH Q10 · ALCOA+ · GAMP 5 |
| Governance | Contracts 1, 2, 4 — all clauses enforced in every section |
| Version | v1.2 |
| Status | Implemented · Live · May 2026 |
| Classification | CONFIDENTIAL |

---

## Governance Contracts

### Contract 1 — General Architecture

| Clause | Enforced Rule |
|---|---|
| No duplication | Parameters defined **ONCE** in `test_method_parameters`. All consumers (Checkpoints, test forms, Digital Logbook, CoA) reference `parameter_id` FK only — no copy of parameter definition in any other table. |
| No duplication | Form Template defined **ONCE** in `form_templates`. All consumers reference `form_template_id` FK only. No module copies form layout definitions. |
| Single source of truth | All modules read master data from master tables. `MasterDataValidatorService` is the single location for all master data validation logic. |
| Single service per concern | Approval logic owned by `ApprovalService`. Instrument calibration check owned by `InstrumentStatusService`. No duplicate logic in controllers or React. |
| DB-portable | Database accessed via connection string only. Migration to any cloud PostgreSQL requires zero code changes. |
| Clean BE/FE/DB separation | .NET Core 8 owns all validation, computation, and business logic. React submits and renders. PostgreSQL stores. No business logic in React components or stored procedures. |
| No dead code | Inactive records use soft-delete (`is_active = FALSE`). All records remain in DB for audit and traceability — never physically deleted. |

### Contract 2 — Backend Services

| Clause | Enforced Rule |
|---|---|
| All compute on server | Spec limit comparison, parameter formula calculation, calibration OOC detection, training validity checks — all in .NET Core 8 handlers. React renders results and never computes. |
| Normalizer views | `vw_active_spec_limits`, `vw_instrument_status`, `vw_training_currency`, `vw_form_template_active` — every UI panel reads from the same view. No per-page recalculation. |
| All push from server | Every notification, alert, status change, and real-time update pushed via SignalR. React does not poll — no `setInterval` or repeated GET for status. |
| No hardcoded values | Every threshold, limit, configuration value, and business rule stored in PostgreSQL. No magic numbers in .NET handlers or React components. |
| UTC timestamps | All timestamps generated server-side as UTC. No client-supplied timestamps accepted for compliance records (ALCOA+ Contemporaneous). |

### Contract 4 — Authentication & Access Control

| Clause | Enforced Rule |
|---|---|
| Login page | **Username · Password · Forgot-password link · Remember-me checkbox** — all four elements mandatory, no exceptions. |
| First run | Tenant Admin creation screen shown before any other user can be created or any module accessed. |
| Two user types | Admin and Regular User only. Roles (Analyst, QC Lead, QA, Lab Manager) are Regular User variants with explicit module-level write grants. |
| CRUD role model | Every entity follows Create/Read/Update/Delete permission boundaries. Role table drives access — no hardcoded role names in business logic. |
| Role assignments | Admin: full CRUD on all master data. QA: create/edit/approve test methods, spec limits, form templates. Analyst (Regular User, view-only in Master Data): reads master data to perform tests. |
| Segregation of duties | Enforced by system — analyst cannot approve own results, QA cannot be same person as analyst on same sample. |

---

## 1. Purpose & Scope

Master Data is the **foundation layer** of the Pharma LIMS. Every downstream module depends on approved, version-controlled master data. In the architecture, Parameters are defined within Test Methods and acceptance limits are set in Spec Limits — a single source of truth reused across Checkpoints, test forms, Digital Logbook, and CoA. Form Templates are a first-class Master Data entity (v1.2), defined once and consumed by all modules via FK (Contract 1). A **three-tier dependency model** governs setup order: Foundation → Configuration → Operational.

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR Part 11 §11.10(a) | System validated per GAMP 5 Cat 5. IQ/OQ/PQ cover all create, approval, versioning functions. |
| 21 CFR Part 11 §11.10(c) | Soft-delete only. Audit logs append-only. No hard delete at DB level. |
| 21 CFR Part 11 §11.10(e) | Audit trail: every create, update, approval logged with user ID, UTC timestamp, old value, new value. |
| 21 CFR Part 11 §11.10(i) | User training records enforced at registration gate. Expired training = hard block. No override. |
| 21 CFR Part 11 §11.50 | Approval e-sigs: printed full name + UTC date/time + meaning + reason. All four fields immutable after capture. |
| 21 CFR Part 11 §11.300 | Password re-entry required for every e-sig, independent of session token. |
| EU GMP Annex 11 §4.3 | All inputs validated server-side (FluentValidation + Zod). No unapproved entity drives test assignment. |
| EU GMP Annex 11 §9 | All approvals: unique credentials + password re-entry independent of session. |
| EU GMP Annex 11 §10 | Immutable audit trail — INSERT-only at DB level. |
| EU GMP Annex 11 §12.4 | Annual periodic re-validation. Evidence in `validation_review_logs`. |
| EU GMP Annex 11 §7.1 | Daily encrypted backup. RPO ≤ 24 h, RTO ≤ 4 h. |
| ALCOA+ | Attributable · Legible · Contemporaneous (UTC) · Original (system IDs) · Accurate (validated) · Complete · Consistent · Enduring (soft-delete) · Available (paginated API). |
| GAMP 5 | Category 5. Versioning, approval, audit trail are testable functions with IQ/OQ/PQ scripts. |

---

## 3. Master Data Entities & Key Fields

| # | Category | Purpose | Key Fields | Linked To |
|---|---|---|---|---|
| 1 | Laboratory | Lab location / unit | Lab Name, Location, Type, Site | Instruments, Users |
| 2 | Instrument Master | Analytical equipment catalog | ID, Type, Model, Serial, Cal Due, Status | Test Methods, Lab |
| 3 | Material Master | All materials under test | Name, Type, UOM, Shelf Life | Specs, Samples |
| 4 | Test Method | Validated analytical procedure | Method ID, Type, Parameters, SOP Ref | Specs, Instruments |
| 5 | Specification (Spec Limits) | Acceptance limits per material | Min/Max, In-house, Regulatory Tier, OOT | Material, Methods |
| 6 | **Form Template** *(new v1.2)* | Digital form layout & trigger config | Form ID, Columns, Frequency, Trigger Type | All modules |
| 7 | Sample Type | Sampling category | Sample Type, Matrix, Stage | Material, Specs |
| 8 | Reagents & Standards | Reference and working standards | Lot No, Potency, Expiry | Test Methods |
| 9 | Users & Roles | Access control | Role, Permissions, Lab Assignment | All modules |

---

## 4. Dependency Tier Model

Setup follows a strict three-tier order enforced server-side by `MasterDataValidatorService` (Contract 1).

| Tier | Entities | Prerequisite | Setup Action |
|---|---|---|---|
| **Tier 1 — Foundation** | Lab · Users · Form Templates | Must exist before Tier 2 setup can begin | Create site record, user roles, and form template definitions first |
| **Tier 2 — Configuration** | Instruments · Materials · Test Methods | Depend on Tier 1 entities | Register instruments, add materials, draft and approve test methods |
| **Tier 3 — Operational** | Specifications · Sample Types · Reagents & Standards | Depend on Tier 1 + Tier 2 entities | Define spec limits, sample categories, and reagent lots |

### Dependency Rules

| Rule | Upstream Entity Required |
|---|---|
| Instrument → Lab | Lab (Tier 1) must exist before instrument can be assigned |
| Specification → Material + Test Method | Both (Tier 2) must be approved before spec limits can be set |
| Sample → Material + Spec | Approved spec must exist before sample can be registered |
| Test Method → Instrument Type | Instrument type must be in master before method can reference it |
| Reagents → Test Method | Test method must exist before reagent can be linked |
| Form Template → Test Method + Trigger | Approved test method with parameters required before form template creation |

---

## 5. Form Template Entity (New v1.2)

A Form Template defines the layout, parameters, trigger type, and frequency of a digital test form. Created and approved once in Master Data, then referenced by FK across Checkpoints, Sample Registration, and Test Execution. No module copies form layout definitions (Contract 1).

| Field | Description |
|---|---|
| Form ID | System-generated unique identifier (e.g. `LAB-F-10`). Configurable prefix per lab in `lab_config`. |
| Form Name | Human-readable name (e.g. Daily Process Monitoring — Tank Farm) |
| Trigger Type | `TimeBased` \| `OperatorScan` \| `ProcessLog` \| `DispatchEvent` — selected from DB config (Contract 2). |
| Frequency / Time Slots | Configurable schedule stored in `form_templates.time_slots` JSONB — never hardcoded (Contract 2). |
| Locations (Columns) | One column per location/tank/vessel for grouped forms. Each column holds its own `spec_limit_id` FK. |
| Parameters | Linked via `parameter_id` FK from `test_method_parameters`. No parameter name copied (Contract 1). |
| Regulatory Spec Tier | In-house and regulatory standard shown side-by-side on form and CoA. |
| Status | Draft → Active (after QA e-sig §11.50). Version-controlled. Previous versions archived — never deleted. |

---

## 6. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | CRUD for Laboratory | Admin | Must Have | GMP / ISA-95 |
| FR-02 | CRUD for Instrument Master | Admin | Must Have | EU GMP Ch 6 |
| FR-03 | CRUD for Material Master | Admin | Must Have | GMP / ALCOA+ |
| FR-04 | CRUD for Test Method | Admin/QA | Must Have | GMP |
| FR-05 | CRUD for Test Method Parameters (name, UOM, data type, formula, critical flag) | Admin/QA | Must Have | ICH Q6A / Contract 1 |
| FR-06 | CRUD for Spec Limits (min/max, in-house + regulatory tier) | Admin/QA | Must Have | ICH Q6A / 21 CFR 211.194 |
| FR-07 | QA approval of Spec Limits and Test Methods via e-sig §11.50 | QA | Must Have | 21 CFR §11.50 |
| FR-08 | CRUD for Sample Type (type, matrix, stage) | Admin | Must Have | GMP |
| FR-09 | CRUD for Reagents & Standards | Admin/QA | Must Have | ICH Q2(R1) |
| FR-10 | CRUD for Users & Roles (Admin / Regular User, CRUD role model) | Admin | Must Have | Contract 4 |
| FR-11 | User training records per analyst per method §11.10(i) | Admin | Must Have | 21 CFR §11.10(i) |
| FR-12 | Version control on every Spec Limit or Test Method edit; old archived | System | Must Have | GMP / ICH Q10 |
| FR-13 | Instrument cal due tracking; OOC auto-status (daily server job — Contract 2) | System | Must Have | EU GMP Ch 6 |
| FR-14 | Soft-delete only on all entities with mandatory reason | System | Must Have | ALCOA+ Enduring |
| FR-15 | All actions audit-logged INSERT-only: user, UTC timestamp, old/new value | System | Must Have | 21 CFR §11.10(e) |
| FR-16 | SignalR push on approval status changes (Contract 2 — no polling) | System | Must Have | Contract 2 |
| FR-17 | Login: forgot-password + remember-me (Contract 4) | System | Must Have | Contract 4 |
| FR-18 | Tenant Admin creation on first run (Contract 4) | System | Must Have | Contract 4 |
| **FR-19** | **CRUD for Form Template (Form ID, columns, trigger type, frequency, regulatory spec tier) — QA approved before use. FK consumed by all modules (Contract 1).** | Admin/QA | Must Have | GMP / Contract 1 |
| **FR-20** | **Form Template approval: QA e-sig §11.50; status Draft → Active; version-controlled.** | QA | Must Have | 21 CFR §11.50 |
| **FR-21** | **Dependency Tier enforcement: Tier 1 → Tier 2 → Tier 3 — server-side `MasterDataValidatorService` (Contract 1).** | System | Must Have | GMP / Contract 1 |
| **FR-22** | **Sample ID format configurable per site/lab in DB `lab_config` — `ISampleIdFormatService` (Contract 2 — no hardcoded format).** | Admin | Must Have | ALCOA+ / Contract 2 |

---

## 7. User Roles & Permissions

| Action | Admin | QA | Analyst | Viewer |
|---|---|---|---|---|
| View all master data | ✅ | ✅ | ✅ | ✅ |
| Create / Edit Lab, Instrument, Material | ✅ | ❌ | ❌ | ❌ |
| Create / Edit Test Methods, Spec Limits, Form Templates | ✅ | ✅ | ❌ | ❌ |
| Approve Spec Limit / Method / Form Template (e-sig §11.50) | ❌ | ✅ | ❌ | ❌ |
| Create / Edit Users | ✅ | ❌ | ❌ | ❌ |
| Manage training records | ✅ | ❌ | ❌ | ❌ |
| Configure Sample ID format | ✅ | ❌ | ❌ | ❌ |
| Deactivate entity (soft-delete with reason) | ✅ | ❌ | ❌ | ❌ |
| View audit trail | ✅ | ✅ | ❌ | ❌ |

---

## 8. Data Model (PostgreSQL 16)

```sql
-- Tier 1: Foundation
CREATE TABLE laboratories (
  lab_id       SERIAL PRIMARY KEY,
  lab_name     VARCHAR(150) NOT NULL,
  location     VARCHAR(200) NOT NULL,
  lab_type     VARCHAR(50)  NOT NULL,  -- QC | R&D | Stability | Microbiology
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,  -- Contract 1: soft-delete
  created_by   VARCHAR(100) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE instruments (
  instrument_id   SERIAL PRIMARY KEY,
  lab_id          INT NOT NULL REFERENCES laboratories(lab_id),
  instrument_code VARCHAR(50)  NOT NULL UNIQUE,
  instrument_type VARCHAR(100) NOT NULL,
  model           VARCHAR(150),
  serial_number   VARCHAR(100),
  calibration_due DATE NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'Available',
  -- Available | In-Use | Maintenance | OutOfCalibration
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contract 1: parameter defined ONCE; all modules reference parameter_id FK
CREATE TABLE test_method_parameters (
  parameter_id    SERIAL PRIMARY KEY,
  method_id       INT NOT NULL REFERENCES test_methods(method_id),
  parameter_name  VARCHAR(200) NOT NULL,
  parameter_code  VARCHAR(50)  NOT NULL,
  uom             VARCHAR(30)  NOT NULL,
  data_type       VARCHAR(20)  NOT NULL,  -- Numeric | Text | PassFail
  formula_type    VARCHAR(20)  NOT NULL DEFAULT 'Expression',
  calc_formula    VARCHAR(500),           -- server-side only (Contract 2)
  lookup_table_id INT REFERENCES parameter_lookup_tables(lookup_table_id),
  instrument_type VARCHAR(100),
  is_critical     BOOLEAN NOT NULL DEFAULT FALSE,
  is_mandatory    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE spec_limits (
  spec_limit_id    SERIAL PRIMARY KEY,
  parameter_id     INT NOT NULL REFERENCES test_method_parameters(parameter_id),
  material_id      INT REFERENCES materials(material_id),
  stage            VARCHAR(50) NOT NULL,
  min_value        DECIMAL(18,6),
  max_value        DECIMAL(18,6),
  regulatory_tier  VARCHAR(100),  -- USP | EP | ISO | MS
  regulatory_min   DECIMAL(18,6),
  regulatory_max   DECIMAL(18,6),
  oot_min_value    DECIMAL(18,6),
  oot_max_value    DECIMAL(18,6),
  status           VARCHAR(20) NOT NULL DEFAULT 'Draft',
  version          VARCHAR(10) NOT NULL DEFAULT '1.0',
  approved_by      VARCHAR(100),
  approved_at      TIMESTAMPTZ,
  signature_id     INT REFERENCES electronic_signatures(signature_id),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       VARCHAR(100) NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Contract 1: Form Template defined ONCE; all modules reference form_template_id FK
CREATE TABLE form_templates (
  form_template_id  SERIAL PRIMARY KEY,
  form_code         VARCHAR(50)  NOT NULL UNIQUE,  -- e.g. LAB-F-10
  form_name         VARCHAR(200) NOT NULL,
  lab_id            INT NOT NULL REFERENCES laboratories(lab_id),
  form_type         VARCHAR(20)  NOT NULL DEFAULT 'Single', -- Single | Grouped
  trigger_type      VARCHAR(30)  NOT NULL,
  -- TimeBased | OperatorScan | ProcessLog | DispatchEvent
  time_slots        JSONB,                 -- from DB config (Contract 2)
  shift_interval_hrs INT,
  regulatory_tier   VARCHAR(100),
  evidence_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  status            VARCHAR(20)  NOT NULL DEFAULT 'Draft',
  version           VARCHAR(10)  NOT NULL DEFAULT '1.0',
  approved_by       VARCHAR(100),
  approved_at       TIMESTAMPTZ,
  signature_id      INT REFERENCES electronic_signatures(signature_id),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by        VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Grouped form columns — FK only (Contract 1)
CREATE TABLE form_template_locations (
  location_id       SERIAL PRIMARY KEY,
  form_template_id  INT NOT NULL REFERENCES form_templates(form_template_id),
  column_order      INT NOT NULL,
  location_name     VARCHAR(200) NOT NULL,
  spec_limit_id     INT REFERENCES spec_limits(spec_limit_id)
);

-- Parameter links on form template — FK only (Contract 1)
CREATE TABLE form_template_parameters (
  form_template_id  INT NOT NULL REFERENCES form_templates(form_template_id),
  parameter_id      INT NOT NULL REFERENCES test_method_parameters(parameter_id),
  display_order     INT NOT NULL,
  column_frequency  VARCHAR(20),  -- Daily | Weekly | Periodic
  UNIQUE(form_template_id, parameter_id)
);

-- Sample ID format — configurable per lab (Contract 2 — never hardcoded)
CREATE TABLE lab_config (
  config_id     SERIAL PRIMARY KEY,
  lab_id        INT NOT NULL REFERENCES laboratories(lab_id),
  config_key    VARCHAR(100) NOT NULL,
  config_value  TEXT NOT NULL,
  -- e.g. config_key='sample_id_format', config_value='{SITE}-{MAT}-{DATE}-{SEQ}'
  updated_by    VARCHAR(100) NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- E-signatures — §11.50 compliant, INSERT-only
CREATE TABLE electronic_signatures (
  signature_id  SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(user_id),
  full_name     VARCHAR(200) NOT NULL,   -- §11.50: printed name
  signed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),  -- §11.50: date/time UTC
  meaning       TEXT NOT NULL,           -- §11.50: meaning
  reason        TEXT NOT NULL,           -- §11.50: reason
  action_type   VARCHAR(100) NOT NULL
);

-- Audit log — INSERT-only at DB level (Contract 1 + Annex 11 §10)
CREATE TABLE master_data_audit_logs (
  audit_id      BIGSERIAL    PRIMARY KEY,
  entity_type   VARCHAR(50)  NOT NULL,
  entity_id     INT          NOT NULL,
  event_type    VARCHAR(50)  NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  performed_by  VARCHAR(100) NOT NULL,
  performed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

## 9. Backend Service Structure (.NET Core 8)

```
LIMS.MasterData/src/
  Application/Services/
    IElectronicSignatureService.cs   -- §11.50 + §11.300: password re-entry independent of session
    IVersioningService.cs            -- auto-increment version on every edit
    IMasterDataAuditService.cs       -- INSERT-only audit writer
    IMasterDataValidatorService.cs   -- dependency tier enforcement (Contract 1)
    IPeriodicReviewService.cs        -- Annex 11 §12.4 annual re-validation
    IFormTemplateService.cs          -- Form Template CRUD + approval (Contract 1)
    IFormTemplateRenderService.cs    -- single layout resolver (Contract 1)
    IFormTemplateSelectorService.cs  -- auto-select Form Template for sample (Contract 1)
    ISampleIdFormatService.cs        -- configurable format generation (Contract 2)
    IApprovalService.cs              -- single approval handler for Method/Spec/Template
  Infrastructure/BackgroundJobs/
    CalibrationDueDateJob.cs         -- IHostedService: daily OOC detection, SignalR push (Contract 2)
    TrainingExpiryJob.cs             -- IHostedService: daily expiry check, SignalR push (Contract 2)
```

---

## 10. API Endpoints

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `api/v1/test-methods` | All | Paginated list; filter by status/type |
| POST | `api/v1/test-methods` | Admin, QA | Create test method |
| PUT | `api/v1/test-methods/{id}` | Admin, QA | Edit — creates new version |
| POST | `api/v1/test-methods/{id}/approve` | QA | E-sig approve §11.50 |
| GET | `api/v1/test-methods/{id}/parameters` | All | Parameters for method |
| POST | `api/v1/test-methods/{id}/parameters` | Admin, QA | Add parameter (Contract 1: single definition) |
| GET | `api/v1/spec-limits` | All | List; filter by material/parameter/status |
| POST | `api/v1/spec-limits` | Admin, QA | Create spec limit |
| POST | `api/v1/spec-limits/{id}/approve` | QA | E-sig approve §11.50 |
| GET | `api/v1/form-templates` | All | List; filter by status/trigger type |
| POST | `api/v1/form-templates` | Admin, QA | Create form template (Contract 1) |
| POST | `api/v1/form-templates/{id}/approve` | QA | Activate with e-sig §11.50 |
| GET | `api/v1/training-records` | Admin, QA | User training records §11.10(i) |
| POST | `api/v1/training-records` | Admin | Record training with e-sig |
| GET | `api/v1/lab-config/{labId}` | Admin | Lab configuration incl. Sample ID format |
| PUT | `api/v1/lab-config/{labId}/sample-id-format` | Admin | Update Sample ID format (Contract 2) |
| GET | `api/v1/master-data/{entity}/{id}/audit` | Admin, QA | Full audit trail per entity |

---

## 11. State Transitions

| Entity | From | To | Trigger | Compliance |
|---|---|---|---|---|
| Spec Limit / Method / Form Template | (new) | Draft | Admin/QA creates record | ALCOA+ Contemporaneous |
| Spec Limit / Method / Form Template | Draft | Approved / Active | QA e-sig §11.50 | 21 CFR §11.50 |
| Spec Limit / Method / Form Template | Approved | Draft v+1 | Edit — version incremented; original archived | GMP / ICH Q10 |
| Spec Limit / Method / Form Template | Approved | Retired | Admin retires with reason; `is_active = FALSE` | ALCOA+ Enduring |
| Instrument | Available | OutOfCalibration | `CalibrationDueDateJob` (daily — Contract 2) | EU GMP Ch 6 |
| Instrument | OOC | Available | New calibration + QA e-sig approved | ISO 17025 |
| Training Record | Active | Expired | `TrainingExpiryJob` (daily — Contract 2); blocks test assignment | 21 CFR §11.10(i) |

---

## 12. Error Handling

| Scenario | HTTP | Error Code | Message |
|---|---|---|---|
| Approve with wrong password | 401 | `ESIGN_AUTH_FAILED` | Electronic signature failed — password incorrect. (21 CFR §11.300) |
| Edit approved spec limit | 409 | `SPEC_LIMIT_LOCKED` | Approved spec limit cannot be edited. Create a new version. |
| Analyst training expired | 422 | `TRAINING_EXPIRED` | Analyst training is not current. Registration blocked. (§11.10(i)) |
| No approved spec limit | 422 | `NO_APPROVED_SPEC` | No approved spec limit found for this parameter and material. |
| Deactivate entity with active links | 409 | `ENTITY_IN_USE` | Cannot deactivate — referenced by active samples or tests. |
| Form Template not active | 422 | `FORM_TEMPLATE_INACTIVE` | Form Template is not Active. QA approval required before use. |
| Dependency tier violation | 422 | `DEPENDENCY_NOT_MET` | Required upstream entity (e.g. Lab, Test Method) does not exist or is not approved. |

---

## 13. Audit & Compliance Summary

| Control | Detail |
|---|---|
| 21 CFR §11.50 | Every e-sig stores `full_name + signed_at UTC + meaning + reason`. All four immutable. Visible on CoA PDF and printed output. |
| 21 CFR §11.300 | `IElectronicSignatureService` verifies password independently of session token before accepting any signature. |
| 21 CFR §11.10(i) | `user_training_records` enforced. Expired training = hard block on test assignment. No override. |
| EU GMP Annex 11 §10 | `master_data_audit_logs` INSERT-only at DB level. Cannot be edited or deleted by any role. |
| EU GMP Annex 11 §12.4 | Annual periodic review via `IPeriodicReviewService`. Evidence in `validation_review_logs`. |
| EU GMP Annex 11 §7.1 | Daily encrypted backup. RPO ≤ 24 h, RTO ≤ 4 h. |
| ALCOA+ Consistent | `parameter_id` FK throughout — zero duplication. |
| ALCOA+ Enduring | `form_template_id` FK throughout — no form layout duplicated in any consuming module. |
| Contract 2 | Sample ID format from `lab_config` table — not hardcoded. `ISampleIdFormatService` generates server-side. |
