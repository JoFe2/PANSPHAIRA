# AGENTEN-ASSISTENZ (AP-E5.1)

## Abstufung der Agentenmacht (je Delegation einstellbar)
| Stufe | Recht | Verhalten |
|---|---|---|
| 0 beobachten | lesen | erklärt Zustände (Warum-so), ändert nichts |
| 1 vorschlagen | lesen + Vorschlagsrecht | zeigt Vorschlag als Karte, Nutzer bestätigt |
| 2 ändern | schreiben | führt Änderungen aus, immer mit Quittung+Undo+Chronik |
| 3 gestalten | vorlagenBinden | wechselt Themes/Struktur, braucht Bestätigungs-Chips |

## Erklärbarkeit (Pflicht)
Jede agentische Änderung erscheint: (a) inline als „geändert durch max (Agent)“ mit
Vorher/Nachher, (b) im Chronik-Eintrag, (c) in Warum-so als Knoten-Eintrag. Kein Unsichtbar-Eingriff.

## Grenzen (Test AP-E5.1)
1. **Nie ungefragt umbauen:** Stufe 2+ darf Layout-Struktur nur mit Stufe 3 ändern.
2. **Nie ohne Ende:** Agenten-Delegation ohne `gueltigBis` ist invalid (Schema erzwingt Feld).
3. **Nie ohne Exit:** Agentensteuerung ist immer sicht- und abschaltbar (Pille im Assistentenpanel).
4. **Nur belegte Daten:** Agent zitiert Quellen wie Quittungen („Quelle: dq.beleg, Stand 10:12“).

## Interaktionsmuster
Vorschlag = Karte im Assistentenpanel mit Buttons {Übernehmen, Nicht jetzt, Nie für diesen Bereich}.
„Nie für diesen Bereich“ schreibt Knoten-Option `agent.vorschlaege=<bereich>:aus`.
Ablehnungen kumulieren nicht als Spam: max 1 Vorschlag/Kontext, dann Pause bis Kontextwechsel.


## M6-Status (Umsetzung im Prototyp)
Stufen 0–3 sind im Composer wählbar, mit Delegations-Enddatum (Pflicht ab Stufe 2).
Stufe 0: alles von Hand · Stufe 1: Vorschläge ohne Ausführung · Stufe 2: ändert person-eigene
Overrides nur bei gültigem Delegat · Stufe 3: wie 2, zusätzlich zoneübergreifende Eingriffe.
Jede Änderung schreibt „geändert durch Agent (Stufe n, Delegat bis TT)” in die Chronik;
nach Ablauf des Enddatums wird verweigert (Quittung „unverändert“). Prüfsuite: m6-tests.mjs.
