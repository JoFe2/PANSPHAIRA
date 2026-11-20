import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {nativeViewFixture546} from '../pan546/native-fixture.mjs';
import {createNativeWorkspaceUiTaskProjectionV2, nativeWorkspaceUiTaskOwnerConnectionV2, uiTaskDigestV2} from '../../src/pan548/native-ui-task-projection-v2.mjs';
import {createNativeSurfaceProjectionReaderV2} from '../../src/pan546/native-surface-projection-v2.mjs';
import {createNativeWorkspaceSurfacesV2} from '../../src/pan597/native-surfaces-v2.mjs';
import {createNativeWorkspaceInvocationsV1} from '../../src/pan548/native-model-free-invocations-v1.mjs';
import {protectedWorkspaceSetupStatusV1} from '../../src/pan527/origin-session-adapter.mjs';
import {createNativeWorkspaceContextProjectionV1} from '../../src/pan548/native-context-projection-v1.mjs';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {nativeWorkspaceInvocationExecutorConnectionV1} from '../../src/pan548/native-model-free-invocations-v1.mjs';
import {nativeRows} from '../fixtures/pan515/native-trade-fixture.mjs';
const registration={schemaVersion:'pansphaira.workspace-surface/register/v2',previousSurfaceId:null,previousProof:null,localGeneration:1,pinned:false,dirty:false};
import {fixture} from './native-fixture.mjs';
test('607 initial owner projection reads actual existing548 native task rows without raw text, authority or a fabricated Main request',async()=>{const x=await fixture();try{const p=x.snapshot();assert.equal(p.tasks.length,0);assert.equal(p.phase,'PREPARED');assert.equal(p.model,'NOT_RUN');assert.equal(p.executionAuthorityGranted,false);assert.equal(p.independentTargetEffectVerified,false);assert.equal(p.checkpointRequestSent,false);assert.equal(uiTaskDigestV2(JSON.parse(p.snapshotBytes)),p.snapshotDigest);assert.ok(Object.isFrozen(p));}finally{await x.close();}});
test('607 initial actual608 native preview task remains separate from rendering/profile save; owner snapshot retains native no-send and exact row result digest',async()=>{const x=await fixture();try{const result=x.preview(),p=x.snapshot(),row=p.tasks.find(r=>r.taskId===result.invocationId);assert.equal(row.state,'COMPLETED');assert.equal(row.resultPhase,'PREVIEW_VALIDATED');assert.equal(row.resultDigest,uiTaskDigestV2(result.result));assert.deepEqual(row.constraints,{localOnly:true,noSend:true,personalSave:false,sharedPublish:false});assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0);assert.equal(p.snapshotBytes.includes('Mach die Karte kleiner'),false);assert.equal(p.snapshotBytes.includes('admissionToken'),false);assert.equal(row.independentTargetEffectVerified,true);assert.equal(row.proof.issuerKind,'PAN546_PREVIEW_VALIDATED');assert.equal(row.proof.clientReportedDomCommit,false);assert.equal(row.proof.personalViewPersistenceProduced,false);}finally{await x.close();}});
test('697 ACT-02 every signed journal event carries the owner-issued versioned action descriptor bound to actual run/task/step/attempt, operation/schema/digests/idempotency/causality; intent acceptance alone never claims rendered or model activity',async()=>{const x=await fixture();try{
 const result=x.preview(),set=result.observation,p=x.snapshot();
 const intent=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===result.invocationId),done=p.events.find(e=>e.kind==='INTENT_COMPLETED'&&e.taskId===result.invocationId);
 assert.ok(intent&&done,'actual signed journal events exist for the preview attempt');
 const action=intent.action;
 assert.ok(action,'owner snapshot must carry the owner-issued action descriptor on the signed journal event');
 assert.equal(action.schemaVersion,'pansphaira.workspace-context/event-action/v1');
 assert.equal(action.taskId,result.invocationId);
 assert.equal(action.runId,'operation:ui-invocation-'+result.invocationId.slice(11));
 assert.equal(action.stepId,'step:'+result.invocationId,'step identity is the full unambiguous owner task id');
 assert.equal(action.attempt,1,'the actual reserved attempt is attempt 1');
 assert.equal(action.capability,'pan.workspace.view.preview/v1');
 assert.equal(action.operationSchemaVersion,'pansphaira.workspace-module-view/preview/v1');
 assert.equal(action.argumentDigest,intent.payload.argumentDigest);
 assert.equal(action.requestDigest,intent.payload.requestDigest);
 assert.deepEqual(action.idempotency,{operationId:action.runId,taskRequestDigest:intent.payload.requestDigest},'idempotency binds the real budget operation and row request digest');
 assert.deepEqual(action.causal,set.causal,'causal binding matches the actual admitted candidate set');
 assert.deepEqual(action.expectedRevisions,set.expectedRevisions,'expected revisions come from the actual admitted candidate');
 assert.equal(action.model,'NOT_RUN');assert.equal(action.executionAuthorityGranted,false);
 assert.ok(Object.isFrozen(action));
 assert.deepEqual(done.action,action,'the same attempt descriptor is stable across events of the task');
 assert.ok(p.events.filter(e=>e.taskId===result.invocationId).every(e=>e.action!==undefined));
 const small=x.snapshot('SPECIALIST_PREVIEW');
 assert.equal(small.events.find(e=>e.taskId===result.invocationId).action,undefined,'specialist audience stays minimized');
 // descriptor exposes no raw args/prompt and no independent effect claim beyond accepted intent
 assert.equal(JSON.stringify(p.events).includes('Mach die Karte kleiner'),false);
 assert.equal(intent.payload.state,'ACCEPTED');
 // checkpoint family has no budget run/causal set: the descriptor states those
 // facts as explicitly unavailable nulls instead of fabricating them.
 x.projection.correct(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/resource-correction/v1',context:x.f.verification(x.tab),kind:'OBJECT',objectId:'AP-PAN516-MATCHED-01',valueRef:'OBJ:CORRECTED-ONE'});
 const after=x.snapshot(),cp=after.events.find(e=>e.taskId.startsWith('checkpoint:'));
 assert.ok(cp&&cp.action,'checkpoint events carry the same versioned descriptor shape');
 assert.equal(cp.action.runId,null,'no native budget run exists for a checkpoint task');
 assert.equal(cp.action.causal,null);assert.equal(cp.action.expectedRevisions,null);assert.equal(cp.action.operationSchemaVersion,null,'checkpoint arguments carry no operation schema; never fabricated');
 assert.equal(cp.action.taskId,cp.taskId);assert.equal(cp.action.model,'NOT_RUN');
 // origin-epoch redaction applies to the descriptor itself: after revoke/switch no
 // retired run binding, digest or causal ref survives in the live projection bytes.
 const runId=intent.action.runId,argDigest=intent.payload.argumentDigest;
 x.projection.revoke(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/privacy-revoke/v1'});
 x.projection.providerSwitch(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/contract-session-switch/v1',context:x.f.verification(x.tab)});
 const retiredView=x.snapshot();
 assert.ok(retiredView.events.some(e=>e.taskId===result.invocationId&&e.kind==='PRIVACY_REDACTED'&&e.action===undefined),'retired-epoch events expose no action descriptor');
 assert.equal(retiredView.snapshotBytes.includes(runId),false,'retired run binding must not reappear');
 assert.equal(retiredView.snapshotBytes.includes(argDigest),false,'retired argument digest must not reappear');
}finally{await x.close();}});

test('697 ACT-02 the real executor dispatch boundary is journalled exactly once as TARGET_ATTEMPTED between admission and completion, pre-begin expiry never dispatches, and executor failure after a possible effect records OUTCOME_UNKNOWN atomically with the task-row transition instead of a fabricated completion',async t=>{const x=await fixture();try{
 const result=x.preview(),p=x.snapshot();
 const dispatch=p.events.filter(e=>e.kind==='TARGET_ATTEMPTED'&&e.taskId===result.invocationId);
 assert.equal(dispatch.length,1,'the actual executor dispatch boundary must be journalled exactly once, distinct from INTENT_ACCEPTED admission');
 const seqOf=kind=>p.events.find(e=>e.kind===kind&&e.taskId===result.invocationId).seq;
 assert.ok(seqOf('INTENT_ACCEPTED')<dispatch[0].seq&&dispatch[0].seq<seqOf('INTENT_COMPLETED'),'dispatch is journalled between admission and completion, never backfilled during projection');
 assert.equal(dispatch[0].action.attempt,1,'the single actual attempt stays attempt one; taskRevision is not attempt');
 assert.equal(dispatch[0].action.model,'NOT_RUN','no provider/model activity exists on this model-free seam');
 // expired admission before begin: zero dispatch and zero UNKNOWN facts.
 const r=x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Mach die Karte kleiner'},context:x.f.verification(x.tab),selectedCardId:'native-review',targetSurfaceId:null}),sel=r.set.candidates.find(c=>c.candidateId===r.set.selectedCandidateId);
 const a=x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:r.set.setId,requestDigest:r.set.requestDigest,setDigest:r.set.setDigest,candidateId:sel.candidateId,argumentDigest:sel.argumentDigest,policyRef:r.set.policyRef});
 t.mock.method(Date,'now',()=>r.set.expiresAtMs+1);
 assert.throws(()=>x.invocations.execute(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:a.invocationId,admissionToken:a.admissionToken,requestDigest:a.requestDigest,setDigest:a.setDigest,candidateId:a.candidateId,argumentDigest:a.argumentDigest,policyRef:a.policyRef}),/INVOCATION_|EXPIRED|SCOPE_/);
 t.mock.restoreAll();
 const expired=x.snapshot();
 assert.equal(expired.events.some(e=>e.taskId===a.invocationId&&['TARGET_ATTEMPTED','OUTCOME_UNKNOWN'].includes(e.kind)),false,'an admission that never began never dispatches and never fabricates outcome history');
 // real executor exception after the actual target acceptance: an owned SQLite abort at the
 // completion append loses the reply after the effect; the journal must then hold
 // INTENT_ACCEPTED, TARGET_ATTEMPTED and exactly one OUTCOME_UNKNOWN bound to the existing
 // task-row transition, with no INTENT_COMPLETED and no blind retry.
 const lost=x.preview(),{db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const createLostTrigger=taskId=>{db.exec("DROP TRIGGER IF EXISTS pan607_lost_reply");db.exec(`CREATE TEMP TRIGGER pan607_lost_reply AFTER INSERT ON workspace_ui_context_outbox_v1 WHEN NEW.task_id='${taskId}' AND NEW.kind='INTENT_COMPLETED' BEGIN SELECT RAISE(ABORT,'PAN607_LOST_REPLY'); END`);}
 try{
  const b=x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Mach die Karte kleiner'},context:x.f.verification(x.tab),selectedCardId:'native-review',targetSurfaceId:null}),m=b.set.candidates.find(c=>c.candidateId===b.set.selectedCandidateId);
  const ad=x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:b.set.setId,requestDigest:b.set.requestDigest,setDigest:b.set.setDigest,candidateId:m.candidateId,argumentDigest:m.argumentDigest,policyRef:b.set.policyRef});
  createLostTrigger(ad.invocationId);
  assert.throws(()=>x.invocations.execute(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:ad.invocationId,admissionToken:ad.admissionToken,requestDigest:ad.requestDigest,setDigest:ad.setDigest,candidateId:ad.candidateId,argumentDigest:ad.argumentDigest,policyRef:ad.policyRef}),/PAN607_LOST_REPLY/);
  const after=x.snapshot(),row=after.tasks.find(o=>o.taskId===ad.invocationId);
  assert.equal(row.ownerState,'OUTCOME_UNCONFIRMED','a lost reply after a possible real effect stays outcome-unconfirmed, never a fabricated completion');
  const facts=after.events.filter(e=>e.taskId===ad.invocationId);
  assert.deepEqual(facts.map(e=>e.kind),['INTENT_ACCEPTED','TARGET_ATTEMPTED','OUTCOME_UNKNOWN'],'dispatch and UNKNOWN are journalled atomically with the real executor boundary');
  assert.equal(facts[2].taskRevision,row.revision,'the UNKNOWN fact is bound to the exact post-transition task revision');
  assert.equal(facts[2].action.attempt,1);assert.equal(facts[2].action.model,'NOT_RUN');
  assert.equal(after.events.filter(e=>e.taskId===ad.invocationId&&e.kind==='INTENT_COMPLETED').length,0,'no success is claimed without the completed reply');
  createLostTrigger(ad.invocationId);
  assert.throws(()=>x.invocations.execute(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:ad.invocationId,admissionToken:ad.admissionToken,requestDigest:ad.requestDigest,setDigest:ad.setDigest,candidateId:ad.candidateId,argumentDigest:ad.argumentDigest,policyRef:ad.policyRef}),/INVOCATION_ATTEMPT_ALREADY_REQUIRES_READBACK/);
  const retried=x.snapshot();
  assert.deepEqual(retried.events.filter(e=>e.taskId===ad.invocationId).map(e=>e.kind),['INTENT_ACCEPTED','TARGET_ATTEMPTED','OUTCOME_UNKNOWN'],'a redelivered attempt cannot duplicate events or blindly retry the UNKNOWN effect');
 }finally{db.exec('DROP TRIGGER pan607_lost_reply');}
 assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0,'reading, snapshotting and retry rejection change zero stored target state on this preview seam');
}finally{await x.close();}});
test('697 ACT-02 dispatch journalling aborts atomically below the owner fence, forged or copied handles mutate nothing, and the owner-bound factual UNKNOWN survives later privacy revocation as a durable redacted fact',async t=>{const x=await fixture();try{
 const connection=nativeWorkspaceInvocationExecutorConnectionV1(x.invocations),{db,contextJournal}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const resolve=()=>x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Mach die Karte kleiner'},context:x.f.verification(x.tab),selectedCardId:'native-review',targetSurfaceId:null});
 const admit=r=>x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:r.set.setId,requestDigest:r.set.requestDigest,setDigest:r.set.setDigest,candidateId:r.set.candidates.find(c=>c.candidateId===r.set.selectedCandidateId).candidateId,argumentDigest:r.set.candidates.find(c=>c.candidateId===r.set.selectedCandidateId).argumentDigest,policyRef:r.set.policyRef});
 const exec=a=>({schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:a.invocationId,admissionToken:a.admissionToken,requestDigest:a.requestDigest,setDigest:a.setDigest,candidateId:a.candidateId,argumentDigest:a.argumentDigest,policyRef:a.policyRef});
 // The caller cannot select dispatch/UNKNOWN phases through the public record seam.
 const first=admit(resolve());
 assert.throws(()=>contextJournal.record(x.tab.headers,first.invocationId,'TARGET_ATTEMPTED'),/CONTEXT_EVENT_KIND_DENIED/);
 assert.throws(()=>contextJournal.record(x.tab.headers,first.invocationId,'OUTCOME_UNKNOWN'),/CONTEXT_EVENT_KIND_DENIED/);
 // A dispatch journalling abort (owned abort at the projection copy of exactly this
 // TARGET_ATTEMPTED append) leaves NO partial fact, a still-ACCEPTED row and no
 // private dispatch receipt: the caller never reaches the target and a forged or
 // copied handle cannot even transition the task row below the fence.
 const effect=connection.begin(x.tab.headers,exec(first));
 db.exec("CREATE TEMP TRIGGER pan607_dispatch_abort AFTER INSERT ON workspace_ui_context_projection_v1 BEGIN SELECT RAISE(ABORT,'PAN607_DISPATCH_ABORT'); END");
 assert.throws(()=>connection.dispatch(x.tab.headers,effect),/PAN607_DISPATCH_ABORT/);
 db.exec('DROP TRIGGER pan607_dispatch_abort');
 const midway=x.snapshot();
 assert.equal(midway.events.some(e=>e.taskId===first.invocationId&&e.kind==='TARGET_ATTEMPTED'),false,'an aborted dispatch append leaves no partial dispatch fact');
 assert.equal(midway.tasks.find(o=>o.taskId===first.invocationId).ownerState,'ACCEPTED','an aborted dispatch leaves the begun attempt accepted, not outcome-guessed');
 assert.throws(()=>connection.failed({invocationId:first.invocationId,ownerBinding:{principalDigest:'f'.repeat(64),privacyEpoch:1}}),/INVOCATION_HANDLE_UNBOUND/,'a copied or caller-forged handle carries no authority and is rejected before any task CAS');
 assert.equal(db.prepare('SELECT state FROM workspace_ui_tasks_v2 WHERE command_id=?').get(first.invocationId).state,'ACCEPTED','a rejected forged handle mutates zero task state');
 assert.throws(()=>connection.failed(Object.assign({},effect)),/INVOCATION_HANDLE_UNBOUND/,'a shallow copy of the owner-issued handle carries no authority');
 connection.failed(effect);
 assert.equal(db.prepare("SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=?").get(first.invocationId).n,1,'a duplicate failed call on the undispatched genuine handle adds zero events and no UNKNOWN fact');
 assert.throws(()=>connection.dispatch(x.tab.headers,{invocationId:first.invocationId,s:effect.s,member:effect.member}),/INVOCATION_HANDLE_UNBOUND/,'a forged effect object cannot pass the dispatch fence');
 assert.equal(db.prepare('SELECT state FROM workspace_ui_tasks_v2 WHERE command_id=?').get(first.invocationId).state,'OUTCOME_UNCONFIRMED','the genuine pre-dispatch handle still transitions the begun attempt (legacy failure seam)');
 assert.equal(db.prepare("SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='OUTCOME_UNKNOWN'").get(first.invocationId).n,0,'a pre-dispatch failure records no UNKNOWN fact for an undispatched attempt');
 // Genuine owner-issued begin/dispatch; then the reply is lost AFTER a privacy
 // revocation: the factual UNKNOWN must still persist under the intent's origin epoch.
 const second=admit(resolve()),effect2=connection.begin(x.tab.headers,exec(second));
 connection.dispatch(x.tab.headers,effect2);
 const liveDispatch=x.snapshot().events.find(e=>e.taskId===second.invocationId&&e.kind==='TARGET_ATTEMPTED');
 x.projection.revoke(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/privacy-revoke/v1'});
 connection.failed(effect2);
 connection.failed(effect2);
 // The revoked-epoch reader sees no plaintext facts for the retired attempt; the
 // durable owner outbox is the authoritative place to observe the atomic UNKNOWN.
 assert.throws(()=>x.snapshot(),/CONTEXT_PRIVACY_REVOKED/,'the revoked live snapshot is denied, never silently re-authorized');
 assert.equal(db.prepare("SELECT state FROM workspace_ui_tasks_v2 WHERE command_id=?").get(second.invocationId).state,'OUTCOME_UNCONFIRMED');
 const raw=db.prepare("SELECT kind,privacy_epoch,task_revision FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='OUTCOME_UNKNOWN'").all(second.invocationId);
 assert.equal(raw.length,1,'a duplicate failed call cannot duplicate the UNKNOWN fact');
 assert.equal(db.prepare("SELECT privacy_epoch FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='TARGET_ATTEMPTED'").get(second.invocationId).privacy_epoch,raw[0].privacy_epoch,'UNKNOWN is bound to the same intent origin epoch as the dispatch fact, not the current revoked epoch');
 assert.equal(raw[0].privacy_epoch,1,'both dispatch facts stay under the intent origin epoch');
 assert.equal(db.prepare('SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=?').get(second.invocationId).n,3,'exactly accept, dispatch and UNKNOWN facts exist for the lost-reply attempt');
 assert.ok(liveDispatch.seq>0);
 // A durable completion is never overwritten by a late or duplicate failed call.
 x.projection.providerSwitch(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/contract-session-switch/v1',context:x.f.verification(x.tab)});
 const done=x.preview();
 assert.throws(()=>connection.failed({invocationId:done.invocationId}),/INVOCATION_HANDLE_UNBOUND/,'a forged handle cannot touch a completed attempt');
 connection.failed(effect2);
 const final=x.snapshot(),row=final.tasks.find(o=>o.taskId===done.invocationId);
 assert.equal(row.ownerState,'COMPLETED');assert.equal(row.state,'COMPLETED','a failed call after a durable completion cannot downgrade the confirmed result');
 assert.equal(final.events.some(e=>e.taskId===done.invocationId&&e.kind==='OUTCOME_UNKNOWN'),false);
 assert.equal(final.events.filter(e=>e.taskId===done.invocationId&&e.kind==='TARGET_ATTEMPTED').length,1,'the executor path records the dispatch boundary exactly once');
 assert.equal(final.events.some(e=>e.taskId===done.invocationId&&e.kind==='PROPOSAL_VALIDATED'),true,'the completed attempt keeps its independently validated target proof');
 assert.equal(final.events.some(e=>canonicalJson(e).includes(done.admissionToken)),false,'dispatch evidence still exposes no raw token, arguments or prompt');
 }finally{await x.close();}});
