import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,chmodSync,readdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
import {connectionOptions565,syntheticCredential565} from '../pan565/native-fixture.mjs';
import {materialInput575} from './protocol-fixture.mjs';
import {isCompletedBrokerToolFeedbackV1} from '../../src/pan575/broker-tool-feedback.mjs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {nativeViewFixture546} from '../pan546/native-fixture.mjs';
import {createNativeWorkspaceAgentRunV1,syntheticWorkspaceViewChatFeedbackModelV1} from '../../src/pan548/native-agent-run.mjs';
import {validateWorkspaceAgentReadV1} from '../../dist/packages/contracts/src/workspace-agent-run-v1.js';
import {nativeWorkspaceViewFieldsV1} from '../../src/pan546/native-data-catalog.mjs';
import * as nativeModelConnection from '../../src/pan565/native-model-connection.mjs';
import {MODEL_UI_WIRE_ALIAS_V1,MODEL_COMPOSITION_WIRE_ALIAS_V1} from '../../src/pan565/connection-transport.mjs';

test('575 own missing native565 product-owner capability must exist; delivered synthetic callback is not owner admission',()=>{
 assert.equal(typeof nativeModelConnection.createNativeWorkspaceFeedbackModelV1,'function','OWN INTERNAL MISSING NATIVE MODEL OWNER BINDING; not a user/route blocker');
});
async function fixture(change=()=>{}){
 const f=await nativeViewFixture546(),root=mkdtempSync(join(tmpdir(),'pan575-owned-548-consumer-')),model=syntheticWorkspaceViewChatFeedbackModelV1('tenant-a'),observations=[],original=model.providerCall;
 model.providerCall=async(b,s)=>{observations.push(structuredClone(b));return original(b,s);};change(model);
 const create=()=>createNativeWorkspaceAgentRunV1({sessions:f.sessions,contextSelection:f.context,dataCatalog:f.data,viewOwner:f.view,root,model});let owner=create();const t=f.tab(),c=t.context;t.context=f.context.claim(t.headers,{schemaVersion:'pansphaira.workspace-context/claim/v1',tabId:c.binding.tabId,moduleId:c.moduleId,viewId:c.viewId,primaryObjectId:c.primaryObject.objectId,selection:{elementId:'pan.erv.module-card',rowId:'invoice-value'},expected:{...c.revisions,epoch:c.binding.epoch}}).context;
 const ctx=()=>f.verification(t),plan=()=>owner.plan(t.headers,{schemaVersion:'pansphaira.workspace-agent/plan/v1',context:ctx(),text:'Nur Rechnungswert größer; kein Speichern, keine Fachwirkung.'}),start=p=>owner.start(t.headers,{schemaVersion:'pansphaira.workspace-agent/start/v1',context:ctx(),planHandle:p.planHandle,planDigest:p.planDigest}),read=p=>owner.read(t.headers,{schemaVersion:'pansphaira.workspace-agent/read/v1',context:ctx(),runId:p.runId});
 return {f,t,ctx,plan,start,read,observations,model,get owner(){return owner;},reopen(){owner.close();owner=create();},async close(){owner.close();await f.close();rmSync(root,{recursive:true,force:true});}};
}

test('575 same actual shared candidate consumed by548 two native UI tools and raw tool transcript, preview-only/fresh persisted native readback',async()=>{
 const x=await fixture();try{const before=x.f.view.read(x.t.headers,x.ctx()),p=x.plan(),r=await x.start(p);assert.equal(r.phase,'RESULT_READY',JSON.stringify(r));assert.equal(r.realModelAcceptance,false);assert.equal(x.observations.length,2);assert.deepEqual(x.observations[1].request.messages.map(m=>m.role),['user','assistant','tool','tool']);assert.deepEqual(x.observations[1].request.messages.slice(2).map(m=>m.tool_call_id),['call_UIReadAa9','call_UIProposeBb8']);assert.equal(r.proposal.requiresSeparateNative546PreviewAndConfirmation,true);assert.equal(r.proposal.afterView.instances.find(i=>i.instanceId==='invoice-value').size,'large');assert.deepEqual(x.f.view.read(x.t.headers,x.ctx()),before);assert.equal(r.budget.runtime.consumedUnits,2);assert.equal(validateWorkspaceAgentReadV1(r,x.t.context,nativeWorkspaceViewFieldsV1).phase,'RESULT_READY');assert.deepEqual(x.read(p),r);x.reopen();assert.deepEqual(x.read(p),r);assert.equal(x.observations.length,2);
 }finally{await x.close();}
});

for(const mode of ['UNKNOWN_TOOL','FOREIGN_INSTANCE','PROMPT_ECHO','FOREIGN_CALL_ID'])test('575 direct548 consumer '+mode+' retains full native unknown reservation, no result/proposal/save',async()=>{
 const x=await fixture(model=>{const original=model.providerCall;model.providerCall=async(...args)=>{const r=await original(...args);if(r.toolCalls.length){if(mode==='UNKNOWN_TOOL')r.toolCalls[1].name='ui.personal.save';if(mode==='FOREIGN_INSTANCE')r.toolCalls[1].arguments.operations[0].instanceId='invoice-party';}else{const f=JSON.parse(r.text);if(mode==='PROMPT_ECHO')f.answers[0].sum='prompt-known-answer';if(mode==='FOREIGN_CALL_ID')f.answers[0].callId='call_Foreign';r.text=JSON.stringify(f);}return r;};});try{const p=x.plan(),r=await x.start(p);assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(r.proposal,null);assert.equal(r.realModelAcceptance,false);assert.equal(r.budget.model.committedUnits,x.model.policy.maxBudget.maxTokens*4);assert.equal(r.budget.model.consumedUnits,0);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.t.headers)).revision,0);x.reopen();assert.deepEqual(x.read(p),r);}finally{await x.close();}
});

test('575 direct548 model label/provider subscription does not grant real route or shared-loop acceptance',async()=>{
 const x=await fixture();try{assert.throws(()=>createNativeWorkspaceAgentRunV1({sessions:x.f.sessions,contextSelection:x.f.context,dataCatalog:x.f.data,viewOwner:x.f.view,root:x.f.root,model:{...x.model,mode:'OWNER_BOUND_PROVIDER'}}),/AGENT_REAL_ROUTE_NOT_BOUND_DENIED/);assert.equal(x.observations.length,0);}finally{await x.close();}
});

