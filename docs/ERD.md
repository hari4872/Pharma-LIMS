# Pharma LIMS — Entity Relationship Diagram (ERD)
**Coverage:** ALL Phases 1–12 (Built + Planned)  
**Database:** Neon PostgreSQL 16 via EF Core 8  
**Standard:** 21 CFR Part 11 / 21 CFR Part 211 / EU GMP Annex 11 / ALCOA+ / ICH Q1A / ISO 17025

---

## Status Legend
```
✅ BUILT    — code + migration exists
🔲 PLANNED  — from design docs, not yet coded
INS-ONLY    — INSERT only, no UPDATE/DELETE ever (21 CFR §11.10(e))
PK / FK / UQ / NN — standard constraint notation
```

---

## PHASE 1 — MASTER DATA MODULE ✅

### Laboratory ✅
```
LABORATORY
──────────────────────────────────────────────
PK  lab_id           INT         IDENTITY
UQ  lab_name         VARCHAR     NOT NULL
NN  location         VARCHAR
NN  lab_type         VARCHAR     (QC|RD|Stability|Microbiology)
    is_active        BOOLEAN     DEFAULT true
NN  created_by       VARCHAR
NN  created_at       TIMESTAMPTZ
```

### User ✅
```
USER
──────────────────────────────────────────────
PK  user_id          INT         IDENTITY
UQ  username         VARCHAR     NOT NULL
NN  password_hash    VARCHAR
NN  full_name        VARCHAR
NN  email            VARCHAR
NN  user_type        VARCHAR     (Admin|RegularUser)
NN  role             VARCHAR     (Admin|QA|QCLead|Analyst|LabManager|Viewer)
FK  lab_id           INT         → LABORATORY  (NULL = system admin)
    is_active        BOOLEAN     DEFAULT true
    is_tenant_admin  BOOLEAN     DEFAULT false
NN  created_by       VARCHAR
NN  created_at       TIMESTAMPTZ
```

### ElectronicSignature — INS-ONLY (21 CFR §11.50) ✅
```
ELECTRONIC_SIGNATURE
──────────────────────────────────────────────
PK  signature_id     INT         IDENTITY
FK  user_id          INT         → USER  RESTRICT
NN  full_name        VARCHAR     (§11.50 printed name)
NN  signed_at        TIMESTAMPTZ (§11.50 UTC server-side only)
NN  meaning          VARCHAR     (§11.50 meaning of signature)
NN  reason           VARCHAR     (§11.50 reason for signing)
NN  action_type      VARCHAR     (Approve|SignOff|PeerReview|QCLeadVerify|CloseOOS|etc.)
```
> Never updated or deleted. Every sign-off = new row. Password re-entry via BCrypt.Verify (§11.300).

### Instrument ✅
```
INSTRUMENT
──────────────────────────────────────────────
PK  instrument_id    INT         IDENTITY
FK  lab_id           INT         → LABORATORY  CASCADE
UQ  instrument_code  VARCHAR     NOT NULL
NN  instrument_type  VARCHAR
    model            VARCHAR
    serial_number    VARCHAR
NN  calibration_due  DATE
NN  status           VARCHAR     (Available|InUse|Maintenance|OutOfCalibration)
    is_active        BOOLEAN     DEFAULT true
NN  created_by       VARCHAR
NN  created_at       TIMESTAMPTZ
```

### CalibrationRecord — INS-ONLY ✅
```
CALIBRATION_RECORD
──────────────────────────────────────────────
PK  record_id        INT         IDENTITY
FK  instrument_id    INT         → INSTRUMENT  CASCADE
NN  calibrated_on    DATE
NN  calibrated_by    VARCHAR
NN  next_due         DATE
    certificate_ref  VARCHAR
NN  created_at       TIMESTAMPTZ
```

### InstrumentBreakdown ✅
```
INSTRUMENT_BREAKDOWN
──────────────────────────────────────────────
PK  breakdown_id     INT         IDENTITY
FK  instrument_id    INT         → INSTRUMENT  CASCADE
FK  raised_by        INT         → USER  RESTRICT
NN  raised_at        TIMESTAMPTZ
NN  issue_desc       TEXT
NN  status           VARCHAR     (Open|InRepair|Resolved)
FK  return_sig_id    INT         → ELECTRONIC_SIGNATURE  NULL
```

### InstrumentRepair ✅
```
INSTRUMENT_REPAIR
──────────────────────────────────────────────
PK  repair_id        INT         IDENTITY
FK  breakdown_id     INT         → INSTRUMENT_BREAKDOWN  CASCADE
NN  technician       VARCHAR
NN  repair_date      DATE
NN  repair_desc      TEXT
    parts_used       TEXT
NN  recorded_by      VARCHAR
NN  recorded_at      TIMESTAMPTZ
```

### InstrumentUtilisationSummary 🔲 (Phase 8)
```
INSTRUMENT_UTILISATION_SUMMARY
──────────────────────────────────────────────
PK  summary_id       INT         IDENTITY
FK  instrument_id    INT         → INSTRUMENT  CASCADE
NN  window_days      INT         (7|30|90 — from lab_config)
NN  window_start     TIMESTAMPTZ
NN  window_end       TIMESTAMPTZ
NN  total_tests      INT         DEFAULT 0
NN  total_hours      DECIMAL(10,2) DEFAULT 0
    utilisation_pct  DECIMAL(5,2)
NN  calculated_at    TIMESTAMPTZ
```

