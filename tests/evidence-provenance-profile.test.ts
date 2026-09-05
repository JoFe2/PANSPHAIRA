import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  EVIDENCE_PROVENANCE_NONE,
  EVIDENCE_PROVENANCE_RECORD_SCHEMA_V1,
  EVIDENCE_PROVENANCE_PUBLIC_RECEIPT_SCHEMA_V1,
  EVIDENCE_PROVENANCE_CLASSES_V1,
  EVIDENCE_PROVENANCE_METHODS_V1,
  EVIDENCE_PROVENANCE_VERIFIER_IDENTITY_CLASSES_V1,
  EVIDENCE_PROVENANCE_CLASS_METHOD_V1,
  EVIDENCE_PROVENANCE_REASON_CODES_V1,
  createEvidenceProvenanceRecordV1,
  verifyEvidenceProvenanceV1,
  publicReviewReceiptV1,
  migrateLegacyEvidenceReceiptV1,
  type EvidenceProvenanceRecordV1,
  type EvidenceProvenanceVerificationV1,
  type EvidenceProvenancePublicReceiptV1,
  type EvidenceProvenancePublicReceiptResultV1,
  type EvidenceProvenanceMigrationResultV1,
} from "../packages/contracts/src/evidence-provenance.js";

/**
 * EVID-PROV-01 — evidence-provenance classes and verifier provenance profile.
 *
 * Focused, TDD proof of the acceptance criteria for making evidence
 * independence and verifier provenance externally inspectable:
 *   - AC01: the closed v1 provenance record binds claim, exact commit/tree
 *     head, inputs, oracle, verifier implementation/tool/model identity
 *     class, invocation digest, environment, timestamp, CI run/job URL/ID,
 *     and result digest, plus the evidence class and a content digest that
 *     is recomputed — never trusted.
 *   - AC02: the evidence classes are exactly SELF_GENERATED,
 *     ISOLATED_INTERNAL_REVIEW, THIRD_PARTY_EXECUTION_PLATFORM and
 *     EXTERNAL_INDEPENDENT_VALIDATION; each class must carry its own support
 *     and no class implies a stronger one (promotion fails closed).
 *   - AC03: verification recomputes deterministic content and provider
 *     state from caller-supplied recomputations; caller-authored PASS
 *     fields are never accepted.
 *   - AC04: the public review receipt projects only safe method/provenance
 *     fields and the exact-head binding; prompts, secrets, hidden
 *     reasoning, private paths and non-public data classes are excluded or
 *     fail closed.
 *   - AC05: forged reviewer identity, substituted oracle/input/head/run,
 *     self-signed PASS, missing provider readback and class promotion all
 *     return a structured denial (never an exception, never a success).
 *   - AC06: legacy receipts migrate with the honest weakest class
 *     (SELF_GENERATED); no retrospective external-independence claim is
 *     invented and the legacy self-attested result field is ignored.
 *
 * This file adds no repository-global manifest, inventory or verification
 * DAG change; the serial integrator owns final Canon/integrity regeneration.
 * All values are synthetic; no customer data, credentials or network.
 */

type AnyRecord = Record<string, unknown>;
type AnyArray = unknown[];

const sha256 = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");

// --- fixed synthetic bindings (no customer data, no credentials) -----------

const COMMIT_SHA = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";
const TREE_SHA = "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1";
const HEX_INPUTS = "9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0";
const HEX_ORACLE = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const HEX_RESULT = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
const HEX_INVOCATION = "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";
const HEX_REVIEWER = "cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234cafe1234";
const HEX_READBACK = "beef5678beef5678beef5678beef5678beef5678beef5678beef5678beef5678";
const TIMESTAMP = "2026-09-05T06:00:00Z";
const RUN_ID = "4815162342";
const RUN_URL = "https://github.com/JoFe2/PANSPHAIRA/actions/runs/4815162342";
const READBACK_URL = "https://independent-lab.example/readback/4815162342";

// Exact pinned digests of the frozen profile artifacts (regression locks).
const PIN_SG_CONTENT_DIGEST = "6a5a1e1a4638c3e31fdd7c253e3e2ac540d18ddd5077b7ea7667555b1cc8e312";
const PIN_EIV_CONTENT_DIGEST = "35e8cf2ff62b7eb33c8a9f0078421f7ec3863b7bf267fd7f3dac75cd316be02d";
const PIN_EIV_RECEIPT_DIGEST = "04543c4a2753563f07dc567ae9a5eaeebf2e1592edbce914865d285a0b70da1e";
const PIN_MIGRATED_CONTENT_DIGEST = "23bfd4d44f0f30959490fd9122e99d903d6d08fdce8d9fa9218d785897ee540d";

// --- record inputs (one per evidence class, each with full own support) ----

function selfGeneratedInput(): AnyRecord {
  return {
    recordId: "evid-prov-sg-0001",
    dataClass: "PUBLIC_SYNTHETIC",
    claim: {
      claimId: "claim-ps379-sg-001",
      statement: "Closure matrix recomputes deterministic content and provider state rather than trusting self-attested fields",
    },
    evidenceClass: "SELF_GENERATED",
    head: { commitSha: COMMIT_SHA, treeSha: TREE_SHA },
    inputs: { inputsDigest: HEX_INPUTS },
    oracle: { oracleId: "oracle-closure-v1", oracleDigest: HEX_ORACLE },
    verifier: {
      implementation: "chimpmaera.verifyEvidenceProvenanceV1",
      tool: "node:test",
      model: "NONE",
      identityClass: "DETERMINISTIC_TOOL",
    },
    invocationDigest: HEX_INVOCATION,
    environment: { platform: "linux", runtime: "node24" },
    timestamp: TIMESTAMP,
    ci: { provider: "NONE", runId: "NONE", runUrl: "NONE", jobId: "NONE" },
    provider: { organization: "NONE", readbackUrl: "NONE", readbackDigest: "NONE", readbackTimestamp: "NONE" },
    review: { producerId: "NONE", producerOrganization: "NONE", reviewerId: "NONE", reviewerIdentityDigest: "NONE" },
    method: "DETERMINISTIC_RECOMPUTATION",
    resultDigest: HEX_RESULT,
  };
}

