// Additive PAN605 browser-only handshake contract. Not display authorization.
import {canonicalJson} from './canonical-json.js';
import {surfaceRecordV2} from './workspace-surface-v2.js';
export interface WorkspaceBrowserPairV1 {
 readonly schemaVersion:'pansphaira.workspace-surface/browser-pair-readback/v1';
 readonly pairId:string;readonly state:'OFFERED'|'CLAIMED'|'PAIRED'|'REVOKED'|'EXPIRED'|'UNAVAILABLE';
 readonly sourceSurfaceId:string;readonly targetSurfaceId:string|null;readonly scopeDigest:string;
 readonly scope:Readonly<{schemaVersion:'pansphaira.workspace-surface/browser-pair-scope/v1';origin:string;workspaceId:string;routeId:'pan.erv.document.v2';objectId:string;dataRevision:number;projectionDigest:string;fieldProjectionGrant:null;dataClassGrant:null}>;
 readonly claimExpiresAtMs:number;readonly expiresAtMs:number;readonly code?:string;
 readonly projectionDeliveryGranted:false;readonly fieldProjectionGranted:false;readonly physicalDeviceQualified:false;readonly humanPerceptionConfirmed:false;
}
const noGrants=['businessEffectProduced','personalViewPersistenceProduced','executionAuthorityGranted','modelAcceptance','projectionDeliveryGranted','fieldProjectionGranted','physicalDeviceQualified','humanPerceptionConfirmed'];
const surface=(v:unknown)=>typeof v==='string'&&/^surface:[a-f0-9]{32}$/.test(v);
const digest=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function exact(v:Record<string,unknown>,keys:string[]){if(Reflect.ownKeys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))throw Error('BROWSER_PAIR_RESPONSE_DENIED');}
export async function verifyWorkspaceBrowserPairV1(value:unknown,origin:string):Promise<WorkspaceBrowserPairV1>{
 const v=surfaceRecordV2(value),scope=surfaceRecordV2(v.scope);exact(v,['schemaVersion','pairId','state','sourceSurfaceId','targetSurfaceId','scope','scopeDigest','claimExpiresAtMs','expiresAtMs',...noGrants,...(Object.hasOwn(v,'code')?['code']:[])]);
 exact(scope,['schemaVersion','origin','workspaceId','routeId','objectId','dataRevision','projectionDigest','fieldProjectionGrant','dataClassGrant']);
 if(v.schemaVersion!=='pansphaira.workspace-surface/browser-pair-readback/v1'||typeof v.pairId!=='string'||!/^pair:[a-f0-9]{32}$/.test(v.pairId)||!['OFFERED','CLAIMED','PAIRED','REVOKED','EXPIRED','UNAVAILABLE'].includes(String(v.state))||!surface(v.sourceSurfaceId)||v.targetSurfaceId!==null&&!surface(v.targetSurfaceId)||!digest(v.scopeDigest)||noGrants.some(k=>v[k]!==false)||!Number.isSafeInteger(v.claimExpiresAtMs)||!Number.isSafeInteger(v.expiresAtMs)||Number(v.claimExpiresAtMs)<1||Number(v.expiresAtMs)<Number(v.claimExpiresAtMs)||Object.hasOwn(v,'code')&&(v.state!=='OFFERED'||typeof v.code!=='string'||!/^[a-f0-9]{20}$/.test(v.code)))throw Error('BROWSER_PAIR_RESPONSE_DENIED');
 if(scope.schemaVersion!=='pansphaira.workspace-surface/browser-pair-scope/v1'||scope.origin!==origin||typeof scope.workspaceId!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(scope.workspaceId)||scope.routeId!=='pan.erv.document.v2'||!['AP-PAN516-MATCHED-01','AP-PAN516-PARTIAL-01'].includes(String(scope.objectId))||!Number.isSafeInteger(scope.dataRevision)||Number(scope.dataRevision)<0||!digest(scope.projectionDigest)||scope.fieldProjectionGrant!==null||scope.dataClassGrant!==null)throw Error('BROWSER_PAIR_SCOPE_RESPONSE_DENIED');
 const bytes=new TextEncoder().encode(canonicalJson(scope)),actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');if(actual!==v.scopeDigest)throw Error('BROWSER_PAIR_SCOPE_DIGEST_DENIED');
 return v as unknown as WorkspaceBrowserPairV1;
}
export async function verifyWorkspaceBrowserPairListV1(value:unknown,origin:string):Promise<readonly WorkspaceBrowserPairV1[]>{
 const v=surfaceRecordV2(value);exact(v,['schemaVersion','pairs','budget',...noGrants]);
 if(v.schemaVersion!=='pansphaira.workspace-surface/browser-pair-list/v1'||noGrants.some(k=>v[k]!==false)||!Array.isArray(v.pairs)||v.pairs.length>8)throw Error('BROWSER_PAIR_RESPONSE_DENIED');
 const budget=surfaceRecordV2(v.budget);exact(budget,['maxPairs','claimLifetimeMs','maxAttemptsPerAuthenticatedSessionPerMinute','maxPairedLifetimeMs','returnedPairs']);if(budget.maxPairs!==128||budget.claimLifetimeMs!==60000||budget.maxAttemptsPerAuthenticatedSessionPerMinute!==5||budget.maxPairedLifetimeMs!==300000||budget.returnedPairs!==8)throw Error('BROWSER_PAIR_RESPONSE_DENIED');
 return Promise.all(v.pairs.map(row=>verifyWorkspaceBrowserPairV1(row,origin)));
}
