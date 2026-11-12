#!/usr/bin/env python3
# baut die fünf Profil-Zielbilder; teilt die Hülle aus build-profiles.py
import io
K = "/Users/jo/frontend-kit/psai/katalog/"
exec(open(K + "build-profiles.py").read())

# ── P1 Jarvis Pulse ───────────────────────────────────────────────
tk1 = dict(bg="#0a0f1a", layer="#0f1826", layer2="#131f30", line="#1e293b", text="#e5e7eb",
           text2="#94a3b8", blue="#4a9eff", violet="#8b5cf6", ok="#4ade80", oktx="#4ade80", btn="#2563eb", warn="#fbbf24",
           warntx="#fcd34d", amber="#1c1608", rad="12px", chipbg="#f8fafc", chiptx="#0a0f1a")
css1 = """
.orbwrap{display:flex;gap:22px;align-items:center;border:1px solid var(--ps-line);border-radius:14px;
  background:radial-gradient(420px 190px at 18% 40%, #10305c66, transparent), var(--ps-layer);padding:16px 18px;margin-bottom:12px}
.orb{position:relative;width:104px;height:104px;border-radius:50%;flex:none;
  background:radial-gradient(circle at 38% 34%, #7c3aed88, #0b1524 58%);
  border:1.5px solid var(--ps-blue);box-shadow:0 0 34px -6px #4a9eff66, inset 0 0 26px #4a9eff33}
.orb::before,.orb::after{content:"";position:absolute;inset:14%;border:1px solid #4a9eff44;border-radius:50%;transform:rotate(28deg)}
.orb::after{transform:rotate(-32deg);border-color:#8b5cf655}
@media (prefers-reduced-motion: no-preference){
 .orb{animation:atmen 5.5s ease-in-out infinite}
 .orb::before{animation:dreh 14s linear infinite}}
@keyframes atmen{0%,100%{box-shadow:0 0 30px -8px #4a9eff55, inset 0 0 22px #4a9eff2e}50%{box-shadow:0 0 44px -4px #4a9eff88, inset 0 0 30px #4a9eff44}}
@keyframes dreh{to{transform:rotate(380deg)}}
.orb.denkend{filter:saturate(1.4);border-color:var(--ps-violet)}
.orb.denkend::before{animation-duration:1.6s}
.orb.belegt{border-color:var(--ps-warn);box-shadow:0 0 30px -8px #fbbf2466, inset 0 0 22px #fbbf2433}
.welle{display:flex;gap:3px;align-items:flex-end;height:26px}
.welle i{width:3px;background:linear-gradient(var(--ps-blue),var(--ps-violet));border-radius:2px;height:30%}
@media (prefers-reduced-motion: no-preference){.welle i{animation:wb 1.3s ease-in-out infinite}
 .welle i:nth-child(2){animation-delay:.12s}.welle i:nth-child(3){animation-delay:.24s}.welle i:nth-child(4){animation-delay:.36s}.welle i:nth-child(5){animation-delay:.48s}.welle i:nth-child(6){animation-delay:.6s}.welle i:nth-child(7){animation-delay:.72s}}
@keyframes wb{0%,100%{height:22%}50%{height:92%}}
.orbtext b{font:700 15px var(--ps-sans)}
.orbtext p{margin:3px 0 8px;color:var(--ps-text2);font-size:12.5px;max-width:46ch}
.orbzustand{font:700 9.5px var(--ps-mono);letter-spacing:.14em;color:var(--ps-blue);border:1px solid var(--ps-line);border-radius:999px;padding:3px 10px;display:inline-block}
.domains{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:8px}
.dom{border:1px solid var(--ps-line);border-radius:12px;background:var(--ps-layer);padding:11px 12px;position:relative}
.dom i{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font:700 11px var(--ps-mono);font-style:normal;color:#fff;background:var(--dc,#64748b);box-shadow:0 6px 16px -6px var(--dc,#64748b)}
.dom b{display:block;margin:7px 0 1px;font-size:12.5px}
.dom small{color:var(--ps-text2);font:400 10.5px var(--ps-mono)}
"""
h1p = """
  <p class="crumb">Arbeitsplatz › Rechnungen · AP-PAN316-MATCHED-01 · geschützte Sitzung</p>
  <h1>Jarvis Pulse — Zielbild</h1>
  <p class="sub1">Ruhiger Fokus, aktueller Beleg, derselbe lokale Assistent. Der Orb zeigt Zustände — <b>kein Mikrofon, kein KI-Modell</b> (Abnahme offen).</p>
  <section class="orbwrap" aria-label="Assistentenzustand">
    <div class="orb" id="orb" role="img" aria-label="Assistenten-Orb, Zustandsanzeige"></div>
    <div class="orbtext">
      <span class="welle" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
      <b>Bereit im 2D-Fokus</b>
      <p>Wellenform ist Zierde, keine Audio-Anmutung: Sprachbedienung ist noch nicht abgenommen.
         Der Orb folgt ausschließlich lokalen Zuständen.</p>
      <span class="orbzustand" id="orbz">BEREIT · ESSENTIAL 2D</span>
      <button type="button" id="planen" style="margin-left:8px">Vorschlag notieren</button>
      <button class="ghost" type="button" id="ready" style="margin-left:4px">Zurück auf bereit</button>
    </div>
  </section>
  <h2 style="font:600 12px var(--ps-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ps-text2);margin:16px 0 8px">Deine verbundenen Arbeitsbereiche</h2>
  <div class="domains">
    <div class="dom" style="--dc:#3b82f6"><i>R</i><b>Rechnungen</b><small>offen · AP-PAN316</small></div>
    <div class="dom" style="--dc:#8b5cf6"><i>A</i><b>Analysen</b><small>Bereich offen</small></div>
    <div class="dom" style="--dc:#14b8a6"><i>G</i><b>Agent</b><small>lokal · geführt</small></div>
    <div class="dom" style="--dc:#64748b"><i>P</i><b>Projekte</b><small>noch nicht angebunden</small></div>
    <div class="dom" style="--dc:#64748b"><i>D</i><b>Dokumente</b><small>noch nicht angebunden</small></div>
    <div class="dom" style="--dc:#f59e0b"><i>E</i><b>Einrichtung</b><small>registriert</small></div>
  </div>
  <div style="height:12px"></div>
""" + core().replace("__FLOW__", "")
js1 = """
(()=>{"use strict";
const orb=document.getElementById("orb"),z=document.getElementById("orbz"),st=document.getElementById("statusLine");
document.getElementById("planen").addEventListener("click",()=>{
  orb.className="orb denkend";z.textContent="DENKT · LOKALER VORSCHLAG";st.textContent="Vorschlag wird vorbereitet — zunächst nur Vorschlag";
  setTimeout(()=>{orb.className="orb belegt";z.textContent="VORSCHLAG NOTIERT · NICHT GESENDET";st.textContent="Vorschlag notiert — Auftragsliste noch nicht gesendet";},900);});
document.getElementById("ready").addEventListener("click",()=>{orb.className="orb";z.textContent="BEREIT · ESSENTIAL 2D";st.textContent="Rechnung geöffnet. Wähle deine nächste Ansichtsaktion.";});
})();"""
page("p1-jarvis-pulse.html", "PsAI · Zielbild P1 Jarvis Pulse (2D-Fokus, ehrlicher Orb)", "P1 · JARVIS PULSE", tk1, css1, h1p, ASSIST, js1,
     "Rechnung geöffnet. Wähle deine nächste Ansichtsaktion.")