function isolatedInternalReviewInput(): AnyRecord {
  const input = selfGeneratedInput();
  input.recordId = "evid-prov-ir-0001";
  input.claim = { claimId: "claim-ps379-ir-001", statement: "Isolated internal review of the closure matrix by a reviewer distinct from the producer" };
  input.evidenceClass = "ISOLATED_INTERNAL_REVIEW";
  input.method = "INDEPENDENT_REVIEW";
  input.review = {
    producerId: "producer-001",
    producerOrganization: "NONE",
    reviewerId: "reviewer-001",
    reviewerIdentityDigest: HEX_REVIEWER,
  };
  return input;
}

function thirdPartyExecutionPlatformInput(): AnyRecord {
  const input = isolatedInternalReviewInput();
  input.recordId = "evid-prov-tp-0001";
  input.claim = { claimId: "claim-ps379-tp-001", statement: "Closure matrix executed on a third-party CI platform with provider-state readback" };
  input.evidenceClass = "THIRD_PARTY_EXECUTION_PLATFORM";
  input.method = "PLATFORM_EXECUTION";
  input.ci = { provider: "GITHUB_ACTIONS", runId: RUN_ID, runUrl: RUN_URL, jobId: `${RUN_ID}-1` };
  input.provider = { organization: "github-actions", readbackUrl: RUN_URL, readbackDigest: HEX_READBACK, readbackTimestamp: TIMESTAMP };
  return input;
}

function externalIndependentValidationInput(): AnyRecord {
  const input = thirdPartyExecutionPlatformInput();
  input.recordId = "evid-prov-eiv-0001";
  input.claim = { claimId: "claim-ps379-eiv-001", statement: "Independent validation by a provider distinct from the producer organization" };
  input.evidenceClass = "EXTERNAL_INDEPENDENT_VALIDATION";
  input.method = "EXTERNAL_VALIDATION";
  input.verifier = {
    implementation: "independent-lab.verifier-v1",
    tool: "node:test",
    model: "independent-validator-model-v1",
    identityClass: "EXTERNAL_HOSTED_MODEL",
  };
  input.provider = { organization: "independent-lab-corp", readbackUrl: READBACK_URL, readbackDigest: HEX_READBACK, readbackTimestamp: TIMESTAMP };
  input.review = {
    producerId: "producer-001",
    producerOrganization: "JoFe2",
    reviewerId: "reviewer-001",
    reviewerIdentityDigest: HEX_REVIEWER,
  };
  return input;
}

// --- helpers -----------------------------------------------------------------

function build(input: unknown): EvidenceProvenanceRecordV1 {
  const res = createEvidenceProvenanceRecordV1(input);
  assert.equal(res.outcome, "BUILT", JSON.stringify(res));
  assert.ok(res.outcome === "BUILT");
  return res.record;
}

function verify(record: unknown, recomputation: unknown): EvidenceProvenanceVerificationV1 {
  return verifyEvidenceProvenanceV1(record, recomputation);
}

/** Honest recomputation derived from a record's own bindings (test-side). */
function matchingRecomputation(record: EvidenceProvenanceRecordV1): AnyRecord {
  const r = record as AnyRecord;
  const inputs = r.inputs as AnyRecord;
  const oracle = r.oracle as AnyRecord;
  const head = r.head as AnyRecord;
  const ci = r.ci as AnyRecord;
  const provider = r.provider as AnyRecord;
  return {
    inputsDigest: inputs.inputsDigest,
    oracleDigest: oracle.oracleDigest,
    head: { commitSha: head.commitSha, treeSha: head.treeSha },
    ciRunId: ci.provider === "GITHUB_ACTIONS" ? ci.runId : EVIDENCE_PROVENANCE_NONE,
    providerReadbackDigest: provider.readbackDigest,
    resultDigest: r.resultDigest,
  };
}

function deniedCodes(v: EvidenceProvenanceVerificationV1): string[] {
  assert.equal(v.outcome, "DENIED", JSON.stringify(v));
  assert.ok(v.outcome === "DENIED");
  return [...v.reasonCodes];
}

function contains(codes: string[], code: string): void {
  assert.ok(codes.includes(code), `expected ${code} in [${codes.join(", ")}]`);
}

function isPlainFrozen(value: unknown, seen: Set<unknown>): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) throw new Error("cycle in frozen output");
  seen.add(value);
  assert.ok(Object.isFrozen(value), "output must be deeply frozen");
  for (const child of Object.values(value as AnyRecord)) isPlainFrozen(child, seen);
}

/** Recompute a record's content digest independently of the module. */
function independentContentDigest(record: AnyRecord): string {
  const { contentDigest: _ignored, ...rest } = record;
  return sha256(rest);
}

function clone(input: AnyRecord): AnyRecord {
  return structuredClone(input) as AnyRecord;
}

/** Re-stamp contentDigest after mutating a built record (test-side oracle). */
function restamp(record: AnyRecord): void {
  record.contentDigest = independentContentDigest(record);
}

// ---------------------------------------------------------------------------
// AC01 — closed provenance schema binds the full provenance tuple.
// ---------------------------------------------------------------------------

