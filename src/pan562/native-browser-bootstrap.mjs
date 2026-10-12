import {mkdirSync,lstatSync,realpathSync,readFileSync} from 'node:fs';
import {isAbsolute,resolve,join} from 'node:path';
import {createOptionalHttpsProductIngressV1,mountProtectedWorkspaceBootstrapV1,protectedGuidedOwnerContextV1} from '../pan527/origin-session-adapter.mjs';
import {enableWorkspaceBrowserV1} from '../pan541/workspace-browser.mjs';
import {createUnconfiguredNativeErvReadAdapterV1} from '../pan541/native-erv-read-adapter.mjs';
import {createAgentConfigurationDraftStoreV1} from '../pan563/draft-store.mjs';
import {createGuidedNativeOwnerV1} from '../pan528/native-journey-controller.mjs';
import {createGuidedHelperBrokerV1} from '../pan528/guided-helper-broker.mjs';
import {mountProtectedGuidedDocumentV1} from '../pan527/origin-session-adapter.mjs';
import {bindRuntimeTemplateV1} from '../pan529/runtime-template-contract.mjs';
import {pan441EmployeeProfileV1} from '../../dist/packages/contracts/src/pan441-employee-profile.js';
import {validateRuntimeIdentityV1} from '../pan526/runtime-contract.mjs';
function exact(value,keys,optional=[]){if(!value||Object.getPrototypeOf(value)!==Object.prototype)throw new Error('BROWSER_BOOTSTRAP_OWNER_DENIED');const ds=Object.getOwnPropertyDescriptors(value);if(keys.some(k=>!Object.hasOwn(ds,k))||Reflect.ownKeys(ds).some(k=>typeof k!=='string'||![...keys,...optional].includes(k))||Object.values(ds).some(d=>!d.enumerable||!('value'in d)))throw new Error('BROWSER_BOOTSTRAP_OWNER_DENIED');}
function root(path){if(typeof path!=='string'||!isAbsolute(path)||resolve(path)!==path)throw new Error('BROWSER_BOOTSTRAP_ROOT_DENIED');const stat=lstatSync(path);if(!stat.isDirectory()||stat.isSymbolicLink()||realpathSync(path)!==path||stat.uid!==process.getuid()||(stat.mode&0o777)!==0o700)throw new Error('BROWSER_BOOTSTRAP_ROOT_DENIED');return path;}
function ownedDirectory(path){try{mkdirSync(path,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}return root(path);}
// One native composition of existing installer/runtime identity, optional527
// ingress,541 shell,550 admin and563 leading draft. No new auth/credential store.
export function createProtectedBrowserBootstrapV1(options){
 exact(options,['optIn','origin','tls','identity','root','subjectId','proofTtlMs','sessionTtlMs'],['nativeReader']);
 if(options.optIn!==true)throw new Error('BROWSER_BOOTSTRAP_OWNER_DENIED');
 const instanceRoot=root(options.root),identity=validateRuntimeIdentityV1(options.identity),tenantId=identity.tenantId;
 if(identity.componentId!=='pansphaira-local-demo'||identity.authorityProfile!=='SAFE_GUIDED')throw new Error('BROWSER_BOOTSTRAP_OWNER_DENIED');
 const stateRoot=ownedDirectory(join(instanceRoot,'protected-session')),productRoot=ownedDirectory(join(instanceRoot,'existing-product'));
 let gateway,store,workspace,bootstrap,referenceOwner,referenceDocument;
 try{
  gateway=createOptionalHttpsProductIngressV1({optIn:true,origin:options.origin,tls:options.tls,tenants:[{identity,stateRoot,productRoot}]});
  const sessions=gateway.sessionAdapter(tenantId),owner=protectedGuidedOwnerContextV1(gateway,{optIn:true,tenantId,origin:options.origin,identityDigest:sessions.binding.identityDigest});
  const draftRoot=ownedDirectory(join(productRoot,'configuration-drafts'));
  store=createAgentConfigurationDraftStoreV1({root:draftRoot,profile:pan441EmployeeProfileV1(),template:bindRuntimeTemplateV1(owner.identity)});
  referenceOwner=createGuidedNativeOwnerV1({optIn:true,identity:owner.identity,parentRoot:productRoot,probeMode:'NORMAL'});
  const application=referenceOwner.owner.configurationApplication(store);
  const referenceAssets=Object.fromEntries(['html','script','style'].map((key,index)=>[key,readFileSync(new URL(['../pan528/screen.html','../pan528/app.js','../pan528/style.css'][index],import.meta.url),'utf8')]));
  referenceDocument=mountProtectedGuidedDocumentV1(gateway,{optIn:true,tenantId,origin:options.origin,identityDigest:sessions.binding.identityDigest,...referenceAssets,journey:createGuidedHelperBrokerV1({optIn:true,identity:owner.identity,nativeClient:referenceOwner.client})});
  workspace=enableWorkspaceBrowserV1({optIn:true,gateway,tenantId,origin:options.origin,nativeReader:options.nativeReader??createUnconfiguredNativeErvReadAdapterV1(tenantId),contextSelection:true,administration:true,configurationDrafts:store,configurationApplication:application});
  bootstrap=mountProtectedWorkspaceBootstrapV1(gateway,{optIn:true,tenantId,origin:options.origin,identityDigest:sessions.binding.identityDigest,subjectId:options.subjectId,proofTtlMs:options.proofTtlMs,sessionTtlMs:options.sessionTtlMs,html:readFileSync(new URL('../../packages/browser-workspace/src/workspace-bootstrap-v1.html',import.meta.url),'utf8'),style:readFileSync(new URL('../../packages/browser-workspace/src/workspace-bootstrap-v1.css',import.meta.url),'utf8'),script:readFileSync(new URL('../../dist/browser-workspace/workspace-bootstrap.js',import.meta.url),'utf8')});
  let closed=false;
  return Object.freeze({gateway,sessions,store,root:instanceRoot,stateRoot,productRoot,identity,browserPath:'/t/'+tenantId+'/bootstrap',workspacePath:'/t/'+tenantId+'/workspace',read(){if(closed)throw new Error('BROWSER_BOOTSTRAP_CLOSED');return bootstrap.read();},issueFirst(){if(closed)throw new Error('BROWSER_BOOTSTRAP_CLOSED');return bootstrap.issueFirst();},issueResume(){if(closed)throw new Error('BROWSER_BOOTSTRAP_CLOSED');return bootstrap.issueResume();},async listen(){if(closed)throw new Error('BROWSER_BOOTSTRAP_CLOSED');const url=new URL(options.origin);await new Promise((resolve,reject)=>{gateway.server.once('error',reject);gateway.server.listen(Number(url.port||443),'127.0.0.1',resolve);});},async close(){if(closed)return;closed=true;bootstrap.close();workspace.close();referenceDocument.close();await referenceOwner.owner.suspend();store.close();gateway.server.closeAllConnections();if(gateway.server.listening)await new Promise(resolve=>gateway.server.close(resolve));}});
 }catch(error){bootstrap?.close();workspace?.close();referenceDocument?.close();referenceOwner?.owner.close();store?.close();gateway?.server.closeAllConnections();throw error;}
}
