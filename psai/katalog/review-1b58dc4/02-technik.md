# 02 — Technik, Qualität und generische Wiederverwendung

Snapshot: `1b58dc4879a7b8bba37ae40005f4db6b8affb410`. Alle Quellverweise sind relativ zu `psai/katalog/` und beziehen sich auf diesen eingefrorenen Commit. Statischer Review, keine Browser-/Hostabnahme.

### B05 — Hoch: Operations-ID ist keine Idempotenz; Revisionen und globale Schreibkonflikte sind ungesichert

**Belege:** `mattekiste/mock-broker.mjs:26-30,46-58,79,172-218`.

Der Kommandopfad validiert nur das Format der `operationId`. Es gibt kein gespeichertes Idempotenzregister, keinen Payload-Abgleich bei Wiederholung und keine atomare Vorbedingung anhand einer Revision. Ein erneutes `RUN_STARTER` nach Antwortverlust erhält bei inzwischen verändertem Zustand eine Zustandsverweigerung statt derselben Quittung. Nach einem Reset kann ein alter Auftrag erneut Wirkung auslösen.

`ABORT_STARTER` und `RESET_STARTER` müssen nicht die ID des aktuellen Laufs referenzieren. `binding` wird ausgegeben und neu erzeugt, aber nicht gegen einen eingereichten Wert geprüft. Alle Sessions teilen denselben `D.run` und Laufstatus.

Hinzu kommt die Dateikonkurrenz: Jeder Request liest einen kompletten Ledger, verändert ihn nach asynchronen Unterbrechungen und schreibt ihn vollständig zurück. Es fehlen Serialisierung, Compare-and-swap und atomarer Dateiaustausch. Producer und Requests können sich gegenseitig Sessions, Zähler, Ereignisse oder Laufstatus überschreiben. Das zusätzliche Nachlesen von `failMode` repariert nicht die übrigen Felder. Ein Lese-/JSON-Fehler wird pauschal zu einem frischen Standardledger umgedeutet; während eines nichtatomaren Schreibens kann dadurch ein bestehender Zustand scheinbar verschwinden.

### B06 — Hoch: Statuslesen führt aus; Abort quittiert keinen Abbruch; Reset ist kein fachliches Undo

**Belege:** `mattekiste/mock-broker.mjs:172-190,198-217`; `konzept/beispiele/pan528.manifest.json:14-18`.

`/guided/status` ist kein reiner Readback: Bei `pending` setzt gerade dieser Abruf den Lauf auf `SUCCEEDED`, erhöht den Zähler, speichert und schreibt einen Logeintrag. Ein Beobachter verändert damit die beobachtete Operation.

`ABORT_STARTER` setzt nur `abortAcknowledged`. `pending` bleibt bestehen und die Statuslogik ignoriert das Abbruchflag. Der nächste geeignete Statusabruf kann den vermeintlich abgebrochenen Auftrag weiter erfolgreich abschließen.

`RESET_STARTER` entfernt Laufmetadaten und setzt `IDLE`, nimmt den bereits erhöhten Zähler jedoch nicht zurück. Das kann als bewusst reine Kontrollzustandsbereinigung zulässig sein, ist aber kein Rückbau einer Fachwirkung. Die Manifestangabe eines Undo-Fensters macht daraus keine Kompensation.

`/guided/readback` liest tatsächlich erneut eine Datei — ein sinnvoller Ansatz. Die Antwort enthält aber weder die zu verifizierende Operations-ID noch eine Revision oder einen fachlichen Wirkungsbeleg. Erwartete und beobachtete Geschäftswerte kommen in `st()` aus derselben Konstante `val(4)`. Das bestätigt den Demo-Ledger, nicht die im Manifest beschriebene Wareneingangs-/Reservierungswirkung und erst recht keinen ungeprüften externen Fachhost.

### B09 — Mittel bis hoch: Grüne Zustände und Frischebehauptungen übersteigen die Datenlage

**Belege:** `konzept/prototyp/proto.js:116,199-206,212-222,325-331,535-561`; `konzept/prototyp/bi-glas.js:9-35,88-90,107-116`; `mattekiste/mock-broker.mjs:138-169`.

Die Composer-Liste behauptet statisch „AI-Vorschlag angenommen“ mit positivem Badge; der Vergleich zeigt feste Rechnungszahlen. Es findet dafür kein entsprechender fachlicher Readback statt. `modulLaden()` quittiert bereits „geladen“, bevor der nachfolgende Trendabruf erfolgreich sein muss.

