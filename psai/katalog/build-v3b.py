#!/usr/bin/env python3
# Fortsetzung von build-v3.py: T2 und T3 (sauber notiert, ohne Nested-Triples).
import os
K = "/Users/jo/frontend-kit/psai/katalog/"
exec(open(K + "build-v3.py").read().split('build(dict(id="t1"')[0])  # Helfer: sub, CSS_COMMON, FILTERS, EMPTY, WIRK, legend, js, FEED_ROW

DIFFCSS = """
.diff{width:100%;border-collapse:collapse;margin:0 0 14px;font-size:14px}
.diff caption{font:600 10.5px var(--ps-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--ps-text2);text-align:left;padding-bottom:6px}
.diff th,.diff td{padding:6px 10px;border-bottom:1px solid var(--ps-line);text-align:left}
.diff th{font:600 11px var(--ps-mono);letter-spacing:.08em;color:var(--ps-text2);text-transform:uppercase}
.diff td:first-child{color:var(--ps-text2)}
.diff td:nth-child(2){text-decoration:line-through;text-decoration-color:#b3261e66;color:var(--ps-text2)}
.diff td:nth-child(3){font-weight:700;color:var(--ps-action)}
.dayline{font:600 10.5px var(--ps-mono);letter-spacing:.16em;color:var(--ps-text2);margin:0 0 4px}
.reject-note{font:400 12px var(--ps-sans);color:var(--ps-text2);margin:4px 0 0}
"""
EXTRAJS = """
(()=>{ /* V3 T3: Begründungs-Entwurf überlebt Neuladen */
const KEY="psai-t3-grund";
new MutationObserver(()=>{document.querySelectorAll(".reject-form textarea").forEach(t=>{
 if(t.dataset.laden)return;t.dataset.laden="1";
 const d=localStorage.getItem(KEY);
 if(d&&!t.value){t.value=d;const n=document.createElement("p");n.className="reject-note";n.textContent="Entwurf wiederhergestellt — weiter texten, der Satz bleibt gespeichert.";t.after(n);}
 t.addEventListener("input",()=>localStorage.setItem(KEY,t.value));});}).observe(document.body,{childList:true,subtree:true});
})();
"""

def finish_build(tpl, extra_html_sub=None):
    src = open(K + tpl["base"] + "-v3.html.tmp", encoding="utf-8").read()
    open(K + tpl["out"], "w", encoding="utf-8").write(src)
    os.remove(K + tpl["base"] + "-v3.html.tmp")

# --- T2 ---
t2 = open(K + "t2-nachtwache-v2.html", encoding="utf-8").read()
t2 = sub(t2, "</style>", (CSS_COMMON.replace("__OKTONE__", "var(--ps-info)") + "</style>"), "t2:css")
t2 = sub(t2, "<title>PsAI · Template T2 \u201eNachtwache\u201c V2 (bedienbare Genehmigungs-Konsole)</title>",
          "<title>PsAI · Template T2 \u201eNachtwache\u201c V3 (Leitstand, der mitarbeitet)</title>", "t2:title")
t2 = sub(t2, '<span class="ver" title="Dieses Mockup ist interaktiv bedienbar">V2 · BEDIENBAR</span>',
          '<span class="ver" title="V3: Live-Job, Filter, Wirksameldung, Sammel-Freigabe">V3 · LEITSTAND</span>', "t2:chip")
anchor = "<p class=\"sub\">Nichts läuft ohne Freigabe. Der Readback belegt anschließend, was das Zielsystem wirklich geändert hat.</p>"
t2 = sub(t2, anchor, anchor + FILTERS, "t2:filters")
t2 = sub(t2, "</main>", EMPTY + "</main>", "t2:empty")
t2 = sub(t2, '<p class="mod">4/4 Module geladen · v1</p>', '<p class="mod">4/4 Module geladen · v1</p>\n' + legend(), "t2:legend")
wirk_anchor = "<p>Angemeldet: Eingang 10 Stück, Reservierung B-3302 um 6. Verifiziert nach Ausführung: verfügbar 4. Hinweis \u201eMeldebestand erreicht\u201c kommt als eigener Vorschlag.</p>"
t2 = sub(t2, wirk_anchor, wirk_anchor + WIRK, "t2:wirk")
t2 = sub(t2, '<p class="meta" style="margin:0 0 8px;color:var(--ps-text)">SCHRITT 3/5 · <span style="color:var(--ps-text2)">Hash gebildet, Siegel wird geschrieben</span></p>',
          '<p class="meta" id="stepText" style="margin:0 0 8px;color:var(--ps-text)">SCHRITT 3/5 · Hash gebildet, Siegel wird geschrieben</p>', "t2:step")
jsb = js('<div class="rcpt-inline" role="status">\u2714 <b>BELG-0912</b> versiegelt \u2014 Readback: Siegel-Hash im Beleg hinterlegt · q-8841</div>',
         FEED_ROW("rcpt"), "var(--ps-info)", True)
jsb = jsb.replace("%FINISH%", '<div class="rcpt-inline" role="status">\u2714 <b>BELG-0912</b> versiegelt — Readback: Siegel-Hash im Beleg hinterlegt · q-8841</div>'.replace('"', "'"))
jsb = jsb.replace("%FEED%", FEED_ROW("rcpt"))
jsb = jsb.replace("%FEEDSUM%", (' const a=cards.filter(c=>c.classList.contains("approved")).length,'
    'r=cards.filter(c=>c.classList.contains("rejected")).length;'
    '$("#emptySummary").textContent=off.length+" Vorschl\u00e4ge entschieden: "+a+" genehmigt, "+r+" abgelehnt, 1 automatisch versiegelt."'))
