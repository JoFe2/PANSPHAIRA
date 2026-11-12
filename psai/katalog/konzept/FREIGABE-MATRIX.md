# FREIGABE-MATRIX — Evolutionär-Pfad (AP-A5.1)

Drei Ausbaustufen, jede ist nur eine breitere Freigabe-Matrix — kein Architekturbruch (B1).

| Eigenschaftsklasse | Stufe 1 „kuratiert“ | Stufe 2 „mitbestimmt“ | Stufe 3 „frei“ |
|---|---|---|---|
| Zonen an/aus | App-Festlegung | person-Knoten darf ein-/ausblenden | person-Knoten darf Zonen erzeugen |
| Zonen-Reihenfolge | App-Festlegung | person-Knoten führt (Feinwerk) | frei inkl. neuer Zonentypen |
| Theme-Wahl (je Zone) | App-Festlegung | Wahl aus freigegebenen Themes | frei + eigene Themes |
| Dichte/Abstände | App-Festlegung | 3 Stufen (kompakt/normal/groß) | frei in Token-Grenzen |
| Modul-Bindung an Slots | App-Festlegung | Umhängen innerhalb freigegebener Slots | frei inkl. Mitliefer-Template |
| Overlay-Verhalten | App-Festlegung | an/aus je Bereich | Modulfreigabe + Personenwahl |
| Live-Intervall | App-Festlegung | Wahlfreiheit je Viewlet | frei mit Performance-Budget |
| Struktur des Baums | App-Festlegung | person-Knoten nur als Blatt unter bereich | person-Knoten mit Teilbaum |

## Regeln über alle Stufen
1. Sperren des Root (z.B. marke.name) gelten in jeder Stufe (B6).
2. person-Knoten erben immer: Warum-so-Antwort, Quittung, Undo.
3. Agenten-Rechte sind immer delegationsgebunden mit Enddatum.

## Migration
- version:1 → 2: person-Knoten optional eingeführt; Version-1-Deskriptoren bleiben gültig
  (fehlender person-Knoten = Stufe 1). Neue Pflichtfelder nur additive Defaults.
- Regel: Neue Pflichtfelder sind verboten; Migration ist immer „Feld optional + Default“.
