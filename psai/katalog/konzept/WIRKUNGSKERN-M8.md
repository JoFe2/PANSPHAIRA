# M8 — Wirkungskern: atomar, quittiert, revisionsgebunden

Abgeleitet aus dem PC-Fremdreview (Runden 1–2, Befunde B05/B06/B10) und dem verbindlichen
Quittungsprinzip des Konzepts (Vorher→Nachher→Undo, Readback vor Grün).

## Grundsatz
Jede fachliche Wirkung läuft über genau einen Kanal. Statuslesen ist nebenwirkungsfrei.
Grün gibt es nur mit Wirkungsbeleg, der sich auf genau diese Operation bezieht.

## Kommando-Kanal (ersetzt klick-/zeitbasierte Seiteneffekte)
`POST /api/kommando` — Anfrage-Body:

| Feld | Pflicht | Zweck |
|---|---|---|
| `operationId` | ja | Client-seitig erzeugter Idempotenzschlüssel (uuid), einmalig je Wirkung |
| `aktion` | ja | Manifest-Kennung, z.B. `prueflauf.starten` |
| `ziel` | ja | Modul-/Instanz-ID (keine DOM-Selektoren, keine Textsubstrings) |
| `erwarteteRevision` | ja | Revision, auf der der Auftrag gebaut wurde; Abweichung ⇒ KONFLIKT, keine Wirkung |
| `nutzer` | ja | Akteur aus Host-Sicht (Session, nicht Freitext aus dem Blatt) |

Antwort (Quittung, HTTP 200 nur bei Tragfähigkeit):
`{ operationId, status: WIRKSAM|WIEDERHOLT|KONFLIKT|ABGELEHNT, revisionVor, revisionNach, wirkungsBeleg, vorher, nachher, gegenAktion }`

- **Idempotenzregister:** dauerhaft (JSONL), geprägt `(operationId → payloadHash, quittung)`.
  Gleiche Operation + gleicher Payload ⇒ identische Quittung (`WIEDERHOLT`), keine zweite Wirkung.
  Gleiche Operation + anderer Payload ⇒ `ABGELEHNT` (Payload-Bindung).
- **Revision:** jede Wirkung erhöht eine führende `revision` im Ledger; Aufträge tragen die
  erwartete Revision; Konkurrenz zweier Clients ⇒ der Verlierer bekommt `KONFLIKT` mit Fremdquittung.
- **Vorher/Nachher:** werden VOR der Änderung protokolliert (echter Vorher-Zustand), nicht rekonstruiert.

## Antwortverlust = unbekannt, nicht Fehler
`GET /api/wirkung/{operationId}` liefert die Quittung nachträglich; solange unklar, gilt im UI
„Wirkung unbestätigt“ (gelb), nie grün.

## Abort, Reset, Undo — drei verschiedene Dinge
- `POST /api/abbruch {operationId}`: nur wirksam gegen die AKTIVE Operation, vor dem Wirkungspunkt;
  Quittung `ABGEBROCHEN|ZU_SPÄT`. Fremde/abgeschlossene `operationId` ⇒ `ABGELEHNT`, bricht nichts ab.
- Kontroll-Reset (`/api/evreset`): demontiert Laufmetadaten, niemals als fachliches Undo verkauft.
- Undo ist aktionsspezifisch und kategorisiert: `abbruch` (vor Wirkung), `rückbau` (Zustand vorher),
  `gegenbuchung` (neue Wirkung mit Referenz). Das Manifest erklärt je Aktion, welche Kategorie existiert.

## Readback
`GET /api/readback/{operationId}` referenziert `revisionNach` und den führenden Speichersatz.
Zwei getrennte Werte: erwarteter Geschäftswert (aus Auftrag) und beobachteter Wert (aus Specher).
Identität beider ist die Bedingung für Grün; Abweichung ⇒ gelb mit Differenz.

## UI-Verträge
- Keine Mutation in GET-Handlern (Tick-Steuerung, Trendpause, Fortschreibung werden POST).
- Quittungsfeld zeigt `vorher → nachher` + Revisionspaar + Frist; Fristablauf entfernt das Undo-Angebot.
- Tretspur schreibt der HOST: Akteur, Mandant, Session, `operationId`, Revision — Clientfelder
  können nichts überschreiben (serverbestimmte Provenienz).

## Abnahme (muss fallen können)
1. Retry nach Antwortverlust: identische `operationId`+Payload ⇒ `WIEDERHOLT`, Zähler bleibt gleich.
2. Gleicher Schlüssel, anderer Payload ⇒ `ABGELEHNT`, keine Wirkung.
3. Zwei Clients, eine erwartete Revision: einer `WIRKSAM`, einer `KONFLIKT`, keine Mischwirkung.
4. Fremder Abbruch gegen aktive und gegen fremde Operation: nur die aktive wird abgebrochen.
5. Reset während laufender Operation: Wirkung bleibt belegbar, Metadaten neu.
6. `GET /api/status` 100× ⇒ Zähler unverändert (nebenwirkungsfrei).
7. Readback nach Fremdänderung: grün verweigert, Differenz sichtbar.
8. Undo-Kategorie je Manifest prüfen: Rückbau stellt exakten Vorher-Zustand her; Gegenbuchung
   referenziert Original; fehlende Kategorie ⇒ kein Undo-Knopf.

## Migration
Broker: `/guided/command` wird Adapter auf `/api/kommando`; `/mock/*` bleiben Entwicklungsschalter
mit eigenem, unkritischen Pfad. Matte: m123/epic auf Kommando-Kanal umstellen, Negativfälle 1–8
als neue Suite `m8-tests.mjs`; alte konstante Erfolgsassertionen ersetzen.

## AT-Abgleich (Runde-3-Abnahmetests des Fremdreviews, Commit ebf5d29)
Die ATs sind als Zielbild protokolliert; ihre volle Breite (Crash-/Restartmatrix,
Commit-Barriers, zwei Prozesse, Reconciler, "unabhängiger Fachhost") ist Production-Abnahme
und hier bewusst DEMO-STUFE: NACHSTELLUNG. Grund: der Mock-Broker spielt selbst den Fachhost —
"Grün nur gegen unabhängigen Host" setzt zwei Systeme voraus, die es noch nicht gibt.

Demostufe von `m8-tests.mjs` (muss fallen können, negative zuerst):
1. Retry mit gleicher Operation+Payload ⇒ `WIEDERHOLT`, identische Quittung, Wirkung ≤ 1.
2. Gleiche Operation, anderer Payload ⇒ `ABGELEHNT`, Speicher unverändert.
3. Zwei Aufträge, eine erwartete Revision ⇒ einer `WIRKSAM`, einer `KONFLIKT`.
4. Fremder Abbruch ⇒ `ABGELEHNT`; Abbruch der aktiven Operation vor Wirkung ⇒ `ABGEBROCHEN`.
5. 100× Status-GET ⇒ Zähler unverändert.
6. Antwort simuliert verloren ⇒ Zustand `unbestätigt` (gelb), erst Readback klärt; kein stilles Nochmal.
7. Rückbau stellt Vorher-Zustand her; Gegenbuchung referenziert Original; ohne Manifest-Kategorie
   kein Undo-Knopf.

Production-Stufe (bewusst zurückgestellt, wenn es einen echten Fachhost gibt):
Fehlerpunkt-Matrix an Commit-Grenzen, Neustart/Wiederanlauf aus Journal, Rechte-Matrix gegen
echte Sessions/Mandanten, Unabhängigkeitsnachweis, Undo-Races in der Breite.
