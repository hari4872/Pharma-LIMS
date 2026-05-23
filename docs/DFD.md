# Pharma LIMS — Data Flow Diagram (DFD)
**Coverage:** ALL Phases 1–12 (Built + Planned)  
**Standard:** 21 CFR Part 11 / 21 CFR Part 211 / EU GMP Annex 11 / ALCOA+ / FDA OOS Guidance 2006 / ICH Q1A / ISO 17025

---

## Status Legend
```
✅ BUILT    — implemented and migrated
🔲 PLANNED  — from design docs, not yet coded
⊗           — regulatory gate / hard block (no role can bypass)
→           — data flow
INS-ONLY    — INSERT only, no UPDATE/DELETE
```

---

## DFD NOTATION
```
[External Entity]   ─ actor outside the system boundary
(Process)           ─ transforms data
{Data Store}        ─ where data persists
⊗                   ─ regulatory gate
→                   ─ data flows in this direction
```

---

## LEVEL 0 — SYSTEM CONTEXT

```
┌──────────────────────────────────────────────────────────────────────┐
│                       PHARMA LIMS SYSTEM                             │
│                                                                      │
│  INPUTS:                                    OUTPUTS:                 │
│  [Admin]          ──── config & users ────► {Master Data}           │
│  [Analyst]        ──── results & e-sigs ──► {Digital Logbook}       │
│  [QC Lead]        ──── verifications ─────► {Results Reviews}       │
│  [QA]             ──── approvals ─────────► {CoA / Audit Trail}     │
│  [Lab Manager]    ──── assignments ───────► {Work Queue}            │
│  [ERP / Dispatch] ──── delivery orders ───► {Dispatch QC}           │
│  [Instruments]    ──── calibration data ──► {Calibration Records}   │
│                                                                      │
│  REAL-TIME PUSH (no polling):                                        │
│  SignalR ──────────────────────────────────► All browser clients     │
│                                                                      │
│  COMPLIANCE OUTPUTS:                                                 │
│  CoA PDF (locked) ─────────────────────────► Customer / ERP         │
│  Audit Trail (INSERT-only) ────────────────► Inspection / FDA PAI   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## LEVEL 1 — MAIN PROCESS FLOW (All Phases)

```
[Admin]
   │ P1: Configure labs, users, instruments, methods, specs, forms
   ▼
{MASTER DATA TABLES}
         │
         ▼
[Analyst/LabManager]
   │ P2: Register sample + SRF e-sign + barcode print
   ▼
{SAMPLE} ──────────────────────────────────────────── status: Registered
         │
         ▼  [LabManager]
   P3: WAP Work Assignment                            status: InTesting
         │  ⊗ Training gate  ⊗ Calibration gate
         ▼
{TEST_EXECUTION}

   ┌──────────────────────────────────────────────────────┐
   │  P4: 4 Checkpoint Trigger Modes (Phase 1b)           │
   │  Mode 1: TimeBased (IHostedService)                  │
   │  Mode 2: OperatorScan                                │
   │  Mode 3: ProcessLog shift grid                       │
   │  Mode 4: DispatchEvent                               │
   └─────────────────────────────► {CHECKPOINT_TRIGGER_LOG}
         │
         ▼  [Analyst]
   P5: Execute tests — enter raw values
         │  Server pipeline: AutoCorrection → Formula → OOS/OOT
         ▼
{DIGITAL_LOGBOOK_ENTRY} (status: Pending)
         │
         ▼  [Analyst] ⊗ Evidence gate (critical params)
   P6: Sign off test execution (§11.50 e-sig)
         │
         ├─► {DIGITAL_LOGBOOK_ENTRY} status: Signed
         ├─► {TEST_EXECUTION} status: Completed (or OOSOpen if OOS found)
         ├─► {OOS_INVESTIGATION} (auto-created for any OOS/OOT result)
         └─► SignalR → QA group: "TestExecutionSigned"
         │
         ▼  [QA/QCLead] (if OOS/OOT investigations exist)
   P7: Close OOS Investigations (§11.50 + root cause + CAPA)
         │
         └─► {OOS_INVESTIGATION} status: Closed
             └─► All closed? → {TEST_EXECUTION} status: Completed
                              → SignalR → QA: "OosClosedAllClear"
         │
         ▼  [Peer Reviewer ≠ Analyst]
   P8: Peer Review (§11.50 e-sig)
         │  ⊗ Segregation: reviewer = analyst → BLOCK
         └─► {RESULTS_REVIEW} (PeerReview) → SignalR → QCLead
         │
         ▼  [QCLead ≠ Analyst ≠ Peer]
   P9: QC Lead Verification (§11.50 e-sig)
         │  ⊗ Segregation gates (2 checks)
         │  ⊗ OOS gate: any open investigation → BLOCK
         └─► {RESULTS_REVIEW} (QCLeadVerification)
             └─► {SAMPLE} status: PendingQAReview
                          → CoA auto-generated (Draft)
         │
         ▼  [QA] ─────────────────────────────────── 🔲 Phase 5
   P10: QA Review (vw_qa_checklist — 10 items)
         │  ⊗ All 10 checklist items must pass
         │  ⊗ OOS gate  ⊗ Evidence gate  ⊗ Spec version check
         ├─► APPROVE: {COA} status: Released + PDF locked atomically
         │            {SAMPLE} status: Released
         │            SignalR → Dispatch: "CoAReady"
         └─► REJECT:  {COA_APPROVAL} (INSERT-only, DB trigger blocks UPDATE)
                      {SAMPLE} status: Rejected
         │
         ▼  [Dispatch / QA] ────────────────────────── 🔲 Phase 10
   P11: Dispatch QC (triggered by DeliveryOrder)
         │  ⊗ OOS gate: BLOCKED if any OOS open
         └─► {DISPATCH_QC_TASK} + {TEST_EXECUTION}
             └─► CLEARED → {DELIVERY_ORDER} status: CLEARED
                           SignalR → QA: "DispatchCleared"
