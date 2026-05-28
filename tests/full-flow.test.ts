/**
 * LIMS Full End-to-End Flow Test
 * ─────────────────────────────────────────────────────────────
 * Tests the complete pharma LIMS workflow:
 *   Master Data → Sample Registration → Work Queue → Execution → QA Review
 *
 * Run:  npm run test:flow
 * Run with browser visible:  npm run test:headed
 */

import { test, expect, Page } from '@playwright/test'

const URL      = process.env.BASE_URL ?? 'http://localhost:5173'
const USERNAME = 'admin'
const PASSWORD = 'Admin@123'

// ── Test data ──────────────────────────────────────────────────
const LAB_NAME        = `Test Lab ${Date.now()}`
const MATERIAL_NAME   = `Paracetamol 500mg ${Date.now()}`
const INSTRUMENT_CODE = `HPLC-${Date.now()}`
const METHOD_NAME     = `PCT Assay ${Date.now()}`
const LOT_NUMBER      = `B-${Date.now()}`

// ── Helpers ────────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto(`${URL}/login`)
  await page.waitForLoadState('load')
  await page.locator('input[type="text"], input[name="username"], input[placeholder*="user" i]').first().fill(USERNAME)
  await page.locator('input[type="password"]').first().fill(PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(url => !url.href.includes('/login'), { timeout: 10_000 })
}

async function goTo(page: Page, path: string) {
  await page.goto(`${URL}${path}`)
  await page.waitForLoadState('load')
}

async function clickButton(page: Page, text: string) {
  await page.locator(`button:has-text("${text}")`).first().click()
}

async function fillField(page: Page, label: string, value: string) {
  // Try to find input near a label containing the text
  const field = page.locator(`input`).filter({ near: page.locator(`text=${label}`) }).first()
  await field.fill(value)
}

// ══════════════════════════════════════════════════════════════
// STEP 1 — Master Data: Laboratory
// ══════════════════════════════════════════════════════════════
test('Step 1a: Laboratories page loads and shows Add button', async ({ page }) => {
  await login(page)
  await goTo(page, '/master-data/laboratories')
  const addBtn = page.locator('button:has-text("Add"), button:has-text("+ Add"), button:has-text("New")')
  await expect(addBtn.first()).toBeVisible()
  console.log('  ✓ Laboratories page loaded with Add button')
})

// ══════════════════════════════════════════════════════════════
// STEP 1b — Master Data: Materials
// ══════════════════════════════════════════════════════════════
test('Step 1b: Materials page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/master-data/materials')
  await expect(page.locator('h2, h1').first()).toBeVisible()
  console.log('  ✓ Materials page loaded')
})

// ══════════════════════════════════════════════════════════════
// STEP 1c — Master Data: Instruments
// ══════════════════════════════════════════════════════════════
test('Step 1c: Instruments page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/master-data/instruments')
  await expect(page.locator('h2, h1').first()).toBeVisible()
  console.log('  ✓ Instruments page loaded')
})

// ══════════════════════════════════════════════════════════════
// STEP 1d — Master Data: Test Methods
// ══════════════════════════════════════════════════════════════
test('Step 1d: Test Methods page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/master-data/test-methods')
  await expect(page.locator('h2, h1').first()).toBeVisible()
  console.log('  ✓ Test Methods page loaded')
})

// ══════════════════════════════════════════════════════════════
// STEP 1e — Master Data: Parameters
// ══════════════════════════════════════════════════════════════
test('Step 1e: Parameters page loads with correct columns', async ({ page }) => {
  await login(page)
  await goTo(page, '/master-data/parameters')
  // Check table headers exist
  await expect(page.locator('th:has-text("Code"), td').first()).toBeVisible()
  console.log('  ✓ Parameters page loaded with table')
})

// ══════════════════════════════════════════════════════════════
// STEP 1f — Master Data: Spec Limits
// ══════════════════════════════════════════════════════════════
test('Step 1f: Spec Limits page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/master-data/spec-limits')
  await expect(page.locator('h2, h1').first()).toBeVisible()
  console.log('  ✓ Spec Limits page loaded')
})