// Controlled LOCAL HTTP framing peer, not a language model. This exercises
// the actual565 owner/secret/profile/cost ledger, not a trusted provider stub.
async function nativeOwnerFixture({taskPurpose=true,mode='OK'}={}){
 const f=await nativeViewFixture546(),peer=syntheticWorkspaceViewChatFeedbackModelV1('tenant-a'),observations=[];let post=0;
 const credentialFile=join(f.root,'owned-synthetic-existing-secret');writeFileSync(credentialFile,syntheticCredential565,{mode:0o600});
 const server=createServer(async(req,res)=>{let bytes='';for await(const chunk of req)bytes+=chunk;const body=bytes?JSON.parse(bytes):null;observations.push({method:req.method,credentialPresent:typeof req.headers.authorization==='string',body});if(mode==='RAW_ERROR'&&req.method==='POST'){post++;res.writeHead(500,{'content-type':'application/json'});res.end('{"error":"raw-peer-canary"}');return;}res.writeHead(200,{'content-type':'application/json'});if(req.method==='GET'){res.end(JSON.stringify({data:[{id:'model:synthetic-v1'}]}));return;}post++;const result=await peer.providerCall({request:body},new AbortController().signal);if(mode==='BAD_FRESH_INFORMATION'&&!result.toolCalls.length){const final=JSON.parse(result.text);final.answers[0].sum=0;result.text=JSON.stringify(final);}if(mode==='OVERSIZED_FINAL'&&!result.toolCalls.length)result.text='x'.repeat(9000);if(mode==='SECRET_RETIRED_AFTER_FIRST'&&post===1)chmodSync(credentialFile,0o644);// The local framing peer behaves like the real provider: it echoes only the
// wire names it was actually given. The closed adapter renames the two native
// UI identities before dispatch; native+wire mixed echoes would be a protocol
// violation and are checked by the dedicated strict-wire probe.
res.end(JSON.stringify({model:'model:synthetic-v1',choices:[{message:{content:result.toolCalls.length?null:result.text,tool_calls:result.toolCalls.map(c=>({id:c.id,type:'function',function:{name:MODEL_UI_WIRE_ALIAS_V1.binding[c.name]??c.name,arguments:JSON.stringify(c.arguments)}}))}}],usage:{prompt_tokens:2,completion_tokens:3}}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const options=connectionOptions565({origin:'http://127.0.0.1:'+server.address().port},credentialFile);options.productGrant.limits={...options.productGrant.limits,maxTimeMs:15000,maxInputBytes:32768};if(taskPurpose)options.productGrant.allowedPurposes=['purpose:ui-connection-probe','purpose:ui-view-proposal'];
 let connection=nativeModelConnection.createNativeModelConnectionV1({sessions:f.sessions,profiles:f.legacy,root:f.root,connections:[options]});let model=nativeModelConnection.createNativeWorkspaceFeedbackModelV1(connection,f.sessions.binding);
 const create=()=>createNativeWorkspaceAgentRunV1({sessions:f.sessions,contextSelection:f.context,dataCatalog:f.data,viewOwner:f.view,root:join(f.root,'native-owner-ui-consumer'),model});let agent=create();const t=f.tab(),c=t.context;t.context=f.context.claim(t.headers,{schemaVersion:'pansphaira.workspace-context/claim/v1',tabId:c.binding.tabId,moduleId:c.moduleId,viewId:c.viewId,primaryObjectId:c.primaryObject.objectId,selection:{elementId:'pan.erv.module-card',rowId:'invoice-value'},expected:{...c.revisions,epoch:c.binding.epoch}}).context;
 const headers={...t.headers,'x-pan565-session':t.headers['x-pan548-session']},ctx=()=>f.verification(t),readConnection=()=>connection.read(headers),plan=()=>agent.plan(t.headers,{schemaVersion:'pansphaira.workspace-agent/plan/v1',context:ctx(),text:'Nur ausgewähltes Viewelement als Vorschlag; keine Fachwirkung.'}),command=p=>({schemaVersion:'pansphaira.workspace-agent/start/v1',context:ctx(),planHandle:p.planHandle,planDigest:p.planDigest,inferenceConsent:{offerDigest:p.inferenceConsentOffer.offerDigest,confirm:true}}),start=p=>agent.start(t.headers,command(p)),read=p=>agent.read(t.headers,{schemaVersion:'pansphaira.workspace-agent/read/v1',context:ctx(),runId:p.runId});
 const prerequisites=async()=>{let r=readConnection();connection.select(headers,{schemaVersion:'pansphaira.workspace-model-connection/select/v1',expectedRevision:r.revision,connectionId:options.summary.connectionId});for(const phase of ['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY']){r=readConnection();await connection.probe(headers,{schemaVersion:'pansphaira.workspace-model-connection/probe/v1',expectedRevision:r.revision,identityDigest:r.identityDigest,phase});}};
 return {f,t,ctx,headers,model,options,observations,prerequisites,plan,command,start,read,readConnection,posts:()=>post,get connection(){return connection;},get agent(){return agent;},reopen(){agent.close();connection.close();connection=nativeModelConnection.createNativeModelConnectionV1({sessions:f.sessions,profiles:f.legacy,root:f.root,connections:[options]});model=nativeModelConnection.createNativeWorkspaceFeedbackModelV1(connection,f.sessions.binding);agent=create();},async close(){agent.close();connection.close();server.closeAllConnections();await new Promise(r=>server.close(r));await f.close();}};
}

test('575 native565 owner is dynamically selected after assembly, exact task consent then actual HTTP/shared548 read-propose-feedback; cost ledger and independent reopened UI readback',async()=>{
 const x=await nativeOwnerFixture();try{assert.throws(x.plan,/MODEL_CONNECTION_TASK_CONSENT_DENIED/);await x.prerequisites();const p=x.plan(),offer=p.inferenceConsentOffer;assert.equal(p.modelMode,'OWNER_BOUND_PROVIDER');assert.equal(offer.evidenceClass,'SYNTHETIC_ONLY');assert.equal(offer.currency,'NONE');assert.equal(offer.purpose,'purpose:ui-view-proposal');assert.equal(offer.model,x.options.summary.model);assert.equal(x.posts(),0);
 const missing=x.command(p);delete missing.inferenceConsent;await assert.rejects(x.agent.start(x.t.headers,missing),/AGENT_INPUT_DENIED/);await assert.rejects(x.agent.start(x.t.headers,{...x.command(p),inferenceConsent:{offerDigest:'0'.repeat(64),confirm:true}}),/TASK_CONSENT_DENIED/);assert.equal(x.posts(),0);
 const before=x.f.view.read(x.t.headers,x.ctx()),r=await x.start(p);assert.equal(r.phase,'RESULT_READY',JSON.stringify(r));assert.equal(r.realModelAcceptance,false);assert.equal(r.modelMode,'OWNER_BOUND_PROVIDER');assert.equal(x.posts(),2);assert.deepEqual(x.observations.filter(o=>o.method==='POST')[1].body.messages.map(m=>m.role),['user','assistant','tool','tool']);assert.equal(r.proposal.afterView.instances.find(i=>i.instanceId==='invoice-value').size,'large');assert.deepEqual(x.f.view.read(x.t.headers,x.ctx()),before);assert.equal(x.readConnection().checks.INFERENCE.reason,'SYNTHETIC_TOOL_FEEDBACK_ONLY');assert.equal(x.readConnection().consent,'NOT_GRANTED');assert.deepEqual(await x.start(p),r);assert.equal(x.posts(),2);x.reopen();assert.deepEqual(x.read(p),r);assert.equal(x.posts(),2);assert.throws(x.plan,/TASK_CONSENT_DENIED/);
 }finally{await x.close();}
});

test('575 existing probe-only product grant/probe consent cannot authorize UI task data, no synthetic fallback or paid dispatch',async()=>{
 const x=await nativeOwnerFixture({taskPurpose:false});try{await x.prerequisites();const r=x.readConnection();x.connection.consent(x.headers,{schemaVersion:'pansphaira.workspace-model-connection/consent/v1',expectedRevision:r.revision,identityDigest:r.identityDigest,limits:x.options.productGrant.limits,testDataDigest:nativeModelConnection.MODEL_CONNECTION_TEST_DATA_DIGEST_V1,confirm:true});assert.equal(x.readConnection().readyForInference,true);assert.throws(x.plan,/TASK_CONSENT_DENIED/);assert.throws(()=>createNativeWorkspaceAgentRunV1({sessions:x.f.sessions,contextSelection:x.f.context,dataCatalog:x.f.data,viewOwner:x.f.view,root:x.f.root,model:{...x.model}}),/AGENT_REAL_ROUTE_NOT_BOUND_DENIED/);assert.equal(x.posts(),0);
 }finally{await x.close();}
});

// Bounded truthful failure diagnosis: the existing shared 575 loop's
// closed failure result survives natively through the SAME 548 per-principal
// ledger (existing owner attachment) across start/duplicate/owner reopen.
// UNKNOWN_USAGE keeps the full held reservation; the diagnosis is a sanitized
// summary, never settled-usage or real-model acceptance proof.
const diagnosisSchemaV1='pansphaira.workspace-agent/failure-diagnosis/v1';
async function failedNativeRun(mode){const x=await nativeOwnerFixture({mode});try{await x.prerequisites();}catch(error){await x.close();throw error;}return x;}

test('548+575+565 known broker budget failure preserves exact LOOP_OUTPUT_LIMIT exit3 with measured counts through start/duplicate/reopen, full UNKNOWN hold, no proposal/save/dispatch',async()=>{
 const x=await failedNativeRun('OVERSIZED_FINAL');try{const before=x.f.view.read(x.t.headers,x.ctx()),p=x.plan(),r=await x.start(p);
 assert.equal(r.phase,'OUTCOME_UNCONFIRMED',JSON.stringify(r));assert.equal(r.proposal,null);assert.equal(r.realModelAcceptance,false);
 assert.deepEqual(r.failureDiagnosis,{schemaVersion:diagnosisSchemaV1,runId:p.runId,requestDigest:r.requestDigest,reason:'LOOP_OUTPUT_LIMIT',exitCode:3,actualRequests:2,actualToolActions:2,settledUsageConfirmed:false,realModelAcceptance:false});
 assert.equal(r.budget.model.consumedUnits,0);assert.ok(r.budget.model.committedUnits>0);
 assert.equal(validateWorkspaceAgentReadV1(JSON.parse(JSON.stringify(r)),x.t.context,nativeWorkspaceViewFieldsV1).phase,'OUTCOME_UNCONFIRMED');
 assert.deepEqual(x.f.view.read(x.t.headers,x.ctx()),before);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.t.headers)).revision,0);assert.equal(x.readConnection().checks.INFERENCE.state,'UNKNOWN_USAGE');
 const posts=x.posts();assert.equal(posts,2);assert.deepEqual(await x.start(p),r);assert.deepEqual(x.read(p),r);assert.equal(x.posts(),posts);
 x.reopen();assert.deepEqual(x.read(p),r);assert.equal(x.posts(),posts);}finally{await x.close();}
});

test('548+575+565 malformed fresh information preserves distinct LOOP_FRESH_INFORMATION_DENIED exit2 with measured counts, distinct from the budget exit3 class, held across reopen',async()=>{
 const x=await failedNativeRun('BAD_FRESH_INFORMATION');try{const p=x.plan(),r=await x.start(p);
 assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(r.proposal,null);
 assert.deepEqual(r.failureDiagnosis,{schemaVersion:diagnosisSchemaV1,runId:p.runId,requestDigest:r.requestDigest,reason:'LOOP_FRESH_INFORMATION_DENIED',exitCode:2,actualRequests:2,actualToolActions:2,settledUsageConfirmed:false,realModelAcceptance:false});
 assert.notEqual(r.failureDiagnosis.reason,'LOOP_OUTPUT_LIMIT');assert.notEqual(r.failureDiagnosis.exitCode,3);
 assert.equal(r.budget.model.consumedUnits,0);assert.ok(r.budget.model.committedUnits>0);
 const posts=x.posts();assert.equal(posts,2);x.reopen();assert.deepEqual(x.read(p),r);assert.equal(x.posts(),posts);}finally{await x.close();}
});

test('548+575+565 raw provider HTTP error maps to closed LOOP_PROVIDER_DENIED exit2 with measured 1 request and 0 tool actions; raw provider body never reaches readback',async()=>{
 const x=await failedNativeRun('RAW_ERROR');try{const p=x.plan(),r=await x.start(p);
 assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(r.proposal,null);assert.equal(x.posts(),1);
 assert.deepEqual(r.failureDiagnosis,{schemaVersion:diagnosisSchemaV1,runId:p.runId,requestDigest:r.requestDigest,reason:'LOOP_PROVIDER_DENIED',exitCode:2,actualRequests:1,actualToolActions:0,settledUsageConfirmed:false,realModelAcceptance:false});
 assert.ok(!JSON.stringify(r).includes('raw-peer-canary'));assert.equal(r.budget.model.consumedUnits,0);assert.ok(r.budget.model.committedUnits>0);assert.equal(x.readConnection().checks.INFERENCE.state,'UNKNOWN_USAGE');
 x.reopen();assert.deepEqual(x.read(p),r);assert.equal(x.posts(),1);}finally{await x.close();}
});

test('548+575+565 forged diagnosis reason/digest is minimized or denied on read, cross-owner read denied, held UNKNOWN untouched, no new dispatch',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const x=await failedNativeRun('BAD_FRESH_INFORMATION');try{const p=x.plan(),r=await x.start(p);assert.equal(r.failureDiagnosis.reason,'LOOP_FRESH_INFORMATION_DENIED');
 const root=join(x.f.root,'native-owner-ui-consumer'),directory=readdirSync(root).find(n=>n.startsWith('ui-view-run-'));assert.ok(directory);
 const db=new DatabaseSync(join(root,directory,'resource-budget.sqlite'));try{db.exec('PRAGMA busy_timeout=15000');
 db.prepare('UPDATE native_run_failure_diagnosis SET reason=?,actual_requests=NULL WHERE operation_id=?').run('forged-provider-canary',p.runId);
 const forged=x.read(p);assert.deepEqual(forged.failureDiagnosis,{schemaVersion:diagnosisSchemaV1,runId:p.runId,requestDigest:r.requestDigest,reason:'LOOP_FAILURE_UNCLASSIFIED',exitCode:2,actualRequests:null,actualToolActions:2,settledUsageConfirmed:false,realModelAcceptance:false});assert.ok(!JSON.stringify(forged).includes('forged-provider-canary'));
 db.prepare('UPDATE native_run_failure_diagnosis SET reason=?,exit_code=? WHERE operation_id=?').run('LOOP_TOOL_DENIED',3,p.runId);
 const wrongExitNonbudget=x.read(p);assert.deepEqual(wrongExitNonbudget.failureDiagnosis,{schemaVersion:diagnosisSchemaV1,runId:p.runId,requestDigest:r.requestDigest,reason:'LOOP_FAILURE_UNCLASSIFIED',exitCode:2,actualRequests:null,actualToolActions:2,settledUsageConfirmed:false,realModelAcceptance:false});assert.equal(wrongExitNonbudget.phase,'OUTCOME_UNCONFIRMED');assert.equal(wrongExitNonbudget.budget.model.consumedUnits,0);assert.ok(wrongExitNonbudget.budget.model.committedUnits>0);assert.equal(x.posts(),2);
 db.prepare('UPDATE native_run_failure_diagnosis SET reason=?,exit_code=? WHERE operation_id=?').run('LOOP_OUTPUT_LIMIT',2,p.runId);
 const wrongExitBudget=x.read(p);assert.equal(wrongExitBudget.failureDiagnosis.reason,'LOOP_FAILURE_UNCLASSIFIED');assert.equal(wrongExitBudget.failureDiagnosis.exitCode,2);assert.equal(wrongExitBudget.phase,'OUTCOME_UNCONFIRMED');assert.equal(wrongExitBudget.budget.model.consumedUnits,0);assert.ok(wrongExitBudget.budget.model.committedUnits>0);assert.equal(x.posts(),2);
 db.prepare('UPDATE native_run_failure_diagnosis SET request_digest=? WHERE operation_id=?').run('f'.repeat(64),p.runId);
 const unbound=x.read(p);assert.equal(unbound.failureDiagnosis,null);assert.equal(unbound.phase,'OUTCOME_UNCONFIRMED');assert.equal(unbound.budget.model.consumedUnits,0);assert.ok(unbound.budget.model.committedUnits>0);
 const foreign=x.f.tab(x.f.issue('synthetic:erv-reader','reader'));assert.throws(()=>x.agent.read(foreign.headers,{schemaVersion:'pansphaira.workspace-agent/read/v1',context:x.f.verification(foreign),runId:p.runId}),/AGENT_RUN_UNKNOWN_DENIED/);
 assert.equal(x.posts(),2);}finally{db.close();}
 x.reopen();assert.equal(x.read(p).failureDiagnosis,null);assert.equal(x.readConnection().checks.INFERENCE.state,'UNKNOWN_USAGE');assert.equal(x.posts(),2);}finally{await x.close();}
});

