# HILFE & ONBOARDING (AP-E4.1)

## Kontexthilfe (?)
Druckbares `?` öffnet Überblender mit: allen Kürzeln dieser Zone, allen Optionen dieser Zone,
Grenzen der Zone (z.B. „Nur-lesen-Fachschicht“). Kein globales Handbuch-Nötigungsfenster.

## Geführter Erststart (je Rolle, ≤3 Minuten)
- **Admin:** 1) Workspace-Profil wählen 2) Zone ausblenden + rückgängig machen 3) Warum-so öffnen.
- **Sachbearbeitung:** 1) Rechnung öffnen 2) „Prüfung vorbereiten“ inkl. Quittung + Undo 3) Chronik ansehen.
- **Prüfer:** 1) Perspektive Wechsel (Liste↔Vergleich) 2) Rohlog einer Quittung öffnen 3) Drawer schließen per Esc.
Nach jedem Schritt: ein Satz, eine Taste. Abbruch jederzeit, Wiedervorlage über ?→Erststart.

## Tooltip-Grenzen
Tooltips erklären nur: Grenzen („nur lesen“), Sperrgründe („gesperrt durch unternehmen“),
Kostenfolge einer Aktion („sendet an Fachschicht“). Nie: ganze Sätze Handbuch, nie
reine Wiederholung des sichtbaren Labels. Zeile mit Titel-Attribut + aria-describedby.

## Onboarding-Hilfetexte (Screenreader-Test)
Jeder Schritt als fokussierbarer Landmark-Bereich, Text in Lesereihenfolge, Tastatursteuerbar,
Fortschritt als aria-current=step.

M7-Audit-Status: Geführter Erststart ist im Prototyp implementiert (Knopf „Erststart“,
3 Schritte je Rolle, aria-current=step, Abbruch jederzeit, Wiedervorlage) — m7a-tests.mjs.
