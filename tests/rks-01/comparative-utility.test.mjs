import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  canonicalDigest,
  validateFrozenInputs,
  scoreClosedAnswer,
  compareReceipts,
  derivePreScoreBlockedVerdict,
  validateProtocolV2Envelope,
  validateBytePreservedArchive,
  validateDualProtocolVerdicts,
} from '../../src/rks-01/comparator.mjs';

const fixture = name => JSON.parse(fs.readFileSync(new URL(`../fixtures/rks-01/${name}`, import.meta.url)));
const suite = fixture('frozen-task-suite-v1.json');
const manifest = fixture('model-runtime-manifest-v1.json');
const rule = fixture('decision-rule-v1.json');
const raw = fixture('raw-rag-corpus-v1.json');
const typed = fixture('typed-knowledge-corpus-v1.json');
const guides = fixture('application-guides-v1.json');
const armsByRole = {
  SMALL_PRIMARY: ['SMALL_CLOSED_BOOK','SMALL_RAW_RAG','SMALL_TYPED_KNOWLEDGE','SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES'],
  SMALL_REPLICATION_CANDIDATE: ['SMALL_RAW_RAG','SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES'],
  LARGE_REFERENCE: ['LARGE_REFERENCE'],
};

function idealAnswer(task) {
  const e = task.expected;
  return {
    answerState: e.answerState,
    materialClaims: e.requiredClaimFragments.length ? [{claim:e.requiredClaimFragments.join(' '), evidenceRefs:e.requiredEvidenceRefs}] : [],
    evidenceRefs: e.requiredEvidenceRefs,
    applicability: e.applicability,
    denials: e.requiredDenials,
    reasoningSummary: 'Closed evidence decision.',
  };
}
function syntheticReceipts() {
  const out=[];
  for (const model of manifest.models) for (const armId of armsByRole[model.role]) for (const task of suite.tasks) {
    const answer=idealAnswer(task);
    // Freeze a weaker Raw baseline while preserving all receipts and denominators.
    if (armId === 'SMALL_RAW_RAG' && task.stratum === 'VERSION_DRIFT_UPDATE') answer.denials=[];
    if (armId === 'SMALL_RAW_RAG' && task.stratum === 'DIRECT_GROUNDED_CLAIM' && task.sourceClass === 'WIKIDATA_STRUCTURED') answer.materialClaims[0].evidenceRefs=[];
    const tokens = armId.includes('WITH_APPLICATION_GUIDES') ? 80 : armId === 'LARGE_REFERENCE' ? 120 : 100;
    out.push({schemaVersion:'pansphaira/rks-01-run-receipt/v1',runId:crypto.randomUUID(),profileId:model.profileId,role:model.role,armId,taskId:task.taskId,sourceClass:task.sourceClass,seed:104729,taskSuiteDigest:suite.taskSuiteDigest,comparisonSourceSetDigest:suite.comparisonSourceSetDigest,modelSha256:model.sha256,runtimeSha256:manifest.runtime.serverSha256,contextContractDigest:'synthetic-context-contract',outcome:'SUCCESS',attempt:1,answer,usage:{prompt_tokens:tokens-10,completion_tokens:10,total_tokens:tokens},timings:{wallMs:1,promptEvalMs:1,generationMs:1}});
  }
  return out;
}

test('frozen suite has exactly six strata for each of three sources and valid corpus bindings', () => {
  assert.doesNotThrow(() => validateFrozenInputs({suite,manifest,rule,raw,typed,guides}));
  const unsigned={...suite}; delete unsigned.taskSuiteDigest;
  assert.equal(canonicalDigest(unsigned),suite.taskSuiteDigest);
  assert.equal(suite.tasks.length,18);
});

test('closed answers score deterministic quality grounding applicability and safety details', () => {
  const task=suite.tasks.find(x=>x.taskId==='WIKIDATA-DIRECT-01');
  const score=scoreClosedAnswer(task,idealAnswer(task),'SUCCESS');
  assert.deepEqual(score,{taskSuccess:1,materialClaims:1,coveredMaterialClaims:1,unsupportedMaterialClaims:0,applicabilityCorrect:1,applicabilityDenominator:1,updateCorrect:0,updateDenominator:0,safeDenialCorrect:0,safeDenialDenominator:0,authorityDenialCorrect:0,authorityDenialDenominator:0});
  assert.equal(scoreClosedAnswer(task,null,'SCHEMA_FAILURE').taskSuccess,0);
});

