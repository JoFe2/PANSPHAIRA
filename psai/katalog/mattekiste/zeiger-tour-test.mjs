// Generische Tour: tour.json steuert den Weg, Inventar meldet sich, Umschreiben wirkt ab nächster Runde.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const require2 = createRequire('/Users/jo/.local/lib/');
const { chromium } = require2('playwright-core');
const TOUR = '/Users/jo/frontend-kit/psai/katalog/live/tour.json';
const original = readFileSync(TOUR, 'utf8');
writeFileSync(TOUR, JSON.stringify({ schleife: false, schritte: [{ ziel: 'Liste', spruch: 'Tour-Spruch Alpha' }] }));
let fehler = 0;
const ok = (n, j) => { console.log((j ? 'OK | ' : 'FEHLER | ') + n); if (!j) fehler++; };
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://127.0.0.1:8099/psai/katalog/live/index.html');
const rahmen = pg.frameLocator('iframe');
await rahmen.locator('#zeigeStart').waitFor();
await rahmen.locator('#zeigeStart').click();
try { await rahmen.locator('#zeigeBlase').filter({ hasText: 'Tour-Spruch Alpha' }).waitFor({ timeout: 15000 }); ok('Tour aus Datei geführt (Spruch aus tour.json)', true); } catch { ok('Tour aus Datei geführt (Spruch aus tour.json)', false); }
const elemente = await (await fetch('http://127.0.0.1:8099/werkbank/elemente')).json();
const spiegel = elemente.join('|');
ok('Elementinventar gemeldet', spiegel.includes('Erststart') && spiegel.includes('Warum so?'));
writeFileSync(TOUR, JSON.stringify({ schleife: false, schritte: [{ ziel: 'Vergleich', spruch: 'Nur noch die Chronik' }] }));
try { await rahmen.locator('#zeigeBlase').filter({ hasText: 'Nur noch die Chronik' }).waitFor({ timeout: 25000 }); ok('Umschreiben der Tour wirkt ab nächster Runde', true); } catch { ok('Umschreiben der Tour wirkt ab nächster Runde', false); }
await b.close();
writeFileSync(TOUR, original);
console.log(fehler ? `TOUR: ${fehler} FEHLER` : 'TOUR: alles OK');
process.exit(fehler ? 1 : 0);
