import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {financeFixture} from '../pan519/native-fixture.mjs';
import {nativeRows} from '../fixtures/pan515/native-trade-fixture.mjs';
import {digest,readMarker} from '../../src/pan473/scope-profile.mjs';
import * as procurement from '../../src/procurement-434/bestellung-lifecycle.mjs';
import {readLocalJournalTaskIdentity,recordLocalJournalControl} from '../../demo/runtime/local-journal-owner.mjs';
import * as protectedSessions from '../../src/pan527/origin-session-adapter.mjs';
const {createProtectedSessionAdapterV1}=protectedSessions;

const entry=new URL('../../src/pan542/native-human-backend.mjs',import.meta.url);
const backend=existsSync(entry)?await import(entry):null;
// Owner-selected synthetic session metadata only. This is NOT a new image,
// live identity provider, installer acceptance or observed human approval.
const identity={schemaVersion:'pansphaira.portable-runtime/identity/v1',componentId:'pansphaira-local-demo',
  sourceCommit:'27a9103e7a481cca954bfa73745fc3b5b54cbd15',sourceTree:'3216db95d1164b3ecab2e6ecf96ae8797aed57ab',
  imageDigest:'sha256:'+'a'.repeat(64),architecture:'x86_64',productVersion:'0.2.0-poc.20260810.5',
  runtime:{name:'node',version:'24.14.1'},contractVersion:'1.0.0',instanceId:'pan542-native-human-local',tenantId:'tenant-a',generation:1,
  configurationDigest:'b'.repeat(64),templateDigest:'c'.repeat(64),policyDigest:'d'.repeat(64),networkDigest:'e'.repeat(64),authorityProfile:'SAFE_GUIDED',
  effectiveRights:['demo.status.read','demo.provider.bound.read','demo.governed.effect']};
const invoiceId='AP-PAN516-MATCHED-01';
const sessionOptions=stateRoot=>({optIn:true,origin:'https://pan542.test:4443',identity,stateRoot});
function issue(sessions,subjectId,role='reviewer'){
  const s=sessions.issueOwnerSession({subjectId,role,expiresAtMs:Date.now()+60000});
  return {cookie:s.cookieHeader,origin:sessions.origin,'x-pan527-csrf':s.csrf};
}

async function humanFixture(){
  const f=await financeFixture();
  try{
    const authRoot=join(f.parent,'human-session-state');mkdirSync(authRoot,{mode:0o700});
    const sessions=createProtectedSessionAdapterV1(sessionOptions(authRoot));
    backend.initializeNativeErvHumanBackendV1({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessionBinding:sessions.binding});
    const api=backend.createNativeErvHumanBackendV1({root:f.root,sessions});
    return {...f,authRoot,sessions,api,reviewer:issue(sessions,'synthetic:erv-reviewer'),approver:issue(sessions,'synthetic:erv-approver'),reader:issue(sessions,'synthetic:erv-reader','reader')};
  }catch(e){f.close();throw e;}
}
function commandFor(proposal,action,id){return {schemaVersion:'pansphaira.erv-human/decision/v1',invoiceId:proposal.invoiceId,
  effectId:'synthetic:erv-'+id,transportId:'synthetic:erv-wire-'+id,expectedNativeRevision:proposal.nativeRevision,
  expectedProposalRevision:proposal.proposalRevision,proposalDigest:proposal.proposalDigest,action};}

test('PUI-04-AC01 native configuration records actual current source bytes for every direct existing native boundary',async()=>{
  const f=await humanFixture();
  try{
    const current=f.api.read(f.reviewer,{invoiceId});
    const required=['src/pan542/native-human-backend.mjs','src/pan527/origin-session-adapter.mjs','src/pan472/draft-profile.mjs',
      'src/pan473/scope-profile.mjs','src/pan515/trade-state.mjs','src/procurement-434/bestellung-lifecycle.mjs',
      'src/procurement-434/bestellung-liability.mjs','dist/packages/contracts/src/incoming-invoice-erv.js',
      'contracts/trade/pan516-invoice-cases-v1.json','demo/runtime/local-journal-owner.mjs','src/pan542/source-compatibility-catalog-v1.json','src/pan542/source-compatibility-catalog-v2.json','src/pan542/source-compatibility-catalog-v3.json'];
    assert.deepEqual(current.sourceIdentity.map(x=>x.path).sort(),required.sort(),'PAN542_DIRECT_NATIVE_SOURCE_IDENTITY_INCOMPLETE');
    for(const row of current.sourceIdentity)assert.equal(row.sha256,createHash('sha256').update(readFileSync(row.path)).digest('hex'),row.path);
    const nativeBinding=JSON.parse(nativeRows(f.root,'SELECT record FROM pan542_binding WHERE id=1')[0].record);
    assert.deepEqual(nativeBinding.sourceIdentity,current.sourceIdentity);
    assert.equal(nativeBinding.roleMappingVersion,1);assert.equal(nativeBinding.scope,'LOCAL_SYNTHETIC_BACKEND_ONLY');
  }finally{f.close();}
});

test('PUI-04-AC02 existing native stop and revoke deny a new decision while safe native reads remain available',async()=>{
  for(const kind of ['STOP','REVOKE']){
    const f=await humanFixture();
    try{
      const before=f.api.read(f.reviewer,{invoiceId}),c=commandFor(before,'REVIEW','control-001'),marker=readMarker(f.root);
      const retainedTasks=readLocalJournalTaskIdentity(join(f.root,'pan453-owned-v2'));
      const controlRoot=kind==='STOP'?join(f.root,'pan473-controller','pan453-owned-v2'):join(f.root,'pan453-owned-v2');
      recordLocalJournalControl(controlRoot,{kind,sourceIdentity:marker.sourceIdentity,targetIdentity:marker.targetIdentity,
        operationKey:kind==='REVOKE'?'admin-ai:poc:erv-human:pan542:'+c.effectId:null,stopEpoch:1,issuedAtMs:Date.now(),reason:'Synthetic human decision control'});
      assert.throws(()=>f.api.decide(f.reviewer,c),/ERV_HUMAN_STOP_OR_REVOKE_DENIED/,kind);
      assert.deepEqual(f.api.read(f.reviewer,{invoiceId}),before);
      assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0);
      assert.deepEqual(readLocalJournalTaskIdentity(join(f.root,'pan453-owned-v2')),retainedTasks,'retain the pre-existing native cutover task; add no human task on denial');
    }finally{f.close();}
  }
});

test('PUI-04-AC02 a real decision attaches its immutable task to the existing PAN453 durable fence',async()=>{
  const f=await humanFixture();
  try{
    const before=f.api.read(f.reviewer,{invoiceId});const c=commandFor(before,'REVIEW','task-attachment-001');
    f.api.decide(f.reviewer,c);
    const event=JSON.parse(nativeRows(f.root,'SELECT event FROM pan542_events WHERE ordinal=1')[0].event);
    assert.equal(typeof event.taskBinding?.taskIdentityDigest,'string','PAN542_EXISTING_DURABLE_TASK_ATTACHMENT_NOT_IMPLEMENTED');
    const ledger=readLocalJournalTaskIdentity(join(f.root,'pan453-owned-v2'));
    assert.deepEqual(ledger.identities[event.taskBinding.taskIdentityDigest],event.taskBinding);
    assert.match(event.taskBinding.operationKey,/^admin-ai:poc:erv-human:pan542:/);
    const fresh=backend.createNativeErvHumanBackendV1({root:f.root,sessions:f.sessions});
    const reconciled=fresh.reconcile(f.reviewer,{invoiceId,effectId:c.effectId});
    assert.deepEqual(reconciled.receipt.taskBinding,event.taskBinding);
    assert.equal(reconciled.newDecisionEffect,false);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,1);
  }finally{f.close();}
});

test('PUI-04-AC03 native role mapping binds the protected origin realm and generation, not only a matching tenant string',async()=>{
  const f=await humanFixture();
  try{
    for(const [id,override] of [['origin',{origin:'https://other-pan542.test:4443'}],['generation',{identity:{...identity,generation:2}}],['tenant',{identity:{...identity,tenantId:'tenant-b'}}]]){
      const authRoot=join(f.parent,'other-session-'+id);mkdirSync(authRoot,{mode:0o700});
      const foreign=createProtectedSessionAdapterV1({...sessionOptions(authRoot),...override});
      assert.throws(()=>backend.createNativeErvHumanBackendV1({root:f.root,sessions:foreign}),/ERV_HUMAN_SESSION_BINDING_DENIED/,id);
    }
    assert.equal(f.api.read(f.reviewer,{invoiceId}).nativeRole,'REVIEWER');
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0);
  }finally{f.close();}
});

