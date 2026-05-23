# Pharma LIMS — 21 CFR Part 11 Compliant Laboratory Information Management System

> **Regulatory Coverage:** 21 CFR Part 11 · 21 CFR Part 211 · EU GMP Annex 11 · ALCOA+ · FDA OOS Guidance 2006 · ICH Q1A · ISO 17025 · GAMP 5

A full-stack, production-grade Pharmaceutical LIMS covering the complete sample lifecycle — from master data configuration through sample registration, test execution, QA review, CoA generation, and dispatch — with end-to-end electronic signature compliance and real-time SignalR push.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | .NET 8 · Clean Architecture (CQRS / MediatR) · EF Core 8 · SignalR |
| Frontend | React 18 · TypeScript · Vite · Redux Toolkit · React Router v6 |
| Database | PostgreSQL 16 (Neon cloud) · 18 EF Core migrations · 15 normalizer views |
| Testing | Playwright · 27 tests · 25 passing |
| Auth | JWT Bearer · BCrypt password hash · §11.300 re-entry on every e-sig |

---

## Quick Start

### Backend
```bash
cd backend
dotnet restore
dotnet run --project src/LIMS.Api/LIMS.Api.csproj
# API available at http://localhost:5204
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:5173
# /api/* proxied to backend port 5204
```

### Default Credentials
| Field | Value |
|---|---|
| Username | `admin` |
| Password | `Admin@123` |

---

## Pages & Routes

### Overview
| Page | Route | Description |
|---|---|---|
| Dashboard | `/dashboard` | WIP, TAT, OOS heat, instrument status, alert queue |
| Compliance Panel | `/compliance` | Audit trail, e-sig log, OOS log, periodic reviews |

### Master Data
| Page | Route |
|---|---|
| Laboratories | `/master-data/laboratories` |
| Instruments | `/master-data/instruments` |
| Materials | `/master-data/materials` |
| Test Methods | `/master-data/test-methods` |
| Parameters | `/master-data/parameters` |
| Spec Limits | `/master-data/spec-limits` |
| Form Templates | `/master-data/form-templates` |
| Users | `/master-data/users` |
| Sample Types | `/master-data/sample-types` |
| Storage Locations | `/master-data/storage-locations` |
| Reagents & Standards | `/master-data/reagents` |
| Training Records | `/master-data/training-records` |

### Operations
| Page | Route |
|---|---|
| Sample Registration | `/samples` |
| Checkpoints | `/checkpoints` |
| Work Queue | `/work-queue` |
| Test Execution | `/test-execution/:id` |
| OOS Investigations | `/oos-investigations` |
| Digital Logbook | `/digital-logbook` |
| Results Review | `/results-review` |
| CoA Review | `/coa-review` |
| Dispatch QC | `/dispatch-qc` |

### Inventory & Traceability
| Page | Route |
|---|---|
| Traceability | `/traceability` |
| Stability Pulls | `/stability-pulls` |
| Retain Samples | `/retain-samples` |
| Condition Excursions | `/condition-excursions` |

---

## Database — Seeded Data

The Neon PostgreSQL database is pre-seeded with a full end-to-end pharma workflow:

### Master Data (SeedData_CompletePharmWorkflow)
- 1 laboratory (Apex Pharma Laboratories, Singapore)
- 5 users (Admin, 2 Analysts, QA Officer, Lab Manager)
- 4 materials (Paracetamol API, Ibuprofen API, MCC, Purified Water)
- 3 test methods (HPLC Assay, Dissolution, pH/Conductivity)
- 5 parameters with formulas and spec limits
- 3 storage locations (Ambient, Refrigerator, Freezer)
- 6 samples across all lifecycle statuses (Released, Registered, Rejected, InTesting, PendingQAReview)
- 4 test executions with digital logbook entries
- 2 released CoAs, 1 closed OOS investigation, 2 retain samples

### Operational Data (SeedData_FullEndToEnd)
- 9 user training records (all analysts trained on all methods, valid 2 years)
- 4 checkpoints (all trigger modes: TimeBased / OperatorScan / ProcessLog / DispatchEvent)
- 12 checkpoint trigger logs (including 1 offline-sync entry — Annex 11 §4.3)
- 4 results reviews (full PeerReview → QcLead → QaOfficer chain)
- 4 CoA lines (linking CoAs to logbook entries)
- 5 stability pulls — ICH Q1A programme: T3M (Pulled), T6M/T12M/T18M/T24M (Pending)
- 3 condition excursions (temperature spike, temperature drop, humidity breach)
- 3 delivery orders (2 dispatched, 1 pending)
- 3 validation review logs (Annual Product Review, CSV 21 CFR Part 11, Process Validation)

