# PsAI Desktop-Composer — Detailplanung mit Teilaufgaben

Stand: 10.11.2026 · Version final · Alle Epics in umsetzbare Arbeitspakete zerlegt

Prinzip: Jedes Arbeitspaket ist so klein, dass es an einem halben Tag konzeptionell
durcharbeitbar ist. Tests werden nur dort aufwendig, wo eine größere Einheit steht.
Kleine Pakete werden durch Review belegt, nicht durch automatisierte Tests.

---

## Epic A — Begriffe & Baummodell (5 Issues → 9 Arbeitspakete)

### Issue A-1: Glossar schreiben
**AP-A1.1** Grundbegriffe definieren (Workspace, Zone, Panel, Modulbaustein, Viewlet, Overlay)
→ Artefakt: Abschnitt 1 in GLOSSAR.md
→ Test: Manuelle Durchsicht — widerspricht kein Begriff einem anderen?

**AP-A1.2** Abgrenzungen klären (Icon vs. Kachel vs. Reiter; Navigationsziel vs. Inhalt)
→ Artefakt: Abschnitt 2 in GLOSSAR.md
→ Test: Manuelle Durchsicht

**AP-A1.3** Delegation und Eigentümerklassen benennen
→ Artefakt: Abschnitt 3 in GLOSSAR.md
→ Test: Manuelle Durchsicht

### Issue A-2: workspace.json Schema entwerfen
**AP-A2.1** Knotentypen und Basisfelder im Schema beschreiben
→ Artefakt: workspace.schema.json (erster Entwurf)
→ Test: jsonschema-Validierung gegen Minimalbeispiel

**AP-A2.2** Options-Overrides und Sperren als Felder ergänzen
→ Artefakt: Schema-Erweiterung
→ Test: Validierung + Beispielknoten mit Sperre

### Issue A-3: Warum-so-Metadaten definieren
**AP-A3.1** Auflösungsregeln pro Eigenschaftsklasse dokumentieren
→ Artefakt: Abschnitt im Schema + Beispiele
→ Test: Fünf fiktive Eigenschaften manuell auflösen

### Issue A-4: Minimalbeispiel bauen
**AP-A4.1** Minimalbaum aus KONFIGURATIONSBAUM.md als JSON-Deskriptor schreiben
→ Artefakt: beispiele/workspace.minimal.json
→ Test: Schema-Validierung

### Issue A-5: Evolutionär-Pfad festzurren
**AP-A5.1** Freigabe-Matrix für drei Stufen erstellen
→ Artefakt: FREIGABE-MATRIX.md
→ Test: Manuelle Durchsicht

### Epic-A-Gesamttest
Schema validiert gegen Minimalbeispiel. Fiktiver Bereich „Logistik" lässt sich ohne
Regelkonflikt einsetzen. → Ein Review-Durchlauf genügt.

---

## Epic B — Layout & Zonen (6 Issues → 10 Arbeitspakete)

### Issue B-1: Raster-Typen katalogisieren
**AP-B1.1** Sidebar+Content+Rail, Kachel-Grid, Karten-Stack dokumentieren
→ Artefakt: LAYOUT-KATALOG.md Abschnitt 1–3
→ Test: Zuordnung zu pan528/P-SHELL prüfen

**AP-B1.2** Split, Reiter-Stapel, Overlay-Ebene dokumentieren
→ Artefakt: LAYOUT-KATALOG.md Abschnitt 4–6
→ Test: Zuordnung prüfen

**AP-B1.3** Freie Leinwand (Ultrawide) dokumentieren
→ Artefakt: LAYOUT-KATALOG.md Abschnitt 7
→ Test: Zuordnung prüfen

### Issue B-2: Zonen-Typen definieren
**AP-B2.1** Sieben Zonentypen mit Anker, Einklapp-Verhalten, Mindestbreite beschreiben
→ Artefakt: LAYOUT-KATALOG.md Abschnitt Zonen
→ Test: Pan528-Elemente den Zonen zuordnen

### Issue B-3: Responsive-Strategie pro Zone
**AP-B3.1** Verhalten für 390/1024/1586/Ultrawide dokumentieren
→ Artefakt: Tabelle in LAYOUT-KATALOG.md
→ Test: Screenshot-Vergleich auf vier Breiten

### Issue B-4: Overlay-vs-Seite-Entscheidungsbaum
**AP-B4.1** Entscheidungsbaum mit Flussdiagramm erstellen
→ Artefakt: OVERLAY-ENTSCHEIDUNG.md
→ Test: Drei reale Fälle durchspielen

