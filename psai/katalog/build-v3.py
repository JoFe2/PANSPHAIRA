#!/usr/bin/env python3
# Baut aus den V2-Mockups die V3-Seiten: Gleicher Kern, V3-Erweiterungsschicht.
import io, sys
K = "/Users/jo/frontend-kit/psai/katalog/"

def sub(s, a, b, tag):
    assert a in s, "Anker fehlt: " + tag
    return s.replace(a, b, 1)

CSS_COMMON = """
/* ── V3-Schicht ─────────────────────────────────────────────────── */
.filters{display:flex;gap:6px;margin:0 0 14px;flex-wrap:wrap}
.filters button{font:600 11.5px/1 var(--ps-mono);letter-spacing:.04em;border:1px solid var(--ps-line);background:var(--ps-layer);color:var(--ps-text2);border-radius:999px;padding:7px 12px;cursor:pointer;min-height:32px}
.filters button[aria-pressed="true"]{border-color:var(--ps-action);color:var(--ps-action);background:var(--ps-bg)}
.filters [data-c]{opacity:.75;margin-left:6px}
.card.verborgen{display:none}
.wirk-zeile{font:400 12px/1.7 var(--ps-mono);border:1px solid var(--ps-line);border-radius:6px;padding:8px 10px;margin:0 0 10px;background:var(--ps-bg)}
.wirk-zeile s{color:var(--ps-text2)}
.wirk-zeile b{color:__OKTONE__}
input.menge{width:54px;font:600 12px var(--ps-mono);border:1px solid var(--ps-line);border-radius:4px;background:var(--ps-layer);color:var(--ps-text);padding:3px 6px;text-align:center}
.empty{border:1px dashed var(--ps-line);border-radius:10px;padding:28px;text-align:center;color:var(--ps-text2);background:var(--ps-layer)}
.empty b{display:block;font:600 15px var(--ps-sans);color:var(--ps-text);margin-bottom:4px}
footer .blink{animation:psblink 1.1s ease-out}
@keyframes psblink{0%{color:var(--ps-action)}100%{}}
@media (prefers-reduced-motion: reduce){footer .blink{animation:none}}
.legend{display:flex;gap:12px;align-items:center;font:400 10.5px var(--ps-mono);color:var(--ps-text2);padding:2px 18px}
.legend i{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:4px;background:var(--ps-info,__OKTONE__)}
.legend i.warn{background:var(--ps-warn)}
"""

FILTERS = """
  <div class="filters" role="group" aria-label="Warteschlange filtern">
    <button type="button" data-filter="all" aria-pressed="true">Alle <span data-c>3</span></button>
    <button type="button" data-filter="low" aria-pressed="false">Risikoarm <span data-c>2</span></button>
    <button type="button" data-filter="busy" aria-pressed="false">Laufend <span data-c>1</span></button>
  </div>"""

EMPTY = """
  <div class="empty" id="emptyState" hidden><b>Warteschlange erschöpft.</b><span id="emptySummary">Alle Vorschläge sind entschieden.</span> Die Chronik rechts belegt jede Entscheidung einzeln.</div>
"""

WIRK = """
    <p class="wirk-zeile">Menge anpassen: <input class="menge" id="menge" type="number" value="10" min="1" max="40" aria-label="Stückzahl anpassen"> · Wirkung: <s>verfügbar 14</s> → <b id="wkVerf">24</b> · Reservierung B-3302 auf <b id="wkRes">6</b></p>"""

def legend(t2=False):
    return ('  <p class="legend"><span><i></i>aktiv</span><span><i class="warn"></i>Einschränkung</span></p>\n')

