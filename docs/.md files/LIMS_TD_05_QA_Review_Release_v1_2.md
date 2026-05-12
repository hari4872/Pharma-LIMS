# PHARMA LIMS — QA Review & Release (Phase 5)
### Technical Design Document · v1.2 · CONFIDENTIAL
> **v1.2 Changes:** Explicit 10-item CoA validation checklist · OOT gate configurable · Evidence attachment check (checklist item 8) · Rejection INSERT-only at DB

---

## Document Metadata

| Field | Value |
|---|---|
| Module | QA Review & Release (Phase 5) |
| Depends On | Results Management v1.2 |
| Version | v1.2 |
| Status | Draft · May 2026 |
| Compliance | 21 CFR Part 11 · EU GMP Annex 11 · GMP · ALCOA+ · GAMP 5 |
| Governance | Contracts 1, 2, 4 — all clauses enforced |

---

## Governance Contracts

### Contract 1 — General Architecture
- No code duplication. FK-only references. Single service per concern.
- `digital_logbook_entries` is the single results source for all downstream modules.
- DB-portable. Clean BE/FE/DB separation. No business logic in React or stored procedures.
- No dead code. Soft-delete only. Never physically deleted.

### Contract 2 — Backend Services
- All compute server-side. React renders only — never computes.
- All push via SignalR. No polling. No hardcoded values.
- Normalizer views (`vw_*`). Same view drives every UI panel.
- UTC timestamps server-side on all compliance records.

### Contract 4 — Authentication & Access Control
- Login page: username · password · forgot-password · remember-me — all four mandatory.
- First run: Tenant Admin creation before any other access.
- CRUD role model. Regular User view-only by default. Explicit write grants required.
- Segregation of duties enforced by system.

## 1. Purpose & Scope

QA Review is the **final quality gate**. QA has read-only visibility of all results, Digital Logbook entries, and CoA. Every open OOS is a hard block (`QAReviewGateService` — Contract 1). v1.2 specifies **10 explicit CoA validation checklist items** computed server-side by `vw_qa_checklist` (Contract 2 normalizer — same value in checklist panel and audit log). Approve locks CoA PDF atomically with §11.50 manifestation embedded. Rejection permanently immutable at DB level (Annex 11 §13 — INSERT-only, DB trigger prevents UPDATE).

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR §11.50 | CoA PDF embeds: `full_name + signed_at UTC + meaning` for all three signers. Visible on printed output. |
| 21 CFR §11.300 | Password re-entry required independent of session token. |
| 21 CFR 211.192 | QA verifies: all steps complete, all OOS resolved, all signatures present, correct spec version used. |
| EU Annex 11 §7.1 | Locked CoA archived. Retention >= shelf life + 1 year from DB config. |
| EU Annex 11 §13 | Rejection reason INSERT-only at DB. DB trigger prevents UPDATE. Immutable even after DB restore. |

---

## 3. CoA Validation Checklist — 10 Explicit Items

Computed by `vw_qa_checklist` server-side (Contract 2). QA cannot approve until all 10 items pass. Same computed value shown in checklist panel and logged in audit trail — no per-screen recalculation (Contract 2).

| # | Checklist Item | Pass Condition | Compliance |
|---|---|---|---|
| 1 | All test steps complete | Every `test_executions` row for this sample has `status = Completed` | GMP / 21 CFR 211.192 |
| 2 | No open OOS investigations | `oos_investigations`: zero rows with `status = Open` for this sample | FDA OOS Guidance 2006 |
| 3 | No open OOT investigations *(if OOT gate enabled)* | `oos_investigations (flag_type = OOT)`: zero Open rows where gate enabled in DB config | GMP trending / Contract 2 |
| 4 | Analyst e-sig on all Digital Logbook rows | Every `digital_logbook_entries` row: `signature_id NOT NULL` and `status = Signed` | 21 CFR §11.50 |
| 5 | Peer review e-sig present | `results_reviews (review_type = PeerReview)`: `signature_id NOT NULL` | GMP 4-eyes |
| 6 | QC Lead verification e-sig present | `results_reviews (review_type = QCLeadVerification)`: `signature_id NOT NULL` | 21 CFR §11.50 |
| 7 | Correct approved spec version used | `spec_limit_id` on each logbook row matches current approved version in `spec_limits` | ICH Q6A |
| **8** | **All required evidence attachments present** | **Every logbook row where `is_critical = TRUE` has `evidence_file_ref NOT NULL`** | **GMP / GAMP 5 — NEW v1.2** |
| 9 | CoA header fully populated | Customer, DO No., Despatch Date, CoA No. all NOT NULL (if DO linked) | 21 CFR 211.194 |
| 10 | CoA body complete | All `coa_lines` have `result NOT NULL` — no blank result fields | 21 CFR 211.194 |

