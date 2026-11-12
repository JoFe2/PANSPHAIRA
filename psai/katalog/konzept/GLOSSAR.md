# GLOSSAR — PsAI Desktop-Composer (AP-A1.1 bis AP-A1.3)

## Abschnitt 1 — Grundbegriffe (AP-A1.1)

| Begriff | Definition | Abgrenzung |
|---|---|---|
| **Workspace** | Die Gesamtheit eines konfigurierbaren Arbeitsplatzes: ein Baum aus Knoten mit Layout-, Design- und Funktionschicht. | Nicht eine „Seite“ — ein Workspace enthält viele Sichten/Zonen. |
| **Knoten** | Allgemeine Strukturkarte im Konfigurationsbaum. Trägt Vorlagen, Optionen, Eigentümer, Sperren, Delegationen. | Scopes sind eine Sonderform; alles ist ein Knoten. |
| **Vorlage (Template)** | Wiederverwendbare, versionierte Beschreibung für eine Schicht (layout/design/funktion). Im Baum nur als Referenz + Gewichtung. | Keine Kopie: Vorlagen werden referenziert, Varianten über Optionen erzeugt. |
| **Zone** | Abgrenzbarer Bereich eines Layouts mit festem Zweck und eigenem Verhalten (Anker, Mindestbreite, Einklapp-Regel). | Zone ≠ Panel: Zonen sind Stellen im Raster, Panels sind Inhalte in Zonen. |
| **Panel** | Ein gerahmter Inhalt in einer Zone mit eigener Kopfzeile und Aktionen. | Panels können Module aufnehmen, sind aber nicht selbst Module. |
| **Modulbaustein (Modul)** | Selbstbeschreibungnde Funktion mit Manifest: Datenquellen, Aktionen, Slots, Optionen, Mitliefer-Template. | Modul ≠ Kachel: Die Kachel ist nur ein Slot-Inhalt des Moduls. |
| **Viewlet** | Kleine, in eine Zone einbindbare Anzeige (Kennzahl, Ticker, Mini-Chart) mit eigenem Aktualisierungsintervall. | Viewlet ≠ Panel: kein eigener Rahmen/Kopf, immer in fremdem Panel. |
| **Overlay** | Über der Grundfläche erscheinende Ebene (Drawer, Modal, Popover) mit definiertem Rückkehrpfad. | Overlay ≠ neue Seite: Kontext der Grundseite bleibt lesbar oder wiederherstellbar. |
| **TabGroup** | Gruppe von Reitern, die zwischen Inhalten derselben Zone umschalten. | Reiter wechseln Inhalt, Overlay überlagert. |
| **DataSource** | Formal beschriebene Datenquelle mit Adapter (REST/CSV/Mock/Stream), Readback und Status. | DataSource ≠ Cache: Quelle ist führender Speicher, Adapter holt only-read. |
| **Aktion** | Deklarative Handlung (id, payload, erwarteter Effekt) mit Quittung, Undo-Fenster, Rohlog-Link. | Aktion ≠ Klick: erst die fachliche Bedeutung zählt, nicht das UI-Ereignis. |
| **Option** | Schlüssel mit Default, erlaubten Werten, Rollenfreigabe, Anzeigeort. Steuerung erfolgt über Register, nie über Weglass. | Option ≠ Flag im Code: Optionen sind Laufzeit-Deskriptoren. |
| **Sperre** | Erklärung eines Knotens, dass ein Token/Options-Schlüssel von Kindern nicht überschrieben werden darf. | Sperre ≠ Entfernen: die Option bleibt sichtbar, nur nicht änderbar (Warum-so zeigt die Sperre). |
| **Delegation** | Zuweisung von Rechten an Person/Gruppe/Rolle/Agent mit Gültigkeit und Protokollierung. | Delegation ≠ Rollenzuweisung: sie wirkt nur auf ihren Knoten (und ggf. Teilbaum). |
| **Deskriptor** | Konkrete, validierbare JSON-Instanz des Workspace-Schemas (z.B. workspace.minimal.json). | Deskriptor ≠ Schema: Schema beschreibt Regeln, Deskriptor ist ein Werk. |

## Abschnitt 2 — Abgrenzungen UI-Elemente (AP-A1.2)

**Icon vs. Kachel vs. Reiter**
- **Icon:** reines Erkennungszeichen, nur bedienbar im Verbund (z.B. in Kachel/Reiter/Nav). Kein eigenständiges Navigationsziel.
- **Kachel:** Flächen-Element mit Titel, Status und einer Hauptaktion. Ist Navigationsziel ODER Inhalt, nie beides gleichzeitig; der Manifest-Eintrag entscheidet („kachel.typ: nav|inhalt“).
- **Reiter:** Umschalter zwischen Geschwister-Inhalten derselben Zone. Ändert nie den Ort (URL/Rückpfad bleibt derselbe Bereich).

**Navigationsziel vs. Inhalt vs. Umschalter**
- Navigationsziel verändert den Fokus-Kontext (Zone/Bereich/Perspektive).
- Inhalt zeigt Daten/Aktionen innerhalb des aktuellen Kontexts.
- Umschalter (Reiter, Filter-Chips, Dichte-Schalter) verändert nur die Darstellung, nie den Kontext.
- Merkregel für Manifeste: `slot: nav` = Ziel, `slot: panel|overlay|status` = Inhalt, `option:` = Umschalter.

## Abschnitt 3 — Eigentümer und Delegation (AP-A1.3)

**Eigentümerklassen:** `person | gruppe | rolle | agent`. Jeder Knoten hat genau einen Eigentümer;
weitere Berechtigte kommen über Delegationen.

**Rechtearten:** `lesen | schreiben | vorlagenBinden | sperrenSetzen | delegieren`.
- schreiben: Optionen/Feinwerk des Knotens ändern.
- vorlagenBinden: TemplateRefs hinzufügen/entfernen (Struktur-Eingriff).
- sperrenSetzen: Sperren für Kinder definieren (Compliance-Hebel).
- delegieren: eigene Delegationen vergeben (nur Eigentümer oder mit `delegieren`).

**Agenten als Eigentümer:** optional konfigurierbar (Beschluss B5/B10). Agenten-Änderungen
erzeugen immer: Warum-so-Eintrag, Quittung, Undo-Punkt. Ein Agent darf nie ohne gültige
Delegation schreiben; delegierte Agenten-Rechte verfallen automatisch (`gueltigBis` Pflicht).

**Warum-so-Antwort:** je Element der Auflösungspfad (Knoten → Regel → Eigentümer/Sperre).
Regelklassen: Struktur (höherer Knoten rahmt), Feinwerk (tieferer Knoten führt),
Tokens (Root-Defaults, Kinder überschreiben außer bei Sperre).