def js(finish_html, feed_js, oktone, has_steps):
    return """
<script>
(()=>{ /* V3-Erweiterung: Live-Job, Filter, Wirksameldung, Leerzustand, Fokusfluss, Statusleben */
"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const cards=$$("article.card");
const rm=matchMedia("(prefers-reduced-motion: reduce)").matches;
const open=c=>!c.classList.contains("decided");
const st=$("#statusLine");
new MutationObserver(()=>{st.classList.remove("blink");void st.offsetWidth;st.classList.add("blink");}).observe(st,{childList:true,characterData:true,subtree:true});
function labelCounts(){
  const set=(f,n)=>{const b=document.querySelector('.filters [data-filter='+f+'] [data-c]');if(b)b.textContent=n;};
  set("all",cards.filter(open).length);
  set("low",cards.filter(c=>open(c)&&c.dataset.risk==="low").length);
  set("busy",cards.filter(c=>open(c)&&!c.dataset.risk).length);
}
function updateEmpty(){
  const es=$("#emptyState");if(!es)return;
  const off=cards.filter(c=>c.classList.contains("decided"));
  if(off.length===cards.length){es.hidden=false;
    $("#emptySummary").textContent=off.length+" Vorschl\u00e4ge sind entschieden.";%FEEDSUM%}
}
function setFilter(f){
  cards.forEach(c=>{const show=f==="all"||(f==="low"?c.dataset.risk==="low":!c.dataset.risk);c.classList.toggle("verborgen",!show);});
  $$(".filters button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.filter===f)));
  updateEmpty();
}
$$(".filters button").forEach(b=>b.addEventListener("click",()=>setFilter(b.dataset.filter)));
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-act],.undo,#undoBtn");if(!b)return;
  const card=b.closest("article.card");
  setTimeout(()=>{
    labelCounts();updateEmpty();
    if(card&&card.classList.contains("decided")){
      const i=cards.indexOf(card);
      for(const c of cards.slice(i+1).concat(cards.slice(0,i))){
        if(open(c)&&!c.classList.contains("verborgen")){cards.forEach(x=>x.dataset.focus=false);c.dataset.focus=true;break;}
      }
    }
  },0);
});
const menge=$("#menge");
if(menge){const upd=()=>{const n=Math.max(1,Math.min(40,+menge.value||1));$("#wkVerf").textContent=14+n;$("#wkRes").textContent=Math.max(16-n,0);};menge.addEventListener("input",upd);upd();}
/* Live-Job: BELG l\u00e4uft sichtbar zu Ende */
const belg=document.getElementById("belg");
if(belg){
  let pct=62;
  const bar=$("#pbar")||belg.querySelector(".progress i");
  const steps=$$(".steps span");
  const line=$("#stepText");
  const STEP={1:"SCHRITT 1/5 \u00b7 Beleg geladen",2:"SCHRITT 2/5 \u00b7 Kanonisiert",3:"SCHRITT 3/5 \u00b7 Hash gebildet, Siegel wird geschrieben",4:"SCHRITT 4/5 \u00b7 Siegel signiert, Readback l\u00e4uft",5:"SCHRITT 5/5 \u00b7 Readback trifft ein"};
  const t=setInterval(()=>{
    pct=Math.min(100,pct+(rm?38:5));
    if(bar){bar.style.transition=rm?"none":"width .85s linear";bar.style.width=pct+"%";}
    const pr=belg.querySelector(".progress");if(pr)pr.setAttribute("aria-valuenow",Math.round(pct));
    const step=Math.min(5,Math.max(1,Math.ceil(pct/20)));
    %STEPMARK%
    if(line)line.textContent=STEP[step];
    if(pct>=100){clearInterval(t);
      belg.classList.add("decided");belg.removeAttribute("aria-busy");
      belg.querySelector(".acts").outerHTML="%FINISH%";
      %FEED%
      st.textContent="BELG-0912 fertig \u2014 Siegel geschrieben, Readback best\u00e4tigt";
      labelCounts();updateEmpty();
    }
  },900);
}
labelCounts();updateEmpty();
})();
</script>
"""

def build(tpl):
    src = open(K + tpl["base"] + ".html", encoding="utf-8").read()
    css = CSS_COMMON.replace("__OKTONE__", tpl["oktone"]) + tpl.get("extra_css", "")
    src = sub(src, "</style>", css + "</style>", tpl["id"] + ":css")
    src = sub(src, tpl["title_a"], tpl["title_b"], "title")
    src = sub(src, tpl["chip_a"], tpl["chip_b"], "chip")
    src = sub(src, tpl["anchor_filters"], tpl["anchor_filters"] + FILTERS, "filters")
    src = sub(src, "</main>", EMPTY + "</main>", "empty")
    src = sub(src, tpl["anchor_legend"], tpl["anchor_legend"] + "\n" + legend(), "legend")
    if tpl.get("anchor_wirk"):
        src = sub(src, tpl["anchor_wirk"], tpl["anchor_wirk"] + WIRK, "wirk")
    src = sub(src, tpl["step_a"], tpl["step_b"], "step")
    jsb = js(tpl["finish"], tpl["feed"], tpl["oktone"], tpl["steps"])
    jsb = jsb.replace("%FINISH%", tpl["finish"].replace('"', "'"))
    jsb = jsb.replace("%FEED%", tpl["feed"])
    jsb = jsb.replace("%FEEDSUM%", tpl["feeds"])
    jsb = jsb.replace("%STEPMARK%", 'steps.forEach((s,i)=>{s.className=i+1<step?"done":(i+1===step?"now":"");});' if tpl["steps"] else "")
    src = sub(src, "</body>", jsb + tpl.get("extra_js", "") + "</body>", "js")
    src = sub(src, "DEMO-MOCKUP \u00b7 INTERAKTION NUR VISUELL", "DEMO-MOCKUP V3 \u00b7 INTERAKTION NUR VISUELL", "hint")
    open(K + tpl["base"] + "-v3.html", "w", encoding="utf-8").write(src)
    print("gebaut:", tpl["base"] + "-v3.html")

