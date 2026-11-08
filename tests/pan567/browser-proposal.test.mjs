// Original #567 B1 actual-browser proof on the existing 546 native fixture:
// real page action -> real POST -> existing native565 synthetic transport ->
// explicit confirmation -> same-draft readback via the existing 563 route.
// Desktop, 390px and 2x-zoom pictures plus an error/fallback observation are
// written as ACTUAL evidence. Synthetic transport only — never a real-model
// acceptance claim (AC01/AC06 remain NOT_RUN/blocked/open).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { nativeViewBrowserFixture546 } from '../pan546/browser-fixture.mjs';
import { localModelServer565, connectionOptions565, syntheticCredential565 } from '../pan565/native-fixture.mjs';
import { MODEL_CONNECTION_PROPOSAL_PURPOSE_V1 } from '../../src/pan565/native-model-connection.mjs';
const section = '[data-configuration-proposal]';
const posts = f => f.requests.filter(r => r.method === 'POST' && r.path.endsWith('/workspace/configuration-proposal'));
function evidence() { assert.ok(process.env.PAN546_BROWSER_EVIDENCE, 'PAN567 actual browser evidence required, never skip'); return process.env.PAN546_BROWSER_EVIDENCE; }
async function fixture() {
  const server = await localModelServer565(), privateRoot = mkdtempSync(join(tmpdir(), 'pan567-browser-secret-')), credentialFile = join(privateRoot, 'existing-model-credential');
  writeFileSync(credentialFile, syntheticCredential565 + '\n', { mode: 0o600 });
  const options = connectionOptions565(server, credentialFile, { grant: true });
  options.productGrant.allowedPurposes = [MODEL_CONNECTION_PROPOSAL_PURPOSE_V1];
  let f;
  try { f = await nativeViewBrowserFixture546({ configurationDrafts: true, configurationProposal: true, modelConnections: [options] }); }
  catch (e) { await server.close(); rmSync(privateRoot, { recursive: true, force: true }); throw e; }
  return { ...f, server, async close() { try { await f.close(); } finally { await server.close(); rmSync(privateRoot, { recursive: true, force: true }); } } };
}
const nativeRead = page => page.evaluate(async () => { const r = await fetch('/t/tenant-a/workspace/configuration', { credentials: 'same-origin', cache: 'no-store' }); return { status: r.status, value: await r.json() }; });
function pickAskable(read) {
  for (const q of read.questions) {
    const d = read.definitions[q.field];
    if (d.type === 'SECRET_REFERENCE' && d.allowedValues.includes(null)) return { field: q.field, value: null };
    if (d.type === 'INTEGER') return { field: q.field, value: d.allowedValues[0] };
    if (d.type === 'SET') return { field: q.field, value: [d.allowedValues[0]] };
    if (typeof d.allowedValues[0] === 'string') return { field: q.field, value: d.allowedValues[0] };
  }
  return null;
}

