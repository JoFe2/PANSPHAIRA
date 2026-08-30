/**
 * CKS-12 prerequisite receipt binder — deterministic, fail-closed.
 *
 * Binds the positive #287–#291 proof packages (CKS-07 … CKS-11) used as
 * CKS-12 inputs into a single prerequisite bind receipt.
 *
 * What this binder MAY claim:
 *  - the prerequisite input set is exactly the five positive receipts,
 *    in boundary order (#287 → #291), each in proofState PASS_SYNTHETIC_ONLY;
 *  - every receipt's closed field set, identity, and SHA-256/canonical-JSON
 *    integrity bindings hold;
 *  - a single shared component version lock digest covers all five receipts.
 *
 * What this binder MUST NOT claim (fail-closed):
 *  - CKS-12 `PASS_SYNTHETIC_ONLY` (the integrated proof is NOT_RUN;
 *    cksProjectionRunEvidence is NOT_PRESENT in the frozen boundary);
 *  - that the CKS-07 … CKS-11 dependency proofs passed in any authority
 *    sense (the bind receipt carries the boundary's nonClaims verbatim and
 *    records integratedProofState EVIDENCE_INCOMPLETE with successClaimed
 *    false).
 *
 * Any missing, invalid, stale, or mis-ordered prerequisite receipt yields a
 * DENIED outcome with finite reason codes — never a success receipt.
 *
 * Canonical JSON below is a verbatim copy of packages/contracts/src/
 * canonical-json.ts, pinned in verification/cks-12-closed-loop-boundary-v1.json
 * (knownRepositoryPins.canonicalJsonSourceSha256 =
 * 666513ba9a89c0eae0daa0e0159a262eb4e0aa105971a151a19bac1a9b6c4826). The
 * tests verify runtime parity with the repository copy.
 */

import { createHash } from "node:crypto";

/* ------------------------------------------------------------------ */
/* Canonical JSON (verbatim copy of packages/contracts/src/           */
/* canonical-json.ts — see provenance note above).                    */
/* ------------------------------------------------------------------ */

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON rejects non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError("Canonical JSON accepts plain JSON objects only");
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => {
      if (record[key] === undefined) {
        throw new TypeError("Canonical JSON rejects undefined object values");
      }
      return `${JSON.stringify(key)}:${canonicalJson(record[key])}`;
    });
  return `{${entries.join(",")}}`;
}

/* ------------------------------------------------------------------ */
/* Frozen boundary constants (verification/cks-12-closed-loop-        */
/* boundary-v1.json; receiptSha256 d643f720…).                        */
/* ------------------------------------------------------------------ */

export const BOUNDARY_RECEIPT_ID = "CKS-12-CLOSED-LOOP-BOUNDARY-V1";
export const BOUNDARY_RECEIPT_SHA256 =
  "d643f720a996c9ac2d167296c1edfd228760a3ca19196c09f9c0dfd6615d1328";
export const BOUNDARY_CONTRACT_VERSION = "v1";
export const REPOSITORY = "JoFe2/PANSPHAIRA";
export const BASE_COMMIT = "353017c4f60e30463d0a78fd6fd2509a37d37f76";
export const GENESIS_PREVIOUS_RECEIPT_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
/** SHA-256 over canonicalJson(ORDERED_STORY_STEP_IDS). */
export const STORY_STEP_VOCABULARY_SHA256 =
  "d178bb61b1e773e8ecc2641a439392a5b882d4b40d494feb66042a770906b869";

export const ORDERED_STORY_STEP_IDS: readonly string[] = [
  "CKS-12-P2-SS-01",
  "CKS-12-P2-SS-02",
  "CKS-12-P2-SS-03",
  "CKS-12-P2-SS-04",
  "CKS-12-P2-SS-05",
  "CKS-12-P2-SS-06",
  "CKS-12-P2-SS-07",
  "CKS-12-P2-SS-08",
  "CKS-12-P2-SS-09",
  "CKS-12-P2-SS-10",
  "CKS-12-P2-SS-11",
  "CKS-12-P2-SS-12",
  "CKS-12-P2-SS-13",
  "CKS-12-P2-SS-14",
  "CKS-12-P2-SS-15",
  "CKS-12-P2-SS-16",
  "CKS-12-P2-SS-17",
  "CKS-12-P2-SS-18",
  "CKS-12-P2-SS-19",
  "CKS-12-P2-SS-20",
  "CKS-12-P2-SS-21",
  "CKS-12-P2-SS-22",
  "CKS-12-P2-SS-23",
];