### Material ✅
```
MATERIAL
──────────────────────────────────────────────
PK  material_id      INT         IDENTITY
NN  material_name    VARCHAR
NN  material_type    VARCHAR     (RawMaterial|IntermediateProduct|FinishedProduct|Reagent|Standard)
NN  uom              VARCHAR
NN  shelf_life_days  INT
    product_type     VARCHAR
    is_active        BOOLEAN     DEFAULT true
NN  created_by       VARCHAR
NN  created_at       TIMESTAMPTZ
```

### TestMethod ✅
```
TEST_METHOD
──────────────────────────────────────────────
PK  method_id        INT         IDENTITY
UQ  method_code      VARCHAR     NOT NULL
NN  method_name      VARCHAR
    sop_reference    VARCHAR
    method_type      VARCHAR
NN  status           VARCHAR     (Draft|Approved|Retired)
NN  version          VARCHAR     DEFAULT '1.0'
    approved_by      VARCHAR
    approved_at      TIMESTAMPTZ
FK  signature_id     INT         → ELECTRONIC_SIGNATURE  NULL
    is_active        BOOLEAN     DEFAULT true
NN  created_by       VARCHAR
NN  created_at       TIMESTAMPTZ
```

### TestMethodParameter ✅
```
TEST_METHOD_PARAMETER
──────────────────────────────────────────────
PK  parameter_id     INT         IDENTITY
FK  method_id        INT         → TEST_METHOD  CASCADE
NN  parameter_name   VARCHAR
NN  data_type        VARCHAR     (Numeric|Text|PassFail)
NN  uom              VARCHAR
    calc_formula     VARCHAR
NN  formula_type     VARCHAR     (Expression|TableLookup)
    is_critical      BOOLEAN     DEFAULT false
    is_active        BOOLEAN     DEFAULT true
NN  display_order    INT
NN  created_by       VARCHAR
NN  created_at       TIMESTAMPTZ
```

### ParameterLookupTable + ParameterLookupRow ✅
```
PARAMETER_LOOKUP_TABLE
──────────────────────────────────────────────
PK  table_id         INT         IDENTITY
FK  parameter_id     INT         → TEST_METHOD_PARAMETER  CASCADE
NN  table_name       VARCHAR

PARAMETER_LOOKUP_ROW
──────────────────────────────────────────────
PK  row_id           INT         IDENTITY
FK  table_id         INT         → PARAMETER_LOOKUP_TABLE  CASCADE
NN  input_min        DECIMAL(18,6)
NN  input_max        DECIMAL(18,6)
NN  output_value     DECIMAL(18,6)
```

### SpecLimit ✅
```
SPEC_LIMIT
──────────────────────────────────────────────
PK  spec_limit_id    INT         IDENTITY
FK  parameter_id     INT         → TEST_METHOD_PARAMETER  CASCADE
FK  material_id      INT         → MATERIAL  NULL  SET NULL
NN  stage            VARCHAR     (Incoming|InProcess|Finished|Stability)
    min_value        DECIMAL(18,6)
    max_value        DECIMAL(18,6)
    regulatory_tier  VARCHAR     (USP|EP|ISO|MS|Internal)
    regulatory_min   DECIMAL(18,6)
    regulatory_max   DECIMAL(18,6)
    oot_min_value    DECIMAL(18,6)
    oot_max_value    DECIMAL(18,6)
NN  status           VARCHAR     (Draft|Approved|Retired)
NN  version          VARCHAR     DEFAULT '1.0'
    approved_by      VARCHAR
    approved_at      TIMESTAMPTZ
FK  signature_id     INT         → ELECTRONIC_SIGNATURE  NULL
    is_active        BOOLEAN     DEFAULT true
NN  created_by       VARCHAR
NN  created_at       TIMESTAMPTZ
```

### FormTemplate + Locations + Parameters ✅
```
FORM_TEMPLATE
──────────────────────────────────────────────
PK  form_template_id INT         IDENTITY
UQ  form_code        VARCHAR     NOT NULL
NN  form_name        VARCHAR
FK  lab_id           INT         → LABORATORY  CASCADE
NN  form_type        VARCHAR     (Single|Grouped)
NN  trigger_type     VARCHAR     (TimeBased|OperatorScan|ProcessLog|DispatchEvent)
    time_slots       JSONB       (from lab_config — not hardcoded)
    shift_interval_hrs INT
    regulatory_tier  VARCHAR
    evidence_mandatory BOOLEAN   DEFAULT false
    field_definitions_json TEXT        (nullable — JSON array of custom field definitions)
NN  status           VARCHAR     (Draft|Active|Retired)
NN  version          VARCHAR
    approved_by      VARCHAR
    approved_at      TIMESTAMPTZ
FK  signature_id     INT         → ELECTRONIC_SIGNATURE  NULL
    is_active        BOOLEAN     DEFAULT true
NN  created_by       VARCHAR
NN  created_at       TIMESTAMPTZ

FORM_TEMPLATE_LOCATION
──────────────────────────────────────────────
PK  location_id      INT         IDENTITY
FK  form_template_id INT         → FORM_TEMPLATE  CASCADE
NN  column_order     INT
NN  location_name    VARCHAR
FK  spec_limit_id    INT         → SPEC_LIMIT  NULL  (FK reference only — no copy)

FORM_TEMPLATE_PARAMETER
──────────────────────────────────────────────
PK/FK form_template_id INT       → FORM_TEMPLATE  CASCADE
PK/FK parameter_id    INT        → TEST_METHOD_PARAMETER  CASCADE
NN  display_order     INT
    column_frequency  VARCHAR    (Daily|Weekly|Periodic)
```

