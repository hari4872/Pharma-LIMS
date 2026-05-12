 meaning of the signature | Every e-sig stores: `full_name + signed_at UTC + meaning + reason`. All four fields immutable after capture. Embedded in CoA PDF body. Visible on print without system access. |
| §11.300 | Electronic signatures based on biometrics shall be designed to ensure they cannot be used by individuals other than their genuine owners. Persons using digital signatures shall employ at minimum two distinct identification components | `IElectronicSignatureService` verifies password independently of session token. Session token alone cannot authorise a signature. Password re-entry required for every e-sig event. |

---

## 3. EU GMP Annex 11 — Full Clause Mapping

| Clause | Full Obligation | System Control |
|---|---|---|
| §4.3 | Computerised systems should be validated; the extent of validation depends on the risk to patient safety, data integrity, and product quality | All inputs validated server-side (FluentValidation + Zod). No unapproved entity can drive test assignment or sample registration. |
| §6 | Data should only be accessible by authorised personnel. Suitable controls should be in place to prevent unauthorised access | Role-based access per Contract 4. No shared credentials — unique `user_id` at DB level. Admin cannot delete results. |
| §7.1 | Data should be backed up at regular intervals. Backup data should be checked and the integrity of backup data should be confirmed | Daily encrypted backup. RPO ≤ 24 h, RTO ≤ 4 h. Backup integrity verified and documented. Recovery procedure tested. |
| §9 | The use of electronic signatures should be controlled. Where electronic signatures are used, they must be unique to an individual and must not be reused by or reassigned to another individual | Unique `user_id` constraint at DB level. Password re-entry (§11.300) required independently of session. Signatures cannot be copied or repudiated. |
| §10 | All actions should be recorded in an audit trail. Audit trails should be computer-generated, date- and time-stamped, and should not be modifiable | INSERT-only at DB level for all audit tables. Cannot be disabled or edited by any role including Admin. Date/time stamped UTC server-side (Contract 2). |
| §11 | Where electronic signatures are used, they shall be linked to their respective electronic records | CoA PDF embeds §11.50 manifestation (full name, date/time, meaning) directly in the PDF body — not just in the DB. Human-readable without system access. |
| §12.4 | Periodic re-validation is required to confirm the system remains in a validated state | Annual periodic review. Evidence in `validation_review_logs`. IQ/OQ/PQ scripts re-executed for critical functions. |
| §13 | Measures should be in place to minimise the risk of failure including loss of data; disaster recovery procedures should be defined and documented | Failed e-sig transaction rolls back atomically (Contract 1). Paper backup + reconciliation procedure documented for LIMS unavailability. RPO ≤ 24 h. |

---

## 4. ALCOA+ — All 9 Principles & System Controls

