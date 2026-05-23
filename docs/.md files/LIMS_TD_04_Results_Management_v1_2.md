# PHARMA LIMS — Results Management (Phase 4)
### Technical Design Document · v1.2 · CONFIDENTIAL
> **v1.2 Changes:** CoA header DO fields (Customer · Despatch Date · DO No. · Packing) auto-populated · Evidence attachment step · ERP distribution trigger on QA approval

---

## Document Metadata

| Field | Value |
|---|---|
| Module | Results Management (Phase 4) |
| Depends On | Testing Execution v1.2, Digital Logbook v1.1 |
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

Results Management consolidates Digital Logbook rows into a draft CoA. **4-eyes principle**: analyst generates, peer verifies, QC Lead approves (segregation enforced by `user_id` equality checks at API level — not just role). v1.2 adds: **CoA header auto-populated from Delivery Order** (Customer, Despatch Date, DO No., Packing type, CoA No.) via `CoAHeaderService` (Contract 1 — no manual transcription); **evidence attachment step** before QC Lead verification (mandatory for critical parameters); **ERP distribution trigger** on QA approval via `ERPIntegrationService` (Contract 1 — single call, no duplicate).

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR §11.50 | CoA PDF embeds for each signer: `full_name + signed_at UTC + meaning`. Visible on printed output without system access. |
| 21 CFR §11.10(e) | All review actions audit-logged INSERT-only. |
| 21 CFR 211.194 | CoA auto-populated from logbook rows — no manual transcription. CoA header from DO — no manual entry (Contract 1). |
| EU Annex 11 §11 | CoA PDF human-readable without system access — all §11.50 fields visible on print. |
| ALCOA+ 4-Eyes | `user_id` equality enforced at API level in `ResultsReviewService` (Contract 1 — not just role check). |
| GMP — ERP link | Release status change triggers material availability in ERP (`ERPIntegrationService` — Contract 1). |

---

## 3. CoA Header — Full Field Specification

All CoA header fields are auto-populated server-side by `CoAHeaderService` (Contract 1). No analyst manually types header values.

| CoA Header Field | Source | Rule |
|---|---|---|
| Product Name | `samples → materials.material_name` FK | Auto-populated. |
| Batch No. | `samples.lot_number` | From Material Receipt step. |
| Manufacturing Date | `samples.mfg_date` | From Material Receipt. |
| Expiry Date | `materials.shelf_life_days` + MFG date | Calculated server-side (Contract 2). |
| **Customer** | `delivery_orders.customer_name` FK | **Auto-populated when DO linked. NEW v1.2** |
| **Despatch Date** | `delivery_orders.despatch_date` FK | **From DO — auto-populated. NEW v1.2** |
| **DO No.** | `delivery_orders.do_number` FK | **DO reference number — auto-populated. NEW v1.2** |
| **Packing Type** | `delivery_orders.packing_type` FK | **Container/packing from DO. NEW v1.2** |
| **CoA No.** | System-generated | **Unique CoA number from configurable format in `lab_config` (Contract 2). NEW v1.2** |
| Analyst e-sig | `electronic_signatures` FK | Full name + date/time UTC + meaning (§11.50). |
| QC Lead e-sig | `electronic_signatures` FK | Full name + date/time UTC + meaning (§11.50). |
| QA e-sig | `electronic_signatures` FK | Full name + date/time UTC + meaning (§11.50). |

---

## 4. Results Management Workflow — 7 Steps

| Step | Name | What Happens | Key Rule | Actor |
|---|---|---|---|---|
| 1 | Trigger | All logbook rows Signed event from `DigitalLogbookService` (Contract 1). Sample moves to Results queue. | Auto-trigger — no manual action | System |
| 2 | Peer Review | Second analyst reviews all logbook rows and raw data. §11.50 e-sig required. | `user_id != original analyst` enforced at API (`ResultsReviewService` — Contract 1) | 2nd Analyst |
| **3** | **Link Evidence** | **Evidence files (instrument output, worksheets, photos) attached. Mandatory for critical parameters. NEW v1.2** | Audit-ready documentation. Mandatory before Step 4. | Analyst/Peer |
| 4 | QC Lead Verification | QC Lead e-signs §11.50. Results immutable after this signature. | `user_id != analyst AND != peer` enforced at API (Contract 1). Hard segregation of duties. | QC Lead |
| 5 | Generate CoA Draft | CoA auto-populated: logbook rows + product master + DO. Header fields all auto-filled. | Template driven. `CoAHeaderService` resolves all header values (Contract 1 — no manual entry). | System |
| 6 | QA Final Review | QA reviews consolidated results + CoA draft. Last gate before release. | OOS gate — hard block if any OOS open (`QAReviewGateService` — Contract 1). | QA |
| **7** | **Release + ERP** | **Status → Released. CoA PDF locked. `ERPIntegrationService` triggers material availability in ERP. NEW v1.2** | Single call (Contract 1 — no duplicate distribution). | System |

