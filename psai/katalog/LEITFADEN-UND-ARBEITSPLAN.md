# PsAI Desktop-Composer — Finalisierter Leitfaden & Arbeitsplan

Stand: 10.11.2026 · Version final (Grundlage für alle weiteren konzeptionellen Arbeiten)

Dieses Dokument ist der verabschiedete Rahmen. Es beantwortet nicht mehr die Frage „Was wollen wir?",
sondern strukturiert, **in welcher Reihenfolge** und **mit welchen Epics/Issues** wir das Konzept
konzeptionell ausarbeiten. Umsetzung in Code erfolgt erst, wenn die jeweiligen Konzepte fertig sind.

## 0. Grundprinzipien (unveränderlich)

P1 — **Drei-Schichten-Trennung:** Layout / Design / Daten-Funktion bleiben getrennt beschreibbar.
P2 — **Konfigurationsbaum statt starrer Scopes:** Jeder Knoten kann Eigentümer, Optionen, Sperren
     und Vorlagen tragen; Bäume wachsen pro Mandant unterschiedlich.
P3 — **Optionalität vor Weglassung:** Fast alles ist an/aus/rollenabhängig konfigurierbar.
P4 — **Design-Mosaik first-class:** Verschiedene Designs nebeneinander im selben Workspace sind
     Normalfall, nicht Ausnahme.
P5 — **Ultra-Wide-Leinwand als Leitbild:** Alle Konzepte müssen auf freien, großen Flächen funktionieren.
P6 — **Live-Daten sind Bürger erster Klasse:** Module bringen Intervalle mit; Alterung/Fehler sichtbar.
P7 — **Agenten sind delegierbare Eigentümer:** optional, protokolliert, nie ungefragt umbauend.
P8 — **Neutraler Produktkatalog:** PanSphaira dezent; jede Oberfläche wird zur wiederverwendbaren Vorlage.
P9 — **Ehrlichkeit schlägt Erfolgsmeldung:** Quittungen, Undo, Rohlog, grüne Zustände nur bei Bewiesenes.
P10 — **Kein Framework-Zwang:** Vanilla ES als Referenzpfad; Erweiterbarkeit bleibt offen.

## 1. Arbeitsweise

Wir behandeln die Konzeptionsphase wie ein kleines Projekt:
- Jedes Kapitel wird als **Epic** geführt.
- Innerhalb eines Epics werden konkrete Fragen als **Issues** abgearbeitet.
- Ein Issue gilt als erledigt, wenn ein **Artefakt** existiert (Schema, Muster, Beispiel, Checkliste).
- Nach jedem Epic gibt es eine kurze **Review-Runde** mit dir, bevor das nächste beginnt.
- Ergebnisse landen im Katalog unter `~/frontend-kit/psai/katalog/` und werden dort versioniert.

Reihenfolge der Arbeit:

| # | Epic | Ziel | Artefakte | Dauer (conceptuell) |
|---|------|------|-----------|---------------------|
| A | Begriffe & Baummodell | Gemeinsame Sprache + JSON-Schema | Glossar, workspace.schema.json, Warum-so-Beispiel | kurz |
| B | Layout & Zonen | Raster, Overlays, Responsive, Mosaik | Layout-Katalog, Entscheidungsbaum, Mosaik-Regeln | mittel |
| C | Design & Themes | Token-Architektur, Theme-Profile, Live-Komponenten | Theme-Guideline, Komponentenliste | mittel |
| D | Modul-/Plugin-System | Manifest, Slots, Adapter, Delegation | Manifest-Schema, Slot-Katalog, pan528-Beispiel | mittel |
| E | Interaktion & Komfort | Navigation, Perspektiven, Agenten-Assistenz | Muster-Katalog, Shortcuts, Agenten-Muster | kurz |
| F | Realitätsabgleich | pan528 + Shell inventarisieren, Migration | Gap-Liste, Migrationsplan | kurz |
| H | Produktkatalog & Kanon | Neutraler Katalog, Vorlagen-Pipeline | Katalog-Struktur, Kanon-Checkliste, 5 Referenzen | mittel |
| G | Prototyp & Validierung | Beweislauf am Ende | Prototyp-Beschreibung, Testmatrix | zum Schluss |

Warum diese Reihenfolge? A/B/C bilden das Gerüst. D/E hängen daran. F verhindert Planungsirrtümer.
H sorgt dafür, dass jedes Ergebnis sofort wiederverwertbar wird. G beweist am Ende, dass alles zusammenpasst.

