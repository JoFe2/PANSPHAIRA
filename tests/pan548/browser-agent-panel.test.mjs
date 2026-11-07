import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {nativeViewBrowserFixture546} from '../pan546/browser-fixture.mjs';
import {connectionOptions565,syntheticCredential565} from '../pan565/native-fixture.mjs';
import {syntheticWorkspaceViewChatFeedbackModelV1} from '../../src/pan548/native-agent-run.mjs';
const root='[id="shell.agent-panel"]',view='[id="shell.module-view"]';
const hash=b=>createHash('sha256').update(b).digest('hex');
// Fixture-owned literal expectation for the synthetic HTTP framing peer below.
// The actual565 transport renames exactly the two native UI tool identities to
// the closed provider wire aliases before dispatch, so the peer sees and must
// answer with exactly these wire names. Test-owned literals, not the production
// mapping imported as its own oracle; no generic or runtime-configurable registry.
const wireAliasPeer548=Object.freeze({'ui.view.read':'ui_view_read','ui.view.propose':'ui_view_propose'});
const wireNamesPeer548=Object.freeze(Object.values(wireAliasPeer548));
function evidence(){assert.ok(process.env.PAN548_BROWSER_EVIDENCE,'PAN548 requires actual evidence, never skip');mkdirSync(process.env.PAN548_BROWSER_EVIDENCE,{recursive:true,mode:0o700});return process.env.PAN548_BROWSER_EVIDENCE;}
const count=(f,suffix)=>f.requests.filter(r=>r.path.endsWith('/agent-run/'+suffix)).length;
async function state(f,s){
 try{await f.page.locator(root+'[data-state="'+s+'"]').waitFor({state:'attached'});await showAgentTechnicalUI(f.page);await f.page.locator(root+'[data-state="'+s+'"]').waitFor();}
 catch(error){
  try{
   await f.flushResponses();
   writeFileSync(join(evidence(),'actual-agent-state-failure-'+s+'-'+Date.now()+'.json'),JSON.stringify({expected:s,body:await f.page.locator('body').innerText(),errors:f.errors,requests:f.requests,responses:f.responses},null,2)+'\n');
   const operation=path=>typeof path==='string'?['plan','start','read','verify','catalog'].find(name=>path.endsWith('/'+name))??null:null;
   const safePhase=value=>['CURRENT_SCOPE','PLANNING','PLAN_DENIED','PLANNED_NOT_DISPATCHED','DISPATCHING','READING_NATIVE_RUN','RUNNING','RESULT_READY','OUTCOME_UNCONFIRMED','RUN_READ_DENIED'].includes(value)?value:null;
   const nativeResponses=f.responses.filter(r=>operation(r.path)).map(r=>({operation:operation(r.path),method:['GET','POST'].includes(r.method)?r.method:null,status:Number.isInteger(r.status)?r.status:null,phase:safePhase(r.value?.phase),proposalNull:r.value?.proposal===null}));
   const plan=f.responses.filter(r=>r.path.endsWith('/agent-run/plan')&&r.status===200).at(-1)?.value;
   const nativeNetwork=(f.nativeNetwork??[]).filter(r=>operation(r.path)).map(r=>({operation:operation(r.path),method:['GET','POST'].includes(r.method)?r.method:null,receivedAt:Number.isSafeInteger(r.receivedAt)?r.receivedAt:null,finishedAt:Number.isSafeInteger(r.finishedAt)?r.finishedAt:null,closedAt:Number.isSafeInteger(r.closedAt)?r.closedAt:null,status:Number.isInteger(r.status)?r.status:null,requestFailed:typeof r.browserFailure==='string'}));
   const posts=typeof f.posts==='function'?f.posts():null;
   console.error('PAN548_ACTUAL_AGENT_STATE_FAILURE',{expected:s,actual:safePhase(await f.page.locator(root).getAttribute('data-state')),nowMs:Date.now(),planExpiresAtMs:Number.isSafeInteger(plan?.expiresAtMs)?plan.expiresAtMs:null,modelPosts:Number.isSafeInteger(posts)&&posts>=0?posts:null,nativeResponses,nativeNetwork,rawBodiesAndCredentialsOmitted:true});
  }catch{try{console.error('PAN548_ACTUAL_AGENT_STATE_FAILURE',{expected:s,diagnosticCollectionFailed:true,rawBodiesAndCredentialsOmitted:true});}catch{}}
  throw error;
 }
}
async function open(f){await f.page.goto(f.tls.origin+'/t/tenant-a/workspace');await showCurrentContextDetailsUI(f.page);await f.page.locator('[id="shell.context-selection"][data-module="pan.setup"][data-state="CURRENT_CONTEXT"]').waitFor();await f.page.locator(root).waitFor();await f.page.getByRole('button',{name:'Eingangsrechnungsprüfung — nur lesen',exact:true}).click();await showCurrentViewDetailsUI(f.page);await f.page.locator(view+'[data-state="CURRENT_NATIVE_VIEW"]').waitFor();}
async function select(f){const b=f.page.locator(view).getByRole('button',{name:'Rechnungswert',exact:true});await b.focus();await b.press('Enter');const registered=f.page.getByRole('button',{name:'Kontextauswahl: Persönliches Viewelement: invoice-value',exact:true});await f.page.waitForFunction(()=>document.querySelector('[id="shell.context-selection"] button[aria-pressed="true"]')?.textContent==='Kontextauswahl: Persönliches Viewelement: invoice-value');assert.equal(await registered.getAttribute('aria-pressed'),'true');await showCurrentViewDetailsUI(f.page);await f.page.locator(view+'[data-state="CURRENT_NATIVE_VIEW"]').waitFor();await f.flushResponses();const native=f.responses.filter(r=>r.path.endsWith('/context-selection')&&r.method==='POST'&&r.status===200&&r.value?.context?.selection?.rowId==='invoice-value').at(-1);assert.equal(native.value.context.selection.elementId,'pan.erv.module-card');await showAgentTechnicalUI(f.page);await f.page.locator(root).getByRole('button',{name:'Begrenzten Testauftrag planen',exact:true}).waitFor();}
async function plan(f){await showAgentTechnicalUI(f.page);await f.page.locator(root).getByRole('button',{name:'Begrenzten Testauftrag planen',exact:true}).click();await state(f,'PLANNED_NOT_DISPATCHED');await f.flushResponses();return f.responses.filter(r=>r.path.endsWith('/agent-run/plan')&&r.status===200).at(-1).value;}
async function run(f){await showAgentTechnicalUI(f.page);await f.page.locator(root).getByRole('button',{name:'Genau diesen synthetischen Lauf starten',exact:true}).click();await state(f,'RESULT_READY');await f.flushResponses();return f.responses.filter(r=>r.path.endsWith('/agent-run/start')&&r.status===200).at(-1).value;}
async function capture(f,name){if(await f.page.locator(root).count()&&await f.page.evaluate(()=>innerWidth<800&&document.body.dataset.mobileWorkArea!=='ASSISTANT'))await f.page.getByRole('button',{name:'Assistent',exact:true}).click();if(await f.page.locator(root).count())await revealAgentDiagnosisV1(f.page);const image=join(evidence(),name+'.png');await f.page.screenshot({path:image,fullPage:true});const dimensions=await f.page.evaluate(()=>({viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,zoom:getComputedStyle(document.body).zoom,controls:[...document.querySelectorAll('button,select,textarea,input,a')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{label:e.getAttribute('aria-label')??e.textContent,left:r.left,right:r.right,width:r.width,height:r.height};}),diagnosisGeometry:(()=>{const panelEl=document.getElementById('shell.agent-panel');if(!panelEl)return null;const want=['Fehlerdiagnose (minimiert, native Projektion)','Tatsächlich gemessene Anfragen / Werkzeugaktionen'];const dts=[...panelEl.querySelectorAll('.agent-technical-details>dl dt')].filter(n=>want.includes(n.textContent?.trim()??''));if(!dts.length)return null;const port=document.getElementById('pan548-agent-body')?.getBoundingClientRect(),panel=panelEl.getBoundingClientRect();return dts.flatMap(dt=>[dt,dt.nextElementSibling].filter(Boolean).map(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(Math.min(Math.max(r.left+r.width/2,0),innerWidth-1),Math.min(Math.max(r.top+r.height/2,1),innerHeight-1));return{row:el.tagName==='DT'?'label':'value',top:r.top,bottom:r.bottom,visible:!!el.getClientRects().length,insideViewport:r.top>=0&&r.bottom<=innerHeight,insideScrollport:!!port&&r.top>=port.top-1&&r.bottom<=port.bottom+1&&r.left>=port.left-1&&r.right<=port.right+1,insidePanel:r.top>=panel.top-1&&r.bottom<=panel.bottom+1&&r.left>=panel.left-1&&r.right<=panel.right+1,hitSelf:!!hit&&(hit===el||el.contains(hit))};}));})(),
composerGeometry:(()=>{const c=document.querySelector('[id="shell.agent-panel"] .agent-integrated-composer'),panelEl=document.getElementById('shell.agent-panel');if(!c||!panelEl||!c.getClientRects().length)return null;const r=c.getBoundingClientRect(),panel=panelEl.getBoundingClientRect(),column=panelEl.parentElement,cands=(column?[...column.children]:[]).concat(['shell.context-details','shell.panels','shell.context-selection','shell.model-connection'].map(id=>document.getElementById(id)).filter(Boolean)).filter(n=>n!==panelEl&&n.compareDocumentPosition(panelEl)&Node.DOCUMENT_POSITION_PRECEDING&&!!n.getClientRects().length);let overlapNext=null;for(const n of cands){const q=n.getBoundingClientRect(),ix=Math.max(0,Math.min(r.bottom,q.bottom)-Math.max(r.top,q.top))*Math.max(0,Math.min(r.right,q.right)-Math.max(r.left,q.left));if(ix>2){overlapNext={next:n.id||String(n.className),areaPx2:Math.round(ix)};break;}}return{top:r.top,bottom:r.bottom,insidePanel:r.top>=panel.top-1&&r.bottom<=panel.bottom+1&&r.left>=panel.left-1&&r.right<=panel.right+1,overlapNext};})(),panel:(()=>{const r=document.getElementById('shell.agent-panel')?.getBoundingClientRect();return r?{left:r.left,right:r.right,width:r.width,height:r.height}:null;})()}));writeFileSync(join(evidence(),name+'.png.json'),JSON.stringify({dimensions,geometryRecordedBeforeAssertions:true},null,2)+'\n');assert.ok(dimensions.pageWidth<=dimensions.viewport,'PAN548_PANEL_PAGE_HORIZONTAL_OVERFLOW');assert.ok(dimensions.controls.every(x=>x.width>0&&x.height>0&&x.left>=0&&x.right<=dimensions.viewport),'PAN548_PANEL_VISIBLE_CONTROL_CLIPPING');if(dimensions.panel)assert.ok(dimensions.panel.width>0&&dimensions.panel.height>0&&dimensions.panel.left>=0&&dimensions.panel.right<=dimensions.viewport);if(dimensions.composerGeometry){assert.ok(dimensions.composerGeometry.insidePanel,'PAN548_COMPOSER_MUST_STAY_WITHIN_PANEL_BOUNDS:'+JSON.stringify(dimensions.composerGeometry));assert.ok(!dimensions.composerGeometry.overlapNext,'PAN548_COMPOSER_OVERLAPS_FOLLOWING_NATIVE_CONTENT:'+JSON.stringify(dimensions.composerGeometry.overlapNext));}const pins={};for(const n of ['dist/browser-workspace/app.js','dist/browser-workspace/workspace-agent-panel.js','dist/browser-workspace/erv-human.js','packages/browser-workspace/src/workspace-agent-panel-v1.ts','packages/browser-workspace/src/workspace-agent-panel-v1.css','packages/contracts/src/workspace-agent-run-v1.ts','src/pan548/native-agent-run.mjs','src/pan527/origin-session-adapter.mjs','src/pan541/workspace-browser.mjs'])pins[n]=hash(readFileSync(n));const sequentialDiagnosisCaptures=dimensions.diagnosisGeometry?await captureDiagnosisRowsSequentialV1(f,name,pins):null;const receipt={name,imageSHA256:hash(readFileSync(image)),dimensions,pins,sequentialDiagnosisCaptures,persistedViewRevision:f.readPersisted().revision,agentState:await f.page.locator(root).count()?await f.page.locator(root).getAttribute('data-state'):null,taskId:await f.page.locator(root).count()?await f.page.locator(root).getAttribute('data-run'):null,modelMode:'SYNTHETIC_PROBE_ONLY',realModelAcceptance:false};writeFileSync(image+'.json',JSON.stringify(receipt,null,2)+'\n');return receipt;}
async function preview(f){const b=f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true});await b.click();await f.page.locator(view+'[data-state="PREVIEW_ONLY"]').waitFor();assert.equal(await f.page.locator(view).getAttribute('data-proposal-source'),'AGENT');}
async function confirm(f){await f.page.locator(view).getByRole('button',{name:'Genau diese persönliche View bestätigen und speichern',exact:true}).click();await f.page.locator(view+'[data-state="SAVED_AND_NATIVE_READBACK_CONFIRMED"]').waitFor();await f.flushResponses();}