### Issue B-5: Design-Mosaik-Regeln
**AP-B5.1** Koexistenzregeln, Token-Basis, Übergänge, A11y-Grenzen dokumentieren
→ Artefakt: MOSAIK-REGELN.md
→ Test: Pulse + Essential Kombination manuell prüfen

### Issue B-6: Ultrawide-Profil
**AP-B6.1** Spezifisches Verhalten auf 21:9/32:9 dokumentieren
→ Artefakt: Abschnitt in LAYOUT-KATALOG.md
→ Test: Screenshots auf 2560×1080

### Epic-B-Gesamttest
Screenshot-Vergleich auf 390/1024/1586/2560×1080. axe-core auf allen Layout-Kombinationen.
→ Ein automatisierter Testlauf.

---

## Epic C — Design & Themes (5 Issues → 8 Arbeitspakete)

### Issue C-1: Token-Architektur vereinheitlichen
**AP-C1.1** Core → Semantic → Component Schichten dokumentieren
→ Artefakt: TOKEN-ARCHITEKTUR.md
→ Test: Bestehende --ps-* Tokens den Schichten zuordnen

### Issue C-2: Theme-Profile dokumentieren
**AP-C2.1** Fünf Theme-Profile mit Farbwerten, Typo, Icons, Motion, Dichte dokumentieren
→ Artefakt: THEME-PROFILE.md
→ Test: Theme-Wechsel auf Beispielseite manuell prüfen

### Issue C-3: Komponenten-Kit ableiten
**AP-C3.1** Statische Komponenten (Button, Badge, Card, Table, Tabs, Drawer, Toast, Empty-State, Skeleton)
→ Artefakt: KOMPONENTEN-LISTE.md Abschnitt 1
→ Test: Zustände manuell durchgehen

**AP-C3.2** Live-Komponenten (Chart, Ticker, Kennzahl, Statusleiste)
→ Artefakt: KOMPONENTEN-LISTE.md Abschnitt 2
→ Test: Fehlerzustand simulieren

### Issue C-4: Motion-Prinzipien
**AP-C4.1** Regeln für erlaubte Bewegung, reduced-motion, Performance-Budgets dokumentieren
→ Artefakt: Abschnitt in THEME-PROFILE.md
→ Test: Reduced-Motion-Pfad manuell aktivieren

### Issue C-5: Live-Komponenten spezifizieren
**AP-C5.1** Vier Live-Komponenten mit Datenform, Intervall-Optionen, Alterungsanzeige, Pause/Resume, Fehlerzustand spezifizieren
→ Artefakt: LIVE-KOMPONENTEN.md
→ Test: Fehlerinjektion auf einer Komponente

### Epic-C-Gesamttest
axe-core auf Theme-Wechsel-Beispielen. Motion-Performance Audit. Fehlerzustand bei
Live-Quellenausfall. → Ein kombinierter Testlauf.

---

## Epic D — Modul-/Plugin-System (6 Issues → 10 Arbeitspakete)

### Issue D-1: Modul-Manifest Schema
**AP-D1.1** Basisfelder (id, titel, icon, datenquellen, aktionen, rechten) im Schema
→ Artefakt: modul-manifest.schema.json (erster Entwurf)
→ Test: Schema-Validierung gegen pan528-Manifest

**AP-D1.2** Layout-Hinweise, Mitliefer-Template, Optionen ergänzen
→ Artefakt: Schema-Erweiterung
→ Test: Validierung + Beispiel

### Issue D-2: Slot-Katalog
**AP-D2.1** Sechs Slots (Nav, Home-Kachel, Detail-Panel, Overlay-Inhalt, Statusleiste, Chronik) dokumentieren
→ Artefakt: SLOT-KATALOG.md
→ Test: pan528-Slots zuordnen

### Issue D-3: Datenadapter-Modell
**AP-D3.1** Vier Adaptertypen (REST, CSV, Mock, Event-Stream) mit Readback-/Statusmodell beschreiben
→ Artefakt: ADAPTER-MODELL.md
→ Test: Adapter-Auswahl für pan528 prüfen

### Issue D-4: Aktionen & Quittungen
**AP-D4.1** Deklarative Aktionen, erwarteter Effekt, Vorher/Nachher, Undo, Rohlog dokumentieren
→ Artefakt: AKTIONEN-QUITTUNG.md
→ Test: Eine Aktion manuell durchspielen

### Issue D-5: Delegation & Agentenrechte präzisieren
**AP-D5.1** Eigentümerklassen, Rechtearten, Gültigkeit, Protokollierung, Rollback dokumentieren
→ Artefakt: DELEGATION-MODELL.md
→ Test: Agent-Rechte manuell prüfen

