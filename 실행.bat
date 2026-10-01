@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 22.13 이상을 먼저 설치하세요: https://nodejs.org & pause & exit /b)
start "" http://localhost:3000
node server.js
pause