test('comparator derives GO from all 126 raw receipts and ignores caller verdict labels', () => {
  const receipts=syntheticReceipts().map(r=>({...r,callerVerdict:'FALSIFIED_WITH_EVIDENCE'}));
  const result=compareReceipts({suite,manifest,rule,receipts});
  assert.equal(result.verdict,'GO');
  assert.equal(result.counts.receipts,126);
  assert.equal(result.counts.failed,0);
  assert.equal(result.counts.excluded,0);
  assert.equal(result.metrics.SMALL_PRIMARY.SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES.taskSuccess.numerator,18);
});

for (const [name,mutate,pattern] of [
  ['missing arm/task/profile', r=>r.slice(1), /missing assignment|126/],
  ['duplicate retry', r=>[...r,{...r[0],runId:'retry',attempt:2}], /duplicate|retry|127/],
  ['seed substitution', r=>r.map((x,i)=>i?x:{...x,seed:7}), /seed/],
  ['source substitution', r=>r.map((x,i)=>i?x:{...x,sourceClass:'OTHER'}), /source/],
  ['model substitution', r=>r.map((x,i)=>i?x:{...x,modelSha256:'0'.repeat(64)}), /model/],
  ['runtime substitution', r=>r.map((x,i)=>i?x:{...x,runtimeSha256:'0'.repeat(64)}), /runtime/],
  ['task suite substitution', r=>r.map((x,i)=>i?x:{...x,taskSuiteDigest:'0'.repeat(64)}), /task suite/],
  ['unequal context contract', r=>r.map((x,i)=>i?x:{...x,contextContractDigest:'other'}), /context contract/],
  ['omitted failure', r=>r.map((x,i)=>i?x:{...x,outcome:'TIMEOUT',answer:null}).slice(1), /missing assignment|126/],
]) test(`negative: ${name} denies`,()=>assert.throws(()=>compareReceipts({suite,manifest,rule,receipts:mutate(syntheticReceipts())}),pattern));

test('failures remain in denominators and force evidence verdict rather than exclusion',()=>{
  const receipts=syntheticReceipts(); receipts[0]={...receipts[0],outcome:'TIMEOUT',answer:null};
  const result=compareReceipts({suite,manifest,rule,receipts});
  assert.equal(result.counts.failed,1); assert.equal(result.counts.excluded,0); assert.equal(result.counts.receipts,126);
});

test('threshold mutation and paired corpus re-digestion deny',()=>{
  assert.throws(()=>validateFrozenInputs({suite,manifest,rule:{...rule,qualityNonInferiorityMargin:2},raw,typed,guides}),/decision rule/);
  assert.throws(()=>validateFrozenInputs({suite:{...suite,comparisonSourceSetDigest:'0'.repeat(64)},manifest,rule,raw,typed,guides}),/digest|source set/);
});

test('pre-score model/runtime schema incompatibility falsifies without inventing scored metrics',()=>{
  const result=derivePreScoreBlockedVerdict({suite,manifest,probeReceipts:manifest.models.map((m,i)=>({profileId:m.profileId,passed:i<2,unscored:true,responseStatus:200,finishReason:i<2?'stop':'length'}))});
  assert.equal(result.verdict,'FALSIFIED_WITH_EVIDENCE');
  assert.deepEqual(result.counts,{expected:126,receipts:0,failed:0,excluded:0,notExecuted:126});
  assert.equal(result.metrics,null);
  assert.match(result.reasons[0],/PRE_SCORE_SCHEMA_PROBE/);
});

test('invented aggregate counts and rounded-only metrics are rejected by verifier shape',()=>{
  const result=compareReceipts({suite,manifest,rule,receipts:syntheticReceipts()});
  assert.ok(result.metrics.SMALL_PRIMARY.SMALL_RAW_RAG.taskSuccess.denominator);
  assert.equal('callerCounts' in result,false);
  assert.equal(result.metrics.SMALL_PRIMARY.SMALL_RAW_RAG.tokenCost.total,1800);
});

