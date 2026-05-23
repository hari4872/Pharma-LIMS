# PHARMA LIMS — Dashboards & Lab KPIs (Phase 11)
### Technical Design Document · v1.0 · CONFIDENTIAL
> **v1.0 — New Module:** WIP · TAT · Quality KPIs · Instrument Status Board · Automated Alerts · Compliance & Audit Readiness Panel

---

## Document Metadata

| Field | Value |
|---|---|
| Module | Dashboards & Lab KPIs (Phase 11) |
| Depends On | All phases |
| Version | v1.0 |
| Status | Implemented · Live · May 2026 |
| Compliance | 21 CFR Part 11 · EU GMP Annex 11 · GMP · ALCOA+ · GAMP 5 |
| Governance | Contracts 1, 2, 4 — all clauses enforced in every section |

---

## Governance Contracts

### Contract 1 — General Architecture

| Clause | Enforced Rule |
|---|---|
| Single aggregation service | `DashboardAggregationService` is the single source of computed dashboard metrics. No per-panel duplication of aggregation logic. |
| Normalizer views | All dashboard data served from `vw_*` normalizer views defined in PostgreSQL. Same view drives every panel that shows the same metric — no per-screen recalculation. |
| FK-only references | Every panel reads live data from canonical tables via FK joins. No denormalised copies. No snapshot tables for dashboard data. |
| No dead code | Inactive instruments, samples, and users excluded via `is_active` flag — same FK filter pattern as every other module. |

### Contract 2 — Backend Services

| Clause | Enforced Rule |
|---|---|
| All compute on server | All KPI calculations, averages, breach checks, OOS rates, TAT deltas — computed in .NET Core 8 (`DashboardAggregationService`). React renders results — never computes. |
| All push via SignalR | Every alert (OOS raised, cal due, TAT breach, instrument OOC, training expiry) pushed server-side. React does not poll — no `setInterval`, no repeated GET for status. |
| No hardcoded values | Every alert threshold, TAT target, KPI window, and reminder lead time stored in PostgreSQL `lab_config`. No magic numbers in handlers or React. |
| Normalizer views | `vw_wip_summary`, `vw_tat_summary`, `vw_quality_kpis`, `vw_instrument_status`, `vw_compliance_summary`, `vw_alert_queue` — each defined once, consumed by API and PDF export. |
| Background jobs | All alert jobs (`CalibrationDueDateJob`, `TrainingExpiryJob`, `PullReminderJob`, `TATBreachJob`) run as `IHostedService` server-side. Alert intervals from DB config. |

### Contract 4 — Authentication & Access Control

| Clause | Enforced Rule |
|---|---|
| Login page | **Username · Password · Forgot-password link · Remember-me checkbox** — all four mandatory. |
| First run | Tenant Admin creation before any other user or module access. |
| Role-filtered panels | All normalizer views apply role predicate server-side. Each role sees only permitted data. No client-side filtering. |
| Compliance panel | Audit trail search, e-sig log, OOS log, system health — QA and Admin only. No analyst access. |
| Export | Compliance PDF report — QA and Admin only. |

---

## 1. Purpose & Scope

The Dashboards module provides **real-time, role-filtered visibility** across the full LIMS workflow. All data is server-computed (Contract 2) from normalizer views (Contract 1 — `DashboardAggregationService`) and pushed via SignalR (Contract 2 — no polling). No dashboard panel computes anything in React. Dashboards are role-filtered: each role sees only permitted data, applied server-side by normalizer view predicates (Contract 4).

---

## 2. Regulatory Framework

| Standard | Specific Obligations |
|---|---|
| 21 CFR §11.10(e) | Audit trail panel: INSERT-only log, user, timestamp, action, old/new values. Filterable. Exportable. |
| 21 CFR §11.50 | E-sig log panel: all signatures with `full_name + signed_at UTC + meaning + action_type`. Filterable. |
| EU GMP Annex 11 §12.4 | Compliance readiness panel: system health, backup status, last backup timestamp, audit trail integrity. |
| FDA OOS Guidance | OOS log panel: all investigations with status, outcome, analyst, date. Open/closed counts. SignalR push on any new OOS. |
| GMP — TAT | TAT targets configurable per material and test type in DB config (Contract 2 — not hardcoded). Breaches pushed in real time. |

---

## 3. Dashboard Panel 1 — Work-In-Progress (WIP)

