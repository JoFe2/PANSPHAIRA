import test from'node:test';import assert from'node:assert/strict';import {createHash}from'node:crypto';import {mkdirSync,existsSync,readFileSync}from'node:fs';import {join}from'node:path';
import {nativeFixture527,shapeIdentity527,request527}from'../pan527/helpers.mjs';
import {createOptionalHttpsProductIngressV1,protectedGuidedOwnerContextV1}from'../../src/pan527/origin-session-adapter.mjs';
import {createOwnedSyntheticBusinessOperation}from'../../src/pan442/bound-task-handle.mjs';
import {createAuthoritativeApprovalSnapshot}from'../../demo/runtime/authoritative-approval-snapshot.mjs';
import {createNativeWorkspaceAdministrationApprovalSourceV1}from'../../src/pan550/native-approval-source.mjs';
import {financeFixture}from'../pan519/native-fixture.mjs';
import {createNativeErvReadAdapterV1}from'../../src/pan541/native-erv-read-adapter.mjs';
import {enableWorkspaceBrowserV1}from'../../src/pan541/workspace-browser.mjs';
// Node-only protected owner fixture over the SAME existing owned seams used by
// browserFixture550 (protected panskys-zoo-demo ingress + owned synthetic
// business operation + native550 approval adapter), without launching Chromium.
// The 550 browser guard in browser-fixture.mjs stays untouched.
async function ownedRejectFixture(){
 let tls=await nativeFixture527();const original=tls;await new Promise(r=>original.gateway.server.close(r));
 const tenantId='panskys-zoo-demo',spec={identity:shapeIdentity527(tenantId),stateRoot:join(tls.root,'approval-auth'),productRoot:join(tls.root,'approval-product')};
 mkdirSync(spec.stateRoot,{mode:0o700});mkdirSync(spec.productRoot,{mode:0o700});
 const tenants=[spec,tls.tenants[1]],options={...tls.options,tenants},gateway=createOptionalHttpsProductIngressV1(options);
 await new Promise((resolve,reject)=>{gateway.server.once('error',reject);gateway.server.listen(tls.port,'127.0.0.1',resolve);});
 tls={...tls,tenants,options,gateway,async close(){gateway.server.closeAllConnections();if(gateway.server.listening)await new Promise(r=>gateway.server.close(r));await original.close();}};
 let native,workspace,approvalRuntime,approvalSource,orderTarget;const counts={mutations:0,readbacks:0,snapshots:0,reconciliations:0};
 try{
  native=await financeFixture();
  const sessions=tls.gateway.sessionAdapter(tenantId),owned=protectedGuidedOwnerContextV1(tls.gateway,{optIn:true,tenantId,origin:tls.origin,identityDigest:sessions.binding.identityDigest});
  const root=join(owned.productRoot,'existing-local-order-seam','pan453-owned-v2');mkdirSync(root,{mode:0o700,recursive:true});
  orderTarget=join(root,'synthetic-order-target.json');
  const readTarget=()=>existsSync(orderTarget)?JSON.parse(readFileSync(orderTarget,'utf8')):null;
  const provider={async readAuthoritativeSnapshot(action){counts.snapshots++;const target=readTarget();return createAuthoritativeApprovalSnapshot(action,target?[target]:[]);},async mutate(){counts.mutations++;throw Error('REJECT_FIXTURE_UNEXPECTED_MUTATION');},async readback(){counts.readbacks++;return readTarget();},async reconcile(){counts.reconciliations++;return null;}};
  approvalRuntime=createOwnedSyntheticBusinessOperation({provider,now:()=>Date.now(),root,explicitOwnerApproval:true});
  approvalSource=createNativeWorkspaceAdministrationApprovalSourceV1({sessions,runtime:approvalRuntime,productRoot:owned.productRoot});
  workspace=enableWorkspaceBrowserV1({optIn:true,gateway:tls.gateway,tenantId,origin:tls.origin,nativeReader:createNativeErvReadAdapterV1({tenantId,root:native.root}),contextSelection:true,administration:true,administrationApproval:approvalSource});
 }catch(e){workspace?.close();approvalSource?.close();native?.close();await tls.close();throw e;}
 const sessions=tls.gateway.sessionAdapter(tenantId),base='/t/'+tenantId+'/workspace';
 function sessionHeaders({subjectId='owner:local-demo',role='reviewer'}={}){
  const issued=sessions.issueOwnerSession({subjectId,role,expiresAtMs:Date.now()+180000}),headers={cookie:issued.cookieHeader,origin:tls.origin,'x-pan527-csrf':issued.csrf,'x-pan548-session':'session:'+createHash('sha256').update(issued.cookieHeader).digest('hex')};
  return{issued,headers,boot:async()=>{const r=await request527(tls,base+'/context-selection/tab',headers,'POST',{});assert.equal(r.status,200,r.body);const b=JSON.parse(r.body);Object.assign(headers,{'x-pan548-tab':b.tabProof,'x-pan548-tab-id':b.snapshot.context.binding.tabId});return b.snapshot.context;}};
 }
 async function claim(ctx,headers){const r=await request527(tls,base+'/context-selection',headers,'POST',{schemaVersion:'pansphaira.workspace-context/claim/v1',tabId:ctx.binding.tabId,moduleId:'pan.setup',viewId:'pan.setup.administration.view',primaryObjectId:null,selection:null,expected:{...ctx.revisions,epoch:ctx.binding.epoch}});assert.equal(r.status,200,r.body);return JSON.parse(r.body).context;}
 function body(operation,expectedProposalDigest=null,confirmation=null,context){return{schemaVersion:'pansphaira.workspace-administration/approval-request/v1',operation,expectedProposalDigest,confirmation,context};}
 return{tls,counts,orderTarget,journalPath:join(approvalRuntime.dir,'approvals.json'),reopenedRuntime:provider2=>createOwnedSyntheticBusinessOperation({provider:provider2,now:()=>Date.now(),root:approvalRuntime.dir,explicitOwnerApproval:true}),body,claim,sessionHeaders,
  call:(headers,value,path=base+'/administration/approval')=>request527(tls,path,headers,'POST',value),
  retire:async headers=>request527(tls,base+'/context-selection/retire',headers,'POST',{schemaVersion:'pansphaira.workspace-context/verify/v1',tabId:'retire',contextHandle:'retire'}),
  async close(){workspace?.close();approvalSource?.close();native?.close();await tls.close();}};
}
const verifyOf=ctx=>({schemaVersion:'pansphaira.workspace-context/verify/v1',tabId:ctx.binding.tabId,contextHandle:ctx.contextHandle});

