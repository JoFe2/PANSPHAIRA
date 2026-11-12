# Runde 3 — Einzel-Nachprüfung der Restbedingungen

Geprüfter HEAD: `ebf5d299bccfc0d3cf79521519e03e7ea498e3f7`.
Basis: `1dea6ed8a91096a023d4145b0d9f13255487fbdf`.
Vergleich: `git diff 1dea6ed8a91096a023d4145b0d9f13255487fbdf..HEAD -- psai/katalog`.

Alle Sourcepfade und Zeilen gelten für diesen HEAD und sind relativ zu `psai/katalog/`. Runde 2 wurde vollständig als Vergleich gelesen, nicht als Anweisung oder Erfolgsbeleg. Maßgeblich sind eigenes Quelllesen und die in README/Delta-Berichten ausdrücklich benannten isolierten Proben. Keine Produkt- oder Fachfreigabe.

## Statusmaßstab und Ergebnis

`fixed`: genau die benannte Teilbedingung ist im statisch geprüften Umfang erfüllt. `teils`: Teilkorrektur, daneben ausdrücklich verbleibende Anforderungen. `offen`: Anforderung weiterhin nicht erfüllt oder der notwendige reale Nachweis fehlt. Ein `fixed` bei einer Einzelzeile schließt keine gesamte B-Gruppe. Unveränderte Befunde sind fortgeschrieben, nicht als Regression umetikettiert.

| Gesamtgruppe | Runde 2 → Runde 3 | Noch offene Gesamtbedingung |
|---|---|---|
| B01 | teils → teils | Identität, Rechte, Auslieferungs-/Datei-/Origin-Grenzen |
| B02 | teils → teils | Bootstrap, Aktionsrechte, strikt endlicher typisierter Ablauf am Wirkungspunkt |
| B03 | teils → teils | Weitere HTML-/SVG-Senken und Eingangsvalidierung |
| B04 | offen → offen | Hostdurchsetzung von Sperren und Delegationen für alle Aktionen |
| B05 | offen → offen | Dauerhafte Wiederholungs-, Payload-, Revisions- und atomare Konkurrenzbindung |
| B06 | offen → offen | Reine Statuspfade, wirksamer Abbruch, ehrliches Undo, wirkungsgebundener Readback |
| B07 | offen → teils | Abfrageausgabe begrenzt; Eingangs-/Speicher-/SSE-/Retentiongrenzen fehlen |
| B08 | offen → offen | Verbindliche Auditautorität und Objekt-/Mandanten-/Sessiontrennung |
| B09 | offen → offen | Bestätigter Erfolg und wirkliche Quellfrische statt Anzeigezeit/Konstanten |
| B10 | offen → teils | KPI und gültige Sortierung verbessert; Trendpause, Grenz-No-op, Undo/Lifecycle offen |
| B11 | offen → teils | Feldzulassung korrigiert; Datenquellenelemente untypisiert, Runtime nicht generisch |
| B12 | offen → teils | Close-Weg, Trendziel, Viewport korrigiert; Mobil/Modalität/Bewegung offen |
| B13 | offen → offen | Verlässliche snapshotgebundene Negativ-, Fehlerexit- und reale Integrationsnachweise |

Damit: **0 Gesamtgruppen fixed, 7 teils, 6 offen**. Alle Gesamtgruppen bleiben unvollständig. Die folgende Liste löst die Restbedingungen aus sämtlichen sechs Runde-2-Berichten auf, einschließlich Detailtabellen und dort neu gefundener Altfehler. Bereits korrigierte Unterpunkte werden zur Abgrenzung mitgeführt. Ergänzende Fachkatalogbedingungen folgen am Ende.

## B01 — Exposition, Auslieferung und Dateigrenze

| ID | Einzelbedingung | Status | Aktueller Sourcebeleg / Ergebnis |
|---|---|---|---|
| B01.01 | Beide Startpfade explizit an Loopback binden | fixed | `live/werkbank-server.py:112-113`; `mattekiste/mock-broker.mjs:229`. Aus Runde 2 fortgeschrieben; keine Listenerprüfung. |
| B01.02 | Identität/Objekt- und Aktionsrecht auch für Mocksteuerung, Inventar und Lesewege | offen | `mattekiste/mock-broker.mjs:98-157,171,178-190`; `live/werkbank-server.py:79-103`. Schleusen fehlen weiterhin. |
| B01.03 | Statische Auslieferung auf beabsichtigte Dateien begrenzen, nicht den allgemeinen Arbeitsbaum | offen | `live/werkbank-server.py:15-23,48-51,83-85`. Beobachtungsliste ist keine Auslieferungs-Allowlist. |
| B01.04 | Reale Dateigrenze einschließlich Symlinks/zulässiger Ziele | offen | `mattekiste/mock-broker.mjs:220-226`; `live/werkbank-server.py:48-51,83-85`. Normalisierung ohne Realpath-Allowlist; kein vorhandener Auswärtssymlink oder gelungener Traversalangriff behauptet. |
| B01.05 | Host-/Origin-Prüfung und konsistenter geschützter Deploymentpfad | offen | `mattekiste/mock-broker.mjs:74-78,192-218`; `konzept/prototyp/proto.js:6`; `konzept/prototyp/zeiger.js:127`. Kein Host-/Origin-Gate; abweichend konfigurierbare Brokerbasis. |
| B01.06 | Demo-/LAN-Grenze einhalten; reale Daten/Netzerweiterung nicht durch Loopback als autorisiert erklären | offen | `live/werkbank-server.py:112-113`; `mattekiste/mock-broker.mjs:229`. Bindung ist verbessert, eine geschützte Fach-/LAN-Nutzung nicht implementiert oder hier nachgewiesen. |
| B01.07 | Schreibende Fach-/Steueraktionen nur über festgelegte mutierende Methoden zulassen | offen | `mattekiste/mock-broker.mjs:131-157,171,192-218`. Mehrere Mutationen weiterhin als GET; `/guided/command` ohne explizite Methodenprüfung. Methodentrennung und Autorisierung sind beide nötig. |

## B02 — CSRF, Bootstrap, Ablauf und Rollen

