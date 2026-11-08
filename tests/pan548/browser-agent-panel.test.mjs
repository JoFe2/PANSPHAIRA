import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {nativeViewBrowserFixture546} from '../pan546/browser-fixture.mjs';
import {connectionOptions565,syntheticCredential565} from '../pan565/native-fixture.mjs';
import {syntheticWorkspaceViewChatFeedbackModelV1} from '../../src/pan548/native-agent-run.mjs';
const root='[id="shell.agent-panel"]',view='[id="shell.module-view"]';
// RUN82: the guided recovery navigation's single accessible name, bound exactly once here so both new journeys assert the SAME accessible name the product sets.
const connectionNavLabelV1='Vorhandenen sicheren Verbindungsbereich öffnen und fokussieren — keine automatische Anfrage, keine Auswahländerung';
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
async function connectedFixture({taskPurpose=true,empty=false,unknown=false,holdPeer=false,maxTimeMs=15000,hangInferenceProbeOnce=false,ownerBoundPriced=false}={}){
 const privateRoot=mkdtempSync(join(tmpdir(),'pan548-browser-native-owner-'));
 const credentialFile=join(privateRoot,'existing-local-test-secret');
 writeFileSync(credentialFile,syntheticCredential565,{mode:0o600});
 const peer=syntheticWorkspaceViewChatFeedbackModelV1('tenant-a'),observations=[];let posts=0,f,expectedCredential=syntheticCredential565;
 // RUN105 seam (default OFF, accepted journeys byte-identical): the single toolless POST — the genuine565 inference-probe dispatch through the real transport — is never answered, so the REAL owner-side provider timeout inside the mounted product retains the full reservation as a real UNKNOWN_USAGE connection hold. Nothing is injected; GETs and every tool-bearing feedback POST keep answering honestly.
 let hangProbeOnce=hangInferenceProbeOnce;
 let markPeerHeld,resolvedPeerHeld=false;const peerHeld=new Promise(r=>{markPeerHeld=()=>{resolvedPeerHeld=true;r();};});peerHeld.catch(()=>{});let releasePeerGate;const peerGate=new Promise(r=>{releasePeerGate=r;});
 const server=createServer(async(req,res)=>{
  try{
   let bytes='';for await(const chunk of req)bytes+=chunk;
   const body=bytes?JSON.parse(bytes):null;
   observations.push({method:req.method,credentialPresent:typeof req.headers.authorization==='string',credentialDigest:typeof req.headers.authorization==='string'?hash(req.headers.authorization.slice('Bearer '.length)):null,body});
   // RUN109: the local protocol peer answers only the CURRENT fixture-generated synthetic bearer bytes, exactly like the accepted565 peer; the observation records only the DIGEST, never credential bytes. Without rotation every accepted journey presents syntheticCredential565 and behaves byte-identically.
   if(req.headers.authorization!=='Bearer '+expectedCredential){res.writeHead(401,{'content-type':'application/json'});res.end('{"error":"minimized-auth-failure"}');return;}
   res.writeHead(200,{'content-type':'application/json'});
   if(req.method==='GET'){res.end(JSON.stringify({data:[{id:'model:synthetic-v1'}]}));return;}
   posts++;
   if(hangProbeOnce&&posts===1&&!body?.tools?.length){hangProbeOnce=false;return;}
   if(holdPeer&&posts===1){markPeerHeld();await peerGate;}
   // RUN108: a genuine INFERENCE-probe dispatch is a tool-less bounded request, so the local peer answers it exactly like the accepted565 peer: plain synthetic framing with observed usage, no tool_calls. The closed outgoing-wire oracle below applies only to the tool-bearing feedback loop, so every accepted journey (whose only tool-less POST is the deliberately hung first probe) stays byte-identical.
   if(!body?.tools?.length){res.end(JSON.stringify({model:'model:synthetic-v1',choices:[{message:{content:'Synthetic framing only; not a model.',tool_calls:[]}}],usage:{prompt_tokens:2,completion_tokens:3}}));return;}
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
 // RUN105 (default OFF): the same local peer behind an externally priced owner-bound reference — the only honest way to show a NON-reconcilable retained hold: settlement stays with the qualified owner usage reader, never a fake browser zero-price.
 if(ownerBoundPriced){options.summary.evidenceClass='OWNER_BOUND_NOT_QUALIFIED';options.summary.provider='provider:local-owner-test';options.pricing={currency:'EUR',revision:1,inputMicrosPerMillionTokens:0,outputMicrosPerMillionTokens:0};}
 try{f=await nativeViewBrowserFixture546({agentRuns:true,modelConnections:empty?[]:[options]});}
 catch(error){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(privateRoot,{recursive:true,force:true});throw error;}
 const nativeNetwork=[];
 f.tls.gateway.server.prependListener('request',(request,response)=>{if(!request.url.includes('/workspace/agent-run/'))return;const entry={path:request.url,method:request.method,receivedAt:Date.now()};nativeNetwork.push(entry);response.once('finish',()=>{entry.finishedAt=Date.now();entry.status=response.statusCode;});response.once('close',()=>{entry.closedAt=Date.now();});});
 f.page.on('requestfailed',request=>{if(request.url().includes('/workspace/agent-run/'))nativeNetwork.push({path:new URL(request.url()).pathname,browserFailure:request.failure()?.errorText,at:Date.now()});});
 return {...f,observations,nativeNetwork,connectionId:options.summary.connectionId,credentialFile,posts:()=>posts,peerHeld,releasePeer(){releasePeerGate();},async close(){releasePeerGate();markPeerHeld();try{await f.close();}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(privateRoot,{recursive:true,force:true});}},
  // RUN109: the parent-controlled fixture owner rotates ONLY its OWN generated synthetic credential bytes (no host secret, no host mount) and the local peer's accepted bytes move together — the fixture owner re-establishes its synthetic supported credential through the SAME existing write mechanism it used at creation. Secret bytes never enter observations/logs; only their digest is exposed.
  rotateSyntheticCredential(bytes){assert.ok(/^[A-Za-z0-9._~-]{8,4096}$/.test(bytes)&&bytes!==expectedCredential,'PAN548_RUN109_SYNTHETIC_ROTATION_MUST_CHANGE_THE_GENERATED_BYTES');writeFileSync(credentialFile,bytes,{mode:0o600});expectedCredential=bytes;},currentCredentialDigest(){return hash(expectedCredential);}};
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
// RUN62: readable RUNNING/result/readback journey in the same shell, built only
// on the existing single body scrollport and the existing native controls. It
// exercises the real keyboard focus route (details summary -> Tab -> the
// independent native read control -> Shift+Tab back), scrolls deliberately with
// real wheel input, then measures the aria-live phase notice and each bound
// run/source/budget row with positive dimensions AND actual visible/hit-tested
// rectangles (elementFromPoint after clipping to the scrollport and viewport) —
// not just locator.isVisible or DOM text. The scrollport clip is deliberate
// scrolling, not occlusion: a real header/composer overlap survives the clip
// and fails the hit test, because header and composer are panel-mounted
// siblings and never flow inside the scrollport. Records scrolled viewport
// screenshots, the facts-dl row crops and a sidecar binding state, run, the
// last genuine native read DTO, the context scope and source pins. Read-only
// observation: no dispatch, retry, preview, apply or new authority.
// RUN63 closes three concrete evidence holes in this SAME journey, without any
// product change: (1) the host state() helper already calls showAgentTechnicalUI
// before the journey runs, so the entry disclosure state is recorded as a direct
// observation only — never asserted as a fabricated native-open expectation;
// (2) the summary focus image is captured after the real keyboard-return route
// (the CSS ring is bound to :focus-visible, which a programmatic focus() alone
// does not reach) and the keyboard focus-visible state itself is asserted;
// (3) at 390 the oversized dl element screenshot (whose locator.screenshot
// auto-scroll changed the very nested viewport it claimed to prove) is replaced
// by per-row real scroll reach with the viewport screenshot and the matching
// rectangles bound at the SAME scroll position before any later capture moves
// it; the row readability bar is now "whole cell, or the complete visible
// scrollport chunk for a longer value the user scrolls through" instead of a
// fixed 15px strip.
const agentFactsV162={running:['Nativer Lauf','Modellstatus','Wirkung','Native Auftragsbindung','Verbrauch/Reservierung','Native Laufausführung','Native Quelle','Native Quellenrevisionen'],terminal:['Nativer Lauf','Modellstatus','Wirkung','Native Auftragsbindung','Verbrauch/Reservierung','Native Quelle','Native Quellenrevisionen']};
async function runReadJourneyV162(f,name,expectedPhase,expectedFacts){
 const page=f.page,summary=page.locator(root+' .agent-technical-details>summary');
 await page.locator(root+'[data-state="'+expectedPhase+'"]').waitFor({state:'attached'});
 // RUN63: the host state() helper has ALREADY called showAgentTechnicalUI
 // before this journey is entered, so any open state seen here cannot be
 // attributed to the product alone. Record it as a direct observation at
 // journey entry, before this helper touches open at all; for the held
 // RUNNING and the reload RESULT_READY journeys no fabricated expected
 // disclosure state is asserted.
 const disclosureObservedAtEntry=await page.locator(root+' .agent-technical-details').evaluate(n=>n.open===true).catch(()=>null);
 await showAgentTechnicalUI(page);
 await summary.focus();
 assert.ok(await page.evaluate(()=>document.activeElement?.matches('[id="shell.agent-panel"] .agent-technical-details>summary')===true),'PAN548_JOURNEY_KEYBOARD_FOCUS_SUMMARY');
 await page.keyboard.press('Tab');
 const tabTarget=await page.evaluate(()=>{const a=document.activeElement;return a?.tagName==='BUTTON'?(a.getAttribute('aria-label')??a.textContent?.trim()??null):null;});
 assert.equal(tabTarget,'Laufstatus unabhängig nativ lesen','PAN548_JOURNEY_TAB_MUST_REACH_INDEPENDENT_NATIVE_READ');
 const readFocus=await page.evaluate(()=>{const a=document.activeElement,r=a?.getBoundingClientRect();if(!r)return null;const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{width:r.width,height:r.height,hitFocused:!!hit&&(hit===a||a.contains(hit))};});
 assert.ok(readFocus&&readFocus.width>0&&readFocus.height>0&&readFocus.hitFocused,'PAN548_JOURNEY_READ_CONTROL_NOT_HIT_TESTABLE_AFTER_TAB:'+JSON.stringify(readFocus));
 await page.keyboard.press('Shift+Tab');
 assert.ok(await page.evaluate(()=>document.activeElement?.matches('[id="shell.agent-panel"] .agent-technical-details>summary')===true),'PAN548_JOURNEY_KEYBOARD_FOCUS_MUST_RETURN_TO_SUMMARY');
 // RUN63: the summary focus ring is bound to :focus-visible in
 // workspace-agent-panel-v1.css, which a programmatic focus() alone does not
 // reach. This focus arrived through the real keyboard route (Shift+Tab), so
 // assert the actual keyboard focus-visible state, then capture the image in
 // exactly that state — no assertion of activeElement alone, no programmatic-
 // focus screenshot pretending to show the ring.
 const summaryKeyboardFocusVisible=await page.evaluate(()=>document.activeElement?.matches(':focus-visible')===true);
 assert.ok(summaryKeyboardFocusVisible,'PAN548_JOURNEY_SUMMARY_RETURNED_FOCUS_NOT_A_VISIBLE_KEYBOARD_STATE');
 await page.screenshot({path:join(evidence(),name+'-keyboard-focus-details-summary.png')});
 const statusEvidence=await page.evaluate(()=>{const s=document.querySelector('[id="shell.agent-panel"] [role="status"]');s.scrollIntoView({block:'center'});const r=s.getBoundingClientRect(),p=document.getElementById('pan548-agent-body').getBoundingClientRect();const top=Math.max(r.top,p.top,0),bottom=Math.min(r.bottom,p.bottom,innerHeight),left=Math.max(r.left,p.left,0),right=Math.min(r.right,p.right,innerWidth),hit=document.elementFromPoint((left+right)/2,(top+bottom)/2);return{text:s.textContent,width:Math.round(r.width),height:Math.round(r.height),readableHeight:Math.round(bottom-top),hitSelf:!!hit&&(hit===s||s.contains(hit))};});
 assert.ok(statusEvidence.width>0&&statusEvidence.height>0&&statusEvidence.readableHeight>=14&&statusEvidence.hitSelf,'PAN548_JOURNEY_PHASE_NOTICE_NOT_READABLE:'+JSON.stringify(statusEvidence));
 await page.screenshot({path:join(evidence(),name+'-phase-viewport.png')});
 const wheelToBottom=async()=>{await page.evaluate(()=>document.getElementById('pan548-agent-body').scrollIntoView({block:'center'}));const c=await page.evaluate(()=>{const r=document.getElementById('pan548-agent-body').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+Math.min(Math.max(r.height/2,20),Math.max(r.height-20,20))};});await page.mouse.move(c.x,c.y);for(let i=0;i<12;i++){await page.mouse.wheel(0,400);if(await page.evaluate(()=>{const p=document.getElementById('pan548-agent-body');return p.scrollTop>=p.scrollHeight-p.clientHeight-2;}))return i+1;}await page.waitForFunction(()=>{const p=document.getElementById('pan548-agent-body');return p.scrollTop>=p.scrollHeight-p.clientHeight-2;},null,{timeout:4000});return 12;};
 const wheels=await wheelToBottom();
 const measureRows=(scroll=true)=>page.evaluate(({labels,scroll})=>{const panel=document.getElementById('shell.agent-panel'),port=document.getElementById('pan548-agent-body');return labels.map(label=>{const dt=[...panel.querySelectorAll('.agent-technical-details>dl dt')].find(n=>n.textContent?.trim()===label),dd=dt?.nextElementSibling??null;if(!dt||!dd)return{label,missing:true};const measure=el=>{if(scroll)el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect(),p=port.getBoundingClientRect();const top=Math.max(r.top,p.top,0),bottom=Math.min(r.bottom,p.bottom,innerHeight),left=Math.max(r.left,p.left,0),right=Math.min(r.right,p.right,innerWidth),visiblePort=Math.max(0,Math.min(p.bottom,innerHeight)-Math.max(p.top,0)),hit=document.elementFromPoint((left+right)/2,(top+bottom)/2);return{width:Math.round(r.width),height:Math.round(r.height),readableHeight:Math.round(bottom-top),visiblePortHeight:Math.round(visiblePort),hitSelf:!!hit&&(hit===el||el.contains(hit)),text:el.textContent?.slice(0,220)};};const labelCell=measure(dt),valueCell=measure(dd);return{label,dt:labelCell,dd:valueCell};});},{labels:expectedFacts,scroll});
 // RUN63: a fixed 15px strip proved nothing. After the deliberate reach, a
 // cell's readable chunk must cover the WHOLE cell when it fits the visible
 // scrollport, or the COMPLETE visible scrollport when the value is longer —
 // the chunk a real user reads before scrolling on; never a sliver.
 const assertRows=rows=>{for(const row of rows){assert.ok(!row.missing,'PAN548_JOURNEY_BOUND_FACT_ROW_MISSING:'+row.label);for(const cell of[row.dt,row.dd]){assert.ok(cell.width>0&&cell.height>0&&cell.readableHeight>=14&&cell.hitSelf,'PAN548_JOURNEY_BOUND_FACT_ROW_NOT_READABLE:'+row.label+':'+JSON.stringify(cell));assert.ok(cell.readableHeight>=Math.min(cell.height,cell.visiblePortHeight)-2,'PAN548_JOURNEY_BOUND_FACT_ROW_CHUNK_NOT_FULLY_READABLE:'+row.label+':'+JSON.stringify(cell));}}};
 // RUN63 replaces the oversized-dl element screenshot (locator.screenshot
 // auto-scrolls and thereby MOVES the nested viewport it claims to prove, so
 // the "complete rows" image actually showed only the last row) with per-row
 // evidence: real scroll reach pins the row label at the scrollport top, the
 // viewport screenshot is taken at that exact scroll position, and only then
 // re-measured without any new scroll — both label and value cells must be
 // hit-testable, reach from their actual top inside the visible scrollport,
 // show their complete readable chunk, and keep their rectangles within 1px
 // across the capture. A longer value keeps its top chunk visible and simply
 // continues below the fold, where the user scrolls to it naturally.
 const captureRowEvidence=async prefix=>{const refs=[];for(const[label,index]of expectedFacts.map((label,i)=>[label,i])){
  const rowAt=scroll=>page.evaluate(({label,scroll})=>{const panel=document.getElementById('shell.agent-panel'),dt=[...panel.querySelectorAll('.agent-technical-details>dl dt')].find(n=>n.textContent?.trim()===label),dd=dt?.nextElementSibling??null;if(!dt||!dd)return null;if(scroll)dt.scrollIntoView({block:'start'});const port=document.getElementById('pan548-agent-body').getBoundingClientRect(),measure=el=>{const r=el.getBoundingClientRect(),top=Math.max(r.top,port.top,0),bottom=Math.min(r.bottom,port.bottom,innerHeight),left=Math.max(r.left,port.left,0),right=Math.min(r.right,port.right,innerWidth),hit=document.elementFromPoint((left+right)/2,(top+bottom)/2);return{top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),height:Math.round(r.height),readableHeight:Math.round(bottom-top),chunkCeil:Math.round(Math.min(r.height,Math.max(0,Math.min(port.bottom,innerHeight)-Math.max(r.top,0)))),inPortTop:r.top>=port.top-1&&r.top<=Math.min(port.bottom,innerHeight)-1,hitSelf:!!hit&&(hit===el||el.contains(hit)),text:el.textContent?.slice(0,220)};};return{label,dt:measure(dt),dd:measure(dd)};},{label,scroll});
  const assertBound=(pair,stage)=>{assert.ok(pair,'PAN548_JOURNEY_ROW_EVIDENCE_IDENTITY_MISSING_'+stage+':'+label);for(const cell of[pair.dt,pair.dd])assert.ok(cell.width>0&&cell.height>0&&cell.readableHeight>=14&&cell.inPortTop&&cell.readableHeight>=cell.chunkCeil-2&&cell.hitSelf,'PAN548_JOURNEY_ROW_EVIDENCE_NOT_READABLE_'+stage+':'+label+':'+JSON.stringify(cell));};
  const pre=await rowAt(true);assertBound(pre,'PRE');
  const image=join(evidence(),prefix+'-'+(index+1)+'.png');
  await page.screenshot({path:image,fullPage:false});
  const post=await rowAt(false);assertBound(post,'POST_CAPTURE');
  assert.ok(post.dt.text===pre.dt.text&&post.dd.text===pre.dd.text,'PAN548_JOURNEY_ROW_EVIDENCE_TEXT_NOT_BOUND_TO_CAPTURE:'+label);
  assert.ok(['top','bottom','left','right'].every(key=>Math.abs(post.dt[key]-pre.dt[key])<=1&&Math.abs(post.dd[key]-pre.dd[key])<=1),'PAN548_JOURNEY_ROW_EVIDENCE_RECT_NOT_BOUND_WITHIN_1PX:'+label+':pre='+JSON.stringify({dt:{top:pre.dt.top,bottom:pre.dt.bottom,left:pre.dt.left,right:pre.dt.right},dd:{top:pre.dd.top,bottom:pre.dd.bottom,left:pre.dd.left,right:pre.dd.right}})+':post='+JSON.stringify({dt:{top:post.dt.top,bottom:post.dt.bottom,left:post.dt.left,right:post.dt.right},dd:{top:post.dd.top,bottom:post.dd.bottom,left:post.dd.left,right:post.dd.right}}));
  const imageSHA256=hash(readFileSync(image));
  writeFileSync(image+'.json',JSON.stringify({journeyRowFactsEvidence:true,label,preCaptureGeometry:pre,postCaptureGeometry:post,screenshotMode:'VIEWPORT_FULLPAGE_FALSE',captureBoundToMeasuredGeometryWithin1px:true,imageSHA256},null,2)+'\n');
  refs.push({label,rowIndex:index+1,image,sidecar:image+'.json',imageSHA256});
 }
 assert.equal(refs.length,expectedFacts.length,'PAN548_JOURNEY_ROW_EVIDENCE_COUNT_MISMATCH:'+JSON.stringify(refs.map(r=>r.label)));
 return refs;};
 const desktopRows=await measureRows();await assertRows(desktopRows);
 await page.screenshot({path:join(evidence(),name+'-scrolled-viewport.png')});
 const desktopRowEvidence=await captureRowEvidence(name+'-row');
 await connectedCapture(f,name);
 await f.page.setViewportSize({width:390,height:844});await connectedCapture(f,name+'-390');await wheelToBottom();const rows390=await measureRows();await assertRows(rows390);
 await page.screenshot({path:join(evidence(),name+'-390-scrolled-viewport.png')});
 const viewport390RowEvidence=await captureRowEvidence(name+'-390-row');
 await page.evaluate(()=>{document.body.style.zoom='2';});
 const rowsZoom=await measureRows();await assertRows(rowsZoom);
 // zoom200 keeps the strengthened full-chunk assertion on every cell; this one
 // viewport image documents the actual 200% state at the measured end-of-scroll
 // position — the per-row bound captures above carry the readability proof.
 await page.screenshot({path:join(evidence(),name+'-390-zoom200-scrolled-viewport.png')});
 await page.evaluate(()=>{document.body.style.zoom='1';});await f.page.setViewportSize({width:1280,height:900});
 const lastRead=f.responses.filter(r=>(r.method==='GET'||r.method==='POST')&&(r.path.endsWith('/agent-run/read')||r.path.endsWith('/agent-run/start'))&&r.status===200).at(-1)?.value;
 const meta={expectedPhase,actualState:await page.locator(root).getAttribute('data-state'),actualRun:await page.locator(root).getAttribute('data-run'),phaseNoticeText:statusEvidence.text,scopeText:await page.locator(root+' [data-agent-scope]').innerText(),explanationText:await page.locator(root+' [data-agent-explanation]').innerText(),lastGenuineNativeReadDTO:lastRead?{runId:lastRead.runId,phase:lastRead.phase,requestDigest:lastRead.requestDigest,sourceDigest:lastRead.sourceDigest,sourceRevisions:lastRead.sourceRevisions,budget:lastRead.budget}:null,expectedFacts,keyboardRoute:{summaryFocused:true,tabReachedIndependentRead:true,returnedToSummary:true,summaryKeyboardFocusVisible},disclosureObservedAtEntry,disclosureNote:'recorded at journey entry before this helper touched open; the host state() helper already called showAgentTechnicalUI beforehand, so no fabricated native-open expectation is asserted',wheelScrollWheels:wheels,rows:{desktop:desktopRows,viewport390:rows390,zoom200:rowsZoom},boundRowViewportEvidence:{desktop:desktopRowEvidence,viewport390:viewport390RowEvidence},evidenceNote:'per-cell hit-tested rectangles after deliberate wheel/scroll reach; readable chunk must cover the whole cell or the complete visible scrollport for longer values; per-row viewport screenshots are bound to the measured rectangles at the same scroll position within 1px; scrollport clip is intended scrolling, header/composer are panel-mounted siblings outside the scrollport',controlledLocalHTTPNotLLM:true,actualModelPosts:f.posts(),pins:Object.fromEntries(['src/pan565/native-model-connection.mjs','src/pan565/connection-transport.mjs','src/pan543/profile-store.mjs','src/pan575/broker-tool-feedback.mjs','packages/contracts/src/workspace-model-connection-v1.ts','packages/browser-workspace/src/workspace-agent-panel-v1.ts','packages/browser-workspace/src/workspace-agent-panel-v1.css'].map(p=>[p,hash(readFileSync(p))]))};
 writeFileSync(join(evidence(),name+'.journey.json'),JSON.stringify(meta,null,2)+'\n');
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
  await runReadJourneyV162(f,'desktop-native-owner-result-ready-reload-readback','RESULT_READY',agentFactsV162.terminal);
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
  await runReadJourneyV162(f,'desktop-native-owner-running-held-peer-journey','RUNNING',agentFactsV162.running);
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
  await runReadJourneyV162(f,'desktop-native-owner-running-released-result-ready-journey','RESULT_READY',agentFactsV162.terminal);
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
  await runReadJourneyV162(f,'desktop-native-owner-same-shell-release-result-ready-journey','RESULT_READY',agentFactsV162.terminal);
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
  // RUN95: phase-correlated retirement observer over the REAL shared element,
  // installed BEFORE the navigation click. Every mutation records one ordered
  // snapshot {state,module,selection,pending}, where pending is the actual
  // text of the element's own role=status paragraph — the exact node pending()
  // writes. Observation only: no second transport, no authority, no product
  // path change.
  await f.page.evaluate(()=>{const el=document.getElementById('shell.context-selection');
   const snap=()=>({state:el?.dataset.state??null,module:el?.dataset.module??null,selection:el?.dataset.selection??null,pending:el?.querySelector('[role="status"]')?.textContent??''});
   window.__pan548RetirementMilestones548=[snap()];
   new MutationObserver(()=>{window.__pan548RetirementMilestones548.push(snap());}).observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-state','data-module','data-selection']});});
  await f.page.getByRole('button',{name:'Einrichtung und Betriebszustand',exact:true}).click();
  // RUN95 (source-correlated correction of the RUN54 oracle): the real source
  // produces TWO legitimate unbound-retirement milestones with different
  // pending text — the synchronous immediate retirement retire() at
  // context-selection-v1.ts:144 ("Kontextwechsel: Alte Auswahl und ausstehende
  // Antworten werden verworfen …", invalidate + cleared module/selection) and
  // the successor bind()'s own announcement at :271 ("Nativen Seitenkontext
  // prüfen …"), which is effect-queue serialized behind the still-held admitted
  // START and may therefore legally arrive later on a slower runner. The
  // oracle reads the FIRST recorded UPDATING_CONTEXT snapshot from the real
  // ordered event stream (no sleep, no broad text waiver): cleared module/
  // selection AND a pending message exactly equal to one of the two closed
  // retirement texts the source itself can write in this state. NO new
  // confirmed native context is claimed yet; anything else fails closed.
  await f.page.waitForFunction(()=>window.__pan548RetirementMilestones548.some(m=>m.state==='UPDATING_CONTEXT'));
  const contextSelection=f.page.locator('[id="shell.context-selection"]');
  const retirementMilestonesV195=await f.page.evaluate(()=>window.__pan548RetirementMilestones548);
  const firstUnboundV195=retirementMilestonesV195.findIndex(m=>m.state==='UPDATING_CONTEXT');
  assert.ok(firstUnboundV195>=0,'PAN548_UNBOUND_RETIREMENT_MILESTONE_NOT_RECORDED');
  const firstUnboundSnapshotV195=retirementMilestonesV195[firstUnboundV195];
  assert.deepEqual({state:firstUnboundSnapshotV195.state,module:firstUnboundSnapshotV195.module,selection:firstUnboundSnapshotV195.selection},{state:'UPDATING_CONTEXT',module:'',selection:''},'PAN548_UNBOUND_RETIREMENT_CLAIMS_A_CONFIRMED_CONTEXT');
  assert.ok(firstUnboundSnapshotV195.pending==='Kontextwechsel: Alte Auswahl und ausstehende Antworten werden verworfen …'||firstUnboundSnapshotV195.pending==='Nativen Seitenkontext prüfen …','PAN548_UNBOUND_RETIREMENT_PENDING_MESSAGE_MISSING:'+JSON.stringify(firstUnboundSnapshotV195));
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
  writeFileSync(join(evidence(),'retirement-held-window-v157.json'),JSON.stringify({admittedAtMs,releasedAtMs,heldMs:releasedAtMs-admittedAtMs,grantMaxTimeMs:25_000,contextSelection:await contextSelection.evaluate(e=>({state:e.dataset.state,module:e.dataset.module})),panel:retired,nativeNetwork:f.nativeNetwork,retirementMilestones:await f.page.evaluate(()=>window.__pan548RetirementMilestones548)},null,2)+'\n');
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
  await f.page.locator('[id="shell.context-selection"][data-module="pan.setup"][data-state="CURRENT_CONTEXT"]').waitFor();
  // RUN95: the recorded stream must ALSO contain the genuine successor bind
  // milestone — bind() writes its own closed pending text synchronously at
  // entry (context-selection-v1.ts:271), so a real pan.setup CURRENT_CONTEXT
  // binding without that recorded UPDATING_CONTEXT milestone would mean the
  // binding bypassed the source's retirement path. Phase-correlated evidence,
  // read from the same ordered observer stream installed before the click.
  const boundMilestonesV195=await f.page.evaluate(()=>window.__pan548RetirementMilestones548);
  assert.ok(boundMilestonesV195.length>=retirementMilestonesV195.length,'PAN548_RETIREMENT_MILESTONE_STREAM_WAS_RESET');
  assert.ok(boundMilestonesV195.slice(firstUnboundV195).some(m=>m.state==='UPDATING_CONTEXT'&&m.pending==='Nativen Seitenkontext prüfen …'),'PAN548_SETUP_BIND_MILESTONE_NOT_RECORDED');
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

// RUN65: the coherent original548 PUI07-AC04 authority-LOSS journey in the real
// browser assembly. The revocation is the ACTUAL trusted native565 connection
// owner close, surfaced through the existing fixture seam
// (browser-fixture.mjs modelConnectionOwner -> workspace-browser.mjs
// modelConnectionOwnerV1 — the very same frozen owner object the mount created,
// no forged DTO, no route, no fetch stub, no invented browser cancel API).
// Sequence: exactly one browser START reaches a genuine held RUNNING through
// the existing same-shell independent read; the ORIGINAL context stays fully
// current (asserted on the real context-selection milestone); ONLY the bound
// admission is revoked. The shell's own in-flight start reply — not a re-read
// and not a reload — carries the honest terminal OUTCOME_UNCONFIRMED: the
// aborted admission lifetime surfaces as the closed LOOP_FAILURE_UNCLASSIFIED
// diagnosis with null counts, the full UNKNOWN hold stays retained untouched
// (nothing settles, resets or consumes), and the original admitted provenance
// survives. An independent same-shell read reconfirms UNKNOWN through the
// still-open agent owner; every control that is unavailable stays disabled and
// explained; a forced click cannot replay the start. Releasing the held peer
// revives nothing and never consumes a second provider POST. A real reload
// preserves the original provenance and the full retained hold, and the closed
// connection owner honestly DENIES its own readback (the connection panel
// explains the unavailable operation instead of pretending readiness).
// Controlled local HTTP framing only — explicitly NOT LLM evidence.
test('PUI07 actual browser bound admission revoked by the real565 owner close during a genuinely held start: RUNNING stops to honest OUTCOME_UNCONFIRMED with the full UNKNOWN hold and original provenance on the start reply itself, independent read reconfirms, reload preserves provenance/hold with honest closed-owner read denial, peer release revives nothing; NOT LLM',async()=>{
 const f=await connectedFixture({holdPeer:true,maxTimeMs:25000});try{
  const before=f.business();await open(f);await selectConnectedView(f);await connect(f);const p=await boundPlan(f);
  await f.page.locator('#pan548-agent-inference-consent').check();
  const start=f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true});
  // Retained real DOM identity: the applied RUNNING read rewrites this same
  // button's label; identity/guard assertions stay bound to the real node.
  const startControl=await start.elementHandle();
  const readButton=f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true});
  await start.click();await f.peerHeld;await f.flushResponses();
  assert.equal(f.posts(),1,'PAN548_REVOCATION_EXACTLY_ONE_HELD_PROVIDER_POST');assert.equal(count(f,'start'),1);
  // Genuine RUNNING in the same still-open shell through the existing manual
  // independent read — no reload, no polling, no fabricated cancellation.
  await showAgentTechnicalUI(f.page);await readButton.click();await state(f,'RUNNING');await f.flushResponses();
  const running=getReadsV1548(f).filter(r=>r.status===200).at(-1).value;
  assert.ok(running,'PAN548_REVOCATION_CASE_IN_FLIGHT_RUNNING_READ_MISSING');
  assert.equal(running.runId,p.runId);assert.equal(running.phase,'RUNNING');assert.equal(running.proposal,null);
  assert.deepEqual(running.binding,p.binding,'PAN548_REVOCATION_RUNNING_READ_LOST_THE_ADMITTED_BINDING');
  assert.equal(running.sourceDigest,p.sourceDigest);assert.deepEqual(running.sourceRevisions,p.sourceRevisions);
  const retained=running.budget;
  assert.ok(retained.model.committedUnits>0&&retained.runtime.committedUnits>0&&retained.model.consumedUnits===0&&retained.runtime.consumedUnits===0,'PAN548_REVOCATION_RUNNING_HOLD_NOT_FULL:'+JSON.stringify(retained));
  assert.equal(retained.reservations,1,'PAN548_REVOCATION_HELD_RESERVATION_COUNT_NOT_ONE');
  await f.page.locator(root).screenshot({path:join(evidence(),'desktop-native-owner-admission-revocation-running-held-peer.png')});
  // Revoke the bound admission ITSELF: the real trusted 565 owner close while
  // the peer still holds that one POST. Nothing else is touched — no reload,
  // no navigation, no context change.
  const modelOwner=f.modelConnectionOwner();
  assert.ok(modelOwner&&typeof modelOwner.close==='function','PAN548_REVOCATION_REAL565_OWNER_MISSING_FROM_FIXTURE_SEAM');
  const readsAtRevoke=getReadsV1548(f).length;
  modelOwner.close();
  // The ORIGINAL context is still fully current at the revocation instant —
  // the context-selection still shows its confirmed pan.erv milestone, so the
  // stopped RUNNING proof below is attributable to the revoked admission
  // alone, not to a retired or stale context.
  assert.deepEqual(await f.page.locator('[id=\"shell.context-selection\"]').evaluate(e=>({state:e.dataset.state,module:e.dataset.module})),{state:'CURRENT_CONTEXT',module:'pan.erv'},'PAN548_REVOCATION_CONTEXT_NOT_CURRENT_AT_REVOCATION_INSTANT');
  // The synchronously aborted admission lifetime ends the RUNNING proof on
  // this shell's OWN in-flight start reply — no re-read, no reload, no wait
  // for the unreturned peer hold.
  await state(f,'OUTCOME_UNCONFIRMED');await f.flushResponses();
  assert.ok(f.nativeNetwork.some(r=>r.path.endsWith('/agent-run/start')&&r.status===200&&Number.isSafeInteger(r.finishedAt)),'PAN548_REVOCATION_START_REPLY_MUST_HAVE_FINISHED_AT_THE_GATEWAY');
  assert.equal(getReadsV1548(f).length,readsAtRevoke,'PAN548_REVOCATION_TERMINAL_MUST_ARRIVE_ON_THE_START_REPLY_NOT_A_RE_READ');
  const terminal=f.responses.filter(r=>r.path.endsWith('/agent-run/start')&&r.status===200).at(-1).value;
  assert.ok(terminal,'PAN548_REVOCATION_START_200_REPLY_MISSING');
  assert.equal(terminal.phase,'OUTCOME_UNCONFIRMED');assert.equal(terminal.runId,p.runId);assert.equal(terminal.proposal,null);assert.equal(terminal.realModelAcceptance,false);
  // The aborted execution records the explicit unclassified failure with null
  // counts through the existing565 task-authority recheck — never a
  // fabricated success and never a zero-usage settle.
  assert.deepEqual(terminal.failureDiagnosis,{schemaVersion:'pansphaira.workspace-agent/failure-diagnosis/v1',runId:p.runId,requestDigest:terminal.requestDigest,reason:'LOOP_FAILURE_UNCLASSIFIED',exitCode:2,actualRequests:null,actualToolActions:null,settledUsageConfirmed:false,realModelAcceptance:false},'PAN548_REVOCATION_TERMINAL_DIAGNOSIS_NOT_THE_ABORTED_ADMISSION_TRUTH');
  assert.equal(terminal.budget.model.committedUnits,retained.model.committedUnits,'PAN548_REVOCATION_RESET_THE_MODEL_HOLD');
  assert.equal(terminal.budget.runtime.committedUnits,retained.runtime.committedUnits,'PAN548_REVOCATION_RESET_THE_RUNTIME_HOLD');
  assert.equal(terminal.budget.model.consumedUnits,0,'PAN548_REVOCATION_SETTLED_MODEL_UNITS');
  assert.equal(terminal.budget.runtime.consumedUnits,0,'PAN548_REVOCATION_SETTLED_RUNTIME_UNITS');
  assert.equal(terminal.budget.reservations,1,'PAN548_REVOCATION_DUPLICATED_OR_DROPPED_THE_RESERVATION');
  // An independent same-shell read honestly reconciles the same UNKNOWN
  // through the still-open agent owner: the closed connection owner denies
  // ITS OWN readback, but the agent ledger read stays independent and stays
  // terminal with the unchanged request binding and provenance.
  const readsBeforeReconfirm=getReadsV1548(f).length;
  await readButton.click();
  await waitForActualV1548(()=>getReadsV1548(f).length>readsBeforeReconfirm,'POST_REVOCATION_INDEPENDENT_READ');await f.flushResponses();
  await state(f,'OUTCOME_UNCONFIRMED');
  const reconfirmed=getReadsV1548(f).filter(r=>r.status===200).at(-1).value;
  assert.equal(reconfirmed.phase,'OUTCOME_UNCONFIRMED');assert.equal(reconfirmed.runId,p.runId);
  assert.equal(reconfirmed.requestDigest,terminal.requestDigest,'PAN548_POST_REVOCATION_READ_REQUEST_DIGEST_CHANGED');
  assert.deepEqual(reconfirmed.binding,p.binding,'PAN548_POST_REVOCATION_READ_LOST_THE_ORIGINAL_PROVENANCE');
  assert.equal(reconfirmed.sourceDigest,p.sourceDigest);assert.deepEqual(reconfirmed.sourceRevisions,p.sourceRevisions);
  assert.equal(reconfirmed.budget.model.committedUnits,retained.model.committedUnits);assert.equal(reconfirmed.budget.model.consumedUnits,0,'PAN548_POST_REVOCATION_READ_CONSUMED_THE_RETAINED_HOLD');
  // The real panel DOM explains the revoked state: minimized diagnosis with
  // explicitly-not-measured counts, retained-hold settlement row, historical
  // original provenance — and no stale RUNNING/success anywhere.
  const visible=await f.page.locator(root).innerText();
  for(const literal of ['Fehlerdiagnose (minimiert, native Projektion)','Ausfall nicht klassifiziert — keine minimierten Details verfügbar','Exit 2 — fachliche Ablehnung ohne Budgettreffer','Anfragen nicht gemessen (kein Nullwert) · Werkzeugaktionen nicht gemessen (kein Nullwert)','Verbrauch nicht bestätigt — volle Reservierung bleibt erhalten','Historische Laufquelle des nativen Laufs','Historische Laufquellenrevisionen des nativen Laufs',p.sourceDigest,'ERV '+p.sourceRevisions.erv+' · Human '+p.sourceRevisions.human,'ursprünglich zum Lauf aufgezeichnet; nicht aktuell verifiziert; keine Freigabe zum Speichern, Anwenden oder Wiederholen'])assert.ok(visible.includes(literal),'PAN548_REVOCATION_PANEL_ROW_MISSING:'+literal);
  for(const stale of ['Native Laufausführung','Aktuell beobachtet','RESULT_READY'])assert.ok(!visible.includes(stale),'PAN548_REVOCATION_STALE_RUNNING_OR_SUCCESS_LEAK:'+stale);
  // Every unavailable operation stays disabled and label-explained; the one
  // admitted start cannot be replayed by a forced click on the retained node.
  for(const label of ['Lauf abbrechen — nicht verfügbar','Lauf fortsetzen — nicht verfügbar'])assert.equal(await f.page.locator(root).getByRole('button',{name:label,exact:true}).isDisabled(),true,'PAN548_REVOCATION_MUST_NOT_ENABLE_TASK_CONTROL:'+label);
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).isDisabled(),true,'PAN548_REVOCATION_MUST_NOT_KEEP_PREVIEW_AUTHORITY');
  assert.equal(await startControl.evaluate(e=>e.disabled),true,'PAN548_REVOCATION_MUST_NOT_ENABLE_A_START_RETRY');
  await startControl.evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  assert.equal(count(f,'start'),1,'PAN548_REVOCATION_FORCED_CLICK_REPLAYED_THE_START');
  assert.equal(f.posts(),1,'PAN548_REVOCATION_DISPATCHED_A_SECOND_PROVIDER_POST');
  assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);
  await connectedCapture(f,'desktop-native-owner-admission-revoked-unknown-no-retry');
  // Releasing the still-held peer revives nothing: a genuine further round
  // trip re-reads the SAME terminal UNKNOWN and the peer still saw exactly
  // one POST — the released, already-aborted callback never becomes a retry.
  f.releasePeer();
  const readsBeforeReleaseRead=getReadsV1548(f).length;
  await readButton.click();
  await waitForActualV1548(()=>getReadsV1548(f).length>readsBeforeReleaseRead,'POST_RELEASE_READ');await f.flushResponses();
  await state(f,'OUTCOME_UNCONFIRMED');
  const afterRelease=getReadsV1548(f).filter(r=>r.status===200).at(-1).value;
  assert.equal(afterRelease.phase,'OUTCOME_UNCONFIRMED');assert.equal(afterRelease.requestDigest,terminal.requestDigest,'PAN548_POST_RELEASE_READ_REQUEST_DIGEST_CHANGED');
  assert.equal(afterRelease.budget.model.consumedUnits,0,'PAN548_PEER_RELEASE_SETTLED_THE_RETAINED_HOLD');
  assert.equal(f.posts(),1,'PAN548_PEER_RELEASE_REVIVED_A_SECOND_PROVIDER_POST');assert.equal(count(f,'start'),1);
  // A real reload preserves the original provenance and the full retained
  // hold; the auto-reconciled read stays terminal UNKNOWN. The reload
  // registered a fresh current tab — the retained historical binding belongs
  // to the ORIGINAL tab and is never relabeled.
  await f.page.reload();await showCurrentContextDetailsUI(f.page);await f.page.locator('[id=\"shell.context-selection\"][data-module=\"pan.erv\"][data-state=\"CURRENT_CONTEXT\"]').waitFor();await state(f,'OUTCOME_UNCONFIRMED');await f.flushResponses();
  const reopened=f.responses.filter(r=>r.method==='GET'&&r.path.endsWith('/agent-run/read')&&r.status===200).at(-1).value;
  assert.ok(reopened,'PAN548_REVOCATION_RELOAD_AUTOMATIC_NATIVE_READ_MISSING');
  assert.equal(reopened.runId,p.runId,'PAN548_REVOCATION_REOPENED_READ_NOT_THE_SAME_RUN');
  assert.equal(reopened.requestDigest,terminal.requestDigest,'PAN548_REVOCATION_RELOADED_READ_REQUEST_DIGEST_CHANGED');
  assert.equal(reopened.phase,'OUTCOME_UNCONFIRMED');
  const currentTab=f.responses.filter(r=>r.method==='POST'&&r.path.endsWith('/context-selection')&&r.status===200).at(-1).value.context.binding;
  assert.notEqual(currentTab.tabId,p.binding.tabId,'PAN548_REVOCATION_RELOAD_EXPECTED_A_FRESH_CURRENT_TAB');
  assert.deepEqual(reopened.binding,p.binding,'PAN548_REVOCATION_RELOAD_RELABELED_THE_ORIGINAL_BINDING');
  assert.equal(reopened.sourceDigest,p.sourceDigest,'PAN548_REVOCATION_HISTORICAL_SOURCE_DIGEST_CHANGED_AFTER_RELOAD');
  assert.deepEqual(reopened.sourceRevisions,p.sourceRevisions,'PAN548_REVOCATION_HISTORICAL_SOURCE_REVISIONS_CHANGED_AFTER_RELOAD');
  assert.equal(reopened.budget.model.committedUnits,retained.model.committedUnits,'PAN548_REVOCATION_MODEL_HOLD_NOT_INTACT_AFTER_RELOAD');
  assert.equal(reopened.budget.runtime.committedUnits,retained.runtime.committedUnits,'PAN548_REVOCATION_RUNTIME_HOLD_NOT_INTACT_AFTER_RELOAD');
  assert.equal(reopened.budget.model.consumedUnits,0);assert.equal(reopened.budget.reservations,1,'PAN548_REVOCATION_RESERVATION_COUNT_CHANGED_AFTER_RELOAD');
  const reopenedVisible=await f.page.locator(root).innerText();
  for(const literal of ['Historische Laufquelle des nativen Laufs','Ausfall nicht klassifiziert — keine minimierten Details verfügbar','Verbrauch nicht bestätigt — volle Reservierung bleibt erhalten'])assert.ok(reopenedVisible.includes(literal),'PAN548_REVOCATION_PROVENANCE_NOT_RETAINED_AFTER_RELOAD:'+literal);
  // The closed connection owner DENIES its own readback after reload — the
  // actual closed-owner read denial the contract requires, explained by the
  // connection panel instead of any fabricated readiness, and without the
  // unavailability touching the independent agent ledger read above. The
  // dialog starts collapsed (body.hidden, so innerText excludes it): the real
  // user path opens the existing disclosure first, then reads the explanation.
  await f.page.locator('[id=\"shell.model-connection\"]').getByRole('button',{name:'Sichere Modellverbindung öffnen',exact:true}).click();
  const connectionVisible=await f.page.locator('[id=\"shell.model-connection\"]').innerText();
  assert.ok(connectionVisible.includes('nicht aktuell bestätigt'),'PAN548_REVOKED_CONNECTION_MUST_HONESTLY_DENY_THE_READ_AFTER_RELOAD:'+connectionVisible.slice(0,300));
  // RUN66: the closed owner's own read denial is ALSO proven as the real
  // HTTP fact the shared collector recorded — the genuine GET409
  // (MODEL_CONNECTION_OWNER_CLOSED through the protected ingress). The
  // product request() rejects this denied response BEFORE consuming its
  // body, so the honest observation is exactly method/path/status409 with
  // the body left unparsed/null: no invented DTO, no invented body-read
  // failure the page itself never attempted, no swallowed denial.
  const closedOwnerRead=f.responses.filter(r=>r.method==='GET'&&r.path.endsWith('/workspace/model-connection')).at(-1);
  assert.ok(closedOwnerRead&&closedOwnerRead.status===409,'PAN548_REVOKED_MODEL_CONNECTION_MUST_HAVE_A_REAL_409_READ_DENIAL:'+JSON.stringify(f.responses.filter(r=>r.path.includes('model-connection')).map(({method,path,status})=>({method,path,status}))));
  assert.equal(closedOwnerRead.value,null,'PAN548_REVOKED_MODEL_CONNECTION_409_MUST_NOT_INVENT_A_BODY_VALUE');
  assert.equal(Object.hasOwn(closedOwnerRead,'bodyReadFailure'),false,'PAN548_REVOKED_MODEL_CONNECTION_409_MUST_NOT_RECORD_A_BODY_FAILURE_THE_PAGE_NEVER_CONSUMED');
  assert.equal(closedOwnerRead.bodyNotObserved,'NON_200_BODY_NOT_OBSERVED_BY_FIXTURE','PAN548_REVOKED_MODEL_CONNECTION_409_MUST_DECLARE_THE_UNOBSERVED_BODY_HONESTLY');
  assert.ok(!(await f.page.locator('body').innerText()).includes(syntheticCredential565),'NATIVE_OWNER_SECRET_VISIBLE');
  assert.equal(f.posts(),1);assert.equal(count(f,'start'),1);assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);assert.deepEqual(f.errors,[]);
 }finally{try{f.releasePeer();}catch{/* gate already open or fixture owned */}await f.close();}
});
// RUN76: the displayed native plan/offer deadline lifecycle on the real mounts.
// The browser-only clock seam (Playwright page.clock, the same shape the
// accepted565 expiry journey proved) is installed BEFORE navigation so the
// product's own plan/offer expiry timer genuinely lives in the fake queue.
// It moves nothing but the page clock: the native backend, its plan/lease/
// offer verdicts, the closed DTO checks and the ledger keep their real
// authority; no response, consent or body is fabricated and no case claims
// real model inference. The backend authority in every assertion below is the
// actual captured native plan response (f.responses), never a test-invented
// timestamp.
test('PUI07 RUN76 actual browser plain synthetic displayed plan deadline: a browser-only clock installed before navigation reaches the exact native plan timestamp, latches the truthful Browseruhr expiry reason, disables the stale cached start against a forced click with zero hidden requests, clock realignment revives nothing while an edit clears only the stale explanation and preserves the unsent text, and only an explicit re-plan on the still-valid native context publishes a NEW plan whose one real start reaches RESULT_READY; NOT LLM',async()=>{
 const f=await nativeViewBrowserFixture546({agentRuns:true});
 try{
  const before=f.business();
  await f.page.clock.install();
  await open(f);await select(f);
  const ta=f.page.locator('#pan548-agent-intent');
  const intentText='Ausgewähltes Viewelement kleiner darstellen, zunächst nur Vorschlag.';
  await ta.fill(intentText);
  const p=await plan(f);
  assert.ok(Number.isSafeInteger(p.expiresAtMs)&&p.expiresAtMs>await f.page.evaluate(()=>Date.now()),'PAN548_RUN76_PLAN_DEADLINE_NOT_FRESH_AT_PLAN');
  const deadlineView=await f.page.locator(root+' dl').innerText();
  assert.ok(deadlineView.includes('Ablauf des Plans (exakter Zeitstempel)')&&deadlineView.includes(new Date(p.expiresAtMs).toISOString()),'PAN548_RUN76_DISPLAYED_DEADLINE_NOT_THE_NATIVE_PLAN_TIMESTAMP');
  assert.equal(await f.page.locator(root).getAttribute('data-plan-expired-reason'),null,'PAN548_RUN76_EXPIRY_MARKER_BEFORE_DEADLINE');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'true','PAN548_RUN76_START_NOT_ACTIONABLE_BEFORE_EXPIRY');
  const requestsBefore=f.requests.length;
  await f.page.clock.fastForward(p.expiresAtMs-await f.page.evaluate(()=>Date.now())+250);
  await f.page.locator(root+'[data-plan-expired-reason]').waitFor();
  assert.equal(await f.page.locator(root).getAttribute('data-plan-expired-reason'),'PLAN_EXPIRED','PAN548_RUN76_SYNTHETIC_EXPIRY_REASON_NOT_PLAN_ONLY');
  const expiryNote=f.page.locator('[data-agent-plan-expiry="true"]');
  const noteText=await expiryNote.innerText();
  assert.ok(noteText.includes('Der angezeigte native Plan ist abgelaufen (Ablauf '+new Date(p.expiresAtMs).toISOString()+', Browseruhr)')&&noteText.includes('Browseruhr entfernt nur die Handlungsbarkeit')&&noteText.includes('Der Auftragstext oben bleibt unverändert und wurde nicht gesendet'),'PAN548_RUN76_SYNTHETIC_EXPIRY_NOTE_NOT_TRUTHFUL:'+noteText);
  assert.ok(!noteText.includes('Das angezeigte gebundene Angebot'),'PAN548_RUN76_SYNTHETIC_EXPIRY_FABRICATED_AN_OFFER');
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'PLANNED_NOT_DISPATCHED','PAN548_RUN76_LOCAL_EXPIRY_CHANGED_PHASE');
  assert.ok((await f.page.locator(root+' p[role="status"]').innerText()).includes('kein automatischer Neuversuch'),'PAN548_RUN76_EXPIRY_STATUS_NOT_HONEST_NO_RETRY');
  const startControl=f.page.locator(root).getByRole('button',{name:'Genau diesen synthetischen Lauf starten',exact:true});
  assert.equal(await startControl.isDisabled(),true,'PAN548_RUN76_STALE_START_STILL_ENABLED');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN76_STALE_START_STILL_MARKED_ACTIONABLE');
  await startControl.evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  assert.equal(count(f,'start'),0,'PAN548_RUN76_FORCED_STALE_CLICK_DISPATCHED');
  assert.equal(await ta.inputValue(),intentText,'PAN548_RUN76_UNSENT_TEXT_NOT_PRESERVED_AT_EXPIRY');
  await capture(f,'desktop-agent-synthetic-plan-expired');
  // A corrected browser clock revives nothing: the native backend still
  // considers this plan fully valid (real time barely moved), so ONLY the
  // per-plan latch can keep the stale start disabled at this point.
  await f.page.clock.setSystemTime(Date.now());
  assert.equal(await expiryNote.isVisible(),true,'PAN548_RUN76_CORRECTED_CLOCK_DROPPED_LATCH');
  assert.equal(await startControl.isDisabled(),true,'PAN548_RUN76_CORRECTED_CLOCK_ENABLED_STALE_START');
  // An edit clears only the stale explanation and its marker; the unsent
  // text survives, still never sent, and no dispatch or request follows.
  await ta.click();await ta.press('End');await ta.pressSequentially(' und kompakter.');
  assert.equal(await expiryNote.isVisible(),false,'PAN548_RUN76_EDIT_KEPT_STALE_EXPIRY_NOTE');
  assert.equal(await f.page.locator(root).getAttribute('data-plan-expired-reason'),null,'PAN548_RUN76_EDIT_KEPT_STALE_EXPIRY_MARKER');
  assert.equal(await ta.inputValue(),intentText+' und kompakter.','PAN548_RUN76_EDIT_LOST_UNSENT_TEXT');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN76_EDIT_RESURRECTED_START');
  assert.equal(count(f,'start'),0,'PAN548_RUN76_EDIT_TRIGGERED_DISPATCH');
  await f.flushResponses();
  assert.equal(f.requests.length,requestsBefore,'PAN548_RUN76_HIDDEN_REQUESTS_DURING_EXPIRY_HANDLING');
  // Only the explicit re-plan on the still-valid native context publishes a
  // NEW plan (new handle, new run) that can start again.
  await f.page.locator(root).getByRole('button',{name:'Begrenzten Testauftrag planen',exact:true}).click();
  await state(f,'PLANNED_NOT_DISPATCHED');await f.flushResponses();
  const p2=f.responses.filter(r=>r.path.endsWith('/agent-run/plan')&&r.status===200).at(-1).value;
  assert.notEqual(p2.planHandle,p.planHandle,'PAN548_RUN76_REPLAN_REPUBLISHED_OLD_PLAN_HANDLE');
  assert.notEqual(p2.runId,p.runId,'PAN548_RUN76_REPLAN_REPUBLISHED_OLD_RUN');
  assert.equal(await f.page.locator(root).getAttribute('data-plan-expired-reason'),null,'PAN548_RUN76_REPLAN_KEPT_STALE_MARKER');
  assert.equal(await expiryNote.isVisible(),false,'PAN548_RUN76_REPLAN_KEPT_STALE_NOTE');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'true','PAN548_RUN76_NEW_PLAN_START_NOT_ACTIONABLE');
  await run(f);
  assert.equal(count(f,'start'),1,'PAN548_RUN76_RECOVERY_DISPATCHED_MORE_THAN_ONCE');
  assert.equal(f.readPersisted().revision,0,'PAN548_RUN76_RECOVERY_PERSISTED_VIEW');
  assert.equal(f.business(),before,'PAN548_RUN76_RECOVERY_BUSINESS_EFFECT');
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).isDisabled(),false,'PAN548_RUN76_RECOVERY_LOST_SEPARATE_PREVIEW');
  await capture(f,'desktop-agent-synthetic-plan-expiry-recovered');
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
test('PUI07 RUN76 actual browser owner-bound synthetic offer deadline independent of the plan deadline: a browser-only clock past the exact native offer timestamp unchecks and disables the exact offer while the separate plan facts stay displayed and truthful, a corrected browser clock revives no consent, and an explicit fresh prepare publishes a NEW unchecked offer that dispatches exactly one bounded dispatch only after the separate manual consent, whose genuine completed feedback round is exactly two provider POSTs (tool-call turn plus tool-feedback answer); NOT LLM',async()=>{
 const f=await connectedFixture();
 try{
  const before=f.business();
  await f.page.clock.install();
  await open(f);await selectConnectedView(f);await connect(f);
  const p=await boundPlan(f);const o=p.inferenceConsentOffer;
  assert.ok(o.expiresAtMs<p.expiresAtMs,'PAN548_RUN76_OFFER_NOT_THE_EARLIER_SEPARATE_DEADLINE');
  const deadlineView=await f.page.locator(root+' dl').innerText();
  assert.ok(deadlineView.includes(new Date(p.expiresAtMs).toISOString())&&deadlineView.includes(new Date(o.expiresAtMs).toISOString()),'PAN548_RUN76_OFFER_DEADLINE_NOT_DISPLAYED_VERBATIM');
  const consent=f.page.locator('#pan548-agent-inference-consent');
  assert.equal(await consent.isChecked(),false,'PAN548_RUN76_FRESH_OFFER_AUTO_CONSENTED');
  const startsBefore=count(f,'start');const requestsBefore=f.requests.length;
  await f.page.clock.fastForward(o.expiresAtMs-await f.page.evaluate(()=>Date.now())+250);
  await f.page.locator(root+'[data-plan-expired-reason]').waitFor();
  assert.equal(await f.page.locator(root).getAttribute('data-plan-expired-reason'),'OFFER_EXPIRED','PAN548_RUN76_OFFER_EXPIRY_REASON_NOT_OFFER_ONLY');
  const expiryNote=f.page.locator('[data-agent-plan-expiry="true"]');
  const noteText=await expiryNote.innerText();
  assert.ok(noteText.includes('Das angezeigte gebundene Angebot ist abgelaufen (Ablauf '+new Date(o.expiresAtMs).toISOString()+', Browseruhr)'),'PAN548_RUN76_OFFER_EXPIRY_NOTE_NOT_TRUTHFUL:'+noteText);
  assert.ok(!noteText.includes('Der angezeigte native Plan ist abgelaufen'),'PAN548_RUN76_OFFER_EXPIRY_FAKED_PLAN_EXPIRY');
  // The plan deadline, the lease and the persisted history stay distinct
  // facts: the still-valid plan rows remain displayed, unrewritten.
  assert.ok((await f.page.locator(root+' dl').innerText()).includes(new Date(p.expiresAtMs).toISOString()),'PAN548_RUN76_PLAN_FACTS_REWRITTEN_ON_OFFER_EXPIRY');
  assert.equal(await consent.isChecked(),false,'PAN548_RUN76_OFFER_EXPIRY_KEPT_CONSENT_CHECKED');
  assert.equal(await consent.isDisabled(),true,'PAN548_RUN76_STALE_OFFER_CONSENT_STILL_ENABLED');
  assert.equal(await f.page.evaluate(()=>document.querySelector('label[for="pan548-agent-inference-consent"]').hidden),true,'PAN548_RUN76_STALE_OFFER_LABEL_STILL_SHOWN');
  const startControl=f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true});
  assert.equal(await startControl.isDisabled(),true,'PAN548_RUN76_STALE_BOUND_START_STILL_ENABLED');
  await startControl.evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  assert.equal(count(f,'start'),startsBefore,'PAN548_RUN76_FORCED_STALE_BOUND_CLICK_DISPATCHED');
  assert.equal(f.posts(),0,'PAN548_RUN76_PROVIDER_POST_AFTER_STALE_BOUND_CLICK');
  await new Promise(r=>setTimeout(r,150));await f.flushResponses();
  assert.equal(f.requests.length,requestsBefore,'PAN548_RUN76_HIDDEN_REQUESTS_AFTER_OFFER_EXPIRY');
  await connectedCapture(f,'desktop-agent-bound-offer-expired');
  // The corrected browser clock revives no consent: natively the owner
  // grant, the lease and the ledger are untouched — only the shown offer
  // window lapsed by page clock, and the latch keeps that honest.
  await f.page.clock.setSystemTime(Date.now());
  assert.equal(await expiryNote.isVisible(),true,'PAN548_RUN76_CORRECTED_CLOCK_DROPPED_OFFER_LATCH');
  assert.equal(await startControl.isDisabled(),true,'PAN548_RUN76_CORRECTED_CLOCK_ENABLED_STALE_BOUND_START');
  assert.equal(await consent.isDisabled(),true,'PAN548_RUN76_CORRECTED_CLOCK_REVIVED_STALE_OFFER');
  // Only the explicit fresh prepare from the still-valid native selection
  // publishes a NEW plan with a NEW unchecked offer.
  await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).click();
  await state(f,'PLANNED_NOT_DISPATCHED');await f.flushResponses();
  const p2=f.responses.filter(r=>r.path.endsWith('/agent-run/plan')&&r.status===200).at(-1).value;
  assert.notEqual(p2.planHandle,p.planHandle,'PAN548_RUN76_REPLAN_REPUBLISHED_OLD_BOUND_PLAN');
  assert.notEqual(p2.runId,p.runId,'PAN548_RUN76_REPLAN_REPUBLISHED_OLD_BOUND_RUN');
  assert.equal(p2.inferenceConsentOffer.purpose,'purpose:ui-view-proposal','PAN548_RUN76_REPLACED_OFFER_PURPOSE_DRIFT');
  assert.ok(p2.inferenceConsentOffer.expiresAtMs>await f.page.evaluate(()=>Date.now()),'PAN548_RUN76_REPLACED_OFFER_NOT_FRESH');
  assert.equal(await f.page.locator(root).getAttribute('data-plan-expired-reason'),null,'PAN548_RUN76_REPLAN_KEPT_STALE_OFFER_MARKER');
  assert.equal(await consent.isChecked(),false,'PAN548_RUN76_FRESH_OFFER_AUTO_CONSENTED_AFTER_REPLAN');
  assert.equal(await consent.isDisabled(),false,'PAN548_RUN76_FRESH_OFFER_CONSENT_NOT_ENABLED');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN76_BOUND_START_ACTIONABLE_WITHOUT_FRESH_CONSENT');
  await consent.check();
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'true','PAN548_RUN76_FRESH_CONSENT_DID_NOT_ENABLE_START');
  await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await state(f,'RESULT_READY');await f.flushResponses();
  assert.equal(count(f,'start'),startsBefore+1,'PAN548_RUN76_RECOVERY_BOUND_DISPATCH_COUNT');
  // The genuine same-origin framing peer answers the admitted bounded round
  // exactly like the real OpenAI-compatible server: a tool-bearing first
  // provider POST and the final second POST carrying the two native tool
  // feedbacks. One AGENT_START is one dispatch, never one HTTP request; every
  // existing completed-round test in this file asserts the same two POSTs.
  assert.equal(f.posts(),2,'PAN548_RUN76_RECOVERY_PROVIDER_POSTS');
  assert.equal(await expiryNote.isVisible(),false,'PAN548_RUN76_DISPATCH_KEPT_STALE_OFFER_NOTE');
  assert.equal(await f.page.locator(root).getAttribute('data-plan-expired-reason'),null,'PAN548_RUN76_DISPATCH_KEPT_STALE_OFFER_MARKER');
  assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);
  await connectedCapture(f,'desktop-agent-bound-offer-expiry-recovered');
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
test('PUI07 RUN76 stale offer-expiry timer during a genuinely held same-shell dispatch never overwrites the true DISPATCHING run: fast-forwarding the browser-only clock past the displayed offer deadline while the exact one-time start is held keeps DISPATCHING with no expiry latch and no extra request, and releasing the peer settles RESULT_READY with exactly one dispatch delivering the genuine two-POST tool feedback round (tool-call turn plus tool-feedback answer); NOT LLM',async()=>{
 // The fixture raises ONLY its own already-closed grant limit maxTimeMs to
 // 30000 — the existing contracts ceiling (workspace-model-connection-v1.ts
 // ceilings). The product then derives the START transport as
 // offer.limits.maxTimeMs + the unchanged 5000ms round-trip margin
 // (context-selection-v1.ts AGENT_START rule) = 35000ms, so the in-flight
 // genuine one-time START survives the deliberate ~30250ms fake-clock
 // advance; no global timeout was raised or removed. Server-side real time
 // — grant (+180000ms), lease (+300000ms), offer (min(now+30000ms)) and the
 // admitted loop — barely moves, while the installed page clock alone jumps
 // past the displayed offer deadline and fires the page expiry timer. RUN90:
 // because this installed page clock patches AbortSignal.timeout as well, the
 // ~30250ms jump already consumes the 35000ms START window; the release window
 // therefore freezes the browser-only fake clock (pauseAt) so the deliberately
 // advanced in-flight signal is not spent by the test's own orchestration
 // wall-clock, and resumes after the genuine terminal response settled — see
 // the RUN90 note at the release below.
 const f=await connectedFixture({holdPeer:true,maxTimeMs:30000});
 try{
  const before=f.business();
  await f.page.clock.install();
  await open(f);await selectConnectedView(f);await connect(f);
  const p=await boundPlan(f);const o=p.inferenceConsentOffer;
  // RUN78: retain the ACTUAL control identities before admission. The
  // genuine terminal resultOf() clears the plan (workspace-agent-panel-v1.ts:85)
  // and update() then rewrites the SAME retained start button's label to the
  // closed synthetic label with the offer absent (:73), so a post-terminal
  // lookup by the old bound accessible name is a stale observer, not an
  // identity. Before the terminal the retained node must itself be the one
  // start control of the panel, attached, carrying the bound label.
  const startControl=await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).elementHandle();
  const previewControl=await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).elementHandle();
  const preterminalStartDomV178=await startControl.evaluate(b=>{const panel=document.getElementById('shell.agent-panel'),startLabels=['Genau diesen gebundenen Lauf einmalig starten','Genau diesen synthetischen Lauf starten'],buttons=panel?[...panel.querySelectorAll('button')]:[],startButtons=buttons.filter(x=>startLabels.includes(x.textContent??''));return{connected:b.isConnected,inPanel:panel?.contains(b)===true,startButtonCount:startButtons.length,isTheRetainedNode:startButtons.length===1&&startButtons[0]===b,text:b.textContent??''};});
  assert.equal(preterminalStartDomV178.connected,true,'PAN548_RUN78_HELD_START_CONTROL_NOT_ATTACHED_BEFORE_ADMISSION');
  assert.equal(preterminalStartDomV178.inPanel,true,'PAN548_RUN78_HELD_START_CONTROL_LEFT_PANEL_BEFORE_ADMISSION');
  assert.equal(preterminalStartDomV178.startButtonCount,1,'PAN548_RUN78_HELD_DUPLICATED_START_CONTROL_BEFORE_ADMISSION');
  assert.equal(preterminalStartDomV178.isTheRetainedNode,true,'PAN548_RUN78_HELD_START_CONTROL_IS_NOT_THE_ONE_START_CONTROL');
  assert.equal(preterminalStartDomV178.text,'Genau diesen gebundenen Lauf einmalig starten','PAN548_RUN78_HELD_PRETERMINAL_START_LABEL_NOT_THE_BOUND_NAME');
  await f.page.locator('#pan548-agent-inference-consent').check();
  await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await waitForActualV1548(()=>f.posts()>=1,'RUN76_HELD_START_PEER_REACHED');
  await state(f,'DISPATCHING');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-in-flight'),'true','PAN548_RUN76_HELD_START_NOT_IN_FLIGHT');
  const requestsInFlight=f.requests.length;
  // The displayed offer deadline passes on the PAGE clock while the genuine
  // one-time start is still held. The page expiry timer fires into the
  // panel's dispatching/attempted guards (workspace-agent-panel-v1.ts), so
  // the stale timer must not overwrite the true DISPATCHING run, latch or
  // announce — and the offer-aligned START transport above keeps the real
  // dispatch alive instead of manufacturing an abort.
  await f.page.clock.fastForward(o.expiresAtMs-await f.page.evaluate(()=>Date.now())+250);
  await new Promise(r=>setTimeout(r,150));
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'DISPATCHING','PAN548_RUN76_STALE_TIMER_OVERWROTE_DISPATCHING');
  assert.equal(await f.page.locator(root).getAttribute('data-plan-expired-reason'),null,'PAN548_RUN76_STALE_TIMER_LATCHED_DURING_DISPATCH');
  assert.equal(await f.page.locator('[data-agent-plan-expiry="true"]').isVisible(),false,'PAN548_RUN76_STALE_TIMER_ANNOUNCED_DURING_DISPATCH');
  assert.equal(count(f,'read'),0,'PAN548_RUN76_STALE_TIMER_TRIGGERED_A_READ');
  await f.flushResponses();
  assert.equal(f.requests.length,requestsInFlight,'PAN548_RUN76_STALE_TIMER_TRIGGERED_HIDDEN_REQUESTS');
  // RUN90: the genuine START fetch is guarded by the real offer-bound transport
  // AbortSignal.timeout(maxTimeMs+5000)=35000ms (context-selection-v1.ts:217/:231)
  // and Playwright's installed page clock patches AbortSignal.timeout too. The
  // deliberate ~30250ms fast-forward above has already consumed that window, so
  // only the ~4.75s remainder minus the pre-jump real elapsed time is left for
  // the release round-trip — the actual RUN76 failure evidence (browser
  // requestfailed, OUTCOME_UNCONFIRMED despite a real native 200) is exactly
  // this remainder being spent by the test's own orchestration wall-clock while
  // the peer gate was still closed. Freeze the browser-only fake clock at its
  // current page time immediately BEFORE the release so no orchestrated
  // real-world milliseconds can consume the deliberately advanced in-flight
  // transport signal while the genuine peer, native server and terminal
  // response run on their untouched real clocks; resume once the true terminal
  // START response settled. No expiry assertion was weakened, no production
  // limit raised or removed, and no reply was faked.
  const fakeNowAtReleaseV190=await f.page.evaluate(()=>Date.now());
  await f.page.clock.pauseAt(fakeNowAtReleaseV190);
  f.releasePeer();
  await state(f,'RESULT_READY');await f.flushResponses();
  await f.page.clock.resume();
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-in-flight'),'false','PAN548_RUN76_RELEASE_LEFT_DISPATCH_IN_FLIGHT');
  assert.equal(count(f,'start'),1,'PAN548_RUN76_RELEASE_REPLAYED_THE_START');
  // The released genuine peer completes the admitted bounded round: the held
  // tool-bearing first POST plus the final second POST carrying the two
  // native tool feedbacks. One dispatch — two real provider HTTP requests.
  assert.equal(f.posts(),2,'PAN548_RUN76_RELEASE_FEEDBACK_ROUND_POSTS');
  // RUN78: the terminal DOM truth is asserted on the retained real node, not
  // on the outdated accessible name. Per workspace-agent-panel-v1.ts, the
  // genuine RESULT_READY resultOf() clears the plan (:85) and update() then
  // rewrites the SAME retained start button to the closed synthetic label
  // and disables it via the absent plan (:73); the terminal proposal-preview
  // authority (review.disabled=held||!freshProposal(), :73) stays separately
  // intact. Still exactly one start-label button in the panel, and it IS the
  // retained node — a re-created duplicate or a dropped node fails closed.
  const terminalStartDomV178=await startControl.evaluate(b=>{const panel=document.getElementById('shell.agent-panel'),startLabels=['Genau diesen gebundenen Lauf einmalig starten','Genau diesen synthetischen Lauf starten'],buttons=panel?[...panel.querySelectorAll('button')]:[],startButtons=buttons.filter(x=>startLabels.includes(x.textContent??''));return{connected:b.isConnected,inPanel:panel?.contains(b)===true,startButtonCount:startButtons.length,isTheRetainedNode:startButtons.length===1&&startButtons[0]===b,disabled:b.disabled,text:b.textContent??''};});
  assert.equal(terminalStartDomV178.connected,true,'PAN548_RUN78_TERMINAL_START_CONTROL_DETACHED');
  assert.equal(terminalStartDomV178.inPanel,true,'PAN548_RUN78_TERMINAL_START_CONTROL_LEFT_THE_PANEL');
  assert.equal(terminalStartDomV178.startButtonCount,1,'PAN548_RUN78_TERMINAL_DUPLICATED_THE_RETAINED_START_CONTROL');
  assert.equal(terminalStartDomV178.isTheRetainedNode,true,'PAN548_RUN78_TERMINAL_START_CONTROL_IS_NOT_THE_RETAINED_NODE');
  assert.equal(terminalStartDomV178.text,'Genau diesen synthetischen Lauf starten','PAN548_RUN78_TERMINAL_START_LABEL_NOT_THE_CLEARED_SYNTHETIC');
  assert.equal(terminalStartDomV178.disabled,true,'PAN548_RUN78_TERMINAL_RETAINED_START_NOT_DISABLED');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN78_TERMINAL_DISPATCH_STILL_AVAILABLE');
  // The no-replay countermeasure tests the REAL same control: a forced
  // synthetic click dispatched directly on the retained node after the
  // terminal. Whether Chromium suppresses the click on the disabled control
  // or the dispatch() guards (absent plan, attempted handle) reject it, the
  // observable truth is identical: no third start, no extra provider POST,
  // no hidden request after the settled two-POST feedback round.
  const requestsAfterTerminal=f.requests.length;
  await startControl.evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await new Promise(r=>setTimeout(r,150));await f.flushResponses();
  assert.equal(count(f,'start'),1,'PAN548_RUN76_FORCED_CLICK_REPLAYED_THE_DISPATCHED_START');
  assert.equal(f.posts(),2,'PAN548_RUN78_FORCED_CLICK_ADDED_A_PROVIDER_POST');
  assert.equal(f.requests.length,requestsAfterTerminal,'PAN548_RUN78_FORCED_CLICK_TRIGGERED_HIDDEN_REQUESTS');
  assert.equal(await previewControl.evaluate(b=>b.disabled),false,'PAN548_RUN76_TERMINAL_LOST_SEPARATE_PREVIEW');
  assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);
  assert.deepEqual(f.errors,[]);
 }finally{try{await f.page.clock.resume();}catch{/* clock never installed or page/browser already gone */}try{f.releasePeer();}catch{/* gate already open */}await f.close();}
});
// RUN79: the actual #565/#548 same-shell gap — the agent panel caches an exact
// owner-bound plan/offer after AGENT_PLAN while the independently mounted
// native connection module can change the actual connection revision and its
// prerequisites inside the SAME ERV/context. The two new journeys below run on
// the existing real 565 owner and the real mounted panel (synthetic protocol
// peer only). The payload-free document hint may ONLY revoke cached offer
// actionability; it grants/extends/resets nothing, never auto-replans, never
// touches the unsent task text, and a late plan response or logout teardown
// cannot revive or leak it. The backend admission stays authoritative.
test('PUI07 RUN79 actual same-shell connection prerequisite change revokes only the cached bound offer: after a checked exact offer, a real re-probe through the mounted 565 dialog raises the native connection revision inside the unchanged ERV context, the stale offer/consent/startability is removed without touching the unsent task text or issuing any hidden/dispatch request, and only an explicit fresh prepare publishes a NEW unchecked offer whose separate manual consent enables exactly one start with the genuine two feedback POSTs; NOT LLM',async()=>{
 const f=await connectedFixture();
 try{
  const before=f.business(),connection='[id="shell.model-connection"]';
  await open(f);await selectConnectedView(f);await connect(f);
  // The genuine native readback revision shown by the real dialog is the
  // connection-state witness — no DOM-name inference, no forged DTO.
  const revOf=async()=>Number(/Revision (\d+)\./.exec(await f.page.locator(connection+' > p[role="status"]').innerText())?.[1]??-1);
  const revisionBefore=await revOf();
  const p=await boundPlan(f);
  const consent=f.page.locator('#pan548-agent-inference-consent');
  // RUN78 lesson retained: update() rewrites the SAME start button's label
  // when the offer disappears, so the revocation-window assertions bind to the
  // retained real node, not to a stale accessible name.
  const startControl=await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).elementHandle();
  await consent.check();
  assert.equal(await startControl.evaluate(b=>b.disabled),false,'PAN548_RUN79_CONSENTED_OFFER_START_NOT_ENABLED');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'true','PAN548_RUN79_CONSENTED_OFFER_NOT_ACTIONABLE');
  const taskText=await f.page.locator('#pan548-agent-intent').inputValue();
  assert.notEqual(taskText,'','PAN548_RUN79_MISSING_UNSENT_TASK_TEXT');
  const startsBefore=count(f,'start');
  // THE actual mutation: re-running one prerequisite check through the real
  // dialog persists a new connection revision while the displayed task stays
  // in the same ERV/context — the cached offer belongs to the old confirmed
  // prerequisite state and must lose actionability on its own.
  await f.page.locator(connection).getByRole('button',{name:'Authentifizierung separat prüfen',exact:true}).click();
  await state(f,'CONNECTION_CHANGE_OFFER_REVOKED');await f.flushResponses();
  await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();
  const revisionAfter=await revOf();
  assert.ok(revisionAfter>revisionBefore,'PAN548_RUN79_NO_ACTUAL_CONNECTION_REVISION_CHANGE:'+revisionBefore+'/'+revisionAfter);
  assert.equal(await f.page.locator('[id="shell.context-selection"][data-module="pan.erv"][data-state="CURRENT_CONTEXT"]').count(),1,'PAN548_RUN79_ERV_CONTEXT_NOT_UNCHANGED');
  assert.equal(await consent.isVisible(),false,'PAN548_RUN79_REVOKED_OFFER_CONSENT_LABEL_STILL_SHOWN');
  assert.equal(await consent.isChecked(),false,'PAN548_RUN79_REVOKED_OFFER_CONSENT_STILL_CHECKED');
  assert.equal(await startControl.evaluate(b=>b.disabled),true,'PAN548_RUN79_REVOKED_OFFER_START_STILL_ENABLED');
  assert.equal(await startControl.evaluate(b=>b.isConnected),true,'PAN548_RUN79_REVOCATION_DROPPED_THE_RETAINED_START_NODE');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN79_REVOKED_OFFER_STILL_DISPATCH_AVAILABLE');
  assert.equal(await f.page.locator(root).getAttribute('data-plan-expired-reason'),null,'PAN548_RUN79_REVOCATION_FAKED_AS_DEADLINE_EXPIRY');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN79_REVOCATION_LOST_UNSENT_TASK_TEXT');
  // A forced click on the retained start control dispatches nothing and no
  // hidden read/replan hides behind the revocation.
  const requestsAfterRevoke=f.requests.length;
  await startControl.evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await new Promise(r=>setTimeout(r,150));await f.flushResponses();
  assert.equal(count(f,'start'),startsBefore,'PAN548_RUN79_FORCED_CLICK_ON_REVOKED_OFFER_DISPATCHED');
  assert.equal(f.posts(),0,'PAN548_RUN79_PROVIDER_POST_AFTER_REVOKED_OFFER');
  assert.equal(f.requests.length,requestsAfterRevoke,'PAN548_RUN79_FORCED_CLICK_OR_REVOCATION_TRIGGERED_HIDDEN_REQUESTS');
  await connectedCapture(f,'desktop-agent-connection-change-cached-offer-revoked-text-retained');
  // RUN80 correction of the RUN79 assumption, keeping the backend guard
  // exactly as it is: the native owner intentionally reset the downstream
  // MODEL_AVAILABILITY check when AUTHENTICATION was re-probed (source
  // src/pan565/native-model-connection.mjs:100 — NOT_RUN · PREREQUISITE_RECHECKED,
  // visible in the real dialog readback), and task-plan admission requires all
  // three fresh prerequisite PASSes (native-model-connection.mjs:136). So an
  // immediate fresh plan after an invalidating re-probe is a truthful 400
  // PLAN_DENIED, not a missing UI. The honest recovery order is: first the
  // explicit fresh manual re-probe of exactly the reset prerequisite THROUGH
  // the mounted dialog — no backend relaxation, no auto-recheck, no forged
  // readiness — witnessed by the actual dialog readback, and only then the
  // explicit fresh prepare. The re-probe itself is a connection-module action
  // outside the panel: it restores no offer, no consent and no startability.
  const phasesV1=await f.page.locator(connection+' ul').innerText();
  assert.ok(phasesV1.includes('Modellverfügbarkeit: NOT_RUN · PREREQUISITE_RECHECKED'),'PAN548_RUN79_REPROBE_DID_NOT_TRUTHFULLY_RESET_MODEL_AVAILABILITY:'+phasesV1);
  await f.page.locator(connection).getByRole('button',{name:'Modellverfügbarkeit separat prüfen',exact:true}).click();
  await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();await f.flushResponses();
  const requalifiedV1=await f.page.locator(connection+' ul').innerText();
  assert.ok(requalifiedV1.includes('Modellverfügbarkeit: PASS'),'PAN548_RUN79_REQUALIFICATION_NOT_ACTUALLY_PASSED:'+requalifiedV1);
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'CONNECTION_CHANGE_OFFER_REVOKED','PAN548_RUN79_REQUALIFICATION_REVIVED_CACHED_OFFER');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN79_REQUALIFICATION_REVIVED_STARTABILITY');
  assert.equal(await consent.isVisible(),false,'PAN548_RUN79_REQUALIFICATION_REVIVED_STALE_CONSENT');
  // Only the explicit fresh prepare from the ACTUAL current connection state
  // publishes a NEW plan with a NEW unchecked offer; the connection readback
  // and the manual re-probe alone revived nothing before this click.
  const fresh=await boundPlan(f);
  assert.notEqual(fresh.planHandle,p.planHandle,'PAN548_RUN79_REPLAN_AFTER_REVOCATION_REPUBLISHED_OLD_PLAN');
  assert.notEqual(fresh.runId,p.runId,'PAN548_RUN79_REPLAN_AFTER_REVOCATION_REPUBLISHED_OLD_RUN');
  assert.equal(await consent.isChecked(),false,'PAN548_RUN79_FRESH_OFFER_AFTER_REVOCATION_AUTO_CONSENTED');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN79_FRESH_OFFER_ACTIONABLE_WITHOUT_MANUAL_CONSENT');
  await consent.check();
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'true','PAN548_RUN79_MANUAL_CONSENT_AFTER_REVOCATION_DID_NOT_ENABLE_START');
  await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await state(f,'RESULT_READY');await f.flushResponses();
  assert.equal(count(f,'start'),startsBefore+1,'PAN548_RUN79_POST_REVOCATION_DISPATCH_COUNT');
  // One admitted bounded round answers like the real server: the tool-bearing
  // first POST plus the final feedback POST — one dispatch, two real POSTs.
  assert.equal(f.posts(),2,'PAN548_RUN79_POST_REVOCATION_FEEDBACK_ROUND_POSTS');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN79_TERMINAL_LOST_TASK_TEXT');
  assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
