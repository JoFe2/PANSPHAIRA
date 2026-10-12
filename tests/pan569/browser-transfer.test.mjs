import test from 'node:test';
import assert from 'node:assert/strict';
import {processBrowserFixture562} from '../pan562/browser-process-fixture.mjs';
import {openModelFreeConfiguration566,completeModelFreeDraft566} from '../pan566/helpers.mjs';

test('B3-AC04 original native RESOLVED draft offers redacted configuration export on the same protected browser path without activation',async()=>{
 const f=await processBrowserFixture562();
 try{
  const p=await openModelFreeConfiguration566(f);
  const actual=await completeModelFreeDraft566(p);
  assert.equal(actual.outcome,'RESOLVED');
  assert.equal(actual.activationAuthorized,false);
  assert.equal(actual.draft.fields['model.reference'].value,'NONE');
  assert.equal(await p.getByRole('button',{name:'Konfiguration redigiert exportieren',exact:true}).count(),1,'original569 requires the separate redacted configuration-transfer entry on the existing protected563/566 browser path; no whole530 epic or model prerequisite');
 }finally{await f.close();}
});
