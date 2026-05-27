# Pharma LIMS — Data Architecture
### Architecture Document · v1.0 · 2026-05-27

---

## 1. Database Platform

| Attribute | Value |
|---|---|
| **Engine** | PostgreSQL 16 |
| **Host** | Azure Database for PostgreSQL (Flexible Server) |
| **Connection** | Host=52.230.33.120;Port=5432;Database=limslite |
| **ORM** | Entity Framework Core 8 (code-first) |
| **Table naming** | Snake_case (e.g. `digital_logbook_entries`, `stability_protocols`) |
| **Migrations** | 29 applied migrations (as of 2026-05-27) |
| **Backup** | Daily automated (Azure); RPO ≤ 24h; RTO ≤ 4h |

---

## 2. Schema Design Principles

| Principle | Implementation |
|---|---|
| **FK-only references** | No master data copied into consuming tables. `parameter_id` FK, not `parameter_name` string. |
| **Soft delete** | `is_active BOOLEAN DEFAULT true` on all entity tables. No `DELETE` ever issued. |
| **UTC timestamps** | All compliance timestamps use `TIMESTAMPTZ DEFAULT NOW()`. No `TIMESTAMP WITHOUT TIME ZONE`. |
| **INSERT-only audit** | Audit tables have no UPDATE/DELETE path in application code. |
| **Spec snapshot** | `spec_min_snapshot`, `spec_max_snapshot` captured at test time on `digital_logbook_entries` — immutable. |
| **Self-referencing FK** | `digital_logbook_entries.superseded_by_id → digital_logbook_entries` for amendment chain. |
| **Identity PKs** | All PKs use `SERIAL` / `INT IDENTITY` — no GUIDs (simpler joins, smaller indexes). |

---

## 3. Migration History

| Migration | Date | Key Changes |
|---|---|---|
| `PhaseA_SpecificationEngine` | 2026-05-23 | Spec limits, test methods, parameters |
| `Add_WorkflowEngine` | 2026-05-27 | Checkpoint trigger modes, workflow config |
| `Patch_MissingColumns` | 2026-05-27 | Backfill missing columns from entity updates |
| `Add_LabVantage_Parity` | 2026-05-27 | LoginAuditLogs, SampleContainers, StabilityTrendPoints; User lockout columns; digital_logbook_entries amendment columns |
| `Add_IntendedShelfLife` | 2026-05-27 | `IntendedShelfLifeMonths` on `stability_protocols` |

**Critical note:** `stability_protocols` uses `builder.ToTable("stability_protocols")` in `PhaseBConfiguration.cs`. Manual SQL must use this snake_case name, not `StabilityProtocols`.

---

## 4. Key Tables

### Master Data

| Table | Rows (est.) | Notes |
|---|---|---|
| `laboratories` | 1–20 | Per-site labs |
| `users` | 10–200 | Includes lockout fields (LabVantage parity) |
| `instruments` | 5–100 | With `calibration_due` date |
| `materials` | 10–500 | Raw material, intermediate, finished |
| `test_methods` | 5–50 | With `status` lifecycle |
| `test_method_parameters` | 20–500 | FK to `test_methods` |
| `spec_limits` | 20–500 | Versioned; `status` (Draft/Approved/Retired) |
| `form_templates` | 1–50 | Layout + trigger type |
| `lab_config` | 10–100 | All configurable values keyed by `(lab_id, key)` |
| `user_training_records` | 50–2000 | `valid_until` = WAP hard-block date |

### Compliance (INS-ONLY)

| Table | Notes |
|---|---|
| `electronic_signatures` | Every e-sig event; 4 mandatory fields; never deleted |
| `login_audit_logs` | Every login attempt; `outcome` (Success/Failed/LockedOut) |
| `master_data_audit_log` | Every master data change; old/new JSON diff |
| `barcode_print_log` | Chain of custody; `print_type` (AutoOnRegistration/Reprint) |
| `calibration_records` | Cal history; INSERT-only |

### Results (INS-ONLY after sign)

