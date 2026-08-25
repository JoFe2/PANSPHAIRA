import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canonicalJson,
  verifyVerificationFabricBundleV1,
  type VerificationFabricBundleV1,
} from "../packages/contracts/src/index.js";

type MutableBundle = {
  readonly plan: Record<string, any>;
  readonly selfTestIdentity: Record<string, any>;
  readonly checkRuns: Record<string, any>[];
  readonly evidenceBundle: Record<string, any>;
  readonly verdict: Record<string, any>;
  readonly revalidationTrigger: Record<string, any>;
  readonly lkg: { readonly pointer: Record<string, any>; readonly readback: Record<string, any> };
};

interface NegativeFixture {
  readonly caseId: string;
  readonly operation: "replace" | "remove";
  readonly path: string;
  readonly value?: unknown;
  readonly expectedReason: string;
}

function fixture(): VerificationFabricBundleV1 {
  return JSON.parse(readFileSync("tests/fixtures/verification-fabric/positive-bundle-v1.json", "utf8")) as VerificationFabricBundleV1;
}

function clone(): MutableBundle {
  return structuredClone(fixture()) as unknown as MutableBundle;
}

// Mirrors the contract digest bound into every VF v1 element: canonical JSON of the
// element content excluding the digest field itself.
function contractDigest(value: Record<string, any>, digestKey: string): string {
  const content = Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestKey));
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
}

// Recomputes the complete dependent digest chain in topological order and rebinds
// every downstream digest reference, exactly as a fresh exact-main probe would.
// Canonical JSON serializes -0 identically to 0, so the chain stays self-consistent
// after recomputation; only the canonical numeric time boundary can reject it.
function recomputeDigestChain(bundle: MutableBundle): void {
  const { plan, selfTestIdentity, checkRuns, evidenceBundle, verdict, revalidationTrigger } = bundle;
  const { pointer, readback } = bundle.lkg;
  plan.planDigest = contractDigest(plan, "planDigest");
  selfTestIdentity.identityDigest = contractDigest(selfTestIdentity, "identityDigest");
  for (const run of checkRuns) {
    run.planDigest = plan.planDigest;
    run.runDigest = contractDigest(run, "runDigest");
  }
  evidenceBundle.planDigest = plan.planDigest;
  evidenceBundle.checkRunDigests = checkRuns.map((run) => run.runDigest);
  evidenceBundle.bundleDigest = contractDigest(evidenceBundle, "bundleDigest");
  verdict.planDigest = plan.planDigest;
  verdict.evidenceBundleDigest = evidenceBundle.bundleDigest;
  verdict.verdictDigest = contractDigest(verdict, "verdictDigest");
  revalidationTrigger.observedPlanDigest = plan.planDigest;
  revalidationTrigger.observedEvidenceBundleDigest = evidenceBundle.bundleDigest;
  revalidationTrigger.triggerDigest = contractDigest(revalidationTrigger, "triggerDigest");
  pointer.targetVerdictDigest = verdict.verdictDigest;
  pointer.targetEvidenceBundleDigest = evidenceBundle.bundleDigest;
  pointer.pointerDigest = contractDigest(pointer, "pointerDigest");
  readback.pointerDigest = pointer.pointerDigest;
  readback.observedVerdictDigest = pointer.targetVerdictDigest;
  readback.observedEvidenceBundleDigest = pointer.targetEvidenceBundleDigest;
  readback.readbackDigest = contractDigest(readback, "readbackDigest");
}

function digestSnapshot(bundle: MutableBundle): unknown {
  return {
    plan: bundle.plan.planDigest,
    identity: bundle.selfTestIdentity.identityDigest,
    checkRuns: bundle.checkRuns.map((run) => run.runDigest),
    evidence: bundle.evidenceBundle.bundleDigest,
    verdict: bundle.verdict.verdictDigest,
    trigger: bundle.revalidationTrigger.triggerDigest,
    pointer: bundle.lkg.pointer.pointerDigest,
    readback: bundle.lkg.readback.readbackDigest,
  };
}

const NEGATIVE_ZERO_PROBES: readonly { label: string; apply: (bundle: MutableBundle) => void }[] = [
  { label: "plan.issuedAtMs", apply: (bundle) => { bundle.plan.issuedAtMs = -0; } },
  { label: "selfTestIdentity.issuedAtMs", apply: (bundle) => { bundle.selfTestIdentity.issuedAtMs = -0; } },
  { label: "checkRuns[0].startedAtMs", apply: (bundle) => { const run = bundle.checkRuns[0]; assert.ok(run); run.startedAtMs = -0; } },
  { label: "checkRuns[0].completedAtMs", apply: (bundle) => { const run = bundle.checkRuns[0]; assert.ok(run); run.completedAtMs = -0; } },
  { label: "checkRuns[1].startedAtMs", apply: (bundle) => { const run = bundle.checkRuns[1]; assert.ok(run); run.startedAtMs = -0; } },
  { label: "checkRuns[1].completedAtMs", apply: (bundle) => { const run = bundle.checkRuns[1]; assert.ok(run); run.completedAtMs = -0; } },
  { label: "evidenceBundle.collectedAtMs", apply: (bundle) => { bundle.evidenceBundle.collectedAtMs = -0; } },
  { label: "evidenceBundle.expiresAtMs", apply: (bundle) => { bundle.evidenceBundle.expiresAtMs = -0; } },
  { label: "verdict.evaluatedAtMs", apply: (bundle) => { bundle.verdict.evaluatedAtMs = -0; } },
  { label: "revalidationTrigger.armedAtMs", apply: (bundle) => { bundle.revalidationTrigger.armedAtMs = -0; } },
  { label: "lkg.readback.readAtMs", apply: (bundle) => { bundle.lkg.readback.readAtMs = -0; } },
];

