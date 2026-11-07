// Deterministic PAN575 local-model qualification entrypoint tests. The
// scripted provider here is a self-certified fake provider: it exercises the
// REAL transport/broker/native tools/owner-composition loop but can NEVER
// establish model provenance or acceptance (receipt keeps
// realModelAcceptance:false and evidenceBinding OWNER_BOUND_NOT_QUALIFIED).
// No real inference runs here; that stays an explicit opt-in outside CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync,readFileSync,statSync,chmodSync,rmSync,symlinkSync,mkdirSync,lstatSync,readdirSync,constants} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {createNativeCompositionFeedbackToolsV1} from '../../src/pan575/native-composition-tools.mjs';
import {MODEL_COMPOSITION_WIRE_ALIAS_V1,MODEL_CONNECTION_COMPOSITION_PURPOSE_V1,adaptNativeUiWireRequestV1} from '../../src/pan565/connection-transport.mjs';
import {MODEL_CONNECTION_TEST_DATA_DIGEST_V1} from '../../src/pan565/native-model-connection.mjs';
import {createProtectedSessionAdapterV1} from '../../src/pan527/origin-session-adapter.mjs';
import {createBrowserProfileStoreV1} from '../../src/pan543/profile-store.mjs';
import {materialInput575} from './protocol-fixture.mjs';
import {shapeIdentity527} from '../pan527/helpers.mjs';
import {runLocalModelQualificationV1,observeOwnerLedgerReservationV1,ownerLedgerReservationDurableAcrossReopenV1,ownerLedgerPrincipalKeyV1,QUALIFICATION_LEDGER_DIR_PREFIX_V1} from '../../scripts/run-pan575-local-model-qualification.mjs';
const MODEL='model:local-qwen-test-1',SECRET='test-local-secret-0123456789';
const shaFixture=v=>createHash('sha256').update(canonicalJson(v)).digest('hex');
// Bounded SYNTHETIC test prices (test data, never real billing): nonzero so
// the ACTUAL production per-request rounding at
// src/pan565/connection-transport.mjs:155
// (costMicros=Math.ceil((prompt*in+completion*out)/1e6)) yields exactly
// derivable, observable ledger consumption. Actual paid cost stays
// UNKNOWN_NO_INVOICE. Rates respect the config cap (<=1e9) and the
// production price-bound preflight at connection-transport line 145.
const SYNTH_RATE=1000;
const SYNTH_PRICING={currency:'EUR',revision:1,inputMicrosPerMillionTokens:SYNTH_RATE,outputMicrosPerMillionTokens:SYNTH_RATE};
const limits575={maxCostMicros:100000,maxTimeMs:30000,maxTurns:3,maxTools:2,maxRequests:3,maxTokens:4096,maxInputBytes:65536,maxOutputBytes:65536};
const nativeTools=createNativeCompositionFeedbackToolsV1().tools;
const nativeDescriptors=nativeTools.map(t=>t.descriptor);
// The wire presentation is owned by the ACTUAL production adapter, not a
// utility-side alias registry: adaptNativeUiWireRequestV1 engages for the
// exact composition pair and produces the provider-safe wire descriptors.
const wireTools=adaptNativeUiWireRequestV1({model:MODEL,messages:[],tools:nativeDescriptors.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.inputSchema}}))}).request.tools;
const WIRE_PLAN=MODEL_COMPOSITION_WIRE_ALIAS_V1.binding['pan522.material.plan'],WIRE_ORDER=MODEL_COMPOSITION_WIRE_ALIAS_V1.binding['erp.order.create'];
// The ACTUAL local Qwen server rejects tool names outside [A-Za-z0-9_-];
// the controlled peer enforces the same character set with a portable
// <=64-char cap (compatible with that server and the broker guard).
const PEER_WIRE_NAME=/^[A-Za-z0-9_-]{1,64}$/;
const ARGS_BY_NATIVE={'pan522.material.plan':()=>materialInput575(),'erp.order.create':()=>({requestId:'request:erp-cell-pan575-feedback',sku:'SYN-PAN575',quantity:13})};
const CALL_ID_BY_NATIVE={'pan522.material.plan':'call_local_a1','erp.order.create':'call_local_b2'};
// The owner admits ONLY its code-owned connection probe-text digest — the
// composition payload identity stays owner-derived inside the offer.
const expectedDigest=MODEL_CONNECTION_TEST_DATA_DIGEST_V1;
function scratch(){return mkdtempSync(process.env.TMPDIR+'/pan575q-');}
function secretFile(dir,value=SECRET){const p=join(dir,'local-model.secret');writeFileSync(p,value+'\n',{mode:0o600});return p;}
// Masks long hex ONLY at allow-listed owner identity fields in their exact
// production shapes: any key ending in Digest or the key secretFingerprint
// holding a FULL 64-hex sha256, plus runId/operationId holding exactly
// operation:pan574-<48hex>. Every other string — including 64-hex under any
// other key or embedded inside a longer value — stays visible to the leak
// regex, so coverage is never weakened by arbitrary stripping.
function maskAllowedOwnerHexV1(v,key){
  if(typeof v==='string')return ((/Digest$/.test(key)||key==='secretFingerprint')&&/^[a-f0-9]{64}$/.test(v))||((key==='runId'||key==='operationId')&&/^operation:pan574-[a-f0-9]{48}$/.test(v))?'MASKED-ALLOWED-OWNER-ID':v;
  if(Array.isArray(v))return v.map(x=>maskAllowedOwnerHexV1(x,key));
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,maskAllowedOwnerHexV1(x,k)]));
  return v;
}
async function stubProvider({enforceAuth=true,rotateSecretFile=null,getGate=null,postGate=null}={}){
  const observations=[];const sockets=new Set();let posts=0;let requests=0;
  const server=createServer(async(req,res)=>{
    requests++;
    let raw='';for await(const c of req)raw+=c;
    if(req.method==='GET'){
      // run09: an externally-resolved gate holds the first GET in flight so
      // the test can observe the receipt WHILE the request is outstanding.
      if(getGate&&requests===1)await getGate;
      if(enforceAuth&&req.headers.authorization!=='Bearer '+SECRET){res.writeHead(401,{'content-type':'application/json'});res.end('{"error":"unauthorized"}');return;}
      res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({data:[{id:MODEL}]}));return;
    }
    posts++;const body=JSON.parse(raw||'{}');observations.push({body,raw,authorizationPresent:Object.hasOwn(req.headers,'authorization')});
    // run45: an externally-resolved gate holds the first POST in flight — the
    // response and every tool effect are still pending while the test reads
    // the owner's real ledger row for the in-flight reservation.
    if(postGate&&posts===1)await postGate;
    // Enforce the ACTUAL server-side wire-name character/length contract on
    // every declared tool before answering, like the real Qwen server does.
    const declared=(Array.isArray(body.tools)?body.tools:[]).map(t=>t?.function?.name);
    if(!declared.length||declared.some(n=>typeof n!=='string'||!PEER_WIRE_NAME.test(n))){
      res.writeHead(400,{'content-type':'application/json'});
      res.end(JSON.stringify({error:{message:'function name \''+String(declared[0])+'\' must match [A-Za-z0-9_-]{1,64} (portable cap; server allows up to 256)',param:'tools[0].function.name',type:'invalid_request_error'}}));return;
    }
    const toolMessages=(body.messages??[]).filter(m=>m.role==='tool');let message;
    if(!toolMessages.length){
      // Reply by echoing back the ACTUAL declared wire names, never invented ones.
      message={content:null,tool_calls:declared.map(name=>{const nativeId=Object.keys(MODEL_COMPOSITION_WIRE_ALIAS_V1.binding).find(id=>MODEL_COMPOSITION_WIRE_ALIAS_V1.binding[id]===name);
        if(!nativeId){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:{message:'undeclared tool name '+name,param:'tools',type:'invalid_request_error'}}));return null;}
        return {id:CALL_ID_BY_NATIVE[nativeId],type:'function',function:{name,arguments:JSON.stringify(ARGS_BY_NATIVE[nativeId]())}};}).filter(Boolean)};
      if(!message.tool_calls.length||message.tool_calls.length!==declared.length){return;}
    }else{
      const answers=toolMessages.map(m=>{const f=JSON.parse(m.content).feedback;return {callId:f.callId,challengeId:f.challengeId,sum:f.left+f.right};});
      message={content:JSON.stringify({schemaVersion:'pansphaira.broker-tool-feedback/final/v1',text:'Consumed two actual native tool results with fresh challenge feedback.',answers}),tool_calls:[]};
    }
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({model:MODEL,choices:[{message}],usage:{prompt_tokens:150,completion_tokens:40}}));
    if(rotateSecretFile)writeFileSync(rotateSecretFile,'rotated-local-secret-0123456789\n',{mode:0o600});
  });
  server.on('connection',s=>{sockets.add(s);s.once('close',()=>sockets.delete(s));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {origin:'http://127.0.0.1:'+server.address().port,observations,posts:()=>posts,requests:()=>requests,async close(){server.close();for(const s of sockets)s.destroy();await new Promise(r=>setTimeout(r,10));}};
}
function writeConfig(dir,{origin,credentialFile,receiptDir,expiresAtMs=Date.now()+600000}={}){
  // Owner custody state root: an owner-owned 0700 directory OUTSIDE the repo
  // (dir is a 0700 mkdtemp scratch under TMPDIR; this test-owned child is
  // cleaned with the whole root in each caller's finally).
  // Repeatable over the SAME test-owned scratch root and same runtime
  // identity/session: a second writeConfig in one test reuses the existing
  // 0700 owner-state directory (verified: real directory, no symlink, mode
  // 0700 — the exact conditions the script re-checks); any other existing
  // leaf is a hard fixture error. Nothing held (ledger/custody) is ever
  // deleted, recreated or reset here; the whole scratch root is cleaned in
  // each caller's finally.
  const stateDir=join(dir,'owner-state');
  try{mkdirSync(stateDir,{mode:0o700});}
  catch(e){if(e.code!=='EEXIST')throw e;const st=lstatSync(stateDir);if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o777)!==0o700)throw Error('PAN575_TEST_OWNER_STATE_UNEXPECTED');}
  chmodSync(stateDir,0o700);
  // Complete SHAPE-only synthetic runtime identity (tests/pan527/helpers.mjs
  // shape fixture — shape, never a real runtime/image observation) under the
  // test-owned scratch root.
  const runtimeIdentityPath=join(dir,'runtime-identity.json');
  writeFileSync(runtimeIdentityPath,JSON.stringify(shapeIdentity527('tenant-pan575')));
  const p=join(dir,'qualification-config.json');
  writeFileSync(p,JSON.stringify({origin,model:MODEL,deploymentId:'stub-loopback-deployment',configurationRevision:1,credentialFile,receiptDir,stateDir,sessionOrigin:'https://127.0.0.1:9443',runtimeIdentityPath,sessionSubject:'subject:pan575-local-qualification',pricing:SYNTH_PRICING,limits:limits575,expectedTestDataDigest:expectedDigest,expiresAtMs}));
  return p;
}
const CONSENT_ENV={PAN575_LOCAL_MODEL_QUALIFICATION:'REAL_LOCAL_MODEL_RUN_V1'};

