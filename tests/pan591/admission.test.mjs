import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createPan471CompositionExecutor} from '../../src/pan471/composition-execution.mjs';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {verifyEvidenceProvenanceV1} from '../../dist/packages/contracts/src/evidence-provenance.js';
const sha=x=>createHash('sha256').update(x).digest('hex');
const graphPath=new URL('../../fixtures/pan591/allowed-ui-build-graph-v1.json',import.meta.url);
const graph=()=>JSON.parse(readFileSync(graphPath,'utf8'));
const clone=x=>structuredClone(x);
const restamp=g=>{const {graphDigest,...body}=g;g.graphDigest=sha(canonicalJson(body));return g;};
function using(fn){const e=createPan471CompositionExecutor();try{return fn(e);}finally{e.controller.close();}}

test('PAN591 AC01..03: exact own UI graph enters actual existing intake and prints independently recomputed source notice provenance pins',()=>using(e=>{
  const g=graph(),handle=e.controller.freeze(g);
  assert.equal(handle.schemaVersion,g.schemaVersion);
  assert.equal(handle.graphDigest,g.graphDigest);
  assert.ok(Object.isFrozen(handle));
  const result=e.tools.packageUiGraph(handle);
  assert.equal(result.outcome,'ADMITTED_SOURCE_GRAPH_READ_BACK');
  const own=mkdtempSync(join(process.env.TMPDIR||process.env.RUNNER_TEMP,'pan591-positive-'));
  try{
    const target=join(own,'qualified-source-package.json');writeFileSync(target,result.packageBytes);
    const independentlyRead=readFileSync(target,'utf8'),payload=JSON.parse(independentlyRead);
    assert.equal(sha(independentlyRead),result.packageDigest);
    assert.equal(payload.graph.graphDigest,g.graphDigest);
    assert.equal(payload.sourceFiles.length,5);
    for(const f of payload.sourceFiles)assert.equal(sha(f.content),g.resources.find(r=>r.path===f.path).sha256);
    assert.ok(payload.notices.some(n=>n.path==='LICENSE'));
    assert.ok(payload.notices.some(n=>n.path==='NOTICE'));
    const p=result.provenance;
    assert.equal(p.evidenceClass,'SELF_GENERATED');assert.equal(p.verifier.model,'NONE');
    assert.equal(p.ci.provider,'NONE');assert.equal(p.review.reviewerId,'NONE');
    const [commitSha,treeSha]=execFileSync('git',['rev-parse','HEAD','HEAD^{tree}'],{encoding:'utf8'}).trim().split('\n');
    const v=verifyEvidenceProvenanceV1(p,{head:{commitSha,treeSha},inputsDigest:sha(canonicalJson(g)),oracleDigest:result.catalogDigest,ciRunId:'NONE',providerReadbackDigest:'NONE',resultDigest:sha(independentlyRead)});
    assert.equal(v.outcome,'VERIFIED',JSON.stringify(v));
    assert.equal(result.executionAuthority,false);assert.equal(result.installationAuthority,false);
    assert.deepEqual(e.controller.activeEvidence(),{running:false,nativeEvidence:null});
    console.log('PAN591_ACTUAL_OWN_GRAPH_NOTICE_PROVENANCE '+JSON.stringify({graph:g,packageDigest:sha(independentlyRead),catalogDigest:result.catalogDigest,evidenceClass:p.evidenceClass,provenanceContentDigest:p.contentDigest,actualSourceFilesRead:payload.sourceFiles.map(f=>({path:f.path,sha256:sha(f.content)})),notices:payload.notices.map(n=>({path:n.path,sha256:sha(n.content)})),modelRun:'NOT_RUN',audioRun:'NOT_RUN',browser:'NOT_APPLICABLE_NO_PRODUCT_UI_CHANGE'}));
  }finally{rmSync(own,{recursive:true,force:true});}
}));

