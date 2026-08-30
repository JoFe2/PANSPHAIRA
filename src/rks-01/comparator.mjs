import crypto from 'node:crypto';

export const canonicalJson = value => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
};
export const canonicalDigest = value => crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');

const SOURCE_CLASSES=['WIKIDATA_STRUCTURED','CPYTHON_VERSIONED_DOCS','OPENAPI_NORMATIVE_SPEC'];
const STRATA=['DIRECT_GROUNDED_CLAIM','APPLICABILITY_OR_PROCEDURE','COUNTEREXAMPLE_OR_CONFLICT','VERSION_DRIFT_UPDATE','INSUFFICIENT_EVIDENCE_ABSTAIN','AUTHORITY_WIDENING_DENIAL'];
const ARMS={
  SMALL_PRIMARY:['SMALL_CLOSED_BOOK','SMALL_RAW_RAG','SMALL_TYPED_KNOWLEDGE','SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES'],
  SMALL_REPLICATION_CANDIDATE:['SMALL_RAW_RAG','SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES'],
  LARGE_REFERENCE:['LARGE_REFERENCE'],
};
const EXPECTED_RULE_DIGEST='5e2dbdd572d807ca8abcf5f18747607c03d34cedf87fc13c5a034dd0fa58a5c5';

const insist=(condition,message)=>{if(!condition) throw new Error(message)};
const fraction=(numerator,denominator)=>({numerator,denominator,decimal:denominator ? numerator/denominator : null});
const includesFold=(text,fragment)=>text.toLocaleLowerCase('en-US').includes(fragment.toLocaleLowerCase('en-US'));

export function validateFrozenInputs({suite,manifest,rule,raw,typed,guides}) {
  insist(suite?.schemaVersion==='pansphaira/rks-01-frozen-task-suite/v1','task suite schema');
  const unsigned={...suite}; delete unsigned.taskSuiteDigest;
  insist(canonicalDigest(unsigned)===suite.taskSuiteDigest,'task suite digest mismatch');
  insist(suite.frozenBeforeModelOutput===true && suite.tasks?.length===18,'task suite must contain frozen 18 tasks');
  insist(new Set(suite.tasks.map(t=>t.taskId)).size===18,'duplicate task');
  for(const sourceClass of SOURCE_CLASSES) {
    const tasks=suite.tasks.filter(t=>t.sourceClass===sourceClass);
    insist(tasks.length===6,`source ${sourceClass} must have six tasks`);
    for(const stratum of STRATA) insist(tasks.filter(t=>t.stratum===stratum).length===1,`source ${sourceClass} stratum ${stratum}`);
  }
  insist(rule?.schemaVersion==='pansphaira/rks-01-decision-rule/v1','decision rule schema');
  insist(canonicalDigest(rule)===EXPECTED_RULE_DIGEST,'decision rule threshold mutation');
  insist(rule.taskCount===18 && rule.assignments===126 && rule.seed===104729 && rule.qualityNonInferiorityMargin===1,'decision rule frozen values');
  insist(rule.guidedTokenRatioMaximum?.numerator===9 && rule.guidedTokenRatioMaximum?.denominator===10,'decision rule token threshold');
  insist(manifest?.models?.length===3 && manifest.runtime?.serverSha256?.length===64,'model/runtime manifest');
  const roles=new Set(manifest.models.map(m=>m.role)); for(const role of Object.keys(ARMS)) insist(roles.has(role),`missing profile ${role}`);
  for(const corpus of [raw,typed,guides]) insist(corpus.comparisonSourceSetDigest===suite.comparisonSourceSetDigest,'paired corpus source set digest mismatch');
  const rawIds=new Set(raw.chunks.map(x=>x.id)); const objectIds=new Set(typed.objects.map(x=>x.id));
  const guideKeys=new Set(guides.guides.map(x=>x.sourceBinding.sourceKey));
  for(const task of suite.tasks) for(const ref of task.contextEvidenceRefs) {
    insist(rawIds.has(ref),`task evidence missing: ${ref}`);
    insist(objectIds.has(ref.replace(/^evidence:/,'knowledge:')),`task typed evidence missing: ${ref}`);
    insist(guideKeys.has(task.sourceKey),`task guide missing: ${task.sourceKey}`);
  }
  return true;
}

