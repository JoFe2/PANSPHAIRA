// M6: Drawer-Mechanik, Perspektiven, Warum-so (Reihenfolge/Sperren), Agenten-Stufen 0–3.
import { createRequire } from 'node:module';
const require = createRequire('/Users/jo/.local/lib/');
const { chromium } = require('playwright-core');
const axeSrc = require('node:fs').readFileSync('/Users/jo/frontend-kit/psai/qa/node_modules/axe-core/axe.min.js', 'utf8');
const results = [];
const ok = (n, p, note = '') => results.push([p ? 'OK' : 'FEHLER', n, note]);
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://127.0.0.1:8099/psai/katalog/konzept/prototyp/index.html');
await pg.waitForSelector('#ticker'); await pg.waitForTimeout(400);
await pg.evaluate(() => localStorage.clear());

// ── Drawer: Fokus-Fang, Esc, Scroll-Merker ──
const maxS = await pg.evaluate(() => { const m = document.documentElement.scrollHeight - innerHeight; window.scrollTo(0, Math.min(400, m)); return m; });
await pg.waitForTimeout(150);
await pg.click('#dwBtn');
ok('M6 Drawer offen mit aria-modal', (await pg.getAttribute('#drawer', 'aria-modal')) === 'true' && await pg.isVisible('#drawer'));
const fokusInDrawer = await pg.evaluate(() => document.getElementById('drawer').contains(document.activeElement));
ok('M6 Fokus beim Öffnen im Drawer', fokusInDrawer);
for (let i = 0; i < 4; i++) await pg.keyboard.press('Tab');
ok('M6 Fokus-Fang: Tab bleibt im Drawer', await pg.evaluate(() => document.getElementById('drawer').contains(document.activeElement)));
await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
ok('M6 Esc schließt Drawer', await pg.isHidden('#drawer'));
ok('M6 Fokus kehrt zu Auslöser zurück', await pg.evaluate(() => document.activeElement.id === 'dwBtn'));
const scrollZurueck = await pg.evaluate(() => window.scrollY);
ok('M6 Scroll-Merker stellt Position wieder her', Math.abs(scrollZurueck - Math.min(400, maxS)) <= 5, 'y=' + scrollZurueck + ' max=' + maxS);

// ── Perspektiven am Modul ──
await pg.click('[data-pers="vergleich"]');
ok('M6 Vergleich zeigt Vorher/Nachher-Tabelle', (await pg.$$eval('#modulPers th', e => e.map(x => x.textContent))).includes('Vorher'));
ok('M6 aria-pressed wandert mit', (await pg.getAttribute('[data-pers="vergleich"]', 'aria-pressed')) === 'true' && (await pg.getAttribute('[data-pers="liste"]', 'aria-pressed')) === 'false');
await pg.click('[data-mod="laden"]');
await pg.click('[data-pers="rohlog"]');
const rohlog = await pg.textContent('#modulPers pre');
ok('M6 Rohlog zeigt Ereignis-Rohdaten', rohlog.includes('"aktion": "laden"') && rohlog.includes('"agentStufe"'), rohlog.slice(0, 60));
await pg.click('[data-pers="liste"]');
ok('M6 Liste stellt Betrags-Ansicht wieder her', !!(await pg.$('#modulPers #betrag')));

// ── Warum-so auch für Reihenfolge und Sperren ──
await pg.click('[data-warum="mandant.tenant-a.bereich.startseite"]');
const warum = await pg.textContent('#warum');
ok('M6 Warum-so erklärt Reihenfolge', warum.includes('Reihenfolge hier'), warum.slice(0, 80));
ok('M6 Warum-so erklärt Sperren', warum.includes('Sperren hier'));
await pg.click('[data-hoch="mandant.tenant-a.domaene.finanzen"]'); await pg.waitForTimeout(300);
await pg.click('[data-warum="mandant.tenant-a.domaene.finanzen"]');
ok('M6 Warum-so nach Sortierung: person-eigene Herkunft', (await pg.textContent('#warum')).includes('person-eigene Sortierung'));

// ── Agenten-Stufen ──
const zoneKl = () => pg.getAttribute('[data-body="mandant.tenant-a.domaene.finanzen"]', 'class');
const setAgent = async (stufe, bis) => {
  await pg.selectOption('#agStufe', String(stufe));
  if (bis) await pg.evaluate(v => { const i = document.getElementById('agBis'); i.value = v; i.dispatchEvent(new Event('change')); }, bis);
};
const themeAendern = async (wert) => {
  await pg.selectOption('[data-theme="mandant.tenant-a.domaene.finanzen"]', wert);
  await pg.waitForTimeout(250);
};
await setAgent(1, null);
const vor1 = await zoneKl();
await themeAendern('pulse');
ok('M6 Stufe 1: nur Vorschlag, nichts geändert', (await zoneKl()) === vor1 && (await pg.textContent('#chronikList')).includes('nur vorgeschlagen'));
await setAgent(2, '2027-01-01');
await themeAendern('pulse');
const chronik2 = await pg.textContent('#chronikList');
ok('M6 Stufe 2 mit gültigem Delegat: Änderung läuft', (await zoneKl()).includes('theme-pulse'));
ok('M6 Chronik-Eintrag mit „geändert durch“ + Enddatum', chronik2.includes('geändert durch Agent (Stufe 2') && chronik2.includes('Delegat bis 2027-01-01'));
await setAgent(2, '2020-01-01');
await themeAendern('orbit');
ok('M6 Abgelaufener Delegat: Verweigerung mit Quittung', (await zoneKl()).includes('theme-pulse') && (await pg.textContent('#chronikList')).includes('abgelaufen') && (await pg.textContent('#quitt')).includes('unverändert'));

// ── axe ──
await pg.addScriptTag({ content: axeSrc });
const rv = (await pg.evaluate(async () => await window.axe.run())).violations;
const v = rv.map(x => x.id);
ok('M6 axe 0 nach allem', v.length === 0, rv.map(x => x.id + ':' + x.nodes.map(n => n.target.join(' ')).slice(0, 3).join('|')).join(' ;; '));
await b.close();
for (const r of results) console.log(r.join(' | '));
console.log('M6: ' + results.filter(r => r[0] === 'OK').length + '/' + results.length + ' OK');
process.exit(results.some(r => r[0] !== 'OK') ? 1 : 0);