test("EVID-PROV AC01: the closed record schema binds every provenance dimension", () => {
  const record = build(selfGeneratedInput()) as AnyRecord;
  assert.equal(record.schemaVersion, EVIDENCE_PROVENANCE_RECORD_SCHEMA_V1);
  assert.deepStrictEqual(
    Object.keys(record).sort(),
    [
      "schemaVersion", "recordId", "dataClass", "claim", "evidenceClass",
      "head", "inputs", "oracle", "verifier", "invocationDigest",
      "environment", "timestamp", "ci", "provider", "review",
      "method", "resultDigest", "contentDigest",
    ].sort(),
  );
  assert.deepStrictEqual(Object.keys(record.claim as AnyRecord).sort(), ["claimId", "statement"]);
  assert.deepStrictEqual(Object.keys(record.head as AnyRecord).sort(), ["commitSha", "treeSha"]);
  assert.equal((record.inputs as AnyRecord).inputsDigest, HEX_INPUTS);
  assert.deepStrictEqual(Object.keys(record.oracle as AnyRecord).sort(), ["oracleDigest", "oracleId"]);
  assert.deepStrictEqual(
    Object.keys(record.verifier as AnyRecord).sort(),
    ["identityClass", "implementation", "model", "tool"],
  );
  assert.equal(record.invocationDigest, HEX_INVOCATION);
  assert.deepStrictEqual(Object.keys(record.environment as AnyRecord).sort(), ["platform", "runtime"]);
  assert.equal(record.timestamp, TIMESTAMP);
  assert.deepStrictEqual(Object.keys(record.ci as AnyRecord).sort(), ["jobId", "provider", "runId", "runUrl"]);
  assert.deepStrictEqual(
    Object.keys(record.provider as AnyRecord).sort(),
    ["organization", "readbackDigest", "readbackTimestamp", "readbackUrl"],
  );
  assert.deepStrictEqual(
    Object.keys(record.review as AnyRecord).sort(),
    ["producerId", "producerOrganization", "reviewerId", "reviewerIdentityDigest"],
  );
  assert.equal(record.resultDigest, HEX_RESULT);
  isPlainFrozen(record, new Set());
});

test("EVID-PROV AC01: builder stamps a content digest that recomputes independently", () => {
  const input = selfGeneratedInput();
  const record = build(input) as AnyRecord;
  const recomputed = independentContentDigest(record);
  assert.equal(record.contentDigest, recomputed);
  assert.equal(record.contentDigest, PIN_SG_CONTENT_DIGEST);
  // The builder must not mutate the caller input and must not stamp it.
  assert.ok(!("contentDigest" in input));
});

// ---------------------------------------------------------------------------
// AC02 — evidence classes are a closed set; no class implies a stronger one.
// ---------------------------------------------------------------------------

test("EVID-PROV AC02: the evidence class set is exactly the four AC classes", () => {
  assert.deepStrictEqual([...EVIDENCE_PROVENANCE_CLASSES_V1], [
    "SELF_GENERATED",
    "ISOLATED_INTERNAL_REVIEW",
    "THIRD_PARTY_EXECUTION_PLATFORM",
    "EXTERNAL_INDEPENDENT_VALIDATION",
  ]);
  assert.ok(Object.isFrozen(EVIDENCE_PROVENANCE_CLASSES_V1));
  assert.deepStrictEqual([...EVIDENCE_PROVENANCE_METHODS_V1].sort(), [
    "DETERMINISTIC_RECOMPUTATION", "EXTERNAL_VALIDATION", "INDEPENDENT_REVIEW", "PLATFORM_EXECUTION",
  ]);
  assert.deepStrictEqual([...EVIDENCE_PROVENANCE_VERIFIER_IDENTITY_CLASSES_V1].sort(), [
    "DETERMINISTIC_TOOL", "EXTERNAL_HOSTED_MODEL", "INDEPENDENT_REVIEWER", "SELF_HOSTED_MODEL",
  ]);
  // The class-to-method mapping is a bijection: each class names exactly one
  // method and no two classes share one (no class implies a stronger one).
  const methods = EVIDENCE_PROVENANCE_CLASSES_V1.map((c) => EVIDENCE_PROVENANCE_CLASS_METHOD_V1[c]);
  assert.equal(new Set(methods).size, 4);
  assert.ok(Object.isFrozen(EVIDENCE_PROVENANCE_CLASS_METHOD_V1));
  assert.ok(EVIDENCE_PROVENANCE_REASON_CODES_V1.includes("EVIDENCE_PROVENANCE_VERIFIED"));
});

test("EVID-PROV AC02: promotion fails closed for every stronger class claim", () => {
  const cases: Array<[string, AnyRecord, string]> = [
    ["SG support claiming ISOLATED_INTERNAL_REVIEW", isolatedReviewClaimingOnSg(), "EVIDENCE_PROVENANCE_CLASS_PROMOTION_DENIED"],
    ["SG support claiming THIRD_PARTY_EXECUTION_PLATFORM", thirdPartyClaimingOnSg(), "EVIDENCE_PROVENANCE_CLASS_PROMOTION_DENIED"],
    ["SG support claiming EXTERNAL_INDEPENDENT_VALIDATION", externalClaimingOnSg(), "EVIDENCE_PROVENANCE_CLASS_PROMOTION_DENIED"],
    ["IIR support claiming THIRD_PARTY_EXECUTION_PLATFORM", thirdPartyClaimingOnIir(), "EVIDENCE_PROVENANCE_CLASS_PROMOTION_DENIED"],
    ["IIR support claiming EXTERNAL_INDEPENDENT_VALIDATION", externalClaimingOnIir(), "EVIDENCE_PROVENANCE_CLASS_PROMOTION_DENIED"],
    ["TPEP support claiming EXTERNAL_INDEPENDENT_VALIDATION", externalClaimingOnTp(), "EVIDENCE_PROVENANCE_CLASS_PROMOTION_DENIED"],
  ];
  for (const [label, input, expected] of cases) {
    const res = createEvidenceProvenanceRecordV1(input);
    assert.equal(res.outcome, "DENIED", label);
    assert.ok(res.outcome === "DENIED");
    contains([...res.reasonCodes], expected);
  }
});

