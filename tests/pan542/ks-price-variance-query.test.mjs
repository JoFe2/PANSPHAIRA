// PAN692 synthetic partial increment: one real existing KS price-variance
// computation over a code-owned native basis, then one explicitly confirmed
// existing native PAN542 QUERY effect. No new metric kernel, store or rights.
import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync,mkdirSync,readFileSync,cpSync,appendFileSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {financeFixture} from '../pan519/native-fixture.mjs';
import {nativeRows} from '../fixtures/pan515/native-trade-fixture.mjs';
import * as procurement from '../../src/procurement-434/bestellung-lifecycle.mjs';
import {readLocalJournalTaskIdentity,recordLocalJournalControl} from '../../demo/runtime/local-journal-owner.mjs';
import {readMarker} from '../../src/pan473/scope-profile.mjs';
import * as nativeBackend from '../../src/pan542/native-human-backend.mjs';
import * as protectedSessions from '../../src/pan527/origin-session-adapter.mjs';
const {createProtectedSessionAdapterV1}=protectedSessions;

// Exact pinned code-owned KS producer checkout (public main at authoring time).
const KS_COMMIT='5550c603b005c9c168f39f4047b1b46d2c076409';
const KS_FILE='services/bi-control/src/business-bi/procurement-analysis.mjs';
const KS_FILE_SHA='7eb01232c7ae93f42e9fa390f20acae26e543b6f0970a1b31567acfc3b957cf6';
const invoiceId='AP-PAN516-MATCHED-01';

const identity={schemaVersion:'pansphaira.portable-runtime/identity/v1',componentId:'pansphaira-local-demo',
  sourceCommit:'27a9103e7a481cca954bfa73745fc3b5b54cbd15',sourceTree:'3216db95d1164b3ecab2e6ecf96ae8797aed57ab',
  imageDigest:'sha256:'+'a'.repeat(64),architecture:'x86_64',productVersion:'0.2.0-poc.20260810.5',
  runtime:{name:'node',version:'24.14.1'},contractVersion:'1.0.0',instanceId:'pan542-native-human-local',tenantId:'tenant-a',generation:1,
  configurationDigest:'b'.repeat(64),templateDigest:'c'.repeat(64),policyDigest:'d'.repeat(64),networkDigest:'e'.repeat(64),authorityProfile:'SAFE_GUIDED',
  effectiveRights:['demo.status.read','demo.provider.bound.read','demo.governed.effect']};
const sessionOptions=stateRoot=>({optIn:true,origin:'https://pan542.test:4443',identity,stateRoot});
function issue(sessions,subjectId,role='reviewer'){
  const s=sessions.issueOwnerSession({subjectId,role,expiresAtMs:Date.now()+60000});
  return {cookie:s.cookieHeader,origin:sessions.origin,'x-pan527-csrf':s.csrf};
}

function ksSource(){
  const root=process.env.KS692_KS_SOURCE;
  assert.equal(typeof root,'string','KS692_KS_SOURCE must name the actual pinned KS producer checkout; no stub or skip');
  const git=a=>execFileSync('git',['-c','safe.directory='+root,...a],{cwd:root,encoding:'utf8'}).trim();
  assert.equal(git(['rev-parse','--verify','HEAD']),KS_COMMIT,'PAN692_KS_HEAD_MISMATCH');
  assert.equal(git(['status','--porcelain=v1','--untracked-files=no']),'','PAN692_KS_DIRTY_CHECKOUT');
  const file=join(root,KS_FILE);
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),KS_FILE_SHA,'PAN692_KS_FILE_SHA_MISMATCH');
  return root;
}

function ownInvoiceSource(){
  const path='contracts/trade/pan516-invoice-cases-v1.json';
  const raw=readFileSync(new URL('../../'+path,import.meta.url));
  return {path,sha256:createHash('sha256').update(raw).digest('hex'),locator:path+'#'+invoiceId};
}

