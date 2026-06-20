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
})
