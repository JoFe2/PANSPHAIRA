#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {canonicalJson,validateFrozenInputs,validateProtocolV2Envelope,validateBytePreservedArchive,validateDualProtocolVerdicts,scoreClosedAnswer,compareReceipts,derivePreScoreBlockedVerdict} from '../src/rks-01/comparator.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const insist=(x,m)=>{if(!x)throw new Error(m)};
const digest=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:(typeof x==='string'?x:canonicalJson(x))).digest('hex');
const shaFile=p=>new Promise((resolve,reject)=>{const h=crypto.createHash('sha256'),s=fs.createReadStream(p);s.on('error',reject);s.on('data',d=>h.update(d));s.on('end',()=>resolve(h.digest('hex')))});
const suite=read('tests/fixtures/rks-01/frozen-task-suite-v1.json');
const manifest=read('tests/fixtures/rks-01/model-runtime-manifest-v1.json');
const rule=read('tests/fixtures/rks-01/decision-rule-v1.json');
const raw=read('tests/fixtures/rks-01/raw-rag-corpus-v1.json');
const typed=read('tests/fixtures/rks-01/typed-knowledge-corpus-v1.json');
const guides=read('tests/fixtures/rks-01/application-guides-v1.json');
const envelope=read('verification/rks-01-run-receipts/protocol-v2/inference-envelope-v2.json');
const envelopeHash='cd5bc607072fdc4c5eee0eb7d87662230d1f8413159e50d84e273b37f4ff4da9';
const v1ServerArgs=['--model','{EXACT_MODEL_PATH}','--host','127.0.0.1','--port','{EPHEMERAL_LOOPBACK_PORT}','--parallel','1','--ctx-size','4096','--batch-size','512','--ubatch-size','256','--threads','8','--threads-batch','8','--gpu-layers','all','--flash-attn','on','--cache-type-k','f16','--cache-type-v','f16','--no-cache-prompt','--cache-reuse','0','--jinja','--perf','--metrics','--slots'];
const armsByRole={SMALL_PRIMARY:['SMALL_CLOSED_BOOK','SMALL_RAW_RAG','SMALL_TYPED_KNOWLEDGE','SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES'],SMALL_REPLICATION_CANDIDATE:['SMALL_RAW_RAG','SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES'],LARGE_REFERENCE:['LARGE_REFERENCE']};
const systemMessage='You are running a closed evidence evaluation. Treat parametric memory as non-authoritative. Use only the supplied EVIDENCE_PACK and TASK_CONTRACT for material claims. Preserve applicability, version, exceptions, conflicts and unknowns. If evidence is missing, conflicting, stale or non-applicable, abstain or deny as required. Knowledge grants no Capability or Authority. Return only JSON matching the required schema.';

validateFrozenInputs({suite,manifest,rule,raw,typed,guides});
validateProtocolV2Envelope({envelope,suite,manifest,rule,v1ServerArgs});
insist(digest(fs.readFileSync(path.join(root,'verification/rks-01-run-receipts/protocol-v2/inference-envelope-v2.json')))===envelopeHash,'protocol v2 envelope byte tamper');

const v1Paths=['verification/rks-01-comparator-receipt-v1.json','verification/rks-01-falsification-report-v1.json','verification/rks-01-run-receipts/preflight-v1.json',...['startup/FASTCONTEXT_4B_Q8_0_D24F7B8B-probe.json','startup/QWEN3_8_27B_Q5_K_M-probe.json','startup/VIBETHINKER_3B_Q8_0-probe.json','probes/FASTCONTEXT_4B_Q8_0_D24F7B8B.json','probes/QWEN3_8_27B_Q5_K_M.json','probes/VIBETHINKER_3B_Q8_0.json','logs/FASTCONTEXT_4B_Q8_0_D24F7B8B-probe.log','logs/QWEN3_8_27B_Q5_K_M-probe.log','logs/VIBETHINKER_3B_Q8_0-probe.log'].map(x=>`verification/rks-01-run-receipts/${x}`)];
const archiveName=p=>p.startsWith('verification/rks-01-run-receipts/')?p.replace('verification/rks-01-run-receipts/',''):path.basename(p);
const originals=new Map(v1Paths.map(p=>[archiveName(p),execFileSync('git',['show',`${envelope.predecessor.commit}:${p}`],{cwd:root,maxBuffer:32*1024*1024})]));
const archive=new Map(v1Paths.map(p=>[archiveName(p),fs.readFileSync(path.join(root,'verification/rks-01-run-receipts/protocol-v1',archiveName(p)))]));
validateBytePreservedArchive(originals,archive);
const v1Comparator=JSON.parse(archive.get('rks-01-comparator-receipt-v1.json'));
const v1Report=JSON.parse(archive.get('rks-01-falsification-report-v1.json'));
insist(v1Comparator.verdict==='FALSIFIED_WITH_EVIDENCE'&&v1Comparator.counts.receipts===0&&v1Comparator.counts.notExecuted===126,'protocol v1 terminal evidence changed');
insist(v1Report.verdict==='FALSIFIED_WITH_EVIDENCE'&&v1Report.notExecutedRuns===126&&v1Report.qualityEvidence==='NOT_MEASURED_PRE_SCORE_GATE_FAILED','protocol v1 falsification relabeled');

