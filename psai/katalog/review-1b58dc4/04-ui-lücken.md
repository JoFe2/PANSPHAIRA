# 04 — UI-Lücken und Folgemodule

Snapshot: `1b58dc4879a7b8bba37ae40005f4db6b8affb410`. Alle Quellverweise sind relativ zu `psai/katalog/` und beziehen sich auf diesen eingefrorenen Commit. Statischer Review, keine Browser-/Hostabnahme.

### B12 — Mittel bis hoch: Mobile Darstellung und Modalität sind nicht durchgängig

**Belege:** `konzept/prototyp/index.html:24,37-40,44,75,80-83,114-116`; `konzept/prototyp/proto.js:400-415,445-449`; `konzept/prototyp/zeiger.js:7-9,22-42,207-226,237-240`; `live/index.html:3-6`.

Die späte Regel `body{min-width:1024px}` bei Viewports unter 1024 Pixeln erzwingt horizontalen Desktopraum. Sie ist keine mobile Reflow-Lösung. Unter 1100 Pixeln verschwindet die gesamte Assistenzleiste einschließlich Quittung, Warum-so und Agentensteuerung, ohne dass diese Funktionen vollständig in den Drawer überführt würden. Der Kopf und mehrere Aktionsreihen sind nicht umbrechbar. Der äußeren Live-Seite fehlt außerdem das Viewport-Metatag.

Der Drawer besitzt Initialfokus, Tab-Schleife, Escape und Fokus-Rückkehr — statisch erkennbare sinnvolle Mechanismen. `inert` wird aber nur auf Header und `.layout` gesetzt. Der später direkt an `body` gehängte Zeiger-Startknopf liegt außerhalb und bleibt als weiterer Interaktionspunkt bestehen. Die Modalitätsgrenze ist damit nicht vollständig.

Reduced Motion verkürzt in der Zeigerführung Wartezeiten und entfernt den Glow. Die inline definierten `.9s`-Positionsübergänge des Zeigers werden dadurch nicht abgeschaltet. Eine erfolgreiche axe- oder echte Screenreader-Abnahme lässt sich aus diesen Mechanismen nicht ableiten.

## 6. UI-Lücken gegenüber den gefragten Arbeitsabläufen

| Bereich | Im Snapshot belegbar | Fehlender benutzbarer Gesamtweg |
|---|---|---|
| Bestellvorschlag | WARE-Demokarte mit Menge, Wirkungstext und Genehmigen; `t1-arbeitsprofil-v3.html:174-186,384-385`. | Kein Bestellvorschlag mit Lieferant, Positionen, Preis-/Mengenquelle, Bedarf/Bestand, Version, editierbarem Entwurf und getrennter Freigabe/Bestellübermittlung. Die Stepper-Vorschau wird nicht mit dem konstanten Quittungstext verbunden. |
| Freigabekette | Einzelentscheidung und T2-Sammelgenehmigung; `t2-nachtwache-v3.html:279-323`. | Keine Kettenstufen, Betrags-/Rollenregeln, Stellvertretung, Selbstfreigabesperre, Eskalation, revisionsgebundene Zustimmung oder Konfliktanzeige. Sammelgenehmigung ist keine mehrstufige Autorisierung. |
| Anlagen / Beleganhänge | Der Quellen-Drawer ist konzipiert (`konzept/OVERLAY-ENTSCHEIDUNG.md:18-20`), der tatsächlich gebaute Drawer zeigt Chronik (`proto.js:380-387`). | Kein Anhangsinventar, Upload-/Prüfstatus, sicherer Viewer, Version, Belegzuordnung, Rechte oder Lösch-/Entknüpfungsbestätigung. Falls mit „Anlagen“ Anlagevermögen gemeint ist: Auch Anlagegut, Aktivierung und Abschreibung sind hier nicht implementiert; das ist vom Beleganhang fachlich zu trennen. |
| Buchhaltung | Betragsdemo und Starter-Manifest (`proto.js:212-222`; `beispiele/pan528.manifest.json:14-18`). | Keine Kontierung mit Konten/Steuer-/Kostenstellenbezug, Buchungsvorschau, Buchungsfreigabe, Journal-ID, führender Buchungsreadback oder fachliches Storno. Ein Starter-Reset ersetzt das nicht. |
| Rollen | Personen- und Agenten-Selects (`proto.js:439-449`). | Kein Login, hostseitig abgeleitete Fähigkeiten, autorisierte Vertretung, Rechteentzug oder verständlicher Verweigerungszustand. Onboarding verwendet dieselben Schritte für alle Personen (`proto.js:353-363`). |
| Parallele Sessions | Ein gemeinsamer Brokerlauf, ein globales Elementinventar und LocalStorage pro Browserorigin (`mock-broker.mjs:79-90,172-218`; `werkbank-server.py:49,99`; `proto.js:29-35`). | Keine isolierten Arbeitsaufträge, Revisionskonflikte, Tab-Abstimmung, Änderungswarnung oder gesicherte Zuordnung einer Quittung zum auslösenden Fenster. Verschiedene Personen im selben UI sind kein Zwei-Client-Test. |
| Mobil | Frühere Breakpoints, später Desktop-Mindestbreite (`konzept/prototyp/index.html:80-83,114-116`). | Kein nutzbarer schmaler End-to-End-Pfad, keine vollständige mobile Quittung-/Assistenzalternative und keine belastbare Touch-/Reflow-Abnahme. |

Die V3-Templates kennzeichnen sich im Footer als visuelle Demo (`t1-arbeitsprofil-v3.html:230`; `t2-nachtwache-v3.html:239`; `t3-redaktionell-v3.html:245`). Ihre sichtbaren Genehmigungen sind deshalb nicht als vorhandene produktive Fachfunktionen gewertet.

