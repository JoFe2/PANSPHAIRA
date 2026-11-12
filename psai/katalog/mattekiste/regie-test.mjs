/* Regie-Kanal: play startet ohne Klick, fremdes Ziel ⇒ 422 mit Inventar, gluehe leuchtet, stopp beendet. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const require2 = createRequire('/Users/jo/.local/lib/');
const { chromium } = require2('playwright-core');
const TOUR = '/Users/jo/frontend-kit/psai/katalog/live/tour.json';
const tourVorher = readFileSync(TOUR, 'utf8');
const B = 'http://127.0.0.1:8099';
let fehler = 0;
const ok = (name, ja) => { console.log((ja ? 'OK | ' : 'FEHLER | ') + name); if (!ja) fehler++; };
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
writeFileSync(TOUR, JSON.stringify({ schleife: false, schritte: [] }));   // saubere Ausgangswelt
await pg.goto(B + '/psai/katalog/live/index.html');   // ohne jeden Parameter — die Datei ist der Auftrag
const rahmen = pg.frameLocator('iframe');
await rahmen.locator('#zeigeStart').waitFor();
await pg.waitForFunction(() => document.getElementById('rahmen').contentDocument.querySelectorAll('button').length > 5);
await pg.waitForTimeout(800);   // Inventar-Meldung abgewartet
const play = await (await fetch(B + '/werkbank/regie', { method: 'POST', body: JSON.stringify({
  schleife: true, schritte: [{ ziel: 'Liste', spruch: 'Regie-Schritt eins' }, { ziel: 'Vergleich', spruch: 'Regie-Schritt zwei' }] }) })).status;
ok('play angenommen (202)', play === 202);
let gestartet = false;
try { await rahmen.locator('#zeigeBlase').filter({ hasText: 'Regie-Schritt eins' }).waitFor({ timeout: 8000 }); gestartet = true; } catch { }
try { await rahmen.locator('#zeigeBlase').filter({ hasText: 'Regie-Schritt zwei' }).waitFor({ timeout: 6000 }); gestartet = true; } catch { }
ok('Führung startet ohne jeden Klick', gestartet);
try {
  await rahmen.locator('#zeigeBlase').filter({ hasText: 'Regie-Schritt zwei' }).waitFor({ timeout: 12000 });
  ok('zweiter Schritt angefahren', true);
} catch { ok('zweiter Schritt angefahren', false); }
const ab = await fetch(B + '/werkbank/regie', { method: 'POST', body: JSON.stringify({ schleife: true, schritte: [{ ziel: 'Gibt-es-nicht' }] }) });
const sach = await ab.json();
ok('unbekanntes Ziel ⇒ 422 mit Inventar', ab.status === 422 && Array.isArray(sach.inventar) && sach.inventar.length > 5);
const gl = await (await fetch(B + '/werkbank/regie', { method: 'POST', body: JSON.stringify({ aktion: 'gluehe', ziel: 'Pause', spruch: 'Kurzer Schein' }) })).status;
let geleuchtet = false;
try { await rahmen.locator('#zeigeBlase').filter({ hasText: 'Kurzer Schein' }).waitFor({ timeout: 6000 }); geleuchtet = true; } catch { }
ok('gluehe leuchtet an (202 + Spruch)', gl === 202 && geleuchtet);
const st = await (await fetch(B + '/werkbank/regie', { method: 'POST', body: JSON.stringify({ aktion: 'stopp' }) })).status;
let fertig = false;
try { await rahmen.locator('#zeigeBlase').filter({ hasText: /Fertig/ }).waitFor({ timeout: 15000 }); fertig = true; } catch { }
ok('stopp beendet die Führung', st === 202 && fertig);
await b.close();
writeFileSync(TOUR, tourVorher);
console.log(fehler ? `REGIE: ${fehler} FEHLER` : 'REGIE: alles OK');
process.exit(fehler ? 1 : 0);
