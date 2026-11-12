// Generische Tour: tour.json steuert den Weg, Elementliste meldet sich, Umschreiben wirkt ab nächster Runde.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const require2 = createRequire('/Users/jo/.local/lib/');
const { chromium } = require2('playwright-core');
const TOUR = '/Users/jo/frontend-kit/psai/katalog/live/tour.json';
const original = readFileSync(TOUR, 'utf8');
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://127.0.0.1:8099/psai/katalog/live/index.html');
const rahmen = pg.frameLocator('iframe');
await rahmen.locator('#zeigeStart').waitFor();
await rahmen.locator('#zeigeStart').click();
// Runde 1 nutzt tour.json (erkennbar am neuen Spruchtext)
await rahmen.locator('#zeigeBlase').filter({ hasText: 'Bereich Finanzen öffnen' }).waitFor({ timeout: 15000 });
console.log('Tour aus Datei geführt (Spruch stammt aus tour.json): ja');
// Elementliste hat sich gemeldet
const elemente = await (await fetch('http://127.0.0.1:8099/werkbank/elemente')).json();
const spiegel = elemente.join('|');
console.log('Elementinventar gemeldet:', spiegel.includes('Erststart') && spiegel.includes('Warum so?') ? 'ja (' + elemente.length + ' Namen)' : 'NEIN');
// Zwischen den Runden umgebogen: nur noch Chronik-Drawer als Ziel
writeFileSync(TOUR, JSON.stringify({ schritte: [{ ziel: 'Chronik-Drawer', spruch: 'Nur noch die Chronik' }] }));
await rahmen.locator('#zeigeBlase').filter({ hasText: 'Nur noch die Chronik' }).waitFor({ timeout: 25000 });
console.log('Umschreiben der Tour wirkt ab nächster Runde: ja');
writeFileSync(TOUR, original);
await b.close();