test('PUI-04 negative missing and spoofed native role never authorize a persisted decision',async()=>{
  const f=await humanFixture();
  try{
    const proposal=f.api.read(f.reviewer,{invoiceId}),command=commandFor(proposal,'REVIEW','role-probe-001');
    assert.throws(()=>f.api.read({}, {invoiceId}),/HOSTED_SESSION_DENIED/);
    assert.throws(()=>f.api.decide(f.reader,command),/HOSTED_ROLE_DENIED/);
    assert.throws(()=>f.api.decide({...f.reviewer,'x-role':'APPROVER'},command),/HOSTED_HEADER_AUTHORITY_DENIED/);
    const unassigned=issue(f.sessions,'synthetic:unassigned-human');
    assert.throws(()=>f.api.read(unassigned,{invoiceId}),/ERV_HUMAN_NATIVE_ROLE_REQUIRED_DENIED/);
    for(const extra of [{role:'APPROVER'},{subjectId:'synthetic:erv-approver'},{roleMappingVersion:999}])
      assert.throws(()=>f.api.decide(f.reviewer,{...command,...extra}),/ERV_HUMAN_COMMAND_SHAPE_DENIED/);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0);
    assert.equal(f.api.decide(f.reviewer,command).proposalRevision,1,'permitted server-mapped counterpart');
  }finally{f.close();}
});

test('PUI-04 negative foreign invoice cannot substitute the code-bound native object',async()=>{
  const f=await humanFixture();
  try{
    const before=f.api.read(f.reviewer,{invoiceId});
    assert.throws(()=>f.api.read(f.reviewer,{invoiceId:'FOREIGN-INVOICE-001'}),/ERV_HUMAN_INVOICE_BINDING_DENIED/);
    assert.throws(()=>f.api.decide(f.reviewer,{...commandFor(before,'REVIEW','foreign-invoice-001'),invoiceId:'FOREIGN-INVOICE-001'}),/ERV_HUMAN_INVOICE_BINDING_DENIED/);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0);
    assert.equal(f.api.decide(f.reviewer,commandFor(before,'REVIEW','correct-invoice-001')).invoiceId,invoiceId);
  }finally{f.close();}
});

test('PUI-04 negative rehashed stale native or proposal revision remains denied',async()=>{
  const f=await humanFixture();
  try{
    const before=f.api.read(f.reviewer,{invoiceId}),command=commandFor(before,'REVIEW','revision-probe-001');
    const {nativeRole,subjectId,proposalDigest,...unsigned}=before;
    const falseNative={...unsigned,nativeRevision:before.nativeRevision-1};
    const falseProposal={...unsigned,proposalRevision:before.proposalRevision+1};
    assert.throws(()=>f.api.decide(f.reviewer,{...command,expectedNativeRevision:falseNative.nativeRevision,proposalDigest:digest(falseNative)}),/ERV_HUMAN_PROPOSAL_REVISION_DENIED/);
    assert.throws(()=>f.api.decide(f.reviewer,{...command,expectedProposalRevision:falseProposal.proposalRevision,proposalDigest:digest(falseProposal)}),/ERV_HUMAN_PROPOSAL_REVISION_DENIED/);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0);
    assert.equal(f.api.decide(f.reviewer,command).proposalRevision,1);
  }finally{f.close();}
});

test('PUI-04 negative client taskstore is never authoritative native persistence',async()=>{
  const f=await humanFixture();
  try{
    const before=f.api.read(f.reviewer,{invoiceId}),command=commandFor(before,'REVIEW','client-store-001');
    const forged=JSON.parse(JSON.stringify(before));forged.state='APPROVED_LOCAL_EVIDENCE_ONLY';forged.proposalRevision=123;
    assert.throws(()=>f.api.read(f.reviewer,{invoiceId,taskstore:forged}),/ERV_HUMAN_READ_REQUEST_DENIED/);
    assert.throws(()=>f.api.decide(f.reviewer,{...command,taskstore:forged}),/ERV_HUMAN_COMMAND_SHAPE_DENIED/);
    assert.throws(()=>f.api.decide(f.reviewer,{...command,receipt:{state:'APPROVED_LOCAL_EVIDENCE_ONLY'}}),/ERV_HUMAN_COMMAND_SHAPE_DENIED/);
    assert.deepEqual(f.api.read(f.reviewer,{invoiceId}),before);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0);
    assert.equal(f.api.decide(f.reviewer,command).proposalRevision,1);
  }finally{f.close();}
});

test('PUI-04-AC05 actual native confirmation drift invalidates prior evidence approval and reconciliation',async()=>{
  const f=await humanFixture();
  try{
    const before=f.api.read(f.reviewer,{invoiceId});
    const reviewed=f.api.decide(f.reviewer,commandFor(before,'REVIEW','drift-review-001'));
    const approval=commandFor(reviewed,'APPROVE_LOCAL_EVIDENCE_ONLY','drift-approval-001');
    f.api.decide(f.approver,approval);
    const native=procurement.readPan516Procurement({root:f.root}),last=native.confirmations.at(-1);
    const update={schemaVersion:'pansphaira.pan516/procurement-command/v1',effectId:'synthetic:human-confirmation-change',transportId:'synthetic:human-confirmation-wire',
      expectedRevision:native.revision,orderId:native.binding.draft.bestellungId,positionId:native.binding.draft.positionen[0].positionId,supplierId:native.binding.draft.lieferantId,
      kind:'CONFIRM',receipt:null,sourceReference:'synthetic:human-confirmation-source',
      confirmation:{revision:last.revision+1,previousConfirmationDigest:last.confirmationDigest,terms:{...last.terms,unitPriceMinor:last.terms.unitPriceMinor+1},confirmedAt:'2026-06-22T08:00:00Z'}};
    procurement.executePan516ProcurementCommand({root:f.root,command:update,grant:procurement.authorizePan516ProcurementCommand({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',command:update})});
    const stale=f.api.read(f.approver,{invoiceId});assert.equal(stale.state,'STALE_NATIVE_BASIS_REVIEW_REQUIRED');
    assert.notEqual(stale.basisDigest,reviewed.basisDigest);assert.equal(stale.nativeRevision,before.nativeRevision+1);
    assert.equal(f.api.reconcile(f.approver,{invoiceId,effectId:approval.effectId}).outcome,'OUTCOME_UNKNOWN');
    const rereview=f.api.decide(f.reviewer,commandFor(stale,'REVIEW','drift-rereview-001'));
    assert.throws(()=>f.api.decide(f.approver,commandFor(rereview,'APPROVE_LOCAL_EVIDENCE_ONLY','drift-unresolved-001')),/ERV_HUMAN_NATIVE_UNRESOLVED_APPROVAL_DENIED/);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,3);
    assert.equal(procurement.readPan516Procurement({root:f.root}).revision,before.nativeRevision+1);
  }finally{f.close();}
});

test('PUI-04-AC05 unknown response loss requires fresh native reconciliation without replaying a decision',async()=>{
  const f=await humanFixture();
  try{
    const before=f.api.read(f.reviewer,{invoiceId});const command=commandFor(before,'REVIEW','lost-response-001');
    const child=spawnSync(process.execPath,['tests/pan542/restart-reader.mjs',f.root,f.authRoot],{
      input:JSON.stringify({sessionOptions:sessionOptions(f.authRoot),headers:f.reviewer,invoiceId,mode:'DECIDE_AND_DROP_RESPONSE',command}),encoding:'utf8',timeout:15000});
    assert.equal(child.status,73,child.stderr);assert.equal(child.stdout,'');assert.equal(child.signal,null);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,1);
    assert.equal(typeof f.api.reconcile,'function','PAN542_NATIVE_DECISION_RECONCILIATION_NOT_IMPLEMENTED');
    const confirmed=f.api.reconcile(f.reviewer,{invoiceId,effectId:command.effectId});
    assert.equal(confirmed.outcome,'RECONCILED_LOCAL_DECISION_NO_NEW_EFFECT');
    assert.equal(confirmed.receipt.invoiceId,invoiceId);assert.equal(confirmed.receipt.state,'REVIEWED_LOCAL_EVIDENCE_ONLY');
    assert.equal(confirmed.readback.proposalRevision,1);assert.equal(confirmed.executionAuthorityGranted,false);
    const unknown=f.api.reconcile(f.reviewer,{invoiceId,effectId:'synthetic:never-dispatched'});
    assert.equal(unknown.outcome,'OUTCOME_UNKNOWN');assert.equal(unknown.receipt,null);
    assert.equal(unknown.executionAuthorityGranted,false);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,1);
    assert.throws(()=>f.api.decide(f.reviewer,{...command,transportId:'synthetic:blind-retry-wire'}),/ERV_HUMAN_ALREADY_DECIDED_RECONCILE_REQUIRED/);
  }finally{f.close();}
});

test('PUI-04 negative double decision must reconcile the recorded business effect rather than repeat it under a new transport',async()=>{
  const f=await humanFixture();
  try{
    const before=f.api.read(f.reviewer,{invoiceId});const command=commandFor(before,'REVIEW','duplicate-001');
    f.api.decide(f.reviewer,command);
    assert.throws(()=>f.api.decide(f.reviewer,{...command,transportId:'synthetic:duplicate-new-transport'}),/ERV_HUMAN_ALREADY_DECIDED_RECONCILE_REQUIRED/);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,1);
  }finally{f.close();}
});

