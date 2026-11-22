// PAN548-owned signed projection/outbox on its existing task ledger. This is
// neither a second task engine nor a caller proof/signing/dispatch capability.
import {createHash,createHmac} from 'node:crypto';
import {modelFreeUiTaskReservationV1} from './native-ui-task-budget-v1.mjs';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
const digest=value=>createHash('sha256').update(canonicalJson(value)).digest('hex');
const fixedConstraints=Object.freeze({localOnly:true,noSend:true,personalSave:false,sharedPublish:false});
const phaseKinds=new Set(['INTENT_ACCEPTED','TARGET_ATTEMPTED','PROPOSAL_VALIDATED','TARGET_ACCEPTED','TARGET_RENDERED','INTENT_COMPLETED','OUTCOME_UNKNOWN','INTENT_REVOKED','USER_CONSTRAINT','CHECKPOINT_PREPARED','REQUEST_INCLUDED','RESULT_CHECKED','PLAN_INVALIDATED']);
const proofKinds=new Set(['PAN546_PREVIEW_VALIDATED','PAN597_DOCUMENT_ACCEPTED','PAN597_DOCUMENT_RENDERED']);
const id=value=>{if(typeof value!=='string'||!/^(?:display|invocation|checkpoint):[a-f0-9]{32}$/.test(value))throw Error('CONTEXT_JOURNAL_TASK_ID_DENIED');return value;};
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export function nativeUiContextTaskCoreV1(row){
 const command=JSON.parse(row.original_command);if(digest(command)!==row.request_digest)throw Error('CONTEXT_JOURNAL_TASK_BYTES_DENIED');
 let capability,argumentBytes,resourceRefs,scope,expiresAtMs,constraints;
 if(['pansphaira.workspace-invocation/effect-command/v1','pansphaira.workspace-invocation/effect-command/v2'].includes(command.schemaVersion)&&command.invocationId===row.command_id){
  if(command.schemaVersion.endsWith('/v2'))modelFreeUiTaskReservationV1(row);
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
function actionDescriptor(row,task){
 // ACT-02 #697 owner-issued versioned action descriptor of THIS attempt, derived
 // only from the durable original command bytes. Facts the owning task family does
 // not carry (checkpoint/display have no budget run or causal set) stay explicitly
 // null — never fabricated and never backfilled later from polling wallclock.
 const command=JSON.parse(row.original_command),args=JSON.parse(task.argumentBytes);
 const binding=command.budgetBinding??null,set=command.set??null,candidate=command.candidate??null;
 return {schemaVersion:'pansphaira.workspace-context/event-action/v1',taskId:task.taskId,
  runId:binding?binding.operationId:null,stepId:'step:'+row.command_id,attempt:1,
  capability:task.capability,operationSchemaVersion:typeof args.schemaVersion==="string"?args.schemaVersion:null,
  requestDigest:task.requestDigest,argumentDigest:task.argumentDigest,
  expectedRevisions:candidate?candidate.revisions??null:null,
  causal:set?{setId:set.setId,setDigest:set.setDigest}:null,
  idempotency:{operationId:binding?binding.operationId:null,taskRequestDigest:task.requestDigest},
  model:'NOT_RUN',executionAuthorityGranted:false};
}
export function createNativeUiContextJournalV1({db,transaction,binding,principal,readRow,bootEpoch}){
 db.exec(`CREATE TABLE IF NOT EXISTS workspace_ui_context_scope_v1(principal_digest TEXT PRIMARY KEY,privacy_epoch INTEGER NOT NULL CHECK(privacy_epoch>0),provider_epoch INTEGER NOT NULL CHECK(provider_epoch>0),revoked INTEGER NOT NULL CHECK(revoked IN(0,1))) STRICT;
 CREATE TABLE IF NOT EXISTS workspace_ui_context_outbox_v1(principal_digest TEXT NOT NULL,seq INTEGER NOT NULL,event_key TEXT NOT NULL,task_id TEXT NOT NULL,task_revision INTEGER NOT NULL,kind TEXT NOT NULL,privacy_epoch INTEGER NOT NULL,bytes TEXT NOT NULL,signature TEXT NOT NULL,PRIMARY KEY(principal_digest,seq),UNIQUE(principal_digest,event_key)) STRICT;
 CREATE TABLE IF NOT EXISTS workspace_ui_context_projection_v1(principal_digest TEXT NOT NULL,seq INTEGER NOT NULL,bytes TEXT NOT NULL,signature TEXT NOT NULL,PRIMARY KEY(principal_digest,seq)) STRICT;
 CREATE TABLE IF NOT EXISTS workspace_ui_context_event_clock_v1(principal_digest TEXT NOT NULL,seq INTEGER NOT NULL,bytes TEXT NOT NULL,signature TEXT NOT NULL,PRIMARY KEY(principal_digest,seq)) STRICT;
 CREATE TABLE IF NOT EXISTS workspace_ui_context_proofs_v1(proof_id TEXT PRIMARY KEY,principal_digest TEXT NOT NULL,task_id TEXT NOT NULL,kind TEXT NOT NULL,argument_digest TEXT NOT NULL,bytes TEXT NOT NULL,signature TEXT NOT NULL,UNIQUE(principal_digest,task_id,kind)) STRICT;
 CREATE TABLE IF NOT EXISTS workspace_ui_context_control_v1(id INTEGER PRIMARY KEY CHECK(id=1),owner_principal_digest TEXT NOT NULL,control_revision INTEGER NOT NULL CHECK(control_revision>=0),pause_state TEXT NOT NULL CHECK(pause_state IN('RUNNING','PAUSE_REQUESTED','PAUSING','PAUSED'))) STRICT;`);
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
 function append(a,row,kind,proofRef=null,epochOverride=null){
  if(!phaseKinds.has(kind))throw Error('CONTEXT_EVENT_KIND_DENIED');const task=nativeUiContextTaskCoreV1(row),s=scope(a),key=row.command_id+':'+row.revision+':'+kind;
  const prior=db.prepare('SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND event_key=?').get(a.digest,key);if(prior){verifiedEnvelope(prior,'event');return JSON.parse(prior.bytes);}
  const old=stream(a);if(old.head.seq>=4096)throw Error('CONTEXT_EVENT_CAPACITY_DENIED');
  const payload={requestDigest:task.requestDigest,argumentDigest:task.argumentDigest,capability:task.capability,constraints:task.constraints,resourceRefs:task.resourceRefs,state:row.state,resultDigest:row.result_json===null?null:digest(JSON.parse(row.result_json)),proofRef};
  const intent=kind==='INTENT_ACCEPTED'?null:db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='INTENT_ACCEPTED' ORDER BY seq LIMIT 1").get(a.digest,row.command_id),eventEpoch=epochOverride??(intent?verifiedEnvelope(intent,'event').privacyEpoch:s.privacy_epoch);
  const e={schemaVersion:'pansphaira.workspace-context/event/v1',seq:old.head.seq+1,eventKey:key,taskId:row.command_id,taskRevision:row.revision,kind,principalDigest:a.digest,privacyEpoch:eventEpoch,previousDigest:old.head.digest,action:actionDescriptor(row,task),payload},bytes=canonicalJson(e),signature=sign('event',bytes);
  // Additive clock sidecar of THIS producer append in the SAME owner transaction.
  // Legacy events are never backfilled from polling/restart wallclock.
  const sourceTimeMs=Date.now();if(!Number.isSafeInteger(sourceTimeMs)||sourceTimeMs<0||!Number.isSafeInteger(bootEpoch)||bootEpoch<1)throw Error('EVENT_SOURCE_CLOCK_OWNER_DENIED');
  const clockBytes=canonicalJson({schemaVersion:'pansphaira.workspace-event-projection/source-clock/v1',principalDigest:a.digest,sequence:e.seq,eventDigest:digest(e),sourceBootEpoch:bootEpoch,sourceTimeMs,unit:'COUNT'});
  db.prepare('INSERT INTO workspace_ui_context_outbox_v1 VALUES(?,?,?,?,?,?,?,?,?)').run(a.digest,e.seq,key,e.taskId,e.taskRevision,kind,eventEpoch,bytes,signature);db.prepare('INSERT INTO workspace_ui_context_projection_v1 VALUES(?,?,?,?)').run(a.digest,e.seq,bytes,signature);db.prepare('INSERT INTO workspace_ui_context_event_clock_v1 VALUES(?,?,?,?)').run(a.digest,e.seq,clockBytes,sign('event-clock',clockBytes));return e;
 }
 function origin(a,row){const intent=db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='INTENT_ACCEPTED' ORDER BY seq LIMIT 1").get(a.digest,row.command_id);if(!intent)throw Error('CONTEXT_OWNER_INTENT_REQUIRED');const e=verifiedEnvelope(intent,'event'),core=nativeUiContextTaskCoreV1(row);if(e.privacyEpoch!==intent.privacy_epoch)throw Error('CONTEXT_OWNER_PRIVACY_EPOCH_BYTES_CONFLICT');if(e.payload.requestDigest!==core.requestDigest||e.payload.argumentDigest!==core.argumentDigest||canonicalJson(e.payload.constraints)!==canonicalJson(core.constraints)||canonicalJson(e.payload.resourceRefs)!==canonicalJson(core.resourceRefs))throw Error('CONTEXT_OWNER_INTENT_BYTES_CONFLICT');
  if(row.state==='COMPLETED'){const final=db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='INTENT_COMPLETED' ORDER BY seq DESC LIMIT 1").get(a.digest,row.command_id);if(!final)throw Error('CONTEXT_COMPLETION_OUTBOX_REQUIRED');const completed=verifiedEnvelope(final,'event');if(completed.taskRevision!==row.revision||completed.payload.state!==row.state||completed.payload.resultDigest!==(row.result_json===null?null:digest(JSON.parse(row.result_json))))throw Error('CONTEXT_OWNER_RESULT_BYTES_CONFLICT');}
  return core;}
 function proofFor(a,ref){if(typeof ref!=='string'||!/^context-proof:[a-f0-9]{64}$/.test(ref))throw Error('CONTEXT_PROOF_REF_DENIED');const row=db.prepare('SELECT * FROM workspace_ui_context_proofs_v1 WHERE proof_id=?').get(ref);if(!row||row.principal_digest!==a.digest)throw Error('CONTEXT_PROOF_SCOPE_DENIED');const p=verifiedEnvelope(row,'proof');if(p.proofId!==ref||p.taskId!==row.task_id||p.kind!==row.kind||p.argumentDigest!==row.argument_digest||p.principalDigest!==a.digest)throw Error('CONTEXT_PROOF_BYTES_DENIED');return p;}
function boundProof(a,row,ref){const core=origin(a,row),p=proofFor(a,ref);
  const own=p.taskId===core.taskId,child=core.capability==='pan.workspace.document.display/v2'&&row.command_id.startsWith('invocation:')&&JSON.parse(core.argumentBytes).commandId===p.taskId&&p.kind.startsWith('PAN597_');
  if(!own&&!child||p.argumentDigest!==core.argumentDigest||own&&(p.originalRequestDigest!==core.requestDigest||canonicalJson(p.scope)!==canonicalJson(core.scope))||p.resourceRefs.objectRef.objectId!==core.resourceRefs.objectRef.objectId||p.resourceRefs.target.surfaceId!==core.resourceRefs.target.surfaceId)throw Error('CONTEXT_PROOF_TASK_BYTES_CONFLICT');return p;
 }
 // ACT-03 #698 owner-bound cooperative pause control. Durable in the SAME owner
 // database/transaction domain as the task rows and TARGET_ATTEMPTED append, so a
 // pause transaction and a dispatch transaction linearize on the owner DB; the
 // fence is never an in-memory UI flag. One finite control row, owner-principal
 // bound, CAS on control_revision: a stale revision never rewrites a newer state.
 function controlRow(){return db.prepare('SELECT * FROM workspace_ui_context_control_v1 WHERE id=1').get();}
 function controlSnapshot(){const c=controlRow();return freeze({schemaVersion:'pansphaira.workspace-invocation/control/v1',state:c?.pause_state??'RUNNING',controlRevision:c?.control_revision??0,ownerBound:c!==undefined});}
 function controlOwned(a){db.prepare('INSERT OR IGNORE INTO workspace_ui_context_control_v1 VALUES(1,?,?,?)').run(a.digest,0,'RUNNING');const c=controlRow();
  if(c.owner_principal_digest!==a.digest)throw Error('INVOCATION_CONTROL_SCOPE_DENIED');return c;}
 function pauseInsideOwnerTransaction(headers,expectedControlRevision){
  const a=actor(headers),c=controlOwned(a);
  if(expectedControlRevision!==c.control_revision)throw Error('INVOCATION_CONTROL_STALE_REVISION');
  let next=c.pause_state;
  if(c.pause_state==='RUNNING')next='PAUSE_REQUESTED';
  else if(c.pause_state==='PAUSE_REQUESTED'||c.pause_state==='PAUSING'){
   // Barrier honesty: PAUSED acknowledges that no NEW dispatch can cross the
   // fence (already fenced since the first transition). Work whose dispatch
   // transaction won the race keeps completing or staying OUTCOME_UNCONFIRMED
   // through the original #697 paths — it is neither rolled back nor undone —
   // so while such a genuinely TARGET_ATTEMPTED attempt is still open the owner
   // reports PAUSING. A merely accepted, never-dispatched step is unfired work
   // held behind the fence and must not postpone PAUSED forever.
   const attemptedOpen=db.prepare("SELECT count(*) n FROM workspace_ui_tasks_v2 t WHERE t.state='ACCEPTED' AND t.principal_digest=? AND EXISTS(SELECT 1 FROM workspace_ui_context_outbox_v1 e WHERE e.principal_digest=t.principal_digest AND e.task_id=t.command_id AND e.kind='TARGET_ATTEMPTED')").get(a.digest).n;
   next=attemptedOpen?'PAUSING':'PAUSED';
  }
  if(next!==c.pause_state)db.prepare('UPDATE workspace_ui_context_control_v1 SET pause_state=?,control_revision=control_revision+1 WHERE id=1').run(next);
  return controlSnapshot();
 }
 function resumeInsideOwnerTransaction(headers,expectedControlRevision){
  const a=actor(headers),c=controlOwned(a);
  if(expectedControlRevision!==c.control_revision)throw Error('INVOCATION_CONTROL_STALE_REVISION');
  if(c.pause_state!=='RUNNING')db.prepare("UPDATE workspace_ui_context_control_v1 SET pause_state='RUNNING',control_revision=control_revision+1 WHERE id=1").run();
  return controlSnapshot();
 }
 // Reads authenticate and, once an owner has bound the row, deny foreign actors
 // without leaking the owner identity; a never-bound journal reads as plain
 // RUNNING/revision 0 without claiming ownership for the reader.
 function controlRead(headers){const a=actor(headers),c=controlRow();
  if(c&&c.owner_principal_digest!==a.digest)throw Error('INVOCATION_CONTROL_SCOPE_DENIED');
  return controlSnapshot();}
 // Dispatch-fence guard called by the owning executor inside its begin/dispatch
 // transaction: only the control owner's own dispatch is fenced; a foreign or
 // control-less principal keeps its existing rights, and RUNNING keeps every
 // path identical to the pre-#698 behavior.
 function guardDispatch(headers){const a=actor(headers),c=controlRow();
  if(c&&c.owner_principal_digest===a.digest&&c.pause_state!=='RUNNING')throw Error('INVOCATION_PAUSED');}
 const journal=Object.freeze({
  actor,stream,origin,
  controlRead,guardDispatch,
  pause(headers,expectedControlRevision){return transaction(()=>journal.pauseInsideOwnerTransaction(headers,expectedControlRevision));},
  resume(headers,expectedControlRevision){return transaction(()=>journal.resumeInsideOwnerTransaction(headers,expectedControlRevision));},
  pauseInsideOwnerTransaction,resumeInsideOwnerTransaction,
  originPrivacyEpoch(headers,taskId){const a=actor(headers),intent=db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='INTENT_ACCEPTED' ORDER BY seq LIMIT 1").get(a.digest,taskId);if(!intent)throw Error('CONTEXT_OWNER_INTENT_REQUIRED');const e=verifiedEnvelope(intent,'event');if(e.privacyEpoch!==intent.privacy_epoch)throw Error('CONTEXT_OWNER_PRIVACY_EPOCH_BYTES_CONFLICT');return e.privacyEpoch;},
  sourceClock(a,e){
   const row=db.prepare('SELECT * FROM workspace_ui_context_event_clock_v1 WHERE principal_digest=? AND seq=?').get(a.digest,e.seq);if(!row)return null;
   if(typeof row.bytes!=='string'||sign('event-clock',row.bytes)!==row.signature)throw Error('EVENT_SOURCE_CLOCK_SIGNATURE_DENIED');
   const clock=JSON.parse(row.bytes);if(clock.schemaVersion!=='pansphaira.workspace-event-projection/source-clock/v1'||clock.principalDigest!==a.digest||clock.sequence!==e.seq||clock.eventDigest!==digest(e)||clock.unit!=='COUNT'||!Number.isSafeInteger(clock.sourceTimeMs)||clock.sourceTimeMs<0||!Number.isSafeInteger(clock.sourceBootEpoch)||clock.sourceBootEpoch<1||clock.sourceBootEpoch>bootEpoch)throw Error('EVENT_SOURCE_CLOCK_BYTES_DENIED');return freeze(clock);
  },
  sealProjection(bytes){if(typeof bytes!=='string')throw Error('CONTEXT_PROJECTION_BYTES_DENIED');return sign('projection',bytes);},
  verifyProjection(bytes,signature){if(typeof bytes!=='string'||sign('projection',bytes)!==signature)throw Error('CONTEXT_OWNER_PROJECTION_SIGNATURE_DENIED');return JSON.parse(bytes);},
  accepted(headers,taskId){const a=actor(headers),row=rowFor(a,taskId);return append(a,row,'INTENT_ACCEPTED');},
  // Read-only projection of the data-capability owner's OWN durable dispatch
  // fact: does a genuine TARGET_ATTEMPTED event exist for this actor's task?
  // Bound to actor/principal/current-epoch like every other owner read; never a
  // private DB read from an unbound transport level, never caller-supplied.
  targetAttempted(headers,taskId){const a=actor(headers),row=rowFor(a,taskId);return db.prepare("SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='TARGET_ATTEMPTED'").get(a.digest,row.command_id).n>0;},
  record(headers,taskId,kind,proofRef=null){if(kind==='TARGET_ATTEMPTED'||kind==='OUTCOME_UNKNOWN')throw Error('CONTEXT_EVENT_KIND_DENIED');const a=actor(headers),row=rowFor(a,taskId);const checkRow=['TARGET_RENDERED','INTENT_COMPLETED','RESULT_CHECKED'].includes(kind)&&row.state==='COMPLETED'?{...row,state:'ACCEPTED'}:row;origin(a,checkRow);if(proofRef!==null)boundProof(a,checkRow,proofRef);return append(a,row,kind,proofRef);},
  // Owner dispatcher boundary fact, callable only inside the owning executor
  // transaction after the live fence recheck: bound to the intent's origin epoch
  // so a later privacy revocation cannot erase the fact that a dispatch began.
  dispatchAttempted(headers,taskId){
   const a=actor(headers),row=rowFor(a,taskId);
   if(row.state!=='ACCEPTED')throw Error('CONTEXT_DISPATCH_STATE_DENIED');
   const intent=db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='INTENT_ACCEPTED' ORDER BY seq LIMIT 1").get(a.digest,row.command_id);
   if(!intent)throw Error('CONTEXT_OWNER_INTENT_REQUIRED');
   const e=verifiedEnvelope(intent,'event');
   if(e.privacyEpoch!==intent.privacy_epoch)throw Error('CONTEXT_OWNER_PRIVACY_EPOCH_BYTES_CONFLICT');
   return append({digest:a.digest},row,'TARGET_ATTEMPTED',null,e.privacyEpoch);
  },
  // Internal factual UNKNOWN writer for an already-dispatched owner attempt. The
  // caller passes the durable row and the intent's origin epoch, never a phase or
  // audience of its choice; the append stays in the caller's owner transaction.
  ownerOutcomeUnknown({principalDigest,privacyEpoch,row}){
   if(row.state!=='OUTCOME_UNCONFIRMED')throw Error('CONTEXT_OUTCOME_STATE_DENIED');
   const intent=db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='INTENT_ACCEPTED' ORDER BY seq LIMIT 1").get(principalDigest,row.command_id);
   if(!intent)throw Error('CONTEXT_OWNER_INTENT_REQUIRED');
   const e=verifiedEnvelope(intent,'event');
   if(e.privacyEpoch!==intent.privacy_epoch||e.privacyEpoch!==privacyEpoch||e.principalDigest!==principalDigest)throw Error('CONTEXT_OWNER_PRIVACY_EPOCH_BYTES_CONFLICT');
   return append({digest:principalDigest},row,'OUTCOME_UNKNOWN',null,privacyEpoch);
  },
  issueTargetProof(headers,taskId,kind,evidence){
   if(!proofKinds.has(kind))throw Error('CONTEXT_TARGET_PROOF_KIND_DENIED');const a=actor(headers),row=rowFor(a,taskId),core=origin(a,kind==='PAN597_DOCUMENT_RENDERED'&&row.state==='COMPLETED'?{...row,state:'ACCEPTED'}:row);
   const identity={taskId:core.taskId,principalDigest:a.digest,kind,argumentDigest:core.argumentDigest,evidence},proofId='context-proof:'+digest(identity),body={schemaVersion:'pansphaira.workspace-context/target-proof/v1',proofId,...identity,originalRequestDigest:core.requestDigest,scope:core.scope,resourceRefs:core.resourceRefs,constraints:core.constraints,issuedPrivacyEpoch:a.privacy.privacy_epoch},bytes=canonicalJson(body),signature=sign('proof',bytes);
   const prior=db.prepare('SELECT * FROM workspace_ui_context_proofs_v1 WHERE principal_digest=? AND task_id=? AND kind=?').get(a.digest,taskId,kind);if(prior){if(prior.bytes!==bytes||prior.signature!==signature)throw Error('CONTEXT_TARGET_PROOF_IDENTITY_CONFLICT');return proofFor(a,prior.proof_id);}
   db.prepare('INSERT INTO workspace_ui_context_proofs_v1 VALUES(?,?,?,?,?,?,?)').run(proofId,a.digest,taskId,kind,core.argumentDigest,bytes,signature);return body;
  },
  resolveProof(headers,taskId,ref){const a=actor(headers,{audit:true}),row=rowFor(a,taskId),proof=boundProof(a,row,ref);return freeze({...proof,independentOwnerRegisterVerified:true,executionAuthorityGranted:false});},
  // Unlike historical audit, a snapshot join must not provision missing scope
  // or admit a previous privacy epoch. The caller owns the read transaction.
  resolveProofInCurrentPrivacySnapshot(headers,taskId,ref){
   if(!db.isTransaction)throw Error('CONTEXT_PROOF_READ_SNAPSHOT_REQUIRED');
   const a=principal(headers),privacy=db.prepare('SELECT privacy_epoch,revoked FROM workspace_ui_context_scope_v1 WHERE principal_digest=?').get(a.digest);
   const deny=()=>{throw Error('CONTEXT_PROOF_RETIRED_OR_UNREGISTERED');};
   if(!privacy||privacy.revoked!==0)deny();
   function requireCurrentIntent(row){
    const intent=db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='INTENT_ACCEPTED' ORDER BY seq LIMIT 1").get(a.digest,row.command_id);
    if(!intent||intent.privacy_epoch!==privacy.privacy_epoch)deny();
    const event=verifiedEnvelope(intent,'event'),core=nativeUiContextTaskCoreV1(row),payload=event.payload;
    if(event.privacyEpoch!==privacy.privacy_epoch||event.principalDigest!==a.digest||event.taskId!==row.command_id||event.kind!=='INTENT_ACCEPTED'||
       !payload||payload.requestDigest!==core.requestDigest||payload.argumentDigest!==core.argumentDigest||payload.capability!==core.capability||
       canonicalJson(payload.constraints)!==canonicalJson(core.constraints)||canonicalJson(payload.resourceRefs)!==canonicalJson(core.resourceRefs))deny();
   }
   const row=rowFor(a,taskId);
   requireCurrentIntent(row);
   const proof=boundProof(a,row,ref);
   if(proof.issuedPrivacyEpoch!==privacy.privacy_epoch)deny();
   // A proof issued in this epoch does not renew its contributing display intent.
   if(proof.taskId!==row.command_id)requireCurrentIntent(rowFor(a,proof.taskId));
   return freeze({...proof,independentOwnerRegisterVerified:true,executionAuthorityGranted:false});
  },
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
