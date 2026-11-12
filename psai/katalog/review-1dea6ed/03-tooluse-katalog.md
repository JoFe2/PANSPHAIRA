# Runde 2 — Tool-Use und Funktionskatalog

Snapshot: `1dea6ed8a91096a023d4145b0d9f13255487fbdf`. Sourcepfade/Zeilen relativ zu `psai/katalog/`. Tabellen trennen belegten Iststand von empfohlenem Mindestvertrag. Fachliche Namen bei Erweiterungen sind **keine Behauptung vorhandener APIs**.

## 1. Agenten-Kommandokanal: Iststand

**Belege:** `konzept/prototyp/zeiger.js:58-60,78-95,166-203`; `live/tour.json:2-8`; `live/werkbank-server.py:49,81-82,93-99`.

Der Zeiger ist eine Vorführhilfe: Textsubstring oder CSS-Selektor bestimmen ein DOM-Ziel, `el.click()` löst die vorhandene UI-Aktion aus, anschließend wartet der Ablauf. Die Sprechblase benutzt sinnvoll `textContent` (`konzept/prototyp/zeiger.js:45-49`); `folge` entwertet laufende Touren bei Übernahme (`107-112,169-194`). Das ist aber keine Fachrevision und kein Idempotenzschlüssel.

Die Tour validiert nur eine nichtleere Schrittliste. Ziele können mehrdeutig, versteckt, veraltet oder schreibend sein. Schleifen können eine Aktion erneut klicken; es gibt keine fachliche Operationsquittung oder Readbackprüfung nach dem Klick. Das Elementinventar enthält nur gekürzte Button-/Linktexte, keine Payloadschemas, Rechte, Instanz-/Objekt-ID oder Wirkungsgrenze. Es ist zudem global statt sessionbezogen. Untrusted Tour-/Deskriptortext darf deshalb nicht zu einer zukünftigen Buchungs-/Freigabevollmacht werden.

Der separate Mock-Endpunkt `/guided/command` hat zwar benannte Aktionen und eine reparierte CSRF-Wertprüfung, aber keine ausreichende Identitäts-, Rechte-, Revisions- oder Wiederholungsbindung (`mattekiste/mock-broker.mjs:81-97,192-218`). Die Composer-Knöpfe werden nicht aus dem Manifest aufgebaut (`konzept/prototyp/proto.js:263-291,469-531`). Ein vorhandener Mock-Kommandopfad ist nicht dasselbe wie ein durchgängig angeschlossener UI-/Agentenvertrag.

**Antwort zur Endpunktkombination:** `/api/event` persistiert lediglich eine unautorisierte Tickermeldung; `/api/ask` liefert nur die Konstante `guided demo` (`mattekiste/mock-broker.mjs:138,151-157`). Zusammen mit dem heutigen `/guided` ergibt das keinen belastbaren Agenten-Wirkungskanal. Empfehlung: den bestehenden Kommandopfad zum gemeinsamen typisierten, autorisierten Quittungsvertrag ausbauen; dafür ist kein zusätzlicher paralleler Chat-/Klickkanal nötig. Ereignis, Vorschlag, Ausführungsauftrag und Wirkungsbeleg bleiben getrennte Vertragstypen.

## 2. Empfohlener gemeinsamer Aktionsvertrag

Dies ist eine Empfehlung, kein Iststand:

- Auftrag: versionierte Aktionskennung, Modulinstanz, fachliche Ziel-ID, begrenztes typisiertes Payload, erwartete Zielrevision, dauerhafter Idempotenzschlüssel.
- Hostkontext: authentifizierter Akteur/Mandant, Objekt- und Aktionsrecht, gültige Delegation einschließlich Frist und Umfang. Nicht aus Tourtext, LocalStorage-Person oder freier Rollenwahl übernehmen.
- Wirkung: atomarer Zustandsübergang oder ehrlich fortgeführte Operation; identischer Retry liefert dieselbe Quittung, geänderter Payload unter gleichem Schlüssel wird verweigert.
- Quittung: Operations-ID, Status, echte Vorher-/Nachherwerte und Revisionen, Herkunft/Beleg, Konflikt-/Fehlergrund sowie ausdrückliche Undo-Fähigkeit und Frist. Grün erst nach bestätigtem, auftragsbezogenem Readback.
- Abfrage: Status und Readback sind nebenwirkungsfrei, berechtigt und operationsgebunden. Antwortverlust bedeutet bis zur Klärung „Ausgang unbekannt“, nicht nochmaliges blindes Ausführen.
- Gegenaktion: Abbruch vor Wirkung, echter Rückbau, Kontrollreset und fachlicher Storno sind unterschiedliche Aktionen. Vorherige Wirkung nicht durch UI-Reload oder Metadatenreset als rückgängig ausgeben.

**Begründende Defekte:** `mattekiste/mock-broker.mjs:178-217` sowie `konzept/prototyp/proto.js:39-41,326-350,486-515`. Die Konzeptforderung einer deklarativen Aktion und Quittung (`konzept/AKTIONEN-QUITTUNG.md:3-14,24-26`) ist Prüfgegenstand, nicht bereits implementierte Autorität.

## 3. Katalog A — Manifestaktionen pan528

Die vier Kennungen sind im Manifest tatsächlich vorhanden (`konzept/beispiele/pan528.manifest.json:14-18`); die Serverentscheidung steht in `mattekiste/mock-broker.mjs:192-218`. „Soll“ beschreibt die noch nötigen Bedingungen.

| Aktion / Auslöser | Vorbedingung | Wirkung: Ist und notwendiger Vertrag | Undo / Gegenaktion | Readback | Autorisierung / aktueller Beleg |
|---|---|---|---|---|---|
| `RUN_STARTER` — bewusster UI-/Agentenauftrag | Ist: CSRF-Gate, ID-Format, global `IDLE`. Soll: aktuelles Ziel, erwartete Revision, gültiger Auftragsschlüssel/Payload. | Ist: `pending`, `OUTCOME_UNKNOWN`; Abschluss geschieht beim Statuslesen. Soll: genau eine zugeordnete begrenzte Operation, keine Wirkung durch Beobachtung. | Vor Wirkung bestätigter Abbruch; danach nur ausdrücklich belegte Gegenaktion. Das Manifestfenster ist keine Kompensation. | Operations-ID, Zielrevision und unabhängig beobachtete Wirkung. Der jetzige Dateizähler genügt nicht. | Manifest nennt `sachbearbeitung`/`pruefer`, Server prüft diese nicht; `mattekiste/mock-broker.mjs:192-203`, Manifest `15`. |
| `ABORT_STARTER` — Abbruch dieses Laufs | Soll: exakt aktive Operations-ID/Revision und erreichbarer Abbruchpunkt. Ist: ID nur formal geprüft. | Ist: nur `abortAcknowledged`; Status kann dennoch abschließen. Soll: Abbruch oder bereits erfolgte Wirkung verbindlich melden. | Kein Wiederbeleben derselben Operation; neuer Start ist neuer Auftrag. | Terminaler Status derselben Operation, ACK allein reicht nicht. | Manifest `sachbearbeitung`; zusätzlich Lauf-/Objekt-/Delegationsrecht nötig, aktuell ungeprüft; `mattekiste/mock-broker.mjs:205-207`, Manifest `16`. |
| `RESET_STARTER` — bewusste Bereinigung | Soll: eigene abgeschlossene konkrete Operation, passende Revision, keine ungeklärte Wirkung. | Ist: Laufmetadaten weg, `IDLE`, Zähler bleibt. Als Kontrollreset benennbar, nicht als Fach-Undo. | Keine fachliche Umkehr; getrennte Kompensation, falls verfügbar. | `IDLE` und explizit unveränderte Fachwirkung der ursprünglichen Operation. | Manifest `sachbearbeitung`, aber keine ID-/Eigentumsbindung; `mattekiste/mock-broker.mjs:209-215`, Manifest `17`. |
| `SUGGEST_STARTER` — Vorschlag anfordern | Soll: Leserecht, gültiger Quellstand, freigegebener Vorschlagstyp. | Ist: feste Demoantwort, `planOnly:true`, `activationAuthorized:false`, `modelInvocation:NOT_REQUESTED`. Gut abzugrenzen, aber kein echter Modelllauf. | Verwerfen ohne Fachwirkung. | Vorschlags-ID, Quell-/Zielrevision und typisierter Plan; kein ausgeführter Erfolg. | Manifest `sachbearbeitung`/`pruefer`, aktuelle Rolle nicht geprüft; `mattekiste/mock-broker.mjs:217`, Manifest `18`. |
| Status lesen — Poll/Benutzer/Agent | Soll: Ziel-/Operations-ID und Leserecht. | Nur lesen. Ist verletzt: GET schließt Lauf ab, zählt und loggt. | Entfällt. | Revisionsgebundener Operationsstand ohne Nebeneffekt. | Aktuell kein Gate; `mattekiste/mock-broker.mjs:172-186`. |
| Readback lesen — Wirkung prüfen | Soll: berechtigte konkrete Operation/Zielrevision. | Ist: erneutes Dateilesen, sinnvoller Ansatz, aber ungebunden. | Entfällt. | Fachbeleg/Operations-ID, Revision, Werte und Quellstand, nicht bloß `readback:true`. | Aktuell kein Gate; `mattekiste/mock-broker.mjs:188-190`. |

