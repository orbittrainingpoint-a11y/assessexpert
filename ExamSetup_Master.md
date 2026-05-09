# assessexpert — Exam Setup Master Dashboard
## Complete Feature Specification Document

> **Portal:** `app.assessexpert.ae/exam-setup`
> **Role:** Exam Setup Master
> **Version:** 1.0
> **Classification:** Internal — Development & Engineering Team
> **Date:** May 2026
> **References:** See also → `Admin_Dashboard.md` (Tab 6 & 7) · `Proctor_Dashboard.md` · `Assessexpert_Platform_Development.md`

---

## Table of Contents

1. [Role Overview & Responsibilities](#1-role-overview--responsibilities)
2. [Authentication & Login](#2-authentication--login)
3. [Tab 1 — Overview Dashboard](#3-tab-1--overview-dashboard)
4. [Tab 2 — Assessment Types](#4-tab-2--assessment-types)
5. [Tab 3 — MCQ Question Bank](#5-tab-3--mcq-question-bank)
6. [Tab 4 — Practical Exam Library](#6-tab-4--practical-exam-library)
7. [Tab 5 — Exam Paper Review & Approval](#7-tab-5--exam-paper-review--approval)
8. [Tab 6 — Exam Simulation & Preview](#8-tab-6--exam-simulation--preview)
9. [Tab 7 — Settings & Profile](#9-tab-7--settings--profile)
10. [Notification Center](#10-notification-center)
11. [Connectivity & API Dependencies](#11-connectivity--api-dependencies)

---

## 1. Role Overview & Responsibilities

The Exam Setup Master is a specialist internal role responsible for building, maintaining, and quality-assuring all examination content on the assessexpert platform. This includes writing and organising MCQ questions, uploading and configuring practical exam tasks, maintaining marking criteria, and ensuring all exam content is accurate, up-to-date, and ready for live use by Proctors.

The Exam Setup Master does not conduct exams, does not proctor candidates, and does not access HR or candidate personal data beyond what is necessary to calibrate assessment difficulty.

### 1.1 What an Exam Setup Master Can Do

| Capability | Description |
|-----------|-------------|
| Manage MCQ question bank | Create, edit, categorise, and archive MCQ questions per assessment type |
| Manage practical exam tasks | Upload, configure, and maintain practical task files and marking criteria |
| Configure assessment structure | Edit exam settings (question count, durations, passing thresholds) with Admin approval |
| Review exam papers | Run full quality-check reviews on all active question pools |
| Simulate exams | Preview exactly what a candidate sees during an MCQ or practical session |
| Version control content | All edits are versioned — previous versions are preserved and restorable |
| Submit content for Admin approval | Changes to Active content require Admin approval before going live |

### 1.2 What an Exam Setup Master Cannot Do

| Restriction | Reason |
|------------|--------|
| Cannot access candidate personal data | Assessment content is anonymous — Exam Setup Master has no visibility into who is being assessed |
| Cannot access published reports | Reports are HR/Admin only |
| Cannot join or monitor live sessions | Operational role belongs to Proctors |
| Cannot publish changes to Active pool without Admin approval | Two-person integrity control on live exam content |
| Cannot view session recordings | Recordings are restricted to Proctor and Admin |

---

## 2. Authentication & Login

### 2.1 Login Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| Email + Password | ✅ | bcrypt 12 rounds |
| MFA — TOTP | ✅ **Mandatory** | Google Authenticator or Authy |
| MFA — SMS OTP | ✅ | Fallback |
| Google OAuth | ❌ | Not permitted — strict auth for content integrity |

MFA is mandatory and cannot be disabled for the Exam Setup Master role. Every change to exam content is signed with the user's identity and timestamp.

### 2.2 Domain-Restricted Access

The Admin can restrict an Exam Setup Master to specific assessment type domains:

- **Full Access:** Can edit all assessment types across all categories
- **Domain-Restricted:** Can only access the assessment types specified by Admin (e.g., only Engineering assessments, or only IT assessments)

Domain restriction is enforced at every API level — not just the UI.

---

## 3. Tab 1 — Overview Dashboard

The Exam Setup Master's home screen provides a content health overview across all assessment types they have access to.

### 3.1 Summary Stat Cards

| Card | Value |
|------|-------|
| Total Active Assessment Types | Count of all assessment types with status = Active |
| Total MCQ Questions (Active Pool) | Total active MCQ questions across all types |
| Total Practical Tasks (Active) | Total active practical tasks across all types |
| Questions Pending Review | Questions in Draft or flagged for review |
| Practical Tasks Pending Approval | Practical tasks awaiting Admin approval to go Active |

### 3.2 Content Health Panel

A table showing the health status of each assessment type:

| Assessment Type | MCQ Pool Size | Active MCQs | Draft MCQs | Practical Tasks | Last Updated | Health |
|----------------|--------------|-------------|------------|-----------------|--------------|--------|
| BIM Coordinator L2 | 85 | 78 | 7 | 6 | 12 Jun 2026 | 🟢 Good |
| AutoCAD Draftsman L1 | 50 | 50 | 0 | 4 | 03 Jun 2026 | 🟢 Good |
| Python Developer | 120 | 100 | 20 | 8 | 10 Jun 2026 | 🟡 Needs Review |
| Network Engineer | 60 | 45 | 15 | 3 | 28 May 2026 | 🔴 Below Minimum |

**Health Colour Logic:**
- 🟢 Good — MCQ pool is at or above the configured minimum, all practical tasks are active
- 🟡 Needs Review — MCQ pool is within 20% of minimum OR there are drafts pending review
- 🔴 Below Minimum — Active MCQ count has fallen below the minimum safe pool size (configurable per assessment type — default: minimum 2× the question count delivered per session)

Clicking any row in this table navigates directly to that assessment type's content in Tab 3 or Tab 4.

### 3.3 Recent Activity Log

My recent edits:
- `Question #847 updated — BIM Coordinator L2 — 14 Jun, 09:34 AM`
- `Practical Task #12 uploaded — Python Developer — 13 Jun, 04:15 PM`
- `5 questions archived — Network Engineer — 12 Jun, 02:00 PM`

---

## 4. Tab 2 — Assessment Types

A read-view of all assessment types with the ability to edit structural settings (subject to Admin approval for changes to Active assessments).

### 4.1 Assessment Types List

| Column | Description |
|--------|-------------|
| Name | Assessment type name |
| Category | Engineering / IT / Finance / Healthcare / etc. |
| Exam Structure | MCQ Only / MCQ + Practical / Practical Only |
| MCQ Count (Delivered) | How many questions a candidate receives per session |
| MCQ Pool Size (Required) | Minimum pool size to support random delivery |
| MCQ Duration | Minutes |
| Practical Type | None / CAD / Coding / Lab / Written / Other |
| Practical Duration | Minutes |
| Pass Thresholds | MCQ % / Practical % / Combined % |
| Status | Active / Draft / Archived |
| My Access | Full / Domain-Restricted view |
| Actions | [View Settings] [Edit Settings] |

### 4.2 View / Edit Assessment Type Settings

Clicking `[Edit Settings]` opens the Assessment Configuration Form (same fields as described in `Admin_Dashboard.md` Tab 6), but:

- Changes to **Active** assessment types go into a **Pending Admin Approval** state — they do not take effect immediately
- Changes to **Draft** assessment types take effect immediately
- All edit proposals include a mandatory "Reason for Change" field

**Approval Workflow for Active Assessment Type Changes:**
1. Exam Setup Master makes an edit and submits
2. Change enters `Pending Approval` state
3. Admin receives notification: "Assessment type settings change pending approval"
4. Admin reviews diff (before/after comparison) and Approves or Rejects
5. If Approved: change goes live immediately
6. If Rejected: Admin must provide rejection reason; change is discarded with reason logged

---

## 5. Tab 3 — MCQ Question Bank

The primary workspace for building and managing MCQ questions.

### 5.1 Question Bank Browser

**Left Panel — Navigator:**
- Tree of all assessment types grouped by category
- Selecting an assessment type loads its MCQ pool on the right
- Shows: `Active: 78 | Draft: 7 | Archived: 23`

**Right Panel — Question List:**

| Column | Description |
|--------|-------------|
| Q# | Internal question ID |
| Question Preview | First 100 characters |
| Type | Single Choice / Multiple Choice / True-False |
| Difficulty | Easy / Medium / Hard |
| Domain/Tag | Skill tags (e.g., "Structural", "Piping", "Python OOP") |
| Status | Active / Draft / Pending Approval / Archived |
| Last Modified | Date |
| Actions | [View] [Edit] [Duplicate] [Archive] |

**Filter Options:**
- Status
- Difficulty
- Domain/Tag
- Date added (range)
- Created by (if multiple Exam Setup Masters have access to this assessment type)

**Search:** Full-text search within question text.

---

### 5.2 View Question

Clicking `[View]` opens a read-only question card:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  QUESTION #847  |  BIM Coordinator L2  |  Hard
  Domain: IFC Coordination
  Status: 🟢 Active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  What is the primary purpose of an IFC file in
  a BIM coordination workflow?

  A. To store 2D drawing files for fabrication
  B. To enable interoperability between different
     BIM software platforms ✅ CORRECT
  C. To define the project scheduling milestones
  D. To manage construction budget allocations

  EXPLANATION:
  IFC (Industry Foundation Classes) is an open,
  neutral data format for BIM interoperability...

  Created: 12 May 2026 | Modified: 12 Jun 2026
  Author: Exam Setup Master — Rania Hassan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 5.3 Create New MCQ Question

Clicking `[+ Add Question]` opens the question creation form:

**Field: Assessment Type**
- Dropdown — select which assessment type this question belongs to
- A question can belong to only one assessment type

**Field: Question Text**
- Rich text editor
- Supports: Bold / Italic / Code block / LaTeX math formulas / Image upload
- Character limit: 1000 characters
- Language toggle: English / Arabic (create localised versions)

**Field: Question Type**
- Single Choice (exactly one correct answer)
- Multiple Choice (one or more correct answers; candidate must select all correct options)
- True / False

**Field: Answer Options**
- For Single/Multiple Choice: Minimum 3, maximum 5 options
- Each option: Rich text editor (same support as question text)
- Correct answer(s): Toggle button on each option to mark as correct
- At least one option must be marked correct

**Field: Explanation**
- Rich text area (shown in the proctor's report review — not shown to candidates)
- Why this answer is correct; what a wrong answer reveals about a knowledge gap

**Field: Difficulty**
- Easy / Medium / Hard
- Difficulty affects AI report analysis when clusters of Hard questions are missed

**Field: Domain / Tags**
- Multi-select from the predefined tag library for this assessment type
- Tags are used for: difficulty balancing the random selection, performance analysis in reports

**Field: Status on Save**
- Save as Draft — question enters the Draft pool, not yet delivered to candidates
- Submit for Approval — question is proposed for the Active pool; goes to Admin review

**Bulk Import:**
- `[Import Questions]` — Upload a structured CSV or Excel template
- Template fields: Assessment Type, Question Text, Option A, Option B, Option C, Option D, Option E, Correct Answers (comma-separated), Difficulty, Domain, Explanation
- System validates: correct answer must be one of provided options; question text cannot be empty
- All imported questions enter Draft status and require individual or batch approval

---

### 5.4 Edit MCQ Question

Clicking `[Edit]` opens the same form pre-populated with current values.

**Edit Rules:**
- If question status is **Draft**: changes save immediately
- If question status is **Active**: changes create a new version in `Pending Approval` state
  - The current Active version continues to be delivered until the new version is approved
  - Admin sees a diff comparing the current Active version and the proposed change
  - On approval, new version becomes Active; old version preserved in version history
- **Version History:** Every question maintains full version history — Admin and Exam Setup Master can view any previous version and restore it if needed

---

### 5.5 Archive Question

Archiving a question removes it from the random selection pool immediately. It is not deleted — it remains in the Archived tab with full history. Archived questions can be restored to Draft status.

A question can only be archived if the active MCQ pool for that assessment type will remain at or above the minimum safe pool size after archiving. If archiving would drop the pool below minimum, the system warns the user and requires either replacement questions first or Admin override.

---

### 5.6 MCQ Pool Balance Report

A quality tool within the MCQ tab:

**Distribution Charts (auto-generated):**
- Difficulty breakdown: `Easy: 30% | Medium: 50% | Hard: 20%` (bar chart)
- Domain coverage: how many questions per skill domain (horizontal bar chart)
- Gaps identified: "Domain 'Piping Systems' has only 3 active questions — below recommended minimum of 8"

**Recommended Pool Configuration:**
For each assessment type, a target distribution is configured (by Admin in Tab 2):
- Recommended difficulty split (e.g., 30% Easy / 50% Medium / 20% Hard)
- Minimum questions per domain

The Pool Balance Report flags deviations from these targets with actionable recommendations.

---

## 6. Tab 4 — Practical Exam Library

The workspace for managing practical assessment tasks — the hands-on portion of any MCQ + Practical assessment.

### 6.1 Practical Task Browser

Same two-panel layout as the MCQ tab:

**Left Panel:** Assessment type navigator (showing only assessment types with `Has Practical = Yes`)

**Right Panel — Task List:**

| Column | Description |
|--------|-------------|
| Task # | Internal ID |
| Task Title | Descriptive name |
| Practical Type | CAD / BIM / Coding / Lab / Written / Other |
| Source File | File type and name |
| Marking Criteria | Has criteria: Yes / No |
| Difficulty | Standard / Advanced |
| Estimated Time (min) | Expected completion time |
| Status | Active / Draft / Pending Approval / Archived |
| Last Modified | Date |
| Actions | [View] [Edit] [Duplicate] [Archive] |

---

### 6.2 View Practical Task

Clicking `[View]` opens the full task detail view:

**Candidate-Facing Section:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PRACTICAL TASK #12  |  BIM Coordinator L2
  Title: Column Footing Shop Drawing
  Type: BIM File Upload (.rvt / .ifc)
  Difficulty: Standard | Est. Time: 45 minutes
  Status: 🟢 Active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TASK DESCRIPTION (as shown to candidate):
  Using the provided Revit project file, complete
  the column footing shop drawing as per the
  specifications defined in the drawing notes.
  Export as IFC and upload your completed file.

  SOURCE FILE: column_footing_base.rvt
  [Download Source File]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Proctor/Admin-Facing Section:**
```
  MARKING CRITERIA (Proctor-only):
  ─────────────────────────────────
  ✅ Criterion 1: Column grid alignment correct (20pts)
  ✅ Criterion 2: Footing dimensions match spec (20pts)
  ✅ Criterion 3: Rebar notation complete (20pts)
  ✅ Criterion 4: IFC export layers correctly named (20pts)
  ✅ Criterion 5: File submits without errors (20pts)

  EVALUATOR NOTES:
  Common errors: candidates often miss the rebar
  notation in the footing detail. Check Section A-A
  view for completeness.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 6.3 Create New Practical Task

Clicking `[+ Add Practical Task]`:

**Field: Assessment Type**
- Dropdown — must select an assessment type with `Has Practical = Yes`

**Field: Task Title**
- Short descriptive title (max 100 characters)
- Used in the Proctor dashboard when selecting a task to assign

**Field: Practical Type**
- CAD File Upload (.dwg / .dxf)
- BIM File Upload (.rvt / .ifc)
- Coding Exercise
- Network Lab
- Written / Document Submission
- Presentation
- Other (specify)

**Field: Task Description (Candidate-Facing)**
- Rich text editor
- This is exactly what the candidate reads during the exam
- Must be clear, unambiguous, and self-contained
- Language toggle: English / Arabic

**Field: Source File Upload**
For file-based tasks:
- Upload the source file the candidate receives (e.g., a base Revit file, a partially completed AutoCAD drawing, a dataset to analyse)
- File types accepted: .dwg / .dxf / .rvt / .ifc / .xlsx / .csv / .pdf / .zip
- Max file size: 100 MB
- File is virus-scanned before storage
- File stored in S3 with access restricted to Proctor (delivery) and Admin/Exam Setup Master (management)

For coding tasks:
- Define the problem statement (rich text)
- Define input/output specifications
- Provide starter code template (optional)
- Define test cases (input → expected output) — used by automated grading engine

**Field: Accepted Submission Format**
- What file type must the candidate upload to complete the task
- e.g., `.ifc` / `.dwg` / any code language file / `.pdf` / `.docx`

**Field: Marking Criteria**
- Rich text — this is the proctor's evaluation guide, not shown to candidates
- Structured as a list of criteria, each with a point value
- Total must sum to 100 points

**Field: Evaluator Notes**
- Rich text — describes what the ideal/perfect submission looks like
- Flags common errors to watch for
- Optional reference images (screenshots of the ideal submission)

**Field: Difficulty Level**
- Standard / Advanced

**Field: Estimated Completion Time**
- Minutes — used for planning and report analysis (early vs on-time vs overtime submission)

**Field: Status on Save**
- Save as Draft — enters draft state
- Submit for Approval — goes to Admin for review

---

### 6.4 Edit Practical Task

Same approval workflow as MCQ questions:
- Draft tasks save immediately
- Active tasks require Admin approval before changes go live
- Version history maintained for all task files and descriptions

**File Replacement:** Uploading a new source file does not delete the old file. The old file is retained in version history. New sessions use the newly approved file; the version used in any completed past session is permanently recorded in that session's audit log.

---

### 6.5 Coding Task Test Case Manager

For assessment types with a Coding practical type, a dedicated test case sub-section appears:

| Test Case | Input | Expected Output | Visibility | Weight |
|-----------|-------|-----------------|------------|--------|
| #1 | `[5, 3, 8]` | `16` | Public (shown to candidate) | 10% |
| #2 | `[1, 1, 1]` | `3` | Public | 10% |
| #3 | `[-2, 5, 0]` | `3` | Hidden (grading only) | 20% |
| #4 | Edge case... | ... | Hidden | 30% |
| #5 | Performance test | ... | Hidden | 30% |

- **Public test cases:** Candidate can see these and test their code against them during the exam
- **Hidden test cases:** Run only by the automated grading engine after submission; candidate cannot see
- Weight per test case: configures how much each case contributes to the Practical score

---

## 7. Tab 5 — Exam Paper Review & Approval

A dedicated quality assurance workspace for reviewing the readiness of each assessment type's full exam content before any candidates are scheduled.

### 7.1 Readiness Checklist Per Assessment Type

For each assessment type, the system automatically checks:

| Check | Status | Notes |
|-------|--------|-------|
| MCQ pool meets minimum size | ✅ / ❌ | e.g., "78 active (minimum 50)" |
| MCQ difficulty distribution within target range | ✅ / ⚠️ / ❌ | |
| All domains have minimum coverage | ✅ / ❌ | |
| Practical: at least N active tasks | ✅ / ❌ | Minimum configured per type |
| All active practical tasks have marking criteria | ✅ / ❌ | |
| All active practical tasks have source files | ✅ / ❌ | |
| No questions flagged for review | ✅ / ❌ | |
| Assessment type settings approved by Admin | ✅ / ❌ | |

**Overall Readiness Status:**
- 🟢 Ready for Live Scheduling
- 🟡 Needs Attention — assessment can be used but improvements recommended
- 🔴 Not Ready — blocking issues prevent safe use

---

### 7.2 Pending Admin Approvals

A list of all content changes submitted for Admin approval by this Exam Setup Master:

| Item | Type | Submitted | Status | Admin |
|------|------|-----------|--------|-------|
| Question #847 edit | MCQ | 13 Jun, 10:00 | ⏳ Pending | — |
| Practical Task #5 new file | Practical | 12 Jun, 15:30 | ✅ Approved | Admin K. |
| BIM-L2 pass threshold change | Settings | 11 Jun, 09:00 | ❌ Rejected | Admin K. |

Clicking a Rejected item shows the Admin's rejection reason.

---

### 7.3 Full Exam Paper Preview

The Exam Setup Master can preview the full candidate-facing exam experience for any assessment type:

**MCQ Preview:**
- Shows questions one at a time (exactly as the candidate sees them)
- Correct answer is highlighted (since this is a setup preview, not a real exam)
- Timer is shown but not counting down
- Navigation: Previous / Next (setup preview only — in real exam, no going back)

**Practical Preview:**
- Shows the task description exactly as the candidate sees it
- Shows the source file download link
- Shows the submission upload area

This preview confirms exactly what a candidate experiences without exposing any admin tools.

---

## 8. Tab 6 — Exam Simulation & Preview

A full end-to-end simulation of a complete assessment session, for quality assurance purposes.

### 8.1 Start a Simulation

Select:
- Assessment Type
- Mode: MCQ Only / Practical Only / Full Exam (MCQ + Practical)
- Simulation persona name (used to label the simulation log — not a real candidate record)

Click `[Start Simulation]`

The system opens a sandboxed, full-screen simulation of the candidate environment. This is identical to the real candidate exam interface but:
- Correct answers are highlighted after submission of each question
- Timer can be paused during simulation
- Practical: marking criteria are shown in a side panel alongside the task
- No AI proctoring runs during simulation
- No session record is created — simulation data is discarded after the session

### 8.2 Simulation Debrief

After completing the simulation:
- Question-by-question results shown
- Time taken per question
- Difficulty distribution of the random selection drawn for this simulation
- Practical task assigned (randomly selected from pool)
- Any issues identified (e.g., broken image in a question, missing source file link)

Exam Setup Master can flag issues directly from the debrief view, which creates a task in the review queue.

---

## 9. Tab 7 — Settings & Profile

### 9.1 Personal Profile

| Field | Description |
|-------|-------------|
| Full Name | Display name across the platform |
| Email Address | Login email (contact Admin to change) |
| Phone Number | Used for SMS OTP |
| Profile Photo | Avatar |
| Specialist Domains | Read-only — set by Admin |
| Access Level | Read-only — Full / Domain-Restricted |

### 9.2 Notification Preferences

| Event | Email | In-Portal |
|-------|-------|-----------|
| Admin approved my content change | ✅ default | ✅ |
| Admin rejected my content change | ✅ default | ✅ |
| Content flagged for review | ✅ default | ✅ |
| Pool health alert (below minimum) | ✅ default | ✅ |

### 9.3 Account Security

| Setting | Options |
|---------|---------|
| Change Password | Standard flow |
| MFA Status | Cannot disable — always Active |
| Regenerate TOTP Secret | Revokes current TOTP, generates new QR code |
| Active Sessions | View and terminate sessions |
| Login History | Last 20 login events |

---

## 10. Notification Center

| Notification | Trigger | Action |
|-------------|---------|--------|
| Admin approved content change | Approval granted | `[View Content]` |
| Admin rejected content change | Rejection with reason | `[View Feedback]` |
| Assessment type health alert | Pool drops below minimum | `[Add Questions]` |
| New assessment type added | Admin creates a new type | `[Set Up Content]` |
| Simulation issue flagged | Flagged in debrief | `[Review Issue]` |

---

## 11. Connectivity & API Dependencies

### 11.1 Exam Setup Master APIs

| Feature | Endpoint | Method |
|---------|----------|--------|
| Dashboard stats | `GET /api/exam-setup/dashboard/stats` | REST |
| List assessment types | `GET /api/exam-setup/assessment-types` | REST |
| Get assessment type detail | `GET /api/exam-setup/assessment-types/{id}` | REST |
| Edit assessment type settings | `PUT /api/exam-setup/assessment-types/{id}` | REST |
| List MCQ questions | `GET /api/exam-setup/questions?assessmentTypeId={id}` | REST |
| Create MCQ question | `POST /api/exam-setup/questions` | REST |
| Update MCQ question | `PUT /api/exam-setup/questions/{id}` | REST |
| Archive MCQ question | `POST /api/exam-setup/questions/{id}/archive` | REST |
| Bulk import questions | `POST /api/exam-setup/questions/import` | REST (multipart) |
| List practical tasks | `GET /api/exam-setup/practical-tasks?assessmentTypeId={id}` | REST |
| Create practical task | `POST /api/exam-setup/practical-tasks` | REST (multipart) |
| Update practical task | `PUT /api/exam-setup/practical-tasks/{id}` | REST |
| Upload practical file | `POST /api/exam-setup/practical-tasks/{id}/file` | REST (multipart) |
| Submit for approval | `POST /api/exam-setup/approvals` | REST |
| List pending approvals | `GET /api/exam-setup/approvals?status=pending` | REST |
| Pool balance report | `GET /api/exam-setup/assessment-types/{id}/pool-balance` | REST |
| Start simulation | `POST /api/exam-setup/simulations` | REST |
| Get simulation result | `GET /api/exam-setup/simulations/{id}` | REST |

---

*Document: Exam Setup Master Dashboard Specification — assessexpert v1.0*
*Prepared: May 2026 | Platform: assessexpert.ae*
*See also: `Admin_Dashboard.md` | `Proctor_Dashboard.md` | `HR_Dashboard.md` | `Candidate_Environment.md` | `Assessexpert_Platform_Development.md`*
*"Every result verified. Every hire protected."*
