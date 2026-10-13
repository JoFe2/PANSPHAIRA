// Existing PAN548 owns invocation input; this pure grammar mints no scope,
// target, argument, task/lease, personal save or executable authority.
import {uiTaskClosedV2} from './native-ui-task-projection-v2.mjs';
const phrases=new Map([
 ['mach die karte kleiner','PREVIEW_CARD_SMALLER'],
 ['mache die karte kleiner','PREVIEW_CARD_SMALLER'],
 ['make the card smaller','PREVIEW_CARD_SMALLER'],
 ['zeige das ausgewählte dokument rechts','DISPLAY_SELECTED_DOCUMENT'],
 ['show the selected document on the right','DISPLAY_SELECTED_DOCUMENT'],
]);
export function parseModelFreeFinalTextV1(value){
 const input=uiTaskClosedV2(value,['schemaVersion','inputKind','final','text'],'INVOCATION_FINAL_TEXT_DENIED');
 if(input.schemaVersion!=='pansphaira.workspace-invocation/final-text/v1'||input.inputKind!=='TYPED_FINAL_TEXT'||input.final!==true||typeof input.text!=='string'||input.text.length>2048||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u2028\u2029]/u.test(input.text))throw Error('INVOCATION_FINAL_TEXT_DENIED');
 const originalText=input.text,trimmed=originalText.trim();
 // Match the complete final string, never a transcript or regex fragment.
 // Text case/spaces do not normalize or repair any native identifier.
 const phrase=(trimmed.endsWith('.')?trimmed.slice(0,-1):trimmed).toLowerCase(),intent=/[\r\n\t]/u.test(originalText)?null:phrases.get(phrase)??null;
 return Object.freeze({schemaVersion:'pansphaira.workspace-invocation/parsed-final-text/v1',originalText,outcome:trimmed.length===0?'NONE':intent?'RESOLVE':'MAIN',intent,reason:trimmed.length===0?'EMPTY_FINAL_TEXT':intent?'OWNER_RESOLVER_REQUIRED':'WHOLE_TEXT_NOT_IN_CLOSED_GRAMMAR',model:'NOT_RUN',effectProduced:false,executionAuthorityGranted:false});
}
