# AssessExpert — Product Requirements Document

**Version:** 1.0  &nbsp;·&nbsp; **Status:** Implemented  &nbsp;·&nbsp; **Owner:** Orbit Training Point

> Verification note: this PRD reflects the implemented state of the codebase. Every requirement listed below has a corresponding code path; the system passes type-check cleanly on both backend and frontend. Runtime smoke-testing in a staging environment is still recommended before each production deploy.

---

## 1. Product Overview

AssessExpert is a B2B SaaS platform for **live-proctored, online technical assessments**. Hiring organisations schedule candidates onto time-boxed exam slots that combine multiple-choice questions, practical task submissions, and a live human proctor watching webcam, screen share, audio, and AI-driven behaviour signals in real time.

The platform is currently deployed as a single-VPS service (Apache reverse-proxy in front of a NestJS API and a Next.js portal), with PostgreSQL for state, Redis for ephemeral data, and LiveKit/socket.io for the live media plane.

## 2. Problem Statement

Pre-employment technical assessments today suffer from three failure modes:

1. **Cheating is invisible** — async assessment tools detect tab-switches but miss real-world cheating: a second monitor, an off-camera reference book, a coach in the room.
2. **Logistics don't scale** — running multiple candidates simultaneously usually means one proctor per candidate or a single shared screen with no privacy.
3. **Reporting is shallow** — most tools output a score and a recording. Hiring managers need a narrative they can act on.

AssessExpert addresses all three: a real proctor watches every candidate live, the same proctor can supervise several candidates in one slot, and the platform generates an AI-summarised report keyed to the proctor's review.

## 3. Goals

| # | Goal | Measure |
|---|---|---|
| G1 | Run a fully-proctored MCQ + practical exam end-to-end without manual intervention after scheduling | Auto-flow completes for 95% of sessions |
| G2 | Support 1–10 candidates per proctor slot using a single UI | Single screen handles both, no per-N branching |
| G3 | Detect cheating signals server-side | Multiple faces, face absent, tab switches, screen share off all raise events |
| G4 | Produce a publish-ready report within 1 hour of submission | Report SLA setting enforced |
| G5 | Tenant-isolate every data path | Cross-org reads return 404 |

## 4. Target Users (Roles)

| Role | Description | Key Actions |
|---|---|---|
| `SUPER_ADMIN` | Platform operator (Orbit) | Org CRUD, global settings, audit log, GDPR deletes |
| `ORG_ADMIN` | Customer admin | Manage their org's users, candidates, assessments |
| `HR_MANAGER` | Hiring side | Add candidates, schedule, view published reports |
| `HIRING_MANAGER` | Read-only HR | Review reports only |
| `MASTER_PROCTOR` | Senior proctor | Question/practical-set library, supervise any session, publish reports |
| `PROCTOR` | Live proctor | Run the proctor session UI, walk checklists, push exam phases |
| `EXAM_SETUP_MASTER` | Content author | Author MCQ pool + practical sets |
| `SALES_REP` | Internal sales | Lead pipeline (light CRM) |
| `CANDIDATE` | Examinee | OTP-authenticated, accesses one session via magic link |

## 5. Feature Inventory

### 5.1 Authentication & Identity
- Email + password login with bcrypt hashing
- TOTP-based MFA (setup, enable, verify)
- Refresh-token rotation
- Magic-link verification for proctors entering a session
- Per-candidate OTP via email (Redis-backed, 10-min TTL, 3-attempt lockout, per-email rate limit)
- JWT secret enforced at boot (≥32 chars, no fallback)

### 5.2 Organisation & User Management
- Multi-tenant: every operational row is scoped by `organizationId`
- Per-org settings: timezone, recording retention, allowed assessment types, branding, credits
- User invitation flow with token-based acceptance
- Status lifecycle: PENDING_INVITE → ACTIVE → SUSPENDED

### 5.3 Candidate Management
- Manual CRUD + RFC-4180 CSV bulk-import (5000-row cap)
- Email + organisation unique together
- Reference photo captured on first OTP-verified session, used as baseline for facial recognition
- Standard delete refuses to touch candidates with taken-exam history
- GDPR hard-delete (SUPER_ADMIN only) cascades through all related rows with chained audit log

### 5.4 Assessment Definition
- AssessmentType: MCQ pool source, MCQ count, MCQ time limit, practical time limit, pass thresholds
- Question bank: text + options + correct answer + difficulty + domain, status ACTIVE/ARCHIVED
- Practical libraries: individual `PracticalTask` rows OR multi-task `PracticalPaperSet` packages
- Archive (soft-delete) pattern — historical reports keep their referenced content intact

### 5.5 Scheduling
- HR picks date/time, system auto-assigns an available proctor
- **Auto-merge:** if a new candidate is scheduled within ±60s of an existing slot with the same proctor + assessment + org, they are merged into the same slot and share one magic link
- Invitation email with magic link, scheduled time, org timezone
- 24h and 1h reminder emails (Bull queue, in-memory fallback)
- Reschedule sends a dedicated "rescheduled" notice (not a duplicate invitation)
- Tenant validation: HR cannot schedule a candidate that belongs to another org