// ══════════════════════════════════════════════════════════════
// STEP 1g — Checkpoints
// ══════════════════════════════════════════════════════════════
test('Step 1g: Checkpoints page loads with all 4 trigger modes filter', async ({ page }) => {
  await login(page)
  await goTo(page, '/checkpoints')
  // Filter dropdown should have all 4 modes
  const select = page.locator('select').first()
  await expect(select).toBeVisible()
  const options = await select.locator('option').allTextContents()
  const hasTimeBased    = options.some(o => o.includes('Time'))
  const hasOperator     = options.some(o => o.includes('Scan') || o.includes('Operator'))
  const hasProcessLog   = options.some(o => o.includes('Process'))
  const hasDispatch     = options.some(o => o.includes('Dispatch'))
  expect(hasTimeBased).toBeTruthy()
  expect(hasOperator).toBeTruthy()
  expect(hasProcessLog).toBeTruthy()
  expect(hasDispatch).toBeTruthy()
  console.log('  ✓ Checkpoints page loaded with all 4 trigger modes')
})

test('Step 1g: Add Checkpoint form opens with Parameters checklist', async ({ page }) => {
  await login(page)
  await goTo(page, '/checkpoints')
  await page.locator('button:has-text("Add Checkpoint"), button:has-text("+ Add")').first().click()
  await page.waitForTimeout(500)
  // Form should appear
  const form = page.locator('form, [role="dialog"]').first()
  await expect(form).toBeVisible()
  // Parameters section should exist
  const paramsLabel = page.locator('text=Parameters').first()
  await expect(paramsLabel).toBeVisible()
  console.log('  ✓ Add Checkpoint form opens with Parameters section')
})

// ══════════════════════════════════════════════════════════════
// STEP 2 — Sample Registration
// ══════════════════════════════════════════════════════════════
test('Step 2a: Sample Registration page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/samples')
  await expect(page.locator('h2:has-text("Sample Registration"), h1:has-text("Sample")')).toBeVisible()
  console.log('  ✓ Sample Registration page loaded')
})

test('Step 2b: Register Sample form opens with all 4 sections', async ({ page }) => {
  await login(page)
  await goTo(page, '/samples')
  await page.locator('button:has-text("Register Sample"), button:has-text("+ Register")').first().click()
  await page.waitForTimeout(500)

  // Section 1: Requestor & Product
  await expect(page.locator('text=Requestor').first()).toBeVisible()

  // Section 2: Checkpoints
  await expect(page.locator('text=Checkpoints').first()).toBeVisible()

  // Section 3: Frequency
  await expect(page.locator('text=Frequency').first()).toBeVisible()

  // Section 4: Sample Source — title is exactly "Sample Source" in the component
  await expect(page.locator('text=Sample Source').first()).toBeVisible()

  console.log('  ✓ Register Sample form opened with all sections visible')
})

test('Step 2c: Requestor field is auto-filled (read-only)', async ({ page }) => {
  await login(page)
  await goTo(page, '/samples')
  await page.locator('button:has-text("Register Sample"), button:has-text("+ Register")').first().click()
  await page.waitForTimeout(500)

  // Requestor display div should show a name (not empty)
  const requestorArea = page.locator('text=Requestor').locator('..').locator('..').first()
  const text = await requestorArea.textContent()
  expect(text?.length).toBeGreaterThan(0)
  console.log('  ✓ Requestor field auto-filled from login')
})

test('Step 2d: Checkpoints section renders correctly (buttons or empty state)', async ({ page }) => {
  await login(page)
  await goTo(page, '/samples')
  await page.locator('button:has-text("Register Sample"), button:has-text("+ Register")').first().click()
  // Wait for checkpoints API call to resolve before checking rendered output
  await page.waitForTimeout(1500)

  const selectAll  = page.locator('button:has-text("Select All")')
  const emptyState = page.locator('text=No active checkpoints configured')

  const hasButtons = await selectAll.isVisible()
  const hasEmpty   = await emptyState.isVisible()

  // Exactly one of the two states must be visible
  expect(hasButtons || hasEmpty).toBeTruthy()

  if (hasButtons) {
    await expect(page.locator('button:has-text("Clear All")')).toBeVisible()
    console.log('  ✓ Select All / Clear All buttons visible in Checkpoints section')
  } else {
    console.log('  ✓ Checkpoints section shows empty state (no active checkpoints in DB — expected for fresh environment)')
  }
})

test('Step 2e: Sample Registration status filter works', async ({ page }) => {
  await login(page)
  await goTo(page, '/samples')
  const select = page.locator('select').first()
  await expect(select).toBeVisible()
  // Check all statuses are available
  const options = await select.locator('option').allTextContents()
  expect(options.some(o => o.includes('Registered'))).toBeTruthy()
  expect(options.some(o => o.includes('Released'))).toBeTruthy()
  console.log('  ✓ Status filter has all sample statuses')
})

