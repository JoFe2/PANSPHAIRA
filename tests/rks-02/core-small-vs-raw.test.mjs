import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canonicalDigest,
  digestText,
  validateInheritedInputs,
  buildAssignments,
  contextFor,
  promptFor,
  scoreClosedAnswer,
  compareReceipts,
  derivePreScoreBlockedVerdict,
  validatePublishedResults,
} from '../../src/rks-02/comparator.mjs';

const fixture=(area,name)=>JSON.parse(fs.readFileSync(new URL(`../fixtures/${area}/${name}`,import.meta.url)));
const suite=fixture('rks-01','frozen-task-suite-v1.json');
const raw=fixture('rks-01','raw-rag-corpus-v1.json');
const typed=fixture('rks-01','typed-knowledge-corpus-v1.json');
const guides=fixture('rks-01','application-guides-v1.json');
const bindings=fixture('rks-02','inherited-bindings-v1.json');
const manifest=fixture('rks-02','model-runtime-manifest-v1.json');
const rule=fixture('rks-02','decision-rule-v1.json');
const root=new URL('../../',import.meta.url);

function idealAnswer(task){const e=task.expected;return {answerState:e.answerState,materialClaims:e.requiredClaimFragments.length?[{claim:e.requiredClaimFragments.join(' '),evidenceRefs:e.requiredEvidenceRefs}]:[],evidenceRefs:e.requiredEvidenceRefs,applicability:e.applicability,denials:e.requiredDenials,reasoningSummary:'Closed evidence decision.'};}
function syntheticReceipts(){return buildAssignments({suite,manifest,rule}).map(a=>{const answer=idealAnswer(a.task);if(a.armId==='SMALL_RAW_RAG'&&a.task.stratum==='VERSION_DRIFT_UPDATE')answer.denials=[];if(a.armId==='SMALL_RAW_RAG'&&a.task.stratum==='DIRECT_GROUNDED_CLAIM'&&a.task.sourceClass==='WIKIDATA_STRUCTURED')answer.materialClaims[0].evidenceRefs=[];const context=contextFor({task:a.task,armId:a.armId,raw,typed,guides});const prompt=promptFor({task:a.task,context});const tokens=a.armId==='SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES'?80:100;const rawResponse=JSON.stringify({choices:[{message:{content:JSON.stringify(answer)}}]});return {schemaVersion:'pansphaira/rks-02-run-receipt/v1',runId:a.orderHash.slice(0,24),runOrder:a.runOrder,orderHash:a.orderHash,attempt:1,profileId:a.model.profileId,role:a.model.role,armId:a.armId,taskId:a.task.taskId,sourceClass:a.task.sourceClass,sourceKey:a.task.sourceKey,seed:104729,temperature:0,maxTokens:192,taskSuiteDigest:suite.taskSuiteDigest,comparisonSourceSetDigest:suite.comparisonSourceSetDigest,contextContractDigest:suite.contextContractDigest,modelSha256:a.model.sha256,runtimeSha256:manifest.runtime.serverSha256,taskHash:canonicalDigest(prompt.publicTask),contextHash:canonicalDigest(context),promptHash:canonicalDigest(prompt.messages),sourceHash:suite.comparisonSourceSetDigest,outcome:'SUCCESS',error:null,rawResponse,rawResponseHash:digestText(rawResponse),answer,parsedClosedAnswer:answer,usage:{prompt_tokens:tokens-10,completion_tokens:10,total_tokens:tokens},timings:{wallMs:1,promptEvalMs:1,generationMs:1},score:scoreClosedAnswer(a.task,answer,'SUCCESS')};});}
const args=receipts=>({suite,manifest,rule,bindings,raw,typed,guides,receipts});

test('inherits exact released 18-task/source/context/scoring bindings and only two small models',()=>{assert.doesNotThrow(()=>validateInheritedInputs({root,suite,manifest,rule,bindings,raw,typed,guides}));assert.equal(buildAssignments({suite,manifest,rule}).length,108);assert.deepEqual(Object.fromEntries(manifest.models.map(m=>[m.role,buildAssignments({suite,manifest,rule}).filter(a=>a.model.role===m.role).length])),{SMALL_PRIMARY:72,SMALL_REPLICATION_CANDIDATE:36});assert.equal(JSON.stringify({bindings,manifest,rule}).includes('QWEN3_8_27B_Q5_K_M'),false);});

test('deterministic synthetic 108 receipts derive GO without caller aggregates or large gating',()=>{const receipts=syntheticReceipts();const result=compareReceipts(args(receipts));assert.equal(receipts.length,108);assert.equal(result.verdict,'GO');assert.deepEqual(result.counts,{expected:108,receipts:108,failed:0,excluded:0});assert.equal(result.metrics.SMALL_PRIMARY.SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES.taskSuccess.numerator,18);assert.equal('largeReference' in result.comparisons,false);assert.equal('callerAggregate' in result,false);});