# ── P2 Notebook Workspace ─────────────────────────────────────────
tk2 = dict(bg="#f5f6f8", layer="#ffffff", layer2="#eef0f4", line="#d7dbe2", text="#1c2330",
           text2="#566172", blue="#2563eb", violet="#7c3aed", ok="#16a34a", oktx="#0e6027", btn="#2563eb", warn="#b45309",
           warntx="#92620a", amber="#fffbeb", rad="10px", chipbg="#1c2330", chiptx="#ffffff")
css2 = """
.pilltabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}
.pilltabs button{display:inline-flex;gap:7px;align-items:center;border:1px solid var(--ps-line);background:var(--ps-layer);
  color:var(--ps-text);border-radius:999px;padding:7px 14px;min-height:34px;font:600 12px var(--ps-sans)}
.pilltabs button i{width:8px;height:8px;border-radius:50%;background:var(--tc,#94a3b8);font-style:normal}
.pilltabs button[aria-selected="true"]{border-color:var(--tc);background:var(--tcbg);color:var(--tc);font-weight:700}
.pilltabs button.na{color:var(--ps-text2);border-style:dashed}
.hero{position:relative;overflow:hidden;border-radius:12px;border:1px solid var(--ps-line);margin:0 0 12px;background:linear-gradient(200deg,#dbeafe 0%,#eff6ff 55%,#fff 100%)}
.hero svg{display:block;width:100%;height:104px}
.herotxt{position:absolute;left:16px;top:14px}
.herotxt small{font:700 9px var(--ps-mono);letter-spacing:.18em;color:var(--ps-text2)}
.herotxt b{display:block;font:700 17px var(--ps-sans);color:#0f1e33}
.hero .deko{position:absolute;right:10px;bottom:8px;font:400 9.5px var(--ps-mono);color:#31507a}
.subtabs{display:flex;gap:2px;border-bottom:1px solid var(--ps-line);margin:0 0 12px}
.subtabs button{border:0;border-bottom:2px solid transparent;background:none;color:var(--ps-text2);font:600 12px var(--ps-sans);padding:8px 13px;min-height:34px}
.subtabs button[aria-selected="true"]{color:var(--ps-blue);border-bottom-color:var(--ps-blue)}
"""
h2p = """
  <p class="crumb">Arbeitsplatz › Rechnungen · AP-PAN316-MATCHED-01 · geschützte Sitzung</p>
  <h1>Notebook Workspace — Zielbild</h1>
  <p class="sub1">Helle Karteikarten-Arbeitsfläche mit Farbcodierung je Bereich. Reiter schalten wirklich;
     angebunden ist heute nur „Übersicht&ldquo;.</p>
  <div class="pilltabs" role="tablist" aria-label="Bereichslasche">
    <button role="tab" type="button" aria-selected="false" style="--tc:#0ea5e9;--tcbg:#e0f2fe"><i></i>Projekte</button>
    <button role="tab" type="button" aria-selected="true" style="--tc:#7c3aed;--tcbg:#ede9fe"><i></i>Rechnungen</button>
    <button role="tab" type="button" aria-selected="false" class="na" style="--tc:#22c55e;--tcbg:#dcfce7"><i></i>Dokumente</button>
    <button role="tab" type="button" aria-selected="false" style="--tc:#d97706;--tcbg:#fef3c7"><i></i>Analysen</button>
    <button role="tab" type="button" aria-selected="false" style="--tc:#db2777;--tcbg:#fce7f3"><i></i>Agent</button>
    <button role="tab" type="button" aria-selected="false" style="--tc:#64748b;--tcbg:#f1f5f9"><i></i>Konfiguration</button>
  </div>
  <section class="hero" aria-label="Arbeitsplatz-Banner">
    <svg viewBox="0 0 800 104" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="0,104 150,34 260,86 380,18 520,96 640,44 800,104" fill="#bfdbfe"/>
      <polygon points="0,104 210,58 330,96 470,52 620,104" fill="#93c5fd"/>
      <polygon points="330,36 344,18 358,36" fill="#fff"/>
    </svg>
    <div class="herotxt"><small>DEIN GESCHÜTZTER ARBEITSPLATZ</small><b>Klarer Überblick. Sicher im Kontext.</b></div>
    <span class="deko">Flächenmotiv · dekorativ · kein Beleg</span>
  </section>
  <div class="subtabs" role="tablist" aria-label="Ansichtsreiter">
    <button role="tab" type="button" aria-selected="true" id="t-ue">Übersicht</button>
    <button role="tab" type="button" aria-selected="false">Planung</button>
    <button role="tab" type="button" aria-selected="false">Ausführung</button>
    <button role="tab" type="button" aria-selected="false">Recherche</button>
    <button role="tab" type="button" aria-selected="false">Notizen</button>
  </div>
  <div id="inh">
""" + core().replace("__FLOW__", "") + """
  </div>
  <div class="card" id="hinweis" hidden><b>Kein Inhalt verloren:</b> <span id="hinweistext"></span> Diese Reiter sind im Zielbild exemplarisch gesetzt; angebunden ist heute nur „Übersicht“. Bestand: AP-PAN316-MATCHED-01.</div>
"""
js2 = """
(()=>{"use strict";
const inh=document.getElementById("inh"),hz=document.getElementById("hinweis"),ht=document.getElementById("hinweistext"),st=document.getElementById("statusLine");
document.querySelectorAll(".subtabs button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".subtabs button").forEach(x=>x.setAttribute("aria-selected",String(x===b)));
  const t=b.textContent;const akt=t==="Übersicht";
  inh.hidden=!akt;hz.hidden=akt;
  if(!akt){ht.textContent="Reiter „"+t+"“ ist noch nicht angebunden.";st.textContent="Reiter „"+t+"“ — Platzhalter, keine Daten verloren";}}));
})();"""
page("p2-notebook-workspace.html", "PsAI · Zielbild P2 Notebook Workspace (farbige Reiter, Flächen-Hero)", "P2 · NOTEBOOK", tk2, css2, h2p, ASSIST, js2,
     "Rechnung geöffnet. Wähle deine nächste Ansichtsaktion.")

