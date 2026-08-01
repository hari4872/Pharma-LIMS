import { test, expect, Page } from '@playwright/test'
import { setupAuthContext, navigateTo } from './helpers'

// WorkQueuePage calls GET /test-executions (no /work-queue endpoint)
const MOCK_WORK_ITEMS = [
  { executionId: 1, sampleId: 1, sampleNumber: 'SL-001',
    materialName: 'Paracetamol API', materialId: 1, lotNumber: 'LOT-001',
    analystName: 'Dr. Priya Nair', instrumentCode: 'HPLC-001',
    status: 'Assigned', priorityScore: 1,
    startedAt: null, completedAt: null, dueDate: null, createdAt: '2026-06-01T08:00:00Z',
    testLabel: 'HPLC Assay',
    containerId: 10, containerLabel: 'ALQ-001', containerType: 'Aliquot', containerStatus: 'Available' },
  { executionId: 2, sampleId: 1, sampleNumber: 'SL-001',
    materialName: 'Paracetamol API', materialId: 1, lotNumber: 'LOT-001',
    analystName: 'Mr. Rajan Mehta', instrumentCode: null,
    status: 'Assigned', priorityScore: 1,
    startedAt: null, completedAt: null, dueDate: null, createdAt: '2026-06-01T08:00:00Z',
    testLabel: 'Dissolution at 45 min',
    containerId: 10, containerLabel: 'ALQ-001', containerType: 'Aliquot', containerStatus: 'Available' },
  { executionId: 3, sampleId: 2, sampleNumber: 'SL-002',
    materialName: 'Ibuprofen API', materialId: 2, lotNumber: 'LOT-002',
    analystName: null, instrumentCode: null,
    status: 'Pending', priorityScore: 2,
    startedAt: null, completedAt: null, dueDate: null, createdAt: '2026-06-02T08:00:00Z',
    testLabel: 'pH Test',
    containerId: null, containerLabel: null, containerType: null, containerStatus: null },
]

const MOCK_EXECUTION_DETAIL = {
  executionId: 1, sampleId: 1, sampleNumber: 'SL-001',
  materialName: 'Paracetamol API', materialId: 1, lotNumber: 'LOT-001',
  analystName: 'Dr. Priya Nair', analystId: 2,
  instrumentCode: 'HPLC-001', instrumentId: 5,
  status: 'Assigned', priorityScore: 1,
  startedAt: null, completedAt: null, dueDate: null, createdAt: '2026-06-01T08:00:00Z',
  testLabel: 'HPLC Assay',
  containerId: 10, containerLabel: 'ALQ-001', containerType: 'Aliquot',
  formTemplateId: null, formEntries: [], specTemplateItems: [], logbookEntries: [],
}

// ── Work Queue ────────────────────────────────────────────────────────────────

test.describe('Work Queue — Real Test Labels', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    const API = 'http://localhost:5173/api'
    await setupAuthContext(ctx, async (c) => {
      // WorkQueuePage calls GET /api/test-executions
      await c.route(`${API}/test-executions*`, route => {
        const url = route.request().url()
        if (/test-executions\/\d+/.test(url) || /test-executions\/[a-z]/.test(url)) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        }
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify(MOCK_WORK_ITEMS),
        })
      })
    })
    page = await ctx.newPage()
  })

  test.afterAll(async () => { await page.close() })

  test('work queue page loads and renders sample groups', async () => {
    await navigateTo(page, '/work-queue')
    // Either a table or card-list is present (work queue may not use <table>)
    await expect(
      page.locator('table').or(page.getByText('SL-001')).or(page.getByText('Paracetamol'))
    ).toBeVisible({ timeout: 12000 })
  })

  test('no element shows bare "Test 1" or "Test 2"', async () => {
    await navigateTo(page, '/work-queue')
    await page.waitForTimeout(1500)
    const allTexts = await page.locator('body').allTextContents()
    const combined = allTexts.join(' ')
    // Should not contain "Test 1" or "Test 2" as isolated labels
    expect(combined).not.toMatch(/\bTest 1\b/)
    expect(combined).not.toMatch(/\bTest 2\b/)
  })

  test('real test labels are visible — "HPLC Assay" present on the page', async () => {
    await navigateTo(page, '/work-queue')
    await page.waitForTimeout(1500)

    // HPLC Assay should appear somewhere in the work queue (expanded or collapsed)
    await expect(page.getByText('HPLC Assay').first()).toBeVisible({ timeout: 8000 })
  })
})

// ── Test Execution Page — instrument display ──────────────────────────────────

test.describe('Test Execution Page — Instrument Header', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    const API = 'http://localhost:5173/api'
    await setupAuthContext(ctx, async (c) => {
      // Sub-paths must be registered BEFORE the parent to take priority
      await c.route(`${API}/test-executions/1/**`, route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      )
      await c.route(`${API}/test-executions/1`, route =>
        route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify(MOCK_EXECUTION_DETAIL) })
      )
      await c.route(`${API}/digital-logbook*`, route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      )
      await c.route(`${API}/instruments*`, route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      )
      await c.route(`${API}/spec-limits*`, route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      )
    })
    page = await ctx.newPage()
  })

  test.afterAll(async () => { await page.close() })

  test('execution page renders without error boundary', async () => {
    await navigateTo(page, '/test-execution/1')
    await page.waitForTimeout(2000)
    await expect(page.getByText('Something went wrong')).not.toBeVisible()
  })

  test('"🔬 Instrument: HPLC-001" appears in execution header', async () => {
    await navigateTo(page, '/test-execution/1')
    await page.waitForTimeout(2000)
    // Instrument label is shown conditionally when execution.instrumentCode is set
    await expect(page.getByText(/HPLC-001/)).toBeVisible({ timeout: 6000 })
  })
})
