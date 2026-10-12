import test from 'node:test';
import assert from 'node:assert/strict';
import { processBrowserFixture562 } from '../pan562/browser-process-fixture.mjs';

const readDraft = page => page.evaluate(async () => {
 const response = await fetch('/t/tenant-a/workspace/configuration', {credentials:'same-origin', cache:'no-store'});
 return {status:response.status, value:await response.json()};
});

// Original A5-AC01: a complete native draft is not an applied plan. Reuse the
// exact protected563 source; do not turn this missing UI into synthetic PASS.
test('A5-AC01 actual existing563 native RESOLVED model-free draft offers a separately prepared configuration application plan', async () => {
 const f = await processBrowserFixture562();
 try {
  const page = f.page;
  await page.goto(f.tls.origin+'/t/tenant-a/bootstrap');
  await page.locator('[data-bootstrap-status][data-state="PROOF_PENDING"]').waitFor();
  await page.getByLabel('Kurzlebiger einmaliger Besitz- oder Wiederanmeldenachweis', {exact:true}).fill(f.grants[0].grant.proof);
  await page.locator('form button').click();
  await page.locator('[data-bootstrap-entry][data-outcome="SESSION_BOUND"]').waitFor();
  await page.getByRole('link', {name:'Fortsetzen — gespeicherten Entwurf öffnen', exact:true}).click();
  await page.locator('[data-backend="configuration"][data-outcome="EMPTY"]').waitFor();
  await page.getByRole('button', {name:'Ohne KI fortfahren', exact:true}).click();
  await page.locator('[data-backend="configuration"][data-outcome="PERSISTED"]').waitFor();
  await page.getByRole('button', {name:'Formular — derselbe Entwurf', exact:true}).click();
  let previous = -1, turns = 0;
  while (true) {
   const readback = await readDraft(page);
   assert.equal(readback.status, 200);
   assert.equal(readback.value.activationAuthorized, false);
   assert.equal(readback.value.draft.fields['model.reference'].value, 'NONE');
   if (readback.value.outcome === 'RESOLVED') {assert.equal(readback.value.unresolvedFields.length, 0); break;}
   assert.ok(turns++ < 37); assert.ok(readback.value.revision > previous); previous = readback.value.revision;
   const question = readback.value.questions[0], definition = readback.value.definitions[question.field];
   if (definition.type === 'SET') for (const input of await page.locator('.configuration-editor input[type="checkbox"]').all()) await input.check();
   else if (definition.type === 'INTEGER') await page.locator('.configuration-editor input').fill(String(definition.allowedValues[0]));
   else await page.locator('.configuration-editor select').selectOption(JSON.stringify(question.field === 'goal.purpose' ? 'employee.directory.summary' : definition.allowedValues[0]));
   await page.getByRole('button', {name:'Bestätigen und Entwurf speichern', exact:true}).click();
   await page.locator('[data-backend="configuration"][data-outcome="PERSISTED"]').waitFor();
  }
  await page.locator('[data-configuration-steps]').getByRole('button', {name:'Plan und Ergebnis', exact:true}).click();
  assert.match(await page.locator('[data-configuration-result]').innerText(), /vollständig/);
  assert.equal((await readDraft(page)).value.activationAuthorized, false);
  assert.equal(f.requests.filter(r => r.method === 'POST' && /\/model-connection\/(select|probe|consent)$/.test(r.path)).length, 0);
  assert.deepEqual(f.errors, []);
  assert.equal(await page.getByRole('button', {name:'Einrichtungsplan vorbereiten', exact:true}).count(), 1,
   'A5-AC01: the genuinely confirmed configuration still lacks the separate native plan/application entry; persistence must not imply activation');
 } finally {await f.close();}
});