# ── P3 Orbit Command ──────────────────────────────────────────────
tk3 = dict(bg="#0a0e14", layer="#11161f", layer2="#161d29", line="#1f2733", text="#e6eaf0",
           text2="#8a94a3", blue="#3b82f6", violet="#8b5cf6", ok="#22c55e", oktx="#4ade80", btn="#2563eb", warn="#f59e0b",
           warntx="#fbbf24", amber="#191207", rad="12px", chipbg="#f8fafc", chiptx="#0a0e14")
css3 = """
.flow{display:flex;gap:0;align-items:stretch;margin:10px 0 4px;flex-wrap:wrap}
.flow button{flex:1;min-width:128px;display:flex;flex-direction:column;gap:2px;text-align:left;border:1px solid var(--ps-line);
  background:var(--ps-bg);color:var(--ps-text);border-radius:8px;padding:9px 11px;min-height:52px;font-weight:500;position:relative}
.flow button small{font:400 9.5px var(--ps-mono);color:var(--ps-text2)}
.flow button+button{margin-left:20px}
.flow button+button::before{content:"›";position:absolute;left:-15px;top:38%;color:var(--ps-text2);font:700 15px var(--ps-mono)}
.flow button.erl{border-color:var(--ps-ok)}
.flow button.erl::after{content:"✓";position:absolute;right:9px;top:8px;color:var(--ps-ok)}
.flow button.akt{border-color:var(--ps-blue);box-shadow:0 0 0 1px var(--ps-blue)}
.flow button.akt::after{content:"››";position:absolute;right:8px;top:8px;color:var(--ps-blue);font:700 10px var(--ps-mono)}
.fliessen{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:2px 0 12px}
.fl{border:1px solid var(--ps-line);border-radius:10px;background:var(--ps-layer);padding:10px 12px}
.fl b{display:block;font-size:12.5px}.fl small{font:400 10.5px var(--ps-mono);color:var(--ps-text2)}
.fl .amp{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;background:var(--ps-text2)}
.fl.ok .amp{background:var(--ps-ok)}.fl.warn .amp{background:var(--ps-warn)}
"""
flow_html = """
    <div class="flow" role="group" aria-label="Ka-bis-Zahlung — Arbeitsschritt wählen">
      <button type="button" class="erl" data-step="1">Beleg lesen<small>nativ · nur lesen</small></button>
      <button type="button" class="akt" data-step="2">Prüfung vorbereiten<small>Aktion · lokale Evidenz</small></button>
      <button type="button" data-step="3">Freigabe an Fachschicht<small>blockiert: ungeprüft</small></button>
    </div>"""
