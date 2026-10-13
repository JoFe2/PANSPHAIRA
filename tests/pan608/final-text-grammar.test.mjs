import test from 'node:test';
import assert from 'node:assert/strict';
import {parseModelFreeFinalTextV1} from '../../src/pan548/model-free-final-text-v1.mjs';
const input=text=>({schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text});
test('608 AC01/03 complete final text grammar yields only two non-authorizing intent kinds, no invented IDs/arguments',()=>{
 for(const [text,intent]of [['Mach die Karte kleiner','PREVIEW_CARD_SMALLER'],['make the card smaller','PREVIEW_CARD_SMALLER'],['Zeige das ausgewählte Dokument rechts.','DISPLAY_SELECTED_DOCUMENT'],['show the selected document on the right','DISPLAY_SELECTED_DOCUMENT']]){
  const result=parseModelFreeFinalTextV1(input(text));assert.equal(result.outcome,'RESOLVE');assert.equal(result.intent,intent);assert.equal(result.originalText,text);assert.equal(result.executionAuthorityGranted,false);assert.equal(result.model,'NOT_RUN');assert.equal(result.effectProduced,false);assert.equal(Object.isFrozen(result),true);assert.equal(Object.hasOwn(result,'objectId'),false);assert.equal(Object.hasOwn(result,'surfaceId'),false);assert.equal(Object.hasOwn(result,'arguments'),false);
 }
});
test('608 AC03 negation/self-correction/location/unknown remainder or multi-part wishes never directly resolve',()=>{
 for(const text of ['Nicht die Karte kleiner machen','Mach die Karte kleiner, nein doch nicht','Mach die Karte kleiner und sende die Mail','Mach die Karte kleiner; zeige das Dokument','Mach die Karte kleiner nur Standort korrigieren','Zeige das ausgewählte Dokument rechts und speichere','Nur den Standort korrigieren','Mach die Karte kleiner bitte später','Mach die Karte kleiner! Und löschen','<script>mach die Karte kleiner</script>','zeige AP-PAN516-MATCHED-01 rechts','send the mail','externalDraft.write','Mach die Karte\nkleiner']){
  const result=parseModelFreeFinalTextV1(input(text));assert.equal(result.outcome,'MAIN',text);assert.equal(result.intent,null,text);assert.equal(result.effectProduced,false,text);assert.equal(result.executionAuthorityGranted,false,text);
 }
});
test('608 AC03 partial/transcript/not-final inputs and unsupported input kinds reject before candidate resolution',()=>{
 for(const value of [{...input('Mach die Karte kleiner'),final:false},{...input('Mach die Karte kleiner'),inputKind:'PARTIAL_TRANSCRIPT'},{...input('Mach die Karte kleiner'),schemaVersion:'pansphaira.workspace-context/v1'},input('x'.repeat(2049)),input('Mach die Karte kleiner\0')])assert.throws(()=>parseModelFreeFinalTextV1(value),/INVOCATION_FINAL_TEXT_DENIED/);
});
test('608 empty final text means NONE; surrounding ordinary spaces are textual grammar not identifier repair',()=>{
 assert.equal(parseModelFreeFinalTextV1(input('   ')).outcome,'NONE');const value=input('  mach die Karte kleiner  ');assert.equal(parseModelFreeFinalTextV1(value).outcome,'RESOLVE');assert.equal(parseModelFreeFinalTextV1(value).originalText,value.text);
});
test('608 closed data input denies extras, inherited keys, accessors and mutation without invoking a caller getter',()=>{
 for(const value of [{...input('Mach die Karte kleiner'),objectId:'invented'},{...input('Mach die Karte kleiner'),authority:true},Object.assign(Object.create({lease:'caller'}),input('Mach die Karte kleiner'))])assert.throws(()=>parseModelFreeFinalTextV1(value),/INVOCATION_FINAL_TEXT_DENIED/);
 let reads=0;const value=input('Mach die Karte kleiner');Object.defineProperty(value,'text',{enumerable:true,get(){reads++;return 'Mach die Karte kleiner';}});assert.throws(()=>parseModelFreeFinalTextV1(value),/INVOCATION_FINAL_TEXT_DENIED/);assert.equal(reads,0);
 const original=input('Mach die Karte kleiner'),result=parseModelFreeFinalTextV1(original);original.text='send the mail';assert.equal(result.originalText,'Mach die Karte kleiner');assert.equal(result.executionAuthorityGranted,false);
});
