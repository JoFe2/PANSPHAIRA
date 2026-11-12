// Zeiger-Overlay: ein künstlicher Mauszeiger, der über echte Elemente wandert und klickt.
// Eigene Datei, eigener Namespace — der Prototyp-Code bleibt unberührt. reduced-motion heilig.
(function () {
  var ZEIGER = document.createElement("div");
  ZEIGER.id = "zeigeZeiger";
  ZEIGER.setAttribute("aria-hidden", "true");
  ZEIGER.style.cssText = "position:fixed;z-index:2147483000;width:22px;height:22px;pointer-events:none;" +
    "left:-50px;top:-50px;transition:left .9s cubic-bezier(.2,.7,.2,1),top .9s cubic-bezier(.2,.7,.2,1);" +
    "filter:drop-shadow(0 0 6px rgba(56,189,248,.9));will-change:left,top";
  ZEIGER.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 8-7 2-3 7z" fill="#e8eef7" stroke="#38bdf8" stroke-width="1.5"/></svg>';
  document.body.appendChild(ZEIGER);

  var BLASE = document.createElement("div");
  BLASE.id = "zeigeBlase";
  BLASE.setAttribute("role", "status");
  BLASE.style.cssText = "position:fixed;z-index:2147483001;pointer-events:none;max-width:260px;" +
    "font:600 11px/1.4 ui-monospace,monospace;color:#7dd3fc;background:rgba(8,47,73,.92);" +
    "border:1px solid #164e63;border-radius:8px;padding:5px 9px;left:-50px;top:-50px;opacity:0;" +
    "transition:opacity .3s";
  document.body.appendChild(BLASE);

  function reduziert() { return matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function warte(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // Zielort: Mitte des Elements im sichtbaren Bereich. Ohne Sanftscrollen bleibt die Rechenbasis ruhig.
  function ort(el) {
    el.scrollIntoView({ block: "center", behavior: "auto" });
    var rect = el.getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  }

  async function hin(el, spruch) {
    var z = ort(el);
    ZEIGER.style.left = (z.x - 4) + "px";
    ZEIGER.style.top = (z.y - 4) + "px";
    if (spruch) blaseZeigt(spruch);
    await warte(reduziert() ? 60 : 950);
  }

  function glow(el) {   // Glow ZUERST: das Ziel leuchtet, bevor der Zeiger ankommt
    el.classList.add("zeigerGlow");
    return warte(reduziert() ? 60 : 600);
  }

  function blaseZeigt(textwert) {   // Blase am Zeiger, aber nie über den linken Rand gerollt
    var b = Math.min(Math.max(parseInt(ZEIGER.style.left || "0", 10) + 22, 6), innerWidth - BLASE.offsetWidth - 8);
    BLASE.style.left = b + "px";
    BLASE.textContent = textwert;
    BLASE.style.opacity = "1";
  }

  function rueckzug() {
    ZEIGER.style.left = "-50px"; ZEIGER.style.top = "-50px";
    BLASE.style.opacity = "0";
    document.querySelectorAll(".zeigerGlow").forEach(function (e) { e.classList.remove("zeigerGlow"); });
  }

  function finde(textwert) {
    var alle = Array.prototype.slice.call(document.querySelectorAll("button,a,[role=button]"));
    return alle.filter(function (e) { return e.textContent.trim().includes(textwert); })[0];
  }

  // ---- Zustand -------------------------------------------------------------------------------
  // running:     es läuft genau ein Durchgang (über Pausen und Rundenwechsel hinweg)
  // pauseWachen: beenden eine laufende Rundenpause sofort
  // eignerKlick: der Klick, den die Führung gerade selbst auslöst — zählt nicht als Übernahme
  // folge:       Nummern-Stempel; jeder Eingriff erhöht ihn und entwertet den laufenden Durchgang
  // Tour kommt aus tour.json (Agent schreibt sie um wie ein Werkzeug), Ziel ist ein Text-/Selector-
  // Verweis — die Geometrie berechnet der Client. Fehlt die Datei, führt die Default-Strecke.
  var DEFAULT_TOUR = { schritte: [
    { ziel: "Finanzen (pan528)", spruch: "Klicke: „Finanzen (pan528)“" },
    { ziel: "aktualisieren", spruch: "Klicke: „aktualisieren“" },
    { ziel: "Chronik-Drawer", spruch: "Klicke: „Chronik-Drawer“" }
  ] };
  var tour = DEFAULT_TOUR;
  var running = false, schleife = false, eignerKlick = null, folge = 0, pauseWachen = [];

  function tourLaden() {   // in jeder Runde neu: der Agent kann den Weg zwischen zwei Runden umlegen
    return fetch("/psai/katalog/live/tour.json?ums=" + Date.now(), { cache: "no-store" })
      .then(function (a) { return a.ok ? a.json() : Promise.reject(); })
      .then(function (d) { if (d && Array.isArray(d.schritte) && d.schritte.length) tour = d; })
      .catch(function () { tour = DEFAULT_TOUR; });
  }

  function elementeMelden() {   // Werkzeugliste für den Agenten: was lässt sich hier gerade bedienen?
    var namen = Array.prototype.slice.call(document.querySelectorAll("button,a,[role=button]"))
      .map(function (e) { return e.textContent.trim().replace(/\s+/g, " ").slice(0, 40); })
      .filter(function (t, i, alle) { return t && alle.indexOf(t) === i; });
    try { fetch("/werkbank/elemente", { method: "POST", body: JSON.stringify(namen) }); } catch (e) {}
  }

  function elementZu(ziel) {   // Textverweis zuerst, CSS-Klassenzeichen zweitrangig
    var el = finde(ziel);
    if (!el && /^[.#]/.test(ziel)) el = document.querySelector(ziel);
    return el;
  }

  function schleifeSet(an) {
    schleife = an;
    try {   // eigener Schlüssel für von Hand gestartete Läufe; der alte Schlüssel durfte vom Auto-Modus stammen
      sessionStorage.setItem("zeiger.schleife.manuell", an ? "1" : "0");
      sessionStorage.removeItem("zeiger.schleife");
    } catch (e) { }
    start.textContent = an ? "Zeigerführung aus" : "Zeigerführung ansehen";
  }

  function abschalten() {              // Ende in jeder Phase: Zähler herauf, Wächter wecken, Zeichen zurückziehen
    folge += 1;                        // entwerten jeden laufenden Durchgang, auch mitten in der Pause
    running = false;
    schleifeSet(false);
    pauseWachen.splice(0).forEach(function (w) { w(); });
    rueckzug();
  }

  function pausiere(ms) {              // Rundenpause, die auf Umschalten und Übernahme sofort reagiert
    return new Promise(function (r) {
      pauseLaeuft = true;
      var t = setTimeout(function () { pauseLaeuft = false; r(); }, ms);
      pauseWachen.push(function () { pauseLaeuft = false; clearTimeout(t); r(); });
    });
  }

  // ---- Strom-Hörer -----------------------------------------------------------------------------
  // Der Zeiger fragt nichts ab: er hört. Neue Inhalte (Geber/Broker) holen seinen Blick —
  // aber nur, wenn gerade Pause ist oder er nichts tut; mitten im Schritt funkelt nichts dazwischen.
  // Auch die Tour-Umschreibung kommt als Ereignis (tour- Halt vom Werksbank-Server).
  var BROKER = (typeof localStorage !== "undefined" && localStorage.getItem("psai.proto.broker")) || "http://127.0.0.1:8097";
  var INHALT_ZIEL = { ticker: "#ticker", kpi: "#kz", trend: "#trendBild" };
  var INHALT_SPRUCH = { ticker: "Neue Meldung — hier im Ticker", kpi: "Kennzahl frisch vom Fachhost", trend: "Trendfortschreibung eingetroffen" };
  var blicke = [], blickLaeuft = false, pauseLaeuft = false;

  async function blick(art, meinTakt) {   // hinsehen, leuchten, vorzeigen — KEIN Klick
    var ziel = INHALT_ZIEL[art]; if (!ziel || blickLaeuft) return;
    var el = document.querySelector(ziel); if (!el) return;
    blickLaeuft = true;
    await glow(el);
    await hin(el, INHALT_SPRUCH[art]);
    await warte(reduziert() ? 60 : 900);
    if (meinTakt === undefined || meinTakt === folge) rueckzug();
    blickLaeuft = false;
  }

  function inhaltGekommen(art) {
    if (!INHALT_ZIEL[art]) return;
    if (!running && schleife && !reduziert() && !pauseLaeuft) { blick(art); return; }   // rundenloser Leerlauf
    if (running) {                     // mitten im Lauf: gemerkt wird der Blick in jedem Fall —
      if (blicke.indexOf(art) < 0) blicke.push(art);   // einer hinter dem anderen, nichts überdeckt nichts
      if (pauseLaeuft) pauseWachen.splice(0).forEach(function (w) { w(); });
    }
  }

  try {
    var brokerStrom = new EventSource(BROKER + "/strom");
    brokerStrom.addEventListener("inhalt", function (ev) {
      try { inhaltGekommen(JSON.parse(ev.data).art); } catch (e) { }
    });
  } catch (e) { }

  try {
    var werkbankStrom = new EventSource("/werkbank/strom");
    werkbankStrom.addEventListener("tour", function () {   // Agent hat den Weg umgeschrieben: zügig neue Runde
      if (running && pauseLaeuft) pauseWachen.splice(0).forEach(function (w) { w(); });
    });
  } catch (e) { }

  async function durchgang(meinTakt) {
    await tourLaden();                          // der Agent darf den Weg zwischen den Runden umlegen
    elementeMelden();                           // und sieht beim nächsten Mal, was hier bedienbar ist
    for (var i = 0; i < tour.schritte.length; i++) {
      if (meinTakt !== folge) return;
      var schritt = tour.schritte[i];
      var el = elementZu(schritt.ziel);
      if (!el) continue;
      await glow(el);
      await hin(el, schritt.spruch || ("Klicke: „" + schritt.ziel + "“"));
      if (meinTakt !== folge) return;
      eignerKlick = el;                // vor dem Klick gemerkt: der Hörer sieht ihn als unseren
      try { el.click(); } finally { eignerKlick = null; }
      await warte(reduziert() ? 60 : (schritt.warte || 700));
    }
    if (meinTakt !== folge) return;
    if (!schleife) { blaseZeigt("Fertig — du bist dran."); return; }   // einmalig: bleibt stehen
    blaseZeigt("Gleich noch mal — oder einfach selbst klicken");
    await pausiere(2600);
    if (meinTakt !== folge) { blaseZeigt("Fertig — du bist dran."); return; }   // in der Pause abgeschaltet: sauber melden
    if (!schleife) { blaseZeigt("Fertig — du bist dran."); return; }
    while (blicke.length) {                     // der Strom hat gewartet: erst vorzeigen, dann führen
      var art = blicke.shift();
      await blick(art, meinTakt);
      if (meinTakt !== folge) return;
    }
    rueckzug();
    await warte(900);
    if (meinTakt !== folge || !schleife) return;  // übernommen oder ausgeschaltet: abschalten hat alles geräumt
    return durchgang(meinTakt);                   // nächste Runde — mit dann frischer Tour-Datei
  }

  function starte() {
    if (running) return;
    running = true;
    var meinTakt = ++folge;
    schleifeSet(true);
    durchgang(meinTakt).catch(function () { if (meinTakt === folge) running = false; });
  }

  // ---- Der eine Knopf: umschalten, in jeder Phase ---------------------------------------------
  var start = document.createElement("button");
  start.id = "zeigeStart";
  start.type = "button";
  start.className = "ghost";
  start.textContent = "Zeigerführung ansehen";
  start.style.cssText = "position:fixed;right:12px;bottom:34px;z-index:2147483002";
  start.addEventListener("click", function () {
    if (running || schleife) { abschalten(); } else { starte(); }   // Aus in jeder Phase / An für neuen Lauf
  });
  document.body.appendChild(start);

  // ---- Ein einziger Übernahme-Hörer ------------------------------------------------------------
  // Läuft in der Erfasserphase, also VOR jedem Seiten-Klick: ein Klick auf das gezeigte Ziel gilt
  // als Nachmachen, jeder andere echte Handgriff als Übernahme. Der Umschalter entscheidet selbst.
  document.addEventListener("click", function (e) {
    if (!running) return;                                                         // nichts läuft → nichts zu übernehmen
    if (e.target.closest("#zeigeStart")) return;                                  // der Umschalter steuert sich selbst
    if (eignerKlick && (eignerKlick === e.target || eignerKlick.contains(e.target))) return;  // der Zeiger war's
    abschalten();                                                                 // echter Handgriff → Führung weicht
  }, true);

  // Wer die Führung gestartet hat, will sie sehen — auch nach einem Neuladen der Vorschau.
  // ?zeige=auto (die Werksbank schreibt es in den Rahmen): die Schleife ist hier der Dauerzustand,
  // bis jemand durch echten Handgriff übernimmt — die Übernahme bleibt über Neuladen hinweg respektiert.
  var autoModus = /[?&]zeige/.test(location.search);
  var manuell = sessionStorage.getItem("zeiger.schleife.manuell");
  if (manuell === "1") { schleifeSet(true); setTimeout(starte, 600); }            // von Hand gestartet: überlebt Neuladen
  else if (autoModus && manuell !== "0") { setTimeout(starte, 1200); }             // nur mit Auto-Auftrag des Rahmens
  try { sessionStorage.removeItem("zeiger.schleife"); } catch (e) { }          // Altlast ohne Unterscheidung entsorgen

  var stil = document.createElement("style");
  stil.textContent = "@keyframes zeigerPuls{0%{box-shadow:0 0 0 0 rgba(56,189,248,.7)}100%{box-shadow:0 0 0 16px rgba(56,189,248,0)}}" +
    ".zeigerGlow{animation:zeigerPuls .6s ease-out 2;outline:2px solid #38bdf8;outline-offset:2px}" +
    "@media(prefers-reduced-motion:reduce){.zeigerGlow{animation:none;outline:2px solid #38bdf8}}";
  document.head.appendChild(stil);
})();
