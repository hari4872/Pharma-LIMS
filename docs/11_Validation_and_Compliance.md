# Pharma LIMS — Validation and Compliance
### Architecture Document · v1.0 · 2026-05-27
**Standard:** GAMP 5 Category 5 · 21 CFR Part 11 · EU GMP Annex 11 · ALCOA+

---

## 1. Validation Classification

| Classification | Category | Rationale |
|---|---|---|
| **GAMP 5** | Category 5 — Custom Application | Custom-built, configurable laboratory system |
| **FDA** | Computerised System per 21 CFR Part 11 | Electronic records + electronic signatures |
| **EU GMP** | Annex 11 Computerised System | Automated data collection and processing |

---

## 2. Validation Lifecycle

### V-Model

```
User Requirements Specification (URS)
         │
         ▼
Functional Specification (FS)  ←→  Design Specification (DS)
         │                                   │
         ▼                                   ▼
    IQ (Installation Qualification) ←── Installation Verification
         │
         ▼
    OQ (Operational Qualification) ←── Functional Testing
         │
         ▼
    PQ (Performance Qualification) ←── Performance Testing
```

### IQ — Installation Qualification

| Test | Verification |
|---|---|
| .NET 8 runtime installed | Version: `dotnet --version` → 8.x |
| PostgreSQL 16 reachable | `psql -c "SELECT version();"` |
| All 29 EF migrations applied | `SELECT COUNT(*) FROM "__EFMigrationsHistory"` → 29 |
| JWT config present | `appsettings.json` has `Jwt:Key` (non-empty via env var) |
| CORS config present | Origins include production domain |
| Background jobs registered | 13 IHostedService registrations in DI container |

### OQ — Operational Qualification

| Test Case | Input | Expected Output | Regulation |
|---|---|---|---|
| OQ-001 | Login with correct credentials | JWT token returned; `LoginAuditLogs` row with outcome='Success' | §11.10(d) |
| OQ-002 | Login with wrong password 5× | HTTP 423; `LockedUntil` set; audit rows with outcome='Failed'/'LockedOut' | §11.10(d) |
| OQ-003 | Register sample, all 5 checks pass | Sample created; barcode log inserted; status='Registered' | §11.10(e) |
| OQ-004 | Register sample with expired lot | HTTP 422; sample NOT created | 21 CFR 211.170 |
| OQ-005 | E-sign SRF with wrong password | HTTP 422 ESIGN_AUTH_FAILED; signature NOT inserted | §11.300 |
| OQ-006 | E-sign SRF with correct password | Signature inserted; sample status='PendingTesting' | §11.50 |
| OQ-007 | Submit OOS result | `is_oos=true`; OOS investigation auto-created; `pass_fail='FAIL'` | FDA OOS Guidance |
| OQ-008 | Assign expired analyst to task | HTTP 422 TRAINING_EXPIRED | §11.10(i) |
| OQ-009 | Assign OOC instrument to task | HTTP 422 INSTRUMENT_OOC | 21 CFR 211.68 |
| OQ-010 | Amend a Signed logbook entry | Original superseded; amendment_reason captured; new Pending created | §11.10(e) |
| OQ-011 | Attempt to amend a Pending entry | HTTP 422 INVALID_STATE | §11.10(e) |
| OQ-012 | Split containers from InTesting sample | HTTP 422 INVALID_STATE | GMP chain of custody |
| OQ-013 | Digital logbook CSV export | All §11.50 fields present in output | §11.10(b) |
| OQ-014 | ICH Q1A regression endpoint | Returns slope, intercept, flag, predictedShelfLifeMonths | ICH Q1A |
| OQ-015 | Login audit history endpoint | Returns all attempts with outcome, timestamp, IP | §11.10(d) |

### PQ — Performance Qualification

| Test | Target | Measure |
|---|---|---|
| Traceability query (full chain) | < 2 seconds | Stopwatch on `GET /traceability/{sampleId}` |
| Sample registration (5 checks) | < 1 second | Stopwatch on `POST /samples` |
| Work queue load (100 items) | < 500ms | Stopwatch on `GET /test-executions` |
| Audit trail search (1 year data) | < 3 seconds | Stopwatch with `?from=&to=` filter |
| Concurrent users (10 analysts) | No data corruption | Load test: parallel result submissions |

