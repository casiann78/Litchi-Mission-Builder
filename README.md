# Litchi Mission Builder

Liest GPS-Koordinaten aus Bildern, Screenshots und Videos, baut daraus eine Drohnenstrecke und exportiert sie als CSV für den Litchi Mission Hub. Alles läuft im Browser, Bilder und Videos werden nicht hochgeladen.

Wer die Seite nur benutzen will: siehe `LIESMICH.txt` (Start per Doppelklick, kein Node nötig).

## Entwickeln

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm run dev      # Entwicklungsserver auf http://localhost:8080
npm run build    # baut die fertige Seite nach dist/
npm run preview  # zeigt den Stand aus dist/ an
```

Die Start-Skripte (`Start-Mac.command`, `Start-Windows.bat`) und Vercel liefern den Ordner `dist/` aus. Nach Änderungen also `npm run build` ausführen und `dist/` mit einchecken.

## Aufbau

```
index.html            Einstiegsseite
src/main.jsx          Startpunkt, bindet die Stylesheets ein
src/App.jsx           Hauptkomponente (Zustand der Mission, Upload, Speichern)
src/components/       Oberfläche: Karte, Lageplan, Wegpunktliste, Karten für Bilder und Videos
src/hooks/            Verwaltung der Videos
src/lib/              Logik ohne Oberfläche: Koordinaten lesen, Texterkennung, CSV, Geometrie
src/styles/           Gestaltung (Tailwind plus eigenes CSS)
public/ocr/           Dateien der Texterkennung (tesseract.js, englische Sprachdaten)
dist/                 fertig gebaute Seite
```

Technik: React 19, Vite, Tailwind CSS 4, Leaflet, tesseract.js, Phosphor Icons.

## Zur Herkunft des Quellcodes

Der ursprüngliche Quellcode lag nicht vor. `src/` wurde aus der gebauten Seite in `dist/` wiederhergestellt und im Browser gegen das Original geprüft (gleiche Darstellung, gleiche Texterkennung, gleiche CSV). Daraus folgt:

- Dateiaufteilung und Namen von Funktionen und Komponenten sind neu vergeben.
- Viele lokale Variablen heißen noch kurz (`e`, `t`, `n`). Sie werden beim Weiterarbeiten nach und nach umbenannt.
- Ursprüngliche Kommentare fehlen.
- `src/styles/` enthält das CSS in der vom Build aufbereiteten Form.
- Das Speichern von Team-Missionen ruft `/api/missions` auf. Dieser Serverteil war nicht in der gebauten Seite enthalten und fehlt hier. Ohne Team-Code speichert die Seite lokal im Browser.