### LabConfig ✅
```
LAB_CONFIG
──────────────────────────────────────────────
PK  config_id        INT         IDENTITY
FK  lab_id           INT         → LABORATORY  CASCADE
UQ  (lab_id, key)
NN  key              VARCHAR
NN  value            TEXT        (plain text or JSONB for complex config)
```
> Key examples: `tat_days`, `work_queue_escalation_minutes`, `auto_correction_{paramName}`, `time_slots`, `coa_number_format`, `oot_gate_enabled`, `utilisation_window_days`

### UserTrainingRecord ✅
```
USER_TRAINING_RECORD
──────────────────────────────────────────────
PK  record_id        INT         IDENTITY
FK  user_id          INT         → USER  CASCADE
NN  method_code      VARCHAR
NN  completed_on     DATE
NN  valid_until      DATE        ← hard block in WAP assignment
    certificate_ref  VARCHAR
NN  created_by       VARCHAR
NN  created_at       TIMESTAMPTZ
```

### MasterDataAuditLog — INS-ONLY (21 CFR §11.10(e)) ✅
```
MASTER_DATA_AUDIT_LOG
──────────────────────────────────────────────
PK  log_id           BIGINT      IDENTITY
NN  entity_type      VARCHAR
NN  entity_id        INT
NN  action           VARCHAR     (Create|Update|Approve|Retire)
NN  changed_by       VARCHAR
NN  changed_at       TIMESTAMPTZ
    old_values       JSONB
    new_values       JSONB
```

### SampleType ✅
```
SAMPLE_TYPE
──────────────────────────────────────────────
PK  type_id          INT         IDENTITY
UQ  type_code        VARCHAR     NOT NULL
NN  type_name        VARCHAR
    description      TEXT
    is_active        BOOLEAN     DEFAULT true
NN  created_by       VARCHAR
NN  created_at       TIMESTAMPTZ
```

---

## PHASE 1b — CHECKPOINTS MODULE ✅

### Checkpoint ✅
```
CHECKPOINT
──────────────────────────────────────────────
PK  checkpoint_id    INT         IDENTITY
UQ  checkpoint_code  VARCHAR     NOT NULL
FK  lab_id           INT         → LABORATORY  CASCADE
NN  trigger_mode     VARCHAR     (TimeBased|OperatorScan|ProcessLog|DispatchEvent)
NN  checkpoint_type  VARCHAR     (Single|Grouped)
    time_slots       JSONB
    shift_interval_hrs INT
    is_active        BOOLEAN     DEFAULT true
```

### CheckpointLocation ✅
```
CHECKPOINT_LOCATION
──────────────────────────────────────────────
PK  location_id      INT         IDENTITY
FK  checkpoint_id    INT         → CHECKPOINT  CASCADE
NN  column_order     INT
NN  location_name    VARCHAR
FK  spec_limit_id    INT         → SPEC_LIMIT  NULL  (FK only — no copy)
```

### CheckpointTriggerLog — INS-ONLY ✅
```
CHECKPOINT_TRIGGER_LOG
──────────────────────────────────────────────
PK  trigger_id       BIGINT      IDENTITY
FK  checkpoint_id    INT         → CHECKPOINT  RESTRICT
NN  trigger_mode     VARCHAR     (stored as string for immutability)
    triggered_by     VARCHAR
NN  triggered_at     TIMESTAMPTZ (server-side UTC — ALCOA+ Contemporaneous)
    delivery_order   VARCHAR     (Mode 4 reference)
    is_offline_sync  BOOLEAN     DEFAULT false   (EU Annex 11 §4.3)
```

### ProcessLogRow ✅
```
PROCESS_LOG_ROW
──────────────────────────────────────────────
PK  row_id           INT         IDENTITY
FK  checkpoint_id    INT         → CHECKPOINT  CASCADE
NN  slot_time        TIMESTAMPTZ (server-side UTC)
NN  slot_label       VARCHAR
NN  status           VARCHAR     (Open|Signed|Locked)
FK  signature_id     INT         → ELECTRONIC_SIGNATURE  NULL
```

---

## PHASE 2 — SAMPLE REGISTRATION MODULE ✅

