// Meilenstein-Tests M1/M2/M3 (Goal PsAI-Composer-Umsetzung)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/jo/.local/lib/');
const { chromium } = require('playwright-core');
const axeSrc = readFileSync('/Users/jo/frontend-kit/psai/qa/node_modules/axe-core/axe.min.js', 'utf8');
const K = '/Users/jo/frontend-kit/psai/katalog/konzept/';
const results = [];
const ok = (name, pass, note = '') => { results.push([pass ? 'OK' : 'FEHLER', name, note]); };
async function axe(pg) {
  await pg.addScriptTag({ content: axeSrc });
  const r = await pg.evaluate(async () => await window.axe.run());
  return r.violations.map(v => v.id + ':' + (v.targets || v.nodes.map(n => n.target[0]))[0]);
}
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });

// ── M1: pan528 am Mock-Broker ──────────────────────────────────
{
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await pg.goto('http://127.0.0.1:8097/guided'); await pg.waitForTimeout(300);
  await pg.evaluate(() => fetch('/session/bootstrap', { method: 'POST' }).then(r => r.json()).then(d => sessionStorage.setItem('pan528-csrf', d.csrf)));
  await pg.reload(); await pg.waitForTimeout(500);
  let v = await axe(pg); ok('M1 axe Grundzustand', v.length === 0, v.join(','));
  const manifestGeld = await pg.evaluate(() => fetch('manifest.json').then(r => r.ok));
  ok('M1 Manifest wird geladen', manifestGeld);
  // Vorzustand lesen (Read-Aktion schreibt eigene Quittung) und ggf. zurücksetzen
  await pg.click('#refresh-status');
  await pg.waitForFunction(() => document.getElementById('receipt').textContent.includes('Nachher:'), null, { timeout: 5000 });
  if (!(await pg.textContent('#business-status')).includes('IDLE')) {
    await pg.click('#reset-starter');
    await pg.waitForFunction(() => document.getElementById('business-status').textContent === 'IDLE', null, { timeout: 5000 });
  }
  await pg.click('#run-starter');
  await pg.waitForFunction(() => document.getElementById('receipt').textContent.includes('Nachher: SUCCEEDED'), null, { timeout: 8000 });
  const rc = await pg.textContent('#receipt');
  ok('M1 Quittung Vorher→Nachher', rc.includes('Vorher: IDLE') && rc.includes('Nachher: SUCCEEDED'), rc.slice(0, 80));
  ok('M1 Rohlog vorhanden', await pg.isVisible('#receipt details'));
  const chronikN = await pg.$$eval('#chronik li', e => e.length);
  ok('M1 Chronik-Eintrag', chronikN >= 1, 'n=' + chronikN);
  const undo = await pg.$('.rc-undo');
  ok('M1 Undo-Button (Fenster 30s)', !!undo, '');
  if (undo) { await undo.click(); await pg.waitForTimeout(600); }
  const nachUndo = await pg.textContent('#business-status');
  ok('M1 Undo führt RESET aus → IDLE', nachUndo.trim() === 'IDLE', nachUndo);
  await pg.click('#refresh-status'); await pg.waitForTimeout(400);
  const rc2 = await pg.textContent('#receipt');
  ok('M1 Lese-Aktion ohne Undo mit Grund', rc2.includes('lesende Aktion'), rc2.slice(0, 60));
  v = await axe(pg); ok('M1 axe nach Aktionen', v.length === 0, v.join(','));
  await pg.close();
}

