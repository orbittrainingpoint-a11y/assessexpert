# assessexpert — Complete Remaining Build Task List
> Session: Critical Bugs + Missing Features — Full Build
> Legend: ✅ Done | 🔄 In Progress | ⬜ Pending

---

## SPRINT A — Critical Bug Fixes (Runtime Crashes)
> All must be fixed before anything else — these break the app

| # | Task | File | Issue | Size |
|---|------|------|-------|------|
| A1 | Fix api.ts — add 6 missing methods | `lib/api.ts` | resume, getMasterProctorStats, suspend, sendDirectMessage, sendProctorMessage, publish with body | XS |
| A2 | Fix proctor report review — getBySession + split publish | `proctor/reports/[sessionId]/page.tsx` | getOne→getBySession, updateProctorFields then publish | XS |
| A3 | Fix proctor session — MCQ_COMPLETE status + practical panel trigger | `proctor/session/page.tsx` | MCQ_COMPLETE may not exist; add SUBMITTED as trigger | XS |
| A4 | Fix candidate exam — practical task null guard + fetch on transition | `exam/page.tsx` | practicalTask null when polling detects PRACTICAL_IN_PROGRESS | XS |

---

## SPRINT B — HR Dashboard Gaps (High Priority)
> Core HR workflow — scheduling and interview room

| # | Task | File | Feature | Size |
|---|------|------|---------|------|
| B1 | HR Candidates — Schedule modal (slots, confirm, send invite) | `hr/candidates/page.tsx` | Full scheduling modal with assessment dropdown + available slots | M |
| B2 | HR Candidates — Add Candidate form assessment dropdown | `hr/candidates/page.tsx` | assessmentTypeId field + skills focus preview | S |
| B3 | HR Performers — Schedule Interview modal | `hr/performers/page.tsx` | Interview scheduling modal per candidate | S |
| B4 | HR Performers — Interview Room (video call + report sidebar) | `hr/performers/page.tsx` | WebRTC-ready interview room with report panel + suggested questions | M |
| B5 | HR Report — PDF download + recording player | `hr/assessments/[sessionId]/page.tsx` | PDF download button + dual-pane recording player modal | M |

---

## SPRINT C — Admin Dashboard Gaps (Medium Priority)

| # | Task | File | Feature | Size |
|---|------|------|---------|------|
| C1 | Admin Dashboard — Sales graph + activity feed | `admin/page.tsx` | Sales performance chart + recent activity feed | M |
| C2 | Admin Companies — Company detail view (4 sub-tabs) | `admin/companies/page.tsx` | View button + drawer with Overview/HR Users/History/Notes tabs | M |
| C3 | Admin Users — Role-specific form fields | `admin/users/page.tsx` | Proctor cert fields, ESM domains, Sales region | S |
| C4 | Admin Settings — Feature flags panel + audit log viewer | `admin/settings/page.tsx` | Feature flags toggles + searchable audit log table | M |

---

## SPRINT D — Master Proctor + Proctor Gaps (Medium Priority)

| # | Task | File | Feature | Size |
|---|------|------|---------|------|
| D1 | Master Proctor Reports — Escalation Override flow | `master-proctor/reports/page.tsx` | Override modal with edit fields + republish | S |
| D2 | Proctor Dashboard — Performance charts + rating panel | `proctor/page.tsx` | Sessions over time chart + report status donut + rating panel | M |
| D3 | Master Proctor Proctors — Real availability API | `master-proctor/proctors/page.tsx` | Replace Math.random() with real API fetch | XS |

---

## EXECUTION ORDER THIS SESSION
1. A1 → A2 → A3 → A4 (critical bugs — all XS, do first)
2. B1 → B2 (HR scheduling — core workflow)
3. B3 → B4 (HR interview room)
4. B5 (HR recording player)
5. C1 → C2 → C3 → C4 (admin gaps)
6. D1 → D2 → D3 (proctor/MP gaps)

---

## STATUS
- Sprint A: ✅ 4/4 COMPLETE
- Sprint B: ✅ 5/5 COMPLETE
- Sprint C: ✅ 4/4 COMPLETE
- Sprint D: ✅ 3/3 COMPLETE
- **Total: 16/16 ✅ ALL DONE**

---

## FILES CHANGED THIS SESSION
| File | Changes |
|------|---------|
| `lib/api.ts` | +resume, +getMasterProctorStats, +suspend, +sendDirectMessage, +sendProctorMessage, +getAvailability, +getPracticalTask, +interviewsApi, fixed publish signature |
| `proctor/reports/[sessionId]/page.tsx` | Fixed getBySession, split publish into updateProctorFields+publish |
| `proctor/session/page.tsx` | Fixed MCQ_COMPLETE to also handle MCQ_SUBMITTED, AWAITING_PRACTICAL |
| `exam/page.tsx` | Fixed practical task null guard with fallback fetch |
| `hr/candidates/page.tsx` | Full scheduling modal + assessment dropdown + skills preview |
| `hr/performers/page.tsx` | Interview scheduling modal + full interview room with WebRTC UI, report sidebar, suggested questions, post-interview form |
| `hr/assessments/[sessionId]/page.tsx` | PDF download + share link + dual-pane recording player modal with chapter markers |
| `admin/page.tsx` | Sales performance chart + company growth bar chart + assessment type donut + recent activity feed |
| `admin/companies/page.tsx` | Company detail drawer with 4 sub-tabs (Overview/Users/History/Notes) + credit usage bar |
| `admin/users/page.tsx` | Role-specific form fields (Proctor cert/domains/languages, ESM domains/access, Sales region/target) |
| `admin/settings/page.tsx` | 3-tab layout: General Settings + Feature Flags toggles + Audit Log viewer with pagination |
| `master-proctor/reports/page.tsx` | Return for Modification with required fields checklist + Escalation Override modal |
| `proctor/page.tsx` | Sessions over time line chart + report status donut + company activity bars + rating panel |
| `master-proctor/proctors/page.tsx` | Replaced Math.random() availability with real usersApi.getAvailability() call |