### Issue D-6: Beispielmanifest pan528
**AP-D6.1** pan528 als Modul „Eingangsrechnungen" mit zwei Slots und Optionen als Manifest
→ Artefakt: beispiele/pan528.manifest.json
→ Test: Schema-Validierung

### Epic-D-Gesamttest
Manifest-Validierung. Playwright-Flow: Modul registrieren/laden/aktualisieren/entfernen.
Quittungs-Test: Aktion ausführen → Vorher/Nachher/Rohlog korrekt.
→ Ein automatisierter Testlauf.

---

## Epic E — Interaktion & Komfort (5 Issues → 7 Arbeitspakete)

### Issue E-1: Navigation & Wege
**AP-E1.1** Primärpfade, Sekundärpfade (⌘K), Tastaturkürzel, Zurückpfade dokumentieren
→ Artefakt: NAVIGATIONS-MUSTER.md Abschnitt 1
→ Test: Kurzprüfung der Vollständigkeit

### Issue E-2: Perspektiven statt starrer Seiten
**AP-E2.1** Liste, Karte, Timeline, Vergleich, Rohlog auf selben Daten dokumentieren
→ Artefakt: NAVIGATIONS-MUSTER.md Abschnitt 2
→ Test: Perspektive-Wechsel auf pan528 prüfen

### Issue E-3: Quittungsprinzip durchziehen
**AP-E3.1** Grün nur für Bewiesenes; Undo-Fenster; Rohlog-Zugang dokumentieren
→ Artefakt: Abschnitt in AKTIONEN-QUITTUNG.md
→ Test: Quittungsformat für pan528 prüfen

### Issue E-4: Hilfe & Onboarding
**AP-E4.1** Kontexthilfe (?), geführter Erststart, Tooltip-Grenzen dokumentieren
→ Artefakt: HILFE-ONBOARDING.md
→ Test: Onboarding-Flow manuell durchlaufen

### Issue E-5: Agentische Assistenz
**AP-E5.1** Vorschläge, Erklärung von Änderungen, Grenzen, Abstufung dokumentieren
→ Artefakt: AGENTEN-ASSISTENZ.md
→ Test: Agent zeigt Vorschlag → ändert nichts automatisch

### Epic-E-Gesamttest
Playwright: Onboarding-Flow für drei Rollen. Screenreader-Stichprobe.
Agent-Grenztest. → Ein kombinierter Testlauf.

---

## Epic F — Realitätsabgleich (4 Issues → 5 Arbeitspakete)

### Issue F-1: pan528 inventarisieren
**AP-F1.1** Elemente → Zone/Modul/Datenquelle abbilden; Umschreibbedarf klären
→ Artefakt: PAN528-INVENTAR.md
→ Test: Inventar gegen Quellcode abgleichen

### Issue F-2: Shell extrahieren
**AP-F2.1** Header/Nav/Footer/Assistent aus P-Seiten als wiederverwendbare Hülle beschreiben
→ Artefakt: SHELL-BESCHREIBUNG.md
→ Test: Beschreibung ermöglicht Nachbau ohne Originalcode

### Issue F-3: Migrationspfad skizzieren
**AP-F3.1** Schritt 1: Layout-Festlegung je Profil; Schritt 2: Modulmanifeste; Schritt 3: person-Scope
→ Artefakt: MIGRATIONSPFAD.md
→ Test: Meilensteine messbar formuliert

### Issue F-4: Risiken & Gegenmaßnahmen
**AP-F4.1** Überkonfiguration, Performance, Testbarkeit, A11y, Template-Konflikte dokumentieren
→ Artefakt: Abschnitt in MIGRATIONSPFAD.md
→ Test: Jede Risiko hat Gegenmaßnahme

### Epic-F-Gesamttest
Umstellungsbeschreibung für pan528 manuell prüfen. Shell-Nachbau aus Beschreibung.
→ Ein Review-Durchlauf.

---

## Epic H — Produktkatalog & Vorlagen-Pipeline (5 Issues → 7 Arbeitspakete)

### Issue H-1: Katalog-Eintrag Schema
**AP-H1.1** Schema mit Version, Optionen, Screenshots, Beispiel-Deskriptor, Lizenz, Kanon-Check
→ Artefakt: katalog-eintrag.schema.json
→ Test: Schema-Validierung gegen fünf Referenzen

### Issue H-2: Vorlagen-Pipeline definieren
**AP-H2.1** Wann wird katalogisiert? Wer pflegt Varianten?
→ Artefakt: VORLAGEN-PIPELINE.md
→ Test: Pipeline an einem Beispiel durchspielen

