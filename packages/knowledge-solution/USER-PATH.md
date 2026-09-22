# KTS-04 Nutzerweg — lokale, ausführbare Bedienung (technische Nutzungsdokumentation)

Dieses Dokument beschreibt den im Repository enthaltenen, lokal startbaren
Nutzerweg der Wissensbibliothek (Paket `packages/knowledge-solution`).
Für diesen lokalen Weg mit synthetischen Testdaten gilt:

- Der **produktive CLI-Pfad** holt echte Nutzerentscheidungen ein:
  geschlossene Zielauswahl, sichtbarer Vorschlag, Rückfragen mit
  geschlossenen Optionen, getrennte ausdrückliche Freigaben für
  Mapping und Ausführung.
- **EOF, fehlende Antwort oder Ablehnung erzeugen keine
  Ausführungsreceipt** (Exit 3/4).
- `--demo` ist ein **expliziter, deterministischer Demo-Modus** (feste
  Antwortpolitik, feste Uhr) und ersetzt keine Nutzerentscheidung.
- Batchmodus (`--answers <file>`) akzeptiert nur **ausdrücklich
  übergebene, auf den angezeigten Vorschlag gebundene** Entscheidungen
  (questionId + geschlossene Option; `confirmMapping`/`confirmExecution`
  als Boolesche Werte).

## Voraussetzungen

- Node.js (>= 22), `npm ci` im Repository-Root.
- PostgreSQL: der Weg startet selbst eine ECHTE lokale Instanz
  (`embedded-postgres`) im isolierten Verzeichnis `.kts-pg-data/`
  (fiktive Daten, lesender Rollenbenutzer `kts_ro`); wird residualfrei
  entfernt.

## Aufbau

    npm run build            # TypeScript -> dist/

## Befehle

### Bibliothek ansehen (vollständig)

    node dist/packages/knowledge-solution/src/cli.js library

Zeigt je Methode: Titel, version, specDigest, Bedeutung, Ausgaben,
benötigte Daten (Felder/Einheiten/Bedeutungen), Voraussetzungen,
Wissensquellen mit Zustand und Zitaten sowie Widersprüche — plus ein
deterministisches Suchbeispiel.

### Interaktiver Nutzerweg (CSV)

    node dist/packages/knowledge-solution/src/cli.js run csv:invoices-eur-cent
    node dist/packages/knowledge-solution/src/cli.js run csv:legacy-erp-de
    node dist/packages/knowledge-solution/src/cli.js run csv:invoices-usd     # Einheitenkonflikt
    node dist/packages/knowledge-solution/src/cli.js run csv:legacy-erp-de --goal margin

Ablauf (alle Entscheidungen sind EINGABEN des Nutzers):

0. **Principal** eigene Kennung eingeben, z. B. `principal:local-reviewer`.
   Format: `^[a-z][a-z-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$`.
   Die Kennung wird nicht erfunden; EOF oder ungültige Eingabe bricht ab.
1. **Ziel** geschlossene Auswahl `1)` Grenzwert-Markierung, `2)` Summe
   berechnen — oder exakter geschlossener Zielfreitext. Unmappbares Ziel:
   Abbruch, keine erfundene Eignung.
2. **Bibliotheksauswahl** wird angezeigt (deterministisch, digest-gebunden,
   echte Laufzeituhr; Wissensgültigkeit wird erneut geprüft).
3. **Mapping-Vorschlag** wird angezeigt (Felder, Einheiten, Bedeutung,
   Anpassungen) — ausdrücklich als Agentenvorschlag, NICHT bestätigt.
4. Jede **Rückfrage** wird mit geschlossenen Optionen angezeigt und nur
   durch Nutzerantwort beantwortet (Nr. oder Wert). EOF bleibt offen
   blockiert.
5. **Getrennte Freigaben**: erst Mapping bestätigen, dann die
   adaptierten Inputs bestätigen. Beide Bestätigungen fehlen oder werden
   abgelehnt => keine Receipt (Exit 3/4).

Synthetischer CLI-Test (keine echte Nutzerfreigabe): Test-Principal,
Ziel 1, Rückfrage kunden_nr Option 1, beide Freigaben ja:

    printf 'principal:synthetic-test\n1\n1\nja\nja\n' | node dist/packages/knowledge-solution/src/cli.js run csv:legacy-erp-de

