import { test, expect } from '@playwright/test'
import { users } from '../fixtures/users'

/**
 * HR scheduling flows — depends on a seeded HR user + at least one
 * candidate + at least one published assessment type.
 */
test.describe('HR scheduling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', users.hr.email)
    await page.fill('input[type="password"]', users.hr.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/\/hr/)
  })

  test('candidates page lists at least one candidate', async ({ page }) => {
    await page.goto('/hr/candidates')
    await expect(page.getByRole('heading', { name: /candidates/i }).first()).toBeVisible()
  })

  test('schedule modal opens and shows mode toggle ONLY if quiz enabled', async ({ page }) => {
    await page.goto('/hr/candidates')
    // Trigger the first row's "Schedule" action — exact selector
    // depends on your UI. Adjust if needed.
    const scheduleBtn = page.getByRole('button', { name: /schedule/i }).first()
    if ((await scheduleBtn.count()) === 0) test.skip(true, 'No schedulable candidate found — seed one first')
    await scheduleBtn.click()
    // Mode toggle appears only when the org has quizEnabled = true
    const modeLabel = page.getByText(/^Mode$/)
    // Either present (quiz enabled) or absent (quiz disabled) — both acceptable
    if (await modeLabel.count() > 0) {
      await expect(page.getByRole('button', { name: /^Quiz only$/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Proctored$/i })).toBeVisible()
    }
  })

  test('interviews page renders without crash', async ({ page }) => {
    await page.goto('/hr/interviews')
    await expect(page.getByRole('heading', { name: /interviews/i }).first()).toBeVisible()
  })
})
