// Historical-source test input only, not a hybrid deployment or product authority.
import assert from 'node:assert/strict';
import {after} from 'node:test';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync,symlinkSync,copyFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {financeFixture} from '../pan519/native-fixture.mjs';
import {createProtectedSessionAdapterV1} from '../../src/pan527/origin-session-adapter.mjs';
import {shapeIdentity527} from '../pan527/helpers.mjs';
import catalog from '../../src/pan542/source-compatibility-catalog-v1.json' with {type:'json'};
const repo=fileURLToPath(new URL('../../',import.meta.url));let cached=null,temporary=null,predecessorCached=null,predecessorTemporary=null;
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
export function legacySourceInput(){
  if(cached)return cached;
  if(process.env.PAN542_LEGACY_SOURCE_INPUT){
    cached=realpathSync(process.env.PAN542_LEGACY_SOURCE_INPUT);
    assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:cached,encoding:'utf8'}).trim(),catalog.originalPrimary.commit);
    assert.equal(execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:cached,encoding:'utf8'}).trim(),catalog.originalPrimary.tree);
    assert.equal(execFileSync('git',['status','--porcelain'],{cwd:cached,encoding:'utf8'}),'');
  }else{
    // CI has the exact primary history. No network, invented source, package
    // installation or application-level source override is used by this test.
    assert.equal(execFileSync('git',['rev-parse',catalog.originalPrimary.commit+'^{tree}'],{cwd:repo,encoding:'utf8'}).trim(),catalog.originalPrimary.tree);
    temporary=mkdtempSync(join(tmpdir(),'pan542-primary-legacy-input-'));cached=temporary;
    const archive=execFileSync('git',['archive','--format=tar',catalog.originalPrimary.commit],{cwd:repo,maxBuffer:256*1024*1024});
    execFileSync('tar',['-x','-C',cached],{input:archive,maxBuffer:1024*1024});
    symlinkSync(join(repo,'node_modules'),join(cached,'node_modules'),'dir');
    execFileSync(process.execPath,[join(repo,'node_modules/typescript/bin/tsc'),'-p',join(cached,'tsconfig.json')],{cwd:cached,maxBuffer:4*1024*1024});
  }
  for(const row of catalog.originalSourceIdentity)assert.equal(hash(join(cached,row.path)),row.sha256,'GENUINE_LEGACY_SOURCE_INPUT_REQUIRED:'+row.path);
  return cached;
}
after(()=>{if(temporary)rmSync(temporary,{recursive:true,force:true});if(predecessorTemporary)rmSync(predecessorTemporary,{recursive:true,force:true});});