test('PUI07 RUN79 unconfirmed connection mutation and independent re-read never restore stale bound readiness: a persisted-but-unacknowledged probe revokes the checked cached offer, the later fresh connection read confirms the true new state while reviving no offer/consent/startability, a late genuine plan response that lands after a connection change during its own planning window stays discarded, and only a fresh explicit prepare plus separate manual consent recovers exactly one start with the genuine two feedback POSTs; logout teardown leaves no revived panel and no leaking listener; NOT LLM',async()=>{
 const f=await connectedFixture();
 // RUN81 lexical-scope repair: cleanup state MUST live outside the try so the
 // finally block cannot throw a ReferenceError (the RUN80 failure at the old
 // line 1782 masked the primary assertion AND skipped f.close, orphaning the
 // test child). observerFailureV1/planHeldRequestIdV1/teardownV1 are cleanup
 // ownership, not flow-local data.
 let cdp,observerFailureV1=null,planHeldRequestIdV1=null,teardownV1=false;
 try{
  const before=f.business(),connection='[id="shell.model-connection"]';
  // The real dialog's native readback line is the revision witness — no DOM
  // name inference and no forged DTO anywhere in this journey.
  const revOfV1=async()=>Number(/Revision (\d+)\./.exec(await f.page.locator(connection+' > p[role="status"]').innerText())?.[1]??-1);
  await open(f);await selectConnectedView(f);await connect(f);
  const p=await boundPlan(f);
  const consent=f.page.locator('#pan548-agent-inference-consent');
  await consent.check();
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'true','PAN548_RUN79_UNCONFIRMED_FLOW_PRECONDITION_NOT_ACTIONABLE');
  const taskText=await f.page.locator('#pan548-agent-intent').inputValue();
  // The probe mutation reaches the server (HTTP 200 at the browser boundary)
  // but its acknowledgement is lost. An unconfirmed mutation is a LOSS for
  // cached readiness, never a renewal: the panel must revoke, not guess.
  // RUN80: observer failures must reach the awaited test flow and EVERY
  // intercepted request must be settled — genuine 200, unexpected non-200,
  // handler error and teardown alike. A throw inside a requestPaused callback
  // leaves the request paused and the deferred unresolved (the RUN79 orphaned
  // test child), so this observer records its first failure, always releases
  // the interception, and the awaited flow rethrows it at the next boundary
  // (assertObserverFlowV1) or via the held-plan promise below. No polling, no
  // generic control framework, no fabricated 200, no relaxed real TLS/authority.
  cdp=await f.context.newCDPSession(f.page);
  const noteObserverFailureV1=m=>{if(observerFailureV1===null)observerFailureV1=Error(m);};
  const assertObserverFlowV1=()=>{if(observerFailureV1!==null)throw observerFailureV1;};
  // RUN81: the swallow here must not erase a REAL settlement failure. Absence
  // of a throw is not proof a request settled: while the awaited flow is still
  // active (teardownV1 false), a failed release is recorded as an observer
  // failure and resurfaces at the next assertObserverFlowV1 boundary. Only
  // during the finally teardown (session/page already gone, "already settled"
  // races with Fetch.disable) may a settle error legitimately vanish.
  const settleInterceptedV1=async(requestId,method='Fetch.continueResponse')=>{try{await cdp.send(method,{requestId,...(method==='Fetch.failRequest'?{errorReason:'Failed'}:{})});}catch(error){if(!teardownV1)noteObserverFailureV1('PAN548_RUN79_INTERCEPTED_REQUEST_SETTLE_NOT_CONFIRMED:'+method+':'+String(error?.message??error));}};
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:f.tls.origin+'*/workspace/model-connection/probe',requestStage:'Response'}]});
  cdp.once('Fetch.requestPaused',e=>{(async()=>{if(!e.request.url.endsWith('/workspace/model-connection/probe'))return void await settleInterceptedV1(e.requestId);
   if(e.responseStatusCode===200)return void await settleInterceptedV1(e.requestId,'Fetch.failRequest');
   noteObserverFailureV1('PAN548_RUN79_UNCONFIRMED_PROBE_ACK_NOT_GENUINE_200:'+e.responseStatusCode);await settleInterceptedV1(e.requestId);})().catch(error=>{noteObserverFailureV1('PAN548_RUN79_PROBE_INTERCEPTION_NOT_SETTLED:'+String(error?.message??error));void settleInterceptedV1(e.requestId);});});
  await f.page.locator(connection).getByRole('button',{name:'Authentifizierung separat prüfen',exact:true}).click();
  await state(f,'CONNECTION_CHANGE_OFFER_REVOKED');
  await f.page.locator(connection+'[data-state="READBACK_NOT_CONFIRMED"]').waitFor();await f.flushResponses();
  assert.equal(await consent.isVisible(),false,'PAN548_RUN79_UNCONFIRMED_MUTATION_KEPT_CONSENT_VISIBLE');
  assert.equal(await consent.isChecked(),false,'PAN548_RUN79_UNCONFIRMED_MUTATION_KEPT_CONSENT_CHECKED');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN79_UNCONFIRMED_MUTATION_LEFT_DISPATCH_AVAILABLE');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN79_UNCONFIRMED_MUTATION_LOST_TASK_TEXT');
  assert.equal(count(f,'start'),0,'PAN548_RUN79_UNCONFIRMED_MUTATION_DISPATCHED');assert.equal(f.posts(),0,'PAN548_RUN79_UNCONFIRMED_MUTATION_PROVIDER_POST');
  assertObserverFlowV1();
  // The independent read shows the true persisted state (the probe DID apply)
  // — and revives nothing: confirming the new connection state restores no
  // cached offer, no consent and no startability by itself.
  await cdp.send('Fetch.disable');
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();await f.flushResponses();
  await new Promise(r=>setTimeout(r,150));
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'CONNECTION_CHANGE_OFFER_REVOKED','PAN548_RUN79_INDEPENDENT_READ_REVIVED_STALE_READINESS');
  assert.equal(await consent.isVisible(),false,'PAN548_RUN79_INDEPENDENT_READ_REVIVED_STALE_CONSENT');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN79_INDEPENDENT_READ_REVIVED_STARTABILITY');
  assert.equal(count(f,'start'),0,'PAN548_RUN79_INDEPENDENT_READ_DISPATCHED');assert.equal(f.posts(),0,'PAN548_RUN79_INDEPENDENT_READ_PROVIDER_POST');
  await connectedCapture(f,'desktop-agent-connection-unconfirmed-mutation-read-no-revive');
  // RUN80: the late-response race is only genuine when the CURRENT persisted
  // connection is actually eligible again first. The unacknowledged probe DID
  // apply server-side and truthfully reset MODEL_AVAILABILITY, and the
  // independent read alone must not (and does not) fake readiness: the panel
  // stays revoked, and only the explicit manual re-probe of exactly the reset
  // prerequisite THROUGH the mounted dialog re-qualifies it. The plan below
  // then earns a real HTTP 200 at the browser boundary — no fabricated
  // response, no DTO, no relaxed guard.
  const stalePhasesV1=await f.page.locator(connection+' ul').innerText();
  assert.ok(stalePhasesV1.includes('Modellverfügbarkeit: NOT_RUN · PREREQUISITE_RECHECKED'),'PAN548_RUN79_INDEPENDENT_READ_FAKED_PREREQUISITE_ELIGIBILITY:'+stalePhasesV1);
  await f.page.locator(connection).getByRole('button',{name:'Modellverfügbarkeit separat prüfen',exact:true}).click();
  await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();await f.flushResponses();
  const requalifiedV1=await f.page.locator(connection+' ul').innerText();
  assert.ok(requalifiedV1.includes('Modellverfügbarkeit: PASS'),'PAN548_RUN79_LATE_PLAN_RACE_WITHOUT_REAL_ELIGIBILITY:'+requalifiedV1);
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'CONNECTION_CHANGE_OFFER_REVOKED','PAN548_RUN79_REQUALIFICATION_REVIVED_CACHED_OFFER_BEFORE_LATE_PLAN');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN79_REQUALIFICATION_REVIVED_STARTABILITY_BEFORE_LATE_PLAN');
  // Late-response boundary: while a fresh plan is genuinely in flight (its
  // real 200 response held at the browser boundary), a real connection probe
  // mutation completes and raises the native revision. The late plan response
  // may not republish a cached offer for a connection state that already
  // moved on; the panel's connection-epoch guard discards it fail-closed.
  let holdLatePlanV1,rejectLatePlanV1;const latePlanHeld=new Promise((resolve,reject)=>{holdLatePlanV1=resolve;rejectLatePlanV1=reject;});
  latePlanHeld.catch(()=>{/* the awaited flow below rethrows the rejection */});
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:f.tls.origin+'*/workspace/agent-run/plan',requestStage:'Response'}]});
  // RUN81 listener lifetime: the plan interceptor is registered under a name
  // and removed as soon as the held response has genuinely continued — no
  // lingering CDP listener survives past its interception window.
  const planInterceptorV1=e=>{(async()=>{if(!e.request.url.endsWith('/workspace/agent-run/plan'))return void await settleInterceptedV1(e.requestId);
   if(e.responseStatusCode!==200){noteObserverFailureV1('PAN548_RUN79_LATE_PLAN_NOT_GENUINE:'+e.responseStatusCode);await settleInterceptedV1(e.requestId);rejectLatePlanV1(observerFailureV1);return;}
   planHeldRequestIdV1=e.requestId;holdLatePlanV1(e);})().catch(error=>{noteObserverFailureV1('PAN548_RUN79_LATE_PLAN_INTERCEPTION_NOT_SETTLED:'+String(error?.message??error));planHeldRequestIdV1=e.requestId;void settleInterceptedV1(e.requestId);rejectLatePlanV1(observerFailureV1);});};
  cdp.on('Fetch.requestPaused',planInterceptorV1);
  const planResponse=f.page.waitForResponse(r=>r.url().endsWith('/workspace/agent-run/plan'));
  await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).click();
  // An observer failure surfaces here as a real rejection of the awaited flow,
  // never as an uncaught throw inside the paused CDP callback.
  const held=await latePlanHeld;
  // Wait for the persistent post-mutation dialog readback (the actual revision
  // bump shown by the real status line) — the durable witness that the
  // invalidation hint fired BEFORE the held plan response continues. A
  // transient REQUESTING blip is not a dependable wait anchor, and the stale
  // CURRENT_CONNECTION text from the requalification render would otherwise be
  // matched by plain attribute waits.
  const lateRevBefore=await revOfV1();
  await f.page.locator(connection).getByRole('button',{name:'Erreichbarkeit separat prüfen',exact:true}).click();
  await f.page.waitForFunction(expected=>{const m=/Revision (\d+)\./.exec(document.querySelector('[id="shell.model-connection"] > p[role="status"]')?.innerText??'');return m!==null&&Number(m[1])>expected;},lateRevBefore);
  await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();
  assertObserverFlowV1();
  await cdp.send('Fetch.continueResponse',{requestId:held.requestId});planHeldRequestIdV1=null;cdp.off('Fetch.requestPaused',planInterceptorV1);await cdp.send('Fetch.disable');
  await planResponse;await f.flushResponses();await new Promise(r=>setTimeout(r,150));
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'CONNECTION_CHANGE_OFFER_REVOKED','PAN548_RUN79_LATE_PLAN_REPUBLISHED_CACHED_OFFER');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN79_LATE_PLAN_LEFT_DISPATCH_AVAILABLE');
  assert.equal(await consent.isVisible(),false,'PAN548_RUN79_LATE_PLAN_SHOWED_STALE_CONSENT');
  assert.equal(count(f,'start'),0,'PAN548_RUN79_LATE_PLAN_DISPATCHED');assert.equal(f.posts(),0,'PAN548_RUN79_LATE_PLAN_PROVIDER_POST');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN79_LATE_PLAN_LOST_TASK_TEXT');
  // Recovery is explicit valid requalification of the checks the late race
  // really reset (AUTHENTICATION behind the fresh REACHABILITY probe, then
  // MODEL_AVAILABILITY), then the explicit fresh prepare plus the separate
  // manual consent: one start, the genuine two-POST feedback round.
  await f.page.locator(connection).getByRole('button',{name:'Authentifizierung separat prüfen',exact:true}).click();
  await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();await f.flushResponses();
  await f.page.locator(connection).getByRole('button',{name:'Modellverfügbarkeit separat prüfen',exact:true}).click();
  await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();await f.flushResponses();
  const recoveryPhasesV1=await f.page.locator(connection+' ul').innerText();
  assert.ok(recoveryPhasesV1.includes('Modellverfügbarkeit: PASS'),'PAN548_RUN79_RECOVERY_REQUALIFICATION_NOT_ACTUALLY_PASSED:'+recoveryPhasesV1);
  const fresh=await boundPlan(f);
  assert.notEqual(fresh.planHandle,p.planHandle,'PAN548_RUN79_RECOVERY_REPUBLISHED_OLD_PLAN');
  assert.equal(await consent.isChecked(),false,'PAN548_RUN79_RECOVERY_OFFER_AUTO_CONSENTED');
  await consent.check();
  await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await state(f,'RESULT_READY');await f.flushResponses();
  assert.equal(count(f,'start'),1,'PAN548_RUN79_RECOVERY_DISPATCH_COUNT');
  assert.equal(f.posts(),2,'PAN548_RUN79_RECOVERY_FEEDBACK_ROUND_POSTS');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN79_RECOVERY_LOST_TASK_TEXT');
  // Lifetime boundary: logout aborts the panel lifetime, which removes the
  // document listener with the same signal. A late forged local event is then
  // a silent no-op — no revived panel, no thrown page error, no leak.
  await f.page.getByRole('button',{name:'Abmelden',exact:true}).click();
  await f.page.getByRole('heading',{name:'Abgemeldet',exact:true}).waitFor();
  await f.page.evaluate(()=>document.dispatchEvent(new CustomEvent('pansphaira.model-connection-invalidated-v1',{bubbles:false,cancelable:false})));
  await new Promise(r=>setTimeout(r,150));await f.flushResponses();
  assert.equal(await f.page.locator(root).count(),0,'PAN548_RUN79_TEARDOWN_LEFT_PANEL_MOUNTED');
  assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);
  assert.deepEqual(f.errors,[]);
  assertObserverFlowV1();
 }finally{
  // RUN81 cleanup ownership: teardownV1 is set first, so a settle error that
  // races the concurrent Fetch.disable/f.close teardown can no longer be
  // mistaken for (or mask) a primary assertion; every cleanup step is
  // individually guarded and f.close runs unconditionally — after the
  // lexical-scope repair nothing in this block can throw a ReferenceError or
  // otherwise skip fixture shutdown.
  teardownV1=true;
  if(cdp&&planHeldRequestIdV1!==null){try{await cdp.send('Fetch.continueResponse',{requestId:planHeldRequestIdV1});}catch{/* already settled */}planHeldRequestIdV1=null;}
  try{await cdp?.send('Fetch.disable');}catch{/* session already gone */}await f.close();
 }
});
// RUN82: the guided MANUAL connection-recovery journey from inside the SAME nonmodal task panel. The navigation is navigation only: it reopens/focuses the existing native565 dialog through the dialog's OWN opener lifecycle and triggers no request, probe, consent, selection mutation, inference or automatic planning of its own; the unsent task text and native selection stay untouched; the native dialog remains the sole authority, so a requalified connection revives no old offer, consent or startability and only a fresh explicit prepare plus the separate manual consent produces exactly one start with the two genuine synthetic feedback POSTs.
test('PUI07 RUN82 actual same-shell guided recovery: after a genuine prerequisite revocation the new panel quick action opens and focuses the mounted native565 dialog with zero added requests, unchanged provider counts and the unsent task text intact; the honest guidance names the missing step; requalification through the dialog revives no stale offer, consent or startability and only a fresh explicit plan plus separate manual consent yields exactly one start and the two genuine feedback POSTs; NOT LLM',async()=>{
 const f=await connectedFixture();
 try{
  const before=f.business(),connection='[id="shell.model-connection"]',consent=f.page.locator('#pan548-agent-inference-consent'),guidance=f.page.locator(root+' [data-agent-connection-guidance="true"]');
  await open(f);await selectConnectedView(f);await connect(f);
  const p=await boundPlan(f);
  await consent.check();
  const taskText=await f.page.locator('#pan548-agent-intent').inputValue(),startsBefore=count(f,'start');
  // Genuine revocation: the independent AUTH re-probe resets the downstream passes while a bound unchecked offer and checked consent stand in the panel.
  await f.page.locator(connection).getByRole('button',{name:'Authentifizierung separat prüfen',exact:true}).click();
  await state(f,'CONNECTION_CHANGE_OFFER_REVOKED');await f.flushResponses();
  assert.equal(await consent.isVisible(),false,'PAN548_RUN82_REVOCATION KEPT A STALE CONSENT VISIBLE');
  assert.equal(await consent.isChecked(),false,'PAN548_RUN82_REVOCATION KEPT A STALE CHECKED CONSENT');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN82_REVOCATION KEPT STARTABILITY');
  // The honest guidance appears exactly in this revoked state and names the missing step plus the manual action without claiming anything itself.
  assert.equal(await guidance.isVisible(),true,'PAN548_RUN82 GUIDANCE ABSENT WHILE OFFER REVOKED');
  const guidanceText=await guidance.innerText();
  assert.ok(guidanceText.includes('Fehlender Schritt')&&guidanceText.includes('Verbindungsbereich öffnen'),'PAN548_RUN82 GUIDANCE DOES NOT NAME THE MISSING STEP AND THE MANUAL ACTION: '+guidanceText);
  // Close the dialog through its OWN close control, so the navigation must genuinely reopen it.
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsdialog schließen',exact:true}).click();
  assert.equal(await f.page.locator('#pan565-connection-body').isHidden(),true,'PAN548_RUN82 DIALOG DID NOT CLOSE VIA ITS OWN CONTROL');
  const requestsAtNav=f.requests.length,responsesAtNav=f.responses.length,connectionRequestsAtNav=f.requests.filter(r=>r.path.includes('/model-connection')).length;
  await f.page.getByRole('button',{name:connectionNavLabelV1,exact:true}).click();
  await state(f,'CONNECTION_AREA_FOCUSED');
  assert.equal(await f.page.locator(connection+' > button').getAttribute('aria-expanded'),'true','PAN548_RUN82 NAVIGATION DID NOT OPEN THE EXISTING DIALOG');
  assert.equal(await f.page.locator('#pan565-connection-body').isHidden(),false,'PAN548_RUN82 NAVIGATION DID NOT REVEAL THE EXISTING DIALOG BODY');
  assert.ok(await f.page.evaluate(()=>document.activeElement?.closest('#pan565-connection-body')!==null),'PAN548_RUN82 NAVIGATION DID NOT FOCUS INSIDE THE EXISTING DIALOG');
  await f.flushResponses();
  assert.equal(f.requests.length,requestsAtNav,'PAN548_RUN82 NAVIGATION TRIGGERED FURTHER REQUESTS');
  assert.equal(f.responses.length,responsesAtNav,'PAN548_RUN82 NAVIGATION TRIGGERED FURTHER RESPONSES');
  assert.equal(f.requests.filter(r=>r.path.includes('/model-connection')).length,connectionRequestsAtNav,'PAN548_RUN82 NAVIGATION TRIGGERED CONNECTION REVALIDATION');
  assert.equal(f.posts(),0,'PAN548_RUN82 NAVIGATION TRIGGERED PROVIDER OR FEEDBACK POSTS');
  assert.equal(count(f,'start'),startsBefore,'PAN548_RUN82 NAVIGATION TRIGGERED A START');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN82 NAVIGATION LOST THE UNSENT TASK TEXT');
  await f.page.waitForFunction(()=>document.querySelector('[id="shell.context-selection"] button[aria-pressed="true"]')?.textContent==='Kontextauswahl: Persönliches Viewelement: invoice-value');
  await connectedCapture(f,'desktop-agent-guided-connection-revoked-guidance');
  // Genuine requalification THROUGH the focused dialog restores nothing panel-side — no revived offer, consent or startability.
  await f.page.locator(connection).getByRole('button',{name:'Modellverfügbarkeit separat prüfen',exact:true}).click();
  await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();await f.flushResponses();
  const requalified=await f.page.locator(connection+' ul').innerText();
  assert.ok(requalified.includes('Modellverfügbarkeit: PASS'),'PAN548_RUN82 REQUALIFICATION DID NOT READ BACK GENUINELY: '+requalified);
  assert.equal(await consent.isVisible(),false,'PAN548_RUN82 REQUALIFICATION REVIVED A STALE CONSENT OFFER');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN82 REQUALIFICATION REVIVED STARTABILITY');
  await connectedCapture(f,'desktop-agent-guided-connection-requalification');
  // Only the fresh explicit plan plus the separate manual consent makes exactly one start available; the run then produces the two genuine synthetic feedback POSTs.
  const fresh=await boundPlan(f);
  assert.notEqual(fresh.planHandle,p.planHandle,'PAN548_RUN82 FRESH PLAN REUSED THE REVOKED HANDLE');
  assert.equal(await consent.isChecked(),false,'PAN548_RUN82 FRESH OFFER CAME PRECHECKED');
  await consent.check();
  await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await state(f,'RESULT_READY');await f.flushResponses();
  assert.equal(count(f,'start'),startsBefore+1,'PAN548_RUN82 FRESH CONSENT DID NOT YIELD EXACTLY ONE START');
  assert.equal(f.posts(),2,'PAN548_RUN82 GENUINE FEEDBACK POST PAIR MISSING');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN82 JOURNEY LOST THE UNSENT TASK TEXT');
  assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
// RUN82 direct negatives/lifetime: with the optional connection module genuinely absent or failing to load, the panel stays honest — no fake connection action, no connection revalidation request, the explicit denial path stays truthful and the unsent text survives; synthetic no-owner mode stays operable; logout removes the recovery control with the panel.
test('PUI07 RUN82 absent or erroring optional connection module keeps the guided navigation honest without a fake connection action, request or lost unsent text; synthetic no-owner mode stays operable and logout leaves no stale recovery control; NOT LLM',async()=>{
 // (1) Real connected owner mount whose connection module script genuinely fails to load.
 const f=await connectedFixture();
 try{
  await f.page.route('**/t/tenant-a/workspace/model-connection/app.js',route=>void route.abort());
  await open(f);await selectConnectedView(f);
  assert.equal(await f.page.locator('[id="shell.model-connection"]').count(),0,'PAN548_RUN82 ABORTED MODULE STILL MOUNTED A DIALOG');
  const taskText=await f.page.locator('#pan548-agent-intent').inputValue();
  await f.page.getByRole('button',{name:connectionNavLabelV1,exact:true}).click();
  await state(f,'CONNECTION_AREA_UNAVAILABLE');
  assert.equal(await f.page.getByRole('button',{name:connectionNavLabelV1,exact:true}).getAttribute('data-connection-target-available'),'false','PAN548_RUN82 UNAVAILABLE NAVIGATION CLAIMED A TARGET');
  await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).click();
  await state(f,'PLAN_DENIED');await f.flushResponses();
  const denied=await f.page.locator(root).innerText();
  assert.ok(denied.includes('kein synthetischer Fallback')&&denied.includes('Verbindungsbereich öffnen'),'PAN548_RUN82 DENIAL PATH LOST THE HONEST POINTER: '+denied);
  const guidance=f.page.locator(root+' [data-agent-connection-guidance="true"]');
  assert.equal(await guidance.isVisible(),true,'PAN548_RUN82 GUIDANCE ABSENT WHILE AREA UNAVAILABLE');
  const guidanceText=await guidance.innerText();
  assert.ok(guidanceText.includes('fehlt oder meldet einen Fehler')&&guidanceText.includes('keine erfundene Verbindungshandlung'),'PAN548_RUN82 GUIDANCE FAKED A CONNECTION ACTION: '+guidanceText);
  assert.equal(f.requests.filter(r=>r.path.includes('/model-connection')&&!r.path.endsWith('/app.js')).length,0,'PAN548_RUN82 ABSENT MODULE TRIGGERED A CONNECTION REVALIDATION REQUEST');
  assert.equal(f.posts(),0,'PAN548_RUN82 ABSENT MODULE TRIGGERED PROVIDER OR FEEDBACK POSTS');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN82 ABSENT MODULE PATH LOST THE UNSENT TASK TEXT');
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
 // (2) Owner-free synthetic mode: the navigation honestly reports no area, the existing synthetic journey stays operable, logout leaves no stale control.
 const g=await nativeViewBrowserFixture546({agentRuns:true});
 try{
  await open(g);await select(g);
  const taskText=await g.page.locator('#pan548-agent-intent').inputValue();
  await g.page.getByRole('button',{name:connectionNavLabelV1,exact:true}).click();
  await state(g,'CONNECTION_AREA_UNAVAILABLE');
  assert.ok((await g.page.locator(root).innerText()).includes('Kein vorhandener Verbindungsbereich'),'PAN548_RUN82 SYNTHETIC MODE CLAIMED A CONNECTION AREA');
  assert.equal(g.requests.filter(r=>r.path.includes('/model-connection')).length,0,'PAN548_RUN82 SYNTHETIC MODE TRIGGERED A CONNECTION REQUEST');
  // Synthetic mode stays usable exactly as before: the explicit synthetic plan still plans.
  await plan(g);
  assert.equal(await g.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN82 SYNTHETIC MODE LOST THE UNSENT TASK TEXT');
  await g.page.getByRole('button',{name:'Abmelden',exact:true}).click();
  await g.page.getByRole('heading',{name:'Abgemeldet',exact:true}).waitFor();
  assert.equal(await g.page.locator(root).count(),0,'PAN548_RUN82 PANEL SURVIVED LOGOUT');
  assert.equal(await g.page.getByRole('button',{name:connectionNavLabelV1,exact:true}).count(),0,'PAN548_RUN82 STALE RECOVERY CONTROL SURVIVED LOGOUT');
  assert.deepEqual(g.errors,[]);
 }finally{await g.close();}
});
// RUN83: focused registered coverage for the actual product-defect boundary found by the independent review of RUN82: pure guided navigation to the existing native565 connection area must never replace or misrepresent the actual native task projection. Across a true RESULT_READY terminal, a genuine malformed-feedback OUTCOME_UNCONFIRMED with the full retained hold, and an observed RUNNING, the panel keeps its exact data-state, truthful native status and retained hold rows across reopen/focus/Escape of the dialog's OWN lifecycle; the navigation outcome is reported only in the panel's separate navigation live region; navigation itself adds zero requests, provider posts and starts, preserves the unsent task text and selection, and a later independent read stays truthful (the stale navigation echo retires on the next real state transition). NOT LLM.
test('PUI07 RUN83 actual terminal/UNKNOWN task-truth preservation under guided connection navigation: RESULT_READY, the retained OUTCOME_UNCONFIRMED hold and observed RUNNING keep their exact phase, status and facts across reopen/focus/Escape while the navigation outcome reports in its own live region with zero added requests, posts or starts; the independent read stays terminal and no stale navigation echo survives; NOT LLM',async()=>{
 const outcomeSel=root+' [data-agent-connection-nav-outcome="true"]',guidanceSel=root+' [data-agent-connection-guidance="true"]';
 // (1) True RESULT_READY terminal: navigation keeps phase/status/rows, focuses an enabled dialog control, the real Escape lifecycle returns to the dialog's own opener, a later independent read stays terminal and retires the navigation echo.
 const f=await connectedFixture();
 try{
  const before=f.business();
  await open(f);await selectConnectedView(f);await connect(f);await boundPlan(f);
  await f.page.locator('#pan548-agent-inference-consent').check();
  await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await state(f,'RESULT_READY');await f.flushResponses();
  const statusText=await f.page.locator(root+' [role="status"]').first().innerText(),explanationText=await f.page.locator(root+' [data-agent-explanation="true"]').innerText();
  assert.ok(statusText.includes('Native Laufprojektion gelesen'),'PAN548_RUN83 TEST BASE MISSING TRUE TERMINAL STATUS: '+statusText);
  const requestsAtNav=f.requests.length,responsesAtNav=f.responses.length,connectionRequestsAtNav=f.requests.filter(r=>r.path.includes('/model-connection')).length,taskText=await f.page.locator('#pan548-agent-intent').inputValue();
  await f.page.getByRole('button',{name:connectionNavLabelV1,exact:true}).click();
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'RESULT_READY','PAN548_RUN83 NAVIGATION REPLACED THE TRUE TERMINAL PHASE');
  assert.equal(await f.page.locator(root+' [role="status"]').first().innerText(),statusText,'PAN548_RUN83 NAVIGATION REPLACED THE TRUTHFUL NATIVE TERMINAL STATUS');
  assert.equal(await f.page.locator(outcomeSel).isVisible(),true,'PAN548_RUN83 NAVIGATION OUTCOME NOT REPORTED IN ITS OWN LIVE REGION');
  assert.ok((await f.page.locator(outcomeSel).innerText()).includes('Verbindungsbereich geöffnet und fokussiert'),'PAN548_RUN83 NAVIGATION OUTCOME MISSING THE HONEST ECHO');
  assert.equal(await f.page.locator(guidanceSel).isVisible(),false,'PAN548_RUN83 NAVIGATION CLAIMED A MISSING STEP WHILE THE CONNECTION WAS HEALTHY');
  assert.ok(await f.page.evaluate(()=>document.activeElement?.closest('#pan565-connection-body')!==null),'PAN548_RUN83 NAVIGATION DID NOT FOCUS INSIDE THE EXISTING DIALOG');
  assert.equal(await f.page.evaluate(()=>document.activeElement instanceof HTMLElement&&!document.activeElement.disabled&&document.activeElement.closest('#pan565-connection-body')!==null),true,'PAN548_RUN83 NAVIGATION FOCUS DID NOT LAND ON AN ENABLED CONTROL');
  await f.page.keyboard.press('Escape');
  assert.equal(await f.page.locator('#pan565-connection-body').isHidden(),true,'PAN548_RUN83 REAL ESCAPE DID NOT CLOSE THE EXISTING DIALOG');
  assert.equal(await f.page.evaluate(()=>document.activeElement?.parentElement?.id??''),'shell.model-connection','PAN548_RUN83 ESCAPE DID NOT RETURN FOCUS TO THE DIALOG OWN OPENER');
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'RESULT_READY','PAN548_RUN83 ESCAPE LIFECYCLE ALTERED THE TASK PHASE');
  await f.flushResponses();
  assert.equal(f.requests.length,requestsAtNav,'PAN548_RUN83 NAVIGATION TRIGGERED FURTHER REQUESTS');
  assert.equal(f.responses.length,responsesAtNav,'PAN548_RUN83 NAVIGATION TRIGGERED FURTHER RESPONSES');
  assert.equal(f.requests.filter(r=>r.path.includes('/model-connection')).length,connectionRequestsAtNav,'PAN548_RUN83 NAVIGATION TRIGGERED CONNECTION REVALIDATION');
  assert.equal(f.posts(),2,'PAN548_RUN83 NAVIGATION TRIGGERED FURTHER PROVIDER OR FEEDBACK POSTS');
  assert.equal(count(f,'start'),1,'PAN548_RUN83 NAVIGATION TRIGGERED ANOTHER START');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN83 NAVIGATION LOST THE UNSENT TASK TEXT');
  assert.equal(await f.page.locator(root+' [data-agent-explanation="true"]').innerText(),explanationText,'PAN548_RUN83 NAVIGATION CLOBBERED THE RUN EXPLANATION');
  await connectedCapture(f,'desktop-agent-navigation-terminal-truth-preserved');
  // The independent read stays available, stays truthful and retires the stale navigation echo with its state transition.
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).isDisabled(),false,'PAN548_RUN83 INDEPENDENT READ UNAVAILABLE AFTER NAVIGATION');
  await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).click();
  await state(f,'RESULT_READY');await f.flushResponses();
  assert.equal(count(f,'read'),1,'PAN548_RUN83 INDEPENDENT READ DID NOT STAY THE EXACT ONE READ');
  assert.equal(await f.page.locator(outcomeSel).isVisible(),false,'PAN548_RUN83 STALE NAVIGATION ECHO SURVIVED THE NEXT NATIVE STATE TRANSITION');
  assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
 // (2) Genuine malformed-feedback OUTCOME_UNCONFIRMED: the retained UNKNOWN hold (phase, status notice, budget/diagnosis rows) survives navigation untouched; navigation adds nothing and the independent read stays terminal.
 const g=await connectedFixture({unknown:true});
 try{
  const before=g.business();
  await open(g);await selectConnectedView(g);await connect(g);await boundPlan(g);
  await g.page.locator('#pan548-agent-inference-consent').check();
  await g.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await state(g,'OUTCOME_UNCONFIRMED');await g.flushResponses();
  const holdNotice=await g.page.locator(root+' [role="status"]').first().innerText();
  assert.ok(holdNotice.includes('Schreib-/Nutzungsausgang unbestätigt')&&holdNotice.includes('Budget bleibt gebunden'),'PAN548_RUN83 TEST BASE MISSING THE RETAINED HOLD NOTICE: '+holdNotice);
  const holdRows=await g.page.locator(root+' dl').first().innerText();
  assert.ok(holdRows.includes('Verbrauch nicht bestätigt — volle Reservierung bleibt erhalten'),'PAN548_RUN83 TEST BASE MISSING THE RETAINED RESERVATION ROW');
  const requestsAtNav=g.requests.length,postsAtNav=g.posts(),taskText=await g.page.locator('#pan548-agent-intent').inputValue();
  await g.page.getByRole('button',{name:connectionNavLabelV1,exact:true}).click();
  assert.equal(await g.page.locator(root).getAttribute('data-state'),'OUTCOME_UNCONFIRMED','PAN548_RUN83 NAVIGATION REPLACED THE RETAINED UNKNOWN HOLD PHASE');
  assert.equal(await g.page.locator(root+' [role="status"]').first().innerText(),holdNotice,'PAN548_RUN83 NAVIGATION REPLACED THE TRUTHFUL RETAINED HOLD NOTICE');
  assert.ok((await g.page.locator(root+' dl').first().innerText()).includes('volle Reservierung bleibt erhalten'),'PAN548_RUN83 NAVIGATION DROPPED THE RETAINED HOLD FACTS');
  assert.equal(await g.page.locator(outcomeSel).isVisible(),true,'PAN548_RUN83 UNKNOWN-HOLD NAVIGATION OUTCOME NOT REPORTED SEPARATELY');
  assert.ok((await g.page.locator(outcomeSel).innerText()).includes('weder Fortsetzen, Abbrechen noch Wiederholen'),'PAN548_RUN83 NAVIGATION ECHO IMPLIED RESUME/CANCEL/RETRY AUTHORITY');
  assert.ok(await g.page.evaluate(()=>document.activeElement?.closest('#pan565-connection-body')!==null),'PAN548_RUN83 UNKNOWN-HOLD NAVIGATION DID NOT FOCUS INSIDE THE EXISTING DIALOG');
  await g.flushResponses();
  assert.equal(g.requests.length,requestsAtNav,'PAN548_RUN83 UNKNOWN-HOLD NAVIGATION TRIGGERED FURTHER REQUESTS');
  assert.equal(g.posts(),postsAtNav,'PAN548_RUN83 UNKNOWN-HOLD NAVIGATION TRIGGERED FURTHER PROVIDER OR FEEDBACK POSTS');
  assert.equal(count(g,'start'),1,'PAN548_RUN83 UNKNOWN-HOLD NAVIGATION TRIGGERED ANOTHER START');
  assert.equal(await g.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN83 UNKNOWN-HOLD NAVIGATION LOST THE UNSENT TASK TEXT');
  await g.page.keyboard.press('Escape');
  assert.equal(await g.page.locator('#pan565-connection-body').isHidden(),true,'PAN548_RUN83 UNKNOWN-HOLD REAL ESCAPE DID NOT CLOSE THE EXISTING DIALOG');
  assert.equal(await g.page.locator(root).getAttribute('data-state'),'OUTCOME_UNCONFIRMED','PAN548_RUN83 UNKNOWN-HOLD ESCAPE ALTERED THE HOLD PHASE');
  await g.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).click();
  await state(g,'OUTCOME_UNCONFIRMED');await g.flushResponses();
  assert.equal(g.posts(),postsAtNav,'PAN548_RUN83 TERMINAL READ TRIGGERED PROVIDER OR FEEDBACK POSTS');
  assert.equal(await g.page.locator(root+' [role="status"]').first().innerText(),holdNotice,'PAN548_RUN83 TERMINAL READ DID NOT RESTORE THE SAME TRUTHFUL HOLD NOTICE');
  assert.equal(await g.page.locator(outcomeSel).isVisible(),false,'PAN548_RUN83 STALE NAVIGATION ECHO SURVIVED THE UNKNOWN-HOLD READ');
  assert.equal(g.readPersisted().revision,0);assert.equal(g.business(),before);assert.deepEqual(g.errors,[]);
 }finally{await g.close();}
 // (3) Observed RUNNING under a held start: navigation is honestly unavailable while the operation is in flight, and after real settlement the true RESULT_READY stays untouched by navigation.
 const h=await connectedFixture({holdPeer:true,maxTimeMs:25000});
 try{
  const before=h.business();
  await open(h);await selectConnectedView(h);await connect(h);await boundPlan(h);
  await h.page.locator('#pan548-agent-inference-consent').check();
  await h.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await h.peerHeld;await h.flushResponses();
  await h.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).click();
  await state(h,'RUNNING');await h.flushResponses();
  const nav=h.page.getByRole('button',{name:connectionNavLabelV1,exact:true});
  assert.equal(await nav.isDisabled(),true,'PAN548_RUN83 NAVIGATION FALSIFYINGLY AVAILABLE WHILE THE START IS STILL IN FLIGHT');
  assert.equal(await h.page.locator(root).getAttribute('data-state'),'RUNNING','PAN548_RUN83 IN-FLIGHT WINDOW ALTERED THE OBSERVED RUNNING PHASE');
  h.releasePeer();await state(h,'RESULT_READY');await h.flushResponses();
  assert.equal(h.posts(),2,'PAN548_RUN83 RELEASE DID NOT SETTLE THE TWO FEEDBACK POSTS');
  const requestsAtNav=h.requests.length;
  await nav.click();
  assert.equal(await h.page.locator(root).getAttribute('data-state'),'RESULT_READY','PAN548_RUN83 POST-SETTLEMENT NAVIGATION REPLACED THE TRUE TERMINAL PHASE');
  await h.flushResponses();
  assert.equal(h.requests.length,requestsAtNav,'PAN548_RUN83 POST-SETTLEMENT NAVIGATION TRIGGERED FURTHER REQUESTS');
  assert.equal(count(h,'start'),1,'PAN548_RUN83 POST-SETTLEMENT NAVIGATION TRIGGERED ANOTHER START');
  assert.equal(h.readPersisted().revision,0);assert.equal(h.business(),before);assert.deepEqual(h.errors,[]);
 }finally{try{h.releasePeer();}catch{/* gate already open or fixture owned */}await h.close();}
});
// RUN88 PUI-07-AC02: readable honest missing-operation reasons in the usable
// task view on the SAME nonmodal panel, on the existing synthetic native
// fixture. The reasons come only from the currently validated plan/read
// projection (typed closed operations through the unchanged production
// boundary): no raw DTO token, no new handler, endpoint or grant. Unavailable
// controls stay disabled and request-free under attempted activation, the
// actual independent status read stays manual, and unverified/native-read-
// denied states retire stale validated operation evidence instead of keeping
// claiming it. Desktop and 390 captures use the existing overflow/clipping
// assertions. Synthetic fixture: NOT real-model/LLM evidence. RUN89: the bound
// and unbound reason lines are concise per operation; the current-validation-
// vs-contract-binding explanation lives once in a shared note in the same
// group, and the desktop plus 390 acceptance is proven by real Tab reach,
// per-element full-viewport scroll reveal, hit-test visibility and viewport
// (non-full-page) captures of the reasons themselves.
test('PUI07 RUN88 READABLE MISSING-OPERATION REASONS SURVIVE PLAN RUN READ DENIAL AND RELOAD WHILE CONTROLS STAY DISABLED AND REQUEST-FREE',async()=>{
 const f=await nativeViewBrowserFixture546({agentRuns:true});const images=[];
 const opsBox=f.page.locator('#pan548-agent-task-operations'),cancelLine=f.page.locator('#pan548-agent-cancel-unavailable-reason'),resumeLine=f.page.locator('#pan548-agent-resume-unavailable-reason'),bindingNote=f.page.locator('#pan548-agent-task-operation-binding-note'),statusNote=opsBox.locator('small');
 const panelButton=name=>f.page.locator(root).getByRole('button',{name,exact:true});
 async function expectOperationReasons(binding,cancelPhrase,resumePhrase){
  await showAgentTechnicalUI(f.page);
  assert.equal(await opsBox.getAttribute('data-task-operation-binding'),binding,'PAN548_RUN88_OPERATION_REASON_BINDING_PHASE_MISMATCH');
  assert.ok(await opsBox.isVisible(),'PAN548_RUN88_MISSING_OPERATION_REASONS_NOT_VISIBLE');
  const cancel=await cancelLine.innerText(),resume=await resumeLine.innerText();
  for(const[line,phrase,label]of[[cancel,cancelPhrase,'cancel'],[resume,resumePhrase,'resume']])assert.ok(line.includes(phrase)&&line.includes('nicht verfügbar'),'PAN548_RUN88_'+label.toUpperCase()+'_REASON_MISSING:'+line);
  for(const line of [cancel,resume]){assert.ok(!line.includes('NO_NATIVE_MODEL_TASK'),'PAN548_RUN88_RAW_REASON_TOKEN_LEAKED');assert.ok(!line.includes('erfolgreich abgebrochen')&&!line.includes('erfolgreich fortgesetzt'),'PAN548_RUN88_FAKE_OPERATION_CLAIM');}
  // RUN89: the current-validation-vs-contract-binding explanation is stated exactly once, in the
  // shared note inside the same reachable group — separation in both states, provenance from the
  // current validated projection when bound, honest no-current-evidence when unbound.
  const note=await bindingNote.innerText();
  assert.ok(note.includes('vom aktuellen Taskbinding'),'PAN548_RUN89_SHARED_BINDING_NOTE_MISSING_SEPARATION:'+note);
  assert.ok(note.includes(binding==='CURRENT_VALIDATED_PROJECTION'?'aktuell im Panel validierten nativen Projektion':'nicht als aktuell behauptet'),'PAN548_RUN89_SHARED_BINDING_NOTE_NOT_HONEST_ABOUT_CURRENT_VALIDATION:'+note);
  assert.ok(await statusNote.innerText().then(t=>t.includes('einzige aktuelle Statusaktion')&&t.includes('weder abbrechen noch fortsetzen')&&t.includes('keine Freigabe')),'PAN548_RUN88_STATUS_READ_NOTE_INCOMPLETE');
  const cancelBtn=panelButton('Lauf abbrechen — nicht verfügbar'),resumeBtn=panelButton('Lauf fortsetzen — nicht verfügbar');
  assert.equal(await cancelBtn.getAttribute('aria-describedby'),'pan548-agent-cancel-unavailable-reason','disabled controls must describe their visible reason to assistive technology');
  assert.equal(await resumeBtn.getAttribute('aria-describedby'),'pan548-agent-resume-unavailable-reason');
  assert.equal(await cancelBtn.isDisabled(),true);assert.equal(await resumeBtn.isDisabled(),true);
 }
 // RUN89: genuine keyboard and scroll access, not isVisible(). The group is reached by Tab from
 // the details summary; then EVERY complete reason line, the shared binding note and the manual
 // status-read limitation are individually scrolled to center and measured: the full box must sit
 // inside the real viewport through natural scrolling only (no helper-opened panel proves
 // anything), the text must not be horizontally clipped, and the centered hit test must land on
 // the element itself. Scrolling dispatches no request and changes no task state.
 async function expectReasonScrollAndKeyboardAccessV1(label){
  const requestsBeforeScroll=f.requests.length,stateBeforeScroll=await f.page.locator(root).getAttribute('data-state');
  await f.page.locator('.agent-technical-details').locator(':scope > summary').focus();
  let reachedBox=false;for(let i=0;i<8&&!reachedBox;i++){await f.page.keyboard.press('Tab');reachedBox=await f.page.evaluate(()=>document.activeElement?.id==='pan548-agent-task-operations');}
  assert.ok(reachedBox,'PAN548_RUN89_REASON_GROUP_NOT_KEYBOARD_REACHABLE_'+label);
  for(const[el,name]of[[opsBox,'reason-group'],[cancelLine,'cancel-reason'],[resumeLine,'resume-reason'],[bindingNote,'binding-note'],[statusNote,'status-read-note']]){
   await el.evaluate(n=>n.scrollIntoView({block:'center'}));
   const g=await el.evaluate(n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,vw:innerWidth,vh:innerHeight,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth};});
   assert.ok(g.height>0&&g.top>=0&&g.bottom<=g.vh,'PAN548_RUN89_REASON_NOT_FULLY_REVEALABLE_BY_SCROLL_'+label+':'+name+':'+JSON.stringify(g));
   assert.ok(g.left>=0&&g.right<=g.vw&&g.scrollWidth<=g.clientWidth+1,'PAN548_RUN89_REASON_HORIZONTALLY_CLIPPED_'+label+':'+name+':'+JSON.stringify(g));
   const hitSelf=await el.evaluate(n=>{const r=n.getBoundingClientRect(),hit=document.elementFromPoint(Math.min(Math.max(r.left+r.width/2,0),innerWidth-1),Math.min(Math.max(r.top+r.height/2,0),innerHeight-1));return hit===n||n.contains(hit);});
   assert.ok(hitSelf,'PAN548_RUN89_REASON_NOT_ACTUALLY_SHOWN_ON_TOP_'+label+':'+name);
  }
  assert.equal(f.requests.length,requestsBeforeScroll,'PAN548_RUN89_SCROLL_ACCESS_TRIGGERED_A_REQUEST');
  assert.equal(await f.page.locator(root).getAttribute('data-state'),stateBeforeScroll,'PAN548_RUN89_SCROLL_ACCESS_CHANGED_TASK_STATE');
 }
 // RUN89: the acceptance capture is a viewport screenshot taken only after the whole reason group
 // is proven fully inside the live viewport — unlike the old full-page overview that showed the
 // default assistant view without ever proving the reasons were visible where the user looks.
 async function visibleCaptureV1(name){
  const g=await opsBox.evaluate(n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,vw:innerWidth,vh:innerHeight};});
  assert.ok(g.top>=0&&g.bottom<=g.vh&&g.left>=0&&g.right<=g.vw,'PAN548_RUN89_REASON_GROUP_NOT_FULLY_IN_VIEWPORT_FOR_CAPTURE:'+name+':'+JSON.stringify(g));
  const image=join(evidence(),name+'.png');await f.page.screenshot({path:image,fullPage:false});
  images.push({name,image,viewportCapture:true,geometry:g,sha256:createHash('sha256').update(readFileSync(image)).digest('hex')});
 }
 try{
  await open(f);await showAgentTechnicalUI(f.page);
  // Unverified start: honest no-binding wording, nothing claimed yet — the shared binding note
  // carries the contract-vs-binding separation and the no-current-evidence honesty (checked in
  // the helper above).
  await expectOperationReasons('NO_CURRENT_BINDING','weiterhin keinen Modelllauf-Abbruchvertrag','weiterhin keinen Modelllauf-Fortsetzungsvertrag');
  await select(f);const p=await plan(f);
  // Actual validated plan projection: the closed reasons become readable, and EVERY complete
  // reason line, the shared note and the manual status-read limitation are keyboard-reachable
  // and fully revealable by natural scrolling in the real desktop viewport; the viewport capture
  // below proves them visible where the user looks.
  await expectOperationReasons('CURRENT_VALIDATED_PROJECTION','es existiert kein nativer Modelllauf-Abbruchvertrag','es existiert kein nativer Modelllauf-Fortsetzungsvertrag');
  await expectReasonScrollAndKeyboardAccessV1('desktop-planned');
  await opsBox.evaluate(n=>n.scrollIntoView({block:'center'}));
  await visibleCaptureV1('run89-agent-task-operation-reasons-desktop-visible');
  // Attempted activation of the unavailable controls triggers no request and
  // changes no state; the actual status read stays manual.
  const requestsBeforeAttempt=f.requests.length,stateBeforeAttempt=await f.page.locator(root).getAttribute('data-state');
  await panelButton('Lauf abbrechen — nicht verfügbar').evaluate(n=>n.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await panelButton('Lauf fortsetzen — nicht verfügbar').evaluate(n=>n.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  assert.equal(f.requests.length,requestsBeforeAttempt,'PAN548_RUN88_UNAVAILABLE_CONTROL_ACTIVATION_TRIGGERED_A_REQUEST');
  assert.equal(await f.page.locator(root).getAttribute('data-state'),stateBeforeAttempt);
  // Keyboard/AT reachability: the reason group is tabbable after the summary.
  await f.page.locator('.agent-technical-details').locator(':scope > summary').focus();
  let reachedBox=false;for(let i=0;i<8&&!reachedBox;i++){await f.page.keyboard.press('Tab');reachedBox=await f.page.evaluate(()=>document.activeElement?.id==='pan548-agent-task-operations');}
  assert.ok(reachedBox,'PAN548_RUN88_MISSING_OPERATION_REASONS_NOT_KEYBOARD_REACHABLE');
  images.push(await capture(f,'run88-agent-task-operation-reasons-planned'));
  const r=await run(f);assert.equal(r.phase,'RESULT_READY');
  // True terminal via the real native run: reasons stay bound and truthful.
  await expectOperationReasons('CURRENT_VALIDATED_PROJECTION','es existiert kein nativer Modelllauf-Abbruchvertrag','es existiert kein nativer Modelllauf-Fortsetzungsvertrag');
  assert.equal(await f.page.locator(root).getAttribute('data-run'),p.runId);assert.equal(count(f,'start'),1);
  // Manual independent re-read keeps the bound presentation identical.
  await panelButton('Laufstatus unabhängig nativ lesen').click();await state(f,'RESULT_READY');await f.flushResponses();
  await expectOperationReasons('CURRENT_VALIDATED_PROJECTION','es existiert kein nativer Modelllauf-Abbruchvertrag','es existiert kein nativer Modelllauf-Fortsetzungsvertrag');
  // Denied independent read over a genuine reload (no current validated
  // projection in this fresh page): the old validated evidence retires honestly
  // instead of being claimed as current. A denied read AFTER an already
  // confirmed terminal deliberately keeps the terminal projection, so this is
  // the actual RUN_READ_DENIED path of the existing source semantics.
  await f.page.route('**/workspace/agent-run/read',route=>route.abort('failed'));
  await f.page.reload();await showCurrentContextDetailsUI(f.page);await f.page.locator('[id="shell.context-selection"][data-module="pan.erv"][data-state="CURRENT_CONTEXT"]').waitFor();await state(f,'RUN_READ_DENIED');await f.flushResponses();
  await expectOperationReasons('NO_CURRENT_BINDING','weiterhin keinen Modelllauf-Abbruchvertrag','weiterhin keinen Modelllauf-Fortsetzungsvertrag');
  assert.ok((await bindingNote.innerText()).includes('nicht als aktuell behauptet'),'a denied read must not keep claiming old validated operation evidence');
  assert.equal(count(f,'start'),1,'PAN548_RUN88_DENIED_READ_STARTED_ANOTHER_RUN');
  await f.page.unroute('**/workspace/agent-run/read');
  await panelButton('Laufstatus unabhängig nativ lesen').click();await state(f,'RESULT_READY');await f.flushResponses();
  await expectOperationReasons('CURRENT_VALIDATED_PROJECTION','es existiert kein nativer Modelllauf-Abbruchvertrag','es existiert kein nativer Modelllauf-Fortsetzungsvertrag');
  // Genuine reload with the automatic independent read: reasons survive the
  // true terminal, the reload and the fresh read with all hold/source facts.
  await f.page.reload();await showCurrentContextDetailsUI(f.page);await f.page.locator('[id="shell.context-selection"][data-module="pan.erv"][data-state="CURRENT_CONTEXT"]').waitFor();await state(f,'RESULT_READY');await f.flushResponses();
  await expectOperationReasons('CURRENT_VALIDATED_PROJECTION','es existiert kein nativer Modelllauf-Abbruchvertrag','es existiert kein nativer Modelllauf-Fortsetzungsvertrag');
  assert.equal(count(f,'start'),1,'PAN548_RUN88_RELOAD_OR_REASON_RENDERS_STARTED_ANOTHER_RUN');
  // 390: the reasons remain visible, wrapped and unclipped beside the controls — and every one
  // of them, plus the shared note and the status-read limitation, is keyboard-reachable and
  // fully revealable by natural scrolling at phone width; the viewport capture below proves it.
  await f.page.setViewportSize({width:390,height:844});await showAgentTechnicalUI(f.page);
  await expectOperationReasons('CURRENT_VALIDATED_PROJECTION','es existiert kein nativer Modelllauf-Abbruchvertrag','es existiert kein nativer Modelllauf-Fortsetzungsvertrag');
  await expectReasonScrollAndKeyboardAccessV1('phone390');
  await opsBox.evaluate(n=>n.scrollIntoView({block:'center'}));
  await visibleCaptureV1('run89-agent-task-operation-reasons-390-visible');
  images.push(await capture(f,'run88-agent-task-operation-reasons-390'));
  assert.equal(f.readPersisted().revision,0,'the reason presentation persists nothing');
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
// RUN105 helpers: the SAME registered assembly observes its own real persistence — a read-only
// second connection to the actual profile database the mounted565 owner writes (existing test-owned
// leading source only, same seam the565 browser suite was accepted with) — plus an in-page reconcile
// probe that reads its OWN real body (a bare non-200 passes vacuously) and a last-readback getter.
function persistedConnectionRow548(f){const db=new DatabaseSync(join(f.root,'browser-profiles.sqlite'),{readOnly:true});try{const rows=db.prepare("SELECT revision,state FROM workspace_model_connections WHERE tenant='tenant-a' AND subject='synthetic:erv-reader'").all();assert.equal(rows.length,1,'PAN548_RUN105_REAL_SOURCE_ROW_MISSING');return{revision:rows[0].revision,state:JSON.parse(rows[0].state)};}finally{db.close();}}
// RUN108: read-only observation of the ACTUAL persisted native budget ledger behind this fixture's single
// route/principal — the accounting truth every refund/reset/exhaustion claim is checked against. The SELECT
// mutates, refunds or resets nothing; the WAL fallback merely keeps the observation possible while the
// owner writer holds the ledger open.
function nativeLedgerRows548(f){const dirs=readdirSync(f.root).filter(n=>n.startsWith('native-model-budget-'));assert.equal(dirs.length,1,'PAN548_RUN107 exactly one native budget ledger is expected for this fixture principal/route');const file=join(f.root,dirs[0],'resource-budget.sqlite');let db;try{db=new DatabaseSync(file,{readOnly:true});}catch{db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=15000');}try{return db.prepare('SELECT operation_id,state,runtime_units,runtime_consumed FROM reservations').all();}finally{db.close();}}
const connectionReadbacks548=f=>f.responses.filter(r=>r.path.endsWith('/workspace/model-connection')&&r.method==='GET'&&r.status===200);
const reconcilePosts548=f=>f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/model-connection/reconcile'));
// RUN106: the protected owner route admits the EXACT session scope BEFORE the owner usage oracle, so an
// owner-bound probe must carry the actual held readback's own binding.sessionId behind x-pan565-session —
// the same seam the accepted565 probe uses (browser-model-connection.test.mjs:35/850). Omitting the session
// keeps a genuine scope-negative: the route denies with 403 MODEL_CONNECTION_SCOPE_DENIED before the owner.
async function reconcileProbe548(f,body,session){return f.page.evaluate(async payload=>{const response=await fetch('/t/tenant-a/workspace/model-connection/reconcile',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json',...(payload.session===undefined?{}:{'x-pan565-session':payload.session})},body:JSON.stringify(payload.body)});let error=null;try{error=(await response.json()).error;}catch{}return[response.status,error];},{body,session});}
// RUN109: a direct forced connection-mutation POST over the EXACT owner route, witnessing the backend's exact denial of a stale cached authority (session taken from the actually-read readback itself).
async function probePostV1109(f,body,session){return f.page.evaluate(async payload=>{const response=await fetch('/t/tenant-a/workspace/model-connection/probe',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-pan565-session':payload.session},body:JSON.stringify(payload.body)});let error=null;try{error=(await response.json()).error;}catch{}return[response.status,error];},{body,session});}
async function retainedProbeHold548(f){
 await f.page.locator('[id="shell.model-connection"]').getByRole('button',{name:'Genau diese gedeckelte Inferenzprobe freigeben',exact:true}).click();
 await f.page.locator('[id="shell.model-connection"]').getByRole('button',{name:'Begrenzte Inferenz separat prüfen',exact:true}).click();
 await f.page.locator('[id="shell.model-connection"][data-state="CURRENT_CONNECTION"]').waitFor();await f.flushResponses();
 const held=connectionReadbacks548(f).at(-1).value;
 assert.equal(held.reason,'UNKNOWN_USAGE_RETAINED','PAN548_RUN105 the real provider timeout did not retain the usage hold');
 assert.equal(held.checks.INFERENCE.state,'UNKNOWN_USAGE');assert.equal(held.unknownUsage.reconcilable,true);
 assert.match(held.unknownUsage.operationId,/^operation:mc-[a-f0-9]{40}$/,'PAN548_RUN105 held operation not disclosed');
 assert.equal(f.posts(),1,'PAN548_RUN105 the timed-out original dispatch was retried');
 return held;}
// RUN105 positive journey on the existing registered real-browser assembly: the genuine probe-timeout
// UNKNOWN_USAGE connection hold, disclosed by the mounted565 dialog from its independent readback,
// drives the548 panel's hold guidance; the guided navigation focuses the dialog's OWN reconcile
// control without triggering anything; the explicit keyboard activation settles exactly one route POST
// plus the mandatory independent GET and the real source row at revision+1 — only the connection cost
// at the code-owned synthetic zero price. The panel re-honests to the generic missing-step line, the
// plan denial stands (a settled zero-price connection cost does not revive task startability), the
// unsent text, provider counts and every authority stay untouched. NOT LLM.
test('PUI07 RUN105 actual same-shell retained connection hold drives the548 panel guidance into the565 dialog: the genuine probe-timeout UNKNOWN_USAGE hold discloses the exact operation, real navigation focuses the existing reconcile control with zero added requests, the explicit keyboard reconcile settles only the connection cost over the real route plus independent readback and persisted source, then the panel re-honests to the generic missing-step guidance with no provider retry, no task authority and no lost unsent text; NOT LLM',async()=>{
 const f=await connectedFixture({hangInferenceProbeOnce:true,maxTimeMs:3000});
 try{
  const before=f.business(),connection='[id="shell.model-connection"]',guidance=f.page.locator(root+' [data-agent-connection-guidance="true"]');
  await open(f);await selectConnectedView(f);await connect(f);
  const held=await retainedProbeHold548(f),heldOperation=held.unknownUsage.operationId;
  assert.equal(await f.page.locator(connection).getAttribute('data-unknown-usage-hold'),'RECONCILABLE_ZERO_PRICE','PAN548_RUN105 the dialog discloses no live hold presentation');
  assert.equal(await f.page.locator(connection).getAttribute('data-unknown-usage-operation-id'),heldOperation,'PAN548_RUN105 the dialog hold presentation drifted from the readback');
  assert.ok((await f.page.locator(connection).innerText()).includes('Nativer Nutzungs-Hold'),'PAN548_RUN105 the dialog hold row is not truthfully displayed');
  // The genuine plan denial while the connection hold stands: the guidance now explains THIS hold instead of the generic read-then-replan sentence.
  await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).click();
  await state(f,'PLAN_DENIED');await f.flushResponses();
  assert.equal(f.posts(),1,'PAN548_RUN105 the plan denial touched the provider transport');
  assert.equal(await guidance.isVisible(),true,'PAN548_RUN105 guidance absent while the hold denied the plan');
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'RECONCILABLE_ZERO_PRICE','PAN548_RUN105 guidance ignored the current hold disclosure');
  const guidanceText=await guidance.innerText();
  for(const claim of[heldOperation,'vollständige Reservierung','Verbrauch nicht bestätigt','kein automatischer Retry','Nullpreis-Hold jetzt abgleichen','keine Erstattung'])assert.ok(guidanceText.includes(claim),'PAN548_RUN105 hold guidance lacks the truthful claim '+claim+': '+guidanceText);
  assert.ok(!guidanceText.includes('Fehlender Schritt'),'PAN548_RUN105 the generic guidance displaced the actual hold explanation');
  await connectedCapture(f,'desktop-run105-panel-hold-guidance');
  await f.page.setViewportSize({width:390,height:844});await connectedCapture(f,'desktop-run105-panel-hold-guidance-390');await f.page.setViewportSize({width:1280,height:900});
  // Close the dialog through its OWN control, then navigate from the panel: pure navigation now lands focus on the dialog's own reconcile control and triggers nothing.
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsdialog schließen',exact:true}).click();
  const requestsAtNav=f.requests.length,responsesAtNav=f.responses.length,readsAtNav=connectionReadbacks548(f).length,taskText=await f.page.locator('#pan548-agent-intent').inputValue(),startsBefore=count(f,'start');
  await f.page.getByRole('button',{name:connectionNavLabelV1,exact:true}).click();
  await state(f,'CONNECTION_AREA_FOCUSED');
  assert.equal(await f.page.evaluate(()=>document.activeElement?.id),'pan565-reconcile','PAN548_RUN105 navigation did not focus the dialog\u2019s own reconcile control');
  const focusHit=await f.page.evaluate(()=>{const a=document.activeElement,r=a.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{width:r.width,height:r.height,hitSelf:!!hit&&(hit===a||a.contains(hit))};});
  assert.ok(focusHit.width>0&&focusHit.height>0&&focusHit.hitSelf,'PAN548_RUN105 the focused reconcile control is not hit-testable: '+JSON.stringify(focusHit));
  // No run-truth phase stood in the status here (PLAN_DENIED), so the existing CONNECTION_AREA_FOCUSED reporting carries the honest hold message in the native status line.
  const navStatusText=await f.page.locator(root+' [role="status"]').first().innerText();
  for(const claim of[heldOperation,'kein Abgleich','keine Erstattung'])assert.ok(navStatusText.includes(claim),'PAN548_RUN105 the navigation status lacks the truthful hold message '+claim+': '+navStatusText);
  await f.flushResponses();
  assert.equal(f.requests.length,requestsAtNav,'PAN548_RUN105 navigation triggered added requests');
  assert.equal(f.responses.length,responsesAtNav,'PAN548_RUN105 navigation triggered added responses');
  assert.equal(connectionReadbacks548(f).length,readsAtNav,'PAN548_RUN105 navigation triggered a connection revalidation');
  assert.equal(f.posts(),1,'PAN548_RUN105 navigation triggered a provider or feedback POST');
  assert.equal(count(f,'start'),startsBefore,'PAN548_RUN105 navigation triggered a start');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN105 navigation lost the unsent task text');
  assert.equal(await f.page.locator(connection).getAttribute('data-unknown-usage-hold'),'RECONCILABLE_ZERO_PRICE','PAN548_RUN105 navigation settled the hold');
  // Explicit KEYBOARD activation of the focused dialog control: exactly one route POST plus the mandatory independent GET, the real source row persists the settlement at revision+1 and the provider stays silent.
  const rowBefore=persistedConnectionRow548(f);
  await f.page.keyboard.press('Enter');
  await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();await f.flushResponses();
  assert.equal(reconcilePosts548(f).length,1,'PAN548_RUN105 the reconcile POST is not exactly one');
  assert.equal(connectionReadbacks548(f).length,readsAtNav+1,'PAN548_RUN105 the mandatory independent readback is missing or doubled');
  const settled=connectionReadbacks548(f).at(-1).value;
  assert.equal(settled.unknownUsage,null,'PAN548_RUN105 the hold is still disclosed after settlement');
  assert.equal(settled.revision,rowBefore.revision+1,'PAN548_RUN105 the independent readback disagrees with the persisted revision');
  assert.equal(await f.page.locator(connection).getAttribute('data-unknown-usage-hold'),null,'PAN548_RUN105 a stale hold presentation survived the settlement');
  assert.equal(await f.page.locator('#pan565-unknown-usage').count(),0,'PAN548_RUN105 the stale hold row survived the settlement');
  assert.ok((await f.page.locator(connection).innerText()).includes('SYNTHETIC_ZERO_PRICE_RECONCILED_NO_MODEL_PASS'),'PAN548_RUN105 the settled inference state is not honestly re-read');
  assert.equal(f.posts(),1,'PAN548_RUN105 the reconcile touched the provider transport');
  const rowAfter=persistedConnectionRow548(f);
  assert.equal(rowAfter.revision,rowBefore.revision+1,'PAN548_RUN105 the persisted settlement revision drifted');
  assert.equal(rowAfter.state.lastOperation,heldOperation,'PAN548_RUN105 the settled operation vanished from the real source row');
  // The panel stays honest: the navigation state stands, the guidance retired with the settlement and a fresh explicit plan attempt still denies — RUN107: since the dialog now genuinely discloses a confirmed current readback with no hold, the guidance tells the truth (CONNECTION_CONFIRMED_TASK_DENIED) instead of the old GENERIC 'connection not confirmed or revoked' sentence, and still claims no hold.
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'CONNECTION_AREA_FOCUSED','PAN548_RUN105 the settlement overwrote the panel state');
  assert.equal(await guidance.isVisible(),false,'PAN548_RUN105 the guidance stayed visible after the settlement');
  await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).click();
  await state(f,'PLAN_DENIED');await f.flushResponses();
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'CONNECTION_CONFIRMED_TASK_DENIED','PAN548_RUN105/RUN107 a stale hold guidance was resurrected after the settlement, or the confirmed-connection denial truth was not told');
  assert.ok(!(await guidance.innerText()).includes('Nutzungs-Hold'),'PAN548_RUN105 the settled hold is still claimed in the guidance');
  assert.equal(f.posts(),1,'PAN548_RUN105 the post-settlement plan attempt touched the provider');
  assert.equal(count(f,'start'),startsBefore,'PAN548_RUN105 a fake task startability revived after the settlement');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN105 the journey lost the unsent task text');
  assert.equal(await f.page.locator('#pan548-agent-inference-consent').isVisible(),false,'PAN548_RUN105 a stale consent checkbox revived');
  await connectedCapture(f,'desktop-run105-panel-after-settlement');
  assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
// RUN105 stale-presentation journey: the ONLY hold source is the connection module's live disclosure.
// The actual unconfirmed read discards it (the panel falls back to the honest generic denial guidance
// with no hold claim), the fresh independent read re-discloses the still-held operation live and the
// panel re-sources it on the next render pass; the navigation focuses the reconcile control again;
// logout retires the panel with its guidance while the route itself denies the late reconcile with
// 401 — no resurrected cached offer anywhere; the provider stays frozen at the one timed-out attempt.
test('PUI07 RUN105 stale retained-hold presentation: a real unconfirmed connection read discards the live hold disclosure and the panel falls back to the generic denial guidance, a fresh independent read re-discloses the still-held operation live, logout retires the panel guidance while the route denies the late reconcile with HOSTED_SESSION_DENIED, and the provider stays frozen at exactly one attempt; NOT LLM',async()=>{
 const f=await connectedFixture({hangInferenceProbeOnce:true,maxTimeMs:3000});let cdp;
 try{
  const connection='[id="shell.model-connection"]',guidance=f.page.locator(root+' [data-agent-connection-guidance="true"]');
  await open(f);await selectConnectedView(f);await connect(f);
  const held=await retainedProbeHold548(f),heldOperation=held.unknownUsage.operationId;
  await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).click();
  await state(f,'PLAN_DENIED');await f.flushResponses();
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'RECONCILABLE_ZERO_PRICE','PAN548_RUN105 the hold guidance was absent before the denial');
  // A REAL lost independent read: the genuine GET is failed at the transport, the product lands on READBACK_NOT_CONFIRMED and must discard the live hold presentation.
  cdp=await f.context.newCDPSession(f.page);
  let denied,resolvePaused;const paused=new Promise(r=>{resolvePaused=r;});
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:f.tls.origin+'*/workspace/model-connection',requestStage:'Response'}]});
  cdp.on('Fetch.requestPaused',event=>{if(event.request.method==='GET'){denied=event;resolvePaused();}});
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  await paused;
  await cdp.send('Fetch.failRequest',{requestId:denied.requestId,errorReason:'Failed'});
  await f.page.locator(connection+'[data-state="READBACK_NOT_CONFIRMED"]').waitFor();await f.flushResponses();
  assert.equal(await f.page.locator(connection).getAttribute('data-unknown-usage-hold'),null,'PAN548_RUN105 the stale hold presentation survived the unconfirmed read');
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'GENERIC','PAN548_RUN105 the hold guidance was kept as a cached offer through the denial');
  const deniedGuidance=await guidance.innerText();
  assert.ok(deniedGuidance.includes('nicht bestätigt')&&!deniedGuidance.includes('Nutzungs-Hold'),'PAN548_RUN105 the denial guidance still claims a hold: '+deniedGuidance);
  await cdp.send('Fetch.disable');
  // The fresh independent read re-discloses the STILL-HELD operation live; the next panel render pass re-sources it — presentation, never a cached offer.
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();await f.flushResponses();
  assert.equal(await f.page.locator(connection).getAttribute('data-unknown-usage-hold'),'RECONCILABLE_ZERO_PRICE','PAN548_RUN105 the fresh read did not re-disclose the still-held operation');
  assert.equal(await f.page.locator(connection).getAttribute('data-unknown-usage-operation-id'),heldOperation,'PAN548_RUN105 the re-disclosed hold names a different operation');
  await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).click();
  await state(f,'PLAN_DENIED');await f.flushResponses();
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'RECONCILABLE_ZERO_PRICE','PAN548_RUN105 the panel did not re-source the live hold on the next render');
  // Navigation focuses the reconcile control again, then logout retires the whole panel presentation.
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsdialog schließen',exact:true}).click();
  await f.page.getByRole('button',{name:connectionNavLabelV1,exact:true}).click();
  await state(f,'CONNECTION_AREA_FOCUSED');
  assert.equal(await f.page.evaluate(()=>document.activeElement?.id),'pan565-reconcile','PAN548_RUN105 the re-sourced navigation did not focus the reconcile control');
  await f.page.getByRole('button',{name:'Abmelden',exact:true}).click();
  await f.page.getByRole('heading',{name:'Abgemeldet',exact:true}).waitFor();
  assert.equal(await f.page.locator(root).count(),0,'PAN548_RUN105 the panel survived the logout');
  assert.equal(await f.page.locator(root+' [data-agent-connection-guidance="true"]').count(),0,'PAN548_RUN105 a stale guidance survived the logout');
  assert.deepEqual(await reconcileProbe548(f,{operationId:heldOperation,identityDigest:held.identityDigest}),[401,'HOSTED_SESSION_DENIED'],'PAN548_RUN105 the retired session reconciled anyway');
  assert.equal(f.posts(),1,'PAN548_RUN105 the retired session touched the provider');
  assert.deepEqual(f.errors,[]);
 }finally{await cdp?.detach();await f.close();}
});
// RUN105 negative: a task-level unconfirmed outcome WITHOUT a connection-level hold earns no
// connection-hold claim. The genuine malformed-feedback OUTCOME_UNCONFIRMED keeps its exact phase
// across the guided navigation; the guidance stays hidden (no false hold, no fake settlement) and the
// connection root discloses nothing; zero added requests, no provider retry, unsent text intact.
test('PUI07 RUN105 task-level unconfirmed outcome without a connection hold earns no connection-hold claim: the genuine malformed-feedback OUTCOME_UNCONFIRMED keeps its phase across guided navigation while the panel guidance stays hidden, the connection root discloses no hold and the feedback provider counts stay frozen; NOT LLM',async()=>{
 const f=await connectedFixture({unknown:true});
 try{
  const connection='[id="shell.model-connection"]',guidance=f.page.locator(root+' [data-agent-connection-guidance="true"]'),outcome=f.page.locator(root+' [data-agent-connection-nav-outcome="true"]');
  await open(f);await selectConnectedView(f);await connect(f);await boundPlan(f);
  await f.page.locator('#pan548-agent-inference-consent').check();
  await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await state(f,'OUTCOME_UNCONFIRMED');await f.flushResponses();
  assert.equal(f.posts(),2,'PAN548_RUN105 the genuine feedback round did not happen exactly once');
  assert.equal(await f.page.locator(connection).getAttribute('data-unknown-usage-hold'),null,'PAN548_RUN105 a connection hold was claimed without a retained connection hold');
  assert.equal(await guidance.isVisible(),false,'PAN548_RUN105 a hold guidance claimed the task-only unconfirmed state');
  const requestsAtNav=f.requests.length,responsesAtNav=f.responses.length,taskText=await f.page.locator('#pan548-agent-intent').inputValue();
  await f.page.getByRole('button',{name:connectionNavLabelV1,exact:true}).click();
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'OUTCOME_UNCONFIRMED','PAN548_RUN105 the navigation overwrote the retained task phase');
  assert.equal(await guidance.isVisible(),false,'PAN548_RUN105 the navigation conjured a hold guidance in the task-only unconfirmed state');
  const outcomeText=await outcome.innerText();
  assert.ok(outcomeText.includes('geöffnet und fokussiert')&&outcomeText.includes('Auftragstext bleibt erhalten')&&outcomeText.includes('weder Fortsetzen'),'PAN548_RUN105 the navigation echo is not the honest no-action report: '+outcomeText);
  await f.flushResponses();
  assert.equal(f.requests.length,requestsAtNav,'PAN548_RUN105 the navigation triggered added requests');
  assert.equal(f.responses.length,responsesAtNav,'PAN548_RUN105 the navigation triggered added responses');
  assert.equal(f.posts(),2,'PAN548_RUN105 the navigation retried provider or feedback traffic');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN105 the navigation lost the unsent task text');
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
// RUN105 owner-bound negative: an externally priced retained hold stays with the qualified owner
// usage reader. The composed UI discloses reconcilable=false, the panel guidance and the navigation
// echo name the owner reader with no fake browser settlement, the dialog offers NO reconcile control,
// the focus route keeps the first ENABLED dialog control and the exact reconcile POST is denied by
// the owner with MODEL_CONNECTION_USAGE_ORACLE_UNAVAILABLE while the hold, its revision and the
// frozen provider count survive the denial.
test('PUI07 RUN105 externally priced retained hold stays owner-reader-only in the composed UI: reconcilable=false discloses without a fake browser settlement, guidance and navigation echo name the qualified owner reader, the exact reconcile POST is denied by MODEL_CONNECTION_USAGE_ORACLE_UNAVAILABLE and the full hold survives; NOT LLM',async()=>{
 const f=await connectedFixture({hangInferenceProbeOnce:true,ownerBoundPriced:true,maxTimeMs:3000});
 try{
  const connection='[id="shell.model-connection"]',guidance=f.page.locator(root+' [data-agent-connection-guidance="true"]');
  await open(f);await selectConnectedView(f);await connect(f);
  await f.page.locator(connection).getByRole('button',{name:'Genau diese gedeckelte Inferenzprobe freigeben',exact:true}).click();
  await f.page.locator(connection).getByRole('button',{name:'Begrenzte Inferenz separat prüfen',exact:true}).click();
  await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();await f.flushResponses();
  const held=connectionReadbacks548(f).at(-1).value;
  assert.equal(held.reason,'UNKNOWN_USAGE_RETAINED');assert.equal(held.unknownUsage.reconcilable,false,'PAN548_RUN105 the priced route claimed browser reconcilability');
  const heldOperation=held.unknownUsage.operationId;
  assert.equal(await f.page.locator(connection).getAttribute('data-unknown-usage-hold'),'OWNER_READER_ONLY','PAN548_RUN105 the priced hold disclosure is missing or misclassified');
  assert.equal(await f.page.locator('#pan565-reconcile').count(),0,'PAN548_RUN105 a fake browser settlement appeared for the priced hold');
  assert.ok((await f.page.locator(connection).innerText()).includes('Owner-Nutzungsleser'),'PAN548_RUN105 the dialog hides the owner-reader-only settlement');
  assert.equal(f.posts(),1,'PAN548_RUN105 the priced-route timeout was retried');
  await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).click();
  await state(f,'PLAN_DENIED');await f.flushResponses();
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'OWNER_READER_ONLY','PAN548_RUN105 the panel guidance ignored the priced hold disclosure');
  const guidanceText=await guidance.innerText();
  assert.ok(guidanceText.includes(heldOperation)&&guidanceText.includes('Owner-Nutzungsleser')&&guidanceText.includes('vollständige Reservierung'),'PAN548_RUN105 the priced guidance lacks the truthful claims: '+guidanceText);
  assert.ok(!guidanceText.includes('Nullpreis'),'PAN548_RUN105 the priced guidance invented a zero-price settlement: '+guidanceText);
  await connectedCapture(f,'desktop-run105-owner-bound-hold-guidance');
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsdialog schließen',exact:true}).click();
  await f.page.getByRole('button',{name:connectionNavLabelV1,exact:true}).click();
  await state(f,'CONNECTION_AREA_FOCUSED');
  assert.equal(await f.page.evaluate(()=>document.activeElement?.id),'pan565-connection-choice','PAN548_RUN105 the priced-route navigation faked a reconcile focus');
  const navStatusText=await f.page.locator(root+' [role="status"]').first().innerText();
  assert.ok(navStatusText.includes('keine Browser-Abgleichaktion')&&navStatusText.includes(heldOperation),'PAN548_RUN105 the priced-route navigation status is not honest: '+navStatusText);
  // RUN106: scope admission happens BEFORE the owner usage oracle on the protected route. The missing/foreign
  // header probes are separate exact403 scope-negative coverage, never a substitute for the owner's own refusal;
  // the owner-bound probe carries the ACTUAL held readback's own binding.sessionId, so the exact400 below can
  // only come from the owner's oracle — not from any earlier gate.
  assert.deepEqual(await reconcileProbe548(f,{operationId:heldOperation,identityDigest:held.identityDigest}),[403,'MODEL_CONNECTION_SCOPE_DENIED'],'PAN548_RUN106 the headerless priced probe was not denied by scope admission exactly');
  assert.deepEqual(await reconcileProbe548(f,{operationId:heldOperation,identityDigest:held.identityDigest},'session:'+'0'.repeat(64)),[403,'MODEL_CONNECTION_SCOPE_DENIED'],'PAN548_RUN106 the foreign-session priced probe was not denied by scope admission exactly');
  assert.deepEqual(await reconcileProbe548(f,{operationId:heldOperation,identityDigest:held.identityDigest},held.binding.sessionId),[400,'MODEL_CONNECTION_USAGE_ORACLE_UNAVAILABLE'],'PAN548_RUN106 the same-session probe reconciled the priced hold anyway or was denied before the owner oracle');
  assert.equal(reconcilePosts548(f).length,3,'PAN548_RUN106 the reconcile probe POST accounting drifted');
  await f.flushResponses();
  // Every denial mutates nothing: the EXPLICIT independent product read re-discloses the FULL hold live (the
  // owner-derived accounting truth) and the real persisted source row stands at its unchanged revision with the
  // held operation and the UNKNOWN_USAGE phase retained — read-only observation of the actual source, no fixture state.
  const readsAtProbe=connectionReadbacks548(f).length;
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  await f.page.locator(connection+'[data-state="CURRENT_CONNECTION"]').waitFor();await f.flushResponses();
  assert.equal(connectionReadbacks548(f).length,readsAtProbe+1,'PAN548_RUN106 the post-denial independent read is missing or doubled');
  const after=connectionReadbacks548(f).at(-1).value;
  assert.deepEqual(after.unknownUsage,held.unknownUsage,'PAN548_RUN106 the denied reconcile altered the disclosed hold');
  assert.equal(after.revision,held.revision,'PAN548_RUN105 the denial mutated the hold');
  const rowAfter=persistedConnectionRow548(f);
  assert.equal(rowAfter.revision,held.revision,'PAN548_RUN106 the denied reconcile advanced the persisted source revision');
  assert.equal(rowAfter.state.lastOperation,heldOperation,'PAN548_RUN106 the denied reconcile dropped the held operation from the real source');
  assert.equal(rowAfter.state.checks.INFERENCE.state,'UNKNOWN_USAGE','PAN548_RUN106 the real source no longer retains the priced hold');
  assert.equal(f.posts(),1,'PAN548_RUN105 the denied reconcile touched the provider');
  assert.equal(f.readPersisted().revision,0);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
// RUN107/RUN108 PUI-07-AC01/AC03/04 + UIDOD-03/07 with #565 A4-AC05/06: the USEFUL connected requalification journey after the genuine settled hold, on the UNCHANGED closed caps. The only guidance source stays the connection module's live validated disclosure: while the dialog currently discloses a confirmed readback (CURRENT_CONNECTION, no hold) but the TASK layer stays denied, the panel tells that truth (CONNECTION_CONFIRMED_TASK_DENIED) instead of the old false 'connection not confirmed or revoked' sentence. The denial survives an unconfirmed read (honest GENERIC fallback) and is re-sourced live by the fresh read — never a cached offer. RUN108 removed the invalid RUN107 fixture boost: the contract's closed ceiling (validateModelConnectionLimitsV1: maxRequests<=3) rejects 6, and the same-grant task admission reserves the grant's ENTIRE request ceiling (native-model-connection.mjs prepareFeedback: budgetSnapshot.runtime.committedUnits+limits.maxRequests>g.limits.maxRequests), so any single consumed request legitimately blocks that grant's task forever. A same-grant task positive is therefore NOT source-supported here — this journey fabricates none, resets no ledger, issues no new grant, falls back to no provider and relaxes no guard; the accepted fresh-native positive journeys in this file run on unspent grants and stay retained. Instead the truth is proven live: the genuine settlement, the honest denial guidance, the explicit dialog re-selection plus prerequisite rechecks that genuinely pass, the connection layer re-earning its OWN positive within the remaining request budget through its own controls (two further real synthetic provider requests, settled with observed usage), the actual persisted native ledger settling exactly the three real requests with no refund, the exhausted closed grant disclosed honestly as BUDGET_EXHAUSTED in both layers, and the task denial that never auto-retries nor promises success. Desktop and 390 captures prove the changed rendering is actually readable and hit-reachable. Controlled synthetic transport: NOT LLM.
test('PUI07 RUN107 connected settled-hold requalification on the unchanged closed caps: after the genuine zero-price settlement the confirmed connection earns the honest CONNECTION_CONFIRMED_TASK_DENIED guidance instead of a false not-confirmed claim, the spent-grant task denial survives the fresh explicit rechecks without any forged same-grant task positive or refund, the connection layer re-earns its own positive within the remaining request budget through its own controls, the persisted native ledger settles exactly the three real requests, and the exhausted closed grant plus the still-denied task honestly offer nothing more; NOT LLM',async()=>{
 const f=await connectedFixture({hangInferenceProbeOnce:true,maxTimeMs:3000});
 try{
  const before=f.business(),connection='[id=\"shell.model-connection\"]',guidance=f.page.locator(root+' [data-agent-connection-guidance=\"true\"]'),consent=f.page.locator('#pan548-agent-inference-consent');
  const planAgain=async()=>{await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).click();await state(f,'PLAN_DENIED');await f.flushResponses();};
  const guidanceGeometryV1=async label=>{await guidance.evaluate(n=>n.scrollIntoView({block:'center'}));const g=await guidance.evaluate(n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,vw:innerWidth,vh:innerHeight,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth};});assert.ok(g.height>0&&g.top>=0&&g.bottom<=g.vh,'PAN548_RUN107_GUIDANCE_NOT_FULLY_REVEALABLE_BY_SCROLL_'+label+':'+JSON.stringify(g));assert.ok(g.left>=0&&g.right<=g.vw&&g.scrollWidth<=g.clientWidth+1,'PAN548_RUN107_GUIDANCE_HORIZONTALLY_CLIPPED_'+label+':'+JSON.stringify(g));const hitSelf=await guidance.evaluate(n=>{const r=n.getBoundingClientRect(),hit=document.elementFromPoint(Math.min(Math.max(r.left+r.width/2,0),innerWidth-1),Math.min(Math.max(r.top+r.height/2,1),innerHeight-1));return hit===n||n.contains(hit);});assert.ok(hitSelf,'PAN548_RUN107_GUIDANCE_NOT_ACTUALLY_SHOWN_ON_TOP_'+label+':'+JSON.stringify(g));};
  await open(f);await selectConnectedView(f);await connect(f);
  // Test base: the genuine probe-timeout hold still denies the plan with its own truthful hold line.
  const held=await retainedProbeHold548(f),heldOperation=held.unknownUsage.operationId;
  await planAgain();
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'RECONCILABLE_ZERO_PRICE','PAN548_RUN107 the test base lacks the live hold guidance');
  // Existing explicit zero-price settlement through the dialog's OWN focused control, keyboard-operated: exactly one reconcile POST plus the mandatory independent readback, the real source row persists the settlement with the operation retained.
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsdialog schließen',exact:true}).click();
  const taskText=await f.page.locator('#pan548-agent-intent').inputValue(),startsBefore=count(f,'start'),readsAtNav=connectionReadbacks548(f).length;
  await f.page.getByRole('button',{name:connectionNavLabelV1,exact:true}).click();
  await state(f,'CONNECTION_AREA_FOCUSED');
  assert.equal(await f.page.evaluate(()=>document.activeElement?.id),'pan565-reconcile','PAN548_RUN107 navigation did not focus the dialog’s own reconcile control');
  await f.page.keyboard.press('Enter');
  await f.page.locator(connection+'[data-state=\"CURRENT_CONNECTION\"]').waitFor();await f.flushResponses();
  assert.equal(reconcilePosts548(f).length,1,'PAN548_RUN107 the settlement reconcile POST is not exactly one');
  assert.equal(connectionReadbacks548(f).length,readsAtNav+1,'PAN548_RUN107 the mandatory independent readback is missing or doubled');
  const settledRow=persistedConnectionRow548(f);
  assert.equal(settledRow.state.lastOperation,heldOperation,'PAN548_RUN107 the settled operation vanished from the real source');
  assert.ok((await f.page.locator(connection).innerText()).includes('SYNTHETIC_ZERO_PRICE_RECONCILED_NO_MODEL_PASS'),'PAN548_RUN107 the settled inference state is not honestly re-read');
  // (A) The confirmed-connection denial truth replaces the old GENERIC lie while the task layer stands denied.
  await planAgain();
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'CONNECTION_CONFIRMED_TASK_DENIED','PAN548_RUN107 the confirmed connection was still denied with the old not-confirmed claim');
  const guidanceText=await guidance.innerText();
  for(const claim of['Fehlender Schritt','unabhängig gelesen','weder Abschluss noch Wiederaufnahme','Anfragen-Budget','Verbindungsbereich öffnen','Verweigert bleibt verweigert','keine Erstattung','kein automatischer Retry','Owner-Freigabe'])assert.ok(guidanceText.includes(claim),'PAN548_RUN107 the confirmed-connection guidance lacks the truth '+claim+': '+guidanceText);
  for(const absent of['Nutzungs-Hold','Nullpreis','nicht bestätigt oder entwertet','abgehakt'])assert.ok(!guidanceText.includes(absent),'PAN548_RUN107 the confirmed-connection guidance claims '+absent+': '+guidanceText);
  assert.equal(await f.page.locator('#pan565-reconcile').count(),0,'PAN548_RUN107 a fabricated browser settlement appeared after the settlement');
  assert.equal(await consent.isVisible(),false,'PAN548_RUN107 a stale consent revived while the task stays denied');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN107 the confirmed connection forged task startability');
  assert.equal(f.posts(),1,'PAN548_RUN107 the requalification guidance stage touched the provider');
  assert.equal(count(f,'start'),startsBefore,'PAN548_RUN107 the denied requalification started a task');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN107 the denied stage lost the unsent task text');
  // The changed rendering is actually readable and hit-reachable at desktop AND 390, then captured.
  await guidanceGeometryV1('desktop');
  await connectedCapture(f,'desktop-run107-confirmed-connection-task-denied-guidance');
  await f.page.setViewportSize({width:390,height:844});
  await showAgentTechnicalUI(f.page);
  await guidanceGeometryV1('phone390');
  await connectedCapture(f,'desktop-run107-confirmed-connection-task-denied-guidance-390');
  await f.page.setViewportSize({width:1280,height:900});
  // (B) Denied-state staleness: a REAL lost independent read demotes the guidance to the honest GENERIC sentence; the fresh read re-sources the confirmed-connection truth on the next panel render pass — presentation, never a cached offer. The denial itself mutates nothing in the real source.
  await f.page.route('**/workspace/model-connection',route=>route.request().method()==='GET'?void route.abort('failed'):void route.continue());
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  await f.page.locator(connection+'[data-state=\"READBACK_NOT_CONFIRMED\"]').waitFor();await f.flushResponses();
  await planAgain();
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'GENERIC','PAN548_RUN107 the unconfirmed read kept claiming a confirmed connection');
  const deniedGuidance=await guidance.innerText();
  assert.ok(deniedGuidance.includes('nicht bestätigt')&&!deniedGuidance.includes('Nutzungs-Hold'),'PAN548_RUN107 the lost-read guidance misreports the state: '+deniedGuidance);
  await f.page.unroute('**/workspace/model-connection');
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  await f.page.locator(connection+'[data-state=\"CURRENT_CONNECTION\"]').waitFor();await f.flushResponses();
  await planAgain();
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'CONNECTION_CONFIRMED_TASK_DENIED','PAN548_RUN107 the fresh read did not re-source the confirmed-connection denial truth live');
  const denialRow=persistedConnectionRow548(f);
  assert.equal(denialRow.revision,settledRow.revision,'PAN548_RUN107 the denied requalification advanced the persisted revision (no refund, no reset)');
  assert.equal(denialRow.state.lastOperation,heldOperation,'PAN548_RUN107 the denied requalification dropped the settled operation barrier');
  assert.equal(f.posts(),1,'PAN548_RUN107 the denied requalification touched the provider');
  // (C) Genuine requalification ONLY through the dialog's OWN controls: the explicit reference re-selection lifts the settled operation barrier and resets the check evidence honestly; the explicit prerequisite rechecks pass for real.
  await f.page.locator(connection).getByRole('button',{name:'Genau diese Referenz setzen',exact:true}).click();
  await f.page.locator(connection+'[data-state=\"CURRENT_CONNECTION\"]').waitFor();await f.flushResponses();
  const reselected=connectionReadbacks548(f).at(-1).value;
  assert.equal(reselected.unknownUsage,null,'PAN548_RUN107 the re-selection disclosed a phantom hold');
  assert.equal(reselected.revision,settledRow.revision+1,'PAN548_RUN107 the explicit re-selection did not persist exactly one revision bump');
  assert.equal(persistedConnectionRow548(f).state.lastOperation,null,'PAN548_RUN107 the settled operation barrier survived the explicit reference reset');
  const resetPhases=await f.page.locator(connection+' ul').innerText();
  assert.ok(resetPhases.includes('Erreichbarkeit: NOT_RUN'),'PAN548_RUN107 the re-selection did not reset the check evidence honestly: '+resetPhases);
  for(const label of['Erreichbarkeit','Authentifizierung','Modellverfügbarkeit']){await f.page.locator(connection).getByRole('button',{name:label+' separat prüfen',exact:true}).click();await f.page.locator(connection+'[data-state=\"CURRENT_CONNECTION\"]').waitFor();await f.flushResponses();}
  const requalifiedPhases=await f.page.locator(connection+' ul').innerText();
  assert.ok(requalifiedPhases.includes('Modellverfügbarkeit: PASS'),'PAN548_RUN107 the prerequisite recheck did not genuinely pass: '+requalifiedPhases);
  assert.equal(f.posts(),1,'PAN548_RUN107 the recheck stage touched the provider');
  // (D) The real stock-cap truth under the unchanged closed contract ceiling: settlement refunded nothing, and a task plan reserves the grant's ENTIRE request ceiling, so any task on this same grant stays denied for good — no ledger reset, no new grant, no provider fallback, no guard relaxation. This journey fabricates no same-grant task positive (the accepted fresh-native positive journeys in this file run on unspent grants); it proves the accounting truth live instead.
  await planAgain();
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'CONNECTION_CONFIRMED_TASK_DENIED','PAN548_RUN107 the freshly rechecked confirmed connection was still denied with the old not-confirmed claim');
  assert.ok((await guidance.innerText()).includes('Anfragen-Budget'),'PAN548_RUN107 the spent-grant guidance no longer names the consumed request budget as a real barrier');
  const spent=connectionReadbacks548(f).at(-1).value;
  assert.equal(spent.reason,'REFERENCE_SELECTED_NOT_INFERENCE','PAN548_RUN107 the connection layer stopped honestly disclosing the re-read reference with remaining probe budget');
  assert.notEqual(spent.inferenceOffer,null,'PAN548_RUN107 the connection layer hid the probe budget that genuinely remains below the closed ceiling');
  assert.equal(await consent.isVisible(),false,'PAN548_RUN107 a stale task consent revived while the spent grant denies the task');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN107 the spent grant falsely promised task startability');
  assert.equal(f.posts(),1,'PAN548_RUN107 the spent-grant task denial touched the provider');
  assert.equal(count(f,'start'),startsBefore,'PAN548_RUN107 the spent-grant task denial started a task');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN107 the spent-grant denial lost the unsent task text');
  // The connection layer itself re-earns an honest positive where the remaining request budget permits, using ONLY its own controls: one explicit consent, one real provider request, settled with observed usage in the existing ledger.
  await f.page.locator(connection).getByRole('button',{name:'Genau diese gedeckelte Inferenzprobe freigeben',exact:true}).click();
  await f.page.locator(connection+'[data-state=\"CURRENT_CONNECTION\"]').waitFor();await f.flushResponses();
  assert.equal(connectionReadbacks548(f).at(-1).value.consent,'BOUNDED_ONCE','PAN548_RUN107 the second explicit probe consent was not honestly re-read');
  await f.page.locator(connection).getByRole('button',{name:'Begrenzte Inferenz separat prüfen',exact:true}).click();
  await f.page.locator(connection+' li',{hasText:'Begrenzte Inferenz: PASS'}).first().waitFor();await f.flushResponses();
  const reprobe=connectionReadbacks548(f).at(-1).value;
  assert.equal(reprobe.checks.INFERENCE.reason,'SYNTHETIC_INFERENCE_FORMAT_ONLY','PAN548_RUN107 the second real probe did not honestly disclose the synthetic format observation');
  assert.equal(reprobe.unknownUsage,null,'PAN548_RUN107 the second probe did not settle with its observed usage');
  assert.equal(reprobe.reason,'REFERENCE_SELECTED_NOT_INFERENCE','PAN548_RUN107 the connection layer stopped honestly disclosing the remaining budget after the second probe');
  const rowProbe2=persistedConnectionRow548(f);
  assert.match(rowProbe2.state.lastOperation,/^operation:mc-[a-f0-9]{40}$/,'PAN548_RUN107 the second probe did not persist its own native operation');
  assert.notEqual(rowProbe2.state.lastOperation,heldOperation,'PAN548_RUN107 the second probe reused the settled operation');
  assert.ok(rowProbe2.revision>reselected.revision,'PAN548_RUN107 the re-earned positive did not advance the persisted source revision');
  assert.equal(f.posts(),2,'PAN548_RUN107 the second probe did not add exactly one provider request');
  assert.equal(await consent.isVisible(),false,'PAN548_RUN107 the re-earned connection positive falsely promised a task consent');
  assert.equal(count(f,'start'),startsBefore,'PAN548_RUN107 the re-earned connection positive started a task');
  // The whole closed ceiling: one more complete cycle consumes the third and last request of this grant; the actual persisted native ledger settles exactly the three real requests, and both layers then honestly offer nothing more.
  await f.page.locator(connection).getByRole('button',{name:'Genau diese Referenz setzen',exact:true}).click();
  await f.page.locator(connection+'[data-state=\"CURRENT_CONNECTION\"]').waitFor();await f.flushResponses();
  for(const label of['Erreichbarkeit','Authentifizierung','Modellverfügbarkeit']){await f.page.locator(connection).getByRole('button',{name:label+' separat prüfen',exact:true}).click();await f.page.locator(connection+'[data-state=\"CURRENT_CONNECTION\"]').waitFor();await f.flushResponses();}
  await f.page.locator(connection).getByRole('button',{name:'Genau diese gedeckelte Inferenzprobe freigeben',exact:true}).click();
  await f.page.locator(connection+'[data-state=\"CURRENT_CONNECTION\"]').waitFor();await f.flushResponses();
  await f.page.locator(connection).getByRole('button',{name:'Begrenzte Inferenz separat prüfen',exact:true}).click();
  await f.page.locator(connection+' li',{hasText:'Begrenzte Inferenz: PASS'}).first().waitFor();await f.flushResponses();
  const exhausted=connectionReadbacks548(f).at(-1).value;
  assert.equal(exhausted.reason,'BUDGET_EXHAUSTED','PAN548_RUN107 the genuinely spent closed grant was not disclosed as exhausted');
  assert.equal(exhausted.inferenceOffer,null,'PAN548_RUN107 a stale offer survived the genuinely spent grant');
  assert.equal(exhausted.consent,'NOT_GRANTED','PAN548_RUN107 a stale consent survived the spent grant');
  assert.equal(await f.page.locator('#pan565-consent').count(),0,'PAN548_RUN107 the dialog offered another probe past the closed request ceiling');
  assert.ok((await f.page.locator(connection).innerText()).includes('Natives Budget ersch'),'PAN548_RUN107 the dialog does not honestly disclose the exhausted native budget');
  const ledgerRows=nativeLedgerRows548(f);
  assert.equal(ledgerRows.length,3,'PAN548_RUN107 the persisted native ledger does not contain exactly the three real probe operations');
  for(const row of ledgerRows){assert.equal(row.state,'SETTLED','PAN548_RUN107 a native probe request was not settled in the persisted ledger');assert.equal(row.runtime_units,1,'PAN548_RUN107 a native probe over-reserved its request');assert.equal(row.runtime_consumed,1,'PAN548_RUN107 a genuinely consumed native request was refunded on the ledger');}
  assert.equal(f.posts(),3,'PAN548_RUN107 the actual accounting drifted from exactly three provider requests');
  // Both layers keep telling the denial truth: a confirmed connection plus a spent grant yields no offer, no consent, no start and no automatic retry.
  await planAgain();
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'CONNECTION_CONFIRMED_TASK_DENIED','PAN548_RUN107 the guidance stopped telling the denial truth once the grant was genuinely spent');
  assert.ok((await guidance.innerText()).includes('Verweigert bleibt verweigert'),'PAN548_RUN107 the spent-grant guidance lost the denial truth');
  await planAgain();
  assert.equal(f.posts(),3,'PAN548_RUN107 the denial automatically retried the provider');
  assert.equal(count(f,'start'),startsBefore,'PAN548_RUN107 the spent grant falsely started a task');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN107 the spent-grant journey lost the unsent task text');
  assert.equal(await consent.isVisible(),false,'PAN548_RUN107 a stale consent revived at the true terminal');
  await connectedCapture(f,'desktop-run107-stock-cap-spent-denial');
  // (E) Session retirement discards the whole panel presentation.
  await f.page.getByRole('button',{name:'Abmelden',exact:true}).click();
  await f.page.getByRole('heading',{name:'Abgemeldet',exact:true}).waitFor();
  assert.equal(await f.page.locator(root).count(),0,'PAN548_RUN107 the panel survived the logout');
  assert.equal(await f.page.locator(root+' [data-agent-connection-guidance=\"true\"]').count(),0,'PAN548_RUN107 a stale guidance survived the logout');
  assert.equal(f.readPersisted().revision,0);assert.equal(f.business(),before);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
