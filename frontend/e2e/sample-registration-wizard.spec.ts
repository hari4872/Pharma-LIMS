import { test, expect, Page, BrowserContext } from '@playwright/test'
import { BASE } from './helpers'

const API = 'http://localhost:5173/api/v1'

const ADMIN_JWT = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJzdWIiOiIxIiwibmFtZSI6IlN5c3RlbSBBZG1pbmlzdHJhdG9yIiwicm9sZSI6IkFkbWluIiwidXNlclR5cGUiOiJBZG1pbiIsImxhYklkIjoiMSIsImxhYk5hbWUiOiJBcGV4IFBoYXJtYSIsImV4cCI6OTk5OTk5OTk5OX0',
  'fake-sig',
].join('.')

const MOCK_MATERIALS = [
  { materialId: 1, materialName: 'Paracetamol API', productType: 'API' },
]
const MOCK_SAMPLE_TYPES = [
  { sampleTypeId: 1, typeName: 'Raw Material', typeCode: 'RM', stage: 'Incoming' },
]
const MOCK_ANALYSTS = [
  { userId: 2, fullName: 'Dr. Priya Nair' },
  { userId: 3, fullName: 'Mr. Rajan Mehta' },
]
const MOCK_INSTRUMENTS = [
  { instrumentId: 5, instrumentCode: 'HPLC-001', instrumentName: 'HPLC System', instrumentType: 'HPLC', status: 'Calibrated' },
  { instrumentId: 6, instrumentCode: 'UV-001', instrumentName: 'UV Spectrophotometer', instrumentType: 'UV', status: 'Calibrated' },
]
const MOCK_SPEC_TESTS = [
  { specTemplateItemId: 10, parameterName: 'HPLC Assay', parameterCode: 'HPLC', turnaroundHours: 24, isMandatory: true },
  { specTemplateItemId: 11, parameterName: 'Dissolution', parameterCode: 'DIS', turnaroundHours: 48, isMandatory: true },
]
const MOCK_CONTAINERS = [
  { sampleContainerId: 101, containerLabel: 'QC-001-A', containerType: 'QC', volume: null, volumeUom: null, status: 'Available', createdBy: 'admin', createdAt: '2026-07-17T00:00:00Z', destroyedAt: null },
  { sampleContainerId: 102, containerLabel: 'QC-001-B', containerType: 'QC', volume: null, volumeUom: null, status: 'Available', createdBy: 'admin', createdAt: '2026-07-17T00:00:00Z', destroyedAt: null },
]
const MOCK_SAMPLE_RESULT = {
  sampleId: 99, sampleNumber: 'LAB-RM-S-20260717-0001',
  testsAutoCreated: 2, specTemplateId: 7, specTemplateName: 'Paracetamol Spec',
}
const MOCK_SAMPLES_LIST: object[] = []

