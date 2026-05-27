# Pharma LIMS — Runtime Flows
### Architecture Document · v1.0 · 2026-05-27

---

## Flow 1: Sample Registration (Manual Path)

```
Actor: QC Analyst
Trigger: Material received from warehouse

Step 1 — Analyst opens Sample Registration page
  → React loads: GET /samples (existing list) + GET /materials + GET /laboratories

Step 2 — Analyst fills registration form and submits
  → POST /api/v1/samples
  → RegisterSampleHandler:
      a. SampleValidatorService.Validate():
         ✓ Check 1: lot not expired (materials.exp_date > today)
         ✓ Check 2: approved spec exists (spec_limits WHERE status='Approved' AND material_id=?)
         ✓ Check 3: instrument calibrated (instruments.calibration_due > today AND status='Available')
         ✓ Check 4: analyst trained (user_training_records.valid_until > today)
         ✓ Check 5: reagent in stock (lab_config.reagent_stock check)
         → Any failure: HTTP 422 + specific error message; registration blocked
      b. ISampleIdFormatService.Generate() → e.g. "KLAB-API-20260527-0042"
      c. IFormTemplateSelectorService.Select() → picks form template by material type
      d. INSERT samples (status='Registered', barcode_printed=false)
      e. INSERT barcode_print_log (print_type='AutoOnRegistration')
  → Response: 201 Created + sampleDto

Step 3 — Analyst e-signs SRF
  → POST /api/v1/samples/{id}/sign-srf { password, meaning, reason }
  → IElectronicSignatureService.CreateSignature():
      a. BCrypt.Verify(password, user.PasswordHash)  ← §11.300
      b. INSERT electronic_signatures
  → sample.status → 'PendingTesting'
  → Response: 200 OK

Duration: ~2 minutes
Compliance gates: 5 GMP checks (FR-03..07) + §11.300 e-sig + §11.50 four-field signature
```

---

## Flow 2: WAP Assignment (Lab Manager)

```
Actor: Lab Manager
Trigger: New samples in PendingTesting status

Step 1 — Lab Manager opens Work Queue
  → GET /api/v1/test-executions (shows pending + assigned tasks)

Step 2 — Lab Manager clicks "Assign Task"
  → GET /users (analyst list)
  → GET /instruments (instrument list)
  → GET /test-executions/suggest-instrument (auto-suggest, sorted by priority)

Step 3 — Lab Manager selects sample, analyst, instrument and submits
  → POST /api/v1/test-executions
  → AssignWorkQueueItemCommand:
      a. Check analyst training current for this method (user_training_records)
         → Fail: HTTP 422 TRAINING_EXPIRED
      b. Check instrument calibration current (instruments.calibration_due)
         → Fail: HTTP 422 INSTRUMENT_OOC
      c. Check instrument Available (not InUse/Maintenance)
      d. INSERT test_executions (status='Assigned')
  → Response: 201 Created

Step 4 — (Optional) Per-Execution Re-assign
  → POST /api/v1/test-executions/{id}/assign { analystId, instrumentId, priorityScore }
  → AssignTestMethodCommand (same training + cal checks)
  → UPDATE test_executions (analyst_id, instrument_id, priority_score)

Duration: ~3 minutes
Compliance gates: Training check (§11.10(i)) + Calibration check (21 CFR 211.68)
```

---

## Flow 3: Test Execution (Analyst)

```
Actor: QC Analyst
Trigger: Task appears in Work Queue with status 'Assigned'

Step 1 — Analyst clicks "Start Task"
  → POST /api/v1/test-executions/{id}/start
  → started_at = DateTime.UtcNow (ALCOA+ Contemporaneous — server-set)
  → status → 'InProgress'

Step 2 — Analyst opens result entry form
  → GET /test-executions/{id} (loads form template, parameters)

Step 3 — Analyst enters raw values (or imports instrument file)
  → POST /api/v1/test-executions/{id}/results
  → SubmitResultsCommand:
      a. AutoCorrectionService.Apply() (e.g. SG temp normalisation from lab_config)
      b. ParameterCalculationService.Calculate() (Expression or TableLookup)
      c. OosDetectionService.Check():
         → is_oos: result outside spec_min/spec_max → FAIL
         → is_oot: result outside oot_min/oot_max → OOT flag (not block)
      d. INSERT digital_logbook_entries (status='Pending', pass_fail, is_oos, is_oot)
      e. If is_oos: INSERT oos_investigations (status='Open', phase='Phase1')

Step 4 — Analyst attaches evidence (if is_critical parameter)
Step 5 — Analyst e-signs step
  → POST /api/v1/test-executions/{id}/sign-off { password, meaning }
  → BCrypt.Verify(password) ← §11.300
  → INSERT electronic_signatures
  → UPDATE digital_logbook_entries SET status='Signed', signature_id=...
  → If all entries signed: execution.status → 'Completed'

Duration: 5–30 minutes depending on test method
Compliance gates: §11.300 e-sig + OOS auto-raise + evidence gate for critical params
```

