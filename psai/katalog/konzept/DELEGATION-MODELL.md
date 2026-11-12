# DELEGATIONSMODELL (AP-D5.1)

## Eigentümerklassen & Rechte (Auszug Glossar §3, hier operational)
- Eigentümer: genau ein `wer`-Paar je Knoten; Rechte-Menge `lesen|schreiben|vorlagenBinden|sperrenSetzen|delegieren`.
- Delegationen: Liste je Knoten, je mit `gueltigBis` (Agenten: Pflicht).

## Gültigkeit und Verfallsregeln
1. Delegation gilt nur auf ihrem Knoten; Kinder erben sie nur, wenn `delegieren` gesetzt ist
   (Dann erzeugt das Kind eine eigene Delegation mit Verfallsdatum des Vaters als Obergrenze).
2. `gueltigBis` abgelaufen → Recht erlischt automatisch; Knoten bleibt, Warum-so zeigt
   „Delegation abgelaufen (person/agent, wer, wann)“.
3. Entzug: Eigentümer löscht Delegation; Betroffener erhält Chronik-Eintrag.

## Protokollierung & Rollback
Jede schreibende Delegationsspur schreibt: Wer (inkl. „im Auftrag von“ bei Agenten), Was
(Vorher/Nachher-Diff), Warum-so-Diff, Zeitstempel. Rollback = Umkehr-Aktion über dasselbe
Protokoll; der Rücknehmende braucht mindestens `schreiben` auf demselben Knoten.

## Agenten-Grenzen (Test AP-D5.1)
Agent ohne Delegation: kann nichts schreiben. Agent mit `schreiben`, ohne `vorlagenBinden`:
darf Optionen ändern, aber keine Themes/Struktur anrühren. Agent mit allem: braucht
Quittung + Chronik + Undo-Punkt, und die Shell zeigt „geändert durch max (Agent)“ sichtbar.
