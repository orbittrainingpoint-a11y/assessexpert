# AssessExpert — Technical Specification Document

**Version:** 1.0  &nbsp;·&nbsp; **Companion to:** [PRD.md](PRD.md), [FSD.md](FSD.md)

---

## 1. System Architecture

```
                  ┌───────────────────────────────────────────────┐
                  │                Internet (HTTPS)               │
                  └─────────────────────┬─────────────────────────┘
                                        │
                                ┌───────▼────────┐
                                │   Apache 2.4   │   (reverse proxy + TLS)
                                └───┬──────┬─────┘
                          /api/*    │      │   /*
                         (port 4000)│      │ (port 3000)
                                    │      │
                       ┌────────────▼┐    ┌▼────────────────────┐
                       │  NestJS API │    │ Next.js (App Router) │
                       │  pm2 cluster│    │ pm2 single instance │
                       └──────┬──────┘    └──────────┬──────────┘
                              │                      │ websocket
                ┌─────────────┼──────────────┐       │
                │             │              │       │
        ┌───────▼───┐  ┌──────▼──────┐  ┌────▼───────▼─────┐
        │PostgreSQL │  │   Redis     │  │ socket.io / WebRTC│
        │ + Prisma  │  │ (OTP, queue,│  │  signalling +     │
        │           │  │  signed URL)│  │  media plane       │
        └───────────┘  └─────────────┘  └────────────────────┘

                       ┌─────────────┐  ┌────────────────────┐
                       │  Local disk │  │ External services  │
                       │  /storage   │  │ SMTP, Gemini API,  │
                       │  (recording │  │ LiveKit TURN/STUN  │
                       │   captures) │  │                    │
                       └─────────────┘  └────────────────────┘
```

Single-VPS deployment. The submodule `assessexpert/` contains both `backend/` (NestJS) and `frontend/portal/` (Next.js); the outer repo holds deploy scripts + this documentation.

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Backend framework | NestJS 10 | DI, modules, pipes, guards, schedule, websockets — covers our entire surface |
| ORM | Prisma 5 | Type-safe queries, migration story, multi-relation joins for reports |
| Database | PostgreSQL 14+ | JSONB for question snapshots, transactions, row-level locking |
| Auth | `@nestjs/jwt` + bcrypt + speakeasy (TOTP) | No external IdP dependency |
| Real-time | socket.io + custom WebRTC | One transport for both signalling and app events |
| Queue | `@nestjs/bull` (Redis) + in-memory fallback | Reminders survive deploys when Redis is up |
| Scheduling | `@nestjs/schedule` | Cron sweeps for expired exams, recording purge |
| AI | `@google/generative-ai` (Gemini Flash) | Narrative + behaviour analysis |
| Frontend framework | Next.js (App Router) | Server components, route segmentation |
| State / Data | `@tanstack/react-query` v5 | Cache + invalidation for proctor dashboards |
| Styling | CSS-in-style props + Tailwind v4 | Minimal class soup, easy theming |
| Media | LiveKit-style P2P (own WebRTC implementation) | Hosted-server cost avoided; TURN-fallback for VPS |

## 3. Backend Module Layout

```
backend/src/
├── main.ts                          bootstrap, CORS, helmet, body-parser, JWT-secret enforcement
├── app.module.ts                    root composition
├── prisma/                          PrismaService (DI wrapper)
├── common/
│   ├── filters/                     AllExceptionsFilter (strips stack in prod)
│   ├── guards/                      JwtAuthGuard, RolesGuard
│   └── decorators/                  @Roles
└── modules/
    ├── auth/                        login, MFA, OTP, magic-link, refresh
    ├── users/                       CRUD, invitations
    ├── organizations/               CRUD, settings, branding
    ├── candidates/                  CRUD, bulk-import, GDPR delete
    ├── assessments/                 AssessmentType CRUD + archive
    ├── questions/                   MCQ pool, per-candidate assignment shuffle
    ├── practical-tasks/             legacy practical task library
    ├── practical-sets/              multi-task paper sets + auto-random-assign
    ├── scheduling/                  slot generation, auto-merge, reschedule
    ├── sessions/                    ExamSession lifecycle (begin, complete, terminate)
    ├── exam-delivery/               candidate-facing exam flow, timer, auto-submit
    ├── checklist/                   ProctorChecklist per-candidate
    ├── proctoring/                  events, flags
    ├── mediapipe/                   server-side face detection + auto-capture
    ├── facial-recognition/          embedding compare, FR log writes
    ├── recordings/                  chunk receive, merge, finalize, signed URL
    ├── reports/                     AI narrative, status workflow, PDF
    ├── notifications/               email + portal notifications + reschedule notice
    ├── admin/                       platform settings, audit log
    ├── interviews/                  interview-room shell (feature-flag gated)
    ├── jitsi/                       legacy token endpoints (renamed to LiveKit)
    ├── gateway/                     socket.io app gateway (signalling + app events)
    ├── ai-transcription/            audio chunk → text via Gemini
    ├── ai-monitor/                  behaviour score aggregator
    ├── redis/                       Redis client with in-memory fallback
    └── storage/                     file paths + uploads helpers
```

