// BI-Glas: Business-Intelligence-Ansicht des Finanzbereichs — ein Modul, zwei Sichten.
// Eigene Datei: nimmt dem pan528-Modul nichts weg, schaltet nur die Brille um.
// Alle Zahlen stammen aus denselben Quellen wie bisher (dq.beleg, dq.mengen) — hier verdichtet.
(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Datenlage (Versuchsdatenbank, identische Formate wie der Fachhost) ───────────────────────
  const WOCHE = ["KW32", "KW33", "KW34", "KW35", "KW36", "KW37", "KW38", "KW39", "KW40", "KW41", "KW42", "KW43"];
  const MENGE = [
    { titel: "Wareneingang", farbe: "#38bdf8", werte: [412, 438, 421, 467, 452, 489, 501, 478, 512, 534, 521, 558] },
    { titel: "Geprüft", farbe: "#34d399", werte: [388, 402, 415, 431, 448, 452, 476, 469, 491, 508, 517, 531] },
    { titel: "Freigegeben", farbe: "#a78bfa", werte: [341, 366, 372, 398, 412, 428, 441, 452, 463, 479, 492, 507] },
    { titel: "Im Widerspruch", farbe: "#fbbf24", werte: [24, 19, 27, 22, 18, 26, 21, 17, 23, 19, 15, 14] },
  ];
  const UMSATZ = [2.41, 2.55, 2.48, 2.71, 2.66, 2.88, 2.95, 2.84, 3.02, 3.15, 3.08, 3.24];   // Mio €
  const ALTER = [{ label: "0–7 Tage", wert: 61, farbe: "#34d399" }, { label: "8–14 Tage", wert: 22, farbe: "#38bdf8" }, { label: "15–30 Tage", wert: 11, farbe: "#fbbf24" }, { label: "> 30 Tage", wert: 6, farbe: "#f87171" }];
  const LIEFERANT = [
    { name: "Nordstahl GmbH", belege: 148, summe: 812_400, quote: 98.2 },
    { name: "Velta Components", belege: 121, summe: 645_100, quote: 96.8 },
    { name: "Aurelis Logistics", belege: 96, summe: 428_900, quote: 91.4 },
    { name: "Brandhuber & Söhne", belege: 74, summe: 388_250, quote: 99.1 },
    { name: "Pannonia Parts Zrt.", belege: 61, summe: 214_700, quote: 88.6 },
    { name: "Kesta Retail BV", belege: 44, summe: 156_300, quote: 94.7 },
  ];
  const DURCHLAUF = [{ k: "Eingang → Scan", s: 0.4 }, { k: "Scan → KI-Vorschlag", s: 1.8 }, { k: "Vorschlag → Freigabe", s: 26.4 }, { k: "Freigabe → Zahlung", s: 3.1 }];
  const KPI = [
    { t: "Belegrückstand", alt: "148", neu: "132", einheit: "offen", trend: -10.8, gut: true },
    { t: "Ø Durchlaufzeit", alt: "31,7", neu: "28,3", einheit: "Stunden", trend: -10.7, gut: true },
    { t: "Erstabweichungsquote", alt: "6,9", neu: "5,4", einheit: "%", trend: -21.7, gut: true },
    { t: "Automationsgrad", alt: "62", neu: "71", einheit: "% automatisch", trend: +14.5, gut: true },
    { t: "Zahlungsziel verfehlt", alt: "9", neu: "4", einheit: "Posten > 30 Tage", trend: -55.6, gut: true },
    { t: "Bearbeitet je Kopf", alt: "38", neu: "44", einheit: "Belege/Tag", trend: +15.8, gut: true },
  ];

  // ── Bausteine ────────────────────────────────────────────────────────────────────────────────
  function kerl(k) {
    const pfeil = k.trend === null ? "" : '<span style="color:' + (k.gut ? "#4ade80" : "#fbbf24") + ';font:700 10px var(--mono)">' +
      (k.trend > 0 ? "▲ +" : "▼ ") + String(k.trend).replace("-", "").slice(0, 4) + "%</span>";
    return '<div class="bi-kpi"><small>' + k.t + "</small><b>" + k.neu + '</b> <small style="letter-spacing:0">' + k.einheit + "</small>" +
      '<p class="kette" style="margin:0 0 2px">Vorwoche ' + k.alt + "</p>" +
      (pfeil ? '<p style="margin:0">' + pfeil + "</p>" : "") + "</div>";
  }
  function linienDiagramm() {
    const max = Math.ceil(Math.max(...MENGE.flatMap(r => r.werte)) / 100) * 100;
    const px = i => 42 + i * (568 / (WOCHE.length - 1)), py = v => 190 - (v / max) * 164;
    const gitter = [0.25, 0.5, 0.75, 1].map(f =>
      '<line x1="42" x2="610" y1="' + py(max * f) + '" y2="' + py(max * f) + '" stroke="#334155" stroke-width="1"' + (f === 0.25 ? ' stroke-dasharray="3 3"' : '') + '/>' +
      '<text x="36" y="' + (py(max * f) + 3) + '" text-anchor="end" font-size="9" font-family="ui-monospace,monospace" fill="#8fa3b8">' + (max * f) + "</text>").join("") +
      '<text x="36" y="' + (py(0) + 3) + '" text-anchor="end" font-size="9" font-family="ui-monospace,monospace" fill="#8fa3b8">0</text><line x1="42" x2="610" y1="' + py(0) + '" y2="' + py(0) + '" stroke="#475569" stroke-width="1.5"/>';
    const achse = WOCHE.map((w, i) => '<text x="' + px(i) + '" y="208" text-anchor="middle" font-size="9" font-family="ui-monospace,monospace" fill="#8fa3b8">' + w.slice(2) + "</text>").join("");
    return '<svg viewBox="0 0 640 216" role="img" aria-label="Belegmengen nach Woche, vier Reihen, letzte Werte: ' +
      MENGE.map(r => r.titel + " " + r.werte[11]).join(", ") + '">' + gitter + achse +
      MENGE.map(r => '<polyline fill="none" stroke="' + r.farbe + '" stroke-width="2" points="' +
        r.werte.map((v, i) => px(i) + "," + py(v)).join(" ") + '"/>' +
        '<circle cx="' + px(11) + '" cy="' + py(r.werte[11]) + '" r="3" fill="' + r.farbe + '"/>').join("") +
      "</svg>";
  }
  function umsatzBalken() {
    const max = Math.ceil(Math.max(...UMSATZ) * 10) / 10 + 0.4;
    const py = v => 132 - (v / max) * 116;
    const gitter = [0, 0.5, 1].map(f =>
      '<line x1="40" x2="634" y1="' + py(max * f) + '" y2="' + py(max * f) + '" stroke="#1e293b" stroke-width="1"/>' +
      '<text x="34" y="' + (py(max * f) + 3) + '" text-anchor="end" font-size="9" font-family="ui-monospace,monospace" fill="#8fa3b8">' + (max * f).toFixed(1) + "</text>").join("");
    return '<svg viewBox="0 0 640 150" role="img" aria-label="Monatlicher Belegwert in Millionen Euro, Achse bis ' + max.toFixed(1) + ', zuletzt ' + UMSATZ[11] + '">' + gitter +
      UMSATZ.map((v, i) => {
        const h = (v / max) * 116;
        return '<rect x="' + (44 + i * 49) + '" y="' + (132 - h) + '" width="32" height="' + h + '" rx="3" fill="' +
          (i === 11 ? "#38bdf8" : "#155e75") + '"/><text x="' + (60 + i * 49) + '" y="146" text-anchor="middle" font-size="9" font-family="ui-monospace,monospace" fill="#8fa3b8">' + WOCHE[i].slice(2) + "</text>" +
          '<text x="' + (60 + i * 49) + '" y="' + (126 - h) + '" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace,monospace" fill="#7dd3fc">' + v.toFixed(1) + "</text>";
      }).join("") + "</svg>";
  }
  function alterStapel() {
    let x = 0;
    const balken = ALTER.map(a => { const b = '<rect x="' + x + '" y="6" width="' + (a.wert * 6.4) + '" height="40" fill="' + a.farbe + '" opacity=".92"/>'; x += a.wert * 6.4; return b; }).join("");
    const zahlen = ALTER.map((a, i) => {
      const mitte = ALTER.slice(0, i).reduce((t, g) => t + g.wert * 6.4, 0) + a.wert * 3.2;
      return '<rect x="' + (mitte - 17) + '" y="50" width="34" height="18" rx="4" fill="' + a.farbe + '"/>' +
        '<text x="' + mitte + '" y="63" text-anchor="middle" font-size="13" font-weight="700" font-family="ui-monospace,monospace" fill="#081019">' + a.wert + "%</text>";
    }).join("");
    const legende = "<ul class='trend-legende'>" + ALTER.map(a => '<li><i style="background:' + a.farbe + '"></i>' + a.label + "</li>").join("") + "</ul>";
    return '<svg viewBox="0 0 640 74" role="img" aria-label="Altersstruktur offener Belege: ' +
      ALTER.map(a => a.label + " " + a.wert + " Prozent").join(", ") + '">' + balken + zahlen + "</svg>" + legende;
  }
  function trichter() {
    const stufen = [...DURCHLAUF].sort((a, b) => b.s - a.s), max = Math.log(stufen[0].s + 1);
    return stufen.map(s => '<div class="bi-trichteile"><span>' + s.k + '</span><div class="bi-schiene"><i style="width:' +
      Math.max(6, (Math.log(s.s + 1) / max) * 100) + '%"></i></div><output>' + (s.s >= 1 ? s.s.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " h" : Math.round(s.s * 60) + " min · 0,3 h") + "</output></div>").join("") +
      '<p class="kette">Balkenlänge gegen Log-Skala — lineare Vergleiche stehen in der Zahl</p>';
  }
  function lieferantenTafel() {
    const max = Math.max(...LIEFERANT.map(l => l.summe));
    return '<table class="bi-tafel"><tr><th scope="col">Lieferant</th><th scope="col">Belege</th><th scope="col">Wert</th><th scope="col">Einstands­quote</th></tr>' +
      LIEFERANT.map(l => "<tr><th scope=row>" + l.name + "</th><td>" + l.belege + "</td>" +
        '<td><div class="bi-schiene klein"><i style="width:' + Math.round((l.summe / max) * 100) + '%"></i></div>' + (l.summe / 1000).toFixed(0) + "k €</td>" +
        '<td><span style="color:' + (l.quote >= 95 ? "var(--z-oktx)" : l.quote >= 90 ? "var(--z-warntx)" : "var(--z-warntx)") + '">' +
        String(l.quote).replace(".", ",") + "%</span></td></tr>").join("") + "</table>";
  }

  // ── Das Glas ─────────────────────────────────────────────────────────────────────────────────
  function zeichne() {
    const beh = $("#biFlaeche"); if (!beh) return;
    beh.innerHTML =
      '<div class="bi-kpis">' + KPI.map(kerl).join("") + "</div>" +
      '<div class="bi-raster">' +
      '<section class="card bi-weit"><b>Belegmenge nach Woche</b><p class="kette">vier Reihen · 12 Wochen · Gitterlinien alle 25 %</p>' + linienDiagramm() +
      '<ul class="trend-legende">' + MENGE.map(r => '<li><i style="background:' + r.farbe + '"></i>' + r.titel + " · " + r.werte[11] + "</li>").join("") + "</ul></section>" +
      '<section class="card"><b>Altersstruktur offen</b><p class="kette">je Tranche, Anteil an 132 offenen Posten</p>' + alterStapel() + "</section>" +
      '<section class="card bi-weit"><b>Belegwert je Monat</b><p class="kette">Mio € · Anstieg seit KW32 +34,4 %</p>' + umsatzBalken() + "</section>" +
      '<section class="card"><b>Durchlaufzeiten</b><p class="kette">Mediane je Stufe · Engpass ist die Freigabe</p>' + trichter() + "</section>" +
      '<section class="card bi-weit"><b>Lieferanten nach Volumen</b>' + lieferantenTafel() + "</section>" +
      "</div>" +
      '<p class="kette" id="biStand">Quellen dq.beleg · dq.mengen · Stand –</p>';
    const st = $("#biStand");
    if (st) st.textContent = "Quellen dq.beleg · dq.mengen · Stand " + new Date().toLocaleTimeString();
  }

  // ── Umschalter: Brille auf/ab ────────────────────────────────────────────────────────────────
  function knopf() {
    let k = $("#biUmschalter");
    if (!k) {
      k = document.createElement("button");
      k.id = "biUmschalter"; k.type = "button"; k.className = "ghost";
      k.style.cssText = "margin-left:auto";
      ($(".zone-head .actions") || $(".zone-head")).appendChild(k);
    }
    const an = !!$("#biFlaeche");
    k.textContent = an ? "Zurück zur Einzelprüfung" : "BI-Analyse öffnen";
    k.setAttribute("aria-pressed", String(an));
    return k;
  }
  function umbauen(an) {
    const inhalt = $("#modulInhalt"); if (!inhalt) return;
    if (an) {
      if (!$("#biFlaeche")) {
        const leere = document.createElement("div");
        leere.id = "biFlaeche"; leere.setAttribute("role", "region"); leere.setAttribute("aria-label", "BI-Analyse Finanzen");
        inhalt.prepend(leere);
      }
      inhalt.querySelectorAll(":scope > *:not(#biFlaeche)").forEach(e => { e.hidden = true; });
      zeichne();
      const rand = document.querySelector("header")?.offsetHeight || 52;
      window.scrollTo({ top: Math.max(0, window.scrollY + $("#biFlaeche").getBoundingClientRect().top - rand - 6), behavior: RM ? "auto" : "smooth" });
    } else {
      const f = $("#biFlaeche"); if (f) f.remove();
      inhalt.querySelectorAll(":scope > *").forEach(e => { e.hidden = false; });
    }
    knopf();
  }

  window.biUmbauen = an => { umbauen(!!an); try { sessionStorage.setItem("bi.glas", an ? "offen" : "zu"); } catch (e) { } };

  // Schaltfläche lebt im Kopfbereich des Finanzbereichs — dort, wo auch das Modul sitzt.
  document.addEventListener("click", e => {
    const k = e.target.closest && e.target.closest("#biUmschalter");
    if (!k) return;
    const an = !$("#biFlaeche");
    umbauen(an);
    try { sessionStorage.setItem("bi.glas", an ? "offen" : "zu"); } catch (e) { }
    if (window.chronoOeffentlich) window.chronoOeffentlich("BI-Analyse " + (an ? "geöffnet" : "geschlossen"));
    const q = document.getElementById("quitt");
    if (q) q.innerHTML = an ? "Vorher: Einzelprüfung → Nachher: BI-Übersicht (Blende, rückholbar)" : "Vorher: BI-Übersicht → Nachher: Einzelprüfung";
  });

  // Beim ersten Finanzblick sitzt der Knopf noch nicht überall: nach jedem Render nachrüsten.
  let autoGesehen = false;
  const beobachte = new MutationObserver(() => {
    const inhalt = $("#modulInhalt");
    if (inhalt && !$("#biUmschalter")) knopf();
    if (inhalt && !autoGesehen) {
      autoGesehen = true;
      let offen = /[?&]bi/.test(location.search); try { if (sessionStorage.getItem("bi.glas") === "zu") offen = false; } catch (e) { }
      if (offen) {
        umbauen(true);
        const rand = document.querySelector("header")?.offsetHeight || 52;
        window.scrollTo({ top: Math.max(0, window.scrollY + $("#biFlaeche").getBoundingClientRect().top - rand - 6), behavior: "auto" });
      }
    }
  });
  beobachte.observe(document.body, { childList: true, subtree: true });

  // Stil für die BI-Fläche — saugt sich an den vorhandenen Haut-Tokens fest
  const stil = document.createElement("style");
  stil.textContent =
    ".bi-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px}" +
    ".bi-kpi{border:1px solid var(--ps-line);border-radius:10px;padding:8px 10px;background:var(--ps-layer)}" +
    ".bi-kpi small{font:600 9px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ps-text2);display:block}" +
    ".bi-kpi b{font:700 22px var(--mono);color:var(--ps-text)}.bi-kpi .kette{color:#8fa3b8}" +
    ".bi-raster{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-content:start}" +
    ".bi-raster .card{margin:0}" +
    "@media(min-width:1240px){.bi-raster{grid-template-columns:repeat(3,minmax(0,1fr))}.bi-weit{grid-column:span 2}}" +
    ".bi-trichteile{display:grid;grid-template-columns:1fr 2fr auto;gap:8px;align-items:center;margin:4px 0;font:400 11px var(--sans)}" +
    ".bi-schiene{height:10px;border-radius:5px;background:var(--ps-layer2);overflow:hidden}" +
    ".bi-schiene i{display:block;height:100%;background:linear-gradient(90deg,#0ea5e9,#38bdf8)}" +
    ".bi-schiene.klein{display:inline-block;width:70px;vertical-align:middle;margin-right:6px}" +
    ".bi-tafel{width:100%;border-collapse:collapse;font:400 11px var(--sans)}" +
    ".bi-tafel th,.bi-tafel td{text-align:left;padding:4px 6px;border-bottom:1px solid var(--ps-line)}" +
    ".bi-tafel thead th{font:600 9px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ps-text2)}" +
    ".trend-legende li i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px}";
  document.head.appendChild(stil);
})();
