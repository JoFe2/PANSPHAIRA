# NAVIGATIONS-MUSTER (AP-E1.1, AP-E2.1)

## Abschnitt 1 — Wege (AP-E1.1)
1. **Primärpfad:** sichtbare Ziele (Nav, Kacheln) — jeder Kernbereich ≤2 Klicks ab Start.
2. **Sekundärpfad:** Palette ⌘K/Strg+K mit fuzzy Suche über Module/Zonen/Aktionen;
   Ergebnisse nach Häufigkeit + aktuellem Kontext sortiert.
3. **Kürzel:** nur Zweitweg (Nie Einzelpfad): j/k Liste, g↵ genehmigen, gx ablehnen, ? Hilfe,
   Esc schließt Overlay. Kürzelhilfe als eigener, verlinkbarer Zustand (#hilfe).
4. **Zurückpfade:** Overlay→Esc, Seite→Browser-zurück + „Zurück zu Bereich X“-Link im Kopf,
   Bereich→Nav mit aria-current. Kein Weg darf Sackgasse sein (Immer ≥2 Ausgänge).

## Abschnitt 2 — Perspektiven (AP-E2.1)
Perspektive = Darstellungsform auf derselben DataSource, nie Datenkopie:
| Perspektive | Zweck | Wechsel | Datenform |
|---|---|---|---|
| Liste | Massenabgleich | Standard | zeilen |
| Karte/Detail | Einzelfall | Kachel/Klick | objekt |
| Zeitachse | Verlauf/Chronik | Reiter | events |
| Vergleich | Vorher/Nachher, Beleg vs. Bestellung | Aktion | diffs |
| Rohlog | Nachweis/Audit | Quittungs-Link | raw |

Regeln: Perspektivenwechsel ändert URL-Fragment (teilbar), Filter bleiben erhalten
(Persistenz je Knoten-Option), Umschalter ist nie Navigationsziel (GLOSSAR §2).
pan528-Beispiel: Liste Rechnungen → Detail (Karte) → Quellen (Drawer) → Chronik (Zeitachse) —
alle an dq.beleg, kein Zwischenzustand kopiert Daten.
