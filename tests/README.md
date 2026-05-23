# LIMS Playwright Tests

## Setup (Run Once)

```bash
cd D:\Pharma-LIMS\tests
npm install
npx playwright install chromium
```

## Before Running Tests

Make sure both servers are running:

```bash
# Terminal 1 — Backend
cd D:\Pharma-LIMS
start.bat

# Terminal 2 — Frontend
cd D:\Pharma-LIMS\frontend
npm run dev
```

## Run Tests

```bash
# Quick smoke test — checks all pages load (2 mins)
npm run test:smoke

# Full flow test — tests every workflow step (5 mins)
npm run test:flow

# Run all tests
npm run test:all

# See browser while testing (slow mode)
npm run test:headed

# View HTML report after tests
npm run test:report
```

## Test Credentials

| Field    | Value     |
|----------|-----------|
| Username | admin     |
| Password | Admin@123 |

## What Each Test Checks

### smoke.test.ts
- Login page renders correctly
- Login with valid credentials works
- All 23 pages load without crashing
- Unauthenticated access redirects to login

### full-flow.test.ts
- Step 1: All Master Data pages (Lab, Materials, Instruments, Methods, Parameters, Spec Limits, Checkpoints)
- Step 2: Sample Registration — form opens, all 4 sections visible, checkpoints selectable
- Step 3: Work Queue — loads, Assign Task form works, status filter correct
- Step 4: QA modules — Results Review, OOS Investigations, Digital Logbook, CoA Review
- Step 5: Phase 5 modules — Traceability, Stability, Retain Samples, Dispatch QC
- Compliance checks — Sign SRF button visible, Dashboard, Compliance Panel
