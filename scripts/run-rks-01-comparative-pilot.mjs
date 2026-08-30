#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import {spawn,execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {canonicalJson,validateFrozenInputs,scoreClosedAnswer,compareReceipts,derivePreScoreBlockedVerdict,validateProtocolV2Envelope} from '../src/rks-01/comparator.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const suite=read('tests/fixtures/rks-01/frozen-task-suite-v1.json');
const manifest=read('tests/fixtures/rks-01/model-runtime-manifest-v1.json');
const rule=read('tests/fixtures/rks-01/decision-rule-v1.json');
const raw=read('tests/fixtures/rks-01/raw-rag-corpus-v1.json');
const typed=read('tests/fixtures/rks-01/typed-knowledge-corpus-v1.json');
const guides=read('tests/fixtures/rks-01/application-guides-v1.json');
const envelope=read('verification/rks-01-run-receipts/protocol-v2/inference-envelope-v2.json');
const outRoot=path.join(root,'verification/rks-01-run-receipts/protocol-v2');
const scoredDir=path.join(outRoot,'scored');
const probeDir=path.join(outRoot,'probes');
const startupDir=path.join(outRoot,'startup');
const logsDir=path.join(outRoot,'logs');
const v1ServerArgs=['--model','{EXACT_MODEL_PATH}','--host','127.0.0.1','--port','{EPHEMERAL_LOOPBACK_PORT}','--parallel','1','--ctx-size','4096','--batch-size','512','--ubatch-size','256','--threads','8','--threads-batch','8','--gpu-layers','all','--flash-attn','on','--cache-type-k','f16','--cache-type-v','f16','--no-cache-prompt','--cache-reuse','0','--jinja','--perf','--metrics','--slots'];
const envelopeSha256='cd5bc607072fdc4c5eee0eb7d87662230d1f8413159e50d84e273b37f4ff4da9';
const shaFile=p=>new Promise((resolve,reject)=>{const h=crypto.createHash('sha256'),s=fs.createReadStream(p);s.on('error',reject);s.on('data',d=>h.update(d));s.on('end',()=>resolve(h.digest('hex')))});
const digest=v=>crypto.createHash('sha256').update(Buffer.isBuffer(v)?v:(typeof v==='string'?v:canonicalJson(v))).digest('hex');
const writeJson=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n')};
const armsByRole={SMALL_PRIMARY:['SMALL_CLOSED_BOOK','SMALL_RAW_RAG','SMALL_TYPED_KNOWLEDGE','SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES'],SMALL_REPLICATION_CANDIDATE:['SMALL_RAW_RAG','SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES'],LARGE_REFERENCE:['LARGE_REFERENCE']};
const systemMessage='You are running a closed evidence evaluation. Treat parametric memory as non-authoritative. Use only the supplied EVIDENCE_PACK and TASK_CONTRACT for material claims. Preserve applicability, version, exceptions, conflicts and unknowns. If evidence is missing, conflicting, stale or non-applicable, abstain or deny as required. Knowledge grants no Capability or Authority. Return only JSON matching the required schema.';
const answerSchema={type:'object',additionalProperties:false,required:['answerState','materialClaims','evidenceRefs','applicability','denials','reasoningSummary'],properties:{answerState:{enum:['ANSWER','ABSTAIN','DENY']},materialClaims:{type:'array',maxItems:16,items:{type:'object',additionalProperties:false,required:['claim','evidenceRefs'],properties:{claim:{type:'string',maxLength:1000},evidenceRefs:{type:'array',maxItems:16,uniqueItems:true,items:{type:'string',maxLength:160}}}}},evidenceRefs:{type:'array',maxItems:32,uniqueItems:true,items:{type:'string',maxLength:160}},applicability:{enum:['APPLICABLE','NOT_APPLICABLE','UNKNOWN']},denials:{type:'array',maxItems:16,uniqueItems:true,items:{type:'string',maxLength:160}},reasoningSummary:{type:'string',maxLength:1200}}};
const responseFormat={type:'json_schema',json_schema:{name:'rks01_closed_answer',strict:true,schema:answerSchema}};