| Principle | Definition | System Control | Where Applied |
|---|---|---|---|
| **Attributable** | Data must be traceable to the person or system that generated it | `analyst_id` FK on every logbook row. §11.50 `full_name` on every e-sig. `created_by` on every master data record. | `digital_logbook_entries`, `electronic_signatures`, `sampling_events`, all audit tables |
| **Legible** | Data must be readable and permanent | Structured data fields. System-enforced data types. PDF locked — cannot reformat. Export to human-readable PDF/CSV on demand. | All data entry forms, CoA PDF, audit trail export |
| **Contemporaneous** | Data must be recorded at the time the activity is performed | All timestamps server-side UTC (Contract 2 C2-07). Analyst cannot backdate. `started_at` logged on task open click. `created_at` set by `DEFAULT NOW()` at DB level. | `test_executions.started_at`, `digital_logbook_entries.created_at`, all audit tables |
| **Original** | First capture of the data, or a certified true copy | Results server-computed (Contract 2 C2-01). Analyst cannot override `calculated_result`. Raw value + calculated result both stored. `ISampleIdFormatService` generates Sample ID server-side. | `ParameterCalculationService`, `digital_logbook_entries.calculated_result` |
| **Accurate** | Data must be correct and true | Validated formulas and table-lookup data. Instrument data imported by `FileImportService`. `AutoCorrectionService` applies documented correction. Peer review by second analyst. | `ParameterCalculationService`, `AutoCorrectionService`, `FileImportService` |
| **Complete** | All data must be recorded, including any repeat or reanalysis | System blocks partial sign-off at every gate. Critical parameter sign-off blocked without evidence. QA checklist — all 10 items must pass. Superseded rows preserved — original never deleted. | `CompleteStepHandler`, `QAReviewGateService`, `vw_qa_checklist` |
| **Consistent** | Data and steps must follow a consistent sequence | Form Template engine: same layout via `form_template_id` FK for every form type. Normalizer views — same data in all panels. `trigger_source` recorded on every logbook row. | `form_templates`, `vw_*` normalizer views, `digital_logbook_entries.trigger_source` |
| **Enduring** | Data must be preserved for the required retention period | Soft-delete only (`is_active = FALSE`). INSERT-only audit logs. No physical deletion at any level. CoA PDF tamper-evident after lock. Retention periods from DB config (not hardcoded). | All tables, audit tables, `coas.locked_at`, `lab_config` |
| **Available** | Data must be accessible for review and audit at any time | Full chain retrievable on demand: `TraceabilityQueryService`, audit trail search, CoA history, logbook export. Paginated API. Query performance benchmarked in annual re-validation. | `TraceabilityQueryService`, audit trail, compliance panel, `vw_coa_history` |

---

## 5. Regulatory Requirement Classification — 3 Tiers

### Tier 1 — Mandatory (Non-Negotiable, No Sprint Can Defer)

| Requirement | Description | Regulation |
|---|---|---|
| Audit trail | Immutable: who / when / what / old / new on every action | 21 CFR Part 11 §11.10(e) / EU GMP Annex 11 §10 |
| Electronic signatures | Unique credentials, UTC timestamp, meaning, reason recorded; password re-entry independent of session | 21 CFR Part 11 §11.50, §11.300 |
| OOS investigation | Phase 1 + Phase 2 mandatory; batch locked until investigation closed | FDA OOS Guidance 2006 / 21 CFR 211.192 |
| Data integrity (ALCOA+) | All 9 principles enforced by system controls — not by policy | FDA DI Guidance / MHRA / WHO |
| Specification management | Approved, version-controlled spec required before testing can begin | ICH Q6A / 21 CFR 211.194 |
| Retain sample records | Reserve samples per retention policy; chain of custody immutable | 21 CFR 211.170 / EU GMP Ch 6 |
| Training enforcement | Expired training = hard block at registration gate | 21 CFR Part 11 §11.10(i) |
| Backup | Daily encrypted backup. RPO ≤ 24 h, RTO ≤ 4 h | EU GMP Annex 11 §7.1 |

### Tier 2 — Strongly Recommended (Required for Inspection Readiness)

| Requirement | Description | Regulation |
|---|---|---|
| Instrument calibration | Records traceable to every result; OOC hard-blocks testing | EU GMP Ch 6 / ISO 17025 |
| Stability pull scheduling | ICH Q1A time-points met; missed pull = data risk | ICH Q1A / 21 CFR 211.166 |
| CoA generation | Auto-generated, QA-locked CoA traceable to LIMS results | 21 CFR 211.194 / EU GMP Ch 6 |
| Role-based access | Segregation of duties; analyst cannot self-approve | 21 CFR Part 11 / EU GMP Annex 11 §6 |
| Full sample traceability | Lot ↔ Sample ↔ Test ↔ Instrument ↔ Analyst ↔ CoA | FDA PAI readiness / GMP |
| Periodic re-validation | Annual review with IQ/OQ/PQ evidence | EU GMP Annex 11 §12.4 |

### Tier 3 — Value-Add (Operational Excellence)

| Requirement | Description |
|---|---|
| Sample storage inventory | Prevents stock-outs and missed stability pulls |
| Pull planning automation | T-7/T-1 alerts prevent missed ICH Q1A time-points |
| TAT dashboards & alerts | Lab throughput visibility; overdue samples flagged real-time |
| Utilisation tracking | Instrument usage optimisation |
| WAP (Work & Resource Planning) | Prevents analyst overload; ensures trained analyst assigned |

