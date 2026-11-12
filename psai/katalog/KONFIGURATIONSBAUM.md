# PsAI Desktop-Composer — Konfigurationsbaum & Knotenmodell (Phase A2, konkret)

Dieses Dokument buchstabiert Phase A2 des Konzeptionsplans v3 aus. Es ist der erste konkrete
Entwurf für den Kernmechanismus: einen dynamisch erweiterbaren Konfigurationsbaum mit
delegierbarer Eigentümerschaft und auflösbaren Templates.

## 1. Baumstruktur

Der Workspace wird durch einen einzigen Wurzelknoten beschrieben. Jeder Knoten hat dieselbe
Grundform; Unterschiede entstehen nur durch Belegung der Felder.

```
Knoten {
  id            : string           // eindeutig, z.B. "unternehmen", "domaene.finanzen"
  typ           : enum             // unternehmen | domäne | modul | person | gruppe | agent
  elternId      : string|null      // null nur bei Wurzel
  kinder        : [Knoten]         // rekursiv; pro Mandant unterschiedlich möglich (B5)
  vorlage       : [TemplateRef]    // Referenzen auf Layout-/Design-/Funktions-Templates
  optionen      : { key: Wert }   // Overrides gegenüber Elternknoten
  eigentümer    : Eigentümer       // wer darf ändern (Person/Gruppe/Rolle/Agent)
  delegationen  : [Delegation]     // wer was auf diesem Knoten tun darf
  sperren       : [TokenKey]       // nicht überschreibbar für Kinder (optional, B6)
}
```

**Mandantenfähigkeit:** Die Wurzel kann pro Mandant verschiedene Kinderbäume haben. Ein Kunde
hat z.B. `domaene.finanzen` und `domaene.logistik`, ein anderer nur `domaene.finanzen`.
Das Template-System bleibt identisch; nur die Äste unterscheiden sich.

## 2. Vorlagen (Templates) im Baum

Ein Knoten trägt null bis mehrere `TemplateRef`s. Eine Referenz zeigt auf einen Katalog-Eintrag
(Phase H) und beschreibt eine oder mehrere Schichten:

```
TemplateRef {
  katalogId : string        // z.B. "theme.pulse", "layout.sidebar-content-rail"
  schicht   : enum          // layout | design | funktion
  gewichtung: int           // bei mehreren Refs gleicher Schicht: höhere gewinnt
}
```

Templates sind **keine Kopien**, sondern Verweise. Varianten entstehen durch Optionen am Knoten,
nicht durch neue Template-Dateien (Beschluss B4/H2).

## 3. Options-Overrides

Jeder Knoten darf Optionen setzen, die von den Eltern geerbte Werte überdecken. Beispiele:

```
optionen {
  theme.wahl        : "pulse"              // Theme-Profil dieses Bereichs
  layout.dichte     : "kompakt"            // Abstände/Raster
  overlay.erlaubt   : true                 // Overlay-Nutzung in diesem Bereich gestatten
  live.intervallSek : 10                   // Standard-Aktualisierung für Kinder-Module
  marke.sichtbar    : false                // PanSphaira-Logo hier ausblenden (B4/H3)
}
```

Die Shell rendert zu jedem Knoten automatisch die zugehörigen Optionen als Steuerung
(Phasen D2/E1), sofern der Eigentümer sie freigibt.

## 4. Auflösung: „Warum sieht das so aus?"

Auflösung erfolgt von unten nach oben (Kind → Wurzel). Für jede Eigenschaft gilt:

1. Ist am aktuellen Knoten ein Override gesetzt? → nimm ihn.
2. Sonst: frage Elternknoten, dann Großeltern, bis zur Wurzel.
3. Wenn kein Knoten etwas setzt: Default des Templates.
4. Wenn ein Elternteil `sperren` enthält: Kind darf diesen TokenKey nicht überschreiben.

Die **„Warum-so"-Ansicht** zeigt genau diesen Pfad:

```
Element: Diagramm-Kopfzeile
Farbe surface-header = #0f1826
  ← Knoten "modul.finanzen.report" (Override, Eigentümer: Gruppe Finanzen)
  ← Knoten "domaene.finanzen" (geerbt)
  ← Knoten "unternehmen" (Default aus theme.pulse)
Gesperrt durch: keine Sperre aktiv
Änderbar durch: Eigentümer "modul.finanzen.report" oder delegierte Person/Agent
```

Damit bleibt jede Entscheidung nachvollziehbar — auch wenn Agenten später mitreden (B10).

## 5. Delegation & Eigentümerklassen

Eigentümer ist nicht gleich „Admin". Jeder Knoten definiert, wer was darf:

```
Delegation {
  wer        : { typ: person|gruppe|rolle|agent, id: string }
  rechte     : [lesen|schreiben|vorlagenBinden|sperrenSetzen|delegieren]
  gültigBis  : datetime|null
}
```

- **Administrator:** hat implizit alle Rechte auf allen Knoten, kann aber Rechte per Delegation
  abgeben (z.B. `sperrenSetzen` nur an Compliance-Gruppe).
- **Agenten:** optional eigene Knoten oder nur Empfehlungen auf bestehenden Knoten (Runde 3: konfigurierbar).
  Agentische Änderungen schreiben einen Quittungs-Eintrag und können zurückgenommen werden.

## 6. Startpunkt: Minimaler Arbeitsbaum für PsAI

Als kleiner Startpunkt nehmen wir den Bestand (pan528 + P1–P5-SHELL) und bilden ihn auf einen
minimalen Baum ab. Das ist bewusst wenig, damit wir von dort wachsen können:

```
unternehmen
├── mandant.tenant-a
│   ├── shell                        // Header, Nav, Footer, Assistent (aus P-Seiten extrahiert)
│   │   └── options: theme.wahl="essential-2d", marke.sichtbar=true
│   ├── bereich.rechnungen           // pan528-Fachdaten
│   │   ├── template: layout.split-detail
│   │   ├── template: theme.essential-2d
│   │   └── module.pan528-prüfkarte  // Kachel + Detailkarte
│   └── bereich.startseite           // Home/Startbereich
│       ├── template: layout.kachel-grid
│       └── template: theme.pulse    // futuristischer Rahmen, Mosaik zu Rechnungen (B7)
```

Dieser Baum liefert sofort zwei Dinge:
- Er zeigt das Design-Mosaik (Startseite Pulse, Rechnungen Essential) als Normalfall.
- Er macht pan528 zum ersten Modul mit Manifest und Slot-Bindung (Phase D).

## 7. Erste Live-Komponenten-Kandidaten (B9, Frage „was zuerst?")

Aus dem Bestand und typischen Enterprise-Dashboards lassen sich vier wiederverwendbare
Live-Bausteine ableiten. Sie decken die häufigsten Anwendungsfälle ab und lassen sich später
durch Optionen erweitern:

| Baustein | Zweck | Datenform | Typische Intervalle | Wiederverwendung |
|---|---|---|---|---|
| **Kennzahl-Kachel** | einzelne Zahl mit Trend | scalar + delta | 10 s – 5 min | fast jedes Dashboard |
| **Ticker-Zeile** | laufende Ereignisse / Status | event stream | Echtzeit–30 s | Chronik, Benachrichtigungen |
| **Trend-Liniendiagramm** | Zeitreihe | timestamp/value[] | 30 s – 5 min | Auswertungen, Betrieb |
| **Statusleiste** | Aggregat mehrerer Zustände | enum[] | 5 s – 60 s | Systemgesundheit, Prozessstatus |

Diese vier sind die natürliche erste Stufe, weil sie bereits in T1–T3/P1–P5 angelegt sind
und ohne Chart-Library-Framework als ES-Module gebaut werden können.

## 8. Was jetzt als Nächstes folgt

Wenn du diesen A2-Entwurf freigibst, mache ich daraus:
1. Ein JSON-Schema für `workspace.json` inkl. `warum-so`-Metadaten.
2. Einen konkreten Beispiel-Deskriptor für den obigen Minimalbaum (ohne Renderlogik).
3. Eine Beispielseite, die den Deskriptor parst und die „Warum-so"-Ansicht zeigt (Prototyp G1-Vorstufe).
