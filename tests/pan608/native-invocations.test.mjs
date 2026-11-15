import test from 'node:test';import assert from 'node:assert/strict';import {join}from'node:path';import{createHash}from'node:crypto';
import {nativeViewFixture546}from'../pan546/native-fixture.mjs';
import {createNativeWorkspaceUiTaskProjectionV2,nativeWorkspaceUiTaskOwnerConnectionV2,uiTaskDigestV2}from'../../src/pan548/native-ui-task-projection-v2.mjs';
import {createNativeSurfaceProjectionReaderV2}from'../../src/pan546/native-surface-projection-v2.mjs';
import {createNativeWorkspaceSurfacesV2}from'../../src/pan597/native-surfaces-v2.mjs';
import {createNativeWorkspaceInvocationsV1,nativeWorkspaceInvocationExecutorConnectionV1,workspaceInvocationPolicyRefV1}from'../../src/pan548/native-model-free-invocations-v1.mjs';
import {executeNativeWorkspaceInvocationV1}from'../../src/pan548/native-invocation-executor-v1.mjs';
import {protectedWorkspaceSetupStatusV1}from'../../src/pan527/origin-session-adapter.mjs';
import {nativeRows}from'../fixtures/pan515/native-trade-fixture.mjs';
const reg={schemaVersion:'pansphaira.workspace-surface/register/v2',previousSurfaceId:null,previousProof:null,localGeneration:1,pinned:false,dirty:false};
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
 const before=()=>f.store.read(f.sessions.authenticate(source.headers));
 return {f,source,target,tasks,reader,surfaces,owner,n,options,register,request,selection,execution,before,count(){return n.db.prepare('SELECT count(*) n FROM workspace_ui_tasks_v2').get().n;},async close(){owner.close();surfaces.close();tasks.close();await f.close();}};
}
test('608 AC01/02 actual native resolver supplies complete versioned candidate bytes/revisions/refs/scope/policy/deadline, no model or side effect',async()=>{
 const x=await fixture();try{const prior=x.before(),r=x.owner.resolve(x.source.headers,x.request());assert.equal(r.outcome,'RESOLVED');assert.ok(r.set.candidates.length>1);assert.equal(r.set.policyRef,workspaceInvocationPolicyRefV1);const {setDigest,...unsigned}=r.set;assert.equal(setDigest,uiTaskDigestV2(unsigned));for(const c of r.set.candidates){assert.equal(c.schemaVersion,'pansphaira.workspace-invocation/candidate/v1');assert.equal(c.argumentDigest,uiTaskDigestV2(JSON.parse(c.argumentBytes)));assert.equal(c.revisions.viewRevision,prior.revision);assert.equal(c.revisions.viewDigest,prior.viewDigest);assert.equal(c.objectRef.objectId,x.source.context.primaryObject.objectId);assert.equal(c.targetRef.surfaceId,x.source.surface.surfaceId);assert.equal(c.scope.binding.role,'reviewer');assert.equal(c.constraints.noSend,true);assert.equal(c.constraints.personalSave,false);assert.ok(c.expiresAtMs<=x.source.context.lease.expiresAtMs);assert.equal(c.policyRef,r.set.policyRef);}assert.equal(x.count(),0);assert.deepEqual(x.before(),prior);assert.equal(r.model,'NOT_RUN');assert.equal(r.executionAuthorityGranted,false);}finally{await x.close();}
});
test('608 AC04/06 admitted reversible card action consumes existing546 preview validator, never saves profile or claims PREVIEW_RENDERED',async()=>{
 const x=await fixture();try{const prior=x.before(),r=x.owner.resolve(x.source.headers,x.request()),a=x.owner.admit(x.source.headers,x.selection(r)),c=x.execution(a),result=executeNativeWorkspaceInvocationV1(x.owner,x.source.headers,c);assert.equal(result.result.phase,'PREVIEW_VALIDATED');assert.equal(result.result.clientRendered,false);assert.equal(result.result.personalProfileSaved,false);assert.equal(result.result.preview.afterView.instances.find(i=>i.instanceId==='native-review').size,'compact');assert.equal(result.result.preview.persistenceProduced,false);assert.equal(result.task.state,'COMPLETED');assert.equal(x.count(),1);assert.deepEqual(x.before(),prior);assert.throws(()=>x.owner.execute(x.source.headers,c),/ATTEMPT_ALREADY_REQUIRES_READBACK/);assert.equal(x.count(),1);const read=x.owner.read(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/read/v1',invocationId:a.invocationId});assert.equal(read.independentRead,true);assert.equal(read.task.result.phase,'PREVIEW_VALIDATED');assert.equal(read.personalViewPersistenceProduced,false);const p=result.result.preview;x.f.view.cancel(x.source.headers,{schemaVersion:'pansphaira.workspace-module-view/cancel/v1',context:x.f.verification(x.source),candidateHandle:p.candidateHandle,candidateDigest:p.candidateDigest});assert.deepEqual(x.before(),prior);}finally{await x.close();}
});
test('608 AC02/06 actual selected native document consumes existing597 two-tab delivery/task/read/permit/ACK; no preview/profile save',async()=>{
 const x=await fixture();try{const prior=x.before(),r=x.owner.resolve(x.source.headers,x.request('Zeige das ausgewählte Dokument rechts',null,x.target.surface.surfaceId));assert.equal(r.outcome,'RESOLVED');const member=r.set.candidates[0];assert.equal(member.documentRef.objectId,x.source.context.primaryObject.objectId);assert.equal(member.documentRef.dataRevision,x.source.context.primaryObject.revision);const a=x.owner.admit(x.source.headers,x.selection(r)),result=x.owner.execute(x.source.headers,x.execution(a)),c=result.result.delivery.originalCommand;assert.equal(result.result.phase,'DOCUMENT_ACCEPTED');assert.equal(result.result.delivery.status,'ACCEPTED');assert.equal(result.result.clientRendered,false);x.surfaces.events(x.target.headers,{schemaVersion:'pansphaira.workspace-surface/events/v2',cursor:0});const load=x.surfaces.load(x.target.headers,{schemaVersion:'pansphaira.workspace-surface/load/v2',commandId:c.commandId});assert.equal(load.projection.objectId,c.objectId);const permit=x.surfaces.beforeCommit(x.target.headers,{schemaVersion:'pansphaira.workspace-surface/before-dom/v2',commandId:c.commandId,readToken:load.readToken,projectionDigest:load.projection.projectionDigest,localGeneration:1});const ack=x.surfaces.acknowledge(x.target.headers,{schemaVersion:'pansphaira.workspace-surface/render-ack/v2',commandId:c.commandId,commitToken:permit.commitToken,projectionDigest:load.projection.projectionDigest,localGeneration:1,contextEpoch:permit.surface.contextEpoch,domCommitted:true});assert.equal(ack.status,'RENDERED');assert.equal(ack.render.physicalPixelSightCertified,false);assert.deepEqual(x.before(),prior);assert.equal(nativeRows(x.f.native.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0);}finally{await x.close();}
});
test('608 AC02 null/missing selection and target ambiguity remain CLARIFY, cannot admit even a complete member directly',async()=>{
 const x=await fixture();try{for(const request of [x.request('Mach die Karte kleiner',null),x.request('Zeige das ausgewählte Dokument rechts',null,null),x.request('Mach die Karte kleiner','missing-card'),{...x.request(),context:null}]){const r=x.owner.resolve(x.source.headers,request);assert.equal(r.outcome,'CLARIFY');if(r.set?.candidates.length)assert.throws(()=>x.owner.admit(x.source.headers,x.selection(r)),/SELECTION_DENIED/);}const more=x.register(x.f.tab(x.source.headers));const r=x.owner.resolve(x.source.headers,x.request('Zeige das ausgewählte Dokument rechts',null,null));assert.equal(r.outcome,'CLARIFY');assert.equal(r.set.candidates.length,2);assert.ok(r.set.candidates.some(c=>c.targetRef.surfaceId===more.surface.surfaceId));assert.equal(x.count(),0);}finally{await x.close();}
});
test('608 AC03 whole negation/self-correction/unknown multipart and partial/Save input never mint admission or native effect',async()=>{
 const x=await fixture();try{for(const text of ['Nicht die Karte kleiner','Mach die Karte kleiner, nein doch nicht','nur Standort korrigieren','Mach die Karte kleiner und sende Mail','Save','mail.send','externalDraft.write']){const r=x.owner.resolve(x.source.headers,x.request(text));assert.equal(r.outcome,'MAIN');assert.equal(r.set,null);}const req=x.request();req.input.final=false;assert.throws(()=>x.owner.resolve(x.source.headers,req),/FINAL_TEXT_DENIED/);assert.equal(x.owner.resolve(x.source.headers,x.request('')).outcome,'NONE');assert.equal(x.count(),0);assert.equal(x.before().revision,0);}finally{await x.close();}
});
test('608 AC04 incomplete/set/argument/policy tampering and raw direct toolcall bypass produce no task or preview',async()=>{
 const x=await fixture();try{const r=x.owner.resolve(x.source.headers,x.request()),c=x.selection(r);for(const bad of [{...c,setDigest:'0'.repeat(64)},{...c,requestDigest:'0'.repeat(64)},{...c,argumentDigest:'0'.repeat(64)},{...c,policyRef:'fake-policy'},{...c,candidateId:'candidate:'+'0'.repeat(64)},{schemaVersion:c.schemaVersion,setId:c.setId,candidateId:c.candidateId},{...c,routeId:'https://foreign.invalid'},{...c,capability:'mail.send'}])assert.throws(()=>x.owner.admit(x.source.headers,bad),/INVOCATION_/);const raw={schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:r.set.invocationId,admissionToken:'0'.repeat(64),requestDigest:r.set.requestDigest,setDigest:r.set.setDigest,candidateId:c.candidateId,argumentDigest:c.argumentDigest,policyRef:c.policyRef};assert.throws(()=>executeNativeWorkspaceInvocationV1(x.owner,x.source.headers,raw),/ADMISSION_REQUIRED/);assert.throws(()=>executeNativeWorkspaceInvocationV1({...x.owner},x.source.headers,raw),/OWNER_DENIED/);assert.equal(x.count(),0);}finally{await x.close();}
});
test('608 AC04 expired set/deadline deny admission/execution without extending the native lease',async t=>{
 const x=await fixture();try{const r=x.owner.resolve(x.source.headers,x.request()),a=x.owner.admit(x.source.headers,x.selection(r)),after=r.set.expiresAtMs+1;t.mock.method(Date,'now',()=>after);assert.throws(()=>x.owner.admit(x.source.headers,x.selection(r)),/SET_EXPIRED/);assert.throws(()=>x.owner.execute(x.source.headers,x.execution(a)),/DEADLINE_OR_SCOPE_DENIED/);assert.equal(x.count(),0);}finally{t.mock.restoreAll();await x.close();}
});
test('608 AC04/05 direct current-session role/proof spoof, foreign principal and candidate-generation drift cannot reuse admission',async()=>{
 const x=await fixture();try{const r=x.owner.resolve(x.source.headers,x.request()),a=x.owner.admit(x.source.headers,x.selection(r)),c=x.execution(a);const foreign=x.register(x.f.tab(x.f.issue('synthetic:foreign-reader','reader')));assert.throws(()=>x.owner.execute(foreign.headers,c),/SCOPE_DENIED|DEADLINE_OR_SCOPE_DENIED/);assert.throws(()=>x.owner.execute({...x.source.headers,'x-role':'reviewer'},c),/HOSTED_HEADER_AUTHORITY_DENIED/);assert.throws(()=>x.owner.execute({...x.source.headers,'x-pan597-proof':'0'.repeat(64)},c),/PROOF_DENIED/);x.surfaces.state(x.source.headers,{schemaVersion:'pansphaira.workspace-surface/state/v2',connectionEpoch:1,expectedGeneration:1,localGeneration:2,pinned:false,dirty:false});assert.throws(()=>x.owner.execute(x.source.headers,c),/CONTEXT_SCOPE_STALE/);assert.equal(x.count(),0);}finally{await x.close();}
});
test('608 AC04/06 real profile/source revision or selected target Pin change fences an admitted candidate immediately before effect',async()=>{
 const x=await fixture();try{const r=x.owner.resolve(x.source.headers,x.request()),a=x.owner.admit(x.source.headers,x.selection(r)),p=x.f.preview(x.source,[{kind:'RESIZE',instanceId:'native-review',size:'large'}]);x.f.view.confirm(x.source.headers,x.f.confirmation(x.source,p));assert.throws(()=>x.owner.execute(x.source.headers,x.execution(a)),/CONTEXT_REVISION_STALE|VIEW_REVISION_STALE/);assert.equal(x.count(),0);x.f.fresh(x.source);x.surfaces.state(x.source.headers,{schemaVersion:'pansphaira.workspace-surface/state/v2',connectionEpoch:1,expectedGeneration:1,localGeneration:2,pinned:false,dirty:false});x.f.fresh(x.target);x.surfaces.state(x.target.headers,{schemaVersion:'pansphaira.workspace-surface/state/v2',connectionEpoch:1,expectedGeneration:1,localGeneration:2,pinned:false,dirty:false});const doc=x.owner.resolve(x.source.headers,x.request('Zeige das ausgewählte Dokument rechts',null,x.target.surface.surfaceId)),ad=x.owner.admit(x.source.headers,x.selection(doc));x.surfaces.state(x.target.headers,{schemaVersion:'pansphaira.workspace-surface/state/v2',connectionEpoch:1,expectedGeneration:2,localGeneration:3,pinned:true,dirty:false});assert.throws(()=>x.owner.execute(x.source.headers,x.execution(ad)),/TARGET_SCOPE_STALE/);assert.equal(x.count(),0);}finally{await x.close();}
});
test('608 AC05 no-send/local-only cannot be relabeled by declaration; Save/Send/remote Undo never enter the executor capability set',async()=>{
 const x=await fixture();try{const r=x.owner.resolve(x.source.headers,x.request()),selection=x.selection(r);for(const extra of [{noSend:false},{constraints:{noSend:false}},{capability:'mail.send'},{capability:'externalDraft.write'},{capability:'pan.workspace.profile.save/v1'}])assert.throws(()=>x.owner.admit(x.source.headers,{...selection,...extra}),/ADMISSION_INPUT_DENIED/);const a=x.owner.admit(x.source.headers,selection);for(const extra of [{capability:'mail.send'},{confirmation:'CONFIRM_PERSONAL_VIEW'},{targetRevision:0}])assert.throws(()=>x.owner.execute(x.source.headers,{...x.execution(a),...extra}),/EXECUTOR_INPUT_DENIED/);assert.equal(x.count(),0);assert.equal(x.before().revision,0);}finally{await x.close();}
});
test('608 direct invocation input closes nested data without running caller getters or transforming IDs',async()=>{
 const x=await fixture();try{let reads=0;const req=x.request();Object.defineProperty(req.input,'text',{enumerable:true,get(){reads++;return 'Mach die Karte kleiner';}});assert.throws(()=>x.owner.resolve(x.source.headers,req),/FINAL_TEXT_DENIED/);assert.equal(reads,0);const bad=x.owner.resolve(x.source.headers,x.request('Mach die Karte kleiner',' Native-review '));assert.equal(bad.outcome,'CLARIFY');assert.equal(x.count(),0);}finally{await x.close();}
});

test('608 native card selection proof cannot be replaced by a caller-selected different legitimate instance',async()=>{
 const x=await fixture();try{const r=x.owner.resolve(x.source.headers,x.request('Mach die Karte kleiner','invoice-value'));assert.equal(r.outcome,'CLARIFY');assert.ok(r.set.candidates.some(c=>c.objectRef.instanceId==='invoice-value'));assert.throws(()=>x.owner.admit(x.source.headers,x.selection(r)),/SELECTION_DENIED/);assert.equal(x.count(),0);assert.equal(x.before().revision,0);}finally{await x.close();}
});

test('698 ACT-03 owner pause fences the next real dispatch and acknowledges PAUSED with finite control revision',async()=>{
 const x=await fixture();try{
  const prior=x.before();
  assert.equal(typeof x.owner.pause,'function','ACT-03 #698 owner pause control not delivered on the existing invocation owner');
  const running=x.owner.control(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/control-read/v1'});
  assert.deepEqual(running,{schemaVersion:'pansphaira.workspace-invocation/control/v1',state:'RUNNING',controlRevision:0,ownerBound:false});
  const r=x.owner.resolve(x.source.headers,x.request()),a=x.owner.admit(x.source.headers,x.selection(r)),c=x.execution(a);
  const p=x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:0});
  assert.equal(p.state,'PAUSE_REQUESTED');assert.equal(p.controlRevision,1);assert.equal(p.ownerBound,true);
  assert.throws(()=>x.owner.execute(x.source.headers,c),/INVOCATION_PAUSED/);
  assert.equal(x.count(),0);assert.deepEqual(x.before(),prior);
  const ack=x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:1});
  assert.equal(ack.state,'PAUSED');assert.equal(ack.controlRevision,2);
  // Repeated/idempotent pause at the acknowledged frontier cannot duplicate the
  // transition or inflate the revision; a stale-control replay is denied.
  assert.deepEqual(x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:2}),ack);
  assert.throws(()=>x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:1}),/INVOCATION_CONTROL_STALE_REVISION/);
  for(const bad of [{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:3,extra:1},{schemaVersion:'pansphaira.workspace-invocation/pause/v2',expectedControlRevision:2},{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:-1}])
   assert.throws(()=>x.owner.pause(x.source.headers,bad),/INVOCATION_CONTROL_INPUT_DENIED/);
  // Foreign actor: no rights from pointer/history/timing, no state learned, no fence lifted.
  const issued=x.f.sessions.issueOwnerSession({subjectId:'synthetic:other-reader',role:'reader',expiresAtMs:Date.now()+60000});
  const foreign={cookie:issued.cookieHeader,origin:x.f.tls.origin,'x-pan527-csrf':issued.csrf,'x-pan548-session':'session:'+createHash('sha256').update(issued.cookieHeader).digest('hex')};
  assert.throws(()=>x.owner.pause(foreign,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:2}),/INVOCATION_CONTROL_SCOPE_DENIED/);
  assert.throws(()=>x.owner.resume(foreign,{schemaVersion:'pansphaira.workspace-invocation/resume/v1',expectedControlRevision:2}),/INVOCATION_CONTROL_SCOPE_DENIED/);
  assert.throws(()=>x.owner.control(foreign,{schemaVersion:'pansphaira.workspace-invocation/control-read/v1'}),/INVOCATION_CONTROL_SCOPE_DENIED/);
  assert.deepEqual(x.owner.control(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/control-read/v1'}),ack);
  assert.throws(()=>x.owner.execute(x.source.headers,c),/INVOCATION_PAUSED/);
  assert.equal(x.count(),0);assert.deepEqual(x.before(),prior);
  // Resume re-opens exactly the next dispatch; the existing executor revalidation
  // still decides custody, and the same admission completes through real paths.
  const res=x.owner.resume(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/resume/v1',expectedControlRevision:2});
  assert.deepEqual(res,{schemaVersion:'pansphaira.workspace-invocation/control/v1',state:'RUNNING',controlRevision:3,ownerBound:true});
  assert.deepEqual(x.owner.resume(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/resume/v1',expectedControlRevision:3}),res);
  assert.throws(()=>x.owner.resume(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/resume/v1',expectedControlRevision:2}),/INVOCATION_CONTROL_STALE_REVISION/);
  const result=executeNativeWorkspaceInvocationV1(x.owner,x.source.headers,c);
  assert.equal(result.result.phase,'PREVIEW_VALIDATED');assert.equal(result.task.state,'COMPLETED');
  assert.equal(x.count(),1);assert.deepEqual(x.before(),prior);
  // A completed attempt cannot be replayed by a later pause/resume round.
  const p2=x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:3});assert.equal(p2.state,'PAUSE_REQUESTED');assert.equal(p2.controlRevision,4);
  assert.deepEqual(x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:4}),{schemaVersion:'pansphaira.workspace-invocation/control/v1',state:'PAUSED',controlRevision:5,ownerBound:true});
  assert.throws(()=>executeNativeWorkspaceInvocationV1(x.owner,x.source.headers,c),/ATTEMPT_ALREADY_REQUIRES_READBACK/);
  assert.equal(x.count(),1);assert.deepEqual(x.before(),prior);
 }finally{await x.close();}
});

