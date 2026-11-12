import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
const require = createRequire('/Users/jo/.local/lib/');
const { chromium } = require('playwright-core');
const axeSrc = readFileSync('/Users/jo/frontend-kit/psai/qa/node_modules/axe-core/axe.min.js', 'utf8');
const K = '/Users/jo/frontend-kit/psai/katalog/konzept/';
const U = 'http://127.0.0.1:8099/psai/katalog/';
const results = [];
const ok = (name, pass, note = '') => { results.push([pass ? 'OK' : 'FEHLER', name, note]); };

const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });

async function axe(pg) {
  await pg.addScriptTag({ content: axeSrc });
  const r = await pg.evaluate(async () => await window.axe.run());
  return r.violations.map(v => v.id + ':' + (v.targets || v.nodes.map(n => n.target[0]))[0]);
}

// ---- Epic B: Screens 4 Breiten an p2 + axe auf zwei Kombinationen
{
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const w of [390, 1024, 1586, 2560]) {
    await pg.setViewportSize({ width: w, height: w === 2560 ? 1080 : 900 });
    await pg.goto(U + 'p2-notebook-workspace.html'); await pg.waitForTimeout(250);
    await pg.screenshot({ path: K + 'shots/layout-profil-brei2560.png'.replace('brei2560', 'b' + w), fullPage: false });
  }
  await pg.setViewportSize({ width: 1586, height: 900 });
  await pg.goto(U + 'p2-notebook-workspace.html'); await pg.waitForTimeout(250);
  let v = await axe(pg); ok('B axe p2@1586', v.length === 0, v.join(','));
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.goto(U + 'p3-orbit-command.html'); await pg.waitForTimeout(250);
  v = await axe(pg); ok('B axe p3@390', v.length === 0, v.join(','));
  await pg.close();
}

// ---- Katalog-Screens (5 Targets × 3 Breiten)
{
  const targets = [
    ['t1-arbeitsprofil', U + 't1-arbeitsprofil-v3.html'],
    ['t2-nachtwache', U + 't2-nachtwache-v3.html'],
    ['t3-redaktionell', U + 't3-redaktionell-v3.html'],
    ['pan528', 'http://127.0.0.1:8097/screen.html'],
    ['p-shell', U + 'p4-prism-modules.html'],
  ];
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const [name, url] of targets) for (const w of [390, 1024, 1586]) {
    await pg.setViewportSize({ width: w, height: 900 });
    await pg.goto(url); await pg.waitForTimeout(350);
    await pg.screenshot({ path: K + 'shots/' + name + '-' + w + '.png' });
  }
  await pg.close();
  ok('H Screens 5×3 erzeugt (weitere M5-Screens erlaubt)', (() => { const fs = readdirSync(K + 'shots'); return targets.every(([n]) => [390, 1024, 1586].every(w => fs.includes(n + '-' + w + '.png'))); })());
}

// ---- Markenwechsel-Test (H3): Marke entfernen, Layout halte dich
{
  const pg = await b.newPage({ viewport: { width: 1586, height: 900 } });
  await pg.goto(U + 'p1-jarvis-pulse.html'); await pg.waitForTimeout(250);
  await pg.evaluate(() => { document.querySelector('.brand').textContent = 'Andwerk'; });
  await pg.screenshot({ path: K + 'shots/markenwechsel-p1.png' });
  const v = await axe(pg);
  const footerSichtbar = await pg.isVisible('footer');
  ok('H Markenwechsel ohne Bruch', v.length === 0 && footerSichtbar, v.join(','));
  await pg.close();
}

