# assessexpert — HR Dashboard
## Complete Feature Specification Document

> **Portal:** `app.assessexpert.ae/hr`
> **Role:** HR Manager / Org Admin
> **Version:** 1.0
> **Classification:** Internal — Development & Engineering Team

---

## Table of Contents

1. [Role Overview & Access](#1-role-overview--access)
2. [Authentication & Login](#2-authentication--login)
3. [Tab 1 — Overview Dashboard (Home)](#3-tab-1--overview-dashboard-home)
4. [Tab 2 — Candidates](#4-tab-2--candidates)
5. [Tab 3 — Assessments Completed](#5-tab-3--assessments-completed)
6. [Tab 4 — Top Performers & Interview Panel](#6-tab-4--top-performers--interview-panel)
7. [Tab 5 — Profile & Settings](#7-tab-5--profile--settings)
8. [Notification Center](#8-notification-center)
9. [Connectivity & API Dependencies](#9-connectivity--api-dependencies)

---

## 1. Role Overview & Access

The HR Manager is the primary client-side user of the assessexpert platform. They represent the company (client organisation) that has contracted assessexpert to conduct technical assessments for their hiring pipeline.

### 1.1 What HR Can Do

| Capability | Description |
|-----------|-------------|
| View analytics | See their company's assessment statistics, graphs, and efficiency metrics |
| Add candidates | Manually add individual candidates or bulk-import via CSV |
| Schedule assessments | Assign candidates to assessment sessions |
| View completed results | Access published reports and screen recordings |
| Reschedule assessments | Request rescheduling for pending or failed sessions |
| Schedule interviews | Book interviews for high-scoring candidates |
| Conduct interviews | Use the built-in interview panel directly on the dashboard |
| Manage company profile | Update company name, logo, contacts, and notification settings |

### 1.2 What HR Cannot Do

| Restriction | Reason |
|------------|--------|
| Cannot see unpublished AI draft reports | Reports are only visible after the proctor publishes them |
| Cannot start or control exam sessions | Sessions are proctor-controlled — HR has no session controls |
| Cannot view another company's candidates | Strict multi-tenant isolation — each company sees only their own data |
| Cannot access the question bank | Question library is managed by Super Admin and Org Admin only |
| Cannot modify published reports | Only the proctor can modify a report before publication |

### 1.3 Tenant Isolation

Every HR Manager's account is bound to a single `organizationId`. Every database query, API call, file access, and WebSocket room is scoped to this ID. It is architecturally impossible for an HR Manager to see another company's data.

---

## 2. Authentication & Login

### 2.1 Login Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| Email + Password | ✅ | bcrypt 12 rounds |
| Google OAuth | ✅ | For quick access |
| Microsoft / Azure AD OAuth | ✅ | Enterprise companies using Microsoft 365 |
| SAML 2.0 / SSO | ✅ (Enterprise tier) | Company Identity Provider integration |
| MFA — TOTP | ✅ Optional | Google Authenticator or Authy |
| MFA — SMS OTP | ✅ Optional | Via Twilio |

### 2.2 First Login — Onboarding Tutorial

On the HR Manager's first login, a guided tutorial overlay is triggered automatically:

- **12-step interactive walkthrough** covering all major features
- Each step highlights the relevant UI element with a tooltip and brief instruction
- Tutorial can be paused and resumed at any time
- Accessible again at any time via the Help menu
- Progress is saved so the HR Manager can continue from where they left off
- Tutorial covers: adding a candidate, scheduling an assessment, viewing a report, and conducting an interview

---

## 3. Tab 1 — Overview Dashboard (Home)

This is the landing screen after login. It provides a real-time summary of the company's assessment activity and efficiency metrics.

### 3.1 Summary Stat Cards (Top Row)

Four large stat cards displayed in a horizontal row at the top of the page:

| Card | Value Shown | Colour Indicator |
|------|-------------|-----------------|
| Total Assessments Conducted | Cumulative total since account created | Neutral (blue) |
| Assessments Completed | Sessions fully done with published report | Green |
| Assessments Pending | Scheduled but not yet conducted | Amber |
| Assessments In Progress | Currently live sessions | Cyan pulse animation |

Each card displays:
- Large number (animated CountUp.js on page load)
- Sub-label describing the metric
- A small trend indicator arrow: ↑ or ↓ compared to previous month, with percentage change

---

### 3.2 Assessment Activity Graph

A line/bar combo chart displayed below the stat cards:

- **X-axis:** Date (last 30 days, or selectable: 7 days / 30 days / 3 months / 12 months)
- **Y-axis:** Number of assessments
- **Lines shown simultaneously:**
  - Scheduled (dashed line, blue)
  - Completed (solid line, green)
  - Pending (solid line, amber)
- Hovering any point shows a tooltip: `"12 Jun — 4 Completed, 1 Pending"`
- Clicking a data point filters the Candidates tab to show sessions from that date

---

### 3.3 Pass Rate & Efficiency Metrics

A secondary row of metric cards below the graph:

| Metric | Description |
|--------|-------------|
| Overall Pass Rate | % of candidates who passed both MCQ and Practical sections |
| Average MCQ Score | Mean MCQ score across all completed assessments |
| Average Practical Score | Mean practical score across all completed assessments |
| Average Integrity Score | Mean integrity score — helps HR understand the quality/fairness of sessions |
| Assessments This Month | Count of sessions conducted in the current calendar month |
| Top Performing Role | The job role with the highest average pass rate |

---

### 3.4 Efficiency Donut Chart

A donut chart visualising the breakdown of all sessions:

- **Pass (green)** — candidates who met both MCQ and practical thresholds
- **Fail (red)** — candidates who did not meet thresholds
- **Pending (amber)** — awaiting proctor report publication
- **No-Show (grey)** — candidates who did not attend

Hover over each segment shows count and percentage. Clicking a segment filters the Candidates tab accordingly.

---

### 3.5 Pending Reports Banner

A persistent, visually distinct banner below the charts:

```
⏳  3 assessments are completed but reports are pending proctor review.
    Results will appear here once published.
```

- This banner appears only when there are sessions in `PENDING_PROCTOR_REVIEW` status
- HR cannot see the reports yet — this is informational only
- Banner disappears once all pending reports are published

---

### 3.6 Recent Activity Feed

A scrollable list on the right side of the dashboard showing recent events:

- `"Report published — Ahmed Al-Rashidi — BIM Coordinator — 14 Jun, 12:31"` → [View Report]
- `"Assessment scheduled — Sara Mitchell — Python Developer — 15 Jun, 10:00 AM"` → [View]
- `"Candidate added — Khalid Al-Mansouri — CAD Draftsman"` → [View Profile]
- `"Recording expiring in 24 hours — James Walker — 7 Jun session"` → [Watch Now]

Events are sorted newest first. Each entry has a contextual action button.

---

## 4. Tab 2 — Candidates

This is the primary working area for HR. It is where candidates are added, managed, and scheduled for assessments.

### 4.1 Candidates List View

The default view shows a table of all candidates belonging to this organisation:

**Table Columns:**

| Column | Description |
|--------|-------------|
| Name | Candidate's full name (first + last) |
| Email | Email address used for invitation |
| Phone | Phone number |
| Job Role | Position they applied for (e.g., BIM Coordinator, CAD Draftsman) |
| Experience | Years of experience entered during adding |
| Assessment | Name of the assessment assigned |
| Status | One of: Not Scheduled / Scheduled / In Progress / Completed / No-Show / Rescheduled |
| Score | Shown only if report is published — overall % score |
| Date | Date of scheduled or completed assessment |
| Actions | Contextual buttons depending on status |

**Table Features:**
- Search bar: real-time search by name, email, or job role
- Filter dropdowns: by Status, Job Role, Assessment Name, Date Range
- Sortable columns (click column header)
- Pagination: 25 rows per page (configurable to 50 or 100)
- Bulk select checkboxes for bulk scheduling or export
- Export button: download filtered list as CSV or Excel

---

### 4.2 Add Candidate — Manual Entry

**Trigger:** Click the `[+ Add Candidate]` button (top-right of Candidates tab)

**Modal / Slide-in panel opens with the following form:**

#### Section 1 — Personal Information

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| First Name | Text | ✅ | Min 2 chars, alpha only |
| Last Name | Text | ✅ | Min 2 chars, alpha only |
| Email Address | Email | ✅ | Valid email format; must be unique within organisation |
| Phone Number | Phone | ✅ | International format with country code selector |

#### Section 2 — Professional Information

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Years of Experience | Number dropdown | ✅ | 0–1 / 1–3 / 3–5 / 5–10 / 10+ years |
| Job Role Applied For | Text + Dropdown | ✅ | Can type custom or select from pre-set list: BIM Modeller, CAD Draftsman, Interior Designer, Architect, MEP Engineer, Project Manager, IT Developer, Network Engineer, Finance Analyst, etc. |
| Department | Text | Optional | e.g., "Design & Engineering" |
| Notes | Textarea | Optional | Internal notes for HR reference only |

#### Section 3 — Assessment Assignment

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Assessment | Dropdown | ✅ | Select from the company's published assessments (e.g., "BIM Coordinator Level 2 — Q3 2026") |
| Skills Focus (read-only preview) | Auto-populated | — | Automatically shows the skills/topics covered by the selected assessment |

The skills focus area shows a read-only tag list like: `Navisworks` `Revit` `Clash Detection` `BIM Coordination` — these are auto-populated from the selected assessment configuration. HR does not manually select skills here; they select the assessment, and the skills are inherited.

#### Form Actions

- `[Save Candidate]` — saves without scheduling; status becomes "Not Scheduled"
- `[Save & Schedule]` — saves and immediately opens the scheduling modal
- `[Cancel]` — closes modal without saving

**On successful save:**
- Candidate appears in the Candidates table
- Toast notification: `"Candidate Ahmed Al-Rashidi added successfully."`
- If saved without scheduling: a `[Schedule]` button appears in their row

---

### 4.3 Add Candidates — CSV / Excel Bulk Import

**Trigger:** Click the `[Import CSV / Excel]` button next to `[+ Add Candidate]`

#### Step 1 — Download Template

- A prominent button: `[⬇ Download Excel Template]`
- Template file: `assessexpert_candidate_import_template.xlsx`
- Template columns: `First Name` | `Last Name` | `Email` | `Phone` | `Experience (years)` | `Job Role` | `Notes`
- A sample row is pre-filled in the template for reference

#### Step 2 — Upload File

- Drag-and-drop upload area or click-to-browse
- Accepted formats: `.csv`, `.xlsx`, `.xls`
- Maximum file size: 5MB
- Maximum rows: 500 candidates per upload

#### Step 3 — Validation Report

After upload, the system immediately validates every row:

```
✅  48 valid candidates ready to import
⚠️  2 errors found — please review:
    Row 12: Invalid email format — "ahmed@@mail.com"
    Row 31: Duplicate email — "sara@company.com" already exists in your account
```

- Valid rows can proceed even if some rows have errors
- HR can choose: `[Import Valid Rows Only]` or `[Fix Errors & Re-upload]`
- A downloadable error report is available: `[⬇ Download Error Report]`

#### Step 4 — Assign Assessment

Before confirming import, HR selects which assessment to assign to all imported candidates from a dropdown. (Individual candidates can be changed later.)

#### Step 5 — Confirm Import

- `[Confirm & Import]` button
- Processing spinner while records are created
- Success screen: `"48 candidates successfully added."` with a `[View Candidates]` link

---

### 4.4 Schedule Assessment

**Trigger:** Click the `[Schedule]` button in a candidate's row — only visible for candidates with "Not Scheduled" status.

**Scheduling Modal:**

The scheduling modal shows:

1. **Candidate name and assessment name** at the top (confirmation of what is being scheduled)

2. **Date Picker** — HR selects a preferred date range (from/to)

3. **Time Preference** — preferred time of day: Morning (8am–12pm) / Afternoon (12pm–5pm) / Evening (5pm–8pm) — all in the candidate's detected or specified timezone

4. **Timezone** — auto-detected from candidate's email domain / country, but HR can manually override

5. **Available Slots** — the system queries proctor availability and returns a list of confirmed open slots:
   ```
   Available Assessment Slots:
   ● Mon 16 Jun — 10:00 AM (your timezone: GST)  [Select]
   ● Tue 17 Jun — 02:00 PM (your timezone: GST)  [Select]
   ● Wed 18 Jun — 09:00 AM (your timezone: GST)  [Select]
   ```

6. **HR selects a slot** and clicks `[Confirm Schedule]`

**On confirmation:**
- `ExamSession` record is created in the database
- Proctor is automatically assigned to the session
- Magic link is generated (activates 30 minutes before scheduled start)
- **Invitation email is sent to the candidate** containing:
  - Company-branded header
  - Candidate's name
  - Assessment name
  - Date and time in candidate's local timezone
  - Estimated duration: approximately 1 hour 45 minutes
  - Pre-exam requirements (camera, internet, any required software)
  - System requirements
  - Magic link (activates 30 minutes before start)
  - HR contact email for queries
- **Reminder emails are queued:**
  - 24 hours before: reminder email to candidate
  - 1 hour before: reminder email + SMS to candidate
  - 15 minutes before: reminder to proctor (in-portal + email + SMS)
- Candidate status in table updates to "Scheduled"
- Toast notification: `"Assessment scheduled for Ahmed Al-Rashidi — Mon 16 Jun, 10:00 AM"`

---

### 4.5 Candidate Detail View

Clicking a candidate's name opens their full detail panel (right-side drawer or full page):

**Sections:**

1. **Personal Info** — all fields entered during add, with an Edit button
2. **Assessment Info** — assigned assessment, scheduled date/time, current status
3. **Timeline** — chronological activity log: Added → Scheduled → Invitation Sent → Reminder Sent → Session Completed → Report Published
4. **Report Summary** (if published) — overall score, pass/fail verdict, integrity score, `[View Full Report]` and `[⬇ Download PDF]` buttons
5. **Recording** (if available) — `[▶ Watch Recording]` button with days-remaining countdown
6. **Actions** — contextual buttons based on status (Schedule, Reschedule, View Report, Schedule Interview)

---

## 5. Tab 3 — Assessments Completed

This tab shows all candidates whose assessment sessions have been completed and whose reports have been published by the proctor.

> **Important:** HR sees ONLY published reports. Sessions where the proctor has not yet published the report do not appear here. HR will see the "pending" banner on the Overview tab instead.

### 5.1 Completed Assessments Table

**Table Columns:**

| Column | Description |
|--------|-------------|
| Candidate Name | Full name with link to candidate detail |
| Job Role | Position assessed for |
| Assessment Name | Name of the assessment conducted |
| Date Conducted | Date the session took place |
| MCQ Score | Score out of 100% for the MCQ section |
| Practical Score | Score out of 100% for the practical section |
| Overall Score | Weighted combined score |
| Pass / Fail | Clear PASS (green badge) or FAIL (red badge) |
| Integrity Score | 0–100, colour-coded: 🟢 90+ / 🟡 75–89 / 🟠 50–74 / 🔴 <50 |
| Report Published | Date and time the proctor published the report |
| Actions | `[View Report]` `[Watch Recording]` `[⬇ PDF]` `[Reschedule]` `[Schedule Interview]` |

**Filtering and Search:**
- Search by candidate name or job role
- Filter by: Pass/Fail, Date Range, Assessment Name, Integrity Score range
- Sort by: Score (highest/lowest), Date, Pass/Fail
- Bulk export: select multiple rows → `[⬇ Export Selected as PDF Bundle]` or `[⬇ Export as CSV]`

---

### 5.2 View Report — Full Report Modal / Page

Clicking `[View Report]` opens the full published report. This can render as:
- **In-portal HTML view** (default) — formatted, scrollable report with sections
- **PDF viewer** (embedded PDF reader within the portal)

**Report sections visible to HR:**

| Section | Content |
|---------|---------|
| Cover Page | Candidate name, assessment name, company name, date, assessexpert branding |
| Executive Summary | Overall score, pass/fail status, integrity score, one-line proctor verdict |
| MCQ Score Breakdown | Score per topic/domain; correct vs incorrect per area |
| Practical Assessment Results | Rubric scores, AI evaluation summary, practical quality verdict |
| Competency Radar Chart | Visual spider chart scored across 6–8 competency dimensions |
| Integrity Analysis | Integrity score breakdown, event timeline summary |
| Proctor Verdict & Narrative | Proctor's written assessment and professional recommendation |
| AI Recommendation | 2–3 paragraph AI-generated hiring recommendation |
| Suggested Interview Questions | 3–5 targeted questions based on candidate's weak areas |
| Verification QR Code | QR code linking to `verify.assessexpert.ae` for report authenticity check |

**Report actions:**
- `[⬇ Download PDF]` — download the signed, watermarked PDF
- `[Share Report Link]` — generates a time-limited secure link (optional, configurable)
- `[Print]` — browser print dialog

---

### 5.3 Watch Recording

Clicking `[Watch Recording]` opens the secure in-portal video player.

**Player features:**
- **Dual-pane view:** webcam feed (left pane) + candidate's screen (right pane), synchronised
- **Playback speed controls:** 0.5x / 1x / 1.5x / 2x
- **Chapter markers** on the timeline: Checklist Complete | MCQ Start | MCQ End | Practical Start | Practical End | Flagged Events
- **Retention countdown** prominently displayed above the player: `"⚠ Recording available for 5 more days — expires 21 Jun 2026"`
- **No download option** — stream only; download is disabled for all HR users
- Access is logged in the audit trail: user, timestamp, IP, duration watched

**After recording expires:**
- Button changes to: `"Recording Expired — Retention Period Ended (7 days)"`
- The report PDF remains permanently available

---

### 5.4 Reschedule Assessment

Available for candidates who:
- Failed the assessment (FAIL status)
- Did not attend (No-Show status)
- Had a technical failure during the session

**Trigger:** Click `[Reschedule]` in the completed assessments table or candidate detail view.

**Reschedule Modal:**
- Shows candidate name and previous assessment date
- Shows the reason for rescheduling (dropdown): Failed / No-Show / Technical Issue / Other
- Optional notes field
- Opens the same scheduling modal as the initial scheduling flow (Section 4.4)
- On confirmation, a new session is created and a new invitation email is sent

---

### 5.5 Schedule Interview

For candidates who have passed and are recommended for further evaluation.

**Trigger:** Click `[Schedule Interview]` in the completed assessments table.

**Interview Scheduling Popup:**

A modal with:
1. **Candidate name and score summary** shown at top for context
2. **Interview format:** In-Person / Video Call (on platform) / External Link
3. **Date & Time picker** — HR selects from their available slots
4. **Interviewers** — HR can add one or more interviewers from within their organisation (by email)
5. **Notes for candidate** — optional message to include in the interview invitation email
6. **`[Confirm Interview Schedule]`** button

On confirmation:
- Interview record created
- Candidate receives interview invitation email
- If "Video Call (on platform)" selected: a unique interview room link is generated (see Tab 4)
- Interviewer(s) receive calendar invitations

---

## 6. Tab 4 — Top Performers & Interview Panel

This tab is dedicated to managing top-scoring candidates and conducting interviews directly within the assessexpert platform.

### 6.1 Top Performers List

A curated list of candidates who are recommended for interview, sorted by:
- Overall assessment score (highest first)
- Integrity score (filter out candidates below a threshold)

**Table Columns:**

| Column | Description |
|--------|-------------|
| Rank | Position (1st, 2nd, 3rd, etc.) |
| Candidate Name | Full name |
| Job Role | Position they were assessed for |
| Overall Score | Combined MCQ + Practical score |
| MCQ Score | MCQ-specific percentage |
| Practical Score | Practical-specific percentage |
| Integrity Score | Colour-coded integrity rating |
| Proctor Verdict | One-line verdict from the proctor |
| Interview Status | Not Scheduled / Scheduled / Completed |
| Actions | `[View Report]` `[Schedule Interview]` `[Join Interview]` `[View Notes]` |

**Filtering:**
- Filter by: Job Role, Score Range (e.g., top 20%), Interview Status
- HR can set a minimum score threshold to display (e.g., only show candidates scoring 70%+)

---

### 6.2 Interview Room

When a video call interview has been scheduled using the platform, clicking `[Join Interview]` launches the built-in interview room.

**Interview Room Interface:**

The interview room opens as a full-screen overlay or dedicated page with:

**Video Panel (main area):**
- HR's camera feed (large, centred)
- Candidate's video feed displayed in a side panel or picture-in-picture

**Candidate Report Panel (right sidebar):**
- Candidate's name and photo (from ID capture during assessment)
- Assessment summary: Overall Score, MCQ Score, Practical Score, Integrity Score
- Proctor's verdict and narrative
- AI-suggested interview questions (from the published report) displayed as a prompt list
- HR can tick off questions as they ask them during the live interview

**Interview Notes Panel (bottom):**
- A live text area for HR to type notes during the interview
- Notes are saved automatically to the candidate's record

**Controls (bottom bar):**
- Mute / Unmute microphone
- Camera On / Off
- End Interview
- `[Record Interview]` toggle — if HR opts in, the interview is recorded and attached to the candidate's record

**On Interview End:**
- HR is prompted to fill in a brief post-interview form:
  - Overall impression: Excellent / Good / Average / Below Expectations
  - Recommendation: Proceed to Offer / Hold / Reject
  - Free-text notes (auto-filled from the interview notes panel)
- This post-interview summary is saved to the candidate's record alongside the assessment report

---

## 7. Tab 5 — Profile & Settings

### 7.1 Company Profile

HR Managers with appropriate permissions can manage their company's profile within the platform.

**Fields:**

| Field | Description |
|-------|-------------|
| Company Name | Displayed on all reports and candidate emails |
| Company Logo | Uploaded image (PNG/JPG, max 2MB) — appears on branded emails and report covers |
| Industry | Primary industry category |
| Country / Region | Used for timezone defaults and localisation |
| Company Website | Optional |
| Primary Contact Name | Name of the main HR contact |
| Primary Contact Email | Used for platform notifications |
| Primary Contact Phone | Optional |

---

### 7.2 User Management

HR Managers can invite additional users within their organisation:

**Invitable roles:**
- HR Manager (same level — can add/manage candidates, view reports)
- Hiring Manager (read-only — can view published reports only)

**Invite process:**
1. Click `[+ Invite User]`
2. Enter email address and select role
3. `[Send Invitation]`
4. Invitee receives a welcome email with a registration link
5. HR can see pending invitations and resend or revoke them
6. HR can deactivate existing users (removes access without deleting data)

---

### 7.3 Notification Preferences

HR can configure which notifications they receive and via which channel:

| Event | Email | In-Portal | SMS |
|-------|-------|-----------|-----|
| Report published | ✅ default | ✅ | Optional |
| Assessment scheduled | ✅ default | ✅ | Optional |
| Candidate no-show | ✅ default | ✅ | Optional |
| Recording expiring (24h warning) | ✅ default | ✅ | Optional |
| Interview scheduled | ✅ default | ✅ | Optional |

Each toggle is independently configurable.

---

### 7.4 Account Security

| Setting | Options |
|---------|---------|
| Change Password | Current password → New password → Confirm |
| Enable / Disable MFA | TOTP (Google Authenticator) or SMS OTP |
| Active Sessions | View all active login sessions with device + IP; button to terminate any session |
| Login History | Last 20 login events with timestamp, device, and IP |

---

### 7.5 Language & Display Preferences

| Setting | Options |
|---------|---------|
| Interface Language | English / Arabic (RTL layout switches automatically) |
| Timezone | Auto-detected or manually set |
| Date Format | DD/MM/YYYY / MM/DD/YYYY / YYYY-MM-DD |
| Theme | Dark (default) / Light (if enabled by Super Admin) |

---

## 8. Notification Center

A bell icon in the top navigation bar shows unread notification count.

**Notification types shown in-portal:**

| Notification | Trigger | Action Button |
|-------------|---------|---------------|
| Report Published | Proctor publishes a report | `[View Report]` |
| Assessment Scheduled | HR schedules a new session | `[View Schedule]` |
| Candidate No-Show | Candidate did not attend | `[Reschedule]` |
| Recording Expiring | 24 hours before 7-day expiry | `[Watch Now]` |
| Interview Reminder | 30 minutes before scheduled interview | `[Join Interview]` |
| Batch Import Complete | CSV import finishes processing | `[View Candidates]` |

Notifications are sorted newest first. Each can be marked as read or dismissed.

---

## 9. Connectivity & API Dependencies

### 9.1 APIs Consumed by HR Dashboard

| Feature | API Endpoint | Method |
|---------|-------------|--------|
| Load dashboard stats | `GET /api/hr/dashboard/stats` | REST |
| Load activity graph data | `GET /api/hr/dashboard/activity?range=30d` | REST |
| List candidates | `GET /api/hr/candidates` | REST |
| Add candidate | `POST /api/hr/candidates` | REST |
| Import candidates (CSV) | `POST /api/hr/candidates/import` | REST (multipart) |
| Get available slots | `GET /api/hr/scheduling/slots` | REST |
| Schedule assessment | `POST /api/hr/sessions/schedule` | REST |
| Reschedule assessment | `PUT /api/hr/sessions/{id}/reschedule` | REST |
| List completed reports | `GET /api/hr/reports` | REST |
| Get full report | `GET /api/hr/reports/{id}` | REST |
| Download PDF report | `GET /api/hr/reports/{id}/pdf` | REST |
| Get recording stream URL | `GET /api/hr/recordings/{sessionId}/url` | REST |
| Schedule interview | `POST /api/hr/interviews/schedule` | REST |
| Join interview room | WebSocket / WebRTC | Real-time |
| Get notifications | `GET /api/hr/notifications` + WebSocket | REST + Real-time |

### 9.2 Real-Time Events (WebSocket)

The HR dashboard maintains a persistent WebSocket connection for the following real-time events:

| Event | Payload | HR Dashboard Reaction |
|-------|---------|----------------------|
| `report.published` | `{candidateId, candidateName, score}` | New entry in Completed tab + notification bell |
| `session.noshow` | `{candidateId, candidateName}` | Status update in Candidates table + notification |
| `recording.expiring` | `{sessionId, hoursRemaining}` | Notification bell + banner on recording link |
| `interview.starting` | `{interviewId, candidateName}` | Toast notification + `[Join Now]` button |

### 9.3 Email System (Outbound — Triggered by HR Actions)

| Action | Email Sent To | Template |
|--------|-------------|---------|
| Assessment scheduled | Candidate | `CAND-INV` — Invitation with magic link, date, time, instructions |
| 24h before session | Candidate | `CAND-REM-24H` — Reminder |
| 1h before session | Candidate | `CAND-REM-1H` — Final reminder + SMS |
| Interview scheduled | Candidate + Interviewers | `INT-SCH` — Interview details and link |
| Report published | HR Manager | `RPT-PUB` — Report ready notification |
| Recording expiring | HR Manager | `REC-EXP` — 24h warning |

### 9.4 Data Isolation Enforcement (How It Works)

Every API call from the HR dashboard is authenticated with a JWT containing `organizationId`. The NestJS backend:

1. Validates the JWT on every request
2. Extracts `organizationId` from the token
3. Applies `WHERE organizationId = :currentOrgId` to every database query via Prisma middleware
4. S3 pre-signed URLs are generated only for files tagged with the requesting org's ID
5. WebSocket rooms are namespaced by `org:{organizationId}` — cross-org subscriptions are impossible

---

*Document: HR Dashboard Specification — assessexpert v1.0*
*Prepared: May 2026 | Platform: assessexpert.ae*
*"Every result verified. Every hire protected."*
