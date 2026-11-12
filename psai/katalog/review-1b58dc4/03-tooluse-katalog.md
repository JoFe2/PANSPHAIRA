# 03 — Agentenwerkzeuge und Funktionskatalog

Snapshot: `1b58dc4879a7b8bba37ae40005f4db6b8affb410`. Alle Quellverweise sind relativ zu `psai/katalog/` und beziehen sich auf diesen eingefrorenen Commit. Statischer Review, keine Browser-/Hostabnahme.

## 5. Agentenkanal: Werkzeug statt Klicknachahmung

Der Zeiger ist als Vorführhilfe verständlich: Er berechnet die Elementgeometrie selbst, verwendet `textContent` für seine Sprechblase und kann durch einen Benutzerklick gestoppt werden (`zeiger.js:25-60,107-112,221-226`). Als fachlicher Agenten-Kommandokanal reicht das nicht:

- Ein Ziel ist ein Textsubstring oder CSS-Selektor. Es fehlt eine stabile Aktions-/Objektkennung; mehrdeutige, versteckte oder inzwischen ersetzte Elemente werden nicht fachlich aufgelöst (`zeiger.js:58-60,92-95,169-179`).
- Die Tour wird nur auf eine nichtleere Schrittliste geprüft. Sie kann wiederholt denselben mutierenden Button klicken. Die sichtbare Liste enthält außerdem nur Buttontexte, keine Eingabeschemas, Rechte, Revisionen oder erwarteten Effekte (`zeiger.js:78-89`).
- Nach `el.click()` wird eine Zeit gewartet. Es gibt kein auf die Operation bezogenes Ergebnis, keine Quittungsvalidierung und keinen Readback. Die lokale Variable `folge` entwertet Tourdurchläufe, ist aber keine fachliche Revision oder Idempotenz (`zeiger.js:166-203`).
- Der Host liest kein Benutzerziel aus einer vertrauenswürdigen Autorität ab. Frei geschriebene Tour-/Deskriptordaten dürfen deshalb keine künftige Buchungs- oder Freigabeautorität werden.

Ein minimaler fachlicher Vertrag muss Auftrag, Hostkontext, Quittung und Gegenaktion trennen: versioniertes Aktionsschema, Ziel-ID, erwartete Revision und Idempotenzschlüssel im Auftrag; serverseitig bestimmter Akteur/Mandant/Delegation; Operations-ID, Vorher-/Nachherrevision, Konfliktstatus und Wirkungsbeleg in der Quittung. Readback muss genau diese Wirkung referenzieren. Antwortverlust bleibt bis zur Operationsabfrage „Ausgang unbekannt“. Undo muss ausdrücklich zwischen Abbruch vor Wirkung, echtem Rückbau und fachlicher Gegenbuchung unterscheiden. Das ist Maßnahme 2; es wird nicht als vorhandene Implementierung behauptet.

## 7. Minimaler Funktionskatalog je Modulaktion

Die folgenden Tabellen sind ein **Mindestvertrag**, keine Behauptung über bereits vorhandene Fähigkeiten. In Tabelle A stehen die tatsächlich im Manifest benannten Aktionen; „Ist“ nennt die Abweichung. Autorisierung bezeichnet jeweils die erforderliche Hostprüfung, nicht eine wirksame Prüfung im Snapshot. Auch lesende Funktionen brauchen Objekt-/Mandantenberechtigung.

### A. Vorhandene pan528-Aktionskennungen

Grundlage: `konzept/beispiele/pan528.manifest.json:14-18` und `mattekiste/mock-broker.mjs:178-218`.

