@echo off
chcp 65001 >nul
title Processar escaneados - SEINFRA
cd /d "%~dp0"
echo.
echo ============================================================
echo   PROCESSANDO OS ESCANEADOS NOVOS
echo   (acompanhe em C:\CL\6_Pipeline\_CATALOGO\progresso.txt)
echo ============================================================
echo.
call "%~dp0_rodar.bat" %*
set ERRO=%ERRORLEVEL%
echo.
if "%ERRO%"=="0" (echo Terminou. Abra o CATALOGO.xlsx na pasta _CATALOGO.) else (echo Terminou com aviso/erro. Veja a mensagem acima e a pasta _CATALOGO\logs.)
echo.
if /I not "%1"=="--silencioso" pause
exit /b %ERRO%