```

---

## LEVEL 2 — DETAILED PROCESS FLOWS

---

### P1 — MASTER DATA MANAGEMENT ✅

```
[Admin]
   │
   ├──► (1.1 Configure Laboratory) ────────────────────► {LABORATORY}
   │
   ├──► (1.2 Register Instrument) ─────────────────────► {INSTRUMENT}
   │         └── (1.2a Record Calibration) ────────────► {CALIBRATION_RECORD} (INS-ONLY)
   │         └── (1.2b Raise Breakdown) ───────────────► {INSTRUMENT_BREAKDOWN}
   │                   └── (1.2c Record Repair) ────────► {INSTRUMENT_REPAIR}
   │                   └── (1.2d QA Return-to-Service)
   │                             │  ⊗ §11.300 password re-entry
   │                             └──► INSERT {ELECTRONIC_SIGNATURE}
   │                                  UPDATE {INSTRUMENT_BREAKDOWN}.return_sig_id
   │                                  UPDATE {INSTRUMENT}.status = Available
   │
   ├──► (1.3 Create / Update User) ────────────────────► {USER}
   │         └── (1.3a Add Training Record) ────────────► {USER_TRAINING_RECORD}
   │
   ├──► (1.4 Create Test Method + Parameters) ─────────► {TEST_METHOD}
   │                                                      {TEST_METHOD_PARAMETER}
   │                                                      {PARAMETER_LOOKUP_TABLE}
   │                                                      {PARAMETER_LOOKUP_ROW}
   │
   ├──► (1.5 Create Spec Limits) ──────────────────────► {SPEC_LIMIT}
   │
   ├──► (1.6 Create Form Template) ────────────────────► {FORM_TEMPLATE}
   │         ├── Locations ─────────────────────────────► {FORM_TEMPLATE_LOCATION}
   │         ├── Parameters ──────────────────────────► {FORM_TEMPLATE_PARAMETER}
   │         └── Field Designer (PUT /form-templates/{id}/fields) → field_definitions_json (8 field types + Parameter links)
   │
   ├──► (1.7 Approve Method / Spec / Form — §11.50)
   │         │  ⊗ Password re-entry → BCrypt.Verify (§11.300)
   │         └──► INSERT {ELECTRONIC_SIGNATURE}
   │              UPDATE entity.status = 'Approved'
   │              UPDATE entity.signature_id
   │              INSERT {MASTER_DATA_AUDIT_LOG} (INS-ONLY)
   │
   ├──► (1.8 Set Lab Config) ──────────────────────────► {LAB_CONFIG}
   │         (tat_days, escalation_minutes, auto_correction_{param},
   │          coa_number_format, oot_gate_enabled, utilisation_window_days, etc.)
   │
   └──► (1.9 Manage Sample Types) ─────────────────────► {SAMPLE_TYPE}

── BACKGROUND JOBS (IHostedService — intervals from lab_config) ────────────────

   (CalibrationDueDateJob — daily)
   │  cal_due < today → UPDATE INSTRUMENT.status = OutOfCalibration
   │  cal_due < today + 7 → SignalR "CalDue" to Instrument owner + QA
   └──► SignalR → PushToGroupAsync("QA", "InstrumentOOC")

   (TrainingExpiryJob — daily)
   │  valid_until < today + 7 → alert
   └──► SignalR → PushToGroupAsync("Admin", "TrainingExpiring")
```

---

### P2 — SAMPLE REGISTRATION ✅

```
[Analyst / Lab Manager]
   │
   ├──► (2.1 Register Sample)
   │         │  Inputs: material_id, lot, mfg_date, exp_date, sample_type
   │         │  Server: sample_number = ISampleIdFormatService (from lab_config)
   │         │  Server: due_date = today + tat_days (from lab_config)
   │         │  Server: form_template_id = IFormTemplateSelectorService
   │         └──► INSERT {SAMPLE} (status = Registered)
   │              Auto-trigger:
   │              └──► INSERT {BARCODE_PRINT_LOG} (print_type = AutoOnRegistration)
   │
   ├──► (2.2 Sign Sample Receipt Form — §11.50)
   │         │  ⊗ Password re-entry → BCrypt.Verify
   │         └──► INSERT {ELECTRONIC_SIGNATURE}
   │              UPDATE {SAMPLE}.srf_signature_id
   │              UPDATE {SAMPLE}.status = PendingTesting
   │
   └──► (2.3 Reprint Barcode)
             │  Reason mandatory
             └──► INSERT {BARCODE_PRINT_LOG} (print_type = Reprint)
