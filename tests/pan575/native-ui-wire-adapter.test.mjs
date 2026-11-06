// Strict-wire probe for the closed native UI provider-name adaptation.
// The local HTTP peer enforces the REAL observed server contract: every wire
// function name (declared tools AND assistant tool-call transcript entries)
// must match [A-Za-z0-9_-]{1,256}; a dotted name is answered with HTTP 400,
// exactly like the available local server. This is an explicitly SYNTHETIC
// protocol peer (realModelAcceptance=false everywhere), never a model.
// Positive path: genuine #565 owner -> #575 shared loop -> #548 consumer with
// fresh correlated results, RESULT_READY, durable native reservation/settle
// readback across reopen and NO personal-view mutation without the separate
// #546 confirmation. Negatives assert the exact intended refusal plus the
// actual POST count, distinguishing "dispatch not started" (0 POST) from an
// unclear effect (UNKNOWN_USAGE retained, no blind retry).
// The peer and every expectation use STABLE LITERALS authored here; nothing
// expected is derived from the adapter under test. The transport module is
// imported as a namespace so the positive probe and the RED-boundary probe
// link and run on the frozen predecessor (which lacks the new exports and
// must show the real dotted-wire HTTP 400 / OUTCOME_UNCONFIRMED RED, not an
// import-time failure).
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,chmodSync} from 'node:fs';
import {createServer,request as httpRequest} from 'node:http';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {connectionOptions565,syntheticCredential565,limits565} from '../pan565/native-fixture.mjs';
import {nativeViewFixture546} from '../pan546/native-fixture.mjs';
import {createNativeWorkspaceAgentRunV1,syntheticWorkspaceViewChatFeedbackModelV1} from '../../src/pan548/native-agent-run.mjs';
import * as nativeModelConnection from '../../src/pan565/native-model-connection.mjs';
import * as pan565Transport from '../../src/pan565/connection-transport.mjs';
// Stable test-owned literals for the expected provider-wire names: the strict
// peer answers with these, and the assertions below expect exactly these.
const WIRE_ALIAS_V1=Object.freeze({'ui.view.read':'ui_view_read','ui.view.propose':'ui_view_propose'});
// Exactly one intended refusal code per negative mode (no OR-regex across
// different validation boundaries).
const EXACT_REFUSAL_V1=Object.freeze({FORGED_ALIAS:'MODEL_CONNECTION_WIRE_ALIAS_DENIED',MIXED_NATIVE:'MODEL_CONNECTION_WIRE_ALIAS_DENIED',WRONG_CASE:'MODEL_CONNECTION_WIRE_ALIAS_DENIED',BAD_CALL_ID:'MODEL_CONNECTION_TOOL_FORMAT_DENIED'});
const WIRE_STRICT=/^[A-Za-z0-9_-]{1,256}$/;
function wireNames(body){const names=[];for(const t of body.tools??[])if(typeof t?.function?.name==='string')names.push(t.function.name);for(const m of body.messages??[])if(m.role==='assistant'&&Array.isArray(m.tool_calls))for(const c of m.tool_calls)if(typeof c?.function?.name==='string')names.push(c.function.name);return names;}
async function strictWirePeer(mode='OK',purposes=['purpose:ui-connection-probe','purpose:ui-view-proposal']){
 const f=await nativeViewFixture546(),peer=syntheticWorkspaceViewChatFeedbackModelV1('tenant-a'),observations=[];let post=0;let strictViolations=0;
 const credentialFile=join(f.root,'owned-synthetic-existing-secret');writeFileSync(credentialFile,syntheticCredential565,{mode:0o600});
 const server=createServer(async(req,res)=>{let bytes='';for await(const chunk of req)bytes+=chunk;const body=bytes?JSON.parse(bytes):null;observations.push({method:req.method,body});if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({data:[{id:'model:synthetic-v1'}]}));return;}
  post++;const names=wireNames(body),violating=names.filter(n=>!WIRE_STRICT.test(n));if(violating.length){strictViolations++;res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:'strict-wire dotted function name'}));return;}
  const result=await peer.providerCall({request:body},new AbortController().signal);
  if(mode==='BAD_FRESH_INFORMATION'&&!result.toolCalls.length){const final=JSON.parse(result.text);final.answers[0].sum=0;result.text=JSON.stringify(final);}
  // MIXED_NATIVE is genuinely mixed: the FIRST response entry carries the wire
  // alias, the SECOND still carries the native dotted name.
  const echoName=(c,i)=>mode==='MIXED_NATIVE'?(i===0?WIRE_ALIAS_V1[c.name]:c.name):mode==='FORGED_ALIAS'?'ui_view_save':mode==='WRONG_CASE'?'UI_View_Read':WIRE_ALIAS_V1[c.name]??c.name;
  const callId=c=>mode==='BAD_CALL_ID'?'call bad id!':c.id;
  if(mode==='SECRET_RETIRED_AFTER_FIRST'&&post===1)chmodSync(credentialFile,0o644);
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({model:'model:synthetic-v1',choices:[{message:{content:result.toolCalls.length?null:result.text,tool_calls:result.toolCalls.map((c,i)=>({id:callId(c),type:'function',function:{name:echoName(c,i),arguments:JSON.stringify(c.arguments)}}))}}],usage:{prompt_tokens:2,completion_tokens:3}}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const options=connectionOptions565({origin},credentialFile);options.productGrant.limits={...options.productGrant.limits,maxTimeMs:15000,maxInputBytes:32768};options.productGrant.allowedPurposes=[...purposes];
 let connection=nativeModelConnection.createNativeModelConnectionV1({sessions:f.sessions,profiles:f.legacy,root:f.root,connections:[options]});let model=nativeModelConnection.createNativeWorkspaceFeedbackModelV1(connection,f.sessions.binding);
 const transport=pan565Transport.bindModelConnectionTransportV1(structuredClone(connectionOptions565({origin},credentialFile)));
 const create=()=>createNativeWorkspaceAgentRunV1({sessions:f.sessions,contextSelection:f.context,dataCatalog:f.data,viewOwner:f.view,root:join(f.root,'strict-wire-ui-consumer'),model});let agent=create();
 const t=f.tab(),c=t.context;t.context=f.context.claim(t.headers,{schemaVersion:'pansphaira.workspace-context/claim/v1',tabId:c.binding.tabId,moduleId:c.moduleId,viewId:c.viewId,primaryObjectId:c.primaryObject.objectId,selection:{elementId:'pan.erv.module-card',rowId:'invoice-value'},expected:{...c.revisions,epoch:c.binding.epoch}}).context;
 const headers={...t.headers,'x-pan565-session':t.headers['x-pan548-session']},ctx=()=>f.verification(t),readConnection=()=>connection.read(headers);
 const plan=()=>agent.plan(t.headers,{schemaVersion:'pansphaira.workspace-agent/plan/v1',context:ctx(),text:'Nur ausgewähltes Viewelement als Vorschlag; keine Fachwirkung.'});
 const command=p=>({schemaVersion:'pansphaira.workspace-agent/start/v1',context:ctx(),planHandle:p.planHandle,planDigest:p.planDigest,inferenceConsent:{offerDigest:p.inferenceConsentOffer.offerDigest,confirm:true}});
 const start=p=>agent.start(t.headers,command(p)),read=p=>agent.read(t.headers,{schemaVersion:'pansphaira.workspace-agent/read/v1',context:ctx(),runId:p.runId});
 const prerequisites=async()=>{let r=readConnection();connection.select(headers,{schemaVersion:'pansphaira.workspace-model-connection/select/v1',expectedRevision:r.revision,connectionId:options.summary.connectionId});for(const phase of ['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY']){r=readConnection();await connection.probe(headers,{schemaVersion:'pansphaira.workspace-model-connection/probe/v1',expectedRevision:r.revision,identityDigest:r.identityDigest,phase});}};
 const rawPost=path=>new Promise(resolve=>{const req=httpRequest({host:'127.0.0.1',port:server.address().port,path,method:'POST',headers:{'content-type':'application/json'}},res=>{let b='';res.on('data',d=>b+=d);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(b)}));});req.end(JSON.stringify({model:'model:synthetic-v1',messages:[],tools:[{type:'function',function:{name:'ui.view.read',parameters:{}}}]}));});
 return {f,t,ctx,headers,model,options,transport,observations,prerequisites,plan,command,start,read,readConnection,posts:()=>post,strictViolations:()=>strictViolations,rawPost,get connection(){return connection;},get agent(){return agent;},reopen(){agent.close();connection.close();connection=nativeModelConnection.createNativeModelConnectionV1({sessions:f.sessions,profiles:f.legacy,root:f.root,connections:[options]});model=nativeModelConnection.createNativeWorkspaceFeedbackModelV1(connection,f.sessions.binding);agent=create();},async close(){agent.close();connection.close();server.closeAllConnections();await new Promise(r=>server.close(r));await f.close();}};
}

