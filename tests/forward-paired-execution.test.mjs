import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {verifyForwardCheckout, verifyForwardEnvironment} from '../scripts/run-forward-paired-analytics.mjs';

test('forward execution binds the actual root, exact head and clean sources', () => {
  const root=mkdtempSync(join(tmpdir(),'forward-checkout-'));
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  try {
    git('init','-q'); git('config','user.name','Test'); git('config','user.email','test@example.invalid');
    writeFileSync(join(root,'source'),'original'); git('add','.'); git('commit','-qm','test');
    const head=git('rev-parse','HEAD');
    assert.equal(verifyForwardCheckout(root,head).commitOid,head);
    assert.throws(()=>verifyForwardCheckout(root,'main'),/IMMUTABLE/);
    assert.throws(()=>verifyForwardCheckout(root,'0'.repeat(40)),/HEAD_MISMATCH/);
    mkdirSync(join(root,'shadow'));
    assert.throws(()=>verifyForwardCheckout(join(root,'shadow'),head),/ROOT_MISMATCH/);
    writeFileSync(join(root,'untracked-source'),'injected');
    assert.throws(()=>verifyForwardCheckout(root,head),/DIRTY/);
    rmSync(join(root,'untracked-source'));
    writeFileSync(join(root,'source'),'changed');
    assert.throws(()=>verifyForwardCheckout(root,head),/DIRTY/);
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('forward CLI rejects dot-dot-prefixed receipt directories in either checkout', () => {
  const repo=join(import.meta.dirname,'..');
  const counterpart=mkdtempSync(join(tmpdir(),'forward-output-'));
  const internal=join(repo,'..receipts');
  mkdirSync(internal);
  mkdirSync(join(counterpart,'..receipts'));
  try {
    for(const directory of [internal,join(counterpart,'..receipts')]) {
      assert.throws(()=>execFileSync(process.execPath,[join(repo,'scripts/run-forward-paired-analytics.mjs'),'--counterpart',counterpart,'--pan-head','0'.repeat(40),'--output',join(directory,'receipt.json')],{encoding:'utf8',stdio:'pipe'}),error=>String(error.stderr).includes('FORWARD_RECEIPT_OUTSIDE_CHECKOUT_REQUIRED'));
    }
    assert.throws(()=>execFileSync(process.execPath,[join(repo,'scripts/run-forward-paired-analytics.mjs'),'--counterpart',counterpart,'--pan-head','0'.repeat(40),'--output',join(tmpdir(),'external-forward-receipt.json')],{encoding:'utf8',stdio:'pipe'}),error=>!String(error.stderr).includes('FORWARD_RECEIPT_OUTSIDE_CHECKOUT_REQUIRED'));
  } finally {rmSync(internal,{recursive:true,force:true});rmSync(counterpart,{recursive:true,force:true});}
});

test('forward execution refuses unqualified Node, ABI, OS and architecture', () => {
  const good={version:'v24.19.0',abi:'137',platform:'linux',arch:'x64'};
  assert.doesNotThrow(()=>verifyForwardEnvironment(good));
  for(const key of Object.keys(good)) assert.throws(()=>verifyForwardEnvironment({...good,[key]:'substituted'}),/ENVIRONMENT/);
});
