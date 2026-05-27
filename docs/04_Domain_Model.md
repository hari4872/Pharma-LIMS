# Pharma LIMS — Domain Model
### Architecture Document · v1.0 · 2026-05-27

---

## 1. Domain Overview

The Pharma LIMS domain is **sample-centric**. Every entity either describes a sample, produces data about a sample, or governs what tests a sample must undergo. The domain is divided into seven bounded contexts:

| Bounded Context | Core Entities | Purpose |
|---|---|---|
| **Master Data** | Laboratory, User, Instrument, Material, TestMethod, SpecLimit | Reference data that governs all other contexts |
| **Sample Registration** | Sample, SampleContainer, BarcodePrintLog | Entry point — creates the sample record |
| **Work Queue** | TestExecution, WapAssignment | Planning and assignment of testing tasks |
| **Results** | DigitalLogbookEntry, ResultEvidence, OosInvestigation | Scientific records and OOS management |
| **QA Release** | ResultsReview, CoA, CoaApproval | 4-eyes review → certificate generation |
| **Stability** | StabilityProtocol, StabilityTrendPoint, StabilityPull | Long-term ICH Q1A stability tracking |
| **Compliance** | ElectronicSignature, LoginAuditLog, MasterDataAuditLog | Immutable compliance records |

---

## 2. Core Aggregates

### Sample (Aggregate Root)

```
Sample
├── sampleId (PK)
├── sampleNumber (server-generated, unique)
├── status: Registered → PendingTesting → InTesting
│          → PendingQAReview → Released | Rejected
├── materialId (FK)  — no data copied from Material
├── labId (FK)
├── analystId (FK)   — ALCOA+ Attributable
├── srfSignatureId (FK → ElectronicSignature)
├── dueDate (server-calculated from lab_config.tat_days)
│
├── has many → SampleContainer (aliquot split management)
├── has many → BarcodePrintLog (chain of custody)
├── has many → TestExecution (work queue items)
├── has many → StabilityPull (ICH Q1A time points)
└── has many → RetainSample
```

### TestExecution (Aggregate Root)

```
TestExecution
├── executionId (PK)
├── sampleId (FK → Sample)
├── analystId (FK → User)
├── instrumentId (FK → Instrument)
├── assignedById (FK → User, nullable — WAP assignor)
├── status: Assigned → InProgress → Completed | OOSOpen
├── priorityScore (WAP urgency)
├── startedAt (UTC server-set — ALCOA+ Contemporaneous)
│
└── has many → DigitalLogbookEntry (results — single source of truth)
             → OosInvestigation
             → ResultsReview
```

### DigitalLogbookEntry (INS-ONLY Aggregate Root)

```
DigitalLogbookEntry
├── entryId (PK)
├── sampleId (FK)
├── executionId (FK)
├── parameterId (FK → TestMethodParameter)
├── rawValue (analyst-entered, immutable after e-sig)
├── calculatedResult (server-computed — ALCOA+ Original)
├── specMinSnapshot / specMaxSnapshot (frozen at test time — ALCOA+ Enduring)
├── passFailResult (server-set by OosDetectionService)
├── isOos / isOot (server-set, analyst cannot suppress)
├── status: Pending → Signed → Superseded
├── signatureId (FK → ElectronicSignature)
├── supersededById (self-ref FK — original never deleted)
├── amendmentReason (mandatory when superseded by amendment)
├── amendmentSignatureId (FK → ElectronicSignature)
└── createdAt (UTC DEFAULT NOW() — ALCOA+ Contemporaneous)
```

---

## 3. Value Objects

| Value Object | Fields | Used By |
|---|---|---|
| `SpecSnapshot` | `specMinSnapshot`, `specMaxSnapshot`, `regulatoryTierSnapshot` | DigitalLogbookEntry — frozen at test time |
| `SignatureDetails` | `fullName`, `signedAt`, `meaning`, `reason` | ElectronicSignature — §11.50 |
| `SampleIdFormat` | Template string with tokens (`{SITE}-{MAT}-{DATE}-{SEQ}`) | ISampleIdFormatService |
| `CalibrationWindow` | `calibratedOn`, `nextDue` | CalibrationRecord, instrument availability check |
| `TrainingWindow` | `completedOn`, `validUntil` | UserTrainingRecord, WAP gate |