// run45 durable-accounting fixtures. The tests open their OWN observation
// context over the SAME test-owned scratch custody root: a fresh protected
// session adapter and browser profile store over the same stateDir and the
// same synthetic runtime identity produce the SAME principal, so the
// EXPORTED production observer derives the exact owner ledger path exactly
// like the script does. The observer itself never enumerates; only these
// fixtures enumerate their own strictly synthetic scratch rows.
function observerHandlesV1(dir,subject='subject:pan575-local-qualification'){
  const stateDir=join(dir,'owner-state');
  const identity=JSON.parse(readFileSync(join(dir,'runtime-identity.json'),'utf8'));
  const sessions=createProtectedSessionAdapterV1({optIn:true,origin:'https://127.0.0.1:9443',identity,stateRoot:stateDir});
  const profiles=createBrowserProfileStoreV1({root:stateDir,catalog:()=>[]});
  const issued=sessions.issueOwnerSession({subjectId:subject,role:'reader',expiresAtMs:Date.now()+600000});
  const headers={cookie:issued.cookieHeader,origin:'https://127.0.0.1:9443','x-pan565-session':'session:'+createHash('sha256').update(issued.cookieHeader).digest('hex')};
  const principal=sessions.authenticate(headers);
  return {stateDir,sessions,profiles,principal,headers,
    observe(operationId){return observeOwnerLedgerReservationV1({stateDir,sessions,profiles,headers,operationId});},
    close(){try{profiles.close();}catch{}}};
}
// The observer's OWN path algorithm, reused test-side to place fixtures.
function ownerLedgerDirV1(stateDir,principal,identityDigest){return join(stateDir,QUALIFICATION_LEDGER_DIR_PREFIX_V1+shaFixture(ownerLedgerPrincipalKeyV1(principal)+':'+identityDigest));}
function notRunChecks575(){return Object.fromEntries(['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY','INFERENCE'].map(p=>[p,{state:'NOT_RUN',checkedAtMs:null,identityDigest:null,reason:'NOT_RUN'}]));}
function putConnectionRowV1(profiles,principal,identityDigest,lastOperation=null){
  const revision=profiles.readModelConnection(principal).revision;
  profiles.writeModelConnection(principal,revision,{connectionId:'connection:pan575-observer-fixture',identityDigest,secretFingerprint:null,checks:notRunChecks575(),grant:null,lastOperation},()=>true);
}
// The observer reads exactly these five columns; a plain table carries the
// same names so deliberately corrupt unit tuples can be planted (the owner's
// own STRICT/CHECK schema would refuse them — that is the point).
function createLedgerTableV1(db){db.exec('CREATE TABLE IF NOT EXISTS reservations (operation_id TEXT PRIMARY KEY, request_digest TEXT NOT NULL, model_units INTEGER NOT NULL, runtime_units INTEGER NOT NULL, state TEXT NOT NULL, model_consumed INTEGER NOT NULL DEFAULT 0, runtime_consumed INTEGER NOT NULL DEFAULT 0, completion TEXT, result_json TEXT)');}

test('575 entrypoint closed contract: the config digest is the code-owned owner digest and the exact native pair renames through the ACTUAL production adapter; subset/foreign/mixture deny before dispatch',()=>{
  assert.equal(expectedDigest,MODEL_CONNECTION_TEST_DATA_DIGEST_V1,'expectedTestDataDigest equals the owner code-owned literal, never a descriptor hash');
  assert.deepEqual({...MODEL_COMPOSITION_WIRE_ALIAS_V1.binding},{'pan522.material.plan':'pan522_material_plan','erp.order.create':'erp_order_create'},'closed code-owned composition registry holds exactly the literal provider-safe names');
  const declared={model:MODEL,messages:[{role:'user',content:'probe'},{role:'assistant',content:null,tool_calls:[{id:'call_local_a1',type:'function',function:{name:'pan522.material.plan',arguments:'{}'}}]}],tools:nativeDescriptors.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.inputSchema}}))};
  const snapshot=JSON.stringify(declared);
  const adapted=adaptNativeUiWireRequestV1(declared);
  assert.notEqual(adapted.request,declared,'the exact composition pair engages the closed adapter: no untouched pass-through');
  assert.deepEqual(adapted.request.tools.map(t=>t.function.name),[WIRE_PLAN,WIRE_ORDER],'outgoing declared tools carry exactly the closed provider-safe aliases');
  assert.deepEqual(adapted.request.messages[1].tool_calls.map(c=>c.function.name),[WIRE_PLAN],'the assistant transcript uses the SAME closed mapping');
  assert.deepEqual([...adapted.aliases.entries()],[[WIRE_PLAN,'pan522.material.plan'],[WIRE_ORDER,'erp.order.create']],'the inverse aliases restore only the exact dotted native identities');
  assert.equal(JSON.stringify(declared),snapshot,'the original native request is never mutated by the adapter');
  // Fail-closed BEFORE dispatch, zero provider involvement: only the exact pair.
  assert.throws(()=>adaptNativeUiWireRequestV1({model:MODEL,messages:[],tools:[{type:'function',function:{name:'pan522.material.plan'}}]}),/MODEL_CONNECTION_WIRE_NAME_DENIED/,'a proper subset of the exact pair denies, no dotted fallback');
  assert.throws(()=>adaptNativeUiWireRequestV1({model:MODEL,messages:[],tools:[{type:'function',function:{name:'pan522.material.plan'}},{type:'function',function:{name:'erp.order.create'}},{type:'function',function:{name:'crm.order.snapshot'}}]}),/MODEL_CONNECTION_WIRE_NAME_DENIED/,'an added foreign dotted name beyond the exact pair denies');
  assert.throws(()=>adaptNativeUiWireRequestV1({model:MODEL,messages:[],tools:[{type:'function',function:{name:'ui.view.read'}},{type:'function',function:{name:'pan522.material.plan'}}]}),/MODEL_CONNECTION_WIRE_NAME_DENIED/,'a UI/composition mixture stays fail-closed');
  const passThrough={model:MODEL,messages:[{role:'user',content:'x'}],tools:[]};
  assert.equal(adaptNativeUiWireRequestV1(passThrough).request,passThrough,'no code-owned dotted name: byte-identical pass-through');
});

test('575 entrypoint child without consent exits 4 before any binding or network action',()=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!['NODE_OPTIONS','NODE_TEST_CONTEXT','PAN575_LOCAL_MODEL_QUALIFICATION'].includes(k)));
  const p=spawnSync(process.execPath,['scripts/run-pan575-local-model-qualification.mjs','--config','/nonexistent/qualification-config.json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',timeout:15000,env});
  assert.equal(p.status,4,p.stderr);assert.match(p.stdout,/REAL_MODEL_CONSENT_MISSING/);
});