// The existing native browser assembly is exercised against a LOCAL framing
// peer. Neither HTTP200, OWNER_BOUND_PROVIDER nor this peer is LLM evidence.
// RUN50 additions to the SAME existing fixture only: holdPeer makes exactly
// the first synthetic POST wait on a test-owned deferred release (the genuine
// same-origin protocol peer stays the only model-speaking party — no fake
// native response, no polling), and maxTimeMs raises only this fixture's own
// already-closed grant limit for the held-window test. Nothing else changes.
async function connectedFixture({taskPurpose=true,empty=false,unknown=false,holdPeer=false,maxTimeMs=15000}={}){
 const privateRoot=mkdtempSync(join(tmpdir(),'pan548-browser-native-owner-'));
 const credentialFile=join(privateRoot,'existing-local-test-secret');
 writeFileSync(credentialFile,syntheticCredential565,{mode:0o600});
 const peer=syntheticWorkspaceViewChatFeedbackModelV1('tenant-a'),observations=[];let posts=0,f;
 let markPeerHeld,resolvedPeerHeld=false;const peerHeld=new Promise(r=>{markPeerHeld=()=>{resolvedPeerHeld=true;r();};});peerHeld.catch(()=>{});let releasePeerGate;const peerGate=new Promise(r=>{releasePeerGate=r;});
 const server=createServer(async(req,res)=>{
  try{
   let bytes='';for await(const chunk of req)bytes+=chunk;
   const body=bytes?JSON.parse(bytes):null;
   observations.push({method:req.method,credentialPresent:typeof req.headers.authorization==='string',body});
   res.writeHead(200,{'content-type':'application/json'});
   if(req.method==='GET'){res.end(JSON.stringify({data:[{id:'model:synthetic-v1'}]}));return;}
   posts++;
   if(holdPeer&&posts===1){markPeerHeld();await peerGate;}
   // The peer obeys the actual provider framing: like the real server it accepts
   // ONLY the closed wire names it was actually given (declared tools AND the
   // assistant transcript) and rejects any unexpected/dotted name instead of
   // silently inventing aliases. The native source keeps rejecting such echoes.
   const declared=[];for(const t of body?.tools??[])if(typeof t?.function?.name==='string')declared.push(t.function.name);
   for(const m of body?.messages??[])if(m?.role==='assistant'&&Array.isArray(m.tool_calls))for(const c of m.tool_calls)if(typeof c?.function?.name==='string')declared.push(c.function.name);
   assert.ok(declared.length>0&&declared.every(n=>wireNamesPeer548.includes(n)),'PAN548_SYNTHETIC_PEER_OUTGOING_NOT_CLOSED_WIRE:'+JSON.stringify(declared));
   const result=await peer.providerCall({request:body},new AbortController().signal);
   if(unknown&&!result.toolCalls.length){const final=JSON.parse(result.text);final.answers[0].sum=0;result.text=JSON.stringify(final);}
   // Echo the advertised aliases; call IDs, arguments and content are preserved.
   const echoNames=result.toolCalls.map(c=>{const alias=wireAliasPeer548[c.name];assert.ok(typeof alias==='string','PAN548_SYNTHETIC_PEER_UNEXPECTED_NATIVE_TOOL:'+String(c.name));return alias;});
   res.end(JSON.stringify({model:'model:synthetic-v1',choices:[{message:{content:result.toolCalls.length?null:result.text,tool_calls:result.toolCalls.map((c,i)=>({id:c.id,type:'function',function:{name:echoNames[i],arguments:JSON.stringify(c.arguments)}}))}}],usage:{prompt_tokens:2,completion_tokens:3}}));
  }catch(error){try{console.error('PAN548_SYNTHETIC_PEER_FAILURE',String(error?.message??error));}catch{}res.destroy();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const options=connectionOptions565({origin:'http://127.0.0.1:'+server.address().port},credentialFile);
 options.productGrant.limits={...options.productGrant.limits,maxTimeMs,maxInputBytes:32768};
 if(taskPurpose)options.productGrant.allowedPurposes=['purpose:ui-connection-probe','purpose:ui-view-proposal'];
 try{f=await nativeViewBrowserFixture546({agentRuns:true,modelConnections:empty?[]:[options]});}
 catch(error){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(privateRoot,{recursive:true,force:true});throw error;}
 const nativeNetwork=[];
 f.tls.gateway.server.prependListener('request',(request,response)=>{if(!request.url.includes('/workspace/agent-run/'))return;const entry={path:request.url,method:request.method,receivedAt:Date.now()};nativeNetwork.push(entry);response.once('finish',()=>{entry.finishedAt=Date.now();entry.status=response.statusCode;});response.once('close',()=>{entry.closedAt=Date.now();});});
 f.page.on('requestfailed',request=>{if(request.url().includes('/workspace/agent-run/'))nativeNetwork.push({path:new URL(request.url()).pathname,browserFailure:request.failure()?.errorText,at:Date.now()});});
 return {...f,observations,nativeNetwork,connectionId:options.summary.connectionId,posts:()=>posts,peerHeld,releasePeer(){releasePeerGate();},async close(){releasePeerGate();markPeerHeld();try{await f.close();}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(privateRoot,{recursive:true,force:true});}}};
}
async function selectConnectedView(f){
 await f.page.locator(view).getByRole('button',{name:'Rechnungswert',exact:true}).focus();
 await f.page.keyboard.press('Enter');
 await f.page.waitForFunction(()=>document.querySelector('[id="shell.context-selection"] button[aria-pressed="true"]')?.textContent==='Kontextauswahl: Persönliches Viewelement: invoice-value');
 await showCurrentViewDetailsUI(f.page);await f.page.locator(view+'[data-state="CURRENT_NATIVE_VIEW"]').waitFor();
 await showAgentTechnicalUI(f.page);await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).waitFor();
}
async function connect(f){
 const connection='[id="shell.model-connection"]';
 await f.page.locator(connection).getByRole('button',{name:'Sichere Modellverbindung öffnen',exact:true}).click();
 await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();
 await f.page.locator('#pan565-connection-choice').selectOption(f.connectionId);
 await f.page.locator('#pan565-select').click();
 await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();
 for(const label of ['Erreichbarkeit','Authentifizierung','Modellverfügbarkeit']){
  await f.page.locator(connection).getByRole('button',{name:label+' separat prüfen',exact:true}).click();
  await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();
 }
 await f.flushResponses();assert.equal(f.posts(),0);
}
async function boundPlan(f){await showAgentTechnicalUI(f.page);
 await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).click();
 await state(f,'PLANNED_NOT_DISPATCHED');await f.flushResponses();
 const p=f.responses.filter(r=>r.path.endsWith('/agent-run/plan')&&r.status===200).at(-1).value;
 assert.equal(p.modelMode,'OWNER_BOUND_PROVIDER');assert.equal(p.realModelAcceptance,false);
 assert.equal(p.inferenceConsentOffer.evidenceClass,'SYNTHETIC_ONLY');
 assert.equal(p.inferenceConsentOffer.purpose,'purpose:ui-view-proposal');return p;
}
async function connectedCapture(f,name){
 assert.ok(!(await f.page.locator('body').innerText()).includes(syntheticCredential565),'NATIVE_OWNER_SECRET_VISIBLE');
 const n=await capture(f,name),sidecar=join(evidence(),name+'.png.json');
 const r=JSON.parse(readFileSync(sidecar,'utf8'));r.modelMode=await f.page.locator(root).getAttribute('data-model-mode');
 r.controlledLocalHTTPNotLLM=true;r.actualModelPosts=f.posts();
 r.actualConsentChecked=await f.page.locator('#pan548-agent-inference-consent').isChecked();
 for(const path of ['src/pan565/native-model-connection.mjs','src/pan565/connection-transport.mjs','src/pan543/profile-store.mjs','src/pan575/broker-tool-feedback.mjs','packages/contracts/src/workspace-model-connection-v1.ts'])r.pins[path]=hash(readFileSync(path));
 writeFileSync(sidecar,JSON.stringify(r,null,2)+'\n');return n;
}
test('DUI09 internal connected browser native565 dynamic selection -> exact unchecked purpose/payload offer -> once-only actual HTTP/two native tools -> separate546 preview/CAS/read/Undo/reload; NOT LLM',async()=>{
 const f=await connectedFixture();try{
  const before=f.business();await open(f);await selectConnectedView(f);await connect(f);
  const p=await boundPlan(f),start=f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}),consent=f.page.locator('#pan548-agent-inference-consent');
  assert.equal(await consent.isChecked(),false);assert.equal(await start.isDisabled(),true);assert.equal(count(f,'start'),0);
  for(const value of [p.inferenceConsentOffer.routeId,p.inferenceConsentOffer.model,p.inferenceConsentOffer.payloadDigest,p.inferenceConsentOffer.offerDigest])assert.ok((await f.page.locator(root).innerText()).includes(value));
  await connectedCapture(f,'desktop-native-task-offer-unchecked-no-dispatch');
  await consent.check();await f.page.locator('#pan548-agent-intent').fill('Nur dieses ausgewählte Element größer, erst Vorschlag.');
  assert.equal(await consent.isChecked(),false);assert.equal(count(f,'start'),0);assert.equal(f.posts(),0);
  const fresh=await boundPlan(f);assert.notEqual(fresh.inferenceConsentOffer.payloadDigest,p.inferenceConsentOffer.payloadDigest);
  await f.page.setViewportSize({width:390,height:844});await connectedCapture(f,'390-native-task-bound-offer-all-caps');
  await f.page.evaluate(()=>{document.body.style.zoom='2';});await connectedCapture(f,'390-zoom200-native-task-bound-offer');await f.page.evaluate(()=>{document.body.style.zoom='1';});
  await consent.check();await start.focus();await f.page.keyboard.press('Enter');
  try{await state(f,'RESULT_READY');}catch{assert.equal(await f.page.locator(root).getAttribute('data-state'),'OUTCOME_UNCONFIRMED');await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).click();await state(f,'RESULT_READY');await f.flushResponses();writeFileSync(join(evidence(),'actual-connected-start-failure-independent-read.json'),JSON.stringify({nativeNetwork:f.nativeNetwork,posts:f.posts(),peerMethods:f.observations.map(v=>v.method),nativeResponses:f.responses.filter(v=>v.path.endsWith('/agent-run/read')||v.path.endsWith('/agent-run/start'))},null,2)+'\n');}
  await f.flushResponses();
  const command=f.requests.filter(r=>r.path.endsWith('/agent-run/start')).at(-1).body;
  assert.deepEqual(command.inferenceConsent,{offerDigest:fresh.inferenceConsentOffer.offerDigest,confirm:true});
  assert.equal(f.posts(),2);assert.equal(count(f,'start'),1);assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);
  assert.deepEqual(f.observations.filter(r=>r.method==='POST')[1].body.messages.map(m=>m.role),['user','assistant','tool','tool']);
  // Exact closed wire names as actually observed on the outgoing transport bytes
  // (fixture-owned literals; the production adapter is not its own oracle here).
  const peerPosts=f.observations.filter(r=>r.method==='POST');
  assert.deepEqual(peerPosts[0].body.tools.map(t=>t.function.name),[...wireNamesPeer548],'BROWSER_OUTGOING_DECLARED_TOOLS_EXACT_CLOSED_WIRE');
  assert.deepEqual(peerPosts[1].body.messages[1].tool_calls.map(c=>c.function.name),[...wireNamesPeer548],'BROWSER_OUTGOING_ASSISTANT_TOOLCALLS_EXACT_CLOSED_WIRE');
  assert.equal((f.responses.filter(r=>(r.path.endsWith('/agent-run/start')||r.path.endsWith('/agent-run/read'))&&r.status===200).at(-1).value).modelMode,'OWNER_BOUND_PROVIDER');
  await f.page.setViewportSize({width:1280,height:900});assert.ok(!(await f.page.locator(root).innerText()).includes('Fehlerdiagnose'),'RESULT_READY_MUST_NOT_SHOW_FAILURE_DIAGNOSIS');await connectedCapture(f,'desktop-native-owner-result-preview-only');
  await preview(f);assert.equal(f.readPersisted().revision,0);await connectedCapture(f,'desktop-native-owner-separate546-before-after');
  await confirm(f);assert.equal(f.readPersisted().revision,1);assert.equal(f.business(),before);
  await showCurrentViewDetailsUI(f.page);await f.page.locator(view).getByRole('button',{name:'Letzten gespeicherten Viewstand zurückholen',exact:true}).click();await f.page.locator(view+'[data-state="PREVIEW_ONLY"]').waitFor();await confirm(f);
  await f.page.locator(view+'[data-state="SAVED_AND_NATIVE_READBACK_CONFIRMED"]').waitFor();assert.equal(f.readPersisted().revision,2);
  await f.page.reload();await showCurrentContextDetailsUI(f.page);await f.page.locator('[id="shell.context-selection"][data-module="pan.erv"][data-state="CURRENT_CONTEXT"]').waitFor();await state(f,'RESULT_READY');
  assert.equal(await f.page.locator(root).getAttribute('data-run'),fresh.runId);assert.equal(f.posts(),2);assert.equal(count(f,'start'),1);assert.equal(f.business(),before);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
test('DUI09 internal native configured empty/probe-only owner denies task planning; no silent synthetic fallback, no data transfer or model POST',async()=>{
 for(const empty of [true,false]){const f=await connectedFixture({empty,taskPurpose:false});try{
  await open(f);await selectConnectedView(f);if(!empty)await connect(f);
  await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).click();await state(f,'PLAN_DENIED');
  assert.equal(f.posts(),0);assert.equal(count(f,'start'),0);assert.equal(f.readPersisted().revision,0);
  assert.equal(await f.page.locator(root).getAttribute('data-model-mode'),'OWNER_BOUND_PROVIDER');
  assert.ok((await f.page.locator(root).innerText()).includes('kein synthetischer Fallback'));
  if(empty)await connectedCapture(f,'desktop-native-no-product-route-no-fallback');
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}}
});
test('DUI09 internal connected malformed fresh tool feedback stays native UNKNOWN with retained reservation and no proposal/blind retry after read/reload; NOT LLM',async()=>{
 const f=await connectedFixture({unknown:true});try{
  await open(f);await selectConnectedView(f);await connect(f);const p=await boundPlan(f);
  await f.page.locator('#pan548-agent-inference-consent').check();await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await state(f,'OUTCOME_UNCONFIRMED');await f.flushResponses();assert.equal(f.posts(),2);assert.equal(count(f,'start'),1);assert.equal(f.readPersisted().revision,0);
  await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).click();await state(f,'OUTCOME_UNCONFIRMED');await f.flushResponses();
  const r=f.responses.filter(r=>r.path.endsWith('/agent-run/read')&&r.status===200).at(-1).value;assert.equal(r.proposal,null);assert.ok(r.budget.model.committedUnits>0);
  // The run48-corrected historical binding/source/sourceRevisions survive this
  // genuine UNKNOWN owner reopen through the closed DTO: the actually read
  // triple equals the original plan-time values (retained old-tab binding,
  // same principal admitted) and the retained reservation is intact — nothing
  // invented, nothing consumed-settled, no relabeling to a newer context.
  assert.deepEqual(r.binding,p.binding,'PAN548_HISTORICAL_BINDING_NOT_THE_ORIGINAL_PLAN_BINDING');
  assert.equal(r.sourceDigest,p.sourceDigest,'PAN548_HISTORICAL_SOURCE_DIGEST_NOT_THE_ORIGINAL');
  assert.deepEqual(r.sourceRevisions,p.sourceRevisions,'PAN548_HISTORICAL_SOURCE_REVISIONS_NOT_THE_ORIGINAL');
  const retainedBudget=r.budget;
  // The actual readback must carry the exact minimized diagnosis observed by
  // the native broker loop for this synthetic tampered final answer.
  assert.deepEqual(r.failureDiagnosis,{schemaVersion:'pansphaira.workspace-agent/failure-diagnosis/v1',runId:p.runId,requestDigest:r.requestDigest,reason:'LOOP_FRESH_INFORMATION_DENIED',exitCode:2,actualRequests:2,actualToolActions:2,settledUsageConfirmed:false,realModelAcceptance:false});
  // The real panel DOM (not a helper projection) renders the fixed code-owned
  // German labels and the measured counts; no raw reason code, no JSON dump,
  // and no enabled retry/resume appears next to the diagnosis.
  const visible=await f.page.locator(root).innerText();
  for(const literal of ['Fehlerdiagnose (minimiert, native Projektion)','Frische Werkzeuginformation nicht bestätigt','Exit 2','Anfragen 2 · Werkzeugaktionen 2','Verbrauch nicht bestätigt — volle Reservierung bleibt erhalten'])assert.ok(visible.includes(literal),'PAN548_ACTUAL_PANEL_DIAGNOSIS_LABEL_MISSING:'+literal);
  for(const counter of ['LOOP_FRESH_INFORMATION_DENIED','{"schemaVersion"','RESULT_READY'])assert.ok(!visible.includes(counter),'PAN548_ACTUAL_PANEL_DIAGNOSIS_RAW_OR_SUCCESS_LEAK:'+counter);
  // The retained historical triple renders in the real panel DOM as explicitly
  // historical original run provenance — fixed code-owned labels, the exact
  // source digest and revision values — never as freshly verified current
  // source and never as permission to save/apply/retry. The current Scope row
  // stays a separate element and keeps showing the current context.
  for(const literal of ['Historische Laufquelle des nativen Laufs','Historische Laufquellenrevisionen des nativen Laufs',p.sourceDigest,'ERV '+p.sourceRevisions.erv+' · Human '+p.sourceRevisions.human,'ursprünglich zum Lauf aufgezeichnet; nicht aktuell verifiziert; keine Freigabe zum Speichern, Anwenden oder Wiederholen'])assert.ok(visible.includes(literal),'PAN548_ACTUAL_HISTORICAL_PROVENANCE_ROW_MISSING:'+literal);
  assert.ok((await f.page.locator(root+' [data-agent-scope="true"]').innerText()).startsWith('Scope: pan.erv'),'PAN548_CURRENT_SCOPE_ROW_MUST_STAY_SEPARATE');
  for(const label of ['Lauf abbrechen — nicht verfügbar','Lauf fortsetzen — nicht verfügbar'])assert.equal(await f.page.locator(root).getByRole('button',{name:label,exact:true}).isDisabled(),true,'PAN548_DIAGNOSIS_MUST_NOT_ENABLE_TASK_CONTROL:'+label);
  await connectedCapture(f,'desktop-native-owner-unknown-failure-diagnosis');
  await f.page.setViewportSize({width:390,height:844});await connectedCapture(f,'390-native-owner-unknown-retained-no-retry');
  await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).click();await state(f,'OUTCOME_UNCONFIRMED');
  // A second genuine read keeps the observed request binding identical — the
  // reopened run is stable, nothing re-registered or re-stamped.
  await f.flushResponses();
  const rAgain=f.responses.filter(r=>r.path.endsWith('/agent-run/read')&&r.status===200).at(-1).value;
  assert.equal(rAgain.requestDigest,r.requestDigest,'PAN548_REPEAT_READ_REQUEST_DIGEST_CHANGED');
  assert.equal(rAgain.runId,p.runId,'PAN548_REPEAT_READ_RUN_ID_CHANGED');
  await f.page.evaluate(()=>{document.body.style.zoom='2';});await connectedCapture(f,'390-zoom200-native-owner-unknown-failure-diagnosis');await f.page.evaluate(()=>{document.body.style.zoom='1';});
  await f.page.reload();await showCurrentContextDetailsUI(f.page);await f.page.locator('[id="shell.context-selection"][data-module="pan.erv"][data-state="CURRENT_CONTEXT"]').waitFor();await state(f,'OUTCOME_UNCONFIRMED');
  await f.flushResponses();
  // After a genuine reload the same retained run reopened via the automatic
  // independent native read: requestDigest/runId unchanged, budget still fully
  // retained, historical triple still the original one. The reload registered
  // a fresh current context tab; the retained historical binding belongs to
  // the ORIGINAL old tab and must not be relabeled with the new current tab.
  const reopened=f.responses.filter(r=>r.method==='GET'&&r.path.endsWith('/agent-run/read')&&r.status===200).at(-1).value;
  assert.equal(reopened.runId,p.runId,'PAN548_REOPENED_READ_NOT_THE_SAME_RUN');
  assert.equal(reopened.requestDigest,r.requestDigest,'PAN548_RELOADED_READ_REQUEST_DIGEST_CHANGED');
  assert.deepEqual(reopened.budget,retainedBudget,'PAN548_RETAINED_BUDGET_NOT_INTACT_AFTER_RELOAD');
  const currentTab=f.responses.filter(r=>r.method==='POST'&&r.path.endsWith('/context-selection')&&r.status===200).at(-1).value.context.binding;
  assert.notEqual(currentTab.tabId,p.binding.tabId,'PAN548_RELOAD_EXPECTED_A_FRESH_CURRENT_TAB');
  assert.deepEqual(reopened.binding,p.binding,'PAN548_OLD_TAB_BINDING_RELABLED_WITH_NEW_CURRENT_TAB');
  assert.equal(reopened.sourceDigest,p.sourceDigest,'PAN548_HISTORICAL_SOURCE_DIGEST_CHANGED_AFTER_RELOAD');
  assert.deepEqual(reopened.sourceRevisions,p.sourceRevisions,'PAN548_HISTORICAL_SOURCE_REVISIONS_CHANGED_AFTER_RELOAD');
  assert.ok((await f.page.locator(root).innerText()).includes('Historische Laufquelle des nativen Laufs'),'PAN548_HISTORICAL_PROVENANCE_NOT_RETAINED_AFTER_RELOAD');
  assert.equal(await f.page.locator(root).getAttribute('data-run'),p.runId);assert.equal(f.posts(),2);assert.equal(count(f,'start'),1);assert.equal(await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).isDisabled(),true);assert.deepEqual(f.errors,[]);
  // The independent post-reload native read retained the same observed
  // diagnosis and counts in the real panel; keyboard re-read stays dispatch-
  // neutral (no new start, no new model POST).
  assert.ok((await f.page.locator(root).innerText()).includes('Anfragen 2 · Werkzeugaktionen 2'),'PAN548_DIAGNOSIS_NOT_RETAINED_AFTER_RELOAD');
  await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).focus();await f.page.keyboard.press('Enter');await state(f,'OUTCOME_UNCONFIRMED');
  assert.equal(count(f,'start'),1);assert.equal(f.posts(),2);assert.equal(f.readPersisted().revision,0);
 }finally{await f.close();}
});