test("EVID-PROV AC02: claiming a weaker class than the support proves is honest", () => {
  const input = externalIndependentValidationInput();
  input.evidenceClass = "SELF_GENERATED";
  input.method = "DETERMINISTIC_RECOMPUTATION";
  const record = build(input);
  const v = verify(record, matchingRecomputation(record));
  assert.equal(v.outcome, "VERIFIED", JSON.stringify(v));
});

function isolatedReviewClaimingOnSg(): AnyRecord {
  const input = selfGeneratedInput();
  input.evidenceClass = "ISOLATED_INTERNAL_REVIEW";
  input.method = "INDEPENDENT_REVIEW";
  return input;
}
function thirdPartyClaimingOnSg(): AnyRecord {
  const input = selfGeneratedInput();
  input.evidenceClass = "THIRD_PARTY_EXECUTION_PLATFORM";
  input.method = "PLATFORM_EXECUTION";
  return input;
}
function externalClaimingOnSg(): AnyRecord {
  const input = selfGeneratedInput();
  input.evidenceClass = "EXTERNAL_INDEPENDENT_VALIDATION";
  input.method = "EXTERNAL_VALIDATION";
  return input;
}
function thirdPartyClaimingOnIir(): AnyRecord {
  const input = isolatedInternalReviewInput();
  input.evidenceClass = "THIRD_PARTY_EXECUTION_PLATFORM";
  input.method = "PLATFORM_EXECUTION";
  return input;
}
function externalClaimingOnIir(): AnyRecord {
  const input = isolatedInternalReviewInput();
  input.evidenceClass = "EXTERNAL_INDEPENDENT_VALIDATION";
  input.method = "EXTERNAL_VALIDATION";
  return input;
}
function externalClaimingOnTp(): AnyRecord {
  const input = thirdPartyExecutionPlatformInput();
  input.evidenceClass = "EXTERNAL_INDEPENDENT_VALIDATION";
  input.method = "EXTERNAL_VALIDATION";
  return input;
}

test("EVID-PROV AC02: method must match the claimed class", () => {
  const input = selfGeneratedInput();
  input.evidenceClass = "SELF_GENERATED";
  input.method = "EXTERNAL_VALIDATION";
  const res = createEvidenceProvenanceRecordV1(input);
  assert.equal(res.outcome, "DENIED");
  assert.ok(res.outcome === "DENIED");
  contains([...res.reasonCodes], "EVIDENCE_PROVENANCE_METHOD_CLASS_MISMATCH_DENIED");
});

// ---------------------------------------------------------------------------
// AC03 — verification recomputes content and provider state; it never trusts
// caller-authored PASS fields.
// ---------------------------------------------------------------------------

test("EVID-PROV AC03: all four classes verify against a matching recomputation", () => {
  const inputs: Array<[string, AnyRecord, string]> = [
    ["SELF_GENERATED", selfGeneratedInput(), "SELF_GENERATED"],
    ["ISOLATED_INTERNAL_REVIEW", isolatedInternalReviewInput(), "ISOLATED_INTERNAL_REVIEW"],
    ["THIRD_PARTY_EXECUTION_PLATFORM", thirdPartyExecutionPlatformInput(), "THIRD_PARTY_EXECUTION_PLATFORM"],
    ["EXTERNAL_INDEPENDENT_VALIDATION", externalIndependentValidationInput(), "EXTERNAL_INDEPENDENT_VALIDATION"],
  ];
  for (const [label, input, cls] of inputs) {
    const record = build(input) as AnyRecord;
    const v = verify(record, matchingRecomputation(record));
    assert.equal(v.outcome, "VERIFIED", `${label} ${JSON.stringify(v)}`);
    assert.ok(v.outcome === "VERIFIED");
    assert.deepStrictEqual([...v.reasonCodes], ["EVIDENCE_PROVENANCE_VERIFIED"]);
    assert.equal(v.evidenceClass, cls);
    assert.equal(v.contentDigest, independentContentDigest(record));
  }
});

test("EVID-PROV AC03: the stored content digest is recomputed, never trusted", () => {
  const record = clone(build(selfGeneratedInput()) as AnyRecord);
  const original = String(record.contentDigest);
  const alt = original[0] === "0" ? "f" : "0";
  record.contentDigest = alt + original.slice(1);
  const v = verify(record, matchingRecomputation(record as EvidenceProvenanceRecordV1));
  contains(deniedCodes(v), "EVIDENCE_PROVENANCE_CONTENT_DIGEST_DENIED");
});

test("EVID-PROV AC03: caller-authored PASS fields fail closed, never trusted", () => {
  const record = build(selfGeneratedInput()) as AnyRecord;
  const selfSigned: Array<[string, unknown]> = [
    ["pass: true", { ...record, pass: true }],
    ["PASS: YES", { ...record, PASS: "YES" }],
    ["result: PASS", { ...record, result: "PASS" }],
    ["verified: true", { ...record, verified: true }],
    ["nested claim.pass", { ...record, claim: { ...record.claim, pass: true } }],
  ];
  for (const [label, hostile] of selfSigned) {
    const v = verify(hostile, matchingRecomputation(record as EvidenceProvenanceRecordV1));
    const codes = deniedCodes(v);
    contains(codes, "EVIDENCE_PROVENANCE_SELF_SIGNED_PASS_DENIED");
    assert.notDeepStrictEqual(v.outcome, "VERIFIED", label);
  }
});

test("EVID-PROV AC03: honest NONE digests bind nothing and cannot be subbed", () => {
  const input = selfGeneratedInput();
  input.inputs = { inputsDigest: EVIDENCE_PROVENANCE_NONE };
  input.resultDigest = EVIDENCE_PROVENANCE_NONE;
  const record = build(input) as AnyRecord;
  // A recompute with a real digest must NOT be treated as substitution when
  // the record honestly declared no binding.
  const rec = matchingRecomputation(record as EvidenceProvenanceRecordV1);
  rec.inputsDigest = HEX_INPUTS;
  rec.resultDigest = HEX_RESULT;
  const v = verify(record, rec);
  assert.equal(v.outcome, "VERIFIED", JSON.stringify(v));
});

