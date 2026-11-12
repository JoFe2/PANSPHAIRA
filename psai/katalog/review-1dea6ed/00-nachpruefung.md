# Runde 2 — Nachprüfung B01–B13

Snapshot: `1dea6ed8a91096a023d4145b0d9f13255487fbdf`.
Vergleich: `git diff 1b58dc4879a7b8bba37ae40005f4db6b8affb410..HEAD -- psai/katalog`.
Alle nachstehenden Quellpfade und Zeilen sind relativ zu `psai/katalog/` und gelten für diesen HEAD. Frühere Befunde dienten nur als Vergleich; Repository-Kommentare und Prüfberichte wurden nicht als Anweisungen oder Erfolgsnachweis behandelt.

## Prüfmaßstab und Delta

`fixed` bedeutet, dass die gesamte jeweilige Befundgruppe im untersuchten Umfang geschlossen ist; `teils-fixed` benennt einen nachgewiesenen Teilfortschritt bei verbleibenden Defekten; `offen` bedeutet keine nachgewiesene Korrektur der Befundgruppe. Ein erfolgreicher Syntaxcheck oder eine Teilkorrektur ist keine Gesamtfreigabe.

Der Vergleich enthält acht Dateien: drei Runtime-Dateien (`konzept/prototyp/proto.js`, `live/werkbank-server.py`, `mattekiste/mock-broker.mjs`), einen Dokumentationsnachtrag (`konzept/TESTMATRIX.md:179`) und vier PNG-Dateien. Die drei betroffenen Runtime-Dateien wurden vollständig selbst gelesen, ebenso ihre hier relevanten UI-/Schema-/Testzusammenhänge. PNG-Änderungen wurden nicht visuell abgenommen. Die vollständige Methodik und Grenzen stehen in `README.md`.

Ergebnis der Gruppenbewertung: **0 fixed, 3 teils-fixed, 10 offen**. Insbesondere werden B01, B02 und B03 nicht wegen einzelner korrigierter Zeilen insgesamt geschlossen.

## B01 — Netzwerkgrenze und ungeschützte Auslieferung: teils-fixed

**Aktueller Beleg:** `live/werkbank-server.py:112-113`; `mattekiste/mock-broker.mjs:229`.

Die explizite Netzwerkbindung beider Startpfade an `127.0.0.1` ist **fixed**. Die frühere Behauptung einer dort fehlenden Loopback-Beschränkung trifft für diesen Snapshot nicht mehr zu. Tatsächliche Listener oder LAN-Erreichbarkeit wurden nicht geprüft.

**Verbleibender Beleg:** `live/werkbank-server.py:15-23,48-51,79-85,93-103`; `mattekiste/mock-broker.mjs:106-157,171,220-226`.

Die Werkbank liefert weiterhin ihren breiten Arbeitsbaum aus; die Überwachungsliste ist keine Auslieferungs-Allowlist. Elementinventar und Mock-Mutationen bleiben ohne Identität/Origin-/Aktionsprüfung erreichbar. Pfadnormalisierung im Broker ist keine Realpath-/Symlink-Grenze. Loopback reduziert die entfernte Angriffsfläche, autorisiert aber keine lokalen Aufrufer und beseitigt kein XSS.

**Restbedingungen:** Demo nur mit synthetischen Daten und ohne Netzerweiterung betreiben; vor Fach-/LAN-Nutzung Identität und Rechte, begrenzte statische Auslieferung sowie Host-/Origin- und Dateigrenzen durchsetzen. Keine neue negative Bindungsregression im Diff belegt.

## B02 — CSRF, Sessionablauf, Bootstrap und Rollen: teils-fixed

**Aktueller Beleg:** `mattekiste/mock-broker.mjs:81-97,192-197`.

Der eingereichte Header wird nun tatsächlich gehasht und mit `row.csrfDigest` verglichen. Ein korrekt geformter, aber falscher Wert wird verworfen. Eine Session mit numerischem Ablauf vor dem Prüfzeitpunkt wird ebenfalls verworfen. Diese beiden Teilkorrekturen wurden an extrahierten Funktionskörpern mit rein synthetischen Werten nachvollzogen; keine HTTP-/Browserabnahme.