// RUN50: the actual browser independently reads the genuine native row while
// the SAME-ORIGIN synthetic protocol peer is held mid-request (fixture-owned
// deferred release; no fake native response, no polling, no automatic retry,
// no fabricated cancellation). A real page reload restores the same runId and
// the auto-reconcile GET observes RUNNING through the genuine strict-TLS
// transport: exact runId/requestDigest, the original admitted provenance, the
// complete held reservation, null proposal, no failureDiagnosis, no preview/
// save/retry authority and the fixed code-owned German explanatory state.
// After releasing the held peer, one fresh genuine read returns the actual
// terminal RESULT_READY with real settlement. No real product inference —
// this test is explicitly NOT LLM.
test('PUI07 actual browser independent read of the genuine running native row while the synthetic peer is held: RUNNING with full retained hold and no authority, real reload restores same runId, release -> actual terminal RESULT_READY; NOT LLM',async()=>{
 const f=await connectedFixture({holdPeer:true,maxTimeMs:25000});try{
  const before=f.business();await open(f);await selectConnectedView(f);await connect(f);const p=await boundPlan(f);
  await f.page.locator('#pan548-agent-inference-consent').check();await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await f.peerHeld;await f.flushResponses();assert.equal(f.posts(),1);assert.equal(count(f,'start'),1);
  await f.page.reload();await showCurrentContextDetailsUI(f.page);await f.page.locator('[id="shell.context-selection"][data-module="pan.erv"][data-state="CURRENT_CONTEXT"]').waitFor();
  await state(f,'RUNNING');await f.flushResponses();await showAgentTechnicalUI(f.page);
  const running=f.responses.filter(r=>r.method==='GET'&&r.path.endsWith('/agent-run/read')&&r.status===200).at(-1).value;
  assert.ok(running,'PAN548_RUNNING_INDEPENDENT_NATIVE_READ_MISSING');
  assert.equal(running.runId,p.runId,'PAN548_RUNNING_READ_NOT_THE_RESTORED_RUN');assert.equal(running.phase,'RUNNING');assert.match(running.requestDigest,/^[a-f0-9]{64}$/);
  assert.deepEqual(running.binding,p.binding,'RUNNING_READ_MUST_CARRY_THE_ORIGINAL_ADMITTED_BINDING');assert.equal(running.sourceDigest,p.sourceDigest,'RUNNING_READ_SOURCE_DIGEST_NOT_THE_ORIGINAL');assert.deepEqual(running.sourceRevisions,p.sourceRevisions,'RUNNING_READ_SOURCE_REVISIONS_NOT_THE_ORIGINAL');
  assert.equal(running.proposal,null);assert.equal(Object.hasOwn(running,'failureDiagnosis'),false,'RUNNING_MUST_CARRY_NO_FAILURE_DIAGNOSIS');
  assert.ok(running.budget.model.committedUnits>0&&running.budget.model.consumedUnits===0&&running.budget.runtime.consumedUnits===0,'RUNNING_READ_LOST_THE_FULL_HELD_RESERVATION');
  const runningBudget=running.budget;
  const visible=await f.page.locator(root).innerText();
  for(const literal of ['kein abgeschlossenes Ergebnis','kein Speichern','keine Anwenden-Freigabe','Native Laufausführung','Aktuell beobachtet'])assert.ok(visible.includes(literal),'PAN548_RUNNING_GERMAN_STATE_MISSING:'+literal);
  assert.ok(!visible.includes('Fehlerdiagnose')&&!visible.includes('RESULT_READY'),'PAN548_RUNNING_LEAKS_DIAGNOSIS_OR_SUCCESS');
  for(const label of ['Lauf abbrechen — nicht verfügbar','Lauf fortsetzen — nicht verfügbar'])assert.equal(await f.page.locator(root).getByRole('button',{name:label,exact:true}).isDisabled(),true,'PAN548_RUNNING_MUST_NOT_ENABLE_TASK_CONTROL:'+label);
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).isDisabled(),true,'PAN548_RUNNING_MUST_NOT_ENABLE_PREVIEW_OR_SAVE');
  assert.equal(await f.page.locator(root).getAttribute('data-run'),p.runId);
  assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);
  await connectedCapture(f,'desktop-native-owner-running-held-peer');
  f.releasePeer();
  await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).click();await state(f,'RESULT_READY');await f.flushResponses();
  const terminal=f.responses.filter(r=>r.method==='GET'&&r.path.endsWith('/agent-run/read')&&r.status===200).at(-1).value;
  assert.equal(terminal.runId,p.runId);assert.equal(terminal.phase,'RESULT_READY');assert.equal(terminal.requestDigest,running.requestDigest,'PAN548_TERMINAL_READ_REQUEST_DIGEST_CHANGED');
  assert.ok(terminal.proposal!==null&&terminal.budget.model.consumedUnits>0,'PAN548_RUNNING_TO_RESULT_READY_DID_NOT_SETTLE_FOR_REAL');
  // Ledger semantics (demo/runtime/atomic-resource-budget.mjs:98): the
  // snapshot's committedUnits is the FULL hold while RESERVED/UNKNOWN_USAGE
  // and, after the single reservation settles for real, equals exactly the
  // actually consumed units — the unused reservation returns to remaining.
  // A monotonic committed across settlement is NOT a ledger invariant; this
  // asserts exact conservation at the real fixture values instead: the two
  // held-then-completed synthetic POSTs each carry prompt_tokens:2 and
  // completion_tokens:3, so exactly 10 model units and 2 runtime units settle
  // against this one reservation, and the totals are unchanged.
  const reservedModel=runningBudget.model.committedUnits,reservedRuntime=runningBudget.runtime.committedUnits;
  assert.equal(runningBudget.reservations,1,'PAN548_HELD_READ_RESERVATION_COUNT_NOT_ONE');
  assert.equal(terminal.budget.reservations,1,'PAN548_RESERVATION_COUNT_CHANGED_ACROSS_SETTLEMENT');
  assert.equal(terminal.budget.model.committedUnits,terminal.budget.model.consumedUnits,'PAN548_SETTLED_COMMITTED_MUST_EQUAL_REAL_CONSUMED');
  assert.equal(terminal.budget.model.consumedUnits,10,'PAN548_SETTLED_MODEL_UNITS_NOT_THE_COUNTED_SYNTHETIC_USAGE');
  assert.ok(terminal.budget.model.consumedUnits<=reservedModel,'PAN548_SETTLED_USAGE_EXCEEDED_THE_HELD_RESERVATION');
  assert.ok(terminal.budget.model.committedUnits<reservedModel,'PAN548_UNUSED_MODEL_RESERVATION_WAS_NOT_RETURNED');
  assert.equal(terminal.budget.model.budgetUnits,runningBudget.model.budgetUnits,'PAN548_TOTAL_MODEL_BUDGET_CHANGED');
  assert.equal(terminal.budget.model.budgetUnits,terminal.budget.model.committedUnits+terminal.budget.model.remainingUnits,'PAN548_MODEL_TOTAL_NOT_COMMITTED_PLUS_REMAINING');
  assert.equal(terminal.budget.model.remainingUnits,runningBudget.model.remainingUnits+(reservedModel-terminal.budget.model.committedUnits),'PAN548_MODEL_REMAINING_DID_NOT_RETURN_THE_UNUSED_HOLD');
  assert.equal(terminal.budget.runtime.committedUnits,terminal.budget.runtime.consumedUnits,'PAN548_SETTLED_RUNTIME_COMMITTED_MUST_EQUAL_REAL_POSTS');
  assert.equal(terminal.budget.runtime.consumedUnits,2,'PAN548_RUNTIME_UNITS_NOT_THE_TWO_ACTUAL_MODEL_POSTS');
  assert.ok(terminal.budget.runtime.committedUnits<reservedRuntime,'PAN548_UNUSED_RUNTIME_RESERVATION_WAS_NOT_RETURNED');
  assert.equal(terminal.budget.runtime.budgetUnits,runningBudget.runtime.budgetUnits,'PAN548_TOTAL_RUNTIME_BUDGET_CHANGED');
  assert.equal(terminal.budget.runtime.budgetUnits,terminal.budget.runtime.committedUnits+terminal.budget.runtime.remainingUnits,'PAN548_RUNTIME_TOTAL_NOT_COMMITTED_PLUS_REMAINING');
  assert.deepEqual(terminal.binding,p.binding,'PAN548_TERMINAL_PROVENANCE_BINDING_CHANGED');assert.equal(terminal.sourceDigest,p.sourceDigest,'PAN548_TERMINAL_PROVENANCE_SOURCE_DIGEST_CHANGED');assert.deepEqual(terminal.sourceRevisions,p.sourceRevisions,'PAN548_TERMINAL_PROVENANCE_REVISIONS_CHANGED');
  assert.equal(f.posts(),2);assert.equal(count(f,'start'),1);assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);
  await connectedCapture(f,'desktop-native-owner-running-released-result-ready');
  assert.deepEqual(f.errors,[]);
 }finally{try{f.releasePeer();}catch{/* gate already open or fixture owned */}await f.close();}
});

