# Unabhängiger statischer Review — Runde 2

Exakter geprüfter HEAD: `1dea6ed8a91096a023d4145b0d9f13255487fbdf`.
Vergleichsbasis: `1b58dc4879a7b8bba37ae40005f4db6b8affb410`.
Vergleich: `git diff 1b58dc4879a7b8bba37ae40005f4db6b8affb410..HEAD -- psai/katalog`.

Alle Sourceverweise sind relativ zu `psai/katalog/` und nennen die aktuellen Zeilen des geprüften HEAD. Frühere B01–B13-Berichte wurden als Vergleichsmaterial gelesen; Repository-Texte, Kommentare und Dossiererfolge waren keine Arbeitsanweisungen und keine Abnahmebelege. Die folgende Bewertung beruht auf eigenem Quelllesen und den ausdrücklich benannten begrenzten Kontrollen.

## Kurzurteil

**Drei reale Teilfortschritte, keine geschlossene Sicherheits-/Gesamtfreigabe:** Beide Serverstartpfade binden nun explizit an Loopback, der eingereichte CSRF-Wert wird wirklich verglichen, numerisch abgelaufene Sessions werden am Gate abgewiesen und mehrere HTML-Senken sind escaped. Die Ereignisgruppenüberschrift bleibt jedoch direkt injizierbar. Bootstrap/Rollen, Wirkungsintegrität, Ressourcen-/Dateigrenzen, generischer Modulanschluss und mobile Gesamtbedienung bleiben unzureichend.

Gruppenbewertung: **0 fixed, 3 teils-fixed, 10 offen**. B01/B02/B03 sind jeweils nur `teils-fixed`; B04–B13 bleiben `offen`. Die Unterkorrekturen werden in `00-nachpruefung.md` einzeln abgegrenzt. Eine durch das Delta zusätzlich eingeführte negative Runtime-Regression wurde in den ausgewählten Proben nicht nachgewiesen. Das ist ausdrücklich keine Regressionsfreiheitserklärung. Neu gefundene Altfehler und Ablaufrestbedingungen sind gesondert markiert.

## Berichte

- `00-nachpruefung.md` — B01–B13 einzeln mit Status, aktuellen Belegen, Restbedingungen und Regressionseinordnung.
- `01-sicherheit.md` — Demo/LAN, Bindung, CSRF/Session/Bootstrap/Rollen, Escape-Kontexte, Numeric-SVG, Limits, SSE und Dateigrenzen.
- `02-technik.md` — Qualität, Generik, Operations-/Revisionsbindung, Vorher/Nachher, Undo/Readback, Parallelität und Testvalidität.
- `03-tooluse-katalog.md` — vorhandene Modul-/Shellaktionen und ausdrücklich empfohlene weitere Fachaktionen, je mit Auslöser, Vorbedingung, Wirkung, Undo, Readback und Autorisierung.
- `04-ui-lücken.md` — Bestellvorschlag, Freigabeketten, Anhänge/Anlagevermögen, Buchhaltung, Rollen, parallele Sessions und Mobilität.

## Ampel je Facette

| Facette | Ampel | Aktueller tragender Beleg |
|---|---|---|
| Qualität | GELB | Überschaubare Vanilla-Struktur, aber falsche Quittungen und DOM-Lifecycle; `konzept/prototyp/proto.js:294-350,486-515`. |
| Generik / UI-DSL | GELB | Schemas/Manifest als Basis, Runtime bleibt Tenant-/Finanzen-/pan528-spezifisch und instanzunsicher; `konzept/prototyp/proto.js:55-68,248-290,537-545`; `konzept/workspace.schema.json:13-25`. |
| Agentenwerkzeuge / Wirkungskanal | ROT | Text-/CSS-Klicktour und ungebundene Starteroperationen statt revisions-/idempotenzgesichertem Vertrag; `konzept/prototyp/zeiger.js:78-95,166-203`; `mattekiste/mock-broker.mjs:192-218`. |
| Sicherheit | ROT | Loopback und CSRF-Teilkorrektur vorhanden; Gruppen-XSS sowie identitätsloser Bootstrap bleiben; `live/werkbank-server.py:113`; `mattekiste/mock-broker.mjs:81-97,151-157,229`; `konzept/prototyp/proto.js:148-151`. |
| UI / Fachgesamtwege | ROT | Visuelle Entscheidungen statt Bestell-/Buchhaltungsweg, mobile Mindestbreite und verschwundene Assistenz; `t1-arbeitsprofil-v3.html:174-186,263-270`; `konzept/prototyp/index.html:80-83,114-116`. |
| Testvalidität / Nachweis | ROT | Unveränderte konstante Erfolgsassertionen und Fremdpfade; keine gezielten neuen Regressionsfälle im Delta; `mattekiste/epic-tests.mjs:3-11,78,130-133`; `mattekiste/m5-tests.mjs:25-27`; `mattekiste/m4-tests.mjs:14,21-31`. |

