# PHARMA LIMS — CoA Generation (Phase 9)
### Technical Design Document · v1.0 · CONFIDENTIAL
> **v1.0 — New Module:** Template-driven auto-population · DO header fields · 3 e-signatures embedded in PDF · PDF lock server-side · ERP archive

---

## Document Metadata

| Field | Value |
|---|---|
| Module | CoA Generation (Phase 9) |
| Depends On | Results Management v1.2, QA Review v1.2, Dispatch QC v1.0 |
| Version | v1.0 |
| Status | Draft · May 2026 |
| Compliance | 21 CFR Part 11 · EU GMP Annex 11 · GMP · ALCOA+ · GAMP 5 |
| Governance | Contracts 1, 2, 4 — all clauses enforced |

---

## Governance Contracts

**Contract 1:** `CoAGenerationService` is the single CoA builder. `CoAHeaderService` resolves all header fields server-side. `CoADistributionService` is the single sender — no duplicate distribution path. Results consolidated from `digital_logbook_entries` — no separate results store. Re-issue creates new CoA with `superseded_by` FK — original preserved (ALCOA+ Enduring).

**Contract 2:** CoA PDF generated and locked server-side (.NET Core 8). QA `approved_at` timestamp = UTC server-side — no client-supplied timestamp. CoA header auto-populated from product master + DO — no manual transcription by analyst. CoA No. from configurable format in `lab_config` — not hardcoded.

**Contract 4:** QA only: approve and lock CoA (§11.50 e-sig required). Admin: view all CoAs, trigger archive, re-issue with new QA e-sig. Analyst: view only. QC Lead: verified results only — cannot approve CoA independently.

---

## 1. Purpose & Scope

The **Certificate of Analysis (CoA)** is the official release document and the primary GMP record sent to customers. Auto-generated from Form Template + Digital Logbook + Delivery Order — **no manual transcription** (Contracts 1 and 2). Three e-signatures embedded in locked PDF (QC Analyst, QC Lead, QA — §11.50 compliant). PDF locked after QA sign-off, distributed to ERP and archive. All CoA data comes from FK joins to master tables — no data copies.

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR §11.50 | 3 e-sigs embedded in PDF: `full_name + signed_at UTC + meaning`. Visible on print without system access. |
| 21 CFR 211.194 | CoA auto-populated from logbook rows + product master + DO — no manual transcription (Contract 1). |
| EU Annex 11 §11 | CoA PDF human-readable without system access. All §11.50 fields on print. |
| EU Annex 11 §7.1 | CoA archived >= shelf life + 1 year. Retention from DB config (Contract 2). |
| ALCOA+ Enduring | Re-issue: new CoA with `superseded_by` FK — original never deleted. |

---

## 3. CoA Header — All Fields Auto-Populated

`CoAHeaderService` (Contract 1) resolves all fields server-side. No analyst manually types header values.

| CoA Header Field | Source | Notes |
|---|---|---|
| Product Name | `samples → materials.material_name` FK | Auto-populated. |
| Batch / Lot No. | `samples.lot_number` | From Material Receipt step. |
| Manufacturing Date | `samples.mfg_date` | From Material Receipt. |
| Expiry Date | `materials.shelf_life_days` + MFG date | Calculated server-side (Contract 2). |
| Customer | `delivery_orders.customer_name` FK | Auto-populated when DO linked. |
| Despatch Date | `delivery_orders.despatch_date` FK | From DO. |
| DO No. | `delivery_orders.do_number` FK | DO reference number. |
| Packing Type | `delivery_orders.packing_type` FK | From DO. |
| CoA No. | System-generated | Configurable format from `lab_config` (Contract 2). |
| Date of Issue | QA approval `signed_at UTC` (Contract 2) | Set at QA approval — never manually entered. |

---

## 4. CoA Body — Per-Test Result Lines

| Column | Source |
|---|---|
| Test / Parameter Name | `test_method_parameters.parameter_name` FK (Contract 1 — read from master, not copied) |
| Method Reference | `test_methods.method_code` FK |
| In-House Spec (Min/Max) | `digital_logbook_entries.spec_min_snapshot / spec_max_snapshot` — immutable snapshot at test time |
| Regulatory Spec | `digital_logbook_entries.regulatory_tier_snapshot` — snapshot at test time |
| Result | `digital_logbook_entries.calculated_result` — server-computed (Contract 2) |
| Pass / Fail | `digital_logbook_entries.pass_fail` — server-determined |
| Analyst | `digital_logbook_entries.analyst_id → users.full_name` — ALCOA+ Attributable |

---

## 5. CoA Authorisation — 3 E-Signatures Embedded in PDF

| Signer | Role | Meaning Embedded in PDF |
|---|---|---|
| QC Analyst | Analyst who performed test | "I certify the test results are accurate and complete." |
| QC Lead | QC Lead who verified results | "I have reviewed and verified all test results." |
| QA | QA who approved release | "I approve the release of this batch. This CoA is accurate." |

All three: `full_name + signed_at UTC + meaning` embedded in locked PDF body (§11.50). Human-readable on print without system access (EU Annex 11 §11).

---

