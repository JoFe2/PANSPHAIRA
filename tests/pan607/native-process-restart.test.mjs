import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';import {join} from 'node:path';
import {fixture} from './native-fixture.mjs';
const exits={TARGET_ACK:92,FINISH:93,BEFORE_APPEND:94,AFTER_APPEND:95,MISSING_COPY:96,ACCEPT_ONLY:91};
for(const phase of Object.keys(exits))test('607 actual independent process restart '+phase+': authoritative single target/finish/outbox and concurrent TLS reconcile never redispatch',async()=>{
 const x=await fixture();try{
  // Release only this fixture's ephemeral TLS listener. Do not touch fixed
  // ports, foreign processes, source/native deadlines or another owner DB.
  await new Promise(r=>x.f.tls.gateway.server.close(r));x.tasks.close();
  const descriptor={options:x.f.tls.options,financeRoot:x.f.native.root,taskRoot:x.root},run=stage=>spawnSync(process.execPath,['tests/pan607/native-process-probe.mjs',stage],{input:JSON.stringify(descriptor),encoding:'utf8',timeout:20000,env:process.env,maxBuffer:1048576}),first=run(phase);
  assert.equal(first.error,undefined);assert.equal(first.signal,null);assert.equal(first.status,exits[phase],first.stderr+'\n'+first.stdout);
  const before=first.stdout.trim().split('\n').filter(Boolean).map(s=>JSON.parse(s)),restarted=run('RECONCILE');assert.equal(restarted.error,undefined);assert.equal(restarted.signal,null);assert.equal(restarted.status,0,restarted.stderr+'\n'+restarted.stdout);if(process.env.PAN607_NATIVE_PROCESS_EVIDENCE){const dir=process.env.PAN607_NATIVE_PROCESS_EVIDENCE;mkdirSync(dir,{recursive:true,mode:0o700});for(const [label,r]of[['actual-crash',first],['actual-restart-concurrent',restarted]]){writeFileSync(join(dir,phase+'-'+label+'.stdout'),r.stdout);writeFileSync(join(dir,phase+'-'+label+'.stderr'),r.stderr);writeFileSync(join(dir,phase+'-'+label+'-exit.json'),JSON.stringify({status:r.status,signal:r.signal,ownChildExitConsumed:true})+'\n');}}const report=JSON.parse(restarted.stdout.trim());assert.notEqual(report.pid,before[0].pid);assert.equal(report.phase,'RECONCILE');assert.equal(report.results.length,2);assert.ok(report.results.every(r=>r.targetRedispatched===false));assert.equal(report.noSend,true);assert.equal(report.profileRevision,0);assert.equal(report.model,'NOT_RUN');assert.equal(report.physicalDomSightClaim,false);
  if(phase==='ACCEPT_ONLY'){assert.equal(report.nativeTargetRenderAckCount,0);assert.equal(report.parentCompletionCount,0);assert.equal(report.unknown,true);assert.equal(report.task.state,'OUTCOME_UNCONFIRMED');}
  else{assert.equal(report.nativeTargetRenderAckCount,1);assert.equal(report.parentCompletionCount,1);assert.equal(report.task.state,'COMPLETED');assert.equal(report.task.proof.targetPhase,'DOCUMENT_RENDERED');assert.equal(report.task.proof.physicalPixelSightCertified,false);assert.equal(report.results.reduce((n,r)=>n+r.completed,0),['FINISH','MISSING_COPY'].includes(phase)?0:1);}
  assert.equal(report.results.reduce((n,r)=>n+r.repaired,0),phase==='MISSING_COPY'?1:0);
 }finally{await x.close();}
});
