@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python no esta instalado o no esta en el PATH.
    pause
    exit /b 1
)
echo Iniciando carga masiva de 36.000.000 de registros (6M por tabla)...
echo Los indices de consulta se dejan para despues (--sin-indices).
echo.
python datos\cargar_datos.py --sin-indices %*
echo.
pause
