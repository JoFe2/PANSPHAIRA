# Runde 2 — Sicherheit

Snapshot: `1dea6ed8a91096a023d4145b0d9f13255487fbdf`. Quellverweise relativ zu `psai/katalog/`, aktuelle HEAD-Zeilen. Statischer Review mit begrenzten synthetischen Funktionsproben, keine Server-, Browser- oder Fachhostabnahme.

## Urteil und Betriebsgrenze

**ROT für Fach-/LAN-Nutzung und einen vertrauenswürdigen Agenten-Schreibkanal.** Die explizite Loopback-Bindung und der echte CSRF-Wertvergleich sind reale Fortschritte, aber keine Authentifizierung oder vollständige XSS-Behebung. Maßgeblich sind die nachstehenden Codepfade, nicht der Erfolgsnachtrag in `konzept/TESTMATRIX.md:179` oder die Anzeige „GESCHÜTZTE SITZUNG“ in `konzept/prototyp/index.html:124`.

### Demo ist nicht LAN

**Beleg:** Beide Startpfade binden jetzt an `127.0.0.1` (`live/werkbank-server.py:112-113`; `mattekiste/mock-broker.mjs:229`). Die Werkbank benennt sich als lokaler Entwicklungsloop ohne Authentifizierung (`live/werkbank-server.py:2-7`).

**Einordnung:** Für eine isolierte synthetische Demo ist dies eine sinnvolle Expositionsreduktion. Andere lokale Prozesse bleiben mögliche Aufrufer. Ob fremde Webseiten einen bestimmten Loopbackzugriff tatsächlich ausführen können, hängt zusätzlich von Browser-/Netzwerkregeln ab; ein universeller browserseitiger Bypass wird nicht behauptet. Proxy, Tunnel, Firewall und laufende Listener wurden nicht untersucht.

**Empfehlung:** Nicht durch Umstellen der Bind-Adresse zum LAN-Piloten erklären. Der Composer benutzt fest Loopback, der Zeiger einen abweichend konfigurierbaren Broker (`konzept/prototyp/proto.js:6`; `konzept/prototyp/zeiger.js:127`). Auf einem anderen Rechner zeigt Loopback auf diesen anderen Rechner. Ein fachlicher LAN-Betrieb benötigt einen konsistenten, geschützten Deploymentpfad und die unten beschriebenen Grenzen.

## S1 / B02 — CSRF-Wertprüfung repariert; Identität und Aktionsrechte bleiben offen

**Belege:** `mattekiste/mock-broker.mjs:81-97,192-218`; `konzept/beispiele/pan528.manifest.json:15-18`.

Der eingereichte Header `x-pan527-csrf` geht nun über `hash(csrf)` in `timingSafeEqual` gegen den gespeicherten Digest ein. Das ist ein tatsächlicher Wertvergleich, nicht nur eine Formatprüfung. Der Ablauf wird vor dem Kommandobody geprüft. Der verwendete Sessioneintrag wird aber nicht gegen Benutzer, Mandant oder erlaubte Aktion autorisiert. Bootstrap benötigt keine Identität und erzeugt für jeden Aufrufer `reviewer`; keine der Starteraktionen prüft diese Rolle. Eine Bootstrap-Session kann deshalb das neue CSRF-Gate regulär passieren. Ein CSRF-Token ist keine Benutzerberechtigung.

Das Cookie enthält `Path=/; SameSite=Strict`, nicht `HttpOnly` oder `Secure`, und der Token steht zusätzlich im JSON-Body (`85-87`). Die Cookieflags sind für die reine HTTP-Demo technisch einzuordnen, aber keine geeignete Schutzbehauptung für echte Daten oder unverschlüsseltes LAN. `HttpOnly` allein würde zudem ein bereits im selben Origin laufendes XSS nicht daran hindern, autorisierte Requests auszulösen.

**Empfehlung:** Hostseitig authentifizierter Bootstrap, serverbestimmte Akteurs-/Mandantenzuordnung, Recht pro Aktion/Objekt und Delegation; angemessene HTTPS-/Cookiepolitik und kein unnötiges Token-Echo. Mock-Steuerpfade strikt von Fachaktionen trennen.

### Ablaufdetails, die nicht pauschal als „fixed“ gelten dürfen

**Belege:** `mattekiste/mock-broker.mjs:85,91-96,192-202`.

