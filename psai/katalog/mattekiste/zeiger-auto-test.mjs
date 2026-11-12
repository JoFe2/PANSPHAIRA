/* ?zeige=auto muss die Schleife selbsttätig starten und in Runde 2 halten */
import { createRequire } from 'node:module';
const require2 = createRequire('/Users/jo/.local/lib/');
const { chromium } = require2('playwright-core');
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
await pg.goto('http://127.0.0.1:8099/psai/katalog/live/index.html?zeige=auto&frisch=1');
const rahmen = pg.frameLocator('iframe');
await rahmen.locator('#zeigeBlase').filter({ hasText: /blende ich aus|Layout Liste|Layout Split|wieder da/ }).first().waitFor({ timeout: 15000 });
console.log('Auto-Start ohne Klick: ja');
await rahmen.locator('#zeigeBlase').filter({ hasText: 'Gleich noch mal' }).waitFor({ timeout: 30000 });
console.log('Runde 1 endet in Schleifen-Hinweis: ja');
await pg.waitForTimeout(5000);
const aktiv = await rahmen.locator('#zeigeBlase').filter({ hasText: /blende ich aus|Layout Liste|Layout Split|wieder da/ }).first().isVisible();
console.log('Runde 2 läuft von selbst:', aktiv ? 'ja' : 'NEIN');
await b.close();
