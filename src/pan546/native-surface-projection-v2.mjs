// Additive v2 read-only document/analysis/monitor routes on existing PAN546 sources.
// Not a DMS, copied field store, arbitrary URL loader or silent v1 expansion.
import {isNativeErvReadAdapterV1}from'../pan541/native-erv-read-adapter.mjs';
import {isNativeAnalysisReadAdapterV1}from'../pan549/native-analysis-read.mjs';
import {isProtectedSessionAdapterV1}from'../pan527/origin-session-adapter.mjs';
import {uiTaskClosedV2,uiTaskDigestV2}from'../pan548/native-ui-task-projection-v2.mjs';
import{workspaceSurfaceContributionsV2}from'../../dist/packages/contracts/src/workspace-surface-v2.js';
import{isNativeWorkspaceReaderContextSelectionV1}from'../pan548/native-context-selection.mjs';
const owned=new WeakMap();
export const nativeSurfaceRoutesV2=workspaceSurfaceContributionsV2;
export function createNativeSurfaceProjectionReaderV2(options){
 const o=uiTaskClosedV2(options,['sessions','nativeReader','analysisReader','readMonitor'],'SURFACE_READER_OWNER_DENIED');
 const {sessions,nativeReader,analysisReader,readMonitor}=o;
 if(!isProtectedSessionAdapterV1(sessions,sessions?.binding?.tenantId)||!isNativeErvReadAdapterV1(nativeReader,sessions.binding.tenantId)||(analysisReader!==null&&!isNativeAnalysisReadAdapterV1(analysisReader,sessions.binding))||typeof readMonitor!=='function')throw Error('SURFACE_READER_OWNER_DENIED');
 const reader=Object.freeze({
  catalog(headers,binding){const p=sessions.authenticate(headers);const rows=[];for(const route of nativeSurfaceRoutesV2)for(const objectId of route.objectIds){if(route.kind==='ANALYSIS'&&!analysisReader)continue;let revision;if(route.kind==='DOCUMENT'){try{revision=nativeReader.read({tenantId:p.tenantId,objectId,expectedRevision:null}).revision;}catch(error){if(error.message==='ERV_NATIVE_SOURCE_NOT_CONFIGURED')continue;throw error;}}else if(route.kind==='ANALYSIS')revision=analysisReader.read({...headers,origin:sessions.origin},{schemaVersion:'pansphaira.workspace-analysis/read/v1',objectId,expectedNativeRevision:null,expectedResultRevision:null,asOf:null}).source.snapshot.nativeRevision;else revision=binding.revisions.hostRevision;rows.push({routeId:route.routeId,kind:route.kind,objectId,dataRevision:revision});}sessions.authenticate(headers);return rows;},
  read(headers,value,contextBinding){
   const c=uiTaskClosedV2(value,['routeId','objectId','expectedRevision'],'SURFACE_ROUTE_DENIED'),route=nativeSurfaceRoutesV2.find(r=>r.routeId===c.routeId);
   if(!route||!route.objectIds.includes(c.objectId)||!Number.isSafeInteger(c.expectedRevision)||c.expectedRevision<0)throw Error('SURFACE_ROUTE_DENIED');
   const p=sessions.authenticate(headers);if(headers.origin!==undefined&&headers.origin!==sessions.origin||p.tenantId!==sessions.binding.tenantId)throw Error('SURFACE_READER_SCOPE_DENIED');
   let source,data,dataRevision,resultRevision,title;
   if(route.kind==='DOCUMENT'){
    data=nativeReader.read({tenantId:p.tenantId,objectId:c.objectId,expectedRevision:c.expectedRevision});dataRevision=data.revision;resultRevision=uiTaskDigestV2(data);
    source={owner:'PAN516_LEADING_SQLITE',sourceDocumentSha256:data.invoiceSourceSha256,representation:'READ_ONLY_NATIVE_INVOICE_REFERENCE_NOT_ORIGINAL_PDF_OR_DMS'};title='Natives Rechnungsreferenzdokument '+data.invoiceId;
   }else if(route.kind==='ANALYSIS'){
    if(!analysisReader)throw Error('SURFACE_ANALYSIS_UNAVAILABLE');
    data=analysisReader.read({...headers,origin:sessions.origin},{schemaVersion:'pansphaira.workspace-analysis/read/v1',objectId:c.objectId,expectedNativeRevision:c.expectedRevision,expectedResultRevision:null,asOf:null});dataRevision=data.source.snapshot.nativeRevision;resultRevision=data.resultRevision;source=data.source;title='Native Bestandsanalyse · Einheiten und Fehlwerte aus führender Quelle';
   }else{
    data=readMonitor(p);dataRevision=contextBinding.revisions.hostRevision;resultRevision=uiTaskDigestV2(data);
    if(c.expectedRevision!==dataRevision)throw Error('SURFACE_MONITOR_REVISION_STALE');
    source={owner:'PAN527_EXISTING_COORDINATOR',statusDigest:data.statusDigest};title='Nativer Einrichtungsmonitor · Modellbereitschaft getrennt';
   }
   sessions.authenticate(headers);
   const unsigned={schemaVersion:'pansphaira.workspace-surface/projection/v2',routeId:route.routeId,kind:route.kind,objectId:c.objectId,dataRevision,resultRevision,title,source,data,readOnly:true,modelAcceptance:false,businessEffectProduced:false};
   return Object.freeze({...unsigned,projectionDigest:uiTaskDigestV2(unsigned)});
  },
 });owned.set(reader,{binding:sessions.binding,nativeReader});return reader;
}
export const isNativeSurfaceProjectionReaderV2=(reader,binding,context)=>owned.has(reader)&&owned.get(reader).binding===binding&&(!context||isNativeWorkspaceReaderContextSelectionV1(context,binding,owned.get(reader).nativeReader));