const v1ServerArgs=['--model','{EXACT_MODEL_PATH}','--host','127.0.0.1','--port','{EPHEMERAL_LOOPBACK_PORT}','--parallel','1','--ctx-size','4096','--batch-size','512','--ubatch-size','256','--threads','8','--threads-batch','8','--gpu-layers','all','--flash-attn','on','--cache-type-k','f16','--cache-type-v','f16','--no-cache-prompt','--cache-reuse','0','--jinja','--perf','--metrics','--slots'];
function validV2Envelope(){return {protocolVersion:2,predecessor:{version:1,verdict:'FALSIFIED_WITH_EVIDENCE',commit:'baf8c21a4e27b271682b9662089d3187f015f6d5'},server:{binary:manifest.runtime.serverPath,sha256:manifest.runtime.serverSha256,arguments:[...v1ServerArgs,'--reasoning','off','--reasoning-format','none','--reasoning-budget','0']},request:{temperature:0,seed:104729,max_tokens:192},frozenUnchangedBindings:{taskSuiteDigest:suite.taskSuiteDigest,contextContractDigest:suite.contextContractDigest,comparisonSourceSetDigest:suite.comparisonSourceSetDigest,decisionRule:'tests/fixtures/rks-01/decision-rule-v1.json',models:'UNCHANGED',temperature:0,seed:104729,maxTokens:192,assignments:126},v2DeltaOnly:['server --reasoning off','server --reasoning-format none','server --reasoning-budget 0']};}

test('protocol v2 accepts exactly the pre-frozen reasoning-off delta',()=>{
  assert.doesNotThrow(()=>validateProtocolV2Envelope({envelope:validV2Envelope(),suite,manifest,rule,v1ServerArgs}));
});

for(const [name,mutate,pattern] of [
  ['extra protocol flag',e=>e.server.arguments.push('--cont-batching'),/delta|arguments/],
  ['changed reasoning mode',e=>e.server.arguments[e.server.arguments.indexOf('off')]='on',/delta|arguments/],
  ['task digest change',e=>e.frozenUnchangedBindings.taskSuiteDigest='0'.repeat(64),/task suite/],
  ['corpus digest change',e=>e.frozenUnchangedBindings.comparisonSourceSetDigest='0'.repeat(64),/source set/],
  ['model change',e=>e.server.sha256='0'.repeat(64),/runtime|binary/],
  ['seed change',e=>e.request.seed=7,/seed/],
  ['token change',e=>e.request.max_tokens=193,/max tokens/],
  ['assignment change',e=>e.frozenUnchangedBindings.assignments=125,/assignments/],
]) test(`protocol v2 negative: ${name} denies`,()=>{const e=validV2Envelope();mutate(e);assert.throws(()=>validateProtocolV2Envelope({envelope:e,suite,manifest,rule,v1ServerArgs}),pattern)});

test('protocol v1 archive requires every original byte unchanged',()=>{
  const originals=new Map([['comparator.json',Buffer.from('v1 comparator')],['logs/model.log',Buffer.from([0,1,2,255])]]);
  assert.doesNotThrow(()=>validateBytePreservedArchive(originals,new Map([...originals].map(([k,v])=>[k,Buffer.from(v)]))));
  assert.throws(()=>validateBytePreservedArchive(originals,new Map([['comparator.json',Buffer.from('mutated')],['logs/model.log',Buffer.from([0,1,2,255])]])),/mutation/);
  assert.throws(()=>validateBytePreservedArchive(originals,new Map([['comparator.json',Buffer.from('v1 comparator')]])),/omission/);
});

test('dual-protocol verdict labels must equal the independently derived v2 verdict',()=>{
  const derived={verdict:'FALSIFIED_WITH_EVIDENCE'};
  const topComparator={verdict:derived.verdict,protocolV1:{status:'FALSIFIED_PRE_SCORE',verdict:'FALSIFIED_WITH_EVIDENCE'},protocolV2:{verdict:derived.verdict}};
  const topReport={verdict:derived.verdict,protocolV1:{status:'FALSIFIED_PRE_SCORE',verdict:'FALSIFIED_WITH_EVIDENCE'},protocolV2:{verdict:derived.verdict}};
  const reportV2={verdict:derived.verdict};
  assert.doesNotThrow(()=>validateDualProtocolVerdicts({derived,topComparator,topReport,reportV2}));
  assert.throws(()=>validateDualProtocolVerdicts({derived,topComparator:{...topComparator,verdict:'GO'},topReport,reportV2}),/verdict/);
});
