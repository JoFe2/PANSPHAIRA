#!/usr/bin/env python3
"""Regie — Agenten-Werkzeug für die PsAI-Werksbank.

Setzt Zeigerführungen, leuchtet einzelne Elemente an oder stoppt die Führung.
Einziges Input sind Zielnamen aus dem Live-Inventar der Werksbank
(GET /werkbank/elemente, dasselbe, was der Zeiler sieht). Unbekannte Ziele
beantwortet die Werksbank mit 422 samt Inventar — der Aufrufer korrigiert selbst.

Beispiele:
  regie.py play "Zone aus|Diese Zone blende ich aus" "Liste|Layout Liste"   # im Kreis (Standard)
  regie.py play "Warum so?|Hier die Begründung" --einmal
  regie.py gluehe "Pause|Kurzer Blick auf die Bremsleiste"
  regie.py stopp
  regie.py inventar
"""
import argparse, json, sys, urllib.request

BASIS = __import__("os").environ.get("PSAI_WERKBANK", "http://127.0.0.1:8099")


def sende(pfad, sach=None):
    req = urllib.request.Request(
        BASIS + pfad,
        data=None if sach is None else json.dumps(sach, ensure_ascii=False).encode(),
        headers={"content-type": "application/json"},
        method="POST" if sach is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=5) as antwort:
            return antwort.status, json.loads(antwort.read().decode() or "null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "null")


def schritt(text):
    ziel, _, spruch = text.partition("|")
    return {"ziel": ziel.strip(), "spruch": spruch.strip()}


def main():
    e = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    e.add_argument("aktion", choices=["play", "gluehe", "stopp", "status", "inventar"])
    e.add_argument("schritte", nargs="*", help='"Zielname|Sprechblase" — bei play beliebig viele, bei gluehe genau eine')
    e.add_argument("--einmal", action="store_true", help="Tour einmal durchlaufen, nicht im Kreis")
    a = e.parse_args()

    if a.aktion == "inventar":
        code, namen = sende("/werkbank/elemente")
        print("\n".join(namen) if namen else "(noch nichts gemeldet — Seite offnet die Werksbank, damit sie sich meldet)")
        return 0
    if a.aktion == "status":
        print(json.dumps(sende("/werkbank/regie")[1], ensure_ascii=False, indent=1))
        return 0
    if a.aktion == "stopp":
        code, sach = sende("/werkbank/regie", {"aktion": "stopp"})
    elif a.aktion == "gluehe":
        code, sach = sende("/werkbank/regie", {"aktion": "gluehe", **schritt(a.schritte[0])})
    else:
        code, sach = sende("/werkbank/regie",
                           {"schritte": [schritt(t) for t in a.schritte], "schleife": not a.einmal})
    if code == 422:
        print("Ziel unbekannt:", sach.get("gemeint") or sach.get("ziel"), "\nBedienbar ist gerade:",
              "; ".join(sach.get("inventar", [])), file=sys.stderr)
        return 3
    if code not in (202, 200):
        print("Abgewiesen:", code, sach, file=sys.stderr)
        return 1
    print("ok" + (f" ({sach['uebernommen']} Schritte übernommen)" if isinstance(sach, dict) and "uebernommen" in sach else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
