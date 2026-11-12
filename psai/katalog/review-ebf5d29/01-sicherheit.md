# Runde 3 — Sicherheitsdelta

HEAD `ebf5d299bccfc0d3cf79521519e03e7ea498e3f7`, Basis `1dea6ed8a91096a023d4145b0d9f13255487fbdf`. Sourcepfade relativ zu `psai/katalog/`, Zeilen dieses HEAD. Eigene Quellprüfung und isolierte synthetische Funktionsproben, kein HTTP-/Browser-/Fachhostlauf.

## Lageänderung, keine Sicherheitsfreigabe

Die unmittelbare Ereignisgruppenheader-HTML-Senke ist korrigiert, die Ablaufgrenze schließt Gleichstand und nichtnumerische Werte aus, und die Spurantwortauswahl ist begrenzt. **Sicherheit bleibt ROT**: B02/B03/B07 jeweils nur teils, B01 ebenfalls unvollständig. Ausführliche unveränderte Grenzen zu Bootstrap, Cookies, Rollen, Auslieferung, Numeric-SVG, Audit und SSE: [Runde 2 Sicherheit](../review-1dea6ed/01-sicherheit.md); vollständige aktuelle Einzelzustände: `00-nachpruefung.md`.

## 1. Gruppenheader B03: konkrete Kette unterbrochen

`mattekiste/mock-broker.mjs:151-157` nimmt weiterhin unautorisierte Ereignisse an; `140-148` liefert sie zurück. Aber `konzept/prototyp/proto.js:148` ruft jetzt auch im Gruppenheader `esc(e.gruppe)` auf. Die drei geprüften Textstellen — Gruppenheader, Gruppenname in Ereigniszeile, Ereignistext — enthalten bei einem inerten Tagpayload jeweils kodierte Zeichen vor der Zuweisung an `innerHTML` (`151`).

Eigene aus Basis/HEAD extrahierte Probe mit einem Ereignis, reinem String-Sink und `<probe-b03 data-x="a&b">` als Gruppe/Text:

| Zustand | Rohes Probe-Tag im Gesamtstring | Kodierte Probe-Taganfänge |
|---|---|---|
| Basis | ja, im Gruppenheader | 2 |
| HEAD | nein | 3 |

Das schließt die konkrete Runde-2-Hauptkette; keine Eventhandler wurden ausgeführt. Nicht geschlossen: Vorlagenkennung (`proto.js:258`), Navigation/Selektor (`317-318,475`), Personenwerte (`78,362`), Rohlog (`225-226`), Numeric-SVG/Tabellenwerte (`177-191`) und T1/T3-Gründe (`t1-arbeitsprofil-v3.html:290-299`; `t3-redaktionell-v3.html:277-284,373-380`). Diese Zeilen wurden selbst gelesen. Keine zusätzliche gegenwärtige Netz-Stringquelle für die numerischen Mock-Trendwerte behauptet.

## 2. B02: fail-closed für Vergleichsfehler, nicht für alle Sessiondaten

Aktuell `mattekiste/mock-broker.mjs:95`: `const ab = Number(row.expiresAtMs); if (!(ab > Date.now())) ...`.

Die exklusive Vergleichslogik ist verbessert. Aber `Number` ist eine Konversion, keine Typ-/Endlichkeitsprüfung. Der normale Bootstrap erzeugt numerischen Ablauf (`85`); die folgenden abweichenden gespeicherten Daten wurden ausschließlich synthetisch hergestellt.

| Ablauf bei fester Probezeit T | Basis | HEAD |
|---|---|---|
| T−1 numerisch | verweigert | verweigert |
| T numerisch | angenommen | verweigert |
| T+1 numerisch | angenommen | angenommen |
| fehlend, null, leere Zeichenkette, false | verweigert | verweigert |
| `not-a-time` | angenommen | verweigert |
| numerisches NaN | verweigert | verweigert |
| leeres Objekt | angenommen | verweigert |
| zukünftiger numerischer String | angenommen | angenommen |
| Array mit genau einer zukünftigen Zahl | angenommen | angenommen |
| positives Infinity als VM-Zahl | angenommen | angenommen |
| String `Infinity` | angenommen | angenommen |
| String `1e309` | angenommen | angenommen |

NaN als Zahl/Infinity als Zahl sind keine JSON-Literale; ihre VM-Fälle dienen nur der Funktionsgrenze. Strings/Arrays und das Objekt sind hingegen JSON-darstellbare Datensatzformen. Insbesondere die beiden unendlichen Strings sind ein verbleibender fail-closed-Defekt, nicht erst durch dieses Delta eingeführt.

