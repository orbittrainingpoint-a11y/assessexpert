# assessexpert — Proctor Dashboard
## Complete Feature Specification Document

> **Portal:** `app.assessexpert.ae/proctor`
> **Role:** Proctor
> **Version:** 1.0
> **Classification:** Internal — Development & Engineering Team

---

## Table of Contents

1. [Role Overview & Responsibilities](#1-role-overview--responsibilities)
2. [Authentication & Login](#2-authentication--login)
3. [Tab 1 — Overview Dashboard (Home)](#3-tab-1--overview-dashboard-home)
4. [Tab 2 — Today's Assessments](#4-tab-2--todays-assessments)
5. [Tab 3 — Live Session Control Room](#5-tab-3--live-session-control-room)
   - 5.1 [Session Entry & Camera Start](#51-session-entry--camera-start)
   - 5.2 [Candidate Lobby & Readiness View](#52-candidate-lobby--readiness-view)
   - 5.3 [Individual Candidate Verification Flow](#53-individual-candidate-verification-flow)
   - 5.4 [Full-Screen Camera & Verification UI (Candidate Side)](#54-full-screen-camera--verification-ui-candidate-side)
   - 5.5 [Screen Share & GuardPro Consent](#55-screen-share--guardpro-consent)
   - 5.6 [5-Minute Briefing Protocol](#56-5-minute-briefing-protocol)
   - 5.7 [Queue Management (Multi-Candidate)](#57-queue-management-multi-candidate)
   - 5.8 [Starting the MCQ Exam](#58-starting-the-mcq-exam)
   - 5.9 [Live Monitoring During MCQ](#59-live-monitoring-during-mcq)
   - 5.10 [Practical Task Assignment](#510-practical-task-assignment)
   - 5.11 [Live Monitoring During Practical](#511-live-monitoring-during-practical)
   - 5.12 [Session Close & Post-Exam Transition](#512-session-close--post-exam-transition)
6. [Tab 4 — Completed Assessments & Report Review](#6-tab-4--completed-assessments--report-review)
7. [Tab 5 — Settings & Profile](#7-tab-5--settings--profile)
8. [AI Flags & Integrity Monitoring](#8-ai-flags--integrity-monitoring)
9. [Notification Center](#9-notification-center)
10. [Connectivity & API Dependencies](#10-connectivity--api-dependencies)

---

## 1. Role Overview & Responsibilities

The Proctor is the most critical operational role in the assessexpert platform. They are a certified assessment professional employed by assessexpert (or an authorised partner). The Proctor is the gatekeeper of every exam session — no assessment begins without their active control, and no report is published without their review.

### 1.1 What a Proctor Does

| Responsibility | Description |
|---------------|-------------|
| Pre-exam verification | Runs the complete 10-item pre-exam checklist for every candidate before unlocking the assessment |
| Identity verification | Visually confirms candidate identity against government ID, triggers facial recognition check |
| Environment scan | Visually verifies the candidate's surroundings are clean and compliant |
| Session briefing | Reads the 5-minute exam guidelines briefing to all candidates before starting |
| Session control | Controls when the MCQ exam starts, assigns the practical task, and manages timing |
| Live monitoring | Monitors all candidates simultaneously during the exam, responds to AI flags |
| Incident management | Issues warnings to candidates, flags integrity concerns, can terminate sessions |
| Report review | Reviews the AI-generated draft report for each candidate after the session |
| Report publication | Writes a proctor narrative, selects a verdict, and publishes the final report to HR |

### 1.2 What a Proctor Cannot Do

| Restriction | Reason |
|------------|--------|
| Cannot see another organisation's sessions | Proctor is assigned to sessions within their scope only |
| Cannot auto-publish a report without reviewing | Publish button is locked until all review checkboxes are ticked |
| Cannot view HR's candidate pipeline | Proctor only sees sessions assigned to them |
| Cannot modify the question bank | Read-only access to assessment content |
| Cannot change HR dashboard data | Report publication is the only write action affecting HR visibility |

---

## 2. Authentication & Login

### 2.1 Login Methods

| Method | Supported | Notes |
|--------|-----------|-------|
| Email + Password | ✅ | bcrypt 12 rounds |
| MFA — TOTP | ✅ **Mandatory** | Google Authenticator; MFA is not optional for Proctors |
| MFA — SMS OTP | ✅ | Fallback if TOTP unavailable |
| Google OAuth | ❌ | Not available for Proctor role — stricter auth required |

### 2.2 MFA is Mandatory for All Proctors

MFA cannot be disabled for the Proctor role. On every login:
1. Enter email + password
2. Enter 6-digit TOTP code from authenticator app (or SMS OTP code)
3. Access granted

### 2.3 First Login — Onboarding Tutorial

On first login, an 8-step interactive tutorial overlay launches automatically:
- Step 1: Overview Dashboard — understanding your stats
- Step 2: Today's Assessments — finding your scheduled sessions
- Step 3: Joining a session
- Step 4: Candidate verification checklist walkthrough
- Step 5: Running the briefing
- Step 6: Starting the exam and monitoring
- Step 7: Assigning the practical task
- Step 8: Reviewing and publishing the AI report

Tutorial is accessible again at any time via the Help menu.

---

## 3. Tab 1 — Overview Dashboard (Home)

The proctor's home screen provides a personal performance overview and operational status at a glance.

### 3.1 Summary Stat Cards (Top Row)

| Card | Value Shown |
|------|-------------|
| Sessions This Month | Total sessions conducted by this proctor in the current calendar month |
| Sessions Completed | Sessions fully processed with published reports |
| Reports Pending | Sessions completed but reports not yet reviewed/published by this proctor |
| Average Flags Per Session | Mean number of AI flags raised per session this month |

Each card has:
- Large animated number (CountUp.js on load)
- Month-over-month trend indicator (↑ or ↓ with % change)

---

### 3.2 Company Activity Breakdown

A horizontal bar chart or grouped chart showing:

- **Which companies** this proctor has conducted assessments for this month
- **How many sessions** per company
- Hovering shows the company name and session count

This helps proctors understand their workload distribution across client organisations.

---

### 3.3 Assessment Performance Graphs

Two charts displayed side-by-side:

**Chart 1 — Sessions Over Time (Line Chart)**
- X-axis: last 30 days
- Y-axis: sessions conducted per day
- Shows the proctor's daily session volume

**Chart 2 — Report Status Distribution (Donut Chart)**
- Published reports (green)
- Pending review (amber)
- Sessions in progress (cyan)

---

### 3.4 Reports Submitted vs Pending (Persistent Panel)

A clearly styled panel that is always visible on the Overview tab:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📋  PENDING ASSESSMENT REPORTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ● Ahmed Al-Rashidi — BIM Coordinator L2
    Draft ready since: 11:49 AM, 14 Jun 2026
    [Review & Publish →]

  ● James Walker — Network Engineer
    Draft ready since: 03:22 PM, 13 Jun 2026
    [Review & Publish →]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

This panel is **always visible** and never collapsed on the Overview tab. It ensures that pending reports are never missed. Each entry shows how long the report has been waiting and links directly to the review interface.

---

### 3.5 Upcoming Sessions (Today Preview)

A mini preview of today's upcoming sessions at the bottom of the Overview tab:

```
TODAY'S UPCOMING SESSIONS
  ● 10:00 AM  Ahmed Al-Rashidi    BIM Coordinator L2   [Join at 09:45]
  ● 02:00 PM  Sara Mitchell       Python Developer     [Join at 01:45]
```

This is a summary only — full detail is in Tab 2.

---

### 3.6 Proctor Rating

A personal quality metric visible to the proctor:

- **HR Feedback Score:** `4.8 / 5.0` — sourced from HR ratings of the proctor's work
- **Average Report Turnaround:** e.g., `1.8 hours from session end to published`
- A small sparkline showing rating trend over the last 3 months

---

## 4. Tab 2 — Today's Assessments

This tab shows all sessions scheduled for the current day, organised by time.

### 4.1 Layout — Time-Grouped Sessions

Sessions are displayed in chronological order, grouped by time slot:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MORNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ┌─────────────────────────────────────────────────────┐
  │  10:00 AM                                           │
  │  Ahmed Al-Rashidi | BIM Coordinator L2              │
  │  ACME Engineering | 5 candidates in this session    │
  │                                                     │
  │  Status: ● Scheduled                                │
  │                                    [Join at 09:45]  │
  └─────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AFTERNOON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ┌─────────────────────────────────────────────────────┐
  │  02:00 PM                                           │
  │  Sara Mitchell | Python Developer                   │
  │  TechCorp Ltd | 3 candidates in this session        │
  │                                                     │
  │  Status: ● Scheduled                                │
  │                                    [Join at 01:45]  │
  └─────────────────────────────────────────────────────┘
```

**Time groups:** Morning (8am–12pm) / Afternoon (12pm–5pm) / Evening (5pm–8pm)

### 4.2 Session Card Details

Each session card displays:
- Scheduled time
- Primary candidate's name (or "Group Session — N candidates" if multiple)
- Company name
- Assessment name / job role
- Number of candidates in the session (max 5)
- Current status: Scheduled / Proctor Joined / In Progress / Completed
- `[Join Session]` button — becomes active 15 minutes before scheduled start

### 4.3 Join Button Behaviour

- **More than 15 min before start:** Button is greyed out with label: `"Opens at [time]"`
- **15 min before start:** Button turns active (cyan glow) with label: `[Join at 09:45]`
- **At session time:** Button pulses with label: `[Join Now]`
- **After session ends:** Button replaced with: `[Session Complete]` or `[Review Report]`

### 4.4 Upcoming Sessions (Other Days)

Below today's sessions, a collapsible section shows:

```
UPCOMING THIS WEEK
  Tomorrow — Wed 18 Jun
  ● 09:00 AM  James Walker  |  Network Engineer  |  GlobalTech  [3 candidates]

  Thu 19 Jun
  ● 11:00 AM  Maria Lopez   |  Interior Designer |  DesignHub    [2 candidates]
```

---

## 5. Tab 3 — Live Session Control Room

The Session Control Room is the most complex and important interface in the entire platform. It is accessible by clicking `[Join Session]` from Tab 2.

---

### 5.1 Session Entry & Camera Start

When the proctor clicks `[Join Session]`:

1. The browser requests camera and microphone permissions from the proctor
2. A camera test screen is shown: proctor sees their own live feed in a large preview
3. Confirmation: `"Camera confirmed — your video is active"` with a green indicator
4. Proctor clicks `[Enter Session Room]` to proceed
5. The full Session Control Room interface loads

> The proctor's camera must be active before entering the session room. This is enforced — if camera permission is denied, the proctor cannot proceed and is shown a help screen for enabling camera access.

---

### 5.2 Candidate Lobby & Readiness View

Once inside the Session Control Room, the proctor sees the **session lobby**:

**Left Main Area:**
- Proctor's own camera feed (medium size, top-left corner)
- Labelled: `"You — [Proctor Name]"`

**Right Sidebar — Candidate Status Panel:**

A vertical list of all candidates in this session (max 5):

```
CANDIDATES IN THIS SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━
  ● Ahmed Al-Rashidi      ● Joined
  ● Sara Mitchell         ⏳ Waiting
  ● Khalid Al-Mansouri    ⏳ Waiting
  ● James Walker          ⏳ Not Connected
  ● Maria Lopez           ⏳ Not Connected
━━━━━━━━━━━━━━━━━━━━━━━━━
```

Status indicators:
- `● Joined` (green dot) — candidate's magic link was opened, camera is active, they are in the waiting room
- `⏳ Waiting` (amber) — candidate joined but not yet verified by proctor
- `⏳ Not Connected` (grey) — candidate has not yet opened their magic link

Clicking any candidate's name opens their individual verification flow.

---

### 5.3 Individual Candidate Verification Flow

Clicking a candidate's name in the sidebar opens their verification panel, which takes over the main area. The proctor works through each candidate one at a time.

The verification is conducted through the **Pre-Exam Checklist** — a structured 10-item protocol that the proctor must complete for every candidate before that candidate can take the exam.

**Checklist UI Design:**
- Vertical step-by-step card layout
- Each item is a card with: item number, title, description, and an action area
- Completed items show a green checkmark and collapse to a summary bar
- The active item is expanded and highlighted
- `[Begin Assessment]` button at the bottom is locked (greyed out) until ALL 10 items are checked

---

**Checklist Item 1 — Camera Verification**

- Proctor sees the candidate's live camera feed in the main area (large, full-width)
- Right sidebar retains the candidate list
- Proctor visually confirms: face is clearly visible, upper body shown, surroundings are visible
- Check field: `"Camera is active and candidate's face is clearly visible"`
- Action: `[✓ Camera Confirmed]`

**Checklist Item 2 — Verbal Identity Verification**

- Proctor speaks to the candidate via the audio/video connection
- Proctor asks the candidate to state:
  - Their full legal name
  - The email address the invitation was sent to
  - The job role they applied for
  - Confirmation they are alone in the room
- Proctor enters the confirmed name and email in text fields
- System does a soft-match against the CandidateRecord (visual indicator: green if match, amber if close, red if mismatch)
- Action: `[✓ Identity Verbally Confirmed]`

**Checklist Item 3 — Government ID Check**

This is the most detailed checklist item. It has two sub-parts:

**Sub-part A — ID Photo Capture:**
- Instructions shown to proctor: `"Ask the candidate to hold their government ID clearly in front of the camera"`
- Proctor clicks `[Capture ID Photo]` — system captures a screenshot of the candidate's camera feed
- Preview of captured image shown to proctor
- Options: `[Confirm Capture]` or `[Recapture]`
- The ID can be a passport, national ID card, or Emirates ID

**Sub-part B — Facial Recognition:**
- After confirming the ID capture, the system automatically runs:
  - OCR (AWS Textract): extracts name text from the ID → soft-matched against candidate name in database
  - AWS Rekognition CompareFaces: compares the face on the ID with the live webcam feed
- Result displayed to proctor:
  ```
  OCR Name Match:  "Ahmed Al-Rashidi" → ✅ Match confirmed (98.2%)
  Facial Recognition:  97.3% similarity → ✅ VERIFIED
  ```
- Outcomes:
  - ≥ 90% similarity → AUTO VERIFIED (green badge, proctor can proceed)
  - 70–89% similarity → MANUAL REVIEW REQUIRED (amber badge, proctor makes final call with an override button)
  - < 70% similarity → AUTO BLOCKED (red badge — proctor must flag this; cannot proceed without an explicit justification note)
- Action: `[✓ ID Verified]`

**Checklist Item 4 — Environment Scan**

- Instructions shown to proctor: `"Ask the candidate to slowly rotate their camera 360° to show the entire room"`
- Proctor watches the live feed as the candidate performs the scan
- Proctor manually ticks four sub-checkboxes:
  - ☐ No other people visible in the room
  - ☐ No unauthorized reference materials (books, notes, second monitors) visible
  - ☐ No secondary monitor connected or visible
  - ☐ Desk is clear — only permitted items present
- All four must be ticked
- Action: `[✓ Environment Clear]`

**Checklist Item 5 — Screen Share Confirmation**

- System automatically displays candidate's screen share status:
  ```
  Screen Share:    ✅ ACTIVE — Full screen confirmed
  GuardPro:        ✅ CONNECTED (if required for this assessment)
  ```
- If screen share is not active: proctor sees instructions to prompt the candidate to start screen sharing; a status refresh button is available
- Action: `[✓ Screen Verified]`

**Checklist Item 6 — Technical System Check**

- Automated system check results are displayed to the proctor:
  ```
  Internet Speed:      24.3 Mbps ✅
  Camera:              Active ✅
  Browser:             Chrome 124 ✅
  Screen Resolution:   1920×1080 ✅
  GuardPro Agent:      Connected ✅ (if required)
  ```
- Each item has a green ✅ or red ❌
- If any item shows red, the proctor is given guidance on how to resolve the issue before proceeding
- Action: `[✓ Technical Requirements Met]`

**Checklist Item 7 — Exam Guidelines Briefing (5 Minutes)**

- The full exam guidelines script is displayed on the proctor's screen in a readable format:
  ```
  READ ALOUD TO CANDIDATE:
  ─────────────────────────────────────────────────────────────────
  "This assessment consists of two parts:
  Part 1: 25 multiple-choice questions — 30 minutes.
  Part 2: A practical task — 60 minutes.
  
  Rules:
  • Your camera must remain active at all times.
  • You may not use any external references, websites, notes,
    or assistance from any person.
  • Do not minimise, switch, or close this browser window
    during the assessment.
  • Do not copy-paste content into or out of the exam.
  • Questions are delivered one at a time. You cannot go
    back to a previous question once submitted.
  • For the practical task, you will receive instructions and
    any required files directly from me.
  • If you experience a technical issue, raise your hand on
    camera — do not exit the exam.
  • Any violation of these rules will be recorded and may
    result in disqualification."
  ─────────────────────────────────────────────────────────────────
  ```
- This script is shown as a popup/overlay on the **candidate's screen** simultaneously, so the candidate can read along
- Action: `[✓ Guidelines Read to Candidate]`

**Checklist Item 8 — Candidate Agreement**

- Proctor asks: `"Do you confirm you understand and agree to the exam rules I have just described?"`
- Candidate responds verbally
- Proctor records the response:
  - `[YES — Candidate Agreed]`
  - `[NO — Candidate Declined]`
- If NO is selected: the session must be terminated. A popup explains the next steps and prompts the proctor to notify HR.
- Action: `[✓ Agreement Recorded: YES]`

**Checklist Item 9 — Recording Consent**

- Proctor informs the candidate: `"This session, including your camera feed and screen activity, will be recorded and stored securely for 7 days for quality and verification purposes."`
- The consent statement appears on the **candidate's screen** as a popup they must interact with:
  - Candidate sees: `"I consent to this session being recorded for assessment verification purposes."` with `[I Agree]` and `[I Do Not Agree]` buttons
- Proctor can see the candidate's selection in real-time
- If the candidate clicks `[I Do Not Agree]`: session cannot proceed; proctor is notified and prompted to contact HR
- Action: `[✓ Recording Consent: Accepted]`

**Checklist Item 10 — Final Readiness Confirmation**

- Proctor asks: `"Are you ready to begin your assessment?"`
- Proctor records: `[✓ Candidate Ready]`
- The checklist is now complete for this candidate

---

### 5.4 Full-Screen Camera & Verification UI (Candidate Side)

> **This defines how the candidate's screen looks during the entire verification phase.**

During the verification phase (from when the candidate joins the waiting room until the exam begins), the candidate sees a **full-screen camera interface**:

**Layout:**
- The candidate's own camera feed occupies the **full screen** (full-width, full-height)
- The camera feed has a clean overlay — the candidate can see themselves clearly at all times
- The camera feed does NOT have any distraction; it is their face and the room behind them

**Right Sidebar (visible over the camera feed, fixed position):**
A semi-transparent right panel (approximately 320px wide) with:

```
┌────────────────────────────────────┐
│  VERIFICATION IN PROGRESS          │
│                                    │
│  ✅ Camera confirmed               │
│  ⏳ Identity verification...       │
│                                    │
│  INSTRUCTIONS                      │
│  ─────────────────────────────     │
│  Please follow the proctor's       │
│  instructions carefully.           │
│                                    │
│  Current step:                     │
│  "Please hold your government      │
│   ID clearly in front of your      │
│   camera."                         │
│                                    │
│  ────────────────────────────────  │
│  🔴 Camera must remain on at       │
│     all times during verification. │
└────────────────────────────────────┘
```

**Instruction Updates:**
- As the proctor progresses through checklist items, the instruction text on the candidate's right sidebar updates in real-time via WebSocket
- Each step shows what the candidate should currently be doing:
  - Item 1: `"Please ensure your face and upper body are clearly visible."`
  - Item 2: `"Please state your full name, email address, and the role you applied for."`
  - Item 3: `"Please hold your government-issued ID clearly in front of the camera."`
  - Item 4: `"Please rotate your camera 360° to show the full room."`
  - Items 5–6: `"Technical checks in progress — please remain still."`
  - Item 7: `"Please listen to the exam guidelines carefully."`
  - Items 8–10: `"Please respond to the proctor's questions."`

**Checklist Progress (candidate view):**
The right sidebar also shows a simplified checklist progress to the candidate:
```
  Verification Progress
  ✅ Camera verified
  ✅ Identity confirmed
  ⏳ Environment check...
  ○  Technical check
  ○  Guidelines briefing
  ○  Ready to begin
```

**This full-screen + right-sidebar layout applies for the entire pre-exam verification phase.** Once the proctor clicks `[Begin Assessment]`, the screen transitions to the exam interface.

---

### 5.5 Screen Share & GuardPro Consent

During Checklist Item 9 (Recording Consent) or triggered before Checklist Item 5 (Screen Share), the candidate receives an automatic popup on their screen:

**Screen Share Consent Popup (candidate sees):**
```
┌────────────────────────────────────────────────────────────────┐
│  Screen Sharing Required                                       │
│                                                                │
│  This assessment requires you to share your full screen with   │
│  the proctor throughout the session.                           │
│                                                                │
│  Your screen will be recorded as part of the integrity         │
│  verification process.                                         │
│                                                                │
│  [Share Screen — Full Screen Mode]    [I Have a Problem]       │
└────────────────────────────────────────────────────────────────┘
```

When the candidate clicks `[Share Screen]`, the browser's native screen-share dialog opens. The candidate must select "Entire Screen" (not a window or tab). The proctor's checklist Item 5 auto-updates to ✅ once confirmed.

**GuardPro Installation (if required):**
For assessments that require GuardPro (the Windows security agent):
- A separate popup prompts the candidate to download and run the GuardPro installer
- Installation takes approximately 3–5 minutes
- GuardPro agent connects to the session automatically once running
- Proctor's checklist Item 5 shows `GuardPro: ✅ CONNECTED` once the agent reports in

---

### 5.6 5-Minute Briefing Protocol

Checklist Item 7 is designed as a structured briefing moment:

**On the proctor's screen:**
- The guidelines script is displayed in large, easy-to-read text with clear paragraph breaks
- A timer is NOT imposed — the proctor reads at a natural pace
- The proctor clicks `[Mark as Read]` only after completing the briefing

**On the candidate's screen (simultaneously):**
- The same guidelines text appears as a semi-transparent overlay on their full-screen camera view
- The candidate can read along
- The overlay has a light background to make text legible while the camera feed is still faintly visible behind it
- At the end, the candidate sees: `"The proctor has finished reading the guidelines. Please let them know you understand."`

---

### 5.7 Queue Management (Multi-Candidate)

When there are multiple candidates in a session (up to 5), the proctor works through them one at a time during the verification phase.

**Process:**

1. Proctor clicks the first candidate in the sidebar → completes their full 10-item checklist → clicks `[Add to Queue]`
2. Proctor clicks the next candidate → completes their verification → `[Add to Queue]`
3. This continues until all candidates are verified and queued
4. Once all candidates are in the queue, the `[Start Exam for All Candidates]` button becomes active

**Queue Status Panel (right sidebar, during multi-candidate verification):**

```
CANDIDATE QUEUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Ahmed Al-Rashidi    — Verified & Queued
  ✅ Sara Mitchell       — Verified & Queued
  ⏳ Khalid Al-Mansouri  — In Verification (current)
  ○  James Walker        — Pending
  ○  Maria Lopez         — Pending
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  3 / 5 verified

  [Start Exam — All Queued Candidates]
  (Locked until all 5 verified)
```

> **Design rule:** While verifying one candidate, the proctor can see all other candidates' status in the sidebar but cannot interact with them until the current verification is complete.

---

### 5.8 Starting the MCQ Exam

Once all candidates are verified and queued, the proctor clicks `[Start Exam for All Candidates]`.

**What happens on this click:**

| System Action | Description |
|--------------|-------------|
| `ExamSession.status` → `IN_PROGRESS` | Session state changes in database |
| Server-side timer starts | 30-minute MCQ countdown begins server-side (not client-side) |
| First MCQ question delivered | Each candidate's screen receives question 1 of 25 |
| Screen recording confirmed | System verifies recording is capturing before starting |
| AI proctoring fully activated | Face detection, gaze tracking, audio monitoring all go live |
| Proctor checklist locked | All 10 items sealed as an audit record on the session |

**On candidates' screens:** The full-screen camera verification UI transitions to the exam interface (Question 1 of 25 with timer).

---

### 5.9 Live Monitoring During MCQ

While the MCQ is in progress, the proctor has a comprehensive monitoring interface:

**Main Panel Layout:**

The main area shows a **live grid of all candidates** (up to 5 tiles):

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Ahmed           │  │  Sara            │  │  Khalid          │
│  [Live Camera]   │  │  [Live Camera]   │  │  [Live Camera]   │
│  Q: 12/25        │  │  Q: 14/25        │  │  Q: 11/25        │
│  ● Face: ✅      │  │  ● Face: ✅      │  │  ● Face: ✅      │
│  ● Screen: ✅    │  │  ● Screen: ✅    │  │  ● Screen: ⚠️    │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐
│  James           │  │  Maria           │
│  [Live Camera]   │  │  [Live Camera]   │
│  Q: 15/25        │  │  Q: 13/25        │
│  ● Face: ✅      │  │  ● Face: ⚠️      │
│  ● Screen: ✅    │  │  ● Screen: ✅    │
└──────────────────┘  └──────────────────┘
```

Each candidate tile shows:
- Live webcam feed (small video)
- Candidate name
- Current question number (e.g., Q: 12/25)
- Face detection status: ✅ Face present / ⚠️ Face absent > 5s / ❌ Face absent > 8s
- Screen share status: ✅ Active / ⚠️ Issue detected

**Clicking any candidate tile** expands it to a larger view, showing:
- Full-size camera feed with face bounding box overlay
- Gaze direction indicator
- Live screen share feed (the candidate's screen)
- Per-candidate event log

**Right Sidebar — Session Controls & Event Log:**

```
SESSION CONTROLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Timer: 18:42 remaining
  [⏸ Pause All]    [▶ Resume All]

  Send Message to [Candidate ▾]:
  [Type message to candidate...]
  [Send Warning]

  [📸 Capture Screenshot]
  [⛔ Terminate Session]

LIVE EVENT LOG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  10:09  Session started
  10:09  FR identity verified — Ahmed (97.3%)
  10:14  ⚠️ Audio anomaly — Sara [REVIEW]
  10:23  ✅ Periodic FR check — all passed
  10:34  ⚠️ Face absent 8s — Khalid [FLAGGED]

AI FLAGS QUEUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️ Audio anomaly at 10:14 — Sara
    [Dismiss]    [Confirm as Flag]

  ⚠️ Tab switch at 10:31 — James
    [Dismiss]    [Confirm as Flag]
```

**Send Warning to Candidate:**
- Proctor selects a candidate from the dropdown
- Types a message or selects from preset warnings:
  - `"Please ensure your face is clearly visible on camera."`
  - `"Please do not switch browser tabs during the assessment."`
  - `"Your screen share has been disconnected — please re-share."`
  - Custom message
- Message appears as a non-dismissible overlay on the selected candidate's screen for 15 seconds

---

### 5.10 Practical Task Assignment

When the MCQ timer reaches 0:00, all candidates' screens show: `"Part 1 Complete. Please wait for further instructions from the proctor."`

Simultaneously, the proctor's interface transitions to the **Practical Task Assignment Panel**:

```
┌────────────────────────────────────────────────────────────────┐
│  MCQ PHASE COMPLETE                                            │
│  ─────────────────────────────────────────────────────────     │
│  Session: BIM Coordinator L2 — 15 Jun 2026                     │
│                                                                │
│  MCQ RESULTS SUMMARY                                           │
│  Ahmed Al-Rashidi:    21/25 (84%) ✅                           │
│  Sara Mitchell:       18/25 (72%) ✅                           │
│  Khalid Al-Mansouri:  11/25 (44%) ❌                           │
│  James Walker:        23/25 (92%) ✅                           │
│  Maria Lopez:         20/25 (80%) ✅                           │
│                                                                │
│  ─────────────────────────────────────────────────────────     │
│  SELECT PRACTICAL TASK TO ASSIGN                               │
│                                                                │
│  Task Type: CAD / BIM (pre-configured for this assessment)     │
│                                                                │
│  Select Task File:                                             │
│  ○ Task A — Navisworks Clash Detection (Starter: building.nwf) │
│  ● Task B — Revit BIM Model QC (Starter: model_v2.rvt)         │
│  ○ Task C — AutoCAD Drawing Review (Starter: floor_plan.dwg)   │
│                                                                │
│  Selected starter file: model_v2.rvt                           │
│  [Preview File Details]                                        │
│                                                                │
│  VDI Option: Available (candidates without software can use    │
│  cloud desktop)  [Enable VDI for all] [Enable per candidate]   │
│                                                                │
│  Briefing for candidates (auto-populated from task):           │
│  "You will be working with a Revit BIM model. Your task        │
│   is to review the model for coordination issues..."           │
│  [Edit Briefing]                                               │
│                                                                │
│         [Assign Task & Start Practical Phase]                  │
└────────────────────────────────────────────────────────────────┘
```

When proctor clicks `[Assign Task & Start Practical Phase]`:
- Practical phase timer starts (60 minutes, server-side)
- All candidates receive a popup on their screen:
  ```
  ┌────────────────────────────────────────────────────────────┐
  │  PRACTICAL ASSESSMENT — PART 2 OF 2                       │
  │                                                            │
  │  Task: BIM Model Quality Check                            │
  │  Duration: 60 minutes                                      │
  │                                                            │
  │  1. Download the starter file below                       │
  │  2. Complete the task in your software                    │
  │  3. Upload your completed file before the timer ends      │
  │                                                            │
  │  [⬇ Download Starter File: model_v2.rvt]                  │
  │                                                            │
  │  ☐ I confirm I have read the task instructions and agree  │
  │    to the assessment rules.                               │
  │                                                            │
  │              [Begin Practical Task →]                      │
  └────────────────────────────────────────────────────────────┘
  ```

---

### 5.11 Live Monitoring During Practical

Same multi-tile monitoring view as during MCQ, with the following additions:

- Timer shows 60-minute practical countdown
- Each candidate tile shows a submission status bar: `"Not Yet Submitted"` / `"File Uploaded ✅"`
- When a candidate uploads their file, their tile shows a green "Submitted" badge
- AI monitoring continues at full intensity (face detection, screen monitoring, audio)
- Proctor can still send messages and flag events
- Proctor can see when candidates download the starter file and when they upload their submission

**Extending Time (exceptional circumstance):**
If the proctor needs to grant additional time to a specific candidate due to a technical issue, they can click on that candidate's tile and use the `[+10 min extension]` button. This requires a mandatory justification note and is logged in the audit trail.

---

### 5.12 Session Close & Post-Exam Transition

When the practical timer reaches 0:00:
- All candidates' screens show the session close screen (see Candidate Features document)
- Magic links are immediately invalidated
- Screen recording upload is finalised (all buffered segments flushed to S3)
- AI grading and report generation jobs are queued
- Proctor receives in-portal notification: `"All candidates have submitted. Session closed."`

**Proctor's interface transitions to Post-Session Review mode:**

```
┌──────────────────────────────────────────────────────────────┐
│  SESSION COMPLETE — BIM Coordinator L2 — 15 Jun 2026        │
│  Session ended: 11:31 AM | Duration: 1hr 42min               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  5 candidates submitted                                      │
│  AI report generation in progress (est. ready in ~15 min)   │
│                                                              │
│  ▶  Incident notes panel (add session-wide notes if any)    │
│  ▶  Reports will appear in Tab 4 when ready                  │
│                                                              │
│                             [Go to Completed Assessments →]  │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Tab 4 — Completed Assessments & Report Review

This tab lists all sessions the proctor has conducted, with pending reports flagged prominently.

### 6.1 Completed Assessments Table

**Table Columns:**

| Column | Description |
|--------|-------------|
| Candidate Name | Full name |
| Company | Client organisation name |
| Assessment | Assessment name |
| Session Date | Date the session took place |
| MCQ Score | Percentage |
| Practical Score | Percentage |
| Overall Score | Combined weighted score |
| Integrity Score | 0–100 colour-coded |
| Report Status | Pending Review (amber) / Published (green) |
| Actions | `[View Recording]` `[Edit Report]` (pending) / `[View Published Report]` (done) |

Reports with `Pending Review` status are always listed at the top, sorted by oldest first (to avoid SLA breaches).

---

### 6.2 Report Review Interface

Clicking `[Edit Report]` opens the full report review interface. This is a split-screen view:

**Left Panel — Review Tools:**

```
REVIEW TOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[▶ Play Recording]
  Duration: 1:21:14
  Jump to:
  ● MCQ Start (00:15:02)
  ● MCQ End (00:45:18)
  ● Practical Start (00:47:44)
  ● Practical End (01:47:38)
  ● Flag at 00:24:11 — Audio anomaly
  ● Flag at 01:03:55 — Tab switch

[View Practical Submission]
  ● model_v2_ahmed_final.rvt   [Open Viewer]
  ● clash_report.html          [Open Viewer]

AI EVALUATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━
MCQ Score:     21/25 (84%) ✅
Practical:     58/70 (83%) ✅
Overall:       83.4%       ✅
Integrity:     96/100      🟢
```

**Right Panel — Editable Draft Report:**

The full AI-generated draft report is displayed page by page. Fields that the proctor can edit are highlighted in light blue:

- Recommendation text — `[Edit]` button
- Suggested interview questions — `[Edit]` button
- Any rubric score — `[Override]` button (requires a typed justification note; original AI score is preserved alongside the override)

**Proctor Assessment Section (always at bottom of review panel):**

```
PROCTOR ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Practical Quality Verdict:
  ○ Excellent   ● Good   ○ Satisfactory   ○ Below Standard

Overall Proctor Verdict:
  ○ Clean — No concerns
  ● Clean — Minor observations noted
  ○ Flagged — Integrity concerns; recommend caution
  ○ Disqualified — Clear violation; do not hire

Proctor Narrative: (rich text editor — minimum 50 characters required)
┌─────────────────────────────────────────────────────────────────┐
│ Candidate demonstrated solid Revit proficiency. The BIM model   │
│ quality review was thorough and accurate. Minor procedural      │
│ point deducted for viewpoints naming convention. Session was    │
│ clean throughout.                                               │
└─────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☐ I have reviewed the screen recording and all submitted materials.
☐ I confirm this report accurately reflects the candidate's performance.

        [📤  PUBLISH REPORT TO HR DASHBOARD]
        (Locked until both boxes are ticked and verdict is selected)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Publish button is locked until:**
- A Practical Quality Verdict is selected
- An Overall Proctor Verdict is selected
- Proctor Narrative has at least 50 characters
- Both confirmation checkboxes are ticked

**On clicking `[Publish Report]`:**
1. Report status → `PUBLISHED`
2. `publishedBy` = proctor ID + timestamp
3. AI field overrides logged (originals preserved)
4. Digital signature applied to PDF
5. Report becomes visible on Company HR Dashboard
6. HR Manager receives: `"Report published for [Candidate Name]"`
7. Screen recording link attached to HR dashboard (7-day countdown)

---

## 7. Tab 5 — Settings & Profile

### 7.1 Personal Profile

| Field | Description |
|-------|-------------|
| Full Name | Display name used across the platform |
| Profile Photo | Avatar shown in session interfaces |
| Email Address | Login email (contact Super Admin to change) |
| Phone Number | Used for SMS OTP and notifications |
| Certification Level | Read-only — set by Super Admin |
| Certification Domains | Read-only — list of assessment types this proctor is certified for |
| Languages | Languages in which proctor can conduct briefings |

---

### 7.2 Availability Schedule

The proctor sets their availability, which the auto-scheduling engine uses to assign them to sessions:

- **Weekly availability grid:** A 7-day × 24-hour grid where proctor can mark available blocks
- **Availability is set in 30-minute increments**
- **Timezone:** Proctor selects their working timezone (all scheduling calculations use this)
- **Blackout dates:** Proctor can mark specific dates as unavailable (holidays, leave)
- **Maximum sessions per day:** Proctor can set a cap (e.g., max 4 sessions per day)

---

### 7.3 Notification Preferences

| Event | Email | In-Portal | SMS |
|-------|-------|-----------|-----|
| New session assigned | ✅ default | ✅ | Optional |
| Session reminder (1h before) | ✅ default | ✅ | ✅ default |
| AI draft report ready | ✅ default | ✅ | Optional |
| AI flag during live session | — | ✅ real-time | Optional |
| Candidate no-show | ✅ default | ✅ | Optional |

---

### 7.4 Portal Settings (Proctor-Controlled)

Settings the proctor can adjust for their own workflow:

| Setting | Options |
|---------|---------|
| Default recording playback speed | 1x / 1.5x / 2x |
| Auto-open recording on report review | Yes / No |
| Show AI confidence scores in report preview | Yes / No |
| Flag acknowledgement preference | Auto-dismiss after 5 min / Require manual dismiss |

---

### 7.5 Account Security

| Setting | Options |
|---------|---------|
| Change Password | Standard change flow |
| MFA Status | Cannot disable — always shows as Active |
| Regenerate TOTP secret | Revokes current TOTP and generates new QR code |
| Active Sessions | View and terminate active login sessions |
| Login History | Last 20 login events |

---

## 8. AI Flags & Integrity Monitoring

The AI proctoring engine runs client-side (in a WebWorker on the candidate's browser) and server-side, sending events to the proctor in real-time via WebSocket.

### 8.1 AI Monitoring Capabilities

| Monitor | Technology | Trigger | Proctor Alert |
|---------|-----------|---------|---------------|
| Face absence | MediaPipe FaceDetection | Absent > 8 seconds | ⚠️ In event log + flag queue |
| Multiple faces | MediaPipe FaceDetection | > 1 face detected | 🚨 Immediate alert + screenshot |
| Gaze off-screen | MediaPipe FaceMesh | Off-screen > 4 checks | ⚠️ Event log |
| Audio anomaly | WebAudio + noise classifier | Background voice detected | ⚠️ Flag queue |
| Tab switch | Page Visibility API | Any switch | ⚠️ Event log; > 3 → alert |
| Copy-paste attempt | Clipboard API | Any attempt | Block + log |
| Fullscreen exit | Fullscreen API | Any exit | Warning to candidate + proctor alert |
| Suspicious keyboard | Event listener | PrintScreen, etc. | Log |
| GuardPro: blocked process | GuardPro agent | Forbidden app opened | 🚨 Immediate critical alert |
| Periodic FR check | AWS Rekognition | Every 90 seconds | Flag if < 78% similarity |

### 8.2 Flag Queue Management

The right sidebar's AI Flags Queue lists all unresolved flags chronologically. For each flag the proctor can:

- **`[Dismiss]`** — flag is noted as reviewed and dismissed; no impact on integrity score
- **`[Confirm as Flag]`** — flag is confirmed as a genuine integrity concern; deducts from candidate's integrity score and is included in the published report

All dismiss and confirm actions are logged with the proctor's ID and timestamp.

### 8.3 Integrity Score

Each candidate receives an integrity score (0–100) calculated at session end, visible to the proctor in the report review:

| Factor | Max Points |
|--------|-----------|
| Face presence rate | 20 |
| Identity (FR) verification | 20 |
| Tab switching events | 15 |
| GuardPro integrity | 15 |
| Periodic FR checks | 15 |
| Audio anomalies | 10 |
| Copy-paste attempts | 5 |

Colour coding: 🟢 90–100 (excellent) / 🟡 75–89 (good) / 🟠 50–74 (moderate) / 🔴 0–49 (serious)

---

## 9. Notification Center

| Notification | Trigger | Action |
|-------------|---------|--------|
| New session assigned | Admin assigns session to proctor | `[View Schedule]` |
| Session starting in 1 hour | Automated 1h reminder | `[Prepare]` |
| AI draft report ready | Report generation complete | `[Review Now]` |
| AI flag (live session) | Real-time in session room | Auto-shown in flag queue |
| Candidate joined waiting room | Candidate opens magic link | In-portal indicator |

---

## 10. Connectivity & API Dependencies

### 10.1 APIs Consumed by Proctor Dashboard

| Feature | Endpoint | Method |
|---------|----------|--------|
| Dashboard stats | `GET /api/proctor/dashboard/stats` | REST |
| Today's sessions | `GET /api/proctor/sessions/today` | REST |
| Join session | `POST /api/proctor/sessions/{id}/join` | REST |
| Checklist item update | `PUT /api/proctor/sessions/{id}/checklist/{item}` | REST |
| Capture ID screenshot | `POST /api/proctor/sessions/{id}/capture-id` | REST |
| Trigger FR check | `POST /api/proctor/sessions/{id}/facial-recognition` | REST |
| Send candidate message | `POST /api/proctor/sessions/{id}/message` | WebSocket |
| Start exam | `POST /api/proctor/sessions/{id}/start-exam` | REST |
| Assign practical task | `POST /api/proctor/sessions/{id}/assign-practical` | REST |
| Terminate session | `POST /api/proctor/sessions/{id}/terminate` | REST |
| List completed reports | `GET /api/proctor/reports` | REST |
| Get report draft | `GET /api/proctor/reports/{id}` | REST |
| Override report field | `PUT /api/proctor/reports/{id}/override` | REST |
| Publish report | `POST /api/proctor/reports/{id}/publish` | REST |
| Get recording URL | `GET /api/proctor/recordings/{sessionId}/url` | REST |

### 10.2 Real-Time WebSocket Events

| Event (Inbound — server → proctor) | Description |
|-------------------------------------|-------------|
| `candidate.joined` | Candidate opened magic link and is in waiting room |
| `candidate.camera.status` | Camera active/inactive status change |
| `candidate.screen.status` | Screen share active/disconnected |
| `ai.flag` | AI proctoring event flagged |
| `fr.check.result` | Periodic facial recognition result |
| `session.submitted` | Candidate submitted their exam |
| `report.ready` | AI draft report is ready for review |

| Event (Outbound — proctor → server) | Description |
|--------------------------------------|-------------|
| `checklist.update` | Proctor marks checklist item |
| `message.send` | Proctor sends message to candidate |
| `flag.action` | Proctor dismisses or confirms a flag |
| `session.pause` | Proctor pauses the session |

### 10.3 Video & Audio (WebRTC)

- Proctor-to-candidate video/audio: WebRTC peer connection, negotiated via signalling server
- Candidate webcam feed (for proctor monitoring): WebRTC receive-only stream
- Screen share feed: WebRTC receive-only (candidate shares, proctor receives)
- All streams encrypted in transit (DTLS-SRTP)

---

*Document: Proctor Dashboard Specification — assessexpert v1.0*
*Prepared: May 2026 | Platform: assessexpert.ae*
*"Every result verified. Every hire protected."*
