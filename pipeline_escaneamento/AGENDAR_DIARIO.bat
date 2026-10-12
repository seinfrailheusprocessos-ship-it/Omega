@echo off
chcp 65001 >nul
title Agendar processamento diario - SEINFRA
cd /d "%~dp0"
echo.
echo Cria uma tarefa no Agendador do Windows que roda o PROCESSAR todo dia.
echo O computador precisa estar ligado e voce logado na hora marcada.
echo.
echo   1 = criar/atualizar a tarefa diaria
echo   2 = remover a tarefa
echo.
set /p OP=Escolha 1 ou 2: 
if "%OP%"=="2" (
  schtasks /Delete /TN "SEINFRA_Pipeline_Escaneamento" /F
  echo Tarefa removida.
  pause
  exit /b 0
)
set /p HORA=A que horas (formato HH:MM, ex.: 18:00)? [18:00]: 
if "%HORA%"=="" set HORA=18:00
schtasks /Create /TN "SEINFRA_Pipeline_Escaneamento" /TR "\"%~dp0PROCESSAR.bat\" --silencioso" /SC DAILY /ST %HORA% /F
if errorlevel 1 (
  echo.
  echo Nao consegui criar a tarefa. Tente: botao direito neste arquivo - Executar como administrador.
) else (
  echo.
  echo PRONTO. Todo dia as %HORA% os escaneados novos serao processados.
)
echo.
pause