for(const [name,mutate,pattern] of [
 ['large model presence',r=>{const m=structuredClone(manifest);m.models.push({role:'LARGE_REFERENCE',profileId:'FORBIDDEN',sha256:'0'.repeat(64)});return ()=>validateInheritedInputs({root,suite,manifest:m,rule,bindings,raw,typed,guides})},/two small|large/i],
 ['missing assignment',r=>()=>compareReceipts(args(r.slice(1))),/108|missing/],
 ['duplicate assignment',r=>()=>compareReceipts(args([...r.slice(0,-1),{...r[0],runOrder:108}])),/duplicate|order/],
 ['retried assignment',r=>()=>compareReceipts(args(r.map((x,i)=>i?x:{...x,attempt:2}))),/retry/],
 ['omitted failed run',r=>()=>compareReceipts(args(r.map((x,i)=>i?x:{...x,outcome:'TIMEOUT',answer:null}).slice(1))),/108|missing/],
 ['task mutation',r=>()=>compareReceipts(args(r.map((x,i)=>i?x:{...x,taskHash:'0'.repeat(64)}))),/task hash/],
 ['corpus mutation',r=>()=>compareReceipts(args(r.map((x,i)=>i?x:{...x,comparisonSourceSetDigest:'0'.repeat(64)}))),/corpus|source/],
 ['model mutation',r=>()=>compareReceipts(args(r.map((x,i)=>i?x:{...x,modelSha256:'0'.repeat(64)}))),/model/],
 ['runtime mutation',r=>()=>compareReceipts(args(r.map((x,i)=>i?x:{...x,runtimeSha256:'0'.repeat(64)}))),/runtime/],
 ['seed mutation',r=>()=>compareReceipts(args(r.map((x,i)=>i?x:{...x,seed:7}))),/seed/],
 ['unequal context',r=>()=>compareReceipts(args(r.map((x,i)=>i?x:{...x,contextHash:'0'.repeat(64)}))),/context hash/],
 ['paired redigestion',r=>()=>compareReceipts(args(r.map(x=>({...x,taskSuiteDigest:'1'.repeat(64),comparisonSourceSetDigest:'2'.repeat(64),contextContractDigest:'3'.repeat(64)})))),/task suite|corpus|context contract/],
])test(`negative: ${name} denies`,()=>{const receipts=syntheticReceipts();assert.throws(mutate(receipts),pattern)});

test('threshold mutation denies',()=>{const changed={...rule,qualityNonInferiorityMargin:2};assert.throws(()=>validateInheritedInputs({root,suite,manifest,rule:changed,bindings,raw,typed,guides}),/decision rule|threshold/);});

test('failed scored runs remain denominator and cannot be excluded',()=>{const receipts=syntheticReceipts();receipts[0]={...receipts[0],outcome:'TIMEOUT',answer:null,parsedClosedAnswer:null,score:scoreClosedAnswer(buildAssignments({suite,manifest,rule})[0].task,null,'TIMEOUT')};const result=compareReceipts(args(receipts));assert.equal(result.counts.failed,1);assert.equal(result.counts.receipts,108);assert.equal(result.counts.excluded,0);});

test('one failed small-model strict probe terminally falsifies all 108 without retry',()=>{const probes=manifest.models.map((m,i)=>({profileId:m.profileId,unscored:true,attempt:1,passed:i===0}));const result=derivePreScoreBlockedVerdict({suite,manifest,probes});assert.equal(result.verdict,'FALSIFIED_WITH_EVIDENCE');assert.deepEqual(result.counts,{expected:108,receipts:0,failed:0,excluded:0,notExecuted:108});assert.equal(result.metrics,null);});

test('published aggregates and verdict are independently re-derived and tamper evident',()=>{const receipts=syntheticReceipts();const derived=compareReceipts(args(receipts));const report={verdict:derived.verdict,counts:derived.counts,metrics:derived.metrics,comparisons:derived.comparisons,hardGates:derived.hardGates,failedRuns:[],excludedRuns:[]};assert.doesNotThrow(()=>validatePublishedResults({derived,comparator:structuredClone(derived),report}));assert.throws(()=>validatePublishedResults({derived,comparator:{...derived,verdict:'NARROW_GO'},report}),/verdict/);assert.throws(()=>validatePublishedResults({derived,comparator:{...derived,counts:{...derived.counts,receipts:107}},report}),/counts/);assert.throws(()=>validatePublishedResults({derived,comparator:{...derived,metrics:{}},report}),/metrics/);});