## 4. Frontend Layout

```
frontend/portal/
├── app/
│   ├── (portal)/                    authenticated pages
│   │   ├── admin/                   companies, users, assessments, reports, settings, audit
│   │   ├── master-proctor/          questions, exams, sessions, settings
│   │   ├── proctor/                 today, session, reports/[id], settings
│   │   ├── hr/                      candidates, assessments, performers, reports, settings
│   │   ├── exam-setup/              questions, practical, settings
│   │   └── sales/                   leads
│   ├── exam/                        candidate-facing exam page (magic-link entry)
│   ├── tech-check/                  pre-exam camera/network test (with i18n)
│   ├── login/                       password + MFA
│   └── accept-invitation/
├── components/
│   ├── proctor/                     VerificationLayout, PostVerificationLayout, ChecklistPanel,
│   │                                MonitorGrid, AIMonitoringPanel, CaptureGallery,
│   │                                FlagQueue, PracticalPanel
│   └── candidate/                   CandidateVerificationLayout, MCQPanel, PracticalPanel
├── lib/
│   ├── api.ts                       axios + per-feature API surface
│   ├── useJitsi.ts                  WebRTC peer hook (named useLivekit in usage)
│   ├── useWebSocket.ts              socket.io connection per session
│   ├── useMediaPipe.ts              client-side ML
│   ├── useSessionRecorder.ts        chunk uploader
│   ├── usePeriodicFRCheck.ts        every-N-min FR capture
│   ├── useFaceDetection.ts          multiple-face / face-absent detection
│   ├── useSpeechTranscription.ts    Web Speech interim caption
│   └── useAudioTranscriber.ts       audio chunk → Gemini caption
└── store/
    └── auth.store.ts                Zustand auth state
```

## 5. Data Model (key entities)

```
Organization 1───<  User
             1───<  CandidateRecord
             1───<  ExamSession
             1───<  AssessmentType
             1───<  PracticalTask  /  PracticalPaperSet

ExamSession ───< SessionCandidate ────  CandidateRecord
            ───< ExamAnswer (per candidate, per question)
            ───< SessionEvent (proctor / system / candidate events)
            ───< FacialRecognitionLog
            ───< ProctorChecklist (one per candidate)
            ───< Report (one per candidate)
            ───< SessionQuestionAssignment (shuffled order, per candidate)

User (PROCTOR) ──< ProctorAvailability
User           ──< AuditLog (chain-hashed)
```

After the unification migration, **every ExamSession has `isMultiCandidate = true`** and at least one `SessionCandidate` row representing the primary candidate. There's only one flow in the application.

### Key fields

`ExamSession`:
- `status`: SCHEDULED → CHECKLIST → MCQ_IN_PROGRESS → MCQ_COMPLETE → PRACTICAL_IN_PROGRESS → SUBMITTED → GRADING → PENDING_PROCTOR_REVIEW → REPORT_PUBLISHED (plus DISQUALIFIED, NO_SHOW, CANCELLED terminal)
- `mcqStartedAt`, `practicalStartedAt`, `submittedAt`
- `magicToken` — opaque 32-byte hex, used by candidate's URL
- `tokenExpiresAt` — scheduledAt + 15min
- `isMultiCandidate` — vestigial post-unification, always true

`SessionCandidate`:
- `status`: PENDING → JOINED → VERIFYING → VERIFIED → MCQ_IN_PROGRESS → MCQ_SUBMITTED → PRACTICAL_IN_PROGRESS → PRACTICAL_SUBMITTED → COMPLETED (or DISQUALIFIED)
- `verifiedAt`, `mcqSubmittedAt`, `practicalSubmittedAt`
- `practicalPaperSetId` — per-candidate practical assignment
- `screenRecordingPath`, `webcamRecordingPath`

`Report.status`: DRAFT → PENDING_REVIEW → RETURNED → PUBLISHED

`AuditLog.chainHash`: SHA-256 of `{ ...row, prevHash }`, written inside a Serializable transaction so concurrent writers cannot fork the chain.

