# PHARMA LIMS — Form Template (Phase 1c)
### Technical Design Document · v1.2 · CONFIDENTIAL
> **v1.0 — New Module:** Digital form layout engine · 4 trigger types · Grouped locations · 8-step approval lifecycle · `FormTemplateRenderService`
> **v1.1 Changes:** Field Designer — custom field layout (`field_definitions_json`) · 8 field types + Parameter linking · `PUT /api/v1/form-templates/{id}/fields`
> **v1.2 Changes:** Parameters & Locations management endpoints wired in UI — ⚙ Manage modal per template row for linking/unlinking parameters and locations.

---

## Document Metadata

| Field | Value |
|---|---|
| Module | Form Template (Phase 1c — New) |
| Depends On | Master Data v1.2, Parameters v1.1, Checkpoints v1.1 |
| Version | v1.2 |
| Status | Implemented · Live · May 2026 |
| Compliance | 21 CFR Part 11 · EU GMP Annex 11 · GMP · ALCOA+ · GAMP 5 |
| Governance | Contracts 1, 2, 4 — all clauses enforced |

---

## Governance Contracts

### Contract 1 — General Architecture
- **No code duplication.** Every business rule owned by exactly one named service class. FK-only references — no master data copied into consuming tables.
- **Single source of truth.** `digital_logbook_entries` drives Results Management, QA Review, CoA, and Traceability. No separate results store.
- **DB-portable.** Clean BE/FE/DB separation. No business logic in React or stored procedures.
- **No dead code.** Inactive records use soft-delete (`is_active = FALSE`). Never physically deleted.

### Contract 2 — Backend Services
- **All compute on server** (.NET Core 8). React renders — never computes.
- **All push via SignalR** from server. No polling — no `setInterval`, no repeated GET.
- **No hardcoded values.** Every threshold, timing, format from PostgreSQL.
- **Normalizer views** (`vw_*` prefix). Same view drives every UI panel.
- **UTC timestamps server-side** on all compliance records (ALCOA+ Contemporaneous).

### Contract 4 — Authentication & Access Control
- **Login page:** username · password · forgot-password link · remember-me checkbox — **all four mandatory.**
- **First run:** Tenant Admin creation before any other user or module access.
- **Two user types only:** Admin and Regular User. Roles are Regular User variants with explicit write grants.
- **Segregation of duties** enforced by system.

## 1. Purpose & Scope

A **Form Template** is the digital equivalent of a paper lab form. It defines: which parameters to test, in what layout, at which locations (columns), at what frequency, triggered by which event. **One Form Template is defined once in Master Data, QA-approved, and consumed by all downstream modules via FK.** No form layout is hardcoded — every form in the system is driven by a Form Template (Contracts 1 and 2). `FormTemplateRenderService` is the single layout resolver used by Testing Execution, Process Log, and Dispatch QC (Contract 1 — no duplicate rendering logic).

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR §11.50 | QA approval e-sig: `full_name + signed_at UTC + meaning + reason`. Draft → Active only after e-sig. |
| 21 CFR §11.10(e) | All create/update/approval actions audit-logged INSERT-only with old/new values. |
| ALCOA+ Consistent | `form_template_id` FK throughout — no form layout copied into any consuming module. |
| GMP / ICH Q10 | Version control on every edit. Previous version archived — never deleted. |
| EU Annex 11 §4.3 | All inputs validated server-side (FluentValidation + Zod). Prerequisites enforced before creation. |

---

## 3. What a Form Template Defines

| Element | Specification |
|---|---|
| Form ID | System-generated unique code (e.g. `LAB-F-10`). Configurable prefix per lab in `lab_config` (Contract 2). |
| Trigger Type | `TimeBased` \| `OperatorScan` \| `ProcessLog` \| `DispatchEvent` — from DB config (Contract 2). |
| Form Type | `Single` (one location column) or `Grouped` (multiple location columns with independent per-column `spec_limit_id` FK). |
| Frequency / Time Slots | Configurable schedule in `time_slots` JSONB — not hardcoded (Contract 2). |
| Parameters | Linked via `parameter_id` FK — no parameter name or formula copied (Contract 1). |
| Locations (Columns) | One row per location in `form_template_locations`. Each holds `spec_limit_id` FK — no spec values copied. |
| Regulatory Spec Tier | In-house and regulatory spec shown side-by-side on form and CoA. |
| Evidence Mandatory Flag | `evidence_mandatory`: overrides parameter default — requires evidence on all parameters for this form. |
| Field Designer | User-designed custom field layout stored as `field_definitions_json` JSON array. Supports Text, Number, Decimal, Dropdown, Date, DateTime, Checkbox, Textarea, and Parameter field types. |

---

