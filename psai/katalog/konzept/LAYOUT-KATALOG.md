# LAYOUT-KATALOG (AP-B1 bis B3, B6)

Alle Raster bestehen aus Zonen (GLOSSAR). Notation: feste Breite = px, fluide = fr.
Fokusreihenfolge folgt immer dem DOM-Quellfluss, nicht der visuellen Position.

## 1. Sidebar + Content + Rail (Referenz: P1–P5-Shell)
```
┌──────┬────────────────────┬────────┐
│ Nav  │ Content            │ Rail   │
│ 212  │ minmax(320,1fr)    │ 316    │
└──────┴────────────────────┴────────┘
```
Mindestbreite Content 320px. Rail ist assistierend, nie pflichtig.
Fokus: Header → Nav → Content → Rail → Statuszeile.

## 2. Kachel-Grid (Referenz: Startseite/P1-Domains)
Auto-Fill-Spalten 148–220px, Zeilen automatisiert. Kacheln sind Navigationsziele ODER Inhalte
(Manifest entscheidet). Gruppentitel als eigene Zeile. Mindestabstand 8px, Fokus als Ring.

## 3. Karten-Stack (Referenz: P3/P4)
Einspaltiger Strom aus Panels mit Kopfzeile; Sekundärdaten in Details/Unterbau.
Maximale Informationsbreite 72ch für Lesetext, Tabellen darüber hinaus erlaubt.

## 4. Split-Detail (Referenz: pan528)
```
┌─────────────┬──────────────────────┐
│ Liste/Auswahl│ Detail (führt)      │
│ min 240 / 1fr│ 2fr                 │
└─────────────┴──────────────────────┘
```
Auswahlwechsel darf Detail nie unangesagt ersetzen: Quittung bei ungesichertem Zustand.

## 5. Reiter-Stapel (Referenz: P2)
Reiter über Zone, nie über App. Unterreiter wechselt nur Inhalt, nie Kontext (GLOSSAR §2).
Ein aktiver Reiter pro Stapel, aria-selected, Pfeiltasten-Navigation.

## 6. Overlay-Ebene
Overlay-Ebene liegt über allen Zonen, eigener Fokus-Fang mit klarer Kante (Esc = zurück).
Kriterien für Wahl: siehe OVERLAY-ENTSCHEIDUNG.md.

## 7. Freie Leinwand / Ultrawide (AP-B6.1)
21:9/32:9: Raster in 12 Spalten → 24 Spalten; Leitbild „Blickfenster":
- Primärzonen in den mittleren ~60 % (Blickbewegung minimal),
- Assistenz/Status an den Außenkanten (peripher, informativ, nie pflichtig),
- Kacheln skalieren in Clustern (2→3→4 pro Zeile), nie in Einzelgrößen.
Pflicht: Ultrawide darf Tastaturfluss nicht verlängern — Tab-Reihenfolge bleibt linear.

## Zonentypen (AP-B2.1)
| Zone | Zweck | Anker | Mindestbreite | Einklapp-Regel | erlaubte Inhalte |
|---|---|---|---|---|---|
| Navigation | Kontextwechsel | links | 200px | zu Icon-Leiste 56px, dann Hamburger | Nav-Ziele nur |
| Startbereich | Einstieg/Kacheln | oben-mittig | 320px | Raster reduziert Spalten | Kacheln, Viewlets |
| Fachdaten | Sache selbst | zentral | 320px | nie einklappbar | Panels, Tabellen, Module |
| Chronik | Verlauf | rechts/unten | 240px | zu Leiste mit letztem Eintrag | Ticker, Listen |
| Assistent | Unterstützung | rechts | 280px | zu Pille mit Status | Panels, Viewlets |
| Filter | Darstellung umschalten | über Zone | — | zu Chip-Zeile | Umschalter nur |
| Status | Systemzustand | unten | — | nie (Zeile bleibt) | Statusleiste, Ticker |

## Responsive pro Zone (AP-B3.1)
| Zone | 390 | 1024 | 1586 | 2560×1080 |
|---|---|---|---|---|
| Navigation | Hamburger | Icon-Leiste | voll | voll |
| Startbereich | einspaltig | 2–3 Spalten | 3–4 | Cluster-Regel |
| Fachdaten | Vollbreite, volldominant | voll | voll | zentriert mit max 120ch |
| Chronik | unter Inhalt | unter Inhalt | Rail | rechte Außenkante |
| Assistent | Pille + Overlay | Pille + Overlay | Rail | Außenkante |
| Status | einzeilig, gekürzt | voll | voll | voll |