test('PUI-04-AC04/05 a separate native approver persists only evidence approval and receives no execution rights',async()=>{
  const f=await humanFixture();
  try{
    const initial=f.api.read(f.reviewer,{invoiceId});
    const reviewed=f.api.decide(f.reviewer,commandFor(initial,'REVIEW','approval-review-001'));
    const approved=f.api.decide(f.approver,commandFor(reviewed,'APPROVE_LOCAL_EVIDENCE_ONLY','approval-001'));
    assert.equal(approved.state,'APPROVED_LOCAL_EVIDENCE_ONLY');assert.equal(approved.nativeRole,'APPROVER');
    assert.equal(approved.proposalRevision,2);assert.equal(approved.executionAuthorityGranted,false);
    assert.equal(approved.bookingAuthorityGranted,false);assert.equal(approved.paymentOrderAuthorized,false);
    assert.equal(approved.productiveDispatchAuthorized,false);
    assert.throws(()=>f.api.decide(f.reviewer,commandFor(approved,'APPROVE_LOCAL_EVIDENCE_ONLY','approval-wrong-role-001')),/ERV_HUMAN_NATIVE_ROLE_DENIED/);
    assert.throws(()=>f.api.decide(f.approver,commandFor(approved,'EXECUTE','execution-001')),/ERV_HUMAN_UNSUPPORTED_ACTION_DENIED/);
    assert.deepEqual(backend.createNativeErvHumanBackendV1({root:f.root,sessions:f.sessions}).read(f.approver,{invoiceId}),approved);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,2);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan516_target_orders')[0].count,0);
  }finally{f.close();}
});

test('PUI-04-AC04 a native persisted query remains pending until an allowed review resolves it',async()=>{
  const f=await humanFixture();
  try{
    const initial=f.api.read(f.reviewer,{invoiceId});
    const pending=f.api.decide(f.reviewer,commandFor(initial,'QUERY','query-001'));
    assert.equal(pending.state,'QUERY_PENDING_LOCAL_EVIDENCE_ONLY');assert.equal(pending.proposalRevision,1);
    assert.deepEqual(backend.createNativeErvHumanBackendV1({root:f.root,sessions:f.sessions}).read(f.reviewer,{invoiceId}),pending);
    const reviewed=f.api.decide(f.reviewer,commandFor(pending,'REVIEW','query-review-001'));
    assert.equal(reviewed.state,'REVIEWED_LOCAL_EVIDENCE_ONLY');assert.equal(reviewed.proposalRevision,2);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,2);
    assert.equal(reviewed.executionAuthorityGranted,false);
  }finally{f.close();}
});

test('PUI-04-AC03 the session owner marker cannot be forged by a caller facade or absent tenant',async()=>{
  const f=await financeFixture();
  try{
    assert.equal(typeof protectedSessions.isProtectedSessionAdapterV1,'function','PAN542_SESSION_OWNER_MARKER_NOT_IMPLEMENTED');
    const authRoot=join(f.parent,'session-owner-marker');mkdirSync(authRoot,{mode:0o700});
    const sessions=createProtectedSessionAdapterV1(sessionOptions(authRoot));
    assert.equal(protectedSessions.isProtectedSessionAdapterV1(sessions,'tenant-a'),true);
    assert.equal(protectedSessions.isProtectedSessionAdapterV1(sessions,'tenant-b'),false);
    assert.equal(protectedSessions.isProtectedSessionAdapterV1(sessions,undefined),false);
    for(const facade of [{},null,undefined,Object.freeze({...sessions})]){
      assert.equal(protectedSessions.isProtectedSessionAdapterV1(facade,'tenant-a'),false);
      assert.equal(protectedSessions.isProtectedSessionAdapterV1(facade,undefined),false);
    }
  }finally{f.close();}
});

test('PUI-04-AC01/02/03/04 a real native review uses the protected principal mapping and survives a fresh backend process',async()=>{
  const f=await financeFixture();
  try{
    const leadingBefore=nativeRows(f.root,'SELECT revision,effect_key,command,event FROM pan516_events ORDER BY revision');
    assert.ok(leadingBefore.length>0,'the existing native procurement path must execute before the missing connector assertion');
    assert.equal(typeof backend?.initializeNativeErvHumanBackendV1,'function','PAN542_NATIVE_PERSISTED_HUMAN_BACKEND_NOT_IMPLEMENTED');
    const authRoot=join(f.parent,'session-state');mkdirSync(authRoot,{mode:0o700});
    const sessions=createProtectedSessionAdapterV1(sessionOptions(authRoot));
    backend.initializeNativeErvHumanBackendV1({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessionBinding:sessions.binding});
    const api=backend.createNativeErvHumanBackendV1({root:f.root,sessions});
    const headers=issue(sessions,'synthetic:erv-reviewer');
    const proposal=api.read(headers,{invoiceId});
    assert.equal(proposal.state,'REVIEW_REQUIRED');assert.equal(proposal.proposalRevision,0);
    assert.equal(proposal.nativeRole,'REVIEWER');assert.equal(proposal.roleMappingVersion,1);
    assert.equal(proposal.invoiceId,invoiceId);assert.equal(proposal.nativeRevision,leadingBefore.length);
    const command={schemaVersion:'pansphaira.erv-human/decision/v1',invoiceId,effectId:'synthetic:erv-review-001',transportId:'synthetic:erv-wire-001',
      expectedNativeRevision:proposal.nativeRevision,expectedProposalRevision:proposal.proposalRevision,proposalDigest:proposal.proposalDigest,action:'REVIEW'};
    const reviewed=api.decide(headers,command);
    assert.equal(reviewed.state,'REVIEWED_LOCAL_EVIDENCE_ONLY');assert.equal(reviewed.proposalRevision,1);
    assert.equal(reviewed.bookingAuthorityGranted,false);assert.equal(reviewed.executionAuthorityGranted,false);
    const restart=spawnSync(process.execPath,['tests/pan542/restart-reader.mjs',f.root,authRoot],{
      input:JSON.stringify({sessionOptions:sessionOptions(authRoot),headers,invoiceId}),encoding:'utf8',timeout:15000});
    assert.equal(restart.status,0,restart.stderr);assert.equal(restart.signal,null);
    const fresh=JSON.parse(restart.stdout);assert.deepEqual(fresh,reviewed);
    assert.deepEqual(nativeRows(f.root,'SELECT revision,effect_key,command,event FROM pan516_events ORDER BY revision'),leadingBefore);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,1);
  }finally{f.close();}
});