function denial(mutate,code){return using(e=>{const g=graph();mutate(g);restamp(g);assert.throws(()=>e.controller.freeze(g),new RegExp(code));assert.deepEqual(e.controller.activeEvidence(),{running:false,nativeEvidence:null});});}
test('PAN591 original negative: unknown licence denies only this graph before dispatch',()=>denial(g=>g.resources[1].licence='NOASSERTION','UI_ADMISSION_RIGHTS_UNKNOWN'));
test('PAN591 original negative: unknown icon/asset is not authorized by the repo Apache licence',()=>denial(g=>{g.resources.push({...clone(g.resources[3]),id:'unknown-icon',path:'unqualified/icon.svg'});g.resources[0].dependsOn.push('unknown-icon');},'UI_ADMISSION_EXACT_OWNER_POLICY_DENIED'));
test('PAN591 original negative: adapter MIT licence never authorizes model weights or a voice',()=>{
  for(const kind of ['MODEL_WEIGHTS','VOICE','STT','TTS','VAD'])denial(g=>{g.resources[1].kind=kind;g.resources[1].licence='MIT';},'UI_ADMISSION_SEPARATE_MEDIA_RIGHTS_REQUIRED');
});
test('PAN591 original negative: floating dependency denies despite a correctly rehashed graph',()=>denial(g=>g.resources[1].version='^1.0.0','UI_ADMISSION_FLOATING_DEPENDENCY_DENIED'));
test('PAN591 original negative: undeclared cloud transport in actual own code is denied without executing it',()=>using(e=>{
  const path=new URL('../../fixtures/pan591/own-ui/entry.mjs',import.meta.url),before=readFileSync(path);let networkCalls=0;
  const originalFetch=globalThis.fetch;globalThis.fetch=()=>{networkCalls++;throw new Error('MUST_NOT_EXECUTE');};
  try{
    const changed=Buffer.concat([before,Buffer.from("\nglobalThis.fetch('https://example.invalid/never-called');\n")]);writeFileSync(path,changed);
    const g=graph();g.resources[0].sha256=sha(changed);restamp(g);
    assert.throws(()=>e.controller.freeze(g),/UI_ADMISSION_CONTENT_DRIFT_DENIED/);
    assert.equal(networkCalls,0);assert.deepEqual(e.controller.activeEvidence(),{running:false,nativeEvidence:null});
  }finally{globalThis.fetch=originalFetch;writeFileSync(path,before);}
}));
test('PAN591 original negative: AGPL copy has no implied owner decision',()=>denial(g=>g.resources[1].licence='AGPL-3.0-only','UI_ADMISSION_AGPL_DECISION_REQUIRED'));
test('PAN591 rights and exact notice evidence are per-resource, not blanket distribution rights',()=>{
  denial(g=>g.resources[2].noticeSha256=null,'UI_ADMISSION_NOTICE_OR_LICENCE_PIN_DENIED');
  denial(g=>g.resources[5].distribution='BUNDLED_SOURCE','UI_ADMISSION_RIGHTS_SCOPE_DENIED');
  denial(g=>g.resources[3].rights='UNKNOWN','UI_ADMISSION_RIGHTS_UNKNOWN');
});
test('PAN591 network-none is explicit at graph and every resource; even declared egress needs a different qualified workload',()=>{
  denial(g=>g.network.origins.push('https://example.invalid'),'UI_ADMISSION_EGRESS_DENIED');
  denial(g=>g.resources[4].egress.push('https://example.invalid'),'UI_ADMISSION_EGRESS_DENIED');
});
test('PAN591 dependency closure denies duplicate, orphan, missing or cyclic graph members',()=>{
  denial(g=>g.resources.push(clone(g.resources[1])),'UI_ADMISSION_DEPENDENCY_CLOSURE_DENIED');
  denial(g=>g.resources[0].dependsOn.pop(),'UI_ADMISSION_DEPENDENCY_CLOSURE_DENIED');
  denial(g=>g.resources[0].dependsOn.push('absent'),'UI_ADMISSION_DEPENDENCY_CLOSURE_DENIED');
  denial(g=>g.resources[1].dependsOn.push('entry'),'UI_ADMISSION_DEPENDENCY_CLOSURE_DENIED');
});
test('PAN591 precomputed caller digest, extension keys and inherited authority fail closed',()=>using(e=>{
  const forged=graph();forged.graphDigest='0'.repeat(64);assert.throws(()=>e.controller.freeze(forged),/UI_ADMISSION_CONTENT_DIGEST_DENIED/);
  assert.throws(()=>e.controller.freeze({...graph(),reviewApproved:true}),/UI_ADMISSION_SCHEMA_DENIED/);
  let getters=0;const access=graph();Object.defineProperty(access,'resources',{enumerable:true,get(){getters++;throw new Error('trap');}});
  assert.throws(()=>e.controller.freeze(access),/DATA_ONLY_DENIED/);assert.equal(getters,0);
  assert.throws(()=>e.controller.freeze(new Proxy(graph(),{})),/DATA_ONLY_DENIED/);
  assert.throws(()=>e.controller.freeze({schemaVersion:'unknown'}),/PAN576_SUBMISSION_CONTRACT_DENIED/);
}));
test('PAN591 fresh readback rejects real source or policy drift after admission and restored exact source works',()=>using(e=>{
  const h=e.controller.freeze(graph()),path=new URL('../../fixtures/pan591/own-ui/geometry.mjs',import.meta.url),before=readFileSync(path),catalog=readFileSync(graphPath);
  try{writeFileSync(path,Buffer.concat([before,Buffer.from('\n// owned drift\n')]));assert.equal(e.tools.packageUiGraph(h).code,'UI_ADMISSION_CONTENT_DRIFT_DENIED');}
  finally{writeFileSync(path,before);}
  try{writeFileSync(graphPath,Buffer.concat([catalog,Buffer.from('\n')]));assert.equal(e.tools.packageUiGraph(h).code,'UI_ADMISSION_CATALOG_DRIFT_DENIED');}
  finally{writeFileSync(graphPath,catalog);}
  assert.equal(e.tools.packageUiGraph(h).outcome,'ADMITTED_SOURCE_GRAPH_READ_BACK');
}));
test('PAN591 copied/cross-owner handles and closed owner cannot manufacture admission readback',()=>{
  const e=createPan471CompositionExecutor(),other=createPan471CompositionExecutor();
  try{const h=e.controller.freeze(graph());assert.equal(e.tools.packageUiGraph({...h}).code,'AUTHORITY_DENIED');assert.equal(other.tools.packageUiGraph(h).code,'AUTHORITY_DENIED');e.controller.close();assert.equal(e.tools.packageUiGraph(h).code,'AUTHORITY_DENIED');}
  finally{e.controller.close();other.controller.close();}
});
test('PAN591 admission handle cannot enter legacy native-effect execution or claim UI-build/installation authority',async()=>{
  const e=createPan471CompositionExecutor();try{const h=e.controller.freeze(graph());assert.equal((await e.tools.run(h,{})).code,'UI_GRAPH_ADMISSION_IS_NOT_CODE_EXECUTION_AUTHORITY');assert.deepEqual(e.controller.activeEvidence(),{running:false,nativeEvidence:null});}finally{e.controller.close();}
});
test('PAN591 focused registration is canonical exactly once and does not add optional stacks, install scripts or external dynamic capabilities',()=>{
  const pkg=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.scripts['pan591:test'],'node --test tests/pan591/admission.test.mjs');
  assert.equal(pkg.scripts.pretest.split('npm run pan591:test').length,2);
  const g=graph();assert.deepEqual(g.network,{mode:'NONE',origins:[]});assert.equal(g.resources.length,6);
  assert.equal(g.resources.some(r=>/DSH|React|AG-UI|CopilotKit|Odysseus|AGPL|MODEL_WEIGHTS|VOICE/i.test(r.id+' '+r.kind+' '+r.licence)),false);
});
