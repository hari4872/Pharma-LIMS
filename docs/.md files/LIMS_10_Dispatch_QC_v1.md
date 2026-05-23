# PHARMA LIMS — Dispatch QC (Phase 10)
### Technical Design Document · v1.0 · CONFIDENTIAL
> **v1.0 — New Module:** DO-triggered outgoing QC · Configurable test set per product type · CoA header auto-populated from DO · CLEARED / BLOCKED status

---

## Document Metadata

| Field | Value |
|---|---|
| Module | Dispatch QC (Phase 10) |
| Depends On | Master Data v1.2, Checkpoints v1.1, Sample Registration v1.2, CoA Generation v1.0 |
| Version | v1.0 |
| Status | Implemented · Live · May 2026 |
| Compliance | 21 CFR Part 11 · EU GMP Annex 11 · GMP · ALCOA+ · GAMP 5 |
| Governance | Contracts 1, 2, 4 — all clauses enforced |

---

## Governance Contracts

**Contract 1:** `DispatchEventService` is the single DO→task creator. `DispatchStatusService` is the single CLEARED/BLOCKED setter. `OOSDetectionService` (Contract 1 — same service as in-batch): no duplicate OOS detection. `CoAHeaderService` auto-populates DO fields on CoA header — single call. Full traceability: `delivery_orders → samples → test_executions → digital_logbook_entries → coas` FK chain.

**Contract 2:** DO reception from ERP auto-push or manual entry — both through same `DispatchEventService` (Contract 1). CLEARED status set server-side on sign-off + QA approval. Test set (Form Template) configurable per product type in Master Data — not hardcoded.

**Contract 4:** Admin: create DO manually. QA: approve Dispatch QC result + issue CLEARED. Analyst: execute Dispatch QC test. No bypass of BLOCKED status by any role.

---

## 1. Purpose & Scope

**Dispatch QC** = final outgoing quality check on finished product before leaving site. Triggered by a **Delivery Order (DO)** — ERP auto-push or manual entry. Test set is fully **configurable per product type** in Master Data (Form Template with `trigger_type = DispatchEvent` — no hardcoded tests). Pass → product **CLEARED** for dispatch. Fail → **BLOCKED** + OOS investigation mandatory. CoA header auto-populated from DO by `CoAHeaderService` (Contract 1).

> **Incoming QC vs Dispatch QC:** Incoming = material received from supplier, tested before use. Outgoing = finished product checked before leaving site. Both use same execution workflow — they differ in trigger type and status output.

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR §11.50 | Dispatch QC test sign-off e-sig + QA release e-sig: `full_name + signed_at UTC + meaning + reason`. |
| 21 CFR 211.194 | CoA header auto-populated from DO (`CoAHeaderService` — Contract 1). No manual transcription. |
| FDA OOS Guidance | OOS: product BLOCKED automatically. No dispatch while OOS open (`DispatchStatusService` — Contract 1). |
| GMP | Full traceability: DO → Sample → Test → CoA. FK chain (Contract 1). |

---

## 3. Dispatch QC Workflow — DO to CLEARED

| Step | Name | Actor | Output |
|---|---|---|---|
| 1 | DO Raised | System / Admin | `delivery_orders` row created. DO No., customer, product, container, despatch date recorded. |
| 2 | QC Task Created | System (auto) | `DispatchEventService` (Contract 1) creates Work Queue task. `material_id → form_template_id` FK lookup → correct test set. Analyst notified via SignalR. |
| 3 | Analyst Tests Sample | Analyst | Same execution workflow: instrument check → enter results → auto-calculate → OOS/OOT check (same services — Contract 1). |
| 4 | Pass / Fail Check | System (auto) | `OOSDetectionService` (Contract 1). PASS → analyst signs off. FAIL → OOS + product BLOCKED. |
| 5 | QA Review & Release | QA | QA reviews + §11.50 approval. `CoAHeaderService` auto-populates DO fields on CoA (Contract 1). CoA locked. |
| 6 | Product CLEARED | System (auto) | `DispatchStatusService` sets `status = CLEARED`. `CoADistributionService` notifies ERP. |

---

## 4. Configurable Test Set Per Product Type

