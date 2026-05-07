@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend\portal"

cls
echo.
echo  ============================================================
echo   assessexpert ^| Pre-Employment Assessment Platform
echo   Powered by Orbit Training ^| Dubai, UAE
echo  ============================================================
echo.

REM ── Reset demo session ──────────────────────────────────────────
echo [1/4] Resetting demo session (Ahmed Al-Rashidi)...
cd /d "%BACKEND%"
call npx ts-node prisma/seed-ahmed.ts >nul 2>&1
if %errorlevel% equ 0 (
    echo       Demo session reset OK
) else (
    echo       Demo session reset skipped ^(DB may not be running^)
)
echo.

REM ── Start Backend ────────────────────────────────────────────────
echo [2/4] Starting Backend API on port 4000...
start "assessexpert Backend" cmd /k "title assessexpert Backend ^| Port 4000 && cd /d "%BACKEND%" && npm run start:dev"
echo       Backend window opened
echo.

REM ── Wait for backend to boot ─────────────────────────────────────
echo [3/4] Waiting for backend to boot (8 seconds)...
timeout /t 8 /nobreak >nul
echo       Done
echo.

REM ── Start Frontend ───────────────────────────────────────────────
echo [4/4] Starting Frontend Portal on port 3000...
start "assessexpert Frontend" cmd /k "title assessexpert Frontend ^| Port 3000 && cd /d "%FRONTEND%" && npm run dev"
echo       Frontend window opened
echo.

REM ── Summary ──────────────────────────────────────────────────────
echo  ============================================================
echo   ASSESSEXPERT IS STARTING UP
echo  ============================================================
echo.
echo   URLS
echo   ----
echo   Portal Login    :  http://localhost:3000
echo   Backend API     :  http://localhost:4000/api
echo   Swagger Docs    :  http://localhost:4000/api/docs
echo   Prisma Studio   :  npx prisma studio  (port 5555)
echo.
echo   DEMO CREDENTIALS
echo   ----------------
echo   Super Admin     :  admin@assessexpert.ae
echo                      Admin@assessexpert2026!
echo.
echo   Master Proctor  :  masterproctor@assessexpert.ae
echo                      MasterProctor@2026!
echo.
echo   Exam Setup      :  examsetup@assessexpert.ae
echo                      ExamSetup@2026!
echo.
echo   Proctor         :  proctor@assessexpert.ae
echo                      Proctor@2026!
echo.
echo   Sales Agent     :  sales@assessexpert.ae
echo                      Sales@2026!
echo.
echo   HR Manager      :  hr@democompany.ae
echo                      HRManager@2026!
echo.
echo   CANDIDATE DEMO (magic link - no password)
echo   -----------------------------------------
echo   Name   :  Ahmed Al-Rashidi
echo   Email  :  ahmed.alrashidi@example.com
echo   Link   :  http://localhost:3000/exam?token=DEMO-AHMED-2026-ACAD-L1-TOKEN
echo   OTP    :  Use bypass code 000000 (dev mode)
echo.
echo   HOW TO RUN DEMO
echo   ---------------
echo   1. Login as Proctor at http://localhost:3000
echo   2. Go to Today's Assessments
echo   3. Click "Open Candidate Tab" to open exam in new tab
echo   4. In candidate tab: enter email, click 000000, verify
echo   5. Back in proctor tab: red notification appears, click Join Now
echo   6. Complete checklist, Begin MCQ
echo.
echo  ============================================================
echo   Wait ~15 seconds for full startup, then open the portal.
echo  ============================================================
echo.

endlocal
pause
