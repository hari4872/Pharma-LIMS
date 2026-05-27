# Pharma LIMS — System Overview
### Architecture Document · v1.0 · 2026-05-27
**Standard:** 21 CFR Part 11 / 21 CFR Part 211 / EU GMP Annex 11 / ALCOA+ / ICH Q1A / ISO 17025

---

## 1. Purpose

Pharma LIMS is a **21 CFR Part 11-compliant Laboratory Information Management System** designed for pharmaceutical QC laboratories. It replaces paper-based lab notebooks and manual workflows with a fully auditable, electronic system covering every stage of the sample lifecycle — from registration to Certificate of Analysis release.

---

## 2. Business Context

| Aspect | Detail |
|---|---|
| **Target Users** | QC Analysts, Lab Managers, QA Officers, Administrators |
| **Regulatory Scope** | FDA 21 CFR Part 11, 21 CFR Part 211, EU GMP Annex 11, ICH Q1A, ISO 17025 |
| **Deployment** | Cloud-hosted (Azure); single-tenant per lab organisation |
| **Key Value** | Eliminates paper lab notebooks; enforces ALCOA+ data integrity; accelerates CoA release |

---

## 3. Key Capabilities

| Module | Description |
|---|---|
| **Master Data** | Laboratories, materials, instruments, test methods, parameters, spec limits, form templates, checkpoints |
| **Sample Registration** | Two-path registration (manual + checkpoint auto-trigger); barcode label auto-print; 5 GMP pre-checks; e-SRF sign-off |
| **Container Management** | Aliquot split, status tracking, controlled destruction with audit trail (LabVantage parity) |
| **Work Queue (WAP)** | Work & Resource Planning — trained analyst + calibrated instrument + capacity enforcement |
| **Testing Execution** | Barcode scan to start; file import; auto-correction; OOS/OOT detection; step e-sign |
| **Digital Logbook** | Single source of truth for all results; INSERT-only; post-sign amendment with e-sig |
| **OOS Investigations** | Phase 1 + Phase 2 mandatory; batch locked until closed (FDA OOS Guidance 2006) |
| **Results Management** | 4-eyes peer review → QC Lead verification → QA approval chain |
| **QA Review & Release** | 10-item checklist; CoA generation + QA lock; ERP integration |
| **Dispatch QC** | Delivery order → QC task → CLEARED/BLOCKED decision |
| **Traceability** | Full chain: Sample ↔ Method ↔ Instrument ↔ Analyst ↔ CoA ↔ Complaint |
| **Stability Study** | ICH Q1A protocol management; regression trend chart; predicted shelf life |
| **Sample Inventory** | Storage locations; stability pull scheduling; retain sample lifecycle |
| **Compliance Panel** | Audit trail; electronic signature log; OOS summary; login audit (§11.10(d)) |
| **Dashboards** | TAT, WIP, OOS rate, instrument utilisation, compliance KPIs |

---

## 4. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **Backend** | .NET 8 (C#), Clean Architecture (CQRS + MediatR) | Single deployable API |
| **Frontend** | React 19, TypeScript, Vite | Inline styles; no CSS framework |
| **Database** | PostgreSQL 16 (Azure) | EF Core 8 code-first; 29 migrations |
| **ORM** | Entity Framework Core 8 | Code-first; migrations managed |
| **Auth** | JWT Bearer + BCrypt password hashing | §11.300 independent password re-entry |
| **AI** | Groq (llama-3.1-8b-instant) | Chatbot assistant only |
| **Background Jobs** | .NET IHostedService | 13 jobs (calibration, training, TAT, etc.) |

---

## 5. Architecture Principles

1. **Sample-Centric** — Every workflow revolves around the `samples` table as the central node.
2. **Single Source of Truth** — `digital_logbook_entries` drives Results, QA Review, CoA, and Traceability. No separate results store.
3. **No Code Duplication** — Every business rule owned by exactly one named service class (Contract 1).
4. **All Compute Server-Side** — React renders; .NET computes. No business logic in the browser.
5. **No Hardcoded Values** — Every threshold, format, and timing comes from `lab_config` in PostgreSQL.
6. **INSERT-Only Audit Tables** — All compliance records immutable at the DB level.
7. **ALCOA+ by Design** — Not by policy. Every principle enforced by a system control.

---

## 6. Compliance Posture

| Standard | Key Controls |
|---|---|
| **21 CFR §11.50** | 4-field e-sig (full_name + signed_at UTC + meaning + reason) on every compliance event |
| **21 CFR §11.10(d)** | 5-strike login lockout → 30-min lock; INSERT-only `LoginAuditLogs`; admin unlock |
| **21 CFR §11.10(e)** | INSERT-only audit logs at DB level; no role can edit or delete |
| **21 CFR §11.300** | BCrypt.Verify independent of session token on every e-sig |
| **EU GMP Annex 11 §10** | Audit trail computer-generated, date/time-stamped, non-modifiable |
| **ALCOA+** | All 9 principles enforced by named system services |
| **ICH Q1A** | Stability protocol management; linear regression trend analysis |
| **FDA OOS Guidance 2006** | Phase 1 + Phase 2 investigation mandatory; batch locked while open |

---

## 7. Non-Functional Requirements

| NFR | Target |
|---|---|
| **Availability** | 99.9% uptime (Azure-hosted) |
| **RPO** | ≤ 24 hours (daily encrypted backup) |
| **RTO** | ≤ 4 hours (recovery procedure tested) |
| **Audit retrieval** | Full traceability chain returned in < 2 seconds |
| **Compliance** | GAMP 5 Category 5; IQ/OQ/PQ documented |

---

## 8. System Boundaries

```
┌──────────────────────────────────────────────────────┐
│                   Pharma LIMS                        │
│                                                      │
│  React Frontend ──► .NET 8 API ──► PostgreSQL (Azure)│
│                          │                           │
│                    Background Jobs                   │
│               (Calibration / Training / TAT)         │
└──────────────────────┬───────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    ERP System    Barcode Printer  Email (CoA)
  (CoA dispatch)  (label auto-print) (distribution)
```