async function fixture(){
  const f=await financeFixture();
  try{
    const ksRoot=ksSource();
    const authRoot=join(f.parent,'ks-query-session-state');
    mkdirSync(authRoot,{mode:0o700});
    const sessions=createProtectedSessionAdapterV1(sessionOptions(authRoot));
    const adapter=existsSync(new URL('../../src/pan542/ks-price-variance-query.mjs',import.meta.url))
      ?await import('../../src/pan542/ks-price-variance-query.mjs'):null;
    assert.equal(typeof adapter?.createNativeKsPriceVarianceQueryV1,'function','PAN692_KS_PRICE_VARIANCE_QUERY_ADAPTER_NOT_IMPLEMENTED');
    const q=await adapter.createNativeKsPriceVarianceQueryV1({root:f.root,sessions,ksSourceRoot:ksRoot});
    return {...f,sessions,q,reviewer:issue(sessions,'synthetic:erv-reviewer'),approver:issue(sessions,'synthetic:erv-approver')};
  }catch(e){f.close();throw e;}
}
function confirmNativePrice(f,unitPriceMinor,tag='price-confirm'){
  const native=procurement.readPan516Procurement({root:f.root}),last=native.confirmations.at(-1);
  const command={schemaVersion:'pansphaira.pan516/procurement-command/v1',effectId:'synthetic:ks692-'+tag,transportId:'synthetic:ks692-'+tag+'-wire',
    expectedRevision:native.revision,orderId:native.binding.draft.bestellungId,positionId:native.binding.draft.positionen[0].positionId,
    supplierId:native.binding.draft.lieferantId,kind:'CONFIRM',receipt:null,sourceReference:'synthetic:ks692-'+tag+'-source',
    confirmation:{revision:last.revision+1,previousConfirmationDigest:last.confirmationDigest,terms:{...last.terms,unitPriceMinor},confirmedAt:'2026-06-22T08:00:00Z'}};
  procurement.executePan516ProcurementCommand({root:f.root,command,grant:procurement.authorizePan516ProcurementCommand({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',command})});
}

test('PAN692 positive: real existing KS computation over a genuinely confirmed native price change produces a confirmed native QUERY effect with an independent readback',async()=>{
  const f=await fixture();
  try{
    // Own synthetic price deviation via the real existing native CONFIRM chain.
    confirmNativePrice(f,6200);
    const native=procurement.readPan516Procurement({root:f.root});
    const last=native.confirmations.at(-1);
    assert.equal(last.terms.unitPriceMinor,6200);assert.equal(last.revision,2);

    const eventsBefore=nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count;
    const tasksBefore=readLocalJournalTaskIdentity(join(f.root,'pan453-owned-v2'));
    assert.equal(eventsBefore,0);

    const prepared=f.q.prepare(f.reviewer,{invoiceId});
    assert.equal(prepared.candidate.deviationType,'SUPPLIER_PRICE_VARIANCE');
    assert.equal(prepared.candidate.invoiceId,invoiceId);
    // Honest identity: the code-owned PAN516 invoice, never the COMMON AP-01.
    assert.deepEqual(prepared.candidate.invoiceSource,ownInvoiceSource());
    assert.notEqual(prepared.candidate.invoiceSource.locator,'#AP-01');
    // Actual existing KS function result, not a hand-written answer.
    assert.equal(prepared.candidate.ks.outcome,'COMPLETE');
    assert.equal(prepared.candidate.ks.varianceMinor,-2000);
    assert.equal(prepared.candidate.ks.binding.commit,KS_COMMIT);
    assert.equal(prepared.candidate.ks.binding.fileSha256,KS_FILE_SHA);
    // The finding states source, unit and a concrete amount plus the native basis.
    assert.equal(prepared.candidate.amountMinor,-2000);
    assert.equal(prepared.candidate.unit,'EUR');
    assert.equal(prepared.candidate.nativeBasis.nativeRevision,native.revision);
    assert.equal(prepared.candidate.nativeBasis.confirmationRevision,last.revision);
    assert.equal(prepared.candidate.nativeBasis.confirmationDigest,last.confirmationDigest);
    assert.equal(prepared.candidate.authority,false,'a KS finding is never a grant');
    assert.equal(prepared.candidate.queryAllowed,true);
    // Honest receipt: exact IDs, amount, unit and revision bindings; no
    // undefined/NaN; no claim of a natively persisted reason.
    assert.doesNotMatch(JSON.stringify(prepared.candidate),/undefined|NaN/,'PAN692_RECEIPT_HAS_UNBOUND_VALUE');
    assert.equal(prepared.candidate.explanationPersistence,'ADAPTER_RECEIPT_ONLY_NOT_NATIVE_DECISION_STORAGE');
    assert.ok(prepared.candidate.explanation.includes(invoiceId)&&prepared.candidate.explanation.includes('-2000 EUR'));
    assert.equal(prepared.candidate.mapping.sourceQuoted,false);
    assert.ok(prepared.candidate.mapping.identityEquivalence.includes(invoiceId)&&prepared.candidate.mapping.identityEquivalence.includes('AP-01'));
    assert.equal(prepared.candidate.preparedBy.subjectId,'synthetic:erv-reviewer');
    assert.equal(prepared.candidate.preparedBy.nativeRole,'REVIEWER');
    assert.match(prepared.candidate.preparedBy.identityDigest,/^[a-f0-9]{64}$/);
    assert.equal(prepared.candidate.ks.mutationAuthority,false);
    assert.ok(Number.isSafeInteger(prepared.candidate.amountMinor));
    // Before the separate explicit confirmation: zero native query effects.
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0,'PAN692_PREPARE_MUST_NOT_MUTATE');
    assert.deepEqual(readLocalJournalTaskIdentity(join(f.root,'pan453-owned-v2')),tasksBefore);

    // One separate explicit confirmation of the exact candidate digest.
    const pending=f.q.confirm(f.reviewer,{candidateHandle:prepared.candidateHandle,candidateDigest:prepared.candidateDigest,confirm:true});
    assert.equal(pending.state,'QUERY_PENDING_LOCAL_EVIDENCE_ONLY');
    assert.equal(pending.proposalRevision,1);
    assert.equal(pending.executionAuthorityGranted,false);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,1);

    // Independent fresh readback by a different subject/role: every stateful
    // invariant must match, the native role/subject must NOT be faked.
    const fresh=f.q.read(f.approver,{invoiceId});
    const {nativeRole:freshRole,subjectId:freshSubject,...freshRest}=fresh;
    const {nativeRole:pendingRole,subjectId:pendingSubject,...pendingRest}=pending;
    assert.deepEqual(freshRest,pendingRest,'PAN692_INDEPENDENT_READBACK_INVARIANTS_DRIFTED');
    assert.equal(pendingRole,'REVIEWER');assert.equal(pendingSubject,'synthetic:erv-reviewer');
    assert.equal(freshRole,'APPROVER','PAN692_READBACK_ROLE_NOT_NATIVE');
    assert.equal(freshSubject,'synthetic:erv-approver','PAN692_READBACK_SUBJECT_NOT_NATIVE');
    // Reconciliation is bound to the actual single-use native effect identity.
    assert.match(prepared.candidate.queryEffectId,/^synthetic:ks692-query-[0-9a-f]{16}$/);
    const reconciled=f.q.reconcile(f.approver,{invoiceId,effectId:prepared.candidate.queryEffectId});
    assert.equal(reconciled.outcome,'RECONCILED_LOCAL_DECISION_NO_NEW_EFFECT');
    assert.equal(reconciled.newDecisionEffect,false);
    const event=JSON.parse(nativeRows(f.root,'SELECT event FROM pan542_events WHERE ordinal=1')[0].event);
    assert.equal(typeof event.taskBinding?.taskIdentityDigest,'string','PAN692_EXISTING_TASK_FENCE_NOT_PROVEN');
    assert.deepEqual(readLocalJournalTaskIdentity(join(f.root,'pan453-owned-v2')).identities[event.taskBinding.taskIdentityDigest],event.taskBinding);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan516_target_orders')[0].count,0,'no booking or dispatch authority');

    // The native effect key is single-use; a repeat of the same confirmation
    // is either refused at native commit (unchanged basis) or, because the
    // QUERY event itself advanced the native readback, the recomputed
    // candidate no longer binds: stale/foreign denial. Either way the native
    // idempotence contract forbids a second decision effect.
    assert.throws(()=>f.q.confirm(f.reviewer,{candidateHandle:prepared.candidateHandle,candidateDigest:prepared.candidateDigest,confirm:true}),
      /ERV_HUMAN_ALREADY_DECIDED_RECONCILE_REQUIRED|KS_PRICE_VARIANCE_CONFIRM_STALE_OR_FOREIGN_DENIED/);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,1);
    // Reconciling the same actual effect again stays a pure read: no new effect.
    const reconciledAgain=f.q.reconcile(f.reviewer,{invoiceId,effectId:prepared.candidate.queryEffectId});
    assert.equal(reconciledAgain.outcome,'RECONCILED_LOCAL_DECISION_NO_NEW_EFFECT');
    assert.equal(reconciledAgain.newDecisionEffect,false);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,1);
  }finally{f.close();}
});

