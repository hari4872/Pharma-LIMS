import { test, expect, Page } from '@playwright/test'
import { setupAuthContext, navigateTo } from './helpers'

test.describe('CoA Review Page', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    const API = 'http://localhost:5173/api'
    await setupAuthContext(ctx, async (c) => {
      // CoA list
      await c.route(`${API}/coas*`, route => {
        if (route.request().method() !== 'GET') return route.continue()
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([
            { coaId: 1, coaNumber: 'COA-2026-001', sampleId: 1,
              sampleNumber: 'SL-001', materialName: 'Paracetamol API',
              lotNumber: 'LOT-001', status: 'Released', createdAt: '2026-06-01T00:00:00Z',
              lockedAt: '2026-06-01T10:00:00Z', customerName: 'Apex Pharma',
              doNumber: 'DO-001', despatchDate: '2026-06-01',
              qaSignedBy: 'qa_officer', qaSignedAt: '2026-06-01T10:00:00Z',
              lines: [], approvals: [] },
          ]),
        })
      })
      // QCVerified executions for Generate CoA
      await c.route(`${API}/test-executions*`, route => {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([
            { executionId: 10, sampleId: 2, sampleNumber: 'SL-002',
              materialName: 'Ibuprofen API', lotNumber: 'LOT-002',
              status: 'QCVerified', containerId: null, containerLabel: null },
          ]),
        })
      })
    })
    page = await ctx.newPage()
  })

  test.afterAll(async () => { await page.close() })

  // ── Toolbar ──────────────────────────────────────────────────────────────

  test('page loads with 🖼 Logo and Generate CoA buttons', async () => {
    await navigateTo(page, '/coa-review')
    await expect(page.getByRole('button', { name: /logo/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /generate coa/i })).toBeVisible()
  })

  // ── Logo Settings Drawer ─────────────────────────────────────────────────

  test('Logo button opens "CoA Logo Settings" drawer', async () => {
    await navigateTo(page, '/coa-review')
    await page.getByRole('button', { name: /logo/i }).click()
    // Drawer title
    await expect(page.getByText('CoA Logo Settings')).toBeVisible({ timeout: 5000 })
    // Drop zone present
    await expect(page.getByText('Drag & drop your logo here')).toBeVisible({ timeout: 3000 })
  })

  test('Logo drawer rejects non-image file (client-side MIME check)', async () => {
    await navigateTo(page, '/coa-review')
    await page.getByRole('button', { name: /logo/i }).click()
    await expect(page.getByText('CoA Logo Settings')).toBeVisible({ timeout: 5000 })

    // Use the static hidden input (data-testid="logo-file-input")
    await page.locator('[data-testid="logo-file-input"]').setInputFiles({
      name: 'report.txt', mimeType: 'text/plain', buffer: Buffer.from('hello'),
    })

    await expect(page.getByText(/only image|image files/i)).toBeVisible({ timeout: 3000 })
  })

  test('Logo drawer rejects file > 2 MB (client-side size check)', async () => {
    await navigateTo(page, '/coa-review')
    await page.getByRole('button', { name: /logo/i }).click()
    await expect(page.getByText('CoA Logo Settings')).toBeVisible({ timeout: 5000 })

    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    const bigBuffer = Buffer.concat([pngHeader, Buffer.alloc(3 * 1024 * 1024)])

    await page.locator('[data-testid="logo-file-input"]').setInputFiles({
      name: 'huge.png', mimeType: 'image/png', buffer: bigBuffer,
    })

    await expect(page.getByText(/2 mb|too large|exceeds/i)).toBeVisible({ timeout: 3000 })
  })

  test('Logo drawer accepts valid PNG and shows "New Logo — Preview"', async () => {
    await navigateTo(page, '/coa-review')
    await page.getByRole('button', { name: /logo/i }).click()
    await expect(page.getByText('CoA Logo Settings')).toBeVisible({ timeout: 5000 })

    // Minimal valid 1×1 PNG
    const validPng = Buffer.from([
      0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,
      0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
      0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
      0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
      0xDE,0x00,0x00,0x00,0x0C,0x49,0x44,0x41,
      0x54,0x08,0xD7,0x63,0xF8,0xCF,0xC0,0x00,
      0x00,0x00,0x02,0x00,0x01,0xE2,0x21,0xBC,
      0x33,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,
      0x44,0xAE,0x42,0x60,0x82,
    ])

    await page.locator('[data-testid="logo-file-input"]').setInputFiles({
      name: 'logo.png', mimeType: 'image/png', buffer: validPng,
    })

    // "New Logo — Preview" section appears
    await expect(page.getByText(/new logo.*preview/i)).toBeVisible({ timeout: 3000 })
    // Preview image rendered
    await expect(page.locator('img[alt="New logo preview"]')).toBeVisible({ timeout: 3000 })
    // No error shown
    await expect(page.getByText(/only image|too large|exceeds/i)).not.toBeVisible()
  })

  test('Logo drawer Cancel button dismisses the drawer', async () => {
    await navigateTo(page, '/coa-review')
    await page.getByRole('button', { name: /logo/i }).click()
    await expect(page.getByText('CoA Logo Settings')).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByText('CoA Logo Settings')).not.toBeVisible({ timeout: 3000 })
  })

  // ── Generate CoA Drawer ──────────────────────────────────────────────────

  test('Generate CoA drawer opens and shows "Select Sample" (not "Select Execution")', async () => {
    await navigateTo(page, '/coa-review')
    await page.getByRole('button', { name: /generate coa/i }).click()

    // Title: "Generate Certificate of Analysis"
    await expect(page.getByText('Generate Certificate of Analysis')).toBeVisible({ timeout: 6000 })
    // Label is "Select Sample" — confirms sample-level redesign
    await expect(page.getByText(/select sample/i)).toBeVisible({ timeout: 3000 })
    // Must NOT show old "Select Execution" label
    await expect(page.getByText(/select execution/i)).not.toBeVisible()
  })
})