test('607 initial native owner close/reopen retains same canonical task snapshot, not a process-restart or completion-event acceptance claim',async()=>{const x=await fixture();try{x.preview();const before=x.snapshot();x.reopenOwner();const after=x.snapshot();assert.equal(after.snapshotDigest,before.snapshotDigest);assert.equal(after.snapshotBytes,before.snapshotBytes);assert.equal(after.tasks.length,1);assert.equal(after.tasks[0].state,'COMPLETED');assert.equal(after.journalContractImplemented,true);assert.equal(after.independentTargetEffectVerified,true);assert.equal(after.events.filter(e=>e.kind==='INTENT_COMPLETED').length,1);}finally{await x.close();}});
test('607 initial specialist audience is its own minimized native task projection, not the complete Main task bytes',async()=>{const x=await fixture();try{x.preview();const main=x.snapshot(),small=x.snapshot('SPECIALIST_PREVIEW');assert.equal(small.audience,'SPECIALIST_PREVIEW');assert.notEqual(small.snapshotDigest,main.snapshotDigest);assert.equal(small.tasks.length,1);assert.equal(Object.hasOwn(small.tasks[0],'resourceRefs'),false);assert.equal(small.tasks[0].constraints.noSend,true);assert.equal(small.snapshotBytes.includes('AP-PAN516-MATCHED-01'),false);assert.equal(small.executionAuthorityGranted,false);}finally{await x.close();}});
test('607 initial owner snapshot denies caller proof/authority/audience/data extras, copied owner and accessors before reading; foreign principal cannot read own task',async()=>{const x=await fixture();try{x.preview();const req={schemaVersion:'pansphaira.workspace-context-projection/snapshot-request/v1',audience:'MAIN_CONTRACT'};for(const bad of [{...req,noSend:false},{...req,proof:'EXECUTOR'},{...req,tasks:[]},{...req,audience:'FOREIGN_MODEL'}])assert.throws(()=>x.projection.snapshot(x.tab.headers,bad),/CONTEXT_PROJECTION_/);let reads=0;const bad={schemaVersion:req.schemaVersion};Object.defineProperty(bad,'audience',{enumerable:true,get(){reads++;return req.audience;}});assert.throws(()=>x.projection.snapshot(x.tab.headers,bad),/CONTEXT_PROJECTION_/);assert.equal(reads,0);assert.throws(()=>createNativeWorkspaceContextProjectionV1({sessions:x.f.sessions,tasks:{...x.tasks}}),/UI_TASK_OWNER_DENIED/);const foreign=x.f.tab(x.f.issue('synthetic:other-reader','reader'));assert.equal(x.projection.snapshot(foreign.headers,req).tasks.length,0);assert.equal(x.snapshot().tasks.length,1);}finally{await x.close();}});

test('607 actual existing597 document target completion/current548 display task is projected, never omitted or promoted from acceptance to render',async()=>{


 const x=await fixture();try{
  const target=x.f.tab(x.tab.headers);target.surface=x.surfaces.register(target.headers,registration);target.headers={...target.headers,'x-pan597-surface':target.surface.surfaceId,'x-pan597-proof':target.surface.surfaceProof};
  const source=x.surfaces.register(x.tab.headers,{...registration,previousSurfaceId:x.tab.headers['x-pan597-surface'],previousProof:x.tab.headers['x-pan597-proof']});x.tab.headers={...x.tab.headers,'x-pan597-surface':source.surfaceId,'x-pan597-proof':source.surfaceProof};
  const command={schemaVersion:'pansphaira.workspace-surface/display-command/v2',commandId:'display:'+'d'.repeat(32),sourceSurfaceId:source.surfaceId,sourceConnectionEpoch:source.connectionEpoch,sourceContextEpoch:source.contextEpoch,sourceRevisionDigest:source.revisionDigest,targetSurfaceId:target.surface.surfaceId,targetConnectionEpoch:target.surface.connectionEpoch,targetContextEpoch:target.surface.contextEpoch,targetRevisionDigest:target.surface.revisionDigest,targetLocalGeneration:target.surface.localGeneration,routeId:'pan.erv.document.v2',objectId:x.tab.context.primaryObject.objectId,expectedRevision:x.tab.context.primaryObject.revision,expiresAtMs:Math.min(x.tab.context.lease.expiresAtMs,target.context.lease.expiresAtMs)};
  x.surfaces.accept(x.tab.headers,command);const accepted=x.snapshot();assert.equal(accepted.tasks.length,1);assert.equal(accepted.tasks[0].state,'ACCEPTED');assert.equal(accepted.tasks[0].resultPhase,null);assert.equal(accepted.tasks[0].constraints.noSend,true);
  x.surfaces.events(target.headers,{schemaVersion:'pansphaira.workspace-surface/events/v2',cursor:0});const loaded=x.surfaces.load(target.headers,{schemaVersion:'pansphaira.workspace-surface/load/v2',commandId:command.commandId});const permit=x.surfaces.beforeCommit(target.headers,{schemaVersion:'pansphaira.workspace-surface/before-dom/v2',commandId:command.commandId,readToken:loaded.readToken,projectionDigest:loaded.projection.projectionDigest,localGeneration:1});const receipt=x.surfaces.acknowledge(target.headers,{schemaVersion:'pansphaira.workspace-surface/render-ack/v2',commandId:command.commandId,commitToken:permit.commitToken,projectionDigest:loaded.projection.projectionDigest,localGeneration:1,contextEpoch:permit.surface.contextEpoch,domCommitted:true});
  const completed=x.snapshot();assert.equal(completed.tasks.length,1);assert.equal(completed.tasks[0].state,'COMPLETED');assert.equal(completed.tasks[0].resultPhase,'DOCUMENT_RENDERED');assert.equal(completed.tasks[0].resultDigest,uiTaskDigestV2(receipt.render));assert.equal(completed.tasks[0].resourceRefs.objectRef.objectId,command.objectId);assert.equal(completed.tasks[0].constraints.noSend,true);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0);
 }finally{await x.close();}
});

