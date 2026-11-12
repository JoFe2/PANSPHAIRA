# PsAI Desktop-Composer — Vollständiges Konzept (Final)

Stand: 10.11.2026 · Version final · Alle Epics ausgearbeitet, mit Definition of Done und Testbelegen

Dieses Dokument enthält das vollständig ausgearbeitete Konzept für den PsAI Desktop-Composer.
Es folgt dem Leitfaden-und-Arbeitsplan.md und behandelt jedes Epic als eigenständige Konzeptionseinheit.
Jedes Aufgabenpaket wird durch eine **Definition of Done** abgeschlossen, die belegt, dass es funktioniert.

---

## Grundprinzipien (unveränderlich)

P1 — **Drei-Schichten-Trennung:** Layout / Design / Daten-Funktion bleiben getrennt beschreibbar.
P2 — **Konfigurationsbaum statt starrer Scopes:** Jeder Knoten kann Eigentümer, Optionen, Sperren
     und Vorlagen tragen; Bäume wachsen pro Mandant unterschiedlich.
P3 — **Optionalität vor Weglassung:** Fast alles ist an/aus/rollenabhängig konfigurierbar.
P4 — **Design-Mosaik first-class:** Verschiedene Designs nebeneinander im selben Workspace sind Normalfall.
P5 — **Ultra-Wide-Leinwand als Leitbild:** Alle Konzepte müssen auf freien, großen Flächen funktionieren.
P6 — **Live-Daten sind Bürger erster Klasse:** Module bringen Intervalle mit; Alterung/Fehler sichtbar.
P7 — **Agenten sind delegierbare Eigentümer:** optional, protokolliert, nie ungefragt umbauend.
P8 — **Neutraler Produktkatalog:** PanSphaira dezent; jede Oberfläche wird zur wiederverwendbaren Vorlage.
P9 — **Ehrlichkeit schlägt Erfolgsmeldung:** Quittungen, Undo, Rohlog, grüne Zustände nur bei Bewiesenes.
P10 — **Kein Framework-Zwang:** Vanilla ES als Referenzpfad; Erweiterbarkeit bleibt offen.

---

## Epic A — Begriffe & Baummodell

### Ziel
Eine belastbare gemeinsame Sprache und ein maschinenlesbares Kernschema.

### Issues

**A-1 Glossar schreiben**
Begriffe: Workspace, Zone, Panel, Modulbaustein, Viewlet, Overlay, TabGroup, DataSource, Action, Rolle, Option, Knoten, TemplateRef, Delegation, Sperre.
Abgrenzungen: Icon vs. Kachel vs. Reiter; Navigationsziel vs. Inhalt vs. Umschalter.
→ Artefakt: `GLOSSAR.md`

**A-2 workspace.json Schema entwerfen**
JSON-Schema für den Konfigurationsbaum inkl. Knotentypen, Options-Overrides, Sperren, Delegationen.
Versionierungsfeld + Migrationsregeln.
→ Artefakt: `workspace.schema.json`

**A-3 „Warum-so"-Metadaten definieren**
Auflösungserklärung: Knotenpfad, Regel, Eigentümer, Sperre. Speicherung im Deskriptor.
→ Artefakt: Abschnitt im Schema + Beispielblock

**A-4 Minimalbeispiel bauen**
Der in KONFIGURATIONSBAUM.md skizzierte Minimalbaum als vollständiger Deskriptor.
→ Artefakt: `beispiele/workspace.minimal.json`

**A-5 Evolutionär-Pfad festzurren**
Freigabe-Matrizen für Stufen kuratiert / mitbestimmt / frei.
→ Artefakt: `FREIGABE-MATRIX.md`

### Definition of Done
- [ ] Glossar vollständig und widerspruchsfrei
- [ ] JSON-Schema validiert gegen Minimalbeispiel
- [ ] Warum-so-Ansicht zeigt vollständigen Pfad für mindestens 5 Beispieleigenschaften
- [ ] Freigabe-Matrix deckt alle drei Stufen ab

