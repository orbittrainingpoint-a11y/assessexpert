# assessexpert — B2B SaaS Pre-Employment Assessment Platform

> Version 1.0 | Built per Master Platform Specification v6.0
> Hostinger VPS (Ubuntu 22.04 LTS) | Local PostgreSQL | Prisma ORM

---

## Architecture

```
assessexpert/
├── backend/          NestJS API (port 4000)
│   ├── src/
│   │   ├── modules/  All feature modules
│   │   └── prisma/   Prisma service
│   └── prisma/
│       ├── schema.prisma   Full database schema
│       └── seed.ts         Initial data seed
└── frontend/
    └── portal/       Next.js 14 App Router (port 3000)
        ├── app/
        │   ├── login/          Login page
        │   ├── exam/           Candidate exam environment
        │   └── (portal)/       All authenticated dashboards
        │       ├── admin/      Super Admin
        │       ├── master-proctor/
        │       ├── proctor/
        │       ├── exam-setup/
        │       ├── hr/         HR Manager
        │       └── sales/
        ├── components/
        └── lib/api.ts          All API calls
```

---

## Prerequisites

- **Node.js 20 LTS** — https://nodejs.org
- **PostgreSQL 15+** — https://www.postgresql.org/download/windows/
- **Redis 7** (optional for production queues) — https://redis.io

---

## Quick Start (Windows)

### 1. Run Setup (first time only)
```
Double-click: setup.bat
```
This will:
- Create the PostgreSQL database
- Install all npm dependencies
- Run Prisma migrations
- Seed initial data (users, assessment types, sample questions)

### 2. Start Development
```
Double-click: start-dev.bat
```

### 3. Access the Platform
| URL | Description |
|-----|-------------|
| http://localhost:3000 | Portal (all dashboards) |
| http://localhost:4000/api/docs | Swagger API documentation |
| http://localhost:4000/api/health | Health check |

---

## Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@assessexpert.ae | Admin@assessexpert2026! |
| Master Proctor | masterproctor@assessexpert.ae | MasterProctor@2026! |
| Exam Setup Master | examsetup@assessexpert.ae | ExamSetup@2026! |
| Proctor | proctor@assessexpert.ae | Proctor@2026! |
| Sales Agent | sales@assessexpert.ae | Sales@2026! |
| HR Manager | hr@democompany.ae | HRManager@2026! |

---

## Manual Setup (if setup.bat fails)

### Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
npm run start:dev
```

### Frontend
```bash
cd frontend/portal
npm install
npm run dev
```

---

## Environment Configuration

### Backend (.env)
Key variables to configure:
- `DATABASE_URL` — PostgreSQL connection string (local)
- `JWT_SECRET` — Change in production
- `OPENAI_API_KEY` — For AI report generation
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — For facial recognition (AWS Rekognition)
- `SMTP_*` — Email configuration

### Frontend (.env.local)
- `NEXT_PUBLIC_API_URL` — Backend API URL

---

## Key Features Implemented

### Exam Engine
- ✅ Fisher-Yates shuffle — 25 questions drawn from 500-question pool, server-side only
- ✅ One-question-at-a-time delivery — no bulk download, no client-side question set
- ✅ Server-side timer — client re-syncs every 30 seconds
- ✅ Auto-submit on timer expiry
- ✅ Full answer snapshot — question text + options captured at exam time (immutable)

### Proctor Checklist
- ✅ 10-item checklist with server-side enforcement
- ✅ "Begin Assessment" blocked until all required items complete (HTTP 403 if bypassed)
- ✅ Facial recognition integration (AWS Rekognition)

### Reports
- ✅ Full MCQ question-by-question breakdown in every report
- ✅ AI narrative generation (OpenAI GPT-4o)
- ✅ Proctor review → publish workflow (HR cannot see until published)
- ✅ Report versioning on re-publish

### Security
- ✅ Multi-tenant isolation via Prisma middleware (organizationId scoping)
- ✅ JWT RS256 with refresh token rotation
- ✅ TOTP MFA (mandatory for Admin, Master Proctor, Proctor, Exam Setup Master)
- ✅ Magic link + OTP for candidates
- ✅ Role-based guards on all endpoints
- ✅ Clipboard blocking during exam
- ✅ Tab-switch detection and logging

### Recordings
- ✅ Chunked WebM upload
- ✅ 7-day retention with daily cron purge (3 AM)
- ✅ Signed URL playback (2-hour expiry)

### Notifications
- ✅ Email (Nodemailer/SMTP)
- ✅ In-portal notifications (database-backed)
- ✅ Candidate invitation email template
- ✅ Report published notification

---

## Database Schema

Full Prisma schema at `backend/prisma/schema.prisma`

Key models:
- `Organization` — Multi-tenant companies
- `User` — All roles (SUPER_ADMIN through PROCTOR)
- `AssessmentType` — Exam catalogue
- `Question` — 500-question pool per assessment type
- `ExamSession` — Full session lifecycle
- `SessionQuestionAssignment` — Fisher-Yates shuffled question set per session
- `ExamAnswer` — Per-question answers with immutable snapshots
- `ProctorChecklist` — 10-item verification record
- `Report` — AI draft → proctor review → published
- `AuditLog` — SHA-256 chained, append-only

---

## API Reference

Full Swagger docs at: http://localhost:4000/api/docs

Key endpoint groups:
- `POST /api/auth/login` — Login
- `GET /api/exam/question/current?token=` — Get current MCQ question (candidate)
- `POST /api/exam/question/submit?token=` — Submit answer (candidate)
- `POST /api/checklist/:sessionId/items/:key/complete` — Complete checklist item
- `POST /api/sessions/:id/begin` — Start exam (requires complete checklist)
- `POST /api/reports/session/:sessionId/publish` — Publish report to HR

---

## Production Deployment (Hostinger VPS)

1. Install Node.js 20, PostgreSQL 15, Redis 7, Nginx, PM2
2. Clone repo to `/var/assessexpert/app/`
3. Configure `.env.production` with real credentials
4. Run `npx prisma migrate deploy`
5. Build: `npm run build` in both backend and frontend
6. Start with PM2: `pm2 start ecosystem.config.js`
7. Configure Nginx (see `assessexpert_Master_Platform_Specification.md` Section 32.4)
8. SSL: `certbot --nginx -d app.assessexpert.ae`

---

*assessexpert | Powered by Orbit Training · Dubai, UAE*
*"Every result verified. Every hire protected."*