// ---------------------------------------------------------------------------
// AC05 — the fail-closed adversarial matrix.
// ---------------------------------------------------------------------------

test("EVID-PROV AC05: substituted oracle, input, head, run and result are denied", () => {
  const record = build(thirdPartyExecutionPlatformInput()) as AnyRecord;
  const base = () => matchingRecomputation(record as EvidenceProvenanceRecordV1);
  const otherHex = "1".repeat(64);

  const cases: Array<[string, AnyRecord, string]> = [
    ["substituted oracle", { ...base(), oracleDigest: otherHex }, "EVIDENCE_PROVENANCE_ORACLE_SUBSTITUTION_DENIED"],
    ["substituted inputs", { ...base(), inputsDigest: otherHex }, "EVIDENCE_PROVENANCE_INPUT_SUBSTITUTION_DENIED"],
    ["substituted head", { ...base(), head: { commitSha: "c".repeat(40), treeSha: TREE_SHA } }, "EVIDENCE_PROVENANCE_HEAD_SUBSTITUTION_DENIED"],
    ["substituted run id", { ...base(), ciRunId: "9999999999" }, "EVIDENCE_PROVENANCE_RUN_SUBSTITUTION_DENIED"],
    ["substituted provider readback", { ...base(), providerReadbackDigest: otherHex }, "EVIDENCE_PROVENANCE_RUN_SUBSTITUTION_DENIED"],
    ["substituted result", { ...base(), resultDigest: otherHex }, "EVIDENCE_PROVENANCE_RESULT_DIGEST_DENIED"],
  ];
  for (const [label, rec, expected] of cases) {
    const v = verify(record, rec);
    const codes = deniedCodes(v);
    contains(codes, expected);
  }
});

test("EVID-PROV AC05: missing provider readback fails closed", () => {
  // Class requires the readback but the record honestly has none.
  const input = thirdPartyExecutionPlatformInput();
  input.provider = { organization: "github-actions", readbackUrl: RUN_URL, readbackDigest: EVIDENCE_PROVENANCE_NONE, readbackTimestamp: TIMESTAMP };
  const res = createEvidenceProvenanceRecordV1(input);
  assert.equal(res.outcome, "DENIED");
  assert.ok(res.outcome === "DENIED");
  contains([...res.reasonCodes], "EVIDENCE_PROVENANCE_MISSING_PROVIDER_READBACK_DENIED");

  // Record claims a readback but the provider state cannot be read back.
  const record = build(thirdPartyExecutionPlatformInput()) as AnyRecord;
  const rec = matchingRecomputation(record as EvidenceProvenanceRecordV1);
  rec.providerReadbackDigest = EVIDENCE_PROVENANCE_NONE;
  const v = verify(record, rec);
  contains(deniedCodes(v), "EVIDENCE_PROVENANCE_MISSING_PROVIDER_READBACK_DENIED");
});

test("EVID-PROV AC05: forged reviewer identity fails closed", () => {
  const cases: Array<[string, AnyRecord, string]> = [
    [
      "reviewer identical to producer",
      (() => { const i = isolatedInternalReviewInput(); i.review = { ...i.review, reviewerId: "producer-001" }; return i; })(),
      "EVIDENCE_PROVENANCE_FORGED_REVIEWER_IDENTITY_DENIED",
    ],
    [
      "reviewer identity unattested",
      (() => { const i = isolatedInternalReviewInput(); i.review = { ...i.review, reviewerIdentityDigest: EVIDENCE_PROVENANCE_NONE }; return i; })(),
      "EVIDENCE_PROVENANCE_FORGED_REVIEWER_IDENTITY_DENIED",
    ],
    [
      "reviewer present with no producer binding",
      (() => { const i = selfGeneratedInput(); i.review = { producerId: EVIDENCE_PROVENANCE_NONE, producerOrganization: EVIDENCE_PROVENANCE_NONE, reviewerId: "reviewer-001", reviewerIdentityDigest: HEX_REVIEWER }; return i; })(),
      "EVIDENCE_PROVENANCE_FORGED_REVIEWER_IDENTITY_DENIED",
    ],
    [
      "isolated review claimed but never performed",
      isolatedReviewClaimingOnSg(),
      "EVIDENCE_PROVENANCE_CLASS_PROMOTION_DENIED",
    ],
  ];
  for (const [label, input, expected] of cases) {
    const res = createEvidenceProvenanceRecordV1(input);
    assert.equal(res.outcome, "DENIED", label);
    assert.ok(res.outcome === "DENIED");
    contains([...res.reasonCodes], expected);
  }
});

test("EVID-PROV AC05: hostile, non-plain inputs are denied without throwing", () => {
  const record = build(selfGeneratedInput());
  const rec = matchingRecomputation(record);
  const cyclic: AnyRecord = { a: 1 };
  cyclic.a = cyclic;
  const accessor: AnyRecord = {};
  Object.defineProperty(accessor, "schemaVersion", { get(): string { throw new Error("trap"); } });
  const throwingProxy = new Proxy(
    { schemaVersion: "x" },
    { get(): unknown { throw new Error("trap"); } },
  );
  const hostiles: Array<[string, unknown, unknown]> = [
    ["throwing proxy", throwingProxy, rec],
    ["cyclic object", cyclic, rec],
    ["accessor property", accessor, rec],
    ["null prototype", Object.create(null), rec],
    ["string record", "record", rec],
    ["null record", null, rec],
    ["array record", [record], rec],
    ["undefined recomputation", record, undefined],
    ["NaN field", { ...record, resultDigest: Number.NaN } as unknown, rec],
    ["undefined field", { ...record, recordId: undefined } as unknown, rec],
    ["recomputation as string", record, "recomputation"],
  ];
  for (const [label, hostileRecord, hostileRec] of hostiles) {
    let v: EvidenceProvenanceVerificationV1;
    try {
      v = verify(hostileRecord, hostileRec);
    } catch (err) {
      assert.fail(`${label} threw: ${String(err)}`);
    }
    assert.equal(v.outcome, "DENIED", label);
  }
});

