# assessexpert — Admin (Super Admin) Dashboard
## Complete Feature Specification Document

> **Portal:** `app.assessexpert.ae/admin`
> **Role:** Super Admin
> **Version:** 1.0
> **Classification:** Internal — Development & Engineering Team
> **Date:** May 2026
> **References:** See also → `Proctor_Dashboard.md` · `HR_Dashboard.md` · `ExamSetup_Master.md` · `Candidate_Environment.md`

---

## Table of Contents

1. [Role Overview & Access](#1-role-overview--access)
2. [Authentication & Login](#2-authentication--login)
3. [Tab 1 — Overview Dashboard (Home)](#3-tab-1--overview-dashboard-home)
4. [Tab 2 — Companies](#4-tab-2--companies)
5. [Tab 3 — Users](#5-tab-3--users)
6. [Tab 4 — Assessments Schedule](#6-tab-4--assessments-schedule)
7. [Tab 5 — Assessed Candidates & Reports](#7-tab-5--assessed-candidates--reports)
8. [Tab 6 — Assessment Types & Configuration](#8-tab-6--assessment-types--configuration)
9. [Tab 7 — Question Papers & Exam Content](#9-tab-7--question-papers--exam-content)
10. [Tab 8 — Settings](#10-tab-8--settings)
11. [Notification Center](#11-notification-center)
12. [Connectivity & API Dependencies](#12-connectivity--api-dependencies)

---

## 1. Role Overview & Access

The Super Admin is the highest-authority user of the assessexpert platform. They have unrestricted visibility across all companies, all users, all assessments, all reports, all question papers, and all platform configuration. They are the only role that can onboard companies, create user accounts, and manage assessment type definitions.

### 1.1 What Admin Can Do

| Capability | Description |
|-----------|-------------|
| View platform-wide analytics | All assessment data, sales data, graphs, and KPIs across every company |
| Manage companies | Add, edit, deactivate partner companies and their key contacts |
| Manage all user types | Create/edit/deactivate Proctors, HR Managers, Sales Agents, Exam Setup Masters, and other Admins |
| Monitor all assessments | View today's, upcoming, and past sessions across all companies |
| View all candidate reports | Read published reports and watch session recordings across all companies |
| Comment on reports | Leave admin comments on any report — comments are routed to the assigned proctor |
| Configure assessment types | Edit the catalogue of assessment types, their structure, duration, and scoring rules |
| Manage question papers | View, edit, and approve MCQ question papers and practical exam files |
| Full platform settings | Control all system-level configuration, feature flags, integrations, and compliance settings |

### 1.2 What Admin Cannot Do

| Restriction | Reason |
|------------|--------|
| Cannot join a live assessment session | The Admin has no operational role in a live exam — that is the Proctor's function |
| Cannot edit a published report directly | Report edits are Proctor's responsibility; Admin can comment to trigger a proctor review |
| Cannot see unpublished AI draft reports | Draft reports are only accessible to the assigned Proctor before publication |
| Cannot process a payment or invoice | All billing is handled offline by the Sales team — no payment module exists |

---

## 2. Authentication & Login

### 2.1 Login Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| Email + Password | ✅ | bcrypt 12 rounds |
| MFA — TOTP | ✅ **Mandatory** | Google Authenticator or Authy |
| MFA — SMS OTP | ✅ | Fallback only |
| Google OAuth | ❌ | Not permitted for Admin — strict auth required |
| Microsoft OAuth | ❌ | Not permitted for Admin |

### 2.2 MFA is Mandatory for All Admins

MFA cannot be disabled for the Super Admin role under any circumstances. Every login requires:
1. Email + password
2. 6-digit TOTP or SMS OTP code
3. Access granted

### 2.3 Session Management

- Admin sessions time out after 4 hours of inactivity
- Concurrent sessions from different IPs generate an immediate security alert
- All admin login events are written to the immutable audit log with IP, device, and timestamp

---

## 3. Tab 1 — Overview Dashboard (Home)

This is the Admin's landing screen after login. It provides a real-time, platform-wide command view of all platform activity, assessment health, and sales performance.

### 3.1 Platform-Wide Summary Stat Cards (Top Row)

Eight stat cards displayed in two rows of four:

**Row 1 — Assessment Operations:**

| Card | Value | Colour |
|------|-------|--------|
| Total Assessments (All Time) | Cumulative across all companies | Neutral / Blue |
| Assessments This Month | Sessions conducted in current month | Blue |
| Live Sessions Right Now | Count of sessions currently in progress | Cyan pulse |
| Reports Pending Proctor Review | Sessions complete but unpublished | Amber |

**Row 2 — Business Metrics:**

| Card | Value | Colour |
|------|-------|--------|
| Total Active Companies | Companies currently onboarded and active | Green |
| Total Registered Users | All user accounts across all roles | Neutral |
| Total Candidates Assessed (All Time) | Cumulative candidate records | Neutral |
| Overall Platform Pass Rate | % of all candidates who passed across all sessions | Green/Red dynamic |

Each card displays:
- Large animated CountUp number on page load
- Sub-label describing the metric
- Month-over-month trend arrow ↑ / ↓ with percentage change
- Clicking any card deep-links to the relevant filtered view in the appropriate tab

---

### 3.2 Assessment Activity Graph (Platform-Wide)

A line/bar combo chart showing platform-wide session volume:

- **X-axis:** Date — selectable range: Today / 7 Days / 30 Days / 3 Months / 12 Months / Custom Range
- **Y-axis:** Number of assessment sessions
- **Lines shown:**
  - Scheduled (dashed, blue)
  - Completed (solid, green)
  - Pending Report (solid, amber)
  - No-Show (dashed, grey)
- Filter by **Company** (dropdown — show only selected company's data)
- Filter by **Assessment Type** (dropdown)
- Hover tooltip: `"14 Jun — 12 Completed, 3 Pending, 1 No-Show"`
- Clicking a data point filters Tab 4 (Schedule) to sessions on that date

---

### 3.3 Sales Performance Graph

A dedicated sales and business metrics section — visible only to Admin:

**Sales Activity Line Chart:**
- X-axis: Date (last 12 months)
- Y-axis: Number of new companies onboarded
- A second Y-axis overlay showing total assessments sold (credit volume)
- Hover shows: `"Mar 2026 — 3 new companies, 240 assessment credits sold"`

**Revenue Estimate Panel (Offline):**
> Note: No payment module exists. These figures are manually entered by Admin or synced from the offline CRM system.

| Metric | Value | Period |
|--------|-------|--------|
| Estimated MRR | AED [value] | Current month |
| YTD Contracts | [count] companies | This year |
| Assessment Credits Consumed | [count] | This month |
| Renewals Due (Next 30 Days) | [count] companies | Upcoming |

**Company Growth Bar Chart:**
- One bar per month (last 12 months)
- Height = new companies onboarded that month
- Stacked: Active (green) vs Churned (red)

**Assessment Type Distribution Donut Chart:**
- Each segment = one assessment type
- Segment size = % of all assessments conducted using that type
- Hover shows assessment name, count, percentage

---

### 3.4 Live Sessions Monitor Panel

A real-time panel showing all currently active exam sessions across all companies:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔴 LIVE SESSIONS — 3 ACTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ● Ahmed Al-Rashidi  |  BIM Coordinator L2  |  TechCorp LLC
    Phase: MCQ  |  Time Remaining: 18:32  |  Proctor: Sarah K.
    Flags: 0  |  Status: 🟢 Clean

  ● James Walker  |  Network Engineer  |  GlobalHire DMCC
    Phase: Practical  |  Time Remaining: 44:10  |  Proctor: Omar N.
    Flags: 2  |  Status: 🟡 Monitoring
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- Updates via WebSocket in real time
- Admin can see session status but cannot join or interfere with any live session
- Clicking a session row opens a read-only session summary panel (company, candidate, proctor, elapsed time, AI flag count)

---

### 3.5 Recent Activity Feed

A scrollable activity log on the right side of the screen showing platform-wide events, newest first:

- `"Report published — Ahmed Al-Rashidi — BIM Coordinator — TechCorp LLC"` → [View]
- `"New company onboarded — GlobalHire DMCC"` → [View Company]
- `"Session terminated by Proctor — James Walker — Flagged"` → [View Report]
- `"New user created — Proctor — Omar Nasser"` → [View User]
- `"Assessment Type updated — AutoCAD Draftsman L1"` → [View Assessment]

---

## 4. Tab 2 — Companies

This is the central hub for managing all partner companies (clients) that use the platform.

### 4.1 Company List View

A searchable, filterable table of all onboarded companies:

**Table Columns:**

| Column | Description |
|--------|-------------|
| Company Name | Legal entity name |
| Industry | e.g., Engineering, Finance, IT, Healthcare |
| Country | Registered country of operation |
| HR Contact | Primary HR Manager name and email |
| Manager Contact | Company manager / Director name and phone |
| Active Users | Count of active HR user accounts |
| Total Assessments | Cumulative sessions conducted |
| Status | Active / Suspended / Pending Setup |
| Contract Expiry | Date the current agreement expires |
| Actions | [View] [Edit] [Suspend] [Deactivate] |

**Filter Options:**
- Search by company name or email
- Filter by industry
- Filter by country
- Filter by status (Active / Suspended / All)
- Filter by contract expiry window (Next 30 days / Next 90 days)

---

### 4.2 Add New Company

Clicking `[+ Add Company]` opens a full-page form to onboard a new partner company.

**Section 1 — Company Identity:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Company Name | Text | ✅ | Legal entity name |
| Trading Name | Text | Optional | If different from legal name |
| Industry | Dropdown | ✅ | Multi-select from predefined list |
| Company Size | Dropdown | ✅ | 1–50 / 51–200 / 201–1000 / 1000+ employees |
| Country | Dropdown | ✅ | ISO country list |
| City | Text | ✅ | Primary office city |
| Company Website | URL | Optional | |
| Company Logo | File upload | Optional | PNG/JPG max 2MB — used on reports and emails |
| Tax Registration Number | Text | Optional | For contract/billing records |
| Company Address | Textarea | ✅ | Full registered address |

**Section 2 — Key Contacts:**

| Contact Type | Fields | Notes |
|-------------|--------|-------|
| Primary Manager | Full Name, Job Title, Phone, Email | Senior company contact — receives renewal notices |
| HR Manager (Primary) | Full Name, Job Title, Phone, Email | Gets their HR portal login automatically on submit |
| HR Manager (Secondary) | Full Name, Job Title, Phone, Email | Optional second HR account |
| Billing Contact | Full Name, Email, Phone | For offline invoice/renewal communication |
| Technical Contact | Full Name, Email | For IT/integration support queries |

**Section 3 — Contract & Assessment Configuration:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Contract Start Date | Date picker | ✅ | |
| Contract End Date | Date picker | ✅ | Renewal alert triggers at 90 and 30 days before |
| Assessment Credit Quota | Number | ✅ | Total assessments included in contract |
| Credits Used | Auto-calculated | Read-only | Auto-increments as sessions are conducted |
| Allowed Assessment Types | Multi-select | ✅ | Which assessment types this company can use |
| Max Concurrent Sessions | Number | ✅ | Platform enforces this cap |
| Reporting Language | English / Arabic | ✅ | Language for generated PDF reports |
| Data Retention Override | Days | Optional | Default is 7 days for recordings; can be extended per contract |

**Section 4 — Notes:**

| Field | Type | Notes |
|-------|------|-------|
| Internal Notes | Rich text area | Admin-only notes about this company — not visible to HR |
| Sales Agent | Dropdown | Which sales agent manages this account |
| Account Tier | Dropdown | Standard / Premium / Enterprise |

**On Submit:**
1. Company record created in the database
2. Primary HR Manager receives a welcome email with portal login link and credentials
3. Secondary HR Manager (if provided) receives the same
4. Admin sees a confirmation panel: company created, HR accounts created, emails sent
5. Company appears in the Companies list immediately

---

### 4.3 View / Edit Company

Clicking `[View]` on any company opens the full company profile in a tabbed sub-view:

**Sub-tab: Overview**
- All company details (from Add form) displayed in read-only mode with `[Edit]` button
- Assessment credit usage bar: `Used 47 / 100 credits (47%)`
- Contract status badge: Active / Expiring Soon / Expired

**Sub-tab: HR Users**
- List of all HR accounts under this company
- Status (Active / Inactive), last login date
- `[Invite New HR]` button to add additional HR accounts
- `[Deactivate]` per user

**Sub-tab: Assessment History**
- Table of all sessions this company has conducted (same columns as Tab 4)
- Export to CSV / PDF

**Sub-tab: Notes**
- Internal admin notes with timestamped entries
- Audit trail of all admin actions on this company account

---

### 4.4 Suspend / Deactivate Company

- **Suspend:** Company and all associated HR accounts are locked. Existing data preserved. Candidates cannot receive magic links. Pending sessions must be manually resolved.
- **Deactivate:** Soft-delete — company marked inactive. Data retained per retention policy. Cannot be reinstated without Super Admin action.

Both actions require Admin to type a confirmation phrase and provide a reason (logged in audit trail).

---

## 5. Tab 3 — Users

The central user management interface for all non-candidate accounts across the platform.

### 5.1 User List View

A searchable, filterable table of all registered users across all roles:

**Table Columns:**

| Column | Description |
|--------|-------------|
| Name | Full name |
| Email | Login email |
| Role | Proctor / HR Manager / Sales Agent / Exam Setup Master / Admin |
| Company | Associated company (blank for internal roles like Proctor, Sales, Admin) |
| Status | Active / Inactive / Pending First Login |
| Last Login | Timestamp of most recent login |
| MFA | Enabled / Disabled (Admin and Proctor always show Enabled) |
| Actions | [View] [Edit] [Deactivate] [Reset Password] |

**Filter Options:**
- Search by name or email
- Filter by role
- Filter by company
- Filter by status
- Filter by MFA status

---

### 5.2 Add New User

Clicking `[+ Add User]` opens a smart form. The form fields dynamically change based on the selected **User Role**.

**Step 1 — Select Role:**

```
[ Proctor ]  [ HR Manager ]  [ Sales Agent ]  [ Exam Setup Master ]  [ Admin ]
```

Selecting a role reveals the appropriate fields below.

---

#### Form: Add Proctor

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Full Name | Text | ✅ | |
| Email Address | Text | ✅ | Login email |
| Phone Number | Text | ✅ | Used for SMS OTP |
| Profile Photo | File upload | Optional | PNG/JPG |
| Certification Level | Dropdown | ✅ | Junior / Senior / Lead Proctor |
| Certification Domains | Multi-select | ✅ | Assessment types this proctor is certified for (from assessment catalogue) |
| Languages | Multi-select | ✅ | Languages proctor can conduct briefings in |
| Working Timezone | Dropdown | ✅ | All scheduling calculations use this |
| Max Sessions Per Day | Number | ✅ | Platform scheduling cap for this proctor |
| Notes | Textarea | Optional | Internal notes visible to Admin only |

On submit:
- Proctor account created
- Welcome email sent with portal link and temporary password
- MFA setup forced on first login

---

#### Form: Add HR Manager

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Full Name | Text | ✅ | |
| Email Address | Text | ✅ | |
| Phone Number | Text | Optional | |
| Job Title | Text | Optional | |
| Company | Dropdown | ✅ | Select from active companies |
| Role Level | Dropdown | ✅ | HR Manager (full access) / Hiring Manager (read-only) |
| Notes | Textarea | Optional | |

On submit:
- HR account created and linked to selected company
- Welcome email sent with portal link

---

#### Form: Add Sales Agent

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Full Name | Text | ✅ | |
| Email Address | Text | ✅ | |
| Phone Number | Text | ✅ | |
| Region | Dropdown | ✅ | Geographic territory — GCC / MENA / Europe / Global |
| Target — Monthly New Companies | Number | Optional | For tracking against sales KPIs in dashboard |
| Notes | Textarea | Optional | |

On submit:
- Sales Agent account created
- Welcome email with Sales panel access link sent

---

#### Form: Add Exam Setup Master

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Full Name | Text | ✅ | |
| Email Address | Text | ✅ | |
| Phone Number | Text | ✅ | |
| Specialist Domains | Multi-select | ✅ | Assessment types this person is responsible for setting up |
| Access Level | Dropdown | ✅ | Full Setup Access / Domain-Restricted |
| Notes | Textarea | Optional | |

On submit:
- Exam Setup Master account created
- Welcome email with Exam Setup portal link sent
- See `ExamSetup_Master.md` for full Exam Setup Master dashboard specification

---

#### Form: Add Admin

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Full Name | Text | ✅ | |
| Email Address | Text | ✅ | |
| Phone Number | Text | ✅ | Required for mandatory MFA |
| Admin Level | Dropdown | ✅ | Super Admin / Operations Admin / Read-Only Admin |
| Notes | Textarea | Optional | |

On submit:
- Admin account created
- MFA setup forced on first login
- Welcome email sent

---

### 5.3 Edit User

Clicking `[Edit]` on any user opens the same form pre-filled with current data. All fields are editable by Admin. Changes are logged in the audit trail.

### 5.4 Deactivate User

Deactivating a user immediately invalidates all their active sessions and tokens. Their data and history are retained. They cannot log in. Admin must provide a reason (logged in audit trail).

### 5.5 Reset Password

Sends the user a password reset email. Admin cannot see or set a specific password — password reset is always user-initiated via email link.

---

## 6. Tab 4 — Assessments Schedule

A complete view of all assessment sessions across the platform — past, present, and future.

### 6.1 Session View Controls

**View Modes:**
- `[Today]` — All sessions scheduled for today, grouped by time slot
- `[Upcoming]` — All future sessions (next 30 days by default)
- `[Past]` — Historical completed/cancelled sessions
- `[All]` — Unified table view, sortable and filterable

**Filter Options (applied in any view):**
- Company (dropdown — all companies or specific one)
- Assessment Type
- Proctor
- Status: Scheduled / In Progress / Completed / No-Show / Cancelled / Pending Report
- Date Range (custom date picker)

---

### 6.2 Grouped Session View (Today / Upcoming)

Sessions are displayed grouped by assessment session group (as assigned by the Proctor system):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋  SESSION GROUP: BIM Coordinator L2
  Company: TechCorp LLC  |  Proctor: Sarah K.  |  14 Jun 2026, 10:00 AM
  Candidates: 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Name                  Status          Score
  Ahmed Al-Rashidi      ✅ Completed    82%
  Fatima Hassan         🔄 In Progress  —
  John Matthews         ⏳ Scheduled    —
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- Admin can see every session group and all candidates within
- **Admin cannot join any live session** — no "Join" button is shown; this is a monitoring view only
- Clicking a candidate row opens a read-only candidate summary panel

---

### 6.3 Session Detail Panel (Read-Only)

Clicking any candidate within a session group opens a detail panel:

| Field | Value |
|-------|-------|
| Candidate Name | Full name |
| Company | Linked company name |
| Assessment Type | e.g., BIM Coordinator L2 |
| Proctor | Assigned proctor name |
| Session Status | Current status badge |
| Scheduled Time | Date and time |
| Actual Start Time | When proctor began the session |
| MCQ Score | If completed |
| Practical Score | If completed |
| Integrity Score | If session is complete |
| Report Status | Pending / Published |
| AI Flags | Count of flagged events |

Admin cannot edit or modify anything in this panel — it is strictly read-only.

---

## 7. Tab 5 — Assessed Candidates & Reports

A complete, searchable record of all assessed candidates and their reports across all companies.

### 7.1 Assessed Candidates List

**Table Columns:**

| Column | Description |
|--------|-------------|
| Candidate Name | Full name |
| Company | Which company they were assessed for |
| Assessment Type | What exam they took |
| Proctor | Who conducted the session |
| Assessment Date | When the session occurred |
| MCQ Score | Score on MCQ section (%) |
| Practical Score | Score on practical section (%) |
| Overall Score | Combined score (%) |
| Integrity Score | 0–100 integrity rating |
| Verdict | Pass / Fail / Incomplete |
| Report Status | Published / Pending |
| Recording | Available / Expired |
| Actions | [View Report] [Watch Recording] [Comment] |

**Filter Options:**
- Company
- Assessment Type
- Date Range
- Verdict (Pass / Fail / Incomplete)
- Proctor
- Report Status

**Export:** CSV export of filtered results. PDF batch export of selected reports.

---

### 7.2 Report View (Read-Only)

Clicking `[View Report]` opens the full published report in a read-only viewer. The report view includes all sections:

- Candidate personal details and ID photo
- MCQ section: score, question-by-question breakdown, performance analysis
- Practical section: score, evaluator notes, file submission (if applicable)
- AI-generated performance narrative
- Integrity report: score, flag list, AI monitoring summary
- Proctor's verdict and narrative
- Digital signature and QR verification code

**Admin cannot edit any field in the published report.** The report is shown exactly as published by the proctor.

---

### 7.3 Recording Player (Admin View)

Clicking `[Watch Recording]` opens the dual-pane recording player:

- **Left pane:** Candidate webcam feed
- **Right pane:** Screen recording (GuardPro-captured)
- Timeline with chapter markers: Session Start / MCQ Begin / Practical Begin / Practical Submit / Session End
- AI flag markers on the timeline (clicking jumps to that moment)
- Playback speed: 1x / 1.5x / 2x

Admin can watch any recording within the 7-day retention window. After 7 days, the recording is automatically purged (S3 lifecycle policy) and the `[Watch Recording]` button shows `[Expired]`.

---

### 7.4 Admin Comment on Report

Admin can click `[Comment]` on any published report to leave an administrative comment:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  💬  ADD ADMIN COMMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Comment Type:   [ General ]  [ Correction Request ]  [ Flag for Review ]

  Message to Proctor:
  ┌────────────────────────────────────────────┐
  │ [text area — min 20 characters]            │
  └────────────────────────────────────────────┘

  [ Cancel ]                        [ Send to Proctor ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- Comment is sent to the assigned proctor as a notification
- Proctor sees the comment in their dashboard and can respond or take action
- All comments and responses are saved to the report's audit trail
- HR does not see admin comments — they are strictly internal

---

## 8. Tab 6 — Assessment Types & Configuration

This is the master catalogue of all assessment types that assessexpert offers. The Exam Setup Master uses this as the source of truth. Admin can view and edit.

> **Note:** Deep content management (question papers, practical files) is handled in Tab 7 and the `ExamSetup_Master.md` portal. This tab manages the structural configuration of each assessment type.

### 8.1 Assessment Types List

A table of all defined assessment types:

| Column | Description |
|--------|-------------|
| Assessment Name | e.g., BIM Coordinator L2, AutoCAD Draftsman L1, Python Developer, Network Engineer |
| Category | Engineering / IT / Finance / Healthcare / Hospitality / General |
| Exam Structure | MCQ Only / MCQ + Practical / Practical Only |
| MCQ Count | Number of MCQ questions |
| MCQ Duration | Duration in minutes |
| Practical Type | None / CAD File Upload / Coding / Lab / Other |
| Practical Duration | Duration in minutes |
| Passing Threshold — MCQ | Minimum % to pass MCQ section |
| Passing Threshold — Practical | Minimum % to pass practical section |
| Status | Active / Draft / Archived |
| Last Updated | Date and editor |
| Actions | [View] [Edit] [Archive] |

---

### 8.2 Add / Edit Assessment Type

Clicking `[+ Add Assessment Type]` or `[Edit]` opens the Assessment Configuration Form:

**Section 1 — Identity:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Assessment Name | Text | ✅ | Full descriptive name |
| Short Code | Text | ✅ | e.g., BIM-L2, ACAD-L1, PY-DEV — used internally |
| Category | Dropdown | ✅ | Engineering / IT / Finance / Healthcare / Hospitality / Manufacturing / General |
| Industry Tags | Multi-select | Optional | For filtering and assignment |
| Description | Textarea | ✅ | Shown to HR when selecting assessment type for a candidate |
| Status | Dropdown | ✅ | Draft / Active / Archived |

**Section 2 — Exam Structure:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Has MCQ Section | Toggle | ✅ | Yes / No |
| Number of MCQ Questions | Number | If MCQ = Yes | Platform always delivers exactly this many questions per session |
| MCQ Question Pool Size | Number | If MCQ = Yes | Total questions in pool — random selection per session |
| MCQ Duration (minutes) | Number | If MCQ = Yes | Server-enforced timer |
| MCQ Pass Threshold (%) | Number | If MCQ = Yes | Minimum score to pass MCQ section |
| Has Practical Section | Toggle | ✅ | Yes / No |
| Practical Type | Dropdown | If Practical = Yes | CAD File Upload / BIM File Upload / Coding / Network Lab / Written / Presentation / Other |
| Practical Duration (minutes) | Number | If Practical = Yes | Server-enforced timer |
| Practical Pass Threshold (%) | Number | If Practical = Yes | Minimum score to pass practical section |
| Practical File Types Accepted | Multi-select | If Practical = Yes | e.g., .dwg / .rvt / .ifc / .py / .js / .xlsx / .pdf |
| Practical Max File Size (MB) | Number | If Practical = Yes | |

**Section 3 — Scoring Configuration:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| MCQ Weight (%) | Number | If both sections | How much MCQ contributes to overall score |
| Practical Weight (%) | Number | If both sections | Must sum to 100% with MCQ weight |
| Overall Pass Logic | Dropdown | ✅ | Both sections must pass / Either section pass / Overall % only |
| Overall Pass Threshold (%) | Number | ✅ | Minimum combined score for a Pass verdict |
| Integrity Score Minimum | Number | Optional | Sessions below this score trigger automatic proctor review flag |

**Section 4 — GuardPro Exam Security:**

| Field | Type | Notes |
|-------|------|-------|
| Require GuardPro | Toggle | Yes / No — if Yes, candidate cannot start without GuardPro running |
| Blocked Applications | Multi-select | Predefined list of blocked processes (e.g., Teamviewer, AnyDesk, Discord, OBS) |
| Block Multi-Monitor | Toggle | Yes / No |
| Block Virtual Machines | Toggle | Yes / No |
| Allow Clipboard | Toggle | Yes (restricted) / No (full block) |

**Section 5 — Practical Task Bank:**

| Field | Type | Notes |
|-------|------|-------|
| Number of Practical Tasks in Pool | Number | Proctor selects one per session |
| Allow Proctor to Choose Task | Toggle | Yes / No — if No, task is randomly auto-assigned |

**On Save:**
- If status is Active, the assessment type is immediately available for HR scheduling
- If status is Draft, it appears in Admin view but cannot be assigned to candidates
- All changes logged in audit trail with before/after values

---

## 9. Tab 7 — Question Papers & Exam Content

This tab gives Admin full visibility into all question papers and practical exam files, organised by assessment type. Admin can view and modify content. The primary creators and maintainers of question papers are the **Exam Setup Masters** (see `ExamSetup_Master.md`).

### 9.1 Question Paper Browser

A two-panel layout:

**Left Panel — Assessment Type Navigator:**
- Tree list of all assessment types (grouped by category)
- Selecting an assessment type loads its exam content in the right panel
- Badge showing: `MCQ: 85 questions in pool` and `Practical: 6 tasks`

**Right Panel — Exam Content View:**

**MCQ Tab:**

| Column | Description |
|--------|-------------|
| Q# | Question number |
| Question Text | First 80 characters of the question |
| Type | Single Choice / Multiple Choice / True-False |
| Difficulty | Easy / Medium / Hard |
| Domain/Tag | Skill area (e.g., Structural, Electrical, Python Loops) |
| Status | Active / Archived |
| Actions | [View & Edit] [Archive] |

**Practical Tab:**

| Column | Description |
|--------|-------------|
| Task # | Task reference number |
| Task Title | e.g., "Column Footing Shop Drawing" |
| Task Description | Brief description |
| File | Source practical file (DWG / RVT / IFC / etc.) — [View File] |
| Marking Criteria | [View Criteria] |
| Difficulty | Standard / Advanced |
| Status | Active / Archived |
| Actions | [View & Edit] [Archive] |

---

### 9.2 Edit MCQ Question

Clicking `[View & Edit]` on any MCQ question opens the question editor:

**Fields:**
- Question Text (rich text — supports LaTeX, images, code blocks)
- Answer Options A / B / C / D / E (text each)
- Correct Answer(s) — single select or multi-select depending on question type
- Explanation — shown in report's question breakdown to proctor
- Difficulty Level
- Domain / Tag(s) — multi-select skill tags
- Status: Active / Archived

**On Save:** Changes saved with editor ID and timestamp. Previous version preserved in question version history (audit trail). If the question is Active, the updated version is immediately used in new sessions (in-progress sessions use the version locked at session start).

---

### 9.3 Edit Practical Task

Clicking `[View & Edit]` on any practical task opens the practical task editor:

**Fields:**
- Task Title
- Task Description (rich text — candidate-facing instructions)
- Practical File: View existing file / Upload replacement file
  - Supported: .dwg / .rvt / .ifc / .dxf / .xlsx / .pdf / .zip
- Marking Criteria (rich text — proctor-facing evaluation guide)
- Evaluator Notes (what the ideal submission looks like)
- Difficulty Level
- Estimated Completion Time (minutes)
- Status: Active / Archived

**File Handling:**
- Uploading a replacement file retains the old file in version history
- New file is virus-scanned before storage
- Files stored in S3 with restricted access — only Proctor and Admin can access practical source files

---

### 9.4 Add New MCQ Question

Clicking `[+ Add MCQ Question]` opens the question creation form — same fields as the edit form. After save:
- Question enters Draft status
- Exam Setup Master and Admin must both approve before it enters Active pool
- Approval workflow: `Draft → Admin Review → Active`

---

### 9.5 Add New Practical Task

Clicking `[+ Add Practical Task]` opens the task creation form. Same approval workflow as MCQ questions applies.

---

## 10. Tab 8 — Settings

The full platform configuration hub — only accessible to Super Admin.

### 10.1 Platform General Settings

| Setting | Options | Notes |
|---------|---------|-------|
| Platform Name | Text | Displayed in email headers and PDFs |
| Platform URL | Text | e.g., app.assessexpert.ae |
| Support Email | Text | |
| Support Phone | Text | |
| Default Language | English / Arabic | Global fallback |
| Default Timezone | Dropdown | Platform default (individual users can override) |
| Platform Logo | File upload | Used in emails and PDF headers |
| Maintenance Mode | Toggle | Takes down all portals except Admin |

---

### 10.2 Exam & Session Global Rules

| Setting | Options | Notes |
|---------|---------|-------|
| Recording Retention Period | 7 days (default) | Can be overridden per company contract |
| FR Image Retention Period | 90 days (default) | Cannot be reduced below 90 days |
| Max Concurrent Sessions (Global) | Number | Hard cap across all companies |
| Session Timeout (inactivity) | Minutes | Candidate inactive for N minutes = auto-terminate |
| Proctor Session Join Window | Minutes | Proctor can join N minutes before scheduled start |
| GuardPro Mandatory (Global) | Toggle | If On, overrides per-assessment setting — all exams require GuardPro |

---

### 10.3 Notification & Communication Settings

| Setting | Options | Notes |
|---------|---------|-------|
| Email Provider | AWS SES | API key management |
| SMS Provider | Twilio | Twilio account SID and auth token |
| Notification Templates | [Manage Templates] | Opens template editor for all 25+ email/SMS templates |
| WhatsApp Integration | Toggle | Enable/disable WhatsApp via Twilio |
| Slack Integration | Toggle | Sales team new lead notifications |
| Slack Webhook URL | Text | Paste Slack incoming webhook |

---

### 10.4 AI & Proctoring Settings

| Setting | Options | Notes |
|---------|---------|-------|
| Facial Recognition Provider | AWS Rekognition (default) | |
| FR Similarity Threshold | % (default: 78%) | Minimum % for a passing FR check |
| FR Check Interval | Seconds (default: 90s) | How often periodic FR checks run during exam |
| Face Absence Alert Threshold | Seconds (default: 8s) | How long face can be absent before AI alerts proctor |
| Gaze Off-Screen Alert Count | Number (default: 4) | Number of gaze-off events before alert |
| AI Report Generation Model | GPT-4o (default) | Model used for narrative generation |
| AI Report Confidence Minimum | % (default: 70%) | If confidence < threshold, proctor is flagged to manually review that section |

---

### 10.5 Security & Compliance

| Setting | Options | Notes |
|---------|---------|-------|
| Session Token Expiry | Hours | JWT validity period |
| Admin Session Timeout | Hours (default: 4h) | After N hours of inactivity, Admin is logged out |
| Proctor Session Timeout | Hours (default: 8h) | |
| IP Allowlist (Admin Login) | IP range list | Restrict Admin logins to specific IPs |
| Audit Log Retention | Years | Immutable audit log retention period |
| GDPR / PDPL Mode | Toggle | Enables full consent logging and DSAR workflow |
| Data Export (DSAR) | [Manage Requests] | View and process Data Subject Access Requests |
| Consent Form Version | Text | Current version number — change triggers re-consent from all candidates |

---

### 10.6 Feature Flags

A toggle panel for enabling/disabling platform features globally or per company tier:

| Feature | Global Default | Per-Company Override |
|---------|---------------|---------------------|
| Interview Room | Enabled | Yes |
| WhatsApp Notifications | Disabled | Yes |
| SAML / SSO Login | Disabled | Yes (Enterprise only) |
| Cloud VDI (Lab Mode) | Disabled | Yes (Phase 2) |
| Arabic RTL Interface | Enabled | — |
| Light Theme | Disabled | — |
| Batch CSV Import | Enabled | — |
| Auto-Scheduling Engine | Enabled | — |

---

### 10.7 Audit Log Viewer

A searchable, immutable log of all significant platform events:

**Filter Options:**
- Date range
- User (any user across all roles)
- Event type (Login / Report Published / Company Created / User Created / Question Modified / etc.)
- Company

**Table Columns:**

| Column | Description |
|--------|-------------|
| Timestamp | UTC datetime |
| User | Name and role |
| Event | Action taken |
| Target | What was affected (candidate ID, report ID, company ID, etc.) |
| IP Address | Source IP |
| Before / After | For modification events, the values before and after |
| Hash | SHA-256 chain hash — verifies log integrity |

Export: Full log export to CSV for compliance purposes.

---

## 11. Notification Center

A bell icon in the Admin navigation bar shows unread notification count.

| Notification | Trigger | Action Button |
|-------------|---------|---------------|
| New company lead from website | Contact Us form submitted | `[View Lead]` |
| Contract expiring in 30 days | Automated 30-day alert | `[View Company]` |
| Session terminated by proctor | Proctor terminates a session | `[View Session]` |
| Report published | Any proctor publishes any report | `[View Report]` |
| System error / queue failure | Backend alert | `[View Logs]` |
| New user registered | Any new user created | `[View User]` |
| Exam content modified | Question or practical task edited | `[View Change]` |
| GuardPro update available | New GuardPro version | `[Manage]` |

Notifications are sorted newest first. Configurable per Admin — any notification type can be muted.

---

## 12. Connectivity & API Dependencies

### 12.1 Admin APIs

| Feature | Endpoint | Method |
|---------|----------|--------|
| Platform dashboard stats | `GET /api/admin/dashboard/stats` | REST |
| Sales performance data | `GET /api/admin/dashboard/sales` | REST |
| List companies | `GET /api/admin/companies` | REST |
| Create company | `POST /api/admin/companies` | REST |
| Update company | `PUT /api/admin/companies/{id}` | REST |
| Suspend company | `POST /api/admin/companies/{id}/suspend` | REST |
| List all users | `GET /api/admin/users` | REST |
| Create user | `POST /api/admin/users` | REST |
| Update user | `PUT /api/admin/users/{id}` | REST |
| Deactivate user | `POST /api/admin/users/{id}/deactivate` | REST |
| List all sessions | `GET /api/admin/sessions` | REST |
| Session detail | `GET /api/admin/sessions/{id}` | REST |
| List all reports | `GET /api/admin/reports` | REST |
| View report | `GET /api/admin/reports/{id}` | REST |
| Add admin comment | `POST /api/admin/reports/{id}/comments` | REST |
| List assessment types | `GET /api/admin/assessment-types` | REST |
| Create/update assessment type | `POST/PUT /api/admin/assessment-types/{id}` | REST |
| List MCQ questions | `GET /api/admin/questions?assessmentTypeId={id}` | REST |
| Create/update MCQ question | `POST/PUT /api/admin/questions/{id}` | REST |
| List practical tasks | `GET /api/admin/practical-tasks?assessmentTypeId={id}` | REST |
| Create/update practical task | `POST/PUT /api/admin/practical-tasks/{id}` | REST |
| Get audit log | `GET /api/admin/audit-log` | REST |
| Platform settings | `GET/PUT /api/admin/settings` | REST |
| Feature flags | `GET/PUT /api/admin/feature-flags` | REST |

### 12.2 Real-Time WebSocket Events (Admin)

| Event | Description | Admin Reaction |
|-------|-------------|----------------|
| `session.started` | Any session goes live | Live sessions counter updates |
| `session.ended` | Any session concludes | Live sessions counter updates |
| `session.terminated` | Proctor terminates a session | Notification + session status updates |
| `report.published` | Any report published | Notification |
| `system.alert` | Backend queue failure or error | Alert notification |

---

*Document: Admin (Super Admin) Dashboard Specification — assessexpert v1.0*
*Prepared: May 2026 | Platform: assessexpert.ae*
*See also: `Proctor_Dashboard.md` | `HR_Dashboard.md` | `ExamSetup_Master.md` | `Candidate_Environment.md` | `Assessexpert_Platform_Development.md`*
*"Every result verified. Every hire protected."*