| Aktion | Auslöser | Vorbedingung | Wirkung | Undo | Readback | Autorisierung |
|---|---|---|---|---|---|---|
| `RUN_STARTER` | Expliziter UI-Auftrag oder gleichwertiges Agentenkommando. | Aktuelles Ziel `IDLE`, passende Revision, gültige Eingaben, noch nicht verbrauchter Auftragsschlüssel. | Einen begrenzten Prüflauf anlegen und nachvollziehbar abschließen. Ist: zunächst `pending`, Abschluss durch Status-GET. | Vor Wirkung bestätigter Abbruch; nach Wirkung nur expliziter Rückbau, kein pauschales Reset-Versprechen. | Operations-ID, Abschluss, Nachherrevision und erwartete/observierte Wirkung aus führendem Speicher. Ist: Dateizähler ohne diese Bindung. | Manifestrollen `sachbearbeitung`/`pruefer`, Objekt-/Mandantenzugriff und gültige Agentendelegation. |
| `ABORT_STARTER` | Benutzer oder autorisierter Agent fordert Abbruch dieses Laufs an. | Exakte aktive Operations-ID und Revision; Abbruchpunkt noch erreichbar. | Lauf tatsächlich stoppen oder bereits erfolgte Wirkung ehrlich melden. Ist: nur `abortAcknowledged=true`. | Kein Wiederbeleben desselben Laufs; neuer Start ist neuer Auftrag. | Terminaler Abbruch-/Wirkungsstatus derselben Operation; ein ACK allein genügt nicht. | `sachbearbeitung` mit Recht am betroffenen Lauf; fremde IDs ablehnen. |
| `RESET_STARTER` | Bewusste Bereinigung eines abgeschlossenen eigenen Demo-Laufs. | Gleiche abgeschlossene Operation, passende Revision, keine ungeklärte Wirkung. | Nur Kontrollzustand zu `IDLE`; verbrauchte Wirkung/Budget bleiben explizit bestehen. | Keine fachliche Umkehr; ggf. getrennte Gegenaktion anbieten. | `IDLE` plus Nachweis, was unverändert blieb. | `sachbearbeitung` am eigenen Ziel; Sessionrolle allein genügt nicht. |
| `SUGGEST_STARTER` | Nutzer fordert Vorschlag an. | Leserecht, freigegebener Quellstand, gültiger Vorschlagstyp. | Plan ohne Ausführung. Ist: fester Demo-Vorschlag mit `activationAuthorized:false`. | Verwerfen; keine Fachwirkung zurückzunehmen. | Typisierter Vorschlag mit Quell-/Zielrevision und eindeutiger Vorschlags-ID. | `sachbearbeitung`/`pruefer`; Ausführungsrecht folgt daraus nicht. |

`STATUS_LESEN` und `READBACK_LESEN` ergänzen diese Aktionen als reine Abfragen: Auslöser Poll/Benutzer/Agent; Vorbedingung Leserecht und konkrete Ziel-/Operations-ID; Wirkung nur Zustand liefern; Undo entfällt; Readback enthält Revision, Stand und Wirkungsreferenz; Autorisierung am Objekt. Der jetzige schreibende Status-GET verletzt gerade diese Minimaldefinition.

### B. Gemeinsame Shell-/Modulbedienung

Grundlage der derzeitigen Auslöser: `proto.js:325-349,453-531`, `bi-glas.js:133-163`, `zeiger.js:198-226`.