h3p = """
  <p class="crumb">Arbeitsplatz › Rechnungen · AP-PAN316-MATCHED-01 · geschützte Sitzung</p>
  <h1>Orbit Command — Zielbild</h1>
  <p class="sub1">Der Ablauf ist die Seite: Ka-bis-Zahlung als lesbare Kette mit ehrlichen Schritten.
     Kein Chart-Theater — KPIs zeigen ausschließlich belegte Zahlen.</p>
  <div class="fliessen" aria-label="Verbundene Arbeitsbereiche">
    <div class="fl ok"><span class="amp"></span><b>Rechnungen</b><small>Bereich offen</small></div>
    <div class="fl"><span class="amp"></span><b>Analysen</b><small>Bereich offen</small></div>
    <div class="fl warn"><span class="amp"></span><b>Agent</b><small>lokal · geführt</small></div>
    <div class="fl"><span class="amp"></span><b>Projekte</b><small>noch nicht angebunden</small></div>
    <div class="fl"><span class="amp"></span><b>Dokumente</b><small>noch nicht angebunden</small></div>
  </div>
""" + core(flow_html)
js3 = """
(()=>{"use strict";
const st=document.getElementById("statusLine");
const btns=[...document.querySelectorAll(".flow button")];
function setStep(n){btns.forEach(b=>{const i=+b.dataset.step;b.className=i<n?"erl":(i===n?"akt":"");});
  st.textContent="Schritt "+n+" von 3 aktiv — Status an der Kette ablesbar";}
btns.forEach(b=>b.addEventListener("click",()=>setStep(+b.dataset.step)));
document.addEventListener("keydown",e=>{if(/^[123]$/.test(e.key))setStep(+e.key);});
})();"""
page("p3-orbit-command.html", "PsAI · Zielbild P3 Orbit Command (Ablaufkette statt Spaltenliste)", "P3 · ORBIT", tk3, css3, h3p, ASSIST, js3,
     "Schritt 2 von 3 aktiv — Prüfung ist der Engpass.")