- Numerischer Ablauf in der Vergangenheit wird abgewiesen: korrigiert.
- Gleichheit wird wegen `>` statt `>=` noch akzeptiert. Das ist eine kleine Grenzsemantik, kein großer selbstständiger Exploit.
- Ein wahrer, nichtnumerischer Wert wie `not-a-time` ergibt im Vergleich `NaN` und wird akzeptiert. Der normale Bootstrap schreibt Zahlen; die Probe belegt fehlende fail-closed Datenvalidierung bei abweichendem gespeichertem Zustand, keinen vom HTTP-Client unmittelbar frei wählbaren Ablauf.
- Die Prüfung erfolgt vor dem unbeschränkten Einlesen des Bodys. Für eine Zusage „keine Wirkung nach Ablauf/Entzug“ fehlt eine erneute Prüfung am verbindlichen Schreibpunkt. Ob Gültigkeit bei Requestzulassung genügen soll, ist ein festzulegender Vertrag; der Code implementiert nur diese frühe Zulassung.
- Abgelaufene Sessions werden nicht entfernt (`82-87,89-96`).

**Empfehlung:** Endlichen numerischen Ablauf, klare exklusive Ablaufgrenze, Fristen-/Entzugsprüfung am definierten Wirkungspunkt und Retention festlegen. Diese Restpunkte sind keine gegenüber der Basis nachgewiesene Verschlechterung.

## S2 / B03 — Ereignisgruppen-XSS bleibt unmittelbar erreichbar

**Belegte Kette:**

1. Ohne Session- oder Rechteprüfung nimmt `/api/event` `gruppe` und `text` aus URL-Parametern an und speichert sie (`mattekiste/mock-broker.mjs:151-157`).
2. `/api/events` liefert diese Felder zurück (`140-148`).
3. `tickerZeichnen()` escaped beide Werte in der Ereigniszeile (`konzept/prototyp/proto.js:149`), aber **nicht `e.gruppe` in der ersten Gruppenüberschrift** (`148`).
4. Der gesamte String wird `list.innerHTML` zugewiesen (`151`).

Damit bleibt der ursprüngliche unautorisierte Ereignis-zu-HTML-Weg über `gruppe` offen. Ein Tag im Header wird nicht dadurch unschädlich, dass dieselbe Gruppe weiter unten escaped erscheint. Die Funktionsprobe benutzte lediglich ein inertes Markup-Tag und einen String-Sink; kein Browser und kein Eventhandler wurden ausgeführt.

**Empfehlung:** Gruppenüberschrift ebenfalls als Text setzen oder für genau diesen Kontext escapen. Nicht nur den bislang verwendeten Testpayload nach `text` absichern. Negativtests müssen Header und Ereigniszeile getrennt prüfen.

## S3 / B03 — Escape-Kontexte und verbleibende Senken

| Kontext / Eingang | Aktueller Beleg | Bewertung |
|---|---|---|
| `esc` für HTML-Text und doppelt zitierte HTML-Attribute | `konzept/prototyp/proto.js:8,41,75-80,149,250-255,259,306-307` | `&`, `<`, `>`, Doppelquote werden kodiert; die geprüften Text-/Doppelquote-Verwendungen sind verbessert. Fehlende Apostrophkodierung ist in diesen konkreten Kontexten kein eigener Ausbruch. |
| Vorlagenkennung aus ersetzbarem Deskriptor | `konzept/prototyp/proto.js:258`; `mattekiste/mock-broker.mjs:124-129` | Weiterhin rohe HTML-Interpolation. JSON-Syntaxprüfung ist keine Schema-/Sinkprüfung. |
| Navigations-ID desselben Deskriptors | `konzept/prototyp/proto.js:317-318,475` | `data-nav` bleibt roh. Zusätzlich ist spätere CSS-Selektorkonkatenation kein durch HTML-Escaping abgesicherter Selektorkontext. Schema-ID-Regeln werden zur Laufzeit nicht angewandt. |
| Person aus LocalStorage | `konzept/prototyp/proto.js:16,78,362` | Weiterhin rohe HTML-Interpolation. Lokaler gespeicherter Eingang, nicht allein dadurch ein entfernter Angriffsweg. |
| Modul-Rohlog | `konzept/prototyp/proto.js:104,225-226` | `JSON.stringify` wird als HTML eingesetzt; JSON-Serialisierung ist kein HTML-Escaping. Der Host-Rohlog nutzt dagegen sinnvoll `textContent` (`230`). |
| Trendtitel | `konzept/prototyp/proto.js:186-189` | Für Attribut-/Textkontext korrigiert; isolierte Probe zeigte keinen rohen Markuptag mehr. |
| Trendwerte / SVG | `konzept/prototyp/proto.js:177-191` | `x.werte[11]` und Tabellenwerte bleiben roh; weder Typ, Endlichkeit, Länge noch Punktzahl werden geprüft. Ein als Zahl erwarteter String erreicht SVG-Text, ARIA-Attribut und HTML-Zellen. Rechenoperationen an anderen Stellen erzeugen daraus allenfalls `NaN`, säubern aber die direkten Interpolationen nicht. |
| T1/T3-Ablehnungsgrund | `t1-arbeitsprofil-v3.html:290-299`; `t3-redaktionell-v3.html:277-284,373-380` | Lokale Benutzereingabe bleibt in HTML-/OuterHTML-Senken; T3 speichert Entwürfe unter gemeinsamem Schlüssel. Keine neue entfernte Eingangskette behauptet. |
| BI-Glas-Konstanten | `konzept/prototyp/bi-glas.js:9-35,38-116` | Viele String-/SVG-Senken, derzeit mit lokalen Konstanten. Das ist nicht automatisch ein externer Exploit; beim späteren Adapteranschluss muss eine neue Typ-/Textgrenze eingeführt werden. |

