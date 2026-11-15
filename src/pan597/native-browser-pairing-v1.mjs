// PAN605's bounded browser-only prerequisite, on PAN597's SAME Surface ledger.
// A mutually confirmed link is NOT a display principal, field/data-class grant,
// task, delivery, business operation, model/audio consent or device attestation.
import {createHash,randomBytes} from 'node:crypto';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {uiTaskClosedV2} from '../pan548/native-ui-task-projection-v2.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const version='pansphaira.workspace-surface/browser-pair-command/v1';
const active=['OFFERED','CLAIMED','PAIRED'];
const noGrants=Object.freeze({businessEffectProduced:false,personalViewPersistenceProduced:false,executionAuthorityGranted:false,modelAcceptance:false,projectionDeliveryGranted:false,fieldProjectionGranted:false,physicalDeviceQualified:false,humanPerceptionConfirmed:false});
const fields={offer:['routeId','objectId','expectedRevision'],claim:['code','confirmation'],confirm:['pairId','targetSurfaceId','scopeDigest','confirmation'],read:['pairId'],list:[],revoke:['pairId']};
// Code-owner attachment only. HTTP can reach this solely through the branded
// current PAN597 owner and its existing authenticated origin/tab/proof checks.
export function createNativeBrowserPairHandshakeV1({db,transaction,bootEpoch,actor,livePeer,reader,binding}){
 let closed=false;
 // Credentials/proofs stay ONLY in current owner memory, never in SQLite,
 // browser readbacks, diagnostics, cookies, URLs, storage or another client.
 // Restart/replacement loses witnesses and therefore invalidates old links.
 const witnesses=new Map();
 db.exec(`CREATE TABLE IF NOT EXISTS workspace_browser_pairs_v1(
  pair_id TEXT PRIMARY KEY,code_digest TEXT,source_id TEXT NOT NULL,target_id TEXT,
  scope_json TEXT NOT NULL,scope_digest TEXT NOT NULL,source_fence TEXT NOT NULL,target_fence TEXT,
  status TEXT NOT NULL CHECK(status IN('OFFERED','CLAIMED','PAIRED','REVOKED','EXPIRED','UNAVAILABLE')),
  boot_epoch INTEGER NOT NULL,created_at INTEGER NOT NULL,claim_until INTEGER NOT NULL,expires_at INTEGER NOT NULL
 ) STRICT;
 CREATE TABLE IF NOT EXISTS workspace_browser_pair_attempts_v1(session_id TEXT PRIMARY KEY,window_start INTEGER NOT NULL,attempts INTEGER NOT NULL) STRICT;`);
 transaction(()=>db.prepare("UPDATE workspace_browser_pairs_v1 SET status='UNAVAILABLE',code_digest=NULL WHERE boot_epoch<>? AND status IN('OFFERED','CLAIMED','PAIRED')").run(bootEpoch));
 function get(pairId){if(typeof pairId!=='string'||!/^pair:[a-f0-9]{32}$/.test(pairId))throw Error('BROWSER_PAIR_ID_DENIED');return db.prepare('SELECT * FROM workspace_browser_pairs_v1 WHERE pair_id=?').get(pairId);}
 function fence(a){return {surfaceId:a.row.surface_id,principalDigest:a.digest,sessionId:a.binding.sessionId,tabId:a.binding.tabId,connectionEpoch:a.row.connection_epoch,localGeneration:a.row.local_generation,contextEpoch:a.row.context_epoch,revisionDigest:a.row.revision_digest};}
 function checkActor(headers){if(closed)throw Error('BROWSER_PAIR_OWNER_CLOSED');const a=actor(headers);if(headers.origin!==binding.origin)throw Error('BROWSER_PAIR_ORIGIN_DENIED');livePeer(headers,a.row);if(a.row.pinned||a.row.dirty)throw Error('BROWSER_PAIR_LOCAL_GUARD');return a;}
 function checkWitness(headers,expected){const a=checkActor(headers);if(canonicalJson(fence(a))!==expected)throw Error('BROWSER_PAIR_CONNECTION_STALE');return a;}
 function terminal(row,state){db.prepare('UPDATE workspace_browser_pairs_v1 SET status=?,code_digest=NULL WHERE pair_id=?').run(state,row.pair_id);witnesses.delete(row.pair_id);return get(row.pair_id);}
 function current(row){
  if(!active.includes(row.status))return row;
  const now=Date.now();
  if(now<row.created_at||now>=row.expires_at||row.status==='OFFERED'&&now>=row.claim_until)return terminal(row,'EXPIRED');
  const w=witnesses.get(row.pair_id);
  try{
   if(row.boot_epoch!==bootEpoch||!w||w.scopeJson!==row.scope_json)throw Error('BROWSER_PAIR_CONNECTION_STALE');
   const source=checkWitness(w.sourceHeaders,row.source_fence),scope=JSON.parse(row.scope_json),selector={routeId:scope.routeId,objectId:scope.objectId,expectedRevision:scope.dataRevision};
   const p=reader.read(w.sourceHeaders,selector,source.binding);if(p.projectionDigest!==scope.projectionDigest)throw Error('BROWSER_PAIR_SOURCE_CHANGED');
   if(row.target_id){if(!w.targetHeaders)throw Error('BROWSER_PAIR_CONNECTION_STALE');const target=checkWitness(w.targetHeaders,row.target_fence);if(source.binding.sessionId===target.binding.sessionId)throw Error('BROWSER_PAIR_OWN_LOGIN_REQUIRED');if(reader.read(w.targetHeaders,selector,target.binding).projectionDigest!==scope.projectionDigest)throw Error('BROWSER_PAIR_RECIPIENT_READ_DENIED');}
   return row;
  }catch{return terminal(row,'UNAVAILABLE');}
 }
 function permitted(a,row){if(!row||![row.source_id,row.target_id].includes(a.row.surface_id))throw Error('BROWSER_PAIR_SCOPE_DENIED');return row;}
 function readback(row,code){const r=current(row),scope=JSON.parse(r.scope_json);return {schemaVersion:'pansphaira.workspace-surface/browser-pair-readback/v1',pairId:r.pair_id,state:r.status,sourceSurfaceId:r.source_id,targetSurfaceId:r.target_id,scope,scopeDigest:r.scope_digest,claimExpiresAtMs:r.claim_until,expiresAtMs:r.expires_at,...(code===undefined?{}:{code}),...noGrants};}
 function countAttempt(a){
  // Commit BEFORE checking the code: throwing in the same SQLite transaction
  // must not roll back failed attempts and accidentally remove the limit.
  transaction(()=>{const now=Date.now(),key=a.binding.sessionId,prior=db.prepare('SELECT * FROM workspace_browser_pair_attempts_v1 WHERE session_id=?').get(key);
   if(prior&&(now<prior.window_start||now-prior.window_start<60000&&prior.attempts>=5))throw Error('BROWSER_PAIR_ATTEMPT_LIMIT');
   if(!prior&&db.prepare('SELECT count(*) n FROM workspace_browser_pair_attempts_v1').get().n>=256)throw Error('BROWSER_PAIR_ATTEMPT_LIMIT');
   const same=prior&&now-prior.window_start<60000;db.prepare('INSERT INTO workspace_browser_pair_attempts_v1 VALUES(?,?,?) ON CONFLICT(session_id)DO UPDATE SET window_start=excluded.window_start,attempts=excluded.attempts').run(key,same?prior.window_start:now,same?prior.attempts+1:1);
  });
 }
 function call(headers,value){
  if(closed)throw Error('BROWSER_PAIR_OWNER_CLOSED');
  const descriptors=value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype?Object.getOwnPropertyDescriptors(value):null;
  const operation=descriptors?.operation?.value;
  if(typeof operation!=='string'||!Object.hasOwn(fields,operation))throw Error('BROWSER_PAIR_INPUT_DENIED');
  const c=uiTaskClosedV2(value,['schemaVersion','operation',...fields[operation]],'BROWSER_PAIR_INPUT_DENIED');if(c.schemaVersion!==version)throw Error('BROWSER_PAIR_INPUT_DENIED');
  const a=checkActor(headers);
  if(operation==='offer'){
   if(c.routeId!=='pan.erv.document.v2'||typeof c.objectId!=='string'||!Number.isSafeInteger(c.expectedRevision)||c.expectedRevision<0)throw Error('BROWSER_PAIR_DOCUMENT_SCOPE_DENIED');
   const projection=reader.read(headers,{routeId:c.routeId,objectId:c.objectId,expectedRevision:c.expectedRevision},a.binding);
   const scope={schemaVersion:'pansphaira.workspace-surface/browser-pair-scope/v1',origin:binding.origin,workspaceId:binding.tenantId,routeId:projection.routeId,objectId:projection.objectId,dataRevision:projection.dataRevision,projectionDigest:projection.projectionDigest,fieldProjectionGrant:null,dataClassGrant:null};
   const scopeJson=canonicalJson(scope),pairId='pair:'+randomBytes(16).toString('hex'),code=randomBytes(10).toString('hex'),now=Date.now();
   transaction(()=>{checkActor(headers);if(db.prepare('SELECT count(*) n FROM workspace_browser_pairs_v1').get().n>=128)throw Error('BROWSER_PAIR_CAPACITY_DENIED');db.prepare("UPDATE workspace_browser_pairs_v1 SET status='REVOKED',code_digest=NULL WHERE source_id=? AND status IN('OFFERED','CLAIMED','PAIRED')").run(a.row.surface_id);db.prepare("INSERT INTO workspace_browser_pairs_v1 VALUES(?,?,?,NULL,?,?,?,NULL,'OFFERED',?,?,?,?)").run(pairId,hash(code),a.row.surface_id,scopeJson,hash(scopeJson),canonicalJson(fence(a)),bootEpoch,now,now+60000,now+300000);});
   for(const[key,w]of witnesses)if(w.sourceId===a.row.surface_id)witnesses.delete(key);
   witnesses.set(pairId,{sourceId:a.row.surface_id,sourceHeaders:Object.freeze({...headers}),targetHeaders:null,scopeJson});return readback(get(pairId),code);
  }
  if(operation==='claim'){
   countAttempt(a);
   if(typeof c.code!=='string'||!/^[a-f0-9]{20}$/.test(c.code)||c.confirmation!=='CONFIRM_RECEIVER_PAIRING')throw Error('BROWSER_PAIR_CODE_DENIED');
   let row=db.prepare("SELECT * FROM workspace_browser_pairs_v1 WHERE code_digest=? AND status='OFFERED'").get(hash(c.code));if(!row)throw Error('BROWSER_PAIR_CODE_DENIED');row=current(row);if(row.status!=='OFFERED')throw Error('BROWSER_PAIR_CODE_DENIED');
   const w=witnesses.get(row.pair_id),source=checkWitness(w.sourceHeaders,row.source_fence),scope=JSON.parse(row.scope_json);
   if(source.binding.sessionId===a.binding.sessionId||source.row.surface_id===a.row.surface_id)throw Error('BROWSER_PAIR_OWN_LOGIN_REQUIRED');
   if(reader.read(headers,{routeId:scope.routeId,objectId:scope.objectId,expectedRevision:scope.dataRevision},a.binding).projectionDigest!==scope.projectionDigest)throw Error('BROWSER_PAIR_RECIPIENT_READ_DENIED');
   transaction(()=>{checkActor(headers);if(get(row.pair_id).status!=='OFFERED')throw Error('BROWSER_PAIR_CODE_DENIED');db.prepare("UPDATE workspace_browser_pairs_v1 SET status='CLAIMED',code_digest=NULL,target_id=?,target_fence=? WHERE pair_id=?").run(a.row.surface_id,canonicalJson(fence(a)),row.pair_id);});
   w.targetHeaders=Object.freeze({...headers});return readback(get(row.pair_id));
  }
  if(operation==='list'){
   const rows=db.prepare('SELECT * FROM workspace_browser_pairs_v1 WHERE source_id=? OR target_id=? ORDER BY rowid DESC LIMIT 8').all(a.row.surface_id,a.row.surface_id);
   return {schemaVersion:'pansphaira.workspace-surface/browser-pair-list/v1',pairs:rows.map(row=>readback(row)),budget:{maxPairs:128,claimLifetimeMs:60000,maxAttemptsPerAuthenticatedSessionPerMinute:5,maxPairedLifetimeMs:300000,returnedPairs:8},...noGrants};
  }
  let row=permitted(a,get(c.pairId));
  if(operation==='revoke')return readback(terminal(row,'REVOKED'));
  row=current(row);
  if(operation==='confirm'){
   if(row.source_id!==a.row.surface_id||!['CLAIMED','PAIRED'].includes(row.status)||c.targetSurfaceId!==row.target_id||c.scopeDigest!==row.scope_digest||c.confirmation!=='CONFIRM_SOURCE_PAIRING')throw Error('BROWSER_PAIR_SOURCE_CONFIRMATION_DENIED');
   transaction(()=>{checkActor(headers);if(current(get(row.pair_id)).status!=='CLAIMED'&&get(row.pair_id).status!=='PAIRED')throw Error('BROWSER_PAIR_SOURCE_CONFIRMATION_DENIED');db.prepare("UPDATE workspace_browser_pairs_v1 SET status='PAIRED' WHERE pair_id=?").run(row.pair_id);});
   return readback(get(row.pair_id));
  }
  return readback(row);
 }
 // Code-only attachment for the separate PAN606 display principal. Neither
 // method is a browser-pair operation, field grant or cross-session Surface call.
 function presentationParticipant(headers,pairId){const a=checkActor(headers),row=permitted(a,get(pairId));return {actorSurfaceId:a.row.surface_id,pair:readback(row)};}
 function presentationSnapshot(pairId){
  const row=current(get(pairId));if(row.status!=='PAIRED')throw Error('DISPLAY_PAIR_NOT_CURRENT');const w=witnesses.get(row.pair_id);if(!w?.targetHeaders)throw Error('DISPLAY_PAIR_NOT_CURRENT');
  const source=checkWitness(w.sourceHeaders,row.source_fence),target=checkWitness(w.targetHeaders,row.target_fence),scope=JSON.parse(row.scope_json),selector={routeId:scope.routeId,objectId:scope.objectId,expectedRevision:scope.dataRevision};
  const projection=reader.read(w.sourceHeaders,selector,source.binding),recipient=reader.read(w.targetHeaders,selector,target.binding);
  if(projection.projectionDigest!==scope.projectionDigest||recipient.projectionDigest!==scope.projectionDigest||current(get(pairId)).status!=='PAIRED')throw Error('DISPLAY_PAIR_NOT_CURRENT');
  return {sourceSurfaceId:row.source_id,targetSurfaceId:row.target_id,scope,scopeDigest:row.scope_digest,expiresAtMs:row.expires_at,projection};
 }
 return Object.freeze({call,presentationParticipant,presentationSnapshot,close(){closed=true;witnesses.clear();}});
}
