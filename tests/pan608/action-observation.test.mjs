// ACT-01 #696: versioned read-only action observation attached to the EXISTING
// PAN548 candidate/admission/executor and #607 journal seams. One real native
// preview and one real display invocation; the observation reads actual owner
// facts only. No new executor, task engine, rights or dispatch path.
import test from 'node:test';import assert from 'node:assert/strict';import {join}from'node:path';
import {nativeViewFixture546}from'../pan546/native-fixture.mjs';
import {createNativeWorkspaceUiTaskProjectionV2,nativeWorkspaceUiTaskOwnerConnectionV2,uiTaskDigestV2}from'../../src/pan548/native-ui-task-projection-v2.mjs';
import {createNativeSurfaceProjectionReaderV2}from'../../src/pan546/native-surface-projection-v2.mjs';
import {createNativeWorkspaceSurfacesV2}from'../../src/pan597/native-surfaces-v2.mjs';
import {createNativeWorkspaceInvocationsV1,nativeWorkspaceInvocationExecutorConnectionV1}from'../../src/pan548/native-model-free-invocations-v1.mjs';
import {executeNativeWorkspaceInvocationV1}from'../../src/pan548/native-invocation-executor-v1.mjs';
import {protectedWorkspaceSetupStatusV1}from'../../src/pan527/origin-session-adapter.mjs';
import {createHash}from'node:crypto';
const reg={schemaVersion:'pansphaira.workspace-surface/register/v2',previousSurfaceId:null,previousProof:null,localGeneration:1,pinned:false,dirty:false};
const OBS={schemaVersion:'pansphaira.workspace-action-observation/observe/v1'};
async function fixture(){
 const f=await nativeViewFixture546(),headers=f.issue(),source=f.tab(headers),target=f.tab(headers),root=join(f.root,'native-ui-task-projection-v2');
 source.context=f.context.claim(source.headers,{schemaVersion:'pansphaira.workspace-context/claim/v1',tabId:source.context.binding.tabId,moduleId:'pan.erv',viewId:'pan.erv.view',primaryObjectId:source.context.primaryObject.objectId,selection:{elementId:'pan.erv.module-card',rowId:'native-review'},expected:{...source.context.revisions,epoch:source.context.binding.epoch}}).context;
 const tasks=createNativeWorkspaceUiTaskProjectionV2({sessions:f.sessions,root}),reader=createNativeSurfaceProjectionReaderV2({sessions:f.sessions,nativeReader:f.reader,analysisReader:null,readMonitor:()=>protectedWorkspaceSetupStatusV1(f.tls.gateway,{tenantId:'tenant-a',origin:f.tls.origin,identityDigest:f.sessions.binding.identityDigest})});
 const surfaces=createNativeWorkspaceSurfacesV2({sessions:f.sessions,contextSelection:f.context,tasks,reader});
 function register(t){t.surface=surfaces.register(t.headers,reg);t.headers={...t.headers,'x-pan597-surface':t.surface.surfaceId,'x-pan597-proof':t.surface.surfaceProof};return t;}
 register(source);register(target);
 const options={sessions:f.sessions,contextSelection:f.context,tasks,viewOwner:f.view,surfaces},owner=createNativeWorkspaceInvocationsV1(options),n=nativeWorkspaceUiTaskOwnerConnectionV2(tasks,f.sessions.binding);
 function request(text='Mach die Karte kleiner',selectedCardId='native-review',targetSurfaceId=null){return {schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text},context:f.verification(source),selectedCardId,targetSurfaceId};}
 function selection(r){const set=r.set,member=set.candidates.find(c=>c.candidateId===set.selectedCandidateId)??set.candidates[0];return {schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:set.setId,requestDigest:set.requestDigest,setDigest:set.setDigest,candidateId:member?.candidateId,argumentDigest:member?.argumentDigest,policyRef:set.policyRef};}
 function execution(a){return {schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:a.invocationId,admissionToken:a.admissionToken,requestDigest:a.requestDigest,setDigest:a.setDigest,candidateId:a.candidateId,argumentDigest:a.argumentDigest,policyRef:a.policyRef};}
 // payload is the actual request; headers are passed separately.
 function observe(payload,headers=source.headers){return typeof owner.observe==='function'?owner.observe(headers,payload):(()=>{throw Error('OWNER_OBSERVE_ABSENT');})();}
 const before=()=>f.store.read(f.sessions.authenticate(source.headers));
 return {f,source,target,owner,n,tasks,request,selection,execution,observe,before,count(){return n.db.prepare('SELECT count(*) n FROM workspace_ui_tasks_v2').get().n;},async close(){owner.close();surfaces.close();tasks.close();await f.close();}};
}
function foreignHeaders(x){const issued=x.f.sessions.issueOwnerSession({subjectId:'synthetic:other-reader',role:'reader',expiresAtMs:Date.now()+60000});return {cookie:issued.cookieHeader,origin:x.f.tls.origin,'x-pan527-csrf':issued.csrf,'x-pan548-session':'session:'+createHash('sha256').update(issued.cookieHeader).digest('hex')};}
const hasObs=r=>Object.hasOwn(r,'observation');
test('696 ACT-01 executor readback carries a bound observation even when the caller ignores it; proposal/admission phases are observed without dispatch or grant',async()=>{
 const x=await fixture();try{const prior=x.before(),r=x.owner.resolve(x.source.headers,x.request());
  assert.equal(Object.hasOwn(r,'observation'),false,'resolve itself must not fabricate a dispatch observation');
  const proposed=x.observe({...OBS,invocationId:r.set.invocationId});
  assert.equal(proposed.phase,'PROPOSED');assert.equal(proposed.taskId,r.set.invocationId);assert.equal(proposed.attempt,0);assert.equal(proposed.candidateId,r.set.selectedCandidateId);
  assert.equal(proposed.causal.setDigest,r.set.setDigest);assert.equal(x.count(),0);assert.deepEqual(x.before(),prior);assert.equal(proposed.executionAuthorityGranted,false);
  const a=x.owner.admit(x.source.headers,x.selection(r)),admitted=x.observe({...OBS,invocationId:a.invocationId});
  assert.equal(admitted.phase,'ADMITTED');assert.equal(admitted.argumentDigest,a.argumentDigest);assert.equal(admitted.attempt,0);assert.equal(x.count(),0);assert.deepEqual(x.before(),prior);
  const result=executeNativeWorkspaceInvocationV1(x.owner,x.source.headers,x.execution(a));
  assert.equal(hasObs(result),true,'executor readback must carry the bound observation');
 }finally{await x.close();}
});
test('696 ACT-01 completed real preview observation binds run/task/step/attempt, actor/tenant, capability/schema, object/revision, exact argument digest, idempotency and independent proof; accepted!=rendered!=persisted',async()=>{
 const x=await fixture();try{const prior=x.before(),r=x.owner.resolve(x.source.headers,x.request()),a=x.owner.admit(x.source.headers,x.selection(r));
  const result=executeNativeWorkspaceInvocationV1(x.owner,x.source.headers,x.execution(a));
  assert.equal(hasObs(result),true);const o=result.observation;
  assert.equal(o.schemaVersion,'pansphaira.workspace-action-observation/v1');
  assert.equal(o.phase,'RESULT_CONFIRMED');assert.equal(o.resultPhase,'PREVIEW_VALIDATED');
  assert.equal(o.taskId,a.invocationId);assert.equal(o.runId,'operation:ui-invocation-'+a.invocationId.slice(11));assert.equal(o.stepId,'step:'+a.invocationId.slice(11));
  assert.equal(o.attempt,1,'one real dispatch is attempt 1, not the task row revision');assert.equal(o.taskRevision,result.task.revision);
  assert.deepEqual(o.actor,{tenantId:'tenant-a',subjectId:'synthetic:erv-reviewer',role:'reviewer'});
  assert.equal(o.capability,'pan.workspace.view.preview/v1');assert.equal(o.argumentDigest,a.argumentDigest);
  assert.deepEqual(o.semanticTarget,{kind:'MODULE_CARD_INSTANCE',moduleId:'pan.erv',viewId:'pan.erv.view',objectId:'AP-PAN516-MATCHED-01',instanceId:'native-review'});
  assert.equal(o.idempotency.operationId,o.runId);assert.equal(o.idempotency.taskRequestDigest,result.task.requestDigest);
  assert.equal(o.proof.issuerKind,'PAN546_PREVIEW_VALIDATED');assert.equal(o.proof.argumentDigest,a.argumentDigest);
  assert.equal(o.rendered,false);assert.equal(o.personalViewPersistenceProduced,false);assert.equal(o.physicalPixelSightCertified,false);
  assert.equal(o.model,'NOT_RUN');assert.equal(o.modelPlanLineage,'NOT_INFERRED');assert.equal(o.executionAuthorityGranted,false);
  assert.deepEqual(o.capabilityAvailability,{pause:'UNAVAILABLE',resume:'UNAVAILABLE',cancel:'UNAVAILABLE',offerLineAdapter:'NOT_IMPLEMENTED'});
  assert.ok(Object.isFrozen(o));assert.deepEqual(x.before(),prior);
  const read=x.owner.read(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/read/v1',invocationId:a.invocationId});
  assert.deepEqual(x.observe({...OBS,invocationId:a.invocationId}),o,'observation is reproducible from owner facts');
  assert.equal(read.independentRead,true);
  assert.equal(x.count(),1);assert.deepEqual(x.before(),prior);
 }finally{await x.close();}
});
test('696 ACT-01 accepted native document observation stays DOCUMENT_ACCEPTED and never claims rendered, persisted or pixel-certified',async()=>{
 const x=await fixture();try{const r=x.owner.resolve(x.source.headers,x.request('Zeige das ausgewählte Dokument rechts',null,x.target.surface.surfaceId)),a=x.owner.admit(x.source.headers,x.selection(r));
  const result=x.owner.execute(x.source.headers,x.execution(a));assert.equal(hasObs(result),true);const o=result.observation;
  assert.equal(o.phase,'RESULT_CONFIRMED');assert.equal(o.resultPhase,'DOCUMENT_ACCEPTED');assert.equal(o.attempt,1);
  assert.equal(o.rendered,false);assert.equal(o.personalViewPersistenceProduced,false);assert.equal(o.physicalPixelSightCertified,false);
  assert.deepEqual(o.semanticTarget,{kind:'REGISTERED_SURFACE_DOCUMENT',objectId:'AP-PAN516-MATCHED-01',surfaceId:x.target.surface.surfaceId});
  assert.equal(o.expectedRevision,r.set.candidates[0].revisions.documentRevision);assert.equal(o.proof.issuerKind,'PAN597_DOCUMENT_ACCEPTED');
 }finally{await x.close();}
});
test('696 ACT-01 genuine after-begin failure (lost reply after dispatch begin) is observed UNKNOWN with attempt 1 retained, no effect and no re-dispatch right',async t=>{
 const x=await fixture();try{const prior=x.before(),r=x.owner.resolve(x.source.headers,x.request()),a=x.owner.admit(x.source.headers,x.selection(r));
  // Same executor seam the real executor walks: begin persists the attempt,
  // then the reply fence fails after begin (target reply lost).
  const connection=nativeWorkspaceInvocationExecutorConnectionV1(x.owner),effect=connection.begin(x.source.headers,x.execution(a));
  t.mock.method(Date,'now',()=>r.set.expiresAtMs+1);
  assert.throws(()=>connection.revalidate(x.source.headers,effect),/DEADLINE_OR_SCOPE_DENIED/);
  connection.failed(effect);
  const o=x.observe({...OBS,invocationId:a.invocationId});
  assert.equal(o.phase,'UNKNOWN');assert.equal(o.attempt,1,'a real dispatch began: attempt 1 is retained');assert.equal(o.taskRevision,2);
  assert.equal(o.resultPhase,null);assert.equal(o.proof,null);assert.equal(x.count(),1);assert.deepEqual(x.before(),prior);
  t.mock.restoreAll();
  assert.throws(()=>x.owner.execute(x.source.headers,x.execution(a)),/INVOCATION_ATTEMPT_ALREADY_REQUIRES_READBACK|INVOCATION_ALREADY_ADMITTED_OR_ATTEMPTED/);
  assert.equal(x.count(),1,'observation and failed dispatch must not duplicate the effect/task');
 }finally{await x.close();}
});
test('696 ACT-01 expired admission produces no task, no attempt and no observation without weakening the existing pre-effect fence',async t=>{
 const x=await fixture();try{const prior=x.before(),r=x.owner.resolve(x.source.headers,x.request()),a=x.owner.admit(x.source.headers,x.selection(r));
  const after=r.set.expiresAtMs+1;t.mock.method(Date,'now',()=>after);
  assert.throws(()=>x.owner.execute(x.source.headers,x.execution(a)),/DEADLINE_OR_SCOPE_DENIED/);
  assert.equal(x.count(),0,'the existing fence rejects before begin: no task row may exist');
  assert.throws(()=>x.observe({...OBS,invocationId:a.invocationId}),/INVOCATION_OBSERVATION_UNBOUND/);
  assert.deepEqual(x.before(),prior);
 }finally{t.mock.restoreAll();await x.close();}
});
test('696 ACT-01 read-only observation denies unknown fields, forged handles and foreign actors as request payloads; observation alone creates no task, effect, attempt or authority',async()=>{
 const x=await fixture();try{const prior=x.before(),r=x.owner.resolve(x.source.headers,x.request()),a=x.owner.admit(x.source.headers,x.selection(r));
  for(const bad of [{...OBS,invocationId:a.invocationId,noSend:false},{...OBS,invocationId:a.invocationId,selector:'#card'},{...OBS,invocationId:a.invocationId,phase:'RESULT_CONFIRMED'},{...OBS,invocationId:a.invocationId,admissionToken:a.admissionToken},OBS,{schemaVersion:OBS.schemaVersion,invocationId:'not-an-invocation'},{schemaVersion:'pansphaira.workspace-action-observation/observe/v2',invocationId:a.invocationId}])assert.throws(()=>x.observe(bad),/INVOCATION_OBSERVATION_INPUT_DENIED/);
  assert.throws(()=>x.observe({...OBS,invocationId:'invocation:'+'f'.repeat(32)}),/INVOCATION_OBSERVATION_UNBOUND/);
  const forged='invocation:'+(a.invocationId[11]==='0'?'1':'0')+a.invocationId.slice(12);assert.notEqual(forged,a.invocationId);assert.throws(()=>x.observe({...OBS,invocationId:forged}),/INVOCATION_OBSERVATION_UNBOUND/);
  assert.throws(()=>x.observe({...OBS,invocationId:a.invocationId},foreignHeaders(x)),/SCOPE_DENIED|SESSION_DENIED|HOSTED_/);
  assert.equal(x.count(),0);assert.deepEqual(x.before(),prior);
  const o=x.observe({...OBS,invocationId:a.invocationId});assert.equal(o.phase,'ADMITTED');assert.equal(o.attempt,0);assert.equal(x.count(),0);
 }finally{await x.close();}
});