test('698 ACT-03 barrier pause mid-dispatch keeps the dispatch-won attempt honest and never undispatches it',async()=>{
 const x=await fixture();try{
  const prior=x.before();
  const r=x.owner.resolve(x.source.headers,x.request()),a=x.owner.admit(x.source.headers,x.selection(r)),c=x.execution(a);
  const connection=nativeWorkspaceInvocationExecutorConnectionV1(x.owner);
  const effect=connection.begin(x.source.headers,c);
  // The dispatch transaction wins the linearization race against this pause.
  connection.dispatch(x.source.headers,effect);
  const p=x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:0});
  assert.equal(p.state,'PAUSE_REQUESTED');assert.equal(p.controlRevision,1);
  const pa=x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:1});
  assert.equal(pa.state,'PAUSING');assert.equal(pa.controlRevision,2);
  const finish=connection.finish(x.source.headers,effect,{phase:'PREVIEW_VALIDATED',preview:x.f.view.preview(x.source.headers,JSON.parse(effect.member.argumentBytes)),clientRendered:false,personalProfileSaved:false,restored:false});
  assert.equal(finish.task.state,'COMPLETED');
  const ack=x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:2});
  assert.equal(ack.state,'PAUSED');assert.equal(ack.controlRevision,3);
  assert.equal(x.count(),1);assert.deepEqual(x.before(),prior);
  // No new dispatch crosses the fence, but the original completion stays real:
  // neither rollback, cancel nor undispatch is claimed or performed.
  const r2=x.owner.resolve(x.source.headers,x.request()),a2=x.owner.admit(x.source.headers,x.selection(r2));
  assert.throws(()=>executeNativeWorkspaceInvocationV1(x.owner,x.source.headers,x.execution(a2)),/INVOCATION_PAUSED/);
  assert.equal(x.count(),1);
  const row=x.n.db.prepare('SELECT state,revision FROM workspace_ui_tasks_v2 WHERE command_id=?').get(a.invocationId);
  assert.deepEqual({...row},{state:'COMPLETED',revision:2});
 }finally{await x.close();}
});