---

## 6. Electronic Signature Map — All Modules

| Module | Event | E-Sig Required By | §11.50 Fields |
|---|---|---|---|
| Master Data | Spec Limit approval | QA | full_name + signed_at UTC + meaning + reason |
| Master Data | Test Method approval | QA | full_name + signed_at UTC + meaning + reason |
| Master Data | Form Template approval | QA | full_name + signed_at UTC + meaning + reason |
| Sample Registration | SRF sign-off | Analyst | full_name + signed_at UTC + meaning |
| Checkpoints | Process Log row sign-off | Analyst | full_name + signed_at UTC + meaning |
| Checkpoints | Missed trigger acknowledgement | QA | full_name + signed_at UTC + meaning + reason |
| Testing Execution | Step sign-off after data entry | Analyst | full_name + signed_at UTC + meaning |
| OOS Investigation | Phase 1 outcome | QA | full_name + signed_at UTC + meaning + reason |
| OOS Investigation | Phase 2 closure + CAPA | QA | full_name + signed_at UTC + meaning + reason |
| Results Management | Peer review | 2nd Analyst | full_name + signed_at UTC + meaning |
| Results Management | QC Lead verification | QC Lead | full_name + signed_at UTC + meaning |
| QA Review & Release | CoA approval (embedded in PDF) | QA | full_name + signed_at UTC + meaning |
| QA Review & Release | CoA rejection (INSERT-only) | QA | full_name + signed_at UTC + meaning + reason |
| Dispatch QC | Dispatch QC test sign-off | Analyst | full_name + signed_at UTC + meaning |
| Dispatch QC | CLEARED approval | QA | full_name + signed_at UTC + meaning |
| Instrument Management | Calibration approval | QA | full_name + signed_at UTC + meaning + reason |
| Instrument Management | Return-to-service after breakdown | QA | full_name + signed_at UTC + meaning + reason |
| Sample Inventory | Pull confirmation | Analyst | full_name + signed_at UTC + meaning |
| Sample Inventory | Retain destruction approval | QA | full_name + signed_at UTC + meaning + reason |
| Sample Inventory | Stability protocol approval | QA | full_name + signed_at UTC + meaning + reason |
| Traceability | Recall scope export approval | QA | full_name + signed_at UTC + meaning |

---

## 7. Design Principles — All 12

| # | Principle | Description | Why It Matters |
|---|---|---|---|
| 1 | **Sample-Centric Design** | All workflows revolve around the sample lifecycle. Sample is the central node in every graph and traceability chain. | Simplifies navigation, traceability, and audit. |
| 2 | **Spec-Driven Testing** | Tests auto-assigned from approved specification. Form Template auto-selected server-side. Analyst does not choose which tests to run. | Eliminates manual test selection errors. |
| 3 | **No Duplication Rule** | Same data or logic must not exist in multiple places. One service per concern (Contract 1). One view per metric (Contract 2). | Prevents data inconsistency and maintenance burden. |
| 4 | **Instrument Blocking** | Tests blocked if instrument is OOC or in Maintenance. No workaround possible by any role. | Ensures data reliability (GMP requirement). |
| 5 | **4-Eyes Principle** | Analyst enters → 2nd Analyst peer-reviews → QC Lead verifies → QA approves. `user_id` equality enforced at API. | Segregation of duties (GMP requirement). |
| 6 | **Immutable Data** | Results cannot be altered after e-sig. Superseded row preserved. Audit logs INSERT-only. | Data integrity (ALCOA+ Enduring). |
| 7 | **OOS Gating** | Batch/sample cannot proceed while any OOS investigation is open. Hard block — no override by any role. | Forces investigation completion (FDA OOS Guidance 2006). |
| 8 | **Versioning** | Spec Limits, Test Methods, and Form Templates have QA-approved, version-controlled lifecycle. Old versions archived — never deleted. | Tracks process changes historically. ICH Q10. |
| 9 | **Full Traceability** | Every result links: Sample ↔ Method ↔ Instrument ↔ Analyst ↔ Reagent ↔ CoA ↔ Complaint/Deviation. Single query returns full chain. | Required for regulatory compliance and recall. |
| 10 | **Audit Trail** | Every action logged: who, when, what, old/new values. INSERT-only at DB level. Filterable, exportable, inspection-ready. | Supports all regulatory audits and FDA PAI. |
| 11 | **B2B UI Design** | Tables, filters, drill-downs — no decorative UI. Dense information density. Roles see only their data (Contract 4 server-side filter). | Fits industrial analyst workflow. Inspection-ready screens. |
| 12 | **Modular & Configurable** | No hardcoded values anywhere (Contract 2). Everything from DB config. Add any product, site, or test without a code change. | Scales to any product portfolio. No regression risk on config change. |

