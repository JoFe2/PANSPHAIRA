import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {nativeViewBrowserFixture546} from '../pan546/browser-fixture.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const evidence=()=>{const p=process.env.PAN543_PRISM_EVIDENCE;assert.ok(p,'PRISM owned evidence required, never skip');mkdirSync(p,{recursive:true,mode:0o700});return p;};
async function prism(f){await f.page.goto(f.tls.origin+'/t/tenant-a/workspace');await f.page.getByRole('button',{name:'Eingangsrechnungsprüfung — nur lesen',exact:true}).click();await f.page.locator('[id="shell.module-view"][data-state="CURRENT_NATIVE_VIEW"]').waitFor({state:'attached'});await f.page.getByRole('button',{name:'Design und Layout konfigurieren',exact:true}).click();await f.page.getByRole('combobox',{name:'Designprofil',exact:true}).selectOption('prism');await f.page.getByRole('button',{name:'Kuratierte Vorlage als Vorschau',exact:true}).click();await f.page.getByRole('button',{name:'Zur Arbeitsfläche',exact:true}).click();await f.page.waitForFunction(()=>document.body.dataset.designProfile==='prism');}
async function currentProfile(page){return page.evaluate(async()=>{const r=await fetch('/t/tenant-a/workspace/profile',{credentials:'same-origin',cache:'no-store'});if(r.status!==200)throw Error('ACTUAL_NATIVE_PROFILE_READ_REQUIRED');return r.json();});}
const profilePosts=f=>f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/workspace/profile'));
async function image(f,name,extra={}){const path=join(evidence(),name+'.png');await f.page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await f.page.screenshot({path,fullPage:false,animations:'disabled'});const state=await f.page.evaluate(()=>{const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,visible:e.checkVisibility()};};return{viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,profile:document.body.dataset.designProfile,properties:box(document.querySelector('[data-prism-properties-panel]')),dialog:document.querySelector('[data-prism-properties-dialog]')?.open??false,selected:document.getElementById('workspace.composition')?.dataset.compositionSelection??null,native:document.getElementById('shell.module-view')?.dataset.state};});const pins={};for(const p of ['packages/browser-workspace/src/profile-editor-v1.ts','packages/browser-workspace/src/workspace.css','dist/browser-workspace/workspace-appearance.js','tests/pan543/prism-properties.test.mjs'])pins[p]=sha(readFileSync(p));const result={path,sha256:sha(readFileSync(path)),state,pins,actualNative:true,physicalDevice:false,visualAcceptance:false,...extra};writeFileSync(path+'.json',JSON.stringify(result,null,2)+'\n',{mode:0o600});return result;}

