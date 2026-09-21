import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as a from '../dist/src/cks-12/kaleidosphere-candidate-quarantine.js';
const rawArtifactBytes=readFileSync('tests/fixtures/cks-analytics/projection-v1.json');
const candidate=JSON.parse(readFileSync('tests/fixtures/cks-analytics/native-forward-current-candidate-v1.json'));
const qualifiedHeads={pansphaira:'7f662672bfc45087342f23e5c589d43598f5c20d',kaleidoSphere:'792e5e38cd4fb612ee034b3edc62aa8b4f58fe0f'};
test('forward qualification denies environment substitution',()=>{
 const altered=input(); altered.candidate.bindings.environmentSha256='0'.repeat(64);
 assert.equal(a.adjudicateNativeForwardCandidateV1(altered).outcome,'DENIED');
});
for (const [label, mutate] of [
 ['commit', x=>{x.candidate.bindings.kaleidosphereHead.commitOid='0'.repeat(40);}],
 ['tree', x=>{x.candidate.bindings.kaleidosphereHead.treeOid='0'.repeat(40);}],
 ['claim', x=>{x.candidate.claims.computed.nodeCount+=1;}],
 ['authority', x=>{x.candidate.authority.publish=true;}],
 ['transport', x=>{x.canonicalTransportBytes=Buffer.from('{}');}],
 ['envelope head', x=>{x.qualifiedHeads={...qualifiedHeads,kaleidoSphere:'0'.repeat(40)};}],
 ['caller profile', x=>{x.profile={...qualifiedHeads};}],
]) test(`forward qualification denies ${label} substitution`,()=>{
 const altered=input();mutate(altered);
 assert.equal(a.adjudicateNativeForwardCandidateV1(altered).outcome,'DENIED');
});
test('forward qualification preserves independent unknown restriction',()=>{
 const altered=input();altered.context=a.createNativeAdjudicationContextV1({contextId:'pansphaira:forward-unknown',unknown:true});
 assert.equal(a.adjudicateNativeForwardCandidateV1(altered).outcome,'RESTRICTED');
});
const input=()=>({rawArtifactBytes,canonicalTransportBytes:a.nativeTransportBytesV1(rawArtifactBytes),candidate:structuredClone(candidate),context:a.createNativeAdjudicationContextV1({contextId:'pansphaira:forward-qualification-001'}),qualifiedHeads});
test('forward qualification accepts the actual current candidate without claiming release',()=>{
 assert.equal(typeof a.adjudicateNativeForwardCandidateV1,'function');
 const result=a.adjudicateNativeForwardCandidateV1(input());
 assert.equal(result.outcome,'ACCEPTED_BOUNDED');
 assert.equal(result.schemaVersion,'pansphaira/native-forward-qualification/v1');
 assert.deepEqual(result.qualifiedHeads,qualifiedHeads);
 assert.equal('releasedHeads' in result,false);
 assert.equal(result.authority,'NONE');
 const {qualifiedHeads: _qualified, ...historicalEnvelope}=input();
 const historical=a.adjudicateNativeCandidateV1({...historicalEnvelope,releasedHeads:a.RECONCILED_RELEASED_HEADS_V1});
 assert.equal(historical.outcome,'DENIED');
 assert.deepEqual(historical.reasonCodes,['NATIVE_STALE_HEAD_DENIED']);
 assert.equal(result.effect,'NONE');
 assert.equal(result.capabilityDelta,'NONE');
 assert.equal(result.canonicalKnowledgeMutation,'NONE');
 assert.equal(result.canonicalKnowledgeBeforeSha256,result.canonicalKnowledgeAfterSha256);
 assert.equal(result.kaleidoSphereServiceVerdictAuthoritative,false);
 assert.throws(()=>a.createNativePairedAdjudicationReceiptV1({...historicalEnvelope,releasedHeads:a.RECONCILED_RELEASED_HEADS_V1,adjudication:result}));
});
