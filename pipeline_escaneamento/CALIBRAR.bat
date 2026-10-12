@echo off
chcp 65001 >nul
title Calibracao - SEINFRA
cd /d "%~dp0"
echo.
echo CALIBRACAO: processa so as primeiras paginas reais e gera um relatorio de confianca.
echo Nada e movido. O relatorio fica em C:\CL\6_Pipeline\_CATALOGO\calibracao\
echo.
set /p N=Quantas paginas usar na amostra? [30]: 
if "%N%"=="" set N=30
call "%~dp0_rodar.bat" --amostra %N%
echo.
pause
