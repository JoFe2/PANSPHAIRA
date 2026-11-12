# OVERLAY-ENTSCHEIDUNG (AP-B4.1)

## Flussdiagramm (als Regeln)
1. **Braucht der Nutzer den alten Kontext sichtbar weiter?** → Drawer (Overlay) mit Rückkehrpfad.
2. **Muss er im neuen Kontext längere Aufgaben erledigen (≥3 Schritte)?** → eigene Seite/Tab.
3. **Geht es um eine kurze Bestätigung/Eingabe (≤2 Felder)?** → Modal.
4. **Nur Zusatzinfo beim aktuellen Element?** → Popover/Tooltip.
5. **Kann die Antwort warten?** → Chronik-Eintrag statt Overlay (Pull statt Push).

## Kriterienmatrix
| Kriterium | Overlay | Seite/Tab |
|---|---|---|
| Kontextverlust | vermieden | akzeptiert, aber Rückkehrpfad Pflicht |
| Parallelität (alt+nach neu vergleichen) | nur Drawer nebeneinander | Tab erlaubt Vollvergleich |
| Rückkehrpfad | Esc + Merker der alten Scroll-Position | Browser-zurück + Lesezeichen |
| Rollenfreigabe | overlay.erlaubt je Knoten (Deskriptor) | immer erlaubt |

## Drei durchgespielte Fälle (Test AP-B4.1)
1. **Rechnung im Detail prüfen** (pan528): Kontext bleibt, ein Panel → **Seite** (Bereits so gebaut; Split-Detail).
2. **Quellen zum Beleg ansehen** (kurz, zurückkehren): **Drawer rechts**, 480px, Esc schließt, Scroll-Merker.
3. **Ansicht bearbeiten** (länger, mehrere Felder, kontextschonend): **Tab „Ansicht“** statt Modal —
   weil ≥3 Schritte und Vergleich alt/neu erwünscht.

## Pflichtgrenzen
Overlay ohne Esc = verboten. Overlay über Fachdaten-Pflichtaktion = verboten (Klick fängt dort).
Jedes Overlay trägt Titel-Zone und geschlossenen Fokus-Kreis.
