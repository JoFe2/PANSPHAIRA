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
   const safePhase=value=>['CURRENT_SCOPE','PLANNING','PLAN_DENIED','PLANNED_NOT_DISPATCHED','DISPATCHING','READING_NATIVE_RUN','RESULT_READY','OUTCOME_UNCONFIRMED','RUN_READ_DENIED'].includes(value)?value:null;
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
async function connectedFixture({taskPurpose=true,empty=false,unknown=false}={}){
 const privateRoot=mkdtempSync(join(tmpdir(),'pan548-browser-native-owner-'));
 const credentialFile=join(privateRoot,'existing-local-test-secret');
 writeFileSync(credentialFile,syntheticCredential565,{mode:0o600});
 const peer=syntheticWorkspaceViewChatFeedbackModelV1('tenant-a'),observations=[];let posts=0,f;
 const server=createServer(async(req,res)=>{
  try{
   let bytes='';for await(const chunk of req)bytes+=chunk;
   const body=bytes?JSON.parse(bytes):null;
   observations.push({method:req.method,credentialPresent:typeof req.headers.authorization==='string',body});
   res.writeHead(200,{'content-type':'application/json'});
   if(req.method==='GET'){res.end(JSON.stringify({data:[{id:'model:synthetic-v1'}]}));return;}
   posts++;
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
 options.productGrant.limits={...options.productGrant.limits,maxTimeMs:15000,maxInputBytes:32768};
 if(taskPurpose)options.productGrant.allowedPurposes=['purpose:ui-connection-probe','purpose:ui-view-proposal'];
 try{f=await nativeViewBrowserFixture546({agentRuns:true,modelConnections:empty?[]:[options]});}
 catch(error){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(privateRoot,{recursive:true,force:true});throw error;}
 const nativeNetwork=[];
 f.tls.gateway.server.prependListener('request',(request,response)=>{if(!request.url.includes('/workspace/agent-run/'))return;const entry={path:request.url,method:request.method,receivedAt:Date.now()};nativeNetwork.push(entry);response.once('finish',()=>{entry.finishedAt=Date.now();entry.status=response.statusCode;});response.once('close',()=>{entry.closedAt=Date.now();});});
 f.page.on('requestfailed',request=>{if(request.url().includes('/workspace/agent-run/'))nativeNetwork.push({path:new URL(request.url()).pathname,browserFailure:request.failure()?.errorText,at:Date.now()});});
 return {...f,observations,nativeNetwork,connectionId:options.summary.connectionId,posts:()=>posts,async close(){try{await f.close();}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(privateRoot,{recursive:true,force:true});}}};
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
  // The actual readback must carry the exact minimized diagnosis observed by
  // the native broker loop for this synthetic tampered final answer.
  assert.deepEqual(r.failureDiagnosis,{schemaVersion:'pansphaira.workspace-agent/failure-diagnosis/v1',runId:p.runId,requestDigest:r.requestDigest,reason:'LOOP_FRESH_INFORMATION_DENIED',exitCode:2,actualRequests:2,actualToolActions:2,settledUsageConfirmed:false,realModelAcceptance:false});
  // The real panel DOM (not a helper projection) renders the fixed code-owned
  // German labels and the measured counts; no raw reason code, no JSON dump,
  // and no enabled retry/resume appears next to the diagnosis.
  const visible=await f.page.locator(root).innerText();
  for(const literal of ['Fehlerdiagnose (minimiert, native Projektion)','Frische Werkzeuginformation nicht bestätigt','Exit 2','Anfragen 2 · Werkzeugaktionen 2','Verbrauch nicht bestätigt — volle Reservierung bleibt erhalten'])assert.ok(visible.includes(literal),'PAN548_ACTUAL_PANEL_DIAGNOSIS_LABEL_MISSING:'+literal);
  for(const counter of ['LOOP_FRESH_INFORMATION_DENIED','{"schemaVersion"','RESULT_READY'])assert.ok(!visible.includes(counter),'PAN548_ACTUAL_PANEL_DIAGNOSIS_RAW_OR_SUCCESS_LEAK:'+counter);
  for(const label of ['Lauf abbrechen — nicht verfügbar','Lauf fortsetzen — nicht verfügbar'])assert.equal(await f.page.locator(root).getByRole('button',{name:label,exact:true}).isDisabled(),true,'PAN548_DIAGNOSIS_MUST_NOT_ENABLE_TASK_CONTROL:'+label);
  await connectedCapture(f,'desktop-native-owner-unknown-failure-diagnosis');
  await f.page.setViewportSize({width:390,height:844});await connectedCapture(f,'390-native-owner-unknown-retained-no-retry');
  await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).click();await state(f,'OUTCOME_UNCONFIRMED');
  await f.page.evaluate(()=>{document.body.style.zoom='2';});await connectedCapture(f,'390-zoom200-native-owner-unknown-failure-diagnosis');await f.page.evaluate(()=>{document.body.style.zoom='1';});
  await f.page.reload();await showCurrentContextDetailsUI(f.page);await f.page.locator('[id="shell.context-selection"][data-module="pan.erv"][data-state="CURRENT_CONTEXT"]').waitFor();await state(f,'OUTCOME_UNCONFIRMED');
  assert.equal(await f.page.locator(root).getAttribute('data-run'),p.runId);assert.equal(f.posts(),2);assert.equal(count(f,'start'),1);assert.equal(await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).isDisabled(),true);assert.deepEqual(f.errors,[]);
  // The independent post-reload native read retained the same observed
  // diagnosis and counts in the real panel; keyboard re-read stays dispatch-
  // neutral (no new start, no new model POST).
  assert.ok((await f.page.locator(root).innerText()).includes('Anfragen 2 · Werkzeugaktionen 2'),'PAN548_DIAGNOSIS_NOT_RETAINED_AFTER_RELOAD');
  await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).focus();await f.page.keyboard.press('Enter');await state(f,'OUTCOME_UNCONFIRMED');
  assert.equal(count(f,'start'),1);assert.equal(f.posts(),2);assert.equal(f.readPersisted().revision,0);
 }finally{await f.close();}
});