| ID | Einzelbedingung | Status | Aktueller Sourcebeleg / Ergebnis |
|---|---|---|---|
| B02.01 | Eingereichten CSRF-Wert statt nur Format prüfen | fixed | `mattekiste/mock-broker.mjs:93-96`. Korrektes synthetisches Token akzeptiert, falsches gleichlanges und zu kurzes verweigert; bereits Runde 2 korrigiert. |
| B02.02 | Fehlende Session und numerisch vergangener Ablauf verweigern | fixed | `mattekiste/mock-broker.mjs:90-96`. Isoliert bestätigt; fehlender Ablauf ebenfalls verweigert. |
| B02.03 | Exklusive Ablaufgrenze: Gleichstand mit Prüfzeitpunkt ist abgelaufen | fixed | `mattekiste/mock-broker.mjs:95`. Jetzt `!(ab > Date.now())`; Gleichstand vorher akzeptiert, jetzt `HOSTED_SESSION_EXPIRED`. |
| B02.04 | Nichtnumerischen Ablauf/NaN fail-closed behandeln | fixed | `mattekiste/mock-broker.mjs:95`. `not-a-time` und leeres Objekt werden jetzt verweigert; numerisches NaN wird ebenfalls verweigert. |
| B02.05 | Nur endliche Ablaufzahlen zulassen | offen | `mattekiste/mock-broker.mjs:95`. `"Infinity"` und `"1e309"` werden durch `Number` zu positiv unendlich und akzeptiert. Kein `Number.isFinite`. Normales Bootstrap erzeugt endliche Zahlen (`85`). |
| B02.06 | Gespeicherten Ablauftyp vor Konversion prüfen | offen | `mattekiste/mock-broker.mjs:95`. Zukünftiger numerischer String und Ein-Element-Array werden akzeptiert. Damit keine strikte Sessiondatensatzvalidierung; kein unmittelbar frei wählbares HTTP-Ablauffeld behauptet. |
| B02.07 | Authentifizierten Bootstrap und hostbestimmte Akteurs-/Mandantenzuordnung | offen | `mattekiste/mock-broker.mjs:81-87`. Jeder Aufrufer erhält Session mit pauschalem `reviewer`; kein Identitätsmerkmal erforderlich. |
| B02.08 | Angemessene Transport-/Cookiepolitik und unnötiges Token-Echo beseitigen | offen | `mattekiste/mock-broker.mjs:87,229`. Cookie ohne `HttpOnly`/`Secure`, Token im Body; HTTP-Loopback-Demo ist kein HTTPS-/LAN-Nachweis. |
| B02.09 | Manifestrollen und Ziel-/Mandantenrechte für jedes Kommando durchsetzen | offen | `mattekiste/mock-broker.mjs:192-218`; `konzept/beispiele/pan528.manifest.json:15-18`. CSRF ist kein Rollenrecht. |
| B02.10 | Andere Mock-, Status-, Spur- und Readbackpfade berechtigt absichern | offen | `mattekiste/mock-broker.mjs:98-190`. `requireCsrf` wird nur im Kommandopfad aufgerufen. |
| B02.11 | Ablauf/Entzug am verbindlichen Wirkungspunkt bewerten, nicht nur vor Bodyempfang | offen | `mattekiste/mock-broker.mjs:79,90-96,192-206`. Alter Ledger/Sessionstand; keine erneute Prüfung nach asynchronem Bodylesen vor Speichern. |

B02 ist **teils**, nicht „Sessionablauf vollständig fixed“. Details, Typfälle und Betriebsgrenze: `01-sicherheit.md`.

## B03 — Kontextgrenzen und Datenvalidierung

| ID | Einzelbedingung | Status | Aktueller Sourcebeleg / Ergebnis |
|---|---|---|---|
| B03.01 | Ereignisgruppenüberschrift vor `innerHTML` escapen | fixed | `konzept/prototyp/proto.js:148-151`. Inertes Tag in Gruppe jetzt escaped; isolierter String-Sink enthält kein rohes Tag. Vorherige unmittelbare Headerkette damit geschlossen. |
| B03.02 | Bereits korrigierte Text-/Doppelquote-Senken erhalten | fixed | `konzept/prototyp/proto.js:8,41,75-80,149,186-189,250-255,259,306-307`. Escaping fortgeschrieben; fehlende Apostrophkodierung in diesen konkreten Kontexten kein eigener Fehler. |
| B03.03 | Vorlagenkennung sicher als Text ausgeben | offen | `konzept/prototyp/proto.js:258`. Weiter rohe Interpolation. |
| B03.04 | Navigations-ID im HTML absichern und getrennt den Selektorkontext beherrschen | offen | `konzept/prototyp/proto.js:317-318,475`. Rohes Attribut plus spätere Selektorkonkatenation. |
| B03.05 | Lokalen Personenwert in Warum-so absichern | offen | `konzept/prototyp/proto.js:16,78,81`. LocalStorage ist kein Typ-/HTML-Vertrauensbeweis. |
| B03.06 | Personenwert im Erststart absichern | offen | `konzept/prototyp/proto.js:362-365`. Weiter rohe HTML-Interpolation. |
| B03.07 | JSON-Rohlog nicht als rohes HTML ausgeben | offen | `konzept/prototyp/proto.js:104,225-226`. `JSON.stringify` ist kein HTML-Escaping; Hostlog nutzt dagegen `textContent` (`230`). |
| B03.08 | Trendwerte vor SVG/ARIA/Tabellen als endliche Zahlen validieren | offen | `konzept/prototyp/proto.js:177-191`. Werte weiterhin roh; aktueller Broker liefert selbst Zahlen (`mattekiste/mock-broker.mjs:159-165`), kein neuer externer Stringeingang nachgewiesen. |
| B03.09 | Trendform/-größe, Punktzahl/Längen, Null-/Einzelpunktfälle prüfen | offen | `konzept/prototyp/proto.js:177-191`. Vier Reihen begrenzen nicht Punkt-/Wertlängen; Division durch Null und feste Indexannahme 11 bleiben. |
| B03.10 | T1-Ablehnungsgrund sicher ausgeben | offen | `t1-arbeitsprofil-v3.html:290-299`. Unveränderter lokaler Benutzereingang zu HTML. |
| B03.11 | T3-Ablehnungsgrund einschließlich persistiertem Entwurf sicher ausgeben | offen | `t3-redaktionell-v3.html:277-284,373-380`. Unverändert. |
| B03.12 | Größen-/Typvalidierung vor Rendering und vor zukünftigem BI-Adapteranschluss | offen | `konzept/prototyp/proto.js:153-158,174-191,537-545`; `konzept/prototyp/bi-glas.js:9-35,38-116`. BI heute lokale Konstanten, nicht zusätzlich als gegenwärtiger Netzexploit gewertet. |

## B04 — Delegation, Sperren, Personenscope

| ID | Einzelbedingung | Status | Aktueller Sourcebeleg / Ergebnis |
|---|---|---|---|
| B04.01 | Geerbte Sperren im Resolver tatsächlich anwenden | offen | `konzept/prototyp/proto.js:58-64`. Weiter nur Optionenüberschreibung; angezeigte Sperren (`79`) sind keine Durchsetzung. |
| B04.02 | Eigentum/Delegationen mit Umfang und Zielrecht hostseitig auswerten | offen | `konzept/prototyp/proto.js:58-64,80,95-105`; `mattekiste/mock-broker.mjs:192-218`. Keine entsprechende Autorisierung. |
| B04.03 | Agentengate für jede schreibende Aktion, nicht nur Themewechsel | offen | `konzept/prototyp/proto.js:95-105,454-467,480-530`. Sortierung, Intervall, Entfernen etc. umgehen es. |
| B04.04 | Stufe 2 ohne Ende verweigern | offen | `konzept/prototyp/proto.js:89-90`. Fehlendes Datum bleibt erlaubt. |
| B04.05 | Abgelaufenes Ende auch für Stufe 3 beachten | offen | `konzept/prototyp/proto.js:87-90`. Stufe 3 kehrt vor Datumprüfung erfolgreich zurück. |
| B04.06 | Agentendelegation mit verpflichtendem gültigem Ende modellieren | offen | `konzept/workspace.schema.json:42-55`. `gueltigBis` nicht required; nullable; kein agentenspezifisches Ende erzwungen. |
| B04.07 | Machtstufe/Person nicht frei gewählter UI-Auswahl als Identität vertrauen | offen | `konzept/prototyp/proto.js:437-467`. Personenwechsel ist lokale Sichtwahl, kein Login. |