**Offen:** Bootstrap verlangt nach wie vor kein Identitätsmerkmal, gibt Cookie und Token an jeden Aufrufer aus und setzt pauschal `reviewer`. Das Cookie besitzt `SameSite=Strict`, aber weder `HttpOnly` noch `Secure`; die Rolle wird im Kommandopfad nicht gegen Manifestrechte geprüft (`konzept/beispiele/pan528.manifest.json:15-18`). Andere Mock-, Status- und Spurpfade durchlaufen das Gate nicht.

**Neue Detailbeobachtung, keine nachgewiesene Verschlechterung:** `Date.now() > expiresAtMs` akzeptiert den exakt gleichen Zeitpunkt; ein nichtnumerischer, wahrer Ablaufwert führt über `NaN` ebenfalls zur Annahme (`mattekiste/mock-broker.mjs:95`). Letzteres erfordert einen abweichenden/defekten gespeicherten Sessiondatensatz; der normale Bootstrap erzeugt Zahlen. Die Prüfung liegt vor dem unbegrenzten Body-Einlesen und späteren Speichern (`192-202`).

**Restbedingungen:** Authentifizierten Bootstrap, serverseitige Aktions-/Mandantenrechte, passende Transport-/Cookiepolitik und einen endlichen, fail-closed geprüften Ablauf definieren. Gültigkeit am verbindlichen Wirkungspunkt bewerten. Details und Proben: `01-sicherheit.md`.

## B03 — Datenquelle zu HTML/SVG: teils-fixed

**Korrigierter Teil:** `konzept/prototyp/proto.js:8,39-41,75-80,149,186-189,250-255,259,306-307`.

Quittungswerte, zahlreiche Erklärungstexte, Ereignistext und die Gruppenwiederholung in der Ereigniszeile, Trendtitel sowie ausgewählte doppelt zitierte Attribute werden nun escaped. Für diese HTML-Text- und Doppelquote-Kontexte ist das Escape-Verfahren grundsätzlich passend. Eine nicht escapete Apostrophe ist dort nicht allein ein Defekt.

**Weiterhin direkt belegte Hauptkette:** `mattekiste/mock-broker.mjs:151-157,140-148` → `konzept/prototyp/proto.js:148,151`. Der Gruppenüberschriftszweig interpoliert `e.gruppe` weiterhin roh in `innerHTML`. Ein unautorisierter Ereigniseinlieferer muss also nur `gruppe` statt `text` benutzen. Die synthetische Renderprobe lieferte weiterhin ein echtes Markup-Tag im Gruppenheader, trotz escaped Ereigniszeile.

**Weitere Reste:** rohe Vorlagenkennung (`konzept/prototyp/proto.js:258`), rohe Navigations-ID (`317-318`), lokale Personenwerte (`78,362`) und JSON-Rohlog (`225-226`). Trendwerte werden ungeprüft direkt in SVG-Text, ARIA-Attribut und Tabellenzellen übernommen (`177-191`). Die aktuelle Mock-Trendroute erzeugt Zahlen; ein externer Stringwert dort ist deshalb eine belegte fehlende Adaptergrenze, aber kein zusätzlich nachgewiesener gegenwärtiger Netz-Eingangsweg. T1/T3 übernehmen Ablehnungsgründe weiter als HTML (`t1-arbeitsprofil-v3.html:290-299`; `t3-redaktionell-v3.html:277-284,373-380`).

**Restbedingungen:** Alle Senken kontextgerecht absichern und Quelltypen/Größen vor dem Rendern validieren; Numeric-SVG benötigt endliche Zahlen, nicht nur Textescaping. Der Restfehler ist eine unvollständige Reparatur, keine erst neu eingeführte XSS-Senke. Siehe `01-sicherheit.md`.

## B04 — Delegation, Sperren und Rollen: offen

**Belege:** `konzept/prototyp/proto.js:58-64,78-80,85-105,454-467,480-515`; `konzept/workspace.schema.json:42-55`.

