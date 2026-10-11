import test from 'node:test';import assert from'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';import{join}from'node:path';
import{processBrowserFixture562,capture562}from'./browser-process-fixture.mjs';
const entry='/t/tenant-a/bootstrap';
async function login(page,f,grant){await page.goto(f.tls.origin+entry);await page.locator('[data-bootstrap-status][data-state="PROOF_PENDING"], [data-bootstrap-status][data-state="INITIALIZED"]').waitFor();await page.getByLabel('Kurzlebiger einmaliger Besitz- oder Wiederanmeldenachweis',{exact:true}).fill(grant.proof);await page.locator('form button').click();await page.locator('[data-bootstrap-entry][data-outcome="SESSION_BOUND"]').waitFor();await page.getByText('Geschützte Sitzung frisch geprüft.',{exact:false}).waitFor();}
test('A1 actual fresh supported native bootstrap process to protected browser draft and native restart/resume without terminal business parameters',async()=>{
 const f=await processBrowserFixture562();let second;
 try{assert.equal(f.grants.length,1);await f.page.goto(f.tls.origin+entry);await f.page.locator('[data-bootstrap-status][data-state="PROOF_PENDING"]').waitFor();await capture562(f.page,'desktop-fresh-protected-entry');
  await f.page.setViewportSize({width:390,height:844});await capture562(f.page,'390-fresh-long-proof-label');await f.page.setViewportSize({width:1440,height:960});
  await login(f.page,f,f.grants[0].grant);assert.equal(await f.page.locator('input[name="proof"]').inputValue(),'');
  assert.equal(f.requests.filter(r=>r.path.endsWith('/bootstrap/claim')&&r.method==='POST').length,1);assert.equal(f.requests.some(r=>r.query.includes('proof')),false);
  await f.page.getByRole('link',{name:'Fortsetzen — gespeicherten Entwurf öffnen',exact:true}).click();await f.page.locator('[data-backend="configuration"]').waitFor();await f.page.getByRole('button',{name:'Ohne KI fortfahren',exact:true}).click();await f.page.locator('[data-backend="configuration"][data-outcome="PERSISTED"]').waitFor();
  assert.match(await f.page.locator('[data-backend="configuration"]').innerText(),/Revision 1/);
  await capture562(f.page,'desktop-confirmed-existing-draft');
  await f.page.reload();await f.page.locator('[data-backend="configuration"]').filter({hasText:'Gespeicherten Entwurf gelesen. Revision 1.'}).waitFor();assert.match(await f.page.locator('[data-backend="configuration"]').innerText(),/Revision 1/);
  await f.context.close();await f.restart();assert.equal(f.grants.at(-1).purpose,'RESUME');
  second=await f.newContext();const page=await second.newPage();page.setDefaultTimeout(8000);await login(page,f,f.grants.at(-1).grant);await page.getByRole('link',{name:'Einrichten — bestehende Administration',exact:true}).click();await page.locator('[data-backend="administration"][data-outcome="READBACK_RECEIVED"]').waitFor();
  await page.getByRole('button',{name:'Agentenkonfiguration — Entwurf',exact:true}).click();await page.locator('[data-backend="configuration"]').filter({hasText:'Gespeicherten Entwurf gelesen. Revision 1.'}).waitFor();assert.match(await page.locator('[data-backend="configuration"]').innerText(),/Revision 1/);
  const actual=await page.evaluate(async()=>{const response=await fetch('/t/tenant-a/workspace/configuration',{credentials:'same-origin',cache:'no-store'});return{status:response.status,value:await response.json()};});assert.equal(actual.status,200);assert.equal(actual.value.revision,1);assert.equal(actual.value.draft.fields['model.reference'].value,'NONE');
  await page.getByRole('button',{name:'Administration — geschützt',exact:true}).click();await page.locator('[data-backend="administration"][data-outcome="READBACK_RECEIVED"]').waitFor();assert.match(await page.locator('[data-admin-diff="setup"]').innerText(),/Vorher: 1[\s\S]*Nachher geplant: 7/);
  await page.setViewportSize({width:390,height:844});await page.locator('[data-admin-diff="setup"]').scrollIntoViewIfNeeded();await capture562(page,'390-restarted-existing-admin-proposal',{draftRevision:actual.value.revision});
  assert.equal(f.stdout.join('').includes(f.grants[0].grant.proof),false);assert.equal(f.stderr.join('').includes(f.grants[0].grant.proof),false);assert.deepEqual(f.errors,[]);
  writeFileSync(join(process.env.PAN562_BROWSER_EVIDENCE,'actual-supported-process-browser-restart-readback.json'),JSON.stringify({instance:f.identity.instanceId,actualNativeProcessExits:f.exits,sourceCommit:f.identity.sourceCommit,sourceTree:f.identity.sourceTree,identityShapeNotDockerReadiness:true,actualProtectedBrowserFirstClaimRequests:1,actualRestartSeparateResume:true,actualPersistedDraftRevision:actual.value.revision,noAgentOrBusinessTerminalParameters:true,noProofURLLogsBrowserPersistence:true,notModelOrAudioOrProductionAcceptance:true},null,2)+'\n');
 }finally{await second?.close();await f.close();}
});
test('A1 actual browser lost native claim response remains UNKNOWN, does not repeat and reads current initialized target',async()=>{
 const f=await processBrowserFixture562();let cdp;
 try{await f.page.goto(f.tls.origin+entry);await f.page.locator('[data-bootstrap-status][data-state="PROOF_PENDING"]').waitFor();cdp=await f.context.newCDPSession(f.page);await cdp.send('Fetch.enable',{patterns:[{urlPattern:f.tls.origin+entry+'/claim',requestStage:'Response'}]});
  cdp.on('Fetch.requestPaused',async event=>{assert.equal(event.responseStatusCode,200);await cdp.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'ConnectionClosed'});});
  await f.page.getByLabel('Kurzlebiger einmaliger Besitz- oder Wiederanmeldenachweis',{exact:true}).fill(f.grants[0].grant.proof);await f.page.locator('form button').click();await f.page.locator('[data-bootstrap-entry][data-outcome="UNKNOWN"]').waitFor();assert.equal(await f.page.locator('form button').isDisabled(),true);
  await cdp.send('Fetch.disable');await f.page.getByRole('button',{name:'Status erneut lesen — keine Mutation',exact:true}).click();await f.page.locator('[data-bootstrap-status][data-state="INITIALIZED"]').waitFor();assert.equal(f.requests.filter(r=>r.path.endsWith('/bootstrap/claim')&&r.method==='POST').length,1);assert.equal(await f.page.locator('form button').isDisabled(),true);
  await f.page.setViewportSize({width:390,height:844});await capture562(f.page,'390-real-lost-response-unknown-reconciliation');assert.deepEqual(f.errors,[]);
 }finally{await cdp?.detach();await f.close();}
});