```

---

### P3 — CHECKPOINTS (All 4 Trigger Modes) ✅

```
MODE 1 — TimeBased
   (CheckpointSchedulerJob — IHostedService, interval from lab_config)
   └──► INSERT {CHECKPOINT_TRIGGER_LOG} (trigger_mode = TimeBased)
        SignalR → PushToGroupAsync("Analyst", "CheckpointDue")

MODE 2 — OperatorScan
   [Analyst scans barcode at checkpoint]
   └──► (POST /checkpoints/{id}/trigger)
        └──► INSERT {CHECKPOINT_TRIGGER_LOG} (trigger_mode = OperatorScan)
             SignalR → push to Lab group

MODE 3 — ProcessLog (Shift Grid)
   (ProcessLogSchedulerJob — pre-populates rows per shift config)
   └──► INSERT {PROCESS_LOG_ROW} rows (status = Open)
   [Analyst signs shift row — §11.50]
   └──► ⊗ Password re-entry
        └──► INSERT {ELECTRONIC_SIGNATURE}
             UPDATE {PROCESS_LOG_ROW}.status = Signed

MODE 4 — DispatchEvent
   [ERP / Dispatch system triggers]
   └──► (POST /checkpoints/{id}/trigger  +  delivery_order)
        └──► INSERT {CHECKPOINT_TRIGGER_LOG} (trigger_mode = DispatchEvent)
             SignalR → PushToGroupAsync("QA", "DispatchEvent")
```

---

### P4 — WORK ASSIGNMENT (WAP) ✅

```
[Lab Manager]
   │
   └──► (4.1 Assign Work Queue Item)
             │  Inputs: sample_id, analyst_id, instrument_id, priority_score
             │  ⊗ Gate 1: USER_TRAINING_RECORD.valid_until < today → BLOCK
             │  ⊗ Gate 2: INSTRUMENT.calibration_due < today → BLOCK
             │  ⊗ Gate 3: INSTRUMENT.status = Maintenance → BLOCK
             └──► INSERT {TEST_EXECUTION} (status = Assigned)
                  UPDATE {SAMPLE}.status = InTesting
                  SignalR → PushToGroupAsync("Analyst", "WorkQueueUpdated")

── WORK QUEUE ESCALATION JOB ──────────────────────────────────────────────────

   (WorkQueueEscalationJob — reads work_queue_escalation_minutes from lab_config)
   │  Finds: TEST_EXECUTION where status IN (Assigned, InProgress)
   │         AND SAMPLE.due_date < now - escalation_minutes
   └──► SignalR → PushToGroupAsync("LabManager", "WorkQueueOverdue")

── TAT BREACH JOB ─────────────────────────────────────────────────────────────

   (TATBreachJob — hourly, TAT target per material/test from lab_config)
   │  Finds: SAMPLE.due_date < now AND status ≠ Released
   └──► SignalR → PushToGroupAsync("QCLead", "TATBreach")
```

---

### P5 — TEST EXECUTION & RESULTS ✅

```
[Analyst]
   │
   ├──► (5.1 Start Test Execution)
   │         │  ⊗ Re-check training expiry
   │         │  ⊗ Re-check instrument calibration + Maintenance status
   │         └──► UPDATE {TEST_EXECUTION}.status = InProgress
   │              UPDATE {TEST_EXECUTION}.started_at = UtcNow  (ALCOA+ Contemporaneous)
   │
   ├──► (5.2 Upload Evidence — for critical parameters)
   │         └──► INSERT {RESULT_EVIDENCE}
   │              UPDATE {DIGITAL_LOGBOOK_ENTRY}.evidence_file_ref
   │
   ├──► (5.3 Submit Test Results)
   │         │  Inputs: [{parameter_id, raw_value, trigger_source, evidence_file_ref}]
   │         │
   │         │  For each parameter — server-side pipeline (Contract 2):
   │         │
   │         │  Step 1: IAutoCorrectionService
   │         │    reads LAB_CONFIG key: auto_correction_{paramName}
   │         │    JSON: {type, factor, offset}
   │         │    corrected = raw * factor + offset
   │         │
   │         │  Step 2: IParameterCalculationService
   │         │    Expression: replaces {x} in calc_formula → DataTable.Compute()
   │         │    TableLookup: reads PARAMETER_LOOKUP_ROW range
   │         │    returns calculated_result (read-only — ALCOA+ Original)
   │         │
   │         │  Step 3: IOosDetectionService
   │         │    OOS:  calculated_result < spec_min OR > spec_max → is_oos = true
   │         │    OOT:  (only if NOT oos) outside oot_min/oot_max → is_oot = true
   │         │    pass_fail = is_oos ? "FAIL" : "PASS"
   │         │
   │         │  Step 4: Freeze spec snapshots (ALCOA+ Enduring)
   │         │    spec_min_snapshot, spec_max_snapshot,
   │         │    oot_min_snapshot, oot_max_snapshot,
   │         │    regulatory_tier_snapshot — all set from SPEC_LIMIT at test time
   │         │
   │         └──► DELETE prior Pending entries for this execution
   │              INSERT {DIGITAL_LOGBOOK_ENTRY} (status = Pending)
   │
   └──► (5.4 Sign Off Test Execution — §11.50)
             │  ⊗ Evidence gate: is_critical = true AND evidence_file_ref IS NULL → BLOCK
             │  ⊗ Password re-entry → BCrypt.Verify (§11.300)
             └──► INSERT {ELECTRONIC_SIGNATURE}
                  UPDATE all Pending {DIGITAL_LOGBOOK_ENTRY}.status = Signed
                  UPDATE {TEST_EXECUTION}.status = Completed
                  UPDATE {TEST_EXECUTION}.completed_at = UtcNow
                  UPDATE {SAMPLE}.status = PendingQAReview
                  │
                  For each is_oos=true OR is_oot=true entry:
                  └──► INSERT {OOS_INVESTIGATION} (status = Open, phase = Phase1)
                       UPDATE {TEST_EXECUTION}.status = OOSOpen
                  │
                  SignalR → PushToGroupAsync("QA", "TestExecutionSigned")
