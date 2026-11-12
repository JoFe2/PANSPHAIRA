// Inhaltssstrom: Seite hört zu. Neue Inhalte erscheinen ohne Seitenneuladen; Dateiänderung kommt als Ereignis.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
const require2 = createRequire('/Users/jo/.local/lib/');
const { chromium } = require2('playwright-core');
const PROTO = '/Users/jo/frontend-kit/psai/katalog/konzept/prototyp/proto.js';
fetch('http://127.0.0.1:8097/mock/producer?on=0');           // Geber an: Belege sollen steuerbar sein
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
let navigationen = 0;
pg.on('framenavigated', f => { if (f === pg.mainFrame().childFrames()[0]) navigationen++; });
await pg.goto('http://127.0.0.1:8099/psai/katalog/live/index.html');
const rahmen = pg.frameLocator('iframe');
await rahmen.locator('#kzWert').waitFor();
await pg.waitForTimeout(1500);
const stromAn = await pg.evaluate(() => document.getElementById('rahmen').contentWindow.__strom.an);
console.log('Strom im Rahmen bereit (kein Frage-Takt):', stromAn ? 'ja' : 'NEIN');
const navNachLaden = navigationen;
await pg.waitForTimeout(8000);
console.log('Acht Sekunden Langeweile ohne Neuladen:', navigationen === navNachLaden ? 'ja (' + navigationen + ' Navigationen gesamt)' : 'NEIN');
// Ticker-Inhalt vom Server angestoßen
await fetch('http://127.0.0.1:8097/api/event?gruppe=Zoll&text=' + encodeURIComponent('Sonderprüfung Sendung'));
await rahmen.locator('#tickListe').filter({ hasText: 'Sonderprüfung Sendung' }).waitFor({ timeout: 4000 });
console.log('Neue Ticker-Meldung ohne Neuladen angekommen: ja');
// Kennzahl vom Server geschoben
const wertVor = await rahmen.locator('#kzWert').textContent();
await fetch('http://127.0.0.1:8097/mock/kpi?wert=77');
await rahmen.locator('#kzWert').filter({ hasText: '77' }).waitFor({ timeout: 4000 });
console.log('Kennzahl ' + wertVor + ' → 77 ohne Neuladen: ja');
console.log('Immer noch keine zusätzliche Navigation:', navigationen === navNachLaden ? 'ja' : 'NEIN (' + navigationen + ')');
// Dateiänderung erreicht den Rahmen als Ereignis
const vorher = readFileSync(PROTO, 'utf8');
appendFileSync(PROTO, '\n/* Strombeweis */');
await pg.waitForTimeout(3000);
console.log('Dateiänderung löst genau einen Rahmenaufbau aus:', navigationen === navNachLaden + 1 ? 'ja' : '（' + navigationen + ' Navigationen, erwartet ' + (navNachLaden + 1) + ')');
writeFileSync(PROTO, vorher);
fetch('http://127.0.0.1:8097/mock/producer?on=1');
await b.close();
