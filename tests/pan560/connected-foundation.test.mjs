import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {request527} from '../pan527/helpers.mjs';
import {join} from 'node:path';
import {processBrowserFixture562,capture562} from '../pan562/browser-process-fixture.mjs';
import {openModelFreeConfiguration566,completeModelFreeDraft566,appPhase566,waitNative566,readGuided566,readDraft566} from '../pan566/helpers.mjs';
import {readPan515TradeState} from '../../src/pan515/trade-state.mjs';

// Original560 joins the actual existing owners in the fixed566 entry. The
// existing native expiry/lease/role/schema/cancellation cases remain mandatory.
let active=false;
const expectedQuantities={physical:10,reserved:6,blocked:0,available:4,shipped:0,returned:0};
const leading=f=>join(f.root,'existing-product/pan528-guided-native/pan472-owned-v1');
const status=p=>p.locator('[data-configuration-application] > [aria-live]');
function evidence(name,data){writeFileSync(join(process.env.PAN562_BROWSER_EVIDENCE,name+'.json'),JSON.stringify(data,null,2)+'\n');}
async function serial(name,run){
 assert.equal(active,false,'one original560 bootstrap and browser engine at a time');active=true;
 let f;const external=[];
 try{
  f=await processBrowserFixture562();
  f.context.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==f.tls.origin)external.push(new URL(r.url()).origin);});
  await run(f);assert.deepEqual(external,[]);assert.deepEqual(f.errors,[]);
 }finally{
  try{await f?.close();}finally{
   if(f)evidence(name+'-owned-exits',{sourceCommit:f.identity.sourceCommit,sourceTree:f.identity.sourceTree,actualOwnerExits:f.exits,actualNativeRequests:f.requests,externalRequests:external,realModelAcceptance:false,remoteModelInference:false});
   active=false;
  }
 }
}
async function model(p){return p.evaluate(async()=>{
 const c=await fetch('/t/tenant-a/workspace/context',{credentials:'same-origin',cache:'no-store'});
 if(c.status!==200)return {status:c.status,body:null};
 const context=await c.json();
 const r=await fetch('/t/tenant-a/workspace/model-connection',{credentials:'same-origin',cache:'no-store',headers:{'x-pan565-session':context.sessionId}});
 return {status:r.status,body:await r.json()};
});}
function empty(actual){
 assert.equal(actual.status,200);assert.deepEqual(actual.body.connections,[]);
 assert.equal(actual.body.readyForInference,false);assert.equal(actual.body.realModelAcceptance,false);
 assert.equal(actual.body.inferenceOffer,null);assert.equal(actual.body.consent,'NOT_GRANTED');
 assert.ok(Object.values(actual.body.checks).every(c=>c.state==='NOT_RUN'));
}
async function openModel(p){
 await p.locator('[data-configuration-steps]').getByRole('button',{name:'Modellverbindung',exact:true}).click();
 await p.getByRole('button',{name:'Vorhandenen Verbindungsstatus anzeigen',exact:true}).click();
 await p.locator('[id="shell.model-connection"][data-state="NO_AUTHORIZED_CONNECTION"]').waitFor();empty(await model(p));const palette=await p.evaluate(()=>({dialog:getComputedStyle(document.querySelector('[id="shell.model-connection"]')).backgroundColor,work:getComputedStyle(document.querySelector('.configuration-work')).backgroundColor}));assert.equal(palette.dialog,palette.work);
}
async function closeModel(p){const close=p.getByRole('button',{name:'Verbindungsdialog schließen',exact:true});if(await close.isVisible())await close.click();}
async function prepare(p){await p.getByRole('button',{name:'Anwendungsstand unabhängig lesen',exact:true}).click();await appPhase566(p,'EMPTY');await p.getByRole('button',{name:'Einrichtungsplan vorbereiten',exact:true}).click();await appPhase566(p,'PENDING');}
async function confirm(p){await p.getByRole('button',{name:'Genau diesen synthetischen Plan bestätigen',exact:true}).click();await appPhase566(p,'CONFIRMED');}
async function result(p,f){
 const native=await waitNative566(p);assert.equal(native.budget.model.consumedUnits,0);assert.equal(native.budget.runtime.consumedUnits,1);
 await p.getByRole('button',{name:'Anwendungsstand unabhängig lesen',exact:true}).click();await appPhase566(p,'AWAITING_RESULT_RECONCILIATION');
 await p.getByRole('button',{name:'Fachresultat unabhängig prüfen und Bindung bestätigen',exact:true}).click();await appPhase566(p,'VERIFIED');
 const actual=readPan515TradeState({root:leading(f)});assert.equal(actual.revision,2);assert.deepEqual(actual.quantities,expectedQuantities);
 assert.equal(f.requests.filter(r=>r.operation==='APPLY').length,1);return actual;
}
async function image(p,f,name,extra={}){return capture562(p,name,{sourceCommit:f.identity.sourceCommit,sourceTree:f.identity.sourceTree,originalCriteria:'E1-AC01..06',providerFree:true,realModelAcceptance:false,remoteModelInference:false,...extra});}
async function fiveViews(p,f){
 const names=['Einstieg','Profil','Modellverbindung','Konfigurationsgespräch','Plan und Ergebnis'];
 assert.deepEqual(await p.locator('[data-configuration-steps] button').allTextContents(),names);
 for(const width of [1280,390]){
  await p.setViewportSize({width,height:width===390?844:960});
  for(const [index,name] of names.entries()){
   await p.locator('[data-configuration-steps]').getByRole('button',{name,exact:true}).click();
   if(name==='Modellverbindung'){await p.getByRole('button',{name:'Vorhandenen Verbindungsstatus anzeigen',exact:true}).click();await p.locator('[id="shell.model-connection"][data-state="NO_AUTHORIZED_CONNECTION"]').waitFor();await p.locator('[id="shell.model-connection"]').scrollIntoViewIfNeeded();}
   else await p.locator('[data-configuration-steps]').scrollIntoViewIfNeeded();
   await image(p,f,'E1-'+width+'-view-'+(index+1),{actualStep:name,modelStatusReadNotConsent:true});
   if(name==='Modellverbindung')await closeModel(p);
  }
 }
 await p.setViewportSize({width:1280,height:960});
}