## 4. Form Template Lifecycle — 8 Steps

| Step | Action | Rule |
|---|---|---|
| 1 | Go to Master Data → Form Templates → New | Admin or QA only (Contract 4) |
| 2 | Assign Form ID and name | Auto-generated from `lab_config` prefix (Contract 2 — no hardcoded format) |
| 3 | Choose trigger type | 4 modes from DB config — not hardcoded (Contract 2) |
| 4 | Add grouped locations | Each column: `spec_limit_id` FK — no spec values copied into form (Contract 1) |
| 5 | Add parameters | `parameter_id` FK — no parameter definition copied (Contract 1) |
| 6 | Set instrument type + evidence mandatory flag | From DB config (Contract 2) |
| 7 | Save as Draft → Submit to QA | `status = Draft`. No data entry possible on Draft form. |
| 8 | QA approves → Status = Active | §11.50 e-sig required. Form goes live on next trigger. |

> **Prerequisites enforced server-side by `FormTemplateValidatorService` (Contract 1):**
> Approved Test Method + Approved Spec Limit must exist before Form Template creation.

---

## 5. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | CRUD for Form Templates: Form ID, trigger type, time slots, form type — from DB config (Contract 2) | Admin/QA | Must Have | GMP |
| FR-02 | Parameters linked via `parameter_id` FK — no definition copied (Contract 1) | System | Must Have | Contract 1 |
| FR-03 | Grouped form locations: `spec_limit_id` FK — no spec values copied (Contract 1) | Admin/QA | Must Have | Contract 1 |
| FR-04 | QA approval: §11.50 e-sig. Status Draft → Active. Version-controlled. | QA | Must Have | 21 CFR §11.50 |
| FR-05 | Edit of Active form creates v+1 Draft; original archived — never deleted | System | Must Have | GMP / ICH Q10 |
| FR-06 | `FormTemplateRenderService` (Contract 1): single layout resolver for Testing Execution, Process Log, Dispatch QC | System | Must Have | Contract 1 |
| FR-07 | Prerequisite check: approved Test Method + Spec Limit must exist (`FormTemplateValidatorService` — Contract 1) | System | Must Have | ICH Q6A |
| FR-08 | `FormTemplateApprovalJob` (Contract 2): daily check — Active forms reference live params/specs | System | Must Have | Contract 2 |
| FR-09 | Retire with mandatory reason — no physical delete (ALCOA+ Enduring) | Admin/QA | Must Have | ALCOA+ Enduring |
| FR-10 | All actions audit-logged INSERT-only | System | Must Have | 21 CFR §11.10(e) |
| FR-11 | SignalR push on approval status change (Contract 2 — no polling) | System | Must Have | Contract 2 |
| FR-12 | Form Template auto-selected for new sample by `IFormTemplateSelectorService` (Contract 1) — no UI dropdown | System | Must Have | Contract 1 |
| FR-13 | Field Designer: Admin/QA can design a custom field layout for any template. Supports 8 field types + linked Parameters. Layout stored as `field_definitions_json` JSON in the template record. | Admin/QA | Must Have | Contract 1 |
| FR-14 | Parameters & Locations management: Admin/QA can link/unlink parameters (`POST/DELETE /form-templates/{id}/parameters/{pid}`) and storage locations (`POST/DELETE /form-templates/{id}/locations/{lid}`) to a template via the ⚙ Manage modal. Changes reflected immediately. All actions audit-logged INSERT-only (Contract 1). | Admin/QA | Must Have | Contract 1 |

---

## 6. Data Model (PostgreSQL 16)

```sql
CREATE TABLE form_templates (
  form_template_id   SERIAL PRIMARY KEY,
  form_code          VARCHAR(50)  NOT NULL UNIQUE,
  form_name          VARCHAR(200) NOT NULL,
  lab_id             INT NOT NULL REFERENCES laboratories(lab_id),
  form_type          VARCHAR(20)  NOT NULL DEFAULT 'Single',  -- Single | Grouped
  trigger_type       VARCHAR(30)  NOT NULL,
  time_slots         JSONB,           -- from DB config (Contract 2 -- never hardcoded)
  shift_interval_hrs INT,
  regulatory_tier    VARCHAR(100),
  evidence_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  field_definitions_json TEXT,           -- JSON array of custom field definitions (nullable)
  status             VARCHAR(20)  NOT NULL DEFAULT 'Draft',
  version            VARCHAR(10)  NOT NULL DEFAULT '1.0',
  signature_id       INT REFERENCES electronic_signatures(signature_id),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by         VARCHAR(100) NOT NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Per-column locations (Grouped forms) -- FK only (Contract 1)
CREATE TABLE form_template_locations (
  location_id        SERIAL PRIMARY KEY,
  form_template_id   INT NOT NULL REFERENCES form_templates(form_template_id),
  column_order       INT NOT NULL,
  location_name      VARCHAR(200) NOT NULL,
  spec_limit_id      INT REFERENCES spec_limits(spec_limit_id)
);

-- Parameters on form -- FK only (Contract 1)
CREATE TABLE form_template_parameters (
  form_template_id  INT NOT NULL REFERENCES form_templates(form_template_id),
  parameter_id      INT NOT NULL REFERENCES test_method_parameters(parameter_id),
  display_order     INT NOT NULL,
  column_frequency  VARCHAR(20),  -- Daily | Weekly | Periodic
  UNIQUE(form_template_id, parameter_id)
);
```

