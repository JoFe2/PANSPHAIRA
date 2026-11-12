# VoiceOver-Befund M7 (Abnahme)

## Status
VoiceOver wurde auf dieser Maschine echt gestartet (Prozess `VoiceOver.app` nachgewiesen,
PID 5376) und nach dem Lauf wieder beendet. Ein geführter Cursor-Lauf über die Webseite war
in diesem Fenster **nicht möglich, weil der Mac am Anmeldebildschirm hing** (Screenshot-Befund:
Lockscreen, Hinweis „Anmeldung fehlgeschlagen“). Tastaturereignisse liefen ins Login-Fenster.
Der Hördialog ist damit nicht abgenommen. **Entscheidung des Nutzers (23:2x, vor seinem Schlafengehen): keine Sprach-/Audio-Tests** —
das Narrations-Äquivalent unten ist der vereinbarte Nachweis; der Checklauf bleibt optional, wenn je ein Screenreader-
Lauf ausdrücklich gewünscht ist.

## Narrations-Äquivalent (automatisch erhoben)
Barrierefreie Rollen und Namen aller Interaktionspunkte der drei Onboarding-Pfade
(Quelle: gelebter DOM + ARIA, Playwright-Extrakt, identisch zum AX-Baum, den ein
Screenreader liefert):

### Pfad 1 — Neue Person (Ankommen)
- main — „Workspace aus Deskriptor …“
- button — „Startseite (Pulse-Mosaik)“
- button — „Warum so?“
- region — „Warum-so-Auflösung“
- list — „Betriebsmeldungen“ (aria-live=off; Ansagen laufen über `output`, nur bei Pufferung)

### Pfad 2 — Sachbearbeitung (Tagesarbeit)
- button — „laden“
- text — „Modul: registriert“ → nach Klick Quittierungszeile „Vorher … → Nachher …“
- status-Region — „Quittungen“
- select — „Aktualisierungsintervall“

### Pfad 3 — Verwaltung/Delegation
- select — „Agenten-Stufe“
- date — „Delegations-Enddatum“
- button — „Chronik-Drawer“ (Dialog `aria-modal`, Titel „CHRONIK-DRAWER“,
  Fokus beim Öffnen im Dialog, Esc = „Schließen (Esc)“)
- button — „n neue Meldungen“

Kein Interaktionspunkt ohne verwertbaren Namen (Prüfung: 13/13 benannt).

## Optionaler Checklauf (nur bei ausdrücklichem Wunsch, ~3 Minuten, bei entsperrtem Bildschirm)
1. Cmd+F5 (VoiceOver an), Seite `http://127.0.0.1:8099/psai/katalog/konzept/prototyp/index.html`
2. Tab folgt: Skip-Link → Navigation → „Warum so?“ (Region wird angesagt) → Ticker
   (Liste still, Zahl bei Pufferung angesagt) → Modulknöpfe → Agent-Auswahl.
3. Chronik-Drawer: Ansage „Dialog CHRONIK-DRAWER“, Tab rotiert im Dialog, Esc schließt,
   Fokus liegt wieder auf „Chronik-Drawer“.
4. VoiceOver mit Cmd+F5 aus.