test('698 ACT-03 fence between begin and dispatch blocks TARGET_ATTEMPTED with no receipt, and resume-revalidated dispatch stays single',async()=>{
 const x=await fixture();try{
  const prior=x.before();
  const r=x.owner.resolve(x.source.headers,x.request()),a=x.owner.admit(x.source.headers,x.selection(r)),c=x.execution(a);
  const connection=nativeWorkspaceInvocationExecutorConnectionV1(x.owner);
  const effect=connection.begin(x.source.headers,c);
  const p=x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:0});
  assert.equal(p.state,'PAUSE_REQUESTED');
  assert.throws(()=>connection.dispatch(x.source.headers,effect),/INVOCATION_PAUSED/);
  // The fenced attempt already holds a real ACCEPTED task row and budget
  // reservation: no TARGET_ATTEMPTED, no target call, no duplicate task.
  assert.equal(x.count(),1);
  assert.equal(x.n.db.prepare('SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind=?').get(a.invocationId,'TARGET_ATTEMPTED').n,0);
  assert.equal(x.n.db.prepare("SELECT state FROM workspace_ui_tasks_v2 WHERE command_id=?").get(a.invocationId).state,'ACCEPTED');
  // A second pause attempt while a fenced-but-attempted admission is pending
  // sees no open TARGET_ATTEMPTED work: PAUSED is still provable honestly.
  const ack=x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:1});
  assert.equal(ack.state,'PAUSED');assert.equal(ack.controlRevision,2);
  const res=x.owner.resume(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/resume/v1',expectedControlRevision:2});
  assert.equal(res.state,'RUNNING');assert.equal(res.controlRevision,3);
  connection.dispatch(x.source.headers,effect);
  const finish=connection.finish(x.source.headers,effect,{phase:'PREVIEW_VALIDATED',preview:x.f.view.preview(x.source.headers,JSON.parse(effect.member.argumentBytes)),clientRendered:false,personalProfileSaved:false,restored:false});
  assert.equal(finish.task.state,'COMPLETED');assert.equal(finish.task.revision,2);
  assert.equal(x.n.db.prepare('SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind=?').get(a.invocationId,'TARGET_ATTEMPTED').n,1);
  assert.equal(x.count(),1);assert.deepEqual(x.before(),prior);
  // Stale pre-fence pause cannot undo the newer RUNNING revision.
  assert.throws(()=>x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:2}),/INVOCATION_CONTROL_STALE_REVISION/);
  assert.equal(x.owner.control(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/control-read/v1'}).state,'RUNNING');
 }finally{await x.close();}
});

