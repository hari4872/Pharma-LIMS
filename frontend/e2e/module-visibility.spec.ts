/**
 * e2e tests for the Module Visibility rework:
 *  - Module Visibility panel removed from Admin Settings
 *  - E-Sign Config + Workflow Steps remain in Admin Settings → System Config tab
 *  - SuperAdmin per-role locks are applied by GET /nav-visibility at login
 *  - Direct URL access to a locked module redirects to /dashboard
 */
import { test, expect, BrowserContext } from '@playwright/test'
import { navigateTo } from './helpers'

const API = 'http://localhost:5173/api/v1'

// Build a fake (unsigned) JWT the frontend can decode for role extraction
function fakeJwt(payload: object): string {
  const enc = (s: string) => Buffer.from(s).toString('base64url')
  return [
    enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    enc(JSON.stringify(payload)),
    'fake-sig',
  ].join('.')
}

const ADMIN_JWT = fakeJwt({
  sub: '1', name: 'System Administrator', role: 'Admin',
  userType: 'Admin', labId: '1', labName: 'Apex Pharma', exp: 9999999999,
})
const ANALYST_JWT = fakeJwt({
  sub: '3', name: 'Test Analyst', role: 'Analyst',
  userType: 'Analyst', labId: '1', labName: 'Apex Pharma', exp: 9999999999,
})

const ESIGN_MOCK = [
  { actionKey: 'BatchRelease.Approve',   method: 'PasswordAndSignature', roles: ['Admin'] },
  { actionKey: 'TestExecution.SignOff',   method: 'PasswordOnly',         roles: ['Analyst'] },
  { actionKey: 'SampleRegistration.Submit', method: 'None',               roles: [] },
]

async function setupAs(context: BrowserContext, jwt: string, navMap: Record<string, boolean> = {}) {
  await context.addInitScript((token) => {
    localStorage.setItem('lims_token', token)
  }, jwt)

  // context.route is LIFO — last registered = highest priority.
  // Register catch-all FIRST so specific mocks registered after it win.

  // ① Catch-all (lowest priority — registered first)
  await context.route(`${API}/**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await context.route('http://localhost:5173/hubs/**', r => r.abort())
  await context.route('**/*.signalr*', r => r.abort())

  // ② Specific mocks (higher priority — registered after catch-all)
  await context.route(`${API}/lab-config*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await context.route(`${API}/lab-config/logo*`, r =>
    r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"NO_LOGO"}' }))
  await context.route(`${API}/admin/esign-config*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ESIGN_MOCK) }))
  await context.route(`${API}/nav-visibility*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(navMap) }))
  await context.route(`${API}/users/*/permissions*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await context.route(`${API}/auth/permissions*`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Settings — tab structure
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Admin Settings — System Config tab', () => {

  test('Admin sees System Config tab in Settings', async ({ context, page }) => {
    await setupAs(context, ADMIN_JWT)
    await navigateTo(page, '/settings')
    await expect(page.getByRole('button', { name: /system config/i })).toBeVisible()
  })

  test('System Config has E-Sign Config and Workflow Steps subtabs', async ({ context, page }) => {
    await setupAs(context, ADMIN_JWT)
    await navigateTo(page, '/settings')
    await page.getByRole('button', { name: /system config/i }).click()
    await expect(page.getByRole('button', { name: /e-sign config/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /workflow steps/i })).toBeVisible()
  })

  test('Module Visibility panel is NOT in Admin Settings', async ({ context, page }) => {
    await setupAs(context, ADMIN_JWT)
    await navigateTo(page, '/settings')
    // The old NavVisibilityPanel subtab label was "Module Visibility" — must be gone
    const btn = page.getByRole('button', { name: /^module visibility$/i })
    await expect(btn).toHaveCount(0)
  })

  test('E-Sign Config subtab renders action rows from API', async ({ context, page }) => {
    await setupAs(context, ADMIN_JWT)
    await navigateTo(page, '/settings')
    await page.getByRole('button', { name: /system config/i }).click()
    await page.getByRole('button', { name: /e-sign config/i }).click()
    await page.waitForTimeout(600)
    // ESignConfigPanel renders label "Batch Release" (not the raw key "BatchRelease.Approve")
    await expect(page.getByText(/Batch Release/i).first()).toBeVisible()
  })

  test('Analyst does NOT see System Config tab', async ({ context, page }) => {
    await setupAs(context, ANALYST_JWT)
    await navigateTo(page, '/settings')
    // adminOnly: true — only Admin sees this group
    await expect(page.getByRole('button', { name: /system config/i })).toHaveCount(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SuperAdmin lock enforcement — sidebar + route guard
// ─────────────────────────────────────────────────────────────────────────────
test.describe('SuperAdmin module lock enforcement', () => {

  test('Locked module (nav.samples=false) is hidden from Analyst sidebar', async ({ context, page }) => {
    await setupAs(context, ANALYST_JWT, { 'nav.samples': false })
    await navigateTo(page, '/dashboard')
    // Sample Registration link should not appear in the sidebar
    await expect(page.getByRole('link', { name: /sample registration/i })).not.toBeVisible()
  })

  test('All modules visible when nav map is empty (default ON)', async ({ context, page }) => {
    await setupAs(context, ANALYST_JWT, {})  // empty map = all enabled
    await navigateTo(page, '/dashboard')
    await expect(page.getByRole('link', { name: /sample registration/i })).toBeVisible()
  })

  test('Direct URL to locked module redirects to /dashboard', async ({ context, page }) => {
    await setupAs(context, ANALYST_JWT, { 'nav.samples': false })
    await navigateTo(page, '/samples')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('Non-locked module remains accessible when only one module is locked', async ({ context, page }) => {
    // Only samples is locked — work-queue should still be accessible
    await setupAs(context, ANALYST_JWT, { 'nav.samples': false })
    await navigateTo(page, '/work-queue')
    await expect(page).not.toHaveURL(/\/dashboard/)
  })

  test('Admin can still access all modules even when lock is set for Analyst', async ({ context, page }) => {
    // Admin JWT — nav map has nav.samples=false locked for Analyst, but Admin token
    // The backend applies locks per-role; for Admin the GET would return the base map
    // Simulate: no lock for Admin (nav map is empty for Admin)
    await setupAs(context, ADMIN_JWT, {})
    await navigateTo(page, '/samples')
    await expect(page).not.toHaveURL(/\/dashboard/)
  })
})
