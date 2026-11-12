# PsAI Desktop-Composer — unabhängiger Snapshot-Review

Snapshot: `1b58dc4879a7b8bba37ae40005f4db6b8affb410`. Alle Quellverweise sind relativ zu `psai/katalog/` und beziehen sich auf diesen eingefrorenen Commit. Statischer Review, keine Browser-/Hostabnahme.

## Durchführung und Ablieferung

Analyse mit Hermes-Worker `gpt-6.1-sol`, gestartete Reasoning-Stufe `xhigh`; Worker normal mit Exitcode 0 abgeschlossen. Der initiale Standalone-Codex-Start scheiterte vor der Analyse an Authentifizierung; die Analyse erfolgte danach über Hermes. Die Modellidentität wurde im lokalen Sitzungsdatensatz bestätigt. Keine Behauptung einer zusätzlichen unabhängigen Wire-Prüfung des Reasoning-Parameters.

Der Orchestrator prüfte zentrale Befunde am Quelltext nach und reproduzierte die fehlerhafte CSRF-Wertprüfung in einem synthetischen isolierten Funktionsaufruf (siehe 01). Nur Reviewdokumente werden in diesem Branch veröffentlicht; keine Produktkorrekturen, kein Merge, kein Release und keine Bestätigung der gemeldeten Playwright-/axe-Ergebnisse.

## Abschnitte

- [01 — Sicherheit](01-sicherheit.md)
- [02 — Technik und Tests](02-technik.md)
- [03 — Tool-Use und Funktionskatalog](03-tooluse-katalog.md)
- [04 — UI-Lücken](04-ui-lücken.md)

## 1. Prüfgrundlage und Urteil

Die Quell- und Dokumentprüfung war auf `psai/katalog/` beschränkt. Die genannten Dateien `konzept/prototyp/proto.js`, `bi-glas.js`, `zeiger.js`, beide zugehörigen HTML-Einstiege, `live/werkbank-server.py` und `mattekiste/mock-broker.mjs` wurden selbst gelesen. Hinzu kamen sämtliche zwölf Testskripte in `mattekiste/`, die drei Schemas, Beispiel-Deskriptoren, elf Katalog-JSON-Einträge und die Konzept-/Prüfdokumente. Für den UI-Abgleich wurden außerdem die Inhalts- und Skriptbereiche der drei V3-Templates herangezogen. Repository-Texte einschließlich früherer Review-Ergebnisse wurden ausschließlich als untrusted Prüfgegenstand behandelt, nicht als Arbeitsanweisung oder Erfolgsnachweis.

`HEAD` entspricht dem angeforderten Snapshot. Der auf `psai/katalog/` begrenzte Vergleich gegen diesen Commit sowie die abschließende Statusabfrage waren ohne Änderungen beziehungsweise zusätzliche Dateien. Der Analyseworker führte keine Installation, keinen Serverstart, keine Git-Schreibaktion, keinen Zugangsdatenzugriff und keine Ausführung von Repository-Code oder Tests aus. Die anschließende Orchestrator-Veröffentlichung und der synthetische Funktionscheck sind oben separat ausgewiesen. Als rein statische Strukturkontrollen wurden 17 JSON-Dateien syntaktisch eingelesen, erlaubte oberste Katalogfelder abgeglichen und der Python-Server mit `ast.parse` geparst. Das ist ausdrücklich keine vollständige Schema-, Funktions- oder Sicherheitsprüfung.

**Urteil:** Als synthetische Desktop-Werkbank ist der Aufbau nachvollziehbar und weiterverwendbar. Der Snapshot ist jedoch weder für einen ungeschützten LAN-Piloten noch als verlässlicher Agenten-Schreibkanal freigabefähig. Die wichtigsten Blocker liegen nicht bei „Vanilla ES“, sondern bei fehlenden Vertrauensgrenzen, wirkungsloser CSRF-Wertprüfung, injizierbarem HTML und fehlender atomarer Operationsbindung. Eine produktfähige UI-DSL ist konzipiert, aber noch nicht als generischer Interpreter umgesetzt.

Alle nachfolgenden `Datei:Zeile`-Angaben sind relativ zu `psai/katalog/`. „Belegt“ bezeichnet einen im Quelltext nachvollziehbaren Defekt, nicht einen ausgeführten Exploit. Bedingte Betriebsrisiken und Empfehlungen sind gesondert ausgewiesen.

### Ampel je Facette

| Facette | Ampel | Begründung |
|---|---|---|
| Qualität | 🟡 GELB | Überschaubare Dateien, lokale Zustandskapselung und erkennbare Interaktionsmuster; gleichzeitig fehlerhafte Quittungen, inkonsistenter Lifecycle und konkurrierende Zustandsänderungen. |
| Generik | 🟡 GELB | Brauchbarer deklarativer Konzeptkern mit Schemas und Slots; der ausführbare Renderer bleibt tenant-/pan528-spezifisch und setzt wesentliche Verträge nicht durch. |
| Agentenwerkzeuge | 🔴 ROT | Text-/CSS-Klicktour statt fachlich typisiertem Kommandovertrag; keine belastbare Idempotenz, Revisionsbindung oder auftragsbezogene Wirkungskontrolle. |
| Sicherheit | 🔴 ROT | Entwicklungsserver nicht auf Loopback begrenzt; ungeschützte Mutationen, defekte CSRF-Prüfung und vollständige Datenquelle-zu-HTML-Injektionsketten. |
| UI | 🔴 ROT | Desktop-Demonstrator vorhanden, aber kein vollständiger Bestell-/Freigabe-/Buchhaltungsweg; mobile Nutzung wird explizit auf Desktopbreite gezwungen. |
| Testvalidität | 🔴 ROT | Nützliche Erfolgsweg-Skripte, jedoch harte Fremdpfade, teilweise reine Konsolenausgaben oder konstante Erfolgsassertionen und keine ausreichenden Negativ-/Parallelitätstests. |

