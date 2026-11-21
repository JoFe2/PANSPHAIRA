import test from'node:test';import assert from'node:assert/strict';import {existsSync,readFileSync}from'node:fs';import{browserFixture550,openAdministration550,capture550}from'./browser-fixture.mjs';
const card=f=>f.page.locator('.administration-card:has([data-admin-diff="business"])');
async function prepare(f){await openAdministration550(f);await card(f).locator('[role="status"]').waitFor();await f.page.locator('[data-approval-state="EMPTY"]').waitFor();await f.page.getByRole('button',{name:'Bestehenden synthetischen Fachproposal nur vorbereiten',exact:true}).click();await f.page.locator('[data-approval-state="PENDING"]').waitFor();assert.equal(f.counts.mutations,0);}
async function approve(f){await f.page.locator('#pan550-proposal-confirmation').check();await f.page.getByRole('button',{name:'Nur sichtbaren fachlichen Proposal freigeben',exact:true}).click();await f.page.locator('[data-approval-state="APPROVED"]').waitFor();assert.equal(f.counts.mutations,0);}
async function execute(f){await f.page.locator('#pan550-effect-confirmation').check();await f.page.getByRole('button',{name:'Signierten lokalen Auftrag genau einmal ausführen',exact:true}).click();await f.page.locator('[data-approval-state="OUTCOME_UNCONFIRMED"]').waitFor();}
async function reread(f,phase){await f.page.getByRole('button',{name:'Freigabe und persistiertes Fachziel unabhängig lesen',exact:true}).click();await f.page.locator('[data-approval-state="'+phase+'"]').waitFor();}

test('REC-03 unconfirmed browser rejection allows a real reread but not another attempt',async()=>{
 const f=await browserFixture550({approval:true});
 try{
  await prepare(f);
  let intercepted=0;
  // Fail this one local fixture request before it reaches the real owner. READs are not stubbed.
  await f.page.route('**/workspace/administration/approval',route=>{
   if(route.request().postDataJSON()?.operation!=='REJECT')return route.fallback();
   intercepted++;return route.abort('failed');
  });
  const reject=f.page.getByRole('button',{name:'Sichtbaren fachlichen Vorschlag ablehnen',exact:true});
  const confirmation=f.page.getByRole('checkbox',{name:'Diesen Vorschlag endgültig ablehnen. Keine Ausführung.',exact:true});
  await confirmation.check();await reject.click();
  await f.page.locator('[data-approval-state="OUTCOME_UNCONFIRMED"]').waitFor();
  assert.equal(intercepted,1);
  const reads=()=>f.requests.filter(x=>x.path.endsWith('/approval')&&x.body.operation==='READ').length;
  const before=reads();
  await reread(f,'PENDING');
  assert.equal(reads(),before+1,'the independent reread must reach the native read path');
  assert.equal(await confirmation.isDisabled(),true,'a reread must not re-arm a fenced rejection');
  assert.equal(await confirmation.isChecked(),false);
  assert.equal(await reject.isDisabled(),true);
  assert.match(await card(f).getByRole('status').innerText(),/noch offen.*Ablehnungsversuch.*unbestätigt.*nicht erneut senden/iu);
  assert.equal(intercepted,1);
  assert.equal(Object.keys(f.approvalRuntime.workbench.state.decisions).length,0);
  assert.equal(f.counts.mutations,0);assert.equal(existsSync(f.orderTarget),false);
 }finally{await f.close();}
});

