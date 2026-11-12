# Runde 3 — UI-Delta und offene Gesamtwege

HEAD `ebf5d299bccfc0d3cf79521519e03e7ea498e3f7`, Basis `1dea6ed8a91096a023d4145b0d9f13255487fbdf`. Sourcepfade relativ zu `psai/katalog/`, Zeilen dieses HEAD. Statisches Lesen und begrenzte isolierte Handler-/Stringproben, keine Browser-/Screenshot-/axe-/Touch-/Screenreaderabnahme.

## 1. Drawer-Close repariert; keine aktuelle Kollision belegt

`konzept/prototyp/proto.js:470` nimmt `#dwZu` nun in den delegierten Selektor auf; der erste Branch an `472` schließt für diese ID oder `data-dw-rueck`. Erzeugung/Fokusziel an `385,407` passen dazu. Die Suche im Katalogcode fand nur einen Erzeuger dieser Close-ID. `bi-glas.js` und `zeiger.js` erzeugen keine zweite `dwZu`-ID.

Eigene Probe mit originalem aus Source extrahiertem Clickhandler, einfacher Selektormatch-Nachbildung und Zählstub für `drawerZu`:

| Synthetisches Ziel | Basis | HEAD |
|---|---|---|
| Nur ID `dwZu` | kein Close | ein Close |
| `data-dw-rueck` | ein Close | ein Close |
| ID `dwZu` plus `data-nav`, `data-mod`, `data-kz` am selben Element | Navigation, kein Close | ein Close, keine nachfolgende Mutation |

Die Close-Bedingung hat also bei gleichzeitigen Branchmarkern Vorrang. Das ist kein Nachweis für beliebige zukünftige DOM-/Mehrinstanzkollisionen und kein realer `Element.closest`-/Event-Bubbling-Lauf. Enter/Space auf dem nativen Button ist durch denselben Clickpfad plausibel angebunden, aber hier nicht im Browser ausgeführt. Escape, Tab-Schleife und Fokusrückkehr wurden statisch erneut gelesen (`390-418,533`), nicht per Accessibilitylauf bestätigt.

Modalitätsrest unverändert: nur erster Header und `.layout` werden inert (`401-416`); separat an `body` hängende Tour (`359-365`), Zeigerbutton (`konzept/prototyp/zeiger.js:207-216`) und äußerer Rahmenbutton (`live/index.html:19-20`) liegen außerhalb. Kein vollständiger mobiler Ersatz für Warum-so/Quittung/Agentensteuerung im Chronikdrawer.

## 2. Trendziel korrigiert, Sichtbarkeit/Instanzen nicht gelöst

`konzept/prototyp/zeiger.js:128` referenziert jetzt `#trendBild`, passend zum Renderer `konzept/prototyp/proto.js:289`. Mapping wurde aus Source ausgewertet und gegen die ID-Erzeugung abgeglichen; `blick` enthält keinen Klick (`zeiger.js:132-141`). Der konkrete alte Zielnamenfehler ist fixed.

Keine pauschale Führungsfreigabe: erste globale ID, keine Sichtbarkeitsprüfung (`134`), BI versteckt andere Modulkindflächen (`konzept/prototyp/bi-glas.js:133-147`); reduzierte Bewegung lässt Positionsübergänge aktiv (`zeiger.js:7-9,22-42,237-240`). Das sind unveränderte Alt-/Generikgrenzen, keine neue Regression.

## 3. Viewport ergänzt, mobile Gesamtbedienung weiter offen

`live/index.html:5` besitzt jetzt `width=device-width,initial-scale=1`. Dieser konkrete Restpunkt ist fixed. Am Composer-CSS ändert der Diff nichts:

- `konzept/prototyp/index.html:114-116`: schmal weiterhin Mindestbreite 1024 px.
- `index.html:80,135-141`: Assistenzpanel verschwindet, einschließlich Quittung und Warum-so; zusätzlich erzeugte Agentensteuerung liegt darin (`proto.js:446-450`).
- `index.html:24,37-40,66,75`: kein durchgängiger Umbruch für alle Kopf-/Zonen-/Perspektivaktionen.

Kein Reflow-/Zoom-/Touch-/Fokusbeleg aus Metatag oder veränderten PNGs abgeleitet. UI/Fachgesamtwege bleiben ROT.

## 4. Quittungsdelta: nicht pauschal „Pause/Sortierung erledigt“

| Aktion im isolierten Originalhandler | Tatsächlicher HEAD-Zustand | Quittung/Chronik |
|---|---|---|
| KPI Pause | pausiert | `läuft → pausiert`, richtig |
| KPI Weiter | läuft | `pausiert → läuft`, richtig |
| Trend Pause | pausiert | `pausiert → läuft`, weiterhin falsch |
| Trend Weiter | läuft | `läuft → pausiert`, weiterhin falsch |
| Gültige Sortierung | getauscht | alte/neue Folge jetzt richtig |
| Erste Zone hoch | unverändert | beide Folgen gleich; trotzdem „höher angeordnet“, Speichern/Log |
| Letzte Zone runter | unverändert | beide Folgen gleich; trotzdem „tiefer angeordnet“, Speichern/Log |

Belege: `proto.js:486-515`. KPI/Gültigtausch sind Teilkorrekturen; Trendpause und Grenz-No-op bestehen bereits in der Basis. Alle Quittungen versprechen weiterhin pauschal „Undo 30s“ (`39-41`), ohne entsprechende Gegenwirkung. In-flight-Antworten werden nach Pause nicht entwertet (`112-132,171-197`).

## 5. Unveränderte Fach-/Undo-Restbedingungen

Für Bestellvorschlag, Freigabeketten, Beleganhänge versus Anlagevermögen, Buchhaltung, Rollen, parallele Sessions und den schmalen Gesamtweg gilt [Runde 2 UI-Lücken](../review-1dea6ed/04-ui-lücken.md) weiter. Aktuelle Einzelbelege und Status jeder Anforderung: `00-nachpruefung.md`, besonders B04–B06, B09–B12 und F03–F18.

T1/T3 feste Undo-ID mit globalem Ersttreffer (`t1-arbeitsprofil-v3.html:267-270`; `t3-redaktionell-v3.html:259-263`), T2 globales `pendingUndo` (`t2-nachtwache-v3.html:266,302-307`) sowie T3-Vollreload und gemeinsamer Entwurfsschlüssel (`263,373-380`) bleiben unverändert. Sie wurden selbst gelesen, hier nicht im Browser reproduziert. Keine neue UI-/Fachfähigkeit aus Dossier-/Screenshot-Erfolgstexten übernommen.

Main prüft unabhängig und veröffentlicht separat; dieser Bericht enthält keine Veröffentlichung oder Gesamtfreigabe.
