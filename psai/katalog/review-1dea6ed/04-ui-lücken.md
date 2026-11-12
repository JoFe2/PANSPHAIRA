# Runde 2 — UI-Lücken und benutzbare Fachpfade

Snapshot: `1dea6ed8a91096a023d4145b0d9f13255487fbdf`. Aktuelle Sourcepfade/Zeilen relativ zu `psai/katalog/`. Statische Bedienlogik-/CSS-Prüfung; kein Browser-, Screenshot-, axe-, Touch- oder Screenreader-Erfolg wird behauptet.

## 1. B12 — Mobil bleibt offen

**Belege:** `konzept/prototyp/index.html:24,37-40,66,75,80-83,114-116`; `live/index.html:3-6`.

Der Composer setzt bei schmalen Viewports ausdrücklich `body{min-width:1024px}`. Das ist ein horizontaler Desktopraum, kein mobiler Reflow. Unter 1100 px wird das gesamte Assistenzpanel ausgeblendet; dort liegen Warum-so, Quittung und Agentensteuerung (`konzept/prototyp/index.html:135-141`; `konzept/prototyp/proto.js:446-450`). Der Drawer enthält nur Chronik und Rückkehr, keine vollständige Ersatzbedienung (`konzept/prototyp/proto.js:381-388`). Kopf-, Zonen- und Perspektivaktionen haben keine durchgängige Umbruchstrategie. Der äußeren Live-Seite fehlt das Viewport-Metatag.

**Empfehlung:** Einen schmalen Gesamtpfad herstellen: Vorgang finden → Inhalt prüfen → Vorschau/Entscheidung → Quittung/Fehler lesen → ggf. Undo/Konflikt klären. Quittung, Warum-so und Agentenaus dürfen nicht lediglich verschwinden. Danach gezielt Reflow, Touch, Zoom und Fokus prüfen. Die vier im Diff ersetzten PNGs belegen weder eine solche Korrektur noch einen von diesem Review ausgeführten Lauf.

## 2. Modalität, Close-Wege und reduzierte Bewegung

### Statisch vorhandene Mechanismen

**Beleg:** `konzept/prototyp/proto.js:383-417,533`.

Der Drawer hat Dialogrolle, `aria-modal`, Initialfokus, Tab-Schleife, Escape, Scrollmerker und Fokus-Rückkehr. Diese konkreten Mechanismen sind positiv festzustellen; daraus folgt noch keine durchgängige Accessibilityabnahme.

### Zusätzlich in Runde 2 gefunden: primärer Schließen-Button ohne Clickhandler

**Beleg:** `konzept/prototyp/proto.js:385,407,469-472`.

`#dwZu` wird erzeugt und beim Öffnen fokussiert. Der delegierte Clickselektor enthält ihn nicht; ein eigener Clickhandler wird im vollständig gelesenen Skript nicht registriert. Enter/Space auf diesem nativen Button löst damit nicht die erwartete Schließaktion aus. Der separate Button mit `data-dw-rueck` ist verdrahtet, ebenso Escape. Das ist kein vollständiger Einschluss ohne Ausweg, aber ein defekter primärer Close-Weg. Der Code ist gegenüber der Vergleichsbasis unverändert: **neu gefundener Altfehler, keine Delta-Regression**.

**Empfehlung:** Primären Close-Button an denselben Schließpfad anbinden und Maus, Enter/Space, Escape sowie Rückkehr einzeln prüfen.

### Unvollständige Modalitätsgrenze

**Belege:** `konzept/prototyp/proto.js:359-365,401-416`; `konzept/prototyp/zeiger.js:207-216`; `live/index.html:18-19`.

Nur der erste Header und `.layout` werden `inert`. Tour und Zeigerbutton hängen separat an `body`; der Zeigerbutton bleibt außerhalb dieser Grenze. In der eingebetteten Live-Seite gibt es zusätzlich Bedienelemente des äußeren Dokuments. Die Tab-Schleife innerhalb des Drawers ist daher nicht allein der Nachweis, dass die gesamte Hintergrundoberfläche modal ausgeschlossen ist. Rahmen-/Tourinteraktionen wurden nicht im Browser abgenommen.

