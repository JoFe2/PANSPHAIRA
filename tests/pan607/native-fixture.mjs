import {join} from 'node:path';
import {nativeViewFixture546} from '../pan546/native-fixture.mjs';
import {createNativeWorkspaceUiTaskProjectionV2, nativeWorkspaceUiTaskOwnerConnectionV2, uiTaskDigestV2} from '../../src/pan548/native-ui-task-projection-v2.mjs';
import {createNativeSurfaceProjectionReaderV2} from '../../src/pan546/native-surface-projection-v2.mjs';
import {createNativeWorkspaceSurfacesV2} from '../../src/pan597/native-surfaces-v2.mjs';
import {createNativeWorkspaceInvocationsV1} from '../../src/pan548/native-model-free-invocations-v1.mjs';
import {protectedWorkspaceSetupStatusV1} from '../../src/pan527/origin-session-adapter.mjs';
import {createNativeWorkspaceContextProjectionV1} from '../../src/pan548/native-context-projection-v1.mjs';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
const registration={schemaVersion:'pansphaira.workspace-surface/register/v2',previousSurfaceId:null,previousProof:null,localGeneration:1,pinned:false,dirty:false};
export async function fixture(){
 const f=await nativeViewFixture546(),headers=f.issue(),tab=f.tab(headers),root=join(f.root,'native-ui-task-projection-v2');
 tab.context=f.context.claim(tab.headers,{schemaVersion:'pansphaira.workspace-context/claim/v1',tabId:tab.context.binding.tabId,moduleId:'pan.erv',viewId:'pan.erv.view',primaryObjectId:tab.context.primaryObject.objectId,selection:{elementId:'pan.erv.module-card',rowId:'native-review'},expected:{...tab.context.revisions,epoch:tab.context.binding.epoch}}).context;
 let tasks=createNativeWorkspaceUiTaskProjectionV2({sessions:f.sessions,root});
 const reader=createNativeSurfaceProjectionReaderV2({sessions:f.sessions,nativeReader:f.reader,analysisReader:null,readMonitor:()=>protectedWorkspaceSetupStatusV1(f.tls.gateway,{tenantId:'tenant-a',origin:f.tls.origin,identityDigest:f.sessions.binding.identityDigest})});
 let surfaces=createNativeWorkspaceSurfacesV2({sessions:f.sessions,contextSelection:f.context,tasks,reader}),invocations=createNativeWorkspaceInvocationsV1({sessions:f.sessions,contextSelection:f.context,tasks,viewOwner:f.view,surfaces}),projection=createNativeWorkspaceContextProjectionV1({sessions:f.sessions,tasks,contextSelection:f.context});
 const surface=surfaces.register(tab.headers,registration);tab.headers={...tab.headers,'x-pan597-surface':surface.surfaceId,'x-pan597-proof':surface.surfaceProof};
 function snapshot(audience='MAIN_CONTRACT'){return projection.snapshot(tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/snapshot-request/v1',audience});}
 function preview(){const r=invocations.resolve(tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Mach die Karte kleiner'},context:f.verification(tab),selectedCardId:'native-review',targetSurfaceId:null}),s=r.set,c=s.candidates.find(x=>x.candidateId===s.selectedCandidateId),a=invocations.admit(tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:s.setId,requestDigest:s.requestDigest,setDigest:s.setDigest,candidateId:c.candidateId,argumentDigest:c.argumentDigest,policyRef:s.policyRef});return invocations.execute(tab.headers,{schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:a.invocationId,admissionToken:a.admissionToken,requestDigest:a.requestDigest,setDigest:a.setDigest,candidateId:a.candidateId,argumentDigest:a.argumentDigest,policyRef:a.policyRef});}
 return {f,tab,root,get surfaces(){return surfaces;},get invocations(){return invocations;},get tasks(){return tasks;},get projection(){return projection;},snapshot,preview,reopenOwner(){projection.close();invocations.close();surfaces.close();tasks.close();tasks=createNativeWorkspaceUiTaskProjectionV2({sessions:f.sessions,root});projection=createNativeWorkspaceContextProjectionV1({sessions:f.sessions,tasks,contextSelection:f.context});},async close(){projection.close();invocations.close();surfaces.close();tasks.close();await f.close();}};
}