test('575 entrypoint full positive run over scripted fake provider: phases PASS, fresh tool-result challenge actually consumed, durable owner ledger observes the real SETTLED rows, receipt 0600, secret never leaks, fake provider still NOT model acceptance',async()=>{
  const x=await stubProvider();const dir=scratch();const rec=scratch();try{
    const configPath=writeConfig(dir,{origin:x.origin,credentialFile:secretFile(dir),receiptDir:rec});
    const{exitCode,receipt,log}=await runLocalModelQualificationV1({configPath,env:{...process.env,...CONSENT_ENV}});
    assert.equal(exitCode,0,JSON.stringify({log,loop:receipt.loop}));
    for(const phase of ['REACHABILITY','AUTHENTICATION','MODEL_AVAILABILITY','INFERENCE'])assert.equal(receipt.phases[phase].state,'PASS',phase);
    assert.equal(receipt.loop.actualToolActions,2);assert.equal(receipt.loop.actualRequests,2);
    assert.equal(receipt.loop.usageState,'OWNER_OBSERVED_USAGE_NOT_PRODUCT_MODEL_ACCEPTANCE');
    assert.equal(receipt.loop.usage.inputTokens,300);assert.equal(receipt.loop.usage.outputTokens,80);
    // Honest owner-bound observation verdicts only — the scripted fake must
    // never carry a false real-model qualification label anywhere.
    assert.equal(receipt.verdict,'OWNER_BOUND_COMPOSITION_LOOP_OBSERVED_REAL_MODEL_NOT_QUALIFIED');
    assert.equal(receipt.scope.nativeLoop,'OBSERVED_OWNER_COMPOSITION_TOOL_LOOP_MODEL_PROVENANCE_PENDING');
    assert.equal(receipt.scope.directTransport,'OBSERVED_OWNER_BOUND_EXCHANGE');
    const receiptText=JSON.stringify(receipt);
    assert.equal(receiptText.includes('REAL_LOCAL_MODEL_TOOL_LOOP_QUALIFIED'),false,'no false real-model qualification label');
    assert.equal(receiptText.includes('QUALIFIED_ACTUAL_LOCAL_MODEL'),false,'no false actual-model loop label');
    assert.equal(receipt.realModelAcceptance,false);assert.equal(receipt.evidenceBinding,'OWNER_BOUND_NOT_QUALIFIED');
    // The owner's EXISTING durable cost ledger is integrated: the receipt
    // carries the ACTUAL observed reservation rows, never an unavailable
    // observation folded into an accounting pass.
    assert.equal(receipt.durableOwnerLedger,'INTEGRATED_OWNER_BOUND_COST_LEDGER_V1');
    const ol=receipt.ownerLedger;
    assert.match(ol.runId,/^operation:pan574-[a-f0-9]{48}$/,'owner-bound composition run id');
    assert.match(ol.offerDigest,/^[a-f0-9]{64}$/,'owner-derived offer digest observed');
    assert.equal(ol.stateBeforeReservation,'NO_RESERVATION','pre-reservation observation of the exact future operation is honestly empty, not unavailable');
    assert.equal(ol.stateAfterRun,'SETTLED','the settled run settles inside the owner');
    assert.equal(ol.stateAfterReopen,'SETTLED','settlement is durable across a full owner/profile reopen');
    assert.equal(ol.reservationDurableAcrossReopen,true);
    // Actual ledger row capture: the full held ceiling, two runtime
    // consumptions and genuinely observed model consumption.
    assert.equal(ol.reservation.state,'SETTLED','accounting proof is a real row, never OBSERVATION_UNAVAILABLE');
    assert.equal(ol.reservation.modelUnits,100000,'full maxCostMicros ceiling was actually reserved');
    assert.equal(ol.reservation.runtimeUnits,3,'full runtimeUnits ceiling was actually reserved');
    assert.equal(ol.reservation.runtimeConsumed,2,'both actual model requests were consumed on the ledger');
    // run45: durability is the accounting predicate over the TWO actual
    // snapshots — the snapshot captured BEFORE close is the settled row
    // itself, and the reopened observation conserves the complete
    // {state,reserved,consumed} tuple (SETTLED, 100000/3, consumed 2/2).
    assert.deepEqual(ol.reservationBeforeClose,{state:'SETTLED',modelUnits:100000,runtimeUnits:3,modelConsumed:2,runtimeConsumed:2},'the actual before-close snapshot is the settled owner row, not a state label');
    assert.deepEqual(ol.reservation,ol.reservationBeforeClose,'the full reopen conserves the exact reserved/consumed tuple');
    // Genuinely observed model consumption with EXACT accounting: the ACTUAL
    // production transport derives per-request costMicros =
    // Math.ceil((prompt*in+completion*out)/1e6)
    // (src/pan565/connection-transport.mjs:155), the loop sums those exact
    // values, and the owner settles modelUnits=loop.usage.costMicros
    // (src/pan565/native-model-connection.mjs:204). The two actual usage
    // reports each carry prompt 150 / completion 40, so the derived total is
    // 2 * ceil(190000/1e6) = 2. Prices above are SYNTHETIC fixture data —
    // actual paid cost remains UNKNOWN_NO_INVOICE.
    const expectedCostPerRequest=Math.ceil((150*SYNTH_RATE+40*SYNTH_RATE)/1000000);
    assert.equal(expectedCostPerRequest,1,'synthetic fixture: the exact production per-request rounding of one actual usage report');
    assert.equal(ol.reservation.modelConsumed,receipt.loop.usage.costMicros,'the ledger row model consumption is exactly the owner-settled loop usage');
    assert.equal(receipt.loop.usage.costMicros,2*expectedCostPerRequest,'exactly the sum of the two actual per-request production costs — never zero-folded, never invented');
    assert.equal(ol.retainedPriorHold,null,'a fresh owner state holds no prior UNKNOWN reservation');
    assert.equal(receipt.composition.purpose,MODEL_CONNECTION_COMPOSITION_PURPOSE_V1,'dispatch rode the code-owned composition purpose');
    assert.equal(receipt.composition.offerDigest,ol.offerDigest,'the confirmed offer is the owner-derived offer');
    assert.match(receipt.composition.payloadDigest,/^[a-f0-9]{64}$/,'the composition payload identity stays owner-derived');
    assert.equal(receipt.scope.browser,'NOT_EXERCISED');assert.equal(receipt.scope.fullIssue575,'NOT_COMPLETE');assert.equal(receipt.scope.fullIssue565,'NOT_IN_SCOPE');
    assert.equal(receipt.syntheticFixturesRelabelled,false);
    assert.equal(receipt.electricityCost,'UNKNOWN_NO_INVOICE');assert.equal(receipt.paidTokenCost,'UNKNOWN_NO_INVOICE');
    assert.equal(receipt.loop.toolReadbacks.length,2);
    // Each action went through the production composition wire alias, and the
    // closed mapping bound every alias to the ORIGINAL already-authorized
    // native invoke — the readbacks carry the dotted native identities.
    assert.deepEqual(receipt.loop.toolReadbacks.map(r=>r.toolName),['pan522.material.plan','erp.order.create']);
    assert.equal(Object.hasOwn(receipt,'toolAliasBinding'),false,'the utility carries no alias-binding field: the adapter owns the mapping');
    assert.deepEqual(receipt.nativeCapabilities,['erp.order.create','pan522.material.plan']);
    assert.deepEqual(receipt.toolWireNames,[WIRE_ORDER,WIRE_PLAN]);
    const text=readFileSync(join(rec,'qualification-receipt.json'),'utf8');
    assert.equal(text.includes(SECRET),false);
    // Leak coverage stays strict, now shape-exact: long hex may appear ONLY in
    // allow-listed owner identity fields in their exact production shapes —
    // any key ending in Digest or secretFingerprint holding a full 64-hex
    // sha256, and runId/operationId holding exactly operation:pan574-<48hex>.
    // No arbitrary string stripping: EVERY other 20+ hex run anywhere in the
    // receipt (including a 64-hex value under a non-id key) still fails.
    const masked=JSON.stringify(maskAllowedOwnerHexV1(JSON.parse(text),''));
    assert.equal(/sk-|[0-9a-f]{20,}/.test(masked),false,'long hex only inside the exact allow-listed owner id fields, never secret bytes');
    assert.equal((statSync(join(rec,'qualification-receipt.json')).mode&0o777),0o600);
    assert.equal(x.posts(),2);assert.equal(x.observations.every(o=>o.authorizationPresent),true);
    const first=x.observations[0].raw;
    // The first actual wire request declares ONLY the provider-safe aliases
    // in the wire name fields (the dotted native ids appear descriptively
    // inside the tool description text only, never as a wire name).
    assert.equal(first.includes(WIRE_PLAN)&&first.includes(WIRE_ORDER),true);
    const declaredNames=x.observations[0].body.tools.map(t=>t.function.name);
    assert.deepEqual(declaredNames,[WIRE_PLAN,WIRE_ORDER]);
    assert.equal(declaredNames.some(n=>n.includes('.')),false,'no dotted wire names on the wire');
    assert.equal(x.observations[0].body.messages[0].content.includes('pan522.material.plan'),false,'prompt names the wire aliases, not the dotted ids');
    const toolMessages=x.observations[1].body.messages.filter(m=>m.role==='tool');
    assert.equal(toolMessages.length,2);
    // Both ORIGINAL native capabilities actually executed under their exact
    // native identities despite the aliased wire presentation.
    assert.deepEqual(toolMessages.map(m=>JSON.parse(m.content).native.capabilityId).sort(),['erp.order.create','pan522.material.plan']);
    // Loop completion (exit 0) already proves the fake provider's final
    // answers matched the freshly generated per-call challenge data.
    for(const m of toolMessages){const f=JSON.parse(m.content);assert.equal(f.trust,'UNTRUSTED_TOOL_DATA');assert.equal(first.includes(f.feedback.challengeId),false,'challenge is fresh, not prompt knowledge');assert.equal(f.native.outcome,'NATIVE_READBACK');}
  }finally{await x.close();rmSync(dir,{recursive:true,force:true});rmSync(rec,{recursive:true,force:true});}
});