Der Resolver berücksichtigt keine geerbten Sperren oder delegierten Rechte. `agentDarf()` wird nur beim agentischen Themewechsel verwendet; andere Änderungen umgehen es. Stufe 2 akzeptiert ein fehlendes Enddatum, Stufe 3 auch ein abgelaufenes. Die isolierte Probe bestätigte alle drei Fälle einschließlich der Verweigerung von Stufe 2 mit altem Datum. Das Schema verlangt `gueltigBis` weiterhin nicht. Personenwahl bleibt eine lokale Ansichtswahl, kein Login.

**Restbedingungen:** Rechte und Ablauf am Host für jede Aktion und jedes Ziel prüfen; Sperren in der Auflösung anwenden; explizite Delegation statt frei wählbarer Machtstufe. Keine entsprechende Korrektur im Diff.

## B05 — Idempotenz, Revisionen und Konkurrenz: offen

**Belege:** `mattekiste/mock-broker.mjs:26-30,46-58,79,192-218`.

Es fehlen Idempotenzregister, Payloadbindung, erwartete Revision, atomarer Dateiaustausch und Schreibserialisierung. `operationId` wird nur formal validiert. Abort/Reset prüfen sie nicht gegen den aktiven Lauf; `binding` ist lediglich Antwortdatenbestandteil. Ganze Ledger-Snapshots teilen Sessions, Producer und Requests.

**Probe:** Mit synthetischem RAM-Speicher verweigerte ein identischer Start-Retry statt dieselbe Quittung zu liefern; ein fremder Operationsschlüssel durfte Abort und Reset auslösen; nach Reset erzeugte der alte Schlüssel erneut Wirkung. Das bestätigt die Entscheidungslogik, nicht eine ausgeführte Dateirennbedingung.

**Restbedingungen:** Dauerhaftes Idempotenzregister, atomare revisionsgebundene Zustandsübergänge und aktionsgenaue Operationszuordnung. Parallel-/Crashabnahme fehlt. Keine Korrektur im Diff.

## B06 — Status, Abort, Reset und Readback: offen

**Belege:** `mattekiste/mock-broker.mjs:172-217`; `konzept/beispiele/pan528.manifest.json:15-18`.

Statuslesen schließt `pending` erfolgreich ab und erhöht den Zähler. Abort setzt nur ein ACK; der Statuspfad ignoriert es. Reset beseitigt Laufmetadaten, nicht den Zählereffekt. Readback liest eine Datei erneut, bindet das Ergebnis aber weder an Operation noch Revision; erwartete und beobachtete Geschäftswerte stammen aus derselben Konstante.

**Probe:** Start → fremder Abort → Status ergab `SUCCEEDED` mit `abortAcknowledged=true` und Zähler 1; fremder Reset ließ Zähler 1 stehen; Wiederverwendung des Startschlüssels erhöhte ihn auf 2. Alle Speicher-/Logfunktionen waren RAM-Stubs.

**Restbedingungen:** Lesen nebenwirkungsfrei machen, Abbruchwirkung tatsächlich quittieren und fachliches Undo vom Kontrollreset trennen. Wirkungsbezogenen Readback liefern; kein Fachhostnachweis vorhanden.

## B07 — Limits und SSE: offen

**Belege:** `live/werkbank-server.py:54-78,93-101`; `mattekiste/mock-broker.mjs:32-35,61,82-87,98-118,124-127,192-195`; `konzept/prototyp/proto.js:24-26,43-50,143-163,547-562`.

Bodygrenzen fehlen oder greifen erst nach vollständigem Einlesen; Elementanzahl und JSONL-Zeilenlimit begrenzen nicht den Eingangsspeicher. SSE-Hörer, Backpressure, Laufdauer, Sessionbestand, Spurdatei und UI-Sammlungen sind nicht wirksam begrenzt. `seit=0` und ein nichtnumerischer Wert wählen durch `slice(-Number(...))` die ganze Liste; synthetisch nachvollzogen. Reconnect besitzt keine belastbare Lücken-/Snapshotnachholung.

