import {canonicalJson} from './canonical-json.js';
import {configurationClosedObjectV1,validateAgentConfigurationAnswersV1,validateAgentConfigurationDraftV1,evaluateAgentConfigurationDraftV1,applyAgentConfigurationAnswersV1,createAgentConfigurationDraftV1} from './agent-configuration-draft-v1.js';
import type {AgentConfigurationPolicyV1,AgentConfigurationDraftV1,AgentConfigurationFieldV1,AgentConfigurationValueV1,AgentConfigurationFieldStateV1} from './agent-configuration-draft-v1.js';
export const AGENT_CONFIGURATION_TRANSFER_SCHEMA_V1='pansphaira.agent-configuration/transfer/v1' as const;
export const AGENT_CONFIGURATION_TRANSFER_COMMAND_V1='pansphaira.agent-configuration/transfer-command/v1' as const;
// Portable intent only, not a draft readback, personal view, widget or executable
// connection artifact. The recipient's existing policy rechecks all references.
export type AgentConfigurationTransferV1=Readonly<{schemaVersion:typeof AGENT_CONFIGURATION_TRANSFER_SCHEMA_V1;adapterVersion:'pan441-pan529/v1';references:Readonly<{profileId:string;profileDigest:string;configurationVersion:'pansphaira.agent-configuration/draft/v1';runtimeTemplateSchemaVersion:'pansphaira.portable-runtime/template/v1';capabilities:readonly string[]}>;values:readonly Readonly<{field:AgentConfigurationFieldV1;value:AgentConfigurationValueV1|null;intent:'VALUE'|'UNKNOWN'}>[];redaction:'NO_SECRETS_NO_BUSINESS_PAYLOADS';authorityGranted:false;activationAuthorized:false}>;
const deny=(code:string):never=>{throw Error('CONFIGURATION_TRANSFER_'+code);};
// Static finite policy fields only; no source identity, template binding digest,
// access/credential/proof fields or personal/session/control/memory content.
const portable=(p:AgentConfigurationPolicyV1)=>Object.keys(p.fields).filter(k=>!k.startsWith('access.')&&!k.startsWith('runtime.')&&!['goal.agentName','goal.useCase','model.secretReference'].includes(k)) as AgentConfigurationFieldV1[];
const refs=(p:AgentConfigurationPolicyV1)=>({profileId:p.profileId,profileDigest:p.profileDigest,configurationVersion:'pansphaira.agent-configuration/draft/v1' as const,runtimeTemplateSchemaVersion:'pansphaira.portable-runtime/template/v1' as const,capabilities:[...p.fields['tools.capabilities'].allowedValues] as string[]});
function dense(v:unknown,max:number):unknown[]{if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>max)return deny('SCHEMA_DENIED');const ds=Object.getOwnPropertyDescriptors(v);if(Reflect.ownKeys(ds).length!==v.length+1||Array.from({length:v.length},(_,i)=>ds[String(i)]).some(d=>!d||!d.enumerable||!('value'in d)))deny('SCHEMA_DENIED');return v;}
export function validateAgentConfigurationTransferV1(value:unknown,p:AgentConfigurationPolicyV1):AgentConfigurationTransferV1{
 const v=configurationClosedObjectV1(value,['schemaVersion','adapterVersion','references','values','redaction','authorityGranted','activationAuthorized']);
 if(v.schemaVersion!==AGENT_CONFIGURATION_TRANSFER_SCHEMA_V1||v.adapterVersion!==p.adapterVersion)deny('VERSION_UNSUPPORTED_ORPHAN');
 const r=configurationClosedObjectV1(v.references,['profileId','profileDigest','configurationVersion','runtimeTemplateSchemaVersion','capabilities']);dense(r.capabilities,16);
 if(canonicalJson({...r})!==canonicalJson(refs(p)))deny('REFERENCES_INCOMPATIBLE_ORPHAN');
 if(v.redaction!=='NO_SECRETS_NO_BUSINESS_PAYLOADS'||v.authorityGranted!==false||v.activationAuthorized!==false)deny('AUTHORITY_DENIED');
 const values=dense(v.values,32),ks=portable(p);if(values.length!==ks.length)deny('FIELDS_DENIED');
 const answers=values.map((item,index)=>{const a=configurationClosedObjectV1(item,['field','value','intent']);if(a.field!==ks[index]||!['VALUE','UNKNOWN'].includes(a.intent as string))deny('FIELDS_DENIED');return {field:a.field,value:a.value,confirmation:a.intent==='VALUE'?'CONFIRM':'UNKNOWN'};});
 validateAgentConfigurationAnswersV1({schemaVersion:'pansphaira.agent-configuration/answers/v1',expectedRevision:0,answers},p);
 return JSON.parse(canonicalJson(value)) as AgentConfigurationTransferV1;
}
export function exportAgentConfigurationTransferV1(draft:unknown,p:AgentConfigurationPolicyV1):AgentConfigurationTransferV1{
 const d=validateAgentConfigurationDraftV1(draft,p);if(evaluateAgentConfigurationDraftV1(d,p).outcome!=='RESOLVED')deny('COMPLETE_DRAFT_REQUIRED');
 const v={schemaVersion:AGENT_CONFIGURATION_TRANSFER_SCHEMA_V1,adapterVersion:p.adapterVersion,references:refs(p),values:portable(p).map(field=>({field,value:d.fields[field].value,intent:['UNKNOWN','CONTRADICTED'].includes(d.fields[field].confirmation)?'UNKNOWN' as const:'VALUE' as const})),redaction:'NO_SECRETS_NO_BUSINESS_PAYLOADS',authorityGranted:false,activationAuthorized:false};return validateAgentConfigurationTransferV1(v,p);
}
export function importAgentConfigurationTransferV1(value:unknown,p:AgentConfigurationPolicyV1):AgentConfigurationDraftV1{
 const envelope=validateAgentConfigurationTransferV1(value,p),base=createAgentConfigurationDraftV1(p);
 // Reuse the existing reducer/validator. Recipient-owned template values are
 // fresh; every transported value is explicitly untrusted and unconfirmed.
 const proposed=applyAgentConfigurationAnswersV1(base,{schemaVersion:'pansphaira.agent-configuration/answers/v1',expectedRevision:0,answers:envelope.values.map(v=>({field:v.field,value:null,confirmation:'UNKNOWN'}))},p),fields=structuredClone(proposed.fields) as Record<AgentConfigurationFieldV1,AgentConfigurationFieldStateV1>;
 for(const {field,value,intent}of envelope.values)fields[field]={value,source:'UNRESOLVED',confirmation:intent==='UNKNOWN'?'UNKNOWN':'STALE',validation:{status:intent==='UNKNOWN'?'UNKNOWN':'STALE',digest:null}};
 // Credential/model readiness never crosses the boundary. NONE is still a
 // proposal requiring an explicit answer; proofs always remain NOT_RUN.
 for(const k of ['access.checkStatus'] as const)fields[k]={value:null,source:'UNRESOLVED',confirmation:'UNKNOWN',validation:{status:'UNKNOWN',digest:null}};
 return validateAgentConfigurationDraftV1({...proposed,fields},p);
}
export function validateAgentConfigurationTransferCommandV1(value:unknown,p:AgentConfigurationPolicyV1){
 const v=configurationClosedObjectV1(value,['schemaVersion','operation','expectedRevision','envelope']);if(v.schemaVersion!==AGENT_CONFIGURATION_TRANSFER_COMMAND_V1||!['INSPECT','IMPORT'].includes(v.operation as string))deny('COMMAND_DENIED');
 if(!Number.isSafeInteger(v.expectedRevision)||(v.expectedRevision as number)<0||Object.is(v.expectedRevision,-0))deny('REVISION_DENIED');
 return {operation:v.operation as 'INSPECT'|'IMPORT',expectedRevision:v.expectedRevision as number,envelope:validateAgentConfigurationTransferV1(v.envelope,p)};
}