test('607 signed native548 completion/outbox repair is idempotent, retains original sequence and never repeats native target effects',async()=>{const x=await fixture();try{
 const effect=x.preview(),before=x.snapshot(),entry=before.events.find(e=>e.kind==='INTENT_COMPLETED');assert.ok(entry);assert.deepEqual(before.includedSequences,before.events.map(e=>e.seq));assert.deepEqual(before.omittedSequences,[]);assert.equal(before.constraints.noSend,true);
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);db.prepare('DELETE FROM workspace_ui_context_projection_v1 WHERE seq=?').run(entry.seq);
 const one=x.projection.reconcile(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/reconcile/v1'}),two=x.projection.reconcile(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/reconcile/v1'});assert.equal(one.repaired,1);assert.equal(two.repaired,0);assert.equal(one.targetRedispatched,false);assert.equal(x.snapshot().snapshotBytes,before.snapshotBytes);assert.equal(x.snapshot().events.filter(e=>e.kind==='INTENT_COMPLETED').length,1);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0);assert.equal(effect.result.phase,'PREVIEW_VALIDATED');
 }finally{await x.close();}});
test('607 target proofs resolve only independently signed original task/args/scope; forged executor label and foreign existing proof denied',async()=>{const x=await fixture();try{
 const a=x.preview(),b=x.preview(),snapshot=x.snapshot(),pa=snapshot.tasks.find(t=>t.taskId===a.invocationId).proof,pb=snapshot.tasks.find(t=>t.taskId===b.invocationId).proof;
 const request={schemaVersion:'pansphaira.workspace-context-projection/resolve-proof/v1',taskId:a.invocationId,proofRef:pa.proofRef},proof=x.projection.resolveProof(x.tab.headers,request);assert.equal(proof.independentOwnerRegisterVerified,true);assert.equal(proof.executionAuthorityGranted,false);assert.equal(proof.argumentDigest,pa.argumentDigest);assert.equal(proof.evidence.personalViewPersistenceProduced,false);
 assert.throws(()=>x.projection.resolveProof(x.tab.headers,{...request,proofRef:pb.proofRef}),/CONTEXT_PROOF_TASK_BYTES_CONFLICT/);assert.throws(()=>x.projection.resolveProof(x.tab.headers,{...request,executor:'EXECUTOR'}),/CONTEXT_PROOF_INPUT_DENIED/);assert.throws(()=>x.projection.resolveProof(x.tab.headers,{...request,proofRef:'context-proof:'+'f'.repeat(64)}),/CONTEXT_PROOF_SCOPE_DENIED/);
 }finally{await x.close();}});
test('607 jointly altered stored caller original bytes/hash and removal of actual native no-send cannot forge signed owner intent/proof',async()=>{const x=await fixture();try{
 const done=x.preview(),{db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding),row=db.prepare('SELECT * FROM workspace_ui_tasks_v2 WHERE command_id=?').get(done.invocationId),original=JSON.parse(row.original_command);original.candidate.objectRef.instanceId='invoice-value';db.prepare('UPDATE workspace_ui_tasks_v2 SET original_command=?,request_digest=? WHERE command_id=?').run(canonicalJson(original),uiTaskDigestV2(original),done.invocationId);assert.throws(()=>x.snapshot(),/CONTEXT_OWNER_INTENT_BYTES_CONFLICT/);
 original.candidate.constraints.noSend=false;db.prepare('UPDATE workspace_ui_tasks_v2 SET original_command=?,request_digest=? WHERE command_id=?').run(canonicalJson(original),uiTaskDigestV2(original),done.invocationId);assert.throws(()=>x.snapshot(),/CONTEXT_JOURNAL_NO_SEND_DENIED/);
 db.prepare('UPDATE workspace_ui_tasks_v2 SET original_command=?,request_digest=? WHERE command_id=?').run(row.original_command,row.request_digest,done.invocationId);const out=db.prepare('SELECT * FROM workspace_ui_context_outbox_v1 WHERE seq=1').get();db.prepare('UPDATE workspace_ui_context_outbox_v1 SET bytes=? WHERE seq=1').run(out.bytes.replace('"noSend":true','"noSend":false'));assert.throws(()=>x.snapshot(),/CONTEXT_OWNER_SIGNATURE_DENIED/);db.prepare('UPDATE workspace_ui_context_outbox_v1 SET bytes=? WHERE seq=1').run(out.bytes);assert.equal(x.snapshot().constraints.noSend,true);
 }finally{await x.close();}});

