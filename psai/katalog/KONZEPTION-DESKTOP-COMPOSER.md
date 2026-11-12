# PsAI Desktop-Composer — Konzeptionsplan v3 (Phase 0)

Ziel: Ein generisches, anwendbares Bedienkonzept für PANSPHAIRA/PsAI, bei dem der Arbeitsplatz
aus definierten Bereichen, Layouts, Design-Varianten und Datenquellen zusammengesetzt wird.
Kein „Jarvis-Klon", sondern ein tragfähiges Grundgerüst, das sowohl futuristische Entwürfe
(P1–P5) als auch nüchterne Sachbearbeitung (T1–T3) trägt.

Grundannahme: Alles ist deklarativ beschreibbar in drei Schichten:
1. **Layout-Schicht**   → Wo steht was? (Raster, Zonen, Reiter, Overlays, Breakpoints)
2. **Design-Schicht**   → Wie sieht es aus? (Tokens, Themes, Dichte, Motion, Icons)
3. **Daten-/Funktions-Schicht** → Was steckt dahinter? (Module, Quellen, Aktionen, Rechte)

## Beschlusslage Runde 1 (Auftraggeber, 10.11.2026)
- **B1 — Einfach starten, frei enden:** Anfangs fixe/kuratierte Layouts; spätere Selbstgestaltung
  muss ohne Neuentwicklung möglich sein → Deskriptoren von Anfang an so bauen, dass sie
  Nutzer-Layouts als zusätzliche Ebene aufnehmen (Evolutionär-Pfad, siehe A5).