---

## 4. QA Review Steps

| Step | What Happens | Rule |
|---|---|---|
| 1 | Sample auto-arrives in QA queue | SignalR push (Contract 2 — no polling) |
| 2 | QA opens read-only view of all results + logbook + peer/QC Lead signatures | Contract 4: QA role — read-only at result level |
| 3 | `QAReviewGateService` checks OOS gate | Hard block on any open OOS. No override possible. |
| 4 | `vw_qa_checklist` evaluates all 10 items | All 10 must pass before Approve is enabled (server enforced) |
| 5 | **APPROVE**: QA §11.50 e-sig → PDF locked atomically | PDF + `status = Released` + `signature_id` in one DB transaction (Contract 1). `CoADistributionService` fires. |
| 6 | **REJECT**: mandatory justification + §11.50 e-sig | INSERT-only. DB trigger prevents UPDATE — immutable even after DB restore (EU Annex 11 §13). |
| 7 | All decisions audit-logged INSERT-only | Who / when / decision / justification. |

---

## 5. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | Sample arrives in QA queue via SignalR (Contract 2 — no polling) | System | Must Have | GMP |
| FR-02 | QA read-only view of results + logbook + all signatures (Contract 4) | QA | Must Have | GMP |
| FR-03 | OOS hard gate: `QAReviewGateService` (Contract 1 — single centralised check) | System | Must Have | FDA OOS Guidance |
| FR-04 | CoA checklist: `vw_qa_checklist` (Contract 2 normalizer) — 10 explicit pass criteria | System | Must Have | 21 CFR 211.192 |
| FR-05 | QA Approve: §11.50 e-sig: full name + date/time + meaning | QA | Must Have | 21 CFR §11.50 |
| FR-06 | CoA PDF locked atomically: PDF + status + `signature_id` in one DB transaction (Contract 1) | System | Must Have | EU Annex 11 §13 |
| FR-07 | §11.50 manifestation embedded in locked PDF body (not only DB) | System | Must Have | 21 CFR §11.50 |
| FR-08 | CoA archived: retention >= shelf life + 1 year from DB config (Contract 2) | System | Must Have | EU Annex 11 §7.1 |
| FR-09 | QA Reject: mandatory justification + §11.50 e-sig. INSERT-only record — DB trigger prevents UPDATE. | QA | Must Have | EU Annex 11 §13 |
| **FR-10** | **OOT gate: configurable per product type in DB config (Contract 2 — not hardcoded). When enabled: open OOT blocks QA approval identically to OOS.** | System | Must Have | Contract 2 |
| **FR-11** | **Checklist item 8: `QAReviewGateService` checks `is_critical` logbook rows for `evidence_file_ref NOT NULL`.** | System | Must Have | GMP / GAMP 5 |

---

## 6. Data Model

```sql
CREATE TABLE coa_approvals (
  approval_id    SERIAL PRIMARY KEY,
  sample_id      INT NOT NULL REFERENCES samples(sample_id),
  coa_id         INT NOT NULL REFERENCES coas(coa_id),
  decision       VARCHAR(10) NOT NULL,  -- Approved | Rejected
  justification  TEXT,                  -- required for Rejected; INSERT-only
  signature_id   INT NOT NULL REFERENCES electronic_signatures(signature_id),
  decided_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- DB trigger prevents UPDATE on this table (EU Annex 11 §13)

CREATE TABLE coas (
  coa_id             SERIAL PRIMARY KEY,
  sample_id          INT NOT NULL REFERENCES samples(sample_id),
  coa_number         VARCHAR(100) NOT NULL UNIQUE,
  form_template_id   INT NOT NULL REFERENCES form_templates(form_template_id),
  delivery_order_id  INT REFERENCES delivery_orders(do_id),
  status             VARCHAR(20) NOT NULL DEFAULT 'Draft',
  locked_at          TIMESTAMPTZ,
  pdf_blob           BYTEA,
  qa_signature_id    INT REFERENCES electronic_signatures(signature_id),
  superseded_by      INT REFERENCES coas(coa_id)
);
```

---

## 7. State Transitions

| Entity | From | To | Trigger | Compliance |
|---|---|---|---|---|
| Sample | Pending QA Review | Approved / Released | QA §11.50 e-sig; all 10 checklist items pass | 21 CFR §11.50 |
| Sample | Pending QA Review | Rejected | QA §11.50 e-sig + justification; INSERT-only | EU Annex 11 §13 |
| CoA PDF | Draft | Locked | QA approval — atomically in same transaction | Contract 1 |
| OOS Gate | Open | Cleared | OOS investigation closed with root cause + CAPA | FDA OOS Guidance |

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

