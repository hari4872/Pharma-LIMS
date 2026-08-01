import { BrowserContext, Page } from '@playwright/test'

export const BASE = 'http://localhost:5173'

// Decoded payload:
// { sub:"1", name:"System Administrator", role:"Admin", userType:"Admin", labId:"1", labName:"Apex Pharma", exp:9999999999 }
const ADMIN_JWT = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJzdWIiOiIxIiwibmFtZSI6IlN5c3RlbSBBZG1pbmlzdHJhdG9yIiwicm9sZSI6IkFkbWluIiwidXNlclR5cGUiOiJBZG1pbiIsImxhYklkIjoiMSIsImxhYk5hbWUiOiJBcGV4IFBoYXJtYSIsImV4cCI6OTk5OTk5OTk5OX0',
  'fake-sig',
].join('.')

/**
 * Playwright processes routes in FIFO order: first registered = highest priority.
 *
 * Registration order here:
 *  1. auth/lab-config routes           (highest priority)
 *  2. extraRoutes (test-specific mocks) (checked after auth)
 *  3. catch-all *\/api\/**              (LAST = lowest priority — fallback only)
 *  4. SignalR abort                     (abort always, regardless)
 */
export async function setupAuthContext(
  context: BrowserContext,
  extraRoutes?: (ctx: BrowserContext) => Promise<void>
) {
  // Inject JWT so every page load starts as logged-in Admin
  await context.addInitScript((token) => {
    localStorage.setItem('lims_token', token)
  }, ADMIN_JWT)

  // Axios baseURL is /api/v1 — use exact origin+prefix to avoid intercepting
  // Vite's own /src/api/* module files.
  const API = 'http://localhost:5173/api/v1'

  // ① High-priority fixed mocks (auth + lab-config)
  await context.route(`${API}/auth/permissions*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  )
  await context.route(`${API}/users/*/permissions*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  )
  // More-specific logo route must come BEFORE the general lab-config route
  await context.route(`${API}/lab-config/logo*`, route =>
    route.fulfill({ status: 404, contentType: 'application/json',
      body: JSON.stringify({ error: 'NO_LOGO' }) })
  )
  await context.route(`${API}/lab-config*`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { configKey: 'nav.work-queue',     configValue: 'true' },
        { configKey: 'nav.coa-review',     configValue: 'true' },
        { configKey: 'nav.results-review', configValue: 'true' },
      ]),
    })
  )

  // ② Test-specific extra routes (registered before catch-all = higher priority)
  if (extraRoutes) await extraRoutes(context)

  // ③ Catch-all (registered LAST = lowest priority — handles anything not matched above)
  await context.route(`${API}/**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  // ④ Always abort SignalR (would hang without a backend)
  await context.route('http://localhost:5173/hubs/**', route => route.abort())
  await context.route('**/*.signalr*', route => route.abort())
}

export async function navigateTo(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
}