### Sample ✅
```
SAMPLE
──────────────────────────────────────────────
PK  sample_id        INT         IDENTITY
UQ  sample_number    VARCHAR     NOT NULL  (server-generated — ISampleIdFormatService)
FK  lab_id           INT         → LABORATORY  RESTRICT
FK  material_id      INT         → MATERIAL  RESTRICT
NN  lot_number       VARCHAR
NN  mfg_date         DATE
NN  exp_date         DATE
NN  sample_type      VARCHAR     (FK-ref to SAMPLE_TYPE.type_code)
FK  form_template_id INT         → FORM_TEMPLATE  NULL
FK  srf_signature_id INT         → ELECTRONIC_SIGNATURE  NULL
NN  status           VARCHAR     (Registered|PendingTesting|InTesting|PendingQAReview|Released|Rejected)
    barcode_printed  BOOLEAN     DEFAULT false
    barcode_printed_at TIMESTAMPTZ
    due_date         TIMESTAMPTZ (server-calc from tat_days lab_config)
FK  analyst_id       INT         → USER  RESTRICT  (ALCOA+ Attributable)
NN  created_by       VARCHAR
NN  created_at       TIMESTAMPTZ
```

### BarcodePrintLog — INS-ONLY (21 CFR 211.170) ✅
```
BARCODE_PRINT_LOG
──────────────────────────────────────────────
PK  print_id         INT         IDENTITY
FK  sample_id        INT         → SAMPLE  CASCADE
NN  print_type       VARCHAR     (AutoOnRegistration|Reprint)
NN  printed_by       VARCHAR
NN  printed_at       TIMESTAMPTZ
    reason           VARCHAR     (mandatory for Reprint)
```

---

## PHASE 3 — TESTING EXECUTION MODULE ✅

### TestExecution ✅
```
TEST_EXECUTION
──────────────────────────────────────────────
PK  execution_id     INT         IDENTITY
FK  sample_id        INT         → SAMPLE  RESTRICT
FK  instrument_id    INT         → INSTRUMENT  RESTRICT
FK  analyst_id       INT         → USER  RESTRICT
FK  assigned_by_id   INT         → USER  NULL  RESTRICT   (WAP assignor)
FK  form_template_id INT         → FORM_TEMPLATE  NULL
NN  status           VARCHAR     (Assigned|InProgress|Completed|OOSOpen)
NN  entry_method     VARCHAR     (Manual|FileImport)
    auto_corrected   BOOLEAN     DEFAULT false
    correction_type  VARCHAR
    priority_score   INT
    started_at       TIMESTAMPTZ (ALCOA+ Contemporaneous — server-set)
    completed_at     TIMESTAMPTZ
NN  created_by       VARCHAR
NN  created_at       TIMESTAMPTZ
```

### DigitalLogbookEntry — INS-ONLY (ALCOA+ Enduring) ✅
```
DIGITAL_LOGBOOK_ENTRY
──────────────────────────────────────────────
PK  entry_id             INT         IDENTITY
FK  sample_id            INT         → SAMPLE  RESTRICT
FK  execution_id         INT         → TEST_EXECUTION  CASCADE
FK  parameter_id         INT         → TEST_METHOD_PARAMETER  RESTRICT
NN  trigger_source       VARCHAR     (TimeBased|OperatorScan|ProcessLog|DispatchEvent)
NN  raw_value            VARCHAR     (ALCOA+ Original — analyst entry, never overridden)
    calculated_result    DECIMAL(18,6) (server-computed — read-only)
    auto_correction_applied BOOLEAN  DEFAULT false
    correction_detail    VARCHAR
    spec_min_snapshot    DECIMAL(18,6) ← frozen at test time (ALCOA+ Enduring)
    spec_max_snapshot    DECIMAL(18,6)
    oot_min_snapshot     DECIMAL(18,6)
    oot_max_snapshot     DECIMAL(18,6)
    regulatory_tier_snapshot VARCHAR
NN  pass_fail            VARCHAR     DEFAULT 'PASS'  (server-set — OosDetectionService)
    is_oos               BOOLEAN     DEFAULT false   (server-set)
    is_oot               BOOLEAN     DEFAULT false   (server-set)
FK  instrument_id        INT         → INSTRUMENT  NULL
FK  analyst_id           INT         → USER  RESTRICT
FK  signature_id         INT         → ELECTRONIC_SIGNATURE  NULL
    evidence_file_ref    VARCHAR     (mandatory if is_critical before sign-off)
NN  status               VARCHAR     (Pending|Signed|Superseded)
FK  superseded_by_id     INT         → DIGITAL_LOGBOOK_ENTRY  NULL  (self-ref)
NN  created_at           TIMESTAMPTZ
```

### OosInvestigation ✅
```
OOS_INVESTIGATION
──────────────────────────────────────────────
PK  investigation_id INT         IDENTITY
FK  execution_id     INT         → TEST_EXECUTION  RESTRICT
FK  entry_id         INT         → DIGITAL_LOGBOOK_ENTRY  RESTRICT
FK  parameter_id     INT         → TEST_METHOD_PARAMETER  RESTRICT
NN  flag_type        VARCHAR     (OOS|OOT)
NN  phase            VARCHAR     (Phase1|Phase2)
NN  status           VARCHAR     (Open|Closed)
    root_cause       TEXT        (mandatory on close — FDA OOS Guidance 2006)
    capa_ref         VARCHAR
FK  signature_id     INT         → ELECTRONIC_SIGNATURE  NULL
NN  opened_at        TIMESTAMPTZ
    closed_at        TIMESTAMPTZ
NN  created_by       VARCHAR
```