---

## 8. Service Registry — All Named Services

| Service | Module | Contract | Purpose |
|---|---|---|---|
| `IElectronicSignatureService` | Cross-cutting | C1, C4 | §11.50 + §11.300: e-sig creation with independent password verification |
| `MasterDataValidatorService` | Master Data | C1 | Dependency tier enforcement; prerequisite checks |
| `IFormTemplateRenderService` | Form Template | C1 | Single layout resolver for Testing Execution, Process Log, Dispatch QC |
| `IFormTemplateSelectorService` | Sample Registration | C1 | Auto-select Form Template for new sample |
| `ISampleIdFormatService` | Sample Registration | C1, C2 | Configurable Sample ID generation from `lab_config` |
| `SampleValidatorService` | Sample Registration | C1 | 5 GMP pre-checks — single enforcement point |
| `CheckpointTriggerService` | Checkpoints | C1 | All 4 trigger modes → Work Queue or Process Log |
| `OOSDetectionService` | Testing Execution | C1 | OOS + OOT detection — single service, two modes |
| `ParameterCalculationService` | Testing Execution | C1, C2 | Expression + TableLookup formula — server-side only |
| `AutoCorrectionService` | Testing Execution | C1, C2 | Corrections (e.g. SG temp) — table from DB |
| `FileImportService` | Testing Execution | C1 | Instrument file import — server-side parse |
| `WAPAssignmentService` | Testing Execution | C1, C2 | Work & Resource Planning — smart assignment rules from DB |
| `ScanToTaskService` | Testing Execution | C1 | Barcode scan → Work Queue task |
| `DigitalLogbookService` | Digital Logbook | C1 | Single writer for all logbook rows (all 4 trigger modes + Process Log) |
| `ResultsReviewService` | Results Management | C1, C4 | 4-eyes `user_id` equality enforcement |
| `CoAHeaderService` | Results Management, CoA | C1, C2 | Auto-populate all CoA header fields from FK joins |
| `CoAGenerationService` | CoA Generation | C1 | Single CoA builder |
| `CoADistributionService` | CoA Generation | C1 | Single sender: ERP + Archive |
| `QAReviewGateService` | QA Review | C1 | OOS gate + evidence check — single centralised check |
| `ERPIntegrationService` | Results Management | C1 | Single ERP call on release — no duplicate |
| `TraceabilityQueryService` | Traceability | C1, C2 | Graph from FK joins — no denormalised copies |
| `OOCImpactService` | Instrument Management | C1 | Single service for cal-OOC and breakdown-OOC flagging |
| `InstrumentStatusService` | Instrument Management | C1, C2 | All 4 status transitions — single service |
| `BreakdownRepairService` | Instrument Management | C1 | Breakdown/Repair lifecycle |
| `StorageManagementService` | Sample Inventory | C1 | Location assignment, transfer, excursion logging |
| `PullExecutionService` | Sample Inventory | C1 | Inventory deduction + auto-registration — atomic |
| `ExcursionImpactService` | Sample Inventory | C1 | Flags affected samples in excursion window |
| `DispatchEventService` | Dispatch QC | C1, C2 | DO → Work Queue task creation |
| `DispatchStatusService` | Dispatch QC | C1, C2 | CLEARED / BLOCKED setter |
| `DashboardAggregationService` | Dashboards | C1, C2 | Single aggregation source for all KPIs |
| `IPeriodicReviewService` | Master Data | C2 | Annual re-validation (Annex 11 §12.4) |