### Testbeleg
Schema-Validierung gegen `beispiele/workspace.minimal.json` mit jsonschema-Bibliothek.
Manuelle Prüfung: Fiktiver Bereich „Logistik" lässt sich ohne Regelkonflikt einsetzen.

---

## Epic B — Layout & Zonen

### Ziel
Ein Katalog tragender Layoutmuster, die sich vom Handy bis zur Ultra-Wide-Leinwand skalieren.

### Issues

**B-1 Raster-Typen katalogisieren**
Sidebar+Content+Rail, Kachel-Grid, Karten-Stack, Split, Reiter-Stapel, Overlay-Ebene, freie Leinwand.
Je Typ: ASCII-Skizze, Mindestbreiten, Fokusreihenfolge, Breakpoint-Verhalten.
→ Artefakt: `LAYOUT-KATALOG.md`

**B-2 Zonen-Typen definieren**
Navigation, Startbereich, Fachdaten, Chronik, Assistent, Filter, Status.
Je Zone: Anker, Einklapp-Verhalten, Mindestbreite, erlaubte Inhalte.
→ Artefakt: Abschnitt in `LAYOUT-KATALOG.md`

**B-3 Responsive-Strategie pro Zone**
Verhalten priorisiert/gestapelt/verschoben/ausgeblendet für 390/1024/1586/Ultrawide.
→ Artefakt: Tabelle in `LAYOUT-KATALOG.md`

**B-4 Overlay-vs-Seite-Entscheidungsbaum**
Kriterien: Kontextverlust, Parallelität, Rückkehrpfad, Rollenfreigabe.
→ Artefakt: `OVERLAY-ENTSCHEIDUNG.md` mit Flussdiagramm

**B-5 Design-Mosaik-Regeln**
Koexistenz von Pulse + Essential + Notebook in einem Workspace.
Gemeinsame Token-Basis, Oberflächen-Trennung, Übergänge, A11y-Grenzen.
→ Artefakt: `MOSAIK-REGELN.md`

**B-6 Ultrawide-Profil**
Spezifisches Verhalten auf 21:9/32:9: Zonenanker, Kachelgröße, Auge-Tracking-Aspekte.
→ Artefakt: Abschnitt in `LAYOUT-KATALOG.md`

### Definition of Done
- [ ] Jeder pan528-/P1–P5-Bestandteil hat ein zuordenbares Layout
- [ ] Neues Modul findet ohne Diskussion seinen Platz (Slot-Katalog konsistent)
- [ ] Alle Breakpoints dokumentiert und mit Skizzen hinterlegt
- [ ] Mosaik-Regeln enthalten klare A11y-Grenzen

### Testbeleg
Layout-Zuordnung für pan528 und P1–P5-SHELL dokumentiert.
Playwright-Test: Screenshot-Vergleich auf 390/1024/1586/2560×1080.
A11y-Check: axe-core auf allen Layout-Kombinationen.

---

## Epic C — Design & Themes

### Ziel
Eine konsistente, aber austauschbare Design-Schicht mit Live-Komponenten.

### Issues

**C-1 Token-Architektur vereinheitlichen**
Core → Semantic → Component; Mapping der bestehenden `--ps-*` Tokens.
→ Artefakt: `TOKEN-ARCHITEKTUR.md`

**C-2 Theme-Profile dokumentieren**
Essential 2D, Pulse, Notebook, Orbit, Insight: Farbwerte, Typo, Icons, Motion, Dichte.
→ Artefakt: `THEME-PROFILE.md`

**C-3 Komponenten-Kit ableiten**
Button, Badge, Card, Table, Tabs, Drawer, Toast, Empty-State, Skeleton, Chart, Ticker, Kennzahl, Statusleiste.
Zustände: Standard, Hover, Fokus, Disabled, Loading, Fehler, Alternd.
→ Artefakt: `KOMPONENTEN-LISTE.md`