const preflight=read('verification/rks-01-run-receipts/protocol-v2/preflight-v2.json');
insist(preflight.protocolVersion===2&&preflight.predecessorCommit===envelope.predecessor.commit&&preflight.inferenceEnvelopeSha256===envelopeHash,'protocol v2 preflight binding');
insist(canonicalJson(preflight.bindings)===canonicalJson({taskSuiteDigest:suite.taskSuiteDigest,contextContractDigest:suite.contextContractDigest,comparisonSourceSetDigest:suite.comparisonSourceSetDigest,temperature:0,seed:104729,maxTokens:192,assignments:126}),'preflight frozen bindings tamper');
for(const [p,h] of Object.entries(preflight.hashes)){insist(fs.existsSync(p),'preflight artifact omission');insist(await shaFile(p)===h.expected&&h.actual===h.expected,'preflight artifact hash mismatch')}
for(const [p,h] of Object.entries(preflight.frozenArtifactHashes))insist(digest(fs.readFileSync(path.join(root,p)))===h,'frozen artifact byte change');

const probeDir='verification/rks-01-run-receipts/protocol-v2/probes';
const probes=manifest.models.map(m=>read(`${probeDir}/${m.profileId}.json`));
insist(probes.length===3&&probes.every(p=>p.protocolVersion===2&&p.unscored===true),'all three protocol v2 probes required');
for(const p of probes){insist(digest(p.rawResponse)===p.rawResponseHash,'probe raw response hash mismatch');if(p.passed){const env=JSON.parse(p.rawResponse);insist(canonicalJson(JSON.parse(env.choices[0].message.content))===canonicalJson(p.parsedAnswer),'probe parsed answer mismatch')}else insist(p.parsedAnswer===null,'failed probe invented an answer')}

function verifyStartup(model,phase){
 const startup=read(`verification/rks-01-run-receipts/protocol-v2/startup/${model.profileId}-${phase}.json`);
 insist(startup.protocolVersion===2&&startup.modelSha256===model.sha256&&startup.runtimeSha256===manifest.runtime.serverSha256&&startup.inferenceEnvelopeSha256===envelopeHash,'startup binding mismatch');
 const normalized=startup.args.map((x,i)=>i===startup.args.indexOf(model.path)?'{EXACT_MODEL_PATH}':i===startup.args.indexOf(String(startup.port))?'{EPHEMERAL_LOOPBACK_PORT}':x);
 insist(canonicalJson(normalized)===canonicalJson(envelope.server.arguments),'startup protocol delta tamper');
}
for(const model of manifest.models)verifyStartup(model,'probe');

