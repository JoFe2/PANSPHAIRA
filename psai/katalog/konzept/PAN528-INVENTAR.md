# PAN528-INVENTAR (AP-F1.1)

Geprüft am Bestand: src/pan528 (screen.html 10 Zeilen Rumpf, app.js 91 Zeilen, Broker/Controller-Module).

## Elemente → Zone/Modul/Datenquelle
| Element (Beleg im Code) | Zone | Modul/Slot | Datenquelle/Status |
|---|---|---|---|
| `business-status`, `business-result-status` | Status | pan528 · statusleiste | dq.beleg (Mock, readback geplant) |
| `first-value`, `expected-value`, `observed-value`, `expected/observed-business-value` | Fachdaten | pan528 · detail-panel | dq.beleg — Betrags-/Abweichungspaare |
| `progress` (role=status) | Fachdaten | pan528 · detail-panel | Fortschritt des Prüflaufs |
| `helper-title/-status`, `helper-proposal`, `typed-helper-proposal`, `request-helper` | Assistent | pan528 · overlay-inhalt/Panel | lokaler Vorschlag, kein Modell |
| `run-starter`, `abort-starter`, `reset-starter`, `native-starter-result`, `starter-title` | Fachdaten | pan528 · Aktionen | run/abort/reset = Manifest-Aktionen |
| `native-result`, `result-title`, `refresh-status` | Chronik/Status | pan528 · chronik | Readback-Zeilen |
| `technical-first-value-ms` | Status | Shell-Anreicherung | Messwert, kein Fachdatum |

## Umschreibbedarf (Ist → Ziel)
1. app.js mischt Adapter (Mock) und Darstellung → Adapter nach ADAPTER-MODELL ausgliedern.
2. Aktionen ohne Quittungsformat → Manifest-Aktionen mit Vorher/Nachher/Undo (AKTIONEN-QUITTUNG).
3. `role=status` fehlt an 2 Zustandsfeldern (nur 2 von ~6) → Status-Landmarks vervollständigen.
4. Slots hartverdrahtet im Raster → Slot-Registry nach SLOT-KATALOG (nav/home/detail/overlay/status/chronik).
5. Keine Knoten-Optionen → `live.intervallSek`, `detailkarte.zeigen` aus Deskriptor lesen.
Datenumfang bleibt identisch (AP-PAN316-Werte), nur die Beschreibungslagen ändern sich.