```

---

### P6 — OOS / OOT INVESTIGATION ✅

```
FDA OOS Guidance 2006 — Phase 1 (Lab Investigation)

[QA / QC Lead / Admin]
   │
   └──► (6.1 Close OOS/OOT Investigation)
             │  Inputs: root_cause (mandatory), capa_ref, password, meaning, reason
             │  ⊗ Password re-entry → BCrypt.Verify (§11.300)
             └──► INSERT {ELECTRONIC_SIGNATURE}
                  UPDATE {OOS_INVESTIGATION}
                       .status = Closed
                       .root_cause = input
                       .capa_ref = input
                       .closed_at = UtcNow
                  │
                  Check: ALL OosInvestigations for this execution = Closed?
                  └──► YES:
                       UPDATE {TEST_EXECUTION}.status = Completed
                       UPDATE {SAMPLE}.status = PendingQAReview
                       SignalR → PushToGroupAsync("QA", "OosClosedAllClear")
```

---

### P7 — 4-EYES RESULTS REVIEW ✅

```
4-Eyes Principle — user_id equality enforced at API (not just role)

STEP 2 — PEER REVIEW
──────────────────────────────────────────────────────────────────

[Peer Reviewer — any user ≠ original Analyst]
   │
   └──► (7.1 Peer Review — §11.50)
             │  ⊗ Segregation Gate: reviewer_id == analyst_id → HTTP 409 BLOCK
             │  ⊗ Password re-entry → BCrypt.Verify
             └──► INSERT {ELECTRONIC_SIGNATURE}
                  INSERT {RESULTS_REVIEW} (review_type = PeerReview)
                  SignalR → PushToGroupAsync("QCLead", "PeerReviewDone")

STEP 4 — QC LEAD VERIFICATION
──────────────────────────────────────────────────────────────────

[QC Lead — user ≠ Analyst AND ≠ Peer Reviewer]
   │
   └──► (7.2 QC Lead Verify — §11.50)
             │  ⊗ Segregation Gate 1: reviewer_id == analyst_id → HTTP 409 BLOCK
             │  ⊗ Segregation Gate 2: reviewer_id == peer_reviewer_id → HTTP 409 BLOCK
             │  ⊗ OOS Gate: any OOS_INVESTIGATION.status == Open → HTTP 409 BLOCK
             │  ⊗ Password re-entry → BCrypt.Verify
             └──► INSERT {ELECTRONIC_SIGNATURE}
                  INSERT {RESULTS_REVIEW} (review_type = QCLeadVerification)
                  UPDATE {SAMPLE}.status = Released
                  ── AUTO-TRIGGER: CoAGenerationService ──────────────────────── 🔲
                  INSERT {COA} (status = Draft) — auto-populated from FK joins
                  INSERT {COA_LINE} × n parameters
                  SignalR → PushToGroupAsync("QA", "SampleReleased")