| Aktion | Auslöser | Vorbedingung | Wirkung | Undo | Readback | Autorisierung |
|---|---|---|---|---|---|---|
| Modul laden/aktualisieren | Aktualisieren-Button oder deklarative Aktion. | Modul registriert; Adapter und Leserecht verfügbar. | Daten abrufen; „geladen“ erst nach erfolgreicher Quelle. | Kein Daten-Undo; vorherige Ansicht erhalten. | Modulinstanz, Quellrevision, Zeit und Fehlerstatus. | Modul-/Datenleserecht; kein implizites Fachschreibrecht. |
| Modul entfernen / wiederherstellen | Entfernen beziehungsweise passender Undo-Auftrag. | Konkrete Instanz und unveränderter Layoutstand. | Bindung ausblenden/entfernen beziehungsweise genau diese Bindung zurücksetzen. | Revisionsgebundene Gegenaktion innerhalb belegter Frist. | Persistierte Slotbindung, nicht bloß vorhandenes DOM. | Eigenes Layoutrecht oder autorisierte Strukturdelegation. |
| Zone sichtbar setzen | Explizites Ein-/Ausblenden. | Zone existiert; Pflichtzonenregel erlaubt die Änderung. | Personen-Override setzen. | Vorherige Sichtbarkeit gezielt wiederherstellen. | Neu aufgelöster Personen-/Zonenstand. | `schreiben` auf erlaubtem Personenscope. |
| Zone umordnen | Hoch-/Runter-Aktion. | Zwei gültige Positionen, aktuelle Layoutrevision. | Reihenfolge ändern; Fokus erhalten. | Alte Reihenfolge mit Revisionsprüfung. | Gespeicherte und tatsächlich aufgelöste Reihenfolge. | Layoutrecht; Sperren beachten. |
| Theme/Haut wählen | Select oder Hautknopf. | Zulässige Auswahl, keine geerbte Sperre. | Designreferenz/Personenwert ändern. | Vorherigen Wert/Vererbungszustand wiederherstellen. | Effektiver Wert und Herkunft. | Freigegebenes Options-/Vorlagenrecht; bei Agenten gültige Delegation. |
| Live-Intervall setzen / pausieren / fortsetzen | Select beziehungsweise jeweiliger Button. | Gültiger Bereich, freigegebene Datenquelle. | Abrufplan ändern; Pause beendet weitere Übernahme nach definierter Regel. | Vorherigen Abrufzustand herstellen. | Persistierte Option plus wirksamer Laufzustand. | Optionsrecht; keine Befugnis zum globalen Quellenblockieren. |
| Perspektive/BI wechseln | Umschalter. | Leserecht auf denselben Datenstand. | Darstellung statt Datenquelle wechseln. | Zur vorigen Ansicht zurück. | Gleiche fachliche Datenrevision in beiden Sichten. | Datenleserecht, optional eigene Anzeigeoption. |
| Warum-so / Chronik öffnen | Informationsbutton. | Leserecht auf Konfiguration beziehungsweise Auditbereich. | Erklärung/zugelassene Historie anzeigen. | Schließen mit Fokus-Rückkehr; keine Datenumkehr. | Herkunftspfad beziehungsweise zugelassene persistierte Einträge. | Getrennte Konfigurations-/Audit-Leserechte. |
| Eigene Overrides verwerfen | Reset mit klar benanntem Umfang. | Eigenes Profil und dessen aktuelle Revision. | Nur eigene Overrides entfernen, alle Laufoptionen neu auflösen. | Vorherigen Override-Satz als Gegenaktion wiederherstellen, soweit zugesagt. | Neu gelesene Overrides und effektiver Zustand. | Eigenes Profilrecht, nicht beliebige Personenauswahl. |
| Führung starten/stoppen | Zeigerknopf oder ausdrücklicher Tourauftrag. | Freigegebene, begrenzte Tour; keine offene unautorisierte Fachaktion. | Navigation/Erklärung; Fachwirkungen nur über separat autorisierten Aktionsadapter. | Stop entwertet ausstehende Schritte, nicht bereits ausgeführte Fachwirkungen. | Tourstatus und echte Operationsquittungen für jede Fachaktion. | UI-Führung getrennt von Fachrechten; Benutzerübernahme jederzeit. |

Quellenblockade, Producerumschaltung, Ereignisinjektion und vollständiger Deskriptorersatz gehören in eine getrennte Entwicklungsfunktion. Sie sind keine gewöhnlichen Benutzer-/Agenten-Modulaktionen. Ihr Mindestvertrag wäre: expliziter Entwicklungsauftrag, isolierte synthetische Umgebung, administrative Berechtigung, protokollierte Änderung und begrenzter Wiederherstellungsweg; im produktiven Aktionskatalog dürfen sie nicht beiläufig verfügbar sein.

### C. Mindestergänzung für die fehlenden Fachmodule

Diese Aktionen sind **Empfehlungen für den Funktionsumfang**, nicht implementierte Endpunkte. Kennungen sind absichtlich fachliche Bezeichnungen, keine erfundenen vorhandenen APIs.

