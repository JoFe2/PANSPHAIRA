# Runde 2 — Technik, Generik und Prüfvalidität

Snapshot: `1dea6ed8a91096a023d4145b0d9f13255487fbdf`. Alle Sourcepfade/Zeilen relativ zu `psai/katalog/`. Architekturbeurteilung aus selbst gelesenem Code; keine übernommene Abnahme und keine Repository-Suite.

## 1. Qualität: brauchbarer Demonstrator, kein verlässlicher Wirkungskern

**Beleg:** `konzept/prototyp/index.html:9-18,146-148`; `konzept/prototyp/proto.js:4-12,454-532`.

Vanilla-JavaScript, lokale IIFE-Zustände, Eventdelegation und CSS-Tokens sind für diesen Demonstrator nachvollziehbar. Das Problem ist nicht ein fehlendes Framework. Transport, Konfiguration, Rendering, fachliche Demo, Delegationsandeutung, Chronik und Quittung liegen jedoch gemeinsam in `proto.js`; die anderen Dateien koppeln über globale DOM-IDs und Window-Hooks (`konzept/prototyp/proto.js:52,418,536,565`; `konzept/prototyp/bi-glas.js:152-163`; `konzept/prototyp/zeiger.js:58-60`). Die klassischen Skripte sind keine native ES-Modulgrenze.

**Empfehlung:** Den vorhandenen kleinen Browserpfad beibehalten, aber Resolver, instanzbezogenen Zustand, Renderer und DOM-unabhängigen Aktionsadapter trennen. Ein neuer Framework-/DSL-Großumbau würde die belegten Integritätsfehler nicht von selbst beheben.

## 2. B05 — Operations-ID, Revision und Parallelität

**Beleg:** `mattekiste/mock-broker.mjs:26-30,46-58,79,172-218`.

- Ein Request liest den gesamten Ledger vor der eigentlichen Routenauswertung. Nach asynchronen Unterbrechungen wird der ganze Snapshot wieder geschrieben. Producer, Bootstrap und Kommandos arbeiten ohne gemeinsame Serialisierung/CAS. Das Nachladen allein von `failMode` schützt andere Felder nicht.
- Direktes `writeFile` ersetzt den Ledger nicht atomar über eine fertig geschriebene Austauschdatei. Jeder Lese-/JSON-Fehler wird zum frischen Defaultledger. Damit kann auch Korruption wie „neuer leerer Zustand“ behandelt werden, statt den Schreibpfad zu sperren.
- `operationId` hat eine Regexprüfung, kein dauerhaftes Wiederholungsregister. Weder Payloadgleichheit noch erwartete Revision werden geprüft. Ein identischer Retry wird zustandsabhängig abgelehnt und nach Reset wieder ausführbar.
- `binding` ist ein zufällig erneuertes Antwortfeld, keine geprüfte Vorbedingung. Abort/Reset müssen die aktuelle Operations-ID nicht nennen. Sessions teilen denselben globalen Lauf.

**Eigene Probe, begrenzte Aussage:** Der aktuelle Routing-/Zustandsblock wurde mit synthetischem RAM-Ledger, RAM-Log und abgeschaltetem Auth-Gate isoliert ausgeführt. Ein Start-Retry lieferte `GUIDED_STARTER_NOT_IDLE_DENIED`; ein fremder Schlüssel durfte Abort/Reset auslösen; derselbe alte Startschlüssel durfte nach Reset erneut laufen. Das testet die Zustandsentscheidungen, nicht Dateisystematomarität, echte Konkurrenz oder HTTP-Autorisierung.

**Empfehlung:** Dauerhafte Idempotenz nach Ziel/Aktion/Schlüssel und Payloaddigest; erwartete Revision als atomare Vorbedingung; Operationsrechte und Zugehörigkeit; transaktionaler/serialisierter Schreibpfad. Zwei parallele Clients, Antwortverlust nach Wirkung, Crash beim Speichern und korrupter Speicher benötigen eigene Negativabnahmen. Ein funktionierendes RAM-Modell wäre noch kein Speichernachweis.

