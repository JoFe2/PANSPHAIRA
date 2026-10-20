// One exact locked developer-readback profile at the existing PAN591 owner.
// Source/dependency admission and fixed trusted diagnostics are NOT arbitrary
// UI-code execution, install, native-effect, model/audio or activation grants.
import{readFileSync,lstatSync,readdirSync}from'node:fs';
import{createHash}from'node:crypto';
import{join,dirname}from'node:path';
import{fileURLToPath}from'node:url';
import{types}from'node:util';
import{spawnSync}from'node:child_process';
import{canonicalJson}from'../../dist/packages/contracts/src/canonical-json.js';
import{createEvidenceProvenanceRecordV1,verifyEvidenceProvenanceV1}from'../../dist/packages/contracts/src/evidence-provenance.js';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const POLICY='fixtures/pan594/locked-ajv2020-dev-readback-policy-v1.json',POLICY_SHA="39b3847dd6136e398eff7ec1c9626ba846d4de7a7370b4301854a20f48a91b96";
export const PAN591_LOCKED_DEV_READBACK_SCHEMA_V1='pansphaira.ui-build-admission/locked-dev-readback/v1';
const HELD=new WeakSet(),sha=b=>createHash('sha256').update(b).digest('hex'),hash=v=>sha(canonicalJson(v));
const fail=c=>{throw Error(c);};
function freeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
function own(path){
 if(typeof path!=='string'||!/^[-A-Za-z0-9_./]+$/.test(path)||path.split('/').some(s=>!s||s==='.'||s==='..'))fail('PAN591_DEV_PATH_DENIED');
 let p=ROOT;for(const s of path.split('/')){p=join(p,s);if(lstatSync(p).isSymbolicLink())fail('PAN591_DEV_PATH_DENIED');}
 const st=lstatSync(p);if(!st.isFile()||st.size>131072)fail('PAN591_DEV_PATH_DENIED');return readFileSync(p);
}
function files(path){
 const out=[];function walk(rel){const absolute=join(ROOT,path,rel);if(lstatSync(absolute).isSymbolicLink())fail('PAN591_DEV_PATH_DENIED');for(const name of readdirSync(absolute)){const r=rel?rel+'/'+name:name,p=join(absolute,name),s=lstatSync(p);if(s.isSymbolicLink())fail('PAN591_DEV_PATH_DENIED');if(s.isDirectory())walk(r);else if(s.isFile())out.push(r);else fail('PAN591_DEV_PATH_DENIED');}}walk('');return out.sort();
}
function snapshot(){
 const raw=own(POLICY);if(sha(raw)!==POLICY_SHA)fail('PAN591_DEV_OWNER_POLICY_DRIFT_DENIED');const policy=JSON.parse(raw);
 if(process.version!=='v24.14.1'||process.platform!=='linux'||process.arch!=='x64'||sha(readFileSync(process.execPath))!==policy.runtime.sha256||sha(readFileSync(join(dirname(dirname(process.execPath)),'LICENSE')))!==policy.runtime.licenseSHA256)fail('PAN591_DEV_RUNTIME_IDENTITY_DENIED');
 for(const r of policy.ownInputs){if(sha(own(r.path))!==r.sha256||sha(own('LICENSE'))!==r.licenseSHA256||sha(own('NOTICE'))!==r.noticeSHA256)fail('PAN591_DEV_SOURCE_OR_NOTICE_DRIFT_DENIED');}
 for(const r of policy.nativeInputs)if(sha(own(r.path))!==r.sha256)fail('PAN591_DEV_NATIVE_CONSUMER_DRIFT_DENIED');
 const lock=JSON.parse(own('package-lock.json')),selected=new Set(policy.packages.map(p=>p.name)),visited=new Set();
 function visit(name){if(visited.has(name))return;const p=policy.packages.find(p=>p.name===name);if(!p)fail('PAN591_DEV_DEPENDENCY_CLOSURE_DENIED');visited.add(name);for(const dep of Object.keys(p.dependencies))visit(dep);}visit('ajv');if(visited.size!==selected.size)fail('PAN591_DEV_DEPENDENCY_CLOSURE_DENIED');
 let sourceBytes=0,members=0;
 for(const p of policy.packages){
  const root='node_modules/'+p.name,l=lock.packages[root];if(!l||l.version!==p.version||l.resolved!==p.resolved||l.integrity!==p.integrity||canonicalJson(l.dependencies??{})!==canonicalJson(p.dependencies))fail('PAN591_DEV_INSTALL_PIN_DRIFT_DENIED');
  if(!['MIT','BSD-3-Clause'].includes(p.license)||p.rights!=='EXACT_LICENSED_LOCAL_DEVELOPER_REFERENCE_NO_UI_DISTRIBUTION_OR_MEDIA_GRANT')fail('PAN591_DEV_RIGHTS_SCOPE_DENIED');
  const pkg=JSON.parse(own(root+'/package.json'));if(pkg.name!==p.name||pkg.version!==p.version||pkg.license!==p.license)fail('PAN591_DEV_INSTALL_PIN_DRIFT_DENIED');
  if(canonicalJson(files(root))!==canonicalJson(p.members.map(m=>m.path).sort()))fail('PAN591_DEV_MEMBER_SET_DRIFT_DENIED');
  for(const m of p.members){const b=own(root+'/'+m.path);if(b.length!==m.bytes||sha(b)!==m.sha256)fail('PAN591_DEV_MEMBER_BYTES_DRIFT_DENIED');sourceBytes+=b.length;members++;}
  if(!p.licenseInputs.length)fail('PAN591_DEV_LICENSE_EVIDENCE_DENIED');for(const n of p.licenseInputs)if(sha(own(root+'/'+n.path))!==n.sha256)fail('PAN591_DEV_LICENSE_EVIDENCE_DENIED');
 }
 const graph={schemaVersion:PAN591_LOCKED_DEV_READBACK_SCHEMA_V1,profileId:policy.profileId,version:policy.version,catalogDigest:POLICY_SHA};
 return freeze({kind:'LOCKED_DEV_READBACK',graph,catalogDigest:POLICY_SHA,policy,verifiedPackages:policy.packages.map(p=>({name:p.name,version:p.version,license:p.license,integrity:p.integrity,tarSHA256:p.tarSHA256})),verifiedMemberCount:members,verifiedDependencySourceBytes:sourceBytes,schema:JSON.parse(own('fixtures/pan594/native-observation-projection-schema-v1.json'))});
}
function exactSelector(value,expected){
 if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;const d=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(d);if(keys.length!==4||keys.some(k=>typeof k!=='string'||!['schemaVersion','profileId','version','catalogDigest'].includes(k)))return false;return keys.every(k=>d[k].enumerable&&'value'in d[k]&&d[k].value===expected[k]);
}
export function admitPan591LockedDevReadbackGraph(value){const held=snapshot();if(!exactSelector(value,held.graph))fail('PAN591_DEV_EXACT_OWNER_POLICY_DENIED');HELD.add(held);return held;}
export function revalidatePan591LockedDevReadbackGraph(held){if(!held||!HELD.has(held))fail('PAN591_DEV_NATIVE_ADMISSION_REQUIRED');const fresh=snapshot();if(hash(fresh)!==hash(held))fail('PAN591_DEV_ADMITTED_RESOURCE_DRIFT_DENIED');return fresh;}
function head(){const h=spawnSync('git',['-C',ROOT,'rev-parse','HEAD','HEAD^{tree}'],{encoding:'utf8',timeout:5000,maxBuffer:4096}),s=spawnSync('git',['-C',ROOT,'status','--porcelain','--untracked-files=normal'],{encoding:'utf8',timeout:5000,maxBuffer:65536}),v=(h.stdout??'').trim().split('\n');if(h.status||s.status||s.stdout!==''||v.length!==2||!v.every(x=>/^[a-f0-9]{40}$/.test(x)))fail('PAN591_DEV_IMMUTABLE_SOURCE_REQUIRED');return{commitSha:v[0],treeSha:v[1]};}
export function packagePan591LockedDevReadbackGraph(held){
 const r=revalidatePan591LockedDevReadbackGraph(held),actualHead=head(),packageBytes=canonicalJson({schemaVersion:'pansphaira.ui-build-admission/locked-dev-source-package/v1',graph:r.graph,policy:r.policy,verifiedPackages:r.verifiedPackages,verifiedMemberCount:r.verifiedMemberCount,verifiedDependencySourceBytes:r.verifiedDependencySourceBytes}),resultDigest=sha(packageBytes),inputsDigest=hash(r.graph);
 const made=createEvidenceProvenanceRecordV1({recordId:'pan594-exact-locked-dev-readback',dataClass:'PUBLIC_SYNTHETIC',claim:{claimId:'pan594.fixed-dev-readback-source-admission',statement:'Exact already-locked source and license scope for one fixed trusted readonly developer diagnostic. Not arbitrary UI code, native effect, install, activation, model/audio, independent acceptance or an observed leak/noLeak claim.'},evidenceClass:'SELF_GENERATED',head:actualHead,inputs:{inputsDigest},oracle:{oracleId:'pan591-code-owned-locked-dev-profile-v1',oracleDigest:POLICY_SHA},verifier:{implementation:'pan591.locked-dev-resource-admission-v1',tool:'node',model:'NONE',identityClass:'DETERMINISTIC_TOOL'},invocationDigest:hash(['existing-pan471-owner','locked-dev-source-readback']),environment:{platform:process.platform,runtime:process.version},timestamp:new Date().toISOString(),ci:{provider:'NONE',runId:'NONE',runUrl:'NONE',jobId:'NONE'},provider:{organization:'NONE',readbackUrl:'NONE',readbackDigest:'NONE',readbackTimestamp:'NONE'},review:{producerId:'NONE',producerOrganization:'NONE',reviewerId:'NONE',reviewerIdentityDigest:'NONE'},method:'DETERMINISTIC_RECOMPUTATION',resultDigest});
 if(made.outcome!=='BUILT'||verifyEvidenceProvenanceV1(made.record,{head:actualHead,inputsDigest,oracleDigest:POLICY_SHA,ciRunId:'NONE',providerReadbackDigest:'NONE',resultDigest}).outcome!=='VERIFIED')fail('PAN591_DEV_PROVENANCE_DENIED');
 return freeze({outcome:'ADMITTED_LOCKED_DEV_SOURCE_GRAPH_READ_BACK',packageBytes,packageDigest:resultDigest,catalogDigest:POLICY_SHA,provenance:made.record,executionAuthority:false,installationAuthority:false,activationAuthority:false,arbitraryUiBuildExecution:false,modelRun:'NOT_RUN',audioRun:'NOT_RUN'});
}
