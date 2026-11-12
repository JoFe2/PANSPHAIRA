# Review-Runde mit dem Gaming-PC-Agenten (A2A) — Protokoll

Runde 1 (Dossier + Fragen) → Runde 2 (Gegenreden) → Runde 3 (Schlussrunde).
Kontext `macbook-projects`, Aufgabe `task-f42b5e206b714f1a`. Prüfumfang des PC-Agenten transparent:
Endpunkte erreicht, Prototyp im Browser geöffnet, aber Code/Tests nicht unabhängig geprüft.

## Endurteil (wörtlich)
„Konzeptionell tragfähiges Fundament mit klaren Abnahmegrenzen — keine unabhängig geprüfte
Implementierungsfreigabe.“ Risiken: (1) Wirkungsintegrität unter Antwortverlust/Parallelzugriff,
(2) Adapter-/Host-Beweislücke und offener Reflow (WP-R1).

## Einvernehmen aus der Runde
1. **Aktionsvertrag** (4 getrennte Teile statt eines Feldsatzes): Auftrag (contract_version,
   action_type, target_id, expected_revision, Idempotenzschlüssel, typisierter Payload) ·
   Host-Kontext (authentifizierter Akteur, Mandant, Delegationsrefernwird nicht vom Client übernommen) ·
   Quittung (operation_id, Status, revision_before/after, Wirkungsbeleg-id, Konfliktcode) ·
   Undo-Beschreibung (Klasse, Gegenaktion, Frist).
   Prüfregeln: Revision **vor** Wirkung atomar (HTTP If-Match/starker ETag, RFC 9110);
   Idempotenz im Host mit Geltungsbereich/Aufbewahrung; Antwortverlust = „Ausgang unbekannt“,
   nie „fehlgeschlagen“; Undo revisionsgebunden; Konflikt-Politik vorerst nur
   „ablehnen + aktuellen Stand anbieten“.
2. **Undo in drei Klassen**: rückgängig-vor-Ausführung / echter Rückbau / fachliche Gegenbuchung.
   Mock verspricht bei „freigabe“ derzeit zu viel (irreversibel am echten Host).
3. **Zweitmodul Urlaubsantrag** als Generik-Test: andere Autoritäts-/Lebenszyklusregeln statt
   anderem Layout — Selbstfreigabe verweigern, Delegation mitten im Lauf, Parallelkonflikt,
   Widerruf als eigene Fachaktion.
4. **Zwei Abnahmen trennen**: Vertragsabnahme am Adapter genügt zum Andocken des Zweitmoduls;
   Lieferabnahme nur am echten Fachhost. Adapterbeweise nie als Hostbeweise verkaufen.
5. **Teststrategie**: weniger Erfolgsweg-Wiederholung, mehr Fehlerfälle (Antwortverlust mit
   Wirkung, veralteter Readback, Zwei-Client-Konflikt, Reload während Aktion, Delegationsablauf,
   unzulässiges Manifest, fehlgeschlagenes Undo).

## In der Runde bereits umgesetzt (Mac-Seite)
- Shell-Overflow bei 780px reproduziert und behoben (min-width 1024, nichts läuft mehr über den
  Dokumentrand; 780/1024/1440 gemessen, Drawer-Suite 18/18).
- Chronik-Drawer: Hintergrund `inert` (volle Modalitäts-Semantik; Initialfokus/Fokuszyklus/
  Rückkehr zum Auslöser waren vorher schon erfüllt).

## Vereinbarte Korrekturarbeiten (nicht vergessen, nicht erfüllt)
- **WP-R1 Reflow**: min-width:1024 ist Einschränkung, kein WCAG 1.4.10-Reflow. Ziel 320px:
  Shell/Formulare/Dialoge umbrechbar, Tabellen/Vergleichsflächen gezielt horizontal scrollbar.
- **WP-REV**: Revisionsbindung vor Wirkung + Idempotenz + Antwortverlust-Abfrage wie oben.
- **WP-ERROR-MIX**: die sieben Fehlerfallszenarien als neue Suite.
- Sicherheit: Delegation/Agentenstufe hostseitig erzwingen (derzeit UI-Zustand);
  OWASP-Partnermuster für echten Host.

## Abweichende Töne, beigelegt
- Ich hatte Revisionsbindung initially als „praktisch schon drin“ vertreten — der PC-Agent
  distintozierte zu Recht zwischen Beleglesung und atomarer Vor-Prüfung; Einvernehmen: WP-REV.
- Reihenfolge: PC-Agent gegen starre Kette — Zweitmodul und Hostintegration parallel nach der
  Fehlerliste; übernehme ich so.
- VoiceOver: einvernehmlich — AX-Narration bleibt als Ersatzprüfung ausgewiesen, nicht als Hörtest.
