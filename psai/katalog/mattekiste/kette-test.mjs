// Kettenfahrt: 25 verschiedene Ziele, Mindestabstand 100px, immer genau ein Ziel beleuchtet.
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
const require2 = createRequire('/Users/jo/.local/lib/');
const { chromium } = require2('playwright-core');
const TOUR = '/Users/jo/frontend-kit/psai/katalog/live/tour.json';
const tourVorher = readFileSync(TOUR, 'utf8');
writeFileSync(TOUR, JSON.stringify({ schleife: false, schritte: [] }));   // saubere Ausgangswelt
let fehler = 0;
const ok = (n, j) => { console.log((j ? 'OK | ' : 'FEHLER | ') + n); if (!j) fehler++; };
const befehl = { aktion: 'kette', anzahl: 25, abstand: 100,
  vor: [{ ziel: 'BI-Analyse öffnen' }, { ziel: 'Chronik-Drawer', nicht_da: '#dwZu' }] };
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://127.0.0.1:8099/psai/katalog/live/index.html');
const rahmen = pg.frameLocator('iframe');
await rahmen.locator('#zeigeStart').waitFor();
let antw = { status: 0 };
for (let versuch = 0; versuch < 3 && antw.status !== 202; versuch++) {                   // Auftrag erst, wenn der Client zeichenbereit ist
  antw = await fetch('http://127.0.0.1:8099/werkbank/regie', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(befehl) }).then(a => ({ status: a.status }));
  if (antw.status !== 202) await new Promise(r => setTimeout(r, 700));
}
ok('Ketten-Auftrag angenommen', antw.status === 202);
try {
  await rahmen.locator('#zeigeBlase').filter({ hasText: /1\/\d+ —/ }).waitFor({ timeout: 20000 });
  ok('Kette startet beim ersten Ziel', true);
} catch { ok('Kette startet beim ersten Ziel', false); }
let maxGlanz = 0;
for (let i = 0; i < 40; i++) {                                              // über die ganze Fahrt stichproben: nie mehr als ein Glanz
  const n = await pg.evaluate(() => document.getElementById('rahmen').contentDocument.querySelectorAll('.zeigerGlow').length);
  maxGlanz = Math.max(maxGlanz, n);
  await pg.waitForTimeout(300);
}
ok('Unterwegs leuchtet nie mehr als ein Ziel', maxGlanz <= 1);
try {
  await rahmen.locator('#zeigeBlase').filter({ hasText: /Kette: \d+ von/ }).waitFor({ timeout: 40000 });
  ok('Kette meldet ehrlichen Abschluss', true);
} catch { ok('Kette meldet ehrlichen Abschluss', false); }
const bericht = await pg.evaluate(() => document.getElementById('rahmen').contentWindow.zeigeKette);
ok('25 verschiedene Ziele angefahren', bericht && bericht.angesteuert >= 25);
const wege = (bericht && bericht.wege) || [];
let nah = null;
for (let i = 1; i < wege.length; i++) {
  const d = Math.hypot(wege[i].x - wege[i - 1].x, wege[i].y - wege[i - 1].y);
  if (d < 100) nah = `${wege[i - 1].name} → ${wege[i].name} = ${Math.round(d)}px`;
}
ok('Mindestens 100px zwischen je zwei Zielen', wege.length > 1 && !nah);
const punkte = new Set(wege.map(w => w.x + ':' + w.y));
ok('Kein Ziel doppelt befahren', punkte.size === wege.length);
// Zufallsfahrt: gleicher Same => dieselbe Route, anderer Same => andere Route, Abstand bleibt Gesetz
const zufallig = async (saat) => {
  await pg.evaluate(() => { document.getElementById('rahmen').contentWindow.zeigeKette = null; });   // alter Fahrbericht darf nicht durchgewinkt werden
  const a = await fetch('http://127.0.0.1:8099/werkbank/regie', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ aktion: 'kette', anzahl: 25, abstand: 100, zufall: true, saatkorn: saat }) });
  if (a.status !== 202) return null;
  await pg.waitForFunction(s => { const k = document.getElementById('rahmen').contentWindow.zeigeKette; return k && k.saatkorn === s && k.fertig; },
                           saat, { timeout: 45000 });
  return pg.evaluate(() => document.getElementById('rahmen').contentWindow.zeigeKette);
};
const r1 = await zufallig(42), r2 = await zufallig(42), r3 = await zufallig(7);
ok('Zufallsfahrt mit Saat_same planbar', !!r1 && r1.modus === 'zufall' && r1.angesteuert >= 20);
const spur = r => r ? r.wege.map(w => w.x + ':' + w.y).join('|') : '';
ok('Gleicher Same, dieselbe Route', !!r1 && !!r2 && spur(r1) === spur(r2));
ok('Anderer Same, andere Route', !!r1 && !!r3 && spur(r1) !== spur(r3));
let nahZ = 0;
[r1, r3].forEach(r => { if (!r) return; for (let i = 1; i < r.wege.length; i++)
  if (Math.hypot(r.wege[i].x - r.wege[i-1].x, r.wege[i].y - r.wege[i-1].y) < 100) nahZ++; });
ok('Auch in der Zufallsfahrt gilt der Mindestabstand', nahZ === 0);
await b.close();
writeFileSync(TOUR, tourVorher);
console.log(fehler ? `KETTE: ${fehler} FEHLER` : 'KETTE: alles OK');
process.exit(fehler ? 1 : 0);
