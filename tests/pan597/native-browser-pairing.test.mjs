import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {nativeViewFixture546} from '../pan546/native-fixture.mjs';
import {createNativeWorkspaceUiTaskProjectionV2} from '../../src/pan548/native-ui-task-projection-v2.mjs';
import {createNativeSurfaceProjectionReaderV2} from '../../src/pan546/native-surface-projection-v2.mjs';
import {createNativeWorkspaceSurfacesV2} from '../../src/pan597/native-surfaces-v2.mjs';
const schemaVersion='pansphaira.workspace-surface/browser-pair-command/v1';
const registration={schemaVersion:'pansphaira.workspace-surface/register/v2',previousSurfaceId:null,previousProof:null,localGeneration:1,pinned:false,dirty:false};
async function fixture(){
 const f=await nativeViewFixture546();let tasks,owner;
 try{
  tasks=createNativeWorkspaceUiTaskProjectionV2({sessions:f.sessions,root:join(f.root,'browser-pair-task-owner')});
  const reader=createNativeSurfaceProjectionReaderV2({sessions:f.sessions,nativeReader:f.reader,analysisReader:null,readMonitor:()=>{throw Error('PAIR_DOCUMENT_ONLY');}});
  owner=createNativeWorkspaceSurfacesV2({sessions:f.sessions,contextSelection:f.context,tasks,reader});
  function register(headers=f.issue()) {const t=f.tab(headers);t.surface=owner.register(t.headers,registration);t.headers={...t.headers,'x-pan597-surface':t.surface.surfaceId,'x-pan597-proof':t.surface.surfaceProof};return t;}
  const source=register(),target=register();
  return {f,tasks,owner,source,target,register,call(t,operation,fields={}){return owner.browserPairingV1(t.headers,{schemaVersion,operation,...fields});},offer(){return this.call(source,'offer',{routeId:'pan.erv.document.v2',objectId:'AP-PAN516-MATCHED-01',expectedRevision:source.context.primaryObject.revision});},async close(){owner.close();tasks.close();await f.close();}};
 }catch(error){owner?.close();tasks?.close();await f.close();throw error;}
}
test('605 limited browser prerequisite: distinct actual native authenticated sessions, one-use code, bilateral confirmation, no display/field/business grant',async()=>{
 const x=await fixture();try{
  assert.equal(typeof x.owner.browserPairingV1,'function','Main597 is missing the versioned independent-session browser-pairing operation');
  assert.notEqual(x.source.headers.cookie,x.target.headers.cookie);
  const offered=x.offer();assert.equal(offered.state,'OFFERED');assert.match(offered.code,/^[a-f0-9]{20}$/);
  const claimed=x.call(x.target,'claim',{code:offered.code,confirmation:'CONFIRM_RECEIVER_PAIRING'});assert.equal(claimed.state,'CLAIMED');
  const paired=x.call(x.source,'confirm',{pairId:claimed.pairId,targetSurfaceId:x.target.surface.surfaceId,scopeDigest:claimed.scopeDigest,confirmation:'CONFIRM_SOURCE_PAIRING'});assert.equal(paired.state,'PAIRED');
  assert.equal(x.call(x.target,'read',{pairId:paired.pairId}).state,'PAIRED');
  assert.equal(paired.projectionDeliveryGranted,false);assert.equal(paired.fieldProjectionGranted,false);assert.equal(paired.executionAuthorityGranted,false);assert.equal(paired.physicalDeviceQualified,false);
  assert.equal(paired.scope.fieldProjectionGrant,null);assert.equal(paired.scope.dataClassGrant,null);
  assert.equal(x.call(x.target,'revoke',{pairId:paired.pairId}).state,'REVOKED');assert.equal(x.call(x.source,'read',{pairId:paired.pairId}).state,'REVOKED');
 }finally{await x.close();}
});

