import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir}from'node:os';import{join}from'node:path';import{fork,execFileSync}from'node:child_process';
import {nativeFixture527}from'../pan527/helpers.mjs';
export async function processBrowserFixture562({proofTtlMs=60000,sessionTtlMs=1800000}={}){
 if(!process.env.PAN527_BROWSER_MODULE||!process.env.PAN527_CERTUTIL||!process.env.PAN562_BROWSER_EVIDENCE)throw Error('ACTUAL_OWNED_BOOTSTRAP_BROWSER_REQUIRED_NO_SKIP');
 const tls=await nativeFixture527();await new Promise(resolve=>tls.gateway.server.close(resolve));
 const root=join(tls.root,'fresh-process-bootstrap');mkdirSync(root,{mode:0o700});
 const sourceRoot=new URL('../../',import.meta.url),identity={...tls.tenants[0].identity,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim(),sourceTree:execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:sourceRoot,encoding:'utf8'}).trim()};
 const identityPath=join(root,'runtime-identity.json');writeFileSync(identityPath,JSON.stringify(identity)+'\n',{mode:0o600,flag:'wx'});
 let child,browser,context;const grants=[],errors=[],requests=[],stdout=[],stderr=[],exits=[];
 async function start(resume=false){
  const args=['--opt-in-existing-owner','--root',root,'--origin',tls.origin,'--identity-file',identityPath,'--tls-key',tls.options.tls.keyPath,'--tls-cert',tls.options.tls.certPath,'--proof-ttl-ms',String(proofTtlMs),'--session-ttl-ms',String(sessionTtlMs),...(resume?['--resume-grant']:[])];
  child=fork(new URL('../../scripts/bootstrap-browser-first-owner-v1.mjs',import.meta.url),args,{execArgv:[],stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,NODE_TEST_CONTEXT:''}});
  child.stdout.on('data',data=>stdout.push(data.toString()));child.stderr.on('data',data=>stderr.push(data.toString()));child.on('exit',(code,signal)=>exits.push({code,signal}));
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('ACTUAL_BOOTSTRAP_PROCESS_READY_TIMEOUT')),10000);child.on('message',message=>{if(message.operation==='PRIVATE_OWNER_GRANT')grants.push(message);if(message.operation==='READY'){clearTimeout(timer);if(message.readback.runtimeObserved.nodeVersion!==process.versions.node)reject(Error('ACTUAL_BOOTSTRAP_RUNTIME_MISMATCH'));else resolve();}});child.once('error',reject);child.once('exit',code=>{if(code!==0){clearTimeout(timer);reject(Error('ACTUAL_BOOTSTRAP_PROCESS_EXIT_BEFORE_READY'));}});});
 }
 async function stop(){if(child?.exitCode===null){const exit=new Promise(resolve=>child.once('exit',resolve));child.send({operation:'STOP'});await Promise.race([exit,new Promise((_,reject)=>setTimeout(()=>reject(Error('ACTUAL_BOOTSTRAP_PROCESS_STOP_TIMEOUT')),5000))]);}}
 try{
  await start();const home=join(root,'isolated-browser-home'),nss=join(home,'.pki/nssdb');mkdirSync(nss,{recursive:true,mode:0o700});
  execFileSync(process.env.PAN527_CERTUTIL,['-N','--empty-password','-d','sql:'+nss],{stdio:'ignore'});execFileSync(process.env.PAN527_CERTUTIL,['-A','-d','sql:'+nss,'-n','PAN562 isolated bootstrap CA','-t','CT,C,C','-i',tls.options.tls.certPath],{stdio:'ignore'});
  const{chromium}=await import(process.env.PAN527_BROWSER_MODULE);browser=await chromium.launch({headless:true,env:{...process.env,HOME:home},args:['--no-proxy-server','--disable-background-networking']});
  async function newContext(viewport={width:1440,height:960}){const c=await browser.newContext({ignoreHTTPSErrors:false,viewport});await c.route('**/*',route=>new URL(route.request().url()).origin===tls.origin?route.continue():route.abort());return c;}
  context=await newContext();const page=await context.newPage();page.setDefaultTimeout(8000);page.setDefaultNavigationTimeout(10000);page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/t/tenant-a/')){let data=null;try{data=request.postDataJSON();}catch{}requests.push({path:url.pathname,query:url.search,method:request.method(),purpose:data?.purpose??null,proofLength:typeof data?.proof==='string'?data.proof.length:null,operation:data?.operation??null});}});
  return{tls,root,identity,identityPath,browser,context,page,grants,errors,requests,stdout,stderr,exits,newContext,async restart(){await stop();await start(true);},async stop(){await stop();},async close(){await context?.close();await browser?.close();await stop();await tls.close();}};
 }catch(error){await context?.close();await browser?.close();try{await stop();}catch{child?.kill();}await tls.close();throw error;}
}
export async function capture562(page,name,metadata={}){
 const path=join(process.env.PAN562_BROWSER_EVIDENCE,name+'.png');
 const dimensions=await page.evaluate(()=>({viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,zoom:getComputedStyle(document.documentElement).zoom,controls:[...document.querySelectorAll('button,input,select,textarea,a')].filter(e=>e.getClientRects().length&&!e.classList.contains('skip-link')).map(e=>{const r=e.getBoundingClientRect();return{label:e.textContent,left:r.left,right:r.right,width:r.width,height:r.height};})}));
 writeFileSync(path+'.dimensions.json',JSON.stringify(dimensions,null,2)+'\n');
 if(dimensions.documentWidth>dimensions.viewport.width||dimensions.controls.some(c=>c.width<=0||c.height<=0||c.left<0||c.right>dimensions.viewport.width))throw Error('BOOTSTRAP_RENDER_CONTROL_CLIPPING');
 await page.screenshot({path,fullPage:false});const result={name,path,dimensions,metadata,syntheticOnly:true,proofInputMaskedOrCleared:true,wholeViewportNotCrop:true,functionalPassNotDesignApproval:true};writeFileSync(path+'.json',JSON.stringify(result,null,2)+'\n');return result;
}
