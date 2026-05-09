# assessexpert — Master Platform Development Specification
## B2B SaaS Pre-Employment Assessment Portal — Complete Build Document

> **Version:** 6.0 — Master Consolidated Specification
> **Classification:** INTERNAL — Development, Product & Engineering Team
> **Status:** Approved for Development
> **Date:** May 2026
> **Prepared by:** Development Manager — assessexpert / Orbit Training
> **Hosting:** Hostinger VPS (Ubuntu 22.04 LTS)
> **Domain:** assessexpert.ae | app.assessexpert.ae

---

## ⚠️ DOCUMENT PURPOSE

This is the **single authoritative source of truth** for building the assessexpert platform. All previous documents (Admin_Dashboard.md, HR_Dashboard.md, Proctor_Dashboard.md, Master_Proctor_Dashboard.md, ExamSetup_Master.md, Candidate_Environment.md, Assessexpert_Platform_Development.md) are superseded by this file. Every developer, designer, and QA engineer should be able to build the entire platform from this document alone.

**Key updates in v6.0:**
- Infrastructure rewritten for Hostinger VPS (no AWS, no Cloudflare paid enterprise)
- Three.js / WebGL animations removed from all portals and the website hero
- Question bank upgraded: 500 questions per assessment type with Fisher-Yates shuffle
- Candidate report now includes full question-by-question breakdown: what was asked, what the candidate answered, and whether it was correct
- Master Proctor can create and fully configure new exams end-to-end

---

## Table of Contents

