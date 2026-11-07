// PAN575 opt-in real-local-model qualification entrypoint. It reuses the
// EXISTING native565 owner (session/profile/consent/transport/cost ledger),
// the EXISTING broker/tool-feedback loop and the EXISTING Original574 native
// tools through the owner composition admission API
// (createNativeCompositionFeedbackModelV1 / prepareNativeCompositionFeedbackV1 /
// runNativeCompositionFeedbackV1) — no second harness, no second ledger, no
// fake deterministic model. Synthetic fixture suites stay SYNTHETIC_ONLY and
// are never relabelled as model acceptance here (receipt keeps
// realModelAcceptance:false). Every success verdict here is a bounded
// owner-bound transport/tool-loop OBSERVATION only: neither a config label nor
// a scripted/locally-listening provider response proves deployment/model
// provenance — that remains a separate parent-bound real-model proof.
// Durable accounting/unknown-usage reconciliation IS integrated through the
// owner's per-principal SQLite cost ledger: whole-run reservation persisted
// BEFORE dispatch, owner-derived settlement, UNKNOWN holds retained across
// owner reopen; the receipt reports the actual observed reservation states.
// Durability across the reopen is an ACCOUNTING PREDICATE over the ACTUAL
// before-close and after-reopen snapshots of the exact operation (genuine
// reservation states, complete safe-integer accounting, exact unchanged
// reserved/consumed tuple inside the owner ceilings) — NEVER an equality of
// two state labels: two NO_RESERVATION or two OBSERVATION_UNAVAILABLE
// observations, or equal-but-corrupt fields, prove nothing and can never
// produce the exit-0 observation.
// This is still a bounded observation utility, not full issue delivery.
// Actual inference is explicitly opt-in (consent env + bounded config);
// nothing here runs by default in CI. Exit codes: 0 owner-bound composition
// loop observed and ledger-settled (NOT model acceptance), 1 unqualified
// completion, 2 loop DENIED or a retained-UNKNOWN ledger deny of redispatch,
// 3 loop BUDGET_ABORTED, 4 REAL_MODEL_CONSENT_MISSING, 5 config/binding/state
// denied, 6 bounded phase check failed before inference (INFERENCE stays
// NOT_RUN).
// Composition wire identity (corrects the stale run04 note): dispatch is
// owner-driven and the owner's closed transport adapter owns the wire
// presentation. The exact Original574 pair reaches the provider ONLY through
// the code-owned closed composition alias (MODEL_COMPOSITION_WIRE_ALIAS_V1:
// pan522_material_plan / erp_order_create); the dotted native identities stay
// native-side and are restored from provider responses by that same closed
// mapping. This utility renames nothing itself: a provider that rejects the
// alias pair denies the run as a bounded LOOP_PROVIDER_DENIED with the ledger
// hold retained (never a silent fallback to dotted names, never a widened
// catalog); that interop boundary is reported, not hidden.
import {createHash,randomBytes} from 'node:crypto';
// Node's ESM 'node:fs' module exports the open flags ONLY inside the
// `constants` object — there are no top-level O_* ESM exports, so the run08
// named-import list crashed this entrypoint with exit 1 before any test even
// started. Destructure the needed O_* flags from the real `constants` export.
import {readFileSync,realpathSync,openSync,writeSync,fchmodSync,ftruncateSync,fstatSync,lstatSync,closeSync,unlinkSync,constants} from 'node:fs';
const {O_WRONLY,O_CREAT,O_EXCL,O_NOFOLLOW}=constants;
import {resolve,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {canonicalJson} from '../dist/packages/contracts/src/canonical-json.js';
import {validateModelConnectionLimitsV1,validateModelConnectionSummaryV1} from '../dist/packages/contracts/src/workspace-model-connection-v1.js';
import {defaultBrowserProfileV1} from '../dist/packages/contracts/src/browser-profile-v1.js';
import {bindModelConnectionTransportV1,connectionTransportIdentityV1,MODEL_CONNECTION_COMPOSITION_PURPOSE_V1,MODEL_COMPOSITION_WIRE_ALIAS_V1} from '../src/pan565/connection-transport.mjs';
import {createNativeModelConnectionV1,MODEL_CONNECTION_TEST_DATA_DIGEST_V1,MODEL_CONNECTION_COMPOSITION_TEST_DATA_DIGEST_V1,MODEL_CONNECTION_COMPOSITION_CAPABILITIES_V1,createNativeCompositionFeedbackModelV1,prepareNativeCompositionFeedbackV1,runNativeCompositionFeedbackV1} from '../src/pan565/native-model-connection.mjs';
import {createProtectedSessionAdapterV1,validateHostedOriginV1} from '../src/pan527/origin-session-adapter.mjs';
import {validateRuntimeIdentityV1} from '../src/pan526/runtime-contract.mjs';
import {createBrowserProfileStoreV1} from '../src/pan543/profile-store.mjs';
const sha=v=>createHash('sha256').update(canonicalJson(v)).digest('hex');
const shaRaw=v=>createHash('sha256').update(v).digest('hex');
const atom=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,95}$/.test(v)&&!/(?:sk-|password|api[_-]?key|access[_-]?token|https?:|\.\.)/i.test(v);
const CONSENT='REAL_LOCAL_MODEL_RUN_V1',ROUTE_ID='route:local-openai-chat-completions',PROVIDER='provider:local-inference-sandbox',CREDENTIAL_HANDLE='credential-handle:local-model-secret-file';
// The owner ledger ceiling is fixed at {modelUnits:100000, runtimeUnits:3}
// per principal (native-model-connection.mjs); the utility config must stay
// inside it so a reserve can never exceed the existing durable caps.
const LEDGER_MAX_COST_MICROS=100000,LEDGER_MAX_REQUESTS=3;
export const QUALIFICATION_LEDGER_DIR_PREFIX_V1='native-model-budget-';
// The owner's OWN principal-key derivation (native-model-connection.mjs):
// canonical hash of the authenticated tenant/subject/instance/generation tuple.
export const ownerLedgerPrincipalKeyV1=principal=>sha({tenantId:principal.tenantId,subjectId:principal.subjectId,instanceId:principal.instanceId,generation:principal.generation});
// The ONE accounting predicate for a genuine owner-derived reservation row:
// a closed owner state with COMPLETE safe-integer unit fields, non-negative,
// consumed never exceeding reserved, reserved units inside the FIXED owner
// ledger ceilings (the owner reserves at most maxCostMicros<=100000 over at
// most 3 runtime units, native-model-connection.mjs). A RESERVED or
// UNKNOWN_USAGE row carries no consumption yet — any other shape is
// corruption, not an accounting observation.
function isOwnerLedgerAccountingAdmissibleV1(state,modelUnits,runtimeUnits,modelConsumed,runtimeConsumed){
  if(!['RESERVED','UNKNOWN_USAGE','SETTLED'].includes(state))return false;
  for(const v of [modelUnits,runtimeUnits,modelConsumed,runtimeConsumed])if(!Number.isSafeInteger(v))return false;
  if(modelUnits<1||runtimeUnits<1||modelUnits>LEDGER_MAX_COST_MICROS||runtimeUnits>LEDGER_MAX_REQUESTS)return false;
  if(modelConsumed<0||runtimeConsumed<0||modelConsumed>modelUnits||runtimeConsumed>runtimeUnits)return false;
  if(state!=='SETTLED'&&(modelConsumed!==0||runtimeConsumed!==0))return false;
  return true;
}
// The durability PROOF over the TWO actual snapshots of the SAME exact
// operation across the close/reopen: BOTH independently carry admissible
// owner accounting AND the complete {state,reserved,consumed} tuple is
// identical. NO_RESERVATION and OBSERVATION_UNAVAILABLE carry no accounting
// at all — even when equal twice — and equal-but-corrupt fields are never
// promoted: only genuine reservation snapshots can satisfy this predicate.
export function ownerLedgerReservationDurableAcrossReopenV1(beforeClose,afterReopen){
  const tuple=s=>s&&typeof s==='object'&&!Array.isArray(s)?{state:s.state,modelUnits:s.modelUnits,runtimeUnits:s.runtimeUnits,modelConsumed:s.modelConsumed,runtimeConsumed:s.runtimeConsumed}:null;
  const a=tuple(beforeClose),b=tuple(afterReopen);
  if(!a||!b)return false;
  if(!isOwnerLedgerAccountingAdmissibleV1(a.state,a.modelUnits,a.runtimeUnits,a.modelConsumed,a.runtimeConsumed))return false;
  if(!isOwnerLedgerAccountingAdmissibleV1(b.state,b.modelUnits,b.runtimeUnits,b.modelConsumed,b.runtimeConsumed))return false;
  return canonicalJson(a)===canonicalJson(b);
}
// Read-only observation of the owner's EXISTING durable cost ledger for EXACTLY
// the bound authenticated principal, its exact current identity digest and one
// exact operation. The path is derived with the owner's own algorithm
// (native-model-budget- + canonical hash of principalKey + ':' + identityDigest
// from the persisted profile row) and the query binds the exact operation_id.
// No directory enumeration, no SELECT-all, no foreign rows, no directory-derived
// operation ids. Fail-closed: a symlink anywhere on the ledger path is never
// followed; a missing ledger directory/file/row is NO_RESERVATION while an
// unreadable one is OBSERVATION_UNAVAILABLE — the two states stay DISTINCT and
// unavailable is never reported as NO_RESERVATION or as an accounting pass.
export function observeOwnerLedgerReservationV1({stateDir,sessions,profiles,headers,operationId}){
  const none=Object.freeze({state:'OBSERVATION_UNAVAILABLE',modelUnits:null,runtimeUnits:null,modelConsumed:null,runtimeConsumed:null});
  const missing=Object.freeze({state:'NO_RESERVATION',modelUnits:null,runtimeUnits:null,modelConsumed:null,runtimeConsumed:null});
  try{
    if(typeof operationId!=='string'||!/^operation:[a-z0-9][a-z0-9._-]{2,63}$/.test(operationId))return none;
    const principal=sessions.authenticate(headers);
    const row=profiles.readModelConnection(principal);
    const identityDigest=row?.state?.identityDigest;
    if(typeof identityDigest!=='string'||!/^[a-f0-9]{64}$/.test(identityDigest))return missing;
    const dir=join(stateDir,QUALIFICATION_LEDGER_DIR_PREFIX_V1+sha(ownerLedgerPrincipalKeyV1(principal)+':'+identityDigest));
    let dirStat;try{dirStat=lstatSync(dir);}catch(error){return error?.code==='ENOENT'?missing:none;}
    if(dirStat.isSymbolicLink()||!dirStat.isDirectory())return none;
    const file=join(dir,'resource-budget.sqlite');
    let fileStat;try{fileStat=lstatSync(file);}catch(error){return error?.code==='ENOENT'?missing:none;}
    if(fileStat.isSymbolicLink()||!fileStat.isFile())return none;
    let db;try{
      db=new DatabaseSync(file,{readOnly:true});
      const r=db.prepare('SELECT state,model_units,runtime_units,model_consumed,runtime_consumed FROM reservations WHERE operation_id=?').get(operationId);
      if(!r)return missing;
      // Fail-closed on malformed accounting: a row that does not carry the
      // complete, admissible owner unit tuple (see the accounting predicate)
      // is corruption, reported as OBSERVATION_UNAVAILABLE — never promoted
      // into an accounting observation, however plausible its state label.
      if(!isOwnerLedgerAccountingAdmissibleV1(r.state,r.model_units,r.runtime_units,r.model_consumed,r.runtime_consumed))return none;
      return Object.freeze({state:r.state,modelUnits:r.model_units,runtimeUnits:r.runtime_units,modelConsumed:r.model_consumed,runtimeConsumed:r.runtime_consumed});
    }catch{return none;}finally{try{db?.close();}catch{}}
  }catch{return none;}
}
function deny(exitCode,reason){const e=Error(reason);e.qualificationExit=exitCode;e.qualificationReason=reason;throw e;}
function closed(v,keys){return v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&canonicalJson(Object.keys(v).sort())===canonicalJson([...keys].sort());}
const ownerErrorCode=error=>{const m=String(error?.message??'');return /^MODEL_CONNECTION_[A-Z_]+$/.test(m)?m.slice(0,64):'MODEL_CONNECTION_OWNER_DENIED';};
export async function runLocalModelQualificationV1({configPath,env=process.env,now=Date.now}){
  if(env.PAN575_LOCAL_MODEL_QUALIFICATION!==CONSENT)deny(4,'REAL_MODEL_CONSENT_MISSING');
  let config;try{config=JSON.parse(readFileSync(configPath,'utf8'));}catch{deny(5,'QUALIFICATION_CONFIG_UNREADABLE');}
  const startedAt=now();
  if(!closed(config,['origin','model','deploymentId','configurationRevision','credentialFile','receiptDir','stateDir','sessionOrigin','runtimeIdentityPath','sessionSubject','pricing','limits','expectedTestDataDigest','expiresAtMs']))deny(5,'QUALIFICATION_CONFIG_DENIED');
  if(typeof config.origin!=='string'||!/^http:\/\/127\.0\.0\.1:[0-9]{2,5}$/.test(config.origin))deny(5,'QUALIFICATION_TARGET_DENIED');
  if(!atom(config.model)||!atom(config.deploymentId)||!Number.isSafeInteger(config.configurationRevision)||config.configurationRevision<1)deny(5,'QUALIFICATION_IDENTITY_DENIED');
  if(typeof config.credentialFile!=='string'||!config.credentialFile.startsWith('/'))deny(5,'QUALIFICATION_SECRET_PATH_DENIED');
  let limits;try{limits=validateModelConnectionLimitsV1(config.limits);}catch{deny(5,'QUALIFICATION_LIMITS_DENIED');}
  if(limits.maxTools!==2||limits.maxRequests<2||limits.maxTurns<2||limits.maxCostMicros>LEDGER_MAX_COST_MICROS||limits.maxRequests>LEDGER_MAX_REQUESTS)deny(5,'QUALIFICATION_LIMITS_DENIED');
  if(!Number.isSafeInteger(config.expiresAtMs)||config.expiresAtMs<=startedAt||config.expiresAtMs>startedAt+60*60*1000)deny(5,'QUALIFICATION_CONSENT_EXPIRY_DENIED');
  // The owner admits ONLY its own code-owned probe-text digest
  // (MODEL_CONNECTION_TEST_DATA_DIGEST_V1); the composition payload identity is
  // the code-owned composition digest inside the owner-derived offer.
  if(config.expectedTestDataDigest!==MODEL_CONNECTION_TEST_DATA_DIGEST_V1)deny(5,'QUALIFICATION_TEST_DATA_DENIED');
  if(!closed(config.pricing,['currency','revision','inputMicrosPerMillionTokens','outputMicrosPerMillionTokens'])||!/^[A-Z]{3}$/.test(config.pricing.currency)||!Number.isSafeInteger(config.pricing.revision)||config.pricing.revision<1||['inputMicrosPerMillionTokens','outputMicrosPerMillionTokens'].some(k=>!Number.isSafeInteger(config.pricing[k])||config.pricing[k]<0||config.pricing[k]>1000000000))deny(5,'QUALIFICATION_PRICING_DENIED');
  if(typeof config.receiptDir!=='string'||!config.receiptDir.startsWith('/'))deny(5,'QUALIFICATION_RECEIPT_DIR_DENIED');
  const repoRoot=realpathSync(resolve(fileURLToPath(new URL('..',import.meta.url))));
  let receiptDir;try{receiptDir=realpathSync(config.receiptDir);}catch{deny(5,'QUALIFICATION_RECEIPT_DIR_DENIED');}
  if(receiptDir===repoRoot||receiptDir.startsWith(repoRoot+sep))deny(5,'QUALIFICATION_RECEIPT_DIR_REPO_DENIED');
  // Owner custody state root: an existing owner-owned 0700 directory outside
  // the repo holding the session envelope, browser profile row and the
  // durable cost-ledger databases. Reusing it across runs is the point: the
  // owner ledger is what persists UNKNOWN holds and settled history.
  if(typeof config.stateDir!=='string'||!config.stateDir.startsWith('/'))deny(5,'QUALIFICATION_STATE_DIR_DENIED');
  let stateDir;try{stateDir=realpathSync(config.stateDir);}catch{deny(5,'QUALIFICATION_STATE_DIR_DENIED');}
  if(stateDir===repoRoot||stateDir.startsWith(repoRoot+sep))deny(5,'QUALIFICATION_STATE_DIR_REPO_DENIED');
  {const st=lstatSync(stateDir);if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o777)!==0o700||st.uid!==process.getuid())deny(5,'QUALIFICATION_STATE_DIR_DENIED');}
  // The session ingress origin is the owner's OWN https origin (protected
  // session adapter), independent from the http loopback model target.
  try{validateHostedOriginV1(config.sessionOrigin);}catch{deny(5,'QUALIFICATION_SESSION_ORIGIN_DENIED');}
  if(!atom(config.sessionSubject))deny(5,'QUALIFICATION_SESSION_SUBJECT_DENIED');
  let identity;try{identity=validateRuntimeIdentityV1(JSON.parse(readFileSync(config.runtimeIdentityPath,'utf8')));}catch{deny(5,'QUALIFICATION_RUNTIME_IDENTITY_DENIED');}
  // Output custody (run08 filesystem-integrity fix). BEFORE any native tool
  // action or network request, reserve the receipt output as a NEW regular
  // file, exclusively and without following a symlink
  // (O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW). Any pre-existing leaf — regular
  // file, symlink (owned or dangling), directory — denies the run with an
  // explicit nonzero exit and ZERO network calls, preserving the existing
  // target bytes/mode untouched; the pre-existing output is never removed
  // and recreated as a workaround. After the claim the bound fd is the ONLY
  // write/fchmod handle; the leaf path is never re-resolved at completion,
  // so an existing symlink can never redirect the write outside the
  // admitted receiptDir.
  const receiptOut=resolve(receiptDir,'qualification-receipt.json');
  let receiptFd;try{receiptFd=openSync(receiptOut,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0o600);}
  catch{deny(5,'QUALIFICATION_RECEIPT_OUTPUT_OCCUPIED');}
  let fdOpen=true;
  // run09 truthful in-flight evidence: the reserved file is NEVER left at
  // zero bytes during the attempt. BEFORE any binding or network action the
  // bound fd writes a small parseable IN_PROGRESS/UNKNOWN non-success record
  // (no false PASS, no model/budget claim). At completion the SAME fd
  // positionally rewrites the file from offset 0 and then truncates to the
  // final written length — no leaf-path re-resolution, no path-based
  // chmod/write, no replacement, no stale suffix from the earlier record.
  const IN_PROGRESS_RECEIPT_V1='{"schemaVersion":"pansphaira.pan575.local-model-qualification/receipt/v1","state":"IN_PROGRESS","verdict":"QUALIFICATION_IN_PROGRESS_NOT_COMPLETE","exitCode":null,"inferenceState":"NOT_RUN","realModelAcceptance":false}\n';
  {let inOff=0;const inBuf=Buffer.from(IN_PROGRESS_RECEIPT_V1,'utf8');
   try{while(inOff<inBuf.length)inOff+=writeSync(receiptFd,inBuf,inOff,inBuf.length-inOff,inOff);fchmodSync(receiptFd,0o600);}
   catch{try{closeSync(receiptFd);}catch{}fdOpen=false;deny(5,'QUALIFICATION_RECEIPT_OUTPUT_OCCUPIED');}}
  // A config/binding deny before the network must not leave the owned
  // reservation behind: release the claim (exact-owned cleanup — only when
  // the leaf is still exactly the file we opened, so an existing unrelated
  // file is never removed). Once the loop starts, the finally below owns the
  // fd and the written IN_PROGRESS/UNKNOWN record becomes the truthful
  // interrupted-run evidence — never a false PASS.
  const releaseClaim=()=>{if(!fdOpen)return;try{const f=fstatSync(receiptFd),l=lstatSync(receiptOut);if(f.ino===l.ino&&f.dev===l.dev)unlinkSync(receiptOut);}catch{}try{closeSync(receiptFd);}catch{}fdOpen=false;};
  let result;
  try{
  const summary=validateModelConnectionSummaryV1({connectionId:'connection:pan575-local-qualification',routeId:ROUTE_ID,provider:PROVIDER,model:config.model,protocol:'OPENAI_CHAT_COMPLETIONS',evidenceClass:'OWNER_BOUND_NOT_QUALIFIED',secretReference:CREDENTIAL_HANDLE,authMethod:'EXISTING_SECRET_REFERENCE',identity:{...connectionTransportIdentityV1(),deploymentId:config.deploymentId,configurationRevision:config.configurationRevision},availability:{runtime:true,provider:true,auth:true,model:true,functions:true},selectable:true});
  const connectionOptions={summary,target:{origin:config.origin,allowedAddresses:['127.0.0.1'],localOnly:true},credentialFile:config.credentialFile,pricing:config.pricing,productGrant:{limits,testDataDigest:MODEL_CONNECTION_TEST_DATA_DIGEST_V1,expiresAtMs:config.expiresAtMs,allowedPurposes:[MODEL_CONNECTION_COMPOSITION_PURPOSE_V1]}};
  // The utility's own read-only preflight binding: it exists ONLY to prove
  // credential enforcement (an unauthenticated request must be denied) with
  // zero owner state, before any owner admission. Dispatch itself is bound
  // exclusively through the owner's separate transport over the SAME options.
  let transport;try{transport=bindModelConnectionTransportV1(structuredClone(connectionOptions));}
  catch(error){deny(5,String(error?.message||'MODEL_CONNECTION_TARGET_DENIED').replace(/[^A-Za-z0-9_]/g,'_').replace(/^_+|_+$/g,'').slice(0,96));}
  let fingerprint=null;try{fingerprint=transport.secretFingerprint();}catch{deny(5,'MODEL_CONNECTION_SECRET_UNAVAILABLE');}
  const grantExpiresAtMs=transport.productGrant.expiresAtMs;
  const identityDigest=sha({summaryDigest:sha(summary),targetDigest:transport.targetDigest,fingerprint,grantExpiresAtMs,sessionOrigin:config.sessionOrigin});
  const hardDeadline=startedAt+limits.maxTimeMs;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),limits.maxTimeMs);
  // Preflight authority re-checks on the utility's own binding: grant expiry
  // and live secret fingerprint (rotation invalidates the run before any
  // owner admission). Owner admission re-checks identity independently.
  const authorize=()=>{if(Date.now()>=grantExpiresAtMs)throw Error('MODEL_GRANT_EXPIRED');if(Date.now()>=hardDeadline)throw Error('MODEL_CONNECTION_TIMEOUT');if(transport.secretFingerprint()!==fingerprint)throw Error('MODEL_CONNECTION_SECRET_ROTATED');return true;};
  // The EXISTING protected session owner and browser profile store own the
  // session envelope, the model-connection row and (via the owner) the
  // durable cost ledger under stateDir. No new store is introduced. The
  // profile store is RE-CREATABLE over the SAME stable stateRoot: closing an
  // owner or store closes handles only — it NEVER deletes or resets the
  // durable UNKNOWN ledgers, the persisted connection row or the session
  // envelope. Owner principal, current session and identity digest stay
  // stable across a reopen, so the reopened owner observes exactly the same
  // state the closed one left behind.
  let sessions;
  const makeProfiles=()=>createBrowserProfileStoreV1({root:stateDir,catalog:()=>defaultBrowserProfileV1().items.map(i=>({id:i.id,version:i.version,state:'AVAILABLE'}))});
  let profiles;
  try{
    sessions=createProtectedSessionAdapterV1({optIn:true,origin:config.sessionOrigin,identity,stateRoot:stateDir});
    profiles=makeProfiles();
  }catch{deny(5,'QUALIFICATION_OWNER_STATE_DENIED');}
  const makeOwner=()=>createNativeModelConnectionV1({sessions,profiles,root:stateDir,connections:[structuredClone(connectionOptions)]});
  let owner,headers;
  try{
    owner=makeOwner();
    const issued=sessions.issueOwnerSession({subjectId:config.sessionSubject,role:'reader',expiresAtMs:config.expiresAtMs});
    headers=Object.freeze({cookie:issued.cookieHeader,origin:config.sessionOrigin,'x-pan565-session':'session:'+shaRaw(issued.cookieHeader)});
  }catch{deny(5,'QUALIFICATION_OWNER_STATE_DENIED');}
  // Narrow observation of the owner's durable ledger for the CURRENT profile
  // row's identity and one exact operation (see observeOwnerLedgerReservationV1).
  const observeLedger=operationId=>observeOwnerLedgerReservationV1({stateDir,sessions,profiles,headers,operationId});
  const receipt={schemaVersion:'pansphaira.pan575.local-model-qualification/receipt/v1',startedAtMs:startedAt,origin:config.origin,model:config.model,deploymentId:config.deploymentId,configurationRevision:config.configurationRevision,identityDigest,targetDigest:transport.targetDigest,secretFingerprint:fingerprint,secretReference:CREDENTIAL_HANDLE,adapterDigest:summary.identity.adapterDigest,parserDigest:summary.identity.parserDigest,caps:limits,testDataDigest:config.expectedTestDataDigest,compositionPurpose:MODEL_CONNECTION_COMPOSITION_PURPOSE_V1,compositionTestDataDigest:MODEL_CONNECTION_COMPOSITION_TEST_DATA_DIGEST_V1,nativeCapabilities:[...MODEL_CONNECTION_COMPOSITION_CAPABILITIES_V1].sort(),toolWireNames:[...Object.values(MODEL_COMPOSITION_WIRE_ALIAS_V1.binding)].sort(),composition:null,ownerBindingDigest:null,evidenceBinding:'OWNER_BOUND_NOT_QUALIFIED',durableOwnerLedger:'INTEGRATED_OWNER_BOUND_COST_LEDGER_V1',ownerLedger:{runId:null,offerDigest:null,stateBeforeReservation:null,stateAfterRun:null,stateAfterReopen:null,reservation:null,reservationBeforeClose:null,retainedPriorHold:null,reservationDurableAcrossReopen:false},scope:{directTransport:'NOT_OBSERVED',nativeLoop:'NOT_RUN',browser:'NOT_EXERCISED',fullIssue575:'NOT_COMPLETE',fullIssue565:'NOT_IN_SCOPE'},phases:{REACHABILITY:{state:'NOT_RUN',checkedAtMs:null,identityDigest:null,reason:'NOT_RUN'},AUTHENTICATION:{state:'NOT_RUN',checkedAtMs:null,identityDigest:null,reason:'NOT_RUN'},MODEL_AVAILABILITY:{state:'NOT_RUN',checkedAtMs:null,identityDigest:null,reason:'NOT_RUN'},INFERENCE:{state:'NOT_RUN',checkedAtMs:null,identityDigest:null,reason:'NOT_RUN'}},loop:null,verdict:'REAL_LOCAL_MODEL_TOOL_LOOP_NOT_QUALIFIED',realModelAcceptance:false,syntheticFixturesRelabelled:false,electricityCost:'UNKNOWN_NO_INVOICE',paidTokenCost:'UNKNOWN_NO_INVOICE',exitCode:1};
  const fail=(phase,state,reason,log)=>{phases[phase]={state,checkedAtMs:now(),identityDigest:null,reason};log.push(phase+'='+state);return {exitCode:6,receipt,log};};
  const phases=receipt.phases;
  const pass=(phase,reason,log,identity=null)=>{phases[phase]={state:'PASS',checkedAtMs:now(),identityDigest:identity,reason};log.push(phase+'=PASS');};
  async function attempt(){
    const log=[];
    let unauth;try{unauth=await transport.exchange('GET','/v1/models',null,controller.signal,authorize,false);}
    catch{return fail('REACHABILITY','FAILED','REACHABILITY_UNREACHABLE',log);}
    pass('REACHABILITY','RESPONSE_OBSERVED',log,identityDigest);
    if(unauth.status!==401)return fail('AUTHENTICATION','FAILED','AUTH_ENFORCEMENT_ABSENT',log);
    // Owner-bound phase observation: select the connection on the persisted
    // profile row, then run the owner's own REACHABILITY/AUTHENTICATION/
    // MODEL_AVAILABILITY probes. Every phase state in the receipt below this
    // point is the OWNER-derived, identity-bound, persisted check.
    let readback;
    try{
      readback=await owner.read(headers);
      readback=await owner.select(headers,{schemaVersion:'pansphaira.workspace-model-connection/select/v1',expectedRevision:readback.revision,connectionId:summary.connectionId});
      for(const phase of ['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY']){
        readback=await owner.probe(headers,{schemaVersion:'pansphaira.workspace-model-connection/probe/v1',expectedRevision:readback.revision,identityDigest:readback.identityDigest,phase});
        const check=readback.checks[phase];
        if(check.state!=='PASS')return fail(phase,'FAILED',String(check.reason).slice(0,64),log);
        pass(phase,String(check.reason).slice(0,64),log,readback.identityDigest);
      }
    }catch(error){
      const code=ownerErrorCode(error);
      // A retained UNKNOWN hold refuses any redispatch BEFORE the owner even
      // probes: the existing durable ledger denies, existing history stays
      // immutable, nothing is re-branDED or retried blindly.
      if(code==='MODEL_CONNECTION_UNKNOWN_USAGE_RETAINED'){
        // The retained hold is observed ONLY as the exact prior operation the
        // persisted profile row names (lastOperation) — never by enumerating
        // other principals' ledgers or other rows.
        let hold=null;try{const prior=profiles.readModelConnection(sessions.authenticate(headers))?.state?.lastOperation;hold=prior?observeLedger(prior):null;}catch{hold=null;}
        receipt.ownerLedger.retainedPriorHold=hold??Object.freeze({state:'OBSERVATION_UNAVAILABLE',modelUnits:null,runtimeUnits:null,modelConsumed:null,runtimeConsumed:null});
        phases.INFERENCE={state:'UNKNOWN_USAGE',checkedAtMs:now(),identityDigest:null,reason:'OWNER_LEDGER_UNKNOWN_USAGE_RETAINS_REDISPATCH'};
        log.push('INFERENCE=UNKNOWN_USAGE','VERDICT=REAL_LOCAL_MODEL_NOT_QUALIFIED');
        return {exitCode:2,receipt,log};
      }
      return fail('REACHABILITY','FAILED',code,log);
    }
    receipt.ownerBindingDigest=readback.identityDigest;
    // The bounded composition consumer: opaque branded model capability over
    // the exact code-owned pair; the caller supplies only runId+expiry and
    // confirms the exact owner-derived offer digest.
    const runId='operation:pan574-'+randomBytes(24).toString('hex');
    receipt.ownerLedger.runId=runId;
    // Conservative pre-reservation observation of the EXACT future operation:
    // before the owner reserves, the honest answer is NO_RESERVATION (a
    // distinct OBSERVATION_UNAVAILABLE is never silently folded into it).
    receipt.ownerLedger.stateBeforeReservation=observeLedger(runId).state;
    let loop;
    try{
      const model=createNativeCompositionFeedbackModelV1(owner,sessions.binding);
      const {ticket,offer}=prepareNativeCompositionFeedbackV1(model,headers,{runId,expiresAtMs:Math.min(Date.now()+25000,config.expiresAtMs)});
      receipt.composition={runId,purpose:offer.purpose,offerDigest:offer.offerDigest,descriptorDigest:offer.descriptorDigest,payloadDigest:offer.payloadDigest,expiresAtMs:offer.expiresAtMs,evidenceClass:offer.evidenceClass,pricingClass:offer.pricingClass};
      receipt.ownerLedger.offerDigest=offer.offerDigest;
      loop=await runNativeCompositionFeedbackV1(model,headers,ticket,{offerDigest:offer.offerDigest,confirm:true});
    }catch(error){
      const code=ownerErrorCode(error);
      const held=observeLedger(runId);
      receipt.ownerLedger.stateAfterRun=held.state;
      phases.INFERENCE={state:held.state==='UNKNOWN_USAGE'?'UNKNOWN_USAGE':'FAILED',checkedAtMs:now(),identityDigest:receipt.ownerBindingDigest,reason:code};
      log.push('INFERENCE='+(held.state==='UNKNOWN_USAGE'?'UNKNOWN_USAGE':'FAILED'),'VERDICT=REAL_LOCAL_MODEL_NOT_QUALIFIED');
      return {exitCode:2,receipt,log};
    }
    receipt.loop={outcome:loop.outcome,exitCode:loop.exitCode,endReason:loop.endReason,realModelAcceptance:loop.realModelAcceptance,usageState:loop.usageState,actualToolActions:loop.actualToolActions,actualRequests:loop.actualRequests,usage:loop.usage,elapsedMs:loop.elapsedMs,toolReadbacks:loop.toolReadbacks};
    receipt.scope.directTransport='OBSERVED_OWNER_BOUND_EXCHANGE';
    // Durable ledger observation THROUGH the owner's own database: the ACTUAL
    // exact-operation snapshot before close (the full accounting tuple, not
    // just a state label — two equal labels prove nothing), then through a
    // full owner REOPEN (close + fresh owner + read-only SQLite re-read). A
    // settled run settles inside the owner (owner-derived settlement only);
    // any unconfirmed path keeps the full hold and must survive the reopen as
    // UNKNOWN_USAGE — never zero usage.
    const beforeClose=observeLedger(runId);
    receipt.ownerLedger.stateAfterRun=beforeClose.state;
    receipt.ownerLedger.reservationBeforeClose=beforeClose;
    let reopened;
    try{owner.close();profiles.close();}catch{}
    try{
      // REOPEN against the SAME stable stateRoot with a FRESH profile store:
      // the closed instance is never reused (its handles are gone), while
      // closing deleted/reset nothing — the same persisted owner row, the
      // same session identity and the same durable ledger are re-observed.
      profiles=makeProfiles();
      reopened=makeOwner();
      const reopenedReadback=reopened.read(headers);
      const afterReopen=observeLedger(runId);
      receipt.ownerLedger.stateAfterReopen=afterReopen.state;
      receipt.ownerLedger.reservation=afterReopen;
      // Durability is the accounting predicate over the TWO actual snapshots
      // — genuine reservation states with complete safe-integer accounting
      // and an exactly unchanged reserved/consumed tuple inside the owner
      // ceilings — never an equality of two state labels.
      receipt.ownerLedger.reservationDurableAcrossReopen=ownerLedgerReservationDurableAcrossReopenV1(beforeClose,afterReopen);
      const inference=reopenedReadback.checks.INFERENCE;
      phases.INFERENCE={state:inference.state,checkedAtMs:now(),identityDigest:reopenedReadback.identityDigest,reason:String(inference.reason).slice(0,64)};
    }finally{try{reopened?.close();}catch{}}
    const settled=receipt.ownerLedger.stateAfterReopen==='SETTLED';
    // The exit-0 observation requires the REAL durability/accounting proof,
    // not just a SETTLED label on the reopened row.
    const durable=receipt.ownerLedger.reservationDurableAcrossReopen===true;
    const completed=loop.outcome==='RESULT_READY'&&loop.exitCode===0&&loop.actualToolActions===2&&loop.actualRequests>=2&&loop.usage.inputTokens>0&&loop.usage.outputTokens>0;
    if(completed&&settled&&durable&&canonicalJson(loop.toolReadbacks.map(r=>r.toolName))===canonicalJson(MODEL_CONNECTION_COMPOSITION_CAPABILITIES_V1)){
      log.push('INFERENCE=PASS');
      receipt.scope.nativeLoop='OBSERVED_OWNER_COMPOSITION_TOOL_LOOP_MODEL_PROVENANCE_PENDING';
      // Honest owner-bound observation labels only: the loop, the durable
      // reservation and the settlement were actually observed; model
      // provenance is NOT claimed here.
      receipt.verdict='OWNER_BOUND_COMPOSITION_LOOP_OBSERVED_REAL_MODEL_NOT_QUALIFIED';log.push('VERDICT=OWNER_BOUND_COMPOSITION_LOOP_OBSERVED_REAL_MODEL_NOT_QUALIFIED');
      return {exitCode:0,receipt,log};
    }
    receipt.scope.nativeLoop='ATTEMPTED_NOT_QUALIFIED';
    const unknown=loop.usageState==='UNKNOWN_USAGE_RETAINED'||!settled||!durable;
    const state=unknown?'UNKNOWN_USAGE':'FAILED';
    phases.INFERENCE={state,checkedAtMs:now(),identityDigest:receipt.ownerBindingDigest,reason:String(loop.endReason??'QUALIFICATION_OBSERVATION_INCOMPLETE').slice(0,64)};log.push('INFERENCE='+state,'VERDICT=REAL_LOCAL_MODEL_NOT_QUALIFIED');
    return {exitCode:loop.outcome==='BUDGET_ABORTED'?3:loop.outcome==='DENIED'?2:1,receipt,log};
  }
    try{result=await attempt();}finally{
      clearTimeout(timer);controller.abort();
      try{owner.close();}catch{}try{profiles.close();}catch{}
      if(result===undefined)result={exitCode:6,receipt,log:['INFERENCE=NOT_RUN']};
      receipt.exitCode=result.exitCode;
      // The reserved, bound fd is the only output handle: the in-flight
      // IN_PROGRESS record is overwritten — positionally, from file offset 0
      // with every write's buffer offset, remaining length AND file position
      // bound — through that SAME fd, then the file is truncated to the final
      // written byte length (no leaf re-resolution, no path-based chmod/write,
      // no replacement, no stale suffix, no NUL hole from a moved fd
      // position); the fd is closed in this finally.
      const outBuf=Buffer.from(canonicalJson(receipt)+'\n','utf8');let outOff=0;
      try{while(outOff<outBuf.length)outOff+=writeSync(receiptFd,outBuf,outOff,outBuf.length-outOff,outOff);ftruncateSync(receiptFd,outOff);fchmodSync(receiptFd,0o600);}
      finally{closeSync(receiptFd);fdOpen=false;}
    }
  }catch(error){releaseClaim();throw error;}
  return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  const configPath=args.length===2&&args[0]==='--config'?args[1]:null;
  try{
    if(!configPath||!configPath.startsWith('/'))throw Object.assign(Error('QUALIFICATION_CONFIG_UNREADABLE'),{qualificationExit:5});
    const{exitCode,receipt,log}=await runLocalModelQualificationV1({configPath});
    for(const line of log)process.stdout.write(line+'\n');
    process.stdout.write(`PAN575_LOCAL_MODEL_QUALIFICATION exit=${exitCode} verdict=${receipt.verdict} inference=${receipt.phases.INFERENCE.state}\n`);
    process.exitCode=exitCode;
  }catch(error){
    const code=error?.qualificationExit??2,reason=String(error?.qualificationReason??error?.message??'QUALIFICATION_FAILED').replace(/[^A-Za-z0-9_=, .()-]/g,'_').slice(0,200);
    process.stdout.write(`PAN575_LOCAL_MODEL_QUALIFICATION exit=${code} reason=${reason}\n`);
    process.exitCode=code;
  }
}
