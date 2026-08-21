@echo off
rem Lance la borne.
rem
rem POUR DEMARRER AVEC WINDOWS : double-cliquer sur « installer-demarrage.cmd »,
rem pose a cote de ce fichier. Ne JAMAIS copier ce fichier-ci dans le menu
rem Demarrer : il cherche le projet juste a cote de lui, et ne le trouverait plus.

cd /d "%~dp0apps\appli"

rem Filet de securite : sans interface construite, la borne afficherait du blanc.
if not exist "dist\index.html" call npm run construire

rem On demande son chemin a Electron plutot que de l'ecrire en dur : npm ne le
rem range pas au meme endroit d'un ordinateur a l'autre.
set "ELECTRON="
for /f "delims=" %%E in ('node -p "require('electron')" 2^>nul') do set "ELECTRON=%%E"

if not defined ELECTRON (
  echo.
  echo   Electron est introuvable : l'application ne peut pas demarrer.
  echo   Ouvrir une invite de commandes dans le dossier du projet et taper :
  echo.
  echo       npm install
  echo.
  echo   Si le telechargement echoue, taper ensuite :
  echo.
  echo       npm run reparer-electron
  echo.
  pause
  exit /b 1
)

start "" /b "%ELECTRON%" .
