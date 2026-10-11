import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';import{join}from'node:path';
import {bootstrapFixture562,claimBody562}from'./bootstrap-fixture.mjs';
const entry='/t/tenant-a/bootstrap';
test('A1 actual certificate-verifying existing ingress exposes bounded bootstrap but no public grant issuer',async()=>{
 const f=await bootstrapFixture562();try{const grant=f.app.issueFirst(),home=await f.request(entry);assert.equal(home.status,200);assert.equal(home.tlsAuthorized,true);assert.equal(home.headers['referrer-policy'],'no-referrer');assert.match(home.headers['content-security-policy'],/script-src 'self'/);assert.equal(home.body.includes(grant.proof),false);
  const state=await f.request(entry+'/status');assert.equal(state.status,200);assert.equal(JSON.parse(state.body).state,'PROOF_PENDING');assert.equal(state.body.includes(grant.proof),false);assert.equal(state.body.includes('proofDigest'),false);
  assert.equal((await f.request(entry+'/issue',{origin:f.tls.origin},'POST',{})).status,404);
  assert.equal((await f.request(entry+'?proof='+grant.proof)).status,404);
  const script=await f.request(entry+'/app.js');assert.equal(script.status,200);assert.equal(Buffer.byteLength(script.body)<=131072,true);
 }finally{await f.close();}
});
test('A1 real native claim enforces origin/schema/instance, atomically binds session, denies replay and retains restart',async()=>{
 const f=await bootstrapFixture562();try{const grant=f.app.issueFirst(),body=claimBody562(f,grant);
  for(const [headers,value,status]of[[{},body,403],[{origin:'https://foreign.test'},body,403],[{origin:f.tls.origin},{...body,role:'reviewer'},400],[{origin:f.tls.origin},{...body,instanceId:'foreign-instance'},403]])assert.equal((await f.request(entry+'/claim',headers,'POST',value)).status,status);
  assert.equal(f.app.read().state,'PROOF_PENDING');
  const result=await f.request(entry+'/claim',{origin:f.tls.origin},'POST',body);assert.equal(result.status,200);assert.equal(JSON.parse(result.body).outcome,'SESSION_BOUND');assert.equal(result.body.includes(grant.proof),false);assert.match(result.headers['set-cookie'][0],/HttpOnly; SameSite=Strict/);
  const cookie=result.headers['set-cookie'][0].split(';')[0];assert.equal((await f.request('/t/tenant-a/workspace',{cookie})).status,200);
  assert.equal((await f.request(entry+'/claim',{origin:f.tls.origin},'POST',body)).status,409);
  await f.restart();assert.equal(f.app.read().state,'INITIALIZED');assert.throws(()=>f.app.issueFirst(),/HOSTED_BOOTSTRAP_ALREADY_INITIALIZED/);
  const read=await f.request(entry+'/status',{cookie});assert.equal(JSON.parse(read.body).sessionState,'CURRENT');
  assert.equal(Object.keys(JSON.parse(readFileSync(join(f.app.stateRoot,'sessions.json'),'utf8')).payload.sessions).length,1);
 }finally{await f.close();}
});
test('A1 actual expired session redirects only fixed current namespace and separately issued resume logs in',async()=>{
 const f=await bootstrapFixture562({sessionTtlMs:1000});try{const grant=f.app.issueFirst(),first=await f.request(entry+'/claim',{origin:f.tls.origin},'POST',claimBody562(f,grant));const cookie=first.headers['set-cookie'][0].split(';')[0];
  await new Promise(resolve=>setTimeout(resolve,1100));const missing=await f.request('/t/tenant-a/workspace',{cookie,accept:'text/html'});assert.equal(missing.status,303);assert.equal(missing.headers.location,entry);assert.equal(JSON.parse((await f.request(entry+'/status',{cookie})).body).sessionState,'NOT_AUTHENTICATED');
  const resume=f.app.issueResume(),reply=await f.request(entry+'/resume',{origin:f.tls.origin},'POST',claimBody562(f,resume,'RESUME'));assert.equal(reply.status,200);assert.equal(JSON.parse(reply.body).purpose,'RESUME');assert.equal(f.app.read().state,'INITIALIZED');assert.equal((await f.request(entry+'/resume',{origin:f.tls.origin},'POST',claimBody562(f,resume,'RESUME'))).status,409);
 }finally{await f.close();}
});
