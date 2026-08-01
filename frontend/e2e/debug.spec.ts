import { test, expect } from '@playwright/test'
import { setupAuthContext, navigateTo } from './helpers'

test('debug — dump CoA review page content', async ({ browser }) => {
  const ctx = await browser.newContext()
  const API = 'http://localhost:5173/api'
  await setupAuthContext(ctx, async (c) => {
    await c.route(`${API}/coas*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await c.route(`${API}/test-executions*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  })
  const page = await ctx.newPage()

  page.on('console', msg => console.log('[browser]', msg.type(), msg.text()))
  page.on('pageerror', err => console.log('[page-error]', err.message))

  await navigateTo(page, '/coa-review')
  await page.waitForTimeout(2000)

  const url = page.url()
  const bodyText = await page.locator('body').innerText()
  const buttons = await page.locator('button').allTextContents()

  console.log('URL:', url)
  console.log('Buttons:', JSON.stringify(buttons))
  console.log('Body (first 1000):', bodyText.slice(0, 1000))

  await page.close()
  await ctx.close()
})

test('debug — dump Work Queue page content', async ({ browser }) => {
  const ctx = await browser.newContext()
  const API = 'http://localhost:5173/api'
  await setupAuthContext(ctx, async (c) => {
    await c.route(`${API}/test-executions*`, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([
          { executionId: 1, sampleId: 1, sampleNumber: 'SL-001',
            materialName: 'Paracetamol API', materialId: 1, lotNumber: 'LOT-001',
            analystName: 'Dr. Priya Nair', instrumentCode: 'HPLC-001',
            status: 'Assigned', testLabel: 'HPLC Assay',
            containerId: 10, containerLabel: 'ALQ-001' },
        ]),
      }))
  })
  const page = await ctx.newPage()

  page.on('console', msg => console.log('[browser]', msg.type(), msg.text()))
  page.on('pageerror', err => console.log('[page-error]', err.message))

  await navigateTo(page, '/work-queue')
  await page.waitForTimeout(2000)

  const url = page.url()
  const bodyText = await page.locator('body').innerText()
  const buttons = await page.locator('button').allTextContents()

  console.log('WQ URL:', url)
  console.log('WQ Buttons:', JSON.stringify(buttons.slice(0, 10)))
  console.log('WQ Body (first 1500):', bodyText.slice(0, 1500))

  await page.close()
  await ctx.close()
})
