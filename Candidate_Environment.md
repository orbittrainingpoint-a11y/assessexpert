# assessexpert — Candidate Environment
## Complete Feature Specification Document

> **Portal:** `app.assessexpert.ae/exam`
> **Role:** Candidate (Exam Taker)
> **Version:** 1.0
> **Classification:** Internal — Development & Engineering Team
> **Date:** May 2026
> **References:** See also → `Proctor_Dashboard.md` · `ExamSetup_Master.md` · `Admin_Dashboard.md` · `HR_Dashboard.md` · `Assessexpert_Platform_Development.md`

---

## Table of Contents

1. [Overview & Candidate Journey](#1-overview--candidate-journey)
2. [Step 1 — Email Entry & OTP Authentication](#2-step-1--email-entry--otp-authentication)
3. [Step 2 — Camera Permission & Device Check](#3-step-2--camera-permission--device-check)
4. [Step 3 — Full-Screen Camera & Verification Waiting Room](#4-step-3--full-screen-camera--verification-waiting-room)
5. [Step 4 — Pre-Exam Verification Phase (Proctor-Led)](#5-step-4--pre-exam-verification-phase-proctor-led)
6. [Step 5 — Exam Guidelines Briefing](#6-step-5--exam-guidelines-briefing)
7. [Step 6 — MCQ Exam Interface](#7-step-6--mcq-exam-interface)
8. [Step 7 — Practical Assessment Interface](#8-step-7--practical-assessment-interface)
9. [Step 8 — Session Close & Completion Screen](#9-step-8--session-close--completion-screen)
10. [AI Integrity Monitoring (Candidate-Facing Effects)](#10-ai-integrity-monitoring-candidate-facing-effects)
11. [Error States & Edge Cases](#11-error-states--edge-cases)
12. [Connectivity & API Dependencies](#12-connectivity--api-dependencies)

---

## 1. Overview & Candidate Journey

The Candidate Environment is the exam-taking interface delivered via a secure, browser-based platform accessible through a unique Magic Link sent to the candidate's registered email address. Candidates do not have a login account in the traditional sense — each exam session is authenticated through a one-time OTP sent to their email.

### 1.1 Complete Candidate Journey (at a Glance)

```
Magic Link Email Received
        ↓
Email Entry + OTP Verification
        ↓
Camera & Device Permission Grant
        ↓
Full-Screen Camera View (Waiting Room)
        ↓
Proctor-Led Verification (10-Item Checklist)
        ↓
Exam Guidelines Briefing
        ↓
Candidate Agreement + Recording Consent
        ↓
MCQ Exam (Question by Question)
        ↓
Practical Task Assignment (if applicable)
        ↓
Practical Task Completion & File Upload
        ↓
Session Closed — Completion Screen
```

### 1.2 What a Candidate Can Do

| Capability | Description |
|-----------|-------------|
| Authenticate via OTP | Secure single-session access via email link and OTP |
| Complete identity verification | Guided by proctor through visual and ID checks |
| Take MCQ exam | Answer one question at a time within the allotted time |
| Download & submit practical file | Receive task files and upload completed work |
| Communicate with proctor | Audio/video connection throughout the session |
| Report a technical issue | Raise hand on camera; cannot exit the exam independently |

### 1.3 What a Candidate Cannot Do

| Restriction | Reason |
|------------|--------|
| Cannot access previous questions | MCQ is one-directional — no going back once submitted |
| Cannot pause the exam independently | Only the proctor can pause sessions |
| Cannot change browser tab or window | Detected and flagged by AI monitoring |
| Cannot copy-paste in or out of the exam | Clipboard events are blocked and logged |
| Cannot exit full-screen during exam | Triggers an immediate warning and AI flag |
| Cannot re-enter after session closes | Magic link is invalidated at session end |
| Cannot view their score or report | Results are delivered to HR only |

---

## 2. Step 1 — Email Entry & OTP Authentication

### 2.1 Magic Link Access

The candidate receives a Magic Link via email from `noreply@assessexpert.ae`:

```
Subject: Your Assessment Invitation — [Assessment Name]
──────────────────────────────────────────────────────
Dear [Candidate Name],

You have been scheduled for an assessment:

  Assessment:   BIM Coordinator L2
  Date & Time:  Monday, 15 June 2026 — 10:00 AM (GST)
  Duration:     Approx. 90 minutes

  [Click Here to Begin Your Assessment]
  (Link valid for 30 minutes before your scheduled time)

Important: You will need access to a webcam, microphone,
and a stable internet connection.
──────────────────────────────────────────────────────
```

Clicking the link opens the assessexpert candidate portal in the browser at: `app.assessexpert.ae/exam/[session-token]`

### 2.2 OTP Authentication Screen

The first screen the candidate sees is the Email & OTP verification screen.

**Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│              [assessexpert Logo]                               │
│                                                                │
│         Welcome to Your Assessment                             │
│                                                                │
│  To verify your identity, please confirm your email           │
│  address and enter the one-time code we've sent you.          │
│                                                                │
│  Email Address:                                                │
│  ┌──────────────────────────────────────────────────────┐     │
│  │  ahmed.alrashidi@example.com                         │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                │
│  [Send OTP Code →]                                             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- The email field is **pre-filled** from the Magic Link token but the candidate must confirm it
- Candidate clicks `[Send OTP Code]` — a 6-digit OTP is dispatched to the confirmed email
- OTP is valid for **10 minutes**
- Maximum **3 attempts** before the session is temporarily locked (candidate must contact HR)

### 2.3 OTP Entry Screen

After clicking `[Send OTP Code]`, the screen transitions to:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│              [assessexpert Logo]                               │
│                                                                │
│         Enter Your Verification Code                           │
│                                                                │
│  A 6-digit code has been sent to:                             │
│  ahmed.alrashidi@example.com                                  │
│                                                                │
│  ┌──┐ ┌──┐ ┌──┐  ┌──┐ ┌──┐ ┌──┐                              │
│  │  │ │  │ │  │  │  │ │  │ │  │   ← OTP input boxes          │
│  └──┘ └──┘ └──┘  └──┘ └──┘ └──┘                              │
│                                                                │
│  [Verify & Continue →]                                         │
│                                                                │
│  Didn't receive it? [Resend Code] (available after 60s)       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Candidate enters 6-digit code — auto-advances on entry of the 6th digit
- On correct OTP: proceed immediately to Step 2 (Camera Permission)
- On incorrect OTP: error message `"Incorrect code. X attempts remaining."`
- On expiry: `"Code has expired. Please request a new code."`
- On lock (3 failed attempts): `"Your session has been temporarily locked. Please contact the assessment team."`

### 2.4 OTP Success State

On successful OTP verification:

```
✅  Identity confirmed — Ahmed Al-Rashidi
    Proceeding to device check...
```

The candidate is automatically advanced to Step 2 after a 1.5-second confirmation display.

---

## 3. Step 2 — Camera Permission & Device Check

### 3.1 Camera Permission Request Screen

After OTP verification, the candidate sees a permission instruction screen **before** the browser requests camera/microphone access:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│              [assessexpert Logo]                               │
│                                                                │
│         Camera & Microphone Required                           │
│                                                                │
│  This assessment requires access to your camera and           │
│  microphone throughout the entire session.                    │
│                                                                │
│  Please click [Allow] when your browser asks for permission.  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  📷  Camera — Required                                   │ │
│  │  🎙️  Microphone — Required                               │ │
│  │  🖥️  Screen Sharing — Will be requested shortly         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [Enable Camera & Microphone →]                               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

Clicking `[Enable Camera & Microphone]` triggers the browser's native camera + microphone permission dialog.

### 3.2 Permission Granted — Camera Preview

Once the candidate grants camera and microphone access, a live camera preview is shown:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│              [assessexpert Logo]                               │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐     │
│  │                                                      │     │
│  │           [LIVE CAMERA PREVIEW]                      │     │
│  │         (Candidate's own face visible)               │     │
│  │                                                      │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                │
│  ✅  Camera is active — your face is clearly visible          │
│  ✅  Microphone is active                                      │
│                                                                │
│  Please ensure:                                               │
│  • Your face is centred in the frame                         │
│  • The room behind you is clearly visible                    │
│  • You are in a well-lit area                                │
│                                                                │
│  [Continue to Assessment →]                                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 Automated Device Check

Before allowing the candidate to proceed, the system runs an automated device compatibility check:

| Check | Pass Criteria | Action if Fail |
|-------|--------------|----------------|
| Camera active | Feed detected, min resolution 480p | Show help: re-enable camera |
| Microphone active | Audio signal detected | Show help: re-enable microphone |
| Internet speed | ≥ 5 Mbps | Warning shown; candidate must confirm they understand |
| Browser | Chrome 90+ / Firefox 90+ / Edge 90+ | Show browser upgrade instructions |
| Screen resolution | ≥ 1280 × 720 | Warning shown |
| Fullscreen capable | Fullscreen API supported | Shown as required prerequisite |

**Check results display:**

```
  System Compatibility Check
  ──────────────────────────
  📷  Camera          ✅  Active (720p)
  🎙️  Microphone      ✅  Active
  🌐  Internet Speed  ✅  28.4 Mbps
  🖥️  Browser         ✅  Chrome 124
  📐  Resolution      ✅  1920 × 1080
  ⛶   Full Screen     ✅  Supported
  ──────────────────────────
  All checks passed. You may proceed.

  [Enter Waiting Room →]
```

### 3.4 Camera Permission Denied — Error State

If the candidate denies camera/microphone access:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ❌  Camera Access Required                                    │
│                                                                │
│  This assessment cannot proceed without camera access.        │
│                                                                │
│  To enable your camera:                                       │
│  1. Click the camera icon in your browser's address bar       │
│  2. Select "Allow" for Camera and Microphone                  │
│  3. Refresh this page                                         │
│                                                                │
│  [View Step-by-Step Instructions]  [Try Again]               │
│                                                                │
│  If you continue to have issues, please contact your          │
│  assessment coordinator.                                      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Step 3 — Full-Screen Camera & Verification Waiting Room

### 4.1 Entering the Waiting Room

Once the device check passes, the candidate's interface transitions to **full-screen mode**. The browser's Fullscreen API is invoked automatically — the browser's navigation bar, tabs, and OS taskbar are hidden.

If the candidate's browser does not automatically enter fullscreen, a prompt appears:

```
  ⛶  Full Screen Required

  This assessment must run in full-screen mode.

  [Enter Full Screen →]
```

The candidate cannot proceed to the waiting room without confirming full-screen mode.

### 4.2 Waiting Room Layout

The waiting room is the **core candidate view during the entire pre-exam verification phase**. It persists until the proctor clicks `[Begin Assessment]`.

**Layout — Full Screen:**

The candidate's own camera feed occupies the **entire screen** as a full-bleed background. Their face and surroundings are visible to them in real-time so they can self-monitor their appearance.

**Right Sidebar (fixed, overlaid on camera feed):**

A semi-transparent panel approximately 320px wide, anchored to the right side of the screen:

```
┌──────────────────────────────────────┐
│  assessexpert                        │
│  ─────────────────────────────────── │
│                                      │
│  VERIFICATION IN PROGRESS            │
│                                      │
│  Your proctor will join shortly and  │
│  guide you through the verification  │
│  process.                            │
│                                      │
│  Please remain seated and visible    │
│  on camera at all times.             │
│                                      │
│  ─────────────────────────────────── │
│  CURRENT STEP                        │
│  ─────────────────────────────────── │
│  [Step instruction updates here      │
│   in real-time as proctor progresses │
│   through the checklist]             │
│                                      │
│  ─────────────────────────────────── │
│  VERIFICATION PROGRESS               │
│  ─────────────────────────────────── │
│  ○  Camera verification              │
│  ○  Identity confirmation            │
│  ○  Government ID check              │
│  ○  Environment scan                 │
│  ○  Screen share & system check      │
│  ○  Guidelines briefing              │
│  ○  Agreement & consent              │
│  ○  Ready to begin                   │
│                                      │
│  ─────────────────────────────────── │
│  🔴  Camera must remain on at all    │
│      times during verification.      │
└──────────────────────────────────────┘
```

**Proctor Video Feed (small overlay):**

When the proctor joins the session, a small proctor video tile appears in the **bottom-left corner** of the candidate's screen:

```
  ┌─────────────────────┐
  │  [Proctor Video]    │
  │  Proctor: Ali Hassan│
  └─────────────────────┘
```

This tile:
- Is always visible throughout verification and the exam
- Sized approximately 200px × 150px
- Draggable — candidate can reposition it if it obscures exam content
- Cannot be minimised or dismissed

### 4.3 Real-Time Step Updates

As the proctor progresses through the 10-item Pre-Exam Checklist, the `CURRENT STEP` section of the candidate's right sidebar updates in real-time via WebSocket:

| Checklist Item (Proctor) | Candidate Sidebar Message |
|--------------------------|--------------------------|
| Item 1 — Camera Verification | `"Please ensure your face and upper body are clearly visible on camera."` |
| Item 2 — Verbal Identity | `"Please state your full legal name, email address, and the role you applied for. Confirm you are alone in the room."` |
| Item 3 — Government ID Check | `"Please hold your government-issued ID (Passport, National ID, or Emirates ID) clearly in front of the camera."` |
| Item 4 — Environment Scan | `"Please slowly rotate your camera 360° to show the entire room."` |
| Items 5–6 — Screen & System Check | `"Technical checks are in progress — please remain still and wait."` |
| Item 7 — Guidelines Briefing | `"Please listen carefully to the exam guidelines being read to you."` |
| Items 8–10 — Agreement & Consent | `"Please respond clearly to the proctor's questions."` |

As each checklist item is completed, the corresponding progress indicator on the right sidebar updates:

```
  ✅  Camera verification
  ✅  Identity confirmed
  ⏳  Environment scan in progress...
  ○   Screen share & system check
  ○   Guidelines briefing
  ○   Agreement & consent
  ○   Ready to begin
```

---

## 5. Step 4 — Pre-Exam Verification Phase (Proctor-Led)

The verification phase follows the proctor's 10-item checklist. The candidate's experience during each item is defined here from the candidate's perspective.

### 5.1 Candidate Actions Per Checklist Item

**Item 1 — Camera Verification**
- Candidate sits normally; ensures their face is centred and well-lit
- No active input required from candidate

**Item 2 — Verbal Identity Verification**
- Candidate speaks clearly and states:
  - Full legal name
  - Email address the invitation was sent to
  - Job role they applied for
  - Confirmation they are alone in the room

**Item 3 — Government ID Check**
- Candidate holds their government-issued ID (Passport / National ID / Emirates ID) up to the camera
- ID must be fully visible, not obscured by hands or glare
- System captures a screenshot; candidate may be asked to hold still for 2–3 seconds
- Facial recognition runs automatically — candidate sees no additional UI for this

**Item 4 — Environment Scan**
- Candidate lifts their camera (laptop or webcam) and slowly rotates it 360° to show the entire room
- Desk, walls, doors, and any second monitors must be visible
- Only permitted items may be on the desk: the candidate's computer, an empty glass of water (no labels)

**Item 5 — Screen Share**
The candidate receives an automatic popup (see Section 5.2 below).

**Item 6 — Technical System Check**
- No candidate action required; system checks run automatically
- Candidate sees a waiting indicator: `"Technical checks are running — please remain still."`

**Item 7 — Guidelines Briefing**
- The exam guidelines overlay appears on the candidate's screen (see Section 6 below)
- Candidate reads along as the proctor speaks

**Item 8 — Candidate Agreement**
- Proctor asks verbally: `"Do you confirm you understand and agree to the exam rules?"`
- Candidate responds verbally — the proctor records the response

**Item 9 — Recording Consent**
The candidate receives a consent popup on their screen:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  Session Recording Consent                                     │
│                                                                │
│  This session, including your camera feed and all screen      │
│  activity, will be recorded and stored securely for 7 days   │
│  for assessment verification and quality purposes.            │
│                                                                │
│           [✓ I Agree]          [I Do Not Agree]               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

If `[I Do Not Agree]` is selected: session cannot proceed and the candidate is shown a message to contact the assessment coordinator.

**Item 10 — Final Readiness**
- Proctor asks: `"Are you ready to begin your assessment?"`
- Candidate responds verbally
- Once the proctor confirms readiness, the interface transitions to the exam

### 5.2 Screen Share Consent Popup

Triggered automatically during verification (before or during Item 5):

```
┌────────────────────────────────────────────────────────────────┐
│  Screen Sharing Required                                       │
│                                                                │
│  This assessment requires you to share your full screen       │
│  with the proctor for the duration of the session.            │
│                                                                │
│  Your screen will be recorded as part of the integrity        │
│  verification process.                                         │
│                                                                │
│   [Share Screen — Full Screen Mode]     [I Have a Problem]    │
└────────────────────────────────────────────────────────────────┘
```

When `[Share Screen — Full Screen Mode]` is clicked:
- The browser's native screen share dialog opens
- Candidate **must select "Entire Screen"** — selecting a window or tab will show an error
- Once full-screen sharing is confirmed, the proctor's checklist Item 5 auto-updates

---

## 6. Step 5 — Exam Guidelines Briefing

### 6.1 Guidelines Overlay

During Checklist Item 7, a semi-transparent overlay appears over the candidate's full-screen camera view. The overlay has a dark background to ensure legibility while the camera feed is faintly visible behind it.

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                   EXAM GUIDELINES                              │
│                                                                │
│  This assessment consists of two parts:                       │
│  Part 1: Multiple-choice questions — [X] minutes.             │
│  Part 2: A practical task — [X] minutes.                      │
│                                                                │
│  Rules:                                                        │
│  • Your camera must remain active at all times.               │
│  • You may not use any external references, websites,         │
│    notes, or assistance from any person.                      │
│  • Do not minimise, switch, or close this browser window      │
│    during the assessment.                                     │
│  • Do not copy-paste content into or out of the exam.         │
│  • Questions are delivered one at a time. You cannot go       │
│    back to a previous question once submitted.                │
│  • For the practical task, you will receive instructions      │
│    and any required files directly from the proctor.          │
│  • If you experience a technical issue, raise your hand       │
│    on camera — do not exit the exam.                         │
│  • Any violation of these rules will be recorded and may      │
│    result in disqualification.                                │
│                                                                │
│  Please listen carefully as the proctor reads these           │
│  guidelines to you.                                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

At the end of the briefing:

```
  The proctor has finished reading the guidelines.
  Please confirm to the proctor that you understand and agree.
```

---

## 7. Step 6 — MCQ Exam Interface

### 7.1 Transition to Exam

When the proctor clicks `[Begin Assessment]`, the candidate's screen transitions from the full-screen camera verification view to the MCQ exam interface. The transition is instant — no loading screen — the question appears directly.

### 7.2 MCQ Exam Screen Layout

**Layout (full screen):**

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  assessexpert   |   BIM Coordinator L2 — MCQ Assessment        ⏱  28:42 remaining │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│  Question 3 of 25                                                                  │
│  ────────────────────────────────────────────────────────────────────────────────  │
│                                                                                    │
│  Which IFC entity is used to represent a structural column in an IFC-compliant    │
│  BIM model?                                                                        │
│                                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │  ○  A.  IfcBeam                                                             │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │  ○  B.  IfcColumn                                                           │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │  ○  C.  IfcWall                                                             │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │  ○  D.  IfcSlab                                                             │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                    │
│                                                          [Submit Answer →]         │
│                                                                                    │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                   [Proctor Video]                      📷 🔴 REC  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 MCQ Interface Elements

| Element | Description |
|---------|-------------|
| Assessment name & type | Top bar — assessment name and phase label |
| Timer | Countdown in real-time, server-side — displayed top-right; turns red when < 5 minutes remain |
| Question number | `"Question X of Y"` — candidate always knows their position |
| Question text | Displayed in a large, readable font; supports rich text, code blocks, and images |
| Answer options | Large clickable cards — each option is a full-width touchable area; selected option highlights in blue |
| Submit button | Appears only when an option is selected; single click submits and moves to next question |
| Proctor video | Small video tile — bottom-right corner, draggable; always visible |
| Recording indicator | `🔴 REC` — visible at all times to remind the candidate the session is recorded |

### 7.4 MCQ Behaviour Rules

- **One question at a time** — next question loads only after submitting the current one
- **No back navigation** — once a question is submitted, it cannot be revisited
- **No skipping** — the candidate must select an answer before submitting (cannot submit blank)
- **Auto-submit on timer expiry** — if the candidate has not submitted when the timer reaches 0:00, the current question is auto-submitted with the last selected option (or unanswered if none selected)
- **Timer is server-side** — the timer cannot be manipulated by the candidate's browser
- **Copy-paste blocked** — right-click context menu is disabled; Ctrl+C / Ctrl+V events are intercepted, blocked, and logged

### 7.5 Multiple Choice Questions (Select All That Apply)

For `Multiple Choice` type questions (where more than one correct answer exists), the layout changes:

- Answer options show checkboxes instead of radio buttons
- Instructions note: `"Select all correct answers"`
- `[Submit Answer]` button remains locked until at least one option is selected

### 7.6 Timer Warning States

| Remaining Time | UI Change |
|---------------|-----------|
| > 10 minutes | Timer displayed normally in dark text |
| 5–10 minutes | Timer displayed in amber with a pulsing indicator |
| < 5 minutes | Timer displayed in red with bold text; gentle pulsing animation |
| 1 minute | A non-dismissible overlay: `"⏱ 1 minute remaining — please submit your current answer."` |
| 0:00 | Auto-submit triggers; transition to next phase or session close |

### 7.7 MCQ Completion Screen (Transition to Practical)

After the final MCQ question is submitted:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ✅  MCQ Assessment Complete                                   │
│                                                                │
│  You have answered all 25 questions.                          │
│                                                                │
│  Your proctor will now assign your practical task.            │
│  Please remain on camera and wait for instructions.           │
│                                                                │
│  ─────────────────────────────────────────────────────────    │
│  ⏳  Waiting for proctor to begin the practical phase...      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

> For MCQ-Only assessments, this screen instead reads: "Your assessment is complete. Please remain on camera until the proctor closes the session."

---

## 8. Step 7 — Practical Assessment Interface

### 8.1 Practical Task Assignment Popup

When the proctor clicks `[Assign Task & Start Practical Phase]`, a popup appears on the candidate's screen:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  PRACTICAL ASSESSMENT — PART 2 OF 2                           │
│                                                                │
│  Task:      BIM Model Quality Check                           │
│  Duration:  60 minutes                                         │
│                                                                │
│  Instructions:                                                 │
│  [Task description as configured in Exam Setup]               │
│                                                                │
│  ────────────────────────────────────────────────────────     │
│  Step 1:  Download the starter file below                     │
│  Step 2:  Complete the task in your software                  │
│  Step 3:  Upload your completed file before the timer ends    │
│  ────────────────────────────────────────────────────────     │
│                                                                │
│  [⬇  Download Starter File: model_v2.rvt]                    │
│                                                                │
│  ☐  I confirm I have read the task instructions and I         │
│     agree to the assessment rules.                            │
│                                                                │
│               [Begin Practical Task →]                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

`[Begin Practical Task]` is locked until:
- The candidate has checked the confirmation checkbox
- The starter file download is confirmed (if applicable)

### 8.2 Practical Exam Screen Layout

Once `[Begin Practical Task]` is clicked, the practical exam interface loads:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  assessexpert  |  BIM Coordinator L2 — Practical Task             ⏱  54:20 rem  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  TASK: BIM Model Quality Check                                                   │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  Using the provided Revit project file, complete the column footing shop         │
│  drawing as per the specifications defined in the drawing notes. Export as       │
│  IFC and upload your completed file.                                             │
│                                                                                  │
│  [⬇ Download Starter File: model_v2.rvt]                                        │
│                                                                                  │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  SUBMIT YOUR WORK                                                                │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                          │   │
│  │        Drag and drop your file here, or click to browse                  │   │
│  │                                                                          │   │
│  │        Accepted formats: .rvt / .ifc / .dwg / [as specified]            │   │
│  │        Max file size: 100 MB                                              │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│                                              [📤  Submit Final Work]            │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                   [Proctor Video]                    📷 🔴 REC  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Practical Interface Elements

| Element | Description |
|---------|-------------|
| Task title & description | Full task description always visible; candidate can scroll if long |
| Timer | Practical countdown — server-side; same warning colour states as MCQ |
| Starter file download | Persistent download button; candidate can re-download if needed |
| File upload area | Drag-and-drop or click-to-browse; shows file name and size on selection |
| Submit button | Labelled `[Submit Final Work]` — requires a file to be selected |
| Proctor video | Always-visible draggable tile |
| Recording indicator | `🔴 REC` visible at all times |

### 8.4 File Upload Behaviour

- **Before upload:** Drop zone is empty with instructions
- **File selected:** Drop zone shows: `"✅ model_v2_final.rvt — 14.2 MB — Ready to submit"`
- **Re-selection allowed:** Candidate can replace the file before final submission
- **Upload progress:** On clicking `[Submit Final Work]`, a progress bar appears: `"Uploading... 64%"`
- **Upload complete:** `"✅ Your file has been submitted successfully. Time: 10:24 AM"`
- **After submission:** The upload area is locked and shows the submission confirmation. The candidate can still work until the timer ends but cannot re-submit unless the proctor grants a re-submission allowance

### 8.5 Coding Assessment Variant

For assessments with a coding practical task, the interface instead shows an in-browser code editor:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  assessexpert  |  Python Developer — Practical Task                ⏱  41:07 rem │
├──────────────────────────────────────────────────────────────────────────────────┤
│  TASK: Sum of Array Elements                                                     │
│  Write a Python function that takes a list of integers and returns their sum.    │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  Input Format:  A list of integers                                               │
│  Output Format: An integer (the sum)                                             │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  CODE EDITOR                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  def solution(arr):                                                      │   │
│  │      # Write your code here                                              │   │
│  │      pass                                                                │   │
│  │                                                                          │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│  SAMPLE TEST CASES (public)                                                     │
│  Input: [5, 3, 8]    Expected: 16    Your Output: —                             │
│  Input: [1, 1, 1]    Expected: 3     Your Output: —                             │
│                                                                                  │
│  [▶  Run Tests]                              [✅  Submit Final Solution]         │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Public test cases** are visible to the candidate; they can run their code against them
- **Hidden test cases** run only on final submission — results are not shown to the candidate
- Candidate can run tests as many times as they like; only the final submission is graded

### 8.6 Time Extension (Exceptional)

If the proctor grants a time extension to a specific candidate:

```
  ⏱  Your proctor has extended your time by 10 minutes.
  New end time: 12:10 PM
```

A brief notification appears at the top of the screen for 10 seconds, and the timer adjusts accordingly.

---

## 9. Step 8 — Session Close & Completion Screen

### 9.1 Practical Timer Expiry

When the practical timer reaches 0:00:

- If a file has already been submitted: the session closes gracefully
- If no file has been submitted: an auto-close warning appears:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ⏱  Time's Up                                                 │
│                                                                │
│  Your practical assessment time has ended.                    │
│                                                                │
│  If you have not yet submitted your file, your assessment      │
│  will be marked as incomplete for this section.               │
│                                                                │
│  Please remain on camera until the proctor closes the         │
│  session.                                                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 9.2 Session Close Screen

Once the session is officially closed by the system (or the proctor):

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                    [assessexpert Logo]                         │
│                                                                │
│         ✅  Assessment Complete                                 │
│                                                                │
│  Thank you, Ahmed. Your assessment has been completed.        │
│                                                                │
│  ─────────────────────────────────────────────────────────    │
│  What happens next:                                            │
│                                                                │
│  1. Your assessment is now being reviewed by your proctor.    │
│  2. A report will be shared with the hiring team.             │
│  3. The hiring team will be in touch with you directly.       │
│                                                                │
│  ─────────────────────────────────────────────────────────    │
│  You may now close this browser window.                        │
│                                                                │
│                           [Close Window]                       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**On session close:**
- Magic link is immediately invalidated — the URL can no longer be accessed
- Screen recording upload finalises (all buffered segments flushed to server)
- Camera and microphone streams are terminated
- Full-screen mode is exited automatically

---

## 10. AI Integrity Monitoring (Candidate-Facing Effects)

The AI proctoring engine runs silently throughout the session. The candidate is not shown the AI monitoring details, but they experience its effects through warnings and alerts.

### 10.1 Candidate-Visible AI Alerts

| AI Event | What Candidate Sees |
|----------|---------------------|
| Face absent > 8 seconds | `"⚠️ Please ensure your face is visible on camera."` — banner at top of screen |
| Multiple faces detected | `"⚠️ Only you should be in the room during the assessment."` — banner |
| Tab switch detected | `"⚠️ You must not switch browser tabs during the assessment. This event has been recorded."` |
| Fullscreen exit | `"⛶ Please return to full-screen mode immediately."` — mandatory prompt blocks the exam until restored |
| Copy-paste attempt | Silent block — action fails; no content is copied or pasted; event is logged |
| Audio anomaly | No alert shown to candidate — flagged silently to proctor |

### 10.2 Warning Banner Behaviour

Warning banners appear at the top of the screen:
- Appear with a red background and white text
- Auto-dismiss after 10 seconds (except fullscreen exit — that blocks until resolved)
- All warnings are logged to the proctor's event log in real-time

### 10.3 Session Termination (by Proctor)

If the proctor terminates the session due to an integrity violation:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ⛔  Your Assessment Has Been Terminated                       │
│                                                                │
│  The proctor has ended this assessment session.               │
│                                                                │
│  Reason: [Reason provided by proctor, if applicable]          │
│                                                                │
│  Please contact your assessment coordinator for further       │
│  information.                                                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

The session is permanently closed and the magic link is invalidated.

---

## 11. Error States & Edge Cases

### 11.1 Internet Disconnection During Exam

If the candidate's internet connection drops:

```
  🔴  Connection Lost

  Your internet connection has been interrupted.
  Please reconnect — your progress is being saved.
  Reconnecting... (spinner)
```

- The exam timer is paused server-side if disconnection lasts > 15 seconds
- The proctor is notified immediately via WebSocket disconnect event
- On reconnection: the exam resumes from where it left off
- If disconnection lasts > 5 minutes: the session enters a `Paused — Technical Issue` state; the proctor is alerted and decides whether to resume or reschedule

### 11.2 Browser Crash / Accidental Window Close

- If the candidate closes the browser or the browser crashes: the magic link remains valid until the session timer expires
- Candidate can re-open the link and rejoin the session in the same state
- All previously submitted MCQ answers are preserved server-side
- The proctor is notified of the disconnect and reconnect events

### 11.3 Fullscreen Exit During Exam

If the candidate exits fullscreen (e.g., accidentally presses Escape):

- The exam interface is immediately obscured by a blocking overlay:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ⛶  Full Screen Required                                       │
│                                                                │
│  This assessment must run in full-screen mode.                │
│  Please return to full-screen to continue.                    │
│                                                                │
│            [Return to Full Screen →]                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

- The exam timer continues to run server-side while this overlay is shown
- The proctor is alerted: `"Candidate exited fullscreen — [Timestamp]"`
- The event is logged to the integrity audit trail

### 11.4 Session Not Yet Open

If a candidate clicks the magic link more than 30 minutes before their scheduled session time:

```
  🕐  Your assessment isn't open yet.

  Your session is scheduled for:
  Monday, 15 June 2026 — 10:00 AM (GST)

  Please return 15 minutes before your scheduled time.
  Do not close this page — it will open automatically.
```

The page auto-refreshes every 60 seconds and transitions to the OTP screen when the session opens.

### 11.5 Expired Magic Link

If the candidate tries to use an expired or already-used magic link:

```
  ❌  This link is no longer valid.

  Assessment links can only be used once and expire after the
  session has ended.

  If you believe this is an error, please contact your
  assessment coordinator.
```

---

## 12. Connectivity & API Dependencies

### 12.1 Candidate-Facing APIs

| Feature | Endpoint | Method |
|---------|----------|--------|
| Verify email + send OTP | `POST /api/candidate/auth/send-otp` | REST |
| Verify OTP | `POST /api/candidate/auth/verify-otp` | REST |
| Get session details | `GET /api/candidate/sessions/{token}` | REST |
| Submit device check results | `POST /api/candidate/sessions/{token}/device-check` | REST |
| Update screen share status | `PUT /api/candidate/sessions/{token}/screen-share` | REST |
| Confirm recording consent | `POST /api/candidate/sessions/{token}/consent` | REST |
| Get next MCQ question | `GET /api/candidate/sessions/{token}/questions/next` | REST |
| Submit MCQ answer | `POST /api/candidate/sessions/{token}/questions/{id}/answer` | REST |
| Download practical starter file | `GET /api/candidate/sessions/{token}/practical/file` | REST |
| Upload practical submission | `POST /api/candidate/sessions/{token}/practical/submission` | REST (multipart) |
| Request time extension | `POST /api/candidate/sessions/{token}/extension-request` | REST |

### 12.2 Real-Time WebSocket Events

| Event (Inbound — server → candidate) | Description |
|--------------------------------------|-------------|
| `session.open` | Session becomes active; OTP screen enabled |
| `verification.step.update` | Proctor advanced checklist — sidebar instruction updates |
| `verification.progress` | Checklist item completed — progress indicator updates |
| `exam.start` | Proctor started the exam; interface transitions to MCQ |
| `practical.assign` | Proctor assigned practical task; popup appears |
| `proctor.message` | Message sent by proctor — shown as a notification overlay |
| `session.pause` | Proctor paused the session — overlay shown |
| `session.resume` | Session resumed — overlay dismissed |
| `session.terminate` | Proctor or system terminated session — termination screen shown |
| `session.close` | Exam timer expired — session close screen shown |
| `time.extension` | Proctor granted time extension — timer updated |

| Event (Outbound — candidate → server) | Description |
|---------------------------------------|-------------|
| `camera.status` | Camera active/inactive status |
| `screen.share.status` | Screen share active/disconnected |
| `consent.accepted` | Candidate accepted recording consent |
| `fullscreen.exit` | Candidate exited fullscreen |
| `tab.switch` | Candidate switched tabs |
| `clipboard.attempt` | Copy/paste attempt detected |
| `file.downloaded` | Candidate downloaded the practical starter file |
| `file.submitted` | Candidate uploaded practical submission |

### 12.3 Video & Audio (WebRTC)

- Candidate webcam feed (sent to proctor): WebRTC send-only stream
- Screen share (sent to proctor): WebRTC send-only stream
- Proctor video feed (received by candidate): WebRTC receive-only stream
- Proctor audio (received by candidate): WebRTC receive-only
- All streams encrypted in transit (DTLS-SRTP)
- ICE servers: STUN/TURN provided by assessexpert infrastructure

### 12.4 AI Monitoring (Client-Side)

All client-side AI monitoring runs in a WebWorker to prevent performance impact on the exam interface:

| Monitor | Technology | Trigger |
|---------|-----------|---------|
| Face detection | MediaPipe FaceDetection | Runs every 2 seconds |
| Multiple face detection | MediaPipe FaceDetection | Runs every 2 seconds |
| Gaze tracking | MediaPipe FaceMesh | Runs every 3 seconds |
| Audio anomaly detection | WebAudio API | Continuous |
| Tab visibility | Page Visibility API | Event-based |
| Clipboard events | Clipboard API + event listeners | Event-based |
| Fullscreen state | Fullscreen API | Event-based |
| Keyboard monitoring | Event listener | Event-based (PrintScreen etc.) |

Events from the WebWorker are sent to the server via WebSocket, which forwards them to the proctor in real-time.

---

*Document: Candidate Environment Specification — assessexpert v1.0*
*Prepared: May 2026 | Platform: assessexpert.ae*
*See also: `Proctor_Dashboard.md` | `Admin_Dashboard.md` | `HR_Dashboard.md` | `ExamSetup_Master.md` | `Master_Proctor_Dashboard.md` | `Assessexpert_Platform_Development.md`*
*"Every result verified. Every hire protected."*
