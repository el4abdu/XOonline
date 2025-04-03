# XO.GAME GitHub Auto-Update Instructions

This file contains instructions on how to automatically update your GitHub repository.
To use the updater, copy the following script to a file named "update_github.bat" on your local machine (not in the Firebase hosting directory):

---------- COPY BELOW THIS LINE ----------

@echo off
echo ======================================
echo XO.GAME GITHUB AUTOMATIC UPDATER
echo ======================================
echo.

REM Change to the project directory (if needed)
cd /d "%~dp0"

REM Set GitHub credentials
set GITHUB_EMAIL=mmmorad123@gmail.com
set GITHUB_USERNAME=el4abdu
set GITHUB_REPO=https://github.com/el4abdu/XO.GAME.git

REM Check if git is installed
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Git is not installed. Please install Git first.
    echo You can download it from https://git-scm.com/downloads
    pause
    exit /b 1
)

REM Check if repository is already initialized
if not exist ".git" (
    echo Initializing Git repository...
    git init
    git remote add origin %GITHUB_REPO%
    echo Git repository initialized.
) else (
    echo Git repository already initialized.
)

REM Configure Git user
git config user.email "%GITHUB_EMAIL%"
git config user.name "%GITHUB_USERNAME%"

REM Fetch latest changes from remote
echo Fetching latest changes from GitHub...
git fetch origin

REM Check if there are changes to pull
git diff --quiet origin/main
if %ERRORLEVEL% NEQ 0 (
    echo Updates available. Pulling latest changes...
    git pull origin main
    echo Updates completed.
) else (
    echo Already up to date.
)

REM Create a .gitignore file if it doesn't exist
if not exist ".gitignore" (
    echo Creating .gitignore file...
    echo update_github.bat > .gitignore
    echo Adding update_github.bat to .gitignore...
)

REM Check if update_github.bat is already in .gitignore
findstr /c:"update_github.bat" .gitignore >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo update_github.bat >> .gitignore
    echo Added update_github.bat to .gitignore.
)

REM Add all files except those in .gitignore
echo.
echo Adding changed files to staging area...
git add .

REM Check if there are changes to commit
git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    REM Get current date and time for commit message
    for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /format:list') do set datetime=%%I
    set year=%datetime:~0,4%
    set month=%datetime:~4,2%
    set day=%datetime:~6,2%
    set hour=%datetime:~8,2%
    set minute=%datetime:~10,2%
    
    echo.
    echo Committing changes...
    set /p commit_msg="Enter commit message (leave empty for auto-generated): "
    
    if "%commit_msg%"=="" (
        set commit_msg=Auto update on %year%-%month%-%day% at %hour%:%minute%
    )
    
    git commit -m "%commit_msg%"
    
    echo.
    echo Pushing changes to GitHub...
    git push origin main
    
    echo.
    echo ======================================
    echo Changes successfully pushed to GitHub!
    echo ======================================
) else (
    echo.
    echo No changes to commit.
)

echo.
echo Update process completed.
pause

---------- COPY ABOVE THIS LINE ----------

## Instructions for use:

1. Create a file named "update_github.bat" on your local computer (outside the web hosting directory)
2. Copy the script above into that file
3. Double-click the file to run it when you want to update your GitHub repository
4. The script will:
   - Check if Git is installed
   - Initialize a Git repository if needed
   - Add all changed files (except itself)
   - Commit changes with a timestamped message (or custom message)
   - Push changes to GitHub

## Important Notes:

- This file is a text instruction file, not the actual executable script
- The actual .bat file should be created locally, not in your Firebase hosting directory
- The script automatically excludes itself from uploads using .gitignore
- You'll need Git installed on your local machine for this to work 