Das BI-Glas enthält ausschließlich Konstanten, beschriftet sie aber mit „Quellen dq.beleg · dq.mengen“ und der aktuellen Renderuhrzeit. Es liest diese Quellen nicht. Außerdem werden als „je Monat“ bezeichnete Werte über Wochenkennungen dargestellt. Beim Durchlaufwert `0.4` wird eine zweite, fest eingebaute Stundenangabe `0,3 h` angehängt. Das sind konkrete Herkunfts-/Beschriftungsinkonsistenzen, nicht gemessene Fachkennzahlen.

`__strom.an` wird bereits beim Erzeugen des EventSource auf `true` gesetzt und bei Verbindungsfehlern nicht zurückgenommen. `lvStand()` verwendet die aktuelle UI-Uhrzeit, auch nach einem fehlgeschlagenen Statusabruf; die Kennzahlalterung orientiert sich am Empfangszeitpunkt statt am fachlichen `d.stand`. Ein alter Quellstand kann dadurch als frisch erscheinen. `/api/status` meldet seinen Demo-Status auch bei aktivem `failMode` weiter erfolgreich. Der Trend kennt einen Fehlerzähler, aber kein vollständiges Alterungsmodell für den letzten guten Stand.

### B10 — Mittel: Quittung, Undo und lokaler Lifecycle sind inkonsistent

**Belege:** `konzept/prototyp/proto.js:38-40,293-321,333-349,384-387,455-463,485-513,526-543`; `t2-nachtwache-v3.html:266,279-307,319-323`.

- Beim Pausieren von Kennzahl und Trend sind Vorher/Nachher vertauscht: Nach Setzen des Pausenflags wird „pausiert → läuft“ quittiert (`proto.js:501,512`).
- Die Sortierungsquittung liest ihren vermeintlichen Vorzustand erst nach dem Speichern der neuen Reihenfolge. Beide Seiten können identisch sein (`proto.js:489-491`).
- Die allgemeine Quittungsfunktion verspricht für jede Verwendung „Undo 30s“, obwohl nur die Modulentfernung einen entsprechenden Button erzeugt. Ein Countdown, eine generische Gegenaktion und eine serverseitig verbindliche Frist fehlen.
- Modulentfernung entfernt nur DOM. Jeder spätere Zonen-Neuaufbau rendert die Karte unabhängig vom Zustand `entfernt` erneut. Der Undo-Timer versteckt lediglich den Button; er ist kein geschützter Ablaufvertrag.
- Beim Personenwechsel und beim Verwerfen der Overrides wird das Intervall nicht neu aus dem jeweiligen Profil aufgelöst. Diese Wiederherstellung geschieht nur beim Deskriptorholen. Damit kann das aktive Intervall aus der vorherigen Person weiterwirken.
- Der Drawer verspricht Historie „auch nach Neuladen“, lädt beim Aufbau aber keine persistierte Chronik. Das BI-Glas verliert bei einem vollständigen Zonen-Neurender seinen Inhalt; `autoGesehen` verhindert die anfängliche automatische Wiederöffnung (`bi-glas.js:166-181`).
- In T2 ist `pendingUndo` global statt pro Karte. Bei zwei genehmigten Karten oder Sammelfreigabe überschreibt die letzte Entscheidung diesen Verweis. Ein früherer Undo-Button führt dann die Gegenfunktion der zuletzt entschiedenen Karte aus, nicht die seiner eigenen Karte.

### B11 — Mittel bis hoch: Deklarative Verträge sind nicht mit dem Runtime-Verhalten verbunden

**Belege:** `konzept/prototyp/proto.js:54-67,247-258,262-290,300-321,536-543`; `konzept/prototyp/index.html:146-148`; `konzept/workspace.schema.json:13-25`; `konzept/katalog-eintrag.schema.json:6-8,22-36`; `konzept/katalog-eintrag/modul.pan528.json:35-49`.

Der Renderer sucht feste IDs für `mandant.tenant-a`, `finanzen` und `pan528`. Ein nicht als Finanzen erkannter Bereich erhält automatisch den Startseiteninhalt. Es gibt keine generische Modul-/Slot-Registry und kein Laden der Manifestaktionen in diesem Composer. Vorlagenkennungen werden teilweise angezeigt, bestimmen aber nicht den behaupteten vollständigen Layout-/Funktionsaufbau.