test("VF-001 denies fully re-digested negative zero in every established timestamp boundary", async (t) => {
  for (const probe of NEGATIVE_ZERO_PROBES) {
    await t.test(`${probe.label} = -0`, () => {
      const bundle = clone();
      probe.apply(bundle);
      recomputeDigestChain(bundle);
      assert.deepEqual(verifyVerificationFabricBundleV1(bundle), {
        outcome: "DENIED",
        reasonCodes: ["SCHEMA_DENIED"],
      }, `${probe.label}: negative zero survived the canonical numeric time boundary`);
    });
  }
});

test("VF-001 keeps canonical zero and safe ordered timestamps on the deterministic VERIFIED chain", () => {
  const base = clone();
  assert.deepEqual(verifyVerificationFabricBundleV1(base), {
    outcome: "VERIFIED",
    reasonCodes: ["VERIFICATION_COMPLETE"],
  });

  const recomputed = clone();
  recomputeDigestChain(recomputed);
  assert.deepEqual(digestSnapshot(recomputed), digestSnapshot(base));
  assert.deepEqual(verifyVerificationFabricBundleV1(recomputed), {
    outcome: "VERIFIED",
    reasonCodes: ["VERIFICATION_COMPLETE"],
  });

  const canonicalZero = clone();
  canonicalZero.plan.issuedAtMs = 0;
  canonicalZero.selfTestIdentity.issuedAtMs = 0;
  recomputeDigestChain(canonicalZero);
  assert.deepEqual(verifyVerificationFabricBundleV1(canonicalZero), {
    outcome: "VERIFIED",
    reasonCodes: ["VERIFICATION_COMPLETE"],
  });

  const safeOrdered = clone();
  safeOrdered.revalidationTrigger.armedAtMs = 2500;
  recomputeDigestChain(safeOrdered);
  assert.deepEqual(verifyVerificationFabricBundleV1(safeOrdered), {
    outcome: "VERIFIED",
    reasonCodes: ["VERIFICATION_COMPLETE"],
  });
});

test("VF-001 retains stale, reversal, missing, mismatch, failed-check, self-produced and corrupt-LKG denials", () => {
  const cases = JSON.parse(readFileSync(
    "tests/fixtures/verification-fabric/negative-matrix-v1.json",
    "utf8",
  )) as NegativeFixture[];
  assert.equal(cases.length, 6);
  for (const negative of cases) {
    const source = structuredClone(fixture()) as unknown as Record<string, any>;
    const parts = negative.path.split("/").slice(1);
    const leaf = parts.pop();
    assert.ok(leaf);
    let parent: any = source;
    for (const part of parts) parent = parent[part];
    if (negative.operation === "remove") {
      if (Array.isArray(parent)) parent.splice(Number(leaf), 1);
      else delete parent[leaf];
    } else {
      parent[leaf] = negative.value;
    }
    const result = verifyVerificationFabricBundleV1(source);
    assert.equal(result.outcome, "DENIED", negative.caseId);
    assert.ok(result.reasonCodes.includes(negative.expectedReason as any), `${negative.caseId}: ${result.reasonCodes.join(",")}`);
  }

  const reversal = clone();
  const reversalRun = reversal.checkRuns[0];
  assert.ok(reversalRun);
  reversalRun.completedAtMs = 1000;
  const reversalResult = verifyVerificationFabricBundleV1(reversal);
  assert.equal(reversalResult.outcome, "DENIED");
  assert.ok(reversalResult.reasonCodes.includes("EVIDENCE_MISMATCH_DENIED"), reversalResult.reasonCodes.join(","));

  const failedCheck = clone();
  const failedCheckRun = failedCheck.checkRuns[0];
  assert.ok(failedCheckRun);
  failedCheckRun.outcome = "FAIL";
  const failedCheckResult = verifyVerificationFabricBundleV1(failedCheck);
  assert.equal(failedCheckResult.outcome, "DENIED");
  assert.ok(failedCheckResult.reasonCodes.includes("CHECK_FAILED_DENIED"), failedCheckResult.reasonCodes.join(","));
});