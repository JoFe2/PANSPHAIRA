#!/usr/bin/env python3
"""Werkbank-Server: liefert ~/frontend-kit und meldet /werkbank/neu, ob sich eine Datei geändert hat.

Nur für den lokalen Entwicklungsloop — kein Fachhost, keine Authentifizierung.
Der Reload der Vorschau wird dadurch reaktiv: Der Rahmen frägt alle zwei Sekunden nur noch
diese eine winzige Zeile ab; geladen wird erst, wenn seit dem letzten Stand wirklich etwas
auf der Platte newer geschrieben wurde.
"""
import hashlib
import json
import os
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

WURZEL = os.path.expanduser("~/frontend-kit")
# Überwachte Dateien: alles, was die Vorschau zeigt. Versteckte Dateien und this Skript selbst nicht.
SPUR_DATEIEN = [
    "psai/katalog/konzept/prototyp/index.html",
    "psai/katalog/konzept/prototyp/proto.js",
    "psai/katalog/konzept/prototyp/zeiger.js",
    "psai/katalog/live/index.html",
]
TOUR_DATEI = "psai/katalog/live/tour.json"


def stand():
    """Kurzer Fingerabdruck aller beobachteten Dateien (Größe + mtime, kein Inhalt)."""
    brocken = []
    for rel in SPUR_DATEIEN:
        pfad = os.path.join(WURZEL, rel)
        try:
            s = os.stat(pfad)
            brocken.append(f"{rel}:{int(s.st_mtime_ns)}:{s.st_size}")
        except OSError:
            brocken.append(rel + ":feht")
    return hashlib.sha1("\n".join(brocken).encode()).hexdigest()[:16]


def tour_stand():
    """Für sich allein beobachtet: tour.json soll den Zeiger umlenken, nicht die Seite neuladen."""
    try:
        s = os.stat(os.path.join(WURZEL, TOUR_DATEI))
        return f"{int(s.st_mtime_ns)}:{s.st_size}"
    except OSError:
        return "fehlt"


class Handler(SimpleHTTPRequestHandler):
    ELEMENTE = []   # letzte Meldung des Rahmens — damit der Agent die Bedienlandschaft abfragen kann
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WURZEL, **kwargs)

    def do_GET(self):
        if self.path.startswith("/werkbank/strom"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            letzter, letzter_tour, tick = None, None, 0
            try:
                while True:
                    s = stand()
                    if s != letzter:
                        letzter = s
                        self.wfile.write(f"event: werkbank\ndata: {json.dumps({'stand': s})}\n\n".encode())
                    else:
                        t = tour_stand()
                        if t != letzter_tour:
                            letzter_tour = t
                            self.wfile.write(b"event: tour\ndata: {}\n\n")
                    if letzter and letzter_tour and tick % 20 == 0:
                        self.wfile.write(b":ping\n\n")
                    tick += 1
                    self.wfile.flush()
                    time.sleep(0.7)
            except (BrokenPipeError, ConnectionResetError, OSError):
                return  # Hörer ist weg — Strom schließen
        if self.path.startswith("/werkbank/neu"):
            koerper = json.dumps({"stand": stand()}).encode()
        elif self.path.startswith("/werkbank/elemente"):
            koerper = json.dumps(self.ELEMENTE, ensure_ascii=False).encode()
        else:
            super().do_GET()
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(koerper)))
        self.end_headers()
        self.wfile.write(koerper)

    def do_POST(self):
        if self.path.startswith("/werkbank/elemente"):
            laenge = int(self.headers.get("Content-Length", 0))
            try:
                empfang = json.loads(self.rfile.read(laenge).decode())
                if isinstance(empfang, list):
                    Handler.ELEMENTE = [str(x)[:60] for x in empfang][:80]
            except (ValueError, UnicodeDecodeError):
                pass
            self.send_response(204)
            self.end_headers()
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):  # ruhiger Server: nur Fehler melden
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8099), Handler).serve_forever()
