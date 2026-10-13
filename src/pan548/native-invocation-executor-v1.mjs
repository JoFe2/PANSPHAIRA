// Independent effect boundary: consume one PAN548-issued admission, recheck
// current native scope/deadline immediately before existing owner effect.
// No callback/toolname from the caller and no save, send or remote Undo path.
import {nativeWorkspaceInvocationExecutorConnectionV1} from './native-model-free-invocations-v1.mjs';
export function executeNativeWorkspaceInvocationV1(owner,headers,value){
 const connection=nativeWorkspaceInvocationExecutorConnectionV1(owner),effect=connection.begin(headers,value);
 try{
  connection.revalidate(headers,effect);
  const args=JSON.parse(effect.member.argumentBytes);
  let result;
  if(effect.member.capability==='pan.workspace.view.preview/v1'){
   const preview=connection.viewOwner.preview(headers,args);
   result={phase:'PREVIEW_VALIDATED',preview,clientRendered:false,personalProfileSaved:false,restored:false};
  }else if(effect.member.capability==='pan.workspace.document.display/v2'){
   const delivery=connection.surfaces.accept(headers,args);
   result={phase:'DOCUMENT_ACCEPTED',delivery,clientRendered:false,personalProfileSaved:false,restored:false};
  }else throw Error('INVOCATION_EXECUTOR_CAPABILITY_DENIED');
  return connection.finish(headers,effect,result);
 }catch(error){connection.failed(effect);throw error;}
}
