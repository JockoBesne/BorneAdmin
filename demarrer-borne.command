#!/bin/sh
# Lance la borne sur Mac. À double-cliquer.
#
# POUR UN RACCOURCI SUR LE BUREAU : clic droit sur ce fichier ▸ « Créer un
# alias », puis glisser l'alias sur le bureau. Ne JAMAIS déplacer ce fichier-ci :
# il cherche le projet juste à côté de lui, et ne le trouverait plus.
#
# Équivalent Windows : « demarrer-borne.cmd », posé à côté.

cd "$(dirname "$0")/apps/appli" || exit 1

# Ouvert depuis le Finder, un script ne connaît pas toujours node : les deux
# dossiers où Homebrew l'installe (puce Apple, puis Intel) sont ajoutés au cas où.
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Filet de sécurité : sans interface construite, la borne afficherait du blanc.
[ -f dist/index.html ] || npm run construire || exit 1

# On demande son chemin à Electron plutôt que de l'écrire en dur : npm ne le
# range pas au même endroit d'un ordinateur à l'autre.
ELECTRON=$(node -p "require('electron')" 2>/dev/null)

if [ ! -x "$ELECTRON" ]; then
  echo
  echo "  Electron est introuvable : l'application ne peut pas démarrer."
  echo "  Ouvrir le Terminal dans le dossier du projet et taper :"
  echo
  echo "      npm install"
  echo
  echo "  Si le téléchargement échoue, taper ensuite :"
  echo
  echo "      npm run reparer-electron"
  echo
  echo "  (fermer cette fenêtre pour continuer)"
  read -r _
  exit 1
fi

exec "$ELECTRON" .
