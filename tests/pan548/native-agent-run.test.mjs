import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {nativeViewFixture546} from '../pan546/native-fixture.mjs';
import {connectionOptions565,syntheticCredential565} from '../pan565/native-fixture.mjs';
import * as nativeModelConnection from '../../src/pan565/native-model-connection.mjs';
import {MODEL_UI_WIRE_ALIAS_V1} from '../../src/pan565/connection-transport.mjs';
import {syntheticModelAccessPolicyV1} from '../../dist/packages/contracts/src/model-access-broker.js';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {validateWorkspaceAgentReadV1,validateWorkspaceAgentPlanV1} from '../../dist/packages/contracts/src/workspace-agent-run-v1.js';
import {nativeWorkspaceViewFieldsV1} from '../../src/pan546/native-data-catalog.mjs';
async function fixture(change=()=>{}){
 const {createNativeWorkspaceAgentRunV1}=await import('../../src/pan548/native-agent-run.mjs');
 const f=await nativeViewFixture546(),root=mkdtempSync(join(tmpdir(),'pan548-owned-native-run-'));
 const policy=syntheticModelAccessPolicyV1('OPENAI_RESPONSES');policy.routes[0].allowedTenants=['tenant:tenant-a'];policy.routes[0].allowedPurposes=['purpose:ui-view-proposal'];policy.routes[0].optionalFields=['reasoning','store'];policy.routes[0].attachmentMediaTypes=[];policy.workloadIdentities=['workload:ui-view-assistant'];policy.userIdentities=['user:workspace-personal-view'];policy.maxBudget.maxRequests=2;
 let calls=0;const model={mode:'SYNTHETIC_PROBE_ONLY',policy,providerCall:async(request,signal)=>{calls++;assert.equal(request.request.reasoning.effort,'max');assert.equal(request.request.store,false);assert.equal(signal.aborted,false);return {contentType:'text/plain',text:calls%2===1?'Nur Vorschlag, keine Speicherung.':'Native Vorschau geprüft; getrennte Bestätigung bleibt erforderlich.',toolCalls:calls%2===1?[{id:'tool:resize-001',name:'ui.view.propose',arguments:{schemaVersion:'pansphaira.workspace-module-view/delta/v1',operations:[{kind:'RESIZE',instanceId:'invoice-value',size:'large'}]}}]:[],usage:{inputTokens:2,outputTokens:2,costMicros:0}};}};
 change(model);const create=()=>createNativeWorkspaceAgentRunV1({sessions:f.sessions,contextSelection:f.context,dataCatalog:f.data,viewOwner:f.view,root,model});let owner=create();
 function tab(){const t=f.tab();const c=t.context;t.context=f.context.claim(t.headers,{schemaVersion:'pansphaira.workspace-context/claim/v1',tabId:c.binding.tabId,moduleId:c.moduleId,viewId:c.viewId,primaryObjectId:c.primaryObject.objectId,selection:{elementId:'pan.erv.module-card',rowId:'invoice-value'},expected:{...c.revisions,epoch:c.binding.epoch}}).context;return t;}
 const t=tab(),ctx=()=>f.verification(t),plan=text=>owner.plan(t.headers,{schemaVersion:'pansphaira.workspace-agent/plan/v1',context:ctx(),text}),start=p=>owner.start(t.headers,{schemaVersion:'pansphaira.workspace-agent/start/v1',context:ctx(),planHandle:p.planHandle,planDigest:p.planDigest}),read=p=>owner.read(t.headers,{schemaVersion:'pansphaira.workspace-agent/read/v1',context:ctx(),runId:p.runId});
 return {f,t,root,model,ctx,plan,start,read,get owner(){return owner;},calls:()=>calls,reopen(){owner.close();owner=create();},async close(){owner.close();await f.close();rmSync(root,{recursive:true,force:true});}};
}
test('PAN548_NATIVE_UI_RUN_ONE_REAL_SOURCE_BOUND_TOOL_PROPOSAL_TWO_BROKER_PHASES_NO_VIEW_WRITE',async()=>{const x=await fixture();try{const before=x.f.view.read(x.t.headers,x.ctx()),p=x.plan('Rechnungswert größer darstellen, nur Vorschlag.');assert.equal(p.phase,'PLANNED_NOT_DISPATCHED');assert.equal(x.calls(),0);const result=await x.start(p);assert.equal(result.phase,'RESULT_READY');assert.equal(result.modelMode,'SYNTHETIC_PROBE_ONLY');assert.equal(result.realModelAcceptance,false);assert.equal(x.calls(),2);assert.equal(result.binding.subjectId,x.t.context.binding.subjectId);assert.equal(result.sourceDigest,x.f.data.metadata(x.t.headers,x.ctx()).sourceDigest);assert.equal(result.proposal.beforeDigest,before.viewDigest);assert.equal(result.proposal.afterView.instances.find(i=>i.instanceId==='invoice-value').size,'large');assert.equal(result.personalViewPersistenceProduced,false);assert.equal(result.businessEffectProduced,false);assert.deepEqual(x.f.view.read(x.t.headers,x.ctx()),before);assert.deepEqual(x.read(p),result);assert.equal(result.operations.cancel.available,false);assert.equal(result.operations.resume.available,false);assert.equal(result.budget.runtime.consumedUnits,2);}finally{await x.close();}});
test('PAN548_NATIVE_EXACT_SAME_KEY_DUPLICATE_AND_FRESH_NATIVE_PROCESS_CONNECTION_READBACK_NEVER_NEW_DISPATCH',async()=>{const x=await fixture();try{const p=x.plan('Nur Rechnungswert größer.');const [a,b]=await Promise.all([x.start(p),x.start(p)]);assert.deepEqual(a,b);assert.equal(x.calls(),2);x.reopen();assert.deepEqual(x.read(p),a);assert.equal(x.calls(),2);}finally{await x.close();}});
test('PAN548_NATIVE_UNKNOWN_AFTER_PROVIDER_ATTEMPT_REOPEN_HELD_NO_BLIND_REPLAY_OR_FAKE_RESUME',async()=>{const x=await fixture(m=>{m.providerCall=async()=>{throw Error('genuine owner callback failed after dispatch fence');};});try{const p=x.plan('Nur Rechnungswert größer.');const r=await x.start(p);assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(r.proposal,null);assert.ok(r.budget.model.committedUnits>0);x.reopen();const after=x.read(p);assert.equal(after.phase,'OUTCOME_UNCONFIRMED');assert.equal(after.budget.model.committedUnits,r.budget.model.committedUnits);assert.equal(after.operations.resume.available,false);}finally{await x.close();}});
test('PAN548_NATIVE_STALE_CONTEXT_BEFORE_DISPATCH_AND_REVOKE_DURING_PROVIDER_NO_LATE_APPLY',async()=>{let entered,release;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});const x=await fixture(m=>{const original=m.providerCall;m.providerCall=async(...args)=>{entered();await gate;return original(...args);};});try{const p=x.plan('Nur Rechnungswert größer.');const running=x.start(p);await started;x.f.context.retire(x.t.headers,x.ctx());release();const r=await running;assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(r.proposal,null);assert.equal(x.calls(),1);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.t.headers)).revision,0);assert.ok(r.budget.model.committedUnits>0);}finally{release();await x.close();}});
test('PAN548_NATIVE_MODEL_FREE_HANDLE_ROLE_CROSS_TENANT_SCHEMA_AND_OWNER_CAPABILITY_DENIED',async()=>{const x=await fixture();try{const p=x.plan('Nur Rechnungswert größer.');await assert.rejects(x.owner.start(x.t.headers,{schemaVersion:'pansphaira.workspace-agent/start/v1',context:x.ctx(),planHandle:p.planHandle,planDigest:p.planDigest,role:'admin'}),/AGENT_.*DENIED/);await assert.rejects(x.owner.start(x.t.headers,{schemaVersion:'pansphaira.workspace-agent/start/v0',context:x.ctx(),planHandle:p.planHandle,planDigest:p.planDigest}),/AGENT_.*DENIED/);await assert.rejects(x.owner.start({...x.t.headers,'x-pan548-tab':'0'.repeat(64)},{schemaVersion:'pansphaira.workspace-agent/start/v1',context:x.ctx(),planHandle:p.planHandle,planDigest:p.planDigest}),/CONTEXT_TAB_DENIED/);assert.throws(()=>x.owner.plan(x.t.headers,{schemaVersion:'pansphaira.workspace-agent/plan/v1',context:x.ctx(),text:'Only view',model:'caller-model'}),/AGENT_.*DENIED/);assert.equal(x.calls(),0);assert.equal(typeof x.owner.settle,'undefined');assert.equal(typeof x.owner.activate,'undefined');}finally{await x.close();}});
test('PAN548_NATIVE_MODEL_FOREIGN_TOOL_AND_AUTHORITY_ARGUMENTS_NEVER_VIEW_OR_FACH_EFFECT',async()=>{const x=await fixture(m=>{m.providerCall=async()=>({contentType:'text/plain',text:'untrusted proposal',toolCalls:[{id:'tool:unsafe-001',name:'ui.view.propose',arguments:{schemaVersion:'pansphaira.workspace-module-view/delta/v1',operations:[{kind:'SHOW',instanceId:'invoice-value',visible:false}],authority:'admin'}}],usage:{inputTokens:2,outputTokens:2,costMicros:0}});});try{const p=x.plan('Nur Rechnungswert größer.');const r=await x.start(p);assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(r.proposal,null);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.t.headers)).revision,0);}finally{await x.close();}});
test('PAN548_NATIVE_NONMODAL_SELECTION_NULL_CLARIFY_AND_CREDENTIAL_OR_ACCESSOR_INPUT_NO_DISPATCH',async()=>{const x=await fixture();try{const t=x.f.tab();assert.throws(()=>x.owner.plan(t.headers,{schemaVersion:'pansphaira.workspace-agent/plan/v1',context:x.f.verification(t),text:'Mach größer.'}),/AGENT_SELECTION_CLARIFY_REQUIRED/);let reads=0;const value={schemaVersion:'pansphaira.workspace-agent/plan/v1',context:x.ctx()};Object.defineProperty(value,'text',{enumerable:true,get(){reads++;return 'unsafe';}});assert.throws(()=>x.owner.plan(x.t.headers,value),/AGENT_.*DENIED/);assert.equal(reads,0);assert.throws(()=>x.plan('api_key='+'sk'+'-aaaaaaaaaaaaaaaaaaaaaaaaaaaa'),/AGENT_.*DENIED/);assert.equal(x.calls(),0);}finally{await x.close();}});
test('PAN548_NATIVE_REAL_SETTLEMENT_SQLITE_WAIT_PAST_ACTUAL_LEASE_RETAINS_FULL_UNKNOWN_USAGE_NO_LATE_RESULT', {timeout:90000}, async()=>{
 const {Worker}=await import('node:worker_threads'),{DatabaseSync}=await import('node:sqlite'),{readdirSync}=await import('node:fs');let x,p,worker,lockedAt;
 x=await fixture(m=>{const original=m.providerCall;m.providerCall=async(...args)=>{const result=await original(...args);if(result.toolCalls.length===0){const directory=readdirSync(x.root).find(n=>n.startsWith('ui-view-run-'));assert.ok(directory);const database=join(x.root,directory,'resource-budget.sqlite');worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(workerData.database);db.exec('PRAGMA busy_timeout=15000; BEGIN IMMEDIATE');parentPort.postMessage({kind:'LOCKED',at:Date.now()});setTimeout(()=>{db.exec('ROLLBACK');db.close();parentPort.postMessage({kind:'RELEASED',at:Date.now()});parentPort.close();},Math.max(0,workerData.releaseAt-Date.now()));`,{eval:true,workerData:{database,releaseAt:p.expiresAtMs+200}});const message=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});assert.equal(message.kind,'LOCKED');lockedAt=message.at;assert.ok(lockedAt<p.expiresAtMs,'Genuine SQLite write lock must begin before actual native lease expiry, not fake clock or expired start');}return result;};});
 try{p=x.plan('Nur native persönliche View größer; Abschluss während echter Lease-Verwerfung prüfen.');await new Promise(resolve=>setTimeout(resolve,Math.max(0,p.expiresAtMs-Date.now()-1800)));const result=await x.start(p);assert.ok(Date.now()>p.expiresAtMs,'Actual unchanged native 60000ms lease expires during real SQLite writer wait');assert.equal(result.phase,'OUTCOME_UNCONFIRMED','NATIVE_SETTLEMENT_MUST_REVERIFY_AFTER_SQLITE_WAIT_BEFORE_RELEASE_OR_RESULT_READY');assert.equal(result.proposal,null);assert.equal(x.calls(),2);assert.equal(result.budget.model.committedUnits,x.model.policy.maxBudget.maxTokens*4);assert.equal(result.budget.model.consumedUnits,0);assert.equal(result.budget.runtime.committedUnits,2);const directory=readdirSync(x.root).find(n=>n.startsWith('ui-view-run-')),db=new DatabaseSync(join(x.root,directory,'resource-budget.sqlite'),{readOnly:true});try{const row=db.prepare('SELECT state,result_json,completion FROM reservations WHERE operation_id=?').get(p.runId);assert.equal(row.state,'UNKNOWN_USAGE');assert.equal(row.result_json,null);assert.equal(row.completion,null);}finally{db.close();}x.f.fresh(x.t);x.reopen();const read=x.read(p);assert.equal(read.phase,'OUTCOME_UNCONFIRMED');assert.equal(read.budget.model.committedUnits,result.budget.model.committedUnits);assert.equal(x.calls(),2);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.t.headers)).revision,0);console.log(JSON.stringify({actualSettlementLockBeforeLeaseExpiry:lockedAt,actualLeaseExpiresAt:p.expiresAtMs,actualReadAfterWait:Date.now(),unknownNativeUsageHeld:true,realModelAcceptance:false}));}finally{await worker?.terminate();await x.close();}
});
test('PAN548_NATIVE_VIEW_COMMIT_IS_ONLY_EXISTING546_CONFIRM_CAS_READBACK_UNDO_NOT_MODEL_TASK_SETTLEMENT',async()=>{const x=await fixture();try{const p=x.plan('Nur Rechnungswert größer.');const result=await x.start(p);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.t.headers)).revision,0);const preview=x.f.view.preview(x.t.headers,{schemaVersion:'pansphaira.workspace-module-view/preview/v1',context:x.ctx(),delta:result.proposal.delta});const receipt=x.f.view.confirm(x.t.headers,x.f.confirmation(x.t,preview));assert.equal(receipt.outcome,'VIEW_PERSISTED');x.f.fresh(x.t);const read=x.f.view.read(x.t.headers,x.ctx());assert.equal(read.viewDigest,preview.afterDigest);assert.equal(read.revision,1);const undo=x.f.view.previewUndo(x.t.headers,{schemaVersion:'pansphaira.workspace-module-view/undo-preview/v1',context:x.ctx(),targetRevision:0});assert.equal(x.f.view.confirm(x.t.headers,x.f.confirmation(x.t,undo)).revision,2);assert.equal(x.calls(),2);}finally{await x.close();}});
// RUN47: source-bound UNKNOWN provenance on the SAME native ledger. Helper:
// genuine provider failure after the dispatch fence, plus the retained ledger
// file for exact-row assertions and synthetic corruption in test 3 only.
// RUN48: the replacing callback bypasses the fixture's own calls counter (that
// counter lives INSIDE the original callback), so genuine failed provider
// attempts are counted explicitly here — incremented before the throw — and
// exposed as a separate observer. Every exactly-once assertion below uses this
// observer, never the bypassed fixture counter and never a weakened zero.
async function unknownProvenanceFixture(){let failedAttempts=0;const x=await fixture(m=>{m.providerCall=async()=>{failedAttempts++;throw Error('genuine owner callback failed after dispatch fence');};});const p=x.plan('Nur Rechnungswert größer.');const r=await x.start(p);return {x,p,r,failedAttempts:()=>failedAttempts};}
function provenanceRow(x,runId){const directory=readdirSync(x.root).find(n=>n.startsWith('ui-view-run-'));assert.ok(directory);const db=new DatabaseSync(join(x.root,directory,'resource-budget.sqlite'),{readOnly:true});try{return db.prepare('SELECT operation_id,request_digest,provenance_json,provenance_digest FROM native_run_provenance WHERE operation_id=?').get(runId);}finally{db.close();}}
function assertUnknownHoldMinimized(after,r,expectedBinding,expectedSourceDigest,expectedSourceRevisions){assert.equal(after.phase,'OUTCOME_UNCONFIRMED');assert.deepEqual(after.binding,expectedBinding);assert.equal(after.sourceDigest,expectedSourceDigest);assert.deepEqual(after.sourceRevisions,expectedSourceRevisions);assert.equal(after.proposal,null);assert.equal(after.personalViewPersistenceProduced,false);assert.equal(after.businessEffectProduced,false);assert.equal(after.executionAuthorityGranted,false);assert.equal(after.realModelAcceptance,false);assert.equal(after.operations.cancel.available,false);assert.equal(after.operations.resume.available,false);assert.equal(after.budget.model.committedUnits,r.budget.model.committedUnits);assert.equal(after.budget.model.consumedUnits,0);assert.equal(after.budget.runtime.committedUnits,r.budget.runtime.committedUnits);assert.equal(after.budget.runtime.consumedUnits,0);}
test('PAN548_NATIVE_UNKNOWN_UNCONSUMED_OR_MALFORMED_PROVENANCE_ROW_NEVER_MANUFACTURES_VALID_BINDING_OR_REPLAY',async()=>{const {x,p,r,failedAttempts}=await unknownProvenanceFixture();try{assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(failedAttempts(),1);const retained=provenanceRow(x,p.runId);assert.equal(retained.request_digest,r.requestDigest);assert.ok(!retained.provenance_json.includes('Rechnungswert'),'retained provenance carries no user text');assert.ok(!retained.provenance_json.includes('task-plan'),'retained provenance carries no caller plan handle');assert.ok(!/sk-[A-Za-z0-9_-]{12,}/.test(retained.provenance_json));const corrupt=(sql)=>{const directory=readdirSync(x.root).find(n=>n.startsWith('ui-view-run-'));const db=new DatabaseSync(join(x.root,directory,'resource-budget.sqlite'));try{db.exec(sql);}finally{db.close();}};
 // legacy row without any provenance record
 corrupt(`DELETE FROM native_run_provenance WHERE operation_id='${p.runId}'`);x.reopen();const legacyRead=x.read(p);assertUnknownHoldMinimized(legacyRead,r,null,null,null);assert.equal(failedAttempts(),1);
 // corrupted non-JSON retained envelope
 corrupt(`INSERT OR REPLACE INTO native_run_provenance VALUES('${p.runId}','${r.requestDigest}','{zerrissen','${'0'.repeat(64)}')`);x.reopen();assertUnknownHoldMinimized(x.read(p),r,null,null,null);assert.equal(failedAttempts(),1);
 // digest mismatch: well-formed retained envelope does not match its own digest
 const validEnvelope=canonicalJson({schemaVersion:'pansphaira.workspace-agent/run-provenance/v1',binding:{audience:'x'},sourceDigest:'f'.repeat(64),sourceRevisions:{erv:0,human:0}});assert.ok(!validEnvelope.includes("'"));corrupt(`UPDATE native_run_provenance SET provenance_json='${validEnvelope}',provenance_digest='${'1'.repeat(64)}' WHERE operation_id='${p.runId}'`);x.reopen();assertUnknownHoldMinimized(x.read(p),r,null,null,null);assert.equal(failedAttempts(),1);
 // RUN48: self-rehashed malformed closed field shapes. The attacker correctly
 // recomputed the digest over garbage, so digest self-consistency alone must
 // NOT project any raw field; each case restores the exact request_digest and
 // minimizes to the all-null historical triple under the unchanged UNKNOWN hold.
 const sha256Hex=v=>createHash('sha256').update(canonicalJson(v)).digest('hex');const provenanceSchemaLiteral='pansphaira.workspace-agent/run-provenance/v1';
 const rehash=envelope=>{const encoded=canonicalJson(envelope);assert.ok(!encoded.includes(String.fromCharCode(39)));corrupt(`UPDATE native_run_provenance SET request_digest='${r.requestDigest}',provenance_json='${encoded}',provenance_digest='${sha256Hex(envelope)}' WHERE operation_id='${p.runId}'`);};
 for(const malformed of [
  {schemaVersion:provenanceSchemaLiteral,binding:{injected:'not-an-admitted-binding'},sourceDigest:'not-a-sha256',sourceRevisions:{}},
  {schemaVersion:provenanceSchemaLiteral,binding:p.binding,sourceDigest:null,sourceRevisions:p.sourceRevisions},
  {schemaVersion:provenanceSchemaLiteral,binding:p.binding,sourceDigest:p.sourceDigest,sourceRevisions:null},
  {schemaVersion:provenanceSchemaLiteral,binding:{...p.binding,tenantId:'tenant-foreign',subjectId:'subject-foreign'},sourceDigest:p.sourceDigest,sourceRevisions:p.sourceRevisions},
  {schemaVersion:provenanceSchemaLiteral,binding:{...p.binding,role:'admin'},sourceDigest:p.sourceDigest,sourceRevisions:p.sourceRevisions},
  {schemaVersion:provenanceSchemaLiteral,binding:p.binding,sourceDigest:'F'.repeat(64),sourceRevisions:p.sourceRevisions},
  {schemaVersion:provenanceSchemaLiteral,binding:p.binding,sourceDigest:p.sourceDigest,sourceRevisions:{erv:-1,human:0}},
  {schemaVersion:provenanceSchemaLiteral,binding:p.binding,sourceDigest:p.sourceDigest,sourceRevisions:{erv:0,human:0,extra:1}},
 ]){rehash(malformed);x.reopen();assertUnknownHoldMinimized(x.read(p),r,null,null,null);assert.equal(failedAttempts(),1,'self-rehashed malformed or foreign provenance never dispatches again');}
 // rebind attack: row no longer associated by exact request_digest of the reservation
 corrupt(`UPDATE native_run_provenance SET request_digest='${'9'.repeat(64)}',provenance_digest='${'2'.repeat(64)}' WHERE operation_id='${p.runId}'`);x.reopen();assertUnknownHoldMinimized(x.read(p),r,null,null,null);assert.equal(failedAttempts(),1);
 // corruption never touched the UNKNOWN hold or its diagnosis
 const held=provenanceRow(x,p.runId);assert.equal(held.request_digest,'9'.repeat(64));assert.equal(x.read(p).failureDiagnosis.reason,'LOOP_FAILURE_UNCLASSIFIED');assert.equal(x.read(p).failureDiagnosis.exitCode,2);assert.equal(x.read(p).failureDiagnosis.settledUsageConfirmed,false);}finally{await x.close();}});
test('PAN548_NATIVE_UNKNOWN_RETAINS_ORIGINAL_SOURCE_BOUND_PROVENANCE_ACROSS_OWNER_REOPEN_NO_REPLAY',async()=>{const {x,p,r,failedAttempts}=await unknownProvenanceFixture();try{assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(r.proposal,null);assert.equal(failedAttempts(),1,'exactly the one genuine failed provider attempt, none from provenance');assert.deepEqual(r.binding,p.binding);assert.equal(r.sourceDigest,p.sourceDigest);assert.deepEqual(r.sourceRevisions,p.sourceRevisions);assert.deepEqual(Object.keys(r).sort(),Object.keys({schemaVersion:0,runId:0,phase:0,requestDigest:0,binding:0,sourceDigest:0,sourceRevisions:0,modelMode:0,realModelAcceptance:0,proposal:0,text:0,operations:0,budget:0,failureDiagnosis:0,personalViewPersistenceProduced:0,businessEffectProduced:false,executionAuthorityGranted:false}).sort());const diagnosis=r.failureDiagnosis;assert.equal(diagnosis.reason,'LOOP_FAILURE_UNCLASSIFIED');assert.equal(diagnosis.exitCode,2);assert.equal(diagnosis.actualRequests,null);assert.equal(diagnosis.actualToolActions,null);assert.equal(diagnosis.settledUsageConfirmed,false);assert.equal(diagnosis.realModelAcceptance,false);x.reopen();const after=x.read(p);assertUnknownHoldMinimized(after,r,p.binding,p.sourceDigest,p.sourceRevisions);assert.deepEqual(after.failureDiagnosis,diagnosis);assert.equal(failedAttempts(),1,'owner close/reopen and reads never dispatch again');assert.equal(x.f.store.read(x.f.sessions.authenticate(x.t.headers)).revision,0,'retained provenance never applies anything to the view');}finally{await x.close();}});
test('PAN548_NATIVE_UNKNOWN_PROVENANCE_IS_HISTORICAL_NOT_CURRENT_CONTEXT_RELABEL_AND_DENIED_FOR_REVOKEN_OR_FOREIGN',async()=>{const {x,p,r,failedAttempts}=await unknownProvenanceFixture();try{assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(failedAttempts(),1);const t2=x.f.tab(x.t.headers),ctx2=()=>x.f.verification(t2);assert.notEqual(t2.context.binding.tabId,x.t.context.binding.tabId,'freshly verified current context genuinely differs');const via=t2b=>x.owner.read(t2b.headers,{schemaVersion:'pansphaira.workspace-agent/read/v1',context:ctx2(),runId:p.runId});const current=via(t2);assertUnknownHoldMinimized(current,r,p.binding,p.sourceDigest,p.sourceRevisions);assert.equal(current.binding.tabId,x.t.context.binding.tabId,'original provenance kept, not relabeled with the current tab binding');assert.notEqual(current.binding.tabId,t2.context.binding.tabId);assert.equal(current.proposal,null);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.t.headers)).revision,0,'read via changed context silently applies nothing');x.f.context.retire(x.t.headers,x.ctx());// owner.read throws synchronously, so a deferred Promise.resolve wrapper can never observe the denial
 assert.throws(()=>x.read(p),/CONTEXT_REVISION_STALE/,'revoked context is denied before any metadata');const foreign=x.f.tab(x.f.issue('synthetic:erv-reviewer-2','reviewer'));assert.throws(()=>x.owner.read(foreign.headers,{schemaVersion:'pansphaira.workspace-agent/read/v1',context:x.f.verification(foreign),runId:p.runId}),/DENIED$/,'foreign principal never sees another ledger row or its provenance');assert.equal(failedAttempts(),1);}finally{await x.close();}});
// RUN48: the additive owner-derived historical provenance flows through the
// EXISTING closed DTO (compiled dist import, parent compiles before tests).
// All-null stays legal; the all-present triple needs the exact closed binding
// identity — origin, tenant, subject, instance and generation must match the
// current authenticated context, while a historical session/tab/epoch is
// format-checked but never required to match the CURRENT tab, because history
// is no current-context relabel and never permission to apply/save/retry.
// Partial triples, foreign identity, extra/missing binding fields, arbitrary
// digest/revisions shapes, unknown top-level fields and forged diagnosis pairs
// deny; the full UNKNOWN hold, disabled operations and consumed-zero budget
// survive validation unchanged.
test('PAN548_NATIVE_UNKNOWN_HISTORICAL_PROVENANCE_CLOSED_DTO_ADMITS_EXACT_TRIPLE_AND_DENIES_PARTIAL_FOREIGN_OR_FORGED',async()=>{const {x,p,r,failedAttempts}=await unknownProvenanceFixture();try{assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(failedAttempts(),1);const check=v=>validateWorkspaceAgentReadV1(v,x.t.context,nativeWorkspaceViewFieldsV1);const validated=check(JSON.parse(JSON.stringify(r)));assert.equal(validated.phase,'OUTCOME_UNCONFIRMED');assert.equal(validated.proposal,null);assert.equal(validated.realModelAcceptance,false);assert.equal(validated.failureDiagnosis.reason,'LOOP_FAILURE_UNCLASSIFIED');assert.equal(validated.failureDiagnosis.exitCode,2);assert.equal(validated.operations.resume.available,false);assert.equal(validated.operations.cancel.available,false);assert.equal(validated.budget.model.consumedUnits,0);assert.equal(validated.budget.runtime.consumedUnits,0);assert.deepEqual(validated.binding,r.binding);assert.equal(validated.sourceDigest,r.sourceDigest);assert.deepEqual(validated.sourceRevisions,r.sourceRevisions);assert.equal(validated.personalViewPersistenceProduced,false);assert.equal(validated.businessEffectProduced,false);assert.equal(validated.executionAuthorityGranted,false);
 const historical=structuredClone(r);historical.binding.tabId='tab:'+'0'.repeat(32);historical.binding.epoch=1;assert.equal(check(historical).phase,'OUTCOME_UNCONFIRMED','historical same-principal old tab/epoch context is admitted, not relabeled');
 const legacy=structuredClone(r);legacy.binding=null;legacy.sourceDigest=null;legacy.sourceRevisions=null;assert.equal(check(legacy).phase,'OUTCOME_UNCONFIRMED','legacy all-null minimization stays legal');
 for(const partial of[{binding:null},{sourceDigest:null},{sourceRevisions:null}]){const v=structuredClone(r);Object.assign(v,partial);assert.throws(()=>check(v),{message:'WORKSPACE_AGENT_DTO_DENIED'},'partial historical triple must deny');}
 for(const forged of[{binding:{tenantId:r.binding.tenantId}},{binding:'not-a-binding'},{binding:[...r.binding.tabId]},{sourceDigest:'F'.repeat(64)},{sourceDigest:'z'.repeat(64)},{sourceDigest:42},{sourceRevisions:{erv:-1,human:0}},{sourceRevisions:{erv:0}},{sourceRevisions:{erv:0,human:0,extra:1}},{sourceRevisions:{erv:0.5,human:0}},{sourceRevisions:['0','0']}]){const v=structuredClone(r);Object.assign(v,forged);assert.throws(()=>check(v),{message:'WORKSPACE_AGENT_DTO_DENIED'},'forged historical field shape must deny');}
 for(const wrongIdentity of['origin','tenantId','subjectId','instanceId','generation']){const v=structuredClone(r);v.binding[wrongIdentity]=wrongIdentity==='generation'?r.binding.generation+1:'forged-'+wrongIdentity;assert.throws(()=>check(v),{message:'WORKSPACE_AGENT_DTO_DENIED'},'wrong '+wrongIdentity+' cannot ride the historical triple');}
 const extraBindingField=structuredClone(r);extraBindingField.binding.role='admin';assert.throws(()=>check(extraBindingField),{message:'WORKSPACE_AGENT_DTO_DENIED'});
 const unknownTopLevel=structuredClone(r);unknownTopLevel.role='admin';assert.throws(()=>check(unknownTopLevel),{message:'WORKSPACE_AGENT_DTO_DENIED'});
 const forgedReason=structuredClone(r);forgedReason.failureDiagnosis.reason='LOOP_OUTPUT_LIMIT';assert.throws(()=>check(forgedReason),{message:'WORKSPACE_AGENT_DTO_DENIED'},'forged reason/exit pair stays denied with historical provenance present');
 assert.equal(failedAttempts(),1,'DTO validation never dispatches');}finally{await x.close();}});
// RUN50: the code-owned RUNNING read phase for exactly the run this native
// owner can currently prove it is actively executing. The REAL fixture
// provider callback is deliberately held with a deferred promise; after an
// actual provider entry past the durable dispatch fence, an independent
// owner.read observes RUNNING with the exact original admitted provenance,
// null proposal, no failureDiagnosis key at all and the complete held
// reservation (consumed stays zero) — validated through the production
// compiled DTO. A duplicate start of the same run while executing returns the
// same in-flight result without ever dispatching the provider again; releasing
// the held successful callback produces the original RESULT_READY with real
// settlement. Forged or partial RUNNING DTOs deny at the closed boundary.
test('PAN548_NATIVE_RUNNING_OBSERVED_BY_INDEPENDENT_READ_WHILE_PROVIDER_HELD_DUPLICATE_START_NEVER_REDISPATCHES_THEN_REAL_SETTLEMENT',async()=>{
 let entered,release;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});
 const x=await fixture(m=>{const original=m.providerCall;m.providerCall=async(...args)=>{entered();await gate;return original(...args);};});
 try{
  const p=x.plan('Nur Rechnungswert größer.');const running=x.start(p);await started;
  assert.equal(x.calls(),0,'held provider completed no call yet — RUNNING is the held provider entry itself, not a result claim');
  const r1=x.read(p);
  assert.equal(r1.phase,'RUNNING');assert.equal(r1.runId,p.runId);assert.match(r1.requestDigest,/^[a-f0-9]{64}$/);
  assert.deepEqual(r1.binding,p.binding);assert.equal(r1.sourceDigest,p.sourceDigest);assert.deepEqual(r1.sourceRevisions,p.sourceRevisions);
  assert.equal(r1.proposal,null);assert.equal(Object.hasOwn(r1,'failureDiagnosis'),false,'RUNNING carries no failure diagnosis whatsoever');
  assert.equal(r1.realModelAcceptance,false);assert.equal(r1.personalViewPersistenceProduced,false);assert.equal(r1.businessEffectProduced,false);assert.equal(r1.executionAuthorityGranted,false);
  assert.equal(r1.operations.cancel.available,false);assert.equal(r1.operations.resume.available,false);
  assert.equal(r1.operations.cancel.reason,'NO_NATIVE_MODEL_TASK_CANCEL_CONTRACT');assert.equal(r1.operations.resume.reason,'NO_NATIVE_MODEL_TASK_RESUME_CONTRACT');
  assert.ok(r1.budget.model.committedUnits>0&&r1.budget.model.consumedUnits===0,'running read keeps the full held reservation with no settled usage');
  assert.ok(r1.budget.runtime.committedUnits>0&&r1.budget.runtime.consumedUnits===0);
  for(const literal of ['kein abgeschlossenes Ergebnis','kein Speichern','keine Anwenden-Freigabe','dispatcht, wiederholt oder verrechnet nichts'])assert.ok(r1.text.includes(literal),'RUNNING_GERMAN_TEXT_MISSING:'+literal);
  const validated=validateWorkspaceAgentReadV1(JSON.parse(JSON.stringify(r1)),x.t.context,nativeWorkspaceViewFieldsV1);
  assert.equal(validated.phase,'RUNNING');assert.equal(validated.proposal,null);assert.equal(validated.failureDiagnosis,undefined);assert.deepEqual(validated.binding,r1.binding);assert.equal(validated.sourceDigest,r1.sourceDigest);
  // a duplicate start of the same already-executed plan returns the same
  // in-flight result — never a second provider dispatch
  const duplicate=x.start(p);assert.equal(x.calls(),0,'duplicate start while actually running never dispatches again');
  release();
  const [result,dup]=await Promise.all([running,duplicate]);
  assert.equal(result.phase,'RESULT_READY');assert.deepEqual(dup,result);assert.equal(x.calls(),2);
  assert.ok(result.budget.model.consumedUnits>0&&result.proposal!==null);assert.deepEqual(x.read(p),result);
  // forged/partial RUNNING DTOs deny through the production boundary
  const check=v=>validateWorkspaceAgentReadV1(v,x.t.context,nativeWorkspaceViewFieldsV1),base=JSON.parse(JSON.stringify(r1));
  for(const forged of[{binding:null},{sourceDigest:null},{sourceRevisions:null},{binding:{...base.binding,tenantId:'forged-tenant'}},{binding:{...base.binding,subjectId:'subject-forged'}},{binding:{...base.binding,forgedKey:1}},{sourceDigest:'F'.repeat(64)},{sourceRevisions:{erv:-1,human:0}},{operations:{...base.operations,cancel:{available:true,reason:'NO_NATIVE_MODEL_TASK_CANCEL_CONTRACT'}}},{operations:{...base.operations,resume:{available:true,reason:'NO_NATIVE_MODEL_TASK_RESUME_CONTRACT'}}},{personalViewPersistenceProduced:true},{businessEffectProduced:true},{executionAuthorityGranted:true},{proposal:JSON.parse(JSON.stringify(result.proposal))},{failureDiagnosis:null}]){const v=structuredClone(base);Object.assign(v,forged);assert.throws(()=>check(v),{message:'WORKSPACE_AGENT_DTO_DENIED'},'forged RUNNING read must deny');}
  const extraKey=structuredClone(base);extraKey.role='admin';assert.throws(()=>check(extraKey),{message:'WORKSPACE_AGENT_DTO_DENIED'},'invented top-level RUNNING field must deny');
 }finally{release();await x.close();}
});
// RUN50 conservative boundaries: RUNNING is only the CURRENT owner's own
// provable live execution. A genuine provider failure leaves a historical
// UNKNOWN row that never reads RUNNING across owner reopen (process loss:
// the in-memory proof is gone). While the provider is held, a revoked context
// is denied outright and an owner reopen removes the proof even though the
// old in-flight promise still exists — a promise alone is not proof. Nothing
// here resets budgets, clocks or the exactly-once hold.
test('PAN548_NATIVE_RUNNING_PROOF_DIES_WITH_REVOKE_OR_CLOSE_AND_HISTORICAL_UNKNOWN_NEVER_READS_RUNNING_AFTER_REOPEN',async()=>{
 const failing=await fixture(m=>{m.providerCall=async()=>{throw Error('genuine owner callback failed after dispatch fence');};});
 try{const p=failing.plan('Nur Rechnungswert größer.');const r=await failing.start(p);assert.equal(r.phase,'OUTCOME_UNCONFIRMED');
  // the settled-failure row keeps NO active proof: the same owner's fresh read
  // is UNKNOWN with the retained diagnosis, never RUNNING.
  const sameOwner=failing.read(p);assert.equal(sameOwner.phase,'OUTCOME_UNCONFIRMED');assert.equal(sameOwner.failureDiagnosis.reason,'LOOP_FAILURE_UNCLASSIFIED');
  failing.reopen();const after=failing.read(p);assert.equal(after.phase,'OUTCOME_UNCONFIRMED');assert.equal(after.budget.model.committedUnits,r.budget.model.committedUnits);assert.equal(after.budget.model.consumedUnits,0,'historical UNKNOWN across reopen keeps the full hold and never claims RUNNING');
 }finally{await failing.close();}
 let entered,release;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});
 const x=await fixture(m=>{const original=m.providerCall;m.providerCall=async(...args)=>{entered();await gate;return original(...args);};});
 try{
  const p=x.plan('Nur Rechnungswert größer.');const running=x.start(p);await started;
  const held=x.read(p);assert.equal(held.phase,'RUNNING','live proof exists before revoke/close');
  const committedModel=held.budget.model.committedUnits,committedRuntime=held.budget.runtime.committedUnits;
  x.f.context.retire(x.t.headers,x.ctx());
  assert.throws(()=>x.read(p),/CONTEXT_REVISION_STALE/,'revoked context denies the read outright — no RUNNING projection from a stale current context');
  x.reopen();
  x.f.fresh(x.t);
  const reopened=x.read(p);
  assert.equal(reopened.phase,'OUTCOME_UNCONFIRMED','closed old owner with a still-pending in-flight promise is NOT proof of continued allowed execution');
  assert.equal(reopened.budget.model.committedUnits,committedModel);assert.equal(reopened.budget.runtime.committedUnits,committedRuntime);assert.equal(reopened.budget.model.consumedUnits,0);assert.equal(reopened.failureDiagnosis,null);
  release();await running.catch(()=>{});
  const final=x.read(p);
  assert.equal(final.phase,'OUTCOME_UNCONFIRMED');assert.equal(final.budget.model.committedUnits,committedModel,'late continuation after close never settles or resets the retained hold');assert.equal(final.budget.model.consumedUnits,0);
  assert.equal(x.calls(),1,'exactly the one genuine held provider attempt; close/reopen/read never dispatched again');
 }finally{release();await x.close();}
});
// RUN51: RUNNING additionally requires the ORIGINAL admitted context/source/
// rights to still verify (read-only re-check through the run's own freshness
// gate). While the provider is genuinely held, a fresh same-principal tab sees
// the live run with the ORIGINAL provenance; the moment that original context
// is retired, the same fresh-tab read conservatively minimizes to UNKNOWN —
// the pending execution is no longer proof of allowed continuation, even
// though the reader's own context is perfectly current. No dispatch, retry,
// settlement, lease refresh or reservation reset happens on any of these reads.
test('PAN548_NATIVE_RUNNING_GATED_BY_ORIGINAL_ADMITTED_CONTEXT_FRESH_TAB_READ_REVOKED_RUN_IS_UNKNOWN_NOT_RUNNING',async()=>{
 let entered,release;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});
 const x=await fixture(m=>{const original=m.providerCall;m.providerCall=async(...args)=>{entered();await gate;return original(...args);};});
 try{
  const p=x.plan('Nur Rechnungswert größer.');const running=x.start(p);await started;
  const t2=x.f.tab(x.t.headers),ctx2=()=>x.f.verification(t2);
  assert.notEqual(t2.context.binding.tabId,x.t.context.binding.tabId,'fresh same-principal tab genuinely differs');
  const viaFreshTab=x.owner.read(t2.headers,{schemaVersion:'pansphaira.workspace-agent/read/v1',context:ctx2(),runId:p.runId});
  assert.equal(viaFreshTab.phase,'RUNNING');assert.deepEqual(viaFreshTab.binding,p.binding,'fresh tab sees the ORIGINAL admitted provenance, never its own relabel');
  assert.equal(viaFreshTab.proposal,null);assert.equal(Object.hasOwn(viaFreshTab,'failureDiagnosis'),false);
  assert.ok(viaFreshTab.budget.model.committedUnits>0&&viaFreshTab.budget.model.consumedUnits===0,'fresh-tab RUNNING read keeps the full held reservation');
  const committedModel=viaFreshTab.budget.model.committedUnits,committedRuntime=viaFreshTab.budget.runtime.committedUnits;
  x.f.context.retire(x.t.headers,x.ctx());
  const afterRevoke=x.owner.read(t2.headers,{schemaVersion:'pansphaira.workspace-agent/read/v1',context:ctx2(),runId:p.runId});
  assert.equal(afterRevoke.phase,'OUTCOME_UNCONFIRMED','revoked original admitted context ends the RUNNING proof for every reader');
  assert.equal(afterRevoke.failureDiagnosis,null,'the still-held callback has not terminally failed yet — no diagnosis invented');
  assert.equal(afterRevoke.budget.model.committedUnits,committedModel);assert.equal(afterRevoke.budget.runtime.committedUnits,committedRuntime);assert.equal(afterRevoke.budget.model.consumedUnits,0,'the revoked-context read never resets or consumes the held reservation');
  assert.equal(x.calls(),0,'reads never dispatch — only the one held provider entry exists');
  assert.equal(x.f.store.read(x.f.sessions.authenticate(x.t.headers)).revision,0,'revoked-context RUNNING-boundary reads apply nothing');
  release();await running;
  const settled=x.owner.read(t2.headers,{schemaVersion:'pansphaira.workspace-agent/read/v1',context:ctx2(),runId:p.runId});
  assert.equal(settled.phase,'OUTCOME_UNCONFIRMED','stale-denied completion settles nothing and never claims RUNNING');
  assert.equal(settled.failureDiagnosis.reason,'LOOP_FAILURE_UNCLASSIFIED');assert.equal(settled.failureDiagnosis.exitCode,2);
 }finally{release();await x.close();}
});
// RUN52 closes the two remaining RUNNING-boundary coverage gaps on the real
// production paths: (a) the existing575 loop's bounded timeout must end the
// RUNNING observation while the genuine provider callback is STILL held — the
// run minimizes to the unchanged OUTCOME_UNCONFIRMED with the full UNKNOWN
// hold, the closed LOOP_TIME_LIMIT diagnosis and no dispatch, settlement or
// retry; (b) revoking the bound native admission itself (closing the real
// 565 connection owner) stops RUNNING even though the run's original context
// remains fully current and the RUNNING deadline has not elapsed, again
// retaining the full hold. Both reuse only existing fixture primitives and
// public owners: no new production control API, no mock native response, no
// polling, no fabricated cancellation, no budget or clock reset.
async function chatProbeFixture(change=()=>{}){
 const {createNativeWorkspaceAgentRunV1,syntheticWorkspaceViewChatFeedbackModelV1}=await import('../../src/pan548/native-agent-run.mjs');
 const f=await nativeViewFixture546(),root=mkdtempSync(join(tmpdir(),'pan548-owned-native-chat-'));
 const model=syntheticWorkspaceViewChatFeedbackModelV1('tenant-a');
 // The counting wrapper is installed AFTER change(model), so it counts every
 // actual entry into the FINAL provider callback chain — including an entry
 // that change(model) deliberately holds (e.g. behind a gate before the real
 // synthetic callback). Counting around the final callback keeps the held
 // provider-entry count truthful; the RUN48-style explicit observer pattern
 // applies here because the run52 timeout change() re-wraps providerCall.
 change(model);let calls=0;const originalProvider=model.providerCall;model.providerCall=async(...args)=>{calls++;return originalProvider(...args);};
 const create=()=>createNativeWorkspaceAgentRunV1({sessions:f.sessions,contextSelection:f.context,dataCatalog:f.data,viewOwner:f.view,root,model});let owner=create();
 function tab(){const t=f.tab();const c=t.context;t.context=f.context.claim(t.headers,{schemaVersion:'pansphaira.workspace-context/claim/v1',tabId:c.binding.tabId,moduleId:c.moduleId,viewId:c.viewId,primaryObjectId:c.primaryObject.objectId,selection:{elementId:'pan.erv.module-card',rowId:'invoice-value'},expected:{...c.revisions,epoch:c.binding.epoch}}).context;return t;}
 const t=tab(),ctx=()=>f.verification(t),plan=text=>owner.plan(t.headers,{schemaVersion:'pansphaira.workspace-agent/plan/v1',context:ctx(),text}),start=p=>owner.start(t.headers,{schemaVersion:'pansphaira.workspace-agent/start/v1',context:ctx(),planHandle:p.planHandle,planDigest:p.planDigest}),read=p=>owner.read(t.headers,{schemaVersion:'pansphaira.workspace-agent/read/v1',context:ctx(),runId:p.runId});
 return {f,t,root,model,ctx,plan,start,read,get owner(){return owner;},calls:()=>calls,async close(){owner.close();await f.close();rmSync(root,{recursive:true,force:true});}};
}
test('PAN548_NATIVE_BOUND_TIMEOUT_WHILE_REAL_CALLBACK_HELD_STOPS_RUNNING_RETAINS_FULL_UNKNOWN_HOLD_LOOP_TIME_LIMIT_NO_SETTLE_OR_RETRY',{timeout:30000},async()=>{
 let entered,release;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});
 const x=await chatProbeFixture(m=>{m.policy.maxBudget.timeoutMs=1500;const original=m.providerCall;m.providerCall=async(...args)=>{entered();await gate;return original(...args);};});
 try{
  const p=x.plan('Nur Rechnungswert größer.');const running=x.start(p);await started;
  const held=x.read(p);assert.equal(held.phase,'RUNNING','inside the admitted bound the held execution is genuinely observable');
  const committedModel=held.budget.model.committedUnits,committedRuntime=held.budget.runtime.committedUnits;
  assert.ok(committedModel>0&&committedRuntime>0&&held.budget.model.consumedUnits===0&&held.budget.runtime.consumedUnits===0,'held RUNNING keeps the full hold with no settled usage');
  assert.equal(held.budget.reservations,1);
  // The existing575 loop enforces its own maxTimeMs (bounded here by the
  // fixture policy's allowed 1500ms timeout) even while the genuine provider
  // callback never returns: the start promise resolves through the closed
  // LOOP_TIME_LIMIT readback WITHOUT the callback being released — no fake
  // response, no polling, no automatic retry, no fabricated cancellation.
  const r=await running;
  assert.equal(r.phase,'OUTCOME_UNCONFIRMED','a bound timeout while genuinely held must stop RUNNING');
  assert.deepEqual(r.failureDiagnosis,{schemaVersion:'pansphaira.workspace-agent/failure-diagnosis/v1',runId:p.runId,requestDigest:r.requestDigest,reason:'LOOP_TIME_LIMIT',exitCode:3,actualRequests:1,actualToolActions:0,settledUsageConfirmed:false,realModelAcceptance:false},'the actual loop measurement survives closed with exit3; nothing settled');
  const after=x.read(p);
  assert.equal(after.phase,'OUTCOME_UNCONFIRMED','the callback is STILL held right here — the timeout alone ended the RUNNING proof; the dead execution never observes itself as RUNNING');
  assert.equal(after.budget.model.committedUnits,committedModel);assert.equal(after.budget.runtime.committedUnits,committedRuntime,'the full UNKNOWN hold survives the timeout unchanged');
  assert.equal(after.budget.model.consumedUnits,0);assert.equal(after.budget.runtime.consumedUnits,0,'a timed-out unknown settles nothing');
  assert.equal(after.budget.reservations,1,'exactly one reservation; the timeout never resets or duplicates the hold');
  assert.equal(x.calls(),1,'exactly the one held provider entry; the timeout never dispatches again');
  assert.equal(x.f.store.read(x.f.sessions.authenticate(x.t.headers)).revision,0,'timeout-boundary reads apply nothing');
  release();
  const settled=x.read(p);
  assert.equal(settled.phase,'OUTCOME_UNCONFIRMED','releasing the already-timed-out callback settles nothing');
  assert.equal(settled.budget.model.committedUnits,committedModel);assert.equal(settled.budget.model.consumedUnits,0);
  assert.equal(x.calls(),1,'the released timed-out callback never becomes a retry');
 }finally{release();await x.close();}
});
// The controlled LOCAL framing peer below is the same existing synthetic
// protocol peer pattern as the 575 consumer tests — HTTP framing only, never
// a language model. Exactly one POST is genuinely held mid-request; the
// revocation is the real 565 owner close, which synchronously aborts the
// admitted task lifetime.
async function ownerBoundAdmissionFixture(){
 const {createNativeWorkspaceAgentRunV1,syntheticWorkspaceViewChatFeedbackModelV1}=await import('../../src/pan548/native-agent-run.mjs');
 const f=await nativeViewFixture546(),peer=syntheticWorkspaceViewChatFeedbackModelV1('tenant-a');let posts=0;
 const credentialFile=join(f.root,'owned-admission-revoke-secret');writeFileSync(credentialFile,syntheticCredential565,{mode:0o600});
 let markHeld,releaseGate;const held=new Promise(r=>{markHeld=r;}),gate=new Promise(r=>{releaseGate=r;});
 const server=createServer(async(req,res)=>{try{
  let bytes='';for await(const chunk of req)bytes+=chunk;const body=bytes?JSON.parse(bytes):null;
  if(req.method==='GET'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({data:[{id:'model:synthetic-v1'}]}));return;}
  posts++;if(posts===1){markHeld();await gate;}
  const result=await peer.providerCall({request:body},new AbortController().signal);
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({model:'model:synthetic-v1',choices:[{message:{content:result.toolCalls.length?null:result.text,tool_calls:result.toolCalls.map(c=>({id:c.id,type:'function',function:{name:MODEL_UI_WIRE_ALIAS_V1.binding[c.name]??c.name,arguments:JSON.stringify(c.arguments)}}))}}],usage:{prompt_tokens:2,completion_tokens:3}}));
 }catch{/* a revoked transport may already be gone; the ledger truth is in the ledger */try{res.destroy();}catch{}}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const options=connectionOptions565({origin:'http://127.0.0.1:'+server.address().port},credentialFile);options.productGrant.limits={...options.productGrant.limits,maxTimeMs:15000,maxInputBytes:32768};options.productGrant.allowedPurposes=['purpose:ui-connection-probe','purpose:ui-view-proposal'];
 let connection=nativeModelConnection.createNativeModelConnectionV1({sessions:f.sessions,profiles:f.legacy,root:f.root,connections:[options]});
 let model=nativeModelConnection.createNativeWorkspaceFeedbackModelV1(connection,f.sessions.binding);
 const create=()=>createNativeWorkspaceAgentRunV1({sessions:f.sessions,contextSelection:f.context,dataCatalog:f.data,viewOwner:f.view,root:join(f.root,'native-admission-revoke'),model});let agent=create();
 const t=f.tab(),c=t.context;t.context=f.context.claim(t.headers,{schemaVersion:'pansphaira.workspace-context/claim/v1',tabId:c.binding.tabId,moduleId:c.moduleId,viewId:c.viewId,primaryObjectId:c.primaryObject.objectId,selection:{elementId:'pan.erv.module-card',rowId:'invoice-value'},expected:{...c.revisions,epoch:c.binding.epoch}}).context;
 const headers={...t.headers,'x-pan565-session':t.headers['x-pan548-session']},ctx=()=>f.verification(t),readConnection=()=>connection.read(headers),
  plan=()=>agent.plan(t.headers,{schemaVersion:'pansphaira.workspace-agent/plan/v1',context:ctx(),text:'Nur ausgewähltes Viewelement als Vorschlag; keine Fachwirkung.'}),
  start=p=>agent.start(t.headers,{schemaVersion:'pansphaira.workspace-agent/start/v1',context:ctx(),planHandle:p.planHandle,planDigest:p.planDigest,inferenceConsent:{offerDigest:p.inferenceConsentOffer.offerDigest,confirm:true}}),
  read=p=>agent.read(t.headers,{schemaVersion:'pansphaira.workspace-agent/read/v1',context:ctx(),runId:p.runId});
 const prerequisites=async()=>{let r=readConnection();connection.select(headers,{schemaVersion:'pansphaira.workspace-model-connection/select/v1',expectedRevision:r.revision,connectionId:options.summary.connectionId});for(const phase of ['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY']){r=readConnection();await connection.probe(headers,{schemaVersion:'pansphaira.workspace-model-connection/probe/v1',expectedRevision:r.revision,identityDigest:r.identityDigest,phase});}};
 return {f,t,ctx,headers,prerequisites,plan,start,read,readConnection,posts:()=>posts,held,release(){releaseGate();},get connection(){return connection;},get agent(){return agent;},async close(){agent.close();connection.close();releaseGate();server.closeAllConnections();await new Promise(r=>server.close(r));await f.close();}};
}
test('PAN548_NATIVE_BOUND_ADMISSION_REVOKE_STOPS_RUNNING_WITH_CURRENT_ORIGINAL_CONTEXT_FULL_UNKNOWN_HOLD_NO_SETTLE_OR_RETRY',{timeout:30000},async()=>{
 const x=await ownerBoundAdmissionFixture();try{
  await x.prerequisites();
  const p=x.plan(),before=x.f.view.read(x.t.headers,x.ctx());const running=x.start(p);await x.held;
  const held=x.read(p);assert.equal(held.phase,'RUNNING');assert.equal(held.proposal,null);assert.equal(Object.hasOwn(held,'failureDiagnosis'),false);
  const committedModel=held.budget.model.committedUnits,committedRuntime=held.budget.runtime.committedUnits;
  assert.ok(committedModel>0&&committedRuntime>0&&held.budget.model.consumedUnits===0&&held.budget.runtime.consumedUnits===0);assert.equal(held.budget.reservations,1);
  assert.equal(x.posts(),1,'exactly the one genuinely held same-origin protocol POST');
  // Revoke the bound admission ITSELF: the real565 connection owner closes
  // while the peer still holds that POST. The agent owner stays open, the
  // reader's context is still fully current (the read below passes its own
  // freshness gate instead of throwing) and the RUNNING deadline has NOT
  // elapsed — the synchronously aborted admission lifetime alone must end the
  // RUNNING proof (native-agent-run.mjs binds active.signal to the admitted
  // signal exactly for this).
  x.connection.close();
  const revoked=x.read(p);
  assert.equal(revoked.phase,'OUTCOME_UNCONFIRMED','a revoked bound admission stops RUNNING even with a fully current original context');
  assert.equal(revoked.failureDiagnosis,null,'the still-held callback has not terminally failed yet — no diagnosis invented');
  assert.deepEqual(revoked.binding,p.binding);assert.equal(revoked.sourceDigest,p.sourceDigest);assert.deepEqual(revoked.sourceRevisions,p.sourceRevisions,'revocation keeps the original provenance intact');
  assert.equal(revoked.budget.model.committedUnits,committedModel);assert.equal(revoked.budget.runtime.committedUnits,committedRuntime,'the full UNKNOWN hold survives the revocation unchanged');
  assert.equal(revoked.budget.model.consumedUnits,0);assert.equal(revoked.budget.runtime.consumedUnits,0,'revocation never settles, resets or consumes the held reservation');
  assert.equal(revoked.budget.reservations,1);assert.equal(x.posts(),1,'revocation never re-dispatches');
  assert.equal(x.f.store.read(x.f.sessions.authenticate(x.t.headers)).revision,0);assert.deepEqual(x.f.view.read(x.t.headers,x.ctx()),before,'no view or business effect on the revocation path');
  // The aborted loop surfaces through the existing565 task-authority recheck
  // inside runFeedback (the closed connection owner can no longer authorize
  // the task), so the loop result never reaches this agent as a completed
  // readback: the closed execution records the explicit unclassified failure
  // with null counts — never a fabricated success or a zero-usage settle.
  const r=await running;
  assert.equal(r.phase,'OUTCOME_UNCONFIRMED');assert.equal(r.proposal,null);assert.equal(r.realModelAcceptance,false);
  assert.deepEqual(r.failureDiagnosis,{schemaVersion:'pansphaira.workspace-agent/failure-diagnosis/v1',runId:p.runId,requestDigest:r.requestDigest,reason:'LOOP_FAILURE_UNCLASSIFIED',exitCode:2,actualRequests:null,actualToolActions:null,settledUsageConfirmed:false,realModelAcceptance:false});
  x.release();
  const after=x.read(p);
  assert.equal(after.phase,'OUTCOME_UNCONFIRMED');assert.equal(after.budget.model.committedUnits,committedModel);assert.equal(after.budget.model.consumedUnits,0,'releasing the revoked callback settles nothing');
  assert.equal(x.posts(),1,'the released callback never becomes a second POST');
 }finally{x.release();await x.close();}
});
// RUN88 PUI-07-AC02: direct forged operations/reason/schema negatives at the
// closed DTO boundary, now that the typed operations travel on BOTH plan and
// read. The existing validators already denied malformed values and are NOT
// loosened: exactly {available:false, exact closed reason} per operation
// survives; every other availability, swapped/foreign reason, missing or extra
// key, wrapper shape or the whole-field removal denies through the SAME
// production boundary the HMI consumer relies on.
test('PAN548_RUN88_CLOSED_TASK_OPERATIONS_DTO_DENIES_FORGED_AVAILABILITY_REASON_OR_SHAPE_ON_PLAN_AND_READ',async()=>{const x=await fixture();try{
 const p=x.plan('Nur Rechnungswert größer.'),readDto=JSON.parse(JSON.stringify(await x.start(p))),planDto=JSON.parse(JSON.stringify(p));
 const checkRead=v=>validateWorkspaceAgentReadV1(v,x.t.context,nativeWorkspaceViewFieldsV1),checkPlan=v=>validateWorkspaceAgentPlanV1(v,x.t.context),closed={cancel:{available:false,reason:'NO_NATIVE_MODEL_TASK_CANCEL_CONTRACT'},resume:{available:false,reason:'NO_NATIVE_MODEL_TASK_RESUME_CONTRACT'}};
 assert.deepEqual(checkRead(readDto).operations,closed,'the true native read carries exactly the closed operations contract through the boundary');
 assert.deepEqual(checkPlan(planDto).operations,closed,'the true native plan carries exactly the closed operations contract through the boundary');
 const forgeries=[v=>{v.operations.cancel.available=true;},v=>{v.operations.resume.available=true;},v=>{v.operations.cancel.reason='CANCEL_QUEUED_BY_CALLER';},v=>{v.operations.resume.reason='NO_NATIVE_MODEL_TASK_CANCEL_CONTRACT';},v=>{v.operations.cancel.reason='NO_NATIVE_MODEL_TASK_RESUME_CONTRACT';},v=>{v.operations.cancel={available:false};},v=>{v.operations.resume={available:false,reason:'NO_NATIVE_MODEL_TASK_RESUME_CONTRACT',queued:true};},v=>{v.operations={cancel:{available:false,reason:'NO_NATIVE_MODEL_TASK_CANCEL_CONTRACT'}};},v=>{v.operations={resume:{available:false,reason:'NO_NATIVE_MODEL_TASK_RESUME_CONTRACT'}};},v=>{v.operations={};},v=>{v.operations=null;},v=>{v.operations='NO_NATIVE_MODEL_TASK_CANCEL_CONTRACT';},v=>{delete v.operations;}];
 for(const forge of forgeries){const a=structuredClone(readDto),b=structuredClone(planDto);forge(a);forge(b);assert.throws(()=>checkRead(a),/WORKSPACE_AGENT_DTO_DENIED/,'forged operations must deny on the closed read DTO');assert.throws(()=>checkPlan(b),/WORKSPACE_AGENT_DTO_DENIED/,'forged operations must deny on the closed plan DTO');}
}catch(error){throw error;}finally{await x.close();}});