test('E1-AC01/03/05 actual secured bootstrap exposes native empty565; consent/probe/forged connection grant cannot create a model',{timeout:180000},async()=>serial('E1-empty-model',async f=>{
 const p=await openModelFreeConfiguration566(f);await openModel(p);const actual=await model(p);empty(actual);
 assert.equal(await p.locator('[id="shell.model-connection"]').count(),1);assert.equal(existsSync(leading(f)),false);
 const denied=await p.evaluate(async()=>{
  const context=await(await fetch('/t/tenant-a/workspace/context',{credentials:'same-origin'})).json(),results=[];
  for(const operation of ['select','probe','consent']){
   const r=await fetch('/t/tenant-a/workspace/model-connection/'+operation,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-pan565-session':context.sessionId},body:JSON.stringify({connectionId:'synthetic:absent',activationAuthorized:true,realModelAcceptance:true})});results.push({operation,status:r.status});
  }
  return results;
 });
 assert.ok(denied.every(r=>[400,403,409].includes(r.status)));empty(await model(p));assert.equal(existsSync(leading(f)),false);
 evidence('E1-actual-empty-model-readback',{sourceCommit:f.identity.sourceCommit,sourceTree:f.identity.sourceTree,actual,denied,externalInferenceCalls:0,nativeLeadingExists:false});await image(p,f,'E1-empty-model-real-view');
}));

test('E1-AC01..06 one fresh ownership five views partial draft exact plan separate confirmation one apply persisted515 result and actual logout/restart/resume',{timeout:240000},async()=>serial('E1-connected-result-resume',async f=>{
 let p=f.page;await p.goto(f.tls.origin+'/t/tenant-a/bootstrap');await p.locator('[data-bootstrap-status][data-state="PROOF_PENDING"]').waitFor();
 await image(p,f,'E1-fresh-protected-entry-desktop',{freshUninitializedInstance:true});await p.setViewportSize({width:390,height:844});await image(p,f,'E1-fresh-protected-entry-390',{freshUninitializedInstance:true});await p.setViewportSize({width:1280,height:960});
 const binding=await p.evaluate(async()=>{const r=await fetch(location.pathname+'/status',{credentials:'same-origin'});return(await r.json()).binding;});
 const claim={schemaVersion:'pansphaira.workspace-bootstrap/claim/v1',purpose:'FIRST_OWNER',proof:f.grants[0].grant.proof,instanceId:binding.instanceId,identityDigest:binding.identityDigest};
 const claimStatus=(page,body)=>page.evaluate(async input=>{const r=await fetch(location.pathname+'/claim',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(input)});return r.status;},body);
 const unauthenticated=await p.evaluate(async()=>(await fetch('/t/tenant-a/workspace/context',{credentials:'same-origin'})).status);assert.equal(unauthenticated,401);
 const foreignInstance=await claimStatus(p,{...claim,instanceId:'foreign-instance'});assert.ok([400,403,409].includes(foreignInstance));
 const csrfReply=await request527(f.tls,'/t/tenant-a/bootstrap/claim',{origin:'https://wrong-origin.invalid'},'POST',claim);const csrf=csrfReply.status;assert.equal(csrf,403);assert.equal(csrfReply.tlsAuthorized,true);assert.equal(JSON.parse(csrfReply.body).error,'HOSTED_ORIGIN_DENIED');
 const wrongIdentity=join(f.root,'original560-wrong-source-identity.json');writeFileSync(wrongIdentity,JSON.stringify({...f.identity,sourceCommit:'0'.repeat(40)})+'\n',{mode:0o600});
 const drift=spawnSync(process.execPath,['scripts/bootstrap-browser-first-owner-v1.mjs','--opt-in-existing-owner','--root',f.root,'--origin',f.tls.origin,'--identity-file',wrongIdentity,'--tls-key',f.tls.options.tls.keyPath,'--tls-cert',f.tls.options.tls.certPath],{encoding:'utf8',timeout:10000});assert.equal(drift.status,2);assert.match(drift.stderr,/BOOTSTRAP_SOURCE_BINDING_DENIED/);assert.equal(drift.stdout,'');
 const other=await f.context.newPage();other.setDefaultTimeout(8000);await other.goto(f.tls.origin+'/t/tenant-a/bootstrap');await other.locator('[data-bootstrap-status][data-state="PROOF_PENDING"]').waitFor();
 await p.getByLabel('Kurzlebiger einmaliger Besitz- oder Wiederanmeldenachweis',{exact:true}).fill(claim.proof);await other.getByLabel('Kurzlebiger einmaliger Besitz- oder Wiederanmeldenachweis',{exact:true}).fill(claim.proof);
 const replies=[p.waitForResponse(r=>r.url().endsWith('/bootstrap/claim')),other.waitForResponse(r=>r.url().endsWith('/bootstrap/claim'))];await Promise.all([p.locator('form button').click(),other.locator('form button').click()]);const codes=(await Promise.all(replies)).map(r=>r.status());assert.equal(codes.filter(code=>code===200).length,1);assert.ok(codes.filter(code=>code!==200).every(code=>[400,403,409].includes(code)));
 const winner=codes[0]===200?p:other;await winner.locator('[data-bootstrap-entry][data-outcome="SESSION_BOUND"]').waitFor();await other.close();await p.goto(f.tls.origin+'/t/tenant-a/bootstrap');await p.locator('[data-bootstrap-status][data-state="INITIALIZED"]').waitFor();const firstOwnerRead=await p.evaluate(async()=>{const r=await fetch(location.pathname+'/status',{credentials:'same-origin'});return r.json();});assert.equal(firstOwnerRead.sessionState,'CURRENT');
 const proofPersisted=await p.evaluate(proof=>location.href.includes(proof)||document.documentElement.outerHTML.includes(proof)||JSON.stringify({...localStorage,...sessionStorage}).includes(proof),claim.proof);assert.equal(proofPersisted,false);
 evidence('E1-connected-first-owner-native-denials',{sourceCommit:f.identity.sourceCommit,sourceTree:f.identity.sourceTree,unauthenticatedStatus:unauthenticated,foreignInstanceStatus:foreignInstance,csrfStatus:csrf,actualWrongSourceProcessExit:drift.status,actualFirstOwnerRaceStatuses:codes,proofPersisted:false});
 await p.getByRole('link',{name:'Fortsetzen — gespeicherten Entwurf öffnen',exact:true}).click();await p.locator('[data-backend="configuration"][data-outcome="EMPTY"]').waitFor();const contextDetails=p.locator('[id="workspace.context-details"]');if(await contextDetails.getAttribute('open')===null)await contextDetails.locator(':scope > summary').click();
 assert.equal(existsSync(leading(f)),false);await openModel(p);await closeModel(p);await fiveViews(p,f);
 await p.locator('[data-configuration-steps]').getByRole('button',{name:'Profil',exact:true}).focus();await p.keyboard.press('Enter');assert.equal(await p.locator('[data-configuration-steps] [aria-current="step"]').textContent(),'Profil');
 await p.getByRole('button',{name:'Ohne KI fortfahren',exact:true}).click();await p.locator('[data-backend="configuration"][data-outcome="PERSISTED"]').waitFor();
 const partial=await readDraft566(p);assert.equal(partial.draft.fields['model.reference'].value,'NONE');assert.equal(partial.activationAuthorized,false);assert.equal(existsSync(leading(f)),false);
 await p.reload();await p.locator('[data-backend="configuration"][data-outcome="READBACK_RECEIVED"]').waitFor();assert.equal((await readDraft566(p)).revision,partial.revision);
 const draft=await completeModelFreeDraft566(p);assert.equal(draft.outcome,'RESOLVED');assert.equal(draft.draft.fields['model.reference'].value,'NONE');assert.equal(existsSync(leading(f)),false);
 await prepare(p);assert.equal(existsSync(leading(f)),false);assert.equal((await readGuided566(p)).budget.runtime.consumedUnits,0);
 await p.getByRole('button',{name:'Genau diesen synthetischen Plan bestätigen',exact:true}).focus();await p.keyboard.press('Enter');await appPhase566(p,'CONFIRMED');assert.equal(existsSync(leading(f)),false);assert.equal(f.requests.filter(r=>r.operation==='APPLY').length,0);
 await p.getByRole('button',{name:'Bestätigten synthetischen Plan einmal anwenden',exact:true}).click();const actual=await result(p,f);
 await p.locator('[data-configuration-application]').scrollIntoViewIfNeeded();await image(p,f,'E1-connected-native-independent-result',{nativeRevision:actual.revision,actualExpectedObservedValue:actual.quantities});
 await p.getByRole('link',{name:'Registriertes Referenz-Fachresultat im bestehenden Modul öffnen',exact:true}).click();assert.equal(new URL(p.url()).pathname,'/t/tenant-a/guided');assert.deepEqual((await readGuided566(p)).observedBusinessValue,actual.quantities);
 await p.goto(f.tls.origin+'/t/tenant-a/workspace#/workspace/configuration');await p.locator('[data-backend="configuration"][data-outcome="READBACK_RECEIVED"]').waitFor();
 await p.getByRole('button',{name:'Abmelden',exact:true}).click();await p.getByRole('heading',{name:'Abgemeldet',exact:true}).waitFor();await f.restart();assert.equal(f.grants.at(-1).purpose,'RESUME');
 await p.goto(f.tls.origin+'/t/tenant-a/bootstrap');await p.locator('[data-bootstrap-status][data-state="INITIALIZED"]').waitFor();
 const firstReplay=await p.evaluate(async proof=>{
  const current=await(await fetch(location.pathname+'/status',{credentials:'same-origin'})).json();
  const r=await fetch(location.pathname+'/claim',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({schemaVersion:'pansphaira.workspace-bootstrap/claim/v1',purpose:'FIRST_OWNER',proof,instanceId:current.binding.instanceId,identityDigest:current.binding.identityDigest})});return r.status;
 },f.grants[0].grant.proof);assert.ok([400,403,409].includes(firstReplay));
 await p.getByLabel('Kurzlebiger einmaliger Besitz- oder Wiederanmeldenachweis',{exact:true}).fill(f.grants.at(-1).grant.proof);await p.locator('form button').click();await p.locator('[data-bootstrap-entry][data-outcome="SESSION_BOUND"]').waitFor();
 await p.getByRole('link',{name:'Fortsetzen — gespeicherten Entwurf öffnen',exact:true}).click();await p.locator('[data-backend="configuration"][data-outcome="READBACK_RECEIVED"]').waitFor();
 const resumed=await readDraft566(p);assert.equal(resumed.revision,draft.revision);assert.deepEqual(resumed.draft.fields,draft.draft.fields);empty(await model(p));
 assert.deepEqual(readPan515TradeState({root:leading(f)}).quantities,actual.quantities);assert.equal((await readGuided566(p)).budget.runtime.consumedUnits,1);assert.equal(f.requests.filter(r=>r.operation==='APPLY').length,1);
 // A separately saved incomplete runtime candidate grants no new effect and
 // cannot overwrite the independently persisted last-qualified native value.
 await p.locator('[data-configuration-steps]').getByRole('button',{name:'Konfigurationsgespräch',exact:true}).click();const work=p.locator('[data-configuration-group="work"]');if(await work.getAttribute('open')===null)await work.locator(':scope > summary').click();
 await p.getByRole('button',{name:'Bearbeiten: Zeitlimit einer begrenzten Anfrage in Millisekunden',exact:true}).click();await p.locator('.configuration-editor input').fill('1000');await p.getByRole('button',{name:'Bestätigen und Entwurf speichern',exact:true}).click();await p.locator('[data-backend="configuration"][data-outcome="PERSISTED"]').waitFor();
 const later=await readDraft566(p);assert.equal(later.configuration.parameters['work.timeoutMs'],1000);assert.equal(later.activationAuthorized,false);await p.locator('[data-configuration-steps]').getByRole('button',{name:'Plan und Ergebnis',exact:true}).click();await p.getByRole('button',{name:'Anwendungsstand unabhängig lesen',exact:true}).click();await p.getByRole('button',{name:'Einrichtungsplan vorbereiten',exact:true}).click();await appPhase566(p,'PENDING');assert.equal(await p.getByRole('button',{name:'Genau diesen synthetischen Plan bestätigen',exact:true}).isDisabled(),true);assert.equal(readPan515TradeState({root:leading(f)}).revision,2);assert.deepEqual(readPan515TradeState({root:leading(f)}).quantities,actual.quantities);assert.equal(f.requests.filter(r=>r.operation==='APPLY').length,1);
 evidence('E1-connected-native-result-and-resume',{sourceCommit:f.identity.sourceCommit,sourceTree:f.identity.sourceTree,partialDraftRevision:partial.revision,resolvedRevision:draft.revision,resumedRevision:resumed.revision,firstOwnerReplayStatus:firstReplay,actualNativeRevision:actual.revision,actualBusinessValue:actual.quantities,actualApplies:1,actualLogoutRestartAndResume:true,laterDraftDoesNotReplaceLastQualifiedNativeValue:true,model:'NONE',realModelAcceptance:false});
}));