### ResultsReview — 4-Eyes Principle ✅
```
RESULTS_REVIEW
──────────────────────────────────────────────
PK  review_id        INT         IDENTITY
FK  sample_id        INT         → SAMPLE  RESTRICT
FK  execution_id     INT         → TEST_EXECUTION  RESTRICT
NN  review_type      VARCHAR     (PeerReview|QCLeadVerification)
FK  reviewer_id      INT         → USER  RESTRICT
FK  signature_id     INT         → ELECTRONIC_SIGNATURE  NOT NULL RESTRICT
NN  reviewed_at      TIMESTAMPTZ
    notes            TEXT
```
> Peer: reviewer_id ≠ analyst_id enforced at API.  
> QCLead: reviewer_id ≠ analyst_id AND ≠ peer_reviewer_id enforced at API.

### ResultEvidence ✅
```
RESULT_EVIDENCE
──────────────────────────────────────────────
PK  evidence_id      INT         IDENTITY
FK  entry_id         INT         → DIGITAL_LOGBOOK_ENTRY  CASCADE
FK  sample_id        INT         → SAMPLE  RESTRICT
NN  file_ref         VARCHAR
    description      TEXT
FK  uploaded_by_id   INT         → USER  RESTRICT
NN  uploaded_at      TIMESTAMPTZ
```

---

## PHASE 5 — QA REVIEW & RELEASE 🔲

### CoaApproval — INS-ONLY (EU Annex 11 §13) 🔲
```
COA_APPROVAL
──────────────────────────────────────────────
PK  approval_id      INT         IDENTITY
FK  sample_id        INT         → SAMPLE  RESTRICT
FK  coa_id           INT         → COA  RESTRICT
NN  decision         VARCHAR     (Approved|Rejected)
    justification    TEXT        (mandatory for Rejected)
FK  signature_id     INT         → ELECTRONIC_SIGNATURE  NOT NULL RESTRICT
NN  decided_at       TIMESTAMPTZ
```
> DB trigger prevents UPDATE where decision = 'Rejected' (EU Annex 11 §13 — immutable even after restore)

---

## PHASE 6 — TRACEABILITY 🔲

### SamplingEvent 🔲
```
SAMPLING_EVENT
──────────────────────────────────────────────
PK  sampling_event_id INT        IDENTITY
FK  sample_id        INT         → SAMPLE  RESTRICT
FK  sampled_by       INT         → USER  RESTRICT
NN  sampled_at       TIMESTAMPTZ (UTC server-side — ALCOA+ Contemporaneous)
    location         VARCHAR
    quantity_taken   DECIMAL(10,3)
    quantity_uom     VARCHAR
    container_id     VARCHAR
    notes            TEXT
```

### ComplaintsDeviations 🔲
```
COMPLAINTS_DEVIATIONS
──────────────────────────────────────────────
PK  cd_id            INT         IDENTITY
FK  sample_id        INT         → SAMPLE  RESTRICT
NN  cd_type          VARCHAR     (Complaint|Deviation|CAPA)
NN  cd_reference     VARCHAR
    description      TEXT
NN  status           VARCHAR     DEFAULT 'Open'
NN  opened_by        VARCHAR
NN  opened_at        TIMESTAMPTZ
    resolved_at      TIMESTAMPTZ
FK  linked_oos_id    INT         → OOS_INVESTIGATION  NULL
```

### TraceQueryLog — INS-ONLY 🔲
```
TRACE_QUERY_LOG
──────────────────────────────────────────────
PK  log_id           BIGINT      IDENTITY
FK  queried_by       INT         → USER  RESTRICT
NN  queried_at       TIMESTAMPTZ
NN  filter_params    JSONB       (batch, lot, date, analyst, instrument)
    result_count     INT
```

---

## PHASE 7 — SAMPLE INVENTORY & PULL PLANNING 🔲

### StorageLocation 🔲
```
STORAGE_LOCATION
──────────────────────────────────────────────
PK  location_id      INT         IDENTITY
FK  lab_id           INT         → LABORATORY  CASCADE
UQ  location_code    VARCHAR     NOT NULL
NN  location_name    VARCHAR
NN  location_type    VARCHAR     (Ambient|Cold|Freezer|StabilityChamber)
    temp_min_c       DECIMAL(5,1)
    temp_max_c       DECIMAL(5,1)
    humidity_min_pct DECIMAL(5,1)
    humidity_max_pct DECIMAL(5,1)
    low_stock_threshold INT       (configurable alert threshold)
    is_active        BOOLEAN     DEFAULT true
```