---

## 9. Background Jobs Registry — All `IHostedService` Jobs

| Job | Contract | Interval | Purpose |
|---|---|---|---|
| `CalibrationDueDateJob` | C2 | Daily | OOC detection; T-7 and T-1 cal due alerts |
| `TrainingExpiryJob` | C2 | Daily | Training expiry check; T-7 alert |
| `PullReminderJob` | C2 | Daily | Stability pull T-7 and T-1 reminders |
| `MissedPullJob` | C2 | Daily | Missed pull escalation |
| `DestructionAlertJob` | C2 | Daily | Retain destruction T-90, T-30, T-7 alerts |
| `TATBreachJob` | C2 | Hourly | TAT target breach detection; SignalR push |
| `UtilisationSummaryJob` | C2 | Daily | Instrument utilisation summary (7/30/90 days) |
| `PMReminderJob` | C2 | Daily | Preventive maintenance T-7 and T-1 |
| `ProcessLogSchedulerJob` | C2 | Per shift config | Mode 3 Process Log time-slot creation |
| `CheckpointSchedulerJob` | C2 | Per time-slot config | Mode 1 time-based checkpoint triggers |
| `MissedTriggerEscalationJob` | C2 | Daily | Missed checkpoint escalation |
| `FormTemplateApprovalJob` | C2 | Daily | Active Form Templates reference-integrity check |
| `StorageInventoryJob` | C2 | Daily | Low-stock alert per storage location |

All intervals from DB config (`lab_config`) — none hardcoded (Contract 2 C2-03).

---

## 10. Normalizer Views Registry — All `vw_*` Views

| View | Drives | Key Source Tables |
|---|---|---|
| `vw_active_spec_limits` | Form pre-population, CoA line | `spec_limits` (status = Approved) |
| `vw_instrument_status` | Instrument status board, WAP, test gate | `instruments`, `test_executions`, `instrument_breakdowns`, `calibration_records` |
| `vw_training_currency` | Test registration gate | `user_training_records` |
| `vw_form_template_active` | Form Template selector | `form_templates` (status = Active) |
| `vw_wip_summary` | WIP panel | `samples`, `test_executions`, `wap_assignments` |
| `vw_tat_summary` | TAT panel | `samples`, `test_executions`, `lab_config` |
| `vw_quality_kpis` | Quality KPIs | `digital_logbook_entries`, `oos_investigations` |
| `vw_instrument_utilisation` | Utilisation panel | `instrument_utilisation_summary` |
| `vw_compliance_summary` | Compliance panel | All audit tables, `electronic_signatures`, `oos_investigations` |
| `vw_alert_queue` | Active alerts for SignalR | All monitoring tables — thresholds from `lab_config` |
| `vw_qa_checklist` | QA checklist (10 items) | `test_executions`, `oos_investigations`, `digital_logbook_entries`, `results_reviews`, `coas` |
| `vw_coa_preview` | QA CoA review, PDF generation | `digital_logbook_entries`, `coa_lines`, `delivery_orders`, `materials` |
| `vw_coa_history` | CoA history panel | `coas`, `samples`, `materials` |
| `vw_sample_traceability` | Traceability graph and recall scope | All FK-linked tables via `digital_logbook_entries` |
| `vw_storage_inventory` | Storage inventory panel | `sample_storage_assignments`, `storage_locations` |

---

## 11. Data Integrity Controls — DB-Level Enforcement

