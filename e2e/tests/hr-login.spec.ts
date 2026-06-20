import { test, expect } from '@playwright/test'
import { users } from '../fixtures/users'

/**
 * Auth + RBAC sanity. Verifies the HR sidebar shows the right items for
 * the right role and never leaks an admin-only entry to HR.
 */
test.describe('HR login + sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', users.hr.email)
    await page.fill('input[type="password"]', users.hr.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await expect(page).toHaveURL(/\/hr/)
  })

  test('sidebar shows the HR nav items', async ({ page }) => {
    for (const label of ['Overview', 'Candidates', 'Assessments', 'Interviews', 'Settings']) {
      await expect(page.getByRole('link', { name: new RegExp(`^${label}$`, 'i') })).toBeVisible()
    }
  })

  test('sidebar does NOT show super-admin-only items', async ({ page }) => {
    // HR should never see Companies / Users admin
    await expect(page.getByRole('link', { name: /^companies$/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^admin$/i })).toHaveCount(0)
  })

  test('logout clears session and bounces to /login', async ({ page }) => {
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/login/)
    // Trying to hit /hr after logout should bounce back
    await page.goto('/hr')
    await expect(page).toHaveURL(/\/login/)
  })
})
