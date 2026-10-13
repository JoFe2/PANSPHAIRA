// PAN548-owned signed projection/outbox on its existing task ledger. This is
// neither a second task engine nor a caller proof/signing/dispatch capability.
import {createHash,createHmac} from 'node:crypto';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
const digest=value=>createHash('sha256').update(canonicalJson(value)).digest('hex');
const fixedConstraints=Object.freeze({localOnly:true,noSend:true,personalSave:false,sharedPublish:false});
const phaseKinds=new Set(['INTENT_ACCEPTED','PROPOSAL_VALIDATED','TARGET_ACCEPTED','TARGET_RENDERED','INTENT_COMPLETED','OUTCOME_UNKNOWN','INTENT_REVOKED','USER_CONSTRAINT','CHECKPOINT_PREPARED','REQUEST_INCLUDED','RESULT_CHECKED','PLAN_INVALIDATED']);
const proofKinds=new Set(['PAN546_PREVIEW_VALIDATED','PAN597_DOCUMENT_ACCEPTED','PAN597_DOCUMENT_RENDERED']);
const id=value=>{if(typeof value!=='string'||!/^(?:display|invocation|checkpoint):[a-f0-9]{32}$/.test(value))throw Error('CONTEXT_JOURNAL_TASK_ID_DENIED');return value;};
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export function nativeUiContextTaskCoreV1(row){
 const command=JSON.parse(row.original_command);if(digest(command)!==row.request_digest)throw Error('CONTEXT_JOURNAL_TASK_BYTES_DENIED');
 let capability,argumentBytes,resourceRefs,scope,expiresAtMs,constraints;
 if(command.schemaVersion==='pansphaira.workspace-invocation/effect-command/v1'&&command.invocationId===row.command_id){
  const c=command.candidate;if(!c||!['pan.workspace.view.preview/v1','pan.workspace.document.display/v2'].includes(c.capability))throw Error('CONTEXT_JOURNAL_CAPABILITY_DENIED');
  capability=c.capability;argumentBytes=c.argumentBytes;scope=c.scope;expiresAtMs=c.expiresAtMs;constraints=c.constraints;
  if(typeof argumentBytes!=='string'||digest(JSON.parse(argumentBytes))!==c.argumentDigest)throw Error('CONTEXT_JOURNAL_ARGUMENT_BYTES_DENIED');
  resourceRefs={objectRef:c.objectRef,documentRef:c.documentRef,target:{kind:c.targetRef.kind,surfaceId:c.targetRef.surfaceId}};
 }else if(command.schemaVersion==='pansphaira.workspace-surface/display-command/v2'&&command.commandId===row.command_id){
  capability='pan.workspace.document.display/v2';argumentBytes=canonicalJson(command);scope={sourceSurfaceId:command.sourceSurfaceId,targetSurfaceId:command.targetSurfaceId,sourceConnectionEpoch:command.sourceConnectionEpoch,targetConnectionEpoch:command.targetConnectionEpoch,targetLocalGeneration:command.targetLocalGeneration};expiresAtMs=command.expiresAtMs;constraints=fixedConstraints;
  resourceRefs={objectRef:{objectId:command.objectId},documentRef:{routeId:command.routeId,objectId:command.objectId,dataRevision:command.expectedRevision},target:{kind:'REGISTERED_BROWSER_SURFACE',surfaceId:command.targetSurfaceId}};
 }else if(command.schemaVersion==='pansphaira.workspace-context-projection/checkpoint-task/v1'&&command.commandId===row.command_id){
  capability='pan.workspace.context.checkpoint/v1';argumentBytes=canonicalJson(command.arguments);scope=command.scope;expiresAtMs=command.expiresAtMs;constraints=fixedConstraints;resourceRefs=command.resourceRefs;
 }else throw Error('CONTEXT_JOURNAL_TASK_SCHEMA_DENIED');
 if(canonicalJson(constraints)!==canonicalJson(fixedConstraints))throw Error('CONTEXT_JOURNAL_NO_SEND_DENIED');
 return {taskId:row.command_id,requestDigest:row.request_digest,argumentDigest:digest(JSON.parse(argumentBytes)),argumentBytes,capability,scope,expiresAtMs,constraints:{...fixedConstraints},resourceRefs};
}
export function createNativeUiContextJournalV1({db,transaction,binding,principal,readRow}){
 db.exec(`CREATE TABLE IF NOT EXISTS workspace_ui_context_scope_v1(principal_digest TEXT PRIMARY KEY,privacy_epoch INTEGER NOT NULL CHECK(privacy_epoch>0),provider_epoch INTEGER NOT NULL CHECK(provider_epoch>0),revoked INTEGER NOT NULL CHECK(revoked IN(0,1))) STRICT;
 CREATE TABLE IF NOT EXISTS workspace_ui_context_outbox_v1(principal_digest TEXT NOT NULL,seq INTEGER NOT NULL,event_key TEXT NOT NULL,task_id TEXT NOT NULL,task_revision INTEGER NOT NULL,kind TEXT NOT NULL,privacy_epoch INTEGER NOT NULL,bytes TEXT NOT NULL,signature TEXT NOT NULL,PRIMARY KEY(principal_digest,seq),UNIQUE(principal_digest,event_key)) STRICT;
 CREATE TABLE IF NOT EXISTS workspace_ui_context_projection_v1(principal_digest TEXT NOT NULL,seq INTEGER NOT NULL,bytes TEXT NOT NULL,signature TEXT NOT NULL,PRIMARY KEY(principal_digest,seq)) STRICT;
 CREATE TABLE IF NOT EXISTS workspace_ui_context_proofs_v1(proof_id TEXT PRIMARY KEY,principal_digest TEXT NOT NULL,task_id TEXT NOT NULL,kind TEXT NOT NULL,argument_digest TEXT NOT NULL,bytes TEXT NOT NULL,signature TEXT NOT NULL,UNIQUE(principal_digest,task_id,kind)) STRICT;`);
 const nativeKey=db.prepare('SELECT completion_key FROM settings WHERE id=1').get().completion_key;
 const sign=(domain,bytes)=>createHmac('sha256',nativeKey).update('pan548.context/v1\0'+domain+'\0'+canonicalJson(binding)+'\0'+bytes).digest('hex');
 function scope(a){db.prepare('INSERT OR IGNORE INTO workspace_ui_context_scope_v1 VALUES(?,1,1,0)').run(a.digest);return db.prepare('SELECT * FROM workspace_ui_context_scope_v1 WHERE principal_digest=?').get(a.digest);}
 function actor(headers,{audit=false}={}){const a=principal(headers),s=scope(a);if(!audit&&s.revoked)throw Error('CONTEXT_PRIVACY_REVOKED');return {...a,privacy:s};}
 function rowFor(a,taskId){const row=readRow(id(taskId));if(!row||row.principal_digest!==a.digest)throw Error('CONTEXT_JOURNAL_TASK_SCOPE_DENIED');return row;}
 function verifiedEnvelope(row,domain){if(typeof row?.bytes!=='string'||sign(domain,row.bytes)!==row.signature)throw Error('CONTEXT_OWNER_SIGNATURE_DENIED');return JSON.parse(row.bytes);}
 function stream(a){const rows=db.prepare('SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? ORDER BY seq').all(a.digest);let seq=0,previous='0'.repeat(64);const events=[];
  for(const row of rows){const e=verifiedEnvelope(row,'event');if(row.seq!==++seq||e.seq!==row.seq||e.principalDigest!==a.digest||e.previousDigest!==previous||e.eventKey!==row.event_key||e.taskId!==row.task_id||e.kind!==row.kind||e.taskRevision!==row.task_revision||e.privacyEpoch!==row.privacy_epoch)throw Error('CONTEXT_STREAM_GAP_OR_BYTES_DENIED');previous=digest(e);events.push(e);}
  return {events,head:{seq,digest:previous}};
 }
 function append(a,row,kind,proofRef=null){
  if(!phaseKinds.has(kind))throw Error('CONTEXT_EVENT_KIND_DENIED');const task=nativeUiContextTaskCoreV1(row),s=scope(a),key=row.command_id+':'+row.revision+':'+kind;
  const prior=db.prepare('SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND event_key=?').get(a.digest,key);if(prior){verifiedEnvelope(prior,'event');return JSON.parse(prior.bytes);}
  const old=stream(a);if(old.head.seq>=4096)throw Error('CONTEXT_EVENT_CAPACITY_DENIED');
  const payload={requestDigest:task.requestDigest,argumentDigest:task.argumentDigest,capability:task.capability,constraints:task.constraints,resourceRefs:task.resourceRefs,state:row.state,resultDigest:row.result_json===null?null:digest(JSON.parse(row.result_json)),proofRef};
  const intent=kind==='INTENT_ACCEPTED'?null:db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='INTENT_ACCEPTED' ORDER BY seq LIMIT 1").get(a.digest,row.command_id),eventEpoch=intent?verifiedEnvelope(intent,'event').privacyEpoch:s.privacy_epoch;
  const e={schemaVersion:'pansphaira.workspace-context/event/v1',seq:old.head.seq+1,eventKey:key,taskId:row.command_id,taskRevision:row.revision,kind,principalDigest:a.digest,privacyEpoch:eventEpoch,previousDigest:old.head.digest,payload},bytes=canonicalJson(e),signature=sign('event',bytes);
  db.prepare('INSERT INTO workspace_ui_context_outbox_v1 VALUES(?,?,?,?,?,?,?,?,?)').run(a.digest,e.seq,key,e.taskId,e.taskRevision,kind,eventEpoch,bytes,signature);db.prepare('INSERT INTO workspace_ui_context_projection_v1 VALUES(?,?,?,?)').run(a.digest,e.seq,bytes,signature);return e;
 }
 function origin(a,row){const intent=db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='INTENT_ACCEPTED' ORDER BY seq LIMIT 1").get(a.digest,row.command_id);if(!intent)throw Error('CONTEXT_OWNER_INTENT_REQUIRED');const e=verifiedEnvelope(intent,'event'),core=nativeUiContextTaskCoreV1(row);if(e.privacyEpoch!==intent.privacy_epoch)throw Error('CONTEXT_OWNER_PRIVACY_EPOCH_BYTES_CONFLICT');if(e.payload.requestDigest!==core.requestDigest||e.payload.argumentDigest!==core.argumentDigest||canonicalJson(e.payload.constraints)!==canonicalJson(core.constraints)||canonicalJson(e.payload.resourceRefs)!==canonicalJson(core.resourceRefs))throw Error('CONTEXT_OWNER_INTENT_BYTES_CONFLICT');
  if(row.state==='COMPLETED'){const final=db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='INTENT_COMPLETED' ORDER BY seq DESC LIMIT 1").get(a.digest,row.command_id);if(!final)throw Error('CONTEXT_COMPLETION_OUTBOX_REQUIRED');const completed=verifiedEnvelope(final,'event');if(completed.taskRevision!==row.revision||completed.payload.state!==row.state||completed.payload.resultDigest!==(row.result_json===null?null:digest(JSON.parse(row.result_json))))throw Error('CONTEXT_OWNER_RESULT_BYTES_CONFLICT');}
  return core;}
 function proofFor(a,ref){if(typeof ref!=='string'||!/^context-proof:[a-f0-9]{64}$/.test(ref))throw Error('CONTEXT_PROOF_REF_DENIED');const row=db.prepare('SELECT * FROM workspace_ui_context_proofs_v1 WHERE proof_id=?').get(ref);if(!row||row.principal_digest!==a.digest)throw Error('CONTEXT_PROOF_SCOPE_DENIED');const p=verifiedEnvelope(row,'proof');if(p.proofId!==ref||p.taskId!==row.task_id||p.kind!==row.kind||p.argumentDigest!==row.argument_digest||p.principalDigest!==a.digest)throw Error('CONTEXT_PROOF_BYTES_DENIED');return p;}
function boundProof(a,row,ref){const core=origin(a,row),p=proofFor(a,ref);
  const own=p.taskId===core.taskId,child=core.capability==='pan.workspace.document.display/v2'&&row.command_id.startsWith('invocation:')&&JSON.parse(core.argumentBytes).commandId===p.taskId&&p.kind.startsWith('PAN597_');
  if(!own&&!child||p.argumentDigest!==core.argumentDigest||own&&(p.originalRequestDigest!==core.requestDigest||canonicalJson(p.scope)!==canonicalJson(core.scope))||p.resourceRefs.objectRef.objectId!==core.resourceRefs.objectRef.objectId||p.resourceRefs.target.surfaceId!==core.resourceRefs.target.surfaceId)throw Error('CONTEXT_PROOF_TASK_BYTES_CONFLICT');return p;
 }
 const journal=Object.freeze({
  actor,stream,origin,
  sealProjection(bytes){if(typeof bytes!=='string')throw Error('CONTEXT_PROJECTION_BYTES_DENIED');return sign('projection',bytes);},
  verifyProjection(bytes,signature){if(typeof bytes!=='string'||sign('projection',bytes)!==signature)throw Error('CONTEXT_OWNER_PROJECTION_SIGNATURE_DENIED');return JSON.parse(bytes);},
  accepted(headers,taskId){const a=actor(headers),row=rowFor(a,taskId);return append(a,row,'INTENT_ACCEPTED');},
  record(headers,taskId,kind,proofRef=null){const a=actor(headers),row=rowFor(a,taskId);const checkRow=['TARGET_RENDERED','INTENT_COMPLETED','RESULT_CHECKED'].includes(kind)&&row.state==='COMPLETED'?{...row,state:'ACCEPTED'}:row;origin(a,checkRow);if(proofRef!==null)boundProof(a,checkRow,proofRef);return append(a,row,kind,proofRef);},
  issueTargetProof(headers,taskId,kind,evidence){
   if(!proofKinds.has(kind))throw Error('CONTEXT_TARGET_PROOF_KIND_DENIED');const a=actor(headers),row=rowFor(a,taskId),core=origin(a,kind==='PAN597_DOCUMENT_RENDERED'&&row.state==='COMPLETED'?{...row,state:'ACCEPTED'}:row);
   const identity={taskId:core.taskId,principalDigest:a.digest,kind,argumentDigest:core.argumentDigest,evidence},proofId='context-proof:'+digest(identity),body={schemaVersion:'pansphaira.workspace-context/target-proof/v1',proofId,...identity,originalRequestDigest:core.requestDigest,scope:core.scope,resourceRefs:core.resourceRefs,constraints:core.constraints,issuedPrivacyEpoch:a.privacy.privacy_epoch},bytes=canonicalJson(body),signature=sign('proof',bytes);
   const prior=db.prepare('SELECT * FROM workspace_ui_context_proofs_v1 WHERE principal_digest=? AND task_id=? AND kind=?').get(a.digest,taskId,kind);if(prior){if(prior.bytes!==bytes||prior.signature!==signature)throw Error('CONTEXT_TARGET_PROOF_IDENTITY_CONFLICT');return proofFor(a,prior.proof_id);}
   db.prepare('INSERT INTO workspace_ui_context_proofs_v1 VALUES(?,?,?,?,?,?,?)').run(proofId,a.digest,taskId,kind,core.argumentDigest,bytes,signature);return body;
  },
  resolveProof(headers,taskId,ref){const a=actor(headers,{audit:true}),row=rowFor(a,taskId),proof=boundProof(a,row,ref);return freeze({...proof,independentOwnerRegisterVerified:true,executionAuthorityGranted:false});},
  bestProof(headers,taskId){const a=actor(headers,{audit:true}),row=rowFor(a,taskId),core=origin(a,row),child=core.capability==='pan.workspace.document.display/v2'&&taskId.startsWith('invocation:')?JSON.parse(core.argumentBytes).commandId:taskId;const rows=db.prepare('SELECT * FROM workspace_ui_context_proofs_v1 WHERE principal_digest=? AND task_id IN(?,?) ORDER BY kind').all(a.digest,taskId,child);const proofs=rows.map(r=>journal.resolveProof(headers,taskId,r.proof_id));return proofs.find(p=>p.kind==='PAN597_DOCUMENT_RENDERED')??proofs.find(p=>p.kind==='PAN546_PREVIEW_VALIDATED')??proofs.find(p=>p.kind==='PAN597_DOCUMENT_ACCEPTED')??null;},
  audit(headers,taskId){const a=actor(headers,{audit:true}),row=rowFor(a,taskId);return freeze({task:nativeUiContextTaskCoreV1(row),events:stream(a).events.filter(e=>e.taskId===taskId),proof:journal.bestProof(headers,taskId),historicalAudit:true,executionAuthorityGranted:false});},
  repairInsideOwnerTransaction(headers){return (()=>{const a=actor(headers),current=stream(a);let repaired=0;
   for(const e of current.events){const source=db.prepare('SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND seq=?').get(a.digest,e.seq),copy=db.prepare('SELECT * FROM workspace_ui_context_projection_v1 WHERE principal_digest=? AND seq=?').get(a.digest,e.seq);if(copy&&(copy.bytes!==source.bytes||copy.signature!==source.signature))throw Error('CONTEXT_PROJECTION_BYTES_CONFLICT');if(!copy){db.prepare('INSERT INTO workspace_ui_context_projection_v1 VALUES(?,?,?,?)').run(a.digest,e.seq,source.bytes,source.signature);repaired++;}}
   return {repaired,streamHead:current.head,targetRedispatched:false};})();},
  repair(headers){return transaction(()=>journal.repairInsideOwnerTransaction(headers));},
  scope,
  revokeInsideOwnerTransaction(headers){return (()=>{const a=actor(headers,{audit:true});if(a.privacy.revoked)return {...a.privacy};db.prepare('UPDATE workspace_ui_context_scope_v1 SET privacy_epoch=privacy_epoch+1,provider_epoch=provider_epoch+1,revoked=1 WHERE principal_digest=?').run(a.digest);return {...scope(a)};})();},
  revoke(headers){return transaction(()=>journal.revokeInsideOwnerTransaction(headers));},
  reconnectInsideOwnerTransaction(headers){return (()=>{const a=actor(headers,{audit:true});db.prepare('UPDATE workspace_ui_context_scope_v1 SET privacy_epoch=privacy_epoch+1,provider_epoch=provider_epoch+1,revoked=0 WHERE principal_digest=?').run(a.digest);return {...scope(a)};})();},
  reconnect(headers){return transaction(()=>journal.reconnectInsideOwnerTransaction(headers));},
 });return journal;
}
