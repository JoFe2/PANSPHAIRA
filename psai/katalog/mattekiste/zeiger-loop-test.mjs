// Loop: zwei Runden, Reload startet neu, echter Klick beendet. Tour wird selbst geschrieben (Isolation).
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
const require2 = createRequire('/Users/jo/.local/lib/');
const { chromium } = require2('playwright-core');
const TOUR = '/Users/jo/frontend-kit/psai/katalog/live/tour.json';
const tourVorher = readFileSync(TOUR, 'utf8');
writeFileSync(TOUR, JSON.stringify({ schleife: false, schritte: [
  { ziel: 'Liste', spruch: 'Loop-Schritt Nord' },
  { ziel: 'Vergleich', spruch: 'Loop-Schritt Süd' }] }));
let fehler = 0;
const ok = (n, j) => { console.log((j ? 'OK | ' : 'FEHLER | ') + n); if (!j) fehler++; };
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://127.0.0.1:8099/psai/katalog/live/index.html');
const rahmen = pg.frameLocator('iframe');
await rahmen.locator('#zeigeStart').waitFor();
ok('Knopf lädt in Ruhelage', ((await rahmen.locator('#zeigeStart').textContent()).trim()).includes('ansehen'));
await rahmen.locator('#zeigeStart').click();                        // von Hand: Hand-Merkung schützt vor Datei-Stopp
const feld = rahmen.locator('#zeigeBlase');
try { await feld.filter({ hasText: 'Gleich noch mal' }).waitFor({ timeout: 20000 }); ok('Runde 1 endet mit Schleifen-Hinweis', true); } catch { ok('Runde 1 endet mit Schleifen-Hinweis', false); }
try { await feld.filter({ hasText: /Loop-Schritt (Nord|Süd)/ }).waitFor({ timeout: 20000 }); ok('Runde 2 läuft von selbst', true); } catch { ok('Runde 2 läuft von selbst', false); }
await pg.reload();
try { await feld.filter({ hasText: /Loop-Schritt (Nord|Süd)/ }).waitFor({ timeout: 15000 }); ok('Nach Reload wieder aktiv (Hand-Merkung)', true); } catch { ok('Nach Reload wieder aktiv (Hand-Merkung)', false); }
await rahmen.locator('[data-warum]').first().click();               // echter Handgriff, nicht Teil der Tour
await pg.waitForTimeout(1200);
const sitzung = await pg.evaluate(() => { const f = document.getElementById('rahmen').contentDocument; return { schleife: f.defaultView.sessionStorage.getItem('zeiger.schleife.manuell'), zeigerX: f.getElementById('zeigeZeiger').style.left, knopf: f.getElementById('zeigeStart').textContent.trim() }; });
ok('Nach Nutzerklick — Schleife aus, Zeiger zurückgezogen', sitzung.schleife === '0' && sitzung.zeigerX === '-50px');
ok('Knopf zurück auf ansehen', sitzung.knopf.includes('ansehen'));
await b.close();
writeFileSync(TOUR, tourVorher);
console.log(fehler ? `ZEIGER-LOOP: ${fehler} FEHLER` : 'ZEIGER-LOOP: alles OK');
process.exit(fehler ? 1 : 0);