// RUN109 #565 A4-AC05 ("Rechtsentzug/Secretrotation deaktiviert abhängige Bereitschaft") + #548 PUI-07-AC01/03/04 on the REAL composed connected mount. The server already invalidated the dependent state (persisted secretFingerprint vs the freshly read transport fingerprint in native-model-connection.mjs current()/projection: checks demote to STALE · IDENTITY_OR_SECRET_CHANGED, every dependent mutation answers 409 MODEL_CONNECTION_STALE_DENIED via origin-session-adapter.mjs) — the genuine connected gap was the SAME-shell browser: the RUN79 revocation hint only watched revision/selectedConnectionId/identityDigest, all UNCHANGED by a rotation, so a checked cached task offer survived the rotation read, and the RUN107 guidance would have told the rotation state as 'confirmed connection, task denied'. This journey closes the user's coherent recovery path with the two narrow product fixes (workspace-model-connection-v1.ts: mirror the validated closed reason + compare the closed readiness-truth vector in the invalidation hint; workspace-agent-panel-v1.ts: tell the rotation truth CONNECTION_SECRET_OR_IDENTITY_CHANGED). The fixture owner rotates ONLY its own generated synthetic bytes; the local peer accepts only the current bytes, so the rotation is real on the wire — digests are recorded, secret bytes never. No new grant/identity/budget reset/provider fallback/UNKNOWN retry; secret/config identity stays separate from session ownership (the same session, origin and profile row survive; only the fingerprint binding re-earns); the native565 direct rotation regression stays independent; NOTHING here claims whole567/original-issue/visual acceptance.
test('PUI07 RUN109 actual connected synthetic secret rotation deactivates dependent task readiness in the same shell: the forced cached authority is denied exactly by the backend with zero provider traffic, the real independent read revokes the checked cached offer/consent/startability while the unsent text survives, the panel tells the rotation truth instead of a false confirmed-denial claim, a lost read restores nothing, and safe recovery rides ONLY the existing reference-set plus prerequisite rechecks, a fresh explicit plan and the separate unchecked consent into exactly one two-POST synthetic backend run on the same initially unspent grant with persisted independent readback and reload, and RUN112: the recovered task stays useful through the EXISTING separate546 view editor (explicit before/after preview, cancellation leaves the persistent target unchanged, only the separate deliberate confirmation CAS-saves, independent persisted read and reload show the actual bounded personal-view change, the existing Undo is again explicitly confirmed and read) and RUN114: while that preview is open a second authenticated tab of the same session performs its own bounded preview plus separate deliberate confirmation which wins exactly one CAS, the late first-tab confirmation is denied truthfully with the persisted revision conflict (409 SAVE_DENIED, draft preserved, no blind retry, no lost-update overwrite), the explicit re-read keeps the draft while the discarded draft renders the winner and the Undo history appends on top of the winner) while the run/source/phase and connection truth stay coherent with zero added provider traffic; NOT LLM',async()=>{
 const f=await connectedFixture();let cdp,second;
 try{
  const before=f.business(),connection='[id=\"shell.model-connection\"]',guidance=f.page.locator(root+' [data-agent-connection-guidance=\"true\"]'),consent=f.page.locator('#pan548-agent-inference-consent');
  const rotatedV1='SYNTHETIC_PRIVATE_FILE_CANARY_ROTATED_RUN109_NOT_A_REAL_CREDENTIAL';
  const guidanceGeometryV1=async label=>{await guidance.evaluate(n=>n.scrollIntoView({block:'center'}));const g=await guidance.evaluate(n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,vw:innerWidth,vh:innerHeight,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth};});assert.ok(g.height>0&&g.top>=0&&g.bottom<=g.vh,'PAN548_RUN109_GUIDANCE_NOT_FULLY_REVEALABLE_BY_SCROLL_'+label+':'+JSON.stringify(g));assert.ok(g.left>=0&&g.right<=g.vw&&g.scrollWidth<=g.clientWidth+1,'PAN548_RUN109_GUIDANCE_HORIZONTALLY_CLIPPED_'+label+':'+JSON.stringify(g));const hitSelf=await guidance.evaluate(n=>{const r=n.getBoundingClientRect(),hit=document.elementFromPoint(Math.min(Math.max(r.left+r.width/2,0),innerWidth-1),Math.min(Math.max(r.top+r.height/2,1),innerHeight-1));return hit===n||n.contains(hit);});assert.ok(hitSelf,'PAN548_RUN109_GUIDANCE_NOT_ACTUALLY_SHOWN_ON_TOP_'+label+':'+JSON.stringify(g));};
  await open(f);await selectConnectedView(f);await connect(f);
  const readbackPre=connectionReadbacks548(f).at(-1).value,identityPre=readbackPre.identityDigest,revisionPre=readbackPre.revision,sessionV1=readbackPre.binding.sessionId;
  // RUN111: from the FIRST connected readback on, the passing reachability check is honestly disclosed as UNAUTHENTICATED reachability (the product deliberately probes it without a bearer; see the phase-ordered wire oracle below) — so the whole journey proves the same oracle on both sides of the rotation.
  assert.equal(readbackPre.checks.REACHABILITY.reason,'TARGET_REACHED_NOT_AUTH_OR_INFERENCE','PAN548_RUN109 the pre-rotation reachability pass was not honestly disclosed as unauthenticated reachability');
  const p=await boundPlan(f);
  const startControl=await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).elementHandle();
  await consent.check();
  assert.equal(await startControl.evaluate(b=>b.disabled),false,'PAN548_RUN109 the checked exact offer was not actionable before the rotation');
  const taskText=await f.page.locator('#pan548-agent-intent').inputValue();
  assert.notEqual(taskText,'','PAN548_RUN109 missing unsent task text');
  const startsBefore=count(f,'start'),probePostsBefore=f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/model-connection/probe')).length;
  assert.equal(f.posts(),0,'PAN548_RUN109 the checked offer had already touched the provider');
  // THE rotation: the fixture owner rotates ONLY its own generated synthetic credential bytes (no host secret, no configuration/target change).
  await f.rotateSyntheticCredential(rotatedV1);
  assert.equal(f.currentCredentialDigest(),hash(rotatedV1),'PAN548_RUN109 the fixture rotation did not take effect');
  // Forced activation of the stale cached authority over the EXACT route: the owner denies BEFORE dispatch — parent-exact denial, zero provider traffic, persisted row untouched.
  assert.deepEqual(await probePostV1109(f,{schemaVersion:'pansphaira.workspace-model-connection/probe/v1',expectedRevision:revisionPre,identityDigest:identityPre,phase:'REACHABILITY'},sessionV1),[409,'MODEL_CONNECTION_STALE_DENIED'],'PAN548_RUN109 the forced stale cached probe authority was not denied exactly by the backend');
  await f.flushResponses();
  assert.equal(f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/model-connection/probe')).length,probePostsBefore+1,'PAN548_RUN109 the forced stale probe POST was not exactly one');
  assert.equal(f.posts(),0,'PAN548_RUN109 the forced stale cached authority dispatched provider inference');
  const rowForced=persistedConnectionRow548(f);
  assert.equal(rowForced.revision,revisionPre,'PAN548_RUN109 the denied forced probe mutated the persisted connection revision');
  assert.equal(rowForced.state.lastOperation,null,'PAN548_RUN109 the denied forced probe left an operation barrier');
  // The ACTUAL independent connection read exposes the stale/not-ready truth and invalidates the dependent cached task readiness — unsent text and native truth stay intact.
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  await state(f,'CONNECTION_CHANGE_OFFER_REVOKED');
  await f.page.locator(connection+'[data-state=\"CURRENT_CONNECTION\"]').waitFor();await f.flushResponses();
  const stale=connectionReadbacks548(f).at(-1).value;
  assert.equal(stale.reason,'IDENTITY_OR_SECRET_CHANGED','PAN548_RUN109 the independent read did not expose the rotated secret as the reason');
  assert.equal(stale.readyForInference,false,'PAN548_RUN109 the stale read still claimed readiness');
  assert.equal(stale.unknownUsage,null,'PAN548_RUN109 the rotation read invented a usage hold');
  assert.equal(stale.revision,revisionPre,'PAN548_RUN109 the rotation alone bumped the persisted revision (secret identity is not session ownership)');
  assert.equal(stale.identityDigest,identityPre,'PAN548_RUN109 the secret rotation changed the target identity itself');
  for(const phase of['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY']){assert.equal(stale.checks[phase].state,'STALE','PAN548_RUN109 the rotation did not demote '+phase);assert.equal(stale.checks[phase].reason,'IDENTITY_OR_SECRET_CHANGED','PAN548_RUN109 the demotion of '+phase+' lacks the truthful reason');}
  assert.equal(stale.checks.INFERENCE.state,'NOT_RUN','PAN548_RUN109 the rotation faked an inference-state demotion');
  const dialogText=await f.page.locator(connection).innerText();
  assert.ok(dialogText.includes('Erreichbarkeit: STALE · IDENTITY_OR_SECRET_CHANGED'),'PAN548_RUN109 the dialog does not honestly re-read the demoted evidence:'+dialogText);
  assert.equal(await consent.isVisible(),false,'PAN548_RUN109 the rotation left a stale task consent visible');
  assert.equal(await consent.isChecked(),false,'PAN548_RUN109 the rotation left a stale task consent checked');
  assert.equal(await startControl.evaluate(b=>b.disabled),true,'PAN548_RUN109 the rotation left the cached start enabled');
  assert.equal(await startControl.evaluate(b=>b.isConnected),true,'PAN548_RUN109 the revocation dropped the retained start node');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN109 the rotation left a cached startability');
  assert.equal(await f.page.locator(root).getAttribute('data-plan-expired-reason'),null,'PAN548_RUN109 the rotation revocation was faked as a deadline expiry');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN109 the rotation revocation lost the unsent task text');
  // The rotation truth is told AS the rotation truth — not as a confirmed-connection task denial, not as a generic unconfirmed state.
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'CONNECTION_SECRET_OR_IDENTITY_CHANGED','PAN548_RUN109 the panel told the rotation state with the wrong truth kind');
  const guidanceText=await guidance.innerText();
  for(const claim of['Secret- oder Konfigurationsidentität','geändert','ausdrücklich neu','jede Phase unabhängig','frisches, nicht angehaktes Angebot','kein automatischer Retry','keine Erstattung','kein Providerwechsel','Verbindungsbereich öffnen','Auftragstext bleibt erhalten'])assert.ok(guidanceText.includes(claim),'PAN548_RUN109 the rotation guidance lacks the truth '+claim+': '+guidanceText);
  for(const absent of['Nutzungs-Hold','Nullpreis','nicht bestätigt oder entwertet','Verweigert bleibt verweigert','abgehakt'])assert.ok(!guidanceText.includes(absent),'PAN548_RUN109 the rotation guidance claims '+absent+': '+guidanceText);
  await guidanceGeometryV1('desktop');
  await connectedCapture(f,'desktop-run109-rotated-secret-stale-readiness-revoked');
  await f.page.setViewportSize({width:390,height:844});
  await showAgentTechnicalUI(f.page);
  await guidanceGeometryV1('390');
  await connectedCapture(f,'390-run109-rotated-secret-stale-readiness-revoked');
  await f.page.setViewportSize({width:1280,height:900});
  // A forced click on the retained disabled start dispatches nothing; no hidden read/replan hides behind the revocation.
  const requestsAtRevoke=f.requests.length;
  await startControl.evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await new Promise(r=>setTimeout(r,150));await f.flushResponses();
  assert.equal(count(f,'start'),startsBefore,'PAN548_RUN109 a forced click on the revoked stale start dispatched');
  assert.equal(f.requests.length,requestsAtRevoke,'PAN548_RUN109 the forced click or the revocation triggered a hidden request');
  // Ordinary guided navigation (RUN82 lifecycle): zero added traffic, focus lands on the stale dialog's own first enabled control.
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsdialog schließen',exact:true}).click();
  const requestsAtNav=f.requests.length,responsesAtNav=f.responses.length;
  await f.page.getByRole('button',{name:connectionNavLabelV1,exact:true}).click();
  await state(f,'CONNECTION_AREA_FOCUSED');
  assert.equal(await f.page.evaluate(()=>document.activeElement?.id),'pan565-connection-choice','PAN548_RUN109 the guided navigation did not focus the stale dialog reference control');
  assert.equal(f.requests.length,requestsAtNav,'PAN548_RUN109 the guided navigation issued added requests');
  assert.equal(f.responses.length,responsesAtNav,'PAN548_RUN109 the guided navigation issued added responses');
  // Forced task activation with the panel's cached plan authority: the backend denies it exactly AGAIN; nothing started, nothing touched the provider.
  await f.page.locator(root).getByRole('button',{name:'Gebundenen Auftrag und Angebot planen',exact:true}).click();
  await state(f,'PLAN_DENIED');await f.flushResponses();
  assert.equal(f.responses.filter(r=>r.path.endsWith('/agent-run/plan')).at(-1).status,409,'PAN548_RUN109 the stale cached task authority was not denied exactly by the backend');
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'CONNECTION_SECRET_OR_IDENTITY_CHANGED','PAN548_RUN109 the plan denial lost the rotation truth');
  assert.equal(f.posts(),0,'PAN548_RUN109 the stale task denial touched the provider');
  assert.equal(count(f,'start'),startsBefore,'PAN548_RUN109 the stale task denial started a task');
  // A REAL lost independent read never restores readiness — the honest generic fallback stands until a fresh read.
  cdp=await f.context.newCDPSession(f.page);
  let denied,resolvePaused;const paused=new Promise(r=>{resolvePaused=r;});
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:f.tls.origin+'*/workspace/model-connection',requestStage:'Response'}]});
  cdp.on('Fetch.requestPaused',event=>{if(event.request.method==='GET'){denied=event;resolvePaused();}});
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  await paused;
  await cdp.send('Fetch.failRequest',{requestId:denied.requestId,errorReason:'Failed'});
  await f.page.locator(connection+'[data-state=\"READBACK_NOT_CONFIRMED\"]').waitFor();await f.flushResponses();
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'GENERIC','PAN548_RUN109 the lost read kept presenting a freshly confirmed truth');
  const lostGuidance=await guidance.innerText();
  assert.ok(lostGuidance.includes('nicht bestätigt')&&!lostGuidance.includes('Secret'),'PAN548_RUN109 the lost-read guidance misrepresented the state: '+lostGuidance);
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN109 the lost read restored a readiness');
  assert.equal(await consent.isVisible(),false,'PAN548_RUN109 the lost read revived a stale consent');
  await cdp.send('Fetch.disable');
  // The fresh read correctly re-sources the current truth; the whole denial sequence mutated nothing (no refund, no reset, no retry).
  await f.page.locator(connection).getByRole('button',{name:'Verbindungsstatus unabhängig lesen',exact:true}).click();
  await f.page.locator(connection+'[data-state=\"CURRENT_CONNECTION\"]').waitFor();await f.flushResponses();
  assert.equal(connectionReadbacks548(f).at(-1).value.reason,'IDENTITY_OR_SECRET_CHANGED','PAN548_RUN109 the fresh read did not re-source the rotation truth live');
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'CONNECTION_SECRET_OR_IDENTITY_CHANGED','PAN548_RUN109 the fresh read did not re-source the rotation guidance');
  assert.equal(persistedConnectionRow548(f).revision,revisionPre,'PAN548_RUN109 a stale-leg denial mutated the persisted revision');
  assert.equal(f.posts(),0,'PAN548_RUN109 a stale leg touched the provider');
  // Safe recovery ONLY through the existing explicit reference re-set (keyboard-operated): it re-binds the rotated fingerprint honestly with checks back at NOT_RUN and revives no offer.
  await f.page.locator(connection).getByRole('button',{name:'Genau diese Referenz setzen',exact:true}).focus();
  await f.page.keyboard.press('Enter');
  await f.page.locator(connection+'[data-state=\"CURRENT_CONNECTION\"]').waitFor();await f.flushResponses();
  const reselected=connectionReadbacks548(f).at(-1).value;
  assert.equal(reselected.reason,'REFERENCE_SELECTED_NOT_INFERENCE','PAN548_RUN109 the explicit re-selection did not honestly re-bind the rotated fingerprint');
  for(const phase of['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY','INFERENCE'])assert.equal(reselected.checks[phase].state,'NOT_RUN','PAN548_RUN109 the re-selection did not honestly reset '+phase);
  const rowResel=persistedConnectionRow548(f);
  assert.equal(rowResel.revision,revisionPre+1,'PAN548_RUN109 the explicit re-selection did not persist exactly one revision bump');
  assert.equal(rowResel.state.lastOperation,null,'PAN548_RUN109 the re-selection carried an operation barrier');
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'PLAN_DENIED','PAN548_RUN109 the re-selection revived a cached offer');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN109 the re-selection revived a startability');
  assert.equal(await guidance.getAttribute('data-agent-connection-guidance-kind'),'CONNECTION_CONFIRMED_TASK_DENIED','PAN548_RUN109 the re-bound connection was not honestly separated from the still-denied task');
  // The three explicit prerequisite rechecks genuinely PASS — the peer answers ONLY the rotated bytes, so the wire proves the rotation (digests only, never secret bytes). RUN111: the credential oracle is PHASE-CORRECT and source-bound: probe() (src/pan565/native-model-connection.mjs:104) passes withCredential=false for REACHABILITY and the transport (src/pan565/connection-transport.mjs:137-139) attaches an authorization header ONLY when credential material was loaded — the reachability check is deliberately UNAUTHENTICATED, and the peer's honest 401 counts as reachability (TARGET_REACHED_NOT_AUTH_OR_INFERENCE, native-model-connection.mjs:105), never as authentication or inference. So exactly the two reachability GETs (first in each phase trio) travel credential-free on BOTH sides of the rotation, while exactly the four authenticated checks present the original, then the rotated bearer — the ordered vector below is the whole wire truth, with no tolerance and no credential leak.
  for(const label of['Erreichbarkeit','Authentifizierung','Modellverfügbarkeit']){await f.page.locator(connection).getByRole('button',{name:label+' separat prüfen',exact:true}).click();await f.page.locator(connection+'[data-state=\"CURRENT_CONNECTION\"]').waitFor();await f.flushResponses();}
  const rechecked=connectionReadbacks548(f).at(-1).value;
  for(const phase of['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY'])assert.equal(rechecked.checks[phase].state,'PASS','PAN548_RUN109 the prerequisite recheck did not genuinely pass on the rotated credential: '+phase);
  assert.equal(rechecked.checks.REACHABILITY.reason,'TARGET_REACHED_NOT_AUTH_OR_INFERENCE','PAN548_RUN109 the passing reachability recheck claimed authentication instead of honest unauthenticated reachability');
  const getObservations=f.observations.filter(o=>o.method==='GET');
  assert.equal(getObservations.length,6,'PAN548_RUN109 unexpected provider GET traffic:'+JSON.stringify(getObservations.map(o=>[o.credentialPresent,o.credentialDigest])));
  // Exact ordered credential vector over the six provider GETs (click order, serialized by the backend's phase-order guard): reachability unauthenticated (peer 401, correctly accepted as reachability), authentication and model availability ONLY ever carrying the exact original, then the exact rotated bearer.
  assert.deepEqual(getObservations.map(o=>({credentialPresent:o.credentialPresent,credentialDigest:o.credentialDigest})),[{credentialPresent:false,credentialDigest:null},{credentialPresent:true,credentialDigest:hash(syntheticCredential565)},{credentialPresent:true,credentialDigest:hash(syntheticCredential565)},{credentialPresent:false,credentialDigest:null},{credentialPresent:true,credentialDigest:hash(rotatedV1)},{credentialPresent:true,credentialDigest:hash(rotatedV1)}],'PAN548_RUN109 the phase-ordered credential vector on the wire drifted from credential-free reachability with original-then-rotated authenticated checks');
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'PLAN_DENIED','PAN548_RUN109 the prerequisite rechecks revived a cached offer');
  // Only now the fresh explicit plan plus the SEPARATE manual unchecked consent; the SAME initially unspent grant carries the one real two-POST run to RESULT_READY.
  const fresh=await boundPlan(f);
  assert.notEqual(fresh.planHandle,p.planHandle,'PAN548_RUN109 the recovery republished the old plan');
  assert.notEqual(fresh.runId,p.runId,'PAN548_RUN109 the recovery republished the old run');
  assert.equal(await consent.isChecked(),false,'PAN548_RUN109 the fresh offer auto-consented');
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'false','PAN548_RUN109 the fresh offer was actionable without the separate manual consent');
  await consent.check();
  assert.equal(await f.page.locator(root).getAttribute('data-dispatch-available'),'true','PAN548_RUN109 the separate manual consent did not enable exactly one start');
  await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await state(f,'RESULT_READY');await f.flushResponses();
  const result=f.responses.filter(r=>r.path.endsWith('/agent-run/start')&&r.status===200).at(-1).value;
  assert.equal(result.phase,'RESULT_READY','PAN548_RUN109 the recovered run did not reach the genuine terminal');
  assert.equal(result.modelMode,'OWNER_BOUND_PROVIDER','PAN548_RUN109 the recovered run lost the real owner binding');
  assert.equal(result.realModelAcceptance,false,'PAN548_RUN109 the recovered run claimed real-model acceptance');
  assert.equal(result.budget.runtime.consumedUnits,2,'PAN548_RUN109 the recovered run did not settle its two observed requests');
  assert.equal(f.posts(),2,'PAN548_RUN109 the recovered run deviated from exactly the two genuine synthetic POSTs');
  assert.equal(count(f,'start'),1,'PAN548_RUN109 the journey started more than one task');
  const ledgerRows=nativeLedgerRows548(f);
  assert.equal(ledgerRows.length,1,'PAN548_RUN109 the same-grant journey left more than one native ledger operation');
  assert.equal(ledgerRows[0].state,'SETTLED','PAN548_RUN109 the recovered run did not settle in the persisted native ledger');
  assert.equal(ledgerRows[0].runtime_units,3,'PAN548_RUN109 the whole-run reservation did not cover the closed ceiling before dispatch');
  assert.equal(ledgerRows[0].runtime_consumed,2,'PAN548_RUN109 the observed consumption was refunded or reset on the ledger');
  const rowAfterRun=persistedConnectionRow548(f);
  assert.equal(rowAfterRun.state.identityDigest,identityPre,'PAN548_RUN109 the rotation changed the target identity itself (new identity invented?)');
  assert.equal(rowAfterRun.state.lastOperation,fresh.runId,'PAN548_RUN109 the recovered run did not persist its own operation');
  assert.equal(rowAfterRun.state.checks.INFERENCE.reason,'SYNTHETIC_TOOL_FEEDBACK_ONLY','PAN548_RUN109 the recovered run did not honestly disclose its synthetic tool feedback');
  // Persisted independent readback plus a real reload keep the truth (PUI-07-AC04), with no new traffic.
  await f.page.locator(root).getByRole('button',{name:'Laufstatus unabhängig nativ lesen',exact:true}).click();
  await state(f,'RESULT_READY');await f.flushResponses();
  const runRead=f.responses.filter(r=>r.method==='GET'&&r.path.endsWith('/agent-run/read')&&r.status===200).at(-1).value;
  assert.equal(runRead.runId,fresh.runId,'PAN548_RUN109 the independent read bound a different run');
  assert.equal(runRead.requestDigest,result.requestDigest,'PAN548_RUN109 the independent read drifted from the persisted request binding');
  await f.page.reload();await showCurrentContextDetailsUI(f.page);
  await f.page.locator('[id=\"shell.context-selection\"][data-module=\"pan.erv\"][data-state=\"CURRENT_CONTEXT\"]').waitFor();
  await state(f,'RESULT_READY');await showCurrentViewDetailsUI(f.page);await f.flushResponses();
  assert.equal(await f.page.locator(root).getAttribute('data-run'),fresh.runId,'PAN548_RUN109 the reload lost the persisted run truth');
  assert.equal(count(f,'start'),1,'PAN548_RUN109 the reload replayed the start');
  assert.equal(f.posts(),2,'PAN548_RUN109 the reload touched the provider');
  // RUN112 continuation seam: the recovered owner-bound RESULT_READY task must remain USEFUL through the EXISTING separate 546 view editor. The accepted 546 machinery (preview/CAS/read/Undo) was only ever proven on a non-rotated connected run (DUI09 baseline) or the plain fixture; on the rotated connection this leg proves: the reloaded recovered proposal needs the same fresh native selection before preview, the explicit before/after preview persists nothing, cancellation leaves the persistent target byte-unchanged, ONLY the separate deliberate confirmation CAS-saves, the independent persisted read and a real reload show the actual bounded personal-view change, and the existing Undo is again explicitly previewed, confirmed and read — while the view persistence never touches the connection row, the ledger or the provider (connection readiness is never view-persist permission and vice versa).
  const planRequestsAtEditorV112=count(f,'plan'),probePostsAtEditorV112=f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/model-connection/probe')).length;
  // RUN113 temporal-oracle correction: the no-mutation baseline of THIS seam is an INDEPENDENT persisted snapshot taken at the exact meaningful boundary — AFTER the recovered run fully wrote its own legitimate connection-row history (re-selection bump, three persisted prerequisite probe writes at native-model-connection.mjs:111, runFeedback start write at :161 and finally write at :170) and BEFORE the first editor action — never an earlier in-journey revision. Grounded against the accepted post-run assertions above: the independent run read and the reload are reads, so the boundary row must still equal the post-run row (revision and full state).
  const rowPostRunPreEditorV112=persistedConnectionRow548(f),ledgerPostRunPreEditorV112=nativeLedgerRows548(f);
  assert.equal(rowPostRunPreEditorV112.revision,rowAfterRun.revision,'PAN548_RUN113 the independent run read or the reload mutated the connection row before the editor leg began');
  assert.deepEqual(rowPostRunPreEditorV112.state,rowAfterRun.state,'PAN548_RUN113 the independent run read or the reload changed the persisted connection state before the editor leg began');
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).isDisabled(),true,'PAN548_RUN112 the reloaded recovered proposal was previewable without a fresh native selection');
  await selectConnectedView(f);await state(f,'RESULT_READY');
  await preview(f);assert.equal(f.readPersisted().revision,0,'PAN548_RUN112 the explicit before/after preview already persisted the recovered proposal');
  await connectedCapture(f,'desktop-run112-recovered-proposal-separate546-before-after');
  await f.page.locator(view).getByRole('button',{name:'Vorschau abbrechen — nichts speichern',exact:true}).click();
  await f.page.locator(view+'[data-state=\"LOCAL_DRAFT_DISCARDED\"]').waitFor();
  assert.equal(f.readPersisted().revision,0,'PAN548_RUN112 the explicit preview cancellation changed the persistent target');
  await preview(f);
  // RUN114 stale-confirmation seam on THIS connected rotated journey: a SECOND authenticated tab of the SAME existing session (context cookies are context-issued; per-tab context proofs stay independent) performs its own bounded view save WHILE the recovered proposal's before/after preview is still open in the first tab, then the deliberate first-tab confirmation must answer with the truthful revision conflict. Source-bound: the546 owner checks the persisted CAS revision under the reservation and denies BEFORE any write with VIEW_REVISION_CONFLICT (src/pan546/native-view-owner.mjs:52), the gateway maps exactly that class to409 (src/pan527/origin-session-adapter.mjs:1146), and the editor's persist() catch keeps the candidate in attemptedCandidates — deterministic409 denial means SAVE_DENIED with the draft preserved, never a blind replay (packages/browser-workspace/src/module-view-editor-v1.ts:75). The candidate registries are per TAB (native-view-owner.mjs:38), so the two previews genuinely race; browser-side conflict was proven before ONLY for the appearance store (tests/pan546/browser-view.test.mjs:163) and in the plain-fixture unit journey (tests/pan546/native-view.test.mjs:142,:160) — NEVER as a second-tab save racing an open AGENT-proposal preview on this rotated connected mount. Because the panel re-fences the proposal against the CURRENT frame revision (workspace-agent-panel-v1.ts:95), a deliberate save that moved the revision makes the SAME late proposal inactionable for good: no second preview, no resave, no invented re-qualification API. The second tab saves 'compact' (different from the proposal's 'large'), so loser-bleed, blind-overwrite and UNKNOWN-confusion are all mutually distinguishable at the persisted truth. This is the SAME view-store CAS machinery already accepted at revision 0→1 (browser-view.test.mjs DUI-01): the second tab rides no NEW save path; only the first tab's late proposal save becomes the conflict leg, and the accepted Undo leg below now runs against the winner's revision 1: its preview restores the persisted revision-0 snapshot and its separate confirmation CAS-appends history on top of the winner, so the accepted undo assertions keep their exact meaning while the proposal itself stays honestly unresaved.
  // RUN115 async-lifetime correction (RUN114 unhandledRejection 'Target page, context or browser closed' here): context.newPage() returns a Promise, so it IS awaited (accepted precedent tests/pan546/browser-view.test.mjs:161). RUN116 factual correction: setDefaultTimeout/setDefaultNavigationTimeout are SYNCHRONOUS void setters, not Promises — the accepted546 fixture calls them exactly this way, unawaited, at tests/pan546/browser-fixture.mjs:39; nothing here awaits them. What keeps a later fixture close from rejecting an outstanding lifecycle Promise is the awaited newPage plus the owned second?.close() in the journey's finally, which swallows close errors so cleanup can never mask the primary failure.
  second=await f.context.newPage();second.setDefaultTimeout(10000);second.setDefaultNavigationTimeout(15000);
  const secondErrors=[],secondConfirms=[],secondBinds=[];let secondPreview=null;
  second.on('pageerror',e=>secondErrors.push(e.message));
  second.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname.endsWith('/workspace/module-view/confirm'))secondConfirms.push(r.postDataJSON());});
  second.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/t/tenant-a/workspace/context-selection')secondBinds.push(r.postDataJSON());});
  second.on('response',r=>{if(r.status()===200&&new URL(r.url()).pathname.endsWith('/workspace/module-view/preview'))r.json().then(v=>{secondPreview=v;}).catch(()=>{});});
  // RUN116 target-context correction (RUN115 timeout waiting for the second tab's pan.erv CURRENT_CONTEXT): a bare /t/tenant-a/workspace load routes from location.hash||default (app.ts:36,:219,:221), i.e. the pan.setup default context; only the first tab's accepted ordinary navigation (open(f):42) and hash-retaining reload reach pan.erv. The second tab therefore rides the SAME existing ordinary navigation button — no hand-copied first-tab deep-link hash, no new API: the button's click builds the deep link from the SECOND tab's own freshly bootstrapped context (tab-scoped owner: context-selection-v1.ts:265-292 → native-context-selection.mjs:92,:100,:104), so the target module, its server-confirmed CURRENT_CONTEXT and the tab's independent selection proof are all its own.
  await second.goto(f.tls.origin+'/t/tenant-a/workspace');await showCurrentContextDetailsUI(second);
  await second.locator('[id=\"shell.context-selection\"][data-module=\"pan.setup\"][data-state=\"CURRENT_CONTEXT\"]').waitFor();
  await second.getByRole('button',{name:'Eingangsrechnungsprüfung — nur lesen',exact:true}).click();
  await showCurrentViewDetailsUI(second);
  await second.locator('[id=\"shell.context-selection\"][data-module=\"pan.erv\"][data-state=\"CURRENT_CONTEXT\"]').waitFor();
  await second.locator(view+'[data-state=\"CURRENT_NATIVE_VIEW\"]').waitFor();
  // Wire-level independence proof, not just the per-page DOM: module entry binds context ONLY through the tab-scoped owner, so the second tab must own exactly one server-confirmed pan.erv bind carrying its OWN freshly bootstrapped tab id, distinct from the first tab's current pan.erv selection (the candidate store is likewise per sessionId+tabId, native-view-owner.mjs:38 — the two previews genuinely race as independent tabs).
  const secondPanErvBindsV116=secondBinds.filter(b=>b.moduleId==='pan.erv');
  assert.equal(secondPanErvBindsV116.length,1,'PAN548_RUN116 the second tab did not issue exactly one own pan.erv context-selection bind through the existing navigation:'+JSON.stringify(secondBinds.map(b=>b.moduleId)));
  const firstTabPanErvSelectionV116=f.requests.filter(r=>r.method==='POST'&&r.path==='/t/tenant-a/workspace/context-selection'&&r.body?.moduleId==='pan.erv').at(-1);
  assert.ok(firstTabPanErvSelectionV116&&/^tab:[a-f0-9]{32}$/.test(secondPanErvBindsV116[0].tabId)&&secondPanErvBindsV116[0].tabId!==firstTabPanErvSelectionV116.body.tabId,'PAN548_RUN116 the second tab pan.erv context was not bound under its own independent freshly bootstrapped tab proof');
  assert.equal(await second.locator(view).getAttribute('data-revision'),'0','PAN548_RUN114 the second authenticated tab did not independently read the same pre-conflict persisted revision');
  await second.locator(view).getByRole('button',{name:'View bearbeiten',exact:true}).click();
  await second.locator('#pan546-instance-size').selectOption('compact');
  await second.locator(view).getByRole('button',{name:'Vorher/Nachher prüfen',exact:true}).click();
  await second.locator(view+'[data-state=\"PREVIEW_ONLY\"]').waitFor();
  assert.ok(secondPreview&&secondPreview.expectedRevision===0&&secondPreview.previewOnly===true&&secondPreview.persistenceProduced===false,'PAN548_RUN114 the second tab preview was not an honest revision-0 no-write preview:'+JSON.stringify(secondPreview));
  await second.locator(view).getByRole('button',{name:'Genau diese persönliche View bestätigen und speichern',exact:true}).click();
  await second.locator(view+'[data-state=\"SAVED_AND_NATIVE_READBACK_CONFIRMED\"]').waitFor();
  assert.equal(secondConfirms.length,1,'PAN548_RUN114 the second tab persisted more than one bounded view save');
  const winnerV114=f.readPersisted();
  assert.equal(winnerV114.revision,1,'PAN548_RUN114 the separate deliberate confirmation by the second tab did not persist exactly one CAS save');
  assert.equal(winnerV114.view.instances.find(i=>i.instanceId==='invoice-value').size,'compact','PAN548_RUN114 the persisted winner is not the bounded save of the second tab');
  assert.equal(winnerV114.confirmedCandidateDigest,secondPreview.candidateDigest,'PAN548_RUN114 the persisted winner is not bound to the previewed candidate of the second tab');
  assert.equal(winnerV114.viewDigest,secondPreview.afterDigest,'PAN548_RUN114 the persisted winner digest drifted from the afterDigest of the second tab preview');
  // The open first-tab preview is NOT silently replaced or overwritten by the other tab's save — it stays the honest before/after PREVIEW_ONLY, still bound to revision 0.
  assert.equal(await f.page.locator(view).getAttribute('data-state'),'PREVIEW_ONLY','PAN548_RUN114 the second tab save silently replaced the open first-tab proposal preview');
  assert.equal(await f.page.locator(view).getAttribute('data-revision'),'0','PAN548_RUN114 the open first-tab preview silently re-based away from the pre-conflict revision');
  // RUN117 authority-chain correction (RUN116 grounded the REAL first-tab SAVE_DENIED with conflictObserved null — not a timing artifact, not a product defect, not a missed observer event): the deliberate stale first-tab confirmation never reaches the owner's CAS, and that IS the genuine functional authority path. Every moduleViewRequest verifies its own tab's context snapshot BEFORE any confirm byte is dispatched (packages/browser-workspace/src/context-selection-v1.ts:222; the helper throws on non-200 at :66). The server's verify recomputes the tab state, whose viewRevision includes the personal view store's revision (src/pan548/native-context-selection.mjs:108,:90) — the second tab's winner CAS moved the persisted revision 0→1, so the first tab's revision-0 context snapshot is genuinely stale: the context layer denies the preflight exactly with CONTEXT_REVISION_STALE, which the gateway maps to 409 (src/pan527/origin-session-adapter.mjs:1167), moduleViewRequest returns the closed outcome MODULE_VIEW_DENIED before any write dispatch (context-selection-v1.ts:242), and the editor's persist() catch renders precisely that as SAVE_DENIED with the draft preserved (packages/browser-workspace/src/module-view-editor-v1.ts:75). The owner's own CAS denial VIEW_REVISION_CONFLICT (src/pan546/native-view-owner.mjs:52) still guards every confirmation that passes the context layer — here it is never reached, which is the strongest no-blind-write form: ZERO confirm bytes leave the first tab. So capture the real replies on BOTH candidate wire stages, pass them through unmodified, and assert the exact closed denial plus the first tab's own context binding — no arbitrary error-set widening, no CAS bypass.
  const cdpConflict=await f.context.newCDPSession(f.page);const conflictWireV117=[];
  try{
   await cdpConflict.send('Fetch.enable',{patterns:[{urlPattern:f.tls.origin+'*/workspace/context-selection/verify',requestStage:'Response'},{urlPattern:f.tls.origin+'*/workspace/module-view/confirm',requestStage:'Response'}]});
   cdpConflict.on('Fetch.requestPaused',event=>{void(async()=>{try{const body=await cdpConflict.send('Fetch.getResponseBody',{requestId:event.requestId});let parsed=null;try{parsed=JSON.parse(Buffer.from(body.body,body.base64Encoded?'base64':'utf8').toString());}catch{}conflictWireV117.push({path:new URL(event.request.url).pathname,status:event.responseStatusCode,error:parsed&&typeof parsed.error==='string'?parsed.error:null});}finally{try{await cdpConflict.send('Fetch.continueResponse',{requestId:event.requestId});}catch{}}})();});
   await f.page.locator(view).getByRole('button',{name:'Genau diese persönliche View bestätigen und speichern',exact:true}).click();
   await f.page.locator(view+'[data-state=\"SAVE_DENIED\"]').waitFor();await f.flushResponses();
  }finally{await cdpConflict.send('Fetch.disable').catch(()=>{});await cdpConflict.detach().catch(()=>{});}
  assert.deepEqual(conflictWireV117,[{path:'/t/tenant-a/workspace/context-selection/verify',status:409,error:'CONTEXT_REVISION_STALE'}],'PAN548_RUN114 the stale final confirmation was not denied exactly once, at the context layer, by the persisted revision conflict on the wire:'+JSON.stringify(conflictWireV117));
  assert.equal(f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/workspace/module-view/confirm')).length,0,'PAN548_RUN114 the stale context denial still dispatched a first-tab confirm write');
  const deniedVerifyV117=f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/workspace/context-selection/verify')).at(-1);
  assert.ok(deniedVerifyV117&&deniedVerifyV117.body&&deniedVerifyV117.body.schemaVersion==='pansphaira.workspace-context/verify/v1'&&typeof deniedVerifyV117.body.contextHandle==='string'&&deniedVerifyV117.body.contextHandle.startsWith('context:'),'PAN548_RUN114 the denied context preflight carried no first-tab own context verification payload:'+JSON.stringify(deniedVerifyV117?.body??null));
  assert.equal(f.requests.at(-1),deniedVerifyV117,'PAN548_RUN114 a hidden request followed the truthful context-layer denial');
  assert.equal(secondConfirms[0].context.schemaVersion,'pansphaira.workspace-context/verify/v1','PAN548_RUN114 the winner CAS was not bound by the exact context verification schema');
  assert.ok(deniedVerifyV117.body.tabId===firstTabPanErvSelectionV116.body.tabId&&secondConfirms[0].context.tabId!==deniedVerifyV117.body.tabId,'PAN548_RUN114 the denied first-tab preflight or the winner CAS did not carry their own independent tab proofs');
  assert.ok(typeof secondConfirms[0].context.contextHandle==='string'&&secondConfirms[0].context.contextHandle!==deniedVerifyV117.body.contextHandle,'PAN548_RUN114 the second tab CAS reused the first tab context handle');
  const denialTextV114=await f.page.locator(view).innerText();
  assert.ok(denialTextV114.includes('Speichern verweigert; Entwurf erhalten. Kein Retry'),'PAN548_RUN114 the conflict denial does not tell the truth:'+denialTextV114);
  // No blind retry: the attempted candidate is never offered again, and a forced dispatch on the retained disabled control creates no second write.
  const conflictConfirmV114=f.page.locator(view).getByRole('button',{name:'Genau diese persönliche View bestätigen und speichern',exact:true});
  assert.equal(await conflictConfirmV114.isDisabled(),true,'PAN548_RUN114 the denied stale candidate was offered again for a blind retry');
  const requestsAtReplayV117=f.requests.length;
  await conflictConfirmV114.evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));await f.flushResponses();
  assert.equal(f.requests.length,requestsAtReplayV117,'PAN548_RUN114 the forced click replayed the denied confirmation');
  assert.equal(await f.page.locator(view).getAttribute('data-state'),'SAVE_DENIED','PAN548_RUN114 the forced replay changed the honest denial state');
  // The winner stays untouched by the loser: the independent persisted read still shows exactly the second tab's bounded save — no large-bleed of the denied proposal, no lost update.
  const afterDeniedV114=f.readPersisted();
  assert.equal(afterDeniedV114.revision,1,'PAN548_RUN114 the denied stale confirmation still mutated the persisted revision');
  assert.equal(afterDeniedV114.view.instances.find(i=>i.instanceId==='invoice-value').size,'compact','PAN548_RUN114 the denied stale confirmation overwrote the real winner');
  assert.equal(afterDeniedV114.viewDigest,winnerV114.viewDigest,'PAN548_RUN114 the denied stale confirmation drifted the winner digest');
  // Safe re-qualification rides ONLY the existing owner path: 'Neu lesen — Entwurf behalten' re-reads natively with the draft preserved (module-view-editor-v1.ts reloadCurrent), then the explicit cancellation discards the local draft; only the persisted winner renders.
  await f.page.locator(view).getByRole('button',{name:'Neu lesen — Entwurf behalten',exact:true}).click();
  await f.page.locator(view+'[data-state=\"CURRENT_NATIVE_VIEW\"]').waitFor();await f.flushResponses();
  assert.equal(await f.page.locator(view).getAttribute('data-revision'),'1','PAN548_RUN114 the explicit re-read did not surface the winner revision');
  assert.equal(await f.page.locator(view).getAttribute('data-editing'),'true','PAN548_RUN114 the explicit re-read silently dropped the local draft');
  await f.page.locator(view).getByRole('button',{name:'Vorschau abbrechen — nichts speichern',exact:true}).click();
  await f.page.locator(view+'[data-state=\"LOCAL_DRAFT_DISCARDED\"]').waitFor();
  assert.equal(await f.page.locator(view+' [data-instance=\"invoice-value\"]').getAttribute('data-size'),'compact','PAN548_RUN114 after draft discard the first tab does not render the persisted winner');
  // The late proposal is honestly inactionable forever: the panel re-fences it against the CURRENT frame (expectedRevision 0 vs frame revision 1), so the SAME unsaved proposal never gets a second preview or resave on this mount.
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).isDisabled(),true,'PAN548_RUN114 the stale proposal stayed previewable after a deliberate save moved the revision');
  assert.equal(await second.locator(view).getAttribute('data-revision'),'1','PAN548_RUN114 the independent readback on the second tab after its own CAS did not confirm the winner revision; the cross-tab truth is the shared persisted view revision, not the per-page local context counter in app.ts');
  assert.deepEqual(secondErrors,[],'PAN548_RUN114 the second tab produced page errors');
  assert.equal(f.readPersisted().revision,1,'PAN548_RUN114 more than the winner plus the denied stale confirmation persisted during the conflict leg');
  await second.close();
  await showCurrentViewDetailsUI(f.page);await f.page.locator(view).getByRole('button',{name:'Letzten gespeicherten Viewstand zurückholen',exact:true}).click();
  await f.page.locator(view+'[data-state=\"PREVIEW_ONLY\"]').waitFor();
  assert.equal(f.readPersisted().revision,1,'PAN548_RUN112 the undo preview already rewrote the persisted view');
  await confirm(f);
  const undoneViewV112=f.readPersisted();
  assert.equal(undoneViewV112.revision,2,'PAN548_RUN112 the confirmed undo did not persist exactly one further CAS save');
  assert.equal(undoneViewV112.view.instances.find(i=>i.instanceId==='invoice-value').size,'regular','PAN548_RUN112 the confirmed undo did not restore the original bounded view');
  await state(f,'RESULT_READY');
  assert.equal(await f.page.locator(root).getAttribute('data-run'),fresh.runId,'PAN548_RUN112 the editor continuation disturbed the recovered run projection');
  await f.page.reload();await showCurrentContextDetailsUI(f.page);
  await f.page.locator('[id=\"shell.context-selection\"][data-module=\"pan.erv\"][data-state=\"CURRENT_CONTEXT\"]').waitFor();
  await state(f,'RESULT_READY');await showCurrentViewDetailsUI(f.page);await f.page.locator(view+'[data-state=\"CURRENT_NATIVE_VIEW\"]').waitFor();await f.flushResponses();
  assert.equal(f.readPersisted().revision,2,'PAN548_RUN112 the reload lost the two explicitly confirmed bounded view saves');
  assert.equal(await f.page.locator(view+' [data-instance=\"invoice-value\"]').getAttribute('data-size'),'regular','PAN548_RUN112 the reload did not render the confirmed undo');
  assert.equal(count(f,'start'),1,'PAN548_RUN112 the editor-continuation reload replayed the recovered start');
  // Coherence negatives of THIS seam: the whole editor continuation rides ONLY the existing 546 gateway — no hidden inference or replan, no added provider GETs, no new connection probe, no connection-row or ledger mutation, no business effect.
  assert.equal(f.posts(),2,'PAN548_RUN112 the separate 546 editor continuation touched the provider');
  assert.equal(f.observations.filter(o=>o.method==='GET').length,6,'PAN548_RUN112 the editor continuation added provider GET traffic');
  assert.equal(count(f,'plan'),planRequestsAtEditorV112,'PAN548_RUN112 the editor continuation issued a hidden replan');
  assert.equal(f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/model-connection/probe')).length,probePostsAtEditorV112,'PAN548_RUN112 the editor continuation issued a hidden connection probe');
  const rowAfterEditorV112=persistedConnectionRow548(f);
  assert.equal(rowAfterEditorV112.revision,rowPostRunPreEditorV112.revision,'PAN548_RUN113 the separate view persistence mutated the persisted connection revision against the independent post-run/pre-editor baseline');
  assert.deepEqual(rowAfterEditorV112.state,rowPostRunPreEditorV112.state,'PAN548_RUN113 the separate view persistence changed the persisted connection state (identity, grant, checks or operation binding) against the independent post-run/pre-editor baseline');
  assert.equal(rowAfterEditorV112.state.lastOperation,fresh.runId,'PAN548_RUN112 the separate view persistence displaced the recovered run operation binding');
  const ledgerAfterEditorV112=nativeLedgerRows548(f);
  assert.deepEqual(ledgerAfterEditorV112,ledgerPostRunPreEditorV112,'PAN548_RUN113 the editor continuation disturbed the persisted native ledger against the independent post-run/pre-editor baseline');
  assert.equal(ledgerAfterEditorV112.length,1,'PAN548_RUN112 the editor continuation added a native ledger operation');
  assert.equal(ledgerAfterEditorV112[0].state,'SETTLED','PAN548_RUN112 the editor continuation disturbed the settled ledger');
  assert.equal(ledgerAfterEditorV112[0].runtime_units,3,'PAN548_RUN112 the editor continuation refunded the closed reservation');
  assert.equal(ledgerAfterEditorV112[0].runtime_consumed,2,'PAN548_RUN112 the editor continuation reset the observed consumption');
  // Secret bytes never reach DOM/observations; the final rendering is the honest recovered state.
  const bodyText=await f.page.locator('body').innerText();
  assert.ok(!bodyText.includes(syntheticCredential565)&&!bodyText.includes(rotatedV1),'PAN548_RUN109 a synthetic credential reached the DOM');
  const observationText=JSON.stringify(f.observations);
  assert.ok(!observationText.includes(syntheticCredential565)&&!observationText.includes(rotatedV1),'PAN548_RUN109 credential bytes reached the peer observations (digests only allowed)');
  await connectedCapture(f,'desktop-run109-rotated-secret-recovered-two-post-run');
  // Session retirement discards the whole panel presentation (ownership lifetime unchanged throughout).
  await f.page.getByRole('button',{name:'Abmelden',exact:true}).click();
  await f.page.getByRole('heading',{name:'Abgemeldet',exact:true}).waitFor();
  assert.equal(await f.page.locator(root).count(),0,'PAN548_RUN109 the panel survived the logout');
  assert.equal(await f.page.locator(root+' [data-agent-connection-guidance=\"true\"]').count(),0,'PAN548_RUN109 a rotation guidance survived the logout');
  assert.equal(f.readPersisted().revision,2,'PAN548_RUN112 the journey persisted anything beyond the two explicitly confirmed bounded view CAS saves');
  assert.equal(f.business(),before,'PAN548_RUN109 the journey produced a business effect');
  assert.deepEqual(f.errors,[]);
 }finally{await second?.close().catch(()=>{});await cdp?.detach().catch(()=>{});await f.close();}
});
// RUN118: the genuinely missing connected criterion on this mount. Lost-confirm-reply reconciliation was
// accepted ONLY for MANUAL saves on the plain546 fixture (browser-view.test.mjs DUI-01, browser-navigation
// .test.mjs DUI05/AC03) and the accepted connected RUN112 journey only ever rode the REACHED-receipt path.
// Never proven here: the recovered AGENT proposal's ONE deliberate CONFIRM committing while only its REPLY
// is lost, the persisted exact candidate being independently true in the owner store WHILE the reply is
// still held, and the EXISTING reconcile control (module-view-editor-v1.ts:26,:74 — 'Unklaren Schreibausgang
// unabhängig zurücklesen') distinguishing the actually applied exact candidate from BOTH a foreign winner
// (revision/digest moved by another tab's own CAS) and an unconfirmed dropped write — each against the REAL
// owner SQLite read (fixture store.read — the same store the mounted546 owner writes), with zero automatic
// or forced replay (attemptedCandidates, module-view-editor-v1.ts:19,:36,:75) and the writeSent→UNKNOWN
// closed outcome (context-selection-v1.ts:230-242) as the only browser-side truth. No fake DTO, no fixture
// state injection, no new framework; every leg rides the existing product paths.
test('PUI07 RUN118 actual connected recovered agent proposal whose single deliberate CONFIRM genuinely commits while only its reply is lost: the exact candidate is already persisted while the reply is held, the lost reply leaves exactly the UNKNOWN hold with the unsent text and retained draft and zero automatic or forced replay, the EXISTING independent reconcile read rejects a later foreign winner instead of claiming success, and the same reconcile later confirms ONLY the exact applied candidate of a second genuinely lost undo write against the real owner SQLite read, while run/source/phase, the native565 connection row, the SETTLED ledger and provider traffic stay coherent; NOT LLM',async()=>{
 const f=await connectedFixture();let cdp,second;
 try{
  const before=f.business(),consent=f.page.locator('#pan548-agent-inference-consent');
  const confirmControl=()=>f.page.locator(view).getByRole('button',{name:'Genau diese persönliche View bestätigen und speichern',exact:true});
  const reconcileControl=()=>f.page.locator(view).getByRole('button',{name:'Unklaren Schreibausgang unabhängig zurücklesen',exact:true});
  const viewStatus=()=>f.page.locator(view+' [role="status"]').innerText();
  await open(f);await selectConnectedView(f);await connect(f);
  await boundPlan(f);
  const planBaseline=count(f,'plan'),probeBaseline=f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/model-connection/probe')).length;
  await consent.check();
  await f.page.locator(root).getByRole('button',{name:'Genau diesen gebundenen Lauf einmalig starten',exact:true}).click();
  await state(f,'RESULT_READY');await f.flushResponses();
  const result=f.responses.filter(r=>r.path.endsWith('/agent-run/start')&&r.status===200).at(-1).value;
  assert.equal(result.phase,'RESULT_READY');assert.equal(result.modelMode,'OWNER_BOUND_PROVIDER');assert.equal(result.realModelAcceptance,false);
  assert.ok(result.proposal&&result.proposal.expectedRevision===0&&result.proposal.persistenceProduced===false&&result.proposal.afterView.instances.some(i=>i.instanceId==='invoice-value'&&i.size==='large'),'PAN548_RUN118 the recovered run did not deliver the bounded non-persisted large-size proposal:'+JSON.stringify(result.proposal));
  assert.equal(count(f,'start'),1,'PAN548_RUN118 the journey started more than one task');
  assert.equal(f.posts(),2,'PAN548_RUN118 the synthetic run deviated from exactly the two genuine provider POSTs');
  const taskText=await f.page.locator('#pan548-agent-intent').inputValue();
  assert.notEqual(taskText,'','PAN548_RUN118 missing unsent task text');
  // RUN113-style temporal oracle: the no-mutation baseline is taken AFTER the run fully wrote its own
  // legitimate connection/ledger history and BEFORE the first editor action.
  const rowPostRunPreEditorV118=persistedConnectionRow548(f),ledgerPostRunPreEditorV118=nativeLedgerRows548(f);
  assert.equal(ledgerPostRunPreEditorV118.length,1);assert.equal(ledgerPostRunPreEditorV118[0].state,'SETTLED');
  assert.equal(ledgerPostRunPreEditorV118[0].runtime_units,3);assert.equal(ledgerPostRunPreEditorV118[0].runtime_consumed,2);
  assert.equal(rowPostRunPreEditorV118.state.lastOperation,result.runId,'PAN548_RUN118 the run did not persist its own operation binding');
  // Fresh native selection, then the proposal rides ONLY the existing panel→editor preview leg.
  await selectConnectedView(f);await state(f,'RESULT_READY');
  await preview(f);
  const agentPreview=f.responses.filter(r=>r.path.endsWith('/workspace/module-view/preview')&&r.status===200).at(-1).value;
  assert.ok(agentPreview&&agentPreview.expectedRevision===0&&agentPreview.previewOnly===true&&agentPreview.persistenceProduced===false,'PAN548_RUN118 the agent preview was not an honest revision-0 no-write preview:'+JSON.stringify(agentPreview));
  assert.equal(agentPreview.afterDigest,result.proposal.afterDigest,'PAN548_RUN118 the separate editor preview drifted from the proposal through the shared reducer');
  const firstTabPanErvBindV118=f.requests.filter(r=>r.method==='POST'&&r.path==='/t/tenant-a/workspace/context-selection'&&r.body?.moduleId==='pan.erv').at(-1);
  assert.equal(f.readPersisted().revision,0,'PAN548_RUN118 the agent preview already persisted the proposal');
  // LEG A — the ONE deliberate CONFIRM: intercepted at the actual REPLY stage, so the owner fully processed
  // and persisted the exact CAS before the reply is destroyed (lost AFTER the persisted effect, never a
  // skipped write). While the genuine reply is still held, the independent owner SQLite read already shows
  // the exact applied candidate — persistence precedes receipt; the held window itself is the delayed case.
  cdp=await f.context.newCDPSession(f.page);
  let heldReply,replySettledV118=false;const replyPaused=new Promise(r=>{heldReply=r;});
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:f.tls.origin+'*/workspace/module-view/confirm',requestStage:'Response'}]});
  cdp.on('Fetch.requestPaused',event=>{void(async()=>{if(!replySettledV118){replySettledV118=true;heldReply(event);}else await cdp.send('Fetch.continueResponse',{requestId:event.requestId}).catch(()=>{});})().catch(()=>{});});
  const requestsAtConfirmV118=f.requests.length;
  await confirmControl().click();
  await f.page.locator(view+'[data-state="CONFIRMING"]').waitFor();
  const racedConfirmV118=await Promise.race([replyPaused.then(event=>({event})),new Promise(r=>setTimeout(()=>r(null),4000))]);
  if(!racedConfirmV118)throw Error('PAN548_RUN118 the deliberate confirm was never dispatched on the wire');
  const pausedEvent=racedConfirmV118.event;
  assert.equal(pausedEvent.request.method,'POST');assert.ok(new URL(pausedEvent.request.url).pathname.endsWith('/workspace/module-view/confirm'),'PAN548_RUN118 the intercepted reply was not the confirm route');
  const confirmBodyV118=JSON.parse(pausedEvent.request.postData??'{}');
  assert.deepEqual([confirmBodyV118.schemaVersion,confirmBodyV118.candidateHandle,confirmBodyV118.candidateDigest,confirmBodyV118.confirmation],['pansphaira.workspace-module-view/confirm/v1',agentPreview.candidateHandle,agentPreview.candidateDigest,'CONFIRM_PERSONAL_VIEW'],'PAN548_RUN118 the dispatched confirm was not bound to the exact previewed agent candidate');
  assert.ok(confirmBodyV118.context?.schemaVersion==='pansphaira.workspace-context/verify/v1'&&confirmBodyV118.context.tabId===firstTabPanErvBindV118.body.tabId,'PAN548_RUN118 the confirm did not carry the first tab\u0027s own context verification');
  const receiptBytes=await cdp.send('Fetch.getResponseBody',{requestId:pausedEvent.requestId});
  const receiptV118=JSON.parse(Buffer.from(receiptBytes.body,receiptBytes.base64Encoded?'base64':'utf8').toString());
  assert.equal(pausedEvent.responseStatusCode,200);
  assert.deepEqual([receiptV118.outcome,receiptV118.kind,receiptV118.revision,receiptV118.viewDigest,receiptV118.confirmedCandidateDigest,receiptV118.personalViewPersistenceProduced,receiptV118.businessEffectProduced,receiptV118.executionAuthorityGranted,receiptV118.independentReadbackRequired],['VIEW_PERSISTED','DELTA',1,agentPreview.afterDigest,agentPreview.candidateDigest,true,false,false,true],'PAN548_RUN118 the genuine confirm reply was not the exact one-CAS personal-only receipt:'+JSON.stringify(receiptV118));
  // The persisted effect is independently TRUE while the reply is still in flight: real owner SQLite read.
  const persistedInFlightV118=f.readPersisted();
  assert.deepEqual([persistedInFlightV118.revision,persistedInFlightV118.viewDigest,persistedInFlightV118.confirmedCandidateDigest,persistedInFlightV118.view.instances.find(i=>i.instanceId==='invoice-value').size],[1,agentPreview.afterDigest,agentPreview.candidateDigest,'large'],'PAN548_RUN118 the persisted exact candidate drifted while the confirm reply was still held');
  // Held window: no timeout-driven auto-retry and no second dispatch while the reply is merely delayed.
  // RUN119 source-grounded wire accounting: the ACTUAL suffix after the deliberate click is exactly the
  // product's own mandated same-context verify preflight (context-selection-v1.ts:222 awaits
  // verify(captured.context) before ANY operation fetch at :231; verify POSTs
  // /t/tenant-a/workspace/context-selection/verify with the first tab's captured tabId/contextHandle at
  // :89-92) followed by exactly ONE confirm dispatch — and nothing else. CONFIRM is writeSent
  // (context-selection-v1.ts:230), so the success-path re-verify at :239 is source-excluded while the
  // reply is held. A bare total delta (+1) wrongly counted this legitimate preflight as a second
  // dispatch; the exact ordered suffix keeps the once-only confirm, exact candidate binding and
  // zero-hidden-traffic fences strictly stronger, not looser.
  const forcedDuringHold=await confirmControl().evaluate(e=>{e.dispatchEvent(new MouseEvent('click',{bubbles:true}));return e.disabled;});
  assert.equal(forcedDuringHold,true,'PAN548_RUN118 the confirm stayed enabled during the in-flight hold');
  const heldWindowSuffixV118=f.requests.slice(requestsAtConfirmV118);
  assert.deepEqual(heldWindowSuffixV118.map(r=>[r.method,r.path]),[['POST','/t/tenant-a/workspace/context-selection/verify'],['POST','/t/tenant-a/workspace/module-view/confirm']],'PAN548_RUN118 the held-reply window is not exactly the source-mandated context-verify preflight followed by exactly one confirm dispatch with zero hidden traffic:'+JSON.stringify(heldWindowSuffixV118.map(r=>[r.method,r.path])));
  assert.deepEqual([heldWindowSuffixV118[0].body?.schemaVersion,heldWindowSuffixV118[0].body?.tabId,heldWindowSuffixV118[0].body?.contextHandle],['pansphaira.workspace-context/verify/v1',firstTabPanErvBindV118.body.tabId,confirmBodyV118.context.contextHandle],'PAN548_RUN118 the confirm preflight was not the first tab\u0027s own captured-context verification bound to the same context the confirm carried');
  await cdp.send('Fetch.failRequest',{requestId:pausedEvent.requestId,errorReason:'ConnectionClosed'});
  await f.page.locator(view+'[data-state=\"WRITE_OUTCOME_UNCONFIRMED\"]').waitFor();await f.flushResponses();
  await cdp.send('Fetch.disable');await cdp.detach().catch(()=>{});cdp=undefined;
  // The honest UNKNOWN hold: truthful text, draft and unsent text preserved, reconciliation offered, the
  // attempted candidate never offered again, and the denied-route probe proves no hidden follow-up.
  assert.match(await viewStatus(),/Schreibausgang unklar; Entwurf erhalten\. Kein Save-\/Undo-Retry\. Ziel unabhängig nativ lesen\./,'PAN548_RUN118 the UNKNOWN hold does not tell the truth (module-view-editor-v1.ts:35 literal)');
  assert.equal(await f.page.locator(view).getAttribute('data-editing'),'true','PAN548_RUN118 the UNKNOWN hold lost the local draft');
  assert.equal(await f.page.locator(view+' .module-view-comparison').isVisible(),true,'PAN548_RUN118 the UNKNOWN hold discarded the retained before/after comparison');
  // RUN119: the disclosure id literally contains a dot (module-view-editor-v1.ts:11), so a CSS
  // '#workspace.module-editor-details' parses as id=workspace + class=module-editor-details and matches
  // nothing. Exact-ID attribute binding, the same selector the fixture and every accepted leg use.
  assert.equal(await f.page.locator('[id=\"workspace.module-editor-details\"]').getAttribute('open')!==null,true,'PAN548_RUN118 the UNKNOWN hold did not disclose the unconfirmed state');
  assert.equal(await reconcileControl().isVisible(),true,'PAN548_RUN118 the existing independent reconcile control was not offered');
  assert.equal(await reconcileControl().isEnabled(),true,'PAN548_RUN118 the reconcile control was not operable');
  assert.equal(await confirmControl().isDisabled(),true,'PAN548_RUN118 the attempted candidate was offered again for a blind retry');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN118 the lost reply lost the unsent task text');
  assert.equal(count(f,'start'),1,'PAN548_RUN118 the lost reply restarted the task');
  assert.equal(f.posts(),2,'PAN548_RUN118 the lost reply touched the provider');
  assert.equal(f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/workspace/module-view/confirm')).length,1,'PAN548_RUN118 more than one confirm left the first tab');
  assert.equal(f.requests.at(-1).path,'/t/tenant-a/workspace/module-view/confirm','PAN548_RUN118 a hidden request followed the lost confirm');
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'RESULT_READY','PAN548_RUN118 the UNKNOWN hold disturbed the run projection');
  assert.equal(await f.page.locator(root).getAttribute('data-run'),result.runId,'PAN548_RUN118 the UNKNOWN hold lost the run binding');
  await connectedCapture(f,'desktop-run118-agent-confirm-reply-lost-unknown');
  // LEG B — a foreign winner: a SECOND authenticated tab of the same session performs its own bounded
  // preview plus separate deliberate confirmation (CAS 1→2 compact) through its OWN freshly bootstrapped
  // tab context (accepted RUN116 lifecycle precedent). The first tab must stay quiescent: no push channel,
  // no hidden refresh, its UNKNOWN hold untouched.
  const requestsAtForeignV118=f.requests.length;
  second=await f.context.newPage();second.setDefaultTimeout(10000);second.setDefaultNavigationTimeout(15000);
  const secondErrorsV118=[],secondConfirmsV118=[],secondBindsV118=[];let secondPreviewV118=null;
  second.on('pageerror',e=>secondErrorsV118.push(e.message));
  second.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname.endsWith('/workspace/module-view/confirm'))secondConfirmsV118.push(r.postDataJSON());});
  second.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/t/tenant-a/workspace/context-selection')secondBindsV118.push(r.postDataJSON());});
  second.on('response',r=>{if(r.status()===200&&new URL(r.url()).pathname.endsWith('/workspace/module-view/preview'))r.json().then(v=>{secondPreviewV118=v;}).catch(()=>{});});
  await second.goto(f.tls.origin+'/t/tenant-a/workspace');await showCurrentContextDetailsUI(second);
  await second.locator('[id=\"shell.context-selection\"][data-module=\"pan.setup\"][data-state=\"CURRENT_CONTEXT\"]').waitFor();
  await second.getByRole('button',{name:'Eingangsrechnungsprüfung — nur lesen',exact:true}).click();
  await showCurrentViewDetailsUI(second);
  await second.locator('[id=\"shell.context-selection\"][data-module=\"pan.erv\"][data-state=\"CURRENT_CONTEXT\"]').waitFor();
  await second.locator(view+'[data-state=\"CURRENT_NATIVE_VIEW\"]').waitFor();
  const secondPanErvBindsV118=secondBindsV118.filter(b=>b.moduleId==='pan.erv');
  assert.equal(secondPanErvBindsV118.length,1,'PAN548_RUN118 the second tab did not bind pan.erv exactly once through the existing navigation');
  assert.ok(/^tab:[a-f0-9]{32}$/.test(secondPanErvBindsV118[0].tabId)&&secondPanErvBindsV118[0].tabId!==firstTabPanErvBindV118.body.tabId,'PAN548_RUN118 the foreign winner tab was not its own independent tab proof');
  // Independent second-tab native read of the FIRST tab's persisted effect: revision 1, exactly the agent
  // candidate rendered — the applied truth does not depend on the first tab's lost receipt.
  assert.equal(await second.locator(view).getAttribute('data-revision'),'1','PAN548_RUN118 the foreign tab did not independently read the applied revision');
  assert.equal(await second.locator(view+' [data-instance=\"invoice-value\"]').getAttribute('data-size'),'large','PAN548_RUN118 the independently read persisted view is not the exact agent candidate');
  await second.locator(view).getByRole('button',{name:'View bearbeiten',exact:true}).click();
  await second.locator('#pan546-instance-size').selectOption('compact');
  await second.locator(view).getByRole('button',{name:'Vorher/Nachher prüfen',exact:true}).click();
  await second.locator(view+'[data-state=\"PREVIEW_ONLY\"]').waitFor();
  assert.ok(secondPreviewV118&&secondPreviewV118.expectedRevision===1&&secondPreviewV118.previewOnly===true&&secondPreviewV118.persistenceProduced===false,'PAN548_RUN118 the foreign winner preview was not an honest revision-1 no-write preview:'+JSON.stringify(secondPreviewV118));
  await second.locator(view).getByRole('button',{name:'Genau diese persönliche View bestätigen und speichern',exact:true}).click();
  await second.locator(view+'[data-state=\"SAVED_AND_NATIVE_READBACK_CONFIRMED\"]').waitFor();
  assert.equal(secondConfirmsV118.length,1,'PAN548_RUN118 the foreign tab persisted more than one bounded save');
  const winnerV118=f.readPersisted();
  assert.deepEqual([winnerV118.revision,winnerV118.viewDigest,winnerV118.confirmedCandidateDigest,winnerV118.view.instances.find(i=>i.instanceId==='invoice-value').size],[2,secondPreviewV118.afterDigest,secondPreviewV118.candidateDigest,'compact'],'PAN548_RUN118 the persisted foreign winner drifted from its own previewed candidate');
  assert.ok(secondConfirmsV118[0].context.contextHandle!==confirmBodyV118.context.contextHandle,'PAN548_RUN118 the foreign winner reused the first tab context handle');
  assert.equal(await f.page.locator(view).getAttribute('data-state'),'WRITE_OUTCOME_UNCONFIRMED','PAN548_RUN118 the foreign winner silently resolved the first tab\u0027s UNKNOWN hold');
  assert.equal(await f.page.locator(view).getAttribute('data-revision'),'0','PAN548_RUN118 the UNKNOWN tab silently re-based on the foreign winner');
  assert.equal(f.requests.length,requestsAtForeignV118,'PAN548_RUN118 the UNKNOWN tab issued hidden traffic during the foreign winner leg');
  // LEG C — negative arm of the EXISTING reconcile: reading the CURRENT persisted truth natively must NOT
  // pass off the foreign winner as the first tab's own confirmation. readback() refreshes the context,
  // re-reads (module-view-editor-v1.ts:74) and the exact-candidate check denies with
  // NATIVE_TARGET_NOT_CONFIRMED → the truthful UNKNOWN hold stands with the fresh revision rendered.
  const dataPostsBeforeRejectV118=f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/workspace/module-view/data')).length;
  await reconcileControl().click();
  {const deadline=Date.now()+5000;while(f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/workspace/module-view/data')).length<=dataPostsBeforeRejectV118&&Date.now()<deadline)await new Promise(r=>setTimeout(r,25));}
  await f.flushResponses();await new Promise(r=>setTimeout(r,150));
  assert.equal(await f.page.locator(view).getAttribute('data-state'),'WRITE_OUTCOME_UNCONFIRMED','PAN548_RUN118 the independent reconcile passed a foreign winner off as the own confirmation');
  assert.equal(await f.page.locator(view).getAttribute('data-revision'),'2','PAN548_RUN118 the reconcile did not re-read the current persisted revision natively');
  assert.equal(await f.page.locator(view).getAttribute('data-editing'),'false','PAN548_RUN118 the reconcile kept presenting the superseded local draft as current');
  assert.equal(await f.page.locator(view+' [data-instance=\"invoice-value\"]').getAttribute('data-size'),'compact','PAN548_RUN118 the reconcile did not render the actual persisted foreign winner');
  assert.equal(await reconcileControl().isVisible(),true,'PAN548_RUN118 the rejected UNKNOWN lost its reconciliation control');
  assert.equal(await confirmControl().isDisabled(),true,'PAN548_RUN118 the rejected candidate was offered for a blind retry');
  const requestsAtRejectedReplayV118=f.requests.length;
  await confirmControl().evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await new Promise(r=>setTimeout(r,150));await f.flushResponses();
  assert.equal(f.requests.length,requestsAtRejectedReplayV118,'PAN548_RUN118 the forced click replayed the unconfirmed write');
  assert.equal(await f.page.locator(view).getAttribute('data-state'),'WRITE_OUTCOME_UNCONFIRMED','PAN548_RUN118 the forced replay changed the honest UNKNOWN state');
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),taskText,'PAN548_RUN118 the rejected reconcile lost the unsent task text');
  assert.equal(f.readPersisted().revision,2,'PAN548_RUN118 the rejected reconcile persisted anything');
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'RESULT_READY','PAN548_RUN118 the rejected reconcile disturbed the run projection');
  await connectedCapture(f,'desktop-run118-foreign-winner-rejected-unknown');
  await second.close();second=undefined;
  // Real reload: the whole hold is a presentation state over the SAME persisted truth — revision 2 renders,
  // the run stays, nothing replays, and the applied-then-superseded proposal is honestly inactionable.
  await f.page.reload();await showCurrentContextDetailsUI(f.page);
  await f.page.locator('[id=\"shell.context-selection\"][data-module=\"pan.erv\"][data-state=\"CURRENT_CONTEXT\"]').waitFor();
  await state(f,'RESULT_READY');await showCurrentViewDetailsUI(f.page);
  await f.page.locator(view+'[data-state=\"CURRENT_NATIVE_VIEW\"]').waitFor();await f.flushResponses();
  assert.equal(await f.page.locator(view).getAttribute('data-revision'),'2','PAN548_RUN118 the reload lost the two confirmed bounded saves');
  assert.equal(await f.page.locator(view+' [data-instance=\"invoice-value\"]').getAttribute('data-size'),'compact','PAN548_RUN118 the reload did not render the foreign winner');
  assert.equal(await f.page.locator(root).getAttribute('data-run'),result.runId,'PAN548_RUN118 the reload lost the run truth');
  assert.equal(count(f,'start'),1,'PAN548_RUN118 the reload replayed the start');
  assert.equal(f.posts(),2,'PAN548_RUN118 the reload touched the provider');
  assert.equal(await f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true}).isDisabled(),true,'PAN548_RUN118 the applied-then-superseded proposal stayed previewable against the moved revision');
  // LEG D — a SECOND genuinely lost write for the POSITIVE arm: the existing Undo previews revision 1,
  // the deliberate confirmation commits CAS 2→3 and ONLY its reply is lost at the Response stage again.
  await f.page.locator(view).getByRole('button',{name:'Letzten gespeicherten Viewstand zurückholen',exact:true}).click();
  await f.page.locator(view+'[data-state=\"PREVIEW_ONLY\"]').waitFor();
  const undoPreview=f.responses.filter(r=>r.path.endsWith('/workspace/module-view/undo-preview')&&r.status===200).at(-1).value;
  assert.ok(undoPreview&&undoPreview.kind==='UNDO'&&undoPreview.expectedRevision===2&&undoPreview.previewOnly===true,'PAN548_RUN118 the undo preview was not an honest revision-2 UNDO preview:'+JSON.stringify(undoPreview));
  assert.equal(f.readPersisted().revision,2,'PAN548_RUN118 the undo preview already persisted');
  const cdpUndo=await f.context.newCDPSession(f.page);
  try{
   await cdpUndo.send('Fetch.enable',{patterns:[{urlPattern:f.tls.origin+'*/workspace/module-view/confirm',requestStage:'Response'}]});
   let heldUndo;const undoPaused=new Promise(r=>{heldUndo=r;});let undoSettled=false;
   cdpUndo.on('Fetch.requestPaused',event=>{void(async()=>{if(!undoSettled){undoSettled=true;heldUndo(event);}else await cdpUndo.send('Fetch.continueResponse',{requestId:event.requestId}).catch(()=>{});})().catch(()=>{});});
   await confirmControl().click();
   const racedUndoV118=await Promise.race([undoPaused.then(event=>({event})),new Promise(r=>setTimeout(()=>r(null),4000))]);
   if(!racedUndoV118)throw Error('PAN548_RUN118 the undo confirm was never dispatched on the wire');
   const undoEvent=racedUndoV118.event;
   const undoReceiptBytes=await cdpUndo.send('Fetch.getResponseBody',{requestId:undoEvent.requestId});
   const undoReceipt=JSON.parse(Buffer.from(undoReceiptBytes.body,undoReceiptBytes.base64Encoded?'base64':'utf8').toString());
   assert.equal(undoEvent.responseStatusCode,200);
   assert.deepEqual([undoReceipt.outcome,undoReceipt.kind,undoReceipt.revision,undoReceipt.viewDigest,undoReceipt.confirmedCandidateDigest],['VIEW_PERSISTED','UNDO',3,undoPreview.afterDigest,undoPreview.candidateDigest],'PAN548_RUN118 the undo reply was not the exact persisted UNDO receipt before being destroyed:'+JSON.stringify(undoReceipt));
   await cdpUndo.send('Fetch.failRequest',{requestId:undoEvent.requestId,errorReason:'ConnectionClosed'});
  }finally{await cdpUndo.send('Fetch.disable').catch(()=>{});await cdpUndo.detach().catch(()=>{});}
  await f.page.locator(view+'[data-state=\"WRITE_OUTCOME_UNCONFIRMED\"]').waitFor();await f.flushResponses();
  assert.equal(f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/workspace/module-view/confirm')).length,2,'PAN548_RUN118 the first tab dispatched more than its two deliberate confirms');
  const forcedAtUndoUnknownV118=f.requests.length;
  await confirmControl().evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await new Promise(r=>setTimeout(r,150));await f.flushResponses();
  assert.equal(f.requests.length,forcedAtUndoUnknownV118,'PAN548_RUN118 the lost undo reply was auto-replayed by a forced click');
  // LEG E — positive arm of the SAME reconcile control: against the actually applied exact candidate the
  // existing independent readback must affirm and settle — the distinction lives in the exact
  // revision/digest/confirmed-candidate binding, not in any label.
  await reconcileControl().click();
  await f.page.locator(view+'[data-state=\"SAVED_AND_NATIVE_READBACK_CONFIRMED\"]').waitFor();await f.flushResponses();
  assert.equal(await f.page.locator(view).getAttribute('data-effect-phase'),'RESTORED','PAN548_RUN118 the reconciled UNDO did not render its honest effect phase');
  assert.match(await viewStatus(),/View gespeichert, separat nativ bestätigt/,'PAN548_RUN118 the confirmed reconcile readback text drifted');
  const finalPersistedV118=f.readPersisted();
  assert.deepEqual([finalPersistedV118.revision,finalPersistedV118.viewDigest,finalPersistedV118.confirmedCandidateDigest,finalPersistedV118.view.instances.find(i=>i.instanceId==='invoice-value').size],[3,undoPreview.afterDigest,undoPreview.candidateDigest,'large'],'PAN548_RUN118 the independently confirmed persisted truth drifted from the reconciled undo candidate');
  assert.equal(await reconcileControl().isVisible(),false,'PAN548_RUN118 the settled hold kept a stale reconciliation control');
  assert.equal(await f.page.locator(root).getAttribute('data-state'),'RESULT_READY','PAN548_RUN118 the reconcile disturbed the run projection');
  assert.equal(await f.page.locator(root).getAttribute('data-run'),result.runId,'PAN548_RUN118 the reconcile lost the run binding');
  // Coherence fences of THIS seam: the whole lost-reply/reconcile/winner journey rides ONLY the existing
  //546 gateway — no added provider traffic, no hidden replan/probe, no connection-row or ledger mutation.
  assert.equal(f.posts(),2,'PAN548_RUN118 the editor journey touched the provider beyond the two synthetic POSTs');
  const getObservationsV118=f.observations.filter(o=>o.method==='GET');
  assert.equal(getObservationsV118.length,3,'PAN548_RUN118 unexpected provider GET traffic:'+JSON.stringify(getObservationsV118.map(o=>[o.credentialPresent,o.credentialDigest])));
  assert.deepEqual(getObservationsV118.map(o=>({credentialPresent:o.credentialPresent,credentialDigest:o.credentialDigest})),[{credentialPresent:false,credentialDigest:null},{credentialPresent:true,credentialDigest:hash(syntheticCredential565)},{credentialPresent:true,credentialDigest:hash(syntheticCredential565)}],'PAN548_RUN118 the credential vector drifted from credential-free reachability plus the two authenticated checks');
  assert.equal(count(f,'plan'),planBaseline,'PAN548_RUN118 the journey issued a hidden replan');
  assert.equal(f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/model-connection/probe')).length,probeBaseline,'PAN548_RUN118 the journey issued a hidden connection probe');
  const rowFinalV118=persistedConnectionRow548(f);
  assert.equal(rowFinalV118.revision,rowPostRunPreEditorV118.revision,'PAN548_RUN118 the lost-reply/reconcile journey mutated the persisted connection revision against the independent post-run/pre-editor baseline');
  assert.deepEqual(rowFinalV118.state,rowPostRunPreEditorV118.state,'PAN548_RUN118 the lost-reply/reconcile journey changed the persisted connection state against the independent post-run/pre-editor baseline');
  assert.equal(rowFinalV118.state.lastOperation,result.runId,'PAN548_RUN118 the journey displaced the run operation binding');
  assert.deepEqual(nativeLedgerRows548(f),ledgerPostRunPreEditorV118,'PAN548_RUN118 the journey disturbed the persisted native ledger against the independent post-run/pre-editor baseline');
  // Privacy and session retirement: secrets never surface, logout discards the whole presentation.
  const bodyTextV118=await f.page.locator('body').innerText();
  assert.ok(!bodyTextV118.includes(syntheticCredential565),'PAN548_RUN118 a synthetic credential reached the DOM');
  assert.ok(!JSON.stringify(f.observations).includes(syntheticCredential565),'PAN548_RUN118 credential bytes reached the peer observations');
  await connectedCapture(f,'desktop-run118-lost-reply-reconciled-truth');
  await f.page.getByRole('button',{name:'Abmelden',exact:true}).click();
  await f.page.getByRole('heading',{name:'Abgemeldet',exact:true}).waitFor();
  assert.equal(await f.page.locator(root).count(),0,'PAN548_RUN118 the panel survived the logout');
  assert.deepEqual(secondErrorsV118,[],'PAN548_RUN118 the second tab produced page errors');
  assert.equal(f.business(),before,'PAN548_RUN118 the journey produced a business effect');
  assert.deepEqual(f.errors,[]);
 }finally{await second?.close().catch(()=>{});await cdp?.detach().catch(()=>{});await f.close();}
});

