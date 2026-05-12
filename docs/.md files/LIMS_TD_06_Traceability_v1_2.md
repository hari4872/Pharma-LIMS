# PHARMA LIMS — Traceability (Phase 6)
### Technical Design Document · v1.2 · CONFIDENTIAL
> **v1.2 Changes:** Complaint/deviation downstream node · Sampling event upstream node · Graph view UI · Filter by Batch/Lot/Date/Analyst/Instrument · Recall scope query

---

## Document Metadata

| Field | Value |
|---|---|
| Module | Traceability (Phase 6) |
| Depends On | All phases |
| Version | v1.2 |
| Status | Draft · May 2026 |
| Compliance | 21 CFR Part 11 · EU GMP Annex 11 · GMP · ALCOA+ · GAMP 5 |
| Governance | Contracts 1, 2, 4 — all clauses enforced |

---

## Governance Contracts (all clauses — applies to every section)

**Contract 1:** No code duplication. FK-only references. Single named service per concern. `digital_logbook_entries` is the single results source. DB-portable. Clean BE/FE/DB separation. Soft-delete only — never physically deleted.

**Contract 2:** All compute server-side. React renders only. All push via SignalR — no polling. No hardcoded values — all from PostgreSQL. Normalizer views (`vw_*`). UTC timestamps server-side.

**Contract 4:** Login page: username · password · forgot-password · remember-me — all four mandatory. First run: Tenant Admin creation first. Two user types only: Admin and Regular User. CRUD role model. Segregation of duties enforced by system.

## 1. Purpose & Scope

Traceability provides **bidirectional linkage** from any result to its origin (upstream) and usage (downstream). The Sample is the central node. `digital_logbook_entries` links every measurement upstream (instrument, reagent, analyst, sampling event) and downstream (CoA line, batch record, complaint/deviation). `TraceabilityQueryService` builds the graph from FK joins (Contract 1 — single service, no denormalised copies, no separate traceability tables). v1.2 adds: sampling event upstream node, complaint/deviation downstream node, graph view UI with drill-down, and recall scope query.

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR §11.10(e) | Traceability query log INSERT-only: who queried, when, filter params. |
| ALCOA+ Attributable | `analyst_id` FK + §11.50 `full_name` on every logbook row and sampling event. |
| FDA PAI | Single query returns full upstream + downstream chain including logbook rows and sampling events. |
| EU Annex 11 §12.4 | Traceability views included in annual periodic re-validation. Query performance benchmarked. |
| GMP — Recall | Recall scope query from lot node determines all affected downstream batches. Result in seconds for regulatory inspection. |

---

## 3. Traceability Graph — Full Node Map

| Node | Direction | What It Contains | How Resolved |
|---|---|---|---|
| Material Lot | Upstream | Supplier, COA reference, shelf life, expiry | `samples → materials → material_lots` FK join |
| **Sampling Event** | **Upstream** | **Who sampled, when, where (location), quantity pulled — NEW v1.2** | `sampling_events → samples` FK join (Contract 1) |
| Reagent & Standard | Upstream | Lot, potency, expiry, used in which specific test | `test_executions → reagents_standards` FK join |
| Instrument | Upstream / Context | Calibration cert ID, cal status at time of test | `digital_logbook_entries → instruments → calibration_records` FK join |
| Analyst | Context | Who entered result, role, training status at time of test | `digital_logbook_entries → users → user_training_records` FK join |
| Test Method | Context | Method version + SOP ref in effect at time of testing | `test_executions → test_methods` FK join |
| Digital Logbook Row | Central link | Raw value, calculated result, spec snapshot, pass/fail, OOS/OOT flag | `digital_logbook_entries` — central join table |
| CoA Line / CoA | Downstream | Verified result, spec, pass/fail on issued CoA | `coa_lines → digital_logbook_entries` FK join |
| Batch Record / ERP | Downstream | ERP batch, release status, distribution | `erp_batch_records → samples` FK join |
| **Complaint / Deviation** | **Downstream** | **Any complaint or deviation linked to this lot — NEW v1.2** | `complaints_deviations → samples` FK join (Contract 1) |

