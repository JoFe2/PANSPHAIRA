import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as native from '../../src/pan527/origin-session-adapter.mjs';
import {shapeIdentity527} from '../pan527/helpers.mjs';

// Native ownership/session probe only: not real installer/container/HTTP/browser acceptance.
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'pan562-first-possession-owned-'));
 const options={optIn:true,origin:'https://pan562.test:4443',identity:shapeIdentity527('tenant-a'),stateRoot:root};
 const sessions=native.createProtectedSessionAdapterV1(options);
 const ownerOptions={optIn:true,subjectId:'synthetic-first-owner',proofTtlMs:60000,sessionTtlMs:60000};
 return {root,options,sessions,ownerOptions,owner(){return native.createProtectedFirstPossessionV1(sessions,ownerOptions);},close(){rmSync(root,{recursive:true,force:true});}};
}
function request(f,proof){return {proof,instanceId:f.sessions.binding.instanceId,identityDigest:f.sessions.binding.identityDigest};}
const headers={origin:'https://pan562.test:4443'};

test('A1-AC02 native owner factory requires existing private session owner and explicit opt-in',()=>{
 assert.equal(typeof native.createProtectedFirstPossessionV1,'function','Missing additive first-possession seam on the existing protected session owner');
 const f=fixture();try{
  assert.throws(()=>native.createProtectedFirstPossessionV1({...f.sessions},f.ownerOptions),/HOSTED_BOOTSTRAP_OWNER_DENIED/);
  assert.throws(()=>native.createProtectedFirstPossessionV1(f.sessions,{...f.ownerOptions,optIn:false}),/HOSTED_BOOTSTRAP_OWNER_DENIED/);
  assert.throws(()=>native.createProtectedFirstPossessionV1(f.sessions,{...f.ownerOptions,role:'owner'}),/HOSTED_BOOTSTRAP_OWNER_DENIED/);
  assert.throws(()=>native.createProtectedFirstPossessionV1(f.sessions,{...f.ownerOptions,proofTtlMs:60001}),/HOSTED_BOOTSTRAP_OWNER_DENIED/);
 }finally{f.close();}
});

test('A1-AC02 actual first proof exchange atomically initializes and issues existing protected session',()=>{
 const f=fixture();try{
  const owner=f.owner(),issued=owner.issue();assert.match(issued.proof,/^[a-f0-9]{64}$/);
  assert.equal(owner.read().state,'PROOF_PENDING');
  const redeemed=owner.redeem(headers,request(f,issued.proof));
  assert.match(redeemed.setCookie,/^__Host-pan527-session=[a-f0-9]{64}; Path=\/; Secure; HttpOnly; SameSite=Strict;/);
  assert.deepEqual(f.sessions.authenticate({cookie:redeemed.cookieHeader}),{tenantId:'tenant-a',subjectId:'synthetic-first-owner',role:'reviewer',instanceId:f.sessions.binding.instanceId,generation:1});
  assert.equal(f.sessions.authorizeMutation({cookie:redeemed.cookieHeader,origin:headers.origin,'x-pan527-csrf':redeemed.csrf}).subjectId,'synthetic-first-owner');
  const state=owner.read();assert.equal(state.state,'INITIALIZED');assert.equal(state.subjectId,'synthetic-first-owner');
  assert.equal(JSON.stringify(state).includes(issued.proof),false);
  const persisted=readFileSync(join(f.root,'sessions.json'),'utf8');
  assert.equal(persisted.includes(issued.proof),false);assert.equal(persisted.includes(redeemed.csrf),false);assert.equal(persisted.includes(redeemed.cookieHeader.split('=')[1]),false);
  const saved=JSON.parse(persisted).payload;assert.equal(Object.keys(saved.sessions).length,1);assert.equal(saved.firstPossession.state,'INITIALIZED');
 }finally{f.close();}
});

test('A1-AC04 initialized instance denies replay and another proof without another session',()=>{
 const f=fixture();try{const o=f.owner(),issued=o.issue();o.redeem(headers,request(f,issued.proof));
  assert.throws(()=>o.redeem(headers,request(f,issued.proof)),/HOSTED_BOOTSTRAP_ALREADY_INITIALIZED/);
  assert.throws(()=>o.issue(),/HOSTED_BOOTSTRAP_ALREADY_INITIALIZED/);
  assert.equal(Object.keys(JSON.parse(readFileSync(join(f.root,'sessions.json'),'utf8')).payload.sessions).length,1);
 }finally{f.close();}
});