test('607 independently signed completion/result bytes reject caller result revision/phase/hash changes without promoting proof to save/render',async()=>{const x=await fixture();try{
 const done=x.preview(),{db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding),row=db.prepare('SELECT * FROM workspace_ui_tasks_v2 WHERE command_id=?').get(done.invocationId),result=JSON.parse(row.result_json);result.phase='PERSONAL_PROFILE_SAVED';result.personalProfileSaved=true;db.prepare('UPDATE workspace_ui_tasks_v2 SET result_json=? WHERE command_id=?').run(canonicalJson(result),done.invocationId);assert.throws(()=>x.snapshot(),/CONTEXT_OWNER_RESULT_BYTES_CONFLICT/);assert.throws(()=>x.projection.resolveProof(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/resolve-proof/v1',taskId:done.invocationId,proofRef:db.prepare('SELECT proof_id FROM workspace_ui_context_proofs_v1 WHERE task_id=?').get(done.invocationId).proof_id}),/CONTEXT_OWNER_RESULT_BYTES_CONFLICT/);db.prepare('UPDATE workspace_ui_tasks_v2 SET result_json=? WHERE command_id=?').run(row.result_json,done.invocationId);assert.equal(x.snapshot().tasks[0].proof.targetPhase,'PREVIEW_VALIDATED');assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0);
 }finally{await x.close();}});

function genuineAcceptedWithoutTarget(x){const r=x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Mach die Karte kleiner'},context:x.f.verification(x.tab),selectedCardId:'native-review',targetSurfaceId:null}),s=r.set,m=s.candidates.find(c=>c.candidateId===s.selectedCandidateId),a=x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:s.setId,requestDigest:s.requestDigest,setDigest:s.setDigest,candidateId:m.candidateId,argumentDigest:m.argumentDigest,policyRef:s.policyRef}),connection=nativeWorkspaceInvocationExecutorConnectionV1(x.invocations);return connection.begin(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:a.invocationId,admissionToken:a.admissionToken,requestDigest:a.requestDigest,setDigest:a.setDigest,candidateId:a.candidateId,argumentDigest:a.argumentDigest,policyRef:a.policyRef});}
test('607 specific B1: genuine retired accepted invocation cannot recreate old resources in live stream/snapshot/payload/prompt after revoke/switch/reconcile',async()=>{const x=await fixture();try{
 const prior=x.preview(),oldProof=x.snapshot().tasks.find(t=>t.taskId===prior.invocationId).proof;const accepted=genuineAcceptedWithoutTarget(x),objectId=x.tab.context.primaryObject.objectId;x.projection.revoke(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/privacy-revoke/v1'});x.projection.providerSwitch(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/contract-session-switch/v1',context:x.f.verification(x.tab)});assert.equal(x.snapshot().snapshotBytes.includes(objectId),false);assert.throws(()=>x.projection.resolveProof(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/resolve-proof/v1',taskId:prior.invocationId,proofRef:oldProof.proofRef}),/CONTEXT_PROOF_RETIRED_OR_UNREGISTERED/);assert.equal(x.projection.audit(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/audit/v1',taskId:prior.invocationId}).historicalAudit,true);const reconciled=x.projection.reconcile(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/reconcile/v1'}),snapshot=x.snapshot();assert.equal(snapshot.snapshotBytes.includes(objectId),false,'Retired original resources must not reappear under current event epoch');assert.equal(reconciled.targetRedispatched,false);assert.equal(snapshot.tasks.find(t=>t.taskId===accepted.invocationId).privacyRedacted,true);
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding),origin=db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='INTENT_ACCEPTED'").get(accepted.invocationId);db.prepare('UPDATE workspace_ui_context_outbox_v1 SET privacy_epoch=? WHERE task_id=?').run(snapshot.privacyEpoch,accepted.invocationId);assert.throws(()=>x.snapshot(),/CONTEXT_STREAM_GAP_OR_BYTES_DENIED/);db.prepare('UPDATE workspace_ui_context_outbox_v1 SET privacy_epoch=? WHERE task_id=?').run(origin.privacy_epoch,accepted.invocationId);
 const p=x.projection.prepare(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/prepare/v1',audience:'MAIN_CONTRACT',context:x.f.verification(x.tab),boundary:'TURN',previousRequestId:null,cursor:0});assert.equal(p.snapshotBytes.includes(objectId),false);assert.equal(p.payloadBytes.includes(objectId),false);assert.equal(p.promptBytes.includes(objectId),false);assert.equal(p.model,'NOT_RUN');
 }finally{await x.close();}});
const historyRequest=(ownerSeq,audience='MAIN_CONTRACT')=>({schemaVersion:'pansphaira.workspace-context-projection/history-request/v1',audience,ownerSeq});
function effectCounters(x){const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 return {orders:JSON.stringify(db.prepare('SELECT command_id,state,revision,result_json FROM workspace_ui_tasks_v2 ORDER BY command_id').all()),
  outbox:JSON.stringify(db.prepare('SELECT seq,event_key,kind,bytes,signature FROM workspace_ui_context_outbox_v1 ORDER BY seq').all()),
  proofs:db.prepare('SELECT COUNT(*) c FROM workspace_ui_context_proofs_v1').get().c,
  storeRevision:x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,
  snapshotDigest:x.snapshot().snapshotDigest};}
test('700 REC-01 seek to recorded INTENT_ACCEPTED owner seq returns the recorded earlier ACCEPTED state, not today COMPLETED row, with neutral step-list scope and retained source-bound action',async()=>{const x=await fixture();try{
 const result=x.preview(),p=x.snapshot();
 const accepted=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===result.invocationId);
 assert.ok(accepted,'actual recorded INTENT_ACCEPTED owner seq exists before completion');
 assert.equal(typeof x.projection.history,'function','REC-01 owner-authorized versioned history read not yet delivered');
 const before=effectCounters(x);
 const h=x.projection.history(x.tab.headers,historyRequest(accepted.seq));
 assert.equal(h.mode,'HISTORY');assert.equal(h.ownerSeq,accepted.seq);assert.equal(h.availability,'AVAILABLE');assert.equal(h.gap,null);
 const step=h.steps.find(s=>s.seq===accepted.seq);
 assert.equal(step.taskId,result.invocationId);assert.equal(step.kind,'INTENT_ACCEPTED');assert.equal(step.state,'ACCEPTED','recorded earlier ACCEPTED state, never today COMPLETED row');
 assert.equal(step.resultDigest,null,'no completion result existed at the recorded accepted seq');
 const taskState=h.taskStates.find(s=>s.taskId===result.invocationId);
 assert.equal(taskState.state,'ACCEPTED');assert.equal(taskState.derivedFromSeq,accepted.seq);
 assert.equal(step.action.runId,'operation:ui-invocation-'+result.invocationId.slice(11),'source-bound run/step/attempt/causality retained from the recorded event, never inferred from current task state');
 assert.equal(step.action.stepId,'step:'+result.invocationId);assert.equal(step.action.attempt,1);
 assert.deepEqual(step.action.causal,result.observation.causal);
 assert.equal(h.scope.businessViewReconstruction,'UNAVAILABLE_NOT_RECORDED','no old view/object bytes were ever recorded; no fake full historical reconstruction');
 assert.equal(h.liveMayContinueSeparately,true);assert.equal(h.nativePauseDelivered,false);
 assert.equal(h.executionAuthorityGranted,false);assert.equal(h.model,'NOT_RUN');assert.equal(h.readerEffects,'NONE');assert.equal(h.targetRedispatched,false);
 assert.deepEqual(h.constraints,{localOnly:true,noSend:true,personalSave:false,sharedPublish:false});
 assert.ok(Object.isFrozen(h));
 assert.deepEqual(effectCounters(x),before,'history read causes zero task/outbox/proof/store/snapshot effects');
 assert.equal(canonicalJson(h.steps).includes('Mach die Karte kleiner'),false,'no raw prompt text in historical step bytes');
}finally{await x.close();}});
test('700 REC-01 HISTORY stays persistently distinct from LIVE: live reads perform a fresh current authorized snapshot and never reuse the historical object; reader input contract denies caller extras and unsupported versions',async()=>{const x=await fixture();try{
 const result=x.preview(),p=x.snapshot(),acceptedSeq=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===result.invocationId).seq;
 const h=x.projection.history(x.tab.headers,historyRequest(acceptedSeq));
 const live=x.snapshot();
 assert.equal(live.schemaVersion,'pansphaira.workspace-context-projection/owner-snapshot/v1','live re-reads the existing fresh authorized owner snapshot');
 assert.equal(live.mode,undefined,'live snapshot is not the historical response object');
 assert.equal(h.mode,'HISTORY');assert.equal(live.tasks.find(t=>t.taskId===result.invocationId).state,'COMPLETED','live shows today state, history keeps recorded ACCEPTED');
 assert.equal(h.steps.find(s=>s.seq===acceptedSeq).state,'ACCEPTED','the historical object was not mutated by the fresh live read');
 assert.equal(live.streamHead.seq,p.events.length);assert.equal(h.streamHead.seq,p.events.length,'history honestly reports the current signed stream head');
 for(const bad of [{...historyRequest(1),proof:'EXECUTOR'},{...historyRequest(1),audience:'FOREIGN_MODEL'},{...historyRequest(1),ownerSeq:1.5},{...historyRequest(1),grant:true},historyRequest(0)])
  assert.throws(()=>x.projection.history(x.tab.headers,bad),/CONTEXT_PROJECTION_REQUEST_DENIED/,'closed request contract: no caller proof/actor/grant extras, no non-positive or fractional owner seq');
 assert.throws(()=>x.projection.history(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/history-request/v2',audience:'MAIN_CONTRACT',ownerSeq:1}),/CONTEXT_PROJECTION_REQUEST_DENIED/,'unsupported version denied honestly');
 const small=x.projection.history(x.tab.headers,historyRequest(acceptedSeq,'SPECIALIST_PREVIEW'));
 assert.equal(small.steps.find(s=>s.seq===acceptedSeq).action,undefined,'specialist history audience stays minimized like the live snapshot');
 assert.equal(Object.hasOwn(small.steps.find(s=>s.seq===acceptedSeq),'resourceRefs'),false);
}finally{await x.close();}});
test('700 REC-01 future/foreign/unrecorded seq and missing facts stay honest UNAVAILABLE gaps without renumbering or fake backfill; 100 rapid forward/back seeks cause zero effects',async()=>{const x=await fixture();try{
 const result=x.preview(),p=x.snapshot(),head=p.streamHead,acceptedSeq=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===result.invocationId).seq;
 const before=effectCounters(x);
 const future=x.projection.history(x.tab.headers,historyRequest(head.seq+5));
 assert.equal(future.availability,'UNAVAILABLE');assert.equal(future.gap.reason,'SEQ_UNRECORDED');assert.deepEqual(future.steps,[]);assert.equal(future.streamHead.seq,head.seq,'no renumbering: current signed head reported honestly');
 const foreign=x.f.tab(x.f.issue('synthetic:other-history','reader'));
 const foreignRead=x.projection.history(foreign.headers,historyRequest(acceptedSeq));
 assert.equal(foreignRead.availability,'UNAVAILABLE');assert.equal(foreignRead.gap.reason,'SEQ_UNRECORDED','foreign principal has no recorded events at that seq; nothing leaks');
 for(let i=0;i<100;i++){
  const seq=1+(i%head.seq);
  const h=x.projection.history(x.tab.headers,historyRequest(seq));
  assert.equal(h.mode,'HISTORY');
  assert.ok(h.steps.every(s=>s.seq<=seq),'never exposes events beyond the requested owner seq');
 }
 assert.deepEqual(effectCounters(x),before,'100 rapid forward/back seeks produce zero FACH/TOOL/PROVIDER/APPROVE/RESUME/DISPATCH effects and no new producer facts');
}finally{await x.close();}});
test('700 REC-01 revocation/switch cannot restore retired historical content or grants; event gap and actual proof mismatch are honest failures with no cached-bytes fallback',async()=>{const x=await fixture();try{
 const result=x.preview(),p=x.snapshot(),acceptedSeq=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===result.invocationId).seq,objectId=x.tab.context.primaryObject.objectId;
 x.projection.revoke(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/privacy-revoke/v1'});
 assert.throws(()=>x.projection.history(x.tab.headers,historyRequest(acceptedSeq)),/CONTEXT_PRIVACY_REVOKED/,'revoked reads get no historical content restore');
 x.projection.providerSwitch(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/contract-session-switch/v1',context:x.f.verification(x.tab)});
 const retired=x.projection.history(x.tab.headers,historyRequest(acceptedSeq));
 assert.equal(retired.availability,'UNAVAILABLE');assert.equal(retired.gap.reason,'SOURCE_RETIRED','providerSwitch cannot revive retired sources');
 assert.equal(retired.steps.every(s=>s.state==='UNAVAILABLE'&&s.action===null),true);
 assert.equal(canonicalJson(retired).includes(objectId),false,'retired resource refs never reappear');
 assert.equal(canonicalJson(retired).includes('operation:ui-invocation-'+result.invocationId.slice(11)),false,'retired run binding never restored from history');
 assert.equal(canonicalJson(retired).includes(p.events.find(e=>e.seq===acceptedSeq).payload.argumentDigest),false,'retired argument digest never restored');
 const before=effectCounters(x);
 // genuine event gap: remove one recorded outbox envelope inside the requested window
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding),gapRow=db.prepare('SELECT * FROM workspace_ui_context_outbox_v1 WHERE seq=2').get();
 db.prepare('DELETE FROM workspace_ui_context_outbox_v1 WHERE seq=2').run();
 const gapped=x.projection.history(x.tab.headers,historyRequest(3));
 assert.equal(gapped.availability,'UNAVAILABLE');assert.equal(gapped.gap.reason,'EVENT_GAP','gap is reported, never silently skipped or backfilled');
 db.prepare('INSERT INTO workspace_ui_context_outbox_v1 VALUES(?,?,?,?,?,?,?,?,?)').run(gapRow.principal_digest,gapRow.seq,gapRow.event_key,gapRow.task_id,gapRow.task_revision,gapRow.kind,gapRow.privacy_epoch,gapRow.bytes,gapRow.signature);
 // actual proof mismatch: altered signed envelope bytes must fail, not fall back to cached bytes
 const tampered=db.prepare('SELECT * FROM workspace_ui_context_outbox_v1 WHERE seq=1').get();
 db.prepare('UPDATE workspace_ui_context_outbox_v1 SET bytes=? WHERE seq=1').run(tampered.bytes.replace('"noSend":true','"noSend":false'));
 assert.throws(()=>x.projection.history(x.tab.headers,historyRequest(1)),/CONTEXT_OWNER_SIGNATURE_DENIED/,'proof mismatch denies the read; no cached-bytes fallback');
 db.prepare('UPDATE workspace_ui_context_outbox_v1 SET bytes=? WHERE seq=1').run(tampered.bytes);
 assert.equal(effectCounters(x).outbox,before.outbox,'gap/tamper probes left the restored signed outbox byte-identical: no reader-side repair mutation');
 const live=x.projection.history(x.tab.headers,historyRequest(3));
 assert.equal(live.availability,'UNAVAILABLE');assert.equal(live.gap.reason,'SOURCE_RETIRED','after honest failures the restored genuine record re-reads identically retired: deterministic, no cached-bytes fallback');
}finally{await x.close();}});
test('607 specific B2: authentic pre-journal legacy accepted row stays UNKNOWN while unrelated signed projection repair proceeds without redispatch or fake authority',async()=>{const x=await fixture();try{
 const valid=x.preview(),legacy=genuineAcceptedWithoutTarget(x),{db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);db.prepare('DELETE FROM workspace_ui_context_projection_v1 WHERE seq IN(SELECT seq FROM workspace_ui_context_outbox_v1 WHERE task_id=?)').run(legacy.invocationId);db.prepare('DELETE FROM workspace_ui_context_outbox_v1 WHERE task_id=?').run(legacy.invocationId);const completion=db.prepare("SELECT seq FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='INTENT_COMPLETED'").get(valid.invocationId);db.prepare('DELETE FROM workspace_ui_context_projection_v1 WHERE seq=?').run(completion.seq);assert.equal(x.snapshot().tasks.find(t=>t.taskId===legacy.invocationId).legacyUnregisteredIntent,true);
 const result=x.projection.reconcile(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/reconcile/v1'});assert.equal(result.repaired,1);assert.equal(result.targetRedispatched,false);const row=x.snapshot().tasks.find(t=>t.taskId===legacy.invocationId);assert.equal(row.state,'OUTCOME_UNCONFIRMED');assert.equal(row.independentTargetEffectVerified,false);assert.equal(x.snapshot().events.filter(e=>e.taskId===legacy.invocationId).length,0);assert.equal(x.snapshot().constraints.noSend,true);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0);
 }finally{await x.close();}});
test('697 ACT-02 retargeting a genuinely minted handle onto a different minted ACCEPTED task records zero false facts and a post-dispatch retarget still persists the original task UNKNOWN atomically',async()=>{const x=await fixture();try{
 const connection=nativeWorkspaceInvocationExecutorConnectionV1(x.invocations),{db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const resolve=()=>x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Mach die Karte kleiner'},context:x.f.verification(x.tab),selectedCardId:'native-review',targetSurfaceId:null});
 const admit=r=>x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:r.set.setId,requestDigest:r.set.requestDigest,setDigest:r.set.setDigest,candidateId:r.set.candidates.find(c=>c.candidateId===r.set.selectedCandidateId).candidateId,argumentDigest:r.set.candidates.find(c=>c.candidateId===r.set.selectedCandidateId).argumentDigest,policyRef:r.set.policyRef});
 const exec=a=>({schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:a.invocationId,admissionToken:a.admissionToken,requestDigest:a.requestDigest,setDigest:a.setDigest,candidateId:a.candidateId,argumentDigest:a.argumentDigest,policyRef:a.policyRef});
 const a=admit(resolve()),b=admit(resolve());
 const effectA=connection.begin(x.tab.headers,exec(a)),effectB=connection.begin(x.tab.headers,exec(b));
 const facts=()=>db.prepare('SELECT task_id,kind,seq FROM workspace_ui_context_outbox_v1 WHERE task_id IN(?,?) ORDER BY seq').all(a.invocationId,b.invocationId);
 const rows=()=>[a.invocationId,b.invocationId].map(id=>db.prepare('SELECT state,revision FROM workspace_ui_tasks_v2 WHERE command_id=?').get(id));
 // Pre-dispatch retarget borrows no rights: zero facts/rows move on either real task.
 const beforeFacts=facts(),beforeRows=rows();
 effectA.invocationId=b.invocationId;
 assert.throws(()=>connection.dispatch(x.tab.headers,effectA),/INVOCATION_HANDLE_UNBOUND/,'a retargeted genuine handle cannot borrow the second task dispatch boundary');
 assert.deepEqual(facts(),beforeFacts,'a rejected pre-dispatch retarget appends zero outbox facts on either task');
 assert.deepEqual(rows(),beforeRows,'a rejected pre-dispatch retarget transitions zero task rows');
 // The untouched handle still owns its own real boundary.
 connection.dispatch(x.tab.headers,effectB);
 connection.failed(effectB);
 assert.equal(db.prepare("SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='TARGET_ATTEMPTED'").get(b.invocationId).n,1,'the genuine handle still records its own dispatch');
 // Post-dispatch retarget: the original dispatched task keeps exactly one UNKNOWN
 // despite the rejection; the never-dispatched second task stays untouched.
 const c=admit(resolve()),d=admit(resolve());
 const effectC=connection.begin(x.tab.headers,exec(c)),effectD=connection.begin(x.tab.headers,exec(d));
 connection.dispatch(x.tab.headers,effectC);
 effectC.invocationId=d.invocationId;
 assert.throws(()=>connection.failed(effectC),/INVOCATION_HANDLE_UNBOUND/,'a retargeted dispatched handle is still rejected');
 assert.equal(db.prepare('SELECT state FROM workspace_ui_tasks_v2 WHERE command_id=?').get(c.invocationId).state,'OUTCOME_UNCONFIRMED','the actually dispatched attempt keeps its outcome-unconfirmed transition');
 assert.equal(db.prepare("SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='OUTCOME_UNKNOWN'").get(c.invocationId).n,1,'retargeting cannot discard the original task factual UNKNOWN');
 assert.equal(db.prepare("SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='OUTCOME_UNKNOWN'").get(d.invocationId).n,0,'no UNKNOWN fact may be misattributed to the never-dispatched task');
 assert.equal(db.prepare('SELECT state FROM workspace_ui_tasks_v2 WHERE command_id=?').get(d.invocationId).state,'ACCEPTED','a retargeted failed call cannot transition the never-dispatched task');
 connection.failed(effectD);
}finally{await x.close();}});
test('700 REC-01 repair03 sourceTimeAvailable tracks only the verified signed producer-clock sidecar: genuine preview true, absent legacy clock false/null, tampered clock fails closed, history state rights unchanged',async()=>{const x=await fixture();try{
 const r=x.preview(),p=x.snapshot(),acc=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===r.invocationId),done=p.events.find(e=>e.kind==='INTENT_COMPLETED'&&e.taskId===r.invocationId);
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const genuine=x.projection.history(x.tab.headers,historyRequest(acc.seq));
 const gstep=genuine.steps.find(s=>s.seq===acc.seq);
 assert.equal(gstep.sourceTimeAvailable,true,'authentic same-transaction append has a signed clock row');
 assert.ok(Number.isSafeInteger(gstep.sourceTimeMs)&&gstep.sourceTimeMs>=0,'exposed time is the existing verified sidecar value, not wallclock inference');
 assert.deepEqual(effectCounters(x),effectCounters(x),'clock exposure reads the same signed store');
 const effects=effectCounters(x);
 db.prepare('DELETE FROM workspace_ui_context_event_clock_v1 WHERE seq=?').run(acc.seq);
 const legacy=x.projection.history(x.tab.headers,historyRequest(done.seq));
 const lstep=legacy.steps.find(s=>s.seq===acc.seq);
 assert.equal(lstep.sourceTimeAvailable,false,'absent sidecar (pre-clock legacy scenario) must not claim time available');
 assert.equal(lstep.sourceTimeMs,null,'no timestamp may be synthesized for a missing sidecar');
 assert.equal(lstep.state,'ACCEPTED','missing clock evidence does not strip the genuinely recorded historical state');
 assert.equal(legacy.availability,'AVAILABLE','missing clock degrades time honesty only, never history rights');
 assert.deepEqual(effectCounters(x),effects,'missing-clock probe caused zero reader effects');
 const clockRow=db.prepare('SELECT bytes FROM workspace_ui_context_event_clock_v1 WHERE seq=?').get(done.seq);
 db.prepare('UPDATE workspace_ui_context_event_clock_v1 SET bytes=? WHERE seq=?').run(clockRow.bytes.replace('"unit":"COUNT"','"unit":"MS"'),done.seq);
 assert.throws(()=>x.projection.history(x.tab.headers,historyRequest(done.seq)),/EVENT_SOURCE_CLOCK_SIGNATURE_DENIED|EVENT_SOURCE_CLOCK_BYTES_DENIED/,'tampered clock fails closed, no cached fallback');
 db.prepare('UPDATE workspace_ui_context_event_clock_v1 SET bytes=? WHERE seq=?').run(clockRow.bytes,done.seq);
 const restored=x.projection.history(x.tab.headers,historyRequest(done.seq));
 assert.equal(restored.steps.find(s=>s.seq===done.seq).sourceTimeAvailable,true,'restored genuine sidecar reads available again deterministically');
 assert.deepEqual(effectCounters(x),effects,'tamper probe left the signed store byte-identical: zero reader effects');
}finally{await x.close();}});

