// One PAN604 code-registered read-only source from the SAME native PAN548 owner.
// Source clocks are signed at producer append; polls never mint source events.
import {randomBytes} from 'node:crypto';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {uiTaskClosedV2,uiTaskDigestV2,nativeWorkspaceUiTaskOwnerConnectionV2} from './native-ui-task-projection-v2.mjs';
import {isNativeWorkspaceContextSelectionV1} from './native-context-selection.mjs';
import {nativeUiContextTaskCoreV1} from './native-context-journal-v1.mjs';
const owned=new WeakMap(),SOURCE_ID='pan548.operative-events/v1',UNIT='COUNT';
const constraints=Object.freeze({localOnly:true,noSend:true,personalSave:false,sharedPublish:false});
const LIMITS=Object.freeze({maxReplayEvents:128,maxSamples:16,maxSubscriptions:64,maxSnapshotBytes:65536,leaseMs:5000});
function immutable(v){if(v&&typeof v==='object'){for(const x of Object.values(v))immutable(x);Object.freeze(v);}return v;}
function downsample(samples){
 if(samples.length<=LIMITS.maxSamples)return {samples,downsampled:false,downsampledRanges:[],resyncRequired:false};
 const keep=new Set([0,samples.length-1]),size=Math.ceil(samples.length/4);
 // Each bounded bucket keeps both extrema, never averages/smoothed curves.
 for(let start=0;start<samples.length;start+=size){const end=Math.min(samples.length,start+size);let min=start,max=start;for(let i=start;i<end;i++){if(samples[i].value!==null&&(samples[min].value===null||samples[i].value<samples[min].value))min=i;if(samples[i].value!==null&&(samples[max].value===null||samples[i].value>samples[max].value))max=i;}keep.add(min);keep.add(max);}
 for(let i=0;i<samples.length;i++)if(samples[i].quality!=='GOOD'||i>0&&(samples[i].quality!==samples[i-1].quality||samples[i].retained!==samples[i-1].retained)){keep.add(i);if(i>0)keep.add(i-1);}
 if(keep.size>LIMITS.maxSamples)return {samples:[],downsampled:false,downsampledRanges:[],resyncRequired:true};
 const selected=[...keep].sort((a,b)=>a-b),ranges=[];for(let i=1;i<selected.length;i++)if(selected[i]>selected[i-1]+1)ranges.push({from:samples[selected[i-1]+1].sequence,to:samples[selected[i]-1].sequence});
 return {samples:selected.map(i=>samples[i]),downsampled:true,downsampledRanges:ranges,resyncRequired:false};
}
export function createNativeWorkspaceReadonlyEventProjectionV1(options){
 const {sessions,tasks,contextSelection}=uiTaskClosedV2(options,['sessions','tasks','contextSelection'],'EVENT_SOURCE_OWNER_DENIED');
 const t=nativeWorkspaceUiTaskOwnerConnectionV2(tasks,sessions?.binding),j=t.contextJournal;
 if(t.sessions!==sessions||!isNativeWorkspaceContextSelectionV1(contextSelection,sessions.binding))throw Error('EVENT_SOURCE_OWNER_DENIED');
 let closed=false;const subscriptions=new Map();
 function actor(headers){try{return j.actor(headers);}catch(error){if(error.message==='CONTEXT_PRIVACY_REVOKED')throw Error('EVENT_SOURCE_SCOPE_REVOKED');throw error;}}
 function current(headers){
  if(closed||t.closed())throw Error('EVENT_SOURCE_OWNER_CLOSED');const a=actor(headers),stream=j.stream(a),observedTimeMs=Date.now();
  const sourceEpoch=uiTaskDigestV2({sourceId:SOURCE_ID,ledger:sessions.binding,principal:a.digest,bootEpoch:t.bootEpoch,privacyEpoch:a.privacy.privacy_epoch,providerEpoch:a.privacy.provider_epoch});
  const active=new Map();let unknownTaskCount=0,lastClock=null,lastSourceTime=null;const events=[];
  for(const e of stream.events){
   const redacted=e.privacyEpoch!==a.privacy.privacy_epoch,clock=j.sourceClock(a,e),sourceTimeMs=redacted?null:clock?.sourceTimeMs??null;
   const clockConflict=sourceTimeMs!==null&&(sourceTimeMs>observedTimeMs||lastSourceTime!==null&&sourceTimeMs<lastSourceTime);if(sourceTimeMs!==null)lastSourceTime=sourceTimeMs;
   const state=redacted?'UNKNOWN':e.payload.state??'UNKNOWN';if(!redacted)active.set(e.taskId,state);
   const retained=clock!==null&&clock.sourceBootEpoch!==t.bootEpoch;
   const quality=redacted||clock===null||clockConflict||state==='OUTCOME_UNCONFIRMED'||state==='UNKNOWN'?'UNKNOWN':retained?'STALE':'GOOD';
   const value=redacted?null:[...active.values()].filter(s=>['ACCEPTED','OUTCOME_UNCONFIRMED'].includes(s)).length;
   events.push({sequence:e.seq,kind:redacted?'PRIVACY_REDACTED':e.kind,revision:e.taskRevision,eventDigest:uiTaskDigestV2(e),state,value,unit:UNIT,sourceTimeMs,sourceBootEpoch:redacted?null:clock?.sourceBootEpoch??null,quality,retained,constraints:{...constraints}});lastClock=redacted?null:clock;
  }
  const rows=t.db.prepare('SELECT * FROM workspace_ui_tasks_v2 WHERE principal_digest=? ORDER BY command_id').all(a.digest);
  let value=0;for(const row of rows){nativeUiContextTaskCoreV1(row);const intent=stream.events.find(e=>e.taskId===row.command_id&&e.kind==='INTENT_ACCEPTED');if(!intent){unknownTaskCount++;continue;}j.origin(a,row);if(intent.privacyEpoch!==a.privacy.privacy_epoch)continue;if(['ACCEPTED','OUTCOME_UNCONFIRMED'].includes(row.state))value++;if(row.state==='OUTCOME_UNCONFIRMED')unknownTaskCount++;}
  const last=events.at(-1),retained=last?.retained??false,quality=unknownTaskCount>0?'UNKNOWN':last?.quality==='UNKNOWN'?'UNKNOWN':retained?'STALE':last?'GOOD':'PARTIAL';
  const again=actor(headers);if(again.digest!==a.digest||again.privacy.privacy_epoch!==a.privacy.privacy_epoch||again.privacy.provider_epoch!==a.privacy.provider_epoch)throw Error('EVENT_SOURCE_RESYNC_REQUIRED');
  return {principalDigest:a.digest,sourceEpoch,sourceRevision:stream.head.seq,sequence:stream.head.seq,sourceTimeMs:lastClock?.sourceTimeMs??null,observedTimeMs,timeQuality:lastClock?'SIGNED_PRODUCER_APPEND_CLOCK':'SOURCE_CLOCK_UNAVAILABLE',quality,connection:'CONNECTED',retained,unit:UNIT,value:quality==='UNKNOWN'?null:value,unknownTaskCount,authoritativeStreamHead:stream.head,events};
 }
 function cleanSubscriptions(now){for(const [key,v] of subscriptions)if(v.expiresAtMs<=now)subscriptions.delete(key);}
 function envelope(core){const snapshotBytes=canonicalJson(core);if(Buffer.byteLength(snapshotBytes)>LIMITS.maxSnapshotBytes)throw Error('EVENT_SOURCE_SNAPSHOT_LIMIT_DENIED');return immutable({...core,snapshotBytes,snapshotDigest:uiTaskDigestV2(core)});}
 const owner=Object.freeze({
  snapshot(headers,value){
   const req=uiTaskClosedV2(value,['schemaVersion','sourceId'],'EVENT_SOURCE_REQUEST_DENIED');if(req.schemaVersion!=='pansphaira.workspace-event-projection/snapshot-request/v1'||req.sourceId!==SOURCE_ID)throw Error('EVENT_SOURCE_REQUEST_DENIED');
   return t.transaction(()=>{const v=current(headers);cleanSubscriptions(v.observedTimeMs);if(subscriptions.size>=LIMITS.maxSubscriptions)throw Error('EVENT_SOURCE_SUBSCRIPTION_CAPACITY_DENIED');
    const expiresAtMs=v.observedTimeMs+LIMITS.leaseMs,nonce=randomBytes(16).toString('hex'),grant={principalDigest:v.principalDigest,sourceEpoch:v.sourceEpoch,sequence:v.sequence,unit:UNIT,expiresAtMs,nonce},snapshotId='event-snapshot:'+j.sealProjection(canonicalJson(grant));
    const historyGap=v.events.length>LIMITS.maxReplayEvents?{from:1,to:v.events.length-LIMITS.maxReplayEvents,reason:'BOUNDED_HISTORY_WINDOW'}:null,sampled=downsample(v.events.slice(-LIMITS.maxReplayEvents)),{principalDigest,...publicValue}=v;
    const core={schemaVersion:'pansphaira.workspace-event-projection/source-snapshot/v1',...publicValue,events:sampled.samples,sourceId:SOURCE_ID,sourceOwner:'pan548.signed-native-context-outbox/v1',snapshotId,snapshotExpiresAtMs:expiresAtMs,historyGap,historyQuality:historyGap||sampled.resyncRequired?'UNKNOWN':sampled.downsampled?'DOWNSAMPLED':'COMPLETE',downsampledRanges:sampled.downsampledRanges,resyncRequired:sampled.resyncRequired,constraints:{...constraints},limits:{...LIMITS},rawTextExport:false,audioExport:false,executionAuthorityGranted:false,model:'NOT_RUN',readOnlyProjectionOnly:true,deltaTransportImplemented:true};
    const result=envelope(core);subscriptions.set(snapshotId,{...grant,snapshotDigest:result.snapshotDigest});return result;
   });
  },
  delta(headers,value){
   const req=uiTaskClosedV2(value,['schemaVersion','sourceId','snapshotId','sourceEpoch','unit','cursor'],'EVENT_SOURCE_DELTA_REQUEST_DENIED');
   if(req.schemaVersion!=='pansphaira.workspace-event-projection/delta-request/v1'||req.sourceId!==SOURCE_ID||typeof req.snapshotId!=='string'||!/^event-snapshot:[a-f0-9]{64}$/.test(req.snapshotId)||typeof req.sourceEpoch!=='string'||!Number.isSafeInteger(req.cursor)||req.cursor<0||req.unit!==UNIT)throw Error('EVENT_SOURCE_DELTA_REQUEST_DENIED');
   return t.transaction(()=>{const v=current(headers),grant=subscriptions.get(req.snapshotId);cleanSubscriptions(v.observedTimeMs);
    if(!grant||grant.expiresAtMs<=v.observedTimeMs||grant.principalDigest!==v.principalDigest||grant.sourceEpoch!==v.sourceEpoch||req.sourceEpoch!==v.sourceEpoch||req.cursor<grant.sequence||req.cursor>v.sequence)throw Error('EVENT_SOURCE_RESYNC_REQUIRED');
    const input=v.events.filter(e=>e.sequence>req.cursor),flood=input.length>LIMITS.maxReplayEvents,sampled=flood?{samples:[],downsampled:false,downsampledRanges:[],resyncRequired:true}:downsample(input),resyncRequired=sampled.resyncRequired;
    const gap=resyncRequired&&v.sequence>req.cursor?{from:req.cursor+1,to:v.sequence,reason:flood?'REPLAY_LIMIT_FLOOD':'QUALITY_BOUNDARY_LIMIT'}:null,{principalDigest,events,...publicValue}=v;
    return envelope({schemaVersion:'pansphaira.workspace-event-projection/source-delta/v1',...publicValue,sourceId:SOURCE_ID,snapshotId:req.snapshotId,snapshotExpiresAtMs:grant.expiresAtMs,fromSequence:req.cursor,authorizedSnapshotDigest:grant.snapshotDigest,phase:resyncRequired?'RESYNC_REQUIRED':'DELTA',samples:sampled.samples,downsampled:sampled.downsampled,downsampledRanges:sampled.downsampledRanges,gap,resyncRequired,quality:resyncRequired?'UNKNOWN':v.quality,constraints:{...constraints},executionAuthorityGranted:false,model:'NOT_RUN',readOnlyProjectionOnly:true});
   });
  },
  close(){if(!closed){closed=true;subscriptions.clear();owned.delete(owner);}},
 });owned.set(owner,{sessions,tasks,contextSelection});return owner;
}
export const isNativeWorkspaceReadonlyEventProjectionV1=(owner,sessions,contextSelection)=>{const e=owned.get(owner);return !!e&&e.sessions===sessions&&e.contextSelection===contextSelection;};
