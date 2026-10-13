// Only a deterministic original607 OS-process/crash probe. No worker/agent,
// provider, production data, publishing or extra task owner is created.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createOptionalHttpsProductIngressV1,protectedWorkspaceSetupStatusV1,mountProtectedWorkspaceContextSelectionV1,mountProtectedWorkspaceModuleViewsV1,mountProtectedWorkspaceContextProjectionV1} from '../../src/pan527/origin-session-adapter.mjs';
import {createNativeErvReadAdapterV1} from '../../src/pan541/native-erv-read-adapter.mjs';
import {enableWorkspaceBrowserV1} from '../../src/pan541/workspace-browser.mjs';
import {createBrowserProfileStoreV1,createWorkspaceModuleViewStoreV1} from '../../src/pan543/profile-store.mjs';
import {defaultBrowserProfileV1} from '../../dist/packages/contracts/src/browser-profile-v1.js';
import {createNativeWorkspaceContextSelectionV1} from '../../src/pan548/native-context-selection.mjs';
import {createNativeWorkspaceDataCatalogV1,nativeWorkspaceViewFieldsV1} from '../../src/pan546/native-data-catalog.mjs';
import {createNativeWorkspaceViewOwnerV1} from '../../src/pan546/native-view-owner.mjs';
import {createNativeSurfaceProjectionReaderV2} from '../../src/pan546/native-surface-projection-v2.mjs';
import {createNativeWorkspaceUiTaskProjectionV2,nativeWorkspaceUiTaskOwnerConnectionV2} from '../../src/pan548/native-ui-task-projection-v2.mjs';
import {createNativeWorkspaceSurfacesV2} from '../../src/pan597/native-surfaces-v2.mjs';
import {createNativeWorkspaceInvocationsV1,nativeWorkspaceInvocationExecutorConnectionV1} from '../../src/pan548/native-model-free-invocations-v1.mjs';
import {createNativeWorkspaceContextProjectionV1} from '../../src/pan548/native-context-projection-v1.mjs';
import {request527} from '../pan527/helpers.mjs';
const phase=process.argv[2],input=JSON.parse(readFileSync(0,'utf8'));
if(!['TARGET_ACK','FINISH','BEFORE_APPEND','AFTER_APPEND','MISSING_COPY','ACCEPT_ONLY','RECONCILE'].includes(phase))throw Error('607_PROCESS_PROBE_PHASE_DENIED');
const gateway=createOptionalHttpsProductIngressV1(input.options),sessions=gateway.sessionAdapter('tenant-a'),identity=input.options.tenants[0].identity,productRoot=input.options.tenants[0].productRoot;
const reader=createNativeErvReadAdapterV1({tenantId:'tenant-a',root:input.financeRoot}),workspace=enableWorkspaceBrowserV1({optIn:true,gateway,tenantId:'tenant-a',origin:input.options.origin,nativeReader:reader});
const profiles=createBrowserProfileStoreV1({root:productRoot,catalog:()=>defaultBrowserProfileV1().items.map(x=>({id:x.id,version:x.version,state:'AVAILABLE'}))}),store=createWorkspaceModuleViewStoreV1({root:productRoot,fields:nativeWorkspaceViewFieldsV1});
const context=createNativeWorkspaceContextSelectionV1({sessions,identity,nativeReader:reader,readSetup:()=>protectedWorkspaceSetupStatusV1(gateway,{tenantId:'tenant-a',origin:input.options.origin,identityDigest:sessions.binding.identityDigest}),readProfile:p=>profiles.read(p),moduleViewStore:store});
const data=createNativeWorkspaceDataCatalogV1({sessions,contextSelection:context,nativeReader:reader,humanRoot:input.financeRoot}),view=createNativeWorkspaceViewOwnerV1({sessions,contextSelection:context,dataCatalog:data,store});
const ca=mountProtectedWorkspaceContextSelectionV1(gateway,{optIn:true,tenantId:'tenant-a',origin:input.options.origin,identityDigest:sessions.binding.identityDigest,adapterVersion:'pan548-native-context-selection/v1',owner:context}),va=mountProtectedWorkspaceModuleViewsV1(gateway,{optIn:true,tenantId:'tenant-a',origin:input.options.origin,identityDigest:sessions.binding.identityDigest,adapterVersion:'pan546-native-personal-view/v1',dataCatalog:data,viewOwner:view});
const tasks=createNativeWorkspaceUiTaskProjectionV2({sessions,root:input.taskRoot}),targetReader=createNativeSurfaceProjectionReaderV2({sessions,nativeReader:reader,analysisReader:null,readMonitor:()=>protectedWorkspaceSetupStatusV1(gateway,{tenantId:'tenant-a',origin:input.options.origin,identityDigest:sessions.binding.identityDigest})}),surfaces=createNativeWorkspaceSurfacesV2({sessions,contextSelection:context,tasks,reader:targetReader}),invocations=createNativeWorkspaceInvocationsV1({sessions,contextSelection:context,tasks,viewOwner:view,surfaces}),projection=createNativeWorkspaceContextProjectionV1({sessions,tasks,contextSelection:context});
const issued=sessions.issueOwnerSession({subjectId:'synthetic:erv-reviewer',role:'reviewer',expiresAtMs:Date.now()+180000}),baseHeaders={cookie:issued.cookieHeader,origin:input.options.origin,'x-pan527-csrf':issued.csrf,'x-pan548-session':'session:'+createHash('sha256').update(issued.cookieHeader).digest('hex')};
const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(tasks,sessions.binding);
if(phase==='RECONCILE'){
 const attachment=mountProtectedWorkspaceContextProjectionV1(gateway,{optIn:true,tenantId:'tenant-a',origin:input.options.origin,identityDigest:sessions.binding.identityDigest,adapterVersion:'pan548-native-context-projection/v1',owner:projection,script:readFileSync('dist/browser-workspace/workspace-invocations.js','utf8')});
 const port=Number(new URL(input.options.origin).port);await new Promise((resolve,reject)=>{gateway.server.once('error',reject);gateway.server.listen(port,'127.0.0.1',resolve);});
 const fixture={port,cert:readFileSync(input.options.tls.certPath)},url='/t/tenant-a/workspace/context-projection/reconcile',request={schemaVersion:'pansphaira.workspace-context-projection/reconcile/v1'};
 // Concurrent real TLS arrivals consume ONE live PAN548 owner transaction;
 // no competing owner boots or unsafe parallel shared fixed-port fixtures.
 const responses=await Promise.all([request527(fixture,url,baseHeaders,'POST',request),request527(fixture,url,baseHeaders,'POST',request)]);if(responses.some(r=>r.status!==200||!r.tlsAuthorized))throw Error('607_REAL_CONCURRENT_RECONCILE_TLS_DENIED');const results=responses.map(r=>JSON.parse(r.body));
 const snapshot=projection.snapshot(baseHeaders,{schemaVersion:'pansphaira.workspace-context-projection/snapshot-request/v1',audience:'MAIN_CONTRACT'}),inv=snapshot.tasks.find(t=>t.taskId.startsWith('invocation:')),renderEvents=db.prepare("SELECT count(*) n FROM workspace_surface_events_v2 WHERE phase='RENDERED'").get().n;
 const report={pid:process.pid,phase,results,task:inv,head:snapshot.streamHead,sequenceCount:snapshot.includedSequences.length,unknown:snapshot.tasks.some(t=>t.state==='OUTCOME_UNCONFIRMED'),nativeTargetRenderAckCount:renderEvents,parentCompletionCount:snapshot.events.filter(e=>e.taskId===inv.taskId&&e.kind==='INTENT_COMPLETED').length,noSend:snapshot.constraints.noSend,model:'NOT_RUN',physicalDomSightClaim:false,profileRevision:store.read(sessions.authenticate(baseHeaders)).revision};
 console.log(JSON.stringify(report));await new Promise(r=>gateway.server.close(r));attachment.close();invocations.close();surfaces.close();tasks.close();va.close();ca.close();view.close();data.close();context.close();store.close();profiles.close();workspace.close();process.exit(0);
}
function tab(){const b=context.bootstrap(baseHeaders,{}),headers={...baseHeaders,'x-pan548-tab':b.tabProof,'x-pan548-tab-id':b.snapshot.context.binding.tabId},c=b.snapshot.context;const invoice=reader.read({tenantId:'tenant-a',objectId:'AP-PAN516-MATCHED-01',expectedRevision:null}),current=context.claim(headers,{schemaVersion:'pansphaira.workspace-context/claim/v1',tabId:c.binding.tabId,moduleId:'pan.erv',viewId:'pan.erv.view',primaryObjectId:invoice.invoiceId,selection:null,expected:{...c.revisions,domainRevision:invoice.revision,epoch:c.binding.epoch}}).context;
 const s=surfaces.register(headers,{schemaVersion:'pansphaira.workspace-surface/register/v2',previousSurfaceId:null,previousProof:null,localGeneration:1,pinned:false,dirty:false});return {context:current,headers:{...headers,'x-pan597-surface':s.surfaceId,'x-pan597-proof':s.surfaceProof},surface:s};}