import {appendFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {shapeIdentity527} from '../pan527/helpers.mjs';
import {compatibilityFixture,legacySourceInput,originalRows,sourceNegativeFixture,sessionOptions as compatibilitySessionOptions} from './source-compatibility-fixture.mjs';
import {predecessorSourceInput} from './source-compatibility-fixture.mjs';
const historyV1Root=predecessorSourceInput();
{
  const backend=await import(pathToFileURL(join(historyV1Root,'src/pan542/native-human-backend.mjs')));
  const {createProtectedSessionAdapterV1}=await import(pathToFileURL(join(historyV1Root,'src/pan527/origin-session-adapter.mjs')));
  const {compatibilityFixture,legacySourceInput,originalRows,sourceNegativeFixture,sessionOptions:compatibilitySessionOptions}=await import(pathToFileURL(join(historyV1Root,'tests/pan542/source-compatibility-fixture.mjs')));
// Separate source-compatibility/v1 owner metadata; no HTTP/grant/decision ABI.
const transition=f=>backend.transitionNativeErvHumanSourceCompatibilityV1({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:f.sessions});
const sourceTableRows=root=>nativeRows(root,"SELECT name FROM sqlite_master WHERE type='table' AND name='pan542_source_compatibility_v1'");

test('PAN542 source compatibility v1 genuine immutable legacy RED becomes owner-authorized GREEN without changing original rows or decision basis',async()=>{
  const f=await compatibilityFixture();
  try{
    const before=originalRows(f.root);assert.throws(()=>backend.createNativeErvHumanBackendV1({root:f.root,sessions:f.sessions}),/ERV_HUMAN_CONFIGURATION_BINDING_DENIED/);
    const oldSessionsModule=await import(pathToFileURL(join(legacySourceInput(),'src/pan527/origin-session-adapter.mjs'))),oldAuth=join(f.parent,'legacy-original-auth');mkdirSync(oldAuth,{mode:0o700});
    const oldSessions=oldSessionsModule.createProtectedSessionAdapterV1(compatibilitySessionOptions(oldAuth)),oldHeaders=issue(oldSessions,'synthetic:erv-reviewer');
    const oldApi=f.legacy.createNativeErvHumanBackendV1({root:f.root,sessions:oldSessions}),originalView=oldApi.read(oldHeaders,{invoiceId});
    const oldBinding=JSON.parse(before.pan542_binding[0].record);assert.deepEqual(oldBinding.sourceIdentity,JSON.parse(readFileSync(new URL('../../src/pan542/source-compatibility-catalog-v1.json',import.meta.url),'utf8')).originalSourceIdentity);
    // The immutable legacy API's original source and session owner must remain
    // valid; no original table/event/task rewrite can be hidden by the bridge.
    assert.equal(oldBinding.executionAuthorityGranted,false);
    const receipt=transition(f);assert.equal(receipt.schemaVersion,'pansphaira.erv-human/source-compatibility/v1');
    assert.equal(receipt.originalPrimary.commit,'177c267e67b000e0f16bebd406d77993dda7f8bf');
    assert.equal(receipt.releasedBasePrimary.commit,'0505b9618561af464b77ff55af62a011b9b2f345');
    assert.equal(receipt.executionAuthorityGranted,false);assert.equal(receipt.sessionAndNativeRolesUnchanged,true);
    assert.deepEqual(transition(f),receipt);assert.deepEqual(originalRows(f.root),before);
    const api=backend.createNativeErvHumanBackendV1({root:f.root,sessions:f.sessions});
    const view=api.read(issue(f.sessions,'synthetic:erv-reviewer'),{invoiceId});
    assert.deepEqual(view.sourceIdentity,receipt.originalSourceIdentity);assert.equal(view.bindingDigest,receipt.originalBindingDigest);
    assert.equal(view.nativeRole,'REVIEWER');assert.equal(view.executionAuthorityGranted,false);
    assert.deepEqual(view,originalView);assert.deepEqual(oldApi.read(oldHeaders,{invoiceId}),originalView,'old source remains rollback-compatible');
    assert.equal(nativeRows(f.root,'SELECT count(*) AS n FROM pan542_source_compatibility_v1')[0].n,1);
  }finally{f.close();}
});

test('PAN542 source compatibility v1 rejects unauthorized unbranded foreign and caller-hash options before any transition',async()=>{
  const f=await compatibilityFixture();
  try{
    const before=originalRows(f.root),options={root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:f.sessions};
    for(const owner of [null,'HTTP_USER','APPROVER'])assert.throws(()=>backend.transitionNativeErvHumanSourceCompatibilityV1({...options,owner}),/SOURCE_LOCAL_OWNER_REQUIRED_DENIED/);
    assert.throws(()=>backend.transitionNativeErvHumanSourceCompatibilityV1({...options,sessions:{binding:f.sessions.binding}}),/PROTECTED_SESSION_OWNER_REQUIRED_DENIED/);
    for(const extra of [{sourceIdentity:[]},{from:'a'.repeat(64)},{catalog:{}},{grant:{owner:true}},{targetCommit:'f'.repeat(40)}])
      assert.throws(()=>backend.transitionNativeErvHumanSourceCompatibilityV1({...options,...extra}),/SOURCE_OWNER_OPTIONS_DENIED/);
    for(const [name,overrides]of [['origin',{origin:'https://foreign-pan542.test:4443'}],['generation',{identity:{...shapeIdentity527('tenant-a'),generation:2}}]]){
      const stateRoot=join(f.parent,'foreign-'+name);mkdirSync(stateRoot,{mode:0o700});
      const sessions=createProtectedSessionAdapterV1(compatibilitySessionOptions(stateRoot,overrides));
      assert.throws(()=>backend.transitionNativeErvHumanSourceCompatibilityV1({...options,sessions}),/ERV_HUMAN_SESSION_BINDING_DENIED/);
    }
    assert.deepEqual(sourceTableRows(f.root),[]);assert.deepEqual(originalRows(f.root),before);
  }finally{f.close();}
});

test('PAN542 source compatibility v1 rejects an unbound native store without initializing or adopting one',async()=>{
  const f=await compatibilityFixture({unbound:true});try{
    const before=originalRows(f.root);assert.throws(()=>transition(f),/ERV_HUMAN_(HISTORY_GUARDS|CONFIGURATION_REQUIRED)_DENIED/);
    assert.deepEqual(sourceTableRows(f.root),[]);assert.deepEqual(originalRows(f.root),before);
  }finally{f.close();}
});

test('PAN542 source compatibility v1 rejects actual tampered target bytes and catalog provenance without rewriting native history',async()=>{
  for(const kind of ['target','catalog']){
    const f=await compatibilityFixture();try{
      const before=originalRows(f.root),root=sourceNegativeFixture(historyV1Root,f.parent),entry=join(root,'src/pan542/native-human-backend.mjs');
      if(kind==='target')appendFileSync(entry,'\n// isolated unadmitted source-byte change\n');
      else{const p=join(root,'src/pan542/source-compatibility-catalog-v1.json'),c=JSON.parse(readFileSync(p,'utf8'));c.originalPrimary.commit='0'.repeat(40);writeFileSync(p,JSON.stringify(c));}
      const untrusted=await import(pathToFileURL(entry));
      assert.throws(()=>untrusted.transitionNativeErvHumanSourceCompatibilityV1({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:f.sessions}),/ERV_HUMAN_SOURCE_(TARGET|CATALOG)_DENIED/);
      assert.deepEqual(sourceTableRows(f.root),[]);assert.deepEqual(originalRows(f.root),before);
    }finally{f.close();}
  }
});

test('PAN542 source compatibility v1 rejects an unrecognized original source closure from the real initializer',async()=>{
  const f=await compatibilityFixture({unbound:true});try{
    const negative=sourceNegativeFixture(legacySourceInput(),f.parent),entry=join(negative,'src/pan542/native-human-backend.mjs');
    appendFileSync(entry,'\n// isolated unrecognized historical source bytes\n');const legacy=await import(pathToFileURL(entry));
    legacy.initializeNativeErvHumanBackendV1({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessionBinding:f.sessions.binding});
    const before=originalRows(f.root);assert.throws(()=>transition(f),/ERV_HUMAN_SOURCE_ORIGINAL_DENIED/);
    assert.deepEqual(originalRows(f.root),before);assert.deepEqual(sourceTableRows(f.root),[]);
  }finally{f.close();}
});

test('PAN542 source compatibility v1 immutable insert update delete guards reject conflicting or replaced transition records',async()=>{
  const f=await compatibilityFixture();try{
    const receipt=transition(f),before=originalRows(f.root),db=new DatabaseSync(join(f.root,'target.sqlite'));
    try{for(const sql of ["UPDATE pan542_source_compatibility_v1 SET record='{}' WHERE id=1",'DELETE FROM pan542_source_compatibility_v1 WHERE id=1',"INSERT OR REPLACE INTO pan542_source_compatibility_v1 VALUES(1,'{}')"])
      assert.throws(()=>db.exec(sql),/ERV_HUMAN_SOURCE_HISTORY_IMMUTABLE_DENIED/);
    }finally{db.close();}
    assert.deepEqual(transition(f),receipt);assert.deepEqual(originalRows(f.root),before);
  }finally{f.close();}
});

test('PAN542 source compatibility v1 an interrupted real native transition rolls back DDL and restart commits once',async()=>{
  const f=await compatibilityFixture();let child;try{
    const before=originalRows(f.root);
    const script=`import {DatabaseSync} from 'node:sqlite';import {createProtectedSessionAdapterV1} from './src/pan527/origin-session-adapter.mjs';import {transitionNativeErvHumanSourceCompatibilityV1} from './src/pan542/native-human-backend.mjs';
      const original=DatabaseSync.prototype.exec;DatabaseSync.prototype.exec=function(sql){const result=original.call(this,sql);if(sql.startsWith('CREATE TABLE pan542_source_compatibility_v1(')){process.stdout.write('TRANSITION_DDL_REACHED\\n');process.kill(process.pid,'SIGSTOP');}return result;};
      const sessions=createProtectedSessionAdapterV1(${JSON.stringify(compatibilitySessionOptions(f.authRoot))});transitionNativeErvHumanSourceCompatibilityV1({root:${JSON.stringify(f.root)},owner:'LOCAL_SYNTHETIC_OWNER',sessions});`;
    child=spawn(process.execPath,['--input-type=module','-e',script],{cwd:historyV1Root,stdio:['ignore','pipe','pipe']});
    let stderr='';child.stderr.on('data',b=>{stderr+=b;});
    await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('REAL_TRANSITION_DDL_NOT_REACHED:'+stderr)),15000);child.stdout.on('data',b=>{out+=b;if(out.includes('TRANSITION_DDL_REACHED')){clearTimeout(timer);resolve();}});child.once('exit',code=>{clearTimeout(timer);reject(Error('TRANSITION_CHILD_PREMATURE_EXIT:'+code+':'+stderr));});});
    const ended=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));child.kill('SIGKILL');const actual=await ended;assert.equal(actual.signal,'SIGKILL');
    assert.deepEqual(sourceTableRows(f.root),[]);assert.deepEqual(originalRows(f.root),before);
    assert.throws(()=>backend.createNativeErvHumanBackendV1({root:f.root,sessions:f.sessions}),/ERV_HUMAN_CONFIGURATION_BINDING_DENIED/);
    const receipt=transition(f);assert.deepEqual(transition(f),receipt);assert.deepEqual(originalRows(f.root),before);
    const restart=spawnSync(process.execPath,['--input-type=module','-e',`import {createProtectedSessionAdapterV1} from './src/pan527/origin-session-adapter.mjs';import {transitionNativeErvHumanSourceCompatibilityV1,createNativeErvHumanBackendV1} from './src/pan542/native-human-backend.mjs';const sessions=createProtectedSessionAdapterV1(${JSON.stringify(compatibilitySessionOptions(f.authRoot))});const receipt=transitionNativeErvHumanSourceCompatibilityV1({root:${JSON.stringify(f.root)},owner:'LOCAL_SYNTHETIC_OWNER',sessions});createNativeErvHumanBackendV1({root:${JSON.stringify(f.root)},sessions});console.log(receipt.transitionDigest);`],{cwd:historyV1Root,encoding:'utf8'});
    assert.equal(restart.status,0,restart.stderr);assert.equal(restart.stdout.trim(),receipt.transitionDigest);
    assert.equal(nativeRows(f.root,'SELECT count(*) AS n FROM pan542_source_compatibility_v1')[0].n,1);
  }finally{if(child?.exitCode===null)child.kill('SIGKILL');f.close();}
});


