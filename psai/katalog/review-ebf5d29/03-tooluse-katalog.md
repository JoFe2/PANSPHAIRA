# Runde 3 — Tool-Use-Katalog: begrenztes Delta

HEAD `ebf5d299bccfc0d3cf79521519e03e7ea498e3f7`, Basis `1dea6ed8a91096a023d4145b0d9f13255487fbdf`. Sourcepfade relativ zu `psai/katalog/`, aktuelle Zeilen. Dieser Nachtrag besteht nur wegen tatsächlicher Änderungen von Shellquittung/Zielreferenz/Close-Weg. Kein neuer Fachaktionskanal.

## Geänderte Iststände

| Katalogaktion | Beleg | Runde-3-Stand / verbleibende Grenze |
|---|---|---|
| Zone umordnen | `konzept/prototyp/proto.js:486-493` | Bei gültigem Tausch echter Vorzustand erfasst und quittiert. Grenz-No-op weiterhin als höher/tiefer angeordnet protokolliert, trotz unveränderter Folge. Kein revisionsgebundener Hostvertrag/Undo. |
| KPI pausieren/fortsetzen | `konzept/prototyp/proto.js:499-504` | Vorher/Nachher korrigiert und in isoliertem Handleraufruf nachvollzogen. Weiter keine definierte Entwertung bereits laufender Antworten; pauschales Undoversprechen (`39-41`). |
| Trend pausieren/fortsetzen | `konzept/prototyp/proto.js:511-515` | Keine Korrektur: Quittung bleibt entgegen dem tatsächlichen Flag vertauscht. Deshalb nicht beide Pausenaktionen gemeinsam als fixed führen. |
| Chronik schließen | `konzept/prototyp/proto.js:385,470-472` | Primärer Close im delegierten Handler, neben Rückkehr und Escape (`388-418,533`). Isolierter Zweig erreicht; keine Browser-/Fokusfreigabe. |
| Trendinhalt vorzeigen | `konzept/prototyp/zeiger.js:128-137`; `konzept/prototyp/proto.js:289` | Ziel nun `#trendBild`. Blick bleibt klickfrei; globale Instanz-/Sichtbarkeitsgrenze unverändert. |
| Hostspuren lesen | `mattekiste/mock-broker.mjs:117-119` | Antwortauswahl begrenzt; vollständiges Dateilesen und unberechtigter Zugriff bleiben. Kein neuer Audit-/Readbackvertrag. |

Die Zeigerführung bleibt Text-/CSS-Ziel plus `el.click()` (`konzept/prototyp/zeiger.js:58-95,166-203`); der Blick ist keine Fachquittung. Schleifenstop bedeutet keine Rücknahme einer erfolgten Fachwirkung. Der neue Datenquellenschemaarm (`konzept/katalog-eintrag.schema.json:120-123`) lädt keinen Adapter und typisiert nicht einmal Arrayelemente.

## Unverändert fortgeschrieben

Der vollständige [Runde-2-Tool-Use-Katalog](../review-1dea6ed/03-tooluse-katalog.md) gilt außerhalb der obigen geänderten Zeilen weiter:

- Gemeinsamer Aktionsvertrag mit Instanz/Ziel, Payload-/Ergebnisschema, Identität/Rechten/Delegation, Revision, Idempotenz, Vorher/Nachher, Undo und führendem operationsgebundenem Readback: weiterhin Empfehlung, kein Iststand.
- Manifestaktionen `RUN_STARTER`, `ABORT_STARTER`, `RESET_STARTER`, `SUGGEST_STARTER`, Status und Readback unverändert (`mattekiste/mock-broker.mjs:172-218`; `konzept/beispiele/pan528.manifest.json:14-18`). B05/B06 offen; isolierte Entscheidungsprobe erneut negativ, nicht echte HTTP-/Fachhostabnahme.
- Weitere Shellaktionen, Registry und vollständige Vorbedingungs-/Rechte-/Readbackverträge unverändert (`konzept/prototyp/proto.js:58-105,263-350,454-530,537-545`).
- Bestellvorschlag/Bearbeitung/Übermittlung, Freigabeketten/Vertretung, Anhänge, Buchung/Storno, Anlagegut/Aktivierung sowie Mail-/Modellgrenze bleiben fehlende empfohlene Fachaktionen, keine hier vorhandenen APIs. Aktuelle Quellenbelege und jede Restbedingung sind in `00-nachpruefung.md` unter F01–F18 und B05/B06/B11 nachgeführt.

Kein Fachgesamtablauf, Upload, Bestellung, Buchung, Versand, Modellaufruf oder fremde Session ausgeführt. Die drei README-Tests sind ausschließlich künftige P1-Abnahmevorschläge, kein Statuswechsel dieser Fähigkeiten.
