import { test, expect } from '@playwright/test'
import { users } from '../fixtures/users'

/**
 * End-to-end Quiz mode flow. Pre-requisite: backend exposes a test-only
 * endpoint OR you seed a quiz-mode session manually via SQL/API in
 * beforeAll. The token below is a placeholder — replace with the real
 * magicToken from your seeded session.
 *
 * Skip individual tests via:
 *   test.skip(!process.env.E2E_QUIZ_TOKEN, 'set E2E_QUIZ_TOKEN to run')
 */

const QUIZ_TOKEN = process.env.E2E_QUIZ_TOKEN || ''

test.describe('Quiz candidate flow', () => {
  test.skip(!QUIZ_TOKEN, 'Set E2E_QUIZ_TOKEN env var to a seeded quiz session magicToken')

  test('intro → email confirm → instructions visible', async ({ page }) => {
    await page.goto(`/quiz/${QUIZ_TOKEN}`)
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
    await page.getByRole('button', { name: /continue/i }).click()

    // Email confirm
    await expect(page.getByRole('heading', { name: /confirm your email/i })).toBeVisible()
    await page.fill('input[type="email"]', users.candidate.email)
    await page.getByRole('button', { name: /send my access code/i }).click()

    // OTP screen — we can't read the email here, so just verify it renders
    await expect(page.getByRole('heading', { name: /welcome|enter access code/i })).toBeVisible({ timeout: 10_000 })
  })

  test('invalid OTP shows error', async ({ page }) => {
    await page.goto(`/quiz/${QUIZ_TOKEN}`)
    await page.getByRole('button', { name: /continue/i }).click()
    await page.fill('input[type="email"]', users.candidate.email)
    await page.getByRole('button', { name: /send my access code/i }).click()
    // Wait for OTP screen
    await page.waitForSelector('input[inputmode="numeric"]', { timeout: 10_000 })
    await page.fill('input[inputmode="numeric"]', '000000')
    await page.getByRole('button', { name: /verify/i }).click()
    await expect(page.getByText(/invalid|incorrect/i)).toBeVisible({ timeout: 8_000 })
  })

  test('email mismatch is rejected', async ({ page }) => {
    await page.goto(`/quiz/${QUIZ_TOKEN}`)
    await page.getByRole('button', { name: /continue/i }).click()
    await page.fill('input[type="email"]', 'wrong@example.com')
    await page.getByRole('button', { name: /send my access code/i }).click()
    await expect(page.getByText(/email does not match/i)).toBeVisible({ timeout: 8_000 })
  })
})
