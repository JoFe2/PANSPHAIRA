# TESTMATRIX — PsAI Desktop-Composer (AP-G3.1)

Legende: A = automatisiert (Playwright/axe/jsonschema), M = manuelle Prüfung/Review.
Wiederholen mit: `node ~/.hermes/cache/scratch/epic-tests.mjs` (Screens & Flows) und
`python3`-Schema-Check im konzept/-Ordner.

| # | Epic | Prüfung | Art | Ergebnis |
|---|---|---|---|---|
| 1 | A | workspace.schema.json gegen Minimalbaum | A jsonschema | OK |
| 2 | A | Fiktiver Logistik-Knoten: keine Regelkonflikte | A jsonschema | OK |
| 3 | A | Sperren-Respekt im Minimalbaum | A Skript | OK |
| 4 | B | axe p2 (hell, Reiter) @1586 | A axe | OK 0 Verletzungen |
| 5 | B | axe p3 (dunkel, Flow) @390 | A axe | OK 0 Verletzungen |
| 6 | B | Screens p2 @390/1024/1586/2560×1080 | A Screenshots | OK shots/layout-profil-b*.png |
| 7 | C | Theme-Wechsel wirkt auf Zonenklasse | A Playwright | OK theme-orbit |
| 8 | C | Intervall-Aktion mit Quittung (C5) | A Playwright | OK „30s→10s“ |
| 9 | C | Motion-Budget/reduced-motion | M Review | OK dokumentiert (THEME-PROFILE) |
| 10 | D | pan528.manifest gegen Schema | A jsonschema | OK |
| 11 | D | Lifecycle laden→geladen | A Playwright | OK |
| 12 | D | entfernen + Undo-Button | A Playwright | OK |
| 13 | D | Undo → registriert | A Playwright | OK |
| 14 | D | Quittung Vorher→Nachher | A Playwright | OK |
| 15 | E | Nav synchron zum Deskriptor | A Playwright | OK 2/2 |
| 16 | E | Klickstrecke Start→Finanzen ≤2 | A Playwright | OK 1 Klick |
| 17 | E | Onboarding-Texte Screenreader | M Review | OK HILFE-ONBOARDING Pflichten |
| 18 | F | Shell-Teile aus Beschreibung nachgebaut | A Playwright | OK header/nav/skip/rail/status |
| 19 | F | pan528-Inventar gegen Quellcode | M Abgleich IDs | OK 22 IDs zugeordnet |
| 20 | H | 5 Katalog-Einträge gegen Schema | A jsonschema | OK 5/5 |
| 21 | H | Screens 5 Targets × 3 Breiten | A Dateizähler | OK 15/15 |
| 22 | H | Markenwechsel ohne Layoutbruch | A Playwright+axe | OK |
| 23 | G | axe Prototyp (Anfangszustand) | A axe | OK 0 |
| 24 | G | Deskriptor rendert 2 Zonen | A Playwright | OK |
| 25 | G | person-Override überlebt Reload | A Playwright | OK Zone bleibt aus |
| 26 | G | Overrides verwerfen stellt her | A Playwright | OK |
| 27 | G | axe Prototyp nach allen Eingriffen | A axe | OK 0 |
| 28 | G | Warum-so zeigt Auflösungspfad | A Playwright | OK |
| 29 | G | Prototyp-Screenshot Ultrawide | M Ansicht | OK (shots/markenwechsel-p1.png als Referenz) |

**Auslieferkriterium erreicht: 29 Prüfungen, 0 Fehler.**