function validateAnswer(x){
 if(!x||typeof x!=='object'||Array.isArray(x)) return false;
 const keys=Object.keys(x).sort().join(','), expected='answerState,applicability,denials,evidenceRefs,materialClaims,reasoningSummary';
 if(keys!==expected||!['ANSWER','ABSTAIN','DENY'].includes(x.answerState)||!['APPLICABLE','NOT_APPLICABLE','UNKNOWN'].includes(x.applicability)||typeof x.reasoningSummary!=='string') return false;
 if(!Array.isArray(x.materialClaims)||!Array.isArray(x.evidenceRefs)||!Array.isArray(x.denials)) return false;
 return x.materialClaims.every(c=>c&&typeof c.claim==='string'&&Array.isArray(c.evidenceRefs));
}
function contextFor(task,armId){
 if(armId==='SMALL_CLOSED_BOOK') return {contract:'NO_EVIDENCE',items:[]};
 const refs=new Set(task.contextEvidenceRefs);
 const objects=typed.objects.filter(o=>refs.has(o.evidenceRefs[0]));
 if(armId==='SMALL_RAW_RAG') return {contract:'EXACT_RELEVANT_RAW_CHUNKS',items:raw.chunks.filter(c=>refs.has(c.id))};
 const context={contract:'CORRESPONDING_TYPED_OBJECTS',items:objects};
 if(armId==='SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES'||armId==='LARGE_REFERENCE') {context.contract='TYPED_OBJECTS_PLUS_BOUND_APPLICATION_GUIDES';context.applicationGuides=guides.guides.filter(g=>g.sourceBinding.sourceKey===task.sourceKey);}
 return context;
}
function assignmentList(){
 const list=[]; for(const model of manifest.models) for(const armId of armsByRole[model.role]) for(const task of suite.tasks){const orderHash=digest(`104729|${model.profileId}|${armId}|${task.taskId}`);list.push({model,armId,task,orderHash});}
 const profileOrder=[...manifest.models].sort((a,b)=>list.filter(x=>x.model===a).map(x=>x.orderHash).sort()[0].localeCompare(list.filter(x=>x.model===b).map(x=>x.orderHash).sort()[0]));
 return profileOrder.flatMap(model=>list.filter(x=>x.model===model).sort((a,b)=>a.orderHash.localeCompare(b.orderHash))).map((x,i)=>({...x,runOrder:i+1}));
}
async function allocatePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(e=>e?reject(e):resolve(p))});s.on('error',reject)})}
async function preflight(){
 validateFrozenInputs({suite,manifest,rule,raw,typed,guides});
 validateProtocolV2Envelope({envelope,suite,manifest,rule,v1ServerArgs});
 const observations={schemaVersion:'pansphaira/rks-01-preflight/v2',protocolVersion:2,validatedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),predecessorCommit:envelope.predecessor.commit,gpu:execFileSync('nvidia-smi',['--query-gpu=name,driver_version,compute_cap','--format=csv,noheader'],{encoding:'utf8'}).trim(),hashes:{},frozenArtifactHashes:{}};
 if(observations.head!==envelope.predecessor.commit && !process.argv.includes('--allow-owned-changes')) throw new Error(`unexpected base head ${observations.head}`);
 if(observations.gpu!==`${manifest.runtime.gpu}, ${manifest.runtime.driver}, ${manifest.runtime.computeCapability}`) throw new Error(`GPU/driver substitution: ${observations.gpu}`);
 const envelopePath=path.join(outRoot,'inference-envelope-v2.json'); const actualEnvelopeHash=await shaFile(envelopePath);if(actualEnvelopeHash!==envelopeSha256)throw new Error('protocol v2 envelope byte mutation');observations.inferenceEnvelopeSha256=actualEnvelopeHash;
 for(const item of [{path:manifest.runtime.serverPath,sha256:manifest.runtime.serverSha256},...manifest.runtime.bundledLibraries,...manifest.models]){const actual=await shaFile(item.path);observations.hashes[item.path]={expected:item.sha256,actual,byteSize:fs.statSync(item.path).size};if(actual!==item.sha256) throw new Error(`hash substitution ${item.path}`);if(item.byteSize&&fs.statSync(item.path).size!==item.byteSize) throw new Error(`size substitution ${item.path}`)}
 for(const relative of ['tests/fixtures/rks-01/frozen-task-suite-v1.json','tests/fixtures/rks-01/decision-rule-v1.json','tests/fixtures/rks-01/model-runtime-manifest-v1.json','tests/fixtures/rks-01/raw-rag-corpus-v1.json','tests/fixtures/rks-01/typed-knowledge-corpus-v1.json','tests/fixtures/rks-01/application-guides-v1.json']) observations.frozenArtifactHashes[relative]=await shaFile(path.join(root,relative));
 observations.bindings={taskSuiteDigest:suite.taskSuiteDigest,contextContractDigest:suite.contextContractDigest,comparisonSourceSetDigest:suite.comparisonSourceSetDigest,temperature:manifest.inference.temperature,seed:manifest.inference.seed,maxTokens:manifest.inference.maxTokens,assignments:rule.assignments};
 observations.assignmentOrder=assignmentList().map(x=>({runOrder:x.runOrder,orderHash:x.orderHash,profileId:x.model.profileId,armId:x.armId,taskId:x.task.taskId}));
 return observations;
}
async function startServer(model,observations,phase){
 const port=await allocatePort();const logPath=path.join(logsDir,`${model.profileId}-${phase}.log`);fs.mkdirSync(logsDir,{recursive:true});const log=fs.openSync(logPath,'w');
 const args=envelope.server.arguments.flatMap((value,index)=>value==='{EXACT_MODEL_PATH}'?[model.path]:value==='{EPHEMERAL_LOOPBACK_PORT}'?[String(port)]:[value]);
 const startedAt=new Date().toISOString();const child=spawn(manifest.runtime.serverPath,args,{env:{...process.env,LD_LIBRARY_PATH:manifest.runtime.libraryPathRoots.join(':')},stdio:['ignore',log,log]});let exit=null;child.once('exit',(code,signal)=>exit={code,signal});
 let health,lastError;const deadline=Date.now()+300000;
 while(Date.now()<deadline&&!exit){try{const r=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(2000)});health={status:r.status,body:await r.text()};if(r.ok&&/ok|ready/i.test(health.body))break}catch(e){lastError=String(e)}await delay(500)}
 if(!health||health.status!==200){child.kill('SIGTERM');await delay(500);if(!exit)child.kill('SIGKILL');throw new Error(`server readiness failed ${model.profileId}: ${JSON.stringify({exit,health,lastError})}`)}
 const receipt={schemaVersion:'pansphaira/rks-01-server-startup/v2',protocolVersion:2,phase,profileId:model.profileId,modelSha256:model.sha256,runtimeSha256:manifest.runtime.serverSha256,inferenceEnvelopeSha256:envelopeSha256,startedAt,readyAt:new Date().toISOString(),port,host:'127.0.0.1',args,health,processId:child.pid,logPath:path.relative(root,logPath),hardware:observations.gpu};writeJson(path.join(startupDir,`${model.profileId}-${phase}.json`),receipt);
 return {child,port,log,receipt};
}
async function stopServer(server){if(!server)return;server.child.kill('SIGTERM');await Promise.race([new Promise(r=>server.child.once('exit',r)),delay(10000)]);if(server.child.exitCode===null)server.child.kill('SIGKILL');fs.closeSync(server.log)}
async function request(port,messages){
 const body={stream:false,temperature:0,seed:104729,max_tokens:192,cache_prompt:false,messages,response_format:responseFormat};const started=performance.now();
 const response=await fetch(`http://127.0.0.1:${port}/v1/chat/completions`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});const text=await response.text();const wallMs=performance.now()-started;let json;try{json=JSON.parse(text)}catch{}
 return {body,responseStatus:response.status,responseOk:response.ok,text,json,wallMs};
}
async function probe(server,model){
 const messages=[{role:'system',content:systemMessage},{role:'user',content:'SYNTHETIC NON-TASK JSON-SCHEMA PROBE. Return a closed answer object with no claims. This is not a scored task.'}];const r=await request(server.port,messages);let answer,parseError;try{answer=JSON.parse(r.json?.choices?.[0]?.message?.content)}catch(e){parseError=String(e)}
 const receipt={schemaVersion:'pansphaira/rks-01-schema-probe/v2',protocolVersion:2,profileId:model.profileId,unscored:true,requestHash:digest(r.body),responseStatus:r.responseStatus,rawResponse:r.text,rawResponseHash:digest(r.text),parsedAnswer:answer??null,parseError:parseError??null,usage:r.json?.usage??null,llamaTimings:r.json?.timings??null,wallMs:r.wallMs,passed:r.responseOk&&validateAnswer(answer)};writeJson(path.join(probeDir,`${model.profileId}.json`),receipt);return receipt;
}
function existingReceipts(){if(!fs.existsSync(scoredDir))return [];return fs.readdirSync(scoredDir).filter(x=>x.endsWith('.json')).map(x=>read(path.relative(root,path.join(scoredDir,x))))}
async function scoreOne(server,a){
 const context=contextFor(a.task,a.armId);const publicTask={taskId:a.task.taskId,sourceClass:a.task.sourceClass,stratum:a.task.stratum,sourceKey:a.task.sourceKey,...a.task.taskContract};const user=`TASK_CONTRACT:\n${canonicalJson(publicTask)}\n\nEVIDENCE_PACK:\n${canonicalJson(context)}\n\nReturn the closed answer object.`;const messages=[{role:'system',content:systemMessage},{role:'user',content:user}];
 const base={schemaVersion:'pansphaira/rks-01-run-receipt/v2',protocolVersion:2,inferenceEnvelopeSha256:envelopeSha256,runId:a.orderHash.slice(0,24),runOrder:a.runOrder,orderHash:a.orderHash,attempt:1,profileId:a.model.profileId,role:a.model.role,armId:a.armId,taskId:a.task.taskId,sourceClass:a.task.sourceClass,sourceKey:a.task.sourceKey,seed:104729,temperature:0,maxTokens:192,taskSuiteDigest:suite.taskSuiteDigest,comparisonSourceSetDigest:suite.comparisonSourceSetDigest,contextContractDigest:suite.contextContractDigest,modelSha256:a.model.sha256,runtimeSha256:manifest.runtime.serverSha256,taskHash:digest(publicTask),contextHash:digest(context),promptHash:digest(messages),sourceHash:suite.comparisonSourceSetDigest,startedAt:new Date().toISOString()};
 let r,answer=null,outcome='SUCCESS',error=null;
 try{r=await request(server.port,messages);if(!r.responseOk){outcome='HTTP_FAILURE';error=`HTTP ${r.responseStatus}`}else try{answer=JSON.parse(r.json?.choices?.[0]?.message?.content);if(!validateAnswer(answer)){outcome='SCHEMA_FAILURE';error='closed answer schema rejected'}}catch(e){outcome='SCHEMA_FAILURE';error=String(e)}}catch(e){outcome=e?.name==='TimeoutError'?'TIMEOUT':'TRANSPORT_FAILURE';error=String(e)}
 const usage=r?.json?.usage??{};const timings=r?.json?.timings??{};const receipt={...base,finishedAt:new Date().toISOString(),outcome,error,responseStatus:r?.responseStatus??null,rawResponse:r?.text??null,rawResponseHash:digest(r?.text??''),parsedClosedAnswer:answer,answer,usage:{prompt_tokens:usage.prompt_tokens??0,completion_tokens:usage.completion_tokens??0,total_tokens:usage.total_tokens??((usage.prompt_tokens??0)+(usage.completion_tokens??0))},llamaTimings:timings,timings:{wallMs:r?.wallMs??0,promptEvalMs:timings.prompt_ms??timings.prompt_eval_ms??0,generationMs:timings.predicted_ms??timings.generation_ms??0},score:scoreClosedAnswer(a.task,answer,outcome)};
 writeJson(path.join(scoredDir,`${String(a.runOrder).padStart(3,'0')}-${a.orderHash.slice(0,16)}.json`),receipt);return receipt;
}
function protocolV1Summary(){
 const comparatorBytes=fs.readFileSync(path.join(root,'verification/rks-01-run-receipts/protocol-v1/rks-01-comparator-receipt-v1.json'));
 const reportBytes=fs.readFileSync(path.join(root,'verification/rks-01-run-receipts/protocol-v1/rks-01-falsification-report-v1.json'));
 const comparator=JSON.parse(comparatorBytes),report=JSON.parse(reportBytes);
 return {status:'FALSIFIED_PRE_SCORE',verdict:comparator.verdict,scoredRuns:0,notExecutedRuns:126,reason:comparator.reasons,predecessorCommit:envelope.predecessor.commit,archivePath:'verification/rks-01-run-receipts/protocol-v1',comparatorSha256:digest(comparatorBytes),reportSha256:digest(reportBytes),qualityEvidence:report.qualityEvidence};
}
function writeDualTopLevel(protocolV2,reportV2){
 const protocolV1=protocolV1Summary();
 const comparator={schemaVersion:'pansphaira/rks-01-dual-protocol-comparator/v2',goalId:'PSAI-REAL-SOURCE-KNOWLEDGE-UTILITY-01',protocolV1,protocolV2,verdict:protocolV2.verdict};
 const report={schemaVersion:'pansphaira/rks-01-dual-protocol-falsification-report/v2',goalId:'PSAI-REAL-SOURCE-KNOWLEDGE-UTILITY-01',protocolV1,protocolV2:reportV2,verdict:protocolV2.verdict,nonClaims:['V1_REMAINS_FALSIFIED','NO_TASK_CORPUS_MODEL_THRESHOLD_OR_COST_RULE_CHANGE','NO_GENERAL_SMALL_MODEL_REPLACEMENT','NO_PRODUCTION_READINESS','NO_ACTION_AUTHORITY']};
 writeJson(path.join(outRoot,'comparator-receipt-v2.json'),protocolV2);writeJson(path.join(outRoot,'falsification-report-v2.json'),reportV2);writeJson(path.join(root,'verification/rks-01-comparator-receipt-v1.json'),comparator);writeJson(path.join(root,'verification/rks-01-falsification-report-v1.json'),report);
 return comparator;
}
function writeResults(receipts,observations){
 const derived=compareReceipts({suite,manifest,rule,receipts});const protocolV2={...derived,schemaVersion:'pansphaira/rks-01-comparator-receipt/v2',protocolVersion:2,taskSuiteDigest:suite.taskSuiteDigest,contextContractDigest:suite.contextContractDigest,comparisonSourceSetDigest:suite.comparisonSourceSetDigest,inferenceEnvelopeSha256:envelopeSha256,hardwareRuntime:observations,receiptSetDigest:digest([...receipts].sort((a,b)=>a.runOrder-b.runOrder).map(r=>({runId:r.runId,outcome:r.outcome,score:r.score,usage:r.usage,promptHash:r.promptHash,rawResponseHash:r.rawResponseHash})))};
 const reportV2={schemaVersion:'pansphaira/rks-01-falsification-report/v2',protocolVersion:2,verdict:protocolV2.verdict,counts:protocolV2.counts,reasons:protocolV2.reasons,hardGates:protocolV2.hardGates,comparisons:protocolV2.comparisons,metrics:protocolV2.metrics,failedRuns:receipts.filter(r=>r.outcome!=='SUCCESS').map(r=>({runId:r.runId,profileId:r.profileId,armId:r.armId,taskId:r.taskId,outcome:r.outcome,error:r.error})),excludedRuns:[],limitation:'n=18 frozen tasks (six per source class); bounded descriptive evidence, not a general model or production claim.',inferenceEnvelopeSha256:envelopeSha256,nonClaims:['NO_GENERAL_SMALL_MODEL_REPLACEMENT','NO_LEGAL_ADVICE','NO_PRODUCTION_READINESS','NO_AUTONOMOUS_PROMOTION','NO_ACTION_AUTHORITY']};writeDualTopLevel(protocolV2,reportV2);
 return protocolV2;
}
function writeV2ProbeFailure(probes,observations){
 const blocked=derivePreScoreBlockedVerdict({suite,manifest,probeReceipts:probes});const protocolV2={...blocked,schemaVersion:'pansphaira/rks-01-comparator-receipt/v2',protocolVersion:2,inferenceEnvelopeSha256:envelopeSha256,contextContractDigest:suite.contextContractDigest,comparisonSourceSetDigest:suite.comparisonSourceSetDigest,hardwareRuntime:observations,probeEvidence:probes.map(p=>({profileId:p.profileId,passed:p.passed,responseStatus:p.responseStatus,requestHash:p.requestHash,wallMs:p.wallMs,rawResponseHash:p.rawResponseHash}))};
 const reportV2={schemaVersion:'pansphaira/rks-01-falsification-report/v2',protocolVersion:2,verdict:protocolV2.verdict,counts:protocolV2.counts,reasons:protocolV2.reasons,hardGates:protocolV2.hardGates,comparisons:null,metrics:null,failedRuns:[],excludedRuns:[],notExecutedRuns:126,preScoreFailures:protocolV2.probeEvidence,limitation:'Protocol v2 measurement stopped before scoring because an authorized one-shot schema probe failed.'};writeDualTopLevel(protocolV2,reportV2);return protocolV2;
}