# ── P4 Prism Modules ──────────────────────────────────────────────
tk4 = dict(bg="#f4f5f7", layer="#ffffff", layer2="#eef0f3", line="#d8dce2", text="#1d2530",
           text2="#59636f", blue="#2563eb", violet="#7c3aed", ok="#16a34a", oktx="#0e6027", btn="#2563eb", warn="#b45309",
           warntx="#92620a", amber="#fffbeb", rad="10px", chipbg="#1d2530", chiptx="#ffffff")
css4 = """
.grid4{display:grid;grid-template-columns:196px minmax(0,1fr);gap:12px}
.bau{background:var(--ps-layer);border:1px solid var(--ps-line);border-radius:10px;padding:10px}
.bau h2.h3{margin:2px 4px 8px;font:600 10.5px var(--ps-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ps-text2)}
.bau button{display:block;width:100%;min-height:44px;text-align:left;background:var(--ps-bg);border:1px solid var(--ps-line);border-radius:8px;
  color:var(--ps-text);font:500 12px var(--ps-sans);padding:8px 10px;min-height:34px;margin-bottom:6px}
.bau button b{display:block;font-weight:700}
.bau button small{font:400 10px var(--ps-mono);color:var(--ps-text2)}
.bau button[aria-pressed="true"]{outline:2px solid var(--ps-blue);outline-offset:1px}
.st{float:right;font:600 8.5px var(--ps-mono);letter-spacing:.08em;border-radius:4px;padding:1px 6px}
.st.ro{color:#0e5f31;background:#d3f2df}.st.ge{color:#5b4a00;background:#fdeeb8}.st.ent{color:#5d2a86;background:#ece1fa}
.props{grid-column:1/-1;border:1px solid var(--ps-blue);border-radius:10px;background:var(--ps-layer);padding:11px 13px}
.props h3{margin:0 0 4px;font:600 12px var(--ps-sans)}
.props .kette{margin:2px 0 6px}
.canvaszahl{font:600 10px var(--ps-mono);color:var(--ps-text2);margin:0 4px 8px}
"""
props = """
  <div class="props" aria-live="polite">
    <h3>Eigenschaften &amp; Konfiguration</h3>
    <p class="kette" id="prop">Größe, Reihenfolge und Sichtbarkeit kommen aus dem Profil. Rechnungsfelder im nativen Viewer. Kein Drag-and-drop.</p>
    <button type="button">Vorhandene Arbeitsansicht bearbeiten</button>
    <button class="ghost" type="button" style="margin-left:6px">Native Beleginformationen öffnen</button>
  </div>"""
