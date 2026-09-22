MARGIN-RULES v1.0 (canonical)
METHODE: margin-threshold — Markenfaktura-Grenzwert-Pruefung
EINSATZ: flaggt Rechnungen, deren Gesamtwert den vom Nutzer bestaetigten Mindestgrenzwert unterschreitet.
REGEL: eine Rechnung wird genau dann markiert, wenn totalMinor < floorCent, wobei floorCent = round(floorEur * 100).
EINHEIT: alle Betraege in ganzzahligen Nebeneinheiten (Cent) der Kanaelwaehrung EUR; Hauptbetrags-Werte (EUR) werden mit Faktor 100 konvertiert.
VORAUSSETZUNG: jede Rechnung besitzt ein gueltiges Faelligkeitsdatum (YYYY-MM-DD) und eine Rechnungskennung.
REGEL-KUNDE: eine Rechnung ohne Kundenzuordnung wird mit dem Grund BELOW_THRESHOLD_CUSTOMER_UNKNOWN markiert, nicht verworfen.
WAHRUNG: Rechnungen in anderen Waehrungen werden von dieser Methode nicht abgebildet und nicht umgerechnet.
BEISPIEL: floorEur 30.00; Rechnung 2999 Cent => markiert; Rechnung 3000 Cent => nicht markiert.
