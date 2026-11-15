import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {nativeViewBrowserFixture546} from '../pan546/browser-fixture.mjs';
import {localModelServer565,limits565,syntheticCredential565} from './native-fixture.mjs';
import {connectionTransportIdentityV1} from '../../src/pan565/connection-transport.mjs';
import {MODEL_CONNECTION_TEST_DATA_DIGEST_V1} from '../../src/pan565/native-model-connection.mjs';
import {request527} from '../pan527/helpers.mjs';
const root='[id="shell.model-connection"]',schema='pansphaira.workspace-model-connection/';
const sha=b=>createHash('sha256').update(b).digest('hex');
const posts=(f,suffix)=>f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/model-connection/'+suffix));
function evidence(){assert.ok(process.env.PAN565_BROWSER_EVIDENCE,'PAN565 actual evidence required, never skip');mkdirSync(process.env.PAN565_BROWSER_EVIDENCE,{recursive:true,mode:0o700});return process.env.PAN565_BROWSER_EVIDENCE;}
async function fixture({grant=false,empty=false,two=false,ownerBound=false}={}){const server=await localModelServer565(),privateRoot=mkdtempSync(join(tmpdir(),'pan565-browser-existing-secret-')),credentialFile=join(privateRoot,'existing-model-credential');writeFileSync(credentialFile,syntheticCredential565+'\n',{mode:0o600});const identity=connectionTransportIdentityV1(),summary={connectionId:'connection:synthetic-v1',routeId:'route:synthetic-openai-chat-completions',provider:'provider:synthetic-model',model:'model:synthetic-v1',protocol:'OPENAI_CHAT_COMPLETIONS',authMethod:'EXISTING_SECRET_REFERENCE',secretReference:'credential-handle:synthetic-model-v1',evidenceClass:'SYNTHETIC_ONLY',availability:{runtime:true,provider:true,auth:true,model:true,functions:true},selectable:true,identity:{...identity,deploymentId:'deployment:synthetic-local-v1',configurationRevision:1}};if(ownerBound)Object.assign(summary,{evidenceClass:'OWNER_BOUND_NOT_QUALIFIED',provider:'provider:local-owner-test'});const options={summary,target:{origin:server.origin,allowedAddresses:['127.0.0.1'],localOnly:true},credentialFile,pricing:ownerBound?{currency:'EUR',revision:1,inputMicrosPerMillionTokens:0,outputMicrosPerMillionTokens:0}:null,productGrant:grant?{limits:limits565,testDataDigest:MODEL_CONNECTION_TEST_DATA_DIGEST_V1,expiresAtMs:Date.now()+180000}:null};let f;const connections=[options];if(two){options.summary={...summary,connectionId:'connection:synthetic-common-prefix-aaaaaaaaaaaa-first-v1'};connections.push({...options,summary:{...options.summary,connectionId:'connection:synthetic-common-prefix-aaaaaaaaaaaa-second-v1'}});}try{f=await nativeViewBrowserFixture546({modelConnections:empty?[]:connections});}catch(e){await server.close();rmSync(privateRoot,{recursive:true,force:true});throw e;}return {...f,server,credentialFile,async close(){try{await f.close();}finally{await server.close();rmSync(privateRoot,{recursive:true,force:true});}}};}
async function current(f){await f.page.locator(root+'[data-state="CURRENT_CONNECTION"]').waitFor();}
async function open(f){await f.page.goto(f.tls.origin+'/t/tenant-a/workspace');await f.page.locator(root).waitFor();await f.page.locator(root).getByRole('button',{name:'Sichere Modellverbindung öffnen',exact:true}).click();}
async function snapshot(f){let timer;try{await Promise.race([f.flushResponses(),new Promise((_,reject)=>{timer=setTimeout(()=>{console.log('PAN565 actual incomplete browser responses '+JSON.stringify(f.responses.map(r=>({path:r.path,status:r.status,method:r.method,bodyReadCompleted:r.value!==null,bodyReadFailure:r.bodyReadFailure??null}))));reject(Error('PAN565_NATIVE_RESPONSE_BODY_NOT_COMPLETED'));},10000);})]);}finally{clearTimeout(timer);}return f.responses.filter(r=>r.path.endsWith('/model-connection')&&r.method==='GET'&&r.status===200).at(-1)?.value;}
async function choose(f){await f.page.locator('#pan565-connection-choice').selectOption('connection:synthetic-v1');await f.page.locator(root).getByRole('button',{name:'Genau diese Referenz setzen',exact:true}).click();await current(f);const r=await snapshot(f);assert.equal(r.selectedConnectionId,'connection:synthetic-v1');assert.equal(r.persisted,true);return r;}
async function probe(f,label,phase){await f.page.locator(root).getByRole('button',{name:label+' separat prüfen',exact:true}).click();await current(f);const r=await snapshot(f);assert.equal(r.checks[phase].state,'PASS');return r;}
// RUN67: honest read of the REAL source persistence — a second read-only
// connection to the same personal-profile database the mounted product owner
// itself writes (src/pan543/profile-store.mjs: workspace_model_connections).
// Existing test-owned leading source only: no new public ledger enumeration,
// no owner reopen, no new endpoint or DTO.
function persistedConnectionRow565(f){const db=new DatabaseSync(join(f.root,'browser-profiles.sqlite'),{readOnly:true});try{const rows=db.prepare("SELECT revision,state,instance,generation FROM workspace_model_connections WHERE tenant='tenant-a' AND subject='synthetic:erv-reader'").all();assert.equal(rows.length,1,'PAN565_MUTATION_PERSISTED_ROW_NOT_IN_REAL_SOURCE');return{revision:rows[0].revision,instance:rows[0].instance,generation:rows[0].generation,state:JSON.parse(rows[0].state)};}finally{db.close();}}
// RUN104: closed-route reconciliation probes. The fixture deliberately does not parse non-200
// bodies (RUN66), so every in-page probe reads its OWN real response body: a bare non-200 would
// pass vacuously on the closed route gate before the owner. The raw request527 probes cover the
// Origin/CSRF gates that a real browser always sends implicitly, so each denial names its exact
// authority (closed route/method gate, ingress origin, route CSRF, session-bound scope, owner
// reason) as the real [status,error] facts.
async function reconcileProbe565(f,cases){return f.page.evaluate(async(cs)=>{const out=[];for(const c of cs){const headers={'content-type':'application/json',...(c.session===undefined?{}:{'x-pan565-session':c.session})};const response=await fetch('/t/tenant-a/workspace/model-connection/reconcile',{method:'POST',credentials:'same-origin',headers,body:JSON.stringify(c.body)});let error=null;try{error=(await response.json()).error;}catch{}out.push([c.name,response.status,error]);}return out;},cases);}
async function rawProbe565(f,path,{method='POST',headers={},body}={}){const r=await request527(f.tls,path,{cookie:f.session().cookieHeader.split(';')[0],...headers},method,body);let error=null;try{error=JSON.parse(r.body).error;}catch{}return[r.status,error];}
// RUN69: deterministic REAL state observation. The attach observer watches
// childList on the document NODE itself — documentElement may not exist yet
// when an addInitScript runs, and observing it recorded nothing at all (the
// actual RUN67 failure). The observer samples the existing root data-state at
// attach time (covers an already-set initial state) and then keeps EVERY
// data-state MutationRecord with its real old and new value, so same-microtask
// re-stamps stay visible; distinct-value transitions are derived from the
// initial sample plus the record trail, never from one current-dataset read.
// RUN70 losslessness: reading r.target.dataset.state per record collapses all
// records of one synchronous batch to the FINAL batch value (the actual RUN69
// failure), because the callback only runs after the batch. In this assembly
// every record is the same target/attribute (the observer watches only this
// element's data-state), so a record's real new value IS the actual oldValue
// of the next record in the same flush, and only the LAST record of a flush
// may use the real current sample taken at callback time. Pure chaining of
// recorded facts — no seeded states, no reconstruction from expectations.
const stateObserverInit565=()=>{const obs={initial:null,records:[]};window.__pan565StateObservation=obs;const attach=new MutationObserver(()=>{const el=document.getElementById('shell.model-connection');if(!el)return;attach.disconnect();obs.initial=el.hasAttribute('data-state')?String(el.dataset.state):'ABSENT';new MutationObserver(rs=>{const final=el.hasAttribute('data-state')?String(el.dataset.state):'ABSENT';for(let i=0;i<rs.length;i++){const r=rs[i],n=rs[i+1];obs.records.push({previous:r.oldValue===null?'ABSENT':String(r.oldValue),current:n?(n.oldValue===null?'ABSENT':String(n.oldValue)):final});}}).observe(el,{attributes:true,attributeFilter:['data-state'],attributeOldValue:true});});attach.observe(document,{childList:true,subtree:true});};
function stateObservation565(f){return f.page.evaluate(()=>{const o=window.__pan565StateObservation;if(!o)throw Error('PAN565_MUTATION_STATE_OBSERVER_NOT_INSTALLED');const transitions=[];for(const v of[o.initial,...o.records.map(r=>r.current)])if(v!=='ABSENT'&&v!==transitions.at(-1))transitions.push(v);return{initial:o.initial,records:o.records.map(r=>r.previous+'->'+r.current),transitions};});}
async function capture(f,name){const path=join(evidence(),name+'.png');const body=await f.page.locator('body').innerText();assert.ok(!body.includes(syntheticCredential565));assert.equal(await f.page.locator(root+' input[type=password]').count(),0);await f.page.screenshot({path,fullPage:true});const geometry=await f.page.evaluate(()=>({viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,zoom:getComputedStyle(document.body).zoom,controls:[...document.querySelectorAll('[id="shell.model-connection"] button,[id="shell.model-connection"] select')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{label:e.textContent,left:r.left,right:r.right,width:r.width,height:r.height};})}));assert.ok(geometry.pageWidth<=geometry.viewport,'PAN565_PAGE_HORIZONTAL_OVERFLOW');assert.ok(geometry.controls.every(c=>c.width>0&&c.height>0&&c.left>=0&&c.right<=geometry.viewport),'PAN565_CONTROL_CLIPPING');const pins={};for(const p of ['dist/browser-workspace/app.js','dist/browser-workspace/workspace-model-connection.js','packages/browser-workspace/src/workspace-model-connection-v1.ts','packages/browser-workspace/src/workspace-model-connection-v1.css','src/pan565/native-model-connection.mjs','src/pan565/connection-transport.mjs'])pins[p]=sha(readFileSync(p));const r=await snapshot(f);writeFileSync(path+'.json',JSON.stringify({name,imageSHA256:sha(readFileSync(path)),geometry,pins,state:await f.page.locator(root).count()?await f.page.locator(root).getAttribute('data-state'):null,nativeReadback:r,actualSyntheticRequests:{get:f.server.get(),post:f.server.post()},realModelAcceptance:false},null,2)+'\n');return name;}
test('A4-AC01/02/03/06 real mounted keyboard reference -> native persisted metadata -> independent GET -> separate auth/model statuses -> reload; desktop390zoom no secret or inference',async()=>{const f=await fixture();try{const before=f.business();await open(f);await current(f);assert.equal(f.server.get(),0);assert.equal(f.server.post(),0);await capture(f,'desktop-reference-only-unselected');await f.page.locator('#pan565-connection-choice').focus();await f.page.locator('#pan565-connection-choice').selectOption('connection:synthetic-v1');await f.page.locator(root).getByRole('button',{name:'Genau diese Referenz setzen',exact:true}).focus();await f.page.keyboard.press('Enter');await current(f);let r=await snapshot(f);assert.equal(r.revision,1);assert.equal(r.selectedConnectionId,'connection:synthetic-v1');assert.equal(r.checks.INFERENCE.state,'NOT_RUN');assert.equal(r.inferenceOffer,null);await capture(f,'desktop-native-selected-minimized-reference');await probe(f,'Erreichbarkeit','REACHABILITY');await probe(f,'Authentifizierung','AUTHENTICATION');r=await probe(f,'Modellverfügbarkeit','MODEL_AVAILABILITY');assert.equal(r.checks.INFERENCE.state,'NOT_RUN');assert.equal(await f.page.locator(root).getByRole('button',{name:'Begrenzte Inferenz separat prüfen',exact:true}).isDisabled(),true);assert.equal(f.server.get(),3);assert.equal(f.server.post(),0);await f.page.setViewportSize({width:390,height:844});await capture(f,'390-native-separate-model-list-not-inference');await f.page.evaluate(()=>{document.body.style.zoom='2';});await capture(f,'390-zoom200-native-reference-status-long-identities');await f.page.evaluate(()=>{document.body.style.zoom='1';});await f.page.locator(root).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).focus();await f.page.keyboard.press('Escape');assert.equal(await f.page.locator('#pan565-connection-body').isVisible(),false);assert.equal(await f.page.locator(root).getByRole('button',{name:'Sichere Modellverbindung öffnen',exact:true}).evaluate(e=>e===document.activeElement),true);await f.page.reload();await current(f);r=await snapshot(f);assert.equal(r.checks.MODEL_AVAILABILITY.state,'PASS');assert.equal(posts(f,'select').length,1);assert.equal(f.server.post(),0);assert.equal(f.business(),before);assert.deepEqual(f.errors,[]);}finally{await f.close();}});
test('A4-AC05/06 exact browser consent not implicit: one actual SYNTHETIC_ONLY POST through broker, false real acceptance, capped no repeat',async()=>{const f=await fixture({grant:true});try{await open(f);await current(f);await choose(f);await probe(f,'Erreichbarkeit','REACHABILITY');await probe(f,'Authentifizierung','AUTHENTICATION');await probe(f,'Modellverfügbarkeit','MODEL_AVAILABILITY');assert.equal(f.server.post(),0);await capture(f,'desktop-three-checks-explicit-capped-offer-not-dispatched');await f.page.locator(root).getByRole('button',{name:'Genau diese gedeckelte Inferenzprobe freigeben',exact:true}).click();await current(f);assert.equal(f.server.post(),0);await capture(f,'desktop-exact-synthetic-consent-before-dispatch');let r=await probe(f,'Begrenzte Inferenz','INFERENCE');assert.equal(r.realModelAcceptance,false);assert.equal(r.checks.INFERENCE.reason,'SYNTHETIC_INFERENCE_FORMAT_ONLY');assert.equal(f.server.post(),1);assert.equal(await f.page.locator(root).getByRole('button',{name:'Begrenzte Inferenz separat prüfen',exact:true}).isDisabled(),true);await f.page.locator(root).getByRole('button',{name:'Begrenzte Inferenz separat prüfen',exact:true}).evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.equal(f.server.post(),1);await capture(f,'desktop-synthetic-framing-only-not-real-model');assert.deepEqual(f.errors,[]);}finally{await f.close();}});
test('A4 genuine persisted selection reply lost: no native mutation replay, independent GET only reconciles same reference; loading and denial shown',async()=>{const f=await fixture();let cdp;try{await open(f);await current(f);await f.page.locator('#pan565-connection-choice').selectOption('connection:synthetic-v1');cdp=await f.context.newCDPSession(f.page);let held,resolve;const paused=new Promise(r=>{resolve=r;});await cdp.send('Fetch.enable',{patterns:[{urlPattern:f.tls.origin+'*/workspace/model-connection/select',requestStage:'Response'}]});cdp.on('Fetch.requestPaused',e=>{held=e;resolve();});await f.page.locator(root).getByRole('button',{name:'Genau diese Referenz setzen',exact:true}).click();await paused;assert.equal(held.responseStatusCode,200);const b=await cdp.send('Fetch.getResponseBody',{requestId:held.requestId}),native=JSON.parse(Buffer.from(b.body,b.base64Encoded?'base64':'utf8').toString());assert.equal(native.persisted,true);await capture(f,'desktop-real-persisted-selection-response-held-loading');await cdp.send('Fetch.failRequest',{requestId:held.requestId,errorReason:'Failed'});await f.page.locator(root+'[data-state="READBACK_NOT_CONFIRMED"]').waitFor();await capture(f,'desktop-real-lost-select-reply-no-mutation-replay');assert.equal(posts(f,'select').length,1);await cdp.send('Fetch.disable');await f.page.locator(root).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();await current(f);assert.equal((await snapshot(f)).revision,native.revision);assert.equal(posts(f,'select').length,1);assert.equal(f.server.post(),0);assert.deepEqual(f.errors,[]);}finally{await cdp?.detach();await f.close();}});
test('A4 session retirement and raw URL/secret/cross-tenant body/headers denied by protected native route, no provider transport or late readiness',async()=>{const f=await fixture();try{await open(f);await current(f);const r=await choose(f);const statuses=await f.page.evaluate(async({sessionId,revision,identityDigest})=>{const base='/t/tenant-a/workspace/model-connection',body={schemaVersion:'pansphaira.workspace-model-connection/probe/v1',expectedRevision:revision,identityDigest,phase:'REACHABILITY'},out=[];for(const [path,headers,value]of [[base+'/probe',{'content-type':'application/json','x-pan565-session':sessionId},{...body,url:'http://169.254.169.254'}],[base+'/probe',{'content-type':'application/json','x-pan565-session':'session:'+'0'.repeat(64)},body],['/t/tenant-b/workspace/model-connection/probe',{'content-type':'application/json','x-pan565-session':sessionId},body]]){const response=await fetch(path,{method:'POST',headers,body:JSON.stringify(value)});await response.text();out.push(response.status);}return out;},{sessionId:r.binding.sessionId,revision:r.revision,identityDigest:r.identityDigest});assert.ok(statuses.every(s=>s!==200));assert.equal(f.server.get(),0);assert.equal(f.server.post(),0);const logout=await f.page.evaluate(async()=>{const r=await fetch('/t/tenant-a/workspace/logout',{method:'POST'});return r.status;});assert.equal(logout,200);await f.page.locator(root).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();await f.page.locator(root+'[data-state="READBACK_NOT_CONFIRMED"]').waitFor();await capture(f,'desktop-retired-session-no-readiness');assert.equal(f.server.post(),0);assert.deepEqual(f.errors,[]);}finally{await f.close();}});
test('A4 empty authorized product route honest NOT_RUN and disabled reference; optional module error keeps manual native view and logout',async()=>{const f=await fixture({empty:true});try{await open(f);await f.page.locator(root+'[data-state="NO_AUTHORIZED_CONNECTION"]').waitFor();await capture(f,'desktop-no-authorized-product-route-not-external-finished');assert.equal(await f.page.locator('#pan565-connection-choice').isDisabled(),true);assert.equal(f.server.post(),0);await f.page.route('**/workspace/model-connection/app.js',route=>route.abort('failed'));await f.page.reload();await f.page.getByRole('button',{name:'Eingangsrechnungsprüfung — nur lesen',exact:true}).click();await showCurrentViewDetailsUI(f.page);await f.page.locator('[id="shell.module-view"][data-state="CURRENT_NATIVE_VIEW"]').waitFor();assert.equal(await f.page.locator(root).count(),0);assert.equal(f.readPersisted().revision,0);await f.page.getByRole('button',{name:'Abmelden',exact:true}).click();await f.page.getByRole('heading',{name:'Abgemeldet',exact:true}).waitFor();assert.equal(f.server.post(),0);assert.deepEqual(f.errors,[]);}finally{await f.close();}});
test('553-R5 visible exact synthetic consent discloses all eight enforced caps and test data before explicit grant',async()=>{const f=await fixture({grant:true});try{await open(f);await current(f);await choose(f);for(const [label,phase]of [['Erreichbarkeit','REACHABILITY'],['Authentifizierung','AUTHENTICATION'],['Modellverfügbarkeit','MODEL_AVAILABILITY']])await probe(f,label,phase);const offer=(await snapshot(f)).inferenceOffer;assert.ok(offer);const labels=['Max. Kosten','Max. Laufzeit','Max. Turns','Max. Tools','Max. Modellrequests','Max. Tokens','Max. Eingabebytes','Max. Ausgabebytes'];for(const label of labels)assert.ok((await f.page.locator(root).innerText()).includes(label),'UNDISCLOSED_CAP_'+label);assert.ok((await f.page.locator(root).innerText()).includes(offer.testDataDigest));assert.ok((await f.page.locator(root).innerText()).includes('Nullpreis'));assert.ok((await f.page.locator(root).innerText()).includes('keine Produktfreigabe'));for(const [key,value]of Object.entries(offer.limits))assert.ok((await f.page.locator(root).innerText()).includes(String(value)),'UNDISCLOSED_VALUE_'+key);await capture(f,'desktop-all-eight-synthetic-consent-caps-before-grant');assert.equal(f.server.post(),0);assert.deepEqual(f.errors,[]);}finally{await f.close();}});
test('556-R5 two long common-prefix references show full draft identity before set and distinct independently confirmed native identity at390 and200zoom',async()=>{for(const zoom of ['1','2']){const f=await fixture({grant:true,two:true});try{await f.page.setViewportSize({width:390,height:844});await open(f);await current(f);await f.page.evaluate(z=>{document.body.style.zoom=z;},zoom);const ids=await f.page.locator('#pan565-connection-choice option').evaluateAll(es=>es.map(e=>e.value).filter(Boolean));assert.equal(ids.length,2);assert.notEqual(ids[0],ids[1]);assert.equal(ids[0].slice(0,44),ids[1].slice(0,44));const preview=f.page.locator('#pan565-choice-preview'),confirmed=f.page.locator('#pan565-confirmed-reference');assert.equal(await preview.count(),1,'FULL_SELECTION_PREVIEW_MISSING');assert.equal(await confirmed.count(),1,'DISTINCT_NATIVE_CONFIRMATION_MISSING');await f.page.locator('#pan565-connection-choice').selectOption(ids[0]);assert.ok((await preview.innerText()).includes(ids[0]));assert.ok((await preview.innerText()).includes('model:synthetic-v1'));assert.ok((await preview.innerText()).includes('SYNTHETIC_ONLY'));assert.ok((await preview.innerText()).includes('noch nicht'));assert.equal((await snapshot(f)).selectedConnectionId,null);assert.equal(posts(f,'select').length,0);await capture(f,'390-zoom'+zoom+'-long-reference-A-draft-full-triplet-not-set');await f.page.locator('#pan565-select').click();await current(f);assert.equal((await snapshot(f)).selectedConnectionId,ids[0]);for(const [label,phase]of [['Erreichbarkeit','REACHABILITY'],['Authentifizierung','AUTHENTICATION'],['Modellverfügbarkeit','MODEL_AVAILABILITY']])await probe(f,label,phase);assert.equal(await f.page.locator('#pan565-consent').isDisabled(),false);assert.ok((await confirmed.innerText()).includes(ids[0]));await f.page.locator('#pan565-connection-choice').selectOption(ids[1]);assert.ok((await preview.innerText()).includes(ids[1]));assert.ok((await preview.innerText()).includes('noch nicht'));assert.ok((await confirmed.innerText()).includes(ids[0]));assert.ok(!(await confirmed.innerText()).includes(ids[1]));assert.equal((await snapshot(f)).selectedConnectionId,ids[0]);assert.equal(posts(f,'select').length,1);assert.equal(await f.page.locator('#pan565-consent').isDisabled(),true);assert.equal(await f.page.locator('#pan565-probe-REACHABILITY').isDisabled(),true);await f.page.locator('#pan565-consent').evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.equal(posts(f,'consent').length,0);assert.equal(f.server.post(),0);await capture(f,'390-zoom'+zoom+'-long-reference-B-draft-native-A-no-implicit-grant');await f.page.locator('#pan565-select').click();await current(f);const r=await snapshot(f);assert.equal(r.selectedConnectionId,ids[1]);assert.equal(r.persisted,true);assert.ok((await preview.innerText()).includes(ids[1]));assert.ok((await confirmed.innerText()).includes(ids[1]));assert.equal(posts(f,'select').length,2);assert.equal(f.server.post(),0);await capture(f,'390-zoom'+zoom+'-long-reference-B-independently-confirmed');assert.deepEqual(f.errors,[]);}finally{await f.close();}}});
test('556 followup genuine POST ACK followed by pending independent GET keeps REQUESTING and disabled authority, never final persisted assertion until exact GET',async()=>{const f=await fixture();let cdp;try{await open(f);await current(f);await f.page.locator('#pan565-connection-choice').selectOption('connection:synthetic-v1');cdp=await f.context.newCDPSession(f.page);let held,resolve;const paused=new Promise(r=>{resolve=r;});await cdp.send('Fetch.enable',{patterns:[{urlPattern:f.tls.origin+'*/workspace/model-connection',requestStage:'Response'}]});cdp.on('Fetch.requestPaused',e=>{held=e;resolve();});await f.page.locator('#pan565-select').click();await paused;assert.equal(held.request.method,'GET');assert.equal(held.responseStatusCode,200);const b=await cdp.send('Fetch.getResponseBody',{requestId:held.requestId}),native=JSON.parse(Buffer.from(b.body,b.base64Encoded?'base64':'utf8').toString());assert.equal(native.persisted,true);assert.equal(native.selectedConnectionId,'connection:synthetic-v1');assert.equal(await f.page.locator(root).getAttribute('data-state'),'REQUESTING');assert.equal(await f.page.locator('#pan565-select').isDisabled(),true);assert.equal(await f.page.locator('#pan565-probe-REACHABILITY').isDisabled(),true);assert.equal((await snapshot(f)).selectedConnectionId,null);assert.equal(posts(f,'select').length,1);await capture(f,'desktop-real-independent-GET-held-after-ACK-not-final-confirmation');await cdp.send('Fetch.continueRequest',{requestId:held.requestId});await current(f);assert.equal((await snapshot(f)).revision,native.revision);assert.equal((await snapshot(f)).selectedConnectionId,native.selectedConnectionId);assert.equal(posts(f,'select').length,1);assert.equal(f.server.get(),0);assert.equal(f.server.post(),0);assert.deepEqual(f.errors,[]);}finally{await cdp?.detach();await f.close();}});
test('553 keyboard native action retains connected enabled focus and next phase works without refocusing after response',async()=>{const f=await fixture();try{await open(f);await current(f);await choose(f);const reach=f.page.locator(root).getByRole('button',{name:'Erreichbarkeit separat prüfen',exact:true});await reach.focus();await reach.press('Enter');await current(f);assert.equal((await snapshot(f)).checks.REACHABILITY.state,'PASS');assert.equal(await f.page.evaluate(()=>document.activeElement?.textContent),'Erreichbarkeit separat prüfen');await f.page.keyboard.press('Tab');assert.equal(await f.page.evaluate(()=>document.activeElement?.textContent),'Authentifizierung separat prüfen');await f.page.keyboard.press('Enter');await current(f);assert.equal((await snapshot(f)).checks.AUTHENTICATION.state,'PASS');assert.equal(await f.page.evaluate(()=>document.activeElement?.textContent),'Authentifizierung separat prüfen');await capture(f,'desktop-native-keyboard-focus-survives-auth-response');assert.equal(f.server.post(),0);assert.deepEqual(f.errors,[]);}finally{await f.close();}});
// RUN67: mutation-ADMISSION loss in the real shared browser assembly. The
// revocation is the ACTUAL trusted native565 owner close (the same fixture
// seam accepted for the start-admission case), but here it lands inside the
// mutation window: AFTER the browser has fully consumed the genuine select
// ACK and BEFORE the required independent read is authorized by the server.
// The real read request is observed at a test-owned transport barrier (a
// page route in front of the real protected ingress); the real owner close
// happens there, then the SAME real request continues to the ingress, so
// the genuine MODEL_CONNECTION_OWNER_CLOSED surfaces as a real HTTP409 —
// never a fulfilled fake, never a completed200 snapshot called revocation.
// Chronological authority: (1) server ACK/persistence — the shared collector
// records the real200 mutation readback with persisted:true, revision 1;
// (2) browser ACK consumption — the product only dispatches the independent
// read after request() finished validating the ACK body, the closed DTO and
// the session binding, so the barrier hit itself proves consumption;
// (3) new GET dispatch — at the barrier, before closing anything, the test
// captured the REAL DOM still REQUESTING and zero collected denials, then
// closed the real owner and let the untouched request continue; (4) denial —
// the ingress really answered409 AFTER that close, the product discarded the
// denied response before body consumption and landed on READBACK_NOT_CONFIRMED.
// RUN69 instrumentation, described accurately: state evidence comes from the
// real DOM observer installed before any page script (document-node attach,
// existing-initial-state sample, every data-state MutationRecord kept with
// its old and new value), so same-microtask re-stamps are visible and the
// no-transient-CURRENT_CONNECTION claim rests on recorded old/new pairs plus
// the current final sample, not on one current-dataset read per callback.
// There are no fixed sleeps; awaitDenials is bounded POLLING (up to 200*25ms)
// that waits only for the server-side denial fact to be collected, never for
// a DOM state. The persisted selected reference/revision is NOT lost (exactly
// one row in the real profile-store source at its exact tenant/subject/
// instance/generation identity, grant/lastOperation unchanged) yet the browser
// never asserted the final CURRENT_CONNECTION. No second select/probe/consent
// POST, no provider request after the close, no stale readiness (mutable
// controls are gone with the denial view), the independent read stays
// explicit, and a real reload retains the honest denial without resurrecting
// the reference authority.
test('565 mutation admission loss: genuine select ACK consumed, real565 owner closed at the independent-read barrier yields the real GET409 denial into READBACK_NOT_CONFIRMED, never final CURRENT_CONNECTION; no replay, no provider transport, persisted reference retained, explicit re-read and reload keep the honest denial',async()=>{
 const f=await fixture();let intercepted=0,barrier=null;
 try{
  await f.page.addInitScript(stateObserverInit565);
  const denied409=()=>f.responses.filter(r=>r.method==='GET'&&r.path.endsWith('/workspace/model-connection')&&r.status===409);
  async function awaitDenials(n){for(let i=0;i<200&&denied409().length<n;i++)await new Promise(r=>setTimeout(r,25));assert.equal(denied409().length,n,'PAN565_MUTATION_REAL_409_DENIAL_COUNT_DRIFTED');}
  await open(f);await current(f);
  const r0=await snapshot(f);assert.equal(r0.revision,0);assert.equal(r0.selectedConnectionId,null);
  let obs=await stateObservation565(f);
  assert.equal(obs.initial,'ABSENT','PAN565_MUTATION_INITIAL_ROOT_STATE_NOT_HONEST');
  assert.deepEqual(obs.transitions,['READING','CURRENT_CONNECTION'],'PAN565_MUTATION_STATE_OBSERVER_INACTIVE');
  const beforeClickRecords=obs.records.length,beforeClickTransitions=obs.transitions.length;
  const modelOwner=f.modelConnectionOwner();
  assert.ok(modelOwner&&typeof modelOwner.close==='function','PAN565_MUTATION_REAL565_OWNER_MISSING_FROM_FIXTURE_SEAM');
  await f.page.locator('#pan565-connection-choice').selectOption('connection:synthetic-v1');
  // Test-owned transport barrier for the REAL independent read: the genuine
  // GET is observed before it reaches the server, the real trusted mount
  // owner close fires exactly once there, then the untouched request
  // continues into the real protected ingress. No fulfilled fake, no
  // fabricated status, no product change to make instrumentation pass.
  await f.page.route(u=>u.origin===f.tls.origin&&u.pathname==='/t/tenant-a/workspace/model-connection',async route=>{
   if(route.request().method()==='GET'&&intercepted===0){intercepted++;
    barrier={domAtDispatch:await f.page.locator(root).getAttribute('data-state'),denialsBeforeClose:denied409().length};
    modelOwner.close();}
   await route.continue();
  });
  await f.page.locator(root).getByRole('button',{name:'Genau diese Referenz setzen',exact:true}).click();
  await f.page.locator(root+'[data-state="READBACK_NOT_CONFIRMED"]').waitFor();
  await f.flushResponses();
  assert.equal(intercepted,1,'PAN565_MUTATION_INDEPENDENT_READ_NOT_DISPATCHED_EXACTLY_ONCE');
  // (1) server ACK/persistence: a genuine200 mutation readback the product
  // consumed — real persisted reference at revision 1, server-side fact.
  const ack=f.responses.filter(r=>r.method==='POST'&&r.path.endsWith('/model-connection/select')).at(-1);
  assert.ok(ack&&ack.status===200&&ack.value,'PAN565_MUTATION_REAL_SELECT_ACK_MISSING');
  assert.equal(ack.value.persisted,true);assert.equal(ack.value.revision,1);assert.equal(ack.value.selectedConnectionId,'connection:synthetic-v1');
  // (4) the denial is a real ingress fact: closed-owner409 with the body
  // left honestly unparsed (RUN66 collector semantics, nothing invented).
  await awaitDenials(1);
  const denial=denied409().at(-1);
  assert.equal(denial.value,null);assert.equal(Object.hasOwn(denial,'bodyReadFailure'),false);assert.equal(denial.bodyNotObserved,'NON_200_BODY_NOT_OBSERVED_BY_FIXTURE');
  // (3)+(4) chronological close/denial ordering as recorded at the barrier
  // itself: the real DOM was still REQUESTING and zero denials had been
  // collected when the close fired; the observed409 came strictly after.
  assert.deepEqual(barrier,{domAtDispatch:'REQUESTING',denialsBeforeClose:0},'PAN565_MUTATION_BARRIER_ORDER_UNPROVEN');
  // No final assertion in the real DOM, substantiated per record: mutate()'s
  // synchronous re-render re-stamps the SAME CURRENT_CONNECTION (visible only
  // because every record is kept) before REQUESTING, then the denial; no real
  // transition INTO CURRENT_CONNECTION exists inside the denial window and
  // the current final sample is READBACK_NOT_CONFIRMED.
  obs=await stateObservation565(f);
  assert.deepEqual(obs.transitions.slice(beforeClickTransitions),['REQUESTING','READBACK_NOT_CONFIRMED'],'PAN565_MUTATION_WINDOW_FAKE_SUCCESS_LEAK');
  const denialWindow=obs.records.slice(beforeClickRecords);
  assert.deepEqual(denialWindow,['CURRENT_CONNECTION->CURRENT_CONNECTION','CURRENT_CONNECTION->REQUESTING','REQUESTING->READBACK_NOT_CONFIRMED'],'PAN565_MUTATION_WINDOW_RECORDS:'+JSON.stringify(denialWindow));
  assert.equal(await f.page.locator('#pan565-select').count(),0,'PAN565_MUTATION_SELECT_CONTROL_SURVIVED_DENIAL');
  assert.equal(await f.page.locator('#pan565-connection-choice').count(),0,'PAN565_MUTATION_CHOICE_CONTROL_SURVIVED_DENIAL');
  for(const phase of ['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY','INFERENCE'])assert.equal(await f.page.locator('#pan565-probe-'+phase).count(),0,'PAN565_MUTATION_STALE_READINESS_CONTROL_SURVIVED_DENIAL:'+phase);
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).count(),1,'PAN565_MUTATION_INDEPENDENT_READ_NOT_EXPLICIT');
  // The persisted selection survives in the REAL source with nothing
  // silently reset or granted: one row, revision 1, grant/lastOperation
  // unchanged, all checks still NOT_RUN.
  const row=persistedConnectionRow565(f);
  assert.equal(row.revision,1,'PAN565_MUTATION_PERSISTED_REVISION_LOST');assert.equal(row.state.connectionId,'connection:synthetic-v1');assert.equal(row.state.grant,null);assert.equal(row.state.lastOperation,null);
  // Exact source identity per the existing schema (profile-store.mjs:60,73):
  // the surviving row keeps its own instance/generation pair — test-owned
  // leading read of the real source, no broadened public observation.
  assert.match(row.instance,/^[a-z0-9][a-z0-9:_-]{0,95}$/,'PAN565_MUTATION_PERSISTED_INSTANCE_IDENTITY_NOT_EXACT');
  assert.ok(Number.isSafeInteger(row.generation)&&row.generation>=1,'PAN565_MUTATION_PERSISTED_GENERATION_NOT_EXACT');
  assert.deepEqual(Object.values(row.state.checks).map(c=>c.state),['NOT_RUN','NOT_RUN','NOT_RUN','NOT_RUN']);
  await capture(f,'desktop-real-owner-closed-inside-mutation-window-honest-denial');
  // The independent read remains explicit and honestly re-denies: no
  // resurrected authority, no mutation replay, no provider traffic.
  await f.page.locator(root).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  await awaitDenials(2);await f.flushResponses();
  assert.deepEqual((await stateObservation565(f)).transitions.slice(beforeClickTransitions),['REQUESTING','READBACK_NOT_CONFIRMED','READING','READBACK_NOT_CONFIRMED'],'PAN565_POST_DENIAL_EXPLICIT_READ_FAKE_SUCCESS');
  // A real reload retains the honest denial: the closed owner lets no new
  // readback through and never resurrects the reference authority.
  await f.page.reload();
  await f.page.locator(root+'[data-state="READBACK_NOT_CONFIRMED"]').waitFor();
  await awaitDenials(3);await f.flushResponses();
  const afterReload=await stateObservation565(f);
  assert.equal(afterReload.initial,'ABSENT','PAN565_RELOAD_OBSERVER_NOT_REINSTALLED_BEFORE_FIRST_STATE');
  assert.ok(!afterReload.transitions.includes('CURRENT_CONNECTION'),'PAN565_RELOAD_RESURRECTED_FINAL_CONNECTION:'+JSON.stringify(afterReload));
  assert.deepEqual(afterReload.transitions,['READING','READBACK_NOT_CONFIRMED'],'PAN565_RELOAD_NOT_HONESTLY_DENIED:'+JSON.stringify(afterReload.transitions));
  await f.page.locator(root).getByRole('button',{name:'Sichere Modellverbindung öffnen',exact:true}).click();
  assert.ok((await f.page.locator(root).innerText()).includes('nicht aktuell bestätigt'),'PAN565_RELOAD_DENIAL_NOT_EXPLAINED_IN_PANEL');
  await f.page.locator(root).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  await awaitDenials(4);await f.flushResponses();
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'READBACK_NOT_CONFIRMED','PAN565_RELOAD_EXPLICIT_READ_REVIVED_AUTHORITY');
  assert.equal(posts(f,'select').length,1,'PAN565_MUTATION_REPLAYED_AFTER_DENIED_READ');
  assert.equal(f.requests.filter(r=>r.method==='POST'&&r.path.includes('/model-connection/')).length,1,'PAN565_HIDDEN_PROBE_OR_CONSENT_POST');
  assert.equal(f.server.get(),0,'PAN565_PROVIDER_REQUEST_AFTER_OWNER_CLOSE');assert.equal(f.server.post(),0,'PAN565_PROVIDER_POST_AFTER_OWNER_CLOSE');
  const retained=persistedConnectionRow565(f);
  assert.equal(retained.revision,1,'PAN565_PERSISTED_REVISION_CHANGED_AFTER_RELOAD');assert.equal(retained.state.connectionId,'connection:synthetic-v1');assert.equal(retained.state.grant,null);
  assert.equal(retained.instance,row.instance,'PAN565_PERSISTED_INSTANCE_IDENTITY_CHANGED_AFTER_RELOAD');assert.equal(retained.generation,row.generation,'PAN565_PERSISTED_GENERATION_CHANGED_AFTER_RELOAD');
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