h4p = """
  <p class="crumb">Arbeitsplatz › Rechnungen · AP-PAN316-MATCHED-01 · geschützte Sitzung</p>
  <h1>Prism Modules — Zielbild</h1>
  <p class="sub1">Bausteine sind wählbar und antworten: Auswahl, Statusbadge und Eigenschaftenpanel sprechen dieselbe Sprache. Canvas-Ehrlichkeit statt Designer-Theater.</p>
  <div class="grid4">
    <div class="bau" role="group" aria-label="Modulbausteine">
      <h2 class="h3">Modulbausteine</h2>
      <button type="button" data-mod="inv" aria-pressed="true"><b>Eingangsrechnungsprüfung<span class="st ro">NUR LESEN</span></b><small>im Canvas · sichtbar</small></button>
      <button type="button" data-mod="men" aria-pressed="false"><b>Belege und Mengen<span class="st ro">NUR LESEN</span></b><small>im Canvas · sichtbar</small></button>
      <button type="button" data-mod="quel" aria-pressed="false"><b>Quelle und Nachvollziehbarkeit<span class="st ge">GESCHÜTZT</span></b><small>im Canvas · Ausklappbereich</small></button>
      <button type="button" data-mod="adm" aria-pressed="false"><b>Administration — geschützt<span class="st ge">GESCHÜTZT</span></b><small>registriert · außerhalb</small></button>
      <button type="button" data-mod="age" aria-pressed="false"><b>Agentenkonfiguration<span class="st ent">ENTWURF</span></b><small>registriert · außerhalb</small></button>
      <p class="canvaszahl" id="cnv">IM AKTUELLEN CANVAS: 3 SICHTBARE BAUSTEINE</p>
    </div>
    <div>
""" + core().replace("__FLOW__", "") + """
    </div>
""" + props + """
  </div>
"""
js4 = """
(()=>{"use strict";
const st=document.getElementById("statusLine"),prop=document.getElementById("prop");
const TEXT={inv:"Baustein: Eingangsrechnungsprüfung · Datenquelle: native Fachschicht (nur lesen) · Felder: Betrag, Erwartet, Abweichung · Aktualisierung: bei Auswahlwechsel.",
 men:"Baustein: Belege und Mengen · Zeigt Bestellung, Position, Wareneingang (10 STK je Zeile) · Referenz markiert als native Referenz.",
 quel:"Baustein: Quelle und Nachvollziehbarkeit · geschützter Ausklappbereich · Lesestatus bestätigend, keine Schreibrechte.",
 adm:"Baustein: Administration · geschützt — Bearbeitung nur mit Role-Nachweis · außerhalb des aktuellen Canvas.",
 age:"Baustein: Agentenkonfiguration · Entwurf — ohne Modellbindung derzeit ohne Funktion."};
document.querySelectorAll(".bau button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".bau button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
  prop.textContent=TEXT[b.dataset.mod];st.textContent="Baustein ausgewählt — Eigenschaften antworten";}));
})();"""
page("p4-prism-modules.html", "PsAI · Zielbild P4 Prism Modules (Bausteine, die antworten)", "P4 · PRISM", tk4, css4, h4p, ASSIST, js4,
     "Rechnung geöffnet. Wähle deine nächste Ansichtsaktion.")

# ── P5 Insight Motion ─────────────────────────────────────────────
tk5 = dict(bg="#0a0e14", layer="#11161f", layer2="#161d29", line="#1f2733", text="#e6eaf0",
           text2="#8a94a3", blue="#3b82f6", violet="#8b5cf6", ok="#22c55e", oktx="#4ade80", btn="#2563eb", warn="#f59e0b",
           warntx="#fbbf24", amber="#191207", rad="12px", chipbg="#f8fafc", chiptx="#0a0e14")