const stepDetailRequest=(ownerSeq,audience='MAIN_CONTRACT')=>({schemaVersion:'pansphaira.workspace-context-projection/step-detail-request/v1',audience,ownerSeq});
function stepDetailFacts(x,{includeSnapshot=true}={}){const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 return {taskRows:JSON.stringify(db.prepare('SELECT command_id,request_digest,original_command,principal_digest,state,revision,result_json FROM workspace_ui_tasks_v2 ORDER BY command_id').all()),
  outbox:JSON.stringify(db.prepare('SELECT principal_digest,seq,event_key,task_id,task_revision,kind,privacy_epoch,bytes,signature FROM workspace_ui_context_outbox_v1 ORDER BY seq').all()),
  projection:JSON.stringify(db.prepare('SELECT * FROM workspace_ui_context_projection_v1 ORDER BY seq').all()),
  clocks:JSON.stringify(db.prepare('SELECT * FROM workspace_ui_context_event_clock_v1 ORDER BY seq').all()),
  proofs:JSON.stringify(db.prepare('SELECT * FROM workspace_ui_context_proofs_v1 ORDER BY proof_id').all()),
  control:JSON.stringify(db.prepare('SELECT * FROM workspace_ui_context_control_v1').all()),
  storeRevision:x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,
  ...(includeSnapshot?{snapshotDigest:x.snapshot().snapshotDigest}:{})};}

const producerRequest=ownerSeq=>({schemaVersion:'pansphaira.workspace-context-projection/preview-producer-request/v1',ownerSeq});
const batchRequest=(privacyEpoch,firstOwnerSeq=1,lastOwnerSeq=8)=>({schemaVersion:'pansphaira.workspace-context-projection/preview-producer-batch-request/v1',firstOwnerSeq,lastOwnerSeq,expectedPrivacyEpoch:privacyEpoch});
test('697 batch preview uses one existing owner transaction and returns exactly the two real completions',async t=>{const x=await fixture();try{
 x.preview();x.preview();const snapshot=x.snapshot();const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const peer=new DatabaseSync(db.prepare('PRAGMA database_list').all().find(r=>r.name==='main').file);
 try{
  peer.exec('PRAGMA busy_timeout=0');const expected=[4,8].map(n=>x.projection.previewProducer(x.tab.headers,producerRequest(n)).fact),original=DatabaseSync.prototype.prepare,changes=db.prepare('SELECT total_changes() AS n').get().n;
  let attempted=0;const mark=t.mock.method(DatabaseSync.prototype,'prepare',function(sql){
   if(this===db&&sql.includes('FROM workspace_ui_context_event_clock_v1')&&sql.includes('seq=?')&&!attempted++){
    assert.equal(db.isTransaction,true);
    assert.throws(()=>peer.exec('BEGIN IMMEDIATE'),err=>err.errcode===5);
   }
   return original.call(this,sql);
  });
  let result;try{assert.equal(typeof x.projection.previewProducerBatch,'function','one bounded owner transaction for both facts is missing');result=x.projection.previewProducerBatch(x.tab.headers,batchRequest(snapshot.privacyEpoch));}finally{mark.mock.restore();}
  assert.ok(attempted>0,'writer contention checked during real clock access');
  assert.deepEqual(result,{schemaVersion:'pansphaira.workspace-context-projection/preview-producer-batch/v1',availability:'AVAILABLE',reason:null,firstUnresolvedOwnerSeq:null,facts:expected,executionAuthorityGranted:false});
  assert.ok(Object.isFrozen(result.facts)&&Object.isFrozen(result.facts[0]));assert.equal(db.prepare('SELECT total_changes() AS n').get().n,changes);
  peer.exec('BEGIN IMMEDIATE; ROLLBACK');
 }finally{peer.close();}
}finally{await x.close();}});