test('575 entrypoint expired grant and wrong test-data digest deny before any network exchange',async()=>{
  const x=await stubProvider();const dir=scratch();const rec=scratch();try{
    const expired=writeConfig(dir,{origin:x.origin,credentialFile:secretFile(dir),receiptDir:rec,expiresAtMs:Date.now()-1000});
    const e1=await runLocalModelQualificationV1({configPath:expired,env:{...process.env,...CONSENT_ENV}}).catch(e=>e);
    assert.equal(e1.qualificationExit,5);assert.equal(e1.qualificationReason,'QUALIFICATION_CONSENT_EXPIRY_DENIED');
    const bad=writeConfig(dir,{origin:x.origin,credentialFile:secretFile(dir),receiptDir:rec});
    writeFileSync(bad,readFileSync(bad).toString().replace(expectedDigest,'f'.repeat(64)));
    const e2=await runLocalModelQualificationV1({configPath:bad,env:{...process.env,...CONSENT_ENV}}).catch(e=>e);
    assert.equal(e2.qualificationExit,5);assert.equal(e2.qualificationReason,'QUALIFICATION_TEST_DATA_DENIED');
    assert.equal(x.posts(),0);
  }finally{await x.close();rmSync(dir,{recursive:true,force:true});rmSync(rec,{recursive:true,force:true});}
});

test('575 entrypoint missing auth enforcement fails AUTHENTICATION before inference, INFERENCE stays NOT_RUN, exit 6',async()=>{
  const x=await stubProvider({enforceAuth:false});const dir=scratch();const rec=scratch();try{
    const configPath=writeConfig(dir,{origin:x.origin,credentialFile:secretFile(dir),receiptDir:rec});
    const{exitCode,receipt}=await runLocalModelQualificationV1({configPath,env:{...process.env,...CONSENT_ENV}});
    assert.equal(exitCode,6);assert.equal(receipt.phases.AUTHENTICATION.state,'FAILED');
    assert.equal(receipt.phases.AUTHENTICATION.reason,'AUTH_ENFORCEMENT_ABSENT');
    assert.equal(receipt.phases.INFERENCE.state,'NOT_RUN');assert.equal(receipt.loop,null);assert.equal(x.posts(),0);
  }finally{await x.close();rmSync(dir,{recursive:true,force:true});rmSync(rec,{recursive:true,force:true});}
});

test('575 entrypoint secret rotation after the first actual model call denies the next admission with zero tool effects, retained unknown usage and honest partial counts',async()=>{
  const dir=scratch();const rec=scratch();const cred=secretFile(dir);
  const x=await stubProvider({rotateSecretFile:cred});try{
    const configPath=writeConfig(dir,{origin:x.origin,credentialFile:cred,receiptDir:rec});
    const{exitCode,receipt}=await runLocalModelQualificationV1({configPath,env:{...process.env,...CONSENT_ENV}});
    assert.equal(exitCode,2,JSON.stringify(receipt.loop));
    assert.equal(receipt.loop.outcome,'DENIED');assert.equal(receipt.loop.endReason,'LOOP_OWNER_STALE');
    assert.equal(receipt.loop.usageState,'UNKNOWN_USAGE_RETAINED');
    // The EXISTING loop revalidates current authority after the provider
    // returns and BEFORE invoking any tool: rotation must deny immediately,
    // so the rotated run has exactly one request and ZERO tool effects.
    assert.equal(receipt.loop.actualRequests,1);assert.equal(receipt.loop.actualToolActions,0);
    assert.equal(receipt.loop.toolReadbacks.length,0);assert.equal(x.posts(),1,'rotation denies any further provider request');
    assert.equal(receipt.phases.INFERENCE.state,'UNKNOWN_USAGE');assert.equal(receipt.phases.INFERENCE.reason,'LOOP_OWNER_STALE');
    assert.equal(receipt.verdict,'REAL_LOCAL_MODEL_TOOL_LOOP_NOT_QUALIFIED');
    assert.equal(readFileSync(join(rec,'qualification-receipt.json'),'utf8').includes(SECRET),false);
  }finally{await x.close();rmSync(dir,{recursive:true,force:true});rmSync(rec,{recursive:true,force:true});}
});

test('575 regression: the controlled peer enforces the real wire-name contract and WOULD HAVE REJECTED the old dotted descriptors (run03 HTTP 400)',async()=>{
  const x=await stubProvider();try{
    // Exactly the run03 wire shape: native dotted capability ids as function names.
    const legacy={model:MODEL,messages:[{role:'user',content:'probe'}],tools:nativeDescriptors.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.inputSchema}}))};
    const bad=await fetch(x.origin+'/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+SECRET},body:JSON.stringify(legacy)});
    assert.equal(bad.status,400,'old dotted descriptors must be rejected at the peer');
    const badErr=await bad.json();assert.equal(badErr.error.param,'tools[0].function.name');
    assert.equal(badErr.error.message.includes(legacy.tools[0].function.name),true,'the offending name is reported');
    // The corrected aliased descriptors (produced by the ACTUAL adapter over
    // the ORIGINAL native pair) pass the same peer contract.
    const good={model:MODEL,messages:[{role:'user',content:'probe'}],tools:structuredClone(wireTools)};
    const ok=await fetch(x.origin+'/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+SECRET},body:JSON.stringify(good)});
    // Consume the body exactly once; the text doubles as the failure message.
    const okText=await ok.text();
    assert.equal(ok.status,200,okText);
    const okBody=JSON.parse(okText);
    assert.deepEqual(okBody.choices[0].message.tool_calls.map(c=>c.function.name),[WIRE_PLAN,WIRE_ORDER],'peer answers with the actual declared names');
    // A >64-char alias also fails the portable cap.
    const longTool={type:'function',function:{name:'a'.repeat(65),description:'d',parameters:{}}};
    const longRes=await fetch(x.origin+'/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+SECRET},body:JSON.stringify({model:MODEL,messages:[{role:'user',content:'probe'}],tools:[longTool]})});
    assert.equal(longRes.status,400);
  }finally{await x.close();}
});

