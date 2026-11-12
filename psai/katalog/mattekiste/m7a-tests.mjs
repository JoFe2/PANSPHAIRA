// M7-Audit: Trend-Zustände, Perspektiv-Fragment, Statusleiste „seit“, Geführter Erststart.
import { createRequire } from 'node:module';
const require = createRequire('/Users/jo/.local/lib/');
const { chromium } = require('playwright-core');
const axeSrc = require('node:fs').readFileSync('/Users/jo/frontend-kit/psai/qa/node_modules/axe-core/axe.min.js', 'utf8');
const results = [];
const ok = (n, p, note = '') => results.push([p ? 'OK' : 'FEHLER', n, note]);
await fetch('http://127.0.0.1:8097/mock/fail?on=0');
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const U = 'http://127.0.0.1:8099/psai/katalog/konzept/prototyp/index.html';
await pg.goto(U); await pg.waitForSelector('#trendBild svg'); await pg.waitForTimeout(400);

// Statusleiste mit „seit“
ok('A Statusleiste führt „seit“-Zeit', /seit \d{1,2}:\d{2}/.test(await pg.textContent('#lvStatus')));

// Perspektive als URL-Fragment, überlebt Reload (NAVIGATIONS-MUSTER-Regel)
await pg.click('[data-pers="vergleich"]');
ok('A Perspektivwechsel setzt URL-Fragment', (await pg.evaluate(() => location.hash)) === '#perspektive=vergleich');
await pg.reload(); await pg.waitForSelector('#ticker');
ok('A Perspektive nach Reload wiederhergestellt', (await pg.$$eval('#modulPers th', e => e.map(x => x.textContent))).includes('Nachher'));

// Trend: Fehlerzustand nach 3 Versuchen + manuelle Neuprobe
await pg.evaluate(() => fetch('http://127.0.0.1:8097/mock/fail?on=1'));
await pg.evaluate(async () => { await window.__tick.trend(); await window.__tick.trend(); await window.__tick.trend(); });
const trendFehler = await pg.textContent('#trendBild');
ok('A Trend zeigt Fehlerzustand mit Versuchszähler', trendFehler.includes('Quelle antwortet nicht') && /Versuch [3-9]/.test(trendFehler), trendFehler.slice(0, 60));
ok('A Trend bietet manuelle Neuprobe', !!(await pg.$('[data-tp="retry"]')));
await pg.evaluate(() => fetch('http://127.0.0.1:8097/mock/fail?on=0'));
await pg.click('[data-tp="retry"]'); await pg.waitForTimeout(400);
ok('A Trend erholt sich nach Freigabe + Neuprobe', !!(await pg.$('#trendBild svg')));
// Pause am Trend
await pg.click('[data-tp="pause"]');
ok('A Trend-Pause mit Quittung', (await pg.textContent('#quitt')).includes('pausiert'));
await pg.click('[data-tp="pause"]');

// Geführter Erststart (Rolle jo): 3 Schritte, aria-current, Abschluss
await pg.click('#erststart');
ok('A Erststart zeigt Schritt-Leiste', !!(await pg.$('#tour')) && (await pg.$eval('#tour ol li', e => e.getAttribute('aria-current'))) === 'step');
await pg.click('#tourWeiter');
ok('A Schritt 2 markiert (aria-current wandert)', (await pg.$$eval('#tour ol li', es => es.findIndex(e => e.getAttribute('aria-current') === 'step'))) === 1);
await pg.click('#tourWeiter'); await pg.click('#tourWeiter'); await pg.waitForTimeout(300);
ok('A Erststart abgeschlossen mit Chronikeintrag', !!(await pg.$('#tour')) === false && (await pg.textContent('#chronikList')).includes('Erststart Rolle jo abgeschlossen'));
ok('A Drawer aus Tour wieder geschlossen', await pg.isHidden('#drawer'));
await pg.click('#erststart'); await pg.click('#tourAbbr');
ok('A Erststart jederzeit abbrechbar', !(await pg.$('#tour')) && (await pg.textContent('#chronikList')).includes('abgebrochen'));

// axe nach allem
await pg.addScriptTag({ content: axeSrc });
const v = (await pg.evaluate(async () => await window.axe.run())).violations.map(x => x.id + ':' + x.nodes.map(n => n.target.join('')).slice(0, 2));
ok('A axe 0 nach Audit-Eingriffen', v.length === 0, v.join(' | '));
await b.close();
for (const r of results) console.log(r.join(' | '));
console.log('M7-AUDIT: ' + results.filter(r => r[0] === 'OK').length + '/' + results.length + ' OK');
process.exit(results.some(r => r[0] !== 'OK') ? 1 : 0);
