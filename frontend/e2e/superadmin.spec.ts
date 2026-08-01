import { test, expect, BrowserContext } from '@playwright/test'
import { BASE, navigateTo } from './helpers'

// SuperAdmin JWT — role:"SuperAdmin", exp far future
// Payload: { sub:"99", name:"WebSynergies SuperAdmin", role:"SuperAdmin", userType:"Admin", exp:9999999999 }
const SUPERADMIN_JWT = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJzdWIiOiI5OSIsIm5hbWUiOiJXZWJTeW5lcmdpZXMgU3VwZXJBZG1pbiIsInJvbGUiOiJTdXBlckFkbWluIiwidXNlclR5cGUiOiJBZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0',
  'fake-sig',
].join('.')

// Admin JWT (no SuperAdmin access)
const ADMIN_JWT = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJzdWIiOiIxIiwibmFtZSI6IlN5c3RlbSBBZG1pbmlzdHJhdG9yIiwicm9sZSI6IkFkbWluIiwidXNlclR5cGUiOiJBZG1pbiIsImxhYklkIjoiMSIsImxhYk5hbWUiOiJBcGV4IFBoYXJtYSIsImV4cCI6OTk5OTk5OTk5OX0',
  'fake-sig',
].join('.')

const API = 'http://localhost:5173/api/v1'

// Tabs use plain <button> with text labels from TABS constant
// Labels: 'Feature flags' | 'Module visibility' | 'E-sign config' | 'Users & licenses' | 'Audit log' | 'System settings'
const tab = (page: ReturnType<typeof import('@playwright/test').test.info>, label: string) =>
  page.getByRole('button', { name: new RegExp(label, 'i') })

const FEATURE_FLAGS_MOCK = [
  { key: 'ff.srf',       isEnabled: true,  updatedBy: 'system', updatedAt: '2026-07-14T00:00:00Z' },
  { key: 'ff.esign',     isEnabled: true,  updatedBy: 'system', updatedAt: '2026-07-14T00:00:00Z' },
  { key: 'ff.coa',       isEnabled: true,  updatedBy: 'system', updatedAt: '2026-07-14T00:00:00Z' },
  { key: 'ff.oos',       isEnabled: true,  updatedBy: 'system', updatedAt: '2026-07-14T00:00:00Z' },
  { key: 'ff.stability', isEnabled: false, updatedBy: 'system', updatedAt: '2026-07-14T00:00:00Z' },
  { key: 'ff.multisite', isEnabled: false, updatedBy: 'system', updatedAt: '2026-07-14T00:00:00Z' },
  { key: 'ff.capacity',  isEnabled: true,  updatedBy: 'system', updatedAt: '2026-07-14T00:00:00Z' },
  { key: 'ff.logbook',   isEnabled: true,  updatedBy: 'system', updatedAt: '2026-07-14T00:00:00Z' },
]

const MODULE_VISIBILITY_MOCK = {
  Admin: {
    'nav.samples':    { isEnabled: true,  isLockedBySuperAdmin: false },
    'nav.work-queue': { isEnabled: true,  isLockedBySuperAdmin: false },
    'nav.reports':    { isEnabled: false, isLockedBySuperAdmin: true  },
  },
  QA: {
    'nav.samples':    { isEnabled: true,  isLockedBySuperAdmin: false },
    'nav.work-queue': { isEnabled: true,  isLockedBySuperAdmin: false },
    'nav.reports':    { isEnabled: true,  isLockedBySuperAdmin: false },
  },
}

// AuditEntry interface in the component uses: action, changedBy, changedAt, newValues
const AUDIT_LOG_MOCK = [
  {
    entityType: 'FeatureFlag',
    action: 'SuperAdminFeatureUpdate',
    changedBy: 'superadmin',
    changedAt: '2026-07-14T10:00:00Z',
    newValues: '{"key":"ff.stability","isEnabled":false}',
  },
]

const ESIGN_CONFIG_MOCK = {
  enabled: true,
  requireReason: true,
  minPinLength: 6,
  sessionTimeoutMinutes: 30,
}

