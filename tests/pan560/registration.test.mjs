import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createProtectedBrowserBootstrapV1} from '../../src/pan562/native-browser-bootstrap.mjs';

const entry='scripts/run-pan566-confirmed-configuration-application-tests.mjs';
const original=['tests/pan566/browser-application.test.mjs','tests/pan566/browser-application-flow.test.mjs','tests/pan566/browser-application-negatives.test.mjs','tests/pan566/native-application.test.mjs','tests/pan566/contract.test.mjs','tests/pan566/registration.test.mjs'];
const added=['tests/pan560/connected-foundation.test.mjs','tests/pan560/registration.test.mjs'];
const inputs=[['docs/architecture/connected-provider-free-onboarding-foundation-v1.md','DERIVED_EVIDENCE'],...added.map(path=>[path,'VALIDATOR'])];
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');

test('E1 connected family is exhaustive and serial inside the unchanged566 package command, never a second canonical entry',()=>{
 const pkg=JSON.parse(readFileSync('package.json','utf8'));
 assert.equal(pkg.scripts['pan566:test'],'TMPDIR="${TMPDIR:-${RUNNER_TEMP:?PAN566_OWNED_SCRATCH_REQUIRED}}" node '+entry);
 assert.equal(pkg.scripts.pretest.split('npm run pan566:test').length,2);
 assert.equal(pkg.scripts['pan560:test'],undefined);
 const result=spawnSync(process.execPath,[entry,'--list'],{encoding:'utf8'});assert.equal(result.status,0);assert.deepEqual(JSON.parse(result.stdout),[...original,...added]);
 assert.deepEqual(readdirSync('tests/pan566').filter(x=>x.endsWith('.test.mjs')).map(x=>'tests/pan566/'+x).sort(),[...original].sort());
 assert.deepEqual(readdirSync('tests/pan560').filter(x=>x.endsWith('.test.mjs')).map(x=>'tests/pan560/'+x).sort(),[...added].sort());
 const source=readFileSync(entry,'utf8');assert.ok(source.includes('--test-concurrency=1'));assert.equal(source.includes('--test-concurrency=3'),false);
});

test('E1 empty model attachment is only code-owned; bootstrap rejects arbitrary public catalog instead of admitting provider authority',()=>{
 const source=readFileSync('src/pan562/native-browser-bootstrap.mjs','utf8');
 assert.match(source,/configurationApplication:application,modelConnections:\[\]/);
 assert.equal(source.match(/modelConnections/g)?.length,1);
 assert.throws(()=>createProtectedBrowserBootstrapV1({modelConnections:[]}),/BOOTSTRAP/);
 for(const value of ['connectionId','inferenceTransport','secretValue','apiKey'])assert.equal(source.includes('options.'+value),false);
});

test('E1 exact hashes source-only membership and original bounded DAG/legacy authorities stay intact on existing563 owner',()=>{
 const graph=JSON.parse(readFileSync('verification/verification-dag-v2.json','utf8'));
 const sums=new Map(readFileSync('SHA256SUMS','utf8').trim().split('\n').map(line=>{const m=/^([a-f0-9]{64})  \.\/(.+)$/.exec(line);assert.ok(m);return [m[2],m[1]];}));
 const builder=readFileSync('scripts/build-public-release.sh','utf8');
 const legacy=new Set(readFileSync('release/public-files.manifest','utf8').split('\n').filter(x=>x&&!x.startsWith('#')).map(x=>x.split('\t')[0]));
 assert.equal(graph.graphVersion,104);assert.equal(graph.nodes.length,109);assert.equal(legacy.size,1792);
 assert.ok(graph.nodes.every(n=>n.inputs.length<=128&&n.ownedTests.length<=64));
 for(const [path,role] of inputs){
  const owners=graph.nodes.filter(n=>n.inputs.some(i=>i.path===path));assert.deepEqual(owners.map(n=>n.id),['pan563-configuration-draft-v1'],path);
  const input=owners[0].inputs.find(i=>i.path===path);assert.equal(input.role,role);assert.equal(input.sha256,hash(path));assert.equal(sums.get(path),hash(path));assert.ok(owners[0].ownedTests.includes('npm run pan566:test'));
  assert.ok(builder.includes(JSON.stringify(path)));assert.equal(legacy.has(path),false);
 }
 assert.deepEqual(graph.hardGates,['npm run lint','npm run release-governance:verify','npm run supply-chain:verify','sha256sum -c SHA256SUMS','./scripts/build-public-release.sh --output <isolated-absolute-path>']);
});

test('E1 public scope retains all six original criteria and distinct source/runtime/model/review/delivery evidence',()=>{
 const doc=readFileSync(inputs[0][0],'utf8');
 for(const text of ['E1-AC01','E1-AC02','E1-AC03','E1-AC04','E1-AC05','E1-AC06','Node24.14.1','source-only','NONE','NOT_RUN','UNKNOWN','independent','390','900','64MiB','anonymous','not a new platform'])assert.ok(doc.includes(text),text);
 const body=readFileSync(added[0],'utf8');
 for(const text of ['readPan515TradeState','f.restart()','actual200','NO_AUTHORIZED_CONNECTION','body.consent','externalInferenceCalls'])assert.ok(body.includes(text),text);
});