Die reine RAM-Probe bestätigte Retryverweigerung, fremden Abort/Reset, Abschluss trotz Abort und erneute Wirkung nach Schlüsselwiederverwendung. Hierbei waren Autorisierung und I/O gestubbt; kein Fachhost, keine reale Bestellung/Buchung und keine HTTP-Session wurden ausgeführt.

## 4. Katalog B — Shell und Modulbedienung

Die Auslöser existieren; die nachstehenden Vorbedingungen, Undo- und Rechtefelder beschreiben den notwendigen Mindestvertrag, soweit der Iststand ihn nicht erfüllt.

| Aktion / Auslöser | Vorbedingung | Wirkung / aktueller Iststand | Undo | Readback | Autorisierung / Beleg |
|---|---|---|---|---|---|
| Modul laden/aktualisieren — Modulbutton | Instanz registriert, Quelle und Leserecht verfügbar | Daten abrufen; aktuell schon vor Abruf als geladen quittiert | Vorige Ansicht erhalten; kein Fach-Undo für Lesen | Instanz, bestätigte Quellrevision/Stand oder Fehler | Modul-/Datenleserecht; `konzept/prototyp/proto.js:326-332`. |
| Modul entfernen/wiederherstellen — Entfernen/Undo | Genaue Slotbindung und Layoutrevision | Aktuell DOM entfernen/einsetzen; Neurender setzt Karte trotzdem ein | Instanz-/revisionsgebundene Gegenaktion mit überprüfter Frist | Persistierte Bindung und tatsächlich aufgelöster Stand | Eigenes Layoutrecht oder passende Delegation; `konzept/prototyp/proto.js:294-322,334-350`. |
| Zone aus-/einblenden — Zonenbutton | Zone und Pflichtzonenregel gültig | Aktuell nur `aus:true`; gezieltes Wiedereinblenden fehlt | Vorherige Sichtbarkeit dieser Zone, nicht alle Overrides löschen | Gespeicherter und effektiver Scopezustand | Erlaubtes Personen-/Layoutrecht, Sperren; `konzept/prototyp/proto.js:480-484,527-530`. |
| Zone umordnen — Hoch/Runter | Aktuelle Reihenfolge, gültiger Tausch, Layoutrevision | Lokale Sortierung; Quittung liest Vorher zu spät | Alte Reihenfolge als geprüfte Gegenaktion | Effektive Reihenfolge und Revision/Fokus | Layout-/Strukturrecht; `konzept/prototyp/proto.js:486-493`. |
| Theme wählen — Zonenselect | Erlaubter Wert, geerbte Sperren und Zielrecht | Personenoverride; nur hier wird Agentengate verwendet | Alten Wert oder Vererbungszustand exakt restaurieren | Effektiver Wert und Herkunft | Options-/Vorlagenrecht, Agentendelegation; `konzept/prototyp/proto.js:58-105,454-456`. |
| Haut wechseln — Hautbutton | Erlaubtes Shelltheme | Aktuell Klassenwechsel im Browser | Vorige Haut; keine Fachwirkung | Wirksame Haut und Herkunft | Eigenes Anzeigerecht; `konzept/prototyp/proto.js:420-433`. |
| Intervall setzen — Auswahl | Begrenzter Wert, erlaubte Quelle, aktueller Scope | Lokaler Wert/Timer; feste Vorherbehauptung „30s“ | Vorigen wirksamen Plan restaurieren | Gespeicherte Option plus tatsächlicher Abrufplan | Optionsrecht, nicht globale Quellenvollmacht; `konzept/prototyp/proto.js:458-464,537-545`. |
| KPI/Trend pausieren/fortsetzen — Pausebutton | Instanz existiert, definierte In-flight-Regel | Flag/Timer; Vorher/Nachher vertauscht, laufende Antwort nicht entwertet | Vorigen Abrufzustand wiederherstellen | Sichtbarer Pausenstatus und bestätigte Abrufgrenze | Optionsrecht, Agentengate aktuell fehlt; `konzept/prototyp/proto.js:112-132,171-197,499-515`. |
| Perspektive/BI wechseln — Umschalter | Leserecht auf denselben Datenstand | Aktuell statische Perspektiven/BI-Konstanten, keine gleiche Quellrevision | Vorige Ansicht, keine Fachumkehr | Nachweis identischer Datenrevision beider Sichten | Datenleserecht; `konzept/prototyp/proto.js:209-238`; `konzept/prototyp/bi-glas.js:9-35,133-163`. |
| Tickerpuffer übernehmen — neue Meldungen | Begrenzter Puffer, gültige Daten | Aktuell gesamter bekannter Bestand neu gerendert | Anzeigeentscheidung; kein Fach-Undo nötig | Übernommener Stand/Zahl und Restpuffer | Datenleserecht; `konzept/prototyp/proto.js:141-166,521-525`. |
| Warum-so / Chronik öffnen — Informationsbuttons | Konfigurations-/Auditleserecht | Erklärung/lokale Historie; kein autorisiertes persistentes Audit | Schließen und Fokus zurück, keine Datenumkehr | Herkunftspfad/berechtigte persistierte Einträge | Getrennte Konfigurations-/Auditrechte; `konzept/prototyp/proto.js:70-81,380-418`. |
| Eigene Overrides verwerfen — Resetbutton | Eigenes Profil und aktuelle Revision, klarer Umfang | Aktuell Browser-JSON löschen; Intervall nicht sofort neu aufgelöst | Vorige eigene Konfiguration als neue geprüfte Änderung | Erneut gelesener effektiver Zustand aller Optionen | Eigenes Profilrecht; Personenwahl ist keine Anmeldung; `konzept/prototyp/proto.js:457,527-545`. |
| Führung starten/stoppen — Zeigerbutton/Tourauftrag | Begrenzte freigegebene Tour, keine implizite Fachvollmacht | Wiederholte DOM-Klicks; Stop entwertet weitere Schritte, nicht bereits erfolgte Wirkung | Stop ist kein Fach-Undo | Tourstatus und separate echte Operationsquittung pro Fachaktion | Navigation von Fachrechten trennen; `konzept/prototyp/zeiger.js:78-112,166-226`. |