## 3. B06 — Ablauf, Vorher/Nachher, Undo und Readback

**Beleg:** `mattekiste/mock-broker.mjs:172-217`; `konzept/beispiele/pan528.manifest.json:15-18`.

Der Abschluss findet beim Statusabruf statt: `pending` wird `SUCCEEDED`, der Zähler steigt, ein Log wird geschrieben. Abort bestätigt nur den Wunsch und entfernt `pending` nicht. Reset ist eine Bereinigung des Kontrollzustands, keine Kompensation. Readback liest die führende Datei erneut, liefert jedoch keine dazugehörige Operations-ID, Revision oder Fachbelegreferenz. Geschäftswerte stammen in beiden Vergleichsfeldern aus `val(4)` statt aus unabhängig bestimmten erwarteten und beobachteten Effekten.

**Tatsächliches Probeergebnis:** Start A → Abort mit B → Status: `SUCCEEDED`, `abortAcknowledged=true`, Zähler 1. Reset mit B: `IDLE`, Zähler weiterhin 1. Neuer Start mit alter ID A → Status: Zähler 2. Der synthetische Readback enthielt Zähler/Laufstatus, aber keine Operations-/Revisionsbindung. `requireCsrf`, Datei-I/O und Log-I/O waren hierfür ausdrücklich Stubs; ihre reale Funktionsfähigkeit ist damit nicht behauptet.

**Empfehlung:** Statuslesen von Ausführung trennen. Abbruch vor Wirkung, Ausgang unbekannt, bereits abgeschlossene Wirkung und bestätigte Kompensation getrennt quittieren. Ein Reset darf als Kontrollreset angeboten werden, aber nicht als fachliches Undo. Erwartung, beobachteter Zielstand und Quittung müssen dieselbe Operation und Revision referenzieren.

## 4. B09 — Erfolgs- und Frischeaussagen

**Belege:** `konzept/prototyp/proto.js:112-137,201-223,326-332,536-562`; `konzept/prototyp/bi-glas.js:9-35,88-90,107-116`; `mattekiste/mock-broker.mjs:139,159-169`.

Die Liste meldet statisch einen angenommenen AI-Vorschlag; der Vergleich enthält feste Zahlen. `modulLaden` quittiert vor erfolgreichem Trendabruf. Das BI-Glas rendert Konstanten, nennt aber Quellen und aktuelle Uhrzeit. Monatswerte sind gegen Wochenkennungen beschriftet; eine unter einer Stunde liegende Stufe kombiniert berechnete Minuten mit festem `0,3 h`. Diese konkreten Herkunfts-/Beschriftungsfehler bleiben unverändert.

Kennzahlalterung beruht auf letztem erfolgreichen Empfang, nicht dem Alter von `d.stand`. `lvStand()` aktualisiert die Anzeige auch nach einem fehlgeschlagenen Statusabruf. `/api/status` bleibt erfolgreich, wenn andere Quellen durch `failMode` blockiert sind. `__strom.an` wird bereits beim Erzeugen des Streams wahr und bei Verbindungsfehlern nicht zurückgesetzt. Der Trend hat Fehlerzähler/Pause, aber kein vollständiges Last-good-/Alterungsmodell.

**Empfehlung:** Verbindungszustand, Beobachtungszeit, fachliche Quellzeit, Datenrevision und Operationsstatus getrennt führen. Demo-Werte explizit als solche markieren. Erfolg erst nach zur Aktion gehörendem Readback; Fehler dürfen keinen neuen fachlichen Frischestand vortäuschen.

## 5. B10 — Lokale Quittungs- und Lifecyclefehler

