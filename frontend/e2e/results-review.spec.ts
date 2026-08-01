import { test, expect, Page } from '@playwright/test'
import { setupAuthContext, navigateTo } from './helpers'

const MOCK_EXECUTIONS = [
  { executionId: 1, sampleId: 1, sampleNumber: 'SL-001',
    materialName: 'Paracetamol API', lotNumber: 'LOT-001',
    status: 'Completed', analystName: 'Dr. Priya Nair',
    containerId: 10, containerLabel: 'ALQ-001', containerType: 'Aliquot',
    testLabel: 'HPLC Assay', passFailStatus: 'Pass', assignedAt: '2026-06-01T08:00:00Z' },
  { executionId: 2, sampleId: 1, sampleNumber: 'SL-001',
    materialName: 'Paracetamol API', lotNumber: 'LOT-001',
    status: 'Completed', analystName: 'Dr. Priya Nair',
    containerId: 11, containerLabel: 'ALQ-002', containerType: 'Aliquot',
    testLabel: 'Dissolution', passFailStatus: 'Pass', assignedAt: '2026-06-01T09:00:00Z' },
  { executionId: 3, sampleId: 2, sampleNumber: 'SL-002',
    materialName: 'Ibuprofen API', lotNumber: 'LOT-002',
    status: 'InProgress', analystName: 'Mr. Rajan Mehta',
    containerId: null, containerLabel: null, containerType: null,
    testLabel: 'pH Test', passFailStatus: null, assignedAt: '2026-06-02T08:00:00Z' },
]

test.describe('Results Review — Container Sub-Grouping', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    const API = 'http://localhost:5173/api'
    await setupAuthContext(ctx, async (c) => {
      // ResultsReviewPage calls GET /api/test-executions
      await c.route(`${API}/test-executions*`, route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify(MOCK_EXECUTIONS),
        })
      )
    })
    page = await ctx.newPage()
  })

  test.afterAll(async () => { await page.close() })

  test('page loads and renders a table', async () => {
    await navigateTo(page, '/results-review')
    await expect(page.locator('table')).toBeVisible({ timeout: 12000 })
  })

  test('table header has at least 4 columns (expand + data cols)', async () => {
    await navigateTo(page, '/results-review')
    await page.locator('table').waitFor({ timeout: 10000 })
    const count = await page.locator('thead th').count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('sample rows show "X containers" sub-label', async () => {
    await navigateTo(page, '/results-review')
    await page.locator('table').waitFor({ timeout: 10000 })
    await page.waitForTimeout(500)
    // SL-001 has 2 containers
    await expect(page.locator('text=/\\d+ container/i').first()).toBeVisible({ timeout: 5000 })
  })

  test('expanding a sample row reveals container sub-rows', async () => {
    await navigateTo(page, '/results-review')
    await page.locator('table').waitFor({ timeout: 10000 })
    await page.waitForTimeout(500)

    // Click expand trigger on first sample row
    const expandBtn = page.locator('tbody tr').first().locator('button, td').first()
    await expandBtn.click()
    await page.waitForTimeout(500)

    // Aliquot badge or container label should appear
    await expect(
      page.locator('text=/Aliquot|ALQ-00/i').first()
    ).toBeVisible({ timeout: 4000 })
  })

  test('test names are visible inside expanded container rows', async () => {
    await navigateTo(page, '/results-review')
    await page.locator('table').waitFor({ timeout: 10000 })
    await page.waitForTimeout(500)

    const expandBtn = page.locator('tbody tr').first().locator('button, td').first()
    await expandBtn.click()
    await page.waitForTimeout(500)

    await expect(page.getByText(/HPLC Assay/i).first()).toBeVisible({ timeout: 4000 })
  })
})