test('PAN692 denials: confirm shape, handle/digest drift, foreign role and CSRF deny with zero native effects',async()=>{
  const f=await fixture();
  try{
    confirmNativePrice(f,6200);
    const eventsBefore=nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count;
    const tasksBefore=readLocalJournalTaskIdentity(join(f.root,'pan453-owned-v2'));
    const readBefore=f.q.read(f.reviewer,{invoiceId});
    const prepared=f.q.prepare(f.reviewer,{invoiceId});
    const C=(over={})=>f.q.confirm(f.reviewer,{candidateHandle:prepared.candidateHandle,candidateDigest:prepared.candidateDigest,confirm:true,...over});

    // Closed request shapes: unexpected fields and non-true confirm deny.
    assert.throws(()=>f.q.prepare(f.reviewer,{invoiceId,extra:1}),/KS_PRICE_VARIANCE_PREPARE_DENIED/);
    assert.throws(()=>f.q.prepare(f.reviewer,{invoiceId:'AP-OTHER'}),/KS_PRICE_VARIANCE_INVOICE_BINDING_DENIED/);
    assert.throws(()=>C({confirm:false}),/KS_PRICE_VARIANCE_CONFIRM_DENIED/);
    assert.throws(()=>C({extra:1}),/KS_PRICE_VARIANCE_CONFIRM_DENIED/);
    // Wrong handle suffix or wrong digest never bind a dispatch.
    assert.throws(()=>f.q.confirm(f.reviewer,{candidateHandle:'synthetic:ks692-'+'a'.repeat(16),candidateDigest:prepared.candidateDigest,confirm:true}),/KS_PRICE_VARIANCE_CONFIRM_STALE_OR_FOREIGN_DENIED/);
    assert.throws(()=>f.q.confirm(f.reviewer,{candidateHandle:prepared.candidateHandle,candidateDigest:prepared.candidateDigest.slice(0,63)+'0',confirm:true}),/KS_PRICE_VARIANCE_CONFIRM_STALE_OR_FOREIGN_DENIED/);
    // A foreign native role (approver) recomputes a different candidate and cannot bind it.
    assert.throws(()=>f.q.confirm(f.approver,{candidateHandle:prepared.candidateHandle,candidateDigest:prepared.candidateDigest,confirm:true}),/KS_PRICE_VARIANCE_CONFIRM_STALE_OR_FOREIGN_DENIED/);
    // Missing CSRF origin binding denies at mutation authorization, not silently.
    assert.throws(()=>f.q.confirm({...f.reviewer,origin:'https://pan692-evil.test:4443'},{candidateHandle:prepared.candidateHandle,candidateDigest:prepared.candidateDigest,confirm:true}),/HOSTED_CSRF_DENIED/);
    // A tampered session cookie is no session at all.
    assert.throws(()=>f.q.prepare({...f.reviewer,cookie:f.reviewer.cookie.slice(0,-1)+'0'},{invoiceId}),/HOSTED_SESSION_DENIED/);

    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,eventsBefore,'PAN692_DENIAL_CREATED_EFFECT');
    assert.deepEqual(readLocalJournalTaskIdentity(join(f.root,'pan453-owned-v2')),tasksBefore,'PAN692_DENIAL_TOUCHED_FENCE');
    assert.deepEqual(f.q.read(f.reviewer,{invoiceId}),readBefore,'PAN692_DENIAL_DRIFTED_STATE');
  }finally{f.close();}
});