Keine Ampel beruht auf den im Dossier behaupteten Test- oder axe-Erfolgen.

## 8. Genau drei priorisierte Maßnahmen insgesamt

### 1. P0 — Vertrauensgrenze vor weiterer Daten-/LAN-Freigabe schließen

Werkbank und Mock ausdrücklich auf Loopback begrenzen und Entwicklungsfunktionen von einem künftigen Fachhost trennen. Auslieferung auf freigegebene Pfade begrenzen und reale Dateigrenzen absichern. Auf einem freigegebenen Host müssen Identität, Mandant, Aktionsrechte, Sessionablauf und tatsächlicher CSRF-Wert geprüft werden; mutierende GETs entfallen. Untrusted Werte als Text beziehungsweise streng typisierte Attribute rendern. Request-, Session-, SSE-, Puffer- und Loggrenzen sowie minimale PII-Aufbewahrung gehören zur selben Schutzgrenze.

**Abnahmekriterium:** Unangemeldete, fremdmandantige, abgelaufene, falsch-originierte und falsch-CSRF-signierte Zugriffe verändern nichts; Ereignis-/Deskriptortext kann kein Markup ausführen; Pfad- und Größenverletzungen werden vor Einlesen/Wirkung abgewiesen. Eine reine Browser-CORS-Blockade zählt nicht als Autorisierung. Bis dahin nur isolierte synthetische Demo, keine Behauptung „LAN-sicher“.

### 2. P1 — Einen atomaren, quittierten Aktionskern statt klickbasierter Fachwirkung liefern

Auftrag, Hostkontext, Quittung und Undo nach Abschnitt 5 trennen. Operationen serialisiert/transactional mit erwarteter Revision und dauerhaftem Idempotenzregister anwenden. Wiederholungen liefern dieselbe Wirkung/Quittung; fremde Operations-IDs dürfen keinen Lauf abbrechen oder zurücksetzen. Statuslesen wird nebenwirkungsfrei; Abort beendet tatsächlich oder meldet einen bereits überschrittenen Wirkungspunkt. Readback referenziert die konkrete führende Wirkung, Reset wird nicht als Buchungs-Undo verkauft.

**Abnahmekriterium:** Gezielte Fälle für Antwortverlust nach Wirkung, doppelten Auftrag, veränderten Payload mit gleichem Schlüssel, zwei konkurrierende Clients, veraltete Revision, Delegationsablauf, Abort/Abschluss-Rennen und fehlgeschlagene Gegenaktion. Kein zweiter Effekt und kein unbestätigtes Grün. Adapterprüfung und echter Fachhostnachweis bleiben getrennt.

### 3. P2 — Einen kleinen generischen, mobil benutzbaren Fachpfad mit ehrlichen Tests abschließen

Den vorhandenen Vanilla-Pfad behalten, aber Manifest-/Slot-Registry, Komponenteninstanzen und gemeinsamen Daten-/Aktionsadapter anschließen. Einen Bestellvorschlag vom Entwurf über Bearbeitung und Freigabeschritt bis zum bestätigten Zielstand umsetzen; Beleganhang und Buchungsgrenze sichtbar anschließen, statt weitere statische Erfolgskarten zu bauen. Ein fachlich andersartiges zweites Modul muss ohne neue Tenant-/Domänenzweige im Shellcode integrierbar sein. Mobil die Desktop-Mindestbreite entfernen und Quittung, Assistenz und Konfliktentscheidung erreichbar halten. Testpfade snapshotrelativ, isoliert, aufräumend und mit echten Assertions/Fehlerstatus gestalten; Dossier- und Katalogbehauptungen auf den tatsächlich geprüften Stand begrenzen.

**Abnahmekriterium:** Derselbe fachliche Vertrag funktioniert über UI und Agentenadapter, bei schmalem Viewport und mit zwei Sessions; Vorher/Nachher, Undo und Readback bleiben eindeutig. Ein frischer Testlauf kann bekannte Negativfälle tatsächlich fehlschlagen lassen. Neue axe-, Reflow- oder Host-Ergebnisse werden erst nach eigener Ausführung behauptet.

## 9. Abschluss und Nachweisgrenzen

Der Review liefert statisch nachvollziehbare Defekte und begrenzte Strukturkontrollen, keine ausgeführte Penetrations-, Browser-, Last-, Accessibility- oder Fachhostabnahme. Bestehende externe Dienste, private Ablagen und Zugangsdaten wurden nicht untersucht. Keine Vollsuite und auch keine einzelne Repository-Testdatei wurden ausgeführt; der separat ausgewiesene synthetische CSRF-Funktionscheck ist keine solche Suite.

Die tragfähige Richtung ist ein kleiner deklarativer Vanilla-Kern mit hostseitiger Autorität. Der derzeitige Snapshot belegt diese Autorität und den sicheren Gesamtweg noch nicht. Die vorstehende Reihenfolge priorisiert deshalb zuerst Schutz der Daten-/Netzgrenze, dann Wirkungsintegrität und anschließend den wiederverwendbaren, vollständig benutzbaren Fachpfad.
