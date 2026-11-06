// PAN575 opt-in real-local-model qualification entrypoint. It reuses the
// EXISTING broker/tool-feedback loop, the EXISTING local connection transport
// and the EXISTING Original574 native tools — no second harness, no fake
// deterministic model. Synthetic fixture suites stay SYNTHETIC_ONLY and are
// never relabelled as model acceptance here (receipt keeps
// realModelAcceptance:false). Every success verdict here is a bounded
// owner-bound transport/tool OBSERVATION only: neither a config label nor a
// scripted/locally-listening provider response proves deployment/model
// provenance — that remains a separate parent-bound real-model proof.
// Durable accounting/unknown-usage reconciliation against the owner ledger
// is NOT integrated; the original issue criteria stay unfulfilled (this is
// a bounded observation utility, not full issue delivery). Direct transport,
// native loop, UI/browser and full issue completion are reported separately.
// Actual inference is explicitly opt-in (consent env + bounded config);
// nothing here runs by default in CI. Exit codes: 0 owner-bound tool loop
// observed (NOT model acceptance), 1 unqualified completion,
// 2 loop DENIED, 3 loop BUDGET_ABORTED, 4 REAL_MODEL_CONSENT_MISSING,
// 5 config/binding denied, 6 bounded phase check failed before inference
// (INFERENCE stays NOT_RUN).
import {createHash} from 'node:crypto';
// Node's ESM 'node:fs' module exports the open flags ONLY inside the
// `constants` object — there are no top-level O_* ESM exports, so the run08
// named-import list crashed this entrypoint with exit 1 before any test even
// started. Destructure the needed O_* flags from the real `constants` export.
import {readFileSync,realpathSync,openSync,writeSync,fchmodSync,ftruncateSync,fstatSync,lstatSync,closeSync,unlinkSync,constants} from 'node:fs';
const {O_WRONLY,O_CREAT,O_EXCL,O_NOFOLLOW}=constants;
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ModelAccessBrokerV1,MODEL_REQUEST_SCHEMA_V1} from '../dist/packages/contracts/src/model-access-broker.js';
import {canonicalJson} from '../dist/packages/contracts/src/canonical-json.js';
import {validateModelConnectionLimitsV1,validateModelConnectionSummaryV1} from '../dist/packages/contracts/src/workspace-model-connection-v1.js';
import {bindModelConnectionTransportV1,connectionTransportIdentityV1} from '../src/pan565/connection-transport.mjs';
import {createNativeCompositionFeedbackToolsV1} from '../src/pan575/native-composition-tools.mjs';
import {runExistingBrokerToolFeedbackV1,isCompletedBrokerToolFeedbackV1} from '../src/pan575/broker-tool-feedback.mjs';
import {materialInput575} from '../tests/pan575/protocol-fixture.mjs';
const sha=v=>createHash('sha256').update(canonicalJson(v)).digest('hex');
const atom=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,95}$/.test(v)&&!/(?:sk-|password|api[_-]?key|access[_-]?token|https?:|\.\.)/i.test(v);
const CONSENT='REAL_LOCAL_MODEL_RUN_V1',ROUTE_ID='route:local-openai-chat-completions',PROVIDER='provider:local-inference-sandbox',CREDENTIAL_HANDLE='credential-handle:local-model-secret-file';
const WORKLOAD='workload:local-model-qualification',USER='user:local-owner',TENANT='tenant:local-owner',PURPOSE='purpose:local-model-qualification';
const OPERATION='operation:pan575-local-model-qualification',CORRELATION='correlation:pan575-local-qualification';
// Utility-local CLOSED wire-alias mapping (run04 correction). The actual
// local Qwen server enforces tools[i].function.name ~ [A-Za-z0-9_-]{1,256};
// the dotted Original574 capability IDs are valid native identities but
// provider-INCOMPATIBLE wire names (real HTTP 400 observed). These two
// aliases are documented, digest-bound presentation renames ONLY: native
// capability IDs, authority, grants and schemas stay unchanged, invoke and
// validate remain the ORIGINAL bound native functions, and the mapping is
// neither generic normalization nor a model-selectable registry.
export const QUALIFICATION_WIRE_ALIAS_V1=Object.freeze({'pan522.material.plan':'pan522_material_plan','erp.order.create':'erp_order_create'});
// Portable provider-safe wire-name contract (<=64 chars: also inside the
// broker's own /^[a-z][a-z0-9_.-]{2,63}$/ tool-name guard).
const WIRE_NAME_V1=/^[A-Za-z0-9_-]{1,64}$/;
export function qualificationWireToolsV1(nativeTools,mapping=QUALIFICATION_WIRE_ALIAS_V1){
  if(!Array.isArray(nativeTools)||nativeTools.length===0)throw Error('QUALIFICATION_ALIAS_DENIED');
  const ids=nativeTools.map(t=>t?.descriptor?.name);
  const missing=ids.some(id=>typeof id!=='string'||!Object.hasOwn(mapping,id));
  const unknown=Object.keys(mapping).some(id=>!ids.includes(id));
  const aliases=ids.map(id=>mapping[id]);
  const invalid=aliases.some(a=>typeof a!=='string'||!WIRE_NAME_V1.test(a))||new Set(aliases).size!==aliases.length||aliases.some((a,i)=>a===ids[i]);
  if(missing||unknown||invalid)throw Error('QUALIFICATION_ALIAS_DENIED');
  return Object.freeze(nativeTools.map(t=>{const alias=mapping[t.descriptor.name];
    return Object.freeze({descriptor:Object.freeze({name:alias,description:t.descriptor.description+' Provider wire alias '+alias+' for native '+t.descriptor.name+'; same already-authorized native function, aliases are not model-selectable.',inputSchema:t.descriptor.inputSchema}),invoke:t.invoke,validate:t.validate});}));
}
function qualificationAliasBindingV1(){return Object.entries(QUALIFICATION_WIRE_ALIAS_V1).sort((a,b)=>a[0]<b[0]?-1:1);}
function deny(exitCode,reason){const e=Error(reason);e.qualificationExit=exitCode;e.qualificationReason=reason;throw e;}
function closed(v,keys){return v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&canonicalJson(Object.keys(v).sort())===canonicalJson([...keys].sort());}
// The six-field broker budget is derived from the SAME validated owner limits
// (no invented wire fields); policy.maxBudget and the request budget share
// this ceiling so every per-turn loop shrink stays inside the broker guard.
export function qualificationBudgetV1(limits){
  return {maxInputBytes:limits.maxInputBytes,maxOutputBytes:limits.maxOutputBytes,maxTokens:limits.maxTokens,maxCostMicros:limits.maxCostMicros,maxRequests:limits.maxRequests,timeoutMs:limits.maxTimeMs};
}
export function qualificationPolicyV1(model,limits){
  return {schemaVersion:'chimpmaera.model/model-access-policy/v1',routes:[{routeId:ROUTE_ID,provider:PROVIDER,model,protocol:'OPENAI_CHAT_COMPLETIONS',credentialHandle:CREDENTIAL_HANDLE,allowedTenants:[TENANT],allowedPurposes:[PURPOSE],optionalFields:['temperature'],attachmentMediaTypes:[]}],workloadIdentities:[WORKLOAD],userIdentities:[USER],maxBudget:qualificationBudgetV1(limits)};
}
export function qualificationTestDataDigestV1(wireDescriptors){
  return sha({material:materialInput575(),tools:[...wireDescriptors].sort((a,b)=>a.name.localeCompare(b.name,'en')),toolAliasBinding:qualificationAliasBindingV1()});
}
export function qualificationPromptV1(){
  const plan=QUALIFICATION_WIRE_ALIAS_V1['pan522.material.plan'],order=QUALIFICATION_WIRE_ALIAS_V1['erp.order.create'];
  return 'Public synthetic PAN575 local-model qualification data only. Promptnonce public-promptnonce is NOT tool knowledge. No product model acceptance, no ERP authority, no live procurement. In your FIRST response call BOTH declared tools, each exactly once: '+plan+' and '+order+'. These are the provider wire names of the two native capabilities; call them exactly as declared. Copy the given arguments objects verbatim; rename, reorder or omit nothing. '+plan+' arguments: '+canonicalJson(materialInput575())+'. '+order+' arguments: '+canonicalJson({requestId:'request:erp-cell-pan575-feedback',sku:'SYN-PAN575',quantity:13})+'. Then consume the actual tool results and answer per the bounded feedback contract.';
}
export function qualificationRequestV1(model,descriptors,budget){
  return {schemaVersion:MODEL_REQUEST_SCHEMA_V1,workloadIdentity:WORKLOAD,userIdentity:USER,tenant:TENANT,purpose:PURPOSE,delegationDigest:sha({route:ROUTE_ID,model}),operationId:OPERATION,correlationId:CORRELATION,routeId:ROUTE_ID,provider:PROVIDER,model,protocol:'OPENAI_CHAT_COMPLETIONS',dataClassification:'PUBLIC',trustClass:'TRUSTED_OWNER_INPUT',text:qualificationPromptV1(),attachments:[],tools:descriptors,structuredOutput:null,optionalFields:{temperature:0},budget};
}
export async function runLocalModelQualificationV1({configPath,env=process.env,now=Date.now}){
  if(env.PAN575_LOCAL_MODEL_QUALIFICATION!==CONSENT)deny(4,'REAL_MODEL_CONSENT_MISSING');
  let config;try{config=JSON.parse(readFileSync(configPath,'utf8'));}catch{deny(5,'QUALIFICATION_CONFIG_UNREADABLE');}
  const startedAt=now();
  if(!closed(config,['origin','model','deploymentId','configurationRevision','credentialFile','receiptDir','pricing','limits','expectedTestDataDigest','expiresAtMs']))deny(5,'QUALIFICATION_CONFIG_DENIED');
  if(typeof config.origin!=='string'||!/^http:\/\/127\.0\.0\.1:[0-9]{2,5}$/.test(config.origin))deny(5,'QUALIFICATION_TARGET_DENIED');
  if(!atom(config.model)||!atom(config.deploymentId)||!Number.isSafeInteger(config.configurationRevision)||config.configurationRevision<1)deny(5,'QUALIFICATION_IDENTITY_DENIED');
  if(typeof config.credentialFile!=='string'||!config.credentialFile.startsWith('/'))deny(5,'QUALIFICATION_SECRET_PATH_DENIED');
  let limits;try{limits=validateModelConnectionLimitsV1(config.limits);}catch{deny(5,'QUALIFICATION_LIMITS_DENIED');}
  if(limits.maxTools!==2||limits.maxRequests<2||limits.maxTurns<2)deny(5,'QUALIFICATION_LIMITS_DENIED');
  if(!Number.isSafeInteger(config.expiresAtMs)||config.expiresAtMs<=startedAt||config.expiresAtMs>startedAt+60*60*1000)deny(5,'QUALIFICATION_CONSENT_EXPIRY_DENIED');
  if(typeof config.expectedTestDataDigest!=='string'||!/^[a-f0-9]{64}$/.test(config.expectedTestDataDigest))deny(5,'QUALIFICATION_TEST_DATA_DENIED');
  if(!closed(config.pricing,['currency','revision','inputMicrosPerMillionTokens','outputMicrosPerMillionTokens'])||!/^[A-Z]{3}$/.test(config.pricing.currency)||!Number.isSafeInteger(config.pricing.revision)||config.pricing.revision<1||['inputMicrosPerMillionTokens','outputMicrosPerMillionTokens'].some(k=>!Number.isSafeInteger(config.pricing[k])||config.pricing[k]<0||config.pricing[k]>1000000000))deny(5,'QUALIFICATION_PRICING_DENIED');
  if(typeof config.receiptDir!=='string'||!config.receiptDir.startsWith('/'))deny(5,'QUALIFICATION_RECEIPT_DIR_DENIED');
  const repoRoot=realpathSync(resolve(fileURLToPath(new URL('..',import.meta.url))));
  let receiptDir;try{receiptDir=realpathSync(config.receiptDir);}catch{deny(5,'QUALIFICATION_RECEIPT_DIR_DENIED');}
  if(receiptDir===repoRoot||receiptDir.startsWith(repoRoot+sep))deny(5,'QUALIFICATION_RECEIPT_DIR_REPO_DENIED');
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
  const native=createNativeCompositionFeedbackToolsV1();
  let wireTools;try{wireTools=qualificationWireToolsV1(native.tools);}catch{deny(5,'QUALIFICATION_ALIAS_DENIED');}
  const descriptors=wireTools.map(t=>t.descriptor);
  if(qualificationTestDataDigestV1(descriptors)!==config.expectedTestDataDigest)deny(5,'QUALIFICATION_TEST_DATA_DENIED');
  const summary=validateModelConnectionSummaryV1({connectionId:'connection:pan575-local-qualification',routeId:ROUTE_ID,provider:PROVIDER,model:config.model,protocol:'OPENAI_CHAT_COMPLETIONS',evidenceClass:'OWNER_BOUND_NOT_QUALIFIED',secretReference:CREDENTIAL_HANDLE,authMethod:'EXISTING_SECRET_REFERENCE',identity:{...connectionTransportIdentityV1(),deploymentId:config.deploymentId,configurationRevision:config.configurationRevision},availability:{runtime:true,provider:true,auth:true,model:true,functions:true},selectable:true});
  let transport;try{transport=bindModelConnectionTransportV1({summary,target:{origin:config.origin,allowedAddresses:['127.0.0.1'],localOnly:true},credentialFile:config.credentialFile,pricing:config.pricing,productGrant:{limits,testDataDigest:config.expectedTestDataDigest,expiresAtMs:config.expiresAtMs}});}
  catch(error){deny(5,String(error?.message||'MODEL_CONNECTION_TARGET_DENIED').replace(/[^A-Za-z0-9_]/g,'_').replace(/^_+|_+$/g,'').slice(0,96));}
  let fingerprint=null;try{fingerprint=transport.secretFingerprint();}catch{deny(5,'MODEL_CONNECTION_SECRET_UNAVAILABLE');}
  // The bound transport exposes productGrant as a frozen structuredClone
  // object (connection-transport.mjs), NOT as a callable.
  const grantExpiresAtMs=transport.productGrant.expiresAtMs;
  const identityDigest=sha({summaryDigest:sha(summary),targetDigest:transport.targetDigest,fingerprint,grantExpiresAtMs});
  const hardDeadline=startedAt+limits.maxTimeMs;
  // Owner-bound identity checks on EVERY admission point: grant expiry is
  // enforced from the bound product grant, secret rotation invalidates the
  // run by fingerprint comparison against the bind-time observation.
  const authorize=()=>{if(Date.now()>=grantExpiresAtMs)throw Error('MODEL_GRANT_EXPIRED');if(Date.now()>=hardDeadline)throw Error('MODEL_CONNECTION_TIMEOUT');if(transport.secretFingerprint()!==fingerprint)throw Error('MODEL_CONNECTION_SECRET_ROTATED');return true;};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),limits.maxTimeMs);
  const fail=(phase,state,reason,log)=>{phases[phase]={state,checkedAtMs:now(),identityDigest:null,reason};log.push(phase+'='+state);return {exitCode:6,receipt,log};};
  const pass=(phase,reason,log)=>{phases[phase]={state:'PASS',checkedAtMs:now(),identityDigest,reason};log.push(phase+'=PASS');};
  const phases={REACHABILITY:{state:'NOT_RUN',checkedAtMs:null,identityDigest:null,reason:'NOT_RUN'},AUTHENTICATION:{state:'NOT_RUN',checkedAtMs:null,identityDigest:null,reason:'NOT_RUN'},MODEL_AVAILABILITY:{state:'NOT_RUN',checkedAtMs:null,identityDigest:null,reason:'NOT_RUN'},INFERENCE:{state:'NOT_RUN',checkedAtMs:null,identityDigest:null,reason:'NOT_RUN'}};
  const receipt={schemaVersion:'pansphaira.pan575.local-model-qualification/receipt/v1',startedAtMs:startedAt,origin:config.origin,model:config.model,deploymentId:config.deploymentId,configurationRevision:config.configurationRevision,identityDigest,targetDigest:transport.targetDigest,secretFingerprint:fingerprint,secretReference:CREDENTIAL_HANDLE,adapterDigest:summary.identity.adapterDigest,parserDigest:summary.identity.parserDigest,caps:limits,testDataDigest:config.expectedTestDataDigest,toolAliasBinding:qualificationAliasBindingV1(),toolAliasBindingDigest:sha(qualificationAliasBindingV1()),nativeCapabilities:native.tools.map(t=>t.descriptor.name).sort(),toolWireNames:descriptors.map(d=>d.name).sort(),evidenceBinding:'OWNER_BOUND_NOT_QUALIFIED',durableOwnerLedger:'NOT_INTEGRATED_ORIGINAL_CRITERIA_UNFULFILLED',scope:{directTransport:'NOT_OBSERVED',nativeLoop:'NOT_RUN',browser:'NOT_EXERCISED',fullIssue575:'NOT_COMPLETE',fullIssue565:'NOT_IN_SCOPE'},phases,loop:null,verdict:'REAL_LOCAL_MODEL_TOOL_LOOP_NOT_QUALIFIED',realModelAcceptance:false,syntheticFixturesRelabelled:false,electricityCost:'UNKNOWN_NO_INVOICE',paidTokenCost:'UNKNOWN_NO_INVOICE',exitCode:1};
  async function attempt(){
    const log=[];
    let unauth;try{unauth=await transport.exchange('GET','/v1/models',null,controller.signal,authorize,false);}
    catch{return fail('REACHABILITY','FAILED','REACHABILITY_UNREACHABLE',log);}
    pass('REACHABILITY','RESPONSE_OBSERVED',log);
    if(unauth.status!==401)return fail('AUTHENTICATION','FAILED','AUTH_ENFORCEMENT_ABSENT',log);
    let authed;try{authed=await transport.exchange('GET','/v1/models',null,controller.signal,authorize,true);}
    catch{return fail('AUTHENTICATION','FAILED','AUTH_EXCHANGE_FAILED',log);}
    if(authed.status!==200)return fail('AUTHENTICATION','FAILED','AUTH_REJECTED',log);
    pass('AUTHENTICATION','SECRET_REQUIRED_AND_ACCEPTED',log);
    if(!(Array.isArray(authed.data?.data)&&authed.data.data.some(entry=>entry&&entry.id===config.model)))return fail('MODEL_AVAILABILITY','FAILED','MODEL_ID_UNAVAILABLE',log);
    pass('MODEL_AVAILABILITY','EXACT_ID_LISTED',log);
    const request=qualificationRequestV1(config.model,descriptors,qualificationBudgetV1(limits));
    const loop=await runExistingBrokerToolFeedbackV1({broker:new ModelAccessBrokerV1(qualificationPolicyV1(config.model,limits)),request,providerCall:(bound,signal,remaining)=>transport.providerToolStepCall(bound,signal,authorize,remaining),tools:wireTools,limits,signal:controller.signal,authorize});
    receipt.loop={outcome:loop.outcome,exitCode:loop.exitCode,endReason:loop.endReason,realModelAcceptance:loop.realModelAcceptance,usageState:loop.usageState,actualToolActions:loop.actualToolActions,actualRequests:loop.actualRequests,usage:loop.usage,elapsedMs:loop.elapsedMs,toolReadbacks:loop.toolReadbacks};
    if(isCompletedBrokerToolFeedbackV1(loop)&&loop.actualToolActions===2&&loop.actualRequests>=2&&loop.usage.inputTokens>0&&loop.usage.outputTokens>0){
      pass('INFERENCE','BOUNDED_TOOL_FEEDBACK_COMPLETED',log);
      // Honest owner-bound observation labels only: the loop and the exchange
      // were actually observed; model provenance is NOT claimed here.
      receipt.scope.directTransport='OBSERVED_OWNER_BOUND_EXCHANGE';receipt.scope.nativeLoop='OBSERVED_TOOL_LOOP_MODEL_PROVENANCE_PENDING';
      receipt.verdict='OWNER_BOUND_TOOL_LOOP_OBSERVED_REAL_MODEL_NOT_QUALIFIED';log.push('VERDICT=OWNER_BOUND_TOOL_LOOP_OBSERVED_REAL_MODEL_NOT_QUALIFIED');
      return {exitCode:0,receipt,log};
    }
    receipt.scope.directTransport='OBSERVED_OWNER_BOUND_EXCHANGE';receipt.scope.nativeLoop='ATTEMPTED_NOT_QUALIFIED';
    const state=loop.usageState==='UNKNOWN_USAGE_RETAINED'?'UNKNOWN_USAGE':'FAILED';
    const reason=isCompletedBrokerToolFeedbackV1(loop)?'QUALIFICATION_OBSERVATION_INCOMPLETE':loop.endReason;
    phases.INFERENCE={state,checkedAtMs:now(),identityDigest,reason};log.push('INFERENCE='+state,'VERDICT=REAL_LOCAL_MODEL_NOT_QUALIFIED');
    return {exitCode:loop.outcome==='BUDGET_ABORTED'?3:loop.outcome==='DENIED'?2:1,receipt,log};
  }
    try{result=await attempt();}finally{
      clearTimeout(timer);controller.abort();
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