test('697 batch preview never returns a partial batch when a later fact is missing its source clock or the range exceeds the head',async()=>{const x=await fixture();try{
 x.preview();x.preview();const {privacyEpoch,principalDigest}=x.snapshot(),{db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const headers=x.tab.headers,batch=(first=1,last=8)=>x.projection.previewProducerBatch(headers,batchRequest(privacyEpoch,first,last));
 db.prepare('DELETE FROM workspace_ui_context_event_clock_v1 WHERE principal_digest=? AND seq=8').run(principalDigest);
 const original=x.projection.previewProducer(headers,producerRequest(4));assert.equal(original.availability,'AVAILABLE');
 const blocked=batch();assert.equal(blocked.reason,'SOURCE_CLOCK_UNAVAILABLE');assert.equal(blocked.firstUnresolvedOwnerSeq,8);assert.deepEqual(blocked.facts,[]);
 const beyond=batch(4,9);assert.equal(beyond.reason,'SEQ_UNRECORDED');assert.equal(beyond.firstUnresolvedOwnerSeq,9);assert.deepEqual(beyond.facts,[]);
 assert.deepEqual(x.projection.previewProducer(headers,producerRequest(4)),original);
}finally{await x.close();}});

test('697 batch preview denies retired epochs, foreign scope and invalid ranges without facts',async()=>{const x=await fixture();try{
 x.preview();x.preview();const {privacyEpoch}=x.snapshot(),headers=x.tab.headers,request=batchRequest(privacyEpoch);
 for(const invalid of [batchRequest(privacyEpoch,1,17),batchRequest(privacyEpoch,8,7),batchRequest(privacyEpoch,0,8),batchRequest(0),{...request,principalDigest:'forged'}])
  assert.throws(()=>x.projection.previewProducerBatch(headers,invalid),/CONTEXT_PROJECTION_REQUEST_DENIED/);
 const foreign=x.projection.previewProducerBatch(x.f.issue('synthetic:foreign-owner-preview-batch','reader'),request);assert.equal(foreign.availability,'UNAVAILABLE');assert.deepEqual(foreign.facts,[]);
 x.projection.revoke(headers,{schemaVersion:'pansphaira.workspace-context-projection/privacy-revoke/v1'});
 assert.throws(()=>x.projection.previewProducerBatch(headers,request),/CONTEXT_PRIVACY_REVOKED/);
 x.projection.providerSwitch(headers,{schemaVersion:'pansphaira.workspace-context-projection/contract-session-switch/v1',context:x.f.verification(x.tab)});
 const retired=x.projection.previewProducerBatch(headers,request);assert.equal(retired.reason,'SOURCE_RETIRED');assert.deepEqual(retired.facts,[]);
}finally{await x.close();}});

test('697 producer projection reports a truncated signed outbox tail rather than an unrecorded sequence',async()=>{const x=await fixture();try{
 const result=x.preview(),snapshot=x.snapshot(),event=snapshot.events.at(-1);
 assert.equal(event.taskId,result.invocationId);assert.equal(event.kind,'INTENT_COMPLETED');
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding),args=[snapshot.principalDigest,event.seq];
 const read=seq=>x.projection.previewProducer(x.tab.headers,producerRequest(seq));
 assert.equal(read(event.seq).availability,'AVAILABLE');
 assert.equal(read(event.seq+1).reason,'SEQ_UNRECORDED');
 const clock=db.prepare('SELECT * FROM workspace_ui_context_event_clock_v1 WHERE principal_digest=? AND seq=?').get(...args);
 const projection=db.prepare('SELECT * FROM workspace_ui_context_projection_v1 WHERE principal_digest=? AND seq=?').get(...args);
 assert.equal(canonicalJson(JSON.parse(projection.bytes)),projection.bytes);
 assert.equal(JSON.parse(clock.bytes).eventDigest,event.eventDigest);
 assert.equal(db.prepare('DELETE FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND seq=?').run(...args).changes,1);
 for(const seq of [event.seq-1,event.seq,event.seq+1])assert.throws(()=>read(seq),/CONTEXT_STREAM_GAP_OR_BYTES_DENIED/);
 db.prepare('DELETE FROM workspace_ui_context_event_clock_v1 WHERE principal_digest=? AND seq=?').run(...args);
 assert.throws(()=>read(event.seq),/CONTEXT_STREAM_GAP_OR_BYTES_DENIED/,'projection alone proves inconsistency');
 db.prepare('DELETE FROM workspace_ui_context_projection_v1 WHERE principal_digest=? AND seq=?').run(...args);
 db.prepare('INSERT INTO workspace_ui_context_event_clock_v1 VALUES(?,?,?,?)').run(...args,clock.bytes,clock.signature);
 assert.throws(()=>read(event.seq),/CONTEXT_STREAM_GAP_OR_BYTES_DENIED/,'clock alone proves inconsistency');
 assert.equal(db.prepare('SELECT count(*) AS n FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND seq=?').get(...args).n,0,'reader never repairs the damaged outbox');
 const other=x.f.tab(x.f.issue('synthetic:foreign-truncated-tail','reader'));
 assert.equal(x.projection.previewProducer(other.headers,producerRequest(event.seq)).reason,'SEQ_UNRECORDED','a foreign tail cannot affect this principal');
}finally{await x.close();}});
for(const sidecar of ['projection','clock'])test(`REC-01/02 historical reads report a truncated tail with only the ${sidecar} witness`,async()=>{const x=await fixture();try{
 const preview=x.preview(),snapshot=x.snapshot(),end=snapshot.events.at(-1);
 assert.equal(end.taskId,preview.invocationId);assert.equal(end.kind,'INTENT_COMPLETED');
 const readers=[
  {call:(headers,seq)=>x.projection.history(headers,historyRequest(seq)),empty:r=>assert.deepEqual([r.steps,r.taskStates],[[],[]])},
  {call:(headers,seq)=>x.projection.stepDetail(headers,stepDetailRequest(seq)),empty:r=>assert.equal(r.step,null)},
 ];
 const foreign=x.f.tab(x.f.issue('synthetic:foreign-historical-tail','reader'));
 const foreignBefore=readers.map(({call})=>call(foreign.headers,end.seq));
 for(const {call} of readers){assert.equal(call(x.tab.headers,end.seq).availability,'AVAILABLE');assert.equal(call(x.tab.headers,end.seq+1).gap.reason,'SEQ_UNRECORDED');}
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding),args=[snapshot.principalDigest,end.seq];
 const lose=sidecar==='projection'?'DELETE FROM workspace_ui_context_event_clock_v1 WHERE principal_digest=? AND seq=?':'DELETE FROM workspace_ui_context_projection_v1 WHERE principal_digest=? AND seq=?';
 assert.equal(db.prepare('DELETE FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND seq=?').run(...args).changes,1);
 assert.equal(db.prepare(lose).run(...args).changes,1);
 // A LIVE snapshot already denies this loss because task completion lacks its outbox row.
 const rowsOnly={includeSnapshot:false},before=stepDetailFacts(x,rowsOnly),sequences=[end.seq-1,end.seq,end.seq+1];
 const observed=readers.map(({call},i)=>sequences.map(seq=>{
  try{return call(x.tab.headers,seq);}catch(error){
   if(error.message!=='CONTEXT_COMPLETION_OUTBOX_REQUIRED')throw error;
   return {mode:i===0?'HISTORY':'STEP_DETAIL',availability:'THREW',gap:{reason:error.message}};
  }
 }));
 assert.deepEqual(observed.map(results=>results.map(r=>[r.mode,r.availability,r.gap?.reason??null])),
  ['HISTORY','STEP_DETAIL'].map(mode=>sequences.map(()=>[mode,'UNAVAILABLE','EVENT_GAP'])), 'retained outbox tail witness must not look like an unrecorded sequence or a complete prefix');
 for(const [i,{empty}] of readers.entries())for(const [j,seq] of sequences.entries()){
  const r=observed[i][j];assert.deepEqual(r.gap,{reason:'EVENT_GAP',requestedSeq:seq});assert.equal(r.streamHead,null);
  empty(r);assert.equal(r.readerEffects,'NONE');assert.equal(r.targetRedispatched,false);assert.equal(r.executionAuthorityGranted,false);
 }
 assert.deepEqual(readers.map(({call})=>call(foreign.headers,end.seq)),foreignBefore,'tail witness must be scoped to the authenticated principal');
 assert.deepEqual(stepDetailFacts(x,rowsOnly),before,'historical readers never repair, append or change the store');
}finally{await x.close();}});
test('697 producer projection binds the signed preview completion to its attached proof, append clock and independent persisted readback',async()=>{const x=await fixture();try{
 const preview=x.preview(),view=x.snapshot(),event=view.events.find(e=>e.taskId===preview.invocationId&&e.kind==='INTENT_COMPLETED');
 const detail=x.projection.stepDetail(x.tab.headers,stepDetailRequest(event.seq)).step;
 const custody=x.invocations.read(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/read/v1',invocationId:preview.invocationId}).custody;
 const before=stepDetailFacts(x),request=producerRequest(event.seq);
 assert.equal(typeof x.projection.previewProducer,'function','confirmed preview lacks a local owner producer projection');
 const read=x.projection.previewProducer(x.tab.headers,request);
 assert.deepEqual(read,{
  schemaVersion:'pansphaira.workspace-context-projection/preview-producer/v1',availability:'AVAILABLE',reason:null,
  fact:{ownerSequence:event.seq,eventDigest:event.eventDigest,privacyEpoch:event.privacyEpoch,
   runId:event.action.runId,taskId:event.taskId,stepId:event.action.stepId,attempt:event.action.attempt,taskRevision:custody.task.revision,
   capability:'pan.workspace.view.preview/v1',phase:preview.observation.phase,resultPhase:custody.task.result.phase,
   requestDigest:custody.task.requestDigest,argumentDigest:event.payload.argumentDigest,resultDigest:uiTaskDigestV2(custody.task.result),
   proof:{proofRef:event.payload.proofRef,issuerKind:detail.proof.issuerKind},
   readback:{independentRead:true,writerEpoch:custody.writerEpoch},
   appendClock:{sourceTimeMs:detail.sourceTimeMs,sourceBootEpoch:custody.writerEpoch}},
  executionAuthorityGranted:false,
 });
 assert.notEqual(read.fact.stepId,preview.observation.stepId,'the signed full task step ID is canonical here; the legacy observe DTO remains unchanged');
 assert.ok(Object.isFrozen(read.fact.proof));
 for(let i=0;i<3;i++)assert.deepEqual(x.projection.previewProducer(x.tab.headers,request),read);
 assert.deepEqual(stepDetailFacts(x),before,'re-reads do not touch the existing task rows, signed outbox, proof, clock or live snapshot');
}finally{await x.close();}});

test('697 producer projection never exports an earlier, unrecorded, foreign or retired step',async()=>{const x=await fixture();try{
 const preview=x.preview(),view=x.snapshot(),events=view.events.filter(e=>e.taskId===preview.invocationId);
 const seq=events.find(e=>e.kind==='INTENT_COMPLETED').seq,read=(n,headers=x.tab.headers)=>x.projection.previewProducer(headers,producerRequest(n));
 const unavailable=(result,reason)=>assert.deepEqual(result,{schemaVersion:'pansphaira.workspace-context-projection/preview-producer/v1',availability:'UNAVAILABLE',reason,fact:null,executionAuthorityGranted:false});
 for(const e of events.filter(e=>e.seq!==seq))unavailable(read(e.seq),'PREVIEW_COMPLETION_NOT_OBSERVED');
 unavailable(read(view.streamHead.seq+1),'SEQ_UNRECORDED');
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const scopes=()=>db.prepare('SELECT * FROM workspace_ui_context_scope_v1 ORDER BY principal_digest').all(),before=scopes();
 unavailable(read(seq,x.f.issue('synthetic:other-producer-reader','reader')),'SEQ_UNRECORDED');
 assert.deepEqual(scopes(),before,'foreign read must not create a scope or return anyone else’s owner fact');
 for(const request of [{...producerRequest(seq),proofRef:events.at(-1).payload.proofRef},{...producerRequest(seq),phase:'RESULT_CONFIRMED'},producerRequest(0),producerRequest(1.5)])
  assert.throws(()=>x.projection.previewProducer(x.tab.headers,request),/CONTEXT_PROJECTION_REQUEST_DENIED/);
 x.projection.revoke(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/privacy-revoke/v1'});
 assert.throws(()=>read(seq),/CONTEXT_PRIVACY_REVOKED/);
 x.projection.providerSwitch(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/contract-session-switch/v1',context:x.f.verification(x.tab)});
 unavailable(read(seq),'SOURCE_RETIRED');
}finally{await x.close();}});

test('697 producer projection denies a substituted proof binding and does not infer a missing append clock',async()=>{const x=await fixture();try{
 const preview=x.preview(),event=x.snapshot().events.find(e=>e.taskId===preview.invocationId&&e.kind==='INTENT_COMPLETED');
 const read=()=>x.projection.previewProducer(x.tab.headers,producerRequest(event.seq)),genuine=read();
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding),before=stepDetailFacts(x);
 const proof=db.prepare('SELECT principal_digest FROM workspace_ui_context_proofs_v1 WHERE proof_id=?').get(event.payload.proofRef);
 const other=x.f.issue('synthetic:other-proof-binding','reader');
 const {digest}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding).principal(other);
 const setPrincipal=db.prepare('UPDATE workspace_ui_context_proofs_v1 SET principal_digest=? WHERE proof_id=?');
 setPrincipal.run(digest,event.payload.proofRef);
 assert.throws(read,/CONTEXT_PROOF_SCOPE_DENIED/,'the selected completion cannot borrow a proof assigned to a different principal');
 setPrincipal.run(proof.principal_digest,event.payload.proofRef);
 const clock=db.prepare('SELECT * FROM workspace_ui_context_event_clock_v1 WHERE seq=?').get(event.seq);
 const setClock=db.prepare('UPDATE workspace_ui_context_event_clock_v1 SET signature=? WHERE principal_digest=? AND seq=?');
 setClock.run('0'.repeat(64),clock.principal_digest,clock.seq);
 assert.throws(read,/EVENT_SOURCE_CLOCK_SIGNATURE_DENIED/);
 db.prepare('DELETE FROM workspace_ui_context_event_clock_v1 WHERE principal_digest=? AND seq=?').run(clock.principal_digest,clock.seq);
 const absent=read();
 assert.equal(absent.availability,'UNAVAILABLE');assert.equal(absent.reason,'SOURCE_CLOCK_UNAVAILABLE');assert.equal(absent.fact,null);
 db.prepare('INSERT INTO workspace_ui_context_event_clock_v1 VALUES(?,?,?,?)').run(clock.principal_digest,clock.seq,clock.bytes,clock.signature);
 assert.deepEqual(read(),genuine);
 assert.deepEqual(stepDetailFacts(x),before,'the read never repairs, rewrites or backfills owner facts');
}finally{await x.close();}});

test('701 REC-02 step detail binds the exact signed recorded step: owner seq/run/step/attempt, recorded operation and digests, version-exact recorded refs, step-attached proof only, recorded facts separated from honest unavailables, zero reader effects',async()=>{const x=await fixture();try{
 assert.equal(typeof x.projection.stepDetail,'function','REC-02 step-detail owner read not yet delivered');
 const result=x.preview(),p=x.snapshot();
 const accepted=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===result.invocationId),completed=p.events.find(e=>e.kind==='INTENT_COMPLETED'&&e.taskId===result.invocationId);
 const before=stepDetailFacts(x);
 const d=x.projection.stepDetail(x.tab.headers,stepDetailRequest(accepted.seq));
 assert.equal(d.mode,'STEP_DETAIL');assert.equal(d.schemaVersion,'pansphaira.workspace-context-projection/step-detail/v1');
 assert.equal(d.availability,'AVAILABLE');assert.equal(d.gap,null);assert.equal(d.ownerSeq,accepted.seq);assert.ok(Object.isFrozen(d));
 assert.equal(d.step.taskId,result.invocationId,'detail binds the exact recorded task of the selected signed step');
 assert.equal(d.step.kind,'INTENT_ACCEPTED');assert.equal(d.step.ownerSequence,accepted.seq,'owner sequence is the selected signed seq, never renumbered');
 assert.equal(d.step.taskRevision,accepted.taskRevision);assert.equal(d.step.eventDigest,accepted.eventDigest);
 assert.equal(d.step.action.runId,'operation:ui-invocation-'+result.invocationId.slice(11),'run/step/attempt come from the recorded action descriptor');
 assert.equal(d.step.action.stepId,'step:'+result.invocationId);assert.equal(d.step.action.attempt,1);
 assert.equal(d.step.action.capability,'pan.workspace.view.preview/v1');assert.equal(d.step.action.operationSchemaVersion,'pansphaira.workspace-module-view/preview/v1','recorded operation schema version, never today inference');
 assert.equal(d.step.recorded.requestDigest,accepted.payload.requestDigest);assert.equal(d.step.recorded.argumentDigest,accepted.payload.argumentDigest);
 assert.equal(d.step.recorded.state,'ACCEPTED','recorded state at the selected seq, never the current COMPLETED row');
 assert.equal(d.step.recorded.resultDigest,null,'no completion result existed at the selected seq');
 assert.deepEqual(d.step.recorded.resourceRefs,accepted.payload.resourceRefs,'version-exact recorded refs come from the signed envelope');
 assert.equal(d.step.recorded.resourceRefs.objectRef.objectId,x.tab.context.primaryObject.objectId);
 assert.deepEqual(d.step.recorded.expectedRevisions,result.observation.expectedRevisions,'expected revisions are the recorded admitted-candidate refs');
 assert.equal(d.step.proof.present,false,'the selected INTENT_ACCEPTED step carries no attached proof; no later completion proof backfill');
 assert.equal(d.step.proof.reason,'NO_PROOF_ATTACHED_TO_SELECTED_STEP');
 assert.equal(d.step.sourceTimeAvailable,true,'the signed producer-clock sidecar of this append is the only source time');
 assert.equal(d.decisionRationale.availability,'UNAVAILABLE_NOT_RECORDED','no rationale was ever recorded: honest absence, no invented model reasoning');
 assert.equal(d.businessBeforeAfter.availability,'UNAVAILABLE_NOT_RECORDED','no business before/after payload was recorded on this preview seam');
 assert.equal(d.approval.availability,'UNAVAILABLE_NOT_RECORDED','this qualified path records no approval fact');
 assert.equal(d.derivedSummaries.available,false);assert.equal(d.derivedSummaries.reason,'NO_DERIVED_SUMMARY_SOURCE');assert.equal(d.model,'NOT_RUN');
 assert.equal(d.sourceProof.independentTargetEffectVerified,false,'a digest is not permission or independent source proof');
 assert.equal(d.requestSelection.requestArguments,'NOT_EXPORTED','raw recorded arguments stay inside the owner: digests only');
 assert.equal(d.requestSelection.selectedEventResult,'RECORDED',d.step.kind);
 assert.equal(canonicalJson(d).includes('Mach die Karte kleiner'),false,'no raw prompt/private context in detail bytes');
 assert.deepEqual(stepDetailFacts(x),before,'step detail causes zero task/outbox/proof/clock/control/store/snapshot effects');
 // forward detail on the later completion step: exactly the recorded result/proof facts of THAT step
 const d2=x.projection.stepDetail(x.tab.headers,stepDetailRequest(completed.seq));
 assert.equal(d2.step.kind,'INTENT_COMPLETED');assert.equal(d2.step.recorded.state,'COMPLETED');
 assert.equal(d2.step.recorded.resultDigest,completed.payload.resultDigest);assert.equal(d2.step.recorded.resultDigest,uiTaskDigestV2(result.result));
 assert.equal(d2.step.proof.present,true,'the completion step carries its own bound step-attached proof');
 assert.equal(d2.step.proof.proofRef,completed.payload.proofRef);
 assert.equal(d2.step.proof.issuerKind,'PAN546_PREVIEW_VALIDATED');assert.equal(d2.step.proof.argumentDigest,accepted.payload.argumentDigest,'proof must bind the recorded original argument digest');
 assert.equal(d2.step.proof.evidence.clientReportedDomCommit,false,'proof evidence stays exactly the recorded target facts');
 assert.equal(d2.step.proof.originalRequestDigest,accepted.payload.requestDigest,'proof binds the recorded original request digest');
 assert.equal(d2.step.proof.originalRequestDigest,result.observation.idempotency.taskRequestDigest,'proof request digest matches the actual durable task-row request digest');
 assert.deepEqual(stepDetailFacts(x),before,'both details still cause zero effects');
 // HISTORY-vs-detail consistency and repeated backwards/forwards selects cause zero effects
 for(const seq of [accepted.seq,completed.seq,accepted.seq,completed.seq,accepted.seq]){
  const h=x.projection.history(x.tab.headers,historyRequest(seq)),dd=x.projection.stepDetail(x.tab.headers,stepDetailRequest(seq));
  const hs=h.steps.find(s=>s.seq===seq);
  assert.equal(dd.step.state,hs.state,'detail and neutral history steps agree on the recorded state');
  assert.equal(dd.step.eventDigest,hs.eventDigest);}
 assert.deepEqual(stepDetailFacts(x),before,'repeated backwards/forwards selects cause zero FACH/TOOL/PROVIDER/APPROVE/RESUME/DISPATCH effects');
 // audience minimization and typed request closedness before any access
 const small=x.projection.stepDetail(x.tab.headers,stepDetailRequest(accepted.seq,'SPECIALIST_PREVIEW'));
 assert.equal(Object.hasOwn(small.step,'action'),false,'specialist audience never receives the action descriptor');
 assert.equal(Object.hasOwn(small.step.recorded,'resourceRefs'),false,'specialist audience never receives recorded resource refs');
 assert.deepEqual(stepDetailFacts(x),before,'minimized reads change nothing either');
 for(const bad of [{...stepDetailRequest(1),proof:'EXECUTOR'},{...stepDetailRequest(1),audience:'FOREIGN_MODEL'},{...stepDetailRequest(1),ownerSeq:1.5},{...stepDetailRequest(1),grant:true},stepDetailRequest(0),{...stepDetailRequest(1),taskId:result.invocationId}])
  assert.throws(()=>x.projection.stepDetail(x.tab.headers,bad),/CONTEXT_PROJECTION_REQUEST_DENIED/,'closed request contract: no caller proof/grant/taskId selectors, no bad seq, no foreign audience');
 assert.throws(()=>x.projection.stepDetail(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/step-detail-request/v2',audience:'MAIN_CONTRACT',ownerSeq:1}),/CONTEXT_PROJECTION_REQUEST_DENIED/,'unsupported version denied honestly');
 // forged proof bytes on the step-attached proof fail closed via the existing journal fence
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const proofRow=db.prepare('SELECT * FROM workspace_ui_context_proofs_v1 WHERE task_id=?').get(result.invocationId);
 db.prepare('UPDATE workspace_ui_context_proofs_v1 SET bytes=? WHERE proof_id=?').run(proofRow.bytes.replace('"PAN546_PREVIEW_VALIDATED"','"PAN597_DOCUMENT_ACCEPTED"'),proofRow.proof_id);
 assert.throws(()=>x.projection.stepDetail(x.tab.headers,stepDetailRequest(completed.seq)),/CONTEXT_OWNER_SIGNATURE_DENIED|CONTEXT_PROOF_BYTES_DENIED/,'changed original proof bytes deny the detail; no cached fallback');
 db.prepare('UPDATE workspace_ui_context_proofs_v1 SET bytes=? WHERE proof_id=?').run(proofRow.bytes,proofRow.proof_id);
 db.prepare('UPDATE workspace_ui_context_proofs_v1 SET principal_digest=? WHERE proof_id=?').run('foreign-principal-digest',proofRow.proof_id);
 assert.throws(()=>x.projection.stepDetail(x.tab.headers,stepDetailRequest(completed.seq)),/CONTEXT_PROOF_SCOPE_DENIED/,'proof reassigned to a foreign principal cannot launder the step detail');
 db.prepare('UPDATE workspace_ui_context_proofs_v1 SET principal_digest=? WHERE proof_id=?').run(proofRow.principal_digest,proofRow.proof_id);
 const reforged=x.projection.stepDetail(x.tab.headers,stepDetailRequest(completed.seq));
 assert.equal(reforged.step.proof.proofRef,completed.payload.proofRef,'restored genuine step-attached proof reads deterministically');
 assert.deepEqual(stepDetailFacts(x),before,'forgery probes leave the signed store byte-identical: zero reader effects');
 // unrecorded future seq stays an honest gap bound to the current signed head
 const future=x.projection.stepDetail(x.tab.headers,stepDetailRequest(p.streamHead.seq+5));
 assert.equal(future.availability,'UNAVAILABLE');assert.equal(future.gap.reason,'SEQ_UNRECORDED');assert.equal(future.step,null);assert.equal(future.streamHead.seq,p.streamHead.seq,'no renumbering');
 assert.deepEqual(stepDetailFacts(x),before,'gap reads change nothing');
 // #701 review01: no fabricated pause availability claims; pause is a separate owner control
 assert.equal(Object.hasOwn(d,'nativePauseDelivered'),false,'a step-detail read must not claim pause delivery either way');
 assert.equal(d.pauseOrResumeAuthorized,false);
 // specialist minimization: raw proof evidence/request digests stay MAIN_CONTRACT-only
 const smallDone=x.projection.stepDetail(x.tab.headers,stepDetailRequest(completed.seq,'SPECIALIST_PREVIEW'));
 assert.equal(smallDone.step.proof.present,true,'specialist still sees the minimized step-proof summary');
 assert.equal(smallDone.step.proof.issuerKind,'PAN546_PREVIEW_VALIDATED');
 assert.equal(Object.hasOwn(smallDone.step.proof,'evidence'),false,'raw proof evidence never crosses to the specialist audience');
 assert.equal(Object.hasOwn(smallDone.step.proof,'originalRequestDigest'),false,'original request digest stays MAIN_CONTRACT-only');
 assert.equal(Object.hasOwn(smallDone.step,'action'),false);
 assert.equal(canonicalJson(smallDone).includes(x.tab.context.primaryObject.objectId),false,'specialist detail bytes carry no source refs');
 assert.deepEqual(stepDetailFacts(x),before,'minimized detail reads change nothing');
 // foreign principal: zero-effect honest gap or scoped denial, never another tenant content
 const foreign=x.f.tab(x.f.issue('synthetic:other-detail','reader'));
 const fr=x.projection.stepDetail(foreign.headers,stepDetailRequest(accepted.seq));
 assert.equal(fr.availability,'UNAVAILABLE');assert.equal(fr.gap.reason,'SEQ_UNRECORDED','foreign principal has no recorded step at that seq; nothing leaks');
 assert.deepEqual(stepDetailFacts(x),before,'foreign probe changes nothing on the owner store');
 // current authorization applies on every read: revoke denies content, providerSwitch cannot resurrect retired refs.
 // The LIVE snapshot legitimately re-derives after a privacy switch, so compare signed durable rows only here.
 const {snapshotDigest:preSwitchSnapshotDigest,...preSwitch}=stepDetailFacts(x);
 x.projection.revoke(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/privacy-revoke/v1'});
 assert.throws(()=>x.projection.stepDetail(x.tab.headers,stepDetailRequest(accepted.seq)),/CONTEXT_PRIVACY_REVOKED/,'revoked reader gets no historical detail restore');
 x.projection.providerSwitch(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/contract-session-switch/v1',context:x.f.verification(x.tab)});
 const retired=x.projection.stepDetail(x.tab.headers,stepDetailRequest(accepted.seq));
 assert.equal(retired.availability,'UNAVAILABLE');assert.equal(retired.gap.reason,'SOURCE_RETIRED');assert.equal(retired.step,null);
 assert.equal(canonicalJson(retired).includes(x.tab.context.primaryObject.objectId),false,'revoke+providerSwitch cannot resurrect retired refs or raw bytes');
 assert.equal(canonicalJson(retired).includes('operation:ui-invocation-'+result.invocationId.slice(11)),false,'retired run binding never restored');
 assert.equal(stepDetailFacts(x).snapshotDigest!==preSwitchSnapshotDigest,true,'the owner revoke/switch itself honestly re-derives the LIVE snapshot');
 const {snapshotDigest:postSwitchSnapshotDigest,...switched}=stepDetailFacts(x);
 assert.deepEqual(switched,preSwitch,'the step-detail reads around revoke/switch changed zero signed task/outbox/proof/clock rows: retired steps stay redacted, never rewritten');
}finally{await x.close();}});

// #704 first finite integration trace (REC-05 partial, Preview/Display only):
// real #608 typed preview + admitted document display over the existing independent
// executor, #698 pause fence BEFORE the display dispatch, #700/#701 history and
// step-detail reads under PAUSED with zero counter movement, explicit resume, one
// real display dispatch plus597 load/permit/ACK (backend protocol receipt, not
// browser pixels), persisted owner readback via the actual owner reopen, and an
// honest posthoc controlled negative. No offer line, no single-approval UI, no
// whole #704 AC02 claim; the unmerged #702/45b delta stays out of this cut.
const integrationControl=x=>{const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);const c=db.prepare('SELECT * FROM workspace_ui_context_control_v1 WHERE id=1').get();return {state:c?.pause_state??'RUNNING',revision:c?.control_revision??0};};
const integrationCounters=x=>{const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 return {tasks:JSON.stringify(db.prepare('SELECT command_id,state,revision,result_json FROM workspace_ui_tasks_v2 ORDER BY command_id').all()),
  outbox:JSON.stringify(db.prepare('SELECT seq,event_key,kind,bytes,signature FROM workspace_ui_context_outbox_v1 ORDER BY seq').all()),
  proofs:db.prepare('SELECT COUNT(*) c FROM workspace_ui_context_proofs_v1').get().c,
  fachEvents:nativeRows(x.f.native.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,
  storeRevision:x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision};};
test('704 first integration trace: real608 preview then paused admitted display, bounded history/step-detail under PAUSE, explicit resume, single real dispatch with persisted owner seq/proof/idempotency readback',async()=>{const x=await fixture();try{
 assert.equal(typeof x.invocations.pause,'function','ACT-03 #698 pause must be delivered on the existing invocation owner');
 // (1) REAL typed preview through the existing independent executor.
 const preview=x.preview();
 assert.equal(preview.result.phase,'PREVIEW_VALIDATED');assert.equal(preview.task.state,'COMPLETED');
 let p=x.snapshot();
 const accepted=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===preview.invocationId),previewDone=p.events.find(e=>e.kind==='INTENT_COMPLETED'&&e.taskId===preview.invocationId);
 assert.equal(p.events.filter(e=>e.kind==='TARGET_ATTEMPTED'&&e.taskId===preview.invocationId).length,1,'the actual dispatch boundary is signed exactly once');
 const previewRow=p.tasks.find(r=>r.taskId===preview.invocationId);
 assert.equal(previewRow.proof.issuerKind,'PAN546_PREVIEW_VALIDATED');assert.equal(previewRow.resultDigest,uiTaskDigestV2(preview.result));
 // (2) REAL document display prepared/admitted to a SECOND registered surface with
 // current selection context (existing608 two-tab recipe), then owner pause BEFORE
 // the next actual dispatch: the unattempted admission is held behind the fence.
 const second=x.f.tab(x.tab.headers);
 second.surface=x.surfaces.register(second.headers,registration);
 const secondHeaders={...second.headers,'x-pan597-surface':second.surface.surfaceId,'x-pan597-proof':second.surface.surfaceProof};
 const display=x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Zeige das ausgewählte Dokument rechts'},context:x.f.verification(x.tab),selectedCardId:'native-review',targetSurfaceId:second.surface.surfaceId});
 assert.equal(display.outcome,'RESOLVED');
 const displayMember=display.set.candidates[0];
 assert.equal(displayMember.capability,'pan.workspace.document.display/v2');
 const admitted=x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:display.set.setId,requestDigest:display.set.requestDigest,setDigest:display.set.setDigest,candidateId:displayMember.candidateId,argumentDigest:displayMember.argumentDigest,policyRef:display.set.policyRef});
 const displayExecution={schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:admitted.invocationId,admissionToken:admitted.admissionToken,requestDigest:admitted.requestDigest,setDigest:admitted.setDigest,candidateId:admitted.candidateId,argumentDigest:admitted.argumentDigest,policyRef:admitted.policyRef};
 const pause1=x.invocations.pause(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:0});
 assert.equal(pause1.state,'PAUSE_REQUESTED');assert.equal(pause1.controlRevision,1);
 const paused=x.invocations.pause(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:1});
 assert.equal(paused.state,'PAUSED','the never-dispatched admission is unfired work and must not postpone PAUSED');
 assert.deepEqual(integrationControl(x),{state:'PAUSED',revision:2});
 const held=x.snapshot().tasks.find(r=>r.taskId===admitted.invocationId);
 assert.equal(held===undefined,true,'pause before dispatch leaves no task row behind');
 assert.equal(x.snapshot().events.some(e=>e.taskId===admitted.invocationId),false,'no journal fact exists for the unattempted display');
 // (3) WHILE PAUSED: bounded history/step-detail over the preview recorded owner seqs
 // and the admitted/display-pending timeline via the EXISTING APIs only.
 const beforeReads=stepDetailFacts(x),countersBefore=integrationCounters(x);
 const previewDetail=x.projection.stepDetail(x.tab.headers,stepDetailRequest(accepted.seq));
 assert.equal(previewDetail.step.state,'ACCEPTED','historical detail keeps the recorded per-step state');
 const previewDoneDetail=x.projection.stepDetail(x.tab.headers,stepDetailRequest(previewDone.seq));
 assert.equal(previewDoneDetail.step.proof.issuerKind,'PAN546_PREVIEW_VALIDATED','the preview detail binds its own step-attached proof');
 assert.equal(previewDoneDetail.step.recorded.resultDigest,uiTaskDigestV2(preview.result),'the preview result digest is the signed preview fact, not any later display result');
 for(const seq of [accepted.seq,previewDone.seq,p.streamHead.seq,previewDone.seq,accepted.seq,p.streamHead.seq+1,accepted.seq]){
  const h=x.projection.history(x.tab.headers,historyRequest(seq));
  assert.equal(h.mode,'HISTORY');assert.equal(h.readerEffects,'NONE');assert.equal(h.targetRedispatched,false);assert.equal(h.replayGrantsNoRights,true);
  if(seq>p.streamHead.seq){assert.equal(h.availability,'UNAVAILABLE');assert.equal(h.gap.reason,'SEQ_UNRECORDED','no invented sequence when no event was recorded');continue;}
  assert.equal(h.availability,'AVAILABLE');
  const atSeq=h.steps.find(s=>s.seq===seq);
  const d=x.projection.stepDetail(x.tab.headers,stepDetailRequest(seq));
  assert.equal(d.step.eventDigest,atSeq.eventDigest,'back/forward reads agree on the same signed envelope');
  assert.equal(integrationControl(x).state,'PAUSED','reader loop never touches the pause fence');
 }
 assert.deepEqual(stepDetailFacts(x),beforeReads,'reader loop changes zero signed task/outbox/proof/clock rows');
 assert.deepEqual(integrationCounters(x),countersBefore,'reader loop causes zero Fach/dispatch/profile effects across the paused timeline');
 assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0,'no personal profile save on Preview/Display');
 assert.equal(nativeRows(x.f.native.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0,'independent FACH store untouched by preview, pause and scrubbing');
 assert.throws(()=>x.invocations.execute(x.tab.headers,displayExecution),/INVOCATION_PAUSED/,'mutation despite pause is a hard error');
 assert.equal(x.snapshot().events.some(e=>e.taskId===admitted.invocationId&&e.kind==='TARGET_ATTEMPTED'),false,'the denied dispatch journalled no TARGET_ATTEMPTED');
 assert.deepEqual(integrationCounters(x),countersBefore,'the pause denial itself produced no task/outbox/proof effect');
 // (4) Explicit authorized resume at the current control revision; the SAME
 // unattempted admission then dispatches exactly once through the real executor.
 const resumed=x.invocations.resume(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resume/v1',expectedControlRevision:2});
 assert.deepEqual(resumed,{schemaVersion:'pansphaira.workspace-invocation/control/v1',state:'RUNNING',controlRevision:3,ownerBound:true});
 const displayResult=x.invocations.execute(x.tab.headers,displayExecution);
 assert.equal(displayResult.result.phase,'DOCUMENT_ACCEPTED');assert.equal(displayResult.result.clientRendered,false);assert.equal(displayResult.result.personalProfileSaved,false);
 const displayCommand=displayResult.result.delivery.originalCommand;
 assert.throws(()=>x.invocations.execute(x.tab.headers,displayExecution),/INVOCATION_ATTEMPT_ALREADY_REQUIRES_READBACK/,'retry/replay cannot redispatch the same attempt');
 // Existing597 backend load/permit/ACK protocol (a backend protocol receipt; NOT
 // actual browser pixels: physicalPixelSightCertified stays false).
 x.surfaces.events(secondHeaders,{schemaVersion:'pansphaira.workspace-surface/events/v2',cursor:0});
 const load=x.surfaces.load(secondHeaders,{schemaVersion:'pansphaira.workspace-surface/load/v2',commandId:displayCommand.commandId});
 assert.equal(load.projection.objectId,displayCommand.objectId);
 const permit=x.surfaces.beforeCommit(secondHeaders,{schemaVersion:'pansphaira.workspace-surface/before-dom/v2',commandId:displayCommand.commandId,readToken:load.readToken,projectionDigest:load.projection.projectionDigest,localGeneration:1});
 const ack=x.surfaces.acknowledge(secondHeaders,{schemaVersion:'pansphaira.workspace-surface/render-ack/v2',commandId:displayCommand.commandId,commitToken:permit.commitToken,projectionDigest:load.projection.projectionDigest,localGeneration:1,contextEpoch:permit.surface.contextEpoch,domCommitted:true});
 assert.equal(ack.status,'RENDERED');assert.equal(ack.render.physicalPixelSightCertified,false,'backend protocol receipt only, no pixel-sight claim');
 // LIVE fresh snapshot: display row completed honestly; preview attempt stays single.
 const live=x.snapshot();
 assert.equal(live.phase,'PREPARED');assert.equal(live.model,'NOT_RUN');assert.equal(live.executionAuthorityGranted,false);
 const displayRow=live.tasks.find(r=>r.taskId===admitted.invocationId);
 assert.equal(displayRow.state,'COMPLETED');assert.equal(displayRow.resultDigest,uiTaskDigestV2(displayResult.result));
 const displayDone=live.events.find(e=>e.taskId===displayCommand.commandId&&e.kind==='INTENT_COMPLETED');
 assert.ok(displayDone,'the child display command completed inside the same signed owner stream');
 assert.equal(live.events.filter(e=>e.taskId===preview.invocationId&&e.kind==='TARGET_ATTEMPTED').length,1,'preview dispatch stayed exactly one across the whole trace');
 assert.equal(live.events.filter(e=>e.taskId===admitted.invocationId&&e.kind==='TARGET_ATTEMPTED').length,1,'display dispatch journalled exactly once');
 // The PREVIEW step detail must not borrow the later DISPLAY result/current refs.
 const previewDetailAgain=x.projection.stepDetail(x.tab.headers,stepDetailRequest(previewDone.seq));
 assert.deepEqual(previewDetailAgain.step,previewDoneDetail.step,'the selected signed preview step is invariant under the later display completion: no borrowed DISPLAY result/current refs and no later proof backfill');
 assert.equal(previewDetailAgain.streamHead.seq,live.streamHead.seq,'detail honestly reports the current signed stream head after the display completion, never a renumbered or frozen one');
 assert.equal(canonicalJson(previewDetailAgain.step).includes(displayCommand.commandId),false,'no later display command ref leaks into the earlier preview step');
 // (5/6) Persisted owner journal/task readback through the ACTUAL owner reopen:
 // real attempt identities, seq and result refs survive; bounded retention honest.
 const countersBeforeReopen=integrationCounters(x);
 x.reopenOwner();
 const reopened=x.snapshot();
 assert.deepEqual(reopened.events.map(e=>e.seq),live.events.map(e=>e.seq),'owner reopen re-reads the same signed owner sequences, never renumbers');
 const reopenedDetail=x.projection.stepDetail(x.tab.headers,stepDetailRequest(previewDone.seq));
 assert.deepEqual(reopenedDetail.step,previewDoneDetail.step,'step detail after reopen binds the same persisted attempt identity/result digest');
 assert.deepEqual(integrationCounters(x),countersBeforeReopen,'historical reads and owner reopen cause zero FACH/dispatch/profile effects');
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const idemRow=db.prepare('SELECT original_command FROM workspace_ui_tasks_v2 WHERE command_id=?').get(preview.invocationId);
 assert.equal(JSON.parse(idemRow.original_command).budgetBinding.operationId,'operation:ui-invocation-'+preview.invocationId.slice(11),'durable idempotency identity remains bound to the real budget operation');
 assert.deepEqual(integrationControl(x),{state:'RUNNING',revision:3},'the trace ends RUNNING at the durable control frontier');
}finally{await x.close();}});