if(probes.some(p=>!p.passed)){
 insist(probes.filter(p=>p.passed).length===2,'unexpected protocol v2 probe pass count');const failed=probes.find(p=>!p.passed);
 insist(failed.profileId==='QWEN3_8_27B_Q5_K_M'&&failed.responseStatus===400,'unexpected protocol v2 failed profile/status');
 const failureEnvelope=JSON.parse(failed.rawResponse);insist(failureEnvelope.error?.message==='Failed to initialize samplers: std::exception','protocol v2 sampler failure evidence changed');
 const scored=path.join(root,'verification/rks-01-run-receipts/protocol-v2/scored');insist(!fs.existsSync(scored)||fs.readdirSync(scored).filter(x=>x.endsWith('.json')).length===0,'scored request occurred after failed v2 probe');
 const derived=derivePreScoreBlockedVerdict({suite,manifest,probeReceipts:probes});const committed=read('verification/rks-01-run-receipts/protocol-v2/comparator-receipt-v2.json');
 for(const key of ['verdict','counts','hardGates','comparisons','metrics','reasons','nLimit'])insist(canonicalJson(committed[key])===canonicalJson(derived[key]),`blocked protocol v2 comparator ${key} tamper`);
 const topComparator=read('verification/rks-01-comparator-receipt-v1.json'),topReport=read('verification/rks-01-falsification-report-v1.json'),reportV2=read('verification/rks-01-run-receipts/protocol-v2/falsification-report-v2.json');
 insist(topComparator.protocolV1.status==='FALSIFIED_PRE_SCORE'&&topComparator.protocolV1.verdict==='FALSIFIED_WITH_EVIDENCE'&&topComparator.protocolV1.comparatorSha256===digest(archive.get('rks-01-comparator-receipt-v1.json')),'top-level protocol v1 omission/relabel');
 validateDualProtocolVerdicts({derived,topComparator,topReport,reportV2});
 insist(reportV2.notExecutedRuns===126&&reportV2.failedRuns.length===0&&reportV2.excludedRuns.length===0&&reportV2.metrics===null&&reportV2.comparisons===null,'invented or omitted blocked evidence');
 console.log(JSON.stringify({verdict:derived.verdict,counts:derived.counts,protocolV1:'FALSIFIED_PRE_SCORE',protocolV2:'FALSIFIED_PRE_SCORE',failedProbe:{profileId:failed.profileId,responseStatus:failed.responseStatus,rawResponseHash:failed.rawResponseHash}}));process.exit(0);
}

for(const model of manifest.models)verifyStartup(model,'scored');

function contextFor(task,armId){
 if(armId==='SMALL_CLOSED_BOOK')return {contract:'NO_EVIDENCE',items:[]};
 const refs=new Set(task.contextEvidenceRefs);const objects=typed.objects.filter(o=>refs.has(o.evidenceRefs[0]));
 if(armId==='SMALL_RAW_RAG')return {contract:'EXACT_RELEVANT_RAW_CHUNKS',items:raw.chunks.filter(c=>refs.has(c.id))};
 const context={contract:'CORRESPONDING_TYPED_OBJECTS',items:objects};
 if(armId==='SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES'||armId==='LARGE_REFERENCE'){context.contract='TYPED_OBJECTS_PLUS_BOUND_APPLICATION_GUIDES';context.applicationGuides=guides.guides.filter(g=>g.sourceBinding.sourceKey===task.sourceKey)}
 return context;
}
const expected=[];
for(const model of manifest.models)for(const armId of armsByRole[model.role])for(const task of suite.tasks)expected.push({model,armId,task,orderHash:digest(`104729|${model.profileId}|${armId}|${task.taskId}`)});
const profileOrder=[...manifest.models].sort((a,b)=>expected.filter(x=>x.model===a).map(x=>x.orderHash).sort()[0].localeCompare(expected.filter(x=>x.model===b).map(x=>x.orderHash).sort()[0]));
const ordered=profileOrder.flatMap(model=>expected.filter(x=>x.model===model).sort((a,b)=>a.orderHash.localeCompare(b.orderHash))).map((x,i)=>({...x,runOrder:i+1}));
insist(canonicalJson(preflight.assignmentOrder)===canonicalJson(ordered.map(x=>({runOrder:x.runOrder,orderHash:x.orderHash,profileId:x.model.profileId,armId:x.armId,taskId:x.task.taskId}))),'assignment order changed');

