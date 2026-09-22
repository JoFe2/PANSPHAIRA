import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const CLI = resolve(import.meta.dirname, '../scripts/module-contribution.mjs');
function run(root, ...args) { return spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8' }); }
function put(root, path, value) { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value)); }
function git(root, ...args) { const r = spawnSync('git', args, {cwd:root,encoding:'utf8'}); assert.equal(r.status,0,r.stderr); return r.stdout.trim(); }
function fixture(t) {
 const root=mkdtempSync(join(tmpdir(),'module-contribution-')); t.after(()=>rmSync(root,{recursive:true,force:true}));
 git(root,'init','-q'); git(root,'config','user.email','test@example.invalid'); git(root,'config','user.name','Test');
 const modules=['a','b','c'].map((id,i)=>({id,version:'1',sources:[`${id}/source.mjs`],contracts:[`${id}/contract.json`],profiles:[],tests:[`${id}/test.mjs`],dependencies:i?{[['a','b'][i-1]]:'1'}:{}}));
 for(const m of modules){put(root,m.sources[0],'export const value=1;');put(root,m.contracts[0],{});put(root,m.tests[0],"import test from 'node:test'; test('sample',()=>{}); ");}
 put(root,'examples/module-contribution/modules.json',{schemaVersion:1,modules});git(root,'add','.');git(root,'commit','-qm','initial');return {root,modules};
}
function json(result) {assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);}
function catalog(root, modules) {put(root,'examples/module-contribution/modules.json',{schemaVersion:1,modules});}
test('optional growth relations are explicit intent, not resolved dependencies',t=>{
 const {root,modules}=fixture(t);
 modules[0].extensionRequests=[{reference:'proposal:future',requirement:'required',capability:'Export a profile'}];
 modules[2].variant={name:'compact',base:{id:'a',version:'1'}};
 catalog(root,modules);
 const graph=json(run(root,'graph'));
 assert.deepEqual(graph.relations,[{from:'a',kind:'extension-request',reference:'proposal:future',requirement:'required',capability:'Export a profile'},{from:'c',kind:'variant',name:'compact',to:'a',version:'1'}]);
 assert.equal(graph.edges.length,2);
 git(root,'add','.');git(root,'commit','-qm','relations');
 put(root,'a/contract.json',{changed:true});
 assert.deepEqual(json(run(root,'impact','--base','HEAD')).affected,['a','b']);
});
test('malformed growth relations fail closed',t=>{
 const {root,modules}=fixture(t);
 for(const request of [null,{},[{reference:'x',requirement:'sometimes',capability:'intent'}],[{reference:'x',requirement:'optional',capability:''}],[{reference:'x',requirement:'optional',capability:'intent',kind:'semantic'}],[{reference:'x\nclick',requirement:'required',capability:'intent'}]]){
  modules[0].extensionRequests=request;catalog(root,modules);assert.notEqual(run(root,'check').status,0,JSON.stringify(request));
 }
 delete modules[0].extensionRequests;
 for(const variant of [null,{}, {name:'v',base:{id:'missing',version:'1'}},{name:'v',base:{id:'b',version:'2'}},{name:'v',base:{id:'a',version:'1'}},{name:'',base:{id:'b',version:'1'}}]){
  modules[0].variant=variant;catalog(root,modules);assert.notEqual(run(root,'check').status,0,JSON.stringify(variant));
 }
});
test('Mermaid graph uses generated identifiers and escaped labels deterministically',t=>{
 const {root,modules}=fixture(t);
 modules[0].extensionRequests=[{reference:'https://example.invalid/?x="<>&',requirement:'optional',capability:'export [safe]'}];
 modules[2].variant={name:'small "view"',base:{id:'a',version:'1'}};
 catalog(root,modules);
 const r=run(root,'graph','--format','mermaid');assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/^flowchart LR\n/);assert.match(r.stdout,/m1 -->\|"depends on 1"\| m0/);
 assert.match(r.stdout,/#34;#60;#62;#38;/);assert.match(r.stdout,/extension request optional/);assert.match(r.stdout,/variant small #34;view#34;/);
 assert.doesNotMatch(r.stdout,/https:\/\//);assert.equal(r.stdout,run(root,'graph','--format','mermaid').stdout);
 assert.notEqual(run(root,'graph','--format','html').status,0);
});
test('release comparison uses bound snapshots for own and direct contract impact',t=>{
 const {root,modules}=fixture(t);
 const before=json(run(root,'release'));put(root,'before.json',before);
 put(root,'a/source.mjs','changed');put(root,'after.json',json(run(root,'release')));
 let result=json(run(root,'compare','--before','before.json','--after','after.json'));
 assert.deepEqual(result.changedModules,['a']);assert.deepEqual(result.affected,['a']);assert.equal(result.advisory,true);
 put(root,'a/contract.json',{changed:true});put(root,'after.json',json(run(root,'release')));
 rmSync(join(root,'a'),{recursive:true});rmSync(join(root,'examples'),{recursive:true});
 result=json(run(root,'compare','--before','before.json','--after','after.json'));
 assert.deepEqual(result.affected,['a','b']);assert.deepEqual(result.tests,['a/test.mjs','b/test.mjs']);
 assert.match(result.notice,/not authentication/);assert.match(result.notice,/no tests executed/);
 assert.equal(run(root,'compare','--before','before.json','--after','after.json').stdout,run(root,'compare','--before','before.json','--after','after.json').stdout);
});
function stable(v) {return Array.isArray(v)?`[${v.map(stable).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`:JSON.stringify(v);}
const digest=v=>createHash('sha256').update(v).digest('hex');
function rehash(m) {const {sha256,...payload}=m;m.sha256=digest(stable(payload));return m;}
test('comparison rejects unsupported, malformed and rehashed inconsistent snapshots',t=>{
 const {root}=fixture(t);const original=json(run(root,'release'));put(root,'before.json',original);
 const changes=[
  m=>m.schemaVersion=1, m=>m.schemaVersion=99, m=>m.sourceCommit='not-a-commit',
  m=>m.files[0].sha256='bad', m=>m.files[0].sha256=['0'.repeat(64)], m=>m.files.push(m.files[0]), m=>m.files.shift(),
  m=>m.files[0].path='../escape', m=>m.files.push({path:'unowned',sha256:'0'.repeat(64)}),
  m=>m.modules[0].version='invented', m=>m.modules[0].files.tests=[],
  m=>m.descriptorContent+=' ', m=>m.modules.push(m.modules[0]), m=>m.descriptor='missing.json',
 ];
 for(const change of changes){const m=structuredClone(original);change(m);rehash(m);put(root,'after.json',m);assert.notEqual(run(root,'compare','--before','before.json','--after','after.json').status,0,String(change));}
 const m=structuredClone(original);m.files[0].sha256='0'.repeat(64);put(root,'after.json',m);
 assert.notEqual(run(root,'compare','--before','before.json','--after','after.json').status,0);
 // An internally consistent rewritten source hash cannot establish provenance.
 const consistent=structuredClone(original);consistent.files.find(f=>f.path==='a/source.mjs').sha256='0'.repeat(64);rehash(consistent);put(root,'after.json',consistent);
 const result=json(run(root,'compare','--before','before.json','--after','after.json'));assert.match(result.notice,/not authentication/);assert.deepEqual(result.changedModules,['a']);
});
test('comparison treats added source files as internal and accepts empty declared directories',t=>{
 const {root,modules}=fixture(t);modules[0].sources=['a/src'];modules[0].profiles=['a/empty'];
 mkdirSync(join(root,'a/empty'));put(root,'a/src/one.mjs','one');catalog(root,modules);
 put(root,'before.json',json(run(root,'release')));put(root,'a/src/two.mjs','two');put(root,'after.json',json(run(root,'release')));
 const result=json(run(root,'compare','--before','before.json','--after','after.json'));assert.deepEqual(result.affected,['a']);
});
test('comparison retains removed module consumers and old tests without executing them',t=>{
 const {root,modules}=fixture(t);put(root,'before.json',json(run(root,'release')));
 modules.splice(0,1);modules[0].dependencies={};catalog(root,modules);put(root,'after.json',json(run(root,'release')));
 const result=json(run(root,'compare','--before','before.json','--after','after.json'));
 assert.deepEqual(result.changedModules,['a','b']);assert.deepEqual(result.affected,['a','b','c']);assert.ok(result.tests.includes('a/test.mjs'));
});
test('current module catalog exports readable graph and self-compares independently of checkout',t=>{
 const {root}=fixture(t);const repo=resolve(import.meta.dirname,'..');
 const release=json(run(repo,'release'));assert.equal(release.modules.length,5);put(root,'pilot.json',release);
 const result=json(run(root,'compare','--before','pilot.json','--after','pilot.json'));assert.deepEqual(result.changedModules,[]);assert.deepEqual(result.tests,[]);
 const graph=run(repo,'graph','--format','mermaid');assert.equal(graph.status,0,graph.stderr);assert.match(graph.stdout,/cscl-protocol/);assert.match(graph.stdout,/cscl-odoo-profile/);
});
test('check validates explicit modules and graph is deterministic',t=>{const {root}=fixture(t);assert.equal(json(run(root,'check')).modules,3);const a=run(root,'graph');assert.deepEqual(json(a).edges,[{from:'b',to:'a',version:'1',kind:'semantic'},{from:'c',to:'b',version:'1',kind:'semantic'}]);assert.equal(a.stdout,run(root,'graph').stdout);});

test('impact selects own tests for internals and only direct consumers for contracts',t=>{const {root}=fixture(t);put(root,'a/source.mjs','changed');let r=json(run(root,'impact','--base','HEAD'));assert.deepEqual(r.tests,['a/test.mjs']);put(root,'a/contract.json',{changed:true});r=json(run(root,'impact','--base','HEAD'));assert.deepEqual(r.tests,['a/test.mjs','b/test.mjs']);assert.equal(r.advisory,true);});
test('impact retains deleted and renamed ownership and removed descriptor consumers',t=>{const {root,modules}=fixture(t);rmSync(join(root,'a/contract.json'));let r=json(run(root,'impact','--base','HEAD'));assert.deepEqual(r.tests,['a/test.mjs','b/test.mjs']);put(root,'a/contract.json',{});put(root,'examples/module-contribution/modules.json',{schemaVersion:1,modules:modules.slice(1).map(m=>({...m,dependencies:m.id==='b'?{}:m.dependencies}))});r=json(run(root,'impact','--base','HEAD'));assert.ok(r.affected.includes('a'));assert.ok(r.tests.includes('b/test.mjs'));});

test('release is deterministic and verifier rejects altered bytes, missing dependencies and versions',t=>{const {root,modules}=fixture(t);const release=run(root,'release');const manifest=json(release);assert.match(manifest.sourceCommit,/^[a-f0-9]{40}$/);assert.equal(run(root,'release').stdout,release.stdout);put(root,'release.json',manifest);assert.equal(json(run(root,'verify','--manifest','release.json')).valid,true);put(root,'a/source.mjs','tampered');assert.notEqual(run(root,'verify','--manifest','release.json').status,0);put(root,'a/source.mjs','export const value=1;');modules[0].version='2';put(root,'examples/module-contribution/modules.json',{schemaVersion:1,modules});assert.match(run(root,'check').stderr,/Version mismatch/);modules.shift();put(root,'examples/module-contribution/modules.json',{schemaVersion:1,modules});assert.match(run(root,'verify','--manifest','release.json').stderr,/Missing dependency/);});
test('invalid paths and symlinks are denied',t=>{const {root,modules}=fixture(t);modules[0].sources=['../escape'];put(root,'examples/module-contribution/modules.json',{schemaVersion:1,modules});assert.match(run(root,'check').stderr,/Invalid path/);modules[0].sources=['a/link'];symlinkSync('/etc/passwd',join(root,'a/link'));put(root,'examples/module-contribution/modules.json',{schemaVersion:1,modules});assert.match(run(root,'check').stderr,/Symlink/);});

test('scaffold creates runnable template without overwrite or traversal',t=>{const {root}=fixture(t);const result=json(run(root,'scaffold','sample'));assert.match(result.next,/node --test/);const r=spawnSync(process.execPath,['--test','examples/module-contribution/sample/test.mjs'],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.notEqual(run(root,'scaffold','sample').status,0);assert.notEqual(run(root,'scaffold','../escape').status,0);assert.equal(json(run(root,'check','--descriptor','examples/module-contribution/sample/modules.json')).modules,1);});

test('impact retains ownership when a declared directory becomes empty',t=>{const {root,modules}=fixture(t);modules[0].sources=['a/src'];modules[0].tests=['a/tests'];put(root,'a/src/value.mjs','export const value=1;');put(root,'a/tests/value.mjs',"import test from 'node:test'; test('value',()=>{});");put(root,'examples/module-contribution/modules.json',{schemaVersion:1,modules});git(root,'add','.');git(root,'commit','-qm','directory ownership');rmSync(join(root,'a/src/value.mjs'));let plan=json(run(root,'impact','--base','HEAD'));assert.deepEqual(plan.affected,['a']);assert.deepEqual(plan.tests,['a/tests/value.mjs']);assert.notEqual(run(root,'check').status,0);rmSync(join(root,'a/tests/value.mjs'));plan=json(run(root,'impact','--base','HEAD'));assert.deepEqual(plan.missingTests,['a/tests/value.mjs']);assert.notEqual(run(root,'release').status,0);});

test('test command runs selected checks and propagates real failures',t=>{const {root}=fixture(t);put(root,'a/source.mjs','changed');let result=json(run(root,'test','--base','HEAD'));assert.deepEqual(result.tests,['a/test.mjs']);assert.equal(result.executed,true);put(root,'a/test.mjs',"import test from 'node:test'; test('broken',()=>{throw new Error('expected negative');});");assert.notEqual(run(root,'test','--base','HEAD').status,0);});

test('graph derives workspace dependencies without pretending ranges are solved',t=>{const {root}=fixture(t);put(root,'package.json',{workspaces:['packages/*']});put(root,'packages/one/package.json',{name:'one',version:'1.0.0'});put(root,'packages/two/package.json',{name:'two',version:'1.0.0',dependencies:{one:'^1.0.0',external:'2'}});const graph=json(run(root,'graph'));assert.deepEqual(graph.npm.edges,[{from:'two',to:'one',range:'^1.0.0',kind:'dependencies'}]);assert.equal(graph.npm.versionResolution,'not performed');});

test('impact plans a removed provider even while surviving descriptor has dangling dependency',t=>{const {root,modules}=fixture(t);put(root,'examples/module-contribution/modules.json',{schemaVersion:1,modules:modules.slice(1)});const r=json(run(root,'impact','--base','HEAD'));assert.deepEqual(r.tests,['a/test.mjs','b/test.mjs']);assert.notEqual(run(root,'check').status,0);});
test('rename, complete descriptor removal, invalid manifests and symlink ancestors fail safely',t=>{const {root}=fixture(t);git(root,'mv','a/contract.json','a/renamed.json');assert.deepEqual(json(run(root,'impact','--base','HEAD')).tests,['a/test.mjs','b/test.mjs']);git(root,'reset','--hard','HEAD');const m=json(run(root,'release'));m.files[0].path='../outside';put(root,'release.json',m);assert.notEqual(run(root,'verify','--manifest','release.json').status,0);rmSync(join(root,'examples/module-contribution/modules.json'));assert.deepEqual(json(run(root,'impact','--base','HEAD')).affected,['a','b','c']);rmSync(join(root,'examples/module-contribution'),{recursive:true});symlinkSync(tmpdir(),join(root,'examples/module-contribution'));assert.match(run(root,'scaffold','unsafe').stderr,/Symlink/);});
