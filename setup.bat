@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend\portal"

echo ============================================
echo  assessexpert Platform Setup Script
echo ============================================
echo.
echo Root: %ROOT%
echo Backend: %BACKEND%
echo Frontend: %FRONTEND%
echo.

echo [1/6] Checking PostgreSQL...
psql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: PostgreSQL not found. Please install PostgreSQL 15+ and add to PATH.
    echo Download: https://www.postgresql.org/download/windows/
    pause
    exit /b 1
)
echo PostgreSQL found.

echo.
echo [2/6] Creating database and user...
psql -U postgres -c "CREATE USER assessexpert_app WITH PASSWORD 'assessexpert_pass' CREATEDB;" 2>nul
psql -U postgres -c "DROP DATABASE IF EXISTS assessexpert;" 2>nul
psql -U postgres -c "CREATE DATABASE assessexpert OWNER assessexpert_app;" 2>nul
psql -U postgres -d assessexpert -c "GRANT ALL ON SCHEMA public TO assessexpert_app;" 2>nul
echo Database ready.

echo.
echo [3/6] Installing backend dependencies...
if not exist "%BACKEND%\package.json" (
    echo ERROR: Backend package.json not found at %BACKEND%
    pause
    exit /b 1
)
pushd "%BACKEND%"
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed in backend.
    popd
    pause
    exit /b 1
)
popd
echo Backend dependencies installed.

echo.
echo [4/6] Running Prisma migrations and seed...
pushd "%BACKEND%"
call npx prisma generate
if %errorlevel% neq 0 ( echo ERROR: prisma generate failed. & popd & pause & exit /b 1 )

call npx prisma db push
if %errorlevel% neq 0 ( echo ERROR: prisma db push failed. & popd & pause & exit /b 1 )

call npx ts-node --project tsconfig.json prisma/seed.ts
if %errorlevel% neq 0 ( echo WARNING: Seed may have partially failed. Check output above. )
popd

echo.
echo [5/6] Installing frontend dependencies...
if not exist "%FRONTEND%\package.json" (
    echo ERROR: Frontend package.json not found at %FRONTEND%
    pause
    exit /b 1
)
pushd "%FRONTEND%"
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed in frontend.
    popd
    pause
    exit /b 1
)
popd
echo Frontend dependencies installed.

echo.
echo [6/6] Setup complete!
echo.
echo ============================================
echo  Default Login Credentials:
echo ============================================
echo  Super Admin:    admin@assessexpert.ae
echo  Password:       Admin@assessexpert2026!
echo.
echo  Master Proctor: masterproctor@assessexpert.ae
echo  Password:       MasterProctor@2026!
echo.
echo  Proctor:        proctor@assessexpert.ae
echo  Password:       Proctor@2026!
echo.
echo  HR Manager:     hr@democompany.ae
echo  Password:       HRManager@2026!
echo ============================================
echo.
echo To start the application, run: start-dev.bat
endlocal
pause