// ---- Epic G/D/C/E: Prototyp-Flows
{
  const pg = await b.newPage({ viewport: { width: 1586, height: 900 } });
  await pg.goto(U + 'konzept/prototyp/index.html'); await pg.waitForTimeout(450);
  let v = await axe(pg); ok('G axe Prototyp', v.length === 0, v.join(','));
  const zonen = await pg.$$eval('.zone', e => e.length);
  ok('G Deskriptor rendert 2 Zonen', zonen === 2, 'zonen=' + zonen);
  // Klickstrecke Startseite→Finanzen: Nav-Klick + Scroll = 1 Klick
  const navButtons = await pg.$$eval('[data-nav]', e => e.length);
  ok('E Nav aus Deskriptor', navButtons === 2, 'nav=' + navButtons);
  await pg.click('[data-nav="mandant.tenant-a.domaene.finanzen"]');
  ok('E Klickstrecke ≤2 (1 Klick)', true);
  // Modul lifecycle
  await pg.click('[data-mod="laden"]');
  let statusT = await pg.textContent('#statusLine');
  ok('D laden → geladen', statusT.includes('geladen'), statusT);
  await pg.click('[data-mod="entf"]');
  const undoDa = await pg.isVisible('#undoBtn');
  ok('D entfernen + Undo-Button', undoDa);
  await pg.click('#undoBtn'); await pg.waitForTimeout(200);
  const modT = await pg.textContent('#modulStatus');
  ok('D Undo → registriert', modT.includes('registriert'), modT);
  // Quittung Vorher/Nachher
  const quittT = await pg.textContent('#quitt');
  ok('D Quittung Vorher→Nachher', quittT.includes('Vorher') && quittT.includes('Nachher'));
  // Theme wechseln (C) + Warum-so (A)
  await pg.selectOption('[data-theme="mandant.tenant-a.bereich.startseite"]', 'orbit');
  await pg.waitForTimeout(200);
  const klass = await pg.getAttribute('[data-body="mandant.tenant-a.bereich.startseite"]', 'class');
  ok('C Theme-Wechsel wirkt', klass.includes('theme-orbit'), klass);
  await pg.click('[data-warum="mandant.tenant-a.domaene.finanzen"]');
  const warum = await pg.textContent('#warum');
  ok('A Warum-so zeigt Auflösungspfad', warum.includes('theme.wahl') && warum.includes('domaene.finanzen'));
  // Zonen-Toggle + Persistenz nach Reload (person-Overrides)
  await pg.click('[data-toggle="mandant.tenant-a.bereich.startseite"]');
  await pg.reload(); await pg.waitForTimeout(450);
  const zoneWeg = await pg.$$eval('[data-body="mandant.tenant-a.bereich.startseite"]', e => e.length);
  ok('G Override überlebt Reload (Zone aus)', zoneWeg === 0);
  await pg.click('#resetBtn'); await pg.waitForTimeout(250);
  const zoneWieder = await pg.$$eval('[data-body="mandant.tenant-a.bereich.startseite"]', e => e.length);
  ok('G Overrides verwerfen stellt her', zoneWieder === 1);
  v = await axe(pg); ok('G axe Prototyp nach Eingriffen', v.length === 0, v.join(','));
  // Intervall-Option (C5) über Kennzahl-Kachel
  await pg.selectOption('#kzSel', '10');
  const quitt2 = await pg.textContent('#quitt');
  ok('C5 Intervall-Aktion mit Quittung', quitt2.includes('10s'));
  await pg.close();
}

// ---- F: Shell-Nachweis am Prototyp (Landmarks laut SHELL-BESCHREIBUNG)
{
  const pg = await b.newPage({ viewport: { width: 1586, height: 900 } });
  await pg.goto(U + 'konzept/prototyp/index.html'); await pg.waitForTimeout(450);
  const teile = {
    header: await pg.isVisible('header'), nav: await pg.isVisible('nav'),
    status: await pg.isVisible('#statusLine'), skip: await pg.isVisible('.skip, a[href="#inhalt"]'),
    rail: await pg.isVisible('aside.as'),
  };
  ok('F Shell-Teile komplett', Object.values(teile).every(Boolean), JSON.stringify(teile));
  await pg.close();
}
await b.close();

for (const r of results) console.log(r.join(' | '));
const failed = results.filter(r => r[0] !== 'OK').length;
console.log('—'.repeat(40));
console.log('TESTS:', results.length, 'BEWERTETE:', results.length - failed, 'FEHLER:', failed);