// Permanent closed-shape regression on the real native readback: the local
// validator admits only the exact code-owned reason/exit classes and denies
// contradictory or non-string classes with conversion hooks untouched. The
// expected pairs below are independent literals, not derived from the
// validator's own allowlist. Deterministic local HTTP/native only, never
// real-model or whole-issue acceptance.
test('548+575+565 closed diagnosis DTO admits exact literal reason/exit pairs, denies wrong pairs and non-string hook coercion, held reservation unchanged',async()=>{
 const x=await failedNativeRun('RAW_ERROR');try{const p=x.plan(),r=await x.start(p);const check=v=>validateWorkspaceAgentReadV1(v,x.t.context,nativeWorkspaceViewFieldsV1);
 assert.equal(check(JSON.parse(JSON.stringify(r))).failureDiagnosis.reason,'LOOP_PROVIDER_DENIED');
 const budgetExit3=['LOOP_TIME_LIMIT','LOOP_TURN_LIMIT','LOOP_TOOL_LIMIT','LOOP_REQUEST_LIMIT','LOOP_COST_LIMIT','LOOP_TOKEN_LIMIT','LOOP_INPUT_LIMIT','LOOP_OUTPUT_LIMIT'];
 const genericExit2=['LOOP_CANCELLED','LOOP_OWNER_STALE','LOOP_PROVIDER_DENIED','LOOP_TOOL_DENIED','LOOP_TOOL_RESULT_DENIED','LOOP_CALL_ID_DENIED','LOOP_FRESH_INFORMATION_DENIED','LOOP_INPUT_DENIED','LOOP_FAILURE_UNCLASSIFIED'];
 let accepted=0,denied=0;for(const reason of [...budgetExit3,...genericExit2]){const exit=budgetExit3.includes(reason)?3:2;const ok=structuredClone(r);ok.failureDiagnosis.reason=reason;ok.failureDiagnosis.exitCode=exit;assert.equal(check(ok).failureDiagnosis.reason,reason);accepted++;const wrong=structuredClone(r);wrong.failureDiagnosis.reason=reason;wrong.failureDiagnosis.exitCode=exit===3?2:3;assert.throws(()=>check(wrong),{message:'WORKSPACE_AGENT_DTO_DENIED'});denied++;}
 assert.equal(accepted,17);assert.equal(denied,17);
 let hooks=0;for(const reason of [['LOOP_PROVIDER_DENIED'],new String('LOOP_PROVIDER_DENIED'),{toString(){hooks++;return 'LOOP_PROVIDER_DENIED';},valueOf(){hooks++;return 'LOOP_PROVIDER_DENIED';}},null,42]){const v=structuredClone(r);v.failureDiagnosis.reason=reason;assert.throws(()=>check(v),{message:'WORKSPACE_AGENT_DTO_DENIED'});}assert.equal(hooks,0);
 assert.equal(r.proposal,null);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.t.headers)).revision,0);assert.equal(x.readConnection().checks.INFERENCE.state,'UNKNOWN_USAGE');assert.equal(x.posts(),1);}finally{await x.close();}
});

