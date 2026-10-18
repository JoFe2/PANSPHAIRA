// PAN591: bounded pre-build source admission at the existing PAN576 owner.
// No package installation, untrusted code execution, model, audio or network.
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {evaluateUiBuildAdmissionV1} from '../../dist/packages/contracts/src/external-plugin-preflight.js';
import {createEvidenceProvenanceRecordV1,verifyEvidenceProvenanceV1} from '../../dist/packages/contracts/src/evidence-provenance.js';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const CATALOG='fixtures/pan591/allowed-ui-build-graph-v1.json';
const CATALOG_SHA='a6805ea5989b621ff2216b805e91cb1b4824d273f8080c22dbd0ac3d0b748e77';
const sha=x=>createHash('sha256').update(x).digest('hex');
const hash=x=>sha(canonicalJson(x));
const fail=code=>{throw new Error(code);};
function frozen(value){if(value&&typeof value==='object'){for(const x of Object.values(value))frozen(x);Object.freeze(value);}return value;}
function ownFile(path){
  if(!/^[A-Za-z0-9._/-]+$/.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..'))fail('UI_ADMISSION_PATH_DENIED');
  let current=ROOT;
  for(const part of path.split('/')){current=join(current,part);if(lstatSync(current).isSymbolicLink())fail('UI_ADMISSION_PATH_DENIED');}
  const stat=lstatSync(current);if(!stat.isFile()||stat.size>131072)fail('UI_ADMISSION_PATH_DENIED');
  return readFileSync(current);
}
function snapshot(){
  const bytes=ownFile(CATALOG);if(sha(bytes)!==CATALOG_SHA)fail('UI_ADMISSION_CATALOG_DRIFT_DENIED');
  const graph=JSON.parse(bytes),files=[],notices=['LICENSE','NOTICE'].map(path=>({path,content:ownFile(path).toString('utf8')}));
  const ownLicense=sha(ownFile('LICENSE')),ownNotice=sha(ownFile('NOTICE'));
  const nodeLicense=readFileSync(join(dirname(dirname(process.execPath)),'LICENSE'));
  if(process.version!=='v24.14.1')fail('UI_ADMISSION_RUNTIME_IDENTITY_DENIED');
  const nodeDigest=sha(readFileSync(process.execPath));
  for(const r of graph.resources){
    if(r.kind==='RUNTIME'){
      if(r.path!=='$QUALIFIED_NODE'||r.sha256!==nodeDigest||r.licenceSha256!==sha(nodeLicense)||r.noticeSha256!==sha(nodeLicense))fail('UI_ADMISSION_RUNTIME_IDENTITY_DENIED');
    }else{
      const content=ownFile(r.path);if(sha(content)!==r.sha256||r.licenceSha256!==ownLicense||r.noticeSha256!==ownNotice)fail('UI_ADMISSION_CONTENT_DRIFT_DENIED');
      files.push({path:r.path,content:content.toString('utf8')});
    }
  }
  return frozen({graph,sourceFiles:files,notices,catalogDigest:CATALOG_SHA});
}
export function admitPan591UiBuildGraph(untrusted){
  const held=snapshot(),decision=evaluateUiBuildAdmissionV1(untrusted,held.graph);
  if(decision.outcome!=='GRAPH_ADMISSIBLE')fail(decision.reasonCodes[0]);
  return held;
}
function actualSourceHead(){
  const r=spawnSync('git',['-C',ROOT,'rev-parse','HEAD','HEAD^{tree}'],{encoding:'utf8',timeout:5000,maxBuffer:4096});
  const values=(r.stdout??'').trim().split('\n');
  if(r.status!==0||values.length!==2||!values.every(x=>/^[a-f0-9]{40}$/.test(x)))fail('UI_ADMISSION_SOURCE_HEAD_DENIED');
  const status=spawnSync('git',['-C',ROOT,'status','--porcelain','--untracked-files=normal'],{encoding:'utf8',timeout:5000,maxBuffer:65536});
  if(status.status!==0||status.stdout!=='')fail('UI_ADMISSION_IMMUTABLE_LOCAL_SOURCE_REQUIRED');
  return{commitSha:values[0],treeSha:values[1]};
}
export function packagePan591AdmittedGraph(held){
  // Fresh actual file/runtime/notice read; never turn a copied PASS into authority.
  const current=snapshot();if(hash(current)!==hash(held))fail('UI_ADMISSION_CONTENT_DRIFT_DENIED');
  const packageBytes=canonicalJson({schemaVersion:'pansphaira.ui-build-admission/source-package/v1',graph:held.graph,sourceFiles:held.sourceFiles,notices:held.notices});
  const resultDigest=sha(packageBytes),inputsDigest=hash(held.graph),head=actualSourceHead();
  const made=createEvidenceProvenanceRecordV1({recordId:'pan591-own-ui-graph',dataClass:'PUBLIC_SYNTHETIC',
    claim:{claimId:'pan591.exact-own-graph-admission',statement:'Exact own synthetic source graph and prequalified local-only runtime admitted and read back. Not UI build isolation, rendering, model execution, independent acceptance or legal rights beyond this exact catalog.'},
    evidenceClass:'SELF_GENERATED',head,inputs:{inputsDigest},oracle:{oracleId:'pan591-owned-catalog-v1',oracleDigest:held.catalogDigest},
    verifier:{implementation:'pan591.source-admission-v1',tool:'node',model:'NONE',identityClass:'DETERMINISTIC_TOOL'},
    invocationDigest:hash(['existing-pan576-controller','freeze-ui-graph','packageUiGraph']),environment:{platform:process.platform,runtime:process.version},
    timestamp:new Date().toISOString(),ci:{provider:'NONE',runId:'NONE',runUrl:'NONE',jobId:'NONE'},
    provider:{organization:'NONE',readbackUrl:'NONE',readbackDigest:'NONE',readbackTimestamp:'NONE'},
    review:{producerId:'NONE',producerOrganization:'NONE',reviewerId:'NONE',reviewerIdentityDigest:'NONE'},method:'DETERMINISTIC_RECOMPUTATION',resultDigest});
  if(made.outcome!=='BUILT')fail('UI_ADMISSION_PROVENANCE_DENIED');
  const verification=verifyEvidenceProvenanceV1(made.record,{head,inputsDigest,oracleDigest:held.catalogDigest,ciRunId:'NONE',providerReadbackDigest:'NONE',resultDigest});
  if(verification.outcome!=='VERIFIED')fail('UI_ADMISSION_PROVENANCE_DENIED');
  return frozen({outcome:'ADMITTED_SOURCE_GRAPH_READ_BACK',packageBytes,packageDigest:resultDigest,catalogDigest:held.catalogDigest,provenance:made.record,
    executionAuthority:false,installationAuthority:false,activationAuthority:false,modelRun:'NOT_RUN',audioRun:'NOT_RUN',arbitraryBuildExecution:'NOT_RUN_OWNER589'});
}