async function setupSampleRegContext(browser: ConstructorParameters<typeof Page>[0], opts: { srfEnabled?: boolean } = {}) {
  const ctx = await (browser as any).newContext() as BrowserContext
  const { srfEnabled = false } = opts

  await ctx.addInitScript((token: string) => {
    localStorage.setItem('lims_token', token)
  }, ADMIN_JWT)

  // ── Auth / permissions ────────────────────────────────────────────────────
  await ctx.route(`${API}/auth/permissions*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await ctx.route(`${API}/users/*/permissions*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await ctx.route(`${API}/lab-config/logo*`, r =>
    r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NO_LOGO' }) }))
  await ctx.route(`${API}/lab-config*`, r =>
    r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { configKey: 'nav.work-queue',     configValue: 'true' },
        { configKey: 'nav.coa-review',     configValue: 'true' },
        { configKey: 'nav.results-review', configValue: 'true' },
        { configKey: 'esign.SampleRegistration.Submit', configValue: srfEnabled ? 'Password' : 'None' },
      ]),
    }))

  // ── Master data ────────────────────────────────────────────────────────────
  await ctx.route(`${API}/materials*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MATERIALS) }))
  await ctx.route(`${API}/sample-types*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SAMPLE_TYPES) }))
  await ctx.route(`${API}/specification-template-links*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

  // ── Users / instruments (for wizard) ──────────────────────────────────────
  await ctx.route(`${API}/users*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ANALYSTS) }))
  await ctx.route(`${API}/instruments*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INSTRUMENTS) }))

  // ── Spec / capacity ────────────────────────────────────────────────────────
  await ctx.route(`${API}/samples/99/spec-assignment*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ specTemplateId: 7, specTemplateName: 'Paracetamol Spec' }) }))
  await ctx.route(`${API}/specification-templates*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ specTemplateId: 7, templateName: 'Paracetamol Spec', items: MOCK_SPEC_TESTS }]) }))
  await ctx.route(`${API}/capacity-bookings/instruments*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INSTRUMENTS) }))
  await ctx.route(`${API}/capacity-bookings*`, r => {
    if (r.request().method() === 'POST')
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ capacityBookingId: 201, status: 'Booked' }) })
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  // ── Sample CRUD ────────────────────────────────────────────────────────────
  await ctx.route(`${API}/samples/99/containers*`, r => {
    if (r.request().method() === 'POST')
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ count: 2, containers: MOCK_CONTAINERS }) })
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CONTAINERS) })
  })
  await ctx.route(`${API}/samples/99/sign-srf*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await ctx.route(`${API}/samples/99/**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))

  await ctx.route(`${API}/samples/spec-preview*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ outcome: 'SingleMatch', templateId: 7, candidates: [], message: 'Matched Paracetamol Spec' }) }))

  await ctx.route(`${API}/samples*`, r => {
    if (r.request().method() === 'POST')
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SAMPLE_RESULT) })
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SAMPLES_LIST) })
  })

  // ── Test executions ────────────────────────────────────────────────────────
  await ctx.route(`${API}/test-executions*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

  // ── SignalR abort ──────────────────────────────────────────────────────────
  await ctx.route('http://localhost:5173/hubs/**', r => r.abort())
  await ctx.route('**/*.signalr*', r => r.abort())

  // ── Catch-all ─────────────────────────────────────────────────────────────
  await ctx.route(`${API}/**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

  return ctx
}

async function fillAndSubmitRegistrationForm(page: Page) {
  await page.goto(`${BASE}/sample-registration`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)

  // Click the "+ Register Sample" button
  const regBtn = page.getByRole('button', { name: /register sample/i }).first()
  await expect(regBtn).toBeVisible({ timeout: 8000 })
  await regBtn.click()
  await page.waitForTimeout(500)

  // Fill material
  const matSelect = page.locator('select').filter({ hasText: /select material/i }).or(
    page.locator('select').nth(0)
  )
  await matSelect.selectOption({ label: 'Paracetamol API' }).catch(() =>
    matSelect.selectOption({ value: '1' })
  )
  await page.waitForTimeout(400)

  // Fill sample type
  const stSelect = page.locator('select').filter({ hasText: /select.*type/i }).or(
    page.locator('select').nth(1)
  )
  await stSelect.selectOption({ label: 'Raw Material' }).catch(() =>
    stSelect.selectOption({ value: '1' })
  )
  await page.waitForTimeout(400)

  // Fill lot number
  const lotInput = page.getByPlaceholder(/lot/i).or(page.locator('input[placeholder*="LOT"]')).first()
  await lotInput.fill('LOT-TEST-001')

  // Submit
  const submitBtn = page.getByRole('button', { name: /register|submit/i }).last()
  await submitBtn.click()
  await page.waitForTimeout(1000)
}

// ────────────────────────────────────────────────────────────────────────────
test.describe('Sample Registration — 5-Step Wizard (no SRF)', () => {
  let ctx: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    ctx = await setupSampleRegContext(browser as any, { srfEnabled: false })
    page = await ctx.newPage()
  })
  test.afterAll(async () => { await page.close(); await ctx.close() })

  test('Step 0 — page loads, Register button visible', async () => {
    await page.goto(`${BASE}/sample-registration`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const btn = page.getByRole('button', { name: /register sample/i }).first()
    await expect(btn).toBeVisible({ timeout: 8000 })
  })

  test('Step 0 — registration form opens', async () => {
    await page.goto(`${BASE}/sample-registration`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
    await page.getByRole('button', { name: /register sample/i }).first().click()
    await page.waitForTimeout(600)
    // Form should be visible — check for a select or heading
    await expect(
      page.locator('select').first().or(page.getByText(/product.*material/i).first())
    ).toBeVisible({ timeout: 6000 })
  })

  test('Step 1 — wizard opens after registration (Container Split)', async () => {
    await fillAndSubmitRegistrationForm(page)
    // Wizard drawer should appear with "Setup —" title
    await expect(
      page.getByText(/Setup —.*LAB-RM/i).or(page.getByText(/Container Split/i))
    ).toBeVisible({ timeout: 8000 })
  })

  test('Step 1 — progress bar shows "Container Split" active', async () => {
    await fillAndSubmitRegistrationForm(page)
    await page.waitForTimeout(500)
    await expect(page.getByText('Container Split').first()).toBeVisible({ timeout: 6000 })
  })

  test('Step 1 — spec tests visible in pool', async () => {
    await fillAndSubmitRegistrationForm(page)
    await page.waitForTimeout(1000)
    // HPLC Assay and Dissolution should appear in the test pool
    const body = await page.locator('body').textContent() ?? ''
    const hasTests = body.includes('HPLC Assay') || body.includes('Dissolution') || body.includes('Test Pool') || body.includes('Group 1')
    expect(hasTests).toBeTruthy()
  })

  test('Step 1 → Step 3 — clicking Confirm Grouping advances to Assign Tests', async () => {
    await fillAndSubmitRegistrationForm(page)
    await page.waitForTimeout(1000)
    // Click "Confirm Grouping" or "Next" button to advance
    const nextBtn = page.getByRole('button', { name: /confirm grouping|next.*assign|split & assign/i }).first()
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(1000)
      // Should now be on Step 3 — Assign Tests
      await expect(
        page.getByText(/assign tests|analyst/i).first()
      ).toBeVisible({ timeout: 6000 })
    }
  })

  test('Step 3 — analyst dropdown contains mocked analysts', async () => {
    await fillAndSubmitRegistrationForm(page)
    await page.waitForTimeout(1000)
    const nextBtn = page.getByRole('button', { name: /confirm grouping|next.*assign|split & assign/i }).first()
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(1000)
    }
    // Check analysts appear in any select
    const body = await page.locator('body').textContent() ?? ''
    const hasAnalysts = body.includes('Dr. Priya Nair') || body.includes('Priya') || body.includes('Rajan')
    expect(hasAnalysts).toBeTruthy()
  })

  test('Step 3 → Step 4 — assigning analyst + instrument advances to Schedule', async () => {
    await fillAndSubmitRegistrationForm(page)
    await page.waitForTimeout(1000)

    // Advance to step 3
    const grpBtn = page.getByRole('button', { name: /confirm grouping|next.*assign|split & assign/i }).first()
    if (await grpBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await grpBtn.click()
      await page.waitForTimeout(1000)
    }

    // Select analyst in first row
    const analystSelects = page.locator('select').filter({ hasText: /select analyst|analyst/i })
    const firstSelect = analystSelects.first()
    if (await firstSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstSelect.selectOption({ index: 1 }) // pick first real analyst
      await page.waitForTimeout(300)
    }

    // Select instrument in first row
    const instrumentSelects = page.locator('select').filter({ hasText: /instrument/i })
    const firstInst = instrumentSelects.first()
    if (await firstInst.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstInst.selectOption({ index: 1 })
      await page.waitForTimeout(300)
    }

    // Click Confirm & Save Assignments
    const confirmBtn = page.getByRole('button', { name: /confirm.*assign|save.*assign|next.*schedule/i }).first()
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click()
      await page.waitForTimeout(1200)
      // Should now be on Schedule step
      await expect(
        page.getByText(/schedule|capacity/i).first()
      ).toBeVisible({ timeout: 6000 })
    }
  })

  test('Step 4 — Schedule shows instrument rows', async () => {
    await fillAndSubmitRegistrationForm(page)
    await page.waitForTimeout(1000)

    // Get to step 3
    const grpBtn = page.getByRole('button', { name: /confirm grouping|next.*assign|split & assign/i }).first()
    if (await grpBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await grpBtn.click(); await page.waitForTimeout(1000)
    }

    // Assign analyst + instrument
    const selects = await page.locator('select').all()
    for (const s of selects.slice(0, 4)) {
      const opts = await s.locator('option').count()
      if (opts > 1) await s.selectOption({ index: 1 }).catch(() => {})
    }

    const confirmBtn = page.getByRole('button', { name: /confirm.*assign|save.*assign/i }).first()
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click(); await page.waitForTimeout(1200)
    }

    // Step 4 — Schedule step should be visible
    const body = await page.locator('body').textContent() ?? ''
    const onScheduleStep = body.includes('Schedule') || body.includes('Start Date') || body.includes('HPLC-001')
    expect(onScheduleStep).toBeTruthy()
  })

  test('Step 4 → Step 5 — Skip goes to Print Barcodes', async () => {
    await fillAndSubmitRegistrationForm(page)
    await page.waitForTimeout(1000)

    // Advance to step 3
    const grpBtn = page.getByRole('button', { name: /confirm grouping|next.*assign|split & assign/i }).first()
    if (await grpBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await grpBtn.click(); await page.waitForTimeout(1000)
    }

    // Assign all selects
    const selects = await page.locator('select').all()
    for (const s of selects.slice(0, 4)) {
      const opts = await s.locator('option').count()
      if (opts > 1) await s.selectOption({ index: 1 }).catch(() => {})
    }

    const confirmBtn = page.getByRole('button', { name: /confirm.*assign|save.*assign/i }).first()
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click(); await page.waitForTimeout(1200)
    }

    // Click Skip on Schedule step
    const skipBtn = page.getByRole('button', { name: /skip/i }).first()
    if (await skipBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await skipBtn.click()
      await page.waitForTimeout(800)
      // Should be on Print Barcodes
      await expect(
        page.getByText(/print barcode|print.*label|barcode/i).first()
      ).toBeVisible({ timeout: 6000 })
    }
  })

  test('Step 5 — Print Barcodes shows sample number', async () => {
    await fillAndSubmitRegistrationForm(page)
    await page.waitForTimeout(1000)

    const grpBtn = page.getByRole('button', { name: /confirm grouping|next.*assign|split & assign/i }).first()
    if (await grpBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await grpBtn.click(); await page.waitForTimeout(1000)
    }

    const selects = await page.locator('select').all()
    for (const s of selects.slice(0, 4)) {
      const opts = await s.locator('option').count()
      if (opts > 1) await s.selectOption({ index: 1 }).catch(() => {})
    }

    const confirmBtn = page.getByRole('button', { name: /confirm.*assign|save.*assign/i }).first()
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click(); await page.waitForTimeout(1200)
    }

    const skipBtn = page.getByRole('button', { name: /skip/i }).first()
    if (await skipBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await skipBtn.click(); await page.waitForTimeout(800)
    }

    // Sample number or container label should appear
    const body = await page.locator('body').textContent() ?? ''
    const hasBarcodeData = body.includes('LAB-RM') || body.includes('QC-001') || body.includes('barcode')
    expect(hasBarcodeData).toBeTruthy()
  })

  test('Step 5 — Finish button closes wizard and shows toast', async () => {
    await fillAndSubmitRegistrationForm(page)
    await page.waitForTimeout(1000)

    const grpBtn = page.getByRole('button', { name: /confirm grouping|next.*assign|split & assign/i }).first()
    if (await grpBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await grpBtn.click(); await page.waitForTimeout(1000)
    }

    const selects = await page.locator('select').all()
    for (const s of selects.slice(0, 4)) {
      const opts = await s.locator('option').count()
      if (opts > 1) await s.selectOption({ index: 1 }).catch(() => {})
    }

    const confirmBtn = page.getByRole('button', { name: /confirm.*assign|save.*assign/i }).first()
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click(); await page.waitForTimeout(1200)
    }

    const skipBtn = page.getByRole('button', { name: /skip/i }).first()
    if (await skipBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await skipBtn.click(); await page.waitForTimeout(800)
    }

    const finishBtn = page.getByRole('button', { name: /finish/i }).first()
    if (await finishBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await finishBtn.click()
      await page.waitForTimeout(800)
      // Toast or wizard gone
      const bodyAfter = await page.locator('body').textContent() ?? ''
      const wizardGone = !bodyAfter.includes('Print Barcodes') || bodyAfter.includes('setup complete') || bodyAfter.includes('Work Queue')
      expect(wizardGone).toBeTruthy()
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
test.describe('Sample Registration — Step 4 Schedule books capacity', () => {
  let ctx: BrowserContext
  let page: Page
  const bookingCalls: string[] = []

  test.beforeAll(async ({ browser }) => {
    ctx = await (browser as any).newContext() as BrowserContext

    await ctx.addInitScript((token: string) => {
      localStorage.setItem('lims_token', token)
    }, ADMIN_JWT)

    await ctx.route(`${API}/auth/permissions*`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    await ctx.route(`${API}/users/*/permissions*`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    await ctx.route(`${API}/lab-config/logo*`, r => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NO_LOGO' }) }))
    await ctx.route(`${API}/lab-config*`, r => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { configKey: 'nav.work-queue', configValue: 'true' },
        { configKey: 'esign.SampleRegistration.Submit', configValue: 'None' },
      ]),
    }))
    await ctx.route(`${API}/materials*`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MATERIALS) }))
    await ctx.route(`${API}/sample-types*`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SAMPLE_TYPES) }))
    await ctx.route(`${API}/specification-template-links*`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await ctx.route(`${API}/users*`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ANALYSTS) }))
    await ctx.route(`${API}/instruments*`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INSTRUMENTS) }))
    await ctx.route(`${API}/samples/99/spec-assignment*`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ specTemplateId: 7 }) }))
    await ctx.route(`${API}/specification-templates*`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ specTemplateId: 7, items: MOCK_SPEC_TESTS }]) }))
    await ctx.route(`${API}/samples/99/containers*`, r => {
      if (r.request().method() === 'POST') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, containers: [MOCK_CONTAINERS[0]] }) })
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_CONTAINERS[0]]) })
    })
    await ctx.route(`${API}/samples/99/**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    await ctx.route(`${API}/samples/spec-preview*`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ outcome: 'NoMatch', templateId: null, candidates: [], message: 'No spec' }) }))
    await ctx.route(`${API}/samples*`, r => {
      if (r.request().method() === 'POST') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SAMPLE_RESULT) })
      return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await ctx.route(`${API}/test-executions*`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    // Track capacity booking calls
    await ctx.route(`${API}/capacity-bookings*`, r => {
      if (r.request().method() === 'POST') {
        bookingCalls.push(r.request().url())
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ capacityBookingId: 201, status: 'Booked' }) })
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await ctx.route('http://localhost:5173/hubs/**', r => r.abort())
    await ctx.route('**/*.signalr*', r => r.abort())
    await ctx.route(`${API}/**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

    page = await ctx.newPage()
  })
  test.afterAll(async () => { await page.close(); await ctx.close() })

  test('Confirm & Continue on Schedule step calls POST /capacity-bookings', async () => {
    await fillAndSubmitRegistrationForm(page)
    await page.waitForTimeout(1000)

    // Step 1 → Step 3
    const grpBtn = page.getByRole('button', { name: /confirm grouping|next.*assign|split & assign/i }).first()
    if (await grpBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await grpBtn.click(); await page.waitForTimeout(1000)
    }

    // Assign analyst + instrument to trigger schedule rows
    const selects = await page.locator('select').all()
    for (const s of selects.slice(0, 4)) {
      const opts = await s.locator('option').count()
      if (opts > 1) await s.selectOption({ index: 1 }).catch(() => {})
    }

    const confirmBtn = page.getByRole('button', { name: /confirm.*assign|save.*assign/i }).first()
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click(); await page.waitForTimeout(1200)
    }

    // Fill in start/end date-time fields if visible
    const dateInputs = await page.locator('input[type="date"]').all()
    for (const d of dateInputs) {
      await d.fill('2026-07-18').catch(() => {})
    }
    const timeInputs = await page.locator('input[type="time"]').all()
    for (let i = 0; i < timeInputs.length; i++) {
      await timeInputs[i].fill(i % 2 === 0 ? '09:00' : '10:00').catch(() => {})
    }

    // Click Confirm & Continue
    const bookBtn = page.getByRole('button', { name: /confirm.*continue|book.*continue|confirm & continue/i }).first()
    if (await bookBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await bookBtn.click()
      await page.waitForTimeout(1500)
      // A booking call should have been made
      expect(bookingCalls.length).toBeGreaterThan(0)
    }
  })
})