test('698 ACT-03 fenced dispatch-won attempt keeps original UNKNOWN, restart keeps durable pause authority',async()=>{
 const x=await fixture();try{
  const prior=x.before();
  const r=x.owner.resolve(x.source.headers,x.request()),a=x.owner.admit(x.source.headers,x.selection(r)),c=x.execution(a);
  const connection=nativeWorkspaceInvocationExecutorConnectionV1(x.owner);
  const effect=connection.begin(x.source.headers,c);
  connection.dispatch(x.source.headers,effect);
  const p=x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:0});
  assert.equal(p.state,'PAUSE_REQUESTED');
  // Real lost-reply path for the already-dispatched attempt.
  connection.failed(effect);
  const row=x.n.db.prepare('SELECT state,revision FROM workspace_ui_tasks_v2 WHERE command_id=?').get(a.invocationId);
  assert.equal(row.state,'OUTCOME_UNCONFIRMED');
  assert.equal(x.n.db.prepare('SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind=?').get(a.invocationId,'OUTCOME_UNKNOWN').n,1);
  // The dispatch-won attempt settled to original UNKNOWN, not an open ACCEPTED
  // attempt: fence acknowledged; UNKNOWN keeps its source identity either way.
  const pa=x.owner.pause(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:1});
  assert.equal(pa.state,'PAUSED');assert.equal(pa.controlRevision,2);
  // Actual owner restart: a fresh owner over the SAME durable ledger must keep
  // the pause fence authority and revision; old boot handles fail independently.
  const boot=x.n.bootEpoch;
  x.owner.close();x.surfaces.close();x.tasks.close();
  const tasks2=createNativeWorkspaceUiTaskProjectionV2({sessions:x.f.sessions,root:x.n.root}),n2=nativeWorkspaceUiTaskOwnerConnectionV2(tasks2,x.f.sessions.binding),surfaces2=createNativeWorkspaceSurfacesV2({sessions:x.f.sessions,contextSelection:x.f.context,tasks:tasks2,reader:x.reader}),owner2=createNativeWorkspaceInvocationsV1({...x.options,tasks:tasks2,surfaces:surfaces2});
  try{
   assert.equal(n2.bootEpoch,boot+1);
   const ctrl=owner2.control(x.source.headers,{schemaVersion:'pansphaira.workspace-invocation/control-read/v1'});
   assert.equal(ctrl.state,'PAUSED');assert.equal(ctrl.controlRevision,2);assert.equal(ctrl.ownerBound,true);
   // Restart reconciled nothing itself: UNKNOWN keeps source identity via the
   // original epoch; the fence still blocks a fresh admission's dispatch. The
   // honest reconnect path is required: old surface proofs fail on the new
   // surfaces owner, so re-register the same tab first.
   assert.throws(()=>owner2.resolve(x.source.headers,x.request()),/SURFACE_RECONNECT_REQUIRED/);
   x.source.surface=surfaces2.register(x.source.headers,reg);
   const reheaders={...x.source.headers,'x-pan597-surface':x.source.surface.surfaceId,'x-pan597-proof':x.source.surface.surfaceProof};
   const r2=owner2.resolve(reheaders,x.request()),a2=owner2.admit(reheaders,x.selection(r2));
   assert.throws(()=>executeNativeWorkspaceInvocationV1(owner2,reheaders,x.execution(a2)),/INVOCATION_PAUSED/);
   const ack=owner2.pause(reheaders,{schemaVersion:'pansphaira.workspace-invocation/pause/v1',expectedControlRevision:2});
   assert.deepEqual(ack,ctrl);
  }finally{owner2.close();surfaces2.close();tasks2.close();await x.f.close();}
 }finally{}
});