function pair(x){const o=x.offer(),c=x.call(x.target,'claim',{code:o.code,confirmation:'CONFIRM_RECEIVER_PAIRING'});return x.call(x.source,'confirm',{pairId:c.pairId,targetSurfaceId:c.targetSurfaceId,scopeDigest:c.scopeDigest,confirmation:'CONFIRM_SOURCE_PAIRING'});}
test('605 code replay, missing bilateral confirmation, foreign fields and paired full-session delivery remain denied',async()=>{
 const x=await fixture();try{
  const o=x.offer(),c=x.call(x.target,'claim',{code:o.code,confirmation:'CONFIRM_RECEIVER_PAIRING'}),third=x.register();
  assert.throws(()=>x.call(third,'claim',{code:o.code,confirmation:'CONFIRM_RECEIVER_PAIRING'}),/CODE_DENIED/);
  assert.throws(()=>x.call(x.target,'confirm',{pairId:c.pairId,targetSurfaceId:c.targetSurfaceId,scopeDigest:c.scopeDigest,confirmation:'CONFIRM_SOURCE_PAIRING'}),/SOURCE_CONFIRMATION_DENIED/);
  assert.throws(()=>x.call(x.source,'confirm',{pairId:c.pairId,targetSurfaceId:c.targetSurfaceId,scopeDigest:'0'.repeat(64),confirmation:'CONFIRM_SOURCE_PAIRING'}),/SOURCE_CONFIRMATION_DENIED/);
  assert.equal(x.call(x.source,'read',{pairId:c.pairId}).state,'CLAIMED');
  assert.throws(()=>x.call(x.source,'read',{pairId:c.pairId,fields:['customerSecret']}),/INPUT_DENIED/);
  assert.throws(()=>x.call(x.source,'read',{pairId:c.pairId,dataClass:'PUBLIC'}),/INPUT_DENIED/);
  x.call(x.source,'confirm',{pairId:c.pairId,targetSurfaceId:c.targetSurfaceId,scopeDigest:c.scopeDigest,confirmation:'CONFIRM_SOURCE_PAIRING'});
  const s=x.source.surface,t=x.target.surface;
  assert.throws(()=>x.owner.accept(x.source.headers,{schemaVersion:'pansphaira.workspace-surface/display-command/v2',commandId:'display:'+'1'.repeat(32),sourceSurfaceId:s.surfaceId,sourceConnectionEpoch:s.connectionEpoch,sourceContextEpoch:s.contextEpoch,sourceRevisionDigest:s.revisionDigest,targetSurfaceId:t.surfaceId,targetConnectionEpoch:t.connectionEpoch,targetContextEpoch:t.contextEpoch,targetRevisionDigest:t.revisionDigest,targetLocalGeneration:t.localGeneration,routeId:'pan.erv.document.v2',objectId:'AP-PAN516-MATCHED-01',expectedRevision:x.source.context.primaryObject.revision,expiresAtMs:Date.now()+60000}),/SURFACE_SCOPE_DENIED/);
  const {nativeWorkspaceUiTaskOwnerConnectionV2}=await import('../../src/pan548/native-ui-task-projection-v2.mjs');assert.equal(nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding).db.prepare('SELECT count(*) n FROM workspace_ui_tasks_v2').get().n,0);
 }finally{await x.close();}
});
test('605 failed native claim attempts really commit before denial and cannot be reset by choosing another local tab',async()=>{
 const x=await fixture();try{const o=x.offer();for(let i=0;i<5;i++)assert.throws(()=>x.call(x.target,'claim',{code:'0'.repeat(20),confirmation:'CONFIRM_RECEIVER_PAIRING'}),/CODE_DENIED/);assert.throws(()=>x.call(x.target,'claim',{code:o.code,confirmation:'CONFIRM_RECEIVER_PAIRING'}),/ATTEMPT_LIMIT/);const copiedTab=x.register(x.target.headers);assert.throws(()=>x.call(copiedTab,'claim',{code:o.code,confirmation:'CONFIRM_RECEIVER_PAIRING'}),/ATTEMPT_LIMIT/);assert.equal(x.call(x.source,'read',{pairId:o.pairId}).state,'OFFERED');}finally{await x.close();}
});
test('605 copied actual session cookie, forged tab session, foreign tenant, origin and Surface proof do not constitute an independent login',async()=>{
 const x=await fixture();try{
  const o=x.offer(),copy=x.register(x.source.headers);
  assert.throws(()=>x.call(copy,'claim',{code:o.code,confirmation:'CONFIRM_RECEIVER_PAIRING'}),/OWN_LOGIN_REQUIRED/);
  assert.throws(()=>x.owner.browserPairingV1({...copy.headers,'x-pan548-session':'session:'+'a'.repeat(64)},{schemaVersion,operation:'claim',code:o.code,confirmation:'CONFIRM_RECEIVER_PAIRING'}),/HOSTED_SESSION_DENIED/);
  const foreign=x.f.tls.gateway.sessionAdapter('tenant-b').issueOwnerSession({subjectId:'synthetic:foreign',role:'reader',expiresAtMs:Date.now()+60000});
  for(const headers of [{...x.target.headers,cookie:foreign.cookieHeader},{...x.target.headers,origin:'https://foreign.invalid'},{...x.target.headers,'x-pan597-proof':'0'.repeat(64)},{...x.target.headers,'x-role':'reviewer'}])assert.throws(()=>x.owner.browserPairingV1(headers,{schemaVersion,operation:'claim',code:o.code,confirmation:'CONFIRM_RECEIVER_PAIRING'}));
  assert.equal(x.call(x.source,'read',{pairId:o.pairId}).state,'OFFERED');
 }finally{await x.close();}
});
test('605 source connection epoch and Pin/Dirty changes invalidate a confirmed link instead of silently rebinding it',async()=>{
 const x=await fixture();try{const p=pair(x);x.owner.register(x.source.headers,{...registration,previousSurfaceId:x.source.surface.surfaceId,previousProof:x.source.surface.surfaceProof});assert.equal(x.call(x.target,'read',{pairId:p.pairId}).state,'UNAVAILABLE');}finally{await x.close();}
 const y=await fixture();try{const p=pair(y),s=y.source.surface;y.owner.state(y.source.headers,{schemaVersion:'pansphaira.workspace-surface/state/v2',connectionEpoch:s.connectionEpoch,expectedGeneration:s.localGeneration,localGeneration:s.localGeneration+1,pinned:true,dirty:false});assert.equal(y.call(y.target,'read',{pairId:p.pairId}).state,'UNAVAILABLE');}finally{await y.close();}
});
test('605 real protected source and receiver logout withdraw live session rights; neither retained metadata nor a new same-subject session restores a link',async()=>{
 const {request527}=await import('../pan527/helpers.mjs');
 for(const side of ['source','target']){const x=await fixture();try{const p=pair(x),who=x[side],other=x[side==='source'?'target':'source'];const response=await request527(x.f.tls,'/t/tenant-a/workspace/logout',who.headers,'POST');assert.equal(response.status,200);assert.throws(()=>x.f.sessions.authenticate(who.headers),/SESSION_DENIED/);assert.equal(x.call(other,'read',{pairId:p.pairId}).state,'UNAVAILABLE');const newSession=x.register();assert.throws(()=>x.call(newSession,'read',{pairId:p.pairId}),/SCOPE_DENIED/);x.f.tls.gateway.server.closeAllConnections();}finally{await x.close();}}
});
test('605 native past-deadline guard, explicit new offer and lost owner witnesses are terminal, not code/session recovery',async()=>{
 const {nativeWorkspaceUiTaskOwnerConnectionV2}=await import('../../src/pan548/native-ui-task-projection-v2.mjs');const x=await fixture();let replacement;
 try{const db=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding).db,o=x.offer();db.prepare('UPDATE workspace_browser_pairs_v1 SET claim_until=? WHERE pair_id=?').run(Date.now()-1,o.pairId);assert.equal(x.call(x.source,'read',{pairId:o.pairId}).state,'EXPIRED');assert.throws(()=>x.call(x.target,'claim',{code:o.code,confirmation:'CONFIRM_RECEIVER_PAIRING'}),/CODE_DENIED/);
  const p=pair(x),next=x.offer();assert.equal(x.call(x.target,'read',{pairId:p.pairId}).state,'REVOKED');assert.equal(next.state,'OFFERED');
  const p2=pair(x);db.prepare('UPDATE workspace_browser_pairs_v1 SET expires_at=? WHERE pair_id=?').run(Date.now()-1,p2.pairId);assert.equal(x.call(x.target,'read',{pairId:p2.pairId}).state,'EXPIRED');
  const p3=pair(x);x.owner.close();const reader=createNativeSurfaceProjectionReaderV2({sessions:x.f.sessions,nativeReader:x.f.reader,analysisReader:null,readMonitor:()=>{throw Error('NO_MONITOR');}});replacement=createNativeWorkspaceSurfacesV2({sessions:x.f.sessions,contextSelection:x.f.context,tasks:x.tasks,reader});assert.equal(replacement.browserPairingV1(x.target.headers,{schemaVersion,operation:'read',pairId:p3.pairId}).state,'UNAVAILABLE');
 }finally{replacement?.close();await x.close();}
});
test('605 browser contract verifies native scope bytes and refuses a substituted field, data class, delivery authority or origin',async()=>{
 const {verifyWorkspaceBrowserPairV1}=await import('../../dist/packages/contracts/src/workspace-browser-pairing-v1.js');const x=await fixture();try{const p=pair(x);assert.equal((await verifyWorkspaceBrowserPairV1(p,x.f.tls.origin)).state,'PAIRED');for(const value of [{...p,projectionDeliveryGranted:true},{...p,scope:{...p.scope,fieldProjectionGrant:['customerSecret']}},{...p,scope:{...p.scope,dataClassGrant:'PUBLIC'}},{...p,scope:{...p.scope,objectId:'AP-PAN516-PARTIAL-01'}}])await assert.rejects(()=>verifyWorkspaceBrowserPairV1(value,x.f.tls.origin));await assert.rejects(()=>verifyWorkspaceBrowserPairV1(p,'https://foreign.invalid'));}finally{await x.close();}
});