---

## Flow 4: Post-Sign Amendment

```
Actor: QC Analyst (discovered error in signed result)
Trigger: QA identifies incorrect raw_value in a Signed logbook entry

Step 1 — Analyst clicks "Amend" on a Signed entry in Digital Logbook page

Step 2 — Analyst fills amendment modal
  Fields: new raw_value, amendment_reason, password, meaning, reason

Step 3 — System processes amendment
  → POST /api/v1/digital-logbook/{id}/amend
  → AmendLogbookEntryCommand:
      a. Check entry.status == 'Signed' (must be Signed, not Pending or Superseded)
      b. BCrypt.Verify(password)  → ESIGN_AUTH_FAILED if wrong ← §11.300
      c. INSERT electronic_signatures (amendment signature)
      d. UPDATE original entry:
           status = 'Superseded'
           amendment_reason = <entered reason>
           amendment_signature_id = <new sig id>
      e. INSERT new digital_logbook_entries:
           raw_value = <new value>
           status = 'Pending'
           (calculated_result, pass_fail, is_oos recalculated by OosDetectionService)

Step 4 — Analyst must sign the new Pending entry to complete amendment
  → POST /api/v1/test-executions/{id}/sign-off on the new entry

Duration: ~2 minutes
Compliance: Original preserved (ALCOA+ Enduring) + amendment reason + e-sig (§11.10(e))
```

---

## Flow 5: OOS Investigation

```
Actor: QA Officer
Trigger: is_oos = true on a digital_logbook_entry (auto-raised by OosDetectionService)

Phase 1:
  Step 1 — QA opens OOS Investigations page
    → GET /oos-investigations?status=Open

  Step 2 — QA reviews and closes Phase 1
    → POST /oos-investigations/{id}/close
    { phase: 'Phase1', rootCause: '...', capaRef: '...', password, meaning }
    → BCrypt.Verify ← §11.300
    → INSERT electronic_signatures
    → oos_investigations.status = 'Closed' (if Phase1 sufficient)
    OR
    → oos_investigations.phase = 'Phase2' (if Phase2 required)

Phase 2 (if required):
  Same closure flow with Phase2 fields

Sample gate:
  → Sample CANNOT advance to Released while any OOS is Open
  → Hard block in QAReviewGateService

Duration: 1–5 days depending on investigation
Compliance: FDA OOS Guidance 2006 / 21 CFR 211.192
```

---

## Flow 6: Login Lockout & Unlock

```
Actor: Any user (lockout); Admin (unlock)

Lockout sequence:
  Attempt 1..4: POST /auth/login → 401 INVALID_CREDENTIALS
                                 → FailedLoginCount++ (DB)
                                 → INSERT login_audit_logs (outcome='Failed')

  Attempt 5:   POST /auth/login → 423 ACCOUNT_LOCKED
                                 → LockedUntil = UtcNow + 30min (DB)
                                 → INSERT login_audit_logs (outcome='LockedOut')

  Attempt while locked: POST /auth/login → 423 ACCOUNT_LOCKED
                                         → INSERT login_audit_logs (outcome='LockedOut')

  Auto-unlock:  After LockedUntil passes → FailedLoginCount not reset automatically
                                         → Next successful login resets count

Admin unlock:
  → POST /api/v1/users/{id}/unlock
  → UPDATE users SET FailedLoginCount=0, LockedUntil=null
  → Response: 200 OK
  → (Audit-logged via master_data_audit_log)

Compliance: 21 CFR §11.10(d) — system limits login attempts
```

---

## Flow 7: ICH Q1A Stability Trend Analysis

```
Actor: Stability Scientist / QA
Trigger: Reviewing stability protocol trend data

Step 1 — Open Stability Study page
  → GET /stability-protocols (list protocols)

Step 2 — Expand protocol, view parameters

Step 3 — Click "ICH Regression" on a parameter
  → GET /stability-trend/{protocolId}/{parameterId}
  → GetStabilityTrendQuery:
      a. Load StabilityTrendPoints for this protocol + parameter
      b. Perform linear regression (OLS):
           slope = Σ((x - x̄)(y - ȳ)) / Σ((x - x̄)²)
           intercept = ȳ - slope × x̄
      c. Predict shelf life: months where regression crosses spec limit
      d. Flag:
           0 = Stable (slope near zero, R² > 0.95)
           1 = WatchNeeded (slope trending, within 15% of limit)
           2 = ActionRequired (slope crosses limit before IntendedShelfLifeMonths)
  → Response: { slope, intercept, mean, stdDev, predictedShelfLifeMonths, flag, timePoints[] }

Step 4 — Frontend renders ICH Regression Panel overlay
  → 6-stat grid + time-points table with PASS/FAIL + flag colour (green/amber/red)

Compliance: ICH Q1A — regression analysis for shelf-life determination
```