| Beleg | Feststellung | Erforderliche Restkorrektur |
|---|---|---|
| `konzept/prototyp/proto.js:499-504,511-515` | Nach Umschalten auf Pause wird „pausiert → läuft“ quittiert; beim Fortsetzen entsprechend umgekehrt. KPI-Probe bestätigte `actualPaused=true` bei dieser Quittung. | Vorzustand vor Mutation erfassen und tatsächlichen Nachzustand quittieren. |
| `konzept/prototyp/proto.js:486-493` | Sortierungsquittung löst Vorher erst nach Speichern auf. Die Probe ergab identische neue Reihenfolge auf beiden Seiten. | Alten effektiven Zustand festhalten; Grenz-No-op gesondert behandeln. |
| `konzept/prototyp/proto.js:39-41,334-350` | Alle Quittungen versprechen Undo 30s; implementiert ist nur ein DOM-bezogener Modulbutton. Der Timer versteckt den Button, die Undo-Funktion prüft keine Frist. Entfernung behauptet stets vorher „geladen“, auch aus `registriert`. | Aktionsspezifische Undo-Fähigkeit/Frist und wirklichen Vorzustand führen. |
| `konzept/prototyp/proto.js:294-322,334-350` | Neurender stellt eine entfernte Modulkarte wieder her; der entfernte Zustand wird nicht als Renderbedingung verwendet. | Lebenszyklus im Instanzmodell statt allein im DOM abbilden. |
| `konzept/prototyp/proto.js:457-464,527-545` | Personenwechsel/Override-Reset lösen `intervallSek` nicht neu auf. Die Rückübernahme erfolgt nur beim Deskriptorholen und benutzt teilweise den bisherigen Wert als Fallback. | Alle effektiven Laufoptionen nach Scope-/Grundstandswechsel neu bestimmen. |
| `konzept/prototyp/proto.js:385-388,43-50`; `konzept/prototyp/bi-glas.js:166-181` | Drawer-Historie wird trotz Reloadversprechen nicht aus persistierter Spur aufgebaut; BI-Fläche verliert sich bei Zonen-Neurender und wird wegen `autoGesehen` nicht erneut automatisch aufgebaut. | Persistierte Historie berechtigt nachladen; Ansicht und Lifecycle konsistent restaurieren. |
| `t2-nachtwache-v3.html:266,279-307,319-323` | Globales `pendingUndo` zeigt auf die zuletzt entschiedene Karte. Frühere Buttons können deren Gegenaktion auslösen. | Gegenaktion pro Karte/Entscheidung speichern und auf deren Zustand prüfen. |
| `t1-arbeitsprofil-v3.html:267-270`; `t3-redaktionell-v3.html:259-263` | Zusätzlich neu aufgefallen: wiederholte feste `id=undoBtn` plus globale Ersttrefferauswahl können den Handler dem falschen Button zuordnen. T3 ersetzt Undo durch vollständigen Reload. Unveränderter Altcode, keine Delta-Regression. | Instanzlokale Referenz verwenden; nur zugesagten Vorgang zurücknehmen, nicht andere Ansichten/Drafts verwerfen. |

Die Escape-Korrektur macht eine falsche Quittung nicht inhaltlich richtig. Reale Timer-/DOM-Wechselwirkungen wurden nicht im Browser ausgeführt.

## 6. B11 — Generik und weiterer Modulanschluss

**Belege:** `konzept/prototyp/proto.js:55-68,248-290,294-322,537-545`; `konzept/prototyp/index.html:131-148`; `konzept/workspace.schema.json:13-25,32-39`; `konzept/modul-manifest.schema.json:20-68`.

Der Renderer sucht feste Tenant-/Modul-IDs und entscheidet Inhalt über `id.includes("finanzen")`. Andere Zonen erhalten Startseiteninhalt; Zonennamen sind auf zwei feste Beschriftungen reduziert. Zusätzliche Instanzen vervielfachen globale IDs wie `kz`, `ticker` und `modulCard`. Selektoren treffen dann nicht verlässlich die beabsichtigte Instanz. `vorlagen` ist im Schema optional, im Renderer wird unmittelbar `.find` aufgerufen. Ein formal zulässiger Baum ohne den speziellen Tenant führt ebenfalls nicht zu einer kontrollierten Fehlerkarte. Der Deskriptor wird ohne Schema-/Versionsvalidierung übernommen; ein Catch unterdrückt Fehler (`konzept/prototyp/proto.js:537-545`).

