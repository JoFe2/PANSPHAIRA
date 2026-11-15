// Structural/byte-contract checks only: never a native admission receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {spawnSync} from 'node:child_process';
const oldPath='fixtures/pan594/locked-ajv2020-dev-readback-policy-v1.json';
const newPath='fixtures/pan594/locked-ajv2020-dev-readback-policy-v2.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const load=p=>JSON.parse(readFileSync(p));
const ownerPath='src/pan591/locked-dev-readback-admission-v1.mjs';
test('594 code owner selects only v2 while preserving the exact runtime/install/member/rights snapshot algorithm',()=>{
 const source=readFileSync(ownerPath,'utf8');
 assert.ok(source.includes("const POLICY='"+newPath+"',POLICY_SHA=\""+sha(readFileSync(newPath))+"\""),'owner must select the qualified v2 catalog digest');
 assert.ok(source.includes("oracleId:'pan591-code-owned-locked-dev-profile-v2'"));
 assert.equal(sha(source.slice(source.indexOf('function snapshot(){'),source.indexOf('function exactSelector'))),'89f7c7dd6af66f7fa2f71629470b3dbc7416599019565676779b22b4e0a6fc57');
});
test('594 unchanged exact-selector algorithm rejects historical/unknown versions, rights, getters, proxies and foreign shapes',()=>{
 const source=readFileSync(ownerPath,'utf8');
 // Exercise only the real pure selector helper; never execute snapshot with a fake runtime or mint a held native handle.
 const exactSelector=Function('types',source.slice(source.indexOf('function exactSelector('),source.indexOf('export function admitPan591LockedDevReadbackGraph'))+';return exactSelector;')(types);
 const p=load(newPath),expected={schemaVersion:'pansphaira.ui-build-admission/locked-dev-readback/v1',profileId:p.profileId,version:p.version,catalogDigest:sha(readFileSync(newPath))};
 assert.equal(exactSelector({...expected},expected),true);
 const old=load(oldPath);let getters=0;
 const accessor={...expected};Object.defineProperty(accessor,'version',{enumerable:true,get(){getters++;throw Error('untrusted');}});
 const hidden={...expected};Object.defineProperty(hidden,'approved',{value:true});
 for(const value of [null,[],Object.create(expected),new Proxy({...expected},{}),accessor,hidden,{...expected,[Symbol('right')]:true},{...expected,approved:true},{...expected,version:old.version,catalogDigest:sha(readFileSync(oldPath))},{...expected,version:'3.0.0'},{...expected,profileId:p.profileId+'.neighbor'},{...expected,catalogDigest:'0'.repeat(64)}])assert.equal(exactSelector(value,expected),false);
 assert.equal(getters,0);
});
test('594 real unsupported hosts remain runtime-denied, never native admission positives',async()=>{
 if(process.platform==='linux'&&process.arch==='x64')return; // Positive native acceptance belongs exclusively to the existing closed native runner.
 const {admitPan591LockedDevReadbackGraph}=await import('../../src/pan591/locked-dev-readback-admission-v1.mjs');
 const p=load(newPath),selector={schemaVersion:'pansphaira.ui-build-admission/locked-dev-readback/v1',profileId:p.profileId,version:p.version,catalogDigest:sha(readFileSync(newPath))};
 assert.throws(()=>admitPan591LockedDevReadbackGraph(selector),/PAN591_DEV_RUNTIME_IDENTITY_DENIED/);
 const run=spawnSync(process.execPath,['scripts/run-pan594-dev-readback-comparison.mjs'],{encoding:'utf8',env:{...process.env,NODE_OPTIONS:'',NODE_TEST_CONTEXT:undefined}});
 assert.notEqual(run.status,0);assert.match(run.stderr,/PAN594_TEST_REQUIRES_SUPPORTED_LINUX_X86_64/);assert.equal(run.stdout,'');
});
test('594 qualified v2 is selected by the native fixture and the closed runner owns all five test files',()=>{
 const fixture=readFileSync('tests/pan594/fixture.mjs','utf8');assert.ok(fixture.includes("policyPath594='"+newPath+"'"));
 const entry=spawnSync(process.execPath,['scripts/run-pan594-dev-readback-comparison.mjs','--list'],{encoding:'utf8'});assert.equal(entry.status,0);
 assert.deepEqual(JSON.parse(entry.stdout).sort(),readdirSync('tests/pan594').filter(p=>p.endsWith('.test.mjs')).map(p=>'tests/pan594/'+p).sort());
 const native=readFileSync('tests/pan594/native-comparison.test.mjs','utf8');
 assert.ok(native.includes('r.verifiedDependencyMembers,540'));
 assert.ok(native.includes("version:'1.0.0'"));assert.ok(native.includes("version:'3.0.0'"));
 const measurement=readFileSync('tests/pan594/measurement.test.mjs','utf8');assert.ok(measurement.includes('admittedOwnerWarmCostIncludesFresh540MemberAndNodeRuntimeReread:true'));
 const browser=readFileSync('tests/pan594/browser-comparison.test.mjs','utf8');assert.ok(browser.includes("'"+newPath+"'"));
 for(const path of ['node_modules/fast-uri/index.js','node_modules/fast-uri/LICENSE'])assert.ok(native.includes("'"+path+"'"));
});
test('594 explicit v2 succeeds immutable v1 only for qualified fast-uri3.1.9 bytes, without widening rights',()=>{
 assert.equal(sha(readFileSync(oldPath)),'8cba56bb516b8e0b9b5c30332cc38943228794afd6f8ad587513e6d9a60557fb');
 assert.ok(existsSync(newPath),'missing explicit qualified v2 policy successor');
 const old=load(oldPath),next=load(newPath);
 assert.equal(next.version,'2.0.0');
 assert.equal(next.profileId,old.profileId);
 const oldFast=old.packages.find(p=>p.name==='fast-uri'),fast=next.packages.find(p=>p.name==='fast-uri');
 assert.equal(oldFast.version,'3.1.8');assert.equal(fast.version,'3.1.9');
 assert.equal(fast.resolved,'https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.9.tgz');
 assert.equal(fast.integrity,'sha512-hS/0Wt3Ya043oKXs0sIxrMpKQITXhMLIrVAKKXi4gozGC9v7YRWVnXIZzjNPTO02M9BdxLCWqK1yRXgNziVyJQ==');
 assert.equal(fast.tarSHA256,'4f5a67f7b61110aae7b3ad38e806627f5712f4c150bd38eb804a562e69a9ee5e');
 assert.equal(fast.members.length,47);assert.deepEqual(fast.licenseInputs,oldFast.licenseInputs);
 assert.equal(fast.license,'BSD-3-Clause');assert.equal(fast.rights,oldFast.rights);assert.deepEqual(fast.dependencies,{});
 assert.deepEqual(next.packages.filter(p=>p.name!=='fast-uri'),old.packages.filter(p=>p.name!=='fast-uri'));
 const {packages:op,version:ov,...oldScope}=old,{packages:np,version:nv,...newScope}=next;
 assert.deepEqual(newScope,oldScope,'runtime, own/native inputs, base, network and authority must retain exact scope');
 const lock=load('package-lock.json');
 for(const p of next.packages){
  const pin=lock.packages['node_modules/'+p.name];
  for(const k of ['version','resolved','integrity'])assert.equal(pin[k],p[k],p.name+':'+k);
  assert.deepEqual(pin.dependencies??{},p.dependencies);
  const root='node_modules/'+p.name,paths=[];
  function walk(rel=''){for(const name of readdirSync(root+(rel?'/'+rel:''))){const r=rel?rel+'/'+name:name,s=lstatSync(root+'/'+r);assert.equal(s.isSymbolicLink(),false);if(s.isDirectory())walk(r);else{assert.ok(s.isFile());paths.push(r);}}}walk();
  assert.deepEqual(paths.sort(),p.members.map(m=>m.path).sort());
  for(const m of p.members){const b=readFileSync(root+'/'+m.path);assert.equal(b.length,m.bytes);assert.equal(sha(b),m.sha256,p.name+'/'+m.path);}
 }
 assert.equal(next.packages.reduce((n,p)=>n+p.members.length,0),540);
});
