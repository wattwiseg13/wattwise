@echo off
REM ============================================================
REM  WattWise Arduino bridge launcher
REM
REM  Double-click this after `docker compose up`. It:
REM    1. frees the live feed (stops the Docker simulator),
REM    2. installs the Python deps the bridge needs,
REM    3. runs the bridge, which AUTO-DETECTS the Arduino COM port.
REM
REM  No COM number to edit. If auto-detect ever picks wrong, force it:
REM    run-bridge.bat COM5
REM ============================================================

setlocal
cd /d "%~dp0"

REM Point the bridge at the backend through the single public proxy port.
if "%APP_PORT%"=="" set APP_PORT=8080
set API_BASE=http://localhost:%APP_PORT%/api
set ENABLE_LOCAL_WS=false

REM Port: auto by default; first argument overrides (e.g. run-bridge.bat COM5).
if "%~1"=="" (
    set SERIAL_PORT=auto
) else (
    set SERIAL_PORT=%~1
)

echo.
echo === WattWise bridge ===
echo   Backend : %API_BASE%
echo   Port    : %SERIAL_PORT%
echo.

REM Pick a Python launcher (py preferred on Windows, fall back to python).
where py >nul 2>nul
if %errorlevel%==0 (
    set PY=py
) else (
    set PY=python
)

REM Free the live feed so the real board's data isn't fighting the simulator.
echo Stopping the Docker simulator (so the Arduino owns the live feed)...
docker compose stop simulator >nul 2>nul

echo Installing/refreshing bridge dependencies...
%PY% -m pip install -q -r bridge\requirements.txt

echo.
echo Starting bridge. Press Ctrl+C to stop, or 'o' to switch off on an alert.
echo.
%PY% -m bridge.main

echo.
echo Bridge stopped. Restart the simulator with:  docker compose start simulator
pause
endlocal