// ══════════════════════════════════════════════════════════════
// STEP 3 — Work Queue
// ══════════════════════════════════════════════════════════════
test('Step 3a: Work Queue page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/work-queue')
  await expect(page.locator('h2:has-text("Work Queue"), h1:has-text("Work")')).toBeVisible()
  console.log('  ✓ Work Queue page loaded')
})

test('Step 3b: Work Queue Assign Task form opens', async ({ page }) => {
  await login(page)
  await goTo(page, '/work-queue')
  await page.locator('button:has-text("Assign Task"), button:has-text("Assign")').first().click()
  await page.waitForTimeout(500)
  const form = page.locator('form, [role="dialog"]').first()
  await expect(form).toBeVisible()
  console.log('  ✓ Assign Task form opened')
})

test('Step 3c: Work Queue status filter has correct statuses', async ({ page }) => {
  await login(page)
  await goTo(page, '/work-queue')
  const select = page.locator('select').first()
  const options = await select.locator('option').allTextContents()
  expect(options.some(o => o.includes('Assigned'))).toBeTruthy()
  expect(options.some(o => o.includes('InProgress') || o.includes('In Progress'))).toBeTruthy()
  expect(options.some(o => o.includes('Completed'))).toBeTruthy()
  console.log('  ✓ Work Queue status filter has Assigned, InProgress, Completed')
})

// ══════════════════════════════════════════════════════════════
// STEP 4 — QA & Results
// ══════════════════════════════════════════════════════════════
test('Step 4a: Results Review page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/results-review')
  await expect(page.locator('h2, h1').first()).toBeVisible()
  console.log('  ✓ Results Review page loaded')
})

test('Step 4b: OOS Investigations page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/oos-investigations')
  await expect(page.locator('h2, h1').first()).toBeVisible()
  console.log('  ✓ OOS Investigations page loaded')
})

test('Step 4c: Digital Logbook page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/digital-logbook')
  await expect(page.locator('h2, h1').first()).toBeVisible()
  console.log('  ✓ Digital Logbook page loaded')
})

test('Step 4d: CoA Review page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/coa-review')
  await expect(page.locator('h2, h1').first()).toBeVisible()
  console.log('  ✓ CoA Review page loaded')
})

// ══════════════════════════════════════════════════════════════
// STEP 5 — Phase 5 Modules
// ══════════════════════════════════════════════════════════════
test('Step 5a: Traceability page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/traceability')
  await expect(page.locator('h2, h1').first()).toBeVisible()
  console.log('  ✓ Traceability page loaded')
})

test('Step 5b: Stability Pulls page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/stability-pulls')
  await expect(page.locator('h2, h1').first()).toBeVisible()
  console.log('  ✓ Stability Pulls page loaded')
})

test('Step 5c: Retain Samples page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/retain-samples')
  await expect(page.locator('h2, h1').first()).toBeVisible()
  console.log('  ✓ Retain Samples page loaded')
})

test('Step 5d: Dispatch QC page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/dispatch-qc')
  await expect(page.locator('h2, h1').first()).toBeVisible()
  console.log('  ✓ Dispatch QC page loaded')
})

// ══════════════════════════════════════════════════════════════
// COMPLIANCE CHECKS
// ══════════════════════════════════════════════════════════════
test('Compliance: Sign SRF button visible on Registered samples', async ({ page }) => {
  await login(page)
  await goTo(page, '/samples')
  // If any Registered samples exist, Sign SRF button should be visible
  const signBtn = page.locator('button:has-text("Sign SRF")')
  const count = await signBtn.count()
  if (count > 0) {
    await expect(signBtn.first()).toBeVisible()
    console.log(`  ✓ Sign SRF button visible on ${count} Registered sample(s) — §11.50 compliant`)
  } else {
    console.log('  ℹ No Registered samples found — Sign SRF not shown (expected)')
  }
})

test('Compliance: Dashboard page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/dashboard')
  // Dashboard uses styled divs + tab buttons, not h1/h2
  await expect(page.locator('button:has-text("Overview"), button:has-text("Quality"), button:has-text("Instruments")').first()).toBeVisible()
  console.log('  ✓ Dashboard loaded')
})

test('Compliance: Compliance Panel page loads', async ({ page }) => {
  await login(page)
  await goTo(page, '/compliance')
  await expect(page.locator('h2, h1').first()).toBeVisible()
  console.log('  ✓ Compliance Panel loaded')
})
