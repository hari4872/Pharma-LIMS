# Pharma LIMS — C4 Architecture Model
### Architecture Document · v1.0 · 2026-05-27

---

## Level 1 — System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL ACTORS                             │
│                                                                     │
│  [QC Analyst]   [Lab Manager]   [QA Officer]   [Admin]             │
│       │               │               │            │               │
│       └───────────────┴───────────────┴────────────┘               │
│                               │                                     │
│                               ▼                                     │
│            ┌─────────────────────────────────┐                     │
│            │         PHARMA LIMS             │                     │
│            │   21 CFR Part 11 Compliant      │                     │
│            │   Laboratory Information        │                     │
│            │   Management System             │                     │
│            └────────────┬────────────────────┘                     │
│                         │                                           │
│          ┌──────────────┼─────────────────┐                        │
│          ▼              ▼                 ▼                         │
│     [ERP System]  [Barcode Printer]  [Email SMTP]                  │
│    (CoA dispatch)  (label print)     (CoA distrib.)                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Level 2 — Container Diagram

```
┌─────────────────────── Pharma LIMS ────────────────────────────────┐
│                                                                     │
│  ┌─────────────────────────────────────────────┐                   │
│  │            React 19 SPA (Frontend)          │                   │
│  │         TypeScript · Vite · Port 5173       │                   │
│  │                                             │                   │
│  │  Pages: Sample Registration, Work Queue,    │                   │
│  │  Digital Logbook, Stability Study,          │                   │
│  │  Compliance Panel, Dashboards, etc.         │                   │
│  └─────────────────────┬───────────────────────┘                   │
│                        │  HTTP/JSON (Axios)                         │
│                        │  Proxy → localhost:5204                   │
│                        ▼                                           │
│  ┌─────────────────────────────────────────────┐                   │
│  │          .NET 8 Web API (Backend)           │                   │
│  │    Clean Architecture · CQRS · MediatR      │                   │
│  │              Port 5204                      │                   │
│  │                                             │                   │
│  │  Controllers → Commands/Queries → Handlers  │                   │
│  │  Background Jobs (13 IHostedService jobs)   │                   │
│  │  JWT Auth · BCrypt · EF Core 8              │                   │
│  └────────┬──────────────────────┬─────────────┘                   │
│           │  EF Core             │  HttpClient                     │
│           ▼                      ▼                                  │
│  ┌────────────────┐   ┌──────────────────────┐                     │
│  │  PostgreSQL 16 │   │  Groq AI (External)  │                     │
│  │  Azure-hosted  │   │  llama-3.1-8b-instant│                     │
│  │  29 Migrations │   │  (Chatbot only)      │                     │
│  └────────────────┘   └──────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Level 3 — Component Diagram (Backend API)

```
┌──────────────────────── .NET 8 API ─────────────────────────────────┐
│                                                                      │
│  LIMS.API (Controllers)                                             │
│  ├── AuthController           ← Login, JWT refresh, lockout         │
│  ├── UsersController          ← CRUD + unlock endpoint              │
│  ├── LaboratoriesController   ← Lab master data                     │
│  ├── MaterialsController      ← Material CRUD                       │
│  ├── InstrumentsController    ← Instrument + calibration            │
│  ├── TestMethodsController    ← Methods + parameters                │
│  ├── SpecLimitsController     ← Spec limit lifecycle                │
│  ├── SamplesController        ← Registration + SRF sign-off         │
│  ├── SampleContainersController ← Aliquot split + destroy           │
│  ├── TestExecutionsController ← WAP assign + re-assign + results    │
│  ├── DigitalLogbookController ← Entries + amendment + CSV export    │
│  ├── OosInvestigationsController ← Phase 1 + Phase 2               │
│  ├── StabilityTrendController ← ICH Q1A regression                 │
│  ├── AuditController          ← Login audit history                 │
│  └── ComplianceController     ← Audit trail, e-sig log             │
│                                                                      │
│  LIMS.Application (CQRS Handlers)                                   │
│  ├── Features/Samples/        ← RegisterSample, SplitContainers     │
│  ├── Features/TestExecutions/ ← AssignWorkQueue, AssignTestMethod   │
│  ├── Features/DigitalLogbook/ ← GetEntries, AmendEntry              │
│  ├── Features/Stability/      ← GetStabilityTrend (ICH regression)  │
│  └── Features/*/              ← All other CQRS handlers             │
│                                                                      │
│  LIMS.Domain (Entities + Enums)                                     │
│  └── Entities: User, Sample, Instrument, TestExecution,             │
│                DigitalLogbookEntry, LoginAuditLog,                  │
│                SampleContainer, StabilityTrendPoint, ...            │
│                                                                      │
│  LIMS.Infrastructure                                                │
│  ├── LimsDbContext (EF Core)                                        │
│  ├── PhaseBConfiguration (EF fluent config, snake_case tables)      │
│  ├── Migrations/ (29 migrations)                                    │
│  └── BackgroundJobs/ (CalibrationDueDate, TrainingExpiry, ...)      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Level 4 — Code Diagram: Sample Registration Flow

```
SamplesController.Register(RegisterSampleRequest)
  │
  └─► RegisterSampleCommand (MediatR Send)
        │
        └─► RegisterSampleHandler
              ├── SampleValidatorService.Validate()
              │     ├── Check 1: lot not expired
              │     ├── Check 2: approved spec exists
              │     ├── Check 3: instrument calibrated
              │     ├── Check 4: analyst training current
              │     └── Check 5: reagent in stock
              ├── ISampleIdFormatService.Generate()  ← from lab_config
              ├── IFormTemplateSelectorService.Select()
              ├── dbContext.Samples.Add(sample)
              ├── dbContext.SaveChangesAsync()
              └── return SampleDto

SamplesController.SignSrf(sampleId, SignSrfRequest)
  │
  └─► IElectronicSignatureService.CreateSignature()
        ├── BCrypt.Verify(password, user.PasswordHash)   ← §11.300
        ├── INSERT electronic_signatures (full_name, signed_at, meaning, reason)
        └── sample.Status → PendingTesting
```

---

## Deployment View

```
Azure Cloud
├── App Service (Linux)
│     └── LIMS.API (dotnet publish → backend/publish/)
│           Port: 5204 (HTTP)
│
├── Azure Database for PostgreSQL (Flexible Server)
│     Host: 52.230.33.120:5432
│     DB:   limslite
│     User: limsliteuser
│
└── Static Web / CDN (optional)
      └── Vite build output (dist/)
            Served by App Service or Azure Static Web Apps
```
