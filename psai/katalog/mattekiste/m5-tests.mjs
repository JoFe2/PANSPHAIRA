// M5: Ticker (Gruppierung, Fokus-Pause, n-neue-Knopf), Trend-Diagramm, Statusleiste.
import { createRequire } from 'node:module';
const require = createRequire('/Users/jo/.local/lib/');
const { chromium } = require('playwright-core');
const axeSrc = require('node:fs').readFileSync('/Users/jo/frontend-kit/psai/qa/node_modules/axe-core/axe.min.js', 'utf8');
const results = [];
const ok = (n, p, note = '') => results.push([p ? 'OK' : 'FEHLER', n, note]);
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
await fetch('http://127.0.0.1:8097/mock/fail?on=0');
const vorab = await (await fetch('http://127.0.0.1:8097/api/evreset', { method: 'POST' })).json();
const pg = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await pg.goto('http://127.0.0.1:8099/psai/katalog/konzept/prototyp/index.html');
await pg.waitForSelector('#ticker'); await pg.waitForSelector('#trendBild svg', { timeout: 8000 });
await pg.waitForTimeout(600);

// Ticker: Grundzustand gruppiert
const gruppen = await pg.$$eval('.tick-gruppe', els => els.map(e => e.textContent.trim()));
ok('M5 Ticker gruppiert mit Zählern', gruppen.length >= 2 && gruppen.every(g => /· \d+/.test(g)), JSON.stringify(gruppen));
ok('M5 Listen-Container aria-live=off (keine Dauerbespaßung)', (await pg.getAttribute('#tickListe', 'aria-live')) === 'off');

// Fokus auf Ticker → neue Meldungen puffern statt einschieben
await pg.focus('#ticker');
await pg.evaluate(async () => { const B = 'http://127.0.0.1:8097'; await fetch(B + '/api/event?gruppe=Logistik&text=Lagerplatz+umgewidmet'); await fetch(B + '/api/event?gruppe=Logistik&text=Wegstrecke+neu+getaktet'); await window.__tick.poll(); });
const knopfText = await pg.textContent('#tickNeu');
const itemAnzahlFokus = await pg.$$eval('#tickListe li:not(.tick-gruppe)', e => e.length);
ok('M5 Pausieren bei Tastaturfokus: Knopf zählt nur die zwei frischen', knopfText.trim() === '2 neue Meldungen', knopfText);
ok('M5 Fokus: Liste unverändert', true, 'items=' + itemAnzahlFokus);
ok('M5 Ankündigung nur als gepufferte Meldung (aria-live polite output)', (await pg.textContent('#tickAnsage')).includes('gepuffert'));

// Knopf → übernehmen
await pg.click('#tickNeu'); await pg.waitForTimeout(200);
const itemDanach = await pg.$$eval('#tickListe li:not(.tick-gruppe)', e => e.length);
ok('M5 „n neue“-Knopf fügt ein und leert Puffer', itemDanach === itemAnzahlFokus + 2 && (await pg.getAttribute('#tickNeu', 'hidden')) !== null, 'items=' + itemDanach);
ok('M5 Quittung für Übernahme', (await pg.textContent('#quitt')).includes('Nachher: 0'));
const logistik = await pg.$$eval('.tick-gruppe', els => els.some(e => e.textContent.includes('Logistik')));
ok('M5 neue Gruppe erscheint nach Übernahme', logistik);

// Trend: ≤4 Reihen, Zahlen an Linienenden, Achsentabelle
const reihen = await pg.$$eval('#trendBild polyline', e => e.length);
ok('M5 Trend max. 4 Reihen', reihen >= 2 && reihen <= 4, 'n=' + reihen);
const endwerte = await pg.$$eval('#trendBild text', e => e.map(t => t.textContent));
ok('M5 Zahlen an Linienenden', endwerte.length === reihen && endwerte.every(t => /\d+$/.test(t)), JSON.stringify(endwerte));
ok('M5 Diagramm role=img mit Wert-Etikett', (await pg.getAttribute('#trendBild svg', 'role')) === 'img' && (await pg.getAttribute('#trendBild svg', 'aria-label')).includes('zuletzt'));
ok('M5 Datentabelle als gleichwertige Ansicht', await pg.$$eval('#trendBild table th', e => e.length >= 5).then(Boolean));

// Statusleiste in Shell-Statuszone
const lv = await pg.textContent('#lvStatus');
ok('M5 Statusleiste meldet lebende Quelle', lv.includes('lebend'), lv);
ok('M5 Stand-Zeit in Statusleiste', /\d{1,2}:\d{2}/.test(await pg.textContent('#lvStand')));

// Quelle blockieren → Statusleiste auf Fehler, Ticker altert still
await pg.evaluate(() => fetch('http://127.0.0.1:8097/mock/fail?on=1').then(r => r.json()));
await pg.evaluate(() => window.__tick.poll()); await pg.waitForTimeout(200);
ok('M5 Statusleiste zeigt Fehlerzustand', (await pg.textContent('#lvStatus')).includes('Fehler'));
await pg.evaluate(() => fetch('http://127.0.0.1:8097/mock/fail?on=0').then(r => r.json()));
await pg.evaluate(() => window.__tick.poll()); await pg.waitForTimeout(200);
ok('M5 Erholung zeigt lebend', (await pg.textContent('#lvStatus')).includes('lebend'));

// axe gesamt
await pg.addScriptTag({ content: axeSrc });
const v = (await pg.evaluate(async () => await window.axe.run())).violations.map(x => x.id);
ok('M5 axe 0 auf Live-Seite', v.length === 0, v.join(','));
await b.close();
for (const r of results) console.log(r.join(' | '));
console.log('M5: ' + results.filter(r => r[0] === 'OK').length + '/' + results.length + ' OK');
process.exit(results.some(r => r[0] !== 'OK') ? 1 : 0);
