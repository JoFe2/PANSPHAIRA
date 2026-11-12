# 01 — Sicherheit und Vertrauensgrenzen

Snapshot: `1b58dc4879a7b8bba37ae40005f4db6b8affb410`. Alle Quellverweise sind relativ zu `psai/katalog/` und beziehen sich auf diesen eingefrorenen Commit. Statischer Review, keine Browser-/Hostabnahme.

### B01 — Hoch: „Lokal“ ist keine implementierte Netzwerkgrenze

**Belege:** `live/werkbank-server.py:15-23,48-51,79-85,93-106,112-113`; `mattekiste/mock-broker.mjs:73-87,106-157,171,229`.

Der Werkbank-Server bindet ausdrücklich an `0.0.0.0:8099`, obwohl sein Kopfkommentar einen lokalen Entwicklungsloop beschreibt. Der Broker ruft `.listen(PORT)` ohne Loopback-Host auf. Beide besitzen damit im Startpfad keine Loopback-Beschränkung. Ob die Ports tatsächlich aus einem LAN erreichbar wären, hängt zusätzlich von Firewall und Netzwerk ab; ein laufender Dienst wurde nicht untersucht.

Die Python-Auslieferungswurzel ist das gesamte `dem gesamten Frontend-Arbeitsverzeichnis`, nicht lediglich der Vorschauordner. Für andere GET-Pfade wird an `SimpleHTTPRequestHandler` durchgereicht. Die Überwachungsliste ist keine Auslieferungs-Allowlist. `/werkbank/elemente` lässt sich ohne Anmeldung überschreiben und auslesen.

Am Broker sind unter anderem Deskriptorersatz, Ereigniseinlieferung, Quellenblockade, KPI-Veränderung und Producer-Umschaltung ohne Sessionprüfung möglich. Mehrere Mutationen erfolgen über GET. Das sind nicht nur fehlende Produktionshärtungen, sondern tatsächlich vorhandene, ungeschützte Schreibpfade. Sichtbare Texte wie „GESCHÜTZTE SITZUNG“ ersetzen diese Grenze nicht (`konzept/prototyp/index.html:124`).

### B02 — Hoch: CSRF-Wert wird nicht geprüft; Sessionablauf und Akteursauthentifizierung fehlen

**Belege:** `mattekiste/mock-broker.mjs:81-97,192-197`.

`requireCsrf()` prüft beim übergebenen Header `x-pan527-csrf` ausschließlich, ob er aus 64 Hex-Zeichen besteht. Danach wird der aus Cookie und Schlüssel selbst berechnete Erwartungswert mit dem gespeicherten Digest verglichen. Der tatsächlich eingereichte Headerwert geht in diesen Vergleich nicht ein. Bei vorhandener Session genügt somit jeder formal passende Hex-Wert.

`expiresAtMs` wird beim Bootstrap gespeichert, bei der Sessionverwendung aber nicht ausgewertet. Der Bootstrap selbst verlangt entgegen seinem Kommentar kein Owner-Token oder anderes Identitätsmerkmal; jeder Aufrufer erhält eine neue Session mit Rolle `reviewer`. Diese Rolle wird im Kommandopfad nicht auf Aktionsrechte geprüft. Das ist keine authentifizierte Benutzer-/Mandantengrenze.

Das Cookie wird ohne `HttpOnly` und ohne `Secure` gesetzt. Für eine reine HTTP-Demo erklärt das die technische Umgebung, schützt aber weder gegen bereits vorhandenes XSS noch einen späteren unverschlüsselten LAN-Betrieb. Die falsche Headerbezeichnung ist dagegen für sich kein Sicherheitsdefekt; entscheidend ist der fehlende Wertvergleich.

### B03 — Hoch: Unauthentifizierte Ereignisse und Deskriptoren erreichen HTML-Senken

**Belege:** `mattekiste/mock-broker.mjs:124-129,151-157`; `konzept/prototyp/proto.js:70-80,140-150,181-190,247-258,300-309`.