test('A1-AC02 concurrent separate owner adapters admit exactly one first owner',async()=>{
 const f=fixture();try{const o=f.owner(),issued=o.issue();const peers=Array.from({length:3},()=>native.createProtectedFirstPossessionV1(native.createProtectedSessionAdapterV1(f.options),f.ownerOptions));
  const results=await Promise.allSettled(peers.map(p=>Promise.resolve().then(()=>p.redeem(headers,request(f,issued.proof)))));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.message==='HOSTED_BOOTSTRAP_ALREADY_INITIALIZED').length,2);
  assert.equal(Object.keys(JSON.parse(readFileSync(join(f.root,'sessions.json'),'utf8')).payload.sessions).length,1);
 }finally{f.close();}
});

test('A1-AC03 source/origin/header/schema denials preserve proof and cause no initialization',()=>{
 const f=fixture();try{const o=f.owner(),issued=o.issue(),body=request(f,issued.proof);
  for(const bad of [{...body,instanceId:'foreign-instance'},{...body,identityDigest:'0'.repeat(64)},{...body,proof:'0'.repeat(64)},{...body,role:'reviewer'}])assert.throws(()=>o.redeem(headers,bad),/HOSTED_BOOTSTRAP_(?:INSTANCE|PROOF|SCHEMA)_DENIED/);
  assert.throws(()=>o.redeem({origin:'https://foreign.test'},body),/HOSTED_BOOTSTRAP_ORIGIN_DENIED/);
  assert.throws(()=>o.redeem({...headers,'x-role':'reviewer'},body),/HOSTED_HEADER_AUTHORITY_DENIED/);
  assert.equal(o.read().state,'PROOF_PENDING');assert.equal(Object.keys(JSON.parse(readFileSync(join(f.root,'sessions.json'),'utf8')).payload.sessions).length,0);
  o.redeem(headers,body);assert.equal(o.read().state,'INITIALIZED');
 }finally{f.close();}
});

test('A1-AC05 restart preserves initialization and exact current session without new bootstrap',()=>{
 const f=fixture();try{const o=f.owner(),issued=o.issue(),r=o.redeem(headers,request(f,issued.proof));
  const recovered=native.createProtectedSessionAdapterV1(f.options),owner=native.createProtectedFirstPossessionV1(recovered,f.ownerOptions);
  assert.equal(owner.read().state,'INITIALIZED');assert.equal(recovered.authenticate({cookie:r.cookieHeader}).subjectId,'synthetic-first-owner');
  assert.throws(()=>owner.issue(),/HOSTED_BOOTSTRAP_ALREADY_INITIALIZED/);
 }finally{f.close();}
});

test('A1-AC05 genuinely expired proof remains denied after restart; no silent refreshed proof',async()=>{
 const f=fixture();try{const options={...f.ownerOptions,proofTtlMs:1};const o=native.createProtectedFirstPossessionV1(f.sessions,options),issued=o.issue();
  await new Promise(resolve=>setTimeout(resolve,20));
  const recovered=native.createProtectedFirstPossessionV1(native.createProtectedSessionAdapterV1(f.options),options);
  assert.equal(recovered.read().state,'PROOF_EXPIRED');assert.throws(()=>recovered.redeem(headers,request(f,issued.proof)),/HOSTED_BOOTSTRAP_PROOF_EXPIRED/);
  assert.equal(Object.keys(JSON.parse(readFileSync(join(f.root,'sessions.json'),'utf8')).payload.sessions).length,0);
 }finally{f.close();}
});