test('#567 real browser: intent -> bounded proposal -> explicit confirm -> same-draft readback, with 390/zoom/error evidence', async () => {
  const f = await fixture();
  try {
    await f.page.goto(f.tls.origin + '/t/tenant-a/workspace');
    await f.page.locator('body[data-owner-configuration-proposal="true"]').waitFor();
    // Existing native565 route does the real select/probe prerequisites. The
    // page's OWN session claim comes from the existing protected context
    // bootstrap (the same /workspace/context route the native model-connection
    // and draft-view modules use) — never from a denied DTO body, never a
    // guessed constant. Every real HTTP status/shape is checked at each step,
    // so a denial surfaces as its actual step instead of a TypeError.
    const checks = await f.page.evaluate(async () => {
      const base = '/t/tenant-a/workspace/model-connection';
      const context = await fetch('/t/tenant-a/workspace/context', { credentials: 'same-origin', cache: 'no-store' });
      if (context.status !== 200) return { step: 'context', status: context.status };
      const { sessionId: sid } = await context.json();
      if (typeof sid !== 'string') return { step: 'context-shape', status: context.status };
      const post = async (op, body) => { const r = await fetch(base + '/' + op, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json', 'x-pan565-session': sid }, body: JSON.stringify(body) }); return { status: r.status, value: await r.json() }; };
      const read = await fetch(base, { credentials: 'same-origin', cache: 'no-store', headers: { 'x-pan565-session': sid } });
      if (read.status !== 200) return { step: 'read', status: read.status };
      let state = await read.json();
      if (state?.binding?.sessionId !== sid || !Number.isSafeInteger(state?.revision)) return { step: 'read-shape', status: read.status };
      const selected = await post('select', { schemaVersion: 'pansphaira.workspace-model-connection/select/v1', expectedRevision: state.revision, connectionId: 'connection:synthetic-existing' });
      if (selected.status !== 200) return { step: 'select', status: selected.status };
      state = selected.value;
      for (const phase of ['REACHABILITY', 'AUTHENTICATION', 'MODEL_AVAILABILITY']) {
        const probed = await post('probe', { schemaVersion: 'pansphaira.workspace-model-connection/probe/v1', expectedRevision: state.revision, identityDigest: state.identityDigest, phase });
        if (probed.status !== 200) return { step: 'probe:' + phase, status: probed.status };
        state = probed.value;
      }
      return { sessionId: sid, identityDigest: state.identityDigest, checks: Object.fromEntries(Object.entries(state.checks).map(([k, v]) => [k, v.state])) };
    });
    assert.equal(checks.step, undefined, 'native prerequisite bootstrap completed: ' + JSON.stringify(checks));
    assert.match(String(checks.sessionId), /^session:[a-f0-9]{64}$/, 'the real server-bound native session identity');
    assert.equal(checks.checks.REACHABILITY, 'PASS'); assert.equal(checks.checks.AUTHENTICATION, 'PASS'); assert.equal(checks.checks.MODEL_AVAILABILITY, 'PASS');
    await f.page.goto(f.tls.origin + '/t/tenant-a/workspace#/workspace/configuration');
    await f.page.locator('[data-backend="configuration"]').waitFor();
    await f.page.locator('[data-configuration-steps] button[data-step="profile"]').click();
    await f.page.locator(section).waitFor();
    const draft = await nativeRead(f.page);
    const ask = pickAskable(draft.value);
    assert.ok(ask, 'current draft has an actual open question');
    f.server.setResponseText(JSON.stringify({
      schemaVersion: 'pansphaira.agent-configuration/proposal/v1', capabilityReference: 'configuration.onboarding.propose/v1', expectedRevision: draft.value.revision,
      proposals: [{ field: ask.field, value: ask.value, rationale: 'Aus den zugelassenen Werten des minimierten Kontexts abgeleitet.' }],
      clarifications: [{ field: ask.field, question: 'Darf dieser Punkt später erneut geprüft werden?' }],
    }));
    await f.page.locator(section + ' [data-proposal-intent]').fill('Ich möchte meine Benachrichtigungsgrundeinstellung sorgfältig und ohne Zeitdruck festlegen, weil sie täglich wirksam ist.');
    await f.page.getByRole('button', { name: 'Begrenzten Vorschlag anfragen', exact: true }).click();
    await f.page.locator(section + ' [data-proposal-field]').first().waitFor();
    await f.page.screenshot({ path: join(evidence(), 'pan567-desktop-proposal-answer.png') });
    // Exact semantic oracle: the ONE clarification card is the actual proposal
    // section paragraph owning this field's registered answer control. A bare
    // /Rückfrage/ text match is legitimately ambiguous — the section honestly
    // carries BOTH the real clarification line AND the explanatory plural copy
    // about clarifications — so neither .first() nor a broadened regex may
    // stand in for the closed per-field clarification itself.
    const clarification = f.page.locator(section + ' p').filter({ has: f.page.locator('[data-proposal-answer="' + ask.field + '"]') });
    await clarification.waitFor();
    await clarification.getByText('Darf dieser Punkt später erneut geprüft werden?').waitFor();
    assert.ok(((await clarification.textContent()) ?? '').startsWith('Rückfrage: ' + ask.field + ' — '), 'the clarification card names the actual open field of the current draft');
    // The clarification carries an ACTUAL answer control wired to the same
    // authoritative draft: reachable by keyboard, it opens the existing
    // per-question card — no fake conversation, no new store or authority.
    const answerButton = f.page.locator(section + ' [data-proposal-answer="' + ask.field + '"]');
    await answerButton.focus();
    assert.equal(await f.page.evaluate(() => document.activeElement?.dataset?.proposalAnswer ?? null), ask.field, 'explicit answer control owns the keyboard focus');
    await f.page.keyboard.press('Enter');
    await f.page.locator('#configuration-question').filter({ hasText: draft.value.definitions[ask.field].label }).waitFor();
    assert.ok(await f.page.locator('[data-question-reason]').isVisible(), 'the clarification opens the draft owner’s own actual question');
    assert.equal(await f.page.evaluate(() => document.activeElement?.id ?? null), 'configuration-value', 'keyboard answer path lands focus in the same-draft form');
    await f.page.getByRole('button', { name: 'Später beantworten — Eingabe behalten', exact: true }).click();
    assert.equal(await nativeRead(f.page).then(r => r.value.revision), draft.value.revision, 'deferring the manual answer wrote nothing');
    // The clarification answer opened the same-draft editor, which intentionally
    // moved the view to the configuration step, and the defer by design keeps
    // that editor card open without navigating back. The proposal section belongs
    // to the profile step (configuration-draft-view-v1.ts hides it on every other
    // step) — so navigate back with the ACTUAL step control before selecting;
    // no force-click, no visibility spoof, no relaxed oracle.
    await f.page.locator('[data-configuration-steps] button[data-step="profile"]').click();
    await f.page.locator(section + ' [data-proposal-field]').first().check();
    await f.page.getByRole('button', { name: 'Ausgewählte Felder bestätigen und Entwurf speichern', exact: true }).click();
    // The applied APPLIED readback schedules the view's own async reload
    // (configuration-draft-view-v1.ts: applied -> load), which honestly reports
    // its outcome on the view-level status and then re-renders the form onto the
    // next open question's step — show()/edit() switch to the configuration step
    // and showPresentation hides the profile-step proposal section again. A bare
    // wait for a VISIBLE APPLIED status inside the section therefore races that
    // reload and loses. The stable user-operable confirmation is: the actual
    // view-level readback status, the released step controls, then the real step
    // control back to the profile step — where the proposal section's own
    // APPLIED confirmation becomes visible to the user again. Ordinary
    // navigation, no force-click, no visibility spoof, same visible-status
    // assertion, same closed route/body semantics verified independently below.
    await f.page.locator('[data-backend="configuration"] > p[role="status"]').filter({ hasText: 'Gespeicherten Entwurf gelesen. Revision ' + (draft.value.revision + 1) + '.' }).waitFor();
    await f.page.waitForFunction(() => ![...document.querySelectorAll('[data-configuration-steps] button')].some(b => b.disabled));
    await f.page.locator('[data-configuration-steps] button[data-step="profile"]').click();
    await f.page.locator(section).getByRole('status').filter({ hasText: 'Bestätigter Delta gespeichert' }).waitFor();
    const applied = await nativeRead(f.page);
    assert.equal(applied.value.revision, draft.value.revision + 1, 'confirmation applied to the SAME authoritative draft');
    assert.deepEqual(applied.value.draft.fields[ask.field].value, ask.value);
    assert.equal(posts(f).length, 2, 'one propose and one confirm request over the protected route');
    await f.page.setViewportSize({ width: 390, height: 844 });
    await f.page.locator(section).scrollIntoViewIfNeeded();
    await f.page.screenshot({ path: join(evidence(), 'pan567-390-after-applied.png') });
    // Error path: real transport denial must surface the honest fallback
    // copy and keep manual (non-AI) continuation usable on the same draft.
    // The applied reload already completed above (its view-level readback and
    // released step controls were awaited there); re-asserting both here is a
    // cheap no-op that keeps this leg honest about the ACTUAL stable reload
    // state before the second, now failing, proposal request.
    f.server.setMode('AUTH_FAILED');
    await f.page.setViewportSize({ width: 1280, height: 900 });
    // Genuine 200% zoom under the page's own protected style-src 'self': the
    // CSP (a product property, never bypassed or relaxed here) blocks only the
    // INLINE style form, so the exact same html{zoom:2} rule travels as an
    // actual SAME-ORIGIN stylesheet — the same CSP class the product's own
    // app.css occupies. One page-level route serves this single test-local CSS
    // document; no product file, header, server or fixture security changes.
    // MEASURED, source-bound CSS layout zoom on the installed Chromium
    // (Playwright 1.63 → Chromium r1243; the parent's private assertion-
    // preserving metric probe measured at computed zoom 2: before height
    // 48.78125 / width 290.140625, after height 97.59375 / width 609.625,
    // clientWidth 1280 and devicePixelRatio 1 UNCHANGED). The earlier
    // "clientWidth halves" premise described browser-chrome page zoom and is
    // false for CSS zoom here; the parent's replacement "width doubles too"
    // premise is false as well, and the actual layout source says why: the
    // step button is width:100% (configuration-draft-v1.css:23) inside the
    // responsive auto-fit grid .configuration-layout with min track 18rem
    // (configuration-draft-v1.css:19) — its width is container-driven and
    // REFLOWS against the halved effective layout width clientWidth/zoom =
    // 640 CSS px, it is not a uniform scale. What the source and geometry do
    // guarantee, and what this leg therefore asserts: content/min-height-
    // driven boxes (configuration-draft-v1.css:22) scale exactly with the
    // computed zoom (height ×2); the button keeps filling EXACTLY 100% of
    // its step column at each zoom level (measured box arithmetic against
    // configuration-draft-v1.css:20-21: padding .6rem + 1px border = 21.2px
    // per zoom unit); the auto-fit grid cannot GAIN tracks when the effective
    // layout width halves, so the reflowed column never gets narrower in the
    // document's own layout coordinates and the real width is at least
    // doubled (measured 609.625/290.140625 = 2.1015 — the reflow gain above
    // the pure ×2 scale). Unchanged clientWidth and devicePixelRatio keep the
    // honest label: CSS layout zoom of the page content, NOT browser-chrome
    // page zoom and not device/output scaling.
    const zoomProbe = () => f.page.evaluate(() => { const b = document.querySelector('[data-configuration-steps] button[data-step="profile"]'); const s = document.querySelector('[data-configuration-steps]'); const layout = document.querySelector('.configuration-draft .configuration-layout'); const btn = b.getBoundingClientRect(), box = s.getBoundingClientRect(); return { zoom: getComputedStyle(document.documentElement).zoom, layoutZoom: parseFloat(getComputedStyle(document.documentElement).zoom), rectHeight: btn.height, rectWidth: btn.width, columnInset: box.width - btn.width, trackCount: getComputedStyle(layout).gridTemplateColumns.split(' ').filter(Boolean).length, clientWidth: document.documentElement.clientWidth, devicePixelRatio: window.devicePixelRatio }; });
    await f.page.route('**/pan567-zoom2.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: 'html{zoom:2}' }));
    const beforeZoom = await zoomProbe();
    await f.page.addStyleTag({ url: f.tls.origin + '/pan567-zoom2.css' });
    await f.page.waitForFunction(() => getComputedStyle(document.documentElement).zoom === '2');
    const afterZoom = await zoomProbe();
    console.info('PARENT_ZOOM101_METRICS ' + JSON.stringify({ beforeZoom, afterZoom }));
    assert.equal(afterZoom.zoom, '2', 'the same-origin stylesheet is the actual computed zoom on the live document');
    assert.ok(Math.abs(afterZoom.rectHeight / beforeZoom.rectHeight - 2) < 0.01, 'genuine CSS layout zoom: the content/min-height-driven real step button is laid out exactly twice as tall');
    assert.ok(Math.abs(beforeZoom.columnInset - 21.2 * beforeZoom.layoutZoom) < 0.5, 'at zoom 1 the step button fills exactly 100% of its column (measured box arithmetic against configuration-draft-v1.css:20-23)');
    assert.ok(Math.abs(afterZoom.columnInset - 21.2 * afterZoom.layoutZoom) < 0.5, 'at 200% zoom the button still fills exactly 100% of its REFLOWED step column — width is container-driven per source, never an assumed uniform scale');
    assert.ok(afterZoom.trackCount <= beforeZoom.trackCount, 'halving the effective layout width (clientWidth/zoom) cannot add auto-fit tracks in the responsive grid of configuration-draft-v1.css:19 — real responsive reflow, measured');
    assert.ok((afterZoom.rectWidth + afterZoom.columnInset) / afterZoom.layoutZoom >= (beforeZoom.rectWidth + beforeZoom.columnInset) / beforeZoom.layoutZoom - 0.5, 'the reflowed step column is not narrower in the document own layout coordinates — reflow redistributed width, it did not shrink the widget');
    assert.ok(afterZoom.rectWidth / beforeZoom.rectWidth >= 1.995, 'the layout-scale floor holds for the container-driven width too (measured 2.1015 = ×2 zoom scale plus the measured auto-fit reflow gain)');
    assert.equal(afterZoom.clientWidth, beforeZoom.clientWidth, 'CSS layout zoom keeps the root layout viewport in client coordinates on installed Chromium — honestly CSS content zoom, NOT browser-chrome page zoom');
    assert.equal(afterZoom.devicePixelRatio, beforeZoom.devicePixelRatio, 'output scaling alone is honestly NOT claimed as zoom');
    // The zoom leg must be REAL traffic: the next request is the actual second
    // proposal over the SAME protected route and the SAME local synthetic peer.
    const modelPostsBeforeFailure = f.server.post(), modelGetsBeforeFailure = f.server.get();
    await f.page.locator('[data-backend="configuration"] > p[role="status"]').filter({ hasText: 'Gespeicherten Entwurf gelesen. Revision ' + applied.value.revision + '.' }).waitFor();
    await f.page.waitForFunction(() => ![...document.querySelectorAll('[data-configuration-steps] button')].some(b => b.disabled));
    await f.page.locator('[data-configuration-steps] button[data-step="profile"]').click();
    await f.page.locator(section + ' [data-proposal-intent]').fill('Ein zweiter Vorschlag bei ausgefallener Authentifizierung der bestehenden Verbindung.');
    await f.page.getByRole('button', { name: 'Begrenzten Vorschlag anfragen', exact: true }).click();
    // Truthful unavailable status, read from the section's OWN live region: the
    // exact registered product copy (configuration-proposal-v1.ts:35) for a
    // MODEL_UNAVAILABLE readback; the reason is one of the two closed codes the
    // real transport path derives for a dispatched provider failure
    // (native-model-connection.mjs runProposal: PROVIDER_DISPATCH_UNCONFIRMED
    // when the broker consumed the attempt, MODEL_UNAVAILABLE_NO_RETRY when the
    // transport threw) — no optimistic wording, no re-labelled fallback.
    const errorStatus = f.page.locator(section + ' > p[role="status"]');
    await errorStatus.waitFor();
    await f.page.waitForFunction(sel => /^Modell nicht verfügbar \(/.test(document.querySelector(sel)?.textContent ?? ''), section + ' > p[role="status"]');
    const errorCopy = (await errorStatus.textContent()) ?? '';
    assert.match(errorCopy, /^Modell nicht verfügbar \((MODEL_UNAVAILABLE_NO_RETRY|PROVIDER_DISPATCH_UNCONFIRMED)\)\. Kein blinder Retry, keine erfundene Nutzung; ohne KI fortfahren\.$/, 'the failed leg reports the exact honest product readback copy at computed zoom 2');
    const afterError = await nativeRead(f.page);
    assert.equal(afterError.value.revision, applied.value.revision, 'failed proposal wrote nothing');
    // UNKNOWN full-hold and no provider switch are proven at the AUTHORITATIVE
    // connection readback over the same ordinary GET route in the same page
    // session — not by copy alone: the whole-run reservation stays held as
    // UNKNOWN_USAGE (native-model-connection.mjs readback semantics), the
    // selected connection, transport identity and session authority are the
    // original ones, and the single failed attempt physically travelled the
    // registered chat route of the SAME peer with the existing credential.
    const connectionAfter = await f.page.evaluate(async sid => { const r = await fetch('/t/tenant-a/workspace/model-connection', { credentials: 'same-origin', cache: 'no-store', headers: { 'x-pan565-session': sid } }); return { status: r.status, value: await r.json() }; }, checks.sessionId);
    assert.equal(connectionAfter.status, 200, 'the authoritative connection readback stays readable over the existing protected route');
    assert.equal(connectionAfter.value.binding?.sessionId, checks.sessionId, 'same originating session authority after the failure — no rebind');
    assert.equal(connectionAfter.value.selectedConnectionId, 'connection:synthetic-existing', 'the same registered connection remains selected — no provider switch happened');
    assert.equal(connectionAfter.value.identityDigest, checks.identityDigest, 'the transport identity digest is unchanged after the failed leg');
    assert.equal(connectionAfter.value.checks?.INFERENCE?.state, 'UNKNOWN_USAGE', 'the failed dispatch keeps its whole-run reservation held as UNKNOWN in the authoritative ledger readback — no invented zero usage');
    assert.equal(connectionAfter.value.checks?.INFERENCE?.reason, 'UNKNOWN_USAGE_RETAINED', 'the hold is honestly reported as retained, not dropped and not silently retried');
    // No-retry/no-provider-switch at the ACTUAL peer: exactly one further
    // dispatch, on the registered chat route, to the SAME local synthetic
    // server that answered every earlier phase.
    assert.equal(f.server.post(), modelPostsBeforeFailure + 1, 'exactly one model dispatch attempt on the failed leg — no automatic retry, no second request after an unresolved outcome');
    const failedDispatch = f.server.observations.at(-1);
    assert.equal(failedDispatch?.path, '/v1/chat/completions', 'the single failed attempt travelled the registered chat-completions route of the same peer');
    assert.equal(failedDispatch?.method, 'POST', 'the failed attempt was the chat dispatch itself');
    assert.equal(failedDispatch?.credentialPresent, true, 'the attempt carried the existing secret reference to the same peer — a real authenticated dispatch, not a pre-dispatch fabrication');
    assert.equal(failedDispatch?.body?.model, 'model:synthetic-v1', 'the failed attempt asked the registered model of the same peer — no provider or model switch');
    assert.equal(f.server.get(), modelGetsBeforeFailure, 'no fresh model listing either — the denial did not reopen provider discovery');
    assert.ok(await f.page.getByRole('button', { name: 'Ohne KI fortfahren', exact: true }).isEnabled(), 'manual same-draft fallback remains usable');
    await f.page.locator(section).scrollIntoViewIfNeeded();
    await f.page.screenshot({ path: join(evidence(), 'pan567-zoom200-error-fallback.png') });
    // The fallback is ACTUALLY usable: the dependent question the same draft
    // now asks is answered manually in the existing form, confirmed and
    // independently read back — same store, same CAS, no model involved.
    const asked = afterError.value.questions.find(q => q.field !== ask.field);
    assert.ok(asked, 'the same draft keeps its remaining question for manual continuation');
    assert.equal(afterError.value.definitions[asked.field].type, 'SET', 'the dependent question is the registered SET field of this fixture');
    // The remaining open question belongs to a field group the profile step
    // deliberately does not list; the form step control of the SAME draft shows
    // every registered field — again the actual navigation, no force-click and
    // no CSS trick makes a filtered-out control answer. Additionally the view
    // renders the data group's <details> CLOSED by default (configuration-
    // draft-view-v1.ts show(): only the context/goal groups start open), so its
    // registered edit button has no hit target until the group's own summary
    // disclosure is used — the actual user gesture, then verified open.
    await f.page.locator('[data-configuration-steps] button[data-step="configuration"]').click();
    await f.page.locator('[data-configuration-group="data"] > summary').click();
    await f.page.waitForFunction(() => document.querySelector('[data-configuration-group="data"]')?.open === true);
    await f.page.getByRole('button', { name: 'Bearbeiten: ' + afterError.value.definitions[asked.field].label, exact: true }).click();
    await f.page.locator('#configuration-question').filter({ hasText: afterError.value.definitions[asked.field].label }).waitFor();
    // The retained draft carries an actual current value for this SET field and
    // the editor honestly PRE-CHECKS every retained entry (configuration-
    // draft-view-v1.ts:134: input.checked = existing.value.includes(String(value)))
    // while readValue() saves ALL checked inputs. A lone .first().check() is a
    // no-op on an already-ticked box and proves nothing about selection
    // exclusivity — run101's ACTUAL readback [department, displayName,
    // employeeAlias, jobTitle] was exactly the retained current value, no
    // product change implied. The genuine ordinary manual SET answer instead:
    // ground the pre-checked state against the independently read current draft
    // value, then per registered allowed-value checkbox, in the exact render
    // order of allowedValues, deliberately KEEP the first allowed value ticked
    // and clear every other retained sibling by its own real click; verify the
    // editor's own checked set BEFORE saving, so the exact readback below
    // asserts precisely what the user actually left selected.
    const setValue = afterError.value.draft.fields[asked.field].value;
    const setBoxes = f.page.locator('.configuration-editor input[type="checkbox"]');
    const setBoxCount = await setBoxes.count();
    assert.equal(setBoxCount, afterError.value.definitions[asked.field].allowedValues.length, 'the editor renders one checkbox per registered allowed value (configuration-draft-view-v1.ts:134)');
    const preChecked = await f.page.evaluate(() => [...document.querySelectorAll('.configuration-editor input[type="checkbox"]')].filter(i => i.checked).map(i => i.value));
    assert.deepEqual([...preChecked].sort(), setValue.map(String).sort(), 'the editor pre-checks exactly the retained current draft value — nothing invented, nothing dropped');
    const setTarget = String(afterError.value.definitions[asked.field].allowedValues[0]);
    for (let i = 0; i < setBoxCount; i++) {
      const box = setBoxes.nth(i);
      const allowed = await box.getAttribute('value');
      if (allowed === setTarget) await box.check();
      else if (await box.isChecked()) await box.uncheck();
    }
    const selectedBeforeSave = await f.page.evaluate(() => [...document.querySelectorAll('.configuration-editor input[type="checkbox"]')].filter(i => i.checked).map(i => i.value));
    assert.deepEqual(selectedBeforeSave, [setTarget], 'the deliberate manual selection left exactly the one intended checkbox ticked before saving — siblings cleared by real clicks, no DOM forgery');
    await f.page.getByRole('button', { name: 'Bestätigen und Entwurf speichern', exact: true }).click();
    // The honest persistence confirmation is the configuration view's OWN
    // status element (same-origin readback "identisch"), not the first
    // role=status anywhere on the shell page.
    await f.page.locator('[data-backend="configuration"] > p[role="status"]').filter({ hasText: 'identisch' }).waitFor();
    const manualRead = await nativeRead(f.page);
    assert.equal(manualRead.value.revision, afterError.value.revision + 1, 'manual same-draft answer moved the revision once');
    assert.equal(manualRead.value.draft.fields[asked.field].confirmation, 'CONFIRMED');
    // Exact value readback: the editor renders one checkbox per registered
    // allowedValues entry in order (configuration-draft-view-v1.ts:134,
    // input.value = String(value)) and saves every checked entry, so after the
    // deliberate manual selection above — first allowed value kept, all other
    // pre-checked retained siblings cleared by real clicks and verified in the
    // DOM before submitting — the persisted set must be exactly that one
    // stringified registered value the user actually left ticked, nothing else.
    assert.deepEqual(manualRead.value.draft.fields[asked.field].value, [String(afterError.value.definitions[asked.field].allowedValues[0])], 'the manual SET answer persisted exactly the one checkbox the user actually ticked');
    assert.equal(f.server.post(), modelPostsBeforeFailure + 1, 'the manual continuation at computed zoom 2 dispatched nothing further to the model peer — the failed hold was not retried around the save');
    assert.equal(f.server.get(), modelGetsBeforeFailure, 'manual continuation reopened no provider listing on the peer either');
    await f.page.locator('.configuration-editor').scrollIntoViewIfNeeded();
    await f.page.screenshot({ path: join(evidence(), 'pan567-manual-answer-readback.png') });
    assert.equal(posts(f).length, 3, 'the manual continuation used the existing draft route, not a new proposal traffic path');
    assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});

test('#567 default-denied mount: without the qualified proposal owner the route is 404 and no fake model appears', async () => {
  const server = await localModelServer565(), privateRoot = mkdtempSync(join(tmpdir(), 'pan567-browser-denied-secret-')), credentialFile = join(privateRoot, 'existing-model-credential');
  writeFileSync(credentialFile, syntheticCredential565 + '\n', { mode: 0o600 });
  const options = connectionOptions565(server, credentialFile, { grant: true });
  options.productGrant.allowedPurposes = [MODEL_CONNECTION_PROPOSAL_PURPOSE_V1];
  const f = await nativeViewBrowserFixture546({ configurationDrafts: true, modelConnections: [options] });
  try {
    await f.page.goto(f.tls.origin + '/t/tenant-a/workspace');
    const denied = await f.page.evaluate(async () => { const r = await fetch('/t/tenant-a/workspace/configuration-proposal', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ schemaVersion: 'pansphaira.agent-configuration/proposal-request/v1', expectedRevision: 0, confirm: true, intent: 'Ohne qualifizierten Owner angefragt.' }) }); return { status: r.status, value: await r.json().catch(() => null) }; });
    assert.equal(denied.status, 404);
    await f.page.goto(f.tls.origin + '/t/tenant-a/workspace#/workspace/configuration');
    await f.page.locator('[data-backend="configuration"]').waitFor();
    await f.page.locator('[data-configuration-steps] button[data-step="profile"]').click();
    assert.equal(await f.page.locator(section).count(), 0, 'no proposal section without the qualified owner');
  } finally { await f.close(); await server.close(); rmSync(privateRoot, { recursive: true, force: true }); }
});