test('575 strict local protocol peer rejects the predecessor dotted wire shape with HTTP 400 (RED boundary on frozen predecessor)',async()=>{
 const x=await strictWirePeer();try{const r=await x.rawPost('/v1/chat/completions');assert.equal(r.status,400);assert.equal(x.posts(),1);assert.equal(x.strictViolations(),1);}finally{await x.close();}
});

test('575 positive native565->575->548 over strict wire: alias-only outgoing JSON, fresh correlated RESULT_READY, settled readback across reopen, no view mutation without separate 546',async()=>{
 const x=await strictWirePeer();try{await x.prerequisites();const before=x.f.view.read(x.t.headers,x.ctx());assert.equal(x.posts(),0);
  const p=x.plan(),r=await x.start(p);
  assert.equal(r.phase,'RESULT_READY',JSON.stringify(r));assert.equal(r.realModelAcceptance,false);assert.equal(r.modelMode,'OWNER_BOUND_PROVIDER');
  assert.equal(x.posts(),2);assert.equal(x.strictViolations(),0);
  const posts=x.observations.filter(o=>o.method==='POST');
  assert.deepEqual(posts[0].body.tools.map(o=>o.function.name),['ui_view_read','ui_view_propose']);
  assert.deepEqual(posts[1].body.messages.map(m=>m.role),['user','assistant','tool','tool']);
  assert.deepEqual(posts[1].body.messages[1].tool_calls.map(c=>c.function.name),['ui_view_read','ui_view_propose']);
  assert.deepEqual(posts[1].body.messages.slice(2).map(m=>m.tool_call_id),['call_UIReadAa9','call_UIProposeBb8']);
  assert.equal(r.proposal.requiresSeparateNative546PreviewAndConfirmation,true);assert.deepEqual(x.f.view.read(x.t.headers,x.ctx()),before);
  assert.equal(x.readConnection().checks.INFERENCE.reason,'SYNTHETIC_TOOL_FEEDBACK_ONLY');assert.equal(x.readConnection().consent,'NOT_GRANTED');
  assert.ok(r.budget.model.consumedUnits>0);assert.equal(r.budget.runtime.consumedUnits,2);
  assert.deepEqual(await x.start(p),r);x.reopen();assert.deepEqual(x.read(p),r);assert.equal(x.posts(),2);assert.throws(x.plan,/TASK_CONSENT_DENIED/);
 }finally{await x.close();}
});

