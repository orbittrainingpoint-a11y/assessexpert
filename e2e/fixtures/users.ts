/**
 * Test fixtures. Replace these with your seeded test accounts.
 *
 * Recommended seeding strategy:
 *   1. Seed a "TestCo" organisation
 *   2. Seed one user per role pointing at TestCo
 *   3. Seed one candidate per scheduled-flow test
 *   4. Use API setup (not UI) to schedule sessions in beforeEach
 *
 * Never put real production passwords here. Read from .env.test instead:
 *   process.env.E2E_HR_EMAIL / E2E_HR_PASSWORD
 */
export const users = {
  superAdmin: {
    email: process.env.E2E_SUPERADMIN_EMAIL || 'superadmin@testco.local',
    password: process.env.E2E_SUPERADMIN_PASSWORD || 'change-me',
  },
  hr: {
    email: process.env.E2E_HR_EMAIL || 'hr@testco.local',
    password: process.env.E2E_HR_PASSWORD || 'change-me',
  },
  proctor: {
    email: process.env.E2E_PROCTOR_EMAIL || 'proctor@testco.local',
    password: process.env.E2E_PROCTOR_PASSWORD || 'change-me',
  },
  candidate: {
    email: process.env.E2E_CANDIDATE_EMAIL || 'candidate@testco.local',
    firstName: 'Test',
    lastName: 'Candidate',
  },
}
