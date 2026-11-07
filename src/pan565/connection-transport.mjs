// One code-owned transport attached to the EXISTING ModelAccessBroker. No
// client URL, credential store, provider fallback, environment credentials or
// generic controller. Initially only existing OPENAI_CHAT_COMPLETIONS framing.
import {request as httpsRequest} from 'node:https';
import {request as httpRequest} from 'node:http';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readProtectedOwnerSecretFileV1} from '../pan527/origin-session-adapter.mjs';
import {modelConnectionClosedV1 as exact,modelConnectionArrayV1,validateModelConnectionSummaryV1,validateModelConnectionLimitsV1} from '../../dist/packages/contracts/src/workspace-model-connection-v1.js';
import {isModelChatCallIdV1} from '../../dist/packages/contracts/src/model-tool-transcript-v1.js';
const sha=v=>createHash('sha256').update(v).digest('hex'),fail=(c='MODEL_CONNECTION_TARGET_DENIED')=>{throw Error(c);};
// Closed, versioned provider-wire name adaptation for the ACTUAL native UI
// owner path (#565 owner -> #575 shared loop -> #548 consumer). The available
// local server enforces dotted-free function names (real HTTP 400 observed on
// dotted wire names). This binding is a presentation-only rename of the two
// exact native UI capabilities: native names, rights, schemas, invoke/validate,
// opaque case-sensitive call_ids, fresh challenges and owner settlement stay
// original, and every response name is restored to the exact known native
// identity before broker/owner validation. No generic normalization, no free
// registry, no model-selectable alias rights, no new capability. The adapter
// engages ONLY on requests that actually declare a UI-catalog name; a request
// carrying only other dotted names (the original574 native composition
// capability ids) passes through byte-identical and keeps its ORIGINAL
// broker/tool guards. These bytes
// are covered by the file-byte adapterDigest/parserDigest below, so changed
// adapter bytes invalidate every bound summary, freshness check and ledger
// identity through the EXISTING owner identity check. Aliases never mint
// authority; the separate #546 preview/confirmation/CAS authority is untouched.
export const MODEL_UI_WIRE_ALIAS_V1=Object.freeze({schemaVersion:'pansphaira.model-connection/ui-wire-alias/v1',binding:Object.freeze({'ui.view.read':'ui_view_read','ui.view.propose':'ui_view_propose'})});
// Original574 composition admission runs on this SAME owner/consent/ledger
// with its OWN code-owned purpose. The exact original capability pair
// pan522.material.plan + erp.order.create keeps its dotted native wire names
// (no alias rights here); admission requires this purpose to be explicitly
// enumerated in the owner-bound product grant. A probe/UI-only grant can
// never admit composition and this purpose alone can never admit a UI task:
// closed third purpose, not a widened or client-selectable catalog.
export const MODEL_CONNECTION_COMPOSITION_PURPOSE_V1='purpose:pan574-composition-feedback';
const wireAliasTokenV1=/^[A-Za-z0-9_-]{1,64}$/;
export function adaptNativeUiWireRequestV1(request,binding=MODEL_UI_WIRE_ALIAS_V1.binding){
 if(!request||typeof request!=='object'||Array.isArray(request)||!binding||typeof binding!=='object'||Array.isArray(binding))fail('MODEL_CONNECTION_WIRE_ALIAS_DENIED');
 // Closed registry: the ONLY accepted mapping is the exact code-owned binding.
 // A caller-supplied second argument that deviates in any way (forged, foreign
 // or partial) is refused explicitly — never silently honoured, never silently
 // ignored. There is no free registry configuration.
 const owned=Object.entries(MODEL_UI_WIRE_ALIAS_V1.binding),entries=Object.entries(binding);
 if(entries.length!==owned.length||entries.some(([n,a])=>MODEL_UI_WIRE_ALIAS_V1.binding[n]!==a))fail('MODEL_CONNECTION_WIRE_ALIAS_DENIED');
 const aliasOf=new Map(entries);
 if(!entries.length||entries.some(([n,a])=>typeof n!=='string'||!n.includes('.')||typeof a!=='string'||!wireAliasTokenV1.test(a)||a===n)||new Set(entries.map(([,a])=>a)).size!==entries.length)fail('MODEL_CONNECTION_WIRE_ALIAS_DENIED');
 const declared=new Set(),tools=Array.isArray(request.tools)?request.tools:[],messages=Array.isArray(request.messages)?request.messages:[];
 for(const t of tools)if(typeof t?.function?.name==='string')declared.add(t.function.name);
 for(const m of messages)if(m?.role==='assistant'&&Array.isArray(m.tool_calls))for(const c of m.tool_calls)if(typeof c?.function?.name==='string')declared.add(c.function.name);
 // Integration seam: this closed adapter engages ONLY on requests that
 // actually declare the UI catalog. Every binding key is dotted, so a request
 // without a single UI-catalog name (e.g. the original574 native composition
 // tools with their own dotted capability ids pan522.material.plan /
 // erp.order.create) is the untouched pre-existing provider path: byte-
 // identical pass-through, aliases null, and the ORIGINAL broker/tool guards
 // decide there — never renamed, never blocked here, never admitted as a
 // capability by this adapter.
 if(![...declared].some(n=>aliasOf.has(n)))return {request,aliases:null};
 const dotted=[...declared].filter(n=>n.includes('.'));
 // Actual UI-catalog request: every dotted/mixed name must map exactly through
 // the closed binding. Unknown or colliding dotted/mixed names (including a
 // UI-catalog name combined with a foreign dotted name) are refused BEFORE
 // dispatch; the provider-incompatible name is never silently renamed/dropped.
 if(dotted.some(n=>!aliasOf.has(n))||declared.size!==new Set([...declared].map(n=>aliasOf.get(n)??n)).size)fail('MODEL_CONNECTION_WIRE_NAME_DENIED');
 // Outbound: native -> wire for declared tools AND the assistant transcript.
 // Responses are restored through the separate wire -> native map; any
 // response name that is not exactly a known wire alias is refused below.
 const toWire=new Map(dotted.map(n=>[n,aliasOf.get(n)])),aliases=new Map(dotted.map(n=>[aliasOf.get(n),n])),wire=structuredClone(request);
 for(const t of(wire.tools??[]))if(toWire.has(t?.function?.name))t.function.name=toWire.get(t.function.name);
 for(const m of(wire.messages??[]))if(m?.role==='assistant'&&Array.isArray(m.tool_calls))for(const c of m.tool_calls)if(toWire.has(c?.function?.name))c.function.name=toWire.get(c.function.name);
 return {request:wire,aliases};
}
export const connectionTransportIdentityV1=()=>({adapterDigest:sha(readFileSync(new URL('./connection-transport.mjs',import.meta.url))),parserDigest:sha(readFileSync(new URL('./connection-transport.mjs',import.meta.url)))});
const publicV4=ip=>{if(isIP(ip)!==4)return false;const[a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&[0,168].includes(b)||a===100&&b>=64&&b<=127||a===198&&[18,19,51].includes(b)||a===203&&b===0||a>=224);};
export function bindModelConnectionTransportV1(value){
 const o=exact(value,['summary','target','credentialFile','pricing','productGrant']),summary=validateModelConnectionSummaryV1(o.summary),target=exact(o.target,['origin','allowedAddresses','localOnly']),pricing=o.pricing===null?null:exact(o.pricing,['currency','revision','inputMicrosPerMillionTokens','outputMicrosPerMillionTokens']);
 target.allowedAddresses=modelConnectionArrayV1(target.allowedAddresses,8);Object.freeze(target);
 if(summary.identity.adapterDigest!==connectionTransportIdentityV1().adapterDigest||summary.identity.parserDigest!==connectionTransportIdentityV1().parserDigest||typeof target.localOnly!=='boolean'||!Array.isArray(target.allowedAddresses)||target.allowedAddresses.length<1||target.allowedAddresses.length>8||target.allowedAddresses.some(v=>typeof v!=='string'||isIP(v)!==4)||new Set(target.allowedAddresses).size!==target.allowedAddresses.length)fail();
 let url;try{url=new URL(target.origin);}catch{fail();}
 if(typeof target.origin!=='string'||url.origin!==target.origin||url.username||url.password||url.hash||url.search||url.pathname!=='/'||url.hostname.endsWith('.'))fail();
 if(target.localOnly){if(url.hostname!=='127.0.0.1'||target.allowedAddresses.length!==1||target.allowedAddresses[0]!=='127.0.0.1'||!['http:','https:'].includes(url.protocol))fail();}
 else if(url.protocol!=='https:'||summary.authMethod==='NONE_LOCAL'||target.allowedAddresses.some(a=>!publicV4(a))||isIP(url.hostname)&&!publicV4(url.hostname))fail();
 if(summary.evidenceClass==='SYNTHETIC_ONLY'&&(summary.provider!=='provider:synthetic-model'||summary.model!=='model:synthetic-v1'||!target.localOnly)||summary.evidenceClass==='OWNER_BOUND_NOT_QUALIFIED'&&summary.provider==='provider:synthetic-model')fail();
 if(summary.authMethod==='NONE_LOCAL'&&o.credentialFile!==null||summary.authMethod==='EXISTING_SECRET_REFERENCE'&&(typeof o.credentialFile!=='string'||!o.credentialFile.startsWith('/')))fail('MODEL_CONNECTION_SECRET_UNAVAILABLE');
 if(pricing&&(typeof pricing.currency!=='string'||!/^[A-Z]{3}$/.test(pricing.currency)||!Number.isSafeInteger(pricing.revision)||pricing.revision<1||['inputMicrosPerMillionTokens','outputMicrosPerMillionTokens'].some(k=>!Number.isSafeInteger(pricing[k])||pricing[k]<0||pricing[k]>1000000000)))fail('MODEL_CONNECTION_PRICING_DENIED');
 // Nonzero-priced real calls require an independently owner-bound product
 // grant in addition to the exact browser confirmation. Null is default deny.
 const grant=o.productGrant===null?null:exact(o.productGrant,Object.hasOwn(o.productGrant,'allowedPurposes')?['limits','testDataDigest','expiresAtMs','allowedPurposes']:['limits','testDataDigest','expiresAtMs']);
 if(grant){grant.limits=validateModelConnectionLimitsV1(grant.limits);if(Object.hasOwn(grant,'allowedPurposes')){grant.allowedPurposes=modelConnectionArrayV1(grant.allowedPurposes,3);if(!grant.allowedPurposes.length||new Set(grant.allowedPurposes).size!==grant.allowedPurposes.length||grant.allowedPurposes.some(p=>!['purpose:ui-connection-probe','purpose:ui-view-proposal',MODEL_CONNECTION_COMPOSITION_PURPOSE_V1].includes(p)))fail('MODEL_CONNECTION_PRODUCT_CONSENT_DENIED');}}
 const secret=()=>{if(summary.authMethod==='NONE_LOCAL')return {value:null,fingerprint:null};let b;try{b=readProtectedOwnerSecretFileV1(o.credentialFile);}catch{fail('MODEL_CONNECTION_SECRET_UNAVAILABLE');}const value=b.toString('utf8').trim();b.fill(0);if(!/^[A-Za-z0-9._~-]{8,4096}$/.test(value))fail('MODEL_CONNECTION_SECRET_UNAVAILABLE');return {value,fingerprint:sha(value)};};
 async function addresses(signal){
  if(signal.aborted)fail('MODEL_CONNECTION_TIMEOUT');
  const pending=isIP(url.hostname)?Promise.resolve([{address:url.hostname,family:4}]):lookup(url.hostname,{all:true,verbatim:true});
  // lookup itself cannot be cancelled. Detach admission on timeout or owner
  // retirement; a late result/rejection is consumed and can open no socket.
  const ips=await new Promise((resolve,reject)=>{let done=false;const finish=(error,value)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);error?reject(Error(error)):resolve(value);},abort=()=>finish('MODEL_CONNECTION_TIMEOUT');signal.addEventListener('abort',abort,{once:true});pending.then(value=>finish(null,value),()=>finish('MODEL_CONNECTION_DNS_CHANGED_DENIED'));if(signal.aborted)abort();});
  if(signal.aborted)fail('MODEL_CONNECTION_TIMEOUT');if(!ips.length||ips.some(a=>a.family!==4||!target.allowedAddresses.includes(a.address))||new Set(ips.map(a=>a.address)).size!==target.allowedAddresses.length)fail('MODEL_CONNECTION_DNS_CHANGED_DENIED');return ips[0].address;
 }
 async function exchange(method,path,body,signal,authorize,withCredential=true){
  if(!['/v1/models','/v1/chat/completions'].includes(path)||method!=='GET'&&method!=='POST'||method==='GET'&&path!=='/v1/models'||method==='POST'&&path!=='/v1/chat/completions')fail();
  const address=await addresses(signal);authorize();const material=withCredential?secret():{value:null};authorize();if(signal.aborted)fail('MODEL_CONNECTION_TIMEOUT');
  return await new Promise((resolve,reject)=>{let settled=false;const done=(e,v)=>{if(settled)return;settled=true;e?reject(Error(e)):resolve(v);};
   const headers={'content-type':'application/json','accept':'application/json',...(material.value?{authorization:'Bearer '+material.value}:{})};
   const req=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{method,path,headers,agent:false,signal,lookup:(_host,_opts,cb)=>cb(null,address,4)},res=>{
    if(res.socket.remoteAddress!==address&&res.socket.remoteAddress!=='::ffff:'+address){res.destroy();done('MODEL_CONNECTION_PEER_DENIED');return;}
    if(res.statusCode>=300&&res.statusCode<400){res.destroy();done('MODEL_CONNECTION_REDIRECT_DENIED');return;}
    const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>65536){res.destroy();done('MODEL_CONNECTION_RESPONSE_SIZE_DENIED');}else chunks.push(chunk);});res.on('error',()=>done('MODEL_CONNECTION_TRANSPORT_UNKNOWN'));res.on('end',()=>{
     let data=null;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{}
     if(res.statusCode===200&&(!/^application\/json(?:\s*;|$)/i.test(res.headers['content-type']??'')||!data||typeof data!=='object'||Array.isArray(data))){done('MODEL_CONNECTION_RESPONSE_DENIED');return;}
     done(null,{status:res.statusCode,data});
    });
   });req.on('error',()=>done(signal.aborted?'MODEL_CONNECTION_TIMEOUT':'MODEL_CONNECTION_TRANSPORT_UNKNOWN'));req.end(body===null?undefined:JSON.stringify(body));
  });
 }
 async function providerCall(bound,signal,authorize,limits,toolStep=false){
  limits=validateModelConnectionLimitsV1(limits);
  if(summary.evidenceClass!=='SYNTHETIC_ONLY'){if(!pricing)fail('MODEL_CONNECTION_PRICING_DENIED');const maximum=(BigInt(Buffer.byteLength(JSON.stringify(bound.request),'utf8'))*BigInt(pricing.inputMicrosPerMillionTokens)+BigInt(limits.maxTokens)*BigInt(pricing.outputMicrosPerMillionTokens)+999999n)/1000000n;if(maximum>BigInt(limits.maxCostMicros))fail('MODEL_CONNECTION_PRICE_BOUND_DENIED');}
  const wire=adaptNativeUiWireRequestV1(bound.request);
 const r=await exchange('POST','/v1/chat/completions',wire.request,signal,authorize);
  if(r.status!==200||r.data.model!==summary.model)fail('MODEL_CONNECTION_MODEL_ID_DENIED');
  const data=r.data,msg=data.choices?.[0]?.message,u=data.usage;
  const credential=secret().value;if(credential&&JSON.stringify(data).includes(credential))fail('MODEL_CONNECTION_SECRET_ECHO_DENIED');
  const calls=msg?.tool_calls??[];
  if(!msg||!Array.isArray(calls)||calls.length>32||typeof msg.content!=='string'&&!(toolStep&&msg.content===null&&calls.length>0)||!u||!Number.isSafeInteger(u.prompt_tokens)||u.prompt_tokens<0||!Number.isSafeInteger(u.completion_tokens)||u.completion_tokens<0)fail('MODEL_CONNECTION_USAGE_UNKNOWN');
  const ids=new Set();
  const toolCalls=calls.map(t=>{if(!t||typeof t.id!=='string'||(toolStep?!isModelChatCallIdV1(t.id)||ids.has(t.id):!/^tool:[a-z0-9._-]{3,80}$/.test(t.id))||t.type!=='function'||typeof t.function?.name!=='string'||typeof t.function.arguments!=='string')fail('MODEL_CONNECTION_TOOL_FORMAT_DENIED');let args;try{args=JSON.parse(t.function.arguments);}catch{fail('MODEL_CONNECTION_TOOL_FORMAT_DENIED');}ids.add(t.id);let name=t.function.name;if(wire.aliases){if(!wire.aliases.has(name))fail('MODEL_CONNECTION_WIRE_ALIAS_DENIED');name=wire.aliases.get(name);}return {id:t.id,name,arguments:args};});
  let costMicros=0;if(summary.evidenceClass!=='SYNTHETIC_ONLY'){if(!pricing)fail('MODEL_CONNECTION_USAGE_UNKNOWN');costMicros=Math.ceil((u.prompt_tokens*pricing.inputMicrosPerMillionTokens+u.completion_tokens*pricing.outputMicrosPerMillionTokens)/1000000);if(!Number.isSafeInteger(costMicros))fail('MODEL_CONNECTION_USAGE_UNKNOWN');}
  return {contentType:'text/plain',text:msg.content??'',toolCalls,usage:{inputTokens:u.prompt_tokens,outputTokens:u.completion_tokens,costMicros}};
 }
 const snapshot=()=>{let fingerprint=null,available=true;try{fingerprint=secret().fingerprint;}catch{available=false;}return {summary:{...summary,selectable:summary.selectable&&available,availability:{...summary.availability,auth:summary.availability.auth&&available}},secretFingerprint:fingerprint};};
 return Object.freeze({snapshot,exchange,providerCall:(bound,signal,authorize,limits)=>providerCall(bound,signal,authorize,limits,false),providerToolStepCall:(bound,signal,authorize,limits)=>providerCall(bound,signal,authorize,limits,true),secretFingerprint:()=>secret().fingerprint,productGrant:grant===null?null:structuredClone(grant),pricing:pricing===null?null:structuredClone(pricing),targetDigest:sha(JSON.stringify(target)),summary});
}
