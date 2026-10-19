import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {nativeRows} from '../fixtures/pan515/native-trade-fixture.mjs';
import {nativeViewFixture546} from './native-fixture.mjs';
import {readPan516Procurement,authorizePan516ProcurementCommand,executePan516ProcurementCommand} from '../../src/procurement-434/bestellung-lifecycle.mjs';
import {nativeWorkspaceViewFieldsV1} from '../../src/pan546/native-data-catalog.mjs';

function referenceRequest546(f,t){return {schemaVersion:'pansphaira.workspace-native-reference/read-v1',context:f.verification(t),relationId:'native.order-supplier-reference'};}
function allNativeRows546(f){return nativeRows(f.native.root,"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").map(({name})=>{assert.match(name,/^[A-Za-z0-9_]+$/);return {name,rows:nativeRows(f.native.root,'SELECT * FROM "'+name+'"').sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))};});}

test('DUI-16 native reference contract binds actual source evidence without turning a supplier reference into field or directory rights',async()=>{
 const f=await nativeViewFixture546();try{
  assert.equal(typeof f.reader.referenceEvidence,'function','PAN546_NATIVE_REFERENCE_EVIDENCE_PROVIDER_MISSING');assert.equal(typeof f.data.referenceContract,'function','PAN546_PROTECTED_REFERENCE_CONTRACT_CONSUMER_MISSING');
  const before=allNativeRows546(f),fields=JSON.stringify(nativeWorkspaceViewFieldsV1);
  for(const id of ['AP-PAN516-MATCHED-01','AP-PAN516-PARTIAL-01']){
   const t=f.tab(f.issue(),id),state=readPan516Procurement({root:f.native.root}),source=f.reader.referenceEvidence({tenantId:'tenant-a',objectId:id,expectedRevision:state.revision});
   const expectedDigest=hash({schemaVersion:'pansphaira.native-order-supplier-source-evidence/v1',tenantId:'tenant-a',invoiceId:id,nativeRevision:state.revision,binding:state.binding,orderReference:state.effectiveDraft.bestellungId,supplierReference:state.effectiveDraft.lieferantId,quantityUnit:state.confirmations.at(-1).terms.unit,currency:state.confirmations.at(-1).terms.currency});
   assert.equal(source.sourceDigest,expectedDigest);assert.equal(source.nativeRevision,state.revision);assert.equal(source.sourceRecordCount,1);assert.deepEqual(source.sourceFacts,{orderReference:'AVAILABLE',supplierReference:'AVAILABLE',supplierDisplayName:'UNKNOWN',assignee:'UNAVAILABLE'});
   const r=f.data.referenceContract(t.headers,referenceRequest546(f,t));assert.equal(r.schemaVersion,'pansphaira.workspace-native-reference-contract/v1');assert.equal(r.sourceEvidence.sourceDigest,expectedDigest);assert.equal(r.sourceEvidence.nativeRevision,t.context.primaryObject.revision);assert.equal(r.contextHandle,t.context.contextHandle);assert.equal(r.objectId,id);
   assert.equal(r.state,'UNAVAILABLE');assert.equal(r.reason,'NATIVE_METADATA_OR_FIELD_RIGHTS_NOT_QUALIFIED');assert.equal(r.grain,'ONE_NATIVE_ORDER_SUPPLIER_REFERENCE_NOT_SUPPLIER_ENTITY');assert.equal(r.unit,'NATIVE_REFERENCE_ID');assert.equal(r.rowCount,null,'unavailable is not a fabricated zero-row result');assert.deepEqual(r.rows,[]);assert.deepEqual(r.authorizedFieldIds,[]);assert.equal(r.fieldRightsQualified,false);assert.equal(r.relationRightsQualified,false);assert.equal(r.directoryAvailable,false);assert.equal(r.readOnly,true);assert.equal(r.businessEffectProduced,false);assert.equal(r.executionAuthorityGranted,false);assert.equal(r.bookingAuthorityGranted,false);assert.equal(r.paymentOrderAuthorized,false);assert.deepEqual(r.budgets,{maximumSourceRecords:1,maximumRows:1,maximumRelationDepth:0,paginationAllowed:false,freeQueriesAllowed:false});
   const bytes=JSON.stringify(r);for(const secret of [state.effectiveDraft.bestellungId,state.effectiveDraft.lieferantId,t.headers.cookie,t.headers['x-pan527-csrf']])assert.ok(!bytes.includes(secret),'REFERENCE_CONTRACT_MUST_NOT_PUBLISH_UNGRANTED_VALUE_OR_SESSION');assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.sourceEvidence)&&Object.isFrozen(r.rows));
  }
  assert.equal(JSON.stringify(nativeWorkspaceViewFieldsV1),fields);assert.deepEqual(allNativeRows546(f),before);assert.deepEqual(counts(f),{views:0,history:0,legacy:0});
 }finally{await f.close();}
});

