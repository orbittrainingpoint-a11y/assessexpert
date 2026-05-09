# assessexpert — Complete Fix & Build Task List
> All ⚠️ Partial gaps + ❌ Missing features + 🔴 Runtime bugs
> Legend: ✅ Done | 🔄 In Progress | ⬜ Pending

---

## SPRINT R — Runtime Bug Fixes (10 bugs)

| # | Bug | File | Fix | Status |
|---|-----|------|-----|--------|
| R1 | `interviewsApi` backend routes don't exist — HR interview room 500s | `hr/performers/page.tsx` | Wrap all interview API calls in try/catch with graceful fallback | ⬜ |
| R2 | Proctor report review crashes 404 if no report generated yet | `proctor/reports/[sessionId]/page.tsx` | Handle null report gracefully, show "Generate Report" CTA | ⬜ |
| R3 | `sessionsApi.getAll({ myOnly: true })` param may not be supported | `proctor/page.tsx` | Remove myOnly param, filter client-side by proctorId | ⬜ |
| R4 | `reportsApi.getAll({ organizationId })` filter may not exist | `admin/companies/page.tsx` | Use sessionId filter or remove org filter | ⬜ |
| R5 | `usersApi.getAvailability(id)` — backend route likely missing | `master-proctor/proctors/page.tsx` | Graceful fallback with "No availability data" message | ⬜ |
| R6 | `sessionsApi.getMasterProctorStats()` — route may not exist | `master-proctor/page.tsx` | Wrap in .catch(() => ({ aiFlagsThisWeek: 0 })) | ⬜ |
| R7 | `usersApi.sendDirectMessage()` — route may not exist | `master-proctor/proctors/page.tsx` | Graceful error toast only | ⬜ |
| R8 | `usersApi.sendProctorMessage()` — route may not exist | `master-proctor/sessions/page.tsx` | Graceful error toast only | ⬜ |
| R9 | `usersApi.suspend()` — route may not exist | `master-proctor/proctors/page.tsx` | Graceful error toast only | ⬜ |
| R10 | `salesApi.getStats()` missing `assessmentTypeDistribution`/`companyGrowth` fields | `admin/page.tsx` | Null-safe rendering, show empty state if missing | ⬜ |

---

## SPRINT P — Partial Gap Fixes (12 items)

| # | Feature | File | Fix | Status |
|---|---------|------|-----|--------|
| P1 | Proctor session: PracticalPanel status enum — add all possible post-MCQ statuses | `proctor/session/page.tsx` | Add SUBMITTED, MCQ_ENDED, AWAITING_PRACTICAL to trigger | ⬜ |
| P2 | Proctor Today: 15-min join button activation with countdown | `proctor/today/page.tsx` | Add time-based button state logic | ⬜ |
| P3 | Exam Setup dashboard: real activity log from audit API | `exam-setup/page.tsx` | Replace static demo data with real API call | ⬜ |
| P4 | HR candidates: candidate name clickable → detail drawer | `hr/candidates/page.tsx` | Add candidate detail drawer with timeline + report + recording | ⬜ |
| P5 | HR candidates: reschedule modal for failed/no-show | `hr/candidates/page.tsx` | Add reschedule button + modal for completed/failed sessions | ⬜ |
| P6 | HR assessments: filter/sort controls | `hr/assessments/page.tsx` | Add filter bar (pass/fail, date, assessment, integrity) | ⬜ |
| P7 | Admin reports: Watch Recording button + dual-pane player | `admin/reports/page.tsx` | Add recording player modal same as HR report page | ⬜ |
| P8 | Admin assessment types: full edit form | `admin/assessments/page.tsx` | Add Edit button + full config form modal | ⬜ |
| P9 | Exam Setup: Pool Balance Report (difficulty/domain charts) | `exam-setup/questions/page.tsx` | Add pool balance tab with charts | ⬜ |
| P10 | Exam Setup: Assessment type edit with approval workflow | `exam-setup/assessments/page.tsx` | Add edit settings form with pending approval state | ⬜ |
| P11 | Master Proctor Settings: session/AI/proctor settings panels | `master-proctor/settings/page.tsx` | Expand from password-only to full settings page | ⬜ |
| P12 | Master Proctor Reports: Reporting Standards config panel | `master-proctor/reports/page.tsx` | Add standards config section | ⬜ |

---

## SPRINT M — Missing Features (19 items)

| # | Feature | File | Status |
|---|---------|------|--------|
| M1 | MFA TOTP setup flow on first login | `login/page.tsx` + new MFA setup page | ⬜ |
| M2 | HR Settings: company profile management (logo, name, contacts) | `hr/settings/page.tsx` | ⬜ |
| M3 | HR Settings: user management (invite HR/Hiring Manager) | `hr/settings/page.tsx` | ⬜ |
| M4 | HR Settings: notification preferences toggles | `hr/settings/page.tsx` | ⬜ |
| M5 | Proctor Settings: availability schedule grid (7-day × 24h) | `proctor/settings/page.tsx` | ⬜ |
| M6 | Proctor Settings: notification preferences | `proctor/settings/page.tsx` | ⬜ |
| M7 | Admin Assessment Types: archive/status toggle | `admin/assessments/page.tsx` | ⬜ |
| M8 | Exam Setup: coding test case manager | `exam-setup/practical/page.tsx` | ⬜ |
| M9 | Master Proctor Reports: reporting standards config | `master-proctor/reports/page.tsx` | ⬜ |
| M10 | Public website contact form → creates sales lead | `contact/page.tsx` | ⬜ |
| M11 | First-login onboarding tutorial (Proctor 8-step) | `proctor/page.tsx` | ⬜ |
| M12 | First-login onboarding tutorial (HR 12-step) | `hr/page.tsx` | ⬜ |
| M13 | HR assessments: bulk export (CSV + PDF bundle) | `hr/assessments/page.tsx` | ⬜ |
| M14 | Admin schedule: filter controls | `admin/schedule/page.tsx` | ⬜ |
| M15 | Proctor reports list page (Tab 4 — completed assessments) | `proctor/reports/page.tsx` | ⬜ |
| M16 | HR dashboard: pass rate donut chart + efficiency metrics row | `hr/page.tsx` | ⬜ |
| M17 | Admin companies: contract expiry alerts (90/30 day badges) | `admin/companies/page.tsx` | ⬜ |
| M18 | Candidate exam: MCQ-only completion screen variant | `exam/page.tsx` | ⬜ |
| M19 | Login: first-login forced password change flow | `login/page.tsx` | ⬜ |

---

## EXECUTION ORDER

**Batch 1 (R1–R10):** All runtime bugs — defensive coding, graceful fallbacks
**Batch 2 (P1–P6):** High-impact partial fixes — session, today page, HR candidates
**Batch 3 (P7–P12):** Medium partial fixes — admin, exam setup, MP settings
**Batch 4 (M1–M6):** Settings pages + MFA setup
**Batch 5 (M7–M13):** Feature additions
**Batch 6 (M14–M19):** Polish + remaining features

---

## PROGRESS
- Sprint R: ⬜ 0/10
- Sprint P: ⬜ 0/12
- Sprint M: ⬜ 0/19
- **Total: 0/41**