```

---

### P8 — QA REVIEW & RELEASE ✅

```
[QA]
   │
   ├──► (8.1 Review CoA Draft — read-only via vw_coa_preview)
   │         │  QAReviewGateService evaluates 10-item checklist (vw_qa_checklist):
   │         │  1. All test executions Completed
   │         │  2. No open OOS investigations
   │         │  3. No open OOT investigations (if oot_gate_enabled in lab_config)
   │         │  4. All logbook entries Signed (signature_id NOT NULL)
   │         │  5. Peer review e-sig present
   │         │  6. QC Lead verification e-sig present
   │         │  7. Correct approved spec version used
   │         │  8. Evidence present for all is_critical parameters
   │         │  9. CoA header fully populated (customer, DO No., despatch date)
   │         │  10. All CoA lines have result NOT NULL
   │
   ├──► (8.2 APPROVE CoA — §11.50)
   │         │  ⊗ All 10 checklist items must pass (server-enforced)
   │         │  ⊗ Password re-entry → BCrypt.Verify
   │         └──► INSERT {ELECTRONIC_SIGNATURE}
   │              INSERT {COA_APPROVAL} (decision = Approved)
   │              UPDATE {COA}.status = Released
   │              UPDATE {COA}.locked_at = UtcNow   ← atomically in one transaction
   │              UPDATE {COA}.pdf_blob = server-generated locked PDF
   │              UPDATE {COA}.qa_signature_id
   │              UPDATE {SAMPLE}.status = Released
   │              INSERT {COA_DISTRIBUTION_LOG} (ERP + Archive — INS-ONLY)
   │              SignalR → PushToGroupAsync("Dispatch", "CoAReady")
   │
   └──► (8.3 REJECT CoA — §11.50 + justification)
             │  ⊗ Password re-entry → BCrypt.Verify
             └──► INSERT {ELECTRONIC_SIGNATURE}
                  INSERT {COA_APPROVAL} (decision = Rejected, justification = mandatory)
                  UPDATE {SAMPLE}.status = Rejected
                  ← DB trigger blocks UPDATE on this row (EU Annex 11 §13)
                  SignalR → PushToGroupAsync("QCLead", "CoARejected")
```

---

### P9 — COA GENERATION (AUTO-TRIGGERED) ✅

```
AUTO-TRIGGERED on QC Lead verification (single trigger point — Contract 1)

   (CoAGenerationService — Contract 1: single CoA builder)
   │
   │  Step 1: CoAHeaderService resolves all header fields from FK joins
   │    product_name ← samples → materials.material_name
   │    lot_number ← samples.lot_number
   │    mfg_date ← samples.mfg_date
   │    expiry_date ← materials.shelf_life_days + mfg_date (server-calc)
   │    customer ← delivery_orders.customer_name (if DO linked)
   │    do_number ← delivery_orders.do_number
   │    coa_number ← ISampleIdFormatService (format from lab_config)
   │    date_of_issue ← set at QA approval (not now — never manually entered)
   │
   │  Step 2: Build CoA body from digital_logbook_entries FK join
   │    per logbook row → CoA line:
   │      test_name ← test_method_parameters.parameter_name (FK — not copied)
   │      method_ref ← test_methods.method_code (FK — not copied)
   │      spec_min/max ← digital_logbook_entries.spec_min_snapshot (frozen)
   │      regulatory_spec ← digital_logbook_entries.regulatory_tier_snapshot
   │      result ← digital_logbook_entries.calculated_result (server-computed)
   │      pass_fail ← digital_logbook_entries.pass_fail (server-set)
   │      analyst ← digital_logbook_entries.analyst_id → users.full_name
   │
   └──► INSERT {COA} (status = Draft)
        INSERT {COA_LINE} × n

   ON QA APPROVAL (atomically):
   └──► UPDATE {COA}.status = Released
        UPDATE {COA}.locked_at = UtcNow
        UPDATE {COA}.pdf_blob = generated PDF (3 e-sigs embedded — §11.50)
        CoADistributionService → INSERT {COA_DISTRIBUTION_LOG} (ERP + Archive)

   ON RE-ISSUE (if needed — ALCOA+ Enduring):
   └──► INSERT new {COA} (status = Draft)
        UPDATE old {COA}.superseded_by = new coa_id
        ← Original CoA never deleted
```

---

### P10 — DISPATCH QC ✅

```
[ERP auto-push or Admin manual entry]
   │
   └──► (10.1 Create Delivery Order)
             └──► INSERT {DELIVERY_ORDER} (status = Pending)
                  DispatchEventService (Contract 1) auto-creates task:
                  └──► INSERT {DISPATCH_QC_TASK} (status = Open)
                       UPDATE {DELIVERY_ORDER}.status = InDispatchQC
                       SignalR → PushToGroupAsync("Analyst", "DOReceived")

[Analyst]
   └──► (10.2 Execute Dispatch QC Test)
             │  Same execution pipeline as Phase 3:
             │  instrument check → enter results → auto-calc → OOS/OOT
             │  (OOSDetectionService — same service, Contract 1)
             │  OOS/OOT found:
             │  └──► INSERT {OOS_INVESTIGATION}
             │       UPDATE {DELIVERY_ORDER}.status = BLOCKED
             │       SignalR → PushToGroupAsync("QA", "DispatchBlocked")
             │  All pass:
             └──► Analyst §11.50 sign-off
                  UPDATE {DISPATCH_QC_TASK}.status = Passed