**Numeric-SVG-Einordnung:** Der aktuelle Broker erzeugt die Trendreihen selbst mit numerischen Werten (`mattekiste/mock-broker.mjs:159-165`). Die synthetische Stringprobe demonstriert deshalb eine fehlende Typgrenze des Renderers, nicht einen zusätzlichen im aktuellen Mock nachgewiesenen Netzwerkpfad. Auch `punkte=1` mit Nullwert erzeugte `NaN`/`Infinity`; die festen zwölf Mockpunkte kaschieren diese Generiklücke.

**Empfehlung:** Texte über DOM-Textknoten, Attribute über sichere Zuweisungen plus Wertallowlist, Selektoren über stabile Referenzen beziehungsweise passende Selektorkodierung behandeln. Trenddaten strikt als begrenzte Arrays endlicher Zahlen prüfen, Punktzahl/Längen abstimmen und Null-/Einzelpunktfälle gesondert rendern. Ein universelles `esc` ersetzt weder Zahlenvalidierung noch URL-, CSS- oder Rechteprüfung.

## S4 / B01, B04, B08 — Ungeschützte Schreib- und Lesepfade

**Belege:** `mattekiste/mock-broker.mjs:98-157,171,178-190`; `live/werkbank-server.py:49,79-103`; `konzept/prototyp/proto.js:58-64,85-105,454-515`.

Deskriptorersatz, Ereignisinjektion, Eventreset, Quellenblockade, Producer- und KPI-Steuerung besitzen kein Gate. Mehrere Mutationen sind GETs; Statuslesen führt sogar den Starterabschluss aus. Weder Host noch Origin werden anwendungsseitig geprüft. Die Spur ist frei les-/beschreibbar; Clientfelder können den serverseitigen Zeitdefault überschreiben (`mattekiste/mock-broker.mjs:111`). Das globale Elementinventar ist nicht nach Person, Fenster oder Session getrennt. Rollen-/Sperrtexte im Deskriptor werden angezeigt, aber nicht durchgesetzt.

CORS kombiniert `*` mit Credentials (`mattekiste/mock-broker.mjs:76-78`). Diese Kombination erlaubt nicht pauschal credentialed Cross-Origin-Lesen; sie ist dafür ungeeignet. Nichtcredentialed freigegebene Zugriffe und direkte HTTP-Clients werden dadurch nicht autorisiert. Eine browserseitige CORS-Fehlermeldung ist kein Schutz für den Server.

**Empfehlung:** Für alle schreibenden Fachpfade Methode, Identität, Zielrecht und CSRF/Origin prüfen; Status strikt lesend machen; Entwicklungssteuerung isolieren. Auditprovenienz serverseitig setzen, Lesen objekt-/mandantengebunden erlauben. Keine echte Datenoffenlegung oder konkrete Browserangriffsausführung wurde geprüft.

## S5 / B07 — Eingangs-, SSE-, Speicher- und Dateigrenzen

**Belege und Abgrenzung:**