for(const mode of ['FORGED_ALIAS','MIXED_NATIVE','WRONG_CASE','BAD_CALL_ID'])test('575 strict-wire negative '+mode+': exact transport refusal, unknown response name never reaches native settlement, full UNKNOWN hold, no blind retry',async()=>{
 const x=await strictWirePeer(mode);try{await x.prerequisites();const p=x.plan(),r=await x.start(p);
  assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(r.proposal,null);assert.equal(r.realModelAcceptance,false);
  assert.equal(x.posts(),1,'one request actually dispatched; no silent second attempt');
  assert.equal(x.readConnection().checks.INFERENCE.state,'UNKNOWN_USAGE');
  assert.ok(r.budget.model.committedUnits>0&&r.budget.model.consumedUnits===0,'full reservation held');
  assert.deepEqual(await x.start(p),r);x.reopen();assert.deepEqual(x.read(p),r);assert.equal(x.posts(),1);assert.throws(x.plan,/TASK_CONSENT_DENIED|STALE_DENIED/);
  // exact transport-level refusal code for the same response shape (the
  // synthetic framing peer needs a loop-shaped prompt, not a bare string).
  // This direct probe is a SEPARATE, explicitly counted additional POST.
  await assert.rejects(x.transport.providerToolStepCall({request:{model:'model:synthetic-v1',messages:[{role:'user',content:'x DATA: {\"selectedInstanceId\":\"invoice-value\"}\nBounded feedback contract: probe'}],tools:[{type:'function',function:{name:'ui.view.read'}},{type:'function',function:{name:'ui.view.propose'}}]}},new AbortController().signal,()=>true,limits565),
   err=>{assert.equal(err.message,EXACT_REFUSAL_V1[mode]);return true;});
  assert.equal(x.posts(),2,'the direct probe itself dispatched exactly one further POST; the failed agent loop made no blind retry');
 }finally{await x.close();}
});