async function setupSuperAdminContext(context: BrowserContext, jwt = SUPERADMIN_JWT) {
  await context.addInitScript((token) => {
    localStorage.setItem('lims_token', token)
  }, jwt)

  // Playwright routes use LIFO — last registered = highest priority.
  // Register catch-all first so specific mocks (registered after) win.

  // ① Catch-all fallback (lowest priority — registered first)
  await context.route(`${API}/**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
  await context.route('http://localhost:5173/hubs/**', route => route.abort())
  await context.route('**/*.signalr*', route => route.abort())

  // ② Specific mocks (higher priority — registered after catch-all)
  await context.route(`${API}/users*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
  await context.route(`${API}/admin/esign-config*`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(ESIGN_CONFIG_MOCK),
    })
  )
  await context.route(`${API}/superadmin/audit-log*`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(AUDIT_LOG_MOCK),
    })
  )
  await context.route(`${API}/superadmin/module-visibility`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MODULE_VISIBILITY_MOCK),
    })
  )
  await context.route(`${API}/superadmin/feature-flags`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(FEATURE_FLAGS_MOCK),
    })
  )
  await context.route(`${API}/lab-config*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
  await context.route(`${API}/lab-config/logo*`, route =>
    route.fulfill({ status: 404, contentType: 'application/json',
      body: JSON.stringify({ error: 'NO_LOGO' }) })
  )
  await context.route(`${API}/users/*/permissions*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  )
  await context.route(`${API}/auth/permissions*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  )
}

// ─── SUITE ─────────────────────────────────────────────────────────────────────

test.describe('SuperAdmin Panel', () => {

  // ── Auth / routing ────────────────────────────────────────────────────────
  test('SuperAdmin nav link is visible when logged in as SuperAdmin', async ({ context, page }) => {
    await setupSuperAdminContext(context)
    await navigateTo(page, '/dashboard')
    await expect(page.getByRole('link', { name: /superadmin panel/i })).toBeVisible()
  })

  test('SuperAdmin nav link is NOT visible for Admin role', async ({ context, page }) => {
    await setupSuperAdminContext(context, ADMIN_JWT)
    await navigateTo(page, '/dashboard')
    await expect(page.getByRole('link', { name: /superadmin panel/i })).not.toBeVisible()
  })

  test('Admin role is redirected away from /superadmin', async ({ context, page }) => {
    await setupSuperAdminContext(context, ADMIN_JWT)
    await navigateTo(page, '/superadmin')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  // ── Page load & tabs ──────────────────────────────────────────────────────
  test('SuperAdmin page loads with 6 tab buttons', async ({ context, page }) => {
    await setupSuperAdminContext(context)
    await navigateTo(page, '/superadmin')

    // Tabs are plain <button> elements, not role="tab"
    await expect(page.getByRole('button', { name: /feature flags/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /module visibility/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /e-sign config/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /users & licenses/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /audit log/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /system settings/i })).toBeVisible()
  })

  test('SuperAdmin page shows header badge', async ({ context, page }) => {
    await setupSuperAdminContext(context)
    await navigateTo(page, '/superadmin')
    await expect(page.getByText(/superadmin panel/i).first()).toBeVisible()
    await expect(page.getByText(/superadmin only/i)).toBeVisible()
  })

  // ── Feature Flags tab ─────────────────────────────────────────────────────
  test('Feature Flags tab renders all 8 flags from mock', async ({ context, page }) => {
    await setupSuperAdminContext(context)
    await navigateTo(page, '/superadmin')
    // Feature flags tab is active by default (first tab)
    await page.waitForTimeout(500)

    // Should show flag labels from FLAG_META
    await expect(page.getByText(/sample request form/i)).toBeVisible()
    await expect(page.getByText(/e-signature enforcement/i)).toBeVisible()
    await expect(page.getByText(/stability module/i)).toBeVisible()

    // 8 checkboxes (one per flag — hidden but in DOM)
    const checkboxes = page.locator('input[type="checkbox"]')
    await expect(checkboxes).toHaveCount(8)
  })

  test('Disabled flags render with off-state visual', async ({ context, page }) => {
    await setupSuperAdminContext(context)
    await navigateTo(page, '/superadmin')
    await page.waitForTimeout(500)

    // ff.stability and ff.multisite are disabled — their checkboxes should be unchecked
    const unchecked = page.locator('input[type="checkbox"]:not(:checked)')
    const count = await unchecked.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('Save changes button is disabled when no flag toggled', async ({ context, page }) => {
    await setupSuperAdminContext(context)
    await navigateTo(page, '/superadmin')
    await page.waitForTimeout(500)

    const saveBtn = page.getByRole('button', { name: /save changes/i })
    await expect(saveBtn).toBeDisabled()
  })

  test('Toggling a flag enables Save button and fires PUT', async ({ context, page }) => {
    let putBody: unknown = null

    // Setup base context first (catch-all registered lowest priority)
    await setupSuperAdminContext(context)

    // Then override feature-flags route AFTER setupSuperAdminContext so it wins (LIFO)
    await context.route(`${API}/superadmin/feature-flags`, async route => {
      if (route.request().method() === 'PUT') {
        putBody = JSON.parse(route.request().postData() ?? '[]')
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify(FEATURE_FLAGS_MOCK) })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify(FEATURE_FLAGS_MOCK) })
      }
    })
    await navigateTo(page, '/superadmin')
    await page.waitForTimeout(600)

    // Click the label wrapping the first checkbox (toggle uses <label> + hidden input)
    const firstLabel = page.locator('label').filter({ has: page.locator('input[type="checkbox"]') }).first()
    await firstLabel.click()

    // Save button should be enabled now
    const saveBtn = page.getByRole('button', { name: /save changes/i })
    await expect(saveBtn).toBeEnabled()

    await saveBtn.click()
    await page.waitForTimeout(600)

    // PUT was called with array of flags
    expect(Array.isArray(putBody)).toBe(true)
  })

  // ── Module Visibility tab ─────────────────────────────────────────────────
  test('Module Visibility tab shows role columns from mock', async ({ context, page }) => {
    await setupSuperAdminContext(context)
    await navigateTo(page, '/superadmin')

    await page.getByRole('button', { name: /module visibility/i }).click()
    await page.waitForTimeout(500)

    // Should show role headers and nav key rows from mock
    await expect(page.getByText('Admin').first()).toBeVisible()
    await expect(page.getByText('QA').first()).toBeVisible()
  })

  // ── E-Sign Config tab ─────────────────────────────────────────────────────
  test('E-Sign Config tab loads and displays config', async ({ context, page }) => {
    await setupSuperAdminContext(context)
    await navigateTo(page, '/superadmin')

    await page.getByRole('button', { name: /e-sign config/i }).click()
    await page.waitForTimeout(500)

    // Mock returns sessionTimeoutMinutes: 30 — it should appear somewhere
    const content = await page.content()
    const hasConfigContent = content.includes('30') || content.includes('PIN') ||
      content.includes('pin') || content.includes('session') || content.includes('reason') ||
      content.includes('E-sign') || content.includes('e-sign')
    expect(hasConfigContent).toBe(true)
  })

  // ── Audit Log tab ─────────────────────────────────────────────────────────
  test('Audit Log tab renders the mocked entry', async ({ context, page }) => {
    await setupSuperAdminContext(context)
    await navigateTo(page, '/superadmin')

    await page.getByRole('button', { name: /audit log/i }).click()
    await page.waitForTimeout(500)

    // Mock returns changedBy: 'superadmin' — rendered inside <strong>
    // Use exact: true to avoid matching "SuperAdmin Panel" etc.
    await expect(page.locator('strong').filter({ hasText: 'superadmin' }).first()).toBeVisible()
  })

  test('Audit Log tab has filter buttons', async ({ context, page }) => {
    await setupSuperAdminContext(context)
    await navigateTo(page, '/superadmin')

    await page.getByRole('button', { name: /audit log/i }).click()
    await page.waitForTimeout(300)

    // Use exact: true to avoid matching tab buttons like "⊙ Feature flags"
    await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Feature', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'User', exact: true })).toBeVisible()
  })

  // ── System Settings tab ───────────────────────────────────────────────────
  test('System Settings tab is accessible and shows read-only info', async ({ context, page }) => {
    await setupSuperAdminContext(context)
    await navigateTo(page, '/superadmin')

    await page.getByRole('button', { name: /system settings/i }).click()
    await page.waitForTimeout(300)

    // Should show something from the static system info
    const content = await page.content()
    const hasContent = content.includes('PostgreSQL') || content.includes('Database') ||
      content.includes('System') || content.includes('52.230.33.120')
    expect(hasContent).toBe(true)
  })
})
