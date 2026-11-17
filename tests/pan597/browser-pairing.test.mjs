import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {browserFixture549,launch549,forward549} from '../pan549/browser-fixture.mjs';
import {processBrowserFixture569} from '../pan569/isolated-browser-fixture.mjs';
import {openModelFreeConfiguration566} from '../pan566/helpers.mjs';
const panel='.surface-browser-pairing',base='/t/tenant-a/workspace';
async function fixture(){
 const f=await browserFixture549({surfaces:true,cohort:null});let a,b;
 try{
  a=await launch549(f);const secondRoot=join(f.tls.root,'separate-second-browser-profile');mkdirSync(secondRoot,{mode:0o700});
  b=await launch549({...f,tls:{...f.tls,root:secondRoot}});
  assert.notEqual(a.who.cookieHeader,b.who.cookieHeader,'Native owner independently issues each actual authenticated session; no cookie copy');
  const pages=[];
  for(const client of[a,b]){
   await client.context.addInitScript(()=>{globalThis.pan605MediaAttempts=0;globalThis.pan605AudioAttempts=0;globalThis.pan605MainFocusTrace=[];const nativeFocus=HTMLElement.prototype.focus;HTMLElement.prototype.focus=function(...args){if(this.id==='shell.main'&&globalThis.pan605MainFocusTrace.length<32)globalThis.pan605MainFocusTrace.push({from:document.activeElement?.id,at:performance.now(),stack:new Error('NATIVE_MAIN_FOCUS_CALL').stack});return nativeFocus.apply(this,args);};if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{globalThis.pan605MediaAttempts++;throw Error('NO_MICROPHONE_AUTHORITY');};HTMLMediaElement.prototype.play=function(){globalThis.pan605AudioAttempts++;return Promise.reject(Error('NO_AUDIO_AUTHORITY'));};});
   assert.equal(client.context.pages().length,1,'Each fresh persistent profile must have exactly its one native startup tab');const p=client.context.pages()[0];assert.equal(p.url(),'about:blank','Use the owned initial browser tab, not an additional competing startup tab');if(client===b)await p.setViewportSize({width:390,height:844});p.setDefaultTimeout(8000);p.setDefaultNavigationTimeout(10000);await p.goto(f.tls.origin+base);await p.locator('.workspace-surfaces[data-state="SURFACE_READY"]').waitFor();await p.locator(panel+'[data-state="PAIR_READY"]').waitFor();pages.push(p);
  }
  const [source,target]=pages;
  await source.evaluate(()=>localStorage.setItem('pan605.profile-isolation','SOURCE'));await target.evaluate(()=>localStorage.setItem('pan605.profile-isolation','RECEIVER'));
  assert.equal(await source.evaluate(()=>localStorage.getItem('pan605.profile-isolation')),'SOURCE');assert.equal(await target.evaluate(()=>localStorage.getItem('pan605.profile-isolation')),'RECEIVER');
  return {f,a,b,source,target,sourceProfile:join(f.tls.root,'chromium-profile'),targetProfile:join(secondRoot,'chromium-profile'),async close(){await b.context.close();await a.context.close();await f.close();}};
 }catch(error){await b?.context.close();await a?.context.close();await f.close();throw error;}
}
async function offer(x){const button=x.source.getByRole('button',{name:'Kopplungscode für Dokument erzeugen',exact:true});await button.focus();await button.press('Enter');await x.source.locator(panel+'[data-state="PAIR_OFFERED"]').waitFor();const code=await x.source.getByLabel('Einmaliger Code für das andere Browserprofil',{exact:true}).inputValue();assert.match(code,/^[a-f0-9]{20}$/);return code;}
async function claim(x,code){const input=x.target.getByLabel('Code aus dem anderen Browserprofil',{exact:true});await input.fill(code);await input.press('Enter');await x.target.locator(panel+'[data-state="PAIR_CLAIMED"]').waitFor();await x.source.locator(panel+'[data-state="PAIR_CLAIMED"]').waitFor();}
async function confirm(x){const button=x.source.getByRole('button',{name:'Empfänger und Referenz bestätigen',exact:true});await button.focus();await button.press('Enter');await x.source.locator(panel+'[data-state="PAIR_PAIRED"]').waitFor();await x.target.locator(panel+'[data-state="PAIR_PAIRED"]').waitFor();assert.equal(await x.source.locator(panel).getAttribute('data-pair-id'),await x.target.locator(panel).getAttribute('data-pair-id'));}
async function capture(page,name,extra={}){
 const root=process.env.PAN549_BROWSER_EVIDENCE;assert.ok(root);mkdirSync(root,{recursive:true,mode:0o700});await page.locator(panel).scrollIntoViewIfNeeded();const file=join(root,name+'.png');if(extra.nativeBrowserZoom===2){await page.getByLabel('Code aus dem anderen Browserprofil',{exact:true}).evaluate(e=>e.scrollIntoView({block:'center'}));const cdp=await page.context().newCDPSession(page);try{const raster=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});writeFileSync(file,Buffer.from(raster.data,'base64'));}finally{await cdp.detach();}}else await page.screenshot({path:file,fullPage:true});
 const geometry=await page.locator(panel).evaluate(e=>({viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,cssZoom:document.documentElement.style.zoom||'1',state:e.getAttribute('data-state'),focused:document.activeElement?.id,controls:[...e.querySelectorAll('button,input')].map(n=>{const r=n.getBoundingClientRect();return {label:n.getAttribute('aria-label')??n.textContent,x:r.x,right:r.right,width:r.width,height:r.height};})}));
 assert.ok(geometry.documentWidth<=geometry.viewport.width,'No global responsive overflow');assert.ok(geometry.controls.every(c=>c.x>=0&&c.right<=geometry.viewport.width&&c.width>0&&c.height>=44),'Current pairing controls stay visible and target-sized');
 const pins=Object.fromEntries(['packages/browser-workspace/src/workspace-browser-pairing-v1.ts','packages/browser-workspace/src/workspace-surfaces-v2.css','dist/browser-workspace/workspace-surfaces.js'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
 writeFileSync(file+'.json',JSON.stringify({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),actualBase:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),pins,...geometry,...extra,visualSighted:false,projectionDeliveryGranted:false,physicalDeviceQualified:false,model:'NOT_RUN'},null,2)+'\n');return geometry;
}
test('605 actual two distinct persistent Chromium profiles independently authenticate, manually pair bilaterally, preserve mobile input/focus and revoke; no data delivery/audio/device claim',async()=>{
 const x=await fixture();try{
  assert.notEqual(x.sourceProfile,x.targetProfile);assert.notEqual(x.a.browser,x.b.browser);
  await claim(x,await offer(x));assert.equal(await x.source.getByLabel('Einmaliger Code für das andere Browserprofil',{exact:true}).inputValue(),'');await confirm(x);
  const sourceSession=await x.source.evaluate(async()=>{const r=await fetch(location.pathname+'/context');return (await r.json()).sessionId;}),targetSession=await x.target.evaluate(async()=>{const r=await fetch(location.pathname+'/context');return (await r.json()).sessionId;});assert.notEqual(sourceSession,targetSession);
  await capture(x.source,'1280-605-distinct-profiles-paired',{browser:x.a.browser.version(),claim:'DISTINCT_PERSISTENT_CHROMIUM_PROFILES_ONLY_NOT_OTHER_ENGINE_OR_PHYSICAL_DEVICE',independentNativeSessions:true});
  assert.deepEqual(x.target.viewportSize(),{width:390,height:844});const input=x.target.getByLabel('Code aus dem anderen Browserprofil',{exact:true});await input.evaluate(input=>{globalThis.pan605FocusTrace=[];const record=(event,detail={})=>{if(globalThis.pan605FocusTrace.length<64)globalThis.pan605FocusTrace.push({event,at:performance.now(),focused:document.activeElement?.id,disabled:input.disabled,readOnly:input.readOnly,connected:input.isConnected,surface:document.querySelector('.workspace-surfaces')?.getAttribute('data-state'),pair:input.closest('.surface-browser-pairing')?.getAttribute('data-state'),...detail});};for(const name of['focus','blur','focusin','focusout'])input.addEventListener(name,e=>record(name,{related:e.relatedTarget?.id??null,stack:new Error('FOCUS_EVENT_CALLER').stack}));new MutationObserver(rows=>{for(const r of rows)record('attribute',{name:r.attributeName});}).observe(input,{attributes:true});});await x.target.bringToFront();assert.equal(await input.inputValue(),'');await input.click();await x.target.keyboard.type('own-draft');const focusBefore=await input.evaluate(e=>({focused:document.activeElement?.id,expected:e.id,disabled:e.disabled,readOnly:e.readOnly,hasFocus:document.hasFocus()}));await x.target.evaluate(()=>{const root=document.querySelector('.surface-browser-pairing');globalThis.pan605NativeListDomCommit=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{observer.disconnect();reject(Error('NATIVE_PAIR_LIST_DOM_COMMIT_NOT_OBSERVED'));},5000),observer=new MutationObserver(rows=>{if(rows.some(r=>r.attributeName==='data-state')&&root.getAttribute('data-state')==='PAIR_PAIRED'){observer.disconnect();clearTimeout(timer);resolve(true);}});observer.observe(root,{attributes:true,attributeFilter:['data-state']});});});const response=x.target.waitForResponse(r=>r.url().endsWith('/surfaces/browser-pair-v1')&&r.request().postDataJSON()?.operation==='list'&&r.status()===200);await response;await x.target.evaluate(()=>globalThis.pan605NativeListDomCommit);assert.equal(await input.inputValue(),'own-draft');const focusAfter=await input.evaluate(e=>({focused:document.activeElement?.id,expected:e.id,disabled:e.disabled,readOnly:e.readOnly,hasFocus:document.hasFocus(),trace:globalThis.pan605FocusTrace,mainFocusCalls:globalThis.pan605MainFocusTrace}));console.log('605_BOUNDED_FOCUS_TRACE '+JSON.stringify({before:focusBefore,after:focusAfter}));assert.equal(await input.evaluate(e=>document.activeElement===e),true,'Native background readback must not replace input or focus');await input.press('Tab');assert.equal(await x.target.getByRole('button',{name:'Code prüfen und als Empfänger bestätigen',exact:true}).evaluate(e=>document.activeElement===e),true);await input.focus();
  await capture(x.target,'390-605-paired-keyboard-focus',{browser:x.b.browser.version(),nativeZoom:1,physicalMobileDevice:false});
  assert.equal(await x.target.locator('.surface-document').count(),0,'Pair alone must not render an unauthorized projection in a full session');
  const revoke=x.target.getByRole('button',{name:'Browserkopplung widerrufen',exact:true});await revoke.focus();await revoke.press('Enter');await x.target.locator(panel+'[data-state="PAIR_REVOKED"]').waitFor();await x.source.locator(panel+'[data-state="PAIR_REVOKED"]').waitFor();await capture(x.target,'390-605-revoked');
  for(const page of[x.source,x.target])assert.deepEqual(await page.evaluate(()=>({mic:globalThis.pan605MediaAttempts,audio:globalThis.pan605AudioAttempts})),{mic:0,audio:0});x.f.unchanged();
 }finally{await x.close();}
});
test('605 real wrong-code UI and delayed original native read cannot resurrect a locally revoked pairing; reload restores no code',async()=>{
 const x=await fixture();let release;try{
  const code=await offer(x);assert.deepEqual(x.target.viewportSize(),{width:390,height:844});await x.target.getByLabel('Code aus dem anderen Browserprofil',{exact:true}).fill('0'.repeat(20));await x.target.getByRole('button',{name:'Code prüfen und als Empfänger bestätigen',exact:true}).click();await x.target.locator(panel+'[data-state="PAIR_UNKNOWN"]').waitFor();await capture(x.target,'390-605-wrong-code-error');
  await claim(x,code);await confirm(x);
  let seen,settled;const observed=new Promise(r=>seen=r),gate=new Promise(r=>release=r),routeSettled=new Promise(r=>settled=r);let hold=true;
  await x.target.route('**/surfaces/browser-pair-v1',async route=>{if(hold&&route.request().postDataJSON()?.operation==='list'){const actual=await forward549(x.f,route);assert.equal(actual.tlsAuthorized,true);assert.equal(actual.status,200);const body=JSON.parse(actual.body);if(body.pairs?.some(p=>p.state==='PAIRED')){hold=false;seen();await gate;try{await route.fulfill({status:actual.status,headers:actual.headers,body:actual.body});settled({fulfilled:true});}catch(error){settled({fulfilled:false,error:error.message});}return;}}await route.continue();});
  await Promise.race([observed,new Promise((_,reject)=>setTimeout(()=>reject(Error('605_REAL_NATIVE_LIST_NOT_OBSERVED')),5000))]);
  await x.target.getByRole('button',{name:'Browserkopplung widerrufen',exact:true}).click();await x.target.locator(panel+'[data-state="PAIR_REVOKED"]').waitFor();release();const routeResult=await routeSettled;console.log('605_REAL_STALE_ROUTE_SETTLED '+JSON.stringify(routeResult));assert.equal(routeResult.fulfilled,true,'Observer must settle the actual original response before unregister/teardown');await x.target.unroute('**/surfaces/browser-pair-v1');await x.source.locator(panel+'[data-state="PAIR_REVOKED"]').waitFor();assert.equal(await x.target.locator(panel).getAttribute('data-state'),'PAIR_REVOKED');
  await x.target.reload();await x.target.locator('.workspace-surfaces[data-state="SURFACE_READY"]').waitFor();await x.target.locator(panel+'[data-state="PAIR_REVOKED"]').waitFor();assert.equal(await x.target.getByLabel('Code aus dem anderen Browserprofil',{exact:true}).inputValue(),'');assert.equal(await x.target.getByLabel('Einmaliger Code für das andere Browserprofil',{exact:true}).inputValue(),'');x.f.unchanged();
 }finally{release?.();await x.close();}
});
test('605 new pairing controls in actual existing bootstrap shell at native browser200/CSS1 remain keyboard-usable; unchanged test-only563 zoom fixture is not a product extension',async()=>{
 const f=await processBrowserFixture569({nativeZoom:true});try{const page=await openModelFreeConfiguration566(f);await page.locator('.workspace-surfaces[data-state="SURFACE_READY"]').waitFor();await page.locator(panel+'[data-state="PAIR_READY"]').waitFor();assert.equal(await f.nativeBrowserZoom(2),2);const input=page.getByLabel('Code aus dem anderen Browserprofil',{exact:true});await input.fill('0'.repeat(20));await input.press('Enter');await page.locator(panel+'[data-state="PAIR_UNKNOWN"]').waitFor();await input.focus();assert.equal(await input.evaluate(e=>document.activeElement===e),true);const g=await capture(page,'390-605-native200-code-error',{nativeBrowserZoom:2,testOnlyZoomFixture:'UNCHANGED_EXISTING563',physicalMobileDevice:false});assert.equal(g.cssZoom,'1');assert.equal(await f.nativeBrowserZoom(1),1);}finally{await f.close();}
});

