@echo off
chcp 65001 >nul
title Collega Mox a Cloudflare
cd /d "%~dp0"

rem Node lo mette winget dentro Programmi. Se il PATH non lo ha ancora visto -
rem succede quando e' stato installato da poco - lo si aggiunge qui.
if exist "%ProgramFiles%\nodejs\npx.cmd" set "PATH=%ProgramFiles%\nodejs;%PATH%"

echo.
echo ============================================================
echo   PASSO 1 di 2  -  autorizzare Cloudflare
echo ============================================================
echo.
echo   Fra poco si apre il browser.
echo   Entra con il tuo account Cloudflare e premi il bottone Allow.
echo   Poi torna qui: questa finestra va avanti da sola.
echo.
pause
call npx wrangler login
if errorlevel 1 goto guasto

echo.
echo ============================================================
echo   PASSO 2 di 2  -  creare il database delle partite
echo ============================================================
echo.
call npx wrangler d1 create moxtracker > id-database.txt 2>&1
type id-database.txt
if errorlevel 1 goto guasto

echo.
echo ------------------------------------------------------------
echo   Fatto. Quello che vedi qui sopra sta anche nel file
echo   id-database.txt, in questa cartella.
echo.
echo   Adesso scrivi a Claude:  FATTO
echo   Al resto pensa lui: legge il file e finisce la configurazione.
echo ------------------------------------------------------------
echo.
pause
exit /b 0

:guasto
echo.
echo   Qualcosa non ha funzionato. Non e' un guaio: copia le righe qui
echo   sopra e mandale a Claude, che capisce da quelle cos'e' successo.
echo.
pause
exit /b 1