css5 = """
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0 0 12px}
.kpi{border:1px solid var(--ps-line);border-radius:12px;background:linear-gradient(180deg,#16202e, var(--ps-layer));padding:12px 13px}
.kpi small{font:600 9.5px var(--ps-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ps-text2)}
.kpi b{display:block;font:700 22px var(--ps-mono);margin-top:3px}
.balken{margin:8px 0 2px}
.balken .z{display:flex;justify-content:space-between;font:400 11px var(--ps-mono);color:var(--ps-text2)}
.balken .schiene{height:8px;border-radius:4px;background:var(--ps-layer2);overflow:hidden;margin-top:3px}
.balken .schiene i{display:block;height:100%;width:0;border-radius:4px}
.balken.b1 i{background:var(--ps-blue)}.balken.b2 i{background:var(--ps-violet)}.balken.b3 i{background:var(--ps-ok)}
.domlist{list-style:none;margin:6px 0 0;padding:0}
.domlist li{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px dotted var(--ps-line);font-size:12.5px}
.domlist .amp{width:8px;height:8px;border-radius:50%;background:var(--ps-text2);flex:none}
.domlist li.ok .amp{background:var(--ps-ok)}.domlist li.warn .amp{background:var(--ps-warn)}
.domlist .mini{margin-left:auto;display:flex;gap:2px}
.domlist .mini i{width:14px;height:5px;border-radius:2px;background:var(--ps-line)}
.domlist li.ok .mini i{background:#22c55e66}
"""
h5p = """
  <p class="crumb">Arbeitsplatz › Rechnungen · AP-PAN316-MATCHED-01 · geschützte Sitzung</p>
  <h1>Insight Motion — Zielbild</h1>
  <p class="sub1">Bewegung nur an echten Zahlen: Zähler laufen hoch, Balken wachsen einmal. Keine Weltkarte
     ohne Weltdaten — Domains als ehrliches Listenprofil.</p>
  <div class="kpis">
    <div class="kpi"><small>Rechnungsbetrag</small><b><span data-count="600">0</span>,00 €</b></div>
    <div class="kpi"><small>Erwarteter Betrag</small><b><span data-count="600">0</span>,00 €</b></div>
    <div class="kpi"><small>Abweichung</small><b style="color:var(--ps-ok)"><span data-count="0">0</span>,00 €</b></div>
    <div class="kpi"><small>Readback bestätigt</small><b><span data-count="14">0</span>/14</b></div>
    <div class="kpi"><small>Modellbudget heute</small><b><span data-count="62">0</span> %</b></div>
  </div>
  <article class="card"><h2>Betrags- und Mengenspiegel</h2>
    <div class="balken b1"><div class="z"><span>Rechnung</span><span>600,00 €</span></div><div class="schiene"><i data-w="100"></i></div></div>
    <div class="balken b2"><div class="z"><span>Erwartet (Bestellung 10 STK)</span><span>600,00 €</span></div><div class="schiene"><i data-w="100"></i></div></div>
    <div class="balken b3"><div class="z"><span>Abweichung</span><span>0,00 €</span></div><div class="schiene"><i data-w="2"></i></div></div>
    <p class="kette" style="margin:8px 0 0">Maßstab: je Menge 10 STK · identical bestellt/angenommen/berechnet</p>
  </article>
  <article class="card"><h2>Domains — verbundene Wirklichkeit statt Weltkarte</h2>
    <ul class="domlist">
      <li class="ok"><span class="amp"></span>Rechnungen<span class="kette">offen · AP-PAN316</span><span class="mini"><i></i><i></i><i></i></span></li>
      <li class="ok"><span class="amp"></span>Analysen<span class="kette">Bereich offen</span><span class="mini"><i></i><i></i><i></i></span></li>
      <li class="warn"><span class="amp"></span>Agent<span class="kette">lokal · geführt</span><span class="mini"><i></i><i></i><i></i></span></li>
      <li><span class="amp"></span>Projekte<span class="kette">noch nicht angebunden</span><span class="mini"><i></i><i></i><i></i></span></li>
      <li><span class="amp"></span>Dokumente<span class="kette">noch nicht angebunden</span><span class="mini"><i></i><i></i><i></i></span></li>
    </ul>
  </article>
""" + core().replace("__FLOW__", "")
js5 = """
(()=>{"use strict";
const rm=matchMedia("(prefers-reduced-motion: reduce)").matches;
document.querySelectorAll("[data-count]").forEach(el=>{
  const ziel=+el.dataset.count;
  if(rm||ziel===0){el.textContent=String(ziel);return;}
  let w=0;const schritt=Math.max(1,Math.ceil(ziel/28));
  const t=setInterval(()=>{w=Math.min(ziel,w+schritt);el.textContent=String(w);if(w>=ziel)clearInterval(t);},30);});
requestAnimationFrame(()=>document.querySelectorAll(".schiene i").forEach(i=>{
  if(!rm)i.style.transition="width 1.1s ease-out";i.style.width=i.dataset.w+"%";}));
})();"""
page("p5-insight-motion.html", "PsAI · Zielbild P5 Insight Motion (Zahlen, die sich ehrlich bewegen)", "P5 · INSIGHT", tk5, css5, h5p, ASSIST, js5,
     "Zahlen aus der Aktenlage — kein Chart ohne Daten.")