**C-4 Motion-Prinzipien**
Wann Bewegung erlaubt ist; reduced-motion; Performance-Budgets.
→ Artefakt: Abschnitt in `THEME-PROFILE.md`

**C-5 Live-Komponenten spezifizieren**
Kennzahl-Kachel, Ticker-Zeile, Trend-Liniendiagramm, Statusleiste.
Datenform, Intervall-Optionen, Alterungsanzeige, Pause/Resume, Fehlerzustand.
→ Artefakt: `LIVE-KOMPONENTEN.md`

### Definition of Done
- [ ] Designer kann neues Theme bauen, ohne Layout/Modulsystem anzupassen
- [ ] Alle Komponenten haben dokumentierte Zustände
- [ ] Live-Komponenten haben definierte Fehlerzustände
- [ ] Reduced-motion-Pfad für alle Animationen vorhanden

### Testbeleg
axe-core auf Theme-Wechsel-Beispielen.
Motion-Performance: Lighthouse/DevTools Audit auf 60fps.
Fehlerzustand: Simulierter Ausfall einer Live-Quelle → Komponente zeigt korrekten Zustand.

---

## Epic D — Modul-/Plugin-System

### Ziel
Ein Vertrag, nach dem sich jedes Modul — auch externe oder agentische — einklinkt.

### Issues

**D-1 Modul-Manifest Schema**
id, titel, icon, datenquellen, aktionen, rechten, layout-Hinweise, Mitliefer-Template, Optionen.
→ Artefakt: `modul-manifest.schema.json`

**D-2 Slot-Katalog**
Nav, Home-Kachel, Detail-Panel, Overlay-Inhalt, Statusleiste, Chronik-Eintrag.
Je Slot: Größe, Priorität, Lifecycle, A11y-Erwartungen.
→ Artefakt: `SLOT-KATALOG.md`

**D-3 Datenadapter-Modell**
REST, CSV, Mock, Event-Stream; einheitliches Readback-/Statusmodell.
→ Artefakt: `ADAPTER-MODELL.md`

**D-4 Aktionen & Quittungen**
Deklarative Aktionen; erwarteter Effekt; Vorher/Nachher; Undo; Rohlog-Link.
→ Artefakt: `AKTIONEN-QUITTUNG.md`

**D-5 Delegation & Agentenrechte präzisieren**
Eigentümerklassen, Rechtearten, Gültigkeit, Protokollierung, Rollback.
→ Artefakt: Abschnitt in `DELEGATION-MODELL.md`

**D-6 Beispielmanifest pan528**
pan528 als Modul „Eingangsrechnungen" mit zwei Slots und Optionen.
→ Artefakt: `beispiele/pan528.manifest.json`

### Definition of Done
- [ ] Drittanbieter-Modul kann anhand Schema + Slot-Katalog + Beispiel eigenes Manifest schreiben
- [ ] pan528-Manifest validiert gegen Schema
- [ ] Adapter-Modell deckt alle vier Quelltypen ab
- [ ] Quittungsformat für alle Aktionstypen dokumentiert

### Testbeleg
Manifest-Validierung mit jsonschema.
Playwright-Flow: pan528-Modul registrieren, laden, aktualisieren, entfernen.
Quittungs-Test: Aktion ausführen → Vorher/Nachher/Rohlog korrekt.

---

## Epic E — Interaktion & Komfort

### Ziel
Die Bediensysteme, die aus einem konfigurierbaren Framework ein gutes Produkt machen.

### Issues

**E-1 Navigation & Wege**
Primärpfade, Sekundärpfade (⌘K), Tastaturkürzel, Zurückpfade.
→ Artefakt: `NAVIGATIONS-MUSTER.md`

**E-2 Perspektiven statt starrer Seiten**
Liste, Karte, Timeline, Vergleich, Rohlog auf selben Daten.
→ Artefakt: Abschnitt in `NAVIGATIONS-MUSTER.md`

