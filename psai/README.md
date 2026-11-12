# PsAI UX-Werkstatt (PanSphaira) — Setup & Workflow

## Was hier liegt
- `katalog/` — UI-Designkatalog: `index.html` (Regelwerk + Token-Vergleich) und drei
  Mockup-Templates des Plugin-Workspaces: `t1-arbeitsprofil.html` (Hell, Carbon-Haltung),
  `t2-nachtwache.html` (Dunkel, Fortschreibung von Workspace-v1), `t3-redaktionell.html`
  (Ruhe, Impeccable-Haltung). Alle axe-frei; Screenshots in `katalog/shots/`.
  Aufruf: http://127.0.0.1:8099/psai/katalog/index.html
- `qa/a11y.mjs` — axe-core-Gate: `node a11y.mjs <url> [--wait ms]`, Exit 1 bei Verletzung.

## Skills (Hermes, Qwen-geprüft geladen)
- `enterprise-app-ux` (Projekt-Skill mit `references/`: Prüfkatalog, ARIA-Muster,
  Nielsen-Raster, PsAI-Konventionen) — Routing-Hub für alle PsAI-UI-Arbeit.
- `enterprise-ux/` (Kategorie, vendored): `ui-ux-pro-max` (lokale Design-Intelligence,
  Suchtool `scripts/search.py`), `web-design-guidelines` (Review-Checkliste),
  `shadcn` (Referenz, nur bei React-Projekten relevant), `playwright-cli` (Browser-Automation).
- Bereits vorhanden und wiederverwendet: `impeccable` (Flächenqualität),
  `frontend-motion/*` (Bewegung). Bewusst NICHT installiert: React/Vercel-Deploy-Skills
  (PsAI ist Vanilla-ES-Module), Carbon/React-Aria nur als Verdichtung, keine Dependency.

## Werkzeug-Setup
- `@playwright/cli` in `~/.local` (Wrapper: `~/.local/bin/playwright-cli`), Browser:
  Playwright-Chromium headless — **immer `--browser chromium`** (kein Chrome installiert).
- Repo-Clone: `~/PANSPHAIRA` (main 79df9fd). UX-Änderungen laufen auf Branch
  `ux/psai528-guided-feedback` (lokal, ungepusht; Commit e868c7+).

## Workflow (bewusst am Beispiel pan528 durchgespielt)
1. Bestandssicht: Screenshots + Quellcode → UX-Bewertung nach `heuristics.md`
   (Befundliste mit Schweregrad).
2. Eine gezielte Verbesserung implementieren, API/Funktionalität unverändert.
3. Verifikation: `playwright-cli` (echte Interaktion: Klick → `role=alert`, Titel der
   deaktivierten Knöpfe per `eval`), `a11y.mjs` vorher/nachher, Nachher-Screenshot.
4. Doku + Commit im Repo (Präfix `[E-UX-…]`, Hausstil siehe Skill pansphaira-issues).

## Ergebnis des Probelaufs (2026-11-09)
Befunde: deaktivierte Knöpfe ohne Begründung (H1/H5, Schwere 2); Fehler als grauer
Normalstatus (H1/H9, Schwere 2); fehlende Hover-Affordanz, `cursor:wait` irreführend
(Schwere 1). Verbesserung: Zustandstitel + `aria-disabled` ab Initialzustand,
Fehler auf `role=alert` mit eigenem Ton, Hover/`not-allowed`, Disabled-Contrast .45.
Nachweis: Klick ohne Backend → `role=alert`, Farbe rgb(255,180,172); axe 0 Verletzungen
vorher/nachher; Screenshots `katalog/shots/pan528-*`.

## Katalog V2 (2026-11-09, späte Runde)
Jedes Template hat eine V2 **neben** V1 (`t?-…-v2.html`), Umschalter im Index.
Leitmotiv: statisches Mockup → bedienbar (Genehmigen/Ablehnen mit Quittung+Undo, j/k-Fokus,
g-Chord, ⌘K-Palette in T2, Side-Panel-Push in T1, Wirkungs-Typografie in T3).
Konzept und Abhakliste: `katalog/KONZEPT-V2.md`. Alle vier Seiten axe 0, Interaktion
playwright-verifiziert; Bildabnahme führte zu Push-Panel (T1) und Kontrast-/Grid-Korrekturen (T2).

## Katalog V3 (Ausschöpfungsrunde)
Dritte Stufe je Template (`t?-…-v3.html`), Index dreistufig umschaltbar. Kern: Live-Job
(Verschluss 62→100 % mit Selbstquittung), Filter-Chips mit Zählern, Mengen-Stepper mit
lebendiger Wirksameldung, Leerzustand mit Resümee, Fokusfluss, Statusleben; T1 echter
Hilfedialog, T3 Diff-Tabelle + Entwurf-Speicher. Alles axe 0, Interaktion playwright-geprüft,
Bildabnahme mit Korrekturlauf. Architektur: V2-Kern unangetastet, V3 als eigene Schicht
(build-v3.py/build-v3b.py). Konzept + Abhakliste: katalog/KONZEPT-V3.md.
