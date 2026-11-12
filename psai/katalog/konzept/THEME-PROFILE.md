# THEME-PROFILE (AP-C2.1, C4)

Profile = Design-Vorlagen im Katalog (H1). Werte = echte Werte aus P1–P5/T1–T3 Build.

## essential-2d (nüchtern, Tag)
Tokens: TOKEN-Tabelle Spalte Essential. Dichte normal, Rundung 10px.
Typo: system-ui, Metadaten ui-monospace. Icons: konturiert, 1.5px.
Motion: nur Zustandsübergänge ≤150ms, keine Idle-Animation.
Zonen: alle erlaubt. Branding: sichtbar.

## pulse (dunkel, Fokus)
Tokens: Spalte Pulse. Rundung 12px, Dichte normal-großzügig.
Icon-Chips mit Glow (Shadow ≤ -6px Spread). Signatur-Orb nur in Assistentenzone.
Motion: Orb-Atmen 5.5s, Reduziert bei reduced-motion (still).
Zonen: Start/Fach/Chronik gern, Navigation bewusst zurückhaltend.

## notebook (hell, Reiter)
Basis essential-2d, zusätzlich Bereichsfarbcodierung (pill-Farben aus p2), Flächen-Hero dekorativ.
Dichte kompakt möglich. Motion: Reiterwechsel 120ms opacity.

## orbit (dunkel, Ablauf)
Basis pulse kälter (#0a0e14), Struktur-Signale (erl/akt/offen) als Primärsprache,
Flow-Pfeile als Content (aria). Motion: Schrittwechsel 120ms.

## insight (dunkel, Analyse)
Basis orbit, Count-up und Balken-Wachstum 1.1s ease-out, einmalig; Chart-Paletten
blau→violet→mint, immer mit Zahlenbeschriftung (Farbe nie allein).

## Motion-Regeln (AP-C4.1)
1. Bewegung zeigt nur: Zustandswechsel, Ankunft von Daten, Bewegung im Datenraum.
2. reduced-motion-Pfad Pflicht: alles statisch, Zustände bleiben lesbar.
3. Budget: keine Dauer-Animation >1 gleichzeitiges Objekt pro Zone; Idle-Animationen
   nur im Assistenten-Orb (pulse).

## PanSphaira-Dezenz (AP-H3.1)
Marken-Slots aus TOKEN-ARCHITEKTUR; Profile enthalten keine Markenanteile.
Referenz-Instanz: alle fünf Profile mit marke.name="PanSphaira" gebaut.