Schon schemaformal zulässige andere Bäume sind nicht unterstützt: Der Tenant kann fehlen, `vorlagen` ist im Knotenschema optional, der Code erwartet aber beispielsweise `knoten(...).children` beziehungsweise `k.vorlagen.find(...)`. Ein weiterer gleichartiger Bereich vervielfacht zudem feste DOM-IDs wie `kz`, `ticker` oder `modulCard`; die globalen Selektoren bearbeiten dann nicht zuverlässig die jeweilige Instanz. Unbekannte/defekte Deskriptoren führen statt einer lesbaren Fehlerkarte teilweise in einen leeren Catch.

Ein konkreter Schemawiderspruch wurde zusätzlich mechanisch nachvollzogen: `katalog-eintrag/modul.pan528.json` besitzt das oberste Feld `datenquellen`, obwohl `katalog-eintrag.schema.json` dort `additionalProperties: false` setzt und dieses Feld nicht deklariert. Dieser Eintrag kann gegen das mitgelieferte Schema nicht gültig sein. Die Erfolgsbehauptung „alle Einträge schema-valid“ in `konzept/VALIDIERUNGSBERICHT.md:112-113` gilt somit nicht für den geprüften Snapshot.

### B13 — Hoch für die Abnahme: Testaussagen sind teilweise nicht prüfend oder nicht snapshotgebunden

**Belege und konkrete Lücken:**

- `mattekiste/epic-tests.mjs:78` bestätigt die Klickstrecke mit konstantem `true`; `mattekiste/m5-tests.mjs:25-27` bestätigt „Liste unverändert“ ebenfalls ohne Vergleich zum Vorzustand. Diese Prüfungen können den genannten Fehler nicht erkennen.
- `epic-tests.mjs:130-133` und `m123-tests.mjs:115-119` drucken Fehlerzahlen, setzen daraus aber keinen fehlerhaften Prozessstatus. Die neueren M4–M7-Skripte tun dies teilweise besser.
- `bi-test.mjs:15-18,37-55`, `spur-test.mjs:19-25,31-36`, `strom-test.mjs:16-20,30-36` und `zeiger-loop-test.mjs:28-30` melden etliche negative Ergebnisse nur per `console.log`; beim Spurtest wird sogar ein fehlgeschlagenes Warten abgefangen. Ein reguläres Ende ist dort kein Bestanden-Nachweis.
- `zeiger-loop-test.mjs:28-29` und `bi-test.mjs:15-16` lesen den alten Schlüssel `zeiger.schleife`, während die Runtime `zeiger.schleife.manuell` verwendet und den alten Schlüssel entfernt (`zeiger.js:98-103,231-235`). Das prüft nicht den maßgeblichen Zustand.
- `m4-tests.mjs:14` startet eine Brokerdatei aus einem externen Scratchpfad, nicht zwingend die Datei dieses Snapshots. Auch dessen Fach-UI stammt aus einem außerhalb des Prüfumfangs liegenden Baum. Der Test auf CSRF-Verweigerung `m4-tests.mjs:21-24` prüft nur „ohne Session“, nicht „mit Session, aber falschem CSRF“, abgelaufene Session oder falsche Rolle. Der Readback-Test `m4-tests.mjs:28-31` akzeptiert Schlüsselwörter und einen positiven Zähler statt einer zur Operation passenden Wirkung.
- Harte `benutzerspezifische absolute Pfade`-Pfade und ein festes macOS-Browserbinary verhindern einen selbsttragenden, portablen Nachweis, etwa `m123-tests.mjs:4-15`. `epic-tests.mjs:46-52` prüft Screenshot-Dateiexistenz, nicht Frische oder visuelle Gleichheit.
- `strom-test.mjs:32-36` und `zeiger-tour-test.mjs:21-25` überschreiben Quell-/Tourdateien ohne abgesichertes `finally`. `m4-tests.mjs:10-16,35-45` löscht Daten, beendet Prozesse und lässt den neu gestarteten Broker ohne expliziten abschließenden Stop. Diese Skripte wären mit einem rein lesenden Reviewauftrag unvereinbar und wurden nicht ausgeführt.
- `m7a-tests.mjs:33-34` prüft nur das Vorkommen von „pausiert“ und erkennt die vertauschte Quittung nicht. `m6-tests.mjs:59-70` prüft ausgewählte Themefälle, nicht die anderen schreibenden Aktionen, fehlende Frist oder Stufe-3-Ablauf.