/** Verbatim from the frozen boundary; the bind receipt carries these. */
export const NON_CLAIMS: readonly string[] = [
  "CKS_07_THROUGH_CKS_11_DEPENDENCY_PROOFS_PASSED",
  "CKS_12_SYNTHETIC_LOOP_PASSED",
  "MODEL_OR_RUNTIME_EXECUTED",
  "KALEIDOSPHERE_CKS_ADAPTER_EXISTS_OR_RAN",
  "WORKFLOW_OR_FUNCTION_ACTIVATED",
  "GENERALIZATION_BEYOND_FROZEN_SYNTHETIC_FIXTURES",
  "PRODUCTION_READINESS",
  "SECURITY_CERTIFICATION",
  "AVAILABILITY_OR_PERFORMANCE",
  "MERGED_OR_RELEASED",
];

/* ------------------------------------------------------------------ */
/* Schema versions and receipt identifiers.                           */
/* ------------------------------------------------------------------ */

export const FIXTURE_SCHEMA_VERSION = "chimpmaera.cks/prerequisite-receipts-fixture/v1";
export const FIXTURE_ID = "CKS-12-PREREQUISITE-RECEIPTS-FIXTURE-V1";
/** SHA-256 of the checked-in, canonical positive prerequisite fixture bytes. */
export const FIXTURE_SHA256 =
  "9821418a25afadeb8afa990426b628a5d01fd248e38f1024dfc7a23c9bf46860";
export const PREREQUISITE_RECEIPT_SCHEMA_VERSION = "chimpmaera.cks/prerequisite-receipt/v1";
export const BIND_RECEIPT_SCHEMA_VERSION = "chimpmaera.cks/prerequisite-bind-receipt/v1";
export const BIND_RECEIPT_ID = "CKS-12-PREREQUISITE-BIND-RECEIPT-V1";
export const BIND_RUN_ID = "CKS-12-PREREQUISITE-BIND-RUN-V1";

export const POSITIVE_PROOF_STATE = "PASS_SYNTHETIC_ONLY";
/** The bind receipt must record — never upgrade — this state. */
export const INTEGRATED_PROOF_STATE = "EVIDENCE_INCOMPLETE";
export const BIND_REASON_CODE = "PREREQUISITE_BIND_RECORDED";

/**
 * The exact positive obligation (boundary §4.4 / §9 stop condition 2):
 * one positive prerequisite receipt per CKS-07 … CKS-11, in this order.
 * receiptCount is the number of CKS-12 Part-II story steps owned by the
 * issue in the boundary (SS-01..11 → #287, SS-12..17 → #288, SS-18 → #289,
 * SS-19 → #290, SS-20..21 → #291).
 */
export const EXPECTED_PREREQUISITES: readonly {
  readonly issue: string;
  readonly cksId: string;
  readonly receiptCount: number;
}[] = [
  { issue: "#287", cksId: "CKS-07", receiptCount: 11 },
  { issue: "#288", cksId: "CKS-08", receiptCount: 6 },
  { issue: "#289", cksId: "CKS-09", receiptCount: 1 },
  { issue: "#290", cksId: "CKS-10", receiptCount: 1 },
  { issue: "#291", cksId: "CKS-11", receiptCount: 2 },
];

/**
 * The positive package identities are pinned, not merely self-consistent.
 * A caller cannot turn an edited v1 package into accepted evidence by
 * recalculating its receipt digest; a changed package needs a new fixture
 * version and a new independently supplied proof package.
 */