---

## 3. 21 CFR Part 11 Clause-by-Clause Evidence

| Clause | Requirement | System Evidence |
|---|---|---|
| §11.10(a) | Validate that systems accurately and reliably perform their intended functions | GAMP 5 Cat 5 validation; IQ/OQ/PQ documented above |
| §11.10(b) | Generate accurate and complete paper copies of electronic records | `GET /digital-logbook/export` CSV with all §11.50 fields |
| §11.10(c) | Protect records to enable retrieval throughout their retention period | Soft-delete only; INSERT-only audit; PostgreSQL WAL + daily backup |
| §11.10(d) | Limit system access to authorised individuals | RBAC + login lockout (5 strikes → 30-min lock); LoginAuditLogs |
| §11.10(e) | Use of audit trails to independently record date/time of operator entries | INSERT-only audit tables; DB-level trigger enforcement |
| §11.10(f) | Use of operational system checks | State machine guards (e.g. amendment only on Signed entries) |
| §11.10(g) | Use of authority checks | Role checks in every handler; segregation of duties enforced |
| §11.10(h) | Use of device checks to determine validity of source of data | JWT token validated on every request; BCrypt.Verify on e-sig |
| §11.10(i) | Determination that persons who develop, maintain, or use electronic record/signature systems have the education, training, and experience | `user_training_records.valid_until` hard-block at WAP assignment |
| §11.50(a) | Signed electronic records shall contain: (1) printed name, (2) date and time, (3) meaning | `electronic_signatures.full_name`, `signed_at` (UTC), `meaning`, `reason` — all NOT NULL |
| §11.300 | Use of at least two distinct identification components such as an identification code and password | Username (JWT) + password (BCrypt.Verify) — both required for every e-sig |

---

## 4. ALCOA+ Evidence Matrix

| Principle | System Control | Where |
|---|---|---|
| **Attributable** | `analyst_id` FK on every logbook row; `full_name` on every e-sig | `digital_logbook_entries`, `electronic_signatures` |
| **Legible** | Structured typed fields; CSV/PDF export; no free-text overwrites | All tables; export endpoints |
| **Contemporaneous** | `DEFAULT NOW()` at DB level; `started_at` server-set on task open | `digital_logbook_entries.created_at`, `test_executions.started_at` |
| **Original** | `calculated_result` server-computed; analyst cannot override | `ParameterCalculationService` |
| **Accurate** | `AutoCorrectionService` applies auditable corrections from DB config | `digital_logbook_entries.auto_correction_applied` |
| **Complete** | All OOS must be closed before release; sign-off blocked without evidence | `QAReviewGateService`; `SignOffTestExecutionCommand` |
| **Consistent** | `parameter_id` FK — same parameter definition across all results | `digital_logbook_entries.parameter_id` |
| **Enduring** | Soft-delete only; INSERT-only audit; Superseded rows preserved | All tables; `digital_logbook_entries.superseded_by_id` |
| **Available** | Full chain retrievable on demand; paginated API; CSV export | `TraceabilityQueryService`; audit trail panel |

---

## 5. Annual Periodic Review (EU GMP Annex 11 §12.4)

| Activity | Frequency | Evidence |
|---|---|---|
| Re-execute IQ/OQ/PQ scripts | Annual | Test execution log in `validation_review_logs` |
| Review all `__EFMigrationsHistory` | Annual | Confirm all migrations intentional and approved |
| Audit trail integrity check | Annual | Confirm INSERT-only enforcement still active |
| Login lockout effectiveness | Annual | Review `LoginAuditLogs` for anomalies |
| Training records completeness | Annual | All active analysts have current training |
| Backup restore test | Annual | Restore to staging environment; verify data integrity |
| Change control review | Annual | All ADRs reviewed; any changes documented |

---

## 6. Change Control

All changes to the LIMS system must follow:

1. **Change Request** — documented rationale and regulatory impact assessment
2. **ADR created** — if architectural decision changes
3. **Test cases updated** — OQ test cases updated/added for new functionality
4. **Migration documented** — if DB schema changes, migration `.cs` file committed
5. **Re-validation** — affected OQ tests re-executed; results documented
6. **Approval** — QA sign-off before deployment to production