jsb = jsb.replace("%STEPMARK%", 'steps.forEach((s,i)=>{s.className=i+1<step?"done":(i+1===step?"now":"");});')
t2 = sub(t2, "</body>", jsb + "</body>", "t2:js")
t2 = sub(t2, "DEMO-MOCKUP · INTERAKTION NUR VISUELL", "DEMO-MOCKUP V3 · INTERAKTION NUR VISUELL", "t2:hint")
open(K + "t2-nachtwache-v3.html", "w", encoding="utf-8").write(t2)
print("gebaut: t2-nachtwache-v3.html")

# --- T3 ---
t3 = open(K + "t3-redaktionell-v2.html", encoding="utf-8").read()
t3 = sub(t3, "</style>", (CSS_COMMON.replace("__OKTONE__", "var(--ps-ok)") + DIFFCSS + "</style>"), "t3:css")
t3 = sub(t3, "<title>PsAI · Template T3 \u201eRedaktionell\u201c V2 (Wirkung in Worten, Chronik in der Spur)</title>",
          "<title>PsAI · Template T3 \u201eRedaktionell\u201c V3 (Abwägen mit Tabelle, Entwürfe, die überleben)</title>", "t3:title")
t3 = sub(t3, '<span class="ver" title="Dieses Mockup ist interaktiv bedienbar">V2</span>',
          '<span class="ver" title="V3: Diff-Tabelle, Entwurf-Speicher, Live-Job">V3</span>', "t3:chip")
anchor3 = "<p class=\"sub\">Kein Vorschlag läuft ohne Ihre Genehmigung. Nach der Ausführung zeigt der Readback, was das Zielsystem wirklich geändert hat \u2014 die Chronik rechts belegt es.</p>"
t3 = sub(t3, anchor3, anchor3 + FILTERS, "t3:filters")
t3 = sub(t3, "</main>", EMPTY + "</main>", "t3:empty")
t3 = sub(t3, '<p class="mod">4 von 4 geladen · v1</p>', '<p class="mod">4 von 4 geladen · v1</p>\n' + legend(), "t3:legend")
t3 = sub(t3, '<p class="meta">Schritt 3 von 5 \u2014 Hash gebildet, Siegel wird geschrieben</p>',
          '<p class="meta" id="stepText">SCHRITT 3/5 \u2014 Hash gebildet, Siegel wird geschrieben</p>', "t3:step")
def diff(rows, cap):
    r = "".join("<tr><td>%s</td><td>%s</td><td>%s</td></tr>" % x for x in rows)
    return ('<table class="diff"><caption>%s</caption>'
            '<tr><th>Feld</th><th>Vorher</th><th>Nachher</th></tr>%s</table>') % (cap, r)
t3 = sub(t3, '<span class="note">Meldebestand erreicht \u2014 Hinweis folgt als eigener Vorschlag.</span>\n    </div>',
  '<span class="note">Meldebestand erreicht \u2014 Hinweis folgt als eigener Vorschlag.</span>\n    </div>\n    ' +
  diff([("Bestand verfügbar", "14", "24"), ("Reservierung B-3302", "12", "6"), ("Hinweis Meldebestand", "\u2014", "eigener Vorschlag")], "Angemeldete Wirkung \u2014 Feld für Feld"), "t3:diff1")
t3 = sub(t3, '<span class="note">Kein Versand nach außen \u2014 die Werkstatt schreibt nur lokal.</span>\n    </div>',
  '<span class="note">Kein Versand nach außen \u2014 die Werkstatt schreibt nur lokal.</span>\n    </div>\n    ' +
  diff([("Postausgang Kunde", "wartet", "Sent-Ordner"), ("Belegverlinkung", "ohne", "mit Belegnummer")], "Angemeldete Wirkung \u2014 Feld für Feld"), "t3:diff2")
t3 = sub(t3, '<div class="chron" id="rcptFeed">', '<div class="chron" id="rcptFeed">\n    <p class="dayline">HEUTE</p>', "t3:day")
js3 = js('<p class="decided-note" role="status">\u2714 <b>BELG-0912</b> versiegelt \u2014 Readback bestätigt, Hash im Beleg hinterlegt.</p>',
         FEED_ROW("rcpt"), "var(--ps-ok)", False)
js3 = js3.replace("%FINISH%", '<p class="decided-note" role="status">\u2714 <b>BELG-0912</b> versiegelt — Readback bestätigt, Hash im Beleg hinterlegt.</p>'.replace('"', "'"))
js3 = js3.replace("%FEED%", FEED_ROW("rcpt"))
js3 = js3.replace("%FEEDSUM%", "")
js3 = js3.replace("%STEPMARK%", "")
t3 = sub(t3, "</body>", js3 + "<script>" + EXTRAJS + "</script>" + "</body>", "t3:js")
t3 = sub(t3, "DEMO-MOCKUP · INTERAKTION NUR VISUELL", "DEMO-MOCKUP V3 · INTERAKTION NUR VISUELL", "t3:hint")
open(K + "t3-redaktionell-v3.html", "w", encoding="utf-8").write(t3)
print("gebaut: t3-redaktionell-v3.html")