test('704 pause-fence part 2: unattempted display admission denied while PAUSED with zero journal/task rows; fence survives history replay; acknowledged pause replay is idempotent; after resume the same admission dispatches once',async()=>{const x=await fixture();try{
 const preview=x.preview();
 const second=x.f.tab(x.tab.headers);
 second.surface=x.surfaces.register(second.headers,registration);
 const display=x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Zeige das ausgewählte Dokument rechts'},context:x.f.verification(x.tab),selectedCardId:'native-review',targetSurfaceId:second.surface.surfaceId});
 const member=display.set.candidates[0];
 const admitted=x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:display.set.setId,requestDigest:display.set.requestDigest,setDigest:display.set.setDigest,candidateId:member.candidateId,argumentDigest:member.argumentDigest,policyRef:display.set.policyRef});
 const execution={schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:admitted.invocationId,admissionToken:admitted.admissionToken,requestDigest:admitted.requestDigest,setDigest:admitted.setDigest,candidateId:admitted.candidateId,argumentDigest:admitted.argumentDigest,policyRef:admitted.policyRef};
 assert.deepEqual(x.invocations.pause(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:0}),{schemaVersion:'pansphaira.workspace-invocation/control/v1',state:'PAUSE_REQUESTED',controlRevision:1,ownerBound:true});
 const paused=x.invocations.pause(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:1});
 assert.deepEqual(paused,{schemaVersion:'pansphaira.workspace-invocation/control/v1',state:'PAUSED',controlRevision:2,ownerBound:true});
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const quiet=()=>JSON.stringify(db.prepare('SELECT command_id,state,revision FROM workspace_ui_tasks_v2 ORDER BY command_id').all())+JSON.stringify(db.prepare('SELECT seq,kind,bytes,signature FROM workspace_ui_context_outbox_v1 ORDER BY seq').all());
 const before=quiet(),beforeStore=x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision;
 assert.throws(()=>x.invocations.execute(x.tab.headers,execution),/INVOCATION_PAUSED/);
 assert.equal(nativeRows(x.f.native.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0);
 const p=x.snapshot();
 const previewAccepted=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===preview.invocationId);
 // Historical replay grants no resume and no rights: reads under PAUSED stay quiet.
 x.projection.history(x.tab.headers,historyRequest(previewAccepted.seq));
 x.projection.stepDetail(x.tab.headers,stepDetailRequest(p.streamHead.seq));
 assert.deepEqual(quiet(),before,'pause denial plus history/step-detail replay change zero task/outbox bytes');
 // Replay of the acknowledged pause revision is idempotent, not a new pause owner.
 assert.deepEqual(x.invocations.pause(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:2}),paused);
 assert.throws(()=>x.invocations.execute(x.tab.headers,execution),/INVOCATION_PAUSED/,'a second denial attempt is still fenced, still no rows');
 assert.deepEqual(quiet(),before);
 assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,beforeStore);
 // Explicit resume re-opens exactly the same unattempted admission; one real dispatch follows.
 const resumed=x.invocations.resume(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resume/v1',expectedControlRevision:2});
 assert.equal(resumed.state,'RUNNING');assert.equal(resumed.controlRevision,3);
 const result=x.invocations.execute(x.tab.headers,execution);
 assert.equal(result.result.phase,'DOCUMENT_ACCEPTED');
 assert.equal(db.prepare('SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind=?').get(admitted.invocationId,'TARGET_ATTEMPTED').n,1,'after resume the same admission dispatches exactly once');
}finally{await x.close();}});

