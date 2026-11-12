# LIVE-KOMPONENTEN (AP-C5.1)

Vier Bausteine bilden die Live-Schicht (B9). Alle Vanilla-ES, keine Chart-Library-Pflicht.

## 1) Kennzahl-Kachel
- Datenform: `{wert, einheit, delta?, stand}`.
- Intervall-Optionen: 10s | 30s | 60s | 5m | aus (je Knoten-Option `live.intervallSek`).
- Alterung: > 2× Intervall → amber-Rand + „Stand vor Xm“.
- Pause/Resume: Button in Kopfzone; Zustand bleibt nach Reload (Knoten-Option).
- Fehlerzustand: letzte bekannte Zahl grau + Grundzeile („Quelle antwortet nicht, Versuch 3“).
- Count-up nur bei Wertänderung, 300ms; reduced-motion setzt direkt.

## 2) Ticker-Zeile
- Datenform: Event-Strom `{zeit, typ, text, link?}`; Puffer 50 Einträge, älteste raus.
- Kein aria-live (Sonst Screenreader-Lärm); stattdessen „N neue Meldungen“-Knopf.
- Gruppierung gleicher Ereignisse mit Zähler („Rechnung geprüft ×3“).
- Pause bei Hover/Fokus; Pause-Pflicht bei Tastaturfokus im Ticker.

## 3) Trend-Liniendiagramm
- Datenform: `{reihen: [{name, punkte:[{t, v}]}]}`, max 4 Reihen.
- Rendern: SVG-Pfad, Achsen beschriftet, letzte Zahlen am Linienende (Farbe nie allein).
- Intervall 30s–5m; Alterung amber; Pause/Resume wie 1).
- reduced-motion: neue Punkte erscheinen ohne Pfad-Morphing.

## 4) Statusleiste
- Datenform: `{systeme: [{name, zustand: ok|warn|off, seit}]}`.
- Darstellung: Punkte + Klartext je System, aggregierte Zahl links („3/5 bereit“).
- Intervall 5–60s; Alterung wie 1); Fehlerzustand: „Status unbekannt seit …“.
- Steht in der Status-Zone, Shell-Theme (gilt global, MOSAIK-Regel 4).

## Fehlerinjektionstest (Epic-C-Test)
Mock-Quelle stoppen → nach 2× Intervall amber; nach 3 Fehlversuchen „Quelle offline“-Zustand
mit manueller Neuprobe; Ticker friert letzten Stand ein und zeigt Zeitstempel.


## M5-Status (Umsetzung im Prototyp)
Ticker (`komponente.ticker-zeile`), Trend (`komponente.trend-liniendiagramm`) und
Shell-Statuszone (`shell.statuszone`) sind im Prototyp aktiv und gegen die Fachschicht
(`/api/events`, `/api/trend`) getestet; Optionen: ticker.maxEintraege, ticker.pausierenBeiFokus,
trend.reihenMax, trend.zeitfensterWochen, statuszone.zeigeStand.

M7-Audit-Status: alle vier Bausteine erfüllen jetzt die volle Spezifikation (Intervall,
Alterung, Pause/Resume, Fehlerzustand mit Neuprobe) — belegt in m7a-tests.mjs.
