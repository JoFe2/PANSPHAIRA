# KOMPONENTEN-LISTE (AP-C3.1, AP-C3.2)

Zustands-Sets sind Pflicht; jedes Set wird gegen alle 5 Theme-Profile geprüft (Epic-C-Test).

## Abschnitt 1 — Statische Komponenten (AP-C3.1)
| Komponentenzustand | Standard | Hover | Fokus | Disabled | Loading | Fehler |
|---|---|---|---|---|---|---|
| Button (primär/ghost) | bg btn / transparent | bg+Helligkeit ±8% | Ring 2px Offset 2 | opacity 45% + title-Pflicht | Spinner 14px im Takt | Rand warn + Inline-Popup |
| Badge (ok/warn/neutral) | Semantic-Farben | — | — | — | Pulsieren erlaubt | — |
| Card/Panel | layer + line, Radius je Theme | line +1 Stufe | — | — | Skeleton-Muster | Kopf warn-Icon |
| Table | Zeilen 40px, thead mono | Zeile layer2 | sichtbare Zeile | — | 3 Skeleton-Zeilen | Zeile warn + „Erneut laden“ |
| Tabs/Reiter | active = btn-Unterlegung | Text+ | Ring | aria-disabled+title | — | Reiter-Punkt warn |
| Drawer/Overlay | Fokus-Fang, Esc | — | Kreis geschlossen | — | Content-Skeleton | Inhalt durch Fehlerkarte ersetzt |
| Toast/Quittung | 2 Zeilen max, Undo-Button | — | mit Tab erreichbar | — | — | Verbleibt bis Kenntnisnahme |
| Empty-State | Icon+Titel+1 Aktion | — | — | — | — | — |
| Skeleton | layer2, 1.2s Shimmer | — | — | — | reduced-motion: statisch | — |

## Abschnitt 2 — Live-Komponenten (AP-C3.2, Details in LIVE-KOMPONENTEN.md)
Kennzahl-Kachel, Ticker-Zeile, Trend-Liniendiagramm, Statusleiste.
Zusätzliche Zustände neben Abschnitt-1-Set: `alternd` (Zeitstempel > 2× Intervall → amber),
`pausiert` (Pille in Ecke), `quellfehler` (letzter Wert grau + Grundzeile).

## A11y-Grundpflichten je Komponente
Beschriftbarer Name, Ziel ≥36px (44px auf Touch), Fokus sichtbar in jedem Theme,
Farbdopplung (Icon/Text), aria-live nur für Quittungen (nicht für Ticker — sonst Lärm).