- **B2 — Template-Verbund statt Global-Layout:** Layouts dürfen geschachtelt und kombiniert
  werden (z.B. Fach-Template „Finanzen" + ERP-Template B + Unternehmens-Template F).
  Überschneidungen sind per führender Regel zu lösen; die Regel ist einstellbar.
- **B3 — Optionalitätsprinzip:** In PsAI ist fast alles optional. Jedes Element trägt eine
  Option (an/aus/rollenabhängig); gesteuert über ein Optionen-Register, nicht über Weglass.
- **B4 — Neutraler Produktkatalog:** PanSphaira darf dezent erscheinen; der Kern ist
  produktneutral. Jede umgesetzte Komponente wird selbst zur Vorlage mit Optionen —
  eine Vorlagen-Pipeline im PsAI-Kanon.

## Beschlusslage Runde 2 (Auftraggeber, 10.11.2026)
- **B5 — Hierarchie- und Delegationsprinzip:** Es gibt einen dynamisch erweiterbaren
  Konfigurationsbaum. Jeder Knoten kann Eigentümer haben: Person, Gruppe, Rolle oder Agent.
  Der Administrator hat grundsätzlich alle Rechte, kann aber auf jeder Ebene delegieren.
  Die leading-Ebene pro Inhalt ist optional festlegbar.
- **B6 — Gesperrte vs. lösbare Tokens:** Nichts ist prinzipiell gesperrt; der Default zeigt
  aber klare Rahmen (z.B. Corporate Fonts/Farben als Unternehmensrichtlinie) und markiert den
  Rest als optional. Sperren sind selbst konfigurierbar und delegierbar.
- **B7 — Design-Mosaik erlaubt:** Verschiedene Bereiche eines Workspaces dürfen unterschiedliche
  Designs tragen (z.B. futuristischer Rahmen + sachlicher Finanzbereich). Das Konzept muss
  diese Mosaikbildung first-class unterstützen, nicht als Ausnahme behandeln.
- **B8 — Ultra-Wide-Leinwand als Leitbild:** Die Vision ist ein riesiger, ggf. gebogener
  Bildschirm (21:9/32:9), auf dem Komponenten frei platziert, gesteuert und mit Live-Daten
  befüllt werden. Alle Raster/Zonen müssen sich bis dahin skalieren lassen, ohne dass die
  Architektur geändert werden muss.
- **B9 — Live-/Ticker-Module:** Module bringen ihr eigenes Aktualisierungsintervall mit
  (z.B. alle 10 s). Optische Anlehnung an Grafana ist ausdrücklich erwünscht, wo sie der
  Sachlichkeit dient.
- **B10 — Agentische Unterstützung später:** Templates können durch Agenten vorgeschlagen,
  gebaut und gepflegt werden. Das Bediensystem muss dafür Erklärbarkeit und Rollengrenzen
  bieten (Agent = delegierbarer Eigentümer, nicht Automatik-Zwang).

Bestand (Stand 24.10.2026 / Katalog V4): Zielbilder P1–P5, Templates T1–T3 (V1–V3),
pan528 mit echtem Rechnungs-Workflow. Es fehlen: Deskriptor-Sprache, Template-Auflösung,
Overlay/Tab-Mechanik, Modul-Registrierung, Layout-Persistenz.

---

## Phase A — Begriffe & Datenmodell

A1. **Vokabular festlegen**
   - Workspace, Zone, Panel, Modulbaustein, Viewlet, Overlay, TabGroup, DataSource, Action, Rolle, Option.
   - Abgrenzung Icon/Kachel/Reiter: Navigationsziel vs. Inhalt vs. Umschalter.

A2. **Deskriptor-Schema + Konfigurationsbaum (Kernstück, Beschlüsse B2+B5)**
   - `workspace.json` (Layoutbaum, Theme-Referenzen, Modul-Bindungen, Breakpoints).
   - **Baum statt starrer Scopes:** Wurzel = Unternehmen; Kinder = Domänen, Module, Personen, Gruppen, Agenten.
     Jeder Knoten trägt: Template-Referenzen, Options-Overrides, Eigentümer, Delegationen, Sperrlisten.
   - **Auflösungsregeln pro Eigenschaftsklasse:**
     - Struktur (Zonen, Raster): höherer Knoten setzt Rahmen, niedrigerer füllt darin.
     - Feinwerk (Abstände, Reihenfolge innerhalb einer Zone): niedrigerer Knoten führt.
     - Tokens: Vererbungsregeln je Token-Klasse; Root kann Defaults setzen und optional sperren (B6).
   - **„Warum sieht das so aus?"-Ansicht**: je Element die Auflösung (welcher Knoten, welche Regel).
   - Versionierung + Migration: ältere Deskriptoren bleiben lesbar.

A3. **Berechtigungs- und Mandantenfähigkeit**
   - Geschützte Sitzung, nur-lesen-Grenzen, rollenbezogene Sichtbarkeit; Baumknoten an Rechte gekoppelt.

A4. **Nicht-Ziele**
   - Kein Drag-and-drop-Editor in Stufe 1; kein KI-Chat als Allzweckbedienung; keine Pflicht-Frameworks.

A5. **Evolutionär-Pfad (Beschluss B1)**
   - Stufe „kuratiert": Anwendung liefert Workspace-Deskriptoren fest aus, Nutzer wählt Profil.
   - Stufe „mitbestimmt": person-Scope aktiv, nur erlaubte Eigenschaften (Reihenfolge,
     Sichtbarkeit, Theme-Wahl).
   - Stufe „frei": person-Scope darf Struktur ändern. Jede Stufe ist nur eine freigegebene
     Matrix mehr, kein Architekturbruch — das ist der Kern von „später möglich, ohne Neuentwicklung".

Lieferbar: Glossar + Schema + Konfliktmatrix + Freigabe-Matrix der drei Stufen.

---

## Phase B — Layout-Raster & Zonendefinition

B1. **Raster-Typen katalogisieren:** Sidebar+Content+Rail, Kachel-Grid, Karten-Stack, Split,
   Reiter-Stapel, Overlay-Ebene, freie Leinwand (Ultra-Wide, B8).
B2. **Zonen-Typen definieren:** Navigation, Startbereich, Fachdaten, Chronik, Assistent,
   Filter, Status. Je Zone: Mindestbreite, Anker, Einklapp-Verhalten, Fokusreihenfolge.
B3. **Responsive-Strategie:** pro Zone ein Verhalten (priorisiert/gestapelt/verschoben/ausgeblendet);
   Breakpoint-Profile 390/1024/1586 analog Historien-Paket; Ultrawide-Profil ergänzend.