GELB bedeutet brauchbarer Demonstratorkern mit offenen Arbeitsbedingungen, nicht Fachfreigabe. ROT bedeutet, dass die beanspruchte weitergehende Nutzung nicht belegt beziehungsweise durch konkrete Defekte blockiert ist. Für einen geschützten LAN-Piloten oder produktive Agentenwirkung gibt es hier keine Freigabe.

## Top 3 insgesamt

### 1. P0 — Verbliebene Vertrauensgrenzen schließen

**Belege:** `konzept/prototyp/proto.js:148-151,258,317-318`; `mattekiste/mock-broker.mjs:81-97,106-157,220-226`; `live/werkbank-server.py:48-51,93-101`.

**Empfehlung:** Gruppenheader und alle übrigen HTML-/SVG-/Attributsenken absichern, Daten strikt typisieren; Identität, Aktions-/Mandantenrechte, Ablauf und sichere Auslieferungs-/Ressourcengrenzen herstellen. Loopback bleibt die Demogrenze, nicht die Autorisierung. Akzeptanz: falscher CSRF, abgelaufene/fremde/unberechtigte Sitzung und untrusted Daten verändern/erzeugen nichts Unerlaubtes; Grenzen greifen vor Einlesen/Wirkung. Browser-/LAN-Nachweise gesondert erheben.

### 2. P1 — Einen atomaren, operationsgebundenen Wirkungskern liefern

**Belege:** `mattekiste/mock-broker.mjs:26-30,172-217`; `konzept/prototyp/proto.js:334-350,486-515`.

**Empfehlung:** Idempotenzregister, Payload-/Revisionsbindung, serialisierte atomare Zustandsänderung, reine Statusabfragen, echte Abbruchsemantik und operationsgebundenen Readback umsetzen. Undo je Aktion ehrlich benennen. Akzeptanz: Antwortverlust, identischer Retry, anderer Payload, fremder Abort/Reset, Ablauf, zwei konkurrierende Clients und fehlgeschlagene Gegenaktion produzieren keine doppelte/unbestätigte Wirkung.

### 3. P2 — Einen kleinen generischen und mobilen Fachgesamtweg abschließen

**Belege:** `konzept/prototyp/proto.js:66-68,263-308,537-545`; `konzept/prototyp/index.html:80-83,114-116`; `t1-arbeitsprofil-v3.html:174-186,263-270`; `mattekiste/m4-tests.mjs:14,21-31`.

**Empfehlung:** Bestellvorschlagsentwurf → Bearbeitung → Freigabeschritt → bestätigter Zielstand, mit erreichbarer Quittung/Fehler-/Undoentscheidung auch schmal. Anhänge und Buchungsgrenze ausdrücklich anschließen. Ein andersartiges zweites Modul ohne neue Shell-Fachzweige nachweisen. Dazu snapshotrelative echte Negativtests statt weitere bloße Erfolgsbilder; kein Frameworkwechsel als Ersatz für diesen Pfad.

## Was tatsächlich geprüft wurde