## 6. CoA Generation Flow

| Step | Event | Rule |
|---|---|---|
| 1 | All tests complete + QC Lead e-sig | `CoAGenerationService` (Contract 1) auto-generates CoA Draft. `vw_coa_preview` populated. |
| 2 | QA reviews CoA draft | Read-only via `vw_coa_preview` (Contract 2 normalizer — same data as PDF generation). |
| 3 | QA §11.50 e-sig approval | CoA PDF generated + locked server-side atomically. Status → RELEASED. `CoADistributionService` triggered (Contract 1). |
| 4 | Distribution | `CoADistributionService`: ERP update + archive. INSERT-only distribution log. |

---

## 7. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | CoA auto-generated by `CoAGenerationService` on QC Lead e-sig (Contract 1 — single trigger) | System | Must Have | 21 CFR 211.194 |
| FR-02 | CoA header auto-populated from product master + DO — no manual entry (`CoAHeaderService` — Contract 1) | System | Must Have | 21 CFR 211.194 |
| FR-03 | CoA body from `digital_logbook_entries` FK join — no re-entry (Contract 1) | System | Must Have | ALCOA+ Original |
| FR-04 | Both in-house and regulatory spec shown on every CoA line | System | Must Have | ICH Q6A |
| FR-05 | 3 e-sigs embedded in PDF body — §11.50 compliant | System | Must Have | 21 CFR §11.50 |
| FR-06 | CoA PDF generated + locked server-side atomically on QA approval (Contract 2) | System | Must Have | Contract 2 |
| FR-07 | PDF human-readable without system access — §11.50 fields on print (EU Annex 11 §11) | System | Must Have | EU Annex 11 §11 |
| FR-08 | CoA No. from configurable format in `lab_config` (Contract 2) | System | Must Have | Contract 2 |
| FR-09 | `CoADistributionService` (Contract 1 — single call): ERP update + archive on QA approval | System | Must Have | GMP |
| FR-10 | Retention: CoA archived >= shelf life + 1 year from DB config (Contract 2) | System | Must Have | EU Annex 11 §7.1 |
| FR-11 | Re-issue: new QA §11.50 e-sig required. New CoA with `superseded_by` FK — original retained. | QA | Must Have | ALCOA+ Enduring |
| FR-12 | `vw_coa_preview` normalizer (Contract 2): same data in QA review panel and PDF — no per-screen recalculation | System | Must Have | Contract 2 |

---

## 8. Data Model (PostgreSQL 16)

```sql
CREATE TABLE coas (
  coa_id             SERIAL PRIMARY KEY,
  sample_id          INT NOT NULL REFERENCES samples(sample_id),
  coa_number         VARCHAR(100) NOT NULL UNIQUE,
  form_template_id   INT NOT NULL REFERENCES form_templates(form_template_id),
  delivery_order_id  INT REFERENCES delivery_orders(do_id),
  status             VARCHAR(20) NOT NULL DEFAULT 'Draft',
  -- Draft | Released | Superseded
  locked_at          TIMESTAMPTZ,
  pdf_blob           BYTEA,              -- server-generated locked PDF
  qa_signature_id    INT REFERENCES electronic_signatures(signature_id),
  superseded_by      INT REFERENCES coas(coa_id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE coa_lines (
  coa_line_id        SERIAL PRIMARY KEY,
  coa_id             INT NOT NULL REFERENCES coas(coa_id),
  entry_id           INT NOT NULL REFERENCES digital_logbook_entries(entry_id),
  parameter_id       INT NOT NULL REFERENCES test_method_parameters(parameter_id),
  display_order      INT NOT NULL
);

CREATE TABLE coa_distribution_log (
  log_id        BIGSERIAL PRIMARY KEY,
  coa_id        INT NOT NULL REFERENCES coas(coa_id),
  channel       VARCHAR(50) NOT NULL,  -- ERP | Archive | Email
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        VARCHAR(20) NOT NULL   -- Sent | Failed
);
```

---

## 9. State Transitions

| Entity | From | To | Trigger | Compliance |
|---|---|---|---|---|
| CoA | Draft | Released | QA §11.50 e-sig; PDF locked atomically | 21 CFR §11.50 |
| CoA | Released | Superseded | Re-issue with new QA e-sig; new CoA created | ALCOA+ Enduring |
| Distribution | Released | Sent | `CoADistributionService` fires — ERP + Archive | Contract 1 |

---

## Audit & Compliance Summary

| Standard | Control |
|---|---|
| **21 CFR §11.50** | Every e-sig: `full_name + signed_at UTC + meaning + reason`. Immutable. Embedded in PDF. |
| **21 CFR §11.300** | Password verified independently of session token. |
| **21 CFR §11.10(e)** | All audit logs INSERT-only. Old/new values captured. |
| **EU GMP Annex 11 §7.1** | Daily encrypted backup. RPO <= 24 h, RTO <= 4 h. |
| **ALCOA+ Enduring** | Soft-delete only. No hard delete. |
| **Contract 1** | Single-service ownership. FK-only references. No duplication. |
| **Contract 2** | All compute server-side. All push via SignalR. No hardcoded values. |