const EXPECTED_PREREQUISITE_IDENTITIES: readonly {
  readonly fixtureId: string;
  readonly fixtureVersion: string;
  readonly fixtureSha256: string;
  readonly receiptSha256: string;
}[] = [
  {
    fixtureId: "CKS-07-SYNTHETIC-FIXTURE-V1",
    fixtureVersion: "v1",
    fixtureSha256: "193a560db1a524485109f8ac32017871c51b683a9e772a46b169b811f0570cae",
    receiptSha256: "8d7848c359ff723407e26fbd694f69b4aaec8951f86576793a8f0c30501630d7",
  },
  {
    fixtureId: "CKS-08-SYNTHETIC-FIXTURE-V1",
    fixtureVersion: "v1",
    fixtureSha256: "f1b6e193acee2446793dcaa366886d37268b0771c50a76c3608c6acff506fad1",
    receiptSha256: "766e491db521b74541ef03b4b9c25b339c46b858060155cf1bbf5ff9655a46b1",
  },
  {
    fixtureId: "CKS-09-SYNTHETIC-FIXTURE-V1",
    fixtureVersion: "v1",
    fixtureSha256: "d42e20fd606585bac51a7ea8d0d5507a226e81bf7bc3ab71fc1b735e2f4d9f69",
    receiptSha256: "7d02d0ac1034a094ccfac9a639a5d1b0e338a62aa6ea4c5ea43079dcfd534486",
  },
  {
    fixtureId: "CKS-10-SYNTHETIC-FIXTURE-V1",
    fixtureVersion: "v1",
    fixtureSha256: "68065e6198e9116b5d495e6be9a62a06c974d004a40c00d9173217afe6d4bc9d",
    receiptSha256: "c582a94c69207aed47682f2633f210ee860c080e9b6afabf35de3c674a3b518b",
  },
  {
    fixtureId: "CKS-11-SYNTHETIC-FIXTURE-V1",
    fixtureVersion: "v1",
    fixtureSha256: "998c9b52277af02c869674ff96f6558def24bdb740521024d125fba16e1acc31",
    receiptSha256: "4c38a7a894aed1ba6ce87b3a6ce377617c8a879721b7ee703f920e8dbf5c647e",
  },
];

/* ------------------------------------------------------------------ */
/* Closed field sets and finite denial vocabulary.                    */
/* ------------------------------------------------------------------ */

const PREREQUISITE_RECEIPT_FIELDS: readonly string[] = [
  "schemaVersion",
  "receiptId",
  "issue",
  "cksId",
  "repository",
  "baseCommit",
  "boundaryContractVersion",
  "proofState",
  "runId",
  "fixtureId",
  "fixtureVersion",
  "fixtureSha256",
  "receiptCount",
  "lastReceiptSha256",
  "receiptChainSha256",
  "componentVersionLockSha256",
  "validationReceiptSha256",
  "promotionReceiptSha256",
  "authority",
  "capabilityDelta",
  "effect",
  "receiptSha256",
];

/**
 * Denial reason codes, all drawn from the frozen boundary's reasonCode
 * vocabulary. PREREQUISITE_BIND_RECORDED is the single schema-local
 * success code.
 */
export const DENIAL_REASON_CODES: readonly string[] = [
  "DEPENDENCY_EVIDENCE_MISSING",
  "FIXTURE_INTEGRITY_FAILED",
  "MISSING_INPUT",
  "PROOF_OBLIGATION_MISMATCH",
  "RECEIPT_INTEGRITY_FAILED",
  "STALE_KNOWLEDGE",
  "UNKNOWN_VARIANT",
  "VERSION_LOCK_MISMATCH",
];

const DIGEST_RE = /^[0-9a-f]{64}$/;

/* ------------------------------------------------------------------ */
/* Types.                                                             */
/* ------------------------------------------------------------------ */

export interface PrerequisiteReceiptV1 {
  schemaVersion: string;
  receiptId: string;
  issue: string;
  cksId: string;
  repository: string;
  baseCommit: string;
  boundaryContractVersion: string;
  proofState: string;
  runId: string;
  fixtureId: string;
  fixtureVersion: string;
  fixtureSha256: string;
  receiptCount: number;
  lastReceiptSha256: string;
  receiptChainSha256: string;
  componentVersionLockSha256: string;
  validationReceiptSha256: string;
  promotionReceiptSha256: string;
  authority: string;
  capabilityDelta: string;
  effect: string;
  receiptSha256: string;
}