## 6. API Surface (summary)

All routes prefixed with `/api`. JWT required unless marked PUBLIC.

| Module | Method | Path | Notes |
|---|---|---|---|
| auth | POST | `/auth/login` | PUBLIC; returns access+refresh JWT |
| auth | POST | `/auth/mfa/verify` | PUBLIC second step |
| auth | POST | `/auth/refresh` | PUBLIC |
| auth | POST | `/auth/magic-link/verify` | PUBLIC, candidate side |
| auth | POST | `/auth/otp/send` | PUBLIC, per-email rate-limited |
| auth | POST | `/auth/otp/verify` | PUBLIC |
| candidates | GET/POST/PUT/DELETE | `/candidates[/:id]` | Org-scoped |
| candidates | POST | `/candidates/:id/gdpr-delete` | SUPER_ADMIN only, audit-logged |
| scheduling | GET | `/scheduling/slots` | Available proctor slots |
| scheduling | POST | `/scheduling/sessions` | Schedule; auto-merge window |
| scheduling | POST | `/scheduling/sessions/:id/reschedule` | Sends reschedule notice |
| sessions | POST | `/sessions/:id/begin` | Proctor: startMcq |
| sessions | GET | `/sessions/:id/candidates` | List SessionCandidate |
| sessions | POST | `/sessions/:id/pause`, `/resume`, `/terminate` | Proctor controls |
| exam | GET | `/exam/session?token=...` | Candidate session info |
| exam | GET | `/exam/question/current?token=...&candidateId=...` | Per-candidate question |
| exam | POST | `/exam/question/submit` | Submit one answer |
| exam | GET | `/exam/timer?token=...` | Server-authoritative countdown |
| exam | POST | `/exam/timer/expired` | Client-fired auto-submit trigger |
| exam | GET | `/exam/practical/task?token=...` | Current practical |
| exam | POST | `/exam/practical/submit` | Multipart upload |
| checklist | POST | `/checklist/:sessionId/init` | Per candidate |
| checklist | POST | `/checklist/:sessionId/items/:key/complete` | Per item |
| checklist | GET | `/checklist/by-token` | Candidate-facing read |
| facial-recognition | POST | `/facial-recognition/sessions/:id/candidate-periodic` | Periodic check |
| mediapipe | POST | `/mediapipe/capture/id-verification/:id` | Government-ID capture |
| recordings | POST | `/recordings/sessions/:id/chunks` | Chunk upload |
| reports | POST | `/reports/session/:id/generate` | Draft generation |
| reports | POST | `/reports/session/:id/publish` | Status → PUBLISHED |
| reports | GET | `/reports` | Role-aware: HR sees PUBLISHED, proctor sees their queue |
| practical-sets | POST | `/practical-sets/sessions/:id/assign` | Manual override |
| admin | GET/POST | `/admin/settings`, `/admin/audit-log` | SUPER_ADMIN |

## 7. WebRTC Architecture

- One peer connection per (proctor, candidate) pair
- Glare-free: **only the CANDIDATE initiates the offer**; the proctor always answers via `handleOffer`. Without this rule, both sides started offers simultaneously and `setRemoteDescription` threw on the loser, leaving one direction blind.
- Identity convention: `candidate-${candidateId}` and `proctor-${proctorSocketId}`. The proctor's hook caches `socketId → candidateId` from `peer.joined` events so its `RTCPeerConnection`s are keyed correctly when the candidate's offer arrives.
- 1-to-1 routing during checklist phase: proctor's local video + audio tracks are cloned per peer; only the active candidate's clones are `.enabled = true`. Others see frozen video + silence.
- ICE servers: Google STUN + optional TURN (UDP/TCP/TLS) via `NEXT_PUBLIC_TURN_SECRET`.

## 8. WebSocket Events (selected)

Server-emitted:
- `peer.joined` — broadcast on `peer.announce`, also looped back to the announcer for existing peers
- `candidate.joined` — convenience event with socketId + candidateId
- `candidate.progress` — per-question progress for proctor dashboard
- `exam.mcqSubmitted` — when a candidate finishes
- `exam.mcqAutoSubmitted`, `exam.practicalAutoSubmitted` — timer-driven
- `ai.flag` — behaviour anomaly
- `checklist.itemUpdated` — proctor moved one item; carries candidateId so candidates filter
- `report.published` — to HR org room
- `session.phase` — phase transitions

