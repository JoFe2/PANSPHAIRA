# MOSAIK-REGELN — Design-Koexistenz (AP-B5.1)

## Grundregel
Verschiedene Themes in einem Workspace sind Normalfall (B7). Zusammenhalt entsteht durch:
1. **Gemeinsame Basis-Schicht:** identische Radien- und Raster-Token, gleiche Fokus-Ring-Form,
   gleiche Status-Semantik (grün=belegt, amber=Aktion fällig, grau=nicht angebunden).
2. **Themen-Grenze = Zonen-Grenze:** Ein Theme endet nie mitten in einem Panel.
3. **Übergang:** 1px-Linie in Border-Farbe der dunkleren Seite + 8px Abstand. Keine Verläufe
   zwischen Themes (wirkt wie Fehler).
4. **Ein App-Chrome:** Header/Nav/Status bleiben im Shell-Theme; Mosaik wirkt erst in den Bereichen.

## A11y-Grenzen (Test AP-B5.1)
- Kontrast wird **je Theme** geprüft (axe je Zone-Mosaik-Kombination).
- Fokus-Ring muss in beiden Nachbarschaften sichtbar sein: Ringfarbe = Theme-Farbe, plus Outline-Offset.
- Farbbedeutung nie allein: Immer Icon/Text zusätzlich (grün+Häkchen, amber+Ausrutscher).

## Durchgespielter Fall: Pulse-Startseite neben Essential-Rechnungen
- Shell: Essential (hell). Startseite: Pulse (dunkler Bereich, abgerundete Fläche, 1px #d7dbe2 Rand).
- Header-Navigation bleibt hell → keine zwei Chrome-Theme.
- Kacheln der Startseite verlinken in Rechnungs-Bereich: Linkfarbe des Ziel-Themes erst nach Hover
  (sonst Irritation), Klick wechselt Theme mit Zonen-Grenze — kein „Seiten-Flackern“,
  da Transition nur opacity 120ms.

## Tabus
- Kein Theme imitiert Bedienung des anderen (Pulse-Orb in Essential-Zone = verbannt).
- Mosaik-Blöcke erzählen keine widersprüchlichen Zustände (Statusleiste gilt global, im Shell-Theme).
