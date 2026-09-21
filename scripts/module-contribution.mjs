#!/usr/bin/env node
import { readFileSync, lstatSync, readdirSync, realpathSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const DEFAULT = 'examples/module-contribution/modules.json';
const fail = message => { throw new Error(message); };
const sorted = values => [...new Set(values)].sort();
function canonical(value) {
 if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
 if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
 return JSON.stringify(value);
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function safe(path) {
 if(typeof path!=='string'||!path||path.includes('\\')||path.includes('\0')||path!==path.normalize('NFC')||path.split('/').some(p=>!p||p==='.'||p==='..')||path.startsWith('-')||/^[A-Za-z]:/.test(path)) fail(`Invalid path: ${path}`);
 return path;
}
function disk(root) {
 function entry(path) {let full=root;for(const part of safe(path).split('/')){full=join(full,part);if(lstatSync(full).isSymbolicLink())fail(`Symlink denied: ${path}`);}return full;}
 return {read:path=>readFileSync(entry(path)), exists:path=>{try{entry(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}, files(path){const full=entry(path);const st=lstatSync(full);if(st.isFile())return [path];if(!st.isDirectory())fail(`Not a regular file: ${path}`);return readdirSync(full).sort().flatMap(n=>this.files(`${path}/${n}`));}};
}
function npmGraph(view) {
 const result={packages:[],edges:[],versionResolution:'not performed',coverage:'No root npm workspaces declared',manifests:[]};
 if(!view.exists('package.json'))return result;
 result.manifests.push('package.json');const root=JSON.parse(view.read('package.json'));
 const patterns=Array.isArray(root.workspaces)?root.workspaces:root.workspaces?.packages||[];
 for(const pattern of patterns){
  safe(pattern);if(/[?{}[\]!]/.test(pattern)||pattern.includes('**')||(pattern.includes('*')&&!pattern.endsWith('/*')))fail('Unsupported workspace pattern; use literal directories or parent/*');
  const paths=pattern.endsWith('/*')?view.files(pattern.slice(0,-2)).filter(p=>p.startsWith(pattern.slice(0,-1))&&p.slice(pattern.length-1).split('/').length===2&&p.endsWith('/package.json')):[`${pattern}/package.json`];
  for(const path of paths){const p=JSON.parse(view.read(path));if(!p.name||!p.version)fail('Workspace name/version required');result.packages.push({name:p.name,version:p.version,path});result.manifests.push(path);}
 }
 result.packages.sort((a,b)=>a.name.localeCompare(b.name));
 if(new Set(result.packages.map(p=>p.name)).size!==result.packages.length)fail('Duplicate workspace name');
 for(const pkg of result.packages){const p=JSON.parse(view.read(pkg.path));for(const kind of ['dependencies','devDependencies','peerDependencies','optionalDependencies'])for(const [to,range] of Object.entries(p[kind]||{}))if(result.packages.some(n=>n.name===to))result.edges.push({from:pkg.name,to,range,kind});}
 result.edges.sort((a,b)=>canonical(a).localeCompare(canonical(b)));result.manifests=sorted(result.manifests);
 if(patterns.length)result.coverage='Declared npm workspace edges only; not mapped to semantic tests';return result;
}
function load(view, descriptor, advisory = false) {
 const doc=JSON.parse(view.read(descriptor));
 if(doc.schemaVersion!==1||!Array.isArray(doc.modules))fail('Invalid descriptor schema');
 const modules=doc.modules.map(m=>{
  if(!/^[a-z][a-z0-9-]*$/.test(m.id)||typeof m.version!=='string'||!m.version)fail('Invalid module identity/version');
  const files={};for(const key of ['sources','contracts','profiles','tests']) {if(!Array.isArray(m[key]))fail(`Missing ${key}`);files[key]=sorted(m[key].flatMap(p=>view.files(safe(p))));}
  if(!advisory&&(!files.sources.length||!files.tests.length))fail('Sources and tests required');
  if(!m.dependencies||Array.isArray(m.dependencies)||typeof m.dependencies!=='object')fail('Dependencies must be an object');
  return {...m,files};
 }).sort((a,b)=>a.id.localeCompare(b.id));
 if(new Set(modules.map(m=>m.id)).size!==modules.length)fail('Duplicate module id');
 const edges=[];for(const m of modules)for(const [to,version] of Object.entries(m.dependencies)){const target=modules.find(n=>n.id===to);if(!advisory&&!target)fail(`Missing dependency: ${to}`);if(!advisory&&target.version!==version)fail(`Version mismatch: ${to}`);edges.push({from:m.id,to,version,kind:'semantic'});}
 return {schemaVersion:1,coverage:'Explicit semantic modules only; no import inference or transitive test selection.',modules,edges:edges.sort((a,b)=>canonical(a).localeCompare(canonical(b)))};
}
function git(root, ...args) { return execFileSync('git', args, {cwd:root,encoding:'utf8',maxBuffer:32*1024*1024}); }
function snapshot(root, commit) {
 const entries=git(root,'ls-tree','-rz','--full-tree',commit).split('\0').filter(Boolean).map(row=>{const [meta,path]=row.split('\t');return {path,mode:meta.split(' ')[0]};});
 const paths=entries.map(e=>e.path);
 return {exists:path=>paths.includes(safe(path)), read(path){safe(path);const e=entries.find(e=>e.path===path);if(!e||!['100644','100755'].includes(e.mode))fail(`Missing or unsafe historical path: ${path}`);return execFileSync('git',['show',`${commit}:${path}`],{cwd:root,maxBuffer:32*1024*1024});},files(path){safe(path);return paths.filter(p=>p===path||p.startsWith(`${path}/`)).map(p=>{this.read(p);return p;});}};
}
function impact(root, descriptor, base) {
 const commit=git(root,'rev-parse','--verify','--end-of-options',`${base}^{commit}`).trim();
 const oldView=snapshot(root,commit);const current=disk(root);
 // Deleted files must retain ownership from the old graph, not fail validation.
 const tolerant={...current,files(path){return current.exists(path)?current.files(path):[safe(path)];}};
 const old=oldView.exists(descriptor)?load(oldView,descriptor):{modules:[],edges:[]};
 const now=current.exists(descriptor)?load(tolerant,descriptor,true):{modules:[],edges:[]};
 const changed=sorted([...git(root,'diff','--name-only','--no-renames','-z',commit,'--').split('\0'),...git(root,'ls-files','--others','--exclude-standard','-z').split('\0')].filter(Boolean));
 const own=new Set(), contract=new Set();
 for(const graph of [old,now])for(const m of graph.modules){
  const previous=old.modules.find(n=>n.id===m.id),next=now.modules.find(n=>n.id===m.id);
  const descriptorChanged=!previous||!next||canonical({...previous,files:undefined})!==canonical({...next,files:undefined});
  if(descriptorChanged||Object.values(m.files).flat().some(p=>changed.includes(p)))own.add(m.id);
  if(descriptorChanged||[...m.files.contracts,...m.files.profiles].some(p=>changed.includes(p)))contract.add(m.id);
 }
 const affected=new Set(own);for(const e of [...old.edges,...now.edges])if(contract.has(e.to))affected.add(e.from);
 const candidates=sorted([...old.modules,...now.modules].filter(m=>affected.has(m.id)).flatMap(m=>m.files.tests));
 return {advisory:true,base:commit,changed,affected:sorted(affected),tests:candidates.filter(p=>current.exists(p)),missingTests:candidates.filter(p=>!current.exists(p)),unmapped:changed.filter(p=>p!==descriptor&&![...old.modules,...now.modules].some(m=>Object.values(m.files).flat().includes(p))),coverage:now.coverage||old.coverage};
}
function release(root, descriptor) {
 const view=disk(root), graph=load(view,descriptor);
 const paths=sorted([descriptor,...graph.modules.flatMap(m=>Object.values(m.files).flat())]);
 const payload={schemaVersion:1,sourceCommit:git(root,'rev-parse','HEAD').trim(),descriptor,coverage:graph.coverage,modules:graph.modules.map(m=>({id:m.id,version:m.version,dependencies:m.dependencies})),files:paths.map(path=>({path,sha256:hash(view.read(path))}))};
 return {...payload,sha256:hash(canonical(payload))};
}
function verify(root, path, descriptor) {
 const manifest=JSON.parse(disk(root).read(safe(path)));
 // Rebuild the full expected inventory, not just the attacker-supplied file list.
 const expected=release(root,descriptor);
 if(canonical(manifest)!==canonical(expected))fail('Release integrity mismatch (bytes, inventory, dependencies, or source commit)');
 return {valid:true,sha256:expected.sha256,notice:'Integrity only; not attestation or semantic proof.'};
}
function scaffold(root, slug) {
 if(!/^[a-z][a-z0-9-]*$/.test(slug))fail('Invalid scaffold slug');
 const parent='examples/module-contribution';disk(root).files(parent); // reject hostile ancestors before any write
 const dir=`${parent}/${slug}`;mkdirSync(join(root,dir)); // exclusive directory: no overwrite
 const files={'source.mjs':'// Runnable template, not a business product.\nexport const greet = name => `Hello, ${name}`;\n','test.mjs':"import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { greet } from './source.mjs';\ntest('template greeting',()=>assert.equal(greet('world'),'Hello, world'));\n",'contract.json':JSON.stringify({input:'name: string',output:'greeting: string',template:true})};
 files['modules.json']=JSON.stringify({schemaVersion:1,modules:[{id:slug,version:'1',sources:[`${dir}/source.mjs`],contracts:[`${dir}/contract.json`],profiles:[],tests:[`${dir}/test.mjs`],dependencies:{}}]},null,2)+'\n';
 for(const [path,bytes] of Object.entries(files))writeFileSync(join(root,dir,path),bytes,{flag:'wx'});
 return {directory:dir,template:true,next:`node --test ${dir}/test.mjs`,check:`node scripts/module-contribution.mjs check --descriptor ${dir}/modules.json`};
}
function main() {
 const args=process.argv.slice(2);const command=args.shift();let descriptor=DEFAULT;const root=realpathSync(process.cwd());const view=disk(root);
 const index=args.indexOf('--descriptor');if(index>=0){if(!args[index+1])fail('Missing descriptor');descriptor=safe(args[index+1]);args.splice(index,2);}
 if(command==='scaffold'&&args.length===1)return scaffold(root,args[0]);
 if(command==='test'&&args.length===2&&args[0]==='--base') {
  load(view,descriptor);
  const plan=impact(root,descriptor,args[1]);
  if(plan.missingTests.length)fail('Selected tests are missing');
  for(const path of plan.tests) {safe(path);view.read(path);if(!/\.(?:mjs|cjs|js)$/.test(path))fail(`Build required or unsupported test: ${path}`);}
  if(plan.tests.length) {
   // Explicit opt-in executes reviewed test files, never descriptor shell commands.
   // Prefix paths to avoid option interpretation; retain native failure status.
   const testEnv={...process.env};delete testEnv.NODE_TEST_CONTEXT;
   try {const output=execFileSync(process.execPath,['--test',...plan.tests.map(p=>`./${p}`)],{cwd:root,env:testEnv,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});process.stderr.write(output);}
   catch(error){if(error.stdout)process.stderr.write(error.stdout);if(error.stderr)process.stderr.write(error.stderr);fail('Selected tests failed or timed out');}
  }
  return {...plan,advisory:false,executed:plan.tests.length>0,notice:'Only declared selected tests executed; unmapped changes require separate checks.'};
 }
 if(command==='impact'&&args.length===2&&args[0]==='--base')return impact(root,descriptor,args[1]);
 if(command==='verify'&&args.length===2&&args[0]==='--manifest')return verify(root,args[1],descriptor);
 if(args.length)fail('Unexpected arguments');
 if(command==='release')return release(root,descriptor);
 const graph=load(view,descriptor);
 if(command==='check')return {valid:true,modules:graph.modules.length,coverage:graph.coverage};
 if(command==='graph')return {...graph,npm:npmGraph(view)};
 fail('Usage: module-contribution.mjs check|graph');
}
try {console.log(canonical(main()));}catch(error){console.error(`module-contribution: ${error.message}`);process.exitCode=1;}