test('PAN542 source compatibility v1 preserves an existing namespace fence and denies without metadata effects',async()=>{
  const f=await compatibilityFixture();try{
    const {acquireLocalJournalOwner}=await import('../../demo/runtime/local-journal-owner.mjs'),lease=acquireLocalJournalOwner(join(f.root,'pan453-owned-v2')),before=originalRows(f.root);
    try{assert.throws(()=>transition(f),/BTH_JOURNAL_FENCED_DENIED/);assert.deepEqual(sourceTableRows(f.root),[]);assert.deepEqual(originalRows(f.root),before);}finally{lease.release();}
    assert.ok(transition(f).transitionDigest);
  }finally{f.close();}
});

test('PAN542 source compatibility v1 refuses empty and forged pre-existing guarded transition rows instead of adopting or repairing them',async()=>{
  const good=await compatibilityFixture();let schema;
  try{transition(good);const db=new DatabaseSync(join(good.root,'target.sqlite'),{readOnly:true});try{schema=db.prepare("SELECT type,sql FROM sqlite_master WHERE name='pan542_source_compatibility_v1' OR name GLOB 'pan542_source_compatibility_v1_*' ORDER BY type DESC,name").all();}finally{db.close();}}finally{good.close();}
  for(const forged of [false,true]){
    const f=await compatibilityFixture();try{
      const db=new DatabaseSync(join(f.root,'target.sqlite'));try{
        db.exec(schema.find(x=>x.type==='table').sql);
        if(forged)db.prepare('INSERT INTO pan542_source_compatibility_v1 VALUES(1,?)').run(JSON.stringify({schemaVersion:'pansphaira.erv-human/source-compatibility/v1',transitionId:'PAN542_ORIGIN_SESSION_SURFACE_CORRECTIONS_V1',executionAuthorityGranted:true}));
        for(const row of schema.filter(x=>x.type==='trigger'))db.exec(row.sql);
      }finally{db.close();}
      const before=originalRows(f.root),retained=nativeRows(f.root,'SELECT * FROM pan542_source_compatibility_v1');
      assert.throws(()=>transition(f),/ERV_HUMAN_SOURCE_HISTORY_CONFLICT_DENIED/);
      assert.throws(()=>backend.createNativeErvHumanBackendV1({root:f.root,sessions:f.sessions}),/ERV_HUMAN_SOURCE_HISTORY_CONFLICT_DENIED/);
      assert.deepEqual(nativeRows(f.root,'SELECT * FROM pan542_source_compatibility_v1'),retained);assert.deepEqual(originalRows(f.root),before);
    }finally{f.close();}
  }
});
}

// Explicit successor tests; V1 history/assertions above remain bound to genuine V1.
// The released V2 primary 79df9fda08411514426b2931c6f30b0aa3dc40a1 is genuine
// history now: its original transition, readback, denial, guard and crash
// assertions below run entirely inside the complete released V2 source itself
// (parent-verified commit, tree and source pins; never a hybrid of the released
// V2 backend spliced with the current candidate adapter). Current-source
// assertions form the explicit v3 section at the end.
import {after as afterSourceV3} from 'node:test';
import {readdirSync as readDirV3,lstatSync as statV3} from 'node:fs';
import {acquireLocalJournalOwner as sourceFenceV3} from '../../demo/runtime/local-journal-owner.mjs';
import {releasedV2SourceInput} from './source-compatibility-fixture.mjs';
const historyV2Root=releasedV2SourceInput();
// The fixture module's after() cleanup (registered at its module load, before
// afterSourceV3) removes this materialized temp source first. Capture the
// genuine verified historical V2 catalog bytes in memory at materialization
// time so the afterSourceV3 evidence hook never reads an already removed path.
const historicalV2CatalogBytes=readFileSync(join(historyV2Root,'src/pan542/source-compatibility-catalog-v2.json'),'utf8');
const backendV2=await import(pathToFileURL(join(historyV2Root,'src/pan542/native-human-backend.mjs')));
const adapterModuleV2=await import(pathToFileURL(join(historyV2Root,'src/pan527/origin-session-adapter.mjs')));
const fixtureModuleV2=await import(pathToFileURL(join(historyV2Root,'tests/pan542/source-compatibility-fixture.mjs')));
const backendV1Prior=await import(pathToFileURL(join(historyV1Root,'src/pan542/native-human-backend.mjs')));
const adapterModuleV1Prior=await import(pathToFileURL(join(historyV1Root,'src/pan527/origin-session-adapter.mjs')));
const sourceV3Results=[];let sourceV3RemovedBytes=0;
const transitionV2History=f=>backendV2.transitionNativeErvHumanSourceCompatibilityV2({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:f.sessions});
const transitionV3=f=>backend.transitionNativeErvHumanSourceCompatibilityV3({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:f.sessions});
function allNativeRowsV3(root){const db=new DatabaseSync(join(root,'target.sqlite'),{readOnly:true});try{return Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(({name})=>[name,JSON.parse(JSON.stringify(db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'" ORDER BY rowid').all()))]));}finally{db.close();}}
function preservedV3(root,before,added=[]){const after=allNativeRowsV3(root);assert.deepEqual(Object.fromEntries(Object.keys(before).map(k=>[k,after[k]])),before,'EVERY_PREEXISTING_NATIVE_TABLE_ROW_INCLUDING_V1_V2_RECEIPTS_UNCHANGED');assert.deepEqual(Object.keys(after).filter(k=>!(k in before)),added);}
function meteredV3(f){const close=f.close;let closed=false;f.close=()=>{if(closed)return;closed=true;let bytes=0;function walk(p){for(const e of readDirV3(p,{withFileTypes:true})){const q=join(p,e.name);if(e.isDirectory())walk(q);else bytes+=statV3(q).size;}}walk(f.parent);try{close();}finally{assert.equal(existsSync(f.parent),false);sourceV3RemovedBytes+=bytes;}};return f;}
function sessionsWith(adapterModule,parent,name){const authRoot=join(parent,name);mkdirSync(authRoot,{mode:0o700});return {authRoot,sessions:adapterModule.createProtectedSessionAdapterV1(compatibilitySessionOptions(authRoot))};}
const adapterModuleCurrent={createProtectedSessionAdapterV1};
function currentSessionsV3(parent,name){return sessionsWith(adapterModuleCurrent,parent,name);}
async function preservedV3Fixture(){const f=meteredV3(await fixtureModuleV2.compatibilityFixture());try{const v1Stage=sessionsWith(adapterModuleV1Prior,f.parent,'v1-stage-auth'),v1Receipt=backendV1Prior.transitionNativeErvHumanSourceCompatibilityV1({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:v1Stage.sessions}),v2Receipt=backendV2.transitionNativeErvHumanSourceCompatibilityV2({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:f.sessions}),v2Headers=issue(f.sessions,'synthetic:erv-reviewer'),priorApi=backendV2.createNativeErvHumanBackendV1({root:f.root,sessions:f.sessions}),proposal=priorApi.read(v2Headers,{invoiceId});priorApi.decide(v2Headers,commandFor(proposal,'REVIEW','preserved-v2-review'));const priorView=priorApi.read(v2Headers,{invoiceId}),priorSessions=f.sessions,cur=currentSessionsV3(f.parent,'v3-current-auth');return {...f,authRoot:cur.authRoot,sessions:cur.sessions,priorSessions,v1Receipt,v2Receipt,v2Headers,priorView};}catch(error){f.close();throw error;}}
afterSourceV3(()=>{if(process.env.P0_ERV_OUT)writeFileSync(join(process.env.P0_ERV_OUT,'ACTUAL-REGISTERED-NATIVE-SOURCE-V3-RESULTS.json'),JSON.stringify({schemaVersion:1,sourceV3Results,runtimeRemovedNoRefundLogicalBytes:sourceV3RemovedBytes,historicalV2SourcePins:JSON.parse(historicalV2CatalogBytes),actualCurrentSourcePins:JSON.parse(readFileSync(new URL('../../src/pan542/source-compatibility-catalog-v3.json',import.meta.url),'utf8')),noLANOriginalDataOrProductionAccess:true},null,2)+'\n',{mode:0o600});});