| Metric | Description | Data Source |
|---|---|---|
| Samples registered today | Live count | `vw_wip_summary` via `samples.created_at` filter |
| Samples in testing | Live count by status | `vw_wip_summary` via `samples.status = InTesting` |
| Samples completed today | Count | `vw_wip_summary` via `samples.status = Released AND released_at >= today` |
| Tests pending / in-progress / completed | Counts per status across all open samples | `vw_wip_summary` via `test_executions.status` |
| Analyst workload | Tasks assigned per analyst right now. Highlights anyone at capacity. | `vw_wip_summary` via `wap_assignments` |
| Overdue samples | Samples exceeding TAT target — highlighted with breach flag | `vw_wip_summary`: `due_date < NOW()` |
| Filters | Lab, analyst, sample type, date range | Server-side predicates on `vw_wip_summary` (Contract 2) |

---

## 4. Dashboard Panel 2 — Turnaround Time (TAT)

| Metric | Description | Config |
|---|---|---|
| Average TAT per test type | Rolling window average (7 / 30 days configurable) | Period from `lab_config` (Contract 2) |
| TAT breach alerts | Sample exceeds configured target → SignalR push + badge | TAT target per material/test type from `lab_config` |
| TAT by analyst | Identify team bottlenecks. QC Lead and Lab Manager view. | `vw_tat_summary` grouped by `analyst_id` |
| TAT trend chart | Is average TAT improving or degrading? Rolling 30-day view. | `vw_tat_summary` time-series |
| Configurable TAT targets | Per material and test type. No hardcoded targets (Contract 2). | `lab_config.config_key = 'tat_target_hrs'` |

---

## 5. Dashboard Panel 3 — Quality KPIs

| KPI | Description | Data Source |
|---|---|---|
| OOS rate | % of tests failing spec this period. Per analyst, per method, per material. | `vw_quality_kpis` via `digital_logbook_entries.is_oos` |
| OOT rate | % of tests flagging out-of-trend. Trend vs previous period. | `vw_quality_kpis` via `digital_logbook_entries.is_oot` |
| Right-First-Time (RFT) rate | % of samples completed without retest or OOS. | `vw_quality_kpis`: samples with zero `superseded_by` rows and zero OOS |
| Retest rate | How often results are superseded — trend over time. | `vw_quality_kpis` via `digital_logbook_entries.status = Superseded` |
| CAPA open count | Number of open CAPAs and average resolution time. | `oos_investigations.capa_ref` where `status = Open` |
| First-pass yield | Per product type — trend view. QA dashboard metric. | `vw_quality_kpis` grouped by `materials.product_type` |

---

## 6. Dashboard Panel 4 — Instrument Status Board

| Element | Description | Data Source |
|---|---|---|
| All instruments — real-time status | Available / In-Use / Maintenance / OutOfCalibration | `vw_instrument_status` normalizer (Contract 2) |
| Calibration due alerts | Due in next 7 / 30 days — colour-coded. T-7 and T-1 pushed via SignalR. | `CalibrationDueDateJob` (Contract 2) |
| Utilisation rate | From `instrument_utilisation_summary`. Window from DB config. | `UtilisationSummaryJob` (Contract 2) |
| OOC events | Count and list for the period. Drill-down to affected logbook rows. | `vw_instrument_status` + `digital_logbook_entries` FK |
| Breakdown history | Open breakdowns and days since raised. | `instrument_breakdowns.status = Open` |
| PM due | Preventive maintenance due dates. T-7 and T-1 alerts. | `PMReminderJob` (Contract 2) |

---

## 7. Dashboard Panel 5 — Automated Alerts & Notifications

All alerts pushed server-side via SignalR (Contract 2 — no polling, no `setInterval`). All thresholds from DB config (Contract 2 — no hardcoded values).

| Alert | Trigger | Pushed To | Job |
|---|---|---|---|
| OOS result raised | `OOSDetectionService` flags new OOS | QC Lead + QA | Event from `OOSDetectionService` |
| OOT result flagged | `OOSDetectionService` OOT mode | QC Lead + QA | Event from `OOSDetectionService` |
| Calibration due | `cal_due < today + 7 days` | Instrument owner + QA | `CalibrationDueDateJob` (IHostedService) |
| Instrument OOC | `cal_due < today` detected | QA + Lab Manager | `CalibrationDueDateJob` (IHostedService) |
| Instrument breakdown raised | Breakdown opened | QA + Lab Manager | Event from `BreakdownRepairService` |
| Missed stability pull | T-0 overdue | QC Lead | `MissedPullJob` (IHostedService) |
| Stability pull approaching | T-7, T-1 days before due | Analyst | `PullReminderJob` (IHostedService) |
| Retain destruction due | T-90, T-30, T-7 days before due | QC Lead + QA | `DestructionAlertJob` (IHostedService) |
| TAT breach | Sample exceeds TAT target | QC Lead + Lab Manager | `TATBreachJob` (IHostedService) |
| Training expiry approaching | T-7 days before expiry | Analyst + Admin | `TrainingExpiryJob` (IHostedService) |
| Low inventory | Sample count < low-stock threshold | QC Lead | `StorageInventoryJob` (IHostedService) |