test('548+575+565 positive native run keeps RESULT_READY closed shape: no failure diagnosis field, validator unchanged, no diagnosis table entry',async()=>{
 const x=await failedNativeRun('OK');try{const p=x.plan(),r=await x.start(p);assert.equal(r.phase,'RESULT_READY',JSON.stringify(r));
 assert.equal(Object.hasOwn(r,'failureDiagnosis'),false);assert.equal(Object.hasOwn(x.read(p),'failureDiagnosis'),false);
 assert.equal(validateWorkspaceAgentReadV1(JSON.parse(JSON.stringify(r)),x.t.context,nativeWorkspaceViewFieldsV1).phase,'RESULT_READY');
 x.reopen();assert.equal(Object.hasOwn(x.read(p),'failureDiagnosis'),false);assert.equal(x.posts(),2);}finally{await x.close();}
});

for(const mode of ['BAD_FRESH_INFORMATION','SECRET_RETIRED_AFTER_FIRST'])test('575 native owner '+mode+' retains full COST+runtime UNKNOWN across reopen, no synthetic result or blind model retry',async()=>{
 const x=await nativeOwnerFixture({mode});try{await x.prerequisites();const p=x.plan(),r=await x.start(p);assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(r.proposal,null);assert.equal(r.realModelAcceptance,false);assert.equal(x.readConnection().checks.INFERENCE.state,'UNKNOWN_USAGE');const count=x.posts();assert.equal(count,mode==='BAD_FRESH_INFORMATION'?2:1);assert.deepEqual(await x.start(p),r);x.reopen();assert.deepEqual(x.read(p),r);assert.throws(x.plan,/TASK_CONSENT_DENIED|STALE_DENIED/);assert.equal(x.posts(),count);
 }finally{await x.close();}
});