// Historical V2 assertions: the genuine complete released V2 source is the actor.
test('PAN542 source compatibility v2 history genuine V1 preserved receipt and decision stay explicit GREEN, idempotent and guarded inside the released V2 source itself',async()=>{const f=meteredV3(await fixtureModuleV2.compatibilityFixture());try{const v1Stage=sessionsWith(adapterModuleV1Prior,f.parent,'v1-stage-auth'),v1Receipt=backendV1Prior.transitionNativeErvHumanSourceCompatibilityV1({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:v1Stage.sessions}),v1Api=backendV1Prior.createNativeErvHumanBackendV1({root:f.root,sessions:v1Stage.sessions}),v1Headers=issue(v1Stage.sessions,'synthetic:erv-reviewer'),v1Proposal=v1Api.read(v1Headers,{invoiceId});v1Api.decide(v1Headers,commandFor(v1Proposal,'REVIEW','preserved-v1-history-review'));const v1PriorView=v1Api.read(v1Headers,{invoiceId}),before=allNativeRowsV3(f.root);assert.ok(before.pan542_events.length>0,'the genuine V1 review decision must be retained in the native event history before the released V2 transition');const cur=currentSessionsV3(f.parent,'v3-history-denial-auth');
assert.throws(()=>backend.createNativeErvHumanBackendV1({root:f.root,sessions:cur.sessions}),/ERV_HUMAN_CONFIGURATION_BINDING_DENIED/,'current v3 source refuses the pre-v3 store until its own owner transition runs');
const receipt=transitionV2History(f);assert.equal(receipt.schemaVersion,'pansphaira.erv-human/source-compatibility/v2');assert.equal(receipt.predecessorTransitionDigest,v1Receipt.transitionDigest);assert.equal(receipt.predecessorPrimary.commit,'3a54908b377b749e0df229fc6212492acfa9ea15');assert.equal(receipt.executionAuthorityGranted,false);assert.equal(receipt.bookingAuthorityGranted,false);assert.equal(receipt.paymentOrderAuthorized,false);assert.equal(receipt.productiveDispatchAuthorized,false);
preservedV3(f.root,before,['pan542_source_compatibility_v2']);assert.deepEqual(transitionV2History(f),receipt);
const api=backendV2.createNativeErvHumanBackendV1({root:f.root,sessions:f.sessions}),view=api.read(issue(f.sessions,'synthetic:erv-reviewer'),{invoiceId});assert.deepEqual(view.sourceIdentity,JSON.parse(readFileSync(new URL('../../src/pan542/source-compatibility-catalog-v1.json',import.meta.url),'utf8')).originalSourceIdentity);assert.equal(view.executionAuthorityGranted,false);
assert.deepEqual(v1Api.read(v1Headers,{invoiceId}),v1PriorView,'the genuine V1 source reads the preserved decision back unchanged over the released V2 row');const v2OnV1AuthStore=adapterModuleV2.createProtectedSessionAdapterV1(compatibilitySessionOptions(v1Stage.authRoot));assert.deepEqual(backendV2.createNativeErvHumanBackendV1({root:f.root,sessions:v2OnV1AuthStore}).read(v1Headers,{invoiceId}),v1PriorView,'a genuine V2-branded session on the same auth store reads the preserved V1 decision back unchanged');
const guarded=allNativeRowsV3(f.root),db=new DatabaseSync(join(f.root,'target.sqlite'));try{for(const table of ['pan542_source_compatibility_v1','pan542_source_compatibility_v2'])for(const sql of [`UPDATE ${table} SET record='{}' WHERE id=1`,`DELETE FROM ${table} WHERE id=1`,`INSERT OR REPLACE INTO ${table} VALUES(1,'{}')`])assert.throws(()=>db.exec(sql),/SOURCE_HISTORY_IMMUTABLE_DENIED/);}finally{db.close();}
assert.deepEqual(allNativeRowsV3(f.root),guarded);sourceV3Results.push({case:'released-v2-history-preserves-v1-chain',v1ReceiptDigest:v1Receipt.transitionDigest,v2ReceiptDigest:receipt.transitionDigest,v1DecisionRetained:true,preexistingDecisionEvents:before.pan542_events.length,allPriorRowsUnchanged:true});}finally{f.close();}});

test('PAN542 source compatibility v2 history exact directly initialized published V1 source binding transitions under the released V2 source without inventing a V1 receipt',async()=>{const f=meteredV3(await fixtureModuleV2.compatibilityFixture({legacyOverride:join(historyV1Root,'src/pan542/native-human-backend.mjs')}));try{const before=allNativeRowsV3(f.root);assert.equal('pan542_source_compatibility_v1' in before,false);const receipt=transitionV2History(f);assert.equal(receipt.predecessorTransitionDigest,null);assert.equal(receipt.originalSourceIdentity.length,11);preservedV3(f.root,before,['pan542_source_compatibility_v2']);assert.equal('pan542_source_compatibility_v1' in allNativeRowsV3(f.root),false);sourceV3Results.push({case:'released-v2-history-direct-v1-binding',noInventedV1Receipt:true,v2ReceiptDigest:receipt.transitionDigest});}finally{f.close();}});

test('PAN542 source compatibility v2 history exact owner, brand, caller hashes, foreign tenant and active namespace fence are denied inside the released V2 source, which itself denies the retired V1 entry',async()=>{const f=meteredV3(await fixtureModuleV2.compatibilityFixture());try{const before=allNativeRowsV3(f.root),options={root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:f.sessions};
for(const owner of [null,'HTTP_USER','APPROVER'])assert.throws(()=>backendV2.transitionNativeErvHumanSourceCompatibilityV2({...options,owner}),/SOURCE_LOCAL_OWNER_REQUIRED_DENIED/);
assert.throws(()=>backendV2.transitionNativeErvHumanSourceCompatibilityV2({...options,sessions:{binding:f.sessions.binding}}),/PROTECTED_SESSION_OWNER_REQUIRED_DENIED/);
for(const extra of [{sourceIdentity:[]},{sourceHash:'0'.repeat(64)},{transitionId:'forged'},{grant:true}])assert.throws(()=>backendV2.transitionNativeErvHumanSourceCompatibilityV2({...options,...extra}),/SOURCE_OWNER_OPTIONS_DENIED/);
const foreignRoot=join(f.parent,'v2-history-foreign-auth');mkdirSync(foreignRoot,{mode:0o700});
const foreign=adapterModuleV2.createProtectedSessionAdapterV1(compatibilitySessionOptions(foreignRoot,{identity:shapeIdentity527('tenant-b')}));
assert.throws(()=>backendV2.transitionNativeErvHumanSourceCompatibilityV2({...options,sessions:foreign}),/ERV_HUMAN_SESSION_BINDING_DENIED/);
assert.throws(()=>backendV2.transitionNativeErvHumanSourceCompatibilityV1(options),/ERV_HUMAN_SOURCE_TARGET_DENIED/,'the released V2 source itself keeps denying the retired V1 entry on its own bytes');
const fence=sourceFenceV3(join(f.root,'pan453-owned-v2'));try{assert.throws(()=>transitionV2History(f),{message:'BTH_JOURNAL_FENCED_DENIED'});}finally{fence.release();}
preservedV3(f.root,before);sourceV3Results.push({case:'released-v2-history-owner-brand-hash-tenant-and-fence-denials',allPriorRowsUnchanged:true});}finally{f.close();}});

test('PAN542 source compatibility v2 history original legacy source without a genuine V1 predecessor receipt remains denied under the released V2 source rather than silently bridged',async()=>{const f=meteredV3(await fixtureModuleV2.compatibilityFixture());try{const before=allNativeRowsV3(f.root);assert.throws(()=>transitionV2History(f),/ERV_HUMAN_CONFIGURATION_BINDING_DENIED/);preservedV3(f.root,before);sourceV3Results.push({case:'released-v2-history-missing-v1-predecessor',denied:true,allPriorRowsUnchanged:true});}finally{f.close();}});

test('PAN542 source compatibility v2 history actual changed released V2 target bytes and forged V2 catalog remain denied, not caller-adopted source',async()=>{const f=meteredV3(await fixtureModuleV2.compatibilityFixture());try{const before=allNativeRowsV3(f.root);for(const kind of ['target','catalog']){const parent=join(f.parent,'v2-history-untrusted-'+kind);mkdirSync(parent,{mode:0o700});const root=sourceNegativeFixture(historyV2Root,parent),entry=join(root,'src/pan542/native-human-backend.mjs');if(kind==='target')appendFileSync(entry,'\n// actual untrusted released-V2 target drift\n');else{const path=join(root,'src/pan542/source-compatibility-catalog-v2.json'),policy=JSON.parse(readFileSync(path,'utf8'));policy.predecessorPrimary.commit='0'.repeat(40);writeFileSync(path,JSON.stringify(policy));}const untrusted=await import(pathToFileURL(entry));assert.throws(()=>untrusted.transitionNativeErvHumanSourceCompatibilityV2({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:f.sessions}),/ERV_HUMAN_SOURCE_(TARGET|CATALOG)_DENIED/);preservedV3(f.root,before);}sourceV3Results.push({case:'released-v2-history-actual-target-and-catalog-negatives',bothActualDenials:true,allPriorRowsUnchanged:true});}finally{f.close();}});