---

## 2. Epic A — Begriffe & Baummodell (finalisieren)

Ziel: Eine belastbare gemeinsame Sprache und ein maschinenlesbares Kernschema.

### Issues

A-1 **Glossar schreiben**
   - Begriffe: Workspace, Zone, Panel, Modulbaustein, Viewlet, Overlay, TabGroup, DataSource, Action, Rolle, Option, Knoten, TemplateRef, Delegation, Sperre.
   - Abgrenzungen: Icon vs. Kachel vs. Reiter; Navigationsziel vs. Inhalt vs. Umschalter.
   - Artefakt: `GLOSSAR.md`.

A-2 **workspace.json Schema entwerfen**
   - JSON-Schema für den Konfigurationsbaum inkl. Knotentypen, Options-Overrides, Sperren, Delegationen.
   - Versionierungsfeld + Migrationsregeln.
   - Artefakt: `workspace.schema.json`.

A-3 **„Warum-so"-Metadaten definieren**
   - Welche Informationen braucht eine Auflösungserklärung? (Knotenpfad, Regel, Eigentümer, Sperre)
   - Wie wird sie im Deskriptor gespeichert?
   - Artefakt: Abschnitt im Schema + Beispielblock.

A-4 **Minimalbeispiel bauen**
   - Der in KONFIGURATIONSBAUM.md skizzierte Minimalbaum als vollständiger Deskriptor.
   - Artefakt: `beispiele/workspace.minimal.json`.

A-5 **Evolutionär-Pfad festzurren**
   - Freigabe-Matrizen für Stufen kuratiert / mitbestimmt / frei.
   - Artefakt: `FREIGABE-MATRIX.md`.

