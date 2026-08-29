# CKS-06 offline router dry-run

This receipt is an offline, deterministic replay of the advisory-only CKS-06 path. It does not invoke a model/provider, execute a route, acquire a lease, grant Authority, or change activation mode.

## Replayed gates

`scripts/run-cks-router-dry-run.mjs` loads the closed fixture and performs these checks in order:

1. Binds Operating Model v1.1 and decisions D-001 through D-007.
2. Reads and SHA-256 verifies the three required positive CKS evidence references. The references are immutable-commit and repository-path bound; a missing or changed byte fails closed.
3. Validates the exact qualification profile, including model artifact, quantization, runtime, context, prompt, tools, retriever, reranker, verifier, Knowledge, and qualification-suite bindings.
4. Replays all six typed escalation causes: `KNOWLEDGE_GAP`, `KNOWLEDGE_CONFLICT`, `VERIFIER_REJECTION`, `DECOMPOSITION_GROWTH`, `LOW_EVIDENCE_COVERAGE`, and `COMPETENCE_LIMIT`.
5. Builds three candidates and selects the smallest fully qualified available profile. A wider/cheaper candidate and an independently policy-denied candidate demonstrate that cost and model strength do not override qualification or policy.
6. Rebinds the selected profile to a measured two-sequence capacity receipt. The complete 114624-token demand is admitted by the measured `parallel-128k` bucket; dependency and non-conflicting path leases are checked atomically.
7. Replays two paired shadow windows. All frozen quality and efficiency gates pass, while the resulting activation mode remains `OFF` and is only eligible for separate authorization.

The generated receipt is:

`verification/cks-06-router-dry-run-evidence-v1.json`

Its top-level outcome is `PASS`, which means this local harness replay passed. It is not a claim that an external provider was called or that production routing was activated.

## Commands

From the repository root:

```text
npm run build --silent
node --test dist/tests/cks-router-dry-run.test.js
node scripts/run-cks-router-dry-run.mjs --fixture tests/fixtures/cks-router-dry-run/positive-evidence-v1.json
git diff --check origin/main...HEAD
```

On the local worker host, the ordinary Node invocation can terminate during V8 initialization with exit 133/SIGTRAP. The same focused checks pass with the host workaround `NODE_OPTIONS=--jitless`; this is infrastructure evidence, not a product verdict. The authoritative pinned-Node checks remain with the controller.

The negative matrix is `tests/fixtures/cks-router-dry-run/rejections-v1.json`. It covers absent/tampered evidence, typed disposition mismatch, lease conflict, unknown shadow evidence, and shadow efficiency failure. Each case remains fail-closed and cannot produce a positive router receipt.