test('A1 actual browser expired proof and unavailable native bootstrap remain explicit non-success; keyboard and CSS200',async()=>{
 const f=await processBrowserFixture562({proofTtlMs:1});
 try{await f.page.goto(f.tls.origin+entry);await f.page.locator('[data-bootstrap-status][data-state="PROOF_EXPIRED"]').waitFor();assert.equal(await f.page.locator('form button').isDisabled(),true);assert.match(await f.page.locator('[data-bootstrap-message]').innerText(),/abgelaufen/);
  await f.page.setViewportSize({width:390,height:844});await f.page.evaluate(()=>document.documentElement.style.zoom='2');await capture562(f.page,'390-css200-real-expired-proof');
  const refresh=f.page.getByRole('button',{name:'Status erneut lesen — keine Mutation',exact:true});await refresh.focus();assert.equal(await refresh.evaluate(e=>e===document.activeElement),true);await refresh.press('Enter');await f.page.locator('[data-bootstrap-status][data-state="PROOF_EXPIRED"]').waitFor();assert.equal(f.requests.filter(r=>r.path.endsWith('/claim')).length,0);
  await f.page.evaluate(()=>document.documentElement.style.zoom='1');await f.stop();await refresh.click();await f.page.getByText('Bootstrapdienst nicht erreichbar oder Statusvertrag ungültig.',{exact:false}).waitFor();assert.equal(await f.page.locator('form button').isDisabled(),true);await capture562(f.page,'390-actual-stopped-bootstrap-unavailable');assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

test('A1 actual browser session expiry uses fixed bootstrap redirect and server denies stale CSRF without effect',async()=>{
 const f=await processBrowserFixture562({sessionTtlMs:1000});
 try{await login(f.page,f,f.grants[0].grant);const cookies=await f.context.cookies(),cookie=cookies.find(c=>c.name==='__Host-pan527-session');assert.ok(cookie);assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);
  await new Promise(resolve=>setTimeout(resolve,1200));await f.page.goto(f.tls.origin+'/t/tenant-a/workspace');assert.equal(f.page.url(),f.tls.origin+entry);await f.page.locator('[data-bootstrap-status][data-state="INITIALIZED"]').waitFor();assert.match(await f.page.locator('[data-bootstrap-message]').innerText(),/Wiederanmeldenachweis/);
  const denied=await f.page.evaluate(async()=>{const r=await fetch('/t/tenant-a/workspace/configuration',{method:'POST',headers:{'content-type':'application/json','x-pan563-context':'session:stale'},body:JSON.stringify({schemaVersion:'pansphaira.agent-configuration/answers/v1',expectedRevision:0,answers:[{field:'model.reference',value:'NONE',confirmation:'CONFIRM'}]})});return r.status;});assert.equal(denied,401);
  assert.equal(f.requests.filter(r=>r.path.endsWith('/bootstrap/claim')&&r.method==='POST').length,1);await f.page.setViewportSize({width:390,height:844});await capture562(f.page,'390-real-session-expired-current-initialized-state');
  assert.equal(await f.page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage})).then(value=>value.includes(f.grants[0].grant.proof)),false);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});


