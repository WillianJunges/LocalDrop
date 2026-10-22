@echo off
chcp 65001 >nul
title LocalDrop
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js não encontrado. Instale a versão LTS em https://nodejs.org e tente de novo.
  echo.
  pause
  exit /b 1
)

node scripts\iniciar.mjs
if errorlevel 1 (
  echo.
  echo   O LocalDrop parou com erro. Veja a mensagem acima.
  pause
)
