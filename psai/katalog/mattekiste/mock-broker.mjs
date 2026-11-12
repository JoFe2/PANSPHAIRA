// Fachschichten-Adapter für pan528 (M4): protokollgetreuer Host mit führender Ablage.
// Spiegelt Repo-Semantik: HMAC-CSRF wie origin-session-adapter, Session-Bootstrap,
// GUIDED_*-Verweigerungen, Readback gegen Datei (führender Speicher statt RAM-Echo).
// Nutzung: node mock-broker.mjs [port=8097] [srcDir] [leadingFile]
import http from 'node:http';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.argv[2] || 8097);
const SRC = process.argv[3] || process.env.HOME + '/PANSPHAIRA/src/pan528';
const LEDGER = process.argv[4] || process.env.HOME + '/.hermes/cache/scratch/psai528-leading.json';
const SPUR = process.env.HOME + '/.hermes/cache/scratch/psai528-spur.jsonl';
const DESKRIPTOR = process.env.HOME + '/.hermes/cache/scratch/psai528-deskriptor.json';
const KEYFILE = process.env.HOME + '/.hermes/cache/scratch/psai528-csrf.key';
const KEYS = ['physical', 'reserved', 'blocked', 'available', 'shipped', 'returned'];
const hash = s => createHmac('sha256', 'psai528-ledger').update(s).digest('hex');
let key = null;
async function keyBytes() {
  if (key) return key;
  try { key = (await readFile(KEYFILE)).toString().trim(); }
  catch { key = randomBytes(32).toString('hex'); await writeFile(KEYFILE, key); }
  return key;
}
const now = () => Date.now();
async function loadLedger() {
  try { return JSON.parse(await readFile(LEDGER, 'utf8')); }
  catch { return { zaehler: 0, failMode: false, runState: 'IDLE', run: null, binding: 'bind-init', stand: now(), sessions: {} }; }
}
async function saveLedger(d) { if (process.env.SPAR_TRACE) console.error('SPEICHER failMode=' + d.failMode, new Error().stack.split('\n')[2].trim().slice(0, 90)); await writeFile(LEDGER, JSON.stringify(d), { flush: true }); }
// ——— Inhaltssstrom: Seite hört, statt zu fragen ——————————————————————————
const stromKlienten = new Set();
function stromSende(art, nutzung = {}) {
  const koerper = 'event: inhalt\ndata: ' + JSON.stringify(Object.assign({ art }, nutzung)) + '\n\n';
  for (const c of stromKlienten) { try { c.write(koerper); } catch { } }
}
let spurGesamt = 0;
let producerAn = true;
const AUTO_TEXTE = [
  ['Zoll', 'CN-Sending 4471 als unverfänglich geprüft'],
  ['Bestand', 'Umlagerung PA-07 → PA-12 abgeschlossen'],
  ['Freigabe', 'Rechnung RE-2026-4413 freigegeben'],
  ['Sperrgut', 'Sperrgut-Posten 9 STK zur Klärung geöffnet'],
  ['Zoll', 'AEO-Meldung fristgerecht übermittelt'],
];
setInterval(async () => {           // der Geber arbeitet nur, wenn wirklich jemand hört
  if (!producerAn || !stromKlienten.size) return;
  const d = await loadLedger();
  if ((d.zaehler || 0) % 2 === 0) {
    const [g, t] = AUTO_TEXTE[Math.floor(Math.random() * AUTO_TEXTE.length)];
    d.events = [{ zeit: new Date().toISOString(), gruppe: g, text: t + ' #' + ((d.evNr || 0) + 1) }, ...(d.events || [])].slice(0, 40);
    d.evNr = (d.evNr || 0) + 1;
    d.failMode = (await loadLedger()).failMode; await saveLedger(d);
    stromSende('ticker');
  } else {
    d.zaehler = (d.zaehler || 0) + 1; d.stand = now();
    d.failMode = (await loadLedger()).failMode; await saveLedger(d);
    stromSende('kpi'); stromSende('trend');
  }
}, 6000).unref();
setInterval(() => { for (const c of stromKlienten) { try { c.write(':ping\n\n'); } catch { } } }, 20000).unref();

const val = avail => Object.assign(Object.fromEntries(KEYS.map(k => [k, 0])), { physical: avail, available: avail });

