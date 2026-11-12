# AKTIONEN & QUITTUNG (AP-D4.1 + AP-E3.1)

## Deklarative Aktion
`{id, payload, erwarteterEffekt, quitte: bool}`. UI rendert Buttons aus Manifest-Aktionen,
nie aus eingebauter Kenntnis der Fachlogik.

## Quittungsformat (einziges Format, überall)
1. **Vorher → Nachher** (Feld für Feld, Kurzform bei Listen: „n von m“).
2. **Rohlog-Link** (technische Zeile, ausklappbar, copyierbar).
3. **Undo-Fenster** (Default 30s, Zähler sichtbar; danach nur als Neu-Aktion).
4. Landmark role=status, aria-live=polite; Toast ersetzt Vorgänger-Toast nicht bei Fehlern.

## Grün-Regel (AP-E3.1)
Grün (badge-ok) nur, wenn Readback bestätigt. Ohne Bestätigung: neutral + „gemeldet, unbelegt“.
Im Minimalbaum: Abweichung 0,00 € mit Badge „stimmig“, weil native Prüfung belegt — Vorbild.

## Durchgespielter Fall (Test AP-D4.1)
Aktion „Prüfung vorbereiten“ an AP-PAN316:
1. Vorher: Prüfstand „noch nicht geprüft“ → Nachher: „vorbereitet (Vorschlag, nicht gesendet)“.
2. Rohlog: `ap.pan316.vorbereiten vorgang=AP-PAN316 zeit=… modus=vorschlag`.
3. Undo 30s sichtbar → danach Button „Erneut vorbereiten“.
4. Chronik-Eintrag mit Zeitstempel + Link.

## Undo-Grenzen
Undo ist Umkehr-Aktion, kein Zustand-Rollback der Quelle. Quellen ohne Undo-Fähigkeit
erklären `undoFensterSek: 0`; UI zeigt dann Begründung statt totem Button.