Die vorhandenen Tests sind als Interaktionsbeispiele nützlich. Sie belegen aber weder sichere Autorisierung noch Revisionskonflikte, Antwortverlust, Wiederholung, stale Readback, fehlgeschlagenes Undo, isolierte parallele Sessions oder Schutz vor übergroßen Eingaben. Angaben aus `TESTMATRIX.md` und `VALIDIERUNGSBERICHT.md` wurden nicht als selbst erhobene Ergebnisse übernommen. `VO-ERZEUGNIS-M7.md:3-15` beschreibt selbst keinen abgeschlossenen Hörlauf; ein DOM-/ARIA-Extrakt wird hier nicht als Screenreader-Erfolg gewertet.

## 4. Vanilla-ES-Architektur, Skalierung und UI-DSL

### Was bereits trägt

Die Browserseite kommt ohne Runtime-Framework aus. IIFEs begrenzen unbeabsichtigte globale Variablen; Ereignisdelegation vermeidet einen separaten Listener für jeden neu gerenderten Button (`proto.js:453-531`). CSS-Variablen und Zonen-Themes ermöglichen ein sichtbares Mosaik (`konzept/prototyp/index.html:9-18,85-112`). Quelle, Vorlagenreferenz, Option und Aktion sind in den Dokumenten sinnvoll voneinander abgegrenzt (`konzept/GLOSSAR.md:7-21`). Das ist ein brauchbarer Ausgangspunkt, kein Grund für einen Frameworkwechsel.

### Was die Wiederverwendung derzeit begrenzt

Die Dateien werden als klassische Skripte geladen, nicht als native ES-Module (`konzept/prototyp/index.html:146-148`). Die Dateitrennung ist deshalb keine belastbare Modulgrenze: `window.biUmbauen`, `window.__tick`, `window.drawerAuf` und globale DOM-IDs bilden die Kopplung. `proto.js` enthält zugleich Transport, Resolver, Zustand, HTML-Renderer, Fachdemo, Autorisierungsandeutung und Quittung.

Die deklarativen Aktions-/Slotverträge aus `konzept/AKTIONEN-QUITTUNG.md:3-5` und `SLOT-KATALOG.md:12-20` werden nicht vom Composer interpretiert. Katalogoptionen wie `ticker.maxEintraege` sind Metadaten, keine tatsächlich angeschlossenen Runtime-Parameter. Die UI-DSL ist daher momentan ein Beschreibungsmodell mit spezialisierten Renderern, keine allgemein verwendbare ausführbare Sprache.

Für eine minimale wiederverwendbare Fassung genügen ein validierter Resolver mit aufgelöstem Eigentümer/Sperrgrund, eine Renderer-/Slot-Registry, explizite Komponenteninstanzen und ein vom DOM unabhängiger Aktionsadapter. Ein fremdes Manifest darf dabei Daten und erlaubte Aktionskennungen beschreiben, aber keine beliebigen HTML-/Skript- oder Selektor-Kommandos erhalten. Autorität bleibt beim Host, nicht in der DSL. Diese Ausgestaltung gehört zu Maßnahme 3 unten, nicht zu einem zusätzlichen Großumbau.

### Statische Skalierungsgrenzen

Baumknoten und Elternpfade werden pro Zone mehrfach rekursiv gesucht; ein Index oder aufgelöster Snapshot fehlt (`proto.js:54-65,241-258,300-317`). Jeder Theme-/Sortierungswechsel ersetzt den gesamten Zonen-DOM. Der BI-Observer durchsucht auf jede Änderung im gesamten `body` erneut globale Ziele (`bi-glas.js:168-181`).

Der Ticker sortiert und rendert den kompletten, unbeschränkt wachsenden Ereignisbestand. Jeder Client liest Daten erneut, obwohl SSE nur die Änderungsart signalisiert. Timer und SSE können gleichzeitig Abrufe auslösen; es gibt keine übergreifende In-flight-Sperre, Antwortrevision oder Abbruchsteuerung (`proto.js:111-131,152-166,170-197,551-570`). Der Ledger wird requestweise vollständig eingelesen und serialisiert. Das genügt als kleine Demo, liefert aber keine belastbare Aussage über viele Module, lange Laufzeiten oder mehrere Benutzer. Last-, Speicher- und Latenzzahlen wurden nicht erhoben.