const source=tab(),target=tab(),resolved=invocations.resolve(source.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Zeige das ausgewählte Dokument rechts'},context:{schemaVersion:'pansphaira.workspace-context/verify/v1',tabId:source.context.binding.tabId,contextHandle:source.context.contextHandle},selectedCardId:null,targetSurfaceId:target.surface.surfaceId}),s=resolved.set,c=s.candidates.find(x=>x.candidateId===s.selectedCandidateId),admission=invocations.admit(source.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:s.setId,requestDigest:s.requestDigest,setDigest:s.setDigest,candidateId:c.candidateId,argumentDigest:c.argumentDigest,policyRef:s.policyRef}),connection=nativeWorkspaceInvocationExecutorConnectionV1(invocations),effect=connection.begin(source.headers,{schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:admission.invocationId,admissionToken:admission.admissionToken,requestDigest:admission.requestDigest,setDigest:admission.setDigest,candidateId:admission.candidateId,argumentDigest:admission.argumentDigest,policyRef:admission.policyRef});

const command=JSON.parse(effect.member.argumentBytes),accepted=surfaces.accept(source.headers,command);
if(phase==='ACCEPT_ONLY'){console.log(JSON.stringify({pid:process.pid,stage:'ACCEPTED_NOT_RENDERED',invocationId:effect.invocationId}));process.exit(91);}
surfaces.events(target.headers,{schemaVersion:'pansphaira.workspace-surface/events/v2',cursor:0});const loaded=surfaces.load(target.headers,{schemaVersion:'pansphaira.workspace-surface/load/v2',commandId:command.commandId}),permit=surfaces.beforeCommit(target.headers,{schemaVersion:'pansphaira.workspace-surface/before-dom/v2',commandId:command.commandId,readToken:loaded.readToken,projectionDigest:loaded.projection.projectionDigest,localGeneration:1});
surfaces.acknowledge(target.headers,{schemaVersion:'pansphaira.workspace-surface/render-ack/v2',commandId:command.commandId,commitToken:permit.commitToken,projectionDigest:loaded.projection.projectionDigest,localGeneration:1,contextEpoch:permit.surface.contextEpoch,domCommitted:true});
console.log(JSON.stringify({pid:process.pid,stage:'NATIVE_TARGET_COMMIT',invocationId:effect.invocationId,nativeTargetRenderAckCount:db.prepare("SELECT count(*) n FROM workspace_surface_events_v2 WHERE phase='RENDERED'").get().n,physicalDomSightClaim:false}));
if(phase==='TARGET_ACK')process.exit(92);
if(phase==='BEFORE_APPEND'||phase==='AFTER_APPEND'){
 const status=phase==='BEFORE_APPEND'?94:95;db.function('pan607_owned_probe_exit',{deterministic:false},()=>process.exit(status));
 if(phase==='BEFORE_APPEND')db.exec(`CREATE TEMP TRIGGER pan607_owned_before_append AFTER UPDATE OF state ON workspace_ui_tasks_v2 WHEN NEW.command_id='${effect.invocationId}' AND NEW.state='COMPLETED' BEGIN SELECT pan607_owned_probe_exit(); END;`);
 else db.exec(`CREATE TEMP TRIGGER pan607_owned_after_append AFTER INSERT ON workspace_ui_context_outbox_v1 WHEN NEW.task_id='${effect.invocationId}' AND NEW.kind='INTENT_COMPLETED' BEGIN SELECT pan607_owned_probe_exit(); END;`);
}
connection.finish(source.headers,effect,{phase:'DOCUMENT_ACCEPTED',delivery:accepted,clientRendered:false,personalProfileSaved:false,restored:false});
if(phase==='MISSING_COPY')db.prepare("DELETE FROM workspace_ui_context_projection_v1 WHERE seq IN(SELECT seq FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='INTENT_COMPLETED')").run(effect.invocationId);
console.log(JSON.stringify({pid:process.pid,stage:'FINISHED_WITH_DURABLE_OUTBOX',phase,invocationId:effect.invocationId}));process.exit(phase==='MISSING_COPY'?96:93);