Die belegte Hauptkette lautet:

1. `/api/event` übernimmt `gruppe` und `text` aus URL-Parametern und speichert sie ohne Authentifizierung.
2. `/api/events` liefert diese Inhalte zurück (`mattekiste/mock-broker.mjs:140-148`).
3. `tickerZeichnen()` setzt beide Felder unverändert in einen HTML-String und weist diesen `innerHTML` zu.

Ein eingelieferter HTML-/Eventhandler-Inhalt wird damit als Markup statt als Text interpretiert. Entsprechend gelangen frei austauschbare Deskriptorwerte über „Warum so?“, Theme-/Vorlagenangaben und Knoten-IDs in HTML beziehungsweise Attribute. Eine JSON-Syntaxprüfung am Schreibendpunkt ist kein HTML-Sicherheitsfilter. Auch der Trendrenderer setzt Quellwerte in SVG/HTML ein, ohne die erwarteten Zahlen-/Texttypen an der Grenze zu erzwingen.

Zusätzlich übernehmen die V3-Templates Ablehnungsgründe unverändert in `innerHTML`/`outerHTML`: `t1-arbeitsprofil-v3.html:290-299` und `t3-redaktionell-v3.html:277-284`. Dort ist der belegte Eingangsweg zunächst lokale Benutzereingabe, also nicht automatisch ein entfernter Angriff. In T3 wird derselbe Entwurf außerdem im gemeinsamen LocalStorage-Schlüssel aufbewahrt (`t3-redaktionell-v3.html:373-380`). Bei späterer Übernahme externer Vorschläge oder geteilter Daten würde daraus eine weitere Vertrauensgrenzenverletzung.

### B04 — Hoch: Delegation, Rollen und Sperren sind Anzeigezustand statt Durchsetzung

**Belege:** `konzept/prototyp/proto.js:54-66,78-89,94-105,453-466,479-503`; `konzept/workspace.schema.json:42-55`; `konzept/DELEGATION-MODELL.md:7-22`.

Der Resolver übernimmt Kinder- und Personenwerte, ohne geerbte `sperren` auszuwerten. „Warum so?“ druckt Sperren und Eigentümer lediglich aus. Die Bearbeitung wird nicht gegen `eigentum`, `delegationen`, Personen-/Gruppenrechte oder die Freigabe-Matrix geprüft.

Der Agenten-Gate wird nur beim Themewechsel aufgerufen. Sortierung, Ausblenden, Modulaktionen und Intervalländerung verwenden ihn nicht. Stufe 2 erlaubt bei fehlendem Datum ausdrücklich „unbefristet“, Stufe 3 passiert ohne jegliche Ablaufprüfung. Das widerspricht den dokumentierten Delegationsgrenzen. Die Auswahl einer anderen `person` ist ein frei bedienbarer Ansichtswechsel, keine Anmeldung.

Auch das Schema erzwingt die behauptete Agentenfrist nicht: Pflichtfelder der Delegation sind nur `wer` und `rechte`; `gueltigBis` darf fehlen oder `null` sein. Die gegenteilige Aussage in `konzept/AGENTEN-ASSISTENZ.md:15-18` wird vom Schema nicht gedeckt.

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

### B07 — Hoch: Ressourcenbegrenzungen greifen zu spät oder fehlen vollständig

**Belege:** `live/werkbank-server.py:54-78,93-101`; `mattekiste/mock-broker.mjs:32-35,61,82-87,98-119,124-127,192-195`; `konzept/prototyp/proto.js:23-25,42-48,140-163`.

