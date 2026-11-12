# Verbesserungskonzept V3 — „Nicht plus ultra“ (T1/T2/T3/Index)

Ausgangslage V2: bedienbarer Genehmigungsfluss, aber die Seiten reagieren nur auf
Einzelaktionen. V3 macht sie zu lebenden Konsolen: Die Warteschlange verändert sich
sichtbar, Zahlen atmen mit der Eingabe, und die Seite meldet sich von selbst.

## Gemeinsame V3-Schritte (alle Templates)
1. **Live-Vorgang**: Der laufende Verschluss-Job (BELG-0912) steigt real von 62 % auf 100 %,
   die Schrittliste wandert mit, bei Ziel erreicht die Erfolgsmeldung Karte + Chronik +
   Statuszeile mit Signal-Blinken. reduced-motion: Sprung statt Animation.
2. **Filter-Chips mit Zählern** über der Warteschlange (Alle / Risikoarm / Laufend) —
   Zustand bleibt unsichtbar im DOM, aria-geprüft.
3. **Wirksameldung zum Anfassen**: Mengen-Stepper an WARE-4711 — jede Änderung rechnet die
   Vorher/Nachher-Zeile live um. Die Genehmigung entscheidet über eine Zahl, nicht über Prosa.
4. **Leerzustand mit Resümee**: Ist die Warteschlange abgearbeitet, zeigt sich eine ruhige
   Erschöpfungsmeldung mit Zählung der Entscheidungen — kein Loch, kein ratloses Bildschirmbild.
5. **Fokusfluss**: Nach einer Entscheidung wandert der Fokus auf die nächste offene Karte —
   die Hand bleibt auf der Tastatur.
6. **Statusleben**: Statuszeile blinkt bei jeder Zustandsänderung einmal auf (Farbe, kein Layout).
7. **Legende für Statuspunkte** in der Navigations-Spur (Vision-Befund aus V2-Runde behoben).

## T1 zusätzlich
- Hilfedialog (echt, ? ruft ihn), Budget-Pill mit Bezugswert im Titel (421/680 Modellminuten).

## T2 zusätzlich
- Palette bleibt, Filter/Stepper/Live-Job kommen hinzu; Schrittliste wird fünfmarkiert geführt.

## T3 zusätzlich
- Diff-Tabelle (Feld · Vorher · Nachher) in Serifen-Setzung unter der Wirkungszeile —
  Abwägen braucht die Tabelle, nicht nur den Satz.
- Begründungs-Entwurf überlebt Neuladen (localStorage, „Entwurf wiederhergestellt“).
- Tagesanker in der Chronik.

## Index
- Umschalter auf drei Stufen V1/V2/V3, Bewertung je Stufe, Historie.

## Abhakliste
- [x] jede V3-Seite axe 0 (T1 zunächst Kontrastverletzung #wkVerf → #0e6027)
- [x] Live-Job erreicht 100 % und quittiert sichtbar (Playwright: decided, SCHRITT 5/5, Status + Chronik, Schritte grün)
- [x] Stepper rechnet um: Menge 20 → verfügbar 34, Reservierung 0
- [x] Filter (risikoarm=2), Leerzustand mit Resümee, Fokusfluss (Fokus wandert nach Genehmigung auf nächste Karte — erforderl. Capture-Phase-Hörer, weil V2 den Klick-Target synchron ersetzt)
- [x] Bilder in shots/, Vision-Abnahme round2: Demo-Overlay in Fußzeile integriert, tote Steuerung im Leerzustand ausgeblendet, Readback ohne Irritations-Durchstreichung, Kontrastaufhellungen, Diff-Tabelle justiert
- [x] V1/V2 unverändert; Index dreistufig (V1/V2/V3-Schalter erprobt)

## Nach der Bildabnahme korrigiert (Runde 2)
- Demo-Hinweis von fixiertem Overlay (kollidierte mit Tastatur-Box) zu statischem Fußzeilen-Chip.
- Leerzustand blendet Kommandoleiste + Filter aus (keine toten Controls).
- Fertiger Live-Job: alle Schritte grün, Balken Mint statt Bernstein.
- Readback-Zeile ohne Durchstreichung des Zielwerts; Meta-Grautöne T2/T3 aufgehellt;
  Diff-Tabelle Spaltenbreit + Vorher-Werte lesbar; Cap „Im Detail“ (Doppeletikett entfernt);
  T1 Budget-Pill kontrastreicher; Mengen-Feld mit Einheit „Stk“; Reserveklausel gegen Witwenbruch.
- Bauart: V3 = V2 + erweiternde Schicht (CSS-Nachtrag, HTML-Injektion, zweite IIFE mit
  Capture-Listener + Attribut-Observer). Build: build-v3.py / build-v3b.py ( reproducível ).
