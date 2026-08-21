@echo off
rem Lance la borne. A mettre au demarrage de Windows :
rem   1. touche Windows + R, taper  shell:startup  , Entree
rem   2. glisser ce fichier dans le dossier qui s'ouvre, avec le bouton DROIT
rem   3. choisir « Creer les raccourcis ici »
rem Le chemin est relatif a ce fichier : le projet peut etre range n'importe ou.

cd /d "%~dp0apps\appli"

rem Filet de securite : sans interface construite, la borne afficherait du blanc.
if not exist "dist\index.html" call npm run construire

start "" /b "%~dp0node_modules\electron\dist\electron.exe" .
