# assessexpert — Master Proctor Dashboard
## Complete Feature Specification Document

> **Portal:** `app.assessexpert.ae/master-proctor`
> **Role:** Master Proctor
> **Version:** 1.0
> **Classification:** Internal — Development & Engineering Team
> **Date:** May 2026
> **References:** See also → `Proctor_Dashboard.md` · `ExamSetup_Master.md` · `Admin_Dashboard.md` · `HR_Dashboard.md` · `Candidate_Environment.md` · `Assessexpert_Platform_Development.md`

---

## Table of Contents

1. [Role Overview & Responsibilities](#1-role-overview--responsibilities)
2. [Authentication & Login](#2-authentication--login)
3. [Tab 1 — Overview Dashboard](#3-tab-1--overview-dashboard)
4. [Tab 2 — Proctor Management](#4-tab-2--proctor-management)
5. [Tab 3 — Assessment Join (All Sessions)](#5-tab-3--assessment-join-all-sessions)
6. [Tab 4 — Question Papers & Exam Content](#6-tab-4--question-papers--exam-content)
7. [Tab 5 — Practical Questions & Files](#7-tab-5--practical-questions--files)
8. [Tab 6 — Proctor Reporting & Report Review](#8-tab-6--proctor-reporting--report-review)
9. [Tab 7 — Settings & Configuration](#9-tab-7--settings--configuration)
10. [Notification Center](#10-notification-center)
11. [Connectivity & API Dependencies](#11-connectivity--api-dependencies)

---

## 1. Role Overview & Responsibilities

The Master Proctor is the highest-authority operational role in the assessexpert platform. They sit above individual Proctors and have oversight, control, and intervention rights across all live and completed sessions. They combine the operational oversight of a senior proctor with content management rights over all question papers and practical materials, and they have the ability to manage, support, and quality-review all proctors under their jurisdiction.

The Master Proctor is the definitive authority on session integrity, report quality, and exam content correctness within their domain.

### 1.1 What a Master Proctor Can Do

| Capability | Description |
|-----------|-------------|
| Join any live session | Can enter any proctor's session as an observer or to take control |
| Manage all proctors | View, control availability, reassign sessions, and review performance of all proctors |
| Control proctor reporting | Set reporting standards, review all proctor-published reports, and request modifications |
| Review & modify reports | Can request that a proctor revises a report; can annotate any published report |
| View all question papers | Full read access to all MCQ question papers across all assessment types |
| Modify test papers & answers | Can directly edit active question papers (subject to versioning and audit log) |
| Manage practical questions | Full access to all practical task descriptions, source files, and marking criteria |
| Modify practical files | Can replace or update practical source files and marking criteria |
| Override proctor actions | Can pause, resume, or terminate any session regardless of which proctor is assigned |
| Control assessment scheduling | Can reassign proctors to sessions and adjust session parameters |
| Full settings access | All platform operational settings, proctor settings, and content delivery settings |

### 1.2 What a Master Proctor Cannot Do

| Restriction | Reason |
|------------|--------|
| Cannot access company billing or HR pipeline data | Financial and HR data is Admin-only |
| Cannot create or delete user accounts | User management is Admin-only |
| Cannot create new assessment types | Assessment type structure is Admin + Exam Setup Master responsibility |
| Cannot view unpublished Exam Setup drafts | Content pipeline is Exam Setup Master's domain until published |
| Cannot publish report modifications unilaterally without proctor sign-off (unless escalation) | Maintains proctor accountability |

---

## 2. Authentication & Login

### 2.1 Login Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| Email + Password | ✅ | bcrypt 12 rounds |
| MFA — TOTP | ✅ **Mandatory** | Google Authenticator or Authy |
| MFA — SMS OTP | ✅ | Fallback only |
| Google OAuth | ❌ | Not permitted — strict auth for elevated role |

MFA is mandatory and cannot be disabled for the Master Proctor role. Every action (session joins, report modifications, content edits) is signed with the Master Proctor's identity and timestamp.

### 2.2 Session Management

- Sessions time out after 4 hours of inactivity
- Re-authentication is required for any destructive action (report override, session termination, content modification)

---

## 3. Tab 1 — Overview Dashboard

The Master Proctor's home screen provides a platform-wide operational overview across all active and upcoming sessions, all proctors, and all pending report actions.

### 3.1 Summary Stat Cards

| Card | Value |
|------|-------|
| Live Sessions Right Now | Count of all sessions currently in `IN_PROGRESS` state |
| Sessions Today (Total) | All sessions scheduled for today |
| Active Proctors Online | Number of proctors currently logged in and active |
| Reports Pending Review | Total reports not yet published across all proctors |
| Reports Flagged for Modification | Reports that the Master Proctor has returned for revision |
| AI Flags This Week | Total AI integrity flags raised across all sessions this week |

### 3.2 Live Sessions Panel

A real-time grid of all currently active sessions:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LIVE SESSIONS — 3 Active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ● BIM Coordinator L2        Proctor: Ali Hassan       5 candidates
    Phase: MCQ — 14:23 remaining                [Join as Observer]

  ● Python Developer           Proctor: Sara Mitchell    3 candidates
    Phase: Practical — 48:10 remaining          [Join as Observer]

  ● Network Engineer           Proctor: Omar Khalil      1 candidate
    Phase: Verification                         [Join as Observer]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Each session entry shows: assessment name, assigned proctor, candidate count, current phase, time remaining, and a `[Join as Observer]` button.

### 3.3 Today's Sessions Schedule

A full chronological view of today's complete session schedule:

| Time | Assessment | Proctor | Candidates | Status | Action |
|------|-----------|---------|------------|--------|--------|
| 09:00 AM | AutoCAD Draftsman L1 | Huda Al-Ali | 3 | ✅ Completed | [View Reports] |
| 10:00 AM | BIM Coordinator L2 | Ali Hassan | 5 | 🔴 Live | [Join] |
| 02:00 PM | Python Developer | Sara Mitchell | 3 | 🔴 Live | [Join] |
| 04:00 PM | Network Engineer | Omar Khalil | 2 | ⏳ Upcoming | [View] |

### 3.4 Proctor Status Panel

A quick-view status of all proctors:

```
  PROCTOR STATUS
  ──────────────────────────────────────────────────────
  🟢 Ali Hassan         — In Session (BIM L2)
  🟢 Sara Mitchell      — In Session (Python Developer)
  🟢 Omar Khalil        — In Session (Network Engineer)
  🟡 Huda Al-Ali        — Available (session ended at 11:32 AM)
  ⚫ James Walker        — Offline
  ──────────────────────────────────────────────────────
```

### 3.5 Pending Reports Panel

Persistent panel listing all reports across all proctors that are awaiting review:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋  PENDING REPORTS — 4 Total
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ● Ahmed Al-Rashidi — BIM L2 — Proctor: Ali Hassan
    Draft ready: 11:49 AM, 14 Jun          [View Report]

  ● James Walker — Network Engineer — Proctor: Omar Khalil
    Draft ready: 03:22 PM, 13 Jun          [View Report]

  ● Sara Mitchell — Python Dev — Proctor: Sara Mitchell
    Draft ready: 09:15 AM, 14 Jun          [View Report]

  ● Khalid Al-Mansouri — AutoCAD L1 — Proctor: Huda Al-Ali
    Draft ready: 11:00 AM, 14 Jun          [View Report]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 4. Tab 2 — Proctor Management

The Master Proctor's primary tool for managing, overseeing, and controlling all proctors on the platform.

### 4.1 Proctor List

A full table of all proctors within the Master Proctor's jurisdiction:

| Column | Description |
|--------|-------------|
| Name | Proctor's full name |
| Status | 🟢 Online — In Session / 🟡 Online — Available / ⚫ Offline |
| Sessions This Month | Total sessions conducted in the current month |
| Reports Pending | Count of unpublished reports for this proctor |
| Average HR Score | Average HR rating of this proctor's published reports |
| Avg Report Turnaround | Average time from session end to report publication |
| Certification Level | Junior / Senior / Expert |
| Assigned Sessions (Today) | Count and list of today's sessions |
| Actions | `[View Profile]` `[View Sessions]` `[Reassign Sessions]` `[Send Message]` `[Suspend]` |

### 4.2 Proctor Profile View

Clicking `[View Profile]` on any proctor opens their full profile:

**Personal Details (read-only for Master Proctor):**
- Full name, email, phone, certification level
- Certification domains — assessment types the proctor is certified to conduct
- Languages — languages in which the proctor can conduct briefings

**Performance Dashboard:**
- Sessions this month / this quarter / all time
- Average HR rating (5-point scale) with trend sparkline
- Average report turnaround time
- Average AI flags per session
- Integrity incidents this month (sessions where proctor confirmed a flag)

**Session History:**
A paginated list of all sessions this proctor has ever conducted, with links to session recordings and published reports.

### 4.3 Proctor Availability Management

The Master Proctor can view and edit any proctor's availability schedule:

- **View weekly grid:** 7-day × 24-hour availability grid as set by the proctor
- **Override availability:** Master Proctor can mark a proctor as unavailable for a specific period (e.g., for training, leave management)
- **Override reason:** Mandatory note field when overriding proctor availability
- **All overrides are logged** with Master Proctor's identity and timestamp

### 4.4 Session Reassignment

If a proctor is unavailable, ill, or needs to be replaced:

1. Master Proctor clicks `[Reassign Sessions]` on the proctor's profile
2. A list of that proctor's upcoming sessions is shown
3. For each session, a dropdown shows available proctors (certified for that assessment type, available at that time)
4. Master Proctor selects a replacement proctor per session
5. Both the original proctor and the replacement receive notifications

**Confirmation required:** Reassignment of a session < 2 hours before start time requires an explicit justification note.

### 4.5 Direct Proctor Messaging

The Master Proctor can send direct in-portal messages to any proctor:

```
  Send Message to: Ali Hassan
  ──────────────────────────────────────────────────────────
  [Message text area]

  Priority:  ○ Normal   ○ Urgent

  [Send Message]
```

Urgent messages trigger an SMS notification in addition to the in-portal alert.

### 4.6 Proctor Performance Reporting

A dedicated sub-view within Proctor Management:

**Metrics available per proctor (for any date range):**
- Total sessions conducted
- Sessions by assessment type (breakdown)
- Sessions by company (breakdown)
- HR satisfaction ratings per session
- Report turnaround time per session (histogram)
- AI flag confirmation rate (flags confirmed vs dismissed)

**Export:** All proctor performance data can be exported as CSV or PDF.

### 4.7 Proctor Suspension

If a proctor requires immediate suspension from conducting sessions:

1. Master Proctor clicks `[Suspend]` on the proctor's profile
2. A confirmation dialog requires a mandatory reason note
3. On confirmation: the proctor's account status → `Suspended`
4. All of the suspended proctor's upcoming sessions are flagged as `Needs Reassignment`
5. The Admin receives an alert: `"Proctor [Name] has been suspended by Master Proctor [Name]"`
6. Account re-activation requires Admin-level action

---

## 5. Tab 3 — Assessment Join (All Sessions)

The Master Proctor has the ability to join any session on the platform — whether to observe, to support a proctor, or to take control in an exceptional circumstance.

### 5.1 Session Browser

A complete list of all sessions across all proctors, filterable by:
- Date (today / this week / custom range)
- Status: Upcoming / Live / Completed
- Proctor
- Assessment type
- Company

| Column | Description |
|--------|-------------|
| Session ID | Unique session identifier |
| Assessment Type | Assessment name |
| Company | Client company |
| Proctor | Assigned proctor |
| Scheduled Time | Date & time |
| Candidates | Count of candidates in session |
| Status | Upcoming / Live / Completed |
| Action | `[Join as Observer]` (Live) / `[View Session Record]` (Completed) / `[View Schedule]` (Upcoming) |

### 5.2 Joining a Session as Observer

When the Master Proctor clicks `[Join as Observer]`:

1. Camera permission is requested from the Master Proctor's browser
2. The Master Proctor enters the session room with the same full interface as the proctor
3. The assigned proctor is notified: `"Master Proctor [Name] has joined this session as an observer."`
4. The Master Proctor's presence is shown in the session's audit log

**Observer Mode vs Control Mode:**
- **Observer mode (default):** Master Proctor can see all candidate feeds, read the event log, and see the checklist — but cannot take any actions that would affect the session
- **Control mode (escalation):** Master Proctor can switch to control mode by clicking `[Take Session Control]` — this immediately notifies the assigned proctor, who loses primary control rights. The Master Proctor becomes the session lead.

### 5.3 Sending Proctor Instructions During a Live Session

While in observer mode, the Master Proctor can send private instructions to the proctor (not visible to candidates):

```
  📨  Private message to proctor Ali Hassan
  ──────────────────────────────────────────
  [Message text]

  [Send to Proctor]
```

These messages appear as a discrete notification on the proctor's interface (labelled as "Master Proctor message") and do not appear in the candidate-facing view or the public session event log.

### 5.4 Session Control Features (when in Control Mode)

When the Master Proctor has taken session control, they have the full proctor interface plus:

| Additional Control | Description |
|-------------------|-------------|
| Override any checklist item | Can mark checklist items as complete or override them with a justification note |
| Extend time globally | Can add time extensions to any or all candidates simultaneously |
| Pause / Resume all | Pause or resume the exam for all candidates at once |
| Terminate any candidate's session | Terminate a specific candidate's session with a logged reason |
| Override flag decisions | Can overrule the proctor's previous flag dismiss/confirm decisions during this session |

### 5.5 Multi-Session Monitoring View

The Master Proctor can switch to a **Multi-Session Monitor** — a grid view showing all live sessions simultaneously:

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  BIM L2              │  │  Python Developer     │  │  Network Engineer     │
│  Proctor: Ali Hassan │  │  Proctor: Sara        │  │  Proctor: Omar        │
│  5 candidates        │  │  3 candidates         │  │  1 candidate          │
│  MCQ — 14:23 rem     │  │  Practical — 48:10   │  │  Verification phase   │
│  [Join]              │  │  [Join]               │  │  [Join]               │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

Each tile shows the session's current phase, time remaining, and candidate count. Clicking any tile joins that session as observer.

---

## 6. Tab 4 — Question Papers & Exam Content

The Master Proctor has full read and edit access to all question papers across all assessment types. Unlike the Exam Setup Master (who requires Admin approval for changes to active content), the Master Proctor can make direct modifications to active question papers — all edits are versioned, logged, and visible to the Admin.

### 6.1 Question Paper Browser

**Left Panel — Assessment Type Navigator:**
- Tree of all assessment types grouped by category
- Shows: `Active MCQs: 78 | Draft: 7 | Archived: 23`
- Filter by: Category / Assessment Type / Status

**Right Panel — Question List:**

| Column | Description |
|--------|-------------|
| Q# | Internal question ID |
| Assessment Type | Assessment this question belongs to |
| Question Preview | First 120 characters |
| Type | Single Choice / Multiple Choice / True-False |
| Difficulty | Easy / Medium / Hard |
| Domain/Tag | Skill tags |
| Status | Active / Draft / Pending Approval / Archived |
| Last Modified | Date and modified by |
| Actions | `[View]` `[Edit]` `[Archive]` |

**Filter & Search:**
- Filter by: assessment type, difficulty, domain/tag, status, date range
- Full-text search within question text

### 6.2 View Question

Clicking `[View]` opens the full question card including:

- Question text (with any rich text formatting, code blocks, or images)
- All answer options
- Correct answer(s) clearly marked
- Explanation / rationale
- Difficulty and domain tags
- Full version history — all previous versions with timestamps and author

### 6.3 Edit Question (Master Proctor Direct Edit)

The Master Proctor can edit any question regardless of its current status:

**Edit fields (same as Exam Setup Master):**
- Question text
- Answer options
- Correct answer(s)
- Explanation
- Difficulty
- Domain / Tags
- Status

**Edit behaviour:**
- All edits create a new version — the previous version is preserved in full
- On saving an edit to an **Active** question: the change goes live **immediately** (unlike Exam Setup Master, which requires Admin approval)
- A mandatory `"Reason for Edit"` field must be completed before saving
- The Admin receives a notification: `"Active question modified by Master Proctor [Name] — [Question ID]"`
- All modifications are visible in the question's version history with the Master Proctor's identity

**Edit Form:**

```
  Edit Question #847 — BIM Coordinator L2
  ──────────────────────────────────────────────────────────────────
  Assessment Type: BIM Coordinator L2   [read-only]
  Status: Active → (will go live immediately on save)

  Question Text:
  [Rich text editor — pre-populated]

  Answer Options:
  A. [text]   ○ Correct
  B. [text]   ● Correct  ✅
  C. [text]   ○ Correct
  D. [text]   ○ Correct

  Explanation:
  [Rich text editor]

  Difficulty:   ○ Easy   ● Medium   ○ Hard

  Domain Tags:  [Multi-select]

  Reason for Edit (required):
  [Text area — minimum 20 characters]

  [Save Changes — Goes Live Immediately]   [Cancel]
  ──────────────────────────────────────────────────────────────────
  ⚠️ This question is Active. Saving will update it immediately for
     all future sessions. The previous version is preserved.
```

### 6.4 Bulk Question Management

The Master Proctor can perform bulk operations on questions:

| Bulk Action | Description |
|------------|-------------|
| Bulk Archive | Archive multiple questions at once (with pool size safety check) |
| Bulk Change Status | Move multiple Draft questions to Active, or Active to Draft |
| Bulk Tag Update | Apply or remove domain tags from multiple questions |
| Export Questions | Export all questions for an assessment type as CSV (with correct answers masked or visible) |

### 6.5 MCQ Pool Health View

Same pool health view as Exam Setup Master (see `ExamSetup_Master.md` Tab 3):
- Difficulty distribution chart
- Domain coverage chart
- Pool size vs minimum threshold
- Recommended changes

The Master Proctor can act on recommendations directly without requiring separate approval.

---

## 7. Tab 5 — Practical Questions & Files

Full management of all practical assessment tasks — task descriptions, source files, marking criteria, and evaluation notes — across all assessment types.

### 7.1 Practical Task Browser

**Left Panel:** Assessment type navigator (practical-capable types only)

**Right Panel — Task List:**

| Column | Description |
|--------|-------------|
| Task # | Internal ID |
| Assessment Type | Assessment this task belongs to |
| Task Title | Descriptive name |
| Practical Type | CAD / BIM / Coding / Lab / Written / Other |
| Source File | File type, name, and upload date |
| Has Marking Criteria | Yes / No |
| Difficulty | Standard / Advanced |
| Est. Time (min) | Expected completion time |
| Status | Active / Draft / Archived |
| Last Modified | Date and modified by |
| Actions | `[View]` `[Edit]` `[Replace File]` `[Archive]` |

### 7.2 View Practical Task

Clicking `[View]` opens the complete task detail:

**Candidate-Facing Section:**
- Task title and description (exactly as the candidate sees it)
- Starter file download link
- Accepted submission format
- Estimated completion time

**Proctor/Admin-Facing Section:**
- Marking criteria (full rubric with point values)
- Evaluator notes and common errors
- Reference images (if configured)
- Any assessor guidance

**Version History:**
- Full history of all previous versions of both the task description and the source file
- Each version shows: version number, date, modified by, change reason

### 7.3 Edit Practical Task

The Master Proctor can edit any field of any practical task directly:

**Editable Fields:**
- Task title
- Task description (candidate-facing)
- Accepted submission format
- Marking criteria
- Evaluator notes
- Difficulty level
- Estimated completion time

**Direct edit behaviour:**
- Changes to Active tasks go live immediately
- Mandatory `"Reason for Change"` field
- Admin notification on any change to an Active task
- Full version preservation

### 7.4 Replace Source File

The most high-impact practical content action — replacing the source file candidates receive during the exam:

```
  Replace Source File — Practical Task #12
  ──────────────────────────────────────────────────────────────────
  Current file:  column_footing_base.rvt   (uploaded: 3 Jun 2026)
  
  Upload new file:
  ┌────────────────────────────────────────────────────────────┐
  │  Drag and drop new file here, or click to browse          │
  │  Accepted: .dwg / .dxf / .rvt / .ifc / .xlsx / .zip etc. │
  │  Max size: 100 MB                                          │
  └────────────────────────────────────────────────────────────┘

  Reason for file replacement (required):
  [Text area]

  ⚠️  Previous file is preserved in version history.
      New file will be used for all sessions from this point.
      Sessions already completed retain the original file record.

  [Confirm File Replacement]    [Cancel]
```

On confirmation:
- New file is virus-scanned and stored in S3
- Old file is retained in version history (immutable)
- Future sessions use the new file
- Admin receives notification: `"Practical source file replaced — Task #12 — by Master Proctor [Name]"`

### 7.5 Practical Task Pool Health

For each assessment type with practicals:
- Active practical task count vs minimum required
- Distribution by difficulty (Standard / Advanced)
- Distribution by practical type (BIM / CAD / Coding etc.)
- Tasks with missing marking criteria (flagged as ❌)
- Tasks with missing source files (flagged as ❌)

---

## 6. Tab 6 — Proctor Reporting & Report Review

The Master Proctor has full oversight of all reports generated by all proctors, with the ability to review, annotate, return for modification, and — in escalation scenarios — override a proctor's published report.

### 6.1 Report Overview

**Report Status Summary (top of tab):**

| Status | Count |
|--------|-------|
| 🟠 Pending (draft ready, not yet reviewed by proctor) | Count |
| 🔵 In Proctor Review (proctor has opened but not yet published) | Count |
| 🟢 Published | Count |
| 🔴 Returned for Modification | Count |

### 6.2 All Reports Table

A unified table of all reports across all proctors:

| Column | Description |
|--------|-------------|
| Candidate Name | Full name |
| Company | Client organisation |
| Assessment | Assessment name |
| Proctor | Assigned proctor |
| Session Date | Date of session |
| MCQ Score | Percentage |
| Practical Score | Percentage |
| Overall Score | Combined score |
| Integrity Score | 0–100 colour-coded |
| Report Status | Pending / In Review / Published / Returned |
| Master Proctor Action | `[Review]` / `[View Published]` / `[Return for Modification]` / `[Override]` |

**Sorting and filtering:**
- Filter by proctor, company, assessment type, date range, status
- Sort by any column
- Highlight reports that have been pending for > 24 hours (SLA alert)

### 6.3 Master Proctor Report Review Interface

Clicking `[Review]` opens the full report. The Master Proctor sees everything the proctor sees — the recording, the AI evaluation, the practical submission, the draft report — plus the Master Proctor's own additional action panel.

**Left Panel — Review Tools (same as Proctor):**
- Session recording player with timestamp jump points
- Practical submission viewer
- AI evaluation summary (MCQ score, practical score, integrity score)

**Right Panel — Full Report:**
- All report fields as set by the proctor
- All AI-generated content and any proctor overrides
- The proctor's narrative and verdict

**Master Proctor Action Panel (additional, below the report):**

```
MASTER PROCTOR REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Master Proctor Annotation:
  (Rich text — internal note, visible to Admin only, not in HR report)
  [Text area — optional]

Master Proctor Verdict on This Report:
  ○ Approved — Report quality is acceptable; no action required
  ○ Annotation Only — Adding internal note; no proctor action needed
  ● Return for Modification — Proctor must revise before publication
  ○ Escalation Override — Modifying and republishing directly

Modification Request (if returning to proctor):
  Required fields to revise:
  ☐  Proctor Narrative
  ☐  Practical Quality Verdict
  ☐  Overall Proctor Verdict
  ☐  Specific AI score override
  ☐  Other (describe below)

  Instructions for proctor:
  [Text area — required if returning for modification]

[Return Report to Proctor for Revision]    [Approve as Is]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 6.4 Return Report for Modification

When the Master Proctor selects `[Return for Modification]`:

1. The report's status changes to `Returned for Modification`
2. The proctor receives a notification: `"Your report for [Candidate Name] has been returned for revision by the Master Proctor — [Reason]"`
3. The report moves back into the proctor's `Pending Review` queue with a `Returned` badge
4. The proctor must complete the requested revisions and re-publish
5. On re-publication, the Master Proctor receives a notification: `"Report revised and republished — [Candidate Name] by Proctor [Name]"`

### 6.5 Escalation Override — Direct Report Modification

In exceptional circumstances, the Master Proctor can directly modify and republish a report without requiring the proctor to act. This is an escalation path only.

**When to use escalation override:**
- Proctor is unavailable and report has exceeded SLA
- Clear proctor error that needs immediate correction before HR reviews it
- Compliance or integrity requirement demands immediate correction

**Override flow:**

1. Master Proctor selects `Escalation Override`
2. A confirmation modal appears: `"This action will modify and republish the report directly. The proctor will be notified. This action is logged and audited. Are you sure?"`
3. After confirmation, the Master Proctor can edit:
   - Proctor narrative
   - Practical quality verdict
   - Overall proctor verdict
   - Any AI score overrides (with mandatory justification per field)
4. On saving: the report is re-published with both the proctor's original data and the Master Proctor's modifications clearly differentiated
5. The published report shows: `"Report reviewed and amended by Master Proctor [Name] — [Date]"`
6. The proctor and Admin both receive notifications

### 6.6 Proctor Reporting Standards

The Master Proctor can configure the reporting standards that all proctors must meet:

**Configurable standards:**
- Minimum proctor narrative length (characters) — default: 50
- Required report turnaround SLA (hours from session end) — default: 24 hours
- Mandatory checklist fields for specific assessment types
- Required verdicts for specific integrity score ranges (e.g., if integrity < 50, verdict must be "Flagged" or "Disqualified")

Changes to reporting standards take effect for all reports submitted after the change date.

---

## 9. Tab 7 — Settings & Configuration

The Master Proctor has access to all operational settings relevant to session delivery, proctor management, and content delivery.

### 9.1 Session Settings

| Setting | Options | Description |
|---------|---------|-------------|
| Default session join window | Minutes before start (e.g., 15 min) | When the `[Join Session]` button becomes active for proctors |
| Session SLA — report turnaround | Hours | Maximum time from session end to published report |
| Multi-candidate max per session | 1–5 | Default maximum candidates per session |
| Automatic SLA alert threshold | Hours before SLA breach | When the Master Proctor is notified of an upcoming SLA breach |
| Time extension permission | Master Proctor / Proctor / Both | Who can grant time extensions to candidates |

### 9.2 AI Monitoring Settings

| Setting | Options | Description |
|---------|---------|-------------|
| Face absence alert threshold | Seconds (default 8s) | How long a face must be absent before triggering a flag |
| FR periodic check interval | Minutes (default every 90s) | How often facial recognition verification rechecks the candidate |
| FR similarity threshold — auto-verified | Percentage (default 90%) | FR score above which candidate is auto-verified |
| FR similarity threshold — manual review | Percentage (default 70%–89%) | FR score range requiring proctor manual decision |
| Tab switch alert after N switches | Count (default 3) | After N tab switches, escalate from event log to active alert |
| Audio anomaly sensitivity | Low / Medium / High | Sensitivity of background voice detection |

### 9.3 Proctor Settings (Global)

| Setting | Options | Description |
|---------|---------|-------------|
| MFA requirement | Always On | Cannot be disabled — informational only |
| Proctor session timeout | Hours (default 4h) | Inactivity timeout for all proctor sessions |
| Default recording playback speed | 1x / 1.5x / 2x | Default speed for session recording playback in report review |
| Max sessions per proctor per day | Count | Global cap on how many sessions a proctor can conduct per day |

### 9.4 Notification Settings (Master Proctor)

| Event | Email | In-Portal | SMS |
|-------|-------|-----------|-----|
| Live session: AI critical flag | ✅ default | ✅ real-time | Optional |
| Report SLA breach approaching | ✅ default | ✅ | ✅ default |
| Report published by proctor | Optional | ✅ | — |
| Report returned by proctor (after revision) | ✅ default | ✅ | — |
| Proctor goes offline mid-session | ✅ default | ✅ | ✅ default |
| New session assigned to any proctor | Optional | ✅ | — |

### 9.5 Personal Profile

| Field | Description |
|-------|-------------|
| Full Name | Display name across the platform |
| Email Address | Login email (contact Admin to change) |
| Phone Number | Used for SMS OTP and urgent notifications |
| Profile Photo | Avatar shown in session interfaces |
| Certification Level | Read-only — set by Admin |
| Domains | Assessment types within this Master Proctor's oversight scope |

### 9.6 Account Security

| Setting | Options |
|---------|---------|
| Change Password | Standard change flow |
| MFA Status | Cannot disable — always Active |
| Regenerate TOTP Secret | Revokes current TOTP, generates new QR code |
| Active Sessions | View and terminate sessions |
| Login History | Last 20 login events |

---

## 10. Notification Center

| Notification | Trigger | Action |
|-------------|---------|--------|
| AI critical flag in live session | Immediate AI trigger | `[Join Session]` |
| Report SLA approaching | X hours before SLA breach | `[Review Reports]` |
| Proctor went offline in live session | WebSocket disconnect | `[Join Session]` / `[Reassign]` |
| Report returned by proctor (after revision) | Proctor re-publishes | `[Review]` |
| Active question edited by Exam Setup Master | Pending approval submitted | `[Review Content]` |
| Proctor report returned for modification | After Master Proctor action | Informational |
| New session scheduled | Admin creates session | `[View Schedule]` |

---

## 11. Connectivity & API Dependencies

### 11.1 Master Proctor APIs

| Feature | Endpoint | Method |
|---------|----------|--------|
| Dashboard stats | `GET /api/master-proctor/dashboard/stats` | REST |
| Live sessions | `GET /api/master-proctor/sessions/live` | REST |
| All sessions (filter) | `GET /api/master-proctor/sessions` | REST |
| Join session as observer | `POST /api/master-proctor/sessions/{id}/join` | REST |
| Take session control | `POST /api/master-proctor/sessions/{id}/take-control` | REST |
| Send proctor message | `POST /api/master-proctor/sessions/{id}/proctor-message` | WebSocket |
| All proctors list | `GET /api/master-proctor/proctors` | REST |
| Proctor profile | `GET /api/master-proctor/proctors/{id}` | REST |
| Update proctor availability | `PUT /api/master-proctor/proctors/{id}/availability` | REST |
| Reassign session | `POST /api/master-proctor/sessions/{id}/reassign` | REST |
| Suspend proctor | `POST /api/master-proctor/proctors/{id}/suspend` | REST |
| All reports (filter) | `GET /api/master-proctor/reports` | REST |
| Get report detail | `GET /api/master-proctor/reports/{id}` | REST |
| Return report for modification | `POST /api/master-proctor/reports/{id}/return` | REST |
| Override report | `PUT /api/master-proctor/reports/{id}/override` | REST |
| All questions (filter) | `GET /api/master-proctor/questions` | REST |
| Edit question | `PUT /api/master-proctor/questions/{id}` | REST |
| Archive question | `POST /api/master-proctor/questions/{id}/archive` | REST |
| All practical tasks (filter) | `GET /api/master-proctor/practical-tasks` | REST |
| Edit practical task | `PUT /api/master-proctor/practical-tasks/{id}` | REST |
| Replace practical file | `POST /api/master-proctor/practical-tasks/{id}/file` | REST (multipart) |
| Get settings | `GET /api/master-proctor/settings` | REST |
| Update settings | `PUT /api/master-proctor/settings` | REST |

### 11.2 Real-Time WebSocket Events (Inbound)

| Event | Description |
|-------|-------------|
| `session.live.update` | Any live session state change (phase, flag, candidate status) |
| `ai.flag.critical` | Critical AI flag in any live session |
| `proctor.offline` | Proctor disconnected from an active session |
| `report.published` | Any proctor published a report |
| `report.sla.warning` | Report approaching SLA breach |
| `question.edited` | Exam Setup Master submitted a question edit for approval |

### 11.3 Video & Audio (WebRTC — When Joining Sessions)

- When the Master Proctor joins a session in observer mode: receive-only streams from all candidate cameras and screen shares
- Proctor audio/video from the Master Proctor: optional — can choose to join with camera or silently
- All streams encrypted in transit (DTLS-SRTP)

---

*Document: Master Proctor Dashboard Specification — assessexpert v1.0*
*Prepared: May 2026 | Platform: assessexpert.ae*
*See also: `Proctor_Dashboard.md` | `Admin_Dashboard.md` | `HR_Dashboard.md` | `ExamSetup_Master.md` | `Candidate_Environment.md` | `Assessexpert_Platform_Development.md`*
*"Every result verified. Every hire protected."*