---

## 7. State Transitions

| Entity | From | To | Trigger | Compliance |
|---|---|---|---|---|
| Form Template | (new) | Draft | Admin/QA creates record | ALCOA+ Contemporaneous |
| Form Template | Draft | Active | QA §11.50 e-sig approval | 21 CFR §11.50 |
| Form Template | Active | Draft v+1 | Edit — version incremented; original archived | GMP / ICH Q10 |
| Form Template | Active | Retired | Admin retires with reason; `is_active = FALSE` | ALCOA+ Enduring |

---

## 8. Field Designer

The Field Designer allows Admin/QA users to define a custom field layout for any Form Template directly from the UI.

| Capability | Detail |
|---|---|
| Access | "Design Fields" button on every Form Template row |
| Field Types | Text, Number, Decimal, Dropdown, Date, DateTime, Checkbox, Textarea, Parameter |
| Parameter Linking | Parameters from the master data Parameters list can be added directly — linked by `parameter_id` FK |
| Field Properties | Label, Unit (numeric/parameter), Options (dropdown, comma-separated), Required/Optional toggle |
| Reordering | Up/Down reorder controls on each field row |
| Storage | `field_definitions_json` TEXT column on `form_templates` — JSON array of `FieldDef` objects |
| API | `PUT /api/v1/form-templates/{id}/fields` — saves JSON layout; returns field count |
| Compliance | Layout changes are soft — editing a template resets status to Draft (existing v+1 rule applies) |

---

## 9. Parameters & Locations Management (New v1.2)

The **⚙ Manage** button on every Form Template row opens a management modal for linking master-data Parameters and Storage Locations to the template.

| Feature | Detail |
|---|---|
| Access | "⚙ Manage" button on every Form Template row in the master data table |
| Parameters tab | Lists all currently linked parameters (Code / Name / UOM / Remove). Dropdown of unlinked parameters with Add button. Each Add/Remove calls `POST/DELETE /api/v1/form-templates/{id}/parameters/{parameterId}` immediately — no batch save needed. |
| Locations tab | Lists all currently linked storage locations (Code / Name / Remove). Dropdown of unlinked storage locations with Add button. Each Add/Remove calls `POST/DELETE /api/v1/form-templates/{id}/locations/{locationId}` immediately. |
| Compliance | All link/unlink actions audit-logged INSERT-only per Contract 1. `locationCount` and `parameterCount` on the template record updated server-side on each change. |
| API | `GET /api/v1/form-templates/{id}/parameters` → linked params list<br/>`POST /api/v1/form-templates/{id}/parameters/{parameterId}` → link<br/>`DELETE /api/v1/form-templates/{id}/parameters/{parameterId}` → unlink<br/>`GET /api/v1/form-templates/{id}/locations` → linked locations list<br/>`POST /api/v1/form-templates/{id}/locations/{locationId}` → link<br/>`DELETE /api/v1/form-templates/{id}/locations/{locationId}` → unlink |

---

## Audit & Compliance Summary

| Standard | Control |
|---|---|
| **21 CFR §11.50** | Every e-sig: `full_name + signed_at UTC + meaning + reason`. All four fields immutable after capture. |
| **21 CFR §11.300** | Password verified independently of session token before any signature. |
| **21 CFR §11.10(e)** | All audit logs INSERT-only at DB level. Old/new values captured on every change. |
| **EU GMP Annex 11 §10** | Audit trail immutable, computer-generated, date/time-stamped. |
| **EU GMP Annex 11 §7.1** | Daily encrypted backup. RPO <= 24 h, RTO <= 4 h. |
| **ALCOA+ Enduring** | Soft-delete only. INSERT-only audit logs. No hard delete. |
| **Contract 1** | Single-service ownership. FK-only references. No duplication. |
| **Contract 2** | All compute server-side. All push via SignalR. No hardcoded values. |
| **Contract 4** | Login: 4 elements mandatory. Tenant Admin first-run. Segregation of duties. |