test('DUI-16 native reference contract refuses forged grants fields free queries recursive depth unknown relations and accessors without invoking them',async()=>{
 const f=await nativeViewFixture546();try{
  assert.equal(typeof f.data.referenceContract,'function','PAN546_PROTECTED_REFERENCE_CONTRACT_CONSUMER_MISSING');const t=f.tab(),request=referenceRequest546(f,t),before=allNativeRows546(f);
  for(const extra of [{grant:true},{fieldRightsQualified:true},{fieldIds:['native.supplier.reference']},{query:'SELECT *'},{depth:1},{cursor:'caller-owned'},{filter:{supplier:'invented'}},{sourceEvidence:{sourceDigest:'f'.repeat(64)}}])assert.throws(()=>f.data.referenceContract(t.headers,{...request,...extra}),/DATA_REFERENCE_REQUEST_DENIED/);
  assert.throws(()=>f.data.referenceContract(t.headers,{...request,relationId:'supplier-directory'}),/DATA_REFERENCE_RELATION_DENIED/);assert.throws(()=>f.data.referenceContract(t.headers,{...request,schemaVersion:'v999'}),/DATA_REFERENCE_REQUEST_DENIED/);
  let called=0;const getter={...request};Object.defineProperty(getter,'relationId',{enumerable:true,get(){called++;return request.relationId;}});assert.throws(()=>f.data.referenceContract(t.headers,getter),/DATA_REFERENCE_REQUEST_DENIED/);assert.equal(called,0);
  for(const field of ['native.supplier.reference','native.supplier.displayName','native.assignee','erv.invoice.supplier'])assert.throws(()=>f.query(t,[field]),/DATA_FIELD_DENIED/);
  assert.throws(()=>f.preview(t,[{kind:'BIND',instanceId:'invoice-value',binding:{fieldIds:['native.supplier.reference'],unit:'NATIVE_REFERENCE_ID'}}]),/VIEW_BINDING_DENIED/);assert.deepEqual(allNativeRows546(f),before);assert.deepEqual(counts(f),{views:0,history:0,legacy:0});
 }finally{await f.close();}
});

