// Offline, read-only counterpart execution. No fetch, credentials or services.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalJson } from '../dist/packages/contracts/src/index.js';

function command(cwd, executable, args) {
  return execFileSync(executable, args, { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' } }).trim();
}
function checkout(cwd, expected) {
  if (!/^[a-f0-9]{40}$/.test(expected)) throw new Error('PAIRED_EXECUTION_IMMUTABLE_OID_REQUIRED');
  const worktreeRoot = command(cwd, 'git', ['rev-parse', '--show-toplevel']);
  if (realpathSync(cwd) !== realpathSync(worktreeRoot)) throw new Error('PAIRED_EXECUTION_WORKTREE_ROOT_MISMATCH');
  const commitOid = command(cwd, 'git', ['rev-parse', '--verify', 'HEAD']);
  const treeOid = command(cwd, 'git', ['rev-parse', '--verify', 'HEAD^{tree}']);
  if (commitOid !== expected) throw new Error('PAIRED_EXECUTION_HEAD_MISMATCH');
  if (command(cwd, 'git', ['status', '--porcelain=v1', '--untracked-files=no'])) throw new Error('PAIRED_EXECUTION_DIRTY_CHECKOUT');
  return { commitOid, treeOid };
}
export { checkout as verifyPinnedCheckout };
export function executePinnedPair({ root, counterpart, expectedPanHead, pinned, consumer }) {
  const ks = resolve(counterpart);
  const panHead = checkout(root, expectedPanHead);
  if (realpathSync(root) !== realpathSync(resolve(import.meta.dirname, '..'))) throw new Error('PAIRED_EXECUTION_RUNNER_SOURCE_MISMATCH');
  const ksHead = checkout(ks, pinned.consumerRef.kaleidosphereHead.commitOid);
  if (ksHead.treeOid !== pinned.consumerRef.kaleidosphereHead.treeOid) throw new Error('PAIRED_EXECUTION_TREE_MISMATCH');
  // Do not use the counterpart CLI's --check: that accepts its baseline's
  // recorded head. Resolve Git ourselves and generate from the executed head.
  const source = `
    import { pathToFileURL } from 'node:url';
    import { resolve } from 'node:path';
    const m = await import(pathToFileURL(resolve('scripts/build-consumer-support-manifest.mjs')));
    const heads = m.gitHeads();
    const { config, configSha256 } = m.buildConfigIdentity();
    const manifest = await m.buildConsumerSupportManifest({ heads, config });
    await m.verifyConsumerSupportManifest(manifest, { expectedHead: heads, configSha256, strict: true });
    process.stdout.write(JSON.stringify(manifest));
  `;
  const fresh = JSON.parse(command(ks, process.execPath, ['--input-type=module', '-e', source]));
  // Exact semantic equality is stricter than a permissive generic schema:
  // unknown/missing fields, reason partitions and config are all denied.
  if (canonicalJson(fresh) !== canonicalJson(consumer)) throw new Error('PAIRED_EXECUTION_CONSUMER_DERIVATION_MISMATCH');
  // Rebuild, then check in a fresh process; ignored/stale dist bytes cannot
  // substitute for the checkout whose OID the execution receipt names.
  command(root, 'npm', ['run', 'build', '--silent']);
  command(root, process.execPath, ['scripts/run-paired-analytics-parity.mjs', '--check']);
  const counterpartTests = command(ks, process.execPath, ['--test', 'tests/consumer-support-manifest.test.mjs']);
  const producerTests = command(root, process.execPath, ['--test', 'dist/tests/producer-analytics-manifest.test.js', 'dist/tests/paired-analytics-parity.test.js']);
  if (canonicalJson(checkout(root, expectedPanHead)) !== canonicalJson(panHead) ||
      canonicalJson(checkout(ks, ksHead.commitOid)) !== canonicalJson(ksHead)) throw new Error('PAIRED_EXECUTION_CHECKOUT_CHANGED');
  return {
    testedHeads: { pansphaira: panHead.commitOid, kaleidoSphere: ksHead.commitOid },
    testedTrees: { pansphaira: panHead.treeOid, kaleidoSphere: ksHead.treeOid },
    executionStatus: 'PINNED_OFFLINE_RUNTIME_PASS',
    execution: { counterpartTests, producerTests, consumerDigest: fresh.integrity.digest },
    publicClosure: 'PENDING_AC04_PUBLIC_CI_AND_ANONYMOUS_READBACK',
  };
}