// JO259457_RESTRICTED_NATIVE_DISPLAY_BEGIN
async function display606(x){const {createNativeWorkspaceDisplaySessionV1}=await import('../../src/pan597/native-display-session-v1.mjs');const owner=createNativeWorkspaceDisplaySessionV1({surfaces:x.owner,sessions:x.f.sessions}),u=new URL(x.f.tls.origin);u.port=String(Number(u.port)+1);owner.bindOrigin(u.origin);return owner;}
function displayCommand606(d,x,side,operation,pairId,extra={}){return d.command(x[side].headers,{schemaVersion:'pansphaira.workspace-display/command/v1',operation,pairId,...extra});}
function offerDisplay606(d,x,p){return displayCommand606(d,x,'source','offer',p.pairId,{scopeDigest:p.scopeDigest,dataClass:'ERV_INVOICE_REFERENCE_MINIMAL',fields:['invoiceId','revision','currency','invoiceAmountMinor','status'],confirmation:'CONFIRM_MINIMAL_NATIVE_PRESENTATION_SOURCE'});}
function activateDisplay606(d,x,p){const o=offerDisplay606(d,x,p),c=displayCommand606(d,x,'target','confirm',p.pairId,{sessionId:o.sessionId,grantDigest:o.grantDigest,confirmation:'CONFIRM_MINIMAL_NATIVE_PRESENTATION_RECEIVER'});return {offered:o,confirmed:c,principal:d.redeem(c.restrictedLaunch.ticket)};}
test('606 one native display principal requires separate source/receiver consent, exact field class, consumed ticket and native render digest; pair and old Surface fences remain unchanged',async()=>{
 const x=await fixture();let d;try{const p=pair(x);d=await display606(x);assert.equal(p.projectionDeliveryGranted,false);assert.equal(p.scope.fieldProjectionGrant,null);
  assert.throws(()=>displayCommand606(d,x,'target','offer',p.pairId,{scopeDigest:p.scopeDigest,dataClass:'ERV_INVOICE_REFERENCE_MINIMAL',fields:['invoiceId','revision','currency','invoiceAmountMinor','status'],confirmation:'CONFIRM_MINIMAL_NATIVE_PRESENTATION_SOURCE'}),/SOURCE_CONFIRMATION_DENIED/);
  assert.throws(()=>displayCommand606(d,x,'source','offer',p.pairId,{scopeDigest:p.scopeDigest,dataClass:'PUBLIC',fields:['invoiceId','revision','currency','invoiceAmountMinor','status'],confirmation:'CONFIRM_MINIMAL_NATIVE_PRESENTATION_SOURCE'}),/SOURCE_CONFIRMATION_DENIED/);
  assert.throws(()=>displayCommand606(d,x,'source','offer',p.pairId,{scopeDigest:p.scopeDigest,dataClass:'ERV_INVOICE_REFERENCE_MINIMAL',fields:['invoiceId','revision','currency','invoiceAmountMinor','status','leadingStore'],confirmation:'CONFIRM_MINIMAL_NATIVE_PRESENTATION_SOURCE'}),/SOURCE_CONFIRMATION_DENIED/);
  for(const maximumAgeMs of[999,60001])assert.throws(()=>displayCommand606(d,x,'source','offer',p.pairId,{scopeDigest:p.scopeDigest,dataClass:'ERV_INVOICE_REFERENCE_MINIMAL',fields:['invoiceId','revision','currency','invoiceAmountMinor','status'],confirmation:'CONFIRM_MINIMAL_NATIVE_PRESENTATION_SOURCE',maximumAgeMs}),/SOURCE_CONFIRMATION_DENIED/);const offered=offerDisplay606(d,x,p);assert.equal(offered.state,'OFFERED');assert.equal(offered.fieldProjectionGranted,false);assert.throws(()=>d.projection(x.source.headers.cookie),/PRINCIPAL_DENIED/);assert.throws(()=>displayCommand606(d,x,'source','confirm',p.pairId,{sessionId:offered.sessionId,grantDigest:offered.grantDigest,confirmation:'CONFIRM_MINIMAL_NATIVE_PRESENTATION_RECEIVER'}),/RECEIVER_CONFIRMATION_DENIED/);
  const confirmed=displayCommand606(d,x,'target','confirm',p.pairId,{sessionId:offered.sessionId,grantDigest:offered.grantDigest,confirmation:'CONFIRM_MINIMAL_NATIVE_PRESENTATION_RECEIVER'}),principal=d.redeem(confirmed.restrictedLaunch.ticket);assert.equal(principal.principalClass,'RESTRICTED_DISPLAY_ONLY');assert.throws(()=>d.redeem(confirmed.restrictedLaunch.ticket),/TICKET_DENIED/);
  const value=d.projection(principal.displayCapability),native=x.f.reader.read({tenantId:'tenant-a',objectId:p.scope.objectId,expectedRevision:p.scope.dataRevision});for(const k of['invoiceId','revision','currency','invoiceAmountMinor','status'])assert.equal(value.projection[k],native[k]);assert.deepEqual(Object.keys(value.projection).sort(),['schemaVersion','invoiceId','revision','currency','invoiceAmountMinor','status','readOnly','bookingAuthorityGranted','paymentOrderAuthorized'].sort());
  assert.throws(()=>d.acknowledge(principal.displayCapability,{schemaVersion:'pansphaira.workspace-display/render-ack/v1',sessionId:principal.sessionId,projectionDigest:'0'.repeat(64),domCommitted:true}),/ACK_DENIED/);const ack=d.acknowledge(principal.displayCapability,{schemaVersion:'pansphaira.workspace-display/render-ack/v1',sessionId:principal.sessionId,projectionDigest:value.projectionDigest,domCommitted:true});assert.equal(ack.nativeReadVerified,true);assert.equal(ack.humanPerceptionConfirmed,false);assert.equal(ack.physicalDeviceQualified,false);assert.equal(displayCommand606(d,x,'source','read',p.pairId).session.renderState,'RENDERED');
  assert.equal(x.call(x.source,'read',{pairId:p.pairId}).projectionDeliveryGranted,false);assert.equal(displayCommand606(d,x,'target','revoke',p.pairId,{sessionId:principal.sessionId}).state,'REVOKED');assert.throws(()=>d.projection(principal.displayCapability),/PRINCIPAL_DENIED/);
  const next=activateDisplay606(d,x,p);assert.notEqual(next.principal.sessionId,principal.sessionId);assert.notEqual(next.principal.displayCapability,principal.displayCapability);assert.throws(()=>d.projection(principal.displayCapability),/PRINCIPAL_DENIED/);
 }finally{d?.close();await x.close();}
});
test('606 actual source and receiver logout each revoke current native read authority without restoring old display metadata',async()=>{
 const {request527}=await import('../pan527/helpers.mjs');for(const side of['source','target']){const x=await fixture();let d;try{const p=pair(x);d=await display606(x);const a=activateDisplay606(d,x,p);assert.ok(d.projection(a.principal.displayCapability));const response=await request527(x.f.tls,'/t/tenant-a/workspace/logout',x[side].headers,'POST');assert.equal(response.status,200);assert.throws(()=>d.projection(a.principal.displayCapability),/PRINCIPAL_DENIED/);const other=side==='source'?'target':'source';assert.equal(displayCommand606(d,x,other,'read',p.pairId).session.state,'UNAVAILABLE');assert.throws(()=>d.redeem(a.confirmed.restrictedLaunch.ticket),/TICKET_DENIED/);x.f.tls.gateway.server.closeAllConnections();}finally{d?.close();await x.close();}}
});
test('606 native expiry, old principal after replacement, unknown operation and lost context witnesses are fail-closed',async()=>{
 const {nativeWorkspaceUiTaskOwnerConnectionV2}=await import('../../src/pan548/native-ui-task-projection-v2.mjs');const x=await fixture();let d;try{const p=pair(x);d=await display606(x);const a=activateDisplay606(d,x,p),db=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding).db;db.prepare('UPDATE workspace_display_sessions_v1 SET expires_at=? WHERE session_id=?').run(Date.now()-1,a.principal.sessionId);assert.equal(displayCommand606(d,x,'source','read',p.pairId).session.state,'EXPIRED');assert.throws(()=>d.projection(a.principal.displayCapability),/PRINCIPAL_DENIED/);assert.throws(()=>displayCommand606(d,x,'source','constructor',p.pairId),/INPUT_DENIED/);const b=activateDisplay606(d,x,p);x.call(x.source,'revoke',{pairId:p.pairId});assert.throws(()=>d.projection(b.principal.displayCapability),/PRINCIPAL_DENIED/);assert.equal(displayCommand606(d,x,'target','read',p.pairId).session.state,'UNAVAILABLE');}finally{d?.close();await x.close();}
});
// JO259457_RESTRICTED_NATIVE_DISPLAY_END
