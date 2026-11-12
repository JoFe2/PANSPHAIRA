# SHELL-BESCHREIBUNG (AP-F2.1)

Nachbaubare Beschreibung der Hülle aus den P-Seiten (build-profiles.py), ohne Originalcode.

## Zonen (LAYOUT-KATALOG Raster 1)
1. **Header (54px, sticky):** Marke (Slot marke.name/logo) | Subbrand | Profil-Chip |
   Vorgangs-Suche (Feld+Button) | Mandant-Chip „GESCHÜTZTE SITZUNG“ | Abmelden.
2. **Navigation (212px):** Gruppen mit Kleinbuchstaben-Labels; Einträge mit StatusBadge
   („n.a.“=noch nicht angebunden, „LOKAL“); aria-current; Hover layer2; aktiver Rand 2px links.
3. **Content:** Brotdose crumb (mono), h1+sub1, Kartenstrom (.card), Amber-Block role=status,
   Tabelle .mg, Details-Abschnitte.
4. **Assistenten-Rail (316px):** Tabs role=tablist, Grußkarte, Aktionsliste, Hinweisbox (gestrichelt amber).
5. **Statuszeile:** role=status #statusLine (Blink-Klasse bei Mutation) + Modus-Chips.

## Verhaltenspflichten
- Skip-Link First-Tab; Fokus-Ring global; Touch-Ziele ≥36px.
- Statuszeile ist die einzige aria-live-Zone (polite).
- Suchfeld: aria-label Pflicht (Placeholder allein ungültig als Name).
- Alle Flächen über Semantic-Tokens (TOKEN-ARCHITEKTUR), Werte je Theme aus THEME-PROFILE.

## Nachbautest (Epic-F)
Aus dieser Beschreibung + Token-Tabelle allein muss eine P4-ähnliche Seite ohne Blick auf
build-profiles.py rekonstruierbar sein. Prüfinstanz: konzept/prototyp/ (Epic G) nutzt exakt
diese Beschreibung — der Prototyp ist damit der Nachweis.