test('704 POSTHOC controlled negative (labeled): a deliberately target-drifted display admission after an authorized resume fires the real TARGET_SCOPE_STALE fence once pre-dispatch with zero accept/attempt/UNKNOWN facts and an identical repeat denial; oracle sensitivity on already-GREEN source, not a product RED',async()=>{const x=await fixture();try{
 const second=x.f.tab(x.tab.headers);
 second.surface=x.surfaces.register(second.headers,registration);
 const secondHeaders={...second.headers,'x-pan597-surface':second.surface.surfaceId,'x-pan597-proof':second.surface.surfaceProof};
 const display=x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Zeige das ausgewählte Dokument rechts'},context:x.f.verification(x.tab),selectedCardId:'native-review',targetSurfaceId:second.surface.surfaceId});
 const member=display.set.candidates[0];
 const admitted=x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:display.set.setId,requestDigest:display.set.requestDigest,setDigest:display.set.setDigest,candidateId:member.candidateId,argumentDigest:member.argumentDigest,policyRef:display.set.policyRef});
 const execution={schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:admitted.invocationId,admissionToken:admitted.admissionToken,requestDigest:admitted.requestDigest,setDigest:admitted.setDigest,candidateId:admitted.candidateId,argumentDigest:admitted.argumentDigest,policyRef:admitted.policyRef};
 // Fresh fixture: mint the real control row through the observed frontier
 // 0 -> PAUSE_REQUESTED(1) -> PAUSED(2), then explicitly resume to RUNNING(3).
 assert.deepEqual(x.invocations.pause(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:0}),{schemaVersion:'pansphaira.workspace-invocation/control/v1',state:'PAUSE_REQUESTED',controlRevision:1,ownerBound:true});
 assert.deepEqual(x.invocations.pause(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:1}),{schemaVersion:'pansphaira.workspace-invocation/control/v1',state:'PAUSED',controlRevision:2,ownerBound:true});
 assert.throws(()=>x.invocations.pause(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:0}),/INVOCATION_CONTROL_STALE_REVISION/,'a stale control revision is a hard denial, never a new pause');
 assert.deepEqual(x.invocations.resume(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resume/v1',expectedControlRevision:2}),{schemaVersion:'pansphaira.workspace-invocation/control/v1',state:'RUNNING',controlRevision:3,ownerBound:true});
 // The deliberate fault: after the authorized resume, the recorded target peer
 // drifts, so the real revalidation fence denies BEFORE any accept/dispatch.
 x.surfaces.state(secondHeaders,{schemaVersion:'pansphaira.workspace-surface/state/v2',connectionEpoch:1,expectedGeneration:1,localGeneration:2,pinned:false,dirty:false});
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const outboxKinds=()=>db.prepare('SELECT kind FROM workspace_ui_context_outbox_v1 WHERE task_id=? ORDER BY seq').all(admitted.invocationId).map(e=>e.kind);
 assert.deepEqual(outboxKinds(),[],'drift alone records nothing for the unattempted admission');
 // The injected fault actually fires on the real code path: stale peer denies in
 // begin() revalidation, so zero accept/attempt/UNKNOWN facts are journalled.
 assert.throws(()=>x.invocations.execute(x.tab.headers,execution),/INVOCATION_TARGET_SCOPE_STALE/);
 assert.deepEqual(outboxKinds(),[],'the denied stale admission journalled no INTENT_ACCEPTED/TARGET_ATTEMPTED at all');
 assert.equal(db.prepare('SELECT count(*) n FROM workspace_ui_tasks_v2 WHERE command_id=?').get(admitted.invocationId).n,0,'no task row was ever created for the denied drift');
 assert.equal(nativeRows(x.f.native.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0,'the drifted display produced zero FACH mutation');
 // Replay of the same stale admission repeats the same single denial: no
 // redispatch, no duplicate events, no blind retry.
 assert.throws(()=>x.invocations.execute(x.tab.headers,execution),/INVOCATION_TARGET_SCOPE_STALE/);
 assert.deepEqual(outboxKinds(),[],'the replay cannot duplicate events or blindly retry');
 assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0,'no profile persistence entered the fault path');
 assert.deepEqual(integrationControl(x),{state:'RUNNING',revision:3},'the denial changed no control state');
}finally{await x.close();}});

