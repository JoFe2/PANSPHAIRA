# Verbesserungskonzept — Katalog V2 (T1/T2/T3/Index)

Leitmotiv: **statisch → bedienbar**. Die Mockups zeigen Genehmigungs-UX nur als Bild.
V2 macht sie interaktiv, damit der Betrachter das Konzept erfährt statt liest.
Alle Interaktion ist rein visuell (Demo-Hinweis), API/Vokabular unverändert, axe 0 bleibt Pflicht.

## Gemeinsame Anreicherung (alle Templates)
1. **Genehmigungsfluss zum Anfassen**: Genehmigen → Karte in Entscheidungs-Zustand
   (grün/rot markiert, Buttons durch Quittungs-Ersatz + „Rückgängig“ ersetzt).
   Undo = Nielsen #9, Rückgängig-Fenster 6 s mit Countdown-Balken.
2. **Tastatur wirklich verdrahtet**: `j`/`k` Kartenfokus, `g↵` genehmigen, `gx` ablehnen,
   `?` Kürzelhilfe-Overlay, `Esc` schließen. Shortcuts sind Zweitweg, nie Einziger.
3. **⌘K-Palette funktionsfähig** (Demo): Filtern über Vorgänge und Navigationssprünge.
4. **Fokusfalle Dialog**, aria-live-Feedback pro Entscheidung, reduced-motion respektiert.
5. **Progress animiert** bis 62 % (einmalig, dann ruhend), Schrittliste 3/5 sichtbar.

## T1 Arbeitsprofil (Carbon-nah)
- Inline-Validierung am Ablehnen-Dialog (Grund Pflicht, 2 Klicks weniger als Modal).
- Sidepanel „Verlauf & Readback“ (Carbon-Side-Panel-Muster) statt nur Fußnoten-Links.
- Budget-Pill mit Mini-Balken; dichte Meta-Zeilen mit Labels.
- Motion: Carbon-typisch 110 ms linear, fast keine Schatten.

## T2 Nachtwache (Ops-Dunkel)
- **Queue-Kommandoleiste**: [Genehmige alle risikoarmen] [Fokus nächste] — Leitstand-Tempo.
- Linkes Nav mit Zählern je Modulgruppe; Warnzähler amber pulsierend (reduced-motion: statisch).
- Readback-Block direkt in der Karte nach Genehmigung (Vorher→Nachher-Pfeil, Bernstein→Mint).
- Footer-Status blinkt kurz bei Ereignis (role=status), Fortschritt mit Glow-Kante.
- Motion: 140 ms ease-out, Glow nur an Handlungsakzenten.

## T3 Redaktionell (Impeccable-Ruhe)
- **Wirkungssatz als Typo-Highlight**: Vorher→Nachher als große Serifenzeile in der Karte.
- Zeit-Leselinie im Aside (Quittungen als Chronik mit Datumsanker) statt Listenpunkte.
- Begründungs-Absatz beim Ablehnen (Serif-Textarea, Impeccable: Text zuerst).
- Motion: sanft 220 ms ease, nur Deckkraft/Opacity, keine Schatten — Ruhe bleibt Regel.

## Index V2
- V1↔V2-Umschalter für die Iframes; Pro-Contra-Kurzbewertung pro Template;
  Versionshistorie; Verweis auf V2-Shots.

## Abhakliste (Pflicht vor Auslieferung)
- [x] jede Datei hat ≥1 echte UX-Verbesserung gegenüber V1
- [x] axe 0 Verletzungen auf allen vier V2-Seiten
- [x] Playwright-Interaktion: j/k/g↵/⌘K/Undo nachgewiesen (T2 komplett; T1/T3 Klick+Chord+Validierung)
- [x] Screenshots V2 + Index-V2 in shots/ (t1-v2, t2-v2, t3-v2, katalog-v2-oben/unten)
- [x] V1 unverändert; Katalog-Version auf 2 gehoben

## Nach der Bildabnahme korrigiert (Vision-Audit)
- T2: Schrittsegments auf Grid umgestellt (saubere Fünftel), Meta-Grauton aufgehellt (#93a5b5),
  Statuszeile der laufenden Karte teil-aufgehellt; `&lt;` war bereits korrekt escaped.
- T1: Side-Panel von Overlay auf **Push** umgebaut (Header/Footer/Main padding-right) —
  kein Clipping mehr; Pixelbeweis main.right 960 ≤ panel.left 1280. Zeit-Grauton verdichtet.
- Hinweis: ⌘K und g-Chord funktionieren gegen echte Tastatureingaben; synthetische
  KeyboardEvents ohne trusted-Flag wurden als Testartefakt verworfen.
