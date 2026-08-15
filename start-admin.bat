@echo off
:: Check if server is already running on port 3000
netstat -ano | findstr ":3000 " >nul 2>&1
if %errorlevel% == 0 (
    echo Server already running on port 3000.
) else (
    echo Starting portfolio server...
    start "" /b node "%~dp0server.js"
    timeout /t 2 /nobreak >nul
)
start "" "http://localhost:3000/admin"