test('575 wire-alias mapping is closed through the ACTUAL adapter over the ORIGINAL native tools: exact pair renames, subset/foreign/collision deny before dispatch, aliases never select arbitrary functions',()=>{
  assert.deepEqual(wireTools.map(t=>t.function.name),[WIRE_PLAN,WIRE_ORDER],'closed two-entry mapping over the ORIGINAL native tools');
  assert.equal(new Set(wireTools.map(t=>t.function.name)).size,2,'two natives never collapse onto one wire name');
  assert.deepEqual(Object.keys(MODEL_COMPOSITION_WIRE_ALIAS_V1.binding).sort(),['erp.order.create','pan522.material.plan'],'the code-owned binding covers exactly the two authorized natives');
  for(const alias of Object.values(MODEL_COMPOSITION_WIRE_ALIAS_V1.binding))assert.match(alias,PEER_WIRE_NAME,'provider-safe alias characters and <=64-char cap');
  // Missing mapping: a proper subset has no admitted request shape (the whole
  // pair and nothing else is the only composition-catalog request).
  assert.throws(()=>adaptNativeUiWireRequestV1({model:MODEL,messages:[],tools:[{type:'function',function:{name:'erp.order.create'}}]}),/MODEL_CONNECTION_WIRE_NAME_DENIED/,'a native without its pair-partner denies, no dotted fallback');
  // Unknown mapping: an added native/dotted name outside the closed binding.
  assert.throws(()=>adaptNativeUiWireRequestV1({model:MODEL,messages:[],tools:[{type:'function',function:{name:'pan522.material.plan'}},{type:'function',function:{name:'erp.order.create'}},{type:'function',function:{name:'third.capability'}}]}),/MODEL_CONNECTION_WIRE_NAME_DENIED/,'a third dotted capability denies before dispatch');
  // Alias collision: a declared provider-safe alias next to its own dotted
  // native would collide with the rename — refused, never silently dropped.
  assert.throws(()=>adaptNativeUiWireRequestV1({model:MODEL,messages:[],tools:[{type:'function',function:{name:'pan522.material.plan'}},{type:'function',function:{name:WIRE_PLAN}}]}),/MODEL_CONNECTION_WIRE_NAME_DENIED/);
  // The bound functions stay the ORIGINAL native tools: invoke/validate
  // belong to the native TOOL objects (src/pan575/native-composition-tools
  // .mjs:12-14), NOT to their descriptors. A BEFORE/AFTER snapshot AROUND
  // the real adapter call proves the adapter renames ONLY wire presentation:
  // the exact tool identities, the invoke/validate FUNCTION REFERENCES and
  // the descriptor data (name/description/inputSchema) stay untouched.
  const snapNative=()=>nativeTools.map(t=>({tool:t,descriptor:t.descriptor,name:t.descriptor.name,descriptorData:structuredClone(t.descriptor),invoke:t.invoke,validate:t.validate}));
  const nativeBefore=snapNative();
  const pair={model:MODEL,messages:[],tools:nativeDescriptors.map(t=>({type:'function',function:{name:t.name}}))};
  const bound=adaptNativeUiWireRequestV1(pair);
  const nativeAfter=snapNative();
  assert.deepEqual([...bound.aliases.values()],nativeDescriptors.map(t=>t.name),'inverse map restores exactly the ORIGINAL native identities');
  assert.deepEqual(bound.request.tools.map(t=>t.function.name),[WIRE_PLAN,WIRE_ORDER],'the adapter renames only the wire presentation of the exact pair');
  assert.equal(nativeBefore[0].name==='pan522.material.plan'&&nativeBefore[1].name==='erp.order.create',true,'the snapshot covers the exact original native pair');
  for(let i=0;i<nativeBefore.length;i++){
    const b=nativeBefore[i],a=nativeAfter[i];
    assert.equal(typeof b.invoke==='function'&&typeof b.validate==='function',true,'invoke/validate are real functions on native TOOL #'+i+', never on its descriptor');
    assert.equal(b.descriptor.invoke,undefined,'the descriptor itself carries no invoke: the old cross-shape comparison was vacuous');
    assert.equal(a.tool===b.tool&&a.descriptor===b.descriptor&&a.invoke===b.invoke&&a.validate===b.validate,true,'the adapter call left native tool #'+i+' identity and the exact invoke/validate references unchanged');
    assert.deepEqual(a.descriptorData,b.descriptorData,'native descriptor #'+i+' data (name/description/inputSchema) unchanged across the adapter call');
  }
});

// run08/run09 output custody: the receipt output must be reserved BEFORE any
// network request or native tool action as a NEW regular file, exclusively
// and without following a symlink. Every occupied-leaf denial is explicit,
// nonzero and network-free; the pre-existing target bytes/mode are verified
// PRESERVED inside the helper — before its scratch-root cleanup — because a
// post-cleanup re-check could not tell preservation from deletion. The
// reservation writes its IN_PROGRESS record only through the exclusively
// opened O_EXCL fd, so an occupied leaf additionally proves a zero-byte
// reservation attempt and an unchanged type. Deterministic fake provider only
// — no live inference.
async function occupiedLeafDenial(makeLeaf,label,postDenial){
  const x=await stubProvider();const dir=scratch();const rec=scratch();try{
    const leaf=join(rec,'qualification-receipt.json');makeLeaf(leaf);
    const configPath=writeConfig(dir,{origin:x.origin,credentialFile:secretFile(dir),receiptDir:rec});
    const e=await runLocalModelQualificationV1({configPath,env:{...process.env,...CONSENT_ENV}}).catch(e=>e);
    assert.equal(e?.qualificationExit,5,label);
    assert.equal(e?.qualificationReason,'QUALIFICATION_RECEIPT_OUTPUT_OCCUPIED',label);
    assert.equal(x.requests(),0,label+': reservation deny happens before any network request');
    // Assertions run BEFORE the finally below deletes the receipt root, so
    // the preserved leaf is really observed, not assumed.
    const st=lstatSync(leaf);
    assert.ok([constants.O_WRONLY,constants.O_CREAT,constants.O_EXCL,constants.O_NOFOLLOW].every(Number.isInteger),'node:fs exposes the O_* flags via its constants export');
    postDenial(leaf,st);
    return leaf;
  }finally{await x.close();rmSync(dir,{recursive:true,force:true});rmSync(rec,{recursive:true,force:true});}
}