test('A1-AC02 actual store integrity and lock denials do not initialize or consume the proof',()=>{
 const f=fixture();try{const o=f.owner(),issued=o.issue(),before=readFileSync(join(f.root,'sessions.json'),'utf8');
  writeFileSync(join(f.root,'session-write.lock'),'owned concurrent writer',{flag:'wx',mode:0o600});
  assert.throws(()=>o.redeem(headers,request(f,issued.proof)),/HOSTED_BOOTSTRAP_BUSY/);assert.equal(readFileSync(join(f.root,'sessions.json'),'utf8'),before);
  rmSync(join(f.root,'session-write.lock'));const value=JSON.parse(before);value.payload.firstPossession.subjectId='foreign-owner';writeFileSync(join(f.root,'sessions.json'),JSON.stringify(value));
  assert.throws(()=>o.read(),/HOSTED_AUTH_UNAVAILABLE/);assert.throws(()=>o.redeem(headers,request(f,issued.proof)),/HOSTED_AUTH_UNAVAILABLE/);
 }finally{f.close();}
});


test('A1-AC04 actual legacy owner logout and restart cannot reopen first possession',async()=>{
 const {nativeFixture527,request527}=await import('../pan527/helpers.mjs');
 const {financeFixture}=await import('../pan519/native-fixture.mjs');
 const {enableWorkspaceBrowserV1}=await import('../../src/pan541/workspace-browser.mjs');
 const {createNativeErvReadAdapterV1}=await import('../../src/pan541/native-erv-read-adapter.mjs');
 const tls=await nativeFixture527();let finance,workspace;
 try{
  finance=await financeFixture();
  workspace=enableWorkspaceBrowserV1({optIn:true,gateway:tls.gateway,tenantId:'tenant-a',origin:tls.origin,nativeReader:createNativeErvReadAdapterV1({tenantId:'tenant-a',root:finance.root})});
  const sessions=tls.gateway.sessionAdapter('tenant-a');
  const legacy=sessions.issueOwnerSession({subjectId:'synthetic-legacy-owner',role:'reviewer',expiresAtMs:Date.now()+60000});
  const reply=await request527(tls,'/t/tenant-a/workspace/logout',{origin:tls.origin,cookie:legacy.cookieHeader,'x-pan527-csrf':legacy.csrf},'POST');
  assert.equal(reply.status,200);assert.equal(JSON.parse(readFileSync(join(tls.tenants[0].stateRoot,'sessions.json'),'utf8')).payload.sessions&&Object.keys(JSON.parse(readFileSync(join(tls.tenants[0].stateRoot,'sessions.json'),'utf8')).payload.sessions).length,0);
  const recovered=native.createProtectedSessionAdapterV1({optIn:true,origin:tls.origin,identity:tls.tenants[0].identity,stateRoot:tls.tenants[0].stateRoot});
  const first=native.createProtectedFirstPossessionV1(recovered,{optIn:true,subjectId:'synthetic-new-first-owner',proofTtlMs:60000,sessionTtlMs:60000});
  assert.equal(first.read().state,'INITIALIZED','Actual legacy logout must retain permanent initialization, not first-user-wins after restart');
  assert.throws(()=>first.issue(),/HOSTED_BOOTSTRAP_ALREADY_INITIALIZED/);
 }finally{workspace?.close();finance?.close();await tls.close();}
});


test('A1-AC02 genuine simultaneous independent Node processes atomically exchange exactly one proof',async()=>{
 const {fork}=await import('node:child_process');const f=fixture(),peers=[];
 try{const o=f.owner(),issued=o.issue();const job={sessionOptions:f.options,ownerOptions:f.ownerOptions,headers,body:request(f,issued.proof)};
  const prepared=Array.from({length:4},()=>new Promise((resolve,reject)=>{
   const child=fork(new URL('./first-possession-claim-child.mjs',import.meta.url),[],{stdio:['ignore','ignore','ignore','ipc'],execArgv:[],env:{...process.env,NODE_TEST_CONTEXT:''}});peers.push(child);
   const timer=setTimeout(()=>reject(Error('ACTUAL_PROCESS_READY_TIMEOUT')),5000);
   child.once('error',reject);child.once('message',message=>{clearTimeout(timer);assert.equal(message.state,'READY');resolve(child);});
   child.send({operation:'PREPARE',job});
  }));
  const ready=await Promise.all(prepared);assert.equal(new Set(ready.map(c=>c.pid)).size,4);
  const returns=ready.map(c=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('ACTUAL_PROCESS_CLAIM_TIMEOUT')),5000);c.once('message',message=>{clearTimeout(timer);resolve(message);});}));
  for(const child of ready)child.send({operation:'CLAIM'});
  const rows=await Promise.all(returns);
  assert.equal(rows.filter(r=>r.state==='REDEEMED').length,1);
  assert.equal(rows.filter(r=>r.state==='DENIED'&&['HOSTED_BOOTSTRAP_ALREADY_INITIALIZED','HOSTED_BOOTSTRAP_BUSY'].includes(r.code)).length,3);
  await Promise.all(ready.map(c=>c.exitCode!==null?Promise.resolve():new Promise((resolve,reject)=>c.once('exit',code=>code===0?resolve():reject(Error('ACTUAL_CHILD_EXIT_FAILED'))))));
  assert.equal(o.read().state,'INITIALIZED');assert.equal(Object.keys(JSON.parse(readFileSync(join(f.root,'sessions.json'),'utf8')).payload.sessions).length,1);
 }finally{for(const c of peers)if(c.exitCode===null)c.kill();f.close();}
});

