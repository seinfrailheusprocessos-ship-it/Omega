@echo off
chcp 65001 >nul
title Vigiando a pasta de entrada - SEINFRA
cd /d "%~dp0"
echo.
echo Deixe esta janela aberta. Quando chegarem escaneados novos na pasta de entrada, eles serao processados sozinhos.
echo.
call "%~dp0_rodar.bat" --vigiar
pause