test('PAN542 source compatibility v2 history interrupted released V2 DDL rolls back, restart commits once, all original V1 business history survives',async()=>{const f=meteredV3(await fixtureModuleV2.compatibilityFixture());let child;try{const v1Stage=sessionsWith(adapterModuleV1Prior,f.parent,'v1-stage-auth'),v1Receipt=backendV1Prior.transitionNativeErvHumanSourceCompatibilityV1({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:v1Stage.sessions}),before=allNativeRowsV3(f.root),opts=JSON.stringify(compatibilitySessionOptions(f.authRoot)),root=JSON.stringify(f.root),script=`import {DatabaseSync} from 'node:sqlite';import {createProtectedSessionAdapterV1} from './src/pan527/origin-session-adapter.mjs';import {transitionNativeErvHumanSourceCompatibilityV2} from './src/pan542/native-human-backend.mjs';const original=DatabaseSync.prototype.exec;DatabaseSync.prototype.exec=function(sql){const result=original.call(this,sql);if(sql.startsWith('CREATE TABLE pan542_source_compatibility_v2(')){process.stdout.write('V2_HISTORY_ACTUAL_DDL_REACHED\\n');process.kill(process.pid,'SIGSTOP');}return result;};const sessions=createProtectedSessionAdapterV1(${opts});transitionNativeErvHumanSourceCompatibilityV2({root:${root},owner:'LOCAL_SYNTHETIC_OWNER',sessions});`;
child=spawn(process.execPath,['--input-type=module','-e',script],{cwd:historyV2Root,stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',b=>{stderr+=b;});
await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('V2_HISTORY_TRANSITION_DDL_NOT_REACHED:'+stderr)),10000);child.stdout.on('data',b=>{out+=b;if(out.includes('V2_HISTORY_ACTUAL_DDL_REACHED')){clearTimeout(timer);resolve();}});child.once('exit',code=>{clearTimeout(timer);reject(Error('V2_HISTORY_CHILD_PREMATURE_EXIT:'+code+':'+stderr));});});
const ended=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));child.kill('SIGKILL');const actual=await ended;assert.equal(actual.signal,'SIGKILL');
preservedV3(f.root,before);
assert.throws(()=>backend.createNativeErvHumanBackendV1({root:f.root,sessions:currentSessionsV3(f.parent,'v2-history-crash-denial-auth').sessions}),/ERV_HUMAN_CONFIGURATION_BINDING_DENIED/);
const restart=spawnSync(process.execPath,['--input-type=module','-e',`import {createProtectedSessionAdapterV1} from './src/pan527/origin-session-adapter.mjs';import {transitionNativeErvHumanSourceCompatibilityV2} from './src/pan542/native-human-backend.mjs';const sessions=createProtectedSessionAdapterV1(${opts});const receipt=transitionNativeErvHumanSourceCompatibilityV2({root:${root},owner:'LOCAL_SYNTHETIC_OWNER',sessions});console.log(receipt.transitionDigest);`],{cwd:historyV2Root,encoding:'utf8'});
assert.equal(restart.status,0,restart.stderr);assert.equal(restart.stdout.trim(),transitionV2History(f).transitionDigest);assert.equal(nativeRows(f.root,'SELECT count(*) AS n FROM pan542_source_compatibility_v2')[0].n,1);
assert.ok(v1Receipt.transitionDigest,'the preserved V1 receipt remains the unchanged chain root');sourceV3Results.push({case:'released-v2-history-interrupted-ddl-rollback-restart-once',rollbackClean:true,committedOnce:true});}finally{if(child?.exitCode===null)child.kill('SIGKILL');f.close();}});

// Current-source assertions: the candidate itself owns the v3 successor.
test('PAN542 source compatibility v3 genuine preserved V2 predecessor configuration, decision and receipts become an explicit current-source successor with every prior row, receipt and guard intact',async()=>{const f=await preservedV3Fixture();try{const before=allNativeRowsV3(f.root);
assert.throws(()=>backend.createNativeErvHumanBackendV1({root:f.root,sessions:f.sessions}),/ERV_HUMAN_CONFIGURATION_BINDING_DENIED/);
const receipt=transitionV3(f);assert.equal(receipt.schemaVersion,'pansphaira.erv-human/source-compatibility/v3');assert.equal(receipt.transitionId,'PAN542_ROUTE_GLUE_ADAPTER_COMPATIBILITY_V3');assert.equal(receipt.predecessorTransitionId,'PAN542_NATIVE_REVOKE_CLASSIFICATION_CORRECTION_V2');assert.equal(receipt.predecessorTransitionDigest,f.v2Receipt.transitionDigest);assert.equal(receipt.predecessorPrimary.commit,'79df9fda08411514426b2931c6f30b0aa3dc40a1');assert.equal(receipt.predecessorPrimary.tree,'9bb0e5548be0158fba58a14a02afb180e467143a');assert.equal(receipt.predecessorPrimary.releaseId,438045921);assert.equal(receipt.predecessorSourceCatalogSHA256,'455c3a941bd2b4eef351dc31403501b1e39692d9f62a4f5fcc8b0f4cd9268fb9');assert.equal(receipt.originalBindingAndHistoryUnchanged,true);assert.equal(receipt.predecessorReceiptUnchanged,true);assert.equal(receipt.sessionAndNativeRolesUnchanged,true);assert.equal(receipt.bookingAuthorityGranted,false);assert.equal(receipt.paymentOrderAuthorized,false);assert.equal(receipt.productiveDispatchAuthorized,false);assert.equal(receipt.executionAuthorityGranted,false);
preservedV3(f.root,before,['pan542_source_compatibility_v3']);assert.deepEqual(transitionV3(f),receipt);
const v3Headers=issue(f.sessions,'synthetic:erv-reviewer'),current=backend.createNativeErvHumanBackendV1({root:f.root,sessions:f.sessions});assert.deepEqual(current.read(v3Headers,{invoiceId}),f.priorView);
assert.deepEqual(backendV2.createNativeErvHumanBackendV1({root:f.root,sessions:f.priorSessions}).read(f.v2Headers,{invoiceId}),f.priorView,'released V2 source remains rollback-compatible over the v3 row');
assert.deepEqual(backendV2.transitionNativeErvHumanSourceCompatibilityV2({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:f.priorSessions}),f.v2Receipt,'the V2 receipt is byte-identical after the successor');
const guarded=allNativeRowsV3(f.root),db=new DatabaseSync(join(f.root,'target.sqlite'));try{for(const table of ['pan542_source_compatibility_v1','pan542_source_compatibility_v2','pan542_source_compatibility_v3'])for(const sql of [`UPDATE ${table} SET record='{}' WHERE id=1`,`DELETE FROM ${table} WHERE id=1`,`INSERT OR REPLACE INTO ${table} VALUES(1,'{}')`])assert.throws(()=>db.exec(sql),/SOURCE_HISTORY_IMMUTABLE_DENIED/);}finally{db.close();}
assert.deepEqual(allNativeRowsV3(f.root),guarded);sourceV3Results.push({case:'genuine-preserved-v2-history-explicit-v3',preexistingDecisionEvents:before.pan542_events.length,v1ReceiptDigest:f.v1Receipt.transitionDigest,v2ReceiptDigest:f.v2Receipt.transitionDigest,v3ReceiptDigest:receipt.transitionDigest,allPriorRowsUnchanged:true});}finally{f.close();}});

test('PAN542 source compatibility v3 fresh current-source initialization is strict-bound at once and the owner operation is an explicit no-op without a new table',async()=>{const f=await financeFixture();try{const cur=currentSessionsV3(f.parent,'v3-fresh-auth'),record=backend.initializeNativeErvHumanBackendV1({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessionBinding:cur.sessions.binding});
const bytes=readFileSync(new URL('../../src/pan542/source-compatibility-catalog-v3.json',import.meta.url),'utf8'),catalogV3=JSON.parse(bytes);
assert.deepEqual(record.sourceIdentity,[...catalogV3.targetFiles,{path:'src/pan542/source-compatibility-catalog-v3.json',sha256:createHash('sha256').update(bytes).digest('hex')}],'CURRENT_STRICT_SOURCE_BINDING_CATALOG_V3');
const noop=backend.transitionNativeErvHumanSourceCompatibilityV3({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:cur.sessions});assert.equal(noop.schemaVersion,'pansphaira.erv-human/source-compatibility-noop/v3');assert.equal(noop.outcome,'ALREADY_SOURCE_BOUND');assert.equal(noop.originalBindingDigest,record.bindingDigest);assert.equal(noop.executionAuthorityGranted,false);
assert.equal('pan542_source_compatibility_v3' in allNativeRowsV3(f.root),false);assert.deepEqual(backend.transitionNativeErvHumanSourceCompatibilityV3({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:cur.sessions}),noop);
const api=backend.createNativeErvHumanBackendV1({root:f.root,sessions:cur.sessions});assert.equal(api.read(issue(cur.sessions,'synthetic:erv-reviewer'),{invoiceId}).executionAuthorityGranted,false);sourceV3Results.push({case:'fresh-current-source-strict-noop',noNewTable:true,strictBindingVerifiedAgainstCatalogV3:true});}finally{f.close();}});

test('PAN542 source compatibility v3 exact directly initialized released V2 source binding transitions without inventing a V2 receipt',async()=>{const f=meteredV3(await fixtureModuleV2.compatibilityFixture({legacyOverride:join(historyV2Root,'src/pan542/native-human-backend.mjs')}));try{const before=allNativeRowsV3(f.root);assert.equal('pan542_source_compatibility_v2' in before,false);assert.equal('pan542_source_compatibility_v1' in before,false);const cur=currentSessionsV3(f.parent,'v3-direct-auth'),receipt=backend.transitionNativeErvHumanSourceCompatibilityV3({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:cur.sessions});
assert.equal(receipt.predecessorTransitionDigest,null);assert.equal(receipt.originalSourceIdentity.length,12);preservedV3(f.root,before,['pan542_source_compatibility_v3']);assert.equal('pan542_source_compatibility_v2' in allNativeRowsV3(f.root),false);
const view=backend.createNativeErvHumanBackendV1({root:f.root,sessions:cur.sessions}).read(issue(cur.sessions,'synthetic:erv-reviewer'),{invoiceId});assert.deepEqual(view.sourceIdentity,receipt.predecessorSourceIdentity);assert.equal(view.executionAuthorityGranted,false);
sourceV3Results.push({case:'genuine-direct-v2-binding-explicit-v3',allPriorRowsUnchanged:true,noInventedV2Receipt:true,v3ReceiptDigest:receipt.transitionDigest});}finally{f.close();}});