| Table | Notes |
|---|---|
| `digital_logbook_entries` | Single source of truth. Includes amendment columns (v1.3). |
| `oos_investigations` | Phase 1 + Phase 2; `status` (Open/Closed) |
| `results_reviews` | Peer review + QCLead verification |

### New Tables (LabVantage Parity Sprint — 2026-05-27)

| Table | Purpose |
|---|---|
| `LoginAuditLogs` | 21 CFR §11.10(d) — login attempt audit |
| `SampleContainers` | Container/aliquot management |
| `StabilityTrendPoints` | ICH Q1A regression data points |

---

## 5. Data Flow

### Sample Registration Data Flow

```
User Input (React) 
  → POST /samples 
  → SampleValidatorService (reads: materials, spec_limits, instruments, user_training_records, lab_config)
  → ISampleIdFormatService (reads: lab_config.sample_id_format, COUNT(samples))
  → INSERT samples
  → INSERT barcode_print_log (AutoOnRegistration)
```

### Result Submission Data Flow

```
Analyst submits result
  → POST /test-executions/{id}/results
  → ParameterCalculationService (reads: test_method_parameters.calc_formula, parameter_lookup_rows)
  → AutoCorrectionService (reads: lab_config.auto_correction_{param})
  → OosDetectionService (reads: spec_limits for min/max + oot_min/oot_max)
  → INSERT digital_logbook_entries (status='Pending')

Analyst signs off
  → POST /test-executions/{id}/sign-off
  → IElectronicSignatureService (BCrypt.Verify → INSERT electronic_signatures)
  → UPDATE digital_logbook_entries SET status='Signed', signature_id=...
```

### Post-Sign Amendment Data Flow

```
Analyst requests amendment
  → POST /digital-logbook/{id}/amend
  → BCrypt.Verify(password) ← §11.300
  → INSERT electronic_signatures (amendment signature)
  → UPDATE original entry: status='Superseded', amendment_reason, amendment_signature_id
  → INSERT new entry: status='Pending', new raw_value (awaits new sign-off)
```

---

## 6. Indexes (Key Performance Indexes)

```sql
-- Compliance query performance
CREATE INDEX ix_digital_logbook_sample ON digital_logbook_entries(sample_id);
CREATE INDEX ix_digital_logbook_execution ON digital_logbook_entries(execution_id);
CREATE INDEX ix_digital_logbook_status ON digital_logbook_entries(status);
CREATE INDEX ix_login_audit_user ON login_audit_logs(user_id);
CREATE INDEX ix_login_audit_attempted_at ON login_audit_logs(attempted_at DESC);
CREATE INDEX ix_samples_status ON samples(status);
CREATE INDEX ix_test_executions_status ON test_executions(status);
CREATE INDEX ix_instruments_calibration_due ON instruments(calibration_due);
CREATE INDEX ix_training_valid_until ON user_training_records(valid_until);
```

---

## 7. Data Retention

| Data Category | Retention | Basis |
|---|---|---|
| Electronic signatures | 15 years | 21 CFR Part 11 + EU GMP |
| Audit logs | 15 years | 21 CFR §11.10(e) |
| Results (DigitalLogbookEntry) | 15 years | 21 CFR Part 211 |
| Login audit logs | 3 years | 21 CFR §11.10(d) |
| Calibration records | 10 years | ISO 17025 |
| CoA PDFs | 15 years | 21 CFR 211.194 |

Retention period configured in `lab_config` — never hardcoded.

---

## 8. Normalizer Views

All dashboards and panels read from `vw_*` views. Same view drives every UI panel for that metric (Contract 2 — single source per metric).

| View | Purpose |
|---|---|
| `vw_active_spec_limits` | Active approved specs for form pre-population |
| `vw_instrument_status` | Instrument board + WAP availability check |
| `vw_training_currency` | Training current/expired per analyst per method |
| `vw_wip_summary` | Work-in-progress dashboard |
| `vw_tat_summary` | TAT overdue detection |
| `vw_quality_kpis` | OOS rate, first-pass yield |
| `vw_compliance_summary` | Audit trail + signature log combined view |
| `vw_sample_traceability` | Full FK-linked traceability chain |
