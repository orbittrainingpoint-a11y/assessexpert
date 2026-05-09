@echo off
echo ========================================
echo AssessExpert Backend - Quick Diagnostics
echo ========================================
echo.

cd /d "%~dp0"

echo Step 1: Checking Node.js and npm...
node --version
npm --version
echo.

echo Step 2: Installing dependencies (if needed)...
call npm install
echo.

echo Step 3: Running diagnostics...
echo ----------------------------------------
call npm run diagnostics
echo.

echo Step 4: Testing SMTP configuration...
echo ----------------------------------------
call npm run test:smtp
echo.

echo ========================================
echo Diagnostics Complete!
echo ========================================
echo.
echo Next Steps:
echo 1. Review the output above
echo 2. Fix any configuration issues in .env file
echo 3. Run: npm run start:dev
echo 4. Test add candidate in HR portal
echo.
echo For detailed help, see:
echo - QUICK_FIX.md
echo - TROUBLESHOOTING.md
echo.
pause
