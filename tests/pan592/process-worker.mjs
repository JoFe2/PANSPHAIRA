import {isProtectedSessionAdapterV1,createProtectedSessionAdapterV1,createOptionalHttpsProductIngressV1,protectedWorkspaceSetupStatusV1} from '../../src/pan527/origin-session-adapter.mjs';
import {createNativeWorkspaceUiTaskProjectionV2,createNativeWorkspaceUiTaskReadbackV2,nativeWorkspaceUiTaskOwnerConnectionV2} from '../../src/pan548/native-ui-task-projection-v2.mjs';
import {createNativeErvReadAdapterV1,isNativeErvReadAdapterV1} from '../../src/pan541/native-erv-read-adapter.mjs';
import {createBrowserProfileStoreV1,createWorkspaceModuleViewStoreV1,isWorkspaceModuleViewStoreV1} from '../../src/pan543/profile-store.mjs';
import {defaultBrowserProfileV1} from '../../dist/packages/contracts/src/browser-profile-v1.js';
import {createNativeWorkspaceContextSelectionV1} from '../../src/pan548/native-context-selection.mjs';
import {createNativeWorkspaceDataCatalogV1,nativeWorkspaceViewFieldsV1} from '../../src/pan546/native-data-catalog.mjs';
import {createNativeWorkspaceViewOwnerV1} from '../../src/pan546/native-view-owner.mjs';
import {createNativeSurfaceProjectionReaderV2} from '../../src/pan546/native-surface-projection-v2.mjs';
import {createNativeWorkspaceSurfacesV2} from '../../src/pan597/native-surfaces-v2.mjs';
import {createNativeWorkspaceInvocationsV1,nativeWorkspaceInvocationExecutorConnectionV1} from '../../src/pan548/native-model-free-invocations-v1.mjs';
import {enableWorkspaceBrowserV1} from '../../src/pan541/workspace-browser.mjs';
const reg={schemaVersion:'pansphaira.workspace-surface/register/v2',previousSurfaceId:null,previousProof:null,localGeneration:1,pinned:false,dirty:false};
const send=v=>new Promise((resolve,reject)=>process.send({...v,pid:process.pid},e=>e?reject(e):resolve()));
process.once('message',async c=>{let tasks,observer,invocations,surfaces,context,data,view,legacy,store,workspace;try{
 const sessions=createProtectedSessionAdapterV1(c.sessionOptions);
 if(c.mode==='observe'){
  observer=createNativeWorkspaceUiTaskReadbackV2({sessions,root:c.root});
  const readback=observer.read(c.headers,c.request);await send({type:'result',ok:true,readback});
 }else{
  const gateway=createOptionalHttpsProductIngressV1(c.gatewayOptions),nativeReader=createNativeErvReadAdapterV1({tenantId:sessions.binding.tenantId,root:c.nativeRoot});
  workspace=enableWorkspaceBrowserV1({optIn:true,gateway,tenantId:sessions.binding.tenantId,origin:sessions.origin,nativeReader});
  const readSetup=()=>protectedWorkspaceSetupStatusV1(gateway,{tenantId:sessions.binding.tenantId,origin:sessions.origin,identityDigest:sessions.binding.identityDigest});
  legacy=createBrowserProfileStoreV1({root:c.productRoot,catalog:()=>defaultBrowserProfileV1().items.map(x=>({id:x.id,version:x.version,state:'AVAILABLE'}))});store=createWorkspaceModuleViewStoreV1({root:c.productRoot,fields:nativeWorkspaceViewFieldsV1});
  if(!isProtectedSessionAdapterV1(sessions,c.sessionOptions.identity.tenantId)||!isNativeErvReadAdapterV1(nativeReader,c.sessionOptions.identity.tenantId)||!isWorkspaceModuleViewStoreV1(store))throw Error('592_CHILD_OWNER_PREDICATES:'+JSON.stringify({session:isProtectedSessionAdapterV1(sessions,c.sessionOptions.identity.tenantId),reader:isNativeErvReadAdapterV1(nativeReader,c.sessionOptions.identity.tenantId),viewStore:isWorkspaceModuleViewStoreV1(store),sameInstance:sessions.binding.instanceId===c.sessionOptions.identity.instanceId,sameGeneration:sessions.binding.generation===c.sessionOptions.identity.generation}));
  context=createNativeWorkspaceContextSelectionV1({sessions,identity:c.sessionOptions.identity,nativeReader,readSetup:readSetup,readProfile:p=>legacy.read(p),moduleViewStore:store});
  data=createNativeWorkspaceDataCatalogV1({sessions,contextSelection:context,nativeReader,humanRoot:c.nativeRoot});view=createNativeWorkspaceViewOwnerV1({sessions,contextSelection:context,dataCatalog:data,store});
  tasks=createNativeWorkspaceUiTaskProjectionV2({sessions,root:c.root});const n=nativeWorkspaceUiTaskOwnerConnectionV2(tasks,sessions.binding);
  const reader=createNativeSurfaceProjectionReaderV2({sessions,nativeReader,analysisReader:null,readMonitor:readSetup});surfaces=createNativeWorkspaceSurfacesV2({sessions,contextSelection:context,tasks,reader});invocations=createNativeWorkspaceInvocationsV1({sessions,contextSelection:context,tasks,viewOwner:view,surfaces});
  if(c.mode==='restart-read'||c.mode==='restart-reconcile'){
   let reconciled=null,reconcileError=null;
   if(c.mode==='restart-reconcile')try{const row=n.readRow(c.invocationId);reconciled=nativeWorkspaceInvocationExecutorConnectionV1(invocations).reconcileUnknown(c.headers,{schemaVersion:'pansphaira.workspace-invocation/reconcile-native/v1',invocationId:c.invocationId,expectedRevision:row.revision,expectedWriterEpoch:n.bootEpoch});}catch(e){reconcileError=e.message;}
   const readback=invocations.read(c.headers,{schemaVersion:'pansphaira.workspace-invocation/read/v1',invocationId:c.invocationId});let duplicateError;try{invocations.execute(c.headers,c.execution);}catch(e){duplicateError=e.message;}
   await send({type:'result',ok:true,readback,reconciled,reconcileError,duplicateError,writerEpoch:n.bootEpoch});
  }else{
   function tab(){const boot=context.bootstrap(c.headers,{}),b=boot.snapshot.context,headers={...c.headers,'x-pan548-tab':boot.tabProof,'x-pan548-tab-id':b.binding.tabId},invoice=nativeReader.read({tenantId:sessions.binding.tenantId,objectId:'AP-PAN516-MATCHED-01',expectedRevision:null});const claimed=context.claim(headers,{schemaVersion:'pansphaira.workspace-context/claim/v1',tabId:b.binding.tabId,moduleId:'pan.erv',viewId:'pan.erv.view',primaryObjectId:invoice.invoiceId,selection:{elementId:'pan.erv.module-card',rowId:'native-review'},expected:{...b.revisions,domainRevision:invoice.revision,epoch:b.binding.epoch}}).context;const s=surfaces.register(headers,reg);return {context:claimed,headers:{...headers,'x-pan597-surface':s.surfaceId,'x-pan597-proof':s.surfaceProof},surface:s};}
   const source=tab(),target=tab(),doc=c.mode==='unknown-after-document';const request={schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:doc?'Zeige das ausgewählte Dokument rechts':'Mach die Karte kleiner'},context:{schemaVersion:'pansphaira.workspace-context/verify/v1',tabId:source.context.binding.tabId,contextHandle:source.context.contextHandle},selectedCardId:doc?null:'native-review',targetSurfaceId:doc?target.surface.surfaceId:null};
   const r=invocations.resolve(source.headers,request);if(r.outcome!=='RESOLVED')throw Error('592_REAL_CHILD_CANDIDATE_NOT_RESOLVED');const s=r.set,member=s.candidates.find(x=>x.candidateId===s.selectedCandidateId),a=invocations.admit(source.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:s.setId,requestDigest:s.requestDigest,setDigest:s.setDigest,candidateId:member.candidateId,argumentDigest:member.argumentDigest,policyRef:s.policyRef});
   const execution={schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:a.invocationId,admissionToken:a.admissionToken,requestDigest:a.requestDigest,setDigest:a.setDigest,candidateId:a.candidateId,argumentDigest:a.argumentDigest,policyRef:a.policyRef};await send({type:'intent',invocationId:a.invocationId,execution,writerEpoch:n.bootEpoch});
   if(c.mode.startsWith('unknown-')){const connection=nativeWorkspaceInvocationExecutorConnectionV1(invocations),effect=connection.begin(source.headers,execution);if(doc){connection.revalidate(source.headers,effect);surfaces.accept(source.headers,JSON.parse(effect.member.argumentBytes));}await send({type:'interrupted',invocationId:a.invocationId,writerEpoch:n.bootEpoch,nativeTargetAccepted:doc});await new Promise(()=>{});
   }else{invocations.execute(source.headers,execution);if(c.mode==='lost-reply'){await send({type:'committed-response-not-delivered',invocationId:a.invocationId,writerEpoch:n.bootEpoch});await new Promise(()=>{});}else await send({type:'result',ok:true,readback:invocations.read(source.headers,{schemaVersion:'pansphaira.workspace-invocation/read/v1',invocationId:a.invocationId}),writerEpoch:n.bootEpoch});}
  }
 }
}catch(e){await send({type:'result',ok:false,error:e.message});process.exitCode=1;}finally{observer?.close();invocations?.close();surfaces?.close();tasks?.close();view?.close();data?.close();context?.close();store?.close();legacy?.close();workspace?.close();process.disconnect();}});