// RUN54/RUN55: the same still-open shell reads its own held start. The RUN50
// test obtained genuine RUNNING only through a reload; here the manual
// independent AGENT_READ (panel: read.disabled/reconcile() use a separate
// `reading` flag) is genuinely concurrent: RUN55 removed the lower-layer
// serialization that made every moduleViewRequest — including AGENT_READ and
// the CATALOG readback of resultOf — queue behind the outstanding AGENT_START.
// Only the closed read-only pair AGENT_READ/CATALOG is independent of the
// effect queue now; writes/CAS/plan/start stay serialized. RUN56: the START
// transport is operation-aligned and bounded — AGENT_START carries the
// admitted offer's own finite run limit (maxTimeMs 25000 here, the cap the
// native server is itself bound to settle the reply within) plus one 5000ms
// round-trip margin; every other operation, including the independent
// AGENT_READ, keeps the unchanged global 5000ms window. So the start's own
// reply can land after a genuine held window: the RUNNING
// evidence is a panel-scoped screenshot plus the completed DTO recorded with
// the nativeNetwork timings, and the heavy geometry/full-page capture runs on
// the finished post-release evidence. An in-flight
// dispatch keeps `busy`/`dispatching` while the read runs concurrently; a
// late RUNNING never regresses an applied terminal projection via
// terminalRunId. No reload, no polling framework, no fake native reply: the
// same-origin synthetic framing peer holds exactly the first model POST,
// every observed RUNNING/RESULT_READY/OUTCOME_UNCONFIRMED comes from the real
// server-owned ledger through the genuine strict-TLS transport. This is
// explicitly NOT LLM evidence.
async function waitForActualV1548(probe,label,timeoutMs=10000){const deadline=Date.now()+timeoutMs;for(;;){if(probe())return;if(Date.now()>deadline)throw Error('PAN548_IN_FLIGHT_ACTUAL_WAIT_TIMEOUT:'+label);await new Promise(r=>setTimeout(r,25));}}
const getReadsV1548=f=>f.responses.filter(r=>r.method==='GET'&&r.path.endsWith('/agent-run/read'));
test('PUI07 same-shell genuine in-flight status without reload: the manual independent AGENT_READ observes RUNNING while the exact one-time start is still held, the read clears neither the dispatch guard nor any authority, the still-held in-flight start itself settles to RESULT_READY with exact conservation; NOT LLM',async()=>{
 const f=await connectedFixture({holdPeer:true,maxTimeMs:25000});try{
  const before=f.business();await open(f);await selectConnectedView(f);await connect(f);const p=await boundPlan(f);
  await f.page.locator('#pan548-agent-inference-consent').check();
  // The transport alignment below is bound to exactly this admitted offer:
  // the server-issued finite run limit is the only source of the START
  // transport extension (30000ms here: 25000ms grant + one 5000ms margin).
  assert.equal(p.inferenceConsentOffer.limits.maxTimeMs,25000,'PAN548_START_TRANSPORT_NOT_BOUND_TO_THE_ADMITTED_OFFER_LIMIT');
  const start=f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true});
  // Retained real DOM identity of the actual start control: resultOf clears
  // the plan on any applied read, so update() renames the button to the
  // disabled synthetic label — the label is safety semantics, not identity,
  // and every in-flight/terminal guard below stays asserted on THIS element.
  const startControl=await start.elementHandle();
  const readButton=f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true});
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-in-flight'),'false','NO_DISPATCH_MAY_BE_CLAIMED_BEFORE_THE_START_CLICK');
  await start.click();
  await f.peerHeld;await f.flushResponses();
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'DISPATCHING');assert.equal(await f.page.locator(root).getAttribute('data-dispatch-in-flight'),'true');
  assert.equal(f.posts(),1);assert.equal(count(f,'start'),1);assert.equal(getReadsV1548(f).length,0);
  // Same still-open shell, no reload, no polling: the existing read-only action.
  assert.equal(await readButton.isDisabled(),false,'PAN548_IN_FLIGHT_READ_MUST_BE_INDEPENDENT');
  await showAgentTechnicalUI(f.page);await readButton.click();await state(f,'RUNNING');await f.flushResponses();
  const running=getReadsV1548(f).filter(r=>r.status===200).at(-1)?.value;
  assert.ok(running,'PAN548_SAME_SHELL_IN_FLIGHT_RUNNING_READ_MISSING');
  assert.equal(running.runId,p.runId,'PAN548_SAME_SHELL_RUNNING_READ_NOT_THE_STARTED_RUN');assert.equal(running.phase,'RUNNING');assert.match(running.requestDigest,/^[a-f0-9]{64}$/);
  assert.deepEqual(running.binding,p.binding,'SAME_SHELL_RUNNING_READ_MUST_CARRY_THE_ORIGINAL_ADMITTED_BINDING');assert.equal(running.sourceDigest,p.sourceDigest,'SAME_SHELL_RUNNING_READ_SOURCE_DIGEST_NOT_THE_ORIGINAL');assert.deepEqual(running.sourceRevisions,p.sourceRevisions,'SAME_SHELL_RUNNING_READ_SOURCE_REVISIONS_NOT_THE_ORIGINAL');
  assert.equal(running.proposal,null);assert.equal(Object.hasOwn(running,'failureDiagnosis'),false,'SAME_SHELL_RUNNING_MUST_CARRY_NO_FAILURE_DIAGNOSIS');
  assert.ok(running.budget.model.committedUnits>0&&running.budget.model.consumedUnits===0&&running.budget.runtime.consumedUnits===0,'SAME_SHELL_RUNNING_READ_LOST_THE_FULL_HELD_RESERVATION');
  const runningBudget=running.budget;
  const visible=await f.page.locator(root).innerText();
  for(const literal of ['kein abgeschlossenes Ergebnis','kein Speichern','keine Anwenden-Freigabe','Native Laufausführung','Aktuell beobachtet'])assert.ok(visible.includes(literal),'PAN548_SAME_SHELL_RUNNING_GERMAN_STATE_MISSING:'+literal);
  assert.ok(!visible.includes('Fehlerdiagnose')&&!visible.includes('RESULT_READY'),'PAN548_SAME_SHELL_RUNNING_LEAKS_DIAGNOSIS_OR_SUCCESS');
  // The independent read clears neither the outstanding-dispatch guard nor any
  // authority: planning/input/start/preview/cancel/resume all stay guarded.
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-in-flight'),'true','PAN548_INDEPENDENT_READ_MUST_NOT_CLEAR_THE_OUTSTANDING_DISPATCH');
  assert.equal(await startControl.evaluate(e=>e.disabled),true,'PAN548_IN_FLIGHT_READ_MUST_NOT_ENABLE_A_DUPLICATE_START');
  await startControl.evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  assert.equal(count(f,'start'),1,'PAN548_FORCED_START_CLICK_DURING_HELD_DISPATCH_MUST_NOT_DUPLICATE');
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).isDisabled(),true,'PAN548_IN_FLIGHT_DISPATCH_MUST_KEEP_PLANNING_GUARDED');
  assert.equal(await f.page.locator('#pan548-agent-intent').isDisabled(),true,'PAN548_IN_FLIGHT_DISPATCH_MUST_KEEP_INPUT_GUARDED');
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).isDisabled(),true,'PAN548_SAME_SHELL_RUNNING_MUST_NOT_ENABLE_PREVIEW_OR_SAVE');
  for(const label of ['Lauf abbrechen — nicht verfügbar','Lauf fortsetzen — nicht verfügbar'])assert.equal(await f.page.locator(root).getByRole('button',{name:label,exact:true}).isDisabled(),true,'PAN548_SAME_SHELL_RUNNING_MUST_NOT_ENABLE_TASK_CONTROL:'+label);
  assert.equal(await f.page.locator(root).getAttribute('data-run'),p.runId);
  assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);
  // Held-window evidence: the actual RUNNING panel screenshot and the
  // completed read DTO with the server-observed nativeNetwork timings stay
  // inside the held window; the full-page/geometry capture runs after the
  // release on the finished evidence. The start's own reply is no longer
  // raced against the global 5000ms window: its transport is aligned to the
  // admitted offer's finite run cap (see the RUN56 note above), so the
  // terminal can arrive on this start's own response after the release.
  await f.page.locator(root).screenshot({path:join(evidence(),'desktop-native-owner-same-shell-running-held-peer.png')});
  writeFileSync(join(evidence(),'desktop-native-owner-same-shell-running-held-peer.json'),JSON.stringify({running,readTransportTimeoutMs:5000,startTransportTimeoutMs:30000,startBoundFromOfferMaxTimeMs:25000,honestWindow:'the AGENT_READ keeps the unchanged 5000ms transport; only the admitted one-time AGENT_START carries the offer-aligned bounded window (native server cap 25000ms + one 5000ms round-trip margin), so after the release its own reply — not a re-read or reload — delivers this shell the terminal projection',heldPeerPosts:f.posts(),nativeNetwork:f.nativeNetwork},null,2)+'\n');
  // A second manual read while still held: genuine RUNNING again (nonterminal,
  // stable binding), still exactly one start and one model POST — the read is
  // read-only and never dispatches.
  const firstRequestDigest=running.requestDigest,readsBefore=getReadsV1548(f).length;
  await readButton.click();
  await waitForActualV1548(()=>getReadsV1548(f).length>readsBefore,'SECOND_SAME_SHELL_IN_FLIGHT_READ');await f.flushResponses();
  await f.page.waitForFunction(()=>document.querySelector('[id=\"shell.agent-panel\"]')?.getAttribute('data-state')==='RUNNING');
  const runningAgain=getReadsV1548(f).filter(r=>r.status===200).at(-1).value;
  assert.equal(runningAgain.phase,'RUNNING');assert.equal(runningAgain.runId,p.runId);assert.equal(runningAgain.requestDigest,firstRequestDigest,'PAN548_REPEAT_IN_FLIGHT_READ_REQUEST_DIGEST_CHANGED');
  assert.equal(count(f,'start'),1);assert.equal(f.posts(),1);
  // Release: the SAME still-held in-flight AGENT_START itself delivers the
  // authoritative terminal projection to this shell — no reload, no re-read.
  const readsAtRelease=getReadsV1548(f).length;
  f.releasePeer();
  await state(f,'RESULT_READY');await f.flushResponses();
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-in-flight'),'false');
  // Timing-bound proof that the terminal arrived on this start's OWN reply:
  // the server observed the start request finish with 200, and no new read
  // request was issued between the release and RESULT_READY — a re-read or
  // reload relabel is structurally excluded here.
  assert.ok(f.nativeNetwork.some(r=>r.path.endsWith('/agent-run/start')&&r.status===200&&Number.isSafeInteger(r.finishedAt)),'PAN548_IN_FLIGHT_START_REPLY_MUST_HAVE_FINISHED_AT_THE_SERVER');
  assert.equal(getReadsV1548(f).length,readsAtRelease,'PAN548_IN_FLIGHT_TERMINAL_MUST_ARRIVE_ON_THE_START_REPLY_NOT_A_RE_READ');
  const terminal=f.responses.filter(r=>r.path.endsWith('/agent-run/start')&&r.status===200).at(-1).value;
  assert.equal(terminal.runId,p.runId);assert.equal(terminal.phase,'RESULT_READY');assert.equal(terminal.requestDigest,firstRequestDigest,'PAN548_IN_FLIGHT_TERMINAL_REQUEST_DIGEST_CHANGED');
  assert.ok(terminal.proposal!==null&&terminal.budget.model.consumedUnits>0,'PAN548_IN_FLIGHT_START_DID_NOT_SETTLE_FOR_REAL');
  // Exact ledger conservation at the real fixture values (identical semantics
  // to the RUN50 reload case): the two held-then-completed synthetic POSTs
  // each carry prompt_tokens:2 and completion_tokens:3, so exactly 10 model
  // units and 2 runtime units settle against this one reservation.
  const reservedModel=runningBudget.model.committedUnits,reservedRuntime=runningBudget.runtime.committedUnits;
  assert.equal(runningBudget.reservations,1,'PAN548_SAME_SHELL_HELD_READ_RESERVATION_COUNT_NOT_ONE');
  assert.equal(terminal.budget.reservations,1,'PAN548_RESERVATION_COUNT_CHANGED_ACROSS_IN_FLIGHT_SETTLEMENT');
  assert.equal(terminal.budget.model.committedUnits,terminal.budget.model.consumedUnits,'PAN548_IN_FLIGHT_SETTLED_COMMITTED_MUST_EQUAL_REAL_CONSUMED');
  assert.equal(terminal.budget.model.consumedUnits,10,'PAN548_IN_FLIGHT_SETTLED_MODEL_UNITS_NOT_THE_COUNTED_SYNTHETIC_USAGE');
  assert.ok(terminal.budget.model.consumedUnits<=reservedModel,'PAN548_IN_FLIGHT_SETTLED_USAGE_EXCEEDED_THE_HELD_RESERVATION');
  assert.ok(terminal.budget.model.committedUnits<reservedModel,'PAN548_IN_FLIGHT_UNUSED_MODEL_RESERVATION_WAS_NOT_RETURNED');
  assert.equal(terminal.budget.model.budgetUnits,runningBudget.model.budgetUnits,'PAN548_IN_FLIGHT_TOTAL_MODEL_BUDGET_CHANGED');
  assert.equal(terminal.budget.model.budgetUnits,terminal.budget.model.committedUnits+terminal.budget.model.remainingUnits,'PAN548_IN_FLIGHT_MODEL_TOTAL_NOT_COMMITTED_PLUS_REMAINING');
  assert.equal(terminal.budget.model.remainingUnits,runningBudget.model.remainingUnits+(reservedModel-terminal.budget.model.committedUnits),'PAN548_IN_FLIGHT_MODEL_REMAINING_DID_NOT_RETURN_THE_UNUSED_HOLD');
  assert.equal(terminal.budget.runtime.committedUnits,terminal.budget.runtime.consumedUnits,'PAN548_IN_FLIGHT_SETTLED_RUNTIME_COMMITTED_MUST_EQUAL_REAL_POSTS');
  assert.equal(terminal.budget.runtime.committedUnits,2,'PAN548_IN_FLIGHT_RUNTIME_UNITS_NOT_THE_TWO_ACTUAL_MODEL_POSTS');
  assert.ok(terminal.budget.runtime.committedUnits<reservedRuntime,'PAN548_IN_FLIGHT_UNUSED_RUNTIME_RESERVATION_WAS_NOT_RETURNED');
  assert.equal(terminal.budget.runtime.budgetUnits,runningBudget.runtime.budgetUnits,'PAN548_IN_FLIGHT_TOTAL_RUNTIME_BUDGET_CHANGED');
  assert.equal(terminal.budget.runtime.budgetUnits,terminal.budget.runtime.committedUnits+terminal.budget.runtime.remainingUnits,'PAN548_IN_FLIGHT_RUNTIME_TOTAL_NOT_COMMITTED_PLUS_REMAINING');
  assert.deepEqual(terminal.binding,p.binding,'PAN548_IN_FLIGHT_TERMINAL_PROVENANCE_BINDING_CHANGED');assert.equal(terminal.sourceDigest,p.sourceDigest,'PAN548_IN_FLIGHT_TERMINAL_PROVENANCE_SOURCE_DIGEST_CHANGED');assert.deepEqual(terminal.sourceRevisions,p.sourceRevisions,'PAN548_IN_FLIGHT_TERMINAL_PROVENANCE_REVISIONS_CHANGED');
  assert.equal(f.posts(),2);assert.equal(count(f,'start'),1);assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);
  // Terminal authority appears only now, and only as the separate existing
  // 546 preview — no save and no business effect in this test.
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).isDisabled(),false,'PAN548_TERMINAL_PROPOSAL_MUST_BE_INDEPENDENTLY_PREVIEWABLE');
  await preview(f);assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);
  await connectedCapture(f,'desktop-native-owner-same-shell-release-result-ready');
  assert.deepEqual(f.errors,[]);
 }finally{try{f.releasePeer();}catch{/* gate already open or fixture owned */}await f.close();}
});

// RUN54 negative: an actual terminal failure of the held start must never
// leave the same shell showing the earlier genuine RUNNING observation. The
// in-flight start settles to OUTCOME_UNCONFIRMED with the real minimized
// diagnosis, the terminal projection is authoritative (a later read stays
// terminal), and no retry/replay authority appears.
test('PUI07 same-shell in-flight RUNNING never survives an actual terminal failure: the held start with tampered feedback settles the same shell to OUTCOME_UNCONFIRMED with the genuine diagnosis, no stale RUNNING, no retry; the fresh read stays terminal with the unchanged request binding; NOT LLM',async()=>{
 const f=await connectedFixture({holdPeer:true,unknown:true,maxTimeMs:25000});try{
  const before=f.business();await open(f);await selectConnectedView(f);await connect(f);const p=await boundPlan(f);
  await f.page.locator('#pan548-agent-inference-consent').check();
  const start=f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true});
  // Retained real DOM identity (the applied RUNNING read renames the button
  // to the disabled synthetic label; identity assertions stay element-bound).
  const startControl=await start.elementHandle();
  const readButton=f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true});
  await start.click();await f.peerHeld;await f.flushResponses();
  assert.equal(await readButton.isDisabled(),false,'PAN548_HELD_FAILURE_CASE_READ_MUST_BE_INDEPENDENT');
  await readButton.click();await state(f,'RUNNING');await f.flushResponses();
  const running=getReadsV1548(f).filter(r=>r.status===200).at(-1).value;
  assert.equal(running.phase,'RUNNING');assert.equal(running.runId,p.runId);assert.equal(running.proposal,null);
  assert.ok(running.budget.model.committedUnits>0&&running.budget.model.consumedUnits===0&&running.budget.runtime.consumedUnits===0,'PAN548_HELD_FAILURE_RUNNING_READ_LOST_THE_FULL_HELD_RESERVATION');
  assert.ok((await f.page.locator(root).innerText()).includes('Aktuell beobachtet'),'PAN548_HELD_FAILURE_INITIAL_RUNNING_ROW_MISSING');
  assert.equal(await startControl.evaluate(e=>e.disabled),true);assert.equal(await f.page.locator(root).getAttribute('data-dispatch-in-flight'),'true');
  // Held-window evidence (see the positive test): only the actual RUNNING
  // panel screenshot inside; the finished terminal evidence is captured below.
  await f.page.locator(root).screenshot({path:join(evidence(),'desktop-native-owner-same-shell-running-held-peer-unknown-run.png')});
  const readsAtReleaseV1548=getReadsV1548(f).length;
  f.releasePeer();
  // The genuine terminal failure of the SAME in-flight start arrives here;
  // terminalRunId makes it authoritative over the earlier RUNNING row.
  await state(f,'OUTCOME_UNCONFIRMED');await f.flushResponses();
  // This OUTCOME_UNCONFIRMED is the start's OWN finished 200 reply (the
  // offer-aligned bounded START transport, not a transport abort): the server
  // observed the start finish with 200 and no new read was issued after the
  // release, so the terminal dereference below is not an absent-response guess.
  assert.ok(f.nativeNetwork.some(r=>r.path.endsWith('/agent-run/start')&&r.status===200&&Number.isSafeInteger(r.finishedAt)),'PAN548_HELD_FAILURE_START_REPLY_MUST_HAVE_FINISHED_AT_THE_SERVER');
  assert.equal(getReadsV1548(f).length,readsAtReleaseV1548,'PAN548_HELD_FAILURE_TERMINAL_MUST_ARRIVE_ON_THE_START_REPLY_NOT_A_RE_READ');
  const terminal=f.responses.filter(r=>r.path.endsWith('/agent-run/start')&&r.status===200).at(-1).value;
  assert.ok(terminal,'PAN548_HELD_FAILURE_START_200_REPLY_MISSING');
  assert.equal(terminal.phase,'OUTCOME_UNCONFIRMED');assert.equal(terminal.runId,p.runId);assert.equal(terminal.proposal,null);
  assert.deepEqual(terminal.failureDiagnosis,{schemaVersion:'pansphaira.workspace-agent/failure-diagnosis/v1',runId:p.runId,requestDigest:terminal.requestDigest,reason:'LOOP_FRESH_INFORMATION_DENIED',exitCode:2,actualRequests:2,actualToolActions:2,settledUsageConfirmed:false,realModelAcceptance:false},'PAN548_IN_FLIGHT_TERMINAL_FAILURE_DIAGNOSIS_NOT_GENUINE');
  assert.ok(terminal.budget.model.committedUnits>0&&terminal.budget.model.consumedUnits===0,'PAN548_TERMINAL_FAILURE_LOST_THE_RETAINED_RESERVATION');
  const failed=await f.page.locator(root).innerText();
  for(const literal of ['Fehlerdiagnose (minimiert, native Projektion)','Frische Werkzeuginformation nicht bestätigt','Exit 2','Anfragen 2 · Werkzeugaktionen 2','Verbrauch nicht bestätigt — volle Reservierung bleibt erhalten'])assert.ok(failed.includes(literal),'PAN548_TERMINAL_FAILURE_DIAGNOSIS_ROW_MISSING:'+literal);
  for(const stale of ['Native Laufausführung','Aktuell beobachtet','RESULT_READY'])assert.ok(!failed.includes(stale),'PAN548_STALE_RUNNING_OR_SUCCESS_AFTER_TERMINAL_FAILURE:'+stale);
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-in-flight'),'false');
  assert.equal(await startControl.evaluate(e=>e.disabled),true,'PAN548_TERMINAL_FAILURE_MUST_NOT_ENABLE_START_RETRY');
  await startControl.evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  assert.equal(count(f,'start'),1,'PAN548_TERMINAL_FAILURE_FORCED_CLICK_MUST_NOT_REPLAY_START');assert.equal(f.posts(),2);
  // A fresh independent read after the terminal projection stays terminal with
  // the unchanged request binding — only RUNNING observations are dropped, the
  // authoritative terminal state is re-confirmed, never masked.
  const readsBefore=getReadsV1548(f).length;
  await readButton.click();
  await waitForActualV1548(()=>getReadsV1548(f).length>readsBefore,'POST_TERMINAL_FAILURE_READ');await f.flushResponses();
  await state(f,'OUTCOME_UNCONFIRMED');
  const afterRead=getReadsV1548(f).filter(r=>r.status===200).at(-1).value;
  assert.equal(afterRead.phase,'OUTCOME_UNCONFIRMED');assert.equal(afterRead.requestDigest,terminal.requestDigest,'PAN548_POST_TERMINAL_FAILURE_READ_REQUEST_DIGEST_CHANGED');assert.equal(afterRead.runId,p.runId);
  assert.equal(count(f,'start'),1);assert.equal(f.posts(),2);assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);assert.deepEqual(f.errors,[]);
  await connectedCapture(f,'desktop-native-owner-same-shell-terminal-failure-no-stale-running');
 }finally{try{f.releasePeer();}catch{/* gate already open or fixture owned */}await f.close();}
});