// Genuine complete immutable V1 release for V1 history tests and the explicit V2
// predecessor stage. Never splice a current adapter/backend into that source.
export function predecessorSourceInput(){
  if(predecessorCached)return predecessorCached;
  const policy=JSON.parse(readFileSync(new URL('../../src/pan542/source-compatibility-catalog-v2.json',import.meta.url),'utf8'));
  if(process.env.PAN542_PREDECESSOR_SOURCE_INPUT){
    predecessorCached=realpathSync(process.env.PAN542_PREDECESSOR_SOURCE_INPUT);
    assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:predecessorCached,encoding:'utf8'}).trim(),policy.predecessorPrimary.commit);
    assert.equal(execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:predecessorCached,encoding:'utf8'}).trim(),policy.predecessorPrimary.tree);
    assert.equal(execFileSync('git',['status','--porcelain'],{cwd:predecessorCached,encoding:'utf8'}),'');
  }else{
    assert.equal(execFileSync('git',['rev-parse',policy.predecessorPrimary.commit+'^{tree}'],{cwd:repo,encoding:'utf8'}).trim(),policy.predecessorPrimary.tree);
    predecessorTemporary=mkdtempSync(join(tmpdir(),'pan542-v1-predecessor-input-'));predecessorCached=predecessorTemporary;
    const archive=execFileSync('git',['archive','--format=tar',policy.predecessorPrimary.commit],{cwd:repo,maxBuffer:256*1024*1024});
    execFileSync('tar',['-x','-C',predecessorCached],{input:archive,maxBuffer:1024*1024});
    // Preserve the literal primary Git identity for the unchanged nested V1 fixture.
    // Only Git metadata is attached; archive payload and source catalog stay exact.
    const common=execFileSync('git',['rev-parse','--git-common-dir'],{cwd:repo,encoding:'utf8'}).trim();
    execFileSync('git',['init','--quiet',predecessorCached],{cwd:repo,maxBuffer:1024*1024});
    writeFileSync(join(predecessorCached,'.git/objects/info/alternates'),resolve(repo,common,'objects')+'\n',{mode:0o600});
    writeFileSync(join(predecessorCached,'.git/HEAD'),policy.predecessorPrimary.commit+'\n',{mode:0o600});
    writeFileSync(join(predecessorCached,'.git/info/exclude'),'/node_modules\n',{mode:0o600});
    execFileSync('git',['read-tree',policy.predecessorPrimary.commit],{cwd:predecessorCached,maxBuffer:1024*1024});
    symlinkSync(join(repo,'node_modules'),join(predecessorCached,'node_modules'),'dir');
    execFileSync(process.execPath,[join(repo,'node_modules/typescript/bin/tsc'),'-p',join(predecessorCached,'tsconfig.json')],{cwd:predecessorCached,maxBuffer:4*1024*1024});
  }
  for(const row of policy.predecessorSourceIdentity)assert.equal(hash(join(predecessorCached,row.path)),row.sha256,'GENUINE_V1_PREDECESSOR_SOURCE_INPUT_REQUIRED:'+row.path);
  return predecessorCached;
}

export const compatibilityOrigin='https://pan542-compatibility.test:4443';
export function sessionOptions(stateRoot,overrides={}){return {optIn:true,origin:compatibilityOrigin,identity:shapeIdentity527('tenant-a'),stateRoot,...overrides};}
export async function compatibilityFixture({unbound=false,legacyOverride=null}={}){
  const f=await financeFixture();
  try{
    const authRoot=join(f.parent,'source-transition-auth');mkdirSync(authRoot,{mode:0o700});
    const sessions=createProtectedSessionAdapterV1(sessionOptions(authRoot));
    const legacy=await import(pathToFileURL(legacyOverride??join(legacySourceInput(),'src/pan542/native-human-backend.mjs')));
    if(!unbound)legacy.initializeNativeErvHumanBackendV1({root:f.root,owner:'LOCAL_SYNTHETIC_OWNER',sessionBinding:sessions.binding});
    return {...f,authRoot,sessions,legacy};
  }catch(e){f.close();throw e;}
}
export function originalRows(root){
  const db=new DatabaseSync(join(root,'target.sqlite'),{readOnly:true});
  try{return Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='pan542_source_compatibility_v1' ORDER BY name").all().map(({name})=>[name,JSON.parse(JSON.stringify(db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'" ORDER BY rowid').all()))]));}finally{db.close();}
}
export function sourceNegativeFixture(input,parent){
  // Exact-byte local copies/symlinks solely for isolated DENIAL tests. They are
  // never admitted as a deployment, source archive or preserved-data GREEN.
  const root=join(parent,'untrusted-source-negative');mkdirSync(root,{mode:0o700});
  const paths=[...catalog.originalSourceIdentity.map(r=>r.path),'src/pan542/source-compatibility-catalog-v1.json','src/pan542/source-compatibility-catalog-v2.json'];
  for(const path of paths){const src=join(input,path),dst=join(root,path);mkdirSync(dirname(dst),{recursive:true,mode:0o700});
    if(path==='src/pan542/native-human-backend.mjs'||/source-compatibility-catalog-v[12]\.json$/.test(path)){try{copyFileSync(src,dst);}catch(e){if(e.code!=='ENOENT')throw e;}}
    else symlinkSync(src,dst);
  }
  return root;
}