test('575 output custody: pre-existing symlink leaf to an owned sentinel denies with zero provider calls, sentinel bytes and mode untouched',async()=>{
  const dir=scratch();
  try{
    const sentinel=join(dir,'unrelated-sentinel');writeFileSync(sentinel,'SENTINEL-BEFORE\n',{mode:0o640});
    const modeBefore=statSync(sentinel).mode&0o777;
    await occupiedLeafDenial(leaf=>symlinkSync(sentinel,leaf),'symlink leaf',(leaf,st)=>{
      assert.equal(st.isSymbolicLink(),true,'symlink leaf still present after the denial');
      assert.equal(readFileSync(sentinel,'utf8'),'SENTINEL-BEFORE\n','sentinel bytes unchanged while the receipt root still exists');
      assert.equal(statSync(sentinel).mode&0o777,modeBefore,'sentinel mode unchanged while the receipt root still exists');
    });
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('575 output custody: dangling symlink leaf denies with zero provider calls and the symlink itself left in place unfollowed',async()=>{
  const dir=scratch();
  try{
    await occupiedLeafDenial(leaf=>symlinkSync(join(dir,'no-such-target-file'),leaf),'dangling symlink leaf',(leaf,st)=>{
      assert.equal(st.isSymbolicLink(),true,'dangling symlink still present after the denial');
      assert.throws(()=>readFileSync(leaf),err=>err.code==='ENOENT','symlink stayed unfollowed and dangling (target still absent)');
    });
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('575 output custody: pre-existing regular receipt denies with zero provider calls, prior bytes and mode preserved',async()=>{
  const dir=scratch();
  try{
    const probe=join(dir,'prior-holder');writeFileSync(probe,'PRIOR\n',{mode:0o644});
    const modeBefore=statSync(probe).mode&0o777;
    await occupiedLeafDenial(leaf=>{writeFileSync(leaf,'PRIOR-RECEIPT-BEFORE\n',{mode:0o644});
      assert.equal(statSync(leaf).mode&0o777,modeBefore,'prior receipt mode is the 0644 baseline');},'pre-existing regular receipt',(leaf,st)=>{
      assert.equal(st.isFile(),true,'prior receipt is still a regular file after the denial');
      assert.equal(readFileSync(leaf,'utf8'),'PRIOR-RECEIPT-BEFORE\n','prior bytes preserved verbatim — the denial wrote nothing, not even a 0-byte IN_PROGRESS reservation');
      assert.equal(statSync(leaf).mode&0o777,modeBefore,'prior 0644 mode preserved');
      assert.equal(statSync(probe).mode&0o777,modeBefore,'unrelated file in the same dir untouched');
    });
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('575 output custody: directory leaf denies with zero provider calls and the directory itself untouched',async()=>{
  await occupiedLeafDenial(leaf=>{mkdirSync(leaf);symlinkSync('/nonexistent-inside',join(leaf,'marker'));},'directory leaf',(leaf,st)=>{
    assert.equal(st.isDirectory(),true,'directory leaf is still a directory after the denial');
    assert.equal(lstatSync(join(leaf,'marker')).isSymbolicLink(),true,'directory contents (marker symlink) untouched');
  });
});

test('575 output custody fresh positive: reserved regular-file receipt written through the bound fd with mode 0600, complete receipt, no secret leak',async()=>{
  const x=await stubProvider();const dir=scratch();const rec=scratch();try{
    const configPath=writeConfig(dir,{origin:x.origin,credentialFile:secretFile(dir),receiptDir:rec});
    const{exitCode,receipt}=await runLocalModelQualificationV1({configPath,env:{...process.env,...CONSENT_ENV}});
    assert.equal(exitCode,0,JSON.stringify(receipt.loop??receipt.phases));
    const leaf=join(rec,'qualification-receipt.json');
    assert.equal(lstatSync(leaf).isFile()&&!lstatSync(leaf).isSymbolicLink(),true,'receipt leaf is a regular file, not a symlink');
    assert.equal(statSync(leaf).mode&0o777,0o600,'reserved fd + fchmod produce exactly mode 0600');
    const text=readFileSync(leaf,'utf8');const parsed=JSON.parse(text);
    assert.equal(parsed.schemaVersion,'pansphaira.pan575.local-model-qualification/receipt/v1');
    assert.equal(parsed.exitCode,0);assert.equal(parsed.phases.INFERENCE.state,'PASS');
    assert.equal(parsed.verdict,'OWNER_BOUND_COMPOSITION_LOOP_OBSERVED_REAL_MODEL_NOT_QUALIFIED');
    assert.equal(parsed.realModelAcceptance,false,'no false model acceptance from the bound-fd write path');
    assert.equal(text.includes(SECRET),false,'no secret leak through the fd write path');
    assert.equal(receipt.exitCode,parsed.exitCode,'written receipt matches the returned receipt');
  }finally{await x.close();rmSync(dir,{recursive:true,force:true});rmSync(rec,{recursive:true,force:true});}
});

// run09 truthful in-flight evidence: while the FIRST provider request is
// still outstanding, the reserved receipt must already hold a parseable
// IN_PROGRESS/UNKNOWN non-success record (never zero bytes, never a false
// PASS). The gate makes this deterministic: the fake provider holds the GET
// until the test resolves it. Normal failure/finish then rewrites the SAME
// leaf through the SAME fd; the final receipt must be exactly one valid JSON
// document (no stale suffix from the in-flight record). No live model.
test('575 output custody in-flight: delayed GET observes parseable IN_PROGRESS non-success receipt, then normal finish leaves final valid JSON',async()=>{
  let openGate;const getGate=new Promise(r=>{openGate=r;});
  const x=await stubProvider({enforceAuth:false,getGate});const dir=scratch();const rec=scratch();try{
    const leaf=join(rec,'qualification-receipt.json');
    const configPath=writeConfig(dir,{origin:x.origin,credentialFile:secretFile(dir),receiptDir:rec});
    const env={...process.env,...CONSENT_ENV};
    let settled=false;const run=runLocalModelQualificationV1({configPath,env}).finally(()=>{settled=true;});
    let text='';for(let i=0;i<600&&!text;i++){await new Promise(r=>setTimeout(r,5));try{text=readFileSync(leaf,'utf8');}catch{}}
    assert.ok(text,'reserved receipt is non-zero-byte WHILE the first GET is still in flight');
    assert.equal(settled,false,'run is still in flight: the gate holds the only provider request');
    const inflight=JSON.parse(text);
    assert.equal(inflight.state,'IN_PROGRESS');
    assert.equal(inflight.verdict,'QUALIFICATION_IN_PROGRESS_NOT_COMPLETE');
    assert.equal(inflight.realModelAcceptance,false,'in-flight evidence is never a false PASS');
    assert.equal(inflight.exitCode,null,'no exit code claimed before completion');
    assert.equal(text.includes(SECRET),false,'no secret leak in the in-flight record');
    openGate();
    const{exitCode,receipt}=await run;
    // enforceAuth:false: the single released GET answers 200, so
    // AUTHENTICATION fails normally and the run finishes with exit 6.
    assert.equal(exitCode,6);assert.equal(receipt.phases.AUTHENTICATION.state,'FAILED');
    const finalText=readFileSync(leaf,'utf8');const finalParsed=JSON.parse(finalText);
    assert.equal(finalParsed.exitCode,6,'final receipt rewritten through the same fd is valid complete JSON with no stale IN_PROGRESS suffix');
    assert.equal(finalParsed.state,undefined,'in-flight IN_PROGRESS marker fully replaced at completion');
    assert.equal(finalParsed.verdict,'REAL_LOCAL_MODEL_TOOL_LOOP_NOT_QUALIFIED');
    assert.equal(finalText,canonicalJson(finalParsed)+'\n','leaf is exactly one canonical JSON document plus one newline — no zero-byte hole, no old suffix');
  }finally{openGate();await x.close();rmSync(dir,{recursive:true,force:true});rmSync(rec,{recursive:true,force:true});}
});

// run45 durable accounting proof. The scripted provider is still a local
// fake (never model acceptance); everything observed below is the ACTUAL
// owner's own SQLite cost ledger over the ACTUAL native composition dispatch.
test('575 durable accounting: the genuine owner ledger row is observable WHILE the first inference POST is in flight — full 100000/3 dispatch fence, zero consumption, owner-derived not mock receipt — and the settled reopen conserves the exact tuple',async()=>{
  let openPostGate;const postGate=new Promise(r=>{openPostGate=r;});
  const x=await stubProvider({postGate});const dir=scratch();const rec=scratch();try{
    const configPath=writeConfig(dir,{origin:x.origin,credentialFile:secretFile(dir),receiptDir:rec});
    const run=runLocalModelQualificationV1({configPath,env:{...process.env,...CONSENT_ENV}});
    for(let i=0;i<1200&&x.posts()<1;i++)await new Promise(r=>setTimeout(r,5));
    assert.equal(x.posts(),1,'the first inference POST reached the peer');
    // Test-side discovery over the test-owned scratch custody root (the
    // production observer itself never enumerates): while the run is in
    // flight exactly one owner ledger directory exists under it.
    const stateDir=join(dir,'owner-state');
    const dirs=readdirSync(stateDir).filter(n=>n.startsWith(QUALIFICATION_LEDGER_DIR_PREFIX_V1));
    assert.equal(dirs.length,1,'the owner created exactly its own ledger directory under the custody root');
    const file=join(stateDir,dirs[0],'resource-budget.sqlite');
    let rows;{const db=new DatabaseSync(file,{readOnly:true});
      try{rows=db.prepare('SELECT operation_id,state,model_units,runtime_units,model_consumed,runtime_consumed,request_digest,completion FROM reservations').all();}finally{db.close();}}
    assert.equal(rows.length,1,'the whole-run reservation is the only row');
    const row=rows[0];
    assert.match(row.operation_id,/^operation:pan574-[a-f0-9]{48}$/,'the row is the exact composition operation');
    assert.deepEqual({state:row.state,modelUnits:row.model_units,runtimeUnits:row.runtime_units,modelConsumed:row.model_consumed,runtimeConsumed:row.runtime_consumed},
      {state:'UNKNOWN_USAGE',modelUnits:100000,runtimeUnits:3,modelConsumed:0,runtimeConsumed:0},
      'BEFORE any provider response or tool effect the persisted row carries the full ceiling under the dispatch fence — real owner state a mock receipt cannot show');
    assert.equal(row.completion,null,'nothing is settled while the first POST is still outstanding');
    assert.match(row.request_digest,/^[a-f0-9]{64}$/,'owner-derived request digest, not provider data');
    // The EXPORTED production observer (bound principal + persisted identity
    // digest + exact operation) sees the same genuine owner-derived snapshot.
    const fx=observerHandlesV1(dir);try{
      assert.deepEqual(fx.observe(row.operation_id),{state:'UNKNOWN_USAGE',modelUnits:100000,runtimeUnits:3,modelConsumed:0,runtimeConsumed:0},'the observer over its own session/profile handles reads the same real row, not a mock receipt');
    }finally{fx.close();}
    openPostGate();
    const{exitCode,receipt}=await run;
    assert.equal(exitCode,0,JSON.stringify(receipt.loop??receipt.phases));
    assert.equal(x.observations.length>=2,true,'the released gate let the loop finish');
    const ol=receipt.ownerLedger;
    assert.deepEqual(ol.reservationBeforeClose,{state:'SETTLED',modelUnits:100000,runtimeUnits:3,modelConsumed:2,runtimeConsumed:2},'the before-close snapshot is the settled owner row itself');
    assert.deepEqual(ol.reservation,ol.reservationBeforeClose,'the full reopen conserves the exact reserved/consumed tuple including modelConsumed 2 / runtimeConsumed 2');
    assert.equal(ol.reservationDurableAcrossReopen,true,'durability is the accounting predicate over two genuine snapshots, never a label equality');
  }finally{openPostGate();await x.close();rmSync(dir,{recursive:true,force:true});rmSync(rec,{recursive:true,force:true});}
});

test('575 retained UNKNOWN hold under same custody: repeat qualification over the SAME stateDir/principal/runtime identity and a FRESH receiptDir denies before any additional inference POST, the full 100000/3 hold survives the reopen unchanged, and a planted foreign row never leaks',async()=>{
  const dir=scratch();const rec1=scratch();const rec2=scratch();const cred=secretFile(dir);
  const x=await stubProvider({rotateSecretFile:cred});try{
    const configPath=writeConfig(dir,{origin:x.origin,credentialFile:cred,receiptDir:rec1});
    const r1=await runLocalModelQualificationV1({configPath,env:{...process.env,...CONSENT_ENV}});
    assert.equal(r1.exitCode,2,JSON.stringify(r1.receipt.loop??r1.receipt.phases));
    assert.equal(r1.receipt.loop.usageState,'UNKNOWN_USAGE_RETAINED');
    assert.equal(x.posts(),1);
    // Restore the ORIGINAL credential: the conservation fixture faces the
    // SAME binding — changing a credential legitimately changes the binding
    // and is the rotation guard's own existing test, not this one.
    writeFileSync(cred,SECRET+'\n',{mode:0o600});
    // Plant a FOREIGN row (different operation, sentinel completion) in the
    // SAME owner ledger database while every owner handle is closed. The
    // neighbor consumes ZERO units: the retained prior UNKNOWN hold already
    // occupies the full 100000/3 fixed ceilings, so any nonzero combined
    // consumption would exceed them and deny on the budget snapshot instead
    // of exercising the retained-hold projection.
    const stateDir=join(dir,'owner-state');
    const dirs=readdirSync(stateDir).filter(n=>n.startsWith(QUALIFICATION_LEDGER_DIR_PREFIX_V1));
    assert.equal(dirs.length,1,'one owner ledger under the custody root');
    const file=join(stateDir,dirs[0],'resource-budget.sqlite');
    {const db=new DatabaseSync(file);
     db.prepare('INSERT INTO reservations(operation_id,request_digest,model_units,runtime_units,state,model_consumed,runtime_consumed,completion) VALUES(?,?,?,?,?,?,?,?)')
       .run('operation:pan575-foreign-held','f'.repeat(64),7,1,'SETTLED',0,0,'FOREIGN-SENTINEL-BEFORE');
     db.close();}
    // Fresh OUTPUT directory only — the held ledger and the occupied prior
    // receipt are neither deleted nor reset to retry.
    const config2=writeConfig(dir,{origin:x.origin,credentialFile:cred,receiptDir:rec2});
    const r2=await runLocalModelQualificationV1({configPath:config2,env:{...process.env,...CONSENT_ENV}});
    assert.equal(r2.exitCode,2);
    assert.equal(r2.receipt.loop,null,'the retained hold denies before the composition loop starts');
    assert.equal(r2.receipt.phases.INFERENCE.state,'UNKNOWN_USAGE');
    assert.equal(r2.receipt.phases.INFERENCE.reason,'OWNER_LEDGER_UNKNOWN_USAGE_RETAINS_REDISPATCH');
    assert.deepEqual(r2.receipt.ownerLedger.retainedPriorHold,{state:'UNKNOWN_USAGE',modelUnits:100000,runtimeUnits:3,modelConsumed:0,runtimeConsumed:0},
      'the retained prior hold survives the full close/reopen with the FULL ceiling, observed for exactly the lastOperation the profile row names');
    assert.equal(r2.receipt.ownerLedger.reservationDurableAcrossReopen,false,'a denied redispatch claims no durability');
    assert.equal(x.posts(),1,'ZERO additional inference POST over the stable stateDir/principal/identity');
    const text=readFileSync(join(rec2,'qualification-receipt.json'),'utf8');
    assert.equal(text.includes('FOREIGN-SENTINEL-BEFORE'),false,'the planted foreign row never leaks through the exact-operation binding');
    assert.equal(text.includes(SECRET),false);
    // The prior UNKNOWN row is UNCHANGED and the sentinel neighbor still sits
    // beside it, untouched.
    {const db=new DatabaseSync(file);
     // node:sqlite returns NULL-prototype row objects; normalize to an ordinary
     // object so strict deepEqual compares the exact field values, not prototypes.
     const held={...db.prepare('SELECT state,model_units,runtime_units,model_consumed,runtime_consumed FROM reservations WHERE operation_id=?').get(r1.receipt.ownerLedger.runId)};
     assert.deepEqual(held,{state:'UNKNOWN_USAGE',model_units:100000,runtime_units:3,model_consumed:0,runtime_consumed:0},'prior UNKNOWN row unchanged');
     const foreign=db.prepare('SELECT completion FROM reservations WHERE operation_id=?').get('operation:pan575-foreign-held');
     assert.equal(foreign.completion,'FOREIGN-SENTINEL-BEFORE');
     db.close();}
  }finally{await x.close();rmSync(dir,{recursive:true,force:true});rmSync(rec1,{recursive:true,force:true});rmSync(rec2,{recursive:true,force:true});}
});

test('575 settled same-custody repeat: the prior exact settled row/consumption is preserved and a NEW full reservation is denied against the remaining fixed ceiling with zero additional inference POST and no budget reset',async()=>{
  const x=await stubProvider();const dir=scratch();const rec1=scratch();const rec2=scratch();const cred=secretFile(dir);try{
    const config1=writeConfig(dir,{origin:x.origin,credentialFile:cred,receiptDir:rec1});
    const r1=await runLocalModelQualificationV1({configPath:config1,env:{...process.env,...CONSENT_ENV}});
    assert.equal(r1.exitCode,0,JSON.stringify(r1.receipt.loop??r1.receipt.phases));assert.equal(x.posts(),2);
    const stateDir=join(dir,'owner-state');
    const dirs=readdirSync(stateDir).filter(n=>n.startsWith(QUALIFICATION_LEDGER_DIR_PREFIX_V1));assert.equal(dirs.length,1);
    const file=join(stateDir,dirs[0],'resource-budget.sqlite');
    const readLedger=()=>{const db=new DatabaseSync(file,{readOnly:true});try{return db.prepare('SELECT operation_id,state,model_units,runtime_units,model_consumed,runtime_consumed FROM reservations ORDER BY operation_id').all();}finally{db.close();}};
    const prior=readLedger();
    assert.equal(prior.length,1);
    // node:sqlite yields NULL-prototype rows; spread to an ordinary object so
    // strict deepEqual asserts the exact field values, not prototypes. The
    // prior array itself stays reader-produced for the line-635 unchanged check.
    assert.deepEqual({...prior[0]},{operation_id:r1.receipt.ownerLedger.runId,state:'SETTLED',model_units:100000,runtime_units:3,model_consumed:2,runtime_consumed:2},'the settled history is exact');
    // Same custody: SAME stateDir, principal, runtime identity and credential;
    // ONLY the output receiptDir is fresh — no reset, no occupied-receipt or
    // held-ledger deletion to retry.
    const config2=writeConfig(dir,{origin:x.origin,credentialFile:cred,receiptDir:rec2});
    const r2=await runLocalModelQualificationV1({configPath:config2,env:{...process.env,...CONSENT_ENV}});
    assert.equal(r2.exitCode,2,JSON.stringify(r2.receipt.phases));
    assert.equal(r2.receipt.loop,null,'the ledger ceiling denies BEFORE the composition loop dispatches');
    assert.equal(r2.receipt.phases.INFERENCE.state,'FAILED');
    assert.equal(r2.receipt.phases.INFERENCE.reason,'MODEL_CONNECTION_BUDGET_EXHAUSTED','a new full reservation is denied against the remaining fixed ceiling');
    assert.equal(r2.receipt.ownerLedger.stateAfterRun,'NO_RESERVATION','the denied run never reserved its own operation');
    assert.equal(r2.receipt.ownerLedger.reservationDurableAcrossReopen,false,'a denied run claims no durability');
    assert.equal(x.posts(),2,'ZERO additional inference POST — prior consumption is not evaded by a repeat run');
    assert.deepEqual(readLedger(),prior,'the prior settled row and exact consumption are unchanged — no reset, no rewrite');
  }finally{await x.close();rmSync(dir,{recursive:true,force:true});rmSync(rec1,{recursive:true,force:true});rmSync(rec2,{recursive:true,force:true});}
});

test('575 observer privacy and fail-closed negatives: only the bound principal/identity/exact operation is returned, planted foreign rows and ledgers never leak, missing stays DISTINCT from unreadable/symlink/corrupt, sentinel bytes and modes stay, no provider POST, and the durability predicate rejects missing/unavailable/changed/corrupt pairs',async()=>{
  const x=await stubProvider();const dir=scratch();const recObs=scratch();try{
    // Fixture custody only: the config/identity/owner-state root exists, but
    // NO qualification runs — pure observation must never dispatch.
    writeConfig(dir,{origin:x.origin,credentialFile:secretFile(dir),receiptDir:recObs});
    const DIGEST_A=shaFixture('pan575-observer-fixture-identity-a');
    const DIGEST_B=shaFixture('pan575-observer-fixture-identity-b');
    const DIGEST_C=shaFixture('pan575-observer-fixture-identity-c');
    const DIGEST_F='d'.repeat(64);
    const fx=observerHandlesV1(dir);
    try{
      putConnectionRowV1(fx.profiles,fx.principal,DIGEST_A,'operation:pan575-bound-op');
      const bound=ownerLedgerDirV1(fx.stateDir,fx.principal,DIGEST_A);
      mkdirSync(bound,{mode:0o700});
      {const db=new DatabaseSync(join(bound,'resource-budget.sqlite'));
       createLedgerTableV1(db);
       db.prepare('INSERT INTO reservations VALUES(?,?,?,?,?,?,?,?,?)').run('operation:pan575-bound-op','a'.repeat(64),100000,3,'UNKNOWN_USAGE',0,0,'BOUND-BEFORE',null);
       db.prepare('INSERT INTO reservations VALUES(?,?,?,?,?,?,?,?,?)').run('operation:pan575-foreign-op','b'.repeat(64),10,1,'SETTLED',4,1,'FOREIGN-SENTINEL-BEFORE',null);
       db.close();}
      const obs=fx.observe('operation:pan575-bound-op');
      assert.deepEqual(obs,{state:'UNKNOWN_USAGE',modelUnits:100000,runtimeUnits:3,modelConsumed:0,runtimeConsumed:0},'the observation is the bound exact row with its real accounting');
      const serialized=JSON.stringify(obs);
      assert.equal(serialized.includes('FOREIGN-SENTINEL-BEFORE'),false,'a foreign operation row in the SAME database is never returned or enumerated');
      assert.equal(serialized.includes('pan575-foreign'),false);
      // Foreign PRINCIPAL and foreign IDENTITY ledger directories exist under
      // the same custody root carrying sentinel bytes — the bound-path
      // observer never enumerates and never touches them.
      const foreignDir=ownerLedgerDirV1(fx.stateDir,{tenantId:'tenant-pan575',subjectId:'subject:pan575-foreign',instanceId:fx.principal.instanceId,generation:1},DIGEST_A);
      mkdirSync(foreignDir,{mode:0o700});writeFileSync(join(foreignDir,'resource-budget.sqlite'),'FOREIGN-PRINCIPAL-BYTES',{mode:0o640});
      const foreignIdentityDir=ownerLedgerDirV1(fx.stateDir,fx.principal,DIGEST_F);
      mkdirSync(foreignIdentityDir,{mode:0o700});writeFileSync(join(foreignIdentityDir,'resource-budget.sqlite'),'FOREIGN-IDENTITY-BYTES',{mode:0o640});
      assert.deepEqual(fx.observe('operation:pan575-bound-op'),obs,'observation is stable and stayed blind to the foreign ledgers');
      assert.equal(readFileSync(join(foreignDir,'resource-budget.sqlite'),'utf8'),'FOREIGN-PRINCIPAL-BYTES','foreign principal ledger untouched');
      assert.equal(statSync(join(foreignDir,'resource-budget.sqlite')).mode&0o777,0o640);
      assert.equal(readFileSync(join(foreignIdentityDir,'resource-budget.sqlite'),'utf8'),'FOREIGN-IDENTITY-BYTES','foreign identity ledger untouched');
      // Missing ROW inside the readable bound ledger: NO_RESERVATION.
      assert.deepEqual(fx.observe('operation:pan575-no-such-row'),{state:'NO_RESERVATION',modelUnits:null,runtimeUnits:null,modelConsumed:null,runtimeConsumed:null},'missing row is honestly empty, not unavailable');
      assert.deepEqual(fx.observe('operation:BAD'),{state:'OBSERVATION_UNAVAILABLE',modelUnits:null,runtimeUnits:null,modelConsumed:null,runtimeConsumed:null},'a malformed operation id never reaches the ledger');
      // Point the persisted identity at a ledger whose file is NOT a
      // database: unreadable observation is OBSERVATION_UNAVAILABLE — never
      // folded into NO_RESERVATION or an accounting pass.
      putConnectionRowV1(fx.profiles,fx.principal,DIGEST_B,'operation:pan575-unreadable');
      const dirB=ownerLedgerDirV1(fx.stateDir,fx.principal,DIGEST_B);
      mkdirSync(dirB,{mode:0o700});
      const garbage=join(dirB,'resource-budget.sqlite');
      writeFileSync(garbage,'GARBAGE-NOT-A-SQLITE-FILE\n',{mode:0o640});
      const modeB=statSync(garbage).mode&0o777;
      const unreadable=fx.observe('operation:pan575-unreadable');
      assert.equal(unreadable.state,'OBSERVATION_UNAVAILABLE','unreadable SQLite is never NO_RESERVATION');
      assert.equal(readFileSync(garbage,'utf8'),'GARBAGE-NOT-A-SQLITE-FILE\n','sentinel bytes preserved verbatim');
      assert.equal(statSync(garbage).mode&0o777,modeB,'sentinel mode preserved');
      // A SYMLINKED ledger file is OBSERVATION_UNAVAILABLE and never followed.
      rmSync(garbage);symlinkSync(join(fx.stateDir,'never-followed.sentinel'),garbage);
      const sentinel=join(fx.stateDir,'never-followed.sentinel');
      writeFileSync(sentinel,'SENTINEL-BYTES-UNTOUCHED\n',{mode:0o640});
      const sentMode=statSync(sentinel).mode&0o777;
      assert.equal(fx.observe('operation:pan575-unreadable').state,'OBSERVATION_UNAVAILABLE','a symlinked ledger is never followed');
      assert.equal(readFileSync(sentinel,'utf8'),'SENTINEL-BYTES-UNTOUCHED\n','symlink target bytes untouched');
      assert.equal(statSync(sentinel).mode&0o777,sentMode,'symlink target mode untouched');
      // MISSING ledger directory: NO_RESERVATION — DISTINCT from the two
      // unavailable states above.
      rmSync(dirB,{recursive:true,force:true});
      assert.deepEqual(fx.observe('operation:pan575-unreadable'),{state:'NO_RESERVATION',modelUnits:null,runtimeUnits:null,modelConsumed:null,runtimeConsumed:null},'a missing ledger is honestly NO_RESERVATION');
      // CORRUPT accounting (violating the owner STRICT/CHECK schema on
      // purpose): fail-closed as OBSERVATION_UNAVAILABLE, never promoted.
      putConnectionRowV1(fx.profiles,fx.principal,DIGEST_C,'operation:pan575-corrupt');
      const dirC=ownerLedgerDirV1(fx.stateDir,fx.principal,DIGEST_C);
      mkdirSync(dirC,{mode:0o700});
      {const db=new DatabaseSync(join(dirC,'resource-budget.sqlite'));
       createLedgerTableV1(db);
       db.prepare('INSERT INTO reservations VALUES(?,?,?,?,?,?,?,?,?)').run('operation:pan575-corrupt','c'.repeat(64),100000,3,'SETTLED',200000,9,'CORRUPT-SENTINEL',null);
       db.close();}
      const corrupt=fx.observe('operation:pan575-corrupt');
      assert.equal(corrupt.state,'OBSERVATION_UNAVAILABLE','corrupt/mismatched accounting is never promoted to an observation');
      assert.equal(JSON.stringify(corrupt).includes('CORRUPT-SENTINEL'),false,'corrupt row contents never leak');
      // The durability predicate over the ACTUAL observations above.
      const missing={state:'NO_RESERVATION',modelUnits:null,runtimeUnits:null,modelConsumed:null,runtimeConsumed:null};
      const unavailable={state:'OBSERVATION_UNAVAILABLE',modelUnits:null,runtimeUnits:null,modelConsumed:null,runtimeConsumed:null};
      assert.equal(ownerLedgerReservationDurableAcrossReopenV1(missing,structuredClone(missing)),false,'two NO_RESERVATION observations claim nothing about durability');
      assert.equal(ownerLedgerReservationDurableAcrossReopenV1(unavailable,structuredClone(unavailable)),false,'two OBSERVATION_UNAVAILABLE observations claim nothing about durability');
      assert.equal(ownerLedgerReservationDurableAcrossReopenV1(unavailable,missing),false,'unavailable over missing claims nothing');
      const genuine={state:'UNKNOWN_USAGE',modelUnits:100000,runtimeUnits:3,modelConsumed:0,runtimeConsumed:0};
      assert.equal(ownerLedgerReservationDurableAcrossReopenV1(genuine,structuredClone(genuine)),true,'valid equal genuine snapshots across the reopen DO prove durability');
      assert.equal(ownerLedgerReservationDurableAcrossReopenV1(genuine,{state:'UNKNOWN_USAGE',modelUnits:100000,runtimeUnits:3,modelConsumed:1,runtimeConsumed:0}),false,'a changed consumed field breaks the exact tuple');
      assert.equal(ownerLedgerReservationDurableAcrossReopenV1(genuine,{state:'SETTLED',modelUnits:100000,runtimeUnits:3,modelConsumed:0,runtimeConsumed:0}),false,'a changed state label breaks the exact tuple');
      assert.equal(ownerLedgerReservationDurableAcrossReopenV1(genuine,{state:'UNKNOWN_USAGE',modelUnits:200000,runtimeUnits:3,modelConsumed:0,runtimeConsumed:0}),false,'units outside the fixed owner ceiling are corrupt, never durable');
      const corruptPair={state:'SETTLED',modelUnits:100000,runtimeUnits:3,modelConsumed:200000,runtimeConsumed:9};
      assert.equal(ownerLedgerReservationDurableAcrossReopenV1(corruptPair,structuredClone(corruptPair)),false,'equal-but-corrupt accounting can never satisfy the predicate');
      assert.equal(ownerLedgerReservationDurableAcrossReopenV1(null,genuine),false);
      assert.equal(x.posts()===0&&x.requests()===0,true,'pure observation and the predicate never dispatch a provider request');
    }finally{fx.close();}
  }finally{await x.close();rmSync(dir,{recursive:true,force:true});rmSync(recObs,{recursive:true,force:true});}
});
