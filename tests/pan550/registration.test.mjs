import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const entry='scripts/run-pan550-native-administration-tests.mjs';
const files=["tests/pan550/native-administration.test.mjs","tests/pan550/native-approval.test.mjs","tests/pan550/native-coupled-context.test.mjs","tests/pan550/browser-administration.test.mjs","tests/pan550/browser-approval.test.mjs","tests/pan550/registration.test.mjs"];
const inputs=[["docs/architecture/native-administration-approval-browser-v1.md","DERIVED_EVIDENCE"],["packages/contracts/src/workspace-administration-v1.ts","CONTRACT"],["packages/contracts/src/workspace-administration-approval-v1.ts","CONTRACT"],["packages/browser-workspace/src/workspace-administration-v1.ts","SOURCE"],["packages/browser-workspace/src/workspace-administration-v1.css","SOURCE"],["src/pan550/native-administration.mjs","SECURITY"],["src/pan550/native-approval-source.mjs","SECURITY"],["scripts/run-pan550-native-administration-tests.mjs","VALIDATOR"],["tests/pan550/native-administration.test.mjs","VALIDATOR"],["tests/pan550/native-approval.test.mjs","VALIDATOR"],["tests/pan550/browser-fixture.mjs","VALIDATOR"],["tests/pan550/browser-administration.test.mjs","VALIDATOR"],["tests/pan550/browser-approval.test.mjs","VALIDATOR"],["tests/pan550/registration.test.mjs","VALIDATOR"],["tests/pan550/native-coupled-context.test.mjs","VALIDATOR"]];
const digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
test('PUI-09 registration: one complete fixed canonical entry owns every context/native/expiry/real-browser/registration case, without replacing older entries',()=>{
 const pkg=JSON.parse(readFileSync('package.json','utf8'));assert.equal(pkg.scripts['pan550:test'],'TMPDIR="${TMPDIR:-${RUNNER_TEMP:?PAN550_OWNED_SCRATCH_REQUIRED}}" node '+entry,'PAN550_FIXED_CANONICAL_ENTRY_MISSING');assert.equal(pkg.scripts.pretest.split('npm run pan550:test').length,2);
 for(const id of [527,541,542,543,544,549,563])assert.ok(pkg.scripts.pretest.includes('npm run pan'+id+':test'));
 const list=spawnSync(process.execPath,[entry,'--list'],{encoding:'utf8'});assert.equal(list.status,0,list.stderr);assert.deepEqual(JSON.parse(list.stdout),files);
 assert.deepEqual(readdirSync('tests/pan550').filter(p=>p.endsWith('.test.mjs')).map(p=>'tests/pan550/'+p).sort(),[...files].sort());
});
test('PUI-09 registration: caller selection, Node24 marker, aliases and executable startup options deny before build/test; trusted Node/npm parent remains required',()=>{
 const env={...process.env};delete env.NODE_TEST_CONTEXT;delete env.NODE_OPTIONS;
 for(const args of [['--skip-native'],[files[0]],['--list','--skip-browser'],['--test-shard=1/5']]){const r=spawnSync(process.execPath,[entry,...args],{encoding:'utf8',env,timeout:10000});assert.equal(r.error,undefined);assert.notEqual(r.status,0);assert.match(r.stderr,/PAN550_TEST_ARGUMENT_DENIED/);assert.equal(r.stdout,'');}
 for(const marker of ['','child-v8','unexpected-marker']){const r=spawnSync(process.execPath,[entry],{encoding:'utf8',env:{...env,NODE_TEST_CONTEXT:marker},timeout:10000});assert.equal(r.error,undefined);assert.notEqual(r.status,0);assert.match(r.stderr,/PAN550_TEST_ARGUMENT_DENIED/);assert.equal(r.stdout,'');}
 const scratch=env.TMPDIR||env.RUNNER_TEMP;assert.ok(scratch,'PAN550_OWNED_SCRATCH_REQUIRED');const home=mkdtempSync(scratch+'/pan550-startup-admission-');
 try{const esm=home+'/exit-worker.mjs',cjs=home+'/exit-worker.cjs',code="if(process.argv.slice(1).some(path=>path.endsWith('.test.mjs')))process.exit(0);\n";writeFileSync(esm,code);writeFileSync(cjs,code);
  const optionValue=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"',esmOption=optionValue(pathToFileURL(esm).href),cjsOption=optionValue(cjs);
  for(const options of ['--import='+esmOption,'-r '+cjsOption]){const boot=spawnSync(process.execPath,['-e',"process.stdout.write('TRUSTED_NODE24_BOOT_REACHED\\n')"],{encoding:'utf8',env:{...env,NODE_OPTIONS:options},timeout:10000});assert.equal(boot.error,undefined,options);assert.equal(boot.status,0,boot.stderr);assert.equal(boot.stdout,'TRUSTED_NODE24_BOOT_REACHED\n');assert.equal(boot.stderr,'');}
  for(const options of ['--test-name-pattern=never','--test_name_pattern=never','--test-"skip-pattern"=.*','--test-shard=1/5','--test_only','--test-isolation=none','--experimental_test_isolation=none','--test-rerun-failures=not-admitted','--test-global-setup='+esmOption,'--import='+esmOption,'--im"port"='+esmOption,'--require='+cjsOption,'-r '+cjsOption,'--loader='+esmOption,'--experimental_loader='+esmOption]){const r=spawnSync(process.execPath,[entry],{encoding:'utf8',env:{...env,NODE_OPTIONS:options},timeout:10000});assert.equal(r.error,undefined,options);assert.notEqual(r.status,0,options);assert.match(r.stderr,/PAN550_TEST_ARGUMENT_DENIED/,options);assert.equal(r.stdout,'',options);}
 }finally{rmSync(home,{recursive:true});}
 const noScratch={...env};delete noScratch.TMPDIR;delete noScratch.RUNNER_TEMP;
 for(const options of ['', '--conditions=--test-not-a-control --max_old_space_size=256 --trace-warnings', '--conditions __test-not-a-control --max_old_space_size=256 --trace-warnings', '-C "__test-not-a-control" --max_old_space_size=256 --trace-warnings', '--conditions=__test-not-a-control --max_old_space_size=256 --trace-warnings']){
  const childEnv={...noScratch,NODE_OPTIONS:options},boot=spawnSync(process.execPath,['-e',"process.stdout.write('TRUSTED_NODE24_BOOT_REACHED\\n')"],{encoding:'utf8',env:childEnv,timeout:10000});assert.equal(boot.error,undefined,options);assert.equal(boot.status,0,boot.stderr);assert.equal(boot.stdout,'TRUSTED_NODE24_BOOT_REACHED\n');assert.equal(boot.stderr,'');
  const r=spawnSync(process.execPath,[entry],{encoding:'utf8',env:childEnv,timeout:10000});assert.equal(r.error,undefined);assert.equal(r.status,1);assert.equal(r.stderr,'PAN550_OWNED_SCRATCH_REQUIRED\n');assert.equal(r.stdout,'');
 }
});
test('PUI-09 registration: additive bounded context owner keeps existing session/shell/native/profile ownership and hard gates',()=>{
 const graph=JSON.parse(readFileSync('verification/verification-dag-v2.json','utf8')),owners=graph.nodes.filter(n=>n.id==='pan541-shared-browser-shell-v1');assert.equal(owners.length,1,'PAN550_EXISTING_SHELL_OWNER_MISSING');const owner=owners[0];
 assert.equal(graph.nodes.length,103);assert.equal(graph.graphVersion,98);assert.deepEqual(owner.dependsOn,['pan516-native-procurement-v1','pan527-origin-session-v1']);assert.deepEqual(owner.inputs.filter(i=>inputs.some(([p])=>p===i.path)).map(({path,role})=>[path,role]),inputs);assert.ok(owner.ownedTests.includes('npm run pan550:test'));assert.equal(owner.riskClass,'HIGH');assert.equal(owner.globalInvalidation,false);
 for(const [path]of inputs)assert.deepEqual(graph.nodes.filter(n=>n.inputs.some(i=>i.path===path)).map(n=>n.id),[owner.id]);
 assert.equal(graph.nodes.find(n=>n.id==='repository-integrity').ownedTests.filter(t=>t==='npm run pan550:test').length,1);
 assert.deepEqual(graph.hardGates,['npm run lint','npm run release-governance:verify','npm run supply-chain:verify','sha256sum -c SHA256SUMS','./scripts/build-public-release.sh --output <isolated-absolute-path>']);
 assert.ok(graph.nodes.find(n=>n.id==='pan541-shared-browser-shell-v1').inputs.some(x=>x.path==='src/pan543/profile-store.mjs'));
});
test('PUI-09 registration: new owner input bytes are exact checksum members and closed source-only classifications, with unchanged legacy runnable manifest',()=>{
 const graph=JSON.parse(readFileSync('verification/verification-dag-v2.json','utf8')),owner=graph.nodes.find(n=>n.id==='pan541-shared-browser-shell-v1');assert.ok(owner,'PAN550_DERIVED_DAG_OWNER_MISSING');
 const sums=new Map(readFileSync('SHA256SUMS','utf8').trimEnd().split('\n').map(line=>{const m=/^([a-f0-9]{64})  \.\/(.+)$/.exec(line);assert.ok(m);return [m[2],m[1]];}));
 const builder=readFileSync('scripts/build-public-release.sh','utf8'),payload=new Set(readFileSync('release/public-files.manifest','utf8').split('\n').filter(x=>x&&!x.startsWith('#')).map(x=>x.split('\t')[0]));assert.equal(payload.size,1792);
 for(const input of owner.inputs.filter(i=>inputs.some(([p])=>p===i.path))){assert.equal(sums.get(input.path),digest(input.path),input.path);assert.equal(input.sha256,digest(input.path),input.path);assert.equal(payload.has(input.path),false,input.path);assert.ok(builder.includes(JSON.stringify(input.path)),'PAN550_CLOSED_BUILDER_MEMBER_MISSING:'+input.path);}
});
test('PUI09 documented limits and immutable shared public value-pool preserves source-only/no activation/model authority',async()=>{
 const doc=readFileSync('docs/architecture/native-administration-approval-browser-v1.md','utf8');for(const value of ['PUI-09-AC01','PUI-09-AC02','PUI-09-AC03','PUI-09-AC04','DUI10','SOURCE_EVIDENCE_ONLY','UNKNOWN','NOT_DELIVERED','trusted Node/npm parent','131072'])assert.ok(doc.includes(value),value);
 const pool=await import('../../dist/packages/contracts/src/browser-shell-plugin-v1.js');assert.equal(pool.browserWorkspaceStringValuesV1.length,236);assert.equal(Object.isFrozen(pool.browserWorkspaceStringValuesV1),true);assert.equal(Object.hasOwn(pool,'bv'),false);assert.equal(pool.browserWorkspaceStringValuesV1[52],'pansphaira.browser-plugin/v1');
});
