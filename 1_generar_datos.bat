@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python no esta instalado o no esta en el PATH.
    echo Instale Python 3.10 o superior desde https://www.python.org/downloads/
    pause
    exit /b 1
)
python datos\generar_datos.py %*
echo.
pause