- Python liest die vom Client angegebene `Content-Length` ohne Obergrenze oder eigenen Leseabbruch. Die Begrenzung auf 80 Elemente zu 60 Zeichen erfolgt erst nach vollständigem Einlesen und JSON-Parsen. Ein negativer Längenwert wird nicht vorab abgelehnt; die Ganzzahlkonvertierung liegt außerhalb des lokalen Fehlerfangs.
- Der Broker sammelt Request-Bodies vollständig im Speicher. Auch die 64-KiB-Regel für `/api/spur` wird erst danach angewandt; Deskriptor- und Kommandobodys besitzen nicht einmal diese nachgelagerte Schranke.
- Jeder Python-SSE-Hörer hält einen Thread mit Endlosschleife; es gibt keine Anwendungslimits für Hörer, Laufzeit oder Schreibblockaden. Der Broker begrenzt seine SSE-Menge ebenfalls nicht und wertet den Backpressure-Rückgabewert von `write()` nicht aus.
- JSONL wächst ohne Rotation, Quote oder Aufbewahrungsgrenze. Für jede Spurabfrage wird zunächst die gesamte Datei eingelesen und aufgeteilt. `seit=0` oder ein nichtnumerischer Wert führt durch die Slice-Semantik zur Auswahl der gesamten Liste statt einer begrenzten letzten Seite (`mock-broker.mjs:118`).
- Sessions werden angelegt, aber weder abgelaufene Einträge noch alte Sessions bereinigt. Clientseitige `bekannte`, `puffer`, `rohlog` und Chronik-DOM wachsen ebenfalls ohne die dokumentierten Puffergrenzen.

Die fehlenden Limits sind belegt. Ein konkreter Speicherausfall oder eine bestimmte maximal tragbare Nutzerzahl wurde nicht gemessen.

### B08 — Hoch bei echten Daten: Spur ist weder autorisiertes Audit noch mandantengetrennt

**Belege:** `konzept/prototyp/proto.js:42-49,224-229`; `mattekiste/mock-broker.mjs:106-119`; `live/werkbank-server.py:49,81-82,93-99`.

Jeder Client darf Spur-Objekte einliefern und wieder auslesen. `person`, `tat` und sogar `zeit` stammen letztlich vom Client: `Object.assign({zeit: Serverzeit}, z)` lässt eine mitgelieferte Zeit die Serverzeit überschreiben. Mandant, authentifizierter Akteur, Session, Operation und Revision fehlen. Eine fremde Tat lässt sich als Tat einer anderen Person protokollieren.

Die UI liest über die gemeinsame Host-Spur auch die Handlungen anderer Flächen. Das globale Python-Elementinventar wird unabhängig von Fenster, Person oder Session durch die letzte Meldung ersetzt. Sobald echte Vorgangs-/Personennamen in Texte oder Buttonlabels gelangen, werden sie damit an andere berechtigte oder unberechtigte Leser weitergereicht. Eine tatsächliche Offenlegung realer PII ist damit nicht nachgewiesen; die fehlende Trennung und Datensparsamkeit sind es.

Positiv einzugrenzen: JSONL-Zeilen werden mit `JSON.stringify` erzeugt. Ein Zeilenumbruch im Text ist daher nicht automatisch eine zusätzliche rohe JSONL-Zeile. Das Problem ist die fehlende Vertrauenswürdigkeit der Inhalte und des Zugriffs, nicht ein hier belegter ungefilterter Newline-Append.

## 3. Bedingte Risiken und ausdrücklich nicht nachgewiesene Angriffe