let server=null;
try{
 const observations=await preflight();fs.mkdirSync(outRoot,{recursive:true});writeJson(path.join(outRoot,'preflight-v2.json'),observations);
 if(process.argv.includes('--validate-only')){console.log(JSON.stringify({status:'PRE_SCORE_VALIDATION_PASS',protocolVersion:2,taskSuiteDigest:suite.taskSuiteDigest,assignments:126,hardware:observations.gpu}));process.exit(0)}
 if(process.argv.includes('--probe-only')){
   const probes=[];for(const model of manifest.models){server=await startServer(model,observations,'probe');probes.push(await probe(server,model));await stopServer(server);server=null;}
   if(probes.some(p=>!p.passed)){const blocked=writeV2ProbeFailure(probes,observations);console.log(blocked.verdict);process.exit(2);}
   console.log(JSON.stringify({status:'ALL_SCHEMA_PROBES_PASS',protocolVersion:2,profiles:manifest.models.length}));process.exit(0);
 }
 if(process.argv.includes('--finalize-pre-score-block')) throw new Error('protocol v1 finalization is closed and archived; protocol v2 has no further correction authority');
 for(const model of manifest.models){const p=path.join(probeDir,`${model.profileId}.json`);if(!fs.existsSync(p)||read(path.relative(root,p)).passed!==true)throw new Error(`missing passed protocol-v2 pre-score probe ${model.profileId}`)}
 if(existingReceipts().length)throw new Error('protocol-v2 scored receipts already exist; scored retry/resume denied');
 const assignments=assignmentList();
 for(const model of [...new Set(assignments.map(a=>a.model))]){const assigned=assignments.filter(a=>a.model===model);server=await startServer(model,observations,'scored');for(const a of assigned)await scoreOne(server,a);await stopServer(server);server=null;}
 const receipts=existingReceipts();if(receipts.length!==126)throw new Error(`exact receipt denominator failed: ${receipts.length}`);const comparator=writeResults(receipts,observations);console.log(comparator.verdict);
}catch(error){if(server)await stopServer(server);console.error(error.stack||error);process.exitCode=1;}
