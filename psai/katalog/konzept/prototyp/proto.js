/* PsAI Composer-Prototyp — Daten-/Funktionsschicht.
   Rendert den Workspace aus dem Deskriptor des Fachhosts; jede Tat mit Quittung und Tretspur.
   Layout/Design steuert der Deskriptor (Vorlagen/optionen) — diese Datei führt nur aus. */
(() => {
  "use strict";
  const B = "http://127.0.0.1:8097";
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const $$ = s => [...document.querySelectorAll(s)];
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hhmm = d => new Date(d).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const hhmmss = d => new Date(d).toLocaleTimeString("de-DE");

  // ── Zustand ──────────────────────────────────────────────────────────────────────────────────
  let satz = null;
  let person = localStorage.getItem("psai.person") || "jo";
  let agent = { stufe: 0, bis: null };
  let modulStatus = "registriert";
  let perspektive = ((location.hash.match(/perspektive=(\w+)/) || [, "liste"])[1]);
  let intervallSek = 30;
  let kzLetzterOk = null, kzFehler = 0, kzPausiert = false, kzBlock = false, kzTimer = null;
  let trendVersuche = 0, trendPausiert = false;
  let verbundenSeit = null;
  let rohlog = [];
  let bekannte = new Map();
  let puffer = [];
  let scrollMerker = 0, letzerAusloeser = null;

  // ── person-Overrides ─────────────────────────────────────────────────────────────────────────
  const OKey = "psai.overrides";
  const overridesLaden = () => { try { return JSON.parse(localStorage.getItem(OKey)) || {}; } catch (e) { return {}; } };
  const overridesSpeichern = o => localStorage.setItem(OKey, JSON.stringify(o));
  let blatt = null;
  const meinBlatt = () => { if (!blatt) { const o = overridesLaden(); blatt = o[person] = o[person] || { zonen: {}, reihenfolge: null, optionen: {} }; } return blatt; };
  const meinSpeichern = () => { const o = overridesLaden(); o[person] = blatt; overridesSpeichern(o); };
  const blattVerwerfen = () => { blatt = null; };

  // ── Quittung · Chronik · Tretspur ────────────────────────────────────────────────────────────
  function quitt(vor, nach) {
    const feld = $("#quitt");
    if (feld) feld.innerHTML = "Vorher: " + esc(vor) + " → <b>Nachher: " + esc(nach) + "</b> · Undo 30s · " + hhmmss(Date.now());
  }
  function chrono(tat) {
    const li = document.createElement("li");
    li.textContent = hhmmss(Date.now()) + " · " + person + ": " + tat;
    const list = $("#chronikList");
    if (list) list.prepend(li);
    const dw = document.getElementById("dwChronik");
    if (dw) dw.prepend(li.cloneNode(true));
    fetch(B + "/api/spur", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ person, tat, zeit: new Date().toISOString() }) }).catch(() => { });
  }
  window.chronoOeffentlich = chrono;

  // ── Deskriptor-Werk ──────────────────────────────────────────────────────────────────────────
  const knoten = (k, id) => !k ? null : k.id === id ? k : (k.children || []).reduce((f, c) => f || knoten(c, id), null);
  const kette = (k, id, weg = []) => { const neu = [...weg, k]; if (k.id === id) return neu; for (const c of k.children || []) { const f = kette(c, id, neu); if (f) return f; } return null; };
  const wurzel = () => satz && satz.arbeitsblatt && satz.arbeitsblatt.root;
  function wirksam(id, schluessel) {
    const pfad = kette(wurzel(), id) || [wurzel()];
    let wert, werSetzt = "unternehmen";
    for (const k of pfad) if (k.optionen && schluessel in k.optionen) { wert = k.optionen[schluessel]; werSetzt = k.id; }
    const ue = meinBlatt().zonen[id];
    if (schluessel === "theme.wahl" && ue && ue.theme) { wert = ue.theme; werSetzt = id + " (person-eigene Override, " + person + ")"; }
    return { wert, werSetzt };
  }
  const zonenKnoten = () => (knoten(wurzel(), "mandant.tenant-a").children || []).filter(k => /bereich|domaene/.test(k.typ));
  const modulKnoten = () => knoten(wurzel(), "mandant.tenant-a.domaene.finanzen.modul.pan528");
  const zonenTitel = id => id.includes("startseite") ? "Startseite" : "Finanzen (pan528)";

  // ── Warum-so ─────────────────────────────────────────────────────────────────────────────────
  function warumZeigen(id) {
    const feld = $("#warum"); if (!feld || !wurzel()) return;
    const k = knoten(wurzel(), id); if (!k) return;
    const tw = wirksam(id, "theme.wahl");
    const zeilen = ["<b>theme.wahl</b> = " + esc(tw.wert) + " — gesetzt in <code>" + esc(tw.werSetzt) + "</code>"];
    for (const p of (kette(wurzel(), id) || [])) if (p.warumSo) for (const [th, tx] of Object.entries(p.warumSo))
      zeilen.push("<small>" + esc(p.id) + " · " + esc(th) + ": " + esc(tx) + "</small>");
    zeilen.push("Reihenfolge hier: Deskriptor-Reihenfolge" + (meinBlatt().reihenfolge ? " — <b>person-eigene Sortierung</b> aktiv (" + person + ") " + meinBlatt().reihenfolge.map(zonenTitel).join(" → ") : " — keine person-eigene Sortierung"));
    zeilen.push("Sperren hier: " + ((k.sperren && k.sperren.length) ? esc(k.sperren.join(", ")) : "keine"));
    if (k.eigentum) zeilen.push("Eigentum: " + esc(k.eigentum.wer.typ) + " " + esc(k.eigentum.wer.id) + " · Rechte: " + esc(k.eigentum.rechte.join(",")));
    feld.innerHTML = zeilen.join("<br>");
  }

  // ── Agenten-Gate ─────────────────────────────────────────────────────────────────────────────
  function agentDarf() {
    if (agent.stufe === 0) return { tue: true, vermerk: "" };
    if (agent.stufe === 3) return { tue: true, vermerk: "geändert durch Agent (Stufe 3, Vollautomat)" };
    if (agent.stufe === 1) return { tue: false, vermerk: "nur vorgeschlagen (Stufe 1)" };
    const heute = new Date(new Date().toDateString());
    if (!agent.bis || new Date(agent.bis) >= heute) return { tue: true, vermerk: "geändert durch Agent (Stufe 2, Delegat bis " + (agent.bis || "unbefristet") + ")" };
    return { tue: false, vermerk: "Delegat abgelaufen (" + agent.bis + ") — unverändert" };
  }

  // ── Theme ────────────────────────────────────────────────────────────────────────────────────
  function themeSetzen(zoneId, wert, durchAgent) {
    const vor = wirksam(zoneId, "theme.wahl").wert;
    if (durchAgent) {
      const erl = agentDarf();
      if (!erl.tue) { chrono("Theme " + zoneId + " → " + wert + ": " + erl.vermerk); quitt(vor, vor + " (unverändert — " + erl.vermerk + ")"); return; }
      chrono("Theme " + zoneId + " → " + wert + ": " + erl.vermerk);
    } else chrono("Theme " + zoneId + " → " + wert);
    meinBlatt().zonen[zoneId] = Object.assign(meinBlatt().zonen[zoneId] || {}, { theme: wert });
    meinSpeichern();
    rohlog.push({ zeit: new Date().toISOString(), aktion: "theme", zone: zoneId, von: vor, nach: wert, agentStufe: agent.stufe });
    quitt(vor, wert);
    zeichne();
  }

  // ── Kennzahl ─────────────────────────────────────────────────────────────────────────────────
  let kzKlasen = "kz-wartend", kzLetzte = null;
  function kzKlasse(kl) { kzKlasen = kl; const e = $("#kz"); if (e) e.className = "card " + kl; }
  async function kzTick() {
    if (kzPausiert) return;
    try {
      const r = await fetch(B + "/api/kennzahl"); if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      kzLetzterOk = Date.now(); kzFehler = 0; kzLetzte = d; kzKlasen = "kz-bereit";
      const f = $("#kzWert");
      if (f) {
        f.textContent = d.wert;
        const m = $("#kzEinheit"); if (m) m.textContent = d.einheit;
        const meta = $("#kzMeta"); if (meta) meta.textContent = "Intervall " + intervallSek + "s · Stand " + hhmmss(d.stand);
      }
      kzKlasse("kz-bereit"); lvStand();
    } catch (e) {
      kzFehler++;
      const alt = kzLetzterOk && Date.now() - kzLetzterOk > 2000 * intervallSek;
      kzKlasse(kzFehler >= 3 ? "kz-quellfehler" : (alt ? "kz-alternd" : "kz-wartend"));
    }
    planeKz();
  }
  function planeKz() { clearTimeout(kzTimer); if (!kzPausiert) kzTimer = setTimeout(kzTick, intervallSek * 1000); }
  setInterval(() => {
    if (kzPausiert || !kzLetzterOk) return;
    if (kzFehler >= 3) kzKlasse("kz-quellfehler");
    else if (Date.now() - kzLetzterOk > 2000 * intervallSek) kzKlasse("kz-alternd");
  }, 2000);

  // ── Ticker ───────────────────────────────────────────────────────────────────────────────────
  const fokussiert = () => document.activeElement && document.activeElement.closest && document.activeElement.closest("#ticker");
  function tickerZeichnen() {
    const list = $("#tickListe"); if (!list) return;
    const alle = [...bekannte.values()].sort((a, b) => a.zeit < b.zeit ? 1 : -1);
    const zaehler = new Map();
    for (const e of alle) zaehler.set(e.gruppe, (zaehler.get(e.gruppe) || 0) + 1);
    let html = "", seen = new Set();
    for (const e of alle) {
      if (!seen.has(e.gruppe)) { seen.add(e.gruppe); html += '<li class="tick-gruppe"><span>' + esc(e.gruppe) + "</span><span>· " + zaehler.get(e.gruppe) + "</span></li>"; }
      html += "<li><time>" + hhmm(e.zeit) + "</time><b>" + esc(e.gruppe) + "</b> " + esc(e.text) + "</li>"; 
    }
    list.innerHTML = html;
  }
  async function tickPoll() {
    try {
      const r = await fetch(B + "/api/events"); if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      const neu = (d.events || []).filter(e => !bekannte.has(e.zeit + e.gruppe + e.text));
      for (const e of neu) bekannte.set(e.zeit + e.gruppe + e.text, e);
      if (neu.length) {
        if (fokussiert()) {
          puffer.push(...neu);
          const kn = $("#tickNeu"); if (kn) { kn.hidden = false; kn.textContent = puffer.length + " neue Meldungen"; }
          const ans = $("#tickAnsage"); if (ans) ans.textContent = puffer.length + " Meldungen gepuffert (Fokus hält die Stelle)";
        } else tickerZeichnen();
      }
      lvStatus("lebend"); lvStand();
    } catch (e) { lvStatus("Fehler"); }
  }

  // ── Trend ────────────────────────────────────────────────────────────────────────────────────
  async function trendLaden() {
    const feld = $("#trendBild"); if (!feld || trendPausiert) return;
    try {
      const r = await fetch(B + "/api/trend"); if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      trendVersuche = 0;
      const reihen = d.reihen.slice(0, 4);
      const wochen = Array.from({ length: d.punkte }, (_, i) => "KW" + (32 + i));
      const max = Math.ceil(Math.max(...reihen.flatMap(x => x.werte)) / 5) * 5;
      const px = i => 30 + i * (500 / (d.punkte - 1)), py = v => 120 - (v / max) * 100;
      const farben = ["#38bdf8", "#fbbf24", "#a78bfa", "#34d399"];
      const kurven = reihen.map((x, n) =>
        '<polyline fill="none" stroke="' + farben[n] + '" stroke-width="2" points="' + x.werte.map((v, i) => px(i) + "," + py(v)).join(" ") + '"/>' +
        '<text x="' + (px(11) + 6) + '" y="' + (py(x.werte[11]) + 3) + '" font-size="10" font-family="ui-monospace,monospace" fill="' + farben[n] + '">' + x.werte[11] + "</text>").join("");
      feld.innerHTML = '<div class="trend"><svg viewBox="0 0 640 140" role="img" aria-label="Trend, ' + reihen.length + ' Reihen, zuletzt: ' +
        reihen.map(x => esc(x.titel) + " " + x.werte[11]).join(", ") + '">' + kurven + "</svg></div>" +
        '<ul class="trend-legende">' + reihen.map((x, n) => '<li><i style="background:' + farben[n] + '"></i>' + esc(x.titel) + " · zuletzt " + x.werte[11] + "</li>").join("") + "</ul>" +
        "<table><caption class='kette'>Wochenwerte — dieselben Zahlen wie in der Zeichnung</caption><thead><tr><th>Woche</th>" +
        reihen.map(x => "<th>" + esc(x.titel) + "</th>").join("") + "<th>Ø</th></tr></thead><tbody>" +
        wochen.map((w, i) => "<tr><td>" + w + "</td>" + reihen.map(x => "<td>" + x.werte[i] + "</td>").join("") +
          "<td>" + Math.round(reihen.reduce((t, x) => t + x.werte[i], 0) / reihen.length) + "</td></tr>").join("") + "</tbody></table>";
      lvStand();
    } catch (e) {
      trendVersuche++;
      feld.innerHTML = "<p class='kette'>⚠ Quelle antwortet nicht — Versuch " + trendVersuche + ". " +
        '<button class="ghost" data-tp="retry" type="button">Jetzt neu versuchen</button></p>';
    }
  }

  // ── Statusleiste ─────────────────────────────────────────────────────────────────────────────
  function lvStatus(zustand) {
    const f = $("#lvStatus"); if (!f) return;
    if (zustand === "lebend") { if (!verbundenSeit) verbundenSeit = Date.now(); f.textContent = "Quelle: lebend seit " + hhmm(verbundenSeit); }
    else f.textContent = "Quelle: Fehler seit " + hhmm(Date.now());
  }
  function lvStand() { const f = $("#lvStand"); if (f) f.textContent = "Stand " + hhmmss(Date.now()); }
  async function statusLaden() { try { const r = await fetch(B + "/api/status"); if (!r.ok) throw 0; lvStatus("lebend"); } catch (e) { lvStatus("Fehler"); } lvStand(); }

  // ── Perspektiven ─────────────────────────────────────────────────────────────────────────────
  async function perspektiveZeichnen() {
    const feld = $("#modulPers"); if (!feld) return;
    $$(".pers button[data-pers]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.pers === perspektive)));
    if (perspektive === "liste") {
      feld.innerHTML = '<div class="betrag" id="betrag">' +
        "<div><small>Beleg 4711 · Nordstahl</small><b>18.240,00 €</b></div>" +
        "<div><small>Beleg 4712 · Velta</small><b>2.910,50 €</b></div>" +
        "<div><small>Beleg 4713 · Aurelis</small><b>640,00 €</b></div></div>" +
        '<p class="kette">3 von 132 offenen Posten · <span class="badge-ok">AI-Vorschlag angenommen</span></p>';
    } else if (perspektive === "vergleich") {
      feld.innerHTML = "<table><caption class='kette'>Dasselbe Ereignis in zwei Zeitlinsen</caption><thead><tr><th>Feld</th><th>Vorher</th><th>Nachher</th></tr></thead><tbody>" +
        "<tr><td>Geprüft</td><td>86 Rechnungen</td><td>93 Rechnungen</td></tr>" +
        "<tr><td>Durchlaufzeit</td><td>31,7 h</td><td>28,3 h</td></tr>" +
        "<tr><td>Abweichungen</td><td>6,9 %</td><td>5,4 %</td></tr></tbody></table>";
    } else {
      feld.innerHTML = "<p class='kette'>Modul-Rohlog (diese Fläche):</p><pre id='rohlogModul' style='font:400 10.5px ui-monospace,monospace;overflow:auto;max-height:180px' tabindex='0'>" +
        JSON.stringify(rohlog, null, 2) + "</pre><p class='kette'>Host-Spur (was der Host über alle Flächen weiß):</p><pre id='rohlogHost' style='font:400 10.5px ui-monospace,monospace;overflow:auto;max-height:180px' tabindex='0'>lädt…</pre>";
      try {
        const spuren = await (await fetch(B + "/api/spur?seit=50")).json();
        const f2 = $("#rohlogHost");
        if (f2) f2.textContent = JSON.stringify((spuren.spuren || []).slice(-8), null, 2);
      } catch (e) { const f2 = $("#rohlogHost"); if (f2) f2.textContent = "Host nicht erreichbar"; }
    }
  }
  function perspektiveWechsel(n) {
    perspektive = n;
    history.replaceState(null, "", "#perspektive=" + n);
    if (n === "rohlog" && window.biUmbauen && document.getElementById("biFlaeche")) window.biUmbauen(false);
    perspektiveZeichnen();
  }

  // ── Zonen ────────────────────────────────────────────────────────────────────────────────────
  function reihenfolge() {
    const basis = zonenKnoten().map(k => k.id);
    const ue = meinBlatt().reihenfolge;
    if (!ue) return basis;
    return [...basis].sort((a, b) => (ue.indexOf(a) < 0 ? 99 : ue.indexOf(a)) - (ue.indexOf(b) < 0 ? 99 : ue.indexOf(b)));
  }
  function zoneKopf(k, istFinanzen) {
    const theme = wirksam(k.id, "theme.wahl").wert;
    const auswahl = '<select data-theme="' + esc(k.id) + '" aria-label="Theme für Zone ' + zonenTitel(k.id) + '">' +
      ["essential-2d", "pulse", "orbit"].map(t => '<option value="' + t + '"' + (t === theme ? " selected" : "") + ">" + t + "</option>").join("") + "</select>";
    const buttons = '<button class="ghost" data-hoch="' + esc(k.id) + '" aria-label="Zone höher anordnen" type="button">↑</button>' +
      '<button class="ghost" data-runter="' + esc(k.id) + '" aria-label="Zone tiefer anordnen" type="button">↓</button>' + auswahl +
      '<button class="ghost" data-warum="' + esc(k.id) + '" type="button">Warum so?</button>' +
      '<button class="ghost" data-toggle="' + esc(k.id) + '" type="button">Zone aus</button>' +
      (istFinanzen ? '<button id="undoBtn" class="ghost" type="button" hidden>Rückgängig (Modul)</button>' : "");
    return '<header class="zone-head"><b>' + zonenTitel(k.id) + "</b>" +
      '<span class="tid">' + ((k.vorlagen.find(v => v.schicht === "layout") || {}).katalogId || "layout") + "</span>" +
      '<span class="tid">theme.' + esc(theme) + "</span>" +
      (istFinanzen ? '<div class="actions">' : '<div class="aktionen" style="margin-left:auto;display:flex;gap:6px;align-items:center">') +
      buttons + "</div></header>";
  }
  function startseiteInhalt() {
    return '<div class="card" id="kz"><small style="font:600 9px var(--mono);letter-spacing:.1em;color:var(--z-text2)">KENNZAHL · LIVE-QUELLE</small><br>' +
      '<b id="kzWert" style="font:700 26px var(--mono)">–</b> <small id="kzEinheit" style="color:var(--z-text2)">…</small>' +
      '<p class="kette" id="kzMeta">wartet auf ersten Tick</p>' +
      '<div class="tick-neu-wrap"><label style="font:600 10px var(--mono);color:var(--z-text2)">Intervall <select id="kzSel">' +
      [5, 10, 30, 60].map(s => '<option value="' + s + '"' + (s === intervallSek ? " selected" : "") + ">" + s + "s</option>").join("") +
      '</select></label><button class="ghost" data-kz="pause" type="button">' + (kzPausiert ? "Weiter" : "Pause") + "</button>" +
      '<button class="ghost" data-kz="fail" type="button">' + (kzBlock ? "Quelle freigeben" : "Quelle blockieren") + "</button></div></div>" +
      '<section id="ticker" tabindex="0" aria-label="Betriebsmeldungen" class="card"><b>Betriebsmeldungen</b>' +
      '<div class="tick-neu-wrap"><button id="tickNeu" type="button" hidden>0 neue Meldungen</button><output id="tickAnsage" aria-live="polite"></output></div>' +
      '<ul id="tickListe" class="tick-liste" aria-live="off" tabindex="0"></ul></section>';
  }
  function finanzenInhalt() {
    return '<div class="card" id="modulCard">' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>Belegprüfung pan528</b>' +
      '<span class="badge-ok" id="modulStatus">' + modulStatus + "</span>" +
      '<span class="kette">Funktionsschicht · Manifest modul.pan528 · Intervall ' + intervallSek + "s</span></div>" +
      '<div id="modulInhalt">' +
      '<div class="pers" role="group" aria-label="Perspektive">' +
      '<button data-pers="liste" aria-pressed="false" type="button">Liste</button>' +
      '<button data-pers="vergleich" aria-pressed="false" type="button">Vergleich</button>' +
      '<button data-pers="rohlog" aria-pressed="false" type="button">Rohlog</button>' +
      '<button data-mod="laden" class="ghost" type="button">aktualisieren</button>' +
      '<button data-mod="entf" class="ghost" type="button">Modul entfernen</button></div>' +
      '<div style="display:flex;gap:6px;align-items:center"><span class="kette">Trend (Wochen)</span>' +
      '<button class="ghost" data-tp="pause" type="button">' + (trendPausiert ? "Weiter" : "Pause") + "</button></div>" +
      '<div id="trendBild"><p class="kette">lädt…</p></div>' +
      '<div id="modulPers" role="region" aria-label="Modulansicht" tabindex="0"></div>' +
      "</div></div>";
  }

  function zeichne() {
    if (!satz) return;
    const zonenFeld = $("#zonen"); if (!zonenFeld) return;
    const marke = wirksam(wurzel().id, "marke.name").wert;
    const mEl = $("#marke"); if (mEl && marke) mEl.textContent = marke;
    const blatt = meinBlatt();
    let html = "";
    for (const id of reihenfolge()) {
      const k = knoten(wurzel(), id); if (!k) continue;
      if (blatt.zonen[id] && blatt.zonen[id].aus) continue;
      const istFinanzen = id.includes("finanzen");
      const theme = wirksam(id, "theme.wahl").wert;
      html += '<section class="zone" data-zone="' + esc(id) + '">' + zoneKopf(k, istFinanzen) +
        '<div class="zone-body theme-' + esc(theme) + '" data-body="' + esc(id) + '">' +
        (istFinanzen ? finanzenInhalt() : startseiteInhalt()) + "</div></section>";
    }
    zonenFeld.innerHTML = html;
    kzKlasse(kzKlasen);
    if (kzLetzte) {
      const f0 = $("#kzWert"); if (f0) f0.textContent = kzLetzte.wert;
      const e0 = $("#kzEinheit"); if (e0) e0.textContent = kzLetzte.einheit;
    }
    const nav = $("#navList");
    if (nav) nav.innerHTML = reihenfolge().map((id, n) =>
      '<button data-nav="' + id + '" aria-pressed="' + (n === 0) + '" type="button">' + zonenTitel(id) + "</button>").join("");
    const st = $("#statusLine"); if (st) st.textContent = "Deskriptor geladen · " + zonenKnoten().length + " Zonen · Person " + person;
    perspektiveZeichnen();
    tickerZeichnen();
    if (document.getElementById("trendBild") && !trendPausiert) trendLaden();
  }

  // ── Modul-Lebenszyklus ───────────────────────────────────────────────────────────────────────
  function modulLaden() {
    const vor = modulStatus; modulStatus = "geladen";
    const badge = $("#modulStatus"); if (badge) badge.textContent = modulStatus;
    const st = $("#statusLine"); if (st) st.textContent = "Modul pan528: geladen (Intervall " + intervallSek + "s)";
    rohlog.push({ zeit: new Date().toISOString(), aktion: "laden", agentStufe: agent.stufe, quelle: "B" });
    quitt(vor, "geladen"); chrono("Modul pan528 aktualisiert");
    trendLaden();
  }
  function modulEntfernen() {
    const karte = $("#modulCard"); if (!karte) return;
    karte.remove(); modulStatus = "entfernt";
    const ub = $("#undoBtn"); if (ub) ub.hidden = false;
    const st = $("#statusLine"); if (st) st.textContent = "Modul entfernt — Undo-Fenster 30s";
    rohlog.push({ zeit: new Date().toISOString(), aktion: "entfernt", agentStufe: agent.stufe });
    quitt("geladen", "entfernt"); chrono("Modul pan528 entfernt");
    setTimeout(() => { const b = $("#undoBtn"); if (b) b.hidden = true; }, 30000);
  }
  function modulUndo() {
    modulStatus = "registriert";
    const body = document.querySelector('[data-body="mandant.tenant-a.domaene.finanzen"]');
    if (body) body.innerHTML = finanzenInhalt();
    const ub = $("#undoBtn"); if (ub) ub.hidden = true;
    rohlog.push({ zeit: new Date().toISOString(), aktion: "undo", agentStufe: agent.stufe });
    quitt("entfernt", "registriert"); chrono("Entfernung zurückgenommen (Undo)");
    perspektiveZeichnen(); trendLaden();
  }

  // ── Geführter Erststart ──────────────────────────────────────────────────────────────────────
  function erststart() {
    if (document.getElementById("tour")) return;
    const schritte = ["Kennzahl live beobachten — sie kommt aus der Fachschicht",
      "Theme der Startseite vergleichen — Design ist Zonen-Mosaik",
      "Chronik im Drawer öffnen — jede Tat bleibt lesbar"];
    const tour = document.createElement("div");
    tour.id = "tour"; tour.setAttribute("role", "region"); tour.setAttribute("aria-label", "Geführter Erststart");
    tour.style.cssText = "position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:30;border:1px solid var(--ps-line);border-radius:10px;background:var(--ps-layer);padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:min(560px,92vw)";
    tour.innerHTML = "<b>Geführter Erststart · Rolle " + person + "</b><ol>" +
      schritte.map((s, n) => "<li" + (n === 0 ? ' aria-current="step"' : "") + ">" + s + "</li>").join("") + "</ol>" +
      '<button id="tourWeiter" type="button">Weiter</button> <button id="tourAbbr" class="ghost" type="button">Abbrechen</button>';
    document.body.appendChild(tour);
    let n = 0;
    const marker = () => $$("#tour ol li").forEach((li, i) => { if (i === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current"); });
    $("#tourWeiter").onclick = () => {
      n++;
      if (n === 2) drawerAuf();
      if (n < schritte.length) { marker(); return; }
      const t = document.getElementById("tour"); if (t) t.remove();
      drawerZu();
      chrono("Erststart Rolle " + person + " abgeschlossen");
      quitt("unorientiert", "Erststart " + schritte.length + " Schritte durchlaufen");
    };
    $("#tourAbbr").onclick = () => { tour.remove(); chrono("Erststart abgebrochen"); };
  }

  // ── Drawer ───────────────────────────────────────────────────────────────────────────────────
  function drawerBauen() {
    const d = document.createElement("div");
    d.id = "drawer"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    d.setAttribute("aria-label", "Chronik und Quittungen"); d.hidden = true;
    d.innerHTML = '<div style="padding:14px"><b>Chronik-Drawer</b> <button id="dwZu" class="ghost" type="button" style="float:right">Schließen</button>' +
      '<p class="kette" style="clear:both">Jede Tat mit Quittung — hier nachlesbar, auch nach Neuladen des Rahmens.</p>' +
      '<ol id="dwChronik" style="font:400 11.5px var(--sans)"></ol>' +
      '<button class="ghost" data-dw-rueck type="button">Zum Inhalt zurück</button></div>';
    document.body.appendChild(d);
    d.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); drawerZu(); }
      if (e.key === "Tab") {
        const f = [...d.querySelectorAll("button,[href],input,select,[tabindex]:not([tabindex='-1'])")];
        if (!f.length) return;
        const erster = f[0], letzter = f[f.length - 1];
        if (e.shiftKey && document.activeElement === erster) { e.preventDefault(); letzter.focus(); }
        else if (!e.shiftKey && document.activeElement === letzter) { e.preventDefault(); erster.focus(); }
      }
    });
  }
  function drawerAuf() {
    const d = $("#drawer"); if (!d || !d.hidden) return;
    scrollMerker = window.scrollY; letzerAusloeser = document.activeElement;
    d.hidden = false;
    document.querySelector("header").inert = true;
    document.querySelector(".layout").inert = true;
    $("#dwZu").focus();
  }
  function drawerZu() {
    const d = $("#drawer"); if (!d || d.hidden) return;
    d.hidden = true;
    document.querySelector("header").inert = false;
    document.querySelector(".layout").inert = false;
    window.scrollTo(0, scrollMerker);
    const zurueck = (letzerAusloeser && document.contains(letzerAusloeser)) ? letzerAusloeser : $("#dwBtn");
    if (zurueck) zurueck.focus();
  }
  window.drawerAuf = drawerAuf; window.drawerZu = drawerZu;

  // ── Haut (Skin) ──────────────────────────────────────────────────────────────────────────────
  const haette = [["Klar", []], ["Puls", ["skin-pulse"]], ["Orbit", ["skin-pulse", "skin-orbit"]]];
  const hautIndex = () => {
    const hat = [...document.body.classList].filter(c => c.startsWith("skin-"));
    return Math.max(0, haette.findIndex(h => h[1].length === hat.length && h[1].every(c => hat.includes(c))));
  };
  function hautBeschriften() { const k = $("#hautKnopf"); if (k) k.textContent = "Haut: " + haette[hautIndex()][0]; }
  function hautWechsel() {
    const i = (hautIndex() + 1) % haette.length;
    document.body.classList.remove("skin-pulse", "skin-orbit");
    haette[i][1].forEach(c => document.body.classList.add(c));
    hautBeschriften();
    chrono("Haut gewechselt → " + haette[i][0]);
    quitt("Haut " + haette[hautIndex() === i ? (i + 2) % 3 : hautIndex()][0], "Haut " + haette[i][0]);
  }

  // ── Kopf ─────────────────────────────────────────────────────────────────────────────────────
  function kopfBauen() {
    const h = document.querySelector("header");
    h.insertAdjacentHTML("afterbegin",
      '<label style="font:600 9px var(--mono);color:var(--ps-text2)">Sicht <select id="personSel">' +
      ["jo", "sachbearbeitung", "nachtwache"].map(p => '<option value="' + p + '"' + (p === person ? " selected" : "") + ">" + p + "</option>").join("") + "</select></label>" +
      '<button id="erststart" class="ghost" type="button">Geführter Erststart</button>' +
      '<button id="dwBtn" class="ghost" type="button">Chronik-Drawer</button>' +
      '<button id="hautKnopf" class="ghost" type="button">Haut</button>');
    hautBeschriften();
    const as = document.querySelector("aside.as");
    as.insertAdjacentHTML("beforeend", '<h2>Agent</h2><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<label style="font:600 10px var(--mono);color:var(--ps-text2)">Stufe <select id="agStufe">' +
      [[0, "0 · kein Agent"], [1, "1 · Vorschlag"], [2, "2 · Delegat"], [3, "3 · Vollautomat"]].map(([w, t]) => '<option value="' + w + '">' + t + "</option>").join("") +
      '</select></label><label style="font:600 10px var(--mono);color:var(--ps-text2)">Delegat bis <input type="date" id="agBis" style="font:400 12px var(--sans)"></label></div>');
  }

  // ── Taten ────────────────────────────────────────────────────────────────────────────────────
  document.addEventListener("change", e => {
    const el = e.target;
    if (el.matches && el.matches("[data-theme]")) themeSetzen(el.dataset.theme, el.value, agent.stufe > 0);
    else if (el.id === "personSel") { person = el.value; localStorage.setItem("psai.person", person); blattVerwerfen(); chrono("Sicht gewechselt → " + person); zeichne(); }
    else if (el.id === "kzSel") {
      intervallSek = Number(el.value);
      meinBlatt().optionen = Object.assign(meinBlatt().optionen || {}, { "mandant.tenant-a.domaene.finanzen.modul.pan528": { "live.intervallSek": intervallSek } });
      meinSpeichern();
      rohlog.push({ zeit: new Date().toISOString(), aktion: "intervall", sek: intervallSek, agentStufe: agent.stufe });
      quitt("Intervall 30s", intervallSek + "s (Override " + person + ")"); chrono("Intervall der Kennzahl auf " + intervallSek + "s gesetzt");
      planeKz();
    }
    else if (el.id === "agStufe") { agent.stufe = Number(el.value); chrono("Agenten-Stufe auf " + agent.stufe + " gesetzt"); }
    else if (el.id === "agBis") { agent.bis = el.value || null; }
    }, true);
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-nav],[data-warum],[data-toggle],[data-hoch],[data-runter],[data-pers],[data-mod],[data-kz],[data-tp],#undoBtn,#erststart,#dwBtn,#hautKnopf,#resetBtn,#tickNeu,#dwZu,[data-dw-rueck]");
    if (!t) return;
    if (t.dataset.dwRueck !== undefined || t.id === "dwZu") { drawerZu(); }
    else if (t.dataset.nav) {
      $$("nav button[data-nav]").forEach(b => b.setAttribute("aria-pressed", String(b === t)));
      const ziel = document.querySelector('[data-body="' + t.dataset.nav + '"]');
      if (ziel) ziel.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
      chrono("Navigation → " + t.dataset.nav);
    }
    else if (t.dataset.warum) warumZeigen(t.dataset.warum);
    else if (t.dataset.toggle) {
      const id = t.dataset.toggle;
      meinBlatt().zonen[id] = Object.assign(meinBlatt().zonen[id] || {}, { aus: true });
      meinSpeichern(); quitt("Zone " + zonenTitel(id) + " sichtbar", "Zone aus (person " + person + ")");
      chrono("Zone " + zonenTitel(id) + " ausgeblendet"); zeichne();
    }
    else if (t.dataset.hoch || t.dataset.runter) {
      const id = t.dataset.hoch || t.dataset.runter;
      const ab = reihenfolge(); const vorher = ab.slice(); const i = ab.indexOf(id); const j = t.dataset.hoch ? i - 1 : i + 1;
      if (i >= 0 && j >= 0 && j < ab.length) { const x = ab[i]; ab[i] = ab[j]; ab[j] = x; }
      meinBlatt().reihenfolge = ab; meinSpeichern();
      rohlog.push({ zeit: new Date().toISOString(), aktion: "sortierung", zone: id, agentStufe: agent.stufe });
      quitt(vorher.map(zonenTitel).join(" → "), ab.map(zonenTitel).join(" → "));
      chrono("Zone " + zonenTitel(id) + (t.dataset.hoch ? " höher" : " tiefer") + " angeordnet"); zeichne();
    }
    else if (t.dataset.pers) perspektiveWechsel(t.dataset.pers);
    else if (t.dataset.mod === "laden") modulLaden();
    else if (t.dataset.mod === "entf") modulEntfernen();
    else if (t.id === "undoBtn") modulUndo();
    else if (t.dataset.kz === "pause") {
      kzPausiert = !kzPausiert; t.textContent = kzPausiert ? "Weiter" : "Pause";
      rohlog.push({ zeit: new Date().toISOString(), aktion: kzPausiert ? "pausiert" : "weiter", agentStufe: agent.stufe });
      quitt(kzPausiert ? "läuft" : "pausiert", kzPausiert ? "pausiert" : "läuft");
      chrono(kzPausiert ? "Kennzahl pausiert" : "Kennzahl weiter");
      if (kzPausiert) clearTimeout(kzTimer); else { kzTick(); planeKz(); }
    }
    else if (t.dataset.kz === "fail") {
      kzBlock = !kzBlock; t.textContent = kzBlock ? "Quelle freigeben" : "Quelle blockieren";
      fetch(B + "/mock/fail?on=" + (kzBlock ? 1 : 0)).then(() => { if (!kzBlock) { kzFehler = 0; kzTick(); } }).catch(() => { });
      chrono("Quelle " + (kzBlock ? "blockiert" : "freigegeben"));
    }
    else if (t.dataset.tp === "pause") {
      trendPausiert = !trendPausiert; t.textContent = trendPausiert ? "Weiter" : "Pause";
      quitt(trendPausiert ? "pausiert" : "läuft", trendPausiert ? "läuft" : "pausiert");
      chrono("Trend " + (trendPausiert ? "pausiert" : "fortgesetzt"));
      if (!trendPausiert) trendLaden();
    }
    else if (t.dataset.tp === "retry") { trendVersuche = 0; trendLaden(); }
    else if (t.id === "erststart") erststart();
    else if (t.id === "dwBtn") drawerAuf();
    else if (t.id === "hautKnopf") hautWechsel();
    else if (t.id === "tickNeu") {
      const n = puffer.length; puffer.splice(0); tickerZeichnen();
      t.hidden = true;
      const ans = $("#tickAnsage"); if (ans) ans.textContent = "";
      quitt("Puffer " + n, "0 im Puffer"); chrono("Ticker-Puffer übernommen (" + n + ")");
    }
    else if (t.id === "resetBtn") {
      const o = overridesLaden(); delete o[person]; overridesSpeichern(o); blattVerwerfen();
      chrono("Eigene Änderungen verworfen (" + person + ")");
      quitt("person-eigene Overrides", "Deskriptor-Grundzustand"); zeichne();
    }
  });
  document.addEventListener("keydown", e => { const d = $("#drawer"); if (e.key === "Escape" && d && !d.hidden) drawerZu(); });

  // ── Inhaltssstrom ────────────────────────────────────────────────────────────────────────────
  window.__strom = { an: false, quelle: B };
  function satzHolen() {
    fetch(B + "/api/deskriptor").then(r => r.json()).then(d => {
      satz = d;
      const ue = (meinBlatt().optionen || {})["mandant.tenant-a.domaene.finanzen.modul.pan528"];
      const mod = modulKnoten();
      if (ue && ue["live.intervallSek"]) intervallSek = ue["live.intervallSek"];
      else if (mod && mod.optionen) intervallSek = mod.optionen["live.intervallSek"] || intervallSek;
      zeichne();
    }).catch(() => { });
  }
  function stromStart() {
    try {
      const es = new EventSource(B + "/strom");
      es.onopen = () => { window.__strom.an = true; };
      window.__strom.an = true;
      es.addEventListener("inhalt", ev => {
        const d = JSON.parse(ev.data || "{}");
        if (d.art === "ticker") tickPoll();
        else if (d.art === "kpi") kzTick();
        else if (d.art === "trend") trendLaden();
        else if (d.art === "status") statusLaden();
        else if (d.art === "spur") { if (perspektive === "rohlog") perspektiveZeichnen(); }
        else if (d.art === "satz") satzHolen();
      });
      window.__strom.es = es;
    } catch (e) { }
  }

  window.__tick = { poll: tickPoll, trend: trendLaden, status: statusLaden };

  // ── Start ────────────────────────────────────────────────────────────────────────────────────
  kopfBauen(); drawerBauen(); stromStart();
  satzHolen();
  kzTick(); tickPoll(); trendLaden(); statusLaden();
  setInterval(() => { if (!trendPausiert) trendLaden(); }, 20000);
})();
