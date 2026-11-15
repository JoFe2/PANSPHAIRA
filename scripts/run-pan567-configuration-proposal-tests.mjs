import {spawnSync} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
// Ordinary registered PAN567 entry: same trusted Node parent, owned scratch,
// locked compiler and actual owned Chromium/CA/evidence discipline as the
// existing 563/564/565/546 families. No skip mode, no focused-only fake.
const files=['tests/pan567/proposal-contract.test.mjs','tests/pan567/owner-dialogue.test.mjs','tests/pan567/confirmation-semantics.test.mjs','tests/pan567/browser-proposal.test.mjs','tests/pan567/registration.test.mjs'];
function nodeOptionTokens(raw){
 const tokens=[];let quoted=false,start=true;
 for(let i=0;i<raw.length;i++){
  let c=raw[i];
  if(c==='\\'&&quoted){if(++i===raw.length)throw new Error('PAN567_TEST_ARGUMENT_DENIED');c=raw[i];}
  else if(c===' '&&!quoted){start=true;continue;}
  else if(c==='"'){quoted=!quoted;continue;}
  if(start){tokens.push(c);start=false;}else tokens[tokens.length-1]+=c;
 }
 if(quoted)throw new Error('PAN567_TEST_ARGUMENT_DENIED');return tokens;
}
try{
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--list')process.stdout.write(JSON.stringify(files)+'\n');
 else{
  const nodeOptions=nodeOptionTokens(process.env.NODE_OPTIONS??'');
  for(let i=0;i<nodeOptions.length;i++){
   const token=nodeOptions[i],equal=token.indexOf('='),name=(equal<0?token:token.slice(0,equal)).replaceAll('_','-');
   if(['--trace-warnings','--no-trace-warnings','--warnings','--no-warnings'].includes(name)){
    if(equal>=0)throw new Error('PAN567_TEST_ARGUMENT_DENIED');continue;
   }
   if(!['--conditions','-C','--max-old-space-size','--max-semi-space-size'].includes(name))throw new Error('PAN567_TEST_ARGUMENT_DENIED');
   const value=equal<0?nodeOptions[++i]:token.slice(equal+1);
   if(typeof value!=='string'||!value.length||(!['--conditions','-C'].includes(name)&&!/^[1-9][0-9]*$/.test(value)))throw new Error('PAN567_TEST_ARGUMENT_DENIED');
  }
  if(args.length||process.env.NODE_TEST_CONTEXT!==undefined)throw new Error('PAN567_TEST_ARGUMENT_DENIED');
  if(process.platform!=='linux'||process.arch!=='x64')throw new Error('PAN567_TEST_REQUIRES_SUPPORTED_LINUX_X86_64');
  const env={...process.env,TMPDIR:process.env.TMPDIR||process.env.RUNNER_TEMP};
  if(!env.TMPDIR)throw new Error('PAN567_OWNED_SCRATCH_REQUIRED');
  env.PAN527_BROWSER_MODULE=env.PAN527_BROWSER_MODULE||import.meta.resolve('playwright');env.PAN527_CERTUTIL=env.PAN527_CERTUTIL||'certutil';
  if(!env.PAN546_BROWSER_EVIDENCE){env.PAN546_BROWSER_EVIDENCE=mkdtempSync(join(env.TMPDIR,'pan567-browser-evidence-'));process.stdout.write('PAN567_BROWSER_EVIDENCE_DIR='+env.PAN546_BROWSER_EVIDENCE+'\n');}
  for(const argv of [['node_modules/typescript/bin/tsc','-p','tsconfig.json'],['scripts/build-pan541-browser.mjs'],['--test','--test-concurrency=1','--test-reporter=tap',...files]]){
   const run=spawnSync(process.execPath,argv,{env,stdio:'inherit'});if(run.error||run.signal||run.status===null)throw new Error('PAN567_TEST_PROCESS_INTERRUPTED');if(run.status!==0){process.exitCode=run.status;break;}
  }
 }
}catch(e){process.stderr.write((e instanceof Error?e.message:'PAN567_TEST_TOOLING_UNAVAILABLE')+'\n');process.exitCode=1;}
