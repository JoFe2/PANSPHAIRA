// PAN692 bounded adapter: one closed deviation type (SUPPLIER_PRICE_VARIANCE)
// over code-owned local synthetic data. It runs the actual pinned external KS
// procurement computation over an explicitly mapped minimized native basis,
// binds the resulting authority-free finding to source/scope/revision and,
// only after one separate explicit confirmation, dispatches the existing
// PAN542 native QUERY. Rights come only from PAN542 sessions/roles, never
// from KS text, digests or labels.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {digest, fail} from '../pan473/scope-profile.mjs';
import {readPan516Procurement} from '../procurement-434/bestellung-lifecycle.mjs';
import {evaluatePan516ProcurementLiabilitySnapshot} from '../procurement-434/bestellung-liability.mjs';
import {isProtectedSessionAdapterV1} from '../pan527/origin-session-adapter.mjs';
import * as backend from './native-human-backend.mjs';

const KS_FILE='services/bi-control/src/business-bi/procurement-analysis.mjs';
const KS_COMMIT='5550c603b005c9c168f39f4047b1b46d2c076409';
const KS_FILE_SHA='7eb01232c7ae93f42e9fa390f20acae26e543b6f0970a1b31567acfc3b957cf6';
const COMMON_PATH='contracts/trade/common-trade-01-v1.json';
const INVOICE_CASES_PATH='contracts/trade/pan516-invoice-cases-v1.json';
// Closed code-owned invoice bindings; callers cannot select module paths.
const INVOICE_IDS=['AP-PAN516-MATCHED-01','AP-PAN516-PARTIAL-01'];

function closed(value,keys,code){
  if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)fail(code);
  const ds=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(ds).length!==keys.length||Reflect.ownKeys(ds).some(k=>typeof k!=='string'||!keys.includes(k))
    ||Object.values(ds).some(d=>!d.enumerable||!('value' in d)))fail(code);
}
function frozen(value){if(value&&typeof value==='object'){for(const v of Object.values(value))frozen(v);Object.freeze(value);}return Object.freeze(value);}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readOwn=path=>readFileSync(new URL('../../'+path,import.meta.url));

