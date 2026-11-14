#!/bin/bash
# Startet den Litchi Mission Builder lokal (Mac und Linux). Es wird nichts hochgeladen.
cd "$(dirname "$0")/dist" || { echo "Ordner 'dist' nicht gefunden. Bitte das ZIP vollständig entpacken."; exit 1; }
echo
echo "Litchi Mission Builder läuft auf http://localhost:8080/"
echo "Dieses Fenster offen lassen. Zum Beenden das Fenster schließen oder Strg+C drücken."
( sleep 1; open "http://localhost:8080/" 2>/dev/null || xdg-open "http://localhost:8080/" 2>/dev/null ) &
python3 -m http.server 8080 --bind 127.0.0.1