---

## 4. Domain Services

| Service | Responsibility | Regulation |
|---|---|---|
| `SampleValidatorService` | 5 GMP pre-checks (lot, spec, instrument, training, reagent) | GMP / ICH Q6A |
| `ISampleIdFormatService` | Generate unique sample number from `lab_config` template | ALCOA+ Original / Contract 2 |
| `IFormTemplateSelectorService` | Auto-select form template for new sample (no UI dropdown) | GMP / Contract 1 |
| `WAPAssignmentService` | Assign task: trained analyst + calibrated instrument + capacity | GMP / §11.10(i) |
| `OosDetectionService` | OOS flag (vs in-house spec) + OOT flag (vs trend limit) | FDA OOS Guidance 2006 |
| `ParameterCalculationService` | Apply formula server-side; result read-only in UI | ALCOA+ Original / Contract 2 |
| `IElectronicSignatureService` | BCrypt.Verify + INSERT electronic_signatures | §11.50 / §11.300 |
| `DigitalLogbookService` | Single writer for ALL logbook rows (all 4 trigger modes) | Contract 1 — no duplicate writers |

---

## 5. Domain Events

| Event | Raised By | Consumed By |
|---|---|---|
| `SampleRegistered` | RegisterSampleHandler | BarcodeService (auto-print) |
| `SrfSigned` | SignSrfHandler | WorkQueueService (create task) |
| `TaskStarted` | StartTestExecutionHandler | `started_at` UTC log |
| `ResultSubmitted` | SubmitResultsHandler | OosDetectionService |
| `OosRaised` | OosDetectionService | OosInvestigationService |
| `StepSignedOff` | SignOffTestExecutionHandler | DigitalLogbookService |
| `EntryAmended` | AmendLogbookEntryHandler | Audit trail |
| `LoginFailed` | AuthController | LoginAuditLog INSERT + lockout counter |
| `AccountLocked` | AuthController | LoginAuditLog INSERT (`LockedOut` outcome) |

---

## 6. State Machines

### Sample Status

```
(new) ──► Registered ──► PendingTesting ──► InTesting ──► PendingQAReview ──► Released
                                                                      └──► Rejected
```

| Transition | Trigger | Guard |
|---|---|---|
| → Registered | POST /samples (5 checks passed) | All 5 GMP checks must pass |
| → PendingTesting | SRF e-sig (§11.50) | Analyst password verified |
| → InTesting | Analyst opens task (barcode scan) | Task must be Assigned |
| → PendingQAReview | All steps signed off | All `DigitalLogbookEntry` rows Signed |
| → Released | QA approves CoA | No open OOS; all reviews complete |
| → Rejected | QA rejects + reason | Mandatory rejection reason |

### DigitalLogbookEntry Status

```
Pending ──► Signed ──► Superseded
                │
                └──► (amendment) ──► new Pending ──► Signed
```

### TestExecution Status

```
Assigned ──► InProgress ──► Completed
     └──────────────────► OOSOpen
```

---

## 7. Invariants (Business Rules Enforced by Domain)

1. `DigitalLogbookEntry.calculatedResult` — never set by analyst, only by `ParameterCalculationService`
2. `DigitalLogbookEntry.specMinSnapshot` — captured at test time; never updated when spec changes later
3. `ElectronicSignature` rows — never updated or deleted; every new sign-off = new INSERT
4. `SampleContainer` — can only be split when `sample.status` is `Registered` or `PendingTesting`
5. `TestExecution` re-assign — only allowed when `status == 'Assigned'`
6. Amendment — only allowed on `DigitalLogbookEntry.status == 'Signed'`
7. `LoginAuditLog` — INSERT-only; `outcome` one of: `Success | Failed | LockedOut`
8. OOS investigation must be closed before sample can proceed to `Released`
9. `UserTrainingRecord.validUntil` expiry = hard block at WAP assignment (no override)
10. `Instrument.calibration_due` past = hard block at WAP assignment (no override)
