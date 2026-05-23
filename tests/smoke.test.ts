/**
 * LIMS Smoke Tests
 * ─────────────────────────────────────────────────────────────
 * Checks every page loads without crashing after login.
 * Run:  npm run test:smoke
 */

import { test, expect } from '@playwright/test'

// ── Credentials (match seed data) ──────────────────────────────
const URL      = 'http://localhost:5173'
const USERNAME = 'admin'
const PASSWORD = 'Admin@123'

// ── All LIMS routes to verify ──────────────────────────────────
const PAGES = [
  { name: 'Dashboard',             path: '/dashboard' },
  { name: 'Compliance Panel',      path: '/compliance' },
  // Master Data
  { name: 'Laboratories',          path: '/master-data/laboratories' },
  { name: 'Instruments',           path: '/master-data/instruments' },
  { name: 'Materials',             path: '/master-data/materials' },
  { name: 'Test Methods',          path: '/master-data/test-methods' },
  { name: 'Parameters',            path: '/master-data/parameters' },
  { name: 'Spec Limits',           path: '/master-data/spec-limits' },
  { name: 'Form Templates',        path: '/master-data/form-templates' },
  { name: 'Users',                 path: '/master-data/users' },
  { name: 'Sample Types',          path: '/master-data/sample-types' },
  { name: 'Storage Locations',     path: '/master-data/storage-locations' },
  // Operations
  { name: 'Sample Registration',   path: '/samples' },
  { name: 'Checkpoints',           path: '/checkpoints' },
  { name: 'Work Queue',            path: '/work-queue' },
  { name: 'OOS Investigations',    path: '/oos-investigations' },
  { name: 'Digital Logbook',       path: '/digital-logbook' },
  { name: 'Results Review',        path: '/results-review' },
  { name: 'CoA Review',            path: '/coa-review' },
  { name: 'Dispatch QC',           path: '/dispatch-qc' },
  // Phase 5
  { name: 'Traceability',          path: '/traceability' },
  { name: 'Stability Pulls',       path: '/stability-pulls' },
  { name: 'Retain Samples',        path: '/retain-samples' },
  { name: 'Condition Excursions',  path: '/condition-excursions' },
]

// ── Login helper ───────────────────────────────────────────────
async function login(page: any) {
  await page.goto(`${URL}/login`)
  await page.waitForLoadState('networkidle')

  // Fill username
  const userInput = page.locator('input[type="text"], input[name="username"], input[placeholder*="user" i], input[placeholder*="email" i]').first()
  await userInput.fill(USERNAME)

  // Fill password
  const passInput = page.locator('input[type="password"]').first()
  await passInput.fill(PASSWORD)

  // Click login button
  const loginBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")').first()
  await loginBtn.click()

  // Wait for redirect away from login
  await page.waitForURL(url => !url.includes('/login'), { timeout: 10_000 })
  console.log('  ✓ Login successful')
}

// ── Test: Login Page loads ─────────────────────────────────────
test('Login page loads', async ({ page }) => {
  await page.goto(`${URL}/login`)
  await expect(page).toHaveTitle(/.+/)
  const passField = page.locator('input[type="password"]')
  await expect(passField).toBeVisible()
  console.log('  ✓ Login page rendered correctly')
})

// ── Test: Login works ──────────────────────────────────────────
test('Login with valid credentials', async ({ page }) => {
  await login(page)
  // Should NOT be on login page
  await expect(page).not.toHaveURL(/\/login/)
  console.log('  ✓ Logged in and redirected')
})

// ── Test: All pages load without crash ─────────────────────────
for (const { name, path } of PAGES) {
  test(`Page loads: ${name} (${path})`, async ({ page }) => {
    await login(page)
    await page.goto(`${URL}${path}`)
    await page.waitForLoadState('networkidle')

    // Page should not show a crash / white screen
    const body = page.locator('body')
    await expect(body).toBeVisible()

    // Should not have unhandled error overlay
    const errorOverlay = page.locator('vite-error-overlay, #error-overlay')
    await expect(errorOverlay).not.toBeVisible()

    // Should not redirect back to login (auth still valid)
    await expect(page).not.toHaveURL(/\/login/)

    console.log(`  ✓ ${name} loaded`)
  })
}

// ── Test: Unauthenticated access redirects to login ────────────
test('Unauthenticated access redirects to login', async ({ page }) => {
  // Go directly to a protected page without logging in
  await page.goto(`${URL}/samples`)
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/login/)
  console.log('  ✓ Protected route redirects to login when not authenticated')
})