test('575 strict-wire negative UNKNOWN secret-retired/fresh-information: unclear effect keeps full reserve across reopen, dispatch-not-started stays at zero POST',async()=>{
 for(const [mode,expectedPosts]of[['SECRET_RETIRED_AFTER_FIRST',1],['BAD_FRESH_INFORMATION',2]]){const x=await strictWirePeer(mode);try{await x.prerequisites();const p=x.plan(),r=await x.start(p);
  assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(r.proposal,null);assert.equal(x.readConnection().checks.INFERENCE.state,'UNKNOWN_USAGE');assert.ok(r.budget.model.committedUnits>0&&r.budget.model.consumedUnits===0);
  assert.deepEqual(await x.start(p),r);x.reopen();assert.deepEqual(x.read(p),r);assert.equal(x.posts(),expectedPosts,'unclear effect: no blind model retry');assert.throws(x.plan,/TASK_CONSENT_DENIED|STALE_DENIED/);
 }finally{await x.close();}}
 // The missing task purpose must be the ACTUAL cause: this is the otherwise
 // identical, otherwise-permitted fixture granted only the probe purpose.
 const x=await strictWirePeer('OK',['purpose:ui-connection-probe']);try{assert.throws(x.plan,/MODEL_CONNECTION_TASK_CONSENT_DENIED/);assert.equal(x.posts(),0,'no task purpose: dispatch not started');}finally{await x.close();}
});