## B05 — Wiederholung, Revision, Atomarität und Zuordnung

| ID | Einzelbedingung | Status | Aktueller Sourcebeleg / Ergebnis |
|---|---|---|---|
| B05.01 | Dauerhaftes Idempotenzregister über Retry/Reset/Restart hinweg | offen | `mattekiste/mock-broker.mjs:26-30,197-215`. Nur Formatprüfung und globaler Lauf. Isoliert: identischer Retry verweigert; alter Schlüssel nach Reset erneut wirksam. |
| B05.02 | Schlüssel an Aktion, Ziel und exakten kanonischen Payload binden | offen | `mattekiste/mock-broker.mjs:195-203`. Kein Digest-/Payloadvergleich. |
| B05.03 | Erwartete Revision als atomare Vorbedingung; Konflikt statt Überschreiben | offen | `mattekiste/mock-broker.mjs:79,192-215`. Kein Revisionsfeldvergleich. |
| B05.04 | Atomaren dauerhaften Speicherübergang statt direktem Ganzdatei-Schreiben | offen | `mattekiste/mock-broker.mjs:26-30`. `flush` ist keine Transaktion/atomare Veröffentlichung von Wirkung und Register. |
| B05.05 | Producer, Bootstrap, Sessions und parallele Requests serialisieren/CAS; keine verlorenen Felder | offen | `mattekiste/mock-broker.mjs:46-58,79,85-86,200-213`. Ganze Snapshots; Nachladen von `failMode` schützt übrige Felder nicht. |
| B05.06 | Lese-/JSON-/Korruptionsfehler nicht als frischen leeren Ledger behandeln | offen | `mattekiste/mock-broker.mjs:26-28`. Jeder Fehler fällt auf Default zurück. |
| B05.07 | Abort/Reset exakt an aktive/eigene Operation und Bindung koppeln | offen | `mattekiste/mock-broker.mjs:197,201,205-215`. `binding` ist Antwortfeld; fremde formgültige ID steuerte in RAM-Probe den Lauf. |
| B05.08 | Konkurrenz, Antwortverlust und Crash/Restart tatsächlich am realen Speicher/Fachhost abnehmen | offen | `mattekiste/mock-broker.mjs:26-30,178-215`; `mattekiste/m4-tests.mjs:21-41`. Statische Risiken und RAM-Probe sind kein solcher Nachweis. Vorgeschlagener AT1 in README. |

## B06 — Reines Lesen, Abbruch, Reset und Wirkungsbeleg

| ID | Einzelbedingung | Status | Aktueller Sourcebeleg / Ergebnis |
|---|---|---|---|
| B06.01 | Statusabfragen ohne Fach-/Laufmutation | offen | `mattekiste/mock-broker.mjs:178-186`. GET schließt `pending` ab, zählt, speichert und loggt. Isoliert erneut bestätigt. |
| B06.02 | Echte Abbruchwirkung statt bloßem Wunsch-ACK | offen | `mattekiste/mock-broker.mjs:179-184,205-207`. `pending` bleibt; Status ignoriert ACK. Probe: `SUCCEEDED`, ACK wahr, Zähler 1. |
| B06.03 | Abbruch vor Wirkung, Abschluss, Ausgang unbekannt und Race ehrlich unterscheiden | offen | `mattekiste/mock-broker.mjs:172-186,205-207`. Kein verbindlicher Abbruchpunkt/gesicherter Terminalentscheid. |
| B06.04 | Kontrollreset von fachlichem Undo trennen; ursprüngliche Wirkung/Verbrauch erhalten | offen | `mattekiste/mock-broker.mjs:209-215`; `konzept/beispiele/pan528.manifest.json:17`. Reset löscht Laufmetadaten, nicht Zähler; keine Fachkompensation implementiert. |
| B06.05 | Readback an berechtigte Operation, Ziel, Revision und Fachbeleg binden | offen | `mattekiste/mock-broker.mjs:188-190`. Frisches Dateilesen ohne diese Bindungen. |
| B06.06 | Erwartung und beobachteten Zielstand unabhängig bestimmen, nicht dieselbe Konstante quittieren | offen | `mattekiste/mock-broker.mjs:63,175-176,188-190`. Beide Businessfelder `val(4)`. |
| B06.07 | Rechte/Zuordnung für Status, Readback, Abort, Reset und Gegenaktion | offen | `mattekiste/mock-broker.mjs:178-218`; `konzept/beispiele/pan528.manifest.json:15-18`. Keine aktions-/operationsgenaue Rechteprüfung. |
| B06.08 | Undo-Kategorien Abbruch/Rückbau/Gegenbuchung, Fehler-/Race-/Fristsemantik wirklich nachweisen | offen | `mattekiste/mock-broker.mjs:205-215`; `konzept/prototyp/proto.js:39-41,334-350`. Kein einheitlicher ehrlicher Gegenwirkungsvertrag. AT2/AT3 vorgeschlagen, nicht ausgeführt. |
| B06.09 | Vorschlag/Lesen von Ausführung trennen; kein Modell-/Facherfolg aus Demoantwort ableiten | teils | `mattekiste/mock-broker.mjs:138,217`. `planOnly`/`activationAuthorized:false` sinnvoll vorhanden; typisierter quellen-/revisionsgebundener echter Vorschlag und durchgängiger Kanal fehlen. Unverändert. |

B05/B06 bleiben insgesamt **offen**. RAM-I/O und gestubbtes Auth-Gate der eigenen Probe belegen ausschließlich heutige Entscheidungsfehler. Sie belegen weder Speichersicherheit noch Autorisierung noch Fachwirkung.

## B07 — Eingangs-, Abfrage-, SSE- und Aufbewahrungsgrenzen

