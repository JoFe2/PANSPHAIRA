import test from 'node:test';
import assert from 'node:assert/strict';
import { processBrowserFixture562 } from '../pan562/browser-process-fixture.mjs';

test('A3-AC01/02 actual shared shell exposes model-free configuration conversation and form over the same existing563 draft',async()=>{
 const f=await processBrowserFixture562();
 try {
  const page=f.page;
  await page.goto(f.tls.origin+'/t/tenant-a/bootstrap');
  await page.locator('[data-bootstrap-status][data-state="PROOF_PENDING"]').waitFor();
  await page.getByLabel('Kurzlebiger einmaliger Besitz- oder Wiederanmeldenachweis',{exact:true}).fill(f.grants[0].grant.proof);
  await page.locator('form button').click();
  await page.locator('[data-bootstrap-entry][data-outcome="SESSION_BOUND"]').waitFor();
  await page.getByRole('link',{name:'Fortsetzen — gespeicherten Entwurf öffnen',exact:true}).click();
  await page.locator('[data-backend="configuration"][data-outcome="EMPTY"], [data-backend="configuration"][data-outcome="READBACK_RECEIVED"]').waitFor();
  const before=await page.evaluate(async()=>{const r=await fetch('/t/tenant-a/workspace/configuration',{credentials:'same-origin',cache:'no-store'});return{status:r.status,value:await r.json()};});
  assert.equal(before.status,200);assert.equal(before.value.activationAuthorized,false);
  await page.getByRole('button',{name:'Konfigurationsgespräch — modelllos',exact:true}).click();
  await page.locator('[data-configuration-presentation="conversation"]').waitFor();
  assert.match(await page.locator('[data-backend="configuration"]').innerText(),/Modelllos/);
  await page.getByRole('button',{name:'Formular — derselbe Entwurf',exact:true}).click();
  await page.locator('[data-configuration-presentation="form"]').waitFor();
  const after=await page.evaluate(async()=>{const r=await fetch('/t/tenant-a/workspace/configuration',{credentials:'same-origin',cache:'no-store'});return{status:r.status,value:await r.json()};});
  assert.equal(after.status,200);assert.equal(after.value.revision,before.value.revision);assert.deepEqual(after.value.draft,before.value.draft);
  assert.equal(f.requests.filter(r=>r.path.endsWith('/workspace/configuration')&&r.method==='POST').length,0,'presentation changes have no store, activation or model effect');
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

async function openConfiguration(f){
 const page=f.page;await page.goto(f.tls.origin+'/t/tenant-a/bootstrap');
 await page.locator('[data-bootstrap-status][data-state="PROOF_PENDING"]').waitFor();
 await page.getByLabel('Kurzlebiger einmaliger Besitz- oder Wiederanmeldenachweis',{exact:true}).fill(f.grants[0].grant.proof);
 await page.locator('form button').click();await page.locator('[data-bootstrap-entry][data-outcome="SESSION_BOUND"]').waitFor();
 await page.getByRole('link',{name:'Fortsetzen — gespeicherten Entwurf öffnen',exact:true}).click();
 await page.locator('[data-backend="configuration"][data-outcome="EMPTY"], [data-backend="configuration"][data-outcome="READBACK_RECEIVED"]').waitFor();return page;
}
const nativeRead=page=>page.evaluate(async()=>{const r=await fetch('/t/tenant-a/workspace/configuration',{credentials:'same-origin',cache:'no-store'});return{status:r.status,value:await r.json()};});
const goal='Ziel und Zweck der begrenzten Mitarbeiterassistenz';

test('A3 five states are reachable in the same protected shell and conversation/form edits reconcile one native persisted draft',async()=>{
 const f=await processBrowserFixture562();
 try{const page=await openConfiguration(f);
  for(const [state,label]of [['entry','Einstieg'],['profile','Profil'],['model','Modellverbindung'],['configuration','Konfigurationsgespräch'],['result','Plan und Ergebnis']]){
   await page.locator('[data-configuration-steps]').getByRole('button',{name:label,exact:true}).click();await page.locator('[data-backend="configuration"][data-configuration-state="'+state+'"]').waitFor();
   assert.equal(new URL(page.url()).hash,'#/workspace/configuration');
  }
  await page.locator('[data-configuration-steps]').getByRole('button',{name:'Modellverbindung',exact:true}).click();await page.getByRole('button',{name:'Vorhandenen Verbindungsstatus anzeigen',exact:true}).click();await page.locator('[data-backend="configuration"][data-outcome="MODEL_NOT_CONFIGURED"]').waitFor();assert.match(await page.locator('[data-backend="configuration"] > [role="status"]').innerText(),/nicht eingebunden/);
  await page.locator('[data-configuration-steps]').getByRole('button',{name:'Konfigurationsgespräch',exact:true}).click();
  await page.getByRole('button',{name:'Konfigurationsgespräch — modelllos',exact:true}).click();
  await page.getByRole('combobox',{name:goal,exact:true}).selectOption(JSON.stringify('employee.business.help'));
  await page.getByRole('button',{name:'Bestätigen und Entwurf speichern',exact:true}).click();await page.locator('[data-backend="configuration"][data-outcome="PERSISTED"]').waitFor();
  const first=await nativeRead(page);assert.equal(first.status,200);assert.equal(first.value.draft.fields['goal.purpose'].value,'employee.business.help');
  await page.getByRole('button',{name:'Formular — derselbe Entwurf',exact:true}).click();await page.getByRole('button',{name:'Bearbeiten: '+goal,exact:true}).click();
  await page.getByRole('combobox',{name:goal,exact:true}).selectOption(JSON.stringify('employee.directory.summary'));
  await page.getByRole('button',{name:'Bestätigen und Entwurf speichern',exact:true}).click();await page.locator('[data-backend="configuration"][data-outcome="PERSISTED"]').waitFor();
  const second=await nativeRead(page);assert.equal(second.value.revision,first.value.revision+1);assert.equal(second.value.draft.fields['goal.purpose'].value,'employee.directory.summary');
  assert.match(await page.locator('[data-configuration-summary]').innerText(),/Eigenes Mitarbeiterverzeichnis zusammenfassen/);
  await page.reload();await page.locator('[data-backend="configuration"][data-outcome="READBACK_RECEIVED"]').waitFor();
  const reloaded=await nativeRead(page);assert.deepEqual(reloaded.value.draft,second.value.draft);assert.equal(reloaded.value.revision,second.value.revision);
  assert.equal(f.requests.filter(r=>r.path.endsWith('/workspace/configuration')&&r.method==='POST').length,2);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
test('A3 question reason/provenance/unknown and back navigation keep unconfirmed input; invalid answer focuses actual card without POST',async()=>{
 const f=await processBrowserFixture562();
 try{const page=await openConfiguration(f);const before=await nativeRead(page);
  assert.match(await page.locator('[data-question-reason]').innerText(),/unbekannt|ungeklärt/i);assert.match(await page.locator('[data-question-source]').innerText(),/Quelle/);
  await page.getByRole('combobox',{name:goal,exact:true}).selectOption(JSON.stringify('employee.business.help'));
  await page.locator('[data-configuration-steps]').getByRole('button',{name:'Profil',exact:true}).click();
  await page.locator('[data-configuration-steps]').getByRole('button',{name:'Konfigurationsgespräch',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:goal,exact:true}).inputValue(),JSON.stringify('employee.business.help'));
  await page.getByRole('button',{name:'Später beantworten — Eingabe behalten',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:goal,exact:true}).inputValue(),JSON.stringify('employee.business.help'));
  await page.getByRole('combobox',{name:goal,exact:true}).selectOption('');await page.locator('.configuration-editor form').evaluate(e=>{e.noValidate=true;e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  await page.locator('[data-backend="configuration"][data-outcome="VALIDATION_ERROR"]').waitFor();assert.equal(await page.getByRole('combobox',{name:goal,exact:true}).evaluate(e=>e===document.activeElement),true);
  assert.equal(f.requests.filter(r=>r.path.endsWith('/workspace/configuration')&&r.method==='POST').length,0);assert.equal((await nativeRead(page)).value.revision,before.value.revision);
  await page.getByRole('button',{name:'Als unbekannt speichern',exact:true}).click();await page.locator('[data-backend="configuration"][data-outcome="PERSISTED"]').waitFor();assert.equal((await nativeRead(page)).value.draft.fields['goal.purpose'].confirmation,'UNKNOWN');assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

test('A3 without a provider the complete existing form reaches native RESOLVED with no activation/model call and explicit field confirmation',async()=>{
 const f=await processBrowserFixture562();try{const p=await openConfiguration(f);await p.getByRole('button',{name:'Ohne KI fortfahren',exact:true}).click();await p.locator('[data-backend="configuration"][data-outcome="PERSISTED"]').waitFor();await p.getByRole('button',{name:'Formular — derselbe Entwurf',exact:true}).click();let previous=-1,passes=0;
  while(true){const r=await nativeRead(p);assert.equal(r.status,200);assert.equal(r.value.draft.fields['model.reference'].value,'NONE');assert.equal(r.value.activationAuthorized,false);if(r.value.outcome==='RESOLVED'){assert.equal(r.value.unresolvedFields.length,0);break;}assert.ok(passes++<37);assert.ok(r.value.revision>previous);previous=r.value.revision;const q=r.value.questions[0];assert.ok(q);assert.match(await p.locator('[data-question-source]').innerText(),/Bearbeitbar/);
   const d=r.value.definitions[q.field];if(d.type==='SET'){for(const input of await p.locator('.configuration-editor input[type="checkbox"]').all())await input.check();}else if(d.type==='INTEGER')await p.locator('.configuration-editor input').fill(String(d.allowedValues[0]));else await p.locator('.configuration-editor select').selectOption(JSON.stringify(q.field==='goal.purpose'?'employee.directory.summary':d.allowedValues[0]));
   await p.getByRole('button',{name:'Bestätigen und Entwurf speichern',exact:true}).click();await p.locator('[data-backend="configuration"][data-outcome="PERSISTED"]').waitFor();
  }
  await p.locator('[data-configuration-steps]').getByRole('button',{name:'Plan und Ergebnis',exact:true}).click();assert.match(await p.locator('[data-configuration-result]').innerText(),/vollständig/);assert.match(await p.locator('[data-configuration-summary]').innerText(),/Offene Pflichtwerte: 0/);assert.equal(f.requests.filter(r=>r.method==='POST'&&/\/model-connection\/(select|probe|consent)$/.test(r.path)).length,0);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

test('A3 original lost-answer review B1: re-editing the SAME dirty card and returning from another step never resets the unconfirmed control',async()=>{
 const f=await processBrowserFixture562();try{const p=await openConfiguration(f);await p.getByRole('combobox',{name:goal,exact:true}).selectOption(JSON.stringify('employee.business.help'));await p.getByRole('button',{name:'Bearbeiten: '+goal,exact:true}).click();assert.equal(await p.getByRole('combobox',{name:goal,exact:true}).inputValue(),JSON.stringify('employee.business.help'),'same dirty card must retain the unsaved answer');await p.locator('[data-configuration-steps]').getByRole('button',{name:'Profil',exact:true}).click();await p.getByRole('button',{name:'Bearbeiten: '+goal,exact:true}).click();await p.locator('[data-configuration-steps]').getByRole('button',{name:'Konfigurationsgespräch',exact:true}).click();assert.equal(await p.getByRole('combobox',{name:goal,exact:true}).inputValue(),JSON.stringify('employee.business.help'));assert.equal(f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/workspace/configuration')).length,0);assert.equal((await nativeRead(p)).value.revision,0);
 }finally{await f.close();}
});