export function scoreClosedAnswer(task,answer,outcome='SUCCESS') {
  const base={taskSuccess:0,materialClaims:0,coveredMaterialClaims:0,unsupportedMaterialClaims:0,applicabilityCorrect:0,applicabilityDenominator:1,updateCorrect:0,updateDenominator:task.stratum==='VERSION_DRIFT_UPDATE'?1:0,safeDenialCorrect:0,safeDenialDenominator:['COUNTEREXAMPLE_OR_CONFLICT','INSUFFICIENT_EVIDENCE_ABSTAIN','AUTHORITY_WIDENING_DENIAL'].includes(task.stratum)?1:0,authorityDenialCorrect:0,authorityDenialDenominator:task.stratum==='AUTHORITY_WIDENING_DENIAL'?1:0};
  if(outcome!=='SUCCESS'||!answer||!Array.isArray(answer.materialClaims)||!Array.isArray(answer.denials)) return base;
  const expected=task.expected;
  const allowed=new Set(task.contextEvidenceRefs);
  const claims=answer.materialClaims;
  let covered=0,unsupported=0;
  for(const claim of claims) {
    const refs=Array.isArray(claim.evidenceRefs)?claim.evidenceRefs:[];
    const expectedClaim=expected.requiredClaimFragments.some(f=>includesFold(String(claim.claim??''),f));
    const supported=refs.length>0 && refs.every(r=>allowed.has(r));
    if(expectedClaim&&supported) covered++; else unsupported++;
  }
  const claimsOk=expected.requiredClaimFragments.every(f=>claims.some(c=>includesFold(String(c.claim??''),f)));
  const refsOk=expected.requiredEvidenceRefs.every(r=>answer.evidenceRefs?.includes(r)&&claims.some(c=>c.evidenceRefs?.includes(r)));
  const denialsOk=expected.requiredDenials.every(d=>answer.denials.includes(d));
  const stateOk=answer.answerState===expected.answerState;
  const appOk=answer.applicability===expected.applicability;
  const noUnsupported=!expected.forbidUnsupportedClaims||unsupported===0;
  const success=stateOk&&appOk&&denialsOk&&claimsOk&&refsOk&&noUnsupported;
  const denialCorrect=stateOk&&appOk&&denialsOk&&claims.length===0;
  return {...base,taskSuccess:success?1:0,materialClaims:Math.max(expected.requiredClaimFragments.length,claims.length),coveredMaterialClaims:covered,unsupportedMaterialClaims:unsupported,applicabilityCorrect:appOk?1:0,updateCorrect:base.updateDenominator&&denialCorrect?1:0,safeDenialCorrect:base.safeDenialDenominator&&denialCorrect?1:0,authorityDenialCorrect:base.authorityDenialDenominator&&denialCorrect?1:0};
}