B4. **Overlay- vs. Seiten-Entscheidungsmuster:** Kriterien Kontextverlust, Parallelität, Rückkehrpfad;
   Modul darf Präferenz erklären (Beschluss B3: optional, steuerbar), Anwendung entscheidet final.
B5. **Design-Mosaik (B7):** Regeln, wie verschiedene Themes/Designs nebeneinander bestehen:
   gemeinsame Token-Basis, abgetrennte Oberflächen, klare Übergänge, keine gegenseitige Zerstörung.

Lieferbar: Layout-Katalog mit Skizzen + Entscheidungsbaum + Mosaik-Regeln.

---

## Phase C — Design-Schicht & Theme-System

C1. **Token-Architektur:** Basis `--ps-*` aus T1–T3/P1–P5; Ebenen Core → Semantic → Component.
C2. **Theme-Profile:** Essential 2D, Pulse, Notebook, Orbit, Insight — je Farbwerte, Typo-Skala,
   Icon-Stil, Motion-Intensität, Dichte. Themes sind Templates im Design-Scope (B2 konform).
C3. **Komponenten-Kit:** Button, Badge, Card, Table, Tabs, Drawer, Toast, Empty-State, Skeleton —
   themagekoppelt, jeder Zustand dokumentiert.
C4. **Motion:** nur Zustandswechsel; reduced-motion heilig; keine Deko ohne Bedeutung.
C5. **Live-/Ticker-Komponenten (B9):** Chart-, Zahlen-, Status-Elemente mit Intervall-Steuerung,
   Alterungsanzeige, Pause/Resume, Fehlerzustand bei ausbleibender Quelle.

Lieferbar: Theme-Guideline + Komponentenliste inkl. Live-Zustände.

---

## Phase D — Modul-/Plugin-Prinzip

D1. **Modulvertrag:** Manifest mit id, titel, icon, datenquellen, aktionen, rechten,
   layout-Hinweisen (min/max, bevorzugte Zonen) und **Mitliefer-Template** (eigener Scope).
D2. **Optionen-Register (Beschluss B3):** Jede Option = Schlüssel, Default, erlaubte Werte,
   Rollenfreigabe, Anzeigeort. Module melden Optionen, die Shell rendert die Steuerung einheitlich.
D3. **Slots:** Nav, Home-Kachel, Detail-Panel, Overlay-Inhalt, Statusleiste.
   Beispiel: pan528 = Modul „Eingangsrechnungen" mit Kachel- + Detailkarten-Slot.
D4. **Datenadapter:** pro Quelle (REST, CSV, Mock, Stream); einheitliches Readback-/Statusmodell.
D5. **Aktion → Fachschicht:** deklarativ (id, payload, erwarteter Effekt); UI zeigt Quittung
   (Vorher/Nachher, Undo, Rohlog), nie blinde Erfolgsmeldung.
D6. **Delegation im Baum (B5):** Eigentümer und Bearbeitungsfähigkeit pro Knoten;
   Agenten als eigene Eigentümerklasse mit eingeschränkten Rechten und Protokollierung.

Lieferbar: Manifest-Schema + Slot-Katalog + Beispielmanifest pan528 + Optionen-Register-Design.

---

## Phase E — Interaktions- & Komfortschicht