- Python liest `Content-Length` unbeschränkt; die Integerkonvertierung liegt vor dem lokalen Fehlerfang, negative Werte werden nicht vorab verworfen. Kürzen auf 80 Elemente zu 60 Zeichen erfolgt erst nach Einlesen und Parsing (`live/werkbank-server.py:93-101`).
- Node sammelt Bodies vollständig. Die 64-KiB-Spurregel kommt danach; Deskriptor und Kommandos haben nicht einmal diese nachgelagerte Obergrenze (`mattekiste/mock-broker.mjs:106-109,124-127,192-195`). Zeichenlänge ist zudem keine robuste Empfangsbytegrenze.
- Jeder Python-SSE-Hörer hält einen Thread mit Endlosschleife; eigene Hörer-/Lebensdauer-/Schreibgrenzen fehlen (`live/werkbank-server.py:54-78,113`). Der Broker begrenzt Hörer nicht und ignoriert `write()`-Backpressure (`mattekiste/mock-broker.mjs:32-35,61,98-104`). Das ist ein statischer Ressourcenbefund, kein durchgeführter Lastangriff.
- Die Spurdatei wird vollständig gelesen, dann gesliced; `seit=0` und nichtnumerische Eingaben liefern über `slice(-0)` die ganze Liste (`mattekiste/mock-broker.mjs:118`). Session-, JSONL-, UI-Map-, Rohlog- und Chronikretention fehlen (`82-87,106-119`; `konzept/prototyp/proto.js:24-26,43-50,143-163`).
- SSE liefert keine belastbaren Event-IDs/Resume-Grenzen. `onopen` holt keinen konsistenten Snapshot nach; das Streamflag wird bereits vor erfolgreicher Verbindung gesetzt und nicht bei Fehler zurückgenommen (`mattekiste/mock-broker.mjs:33-35,98-104`; `konzept/prototyp/proto.js:547-562`).
- Die Werkbank reicht allgemeine GETs an die breite statische Wurzel durch (`live/werkbank-server.py:15,48-51,79-85`). Der Broker normalisiert relative Pfade, prüft jedoch keine realen Zielpfade oder Allowlist (`mattekiste/mock-broker.mjs:220-226`). Eine funktionierende einfache `../`-Traversal oder vorhandene auswärts gerichtete Symlinks werden nicht behauptet; fremde Dateibäume wurden nicht untersucht.

**Empfehlung:** Frühe Byte-/Timeout-/Strukturgrenzen, exakte Methodenzuordnung, bounded Pagination/Retention, SSE-Budgets mit Backpressure und Snapshotnachholung sowie enge, reale Auslieferungsgrenzen. Dateirechte und externe Schlüssel-/Ledgerbestände sind nicht bewertet; sie wurden nicht geöffnet.

## Tatsächlich ausgeführte synthetische Kontrollen

Aus Basis und HEAD wurden ausschließlich `requireCsrf`, `esc`, `tickerZeichnen`, `trendLaden` und `agentDarf` als Text extrahiert. Node-VM-Kontexte erhielten synthetische Header/Sessionzeilen, feste Probezeit, RAM-Objekte, eine Fake-JSON-Quelle und einen bloßen String-Sink. Keine vollständige Runtime wurde importiert; keine Netzverbindung, Dateiablage, realer DOM oder echte Session wurde verwendet.

| Probe | Basis | HEAD |
|---|---|---|
| Korrekter CSRF, gültige synthetische Session | angenommen | angenommen |
| Falscher CSRF mit 64 Hexzeichen | angenommen | `HOSTED_CSRF_DENIED` |
| Zu kurzer CSRF | verweigert | verweigert |
| Numerischer Sessionablauf vor Probezeit | angenommen | `HOSTED_SESSION_EXPIRED` |
| Ablauf exakt gleich Probezeit | angenommen | angenommen |
| Fehlender Ablauf | angenommen | `HOSTED_SESSION_EXPIRED` |
| Wahrer nichtnumerischer Ablauf | angenommen | angenommen |
| Keine Session | verweigert | verweigert |
| Markuptag in Tickergruppenüberschrift | roh enthalten | roh enthalten |
| Gruppe/Text in Ereigniszeile | roh enthalten | escaped |
| Markuptag im Trendtitel | roh enthalten | escaped |
| String-Markup im numerisch erwarteten Trendwert | roh enthalten | roh enthalten |
| Trend: ein Punkt, Nullwert | nichtendliche Koordinaten | nichtendliche Koordinaten |
| Stufe 2 ohne Ende / Stufe 3 mit altem Ende | erlaubt / erlaubt | erlaubt / erlaubt |

Eine zusätzliche HEAD-Probe bestätigte escaped IDs/Themes an den korrigierten Doppelquote-Senken, aber rohe Vorlagenkennung und rohen Personenwert in „Warum so?“ (`konzept/prototyp/proto.js:78,248-261`). Die Slice-Probe bestätigte die unbeschränkte Auswahl bei `seit=0` und nichtnumerischem Wert. Das sind reproduzierte Funktions-/Stringeigenschaften, **keine** Penetrations-, Cookie-, Browser-, Last- oder LAN-Abnahme und keine pauschale Behebung von B01–B08.