### StorageTransferLog — INS-ONLY (21 CFR 211.170) 🔲
```
STORAGE_TRANSFER_LOG
──────────────────────────────────────────────
PK  transfer_id      INT         IDENTITY
FK  sample_id        INT         → SAMPLE  RESTRICT
FK  from_location_id INT         → STORAGE_LOCATION  RESTRICT
FK  to_location_id   INT         → STORAGE_LOCATION  RESTRICT
NN  transferred_by   VARCHAR
NN  transferred_at   TIMESTAMPTZ
    reason           TEXT
```

### ConditionExcursion 🔲
```
CONDITION_EXCURSION
──────────────────────────────────────────────
PK  excursion_id     INT         IDENTITY
FK  location_id      INT         → STORAGE_LOCATION  RESTRICT
NN  excursion_type   VARCHAR     (Temperature|Humidity|Light)
NN  measured_value   DECIMAL(8,2)
NN  limit_exceeded   VARCHAR     (Min|Max)
NN  excursion_start  TIMESTAMPTZ
    excursion_end    TIMESTAMPTZ
NN  recorded_by      VARCHAR
NN  recorded_at      TIMESTAMPTZ
    impact_assessed  BOOLEAN     DEFAULT false
    impact_outcome   TEXT
```

### StabilityPull 🔲
```
STABILITY_PULL
──────────────────────────────────────────────
PK  pull_id          INT         IDENTITY
FK  sample_id        INT         → SAMPLE  RESTRICT
NN  time_point       VARCHAR     (T0|T3M|T6M|T9M|T12M|T18M|T24M)
NN  due_date         DATE        (server-calc from T0 + time_point — Contract 2)
    actual_date      DATE
    required_qty     DECIMAL(10,3)
    actual_qty       DECIMAL(10,3)
FK  pull_signature_id INT        → ELECTRONIC_SIGNATURE  NULL
NN  status           VARCHAR     (Pending|Pulled|Missed|Short)
```

### ShortPullDeviation 🔲
```
SHORT_PULL_DEVIATION
──────────────────────────────────────────────
PK  deviation_id     INT         IDENTITY
FK  pull_id          INT         → STABILITY_PULL  RESTRICT
NN  required_qty     DECIMAL(10,3)
NN  actual_qty       DECIMAL(10,3)
NN  shortfall        DECIMAL(10,3)
NN  reason           TEXT        (mandatory before pull can complete)
NN  logged_by        VARCHAR
NN  logged_at        TIMESTAMPTZ
```

### RetainSample 🔲
```
RETAIN_SAMPLE
──────────────────────────────────────────────
PK  retain_id        INT         IDENTITY
FK  sample_id        INT         → SAMPLE  RESTRICT
FK  location_id      INT         → STORAGE_LOCATION  RESTRICT
NN  lot_number       VARCHAR
NN  quantity         DECIMAL(10,3)
NN  quantity_uom     VARCHAR
NN  retention_until  DATE        (server-calc from shelf_life_days + 1yr — not hardcoded)
    destruction_sig_id INT       → ELECTRONIC_SIGNATURE  NULL
    destroyed_at     TIMESTAMPTZ
NN  created_at       TIMESTAMPTZ
```

---

## PHASE 9 — COA GENERATION 🔲

### DeliveryOrder 🔲  *(also used by Phase 10)*
```
DELIVERY_ORDER
──────────────────────────────────────────────
PK  do_id            INT         IDENTITY
UQ  do_number        VARCHAR     NOT NULL
    customer_name    VARCHAR
    despatch_date    DATE
    packing_type     VARCHAR
FK  product_id       INT         → MATERIAL  RESTRICT
NN  status           VARCHAR     (Pending|InDispatchQC|CLEARED|BLOCKED)
NN  created_at       TIMESTAMPTZ
```

### Coa 🔲
```
COA
──────────────────────────────────────────────
PK  coa_id           INT         IDENTITY
FK  sample_id        INT         → SAMPLE  RESTRICT
UQ  coa_number       VARCHAR     NOT NULL  (server-generated from lab_config format)
FK  form_template_id INT         → FORM_TEMPLATE  RESTRICT
FK  delivery_order_id INT        → DELIVERY_ORDER  NULL
NN  status           VARCHAR     (Draft|Released|Superseded)
    locked_at        TIMESTAMPTZ (set atomically on QA e-sig)
    pdf_blob         BYTEA       (server-locked PDF — EU Annex 11 §11)
FK  qa_signature_id  INT         → ELECTRONIC_SIGNATURE  NULL
FK  superseded_by    INT         → COA  NULL             (ALCOA+ Enduring)
NN  created_at       TIMESTAMPTZ
```

### CoaLine 🔲
```
COA_LINE
──────────────────────────────────────────────
PK  coa_line_id      INT         IDENTITY
FK  coa_id           INT         → COA  CASCADE
FK  entry_id         INT         → DIGITAL_LOGBOOK_ENTRY  RESTRICT
FK  parameter_id     INT         → TEST_METHOD_PARAMETER  RESTRICT
NN  display_order    INT
```

