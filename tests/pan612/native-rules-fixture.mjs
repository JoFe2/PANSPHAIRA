import assert from 'node:assert/strict';
import {fixture} from '../pan607/native-fixture.mjs';
export {fixture};
import {createNativeWorkspaceRulesVerticalV1} from '../../src/pan548/native-rules-vertical-v1.mjs';
const registration={schemaVersion:'pansphaira.workspace-surface/register/v2',previousSurfaceId:null,previousProof:null,localGeneration:1,pinned:false,dirty:false};
export async function actualTargets(x){
 const target=x.f.tab(x.tab.headers),surface=x.surfaces.register(target.headers,registration);target.headers={...target.headers,'x-pan597-surface':surface.surfaceId,'x-pan597-proof':surface.surfaceProof};
 const r=x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Zeige das ausgewählte Dokument rechts'},context:x.f.verification(x.tab),selectedCardId:null,targetSurfaceId:surface.surfaceId}),s=r.set,c=s.candidates.find(m=>m.candidateId===s.selectedCandidateId),a=x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:s.setId,requestDigest:s.requestDigest,setDigest:s.setDigest,candidateId:c.candidateId,argumentDigest:c.argumentDigest,policyRef:s.policyRef});
 const result=x.invocations.execute(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:a.invocationId,admissionToken:a.admissionToken,requestDigest:a.requestDigest,setDigest:a.setDigest,candidateId:a.candidateId,argumentDigest:a.argumentDigest,policyRef:a.policyRef}),command=result.result.delivery.originalCommand;
 x.surfaces.events(target.headers,{schemaVersion:'pansphaira.workspace-surface/events/v2',cursor:0});const loaded=x.surfaces.load(target.headers,{schemaVersion:'pansphaira.workspace-surface/load/v2',commandId:command.commandId});const permit=x.surfaces.beforeCommit(target.headers,{schemaVersion:'pansphaira.workspace-surface/before-dom/v2',commandId:command.commandId,readToken:loaded.readToken,projectionDigest:loaded.projection.projectionDigest,localGeneration:1});
 const ack=x.surfaces.acknowledge(target.headers,{schemaVersion:'pansphaira.workspace-surface/render-ack/v2',commandId:command.commandId,commitToken:permit.commitToken,projectionDigest:loaded.projection.projectionDigest,localGeneration:1,contextEpoch:permit.surface.contextEpoch,domCommitted:true});assert.equal(ack.status,'RENDERED');
 const preview=x.preview();assert.equal(preview.result.phase,'PREVIEW_VALIDATED');x.projection.reconcile(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/reconcile/v1'});
 return {documentTaskId:command.commandId,previewTaskId:preview.invocationId,documentInvocationId:a.invocationId};
}
export function owner(x){return createNativeWorkspaceRulesVerticalV1({sessions:x.f.sessions,tasks:x.tasks,contextSelection:x.f.context,projection:x.projection});}
export function request(x,ids){return {schemaVersion:'pansphaira.workspace-rules-vertical/prepare/v1',documentTaskId:ids.documentTaskId,previewTaskId:ids.previewTaskId,context:x.f.verification(x.tab),boundary:'TURN',previousRequestId:null};}