FEED_ROW = lambda cls: ("const fd=document.createElement('div');fd.className='%s';fd.innerHTML='\u2714 <b>BELG-0912</b> versiegelt \u2014 Readback best\u00e4tigt <time>jetzt</time>';document.getElementById('rcptFeed').prepend(fd);" % cls)

build(dict(id="t1", base="t1-arbeitsprofil-v2", oktone="var(--ps-ok)", steps=False,
  title_a=('<title>PsAI \u00b7 Template T1 \u201eArbeitsprofil\u201c V2 (Genehmigungstag mit '
           'Verlaufsschiene)</title>'),
  title_b=('<title>PsAI \u00b7 Template T1 \u201eArbeitsprofil\u201c V3 (Genehmigungstag '
           'mit atmenden Zahlen)</title>'),
  chip_a='<span class="ver" title="Dieses Mockup ist interaktiv bedienbar">V2</span>',
  chip_b='<span class="ver" title="V3: Live-Job, Filter, Wirksameldung, Hilfedialog">V3</span>',
  anchor_filters=('<p class="sub">Kein Vorschlag l\u00e4uft ohne Ihre Genehmigung. Nach der '
                  'Ausf\u00fchrung zeigt der Readback, was das Zielsystem wirklich ge\u00e4ndert hat.</p>'),
  anchor_legend='<p class="mod">4 von 4 geladen \u00b7 v1</p>',
  anchor_wirk=('<p>Zwei Effekte angemeldet: Wareneingang 10 St\u00fcck, Bestellung B-3302 um 6 '
               'reserviert. Restbestand danach 4 \u2014 Schwelle erreicht, Hinweis folgt als '
               'separater Vorschlag.</p>'),
  step_a='<p class="meta" style="margin-bottom:6px">Schritt 3 von 5 \u00b7 Hash gebildet, Siegel wird geschrieben</p>',
  step_b='<p class="meta" id="stepText" style="margin-bottom:6px">SCHRITT 3/5 \u00b7 Hash gebildet, Siegel wird geschrieben</p>',
  finish=('<p class="rcpt" style="margin:0;border-left-color:var(--ps-ok)" role="status">\u2714 BELG-0912 '
          'versiegelt \u00b7 Readback best\u00e4tigt: Hash im Beleg hinterlegt \u00b7 <a href="#log">Rohlog</a></p>'),
  feed=FEED_ROW("rcpt"),
  feeds="",
  extra_css=("\ndialog{border:1px solid var(--ps-line);background:var(--ps-layer);color:var(--ps-text);border-radius:8px;max-width:420px;width:92vw;margin:14vh auto auto;padding:0}\n"
             "dialog::backdrop{background:#00000099}\n.helpbox{padding:18px}\n.helpbox h2{margin:0 0 10px;font:600 15px var(--ps-sans)}\n"),
  extra_html=None))

# T1: Hilfedialog + Budget-Titel + ?-Bindung (nachträglich einsetzen)
t1 = open(K + "t1-arbeitsprofil-v2-v3.html", encoding="utf-8").read()
t1 = sub(t1, '<aside id="panel"', """<dialog id="help" aria-labelledby="helpT">
  <div class="helpbox"><h2 id="helpT">Tastatur-K\u00fcrzel</h2>
  <ul class="keys"><li>Palette \u00f6ffnen <kbd>\u2318K</kbd></li><li>Karten wandern <kbd>J</kbd>/<kbd>K</kbd></li>
  <li>Genehmigen <kbd>G</kbd> dann <kbd>Enter</kbd></li><li>Ablehnen <kbd>G</kbd> dann <kbd>X</kbd></li>
  <li>Schlie\u00dfen <kbd>Esc</kbd></li></ul>
  <p style="color:var(--ps-text2);font-size:12px;margin:10px 0 12px">K\u00fcrzel sind Zweitweg \u2014 jede Aktion liegt sichtbar auf der Karte.</p>
  <button class="ghost small" id="helpClose" type="button">Schlie\u00dfen</button></div>
</dialog>
<aside id="panel"\"""", "t1:help")
t1 = sub(t1, 'title="Tagesbudget Modellaufrufe"', 'title="421 von 680 Modell-Minuten \u2014 ab 100 % pausiert die Vorschlags-Kette",', "t1:budget")
t1 = sub(t1, "labelCounts();updateEmpty();\n})();",
  """document.addEventListener("keydown",e=>{if(e.key==="?"&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName))$("#help").showModal();});
$("#helpClose").addEventListener("click",()=>$("#help").close());
labelCounts();updateEmpty();
})();""", "t1:helpbind")
open(K + "t1-arbeitsprofil-v2-v3.html", "w", encoding="utf-8").write(t1)
import os; os.rename(K+"t1-arbeitsprofil-v2-v3.html", K+"t1-arbeitsprofil-v3.html")
print("gebaut: t1-arbeitsprofil-v3.html (umbenannt)")
