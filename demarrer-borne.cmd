@echo off
rem Lance la borne. A mettre au demarrage de Windows :
rem   1. touche Windows + R, taper  shell:startup  , Entree
rem   2. glisser ce fichier dans le dossier qui s'ouvre, avec le bouton DROIT
rem   3. choisir « Creer les raccourcis ici »
rem Les chemins sont calcules a partir de ce fichier : le projet peut etre range
rem n'importe ou sur l'ordinateur.

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