Quellenblockade, KPI-/Producersteuerung, Ereignisinjektion, Eventreset und Deskriptorersatz sind **Entwicklungssteuerung**, kein normaler Benutzer-/Agentenfunktionskatalog (`mattekiste/mock-broker.mjs:124-157,171`; `konzept/prototyp/proto.js:506-509`). Empfehlung: nur in isolierter synthetischer Umgebung, explizit berechtigt, mit begrenztem Rückbau. In einem Fachdeployment nicht als beiläufig verfügbare Modulaktion lassen.

## 5. Katalog C — Noch fehlende Fachaktionen

**Belegter Ausgangspunkt:** Waren-Demokarte und Mengenänderung (`t1-arbeitsprofil-v3.html:174-186,384-385`), Einzelfreigabe/Sammelbutton (`t2-nachtwache-v3.html:279-323`), statische Belegliste (`konzept/prototyp/proto.js:213-223`) sowie ein Chronik- statt Anlagendrawer (`380-388`). Diese begrenzten UI-Wege belegen weder Bestellung, Freigabekette noch Buchhaltung. Die folgenden Zeilen sind ausschließlich Empfehlungen für einen benutzbaren Mindestumfang.

| Modulaktion / Auslöser | Vorbedingung | Wirkung | Undo / Gegenaktion | Readback | Autorisierung |
|---|---|---|---|---|---|
| Bestellvorschlag vorbereiten — Bedarf/Agentenauftrag | Lesbare Bestands-/Bedarfsquellen mit Revision, Lieferanten-/Positionsbezug | Versionierten begründeten Entwurf erzeugen, noch nichts bestellen | Entwurf verwerfen | Gespeicherte Positionen, Quellen und Vorschlags-ID | Vorschlags-/Entwurfsrecht Einkauf, keine Bestellvollmacht |
| Bestellvorschlag bearbeiten — Mengen/Lieferant/Kondition ändern | Aktueller Entwurf, erwartete Revision, erlaubte Felder | Neue Entwurfsrevision; Wirkungsvorschau/Freigaben neu bewerten | Vorversion als neue Revision übernehmen | Vollständiger Entwurf und neue Vorschau | Vorgangsbezogenes Entwurfsrecht |
| Bestellung übermitteln — bestätigte freigegebene Revision | Vollständige Freigabe, Idempotenzschlüssel, gültige Vollmacht | Genau eine externe Bestellung | Vor Übermittlung abbrechen, danach nur bestätigtes Storno/Änderungsverfahren | Bestell-ID/Inhalt aus führendem Ziel, auftragsgebunden | Bestellrecht; Agent nur mit ausdrücklich passender Delegation |
| Freigabeschritt entscheiden — Freigeben/Ablehnen | Aktuelle Stufe/Revision, Zuständigkeit, Selbstfreigabesperre, ggf. Pflichtgrund | Entscheidung und nächste Stufe/Ablehnung atomar speichern | Widerruf nur soweit fachlich zulässig; sonst Gegenentscheidung | Kettenstand, Entscheidung, Akteur und Revision | Schritt-, Betrags- und Vertretungsrecht, keine freie Rollenauswahl |
| Freigabe vertreten/eskalieren — Abwesenheit/Frist | Autorisierte Vertretung, Frist, aktuelle Kettenrevision | Zuständigkeit nachvollziehbar ändern, keine Zustimmung erfinden | Vertretung entziehen, soweit zulässig | Kette mit Herkunft/Frist und neuem Zuständigen | Administratives oder klar delegiertes Vertretungsrecht |
| Beleganlage hinzufügen/verknüpfen — Upload/Auswahl | Erlaubte Größe/Typ, Prüfung/Quarantäne, bestehender Zielbeleg | Sicher gespeicherte Dokumentversion zuordnen | Berechtigte Entknüpfung; Löschen nur gemäß Aufbewahrung | Dokument-ID, Inhaltsfingerabdruck, Prüfstatus, Belegrevision | Dokument-Schreibrecht und Zielbelegzugriff |
| Beleganlage ansehen/herunterladen — Dokumentauswahl | Leserecht auf Beleg und Version, freigegebener Prüfstatus | Sichere Darstellung/Download, keine beliebige aktive Fremdseite | Schließen, kein Daten-Undo | Exakte Dokument-/Versionsreferenz | Objekt-/Mandantenleserecht; Zugriff nicht aus Dateipfad ableiten |
| Buchung vorbereiten — Kontierungsauftrag | Aktuelle Belegrevision, zulässige Konten/Steuern/Kostenstellen | Prüfbaren Buchungsentwurf ohne Journalwirkung speichern | Entwurf verwerfen/Vorversion übernehmen | Kontierung, Summen, Prüfhinweise, Entwurfsrevision | Kontierungsrecht, nicht implizit Buchungsrecht |
| Buchung ausführen — explizite bestätigte Revision | Vollständige Kontierung/Freigabe, aktuelle Revision, Idempotenz | Genau eine Journal-/Fachbuchung | Kein UI-Rollback; nur definierter Fachstorno | Buchungs-/Journal-ID und Werte aus führendem System | Buchungsrecht und ggf. getrennte Freigaberolle |
| Buchung stornieren — begründeter Gegenauftrag | Konkrete Buchung, fachliche Zulässigkeit, aktuelle Revision | Referenzierte Gegenbuchung, Original bleibt erhalten | Weitere Korrektur ist neuer Fachvorgang | Original-/Stornoreferenz und bestätigter Stand | Eigenes Stornorecht |
| Anlagegut entwerfen — Anlagenbuchhaltungsauftrag | Stammdaten-/Belegrevision und gültige Werte | Anlagegutentwurf, nicht Aktivierung | Entwurf verwerfen/Vorversion | Anlagenentwurf, Werte und Quelle | Anlagenstammrecht |
| Anlage aktivieren/Abschreibung anstoßen — bestätigter Fachauftrag | Freigegebener Anlagenstand, zulässige Periode/Parameter, Idempotenz | Bestätigte Anlagen-/Buchungswirkung | Nach Wirkung nur zulässige Fachkorrektur | Anlagen-ID, Fachrevision und Buchungsreferenzen | Anlagenbuchhaltungs-/Buchungsrecht |

