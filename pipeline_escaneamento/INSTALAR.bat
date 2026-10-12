@echo off
chcp 65001 >nul
title Instalador - Pipeline de Escaneamento SEINFRA
cd /d "%~dp0"
echo.
echo ============================================================
echo   INSTALADOR - PIPELINE DE ESCANEAMENTO DA SEINFRA
echo ============================================================
echo.
echo Este instalador baixa e prepara tudo sozinho. Pode levar alguns
echo minutos e precisa de internet SOMENTE agora.
echo Se o Windows perguntar "Deseja permitir que este aplicativo...", clique em SIM.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1"
set ERRO=%ERRORLEVEL%
echo.
if "%ERRO%"=="0" (
  echo ===== INSTALACAO CONCLUIDA COM SUCESSO =====
  echo Agora e so dar duplo clique em PROCESSAR.bat quando houver escaneados novos.
) else (
  echo ===== A INSTALACAO TEVE PROBLEMA =====
  echo Abra o arquivo  instalacao_log.txt  desta pasta e me envie o conteudo.
)
echo.
pause
exit /b %ERRO%