| Thema | Statischer Befund und Bedingung |
|---|---|
| Loopback gegenüber LAN | Lokal begrenzter Betrieb reduziert entfernte Erreichbarkeit, heilt aber weder XSS noch unautorisierte lokale Aufrufer. Die Startpfade sind derzeit nicht so begrenzt. Für LAN fehlen außerdem Transport-, Identitäts- und Mandantengrenzen; deren konkrete Infrastruktur wurde nicht untersucht. |
| Cross-Site-Schreiben / CSRF | Zustandsändernde GETs und ungeprüfte POSTs besitzen keine anwendungsseitige Origin-/Host-Prüfung. Ob eine fremde Webseite einen bestimmten Loopback-/LAN-Aufruf im jeweiligen Browser tatsächlich durchführen kann, hängt zusätzlich von Browser- und Netzwerkzugriffsregeln ab. Die Angriffsfläche ist belegt, ein universeller Browser-Bypass nicht. |
| CORS | `mock-broker.mjs:76-78` kombiniert Wildcard-Origin und Credentials. Das erlaubt nicht pauschal credentialed Cross-Origin-Lesen; diese Kombination ist dafür ungeeignet. Nichtcredentialed freigegebene API-Zugriffe bleiben dennoch breit offen, und direkte HTTP-Clients werden durch CORS nicht autorisiert. |
| Pfadtraversal / Dateigrenze | Die Broker-Auslieferung normalisiert den Pfad und entfernt führende `../`-Folgen (`mock-broker.mjs:220-226`). Eine einfache funktionierende `../`-Traversal wird hier ausdrücklich nicht behauptet. Es fehlen jedoch eine belegte Realpath-/Symlink-Grenze und eine Auslieferungs-Allowlist. Falls im ausgelieferten Baum auswärts gerichtete Symlinks oder sensible Dateien liegen, ist eine Offenlegung möglich. Solche Dateien/Symlinkziele außerhalb von `psai/katalog/` wurden nicht gelesen. Beim Python-Server ist bereits die breite Root-Auslieferung das Problem. |
| SSE | Keine Sequenz-/Event-ID oder Resume-/Lückenprüfung im Brokerstrom; die UI lädt beim Reconnect nicht verbindlich den Gesamtstand nach (`mock-broker.mjs:33-35,98-104`; `proto.js:546-561`). Ein während der Trennung verpasstes Ticker-/Deskriptorereignis kann deshalb fehlen, auch wenn der Stream wieder offen ist. Das ist ein bedingter Konsistenzfehler bei Unterbrechung, kein gemessener Datenverlust. |
| PII und Audit | Der Snapshot verwendet überwiegend synthetische Daten. Reale PII wurde nicht gesucht oder aus fremden Speichern gelesen. Bei Übernahme echter Namen, Belegtexte, Anhänge oder Ablehnungsgründe würden die belegten ungetrennten Logs, LocalStorage-Werte und Lesepfade diese Daten betreffen. |
| Dateien und Schlüssel | Der Broker sieht Schlüssel-/Ledger-Dateien unter externen HOME-Pfaden vor (`mock-broker.mjs:11-22`). Diese wurden nicht geöffnet. Dateirechte, tatsächlicher Inhalt, vorhandene Credentials und Integrität des externen Fachhosts sind nicht bewertet. |
| LAN-Funktionsfähigkeit | Der Composer verwendet fest `http://127.0.0.1:8097` (`proto.js:6`), der Zeiger dagegen einen optionalen LocalStorage-Broker (`zeiger.js:127`). Auf einem anderen LAN-Client meint `127.0.0.1` dessen eigenen Rechner. Auch nach Netzfreigabe wäre daher ein konsistentes Deployment nicht allein durch Öffnen der Werkbank-URL hergestellt. |

## Zusätzliche unabhängige Kontrolle durch den Orchestrator

Der unveränderte Funktionskörper `requireCsrf()` aus `mattekiste/mock-broker.mjs:91-97` wurde in einem isolierten Node-Prozess mit synthetischem Cookie, Schlüssel und Session-Digest ausgeführt; kein Serverstart, keine echten Sessiondaten, keine Repository-Testdatei. Ergebnis:

```text
korrekter Headerwert: ACCEPTED
falscher Headerwert (64 Hex-Zeichen): ACCEPTED
falscher Headerwert (3 Zeichen): REJECTED HOSTED_CSRF_DENIED
```

Dies reproduziert B02 auf Funktionsniveau, nicht als Browser-/HTTP-Exploit. Der Orchestrator hat außerdem die Netzwerk-Bindungen, HTML-Ticker-Senke, Ledger-/Statuspfade sowie ausgewählte Quittungs-, SSE- und Teststellen direkt im Snapshot nachgelesen.