async function satzLies() {
  try { return JSON.parse(await readFile(DESKRIPTOR, 'utf8')); }
  catch {
    const ws = JSON.parse(await readFile(process.env.HOME + '/frontend-kit/psai/katalog/konzept/beispiele/workspace.minimal.json', 'utf8'));
    return { arbeitsblatt: ws, version: 'host-1' };
  }
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-credentials': 'true' };
  const json = (code, obj, extra = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...cors, ...extra }); res.end(JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') return json(204, {});
  const D = await loadLedger();
  try {
    // Session-Bootstrap wie origin-session-adapter: Owner-Token → Cookie + HMAC-CSRF
    if (p === '/session/bootstrap' && req.method === 'POST') {
      const token = randomBytes(24).toString('base64url');
      const csrf = createHmac('sha256', await keyBytes()).update('workspace-csrf-v1:' + token).digest('hex');
      D.sessions = Object.assign(D.sessions || {}, { [hash(token)]: { role: 'reviewer', csrfDigest: hash(csrf), expiresAtMs: now() + 86400000 } });
      await saveLedger(D);
      return json(200, { csrf, token }, { 'set-cookie': `psai528=${token}; Path=/; SameSite=Strict` });
    }
    const token = (req.headers.cookie || '').match(/psai528=([^;]+)/)?.[1];
    const row = token && D.sessions?.[hash(token)];
    async function requireCsrf() {
      if (!row) throw new Error('HOSTED_SESSION_DENIED');
      const csrf = req.headers['x-pan527-csrf'];
      if (typeof csrf !== 'string' || !/^[a-f0-9]{64}$/.test(csrf)) throw new Error('HOSTED_CSRF_DENIED');
      if (Date.now() > (row.expiresAtMs || 0)) throw new Error('HOSTED_SESSION_EXPIRED');
      if (!timingSafeEqual(Buffer.from(hash(csrf), 'hex'), Buffer.from(row.csrfDigest, 'hex'))) throw new Error('HOSTED_CSRF_DENIED');
    }
    if (p === '/strom') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'connection': 'keep-alive', ...cors });
      res.write('retry: 1500\n\n');
      res.write('event: bereit\ndata: {}\n\n');
      stromKlienten.add(res);
      req.on('close', () => stromKlienten.delete(res));
      return;
    }
    if (p === '/api/spur' && req.method === 'POST') {   // Tretspur der Fläche: Person, Tat, Zeit — der Host führt Buch
      let buf = ''; for await (const c of req) buf += c;
      const versuche = buf.length > 64 * 1024 ? [] : [JSON.parse(buf)].flat();
      const zeilen = versuche.filter(x => x && typeof x === 'object').slice(0, 50);
      if (zeilen.length) {
        await appendFile(SPUR, zeilen.map(z => JSON.stringify(Object.assign({ zeit: new Date().toISOString() }, z))).join('\n') + '\n');
        spurGesamt += zeilen.length;
        stromSende('spur', { nr: spurGesamt });
      }
      return json(202, { ok: true, verworft: versuche.length - zeilen.length });
    }
    if (p === '/api/spur') {
      let alle = []; try { alle = (await readFile(SPUR, 'utf8')).trim().split('\n').slice(-Number(url.searchParams.get('seit') || 200)).map(l => JSON.parse(l)); } catch { }
      return json(200, { spuren: alle });
    }
    if (p === '/api/deskriptor') {
      return json(200, await satzLies());
    }
    if (p === '/mock/satz' && req.method === 'POST') {
      let buf = ''; for await (const c of req) buf += c;
      try { JSON.parse(buf); } catch { return json(400, { error: 'kein JSON' }); }
      await writeFile(DESKRIPTOR, buf, { flush: true });
      stromSende('satz');
      return json(200, { ok: true, byte: buf.length });
    }
    if (p === '/mock/producer') { producerAn = url.searchParams.get('on') !== '0'; return json(200, { an: producerAn }); }
    if (p === '/mock/kpi') {
      D.zaehler = url.searchParams.has('wert') ? Number(url.searchParams.get('wert')) : (D.zaehler || 0) + 1;
      D.stand = now(); await saveLedger(D);
      stromSende('kpi'); stromSende('trend');
      return json(200, { ok: true, zaehler: D.zaehler });
    }
    if (p === '/api/ask') return json(200, { answer: 'guided demo' });
    if (p === '/api/status') return json(200, { authority: { profile: { profileId: 'SAFE_GUIDED' } }, template: 'tpl.demo.1' });
    if (p === '/api/events') {
      if (D.failMode) return json(503, { error: 'Quelle blockiert' });
      if (!D.anchor) { D.anchor = now(); await saveLedger(D); }
      const base = [
        { zeit: new Date(D.anchor - 4000).toISOString(), gruppe: 'Freigabe', text: 'AP-PAN316 zur Freigabe vorgemerkt' },
        { zeit: new Date(D.anchor - 60000).toISOString(), gruppe: 'Bestand', text: 'Sperrbestand 6 STK aufgelöst' },
      ];
      const frisch = (D.events || []).map(e => ({ zeit: e.zeit, gruppe: e.gruppe, text: e.text }));
      return json(200, { events: frisch.concat(base) });
    }
    if (p === '/api/evreset' && req.method === 'POST') { D.events = []; D.evNr = 0; await saveLedger(D); stromSende('ticker'); return json(200, { ok: true }); }
    if (p === '/api/event') {
      const g = url.searchParams.get('gruppe') || 'Fachlich';
      D.events = [{ zeit: new Date().toISOString(), gruppe: g, text: (url.searchParams.get('text') || 'Ereignis') + ' #' + ((D.evNr || 0) + 1) }, ...(D.events || [])].slice(0, 40);
      D.evNr = (D.evNr || 0) + 1;
      await saveLedger(D);
      stromSende('ticker');
      return json(200, { ok: true, gesamt: D.events.length });
    }
    if (p === '/api/trend') {
      if (D.failMode) return json(503, { error: 'Quelle blockiert' });
      return json(200, { punkte: 12, reihen: [
        { titel: 'Wareneingang', werte: [4, 6, 5, 8, 7, 9, 10, 9, 12, 11, 13, D.zaehler % 5 + 14] },
        { titel: 'Reserviert', werte: [2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8] },
        { titel: 'Freigegeben', werte: [1, 1, 2, 2, 3, 3, 4, 5, 6, 6, 7, 9] },
      ] });
    }
    if (p === '/api/kennzahl') {
      if (D.failMode) return json(503, { error: 'Quelle blockiert' });
      return json(200, { wert: D.zaehler, einheit: 'geprüfte Rechnungen', stand: new Date(D.stand || now()).toISOString(), quelle: 'leading-file' });
    }
    if (p === '/mock/fail') { D.failMode = url.searchParams.get('on') === '1'; const frisch = await loadLedger(); frisch.failMode = D.failMode; await saveLedger(frisch); stromSende('status'); return json(200, { failMode: frisch.failMode }); }
    const st = () => ({
      status: D.runState || 'IDLE', operationId: D.run?.operationId || null, binding: D.binding || 'bind-1',
      childCompleted: !!D.run?.childCompleted, abortAcknowledged: !!D.run?.abortAcknowledged,
      expectedBusinessValue: (D.runState || 'IDLE') === 'IDLE' ? null : val(4),
      observedBusinessValue: ['SUCCEEDED', 'FAILED'].includes(D.runState) ? val(4) : null,
    });
    if (p === '/guided/status') {
      if (D.run?.pending && !D.failMode) {
        D.run.pending = false; D.run.childCompleted = true; D.runState = 'SUCCEEDED';
        D.zaehler = (D.zaehler || 0) + 1; D.stand = now();
        await saveLedger(D);
        await appendFile(LEDGER + '.log', JSON.stringify({ e: 'child-complete', zeit: new Date().toISOString(), zaehler: D.zaehler }) + '\n');
        stromSende('kpi'); stromSende('trend');
      }
      return json(200, st());
    }
    if (p === '/guided/readback') {
      const fresh = JSON.parse(await readFile(LEDGER, 'utf8'));
      return json(200, { readback: true, quelle: 'leading-file', zaehler: fresh.zaehler, runState: fresh.runState || 'IDLE', stand: fresh.stand || null });
    }
    if (p === '/guided/command') {
      await requireCsrf();
      let buf = ''; for await (const c of req) buf += c;
      const body = JSON.parse(buf);
      const a = body.action;
      if (!/^operation:[a-z0-9][a-z0-9._-]{2,63}$/.test(body.operationId || '')) throw new Error('GUIDED_COMMAND_DENIED');
      if (a === 'RUN_STARTER') {
        if ((D.runState || 'IDLE') !== 'IDLE') throw new Error('GUIDED_STARTER_NOT_IDLE_DENIED');
        D.run = { operationId: body.operationId, pending: true, childCompleted: false, abortAcknowledged: false };
        D.runState = 'OUTCOME_UNKNOWN'; D.binding = 'bind-' + Math.random().toString(16).slice(2, 8);
        await saveLedger(D);
        return json(200, { ...st(), status: 'OUTCOME_UNKNOWN' });
      }
      if (a === 'ABORT_STARTER') {
        if (D.runState === 'OUTCOME_UNKNOWN' && !D.run?.childCompleted) { D.run.abortAcknowledged = true; await saveLedger(D); }
        return json(200, st());
      }
      if (a === 'RESET_STARTER') {
        if (['SUCCEEDED', 'FAILED'].includes(D.runState)) {
          if (!D.run?.childCompleted) throw new Error('GUIDED_UNRESOLVED_EFFECT_DENIED');
          D.run = null; D.runState = 'IDLE'; D.binding = 'bind-' + Math.random().toString(16).slice(2, 8);
          await saveLedger(D);
        }
        return json(200, st());
      }
      if (a === 'SUGGEST_STARTER') return json(200, { schemaVersion: 'pansphaira.guided-native/suggestion/v1', planOnly: true, activationAuthorized: false, modelInvocation: 'NOT_REQUESTED', suggestion: { kind: 'RUN_CONTROLLED_NATIVE_STARTER' } });
      throw new Error('GUIDED_COMMAND_DENIED');
    }
    let rel = (p === '/' || p === '/guided') ? 'screen.html' : p.replace(/^\//, '');
    rel = rel.replace(/^guided\//, '');
    rel = normalize(rel).replace(/^(\.\.[\/\\])+/, '');
    const body = await readFile(join(SRC, rel));
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'content-type': mime[extname(rel)] || 'application/octet-stream', ...cors });
    res.end(body);
  } catch (e) { json(403, { error: String(e.message || e) }); }
}
http.createServer((req, res) => handle(req, res).catch(() => { res.writeHead(404); res.end('not found'); })).listen(PORT, '127.0.0.1');
console.log('fachschichten-adapter :' + PORT + ' ledger=' + LEDGER);