const scoredDir=path.join(root,'verification/rks-01-run-receipts/protocol-v2/scored');
const files=fs.readdirSync(scoredDir).filter(x=>x.endsWith('.json')).sort();insist(files.length===126,`receipt file count ${files.length}`);
const receipts=files.map(f=>JSON.parse(fs.readFileSync(path.join(scoredDir,f),'utf8')));
insist(new Set(receipts.map(r=>r.runId)).size===126&&new Set(receipts.map(r=>r.runOrder)).size===126,'missing or duplicate run identity');
for(const [i,r] of [...receipts].sort((a,b)=>a.runOrder-b.runOrder).entries()){
 const a=ordered[i];insist(r.protocolVersion===2&&r.schemaVersion==='pansphaira/rks-01-run-receipt/v2','receipt protocol substitution');
 insist(r.runOrder===a.runOrder&&r.orderHash===a.orderHash&&r.runId===a.orderHash.slice(0,24),'frozen order/run ID mismatch');
 insist(r.profileId===a.model.profileId&&r.armId===a.armId&&r.taskId===a.task.taskId&&r.attempt===1,'assignment/retry mismatch');
 insist(r.seed===104729&&r.temperature===0&&r.maxTokens===192,'inference setting substitution');
 const publicTask={taskId:a.task.taskId,sourceClass:a.task.sourceClass,stratum:a.task.stratum,sourceKey:a.task.sourceKey,...a.task.taskContract};const context=contextFor(a.task,a.armId);const user=`TASK_CONTRACT:\n${canonicalJson(publicTask)}\n\nEVIDENCE_PACK:\n${canonicalJson(context)}\n\nReturn the closed answer object.`;const messages=[{role:'system',content:systemMessage},{role:'user',content:user}];
 insist(r.taskHash===digest(publicTask)&&r.contextHash===digest(context)&&r.promptHash===digest(messages),'task/context/prompt substitution or paired redigestion');
 insist(r.taskSuiteDigest===suite.taskSuiteDigest&&r.contextContractDigest===suite.contextContractDigest&&r.comparisonSourceSetDigest===suite.comparisonSourceSetDigest&&r.sourceHash===suite.comparisonSourceSetDigest,'frozen digest substitution');
 insist(r.modelSha256===a.model.sha256&&r.runtimeSha256===manifest.runtime.serverSha256&&r.inferenceEnvelopeSha256===envelopeHash,'model/runtime/protocol substitution');
 insist(r.rawResponseHash===digest(r.rawResponse??''),'raw response hash mismatch');
 insist(r.usage.total_tokens===r.usage.prompt_tokens+r.usage.completion_tokens,'usage total mismatch');
 insist(Number.isFinite(r.timings.wallMs)&&Number.isFinite(r.timings.promptEvalMs)&&Number.isFinite(r.timings.generationMs),'timings omission');
 if(r.outcome==='SUCCESS'){const response=JSON.parse(r.rawResponse);const parsed=JSON.parse(response.choices[0].message.content);insist(canonicalJson(parsed)===canonicalJson(r.answer)&&canonicalJson(parsed)===canonicalJson(r.parsedClosedAnswer),'raw response/parsed answer mismatch')}else insist(r.answer===null,'failed run has scored answer');
 insist(canonicalJson(r.score)===canonicalJson(scoreClosedAnswer(a.task,r.answer,r.outcome)),'receipt score tamper');
}

const derived=compareReceipts({suite,manifest,rule,receipts});
const committedV2=read('verification/rks-01-run-receipts/protocol-v2/comparator-receipt-v2.json');
for(const key of ['verdict','counts','hardGates','comparisons','metrics','reasons','nLimit'])insist(canonicalJson(committedV2[key])===canonicalJson(derived[key]),`protocol v2 comparator ${key} tamper`);
const receiptSetDigest=digest([...receipts].sort((a,b)=>a.runOrder-b.runOrder).map(r=>({runId:r.runId,outcome:r.outcome,score:r.score,usage:r.usage,promptHash:r.promptHash,rawResponseHash:r.rawResponseHash})));
insist(committedV2.receiptSetDigest===receiptSetDigest,'receipt set digest tamper');
const topComparator=read('verification/rks-01-comparator-receipt-v1.json');const topReport=read('verification/rks-01-falsification-report-v1.json');const reportV2=read('verification/rks-01-run-receipts/protocol-v2/falsification-report-v2.json');
insist(topComparator.protocolV1.status==='FALSIFIED_PRE_SCORE'&&topComparator.protocolV1.verdict==='FALSIFIED_WITH_EVIDENCE'&&topComparator.protocolV1.comparatorSha256===digest(archive.get('rks-01-comparator-receipt-v1.json')),'top-level protocol v1 omission/relabel');
insist(topComparator.verdict===derived.verdict&&topComparator.protocolV2.verdict===derived.verdict&&topReport.verdict===derived.verdict&&topReport.protocolV2.verdict===derived.verdict&&reportV2.verdict===derived.verdict,'verdict label tamper');
const failed=receipts.filter(r=>r.outcome!=='SUCCESS');insist(reportV2.counts.failed===failed.length&&reportV2.failedRuns.length===failed.length&&reportV2.excludedRuns.length===0,'failure omission or exclusion');
insist(reportV2.counts.receipts===126&&reportV2.counts.excluded===0&&reportV2.limitation.includes('n=18'),'denominator or limitation tamper');
console.log(JSON.stringify({verdict:derived.verdict,counts:derived.counts,receiptSetDigest,protocolV1:'FALSIFIED_PRE_SCORE',protocolV2:'MEASURED'}));
