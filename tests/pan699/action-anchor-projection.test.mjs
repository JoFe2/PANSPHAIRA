// UI-ACT-699 first semantic tracer: versioned code-owned action anchors and an
// honest read-only live projection over REAL #696 observations, #597 surface
// snapshots and #548 context facts. Behavior RED first: without the resolver a
// genuine feature-absence assertion fails; unknown/wrong/stale targets must
// yield typed neutral fallbacks, never a guessed DOM target or highlight.
import test from 'node:test';import assert from 'node:assert/strict';import {join}from'node:path';
import {nativeViewFixture546}from'../pan546/native-fixture.mjs';
import {createNativeWorkspaceUiTaskProjectionV2,nativeWorkspaceUiTaskOwnerConnectionV2}from'../../src/pan548/native-ui-task-projection-v2.mjs';
import {createNativeSurfaceProjectionReaderV2}from'../../src/pan546/native-surface-projection-v2.mjs';
import {createNativeWorkspaceSurfacesV2}from'../../src/pan597/native-surfaces-v2.mjs';
import {createNativeWorkspaceInvocationsV1,nativeWorkspaceInvocationExecutorConnectionV1}from'../../src/pan548/native-model-free-invocations-v1.mjs';
import {nativeWorkspaceSurfaceInvocationConnectionV1}from'../../src/pan597/native-surfaces-v2.mjs';
import {protectedWorkspaceSetupStatusV1}from'../../src/pan527/origin-session-adapter.mjs';
import {canonicalJson}from'../../dist/packages/contracts/src/canonical-json.js';
const reg={schemaVersion:'pansphaira.workspace-surface/register/v2',previousSurfaceId:null,previousProof:null,localGeneration:1,pinned:false,dirty:false};
const OBS={schemaVersion:'pansphaira.workspace-action-observation/observe/v1'};
// Feature absence must fail as a behavior assertion, not an import error.
async function loadResolver(){try{return (await import('../../src/pan548/native-action-anchor-projection-v1.mjs')).resolveWorkspaceActionAnchorV1??null;}catch{return null;}}
const resolver=await loadResolver();
async function fixture(){
 const f=await nativeViewFixture546(),headers=f.issue(),source=f.tab(headers),target=f.tab(headers),root=join(f.root,'native-ui-task-projection-v2');
 source.context=f.context.claim(source.headers,{schemaVersion:'pansphaira.workspace-context/claim/v1',tabId:source.context.binding.tabId,moduleId:'pan.erv',viewId:'pan.erv.view',primaryObjectId:source.context.primaryObject.objectId,selection:{elementId:'pan.erv.module-card',rowId:'native-review'},expected:{...source.context.revisions,epoch:source.context.binding.epoch}}).context;
 const tasks=createNativeWorkspaceUiTaskProjectionV2({sessions:f.sessions,root}),reader=createNativeSurfaceProjectionReaderV2({sessions:f.sessions,nativeReader:f.reader,analysisReader:null,readMonitor:()=>protectedWorkspaceSetupStatusV1(f.tls.gateway,{tenantId:'tenant-a',origin:f.tls.origin,identityDigest:f.sessions.binding.identityDigest})});
 const surfaces=createNativeWorkspaceSurfacesV2({sessions:f.sessions,contextSelection:f.context,tasks,reader});
 function register(t){t.surface=surfaces.register(t.headers,reg);t.headers={...t.headers,'x-pan597-surface':t.surface.surfaceId,'x-pan597-proof':t.surface.surfaceProof};return t;}
 register(source);register(target);
 const owner=createNativeWorkspaceInvocationsV1({sessions:f.sessions,contextSelection:f.context,tasks,viewOwner:f.view,surfaces}),n=nativeWorkspaceUiTaskOwnerConnectionV2(tasks,f.sessions.binding);
 const snapshotConn=nativeWorkspaceSurfaceInvocationConnectionV1(surfaces,f.sessions.binding,f.context);
 function request(text,selectedCardId=null,targetSurfaceId=null){return {schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text},context:f.verification(source),selectedCardId,targetSurfaceId};}
 function selection(r){const set=r.set,member=set.candidates.find(c=>c.candidateId===set.selectedCandidateId);return {schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:set.setId,requestDigest:set.requestDigest,setDigest:set.setDigest,candidateId:member?.candidateId,argumentDigest:member?.argumentDigest,policyRef:set.policyRef};}
 function execution(a){return {schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:a.invocationId,admissionToken:a.admissionToken,requestDigest:a.requestDigest,setDigest:a.setDigest,candidateId:a.candidateId,argumentDigest:a.argumentDigest,policyRef:a.policyRef};}
 // Fresh authorized CURRENT read: actual context verify + actual #597 snapshot
 // + actual view readback; overrides simulate a changed/removed current DOM.
 function current(tab,overrides={}){const v=f.context.verify(tab.headers,f.verification(tab)),snapshot=snapshotConn.snapshot(tab.headers);
  const view=tab===source?f.view.read(tab.headers,f.verification(tab)):null;
  return {schemaVersion:'pansphaira.workspace-action-anchor/current/v1',epoch:v.binding.epoch,expectedEpoch:v.binding.epoch,revisions:v.revisions,primaryObjectId:v.primaryObject.objectId,
   surfaces:snapshot.targets.map(p=>({surfaceId:p.surface.surfaceId,revisions:p.binding.revisions})),
   view:view===null?null:{revision:view.revision,viewDigest:view.viewDigest},...overrides};}
 const before=()=>f.store.read(f.sessions.authenticate(source.headers));
 return {f,source,target,owner,surfaces,snapshot:snapshotConn,request,selection,execution,current,before,
  observe(id){return owner.observe(source.headers,{...OBS,invocationId:id});},
    // Test-side fact counter only: audit() is audit-tolerant and is NOT the live
  // authorization reader; the resolver never consults it.
  journalEvents(id){return nativeWorkspaceUiTaskOwnerConnectionV2(tasks,f.sessions.binding).contextJournal.audit(source.headers,id).events.map(e=>({kind:e.kind,taskId:e.taskId}));},
  count(){return n.db.prepare('SELECT count(*) n FROM workspace_ui_tasks_v2').get().n;},
  async close(){owner.close();surfaces.close();tasks.close();await f.close();}};
}
test('699 behavior presence: real confirmed preview observation resolves ONLY the exact registered card anchor: BOUND with representation-only target ref, no selector, no authority, zero mutation',async()=>{
 assert.equal(typeof resolver,'function','UI-ACT-699 behavior RED: no code-owned anchor projection resolver exists in src/pan548/native-action-anchor-projection-v1.mjs');
 const x=await fixture();try{
  const prior=x.before();
  const r=x.owner.resolve(x.source.headers,x.request('Mach die Karte kleiner','native-review'));
  const proposed=resolver(x.observe(r.set.invocationId),x.current(x.source));
  const a=x.owner.admit(x.source.headers,x.selection(r));
  assert.equal(proposed.status,'PENDING');assert.equal(proposed.displayPhase,'PROPOSED');assert.equal(proposed.highlightAllowed,false);assert.equal(proposed.anchorId,'anchor:pan.erv.module-card');assert.equal(proposed.uiTargetRef,null,'a proposal has no highlight target');
  const admitted=resolver(x.observe(a.invocationId),x.current(x.source));
  assert.equal(admitted.status,'PENDING');assert.equal(admitted.displayPhase,'ADMITTED');assert.equal(admitted.highlightAllowed,false,'admission is not applied and must not highlight');assert.match(admitted.stepText,/nothing applied yet/i);
  const result=x.owner.execute(x.source.headers,x.execution(a));
  const o=result.observation;assert.equal(o.phase,'RESULT_CONFIRMED');
  const bound=resolver(o,x.current(x.source));
  assert.equal(bound.status,'BOUND');assert.equal(bound.anchorId,'anchor:pan.erv.module-card');assert.equal(bound.targetClass,'module-card');assert.equal(bound.displayPhase,'CONFIRMED','preview validation is confirmed presentation, not RENDERED');assert.equal(bound.highlightAllowed,false,'a validated preview never claims a rendered highlight');
  assert.equal(bound.objectId,x.source.context.primaryObject.objectId);assert.deepEqual(bound.uiTargetRef.dataAttributes,{'data-pan-anchor':'anchor:pan.erv.module-card','data-pan-object':'AP-PAN516-MATCHED-01'});
  assert.equal(Object.hasOwn(bound.uiTargetRef,'selector'),false);assert.equal(bound.executionAuthorityGranted,false);assert.equal(bound.businessEffectProduced,false);
  assert.equal(bound.reason,'EXACT_REGISTERED_ANCHOR');assert.equal(bound.taskRevision,result.task.revision);
  assert.deepEqual(resolver(o,x.current(x.source)),bound,'pure resolver is idempotent over the same reads');
  assert.equal(x.count(),1,'projection never creates a task');assert.deepEqual(x.before(),prior,'projection never mutates the store');
 }finally{await x.close();}
});
test('699 wrong module, unknown kind, wrong object and forged selector/representation tampering yield typed fallback or denial, never a guessed target',async()=>{
 const x=await fixture();try{
  const prior=x.before(),r=x.owner.resolve(x.source.headers,x.request('Mach die Karte kleiner','native-review')),a=x.owner.admit(x.source.headers,x.selection(r));
  const o=x.owner.execute(x.source.headers,x.execution(a)).observation,cur=x.current(x.source);
  const foreignModule=resolver({...o,semanticTarget:{...o.semanticTarget,moduleId:'pan.unknown'}},cur);
  assert.equal(foreignModule.status,'FALLBACK');assert.equal(foreignModule.reason,'ANCHOR_UNREGISTERED');assert.equal(foreignModule.highlightAllowed,false);assert.equal(foreignModule.anchorId,null,'an unregistered module must not inherit a highlight class');
  const unknownKind=resolver({...o,semanticTarget:{kind:'GUESSED_CSS_THING',moduleId:'pan.erv',viewId:'pan.erv.view',objectId:o.semanticTarget.objectId,instanceId:'whatever'}},cur);
  assert.equal(unknownKind.status,'FALLBACK');assert.equal(unknownKind.reason,'ANCHOR_UNREGISTERED');assert.equal(unknownKind.uiTargetRef,null);assert.equal(unknownKind.stepText,'Presentation unavailable for this step; no target highlight.','fallback text is neutral, never a claimed phase');
  const wrongObject=resolver({...o,semanticTarget:{...o.semanticTarget,objectId:'AP-SOMETHING-ELSE'}},cur);
  assert.equal(wrongObject.status,'FALLBACK');assert.equal(wrongObject.reason,'OBJECT_MISMATCH');assert.equal(wrongObject.highlightAllowed,false);assert.equal(wrongObject.uiTargetRef,null,'a stale/wrong object must never move the highlight onto the current card');
  for(const tampered of [{...o,selector:'#card'},{...o,semanticTarget:{...o.semanticTarget,selector:'#card'}},{...o,semanticTarget:{...o.semanticTarget,clickTarget:'shell'}}])assert.throws(()=>resolver(tampered,cur),/ANCHOR_UI_TARGET_REPRESENTATION_ONLY|ANCHOR_PROJECTION_INPUT_DENIED/,'caller/model strings never become a CSS selector, DOM or click target');
  assert.deepEqual(x.before(),prior);assert.equal(x.count(),1);
 }finally{await x.close();}
});
test('699 stale current context (epoch change, revision drift, changed view, removed surface) falls back with reason and neutral step text',async()=>{
 const x=await fixture();try{
  const prior=x.before(),r=x.owner.resolve(x.source.headers,x.request('Mach die Karte kleiner','native-review')),a=x.owner.admit(x.source.headers,x.selection(r));
  const o=x.owner.execute(x.source.headers,x.execution(a)).observation,cur=x.current(x.source);
  assert.equal(resolver(o,x.current(x.source)).status,'BOUND','sanity: the fresh read binds');
  const epochChanged=resolver(o,x.current(x.source,{expectedEpoch:cur.epoch+1}));
  assert.equal(epochChanged.status,'FALLBACK');assert.equal(epochChanged.reason,'CONTEXT_EPOCH_STALE');assert.equal(epochChanged.highlightAllowed,false);assert.match(epochChanged.stepText,/unavailable/i,'fallback keeps a neutral accessible step text');
  const revisionDrift=resolver(o,x.current(x.source,{revisions:{...cur.revisions,selectionRevision:99}}));
  assert.equal(revisionDrift.status,'FALLBACK');assert.equal(revisionDrift.reason,'CONTEXT_REVISION_STALE');assert.equal(revisionDrift.uiTargetRef,null);
  const viewChanged=resolver(o,x.current(x.source,{view:{revision:cur.view.revision+1,viewDigest:'0'.repeat(64)}}));
  assert.equal(viewChanged.status,'FALLBACK');assert.equal(viewChanged.reason,'CONTEXT_REVISION_STALE');assert.equal(viewChanged.highlightAllowed,false,'a changed/removed view must not keep a confirmed highlight');
  // Regression (699-04): connection.begin ALONE has NOT dispatched — the owner
  // journal holds zero TARGET_ATTEMPTED facts. A legacy ACCEPTED-row observation
  // carries phase DISPATCHED but no dispatch attestation, so the projection must
  // stay honest ADMITTED/PENDING and never claim a real target attempt. Exact
  // dispatch classification after a real connection.dispatch stays OPEN in 699.
  const connection=nativeWorkspaceInvocationExecutorConnectionV1(x.owner),c0=x.owner.resolve(x.source.headers,x.request('Mach die Karte kleiner','native-review')),a0=x.owner.admit(x.source.headers,x.selection(c0));
  const effect=connection.begin(x.source.headers,x.execution(a0));
  assert.equal(x.observe(a0.invocationId).phase,'DISPATCHED','sanity: legacy observation says DISPATCHED after begin only');
  assert.equal(x.journalEvents(a0.invocationId).filter(e=>e.kind==='TARGET_ATTEMPTED').length,0,'sanity: begin journalled no dispatch fact');
  const begun=resolver(x.observe(a0.invocationId),x.current(x.source));
  assert.equal(begun.status,'PENDING');assert.equal(begun.displayPhase,'ADMITTED');assert.equal(begun.highlightAllowed,false);assert.notEqual(begun.displayPhase,'TARGET_ATTEMPTED','begin without connection.dispatch is not proof of a real target attempt');
  connection.dispatch(x.source.headers,effect);
  const dispatched=resolver(x.observe(a0.invocationId),x.current(x.source));
  assert.equal(dispatched.status,'PENDING');assert.equal(dispatched.displayPhase,'ADMITTED','dispatch classification is an open remainder: a legacy DISPATCHED observation never claims more than ADMITTED');
  const view=x.f.view.preview(x.source.headers,JSON.parse(effect.member.argumentBytes));
  connection.finish(x.source.headers,effect,{phase:'PREVIEW_VALIDATED',preview:view,clientRendered:false,personalProfileSaved:false,restored:false});
  assert.equal(x.journalEvents(a0.invocationId).filter(e=>e.kind==='TARGET_ATTEMPTED').length,1,'sanity: the real dispatch journalled exactly one TARGET_ATTEMPTED fact');
  // Real display invocation: accepted delivery is owner-confirmed but NOT
  // rendered; only the actual #597 render ACK may display RENDERED.
  const d=x.owner.resolve(x.source.headers,x.request('Zeige das ausgewählte Dokument rechts',null,x.target.surface.surfaceId)),da=x.owner.admit(x.source.headers,x.selection(d));
  const dr=x.owner.execute(x.source.headers,x.execution(da));assert.equal(dr.result.phase,'DOCUMENT_ACCEPTED');
  const dobs=x.observe(da.invocationId);assert.equal(dobs.phase,'RESULT_CONFIRMED');assert.equal(dobs.rendered,false);
  const boundPeer={surfaceId:x.target.surface.surfaceId,revisions:JSON.parse(canonicalJson(d.set.candidates[0].revisions.target))};
  const accepted=resolver(dobs,{...x.current(x.source),surfaces:[boundPeer]});
  assert.equal(accepted.status,'BOUND');assert.equal(accepted.displayPhase,'CONFIRMED','accepted delivery confirms the owner result without claiming RENDERED');assert.notEqual(accepted.displayPhase,'RENDERED');assert.equal(accepted.highlightAllowed,false,'accepted is not rendered: no highlight before the DOM ACK');
  const command=JSON.parse(d.set.candidates[0].argumentBytes);
  x.surfaces.events(x.target.headers,{schemaVersion:'pansphaira.workspace-surface/events/v2',cursor:0});
  const load=x.surfaces.load(x.target.headers,{schemaVersion:'pansphaira.workspace-surface/load/v2',commandId:command.commandId});
  const permit=x.surfaces.beforeCommit(x.target.headers,{schemaVersion:'pansphaira.workspace-surface/before-dom/v2',commandId:command.commandId,readToken:load.readToken,projectionDigest:load.projection.projectionDigest,localGeneration:1});
  const ack=x.surfaces.acknowledge(x.target.headers,{schemaVersion:'pansphaira.workspace-surface/render-ack/v2',commandId:command.commandId,commitToken:permit.commitToken,projectionDigest:load.projection.projectionDigest,localGeneration:1,contextEpoch:permit.surface.contextEpoch,domCommitted:true});
  assert.equal(ack.status,'RENDERED');
  const rendered=resolver(x.observe(da.invocationId),{...x.current(x.source),surfaces:[boundPeer]});
  assert.equal(rendered.status,'BOUND');assert.equal(rendered.displayPhase,'RENDERED','only the actual #597 render ACK may display RENDERED');assert.equal(rendered.highlightAllowed,true);assert.equal(rendered.reason,'EXACT_REGISTERED_ANCHOR');
  const removed=resolver(x.observe(da.invocationId),{...x.current(x.source),surfaces:[]});
  assert.equal(removed.status,'FALLBACK');assert.equal(removed.reason,'SURFACE_UNAVAILABLE');assert.equal(removed.uiTargetRef,null,'a removed peer surface must not keep or move the highlight');
  assert.deepEqual(x.before(),prior,'display projection also mutates nothing');
 }finally{await x.close();}
});
test('699 accessor/prototype inputs are denied descriptor-safe: no caller getter executes and no prototype field becomes authority',async()=>{
 const x=await fixture();try{
  const prior=x.before(),r=x.owner.resolve(x.source.headers,x.request('Mach die Karte kleiner','native-review')),a=x.owner.admit(x.source.headers,x.selection(r));
  const o=x.owner.execute(x.source.headers,x.execution(a)).observation,cur=x.current(x.source);
  assert.equal(resolver(o,cur).status,'BOUND','sanity: the genuine owner-issued DTOs resolve');
  let hits=0;
  const trap=(base,key)=>{const c={...base};Object.defineProperty(c,key,{enumerable:true,get(){hits++;throw Error('GETTER_EXECUTED');}});return c;};
  const deny=/ANCHOR_PROJECTION_INPUT_DENIED|ANCHOR_UI_TARGET_REPRESENTATION_ONLY/,why='caller/model strings and accessors never become a selector, DOM target or authority, and are denied before any getter runs';
  // Observation root, semanticTarget root/kind and expectedRevisions accessors.
  for(const tampered of [trap(o,'phase'),trap(o,'taskRevision'),{...o,expectedRevisions:trap(o.expectedRevisions,'native')},
   {...o,semanticTarget:trap(o.semanticTarget,'kind')},
   {...o,semanticTarget:Object.defineProperty({...o.semanticTarget},'_probe',{enumerable:true,get(){hits++;return 'x';}})}])
   assert.throws(()=>resolver(tampered,cur),deny,why);
  assert.equal(hits,0,'no observation getter may execute during resolution');
  // Current-context root, revisions, nested view and surface accessors.
  for(const tampered of [trap(cur,'revisions'),{...cur,revisions:trap({...cur.revisions},'domainRevision')},
   {...cur,view:trap(cur.view,'revision')},{...cur,surfaces:[trap(cur.surfaces[0]??{surfaceId:'s',revisions:{}},'surfaceId')]}])
   assert.throws(()=>resolver(o,tampered),deny,why);
  assert.equal(hits,0,'no current-context getter may execute during resolution');
  // Prototype fields are never authority: inherited-only fields fail closed.
  assert.throws(()=>resolver(o,Object.create({schemaVersion:'pansphaira.workspace-action-anchor/current/v1',epoch:1,expectedEpoch:1,revisions:{},primaryObjectId:'x',surfaces:[],view:null})),deny,why);
  assert.deepEqual(x.before(),prior);assert.equal(x.count(),1);
 }finally{await x.close();}
});
 test('699 REVIEW02 C5 class: caller array-index and deep nested accessors never execute; validation consumes only descriptor-safe snapshots and fails closed with typed denial',async()=>{
 const x=await fixture();try{
  const r=x.owner.resolve(x.source.headers,x.request('Mach die Karte kleiner','native-review'));
  const a=x.owner.admit(x.source.headers,x.selection(r));
  const o=x.owner.execute(x.source.headers,x.execution(a)).observation,cur=x.current(x.source);
  assert.equal(resolver(o,cur).status,'BOUND','sanity: genuine owner DTOs still bind after the validation-class fix');
  const d=x.owner.resolve(x.source.headers,x.request('Zeige das ausgewählte Dokument rechts',null,x.target.surface.surfaceId)),da=x.owner.admit(x.source.headers,x.selection(d));
  const dobs=x.observe(da.invocationId);
  const docPeer={surfaceId:x.target.surface.surfaceId,revisions:JSON.parse(canonicalJson(d.set.candidates[0].revisions.target))};
  // Counter measured AFTER all owned setup executes: it spans ONLY resolver
  // reads below, so any ledger movement there is a product effect.
  const countBefore=x.count(),beforeRead=x.before();
  let hits=0;
  const trap=(base,key)=>{const c={...base};Object.defineProperty(c,key,{enumerable:true,get(){hits++;return c[key];}});return c;};
  const deny=/ANCHOR_PROJECTION_INPUT_DENIED|ANCHOR_UI_TARGET_REPRESENTATION_ONLY/,why='caller getters must never execute: array indices and every nested revision depth are validated descriptor-safe before any read';
  // 1) surfaces ARRAY ELEMENT as a getter at a real index (card and document paths).
  const elementTrap=(arr,key)=>{const c=[...arr];Object.defineProperty(c,key,{enumerable:true,get(){hits++;return arr[key];}});return c;};
  assert.throws(()=>resolver(o,{...cur,surfaces:elementTrap(cur.surfaces,0)}),deny,why);
  assert.throws(()=>resolver(dobs,{...cur,surfaces:elementTrap([docPeer],0)}),deny,why);
  // 2) deep nested accessor inside current.revisions (3rd level+), symmetric in
  // observation.expectedRevisions.native: even a getter that RETURNS the valid
  // value is denied outright, it never becomes authority behind a BOUND result.
  assert.throws(()=>resolver(o,{...cur,revisions:{...cur.revisions,marker:{get deep(){hits++;return 7;}}}}),deny,why);
  assert.throws(()=>resolver({...o,expectedRevisions:{...o.expectedRevisions,native:{...o.expectedRevisions.native,marker:{get deep(){hits++;return 7;}}}}},cur),deny,why);
  // 3) array index inside a nested revisions subtree.
  assert.throws(()=>resolver(o,{...cur,revisions:{...cur.revisions,list:((l)=>{Object.defineProperty(l,0,{enumerable:true,get(){hits++;return 1;}});return l;})([1])}}),deny,why);
  // 4) length-only hostile array (zero-index getter, invalid length descriptor).
  assert.throws(()=>resolver(o,{...cur,surfaces:Object.assign(Object.create(Array.prototype),{length:{value:0}})}),deny,why);
  assert.equal(hits,0,'zero caller getter callbacks may execute across raw array indices and all deeper revision fields');
  // 5) positives still work and the owner ledger is untouched across ALL reads.
  assert.equal(resolver(o,cur).status,'BOUND','valid native DTOs still resolve post-fix');
  assert.equal(x.count(),countBefore,'validation reads never create tasks');
  assert.deepEqual(x.before(),beforeRead,'validation reads never mutate the owner store');
 }finally{await x.close();}
});
test('699 registry is closed and versioned: exports are exactly the resolver plus read-only registry data, frozen, selector-free',async()=>{
 const mod=await import('../../src/pan548/native-action-anchor-projection-v1.mjs');
 assert.deepEqual(Object.keys(mod).sort(),['resolveWorkspaceActionAnchorV1','workspaceActionAnchorProjectionStatusesV1','workspaceActionAnchorRegistryVersionV1','workspaceSemanticAnchorRegistryV1'].sort(),'no registration or authority-granting export may exist');
 assert.equal(mod.workspaceActionAnchorRegistryVersionV1,1);assert.equal(Object.isFrozen(mod.workspaceSemanticAnchorRegistryV1),true);
 for(const a of mod.workspaceSemanticAnchorRegistryV1){assert.equal(Object.isFrozen(a),true);assert.equal(Object.hasOwn(a,'selector'),false);}
 assert.deepEqual([...mod.workspaceActionAnchorProjectionStatusesV1],['BOUND','PENDING','FALLBACK']);
});