**E-3 Quittungsprinzip durchziehen**
Grün nur für Bewiesenes; Undo-Fenster; Rohlog-Zugang.
→ Artefakt: Abschnitt in `AKTIONEN-QUITTUNG.md`

**E-4 Hilfe & Onboarding**
Kontexthilfe (?), geführter Erststart, Tooltip-Grenzen.
→ Artefakt: `HILFE-ONBOARDING.md`

**E-5 Agentische Assistenz**
Vorschläge, Erklärung von Änderungen, Grenzen, Abstufung (nur anzeigen / vorschlagen / ändern).
→ Artefakt: `AGENTEN-ASSISTENZ.md`

### Definition of Done
- [ ] Neuer Nutzer versteht Umbau + Undo in ≤3 Minuten
- [ ] Alle Shortcuts dokumentiert und getestet
- [ ] Onboarding-Pfad für drei Rollen durchgespielt
- [ ] Agentische Assistenz hat klare Grenzen (nie ungefragt umbauen)

### Testbeleg
Playwright: Onboarding-Flow für Admin/Sachbearbeiter/Prüfer.
Screenreader-Stichprobe: Onboarding-Hilfetexte verständlich.
Agent-Test: Vorschlag angezeigt → Änderung nicht automatisch ausgeführt.

---

## Epic F — Realitätsabgleich mit Bestand

### Ziel
Sicherstellen, dass das Konzept am echten Bestand anschlussfähig ist.

### Issues

**F-1 pan528 inventarisieren**
Elemente → Zone/Modul/Datenquelle abbilden; Umschreibbedarf klären.
→ Artefakt: `PAN528-INVENTAR.md`

**F-2 Shell extrahieren**
Header/Nav/Footer/Assistent aus P-Seiten als wiederverwendbare Hülle beschreiben.
→ Artefakt: `SHELL-BESCHREIBUNG.md`

**F-3 Migrationspfad skizzieren**
Schritt 1: Layout-Festlegung je Profil; Schritt 2: Modulmanifeste; Schritt 3: person-Scope.
→ Artefakt: `MIGRATIONSPFAD.md`

**F-4 Risiken & Gegenmaßnahmen**
Überkonfiguration, Performance, Testbarkeit, A11y, Template-Konflikte.
→ Artefakt: Abschnitt in `MIGRATIONSPFAD.md`

### Definition of Done
- [ ] Für pan528 liegt konkrete Umstellungsbeschreibung vor
- [ ] Shell-Beschreibung ermöglicht Nachbau ohne P-Seiten
- [ ] Migrationspfad hat messbare Meilensteine
- [ ] Risiken haben benannte Gegenmaßnahmen

### Testbeleg
Umstellungsbeschreibung für pan528 manuell prüfen.
Shell-Nachbau: Header/Nav/Footer aus Beschreibung ohne Originalcode reproduzierbar.

---

## Epic H — Produktkatalog & Vorlagen-Pipeline

### Ziel
Jeder fertige Baustein wird sofort wiederverwendbar und auffindbar.

### Issues

**H-1 Katalog-Eintrag Schema**
Version, Optionen, Screenshots (390/1024/1586), Beispiel-Deskriptor, Lizenz, Kanon-Check.
→ Artefakt: `katalog-eintrag.schema.json`

**H-2 Vorlagen-Pipeline definieren**
Wann wird eine Oberfläche katalogisiert? Wer pflegt Varianten?
→ Artefakt: `VORLAGEN-PIPELINE.md`

**H-3 PanSphaira-Dezenz operationalisieren**
Marken-Token-Slots, Austauschbarkeit, Referenz-Brand.
→ Artefakt: Abschnitt in `THEME-PROFILE.md`

**H-4 PsAI-Kanon-Checkliste**
Ehrlichkeit, Quittung, Optionalität, Nur-lesen-Grenze, Redlichkeit der Daten.
→ Artefakt: `KANON-CHECKLISTE.md`

**H-5 Fünf Referenzeinträge**
T1/T2/T3, pan528, P-SHELL als erste Katalogobjekte.
→ Artefakt: `katalog/*.json`

