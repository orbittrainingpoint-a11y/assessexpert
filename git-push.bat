@echo off
cd /d "%~dp0"

:: Check if git repo exists
if not exist ".git" (
  echo Initialising git repository...
  git init
  git branch -M main
)

:: Stage all changes
git add -A

:: Commit with message from argument or default
if "%~1"=="" (
  set MSG=update
) else (
  set MSG=%~1
)

git commit -m "%MSG%"

:: Push — set upstream on first push if needed
git push 2>nul
if errorlevel 1 (
  echo Setting upstream to origin/main...
  git push --set-upstream origin main
)

echo.
echo Done.
pause
