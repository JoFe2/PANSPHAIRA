// PAN606: one explicit restricted native invoice projection, composed on PAN597's
// existing ledger and live bilateral witnesses. Pairing remains no display grant.
import {createHash,randomBytes} from 'node:crypto';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {uiTaskClosedV2} from '../pan548/native-ui-task-projection-v2.mjs';
import {nativeWorkspaceSurfaceDisplayConnectionV1} from './native-surfaces-v2.mjs';
const owned=new WeakMap(),hash=v=>createHash('sha256').update(v).digest('hex');
export const nativeDisplayClassV1='ERV_INVOICE_REFERENCE_MINIMAL';
export const nativeDisplayFieldsV1=Object.freeze(['invoiceId','revision','currency','invoiceAmountMinor','status']);
const commandSchema='pansphaira.workspace-display/command/v1';
const effects={readOnly:true,executionAuthorityGranted:false,businessEffectProduced:false,modelAcceptance:false,audioAuthorityGranted:false,humanPerceptionConfirmed:false,physicalDeviceQualified:false};
const active=s=>['OFFERED','ACTIVE'].includes(s);
function projectionV1(snapshot){
 const p=snapshot.projection,d=p.data;
 if(p.kind!=='DOCUMENT'||p.routeId!=='pan.erv.document.v2'||d.invoiceId!==snapshot.scope.objectId||d.revision!==snapshot.scope.dataRevision||d.readOnly!==true||d.bookingAuthorityGranted!==false||d.paymentOrderAuthorized!==false||typeof d.currency!=='string'||!/^[A-Z]{3}$/.test(d.currency)||!Number.isSafeInteger(d.invoiceAmountMinor)||typeof d.status!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(d.status))throw Error('DISPLAY_FIELD_PROJECTION_DENIED');
 return Object.freeze({schemaVersion:'pansphaira.workspace-display/invoice-minimal/v1',invoiceId:d.invoiceId,revision:d.revision,currency:d.currency,invoiceAmountMinor:d.invoiceAmountMinor,status:d.status,readOnly:true,bookingAuthorityGranted:false,paymentOrderAuthorized:false});
}
export function createNativeWorkspaceDisplaySessionV1(options){
 const {surfaces,sessions}=uiTaskClosedV2(options,['surfaces','sessions'],'DISPLAY_OWNER_DENIED');
 const c=nativeWorkspaceSurfaceDisplayConnectionV1(surfaces,sessions?.binding),{db,transaction,bootEpoch,pairs}=c;let closed=false,displayOrigin=null;
 db.exec(`CREATE TABLE IF NOT EXISTS workspace_display_sessions_v1(
  session_id TEXT PRIMARY KEY,pair_id TEXT NOT NULL,source_id TEXT NOT NULL,target_id TEXT NOT NULL,
  grant_json TEXT NOT NULL,grant_digest TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN('OFFERED','ACTIVE','REVOKED','EXPIRED','UNAVAILABLE')),
  created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,boot_epoch INTEGER NOT NULL,
  ticket_digest TEXT,capability_digest TEXT,render_digest TEXT
 ) STRICT;`);
 transaction(()=>db.prepare("UPDATE workspace_display_sessions_v1 SET state='UNAVAILABLE',ticket_digest=NULL,capability_digest=NULL WHERE boot_epoch<>? AND state IN('OFFERED','ACTIVE')").run(bootEpoch));
 function live(){if(closed)throw Error('DISPLAY_OWNER_CLOSED');}
 function get(id){if(typeof id!=='string'||!/^presentation:[a-f0-9]{32}$/.test(id))throw Error('DISPLAY_ID_DENIED');const r=db.prepare('SELECT * FROM workspace_display_sessions_v1 WHERE session_id=?').get(id);if(!r)throw Error('DISPLAY_UNKNOWN_DENIED');return r;}
 function terminal(row,state){db.prepare('UPDATE workspace_display_sessions_v1 SET state=?,ticket_digest=NULL,capability_digest=NULL,render_digest=NULL WHERE session_id=?').run(state,row.session_id);return get(row.session_id);}
 function current(row){
  live();if(!active(row.state))return row;const now=Date.now();
  if(now<row.created_at||now>=row.expires_at)return terminal(row,'EXPIRED');
  try{if(row.boot_epoch!==bootEpoch||!displayOrigin)throw Error('DISPLAY_OWNER_STALE');const snapshot=pairs.presentationSnapshot(row.pair_id),g=JSON.parse(row.grant_json);if(snapshot.sourceSurfaceId!==row.source_id||snapshot.targetSurfaceId!==row.target_id||snapshot.scopeDigest!==g.pairScopeDigest||g.displayOrigin!==displayOrigin||hash(canonicalJson(projectionV1(snapshot)))!==g.projectionDigest)throw Error('DISPLAY_SOURCE_OR_RIGHTS_CHANGED');return row;}
  catch{return terminal(row,'UNAVAILABLE');}
 }
 function readback(row){const r=current(row),grant=JSON.parse(r.grant_json);return {schemaVersion:'pansphaira.workspace-display/readback/v1',sessionId:r.session_id,pairId:r.pair_id,state:r.state,sourceSurfaceId:r.source_id,targetSurfaceId:r.target_id,grant,grantDigest:r.grant_digest,expiresAtMs:r.expires_at,renderState:r.state==='ACTIVE'&&r.render_digest?'RENDERED':'NOT_RENDERED',fieldProjectionGranted:r.state==='ACTIVE',projectionDeliveryGranted:r.state==='ACTIVE',...effects};}
 function participant(headers,pairId){live();return pairs.presentationParticipant(headers,pairId);}
 function capability(value){live();if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw Error('DISPLAY_PRINCIPAL_DENIED');const row=db.prepare('SELECT * FROM workspace_display_sessions_v1 WHERE capability_digest=?').get(hash(value));if(!row)throw Error('DISPLAY_PRINCIPAL_DENIED');const r=current(row);if(r.state!=='ACTIVE'||!r.capability_digest)throw Error('DISPLAY_PRINCIPAL_DENIED');return r;}
 const owner=Object.freeze({
  // Code-only binding by the same TLS ingress, never an HTTP operation or URL input.
  bindOrigin(value){live();const u=new URL(value);if(displayOrigin!==null||u.origin!==value||u.protocol!=='https:'||value===sessions.origin||u.hostname!==new URL(sessions.origin).hostname||!u.port)throw Error('DISPLAY_ORIGIN_DENIED');displayOrigin=value;},
  command(headers,value){
   live();const op=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'operation')?.value:undefined;
   const fields={read:[],offer:['scopeDigest','dataClass','fields','confirmation'],confirm:['sessionId','grantDigest','confirmation'],revoke:['sessionId']};if(typeof op!=='string'||!Object.hasOwn(fields,op))throw Error('DISPLAY_INPUT_DENIED');const extra=fields[op];
   const optional=op==='offer'&&Object.hasOwn(value,'maximumAgeMs')?['maximumAgeMs']:[];const v=uiTaskClosedV2(value,['schemaVersion','operation','pairId',...extra,...optional],'DISPLAY_INPUT_DENIED');if(v.schemaVersion!==commandSchema)throw Error('DISPLAY_INPUT_DENIED');const p=participant(headers,v.pairId);
   if(op==='read'){const row=db.prepare('SELECT * FROM workspace_display_sessions_v1 WHERE pair_id=? ORDER BY rowid DESC LIMIT 1').get(v.pairId);return {schemaVersion:'pansphaira.workspace-display/status/v1',displayOrigin,session:row?readback(row):null,...effects};}
   if(op==='offer'){
    const maximumAgeMs=Object.hasOwn(v,'maximumAgeMs')?v.maximumAgeMs:60000;if(!Number.isSafeInteger(maximumAgeMs)||maximumAgeMs<1000||maximumAgeMs>60000)throw Error('DISPLAY_SOURCE_CONFIRMATION_DENIED');
    if(!displayOrigin||p.pair.state!=='PAIRED'||p.actorSurfaceId!==p.pair.sourceSurfaceId||v.scopeDigest!==p.pair.scopeDigest||v.dataClass!==nativeDisplayClassV1||canonicalJson(v.fields)!==canonicalJson(nativeDisplayFieldsV1)||v.confirmation!=='CONFIRM_MINIMAL_NATIVE_PRESENTATION_SOURCE')throw Error('DISPLAY_SOURCE_CONFIRMATION_DENIED');
    const snapshot=pairs.presentationSnapshot(v.pairId),projection=projectionV1(snapshot),now=Date.now(),expires=Math.min(now+maximumAgeMs,snapshot.expiresAtMs),id='presentation:'+randomBytes(16).toString('hex');
    const grant={schemaVersion:'pansphaira.workspace-display/field-grant/v1',sourceOrigin:sessions.origin,displayOrigin,workspaceId:sessions.binding.tenantId,pairId:v.pairId,pairScopeDigest:p.pair.scopeDigest,sourceSurfaceId:snapshot.sourceSurfaceId,targetSurfaceId:snapshot.targetSurfaceId,objectId:snapshot.scope.objectId,dataRevision:snapshot.scope.dataRevision,dataClass:nativeDisplayClassV1,fields:[...nativeDisplayFieldsV1],projectionDigest:hash(canonicalJson(projection)),expiresAtMs:expires};
    const bytes=canonicalJson(grant);transaction(()=>{const fresh=participant(headers,v.pairId);if(fresh.pair.state!=='PAIRED'||fresh.actorSurfaceId!==snapshot.sourceSurfaceId||fresh.pair.scopeDigest!==grant.pairScopeDigest)throw Error('DISPLAY_SOURCE_CHANGED');if(db.prepare('SELECT count(*) n FROM workspace_display_sessions_v1').get().n>=128)throw Error('DISPLAY_CAPACITY_DENIED');db.prepare("UPDATE workspace_display_sessions_v1 SET state='REVOKED',ticket_digest=NULL,capability_digest=NULL,render_digest=NULL WHERE pair_id=? AND state IN('OFFERED','ACTIVE')").run(v.pairId);db.prepare("INSERT INTO workspace_display_sessions_v1 VALUES(?,?,?,?,?,?,'OFFERED',?,?,?,NULL,NULL,NULL)").run(id,v.pairId,snapshot.sourceSurfaceId,snapshot.targetSurfaceId,bytes,hash(bytes),now,expires,bootEpoch);});return readback(get(id));
   }
   let row=get(v.sessionId);if(row.pair_id!==v.pairId||![row.source_id,row.target_id].includes(p.actorSurfaceId))throw Error('DISPLAY_SCOPE_DENIED');
   if(op==='revoke'){transaction(()=>{participant(headers,v.pairId);row=terminal(get(row.session_id),'REVOKED');});return readback(row);}
   row=current(row);if(op!=='confirm'||row.state!=='OFFERED'||p.actorSurfaceId!==row.target_id||v.grantDigest!==row.grant_digest||v.confirmation!=='CONFIRM_MINIMAL_NATIVE_PRESENTATION_RECEIVER')throw Error('DISPLAY_RECEIVER_CONFIRMATION_DENIED');
   const ticket=randomBytes(32).toString('hex');transaction(()=>{const fresh=participant(headers,v.pairId),r=current(get(row.session_id));if(fresh.pair.state!=='PAIRED'||fresh.actorSurfaceId!==r.target_id||r.state!=='OFFERED')throw Error('DISPLAY_RECEIVER_CONFIRMATION_DENIED');db.prepare("UPDATE workspace_display_sessions_v1 SET state='ACTIVE',ticket_digest=? WHERE session_id=? AND state='OFFERED'").run(hash(ticket),r.session_id);});return {...readback(get(row.session_id)),restrictedLaunch:{origin:displayOrigin,ticket}};
  },
  redeem(ticket){
   live();if(typeof ticket!=='string'||!/^[a-f0-9]{64}$/.test(ticket))throw Error('DISPLAY_TICKET_DENIED');let row=db.prepare('SELECT * FROM workspace_display_sessions_v1 WHERE ticket_digest=?').get(hash(ticket));if(!row)throw Error('DISPLAY_TICKET_DENIED');row=current(row);if(row.state!=='ACTIVE'||!row.ticket_digest)throw Error('DISPLAY_TICKET_DENIED');const secret=randomBytes(32).toString('hex');transaction(()=>{const fresh=current(get(row.session_id));if(fresh.state!=='ACTIVE'||fresh.ticket_digest!==hash(ticket))throw Error('DISPLAY_TICKET_DENIED');db.prepare('UPDATE workspace_display_sessions_v1 SET ticket_digest=NULL,capability_digest=? WHERE session_id=?').run(hash(secret),row.session_id);});return {schemaVersion:'pansphaira.workspace-display/principal/v1',sessionId:row.session_id,displayCapability:secret,principalClass:'RESTRICTED_DISPLAY_ONLY',expiresAtMs:row.expires_at,remainingLifetimeMs:Math.max(0,Math.min(60000,row.expires_at-Date.now())),...effects};
  },
  projection(secret){const row=capability(secret),snapshot=pairs.presentationSnapshot(row.pair_id),projection=projectionV1(snapshot),digest=hash(canonicalJson(projection));if(digest!==JSON.parse(row.grant_json).projectionDigest)throw Error('DISPLAY_FIELD_PROJECTION_DENIED');if(current(get(row.session_id)).state!=='ACTIVE')throw Error('DISPLAY_PRINCIPAL_DENIED');return {schemaVersion:'pansphaira.workspace-display/projection/v1',sessionId:row.session_id,principalClass:'RESTRICTED_DISPLAY_ONLY',dataClass:nativeDisplayClassV1,fields:[...nativeDisplayFieldsV1],projection,projectionDigest:digest,...effects};},
  acknowledge(secret,value){const v=uiTaskClosedV2(value,['schemaVersion','sessionId','projectionDigest','domCommitted'],'DISPLAY_ACK_DENIED');const r=capability(secret),p=owner.projection(secret);if(v.schemaVersion!=='pansphaira.workspace-display/render-ack/v1'||v.domCommitted!==true||v.sessionId!==r.session_id||v.projectionDigest!==p.projectionDigest)throw Error('DISPLAY_ACK_DENIED');transaction(()=>{capability(secret);db.prepare('UPDATE workspace_display_sessions_v1 SET render_digest=? WHERE session_id=?').run(p.projectionDigest,r.session_id);});return {schemaVersion:'pansphaira.workspace-display/render-receipt/v1',sessionId:r.session_id,projectionDigest:p.projectionDigest,clientReportedDomCommit:true,nativeReadVerified:true,...effects};},
  close(){if(closed)return;transaction(()=>db.prepare("UPDATE workspace_display_sessions_v1 SET state='UNAVAILABLE',ticket_digest=NULL,capability_digest=NULL,render_digest=NULL WHERE boot_epoch=? AND state IN('OFFERED','ACTIVE')").run(bootEpoch));closed=true;owned.delete(owner);}
 });owned.set(owner,{sessions,surfaces});return owner;
}
export const isNativeWorkspaceDisplaySessionV1=(owner,sessions,surfaces)=>owned.has(owner)&&owned.get(owner).sessions===sessions&&owned.get(owner).surfaces===surfaces;
