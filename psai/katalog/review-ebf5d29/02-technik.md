# Runde 3 — Technikdelta und Schemaqualität

HEAD `ebf5d299bccfc0d3cf79521519e03e7ea498e3f7`, Basis `1dea6ed8a91096a023d4145b0d9f13255487fbdf`. Alle Sourcepfade relativ zu `psai/katalog/`, aktuelle Zeilen. Für unveränderte Architektur-/Generik-/Testvaliditätsdetails gilt [Runde 2 Technik](../review-1dea6ed/02-technik.md); aktuelle Einzelstände stehen in `00-nachpruefung.md`.

## 1. B10: KPI und gültige Sortierung verbessert, Gesamtvertrag weiter unvollständig

`konzept/prototyp/proto.js:488-492` hält mit `ab.slice()` nun den alten Zustand vor dem Tausch fest. Isolierte Handlerprobe für zweite Zone hoch: `Startseite → Finanzen (pan528)` wird korrekt zu `Finanzen (pan528) → Startseite` quittiert. Zuvor stand die neue Reihenfolge auf beiden Seiten.

`proto.js:499-504` quittiert KPI-Pause jetzt `läuft → pausiert`, Fortsetzen `pausiert → läuft`, passend zu `kzPausiert`. **Nur KPI:** Trend-Pause (`511-515`) ist unverändert vertauscht, beide Richtungen in derselben isolierten Probe bestätigt.

Grenz-No-op bleibt irreführend: erste Zone hoch/letzte runter (`489-493`) erzeugt identische Reihenfolgen, speichert trotzdem ein Override, loggt Sortierung und behauptet „höher/tiefer angeordnet“. Das ist Altverhalten, keine durch die Vorzustandskopie eingeführte Regression. `quitt` hängt auch hier pauschal „Undo 30s“ an (`39-41`). Echte Frist-/Instanzbindung, Modul-Lifecycle, Personen-/Reset-Intervall, BI-/Drawer-Restaurierung und T1/T2/T3-Undo bleiben offen; die betreffenden Codepfade wurden selbst gelesen.

Probegrenze: der originale delegierte Clickhandler wurde mit einem einfachen Selektor-Matchstub, RAM-Reihenfolge/-Override, protokollierten `quitt`-/`chrono`-Aufrufen und gestubbten Timern/Renderern aufgerufen. Keine native Eventkette, kein DOM-Layout, kein Fokus-/Touch-/Timerabnahmebeleg.

## 2. B11: Schemaformalität korrigiert, Datenquellenqualität fehlt

`konzept/katalog-eintrag.schema.json:120-123` fügt optional `datenquellen` mit `type: array` hinzu. Nach JSON-Normalisierung ist die übrige Schemastruktur identisch mit der Basis; die große Diffmenge ist ansonsten Formatierung. Der konkrete Widerspruch zu `konzept/katalog-eintrag/modul.pan528.json:35-49` ist **fixed**.

Tatsächlich mit vorhandenem Python-`jsonschema` und `Draft202012Validator` geprüft, ohne Installation, Netzabruf oder entfernte Referenzauflösung:

- Die drei lokalen Schemata sind gegen den Draft-2020-12-Metaschemavertrag akzeptiert.
- Alle elf Katalogeinträge validieren gegen das jetzige Katalogschema ohne Fehler; auch das aktuelle pan528-Manifest validiert gegen sein eigenes Manifestschema.
- 16 JSON-Dateien syntaktisch eingelesen: drei Schemata, zwei Beispiele, elf Katalogeinträge. Das ist ein begrenzter eigener Validatorlauf, keine Repository-Suite.

Isolierte Prüfung genau des neuen `datenquellen`-Subschemas:

| Eingabe | Ergebnis |
|---|---|
| Aktuelles Array des pan528-Katalogeintrags | akzeptiert |
| `[null,17,"x",{}]` | akzeptiert |
| Array mit Objekt: numerische ID, boolesche Art, Arraypfad, Objekt als Redlichkeitswert, null als Fallback | akzeptiert |
| Leeres Array | akzeptiert |
| Objekt statt Array | verweigert |
| String statt Array | verweigert |

Die Containerprüfung ist real, aber **kein `items`**, keine Pflichtfelder, Elementtypen, Enum-/Längen-/Anzahl-/Eindeutigkeitsgrenzen oder Zusatzfeldpolitik. Damit lassen sich selbst offensichtlich untaugliche Datenquellen als schemagültig ausgeben. Kein neuer Runtimeadapter ist im Delta angeschlossen; eine neu exponierte Netz-Eingangskette daraus wird nicht behauptet.