test('A1-AC05 deliberately lost claim return reconciles initialized state without repeat effect',()=>{
 const f=fixture();try{const o=f.owner(),issued=o.issue();o.redeem(headers,request(f,issued.proof));
  // Deliberately discard the actual returned cookie; state, not the lost reply,
  // authoritatively decides whether a second first-owner mutation is permitted.
  const recovered=native.createProtectedFirstPossessionV1(native.createProtectedSessionAdapterV1(f.options),f.ownerOptions);
  assert.equal(recovered.read().state,'INITIALIZED');assert.throws(()=>recovered.redeem(headers,request(f,issued.proof)),/HOSTED_BOOTSTRAP_ALREADY_INITIALIZED/);
  assert.equal(Object.keys(JSON.parse(readFileSync(join(f.root,'sessions.json'),'utf8')).payload.sessions).length,1);
 }finally{f.close();}
});


test('A1-AC05 separate explicit owner resume grants restore session but never reopen first possession',()=>{
 const f=fixture();try{const o=f.owner(),first=o.issue();o.redeem(headers,request(f,first.proof));
  assert.equal(typeof o.issueResume,'function','Existing session owner needs separate one-shot resume, not repeated first possession');
  const resume=o.issueResume(),result=o.redeemResume(headers,request(f,resume.proof));
  assert.equal(f.sessions.authenticate({cookie:result.cookieHeader}).subjectId,'synthetic-first-owner');
  assert.throws(()=>o.redeemResume(headers,request(f,resume.proof)),/HOSTED_BOOTSTRAP_RESUME_CONSUMED/);
  assert.throws(()=>o.issue(),/HOSTED_BOOTSTRAP_ALREADY_INITIALIZED/);
  assert.equal(o.read().state,'INITIALIZED');
  assert.equal(readFileSync(join(f.root,'sessions.json'),'utf8').includes(resume.proof),false);
 }finally{f.close();}
});

test('A1-AC02 resume cannot substitute first claim or select another owner or instance',()=>{
 const f=fixture();try{const o=f.owner();assert.equal(typeof o.issueResume,'function');
  assert.throws(()=>o.issueResume(),/HOSTED_BOOTSTRAP_RESUME_NOT_INITIALIZED/);
  const first=o.issue();assert.throws(()=>o.redeemResume(headers,request(f,first.proof)),/HOSTED_BOOTSTRAP_RESUME_NOT_INITIALIZED/);
  o.redeem(headers,request(f,first.proof));const resume=o.issueResume();
  assert.throws(()=>native.createProtectedFirstPossessionV1(f.sessions,{...f.ownerOptions,subjectId:'foreign-owner'}),/HOSTED_BOOTSTRAP_OWNER_DENIED/);
  assert.throws(()=>o.redeemResume(headers,{...request(f,resume.proof),instanceId:'foreign'}),/HOSTED_BOOTSTRAP_INSTANCE_DENIED/);
  assert.throws(()=>o.redeem(headers,request(f,resume.proof)),/HOSTED_BOOTSTRAP_ALREADY_INITIALIZED/);
 }finally{f.close();}
});