test('DUI-16 native reference contract rechecks genuine native session tenant subject origin and tab rather than accepting caller rights',async()=>{
 const f=await nativeViewFixture546();try{
  assert.equal(typeof f.data.referenceContract,'function','PAN546_PROTECTED_REFERENCE_CONTRACT_CONSUMER_MISSING');const headers=f.issue(),a=f.tab(headers),b=f.tab(headers),before=allNativeRows546(f),request=referenceRequest546(f,a);
  assert.throws(()=>f.data.referenceContract({},request),/HOSTED_SESSION_DENIED/);assert.throws(()=>f.data.referenceContract({...a.headers,'x-tenant':'tenant-b'},request),/HOSTED_HEADER_AUTHORITY_DENIED/);assert.throws(()=>f.data.referenceContract({...a.headers,'x-role':'reviewer'},request),/HOSTED_HEADER_AUTHORITY_DENIED/);assert.throws(()=>f.data.referenceContract({...a.headers,origin:'https://foreign.invalid'},request),/HOSTED_CSRF_DENIED/);assert.throws(()=>f.data.referenceContract(b.headers,request),/CONTEXT_/);
  const foreign=f.tls.gateway.sessionAdapter('tenant-b'),issued=foreign.issueOwnerSession({subjectId:'synthetic:erv-reviewer',role:'reviewer',expiresAtMs:Date.now()+180000}),foreignHeaders={...a.headers,cookie:issued.cookieHeader,'x-pan527-csrf':issued.csrf};assert.equal(foreign.authenticate(foreignHeaders).tenantId,'tenant-b');assert.throws(()=>f.data.referenceContract(foreignHeaders,request),/HOSTED_SESSION_/);
  assert.throws(()=>{const unknown=f.tab(f.issue('synthetic:unknown-native-subject','reviewer'));return f.data.referenceContract(unknown.headers,referenceRequest546(f,unknown));},/ERV_HUMAN_NATIVE_ROLE|HUMAN_WORKSPACE_SCOPE|HOSTED_ROLE|CONTEXT_/);
  assert.deepEqual(allNativeRows546(f),before);assert.deepEqual(counts(f),{views:0,history:0,legacy:0});
 }finally{await f.close();}
});