test('PAN692 drift and controls: native price change after prepare, STOP and REVOKE deny confirm with zero effects',async()=>{
  for(const control of [null,'STOP','REVOKE']){
    const f=await fixture();
    try{
      confirmNativePrice(f,6200);
      const prepared=f.q.prepare(f.reviewer,{invoiceId});
      if(control){
        const marker=readMarker(f.root);
        recordLocalJournalControl(control==='STOP'?join(f.root,'pan473-controller','pan453-owned-v2'):join(f.root,'pan453-owned-v2'),
          {kind:control,sourceIdentity:marker.sourceIdentity,targetIdentity:marker.targetIdentity,
            operationKey:control==='REVOKE'?'admin-ai:poc:erv-human:pan542:'+prepared.candidate.queryEffectId:null,
            stopEpoch:1,issuedAtMs:Date.now(),reason:'Synthetic KS692 decision control'});
      }else confirmNativePrice(f,6200,'price-confirm-2');
      assert.throws(()=>f.q.confirm(f.reviewer,{candidateHandle:prepared.candidateHandle,candidateDigest:prepared.candidateDigest,confirm:true}),
        control?/ERV_HUMAN_STOP_OR_REVOKE_DENIED/:/KS_PRICE_VARIANCE_CONFIRM_STALE_OR_FOREIGN_DENIED/,String(control));
      assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0,'PAN692_DENIED_CONFIRM_CREATED_EFFECT');
      const after=f.q.read(f.reviewer,{invoiceId});
      assert.equal(after.state,'REVIEW_REQUIRED');assert.equal(after.nativeRole,'REVIEWER');
    }finally{f.close();}
  }
});