// RUN120 — direct regression evidence for the connected product change in
// workspace-agent-panel-v1.ts (proposalFreshnessV1/renderProposalFreshnessV1). Source-bound gap:
// #548 PUI-07-AC02 demands every unavailable operation be "disabled mit Grund" and UIDOD-02 keeps
// proposal/decision/authority/effect separate — yet the separate proposal review (the panel's own
// operation into the existing 546 editor) went silently dead whenever its EXISTING freshness fence
// failed, while the RESULT_READY rows kept promising "separate aktuelle Vorschau und Bestätigung
// bleiben nötig". The accepted RUN112/RUN114/RUN118 legs asserted the disable and DUI06's literal
// 'RELOADED_PROPOSAL_NEEDS_FRESH_NATIVE_SELECTION'/'OLD_PROPOSAL_NOT_REAPPLIED_AFTER_CAS' fences
// prove the state happens; none of them could assert an explanation because none existed. This
// journey rides ONLY the existing plain synthetic assembly (no provider at all): the closed kind on
// the existing reachable group, the honest reason line, the aria binding, zero hidden traffic and
// the real recovery paths (fresh selection, explicit re-plan, one new bounded run) are asserted on
// the actual mounted product. Controlled local HTTP framing only — explicitly NOT LLM evidence.
test('PUI07 RUN120 actual browser honest unavailable-reason for the freshness-fenced separate proposal review: the reload-before-reselection names the moved native selection with zero requests and the fresh selection clears it without any new plan, preview cancellation keeps the fence fresh, the genuine CAS save names the exact Revision 0→1 move while a forced click cannot dispatch anything, an explicit new plan retires the stale line honestly and one fresh bounded run restores exactly one reviewable proposal; NOT LLM',async()=>{
 const f=await nativeViewBrowserFixture546({agentRuns:true});
 const opsBox=f.page.locator('#pan548-agent-task-operations'),freshnessNote=f.page.locator('#pan548-agent-proposal-freshness-reason');
 const reviewBtn=()=>f.page.locator(root).getByRole('button',{name:'Diesen Vorschlag separat im Vieweditor prüfen',exact:true});
 const freshnessV1=async()=>{await showAgentTechnicalUI(f.page);return opsBox.getAttribute('data-proposal-freshness');};
 try{
  const before=f.business();await open(f);await select(f);await plan(f);const result=await run(f);
  assert.equal(result.phase,'RESULT_READY');
  // Leg A — fence passes: an actual RESULT_READY proposal with fresh selection is reviewable and
  // NO reason line occupies the group (the note must never invent staleness).
  assert.equal(await freshnessV1(),'FRESH','PAN548_RUN120 the fresh terminal proposal did not classify FRESH');
  assert.equal(await freshnessNote.isVisible(),false,'PAN548_RUN120 a fresh proposal showed an unavailable-reason line');
  assert.equal(await reviewBtn().isEnabled(),true,'PAN548_RUN120 the fresh proposal was not reviewable');
  assert.equal(await reviewBtn().getAttribute('aria-describedby'),null,'PAN548_RUN120 the review button described a reason while the fence passed');
  // Leg B — genuine reload with the automatic independent read: the reloaded projection is real
  // but this fresh tab page carries no native selection yet, so the SAME fence the accepted DUI06
  // leg asserts (review disabled, needs fresh selection) must now NAME that moved predicate.
  await f.page.reload();await showCurrentContextDetailsUI(f.page);
  await f.page.locator('[id="shell.context-selection"][data-module="pan.erv"][data-state="CURRENT_CONTEXT"]').waitFor();
  await state(f,'RESULT_READY');await showCurrentViewDetailsUI(f.page);await f.page.locator(view+'[data-state="CURRENT_NATIVE_VIEW"]').waitFor();await f.flushResponses();
  assert.equal(await freshnessV1(),'SELECTION_MOVED','PAN548_RUN120 the reloaded proposal without fresh selection did not classify through the closed fence');
  assert.equal(await freshnessNote.isVisible(),true,'PAN548_RUN120 the silently disabled review still showed no reason');
  const movedText=await freshnessNote.innerText();
  assert.ok(movedText.includes('nicht mehr genau das vorgeschlagene Viewelement invoice-value')&&movedText.includes('erneut aus')&&movedText.includes('sendet nichts, dispatcht nichts, löscht nichts'),'PAN548_RUN120 the selection-moved reason does not tell the recoverable present-tense truth:'+movedText);
  assert.ok(!movedText.includes('angewendet wurde')&&!movedText.includes('gespeichert')&&!movedText.includes('nichts wurde gesendet'),'PAN548_RUN120 the selection-moved reason claims a historical persistence effect the fence cannot establish:'+movedText);
  assert.equal(await reviewBtn().isDisabled(),true,'PAN548_RUN120 the unbound reloaded proposal stayed reviewable');
  assert.equal(await reviewBtn().getAttribute('aria-describedby'),'pan548-agent-proposal-freshness-reason','PAN548_RUN120 the disabled review did not describe its visible reason to assistive technology');
  assert.equal(await freshnessNote.evaluate(n=>n.closest('#pan548-agent-task-operations')!==null),true,'PAN548_RUN120 the reason line sits outside the existing reachable reason group');
  const requestsAtStaleReload=f.requests.length;
  await reviewBtn().evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await new Promise(r=>setTimeout(r,150));await f.flushResponses();
  assert.equal(f.requests.length,requestsAtStaleReload,'PAN548_RUN120 the forced click on the unavailable review dispatched something');
  assert.equal(f.readPersisted().revision,0,'PAN548_RUN120 the unavailable review persisted anything');
  await capture(f,'run120-agent-reloaded-selection-moved-reason-desktop');
  // Recovery leg 1 — the honest recovery the line itself names: re-selecting exactly the proposed
  // element passes the fence again WITHOUT any new plan, dispatch or provider/owner round trip.
  const startsAtReloadV120=count(f,'start');
  await select(f);await state(f,'RESULT_READY');
  assert.equal(await freshnessV1(),'FRESH','PAN548_RUN120 the fresh native selection did not restore fence freshness');
  assert.equal(await freshnessNote.isVisible(),false,'PAN548_RUN120 the reason line survived the recovery it names');
  assert.equal(await reviewBtn().isEnabled(),true,'PAN548_RUN120 the recovered proposal stayed unreviewable');
  assert.equal(count(f,'start'),startsAtReloadV120,'PAN548_RUN120 the selection recovery started another task');
  // Leg C — an open preview is not staleness: the fence ignores the PREVIEW_ONLY presentation
  // itself and cancelling it changes nothing.
  await preview(f);
  assert.equal(await freshnessV1(),'FRESH','PAN548_RUN120 the open preview was misclassified as staleness');
  await f.page.locator(view).getByRole('button',{name:'Vorschau abbrechen — nichts speichern',exact:true}).click();
  await f.page.locator(view+'[data-state="LOCAL_DRAFT_DISCARDED"]').waitFor();
  assert.equal(await freshnessV1(),'FRESH','PAN548_RUN120 the cancelled preview was misclassified as staleness');
  assert.equal(await reviewBtn().isEnabled(),true,'PAN548_RUN120 the cancelled preview disabled the review');
  // Leg D — the SAME deliberate CAS save DUI06/RUN114 already fence-tested: after the persisted
  // revision moved 0→1 the still-displayed proposal must be explained by the EXACT binding-vs-
  // current revision pair, never by a fake success or a silent dead button. RUN121: this save is the
  // panel's OWN preview+confirm (SAVED_AND_NATIVE_READBACK_CONFIRMED) — the fence sees only the
  // PRESENT revision inequality and cannot derive WHO moved the revision, so the reason must not
  // claim a historical non-application ('nicht angewendet') over its own confirmed save; it names
  // its derivability limit and the CURRENT custody state instead.
  await preview(f);await confirm(f);
  assert.equal(f.readPersisted().revision,1,'PAN548_RUN120 the deliberate save did not persist revision 1');
  assert.equal(await freshnessV1(),'REVISION_MOVED','PAN548_RUN120 the externally moved revision did not classify through the closed fence');
  const movedRevisionText=await freshnessNote.innerText();
  assert.ok(movedRevisionText.includes('Revision 0')&&movedRevisionText.includes('Revision 1'),'PAN548_RUN120 the revision-moved reason does not carry the concrete before/after pair:'+movedRevisionText);
  assert.ok(!movedRevisionText.includes('nicht angewendet'),'INDEPENDENT120_CONFIRMED_OWN_CAS_MUST_NOT_CLAIM_NON_APPLICATION:'+movedRevisionText);
  assert.ok(movedRevisionText.includes('nicht ableitbar')&&movedRevisionText.includes('bleibt in der angezeigten Laufprojektion erhalten'),'PAN548_RUN120 the revision-moved reason neither names its own derivability limit nor the current proposal custody:'+movedRevisionText);
  assert.equal(await reviewBtn().isDisabled(),true,'PAN548_RUN120 the stale proposal stayed reviewable after the CAS move');
  assert.equal(await reviewBtn().getAttribute('aria-describedby'),'pan548-agent-proposal-freshness-reason','PAN548_RUN120 the stale review lost its described reason');
  const requestsAtMoved=f.requests.length;
  await reviewBtn().evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await new Promise(r=>setTimeout(r,150));await f.flushResponses();
  assert.equal(f.requests.length,requestsAtMoved,'PAN548_RUN120 the forced click on the stale review dispatched something');
  assert.equal(f.readPersisted().revision,1,'PAN548_RUN120 the stale review mutated the persisted view');
  assert.equal(count(f,'start'),1,'PAN548_RUN120 the stale review started another task');
  await capture(f,'run120-agent-stale-proposal-revision-moved-reason-desktop');
  // Leg E — the explicit new plan retires the stale projection honestly: no proposal, no reason
  // line, no lingering REVISION_MOVED claim over a state that has no proposal at all.
  await plan(f);
  assert.equal(await freshnessV1(),'NO_CURRENT_PROPOSAL','PAN548_RUN120 the explicit re-plan kept claiming a stale proposal');
  assert.equal(await freshnessNote.isVisible(),false,'PAN548_RUN120 the retired proposal kept showing a reason line');
  assert.equal(await reviewBtn().getAttribute('aria-describedby'),null,'PAN548_RUN120 the re-planned review still described a retired reason');
  // Leg F — one fresh bounded run from the current revision delivers a NEW proposal bound to
  // revision 1: the fence passes again and exactly one reviewable proposal exists.
  const result2=await run(f);
  assert.equal(result2.phase,'RESULT_READY');assert.equal(result2.proposal.expectedRevision,1,'PAN548_RUN120 the second proposal was not bound to the CURRENT persisted revision');
  assert.equal(await freshnessV1(),'FRESH','PAN548_RUN120 the new revision-bound proposal did not classify FRESH');
  assert.equal(await freshnessNote.isVisible(),false,'PAN548_RUN120 the fresh second proposal showed a reason line');
  assert.equal(await reviewBtn().isEnabled(),true,'PAN548_RUN120 the new proposal was not reviewable');
  assert.equal(count(f,'start'),2,'PAN548_RUN120 the recovery journey started more than the two deliberate runs');
  assert.equal(f.readPersisted().revision,1,'PAN548_RUN120 the second run persisted anything');
  // 390 — the reason line is actually readable where the user looks: fully revealable by natural
  // scroll inside the real viewport, no horizontal clipping, hit-testable at center. The stale
  // state is re-created deterministically by the deliberate Undo write through the existing 546 leg.
  await f.page.locator(view).getByRole('button',{name:'Letzten gespeicherten Viewstand zurückholen',exact:true}).click();
  await f.page.locator(view+'[data-state="PREVIEW_ONLY"]').waitFor();
  await confirm(f);
  assert.equal(await freshnessV1(),'REVISION_MOVED','PAN548_RUN120 the undo-moved revision did not classify through the closed fence');
  await f.page.setViewportSize({width:390,height:844});await showAgentTechnicalUI(f.page);
  assert.equal(await freshnessNote.isVisible(),true,'PAN548_RUN120 the reason line vanished at phone width');
  await freshnessNote.evaluate(n=>n.scrollIntoView({block:'center'}));
  const g=await freshnessNote.evaluate(n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,vw:innerWidth,vh:innerHeight,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth};});
  assert.ok(g.height>0&&g.top>=0&&g.bottom<=g.vh,'PAN548_RUN120_REASON_NOT_FULLY_REVEALABLE_BY_SCROLL_390:'+JSON.stringify(g));
  assert.ok(g.left>=0&&g.right<=g.vw&&g.scrollWidth<=g.clientWidth+1,'PAN548_RUN120_REASON_HORIZONTALLY_CLIPPED_390:'+JSON.stringify(g));
  const hitSelf=await freshnessNote.evaluate(n=>{const r=n.getBoundingClientRect(),hit=document.elementFromPoint(Math.min(Math.max(r.left+r.width/2,0),innerWidth-1),Math.min(Math.max(r.top+r.height/2,0),innerHeight-1));return hit===n||n.contains(hit);});
  assert.ok(hitSelf,'PAN548_RUN120_REASON_NOT_ACTUALLY_SHOWN_ON_TOP_390');
  const image390=join(evidence(),'run120-agent-revision-moved-reason-390-visible.png');await f.page.screenshot({path:image390,fullPage:false});
  assert.ok(readFileSync(image390).length>0,'PAN548_RUN120 missing 390 viewport capture');
  await f.page.setViewportSize({width:1280,height:900});
  // Coherence and privacy fences of this seam: only personal-view persistence ever happened, no
  // business effect, and the logout retires the whole presentation with the panel.
  assert.equal(f.business(),before,'PAN548_RUN120 the journey produced a business effect');
  await f.page.getByRole('button',{name:'Abmelden',exact:true}).click();
  await f.page.getByRole('heading',{name:'Abgemeldet',exact:true}).waitFor();
  assert.equal(await f.page.locator(root).count(),0,'PAN548_RUN120 the panel survived the logout');
  assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