// ---- Original574 composition admission on the SAME native565 owner/ledger.
// Controlled LOCAL framing peer only (SYNTHETIC_ONLY): never a language model
// and never relabelled as model acceptance. Exercises the actual original
// pair, the existing shared575 loop, reserve-before-dispatch, correlated
// post-result feedback, owner-derived settlement and UNKNOWN/reopen.
async function compositionOwnerFixture({mode='OK',purposes=[nativeModelConnection.MODEL_CONNECTION_COMPOSITION_PURPOSE_V1],limits={}}={}){
 const f=await nativeViewFixture546(),observations=[],sockets=new Set(),credentialFile=join(f.root,'composition-synthetic-existing-secret');let post=0;
 const compAlias=MODEL_COMPOSITION_WIRE_ALIAS_V1.binding;
 writeFileSync(credentialFile,syntheticCredential565,{mode:0o600});
 const server=createServer(async(req,res)=>{let bytes='';for await(const chunk of req)bytes+=chunk;const body=bytes?JSON.parse(bytes):null;observations.push({method:req.method,body});
  if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({data:[{id:'model:synthetic-v1'}]}));return;}
  post++;if(mode==='TIMEOUT')return;
  const results=(body.messages??[]).filter(m=>m.role==='tool');
  const erpArgs={requestId:'request:erp-cell-pan575-composition',sku:'SYN-PAN575',quantity:13};
  if(!results.length){
   // The local framing peer behaves like the real provider: it verifies and
   // echoes only the provider-safe wire names the closed composition binding
   // actually declared; native dotted identities stay owner/loop/ledger-side.
   const declared=(body.tools??[]).map(v=>v?.function?.name);observations[observations.length-1].declaredToolNames=declared;
   const wireNames=Object.values(compAlias);
   if(declared.length!==wireNames.length||declared.some((n,i)=>n!==wireNames[i]||n.includes('.'))){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:'unexpected declared wire names'}));return;}
   const calls=mode==='SWAPPED'
    ?[{id:'call_CompBb2',function:{name:compAlias['erp.order.create'],arguments:JSON.stringify(erpArgs)}},{id:'call_CompAa1',function:{name:compAlias['pan522.material.plan'],arguments:JSON.stringify(materialInput575())}}]
    :[{id:'call_CompAa1',function:{name:compAlias['pan522.material.plan'],arguments:JSON.stringify(materialInput575())}},{id:'call_CompBb2',function:{name:mode==='UNKNOWN_TOOL'?'unknown_tool_execute':compAlias['erp.order.create'],arguments:JSON.stringify(erpArgs)}}];
   res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({model:'model:synthetic-v1',choices:[{message:{content:null,tool_calls:(mode==='FIRST_ONLY'?calls.slice(0,1):calls).map(c=>({id:c.id,type:'function',function:c.function}))}}],usage:{prompt_tokens:2,completion_tokens:3}}));return;}
  const answers=results.map(m=>{const p=JSON.parse(m.content),feedback=p.feedback;return {callId:feedback.callId,challengeId:feedback.challengeId,sum:feedback.left+feedback.right};});
  if(mode==='BAD_FRESH')answers[0].sum+=1;
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({model:'model:synthetic-v1',choices:[{message:{content:JSON.stringify({schemaVersion:'pansphaira.broker-tool-feedback/final/v1',text:'Controlled synthetic composition fixture consumed two actual native readbacks; not a language model.',answers}),tool_calls:[]}}],usage:{prompt_tokens:2,completion_tokens:3}}));});
 server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const options=connectionOptions565({origin:'http://127.0.0.1:'+server.address().port},credentialFile);
 options.productGrant.allowedPurposes=purposes;options.productGrant.limits={...options.productGrant.limits,maxInputBytes:32768,...limits};
 const t=f.tab(),headers={...t.headers,'x-pan565-session':t.headers['x-pan548-session']};
 let connection=nativeModelConnection.createNativeModelConnectionV1({sessions:f.sessions,profiles:f.legacy,root:f.root,connections:[options]});
 let model=nativeModelConnection.createNativeCompositionFeedbackModelV1(connection,f.sessions.binding);
 const runId='operation:pan574-'+randomBytes(24).toString('hex');
 const prerequisites=async()=>{let r=connection.read(headers);connection.select(headers,{schemaVersion:'pansphaira.workspace-model-connection/select/v1',expectedRevision:r.revision,connectionId:options.summary.connectionId});for(const phase of ['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY']){r=connection.read(headers);await connection.probe(headers,{schemaVersion:'pansphaira.workspace-model-connection/probe/v1',expectedRevision:r.revision,identityDigest:r.identityDigest,phase});}};
 const select=()=>{const r=connection.read(headers);return connection.select(headers,{schemaVersion:'pansphaira.workspace-model-connection/select/v1',expectedRevision:r.revision,connectionId:options.summary.connectionId});};
 const prepare=(overrides={})=>nativeModelConnection.prepareNativeCompositionFeedbackV1(model,headers,{runId,expiresAtMs:Date.now()+30000,...overrides});
 const run=(a,hs=headers,confirm=true)=>nativeModelConnection.runNativeCompositionFeedbackV1(model,hs,a.ticket,{offerDigest:a.offer.offerDigest,confirm});
 const readConnection=()=>connection.read(headers);
 const holds=()=>{const dirs=readdirSync(f.root).filter(n=>n.startsWith('native-model-budget-'));return dirs.flatMap(n=>{const db=new DatabaseSync(join(f.root,n,'resource-budget.sqlite'),{readOnly:true});try{return db.prepare('SELECT operation_id,state,model_units,model_consumed,runtime_units,runtime_consumed,result_json FROM reservations').all();}finally{db.close();}});};
 return {f,t,headers,observations,options,runId,prerequisites,select,prepare,run,readConnection,holds,posts:()=>post,get connection(){return connection;},get model(){return model;},reopen(){connection.close();connection=nativeModelConnection.createNativeModelConnectionV1({sessions:f.sessions,profiles:f.legacy,root:f.root,connections:[options]});model=nativeModelConnection.createNativeCompositionFeedbackModelV1(connection,f.sessions.binding);},async close(){connection.close();server.closeAllConnections();for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));await f.close();}};
}
test('575/565 composition admission runs the actual original pair with correlated fresh feedback, settles owner-derived usage in the SAME ledger, reads back across reopen and denies copied brands',async()=>{
 const x=await compositionOwnerFixture();try{await x.prerequisites();
  const a=x.prepare();
  assert.equal(a.offer.purpose,nativeModelConnection.MODEL_CONNECTION_COMPOSITION_PURPOSE_V1);
  assert.deepEqual(a.offer.capabilities,['pan522.material.plan','erp.order.create']);
  assert.equal(a.offer.evidenceClass,'SYNTHETIC_ONLY');assert.equal(a.offer.currency,'NONE');
  assert.match(a.offer.payloadDigest,/^[a-f0-9]{64}$/);assert.equal(x.posts(),0);
  await assert.rejects(()=>nativeModelConnection.runNativeCompositionFeedbackV1(x.model,x.headers,a.ticket,{offerDigest:a.offer.offerDigest,confirm:false}),/MODEL_CONNECTION_TASK_CONSENT_DENIED/);
  assert.equal(x.posts(),0);
  const r=await x.run(a);
  assert.equal(isCompletedBrokerToolFeedbackV1(r),true,JSON.stringify(r));
  assert.equal(r.actualToolActions,2);assert.equal(r.actualRequests,2);assert.equal(r.realModelAcceptance,false);
  assert.deepEqual(r.toolReadbacks.map(v=>v.toolName),['pan522.material.plan','erp.order.create']);
  const postsObs=x.observations.filter(v=>v.method==='POST');assert.equal(postsObs.length,2);
  // The closed composition binding renames the exact pair to provider-safe
  // wire names for transport (declared tools AND assistant transcript); the
  // broker/owner/ledger identities above stay the exact dotted originals.
  assert.deepEqual(postsObs[0].body.tools.map(v=>v.function.name),['pan522_material_plan','erp_order_create']);
  assert.deepEqual(postsObs[1].body.messages.find(v=>v.role==='assistant').tool_calls.map(c=>c.function.name),['pan522_material_plan','erp_order_create']);
  // Correlated post-result feedback: tool-data carries the fresh challenge,
  // bound to the actual call id, absent from the first (pre-call) prompt body.
  const toolMsgs=postsObs[1].body.messages.filter(m=>m.role==='tool');assert.equal(toolMsgs.length,2);
  const firstPrompt=JSON.stringify(postsObs[0].body.messages);
  for(const m of toolMsgs){const p=JSON.parse(m.content);assert.equal(p.trust,'UNTRUSTED_TOOL_DATA');assert.equal(p.native.outcome,'NATIVE_READBACK');assert.equal(p.feedback.callId,m.tool_call_id);assert.equal(firstPrompt.includes(p.feedback.challengeId),false);}
  const natives=toolMsgs.map(m=>JSON.parse(m.content).native);
  assert.equal(natives[0].capabilityId,'pan522.material.plan');assert.equal(natives[0].nativeResult.outcome,'MATERIAL_PROPOSALS_ONLY');
  assert.equal(natives[1].capabilityId,'erp.order.create');assert.equal(natives[1].nativeResult.outcome,'SYNTHETIC_ORDER_READBACK_AND_ROLLBACK_VERIFIED');assert.equal(natives[1].nativeResult.beforeDigest,natives[1].nativeResult.finalDigest);assert.equal(natives[1].nativeResult.rollbackCount,1);
  // Owner-derived settlement in the same per-principal ledger: whole-run
  // reservation ceiling, consumed values measured by the loop, not claimed.
  const held=x.holds().find(h=>h.operation_id===x.runId);assert.equal(held.state,'SETTLED');assert.equal(held.model_units,50000);assert.equal(held.model_consumed,0);assert.equal(held.runtime_consumed,2);
  const p=x.readConnection();assert.equal(p.checks.INFERENCE.state,'PASS');assert.equal(p.checks.INFERENCE.reason,'SYNTHETIC_COMPOSITION_FEEDBACK_ONLY');assert.equal(p.consent,'NOT_GRANTED');assert.equal(p.realModelAcceptance,false);
  await assert.rejects(()=>x.run(a),/MODEL_CONNECTION_TASK_CONSENT_DENIED/);// one opaque ticket, consumed once
  x.reopen();const q=x.readConnection();assert.equal(q.checks.INFERENCE.reason,'SYNTHETIC_COMPOSITION_FEEDBACK_ONLY');// persisted readback
  x.select();// settled holds never block re-selection
  assert.equal(nativeModelConnection.isNativeCompositionFeedbackModelV1({...x.model},x.f.sessions.binding),false);
  assert.throws(()=>nativeModelConnection.prepareNativeWorkspaceFeedbackV1(x.model,x.headers,{runId:'operation:ui-'+'0'.repeat(48),payloadDigest:'0'.repeat(64),expiresAtMs:Date.now()+30000}),/AGENT_NATIVE_MODEL_OWNER_DENIED/);
 }finally{await x.close();}
});
test('575/565 UI/probe-only product grant cannot admit composition; composition-only grant buys no probe or UI consent; zero dispatch either way',async()=>{
 const x=await compositionOwnerFixture({purposes:['purpose:ui-connection-probe','purpose:ui-view-proposal']});try{await x.prerequisites();assert.throws(x.prepare,/MODEL_CONNECTION_TASK_CONSENT_DENIED/);assert.equal(x.posts(),0);}finally{await x.close();}
 const y=await compositionOwnerFixture();try{await y.prerequisites();
  assert.throws(()=>y.connection.consent(y.headers,{schemaVersion:'pansphaira.workspace-model-connection/consent/v1',expectedRevision:y.readConnection().revision,identityDigest:y.readConnection().identityDigest,limits:y.options.productGrant.limits,testDataDigest:nativeModelConnection.MODEL_CONNECTION_TEST_DATA_DIGEST_V1,confirm:true}),/MODEL_CONNECTION_PRODUCT_CONSENT_DENIED/);
  const uiModel=nativeModelConnection.createNativeWorkspaceFeedbackModelV1(y.connection,y.f.sessions.binding);
  assert.throws(()=>nativeModelConnection.prepareNativeWorkspaceFeedbackV1(uiModel,y.headers,{runId:'operation:ui-'+'0'.repeat(48),payloadDigest:'0'.repeat(64),expiresAtMs:Date.now()+30000}),/MODEL_CONNECTION_TASK_CONSENT_DENIED/);
  assert.equal(y.posts(),0);
 }finally{await y.close();}
});
for(const [mode,endReason,actions,requests]of[
 ['SWAPPED','LOOP_TOOL_DENIED',0,1],// wrong order denied BEFORE the first wrong native effect
 ['UNKNOWN_TOOL','LOOP_PROVIDER_DENIED',0,1],['BAD_FRESH','LOOP_FRESH_INFORMATION_DENIED',2,2],
])test('575/565 composition '+mode+' leaves the whole-run hold UNKNOWN, denies blind re-admission and blocks re-selection across reopen',async()=>{
 const x=await compositionOwnerFixture({mode});try{await x.prerequisites();const a=x.prepare(),r=await x.run(a);
  assert.equal(r.exitCode,2,JSON.stringify(r));assert.equal(r.endReason,endReason);assert.equal(r.outcome,'DENIED');
  assert.equal(r.actualToolActions,actions);assert.equal(r.actualRequests,requests);assert.equal(r.usageState,'UNKNOWN_USAGE_RETAINED');assert.equal(r.realModelAcceptance,false);
  assert.equal(isCompletedBrokerToolFeedbackV1(r),false);// a wrong order/catalog/fresh result is never a branded admitted composition
  assert.equal(isCompletedBrokerToolFeedbackV1({...r}),false);// a copied/completed-looking claim never carries the brand
  const held=x.holds().find(h=>h.operation_id===x.runId);assert.equal(held.state,'UNKNOWN_USAGE');assert.equal(held.model_units,50000);assert.equal(held.model_consumed,0);assert.equal(held.runtime_units,3);assert.equal(held.runtime_consumed,0);
  const p=x.readConnection();assert.equal(p.checks.INFERENCE.state,'UNKNOWN_USAGE');assert.equal(p.consent,'NOT_GRANTED');assert.equal(p.realModelAcceptance,false);
  assert.throws(x.prepare,/MODEL_CONNECTION_TASK_CONSENT_DENIED/);// retained operation blocks blind retry
  const count=x.posts();x.reopen();assert.throws(x.select,/MODEL_CONNECTION_UNKNOWN_USAGE_RETAINED/);assert.equal(x.posts(),count);
  // Only the owner-derived reconciliation path releases the synthetic hold.
  x.connection.reconcile(x.headers,{operationId:x.runId,identityDigest:x.readConnection().identityDigest});
  const settled=x.holds().find(h=>h.operation_id===x.runId);assert.equal(settled.state,'SETTLED');assert.equal(settled.model_units,50000);assert.equal(settled.model_consumed,0);assert.equal(settled.runtime_consumed,settled.runtime_units);assert.equal(x.posts(),count);
  // The reconciliation reason is inspected BEFORE re-selection clears checks.
  const rec=x.readConnection();assert.equal(rec.checks.INFERENCE.state,'FAILED');assert.equal(rec.checks.INFERENCE.reason,'SYNTHETIC_ZERO_PRICE_RECONCILED_NO_MODEL_PASS');assert.equal(rec.consent,'NOT_GRANTED');assert.equal(rec.realModelAcceptance,false);
  x.select();const cleared=x.readConnection();assert.equal(cleared.checks.INFERENCE.state,'NOT_RUN');assert.equal(cleared.checks.INFERENCE.reason,'NOT_EXECUTED');assert.equal(x.posts(),count);
 }finally{await x.close();}
});
test('575/565 composition admission denies session, revision, credential/expiry drift with zero new dispatch and still admits a fresh consented run',async()=>{
 const x=await compositionOwnerFixture();try{await x.prerequisites();
  const a=x.prepare();x.select();// revision bump invalidates the unstarted offer
  await assert.rejects(()=>x.run(a),/MODEL_CONNECTION_STALE_DENIED/);assert.equal(x.posts(),0);
  await x.prerequisites();const b=x.prepare();chmodSync(join(x.f.root,'composition-synthetic-existing-secret'),0o644);
  await assert.rejects(()=>x.run(b),/MODEL_CONNECTION_STALE_DENIED/);assert.equal(x.posts(),0);chmodSync(join(x.f.root,'composition-synthetic-existing-secret'),0o600);
  await x.prerequisites();const e=x.prepare({expiresAtMs:Date.now()+120});await new Promise(r=>setTimeout(r,200));
  await assert.rejects(()=>x.run(e),/MODEL_CONNECTION_TASK_CONSENT_DENIED/);assert.equal(x.posts(),0);// offer expiry drift, never a stale admission
  await x.prerequisites();const c=x.prepare();
  const foreignTab=x.f.tab();// a genuinely fresh foreign browser session with its own pan565 header
  const foreign={...foreignTab.headers,'x-pan565-session':foreignTab.headers['x-pan548-session']};
  assert.notEqual(foreign['x-pan565-session'],x.headers['x-pan565-session']);
  await assert.rejects(()=>x.run(c,foreign),/MODEL_CONNECTION_STALE_DENIED/);assert.equal(x.posts(),0);
  const r=await x.run(c);assert.equal(isCompletedBrokerToolFeedbackV1(r),true,JSON.stringify(r));assert.equal(r.actualToolActions,2);assert.equal(r.actualRequests,2);assert.equal(x.posts(),2);
 }finally{await x.close();}
});
test('575/565 composition timeout returns the closed exit3 LOOP_TIME_LIMIT result, keeps the exact whole-run reservation and does not retry blindly',async()=>{
 const x=await compositionOwnerFixture({mode:'TIMEOUT',limits:{maxTimeMs:300}});try{await x.prerequisites();const a=x.prepare();
  const r=await x.run(a);// the shared loop RETURNS its closed budget result, it does not throw
  assert.equal(r.exitCode,3,JSON.stringify(r));assert.equal(r.endReason,'LOOP_TIME_LIMIT');assert.equal(r.outcome,'BUDGET_ABORTED');
  assert.equal(r.usageState,'UNKNOWN_USAGE_RETAINED');assert.equal(r.actualRequests,1);assert.equal(r.actualToolActions,0);assert.equal(r.realModelAcceptance,false);
  assert.equal(isCompletedBrokerToolFeedbackV1(r),false);
  const held=x.holds().find(h=>h.operation_id===x.runId);assert.equal(held.state,'UNKNOWN_USAGE');assert.equal(held.model_units,50000);assert.equal(held.model_consumed,0);assert.equal(held.runtime_units,3);assert.equal(held.runtime_consumed,0);
  const p=x.readConnection();assert.equal(p.checks.INFERENCE.state,'UNKNOWN_USAGE');assert.equal(p.consent,'NOT_GRANTED');
  assert.equal(x.posts(),1);// no blind model retry after the time-limit return
  assert.throws(x.prepare,/MODEL_CONNECTION_TASK_CONSENT_DENIED/);assert.equal(x.posts(),1);
 }finally{await x.close();}
});
test('575/565 composition FIRST_ONLY genuine shared-loop completion after only the first tool never escapes as an admitted completed composition',async()=>{
 // Actual one-tool run with a fresh valid final (real loop, no forged
 // callback): the shared loop returns a genuine completed RESULT_READY, the
 // composition owner must answer with the existing closed denial instead of
 // the completed brand, keep the whole hold UNKNOWN and never retry blindly.
 const x=await compositionOwnerFixture({mode:'FIRST_ONLY'});try{await x.prerequisites();const a=x.prepare(),r=await x.run(a);
  assert.equal(isCompletedBrokerToolFeedbackV1(r),false,JSON.stringify(r));
  assert.equal(r.exitCode,2,JSON.stringify(r));assert.equal(r.outcome,'DENIED');assert.equal(r.endReason,'LOOP_FRESH_INFORMATION_DENIED');
  assert.equal(r.usageState,'UNKNOWN_USAGE_RETAINED');assert.equal(r.actualToolActions,1);assert.equal(r.actualRequests,2);assert.equal(r.realModelAcceptance,false);assert.equal(r.toolReadbacks.length,0);
  const held=x.holds().find(h=>h.operation_id===x.runId);assert.equal(held.state,'UNKNOWN_USAGE');assert.equal(held.model_units,50000);assert.equal(held.model_consumed,0);assert.equal(held.runtime_units,3);assert.equal(held.runtime_consumed,0);assert.equal(held.result_json,null);
  const p=x.readConnection();assert.equal(p.checks.INFERENCE.state,'UNKNOWN_USAGE');assert.equal(p.consent,'NOT_GRANTED');assert.equal(p.realModelAcceptance,false);
  assert.equal(x.posts(),2);// the two actual wire requests only, no blind model retry
  assert.throws(x.prepare,/MODEL_CONNECTION_TASK_CONSENT_DENIED/);// retained UNKNOWN operation blocks blind re-admission
  x.reopen();assert.throws(x.select,/MODEL_CONNECTION_UNKNOWN_USAGE_RETAINED/);assert.equal(x.posts(),2);
 }finally{await x.close();}
 // The full original pair remains the admitted success path in the SAME ledger.
 const y=await compositionOwnerFixture();try{await y.prerequisites();const b=y.prepare(),ok=await y.run(b);
  assert.equal(isCompletedBrokerToolFeedbackV1(ok),true,JSON.stringify(ok));assert.equal(ok.actualToolActions,2);assert.equal(ok.actualRequests,2);
  assert.deepEqual(ok.toolReadbacks.map(v=>v.toolName),['pan522.material.plan','erp.order.create']);
  assert.equal(y.holds().find(h=>h.operation_id===y.runId).state,'SETTLED');assert.equal(y.posts(),2);
 }finally{await y.close();}
 // A reversed order is still denied BEFORE the first wrong native effect.
 const z=await compositionOwnerFixture({mode:'SWAPPED'});try{await z.prerequisites();const c=z.prepare(),no=await z.run(c);
  assert.equal(no.exitCode,2);assert.equal(no.endReason,'LOOP_TOOL_DENIED');assert.equal(no.actualToolActions,0);assert.equal(isCompletedBrokerToolFeedbackV1(no),false);
  assert.equal(z.holds().find(h=>h.operation_id===z.runId).state,'UNKNOWN_USAGE');
 }finally{await z.close();}
});
test('575/565 composition closed prepare/confirmation schema and opaque UI/composition ticket+brand isolation deny forged or extra input with zero dispatch',async()=>{
 const x=await compositionOwnerFixture({purposes:['purpose:ui-view-proposal',nativeModelConnection.MODEL_CONNECTION_COMPOSITION_PURPOSE_V1]});try{await x.prerequisites();
  // Closed prepare payload: no catalog, purpose, callback or other extra key
  // and no missing key. The closed exact() schema rejects every malformed
  // closed prepare with the literal MODEL_CONNECTION_INPUT_DENIED.
  for(const value of [{runId:x.runId,expiresAtMs:Date.now()+30000,catalog:['erp.order.create']},{runId:x.runId,expiresAtMs:Date.now()+30000,purpose:nativeModelConnection.MODEL_CONNECTION_COMPOSITION_PURPOSE_V1},{runId:x.runId,expiresAtMs:Date.now()+30000,prepareCallback:()=>true},{runId:x.runId}])
   assert.throws(()=>nativeModelConnection.prepareNativeCompositionFeedbackV1(x.model,x.headers,value),{message:'MODEL_CONNECTION_INPUT_DENIED'});
  assert.equal(x.posts(),0);
  const a=x.prepare();
  const uiModel=nativeModelConnection.createNativeWorkspaceFeedbackModelV1(x.connection,x.f.sessions.binding);
  const uiA=nativeModelConnection.prepareNativeWorkspaceFeedbackV1(uiModel,x.headers,{runId:'operation:ui-'+'0'.repeat(48),payloadDigest:'0'.repeat(64),expiresAtMs:Date.now()+30000});
  assert.notEqual(uiA.ticket,a.ticket);// separate opaque ticket brands
  await assert.rejects(()=>nativeModelConnection.runNativeCompositionFeedbackV1(x.model,x.headers,uiA.ticket,{offerDigest:a.offer.offerDigest,confirm:true}),/MODEL_CONNECTION_TASK_CONSENT_DENIED/);
  await assert.rejects(()=>nativeModelConnection.runNativeWorkspaceFeedbackV1(uiModel,x.headers,a.ticket,{offerDigest:a.offer.offerDigest,confirm:true},()=>assert.fail('foreign ticket must never execute'),()=>true),/MODEL_CONNECTION_TASK_CONSENT_DENIED/);
  assert.equal(x.posts(),0);
  // Per-case closed confirmation schema: absent or extra keys are malformed
  // closed input (literal MODEL_CONNECTION_INPUT_DENIED); a well-shaped wrong
  // digest or a non-true confirmation is a task-consent denial.
  for(const conf of [{offerDigest:a.offer.offerDigest},{offerDigest:a.offer.offerDigest,confirm:true,confirmTask:true}])
   await assert.rejects(()=>nativeModelConnection.runNativeCompositionFeedbackV1(x.model,x.headers,a.ticket,conf),{message:'MODEL_CONNECTION_INPUT_DENIED'});
  for(const conf of [{offerDigest:'0'.repeat(64),confirm:true},{offerDigest:a.offer.offerDigest,confirm:'true'}])
   await assert.rejects(()=>nativeModelConnection.runNativeCompositionFeedbackV1(x.model,x.headers,a.ticket,conf),{message:'MODEL_CONNECTION_TASK_CONSENT_DENIED'});
  assert.equal(x.posts(),0);
  const r=await x.run(a);// the one genuine ticket still admits the actual pair run
  assert.equal(isCompletedBrokerToolFeedbackV1(r),true,JSON.stringify(r));assert.equal(r.actualToolActions,2);assert.equal(r.actualRequests,2);assert.equal(x.posts(),2);
 }finally{await x.close();}
});
// RUN103: the 548 edge of the disclosure. When a genuine UI TASK run retains
// the full UNKNOWN_USAGE hold, the same closed connection readback names the
// exact operation:ui-run and marks the code-owned synthetic route reconcilable.
// The existing owner reconciliation settles the cost hold to zero without any
// provider retry; the spent request slots stay spent (no budget reset through
// reconciliation), so the next plan honestly denies with BUDGET_EXHAUSTED and
// dispatches nothing.
test('548+575+565 retained UI-task hold discloses its exact run id in the connection readback; owner reconciliation zeroes the cost hold without retry while the spent request slots keep the next plan honestly BUDGET_EXHAUSTED',async()=>{
 const x=await failedNativeRun('OVERSIZED_FINAL');try{
  const p=x.plan(),r=await x.start(p);assert.equal(r.phase,'OUTCOME_UNCONFIRMED',JSON.stringify(r));
  const held=x.readConnection();
  assert.equal(held.checks.INFERENCE.state,'UNKNOWN_USAGE');
  assert.deepEqual(held.unknownUsage,{operationId:p.runId,reconcilable:true},'PAN575_UI_RUN_HOLD_NOT_DISCLOSED');
  assert.match(held.unknownUsage.operationId,/^operation:ui-[a-f0-9]{48}$/);
  const posts=x.posts();assert.equal(posts,2,'PAN575_TWO_GENUINE_LOOP_REQUESTS_BEFORE_HOLD');
  const after=x.connection.reconcile(x.headers,{operationId:held.unknownUsage.operationId,identityDigest:held.identityDigest});
  assert.equal(after.unknownUsage,null,'PAN575_UI_HOLD_STILL_DISCLOSED_AFTER_RECONCILIATION');
  assert.equal(after.checks.INFERENCE.state,'FAILED');assert.equal(after.checks.INFERENCE.reason,'SYNTHETIC_ZERO_PRICE_RECONCILED_NO_MODEL_PASS');
  assert.equal(after.realModelAcceptance,false);
  assert.equal(x.posts(),posts,'PAN575_RECONCILIATION_RETRIED_PROVIDER');
  // Honest continuation: the settled attempt keeps its reserved request slots;
  // reconciliation zeroes the cost claim, it never refunds the aggregate budget.
  await x.prerequisites();
  const drained=x.readConnection();
  assert.equal(drained.unknownUsage,null);assert.equal(drained.reason,'BUDGET_EXHAUSTED');assert.equal(drained.inferenceOffer,null);
  assert.throws(x.plan,/MODEL_CONNECTION_BUDGET_EXHAUSTED/);
  assert.equal(x.posts(),posts,'PAN575_DRAINED_PLAN_DISPATCHED_ANYWAY');
 }finally{await x.close();}
});
