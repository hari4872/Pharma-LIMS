# Pharma LIMS — User Role & Permission Matrix
### Architecture Document · v1.0 · 2026-05-27
**Standard:** 21 CFR Part 11 §11.10(d) / EU GMP Annex 11 §6 / ALCOA+ Attributable

---

## 1. User Types

| Type | Description | Who |
|---|---|---|
| `Admin` | System administrator — full access; user management; config; unlock accounts | IT / Lab IT |
| `RegularUser` | All lab roles — access governed by `role` field | Analysts, QA, Managers |

---

## 2. Roles (RegularUser variants)

| Role | Primary Function | Segregation Constraint |
|---|---|---|
| `Analyst` | Register samples, enter results, e-sign steps | Cannot self-approve or peer-review own results |
| `QA` | Approve specs, review CoA, close OOS, approve calibration | Cannot be the testing analyst |
| `QCLead` | QC Lead verification (4-eyes step 3) | Cannot be the analyst OR the peer reviewer |
| `LabManager` | WAP assignment, work queue management | Cannot enter results (operational separation) |
| `Supervisor` | Cross-module read + limited write | No e-sig authority on compliance events |
| `ReadOnly` | View-only across all modules | No create/update/delete on any entity |

---

## 3. Permission Matrix

### Master Data Module

| Action | Admin | QA | LabManager | Analyst | Supervisor | ReadOnly |
|---|---|---|---|---|---|---|
| View laboratories | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create / edit lab | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View materials | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create / edit material | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View instruments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create instrument | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Log calibration | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve calibration (e-sig) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View test methods | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create / edit test method | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve spec limit (e-sig) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View users | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Create / edit users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Unlock user account | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Sample Registration Module

| Action | Admin | QA | LabManager | Analyst | Supervisor | ReadOnly |
|---|---|---|---|---|---|---|
| View samples | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Register sample | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| E-sign SRF | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Split containers | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Destroy container | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| View containers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Work Queue (WAP) Module

| Action | Admin | QA | LabManager | Analyst | Supervisor | ReadOnly |
|---|---|---|---|---|---|---|
| View work queue | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Assign task (WAP) | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Re-assign execution | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Start task | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Enter results | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Sign off step (e-sig) | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |

### Digital Logbook Module

| Action | Admin | QA | LabManager | Analyst | Supervisor | ReadOnly |
|---|---|---|---|---|---|---|
| View logbook entries | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export CSV | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Amend entry (post-sign) | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |

### OOS Investigations Module

| Action | Admin | QA | LabManager | Analyst | Supervisor | ReadOnly |
|---|---|---|---|---|---|---|
| View investigations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Close Phase 1 (e-sig) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Close Phase 2 (e-sig) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

### QA Review & CoA Module

| Action | Admin | QA | LabManager | Analyst | Supervisor | ReadOnly |
|---|---|---|---|---|---|---|
| View CoA list | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Peer review (e-sig) | ❌ | ❌ | ❌ | ✅* | ❌ | ❌ |
| QC Lead verify (e-sig) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| QC Lead verify | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve CoA (e-sig) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reject CoA (e-sig) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

*Peer reviewer must be a different user than the testing analyst (enforced at API).

### Compliance & Audit Module

| Action | Admin | QA | LabManager | Analyst | Supervisor | ReadOnly |
|---|---|---|---|---|---|---|
| View audit trail | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| View login audit | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View e-sig log | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Export compliance reports | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Stability Study Module

| Action | Admin | QA | LabManager | Analyst | Supervisor | ReadOnly |
|---|---|---|---|---|---|---|
| View stability protocols | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create stability protocol | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Approve protocol (e-sig) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View ICH regression chart | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 4. Segregation of Duties — Critical Rules

| Rule | Enforcement Point | Regulation |
|---|---|---|
| Analyst cannot peer-review own results | `reviewer_id ≠ analyst_id` check in `PeerReviewCommand` handler | GMP / 21 CFR §11.50 |
| QC Lead ≠ Analyst AND ≠ Peer Reviewer | Three-way inequality check in `QCLeadVerifyCommand` | GMP |
| QA cannot be testing analyst | `role == 'QA'` blocks result entry in `SubmitResultsCommand` | GMP |
| Lab Manager cannot enter results | `role == 'LabManager'` blocks entry | GMP — planning vs execution separation |
| Admin cannot delete compliance records | No DELETE endpoint exists for any compliance entity | 21 CFR §11.10(c) |
| Only Admin can unlock accounts | `POST /users/{id}/unlock` requires `userType == 'Admin'` | 21 CFR §11.10(d) |
| E-sig requires independent password | BCrypt.Verify on every e-sig; session token alone insufficient | 21 CFR §11.300 |

---

## 5. Access Enforcement Architecture

```
Request arrives at Controller
  │
  ├── [Authorize] attribute → JWT token validation
  │     Invalid token → 401 Unauthorized
  │
  ├── Role check in handler (if role-specific action)
  │     Wrong role → 403 Forbidden
  │
  ├── Segregation check (if 4-eyes rule applies)
  │     Same user attempting both sides → 422 Unprocessable
  │
  └── Business state check (entity must be in correct state)
        Wrong state → 422 Unprocessable + error code
```

All access enforcement is **server-side**. Frontend shows/hides buttons for UX, but the API rejects any unauthorised call regardless of UI state.
