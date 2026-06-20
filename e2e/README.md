# E2E tests — Playwright

End-to-end UI tests for the AssessExpert portal. Scaffolded as a starting
point — there are smoke tests that work out of the box, and flow tests
that need seed data + env vars.

## One-time setup

```bash
cd e2e
npm install
npm run install:browsers     # downloads Chromium (~150 MB)
cp .env.example .env         # edit with your test account credentials
```

## Run

```bash
npm test                     # all tests, headless
npm run test:headed          # watch the browser drive itself
npm run test:ui              # interactive mode — pick + debug
npm run test:debug           # inspector for a single test
npm run report               # open the last HTML report
```

## Target URL

Default: `http://localhost:3000`. Override:

```bash
BASE_URL=https://staging.assessexpert.com npm test
```

## What's covered

| Spec | Notes |
|---|---|
| `smoke.spec.ts` | Homepage, login form, /status, invalid-token graceful errors. Runs with no seed data. |
| `hr-login.spec.ts` | HR can log in, sees only role-appropriate nav, logout works. Needs E2E_HR_EMAIL + E2E_HR_PASSWORD. |
| `hr-schedule.spec.ts` | HR scheduling modal renders correctly. Needs a seeded candidate. |
| `quiz-flow.spec.ts` | Candidate quiz flow happy path + email-mismatch + invalid-OTP. Needs E2E_QUIZ_TOKEN. |

## What's NOT covered (yet)

- Full proctored exam flow (camera + WebRTC) — needs real WebRTC peer
  setup. Plan in `TESTING_REPORT.md → Manual test plan`.
- Interview live call (HR ↔ candidate WebRTC).
- Cloudflare TURN actually relaying media.
- Bulk CSV import.
- PDF generation.

These are exercised manually per the test plan in `TESTING_REPORT.md`.

## Environment variables

Create `e2e/.env`:

```ini
BASE_URL=http://localhost:3000

# Seeded test accounts (created via seed script or super-admin UI)
E2E_SUPERADMIN_EMAIL=superadmin@testco.local
E2E_SUPERADMIN_PASSWORD=...
E2E_HR_EMAIL=hr@testco.local
E2E_HR_PASSWORD=...
E2E_PROCTOR_EMAIL=proctor@testco.local
E2E_PROCTOR_PASSWORD=...
E2E_CANDIDATE_EMAIL=candidate@testco.local

# Magic token for a seeded quiz session (rotate per run if it gets used)
E2E_QUIZ_TOKEN=64de70570169d2edc...
```

## Adding tests

1. New file under `tests/`
2. Import `users` from `../fixtures/users`
3. Use `page.goto(...)` against `baseURL`
4. Prefer accessible selectors (`getByRole('button', { name: /pattern/i })`)
   over CSS selectors — they survive UI redesigns

## CI

Set `CI=true` so Playwright retries flaky tests twice:

```yaml
- run: npm ci
- run: npx playwright install chromium
- run: CI=true npm test
- if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: e2e/playwright-report/
```