E1. Navigation: Primärpfad Klick/Tastatur, Sekundärpfad Palette (⌘K), Kürzel nie Einzelpfad.
E2. Perspektiven statt starrer Seiten: Liste, Karte, Timeline, Vergleich, Rohlog auf selben Daten.
E3. Quittungsprinzip durchziehen; Grün nur für Bewiesenes.
E4. Hilfe kontextbezogen (?), geführter Erststart, Tooltips erklären Grenzen („nur lesen").
E5. Agentische Assistenz (B10): Template-Vorschläge, Erklärung von Änderungen, Rollengrenzen;
   niemals ungefragtes Umbauen des Nutzer-Layouts.

Lieferbar: Muster-Katalog + Shortcuts-Tabelle + Agenten-Interaktionsmuster.

---

## Phase F — Realitätsabgleich mit Bestand (Gegenprobe)

F1. **pan528 inventarisieren:** Elemente → Zone/Modul/Datenquelle abbilden; Umschreibbedarf klären.
F2. **Shell extrahieren:** Header/Nav/Footer/Assistent aus P-Seiten als wiederverwendbare Hülle.
F3. **Migrationspfad:** (1) Layout-Festlegung je Profil → (2) Modulmanifeste → (3) person-Scope.
F4. **Risiken:** Überkonfiguration, Performance, Testbarkeit, A11y bei Nutzer-Layouts,
   Template-Konflikte ohne sichtbare Auflösung (Gegenmittel: „Warum so?"-Ansicht ab Stufe 1).

Lieferbar: Gap-Liste + Migrationsplan.

---

## Phase G — Prototyp & Validierung

G1. Statischer Composer: HTML/CSS/ES; Workspace-Deskriptor wird gerendert; Theme-Schalter; Slots sichtbar.
G2. Interaktiver Kern: Zone zu/aus, Theme/Profil wechseln, Modul binden, Layout speichern/laden (localStorage).
G3. Testmatrix: axe auf Musterkombinationen; Playwright-Kernwege; Screenreader-Stichproben.
G4. Review an echten Aufgaben je Rolle; Messung: Klickstrecke, Fehlerquote, Lerneffekt.

Lieferbar: Prototyp + Testbericht + Umsetzungsempfehlung.

---

## Phase H — Neutraler Produktkatalog & Vorlagen-Pipeline (Beschluss B4)

H1. **Katalog-Eintrag:** Modul/Komponente/Theme/Template je mit: Version, Optionen, Screenshots
    (390/1024/1586), Beispiel-Deskriptor, Lizenzhinweis, PsAI-Kanon-Check.
H2. **Vorlagen-Pipeline:** Jede umgesetzte Oberfläche wird nach Abschluss im Katalog erfasst —
    Varianten entstehen durch Optionen + Scope-Kombination, nicht durch Kopien.
H3. **PanSphaira-Dezenz:** Marke als Token-Slot (Logo/Name austauschbar), Kern generisch;
    Referenz-Brand „PanSphaira" bleibt erste Instanz des Katalogs.
H4. **Kanon-Festlegung:** PsAI-Grundprinzipien (Ehrlichkeit, Quittung, Optionalität,
    Nur-lesen-Grenze, Redlichkeit der Daten) als Checkliste je Katalog-Eintrag.

Lieferbar: Katalog-Struktur + 5 Referenzeinträge (T1–T3, pan528, P-SHELL) + Kanon-Checkliste.

---

## Reihenfolge & Gesprächspunkte

1. A+B+C konsolidieren (Grundgerüst; A2 ist das Herzstück).
2. Parallel F (Gegenprobe am Bestand), damit nichts vorbeigeplant wird.
3. Danach D+E (hängen am Layout-Gerüst).
4. H begleitet durchgehend (jedes Ergebnis wird Katalog-Eintrag).
5. G zum Schluss als Beweislauf.

Beantwortete Fragen (Runde 2, 10.11.):
- Domänen-Template darf Unterstruktur füllen/ergänzen, nicht pauschal brechen (B5/B6).
- Konfliktregeln änderbar durch Admin, delegierbar an Personen/Gruppen/Rollen/Agenten (B5).
- Unternehmens-Defaults überschreibbar, aber per Default sperrbar (B6).
- Katalog-Form: JSON mit Render-Frontend empfohlen; Markdown als Begleittext möglich.

Beantwortete Fragen (Runde 3, 10.11.):
- Baum wächst pro Mandant unterschiedlich — ja, nichts dagegen.
- Agenten mit eigenen Knoten: optional, gut konfigurierbar; nicht erzwungen.
- Erste Live-Module aus Bestand ableiten: Kennzahl-Kachel, Ticker-Zeile, Trend-Liniendiagramm, Statusleiste.
- Keine harten Compliance-Sperren vorgegeben; Betreiber entscheidet per Optionen/Sperren selbst.

Konkretisierung: siehe KONFIGURATIONSBAUM.md (Phase A2 konkret) inkl. Minimalbaum für PsAI.
