// Zeigerführung: Knopf da, Zeiger wandert, Klicks wirken, Chronik gefüllt, axe 0.
import { createRequire } from 'node:module';
const require2 = createRequire('/Users/jo/.local/lib/');
const { chromium } = require2('playwright-core');
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://127.0.0.1:8099/psai/katalog/live/index.html');
const rahmen = pg.frameLocator('iframe');
await rahmen.locator('#zeigeStart').waitFor();
await rahmen.locator('#zeigeStart').click();
await pg.waitForTimeout(3500);
const pos = await pg.evaluate(() => { const z = document.getElementById('rahmen').contentDocument.getElementById('zeigeZeiger'); return { l: z.style.left, t: z.style.top }; });
console.log('Zeigerposition mitten im Ablauf:', JSON.stringify(pos));
// Einmal-Modus erzwingen: zweiter Klick auf denselben Knopf stoppt die Schleife → Ablauf steht fertig.
await rahmen.locator('#zeigeBlase').filter({ hasText: 'Gleich noch mal' }).waitFor({ timeout: 20000 });
await rahmen.locator('#zeigeStart').click();
await rahmen.locator('#zeigeBlase').filter({ hasText: 'Fertig' }).waitFor({ timeout: 8000 });
await pg.evaluate((src) => { document.getElementById('rahmen').contentWindow.__axe = src; }, require2('fs').readFileSync('/Users/jo/frontend-kit/psai/qa/node_modules/axe-core/axe.min.js', 'utf8'));
const chronik = await pg.locator('#rahmen').contentFrame().locator('#chronikList li').count().catch(() => -1);
const drawerSichtbar = await pg.locator('#rahmen').contentFrame().locator('#drawer').isVisible().catch(() => false);
console.log('Chronikeinträge:', chronik, '| Drawer offen nach Ablauf:', drawerSichtbar);
const axeSrc = require2('fs').readFileSync('/Users/jo/frontend-kit/psai/qa/node_modules/axe-core/axe.min.js', 'utf8');
await pg.addScriptTag({ content: axeSrc });
const v = await pg.frameLocator('iframe').locator('body').evaluate(async (b) => { const s = document.createElement('script'); s.textContent = window.__axe; document.head.appendChild(s); return (await window.axe.run()).violations.map(x => x.id); }, { fn: 1 });
console.log('axe-Verstöße:', v.length ? v.join(',') : 'keine');
await b.close();