### Issue H-3: PanSphaira-Dezenz operationalisieren
**AP-H3.1** Marken-Token-Slots, Austauschbarkeit, Referenz-Brand dokumentieren
→ Artefakt: Abschnitt in THEME-PROFILE.md
→ Test: Logo/Name geändert → keine Layoutbrüche

### Issue H-4: PsAI-Kanon-Checkliste
**AP-H4.1** Ehrlichkeit, Quittung, Optionalität, Nur-lesen-Grenze, Redlichkeit der Daten
→ Artefakt: KANON-CHECKLISTE.md
→ Test: Checkliste für jeden Eintrag ausgefüllt

### Issue H-5: Fünf Referenzeinträge
**AP-H5.1** T1/T2/T3, pan528, P-SHELL als erste Katalogobjekte
→ Artefakt: katalog/*.json
→ Test: Schema-Validierung für alle fünf

### Epic-H-Gesamttest
Schema-Validierung für alle Referenzeinträge. Markenwechsel-Test. Kanon-Check vollständig.
→ Ein kombinierter Testlauf.

---

## Epic G — Prototyp & Validierung (4 Issues → 6 Arbeitspakete)

### Issue G-1: Statischer Composer-Prototyp
**AP-G1.1** HTML/CSS/ES; rendert workspace.json; Theme-Umschalter; Slots sichtbar
→ Artefakt: prototyp/index.html
→ Test: Prototyp lädt und rendert Minimalbaum

### Issue G-2: Interaktiver Kern
**AP-G2.1** Zone zu/aus, Theme wechseln, Modul binden, Layout speichern/laden
→ Artefakt: Prototyp-Erweiterung
→ Test: Playwright-Kernweg „Theme wechseln"

### Issue G-3: Testmatrix
**AP-G3.1** axe-core auf Musterkombinationen; Playwright-Kernwege; Screenreader-Stichproben
→ Artefakt: TESTMATRIX.md
→ Test: Alle axe-Tests bestehen ohne Verletzungen

### Issue G-4: Aufgaben-Review
**AP-G4.1** Je Rolle drei Alltagsaufgaben; Klickstrecke, Fehlerquote, Lerneffekt messen
→ Artefakt: VALIDIERUNGSBERICHT.md
→ Test: Klickstrecken <5 für Standardaufgaben

### Epic-G-Gesamttest
axe-core auf Prototyp (0 Verletzungen). Playwright: Kernweg ohne Fehler.
Aufgaben-Review: quantitative Messungen dokumentiert.
→ Ein automatisierter + ein manueller Testlauf.

---

## Übersicht: Arbeitspakete nach Epic

| Epic | Issues | Arbeitspakete | Gesamttest |
|------|--------|---------------|------------|
| A | 5 | 9 | Schema-Validierung + Review |
| B | 6 | 10 | Screenshot-Vergleich + axe-core |
| C | 5 | 8 | axe-core + Motion-Audit + Fehlerinjektion |
| D | 6 | 10 | Schema-Validierung + Playwright-Flow |
| E | 5 | 7 | Playwright + Screenreader + Agent-Grenztest |
| F | 4 | 5 | Manuelle Prüfung + Shell-Nachbau |
| H | 5 | 7 | Schema-Validierung + Markenwechsel-Test |
| G | 4 | 6 | axe-core + Playwright + quantitative Messung |
| **Summe** | **40** | **62** | **8 Epic-Gesamttets** |

---

## Teststrafe nach Paketgröße

| Paketgröße | Testmethode | Aufwand |
|------------|-------------|---------|
| ≤ 1 Stunde | Review / Durchsicht | minimal |
| 1–4 Stunden | Manueller Funktionstest | gering |
| > 4 Stunden | Automatisierter Test | mittel |
| Epic-Gesamt | Kombinierte Testmatrix | hoch |

Kleine Pakete werden durch Review belegt. Größere Einheiten bekommen automatisierte Tests.
Der Epic-Gesamttest beweist das Gesamtergebnis.

---

## Reihenfolge der Umsetzung

1. **A** (Grundlage für alles)
2. **B** (Layout bestimmt Module)
3. **C** (Design hängt an Layout)
4. **D** (Module brauchen Layout + Design)
5. **E** (Interaktion braucht Module)
6. **F** (Realitätscheck vor Implementierung)
7. **H** (Katalog begleitet alle Epics)
8. **G** (Prototyp beweist alles am Schluss)

Jedes Epic endet mit einem Review und dem Epic-Gesamttest. Danach geht es weiter.
Die finale Abnahme erfolgt nach Epic G mit dem Validierungsbericht.
