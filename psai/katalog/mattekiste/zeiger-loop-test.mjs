// Loop: läuft mindestens zwei Runden, Reload startet ihn neu, Nutzerklick beendet ihn.
import { createRequire } from 'node:module';
const require2 = createRequire('/Users/jo/.local/lib/');
const { chromium } = require2('playwright-core');
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://127.0.0.1:8099/psai/katalog/live/index.html');
const rahmen = pg.frameLocator('iframe');
await rahmen.locator('#zeigeStart').waitFor();
console.log('Knopf anfangs:', (await rahmen.locator('#zeigeStart').textContent()).trim());
if (((await rahmen.locator('#zeigeStart').textContent()).trim()).includes('ansehen')) await rahmen.locator('#zeigeStart').click();

// Runde 1 abwarten (Hinweis am Rundenende), dann Runde 2 abwarten
const feld = rahmen.locator('#zeigeBlase');
await feld.filter({ hasText: 'Gleich noch mal' }).waitFor({ timeout: 20000 });
console.log('Runde 1 endet mit Schleifen-Hinweis: ja');
await feld.filter({ hasText: /Öffnen|holen|schauen/ }).waitFor({ timeout: 20000 });
console.log('Runde 2 läuft von selbst: ja');

// Reload: Führung muss automatisch wieder anlaufen
await pg.reload();
await rahmen.locator('#zeigeBlase').filter({ hasText: /Öffnen|holen|schauen/ }).waitFor({ timeout: 15000 });
console.log('Nach Reload wieder aktiv: ja');

// Echter Nutzerklick auf einen Button → Führung weicht (im Prototyp-Dokument, nicht im Rahmen)
await rahmen.getByRole('button', { name: 'Warum so?' }).first().click();
await pg.waitForTimeout(1200);
const sitzung = await pg.evaluate(() => { const f = document.getElementById('rahmen').contentDocument; return { schleife: f.defaultView.sessionStorage.getItem('zeiger.schleife'), zeigerX: f.getElementById('zeigeZeiger').style.left, knopf: f.getElementById('zeigeStart').textContent.trim() }; });
console.log('Nach Nutzerklick — Schleife aus:', sitzung.schleife === '0', '| Zeiger zurückgezogen:', sitzung.zeigerX === '-50px');
console.log('Knopf jetzt:', sitzung.knopf);
await b.close();