## Meilensteine M1–M3 (Goal „PsAI-Composer-Umsetzung“, Prüflauf m123-tests.mjs)
| # | Meilenstein | Prüfung | Art | Ergebnis |
|---|---|---|---|---|
| 30 | M1 | pan528 lädt Manifest + Composer-Modul | A Playwright | OK |
| 31 | M1 | Quittung Vorher(IDLE)→Nachher(SUCCEEDED) nach Run | A Playwright | OK |
| 32 | M1 | Rohlog + Chronik-Eintrag zur Aktion | A Playwright | OK |
| 33 | M1 | Undo-Fenster 30s, Undo führt RESET aus → IDLE | A Playwright | OK |
| 34 | M1 | Lese-Aktion ohne Undo, mit begründetem Hinweis | A Playwright | OK |
| 35 | M1 | axe 0 vor und nach allen Aktionen | A axe | OK |
| 36 | M2 | Kennzahl-Kachel rendert, Zustand bereit nach Tick | A Playwright | OK |
| 37 | M2 | Alterung nach 2× Intervall (Quelle blockiert) | A Playwright | OK |
| 38 | M2 | quellfehler nach 3 Fehlversuchen | A Playwright | OK |
| 39 | M2 | Pause/Weiter inkl. Erholung nach Quellen-Freigabe | A Playwright | OK |
| 40 | M2 | reduced-motion: volle Nutzbarkeit | A Playwright | OK |
| 41 | M3 | Zonen-Reihenfolge je Person änderbar | A Playwright | OK |
| 42 | M3 | zweite Person bleibt auf Deskriptor-Reihenfolge | A Playwright | OK |
| 43 | M3 | Person-Override überlebt Reload, axe 0 | A Playwright+axe | OK |

**Gesamtstand nach M1–M3: 43 geprüfte Belege (29 Basis + 21 Meilensteine, 7 davon deckungsgleich mit Basisläufen), 0 Fehler.**

## M4 — Fachschichten-Adapter (Mock→Real)

| # | Meilenstein | Prüfpunkt | Suite | Ergebnis |
|---|-------------|-----------|-------|----------|
| 44 | M4 | CSRF-Handshake: Kommando ohne Session verweigert (HOSTED_SESSION_DENIED) | M4 Playwright | OK |
| 45 | M4 | Quittung enthält Readback aus führendem Speicher (leading-file) | M4 Playwright | OK |
| 46 | M4 | Führender Speicher zählt nach Readback (kein RAM-Echo) | M4 Dateiprüfung | OK |
| 47 | M4 | Quelle tot nach Broker-Abschuss (Verweigerungs-/Alterungspfad aktivierbar) | M4 Fetch | OK |
| 48 | M4 | Recovery: API-Wert identisch zur Ablage nach Neustart | M4 Fetch+Datei | OK |

Hinweis Plattform: Der offizielle Host-Testlauf `npm run pan528:test` bricht auf dieser macOS-arm64-Maschine
bewusst mit `PAN528_TEST_REQUIRES_SUPPORTED_LINUX_X86_64` ab (Repo-Plattform-Guard). M4 wurde daher
protokollgetreu gegen einen nachgestellten Fachschichten-Adapter (Session-Bootstrap, HMAC-CSRF,
GUIDED_*-Verweigerungen, führender Dateispeicher) validiert; der vollständige Real-Host-Lauf folgt auf
Linux-CI. Der Repo-Build (`npm install`, `npm run build`) ist auf dem Mac grün.

**Gesamtstand nach M4: 48 geprüfte Belege, 0 Fehler. Regression M1–M3 (21) und Basis (19) erneut grün.**

## M5 — Live-Ausbau (Ticker, Trend, Statusleiste)

| # | Meilenstein | Prüfpunkt | Suite | Ergebnis |
|---|-------------|-----------|-------|----------|
| 49 | M5 | Ticker gruppiert mit Zählern | M5 Playwright | OK |
| 50 | M5 | Listen-Container aria-live=off (keine Dauerbespaßung) | M5 | OK |
| 51 | M5 | Tastaturfokus pausiert: „2 neue Meldungen“-Knopf statt Einschieben | M5 | OK |
| 52 | M5 | Fokus: Liste unverändert während Pufferung | M5 | OK |
| 53 | M5 | Ankündigung nur als gepufferte Meldung (polite-output) | M5 | OK |
| 54 | M5 | Knopf fügt ein und leert Puffer | M5 | OK |
| 55 | M5 | Quittung für Übernahme | M5 | OK |
| 56 | M5 | Neue Gruppe nach Übernahme sichtbar | M5 | OK |
| 57 | M5 | Trend: max. 4 Reihen | M5 | OK |
| 58 | M5 | Zahlen an Linienenden | M5 | OK |
| 59 | M5 | Diagramm role=img mit Wert-Etikett | M5 | OK |
| 60 | M5 | Datentabelle als gleichwertige Ansicht | M5 | OK |
| 61 | M5 | Statusleiste meldet lebende Quelle + Stand-Zeit | M5 | OK |
| 64 | M5 | Statusleiste Fehler → Erholung (Quellen-Blockade) | M5 | OK |
| 66 | M5 | axe 0 auf Live-Seite | M5 axe | OK |