export interface EmbeddedPrerequisiteReceiptV1 {
  cksId: string;
  issue: string;
  receiptId: string;
  proofState: string;
  runId: string;
  lastReceiptSha256: string;
  receiptChainSha256: string;
  receiptSha256: string;
}

export interface PrerequisiteBindReceiptV1 {
  schemaVersion: string;
  receiptId: string;
  runId: string;
  boundaryContractVersion: string;
  boundaryReceiptId: string;
  boundaryReceiptSha256: string;
  repository: string;
  baseCommit: string;
  fixtureId: string;
  fixtureVersion: string;
  fixtureSha256: string;
  orderedStoryStepIds: string[];
  storyStepVocabularySha256: string;
  prerequisiteReceipts: EmbeddedPrerequisiteReceiptV1[];
  prerequisiteReceiptsSha256: string;
  componentVersionLockSha256: string;
  previousReceiptSha256: string;
  status: "RECORDED";
  reasonCode: string;
  authority: string;
  capabilityDelta: string;
  effect: string;
  integratedProofState: string;
  successClaimed: boolean;
  nonClaims: string[];
  receiptSha256: string;
}

export interface BindDenial {
  status: "DENIED";
  reasonCodes: string[];
  details: string[];
}

export interface BindSuccess {
  status: "RECORDED";
  receipt: PrerequisiteBindReceiptV1;
  /** canonicalJson(receipt) encoded as UTF-8 bytes. */
  receiptCanonicalBytes: Uint8Array;
}

export type BindOutcome = BindDenial | BindSuccess;

/* ------------------------------------------------------------------ */
/* Internals.                                                         */
/* ------------------------------------------------------------------ */

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;

const utf8 = new TextEncoder();
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

const sha256Hex = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const digestCanonical = (value: unknown): string =>
  sha256Hex(utf8.encode(canonicalJson(value)));

/** Exact closed-field check: plain object, exact key set, no undefined. */
const closedFieldErrors = (value: unknown, fields: readonly string[]): string[] => {
  const errors: string[] = [];
  if (!isPlainObject(value)) {
    return ["value is not a plain JSON object"];
  }
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) errors.push(`missing field "${key}"`);
  }
  for (const key of actual) {
    if (!fields.includes(key)) errors.push(`unexpected field "${key}"`);
  }
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) errors.push(`field "${key}" is undefined`);
  }
  return errors;
};

/* ------------------------------------------------------------------ */
/* Binder.                                                            */
/* ------------------------------------------------------------------ */

/**
 * Binds the positive prerequisite receipts into a CKS-12 bind receipt.
 * Pure and deterministic: same fixture bytes → byte-identical output.
 * Fail-closed: any violation yields a DENIED outcome, never a receipt.
 */