// RUN54/RUN57 retirement barrier, corrected milestone order: while the same
// shell shows a genuine in-flight RUNNING, navigating away retires the bound
// context IMMEDIATELY — the shared owner synchronously invalidates and clears
// to the unbound UPDATING_CONTEXT pending state (context-selection-v1.ts
// bind(): invalidate(); pending(..., true)), and the panel re-renders at a
// new serial as CURRENT_SCOPE with no run, no facts and no in-flight claim.
// The NEW native setup binding is effect-queue serialized BEHIND the still-
// held admitted START, so waiting here for pan.setup CURRENT_CONTEXT while
// the run is still held waits on the wrong milestone — with the RUN56
// operation-specific START transport (grant cap + 5000ms margin = 30s) there
// is no accidental 5000ms abort that would unblock that queue. The case
// therefore asserts the real retirement BEFORE any release, releases while
// the START is genuinely still held and inside the grant's own 25000ms time
// bound (recorded from the gateway's own receivedAt/finishedAt/status events
// plus the actual release timestamp), proves the late reply was a real,
// timely RESULT_READY 200 that resurrects nothing on the retired serial, and
// only THEN awaits the queued genuine setup rebind. The SAME retained read
// control is disabled and actually visible during the unbound retirement —
// hidden only once the genuine setup context has bound, not before. Heavy
// full-page captures run after the release; nothing waits for a timeout.
// RUN58: the retained start control's identity/cardinality is asserted on the
// real DOM node itself, not on the bound accessible label — clearing the plan
// at retirement deliberately rewrites that SAME button's textContent to the
// closed synthetic label (workspace-agent-panel-v1.ts update()), so the old
// bound-label role lookup finding 0 was invalid test semantics, not a
// duplicated or missing control. The expected cleared label is asserted
// separately from node identity.
test('PUI07 context retirement during a same-shell in-flight RUNNING: the retired shell keeps CURRENT_SCOPE with no fake RUNNING and the still-held late start response resurrects nothing; NOT LLM',async()=>{
 const f=await connectedFixture({holdPeer:true,maxTimeMs:25000});try{
  const before=f.business();await open(f);await selectConnectedView(f);await connect(f);const p=await boundPlan(f);
  await f.page.locator('#pan548-agent-inference-consent').check();
  // RUN60: test-local observer around the ORIGINAL window.fetch, installed
  // before the start click. It awaits the genuine browser fetch and, for the
  // exact same-origin POST /workspace/agent-run/start 200 only, clone()-drains
  // the ORIGINAL Response body once, independently of the retired product's
  // consumption. The actual RUN59 diagnostic proved: the Playwright response
  // entry arrives with status 200, yet the shared fixture's r.json()
  // (browser-fixture.mjs:44) stays pending forever, because the retired serial
  // returns at context-selection-v1.ts:232 BEFORE response.json() at :234 and
  // deliberately never consumes the late body — so no page-side consumer ever
  // drains the real bytes. The RUN56 buffered-read wrapper is the established
  // precedent for exactly this page-side clone() drain. No second transport,
  // no route.fetch, no rerouting, no fabricated DTO: one request, original
  // status/headers/bytes; the observer returns the ORIGINAL Response object
  // untouched and grants the retired product no authority whatsoever.
  // RUN61: the request-method match is now enforced from the ACTUAL request
  // identity (init.method, or a Request input's method) so the documented
  // "exact POST only" claim is real, not implied by the path alone. Observer
  // contract: failure is present from installation on, null = no error caught,
  // a string = the actual drain/parse error (asserted against null below, so
  // any caught error or a broken contract fails closed).
  await f.page.evaluate(()=>{const original=window.fetch;window.__pan548RetireStartObserver548={drained:false,failure:null,value:null};
   window.fetch=async(input,init)=>{const response=await original(input,init);const b=window.__pan548RetireStartObserver548;
    try{const requestMethod=String(init?.method??(typeof input!=='string'&&input?.method)??'GET').toUpperCase();
     if(!b.drained&&requestMethod==='POST'&&response.status===200&&new URL(response.url).origin===location.origin&&new URL(response.url).pathname.endsWith('/workspace/agent-run/start')){const text=await response.clone().text();b.value=JSON.parse(text);b.drained=true;}}
    catch(error){b.failure=String(error?.message??error);}
    return response;};});
  await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await f.peerHeld;await f.flushResponses();
  const readButton=f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true});
  // Retained real DOM identities of the actual controls: once the genuine
  // setup context binds, the compose form is hidden, so an accessible role
  // lookup can no longer see the read control; the retired/disabled/hidden
  // state must be asserted on the elements themselves, not on a nonexistent
  // accessible locator.
  const startControl=await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).elementHandle();
  const readControl=await readButton.elementHandle();
  const reviewControl=await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).elementHandle();
  await readButton.click();await state(f,'RUNNING');await f.flushResponses();
  assert.ok((await f.page.locator(root).innerText()).includes('Aktuell beobachtet'),'PAN548_RETIRE_CASE_IN_FLIGHT_RUNNING_MISSING');
  // The admitted START is genuinely held at the gateway: received, not
  // finished, not closed. This is the original-event baseline for the
  // release-timing evidence below.
  const startEntriesV157=()=>f.nativeNetwork.filter(r=>r.path.endsWith('/agent-run/start'));
  const admitted=()=>startEntriesV157().at(-1);
  const admittedAtMs=admitted()?.receivedAt;
  assert.ok(Number.isSafeInteger(admittedAtMs)&&!Number.isSafeInteger(admitted()?.finishedAt)&&admitted()?.closedAt===undefined,'PAN548_RETIREMENT_START_NOT_GENUINELY_HELD_AT_THE_GATEWAY');
  // Minimal held window: the RUNNING panel evidence inside the window is the
  // actual panel screenshot; every heavyweight full-page/geometry capture
  // runs only after the release, so no helper wait burns the held window.
  await f.page.locator(root).screenshot({path:join(evidence(),'desktop-native-owner-same-shell-running-before-retirement.png')});
  await f.page.getByRole('button',{name:'Einrichtung und Betriebszustand',exact:true}).click();
  // Actual new navigation event, asserted on the real milestone that MUST
  // already have happened while the START is still held: the bound context is
  // retired into the unbound UPDATING_CONTEXT pending state, and NO new
  // confirmed native context is claimed yet (module/selection cleared).
  const contextSelection=f.page.locator('[id=\"shell.context-selection\"]');
  await f.page.waitForFunction(()=>document.getElementById('shell.context-selection')?.dataset.state==='UPDATING_CONTEXT');
  assert.deepEqual(await contextSelection.evaluate(e=>({state:e.dataset.state,module:e.dataset.module,selection:e.dataset.selection})),{state:'UPDATING_CONTEXT',module:'',selection:''},'PAN548_UNBOUND_RETIREMENT_CLAIMS_A_CONFIRMED_CONTEXT');
  assert.ok((await contextSelection.innerText()).includes('Nativen Seitenkontext prüfen'),'PAN548_UNBOUND_RETIREMENT_PENDING_MESSAGE_MISSING');
  await state(f,'CURRENT_SCOPE');
  const retired=await f.page.locator(root).innerText();
  for(const stale of ['Native Laufausführung','Aktuell beobachtet','RESULT_READY','Fehlerdiagnose','Historische Laufquelle',p.runId,p.planDigest])assert.ok(!retired.includes(stale),'PAN548_RETIREMENT_LEAKS_OLD_RUN_STATE:'+stale);
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'CURRENT_SCOPE');
  assert.equal(await f.page.locator(root).getAttribute('data-run'),'none');assert.equal(await f.page.locator(root).getAttribute('data-dispatch-in-flight'),'false');assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false');
  assert.ok(retired.includes('Kontext nicht aktuell bestätigt — keine Ausgabe alter Quellen.'),'PAN548_UNBOUND_RETIREMENT_SCOPE_ROW_NOT_SOURCE_BOUND');
  // The SAME retained controls during the unbound retirement: still exactly
  // one read/start/preview element each, all actually disabled — no stale
  // read, start or preview authority — yet the compose form is only hidden
  // once the genuine setup context has bound, so they are still ACTUALLY
  // VISIBLE here, not hidden early.
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).count(),1,'PAN548_RETIREMENT_DUPLICATED_THE_RETAINED_READ_CONTROL');
  // The start control's accessible name is NOT its identity: the retirement
  // clears the plan, and update() (workspace-agent-panel-v1.ts) deliberately
  // rewrites the SAME retained start button's label to the closed synthetic
  // label — the bound-label accessible lookup legitimately finds 0 here.
  // Identity/cardinality are therefore asserted on the retained real DOM node
  // itself: still attached inside the actual panel, and the panel's real
  // buttons contain exactly one button carrying either closed start label
  // (the only two labels update() can ever write for this control), and that
  // button IS the retained node. A re-created duplicate (either label) or a
  // dropped node fails closed. The expected cleared label is verified
  // separately from identity.
  const retiredStartDomV158=await startControl.evaluate(b=>{const panel=document.getElementById('shell.agent-panel'),startLabels=['Genau diesen gebundenen Lauf einmalig starten','Genau diesen synthetischen Lauf starten'],buttons=panel?[...panel.querySelectorAll('button')]:[],startButtons=buttons.filter(x=>startLabels.includes(x.textContent??''));return{connected:b.isConnected,inPanel:panel?.contains(b)===true,startButtonCount:startButtons.length,isTheRetainedNode:startButtons.length===1&&startButtons[0]===b,text:b.textContent??''};});
  assert.equal(retiredStartDomV158.connected,true,'PAN548_RETIRED_START_CONTROL_MUST_STAY_ATTACHED');
  assert.equal(retiredStartDomV158.inPanel,true,'PAN548_RETIRED_START_CONTROL_LEFT_THE_PANEL');
  assert.equal(retiredStartDomV158.startButtonCount,1,'PAN548_RETIREMENT_DUPLICATED_THE_RETAINED_START_CONTROL');
  assert.equal(retiredStartDomV158.isTheRetainedNode,true,'PAN548_RETIRED_START_CONTROL_IS_NOT_THE_RETAINED_NODE');
  assert.equal(retiredStartDomV158.text,'Genau diesen synthetischen Lauf starten','PAN548_RETIRED_START_CONTROL_LABEL_NOT_THE_CLEARED_SYNTHETIC');
  assert.equal(await readControl.evaluate(b=>b.disabled),true,'PAN548_RETIRED_SHELL_MUST_NOT_OFFER_A_STALE_READ');
  assert.equal(await readControl.evaluate(b=>b.getClientRects().length>0),true,'PAN548_UNBOUND_RETIREMENT_MUST_NOT_HIDE_THE_CONTROL_BEFORE_THE_BIND');
  assert.equal(await startControl.evaluate(b=>b.disabled),true,'PAN548_UNBOUND_RETIREMENT_MUST_NOT_OFFER_A_START');
  assert.equal(await reviewControl.evaluate(b=>b.disabled),true,'PAN548_UNBOUND_RETIREMENT_MUST_NOT_KEEP_PREVIEW_AUTHORITY');
  // Release while the run is genuinely still held (gateway: still no finish,
  // no close) and provably before the grant's own 25000ms time bound; record
  // the real release timestamp between the original received/finished events.
  assert.ok(!Number.isSafeInteger(admitted()?.finishedAt)&&admitted()?.closedAt===undefined,'PAN548_RELEASE_MUST_HAPPEN_WHILE_THE_START_IS_STILL_HELD');
  const releasedAtMs=Date.now();
  assert.ok(releasedAtMs-admittedAtMs<25_000,'PAN548_RELEASE_MUST_PRECEDE_THE_GRANT_TIME_BOUND');
  writeFileSync(join(evidence(),'retirement-held-window-v157.json'),JSON.stringify({admittedAtMs,releasedAtMs,heldMs:releasedAtMs-admittedAtMs,grantMaxTimeMs:25_000,contextSelection:await contextSelection.evaluate(e=>({state:e.dataset.state,module:e.dataset.module})),panel:retired,nativeNetwork:f.nativeNetwork},null,2)+'\n');
  f.releasePeer();
  // The late start response lands on the retired serial. Its actual server
  // evidence: received before the release, finished at or after it, within
  // the grant bound, with the real 200 status — original gateway events, no
  // fabricated status, no timeout wait.
  await waitForActualV1548(()=>f.nativeNetwork.some(r=>r.path.endsWith('/agent-run/start')&&Number.isSafeInteger(r.finishedAt)),'RETIREMENT_CASE_LATE_START_RESPONSE');
  const late=admitted();
  assert.ok(Number.isSafeInteger(late?.finishedAt),'PAN548_LATE_START_REPLY_MUST_HAVE_FINISHED_AT_THE_GATEWAY');
  assert.ok(!f.nativeNetwork.some(r=>typeof r.browserFailure==='string'&&r.path.endsWith('/agent-run/start')),'PAN548_LATE_START_REPLY_TRANSPORT_FAILED');
  assert.ok(late.receivedAt===admittedAtMs&&late.finishedAt>=releasedAtMs&&late.finishedAt-late.receivedAt<=25_000,'PAN548_LATE_START_TIMING_NOT_THE_ADMISSION_THROUGH_ACTUAL_RELEASE:'+JSON.stringify({receivedAt:late.receivedAt,finishedAt:late.finishedAt,releasedAtMs}));
  assert.equal(late.status,200,'PAN548_LATE_START_REPLY_STATUS_NOT_THE_ACTUAL_200');
  // The genuine native completion was successful AND timely: the actual
  // terminal reply settles RESULT_READY with real consumed units — observed
  // from the recorded real response bytes, then deliberately dropped by the
  // retired shell.
  // RUN59: the gateway's server-side finish event and the browser's own
  // response-event/body completion are separate async instants. The shared
  // fixture pushes f.responses entries only on the Playwright page response
  // event and fills .value asynchronously via r.json(); flushResponses()
  // awaits only ALREADY-pending body promises, never a future event. So the
  // real reply is awaited on the original strict-TLS browser event path
  // itself: the exact POST start 200 entry must ARRIVE and its actual body
  // must COMPLETE (parsed value or an explicit body-read failure) before any
  // DTO assertion reads it — no sleep, no route.fetch, no second transport,
  // no swallowed error, existing finite test bounds only.
  // RUN60: the actual RUN59b diagnostic proved the entry ARRIVES (real
  // Playwright POST start 200 event) while .value never completes and no
  // bodyReadFailure appears. That is not a missing event or a timeout: the
  // retired serial returns at context-selection-v1.ts:232 before response.json()
  // at :234, so the genuine late body is NEVER consumed on the page, and the
  // shared fixture's r.json() stays pending on bytes nothing drains. The
  // page-side remedy is the RUN56 buffered-read precedent: the observer
  // installed above around the ORIGINAL window.fetch clone()-drains exactly
  // this original start Response once, so the real strict-TLS bytes
  // materialize for the fixture. The observer only OBSERVES: the product still
  // ignores them; a separate GET is never counted as the START reply.
  const lateStartBrowserResponseV159=()=>f.responses.filter(r=>r.method==='POST'&&r.path.endsWith('/agent-run/start')&&r.status===200).at(-1);
  await waitForActualV1548(()=>{const r=lateStartBrowserResponseV159();return r!==undefined&&(r.value?.runId===p.runId||Object.hasOwn(r,'bodyReadFailure'));},'RETIREMENT_CASE_LATE_START_BROWSER_RESPONSE_BODY');
  await f.flushResponses();
  const lateArrival=lateStartBrowserResponseV159();
  assert.ok(lateArrival!==undefined,'PAN548_LATE_START_200_RESPONSE_EVENT_MISSING_AT_THE_BROWSER');
  assert.equal(Object.hasOwn(lateArrival,'bodyReadFailure'),false,'PAN548_LATE_START_RESPONSE_BODY_NOT_COMPLETABLE:'+lateArrival.bodyReadFailure);
  const lateReply=lateArrival.value;
  assert.ok(lateReply,'PAN548_LATE_START_200_REPLY_MISSING');
  assert.equal(lateReply.phase,'RESULT_READY','PAN548_LATE_START_COMPLETION_NOT_A_GENUINE_TERMINAL_SUCCESS');
  assert.equal(lateReply.runId,p.runId,'PAN548_LATE_START_REPLY_NOT_THE_ADMITTED_RUN');assert.equal(lateReply.proposal!==null&&lateReply.budget.model.consumedUnits>0,true,'PAN548_LATE_START_DID_NOT_SETTLE_FOR_REAL');
  // Independent page-side confirmation that the observer really drained the
  // ORIGINAL strict-TLS start Response (the same terminal DTO the fixture
  // recorded from the genuine event path — not a fixture copy, not a separate
  // GET, no fabricated DTO). Observation only: the retired product applied
  // none of it, and the no-resurrection assertions below still must hold.
  const retireObserverV160=await f.page.evaluate(()=>window.__pan548RetireStartObserver548);
  assert.equal(retireObserverV160?.drained,true,'PAN548_RETIREMENT_START_BODY_OBSERVER_DID_NOT_DRAIN_THE_ORIGINAL_BYTES');
  // RUN61: consistent sentinel. The observer installs failure:null meaning
  // "no drain/parse error caught" and writes the actual error string on
  // failure; assert strict null, so any caught error (string) and any broken
  // contract (missing property -> undefined) both fail closed exactly like
  // the drained===true requirement above. This corrects the previous
  // assertion that demanded undefined while the initializer deliberately
  // sets null — a test-only sentinel inconsistency, not an observed failure.
  assert.equal(retireObserverV160?.failure,null,'PAN548_RETIREMENT_START_BODY_OBSERVER_FAILURE:'+retireObserverV160?.failure);
  assert.equal(retireObserverV160.value.phase,'RESULT_READY','PAN548_OBSERVED_ORIGINAL_START_BYTES_NOT_THE_GENUINE_TERMINAL');
  assert.equal(retireObserverV160.value.runId,p.runId,'PAN548_OBSERVED_ORIGINAL_START_BYTES_NOT_THE_ADMITTED_RUN');
  assert.ok(retireObserverV160.value.proposal!==null&&retireObserverV160.value.budget.model.consumedUnits>0,'PAN548_OBSERVED_ORIGINAL_START_BYTES_DID_NOT_SETTLE_FOR_REAL');
  // Only now the queued genuine setup binding runs (it was serialized behind
  // the admitted START): the new native context binds and the SAME retained
  // read control becomes actually hidden right here — not before.
  await f.page.locator('[id=\"shell.context-selection\"][data-module=\"pan.setup\"][data-state=\"CURRENT_CONTEXT\"]').waitFor();
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'CURRENT_SCOPE');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-in-flight'),'false');
  assert.equal(await f.page.locator(root).getAttribute('data-run'),'none');
  assert.equal(await readControl.evaluate(b=>b.disabled),true,'PAN548_BOUND_SETUP_MUST_STILL_DENY_A_STALE_READ');
  assert.equal(await readControl.evaluate(b=>b.getClientRects().length===0),true,'PAN548_BOUND_SETUP_MUST_ACTUALLY_HIDE_THE_RETAINED_READ');
  // The still-retired start control stays disabled after the late response.
  assert.equal(await startControl.evaluate(b=>b.disabled),true,'PAN548_LATE_START_MUST_NOT_REVIVE_THE_START_CONTROL');
  assert.equal(await reviewControl.evaluate(b=>b.disabled),true,'PAN548_LATE_START_MUST_NOT_REVIVE_PREVIEW_AUTHORITY');
  const afterLate=await f.page.locator(root).innerText();
  for(const stale of ['Native Laufausführung','Aktuell beobachtet','RESULT_READY','Fehlerdiagnose','Historische Laufquelle','Gebundene Route',p.runId,p.sourceDigest,p.planDigest])assert.ok(!afterLate.includes(stale),'PAN548_LATE_START_AFTER_RETIREMENT_RESURRECTED_STATE:'+stale);
  // Heavyweight evidence AFTER the release: actual full-page image, geometry
  // and privacy checks on the finished, already-retired evidence.
  await connectedCapture(f,'desktop-native-owner-same-shell-retired-during-held-start');
  assert.equal(count(f,'start'),1);assert.equal(f.posts(),2);assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);assert.deepEqual(f.errors,[]);
 }finally{try{f.releasePeer();}catch{/* gate already open or fixture owned */}await f.close();}
});