test('PRISM-PROPERTIES real registered palette selection -> same native profile properties -> preview/confirmation/CAS/readback/reload, responsive same controls; no model or business write',async()=>{
 const f=await nativeViewBrowserFixture546({agentRuns:true,humanDecisions:true});const result={success:false,images:[],nativeProfilePosts:0,modelPosts:0};
 try{
  await f.page.setViewportSize({width:1586,height:992});await prism(f);const before=await currentProfile(f.page),business=f.business();assert.equal(before.revision,0);
  await f.page.evaluate(()=>{window.__prismBefore=Object.fromEntries(['shell.main','shell.module-view','shell.agent-panel','pan548-agent-intent'].map(id=>[id,document.getElementById(id)]));});
  const entry=f.page.getByRole('button',{name:'Deine Arbeitsansicht konfigurieren',exact:true});
  assert.equal(await entry.count(),1,'PRISM_REGISTERED_CARD_HAS_NO_CONTEXTUAL_PROPERTIES_ENTRY');await entry.click();
  const properties=f.page.locator('[data-prism-properties-panel]');await properties.waitFor();
  assert.equal(await f.page.locator('[id="workspace.composition"]').getAttribute('data-composition-selection'),'pan.erv.personal-view');
  const size=properties.getByRole('combobox',{name:'Deine Arbeitsansicht Größe',exact:true});await size.selectOption('large');
  assert.equal(profilePosts(f).length,0,'PROPERTY_EDIT_IS_LOCAL_PREVIEW_NOT_PERSISTENCE');assert.deepEqual(await currentProfile(f.page),before);
  assert.equal(await f.page.locator('[data-workspace-card-id="pan.erv.personal-view"]').getAttribute('data-composition-size'),'large');
  await f.page.evaluate(()=>{window.__prismPropertySize=document.querySelector('[data-prism-properties-panel] select[data-composition-size]');});
  for(const viewport of [{width:1586,height:992},{width:1024,height:768},{width:390,height:844}]){
   await f.page.setViewportSize(viewport);await f.page.waitForFunction(w=>{const d=document.querySelector('[data-prism-properties-dialog]');return innerWidth===w&&(w<800?d?.open:!d?.open);},viewport.width);
   const metrics=await properties.evaluate(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width,visible:e.checkVisibility(),viewport:innerWidth};});assert.ok(metrics.visible&&metrics.width>0&&metrics.left>=0&&metrics.right<=metrics.viewport+1,'PROPERTIES_VISIBLE_AND_BOUNDED');const field=await properties.locator('[data-profile-item="pan.erv.personal-view"]').evaluate(e=>({width:e.getBoundingClientRect().width,font:parseFloat(getComputedStyle(e).fontSize)}));assert.ok(field.width>=Math.min(220,metrics.width-40),'SELECTED_PROPERTIES_MUST_USE_AVAILABLE_COLUMN:'+JSON.stringify({field,metrics}));
   assert.equal(await size.inputValue(),'large');assert.equal(await f.page.evaluate(()=>window.__prismPropertySize===document.querySelector('[data-prism-properties-panel] select[data-composition-size]')),true,'SAME_PROPERTY_CONTROL_ACROSS_RESPONSIVE_PORTAL');
   result.images.push(await image(f,'prism-properties-'+viewport.width+'-local-preview'));
  }
  await properties.getByRole('button',{name:'Profil speichern',exact:true}).click();assert.equal(profilePosts(f).length,0,'REVIEW_IS_NOT_COMMIT');
  await properties.getByRole('button',{name:'Speichern bestätigen',exact:true}).click();await f.page.locator('[data-profile-state="SAVED"]').waitFor({state:'attached'});
  assert.equal(await properties.locator('[data-profile-state="SAVED"]').isVisible(),true,'ACTUAL_NATIVE_SAVED_STATUS_VISIBLE_IN_PROPERTIES');const saved=await currentProfile(f.page);assert.equal(saved.revision,1);assert.equal(saved.profile.items.find(i=>i.id==='pan.erv.personal-view').size,'large');assert.equal(profilePosts(f).length,1);
  await f.page.getByRole('button',{name:'Bausteinkonfiguration schließen',exact:true}).click();await f.page.setViewportSize({width:1586,height:992});
  assert.equal(await f.page.evaluate(()=>Object.entries(window.__prismBefore).every(([id,e])=>document.getElementById(id)===e)),true,'SAME_NATIVE_CONTEXT_INPUT_AND_OWNER');
  await f.page.reload();await f.page.locator('[id="shell.module-view"][data-state="CURRENT_NATIVE_VIEW"]').waitFor({state:'attached'});assert.deepEqual(await currentProfile(f.page),saved);
  assert.equal(f.business(),business);assert.equal(f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/agent-run/start')).length,0);assert.deepEqual(f.errors,[]);
  result.success=true;result.nativeProfilePosts=profilePosts(f).length;result.modelPosts=0;result.savedRevision=saved.revision;result.businessUnchanged=true;
 }catch(e){result.failure={name:e.name,message:e.message};throw e;}
 finally{await f.close();writeFileSync(join(evidence(),'actual-prism-properties-workflow.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});}
});


test('PRISM-PROPERTIES same owner on palette/module selection, generic plus restore, profile switch and mobile Escape without implicit writes',async()=>{
 const f=await nativeViewBrowserFixture546({agentRuns:true,humanDecisions:true});
 try{await f.page.setViewportSize({width:1586,height:992});await prism(f);const before=await currentProfile(f.page),business=f.business();
  await f.page.locator('.workspace-agent-chip').click();await f.page.locator('#pan548-agent-intent').fill('Nur eigener ungesendeter Entwurf.');await f.page.locator('.workspace-agent-chip').click();
  await f.page.getByRole('button',{name:'Beleg und Beträge konfigurieren',exact:true}).click();const properties=f.page.locator('[data-prism-properties-panel]');
  assert.equal(await properties.getByRole('checkbox',{name:'Beleg und Beträge anzeigen',exact:true}).isDisabled(),true,'MANDATORY_NATIVE_CARD_CANNOT_HIDE');
  await properties.getByRole('combobox',{name:'Registrierten Beitrag auswählen',exact:true}).selectOption('pan.setup.navigation');
  await properties.getByRole('combobox',{name:'Einstellungen · Einrichtung Größe',exact:true}).selectOption('compact');
  assert.equal(profilePosts(f).length,0);assert.deepEqual(await currentProfile(f.page),before);
  await f.page.getByRole('button',{name:'Registrierte Module und Karten auswählen',exact:true}).click();
  assert.equal(await f.page.locator('[data-prism-properties-panel]').count(),0);assert.equal(await f.page.locator('[id="profile.editor"] [id="workspace.composition"]').count(),1,'SAME_COMPOSITION_RETURNED_TO_LEGACY_EDITOR');
  await f.page.getByRole('button',{name:'Design und Layout konfigurieren',exact:true}).click();await f.page.getByRole('combobox',{name:'Designprofil',exact:true}).selectOption('orbit');await f.page.getByRole('button',{name:'Kuratierte Vorlage als Vorschau',exact:true}).click();await f.page.getByRole('button',{name:'Zur Arbeitsfläche',exact:true}).click();
  assert.equal(await f.page.locator('#pan548-agent-intent').inputValue(),'Nur eigener ungesendeter Entwurf.');assert.equal(profilePosts(f).length,0);
  await f.page.getByRole('button',{name:'Design und Layout konfigurieren',exact:true}).click();await f.page.getByRole('combobox',{name:'Designprofil',exact:true}).selectOption('prism');await f.page.getByRole('button',{name:'Kuratierte Vorlage als Vorschau',exact:true}).click();await f.page.getByRole('button',{name:'Zur Arbeitsfläche',exact:true}).click();
  await f.page.setViewportSize({width:390,height:844});await f.page.getByRole('button',{name:'Bausteine konfigurieren',exact:true}).click();await f.page.waitForFunction(()=>document.querySelector('[data-prism-properties-dialog]')?.open);await f.page.keyboard.press('Escape');
  assert.equal(await f.page.locator('[data-prism-properties-dialog]').evaluate(e=>e.open),false);assert.equal(await f.page.locator('[data-prism-properties-panel]').count(),0);assert.deepEqual(await currentProfile(f.page),before);
  assert.equal(f.business(),business);assert.equal(f.requests.filter(r=>r.method==='POST'&&r.path.endsWith('/agent-run/start')).length,0);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

test('PRISM-PROPERTIES real lost commit reply keeps visible native UNKNOWN and disabled retry, explicit fresh read recovers exactly one CAS',async()=>{
 const f=await nativeViewBrowserFixture546({agentRuns:true,humanDecisions:true});
 try{await f.page.setViewportSize({width:1586,height:992});await prism(f);const business=f.business();await f.page.getByRole('button',{name:'Deine Arbeitsansicht konfigurieren',exact:true}).click();const properties=f.page.locator('[data-prism-properties-panel]');await properties.getByRole('combobox',{name:'Deine Arbeitsansicht Größe',exact:true}).selectOption('compact');
  let commits=0;const {request527}=await import('../pan527/helpers.mjs');
  await f.page.route('**/workspace/profile',async route=>{if(route.request().method()!=='POST')return route.continue();commits++;const headers=await route.request().allHeaders();delete headers['content-length'];const actual=await request527(f.tls,'/t/tenant-a/workspace/profile',headers,'POST',route.request().postDataJSON());assert.equal(actual.status,200,'ACTUAL_NATIVE_COMMIT_BEFORE_REPLY_IS_LOST');return route.abort('failed');});
  await properties.getByRole('button',{name:'Profil speichern',exact:true}).click();await properties.getByRole('button',{name:'Speichern bestätigen',exact:true}).click();await properties.locator('[data-profile-state="OUTCOME_UNKNOWN"]').waitFor();
  assert.equal(await properties.getByRole('button',{name:'Profil speichern',exact:true}).isDisabled(),true);assert.equal(commits,1);assert.equal((await currentProfile(f.page)).revision,1);
  await properties.getByRole('button',{name:'Profil speichern',exact:true}).dispatchEvent('click');assert.equal(commits,1,'NO_BLIND_COMMIT_RETRY');
  await properties.getByRole('button',{name:'Gespeichertes Profil neu laden — lokale Änderungen verwerfen',exact:true}).click();await properties.locator('[data-profile-state="READY"]').waitFor();assert.equal(commits,1);assert.equal((await currentProfile(f.page)).revision,1);assert.equal(f.business(),business);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