test('REC-03 real browser rejects the visible proposal once and independently rereads the terminal no-effect decision',async()=>{
 const f=await browserFixture550({approval:true});
 try{
  await prepare(f);
  const pending=Object.values(f.approvalRuntime.workbench.state.proposals)[0];
  assert.ok(pending,'native proposal exists before decision');
  assert.match(await f.page.locator('[data-admin-diff="business"]').innerText(),/CM-ADMIN-AI-ESCALATION-001/u);
  const reject=f.page.getByRole('button',{name:'Sichtbaren fachlichen Vorschlag ablehnen',exact:true});
  assert.equal(await reject.count(),1,'PENDING exposes exactly one explicit rejection control');
  const confirmation=f.page.getByRole('checkbox',{name:'Diesen Vorschlag endgültig ablehnen. Keine Ausführung.',exact:true});
  assert.equal(await confirmation.isChecked(),false);
  assert.equal(await reject.isDisabled(),true);
  await confirmation.focus();await f.page.keyboard.press('Space');
  await reject.focus();await f.page.keyboard.press('Enter');await f.page.keyboard.press('Enter');
  await f.page.locator('[data-approval-state="REJECTED"]').waitFor();
  assert.match(await card(f).getByRole('status').innerText(),/abgelehnt.*keine Freigabe.*keine Fachwirkung/iu);
  assert.equal(await confirmation.isChecked(),false);
  assert.equal(await reject.isDisabled(),true);
  assert.equal(await f.page.getByRole('button',{name:'Nur sichtbaren fachlichen Proposal freigeben',exact:true}).isDisabled(),true);
  assert.equal(await f.page.getByRole('button',{name:'Signierten lokalen Auftrag genau einmal ausführen',exact:true}).isDisabled(),true);
  const approvalPage=f.page.url();
  await f.page.reload();
  assert.equal(f.page.url(),approvalPage,'reload preserves the actual administration route');
  await f.page.locator('[data-approval-state="REJECTED"]').waitFor();
  await reread(f,'REJECTED');
  const decisions=f.requests.filter(x=>['REJECT','APPROVE','EXECUTE','RECONCILE'].includes(x.body?.operation));
  assert.deepEqual(decisions.map(x=>[x.body.operation,x.body.expectedProposalDigest,x.body.confirmation]),[['REJECT',pending.proposalDigest,'CONFIRM_OWNER_REJECT_NO_AUTHORITY']]);
  const decision=f.approvalRuntime.workbench.state.decisions[pending.decisionDigest];
  assert.equal(decision.receipt.ownerDecision,'REJECT');assert.equal(decision.authority,null);
  assert.equal(f.counts.mutations,0);assert.equal(existsSync(f.orderTarget),false);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
test('PUI09 real browser factual proposal-before-approve and separate signed effect, independent persisted target, responsive390 keyboard/DUI10 same-panel',async()=>{const f=await browserFixture550({approval:true});try{await prepare(f);const diff=await f.page.locator('[data-admin-diff="business"]').innerText();assert.match(diff,/Kundenreferenz: nicht vorhanden → CM-ADMIN-AI-ESCALATION-001/);assert.match(diff,/Kunden-ID: nicht vorhanden → 7/);assert.match(diff,/Auftragsdatum.*nicht vorhanden → 1767225600/);assert.match(diff,/Budgetobergrenze 0.00 EUR/);assert.equal(await f.page.getByRole('button',{name:'Nur sichtbaren fachlichen Proposal freigeben',exact:true}).isDisabled(),true);await f.page.locator('#pan550-proposal-confirmation').focus();await f.page.keyboard.press('Space');assert.equal(await f.page.locator('#pan550-proposal-confirmation').isChecked(),true);await f.page.locator('[data-admin-diff="business"]').scrollIntoViewIfNeeded();await capture550(f,'desktop-current-authoritative-proposal-before-approval');await approve(f);await f.page.setViewportSize({width:390,height:844});await f.page.locator('#pan550-effect-confirmation').scrollIntoViewIfNeeded();await capture550(f,'390-current-approved-not-executed');await execute(f);assert.equal(f.counts.mutations,1);assert.doesNotMatch(await card(f).innerText(),/Persistierten fachlichen Zielzustand unabhängig gelesen/);await reread(f,'PERSISTED');assert.match(await card(f).innerText(),/Persistierten fachlichen Zielzustand unabhängig gelesen: genau ein synthetischer Auftrag/);assert.deepEqual(JSON.parse(readFileSync(f.orderTarget,'utf8')),{id:42,date:1767225600,ref_client:'CM-ADMIN-AI-ESCALATION-001',socid:7});assert.equal(f.counts.mutations,1);assert.equal(await f.page.getByRole('button',{name:'Signierten lokalen Auftrag genau einmal ausführen',exact:true}).isDisabled(),true);await f.page.locator('[data-admin-diff="business"]').scrollIntoViewIfNeeded();await capture550(f,'390-current-fachziel-independently-persisted');assert.deepEqual(f.requests.filter(x=>x.path.endsWith('/approval')).map(x=>x.body.operation),['READ','PREPARE','APPROVE','EXECUTE','READ']);for(const x of f.requests.filter(x=>x.path.endsWith('/approval')))assert.deepEqual(Object.keys(x.body).sort(),['schemaVersion','operation','expectedProposalDigest','confirmation','context'].sort());assert.equal(await f.page.locator('[id="shell.agent-panel"]').count(),1);assert.deepEqual(f.errors,[]);}finally{await f.close();}});
test('PUI09 real ambiguous browser effect no success or blind retry, independent UNKNOWN and explicit existing453 read-only recovery',async()=>{const f=await browserFixture550({approval:true,effectMode:'UNCONFIRMED'});try{await prepare(f);await approve(f);await execute(f);assert.equal(f.counts.mutations,1);await reread(f,'OUTCOME_UNKNOWN');assert.match(await card(f).innerText(),/Effekt unklar/);assert.equal(await f.page.getByRole('button',{name:'Signierten lokalen Auftrag genau einmal ausführen',exact:true}).isDisabled(),true);await f.page.setViewportSize({width:390,height:844});await f.page.locator('#pan550-reconcile-confirmation').scrollIntoViewIfNeeded();await capture550(f,'390-current-ambiguous-native-effect-no-retry');await f.page.getByRole('heading',{name:'Fachliche Freigaben',exact:true}).scrollIntoViewIfNeeded();await capture550(f,'390-current-ambiguous-status-and-proposal');await f.page.locator('#pan550-reconcile-confirmation').check();await f.page.getByRole('button',{name:'Unklaren Effekt ausdrücklich nur autoritativ abgleichen',exact:true}).click();await f.page.locator('[data-approval-state="OUTCOME_UNCONFIRMED"]').waitFor();await reread(f,'PERSISTED');assert.equal(f.counts.mutations,1);assert.equal(f.counts.reconciliations,1);assert.equal(f.requests.filter(x=>x.body.operation==='EXECUTE').length,1);assert.equal(f.requests.filter(x=>x.body.operation==='RECONCILE').length,1);assert.deepEqual(f.errors,[]);}finally{await f.close();}});
test('PUI09 browser signed lease expiry disables effect and actual server-denied Resume is not a success; other native views survive',async()=>{const clock={value:Date.now()},f=await browserFixture550({approval:true,clock});try{await prepare(f);await approve(f);clock.value+=31000;await reread(f,'EXPIRED');assert.equal(await f.page.getByRole('button',{name:'Signierten lokalen Auftrag genau einmal ausführen',exact:true}).isDisabled(),true);assert.equal(f.counts.mutations,0);const before=f.status().statusDigest;const reader=f.sessions.issueOwnerSession({subjectId:'owner:local-demo',role:'reader',expiresAtMs:Date.now()+180000});await f.context.clearCookies();await f.context.addCookies([{name:'__Host-pan527-session',value:reader.cookieHeader.split('=')[1],url:f.tls.origin,secure:true,httpOnly:true,sameSite:'Strict'}]);await f.page.locator('#pan550-setup-confirmation').check();await f.page.getByRole('button',{name:'Bestehende Einrichtung ausdrücklich fortsetzen',exact:true}).click();await f.page.locator('[data-backend="administration"][data-outcome="OUTCOME_UNCONFIRMED"]').waitFor();assert.equal(f.status().statusDigest,before);await f.page.getByRole('button',{name:'Aktuellen Kontext und persistiertes Setupziel unabhängig lesen',exact:true}).click();await f.page.locator('[data-backend="administration"][data-outcome="DENIED"]').waitFor();assert.doesNotMatch(await f.page.locator('main').innerText(),/PERSISTED_TARGET_RECONCILED|Erfolgreich fortgesetzt/);await f.context.clearCookies();await f.context.addCookies([{name:'__Host-pan527-session',value:f.issued.cookieHeader.split('=')[1],url:f.tls.origin,secure:true,httpOnly:true,sameSite:'Strict'}]);await f.page.getByRole('button',{name:'Eingangsrechnungsprüfung — nur lesen',exact:true}).click();await f.page.locator('[data-backend="erv"]').waitFor();await f.page.getByRole('button',{name:'Abmelden',exact:true}).click();await f.page.getByRole('heading',{name:'Abgemeldet',exact:true}).waitFor();assert.equal(f.counts.mutations,0);assert.deepEqual(f.errors,[]);}finally{await f.close();}});

test('PUI09 repeated explicit read-only453 recovery after still UNKNOWN really dispatches, bounded original core; never second EXECUTE/mutation',async()=>{const f=await browserFixture550({approval:true,effectMode:'UNKNOWN_THEN_PASS'});try{await prepare(f);await approve(f);await execute(f);await reread(f,'OUTCOME_UNKNOWN');for(let attempt=1;attempt<=2;attempt++){await f.page.locator('#pan550-reconcile-confirmation').check();await f.page.getByRole('button',{name:'Unklaren Effekt ausdrücklich nur autoritativ abgleichen',exact:true}).click();await f.page.locator('[data-approval-state="OUTCOME_UNCONFIRMED"]').waitFor();await reread(f,attempt===1?'OUTCOME_UNKNOWN':'PERSISTED');assert.equal(f.counts.reconciliations,attempt);assert.equal(f.counts.mutations,1);assert.equal(f.requests.filter(x=>x.body.operation==='EXECUTE').length,1);assert.equal(f.requests.filter(x=>x.body.operation==='RECONCILE').length,attempt);}assert.deepEqual(f.errors,[]);}finally{await f.close();}});