Client-emitted:
- `peer.announce` — on connection, with role + candidateId
- `webrtc.offer / .answer / .ice` — relayed by gateway
- `proctor.enterVerification / .leaveVerification` — for 1-to-1 routing
- `exam.pushMCQ / .pushPractical`
- `candidate.disqualified`

## 9. Cron Jobs

| Schedule | Job | Purpose |
|---|---|---|
| `* * * * *` | `sweepExpiredExams` | Auto-submit MCQ/practical when timer ran out (catches closed-tab cases) |
| `0 */2 * * *` | `finalizeOrphanRecordings` | Merge chunks for sessions whose process died mid-finalize |
| `0 3 * * *` | `purgeExpiredRecordings` | Honour per-org retention setting |
| (Bull queue) | `reminder-email` | 24h and 1h-before reminders |

## 10. Security Model

- **Boot-time JWT secret check** — process exits if `JWT_SECRET` or `JWT_REFRESH_SECRET` is missing or <32 chars
- **CORS** — driven by `FRONTEND_URLS` (comma-separated); production refuses to start without it
- **Helmet CSP** — `defaultSrc 'self'`, `objectSrc 'none'`, `frameAncestors 'none'`, HSTS on
- **Throttler** — auth profile 10/min/IP, OTP issuance 3/email/5min
- **Audit log** — Serializable transaction prevents chain-hash forks
- **DOMPurify** — sanitises admin-authored Terms/Privacy HTML rendered on the candidate OTP screen
- **File upload blocklist** — practical answer rejects `.svg, .html, .htm, .xhtml, .xml, .js, .mjs`
- **Tenant isolation** — every list endpoint filters by `organizationId`; cross-org reads return 404
- **GDPR delete** — SUPER_ADMIN only, ≥10-char reason required, audit row written before cascade
- **Production error masking** — stack + native error messages stripped from API responses
- **Per-email rate limit** — OTP issuance capped at 3 per 5 minutes per email address
- **Body-parser limit** — 10 MB on both `json` and `urlencoded` (large enough for base64 webcam frames)

## 11. Deployment

**Single VPS (Ubuntu)** running:
- Apache 2.4 with `mod_proxy` and Let's Encrypt
- PM2 supervising backend (4-instance cluster) and frontend (1 instance)
- PostgreSQL 14 on the same box
- Redis 7 on the same box (optional but recommended)
- coturn for TURN
- Local disk under `STORAGE_PATH` for recordings, captures, practical uploads

Migrations run via `npx prisma migrate deploy` on each release.

Daily `pg_dump` cron writes to `/var/backups/assessexpert/`.

## 12. Environment Variables (required)

```
DATABASE_URL                postgresql connection (with ?connection_limit=20)
JWT_SECRET                  ≥32 chars
JWT_REFRESH_SECRET          ≥32 chars, different from JWT_SECRET
FRONTEND_URL                primary public origin
FRONTEND_URLS               comma-separated CORS allowlist (preferred)
SMTP_HOST/PORT/USER/PASS    email transport
SMTP_FROM                   sender
GEMINI_API_KEY              for AI narrative
GEMINI_MODEL                e.g. gemini-1.5-flash
REDIS_URL                   optional; in-memory fallback if unset
NEXT_PUBLIC_API_URL         frontend → backend base
NEXT_PUBLIC_WS_URL          socket.io base
NEXT_PUBLIC_TURN_SECRET     coturn shared secret, optional
STORAGE_PATH                e.g. ./storage
RECORDINGS_PATH             defaults to STORAGE_PATH/recordings
NODE_ENV                    development | production
```

## 13. Migrations (chronological)

```
20260510102617_add_multi_candidate_support
20260511222441_add_practical_paper_sets
20260516120000_add_verification_transcript
20260518120000_add_candidate_reference_photo
20260518150000_per_candidate_mcq
20260518180000_per_candidate_checklist_report
20260519080000_session_candidate_recording_paths
20260519100000_per_candidate_practical
20260519120000_fr_log_candidate_id
20260520120000_unify_to_multi_candidate     ← backfills SessionCandidate for every existing session
20260520140000_org_timezone                 ← Organization.timezone column
```

Run `npx prisma migrate deploy` on each release.

## 14. Logging & Observability

- NestJS `Logger` (`pino`-style structured output via stdout)
- pm2 captures logs to `~/.pm2/logs/`
- Email failures recorded in-memory (`/admin/email-health`)
- Sentry is **not** wired (planned)

## 15. Testing

- Static: `npx tsc --noEmit` runs clean on both backend and frontend
- Integration tests are **not** in the current scope (planned)
- Manual smoke test: schedule a single-candidate session, run full flow end-to-end before each release