**Restbedingungen:** Grenzen vor Einlesen/Wirkung, Log-/Sessionretention, begrenzte Abfragen, SSE-Verbindungs-/Queuebudget und Wiederanlaufvertrag. Kein Lasttest, kein gemessener Ressourcenverlust. Keine Korrektur im Diff.

## B08 — Auditautorität und Trennung: offen

**Belege:** `mattekiste/mock-broker.mjs:106-119`; `konzept/prototyp/proto.js:43-50,225-230`; `live/werkbank-server.py:49,81-82,93-99`.

Spuren dürfen ohne Authentifizierung geschrieben und gelesen werden. Clientfelder überschreiben sogar den serverseitigen Zeitdefault. Akteur, Mandant, Session, Revision und Operation werden nicht verbindlich zugeordnet. Das Elementinventar ist global. JSON-Serialisierung verhindert dabei rohe zusätzliche JSONL-Zeilen durch bloße Textumbrüche; diese Teilfrage ist kein Injektionsbefund.

**Restbedingungen:** Hostbestimmte Provenienz, berechtigte Objekt-/Mandantenlesepfade und datensparsame Aufbewahrung. Eine tatsächliche Offenlegung echter Personendaten wurde nicht untersucht oder nachgewiesen. Keine Korrektur im Diff.

## B09 — Grüne Zustände und Frische: offen

**Belege:** `konzept/prototyp/proto.js:112-124,201-223,326-332,536-562`; `konzept/prototyp/bi-glas.js:9-35,88-90,107-116`; `mattekiste/mock-broker.mjs:139,159-169`.

Statische Erfolgsbadges, vorzeitiges „geladen“, Renderzeit statt Quellfrische, ein voreilig wahres Streamflag und BI-Konstanten mit Quellenbeschriftung bleiben bestehen. Die neue Escape-Schicht bestätigt keine Datenherkunft. Monats-/Wochenbeschriftung und inkonsistente Stundenangabe im BI bleiben unverändert.

**Restbedingungen:** Demo-Konstanten sichtbar kennzeichnen; bestätigten Operations-/Quellstand und Verbindungszustand getrennt führen; nur belegten Erfolg grün darstellen. Kein Browser-/Fachlauf ausgeführt.

## B10 — Quittung, Undo und Lifecycle: offen

**Belege:** `konzept/prototyp/proto.js:39-41,294-322,326-350,385-388,457-464,486-513,527-545`; `konzept/prototyp/bi-glas.js:166-181`; `t2-nachtwache-v3.html:266,279-307,319-323`.

Quittungen sind teilweise nun HTML-sicherer, fachlich aber weiterhin falsch: Pausieren quittiert „pausiert → läuft“; Sortierung liest den Vorzustand nach dem Speichern. Die isolierten Proben reproduzierten beides. „Undo 30s“ wird pauschal versprochen; Modulentfernung ist nur DOM-Entfernung und wird beim Rendern wieder eingesetzt. Personenwechsel/Override-Reset lösen das Intervall nicht neu auf; Drawer-Historie wird nicht zurückgeladen; BI-Zustand geht beim Neurender verloren. Der globale T2-Undo-Verweis bleibt falsch pro Karte.

**Restbedingungen:** Tatsächliche Vorzustände erfassen, Gegenaktionen instanz-/revisionsgebunden halten, Ablauf erzwingen und Lifecycle-/Personenzustand konsistent restaurieren. Escape-Fix ist keine fachliche B10-Korrektur.

## B11 — Generik und Schemaanschluss: offen

**Belege:** `konzept/prototyp/proto.js:55-68,248-290,294-322,537-545`; `konzept/workspace.schema.json:13-25`; `konzept/katalog-eintrag.schema.json:6-8`; `konzept/katalog-eintrag/modul.pan528.json:35-49`.

Tenant-/Finanzen-/pan528-Spezialisierung, feste DOM-IDs und fehlende Manifest-/Slot-Registry bleiben. Schemaformal erlaubte Bäume ohne den speziellen Tenant oder ohne `vorlagen` sind nicht robust unterstützt. Der zusätzliche oberste Schlüssel `datenquellen` im pan528-Katalogeintrag wird vom mitgelieferten Schema weiterhin ausgeschlossen; mechanischer Feldabgleich bestätigt diesen Widerspruch.