### CoaDistributionLog — INS-ONLY 🔲
```
COA_DISTRIBUTION_LOG
──────────────────────────────────────────────
PK  log_id           BIGINT      IDENTITY
FK  coa_id           INT         → COA  RESTRICT
NN  channel          VARCHAR     (ERP|Archive|Email)
NN  sent_at          TIMESTAMPTZ
NN  status           VARCHAR     (Sent|Failed)
```

---

## PHASE 10 — DISPATCH QC 🔲

### DispatchQcTask 🔲
```
DISPATCH_QC_TASK
──────────────────────────────────────────────
PK  task_id          INT         IDENTITY
FK  do_id            INT         → DELIVERY_ORDER  RESTRICT
FK  sample_id        INT         → SAMPLE  RESTRICT
FK  execution_id     INT         → TEST_EXECUTION  NULL
FK  form_template_id INT         → FORM_TEMPLATE  RESTRICT
NN  status           VARCHAR     (Open|InProgress|Passed|Failed|QAApproved)
NN  created_at       TIMESTAMPTZ
```

---

## FULL ENTITY RELATIONSHIP TREE

```
LABORATORY
  ├── has many ──► INSTRUMENT
  │                    ├── has many ──► CALIBRATION_RECORD (INS-ONLY)
  │                    ├── has many ──► INSTRUMENT_BREAKDOWN
  │                    │                    └── has many ──► INSTRUMENT_REPAIR
  │                    └── has many ──► INSTRUMENT_UTILISATION_SUMMARY 🔲
  ├── has many ──► LAB_CONFIG
  ├── has many ──► FORM_TEMPLATE
  │                    ├── has many ──► FORM_TEMPLATE_LOCATION → SPEC_LIMIT
  │                    └── has many ──► FORM_TEMPLATE_PARAMETER → TEST_METHOD_PARAMETER
  ├── has many ──► CHECKPOINT
  │                    ├── has many ──► CHECKPOINT_LOCATION → SPEC_LIMIT
  │                    ├── has many ──► CHECKPOINT_TRIGGER_LOG (INS-ONLY)
  │                    └── has many ──► PROCESS_LOG_ROW → ELECTRONIC_SIGNATURE
  ├── has many ──► STORAGE_LOCATION 🔲
  │                    ├── has many ──► STORAGE_TRANSFER_LOG (INS-ONLY) 🔲
  │                    └── has many ──► CONDITION_EXCURSION 🔲
  └── has many ──► USER
                       ├── has many ──► USER_TRAINING_RECORD
                       └── has many ──► ELECTRONIC_SIGNATURE (INS-ONLY)

MATERIAL
  └── has many ──► SPEC_LIMIT
  └── has many ──► DELIVERY_ORDER 🔲

TEST_METHOD
  └── has many ──► TEST_METHOD_PARAMETER
                       ├── has many ──► SPEC_LIMIT
                       ├── has many ──► PARAMETER_LOOKUP_TABLE
                       │                    └── has many ──► PARAMETER_LOOKUP_ROW
                       └── referenced by ──► FORM_TEMPLATE_PARAMETER (FK only)

SAMPLE
  ├── belongs to ──► LABORATORY
  ├── belongs to ──► MATERIAL
  ├── belongs to ──► FORM_TEMPLATE (optional)
  ├── belongs to ──► USER (analyst)
  ├── belongs to ──► ELECTRONIC_SIGNATURE (srf_signature — optional)
  ├── has many ──► BARCODE_PRINT_LOG (INS-ONLY)
  ├── has many ──► SAMPLING_EVENT 🔲
  ├── has many ──► STABILITY_PULL 🔲
  │                    └── has one  ──► SHORT_PULL_DEVIATION 🔲
  ├── has many ──► RETAIN_SAMPLE 🔲
  ├── has many ──► COMPLAINTS_DEVIATIONS 🔲
  └── has many ──► TEST_EXECUTION
                       ├── belongs to ──► INSTRUMENT
                       ├── belongs to ──► USER (analyst)
                       ├── belongs to ──► USER (assigned_by — optional)
                       ├── belongs to ──► FORM_TEMPLATE (optional)
                       ├── has many ──► DIGITAL_LOGBOOK_ENTRY
                       │                    ├── belongs to ──► TEST_METHOD_PARAMETER
                       │                    ├── belongs to ──► INSTRUMENT (optional)
                       │                    ├── belongs to ──► USER (analyst)
                       │                    ├── belongs to ──► ELECTRONIC_SIGNATURE (optional)
                       │                    ├── self-ref ──► DIGITAL_LOGBOOK_ENTRY (superseded_by)
                       │                    ├── has many ──► RESULT_EVIDENCE
                       │                    └── referenced by ──► COA_LINE 🔲
                       ├── has many ──► OOS_INVESTIGATION
                       │                    ├── belongs to ──► DIGITAL_LOGBOOK_ENTRY
                       │                    ├── belongs to ──► TEST_METHOD_PARAMETER
                       │                    └── belongs to ──► ELECTRONIC_SIGNATURE (optional)
                       └── has many ──► RESULTS_REVIEW
                                            ├── belongs to ──► USER (reviewer)
                                            └── belongs to ──► ELECTRONIC_SIGNATURE (mandatory)

COA 🔲
  ├── belongs to ──► SAMPLE
  ├── belongs to ──► FORM_TEMPLATE
  ├── belongs to ──► DELIVERY_ORDER (optional)
  ├── belongs to ──► ELECTRONIC_SIGNATURE (qa_signature)
  ├── self-ref ──► COA (superseded_by — ALCOA+ Enduring)
  ├── has many ──► COA_LINE → DIGITAL_LOGBOOK_ENTRY
  ├── has many ──► COA_DISTRIBUTION_LOG (INS-ONLY)
  └── has many ──► COA_APPROVAL (INS-ONLY) 🔲

DELIVERY_ORDER 🔲
  ├── belongs to ──► MATERIAL (product_id)
  └── has many ──► DISPATCH_QC_TASK 🔲
                       ├── belongs to ──► SAMPLE
                       ├── belongs to ──► TEST_EXECUTION (optional)
                       └── belongs to ──► FORM_TEMPLATE
```