> All nodes resolved by `TraceabilityQueryService` from FK joins (Contract 1). No denormalised copies. No separate traceability tables.

---

## 4. Graph View UI (New v1.2)

- **Node-based relationship map:** Upstream nodes on left, central sample + logbook in middle, downstream nodes on right.
- **Click any node:** Drill down to full detail for that entity.
- **Filter by:** Batch, Lot, Date Range, Analyst, Instrument — filter predicates applied to `vw_sample_traceability` server-side (Contract 2).
- **Recall scope query:** Single query from lot node determines all batches affected downstream — result in seconds for regulatory inspection.
- **Export:** Full chain as PDF for regulatory audit. QA and Admin only (Contract 4).

---

## 5. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | Upstream: trace to lot, reagent, instrument, analyst, method, logbook row | All | Must Have | FDA PAI / ALCOA+ |
| FR-02 | Downstream: from lot to all logbook rows, CoA lines, CoAs, released batches | All | Must Have | 21 CFR 211.192 |
| FR-03 | Digital Logbook rows as explicit nodes — same FK joins (Contract 1) | All | Must Have | GMP |
| FR-04 | OOC impact: flag logbook rows in OOC window (`OOCImpactService` — Contract 1) | QA, Admin | Must Have | EU GMP Ch 6 |
| FR-05 | Reagent recall: all logbook rows using recalled lot | QA, Admin | Must Have | ICH Q2(R1) |
| FR-06 | PDF export for recall investigation (Contract 4: QA/Admin only) | QA, Admin | Must Have | FDA PAI |
| FR-07 | All queries audit-logged INSERT-only in `trace_query_logs` | System | Must Have | 21 CFR §11.10(e) |
| **FR-08** | **Complaint/deviation downstream node: `complaints_deviations → samples` FK join shown in graph (Contract 1 — no denormalised copy). NEW v1.2** | All | Must Have | GMP / FDA PAI |
| **FR-09** | **Sampling event upstream node: who sampled, when, location, quantity — shown in upstream graph. NEW v1.2** | All | Must Have | ALCOA+ Attributable |
| **FR-10** | **Graph view UI: node-based relationship map with drill-down from any node to full detail. NEW v1.2** | All | Must Have | GMP / Inspection readiness |
| **FR-11** | **Filter by Batch, Lot, Date, Analyst, Instrument: predicates on `vw_sample_traceability` server-side (Contract 2). NEW v1.2** | All | Must Have | GMP / FDA PAI |
| **FR-12** | **Recall scope: single query from lot node determines all affected downstream batches. Result in seconds. NEW v1.2** | QA, Admin | Must Have | GMP recall |

---

## 6. Data Model Additions (v1.2)

```sql
-- Sampling event — upstream node (FR-09)
CREATE TABLE sampling_events (
  sampling_event_id  SERIAL PRIMARY KEY,
  sample_id          INT NOT NULL REFERENCES samples(sample_id),
  sampled_by         INT NOT NULL REFERENCES users(user_id),
  sampled_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- UTC server-side
  location           VARCHAR(200),
  quantity_taken     DECIMAL(10,3),
  quantity_uom       VARCHAR(20),
  container_id       VARCHAR(100),
  notes              TEXT
);

-- Complaint/deviation link — downstream node (FR-08)
CREATE TABLE complaints_deviations (
  cd_id             SERIAL PRIMARY KEY,
  sample_id         INT NOT NULL REFERENCES samples(sample_id),
  cd_type           VARCHAR(20) NOT NULL,  -- Complaint | Deviation | CAPA
  cd_reference      VARCHAR(100) NOT NULL,
  description       TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'Open',
  opened_by         VARCHAR(100) NOT NULL,
  opened_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  linked_oos_id     INT REFERENCES oos_investigations(oos_id)
);

-- Traceability query log — INSERT-only (FR-07)
CREATE TABLE trace_query_logs (
  log_id        BIGSERIAL PRIMARY KEY,
  queried_by    INT NOT NULL REFERENCES users(user_id),
  queried_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filter_params JSONB NOT NULL,   -- batch, lot, date, analyst, instrument
  result_count  INT
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

