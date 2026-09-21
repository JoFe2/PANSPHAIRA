import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import * as pair from '../dist/src/analytics/paired-analytics-parity.js';
import {generateForwardProducerAnalyticsManifestV1} from '../dist/src/analytics/producer-analytics-manifest.js';
import {canonicalJson} from '../dist/packages/contracts/src/canonical-json.js';
const input=()=>{
  const rawArtifactBytes=readFileSync('tests/fixtures/cks-analytics/projection-v1.json');
  const candidate=JSON.parse(readFileSync('tests/fixtures/cks-analytics/native-forward-current-candidate-v1.json'));
  return {rawArtifactBytes,candidate,producerManifest:generateForwardProducerAnalyticsManifestV1({rawArtifactBytes,candidate}).manifest,
    consumerManifest:JSON.parse(readFileSync('tests/fixtures/cks-analytics/consumer-forward-current-v1.json'))};
};
test('forward pair validates separate current content without claiming execution or release',()=>{
  const result=pair.validateForwardAnalyticsPairV1(input());
  assert.equal(result.outcome,'PASS');
  assert.equal(result.runtimeExecutionAttested,false);
  assert.equal(result.releaseOrPublicCiAttested,false);
});
for(const [name,mutate] of [
 ['producer',x=>{x.producerManifest.evidence.computed.nodeCount=99;}],
 ['capture',x=>{x.candidate.claims.computed.nodeCount=99;}],
 ['environment',x=>{x.candidate.bindings.environmentSha256='0'.repeat(64);} ],
 ['projection',x=>{x.rawArtifactBytes=Buffer.from('{}');}],
 ['consumer head',x=>{x.consumerManifest.bindings.kaleidosphereHead.commitOid='0'.repeat(40);}],
 ['consumer supported scope',x=>{x.consumerManifest.support.supported.pop();}],
 ['consumer channel',x=>{x.consumerManifest.channels.analysis.version='forged';}],
 ['consumer rehashed substitution',x=>{
   x.consumerManifest.support.supported.pop();
   const {integrity,...body}=x.consumerManifest;
   x.consumerManifest.integrity.digest='sha256:'+createHash('sha256').update(canonicalJson(body)).digest('hex');
 }],
 ['malformed',x=>{x.consumerManifest=null;}],
])test(`forward pair denies ${name}`,()=>{
 const value=input();mutate(value);assert.equal(pair.validateForwardAnalyticsPairV1(value).outcome,'DENIED');
});