// RUN56: the meaningful equivalent of the independent buffered-read race
// probe, running on the actual terminal path. The same-shell AGENT_READ's
// genuine RUNNING bytes reach the browser while the admitted start is held,
// but a page-side wrapper around the ORIGINAL window.fetch buffers the
// completed real response (status/statusText/headers/body preserved — the
// real received bytes over the genuine strict-TLS transport, no fabricated
// DTO, no fake native JSON, no route.fetch, no second transport) until after
// the start's own reply applied this shell's terminal projection. Two real
// continuations then run in sequence: RETURN_RUNNING delivers the late
// genuine RUNNING (it must be dropped as older: no regression of the applied
// RESULT_READY), and FAIL_TRANSPORT delivers a delayed transport failure
// after the terminal (this denial is OLDER than the confirmed terminal and
// must retain the applied projection — data-state RESULT_READY with its rows
// — and must never enter RUN_READ_DENIED). No reload, no polling; exactly
// one start; only the synthetic protocol peer speaks; explicitly NOT LLM.
test('PUI07 buffered in-flight read race on the actual terminal: a late RUNNING is dropped and a post-terminal delayed transport failure retains the applied RESULT_READY projection; NOT LLM',async()=>{
 for(const mode of ['RETURN_RUNNING','FAIL_TRANSPORT']){
  const f=await connectedFixture({holdPeer:true,maxTimeMs:25000});try{
   const before=f.business();await open(f);await selectConnectedView(f);await connect(f);const p=await boundPlan(f);
   await f.page.locator('#pan548-agent-inference-consent').check();
   const startControl=await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).elementHandle();
   const readControl=await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).elementHandle();
   await f.page.evaluate(()=>{const original=window.fetch;window.__pan548Buffer548={armed:false,mode:null,buffered:false,opened:false};window.fetch=async(input,init)=>{const response=await original(input,init);const b=window.__pan548Buffer548;
    if(b.armed&&!b.buffered&&response.status===200&&new URL(response.url).origin===location.origin&&new URL(response.url).pathname.endsWith('/workspace/agent-run/read')){
     const text=await response.clone().text(),headers=new Headers(response.headers);headers.delete('content-length');
     b.buffered=true;
     await new Promise(r=>{const t=setInterval(()=>{if(window.__pan548Buffer548.opened){clearInterval(t);r();}},10);if(window.__pan548Buffer548.opened){clearInterval(t);r();}});
     b.armed=false;
     if(b.mode==='FAIL_TRANSPORT')throw new TypeError('PAN548_TEST_DELAYED_TRANSPORT_FAILURE');
     return new Response(text,{status:response.status,statusText:response.statusText,headers});}
    return response;};});
   await startControl.evaluate(e=>e.click());
   await f.peerHeld;await f.flushResponses();
   assert.equal(await f.page.locator(root).getAttribute('data-state'),'DISPATCHING');assert.equal(count(f,'start'),1);assert.equal(f.posts(),1);assert.equal(getReadsV1548(f).length,0);
   await f.page.evaluate(m=>{window.__pan548Buffer548.armed=true;window.__pan548Buffer548.mode=m;},mode);
   await readControl.evaluate(b=>b.click());
   await f.page.waitForFunction(()=>window.__pan548Buffer548.buffered===true);await f.flushResponses();
   // The genuine read response fully finished at the native server (real
   // RUNNING DTO) while the panel is still READING_NATIVE_RUN, because the
   // wrapper alone holds delivery; the start is still outstanding.
   assert.ok(f.nativeNetwork.some(r=>r.path.endsWith('/agent-run/read')&&r.status===200&&Number.isSafeInteger(r.finishedAt)),'PAN548_BUFFERED_READ_MUST_BE_A_GENUINE_FINISHED_NATIVE_RESPONSE');
   const bufferedRead=getReadsV1548(f).filter(r=>r.status===200).at(-1)?.value;
   assert.ok(bufferedRead,'PAN548_BUFFERED_READ_RESPONSE_MISSING');assert.equal(bufferedRead.phase,'RUNNING');assert.equal(bufferedRead.runId,p.runId);
   assert.equal(await f.page.locator(root).getAttribute('data-state'),'READING_NATIVE_RUN','PAN548_BUFFERED_READ_MUST_KEEP_THE_PANEL_READING');
   assert.equal(await f.page.locator(root).getAttribute('data-dispatch-in-flight'),'true');
   f.releasePeer();
   // The start's OWN reply applies the terminal projection while the read's
   // real bytes are still buffered client-side.
   await state(f,'RESULT_READY');await f.flushResponses();
   assert.equal(await f.page.locator(root).getAttribute('data-dispatch-in-flight'),'false');
   assert.ok(f.nativeNetwork.some(r=>r.path.endsWith('/agent-run/start')&&r.status===200&&Number.isSafeInteger(r.finishedAt)),'PAN548_BUFFERED_RACE_START_REPLY_MUST_HAVE_FINISHED_AT_THE_SERVER');
   const terminal=f.responses.filter(r=>r.path.endsWith('/agent-run/start')&&r.status===200).at(-1).value;
   assert.equal(terminal.phase,'RESULT_READY');assert.equal(terminal.budget.model.consumedUnits,10,'PAN548_BUFFERED_RACE_TERMINAL_DID_NOT_SETTLE_FOR_REAL');
   await f.page.evaluate(()=>{window.__pan548Buffer548.opened=true;});
   await f.page.waitForFunction(el=>!el.disabled,readControl);
   assert.equal(await f.page.evaluate(()=>window.__pan548Buffer548.armed),false);
   // The applied terminal survives BOTH continuations: data-state stays
   // RESULT_READY, its source rows and preview authority are intact.
   assert.equal(await f.page.locator(root).getAttribute('data-state'),'RESULT_READY','PAN548_BUFFERED_RACE_MUST_NOT_REGRESS_OR_DENY_THE_TERMINAL:'+mode);
   const visible=await f.page.locator(root).innerText();
   assert.ok(visible.includes(p.sourceDigest),'PAN548_BUFFERED_RACE_TERMINAL_ROWS_WIPED:'+mode);
   assert.ok(!visible.includes('RUN_READ_DENIED'),'PAN548_BUFFERED_RACE_DENIED_MESSAGE_LEAKED:'+mode);
   assert.ok(!visible.includes('Aktuell beobachtet')&&!visible.includes('Native Laufausführung'),'PAN548_BUFFERED_LATE_READ_REGRESSED_THE_TERMINAL:'+mode);
   if(mode==='FAIL_TRANSPORT')assert.ok(visible.includes('bleibt maßgeblich'),'PAN548_DELAYED_TRANSPORT_FAILURE_MUST_ANNOUNCE_RETAINED_TERMINAL');
   if(mode==='RETURN_RUNNING')assert.ok(!visible.includes('bleibt maßgeblich')&&visible.includes('Native Laufprojektion gelesen'),'PAN548_LATE_RUNNING_MUST_SILENTLY_STAY_DROPPED');
   assert.equal(await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).isDisabled(),false,'PAN548_BUFFERED_RACE_LOST_PREVIEW_AUTHORITY:'+mode);
   assert.equal(await startControl.evaluate(e=>e.disabled),true,'PAN548_BUFFERED_RACE_MUST_NOT_ENABLE_START_RETRY:'+mode);
   await startControl.evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
   assert.equal(count(f,'start'),1);assert.equal(f.posts(),2);assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);
   // A fresh genuine read afterwards re-confirms the same terminal.
   const readsBeforeFresh=getReadsV1548(f).length;
   await readControl.evaluate(b=>b.click());
   await waitForActualV1548(()=>getReadsV1548(f).length>readsBeforeFresh,'POST_RACE_FRESH_READ');await f.flushResponses();
   await state(f,'RESULT_READY');
   assert.equal(f.responses.filter(r=>r.method==='GET'&&r.path.endsWith('/agent-run/read')&&r.status===200).at(-1).value.requestDigest,terminal.requestDigest,'PAN548_POST_RACE_FRESH_READ_REQUEST_DIGEST_CHANGED');
   await connectedCapture(f,'desktop-native-owner-buffered-read-race-'+mode);
   assert.deepEqual(f.errors,[]);
  }finally{try{f.releasePeer();}catch{/* gate already open or fixture owned */}await f.close();}
 }
});

