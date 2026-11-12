# VORLAGEN-PIPELINE (AP-H2.1)

## Wann wird katalogisiert?
Bei Epic-Abnahme: Jedes Artefakt, das ein Epic-Gesamttest besteht, erhält innerhalb derselben
Arbeitswoche einen Katalog-Eintrag (Schema: katalog-eintrag.schema.json). Screenshots werden
automatisch erzeugt (Playwright, 390/1024/1586), damit sie nicht veralten: Shot-Skript im
Katalog-Repo, nachlaufen lassbar (`node shots.mjs`), Abweichung >5% Pixel = Eintrag auf
„einschränkung“ im Kanon-Check bis nachgezogen.

## Wer pflegt Varianten?
- Eigentümer des Wurzel-Knotens des Artefakts = Katalog-Pfleger (DELEGATION-MODELL).
- Varianten sind NUR Optionen-Kombinationen + Scope-Kombinationen; neue Katalog-IDs nur bei
  echten Struktur-/Designsprüngen (Vermeidung von Kopien-Wildwuchs, B4/H2).
- Agenten dürfen Katalogentwürfe einreichen (Stufe 1), Freigabe immer durch Menschen-Eigentümer.

## Durchgespieltes Beispiel (Test AP-H2.1)
Neue Anforderung „Logistik-Startseite im Orbit-Look“:
1. Kein neuer Eintrag nötig: layout.kachel-grid + theme.orbit als TemplateRefs, Optionen Dichte.
2. Erst als die Domain eigene Zonen-Anker braucht → neuer layout-Eintrag layout.logistik-fluss,
   erzeugt aus dem P4-Campus mit Optionen — Pipeline-Schritte: Epic-Artefakt → Test → Eintrag → Screens.
