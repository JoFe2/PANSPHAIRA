# ADAPTER-MODELL (AP-D3.1)

Ein Adapter pro Quelltyp, identische Schnittstelle: `lesen(), abonniere(callback), status()`.
Readback = Verifikation gegen den führenden Speicher, nie gegen UI-Zustand.

| Adapter | Eignung | Statusmodell | Readback | Besonderheit |
|---|---|---|---|---|
| rest | Fachschichten/APIs | HTTP-Code + Zeitstempel | GET nach PATCH/POST | Idempotenzschlüssel bei Aktionen |
| csv | Import/Export, Nachtrag | Datei-Meta (mtime, Zeilenzahl) | Prüfsummenvergleich | nur-lesen erzwungen |
| mock | Entwicklung/Demos | simuliert Latenz+Ausfall | Referenz-Konstanten |
| stream | Ticker/Live | Keepalive + Lücke-Zeit | Sequenznummern | Lücke = amber, nie still |

## Einheitliches Statusobjekt (alle Adapter)
`{zustand: bereit|alternd|pausiert|quellfehler, versuche, stand, grund?}`
→ speist LIVE-KOMPONENTEN-Fehlerzustände; UI übersetzt nie eigene Statuswörter.

## pan528-Adapterwahl (Test AP-D3.1)
Aktuell: Mock/Konstanten (REST-Fachschicht folgt) → `rest` mit `zugriff: nur-lesen`,
`readback: true`, Intervall aus Knoten-Option `live.intervallSek` (Minimalbaum: 30s).