| ID | Einzelbedingung | Status | Aktueller Sourcebeleg / Ergebnis |
|---|---|---|---|
| B07.01 | `seit`-Auswahl auf maximal 500 und mindestens einen angeforderten Eintrag begrenzen | fixed | `mattekiste/mock-broker.mjs:118`. Probe mit 750 gültigen RAM-Zeilen: 0/ungültig → 200, negativ → 1, 501/Infinity → 500, 0.5/1.9 → 1. Bei kürzerer/leerer Datei natürlich weniger tatsächliche Treffer. |
| B07.02 | Strikte Eingabe-/Ganzzahlsemantik und begrenztes Lesen statt vollständiger Dateieinlesung | teils | `mattekiste/mock-broker.mjs:118`. Ausgabe begrenzt; 0 wird Default 200, nicht Clamp 1; Brüche/Infinity nicht verweigert. Vollständiges `readFile().split()` bleibt, also keine Speicher-/I/O-Grenze. Strikte 400-Semantik war bisher kein implementierter Vertrag. |
| B07.03 | Python-Body vor Einlesen nach Bytes/Timeout und gültigem Content-Length begrenzen | offen | `live/werkbank-server.py:93-101`. Integerkonversion vor Catch, kein vorgezogener Byte-/Negativ-/Zeitfilter; Kürzen danach genügt nicht. |
| B07.04 | Node-Bodies nach Bytes und Empfangszeit vor vollständig akkumuliertem Empfang begrenzen | offen | `mattekiste/mock-broker.mjs:106-109,124-127,192-195`. Spurgrenze nach Empfang; Deskriptor/Kommandos ohne solche Grenze, kein eigener enger Empfangszeitvertrag. |
| B07.05 | Struktur-/Element-/Zeilenlimits als Eingangslimit, nicht bloß spätere Kürzung | offen | `mattekiste/mock-broker.mjs:107-111`; `live/werkbank-server.py:97-99`. Zeichenlänge und Slice schützen nicht Empfangsspeicher. |
| B07.06 | SSE-Verbindungen/Threads, Lebensdauer und Queuebudget begrenzen | offen | `live/werkbank-server.py:54-78,113`; `mattekiste/mock-broker.mjs:32-35,61,98-104`. Unbegrenzte Hörer/Schleifen. |
| B07.07 | SSE-Backpressure und langsame Clients behandeln | offen | `mattekiste/mock-broker.mjs:33-35,61`; `live/werkbank-server.py:65-76`. Kein explizites Budget/Abbruchvertrag. Kein Lastverlust gemessen. |
| B07.08 | Abgelaufene Sessions entfernen/bestand begrenzen | offen | `mattekiste/mock-broker.mjs:82-96`. Ablaufprüfung ist keine Retention. |
| B07.09 | Spurdatei/Logaufbewahrung begrenzen | offen | `mattekiste/mock-broker.mjs:106-119,183`. Append und vollständiges Lesen ohne Rotation/Retention. |
| B07.10 | UI-Map, Puffer, Rohlog und Chronik begrenzen | offen | `konzept/prototyp/proto.js:24-26,43-50,143-163,225-230`. `ticker.maxEintraege` nicht durchgesetzt. |
| B07.11 | SSE-Reconnect mit Event-ID/Lücken-/Snapshotnachholung | offen | `mattekiste/mock-broker.mjs:33-35,98-104`; `konzept/prototyp/proto.js:547-562`. Kein verbindlicher Resumepunkt. |

## B08 — Auditprovenienz und Trennung

| ID | Einzelbedingung | Status | Aktueller Sourcebeleg / Ergebnis |
|---|---|---|---|
| B08.01 | Spurenschreiben authentifizieren/autorisiert zuordnen | offen | `mattekiste/mock-broker.mjs:106-115`; `konzept/prototyp/proto.js:43-50`. Client kann Tatsachen behaupten. |
| B08.02 | Serverbestimmte Zeit/Provenienz nicht durch Client überschreiben lassen | offen | `mattekiste/mock-broker.mjs:111`. Clientobjekt überschreibt Zeitdefault. |
| B08.03 | Akteur, Mandant, Session, Zielrevision und Operation verbindlich anbinden | offen | `mattekiste/mock-broker.mjs:106-119`; `konzept/prototyp/proto.js:50`. Diese Bindungen fehlen. |
| B08.04 | Spur-/Rohloglesen objekt-/mandantengebunden erlauben | offen | `mattekiste/mock-broker.mjs:117-119`; `konzept/prototyp/proto.js:225-230`. Frei lesbar, `seit`-Clamp kein Leserecht. |
| B08.05 | Elementinventar nach Session/Fenster trennen und begrenzen | offen | `live/werkbank-server.py:49,81-82,93-99`; `konzept/prototyp/zeiger.js:85-89`. Globaler letzter Bestand. |
| B08.06 | Datensparsame Aufbewahrung/Leserechte statt unbeschränkter Chronik | offen | `mattekiste/mock-broker.mjs:106-119`; `konzept/prototyp/proto.js:43-50`. Keine echte Offenlegung privater Daten untersucht. |

Fortgeschriebene Nichtbefunde: JSON-Serialisierung verhindert aus bloßen Textumbrüchen zusätzliche rohe JSONL-Zeilen (`mattekiste/mock-broker.mjs:111`). CORS `*` plus Credentials (`76`) ist keine pauschale Erlaubnis für credentialed Cross-Origin-Lesen und keine Autorisierung.

## B09 — Erfolg, Herkunft und Frische

| ID | Einzelbedingung | Status | Aktueller Sourcebeleg / Ergebnis |
|---|---|---|---|
| B09.01 | Erfolgsbadges und Vergleichswerte nicht als bestätigte Wirkung aus Konstanten anzeigen | offen | `konzept/prototyp/proto.js:213-223`; `konzept/prototyp/index.html:124,144`. Kein wirkungsbezogener Nachweis. |
| B09.02 | „Geladen/aktualisiert“ erst nach erfolgreichem Abruf/Readback | offen | `konzept/prototyp/proto.js:326-332`. Quittung vor `trendLaden`. |
| B09.03 | Fachliche Quellzeit/Revision statt Empfangs-/Renderzeit zur Frische verwenden | offen | `konzept/prototyp/proto.js:117-127,206-207`. Empfangszeit altert, `lvStand` setzt Jetzt. |
| B09.04 | Fehlgeschlagene Quelle nicht durch erfolgreiches Status-/Renderereignis frisch/grün überschreiben | offen | `konzept/prototyp/proto.js:166-167,201-207`; `mattekiste/mock-broker.mjs:139,159-169`. API-Status bleibt unabhängig vom Quellenfehler erfolgreich. |
| B09.05 | Streamflag erst nach Verbindung setzen und bei Fehler korrigieren | offen | `konzept/prototyp/proto.js:536,549-562`. Bereits vor `onopen` wahr, kein Fehlerreset. |
| B09.06 | BI-Demokonstanten erkennbar von echten gleichen Datenquellen unterscheiden | offen | `konzept/prototyp/bi-glas.js:9-35,107-116`. Quellenlabel plus Jetzt trotz Konstanten. |
| B09.07 | Monats-/Wochenbeschriftung konsistent machen | offen | `konzept/prototyp/bi-glas.js:10,66-70,110`. Unverändert widersprüchlich. |
| B09.08 | Stunden-/Minutenangabe korrekt aus demselben Wert ableiten | offen | `konzept/prototyp/bi-glas.js:27,88-89`. Substundenwert kombiniert mit festem `0,3 h`. |
| B09.09 | Trendfehler/Last-good/Alterung als verlässlichen Quellenzustand führen | offen | `konzept/prototyp/proto.js:171-197`. Versuchszähler vorhanden, vollständiger Frische-/Last-good-Vertrag fehlt. |