Auch die Beschreibung „wie im Modul-Manifest“ (`schema.json:122`) ist nicht präzise: Das Manifest nutzt `id/adapter/zugriff/intervallSek/readback` (`konzept/modul-manifest.schema.json:20-31`), der Katalogeintrag `id/art/pfad/redlich/fallback` (`modul.pan528.json:35-49`). Notwendig ist ein ausdrücklich abgestimmtes, typisiertes Modell oder eine definierte Transformation. Nicht blind das Manifest-Subschema kopieren, solange die tatsächlichen Katalogfelder bewusst anders heißen. Runtime-Schemavalidierung/Versionierung und Registry fehlen unverändert (`proto.js:66-68,258,263-308,537-545`).

## 3. B05/B06: weiterhin offen, eigene begrenzte Reproduktion

Der Guided-/Speicherblock ist im Delta unverändert; vollständig selbst gelesen (`mattekiste/mock-broker.mjs:26-30,46-58,79,172-218`). Es fehlen dauerhaftes Idempotenzregister, Payloadbindung, erwartete Revision, atomarer gemeinsamer Übergang und Operationsrechte/-zuordnung. Ganzdatei-Lese-/Schreibsnapshots teilen sich Producer, Sessions und Requests. Lesen/Korruption fällt auf leeren Default zurück.

Ausgeführte synthetische Sequenz am aus Source extrahierten Entscheidungsblock:

| Schritt | Tatsächliches Ergebnis im RAM-Harness |
|---|---|
| Start mit Schlüssel A | `OUTCOME_UNKNOWN`, Zähler 0 |
| Identischer Retry A | `GUIDED_STARTER_NOT_IDLE_DENIED` statt gleicher Operation/Quittung |
| Abort mit fremder formgültiger ID B | ACK für A gesetzt |
| Status nach Abort | `SUCCEEDED`, `childCompleted=true`, `abortAcknowledged=true`, Zähler 1, ein Completionlog |
| Readback | Zähler 1/Status/Stand/Quellenlabel, ohne Operations-/Revisionsbindung |
| Reset mit ID B | `IDLE`, Zähler bleibt 1 |
| Neuer Start mit altem Schlüssel A, dann Status | erneut Wirkung, Zähler 2, zweites Completionlog |

Auch ein mitgesendetes `expectedRevision`/Payload wird nicht als Vorbedingung ausgewertet. Die Probe setzte Auth explizit außer Kraft und ersetzte Laden/Speichern/Log durch RAM-Kopien; sie belegt weder echte fremde HTTP-Autorisierung noch persistente Parallelitäts-/Crashfehler. Den für B05/B06 notwendigen realen Abnahmekatalog liefern exakt drei **vorgeschlagene, nicht ausgeführte** parametrisierte Tests in README.

## 4. Testvalidität und tatsächliche Kontrollen

Alle zwölf Repository-Testskripte wurden gelesen und sind gegenüber der Basis unverändert. Konstante Erfolgsassertionen, fehlende Fehlerexits in Epic/M123, Fremdpfade, Wortsuche statt richtiger Vorher/Nachher-Assertion, ungebundener Readback und fehlender abgesicherter Rückbau bleiben; keine Suite gestartet. Aktuelle Einzelbelege unter B13 in `00-nachpruefung.md`.

Eigene Syntaxkontrolle: drei klassische Runtime-JS-Dateien mit Node-VM kompiliert, Broker mit `node --check` (Exit 0); Pythonserver mit `ast.parse` ohne Import; JSON-/Schema-Prüfung wie oben. Syntax-/Metaschemaerfolg sagt nichts über Ablauf, Berechtigung, Crashkonsistenz oder Fachwirkung. Vier PNG-Änderungen wurden nicht visuell bewertet, `konzept/TESTMATRIX.md:180` nicht als Erfolgsbeleg übernommen.

Keine Produktänderung, Installation, Server-/Browserausführung, Netzwerkmutation, Git-Schreibaktion oder Veröffentlichung. Keine privaten Daten-/Schlüsseldateien geöffnet. Die vorhandenen generischen Grenzen und Altfehler sind keine neue Runtime-Regression dieses Diffs; eine pauschale Regressionsfreiheit ist nicht behauptet.
