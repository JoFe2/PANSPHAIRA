// Deterministic PAN575 local-model qualification entrypoint tests. The
// scripted provider here is a self-certified fake provider: it exercises the
// REAL transport/broker/native tools/loop but can NEVER establish model
// provenance or acceptance (receipt keeps realModelAcceptance:false and
// evidenceBinding OWNER_BOUND_NOT_QUALIFIED). No real inference runs here;
// that stays an explicit opt-in outside CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync,readFileSync,statSync,rmSync,symlinkSync,mkdirSync,lstatSync,constants} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ModelAccessBrokerV1,guardModelRequestV1} from '../../dist/packages/contracts/src/model-access-broker.js';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {createNativeCompositionFeedbackToolsV1} from '../../src/pan575/native-composition-tools.mjs';
import {materialInput575} from './protocol-fixture.mjs';
import {runLocalModelQualificationV1,qualificationRequestV1,qualificationPolicyV1,qualificationBudgetV1,qualificationTestDataDigestV1,qualificationWireToolsV1,QUALIFICATION_WIRE_ALIAS_V1} from '../../scripts/run-pan575-local-model-qualification.mjs';
const MODEL='model:local-qwen-test-1',SECRET='test-local-secret-0123456789';
const limits575={maxCostMicros:100000,maxTimeMs:30000,maxTurns:3,maxTools:2,maxRequests:3,maxTokens:4096,maxInputBytes:65536,maxOutputBytes:65536};
const nativeTools=createNativeCompositionFeedbackToolsV1().tools;
const nativeDescriptors=nativeTools.map(t=>t.descriptor);
const wireTools=qualificationWireToolsV1(nativeTools);
const descriptors=wireTools.map(t=>t.descriptor);
const WIRE_PLAN=QUALIFICATION_WIRE_ALIAS_V1['pan522.material.plan'],WIRE_ORDER=QUALIFICATION_WIRE_ALIAS_V1['erp.order.create'];
// The ACTUAL local Qwen server rejects tool names outside [A-Za-z0-9_-];
// the controlled peer enforces the same character set with a portable
// <=64-char cap (compatible with that server and the broker guard).
const PEER_WIRE_NAME=/^[A-Za-z0-9_-]{1,64}$/;
const ARGS_BY_NATIVE={'pan522.material.plan':()=>materialInput575(),'erp.order.create':()=>({requestId:'request:erp-cell-pan575-feedback',sku:'SYN-PAN575',quantity:13})};
const CALL_ID_BY_NATIVE={'pan522.material.plan':'call_local_a1','erp.order.create':'call_local_b2'};
const expectedDigest=qualificationTestDataDigestV1(descriptors);
function scratch(){return mkdtempSync(process.env.TMPDIR+'/pan575q-');}
function secretFile(dir,value=SECRET){const p=join(dir,'local-model.secret');writeFileSync(p,value+'\n',{mode:0o600});return p;}
async function stubProvider({enforceAuth=true,rotateSecretFile=null,getGate=null}={}){
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
      message={content:null,tool_calls:declared.map(name=>{const nativeId=Object.keys(QUALIFICATION_WIRE_ALIAS_V1).find(id=>QUALIFICATION_WIRE_ALIAS_V1[id]===name);
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
  const p=join(dir,'qualification-config.json');
  writeFileSync(p,JSON.stringify({origin,model:MODEL,deploymentId:'stub-loopback-deployment',configurationRevision:1,credentialFile,receiptDir,pricing:{currency:'EUR',revision:1,inputMicrosPerMillionTokens:0,outputMicrosPerMillionTokens:0},limits:limits575,expectedTestDataDigest:expectedDigest,expiresAtMs}));
  return p;
}
const CONSENT_ENV={PAN575_LOCAL_MODEL_QUALIFICATION:'REAL_LOCAL_MODEL_RUN_V1'};

test('575 entrypoint request passes the ACTUAL broker contract; the old invented wire version and the spread-ceiling budget reproduce the exact historical denies with zero provider calls',async()=>{
  const x=await stubProvider();const dir=scratch();try{
    const budget=qualificationBudgetV1(limits575);
    assert.deepEqual(Object.keys(budget).sort(),['maxCostMicros','maxInputBytes','maxOutputBytes','maxRequests','maxTokens','timeoutMs']);
    const policy=qualificationPolicyV1(MODEL,limits575);
    const request=qualificationRequestV1(MODEL,descriptors,budget);
    assert.equal(guardModelRequestV1({...request,schemaVersion:'chimpmaera.model/canonical-model-request/v1'},policy).issues.join(), 'MODEL_REQUEST_VERSION_DENIED');
    assert.equal(guardModelRequestV1({...request,budget:{...budget,maxTimeMs:limits575.maxTimeMs,maxTurns:3,maxTools:2}},policy).issues.join(),'MODEL_BUDGET_SCHEMA_OR_CEILING_DENIED');
    const transport=(await import('../../src/pan565/connection-transport.mjs')).bindModelConnectionTransportV1({
      summary:{connectionId:'connection:pan575-entrypoint-test',routeId:'route:local-openai-chat-completions',provider:'provider:local-inference-sandbox',model:MODEL,protocol:'OPENAI_CHAT_COMPLETIONS',evidenceClass:'OWNER_BOUND_NOT_QUALIFIED',secretReference:'credential-handle:local-model-secret-file',authMethod:'EXISTING_SECRET_REFERENCE',identity:{...(await import('../../src/pan565/connection-transport.mjs')).connectionTransportIdentityV1(),deploymentId:'stub-loopback-deployment',configurationRevision:1},availability:{runtime:true,provider:true,auth:true,model:true,functions:true},selectable:true},
      target:{origin:x.origin,allowedAddresses:['127.0.0.1'],localOnly:true},credentialFile:secretFile(dir),pricing:{currency:'EUR',revision:1,inputMicrosPerMillionTokens:0,outputMicrosPerMillionTokens:0},productGrant:{limits:limits575,testDataDigest:expectedDigest,expiresAtMs:Date.now()+600000}});
    const r=await new ModelAccessBrokerV1(policy).invokeToolStep(request,{schemaVersion:'chimpmaera.model/tool-transcript/v1',messages:[{role:'user',content:request.text}]},(b,s)=>transport.providerToolStepCall(b,s,()=>true,limits575));
    assert.equal(r.outcome,'ALLOW',JSON.stringify(r.issues));
    assert.deepEqual(r.response.toolCallCandidates.map(c=>c.id),['call_local_a1','call_local_b2']);
    assert.equal(x.posts(),1);
  }finally{await x.close();rmSync(dir,{recursive:true,force:true});}
});

test('575 entrypoint child without consent exits 4 before any binding or network action',()=>{
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!['NODE_OPTIONS','NODE_TEST_CONTEXT','PAN575_LOCAL_MODEL_QUALIFICATION'].includes(k)));
  const p=spawnSync(process.execPath,['scripts/run-pan575-local-model-qualification.mjs','--config','/nonexistent/qualification-config.json'],{cwd:new URL('../../',import.meta.url),encoding:'utf8',timeout:15000,env});
  assert.equal(p.status,4,p.stderr);assert.match(p.stdout,/REAL_MODEL_CONSENT_MISSING/);
});

test('575 entrypoint full positive run over scripted fake provider: phases PASS, fresh tool-result challenge actually consumed, receipt 0600, secret never leaks, fake provider still NOT model acceptance',async()=>{
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
    assert.equal(receipt.verdict,'OWNER_BOUND_TOOL_LOOP_OBSERVED_REAL_MODEL_NOT_QUALIFIED');
    assert.equal(receipt.scope.nativeLoop,'OBSERVED_TOOL_LOOP_MODEL_PROVENANCE_PENDING');
    assert.equal(receipt.scope.directTransport,'OBSERVED_OWNER_BOUND_EXCHANGE');
    const receiptText=JSON.stringify(receipt);
    assert.equal(receiptText.includes('REAL_LOCAL_MODEL_TOOL_LOOP_QUALIFIED'),false,'no false real-model qualification label');
    assert.equal(receiptText.includes('QUALIFIED_ACTUAL_LOCAL_MODEL'),false,'no false actual-model loop label');
    assert.equal(receipt.realModelAcceptance,false);assert.equal(receipt.evidenceBinding,'OWNER_BOUND_NOT_QUALIFIED');
    // Durable owner-ledger accounting is NOT integrated in this bounded
    // observation utility; the original criteria stay explicitly unfulfilled.
    assert.equal(receipt.durableOwnerLedger,'NOT_INTEGRATED_ORIGINAL_CRITERIA_UNFULFILLED');
    assert.equal(receipt.scope.browser,'NOT_EXERCISED');assert.equal(receipt.scope.fullIssue575,'NOT_COMPLETE');assert.equal(receipt.scope.fullIssue565,'NOT_IN_SCOPE');
    assert.equal(receipt.syntheticFixturesRelabelled,false);
    assert.equal(receipt.electricityCost,'UNKNOWN_NO_INVOICE');assert.equal(receipt.paidTokenCost,'UNKNOWN_NO_INVOICE');
    assert.equal(receipt.loop.toolReadbacks.length,2);
    // Each action went through a declared wire alias, and the closed mapping
    // bound every alias to the ORIGINAL already-authorized native invoke.
    assert.deepEqual(receipt.loop.toolReadbacks.map(r=>r.toolName),[WIRE_PLAN,WIRE_ORDER]);
    assert.deepEqual(receipt.toolAliasBinding,[['erp.order.create',WIRE_ORDER],['pan522.material.plan',WIRE_PLAN]]);
    assert.deepEqual(receipt.nativeCapabilities,['erp.order.create','pan522.material.plan']);
    assert.deepEqual(receipt.toolWireNames,[WIRE_ORDER,WIRE_PLAN]);
    const text=readFileSync(join(rec,'qualification-receipt.json'),'utf8');
    assert.equal(text.includes(SECRET),false);assert.equal(/sk-|[0-9a-f]{20,}/.test(text.replace(/[a-f0-9]{64}/g,'')),false);
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
    // The corrected aliased descriptors pass the same peer contract.
    const good={model:MODEL,messages:[{role:'user',content:'probe'}],tools:descriptors.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.inputSchema}}))};
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