Review-Kriterium: Du kannst einen fiktiven neuen Bereich („Logistik") in den Minimalbaum einsetzen,
ohne dass Regeln unklar werden.

---

## 3. Epic B — Layout & Zonen

Ziel: Ein Katalog tragender Layoutmuster, die sich vom Handy bis zur Ultra-Wide-Leinwand skalieren.

### Issues

B-1 **Raster-Typen katalogisieren**
   - Sidebar+Content+Rail, Kachel-Grid, Karten-Stack, Split, Reiter-Stapel, Overlay-Ebene, freie Leinwand.
   - Jeweils: ASCII-Skizze, Mindestbreiten, Fokusreihenfolge, Breakpoint-Verhalten.
   - Artefakt: `LAYOUT-KATALOG.md`.

B-2 **Zonen-Typen definieren**
   - Navigation, Startbereich, Fachdaten, Chronik, Assistent, Filter, Status.
   - Je Zone: Anker, Einklapp-Verhalten, Mindestbreite, erlaubte Inhalte.
   - Artefakt: Abschnitt in `LAYOUT-KATALOG.md`.

B-3 **Responsive-Strategie pro Zone**
   - Verhalten priorisiert/gestapelt/verschoben/ausgeblendet für 390/1024/1586/Ultrawide.
   - Artefakt: Tabelle in `LAYOUT-KATALOG.md`.

B-4 **Overlay-vs-Seite-Entscheidungsbaum**
   - Kriterien: Kontextverlust, Parallelität, Rückkehrpfad, Rollenfreigabe.
   - Artefakt: `OVERLAY-ENTSCHEIDUNG.md` mit Flussdiagramm.

B-5 **Design-Mosaik-Regeln**
   - Wie koexistieren Pulse + Essential + Notebook in einem Workspace?
   - Gemeinsame Token-Basis, Oberflächen-Trennung, Übergänge, A11y-Grenzen.
   - Artefakt: `MOSAIK-REGELN.md`.

B-6 **Ultrawide-Profil**
   - Spezifisches Verhalten auf 21:9/32:9: Zonenanker, Kachelgröße, Auge-Tracking-Aspekte.
   - Artefakt: Abschnitt in `LAYOUT-KATALOG.md`.

Review-Kriterium: Für jeden Bestandsteil (pan528, P1–P5-SHELL) lässt sich ein Layout zuordnen,
und ein neues Modul findet ohne Diskussion seinen Platz.

---

## 4. Epic C — Design & Themes

Ziel: Eine konsistente, aber austauschbare Design-Schicht mit Live-Komponenten.

### Issues

C-1 **Token-Architektur vereinheitlichen**
   - Core → Semantic → Component; Mapping der bestehenden `--ps-*` Tokens.
   - Artefakt: `TOKEN-ARCHITEKTUR.md`.

C-2 **Theme-Profile dokumentieren**
   - Essential 2D, Pulse, Notebook, Orbit, Insight: Farbwerte, Typo, Icons, Motion, Dichte.
   - Artefakt: `THEME-PROFILE.md`.

C-3 **Komponenten-Kit ableiten**
   - Button, Badge, Card, Table, Tabs, Drawer, Toast, Empty-State, Skeleton, Chart, Ticker, Kennzahl, Statusleiste.
   - Zustände: Standard, Hover, Fokus, Disabled, Loading, Fehler, Alternd.
   - Artefakt: `KOMPONENTEN-LISTE.md`.

C-4 **Motion-Prinzipien**
   - Wann Bewegung erlaubt ist; reduced-motion; Performance-Budgets.
   - Artefakt: Abschnitt in `THEME-PROFILE.md`.

C-5 **Live-Komponenten spezifizieren**
   - Kennzahl-Kachel, Ticker-Zeile, Trend-Liniendiagramm, Statusleiste.
   - Datenform, Intervall-Optionen, Alterungsanzeige, Pause/Resume, Fehlerzustand.
   - Artefakt: `LIVE-KOMPONENTEN.md`.

Review-Kriterium: Ein Designer kann aus dem Katalog heraus ein neues Theme bauen, ohne dass
Layout oder Modulsystem angepasst werden müssen.

---

## 5. Epic D — Modul-/Plugin-System

Ziel: Ein Vertrag, nach dem sich jedes Modul — auch externe oder agentische — einklinkt.

### Issues

D-1 **Modul-Manifest Schema**
   - id, titel, icon, datenquellen, aktionen, rechte, layout-Hinweise, Mitliefer-Template, Optionen.
   - Artefakt: `modul-manifest.schema.json`.

D-2 **Slot-Katalog**
   - Nav, Home-Kachel, Detail-Panel, Overlay-Inhalt, Statusleiste, Chronik-Eintrag.
   - Je Slot: Größe, Priorität, Lifecycle, A11y-Erwartungen.
   - Artefakt: `SLOT-KATALOG.md`.

D-3 **Datenadapter-Modell**
   - REST, CSV, Mock, Event-Stream; einheitliches Readback-/Statusmodell.
   - Artefakt: `ADAPTER-MODELL.md`.

D-4 **Aktionen & Quittungen**
   - Deklarative Aktionen; erwarteter Effekt; Vorher/Nachher; Undo; Rohlog-Link.
   - Artefakt: `AKTIONEN-QUITTUNG.md`.

D-5 **Delegation & Agentenrechte präzisieren**
   - Eigentümerklassen, Rechtearten, Gültigkeit, Protokollierung, Rollback.
   - Artefakt: Abschnitt in `DELEGATION-MODELL.md`.

D-6 **Beispielmanifest pan528**
   - pan528 als Modul „Eingangsrechnungen" mit zwei Slots und Optionen.
   - Artefakt: `beispiele/pan528.manifest.json`.

Review-Kriterium: Ein Drittanbieter-Modul kann anhand von Schema + Slot-Katalog + Beispiel
sein eigenes Manifest schreiben, ohne uns zu fragen.

---

## 6. Epic E — Interaktion & Komfort

Ziel: Die Bediensysteme, die aus einem konfigurierbaren Framework ein gutes Produkt machen.

### Issues

E-1 **Navigation & Wege**
   - Primärpfade, Sekundärpfade (⌘K), Tastaturkürzel, Zurückpfade.
   - Artefakt: `NAVIGATIONS-MUSTER.md`.

E-2 **Perspektiven statt starrer Seiten**
   - Liste, Karte, Timeline, Vergleich, Rohlog auf selben Daten.
   - Artefakt: Abschnitt in `NAVIGATIONS-MUSTER.md`.

E-3 **Quittungsprinzip durchziehen**
   - Grün nur für Bewiesenes; Undo-Fenster; Rohlog-Zugang.
   - Artefakt: Abschnitt in `AKTIONEN-QUITTUNG.md`.

E-4 **Hilfe & Onboarding**
   - Kontexthilfe (?), geführter Erststart, Tooltip-Grenzen.
   - Artefakt: `HILFE-ONBOARDING.md`.

E-5 **Agentische Assistenz**
   - Vorschläge, Erklärung von Änderungen, Grenzen, Abstufung (nur anzeigen / vorschlagen / ändern).
   - Artefakt: `AGENTEN-ASSISTENZ.md`.

Review-Kriterium: Ein neuer Nutzer versteht innerhalb von drei Minuten, wie er einen Bereich
umbaut und wieder rückgängig macht.

---

## 7. Epic F — Realitätsabgleich mit Bestand

Ziel: Sicherstellen, dass das Konzept am echten Bestand anschlussfähig ist.

### Issues

F-1 **pan528 inventarisieren**
   - Elemente → Zone/Modul/Datenquelle abbilden; Umschreibbedarf klären.
   - Artefakt: `PAN528-INVENTAR.md`.

F-2 **Shell extrahieren**
   - Header/Nav/Footer/Assistent aus P-Seiten als wiederverwendbare Hülle beschreiben.
   - Artefakt: `SHELL-BESCHREIBUNG.md`.

F-3 **Migrationspfad skizzieren**
   - Schritt 1: Layout-Festlegung je Profil; Schritt 2: Modulmanifeste; Schritt 3: person-Scope.
   - Artefakt: `MIGRATIONSPFAD.md`.

F-4 **Risiken & Gegenmaßnahmen**
   - Überkonfiguration, Performance, Testbarkeit, A11y, Template-Konflikte.
   - Artefakt: Abschnitt in `MIGRATIONSPFAD.md`.

Review-Kriterium: Für pan528 liegt eine konkrete Umstellungsbeschreibung vor.

---

## 8. Epic H — Produktkatalog & Vorlagen-Pipeline

Ziel: Jeder fertige Baustein wird sofort wiederverwendbar und auffindbar.

### Issues

H-1 **Katalog-Eintrag Schema**
   - Version, Optionen, Screenshots (390/1024/1586), Beispiel-Deskriptor, Lizenz, Kanon-Check.
   - Artefakt: `katalog-eintrag.schema.json`.

H-2 **Vorlagen-Pipeline definieren**
   - Wann wird eine Oberfläche katalogisiert? Wer pflegt Varianten?
   - Artefakt: `VORLAGEN-PIPELINE.md`.

H-3 **PanSphaira-Dezenz operationalisieren**
   - Marken-Token-Slots, Austauschbarkeit, Referenz-Brand.
   - Artefakt: Abschnitt in `THEME-PROFILE.md`.

H-4 **PsAI-Kanon-Checkliste**
   - Ehrlichkeit, Quittung, Optionalität, Nur-lesen-Grenze, Redlichkeit der Daten.
   - Artefakt: `KANON-CHECKLISTE.md`.

H-5 **Fünf Referenzeinträge**
   - T1/T2/T3, pan528, P-SHELL als erste Katalogobjekte.
   - Artefakt: `katalog/*.json`.

Review-Kriterium: Der Katalog enthält bereits reale, nutzbare Objekte — keine leeren Hülsen.

---

## 9. Epic G — Prototyp & Validierung (zum Schluss)

Ziel: Nachweis, dass A–H zusammen funktionieren.

### Issues

G-1 **Statischer Composer-Prototyp**
   - HTML/CSS/ES; rendert workspace.json; Theme-Umschalter; Slots sichtbar.
   - Artefakt: `prototyp/index.html` + Beschreibung.

G-2 **Interaktiver Kern**
   - Zone zu/aus, Theme wechseln, Modul binden, Layout speichern/laden.
   - Artefakt: Prototyp-Erweiterung.

G-3 **Testmatrix**
   - axe-core auf Musterkombinationen; Playwright-Kernwege; Screenreader-Stichproben.
   - Artefakt: `TESTMATRIX.md`.

G-4 **Aufgaben-Review**
   - Je Rolle drei Alltagsaufgaben; Klickstrecke, Fehlerquote, Lerneffekt messen.
   - Artefakt: `VALIDIERUNGSBERICHT.md`.

Review-Kriterium: Der Prototyp zeigt den Minimalbaum mit pan528 und mindestens zwei Themes.

---

## 10. Sofort next steps (nach deiner Freigabe dieses Leitfadens)

1. Ich finalisiere **Epic A**: Glossar, `workspace.schema.json`, Warum-so-Beispiel, Minimal-Deskriptor.
2. Du gibst Epic A frei oder korrigierst Begriffe/Schemata.
3. Danach arbeite ich Epic B aus (Layout-Katalog), wieder mit Review.
4. So hangeln wir uns Epic für Epic vorwärts — jeweils mit einem kleinen, prüfbaren Zwischenergebnis.

Wenn du willst, starte ich direkt mit Epic A und liefere beim nächsten Mal die vier Artefakte.
