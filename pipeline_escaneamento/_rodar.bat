@echo off
rem Uso interno: _rodar.bat <argumentos do pipeline>. Escolhe o Python certo e roda.
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONPATH=%~dp0src
set PYTHONIOENCODING=utf-8
if not exist "%~dp0.venv\Scripts\python.exe" (
  echo O programa ainda nao foi instalado. De duplo clique em INSTALAR.bat primeiro.
  exit /b 9
)
"%~dp0.venv\Scripts\python.exe" -m pipeline %*
exit /b %ERRORLEVEL%
