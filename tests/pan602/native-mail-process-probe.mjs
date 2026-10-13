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
import {createNativeWorkspaceMailLocalV1} from '../../src/pan548/native-mail-local-v1.mjs';
const input=JSON.parse(readFileSync(0,'utf8'));if(process.argv.length!==2)throw Error('602_OWNED_MAIL_RESTART_ARGUMENT_DENIED');
const gateway=createOptionalHttpsProductIngressV1(input.options),sessions=gateway.sessionAdapter('tenant-a'),identity=input.options.tenants[0].identity,productRoot=input.options.tenants[0].productRoot;
const reader=createNativeErvReadAdapterV1({tenantId:'tenant-a',root:input.financeRoot}),workspace=enableWorkspaceBrowserV1({optIn:true,gateway,tenantId:'tenant-a',origin:input.options.origin,nativeReader:reader});
const profiles=createBrowserProfileStoreV1({root:productRoot,catalog:()=>defaultBrowserProfileV1().items.map(x=>({id:x.id,version:x.version,state:'AVAILABLE'}))}),store=createWorkspaceModuleViewStoreV1({root:productRoot,fields:nativeWorkspaceViewFieldsV1});
const context=createNativeWorkspaceContextSelectionV1({sessions,identity,nativeReader:reader,readSetup:()=>protectedWorkspaceSetupStatusV1(gateway,{tenantId:'tenant-a',origin:input.options.origin,identityDigest:sessions.binding.identityDigest}),readProfile:p=>profiles.read(p),moduleViewStore:store});
const data=createNativeWorkspaceDataCatalogV1({sessions,contextSelection:context,nativeReader:reader,humanRoot:input.financeRoot}),view=createNativeWorkspaceViewOwnerV1({sessions,contextSelection:context,dataCatalog:data,store});
const ca=mountProtectedWorkspaceContextSelectionV1(gateway,{optIn:true,tenantId:'tenant-a',origin:input.options.origin,identityDigest:sessions.binding.identityDigest,adapterVersion:'pan548-native-context-selection/v1',owner:context}),va=mountProtectedWorkspaceModuleViewsV1(gateway,{optIn:true,tenantId:'tenant-a',origin:input.options.origin,identityDigest:sessions.binding.identityDigest,adapterVersion:'pan546-native-personal-view/v1',dataCatalog:data,viewOwner:view});
const tasks=createNativeWorkspaceUiTaskProjectionV2({sessions,root:input.taskRoot}),targetReader=createNativeSurfaceProjectionReaderV2({sessions,nativeReader:reader,analysisReader:null,readMonitor:()=>protectedWorkspaceSetupStatusV1(gateway,{tenantId:'tenant-a',origin:input.options.origin,identityDigest:sessions.binding.identityDigest})}),surfaces=createNativeWorkspaceSurfacesV2({sessions,contextSelection:context,tasks,reader:targetReader}),invocations=createNativeWorkspaceInvocationsV1({sessions,contextSelection:context,tasks,viewOwner:view,surfaces}),projection=createNativeWorkspaceContextProjectionV1({sessions,tasks,contextSelection:context});
const issued=sessions.issueOwnerSession({subjectId:'synthetic:erv-reviewer',role:'reviewer',expiresAtMs:Date.now()+180000}),baseHeaders={cookie:issued.cookieHeader,origin:input.options.origin,'x-pan527-csrf':issued.csrf,'x-pan548-session':'session:'+createHash('sha256').update(issued.cookieHeader).digest('hex')};
const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(tasks,sessions.binding);
const boot=context.bootstrap(baseHeaders,{}),c=boot.snapshot.context,headers={...baseHeaders,'x-pan548-tab':boot.tabProof,'x-pan548-tab-id':c.binding.tabId},invoice=reader.read({tenantId:'tenant-a',objectId:'AP-PAN516-MATCHED-01',expectedRevision:null}),claimed=context.claim(headers,{schemaVersion:'pansphaira.workspace-context/claim/v1',tabId:c.binding.tabId,moduleId:'pan.erv',viewId:'pan.erv.view',primaryObjectId:invoice.invoiceId,selection:null,expected:{...c.revisions,domainRevision:invoice.revision,epoch:c.binding.epoch}}).context;
const verification={schemaVersion:'pansphaira.workspace-context/verify/v1',tabId:claimed.binding.tabId,contextHandle:claimed.contextHandle},mail=createNativeWorkspaceMailLocalV1({sessions,tasks,contextSelection:context});
let readback=null,denied=null,deleted=null;if(!['READ','DELETE','VERIFY_DELETED'].includes(input.mode))throw Error('602_PROBE_MODE_DENIED');
if(input.mode==='VERIFY_DELETED'){try{mail.readDraft(headers,{schemaVersion:'pansphaira.workspace-maillocal/read-draft/v1',context:verification,draftId:input.draftId});}catch(error){denied=error.message;}}
else{readback=mail.readDraft(headers,{schemaVersion:'pansphaira.workspace-maillocal/read-draft/v1',context:verification,draftId:input.draftId});if(input.mode==='DELETE')deleted=mail.deleteDraft(headers,{schemaVersion:'pansphaira.workspace-maillocal/delete-draft/v1',context:verification,draftId:input.draftId,expectedRevision:readback.draft.revision});}
const rows=db.prepare('SELECT draft_id,state,revision,bytes FROM workspace_mail_local_drafts_v1').all();console.log(JSON.stringify({pid:process.pid,readback,denied,deleted,rows,taskOwnerBootEpoch:nativeWorkspaceUiTaskOwnerConnectionV2(tasks,sessions.binding).bootEpoch,profileRevision:store.read(sessions.authenticate(baseHeaders)).revision,taskCount:db.prepare('SELECT count(*) n FROM workspace_ui_tasks_v2').get().n,model:'NOT_RUN'}));
mail.close();projection.close();invocations.close();surfaces.close();tasks.close();va.close();ca.close();view.close();data.close();context.close();store.close();profiles.close();workspace.close();process.exit(0);