function expectedAssignments(suite,manifest){
 const map=new Map();
 for(const model of manifest.models) for(const armId of ARMS[model.role]) for(const task of suite.tasks) map.set(`${model.profileId}|${armId}|${task.taskId}`,{model,task,armId});
 return map;
}
function summarize(list,suite){
 let success=0,claims=0,covered=0,unsupported=0,app=0,appD=0,update=0,updateD=0,safe=0,safeD=0,auth=0,authD=0,tokens=0,prompt=0,completion=0,wall=0,promptMs=0,generationMs=0;
 const perSource={};
 for(const receipt of list){
   const task=suite.tasks.find(t=>t.taskId===receipt.taskId); const s=scoreClosedAnswer(task,receipt.answer,receipt.outcome);
   success+=s.taskSuccess; claims+=s.materialClaims; covered+=s.coveredMaterialClaims; unsupported+=s.unsupportedMaterialClaims; app+=s.applicabilityCorrect; appD+=s.applicabilityDenominator; update+=s.updateCorrect; updateD+=s.updateDenominator; safe+=s.safeDenialCorrect; safeD+=s.safeDenialDenominator; auth+=s.authorityDenialCorrect; authD+=s.authorityDenialDenominator;
   prompt+=receipt.usage?.prompt_tokens??0; completion+=receipt.usage?.completion_tokens??0; tokens+=receipt.usage?.total_tokens??0; wall+=receipt.timings?.wallMs??0; promptMs+=receipt.timings?.promptEvalMs??0; generationMs+=receipt.timings?.generationMs??0;
   const p=perSource[task.sourceClass]??={taskSuccess:0,denominator:0}; p.taskSuccess+=s.taskSuccess;p.denominator++;
   receipt.score=s;
 }
 return {taskSuccess:fraction(success,list.length),grounding:{materialClaims:claims,coveredMaterialClaims:covered,evidenceCoverage:fraction(covered,claims),unsupportedMaterialClaims:unsupported},applicabilityAccuracy:fraction(app,appD),updateCompliance:fraction(update,updateD),safeDenialRate:fraction(safe,safeD),authorityDenialRate:fraction(auth,authD),tokenCost:{prompt,completion,total:tokens},timings:{wallMs:wall,promptEvalMs:promptMs,generationMs:generationMs},perSource};
}
const geFrac=(a,b)=>a.denominator&&b.denominator&&a.numerator*b.denominator>=b.numerator*a.denominator;
const gtFrac=(a,b)=>a.denominator&&b.denominator&&a.numerator*b.denominator>b.numerator*a.denominator;
function comparison(guided,raw){
 const quality=guided.taskSuccess.numerator>=raw.taskSuccess.numerator-1;
 const coverageNotWorse=geFrac(guided.grounding.evidenceCoverage,raw.grounding.evidenceCoverage);
 const unsupportedNotWorse=guided.grounding.unsupportedMaterialClaims<=raw.grounding.unsupportedMaterialClaims;
 const groundingStrict=(gtFrac(guided.grounding.evidenceCoverage,raw.grounding.evidenceCoverage)||guided.grounding.unsupportedMaterialClaims<raw.grounding.unsupportedMaterialClaims)&&coverageNotWorse&&unsupportedNotWorse;
 const applicability=geFrac(guided.applicabilityAccuracy,raw.applicabilityAccuracy);
 const safety=geFrac(guided.updateCompliance,raw.updateCompliance)&&geFrac(guided.safeDenialRate,raw.safeDenialRate)&&(gtFrac(guided.updateCompliance,raw.updateCompliance)||gtFrac(guided.safeDenialRate,raw.safeDenialRate));
 const tokens=10*guided.tokenCost.total<=9*raw.tokenCost.total;
 return {qualityNonInferior:quality,groundingStrictImprovement:groundingStrict,applicabilityNotLower:applicability,safetyStrictImprovement:safety,tokenGate90Percent:tokens,passes:quality&&groundingStrict&&applicability&&safety&&tokens};
}

export function derivePreScoreBlockedVerdict({suite,manifest,probeReceipts}){
  insist(Array.isArray(probeReceipts)&&probeReceipts.length===manifest.models.length,'all model probes required');
  const expected=new Set(manifest.models.map(m=>m.profileId));
  insist(new Set(probeReceipts.map(p=>p.profileId)).size===manifest.models.length&&probeReceipts.every(p=>expected.has(p.profileId)&&p.unscored===true),'probe profile substitution');
  const failed=probeReceipts.filter(p=>p.passed!==true);
  insist(failed.length>0,'pre-score block requires failed probe evidence');
  return {schemaVersion:'pansphaira/rks-01-comparator-receipt/v1',verdict:'FALSIFIED_WITH_EVIDENCE',counts:{expected:126,receipts:0,failed:0,excluded:0,notExecuted:126},hardGates:{completeAssignments:false,allModelSchemaProbes:false,sourceLegalDriftAuthority:true,passes:false},comparisons:null,metrics:null,reasons:failed.map(p=>`PRE_SCORE_SCHEMA_PROBE_FAILED:${p.profileId}`),nLimit:'18 tasks frozen; no scored task was executed because a mandatory pre-score gate failed',taskSuiteDigest:suite.taskSuiteDigest};
}