### 5.6 Live Session — Single Unified Multi-Candidate UI

Every session is treated as multi-candidate (N may be 1). One UI, one code path.

**Verification phase:**
- Proctor sees a grid of candidate tiles
- Click a tile → that candidate becomes active, audio is routed 1-to-1 to them
- Walk the proctor checklist for the active candidate
- Switch candidate → checklist preserves per-candidate state, hydrates from backend if previously completed items exist
- Each completed checklist sets `SessionCandidate.status = VERIFIED`
- "All Candidates Verified — Start Exam" button enables once every SessionCandidate row reaches a VERIFIED-or-later status

**MCQ phase:**
- Proctor pushes MCQ → backend draws 25 questions per candidate from the active pool, independently shuffled with per-candidate seeds
- Per-candidate timer (session-wide countdown started at push, configurable per AssessmentType)
- Each candidate submits at their own pace
- Session-level status flips to `MCQ_COMPLETE` only when EVERY candidate has finished

**MCQ auto-submit (timer expired):**
- Candidate browser fires `notifyTimerExpired` when client countdown hits 0
- Backend re-validates against `mcqStartedAt + limit` (defence against tampered clocks)
- Auto-fills blank answers (marked incorrect, 0 marks) for unanswered questions
- Server-side cron sweeps expired sessions every minute as a safety net (catches closed tabs)

**Practical phase:**
- On MCQ_COMPLETE, the system **automatically assigns a random active PracticalPaperSet per candidate** (different candidates may get different sets)
- Proctor can override any assignment manually before pushing
- Practical timer auto-submit mirrors MCQ behaviour

**Reports:**
- Generated per candidate (multi-candidate slots produce N reports)
- AI narrative via Gemini, integrity score from events, MCQ score from per-candidate answers
- Status flow: DRAFT → PENDING_REVIEW → RETURNED → PUBLISHED
- HR receives email + in-portal notification on publish
- Candidate receives a courtesy "result available" email (org-level opt-in, default ON)

### 5.7 Anti-Cheat & Monitoring
- Server-stored reference photo, MediaPipe-based face detection on every periodic check
- Client-side ML for multiple-faces / face-absent / behaviour signals
- Tab-switch, fullscreen-exit, screen-share-stopped events with per-event severity
- Auto-escalation threshold for tab switches
- Live AI flag queue visible to proctor; proctor can dismiss or escalate

### 5.8 Recording
- Per-candidate screen and webcam streams, chunked upload during session
- Final merge on session submit
- 7-day retention default (configurable per org)
- Daily cron purges expired recordings, fires orphan finalize every 2h for crashed sessions

### 5.9 Admin & Compliance
- Platform settings with per-key numeric bounds (retention 1–3650 days, thresholds 0–100%, etc.)
- Chained-hash audit log (Serializable transaction) — `GDPR_CANDIDATE_DELETED`, `SETTINGS_CHANGED`, etc.
- Legal content editor (Terms & Conditions, Privacy Policy) shown to candidates on OTP screen with DOMPurify-sanitised HTML
- Feature flag matrix with "Coming Soon" pills for un-built toggles

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Security** | JWT secret ≥32 chars required at boot. Helmet CSP. CORS allowlist via `FRONTEND_URLS`. Per-IP throttler on auth. Per-email rate limit on OTP issuance. Production responses never leak stack traces or Prisma error messages. |
| **Reliability** | Redis used with in-memory fallback so a Redis outage doesn't kill exams. Email failures captured in a health endpoint. Cron-driven sweeps recover from crashed sessions and orphan recordings. |
| **Data integrity** | Audit log uses Serializable transactions to prevent chain-hash race forks. Practical answer uploads block dangerous extensions (`.svg, .html, .js, .mjs, ...`). |
| **Tenant isolation** | HR scheduling, candidate fetch, and report reads all filter by `organizationId`. SUPER_ADMIN is the only role that can override. |
| **Pagination** | Every list endpoint clamps `take` (max 500 typical, 1000 for audit log) and returns `{ data, total }` for client-side paging. |
| **Performance** | Multi-candidate-aware queries fan out in `Promise.all` where independent. Bull queue absorbs reminder-send latency. |

## 7. Out of Scope (Current Release)

- Native mobile applications (web only)
- Built-in interview room (toggle present, integration future)
- Cloud VDI / Lab mode (toggle present, integration future)
- Arabic RTL beyond tech-check screen (full i18n future)
- Light theme (toggle present, theme switcher future)
- Auto-scheduling engine (proctor auto-assignment is single round-robin; full optimiser future)

## 8. Future Roadmap

1. Full Arabic i18n across the portal
2. Real GuardPro integration (currently a manual proctor confirmation)
3. Mobile-responsive proctor and HR dashboards
4. Native interview room and Cloud VDI
5. Sentry / OpenTelemetry observability
6. socket.io Redis adapter for multi-process scale-out