// JO259457_RESTRICTED_NATIVE_DISPLAY_BEGIN
// Test-local, read-only observations: no native calls, focus/scroll writes or retries.
// Console rows are allowlisted and capped independently of retained CI artifacts.
function displayDocumentObservation606({mode='sample',role='receiver'}={}){
 const key='__pan606Observation',prefix='606_FRAME_OBSERVATION_BROWSER ';
 if(mode==='cleanup'){globalThis[key]?.();return;}
 if(globalThis[key])return globalThis[key].snapshot();
 const initialRoot=document.querySelector('.surface-browser-pairing');let firstFrame=document.querySelector('.native-display-frame');
 const state=n=>n?.getAttribute('data-state')??null,tag=n=>n?.tagName??null;
 const snapshot=()=>{const main=document.querySelector('main'),last=document.querySelector('[data-field="status"]'),r=last?.getBoundingClientRect(),frame=document.querySelector('.native-display-frame');if(!firstFrame&&frame)firstFrame=frame;return{role,sameRoot:initialRoot===document.querySelector('.surface-browser-pairing'),sameFrame:!!firstFrame&&firstFrame===frame,docFocus:document.hasFocus(),activeTag:tag(document.activeElement),mainFocus:!!main&&document.activeElement===main,bodyState:state(document.body),closedBy:document.body?.dataset.closedBy??null,pairState:state(document.querySelector('.surface-browser-pairing')),displayState:state(document.querySelector('.surface-native-presentation')),surfaceState:state(document.querySelector('.workspace-surfaces')),rootConnected:!!document.querySelector('.surface-browser-pairing')?.isConnected,frameConnected:!!frame?.isConnected,frameBlank:frame?.getAttribute('src')==='about:blank',alert:!!document.querySelector('.surface-native-presentation [role="alert"]'),width:innerWidth,height:innerHeight,scrollY,scrollTop:main?.scrollTop??null,scrollHeight:main?.scrollHeight??null,clientHeight:main?.clientHeight??null,lastRect:r?{top:r.top,bottom:r.bottom,left:r.left,right:r.right}:null};};
 if(mode==='install'&&!globalThis[key]){
  let count=0,previous='',keys=0;
  const send=(event,extra={})=>{if(count++<32)console.log(prefix+JSON.stringify({event,...snapshot(),...extra}));};
  const changed=()=>{const s=snapshot(),signature=JSON.stringify([s.bodyState,s.closedBy,s.pairState,s.displayState,s.surfaceState,s.sameRoot,s.sameFrame,s.rootConnected,s.frameConnected,s.frameBlank,s.alert]);if(signature!==previous){previous=signature;send('dom-state');}};
  const observer=new MutationObserver(changed);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-state','data-closed-by','src']});
  const keydown=e=>{if(e.key==='End'&&keys++<8)send('key-received',{ctrl:e.ctrlKey,trusted:e.isTrusted});};
  const focus=()=>{if(keys<8)send('focus-change');};
  const pagehide=()=>send('pagehide');
  document.addEventListener('keydown',keydown,true);document.addEventListener('focusin',focus,true);document.addEventListener('focusout',focus,true);addEventListener('pagehide',pagehide);
  globalThis[key]=()=>{observer.disconnect();document.removeEventListener('keydown',keydown,true);document.removeEventListener('focusin',focus,true);document.removeEventListener('focusout',focus,true);removeEventListener('pagehide',pagehide);delete globalThis[key];};globalThis[key].snapshot=snapshot;changed();
 }
 return snapshot();
}
function observeDisplay606(x){
 const prefix='606_FRAME_OBSERVATION ',browserPrefix='606_FRAME_OBSERVATION_BROWSER ',started=Date.now();
 const strings=new Set(['receiver','source','child','MAIN','BODY','IFRAME','BUTTON','INPUT','HTML','SECTION','P','DIV','OFFERED','ACTIVE','REVOKED','EXPIRED','UNAVAILABLE','RENDERED','NONE','DISPLAY_NONE','DISPLAY_OFFERED','DISPLAY_ACTIVE','DISPLAY_REVOKED','DISPLAY_EXPIRED','DISPLAY_UNAVAILABLE','DISPLAY_RENDERED','DISPLAY_CLOSED','PAIR_READY','PAIR_OFFERED','PAIR_CLAIMED','PAIR_PAIRED','PAIR_REVOKED','PAIR_EXPIRED','PAIR_UNAVAILABLE','PAIR_UNKNOWN','SURFACE_READY','SURFACE_CURRENT_DOCUMENT_SELECTED','GRANT_DEADLINE','OFFLINE','NATIVE_OR_NETWORK','pagehide','offer','confirm','read','revoke','list','dom-state','key-received','focus-change','frameattached','framenavigated','framedetached','native-response','native-body-unreadable','native-request-failed','sample','sample-unavailable','start','before-focus','after-focus','after-key','before-geometry-wait','after-geometry-wait','after-negatives','offered','rendered','before-screenshots','failure-before-cleanup','complete-before-cleanup','cleanup','detached','timeout','other','OTHER']);
 const fields=new Set(['event','role','step','docFocus','activeTag','mainFocus','bodyState','closedBy','pairState','displayState','surfaceState','sameRoot','sameFrame','rootConnected','frameConnected','frameBlank','alert','width','height','scrollY','scrollTop','scrollHeight','clientHeight','lastRect','top','bottom','left','right','ctrl','trusted','operation','httpStatus','state','renderState','expiresAtMs','remainingMs','sameOffer','frameNumber','mainFrame','detached','blank','failure','dropped']);
 const clean=(v,depth=0)=>{if(v===null||typeof v==='boolean')return v;if(typeof v==='number')return Number.isFinite(v)?v:null;if(typeof v==='string')return strings.has(v)?v:'OTHER';if(depth<2&&v&&typeof v==='object'&&!Array.isArray(v))return Object.fromEntries(Object.entries(v).filter(([k])=>fields.has(k)).map(([k,v])=>[k,clean(v,depth+1)]));return null;};
 let rows=0,bytes=0,dropped=0,expiry=null,offerId=null,closed=false,cleanup=false,inflight=0;const listeners=[],frames=new Map(),nativeStates=new Map();
 const emit=(event,data={},essential=false)=>{try{if(closed)return;const now=Date.now(),row={event:strings.has(event)?event:'OTHER',elapsedMs:now-started,phase:cleanup?'cleanup':'test',...clean(data),offerExpiresAtMs:expiry,offerRemainingMs:expiry===null?null:expiry-now};const line=prefix+JSON.stringify(row);if(rows>=(essential?96:80)||bytes+Buffer.byteLength(line)>(essential?49152:32768)){dropped++;return;}rows++;bytes+=Buffer.byteLength(line);console.log(line);}catch{/* Diagnostics must never replace the test error. */}};
 const sample=async(step,child=false)=>{try{const targets=child?x.target.frames().filter(f=>f!==x.target.mainFrame()&&!f.isDetached()):[x.target];for(const f of targets)emit('sample',{step,...await f.evaluate(displayDocumentObservation606,{mode:'install',role:child?'child':'receiver'})},true);}catch{emit('sample-unavailable',{step},true);}};
 // CI709 grant-latency repair: one batched pass observes receiver and child for
 // the same step concurrently instead of two sequential evaluate round-trips.
 // Both observations and the surrounding sequence are unchanged.
 const sampleBoth=async(step)=>{await Promise.all([sample(step),sample(step,true)]);};
 const on=(page,event,fn)=>{page.on(event,fn);listeners.push(()=>page.removeListener(event,fn));};
 const operation=r=>{try{const path=new URL(r.url()).pathname;if(!path.endsWith('/workspace/surfaces/display-session-v1')&&!path.endsWith('/workspace/surfaces/browser-pair-v1'))return null;const op=r.postDataJSON()?.operation;return ['offer','confirm','read','revoke','list'].includes(op)?op:null;}catch{return null;}};
 for(const[role,page]of[['source',x.source],['receiver',x.target]]){
  on(page,'response',r=>{const op=operation(r.request());if(!op||inflight>=4||rows>=80||closed)return;inflight++;void(async()=>{try{const body=await r.json(),s=op==='read'?body.session:body,identity=role+':'+op,signature=JSON.stringify([r.status(),s?.state,s?.renderState,s?.expiresAtMs,s?.sessionId===offerId]);if(nativeStates.get(identity)===signature)return;nativeStates.set(identity,signature);emit('native-response',{role,operation:op,httpStatus:r.status(),state:s?.state??null,renderState:s?.renderState??null,expiresAtMs:Number.isSafeInteger(s?.expiresAtMs)?s.expiresAtMs:null,remainingMs:Number.isSafeInteger(s?.expiresAtMs)?s.expiresAtMs-Date.now():null,sameOffer:offerId===null?null:s?.sessionId===offerId});}catch{emit('native-body-unreadable',{role,operation:op,httpStatus:r.status()});}finally{inflight--;}})();});
  on(page,'requestfailed',r=>{const op=operation(r);if(op)emit('native-request-failed',{role,operation:op});});
 }
 on(x.target,'console',message=>{try{const text=message.text();if(text.startsWith(browserPrefix)&&text.length<=4096){const row=JSON.parse(text.slice(browserPrefix.length));emit(row.event,row);}}catch{}});
 for(const event of['frameattached','framenavigated','framedetached'])on(x.target,event,f=>{if(!frames.has(f)&&frames.size<8)frames.set(f,frames.size+1);emit(event,{frameNumber:frames.get(f)??null,mainFrame:f===x.target.mainFrame(),detached:f.isDetached(),blank:f.url()==='about:blank'},true);if(event==='framedetached')void sample('detached');});
 return{sample,sampleBoth,offered(row){expiry=Number.isSafeInteger(row.expiresAtMs)?row.expiresAtMs:null;offerId=row.sessionId;emit('sample',{step:'offered'},true);},async finish(failed){try{await sample(failed?'failure-before-cleanup':'complete-before-cleanup');await sample(failed?'failure-before-cleanup':'complete-before-cleanup',true);}catch{}cleanup=true;emit('sample',{step:'cleanup',dropped},true);for(const remove of listeners)try{remove();}catch{}closed=true;for(const f of x.target.frames())try{await f.evaluate(displayDocumentObservation606,{mode:'cleanup'});}catch{}frames.clear();}};
}