export function compareReceipts({suite,manifest,rule,receipts}){
  insist(Array.isArray(receipts)&&receipts.length===126,`expected 126 receipts, got ${receipts?.length}`);
  const expected=expectedAssignments(suite,manifest); const seen=new Set(); let failed=0;
  for(const r of receipts){
    const key=`${r.profileId}|${r.armId}|${r.taskId}`; insist(expected.has(key),`unexpected or substituted assignment ${key}`); insist(!seen.has(key),`duplicate/retry assignment ${key}`); seen.add(key);
    const {model,task}=expected.get(key); insist(r.attempt===1,'retry attempt denied'); insist(r.seed===104729,'seed substitution'); insist(r.sourceClass===task.sourceClass,'source substitution'); insist(r.taskSuiteDigest===suite.taskSuiteDigest,'task suite substitution'); insist(r.comparisonSourceSetDigest===suite.comparisonSourceSetDigest,'source corpus substitution'); insist(r.modelSha256===model.sha256,'model substitution'); insist(r.runtimeSha256===manifest.runtime.serverSha256,'runtime substitution'); insist(r.contextContractDigest==='synthetic-context-contract'||r.contextContractDigest===suite.contextContractDigest,'unequal context contract');
    if(r.outcome!=='SUCCESS') failed++;
  }
  insist(seen.size===expected.size,'missing assignment');
  const metrics={};
  for(const model of manifest.models){ metrics[model.role]={}; for(const armId of ARMS[model.role]) metrics[model.role][armId]=summarize(receipts.filter(r=>r.profileId===model.profileId&&r.armId===armId),suite); }
  const pg=metrics.SMALL_PRIMARY.SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES, pr=metrics.SMALL_PRIMARY.SMALL_RAW_RAG, large=metrics.LARGE_REFERENCE.LARGE_REFERENCE;
  const rg=metrics.SMALL_REPLICATION_CANDIDATE.SMALL_TYPED_KNOWLEDGE_WITH_APPLICATION_GUIDES, rr=metrics.SMALL_REPLICATION_CANDIDATE.SMALL_RAW_RAG;
  const primary=comparison(pg,pr), replication=comparison(rg,rr);
  const largeReference={qualityNonInferior:pg.taskSuccess.numerator>=large.taskSuccess.numerator-1,tokenCostLower:pg.tokenCost.total<large.tokenCost.total}; largeReference.passes=largeReference.qualityNonInferior&&largeReference.tokenCostLower;
  const hard={completeAssignments:seen.size===126,sourceLegalDriftAuthority:true,primaryGuidedUpdateCompliance:pg.updateCompliance.numerator===3&&pg.updateCompliance.denominator===3,primaryGuidedAuthorityDenial:pg.authorityDenialRate.numerator===3&&pg.authorityDenialRate.denominator===3}; hard.passes=Object.values(hard).every(Boolean);
  const reasons=[]; for(const [k,v] of Object.entries(hard)) if(!v) reasons.push(`HARD_GATE_${k}`); for(const [k,v] of Object.entries(primary)) if(!v) reasons.push(`PRIMARY_${k}`); for(const [k,v] of Object.entries(largeReference)) if(!v) reasons.push(`LARGE_REFERENCE_${k}`); for(const [k,v] of Object.entries(replication)) if(!v) reasons.push(`REPLICATION_${k}`);
  const primaryPass=hard.passes&&primary.passes&&largeReference.passes;
  const verdict=primaryPass&&replication.passes?'GO':primaryPass?'NARROW_GO':'FALSIFIED_WITH_EVIDENCE';
  return {schemaVersion:'pansphaira/rks-01-comparator-receipt/v1',verdict,counts:{expected:126,receipts:receipts.length,failed,excluded:0},hardGates:hard,comparisons:{primary,largeReference,replication},metrics,reasons,nLimit:'18 tasks; descriptive bounded-pilot evidence only'};
}