**PART 1 — PRODUCT OVERVIEW**
1. [Platform Vision & Business Model](#1-platform-vision--business-model)
2. [What assessexpert Is & Is Not](#2-what-assessexpert-is--is-not)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Master Service Flow](#4-master-service-flow)

**PART 2 — PUBLIC WEBSITE**
5. [Marketing Website](#5-marketing-website)

**PART 3 — EXAM ENGINE — THE CORE PRODUCT**
6. [Question Bank Architecture — 500 Questions + Shuffle](#6-question-bank-architecture--500-questions--shuffle)
7. [Phase 1 — Pre-Session: HR Config & Candidate Scheduling](#7-phase-1--pre-session-hr-config--candidate-scheduling)
8. [Phase 2 — Proctor Pre-Exam Checklist](#8-phase-2--proctor-pre-exam-checklist)
9. [Phase 3 — MCQ Assessment (30 Minutes)](#9-phase-3--mcq-assessment-30-minutes)
10. [Phase 4 — Practical Assessment (60 Minutes)](#10-phase-4--practical-assessment-60-minutes)
11. [Phase 5 — Session Close](#11-phase-5--session-close)
12. [Phase 6 — AI Report Generation](#12-phase-6--ai-report-generation)
13. [Phase 7 — Proctor Review & Report Publication](#13-phase-7--proctor-review--report-publication)
14. [Phase 8 — HR Dashboard Report Access](#14-phase-8--hr-dashboard-report-access)

**PART 4 — PORTAL MODULES (All Dashboards)**
15. [Candidate Environment](#15-candidate-environment)
16. [Super Admin Dashboard](#16-super-admin-dashboard)
17. [Master Proctor Dashboard](#17-master-proctor-dashboard)
18. [Proctor Dashboard](#18-proctor-dashboard)
19. [Exam Setup Master Dashboard](#19-exam-setup-master-dashboard)
20. [HR Manager Dashboard](#20-hr-manager-dashboard)
21. [Sales Agent Panel](#21-sales-agent-panel)

**PART 5 — PLATFORM SYSTEMS**
22. [Authentication & Access System](#22-authentication--access-system)
23. [AI Proctoring & Facial Recognition Engine](#23-ai-proctoring--facial-recognition-engine)
24. [Screen Recording System](#24-screen-recording-system)
25. [Grading & Evaluation Engine](#25-grading--evaluation-engine)
26. [Report Generation — Full Candidate Answer Breakdown](#26-report-generation--full-candidate-answer-breakdown)
27. [Notification & Communication System](#27-notification--communication-system)
28. [Internationalization & RTL Support](#28-internationalization--rtl-support)

**PART 6 — FRONTEND DESIGN SYSTEM**
29. [Design Tokens & Visual Language](#29-design-tokens--visual-language)
30. [UI Components & Layout Rules](#30-ui-components--layout-rules)

**PART 7 — ARCHITECTURE & INFRASTRUCTURE (Hostinger VPS)**
31. [Technology Stack](#31-technology-stack)
32. [Hostinger VPS Infrastructure Setup](#32-hostinger-vps-infrastructure-setup)
33. [Backend Architecture](#33-backend-architecture)
34. [Database Design](#34-database-design)
35. [Security & Compliance](#35-security--compliance)
36. [Performance & Scalability on VPS](#36-performance--scalability-on-vps)

**PART 8 — DELIVERY**
37. [Development Phases & Timeline](#37-development-phases--timeline)
38. [Testing Strategy](#38-testing-strategy)
39. [Pre-Launch Checklist](#39-pre-launch-checklist)

**APPENDICES**
- [Appendix A — Assessment Types Matrix](#appendix-a--assessment-types-matrix)
- [Appendix B — All Notification Templates](#appendix-b--all-notification-templates)
- [Appendix C — Full API Endpoint Reference](#appendix-c--full-api-endpoint-reference)
- [Appendix D — Database Schema (Prisma)](#appendix-d--database-schema-prisma)

---

# PART 1 — PRODUCT OVERVIEW

---

## 1. Platform Vision & Business Model

### 1.1 Platform Definition

> **assessexpert is a global B2B SaaS pre-employment assessment platform that enables companies in any industry to conduct structured, AI-proctored technical assessments — delivered through a proctor-controlled exam lifecycle — producing AI-generated, human-reviewed assessment reports.**

The platform is **not** a quiz builder. It is a managed assessment service in software form. Every session follows a precise, repeatable professional protocol from verified check-in to published report.

### 1.2 Business Model

assessexpert is **pure B2B, sales-led**. No public checkout. No self-signup. No payment gateway.

```
Contact Us (website) → Sales Demo → Commercial Agreement
→ Admin onboards company → HR uses platform
→ All billing handled entirely offline by Sales team
```

**No payment module is built into this platform.**

### 1.3 Core Differentiators

| Differentiator | Description |
|---|---|
| Proctor-controlled session lifecycle | Sessions only begin when a certified proctor completes a formal pre-exam checklist |
| Structured two-part exam | MCQ screening (30 min) always precedes practical assessment (60 min) — enforced by platform |
| 500-question bank with shuffle | Each assessment type maintains 500 MCQ questions; each candidate receives 25 randomly shuffled, ensuring no two candidates get the same paper |
| One-question-at-a-time delivery | Questions served individually, server-side — no bulk download, no caching |
| Full candidate answer report | Candidate report shows every question attempted, the answer given, and whether it was correct |
| AI report → Proctor review → Published | Reports never auto-publish; every report is reviewed and manually published by a proctor |
| Screen recording with 7-day retention | All sessions recorded and available to HR for 7 days, then auto-purged |
| Tenant-isolated data | Each company sees only their own candidates, sessions, and reports |

---

## 2. What assessexpert Is & Is Not

### assessexpert IS:
✅ A universal pre-employment assessment platform — any industry, any job type  
✅ An on-demand managed service — HR uploads a list, the system does the rest  
✅ A proctor-first platform — human proctor drives the exam lifecycle, supported by AI  
✅ A two-phase exam engine — MCQ theory test always followed by a practical task  
✅ A 500-question shuffled exam system — no two candidates see the same question set  
✅ A report publication workflow — AI drafts, proctor reviews, publishes; HR reads published reports  
✅ A multi-tenant B2B portal — each company sees only their own data, always  
✅ A global platform — available in every country with IP-based localization  

### assessexpert IS NOT:
❌ A self-service quiz or form builder  
❌ A public assessment marketplace or job board  
❌ A platform with a payment page or checkout  
❌ A system where candidates can see their own reports (reports go to HR only)  
❌ A platform where reports auto-publish without proctor review  
❌ An LMS or learning platform  

---

## 3. User Roles & Permissions

### 3.1 Role Hierarchy

```
╔═══════════════════════════════════════════════════════════════╗
║  assessexpert INTERNAL                                        ║
║  ├── Super Admin          Full platform control               ║
║  ├── Master Proctor       Senior operational + content lead   ║
║  ├── Exam Setup Master    Exam content creation & management  ║
║  └── Sales Agent          Client pipeline + onboarding        ║
╠═══════════════════════════════════════════════════════════════╣
║  CLIENT ORGANIZATION (per company — strict tenant isolation)  ║
║  ├── Org Admin            Full org control                    ║
║  ├── HR Manager           Candidates, scheduling, reports     ║
║  ├── Hiring Manager       View published reports only         ║
║  └── Proctor              Control sessions, review & publish  ║
╠═══════════════════════════════════════════════════════════════╣
║  EPHEMERAL (no persistent account)                            ║
║  └── Candidate            Session-only access via magic link  ║
╚═══════════════════════════════════════════════════════════════╝
```

### 3.2 Permission Matrix

| Action | Super Admin | Master Proctor | Exam Setup Master | Sales Agent | Org Admin | HR Manager | Hiring Mgr | Proctor | Candidate |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Manage all organizations | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage assigned clients | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Create / configure exams** | ✅ | **✅** | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Manage 500-question bank** | ✅ | **✅** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Upload candidate lists | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Start / control exam session | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Complete proctor checklist | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Assign practical task | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View AI draft report | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Modify AI report | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Publish final report | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View published reports | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View screen recordings | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Take exam | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

> **Tenant isolation is absolute.** No HR Manager, Proctor, or Org Admin can ever see another company's data. Enforced at the database query level — not just the UI.

---

## 4. Master Service Flow

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SETUP (Once per company)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Sales team signs client agreement
        ↓
 Super Admin creates company account + assigns Sales Agent
        ↓
 HR Manager(s) receive welcome email + login credentials
        ↓
 HR completes platform tutorial (guided onboarding)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PER HIRING CYCLE (Repeatable by HR)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 HR selects an assessment type
  └── System draws 25 questions from the 500-question pool
       via Fisher-Yates shuffle (unique set per candidate)
  └── HR selects or confirms practical task type
 HR uploads candidate list (CSV/Excel)
        ↓
 System auto-schedules based on proctor availability + timezone
        ↓
 Automated emails sent to every candidate:
  - Invitation email + scheduled time (local timezone)
  - Pre-exam instructions + system requirements
  - Reminders: 24h + 1h before

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 EXAM DAY — PROCTOR-CONTROLLED SESSION LIFECYCLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Candidate logs in via magic link (email OTP authentication)
 Camera verified → Mandatory (cannot proceed without)
        ↓
 PROCTOR PRE-EXAM CHECKLIST (10–15 min)
  [✓] Camera confirmed active
  [✓] Proctor verbally verifies: name, email, government ID
  [✓] Full background scan (surroundings clean, no notes)
  [✓] No unauthorized materials visible
  [✓] Facial recognition: ID photo vs live selfie
  [✓] GuardPro agent connected (if required for this assessment)
  [✓] Screen share confirmed active
  [✓] Proctor reads exam guidelines to candidate (5 min)
  [✓] Candidate verbally agrees to rules
  [✓] Recording consent acknowledged
  → Proctor clicks "Begin Assessment" → Exam unlocks
        ↓
 PHASE 1: MCQ ASSESSMENT (30 minutes)
  - 25 questions drawn from 500-question pool via server-side shuffle
  - Questions served ONE AT A TIME (no bulk download)
  - Each question fetched server-side on "Next" click
  - Server-side timer (30 min total — 1 min 12 sec avg per question)
  - AI proctoring + screen recording active throughout
  - No back navigation — each question submitted on "Next"
  - Auto-submits at 30 min
        ↓
 PROCTOR ASSIGNS PRACTICAL TASK (2–3 min gap)
  - MCQ ends → screen shows "MCQ Complete. Stand by."
  - Proctor reviews MCQ summary, selects practical task
  - Proctor clicks "Assign Practical Task" → Task screen unlocks
        ↓
 PHASE 2: PRACTICAL ASSESSMENT (60 minutes)
  - CAD/BIM: Download starter file → work in software → upload output
  - Coding: Monaco editor in-browser → write + run code → submit
  - Networking/IT Lab: Virtual lab browser interface → configure/solve
  - All screen-recorded; AI monitors throughout
        ↓
 EXAM COMPLETE
  - Candidate screen: "Thank you for completing your assessment."
  - Magic link invalidated immediately

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 POST-EXAM — REPORT PIPELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 AI generates draft report including full question breakdown
        ↓
 Report visible to Proctor ONLY (HR cannot see yet)
        ↓
 Proctor reviews AI report:
  - Reviews MCQ scores, AI evaluations, practical task
  - Reviews screen recording
  - Reviews integrity score + FR log
  - Modifies any AI-generated content as needed
  - Writes proctor narrative + verdict
        ↓
 Proctor clicks "Publish Report"
        ↓
 Report becomes visible on Company HR Dashboard:
  - Full report PDF with digital signature
  - MCQ breakdown: each question, candidate's answer, correct answer
  - Practical evaluation + competency radar
  - Screen recording (available for 7 days)
  - Integrity score + proctor verdict
        ↓
 HR downloads report, views recording, makes hiring decision
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

# PART 2 — PUBLIC WEBSITE

---

## 5. Marketing Website

### 5.1 Purpose

The public website at `assessexpert.ae` exists for one purpose: **generate qualified B2B leads** for the Sales team. Every section, every CTA points to a single conversion goal: **Request a Demo / Contact Us**.

There is no pricing page. No sign-up button. No platform access from the website.

### 5.2 Visual Identity — Professional Dark Enterprise

**Design concept:** Precise, data-driven, professional. The website should communicate that assessexpert is the most serious hiring technology a company's HR Director has ever seen. Dark-first, clean, minimal animation — CSS transitions and subtle GSAP reveals only (no Three.js / WebGL).

| Element | Specification |
|---|---|
| Background | `#060B18` base, `#0A1020` surface |
| Primary accent | Electric Cyan `#00D4FF` |
| Secondary accent | Violet `#6D28D9` |
| Success/pass | Emerald `#059669` |
| Warning | Amber `#D97706` |
| Critical/fail | Rose `#E11D48` |
| Surface cards | Glassmorphism `rgba(255,255,255,0.04)` with `rgba(255,255,255,0.08)` border |
| Typography | Inter (UI), JetBrains Mono (code samples) |
| Animation | GSAP 3 + ScrollTrigger (scroll reveals, counter animations only) |
| **No Three.js** | ❌ No WebGL / particle globe / 3D elements anywhere on site |

### 5.3 Page Specifications

#### Home Page (`/`)

**Hero Section**
- Full viewport dark background — CSS gradient mesh (no WebGL)
- Animated CSS grid/dot pattern background (CSS only, performant)
- GSAP SplitText headline: **"Pre-Employment Assessment, Engineered for Precision"**  
  Characters stagger-in from below, 30ms delay each
- Sub-headline fades in 600ms after headline
- CTA buttons: `[Request a Demo]` (primary — cyan glow border) + `[See How It Works]` (ghost with animated arrow)
- Trust bar below hero: client logos (greyscale) + `"Trusted across 40+ countries"`
- Scroll indicator: animated chevron

**The Problem We Solve**
- 3-column stat cards (CountUp.js on scroll-enter)
- `"Bad hires cost companies 30% of annual salary"` | `"72% of CVs misrepresent technical skills"` | `"Manual screening doesn't scale past 20 candidates"`
- Glassmorphism card style, subtle border glow

**How It Works — Animated Timeline**
- 7-step process matching master flow
- GSAP ScrollTrigger vertical pin — active step highlights as user scrolls
- Right panel: static mockup screenshot of relevant portal screen per step
- Steps: HR Configures Test → Upload Candidates → Auto-Schedule → Proctor Starts Session → Two-Part Exam → AI Draft Report → Published to HR Dashboard

**The 500-Question Shuffle — Our Exam Integrity**
- New section explaining question bank depth and shuffle system
- Visual: animated card stack shuffle (CSS animation)
- Copy: `"500 questions per assessment. 25 randomly selected per candidate. No two candidates ever see the same exam."` 
- Subtext explaining this eliminates answer-sharing between candidates

**All Test Types**
- Horizontal scrollable card strip — 5 card types: MCQ Knowledge, Coding Challenge, CAD/BIM Practical, Networking Virtual Lab, Hybrid
- Each card: SVG illustration, name, description, "Best for" tag
- Hover: card expands, micro-glow, example use cases appear

**The Two-Phase Exam**
- Visual split showing MCQ (30 min) → Practical (60 min) workflow
- Animated timeline with proctor touchpoints highlighted

**The Proctor Difference**
- Full-width dark section
- Left: proctor dashboard mockup (static screenshot with CSS overlay animation)
- Right: copy explaining human + AI verification

**AI Report → Published**
- Visual pipeline: AI Draft → Proctor Reviews → Proctor Publishes → HR Dashboard
- Sample report page preview (redacted but realistic)
- Highlight: "Every report shows the candidate's full question-by-question MCQ response"

**Security & Compliance**
- Icons: Facial Recognition, AI + Human Proctoring, Encrypted Recordings, 7-Day Secure Storage, Multi-Tenant Isolation
- SSL, data protection compliance logos

**Testimonials**
- 3-card auto-rotating carousel (pause on hover)
- Glassmorphism cards, client logo + quote + name/title

**Global Platform**
- SVG world map (dark-themed, CSS-animated pulsing country dots)
- Stats: `"42 countries"`, `"500,000+ assessments"`, `"98.7% integrity rating"`, `"< 24h report delivery"`

**CTA Section**
- Full-width diagonal gradient (cyan → violet)
- `"Ready to transform your technical hiring?"` + `[Contact Our Team]`

**Footer**
- Company links, solution links, legal links
- Language selector (English / Arabic)
- `"assessexpert.ae | Powered by Orbit Training · Dubai, UAE"`

#### Contact Page (`/contact`)
- Company name, full name, role, email, phone, company size
- Assessment type of interest (multi-select)
- Message field
- **Business email validation** — free Gmail/Yahoo/Hotmail blocked
- On submit: lead goes to Sales Agent (portal + email notification) + auto-reply to prospect
- No payment or pricing information anywhere on this page

#### Solutions Pages (`/solutions/[industry]`)
- One page per industry vertical
- Industry-specific content: common job roles, assessment types available, example report preview
- CTA: Contact Us for this industry

#### Verification Page (`verify.assessexpert.ae`)
- Public, no authentication required
- Input: Report ID or QR scan
- Output: Candidate name, assessment type, pass/fail result, published date, proctor name
- Does NOT reveal score details or question breakdown — verification only

---

# PART 3 — EXAM ENGINE — THE CORE PRODUCT

---

## 6. Question Bank Architecture — 500 Questions + Shuffle

### 6.1 Overview

Each assessment type maintains a pool of **500 active MCQ questions**. When a candidate's exam session is created, the server draws exactly **25 questions** using a cryptographically seeded Fisher-Yates shuffle. The question set is generated at the moment the proctor clicks "Begin Assessment" and stored against the session — not before, not client-side.

**This ensures:**
- No two candidates in the same session (or different sessions) see the same 25 questions
- No predictable pattern that candidates could exploit by sharing answers
- Every question used is logged against the session for the candidate report
- The question pool can be managed without disrupting scheduled sessions

### 6.2 Question Pool Structure

```
Assessment Type: e.g., "BIM Coordinator Level 2"
  └── Question Pool: 500 Active Questions
       ├── Domain: Revit Fundamentals         (100 questions)
       ├── Domain: BIM Coordination Workflows (100 questions)
       ├── Domain: IFC & Open Standards       (80 questions)
       ├── Domain: Clash Detection            (80 questions)
       ├── Domain: Project Lifecycle & LOD    (80 questions)
       ├── Domain: Software Tools & Shortcuts (60 questions)
  Each session: Server draws 25 via Fisher-Yates shuffle
```

### 6.3 Shuffle Algorithm (Server-Side Only)

```typescript
// BACKEND ONLY — Never runs client-side
function drawExamQuestions(
  assessmentTypeId: string,
  sessionId: string
): Question[] {
  const pool = await db.questions.findMany({
    where: {
      assessmentTypeId,
      status: 'ACTIVE',
      language: session.language
    }
  });
  
  // Fisher-Yates shuffle with crypto seed
  const seed = crypto.randomBytes(16).toString('hex');
  const shuffled = fisherYatesShuffle(pool, seed);
  
  // Draw first 25 questions
  const selected = shuffled.slice(0, 25);
  
  // Store question assignment against session
  await db.sessionQuestionAssignment.create({
    sessionId,
    questionIds: selected.map(q => q.id),
    questionOrder: selected.map((q, i) => ({ questionId: q.id, position: i + 1 })),
    shuffleSeed: seed,
    generatedAt: new Date()
  });
  
  return selected;
}
```

### 6.4 Candidate-Specific Question Assignment

```sql
SessionQuestionAssignment {
  id UUID PRIMARY KEY,
  sessionId UUID → ExamSession (UNIQUE — one assignment per session),
  questionIds UUID[],           -- Ordered list of 25 question IDs
  questionOrder JSONB,          -- [{questionId, position, answeredAt, timeSpentSeconds}]
  shuffleSeed VARCHAR,          -- Stored for audit trail
  generatedAt TIMESTAMP,
  generatedByProctorId UUID → User
}
```

**Rules:**
- Assignment generated exactly once per session, on proctor clicking "Begin Assessment"
- Questions delivered one at a time — server validates the candidate can only request question N+1 after submitting answer N
- No client-side logic knows the full question set — only the current question is sent
- If session drops and candidate reconnects, they resume at the same question position

### 6.5 Question Pool Management Rules

| Rule | Detail |
|---|---|
| Minimum pool size | 500 active questions must be maintained per assessment type before it can be set to Active status |
| Pool health alerts | Admin and Exam Setup Master are alerted when active question count drops below 100 (requires archiving/adding) |
| Question retirement | Any question can be archived but cannot be deleted if it has been used in a past session (audit trail) |
| Difficulty distribution | Recommended distribution: 30% Easy, 50% Medium, 20% Hard — tracked and reported on content dashboard |
| Domain balance | Questions tagged by domain; the shuffle ensures a balanced draw across domains when pool is well-structured |

### 6.6 Answer Recording — Per Question

Every question attempted by every candidate is stored with full detail:

```sql
ExamAnswer {
  id UUID PRIMARY KEY,
  sessionId UUID → ExamSession,
  questionId UUID → Question,
  position INTEGER,                -- Position in this candidate's shuffled set (1–25)
  questionSnapshot JSONB,          -- Full question text + all options AT TIME OF EXAM
                                   -- (immutable — even if question is later edited)
  candidateResponse JSONB,         -- What the candidate selected/typed
  isCorrect BOOLEAN,               -- Computed server-side on submission
  correctAnswer JSONB,             -- Correct answer(s) stored at time of exam
  timeSpentSeconds INTEGER,        -- Time from question display to answer submission
  autoScore DECIMAL,               -- Score awarded (e.g. 1.0 for correct, 0 for wrong)
  submittedAt TIMESTAMP
}
```

> The `questionSnapshot` field is critical. It captures the exact question text and options as they were at exam time. If the question is later edited or archived, the historical record remains accurate for report generation and audit.

---

## 7. Phase 1 — Pre-Session: HR Config & Candidate Scheduling

### 7.1 HR Selects Assessment Type

The HR Manager selects from the available assessment catalogue:

| Field | Description |
|---|---|
| Assessment Type | Selected from the master catalogue (e.g., "AutoCAD Draftsman L1", "Python Developer") |
| MCQ Questions | Always 25, drawn from 500-question pool — HR does not configure this |
| MCQ Duration | Always 30 minutes — fixed |
| Practical Task | HR selects from available practical tasks for this assessment type |
| Practical Duration | Always 60 minutes — fixed |
| GuardPro Required | Toggle — whether candidates must have GuardPro installed |

### 7.2 Candidate Import

**Manual add:** Single candidate form — first name, last name, email, phone, job position.

**Bulk import:** CSV/Excel upload with columns: `First Name, Last Name, Email, Phone, Job Position, Preferred Language`.

- System validates all emails are unique within the organization
- System flags duplicates (same email as existing candidate record)
- Error report generated if any rows fail validation
- Successful rows create `CandidateRecord` entries

### 7.3 Auto-Scheduling Engine

After candidates are imported and assessment is selected:

1. System checks available proctor slots (proctor availability table)
2. System matches proctor certification (proctor must be certified for this assessment type)
3. System considers candidate timezone (from their country/phone prefix)
4. System proposes a session schedule — HR can accept or adjust
5. On confirmation, session records are created and magic links are generated per candidate
6. Invitation emails sent automatically

**Magic link rules:**
- Unique per candidate per session
- Expires if unused 30 minutes after the scheduled exam start time
- Invalidated immediately on session completion
- One-time-use, IP-bound after first use

### 7.4 Candidate Communication

| Email | When | Content |
|---|---|---|
| Invitation | On scheduling | Date, time (local timezone), instructions, system requirements |
| Reminder 24h | 24 hours before | Recap + magic link |
| Reminder 1h | 1 hour before | Final reminder + magic link |
| Confirmation of submission | After exam ends | "Your assessment has been submitted." |

---

## 8. Phase 2 — Proctor Pre-Exam Checklist

The proctor's 10-item checklist is **server-enforced**. The "Begin Assessment" button is locked until all 10 items are marked complete by the proctor. Completion of each item is written to the database immediately — not on overall checklist submission.

| # | Item | Required Input |
|---|---|---|
| 1 | Camera confirmed active | Proctor visually confirms candidate camera feed is live |
| 2 | Candidate identity verified — name | Proctor types confirmed name into field |
| 3 | Candidate identity verified — email | Proctor confirms email matches record |
| 4 | Government ID verified | Proctor confirms ID was shown; uploads photo if required |
| 5 | Background scan completed | Proctor visually confirms surroundings are clear |
| 6 | No unauthorized materials visible | Checkbox + optional note |
| 7 | Facial recognition check passed | System runs FR — proctor reviews result and confirms |
| 8 | GuardPro connected | System detects GuardPro heartbeat (if required); proctor confirms |
| 9 | Screen share active | System confirms screen share stream received |
| 10 | Exam guidelines read + candidate agreed | Proctor delivers briefing; candidate verbally confirms; proctor checks box |

**"Begin Assessment" button:** Enabled only when all 10 items are `completed: true` in `ProctorChecklist.items`. Enforced server-side — the `POST /api/sessions/{id}/begin` endpoint returns 403 if checklist is incomplete.

---

## 9. Phase 3 — MCQ Assessment (30 Minutes)

### 9.1 Question Delivery

- Server selects 25 questions from the 500-question pool via Fisher-Yates shuffle (see Section 6)
- Questions delivered one at a time via `GET /api/exam/question/current`
- Client never receives the full question set — only the current question
- Answer submitted via `POST /api/exam/question/submit` — server validates before releasing next question
- No back navigation — once submitted, a question cannot be revisited

### 9.2 MCQ Interface (Candidate Screen)

```
┌──────────────────────────────────────────────────────────────────┐
│  assessexpert                    [Camera: 🟢 ON]  [Timer: 22:18] │
├──────────────────────────────────────────────────────────────────┤
│  Question 7 of 25                                                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  In Autodesk Revit, what does "Workset" refer to?          │  │
│  │                                                            │  │
│  │  ○  A. A set of view templates applied to a model          │  │
│  │  ○  B. A shared set of elements for collaborative work     │  │
│  │  ○  C. A collection of sheets in a project browser         │  │
│  │  ○  D. A group of families in the project library          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                              [ Next → ]                          │
└──────────────────────────────────────────────────────────────────┘
```

**Interface rules:**
- Progress bar showing `7 / 25`
- Server-synced countdown timer — client re-syncs with server every 30 seconds
- Camera status indicator always visible (never hidden during exam)
- No browser navigation buttons — full screen enforced
- Copy/paste disabled (clipboard events blocked and logged)
- Right-click disabled
- Auto-submits remaining unanswered questions when timer reaches 0:00

### 9.3 Timer Architecture

- Timer is managed server-side. `ExamSession.mcqStartedAt` is the authoritative start time
- Client displays time based on: `mcqTimeLimit - (now - mcqStartedAt)`
- Client re-syncs with server timestamp every 30 seconds via heartbeat
- Client-side timer is display-only — server enforces the deadline
- If heartbeat is missed 3× consecutively, session is flagged as connectivity issue

### 9.4 Proctor Live View During MCQ

On the proctor's screen during MCQ phase:

- Live camera feed of the candidate
- Screen share view
- Progress: `"Question 7 of 25 | 22 min 18 sec remaining"`
- AI event log (flags appear in real-time)
- Controls: `[Pause Session]` `[Send Warning]` `[Terminate Session]` `[Add Time]`

---

## 10. Phase 4 — Practical Assessment (60 Minutes)

### 10.1 Practical Task Types

| Type | Delivery | Submission |
|---|---|---|
| CAD / BIM | Candidate downloads starter file, works in local software, uploads output file | File upload (DWG, RVT, IFC) |
| Coding Challenge | In-browser Monaco editor — write and run code | Submit code in editor; auto-executed in sandbox |
| Networking / IT Lab | Browser-based virtual lab interface | Configuration is evaluated on submission |
| General File Task | Candidate downloads a task brief, works in any tool, uploads result | File upload (PDF, XLSX, DOCX) |

### 10.2 Practical Assignment Flow

1. MCQ phase ends (candidate submits or timer expires)
2. Candidate sees: `"MCQ complete. Please wait for your proctor to assign your practical task."`
3. Proctor's dashboard shows MCQ summary for this candidate
4. Proctor selects the practical task from the task library for this assessment type
5. Proctor clicks `[Assign Practical Task]` — task instructions and (if applicable) starter file appear on candidate screen
6. 60-minute timer begins

### 10.3 Coding Interface

For coding tasks, the Monaco editor is embedded in the browser:

- Language selector (configured per task — e.g., Python, JavaScript, SQL)
- Code editor with syntax highlighting and basic autocomplete
- `[Run Code]` button — executes in isolated Docker sandbox (gVisor)
- Output panel below editor
- `[Submit]` button — finalizes submission

**Security:** All code execution happens in an isolated container (gVisor). No internet access from the sandbox. Execution timeout: 10 seconds per run. Memory limit: 256MB.

---

## 11. Phase 5 — Session Close

After practical submission or timer expiry:

1. Candidate screen: `"Thank you. Your assessment is now complete. You may close this window."`
2. Magic link invalidated immediately
3. Session status → `SUBMITTED`
4. Screen recording finalized and uploaded to VPS storage
5. AI grading queued: MCQ auto-grade (immediate), practical grading (queued job)
6. Session status → `GRADING` → `PENDING_PROCTOR_REVIEW`
7. Proctor notified: `"AI draft report ready for [Candidate Name]"`

---

## 12. Phase 6 — AI Report Generation

### 12.1 Report Sections Generated

The AI (OpenAI GPT-4o via API) generates the following report sections:

| Section | Content |
|---|---|
| Candidate Overview | Name, assessment type, date, proctor, session ID |
| MCQ Performance Summary | Total score, pass/fail, time taken, average time per question |
| **MCQ Question-by-Question Breakdown** | Every question: position, question text, candidate's answer, correct answer, result (correct/incorrect), time spent |
| Practical Assessment Summary | Task description, submission file details, rubric-based score |
| Competency Radar | Spider/radar chart across 5–8 skill domains |
| AI Narrative | GPT-4o generated performance narrative (2–3 paragraphs) |
| Integrity Report | Integrity score (0–100), list of AI events, FR result, proctor flags |
| Screen Recording Summary | Session timeline, chapter markers for flagged events |
| Proctor Section | (Empty — filled by proctor: narrative, verdict, practical quality rating) |
| AI Recommendation | Hire / Do Not Hire / Proceed with Caution + justification |

### 12.2 MCQ Question-by-Question Breakdown — Required Fields

This section is **mandatory in every report**. It is generated from the `ExamAnswer` records and must include:

```
Q1 | [Question text from questionSnapshot]
   Candidate answered: [Option text]
   Correct answer:     [Option text]
   Result:             ✅ Correct  /  ❌ Incorrect
   Time spent:         45 seconds

Q2 | [Question text]
   Candidate answered: [Option text]
   Correct answer:     [Option text]
   Result:             ❌ Incorrect
   Time spent:         72 seconds
   
... (all 25 questions)
```

**Important:** The question text and options are taken from `ExamAnswer.questionSnapshot` — the snapshot captured at exam time. If the question has since been edited, the report reflects what the candidate actually saw.

---

## 13. Phase 7 — Proctor Review & Report Publication

### 13.1 Proctor Review Interface

On the proctor's "Completed Assessments" tab, they see a queue of sessions awaiting report review. For each session:

**Left Panel:**
- Dual-pane recording player (webcam + screen share synchronized)
- Chapter markers at flagged AI events
- Playback speed: 1× / 1.5× / 2× / 3×

**Right Panel — Report Editor:**
- All AI-generated sections (read-only preview)
- MCQ question breakdown (read-only — cannot be modified by proctor)
- Editable fields:
  - Proctor Narrative (text area, minimum 50 characters)
  - Practical Quality Rating (dropdown: Excellent / Good / Satisfactory / Poor / Did Not Submit)
  - Proctor Verdict (dropdown: PASS / FAIL / CONDITIONAL / FLAGGED / DISQUALIFIED)
  - Override any AI score for any section (requires mandatory justification note)

**Action buttons:**
- `[Save Draft]` — save progress without publishing
- `[Publish Report]` — publishes report to HR dashboard, generates PDF, notifies HR Manager

### 13.2 Publication Rules

- Proctor narrative is mandatory — cannot publish with empty narrative
- Proctor verdict is mandatory — cannot publish without selecting a verdict
- On publish: report status → `PUBLISHED`; report becomes visible on HR dashboard
- HR Manager and Org Admin receive in-portal notification + email: `"Report published for [Candidate Name]"`
- PDF is generated asynchronously within 2 minutes and attached to the report record
- Report **cannot be un-published** — to correct an error, proctor must modify and re-publish (creates new PDF version with version number and timestamp)

---

## 14. Phase 8 — HR Dashboard Report Access

HR Managers see only published reports. They can:

- View the full report in-portal (all sections including question breakdown)
- Download the signed PDF
- Watch the session recording (7-day countdown shown — `"Recording available for 4 more days"`)
- Rate the proctor's report quality (1–5 stars with optional comment)
- Export reports to CSV/Excel (summary data only, not full breakdown)

HR Managers cannot:
- See unpublished AI draft reports
- Modify any report content
- Delete reports (permanent — even after recording expires)

---

# PART 4 — PORTAL MODULES

---

## 15. Candidate Environment

**URL:** `app.assessexpert.ae/exam`  
**Access:** Magic link from email → OTP authentication → session only

### 15.1 Complete Candidate Journey

```
Magic Link Email Received
        ↓
Email Entry + OTP Verification (6-digit code to email)
        ↓
Camera & Device Permission Grant (mandatory — no bypass)
        ↓
System Requirements Check (browser, camera, microphone)
        ↓
Full-Screen Camera View (Waiting Room)
  — "Your proctor will begin your session shortly."
        ↓
Proctor-Led Verification (10-Item Checklist, proctor controls)
        ↓
Exam Guidelines Briefing (read by proctor)
        ↓
Candidate Agreement + Recording Consent (click to agree)
        ↓
MCQ Exam (25 questions, one at a time, 30 min)
        ↓
Wait Screen — "Please wait for your practical task."
        ↓
Practical Task Assignment (by proctor)
        ↓
Practical Task Completion & File Upload
        ↓
Session Closed — Completion Screen
```

### 15.2 Waiting Room UI

Full-screen layout during waiting period:
- Live camera preview (candidate sees themselves — mirrors what proctor sees)
- Status message: `"Your proctor will begin your session shortly. Please remain in front of your camera."`
- Timer: `"Session scheduled for 10:00 AM — 6 minutes remaining"`
- Do not disturb / quiet reminder

### 15.3 MCQ Interface Rules

- One question displayed at a time
- No back navigation
- Timer visible at all times
- Camera feed indicator always visible (green dot = active)
- If candidate attempts to exit full-screen: warning popup, AI flag raised, proctor notified
- If candidate switches tab: flag raised, warning shown, proctor notified
- After 3 tab-switch events: proctor receives escalation alert

### 15.4 Practical Interface Rules

- Task description shown clearly with formatted brief
- Download button for starter file (where applicable)
- Upload zone with drag-and-drop + file type validation
- Monaco editor for coding tasks (embedded, syntax highlighting, run button)
- Timer visible at all times
- Proctor can pause timer if technical issue confirmed

### 15.5 What Candidates Cannot Do

| Restriction | Enforcement |
|---|---|
| Cannot access previous questions | MCQ is one-directional — server rejects requests for previous questions |
| Cannot pause the exam independently | Only proctor can pause via server-side pause command |
| Cannot change browser tab | Detected via `visibilitychange` event; logged and flagged |
| Cannot copy-paste | Clipboard events blocked and logged |
| Cannot exit full-screen | Triggers immediate warning and AI flag |
| Cannot re-enter after session closes | Magic link invalidated at session end |
| Cannot see their own report | Reports delivered only to HR |

---

## 16. Super Admin Dashboard

**URL:** `app.assessexpert.ae/admin`  
**Access:** Email + Password + MFA (mandatory, cannot be disabled)

### 16.1 What Admin Can Do

| Capability | Description |
|---|---|
| View platform-wide analytics | All assessment data, graphs, KPIs across every company |
| Manage companies | Add, edit, deactivate partner companies |
| Manage all user types | Create/edit/deactivate all roles including Proctors, HR Managers, Exam Setup Masters |
| Monitor all assessments | View today's, upcoming, and past sessions across all companies |
| View all candidate reports | Read published reports across all companies |
| Comment on reports | Leave admin comments on any report — routed to assigned proctor |
| Configure assessment types | Edit the catalogue structure, durations, scoring rules |
| Manage question papers | View, edit, approve MCQ question papers |
| Full platform settings | System-level config, feature flags, integrations, compliance |

### 16.2 What Admin Cannot Do

| Restriction | Reason |
|---|---|
| Cannot join a live assessment session | No operational role in live exam — that is the Proctor's function |
| Cannot edit a published report directly | Proctor's responsibility — Admin can comment to trigger review |
| Cannot see unpublished AI draft reports | Draft reports are Proctor-only before publication |
| Cannot process a payment or invoice | All billing handled offline by Sales team |

### 16.3 Tab Structure

**Tab 1 — Overview Dashboard (Home)**

Eight summary stat cards in two rows:

Row 1 — Assessment Operations:
- Total Assessments (All Time) — cumulative, blue
- Assessments This Month — blue
- Live Sessions Right Now — cyan pulse
- Reports Pending Proctor Review — amber

Row 2 — Business Metrics:
- Total Active Companies — green
- Total Registered Users — neutral
- Total Candidates Assessed (All Time) — neutral
- Overall Platform Pass Rate — dynamic green/red

Each card: Large CountUp number on load, sub-label, month-over-month trend arrow, click → deep-links to relevant tab.

Assessment activity chart:
- Line/bar combo; X-axis: date range selector; Y-axis: session count
- Lines: Scheduled (dashed blue), Completed (solid green), Pending Report (amber), No-Show (grey)
- Filter by company and assessment type
- Hover tooltips

Sales performance section (Admin-only):
- Company growth bar chart (last 12 months)
- Assessment type distribution donut chart
- Manually entered estimated MRR (offline — no payment module)

Live sessions monitor panel — real-time table of all active sessions across all companies.

**Tab 2 — Companies**
- Searchable, filterable table of all onboarded companies
- Columns: Company Name, Industry, Country, Onboarded Date, Status, Assessments This Month, Assigned Sales Agent, Actions
- Click → Company Profile: details, users, assessment history, recordings access log
- Actions: `[Edit]` `[Suspend]` `[Add User]` `[View Sessions]`
- `[+ Add Company]` → form: name, country, industry, Org Admin email, Sales Agent assignment

**Tab 3 — Users**
- All users across all companies in one filterable table
- Filters: role, company, status, date created
- `[+ Create User]` → role-based form (different fields per role)
- `[Deactivate]` `[Reset Password]` `[View Activity Log]`

**Tab 4 — Assessments Schedule**
- Calendar view (month/week/day) + list view of all scheduled sessions across all companies
- Filters: company, assessment type, proctor, date range, status
- Click session → full session detail with candidate list

**Tab 5 — Assessed Candidates & Reports**
- All completed sessions with published reports — searchable across all companies
- Columns: Candidate Name, Company, Assessment Type, Date, MCQ Score, Practical Score, Overall Result, Proctor, Actions
- `[View Report]` → full published report (read-only for Admin)
- `[Add Comment]` → admin comment routed to assigned proctor
- `[Download PDF]`

**Tab 6 — Assessment Types & Configuration**
- Catalogue of all assessment types
- Each entry: name, category, total questions in pool, active question count, sessions count, status
- `[Edit]` → edit assessment type settings (not questions — questions are in Tab 7)
- Assessment type fields: name, description, industry, MCQ pass threshold %, practical pass threshold %, practical type, GuardPro required

**Tab 7 — Question Papers & Exam Content**
- Question bank browser — filter by assessment type, domain, difficulty, status
- Each question row: preview, type, difficulty, domain, status, usage count, last modified
- `[View]` → full question with all options and correct answer marked
- `[Edit]` → edit form (changes to active questions require approval)
- `[+ Add Question]` → question creation form
- **Pool Status Bar** per assessment type: shows current active question count vs 500 target
- Warning shown if count < 400: `"Question pool is running low — 380/500 active questions"`

**Tab 8 — Settings**
- Platform general settings (name, URL, support contacts, logo)
- Exam & session global rules (recording retention, session timeout, GuardPro global toggle)
- Notification & communication settings (email provider, SMS provider, WhatsApp toggle)
- AI & proctoring settings (FR threshold, FR check interval, face absence threshold)
- Security & compliance (session token expiry, IP allowlist for Admin login, GDPR mode)
- Feature flags (toggle per feature, per company tier)
- Audit log viewer (searchable, immutable, export to CSV)

---

## 17. Master Proctor Dashboard

**URL:** `app.assessexpert.ae/master-proctor`  
**Access:** Email + Password + MFA (mandatory)

The Master Proctor is the highest-authority operational role. They have oversight across all live sessions and all proctors, can modify active exam content directly, and — critically — **can create and configure new exams end-to-end**.

### 17.1 What a Master Proctor Can Do

| Capability | Description |
|---|---|
| **Create new exams / assessments** | Full exam creation: name, type, domain, question pool management, practical task setup |
| **Manage the 500-question pool** | Add, edit, archive questions directly (no Admin approval required for editing active questions) |
| Join any live session | Enter any proctor's session as observer or take control |
| Manage all proctors | View, control availability, reassign sessions, review performance |
| Review & modify reports | Return reports for revision, override published reports with justification |
| Manage practical questions | Full access to all practical task files and marking criteria |
| Override proctor actions | Pause, resume, or terminate any session |
| Full settings access | All platform operational and content delivery settings |

### 17.2 What a Master Proctor Cannot Do

| Restriction | Reason |
|---|---|
| Cannot access company billing or HR pipeline data | Financial data is Admin-only |
| Cannot create or delete user accounts | User management is Admin-only |
| Cannot view unpublished Exam Setup drafts | Exam Setup Master content pipeline until published |

### 17.3 Tab Structure

**Tab 1 — Overview Dashboard**

Summary stat cards:
- Live Sessions Right Now
- Sessions Today (Total)
- Active Proctors Online
- Reports Pending Review
- Reports Flagged for Modification
- AI Flags This Week

Live sessions panel — real-time grid of all active sessions with `[Join as Observer]` per session.

Today's sessions schedule — chronological table with status indicators.

Proctor status panel — online/offline/in-session status for all proctors.

Pending reports panel — all reports awaiting proctor action, with time elapsed since session end.

**Tab 2 — Proctor Management**

Proctor list table: name, status, sessions this month, reports pending, avg HR score, avg turnaround, certification level.

Click proctor → Proctor Profile:
- Personal details (read-only)
- Performance dashboard (sessions, ratings, turnaround, flag confirmation rate)
- Session history with links to recordings and reports

Proctor availability management — view and override any proctor's weekly availability grid.

Session reassignment — select replacement proctor per session when reassignment is needed.

Direct proctor messaging (normal or urgent — urgent triggers SMS).

Proctor performance reporting — exportable CSV/PDF with full metrics per proctor.

Proctor suspension — immediate suspension with mandatory reason, triggers session reassignment queue, notifies Admin.

**Tab 3 — Assessment Join (All Sessions)**

Session browser with filters: date, status, proctor, assessment type, company.

Join as observer: receives all candidate feeds + screen shares (read-only mode by default).

Take session control: notifies current proctor; Master Proctor becomes session lead with full controls.

Private proctor messaging during live sessions (not visible to candidates).

Multi-session monitor view — grid of all live sessions with thumbnail feeds.

**Tab 4 — Create & Manage Exams** ← *New: Master Proctor exam creation*

This is the Master Proctor's full exam management hub.

#### 17.4 Exam Creation by Master Proctor

The Master Proctor can create a new assessment type from scratch. This is the full exam creation flow:

**Step 1 — Exam Setup**

| Field | Input Type | Description |
|---|---|---|
| Exam Name | Text | e.g., "Senior AutoCAD Draftsman" |
| Category | Dropdown | Engineering / IT / Finance / HR / Legal / Operations / etc. |
| Industry | Dropdown | Construction / Technology / Healthcare / etc. |
| Job Role | Text | The specific role this assessment is for |
| MCQ Duration | Fixed: 30 min | Cannot be changed — platform standard |
| MCQ Question Count | Fixed: 25 | Cannot be changed — drawn from 500-question pool |
| Practical Type | Dropdown | CAD / Coding / Lab / File / None |
| Practical Duration | Fixed: 60 min | Cannot be changed |
| MCQ Pass Threshold | Number (%) | e.g., 60% = candidate must score 15/25 or higher to pass MCQ |
| Practical Pass Threshold | Number (%) | e.g., 60% |
| Overall Pass Logic | Dropdown | Both must pass / Weighted average |
| GuardPro Required | Toggle | Whether this exam requires GuardPro browser lock |
| Languages | Multi-select | English / Arabic / other supported languages |

**Step 2 — Build the 500-Question Pool**

The Master Proctor must build a question pool of minimum 100 questions to set the exam to Draft, and minimum 500 to set it to Active.

Question creation form fields:

| Field | Input Type | Options |
|---|---|---|
| Question Text | Rich text editor | Supports bold, code blocks, images, tables |
| Question Type | Dropdown | Single Choice / Multiple Choice / True-False |
| Option A | Text | |
| Option B | Text | |
| Option C | Text | |
| Option D | Text | |
| Correct Answer(s) | Checkbox(es) | Select which option(s) are correct |
| Explanation / Rationale | Text area | Optional — shown nowhere to candidate; used in proctor review |
| Difficulty | Dropdown | Easy / Medium / Hard |
| Domain / Tag | Multi-select | The skill domain this question covers (e.g., "Revit Walls", "IFC Standards") |
| Language | Dropdown | Language of this question |
| Marks | Number | Default: 1. Can be weighted (e.g., 2 for hard questions) |

Bulk question import:
- Upload CSV/Excel file with columns matching question fields
- System validates format and imports valid rows
- Error report generated for invalid rows

Pool health dashboard per exam:
- Progress bar: `[Active Questions: 340/500]` with colour coding (red < 200, amber 200–399, green 400+)
- Distribution breakdown by difficulty and domain
- Questions table: searchable, filterable, bulk archive/activate

**Step 3 — Practical Task Configuration**

| Field | Input | Description |
|---|---|---|
| Task Title | Text | e.g., "Draw a Single-Line Electrical Layout Plan" |
| Task Brief | Rich text | Full task description shown to candidate |
| Starter File | File upload | Optional — DWG, RVT, ZIP, etc. |
| Marking Rubric | Rich text + table | Criteria and points per criterion |
| Rubric PDF | File upload | Optional formatted rubric for proctor reference |
| Estimated Completion Time | Number | For internal reference (actual time is 60 min) |
| Accepted File Types | Multi-select | DWG / RVT / PDF / XLSX / ZIP / etc. |

**Step 4 — Review & Publish**

- Full preview of exam settings, question pool stats, and sample question
- Status options: Draft (< 500 questions) → Active (500+ questions)
- Submit for Admin approval (optional workflow — Master Proctor can also self-publish directly)
- Notification sent to Admin when new exam is created

**Tab 5 — Question Papers & Exam Content**

Full question bank browser across all assessment types:
- Filter by assessment type, difficulty, domain, status, last modified
- Full-text search within question text
- `[View]` → question card with all options, correct answer, explanation, version history
- `[Edit]` → Master Proctor can edit any question directly (auto-versioned, logged)
- `[Archive]` → removes from active pool (question preserved for historical report accuracy)

Version history per question:
- Every edit logged with: editor name, timestamp, old value, new value
- Previous versions viewable and restorable
- Restoration creates a new version (does not delete history)

**Tab 6 — Proctor Reporting & Report Review**

Queue of all reports across all proctors:
- Filter by: proctor, assessment type, date, status, SLA breach risk
- `[View Report]` → full report including MCQ question breakdown
- `[Return for Modification]` → mandatory note to proctor, report status → `RETURNED`
- `[Override Report]` → Master Proctor can directly modify and re-publish (with mandatory justification; both original and override clearly marked in report)

Reporting standards configuration:
- Minimum proctor narrative length
- Report turnaround SLA
- Required verdicts for specific integrity score ranges

**Tab 7 — Settings & Configuration**

- Session settings: join window, session SLA, multi-candidate max, time extension permissions
- AI monitoring settings: FR thresholds, face absence alert, tab-switch escalation count
- Proctor settings: session timeout, max sessions per proctor per day
- Personal profile: name, email, phone, profile photo, certification level
- Account security: change password, MFA status, TOTP regeneration, active sessions, login history

---

## 18. Proctor Dashboard

**URL:** `app.assessexpert.ae/proctor`  
**Access:** Email + Password + MFA (mandatory)

### 18.1 What a Proctor Does

| Responsibility | Description |
|---|---|
| Pre-exam verification | Runs the 10-item checklist for every candidate before unlocking the assessment |
| Identity verification | Confirms candidate identity, triggers facial recognition |
| Session briefing | Reads exam guidelines (5-minute protocol) |
| Session control | Controls when MCQ starts, assigns practical task, manages timing |
| Live monitoring | Monitors candidates, responds to AI flags |
| Incident management | Issues warnings, flags integrity concerns, can terminate sessions |
| Report review | Reviews AI-generated draft report |
| Report publication | Writes proctor narrative, selects verdict, publishes final report |

### 18.2 Tab Structure

**Tab 1 — Overview Dashboard (Home)**

Stat cards:
- Sessions Today (assigned to this proctor)
- Upcoming Sessions (next 7 days)
- Reports Awaiting My Review
- Average Report Turnaround (my sessions, last 30 days)

Today's session list: time, assessment name, company, candidate count, status, `[Join Session]` button.

**Tab 2 — Today's Assessments**

Chronological list of all assigned sessions for today:
- Scheduled time, assessment type, company, candidate names
- Status: Upcoming / Live / Completed / Awaiting Report
- `[Join Session]` (available 15 min before scheduled start)

**Tab 3 — Live Session Control Room**

This is the core operational screen. The proctor spends most of their session time here.

**Session Entry & Camera Start**
- Proctor clicks `[Join Session]`
- Camera + microphone permission requested
- Proctor's camera feed starts (visible to Master Proctor if observing)
- Candidate waiting room shown

**Candidate Lobby & Readiness View**
- Grid of all candidates in this session with their camera feeds (thumbnails)
- Status per candidate: `Waiting` / `Camera Off` / `Ready`
- Proctor can select a candidate to begin the verification checklist

**Individual Candidate Verification Flow**
- Candidate camera in full view
- 10-item checklist on the right panel
- Each item: checkbox + optional notes field
- `[Begin Assessment]` button locked until all 10 items checked

**Screen Share & GuardPro Consent**
- System detects screen share stream from candidate
- GuardPro heartbeat detected (if required)
- Status indicators update automatically in checklist

**5-Minute Briefing Protocol**
- Proctor reads the standardized briefing script (shown on proctor's screen for reference)
- After reading, marks checklist item 10 complete

**Queue Management (Multi-Candidate Sessions)**
- Proctor can have up to 5 candidates in one session
- Verification is done sequentially — one candidate at a time
- Verified candidates enter a "Ready" state and wait
- Once all are verified, `[Start MCQ for All]` button activates

**Starting the MCQ Exam**
- Proctor clicks `[Start MCQ for All]` (or `[Start MCQ for This Candidate]` for individual start)
- Server generates shuffled 25-question set for each candidate
- Timer starts server-side
- All candidate screens transition from waiting room to MCQ interface

**Live Monitoring During MCQ**
- Grid view: all candidate camera feeds + screen shares
- AI event log scrolling in real time (flags visible as they trigger)
- Per-candidate: current question number, time remaining
- Actions per candidate: `[Warn]` `[Pause This Candidate]` `[Terminate This Candidate]`
- Global actions: `[Pause All]` `[Add Time to All]`

**Practical Task Assignment**
- After MCQ ends, proctor sees MCQ score summary per candidate
- Proctor selects practical task from dropdown (tasks configured for this assessment type)
- For CAD/BIM: proctor selects the specific starter file version
- For coding: task is pre-configured, proctor confirms
- Proctor clicks `[Assign Practical Task]` — unlocks practical screen for candidate

**Live Monitoring During Practical**
- Same grid view as MCQ monitoring
- Additional info per candidate: file upload status (for CAD/BIM tasks)
- Proctor can extend time if technical issue confirmed

**Session Close & Post-Exam Transition**
- Practical time expires or all candidates submit
- Proctor clicks `[Close Session]` → confirms all candidates are done
- Session status → `SUBMITTED`
- Recording finalization begins
- Proctor navigated to report review queue

**Tab 4 — Completed Assessments & Report Review**

Queue of sessions awaiting proctor report review. For each session:

Left panel:
- Dual-pane synchronized recording player (webcam + screen share)
- Chapter markers at AI-flagged events
- Playback speed controls

Right panel:
- Full AI-generated report (read-only except proctor fields)
- **MCQ question-by-question breakdown** (read-only) — proctor can see every question, answer given, and whether correct
- Practical evaluation from AI (rubric-based)
- Editable fields: proctor narrative, practical quality, proctor verdict, score overrides

`[Save Draft]` and `[Publish Report]` buttons.

**Tab 5 — Settings & Profile**

- Availability schedule: weekly grid — set available/unavailable slots
- Certification domains: read-only (set by Admin)
- Languages: languages proctor can brief in
- Personal profile: name, email, phone, profile photo
- Account security: change password, MFA, login history

---

## 19. Exam Setup Master Dashboard

**URL:** `app.assessexpert.ae/exam-setup`  
**Access:** Email + Password + MFA (mandatory)

The Exam Setup Master is the specialist content role — builds and maintains all exam content. Does not proctor, does not see candidate personal data, does not access reports.

### 19.1 What Exam Setup Master Can Do

| Capability | Description |
|---|---|
| Manage MCQ question bank | Create, edit, categorise, archive MCQ questions per assessment type |
| Manage practical exam tasks | Upload, configure, and maintain practical task files and rubrics |
| Review exam papers | Full quality-check reviews on all active question pools |
| Simulate exams | Preview what a candidate sees during an MCQ or practical session |
| Version control content | All edits versioned — previous versions preserved and restorable |
| Submit content for approval | Changes to Active content require Master Proctor or Admin approval |

### 19.2 Tab Structure

**Tab 1 — Overview Dashboard**
- Pool health cards per assessment type: active questions vs 500 target
- Questions pending review count
- Practical tasks pending approval count

**Tab 2 — Assessment Types**
- Read-only view of all assessment types
- Can request configuration changes (submitted for Admin approval)

**Tab 3 — MCQ Question Bank**
- Full question bank browser (same as Master Proctor's but with Pending Approval workflow)
- `[+ Add Question]` → draft mode by default
- `[Edit Active Question]` → change goes to Pending Approval before going live
- Domain and difficulty distribution tracker per assessment type
- Bulk import via CSV/Excel
- Pool status bar: `[Active: 340/500]` with target indicators

**Tab 4 — Practical Exam Library**
- All practical tasks across all assessment types
- `[+ Add Practical Task]` → full task creation form
- `[Edit]` → changes to active tasks require approval
- File management: upload/replace starter files, rubric files

**Tab 5 — Exam Paper Review & Approval**
- Queue of questions/tasks awaiting their own review
- Queue of change requests submitted by this Exam Setup Master awaiting Admin/Master Proctor approval
- Status: Submitted / Under Review / Approved / Rejected (with note)

**Tab 6 — Exam Simulation & Preview**
- Select any assessment type → simulate the candidate MCQ experience
- Questions served one at a time (same as real exam)
- Timer runs (can be paused in preview mode)
- After 25 questions: shows what the report would look like with sample answers

**Tab 7 — Settings & Profile**
- Personal profile: name, email, phone
- Domain access: assessment types this Exam Setup Master can access (read-only — set by Admin)
- Account security: change password, MFA, login history

---

## 20. HR Manager Dashboard

**URL:** `app.assessexpert.ae/hr`  
**Access:** Email/Password, Google OAuth, Microsoft OAuth, SAML SSO (Enterprise tier) — MFA optional

### 20.1 What HR Can Do

| Capability | Description |
|---|---|
| View analytics | Company assessment statistics, graphs, efficiency metrics |
| Add candidates | Manually or via bulk CSV import |
| Schedule assessments | Assign candidates to assessment sessions |
| View published results | Access published reports and screen recordings |
| Schedule interviews | Book interviews for high-scoring candidates |
| Conduct interviews | Use built-in interview panel |
| Manage company profile | Update company name, logo, contacts |

### 20.2 First Login — Onboarding Tutorial

12-step interactive walkthrough covering all major features. Uses Driver.js overlay with tooltip per step. Covers: adding a candidate, scheduling an assessment, viewing a report, conducting an interview. Can be replayed from Help menu.

### 20.3 Tab Structure

**Tab 1 — Overview Dashboard (Home)**

Summary stat cards (this company only):
- Total Candidates in System
- Assessments This Month
- Pending Reports (assessments done, reports not yet published)
- Overall Pass Rate (this company)
- Active Assessments (scheduled, not yet done)
- Top Performing Assessment Type

Activity graph: line chart — assessments per month (last 12 months). Hoverable data points.

Pending actions panel:
- Sessions awaiting scheduling
- Reports published in last 7 days
- Recordings expiring in < 24 hours

**Tab 2 — Candidates**

All candidate records for this company. Searchable by name, email, job position.

Columns: Name, Email, Job Position, Date Added, Sessions Count, Latest Result, Actions.

`[+ Add Candidate]` → single candidate form.
`[Import Candidates]` → CSV/Excel upload with template download.

Click candidate → Candidate Profile:
- Personal details
- Assessment history: all sessions, dates, scores, results
- Links to published reports and recordings

**Tab 3 — Assessments Completed**

All completed sessions with published reports. Filter by date, assessment type, result, proctor.

Columns: Candidate, Assessment Type, Date, MCQ Score, Practical Score, Overall Result, Proctor, Recording Expires, Actions.

`[View Report]` → full published report (all sections including question breakdown).  
`[Download PDF]` → signed PDF report.  
`[Watch Recording]` → opens recording player (if within 7-day window).  
`[Rate Report]` → 1–5 stars rating for proctor quality.  
`[Schedule Assessment]` → re-assess the same candidate with a new session.

**Tab 4 — Top Performers & Interview Panel**

Top performers this month — auto-ranked by overall score.

Shortlist management: HR can flag candidates as `Shortlisted` for further review.

Interview scheduler:
- Select shortlisted candidate
- Select interview date/time from available slots
- Select interviewers from registered HR/Hiring Manager accounts
- Auto-sends calendar invites + links

Built-in Interview Panel (when interview is active):
- Video call interface (WebRTC)
- AI-suggested interview questions based on candidate's assessment report
- Notes panel — interviewer can type observations in real time
- Rating sliders per competency
- Final interview verdict: Hire / Reject / Hold

**Tab 5 — Profile & Settings**

- Company profile: name, logo, industry, country
- Contact information: billing contact, primary HR contact
- Notification settings: which events trigger email/SMS
- My profile: personal details, password, MFA, language preference

---

## 21. Sales Agent Panel

**URL:** `app.assessexpert.ae/sales`  
**Access:** Email + Password + MFA

### 21.1 What a Sales Agent Can Do

- View and manage their assigned leads (from Contact Us form submissions)
- View their assigned companies and client health status
- Create demo accounts for prospects
- Track assessment credit consumption per company
- Receive renewal alerts for companies approaching contract end

### 21.2 Tab Structure

**Tab 1 — Overview**
- New leads this week
- Companies approaching renewal (next 90 days)
- Assessment credit consumption alerts

**Tab 2 — Leads**
- Leads from website Contact Us form
- Status: New / Contacted / Demo Scheduled / Negotiating / Converted / Lost
- `[Create Demo Account]` → creates a 14-day trial company account

**Tab 3 — My Companies**
- All companies assigned to this Sales Agent
- Health indicators: last session date, credit balance, contract end date
- Renewal alerts 90 days, 30 days, 7 days before expiry

---

# PART 5 — PLATFORM SYSTEMS

---

## 22. Authentication & Access System

### 22.1 Login Methods by Role

| Role | Email+Pass | Google OAuth | Microsoft OAuth | SAML SSO | MFA |
|---|:---:|:---:|:---:|:---:|---|
| Super Admin | ✅ | ❌ | ❌ | ❌ | Mandatory TOTP |
| Master Proctor | ✅ | ❌ | ❌ | ❌ | Mandatory TOTP |
| Exam Setup Master | ✅ | ❌ | ❌ | ❌ | Mandatory TOTP |
| Sales Agent | ✅ | ✅ | ❌ | ❌ | Optional |
| Org Admin | ✅ | ✅ | ✅ | ✅ Enterprise | Optional |
| HR Manager | ✅ | ✅ | ✅ | ✅ Enterprise | Optional |
| Hiring Manager | ✅ | ✅ | ✅ | ✅ Enterprise | Optional |
| Proctor | ✅ | ❌ | ❌ | ❌ | Mandatory TOTP |
| Candidate | Magic Link + Email OTP | — | — | — | OTP is the auth |

### 22.2 Candidate Magic Link System

- Unique, cryptographically random token per session per candidate
- Token embedded in email as a URL: `app.assessexpert.ae/exam?token=...`
- On click: token validated (not expired, not used, not from different IP class)
- Candidate prompted for email (to verify they have inbox access)
- OTP sent to that email (6-digit, 10-minute expiry)
- On OTP verification: session established, candidate enters waiting room
- Token single-use: once session begins, token cannot be re-used to open new session
- Concurrent session detection: if same token is used from a second IP after session starts, security alert raised and second connection blocked

### 22.3 Session Management

| Role | Session Timeout (Inactivity) |
|---|---|
| Super Admin | 4 hours |
| Master Proctor | 4 hours (re-auth for destructive actions) |
| Proctor (active session) | 8 hours |
| Proctor (idle) | 4 hours |
| HR Manager | 8 hours |
| Candidate | Active until session ends or magic link expires |

---

## 23. AI Proctoring & Facial Recognition Engine

### 23.1 In-Browser Face Monitoring (MediaPipe)

Runs entirely in the candidate's browser using TensorFlow.js + MediaPipe FaceMesh. No server round-trip per frame.

| Event | Threshold | Severity |
|---|---|---|
| Face absent from camera | > 8 seconds | Warning |
| Multiple faces detected | Any instance | Critical |
| Gaze off-screen | > 4 consecutive events in 10 min | Warning |
| Face absent + gaze off repeatedly | 3+ warning events | Critical |

Events are batched and sent to the server every 15 seconds via WebSocket.

### 23.2 Facial Recognition — Identity Verification

Run via AWS Rekognition (CompareFaces API):

**Pre-exam (checklist item 6):**
1. Proctor clicks `[Run FR Check]`
2. System captures a live frame from candidate's camera
3. System retrieves the candidate's reference photo (uploaded by HR or the ID photo taken at session start)
4. AWS Rekognition compares → returns similarity score (0–100%)
5. Score ≥ 90%: auto-verified (green indicator)
6. Score 70–89%: manual review — proctor sees both images and makes decision
7. Score < 70%: FR fail — proctor must take action (verify more carefully or flag)

**Periodic checks during exam:**
- FR check runs every 90 seconds during MCQ and practical phases
- Each result logged to `FacialRecognitionLog`
- If periodic check returns < 70%: critical alert to proctor + visual indicator on proctor screen

### 23.3 GuardPro — Browser Lock Application

GuardPro is a Windows application that candidates download and install before exams where it is required. It is not required for all exams — configured per assessment type.

**What GuardPro does:**
- Blocks multi-monitor usage (locks to primary display only)
- Monitors and blocks specified applications (configurable process blocklist per assessment type)
- Detects and blocks remote desktop tools (TeamViewer, AnyDesk, RDP)
- Monitors clipboard activity during exam
- Sends heartbeat to server every 30 seconds (RSA-2048 signed payload)
- Detects VM environments (CPUID, MAC prefix, registry key checks)

**GuardPro integration with platform:**
- Proctor checklist item 8: system checks for GuardPro heartbeat before allowing "Begin Assessment"
- If heartbeat stops during exam: critical alert to proctor immediately
- GuardPro disconnect event logged and shown in integrity report

> **Note on GuardPro:** GuardPro is a separately developed Windows application. This spec describes the platform integration requirements. GuardPro itself is built separately with NSIS/WiX installer, EV code signing, and submission to antivirus vendors.

---

## 24. Screen Recording System

### 24.1 Recording Architecture (VPS-Hosted)

Since hosting is on Hostinger VPS (not AWS), recordings are managed differently:

- Screen recording is captured client-side using the `MediaRecorder` API (browser-native)
- WebM/VP8 format, chunked uploads every 60 seconds to the VPS storage server
- VPS storage path: `/var/assessexpert/recordings/{sessionId}/`
- Proctor webcam recording: separate stream, stored alongside screen share recording
- Both streams synchronized by timestamp for dual-pane playback

**Recording streams per session:**
1. Candidate screen share (full screen)
2. Candidate webcam feed
3. (Optional) Proctor webcam — for reference

### 24.2 Retention & Purge

- Recordings stored for exactly 7 days from `ExamSession.practicalSubmittedAt`
- A scheduled cron job runs daily to check and purge expired recordings
- Before purge: system confirms the recording's session has a published report (report is permanent)
- After 7-day expiry: the recording file is deleted; the report remains accessible
- HR Dashboard shows countdown: `"Recording available for 4 more days"`
- HR notified by email 24 hours before recording purge: `"Recording for [Candidate Name] expires tomorrow"`

### 24.3 Recording Playback

- Accessed via time-limited signed URL generated per viewing request
- Signed URL expires after 2 hours (prevents direct link sharing)
- Dual-pane player: screen share (main, larger) + webcam (PiP or side-by-side)
- Chapter markers at AI-flagged events
- Playback speed: 1× / 1.5× / 2× / 3×
- Jump to chapter: click any event in the timeline

---

## 25. Grading & Evaluation Engine

### 25.1 MCQ Auto-Grading

Triggered immediately when the candidate submits each question and again at MCQ session end.

- For each `ExamAnswer`: `isCorrect = candidateResponse === correctAnswer`
- Score calculation: `mcqScore = sum(finalScore) / sum(maxScore) * 100`
- MCQ pass: `mcqScore >= assessment.mcqPassThreshold`
- Results stored immediately; proctor can see MCQ summary during practical phase

### 25.2 Practical Grading Pipeline

**For coding tasks:** Code executed in isolated Docker sandbox (gVisor). Test cases run automatically. Pass/fail per test case computed. Score = passed_tests / total_tests.

**For CAD/BIM file tasks:** Submitted file processed via Python pipeline:
- DWG files: parsed with `ezdxf` — checks element counts, layer compliance, dimensioning
- RVT/IFC files: parsed with `ifcopenshell` — checks BIM element correctness, LOD compliance
- Results compared against rubric criteria

**For general file tasks:** AI evaluation using GPT-4o with rubric as system prompt. Model reviews submitted file content against marking criteria and returns rubric scores per criterion.

### 25.3 Grading Status

All grading is asynchronous. Session follows this grading flow:

```
SUBMITTED → grading-mcq queue (auto, < 5 sec)
         → grading-practical queue (varies: 30 sec to 10 min)
         → grading-ai queue (< 5 min for AI short answer)
         → report-generate queue (< 15 min from session end)
         → PENDING_PROCTOR_REVIEW
```

---

## 26. Report Generation — Full Candidate Answer Breakdown

### 26.1 Report Generation Job

The `report-generate` queue job assembles all report data:

1. Fetch all `ExamAnswer` records for this session (MCQ + practical)
2. Fetch `SessionEvent` records (AI flags, proctor actions)
3. Fetch `FacialRecognitionLog` records
4. Compute all section scores
5. Call GPT-4o to generate narrative sections (AI narrative, AI recommendation)
6. Assemble full report JSON
7. Store as `Report` record with status `DRAFT`
8. Notify assigned proctor

### 26.2 MCQ Breakdown Section (Mandatory)

The report's MCQ section must include every question in the candidate's shuffled set. Generated from `ExamAnswer` records joined with `questionSnapshot` data:

```json
{
  "mcqBreakdown": [
    {
      "position": 1,
      "questionText": "In Autodesk Revit, what does 'Workset' refer to?",
      "options": [
        "A. A set of view templates applied to a model",
        "B. A shared set of elements for collaborative work",
        "C. A collection of sheets in a project browser",
        "D. A group of families in the project library"
      ],
      "candidateAnswer": "A",
      "candidateAnswerText": "A set of view templates applied to a model",
      "correctAnswer": "B",
      "correctAnswerText": "A shared set of elements for collaborative work",
      "isCorrect": false,
      "timeSpentSeconds": 45,
      "marks": 1,
      "marksAwarded": 0
    },
    ...
  ],
  "totalCorrect": 18,
  "totalIncorrect": 7,
  "totalMcqScore": 72,
  "mcqPassed": true
}
```

This data is displayed in the published report exactly as above. The HR Manager can see every question, every answer, and every result. There is no way to view only summary data if the HR Manager opens the full report.

### 26.3 Report PDF Generation

On proctor clicking "Publish Report":

1. `report-pdf` queue job triggered
2. PDF generated using `Puppeteer` (headless Chrome, renders the report as HTML then exports to PDF)
3. PDF includes all report sections including the full question breakdown
4. Digital signature block: proctor name, certification number, publication date, session ID
5. QR code linking to `verify.assessexpert.ae/{reportId}`
6. PDF stored on VPS: `/var/assessexpert/reports/{reportId}/report.pdf`
7. Secure download link generated and attached to HR dashboard report entry

### 26.4 Report Versioning

If a proctor modifies and re-publishes a report after initial publication:
- New PDF generated: `report_v2.pdf`, `report_v3.pdf` etc.
- HR dashboard shows latest version with a `"Modified: [date]"` label
- Version history accessible: HR can download any previous version
- Modification reason stored on each version

---

## 27. Notification & Communication System

### 27.1 Channels

| Channel | Provider | Use Case |
|---|---|---|
| Email | SMTP via SMTP2GO or Mailgun (VPS-friendly) | All formal notifications, reports, invitations |
| SMS | Twilio | Urgent alerts, MFA OTPs |
| In-portal | WebSocket (Socket.io) | Real-time portal alerts (bell icon) |
| WhatsApp | Twilio (optional) | Candidate session reminders |

### 27.2 All Notification Events

| Event Code | Trigger | Recipients | Channel |
|---|---|---|---|
| `INV-001` | Session scheduled | Candidate | Email |
| `REM-24H` | 24 hours before session | Candidate | Email |
| `REM-01H` | 1 hour before session | Candidate | Email |
| `CHK-STR` | Proctor starts checklist | Proctor | In-portal |
| `SUB-001` | Candidate submitted exam | HR Manager | Portal + Email |
| `RPT-DFT` | AI draft report ready | Proctor | Email + Portal + SMS |
| `RPT-PUB` | Report published | HR Manager | Email + Portal |
| `REC-EXP` | Recording expires in 24h | HR Manager | Email |
| `NSH-001` | No-show (didn't start +15 min) | HR Manager | Email + Portal |
| `DUP-LGN` | Duplicate login attempt | Proctor | Portal (WebSocket) + SMS |
| `DQ-001` | Session disqualified | HR Manager | Email |
| `DQ-002` | Session disqualified | Candidate | Email |
| `BCH-OK` | Candidate batch processed | HR Manager | Portal |
| `SCH-CNF` | Auto-schedule confirmed | HR Manager | Email + Portal |
| `WLC-HR` | HR account created | HR Manager | Email |
| `WLC-PRC` | Proctor account created | Proctor | Email |
| `LEAD-NEW` | Contact Us form submitted | Sales Agent | Email + Slack |
| `LEAD-ACK` | Contact Us form submitted | Prospect | Email |
| `DEMO-CRT` | Demo account created | Prospect | Email |
| `RNW-90D` | Renewal due in 90 days | Org Admin + Sales | Email |
| `RNW-30D` | Renewal due in 30 days | Org Admin + Sales | Email |
| `PRC-ASGN` | Session assigned to proctor | Proctor | Email |
| `PRC-REM` | Proctor reminder 1h before | Proctor | Email + SMS |
| `AI-CRIT` | Critical AI flag in live session | Master Proctor | Portal + SMS |
| `SLA-WARN` | Report SLA approaching | Master Proctor | Portal + Email |

---

## 28. Internationalization & RTL Support

### 28.1 Languages Supported

| Language | Code | Script | RTL |
|---|---|---|---|
| English | en | Latin | No |
| Arabic | ar | Arabic | Yes |

(Additional languages can be added — see i18n framework below)

### 28.2 Language Selection

- Language selector in header and footer (not country detection-based — user choice only)
- Candidate email invitations sent in the language selected on their candidate record
- Report PDFs generated in the language of the session
- Arabic RTL layout: all CSS logical properties, `<html dir="rtl">` for Arabic

### 28.3 RTL Implementation Rules

- Use Tailwind CSS logical properties: `ms-` / `me-` instead of `ml-` / `mr-`
- All flexbox direction reverses automatically with RTL
- Arabic fonts: **Noto Kufi Arabic** (headings) + **IBM Plex Arabic** (body)
- Date/time: `Intl.DateTimeFormat({locale})` throughout — no hardcoded date formats
- Numbers: `Intl.NumberFormat({locale})`
- PDF reports: separate RTL layout variant for Arabic

---

# PART 6 — FRONTEND DESIGN SYSTEM

---

## 29. Design Tokens & Visual Language

### 29.1 Design Principles

**Website:** Professional, data-driven, dark enterprise. CSS transitions and GSAP scroll reveals. No Three.js, no WebGL, no particle systems.

**Portals (Admin, Master Proctor, Proctor, HR, Exam Setup, Sales):** Dark-first, data-dense, precision-engineered. Purposeful animations — state changes, guidance, confirmations only.

**Exam interface (Candidate):** Minimal, calm, focused. No animations during exam. Clean typography, clear timer, unobtrusive status indicators.

### 29.2 Design Tokens (CSS Custom Properties)

```css
:root {
  /* ── Backgrounds ── */
  --bg-base:          #060B18;     /* deepest background */
  --bg-surface:       #0D1526;     /* cards, panels */
  --bg-elevated:      #111827;     /* modals, dropdowns */
  --bg-glass:         rgba(255, 255, 255, 0.04);
  --bg-glass-border:  rgba(255, 255, 255, 0.08);

  /* ── Accent Colors ── */
  --cyan:             #00D4FF;     /* primary CTAs, active states */
  --violet:           #6D28D9;     /* secondary accent, gradients */
  --emerald:          #059669;     /* pass, success, verified */
  --amber:            #D97706;     /* warning, caution */
  --rose:             #E11D48;     /* fail, critical, disqualified */

  /* ── Text ── */
  --text-primary:     #F1F5F9;
  --text-secondary:   #94A3B8;
  --text-muted:       #475569;

  /* ── Glow Effects (subtle — portals) ── */
  --glow-cyan:        0 0 20px rgba(0, 212, 255, 0.25);
  --glow-violet:      0 0 20px rgba(109, 40, 217, 0.25);
  --glow-emerald:     0 0 20px rgba(5, 150, 105, 0.25);
  --glow-rose:        0 0 20px rgba(225, 29, 72, 0.25);

  /* ── Borders ── */
  --border:           rgba(255, 255, 255, 0.08);
  --border-accent:    rgba(0, 212, 255, 0.20);

  /* ── Spacing (8px base) ── */
  --sp-1: 4px;  --sp-2: 8px;   --sp-3: 12px;  --sp-4: 16px;
  --sp-6: 24px; --sp-8: 32px;  --sp-12: 48px; --sp-16: 64px;

  /* ── Typography ── */
  --font-ui:    'Inter', system-ui, sans-serif;
  --font-mono:  'JetBrains Mono', 'Fira Code', monospace;
  --font-ar-ui: 'Noto Kufi Arabic', sans-serif;
  --font-ar-body: 'IBM Plex Arabic', sans-serif;

  /* ── Radius ── */
  --r-sm: 4px; --r-md: 8px; --r-lg: 12px; --r-xl: 16px; --r-full: 9999px;

  /* ── Transitions ── */
  --t-fast:   150ms cubic-bezier(0.4, 0, 0.2, 1);
  --t-base:   250ms cubic-bezier(0.4, 0, 0.2, 1);
  --t-slow:   400ms cubic-bezier(0.4, 0, 0.2, 1);
  --t-spring: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 29.3 Color Semantics

| State | Color | CSS Var | Use |
|---|---|---|---|
| Active / Primary CTA | Cyan | `--cyan` | Active nav items, primary buttons, links |
| Secondary / Gradient | Violet | `--violet` | Gradients, secondary badges |
| Pass / Success / Verified | Emerald | `--emerald` | PASS verdict, verified FR, success toasts |
| Warning / Caution | Amber | `--amber` | Pending reports, warnings, caution states |
| Fail / Critical / Disqualified | Rose | `--rose` | FAIL verdict, critical AI flags, error states |
| Surface | `--bg-surface` | `#0D1526` | Card backgrounds |
| Glass | `--bg-glass` | rgba(255,255,255,0.04) | Glassmorphism panels |

### 29.4 Animation Rules

| Context | Tool | Examples |
|---|---|---|
| Website scroll reveals | GSAP ScrollTrigger | Element fade+slide on scroll-enter |
| Website headline | GSAP SplitText | Character stagger-in |
| Portal route transitions | Framer Motion | Slide+fade between routes |
| Portal components | Framer Motion | Card mount stagger, panel slide-in |
| Charts | Recharts built-in + CSS | Animated bar fills |
| Loading / skeleton | CSS skeleton | Per-component shimmer skeleton |
| Micro-interactions | CSS transitions | Button hover glow, toggle morph |
| Toasts / alerts | Framer Motion | Slide from top-right |
| Proctor critical alerts | CSS + optional audio | Red border pulse + shake |
| Tutorial spotlights | Driver.js | Backdrop blur + pulsing ring |

**Rules:**
- Animate only `transform` and `opacity` — never layout-triggering properties
- All animations must respect `prefers-reduced-motion: reduce` (disable or reduce to instant transition)
- **No Three.js, no WebGL, no particle systems — anywhere in the application**
- Portal animations are functional, not decorative — they communicate state

### 29.5 Responsive Breakpoints

| Name | Width | Layout |
|---|---|---|
| Mobile | < 640px | Single column, bottom nav, simplified charts |
| Tablet | 640–1024px | Two-column, collapsible nav |
| Desktop | 1024–1440px | Full portal layout, expanded sidebar nav |
| Wide | > 1440px | Max-width containers with increased whitespace |

---

## 30. UI Components & Layout Rules

### 30.1 Portal Layout Structure

All portals share the same layout shell:

```
┌─────────────────────────────────────────────────────────────┐
│  SIDEBAR (240px)    │  CONTENT AREA                          │
│  ─────────────────  │  ─────────────────────────────────     │
│  Logo               │  Page Header (title + actions)         │
│  ─────────────────  │  ─────────────────────────────────     │
│  Nav items          │  Content                               │
│  (role-specific)    │                                        │
│                     │                                        │
│  ─────────────────  │                                        │
│  User avatar        │                                        │
│  Notification bell  │                                        │
│  Settings link      │                                        │
└─────────────────────────────────────────────────────────────┘
```

On mobile/tablet: sidebar collapses to bottom navigation bar (icon + label).

### 30.2 Stat Cards

All dashboard stat cards follow the same pattern:

```
┌─────────────────────────────┐
│  Icon (24px, accent color)  │
│                             │
│  [Large CountUp number]     │
│  Sub-label text             │
│                             │
│  ↑ +12% from last month     │
└─────────────────────────────┘
```

Background: `--bg-glass` with `--bg-glass-border` border. On hover: subtle glow. Clickable — deep-links to relevant view.

### 30.3 Tables

All data tables use TanStack Table v8. Standard behaviour:
- Sortable columns (click header)
- Client-side search filter
- Server-side pagination for large datasets (> 100 rows)
- Sticky header
- Row hover highlight
- Click row → detail view (or expand inline for simpler data)
- Bulk selection checkboxes for bulk actions

### 30.4 Forms

All forms use React Hook Form + Zod validation:
- Inline error messages below each field (not toast alerts)
- Disabled submit button until all required fields valid
- Loading spinner on submit (button disabled to prevent double-submit)
- Success toast on completion
- Error toast on API failure with specific error message

### 30.5 Notification Center

Bell icon in all portal nav bars. On click: slide-in panel (Framer Motion) showing all unread notifications sorted newest first. Each notification has a type icon, description, relative timestamp, and action button. Mark all as read. Click through to relevant section.

---

# PART 7 — ARCHITECTURE & INFRASTRUCTURE (Hostinger VPS)

---

## 31. Technology Stack

### 31.1 Frontend

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS + CSS Custom Properties |
| Animation | GSAP 3 + Framer Motion (no Three.js) |
| State | Zustand (UI state) + TanStack Query v5 (server state) |
| Forms | React Hook Form + Zod |
| Code editor | Monaco Editor (coding exams) |
| Tables | TanStack Table v8 |
| Charts | Recharts |
| Real-time | Socket.io client |
| i18n | next-intl |
| Onboarding | Driver.js |
| Video player | Custom React wrapper (HLS.js for VPS stream) |
| PDF preview | react-pdf |
| Testing | Vitest + React Testing Library + Playwright |

### 31.2 Backend

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | NestJS (modular, DI, TypeScript-native) |
| API | REST (primary) + WebSockets (Socket.io) |
| Jobs | BullMQ (Redis-backed) |
| ORM | Prisma |
| Auth | Passport.js + JWT + custom magic link |
| File storage | Local VPS disk + MinIO (S3-compatible object storage) |
| Cache | Redis 7 |
| Search | Meilisearch (lightweight, VPS-compatible — replaces Elasticsearch) |
| Process manager | PM2 |
| Reverse proxy | Nginx |

### 31.3 AI & ML

| Service | Provider | Purpose |
|---|---|---|
| Language model | OpenAI GPT-4o API | Report generation, AI narrative, answer grading, interview Q suggestions |
| Face detection | MediaPipe (in-browser, TensorFlow.js) | Real-time face presence + gaze during exam |
| Facial recognition | AWS Rekognition API (external API call only) | ID vs selfie identity verification |
| OCR (ID documents) | AWS Textract API (external API call only) | Extract name from ID document photo |
| Code sandbox | Docker + gVisor (on VPS) | Isolated code execution for coding tasks |
| CAD analysis | Python + ifcopenshell + ezdxf (on VPS) | Automated CAD/BIM file evaluation |

> Note: AWS Rekognition and Textract are used as external API services only — no AWS infrastructure is provisioned. API calls go from the VPS to AWS endpoints.

### 31.4 Email & SMS

| Service | Provider |
|---|---|
| Transactional email | SMTP2GO (SMTP relay, VPS-friendly, no IP blacklisting concerns) |
| SMS | Twilio API |
| WhatsApp (optional) | Twilio API |

---

## 32. Hostinger VPS Infrastructure Setup

### 32.1 VPS Configuration

**Recommended Hostinger VPS plan:** VPS KVM 4 or higher

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 4 vCPU | 8 vCPU |
| RAM | 8 GB | 16 GB |
| Storage | 200 GB SSD | 400 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

For scale-out: provision a second VPS for the worker processes (BullMQ jobs, recording processing, code sandbox). Shared Redis and PostgreSQL on primary VPS.

### 32.2 Server Directory Structure

```
/var/assessexpert/
├── app/
│   ├── frontend/           → Next.js build output (served by Nginx)
│   └── backend/            → NestJS application
├── storage/
│   ├── recordings/         → Session recordings (7-day retention)
│   │   └── {sessionId}/
│   │       ├── screen.webm
│   │       └── webcam.webm
│   ├── reports/            → Published report PDFs (permanent)
│   │   └── {reportId}/
│   │       └── report_v1.pdf
│   ├── practical-files/    → Candidate submitted files
│   │   └── {sessionId}/
│   ├── question-assets/    → Images in questions (if any)
│   └── temp/               → Temporary processing files (auto-purged)
├── logs/
│   ├── nginx/
│   ├── nestjs/
│   └── pm2/
└── scripts/
    ├── recording-purge.sh  → Daily cron — purge expired recordings
    └── backup.sh           → Daily DB backup to external storage
```

### 32.3 Software Stack Installation

**System packages:**
```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 15
sudo apt install postgresql postgresql-contrib

# Redis 7
sudo apt install redis-server

# Nginx
sudo apt install nginx

# PM2
npm install -g pm2

# Docker (for code sandbox)
sudo apt install docker.io
sudo systemctl enable docker
```

**MinIO (S3-compatible object storage):**
```bash
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/
# Configure as systemd service — stores files in /var/assessexpert/storage/minio
```

**Meilisearch:**
```bash
curl -L https://install.meilisearch.com | sh
# Configure as systemd service
```

**Python environment (for CAD analysis):**
```bash
sudo apt install python3 python3-pip
pip3 install ifcopenshell ezdxf openpyxl
```

### 32.4 Nginx Configuration

```nginx
# /etc/nginx/sites-available/assessexpert

# Main app portal
server {
    listen 443 ssl http2;
    server_name app.assessexpert.ae;
    
    ssl_certificate /etc/letsencrypt/live/app.assessexpert.ae/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.assessexpert.ae/privkey.pem;
    
    # Next.js frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # NestJS API
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;
        client_max_body_size 500M;  # For recording uploads
    }
    
    # WebSocket (Socket.io)
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Static file serving for recordings (signed URL validation via NestJS middleware)
    location /media/ {
        internal;
        root /var/assessexpert/storage;
    }
}

# Public website
server {
    listen 443 ssl http2;
    server_name assessexpert.ae www.assessexpert.ae;
    
    ssl_certificate /etc/letsencrypt/live/assessexpert.ae/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/assessexpert.ae/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3001;   # Separate Next.js instance for public site
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}

# Verification portal
server {
    listen 443 ssl http2;
    server_name verify.assessexpert.ae;
    
    ssl_certificate /etc/letsencrypt/live/verify.assessexpert.ae/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/verify.assessexpert.ae/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3002;   # Separate minimal Next.js app
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
```

### 32.5 PM2 Process Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'assessexpert-api',
      script: 'dist/main.js',
      cwd: '/var/assessexpert/app/backend',
      instances: 2,            // 2 instances for load balancing
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production', PORT: 4000 }
    },
    {
      name: 'assessexpert-workers',
      script: 'dist/workers.js',
      cwd: '/var/assessexpert/app/backend',
      instances: 1,
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'assessexpert-portal',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/var/assessexpert/app/frontend/portal',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'assessexpert-website',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      cwd: '/var/assessexpert/app/frontend/website',
      env: { NODE_ENV: 'production' }
    }
  ]
};
```

### 32.6 SSL Certificates

Use Let's Encrypt via Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d assessexpert.ae -d www.assessexpert.ae -d app.assessexpert.ae -d verify.assessexpert.ae
# Auto-renewal via systemd timer (set up automatically by certbot)
```

### 32.7 Database Configuration

PostgreSQL on the same VPS (dedicated socket connection from NestJS via Prisma):

```bash
# Create database and user
sudo -u postgres psql
CREATE DATABASE assessexpert;
CREATE USER assessexpert_app WITH PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE assessexpert TO assessexpert_app;
```

**Connection via PgBouncer (connection pooling):**
```bash
sudo apt install pgbouncer
```

PgBouncer config: pool_mode = transaction, max_client_conn = 200, default_pool_size = 20.

### 32.8 Backup Strategy

**Daily automated backup:**
```bash
# /var/assessexpert/scripts/backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
# Database backup
pg_dump assessexpert | gzip > /tmp/db_backup_$DATE.sql.gz
# Upload to Hostinger Object Storage or external SFTP
# (configure destination in environment)
# Retain last 30 days of backups
find /backups/ -name "db_backup_*.sql.gz" -mtime +30 -delete
```

Cron entry: `0 2 * * * /var/assessexpert/scripts/backup.sh`

**Recordings are NOT backed up** — they are temporary (7-day retention) and candidates have already submitted. Only the report PDF (permanent) is backed up.

### 32.9 Recording Purge Cron

```bash
# /var/assessexpert/scripts/recording-purge.sh
#!/bin/bash
# Query DB for sessions where practicalSubmittedAt < NOW() - 7 days
# and recording has not yet been purged
# Delete recording files, update session record
node /var/assessexpert/app/backend/scripts/purge-recordings.js
```

Cron entry: `0 3 * * * /var/assessexpert/scripts/recording-purge.sh`

---

## 33. Backend Architecture

### 33.1 NestJS Module Structure

```
src/
├── modules/
│   ├── auth/               → JWT, magic link, OTP, MFA, sessions
│   ├── users/              → User CRUD, role management
│   ├── organizations/      → Multi-tenant org management, branding
│   ├── assessments/        → Assessment config, type catalogue
│   ├── questions/          → Question bank, 500-pool management, shuffle engine
│   ├── practical-tasks/    → Task library, starter files, rubrics
│   ├── candidates/         → Candidate records, batch import
│   ├── scheduling/         → Auto-scheduling engine, proctor availability
│   ├── sessions/           → Exam session lifecycle, magic links
│   ├── checklist/          → Proctor checklist records + enforcement
│   ├── exam-delivery/      → Question-by-question delivery, answer recording
│   ├── proctoring/         → AI events, flags, live monitoring, incident logs
│   ├── facial-recognition/ → Identity verification, periodic FR, FR log
│   ├── recordings/         → WebM chunked upload, 7-day lifecycle, player tokens
│   ├── sandbox/            → Docker/gVisor code execution
│   ├── grading/            → Auto + AI + human grading pipeline
│   ├── reports/            → AI draft, proctor review, PDF gen (Puppeteer), publication
│   ├── notifications/      → Email (SMTP2GO), SMS (Twilio), WebSocket (Socket.io)
│   ├── storage/            → MinIO file management, signed URLs
│   ├── i18n/               → Translation management
│   ├── compliance/         → Consent logging, data retention, audit log
│   ├── sales/              → Lead management, client health
│   └── admin/              → Super admin operations, feature flags
├── common/
│   ├── guards/             → Auth, role, tenant isolation, rate limiting
│   ├── interceptors/       → Logging, response transform, tenant inject
│   ├── filters/            → Exception handling, error format
│   ├── pipes/              → Validation (Zod/class-validator), sanitization
│   └── decorators/         → Custom metadata decorators
├── config/                 → Environment config (Joi schema validation)
├── database/               → Prisma schema, migrations, seeds
└── jobs/                   → BullMQ job definitions and processors
```

### 33.2 BullMQ Queues

| Queue | Jobs | Priority | SLA |
|---|---|---|---|
| `grading-mcq` | Auto-grade MCQ on submission | Critical | < 5 seconds |
| `grading-code` | Docker sandbox code execution | High | < 30 seconds |
| `grading-ai` | GPT-4o practical evaluation | High | < 5 minutes |
| `grading-practical` | CAD/BIM file parsing | High | < 10 minutes |
| `report-generate` | Assemble AI draft report | High | < 15 minutes from session end |
| `report-pdf` | Puppeteer PDF generation | High | < 2 minutes from proctor publish |
| `notifications` | Email / SMS / WhatsApp | Medium | < 30 seconds |
| `recording-finalize` | Complete chunked upload, set expiry | Medium | < 5 minutes after session |
| `recording-purge` | Delete expired recordings (daily) | Low | Daily scheduled |
| `analytics-aggregate` | Update dashboard aggregations | Low | Every 15 minutes |

### 33.3 Multi-Tenant Isolation

Every API endpoint that returns data must be scoped to the authenticated user's `organizationId`. This is enforced via a Prisma middleware interceptor that automatically injects the `organizationId` filter on all queries for tenant-scoped models.

```typescript
// Prisma middleware — applied globally
prisma.$use(async (params, next) => {
  const tenantScopedModels = [
    'ExamSession', 'CandidateRecord', 'Report', 
    'Assessment', 'CandidateBatch'
  ];
  
  if (
    tenantScopedModels.includes(params.model) &&
    request.user.role !== 'SUPER_ADMIN' &&
    request.user.role !== 'MASTER_PROCTOR'
  ) {
    if (params.action === 'findMany') {
      params.args.where = {
        ...params.args.where,
        organizationId: request.user.organizationId
      };
    }
  }
  
  return next(params);
});
```

---

## 34. Database Design

### 34.1 Core Tables (Prisma Schema)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organization {
  id                  String   @id @default(cuid())
  name                String
  slug                String   @unique
  country             String
  industry            String
  size                String?
  status              OrgStatus @default(ACTIVE)
  brandingConfig      Json?
  contractStartDate   DateTime?
  contractEndDate     DateTime?
  assignedSalesAgentId String?
  users               User[]
  candidates          CandidateRecord[]
  sessions            ExamSession[]
  reports             Report[]
  createdAt           DateTime @default(now())
}

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  passwordHash      String?
  role              UserRole
  organizationId    String?
  organization      Organization? @relation(fields: [organizationId], references: [id])
  firstName         String
  lastName          String
  phone             String?
  timezone          String    @default("UTC")
  preferredLanguage String    @default("en")
  mfaEnabled        Boolean   @default(false)
  mfaSecret         String?
  status            UserStatus @default(ACTIVE)
  lastLoginAt       DateTime?
  lastLoginIp       String?
  createdAt         DateTime  @default(now())
}

model AssessmentType {
  id                    String   @id @default(cuid())
  name                  String
  category              String
  industry              String
  jobRole               String
  description           String?
  mcqTimeLimit          Int      @default(30)
  mcqQuestionCount      Int      @default(25)
  mcqPassThreshold      Float    @default(60.0)
  practicalType         PracticalType
  practicalTimeLimit    Int      @default(60)
  practicalPassThreshold Float   @default(60.0)
  requiresGuardPro      Boolean  @default(false)
  status                AssessmentStatus @default(DRAFT)
  createdBy             String
  createdAt             DateTime @default(now())
  questions             Question[]
  practicalTasks        PracticalTask[]
  sessions              ExamSession[]
}

model Question {
  id                String   @id @default(cuid())
  assessmentTypeId  String
  assessmentType    AssessmentType @relation(fields: [assessmentTypeId], references: [id])
  type              QuestionType
  content           Json     // {text, imageUrl?, codeBlock?}
  options           Json     // [{key: "A", text: "..."}, ...]
  correctAnswer     Json     // ["B"] or ["A", "C"] for multi-select
  explanation       String?
  difficulty        Difficulty
  domain            String
  tags              String[]
  marks             Float    @default(1.0)
  language          String   @default("en")
  status            QuestionStatus @default(DRAFT)
  aiGenerated       Boolean  @default(false)
  usageCount        Int      @default(0)
  version           Int      @default(1)
  createdBy         String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  answers           ExamAnswer[]
}

model SessionQuestionAssignment {
  id            String   @id @default(cuid())
  sessionId     String   @unique
  session       ExamSession @relation(fields: [sessionId], references: [id])
  questionIds   String[]    // Ordered list of 25 question IDs
  questionOrder Json        // [{questionId, position, answeredAt, timeSpentSeconds}]
  shuffleSeed   String
  generatedAt   DateTime @default(now())
  generatedByProctorId String
}

model PracticalTask {
  id               String   @id @default(cuid())
  assessmentTypeId String
  assessmentType   AssessmentType @relation(fields: [assessmentTypeId], references: [id])
  type             PracticalType
  title            String
  description      String   // Rich text (HTML stored)
  starterFilePath  String?  // VPS storage path
  starterFileName  String?
  rubricData       Json
  rubricFilePath   String?
  acceptedFileTypes String[]
  status           TaskStatus @default(DRAFT)
  createdBy        String
  createdAt        DateTime @default(now())
  sessions         ExamSession[]
}

model CandidateRecord {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  email          String
  firstName      String
  lastName       String
  phone          String?
  jobPosition    String
  batchId        String?
  source         CandidateSource @default(MANUAL)
  sessions       ExamSession[]
  createdAt      DateTime @default(now())
  
  @@unique([email, organizationId])
}

model ExamSession {
  id               String   @id @default(cuid())
  assessmentTypeId String
  assessmentType   AssessmentType @relation(fields: [assessmentTypeId], references: [id])
  candidateId      String
  candidate        CandidateRecord @relation(fields: [candidateId], references: [id])
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id])
  proctorId        String?
  scheduledAt      DateTime
  magicToken       String   @unique
  tokenExpiresAt   DateTime
  tokenUsedAt      DateTime?
  tokenUsedFromIp  String?
  
  status           SessionStatus @default(SCHEDULED)
  
  checklistCompletedAt   DateTime?
  mcqStartedAt           DateTime?
  mcqSubmittedAt         DateTime?
  practicalTaskId        String?
  practicalTask          PracticalTask? @relation(fields: [practicalTaskId], references: [id])
  practicalStartedAt     DateTime?
  practicalSubmittedAt   DateTime?
  
  guardproConnected      Boolean @default(false)
  candidateIp            String?
  
  screenRecordingPath    String?
  webcamRecordingPath    String?
  recordingExpiresAt     DateTime?
  
  integrityScore         Float?
  disqualified           Boolean @default(false)
  disqualifyReason       String?
  
  questionAssignment     SessionQuestionAssignment?
  answers                ExamAnswer[]
  events                 SessionEvent[]
  frLogs                 FacialRecognitionLog[]
  checklist              ProctorChecklist?
  report                 Report?
  createdAt              DateTime @default(now())
}

model ExamAnswer {
  id                String   @id @default(cuid())
  sessionId         String
  session           ExamSession @relation(fields: [sessionId], references: [id])
  questionId        String
  question          Question @relation(fields: [questionId], references: [id])
  position          Int      // 1–25 — position in this candidate's shuffled set
  questionSnapshot  Json     // IMMUTABLE: full question+options at time of exam
  candidateResponse Json     // What the candidate selected
  isCorrect         Boolean
  correctAnswer     Json     // Correct answer(s) at time of exam
  timeSpentSeconds  Int
  marks             Float    // Marks awarded for this question
  maxMarks          Float
  submittedAt       DateTime @default(now())
}

model ProctorChecklist {
  id                      String   @id @default(cuid())
  sessionId               String   @unique
  session                 ExamSession @relation(fields: [sessionId], references: [id])
  proctorId               String
  items                   Json     // [{key, label, completed, completedAt, notes}]
  completedAt             DateTime?
  candidateNameConfirmed  String?
  candidateEmailConfirmed Boolean @default(false)
  frVerificationResult    Json?
  recordingConsentGiven   Boolean @default(false)
  examGuidelinesDelivered Boolean @default(false)
  candidateAgreedToRules  Boolean @default(false)
}

model SessionEvent {
  id            String   @id @default(cuid())
  sessionId     String
  session       ExamSession @relation(fields: [sessionId], references: [id])
  eventType     EventType
  severity      EventSeverity
  source        EventSource
  timestamp     DateTime @default(now())
  payload       Json?
  screenshotPath String?
  reviewedBy    String?
  reviewOutcome ReviewOutcome?
  proctorNote   String?
}

model FacialRecognitionLog {
  id                  String   @id @default(cuid())
  sessionId           String
  session             ExamSession @relation(fields: [sessionId], references: [id])
  eventType           FREventType
  timestamp           DateTime @default(now())
  capturedImagePath   String
  referenceImagePath  String?
  similarityScore     Float
  outcome             FROutcome
  reviewedBy          String?
  reviewNotes         String?
}

model Report {
  id                  String   @id @default(cuid())
  sessionId           String   @unique
  session             ExamSession @relation(fields: [sessionId], references: [id])
  organizationId      String
  candidateId         String
  
  mcqScore            Float
  mcqPassed           Boolean
  mcqBreakdown        Json     // Full 25-question breakdown with answers
  practicalScore      Float?
  practicalPassed     Boolean?
  overallScore        Float
  overallPassed       Boolean
  integrityScore      Float
  
  competencyRadar     Json?    // {domain: score, ...}
  aiNarrative         String?  // GPT-4o generated narrative
  aiRecommendation    String?  // GPT-4o hire recommendation
  
  proctorNarrative    String?
  proctorVerdict      ProctorVerdict?
  practicalQuality    PracticalQuality?
  proctorOverrides    Json?
  
  status              ReportStatus @default(DRAFT)
  publishedAt         DateTime?
  publishedBy         String?
  pdfPath             String?
  pdfVersion          Int      @default(1)
  
  masterProctorReview Json?
  hrRating            Int?
  hrRatingNote        String?
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model AuditLog {
  id          String   @id @default(cuid())
  userId      String
  role        String
  eventType   String
  target      String?
  targetId    String?
  payload     Json?
  ipAddress   String
  chainHash   String   // SHA-256 of (previous_hash + this_event)
  createdAt   DateTime @default(now())
}

// Enums
enum UserRole {
  SUPER_ADMIN MASTER_PROCTOR EXAM_SETUP_MASTER SALES_AGENT
  ORG_ADMIN HR_MANAGER HIRING_MANAGER PROCTOR
}

enum SessionStatus {
  SCHEDULED INVITED WAITING_ROOM CHECKLIST
  MCQ_IN_PROGRESS MCQ_COMPLETE PRACTICAL_IN_PROGRESS
  SUBMITTED GRADING PENDING_PROCTOR_REVIEW
  REPORT_PUBLISHED CANCELLED NO_SHOW DISQUALIFIED
}

enum ReportStatus { DRAFT PENDING_REVIEW RETURNED PUBLISHED }
enum ProctorVerdict { PASS FAIL CONDITIONAL FLAGGED DISQUALIFIED }
enum PracticalQuality { EXCELLENT GOOD SATISFACTORY POOR DID_NOT_SUBMIT }
enum QuestionType { MCQ_SINGLE MCQ_MULTI TRUE_FALSE }
enum Difficulty { EASY MEDIUM HARD }
enum QuestionStatus { DRAFT PENDING_APPROVAL ACTIVE ARCHIVED }
enum PracticalType { CAD CODING LAB FILE NONE }
enum AssessmentStatus { DRAFT ACTIVE ARCHIVED }
enum TaskStatus { DRAFT ACTIVE ARCHIVED }
enum CandidateSource { UPLOAD MANUAL }
enum OrgStatus { ACTIVE SUSPENDED TRIAL }
enum UserStatus { ACTIVE INACTIVE SUSPENDED }
enum EventType {
  FACE_ABSENT FACE_MULTIPLE GAZE_OFFSCREEN AUDIO_ANOMALY
  TAB_SWITCH COPY_PASTE_ATTEMPT FULLSCREEN_EXIT
  DUPLICATE_LOGIN GUARDPRO_DISCONNECT VM_DETECTED
  PROCTOR_WARNING SESSION_PAUSED SESSION_TERMINATED
}
enum EventSeverity { INFO WARNING CRITICAL }
enum EventSource { AI GUARDPRO PROCTOR SYSTEM }
enum ReviewOutcome { DISMISSED CONFIRMED ESCALATED }
enum FREventType { PRE_EXAM_ID PERIODIC_CHECK LIVE_ANOMALY }
enum FROutcome { VERIFIED PENDING_REVIEW REJECTED }
```

---

## 35. Security & Compliance

### 35.1 Authentication Security

- Passwords: bcrypt with 12 salt rounds
- JWTs: RS256 signed (asymmetric), 15-minute access token, 7-day refresh token (rotating)
- MFA (TOTP): time-based OTP using speakeasy library, 30-second window, ±1 step drift tolerance
- Magic links: 128-bit random token (crypto.randomBytes), bound to candidate email, IP validation on second connection
- Rate limiting: 5 failed login attempts → 15-minute lockout per IP (Redis counter)

### 35.2 API Security

- All routes protected by JWT guard (except public website and verification endpoint)
- Role-based guards on every protected route
- Tenant isolation middleware (Prisma middleware — see Section 33.3)
- Request validation: class-validator + Zod on all inputs
- SQL injection: Prisma ORM with parameterized queries (no raw SQL in application code)
- XSS prevention: all user input sanitized before storage (DOMPurify on rich text)
- CORS: strict whitelist (`assessexpert.ae`, `app.assessexpert.ae`)
- Helmet.js: HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)

### 35.3 File Upload Security

- File type validation: MIME type + magic bytes check (not just extension)
- File size limits: per upload type (e.g., CAD files max 200MB, ID photos max 5MB)
- Filename sanitization: strip special characters, prevent path traversal
- Files stored outside web root: `/var/assessexpert/storage/` — served via signed URLs only
- Virus scanning: ClamAV scan on all uploads before storing

### 35.4 Data Privacy & Compliance

**Consent logging:**
- Every candidate's recording consent is logged: timestamp, session ID, candidate email, IP
- Exam guideline acknowledgment logged per session

**Data retention:**
- Recordings: 7 days from session end (cron purge)
- FR images (candidate photos taken for FR): 90 days
- Reports: permanent (never deleted)
- Audit log: permanent (append-only, SHA-256 chained)

**GDPR / UAE PDPL compliance:**
- DSAR (Data Subject Access Request) workflow: candidate or HR can request all data for a specific candidate
- Data deletion workflow: can delete candidate personal data while preserving anonymized assessment results
- Cookie consent banner on public website

**Audit log:**
- Append-only, SHA-256 chain hash (each entry hashes the previous entry's hash — tamper-evident)
- Stored in PostgreSQL `AuditLog` table
- All significant events: login, logout, session create, checklist complete, MCQ start, practical start, report publish, user create, company create, question edit

### 35.5 Nginx Security Headers

```nginx
add_header X-Frame-Options "DENY";
add_header X-Content-Type-Options "nosniff";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' wss://app.assessexpert.ae;";
```

---

## 36. Performance & Scalability on VPS

### 36.1 Performance Targets

| Metric | Target |
|---|---|
| Portal page load (first contentful paint) | < 2 seconds |
| API response time (95th percentile) | < 300ms |
| Question delivery latency | < 100ms (Redis cached question set) |
| Recording upload (per chunk) | < 5 seconds per 60-second chunk |
| Report generation (AI draft) | < 15 minutes from session end |
| PDF generation | < 2 minutes from proctor publish |
| Concurrent exam sessions | 50 simultaneous (VPS KVM 4 spec) |

### 36.2 Caching Strategy

- **Question pool cache:** Redis cache of active questions per assessment type (invalidated on question add/archive). Prevents DB query per session question draw.
- **Session state cache:** Active session states (status, current question position, timer) cached in Redis for sub-millisecond reads during exam delivery.
- **Dashboard aggregations:** Pre-aggregated stats updated every 15 minutes by BullMQ job — dashboard loads from cache, not live DB query.
- **Static assets:** Nginx serves Next.js static assets with 1-year cache headers.

### 36.3 Database Query Optimization

- Indexes on all foreign keys and all `WHERE` clause fields
- Composite indexes on `(organizationId, createdAt)` for all tenant-scoped tables
- `ExamAnswer` indexed on `(sessionId, position)` for ordered question fetch
- `Question` indexed on `(assessmentTypeId, status, language)` for pool queries
- Regular `VACUUM ANALYZE` scheduled via pg_cron

### 36.4 Scaling Path

The architecture is designed to scale horizontally when needed:

1. **Phase 1 (current):** Single VPS — all services on one machine
2. **Phase 2:** Add second VPS for BullMQ workers (offload grading and report jobs)
3. **Phase 3:** Move PostgreSQL to a managed database (Hostinger Managed MySQL or external PostgreSQL provider)
4. **Phase 4:** Add a second application VPS and load balance via Nginx upstream

---

# PART 8 — DELIVERY

---

## 37. Development Phases & Timeline

### Phase 1 — Foundation (Weeks 1–4)
**Goal:** Authentication, multi-tenancy, basic portals functional

- VPS setup: Ubuntu, Nginx, PostgreSQL, Redis, PM2, SSL certificates
- NestJS project scaffold — all modules created, basic CRUD
- Prisma schema — all tables created, migrations seeded
- Next.js portal scaffold — layout, routing, design tokens, auth pages
- Authentication complete: email/password, JWT, MFA (TOTP), magic link
- Role-based guards on all routes
- Super Admin: company creation, user creation
- Basic HR Dashboard: candidate management, scheduling stub

**Deliverable:** Authenticated portals accessible on VPS; all roles can log in; companies and users can be created.

### Phase 2 — Exam Engine Core (Weeks 5–8)
**Goal:** Full exam session lifecycle working end-to-end

- Question bank: 500-question pool structure, CRUD, bulk import
- Fisher-Yates shuffle engine: server-side, session assignment, per-question delivery API
- Proctor checklist: 10-item implementation, server-side lock enforcement
- MCQ exam delivery: one-question-at-a-time API, server-side timer, answer recording
- Practical task delivery: file download/upload, Monaco editor integration, coding sandbox (Docker/gVisor)
- Session lifecycle state machine: all status transitions
- Candidate environment: full UI from magic link to completion screen
- Proctor live session control room: full UI with candidate feeds

**Deliverable:** Complete exam can be run end-to-end: candidate receives magic link, proctor runs checklist, MCQ served and answered, practical assigned and submitted, session closes.

### Phase 3 — AI, Recording & Reporting (Weeks 9–12)
**Goal:** Full post-exam pipeline working

- Screen recording: MediaRecorder capture, chunked upload to VPS, dual-pane player
- AI proctoring: MediaPipe face detection, event logging, WebSocket real-time display
- Facial recognition: AWS Rekognition integration, pre-exam check, periodic checks
- MCQ auto-grading: per-answer calculation, pass/fail
- Practical grading: coding sandbox evaluation, CAD file analysis, AI rubric evaluation
- Report generation: GPT-4o narrative, full question breakdown, competency radar
- Proctor report review UI: recording player, report editor, publish action
- Report PDF: Puppeteer PDF with digital signature, QR code
- HR Dashboard: published reports, recording player, download PDF
- 7-day recording purge: cron job implementation and testing

**Deliverable:** Full post-exam pipeline working. Proctor can review report, publish it, HR can view published report with question-by-question breakdown, download PDF, watch recording.

### Phase 4 — All Portals & Polish (Weeks 13–16)
**Goal:** All portals complete, all dashboards functional

- Master Proctor Dashboard: all tabs including exam creation flow
- Exam Setup Master Dashboard: all tabs including exam simulation
- Sales Agent Panel: lead management, company health
- Admin Dashboard: all tabs including settings, audit log, question management
- Notification system: all 25 events, email templates, SMS, in-portal
- Onboarding tutorial: HR 12-step, Proctor 8-step (Driver.js)
- Arabic RTL: full RTL layout for all portals
- Public website: all sections, GSAP animations, no Three.js
- GuardPro integration: heartbeat detection, checklist item 8

**Deliverable:** All portals complete. Platform ready for testing.

### Phase 5 — Testing & Launch (Weeks 17–20)
**Goal:** Quality assurance, security, and production deployment

- Unit tests ≥ 80% coverage (Vitest)
- Integration tests for all API endpoints
- E2E tests: all P0 scenarios (Playwright)
- Load testing: 50 concurrent sessions
- Security review: dependency audit, input validation sweep, auth flow review
- Performance optimization: caching, query optimization, image optimization
- Accessibility audit: axe-core on all main pages
- Cross-browser: Chrome 120+, Edge 120+, Firefox 120+, Safari 16+
- Mobile responsive: iOS Safari 16+, Android Chrome 120+
- RTL: full Arabic session E2E
- Soft launch: 2–3 pilot companies for real-world testing
- Fixes from pilot feedback
- Production launch

---

## 38. Testing Strategy

### 38.1 Unit Testing (Vitest)

- All service layer business logic
- Shuffle algorithm: determinism, uniqueness, correct count
- Timer calculations: start, remaining, expiry
- Grading calculations: score, pass/fail, weighted scores
- Report assembly: correct data mapping from answers to report sections
- Auth: token generation, validation, expiry

### 38.2 Integration Testing

- All API endpoints: correct status codes, response shapes, error handling
- Tenant isolation: verify that HR Manager from company A cannot access company B's data
- Session state machine: all valid transitions pass, all invalid transitions are rejected
- Checklist enforcement: "Begin Assessment" cannot be called with incomplete checklist
- Question delivery: questions served in correct order, no repetition within session
- Recording purge: sessions older than 7 days are purged (time-mocked test)

### 38.3 E2E Testing (Playwright)

**P0 scenarios (must pass before launch):**

1. Candidate completes full exam end-to-end (magic link → MCQ → practical → submission)
2. Proctor completes full checklist and starts MCQ for a candidate
3. MCQ timer expires — exam auto-submits
4. Proctor assigns practical task after MCQ
5. Proctor reviews AI report and publishes
6. HR Manager views published report with full question breakdown
7. HR Manager downloads PDF
8. HR Manager watches recording
9. 7-day recording purge verified (time-accelerated test)
10. Admin creates company and HR Manager account
11. Admin creates new assessment type and question pool (100+ questions)
12. Master Proctor creates new exam end-to-end
13. Master Proctor joins live session as observer
14. Duplicate magic link login blocked
15. Tab switch during MCQ → flag raised → proctor notified
16. Face absence > 8 seconds → AI flag raised
17. GuardPro disconnect during exam → alert raised
18. Report published → HR notification received
19. Arabic RTL layout: full exam session in Arabic
20. Mobile responsive: full HR dashboard on mobile viewport

---

## 39. Pre-Launch Checklist

### Infrastructure (DevOps)
- [ ] VPS provisioned: Hostinger VPS KVM 4 (or higher), Ubuntu 22.04 LTS
- [ ] Domain DNS configured: assessexpert.ae, app.assessexpert.ae, verify.assessexpert.ae
- [ ] SSL certificates installed and auto-renewal configured (Let's Encrypt + Certbot)
- [ ] Nginx configured: all virtual hosts, WebSocket upgrade, media file serving
- [ ] PostgreSQL 15 installed, database created, user created
- [ ] Redis 7 installed and configured
- [ ] MinIO installed and configured
- [ ] Meilisearch installed and configured
- [ ] PM2 installed: all 4 processes defined in ecosystem.config.js
- [ ] Docker installed: gVisor runtime configured for code sandbox
- [ ] Python 3 + ifcopenshell + ezdxf installed
- [ ] Backup script configured and cron scheduled (2 AM daily)
- [ ] Recording purge cron scheduled (3 AM daily)
- [ ] Firewall: ufw configured — only ports 80, 443, 22 (SSH restricted to developer IPs)

### Backend (Engineering)
- [ ] Prisma schema: all migrations applied to production database
- [ ] Seed data: at least 1 Super Admin account, 1 assessment type with 100+ questions
- [ ] All environment variables configured in `.env.production`
- [ ] BullMQ: all 10 queues operational, Redis connection verified
- [ ] SMTP2GO: email sending tested (invitation, OTP, report notification)
- [ ] Twilio SMS: OTP sending tested
- [ ] AWS Rekognition API: FR check tested with sample images
- [ ] OpenAI GPT-4o API: report narrative generation tested
- [ ] Magic link generation and OTP flow tested end-to-end
- [ ] Tenant isolation verified: cross-company data access impossible
- [ ] Checklist server enforcement: "Begin Assessment" blocked without complete checklist
- [ ] Fisher-Yates shuffle: 25 unique questions drawn from 500-pool verified
- [ ] ExamAnswer snapshots: questionSnapshot stored correctly per answer
- [ ] Report generation: full question breakdown in report JSON verified
- [ ] PDF generation (Puppeteer): signed PDF with QR code verified
- [ ] 7-day recording purge: tested with time-mocked sessions
- [ ] Audit log: chain hashes verified on sample entries

### Frontend (Engineering)
- [ ] Public website: all sections rendered, GSAP animations working, mobile-responsive
- [ ] No Three.js / WebGL components anywhere in codebase
- [ ] Contact form: business email validation working, lead notification working
- [ ] All portal auth flows: email/password, MFA, magic link, Google OAuth (HR)
- [ ] Candidate: magic link → waiting room → MCQ → practical → completion screen
- [ ] MCQ one-question delivery: no back navigation, timer sync, auto-submit
- [ ] Proctor checklist: all 10 items, "Begin Assessment" locked until complete
- [ ] Live monitoring: camera feeds, screen share view, AI event log
- [ ] Report review: recording player, question breakdown table, publish action
- [ ] HR Dashboard: published reports, question breakdown visible, recording countdown
- [ ] Master Proctor: exam creation flow, all 7 tabs working
- [ ] Arabic RTL: full Arabic session E2E — no LTR leakage in RTL mode
- [ ] All animations respect `prefers-reduced-motion: reduce`
- [ ] Mobile responsive verified: candidate environment on mobile
- [ ] Onboarding tutorial: HR 12 steps, Proctor 8 steps

### Compliance & Legal
- [ ] Privacy Policy: English + Arabic — legal reviewed
- [ ] Terms of Service — legal reviewed
- [ ] Recording consent disclosure — integrated in proctor checklist item 10
- [ ] Cookie consent banner — public website
- [ ] Data retention policies verified: recordings 7 days, FR images 90 days, reports permanent
- [ ] Consent events logged: timestamp, session ID, IP address
- [ ] DSAR workflow: can export all data for a candidate

---

# APPENDICES

---

## Appendix A — Assessment Types Matrix

The platform supports any assessment type. The following are example types that should be seeded in the initial database:

| # | Assessment Type | Category | Practical Type |
|---|---|---|---|
| 1 | AutoCAD Draftsman Level 1 | Engineering | CAD |
| 2 | AutoCAD Draftsman Level 2 | Engineering | CAD |
| 3 | BIM Coordinator Level 1 | Engineering | CAD |
| 4 | BIM Coordinator Level 2 | Engineering | CAD |
| 5 | Revit Specialist | Engineering | CAD |
| 6 | Civil Site Engineer | Engineering | File |
| 7 | Structural Engineer | Engineering | File |
| 8 | Python Developer | IT | Coding |
| 9 | JavaScript Developer | IT | Coding |
| 10 | Data Analyst | IT | Coding |
| 11 | Network Engineer | IT | Lab |
| 12 | Cybersecurity Analyst | IT | Lab |
| 13 | System Administrator | IT | Lab |
| 14 | HR Generalist | HR | File |
| 15 | Accountant Level 1 | Finance | File |
| 16 | Accountant Level 2 | Finance | File |
| 17 | Financial Analyst | Finance | File |
| 18 | Project Manager | Operations | File |
| 19 | Logistics Coordinator | Operations | File |
| 20 | Customer Service Specialist | Operations | File |

Each assessment type requires 500 active MCQ questions and at least one practical task to be set to ACTIVE status.

---

## Appendix B — All Notification Email Templates

All transactional emails use a consistent template wrapper:
- assessexpert logo in header
- Dark background (`#060B18`) with cyan accent
- Company name in footer where applicable
- Unsubscribe link where legally required
- Arabic variants for all candidate-facing emails

**Template: Candidate Exam Invitation (INV-001)**
```
Subject: Your Assessment is Scheduled — [Company Name] × assessexpert

Hi [First Name],

You have been scheduled for a technical assessment by [Company Name].

Assessment: [Assessment Type Name]
Date & Time: [Date] at [Time] ([Timezone])
Duration: approximately 90 minutes

On the day of your assessment:
• Be in a quiet, well-lit room with a working webcam
• Ensure stable internet connection
• Have your government-issued photo ID ready

Your exam link will be active from [Time] to [Time + 30 min].
Do not share this link with anyone.

[ACCESS YOUR EXAM]

If you have any technical issues, email: support@assessexpert.ae

Good luck,
The assessexpert Team
```

**Template: Report Published (RPT-PUB)**
```
Subject: Assessment Report Available — [Candidate Name]

Hi [HR Manager Name],

The assessment report for [Candidate Full Name] has been published.

Assessment: [Assessment Type]
Conducted: [Session Date]
Overall Result: [PASS / FAIL / CONDITIONAL]
MCQ Score: [X/25] ([Y%])
Proctor: [Proctor Name]

[VIEW REPORT IN DASHBOARD]

This report includes the candidate's full question-by-question MCQ response breakdown.
The session recording is available for [N] more days.

assessexpert | Orbit Training · Dubai, UAE
```

---

## Appendix C — Full API Endpoint Reference

### Auth Endpoints
```
POST /api/auth/login              → Email + password login
POST /api/auth/mfa/verify         → Verify TOTP/OTP code
POST /api/auth/refresh            → Refresh access token
POST /api/auth/logout             → Invalidate refresh token
POST /api/auth/magic-link/verify  → Validate magic link token
POST /api/auth/otp/send           → Send OTP to candidate email
POST /api/auth/otp/verify         → Verify candidate OTP
GET  /api/auth/me                 → Get current user profile
```

### Exam Delivery Endpoints (Candidate)
```
GET  /api/exam/session            → Get current session state
GET  /api/exam/question/current   → Get current question (one at a time)
POST /api/exam/question/submit    → Submit answer for current question
GET  /api/exam/timer              → Get server-authoritative timer state
POST /api/exam/practical/submit   → Submit practical task (file upload or code)
```

### Proctor Endpoints
```
GET  /api/proctor/sessions/today         → Today's assigned sessions
GET  /api/proctor/sessions/{id}          → Session detail
POST /api/proctor/sessions/{id}/join     → Join session (start camera)
POST /api/proctor/checklist/{sessionId}/{itemKey}/complete → Mark checklist item complete
POST /api/proctor/sessions/{id}/begin    → Begin assessment (checklist must be complete)
POST /api/proctor/sessions/{id}/assign-practical → Assign practical task
POST /api/proctor/sessions/{id}/pause    → Pause session
POST /api/proctor/sessions/{id}/resume  → Resume session
POST /api/proctor/sessions/{id}/warn    → Send warning to candidate
POST /api/proctor/sessions/{id}/terminate → Terminate session
POST /api/proctor/sessions/{id}/add-time → Add time extension
GET  /api/proctor/reports/{sessionId}   → Get AI draft report for review
PUT  /api/proctor/reports/{sessionId}   → Save proctor fields (narrative, verdict)
POST /api/proctor/reports/{sessionId}/publish → Publish report
```

### HR Manager Endpoints
```
GET  /api/hr/dashboard/stats          → Dashboard summary stats
GET  /api/hr/candidates               → List all candidates (paginated, filtered)
POST /api/hr/candidates               → Add single candidate
POST /api/hr/candidates/import        → Bulk import from CSV
GET  /api/hr/candidates/{id}          → Candidate profile + session history
GET  /api/hr/sessions                 → All sessions (paginated, filtered)
POST /api/hr/sessions                 → Schedule new session
GET  /api/hr/reports                  → All published reports (paginated)
GET  /api/hr/reports/{id}             → Full published report with question breakdown
GET  /api/hr/reports/{id}/pdf         → Download report PDF (signed URL)
GET  /api/hr/reports/{id}/recording   → Get recording player URL (signed, 2h expiry)
POST /api/hr/reports/{id}/rate        → Rate proctor report quality
```

### Master Proctor Endpoints
```
GET  /api/master-proctor/dashboard/stats     → Dashboard summary
GET  /api/master-proctor/sessions/live       → All live sessions
GET  /api/master-proctor/sessions            → All sessions (filtered)
POST /api/master-proctor/sessions/{id}/join  → Join as observer
POST /api/master-proctor/sessions/{id}/take-control → Take session control
GET  /api/master-proctor/proctors            → All proctors list
PUT  /api/master-proctor/proctors/{id}/availability → Override availability
POST /api/master-proctor/sessions/{id}/reassign → Reassign session to new proctor
POST /api/master-proctor/proctors/{id}/suspend  → Suspend proctor
GET  /api/master-proctor/reports             → All reports (filtered)
POST /api/master-proctor/reports/{id}/return → Return for modification
PUT  /api/master-proctor/reports/{id}/override → Direct override
GET  /api/master-proctor/assessment-types    → All assessment types
POST /api/master-proctor/assessment-types    → Create new assessment type
PUT  /api/master-proctor/assessment-types/{id} → Update assessment type
GET  /api/master-proctor/questions           → Question bank (filtered)
POST /api/master-proctor/questions           → Add question
PUT  /api/master-proctor/questions/{id}      → Edit question (direct, versioned)
POST /api/master-proctor/questions/import    → Bulk import questions
POST /api/master-proctor/questions/{id}/archive → Archive question
GET  /api/master-proctor/practical-tasks     → All practical tasks
POST /api/master-proctor/practical-tasks     → Create practical task
PUT  /api/master-proctor/practical-tasks/{id} → Update practical task
```

### Admin Endpoints
```
GET  /api/admin/dashboard/stats      → Platform-wide stats
GET  /api/admin/companies            → All companies
POST /api/admin/companies            → Create company
PUT  /api/admin/companies/{id}       → Update company
POST /api/admin/companies/{id}/suspend → Suspend company
GET  /api/admin/users                → All users across all roles
POST /api/admin/users                → Create user
PUT  /api/admin/users/{id}           → Update user
POST /api/admin/users/{id}/deactivate → Deactivate user
GET  /api/admin/sessions             → All sessions across all companies
GET  /api/admin/reports              → All published reports
POST /api/admin/reports/{id}/comments → Add admin comment
GET  /api/admin/assessment-types     → Assessment type catalogue
POST /api/admin/assessment-types     → Create assessment type
PUT  /api/admin/assessment-types/{id} → Update assessment type
GET  /api/admin/questions            → Question bank (all types)
POST /api/admin/questions            → Create question
PUT  /api/admin/questions/{id}       → Edit question
GET  /api/admin/audit-log            → Audit log (filtered, paginated)
GET  /api/admin/settings             → Get platform settings
PUT  /api/admin/settings             → Update platform settings
GET  /api/admin/feature-flags        → Get feature flags
PUT  /api/admin/feature-flags        → Update feature flags
```

### Public Endpoints
```
POST /api/public/contact             → Contact Us form submission
GET  /api/public/verify/{reportId}   → Report verification (no auth)
```

---

*Document: assessexpert Master Platform Development Specification v6.0*

*Scope: Global B2B SaaS Pre-Employment Assessment Portal — All Industries — Proctor-Controlled Lifecycle*

*Infrastructure: Hostinger VPS (Ubuntu 22.04 LTS) — No AWS infrastructure — No Three.js/WebGL*

*Question Bank: 500 questions per assessment type — Fisher-Yates shuffle — 25 questions per candidate*

*Report: Full question-by-question MCQ breakdown included in every published report*

*Exam Creation: Master Proctor can create and configure new exams end-to-end*

*Excluded: Payment/billing module (all commercial terms handled by Sales team offline)*

*Recording: 7-day retention from session end — scheduled cron purge*

*Data isolation: Strict multi-tenancy — each company sees only their own data*

*Prepared: May 2026 | Version: 6.0*

---

**assessexpert | Powered by Orbit Training · Dubai, UAE · assessexpert.ae**
*"Every result verified. Every hire protected."*