---

## 5. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | Trigger: all logbook rows Signed event (`DigitalLogbookService` — Contract 1). No manual trigger. | System | Must Have | GMP |
| FR-02 | Peer review: second analyst reviews logbook rows (§11.50 e-sig) | 2nd Analyst | Must Have | 21 CFR §11.50 |
| FR-03 | `user_id` equality: peer != original analyst (`ResultsReviewService` — Contract 1, not just role) | System | Must Have | GMP 4-eyes |
| FR-04 | QC Lead verification §11.50 e-sig | QC Lead | Must Have | 21 CFR §11.50 |
| FR-05 | `user_id` equality: QC Lead != analyst and != peer (Contract 1 — `ResultsReviewService`) | System | Must Have | GMP 4-eyes |
| FR-06 | Results immutable after QC Lead e-sig (ALCOA+ Enduring) | System | Must Have | ALCOA+ Enduring |
| FR-07 | OOS gate: blocked if any OOS Open (`QAReviewGateService` — Contract 1) | System | Must Have | FDA OOS Guidance |
| FR-08 | CoA generated from logbook rows + product master server-side (Contract 2) | System | Must Have | 21 CFR 211.194 |
| FR-09 | CoA PDF embeds: `full_name + date/time UTC + meaning` for all three signers (§11.50) | System | Must Have | 21 CFR §11.50 |
| FR-10 | CoA PDF human-readable without system access (EU Annex 11 §11) | System | Must Have | EU Annex 11 §11 |
| FR-11 | SignalR push on review completion (Contract 2 — no polling) | System | Must Have | Contract 2 |
| FR-12 | Login: forgot-password + remember-me; Tenant Admin first run (Contract 4) | System | Must Have | Contract 4 |
| **FR-13** | **CoA header auto-populated from DO: Customer, Despatch Date, DO No., Packing, CoA No. — `CoAHeaderService` (Contract 1). No manual entry.** | System | Must Have | 21 CFR 211.194 |
| **FR-14** | **Evidence attachment step before QC Lead verification: mandatory for critical parameters.** | Analyst/Peer | Must Have | GMP / GAMP 5 |
| **FR-15** | **ERP distribution trigger on QA approval: `ERPIntegrationService` (Contract 1 — single call, no duplicate).** | System | Must Have | GMP — ERP |

---

## 6. Data Model

```sql
CREATE TABLE results_reviews (
  review_id      SERIAL PRIMARY KEY,
  sample_id      INT NOT NULL REFERENCES samples(sample_id),
  review_type    VARCHAR(20) NOT NULL,  -- PeerReview | QCLeadVerification
  reviewer_id    INT NOT NULL REFERENCES users(user_id),
  signature_id   INT NOT NULL REFERENCES electronic_signatures(signature_id),
  reviewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE result_evidence (
  evidence_id    SERIAL PRIMARY KEY,
  sample_id      INT NOT NULL REFERENCES samples(sample_id),
  entry_id       INT NOT NULL REFERENCES digital_logbook_entries(entry_id),
  file_ref       VARCHAR(500) NOT NULL,
  uploaded_by    INT NOT NULL REFERENCES users(user_id),
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE delivery_orders (
  do_id          SERIAL PRIMARY KEY,
  do_number      VARCHAR(100) NOT NULL UNIQUE,
  customer_name  VARCHAR(200),
  despatch_date  DATE,
  packing_type   VARCHAR(100),
  product_id     INT REFERENCES materials(material_id)
);
```

---

## 7. State Transitions

| Entity | From | To | Trigger | Compliance |
|---|---|---|---|---|
| Sample | In Testing | Pending Results Review | All logbook rows Signed | ALCOA+ Enduring |
| Sample | Pending Review | Peer Reviewed | 2nd analyst §11.50 e-sig | 21 CFR §11.50 |
| Sample | Peer Reviewed | QC Lead Verified | QC Lead §11.50 e-sig; results immutable | 21 CFR §11.50 |
| Sample | QC Lead Verified | QA Approved + Released | QA §11.50 e-sig; PDF locked; ERP trigger | 21 CFR §11.50 |
| Sample | Pending Review | Blocked | Any open OOS investigation (`QAReviewGateService`) | FDA OOS Guidance |

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