// Test-only synthetic browser-response mutation (labelled honestly): the read
// responses below travel over the genuine browser-native strict-TLS transport
// (same NSS-trusted fetch, same headers/cookies, no second Node-side TLS
// transport). A page-side wrapper around the captured original window.fetch
// awaits that genuine browser fetch and mutates ONLY the failureDiagnosis field
// or the historical provenance triple (binding/sourceDigest/sourceRevisions)
// of the exact same-origin agent-run/read response via a closed test mode;
// status/headers are preserved and the native fetch is restored in finally.
// This is a synthetic browser-response mutation, not a native retained-ledger
// change. The old-record and forged cases are deterministic public fixtures for
// the consumer boundary, not replays of historical ledger rows or LLM evidence.
test('PUI07 actual browser panel diagnosis consumer: diagnosis-less read stays unclassified, measured zero distinct from null, forged diagnosis denied without stale output, historical provenance legacy-null UNKNOWN with corrupt triples denied and no stale rows, context switch clears; NOT LLM',async()=>{
 const f=await connectedFixture({unknown:true});try{
  const before=f.business();await open(f);await selectConnectedView(f);await connect(f);const planned=await boundPlan(f);
  await f.page.locator('#pan548-agent-inference-consent').check();await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await state(f,'OUTCOME_UNCONFIRMED');await f.flushResponses();
  // The actual browser can abort/timelimit its start transport while the native
  // run persists (observed in nativeNetwork: start closed without finish, no
  // browser response event at all), so OUTCOME_UNCONFIRMED alone carries no
  // successful start reply and the panel deliberately shows no diagnosis before
  // a read. As in the existing UNKNOWN browser case, this test's baseline comes
  // from a completed real independent native READ of the same retained run —
  // never from an assumed start200 projection.
  await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).click();
  await state(f,'OUTCOME_UNCONFIRMED');await f.flushResponses();
  const genuine=f.responses.filter(r=>r.method==='GET'&&r.path.endsWith('/agent-run/read')&&r.status===200).at(-1)?.value;
  assert.ok(genuine,'PAN548_BASELINE_INDEPENDENT_NATIVE_READ_MISSING');
  assert.equal(genuine.runId,planned.runId,'PAN548_BASELINE_READ_NOT_SAME_RUN');
  const baselineDiagnosis=genuine.failureDiagnosis;
  assert.ok(baselineDiagnosis,'PAN548_BASELINE_READ_DIAGNOSIS_MISSING');
  assert.equal(baselineDiagnosis.reason,'LOOP_FRESH_INFORMATION_DENIED');assert.equal(baselineDiagnosis.actualRequests,2);assert.equal(baselineDiagnosis.actualToolActions,2);
  assert.ok((await f.page.locator(root).innerText()).includes('Frische Werkzeuginformation nicht bestätigt'),'PAN548_INDEPENDENT_READ_DIAGNOSIS_MISSING');
  const readClick=async()=>{await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).click();};
  // Test-only synthetic browser-response mutation: the captured original
  // window.fetch stays the ONLY transport (genuine browser NSS-trusted strict
  // TLS, original headers/cookies, no redirect re-issue, no Node-side Playwright
  // API request context). The wrapper awaits that genuine browser fetch, matches
  // the exact same-origin agent-run/read response, preserves status/statusText/
  // headers and swaps the failureDiagnosis or the historical provenance triple
  // through the closed mode allowlist.
  await f.page.evaluate(()=>{const original=window.fetch;window.__pan548OriginalFetch548=original;const done={seq:0,mode:null};window.__pan548SyntheticRead548=done;window.__pan548SyntheticMode548={mode:'NONE',baseline:null};
   const closedModes={NONE:v=>v,DROP_DIAGNOSIS:v=>{delete v.failureDiagnosis;return v;},ZERO_VS_NULL:(v,b)=>Object.assign(v,{failureDiagnosis:{...b,actualRequests:0,actualToolActions:null}}),FORGED_PAIR:(v,b)=>Object.assign(v,{failureDiagnosis:{...b,reason:'LOOP_TIME_LIMIT'}}),FORGED_REASON:(v,b)=>Object.assign(v,{failureDiagnosis:{...b,reason:'LOOP_MALICIOUS_CANARY'}}),LEGACY_NULL_PROVENANCE:v=>Object.assign(v,{binding:null,sourceDigest:null,sourceRevisions:null}),PARTIAL_PROVENANCE:v=>Object.assign(v,{sourceRevisions:null}),FOREIGN_BINDING:v=>Object.assign(v,{binding:{...v.binding,tenantId:'tenant-malicious-canary'}}),EXTRA_KEY_BINDING:v=>Object.assign(v,{binding:{...v.binding,forgeCanary:'x'}}),MALFORMED_DIGEST:v=>Object.assign(v,{sourceDigest:'Z'.repeat(64)})};
   window.fetch=async(input,init)=>{const response=await original(input,init);
    try{const url=new URL(response.url);
     if(url.origin===location.origin&&url.pathname.endsWith('/workspace/agent-run/read')){const spec=window.__pan548SyntheticMode548;
      if(spec.mode!=='NONE'&&response.status===200){const value=await response.clone().json();const mutated=closedModes[spec.mode](structuredClone(value),spec.baseline);const headers=new Headers(response.headers);headers.delete('content-length');done.seq+=1;done.mode=spec.mode;return new Response(JSON.stringify(mutated),{status:response.status,statusText:response.statusText,headers});}
      done.seq+=1;done.mode='NONE';}}
    catch(error){window.__pan548SyntheticReadFailure548=String(error?.message??error);}
    return response;};});
  const setSyntheticMode=mode=>f.page.evaluate(spec=>{window.__pan548SyntheticMode548=spec;},{mode,baseline:baselineDiagnosis});
  // Each case observes THIS click's completed response: a fresh wrapper sequence
  // number under the expected closed mode, not whatever promises already exist.
  const syntheticRead=async mode=>{const before=await f.page.evaluate(()=>window.__pan548SyntheticRead548.seq);await readClick();await f.page.waitForFunction(([n,m])=>window.__pan548SyntheticRead548.seq>n&&window.__pan548SyntheticRead548.mode===m,[before,mode]);await f.flushResponses();};
  const panelShows=(present,absent)=>f.page.waitForFunction(([p,a])=>{const t=document.querySelector('[id="shell.agent-panel"]')?.innerText??'';return p.every(x=>t.includes(x))&&a.every(x=>!t.includes(x));},[present,absent]);
  // Exact identity/text binding for the two historical provenance dl rows as
  // actually rendered in the live panel DOM (fixed code-owned labels only).
  const historicalRowsV1=()=>f.page.evaluate(()=>{const want=['Historische Laufquelle des nativen Laufs','Historische Laufquellenrevisionen des nativen Laufs'];const dl=document.querySelector('[id="shell.agent-panel"] .agent-technical-details>dl');const dts=dl?[...dl.querySelectorAll('dt')].filter(n=>want.includes(n.textContent?.trim()??'')):[];return dts.map(dt=>({dtLabel:dt.textContent?.trim()??'',text:dt.nextElementSibling?.textContent?.trim()??''}));});
  // Older additive record without any diagnosis: explicitly unclassified, not
  // reconstructed, and the previous valid diagnosis must not persist as current.
  await setSyntheticMode('DROP_DIAGNOSIS');await syntheticRead('DROP_DIAGNOSIS');
  await panelShows(['Keine hinterlegt — dieser Lauf bleibt unklassifiziert, keine Rekonstruktion','Anfragen nicht gemessen (kein Nullwert) · Werkzeugaktionen nicht gemessen (kein Nullwert)'],['Frische Werkzeuginformation','Exit ']);
  await state(f,'OUTCOME_UNCONFIRMED');
  let visible=await f.page.locator(root).innerText();
  assert.ok(visible.includes('Keine hinterlegt — dieser Lauf bleibt unklassifiziert, keine Rekonstruktion')&&visible.includes('Anfragen nicht gemessen (kein Nullwert) · Werkzeugaktionen nicht gemessen (kein Nullwert)'),'PAN548_LEGACY_RECORD_MUST_STAY_UNCLASSIFIED');
  assert.ok(!visible.includes('Frische Werkzeuginformation')&&!visible.includes('Exit '),'PAN548_STALE_DIAGNOSIS_AFTER_DIAGNOSIS_LESS_READ');
  await connectedCapture(f,'desktop-agent-failure-diagnosis-legacy-record-unclassified');
  // Genuinely measured zero stays zero; null stays not-measured (never zero).
  await setSyntheticMode('ZERO_VS_NULL');await syntheticRead('ZERO_VS_NULL');
  await panelShows(['Anfragen 0 · Werkzeugaktionen nicht gemessen (kein Nullwert)'],['Anfragen 2','Keine hinterlegt','Anfragen nicht gemessen']);
  await state(f,'OUTCOME_UNCONFIRMED');
  visible=await f.page.locator(root).innerText();
  assert.ok(visible.includes('Anfragen 0 · Werkzeugaktionen nicht gemessen (kein Nullwert)'),'PAN548_MEASURED_ZERO_VS_NULL_NOT_DISTINCT');
  assert.ok(!visible.includes('Anfragen 2'),'PAN548_NULL_COUNT_RENDERED_AS_ZERO_OR_STALE');
  // Forged reason/exit pair (budget reason with exit 2) is denied by the strict
  // DTO at the panel boundary: no stale diagnosis may remain shown. The observable
  // fresh OUTCOME_UNCONFIRMED->RUN_READ_DENIED transition IS this read's result.
  await setSyntheticMode('FORGED_PAIR');await syntheticRead('FORGED_PAIR');
  await state(f,'RUN_READ_DENIED');
  visible=await f.page.locator(root).innerText();
  assert.ok(!visible.includes('Fehlerdiagnose')&&!visible.includes('Exit '),'PAN548_FORGED_PAIR_MUST_NOT_LEAVE_STALE_DIAGNOSIS');
  // Intermediate genuine passthrough read restores the diagnosis so that the
  // next forged denial is again a fresh observable transition instead of a
  // second identical RUN_READ_DENIED re-match. This adds one read-only GET and
  // never an extra dispatch, start or model POST.
  await setSyntheticMode('NONE');await syntheticRead('NONE');
  await state(f,'OUTCOME_UNCONFIRMED');await panelShows(['Frische Werkzeuginformation nicht bestätigt'],['Keine hinterlegt']);
  // Forged reason outside the closed allowlist denies the read the same way;
  // the OUTCOME_UNCONFIRMED->RUN_READ_DENIED transition observes THIS response.
  await setSyntheticMode('FORGED_REASON');await syntheticRead('FORGED_REASON');
  await state(f,'RUN_READ_DENIED');
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'RUN_READ_DENIED');
  assert.ok(!(await f.page.locator(root).innerText()).includes('LOOP_MALICIOUS_CANARY'),'PAN548_FORGED_REASON_LEAKED_INTO_PANEL');
  assert.ok(!(await f.page.locator(root).innerText()).includes('Fehlerdiagnose'),'PAN548_FORGED_REASON_MUST_NOT_LEAVE_STALE_DIAGNOSIS');
  await f.page.setViewportSize({width:390,height:844});await connectedCapture(f,'390-agent-failure-diagnosis-denied-no-stale');await f.page.setViewportSize({width:1280,height:900});
  // Only a fresh genuine read shows the actual state again.
  await setSyntheticMode('NONE');await syntheticRead('NONE');
  await state(f,'OUTCOME_UNCONFIRMED');await panelShows(['Frische Werkzeuginformation nicht bestätigt'],['Keine hinterlegt']);
  assert.ok((await f.page.locator(root).innerText()).includes('Frische Werkzeuginformation nicht bestätigt'),'PAN548_FRESH_VALID_READ_MUST_RESTORE_DIAGNOSIS');
  // RUN49 historical provenance display over the same genuine same-origin read
  // response (synthetic browser-response mutation, never persisted-ledger
  // evidence). First the all-null legacy triple: it must render as explicitly
  // UNKNOWN/not reconstructed, never re-labeled with the current source, while
  // the valid diagnosis rows stay untouched.
  const historicalDigest=genuine.sourceDigest,historicalRevisions=genuine.sourceRevisions===null||genuine.sourceRevisions===undefined?'MISSING-HISTORICAL-TRIPLE':'ERV '+genuine.sourceRevisions.erv+' · Human '+genuine.sourceRevisions.human;
  assert.ok(typeof historicalDigest==='string'&&/^[a-f0-9]{64}$/.test(historicalDigest)&&genuine.sourceRevisions!==null&&genuine.sourceRevisions!==undefined,'PAN548_GENUINE_READ_MISSING_HISTORICAL_TRIPLE');
  assert.ok((await f.page.locator(root).innerText()).includes('Historische Laufquelle des nativen Laufs'),'PAN548_HISTORICAL_ROWS_MISSING_AFTER_GENUINE_READ');
  const histHint=' — ursprünglich zum Lauf aufgezeichnet; nicht aktuell verifiziert; keine Freigabe zum Speichern, Anwenden oder Wiederholen',histUnknown='UNKNOWN — historischer Quellenstand nicht überliefert; nicht rekonstruiert und nicht aus aktuellem Kontext oder Plan übernommen';
  await setSyntheticMode('LEGACY_NULL_PROVENANCE');await syntheticRead('LEGACY_NULL_PROVENANCE');
  await state(f,'OUTCOME_UNCONFIRMED');
  await panelShows(['Historische Laufquelle des nativen Laufs','Historische Laufquellenrevisionen des nativen Laufs','UNKNOWN — historischer Quellenstand nicht überliefert','Frische Werkzeuginformation nicht bestätigt'],[historicalDigest,'ERV ']);
  assert.deepEqual(await historicalRowsV1(),[{dtLabel:'Historische Laufquelle des nativen Laufs',text:histUnknown},{dtLabel:'Historische Laufquellenrevisionen des nativen Laufs',text:histUnknown}],'PAN548_LEGACY_NULL_HISTORICAL_ROWS_NOT_EXACT');
  await connectedCapture(f,'desktop-agent-historical-provenance-legacy-null-unknown');
  // Corrupt partial, foreign-tenant, extra-key and malformed-digest triples are
  // denied by the closed DTO on this browser read: each produces a fresh
  // OUTCOME_UNCONFIRMED -> RUN_READ_DENIED transition, clears every stale
  // historical source/diagnosis row, and the next untouched genuine native read
  // restores the correct history. No retry, start or model POST is involved.
  for(const mode of ['PARTIAL_PROVENANCE','FOREIGN_BINDING','EXTRA_KEY_BINDING','MALFORMED_DIGEST']){
   await setSyntheticMode(mode);await syntheticRead(mode);
   await state(f,'RUN_READ_DENIED');
   const deniedText=await f.page.locator(root).innerText();
   for(const stale of ['Historische Laufquelle','Historische Laufquellenrevisionen','Fehlerdiagnose','Frische Werkzeuginformation',historicalDigest,'ERV '])assert.ok(!deniedText.includes(stale),'PAN548_STALE_HISTORICAL_PROVENANCE_AFTER_'+mode+':'+stale);
   await setSyntheticMode('NONE');await syntheticRead('NONE');
   await state(f,'OUTCOME_UNCONFIRMED');
   await panelShows(['Historische Laufquelle des nativen Laufs','Historische Laufquellenrevisionen des nativen Laufs',historicalDigest,historicalRevisions,'ursprünglich zum Lauf aufgezeichnet; nicht aktuell verifiziert; keine Freigabe zum Speichern, Anwenden oder Wiederholen'],['RUN_READ_DENIED']);
  }
  // Bind the restored-history evidence to the exact historical row identities
  // and rendered values, then capture it with the existing capture helper.
  assert.deepEqual(await historicalRowsV1(),[{dtLabel:'Historische Laufquelle des nativen Laufs',text:historicalDigest+histHint},{dtLabel:'Historische Laufquellenrevisionen des nativen Laufs',text:historicalRevisions+histHint}],'PAN548_RESTORED_HISTORICAL_ROWS_NOT_EXACT');
  await connectedCapture(f,'desktop-agent-historical-provenance-restored-after-denials');
  // Navigating away clears the diagnosis and the historical rows as old context.
  await f.page.getByRole('button',{name:'Einrichtung und Betriebszustand',exact:true}).click();
  await f.page.locator('[id="shell.context-selection"][data-module="pan.setup"][data-state="CURRENT_CONTEXT"]').waitFor();await state(f,'CURRENT_SCOPE');
  const switchedText=await f.page.locator(root).innerText();
  for(const stale of ['Fehlerdiagnose','Historische Laufquelle','Historische Laufquellenrevisionen',historicalDigest])assert.ok(!switchedText.includes(stale),'PAN548_CONTEXT_SWITCH_MUST_CLEAR_OLD_HISTORY:'+stale);
  assert.equal(count(f,'start'),1);assert.equal(f.posts(),2);assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);assert.deepEqual(f.errors,[]);
  assert.equal(await f.page.evaluate(()=>window.__pan548SyntheticReadFailure548),undefined,'PAN548_SYNTHETIC_READ_MUTATION_TRANSPORT_FAILURE');
 }finally{try{await f.page.evaluate(()=>{window.fetch=window.__pan548OriginalFetch548;});}catch{}await f.close();}
});

test('PUI07/DUI06 real mounted browser keyboard native selection -> plan once -> native synthetic run -> reload fresh persistent status -> separate546 preview/cancel/confirm/CAS/GET/Undo, chip dock focus same task; desktop390 zoom',async()=>{
 const f=await nativeViewBrowserFixture546({agentRuns:true});try{const before=f.business(),images=[];await open(f);images.push(await capture(f,'desktop-agent-native-empty-selection'));await select(f);const p=await plan(f);assert.equal(p.realModelAcceptance,false);assert.equal(count(f,'start'),0);assert.equal(f.readPersisted().revision,0);const id=await f.page.locator(root).getAttribute('data-run');assert.equal(id,p.runId);await f.page.locator(root).getByRole('button',{name:'Auftragspanel ausblenden',exact:true}).click();assert.equal(await f.page.locator('#pan548-agent-body').isVisible(),false);assert.equal(await f.page.locator(root).getAttribute('data-run'),id);assert.equal(await f.page.locator(root).getByRole('button',{name:'Auftragspanel öffnen',exact:true}).evaluate(e=>e===document.activeElement),true);await f.page.locator(root).getByRole('button',{name:'Auftragspanel öffnen',exact:true}).click();await f.page.locator(root).getByRole('button',{name:'Darstellung Dock / Fokus wechseln',exact:true}).click();assert.equal(await f.page.locator(root).getAttribute('data-presentation'),'FOCUS');assert.equal(await f.page.locator(root).getAttribute('data-run'),id);images.push(await capture(f,'desktop-agent-planned-focus-no-dispatch'));const result=await run(f);assert.equal(result.runId,id);assert.equal(result.modelMode,'SYNTHETIC_PROBE_ONLY');assert.equal(result.realModelAcceptance,false);assert.equal(result.phase,'RESULT_READY');assert.equal(result.budget.runtime.consumedUnits,2);assert.equal(result.operations.cancel.available,false);assert.equal(result.operations.resume.available,false);assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);assert.equal(count(f,'start'),1);assert.equal(await f.page.locator(root).getByRole('button',{name:'Echten Modellvorschlag senden — nicht verfügbar',exact:true}).isDisabled(),true);await f.page.locator(root).getByRole('button',{name:'Genau diesen synthetischen Lauf starten',exact:true}).evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.equal(count(f,'start'),1);images.push(await capture(f,'desktop-agent-native-result-budget-proposal-only'));
 await f.page.reload();await showCurrentContextDetailsUI(f.page);await f.page.locator('[id="shell.context-selection"][data-module="pan.erv"][data-state="CURRENT_CONTEXT"]').waitFor();await state(f,'RESULT_READY');await showCurrentViewDetailsUI(f.page);await f.page.locator(view+'[data-state="CURRENT_NATIVE_VIEW"]').waitFor();await f.flushResponses();assert.equal(await f.page.locator(root).getAttribute('data-run'),id);assert.equal(count(f,'start'),1);const nativeRead=f.responses.filter(r=>r.method==='GET'&&r.path.endsWith('/agent-run/read')&&r.status===200).at(-1).value;assert.equal(nativeRead.runId,result.runId);assert.equal(nativeRead.requestDigest,result.requestDigest);assert.deepEqual(nativeRead.budget,result.budget);assert.equal(f.readPersisted().revision,0);assert.equal(await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).isDisabled(),true,'RELOADED_PROPOSAL_NEEDS_FRESH_NATIVE_SELECTION');await select(f);await state(f,'RESULT_READY');await preview(f);assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);images.push(await capture(f,'desktop-agent-separate-native546-before-after'));await f.page.locator(view).getByRole('button',{name:'Vorschau abbrechen — nichts speichern',exact:true}).click();await f.page.locator(view+'[data-state="LOCAL_DRAFT_DISCARDED"]').waitFor();assert.equal(f.readPersisted().revision,0);await preview(f);await confirm(f);assert.equal(f.readPersisted().revision,1);assert.equal(f.readPersisted().view.instances.find(i=>i.instanceId==='invoice-value').size,'large');assert.equal(await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).isDisabled(),true,'OLD_PROPOSAL_NOT_REAPPLIED_AFTER_CAS');await f.page.setViewportSize({width:390,height:844});images.push(await capture(f,'390-agent-native-result-stale-proposal-after-confirmation'));await f.page.evaluate(()=>{document.body.style.zoom='2';});images.push(await capture(f,'390-agent-zoom200-bounded-controls-long-reasons'));await f.page.evaluate(()=>{document.body.style.zoom='1';});await showCurrentViewDetailsUI(f.page);await f.page.locator(view).getByRole('button',{name:'Letzten gespeicherten Viewstand zurückholen',exact:true}).click();await f.page.locator(view+'[data-state="PREVIEW_ONLY"]').waitFor();await confirm(f);assert.equal(f.readPersisted().revision,2);assert.equal(f.readPersisted().view.instances.find(i=>i.instanceId==='invoice-value').size,'regular');assert.equal(count(f,'start'),1);assert.equal(f.business(),before);assert.deepEqual(f.errors,[]);writeFileSync(join(evidence(),'actual-agent-panel-positive.json'),JSON.stringify({images,requests:f.requests,responses:f.responses,taskId:id,viewRevisions:[0,1,2],noBusinessEffects:true,realModelAcceptance:false},null,2)+'\n');}finally{await f.close();}
});