export async function createNativeKsPriceVarianceQueryV1(options){
  closed(options,['root','sessions','ksSourceRoot'],'KS_PRICE_VARIANCE_OPTIONS_DENIED');
  const {root,sessions,ksSourceRoot}=options;
  if(!isProtectedSessionAdapterV1(sessions,sessions?.binding?.tenantId))fail('KS_PRICE_VARIANCE_SESSION_OWNER_REQUIRED_DENIED');
  if(typeof ksSourceRoot!=='string'||!ksSourceRoot.startsWith('/'))fail('KS_PRICE_VARIANCE_SOURCE_ROOT_DENIED');
  const git=args=>execFileSync('git',['-c','safe.directory='+ksSourceRoot,...args],{cwd:ksSourceRoot,encoding:'utf8',timeout:10000}).trim();
  const ksFile=join(ksSourceRoot,KS_FILE);
  // HEAD/dirty/file-sha are re-checked before every KS execution, so a source
  // changed after prepare/creation is never attested as unchanged.
  const verifyKs=()=>{
    let head='';let dirty='';
    try{head=git(['rev-parse','--verify','HEAD']);dirty=git(['status','--porcelain=v1','--untracked-files=no']);}catch{fail('KS_PRICE_VARIANCE_SOURCE_PROVENANCE_DENIED');}
    if(head!==KS_COMMIT||dirty!=='')fail('KS_PRICE_VARIANCE_PINNED_SOURCE_DENIED');
    if(sha(readFileSync(ksFile))!==KS_FILE_SHA)fail('KS_PRICE_VARIANCE_PINNED_SOURCE_DENIED');
  };
  verifyKs();
  // Single pinned code-owned KS entry. Only the exact hash-verified bytes read
  // here are executed (data: module with its allowed node:util import); the
  // path is never re-read at execution time, so no verify/import swap can slip
  // different bytes in. No generic source loader, no caller-selected import.
  const ksBytes=readFileSync(ksFile);
  if(sha(ksBytes)!==KS_FILE_SHA)fail('KS_PRICE_VARIANCE_PINNED_SOURCE_DENIED');
  const {deriveProcurementV1}=await import('data:text/javascript;base64,'+ksBytes.toString('base64'));
  if(typeof deriveProcurementV1!=='function')fail('KS_PRICE_VARIANCE_ENTRY_DENIED');
  // Pure read-only attachment to the already correctly initialized native owner.
  // Startup/initialization stays with the trusted native owner; this adapter
  // never initializes or adopts state (no catch-and-ignore adoption). A missing
  // or foreign binding denies here via the native owner's own guards.
  const api=backend.createNativeErvHumanBackendV1({root,sessions});

  function candidateFor(headers,invoiceId){
    if(!INVOICE_IDS.includes(invoiceId))fail('KS_PRICE_VARIANCE_INVOICE_BINDING_DENIED');
    const readback=api.read(headers,{invoiceId});
    const state=readPan516Procurement({root});
    const liability=evaluatePan516ProcurementLiabilitySnapshot({state,invoiceId,expectedConfirmationRevision:state.confirmations.at(-1)?.revision});
    const last=state.confirmations.at(-1);
    const ownInvoice=JSON.parse(readOwn(INVOICE_CASES_PATH)).invoices.find(invoice=>invoice.id===invoiceId);
    // Explicit mapping into the closed admitted COMMON grain: the code-owned
    // PAN516 invoice keeps its own identity and the native confirmed unit
    // price replaces the source PO net price. This is a minimized native
    // basis, not a claim that AP-01 and AP-PAN516-* are the same source.
    const input=JSON.parse(readOwn(COMMON_PATH));
    const commonInvoice=input.purchase_invoice;
    input.purchase_order.unit_net_minor=last.terms.unitPriceMinor;
    input.purchase_invoice=ownInvoice;
    verifyKs();
    const ksResult=deriveProcurementV1(input);
    const price=ksResult.lines[0].price;
    if(price.status!=='KNOWN'||!Number.isSafeInteger(price.varianceMinor))fail('KS_PRICE_VARIANCE_UNKNOWN_DENIED');
    // Independent target comparison against the native liability evaluator;
    // a disagreement leaves nothing bindable.
    if(price.varianceMinor!==liability.varianceMinor)fail('KS_PRICE_VARIANCE_TARGET_MISMATCH_DENIED');
    const core={schemaVersion:'pansphaira.ks-price-variance/candidate/v1',deviationType:'SUPPLIER_PRICE_VARIANCE',
      invoiceId,unit:last.terms.currency,amountMinor:price.varianceMinor,authority:false,
      invoiceSource:liability.source.invoiceSource,
      mapping:{declared:'purchase_order.unit_net_minor replaced by native confirmed unitPriceMinor '+last.terms.unitPriceMinor
        +'; purchase_invoice '+commonInvoice.id+' replaced by code-owned '+invoiceId+'; scope/receipts unchanged COMMON reference',
        sourceQuoted:false,identityEquivalence:invoiceId+' (line '+ownInvoice.line_id+' of '+INVOICE_CASES_PATH+') IS NOT COMMON '+commonInvoice.id,
        common:{id:commonInvoice.id,lineId:commonInvoice.lineId??commonInvoice.line_id,poId:commonInvoice.po_id,fileSha256:sha(readOwn(COMMON_PATH))}},
      ks:{outcome:ksResult.outcome,varianceMinor:price.varianceMinor,profile:ksResult.profile,
        binding:{commit:KS_COMMIT,file:KS_FILE,fileSha256:KS_FILE_SHA},mutationAuthority:ksResult.mutationAuthority},
      nativeBasis:{nativeRevision:readback.nativeRevision,nativeBindingDigest:readback.nativeBindingDigest,
        basisDigest:readback.basisDigest,confirmationRevision:last.revision,confirmationDigest:last.confirmationDigest,
        expectedAmountMinor:liability.expectedAmountMinor},
      proposalBinding:{proposalDigest:readback.proposalDigest,proposalRevision:readback.proposalRevision},
      // QUERY needs an actual deviation, a QUERY-capable state and the mapped
      // reviewer role; a pending or wrong-role readback never claims allowed.
      queryAllowed:price.varianceMinor!==0&&readback.nativeRole==='REVIEWER'
        &&['REVIEW_REQUIRED','REVIEWED_LOCAL_EVIDENCE_ONLY','STALE_NATIVE_BASIS_REVIEW_REQUIRED'].includes(readback.state),
      // The candidate is issued to one authenticated subject/session scope; a
      // foreign confirm recomputes a different digest and never binds it.
      preparedBy:{subjectId:readback.subjectId,nativeRole:readback.nativeRole,identityDigest:readback.sessionBinding.identityDigest},
      // Honest boundary: the closed native QUERY command has no reason field,
      // so only this adapter receipt carries the explanation text.
      explanationPersistence:'ADAPTER_RECEIPT_ONLY_NOT_NATIVE_DECISION_STORAGE',
      explanation:'KS procurement P2P price variance '+price.varianceMinor+' '+last.terms.currency
        +' minor for '+invoiceId+': confirmed native unit price '+last.terms.unitPriceMinor
        +' x invoiced '+liability.invoicedQuantity+' against invoice net '+liability.source.invoiceAmountMinor+'.'};
    // The candidate digest binds finding, source, invoice, session scope and
    // native/proposal revision; the handle is a code-owned reference into it,
    // so any drift yields a different digest and a different handle.
    const candidateDigest=digest(core);
    const candidateHandle='synthetic:ks692-'+candidateDigest.slice(8,24);
    // Each candidate gets its own single-use effect identity derived from the
    // digest, so a repeat confirmation never silently replays the old effect.
    const queryEffectId='synthetic:ks692-query-'+candidateDigest.slice(8,24);
    return {core,candidateDigest,candidateHandle,queryEffectId,readback};
  }
  function receipt(prepared){
    const candidate=frozen({...prepared.core,candidateHandle:prepared.candidateHandle,candidateDigest:prepared.candidateDigest,
      queryEffectId:prepared.queryEffectId});
    return {candidate,candidateHandle:candidate.candidateHandle,candidateDigest:candidate.candidateDigest};
  }

  return frozen({
    prepare(headers,request){
      closed(request,['invoiceId'],'KS_PRICE_VARIANCE_PREPARE_DENIED');
      return receipt(candidateFor(headers,request.invoiceId));
    },
    confirm(headers,request){
      closed(request,['candidateHandle','candidateDigest','confirm'],'KS_PRICE_VARIANCE_CONFIRM_DENIED');
      if(request.confirm!==true||typeof request.candidateHandle!=='string'||typeof request.candidateDigest!=='string')fail('KS_PRICE_VARIANCE_CONFIRM_DENIED');
      if(!/^synthetic:ks692-[0-9a-f]{16}$/.test(request.candidateHandle))fail('KS_PRICE_VARIANCE_CONFIRM_DENIED');
      // At-commit the candidate is recomputed for every closed binding from the
      // current native state and the authenticated subject; only an exact digest
      // AND handle match of one recomputed candidate owned by this subject is
      // bindable. A tampered/foreign/stale handle or a drifted native basis
      // denies here, before any dispatch.
      const recomputed=INVOICE_IDS.map(invoiceId=>candidateFor(headers,invoiceId));
      const prepared=recomputed.find(candidate=>candidate.candidateDigest===request.candidateDigest
        &&candidate.candidateHandle===request.candidateHandle);
      if(!prepared)fail('KS_PRICE_VARIANCE_CONFIRM_STALE_OR_FOREIGN_DENIED');
      if(prepared.readback.subjectId!==sessions.authorizeMutation(headers).subjectId)fail('KS_PRICE_VARIANCE_FOREIGN_CANDIDATE_DENIED');
      if(!prepared.core.queryAllowed)fail('KS_PRICE_VARIANCE_NO_QUERY_ALLOWED_DENIED');
      const bound=prepared.core.proposalBinding;
      return api.decide(headers,{schemaVersion:'pansphaira.erv-human/decision/v1',invoiceId:prepared.core.invoiceId,
        effectId:prepared.queryEffectId,transportId:'synthetic:ks692-wire-'+prepared.candidateDigest.slice(8,24),
        expectedNativeRevision:prepared.readback.nativeRevision,expectedProposalRevision:bound.proposalRevision,
        proposalDigest:bound.proposalDigest,action:'QUERY'},
        before=>{
          // At-commit the pinned KS source is re-verified byte-exact: the real
          // BEGIN IMMEDIATE can wait, and a source drifted after the candidate
          // was recomputed must never be attested by the owner commit callback.
          verifyKs();
          if(before.proposalDigest!==bound.proposalDigest||before.basisDigest!==prepared.core.nativeBasis.basisDigest)fail('KS_PRICE_VARIANCE_COMMIT_RACE_DENIED');
        });
    },
    read(headers,request){return api.read(headers,request);},
    reconcile(headers,request){return api.reconcile(headers,request);},
  });
}
