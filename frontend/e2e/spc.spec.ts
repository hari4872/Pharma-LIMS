import { test, expect } from '@playwright/test'
import { BASE, setupAuthContext } from './helpers'

const API = 'http://localhost:5173/api/v1'

const PARAMS_MOCK = [
  { parameterId: 26, parameterName: 'HS without N₂ @ 2 hrs', uom: 'APHA' },
]

const SPC_MOCK_20 = {
  parameterId: 26,
  parameterName: 'HS without N₂ @ 2 hrs',
  unit: 'APHA',
  n: 20,
  mean: 35.51,
  stddev: 0.622,
  ucl: 37.376,
  lcl: 33.644,
  usl: 45.0,
  lsl: 25.0,
  cp: 5.376,
  cpk: 2.41,
  outOfControl: true,
  rules: ['Rule 3: 6+ consecutive points in a monotonic trend'],
  points: [
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-04-05T00:00:00Z', value: 34.9, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-04-12T00:00:00Z', value: 35.2, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-04-19T00:00:00Z', value: 35.6, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-04-26T00:00:00Z', value: 35.1, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-05-03T00:00:00Z', value: 35.4, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-05-10T00:00:00Z', value: 35.8, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-05-17T00:00:00Z', value: 35.3, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-05-24T00:00:00Z', value: 35.5, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-05-31T00:00:00Z', value: 35.2, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-06-07T00:00:00Z', value: 35.7, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-06-14T00:00:00Z', value: 35.4, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-06-21T00:00:00Z', value: 35.1, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-06-28T00:00:00Z', value: 35.3, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0002', measuredAt: '2026-07-02T00:00:00Z', value: 35.0, isOos: false, isOot: false },
    // Upward trend starts — Nelson Rule 3 fires on these 6 consecutive increasing points
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0005', measuredAt: '2026-07-05T00:00:00Z', value: 35.6, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0005', measuredAt: '2026-07-08T00:00:00Z', value: 35.9, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0005', measuredAt: '2026-07-10T00:00:00Z', value: 36.3, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0005', measuredAt: '2026-07-11T00:00:00Z', value: 36.7, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0005', measuredAt: '2026-07-12T00:00:00Z', value: 37.1, isOos: false, isOot: false },
    { executionId: 149, sampleNumber: 'LAB-ST-S-20260702-0005', measuredAt: '2026-07-14T00:00:00Z', value: 37.4, isOos: false, isOot: false },
  ],
}

const SPC_MOCK_2 = {
  ...SPC_MOCK_20,
  n: 2, outOfControl: false, rules: [],
  points: SPC_MOCK_20.points.slice(-2),
}

test.describe('SPC / QC Charts', () => {

  test('SPC page loads with parameter dropdown and Calculate button', async ({ context, page }) => {
    await setupAuthContext(context)
    await context.route(`${API}/spc/**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPC_MOCK_2) })
    )
    await context.route(`${API}/parameters*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PARAMS_MOCK) })
    )
    await page.goto(`${BASE}/spc`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)

    await expect(page.locator('select').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /calculate/i })).toBeVisible()
    await expect(page.getByText(/X̄ Control Chart/i).first()).toBeVisible()
  })

  test('Selecting parameter and calculating shows KPI cards', async ({ context, page }) => {
    await setupAuthContext(context)
    await context.route(`${API}/spc/**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPC_MOCK_20) })
    )
    await context.route(`${API}/parameters*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PARAMS_MOCK) })
    )
    await page.goto(`${BASE}/spc`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)

    // Select parameter 26
    await page.locator('select').first().selectOption('26')
    await page.waitForTimeout(200)

    // Set data points to 20 (first option)
    const dpSelect = page.locator('select').nth(1)
    await dpSelect.selectOption('20')

    // Click Calculate
    await page.getByRole('button', { name: /calculate/i }).click()
    await page.waitForTimeout(800)

    // KPI cards should appear
    await expect(page.getByText('N (Points)')).toBeVisible()
    await expect(page.getByText(/Last 20 measurements/)).toBeVisible()
    await expect(page.getByText('Mean (X̄)')).toBeVisible()
    await expect(page.getByText('35.51', { exact: true }).first()).toBeVisible()
  })

  test('Nelson Rule 3 violation banner appears for trend data', async ({ context, page }) => {
    await setupAuthContext(context)
    await context.route(`${API}/spc/**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPC_MOCK_20) })
    )
    await context.route(`${API}/parameters*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PARAMS_MOCK) })
    )
    await page.goto(`${BASE}/spc`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)

    await page.locator('select').first().selectOption('26')
    await page.getByRole('button', { name: /calculate/i }).click()
    await page.waitForTimeout(800)

    // OOC banner
    await expect(page.getByText(/Process Out of Control/i)).toBeVisible()
    await expect(page.getByText(/Rule 3/i)).toBeVisible()
    await expect(page.getByText(/monotonic trend/i)).toBeVisible()
  })

  test('Cp and Cpk show Capable when spec limits configured', async ({ context, page }) => {
    await setupAuthContext(context)
    await context.route(`${API}/spc/**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPC_MOCK_20) })
    )
    await context.route(`${API}/parameters*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PARAMS_MOCK) })
    )
    await page.goto(`${BASE}/spc`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)

    await page.locator('select').first().selectOption('26')
    await page.getByRole('button', { name: /calculate/i }).click()
    await page.waitForTimeout(800)

    await expect(page.getByText('5.376')).toBeVisible()   // Cp
    await expect(page.getByText('2.41')).toBeVisible()    // Cpk
    const capable = page.getByText('Capable')
    await expect(capable.first()).toBeVisible()
  })

  test('Raw data table shows 20 rows', async ({ context, page }) => {
    await setupAuthContext(context)
    await context.route(`${API}/spc/**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPC_MOCK_20) })
    )
    await context.route(`${API}/parameters*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PARAMS_MOCK) })
    )
    await page.goto(`${BASE}/spc`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)

    await page.locator('select').first().selectOption('26')
    await page.getByRole('button', { name: /calculate/i }).click()
    await page.waitForTimeout(800)

    await expect(page.getByText(/Raw Data \(20 points\)/i)).toBeVisible()
    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(20)
  })

  test('Process In Control banner shows when no violations', async ({ context, page }) => {
    await setupAuthContext(context)
    await context.route(`${API}/spc/**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPC_MOCK_2) })
    )
    await context.route(`${API}/parameters*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PARAMS_MOCK) })
    )
    await page.goto(`${BASE}/spc`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)

    await page.locator('select').first().selectOption('26')
    await page.getByRole('button', { name: /calculate/i }).click()
    await page.waitForTimeout(800)

    await expect(page.getByText(/Process In Control/i)).toBeVisible()
    await expect(page.getByText(/No Nelson rule violations/i)).toBeVisible()
  })

})
