// a11y-Prüfer: lädt URL, injiziert axe-core, meldet Verletzungen. Exit 1 bei Befunden.
// Nutzung: node a11y.mjs <url> [--wait ms]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/jo/.local/lib/');
const { chromium } = require('/Users/jo/.local/node_modules/playwright-core/index.js');
const axeSrc = readFileSync(new URL('./node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

const [url, ...rest] = process.argv.slice(2);
if (!url) { console.error('Nutzung: node a11y.mjs <url> [--wait ms]'); process.exit(2); }
const wait = +(rest.find((_, i) => rest[i - 1] === '--wait') || 400);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url);
await page.waitForTimeout(wait);
await page.addScriptTag({ content: axeSrc });
const res = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
await browser.close();
if (!res.violations.length) { console.log('axe: 0 Verletzungen ✓  (' + url + ')'); process.exit(0); }
console.log(`axe: ${res.violations.length} Regel(n) verletzt  (${url})`);
for (const v of res.violations) {
  console.log(`\n[${v.impact}] ${v.id}: ${v.help}`);
  console.log(`  Info: ${v.helpUrl}`);
  for (const n of v.nodes.slice(0, 4)) console.log(`  Ziel: ${n.target.join(' ')}`);
}
process.exit(1);
