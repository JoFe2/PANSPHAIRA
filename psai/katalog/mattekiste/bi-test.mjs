// BI-Glas: Schleife steht, Umschalter öffnet die Analyse, Fläche ist gefüllt und achsenlos verlässlich.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require2 = createRequire('/Users/jo/.local/lib/');
const { chromium } = require2('playwright-core');
const axeSrc = readFileSync('/Users/jo/frontend-kit/psai/qa/node_modules/axe-core/axe.min.js', 'utf8');
fetch('http://127.0.0.1:8097/mock/producer?on=0');
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://127.0.0.1:8099/psai/katalog/live/index.html');
const rahmen = pg.frameLocator('iframe');

// 1) Benutzerführung steht still (Loop gestoppt)
const f = () => pg.evaluate(() => document.getElementById('rahmen').contentDocument);
const schleiche = await pg.evaluate(() => { const d = document.getElementById('rahmen').contentDocument; return d.defaultView.sessionStorage.getItem('zeiger.schleife'); });
console.log('Animations-Loop gestoppt:', schleiche === '0' || schleiche === null ? 'ja' : 'NEIN (' + schleiche + ')');
const zeigerX = await pg.evaluate(() => { const z = document.getElementById('rahmen').contentDocument.getElementById('zeigeZeiger'); return z ? z.style.left : 'kein'; });
console.log('Zeiger zurückgezogen:', zeigerX === '-50px' || zeigerX === 'kein' ? 'ja' : 'rührt noch (' + zeigerX + ')');

// 2) BI-Analyse öffnen
await rahmen.locator('#biUmschalter').waitFor();
const OFFEN = await pg.evaluate(() => !!document.getElementById('rahmen').contentDocument.getElementById('biFlaeche'));
console.log('BI-Fläche beim Laden offen (Standardzustand):', OFFEN ? 'ja' : 'nein — nur über Knopf');
if (!OFFEN) { await rahmen.locator('#biUmschalter').click(); }
await rahmen.locator('#biFlaeche').waitFor();
const einzeln = await pg.evaluate(() => [...document.getElementById('rahmen').contentDocument.querySelectorAll('#modulInhalt > *:not(#biFlaeche)')].every(e => e.hidden));
console.log('Einzelprüfung ausgeblendet (rückholbar):', einzeln ? 'ja' : 'NEIN');

// 3) Fülle prüfen
const stueck = await pg.evaluate(() => {
  const d = document.getElementById('rahmen').contentDocument;
  return { kpis: d.querySelectorAll('.bi-kpi').length, svg: d.querySelectorAll('#biFlaeche svg').length,
           tafel: d.querySelectorAll('.bi-tafel tbody tr, .bi-tafel tr').length - 1,
           beschriftet: [...d.querySelectorAll('#biFlaeche svg[role=img]')].every(s => (s.getAttribute('aria-label') || '').length > 20),
           texte: d.querySelectorAll('#biFlaeche .kette').length };
});
console.log('Kacheln/SVGs/Tafelzeilen/Beschriftungen:', JSON.stringify(stueck));
console.log('Alle Diagramme für Screenreader benannt:', stueck.beschriftet ? 'ja' : 'NEIN');

// 4) axe auf der BI-Fläche
const rahmenEl = await pg.$('#rahmen');
const innere = await rahmenEl.contentFrame();
await innere.addScriptTag({ content: axeSrc });
const aus = await innere.evaluate(async () => {
  const r = await window.axe.run(document.getElementById('biFlaeche'), { resultTypes: ['violations'] });
  return r.violations.map(v => ({ id: v.id, knoten: (v.nodes[0]?.html || '').slice(0, 90), grund: (v.nodes[0]?.any[0]?.message || '').slice(0, 160) }));
});
console.log('axe-Verstöße BI-Fläche:', aus.length ? JSON.stringify(aus, null, 1) : 'keine');

// 5) Rückweg
await rahmen.locator('#biUmschalter').click();
await pg.waitForTimeout(400);
const weg = await pg.evaluate(() => !document.getElementById('rahmen').contentDocument.getElementById('biFlaeche'));
const wieder = await pg.evaluate(() => !!document.getElementById('rahmen').contentDocument.getElementById('modulCard') && ![...document.getElementById('rahmen').contentDocument.querySelectorAll('#modulInhalt > *')].some(e => e.hidden));
console.log('Zurück zur Einzelprüfung:', weg && wieder ? 'ja' : 'NEIN');
await b.close();
