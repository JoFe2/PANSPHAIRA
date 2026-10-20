import { createHash } from 'node:crypto';
import { isProtectedSessionAdapterV1 } from '../pan527/origin-session-adapter.mjs';
import { isNativeWorkspaceContextSelectionV1 } from '../pan548/native-context-selection.mjs';
import { isNativeErvReadAdapterV1 } from '../pan541/native-erv-read-adapter.mjs';
import { createNativeErvHumanBackendV1 } from '../pan542/native-human-backend.mjs';
import {createNativeWorkspaceErvHumanV1} from './native-human-workspace.mjs';
import {validateWorkspaceErvHumanReadV1} from '../../dist/packages/contracts/src/workspace-erv-human-v1.js';
const owned=new WeakMap();
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function exact(value,keys,code){if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw new Error(code);const ds=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(ds).length!==keys.length||keys.some(k=>!Object.hasOwn(ds,k))||Object.values(ds).some(d=>!d.enumerable||!('value'in d)))throw new Error(code);}
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
// Code-owned schema only, not a metadata/field read grant. Exported for the
// shared data-free validator/store; HTTP metadata still requires native scope.
export const nativeWorkspaceViewFieldsV1=freeze([
 {fieldId:'erv.invoice.amountMinor',source:'ERV_NATIVE',type:'NUMBER',unit:'CURRENCY_MINOR'},
 {fieldId:'erv.invoice.currency',source:'ERV_NATIVE',type:'STRING',unit:'ISO4217'},
 {fieldId:'erv.invoice.liabilityStatus',source:'ERV_NATIVE',type:'STRING',unit:'LIABILITY_STATE'},
 {fieldId:'erv.invoice.expectedAmountMinor',source:'ERV_NATIVE',type:'NUMBER',unit:'CURRENCY_MINOR'},
 {fieldId:'erv.invoice.varianceMinor',source:'ERV_NATIVE',type:'NUMBER',unit:'CURRENCY_MINOR'},
 {fieldId:'erv.invoice.orderedQuantity',source:'ERV_NATIVE',type:'NUMBER',unit:'QUANTITY'},
 {fieldId:'erv.invoice.acceptedQuantity',source:'ERV_NATIVE',type:'NUMBER',unit:'QUANTITY'},
 {fieldId:'erv.invoice.invoicedQuantity',source:'ERV_NATIVE',type:'NUMBER',unit:'QUANTITY'},
 // Subset of the ACTUAL existing protected Human read's native references.
 // Not supplier observations, arbitrary grants, entity metadata or new roles.
 {fieldId:'erv.invoice.orderReference',source:'ERV_NATIVE',type:'STRING',unit:'NATIVE_REFERENCE_ID'},
 {fieldId:'erv.invoice.positionReference',source:'ERV_NATIVE',type:'STRING',unit:'NATIVE_REFERENCE_ID'},
 {fieldId:'erv.invoice.receiptCount',source:'ERV_NATIVE',type:'NUMBER',unit:'COUNT'},
 {fieldId:'erv.human.reviewState',source:'HUMAN_NATIVE',type:'STRING',unit:'REVIEW_STATE'},
]);
// No second invoice database, human status derivation, free query or installer.
// Native Human construction validates its REAL leading binding and source pins.
export function createNativeWorkspaceDataCatalogV1(options){
 exact(options,['sessions','contextSelection','nativeReader','humanRoot'],'DATA_CATALOG_OWNER_DENIED');
 const {sessions,contextSelection,nativeReader,humanRoot}=options;
 if(!isProtectedSessionAdapterV1(sessions,sessions?.binding?.tenantId)||!isNativeWorkspaceContextSelectionV1(contextSelection,sessions.binding)||!isNativeErvReadAdapterV1(nativeReader,sessions.binding.tenantId))throw new Error('DATA_CATALOG_OWNER_DENIED');
 const human=createNativeErvHumanBackendV1({root:humanRoot,sessions});
 const referenceRead=createNativeWorkspaceErvHumanV1({sessions,contextSelection,humanRoot});let closed=false;
 function leading(headers,verification){
  if(closed)throw new Error('DATA_CATALOG_CLOSED');
  const principal=sessions.authenticate(headers),context=contextSelection.verify(headers,verification);
  if(context.moduleId!=='pan.erv'||context.viewId!=='pan.erv.view'||!context.primaryObject)throw new Error('DATA_NATIVE_OBJECT_REQUIRED');
  const invoice=nativeReader.read({tenantId:principal.tenantId,objectId:context.primaryObject.objectId,expectedRevision:context.primaryObject.revision});
  const review=human.read(headers,{invoiceId:invoice.invoiceId});
  if(review.invoiceId!==invoice.invoiceId||review.nativeRevision!==invoice.revision||review.basisDigest!==invoice.basisDigest||review.nativeStatus!==invoice.status||review.executionAuthorityGranted!==false)throw new Error('DATA_NATIVE_SOURCE_CONFLICT');
  // Execute the real already-authorized public read owner. A DTO-shaped
  // caller result or supplier source fact can never stand in for this call.
  const authorized=validateWorkspaceErvHumanReadV1(referenceRead.readReferences(headers,{context:verification}).value,invoice.invoiceId,invoice.revision);
  if(authorized.proposalDigest!==review.proposalDigest||authorized.proposalRevision!==review.proposalRevision)throw new Error('DATA_NATIVE_SOURCE_CONFLICT');
  const fresh=contextSelection.verify(headers,verification);
  const reviewedAgain=human.read(headers,{invoiceId:invoice.invoiceId});
  if(fresh.contextHandle!==context.contextHandle||reviewedAgain.proposalDigest!==review.proposalDigest)throw new Error('DATA_NATIVE_REVISION_STALE');
  return {context,invoice,review,references:authorized.references,sourceDigest:hash({invoiceId:invoice.invoiceId,nativeRevision:invoice.revision,basisDigest:invoice.basisDigest,invoiceSourceSha256:invoice.invoiceSourceSha256,humanBindingDigest:review.bindingDigest,humanProposalRevision:review.proposalRevision,humanProposalDigest:review.proposalDigest,authorizedNativeReferencesDigest:hash(authorized.references)})};
 }
 function metadataOf(read){
  return {schemaVersion:'pansphaira.workspace-data-catalog/v1',moduleId:'pan.erv',viewId:'pan.erv.view',contextHandle:read.context.contextHandle,objectId:read.invoice.invoiceId,
   fields:nativeWorkspaceViewFieldsV1.map(f=>({...f,cardinality:'ONE',readOnly:true})),
   sourceRevisions:{erv:read.invoice.revision,human:read.review.proposalRevision},sourceDigest:read.sourceDigest,
   budgets:{maximumNativeObjects:2,maximumFieldsPerRead:8,maximumRows:1,maximumRelationDepth:0,freeQueriesAllowed:false},
   components:['VALUE','TABLE','HUMAN_REVIEW'],executionAuthorityGranted:false,businessEffectProduced:false};
 }
 const owner=Object.freeze({
  metadata(headers,verification){return freeze(metadataOf(leading(headers,verification)));},
  // Source qualification is not a metadata/object/field/relation grant. Reuse
  // the REAL protected parent read and return no supplier value or live rows.
  // This owner-local contract is not registered as an HTTP/UI read capability.
  referenceContract(headers,command){
   exact(command,['schemaVersion','context','relationId'],'DATA_REFERENCE_REQUEST_DENIED');
   if(command.schemaVersion!=='pansphaira.workspace-native-reference/read-v1')throw new Error('DATA_REFERENCE_REQUEST_DENIED');
   const r=leading(headers,command.context);
   if(command.relationId!=='native.order-supplier-reference')throw new Error('DATA_REFERENCE_RELATION_DENIED');
   const request={tenantId:r.invoice.tenantId,objectId:r.invoice.invoiceId,expectedRevision:r.invoice.revision};
   const source=nativeReader.referenceEvidence(request);
   if(source.schemaVersion!=='pansphaira.native-order-supplier-source-evidence/v1'||source.tenantId!==r.invoice.tenantId||source.invoiceId!==r.invoice.invoiceId||source.nativeRevision!==r.invoice.revision||!Number.isSafeInteger(source.sourceRecordCount)||source.sourceRecordCount<0||source.sourceRecordCount>1||!/^([0-9a-f]{64})$/.test(source.sourceDigest)||source.readOnly!==true||source.fieldRightsQualified!==false||source.relationRightsQualified!==false||source.directoryAvailable!==false||source.executionAuthorityGranted!==false||source.bookingAuthorityGranted!==false||source.paymentOrderAuthorized!==false)throw new Error('DATA_REFERENCE_SOURCE_CONFLICT');
   const current=leading(headers,command.context),again=nativeReader.referenceEvidence(request);
   if(current.sourceDigest!==r.sourceDigest||current.context.contextHandle!==r.context.contextHandle||again.sourceDigest!==source.sourceDigest)throw new Error('DATA_REFERENCE_REVISION_STALE');
   return freeze({schemaVersion:'pansphaira.workspace-native-reference-contract/v1',moduleId:'pan.erv',viewId:'pan.erv.view',contextHandle:current.context.contextHandle,objectId:current.invoice.invoiceId,
    relationId:command.relationId,state:'UNAVAILABLE',reason:'NATIVE_METADATA_OR_FIELD_RIGHTS_NOT_QUALIFIED',grain:'ONE_NATIVE_ORDER_SUPPLIER_REFERENCE_NOT_SUPPLIER_ENTITY',unit:'NATIVE_REFERENCE_ID',
    sourceEvidence:source,authorizedFieldIds:[],fieldRightsQualified:false,relationRightsQualified:false,directoryAvailable:false,rows:[],rowCount:null,
    budgets:{maximumSourceRecords:1,maximumRows:1,maximumRelationDepth:0,paginationAllowed:false,freeQueriesAllowed:false},
    readOnly:true,businessEffectProduced:false,executionAuthorityGranted:false,bookingAuthorityGranted:false,paymentOrderAuthorized:false});
  },
  read(headers,command){
   exact(command,['schemaVersion','context','fieldIds'],'DATA_QUERY_DENIED');
   if(command.schemaVersion!=='pansphaira.workspace-data-read/v1'||!Array.isArray(command.fieldIds)||Object.getPrototypeOf(command.fieldIds)!==Array.prototype||command.fieldIds.length<1||command.fieldIds.length>8)throw new Error('DATA_QUERY_BUDGET_DENIED');
   const ds=Object.getOwnPropertyDescriptors(command.fieldIds);if(Reflect.ownKeys(ds).length!==command.fieldIds.length+1||Object.entries(ds).some(([k,d])=>!('value'in d)||(k!=='length'&&(!d.enumerable||!/^(?:0|[1-9][0-9]*)$/.test(k)))))throw new Error('DATA_QUERY_DENIED');
   const allowed=new Map(nativeWorkspaceViewFieldsV1.map(f=>[f.fieldId,f]));
   // Authenticate before responding with even field-denial metadata.
   sessions.authenticate(headers);
   if(new Set(command.fieldIds).size!==command.fieldIds.length||command.fieldIds.some(id=>typeof id!=='string'||!allowed.has(id)))throw new Error('DATA_FIELD_DENIED');
   const r=leading(headers,command.context),values={
    'erv.invoice.amountMinor':r.invoice.invoiceAmountMinor,'erv.invoice.currency':r.invoice.currency,'erv.invoice.liabilityStatus':r.invoice.status,
    'erv.invoice.expectedAmountMinor':r.invoice.expectedAmountMinor,'erv.invoice.varianceMinor':r.invoice.varianceMinor,
    'erv.invoice.orderedQuantity':r.invoice.orderedQuantity,'erv.invoice.acceptedQuantity':r.invoice.acceptedQuantity,'erv.invoice.invoicedQuantity':r.invoice.invoicedQuantity,
    'erv.invoice.orderReference':r.references.orderId,'erv.invoice.positionReference':r.references.positionId,'erv.invoice.receiptCount':r.references.receiptIds.length,
    // This is the native PAN542 review projection, NEVER liability/workflow,
    // reviewerSubject, assignee, a fabricated supplier or a demo document name.
    'erv.human.reviewState':r.review.state,
   };
   return freeze({...metadataOf(r),schemaVersion:'pansphaira.workspace-data-readback/v1',cells:command.fieldIds.map(id=>({fieldId:id,unit:allowed.get(id).unit,state:values[id]===null?'UNKNOWN':'AVAILABLE',value:values[id],source:allowed.get(id).source,sourceRevision:allowed.get(id).source==='HUMAN_NATIVE'?r.review.proposalRevision:r.invoice.revision,leadingStore:allowed.get(id).source==='HUMAN_NATIVE'?r.review.leadingStore:r.invoice.leadingStore})),
    unavailableRelations:[{relationId:'supplier',state:'UNAVAILABLE',reason:'NO_AUTHORIZED_NATIVE_RELATION'},{relationId:'assignee',state:'UNAVAILABLE',reason:'NO_AUTHORIZED_NATIVE_RELATION'},{relationId:'document-number',state:'UNAVAILABLE',reason:'NO_AUTHORIZED_NATIVE_FIELD'}],bookingAuthorityGranted:false,paymentOrderAuthorized:false});
  },
  close(){closed=true;referenceRead.close();},
 });owned.set(owner,{binding:sessions.binding,contextSelection});return owner;
}
export const isNativeWorkspaceDataCatalogV1=(owner,binding,contextSelection)=>owned.has(owner)&&JSON.stringify(owned.get(owner).binding)===JSON.stringify(binding)&&(contextSelection===undefined||owned.get(owner).contextSelection===contextSelection);
