#!/bin/bash
# Startet den Litchi Mission Builder lokal auf diesem Mac (Doppelklick im Finder).
# Es wird nichts hochgeladen. Der Webserver hört nur auf 127.0.0.1 (localhost).

ROOT="$(cd "$(dirname "$0")" && pwd)/dist"

if [ ! -f "$ROOT/index.html" ]; then
  echo "Der Ordner 'dist' wurde nicht gefunden. Bitte das ZIP vollständig entpacken und erneut starten."
  read -r -p "Zum Beenden Enter drücken"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 wurde nicht gefunden."
  echo "Bitte im Terminal 'xcode-select --install' ausführen (oder Python von python.org installieren) und erneut starten."
  read -r -p "Zum Beenden Enter drücken"
  exit 1
fi

exec python3 -I - "$ROOT" <<'PY'
import http.server, os, socket, sys, threading, webbrowser

root = os.path.realpath(sys.argv[1])

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".wasm": "application/wasm",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
        ".gz": "application/gzip",
    }

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=root, **kw)

    def send_head(self):
        # Unbekannte Pfade auf index.html umleiten (wie beim Windows-Start).
        path = os.path.realpath(self.translate_path(self.path))
        if not (path.startswith(root + os.sep) and os.path.isfile(path)):
            self.path = "/index.html"
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *a):
        pass

server = None
for port in range(8080, 8091):
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
        break
    except OSError:
        continue

if server is None:
    print("Kein freier Anschluss (Port 8080 bis 8090) gefunden. Bitte andere Programme schließen und erneut starten.")
    input("Zum Beenden Enter drücken")
    sys.exit(1)

url = f"http://localhost:{port}/"
print()
print(f"Litchi Mission Builder läuft auf {url}")
print("Dieses Fenster offen lassen. Zum Beenden das Fenster schließen oder Ctrl+C drücken.")
threading.Timer(0.8, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\nBeendet.")
PY