„Anlagen“ wird damit in beiden Bedeutungen getrennt: Beleganhänge und Anlagevermögen. Ein Upload ersetzt keine Anlagenbuchhaltung.

## 6. Weitere Module und minimaler Generiknachweis

**Beleg der Grenze:** Der aktuelle Renderer verzweigt fest auf Tenant/Finanzen/pan528 und erzeugt feste IDs (`konzept/prototyp/proto.js:66-68,263-308,537-543`). Manifest-/Slotschema existiert (`konzept/modul-manifest.schema.json:20-68`), wird aber nicht als allgemeiner Laufzeitvertrag ausgewertet.

**Empfehlung:** Jedes weitere Modul registriert Instanz, Datenquellen, erlaubte Aktionen, Payload-/Ergebnisschemata, Rollen und unterstützte Slots; alle Aktionen benutzen denselben Hostvertrag. Als kleiner Nachweis eignen sich ein Bestellvorschlagsentwurf und ein dokumentbezogenes zweites Modul, ohne neue Shell-Fachzweige. Mail- oder Modellanbindung darf nicht aus den Navigationstexten als vorhanden abgeleitet werden (`t1-arbeitsprofil-v3.html:148-153`). Ein zukünftiger Mailversand müsste Entwurf, Bestätigung, genau einmaligen Versand und führenden Zustell-/Versandreadback trennen; ein Modellaufruf müsste Vorschlag und Ausführungsrecht getrennt halten. Das sind keine hier getesteten Funktionen.

Keine dieser Empfehlungen ist im Review implementiert worden. Keine echte Fachaktion, Bestellung, Freigabe, Dateiannahme oder Buchung wurde ausgeführt.