test('575 wire-alias mapping is closed: missing, unknown, duplicate and provider-unsafe aliases deny; aliases never select arbitrary functions',()=>{
  assert.deepEqual(descriptors.map(d=>d.name),[WIRE_PLAN,WIRE_ORDER],'closed two-entry mapping over the ORIGINAL native tools');
  // Missing mapping: a native capability without any declared alias.
  const extra=[...nativeTools,{descriptor:{name:'third.capability',description:'unmapped',inputSchema:{type:'object'}},invoke:()=>{throw Error('NOT_BOUND');},validate:()=>false}];
  assert.throws(()=>qualificationWireToolsV1(extra),/QUALIFICATION_ALIAS_DENIED/);
  // Unknown mapping: an alias declared for a native id that is not present.
  assert.throws(()=>qualificationWireToolsV1(nativeTools.filter(t=>t.descriptor.name!=='erp.order.create')),/QUALIFICATION_ALIAS_DENIED/);
  // Duplicate alias: two natives would collapse onto one wire name.
  assert.throws(()=>qualificationWireToolsV1(nativeTools,{'pan522.material.plan':'shared_alias','erp.order.create':'shared_alias'}),/QUALIFICATION_ALIAS_DENIED/);
  // Provider-unsafe alias characters or over-long alias.
  assert.throws(()=>qualificationWireToolsV1(nativeTools,{'pan522.material.plan':'Pan522.Material.Plan','erp.order.create':WIRE_ORDER}),/QUALIFICATION_ALIAS_DENIED/);
  assert.throws(()=>qualificationWireToolsV1(nativeTools,{'pan522.material.plan':'p'.repeat(65),'erp.order.create':WIRE_ORDER}),/QUALIFICATION_ALIAS_DENIED/);
  // Bound functions are the ORIGINAL invoke/validate pairs, not copies or
  // model-selectable registry entries: a model-supplied alias can only ever
  // reach the tool it was declared with (unknown names fail in the loop).
  const bound=qualificationWireToolsV1(nativeTools);
  assert.equal(bound[0].invoke===nativeTools[0].invoke&&bound[0].validate===nativeTools[0].validate,true);
  assert.equal(bound[1].invoke===nativeTools[1].invoke&&bound[1].validate===nativeTools[1].validate,true);
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
    assert.equal(parsed.verdict,'OWNER_BOUND_TOOL_LOOP_OBSERVED_REAL_MODEL_NOT_QUALIFIED');
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
