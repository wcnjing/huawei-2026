@echo off
REM ============================================================
REM  Runs the SafeSpace Drill Bot and auto-restarts it if it
REM  ever stops. Keep this running to keep the bot alive.
REM ============================================================
cd /d "%~dp0"

:loop
echo [%date% %time%] Starting Drill Bot...
python drill_bot.py
echo [%date% %time%] Bot stopped. Restarting in 5 seconds... (close this window to stop for good)
timeout /t 5 /nobreak >nul
goto loop
