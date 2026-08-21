@echo off
rem A double-cliquer UNE FOIS sur l'ordinateur de la salle.
rem Pose dans le menu Demarrer de Windows un raccourci vers « demarrer-borne.cmd »
rem qui reste, lui, dans le dossier du projet.

set "CIBLE=%~dp0demarrer-borne.cmd"
if not exist "%CIBLE%" (
  echo   « demarrer-borne.cmd » est introuvable a cote de ce fichier.
  echo   Les deux doivent rester ensemble dans le dossier du projet.
  pause
  exit /b 1
)

powershell -NoProfile -Command "$r=(New-Object -ComObject WScript.Shell).CreateShortcut($env:APPDATA+'\Microsoft\Windows\Start Menu\Programs\Startup\Borne du musee.lnk'); $r.TargetPath='%CIBLE%'; $r.WorkingDirectory='%~dp0'; $r.Save()"

if errorlevel 1 (
  echo   Le raccourci n'a pas pu etre cree.
  pause
  exit /b 1
)

echo.
echo   C'est fait : la borne demarrera toute seule avec Windows.
echo   Pour annuler, supprimer « Borne du musee » dans le dossier
echo   qui s'ouvre avec  Windows + R  puis  shell:startup
echo.
pause
