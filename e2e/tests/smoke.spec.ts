import { test, expect } from '@playwright/test'

/**
 * Smoke tests — should pass on every deploy. If any of these fail,
 * the deploy is broken at the very basics. Total runtime <30s.
 */
test.describe('Smoke', () => {
  test('homepage loads with title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/assessexpert/i)
  })

  test('login page renders the form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible()
  })

  test('/status diagnostic page runs all checks', async ({ page }) => {
    await page.goto('/status')
    await expect(page.getByRole('heading', { name: /platform status/i })).toBeVisible()
    // The "Backend reachable" check should complete (pass or fail, not stuck)
    await expect(page.getByText(/backend reachable/i)).toBeVisible()
  })

  test('public marketing site responds', async ({ page }) => {
    const res = await page.goto('/about')
    expect(res?.status() || 0).toBeLessThan(400)
  })

  test('candidate exam page renders without crash on invalid token', async ({ page }) => {
    const res = await page.goto('/exam?token=invalid-test-token')
    expect(res?.status() || 0).toBeLessThan(500)
  })

  test('candidate quiz page renders without crash on invalid token', async ({ page }) => {
    await page.goto('/quiz/invalid-test-token')
    // Should show the invalid-link panel, not crash
    await expect(page.getByText(/invalid|not recognised/i)).toBeVisible({ timeout: 10_000 })
  })

  test('candidate interview page renders without crash on invalid token', async ({ page }) => {
    await page.goto('/interview/invalid-test-token')
    await expect(page.getByText(/invalid|not recognised/i)).toBeVisible({ timeout: 10_000 })
  })

  // Added 2026-07-24 — verify the enhanced health endpoints from
  // commit 6081e55 (top-10 #4). External uptime monitors point at
  // /api/health for liveness; blue-green load balancers point at
  // /api/ready for readiness. Both must return 200 with sensible bodies.
  test('/api/health returns 200 with liveness metadata', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('assessexpert-api')
    expect(typeof body.uptimeSeconds).toBe('number')
  })

  test('/api/ready returns 200 with per-dependency check results', async ({ request }) => {
    const res = await request.get('/api/ready')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    // Every dep check should be present, ok=true, latencyMs numeric
    expect(body.checks?.database?.ok).toBe(true)
    expect(body.checks?.storage?.ok).toBe(true)
    expect(typeof body.checks?.database?.latencyMs).toBe('number')
  })

  // Added 2026-07-24 — verify the new password-reset entry points
  // shipped in commit b8eaae0 render without crashing.
  test('/forgot-password renders the form', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByText(/forgot password/i).first()).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible()
  })

  test('login page shows the Forgot password link', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /forgot your password/i })).toBeVisible()
  })

  // Added 2026-07-24 — /reset-password/[token] renders even for an
  // invalid token (server-side error only fires on submit).
  test('/reset-password/[token] renders the form', async ({ page }) => {
    await page.goto('/reset-password/test-invalid-token')
    await expect(page.getByText(/choose a new password/i)).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('/verify-email/[token] renders and hits the endpoint', async ({ page }) => {
    await page.goto('/verify-email/test-invalid-token')
    // Either "Verification failed" (endpoint rejected) or the pending
    // "Verifying..." state — either is fine for the smoke test.
    await expect(page.getByText(/verify|verification/i).first()).toBeVisible({ timeout: 10_000 })
  })
})

// Password-reset happy path — separated from smoke because it does
// actual DB writes (would spam the invitations queue if run every
// build). Run these explicitly via `npx playwright test password-reset`
// or in a nightly job.
//
// Skipped by default because they need a seeded user account. Un-skip
// once the e2e/.env is set up with TEST_USER_EMAIL.
test.describe.skip('Password reset happy path', () => {
  test('forgot-password → success message → invalid token rejected', async ({ page, request }) => {
    // 1. Request a reset via the form
    await page.goto('/forgot-password')
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'admin@assessexpert.ae')
    await page.getByRole('button', { name: /send reset link/i }).click()
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 })

    // 2. Direct API call — invalid token gets a generic 400
    const bad = await request.post('/api/auth/reset-password', {
      data: { token: 'obviously-fake-token', password: 'newpassword123' },
    })
    expect(bad.status()).toBe(400)
  })
})

// GDPR privacy page — under /me/privacy, requires auth. This test just
// verifies the route exists and redirects unauthed users to login (or
// renders a "please sign in" message). Actual export/delete flows
// need seeded credentials.
test.describe('GDPR — /me/privacy exists', () => {
  test('unauthenticated user hits /me/privacy → redirected or 401', async ({ page }) => {
    const res = await page.goto('/me/privacy')
    // Either a redirect to /login OR the route renders but the
    // authenticated wrapper bounces the user. Both are acceptable —
    // just don't crash.
    expect(res?.status() || 0).toBeLessThan(500)
  })
})