test("EVID-PROV AC05: schema negatives are denied with a structured code", () => {
  const mutate: Array<[string, (input: AnyRecord) => void]> = [
    ["missing recordId", (i) => { delete i.recordId; }],
    ["unknown top-level key", (i) => { i.extra = true; }],
    ["short commit sha", (i) => { (i.head as AnyRecord).commitSha = COMMIT_SHA.slice(0, 39); }],
    ["uppercase commit sha", (i) => { (i.head as AnyRecord).commitSha = COMMIT_SHA.toUpperCase(); }],
    ["long tree sha", (i) => { (i.head as AnyRecord).treeSha = `${TREE_SHA}f`; }],
    ["non-rfc3339 timestamp", (i) => { i.timestamp = "2026-09-05 06:00:00Z"; }],
    ["short inputs digest", (i) => { (i.inputs as AnyRecord).inputsDigest = HEX_INPUTS.slice(0, 63); }],
    ["bad invocation digest", (i) => { i.invocationDigest = "NOPE"; }],
    ["long result digest", (i) => { i.resultDigest = `${HEX_RESULT}f`; }],
    ["unknown verifier identity class", (i) => { (i.verifier as AnyRecord).identityClass = "SUPER_TOOL"; }],
    ["empty verifier model", (i) => { (i.verifier as AnyRecord).model = ""; }],
    ["whitespace platform", (i) => { (i.environment as AnyRecord).platform = "linux x86_64"; }],
    ["CI provider with NONE run id", (i) => { const c = clone(i.ci as AnyRecord); c.provider = "GITHUB_ACTIONS"; i.ci = c; }],
    ["CI NONE with run id", (i) => { const c = clone(i.ci as AnyRecord); c.runId = "123"; i.ci = c; }],
    ["non-https run url", (i) => { const c = clone(i.ci as AnyRecord); c.provider = "GITHUB_ACTIONS"; c.runId = RUN_ID; c.runUrl = "http://github.com/JoFe2/PANSPHAIRA/actions/runs/1"; c.jobId = "1-1"; i.ci = c; }],
    ["provider org without readback digest", (i) => { const p = clone(i.provider as AnyRecord); p.organization = "lab"; i.provider = p; }],
    ["bad readback timestamp", (i) => { const p = clone(i.provider as AnyRecord); p.organization = "lab"; p.readbackUrl = READBACK_URL; p.readbackDigest = HEX_READBACK; p.readbackTimestamp = "yesterday"; i.provider = p; }],
    ["unknown evidence class", (i) => { i.evidenceClass = "PARTIALLY_TRUSTED"; }],
    ["unknown data class", (i) => { i.dataClass = "CUSTOMER"; }],
    ["empty statement", (i) => { (i.claim as AnyRecord).statement = ""; }],
    ["whitespace claim id", (i) => { (i.claim as AnyRecord).claimId = "claim ps379"; }],
    ["whitespace record id", (i) => { i.recordId = "evid prov"; }],
    ["claim as array", (i) => { i.claim = ["claim"]; }],
    ["content digest not hex", (i) => { i.contentDigest = "zz"; }],
  ];
  for (const [label, mutation] of mutate) {
    const input = selfGeneratedInput();
    mutation(input);
    const res = createEvidenceProvenanceRecordV1(input);
    assert.equal(res.outcome, "DENIED", label);
    assert.ok(res.outcome === "DENIED");
    contains([...res.reasonCodes], "EVIDENCE_PROVENANCE_SCHEMA_DENIED");
  }
  // A full (digest-stamped) record with an unknown evidence class is also
  // denied by verify, not only by the builder.
  const full = clone(build(selfGeneratedInput()) as AnyRecord);
  full.evidenceClass = "PARTIALLY_TRUSTED";
  const v = verify(full, matchingRecomputation(full as EvidenceProvenanceRecordV1));
  contains(deniedCodes(v), "EVIDENCE_PROVENANCE_SCHEMA_DENIED");
});

test("EVID-PROV AC05: the recomputation shape is closed", () => {
  const record = build(selfGeneratedInput());
  const rec = matchingRecomputation(record);
  const bad = { ...rec, extra: true };
  delete (bad as AnyRecord).resultDigest;
  for (const hostile of [bad, { ...rec, head: { commitSha: COMMIT_SHA } }, { ...rec, ciRunId: "" }]) {
    const v = verify(record, hostile);
    const codes = deniedCodes(v);
    contains(codes, "EVIDENCE_PROVENANCE_SCHEMA_DENIED");
  }
});

// ---------------------------------------------------------------------------
// AC04 — the public review receipt exposes safe method/provenance only.
// ---------------------------------------------------------------------------

function issueReceipt(record: unknown, verification: unknown): EvidenceProvenancePublicReceiptResultV1 {
  return publicReviewReceiptV1(record, verification);
}