- HEAD exakt verifiziert; initialer Git-Status sauber. Vollständiger angeforderter Source-Diff gelesen: drei Runtime-Dateien, ein Dokumentnachtrag und vier binäre PNG-Änderungen.
- Selbst vollständig gelesen: `konzept/prototyp/proto.js`, `bi-glas.js`, `zeiger.js`, Prototyp-HTML, `live/index.html`, `live/tour.json`, Python-Werkbank, Mock-Broker sowie die drei V3-Template-HTML-Dateien. Ebenso alle zwölf Repository-Testskripte unter `mattekiste/`.
- Zusätzlich gelesen: Workspace-/Manifest-/Katalogschema, beide Beispiel-JSONs, pan528-/Ticker-Katalogeintrag und relevante Delegations-, Aktions-, Freigabe-, Slot- und Overlayverträge. Prüfberichtsauszüge wurden ausschließlich als zu verifizierende Aussagen verglichen. Nicht jeder übrige Katalog-/Konzepttext wurde manuell vollständig auditiert.
- Node-Syntaxkontrolle der vier Runtime-JS/MJS-Dateien; Python-Server mit `ast.parse`, ohne Import; 16 JSON-Dateien syntaktisch eingelesen. Oberster Schemafeldabgleich bestätigt den nicht erlaubten Schlüssel `datenquellen` im pan528-Katalogeintrag (`konzept/katalog-eintrag.schema.json:7-8`; `konzept/katalog-eintrag/modul.pan528.json:35-49`). Keine vollständige Schemasuite behauptet.
- Reine synthetische Node-VM-Proben mit aus Basis/HEAD extrahierten Funktionskörpern: CSRF-Wert/Format/fehlende Session/Ablaufgrenzen, Tickerheader versus Ereigniszeile, Trendtitel versus numerisch erwartete Werte, Einzelpunkt-/Nullfall und Delegationsdatum. Resultate im Sicherheitsbericht.
- Weitere HEAD-Proben: Doppelquote-Escaping von Zonen-ID/Theme bei weiterhin roher Vorlagenkennung und Personenerklärung; Slice-Grenzfälle; aktuelle Start/Retry/Abort/Status/Reset/Readback-Entscheidungen mit RAM-I/O und ausdrücklich gestubbtem Auth-Gate; vertauschte KPI-Pausenquittung und Sortierungsquittung ohne echten Vorzustand. Keine komplette Runtime importiert, keine echten Cookies, Schlüssel, Daten oder Dateien als Backend benutzt.

## Grenzen und Übergabe

Nicht verifiziert: laufende Listener/Firewall/Proxy, tatsächliche LAN- oder Browserangriffe, realer DOM/Eventhandler-/SVG-Exploit, Cookie-/HTTPSverhalten, visuelle PNG-Qualität/Frische, axe, Screenreader, Touch/Reflow, Last/Backpressure, persistente Dateirennen/Crash-Recovery, zwei echte Sessions, externe Fach-UI/führender Fachhost und tatsächliche Fachwirkung. Kein Repository-Test und keine Vollsuite wurden ausgeführt. Aus Berichten wurden keine Test-/axe-Erfolge übernommen.

Der Analyseworker nahm keine Produktänderung, Installation, Serverstart, Netzmutation, Zugangsdatenverwendung, Veröffentlichung oder Git-Schreibaktion vor. Als eigener Schreiboutput wurden ausschließlich die sechs neuen Berichtdateien dieses Pakets angelegt. Sie enthalten keine privaten Hostpfade oder Kontaktdaten. Die Existenzkontrolle gehört zur lokalen Abschlussprüfung. Die nachgelagerte Prüfung und Dokumentveröffentlichung durch den Orchestrator sind unten getrennt ausgewiesen.

## Nachgelagerte Orchestrator-Prüfung und Veröffentlichung

Der Analyseworker wurde mit `gpt-6.1-sol` und `--reasoning xhigh` gestartet und endete mit Exitcode 0. Die Modellidentität wurde am nativen Sitzungsdatensatz geprüft; eine zusätzliche unabhängige Wire-Prüfung der Reasoning-Stufe wird nicht behauptet.

Der Orchestrator las den vollständigen Diff der drei geänderten Runtime-Dateien selbst. Er wiederholte isolierte Proben mit aus dem geprüften Snapshot extrahierten Funktionskörpern, synthetischen Sessions und einem String-Sink: gültiger CSRF akzeptiert; falscher Wert verweigert; vergangener Ablauf verweigert; Gleichheitsgrenze und nichtnumerischer wahrer Ablauf weiterhin akzeptiert; rohes Gruppen-Markup weiterhin im Tickerheader, Ereignistext escaped. Keine HTTP-/Browser- oder Live-Datenprobe.

Die sechs Berichtdateien werden abschnittsweise auf dem bestehenden Reviewbranch veröffentlicht. Runde 1 bleibt erhalten; Produktdateien werden nicht verändert. Quellverweise beziehen sich ausdrücklich auf den eingefrorenen Prüfcommit `1dea6ed8a91096a023d4145b0d9f13255487fbdf`, nicht auf die Produktdateiversion im historisch von Runde 1 abgezweigten Reviewbranch. Keine Produktfreigabe, kein Merge und kein Release.