test('575 closed adapter unit closure: rename plus transcript, unmappable/unknown/colliding names refused before dispatch, unmapped flows byte-identical',async()=>{
 const {adaptNativeUiWireRequestV1,MODEL_UI_WIRE_ALIAS_V1}=pan565Transport;
 assert.deepEqual({...MODEL_UI_WIRE_ALIAS_V1.binding},WIRE_ALIAS_V1,'closed code-owned registry holds exactly the literal wire names');
 const req={model:'m',messages:[{role:'user',content:'a'},{role:'assistant',content:null,tool_calls:[{id:'call_A',type:'function',function:{name:'ui.view.read',arguments:'{}'}}]},{role:'tool',tool_call_id:'call_A',content:'{}'}],tools:[{type:'function',function:{name:'ui.view.read'}},{type:'function',function:{name:'ui.view.propose'}}]};
 const passThrough={model:'m',messages:[{role:'user',content:'a'}],tools:[]};assert.equal(adaptNativeUiWireRequestV1(passThrough).request,passThrough);assert.equal(adaptNativeUiWireRequestV1(passThrough).aliases,null,'no dotted name: byte-identical pass-through');
 const b=adaptNativeUiWireRequestV1(req,{'ui.view.read':'ui_view_read','ui.view.propose':'ui_view_propose'});
 assert.deepEqual(b.request.tools.map(t=>t.function.name),['ui_view_read','ui_view_propose']);assert.deepEqual(b.request.messages[1].tool_calls.map(c=>c.function.name),['ui_view_read']);assert.equal(b.request.messages[0].content,'a');assert.deepEqual([...b.aliases.keys()],['ui_view_read','ui_view_propose']);
 assert.throws(()=>adaptNativeUiWireRequestV1(req,{'ui.view.read':'ui_view_reader','ui.view.propose':'ui_view_propose'}),/MODEL_CONNECTION_WIRE_ALIAS_DENIED/,'closed registry: a foreign structurally valid mapping is refused explicitly, never honoured or silently ignored');
 assert.throws(()=>adaptNativeUiWireRequestV1(req,{'ui.view.read':'ui_view_read'}),/MODEL_CONNECTION_WIRE_ALIAS_DENIED/,'partial subset of the code-owned binding is refused');
 assert.throws(()=>adaptNativeUiWireRequestV1({tools:[{function:{name:'ui.view.read'}},{function:{name:'ui.personal.save'}}]}),/MODEL_CONNECTION_WIRE_NAME_DENIED/);
 assert.throws(()=>adaptNativeUiWireRequestV1({tools:[{function:{name:'ui.view.read'}},{function:{name:'ui_view_read'}}]}),/MODEL_CONNECTION_WIRE_NAME_DENIED/,'declared alias may not collide with the renamed native');
 assert.throws(()=>adaptNativeUiWireRequestV1({tools:[{function:{name:'ui.view.read'}}]},{'ui.view.read':'ui.view.read'}),/MODEL_CONNECTION_WIRE_ALIAS_DENIED/);
 assert.throws(()=>adaptNativeUiWireRequestV1({tools:[{function:{name:'ui.view.read'}}]},{'ui.view.read':'ui.view.read_alias'}),/MODEL_CONNECTION_WIRE_ALIAS_DENIED/);
 assert.throws(()=>adaptNativeUiWireRequestV1({tools:[{function:{name:'ui.view.read'}}]},{'ui.view.read':'ui_view_x','ui.view.propose':'ui_view_x'}),/MODEL_CONNECTION_WIRE_ALIAS_DENIED/,'colliding aliases');
 const x=await strictWirePeer();try{await assert.rejects(x.transport.providerToolStepCall({request:{model:'model:synthetic-v1',messages:[],tools:[{type:'function',function:{name:'ui.view.read'}},{type:'function',function:{name:'ui.personal.save'}}]}},new AbortController().signal,()=>true,limits565),/MODEL_CONNECTION_WIRE_NAME_DENIED/);assert.equal(x.posts(),0,'unknown dotted name: refused BEFORE dispatch, zero POST');}finally{await x.close();}
});

test('575 non-UI composition pass-through: original574 dotted capability names (no UI-catalog name) leave the closed adapter byte-identical and unaliased; UI-catalog plus foreign dotted name stays fail-closed',()=>{
 const {adaptNativeUiWireRequestV1}=pan565Transport;
 // Stable literals matching the ACTUAL original574 binding capability ids
 // (src/pan471/composition-bindings.mjs) — not the closed UI catalog.
 const composition={model:'m',messages:[{role:'user',content:'orig574'},{role:'assistant',content:null,tool_calls:[{id:'call_PlAnAa9',type:'function',function:{name:'pan522.material.plan',arguments:'{}'}},{id:'call_CeLlBb8',type:'function',function:{name:'erp.order.create',arguments:'{}'}}]}],tools:[{type:'function',function:{name:'pan522.material.plan'}},{type:'function',function:{name:'erp.order.create'}}]};
 const snapshot=JSON.stringify(composition),pass=adaptNativeUiWireRequestV1(composition);
 assert.equal(pass.request,composition,'no UI-catalog name: the SAME request object passes through, untouched');
 assert.equal(pass.aliases,null,'no alias map: response names stay native, original broker/tool guards decide');
 assert.equal(JSON.stringify(composition),snapshot,'byte-identical after adaptation: no dotted composition name renamed, frozen or blocked');
 assert.deepEqual(composition.tools.map(t=>t.function.name),['pan522.material.plan','erp.order.create'],'original574 capability ids keep their exact native dotted names');
 assert.throws(()=>adaptNativeUiWireRequestV1({model:'m',messages:[],tools:[{type:'function',function:{name:'ui.view.read'}},{type:'function',function:{name:'pan522.material.plan'}}]}),/MODEL_CONNECTION_WIRE_NAME_DENIED/,'a UI-catalog request combined with a foreign dotted composition name stays fail-closed BEFORE dispatch');
});