test("EVID-PROV AC04: verified records issue a receipt with the safe fields only", () => {
  const inputs: AnyRecord[] = [
    selfGeneratedInput(),
    isolatedInternalReviewInput(),
    thirdPartyExecutionPlatformInput(),
    externalIndependentValidationInput(),
  ];
  for (const input of inputs) {
    const record = build(input) as AnyRecord;
    const v = verify(record, matchingRecomputation(record as EvidenceProvenanceRecordV1));
    assert.equal(v.outcome, "VERIFIED");
    const res = issueReceipt(record, v);
    assert.equal(res.outcome, "ISSUED", JSON.stringify(res));
    assert.ok(res.outcome === "ISSUED");
    const receipt = res.receipt as AnyRecord;
    assert.equal(receipt.schemaVersion, EVIDENCE_PROVENANCE_PUBLIC_RECEIPT_SCHEMA_V1);
    assert.deepStrictEqual(
      Object.keys(receipt).sort(),
      [
        "schemaVersion", "recordId", "claimId", "evidenceClass", "method", "head",
        "verifier", "ci", "provider", "dataClass", "timestamp",
        "resultDigest", "contentDigest", "receiptDigest",
      ].sort(),
    );
    // Exact-head binding is exposed verbatim.
    assert.deepStrictEqual(receipt.head, { commitSha: COMMIT_SHA, treeSha: TREE_SHA });
    assert.equal(receipt.contentDigest, record.contentDigest);
    // The receipt digest recomputes independently.
    const { receiptDigest: _r, ...rest } = receipt;
    assert.equal(receipt.receiptDigest, sha256(rest));
    isPlainFrozen(receipt, new Set());
  }
});

test("EVID-PROV AC04: private material never appears in the public receipt", () => {
  const record = build(externalIndependentValidationInput()) as AnyRecord;
  const v = verify(record, matchingRecomputation(record as EvidenceProvenanceRecordV1));
  const res = issueReceipt(record, v);
  assert.equal(res.outcome, "ISSUED");
  assert.ok(res.outcome === "ISSUED");
  const json = canonicalJson(res.receipt as AnyRecord);
  // Hidden reasoning (statement), prompt/invocation material, environment
  // detail, oracle/inputs detail and reviewer handles are all excluded.
  assert.ok(!json.includes((record.claim as AnyRecord).statement as string), "statement leaked");
  assert.ok(!json.includes(record.invocationDigest as string), "invocation digest leaked");
  assert.ok(!json.includes((record.oracle as AnyRecord).oracleId as string), "oracle detail leaked");
  assert.ok(!json.includes((record.inputs as AnyRecord).inputsDigest as string), "inputs detail leaked");
  assert.ok(!json.includes((record.review as AnyRecord).reviewerId as string), "reviewer handle leaked");
  assert.ok(!json.includes((record.environment as AnyRecord).platform as string), "environment leaked");
});

test("EVID-PROV AC04: receipt issuance is bound to the verified record content", () => {
  const recordA = build(selfGeneratedInput()) as AnyRecord;
  const recordB = build(isolatedInternalReviewInput()) as AnyRecord;
  const recA = matchingRecomputation(recordA as EvidenceProvenanceRecordV1);
  const vA = verify(recordA, recA);
  assert.equal(vA.outcome, "VERIFIED");
  // Passing record B with record A's verification must fail closed.
  const res = issueReceipt(recordB, vA);
  assert.equal(res.outcome, "DENIED");
  assert.ok(res.outcome === "DENIED");
  contains([...res.reasonCodes], "EVIDENCE_PROVENANCE_RECEIPT_UNVERIFIED_DENIED");
  // A DENIED verification cannot issue anything.
  const vDenied = verify(recordA, { ...recA, head: { commitSha: "d".repeat(40), treeSha: TREE_SHA } });
  const resDenied = issueReceipt(recordA, vDenied);
  assert.equal(resDenied.outcome, "DENIED");
  assert.ok(resDenied.outcome === "DENIED");
  contains([...resDenied.reasonCodes], "EVIDENCE_PROVENANCE_RECEIPT_UNVERIFIED_DENIED");
});

test("EVID-PROV AC04: non-public data classes refuse public issuance", () => {
  const input = selfGeneratedInput();
  input.dataClass = "OWNER_PRIVATE_REFERENCE";
  const record = build(input) as AnyRecord;
  const v = verify(record, matchingRecomputation(record as EvidenceProvenanceRecordV1));
  assert.equal(v.outcome, "VERIFIED");
  const res = issueReceipt(record, v);
  assert.equal(res.outcome, "DENIED");
  assert.ok(res.outcome === "DENIED");
  contains([...res.reasonCodes], "EVIDENCE_PROVENANCE_DATA_CLASS_DENIED");
});

test("EVID-PROV AC04: secrets, private paths and credentials fail closed in projected fields", () => {
  const base = () => build(thirdPartyExecutionPlatformInput()) as AnyRecord;
  const recompute = (record: AnyRecord) => matchingRecomputation(record as EvidenceProvenanceRecordV1);
  const cases: Array<[string, (record: AnyRecord) => void]> = [
    ["github token in run url", (r) => { (r.ci as AnyRecord).runUrl = `${RUN_URL}?token=ghp_${"A".repeat(32)}`; }],
    ["private user path in readback url", (r) => { (r.provider as AnyRecord).readbackUrl = "https://x.example/Users/jane/secrets"; }],
    ["aws access key in organization", (r) => { (r.provider as AnyRecord).organization = `AKIA${"B".repeat(16)}`; }],
    ["private home path in readback url", (r) => { (r.provider as AnyRecord).readbackUrl = "https://x.example/home/jane/.ssh/id_rsa"; }],
  ];
  for (const [label, mutate] of cases) {
    const record = clone(base());
    mutate(record);
    restamp(record);
    const v = verify(record, recompute(record));
    assert.equal(v.outcome, "VERIFIED", label);
    const res = issueReceipt(record, v);
    assert.equal(res.outcome, "DENIED", label);
    assert.ok(res.outcome === "DENIED");
    contains([...res.reasonCodes], "EVIDENCE_PROVENANCE_REDACTION_DENIED");
  }
});

test("EVID-PROV AC04: the public receipt pins its exact digest", () => {
  const record = build(externalIndependentValidationInput()) as AnyRecord;
  const v = verify(record, matchingRecomputation(record as EvidenceProvenanceRecordV1));
  const res = issueReceipt(record, v);
  assert.equal(res.outcome, "ISSUED");
  assert.ok(res.outcome === "ISSUED");
  assert.equal((res.receipt as AnyRecord).receiptDigest, PIN_EIV_RECEIPT_DIGEST);
  assert.equal((record as AnyRecord).contentDigest, PIN_EIV_CONTENT_DIGEST);
});