HEAD-Zusatzproben mit gültiger synthetischer Session: korrekt geformtes falsches Token und zu kurzes Token → `HOSTED_CSRF_DENIED`; keine Session → `HOSTED_SESSION_DENIED`. Ein korrektes synthetisches Token mit zukünftigem numerischem Ablauf wird angenommen. Der HMAC-Vergleich an `96` ist erhalten.

Rest: `typeof expiresAtMs === "number"` plus Endlichkeit und definierte Zeitsemantik vor Zulassung; Identität/Aktions-/Mandantenrecht; Frist/Entzug am verbindlichen Wirkungspunkt. Gate und Ledger werden weiterhin vor unbegrenztem Bodylesen festgelegt (`79,90-96,192-202`); keine spätere erneute Prüfung. Sessionretention fehlt (`82-96`). Kein vom Remoteclient unmittelbar setzbares Ablaufdatum und kein universeller Browserbypass nachgewiesen.

## 3. B07: `seit` begrenzt Auswahl, nicht Dateieingang

`mattekiste/mock-broker.mjs:118` verwendet jetzt `Math.min(500, Math.max(1, Number(...) || 200))`. Eigene isolierte Routensourceprobe: 750 synthetische gültige JSONL-Zeilen aus RAM, keine Dateiabfrage.

| Eingabe `seit` | Basis: gelieferte Zeilen | HEAD: gelieferte Zeilen |
|---|---|---|
| fehlt | 200 | 200 |
| 0 | 750 | 200 |
| nichtnumerisch | 750 | 200 |
| 1 | 1 | 1 |
| −3 | 747 | 1 |
| 500 | 500 | 500 |
| 501 | 501 | 500 |
| 1.9 | 1 | 1 |
| 0.5 | 750 | 1 |
| Infinity | 750 | 500 |
| −Infinity | 0 | 1 |
| 1e309 | 750 | 500 |

Alle HEAD-Ergebnisse lagen für diese ausreichend lange gültige Liste zwischen 1 und 500; jeweils die letzten Zeilen. Bei leerer/kürzerer Datei kann die Trefferzahl kleiner sein. 0 bedeutet durch `|| 200` Default, nicht Klemmung auf 1; Brüche werden beim Slice ganzzahlig verkürzt. Eine strikte Eingabeverweigerung wird nicht implementiert und hier nicht als bereits vereinbarter 400-Vertrag erfunden.

**Keine vollständige Ressourcenkorrektur:** In jedem Probenfall wurde unverändert der gesamte RAM-String eingelesen; im Code bleibt vollständiges `readFile(...).trim().split(...)` vor dem Slice. Unbegrenzte Datei, Eingangsbody, Sessions und SSE bleiben offen (`mock-broker.mjs:32-35,61,82-87,106-109,124-127,192-195`; `live/werkbank-server.py:54-78,93-101`). Ausgabeobergrenze ist nicht Eingangsspeicherobergrenze. Parsing-/Lesefehler werden weiterhin als leere Spurliste ausgegeben (`118`), kein bestätigter leerer Datenstand.

## Methode und Regressionseinordnung

Funktionen/Zweige wurden anhand eindeutiger Sourcegrenzen aus Basis und HEAD ausgeschnitten, nicht als komplette Runtime importiert. VM-Kontexte enthielten feste Uhr, synthetische Header/Sessionzeilen, Standard-HMAC nur über synthetisches Material, String-Sink und RAM-`readFile`. Keine echten Sitzungen, Schlüsseldateien, HTTP-Verbindungen, Server oder Datenbestände. Ein erster gemeinsamer Probenlauf scheiterte an einer fehlenden `$$`-Nebenfunktion des Clickhandler-Harness; nach Ergänzung des RAM-Stubs lief der gleiche isolierte Prüfblock mit Exit 0. Das war ein Harnessfehler, kein Produktfehler oder positiver Sicherheitstest.

Keine neue negative Runtime-Regression aus diesem Delta nachgewiesen; verbliebene Typkonversion/Infinity, ungeschützte Quellen und Restsenken sind Alt-/Restfehler. Der neue permissive Datenquellenschemaarm wird separat in `02-technik.md` bewertet. Browser-Exploits, Cookie-/HTTPSverhalten, reale Host-/Dateigrenzen, Last, Crash und LAN wurden nicht abgenommen. Main prüft/publiziert separat.