// RUN69: the directly connected PROBE admission-loss gap in the same real
// shared assembly, kept separate from the completed-ACK->denied-read case
// above. Here the trusted native565 owner close (the same assembly-only
// fixture seam) lands while the code-owned synthetic REACHABILITY probe is
// genuinely in flight: the provider fixture holds the real GET /v1/models
// unanswered (TIMEOUT mode, never released), so the close at
// native-model-connection.mjs:220 must abort the REAL probe AbortController
// and the closed owner must surface as a real HTTP409 on the probe POST
// (origin-session-adapter.mjs:1098). The interrupted probe is discarded
// honestly BEFORE any check write: the real source keeps every check NOT_RUN
// (no faked PASS), no grant and no lastOperation/UNKNOWN-usage hold appear,
// exactly one probe POST exists (no replay), the provider saw exactly the one
// genuine GET and no POST (no inference), and the browser lands on the same
// honest READBACK_NOT_CONFIRMED denial with the same per-record no-fake-success
// trail. Bounded polling waits only for the provider-side in-flight fact and
// the collected denial, never for a DOM state; no fixed sleeps.
test('565 probe admission loss: real owner closed while the synthetic REACHABILITY provider GET is genuinely in flight yields the real probe409 denial, provider GET not replayed, all checks stay NOT_RUN in the real source, no fake PASS, no consent, no inference, no UNKNOWN retry',async()=>{
 const f=await fixture();
 try{
  await f.page.addInitScript(stateObserverInit565);
  const probeResponses=()=>f.responses.filter(r=>r.method==='POST'&&r.path.endsWith('/model-connection/probe'));
  await open(f);await current(f);
  await choose(f);
  assert.equal(f.server.get(),0,'PAN565_PROBE_PROVIDER_TRAFFIC_BEFORE_PROBE');assert.equal(f.server.post(),0,'PAN565_PROBE_PROVIDER_POST_BEFORE_PROBE');
  f.server.setMode('TIMEOUT');
  const beforeProbe=await stateObservation565(f);
  await f.page.locator(root).getByRole('button',{name:'Erreichbarkeit separat prüfen',exact:true}).click();
  // The exchange is really in flight: the provider has observed the genuine
  // GET and holds it unanswered, while the probe POST has no response yet.
  let inFlight=false;for(let i=0;i<300&&!(inFlight=f.server.get()===1);i++)await new Promise(r=>setTimeout(r,10));
  assert.ok(inFlight,'PAN565_PROBE_PROVIDER_GET_NOT_TRULY_IN_FLIGHT');
  assert.equal(probeResponses().length,0,'PAN565_PROBE_POST_ANSWERED_BEFORE_OWNER_CLOSE');
  f.modelConnectionOwner().close();
  // Denial is again a real ingress fact: the aborted exchange cannot write a
  // check, the closed owner answered the still-pending probe POST with409.
  let denied=null;for(let i=0;i<200&&!(denied=probeResponses().find(r=>r.status===409));i++)await new Promise(r=>setTimeout(r,25));
  assert.ok(denied,'PAN565_PROBE_REAL_409_DENIAL_MISSING');
  assert.equal(denied.value,null);assert.equal(denied.bodyNotObserved,'NON_200_BODY_NOT_OBSERVED_BY_FIXTURE');
  await f.page.locator(root+'[data-state="READBACK_NOT_CONFIRMED"]').waitFor();
  await f.flushResponses();
  const after=await stateObservation565(f);
  assert.deepEqual(after.transitions.slice(beforeProbe.transitions.length),['REQUESTING','READBACK_NOT_CONFIRMED'],'PAN565_PROBE_FAKE_SUCCESS_IN_BROWSER');
  const probeWindow=after.records.slice(beforeProbe.records.length);
  assert.deepEqual(probeWindow,['CURRENT_CONNECTION->CURRENT_CONNECTION','CURRENT_CONNECTION->REQUESTING','REQUESTING->READBACK_NOT_CONFIRMED'],'PAN565_PROBE_WINDOW_RECORDS:'+JSON.stringify(probeWindow));
  assert.equal(await f.page.locator('#pan565-probe-REACHABILITY').count(),0,'PAN565_PROBE_FAKE_PASSED_CONTROL_SURVIVED_DENIAL');
  // Exactly the one real probe POST — the interrupted admission is never
  // replayed; no consent POST, no hidden extra mutation.
  assert.equal(probeResponses().length,1,'PAN565_PROBE_REPLAYED_AFTER_DENIED_POST');
  assert.equal(f.requests.filter(r=>r.method==='POST'&&r.path.includes('/model-connection/')).length,2,'PAN565_PROBE_HIDDEN_EXTRA_MUTATION');
  assert.equal(posts(f,'consent').length,0,'PAN565_PROBE_CONSENT_APPEARED');
  assert.equal(f.server.get(),1,'PAN565_PROVIDER_GET_REPLAYED_OR_DUPLICATED');assert.equal(f.server.post(),0,'PAN565_PROVIDER_POST_NO_INFERENCE');
  // The real source keeps the honest truth: revision unchanged at the select
  // value, no fake PASS check, no grant, no operation/UNKNOWN-usage hold.
  const row=persistedConnectionRow565(f);
  assert.equal(row.revision,1,'PAN565_PROBE_FAKE_PASS_REVISION');assert.equal(row.state.connectionId,'connection:synthetic-v1');
  assert.deepEqual(Object.values(row.state.checks).map(c=>c.state),['NOT_RUN','NOT_RUN','NOT_RUN','NOT_RUN'],'PAN565_PROBE_FAKE_PASS_PERSISTED');
  assert.equal(row.state.grant,null,'PAN565_PROBE_GRANT_APPEARED');assert.equal(row.state.lastOperation,null,'PAN565_PROBE_UNKNOWN_USAGE_HOLD_APPEARED');
  // The independent read stays explicit and honestly re-denies; the
  // interrupted probe authority is gone, not resurrected.
  await f.page.locator(root).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  let readDenied=null;for(let i=0;i<200&&!(readDenied=f.responses.find(r=>r.method==='GET'&&r.path.endsWith('/workspace/model-connection')&&r.status===409));i++)await new Promise(r=>setTimeout(r,25));
  assert.ok(readDenied,'PAN565_PROBE_EXPLICIT_READ_NOT_DENIED');
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'READBACK_NOT_CONFIRMED','PAN565_PROBE_EXPLICIT_READ_REVIVED_AUTHORITY');
  await capture(f,'desktop-real-owner-closed-during-inflight-synthetic-probe-honest-denial');
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

// RUN71/RUN72: the two DIFFERENT consent chronologies of A4-AC05 in the same
// real shared assembly, kept strictly apart. RUN72 correction of the run71
// narrative: run71 really executed these two registered cases and BOTH failed
// BEFORE the consent click — the pre-click projection was wrongly asserted
// readyForInference:true. The true pre-grant projection (native-model-
// connection.mjs:53,61-67) is consent NOT_GRANTED with readyForInference
// FALSE, because ready requires grantFresh over a nonnull session-bound grant,
// while the bounded synthetic inferenceOffer and the enabled consent control
// legitimately exist (browser module lines29-30 gate INFERENCE by
// readyForInference and the consent button only by the prerequisite checks).
// Readiness may only become true THROUGH the committed consent ACK (case 2);
// no product guard was inverted here. The post-click legs below are written
// against the real source; the parent executes them — this file itself proves
// nothing about execution. Case 1 (this test): after the genuine
// three prerequisite checks the user clicks the actually offered bounded
// SYNTHETIC_ONLY consent; the trusted native565 owner close (the accepted
// assembly-only fixture seam) lands while the REAL consent POST is still in
// flight, BEFORE native admission. native-model-connection.mjs:78-83 fails at
// principal() (MODEL_CONNECTION_OWNER_CLOSED) before any check, write or
// ledger touch, and origin-session-adapter.mjs:1098 answers a real HTTP409 on
// the untouched POST (route.continue — never route.fulfill, never a
// fabricated status). So consent admission-loss creates NO grant, NO
// lastOperation, NO new revision, NO provider/inference POST and NO hidden
// retry, while the existing prerequisite PASS records and the personal-row
// instance/generation identity survive unreset in the real source. The
// browser lands on the honest READBACK_NOT_CONFIRMED denial exposing only the
// explicit independent read; the source check plus a real reload prove the
// closed owner revives no readiness. The barrier records DOM REQUESTING and
// zero collected denials at close time, so the 409 is proven to follow the
// close. Bounded polling waits only for real collected server facts, never
// for a DOM state; no fixed sleeps.
test('565 consent admission loss: real owner closed before admission at the genuine SYNTHETIC_ONLY consent POST yields the real consent409 with no grant, no lastOperation, no new revision and no provider POST; existing prerequisite records and personal row identity survive unreset, honest denial exposes only the explicit read and source plus real reload revive no readiness',async()=>{
 const f=await fixture({grant:true});let intercepted=0,barrier=null;
 try{
  await f.page.addInitScript(stateObserverInit565);
  const denials=()=>f.responses.filter(r=>r.status===409&&r.path.includes('/model-connection'));
  const consentResponses=()=>f.responses.filter(r=>r.method==='POST'&&r.path.endsWith('/model-connection/consent'));
  const mutationPosts=()=>f.requests.filter(r=>r.method==='POST'&&r.path.includes('/model-connection/'));
  async function awaitDenials(n){for(let i=0;i<200&&denials().length<n;i++)await new Promise(r=>setTimeout(r,25));assert.equal(denials().length,n,'PAN565_CONSENT_REAL_409_DENIAL_COUNT_DRIFTED');}
  await open(f);await current(f);
  let obs=await stateObservation565(f);
  assert.deepEqual(obs.transitions,['READING','CURRENT_CONNECTION'],'PAN565_CONSENT_STATE_OBSERVER_INACTIVE');
  await choose(f);
  for(const[label,phase]of[['Erreichbarkeit','REACHABILITY'],['Authentifizierung','AUTHENTICATION'],['Modellverfügbarkeit','MODEL_AVAILABILITY']])await probe(f,label,phase);
  const rPre=await snapshot(f);
  // Honest pre-grant projection, the exact assertion run71 got wrong: no
  // grant exists yet, so grantFresh/readiness are FALSE (native 53,61-67)
  // while the bounded offer and the ACTUAL enabled consent control exist and
  // the INFERENCE probe stays disabled by the browser readiness gate (29-30).
  assert.equal(rPre.consent,'NOT_GRANTED');assert.equal(rPre.readyForInference,false);assert.ok(rPre.inferenceOffer);
  assert.equal(rPre.inferenceOffer.pricingClass,'CODE_OWNED_SYNTHETIC_ZERO_PRICE');assert.equal(rPre.inferenceOffer.currency,'NONE');
  assert.equal(await f.page.locator('#pan565-consent').isDisabled(),false,'PAN565_CONSENT_ACTUAL_OFFERED_CONTROL_NOT_ENABLED');
  assert.equal(await f.page.locator('#pan565-probe-INFERENCE').isDisabled(),true,'PAN565_CONSENT_INFERENCE_GATE_NOT_READINESS_BASED');
  // Prerequisite provider traffic only: exactly the three genuine probe GETs,
  // zero provider POSTs before the consent click.
  assert.equal(f.server.get(),3,'PAN565_CONSENT_PREREQUISITE_PROVIDER_GETS_NOT_EXACT');assert.equal(f.server.post(),0,'PAN565_CONSENT_PROVIDER_POST_BEFORE_CONSENT');
  const rowBefore=persistedConnectionRow565(f);
  obs=await stateObservation565(f);const beforeClickRecords=obs.records.length,beforeClickTransitions=obs.transitions.length;
  const modelOwner=f.modelConnectionOwner();
  assert.ok(modelOwner&&typeof modelOwner.close==='function','PAN565_CONSENT_REAL565_OWNER_MISSING_FROM_FIXTURE_SEAM');
  // Test-owned transport barrier for the REAL consent POST: the genuine
  // protected POST is observed pre-ingress, the real mount owner close fires
  // exactly once there, then the untouched request continues into the real
  // ingress, where admission fails closed. No fulfilled fake.
  await f.page.route(u=>u.origin===f.tls.origin&&u.pathname==='/t/tenant-a/workspace/model-connection/consent',async route=>{
   if(route.request().method()==='POST'&&intercepted===0){intercepted++;
    barrier={domAtDispatch:await f.page.locator(root).getAttribute('data-state'),denialsBeforeClose:denials().length};
    modelOwner.close();}
   await route.continue();
  });
  await f.page.locator(root).getByRole('button',{name:'Genau diese gedeckelte Inferenzprobe freigeben',exact:true}).click();
  await f.page.locator(root+'[data-state="READBACK_NOT_CONFIRMED"]').waitFor();
  await f.flushResponses();
  assert.equal(intercepted,1,'PAN565_CONSENT_POST_NOT_DISPATCHED_EXACTLY_ONCE');
  // Exactly one consent POST and it is the real closed-owner409 denial with
  // the body honestly left unparsed — no ACK, no replay.
  assert.equal(consentResponses().length,1,'PAN565_CONSENT_POST_REPLAYED_OR_DUPLICATED');
  await awaitDenials(1);
  const denial=consentResponses().at(-1);
  assert.equal(denial.status,409);assert.equal(denial.value,null);assert.equal(Object.hasOwn(denial,'bodyReadFailure'),false);assert.equal(denial.bodyNotObserved,'NON_200_BODY_NOT_OBSERVED_BY_FIXTURE');
  assert.deepEqual(barrier,{domAtDispatch:'REQUESTING',denialsBeforeClose:0},'PAN565_CONSENT_BARRIER_ORDER_UNPROVEN');
  // Per-record no-fake-success trail: the re-stamp before REQUESTING, then
  // the denial; no transient CURRENT_CONNECTION inside the loss window.
  obs=await stateObservation565(f);
  assert.deepEqual(obs.transitions.slice(beforeClickTransitions),['REQUESTING','READBACK_NOT_CONFIRMED'],'PAN565_CONSENT_WINDOW_FAKE_SUCCESS_LEAK');
  assert.deepEqual(obs.records.slice(beforeClickRecords),['CURRENT_CONNECTION->CURRENT_CONNECTION','CURRENT_CONNECTION->REQUESTING','REQUESTING->READBACK_NOT_CONFIRMED'],'PAN565_CONSENT_WINDOW_RECORDS:'+JSON.stringify(obs.records.slice(beforeClickRecords)));
  // The denial view exposes only the explicit independent read.
  assert.equal(await f.page.locator('#pan565-consent').count(),0,'PAN565_CONSENT_CONSENT_CONTROL_SURVIVED_DENIAL');
  assert.equal(await f.page.locator('#pan565-select').count(),0,'PAN565_CONSENT_SELECT_CONTROL_SURVIVED_DENIAL');
  assert.equal(await f.page.locator('#pan565-connection-choice').count(),0,'PAN565_CONSENT_CHOICE_CONTROL_SURVIVED_DENIAL');
  for(const phase of ['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY','INFERENCE'])assert.equal(await f.page.locator('#pan565-probe-'+phase).count(),0,'PAN565_CONSENT_STALE_READINESS_CONTROL_SURVIVED_DENIAL:'+phase);
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).count(),1,'PAN565_CONSENT_INDEPENDENT_READ_NOT_EXPLICIT');
  // The real source holds the truth: no grant, no lastOperation, no new
  // revision; the three prerequisite PASS records and the personal-row
  // instance/generation identity survive unreset.
  const row=persistedConnectionRow565(f);
  assert.equal(row.revision,rowBefore.revision,'PAN565_CONSENT_LOST_ADMISSION_CREATED_NEW_REVISION');
  assert.equal(row.state.grant,null,'PAN565_CONSENT_LOST_ADMISSION_CREATED_GRANT');
  assert.equal(row.state.lastOperation,null,'PAN565_CONSENT_LOST_ADMISSION_CREATED_LAST_OPERATION');
  assert.equal(row.state.connectionId,'connection:synthetic-v1');
  assert.deepEqual(Object.values(row.state.checks).map(c=>c.state),['PASS','PASS','PASS','NOT_RUN'],'PAN565_CONSENT_PREREQUISITE_RECORDS_NOT_PRESERVED');
  for(const phase of ['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY'])assert.equal(row.state.checks[phase].identityDigest,rPre.identityDigest,'PAN565_CONSENT_PREREQUISITE_IDENTITY_NOT_PRESERVED:'+phase);
  assert.equal(row.instance,rowBefore.instance,'PAN565_CONSENT_PERSISTED_INSTANCE_IDENTITY_RESET');
  assert.equal(row.generation,rowBefore.generation,'PAN565_CONSENT_PERSISTED_GENERATION_RESET');
  await capture(f,'desktop-real-consent-closed-before-admission-honest-denial');
  // The independent read remains explicit and honestly re-denies.
  await f.page.locator(root).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  await awaitDenials(2);await f.flushResponses();
  assert.deepEqual((await stateObservation565(f)).transitions.slice(beforeClickTransitions),['REQUESTING','READBACK_NOT_CONFIRMED','READING','READBACK_NOT_CONFIRMED'],'PAN565_CONSENT_POST_DENIAL_EXPLICIT_READ_FAKE_SUCCESS');
  // A real reload keeps the honest denial: the closed owner revives neither
  // the readback nor any consent readiness.
  await f.page.reload();
  await f.page.locator(root+'[data-state="READBACK_NOT_CONFIRMED"]').waitFor();
  await awaitDenials(3);await f.flushResponses();
  const afterReload=await stateObservation565(f);
  assert.equal(afterReload.initial,'ABSENT','PAN565_CONSENT_RELOAD_OBSERVER_NOT_REINSTALLED_BEFORE_FIRST_STATE');
  assert.ok(!afterReload.transitions.includes('CURRENT_CONNECTION'),'PAN565_CONSENT_RELOAD_RESURRECTED_READINESS:'+JSON.stringify(afterReload));
  assert.deepEqual(afterReload.transitions,['READING','READBACK_NOT_CONFIRMED'],'PAN565_CONSENT_RELOAD_NOT_HONESTLY_DENIED:'+JSON.stringify(afterReload.transitions));
  await f.page.locator(root).getByRole('button',{name:'Sichere Modellverbindung öffnen',exact:true}).click();
  assert.ok((await f.page.locator(root).innerText()).includes('nicht aktuell bestätigt'),'PAN565_CONSENT_RELOAD_DENIAL_NOT_EXPLAINED_IN_PANEL');
  // No hidden retry, no replay, no extra mutation, no new provider traffic.
  assert.equal(posts(f,'select').length,1,'PAN565_CONSENT_SELECT_REPLAYED');
  assert.equal(posts(f,'probe').length,3,'PAN565_CONSENT_PREREQUISITE_PROBE_COUNT_DRIFTED');
  assert.equal(consentResponses().length,1,'PAN565_CONSENT_HIDDEN_RETRY_AFTER_DENIAL');
  assert.equal(mutationPosts().length,5,'PAN565_CONSENT_HIDDEN_EXTRA_MUTATION');
  assert.equal(f.server.get(),3,'PAN565_CONSENT_NEW_PROVIDER_TRAFFIC_AFTER_LOSS');assert.equal(f.server.post(),0,'PAN565_CONSENT_PROVIDER_POST_AFTER_LOSS');
  const retained=persistedConnectionRow565(f);
  assert.equal(retained.state.grant,null,'PAN565_CONSENT_GRANT_REVIVED_AFTER_RELOAD');
  assert.equal(retained.state.lastOperation,null,'PAN565_CONSENT_LAST_OPERATION_REVIVED_AFTER_RELOAD');
  assert.equal(retained.revision,rowBefore.revision,'PAN565_CONSENT_REVISION_CHANGED_AFTER_RELOAD');
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

// RUN71/RUN72 case 2 — the genuinely different chronology: the consent ACK
// really committed. Before the click the projection is the same honest
// NOT_GRANTED/ready-false view as case 1 (run71 wrongly demanded ready=true
// HERE and died before ever clicking). consent() (native-model-connection.mjs:
// 77-83) persists the grant BEFORE the projection/ACK, so ONLY at this real
// 200 ACK does the collected readback show persisted:true at revision+1 with
// consent BOUNDED_ONCE and readyForInference:true (the shared
// #548 readiness projection). The browser consumes the ACK (the barrier hit on
// its required independent GET proves consumption) and the real owner close
// lands there: the untouched GET answers a genuine409 and there is NO final
// browser success. Crucially the close does NOT erase the persisted grant —
// the real source keeps the exact granted row (identityDigest, session-bound
// sessionId, ownerGrantDigest, offer limits, test data digest, click-time
// future expiry), revision exactly the ACK revision, lastOperation null and
// no provider POST. Persisted consent and current execution authority are
// distinguished: the stale/closed owner grants no execution authority (every
// explicit read, even after a real reload, denies with a real409 and no
// CURRENT_CONNECTION), while the durable consent row is untouched — no
// grant:null assertion, no store reset, no weakened guard. Fixed trails
// follow the genuine records; bounded polling only; no fixed sleeps.
test('565 consent ACK commits the persisted grant before the independent read: real owner closed at that GET barrier yields the genuine409 with no final browser success, the closed owner erases neither the BOUNDED_ONCE grant, exact revision and identity nor the prerequisite records, grants no execution authority, and no read, reload or repeated mutation resurrects readiness or replays the consent',async()=>{
 const f=await fixture({grant:true});let intercepted=0,barrier=null;
 try{
  await f.page.addInitScript(stateObserverInit565);
  const denials=()=>f.responses.filter(r=>r.status===409&&r.path.includes('/model-connection'));
  const consentResponses=()=>f.responses.filter(r=>r.method==='POST'&&r.path.endsWith('/model-connection/consent'));
  const mutationPosts=()=>f.requests.filter(r=>r.method==='POST'&&r.path.includes('/model-connection/'));
  async function awaitDenials(n){for(let i=0;i<200&&denials().length<n;i++)await new Promise(r=>setTimeout(r,25));assert.equal(denials().length,n,'PAN565_CONSENT_COMMIT_409_DENIAL_COUNT_DRIFTED');}
  await open(f);await current(f);
  let obs=await stateObservation565(f);
  assert.deepEqual(obs.transitions,['READING','CURRENT_CONNECTION'],'PAN565_CONSENT_COMMIT_STATE_OBSERVER_INACTIVE');
  await choose(f);
  for(const[label,phase]of[['Erreichbarkeit','REACHABILITY'],['Authentifizierung','AUTHENTICATION'],['Modellverfügbarkeit','MODEL_AVAILABILITY']])await probe(f,label,phase);
  const rPre=await snapshot(f);
  // Same honest pre-grant truth as case 1 (run71's shared mistake): readiness
  // is FALSE before the click; it becomes true only THROUGH the committed
  // ACK asserted below, never as a precondition for offering consent.
  assert.equal(rPre.consent,'NOT_GRANTED');assert.equal(rPre.readyForInference,false);assert.ok(rPre.inferenceOffer);
  assert.equal(await f.page.locator('#pan565-consent').isDisabled(),false,'PAN565_CONSENT_COMMIT_ACTUAL_OFFERED_CONTROL_NOT_ENABLED');
  assert.equal(await f.page.locator('#pan565-probe-INFERENCE').isDisabled(),true,'PAN565_CONSENT_COMMIT_INFERENCE_GATE_NOT_READINESS_BASED');
  assert.equal(f.server.get(),3,'PAN565_CONSENT_COMMIT_PREREQUISITE_PROVIDER_GETS_NOT_EXACT');assert.equal(f.server.post(),0,'PAN565_CONSENT_COMMIT_PROVIDER_POST_BEFORE_CONSENT');
  const rowBefore=persistedConnectionRow565(f);
  obs=await stateObservation565(f);const beforeClickRecords=obs.records.length,beforeClickTransitions=obs.transitions.length;
  const modelOwner=f.modelConnectionOwner();
  assert.ok(modelOwner&&typeof modelOwner.close==='function','PAN565_CONSENT_COMMIT_REAL565_OWNER_MISSING_FROM_FIXTURE_SEAM');
  // Barrier on the REQUIRED independent read AFTER the real ACK: the genuine
  // GET is observed pre-ingress with the consent POST already dispatched and
  // zero collected denials, the real owner close fires there, then the
  // untouched GET continues into the real ingress and is denied409.
  await f.page.route(u=>u.origin===f.tls.origin&&u.pathname==='/t/tenant-a/workspace/model-connection',async route=>{
   if(route.request().method()==='GET'&&intercepted===0){intercepted++;
    barrier={domAtDispatch:await f.page.locator(root).getAttribute('data-state'),denialsBeforeClose:denials().length,consentDispatched:f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/model-connection/consent')).length};
    modelOwner.close();}
   await route.continue();
  });
  const clickedAtMs=Date.now();
  await f.page.locator(root).getByRole('button',{name:'Genau diese gedeckelte Inferenzprobe freigeben',exact:true}).click();
  await f.page.locator(root+'[data-state="READBACK_NOT_CONFIRMED"]').waitFor();
  await f.flushResponses();
  assert.equal(intercepted,1,'PAN565_CONSENT_COMMIT_INDEPENDENT_READ_NOT_DISPATCHED_EXACTLY_ONCE');
  // (1) the ACK is a genuine persisted consent commit, not an assumption:
  // real200, revision exactly the pre-consent revision+1 (the single grant
  // write), consent BOUNDED_ONCE, the shared readiness projection true, the
  // pre-consent prerequisite records still PASS and INFERENCE still NOT_RUN.
  assert.equal(consentResponses().length,1,'PAN565_CONSENT_COMMIT_POST_REPLAYED_OR_DUPLICATED');
  const ack=consentResponses().at(-1);
  assert.ok(ack&&ack.status===200&&ack.value,'PAN565_CONSENT_COMMIT_REAL_ACK_MISSING');
  assert.equal(ack.value.persisted,true);assert.equal(ack.value.revision,rPre.revision+1);assert.equal(ack.value.consent,'BOUNDED_ONCE');
  assert.equal(ack.value.readyForInference,true);assert.equal(ack.value.realModelAcceptance,false);assert.equal(ack.value.reason,'REFERENCE_SELECTED_NOT_INFERENCE');
  assert.deepEqual(Object.values(ack.value.checks).map(c=>c.state),['PASS','PASS','PASS','NOT_RUN']);
  assert.deepEqual(ack.value.inferenceOffer.limits,rPre.inferenceOffer.limits);
  // (2) the denial is a real ingress fact after the close, body unparsed.
  await awaitDenials(1);
  const denial=denials().at(-1);
  assert.equal(denial.method,'GET');assert.equal(denial.value,null);assert.equal(Object.hasOwn(denial,'bodyReadFailure'),false);assert.equal(denial.bodyNotObserved,'NON_200_BODY_NOT_OBSERVED_BY_FIXTURE');
  // (3) chronological close ordering as recorded at the barrier itself.
  assert.deepEqual(barrier,{domAtDispatch:'REQUESTING',denialsBeforeClose:0,consentDispatched:1},'PAN565_CONSENT_COMMIT_BARRIER_ORDER_UNPROVEN');
  obs=await stateObservation565(f);
  assert.deepEqual(obs.transitions.slice(beforeClickTransitions),['REQUESTING','READBACK_NOT_CONFIRMED'],'PAN565_CONSENT_COMMIT_WINDOW_FAKE_SUCCESS_LEAK');
  assert.deepEqual(obs.records.slice(beforeClickRecords),['CURRENT_CONNECTION->CURRENT_CONNECTION','CURRENT_CONNECTION->REQUESTING','REQUESTING->READBACK_NOT_CONFIRMED'],'PAN565_CONSENT_COMMIT_WINDOW_RECORDS:'+JSON.stringify(obs.records.slice(beforeClickRecords)));
  assert.equal(await f.page.locator('#pan565-consent').count(),0,'PAN565_CONSENT_COMMIT_CONSENT_CONTROL_SURVIVED_DENIAL');
  assert.equal(await f.page.locator('#pan565-select').count(),0,'PAN565_CONSENT_COMMIT_SELECT_CONTROL_SURVIVED_DENIAL');
  assert.equal(await f.page.locator('#pan565-connection-choice').count(),0,'PAN565_CONSENT_COMMIT_CHOICE_CONTROL_SURVIVED_DENIAL');
  for(const phase of ['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY','INFERENCE'])assert.equal(await f.page.locator('#pan565-probe-'+phase).count(),0,'PAN565_CONSENT_COMMIT_STALE_READINESS_CONTROL_SURVIVED_DENIAL:'+phase);
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).count(),1,'PAN565_CONSENT_COMMIT_INDEPENDENT_READ_NOT_EXPLICIT');
  // (4) persisted consent vs lost execution authority, read from the REAL
  // source: the exact granted row survives unerased at the exact ACK revision
  // with unchanged personal identity and prerequisite checks; no
  // lastOperation/UNKNOWN hold and no provider dispatch ever existed.
  const row=persistedConnectionRow565(f);
  assert.equal(row.revision,ack.value.revision,'PAN565_CONSENT_COMMIT_PERSISTED_REVISION_MISMATCH');
  assert.equal(row.state.connectionId,'connection:synthetic-v1');
  const g=row.state.grant;
  assert.ok(g,'PAN565_CONSENT_COMMIT_PERSISTED_GRANT_ERASED');
  assert.equal(g.identityDigest,rPre.identityDigest);assert.equal(g.sessionId,rPre.binding.sessionId);
  assert.match(g.consentId,/^consent:[a-f0-9]{48}$/,'PAN565_CONSENT_COMMIT_GRANT_CONSENT_ID_NOT_EXACT');
  assert.match(g.ownerGrantDigest,/^[a-f0-9]{64}$/,'PAN565_CONSENT_COMMIT_GRANT_OWNER_DIGEST_NOT_EXACT');
  assert.equal(g.testDataDigest,MODEL_CONNECTION_TEST_DATA_DIGEST_V1);
  assert.deepEqual(g.limits,rPre.inferenceOffer.limits);
  assert.ok(Number.isSafeInteger(g.expiresAtMs)&&g.expiresAtMs>clickedAtMs,'PAN565_CONSENT_COMMIT_GRANT_EXPIRY_NOT_PERSISTED_FUTURE');
  assert.equal(row.state.lastOperation,null,'PAN565_CONSENT_COMMIT_LAST_OPERATION_APPEARED');
  assert.deepEqual(Object.values(row.state.checks).map(c=>c.state),['PASS','PASS','PASS','NOT_RUN'],'PAN565_CONSENT_COMMIT_PREREQUISITE_RECORDS_NOT_PRESERVED');
  assert.equal(row.instance,rowBefore.instance,'PAN565_CONSENT_COMMIT_PERSISTED_INSTANCE_IDENTITY_CHANGED');
  assert.equal(row.generation,rowBefore.generation,'PAN565_CONSENT_COMMIT_PERSISTED_GENERATION_CHANGED');
  await capture(f,'desktop-real-consent-grant-persisted-owner-closed-at-independent-read-honest-denial');
  // The explicit read stays honest: the persisted grant buys no authority
  // from the closed owner — a real409, no resurrected readiness.
  await f.page.locator(root).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  await awaitDenials(2);await f.flushResponses();
  assert.deepEqual((await stateObservation565(f)).transitions.slice(beforeClickTransitions),['REQUESTING','READBACK_NOT_CONFIRMED','READING','READBACK_NOT_CONFIRMED'],'PAN565_CONSENT_COMMIT_POST_DENIAL_EXPLICIT_READ_FAKE_SUCCESS');
  // A real reload neither erases the durable consent nor revives any
  // readiness: source keeps the exact grant, the browser keeps denying.
  await f.page.reload();
  await f.page.locator(root+'[data-state="READBACK_NOT_CONFIRMED"]').waitFor();
  await awaitDenials(3);await f.flushResponses();
  const afterReload=await stateObservation565(f);
  assert.equal(afterReload.initial,'ABSENT','PAN565_CONSENT_COMMIT_RELOAD_OBSERVER_NOT_REINSTALLED_BEFORE_FIRST_STATE');
  assert.ok(!afterReload.transitions.includes('CURRENT_CONNECTION'),'PAN565_CONSENT_COMMIT_RELOAD_RESURRECTED_READINESS:'+JSON.stringify(afterReload));
  assert.deepEqual(afterReload.transitions,['READING','READBACK_NOT_CONFIRMED'],'PAN565_CONSENT_COMMIT_RELOAD_NOT_HONESTLY_DENIED:'+JSON.stringify(afterReload.transitions));
  await f.page.locator(root).getByRole('button',{name:'Sichere Modellverbindung öffnen',exact:true}).click();
  assert.ok((await f.page.locator(root).innerText()).includes('nicht aktuell bestätigt'),'PAN565_CONSENT_COMMIT_RELOAD_DENIAL_NOT_EXPLAINED_IN_PANEL');
  // No repeated mutation, no consent replay, no new provider traffic: the
  // persisted consent alone never dispatches anything.
  assert.equal(posts(f,'select').length,1,'PAN565_CONSENT_COMMIT_SELECT_REPLAYED');
  assert.equal(posts(f,'probe').length,3,'PAN565_CONSENT_COMMIT_PREREQUISITE_PROBE_COUNT_DRIFTED');
  assert.equal(consentResponses().length,1,'PAN565_CONSENT_COMMIT_CONSENT_REPLAYED_AFTER_DENIAL');
  assert.equal(mutationPosts().length,5,'PAN565_CONSENT_COMMIT_HIDDEN_EXTRA_MUTATION');
  assert.equal(f.server.get(),3,'PAN565_CONSENT_COMMIT_NEW_PROVIDER_TRAFFIC_AFTER_CLOSE');assert.equal(f.server.post(),0,'PAN565_CONSENT_COMMIT_PROVIDER_POST_AFTER_CLOSE');
  const retained=persistedConnectionRow565(f);
  assert.ok(retained.state.grant,'PAN565_CONSENT_COMMIT_PERSISTED_GRANT_LOST_AFTER_RELOAD');
  assert.equal(retained.state.grant.consentId,g.consentId,'PAN565_CONSENT_COMMIT_PERSISTED_GRANT_IDENTITY_CHANGED_AFTER_RELOAD');
  assert.equal(retained.state.lastOperation,null,'PAN565_CONSENT_COMMIT_LAST_OPERATION_APPEARED_AFTER_RELOAD');
  assert.equal(retained.revision,ack.value.revision,'PAN565_CONSENT_COMMIT_REVISION_CHANGED_AFTER_RELOAD');
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
// RUN73: truthful expiry-aware user journey on the real mount. The browser-only
// clock seam (Playwright page.clock) can only REMOVE cached visible readiness — it
// never fakes responses, grants or native/server time. The server-side EXPIRED_OR_STALE
// readback comes solely from a test-owned rewrite of the actual persisted native grant
// row (real source, real native clock), never from a fabricated body.
test('565 consent expiry journey: a browser-only clock reaching the persisted native grant expiry removes only cached visible readiness with zero hidden requests, forced clicks and hide/reopen resurrect nothing, an explicit independent read surfaces the real-source EXPIRED_OR_STALE with the authoritative consent expiry, and explicit fresh consent plus exactly one bounded inference succeed only from still-valid prerequisites',async()=>{
 const f=await fixture({grant:true});
 try{
  await f.page.addInitScript(stateObserverInit565);
  // Browser-only clock seam (Playwright page.clock, main world), installed BEFORE the
  // navigation so the fake-timer queue genuinely contains the product's consent-expiry
  // timer (a fastForward without a prior install only injects the fakes afterwards and
  // never retroactively adopts already-created real timers — the actual RUN73 failure).
  // It moves nothing but the page clock: native/server time, responses, grants and the
  // persisted row stay untouched by it.
  await f.page.clock.install();
  await open(f);await current(f);await choose(f);
  for(const[label,phase]of[['Erreichbarkeit','REACHABILITY'],['Authentifizierung','AUTHENTICATION'],['Modellverfügbarkeit','MODEL_AVAILABILITY']])await probe(f,label,phase);
  const reads=()=>f.responses.filter(r=>r.method==='GET'&&r.path==='/t/tenant-a/workspace/model-connection').length;
  const rPre=await snapshot(f);
  assert.equal(rPre.consent,'NOT_GRANTED');assert.equal(rPre.consentExpiresAtMs,null,'PAN565_EXPIRY_JOURNEY_PRE_GRANT_DISCLOSES_GRANT_EXPIRY');
  await f.page.locator(root).getByRole('button',{name:'Genau diese gedeckelte Inferenzprobe freigeben',exact:true}).click();
  await current(f);
  const rGrant=await snapshot(f);
  assert.equal(rGrant.consent,'BOUNDED_ONCE');assert.equal(rGrant.readyForInference,true);
  assert.ok(Number.isSafeInteger(rGrant.consentExpiresAtMs)&&rGrant.consentExpiresAtMs<rGrant.inferenceOffer.expiresAtMs,'PAN565_EXPIRY_JOURNEY_CONSENT_EXPIRY_MISSING_OR_CONFUSED_WITH_OWNER_OFFER');
  assert.equal(await f.page.locator('#pan565-probe-INFERENCE').isDisabled(),false,'PAN565_EXPIRY_JOURNEY_GRANTED_INFERENCE_CONTROL_NOT_ENABLED');
  const grantRow=persistedConnectionRow565(f);
  assert.equal(grantRow.state.grant.expiresAtMs,rGrant.consentExpiresAtMs,'PAN565_EXPIRY_JOURNEY_DISCLOSED_EXPIRY_IS_NOT_THE_PERSISTED_NATIVE_GRANT');
  const readsAtGrant=reads();
  // Browser-only clock seam: cannot change native/server time, responses or grants.
  await f.page.clock.fastForward(31000);
  await f.page.locator(root+'[data-state="CONSENT_EXPIRY_LOCAL"]').waitFor();
  assert.equal(await f.page.locator('#pan565-probe-INFERENCE').isDisabled(),true,'PAN565_EXPIRY_JOURNEY_LOCAL_EXPIRY_KEPT_INFERENCE_ACTIONABLE');
  const expiredView=await f.page.locator('body').innerText();
  assert.ok(expiredView.includes('browserseitig erreichter Ablaufzeitpunkt '+new Date(rGrant.consentExpiresAtMs).toISOString()),'PAN565_EXPIRY_JOURNEY_LOCAL_EXPIRY_NOT_TRUTHFULLY_DISPLAYED');
  for(const historic of ['Erreichbarkeit: PASS','Authentifizierung: PASS','Modellverfügbarkeit: PASS'])assert.ok(expiredView.includes(historic),'PAN565_EXPIRY_JOURNEY_CONFIRMED_HISTORY_REWRITTEN_OR_FABRICATED '+historic);
  assert.ok(!expiredView.includes(syntheticCredential565),'PAN565_EXPIRY_JOURNEY_SECRET_VISIBLE_IN_EXPIRY_STATE');
  // The expired visible control denies even a forced synthetic click; nothing retries or polls.
  await f.page.locator('#pan565-probe-INFERENCE').evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  assert.equal(f.server.post(),0,'PAN565_EXPIRY_JOURNEY_PROVIDER_POST_AFTER_LOCAL_EXPIRY');
  assert.equal(reads(),readsAtGrant,'PAN565_EXPIRY_JOURNEY_HIDDEN_POLLING_AFTER_LOCAL_EXPIRY');
  // Hiding and reopening the panel resurrects no stale control and fires no request.
  await f.page.locator(root).getByRole('button',{name:'Verbindungsdialog schließen',exact:true}).click();
  await f.page.locator(root).getByRole('button',{name:'Sichere Modellverbindung öffnen',exact:true}).click();
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'CONSENT_EXPIRY_LOCAL','PAN565_EXPIRY_JOURNEY_REOPEN_RESURRECTED_STALE_READINESS');
  assert.equal(await f.page.locator('#pan565-probe-INFERENCE').isDisabled(),true,'PAN565_EXPIRY_JOURNEY_REOPEN_RESURRECTED_INFERENCE_CONTROL');
  assert.equal(reads(),readsAtGrant,'PAN565_EXPIRY_JOURNEY_HIDDEN_POLLING_ON_REOPEN');
  // Real-source expiry in real native time: rewrite the persisted grant row itself, so the
  // server alone — not the page clock — now declares the grant expired at that exact expiry.
  const sourceExpiry=Date.now()-1;
  {const rw=new DatabaseSync(join(f.root,'browser-profiles.sqlite'));
   try{const row=rw.prepare("SELECT state FROM workspace_model_connections WHERE tenant='tenant-a' AND subject='synthetic:erv-reader'").get();const state=JSON.parse(row.state);
    assert.ok(state.grant&&state.grant.consentId===grantRow.state.grant.consentId,'PAN565_EXPIRY_JOURNEY_SOURCE_GRANT_MISSING_BEFORE_REWRITE');
    state.grant.expiresAtMs=sourceExpiry;
    rw.prepare("UPDATE workspace_model_connections SET state=? WHERE tenant='tenant-a' AND subject='synthetic:erv-reader'").run(JSON.stringify(state));}
   finally{rw.close();}}
  await f.page.locator('#pan565-read').click();await current(f);
  const rExpired=await snapshot(f);
  assert.equal(rExpired.consent,'EXPIRED_OR_STALE','PAN565_EXPIRY_JOURNEY_SERVER_DID_NOT_DENY_EXPIRED_GRANT');
  assert.equal(rExpired.readyForInference,false);
  assert.equal(rExpired.consentExpiresAtMs,sourceExpiry,'PAN565_EXPIRY_JOURNEY_SERVER_EXPIRY_NOT_SURFACED');
  assert.equal(rExpired.inferenceOffer.expiresAtMs,rGrant.inferenceOffer.expiresAtMs,'PAN565_EXPIRY_JOURNEY_OWNER_OFFER_AUTHORITY_CHANGED_BY_CONSENT_EXPIRY');
  const expiredServerView=await f.page.locator('body').innerText();
  assert.ok(expiredServerView.includes('EXPIRED_OR_STALE'),'PAN565_EXPIRY_JOURNEY_SERVER_EXPIRY_NOT_DISPLAYED');
  assert.ok(expiredServerView.includes('überlieferte nativ gelesene Freigabe-Ablaufzeit '+new Date(sourceExpiry).toISOString()+' (Historie, keine aktuelle Autorität)'),'PAN565_EXPIRY_JOURNEY_HISTORIC_EXPIRY_NOT_EXACT_SERVER_TIMESTAMP');
  assert.equal(await f.page.locator('#pan565-probe-INFERENCE').isDisabled(),true,'PAN565_EXPIRY_JOURNEY_INFERENCE_ENABLED_AFTER_SERVER_EXPIRY');
  assert.equal(await f.page.locator('#pan565-consent').isDisabled(),false,'PAN565_EXPIRY_JOURNEY_FRESH_CONSENT_NOT_OFFERED_WITH_VALID_PREREQUISITES');
  assert.equal(f.server.post(),0,'PAN565_EXPIRY_JOURNEY_PROVIDER_POST_BEFORE_RECONSENT');
  // Realign the page clock with real time so the renewed grant's browser timer reflects the
  // actual bounded window; then explicit fresh consent and exactly one real bounded inference.
  await f.page.clock.setSystemTime(Date.now());
  await f.page.locator(root).getByRole('button',{name:'Genau diese gedeckelte Inferenzprobe freigeben',exact:true}).click();
  await current(f);
  const rAgain=await snapshot(f);
  assert.equal(rAgain.consent,'BOUNDED_ONCE');assert.equal(rAgain.readyForInference,true);
  assert.ok(rAgain.consentExpiresAtMs>Date.now()&&rAgain.consentExpiresAtMs<=Date.now()+30000&&rAgain.consentExpiresAtMs<rAgain.inferenceOffer.expiresAtMs,'PAN565_EXPIRY_JOURNEY_RENEWED_GRANT_WINDOW_UNTRUTHFUL');
  assert.equal(rAgain.inferenceOffer.expiresAtMs,rGrant.inferenceOffer.expiresAtMs,'PAN565_EXPIRY_JOURNEY_OWNER_OFFER_MUST_STAY_THE_SEPARATE_AUTHORITY');
  assert.equal(rAgain.revision,grantRow.revision+1,'PAN565_EXPIRY_JOURNEY_RECONSENT_REVISION_DRIFT');
  const reGranted=persistedConnectionRow565(f);
  assert.notEqual(reGranted.state.grant.consentId,grantRow.state.grant.consentId,'PAN565_EXPIRY_JOURNEY_RECONSENT_REUSED_OLD_GRANT_IDENTITY');
  assert.equal(reGranted.state.grant.expiresAtMs,rAgain.consentExpiresAtMs,'PAN565_EXPIRY_JOURNEY_RENEWED_DISCLOSURE_NOT_PERSISTED_SOURCE');
  assert.equal(reGranted.revision,rAgain.revision,'PAN565_EXPIRY_JOURNEY_RENEWED_ROW_REVISION_DRIFT');
  assert.equal(await f.page.locator('#pan565-probe-INFERENCE').isDisabled(),false,'PAN565_EXPIRY_JOURNEY_REGRANTED_INFERENCE_CONTROL_NOT_ENABLED');
  await probe(f,'Begrenzte Inferenz','INFERENCE');
  const rDone=await snapshot(f);
  assert.equal(rDone.checks.INFERENCE.state,'PASS');assert.equal(rDone.realModelAcceptance,false);
  assert.equal(rDone.consent,'NOT_GRANTED');assert.equal(rDone.consentExpiresAtMs,null,'PAN565_EXPIRY_JOURNEY_CONSUMED_GRANT_STILL_DISCLOSED');
  assert.equal(f.server.post(),1,'PAN565_EXPIRY_JOURNEY_PROVIDER_POSTS_NOT_EXACTLY_ONE');
  const obs=await stateObservation565(f);
  assert.ok(obs.transitions.includes('CONSENT_EXPIRY_LOCAL'),'PAN565_EXPIRY_JOURNEY_LOCAL_EXPIRY_TRANSITION_NOT_OBSERVED');
  assert.equal(obs.transitions.at(-1),'CURRENT_CONNECTION','PAN565_EXPIRY_JOURNEY_FINAL_STATE_NOT_HONEST_READBACK');
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

async function showCurrentViewDetailsUI(page){const d=page.locator('[id="workspace.module-editor-details"]');await d.waitFor({state:'attached'});if(await d.getAttribute('open')===null)await d.locator(':scope > summary').click();}

// Existing full native fixture, approved reviewer and EMPTY real owner only.
// No local fake model server, credential, provider, new role or agent response.
test('A4-UI integration Jarvis focus preserves native unsent input and reachable honest empty-model dialog without inference',{timeout:120000},async()=>{
 const f=await nativeViewBrowserFixture546({subjectId:'synthetic:erv-reviewer',humanDecisions:true,agentRuns:true,invoiceNavigation:true,configurationDrafts:true,modelConnections:[]});
 try{
  const p=f.page,before=f.business(),draft='Lokaler ungesendeter Entwurf bleibt erhalten; kein Modellauftrag.';
  await p.setViewportSize({width:1586,height:992});await p.goto(f.tls.origin+'/t/tenant-a/workspace');
  await p.getByRole('button',{name:'Eingangsrechnungsprüfung — nur lesen',exact:true}).click();
  await p.locator('[id="shell.erv-human"][data-state="CURRENT_HUMAN_READ"]').waitFor();
  await p.locator('[id="workspace.appearance"][data-state="READY"]').waitFor({state:'attached'});
  await p.locator(root+'[data-state="NO_AUTHORIZED_CONNECTION"]').waitFor();
  const input=p.locator('#pan548-agent-intent');await input.fill(draft);
  await p.evaluate(()=>{window.__a4UiInput=document.getElementById('pan548-agent-intent');window.__a4UiModel=document.getElementById('shell.model-connection');window.__a4UiAgent=document.getElementById('shell.agent-panel');});
  await p.getByRole('button',{name:'Design und Layout konfigurieren',exact:true}).click();await p.getByRole('combobox',{name:'Designprofil',exact:true}).selectOption('jarvis');await p.getByRole('button',{name:'Kuratierte Vorlage als Vorschau',exact:true}).click();await p.getByRole('button',{name:'Zur Arbeitsfläche',exact:true}).click();
  const measure=()=>p.evaluate(async()=>{await document.fonts.ready;scrollTo(0,0);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const input=document.getElementById('pan548-agent-intent'),r=input.getBoundingClientRect(),model=document.getElementById('shell.model-connection');return{profile:document.body.dataset.designProfile,area:document.body.dataset.mobileWorkArea,viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,input:{y:r.y,height:r.height,bottom:r.bottom,visible:!!input.getClientRects().length},sameInput:window.__a4UiInput===input,sameModel:window.__a4UiModel===model,sameAgent:window.__a4UiAgent===document.getElementById('shell.agent-panel'),modelConnected:model.isConnected,modelState:model.dataset.state,modelBodyHidden:document.getElementById('pan565-connection-body').hidden,modelVisible:!!model.getClientRects().length};});
  const observations=[];
  async function image(name,state){const path=join(evidence(),name+'.png');await p.screenshot({path,fullPage:false});const pins={};for(const path of ['packages/browser-workspace/src/workspace-model-connection-v1.css','tests/pan565/browser-model-connection.test.mjs','dist/browser-workspace/app.js','dist/browser-workspace/workspace-appearance.js','dist/browser-workspace/workspace-model-connection.js'])pins[path]=sha(readFileSync(path));writeFileSync(path+'.json',JSON.stringify({imageSHA256:sha(readFileSync(path)),actual:state,pins,syntheticOnly:true,notMainImageOrPhysicalDeviceAcceptance:true,modelInference:false},null,2)+'\n');}
  for(const viewport of [{width:1586,height:992},{width:390,height:844}]){
   await p.setViewportSize(viewport);const actual=await measure();observations.push(actual);writeFileSync(join(evidence(),'A4-UI-actual-jarvis-empty-focus.json'),JSON.stringify(observations,null,2)+'\n');
   assert.equal(actual.profile,'jarvis');assert.equal(actual.area,'ASSISTANT');assert.equal(actual.sameInput,true);assert.equal(actual.sameModel,true);assert.equal(actual.sameAgent,true);assert.equal(actual.modelConnected,true);assert.equal(actual.modelState,'NO_AUTHORIZED_CONNECTION');assert.equal(actual.modelBodyHidden,true);assert.ok(actual.documentWidth<=viewport.width);
   assert.ok(actual.input.visible&&actual.input.bottom<viewport.height,'JARVIS_FIRST_VIEWPORT_INPUT_DISPLACED_BY_OPTIONAL_COLLAPSED_MODEL_LAUNCHER');
   assert.equal(await input.inputValue(),draft);await image('A4-UI-jarvis-empty-focus-'+viewport.width,actual);
  }
  // Actual task toggle and existing launcher, not a forced click on hidden DOM.
  await p.locator('[id="workspace.mode-task"]').click();await p.locator(root).getByRole('button',{name:'Sichere Modellverbindung öffnen',exact:true}).click();await p.locator(root+'[data-state="NO_AUTHORIZED_CONNECTION"]').waitFor();
  assert.equal(await p.locator(root).isVisible(),true);assert.equal(await p.locator('#pan565-connection-choice').isDisabled(),true);assert.equal(await p.locator('#pan565-select').isDisabled(),true);for(const phase of ['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY','INFERENCE'])assert.equal(await p.locator('#pan565-probe-'+phase).isDisabled(),true);
  const empty=await snapshot(f);assert.deepEqual(empty.connections,[]);assert.equal(empty.readyForInference,false);assert.equal(empty.realModelAcceptance,false);assert.equal(empty.consent,'NOT_GRANTED');assert.equal(empty.inferenceOffer,null);assert.ok(Object.values(empty.checks).every(c=>c.state==='NOT_RUN'));
  await p.locator(root).scrollIntoViewIfNeeded();await image('A4-UI-jarvis-explicit-empty-dialog-390',{sameNativeModelOwner:true,allAuthorityDisabled:true});
  await p.locator(root).getByRole('button',{name:'Verbindungsdialog schließen',exact:true}).click();await p.locator('[id="workspace.mode-assistant"]').click();const returned=await measure();assert.equal(returned.sameInput,true);assert.equal(returned.sameModel,true);assert.equal(returned.sameAgent,true);assert.equal(returned.modelConnected,true);assert.equal(returned.modelBodyHidden,true);assert.ok(returned.input.visible&&returned.input.bottom<returned.viewport.height);assert.equal(await input.inputValue(),draft);
  assert.equal(posts(f,'select').length+posts(f,'probe').length+posts(f,'consent').length,0);assert.equal(f.requests.filter(r=>r.method==='POST'&&/\/(?:agent-run\/(?:plan|start)|profile|appearance|module-view\/confirm)$/.test(r.path)).length,0);assert.equal(f.business(),before);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

// Actual shared native owners, an EMPTY model catalogue, and only local previews.
// The original image defines composition, never audio/model/agent authority.
test('UI reference default composition keeps Jarvis orb primary and Notebook navigation aligned with the same native owners',{timeout:120000},async()=>{
 const f=await nativeViewBrowserFixture546({subjectId:'synthetic:erv-reviewer',humanDecisions:true,agentRuns:true,invoiceNavigation:true,configurationDrafts:true,modelConnections:[]});
 const observations=[],mutations=[];let before;
 try{
  const p=f.page;before=f.business();const draft='Lokaler ungesendeter Kompositionsentwurf; keine Ausführung.';
  p.on('request',r=>{if(r.method()==='POST'&&/\/(?:appearance|profile|module-view\/confirm|model-connection\/(?:select|probe|consent)|agent-run\/(?:plan|start))$/.test(new URL(r.url()).pathname))mutations.push(new URL(r.url()).pathname);});
  await p.setViewportSize({width:1586,height:992});await p.goto(f.tls.origin+'/t/tenant-a/workspace');
  await p.getByRole('button',{name:'Eingangsrechnungsprüfung — nur lesen',exact:true}).click();
  await p.locator('[id="shell.erv-human"][data-state="CURRENT_HUMAN_READ"]').waitFor();
  await p.locator('[id="workspace.appearance"][data-state="READY"]').waitFor({state:'attached'});
  await p.locator(root+'[data-state="NO_AUTHORIZED_CONNECTION"]').waitFor();
  await p.locator('#pan548-agent-intent').fill(draft);
  await p.evaluate(()=>{window.__defaultCompositionNodes={input:document.getElementById('pan548-agent-intent'),agent:document.getElementById('shell.agent-panel'),main:document.getElementById('shell.main'),nav:document.getElementById('shell.navigation'),native:document.querySelector('[data-workspace-card-id="pan.erv.summary"]'),model:document.getElementById('shell.model-connection')};});
  const pins={};for(const path of ['packages/browser-workspace/src/app.ts','packages/browser-workspace/src/workspace.css','packages/browser-workspace/src/workspace-agent-panel-v1.ts','tests/pan565/browser-model-connection.test.mjs','dist/browser-workspace/app.js','dist/browser-workspace/workspace-agent-panel.js','dist/browser-workspace/workspace-appearance.js'])pins[path]=sha(readFileSync(path));
  async function chooseProfile(id){await p.getByRole('button',{name:'Design und Layout konfigurieren',exact:true}).click();await p.getByRole('combobox',{name:'Designprofil',exact:true}).selectOption(id);await p.getByRole('button',{name:'Kuratierte Vorlage als Vorschau',exact:true}).click();await p.getByRole('button',{name:'Zur Arbeitsfläche',exact:true}).click();await p.waitForFunction(id=>document.body.dataset.designProfile===id,id);}
  async function measure(profile,viewport){
   await p.setViewportSize(viewport);await p.evaluate(async()=>{scrollTo(0,0);await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   const actual=await p.evaluate(()=>{const b=n=>{if(!n)return null;const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right,visible:!!n.getClientRects().length&&getComputedStyle(n).display!=='none'};},saved=window.__defaultCompositionNodes,nav=document.getElementById('shell.navigation'),nodes={input:document.getElementById('pan548-agent-intent'),agent:document.getElementById('shell.agent-panel'),main:document.getElementById('shell.main'),nav,native:document.querySelector('[data-workspace-card-id="pan.erv.summary"]'),model:document.getElementById('shell.model-connection')};return{profile:document.body.dataset.designProfile,widthClass:document.body.dataset.presentationWidth,area:document.body.dataset.mobileWorkArea,viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,workarea:b(document.querySelector('.workspace-workarea')),agent:b(nodes.agent),input:b(nodes.input),orb:b(document.querySelector('.agent-orb')),composer:b(document.querySelector('.agent-integrated-composer')),native:b(nodes.main),navItems:[...nav.querySelectorAll('.workspace-nav-item')].filter(n=>n.getClientRects().length).map(n=>({label:n.textContent,...b(n)})),sameNativeNodes:Object.entries(nodes).every(([key,value])=>value===saved[key]),requiredBoundary:!!document.getElementById('workspace.required-boundary'),modelState:nodes.model.dataset.state,modelBodyHidden:document.getElementById('pan565-connection-body').hidden,graphics:document.querySelector('.appearance-chip')?.textContent,noCanvas:document.querySelectorAll('canvas').length===0};});
   const name='default-composition-'+profile+'-'+viewport.width,path=join(evidence(),name+'.png');await p.screenshot({path,fullPage:false});const row={profile,actual,pins,imagePath:path,imageSHA256:sha(readFileSync(path)),realModelAudioOrExecution:false,mainAcceptance:false,physicalDevice:false};writeFileSync(path+'.json',JSON.stringify(row,null,2)+'\n');observations.push(row);writeFileSync(join(evidence(),'default-composition-actual-observations.json'),JSON.stringify(observations,null,2)+'\n');
   assert.equal(actual.profile,profile);assert.equal(actual.sameNativeNodes,true);assert.equal(actual.requiredBoundary,true);assert.equal(actual.modelState,'NO_AUTHORIZED_CONNECTION');assert.equal(actual.modelBodyHidden,true);assert.equal(actual.noCanvas,true);assert.ok(actual.documentWidth<=viewport.width,'DEFAULT_COMPOSITION_HORIZONTAL_OVERFLOW');assert.equal(await p.locator('#pan548-agent-intent').inputValue(),draft);
   if(profile==='jarvis'){assert.equal(actual.area,'ASSISTANT');assert.ok(actual.input.visible&&actual.input.bottom<viewport.height,'DEFAULT_JARVIS_INPUT_OUTSIDE_FIRST_VIEWPORT');}
   else if(viewport.width===390){assert.equal(actual.area,'TASK');assert.equal(await p.locator('[id="shell.agent-panel"]').isVisible(),false);}
   return actual;
  }
  await chooseProfile('notebook');const notebook=await measure('notebook',{width:1586,height:992});await measure('notebook',{width:1024,height:768});await measure('notebook',{width:390,height:844});
  await p.setViewportSize({width:1586,height:992});await chooseProfile('jarvis');const jarvis=await measure('jarvis',{width:1586,height:992});await measure('jarvis',{width:1024,height:768});await measure('jarvis',{width:390,height:844});
  await p.locator('[id="workspace.mode-task"]').click();assert.equal(await p.locator('[id="shell.agent-panel"]').isVisible(),false);assert.equal(await p.locator('[id="shell.main"]').isVisible(),true);await p.locator('[id="workspace.mode-assistant"]').click();assert.equal(await p.locator('[id="shell.main"]').isVisible(),false);assert.equal(await p.locator('#pan548-agent-intent').inputValue(),draft);
  assert.deepEqual(mutations,[]);assert.equal(f.business(),before);assert.equal(f.readPersisted().revision,0);assert.deepEqual(f.errors,[]);
  const failures=[];
  if(new Set(notebook.navItems.map(n=>Math.round(n.y))).size!==1)failures.push('NOTEBOOK_REGISTERED_NAVIGATION_WRAPS_ON_DEFAULT_DESKTOP');
  if(Math.abs(notebook.agent.y-notebook.workarea.y)>16)failures.push('NOTEBOOK_ASSISTANT_ALIGNED_TO_INVOICE_NOT_WORKSPACE');
  if(jarvis.orb.width<200||jarvis.orb.width>280)failures.push('JARVIS_DEFAULT_ORB_NOT_REFERENCE_SCALE');
  if(jarvis.composer.height>jarvis.orb.height*.8)failures.push('JARVIS_FORM_DOMINATES_THE_CENTRAL_ORB');
  assert.deepEqual(failures,[],failures.join('; '));
 }finally{await f.close();}
});
// End of bounded default-composition regression.
// RUN103/RUN104: a retained UNKNOWN_USAGE hold on the code-owned synthetic zero-price route is an
// honestly disclosed, recoverable dialog state instead of a browser dead end. The closed readback
// discloses the exact held operation; the dialog shows it and offers exactly ONE action — the
// EXISTING owner reconciliation over its narrowly closed protected route POST. RUN104 completed
// that end-to-end path in src/pan527/origin-session-adapter.mjs: the closed route regexp and the
// closed POST allowlist now admit exactly app.js/select/probe/consent/reconcile — no wildcard
// owner-method exposure — so the browser action really reaches the generic owner branch instead
// of dying at HOSTED_ROUTE_DENIED, with the same mandatory independent readback every other
// mutation performs. Negatives ride the same journey and each asserts its EXACT authority answer,
// never a bare non-200: the closed route/method gate, the ingress Origin gate, the route CSRF gate,
// the session-bound scope and the owner's own MODEL_CONNECTION_RECONCILIATION_DENIED /
// MODEL_CONNECTION_INPUT_DENIED reason all name themselves; a settled operation cannot be
// reconciled twice; after logout the route denies before the owner. The reconcile triggers no
// provider retry and no provider GET, the persisted source row keeps the settled operation, and
// recovery continues only over the existing honest path (reference reset, fresh phases, fresh
// capped consent, exactly one new bounded synthetic inference). Nothing here is real-model
// acceptance; the timed-out original dispatch is settled as zero-price-synthetic, never re-run.
test('565 retained synthetic UNKNOWN hold: exact operation disclosed, forged reconcile denied by the owner, explicit zero-price reconcile over the existing route settles with one POST plus independent readback and zero provider retry, then fresh prerequisites/consent/inference recover; NOT model acceptance',async()=>{
 const f=await fixture({grant:true});
 try{
  await open(f);await current(f);await choose(f);
  for(const[label,phase]of[['Erreichbarkeit','REACHABILITY'],['Authentifizierung','AUTHENTICATION'],['Modellverfügbarkeit','MODEL_AVAILABILITY']])await probe(f,label,phase);
  const rPre=await snapshot(f);assert.equal(rPre.unknownUsage,null,'PAN565_HOLD_DISCLOSED_BEFORE_ANY_DISPATCH');
  await f.page.locator(root).getByRole('button',{name:'Genau diese gedeckelte Inferenzprobe freigeben',exact:true}).click();await current(f);
  f.server.setMode('TIMEOUT');
  await f.page.locator('#pan565-probe-INFERENCE').click();
  await f.page.locator(root+'[data-state="CURRENT_CONNECTION"]').waitFor();
  const rHold=await snapshot(f);
  assert.equal(rHold.checks.INFERENCE.state,'UNKNOWN_USAGE');assert.equal(rHold.reason,'UNKNOWN_USAGE_RETAINED');
  assert.match(rHold.unknownUsage.operationId,/^operation:mc-[a-f0-9]{40}$/,'PAN565_HELD_OPERATION_ID_NOT_DISCLOSED');
  assert.equal(rHold.unknownUsage.reconcilable,true);assert.equal(rHold.readyForInference,false);
  const holdView=await f.page.locator(root).innerText();
  assert.ok(holdView.includes('Nativer Nutzungs-Hold'),'PAN565_HOLD_NOT_TRUTHFULLY_DISPLAYED');
  assert.ok(holdView.includes(rHold.unknownUsage.operationId),'PAN565_HELD_OPERATION_ID_NOT_VISIBLE');
  assert.ok(!holdView.includes(syntheticCredential565),'PAN565_SECRET_VISIBLE_IN_HOLD_STATE');
  await capture(f,'desktop-synthetic-unknown-hold-disclosed');
  assert.equal(f.server.post(),1,'PAN565_PROVIDER_POSTS_AT_HOLD');assert.equal(posts(f,'reconcile').length,0,'PAN565_RECONCILE_POST_BEFORE_USER_ACTION');
  // Negatives first, each asserting its exact authority answer (RUN104: a bare non-200 could
  // pass vacuously at the closed route gate before the owner). The hold, its disclosure and the
  // revision stay exactly as they were, nothing replays.
  const heldOp=rHold.unknownUsage.operationId,sid=rHold.binding.sessionId,idg=rHold.identityDigest;
  assert.deepEqual(await reconcileProbe565(f,[
    {name:'missing-session-header',body:{operationId:heldOp,identityDigest:idg}},
    {name:'foreign-session-header',session:'session:'+'0'.repeat(64),body:{operationId:heldOp,identityDigest:idg}},
    {name:'forged-operation-id',session:sid,body:{operationId:'operation:mc-'+'b'.repeat(40),identityDigest:idg}},
    {name:'forged-identity',session:sid,body:{operationId:heldOp,identityDigest:'f'.repeat(64)}},
    {name:'extra-body-key',session:sid,body:{operationId:heldOp,identityDigest:idg,usageMicros:0}},
  ]),[
    ['missing-session-header',403,'MODEL_CONNECTION_SCOPE_DENIED'],
    ['foreign-session-header',403,'MODEL_CONNECTION_SCOPE_DENIED'],
    ['forged-operation-id',400,'MODEL_CONNECTION_RECONCILIATION_DENIED'],
    ['forged-identity',400,'MODEL_CONNECTION_RECONCILIATION_DENIED'],
    ['extra-body-key',400,'MODEL_CONNECTION_INPUT_DENIED'],
  ],'PAN565_RECONCILE_DENIAL_NOT_OWNER_EXACT');
  // The closed route/method admission and the gates a real browser always sends are made visible
  // raw: wrong method, an owner method outside the closed admission, missing Origin and a foreign
  // Origin each name their own gate BEFORE the owner and cannot reach or alter the hold.
  assert.deepEqual([
    await rawProbe565(f,'/t/tenant-a/workspace/model-connection/reconcile',{method:'GET'}),
    await rawProbe565(f,'/t/tenant-a/workspace/model-connection/close',{headers:{origin:f.tls.origin},body:{operationId:heldOp,identityDigest:idg}}),
    await rawProbe565(f,'/t/tenant-a/workspace/model-connection/reconcile',{body:{operationId:heldOp,identityDigest:idg}}),
    await rawProbe565(f,'/t/tenant-a/workspace/model-connection/reconcile',{headers:{origin:'https://evil.invalid'},body:{operationId:heldOp,identityDigest:idg}}),
  ],[
    [404,'HOSTED_ROUTE_DENIED'],
    [404,'HOSTED_ROUTE_DENIED'],
    [403,'HOSTED_CSRF_DENIED'],
    [403,'HOSTED_ORIGIN_DENIED'],
  ],'PAN565_RECONCILE_ROUTE_OR_CSRF_GATE_NOT_EXACT');
  await f.page.locator('#pan565-read').click();await current(f);
  const rForged=await snapshot(f);
  assert.equal(rForged.revision,rHold.revision,'PAN565_DENIED_RECONCILE_MOVED_REVISION');
  assert.deepEqual(rForged.unknownUsage,rHold.unknownUsage,'PAN565_DENIED_RECONCILE_LOST_THE_HOLD');
  assert.equal(posts(f,'reconcile').length,5,'PAN565_DENIED_RECONCILE_POST_COUNT');
  assert.equal(f.server.post(),1,'PAN565_DENIED_RECONCILE_TOUCHED_PROVIDER');assert.equal(f.server.get(),3,'PAN565_DENIED_RECONCILE_EXTRA_PROVIDER_GET');
  assert.equal(persistedConnectionRow565(f).state.lastOperation,heldOp,'PAN565_HOLD_NOT_PERSISTED_IN_REAL_SOURCE');
  // The explicit user action: exactly the disclosed id over the existing route, then the
  // existing mandatory independent readback. Hold gone from readback, dialog and ledger.
  await f.page.locator(root).getByRole('button',{name:'Nullpreis-Hold jetzt abgleichen',exact:true}).click();
  await f.page.locator(root+'[data-state="CURRENT_CONNECTION"]').waitFor();
  const rDone=await snapshot(f);
  assert.equal(rDone.unknownUsage,null,'PAN565_HOLD_STILL_DISCLOSED_AFTER_RECONCILE');
  assert.equal(rDone.checks.INFERENCE.state,'FAILED');assert.equal(rDone.checks.INFERENCE.reason,'SYNTHETIC_ZERO_PRICE_RECONCILED_NO_MODEL_PASS');
  assert.equal(rDone.revision,rForged.revision+1,'PAN565_RECONCILE_REVISION_DRIFT');
  assert.equal(posts(f,'reconcile').length,6,'PAN565_RECONCILE_POSTS_NOT_EXACTLY_ONE_USER_POST');
  assert.equal(f.server.post(),1,'PAN565_RECONCILE_RETRIED_PROVIDER');assert.equal(f.server.get(),3,'PAN565_RECONCILE_EXTRA_PROVIDER_GET');
  assert.ok(!(await f.page.locator(root).innerText()).includes('Nativer Nutzungs-Hold'),'PAN565_HOLD_ROW_STILL_SHOWN_AFTER_SETTLEMENT');
  assert.equal(await f.page.locator('#pan565-reconcile').count(),0,'PAN565_RECONCILE_ACTION_OFFERED_WITHOUT_HOLD');
  await capture(f,'desktop-synthetic-hold-reconciled-owner-route');
  assert.equal(persistedConnectionRow565(f).state.lastOperation,rHold.unknownUsage.operationId,'PAN565_SETTLED_OPERATION_RECORD_ERASED_FROM_SOURCE');
  // Lifetime edge: a SETTLED operation cannot be reconciled a second time. The exact same body
  // lands on the owner's own held-state check — no second settlement, no revision drift, no
  // provider traffic and no request-budget refund.
  assert.deepEqual(await reconcileProbe565(f,[{name:'replay-after-settlement',session:sid,body:{operationId:heldOp,identityDigest:idg}}]),[['replay-after-settlement',400,'MODEL_CONNECTION_RECONCILIATION_DENIED']],'PAN565_SETTLED_OPERATION_RECONCILED_TWICE');
  await f.page.locator('#pan565-read').click();await current(f);
  const rReplay=await snapshot(f);
  assert.equal(rReplay.revision,rDone.revision,'PAN565_REPLAY_MOVED_REVISION');
  assert.equal(rReplay.unknownUsage,null,'PAN565_REPLAY_REDISCLOSED_THE_HOLD');
  assert.equal(posts(f,'reconcile').length,7,'PAN565_REPLAY_POST_COUNT');
  assert.equal(f.server.post(),1,'PAN565_REPLAY_TOUCHED_PROVIDER');assert.equal(f.server.get(),3,'PAN565_REPLAY_EXTRA_PROVIDER_GET');
  // Recovery continues ONLY over the existing honest path: reference reset, fresh phases,
  // fresh capped consent, exactly one new bounded synthetic inference.
  f.server.setMode('OK');
  await choose(f);
  for(const[label,phase]of[['Erreichbarkeit','REACHABILITY'],['Authentifizierung','AUTHENTICATION'],['Modellverfügbarkeit','MODEL_AVAILABILITY']])await probe(f,label,phase);
  await f.page.locator(root).getByRole('button',{name:'Genau diese gedeckelte Inferenzprobe freigeben',exact:true}).click();await current(f);
  await probe(f,'Begrenzte Inferenz','INFERENCE');
  const rFinal=await snapshot(f);
  assert.equal(rFinal.checks.INFERENCE.state,'PASS');assert.equal(rFinal.unknownUsage,null);assert.equal(rFinal.realModelAcceptance,false);
  assert.equal(f.server.post(),2,'PAN565_RECOVERY_PROVIDER_POSTS_NOT_EXACTLY_TWO');assert.equal(f.server.get(),6,'PAN565_RECOVERY_PROVIDER_GETS_NOT_EXACTLY_SIX');
  // Retired session: after logout the protected route's own authentication denies the reconcile
  // before the owner — an expired session gains nothing from the reconciliation path, and the
  // settled ledger keeps zero provider replay.
  const retired=await f.page.evaluate(async body=>{const logout=await fetch('/t/tenant-a/workspace/logout',{method:'POST',credentials:'same-origin'});const response=await fetch('/t/tenant-a/workspace/model-connection/reconcile',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});let error=null;try{error=(await response.json()).error;}catch{}return[logout.status,response.status,error];},{operationId:heldOp,identityDigest:idg});
  assert.deepEqual(retired,[200,401,'HOSTED_SESSION_DENIED'],'PAN565_RETIRED_SESSION_RECONCILE_NOT_DENIED_BEFORE_OWNER');
  assert.equal(posts(f,'reconcile').length,8,'PAN565_TOTAL_RECONCILE_POST_COUNT');
  assert.equal(f.server.post(),2,'PAN565_RETIRED_SESSION_PROVIDER_DRIFT');assert.equal(f.server.get(),6,'PAN565_RETIRED_SESSION_PROVIDER_GET_DRIFT');
  assert.deepEqual(f.errors,[]);
 }finally{f.server.setMode('OK');await f.close();}
});
// RUN103/RUN104 negative on an externally priced route: the retained hold is disclosed honestly
// with reconcilable false and NO browser action at all; a direct authenticated POST now really
// reaches the owner and is denied there with the exact MODEL_CONNECTION_USAGE_ORACLE_UNAVAILABLE
// (RUN104 strengthened: not a bare non-200), and the full hold stays retained. The browser never
// gains settlement authority for foreign prices, and the honest owner-reader-only line is shown
// instead of a fake button.
test('565 owner-bound retained hold discloses reconcilable false with no browser reconcile action; a direct route denial keeps the full hold and the honest owner-only line',async()=>{
 const f=await fixture({grant:true,ownerBound:true});
 try{
  await open(f);await current(f);await choose(f);
  for(const[label,phase]of[['Erreichbarkeit','REACHABILITY'],['Authentifizierung','AUTHENTICATION'],['Modellverfügbarkeit','MODEL_AVAILABILITY']])await probe(f,label,phase);
  await f.page.locator(root).getByRole('button',{name:'Genau diese gedeckelte Inferenzprobe freigeben',exact:true}).click();await current(f);
  f.server.setMode('TIMEOUT');
  await f.page.locator('#pan565-probe-INFERENCE').click();await f.page.locator(root+'[data-state="CURRENT_CONNECTION"]').waitFor();
  const rHold=await snapshot(f);
  assert.equal(rHold.checks.INFERENCE.state,'UNKNOWN_USAGE');assert.equal(rHold.unknownUsage.reconcilable,false,'PAN565_OWNER_BOUND_HOLD_OFFERS_RECONCILIATION');
  assert.equal(await f.page.locator('#pan565-reconcile').count(),0,'PAN565_BROWSER_RECONCILE_OFFERED_FOR_FOREIGN_PRICE');
  const view=await f.page.locator(root).innerText();
  assert.ok(view.includes('nur durch qualifizierten Owner-Nutzungsleser'),'PAN565_OWNER_BOUND_HOLD_HINT_MISSING');
  assert.ok(view.includes(rHold.unknownUsage.operationId),'PAN565_OWNER_BOUND_HELD_OPERATION_ID_NOT_VISIBLE');
  await capture(f,'desktop-owner-bound-unknown-hold-owner-only');
  // RUN104: the strengthened probe asserts the owner's own oracle denial, not a bare non-200 —
  // the closed route now admits the exact reconcile operation, so this route-specific refusal can
  // only come from the owner itself. The full hold stays retained across the denial.
  assert.deepEqual(await reconcileProbe565(f,[{name:'owner-bound-direct-reconcile',session:rHold.binding.sessionId,body:{operationId:rHold.unknownUsage.operationId,identityDigest:rHold.identityDigest}}]),[['owner-bound-direct-reconcile',400,'MODEL_CONNECTION_USAGE_ORACLE_UNAVAILABLE']],'PAN565_OWNER_BOUND_RECONCILE_DENIAL_NOT_OWNER_EXACT');
  assert.equal(posts(f,'reconcile').length,1,'PAN565_OWNER_BOUND_RECONCILE_POST_COUNT');
  await f.page.locator('#pan565-read').click();await current(f);
  const rAfter=await snapshot(f);
  assert.deepEqual(rAfter.unknownUsage,rHold.unknownUsage,'PAN565_DENIED_RECONCILE_ALTERED_THE_HOLD');
  assert.equal(f.server.post(),1,'PAN565_DENIED_RECONCILE_TOUCHED_PROVIDER');assert.equal(f.server.get(),3,'PAN565_DENIED_RECONCILE_EXTRA_PROVIDER_GET');
  assert.deepEqual(f.errors,[]);
 }finally{f.server.setMode('OK');await f.close();}
});
// RUN105 complementary native-browser coverage: a genuine provider-transport TIMEOUT (the POST is
// answered by NOTHING, not by a test-side hold release) retains the full reservation through the
// EXISTING owner fence while the provider GET route stays genuinely live — exactly the composed-548
// shell's real situation during the timed-out probe. The explicit zero-price reconcile then settles
// the hold over the real closed route with one POST plus independent readback while the provider
// transport stays frozen at exactly one attempted POST. Existing RUN104 bytes untouched; the new
// HOLD_PROBE peer mode is additive in the shared565 fixture.
test('565 RUN105 genuine provider timeout with live GET: HOLD_PROBE retains the full synthetic hold, the explicit reconcile settles it over the real route with the GET route still answering and the provider frozen at one POST; NOT model acceptance',async()=>{
 const f=await fixture({grant:true});
 try{
  await open(f);await current(f);await choose(f);
  for(const[label,phase]of[['Erreichbarkeit','REACHABILITY'],['Authentifizierung','AUTHENTICATION'],['Modellverfügbarkeit','MODEL_AVAILABILITY']])await probe(f,label,phase);
  await f.page.locator(root).getByRole('button',{name:'Genau diese gedeckelte Inferenzprobe freigeben',exact:true}).click();await current(f);
  f.server.setMode('HOLD_PROBE');
  await f.page.locator('#pan565-probe-INFERENCE').click();
  await f.page.locator(root+'[data-state="CURRENT_CONNECTION"]').waitFor();
  const rHold=await snapshot(f);
  assert.equal(rHold.checks.INFERENCE.state,'UNKNOWN_USAGE');assert.equal(rHold.reason,'UNKNOWN_USAGE_RETAINED');
  assert.equal(rHold.unknownUsage.reconcilable,true,'PAN565_RUN105_SYNTHETIC_TIMEOUT_HOLD_NOT_RECONCILABLE');
  assert.match(rHold.unknownUsage.operationId,/^operation:mc-[a-f0-9]{40}$/,'PAN565_RUN105_TIMEOUT_HELD_OPERATION_NOT_DISCLOSED');
  assert.equal(f.server.post(),1,'PAN565_RUN105_TIMEOUT_PROVIDER_RETRY');
  // The GET provider path was never frozen by the hung POST: a genuine REACHABILITY re-probe reaches the live peer while the hold stands. It rewrites only the minimized phase checks — the disclosed full hold is unchanged.
  const rProbe=await probe(f,'Erreichbarkeit','REACHABILITY');
  assert.equal(f.server.get(),4,'PAN565_RUN105_LIVE_GET_FROZEN_BY_THE_POST_HOLD');
  assert.equal(f.server.post(),1,'PAN565_RUN105_REPROBE_REDISPATCHED_THE_PROVIDER_POST');
  assert.deepEqual(rProbe.unknownUsage,rHold.unknownUsage,'PAN565_RUN105_REPROBE_ALTERED_THE_DISCLOSED_HOLD');
  await capture(f,'desktop-run105-timeout-hold-live-get');
  await f.page.locator('#pan565-reconcile').click();
  await f.page.locator(root+'[data-state="CURRENT_CONNECTION"]').waitFor();
  const rSettled=await snapshot(f);
  assert.equal(rSettled.unknownUsage,null,'PAN565_RUN105_TIMEOUT_HOLD_STILL_DISCLOSED');
  assert.equal(rSettled.revision,rProbe.revision+1,'PAN565_RUN105_TIMEOUT_SETTLEMENT_REVISION_DRIFT');
  assert.equal(rSettled.checks.INFERENCE.reason,'SYNTHETIC_ZERO_PRICE_RECONCILED_NO_MODEL_PASS','PAN565_RUN105_TIMEOUT_SETTLEMENT_NOT_HONESTLY_RE_READ');
  assert.equal(posts(f,'reconcile').length,1,'PAN565_RUN105_TIMEOUT_RECONCILE_POST_COUNT');
  assert.equal(f.server.post(),1,'PAN565_RUN105_TIMEOUT_RECONCILE_TOUCHED_PROVIDER');
  await capture(f,'desktop-run105-timeout-hold-settled-zero-price');
  assert.deepEqual(f.errors,[]);
 }finally{f.server.setMode('OK');await f.close();}
});