export function bindPrerequisiteReceipts(fixtureBytes: Uint8Array): BindOutcome {
  const reasons = new Set<string>();
  const details: string[] = [];
  const deny = (code: string, detail: string): void => {
    if (!DENIAL_REASON_CODES.includes(code)) {
      throw new Error(`internal: unknown denial reason code ${code}`);
    }
    reasons.add(code);
    details.push(detail);
  };

  if (!(fixtureBytes instanceof Uint8Array)) {
    deny("MISSING_INPUT", "fixture bytes must be a Uint8Array");
    return { status: "DENIED", reasonCodes: [...reasons].sort(), details };
  }

  let fixture: unknown;
  try {
    fixture = JSON.parse(utf8Decoder.decode(fixtureBytes));
  } catch (err) {
    deny(
      "FIXTURE_INTEGRITY_FAILED",
      `fixture bytes are not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
    return { status: "DENIED", reasonCodes: [...reasons].sort(), details };
  }

  const topErrors = closedFieldErrors(fixture, ["schemaVersion", "fixtureId", "prerequisiteReceipts"]);
  for (const error of topErrors) {
    deny("FIXTURE_INTEGRITY_FAILED", `fixture: ${error}`);
  }
  const top = isPlainObject(fixture) ? fixture : {};
  const topSchemaVersion = top.schemaVersion;
  if (typeof topSchemaVersion !== "string") {
    deny("MISSING_INPUT", "fixture.schemaVersion must be a string");
  } else if (topSchemaVersion !== FIXTURE_SCHEMA_VERSION) {
    deny("FIXTURE_INTEGRITY_FAILED", `fixture.schemaVersion is "${topSchemaVersion}", expected "${FIXTURE_SCHEMA_VERSION}"`);
  }
  const topFixtureId = top.fixtureId;
  if (typeof topFixtureId !== "string") {
    deny("MISSING_INPUT", "fixture.fixtureId must be a string");
  } else if (topFixtureId !== FIXTURE_ID) {
    deny("FIXTURE_INTEGRITY_FAILED", `fixture.fixtureId is "${topFixtureId}", expected "${FIXTURE_ID}"`);
  }
  const rawReceipts = top.prerequisiteReceipts;
  if (!Array.isArray(rawReceipts)) {
    deny("FIXTURE_INTEGRITY_FAILED", "fixture.prerequisiteReceipts must be an array");
  }

  if (reasons.size > 0) {
    return { status: "DENIED", reasonCodes: [...reasons].sort(), details };
  }
  const receipts = rawReceipts as unknown[];

  if (receipts.length !== EXPECTED_PREREQUISITES.length) {
    deny(
      "DEPENDENCY_EVIDENCE_MISSING",
      `fixture declares ${receipts.length} prerequisite receipts, expected exactly ${EXPECTED_PREREQUISITES.length}`
    );
  }

  const lockDigests: string[] = [];

  for (let i = 0; i < receipts.length; i++) {
    const where = `prerequisiteReceipts[${i}]`;
    const raw = receipts[i];
    if (!isPlainObject(raw)) {
      deny("MISSING_INPUT", `${where} is not a plain JSON object`);
      continue;
    }
    const fieldErrors = closedFieldErrors(raw, PREREQUISITE_RECEIPT_FIELDS);
    for (const error of fieldErrors) {
      deny("FIXTURE_INTEGRITY_FAILED", `${where}: ${error}`);
    }

    const strField = (field: string): string | undefined => {
      const value = raw[field];
      if (typeof value === "string") return value;
      deny("MISSING_INPUT", `${where}.${field} must be a string, got ${typeof value}`);
      return undefined;
    };
    const digestField = (field: string): string | undefined => {
      const value = strField(field);
      if (value !== undefined && !DIGEST_RE.test(value)) {
        deny("MISSING_INPUT", `${where}.${field} must be 64 lowercase hex characters`);
        return undefined;
      }
      return value;
    };

    const schemaVersion = strField("schemaVersion");
    if (schemaVersion !== undefined && schemaVersion !== PREREQUISITE_RECEIPT_SCHEMA_VERSION) {
      deny("FIXTURE_INTEGRITY_FAILED", `${where}.schemaVersion is "${schemaVersion}", expected "${PREREQUISITE_RECEIPT_SCHEMA_VERSION}"`);
    }
    const receiptId = strField("receiptId");
    const issue = strField("issue");
    const cksId = strField("cksId");
    const repository = strField("repository");
    const baseCommit = strField("baseCommit");
    const boundaryContractVersion = strField("boundaryContractVersion");
    const proofState = strField("proofState");
    const runId = strField("runId");
    const fixtureId = strField("fixtureId");
    const fixtureVersion = strField("fixtureVersion");
    const fixtureSha256 = digestField("fixtureSha256");
    const lastReceiptSha256 = digestField("lastReceiptSha256");
    const receiptChainSha256 = digestField("receiptChainSha256");
    const componentVersionLockSha256 = digestField("componentVersionLockSha256");
    const validationReceiptSha256 = digestField("validationReceiptSha256");
    const promotionReceiptSha256 = digestField("promotionReceiptSha256");
    const authority = strField("authority");
    const capabilityDelta = strField("capabilityDelta");
    const effect = strField("effect");
    const receiptSha256 = digestField("receiptSha256");

    const receiptCount = raw.receiptCount;
    if (!Number.isInteger(receiptCount)) {
      deny("MISSING_INPUT", `${where}.receiptCount must be an integer`);
    } else if (receiptCount === 0) {
      deny("DEPENDENCY_EVIDENCE_MISSING", `${where}.receiptCount is 0`);
    }

    if (componentVersionLockSha256 !== undefined) {
      lockDigests.push(componentVersionLockSha256);
    }

    const expected = i < EXPECTED_PREREQUISITES.length ? EXPECTED_PREREQUISITES[i] : undefined;
    if (expected === undefined) {
      deny("PROOF_OBLIGATION_MISMATCH", `${where}: unexpected extra prerequisite receipt beyond the ${EXPECTED_PREREQUISITES.length}-receipt obligation`);
      continue;
    }

    const identityChecks: Array<[string | undefined, string, string]> = [
      [receiptId, `${expected.cksId}-PREREQUISITE-RECEIPT-V1`, "receiptId"],
      [issue, expected.issue, "issue"],
      [cksId, expected.cksId, "cksId"],
      [runId, `${expected.cksId}-SYNTHETIC-PROOF-RUN-V1`, "runId"],
    ];
    const expectedIdentity = EXPECTED_PREREQUISITE_IDENTITIES[i];
    if (expectedIdentity !== undefined) {
      identityChecks.push(
        [fixtureId, expectedIdentity.fixtureId, "fixtureId"],
        [fixtureVersion, expectedIdentity.fixtureVersion, "fixtureVersion"],
      );
      if (fixtureSha256 !== undefined && fixtureSha256 !== expectedIdentity.fixtureSha256) {
        deny(
          "FIXTURE_INTEGRITY_FAILED",
          `${where}.fixtureSha256 is "${fixtureSha256}", expected pinned package digest "${expectedIdentity.fixtureSha256}"`,
        );
      }
      if (receiptSha256 !== undefined && receiptSha256 !== expectedIdentity.receiptSha256) {
        deny(
          "RECEIPT_INTEGRITY_FAILED",
          `${where}.receiptSha256 is "${receiptSha256}", expected pinned package receipt "${expectedIdentity.receiptSha256}"`,
        );
      }
    }
    for (const [actual, want, field] of identityChecks) {
      if (actual !== undefined && actual !== want) {
        deny("PROOF_OBLIGATION_MISMATCH", `${where}.${field} is "${actual}", expected "${want}" for position ${i}`);
      }
    }
    if (Number.isInteger(receiptCount) && receiptCount !== 0 && receiptCount !== expected.receiptCount) {
      deny("PROOF_OBLIGATION_MISMATCH", `${where}.receiptCount is ${String(receiptCount)}, expected ${expected.receiptCount}`);
    }

    const staleChecks: Array<[string | undefined, string, string]> = [
      [repository, REPOSITORY, "repository"],
      [baseCommit, BASE_COMMIT, "baseCommit"],
      [boundaryContractVersion, BOUNDARY_CONTRACT_VERSION, "boundaryContractVersion"],
    ];
    for (const [actual, want, field] of staleChecks) {
      if (actual !== undefined && actual !== want) {
        deny("STALE_KNOWLEDGE", `${where}.${field} is stale: "${actual}" does not match frozen boundary "${want}"`);
      }
    }

    if (proofState !== undefined && proofState !== POSITIVE_PROOF_STATE) {
      deny("PROOF_OBLIGATION_MISMATCH", `${where}.proofState is "${proofState}", required positive state is "${POSITIVE_PROOF_STATE}"`);
    }

    const nonAuthorityChecks: Array<[string | undefined, string]> = [
      [authority, "authority"],
      [capabilityDelta, "capabilityDelta"],
      [effect, "effect"],
    ];
    for (const [actual, field] of nonAuthorityChecks) {
      if (actual !== undefined && actual !== "NONE") {
        deny("UNKNOWN_VARIANT", `${where}.${field} is "${actual}", fixed non-authority value is "NONE"`);
      }
    }

    if (
      lastReceiptSha256 !== undefined &&
      receiptChainSha256 !== undefined &&
      receiptChainSha256 === lastReceiptSha256
    ) {
      deny("RECEIPT_INTEGRITY_FAILED", `${where}.receiptChainSha256 equals lastReceiptSha256 (degenerate chain binding)`);
    }
    if (
      validationReceiptSha256 !== undefined &&
      promotionReceiptSha256 !== undefined &&
      validationReceiptSha256 === promotionReceiptSha256
    ) {
      deny("PROOF_OBLIGATION_MISMATCH", `${where}: validation and promotion receipts must be distinct (no self-approval)`);
    }

    try {
      const { receiptSha256: declaredSha256, ...body } = raw;
      const recomputed = digestCanonical(body);
      if (typeof declaredSha256 === "string" && declaredSha256 !== recomputed) {
        deny("RECEIPT_INTEGRITY_FAILED", `${where}.receiptSha256 is "${declaredSha256}", recomputed "${recomputed}"`);
      }
    } catch (err) {
      deny("RECEIPT_INTEGRITY_FAILED", `${where}: canonical serialization failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const distinctLocks = new Set(lockDigests).size;
  if (distinctLocks > 1) {
    deny("VERSION_LOCK_MISMATCH", `componentVersionLockSha256 differs across prerequisite receipts (${distinctLocks} distinct digests)`);
  }

  const fixtureDigest = sha256Hex(fixtureBytes);
  if (fixtureDigest !== FIXTURE_SHA256) {
    deny(
      "FIXTURE_INTEGRITY_FAILED",
      `fixture bytes have digest "${fixtureDigest}", expected pinned fixture digest "${FIXTURE_SHA256}"`,
    );
  }

  if (reasons.size > 0) {
    return { status: "DENIED", reasonCodes: [...reasons].sort(), details };
  }

  /* ---------------------------------------------------------------- */
  /* All checks passed: build the deterministic bind receipt.          */
  /* ---------------------------------------------------------------- */

  const embedded: EmbeddedPrerequisiteReceiptV1[] = (receipts as Record<string, unknown>[]).map(
    (receipt) => ({
      cksId: String(receipt.cksId),
      issue: String(receipt.issue),
      receiptId: String(receipt.receiptId),
      proofState: String(receipt.proofState),
      runId: String(receipt.runId),
      lastReceiptSha256: String(receipt.lastReceiptSha256),
      receiptChainSha256: String(receipt.receiptChainSha256),
      receiptSha256: String(receipt.receiptSha256),
    })
  );

  const receiptBody: Omit<PrerequisiteBindReceiptV1, "receiptSha256"> = {
    schemaVersion: BIND_RECEIPT_SCHEMA_VERSION,
    receiptId: BIND_RECEIPT_ID,
    runId: BIND_RUN_ID,
    boundaryContractVersion: BOUNDARY_CONTRACT_VERSION,
    boundaryReceiptId: BOUNDARY_RECEIPT_ID,
    boundaryReceiptSha256: BOUNDARY_RECEIPT_SHA256,
    repository: REPOSITORY,
    baseCommit: BASE_COMMIT,
    fixtureId: FIXTURE_ID,
    fixtureVersion: "v1",
    fixtureSha256: sha256Hex(fixtureBytes),
    orderedStoryStepIds: [...ORDERED_STORY_STEP_IDS],
    storyStepVocabularySha256: STORY_STEP_VOCABULARY_SHA256,
    prerequisiteReceipts: embedded,
    prerequisiteReceiptsSha256: digestCanonical(embedded),
    componentVersionLockSha256: lockDigests[0] as string,
    previousReceiptSha256: GENESIS_PREVIOUS_RECEIPT_SHA256,
    status: "RECORDED",
    reasonCode: BIND_REASON_CODE,
    authority: "NONE",
    capabilityDelta: "NONE",
    effect: "NONE",
    integratedProofState: INTEGRATED_PROOF_STATE,
    successClaimed: false,
    nonClaims: [...NON_CLAIMS],
  };

  const receipt: PrerequisiteBindReceiptV1 = {
    ...receiptBody,
    receiptSha256: digestCanonical(receiptBody),
  };

  return {
    status: "RECORDED",
    receipt,
    receiptCanonicalBytes: utf8.encode(canonicalJson(receipt)),
  };
}