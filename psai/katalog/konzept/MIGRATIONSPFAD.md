# MIGRATIONSPFAD (AP-F3.1 + AP-F4.1 Risiken)

## Drei Schritte mit messbaren Meilensteinen
**Schritt 1 — Layout-Festlegung (Profil-scharf)**
Deskriptoren für P1–P5 als version:1, Shell nach SHELL-BESCHREIBUNG.
Meilenstein: jede P-Seite rendert aus ihrem Deskriptor (kein harter Markup-Zweig mehr).

**Schritt 2 — Modulmanifeste**
pan528 nach Manifest (beispiele/pan528.manifest.json) + Slot-Registry + Adapter.
Meilenstein: Modul ab-/anmelden ohne Quelltextänderung der Shell; Quittung zeigt Vorher/Nachher.

**Schritt 3 — person-Scope**
Freigabe-Matrix Stufe 2 aktivieren; localStorage-Persistenz je Person.
Meilenstein: zwei Personen, derselbe Mandant, unterschiedliche Zonen-Reihenfolge, keine Kollision.

## Risiken & Gegenmaßnahmen (AP-F4.1)
| Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|
| Überkonfiguration | Nutzer verliert Kernpfad | Freigabe-Matrix stuft frei; Primärpfad bleibt gesetzt |
| Performance (viele Knoten-Optionen) | langsame Auflösung | Auflösung einmal pro Render, Cache keyed nach Knotenpfad |
| Testbarkeit kombinierter Zustände | Test explosion | Musterkombinationen statt Vollmatrix (TESTMATRIX Epic G) |
| A11y bei Nutzer-Layouts | Fokus-/Kontrastbrüche | axe als Auslieferkriterium je Theme-Zonen-Kombination |
| Template-Konflikte unsichtbar | Misstrauen | Warum-so-Ansicht ab Minute 1 (Schema-Feld warumSo) |
| Agent greift ungefragt ein | Akzeptanzverlust | Abstufung 0–3 (AGENTEN-ASSISTENZ), Default Stufe 1 |