test('E1-AC03/04/06 missing fields, forged role/schema, foreign tenant and actual second-tab stale approval deny before effect; cancel stays inert',{timeout:180000},async()=>serial('E1-native-stale-authority-cancel',async f=>{
 const p=await openModelFreeConfiguration566(f);let second;
 try{
  await p.locator('[data-configuration-steps]').getByRole('button',{name:'Plan und Ergebnis',exact:true}).click();assert.equal(await p.getByRole('button',{name:'Einrichtungsplan vorbereiten',exact:true}).isDisabled(),true);assert.equal(existsSync(leading(f)),false);
  await openModel(p);await closeModel(p);await completeModelFreeDraft566(p);await prepare(p);
  await p.route('**/workspace/configuration-application',async route=>{const input=route.request().postDataJSON();await route.continue(input.operation==='CONFIRM'?{postData:JSON.stringify({...input,role:'reviewer',activationAuthorized:true})}:{});});
  await p.getByRole('button',{name:'Genau diesen synthetischen Plan bestätigen',exact:true}).click();await status(p).filter({hasText:'MODULE_VIEW_SERVER_DENIED_400'}).waitFor();await p.unroute('**/workspace/configuration-application');
  const boundaries=await p.evaluate(async()=>({role:(await fetch('/t/tenant-a/guided/status',{headers:{'x-role':'reviewer'},credentials:'same-origin'})).status,foreignTenant:(await fetch('/t/tenant-b/workspace/configuration',{credentials:'same-origin'})).status}));assert.equal(boundaries.role,403);assert.equal(boundaries.foreignTenant,401);assert.equal(existsSync(leading(f)),false);
  await p.getByRole('button',{name:'Anwendungsstand unabhängig lesen',exact:true}).click();await appPhase566(p,'PENDING');await confirm(p);
  second=await f.context.newPage();second.setDefaultTimeout(8000);await second.goto(f.tls.origin+'/t/tenant-a/workspace#/workspace/configuration');await second.locator('[data-backend="configuration"][data-outcome="READBACK_RECEIVED"]').waitFor();await second.getByRole('button',{name:'Bearbeiten: Sprache der Arbeitsoberfläche',exact:true}).click();await second.getByRole('combobox',{name:'Sprache der Arbeitsoberfläche',exact:true}).selectOption(JSON.stringify('en-GB'));await second.getByRole('button',{name:'Bestätigen und Entwurf speichern',exact:true}).click();await second.locator('[data-backend="configuration"][data-outcome="PERSISTED"]').waitFor();
  await p.getByRole('button',{name:'Bestätigten synthetischen Plan einmal anwenden',exact:true}).click();await status(p).filter({hasText:'Kein bestätigter Anwendungsnachweis'}).waitFor();assert.equal(existsSync(leading(f)),false);assert.equal(await p.getByRole('button',{name:'Bestätigten synthetischen Plan einmal anwenden',exact:true}).isDisabled(),true);
  await second.locator('[data-configuration-steps]').getByRole('button',{name:'Plan und Ergebnis',exact:true}).click();await second.getByRole('button',{name:'Anwendungsstand unabhängig lesen',exact:true}).click();await second.getByRole('button',{name:'Einrichtungsplan vorbereiten',exact:true}).click();await appPhase566(second,'PENDING');await second.getByRole('button',{name:'Unangewendeten Plan verwerfen',exact:true}).focus();await second.keyboard.press('Enter');await appPhase566(second,'CANCELLED');assert.equal(existsSync(leading(f)),false);
  evidence('E1-real-second-tab-current-authority-denial',{sourceCommit:f.identity.sourceCommit,sourceTree:f.identity.sourceTree,boundaries,actualTabs:2,nativeLeadingExists:false});
 }finally{await second?.close();}
}));

