// M4: Fachschichten-Adapter — Bootstrap-CSRF, Readback-Nachweis, Failover gegen führende Ablage.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
const require = createRequire('/Users/jo/.local/lib/');
const { chromium } = require('playwright-core');
const results = [];
const ok = (n, p, note = '') => results.push([p ? 'OK' : 'FEHLER', n, note]);
const LEDGER = process.env.HOME + '/.hermes/cache/scratch/psai528-m4-ledger.json';
try { rmSync(LEDGER); } catch (e) {}
import { execSync } from 'node:child_process';
try { execSync("pkill -f 'mock-broker.mjs 8096'"); } catch (e) {}
await new Promise(r => setTimeout(r, 400));
const launch = () => spawn('node', [process.env.HOME + '/.hermes/cache/scratch/mock-broker.mjs', '8096', process.env.HOME + '/PANSPHAIRA/src/pan528', LEDGER], { stdio: 'ignore' });
let srv = launch();
await new Promise(r => setTimeout(r, 700));
const b = await chromium.launch({ executablePath: '/Users/jo/.hermes/tools/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('http://127.0.0.1:8096/guided'); await pg.waitForTimeout(300);

// CSRF-Handshake: ohne Token muss ein Kommando verweigert werden
const denied = await pg.evaluate(() => fetch('/guided/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'RUN_STARTER', operationId: 'operation:m4-test1', binding: {} }) }).then(r => r.json()));
ok('M4 CSRF-Handshake verweigert ohne Token', String(denied.error || '').includes('HOSTED_SESSION'), JSON.stringify(denied));
await pg.evaluate(() => fetch('/session/bootstrap', { method: 'POST' }).then(r => r.json()).then(d => sessionStorage.setItem('pan528-csrf', d.csrf)));
await pg.reload(); await pg.waitForTimeout(400);
await pg.click('#run-starter');
await pg.waitForFunction(() => document.getElementById('business-status').textContent === 'SUCCEEDED', null, { timeout: 8000 });
const rohlog = await pg.textContent('#receipt details pre');
ok('M4 Quittung trägt Readback aus führendem Speicher', rohlog.includes('\"readback\"') && rohlog.includes('leading-file'), rohlog.slice(0, 120));
const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
ok('M4 Führender Speicher zählt nach Readback', ledger.zaehler >= 1, JSON.stringify({ z: ledger.zaehler, s: ledger.runState }));

// Failover: Broker abschießen → Kennzahl altert → quellfehler; Neustart → gleiche Wahrheit
await pg.goto('http://127.0.0.1:8096/probe-kz'); await pg.close();
srv.kill('SIGKILL'); if (srv.exitCode === null && srv.signalCode === null) await Promise.race([new Promise(res => srv.on('exit', res)), new Promise(res => setTimeout(res, 2000))]); await new Promise(r => setTimeout(r, 300));
let down = false; for (let i = 0; i < 10; i++) { down = await fetch('http://127.0.0.1:8096/api/kennzahl').then(() => true).catch(() => false); if (!down) break; await new Promise(r => setTimeout(r, 200)); }
ok('M4 Quelle tot nach Abschießen', !down);
srv = launch(); await new Promise(r => setTimeout(r, 700));
const back = await fetch('http://127.0.0.1:8096/api/kennzahl').then(r => r.json());
const ledger2 = JSON.parse(readFileSync(LEDGER, 'utf8'));
ok('M4 Recovery: Zähler identisch zur Ablage (kein RAM-Echo)', back.wert === ledger2.zaehler, JSON.stringify({ api: back.wert, ledger: ledger2.zaehler }));
await b.close();
for (const r of results) console.log(r.join(' | '));
console.log('M4: ' + results.filter(r => r[0] === 'OK').length + '/' + results.length + ' OK');
process.exit(results.some(r => r[0] !== 'OK') ? 1 : 0);