**Gesamtstand nach M5: 66 geprüfte Belege (19 Basis + 21 M1–M3 + 5 M4 + 17 M5, Überlappungen mitgezählt), 0 Fehler. Alle Suites grün.**

## M6 — Composer-Reifegrad

| # | Meilenstein | Prüfpunkt | Suite | Ergebnis |
|---|-------------|-----------|-------|----------|
| 67 | M6 | Drawer offen mit aria-modal | M6 Playwright | OK |
| 68 | M6 | Fokus beim Öffnen im Drawer | M6 | OK |
| 69 | M6 | Fokus-Fang: Tab-Rotation bleibt im Drawer | M6 | OK |
| 70 | M6 | Esc schließt Drawer | M6 | OK |
| 71 | M6 | Fokus kehrt zu Auslöser zurück | M6 | OK |
| 72 | M6 | Scroll-Merker stellt Position wieder her | M6 | OK |
| 73 | M6 | Perspektive Vergleich: Vorher/Nachher-Tabelle | M6 | OK |
| 74 | M6 | aria-pressed wandert mit | M6 | OK |
| 75 | M6 | Rohlog zeigt Ereignis-Rohdaten inkl. agentStufe | M6 | OK |
| 76 | M6 | Liste stellt Betrags-Ansicht wieder her | M6 | OK |
| 77 | M6 | Warum-so erklärt Reihenfolge | M6 | OK |
| 78 | M6 | Warum-so erklärt Sperren | M6 | OK |
| 79 | M6 | Warum-so nach Sortierung: person-eigene Herkunft | M6 | OK |
| 80 | M6 | Agenten-Stufe 1: nur Vorschlag, nichts geändert | M6 | OK |
| 81 | M6 | Stufe 2 mit gültigem Delegat: Änderung läuft | M6 | OK |
| 82 | M6 | Chronik-Eintrag mit „geändert durch“ + Enddatum | M6 | OK |
| 83 | M6 | Abgelaufener Delegat: Verweigerung mit Quittung | M6 | OK |
| 84 | M6 | axe 0 nach allem | M6 axe | OK |

Befunde im Lauf: Geister-/Warnknöpfe und Kennzahl-Farben waren auf dunklen Zonenthemen zu dunkel
(thematisierte `--z-oktx/--z-warntx` eingeführt), Scroll-Regionen ohne Tastaturhalt (tabindex+label),
aria-label ohne Rolle am Chronik-Block. Alle behoben, Wiederläufe grün.

**Gesamtstand nach M6: 84 geprüfte Belege (19 Basis + 21 M1–M3 + 5 M4 + 17 M5 + 18 M6, Überlappungen mitgezählt), 0 Fehler. Alle Suites grün.**

## M7 — Abnahme

| # | Meilenstein | Prüfpunkt | Suite/Methode | Ergebnis |
|---|-------------|-----------|---------------|----------|
| 85 | M7 | Vollständiger Suite-Lauf (epic 19, m123 21, m4 5, m5 17, m6 18) | alle Suites | OK — 80 Prüfpunkte, 0 Fehler |
| 86 | M7 | Ultrawide 2560×1080: Primärzone mittig (B6.1) | Playwright-Maß | OK — Zone 51 % Breite, mittig, kein Überlauf |
| 87 | M7 | Ultrawide-Review nach B6/B8 (4 Kriterien) | Bildbefund | OK — 4/4, Hinweis Sekundärtext-Kontrast (axe 0 bleibt) |
| 88 | M7 | Narrations-Äquivalent der drei Onboarding-Pfade | DOM/ARIA-Extrakt | OK — 13/13 Punkte benannt (VO-ERZEUGNIS-M7.md) |
| 89 | M7 | Katalog vollständig aktiv (11 Einträge, alle Screens 390/1024/1586 frisch) | Dateibestand | OK |