**Empfehlung:** Die vollständige Hintergrundgrenze einschließlich Overlays/Führung definieren; Führung bei Dialogen stoppen oder ausdrücklich integrieren. Fokus nach Schließen auf ein existierendes sinnvolles Ziel zurückgeben.

### Reduced Motion

**Belege:** `konzept/prototyp/zeiger.js:7-9,22-42,237-240`; `konzept/prototyp/index.html:71,112`.

Der Zeiger verkürzt Wartezeiten und deaktiviert Glowanimation, seine inline gesetzten Positionsübergänge bleiben jedoch aktiv. Die Composer-CSS-Übergänge sind an `no-preference` gebunden, also nicht pauschal alle Animationen falsch.

**Empfehlung:** Positionsübergänge des Zeigers ebenfalls abschalten; nach tatsächlichem Wechsel der Systemeinstellung erneut bewerten. Keine Bewegungs-/Screenreaderabnahme behaupten.

## 3. Fachpfade: belegter Iststand und fehlender Gesamtweg

| Bereich | Belegter Iststand | Notwendige Restbedingungen / Empfehlung |
|---|---|---|
| Bestellvorschlag | Waren-Demokarte, Eingangsmenge und lokale Vorschau; `t1-arbeitsprofil-v3.html:174-186,384-385`; T2-Mengenlogik `t2-nachtwache-v3.html:424-425`. | Das ist Wareneingang, keine vollständige Bestellung. Lieferant, Positionen, Konditionen, Bedarf/Bestand, Quelle, versionierter bearbeitbarer Entwurf sowie getrennter Freigabe-/Übermittlungsstand fehlen im geprüften Pfad. Vorschau und konstante Genehmigungsquittung sind nicht verbunden (`t1-arbeitsprofil-v3.html:263-270`). |
| Freigabekette | Einzelentscheidung und risikoarmer Sammelbutton; `t2-nachtwache-v3.html:279-323`. | Kettenstufen, Betragsregeln, Schrittzuständigkeit, Vertretung, Selbstfreigabesperre, Eskalation und revisionsgebundene Entscheidungen. Sammelklick ist keine mehrstufige Autorisierung; Teilerfolg/Verweigerung muss pro Vorgang sichtbar sein. |
| Anlagen als Beleganhänge | Tatsächlicher Drawer zeigt Chronik; `konzept/prototyp/proto.js:381-388`. Ein Quellen-Drawer ist nur beschrieben (`konzept/OVERLAY-ENTSCHEIDUNG.md:18-20`). | Dokumentinventar, sicherer Upload/Prüfstatus/Viewer, Version und Belegbindung, Zugriffsrechte, Entknüpfen/Löschen und Aufbewahrungsgrenze. Keine vorhandene Dateiverarbeitung aus dem Konzepttext ableiten. |
| Anlagen als Anlagevermögen | Composer enthält Betrags-/Trendan­sicht und Modulbedienung, keinen Anlagenworkflow; `konzept/prototyp/proto.js:213-223,275-291`. | Anlagegutentwurf, Aktivierung, Periode/Abschreibung und führende Anlagen-/Buchungsreferenz. Fachlich vom Dokumentanhang trennen. Die Aussage betrifft den geprüften Katalogpfad, nicht ungeprüfte externe Systeme. |
| Buchhaltung | Feste Belegbeträge/Vergleichswerte und Startermanifest; `konzept/prototyp/proto.js:213-223`; `konzept/beispiele/pan528.manifest.json:14-18`. | Kontierung mit Konto, Steuer, Kostenstelle, Summenprüfung, Vorschau, Freigabe, bestätigte Journal-ID und fachlicher Storno. Ein Demo-Zähler oder Starterreset ist keine Buchungskorrektur (`mattekiste/mock-broker.mjs:178-215`). |
| Rollen und Agenten | Personen-/Agenten-/Datumsauswahl; `konzept/prototyp/proto.js:437-467`. | Login, hostbestimmte Fähigkeiten, Delegation nach Umfang/Frist, Vertretung und Rechteentzug; klare Verweigerung am Ziel statt selbst gewählter Rolle. Enddatum auch bei Stufe 3 und Gate für alle schreibenden Aktionen (`konzept/prototyp/proto.js:85-105,480-515`). |
| Parallelität | Gemeinsamer Brokerlauf, globale Elementliste, Browser-Overrides; `mattekiste/mock-broker.mjs:79,172-218`; `live/werkbank-server.py:49,99`; `konzept/prototyp/proto.js:29-35`. | Arbeitsaufträge/Quittungen nach Fenster/Session/Operation zuordnen; aktuelle Revision, Konfliktanzeige, Reload-/Mergeentscheidung und Tab-Abstimmung. Personenwechsel ist kein Zwei-Client-Nachweis. |
| Mobil | Breakpoints vorhanden, später Mindestbreite und ausgeblendete Assistenz; `konzept/prototyp/index.html:80-83,114-116`. | Vollständiger schmaler Entscheidungs-/Fehler-/Undo-Weg und erreichbare Agentenabschaltung; erst danach echte Reflow-/Touchabnahme. |