test('E1-AC01/04/05/06 actual optional model asset503 leaves manual path usable; actual native200 lost after effect reconciles515 once, duplicate409 and offline clear',{timeout:180000},async()=>serial('E1-optional-model-native-unknown',async f=>{
 const p=f.page;let cdp,captured;let actual200=0;
 try{
   let blockedModelAssets=0;await p.route('**/workspace/model-connection/app.js',route=>{blockedModelAssets++;return route.fulfill({status:503,contentType:'text/plain',body:'unavailable'});});
  await openModelFreeConfiguration566(f);await p.locator('[data-configuration-steps]').getByRole('button',{name:'Modellverbindung',exact:true}).click();await p.getByRole('button',{name:'Vorhandenen Verbindungsstatus anzeigen',exact:true}).click();await p.locator('[data-backend="configuration"][data-outcome="MODEL_NOT_CONFIGURED"]').waitFor();assert.equal(blockedModelAssets,1);empty(await model(p));assert.equal(existsSync(leading(f)),false);
  await completeModelFreeDraft566(p);await prepare(p);await confirm(p);
  await p.route('**/workspace/configuration-application',async route=>{if(route.request().postDataJSON().operation==='APPLY'){const headers={};for(const key of ['content-type','x-pan548-session','x-pan548-tab','x-pan548-tab-id','x-pan546-context','x-pan527-csrf'])if(route.request().headers()[key])headers[key]=route.request().headers()[key];captured={body:route.request().postDataJSON(),headers};}await route.continue();});
  cdp=await f.context.newCDPSession(p);await cdp.send('Fetch.enable',{patterns:[{urlPattern:f.tls.origin+'/t/tenant-a/workspace/configuration-application',requestStage:'Response'}]});
  cdp.on('Fetch.requestPaused',async event=>{if(JSON.parse(event.request.postData??'{}').operation==='APPLY'){assert.equal(event.responseStatusCode,200);actual200++;await cdp.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'ConnectionClosed'});}else await cdp.send('Fetch.continueRequest',{requestId:event.requestId});});
  await p.getByRole('button',{name:'Bestätigten synthetischen Plan einmal anwenden',exact:true}).click();await status(p).filter({hasText:'Ausgang unklar'}).waitFor();assert.equal(actual200,1);assert.equal(await p.getByRole('button',{name:'Bestätigten synthetischen Plan einmal anwenden',exact:true}).isDisabled(),true);await waitNative566(p);await cdp.send('Fetch.disable');await p.unroute('**/workspace/configuration-application');
  const actual=await result(p,f);
  const repeat=await p.evaluate(async request=>{const r=await fetch('/t/tenant-a/workspace/configuration-application',{method:'POST',credentials:'same-origin',headers:request.headers,body:JSON.stringify(request.body)});return r.status;},captured);assert.equal(repeat,409);assert.equal(readPan515TradeState({root:leading(f)}).revision,2);assert.equal((await readGuided566(p)).budget.runtime.consumedUnits,1);empty(await model(p));
  await f.stop();await p.getByRole('button',{name:'Anwendungsstand unabhängig lesen',exact:true}).click();await status(p).filter({hasText:'Kein bestätigter Anwendungsnachweis'}).waitFor();assert.equal(await p.locator('.configuration-application-diff').count(),0);await p.setViewportSize({width:390,height:844});await status(p).scrollIntoViewIfNeeded();await image(p,f,'E1-real-optional-model-native-offline',{actualModelAssetStatus:503,actualNativeOwnerStopped:true,acceptedApplicationCleared:true});
  evidence('E1-actual-optional-model-native200-lost-and-readback',{sourceCommit:f.identity.sourceCommit,sourceTree:f.identity.sourceTree,optionalModelAssetStatus:503,actualNative200:actual200,actualBusinessValue:actual.quantities,replayStatus:repeat,runtimeConsumed:1,remoteModelInference:false});
 }finally{await cdp?.detach();}
}));