// ---------------------------------------------------------------------------
// AC06 — legacy evidence migrates with the honest weakest class only.
// ---------------------------------------------------------------------------

const LEGACY_RECEIPT_BYTES: AnyRecord = {
  id: "legacy-aps-review-0001",
  result: "PASS",
  note: "checked-in self-attested legacy AP review receipt",
};

function legacyMigrationInput(): AnyRecord {
  return {
    receiptId: "legacy-aps-review-0001",
    receiptDigest: sha256(LEGACY_RECEIPT_BYTES),
    legacyResult: "PASS",
    statement: "Legacy AP review receipt migrated with the honest weakest class",
    head: { commitSha: COMMIT_SHA, treeSha: TREE_SHA },
    verifier: {
      implementation: "legacy-aps-reviewer",
      tool: "node:test",
      model: "NONE",
      identityClass: "SELF_HOSTED_MODEL",
    },
    environment: { platform: "linux", runtime: "node24" },
    timestamp: TIMESTAMP,
    dataClass: "PUBLIC_SYNTHETIC",
  };
}

function migrate(input: unknown): EvidenceProvenanceMigrationResultV1 {
  return migrateLegacyEvidenceReceiptV1(input);
}

test("EVID-PROV AC06: legacy receipts migrate to the weakest class only", () => {
  const res = migrate(legacyMigrationInput());
  assert.equal(res.outcome, "MIGRATED", JSON.stringify(res));
  assert.ok(res.outcome === "MIGRATED");
  const record = res.record as AnyRecord;
  assert.equal(record.evidenceClass, "SELF_GENERATED");
  assert.equal(record.method, "DETERMINISTIC_RECOMPUTATION");
  assert.equal((record.inputs as AnyRecord).inputsDigest, EVIDENCE_PROVENANCE_NONE);
  assert.equal(record.resultDigest, EVIDENCE_PROVENANCE_NONE);
  assert.equal(record.invocationDigest, EVIDENCE_PROVENANCE_NONE);
  // The only honestly bindable oracle is the legacy receipt's own bytes.
  assert.equal(
    (record.oracle as AnyRecord).oracleDigest,
    sha256(LEGACY_RECEIPT_BYTES),
    "oracle must bind the recomputed legacy receipt bytes",
  );
  assert.equal((record.ci as AnyRecord).provider, EVIDENCE_PROVENANCE_NONE);
  assert.equal((record.provider as AnyRecord).organization, EVIDENCE_PROVENANCE_NONE);
  // No retrospective stronger claim: the self-attested legacy result field
  // has no representation in the migrated record.
  const json = canonicalJson(record);
  assert.ok(!json.includes("\"PASS\""), "legacy self-attested result leaked into the record");
  assert.ok(res.nonclaims.includes("WEAKEST_CLASS_ASSIGNED"));
  assert.ok(res.nonclaims.includes("LEGACY_SELF_SIGNED_RESULT_IGNORED"));
  assert.equal(record.contentDigest, PIN_MIGRATED_CONTENT_DIGEST);
  isPlainFrozen(record, new Set());
});

test("EVID-PROV AC06: the migrated binding is live, not cosmetic", () => {
  const res = migrate(legacyMigrationInput());
  assert.ok(res.outcome === "MIGRATED");
  const record = res.record;
  const rec: AnyRecord = {
    inputsDigest: EVIDENCE_PROVENANCE_NONE,
    oracleDigest: sha256(LEGACY_RECEIPT_BYTES),
    head: { commitSha: COMMIT_SHA, treeSha: TREE_SHA },
    ciRunId: EVIDENCE_PROVENANCE_NONE,
    providerReadbackDigest: EVIDENCE_PROVENANCE_NONE,
    resultDigest: EVIDENCE_PROVENANCE_NONE,
  };
  const v = verify(record, rec);
  assert.equal(v.outcome, "VERIFIED", JSON.stringify(v));
  // Substituting the head or the legacy receipt bytes fails closed.
  const vHead = verify(record, { ...rec, head: { commitSha: "e".repeat(40), treeSha: TREE_SHA } });
  contains(deniedCodes(vHead), "EVIDENCE_PROVENANCE_HEAD_SUBSTITUTION_DENIED");
  const vOracle = verify(record, { ...rec, oracleDigest: "2".repeat(64) });
  contains(deniedCodes(vOracle), "EVIDENCE_PROVENANCE_ORACLE_SUBSTITUTION_DENIED");
});

test("EVID-PROV AC06: migration refuses to invent a stronger verifier class", () => {
  for (const identityClass of ["EXTERNAL_HOSTED_MODEL", "INDEPENDENT_REVIEWER"] as const) {
    const input = legacyMigrationInput();
    (input.verifier as AnyRecord).identityClass = identityClass;
    const res = migrate(input);
    assert.equal(res.outcome, "DENIED", identityClass);
    assert.ok(res.outcome === "DENIED");
    contains([...res.reasonCodes], "EVIDENCE_PROVENANCE_CLASS_PROMOTION_DENIED");
  }
});

test("EVID-PROV AC06: the migration input shape is closed", () => {
  const missing = legacyMigrationInput();
  delete missing.legacyResult;
  const unknown = legacyMigrationInput();
  unknown.evidenceClass = "EXTERNAL_INDEPENDENT_VALIDATION";
  const badDigest = legacyMigrationInput();
  badDigest.receiptDigest = "not-a-digest";
  for (const hostile of [missing, unknown, badDigest]) {
    const res = migrate(hostile);
    assert.equal(res.outcome, "DENIED");
    assert.ok(res.outcome === "DENIED");
    contains([...res.reasonCodes], "EVIDENCE_PROVENANCE_SCHEMA_DENIED");
  }
});