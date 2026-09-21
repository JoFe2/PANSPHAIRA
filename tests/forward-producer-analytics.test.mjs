import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as producer from '../dist/src/analytics/producer-analytics-manifest.js';
const input=()=>({
  rawArtifactBytes:readFileSync('tests/fixtures/cks-analytics/projection-v1.json'),
  candidate:JSON.parse(readFileSync('tests/fixtures/cks-analytics/native-forward-current-candidate-v1.json')),
});
for (const [name, mutate] of [
  ['head', x=>{x.candidate.bindings.kaleidosphereHead.commitOid='0'.repeat(40);}],
  ['environment', x=>{x.candidate.bindings.environmentSha256='0'.repeat(64);}],
  ['computed claims', x=>{x.candidate.claims.computed.nodeCount=99;}],
  ['authority', x=>{x.candidate.authority.publish=true;}],
  ['raw projection', x=>{x.rawArtifactBytes=Buffer.from('{}');}],
  ['historical capture', x=>{x.candidate.bindings.kaleidosphereHead.commitOid='545a3b44ea88c96eded060c11c7c3a2afe0edff6';}],
]) test(`forward producer denies ${name} substitution`,()=>{
  const altered=input();mutate(altered);
  assert.throws(()=>producer.generateForwardProducerAnalyticsManifestV1(altered));
});
test('forward producer deterministically derives current observed surface without historical receipt or release claim',()=>{
  assert.equal(typeof producer.generateForwardProducerAnalyticsManifestV1,'function');
  const first=producer.generateForwardProducerAnalyticsManifestV1(input());
  assert.equal(first.serialized,producer.generateForwardProducerAnalyticsManifestV1(input()).serialized);
  assert.equal(first.manifest.schemaVersion,'pansphaira/forward-producer-analytics-manifest/v1');
  assert.deepEqual(first.manifest.serviceHead,{commitOid:'792e5e38cd4fb612ee034b3edc62aa8b4f58fe0f',treeOid:'759baccaa077d24f2f78c7e82d6fab801050bc63'});
  assert.equal(first.manifest.adjudication.outcome,'ACCEPTED_BOUNDED');
  assert.equal(first.manifest.authority,'NONE');
  assert(first.manifest.fieldSurface.some(x=>x.path==='candidate.claims.computed.nodeCount'));
  assert(first.manifest.nonclaims.includes('NO_RUNTIME_EXECUTION_ATTESTATION'));
  assert(first.manifest.nonclaims.includes('NO_RELEASE_OR_PUBLIC_CI_CLAIM'));
  assert.equal('sliceReceipt' in first.manifest,false);
  assert.equal('releasedHeads' in first.manifest,false);
});