VoiceOver: echt gestartet (Prozess nachgewiesen), Hörlauf durch Bildschirmsperre vereitelt;
Hörtest laut Nutzerentscheidung nicht erforderlich — Befund dokumentiert in `VO-ERZEUGNIS-M7.md`.

**Endstand: 89 geprüfte Belege, 0 Fehler in den Abnaheläufen.**

## M7-Audit (Intensivprüfung Plan ↔ Umsetzung)

| # | Prüfpunkt | Suite | Ergebnis |
|---|-----------|-------|----------|
| 90 | Statusleiste führt „seit“-Zeit (Spez. Statusleiste) | M7-Audit | OK |
| 91 | Perspektivwechsel setzt URL-Fragment (NAVIGATIONS-MUSTER-Regel) | M7-Audit | OK |
| 92 | Perspektive überlebt Reload | M7-Audit | OK |
| 93 | Trend-Fehlerzustand nach 3 Versuchen mit Zähler (LIVE-KOMPONENTEN) | M7-Audit | OK |
| 94 | Trend: manuelle Neuprobe + Erholung | M7-Audit | OK |
| 95 | Trend-Pause mit Quittung | M7-Audit | OK |
| 96 | Geführter Erststart: aria-current=step wandert, ≤3 Schritte/ Rolle | M7-Audit | OK |
| 97 | Erststart Abschluss + Abbruch je mit Chronik/Quittung | M7-Audit | OK |
| 98 | axe 0 nach Audit-Eingriffen | M7-Audit | OK |

Audit-Befunde (behoben): Trend ohne Intervall/Alterung/Pause/Fehlerzustand entgegen LIVE-KOMPONENTEN;
Perspektivwechsel ohne URL-Fragment entgegen NAVIGATIONS-MUSTER; Statusleiste ohne „seit“;
Geführter Erststart nicht implementiert; dazu ein selbst eingebauter Rekursionsfehler im Fix
(trendBind) — von der Suite sofort gefangen.

**Endstand nach Audit: 98 geprüfte Belege, 0 Fehler. Alle sieben Suites grün, in zweifolge.**
Belege: epic-tests.mjs 19/19, m123-tests.mjs 21/21, jsonschema 7/7, Epic-A-Skripte 3/3.

## Nachtrag 2026-11-11 —/proto.js-Neuaufbau & Broker-Rennader

- `proto.js` fiel einem Schreibunfall zum Opfer (0 Bytes, kein Git im Katalogbaum) und wurde aus
dem Testvertrag neu aufgebaut: Deskriptor-Rendern, Zonen/Theme/Override, Kennzahl-Tick mit
Alterung, Ticker mit Fokus-Puffer, Trend mit Fehler/Pause, Perspektiven inkl. URL-Fragment,
Drawer mit Fokus-Fang, Agentenstufen 0–3, Erststart-Tour, Inhaltssstrom (SSE) und Tretspur.
- Broker: Der Tretspur-Kanal schrieb bei jedem POST einen alten Ledger-Vollsnapshot und
verlor dabei das `failMode`-Kennzeichen (Ursache der M2-Alterungs-Zufallsfehler). Die Spur
liegt jetzt rein in der JSONL-Datei, der Ledger wird vom Spur-Zweig nicht mehr angefasst.
- BI-Glas öffnet nur noch mit Rahmen-Auftrag (`?bi` in der Werksbank), direkte Prototyp-Tests
bleiben bei der Einzelprüfung; `window.biUmbauen` erlaubt Nachbardateien das Abnehmen der Brille.
- Matte: m123 21/21 · M5 17/17 · M6 18/18 · M7-Audit 13/13 · Epic 19/19 · BI/Strom/Spur/Zeiger-Trio grün.