test('PAN542 source compatibility v3 exact owner, brand, caller hashes, foreign tenant, retired historical entries and active namespace fence are denied without metadata, role or task effects',async()=>{const f=await preservedV3Fixture();try{const before=allNativeRowsV3(f.root),options={root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:f.sessions};
for(const owner of [null,'HTTP_USER','APPROVER'])assert.throws(()=>backend.transitionNativeErvHumanSourceCompatibilityV3({...options,owner}),/SOURCE_LOCAL_OWNER_REQUIRED_DENIED/);
assert.throws(()=>backend.transitionNativeErvHumanSourceCompatibilityV3({...options,sessions:{binding:f.sessions.binding}}),/PROTECTED_SESSION_OWNER_REQUIRED_DENIED/);
for(const extra of [{sourceIdentity:[]},{sourceHash:'0'.repeat(64)},{transitionId:'forged'},{grant:true},{predecessorCommit:'0'.repeat(40)}])assert.throws(()=>backend.transitionNativeErvHumanSourceCompatibilityV3({...options,...extra}),/SOURCE_OWNER_OPTIONS_DENIED/);
const foreignRoot=join(f.parent,'v3-foreign-auth');mkdirSync(foreignRoot,{mode:0o700});
const foreign=createProtectedSessionAdapterV1(compatibilitySessionOptions(foreignRoot,{identity:shapeIdentity527('tenant-b')}));
assert.throws(()=>backend.transitionNativeErvHumanSourceCompatibilityV3({...options,sessions:foreign}),/ERV_HUMAN_SESSION_BINDING_DENIED/);
assert.throws(()=>backend.transitionNativeErvHumanSourceCompatibilityV1(options),/ERV_HUMAN_SOURCE_TARGET_DENIED/,'the V1 entry never adopts drifted current bytes');
assert.throws(()=>backend.transitionNativeErvHumanSourceCompatibilityV2(options),/ERV_HUMAN_SOURCE_TARGET_DENIED/,'the V2 entry never adopts drifted current bytes');
const taskLedgerBefore=readLocalJournalTaskIdentity(join(f.root,'pan453-owned-v2'));
const fence=sourceFenceV3(join(f.root,'pan453-owned-v2'));try{assert.throws(()=>transitionV3(f),{message:'BTH_JOURNAL_FENCED_DENIED'});}finally{fence.release();}
assert.deepEqual(readLocalJournalTaskIdentity(join(f.root,'pan453-owned-v2')),taskLedgerBefore,'the fence denial adds no human task and drops no pre-existing native task');
preservedV3(f.root,before);sourceV3Results.push({case:'v3-owner-brand-hash-tenant-historical-entry-and-fence-denials',allPriorRowsUnchanged:true,noMetadataAdoption:true,noRoleOrTaskEffects:true});}finally{f.close();}});

test('PAN542 source compatibility v3 released V2 legacy source without a genuine V2 predecessor receipt remains denied rather than silently bridged',async()=>{const f=meteredV3(await fixtureModuleV2.compatibilityFixture());try{const before=allNativeRowsV3(f.root),cur=currentSessionsV3(f.parent,'v3-missing-auth');assert.throws(()=>backend.transitionNativeErvHumanSourceCompatibilityV3({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:cur.sessions}),/ERV_HUMAN_CONFIGURATION_BINDING_DENIED/);preservedV3(f.root,before);sourceV3Results.push({case:'v3-missing-genuine-v2-predecessor',denied:true,allPriorRowsUnchanged:true});}finally{f.close();}});

test('PAN542 source compatibility v3 actual changed current target bytes and forged V3 predecessor catalog remain denied, not caller-adopted source',async()=>{const f=await preservedV3Fixture();try{const before=allNativeRowsV3(f.root);for(const kind of ['target','catalog']){const parent=join(f.parent,'v3-untrusted-'+kind);mkdirSync(parent,{mode:0o700});const root=sourceNegativeFixture(process.cwd(),parent),entry=join(root,'src/pan542/native-human-backend.mjs');if(kind==='target')appendFileSync(entry,'\n// untrusted current target drift\n');else{const path=join(root,'src/pan542/source-compatibility-catalog-v3.json'),policy=JSON.parse(readFileSync(path,'utf8'));policy.predecessorPrimary.commit='0'.repeat(40);writeFileSync(path,JSON.stringify(policy));}const untrusted=await import(pathToFileURL(entry));assert.throws(()=>untrusted.transitionNativeErvHumanSourceCompatibilityV3({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessions:f.sessions}),/ERV_HUMAN_SOURCE_(TARGET|CATALOG)_DENIED/);preservedV3(f.root,before);}sourceV3Results.push({case:'v3-actual-target-and-catalog-negatives',bothActualDenials:true,allPriorRowsUnchanged:true,noUntrustedSourceAccepted:true});}finally{f.close();}});

test('PAN542 source compatibility v3 interrupted actual DDL rolls back cleanly, restart commits once, every prior receipt and the decision history survive',async()=>{const f=await preservedV3Fixture();let child;try{const before=allNativeRowsV3(f.root),opts=JSON.stringify(compatibilitySessionOptions(currentSessionsV3(f.parent,'v3-crash-child-auth').authRoot)),root=JSON.stringify(f.root),script=`import {DatabaseSync} from 'node:sqlite';import {createProtectedSessionAdapterV1} from './src/pan527/origin-session-adapter.mjs';import {transitionNativeErvHumanSourceCompatibilityV3} from './src/pan542/native-human-backend.mjs';const original=DatabaseSync.prototype.exec;DatabaseSync.prototype.exec=function(sql){const result=original.call(this,sql);if(sql.startsWith('CREATE TABLE pan542_source_compatibility_v3(')){process.stdout.write('V3_ACTUAL_DDL_REACHED\\n');process.kill(process.pid,'SIGSTOP');}return result;};const sessions=createProtectedSessionAdapterV1(${opts});transitionNativeErvHumanSourceCompatibilityV3({root:${root},owner:'LOCAL_SYNTHETIC_OWNER',sessions});`;
child=spawn(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',b=>{stderr+=b;});
await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('V3_TRANSITION_DDL_NOT_REACHED:'+stderr)),10000);child.stdout.on('data',b=>{out+=b;if(out.includes('V3_ACTUAL_DDL_REACHED')){clearTimeout(timer);resolve();}});child.once('exit',code=>{clearTimeout(timer);reject(Error('V3_CHILD_PREMATURE_EXIT:'+code+':'+stderr));});});
const ended=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));child.kill('SIGKILL');const actual=await ended;assert.equal(actual.signal,'SIGKILL');
preservedV3(f.root,before);
assert.throws(()=>backend.createNativeErvHumanBackendV1({root:f.root,sessions:f.sessions}),/ERV_HUMAN_CONFIGURATION_BINDING_DENIED/,'an interrupted transition leaves no half state');
const receipt=transitionV3(f);assert.deepEqual(transitionV3(f),receipt);
const restart=spawnSync(process.execPath,['--input-type=module','-e',`import {createProtectedSessionAdapterV1} from './src/pan527/origin-session-adapter.mjs';import {transitionNativeErvHumanSourceCompatibilityV3} from './src/pan542/native-human-backend.mjs';const sessions=createProtectedSessionAdapterV1(${opts});const receipt=transitionNativeErvHumanSourceCompatibilityV3({root:${root},owner:'LOCAL_SYNTHETIC_OWNER',sessions});console.log(receipt.transitionDigest);`],{cwd:process.cwd(),encoding:'utf8'});
assert.equal(restart.status,0,restart.stderr);assert.equal(restart.stdout.trim(),receipt.transitionDigest,'restart is an idempotent revalidation, never a second commit');
assert.equal(nativeRows(f.root,'SELECT count(*) AS n FROM pan542_source_compatibility_v3')[0].n,1);assert.deepEqual(allNativeRowsV3(f.root).pan542_source_compatibility_v1,before.pan542_source_compatibility_v1);assert.deepEqual(allNativeRowsV3(f.root).pan542_source_compatibility_v2,before.pan542_source_compatibility_v2);assert.deepEqual(allNativeRowsV3(f.root).pan542_events,before.pan542_events);sourceV3Results.push({case:'v3-interrupted-ddl-rollback-restart-once',rollbackClean:true,committedOnce:true});}finally{if(child?.exitCode===null)child.kill('SIGKILL');f.close();}});


// Retired duplicate v2-transition block (commented in run124, removed here): its released-V2 history coverage
// runs live in the "v2 history" tests above and the current-source coverage in the explicit v3 tests above.