| Control | Implementation |
|---|---|
| INSERT-only audit logs | DB trigger on all `*_audit_logs` tables: `BEFORE UPDATE OR DELETE` → RAISE EXCEPTION. |
| INSERT-only rejection reasons | DB trigger on `coa_approvals` where `decision = Rejected`: `BEFORE UPDATE` → RAISE EXCEPTION. |
| Unique credentials | `UNIQUE` constraint on `users.user_id` and `users.username`. Shared credentials rejected at DB. |
| Soft-delete only | `is_active BOOLEAN NOT NULL DEFAULT TRUE` on all entity tables. No `DELETE` in any application code. |
| UTC timestamps | `TIMESTAMPTZ` on all compliance timestamp columns. `DEFAULT NOW()` set server-side. No `TIMESTAMP WITHOUT TIME ZONE`. |
| FK referential integrity | All cross-table references via `FOREIGN KEY` with `ON DELETE RESTRICT`. No orphan records. |
| No NULL on compliance fields | `full_name`, `signed_at`, `meaning`, `reason` in `electronic_signatures` — all `NOT NULL`. |

---

## 12. Full Compliance Summary

| Standard | Control |
|---|---|
| **21 CFR §11.50** | Every e-sig: `full_name + signed_at UTC + meaning + reason`. All four fields immutable after capture. Embedded in CoA PDF body. Visible on print without system access. |
| **21 CFR §11.300** | `IElectronicSignatureService` verifies password independently of session token. Session token alone cannot authorise a signature under any role. |
| **21 CFR §11.10(a)** | GAMP 5 Cat 5 validation. IQ/OQ/PQ documented. Evidence in `validation_review_logs`. |
| **21 CFR §11.10(b)** | All records exportable as human-readable PDF/CSV on demand. §11.50 fields on print. |
| **21 CFR §11.10(c)** | Soft-delete only. INSERT-only audit logs. No hard delete at any DB level. |
| **21 CFR §11.10(d)** | CRUD role model. Regular User view-only by default. Explicit write grants per module. |
| **21 CFR §11.10(e)** | INSERT-only audit logs: who / when / what / old value / new value. UTC server-side. On demand. |
| **21 CFR §11.10(i)** | Training enforced at test gate. Expired = hard block. `TrainingExpiryJob` daily. |
| **EU GMP Annex 11 §9** | Unique credentials at DB level. Password re-entry independent of session on every e-sig. |
| **EU GMP Annex 11 §10** | Audit trail INSERT-only at DB level. Cannot be disabled or edited by any role. |
| **EU GMP Annex 11 §12.4** | Annual periodic review. Evidence in `validation_review_logs`. |
| **EU GMP Annex 11 §7.1** | Daily encrypted backup. RPO ≤ 24 h, RTO ≤ 4 h. Recovery tested. |
| **ALCOA+ Attributable** | `analyst_id` + §11.50 `full_name` on every result row. |
| **ALCOA+ Contemporaneous** | All timestamps server-side UTC (Contract 2). No client-supplied timestamps. |
| **ALCOA+ Original** | `calculated_result` server-computed. Analyst cannot override. |
| **ALCOA+ Complete** | System blocks partial sign-off. All 10 QA checklist items must pass. |
| **ALCOA+ Consistent** | `parameter_id` FK throughout — zero duplication. Same view drives every panel. |
| **ALCOA+ Enduring** | Soft-delete only. INSERT-only logs. Superseded rows preserved. No physical deletion. |
| **ALCOA+ Available** | Full chain retrievable on demand. Paginated API. Traceability query in seconds. |
| **Contract 1** | Single-service ownership per concern. FK-only references. Atomic transactions. No duplication. |
| **Contract 2** | All compute server-side. All push via SignalR. All thresholds from DB. No hardcoded values. |
| **Contract 4** | Login: 4 elements mandatory. Tenant Admin first-run. `user_id` equality checks at API. |
| **Tier 1** | Audit trail, e-sigs, OOS investigation, ALCOA+, spec management, retain samples, training, backup — all non-negotiable. |
| **Design Principle 12** | No hardcoded values anywhere. All configuration from PostgreSQL. No code change needed to add a product, site, or test. |