## B10 — Quittungen, Undo und Lifecycle

| ID | Einzelbedingung | Status | Aktueller Sourcebeleg / Ergebnis |
|---|---|---|---|
| B10.01 | KPI-Pause und Fortsetzen mit echtem Vorher/Nachher quittieren | fixed | `konzept/prototyp/proto.js:499-504`. Probe: Pause `läuft → pausiert`, Fortsetzen `pausiert → läuft`, passend zum Flag. |
| B10.02 | Dasselbe für Trend-Pause und Fortsetzen | offen | `konzept/prototyp/proto.js:511-515`. Unverändert verkehrt herum; Probe: Flag pausiert, Quittung `pausiert → läuft`. Kein durch Delta neu erzeugter Fehler. |
| B10.03 | Gültige Sortierung mit Vorzustand vor Mutation quittieren | fixed | `konzept/prototyp/proto.js:488-492`. Kopie vor Tausch; Probe zeigt wirkliche alte/neue Folge. |
| B10.04 | Grenz-No-op wahrheitsgemäß als unverändert behandeln | offen | `konzept/prototyp/proto.js:489-493`. Erste Zone hoch/letzte runter: Reihenfolge gleich, trotzdem gespeichert/geloggt und „höher/tiefer angeordnet“. Auch bereits Basisverhalten. |
| B10.05 | Undo-Fähigkeit/Frist aktionsspezifisch statt pauschalem „Undo 30s“ | offen | `konzept/prototyp/proto.js:39-41`. Auch Pause/Sortier-No-op erhalten dieselbe unzutreffende Zusage. |
| B10.06 | Undo-Frist in Funktion prüfen, nicht nur Button zeitlich verstecken | offen | `konzept/prototyp/proto.js:337-350`. Kein Fristvergleich in `modulUndo`. |
| B10.07 | Echten Modul-Vorzustand statt stets „geladen“ beim Entfernen erfassen | offen | `konzept/prototyp/proto.js:18,334-340`. Auch registriertes Modul so quittiert. |
| B10.08 | Entfernt-Zustand im Instanzmodell/Renderpfad erhalten | offen | `konzept/prototyp/proto.js:275-291,294-322,334-350`. Neurender setzt Karte wieder ein; Gegenaktion nur DOM-bezogen. |
| B10.09 | Gegenaktionen an Instanz, konkreten Vorgang und aktuelle Revision binden | offen | `konzept/prototyp/proto.js:343-350`; `t2-nachtwache-v3.html:266,302-307`. Globale Zustände/IDs statt Bindung. |
| B10.10 | Intervall nach Personenwechsel neu auflösen | offen | `konzept/prototyp/proto.js:457,537-545`. Wechsel zeichnet nur; Übernahme nur bei Deskriptorholen. |
| B10.11 | Intervall nach Override-Reset/Grundstandwechsel vollständig neu auflösen | offen | `konzept/prototyp/proto.js:527-545`. Rückfall teils auf bisherigen Wert. |
| B10.12 | Intervallquittung mit wirklichem Vorzustand statt festem 30s | offen | `konzept/prototyp/proto.js:458-464`. Unverändert. |
| B10.13 | Drawer-Historie nach Reload aus berechtigter persistierter Spur restaurieren | offen | `konzept/prototyp/proto.js:43-50,381-388`. Reloadversprechen ohne Ladepfad; leere Chronik beim Bauen. |
| B10.14 | BI-Sichtzustand bei Zonen-Neurender erhalten/restaurieren | offen | `konzept/prototyp/proto.js:310`; `konzept/prototyp/bi-glas.js:166-181`. `autoGesehen` verhindert erneuten automatischen Aufbau. |
| B10.15 | T2-Undo pro Karte statt letztem globalen `pendingUndo` | offen | `t2-nachtwache-v3.html:266,302-307,319-323`. Früherer Button kann spätere Karte zurücknehmen. |
| B10.16 | T1/T3-Undo-Handler nicht per mehrfacher fixer ID an ersten Treffer hängen | offen | `t1-arbeitsprofil-v3.html:267-270`; `t3-redaktionell-v3.html:259-263`. Unveränderter Altfehler. |
| B10.17 | T3-Undo nicht durch Vollreload anderer Arbeitszustände ersetzen | offen | `t3-redaktionell-v3.html:263,373-380`. Reload ist keine vorgangsgenaue Gegenwirkung. |
| B10.18 | Vor Pause gestartete Antworten entwerten/abbrechen; Reihenfolge paralleler Antworten sichern | offen | `konzept/prototyp/proto.js:112-132,171-197,499-515,554-556,571`. Prüfung nur vor Await, keine Generation/Revision/In-flight-Grenze. |
| B10.19 | Überlappende Timer-/SSE-Abrufe und Render-Lifecycle instanzbezogen kontrollieren | offen | `konzept/prototyp/proto.js:130-137,294-322,547-571`; `konzept/prototyp/bi-glas.js:168-181`. Keine gemessene Last-/Leistungsbehauptung. |
| B10.20 | Zonen gezielt wieder einblenden statt nur gesamtem Override-Reset | offen | `konzept/prototyp/proto.js:480-484,527-530`. Nur `aus:true`; auch aus Runde-2-Katalog fortgeschrieben. |
| B10.21 | Shell-Gegenaktion mit exaktem Vorwert/Vererbungszustand und sinnvoller instanzlokaler Fokusfortsetzung | offen | `konzept/prototyp/proto.js:58-64,95-106,294-322,343-350,427-433`. Kein entsprechender allgemeiner Gegenaktionsvertrag; Neurender ersetzt Zonen-DOM, Themeoverride allein restauriert keine vorherige Vererbungsbindung. |

## B11 — Schemaqualität und generischer Anschluss