test('PUI07 browser genuine lost start reply after native persisted task: UNKNOWN disabled replay, only fresh independent native read and reload reconcile same run, no invented resume/cancel',async()=>{
 const f=await nativeViewBrowserFixture546({agentRuns:true});let cdp;try{const before=f.business();await open(f);await select(f);const p=await plan(f);cdp=await f.context.newCDPSession(f.page);let resolve,held=false;const persisted=new Promise(r=>{resolve=r;});await cdp.send('Fetch.enable',{patterns:[{urlPattern:f.tls.origin+'*/workspace/agent-run/start',requestStage:'Response'}]});cdp.on('Fetch.requestPaused',async event=>{if(held){await cdp.send('Fetch.continueResponse',{requestId:event.requestId});return;}held=true;assert.equal(event.responseStatusCode,200);const b=await cdp.send('Fetch.getResponseBody',{requestId:event.requestId}),r=JSON.parse(Buffer.from(b.body,b.base64Encoded?'base64':'utf8').toString());resolve(r);await cdp.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'Failed'});});await f.page.locator(root).getByRole('button',{name:'Genau diesen synthetischen Lauf starten',exact:true}).click();const native=await persisted;assert.equal(native.phase,'RESULT_READY');assert.equal(native.runId,p.runId);await state(f,'OUTCOME_UNCONFIRMED');assert.equal(await f.page.locator(root).getByRole('button',{name:'Genau diesen synthetischen Lauf starten',exact:true}).isDisabled(),true,'UNKNOWN_RUN_MUST_NOT_OFFER_BLIND_START_REPLAY');await f.page.locator(root).getByRole('button',{name:'Genau diesen synthetischen Lauf starten',exact:true}).evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.equal(count(f,'start'),1);await f.page.setViewportSize({width:390,height:844});await capture(f,'390-agent-genuine-lost-start-reply-unknown-no-retry');await cdp.send('Fetch.disable');await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).click();await state(f,'RESULT_READY');await f.flushResponses();assert.equal(count(f,'start'),1);const read=f.responses.filter(r=>r.method==='GET'&&r.path.endsWith('/agent-run/read')&&r.status===200).at(-1).value;assert.equal(read.requestDigest,native.requestDigest);assert.deepEqual(read.budget,native.budget);assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);await capture(f,'390-agent-lost-reply-only-native-read-reconciled');assert.deepEqual(f.errors,[]);}finally{await cdp?.send('Fetch.disable').catch(()=>{});await f.close();}
});

test('PUI07 late genuine plan response after native context navigation cannot publish old plan or start; unbound HTTP context bootstrap denied',async()=>{
 const f=await nativeViewBrowserFixture546({agentRuns:true});let cdp;try{await open(f);await select(f);cdp=await f.context.newCDPSession(f.page);let resolve,held;const paused=new Promise(r=>{resolve=r;});await cdp.send('Fetch.enable',{patterns:[{urlPattern:f.tls.origin+'*/workspace/agent-run/plan',requestStage:'Response'}]});cdp.on('Fetch.requestPaused',e=>{assert.equal(e.responseStatusCode,200);held=e;resolve();});await f.page.locator(root).getByRole('button',{name:'Begrenzten Testauftrag planen',exact:true}).click();await paused;await capture(f,'desktop-agent-real-native-plan-loading-held-response');await f.page.getByRole('button',{name:'Einrichtung und Betriebszustand',exact:true}).click();await cdp.send('Fetch.continueResponse',{requestId:held.requestId});await cdp.send('Fetch.disable');await showCurrentContextDetailsUI(f.page);await f.page.locator('[id="shell.context-selection"][data-module="pan.setup"][data-state="CURRENT_CONTEXT"]').waitFor();await state(f,'CURRENT_SCOPE');assert.equal(await f.page.locator(root).getByRole('button',{name:'Genau diesen synthetischen Lauf starten',exact:true}).isDisabled(),true);assert.equal(count(f,'start'),0);assert.equal(f.readPersisted().revision,0);await capture(f,'desktop-agent-late-native-plan-retired-scope-denied');await f.page.getByRole('button',{name:'Eingangsrechnungsprüfung — nur lesen',exact:true}).click();await showCurrentViewDetailsUI(f.page);await f.page.locator(view+'[data-state="CURRENT_NATIVE_VIEW"]').waitFor();await select(f);const p=await plan(f);await f.flushResponses();const command=f.requests.filter(r=>r.path.endsWith('/agent-run/plan')).at(-1).body;const denial=await f.page.evaluate(async({command,runId})=>{const response=await fetch('/t/tenant-a/workspace/context-selection/tab',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});return {status:response.status,runId,commandSchema:command.schemaVersion};},{command,runId:p.runId});assert.notEqual(denial.status,200,'UNBOUND_HTTP_CONTEXT_TAB_MUST_DENY');assert.equal(count(f,'start'),0);assert.deepEqual(f.errors,[]);}finally{await cdp?.send('Fetch.disable').catch(()=>{});await f.close();}
});

test('PUI07 optional agent script load error preserves native manual view, profile and logout; no fake task result or credentials, desktop390 error visible',async()=>{
 const f=await nativeViewBrowserFixture546({agentRuns:true});try{await f.page.route('**/workspace/agent-run/app.js',route=>route.abort('failed'));await f.page.goto(f.tls.origin+'/t/tenant-a/workspace');await f.page.getByText('Auftragspanel nicht verfügbar. Kein Lauf bestätigt; Fachnavigation, Profile und Abmelden bleiben unabhängig.',{exact:true}).waitFor();assert.equal(await f.page.locator(root).count(),0);await f.page.getByRole('button',{name:'Eingangsrechnungsprüfung — nur lesen',exact:true}).click();await showCurrentViewDetailsUI(f.page);await f.page.locator(view+'[data-state="CURRENT_NATIVE_VIEW"]').waitFor();assert.equal(f.readPersisted().revision,0);assert.equal(count(f,'start'),0);await showCurrentProfileDetailsUI(f.page);await f.page.locator('[id="profile.controls"]').getByRole('button',{name:'Darstellung anpassen',exact:true}).click();await f.page.getByRole('slider',{name:'Hauptfläche Größe',exact:true}).press('ArrowRight');await f.page.getByRole('button',{name:'Profil speichern',exact:true}).click();await f.page.getByRole('button',{name:'Speichern bestätigen',exact:true}).click();await showCurrentProfileDetailsUI(f.page);await f.page.locator('[data-profile-state="SAVED"]').waitFor();await f.flushResponses();const profile=f.responses.filter(r=>r.path.endsWith('/workspace/profile')&&r.method==='GET'&&r.status===200).at(-1).value;assert.equal(profile.revision,1);assert.equal(await f.page.locator(view).isVisible(),true);await showCurrentProfileDetailsUI(f.page);await f.page.locator('[id="profile.controls"]').getByRole('button',{name:'Darstellung anpassen',exact:true}).click();await capture(f,'desktop-agent-module-load-error-independent-native-view');await f.page.setViewportSize({width:390,height:844});await capture(f,'390-agent-module-load-error-independent-navigation');await f.page.getByRole('button',{name:'Abmelden',exact:true}).click();await f.page.getByRole('heading',{name:'Abgemeldet',exact:true}).waitFor();assert.deepEqual(f.errors,[]);}finally{await f.close();}
});

async function showCurrentContextDetailsUI(page){const d=page.locator('[id="workspace.context-details"]');if(await d.getAttribute('open')===null)await d.locator(':scope > summary').click();}

async function showCurrentViewDetailsUI(page){const task=page.locator('[id="workspace.mode-task"]');if(await task.isVisible())await task.click();const d=page.locator('[id="workspace.module-editor-details"]');await d.waitFor({state:'attached'});if(await d.getAttribute('open')===null)await d.locator(':scope > summary').click();}

async function showCurrentProfileDetailsUI(page){const d=page.locator('[id="workspace.profile-details"]');if(await d.getAttribute('open')===null)await d.locator(':scope > summary').click();}

async function showAgentTechnicalUI(page){if(await page.evaluate(()=>innerWidth<800&&document.body.dataset.mobileWorkArea!=='ASSISTANT'))await page.getByRole('button',{name:'Assistent',exact:true}).click();const d=page.locator('.agent-technical-details');if(await d.getAttribute('open')===null)await d.locator(':scope > summary').click();}
async function revealAgentDiagnosisV1(page){await showAgentTechnicalUI(page);await page.evaluate(()=>{const dl=document.querySelector('[id="shell.agent-panel"] .agent-technical-details>dl');const row=dl?[...dl.querySelectorAll('dt')].find(n=>['Fehlerdiagnose (minimiert, native Projektion)','Tatsächlich gemessene Anfragen / Werkzeugaktionen'].includes(n.textContent?.trim()??'')):null;row?.scrollIntoView({block:'center'});});}
// Sequential evidence for exactly the four diagnosis row identities (label and value of
// each dl row). The fixed 390px/zoom200 panel scrollport cannot show all four rows at
// once, so each row is scrolled fully into the actual panel body scrollport, re-measured,
// hit-tested at center and all four corners, then captured as its own actual VIEWPORT
// screenshot (fullPage:false; a full-page capture relayouts/re-scrolls the page and was
// observed to render the panel at a different internal scroll position than the geometry
// measured before it). Immediately after the screenshot, WITHOUT another scroll, the same
// geometry routine re-measures the row (scroll:false) and the capture is only accepted if
// the intended identity/text and bounds remain visible/hit-testable and equal the
// pre-capture rect within 1px — the picture is bound to what was asserted. Fails on a
// missing row, an empty row text, a duplicate identity or a post-capture drift; no row is
// filtered away or asserted vacuously.
const diagnosisRowLabelsV1=Object.freeze(['Fehlerdiagnose (minimiert, native Projektion)','Tatsächlich gemessene Anfragen / Werkzeugaktionen']);
async function captureDiagnosisRowsSequentialV1(f,name,pins){
 const refs=[];
 // One geometry routine shared by the pre-capture measurement (scroll:true) and the
 // post-capture binding measurement (scroll:false); the flag is the only difference,
 // so the two measurements can never diverge in what they check.
 const measureDiagnosisRowGeometryV1=({i,which,scroll})=>f.page.evaluate(({want,i,which,scroll})=>{const panelEl=document.getElementById('shell.agent-panel');const dts=[...(panelEl?.querySelectorAll('.agent-technical-details>dl dt')??[])].filter(n=>want.includes(n.textContent?.trim()??''));const dt=dts[i],el=which==='label'?dt:dt?.nextElementSibling;if(!el)return null;if(scroll)el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect(),port=document.getElementById('pan548-agent-body')?.getBoundingClientRect(),panel=panelEl.getBoundingClientRect();const hits=[[r.left+r.width/2,r.top+r.height/2],[r.left+1,r.top+1],[r.right-1,r.top+1],[r.left+1,r.bottom-1],[r.right-1,r.bottom-1]].map(([x,y])=>document.elementFromPoint(Math.min(Math.max(x,0),innerWidth-1),Math.min(Math.max(y,1),innerHeight-1)));return{row:which,dtLabel:dt.textContent?.trim()??'',text:el.textContent?.trim()??'',top:r.top,bottom:r.bottom,left:r.left,right:r.right,visible:!!el.getClientRects().length,insideViewport:r.top>=0&&r.bottom<=innerHeight,insideScrollport:!!port&&r.top>=port.top-1&&r.bottom<=port.bottom+1&&r.left>=port.left-1&&r.right<=port.right+1,insidePanel:r.top>=panel.top-1&&r.bottom<=panel.bottom+1&&r.left>=panel.left-1&&r.right<=panel.right+1,hitSelfAndCorners:hits.length===5&&hits.every(hit=>!!hit&&(hit===el||el.contains(hit)))};},{want:diagnosisRowLabelsV1,i,which,scroll});
 for(let index=0;index<diagnosisRowLabelsV1.length;index++){
  for(const row of ['label','value']){
   const identity=name+':'+diagnosisRowLabelsV1[index]+':'+row;
   const geometry=await measureDiagnosisRowGeometryV1({i:index,which:row,scroll:true});
   assert.ok(geometry,'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_IDENTITY_MISSING:'+identity);
   assert.ok(geometry.dtLabel===diagnosisRowLabelsV1[index],'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_LABEL_MISMATCH:'+identity+':'+JSON.stringify(geometry));
   assert.ok(geometry.text.length>0,'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_TEXT_EMPTY:'+identity);
   assert.ok(geometry.visible&&geometry.insideViewport,'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_NOT_INSIDE_VISIBLE_VIEWPORT:'+identity+':'+JSON.stringify(geometry));
   assert.ok(geometry.insideScrollport,'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_OUTSIDE_SCROLL_VIEWPORT:'+identity+':'+JSON.stringify(geometry));
   assert.ok(geometry.insidePanel,'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_OUTSIDE_PANEL_BOUNDS:'+identity+':'+JSON.stringify(geometry));
   assert.ok(geometry.hitSelfAndCorners,'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_NOT_HIT_TESTABLE_AT_CENTER_AND_CORNERS:'+identity+':'+JSON.stringify(geometry));
   const image=join(evidence(),name+'.diagnosis-row-'+index+'-'+row+'.png');
   await f.page.screenshot({path:image,fullPage:false});
   // Bind the just-written pixels to the assertions: re-measure immediately after the
   // actual viewport screenshot with no new scroll; identity, text, visibility and the
   // exact rect must survive the capture itself.
   const postCaptureGeometry=await measureDiagnosisRowGeometryV1({i:index,which:row,scroll:false});
   assert.ok(postCaptureGeometry,'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_IDENTITY_MISSING_AFTER_CAPTURE:'+identity);
   assert.ok(postCaptureGeometry.dtLabel===diagnosisRowLabelsV1[index],'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_LABEL_MISMATCH_AFTER_CAPTURE:'+identity+':'+JSON.stringify(postCaptureGeometry));
   assert.ok(postCaptureGeometry.text.length>0&&postCaptureGeometry.text===geometry.text,'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_TEXT_NOT_BOUND_TO_CAPTURE:'+identity+':pre='+JSON.stringify(geometry.text)+':post='+JSON.stringify(postCaptureGeometry.text));
   assert.ok(postCaptureGeometry.visible&&postCaptureGeometry.insideViewport,'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_NOT_VISIBLE_AFTER_CAPTURE:'+identity+':'+JSON.stringify(postCaptureGeometry));
   assert.ok(postCaptureGeometry.insideScrollport,'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_OUTSIDE_SCROLL_VIEWPORT_AFTER_CAPTURE:'+identity+':'+JSON.stringify(postCaptureGeometry));
   assert.ok(postCaptureGeometry.insidePanel,'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_OUTSIDE_PANEL_BOUNDS_AFTER_CAPTURE:'+identity+':'+JSON.stringify(postCaptureGeometry));
   assert.ok(postCaptureGeometry.hitSelfAndCorners,'PAN548_DIAGNOSIS_SEQUENTIAL_ROW_NOT_HIT_TESTABLE_AT_CENTER_AND_CORNERS_AFTER_CAPTURE:'+identity+':'+JSON.stringify(postCaptureGeometry));
   assert.ok(['top','bottom','left','right'].every(key=>Math.abs(postCaptureGeometry[key]-geometry[key])<=1),'PAN548_DIAGNOSIS_SEQUENTIAL_CAPTURE_GEOMETRY_DRIFT_BEYOND_1PX:'+identity+':pre='+JSON.stringify({top:geometry.top,bottom:geometry.bottom,left:geometry.left,right:geometry.right})+':post='+JSON.stringify({top:postCaptureGeometry.top,bottom:postCaptureGeometry.bottom,left:postCaptureGeometry.left,right:postCaptureGeometry.right}));
   const imageSHA256=hash(readFileSync(image));
   writeFileSync(image+'.json',JSON.stringify({sequentialIdentity:identity,rowIdentity:{row,dtLabel:geometry.dtLabel,text:geometry.text},geometry,screenshotMode:'VIEWPORT_FULLPAGE_FALSE',postCaptureGeometry,captureBoundToMeasuredGeometryWithin1px:true,pins,imageSHA256},null,2)+'\n');
   refs.push({sequentialIdentity:identity,image,sidecar:image+'.json',imageSHA256,rowIdentity:{row,dtLabel:geometry.dtLabel}});
  }
 }
 assert.equal(refs.length,4,'PAN548_DIAGNOSIS_SEQUENTIAL_ROWS_NOT_EXACT_FOUR:'+JSON.stringify(refs.map(r=>r.sequentialIdentity)));
 assert.equal(new Set(refs.map(r=>r.sequentialIdentity)).size,4,'PAN548_DIAGNOSIS_SEQUENTIAL_ROWS_DUPLICATE_IDENTITY:'+JSON.stringify(refs.map(r=>r.sequentialIdentity)));
 return refs;
}
