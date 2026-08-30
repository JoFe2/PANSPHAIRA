#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {canonicalJson,validateFrozenInputs,compareReceipts,derivePreScoreBlockedVerdict} from '../src/rks-01/comparator.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const insist=(x,m)=>{if(!x)throw new Error(m)};
const digest=x=>crypto.createHash('sha256').update(typeof x==='string'?x:canonicalJson(x)).digest('hex');
const suite=read('tests/fixtures/rks-01/frozen-task-suite-v1.json'),manifest=read('tests/fixtures/rks-01/model-runtime-manifest-v1.json'),rule=read('tests/fixtures/rks-01/decision-rule-v1.json'),raw=read('tests/fixtures/rks-01/raw-rag-corpus-v1.json'),typed=read('tests/fixtures/rks-01/typed-knowledge-corpus-v1.json'),guides=read('tests/fixtures/rks-01/application-guides-v1.json');
validateFrozenInputs({suite,manifest,rule,raw,typed,guides});
const dir=path.join(root,'verification/rks-01-run-receipts/scored');
if(!fs.existsSync(dir)||fs.readdirSync(dir).filter(x=>x.endsWith('.json')).length===0){
  const probes=manifest.models.map(m=>read(`verification/rks-01-run-receipts/probes/${m.profileId}.json`));
  insist(probes.length===3&&probes.filter(p=>p.passed).length===2,'exact probe outcomes changed');
  const failed=probes.find(p=>!p.passed);const rawProbe=JSON.parse(failed.rawResponse);
  insist(failed.profileId==='QWEN3_8_27B_Q5_K_M'&&failed.responseStatus===200,'unexpected failed profile or transport');
  insist(rawProbe.choices[0].finish_reason==='length'&&rawProbe.choices[0].message.content===''&&rawProbe.usage.completion_tokens===192,'Qwen incompatibility evidence changed');
  const independentlyDerived=derivePreScoreBlockedVerdict({suite,manifest,probeReceipts:probes});
  const committed=read('verification/rks-01-comparator-receipt-v1.json');
  for(const key of ['verdict','counts','hardGates','comparisons','metrics','reasons','nLimit']) insist(canonicalJson(committed[key])===canonicalJson(independentlyDerived[key]),`blocked comparator ${key} tamper`);
  const report=read('verification/rks-01-falsification-report-v1.json');
  insist(report.verdict===independentlyDerived.verdict&&report.notExecutedRuns===126,'blocked verdict/count tamper');
  insist(report.metrics===null&&report.comparisons===null&&report.failedRuns.length===0&&report.excludedRuns.length===0,'invented blocked metrics or runs');
  insist(report.qualityEvidence==='NOT_MEASURED_PRE_SCORE_GATE_FAILED'&&report.groundingEvidence==='NOT_MEASURED_PRE_SCORE_GATE_FAILED'&&report.driftSafetyEvidence==='NOT_MEASURED_PRE_SCORE_GATE_FAILED'&&report.costEvidence==='NOT_MEASURED_PRE_SCORE_GATE_FAILED','invented quality/grounding/drift/cost evidence');
  console.log(independentlyDerived.verdict);process.exit(0);
}
const files=fs.readdirSync(dir).filter(x=>x.endsWith('.json')).sort();insist(files.length===126,`receipt file count ${files.length}`);
const receipts=files.map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
insist(new Set(receipts.map(r=>r.runId)).size===126,'duplicate run IDs');
insist(new Set(receipts.map(r=>r.runOrder)).size===126&&Math.min(...receipts.map(r=>r.runOrder))===1&&Math.max(...receipts.map(r=>r.runOrder))===126,'run order not complete');
for(const r of receipts){
 insist(r.orderHash===digest(`104729|${r.profileId}|${r.armId}|${r.taskId}`),'order hash mismatch');
 insist(r.runId===r.orderHash.slice(0,24),'run ID mismatch');
 insist(r.usage.total_tokens===r.usage.prompt_tokens+r.usage.completion_tokens,'invented usage total');
 if(r.outcome==='SUCCESS'){
   const envelope=JSON.parse(r.rawResponse); const parsed=JSON.parse(envelope.choices[0].message.content);
   insist(canonicalJson(parsed)===canonicalJson(r.answer)&&canonicalJson(parsed)===canonicalJson(r.parsedClosedAnswer),'raw response/answer mismatch');
 } else insist(r.answer===null,'failed run has scored answer');
}
const independentlyDerived=compareReceipts({suite,manifest,rule,receipts});
const committed=read('verification/rks-01-comparator-receipt-v1.json');
for(const key of ['verdict','counts','hardGates','comparisons','metrics','reasons','nLimit']) insist(canonicalJson(committed[key])===canonicalJson(independentlyDerived[key]),`comparator ${key} tamper`);
const report=read('verification/rks-01-falsification-report-v1.json');
insist(report.verdict===independentlyDerived.verdict,'verdict label tamper');
insist(report.failedRuns.length===independentlyDerived.counts.failed,'omitted failure');
insist(report.excludedRuns.length===0&&independentlyDerived.counts.excluded===0,'unexpected exclusion');
insist(report.limitation.includes('n=18'),'n limitation omitted');
console.log(independentlyDerived.verdict);