Manifestaktionen, Rollenfreigaben, Slotzuweisungen und Datenadapter werden im Composer nicht generisch geladen. Beispielsweise erlaubt die eingebettete Intervallauswahl andere Werte als das Manifest (`konzept/prototyp/proto.js:267-268`; `konzept/beispiele/pan528.manifest.json:30`). `ticker.maxEintraege` ist nur Katalogmetadatum, kein angeschlossenes Limit (`konzept/katalog-eintrag/komponente.ticker-zeile.json:6-8`; `konzept/prototyp/proto.js:143-163`). Die deklarative DSL ist deshalb ein Beschreibungsmodell mit Spezialrenderer, noch kein allgemeiner Interpreter.

**Mechanischer Schemawiderspruch:** `konzept/katalog-eintrag.schema.json:7-8` verbietet unbekannte oberste Felder, während `konzept/katalog-eintrag/modul.pan528.json:35-49` `datenquellen` ergänzt. Der Feldabgleich ergab genau diesen undeclarierten Schlüssel. Die Aussage „alle Einträge schema-valid“ in `konzept/VALIDIERUNGSBERICHT.md:112-113` kann für diesen Eintrag/Snapshot nicht gelten. Es wurde keine vollständige Schema-Validator-Suite ausgeführt.

**Empfehlung:** Validierter Resolver mit Sperren/Rechten; Registry für Renderer/Slots/Adapter; eindeutige Modulinstanz-IDs; deklarative Aktionen auf einem Hostvertrag. Als Generiknachweis ein fachlich andersartiges zweites Modul ohne neuen Tenant-/Domänenzweig im Shellcode anschließen. Bestehende Schemata und tatsächliche Einträge zuerst konsistent machen.

## 7. Skalierungs- und Wiederanlaufgrenzen

**Belege:** `konzept/prototyp/proto.js:55-66,112-137,141-197,294-322,547-571`; `konzept/prototyp/bi-glas.js:168-181`; `mattekiste/mock-broker.mjs:26-35,46-61,118`.

Wiederholte rekursive Baumauflösung, kompletter Zonen-DOM-Ersatz, ein unbeschränkt wachsender und vollständig sortierter Ticker, globale MutationObserver und ganze Ledger-/Spurdateien begrenzen lange Laufzeiten und Mehrmodulbetrieb. Timer und SSE dürfen denselben Datenabruf überlappend auslösen. In-flight-Steuerung, Antwortrevisionen und Abbruchmechanismen fehlen; ein vor Pause gestarteter Abruf kann nach Pause noch Daten übernehmen. SSE liefert keinen verbindlichen Resynchronisationspunkt. Das sind statische Risiken; kein Durchsatz-, RAM-, Nutzerzahl- oder Latenzwert wurde gemessen.

**Neu gefundene Altverdrahtung:** Der Zeiger sucht für Trend `#trend`, der Composer erzeugt `#trendBild` (`konzept/prototyp/zeiger.js:128-137`; `konzept/prototyp/proto.js:289`). Der Blick wird damit bei diesem Ziel nicht gefunden. Unverändert gegenüber der Basis, keine neu eingeführte Regression.

**Empfehlung:** Instanzbezogene bounded Stores, versionierte Antworten, definierte Pause-/Resume-Semantik und ein konsistenter Reconnect-Snapshot. Zuerst den kleinen Gesamtweg stabilisieren, dann anhand realer Messungen optimieren.

## 8. B13 — Was die Tests tatsächlich prüfen und was nicht

Die zwölf Repository-Testskripte wurden gelesen, nicht ausgeführt. Kein Skript wurde im Delta angepasst.

