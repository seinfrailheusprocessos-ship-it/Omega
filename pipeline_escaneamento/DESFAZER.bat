@echo off
chcp 65001 >nul
title Desfazer ultima execucao - SEINFRA
cd /d "%~dp0"
echo.
echo ATENCAO: isto APAGA os arquivos que a ULTIMA execucao do PROCESSAR criou
echo (os escaneados originais nao sao tocados).
echo.
set /p OK=Digite SIM e aperte Enter para desfazer: 
if /I not "%OK%"=="SIM" (echo Cancelado. Nada foi alterado. & pause & exit /b 0)
call "%~dp0_rodar.bat" --desfazer
echo.
pause