test('PAN692 KS source drift and adapter re-creation: foreign/drifted pinned source and a new instance after real confirmation',async()=>{
  const ksRoot=ksSource();
  // A foreign checkout without the pinned commit/HEAD denies adapter creation.
  const foreign=mkdtempSync(process.env.TMPDIR+'/ks692-foreign-');
  await assert.rejects(()=>import('../../src/pan542/ks-price-variance-query.mjs').then(m=>m.createNativeKsPriceVarianceQueryV1({root:'unused',sessions:{},ksSourceRoot:foreign})),
    /KS_PRICE_VARIANCE_SOURCE_PROVENANCE_DENIED|KS_PRICE_VARIANCE_SESSION_OWNER_REQUIRED_DENIED/);

  const f=await fixture();
  try{
    confirmNativePrice(f,6200);
    // A moved copy whose KS file drifted after checkout is never attested unchanged.
    const drifted=mkdtempSync(process.env.TMPDIR+'/ks692-drifted-')+'/ks';
    execFileSync('cp',['-a',ksRoot+'/.',drifted]);
    execFileSync('chmod',['-R','u+w',drifted]);
    appendFileSync(join(drifted,KS_FILE),'\n// synthetic drift\n');
    const {createNativeKsPriceVarianceQueryV1}=await import('../../src/pan542/ks-price-variance-query.mjs');
    mkdirSync(join(f.parent,'ks-query-session-state-2'),{mode:0o700});
    const sessions2=createProtectedSessionAdapterV1(sessionOptions(join(f.parent,'ks-query-session-state-2')));
    await assert.rejects(()=>createNativeKsPriceVarianceQueryV1({root:f.root,sessions:sessions2,ksSourceRoot:drifted}),/KS_PRICE_VARIANCE_PINNED_SOURCE_DENIED/);

    const prepared=f.q.prepare(f.reviewer,{invoiceId});
    const pending=f.q.confirm(f.reviewer,{candidateHandle:prepared.candidateHandle,candidateDigest:prepared.candidateDigest,confirm:true});
    assert.equal(pending.state,'QUERY_PENDING_LOCAL_EVIDENCE_ONLY');

    // A new backend instance over the same store reads and reconciles, but the
    // old confirmation cannot replay and the KS adapter cannot re-initialize.
    const fresh=await createNativeKsPriceVarianceQueryV1({root:f.root,sessions:f.sessions,ksSourceRoot:ksRoot})
      .then(()=>'RESOLVED',e=>e.message);
    assert.equal(fresh,'ERV_HUMAN_EXISTING_STORE_ADOPTION_DENIED','PAN692_ADAPTER_REINITIALIZATION_MUST_DENY');
    const api=nativeBackend.createNativeErvHumanBackendV1({root:f.root,sessions:f.sessions});
    const {nativeRole:r1,subjectId:s1,...freshRest}=api.read(f.approver,{invoiceId});
    const {nativeRole:r2,subjectId:s2,...pendingRest}=pending;
    assert.deepEqual(freshRest,pendingRest,'PAN692_INDEPENDENT_NATIVE_GET_DRIFTED');
    assert.equal(r1,'APPROVER');assert.equal(s1,'synthetic:erv-approver');
    assert.equal(r2,'REVIEWER');assert.equal(s2,'synthetic:erv-reviewer');
    const rec=api.reconcile(f.approver,{invoiceId,effectId:prepared.candidate.queryEffectId});
    assert.equal(rec.outcome,'RECONCILED_LOCAL_DECISION_NO_NEW_EFFECT');
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,1);
    assert.throws(()=>api.decide(f.reviewer,{schemaVersion:'pansphaira.erv-human/decision/v1',invoiceId,
      effectId:prepared.candidate.queryEffectId,transportId:'synthetic:ks692-replay',expectedNativeRevision:pending.nativeRevision,
      expectedProposalRevision:1,proposalDigest:pending.proposalDigest,action:'QUERY'}),/ERV_HUMAN_ALREADY_DECIDED_RECONCILE_REQUIRED/);
    assert.equal(nativeRows(f.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,1);
  }finally{f.close();}
});