[QA]
   └──► (10.3 QA Approve Dispatch QC — §11.50)
             │  CoAHeaderService auto-populates DO fields on CoA header (Contract 1)
             │  ⊗ OOS gate: any open OOS → BLOCK
             │  ⊗ Password re-entry → BCrypt.Verify
             └──► INSERT {ELECTRONIC_SIGNATURE}
                  UPDATE {DISPATCH_QC_TASK}.status = QAApproved
                  DispatchStatusService (Contract 1):
                  └──► UPDATE {DELIVERY_ORDER}.status = CLEARED
                       SignalR → PushToGroupAsync("QA", "DispatchCleared")
```

---

### P11 — TRACEABILITY ✅

```
[QA / Admin]
   │
   └──► (11.1 Query Traceability Graph)
             │  TraceabilityQueryService (Contract 1 — single service, no copies)
             │  Builds graph from FK joins via vw_sample_traceability:
             │
             │  UPSTREAM NODES:
             │    Material Lot ← samples → materials → material_lots
             │    Sampling Event ← sampling_events → samples (who/when/where)
             │    Reagent/Standard ← test_executions → reagents_standards
             │    Instrument ← digital_logbook_entries → instruments → calibration_records
             │    Analyst ← digital_logbook_entries → users → user_training_records
             │    Test Method ← test_executions → test_methods
             │
             │  CENTRAL NODE:
             │    Digital Logbook Row (raw, calculated, spec snapshot, pass/fail, OOS/OOT)
             │
             │  DOWNSTREAM NODES:
             │    CoA Line / CoA ← coa_lines → digital_logbook_entries
             │    ERP Batch ← erp_batch_records → samples
             │    Complaint/Deviation ← complaints_deviations → samples
             │
             └──► INSERT {TRACE_QUERY_LOG} (INS-ONLY)
                  Return graph via vw_sample_traceability

   └──► (11.2 Recall Scope Query)
             │  Single query from lot node → all affected downstream batches
             └──► Return affected CoA list + logbook rows
                  QA/Admin only: Export as PDF (§11.50 e-sig on export)
```

---

### P12 — SAMPLE INVENTORY & PULL PLANNING ✅

```
[Admin]
   └──► (12.1 Configure Storage Locations)
             └──► INSERT/UPDATE {STORAGE_LOCATION}
                  (room / chamber / shelf, condition limits — from DB, not hardcoded)

[Analyst]
   └──► (12.2 Transfer Sample to Storage Location)
             │  21 CFR 211.170 chain of custody
             └──► INSERT {STORAGE_TRANSFER_LOG} (INS-ONLY)

[Analyst]
   └──► (12.3 Log Condition Excursion)
             │  temperature / humidity / light breach at location
             └──► INSERT {CONDITION_EXCURSION}
                  ExcursionImpactService (Contract 1):
                  └──► Flags all SAMPLE rows in this location during excursion window
                       SignalR → PushToGroupAsync("QA", "ConditionExcursion")

[Analyst]
   └──► (12.4 Execute Stability Pull — §11.50)
             │  ⊗ actual_qty < required_qty → SHORT PULL:
             │  └──► INSERT {SHORT_PULL_DEVIATION} (reason mandatory before proceed)
             │  ⊗ Password re-entry → BCrypt.Verify
             └──► INSERT {ELECTRONIC_SIGNATURE}
                  UPDATE {STABILITY_PULL}.status = Pulled
                  UPDATE {STABILITY_PULL}.pull_signature_id
                  PullExecutionService (Contract 1) — atomic:
                  └──► Deduct inventory from STORAGE_LOCATION
                       Auto-trigger RegisterSampleCommand (same command — Contract 1)

── BACKGROUND JOBS ────────────────────────────────────────────────────────────

   (PullReminderJob — daily, T-7 and T-1)
   └──► SignalR → PushToGroupAsync("Analyst", "PullDue")

   (MissedPullJob — daily)
   └──► SignalR → PushToGroupAsync("QCLead", "PullMissed")

   (DestructionAlertJob — daily, T-90/T-30/T-7 from lab_config)
   └──► SignalR → PushToGroupAsync("QCLead", "DestructionDue")

   (StorageInventoryJob — daily, low_stock_threshold from lab_config)
   └──► SignalR → PushToGroupAsync("QCLead", "LowStock")
```

---

### P13 — DASHBOARDS & KPI PANELS 🔲 (Phase 11)

```
   (DashboardAggregationService — single source, no per-panel duplication)
   │
   ├── WIP Panel ────────────────────────────── vw_wip_summary
   │   (samples registered today, in-testing, completed, overdue)
   │
   ├── TAT Panel ────────────────────────────── vw_tat_summary
   │   (average TAT per test type — window from lab_config)
   │
   ├── Quality KPIs ─────────────────────────── vw_quality_kpis
   │   (OOS rate, OOT rate, RFT rate, retest rate, CAPA count)
   │
   ├── Instrument Status Board ──────────────── vw_instrument_status
   │   (all 4 statuses, cal due, utilisation, OOC events, breakdowns)
   │
   ├── Active Alerts ────────────────────────── vw_alert_queue
   │   (OOS, CalDue, TAT breach, Training expiry, Pull due, Low stock)
   │   → All pushed via SignalR (no polling — Contract 2)
   │
   └── Compliance Panel (QA / Admin only) ───── vw_compliance_summary
       ├── Audit trail search (INSERT-only source)
       ├── E-signature log (full §11.50 fields)
       ├── OOS investigation log
       ├── CoA history ────────────────────── vw_coa_history
       ├── Training status
       └── Export compliance PDF (QA / Admin only)