### Batchmodus mit explizit gebundenen Entscheidungen

Zuerst Ziel, Vorschlag, Rückfragen und adaptierte Inputs interaktiv
prüfen. Die angezeigten `goalDigest`, `proposalDigest`, `inputDigest`
und `qst:...`-IDs müssen zum selben Lauf und dessen Entscheidungen passen.
Das folgende Schema enthält Platzhalter und ist **keine ausführbare Freigabe**:

    {
      "principal": "principal:eigene-kennung",
      "goalDigest": "<Digest des gewählten Ziels>",
      "proposalDigest": "<Digest des angezeigten Vorschlags>",
      "inputDigest": "<Digest der exakten adaptierten Inputs>",
      "answers": { "qst:<id aus Vorschlag>": "<exakte geschlossene Option>" },
      "confirmMapping": true,
      "confirmExecution": true
    }

    node dist/packages/knowledge-solution/src/cli.js run csv:legacy-erp-de --goal margin --answers datei.json

Fehlende/falsche Principal- oder Digest-Bindungen werden abgelehnt;
ein generisches Ja autorisiert keinen anderen Vorschlag. Nicht beantwortete
Fragen bleiben offen; außerhalb der geschlossenen Optionen liegende Antworten
werden ignoriert. Ein leeres JSON-Objekt kann keine Ausführung freigeben.

### PostgreSQL-Nutzerweg (echte lokale Instanz)

    node dist/packages/knowledge-solution/src/cli.js run postgres           # interaktiv
    node dist/packages/knowledge-solution/src/cli.js run postgres --demo    # expliziter Demo-Modus

Der Adapter verbindet einen FRESCHEN lesenden Client selbst
(Ownership-Vertrag, zeitlich begrenzt) oder lehnt sofort ab; ein bereits
verbundener Client bleibt Aufrufer-Besitz. Die serverseitige
`kts_ro`-Rolle verweigert schreibende Queries zusätzlich (42501).

### Demo-Modus (explizit, deterministisch)

    node dist/packages/knowledge-solution/src/cli.js run csv:invoices-eur-cent --demo

Kein Nutzerweg: feste Antwortpolitik und feste Fixture-Uhr (innerhalb
des Gültigkeitsfensters der aktuell beobachteten Corpus-Edition).
Dieser Modus ist als Demo gekennzeichnet und ersetzt keine
Nutzerentscheidung.

## Exit-Codes

| Code | Bedeutung |
|------|-----------|
| 0 | EXECUTED (Receipt mit result) |
| 2 | Usage-Fehler |
| 3 | Abgelehnt vom Nutzer (ablehnen/kontext_nicht_ausfuhrbar) |
| 4 | Blockiert: offene Fragen / EOF vor Entscheidung |
| 5 | DENIED (Konflikt/Selection UNKNOWN/NO_MATCH/STALE/Tamper) |
| 1 | Hardware-/Infrastrukturfehler |

## Garantien (fail-closed)

- Auswahl ist **Absichts-basiert** (geschlossene Absichtstabelle), nicht
  auf Ausgabeform allein; unbekannte/incompatible Ziele => Rückfrage /
  NO_MATCH / UNKNOWN.
- Feldbedeutungen werden gegen **geschlossene fachliche Bedeutungen**
  geprüft; Widersprüche oder Mehrdeutigkeit (mehrere Alias-Kandidaten)
  blockieren bis zur ausdrücklichen Nutzerwahl/Bestätigung.
- Einheiten nur aus der **geschlossenen Unit-Tabelle** der Spec
  (EUR/Cent); Fremdwährung (USD) = permanenter Konflikt, kein Kurs.
- **Wissensgültigkeit** wird mit der echten Laufzeituhr erneut geprüft,
  spätestens bei Auswahl/Ausführung; abgelaufene Beobachtung =>
  UNKNOWN, keine SELECTED/Receipt.
- Manipulierte Kontexte (Digest-Drift), Specs oder Quellen => DENIED.
- PostgreSQL-Connector: erlaubte SELECTs nur (Allowlist); DML/Injection
  wird vor dem Server abgewiesen; serverseitige Rechte verweigern
  Schreibzugriffe zusätzlich.