---

## NORMALIZER VIEWS REGISTRY (All Phases)

| View | Phase | Drives | Key Source Tables |
|------|-------|--------|-------------------|
| `vw_active_spec_limits` | 1 | Form pre-population, CoA lines | `spec_limits` (Approved) |
| `vw_form_template_active` | 1c | Form Template selector | `form_templates` (Active) |
| `vw_instrument_status` | 8 | Instrument board, WAP gate | `instruments`, `test_executions`, `instrument_breakdowns`, `calibration_records` |
| `vw_training_currency` | 1 | Test registration gate | `user_training_records` |
| `vw_wip_summary` | 11 | WIP dashboard panel | `samples`, `test_executions` |
| `vw_tat_summary` | 11 | TAT dashboard panel | `samples`, `test_executions`, `lab_config` |
| `vw_quality_kpis` | 11 | Quality KPI panel | `digital_logbook_entries`, `oos_investigations` |
| `vw_instrument_utilisation` | 8/11 | Utilisation panel | `instrument_utilisation_summary` |
| `vw_compliance_summary` | 12 | Audit trail + sig log | All audit tables, `electronic_signatures`, `oos_investigations` |
| `vw_alert_queue` | 11 | Active alerts for SignalR | All monitoring tables — thresholds from `lab_config` |
| `vw_qa_checklist` | 5 | QA 10-item checklist | `test_executions`, `oos_investigations`, `digital_logbook_entries`, `results_reviews`, `coas` |
| `vw_coa_preview` | 9 | QA CoA review + PDF gen | `digital_logbook_entries`, `coa_lines`, `delivery_orders`, `materials` |
| `vw_coa_history` | 9/11 | CoA history panel | `coas`, `samples`, `materials` |
| `vw_sample_traceability` | 6 | Traceability graph + recall | All FK-linked tables via `digital_logbook_entries` |
| `vw_storage_inventory` | 7 | Storage inventory panel | `retain_samples`, `storage_locations` |

---

## KEY REGULATORY CONSTRAINTS

| Rule | Entities | Regulation |
|------|----------|------------|
| 4-field e-sig (FullName+SignedAt+Meaning+Reason) NOT NULL | ElectronicSignature | 21 CFR §11.50 |
| BCrypt.Verify independent of session token | All sign-off flows | 21 CFR §11.300 |
| INSERT-only audit tables | E-Sig, BarcodeLog, TriggerLog, CalRecord, AuditLog, CoaDistLog, TraceQueryLog | 21 CFR §11.10(e) |
| Rejection INSERT-only + DB trigger blocks UPDATE | CoaApproval (Rejected) | EU Annex 11 §13 |
| ALCOA+ Contemporaneous — all timestamps server-side | started_at, triggered_at, signed_at, created_at | ALCOA+ |
| ALCOA+ Enduring — spec snapshot frozen at test time | DigitalLogbookEntry spec_*_snapshot | ALCOA+ |
| 4-Eyes Peer ≠ Analyst | ResultsReview (PeerReview) | 21 CFR §11.50 / GMP |
| 4-Eyes QCLead ≠ Analyst AND ≠ Peer | ResultsReview (QCLeadVerification) | 21 CFR §11.50 / GMP |
| OOS gate before QCLead verification | QCLeadVerifyCommand | FDA OOS Guidance 2006 |
| Evidence gate for critical params before sign-off | SignOffTestExecutionCommand | GAMP 5 |
| Training gate hard-block | AssignWorkQueueItemCommand | GMP / 21 CFR §11.10(i) |
| Calibration gate hard-block | AssignWorkQueueItemCommand | 21 CFR 211.68 |
| Sample number server-generated | Sample.sample_number | Contract 2 |
| All spec/formula compute server-side | DigitalLogbookEntry | Contract 2 |
| CoA PDF locked server-side atomically on QA sig | CoA.locked_at + CoA.pdf_blob | EU Annex 11 §11 |
| CoA superseded not deleted — new row with superseded_by | Coa self-ref | ALCOA+ Enduring |
| BLOCKED dispatch while OOS open | DeliveryOrder / DispatchStatusService | FDA OOS Guidance 2006 |
| Soft-delete only — no physical DELETE | All entity tables | ALCOA+ Enduring |
