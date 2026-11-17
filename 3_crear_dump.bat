@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python no esta instalado o no esta en el PATH.
    pause
    exit /b 1
)
python datos\crear_dump.py %*
echo.
pause