**Restbedingungen:** Validierte Instanzen, generischer Resolver und Registry, verständliche Fehlerzustände sowie abgestimmte Schemata/Einträge. Syntaxprüfung allein ist keine Schemagültigkeit.

## B12 — Mobil, Modalität und Bewegung: offen

**Belege:** `konzept/prototyp/index.html:24,37-40,75,80-83,114-116`; `konzept/prototyp/proto.js:401-416,446-450`; `konzept/prototyp/zeiger.js:7-9,207-216,237-240`; `live/index.html:3-6`.

Desktop-Mindestbreite, ausgeblendete Assistenz unter 1100 px, unvollständige Modalitätsgrenze und nicht abgeschaltete Zeiger-Positionsübergänge bestehen. Der äußeren Live-Seite fehlt das Viewport-Metatag. Neue PNG-Dateien sind kein Reflow-/Fokusnachweis.

**Zusätzlich in Runde 2 gefunden, nicht im Delta eingeführt:** Der primäre Drawer-Button `#dwZu` hat keinen Clickhandler (`konzept/prototyp/proto.js:385,407,469-472`). Escape und der getrennte Rückkehrbutton sind weiterhin verdrahtet. Der Trend-Zeiger sucht `#trend`, während der Renderer `#trendBild` erzeugt (`konzept/prototyp/zeiger.js:128-137`; `konzept/prototyp/proto.js:289`).

**Restbedingungen:** Mobilen Gesamtweg einschließlich Quittung/Agentensteuerung herstellen; alle Close-Wege und die ganze Modalitätsgrenze prüfen. Keine Accessibilityabnahme durchgeführt.

## B13 — Testvalidität und Snapshotbindung: offen

**Belege:** `mattekiste/epic-tests.mjs:3-11,46-52,78,130-133`; `mattekiste/m123-tests.mjs:4-15,115-119`; `mattekiste/m4-tests.mjs:10-24,28-45`; `mattekiste/m5-tests.mjs:25-27`; `mattekiste/m7a-tests.mjs:33-34`.

Kein Testskript wurde geändert. Konstante Erfolgsassertionen, fehlender Fehlerexit bei ausgewählten Skripten, fremde Start-/Browserpfade, ungebundener Readback und unvollständige Negativfälle bleiben. Diagnoseausgaben ersetzen in den kleineren Skripten keine Assertions (`mattekiste/bi-test.mjs:15-18,37-55`; `mattekiste/spur-test.mjs:19-25,31-36`; `mattekiste/strom-test.mjs:16-20,30-36`; `mattekiste/zeiger-loop-test.mjs:28-30`). Mutierende Testskripte besitzen teils keinen abgesicherten Rückbau (`mattekiste/strom-test.mjs:32-36`; `mattekiste/zeiger-tour-test.mjs:21-25`).

**Restbedingungen:** Snapshotrelative, isolierte Tests mit echten Negativassertionen, Fehlerexit und Cleanup; insbesondere falscher CSRF bei vorhandener Session, Ablauf, Gruppen-XSS und Operationswiederholung. Keine bisher behaupteten Test-/axe-Erfolge übernommen, keine Repository-Suite ausgeführt.

## Neue Regressionen: Ergebnisgrenze

Die gegenüber der Basis eingeführten Codeänderungen wurden vollständig gelesen. **Keine zusätzliche, durch dieses Delta neu entstandene Funktions- oder Sicherheitsregression ist in den durchgeführten Proben nachgewiesen.** Das ist keine Regressionsfreiheitserklärung: Die Proben decken nur ausgewählte reine Funktionen ab. Weiterhin offene Senken und die zusätzlichen Ablauf-/Drawer-/Zeigerbeobachtungen sind ausdrücklich als Restlücken beziehungsweise neu gefundene Altfehler eingeordnet. Die größte Fehlfreigabegefahr wäre, aus den erfolgreichen CSRF-/Escape-Teilkorrekturen eine geschlossene Sicherheitsgruppe abzuleiten.