| ID | Einzelbedingung | Status | Aktueller Sourcebeleg / Ergebnis |
|---|---|---|---|
| B11.01 | Obersten Schlüssel `datenquellen` erlauben | fixed | `konzept/katalog-eintrag.schema.json:120-123`; `konzept/katalog-eintrag/modul.pan528.json:35-49`. Der konkrete Runde-2-Feldwiderspruch ist beseitigt. |
| B11.02 | Container wenigstens als Array typisieren | fixed | `konzept/katalog-eintrag.schema.json:121`. Objekt/String werden in eigener Subschemaprobe verweigert. |
| B11.03 | Datenquellenelemente mit Typ, Pflichtfeldern, Werte-/Größengrenzen und Zusatzfeldpolitik validieren | offen | `konzept/katalog-eintrag.schema.json:120-123`. Kein `items`; `[null,17,"x",{}]` und falsch typisierte Objekte gültig. Feldzulassung allein ist keine Adaptergrenze. |
| B11.04 | Katalog- und Manifestdatenquellen als explizit abgestimmte Modelle beschreiben | offen | `konzept/katalog-eintrag.schema.json:122`; `konzept/modul-manifest.schema.json:20-31`; `konzept/katalog-eintrag/modul.pan528.json:35-49`. Katalog nutzt `art/pfad/redlich/fallback`, Manifest `adapter/zugriff/intervallSek/readback`; Text „wie im Modul-Manifest“ definiert keine Transformation. |
| B11.05 | Tatsächliche Einträge gegen das mitgelieferte Schema validierbar machen | fixed | `konzept/katalog-eintrag.schema.json:5-125`; `konzept/katalog-eintrag/modul.pan528.json:1-50`. Eigener Draft-2020-12-Lauf: alle elf vorhandenen Katalogeinträge ohne Schemafehler; Qualität des zu permissiven Subschemas bleibt B11.03 offen. |
| B11.06 | Deskriptor-/Schema-/Versionprüfung vor Runtime-Übernahme, kontrollierter Fehlerzustand | offen | `konzept/prototyp/proto.js:537-545`. Ungeprüfte Übernahme, Catch verschluckt Fehler. |
| B11.07 | Andere schemaerlaubte Tenantbäume sicher unterstützen | offen | `konzept/prototyp/proto.js:55-68`; `konzept/workspace.schema.json:13-25`. Fester Tenantzugriff ohne Nullgrenze. |
| B11.08 | Optionales `vorlagen` robust behandeln | offen | `konzept/prototyp/proto.js:258`; `konzept/workspace.schema.json:15,21`. Direktes `.find`, obwohl nicht required. |
| B11.09 | Tenant-/Finanzen-/pan528-Spezialzweige durch generische Auflösung/Renderer ersetzen | offen | `konzept/prototyp/proto.js:66-68,275-308,540-543`. Weiter fest verdrahtet. |
| B11.10 | Eindeutige Instanz-IDs/Zielreferenzen für mehrere Module | offen | `konzept/prototyp/proto.js:263-290,310-322`; `konzept/prototyp/zeiger.js:128-134`. Globale IDs treffen ersten passenden Bestand. |
| B11.11 | Manifest-/Slot-/Adapter-/Aktionsregistry tatsächlich auswerten | offen | `konzept/prototyp/proto.js:263-291,469-531`; `konzept/modul-manifest.schema.json:20-68`. Katalogbeschreibung ist keine Runtime. |
| B11.12 | Intervallauswahl mit Manifestwerten/Rechtefreigabe abstimmen | offen | `konzept/prototyp/proto.js:267-268,458-464`; `konzept/beispiele/pan528.manifest.json:30`. Unterschiedliche Werte und keine Rollenfreigabe. |
| B11.13 | Deklariertes Tickermaximum wirklich anwenden | offen | `konzept/katalog-eintrag/komponente.ticker-zeile.json:6-8`; `konzept/prototyp/proto.js:143-163`. Metadatum ohne Laufzeitlimit. |
| B11.14 | Zweites fachlich andersartiges Modul ohne neue Shell-Fachzweige nachweisen | offen | `konzept/prototyp/proto.js:66-68,263-308,537-545`. Kein solcher Anschluss im geprüften Pfad vorhanden. |

## B12 — Schließen, Zielreferenz, Mobilität und Modalität

| ID | Einzelbedingung | Status | Aktueller Sourcebeleg / Ergebnis |
|---|---|---|---|
| B12.01 | Primären Drawer-Close an denselben Schließpfad binden | fixed | `konzept/prototyp/proto.js:385,470-472`. Jetzt im Selektor und im ersten Zweig; isolierter Handleraufruf schließt genau einmal. Keine Browser-/Enter-/Touchabnahme. |
| B12.02 | Close-Verdrahtung ohne nachgewiesene ID-/Branchkollision | fixed | `konzept/prototyp/proto.js:385,407,470-472`. Suche unter Katalogcode fand einen Erzeuger von `dwZu`; synthetisches Element mit gleicher ID plus `data-nav/data-mod/data-kz` nimmt Close-Zweig, keine Folgemutation. Nicht Beweis für beliebige spätere DOM-Erweiterungen. |
| B12.03 | Bestehende Rückkehr-/Escapewege, Tab-Mechanik und Fokusrückkehr erhalten | fixed | `konzept/prototyp/proto.js:388-418,472,533`. Rückkehrhandler isoliert weiterhin erreicht; Fokus-/Tastaturmechanik nur statisch gelesen. |
| B12.04 | Trend-Zeigerziel und Renderer-ID zur Deckung bringen | fixed | `konzept/prototyp/zeiger.js:128-137`; `konzept/prototyp/proto.js:289`. Jetzt `#trendBild`; Blickfunktion ohne Klick. Keine geometrische Sichtbarkeitsabnahme, insbesondere BI kann das Ziel verstecken. |
| B12.05 | Äußeres Live-Viewport-Metatag ergänzen | fixed | `live/index.html:5`. `width=device-width,initial-scale=1`; Reflow folgt daraus nicht. |
| B12.06 | Desktop-Mindestbreite für schmale Geräte aufheben | offen | `konzept/prototyp/index.html:114-116`. Weiter `min-width:1024px`. |
| B12.07 | Quittung, Warum-so und Agentensteuerung mobil erreichbar halten | offen | `konzept/prototyp/index.html:80,135-141`; `konzept/prototyp/proto.js:446-450,381-388`. Assistenz ausgeblendet, Drawer kein vollständiger Ersatz. |
| B12.08 | Header/Zonen-/Perspektivaktionen durchgängig umbrechen lassen | offen | `konzept/prototyp/index.html:24,37-40,66,75`. Kein vollständiger schmaler Gesamtweg nachgewiesen. |
| B12.09 | Ganze Hintergrundoberfläche einschließlich Tour/Zeiger/äußerem Rahmen modal ausschließen | offen | `konzept/prototyp/proto.js:359-365,401-416`; `konzept/prototyp/zeiger.js:207-216`; `live/index.html:19-20`. Nur erster Header und `.layout` inert. |
| B12.10 | Führung bei Dialogen stoppen/integrieren und sinnvolle existierende Fokusziele sichern | teils | `konzept/prototyp/proto.js:415-416`; `konzept/prototyp/zeiger.js:166-216`. Rückfallziel vorhanden; vollständige Modalitäts-/Führungskoordination fehlt. |
| B12.11 | Reduzierte Bewegung auch für Zeigerpositionen und Einstellungswechsel | offen | `konzept/prototyp/zeiger.js:7-9,22-42,237-240`. Kürzere Wartezeiten/Glow aus, inline Positionsübergänge bleiben. Composertransitionen korrekt an `no-preference` gebunden (`konzept/prototyp/index.html:71,112`). |
| B12.12 | Mobilen Entscheidungs-/Fehler-/Undo-Gesamtweg real mit Reflow/Touch/Fokus prüfen | offen | `konzept/prototyp/index.html:80,114-116`; `mattekiste/m6-tests.mjs:14-27`; `mattekiste/m7a-tests.mjs:33-34`. Keine solche Abnahme hier; PNG-Delta kein Ersatz. |

## B13 — Testvalidität und Nachweisgrenzen