test('PUI09-AC03/04 owned native PREPARE then closed REJECT of the exact server-owned proposal: durable REJECTED receipt, no authority, zero effects, reject is final',async()=>{
 const f=await ownedRejectFixture();
 try{
  const s=f.sessionHeaders(),context=await f.claim(await s.boot(),s.headers),verify=verifyOf(context);
  // Genuine positive fixture first: READ EMPTY, PREPARE PENDING.
  let r=await f.call(s.headers,f.body('READ',null,null,verify));assert.equal(r.status,200,r.body);assert.equal(JSON.parse(r.body).phase,'EMPTY');
  r=await f.call(s.headers,f.body('PREPARE',null,null,verify));assert.equal(r.status,200,r.body);
  const prepared=JSON.parse(r.body);assert.equal(prepared.phase,'PENDING');const p=prepared.proposal;assert.notEqual(p.proposalDigest,p.decisionDigest);
  assert.equal(prepared.decision,null);assert.equal(prepared.authority,null);assert.equal(f.counts.mutations,0);

  // Main behavioral assertion: native closed REJECT of the exact server-owned digest.
  r=await f.call(s.headers,f.body('REJECT',p.proposalDigest,'CONFIRM_OWNER_REJECT_NO_AUTHORITY',verify));assert.equal(r.status,200,r.body);
  const rejected=JSON.parse(r.body);assert.equal(rejected.phase,'REJECTED');
  assert.equal(rejected.decision.proposalDigest,p.proposalDigest);assert.equal(rejected.decision.decisionDigest,p.decisionDigest);
  assert.equal(rejected.decision.ownerDecision,'REJECT');assert.match(rejected.decision.receiptDigest,/^[a-f0-9]{64}$/);
  assert.equal(rejected.authority,null);assert.equal(rejected.effect.state,'NONE');assert.equal(rejected.effect.persisted,false);assert.deepEqual(rejected.effect.matches,[]);
  assert.equal(rejected.activationAuthorized,false);assert.equal(f.counts.mutations,0);assert.equal(f.counts.readbacks,0);assert.equal(f.counts.reconciliations,0);assert.equal(existsSync(f.orderTarget),false);
  assert.ok(f.counts.snapshots>0,'readback must use the real authoritative snapshot seam');

  // Durable existing-decision readback and fail-closed negatives after the genuine reject.
  r=await f.call(s.headers,f.body('READ',null,null,verify));assert.equal(r.status,200,r.body);assert.equal(JSON.parse(r.body).phase,'REJECTED');
  r=await f.call(s.headers,f.body('REJECT','sha256:'+'a'.repeat(58)+'0b','CONFIRM_OWNER_REJECT_NO_AUTHORITY',verify));assert.equal(r.status,400,r.body);assert.equal(JSON.parse(r.body).error,'ADMIN_SCHEMA_DENIED');
  r=await f.call(s.headers,f.body('REJECT',p.decisionDigest,'CONFIRM_OWNER_REJECT_NO_AUTHORITY',verify));assert.equal(r.status,409,r.body);assert.equal(JSON.parse(r.body).error,'ADMIN_APPROVAL_SOURCE_STALE');
  r=await f.call(s.headers,f.body('REJECT',p.proposalDigest,null,verify));assert.equal(r.status,400,r.body);assert.equal(JSON.parse(r.body).error,'ADMIN_SCHEMA_DENIED');
  r=await f.call(s.headers,f.body('REJECT',p.proposalDigest,'CONFIRM_PROPOSAL_ONLY',verify));assert.equal(r.status,400,r.body);assert.equal(JSON.parse(r.body).error,'ADMIN_SCHEMA_DENIED');
  {const extra={...f.body('REJECT',p.proposalDigest,'CONFIRM_OWNER_REJECT_NO_AUTHORITY',verify),payload:{ownerDecision:'APPROVE'}};r=await f.call(s.headers,extra);assert.equal(r.status,400,r.body);assert.equal(JSON.parse(r.body).error,'ADMIN_SCHEMA_DENIED');}
  {const wrongSubject=f.sessionHeaders({subjectId:'synthetic-existing-admin'});const wctx=await f.claim(await wrongSubject.boot(),wrongSubject.headers);r=await f.call(wrongSubject.headers,f.body('REJECT',p.proposalDigest,'CONFIRM_OWNER_REJECT_NO_AUTHORITY',verifyOf(wctx)));assert.equal(r.status,403,r.body);assert.equal(JSON.parse(r.body).error,'ADMIN_APPROVAL_ROLE_DENIED');}
  {const wrongRole=f.sessionHeaders({role:'reader'});const rctx2=await f.claim(await wrongRole.boot(),wrongRole.headers);r=await f.call(wrongRole.headers,f.body('READ',null,null,verifyOf(rctx2)));assert.equal(r.status,403,r.body);assert.equal(JSON.parse(r.body).error,'ADMIN_APPROVAL_ROLE_DENIED');}
  {const cross=f.sessionHeaders();await f.claim(await cross.boot(),cross.headers);r=await f.call(cross.headers,f.body('READ',null,null,verify),'/t/tenant-b/workspace/administration/approval');assert.equal(r.status,401,r.body);}

  // Reject is final: the existing duplicate-decision denial is preserved, not idempotent success.
  r=await f.call(s.headers,f.body('REJECT',p.proposalDigest,'CONFIRM_OWNER_REJECT_NO_AUTHORITY',verify));assert.equal(r.status,409,r.body);assert.equal(JSON.parse(r.body).error,'OWNER_DECISION_ALREADY_FINAL_DENIED');
  r=await f.call(s.headers,f.body('APPROVE',p.proposalDigest,'CONFIRM_PROPOSAL_ONLY',verify));assert.equal(r.status,409,r.body);assert.equal(JSON.parse(r.body).error,'OWNER_DECISION_ALREADY_FINAL_DENIED');
  r=await f.call(s.headers,f.body('EXECUTE',p.proposalDigest,'CONFIRM_SIGNED_EXECUTION',verify));assert.notEqual(r.status,200,r.body);
  r=await f.call(s.headers,f.body('RECONCILE',p.proposalDigest,'CONFIRM_READ_ONLY_RECONCILIATION',verify));assert.equal(r.status,409,r.body);assert.equal(JSON.parse(r.body).error,'ADMIN_APPROVAL_RECOVERY_DENIED');
  r=await f.call(s.headers,f.body('PREPARE',null,null,verify));assert.equal(r.status,409,r.body);assert.equal(JSON.parse(r.body).error,'ADMIN_APPROVAL_SOURCE_STALE');
  assert.equal(existsSync(f.orderTarget),false);assert.equal(f.counts.mutations,0);

  // Owner reopen over a fresh authenticated session/tab: still durable REJECTED, no fresh approval.
  const reopened=f.sessionHeaders(),rctx=await f.claim(await reopened.boot(),reopened.headers);
  r=await f.call(reopened.headers,f.body('READ',null,null,verifyOf(rctx)));assert.equal(r.status,200,r.body);
  const after=JSON.parse(r.body);assert.equal(after.phase,'REJECTED');assert.equal(after.decision.ownerDecision,'REJECT');assert.equal(after.authority,null);
  assert.equal(after.effect.state,'NONE');assert.equal(after.effect.persisted,false);

  // True owner reopen: reconstruct the existing owned runtime from the saved journal on disk.
  const reopenedRuntime=f.reopenedRuntime({readAuthoritativeSnapshot:()=>{throw Error('REOPEN_SNAPSHOT_UNEXPECTED');},mutate:()=>{throw Error('REOPEN_MUTATION_UNEXPECTED');},readback:()=>null,reconcile:()=>null});
  const record=reopenedRuntime.workbench.state.decisions[p.decisionDigest];
  assert.equal(record.receipt.ownerDecision,'REJECT');assert.equal(record.receipt.outcome,'OWNER_REJECTED_NO_AUTHORITY');assert.equal(record.authority,null);
  assert.equal(record.receipt.proposalDigest,p.proposalDigest);assert.equal(record.receipt.decisionDigest,p.decisionDigest);
  // The independent on-disk journal shows the same single REJECT receipt.
  const journal=JSON.parse(readFileSync(f.journalPath,'utf8'));assert.deepStrictEqual(journal.decisions[p.decisionDigest],record);assert.equal(Object.keys(journal.decisions).length,1);
  assert.equal(existsSync(f.orderTarget),false);assert.equal(f.counts.mutations,0);
 }finally{await f.close();}
});