- Konstante Erfolgsassertionen: Klickstrecke in `mattekiste/epic-tests.mjs:78`, unveränderte Fokusliste in `mattekiste/m5-tests.mjs:25-27`.
- Fehler werden teilweise nur gedruckt, nicht als Fehlerexit geliefert: `mattekiste/epic-tests.mjs:130-133`, `mattekiste/m123-tests.mjs:115-119`. Die neueren M4–M7a-Skripte setzen dagegen einen aus Befunden abgeleiteten Exitstatus (`mattekiste/m4-tests.mjs:43-45`; `mattekiste/m5-tests.mjs:64-66`; `mattekiste/m6-tests.mjs:78-80`; `mattekiste/m7a-tests.mjs:53-55`). Keine pauschale Gleichsetzung aller Tests.
- Kleinere Diagnose-Skripte melden mehrere negative Zustände nur per Konsole; ein Spur-Wait wird abgefangen (`mattekiste/bi-test.mjs:15-18,37-55`; `mattekiste/spur-test.mjs:19-25,31-36`; `mattekiste/strom-test.mjs:16-20,30-36`; `mattekiste/zeiger-loop-test.mjs:28-30`).
- Tests lesen veralteten Schleifenschlüssel, Runtime verwendet den manuellen Schlüssel (`mattekiste/bi-test.mjs:15-16`; `mattekiste/zeiger-loop-test.mjs:28-29`; `konzept/prototyp/zeiger.js:98-103,231-235`).
- M4 startet einen nicht snapshotrelativen Broker und eine externe Fach-UI, prüft CSRF nur ohne Session und akzeptiert Readback-Schlüsselwörter/Zähler (`mattekiste/m4-tests.mjs:14,21-31`). Das belegt gerade nicht die neuen Fälle „Session vorhanden, falscher Wert“ oder Ablauf.
- Harte benutzerspezifische Start-/Browserpfade und bloße Screenshot-Dateiexistenz schränken Portabilität und Frischebeweis ein (`mattekiste/epic-tests.mjs:3-11,46-52`; `mattekiste/m123-tests.mjs:4-15`).
- Quell-/Touränderungen ohne abgesichertes `finally` sowie Löschen, Prozessbeendigung und Serverstart sind in diesen Skripten enthalten (`mattekiste/strom-test.mjs:32-36`; `mattekiste/zeiger-tour-test.mjs:21-25`; `mattekiste/m4-tests.mjs:10-16,35-45`). Sie wurden deshalb nicht zur schreibfreien Nachprüfung benutzt.
- Eine Quittung enthält das Wort „pausiert“ auch bei vertauschtem Vorher/Nachher (`mattekiste/m7a-tests.mjs:33-34`); die Agententests decken nur ausgewählte Themefälle ab (`mattekiste/m6-tests.mjs:59-70`).

**Empfehlung:** Echte Assertions mit Fehlerstatus, snapshotrelative isolierte Fixtures, Cleanup und gezielte Negativfälle. Neue Gruppen-XSS-/Ablauf-/Idempotenzproben gehören dazu. Bestehende Berichte oder PNGs ersetzen keinen erneuten Lauf.

## 9. Eigene Prüfungen und Grenzen

Tatsächlich ausgeführt: Git-Snapshot-/Diff-/Statusprüfung; Node-Syntaxprüfung für `proto.js`, `bi-glas.js`, `zeiger.js` und `mock-broker.mjs`; `ast.parse` für den Python-Server; JSON-Syntaxeinlesen von 16 Dateien (drei Schemas, zwei Beispiele, elf Katalogeinträge); oberster Schemafeldabgleich des pan528-Eintrags; ausgewählte reine, aus Source extrahierte Funktions-/Zustandsproben.

Nicht ausgeführt: Repository-Tests, Vollsuite, Installation, Server, Browser, axe, echter Screenreader, Fachhost, persistente Daten-/Crash-/Parallel-/Lastabnahme. Die detaillierten synthetischen Sicherheitsergebnisse stehen in `01-sicherheit.md`. Die beobachteten Defekte sind nicht durch Syntaxerfolg oder einen regulären Prozessabschluss beseitigt.