| Element | Configuration |
|---|---|
| Product Type | `materials.product_type`. `DispatchEventService` matches `DO.product_id → form_template_id` FK. |
| Test Set | Form Template (`trigger_type = DispatchEvent`): parameters via `parameter_id` FK — not hardcoded. |
| Spec Limits | `spec_limits` per parameter per product — approved in-house + regulatory spec. |
| Pass/Fail | `OOSDetectionService` server-side (Contract 1 — same service as in-batch testing). |
| CoA Template | `form_template_id` FK drives CoA body layout (`CoAGenerationService` — Contract 1). |

---

## 5. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | `DispatchEventService` (Contract 1): DO raised → Work Queue task; product + container + lot auto-assigned | System | Must Have | GMP |
| FR-02 | Test set configurable per product type (Form Template with `trigger_type = DispatchEvent`). No hardcoded tests. | Admin/QA | Must Have | Contract 2 |
| FR-03 | DO from ERP auto-push OR manual entry — same `DispatchEventService` (Contract 1) | System | Must Have | Contract 1 |
| FR-04 | OOS auto-flagged (`OOSDetectionService` — Contract 1: same service as in-batch) | System | Must Have | FDA OOS Guidance |
| FR-05 | BLOCKED status: no dispatch while OOS open. `DispatchStatusService` (Contract 1) sets + clears. | System | Must Have | GMP |
| FR-06 | CLEARED status: set server-side on QA approval (Contract 2). No role can set CLEARED manually. | System | Must Have | Contract 2 |
| FR-07 | CoA header auto-populated from DO (`CoAHeaderService` — Contract 1). No manual entry. | System | Must Have | 21 CFR 211.194 |
| FR-08 | CoA cannot be issued until Dispatch QC passes (`QAReviewGateService` — Contract 1) | System | Must Have | GMP |
| FR-09 | Full traceability: DO → Sample → Test → CoA (FK chain — Contract 1). Single query. | System | Must Have | FDA PAI |
| FR-10 | Analyst §11.50 e-sig on Dispatch QC test sign-off | Analyst | Must Have | 21 CFR §11.50 |
| FR-11 | QA §11.50 e-sig on Dispatch QC release | QA | Must Have | 21 CFR §11.50 |
| FR-12 | SignalR push on DO receipt and on CLEARED/BLOCKED (Contract 2 — no polling) | System | Must Have | Contract 2 |
| FR-13 | All Dispatch QC actions audit-logged INSERT-only | System | Must Have | 21 CFR §11.10(e) |

---

## 6. Data Model (PostgreSQL 16)

```sql
CREATE TABLE delivery_orders (
  do_id           SERIAL PRIMARY KEY,
  do_number       VARCHAR(100) NOT NULL UNIQUE,
  customer_name   VARCHAR(200),
  despatch_date   DATE,
  packing_type    VARCHAR(100),
  product_id      INT NOT NULL REFERENCES materials(material_id),
  status          VARCHAR(20) NOT NULL DEFAULT 'Pending',
  -- Pending | InDispatchQC | CLEARED | BLOCKED
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dispatch_qc_tasks (
  task_id          SERIAL PRIMARY KEY,
  do_id            INT NOT NULL REFERENCES delivery_orders(do_id),
  sample_id        INT NOT NULL REFERENCES samples(sample_id),
  execution_id     INT REFERENCES test_executions(execution_id),
  form_template_id INT NOT NULL REFERENCES form_templates(form_template_id),
  status           VARCHAR(20) NOT NULL DEFAULT 'Open',
  -- Open | InProgress | Passed | Failed | QAApproved
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 7. State Transitions

| Entity | From | To | Trigger | Compliance |
|---|---|---|---|---|
| DO | Pending | InDispatchQC | `DispatchEventService` creates task | Contract 1 |
| DO | InDispatchQC | CLEARED | QA §11.50 approval; all tests pass; no OOS | 21 CFR §11.50 |
| DO | InDispatchQC | BLOCKED | OOS detected by `OOSDetectionService` | FDA OOS Guidance |
| DO | BLOCKED | InDispatchQC | OOS investigation closed + CAPA; QA unblocks | FDA OOS Guidance |

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