---

## 8. Dashboard Panel 6 — Compliance & Audit Readiness

**Role access: QA and Admin only (Contract 4). No analyst access.**

| Feature | Description |
|---|---|
| Audit trail search | Who / when / what across any date range. Filter by entity type, user, action type. INSERT-only source — no data can be altered before export. |
| CoA history | All issued CoAs by product, lot, analyst, or date range. One-click PDF download. |
| OOS investigation log | All investigations with flag type (OOS/OOT), status, analyst, open date, close date, outcome. Open/closed counts. |
| Electronic signature log | Every signature: user, `full_name`, `signed_at UTC`, meaning, action type. Filterable by role, date, action. §11.10(e) evidence. |
| Training status | All analysts: training records, valid-until dates, expired status. |
| System health | Backup status, last backup timestamp, audit trail integrity check. Admin only. |
| Export compliance report | Full compliance summary as PDF in one click. QA and Admin. |

---

## 9. Normalizer Views — Full Map

| View | What It Drives | Source Tables |
|---|---|---|
| `vw_wip_summary` | WIP panel | `samples`, `test_executions`, `wap_assignments` |
| `vw_tat_summary` | TAT panel | `samples`, `test_executions`, `lab_config` |
| `vw_quality_kpis` | Quality KPIs | `digital_logbook_entries`, `oos_investigations` |
| `vw_instrument_status` | Instrument status board | `instruments`, `test_executions`, `instrument_breakdowns`, `calibration_records` |
| `vw_instrument_utilisation` | Utilisation rate | `instrument_utilisation_summary` |
| `vw_compliance_summary` | Audit trail, sig log, OOS log | All audit tables, `electronic_signatures`, `oos_investigations` |
| `vw_alert_queue` | Active alerts for SignalR push | All monitoring tables — thresholds from `lab_config` |
| `vw_coa_history` | CoA history panel | `coas`, `samples`, `materials` |

---

## 10. Functional Requirements

| # | Requirement | Actor | Priority | Compliance |
|---|---|---|---|---|
| FR-01 | WIP panel: live counts from `vw_wip_summary` (Contract 1 + Contract 2: server-computed) | All | Must Have | GMP |
| FR-02 | TAT panel: averages + breach alerts. TAT targets from DB config (Contract 2) | All | Must Have | GMP |
| FR-03 | Quality KPIs from `DashboardAggregationService` (Contract 1) | QA, QC Lead | Must Have | GMP |
| FR-04 | Instrument status board from `vw_instrument_status` (Contract 2). All 4 states shown. | All | Must Have | GMP |
| FR-05 | OOS alert: SignalR push from `OOSDetectionService` (Contract 2 — no polling) | System | Must Have | FDA OOS Guidance |
| FR-06 | Calibration due alert: `CalibrationDueDateJob` T-7/T-1 push (Contract 2) | System | Must Have | EU GMP Ch 6 |
| FR-07 | TAT breach alert: server-push when sample exceeds target (Contract 2) | System | Must Have | GMP |
| FR-08 | Role-filtered panels: all normalizer views apply role predicate server-side (Contract 4) | System | Must Have | Contract 4 |
| FR-09 | Compliance panel: audit trail search + sig log + OOS log + CoA history + export PDF | QA, Admin | Must Have | 21 CFR §11.10(e) |
| FR-10 | No dashboard computes data in React — all from `DashboardAggregationService` (Contract 2) | System | Must Have | Contract 2 |
| FR-11 | All alert thresholds from DB config (Contract 2 — no hardcoded values) | System | Must Have | Contract 2 |
| FR-12 | All SignalR pushes identified by channel (`OOS`, `CalDue`, `TAT`, `Breakdown`, `Pull`, `Destruction`, `Training`, `Inventory`) | System | Must Have | Contract 2 |

---

## 11. Audit & Compliance Summary

| Standard | Control |
|---|---|
| **21 CFR §11.10(e)** | Audit trail panel reads INSERT-only tables. No data can be altered before display or export. |
| **21 CFR §11.50** | E-sig log shows all four mandatory fields (`full_name + signed_at UTC + meaning + reason`) for every signature. |
| **EU GMP Annex 11 §10** | Compliance panel audit trail is immutable, computer-generated, date/time-stamped. Available on demand for inspection. |
| **EU GMP Annex 11 §12.4** | System health panel shows backup status and last backup timestamp. Annual review evidence accessible. |
| **Contract 1** | `DashboardAggregationService` is the single aggregation source. All panels read from `vw_*` normalizer views — no per-panel duplication. |
| **Contract 2** | All compute server-side. All push via SignalR. All thresholds from DB config. No polling. |
| **Contract 4** | Role-filtered: all views apply server-side role predicate. Compliance panel restricted to QA and Admin only. |