test('A1 browser demo choice uses actual existing administration proposal and persists confirmed setup through logout/restart',async()=>{
 const f=await processBrowserFixture562();
 try{await login(f.page,f,f.grants[0].grant);await f.page.getByRole('link',{name:'Demo auswählen — bestehender synthetischer Setup-Pfad',exact:true}).click();await f.page.locator('[data-backend="administration"][data-outcome="READBACK_RECEIVED"]').waitFor();
  const {buildPocGuidedDemoSetupPlanV1,expectedPocGuidedDemoTemplatesV1}=await import('../../dist/packages/contracts/src/index.js');
  const plan=buildPocGuidedDemoSetupPlanV1(JSON.parse(readFileSync(new URL('../../examples/poc-release/showcase-v1.json',import.meta.url),'utf8')),expectedPocGuidedDemoTemplatesV1(),{templateId:'quick-tour'});
  const target=join(f.root,'existing-product',plan.storage.ownedStateRoot,'dashboard-status.json');
  assert.equal(JSON.parse(readFileSync(target,'utf8')).progress.completedStages,1);
  await f.page.locator('#pan550-setup-confirmation').check();await f.page.getByRole('button',{name:'Genau diese synthetische Einrichtung einmalig ausführen',exact:true}).click();await f.page.locator('[data-backend="administration"][data-outcome="OUTCOME_UNCONFIRMED"]').waitFor();
  assert.equal(JSON.parse(readFileSync(target,'utf8')).progress.completedStages,7);
  await f.page.getByRole('button',{name:'Aktuellen Kontext und persistiertes Setupziel unabhängig lesen',exact:true}).click();await f.page.locator('[data-backend="administration"][data-outcome="PERSISTED_TARGET_RECONCILED"]').waitFor();assert.equal(f.requests.filter(r=>r.operation==='RUN_SYNTHETIC_SETUP').length,1);
  await f.page.getByRole('button',{name:'Abmelden',exact:true}).click();await f.page.getByRole('heading',{name:'Abgemeldet',exact:true}).waitFor();assert.equal(Object.keys(JSON.parse(readFileSync(join(f.root,'protected-session','sessions.json'),'utf8')).payload.sessions).length,0);
  await f.restart();assert.equal(f.grants.at(-1).purpose,'RESUME');assert.equal(JSON.parse(readFileSync(target,'utf8')).progress.completedStages,7);
  await login(f.page,f,f.grants.at(-1).grant);await f.page.getByRole('link',{name:'Einrichten — bestehende Administration',exact:true}).click();await f.page.locator('[data-backend="administration"][data-outcome="READBACK_RECEIVED"]').waitFor();assert.match(await f.page.locator('[data-admin-diff="setup"]').innerText(),/Vorher: 7[\s\S]*Nachher geplant: 7/);
  assert.equal(await f.page.getByRole('button',{name:'Genau diese synthetische Einrichtung einmalig ausführen',exact:true}).isDisabled(),true);await capture562(f.page,'desktop-real-demo-persisted7-after-logout-restart',{setupStages:7});assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
