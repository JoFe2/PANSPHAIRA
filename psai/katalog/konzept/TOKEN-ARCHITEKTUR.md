# TOKEN-ARCHITEKTUR (AP-C1.1)

Drei Ebenen, Vererbung nur von oben nach unten, semantische Namen zwingend für Bausteine.

## 1. Core (Rohstoffe, keine Bedeutung)
`--ps-gray-0…900`, `--ps-blue-400/600`, `--ps-violet-500`, `--ps-green-400/700`,
`--ps-amber-300/600`, Radien `--ps-r-sm/md/lg` (4/8/12), Raster 4/8/12/16/24.
Regel: Core-Token nennen keine Absicht.

## 2. Semantic (Bedeutung, theme-abhängig aufgelöst)
| Token | Bedeutung | Beispiel Essential | Beispiel Pulse |
|---|---|---|---|
| --ps-bg / --ps-layer / --ps-layer2 | Flächen 3-stufig | #f5f6f8/#fff/#eef0f4 | #0a0f1a/#0f1826/#131f30 |
| --ps-line | Grenze | #d7dbe2 | #1e293b |
| --ps-text / --ps-text2 | Primär/sekundär | #1c2330/#566172 | #e5e7eb/#94a3b8 |
| --ps-btn / --ps-blue | Handeln/Aktiv | #2563eb/#2563eb | #2563eb/#4a9eff |
| --ps-oktx | belegt (grün=gewusst) | #0e6027 | #4ade80 |
| --ps-warntx | Aktion fällig | #92620a | #fcd34d |
| --ps-ok/--ps-warn | Rand-/Signalvariante | #16a34a/#b45309 | #22c55e/#fbbf24 |
| --ps-amberbg | Hinweisfläche | #fffbeb | #1c1608 |
| --ps-radius | Runden | 10px | 12px |

## 3. Component (verweist nur auf Semantic)
`--ps-button-bg: var(--ps-btn)`, `--ps-badge-ok-fg: var(--ps-oktx)`,
`--ps-card-bg: var(--ps-layer)`, `--ps-focus-ring: var(--ps-blue)`.
Regel: Komponenten dürfen nie auf Core zeigen.

## Marken-Slots (B4/H3)
`marke.name`, `marke.logo` als Deskriptor-Optionen; Sperre auf Root möglich.
Bestands-Mapping: alle `--ps-*` aus build-profiles.py/T1–T3 sind bereits Semantic;
sie bleiben unverändert gültig (Abwärtskompatibilität).

## Warum-so für Tokens
Auflösung: Kind-Option → Eltern-Optionen → Root-Default → Theme-Template-Default.
Sperre auf einem Vorfahren bricht die Überschreibung mit benannter Meldung.