### Phase 12 — 15 Normalizer Views (vw_*)
`vw_active_spec_limits` · `vw_instrument_status` · `vw_training_currency` · `vw_sample_pipeline` · `vw_oos_heat` · `vw_coa_readiness` · `vw_tat_summary` · `vw_stability_schedule` · `vw_compliance_summary` · `vw_alert_queue` · `vw_reagent_expiry` · `vw_qa_checklist` · `vw_sample_traceability` · `vw_coa_history` · `vw_quality_kpis`

---

## Architecture Principles

### Contract 1 — Single Source of Truth
- Every business rule owned by exactly **one** named service class
- FK-only references — no master data copied into consuming tables
- One normalizer view per data domain — same view drives every UI panel
- Soft-delete only (`is_active = FALSE`) — no physical DELETE anywhere

### Contract 2 — All Compute Server-Side
- React renders, never computes
- All auto-correction, formula evaluation, OOS/OOT detection runs in .NET services
- All push via SignalR — no polling, no `setInterval`, no repeated GET
- All timestamps UTC server-side (`DateTimeOffset.UtcNow`) — ALCOA+ Contemporaneous
- No hardcoded values — every threshold, timing, format from `lab_config` table

### 21 CFR Part 11 Compliance
- **§11.50** — 4-field e-signature on every compliance action: `full_name` + `signed_at` UTC + `meaning` + `reason`
- **§11.300** — BCrypt password re-entry verified independently of session before every e-sig
- **§11.10(e)** — INSERT-only audit tables (DB triggers block UPDATE/DELETE on `electronic_signatures`, `calibration_records`, `master_data_audit_logs`, `checkpoint_trigger_logs`, etc.)

### EU GMP Annex 11 §4.3 — Offline Resilience
- `useOfflineScanQueue` hook queues checkpoint scans to `localStorage` when offline
- Auto-flushes atomically on reconnect with `isOfflineSync: true` flag in trigger log
- Pending count shown in banner; never silently lost

---

## Repository

GitHub: [https://github.com/hari4872/Pharma-LIMS](https://github.com/hari4872/Pharma-LIMS)

---

## Documentation

| Document | Location |
|---|---|
| Entity Relationship Diagram | `docs/ERD.md` |
| Data Flow Diagram | `docs/DFD.md` |
| Master Data TDD | `docs/.md files/LIMS_TD_01_Master_Data_v1_2.md` |
| Sample Registration TDD | `docs/.md files/LIMS_TD_02_Sample_Registration_v1_2.md` |
| Testing Execution TDD | `docs/.md files/LIMS_TD_03_Testing_Execution_v1_2.md` |
| Results Management TDD | `docs/.md files/LIMS_TD_04_Results_Management_v1_2.md` |
| QA Review & Release TDD | `docs/.md files/LIMS_TD_05_QA_Review_Release_v1_2.md` |
| Traceability TDD | `docs/.md files/LIMS_TD_06_Traceability_v1_2.md` |
| Sample Inventory TDD | `docs/.md files/LIMS_TD_07_Sample_Inventory_v1_2.md` |
| Instrument Management TDD | `docs/.md files/LIMS_TD_08_Instrument_Management_v1_2.md` |
| Parameters TDD | `docs/.md files/LIMS_TD_1A_Parameters_v1_1.md` |
| Checkpoints TDD | `docs/.md files/LIMS_TD_1B_Checkpoints_v1_1.md` |
| Form Templates TDD | `docs/.md files/LIMS_1C_Form_Template_v1.md` |
| Digital Logbook TDD | `docs/.md files/LIMS_TD_3A_Digital_Logbook_v1_1.md` |
| CoA Generation TDD | `docs/.md files/LIMS_09_CoA_Generation_v1.md` |
| Dispatch QC TDD | `docs/.md files/LIMS_10_Dispatch_QC_v1.md` |
| Dashboards TDD | `docs/.md files/LIMS_11_Dashboards_v1.md` |
| Compliance Governance TDD | `docs/.md files/LIMS_12_Compliance_Governance_v1.md` |
| E2E Test Suite | `tests/README.md` |