| ID | Einzelbedingung | Status | Aktueller Sourcebeleg / Ergebnis |
|---|---|---|---|
| B13.01 | Snapshotrelative isolierte Runtime-/Browserpfade statt Fremdpfade | offen | `mattekiste/epic-tests.mjs:3-11`; `mattekiste/m123-tests.mjs:4-15`; `mattekiste/m4-tests.mjs:14-19`. Alle zwölf Testskripte im Delta unverändert. Private Pfadwerte werden hier nicht reproduziert. |
| B13.02 | Echte Klick-/Fokusassertionen statt konstantem Erfolg | offen | `mattekiste/epic-tests.mjs:74-78`; `mattekiste/m5-tests.mjs:25-27`. `true` bleibt. |
| B13.03 | Fehlbefunde zuverlässig mit Fehlerexit melden | offen | `mattekiste/epic-tests.mjs:130-133`; `mattekiste/m123-tests.mjs:115-119`. Nur Summenausgabe. M4/M5/M6/M7a haben dagegen Fehlerexit, kein pauschaler Vorwurf. |
| B13.04 | Diagnosezustände wirklich assertieren, Wartefehler nicht verschlucken | offen | `mattekiste/bi-test.mjs:15-18,37-55`; `mattekiste/spur-test.mjs:19-25,31-36`; `mattekiste/strom-test.mjs:16-20,30-36`; `mattekiste/zeiger-loop-test.mjs:28-30`. |
| B13.05 | Manuellen Schleifenschlüssel statt veraltetem Schlüssel testen | offen | `mattekiste/bi-test.mjs:15-16`; `mattekiste/zeiger-loop-test.mjs:28-29`; Runtime `konzept/prototyp/zeiger.js:98-103,231-235`. |
| B13.06 | Screenshot-Frische/Verhalten statt bloßer Dateiexistenz nachweisen | offen | `mattekiste/epic-tests.mjs:46-52`. Neue PNGs und Erfolgszeile `konzept/TESTMATRIX.md:180` nicht übernommen. |
| B13.07 | Mutierende Skripte mit `finally`/Cleanup absichern | offen | `mattekiste/strom-test.mjs:32-38`; `mattekiste/zeiger-tour-test.mjs:21-26`; `mattekiste/m4-tests.mjs:10-16,35-45`. Deshalb nicht ausgeführt. |
| B13.08 | Falschen CSRF bei vorhandener Session, Ablaufgrenzen/Typen und Header-XSS in gebundene Tests aufnehmen | offen | `mattekiste/m4-tests.mjs:21-24`; `mattekiste/m5-tests.mjs:16-18`; Gate `mattekiste/mock-broker.mjs:91-97`. Eigene isolierte Reviewproben ersetzen keine eingecheckten Regressionstests. |
| B13.09 | Pause beide Richtungen/Instanzen, Grenz-No-op, Close und Zielreferenz spezifisch prüfen | offen | `mattekiste/m7a-tests.mjs:33-34`; `mattekiste/m6-tests.mjs:14-27,45-47`. Wortsuche „pausiert“/Escape allein genügt nicht. |
| B13.10 | Delegationsnegativfälle ohne Ende/Stufe 3 und alle Aktionen prüfen | offen | `mattekiste/m6-tests.mjs:59-70`; `konzept/prototyp/proto.js:85-105,480-530`. Nur ausgewählte Themefälle getestet. |
| B13.11 | Operationsretry, Konkurrenz/Crash, fremde Zuordnung und unabhängigen Readback prüfen | offen | `mattekiste/m4-tests.mjs:26-41`; `mattekiste/mock-broker.mjs:172-215`. Schlüsselwort/Zählergleichheit ist kein vollständiger Wirkungstest. README-AT1–AT3 nur Vorschläge. |
| B13.12 | Syntax/Schemas/axe/Bilder nicht mit realer Fach-/Browser-/Lastabnahme gleichsetzen | offen | `mattekiste/epic-tests.mjs:19-63,130-133`; `mattekiste/m4-tests.mjs:21-41`. Nachweise für weitergehende Nutzung fehlen; hier ausdrücklich keine Suite/Browserausführung. |

## Ergänzende Restbedingungen aus Runde-2-Toolkatalog und UI-Fachpfaden

Diese Zeilen führen die dort empfohlenen fehlenden Mindestfähigkeiten ausdrücklich fort. Sie behaupten keine existierende externe API. Der unveränderte ausführbare Katalogpfad ist die Beleggrenze; ungeprüfte externe Systeme sind nicht mitbewertet. Je Zeile müssen alle genannten Teilanforderungen erfüllt werden, bevor sie geschlossen werden könnte.

