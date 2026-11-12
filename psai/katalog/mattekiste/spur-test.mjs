// Gegenrichtung: jede Fläche meldet ihre Tretspur dem Host; der Agent liest sie und zieht Konsequenzen.
import { createRequire } from 'node:module';
const require2 = createRequire('/Users/jo/.local/lib/');
const { chromium } = require2('playwright-core');
fetch('http://127.0.0.1:8097/mock/producer?on=0');   // ruhige Beweislage
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://127.0.0.1:8099/psai/katalog/live/index.html');
const rahmen = pg.frameLocator('iframe');
await rahmen.locator('#kzWert').waitFor();
await pg.waitForTimeout(1500);

// Ein echter Handgriff auf der Fläche (Zeiger weicht ihm — Übernahme ist erwünscht)
await rahmen.locator('#zeigeStart').click();                        // Führung übernehmen
await rahmen.locator('button[data-kz="pause"]').click();             // Nutzer pausiert die Kennzahl
console.log('Handgriff gesetzt: Kennzahl pausiert');

// Der Host weiß davon — ohne Neuladen, über seinen Spur-Kanal
await pg.waitForFunction(async () => {
  const d = await (await fetch('http://127.0.0.1:8097/api/spur?seit=50')).json();
  return d.spuren.some(s => s.tat.includes('pausiert'));
}, null, { timeout: 6000 }).catch(() => { });
const spuren = await (await fetch('http://127.0.0.1:8097/api/spur?seit=50')).json();
const treffer = spuren.spuren.filter(s => s.tat.includes('pausiert'));
console.log('Host führt Buch über den Handgriff:', treffer.length ? 'ja (' + treffer[0].person + ': "' + treffer[0].tat + '")' : 'NEIN');

// Und zeigt es ehrlich zurück: Rohlog-Perspektive speist sich aus der Host-Spur
await pg.evaluate(() => document.getElementById('rahmen').contentDocument.defaultView.__tick.status());
await pg.evaluate(() => { const f = document.getElementById('rahmen').contentDocument; [...f.querySelectorAll('[data-pers]')].find(b => b.dataset.pers === 'rohlog').click(); });
await rahmen.locator('#rohlogHost').waitFor({ timeout: 5000 });
const rohlog = await rahmen.locator('#rohlogHost').textContent();
console.log('Rohlog zeigt Host-Spuren (Person+Tat):', rohlog.includes('"person"') && rohlog.includes('"tat"') ? 'ja' : 'NEIN');

// Agenten-Konsequenz: wer oft pausiert, dem zeigt der Agent den Weg — hier der Nachweis der Lesezeile
const pausen = spuren.spuren.filter(s => s.tat.includes('pausiert')).length;
console.log('Zählbar für den Agenten:', pausen, 'Pausierungs-Spuren');
fetch('http://127.0.0.1:8097/mock/producer?on=1');
await b.close();
