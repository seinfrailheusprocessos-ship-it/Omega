@echo off
chcp 65001 >nul
title Simular - SEINFRA
cd /d "%~dp0"
echo.
echo SIMULACAO: le os escaneados novos e mostra o que SERIA feito. Nao cria nenhum documento.
echo O plano fica em C:\CL\6_Pipeline\_CATALOGO\simulacao\
echo.
call "%~dp0_rodar.bat" --simular
echo.
pause