| ID | Einzelner Fach-/Kanalvertrag aus Runde 2 | Status | Aktueller Sourcebeleg / verbleibende Bestandteile |
|---|---|---|---|
| F01 | Gemeinsamer typisierter UI-/Agentenaktionskanal | offen | `konzept/prototyp/zeiger.js:58-95,166-203`; `mattekiste/mock-broker.mjs:192-218`. Aktions-/Payloadversion, Instanz/Ziel, Rechte, erwartete Revision, Idempotenz, Quittung und Readback fehlen durchgängig; Text/CSS-Klick plus `/api/event`/`api/ask` ist kein Ersatz (`138,151-157`). |
| F02 | Sichere Tour-/Elementziele statt mehrdeutiger Klickvollmacht | offen | `konzept/prototyp/zeiger.js:58-60,78-95,169-179`. Nur Schrittliste validiert, keine Sichtbarkeits-/Ziel-/Rechtegrenze; Wiederholung kann erneut klicken. Stop entwertet Schritte, nicht zurückliegende Fachwirkung (`107-112`). |
| F03 | Bestellvorschlag vorbereiten | offen | `t1-arbeitsprofil-v3.html:174-186`; `konzept/prototyp/proto.js:213-223`. Bedarf/Bestand, Lieferant/Positionen/Konditionen, Quellenrevision, begründeter gespeicherter Entwurf/Vorschlags-ID und Entwurfsrecht fehlen. Warenmengenkarte ist keine Bestellung. |
| F04 | Bestellvorschlag versioniert bearbeiten | offen | `t1-arbeitsprofil-v3.html:178,263-270,384-385`; `t2-nachtwache-v3.html:309-313`. Erlaubte Felder, erwartete Revision, neue Vorschau/Freigaben, Vorversion als neue Revision und vollständiger Readback fehlen. |
| F05 | Bestellung bewusst übermitteln/stornieren | offen | `t1-arbeitsprofil-v3.html:263-270`. Freigegebene Revision/Vollmacht, genau eine Zielbestellung, Bestell-ID/Inhaltsreadback und getrennter bestätigter Abbruch/Storno fehlen. |
| F06 | Freigabeschritt und Kettenstand | offen | `t2-nachtwache-v3.html:279-323`. Stufen/Betragsregeln, Zuständigkeit, Selbstfreigabesperre, Grund, atomare Entscheidung/Nachfolger, zulässiger Widerruf und pro Vorgang Teilerfolg/Verweigerung fehlen. |
| F07 | Vertretung/Eskalation | offen | `konzept/prototyp/proto.js:437-467`; `t2-nachtwache-v3.html:319-323`. Umfang/Frist, Recht, Kettenrevision, nachvollziehbare Zuständigkeitsänderung/Entzug ohne erfundene Zustimmung fehlen. |
| F08 | Beleganlage hinzufügen/verknüpfen | offen | `konzept/prototyp/proto.js:381-388`. Drawer ist Chronik; Upload-/Typ-/Größenprüfung, Quarantäne, Dokumentversion/Fingerabdruck, Belegbindung, Rechte und zulässige Entknüpfung/Aufbewahrung fehlen. |
| F09 | Beleganlage sicher ansehen/herunterladen | offen | `konzept/prototyp/proto.js:381-388`. Berechtigte Dokument-/Versionsauswahl, Prüfstatus, sicherer Viewer/Download und Beleg-/Mandantenrecht fehlen. |
| F10 | Buchung vorbereiten | offen | `konzept/prototyp/proto.js:213-223`; `konzept/beispiele/pan528.manifest.json:14-18`. Konten/Steuern/Kostenstellen, Summenprüfung, Belegrevision, gespeicherte Kontierung/Vorschau und eigenes Entwurfsrecht fehlen. |
| F11 | Buchung ausführen | offen | `mattekiste/mock-broker.mjs:175-190,198-203`. Demo-Zähler statt freigegebener Journalwirkung, Buchungsrecht, Idempotenz und führender Journal-/Wertreferenz. |
| F12 | Fachlich stornieren/Gegenbuchung | offen | `mattekiste/mock-broker.mjs:209-215`. Kontrollreset ersetzt weder Stornorecht/Zulässigkeit noch Original-/Gegenbeleg und bestätigten Stand. |
| F13 | Anlagegut entwerfen | offen | `konzept/prototyp/proto.js:213-223,275-291`. Anlagenstamm-/Belegrevision, zulässige Stammdaten/Werte, Entwurf/Readback, Vorversion und eigenes Anlagenstammrecht fehlen. |
| F14 | Anlage aktivieren/Abschreibung | offen | `konzept/beispiele/pan528.manifest.json:14-18`; `konzept/prototyp/proto.js:275-291`. Periode/Parameter/Freigabe, idempotente Wirkung, Anlagen-/Buchungsreferenz und Fachkorrektur/Rechte fehlen. Beleganhang ist kein Anlagevermögen. |
| F15 | Parallele Fenster/Sessions mit zugeordneten Konflikten/Quittungen | offen | `mattekiste/mock-broker.mjs:79,172-218`; `live/werkbank-server.py:49,99`; `konzept/prototyp/proto.js:29-35`. Session-/Fenster-/Operationsbindung, aktuelle Revision, Konflikt-/Reload-/Mergeentscheidung und Tab-Abstimmung fehlen. |
| F16 | Weitere Module generisch anschließen | offen | `konzept/prototyp/proto.js:66-68,263-308,537-545`; `konzept/modul-manifest.schema.json:20-68`. Registry für Instanz, Datenquelle, Payload/Ergebnis, Rolle/Slot und gemeinsamer Hostvertrag; zweites andersartiges Modul ohne Shell-Spezialzweig fehlen. |
| F17 | Mail-/Modellanschluss nicht aus Navigation ableiten | offen | `t1-arbeitsprofil-v3.html:148-153`; `mattekiste/mock-broker.mjs:138,217`. Künftiger Versand braucht Entwurf/Bestätigung, genau einmaligen Versand und führenden Versandreadback; Modellvorschlag bleibt von Ausführungsrecht getrennt. Keine solche Funktion ausgeführt. |
| F18 | Entwicklungssteuerung vom Fachkatalog isolieren | offen | `mattekiste/mock-broker.mjs:124-157,171`; `konzept/prototyp/proto.js:506-509`. Quellenblockade/Producer/KPI/Ereignis-/Deskriptorsteuerung brauchen explizite Berechtigung, isolierte synthetische Umgebung und Rückbau; keine normalen Fachaktionen. |

Shell-Mindestverträge aus Runde 2 sind zusätzlich einzeln oben abgebildet: Laden B09.02; Entfernen B10.06–09; Zonentoggle B10.20/B04; Sortierung B10.03–05; Theme/Haut B03/B04; Intervall B10.10–12/B11.12; Pause B10.01–02/B10.18; Perspektive/BI B09.06/B10.14; Tickerpuffer B07.10; Warum-so/Chronik B03.05/B08/B10.13/B12; Override-Reset B10.11; Führung F02/B12.09–11. Echte Quellrevision/Fokus-/Rechte-Readbacks dieser Shellaktionen fehlen weiterhin (`konzept/prototyp/proto.js:95-106,234-238,427-433,454-530`).

## Regressionseinordnung und verbleibende Grenzen

Der angeforderte Diff enthält zehn Dateien: drei JS/MJS-Runtime-Dateien, Live-HTML, Katalogschema, einen Dokumentnachtrag und vier PNGs. Alle geänderten Textzeilen wurden selbst gelesen. Der Dokumentnachtrag `konzept/TESTMATRIX.md:180` ist kein Abnahmebeleg. PNGs wurden nicht visuell geprüft.

**Keine neue negative Runtime-Regression im untersuchten Delta nachgewiesen.** Der Close-Fix verursacht im statisch vorhandenen Code keine nachgewiesene ID-/Branchkollision. Trendpause, Sortier-Grenz-No-op, permissive Ablaufkonversion und übrige Senken sind weiterhin bestehende Alt-/Restfehler. Der neue `datenquellen`-Schemaarm lässt beliebige Arrayelemente durch: eine neue zu schwache Validierungsregel bei einer gewollten Feldzulassung, kein Beleg einer neu eingeführten Runtime-Eingangskette. Ganze Schemavalidität der jetzigen Beispiele ist nicht mit Schemaqualität gleichzusetzen.

Basis der eigenen Funktionsproben: aus Source ausgeschnittenes `requireCsrf`, `esc`/`tickerZeichnen`, Spur-Lesezweig, delegierter Clickhandler und Guided-Entscheidungsblock. Nur synthetische Eingänge, String-Sink, feste Ablaufzeit, RAM-Ledger/-Log und gezielt gestubbte Nebenfunktionen; kein kompletter Runtimeimport. Details und tatsächliche Ergebnisse stehen in `01-sicherheit.md`, `02-technik.md`, `04-ui-lücken.md`. Die neuen README-Abnahmetests sind ausschließlich Vorschläge.

Unveränderte ausführliche Verträge: [Runde 2 Technik](../review-1dea6ed/02-technik.md), [Toolkatalog](../review-1dea6ed/03-tooluse-katalog.md), [UI-Fachpfade](../review-1dea6ed/04-ui-lücken.md). Relative Vergleichsverweise setzen das spätere benachbarte Review-Verzeichnislayout voraus; Vorgängerberichte wurden hier nicht kopiert. Main prüft unabhängig und publiziert separat.