| Modulaktion | Auslöser | Vorbedingung | Wirkung | Undo | Readback | Autorisierung |
|---|---|---|---|---|---|---|
| Bestellvorschlag vorbereiten | Bedarfskontext oder bewusster Agentenauftrag. | Lesbare Bestands-/Bedarfsquellen; Lieferanten-/Positionsbezug; Quellrevision. | Versionierten Entwurf mit Begründung und Wirkungsvorschau erzeugen, nicht bestellen. | Entwurf verwerfen; Änderungen am Entwurf separat versionieren. | Gespeicherter Entwurf mit Positionen und Quellreferenzen. | Vorschlags-/Entwurfsrecht im Einkauf; keine Bestellvollmacht. |
| Bestellvorschlag bearbeiten | Benutzer ändert Menge, Lieferant oder Kondition. | Entwurf und erwartete Revision; Felder freigegeben. | Neue Entwurfsrevision; abhängige Vorschau/Freigaben neu bewerten. | Vorversion als neue Revision übernehmen. | Vollständiger Entwurf samt neuer Vorschau. | Entwurfsrecht auf diesen Vorgang. |
| Bestellung übermitteln | Bestätigte freigegebene Entwurfsrevision. | Alle nötigen Freigaben, eindeutiger Auftragsschlüssel, gültige Vollmacht. | Genau eine externe Bestellung auslösen. | Vor Versand abbrechen; danach nur definierter Storno-/Änderungsprozess. | Bestell-ID und Inhalt aus dem führenden Ziel, an die Operation gebunden. | Bestellberechtigung; Agent nur mit passender ausdrücklicher Delegation. |
| Freigabeschritt entscheiden | Freigeben/Ablehnen mit Entscheidung und ggf. Pflichtgrund. | Aktuelle Stufe/Revision; zuständige Person; keine verbotene Selbstfreigabe. | Entscheidung protokollieren und nächste Stufe oder Ablehnung setzen. | Widerruf nur solange fachlich möglich; sonst neue Gegenentscheidung. | Kettenstand, Entscheider, Revision und Entscheidungsbeleg. | Schrittbezogene Freigaberolle und Vertretungsregel. |
| Beleganlage hinzufügen/verknüpfen | Upload oder Auswahl eines vorhandenen Dokuments. | Dateigröße/-typ erlaubt; Prüfung/Quarantäne; Zielbeleg vorhanden. | Versioniertes Dokument sicher speichern und dem Beleg zuordnen. | Berechtigte Entknüpfung; Löschen von Aufbewahrungsregeln abhängig. | Dokument-ID, Prüfergebnis, Inhaltsfingerabdruck und Belegrevision. | Dokument-Schreibrecht und Belegzugriff; Anzeige/Download separat leseberechtigt. |
| Buchung vorbereiten | Kontierungsauftrag. | Belegrevision, zulässige Kontierungsdaten und Quellen vorhanden. | Prüfbaren Buchungsentwurf ohne Journalwirkung speichern. | Entwurf verwerfen oder Vorversion übernehmen. | Kontierung, Summen/Prüfhinweise und Entwurfsrevision. | Kontierungsrecht; keine implizite Buchungsfreigabe. |
| Buchung ausführen | Explizite Freigabe der geprüften Entwurfsrevision. | Vollständige Kontierung, erforderliche Freigaben, aktuelle Revision und Idempotenzschlüssel. | Genau eine Journal-/Fachbuchung anstoßen. | Nicht als UI-Rollback; nur fachlich definierter Storno. | Journal-/Buchungs-ID und Beträge aus führendem System. | Buchungsrecht und gegebenenfalls getrennte Freigaberolle. |
| Buchung stornieren | Begründeter Gegenauftrag zur konkreten Buchung. | Buchung existiert; Storno erlaubt; aktuelle Revision. | Referenzierte Gegenbuchung erzeugen. | Kein Löschen des Originals; weitere Korrektur ist neuer Fachvorgang. | Original-/Stornoreferenz und bestätigter Fachstand. | Eigenes Stornorecht, nicht bloß ursprüngliches UI-Undo. |

Falls „Anlagen“ Anlagevermögen bezeichnet, braucht es zusätzlich einen getrennten Aktionsvertrag für Anlagegutentwurf und Aktivierung: Auslöser bestätigter Beleg-/Anlagenauftrag; Vorbedingung aktuelle Stamm-/Belegrevision und zulässige Werte; Wirkung versionierter Anlagenstamm beziehungsweise bestätigte Aktivierung; Undo vor Wirkung Verwerfen, danach fachliche Korrektur; Readback Anlagen-ID und Fachrevision; Autorisierung Anlagenbuchhaltungsrecht. Ein Anhang-Upload deckt diese Bedeutung nicht ab.