async function restrictedHttp606(f,origin,path,{method='GET',headers={},body}={}){const {request}=await import('node:https');const bytes=body===undefined?null:Buffer.from(JSON.stringify(body));return await new Promise((resolve,reject)=>{const r=request(origin+path,{method,lookup:(_host,_options,done)=>done(null,'127.0.0.1',4),ca:readFileSync(f.tls.options.tls.certPath),rejectUnauthorized:true,minVersion:'TLSv1.3',headers:{...headers,...(bytes?{'content-type':'application/json','content-length':bytes.length}:{})}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});r.setTimeout(5000,()=>r.destroy(Error('NATIVE_HTTP_BOUND')));r.on('error',reject);if(bytes)r.write(bytes);r.end();});}
async function keyboardReachability606(x,frame,offered,observation){
 assert.ok(Date.now()<offered.expiresAtMs,'Keyboard must start inside the actual offered grant');
 await observation.sampleBoth('before-focus');await frame.getByRole('main',{name:'Freigegebene native Dokumentfelder',exact:true}).click();await observation.sampleBoth('after-focus');await x.target.keyboard.press('Control+End');await observation.sampleBoth('after-key');const keyboardFrame=x.target.frames().find(f=>f.url().startsWith(offered.displayOrigin+'/display/'));assert.ok(keyboardFrame);await observation.sampleBoth('before-geometry-wait');await keyboardFrame.waitForFunction(()=>{const n=document.querySelector('[data-field="status"]');if(!n)return false;const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;});await observation.sampleBoth('after-geometry-wait');const lastFieldGeometry=await frame.locator('[data-field="status"]').evaluate(n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:innerWidth,height:innerHeight,scrollY};});assert.ok(lastFieldGeometry.top>=0&&lastFieldGeometry.bottom<=lastFieldGeometry.height&&lastFieldGeometry.left>=0&&lastFieldGeometry.right<=lastFieldGeometry.width,'All projected fields remain reachable by actual keyboard scrolling inside the390px restricted frame');
 assert.ok(Date.now()<offered.expiresAtMs,'Actual keyboard geometry must complete inside the offered grant');
 return lastFieldGeometry;
}
// Each independent case owns two real profiles, the exact source reference and
// its own native grants. Only the freshness/stale-order cases share sequential
// grants: those comparisons are causal, never inherited image or focus evidence.
const displayPath606='**/workspace/surfaces/display-session-v1',displayPanel606='.surface-native-presentation';
const fields606=['invoiceId','revision','currency','invoiceAmountMinor','status'];
function liveDisplay606(offered,step){assert.ok(Date.now()<offered.expiresAtMs,step+' must complete inside its own actual grant');}
function displayResponse606(page,operation){return page.waitForResponse(r=>r.url().endsWith('/workspace/surfaces/display-session-v1')&&r.request().postDataJSON()?.operation===operation);}
async function displayCase606(run){
 const x=await fixture(),observation=observeDisplay606(x);let failed=true;
 try{
  await observation.sample('start');
  await x.source.locator('[id="shell.navigation"] button[data-workspace-module="/workspace/erv"]').click();
  await x.source.locator('[id="shell.context-selection"][data-state="CURRENT_CONTEXT"][data-module="pan.erv"]').waitFor({state:'attached'});
  const docs=await x.source.locator('[id="surface.route"] option').evaluateAll(ns=>ns.map(n=>JSON.parse(n.value)).filter(r=>r.kind==='DOCUMENT')),wanted=docs.find(r=>r.objectId==='AP-PAN516-PARTIAL-01');
  assert.ok(wanted);assert.notEqual(docs[0].objectId,wanted.objectId);
  const actualSession=await x.source.evaluate(async()=>{const r=await fetch(location.pathname+'/context',{credentials:'same-origin',cache:'no-store'});if(r.status!==200)throw Error('NATIVE_SOURCE_SESSION_REQUIRED');return(await r.json()).sessionId;});
  const {buildBrowserDeepLinkV1}=await import('../../dist/packages/browser-shell/src/deep-link-v1.js');
  await x.source.goto(x.f.tls.origin+base+buildBrowserDeepLinkV1({path:'/workspace/erv',tenantId:'tenant-a',sessionId:actualSession,objectId:wanted.objectId,revision:wanted.dataRevision}));
  await x.source.waitForFunction(id=>document.querySelector('[id="shell.context-selection"][data-state="CURRENT_CONTEXT"]')?.textContent.includes('Vorgang '+id+','),wanted.objectId);
  const choose=x.source.getByRole('button',{name:'Aktuellen ERV-Vorgang wählen',exact:true});await choose.focus();await choose.press('Enter');
  await x.source.locator('.workspace-surfaces[data-state="SURFACE_CURRENT_DOCUMENT_SELECTED"]').waitFor();
  assert.equal(JSON.parse(await x.source.locator('[id="surface.route"]').inputValue()).objectId,wanted.objectId);
  await claim(x,await offer(x));const pairResponse=x.source.waitForResponse(r=>r.url().endsWith('/workspace/surfaces/browser-pair-v1')&&r.request().postDataJSON()?.operation==='confirm');await confirm(x);
  const paired=await(await pairResponse).json();assert.equal(paired.projectionDeliveryGranted,false);assert.equal(paired.scope.fieldProjectionGrant,null);assert.equal(await x.target.locator('.native-display-frame').count(),0);
  // Read this fixture's native source, not fields retained from another document.
  const {createNativeErvReadAdapterV1}=await import('../../src/pan541/native-erv-read-adapter.mjs');
  const native=createNativeErvReadAdapterV1({tenantId:'tenant-a',root:x.f.native.root}).read({tenantId:'tenant-a',objectId:wanted.objectId,expectedRevision:wanted.dataRevision});
  const expected=Object.fromEntries(fields606.map(field=>[field,String(native[field])]));
  assert.equal(expected.invoiceId,wanted.objectId);assert.equal(expected.revision,String(wanted.dataRevision));
  const receipts=await run({x,observation,wanted,paired,expected});
  for(const page of[x.source,x.target])assert.equal(await page.evaluate(()=>globalThis.pan605MediaAttempts+globalThis.pan605AudioAttempts),0);
  x.f.unchanged();
  // Case-scoped receipts cannot qualify images or security checks of other cases.
  for(const receipt of receipts??[]){const {name,...body}=receipt;writeFileSync(join(process.env.PAN549_BROWSER_EVIDENCE,name+'.json'),JSON.stringify({baseMain:process.env.PAN_CURRENT_MAIN,objectId:wanted.objectId,revision:wanted.dataRevision,fields:expected,fieldClass:'ERV_INVOICE_REFERENCE_MINIMAL',principalClass:'RESTRICTED_DISPLAY_ONLY',independentNativeSourceMatched:true,sourceAndReceiverExplicitlyConfirmed:true,receiverNativeRenderAndBackendAck:true,pairingStillNoDisplayGrant:true,noAudioMicrophoneModelOrPhysicalClaim:true,fixtureUnchanged:true,visualSighted:false,physicalDeviceQualified:false,...body},null,2)+'\n');}
  failed=false;
 }finally{await observation.finish(failed).catch(()=>{});await x.close();}
}
async function offerDisplay606(c){
 const {x,observation,wanted,paired}=c;
 await x.source.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Begrenzte native Dokumentpräsentation freigeben'&&!b.disabled));
 assert.equal(await x.target.getByRole('button',{name:'Begrenzte Dokumentanzeige als Empfänger bestätigen',exact:true}).isDisabled(),true);
 const response=displayResponse606(x.source,'offer'),button=x.source.getByRole('button',{name:'Begrenzte native Dokumentpräsentation freigeben',exact:true});await button.focus();await button.press('Enter');
 const offerWire=await response;assert.equal(offerWire.status(),200);const offered=await offerWire.json();observation.offered(offered);
 assert.equal(offered.state,'OFFERED');assert.equal(offered.fieldProjectionGranted,false);assert.equal(offered.pairId,paired.pairId);
 assert.notEqual(offered.displayOrigin,x.f.tls.origin);assert.equal(new URL(offered.displayOrigin).hostname,new URL(x.f.tls.origin).hostname);
 assert.equal(offered.grant.objectId,wanted.objectId);assert.equal(offered.grant.dataRevision,wanted.dataRevision);assert.deepEqual(offered.grant.fields,fields606);
 assert.equal(offered.grant.dataClass,'ERV_INVOICE_REFERENCE_MINIMAL');assert.equal(offered.grant.pairScopeDigest,paired.scopeDigest);
 assert.equal(offered.grant.sourceSurfaceId,paired.sourceSurfaceId);assert.equal(offered.grant.targetSurfaceId,paired.targetSurfaceId);
 assert.equal(await x.target.locator('.native-display-frame').count(),0);
 await x.source.waitForFunction(()=>document.activeElement===document.querySelector('.surface-native-presentation [role="status"]'));
 await x.b.context.route(offered.displayOrigin+'/**',route=>route.continue());liveDisplay606(offered,'Explicit source offer');
 return {offered,offerWire};
}
function displaySnapshot606(){return {state:document.body.dataset.state,principal:document.body.dataset.principalClass,origin:location.origin,hash:location.hash,controls:document.querySelectorAll('button,input,form,audio,video').length,fields:Object.fromEntries([...document.querySelectorAll('[data-field]')].map(n=>[n.dataset.field,n.textContent]))};}
async function confirmDisplay606(c,grant){
 const {x,expected}=c,{offered}=grant;
 await x.target.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Begrenzte Dokumentanzeige als Empfänger bestätigen'&&!b.disabled));
 const response=displayResponse606(x.target,'confirm'),stream=x.target.waitForRequest(r=>r.url()===offered.displayOrigin+'/display/events'),redeem=x.target.waitForResponse(r=>r.url()===offered.displayOrigin+'/display/redeem');
 const button=x.target.getByRole('button',{name:'Begrenzte Dokumentanzeige als Empfänger bestätigen',exact:true});await button.focus();await button.press('Enter');
 const wire=await response;assert.equal(wire.status(),200);const confirmed=await wire.json();
 assert.equal(confirmed.state,'ACTIVE');assert.equal(confirmed.sessionId,offered.sessionId);assert.equal(confirmed.grantDigest,offered.grantDigest);assert.equal(confirmed.expiresAtMs,offered.expiresAtMs);assert.equal(confirmed.fieldProjectionGranted,true);
 const redeemWire=await redeem;assert.equal(redeemWire.status(),200);const redeemed=await redeemWire.json(),headers=await(await stream).allHeaders();
 assert.equal(redeemWire.request().postDataJSON().ticket,confirmed.restrictedLaunch.ticket);assert.equal(redeemed.sessionId,offered.sessionId);assert.equal(redeemed.expiresAtMs,offered.expiresAtMs);assert.equal(redeemed.principalClass,'RESTRICTED_DISPLAY_ONLY');
 assert.match(headers.authorization,/^PAN-DISPLAY [a-f0-9]{64}$/);assert.equal(headers.authorization,'PAN-DISPLAY '+redeemed.displayCapability);assert.equal(headers.cookie,undefined,'Restricted data fetch uses only its own principal, never copied workspace cookies');
 const frame=x.target.frameLocator('iframe[title="Eingeschränkte native Dokumentpräsentation"]');await frame.locator('body[data-state="DISPLAY_RENDERED"]').waitFor();
 const documentFrame=x.target.frames().find(f=>f.url()===offered.displayOrigin+'/display/');assert.ok(documentFrame);
 assert.deepEqual(await documentFrame.evaluate(displaySnapshot606),{state:'DISPLAY_RENDERED',principal:'RESTRICTED_DISPLAY_ONLY',origin:offered.displayOrigin,hash:'',controls:0,fields:expected});
 await x.source.waitForFunction(id=>{const d=document.querySelector('.surface-native-presentation');return d?.dataset.sessionId===id&&d.textContent.includes('Zielanzeige RENDERED');},offered.sessionId);
 liveDisplay606(offered,'Independent principal, native fields and receiver/backend render acknowledgement');
 return {...grant,confirmed,headers,frame,documentFrame};
}
async function activeDisplay606(c,g){
 liveDisplay606(g.offered,'Live authority witness start');
 const row=await forward549(c.x.f,{request:()=>g.offerWire.request()},s=>{for(const key of Object.keys(s))if(!['schemaVersion','operation','pairId'].includes(key))delete s[key];s.operation='read';});
 liveDisplay606(g.offered,'Live authority witness response');assert.equal(row.status,200);const {session}=JSON.parse(row.body);
 assert.equal(session.state,'ACTIVE');assert.equal(session.sessionId,g.offered.sessionId);assert.equal(session.grantDigest,g.offered.grantDigest);assert.equal(session.renderState,'RENDERED');
}
async function revokeDisplay606(c,g,page=c.x.source){
 liveDisplay606(g.offered,'Explicit revoke start');const response=displayResponse606(page,'revoke'),button=page.getByRole('button',{name:'Dokumentpräsentation widerrufen',exact:true});
 await button.focus();await button.press('Enter');const wire=await response,body=await wire.json(),revokedAtMs=Date.now();
 liveDisplay606(g.offered,'Native revoke response after await');assert.equal(wire.status(),200);assert.equal(body.state,'REVOKED');assert.equal(body.sessionId,g.offered.sessionId);
 console.log('606_REVOKE_PHASE '+JSON.stringify({sessionId:body.sessionId,step:'response',remainingMs:g.offered.expiresAtMs-revokedAtMs}));
 return {sessionId:body.sessionId,grantDigest:g.offered.grantDigest,grantExpiresAtMs:g.offered.expiresAtMs,revokedAtMs};
}
async function closedDisplay606(c,g){
 await c.x.target.locator('.native-display-frame').waitFor({state:'detached'});
 assert.equal((await restrictedHttp606(c.x.f,g.offered.displayOrigin,'/display/events',{headers:{origin:g.offered.displayOrigin,authorization:g.headers.authorization}})).status,403);
 assert.equal(await c.x.target.locator('.native-display-host').textContent(),'');
}
function bottomGeometry606(){const n=document.querySelector('[data-field="status"]'),r=n?.getBoundingClientRect();return {rendered:document.body.dataset.state==='DISPLAY_RENDERED',focused:document.hasFocus()&&document.activeElement===document.querySelector('main'),visible:!!r&&r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,overflowFree:document.documentElement.scrollWidth<=innerWidth};}
async function captureDisplay606(c,g,role,page,{bottom=false}={}){
 const file=join(process.env.PAN549_BROWSER_EVIDENCE,'jo259457-native-display-'+role+'.png');
 assert.deepEqual(await g.documentFrame.evaluate(displaySnapshot606),{state:'DISPLAY_RENDERED',principal:'RESTRICTED_DISPLAY_ONLY',origin:g.offered.displayOrigin,hash:'',controls:0,fields:c.expected});
 if(bottom)assert.deepEqual(await g.documentFrame.evaluate(bottomGeometry606),{rendered:true,focused:true,visible:true,overflowFree:true});
 liveDisplay606(g.offered,'Evidence capture start');const captureStartedAtMs=Date.now();console.log('606_CAPTURE_PHASE '+JSON.stringify({role,step:'start',remainingMs:g.offered.expiresAtMs-captureStartedAtMs}));
 await page.screenshot({path:file,fullPage:true});const captureCompletedAtMs=Date.now();console.log('606_CAPTURE_PHASE '+JSON.stringify({role,step:'finish',remainingMs:g.offered.expiresAtMs-captureCompletedAtMs}));liveDisplay606(g.offered,'Evidence capture completion');
 assert.equal(await g.frame.locator('body').getAttribute('data-state'),'DISPLAY_RENDERED');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.ok(await g.documentFrame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(bottom)assert.deepEqual(await g.documentFrame.evaluate(bottomGeometry606),{rendered:true,focused:true,visible:true,overflowFree:true});
 liveDisplay606(g.offered,'Post-capture rendered/overflow/geometry checks');
 return {role,file,sessionId:g.offered.sessionId,grantDigest:g.offered.grantDigest,grantExpiresAtMs:g.offered.expiresAtMs,captureStartedAtMs,captureCompletedAtMs,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')};
}
async function positionDisplay606(x){for(const page of[x.source,x.target])await page.locator(displayPanel606).scrollIntoViewIfNeeded();}
test('606 authority: exact current ERV fields, live privilege negatives, cookie/ticket/storage denial and explicit pre-deadline revocation',async()=>displayCase606(async c=>{
 const {x,observation}=c,grant=await offerDisplay606(c),{offered,offerWire}=grant;
 const forbidden=await forward549(x.f,{request:()=>offerWire.request()},s=>s.fields.push('leadingStore'));assert.equal(forbidden.status,403,'A foreign native field must be rejected by the real server without changing the valid offer');
 const deniedRole=await restrictedHttp606(x.f,offered.displayOrigin,'/t/tenant-a/workspace/profile',{method:'POST',headers:{origin:offered.displayOrigin,cookie:x.a.who.cookieHeader},body:{}});assert.equal(deniedRole.status,403,'Full workspace cookie is not a display principal or a write grant');
 const g=await confirmDisplay606(c,grant);await activeDisplay606(c,g);
 const denied=await Promise.all(['/t/tenant-a/workspace/erv','/t/tenant-a/workspace/administration/read','/audio','/display/read-other-object'].map(path=>restrictedHttp606(x.f,offered.displayOrigin,path,{method:path.includes('administration')?'POST':'GET',headers:{origin:offered.displayOrigin,authorization:g.headers.authorization},...(path.includes('administration')?{body:{}}:{})})));
 liveDisplay606(offered,'Live principal privilege-negative responses');for(const row of denied)assert.equal(row.status,403,'Restricted origin must deny direct full-workspace/data/audio calls');
 const replay=await restrictedHttp606(x.f,offered.displayOrigin,'/display/redeem',{method:'POST',headers:{origin:offered.displayOrigin},body:{ticket:g.confirmed.restrictedLaunch.ticket}});assert.equal(replay.status,403);
 const storage=await g.documentFrame.evaluate(async()=>({local:localStorage.length,session:sessionStorage.length,caches:await caches.keys()}));assert.deepEqual(storage,{local:0,session:0,caches:[]});
 await observation.sample('after-negatives',true);await activeDisplay606(c,g);
 const revoked=await revokeDisplay606(c,g);await closedDisplay606(c,g);
 return [{name:'606-authority',state:'REAL_NATIVE_AUTHORITY_CASE_COMPLETED',...revoked,fullCookieDirectWriteDenied:true,foreignFieldDenied:true,directDataAdminAudioDenied:true,ticketReplayDenied:true,noBrowserStoredData:true}];
}));
test('606 keyboard: own bilateral grant, full focus/Control+End geometry and actual390px bottom raster, then live revoke',async()=>displayCase606(async c=>{
 await positionDisplay606(c.x);const g=await confirmDisplay606(c,await offerDisplay606(c));
 await keyboardReachability606(c.x,g.frame,g.offered,c.observation);
 const image=await captureDisplay606(c,g,'restricted-receiver-390-bottom',c.x.target,{bottom:true});
 const revoked=await revokeDisplay606(c,g);await closedDisplay606(c,g);
 return [{name:'606-keyboard-bottom',state:'REAL_NATIVE_KEYBOARD_AND_BOTTOM_CAPTURE_COMPLETED',...revoked,images:[{...image,role:'restricted-receiver-390-keyboard-bottom'}]}];
}));
test('606 source raster: own exact-reference grant, independent principal/fields/render acknowledgement and live revoke',async()=>displayCase606(async c=>{
 await positionDisplay606(c.x);const g=await confirmDisplay606(c,await offerDisplay606(c));
 const image=await captureDisplay606(c,g,'source',c.x.source),revoked=await revokeDisplay606(c,g);await closedDisplay606(c,g);
 return [{name:'606-source-raster',state:'REAL_NATIVE_SOURCE_CAPTURE_COMPLETED',...revoked,images:[image]}];
}));
test('606 receiver raster: own exact-reference grant at390px, independent principal/fields/render acknowledgement and live revoke',async()=>displayCase606(async c=>{
 await positionDisplay606(c.x);const g=await confirmDisplay606(c,await offerDisplay606(c));
 assert.deepEqual(c.x.target.viewportSize(),{width:390,height:844});
 const image=await captureDisplay606(c,g,'restricted-receiver-390',c.x.target),revoked=await revokeDisplay606(c,g);await closedDisplay606(c,g);
 return [{name:'606-receiver-raster',state:'REAL_NATIVE_RECEIVER_CAPTURE_COMPLETED',...revoked,images:[image]}];
}));
test('606 freshness: three explicitly confirmed and individually revoked grants never reuse a session, ticket or restricted principal',async()=>displayCase606(async c=>{
 const previous=[],revocations=[];
 for(let index=0;index<3;index++){
  const g=await confirmDisplay606(c,await offerDisplay606(c));
  for(const old of previous){assert.notEqual(g.offered.sessionId,old.offered.sessionId);assert.equal(g.offered.displayOrigin,old.offered.displayOrigin);assert.notEqual(g.confirmed.restrictedLaunch.ticket,old.confirmed.restrictedLaunch.ticket);assert.notEqual(g.headers.authorization,old.headers.authorization);assert.equal((await restrictedHttp606(c.x.f,old.offered.displayOrigin,'/display/events',{headers:{origin:old.offered.displayOrigin,authorization:old.headers.authorization}})).status,403);}
  liveDisplay606(g.offered,'Fresh independently rendered grant after old-principal denial');
  revocations.push(await revokeDisplay606(c,g));await closedDisplay606(c,g);previous.push(g);
 }
 return [{name:'606-grant-freshness',state:'REAL_NATIVE_FRESH_GRANTS_COMPLETED',revocations}];
}));
test('606 short native lease: confirmed fields clear at actual deadline while the real revoked SSE is stalled, without Offline',async()=>displayCase606(async c=>{
 const {x}=c;
 const shortHandler=async route=>{if(route.request().postDataJSON()?.operation!=='offer'){await route.continue();return;}const actual=await forward549(x.f,route,s=>s.maximumAgeMs=5000);await route.fulfill({status:actual.status,headers:actual.headers,body:actual.body});};
 // Prepare CDP before the short grant; the real network fault starts only after
 // this grant's independently verified render. Never widen the native5s lease.
 const connection=await x.b.context.newCDPSession(x.target);await connection.send('Network.enable');
 let transport,observeNativeStream,nativeStream,socket,nativeEnd,g,revoked,heldArgs=null;
 await x.source.route(displayPath606,shortHandler);
 try{
  const grant=await offerDisplay606(c);assert.ok(grant.offered.expiresAtMs-Date.now()<=5000);liveDisplay606(grant.offered,'Short native offer');
  const {nativeWorkspaceDisplayTransportConnectionV1}=await import('../../src/pan527/origin-session-adapter.mjs');
  transport=nativeWorkspaceDisplayTransportConnectionV1(x.f.tls.gateway,{tenantId:'tenant-a',origin:x.f.tls.origin,identityDigest:x.f.sessions.binding.identityDigest});
  const nativeStreams=[];observeNativeStream=(request,response)=>{if(request.url==='/display/events')nativeStreams.push(response);};transport.server.on('request',observeNativeStream);
  g=await confirmDisplay606(c,grant);assert.equal(nativeStreams.length,1);nativeStream=nativeStreams[0];socket=nativeStream.socket;nativeEnd=nativeStream.end;
  let heldReady;const held=new Promise(resolve=>heldReady=resolve);socket.cork();nativeStream.end=function(...args){heldArgs=args;heldReady();return this;};
  await connection.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:1,uploadThroughput:1048576});
  assert.equal(await x.target.evaluate(()=>navigator.onLine),true);assert.ok(g.offered.expiresAtMs-Date.now()>500,'Actual native revocation must precede the declared lease deadline while the receiver stream is stalled');
  revoked=await revokeDisplay606(c,g);await held;
  assert.ok(heldArgs!==null&&!nativeStream.writableEnded&&socket.writableCorked>0,'The real native CLOSED response and completion are held on an actually open corked TLS socket, without replacing payload data');
  await g.frame.locator('body[data-state="DISPLAY_CLOSED"]').waitFor();
  assert.equal(await g.frame.locator('body').getAttribute('data-closed-by'),'GRANT_DEADLINE','A stalled stream must be cleared by the native lease deadline, not merely an SSE close/Offline event');assert.equal(await g.frame.locator('[data-field]').count(),0);assert.equal(await x.target.evaluate(()=>navigator.onLine),true);
 }finally{
  if(nativeStream){nativeStream.end=nativeEnd;if(!socket.destroyed){socket.uncork();if(heldArgs!==null&&!nativeStream.writableEnded)nativeEnd.apply(nativeStream,heldArgs);}}
  if(observeNativeStream)transport.server.removeListener('request',observeNativeStream);
  await x.source.unroute(displayPath606,shortHandler);
  try{await connection.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});}finally{await connection.detach();}
 }
 await closedDisplay606(c,g);
 return [{name:'606-short-lease-stalled-sse',state:'REAL_NATIVE_SHORT_LEASE_STALLED_SSE_COMPLETED',...revoked,stalledNativeSSEWithoutOfflineClearedAtNativeLeaseDeadline:true}];
}));
test('606 real native display denial is an accessible focused alert; unconfirmed read clears content without stealing focus or retrying writes',async()=>{
 const x=await fixture();try{
  await claim(x,await offer(x));await confirm(x);
  const display=x.source.locator('.surface-native-presentation'),button=x.source.getByRole('button',{name:'Begrenzte native Dokumentpräsentation freigeben',exact:true});
  await button.waitFor();await x.source.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Begrenzte native Dokumentpräsentation freigeben'&&!b.disabled));
  let writes=0;const nativeDenial=async route=>{if(route.request().postDataJSON()?.operation!=='offer'){await route.continue();return;}writes++;const actual=await forward549(x.f,route,s=>s.fields.push('leadingStore'));assert.equal(actual.status,403);assert.match(JSON.parse(actual.body).error,/^DISPLAY_/);await route.fulfill({status:actual.status,headers:actual.headers,body:actual.body});};
  await x.source.route('**/workspace/surfaces/display-session-v1',nativeDenial);await button.focus();await button.press('Enter');const alert=display.getByRole('alert');await alert.waitFor();assert.match(await alert.textContent(),/DISPLAY_[A-Z_]+ · HTTP 403/);assert.match(await alert.textContent(),/Kopplungsstatus prüfen/);assert.equal(await alert.getAttribute('aria-live'),'assertive');assert.equal(await alert.evaluate(e=>document.activeElement===e),true);assert.equal(await display.locator('iframe').count(),0);assert.equal(writes,1);
  await capture(x.source,'1280-606-native-denial-focused-alert');await x.source.unroute('**/workspace/surfaces/display-session-v1',nativeDenial);
  let readFailed;const seen=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('606_REAL_NATIVE_READ_NOT_OBSERVED')),5000);readFailed=()=>{clearTimeout(timer);resolve();};});const lostRead=async route=>{const operation=route.request().postDataJSON()?.operation;if(operation!=='read'){writes++;await route.continue();return;}const actual=await forward549(x.f,route);assert.equal(actual.status,200);await route.abort('connectionfailed');readFailed();};
  await x.source.route('**/workspace/surfaces/display-session-v1',lostRead);const code=x.source.getByLabel('Code aus dem anderen Browserprofil',{exact:true});await code.focus();await x.source.getByRole('button',{name:'Kopplungsstatus prüfen',exact:true}).click();await code.focus();await seen;await x.source.waitForFunction(()=>document.querySelector('.surface-native-presentation [role="alert"]')?.textContent.includes('DISPLAY_OUTCOME_UNCONFIRMED'));assert.equal(await code.evaluate(e=>document.activeElement===e),true);assert.match(await display.getByRole('alert').textContent(),/Keine automatische Wiederholung/);assert.equal(await display.locator('iframe').count(),0);assert.equal(writes,1,'Only explicit user action, never an automatic offer/confirm/revoke retry');x.f.unchanged();
 }finally{await x.close();}
});
test('606 delayed native display reads cannot undo confirm/revoke or newer read/error ordering',async()=>displayCase606(async c=>{
 const {x}=c,pending=[];let hold=false,readObserved;
 try{
  const receiverConfirm=x.target.getByRole('button',{name:'Begrenzte Dokumentanzeige als Empfänger bestätigen',exact:true}),display=x.target.locator('.surface-native-presentation');
  const first=await offerDisplay606(c);await x.target.waitForFunction(()=>document.querySelector('.surface-native-presentation').dataset.state==='DISPLAY_OFFERED');
  // Forward real native reads unchanged, delaying only their transport completion.
  // All subsequent reads are held too, so a later poll cannot mask a stale commit.
  await x.target.route('**/workspace/surfaces/display-session-v1',async route=>{
   if(!hold||route.request().postDataJSON()?.operation!=='read'){await route.continue();return;}
   const actual=await forward549(x.f,route);assert.equal(actual.status,200);assert.equal(actual.tlsAuthorized,true);
   let release,settled;const gate=new Promise(r=>release=r),done=new Promise(r=>settled=r);pending.push({actual,request:route.request(),release,done});readObserved?.();
   const fail=await gate;try{if(fail)await route.abort('connectionfailed');else await route.fulfill({status:actual.status,headers:actual.headers,body:actual.body});}finally{settled();}
  });
  // Event-driven observation of the real forwarded read, under the same8s bound;
  // no polling sleeps or retried product writes.
  const nextRead=async()=>{const index=pending.length;let timer;const seen=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Actual native display read must be observed')),8000);readObserved=resolve;});try{await x.target.getByRole('button',{name:'Kopplungsstatus prüfen',exact:true}).click();await seen;return pending[index];}finally{clearTimeout(timer);readObserved=null;}};
  const release=async(row,fail=false)=>{const completed=x.target.waitForEvent(fail?'requestfailed':'requestfinished',r=>r===row.request);row.release(fail);await row.done;await completed;await x.target.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));};
  hold=true;const oldOffer=await nextRead();assert.equal(JSON.parse(oldOffer.actual.body).session.state,'OFFERED');
  const g=await confirmDisplay606(c,first);await release(oldOffer);assert.equal(await display.getAttribute('data-state'),'DISPLAY_ACTIVE');assert.equal(await display.locator('iframe').count(),1);assert.equal(await receiverConfirm.isDisabled(),true);
  const oldActive=await nextRead();assert.equal(JSON.parse(oldActive.actual.body).session.state,'ACTIVE');const revoked=await revokeDisplay606(c,g,x.target);await x.target.waitForFunction(()=>document.querySelector('.surface-native-presentation').dataset.state==='DISPLAY_REVOKED');await release(oldActive);assert.equal(await display.getAttribute('data-state'),'DISPLAY_REVOKED');assert.equal(await display.locator('iframe').count(),0);assert.equal(await receiverConfirm.isDisabled(),true);await closedDisplay606(c,g);
  // Two older reads (including an eventual transport error) must lose to a newer
  // native OFFERED read, with no mutation in this receiver between completions.
  const older=await nextRead(),olderError=await nextRead(),next=await offerDisplay606(c);await x.source.waitForFunction(()=>document.querySelector('.surface-native-presentation').dataset.state==='DISPLAY_OFFERED');hold=false;const newer=x.target.waitForResponse(r=>r.url().endsWith('/workspace/surfaces/display-session-v1')&&r.request().postDataJSON()?.operation==='read'&&r.status()===200);await x.target.getByRole('button',{name:'Kopplungsstatus prüfen',exact:true}).click();assert.equal((await(await newer).json()).session.state,'OFFERED');await x.target.waitForFunction(()=>document.querySelector('.surface-native-presentation').dataset.state==='DISPLAY_OFFERED');await release(older);assert.equal(await display.getAttribute('data-state'),'DISPLAY_OFFERED');await release(olderError,true);assert.equal(await display.getAttribute('data-state'),'DISPLAY_OFFERED');assert.equal(await display.getByRole('alert').count(),0);assert.equal(await receiverConfirm.isDisabled(),false);
  const fresh=await confirmDisplay606(c,next),freshRevoked=await revokeDisplay606(c,fresh);await closedDisplay606(c,fresh);
  return [{name:'606-stale-read-ordering',state:'REAL_NATIVE_STALE_READ_ORDERING_COMPLETED',revocations:[revoked,freshRevoked]}];
 }finally{hold=false;for(const row of pending)row.release(false);await Promise.all(pending.map(row=>row.done));await x.target.unroute('**/workspace/surfaces/display-session-v1');}
}));
// JO259457_RESTRICTED_NATIVE_DISPLAY_END