// Test-only synthetic browser-response mutation (labelled honestly): the read
// responses below travel over the genuine browser-native strict-TLS transport
// (same NSS-trusted fetch, same headers/cookies, no second Node-side TLS
// transport). A page-side wrapper around the captured original window.fetch
// awaits that genuine browser fetch and mutates ONLY the failureDiagnosis field
// of the exact same-origin agent-run/read response via a closed test mode;
// status/headers are preserved and the native fetch is restored in finally.
// This is a synthetic browser-response mutation, not a native retained-ledger
// change. The old-record and forged cases are deterministic public fixtures for
// the consumer boundary, not replays of historical ledger rows or LLM evidence.
test('PUI07 actual browser panel diagnosis consumer: diagnosis-less read stays unclassified, measured zero distinct from null, forged diagnosis denied without stale output, context switch clears; NOT LLM',async()=>{
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
  // headers and swaps only failureDiagnosis through the closed mode allowlist.
  await f.page.evaluate(()=>{const original=window.fetch;window.__pan548OriginalFetch548=original;const done={seq:0,mode:null};window.__pan548SyntheticRead548=done;window.__pan548SyntheticMode548={mode:'NONE',baseline:null};
   const closedModes={NONE:v=>v,DROP_DIAGNOSIS:v=>{delete v.failureDiagnosis;return v;},ZERO_VS_NULL:(v,b)=>Object.assign(v,{failureDiagnosis:{...b,actualRequests:0,actualToolActions:null}}),FORGED_PAIR:(v,b)=>Object.assign(v,{failureDiagnosis:{...b,reason:'LOOP_TIME_LIMIT'}}),FORGED_REASON:(v,b)=>Object.assign(v,{failureDiagnosis:{...b,reason:'LOOP_MALICIOUS_CANARY'}})};
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
  // Navigating away clears the diagnosis as old context.
  await f.page.getByRole('button',{name:'Einrichtung und Betriebszustand',exact:true}).click();
  await f.page.locator('[id="shell.context-selection"][data-module="pan.setup"][data-state="CURRENT_CONTEXT"]').waitFor();await state(f,'CURRENT_SCOPE');
  assert.ok(!(await f.page.locator(root).innerText()).includes('Fehlerdiagnose'),'PAN548_CONTEXT_SWITCH_MUST_CLEAR_DIAGNOSIS');
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