// ── M2/M3: Composer ────────────────────────────────────────────
{
  const pg = await b.newPage({ viewport: { width: 1586, height: 900 } });
  await pg.goto('http://127.0.0.1:8099/psai/katalog/konzept/prototyp/index.html');
  await pg.evaluate(() => { localStorage.clear(); });
  await pg.reload(); await pg.waitForTimeout(600);
  ok('M2 Kennzahl-Kachel rendert', await pg.isVisible('#kz'));
  await pg.waitForTimeout(800);
  const z0 = await pg.textContent('#kz .kette, #kzMeta').catch(() => '');
  const zustand = await pg.getAttribute('#kz', 'class');
  ok('M2 Zustand bereit nach erstem Tick', zustand.includes('kz-bereit'), zustand);
  // Intervall auf 10s
  await pg.selectOption('#kzSel', '10');
  const quittT = await pg.textContent('#quitt');
  ok('M2 Intervall-Quittung', quittT.includes('10s'));
  // Quelle blockieren → Alterung nach 2× Intervall
  await pg.click('[data-kz="fail"]');
  await pg.waitForTimeout(22000);
  const kzAlt = await pg.getAttribute('#kz', 'class');
  ok('M2 Alterung nach 2× Intervall', kzAlt.includes('kz-alternd') || kzAlt.includes('kz-quellfehler'), kzAlt);
  await pg.waitForTimeout(12000);
  const kzFehler = await pg.getAttribute('#kz', 'class');
  ok('M2 Quellfehler nach 3 Fehlversuchen', kzFehler.includes('kz-quellfehler'), kzFehler);
  // Pause
  await pg.click('[data-kz="pause"]');
  const pauTxt = await pg.textContent('#kz');
  ok('M2 Pause-Zustand mit Weiter', pauTxt.includes('Weiter'));
  await pg.click('[data-kz="fail"]'); // freigeben
  await pg.click('[data-kz="pause"]'); // weiter
  await pg.waitForTimeout(1200);
  const kzHeil = await pg.getAttribute('#kz', 'class');
  ok('M2 Erholung nach Quellen-Freigabe', kzHeil.includes('kz-bereit'), kzHeil);
  // M3: Personenprofile mit eigener Reihenfolge
  await pg.selectOption('#personSel', 'sachbearbeitung');
  await pg.waitForTimeout(300);
  const order0 = await pg.$$eval('.zone', es => es.map(e => e.dataset.zone));
  await pg.click('[data-runter="mandant.tenant-a.bereich.startseite"]');
  await pg.waitForTimeout(300);
  const order1 = await pg.$$eval('.zone', es => es.map(e => e.dataset.zone));
  ok('M3 Reihenfolge änderbar', order1[0] !== order0[0], order1.join(','));
  await pg.selectOption('#personSel', 'jo');
  await pg.waitForTimeout(300);
  const orderJo = await pg.$$eval('.zone', es => es.map(e => e.dataset.zone));
  ok('M3 andere Person bleibt unberührt (Deskriptor-Reihenfolge)', orderJo[0].includes('startseite'), orderJo.join(','));
  await pg.reload(); await pg.waitForTimeout(500);
  await pg.selectOption('#personSel', 'sachbearbeitung');
  await pg.waitForTimeout(300);
  const orderPersist = await pg.$$eval('.zone', es => es.map(e => e.dataset.zone));
  ok('M3 Person-Override überlebt Reload', orderPersist[0].includes('finanzen'), orderPersist.join(','));
  let v = await axe(pg); ok('M3 axe nach Personenwechsel', v.length === 0, v.join(','));
  await pg.close();
}

// reduced-motion-Pfad (M2-Pflicht)
{
  const pg = await b.newPage({ viewport: { width: 1586, height: 900 }, reducedMotion: 'reduce' });
  await pg.goto('http://127.0.0.1:8099/psai/katalog/konzept/prototyp/index.html');
  await pg.waitForTimeout(600);
  const läuft = await pg.isVisible('#kz');
  ok('M2 reduced-motion: alles nutzbar', läuft);
  await pg.close();
}

await b.close();
for (const r of results) console.log(r.join(' | '));
const failed = results.filter(r => r[0] !== 'OK').length;
console.log('—'.repeat(40));
console.log('M-TESTS:', results.length, 'OK:', results.length - failed, 'FEHLER:', failed);