### Definition of Done
- [ ] Katalog enthält reale, nutzbare Objekte (keine leeren Hülsen)
- [ ] Pipeline dokumentiert, wer wann katalogisiert
- [ ] Kanon-Checkliste bei jedem Eintrag bestanden
- [ ] Marken-Token-Slot austauschbar getestet

### Testbeleg
Schema-Validierung für alle fünf Referenzeinträge.
Markenwechsel-Test: Logo/Name geändert → keine Layoutbrüche.
Kanon-Check: Checkliste für jeden Eintrag ausgefüllt.

---

## Epic G — Prototyp & Validierung

### Ziel
Nachweis, dass A–H zusammen funktionieren.

### Issues

**G-1 Statischer Composer-Prototyp**
HTML/CSS/ES; rendert workspace.json; Theme-Umschalter; Slots sichtbar.
→ Artefakt: `prototyp/index.html` + Beschreibung

**G-2 Interaktiver Kern**
Zone zu/aus, Theme wechseln, Modul binden, Layout speichern/laden.
→ Artefakt: Prototyp-Erweiterung

**G-3 Testmatrix**
axe-core auf Musterkombinationen; Playwright-Kernwege; Screenreader-Stichproben.
→ Artefakt: `TESTMATRIX.md`

**G-4 Aufgaben-Review**
Je Rolle drei Alltagsaufgaben; Klickstrecke, Fehlerquote, Lerneffekt messen.
→ Artefakt: `VALIDIERUNGSBERICHT.md`

### Definition of Done
- [ ] Prototyp zeigt Minimalbaum mit pan528 und mindestens zwei Themes
- [ ] Testmatrix deckt alle Epic-Kombinationen ab
- [ ] Validierungsbericht enthält quantitative Messungen
- [ ] Alle axe-Tests bestehen ohne Verletzungen

### Testbeleg
axe-core auf Prototyp (0 Verletzungen).
Playwright: Kernweg „Theme wechseln" ohne Fehler.
Aufgaben-Review: Klickstrecken <5 für Standardaufgaben.

---

## Zusammenfassung: Artefakte und Testbelege

| Epic | Artefakte | Testmethode |
|------|-----------|-------------|
| A | GLOSSAR.md, workspace.schema.json, FREIGABE-MATRIX.md | Schema-Validierung, fiktiver Einsatzfall |
| B | LAYOUT-KATALOG.md, OVERLAY-ENTSCHEIDUNG.md, MOSAIK-REGELN.md | Screenshot-Vergleich, axe-core |
| C | TOKEN-ARCHITEKTUR.md, THEME-PROFILE.md, LIVE-KOMPONENTEN.md | axe-core, Motion-Performance, Fehlerinjektion |
| D | modul-manifest.schema.json, SLOT-KATALOG.md, AKTIONEN-QUITTUNG.md | Schema-Validierung, Playwright-Flow |
| E | NAVIGATIONS-MUSTER.md, HILFE-ONBOARDING.md, AGENTEN-ASSISTENZ.md | Playwright, Screenreader, Agent-Grenztest |
| F | PAN528-INVENTAR.md, SHELL-BESCHREIBUNG.md, MIGRATIONSPFAD.md | Manuelle Prüfung, Shell-Nachbau |
| H | katalog-eintrag.schema.json, VORLAGEN-PIPELINE.md, KANON-CHECKLISTE.md | Schema-Validierung, Markenwechsel-Test |
| G | prototyp/, TESTMATRIX.md, VALIDIERUNGSBERICHT.md | axe-core, Playwright, quantitative Messung |

---

## Nächster Schritt

Das Konzept ist vollständig ausgearbeitet. Die Umsetzung erfolgt jetzt Epic für Epic:
1. Epic A umsetzen (Artefakte erstellen, Tests durchführen, DoD abhaken)
2. Review-Runde mit dir
3. Epic B umsetzen, usw.

Soll ich direkt mit Epic A beginnen?
