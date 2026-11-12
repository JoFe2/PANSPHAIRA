# SLOT-KATALOG (AP-D2.1)

| Slot | Zweck | Mindestgröße | Priorität (Laden) | Lifecycle | A11y-Erwartung |
|---|---|---|---|---|---|
| nav | Navigationsziel in Seitenleiste | 40px Zeile | sofort (Skelett ok) | registriert→geladen bis App-Leben | aria-current auf aktivem Eintrag |
| home-kachel | Einstieg/Status auf Startseite | 148×96 | sofort, Inhalt nachladen | Kachel bleibt, Inhalt austauschbar | Zielname lesbar, Status doppelt codiert |
| detail-panel | Fachinhalt in Zone Fachdaten | 320×240 | sofort, Spinner ≤300ms |reloadfähig, Zustand wiederherstellbar | Überschrift=h2, Landmark region |
| overlay-inhalt | Inhalt für Drawer/Modal | 480×320 | bei Öffnung | entsteht/vergeht mit Overlay | Fokus-Fang, Esc, Titelzone |
| statusleiste | Aggregat/Viewlet unten | 200×28 | verzögert erlaubt | persistiert über Bereiche | aria-live nur bei Quittung |
| chronik | Verlaufs-Eintrag | 1 Zeile | nachrangig | append-only | Zeitstempel lesbar, Link zum Rohdatensatz |

## Lifecycle-Phasen (alle Slots)
`registriert` (Manifest bekannt) → `geladen` (Quelle einmal bestätigt) → `aktualisiert`
(Change/Intervall) → `entfernt` (Platz wird eingeräumt, Quittung in Chronik).
Sichtbarkeit steuert der Deskriptor-Knoten (`optionen`), nie das Modul selbst.

## pan528-Zuordnung (Test AP-D2.1)
nav → „Rechnungen“ (nav-Eintrag vorhanden) · home-kachel → „Eingangsrechnungsprüfung“
· detail-panel → Prüf-/Belegkarten · overlay-inhalt → „Quellen zum Beleg“ (Drawer, vgl.
OVERLAY-ENTSCHEIDUNG Fall 2) · statusleiste → Prüfstand-Status · chronik → Prüfschritte.