```

---

## SIGNALR REAL-TIME PUSH — COMPLETE MAP

| Event | PushToGroup | Trigger | Phase |
|-------|-------------|---------|-------|
| `WorkQueueUpdated` | `Analyst` | Work queue item assigned | 3 ✅ |
| `WorkQueueOverdue` | `LabManager` | Escalation job fires | 3 ✅ |
| `CheckpointDue` | `Analyst` | Mode 1 timer fires | 1b ✅ |
| `DispatchEvent` | `QA` | Mode 4 DO trigger | 1b ✅ |
| `TestExecutionSigned` | `QA` | Analyst sign-off | 3 ✅ |
| `OosClosedAllClear` | `QA` | All OOS investigations closed | 3 ✅ |
| `PeerReviewDone` | `QCLead` | Peer review signed | 3 ✅ |
| `SampleReleased` | `QA` | QC Lead verification approved | 3 ✅ |
| `CoAReady` | `Dispatch` | CoA approved by QA | 9 ✅ |
| `CoARejected` | `QCLead` | CoA rejected by QA | 5 ✅ |
| `DispatchBlocked` | `QA` | OOS detected in Dispatch QC | 10 ✅ |
| `DispatchCleared` | `QA` | Dispatch QC passed | 10 ✅ |
| `InstrumentOOC` | `QA` | CalibrationDueDateJob fires | 8 ✅ |
| `CalDue` | `QA` | cal_due within 7 days | 8 ✅ |
| `TATBreach` | `QCLead` | Sample exceeds TAT target | 11 ✅ |
| `TrainingExpiring` | `Admin` | Training valid_until within 7 days | 11 ✅ |
| `PullDue` | `Analyst` | Stability pull T-7/T-1 | 7 ✅ |
| `PullMissed` | `QCLead` | Stability pull overdue | 7 ✅ |
| `DestructionDue` | `QCLead` | Retain destruction T-90/T-30/T-7 | 7 ✅ |
| `ConditionExcursion` | `QA` | Storage condition breach | 7 ✅ |
| `LowStock` | `QCLead` | Storage inventory below threshold | 7 ✅ |
| `DOReceived` | `Analyst` | Delivery Order created | 10 ✅ |

---

## REGULATORY GATES — COMPLETE MAP

| Gate | Process | Rule | Regulation |
|------|---------|------|------------|
| Password re-entry | Every e-sig flow | BCrypt.Verify independent of session | 21 CFR §11.300 |
| 4-field e-sig mandatory | Every sign-off | FullName+SignedAt+Meaning+Reason NOT NULL | 21 CFR §11.50 |
| Training expiry | AssignWorkQueueItem | valid_until < today → BLOCK | GMP / §11.10(i) |
| Calibration expiry | AssignWorkQueueItem, Start | cal_due < today → BLOCK | 21 CFR 211.68 |
| Maintenance status | AssignWorkQueueItem, Start | status = Maintenance → BLOCK | GMP |
| Evidence gate | SignOffTestExecution | is_critical AND evidence_file_ref IS NULL → BLOCK | GAMP 5 |
| OOS gate before QCLead | QCLeadVerify | any OosInvestigation Open → BLOCK | FDA OOS Guidance 2006 |
| Segregation Peer ≠ Analyst | PeerReview | reviewer_id == analyst_id → HTTP 409 | 21 CFR §11.50 / GMP |
| Segregation QCLead ≠ both | QCLeadVerify | reviewer_id == analyst_id OR peer_id → HTTP 409 | 21 CFR §11.50 / GMP |
| QA 10-item checklist | QA CoA Approval | all 10 must pass server-side | 21 CFR 211.192 |
| OOS gate before QA approval | QAReviewGateService | any open OOS → BLOCK | FDA OOS Guidance 2006 |
| Evidence gate in checklist | vw_qa_checklist item 8 | is_critical AND no evidence → fail | GAMP 5 |
| OOS gate before CLEARED | DispatchStatusService | any open OOS → BLOCKED | FDA OOS Guidance 2006 |
| CoA INSERT-only rejection | CoaApproval table | DB trigger blocks UPDATE on Rejected rows | EU Annex 11 §13 |
| Sample number server-gen | RegisterSample | ISampleIdFormatService — client cannot set | Contract 2 |
| All compute server-side | SubmitTestResults | no client math on formulas or OOS detection | Contract 2 |
| CoA PDF locked server-side | QA Approval | atomically in DB transaction | Contract 2 / §11.50 |
| Soft-delete only | All entity tables | no physical DELETE anywhere | ALCOA+ Enduring |
| All timestamps UTC server | All compliance records | DateTimeOffset.UtcNow — no client timestamps | ALCOA+ Contemporaneous |

---

## BACKGROUND JOBS REGISTRY (All Phases)

| Job | Phase | Interval | Purpose |
|-----|-------|----------|---------|
| `CheckpointSchedulerJob` | 1b ✅ | time-slot config | Mode 1 time-based triggers |
| `ProcessLogSchedulerJob` | 1b ✅ | shift config | Mode 3 row pre-population |
| `WorkQueueEscalationJob` | 3 ✅ | escalation_minutes from lab_config | Overdue WAP alerts |
| `CalibrationDueDateJob` | 8 ✅ | daily | OOC detection + T-7 cal due alerts |
| `TrainingExpiryJob` | 1 ✅ | daily | Training expiry T-7 alerts |
| `TATBreachJob` | 11 ✅ | hourly | TAT target breach detection |
| `PullReminderJob` | 7 ✅ | daily | Stability pull T-7/T-1 reminders |
| `MissedPullJob` | 7 ✅ | daily | Missed pull escalation |
| `DestructionAlertJob` | 7 ✅ | daily | Retain T-90/T-30/T-7 destruction alerts |
| `UtilisationSummaryJob` | 8 ✅ | daily | Instrument utilisation (7/30/90 days) |
| `PMReminderJob` | 8 ✅ | daily | Preventive maintenance T-7/T-1 |
| `StorageInventoryJob` | 7 ✅ | daily | Low-stock alert per location |
| `MissedTriggerEscalationJob` | 1b ✅ | daily | Missed checkpoint escalation |
| `FormTemplateApprovalJob` | 1c ✅ | daily | Active form template integrity check |

> All intervals from `lab_config` (Contract 2 — none hardcoded)

---

## PHASE 12 — NORMALIZER VIEWS ✅

15 PostgreSQL `vw_*` views — one definition per concern (Contract 1).
Every UI panel reads the same view; no per-panel JOIN duplication in services.
All views use `CREATE OR REPLACE` — zero downtime on schema change.

| View | Drives |
|---|---|
| `vw_active_spec_limits` | Form pre-population, CoA line, spec snapshot at test time |
| `vw_instrument_status` | Instrument board, WAP assignment gate, cal due alerts |
| `vw_training_currency` | Sample registration training gate (21 CFR §11.10(i)) |
| `vw_sample_pipeline` | WIP dashboard, work queue overview |
| `vw_oos_heat` | OOS heat map, trending analysis |
| `vw_coa_readiness` | QA 10-item pre-approval checklist gate |
| `vw_tat_summary` | TAT KPI panel (average per test type, window from lab_config) |
| `vw_stability_schedule` | ICH Q1A pull schedule — all time points + status |
| `vw_compliance_summary` | Compliance panel top-line KPIs (OOS open, e-sigs, overdue reviews) |
| `vw_alert_queue` | Active alerts — UNION ALL across cal/training/stability/OOS alert types |
| `vw_reagent_expiry` | Reagent & standard expiry warnings (T-30/T-7) |
| `vw_qa_checklist` | 10 boolean items per sample — all must be TRUE before QA approval |
| `vw_sample_traceability` | Full upstream/downstream traceability graph via FK joins |
| `vw_coa_history` | CoA audit trail + supersession chain |
| `vw_quality_kpis` | OOS rate, RFT rate, retest rate, CAPA count |

---

## DATA STORE WRITE RULES

| Data Store | INSERT | UPDATE | DELETE | Note |
|------------|--------|--------|--------|------|
| `electronic_signatures` | ✅ | ❌ | ❌ | §11.50 — INSERT-only forever |
| `barcode_print_log` | ✅ | ❌ | ❌ | 21 CFR 211.170 |
| `checkpoint_trigger_log` | ✅ | ❌ | ❌ | ALCOA+ Contemporaneous |
| `calibration_record` | ✅ | ❌ | ❌ | ISO 17025 |
| `master_data_audit_log` | ✅ | ❌ | ❌ | §11.10(e) |
| `coa_distribution_log` | ✅ | ❌ | ❌ | GMP distribution trail |
| `trace_query_log` | ✅ | ❌ | ❌ | §11.10(e) |
| `storage_transfer_log` | ✅ | ❌ | ❌ | 21 CFR 211.170 chain of custody |
| `coa_approval` (Rejected) | ✅ | ❌ DB trigger | ❌ | EU Annex 11 §13 |
| `digital_logbook_entry` | ✅ | status + superseded_by only | ❌ | ALCOA+ Original |
| `oos_investigation` | ✅ | status/root_cause/capa_ref/closed_at only | ❌ | FDA OOS Guidance |
| `sample` | ✅ | status + sig fields only | soft-delete | ALCOA+ Enduring |
| `coa` | ✅ | status/locked_at/pdf_blob/superseded_by | soft-delete | ALCOA+ Enduring |
| All master data tables | ✅ | ✅ | soft-delete (is_active) | ALCOA+ Enduring |