test('DUI-16 native reference contract rejects actual changed native revision and preserves all rows after its denied reads',async()=>{
 const f=await nativeViewFixture546();try{
  assert.equal(typeof f.reader.referenceEvidence,'function','PAN546_NATIVE_REFERENCE_EVIDENCE_PROVIDER_MISSING');assert.equal(typeof f.data.referenceContract,'function','PAN546_PROTECTED_REFERENCE_CONTRACT_CONSUMER_MISSING');const t=f.tab(),request=referenceRequest546(f,t),prior=f.data.referenceContract(t.headers,request),state=readPan516Procurement({root:f.native.root});
  // The fixture's native receipts already fill the order. Advance its real
  // source with the existing valid confirmation chain, not an over-receipt.
  const last=state.confirmations.at(-1),command={schemaVersion:'pansphaira.pan516/procurement-command/v1',effectId:'synthetic:pan546-reference-revision',transportId:'synthetic:pan546-reference-revision-wire',expectedRevision:state.revision,orderId:state.effectiveDraft.bestellungId,positionId:state.effectiveDraft.positionen[0].positionId,supplierId:state.effectiveDraft.lieferantId,kind:'CONFIRM',receipt:null,sourceReference:'synthetic:pan546-reference-source',confirmation:{revision:last.revision+1,previousConfirmationDigest:last.confirmationDigest,terms:last.terms,confirmedAt:'2026-07-04T12:00:00Z'}};
  executePan516ProcurementCommand({root:f.native.root,command,grant:authorizePan516ProcurementCommand({root:f.native.root,owner:'LOCAL_SYNTHETIC_OWNER',command})});assert.equal(readPan516Procurement({root:f.native.root}).revision,prior.sourceEvidence.nativeRevision+1);
  const afterOwnedSourceMutation=allNativeRows546(f);assert.throws(()=>f.reader.referenceEvidence({tenantId:'tenant-a',objectId:t.context.primaryObject.objectId,expectedRevision:prior.sourceEvidence.nativeRevision}),/ERV_OBJECT_REVISION_STALE/);assert.throws(()=>f.data.referenceContract(t.headers,request),/ERV_OBJECT_REVISION_STALE|CONTEXT_REVISION_STALE/);assert.deepEqual(allNativeRows546(f),afterOwnedSourceMutation);assert.deepEqual(counts(f),{views:0,history:0,legacy:0});
 }finally{await f.close();}
});
const move=position=>[{kind:'MOVE',instanceId:'native-review',position}];
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function counts(f){const db=new DatabaseSync(join(f.root,'browser-profiles.sqlite'),{readOnly:true});try{return {views:db.prepare('SELECT COUNT(*) AS n FROM workspace_module_views').get().n,history:db.prepare('SELECT COUNT(*) AS n FROM workspace_module_view_history').get().n,legacy:db.prepare('SELECT COUNT(*) AS n FROM browser_profiles').get().n};}finally{db.close();}}
test('DUI-04 two actually allowed native invoices plus independent Human read supply real source revisions, units and no invented relations',async()=>{
 const f=await nativeViewFixture546();try{
  for(const id of ['AP-PAN516-MATCHED-01','AP-PAN516-PARTIAL-01']){
   const t=f.tab(f.issue(),id),q=f.query(t,['erv.invoice.amountMinor','erv.invoice.currency','erv.invoice.liabilityStatus','erv.human.reviewState']);
   const invoice=f.reader.read({tenantId:'tenant-a',objectId:id,expectedRevision:t.context.primaryObject.revision}),human=f.human.read(t.headers,{invoiceId:id});
   assert.equal(q.cells[0].value,invoice.invoiceAmountMinor);assert.equal(q.cells[0].unit,'CURRENCY_MINOR');assert.equal(q.cells[1].value,invoice.currency);assert.equal(q.cells[2].value,invoice.status);assert.equal(q.cells[3].value,human.state);assert.notEqual(q.cells[3].value,invoice.status);assert.equal(q.cells[3].source,'HUMAN_NATIVE');assert.equal(q.cells[3].sourceRevision,human.proposalRevision);assert.deepEqual(q.sourceRevisions,{erv:invoice.revision,human:human.proposalRevision});assert.equal(q.businessEffectProduced,false);
   assert.ok(q.unavailableRelations.every(x=>x.state==='UNAVAILABLE'&&!Object.hasOwn(x,'value')));assert.throws(()=>f.query(t,['erv.invoice.supplier']),/DATA_FIELD_DENIED/);assert.throws(()=>f.query(t,['erv.human.assignee']),/DATA_FIELD_DENIED/);assert.throws(()=>f.query(t,Array(9).fill('erv.invoice.currency')),/DATA_QUERY_BUDGET_DENIED/);assert.throws(()=>f.data.read(t.headers,{schemaVersion:'pansphaira.workspace-data-read/v1',context:f.verification(t),fieldIds:['erv.invoice.currency'],query:'SELECT *'}),/DATA_QUERY_DENIED/);assert.throws(()=>f.data.metadata({...t.headers,'x-tenant':'tenant-b'},f.verification(t)),/HOSTED_HEADER_AUTHORITY_DENIED/);
  }
  assert.equal(nativeRows(f.native.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0);assert.deepEqual(counts(f),{views:0,history:0,legacy:0});
 }finally{await f.close();}
});
test('DUI-03 native manual/agent candidates have identical digest; preview and cancel have no persistence; confirmed target requires independent GET',async()=>{
 const f=await nativeViewFixture546();try{
  const t=f.tab(),principal=f.sessions.authenticate(t.headers),legacy=JSON.stringify(f.legacy.read(principal)),native=f.reader.read({tenantId:'tenant-a',objectId:t.context.primaryObject.objectId,expectedRevision:null});
  const manual=f.preview(t,move(0)),agent=f.preview(t,JSON.parse(JSON.stringify(move(0))));assert.equal(manual.candidateDigest,agent.candidateDigest);assert.equal(manual.afterDigest,agent.afterDigest);assert.equal(agent.previewOnly,true);assert.equal(agent.persistenceProduced,false);assert.deepEqual(counts(f),{views:0,history:0,legacy:0});
  const {confirmation,...cancel}=f.confirmation(t,agent);const cancelled=f.view.cancel(t.headers,{...cancel,schemaVersion:'pansphaira.workspace-module-view/cancel/v1'});assert.equal(cancelled.outcome,'VIEW_PREVIEW_CANCELLED');assert.deepEqual(counts(f),{views:0,history:0,legacy:0});assert.equal(JSON.stringify(f.legacy.read(principal)),legacy);assert.deepEqual(f.reader.read({tenantId:'tenant-a',objectId:t.context.primaryObject.objectId,expectedRevision:null}),native);assert.equal(nativeRows(f.native.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0);
 }finally{await f.close();}
});
test('DUI-03 persisted personal view is separate from native facts/legacy bytes and exactly read back through another actual SQLite connection',async()=>{
 const f=await nativeViewFixture546();try{
  const t=f.tab(),principal=f.sessions.authenticate(t.headers),legacy=JSON.stringify(f.legacy.read(principal)),fact=f.reader.read({tenantId:'tenant-a',objectId:t.context.primaryObject.objectId,expectedRevision:null});
  const p=f.preview(t,[...move(0),{kind:'RESIZE',instanceId:'native-review',size:'large'},{kind:'SHOW',instanceId:'invoice-table',visible:false}]);const receipt=f.view.confirm(t.headers,f.confirmation(t,p));assert.equal(receipt.revision,1);assert.equal(receipt.independentReadbackRequired,true);assert.equal(receipt.confirmedCandidateDigest,p.candidateDigest);
  assert.throws(()=>f.context.verify(t.headers,f.verification(t)),/CONTEXT_REVISION_STALE/);f.fresh(t);
  const read=f.otherView.read(t.headers,f.verification(t));assert.equal(read.independentNativeRead,true);assert.equal(read.revision,1);assert.deepEqual(read.view,p.afterView);assert.equal(read.viewDigest,p.afterDigest);assert.equal(read.confirmedCandidateDigest,p.candidateDigest);assert.equal(read.persisted,true);assert.equal(JSON.stringify(f.legacy.read(principal)),legacy);assert.deepEqual(f.reader.read({tenantId:'tenant-a',objectId:t.context.primaryObject.objectId,expectedRevision:null}),fact);assert.equal(nativeRows(f.native.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0);assert.deepEqual(counts(f),{views:1,history:2,legacy:0});
 }finally{await f.close();}
});
test('DUI-03 two authenticated tabs and two real connections cannot overwrite the same CAS revision or replay an uncertain already persisted write',async()=>{
 const f=await nativeViewFixture546();try{
  const headers=f.issue(),a=f.tab(headers),b=f.tab(headers),pa=f.preview(a,move(0)),pb=f.preview(b,move(1),f.otherView);assert.equal(pa.expectedRevision,pb.expectedRevision);
  const c=f.confirmation(a,pa),receipt=f.view.confirm(a.headers,c);assert.equal(receipt.revision,1);
  assert.throws(()=>f.otherView.confirm(b.headers,f.confirmation(b,pb)),/CONTEXT_REVISION_STALE|VIEW_REVISION_CONFLICT/);assert.throws(()=>f.view.confirm(a.headers,c),/CONTEXT_REVISION_STALE|VIEW_CANDIDATE_EXPIRED_OR_CONSUMED/);
  const principal=f.sessions.authenticate(b.headers);assert.throws(()=>f.otherStore.write(principal,{expectedRevision:0,view:pb.afterView,viewDigest:pb.afterDigest,candidateDigest:pb.candidateDigest}),/VIEW_REVISION_CONFLICT/);f.fresh(b);const read=f.otherView.read(b.headers,f.verification(b));assert.equal(read.revision,1);assert.equal(read.confirmedCandidateDigest,pa.candidateDigest);assert.equal(read.viewDigest,pa.afterDigest);assert.deepEqual(counts(f),{views:1,history:2,legacy:0});
 }finally{await f.close();}
});
test('DUI-03 changed consent digest, foreign tab/session and role spoof deny; personal reader save never grants Human mutation authority',async()=>{
 const f=await nativeViewFixture546();try{
  const headers=f.issue(),a=f.tab(headers),b=f.tab(headers),p=f.preview(a,move(0)),c=f.confirmation(a,p);
  assert.throws(()=>f.view.confirm(a.headers,{...c,candidateDigest:'f'.repeat(64)}),/VIEW_CANDIDATE_MODIFIED_DENIED/);assert.throws(()=>f.view.confirm(b.headers,{...c,context:f.verification(b)}),/VIEW_CANDIDATE_STALE/);
  const reader=f.tab(f.issue('synthetic:erv-reader','reader')),rp=f.preview(reader,move(0));assert.throws(()=>f.view.confirm({...a.headers,'x-role':'reviewer'},c),/HOSTED_HEADER_AUTHORITY_DENIED/);assert.throws(()=>f.view.confirm(a.headers,{...c,view:p.afterView}),/VIEW_CANDIDATE_COMMAND_DENIED/);assert.throws(()=>f.view.confirm(a.headers,{...c,confirmation:'YES'}),/VIEW_CONFIRMATION_DENIED/);assert.throws(()=>f.view.confirm({...a.headers,origin:'https://foreign.invalid'},c),/HOSTED_CSRF_DENIED/);
  const relogin=f.tab(f.issue());assert.throws(()=>f.view.confirm(relogin.headers,{...c,context:f.verification(relogin)}),/VIEW_CANDIDATE_STALE/);assert.deepEqual(counts(f),{views:0,history:0,legacy:0});assert.equal(nativeRows(f.native.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0);
  const allowed=f.view.confirm(reader.headers,f.confirmation(reader,rp));assert.equal(allowed.businessEffectProduced,false);assert.equal(allowed.executionAuthorityGranted,false);f.fresh(reader);assert.equal(f.otherView.read(reader.headers,f.verification(reader)).viewDigest,rp.afterDigest);
  const proposal=f.human.read(reader.headers,{invoiceId:reader.context.primaryObject.objectId});assert.throws(()=>f.human.decide(reader.headers,{schemaVersion:'pansphaira.erv-human/decision/v1',invoiceId:proposal.invoiceId,effectId:'synthetic:pan546-reader-denied',transportId:'synthetic:pan546-reader-denied-wire',expectedNativeRevision:proposal.nativeRevision,expectedProposalRevision:proposal.proposalRevision,proposalDigest:proposal.proposalDigest,action:'REVIEW'}),/HOSTED_ROLE_DENIED/);assert.equal(nativeRows(f.native.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,0);assert.deepEqual(counts(f),{views:1,history:2,legacy:0});
 }finally{await f.close();}
});
test('DUI-03 saved Undo creates a new authorized CAS revision and cannot roll over a concurrent edit',async()=>{
 const f=await nativeViewFixture546();try{
  const headers=f.issue(),a=f.tab(headers),b=f.tab(headers);let p=f.preview(a,move(0));f.view.confirm(a.headers,f.confirmation(a,p));f.fresh(a);f.fresh(b);
  const undo=f.view.previewUndo(a.headers,{schemaVersion:'pansphaira.workspace-module-view/undo-preview/v1',context:f.verification(a),targetRevision:0});const concurrent=f.preview(b,[{kind:'RESIZE',instanceId:'native-review',size:'large'}],f.otherView);f.otherView.confirm(b.headers,f.confirmation(b,concurrent));
  assert.throws(()=>f.view.confirm(a.headers,f.confirmation(a,undo)),/CONTEXT_REVISION_STALE|VIEW_REVISION_CONFLICT/);f.fresh(a);
  const actualUndo=f.view.previewUndo(a.headers,{schemaVersion:'pansphaira.workspace-module-view/undo-preview/v1',context:f.verification(a),targetRevision:0});const receipt=f.view.confirm(a.headers,f.confirmation(a,actualUndo));assert.equal(receipt.revision,3);assert.equal(receipt.kind,'UNDO');f.fresh(a);const read=f.otherView.read(a.headers,f.verification(a));assert.equal(read.revision,3);assert.equal(read.viewDigest,actualUndo.afterDigest);assert.equal(read.view.instances[0].instanceId,'invoice-value');assert.equal(f.otherStore.historical(f.sessions.authenticate(a.headers),2).viewDigest,concurrent.afterDigest);assert.deepEqual(counts(f),{views:1,history:4,legacy:0});
 }finally{await f.close();}
});
test('DUI-03 actual fresh Node process and relogin read persisted view/digest/CAS; session cookie and invoice values are absent from view JSON',async()=>{
 const f=await nativeViewFixture546();try{
  const t=f.tab(),p=f.preview(t,move(0));f.view.confirm(t.headers,f.confirmation(t,p));const principal=f.sessions.authenticate(t.headers);
  const program="import {createWorkspaceModuleViewStoreV1} from './src/pan543/profile-store.mjs';import {nativeWorkspaceViewFieldsV1} from './src/pan546/native-data-catalog.mjs';const s=createWorkspaceModuleViewStoreV1({root:process.argv[1],fields:nativeWorkspaceViewFieldsV1});console.log(JSON.stringify(s.read(JSON.parse(process.argv[2]))));s.close();";
  const child=spawnSync(process.execPath,['--input-type=module','-e',program,f.root,JSON.stringify(principal)],{encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stderr);const actual=JSON.parse(child.stdout);assert.equal(actual.revision,1);assert.equal(actual.viewDigest,p.afterDigest);assert.equal(actual.confirmedCandidateDigest,p.candidateDigest);assert.equal(hash(actual.view),p.afterDigest);
  const relogin=f.tab(f.issue());assert.equal(f.view.read(relogin.headers,f.verification(relogin)).viewDigest,p.afterDigest);
  const db=new DatabaseSync(join(f.root,'browser-profiles.sqlite'),{readOnly:true});try{const row=db.prepare('SELECT view_json FROM workspace_module_views').get();assert.ok(!row.view_json.includes(t.headers.cookie));assert.ok(!row.view_json.includes('invoiceAmountMinor'));assert.ok(!row.view_json.includes('subjectId'));assert.ok(!row.view_json.includes('tenantId'));}finally{db.close();}
 }finally{await f.close();}
});
test('DUI-04 native Human revision advances independently of liability and invalidates prior view consent without writing a personal view',async()=>{
 const f=await nativeViewFixture546();try{
  const t=f.tab(),p=f.preview(t,move(0)),before=f.query(t,['erv.invoice.liabilityStatus','erv.human.reviewState']),proposal=f.human.read(t.headers,{invoiceId:t.context.primaryObject.objectId});
  f.human.decide(t.headers,{schemaVersion:'pansphaira.erv-human/decision/v1',invoiceId:proposal.invoiceId,effectId:'synthetic:pan546-source-drift-001',transportId:'synthetic:pan546-source-drift-wire',expectedNativeRevision:proposal.nativeRevision,expectedProposalRevision:proposal.proposalRevision,proposalDigest:proposal.proposalDigest,action:'REVIEW'});
  const after=f.query(t,['erv.invoice.liabilityStatus','erv.human.reviewState']);assert.equal(after.sourceRevisions.erv,before.sourceRevisions.erv);assert.equal(after.sourceRevisions.human,before.sourceRevisions.human+1);assert.equal(after.cells[0].value,before.cells[0].value);assert.notEqual(after.cells[1].value,before.cells[1].value);assert.throws(()=>f.view.confirm(t.headers,f.confirmation(t,p)),/VIEW_CANDIDATE_STALE/);assert.deepEqual(counts(f),{views:0,history:0,legacy:0});assert.equal(nativeRows(f.native.root,'SELECT COUNT(*) AS count FROM pan542_events')[0].count,1,'only the separately authorized actual Human decision occurred, not the view attempt');
 }finally{await f.close();}
});
