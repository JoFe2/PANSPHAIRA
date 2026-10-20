import {join}from'node:path';
import {nativeViewFixture546}from'../pan546/native-fixture.mjs';
import {createNativeWorkspaceUiTaskProjectionV2,nativeWorkspaceUiTaskOwnerConnectionV2,uiTaskDigestV2}from'../../src/pan548/native-ui-task-projection-v2.mjs';
import {createNativeSurfaceProjectionReaderV2}from'../../src/pan546/native-surface-projection-v2.mjs';
import {createNativeWorkspaceSurfacesV2}from'../../src/pan597/native-surfaces-v2.mjs';
import {createNativeWorkspaceInvocationsV1,workspaceInvocationPolicyRefV1}from'../../src/pan548/native-model-free-invocations-v1.mjs';
import {executeNativeWorkspaceInvocationV1}from'../../src/pan548/native-invocation-executor-v1.mjs';
import {protectedWorkspaceSetupStatusV1}from'../../src/pan527/origin-session-adapter.mjs';
import {nativeRows}from'../fixtures/pan515/native-trade-fixture.mjs';
const reg={schemaVersion:'pansphaira.workspace-surface/register/v2',previousSurfaceId:null,previousProof:null,localGeneration:1,pinned:false,dirty:false};
export async function durableFixture592(){
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
 return {f,source,target,tasks,reader,surfaces,owner,n,options,register,request,selection,execution,before,root,sessionOptions:{optIn:true,origin:f.tls.origin,identity:f.tls.tenants[0].identity,stateRoot:f.tls.tenants[0].stateRoot},count(){return n.db.prepare('SELECT count(*) n FROM workspace_ui_tasks_v2').get().n;},async close(){owner.close();surfaces.close();tasks.close();await f.close();}};
}