Die V3-Seiten bezeichnen ihre Interaktionen selbst als visuelle Demo (`t1-arbeitsprofil-v3.html:230`; `t2-nachtwache-v3.html:239`; `t3-redaktionell-v3.html:245`). Sichtbare Erfolgsanzeigen wurden deshalb nicht als produktive Fachfähigkeit gewertet.

## 4. Vorher/Nachher, Undo und Readback bleiben UX-Integritätsfragen

**Belege:** `konzept/prototyp/proto.js:39-41,326-350,486-515`; `t2-nachtwache-v3.html:266,302-307`.

Eine HTML-sicherere Quittung bleibt irreführend, wenn Pause vorwärts statt rückwärts beschrieben oder der neue Zustand als alter ausgegeben wird. Der eigene reine Check reproduzierte die vertauschte KPI-Pausenquittung und identische Sortierungsseiten. Ein pauschales „Undo 30s“ ist kein Nutzenversprechen, solange Gegenaktion/Frist nicht existieren; im T2 kann ein früherer Button die zuletzt entschiedene andere Karte zurücknehmen.

**Zusätzliche statische Beobachtung:** T1/T3 erstellen wiederholt dieselbe `undoBtn`-ID und hängen Listener über die globale Ersttrefferauswahl an; T3 führt als Undo einen Reload aus (`t1-arbeitsprofil-v3.html:267-270`; `t3-redaktionell-v3.html:259-263`). Das kann die falsche Karte binden beziehungsweise weitere Ansichts-/Arbeitszustände verwerfen. Unveränderter Altcode, in diesem Review nicht im Browser reproduziert.

**Empfehlung:** Quittung pro konkreter Aktion/Instanz mit tatsächlichem Vorzustand, bestätigtem Nachzustand, Rohbeleg und eindeutigem Gegenauftrag. „Unverändert“, „Ausgang unbekannt“, „abgelehnt“, „Teilwirkung“ und „erfolgreich bestätigt“ müssen verschiedene sichtbare Zustände sein. Kontrollreset, Abbruch und Fachstorno nicht unter einem Undo-Wort zusammenlegen.

## 5. Weitere kleinere Inkonsistenz

**Beleg:** `konzept/prototyp/zeiger.js:128-137`; `konzept/prototyp/proto.js:289`.

Die Trendführung sucht `#trend`, der Renderer erzeugt `#trendBild`. Der Trendblick endet deshalb am fehlenden Ziel. Das wurde statisch gefunden; kein neuer Diff-Fehler und kein belegter Datenverlust. Empfehlung: Instanzbezogene Zielreferenz statt auseinanderlaufender globaler Selektoren.

## 6. Prüfgrenzen

Keine veränderte PNG-Datei wurde als visuell bestandene Abnahme bewertet. Keine echten Fenster, Screenreader oder Accessibilityscanner wurden gestartet. `konzept/VO-ERZEUGNIS-M7.md:3-15` wird nur als vorhandene Berichtsaussage behandelt, nicht als hier erhobener Hörlauf. Ebenso ersetzen die Erfolgsangaben in `TESTMATRIX.md` oder `VALIDIERUNGSBERICHT.md` keinen eigenen Nachweis. Die konkreten Mindestaktionen und Rechte-/Readbackbedingungen sind in `03-tooluse-katalog.md` getrennt vom Iststand aufgeführt.
