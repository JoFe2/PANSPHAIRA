import { Buffer } from "node:buffer";
import {
  AP04_ERV_CASE_PACK_SHA256_V1,
  compileErvCapabilityCoreV1,
  type ErvCasePackV1,
} from "./incoming-invoice-erv.js";
import {
  deriveIncomingInvoiceUiManifestV1,
  runIncomingInvoiceSetupAgentV1,
  type IncomingInvoiceErvRequirementV1,
  type IncomingInvoiceSetupAgentResultV1,
  type IncomingInvoiceSetupAnswerV1,
  type IncomingInvoiceSetupInputV1,
  type IncomingInvoiceSetupTranscriptV1,
  type IncomingInvoiceConfigurationDeltaV1,
} from "./incoming-invoice-adaptive-ui.js";
import { canonicalJson } from "./canonical-json.js";
import { sha256HexV1 } from "./incoming-invoice-intake.js";

export const AP05_EXACT_HEAD_V1 = "ef10d39fa7843e7c45e6e46cbc73647ad4a3ea2c" as const;
export const AP05_RECEIPT_MANIFEST_SCHEMA_V1 = "chimpmaera.incoming-invoice/ap05-receipt-manifest/v1" as const;

const AP04_MERGE_SHA_V1 = "90512ba63587d10b4a833a7f31e1f91595531467";
const AP04_RELEASE_TAG_V1 = "2026_09_05_v5";
const AP04_CORE_SOURCE_SHA256_V1 = "6ba5250783df35f60602a11437c843272ab014bf24e69135cfbf52dfb41750cf";
const AP04_CORE_SOURCE_BYTES_V1 = 21114;
const AP04_CASE_PACK_BYTES_V1 = 19841;
const AP05_ADAPTIVE_MERGE_SHA_V1 = "988395110a9189d1b8cd4ee98184ed5c1d77a15d";
const AP05_FROZEN_TOLERANCE_MERGE_SHA_V1 = "605eff8118be0e60c3e1ed92ca91ff9a9ab610bd";
const ADAPTIVE_UI_SOURCE_SHA256_V1 = "e60fb079364bc48d12629825531299bc7abd9986c5299067e450e7577ef75b1f";
const ADAPTIVE_UI_SOURCE_BYTES_V1 = 33045;
const APPLICATION_GUIDE_SOURCE_SHA256_V1 = "8ee060c3f158810c93e097e83ab55297c0d976b92c0392fdd290d6d33a88b7bd";
const APPLICATION_GUIDE_SOURCE_BYTES_V1 = 2504;
const CASE_PACK_PATH_V1 = "tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json";
const ERV_SOURCE_PATH_V1 = "packages/contracts/src/incoming-invoice-erv.ts";
const ADAPTIVE_UI_SOURCE_PATH_V1 = "packages/contracts/src/incoming-invoice-adaptive-ui.ts";
const APPLICATION_GUIDE_PATH_V1 = "docs/INCOMING-INVOICE-APPLICATION-GUIDE.md";
const AP04_CLAIMED_PACK_SHA256_V1 = AP04_ERV_CASE_PACK_SHA256_V1;
const UNKNOWN_ADAPTED_REASON_V1 = "NO_RELEASED_AP04_CORE_VARIANT_FOR_200_BPS" as const;
const UNKNOWN_OUTCOME_REASON_V1 = "ADAPTED_ERV_NOT_EXECUTED" as const;
const CRITERIA_V1 = ["AP-05-AC01", "AP-05-AC02", "AP-05-AC03", "AP-05-AC04", "AP-05-AC05", "AP-05-AC06", "AP-05-AC07", "AP-05-AC08"] as const;
const OUTCOMES_V1 = ["MATCHED", "CONFLICT", "EXCEPTION", "DENIED"] as const;
const REFERENCE_KINDS_V1 = ["SUPPLIER", "PURCHASE_ORDER", "RECEIPT", "INVOICE"] as const;

type IdentityV1 = Readonly<{ byteLength: number; sha256: string }>;
type SourceInputV1 = Readonly<{ path: string; bytes: Uint8Array }>;
type PublicOutcomeV1 = typeof OUTCOMES_V1[number];
type UnknownOutcomeCountV1 = Readonly<{ state: "UNKNOWN"; reasonCode: typeof UNKNOWN_OUTCOME_REASON_V1 }>;
type DenominatorV1 = Readonly<{ caseCount: number; decisionCount: number; referenceCount: number; referenceCountByKind: Readonly<Record<typeof REFERENCE_KINDS_V1[number], number>> }>;

export interface IncomingInvoiceAp05ReceiptManifestInputV1 {
  readonly setup: IncomingInvoiceSetupInputV1;
  readonly predecessorSources: readonly SourceInputV1[];
}

export interface IncomingInvoiceAp05ReceiptManifestV1 {
  readonly schemaVersion: typeof AP05_RECEIPT_MANIFEST_SCHEMA_V1;
  readonly manifestVersion: "1.0.0";
  readonly taskId: "PS365-AP05-RECEIPT-MANIFEST-01";
  readonly predecessorLineage: Readonly<{
    readonly exactHead: typeof AP05_EXACT_HEAD_V1;
    readonly releases: readonly Readonly<{ releaseId: string; releaseTag: string; mergeSha: string; sourceCommit: string; sourcePaths: readonly string[] }>[];
    readonly sources: readonly Readonly<{ path: string; identity: IdentityV1; releaseIds: readonly string[] }>[];
  }>;
  readonly sourceEvidenceRelease: Readonly<{ releaseId: "pan365-ap05-receipt-manifest-source-v1"; releaseTag: "pan365-ap05-receipt-manifest-source-v1"; sourceCommit: typeof AP05_EXACT_HEAD_V1; sourcePaths: readonly string[] }>;
  readonly ap04: Readonly<{
    readonly casePack: Readonly<{ path: typeof CASE_PACK_PATH_V1; identity: IdentityV1; canonicalSha256: string }>;
    readonly coreOutput: Readonly<{ schemaVersion: string; caseCount: number; decisionDigest: string; identity: IdentityV1; deterministicReplay: true }>;
  }>;
  readonly ap05Setup: Readonly<{
    readonly input: IncomingInvoiceSetupInputV1;
    readonly answers: readonly IncomingInvoiceSetupAnswerV1[];
    readonly transcript: IncomingInvoiceSetupTranscriptV1;
    readonly transcriptIdentity: IdentityV1;
    readonly configurationDelta: IncomingInvoiceConfigurationDeltaV1;
    readonly configurationIdentity: IdentityV1;
    readonly deltaIdentity: IdentityV1;
    readonly inputIdentity: IdentityV1;
  }>;
  readonly uiProducerOutputs: readonly Readonly<{ projection: "BASELINE_SOURCE_EVIDENCE" | "CHANGED_CONFIGURATION_SOURCE_EVIDENCE"; evidenceState: PublicOutcomeV1; manifestDigest: string; identity: IdentityV1; fieldIds: readonly string[]; actionIds: readonly string[] }>[];
  readonly sourceToReceiptProjectionRules: readonly string[];
  readonly publicReceipt: Readonly<{
    readonly schemaVersion: "chimpmaera.incoming-invoice/public-receipt/v1";
    readonly authority: Readonly<{ mode: "NONE"; evidenceClass: "PUBLIC_SYNTHETIC_NON_CUSTOMER"; customerData: false; externalProvider: false; productiveEffect: false }>;
    readonly baseline: Readonly<{ denominator: DenominatorV1; rows: readonly Readonly<{ ordinal: number; outcome: PublicOutcomeV1; verifiedReferenceCount: number; referenceCount: number }>[]; outcomeCounts: Readonly<Record<PublicOutcomeV1, number>>; receiptIdentity: IdentityV1 }>;
    readonly adapted: Readonly<{ denominator: DenominatorV1; rows: readonly Readonly<{ ordinal: number; outcome: UnknownOutcomeCountV1 }>[]; outcome: UnknownOutcomeCountV1; receiptIdentity: IdentityV1 }>;
  }>;
  readonly acceptanceCriteria: readonly string[];
  readonly manifestIdentity: IdentityV1;
  readonly manifestDigest: string;
}

export interface IncomingInvoiceAp05ReceiptManifestVerificationV1 {
  readonly valid: boolean;
  readonly reasonCodes: readonly string[];
}

class ManifestError extends Error {
  constructor(readonly code: string) { super(code); }
}

function identity(value: Uint8Array | string): IdentityV1 {
  const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return { byteLength: bytes.byteLength, sha256: sha256HexV1(bytes) };
}
function canonicalIdentity(value: unknown): IdentityV1 { return identity(canonicalJson(value)); }
function sourceByPath(sources: readonly SourceInputV1[], path: string): SourceInputV1 {
  const source = sources.find((candidate) => candidate.path === path);
  if (source === undefined) throw new ManifestError("SOURCE_MISSING");
  return source;
}
function exactSource(source: SourceInputV1, expectedSha256: string, expectedByteLength: number): IdentityV1 {
  const actual = identity(source.bytes);
  if (actual.sha256 !== expectedSha256 || actual.byteLength !== expectedByteLength) throw new ManifestError("SOURCE_IDENTITY_MISMATCH");
  return actual;
}
function sourceRecord(source: SourceInputV1, expectedSha256: string, expectedByteLength: number, releaseIds: readonly string[]): Readonly<{ path: string; identity: IdentityV1; releaseIds: readonly string[] }> {
  return { path: source.path, identity: exactSource(source, expectedSha256, expectedByteLength), releaseIds };
}
function requirementMatches(value: IncomingInvoiceErvRequirementV1, expected: Readonly<Partial<IncomingInvoiceErvRequirementV1>>): boolean {
  return Object.entries(expected).every(([key, expectedValue]) => canonicalJson(value[key as keyof IncomingInvoiceErvRequirementV1]) === canonicalJson(expectedValue));
}
function verifySetupShape(setup: IncomingInvoiceSetupInputV1): void {
  const common = { requestedEffects: ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF"] as const, synthetic: true as const, customerData: false as const };
  if (setup.baseline.requestedEffects.some((effect) => !common.requestedEffects.includes(effect as typeof common.requestedEffects[number])) || setup.changed.requestedEffects.some((effect) => !common.requestedEffects.includes(effect as typeof common.requestedEffects[number]))) throw new ManifestError("SETUP_DENIED");
  if (!requirementMatches(setup.baseline, { ...common, requirementId: "requirement:baseline", scenario: "LEAN", matchingMode: { variantId: "TWO_WAY_INVOICE_PO_V1", version: "1.0.0" }, tolerancePolicy: { variantId: "STRICT_ZERO_V1", version: "1.0.0" }, separateApprovalThresholdEur: null, evidenceRefs: ["evidence:ap04-synthetic-001"] })) throw new ManifestError("SETUP_INPUT_MISMATCH");
  if (!requirementMatches(setup.changed, { ...common, requirementId: "requirement:changed-rate", scenario: "SEGREGATED_ENTERPRISE", matchingMode: { variantId: "THREE_WAY_INVOICE_PO_RECEIPT_V1", version: "1.0.0" }, tolerancePolicy: { variantId: "RATE_BPS_V1", version: "1.0.0", rateBasisPoints: 200 }, separateApprovalThresholdEur: 10000, evidenceRefs: ["evidence:ap04-synthetic-rate-002"] })) throw new ManifestError("SETUP_INPUT_MISMATCH");
  const answerIds = setup.answers.map(({ questionId, answer }) => `${questionId}:${answer}`).sort();
  if (canonicalJson(answerIds) !== canonicalJson([
    "confirm:matching-mode:CONFIRM",
    "confirm:scenario:CONFIRM",
    "confirm:separate-approval-threshold:CONFIRM",
    "confirm:tolerance-policy:CONFIRM",
  ])) throw new ManifestError("SETUP_ANSWERS_MISMATCH");
}
function publicDenominator(pack: ErvCasePackV1): DenominatorV1 {
  const byKind = { SUPPLIER: 0, PURCHASE_ORDER: 0, RECEIPT: 0, INVOICE: 0 };
  for (const entry of pack.cases) for (const reference of entry.references) byKind[reference.body.referenceKind] += 1;
  return { caseCount: pack.cases.length, decisionCount: pack.cases.length, referenceCount: Object.values(byKind).reduce((sum, count) => sum + count, 0), referenceCountByKind: byKind };
}
function uiProjection(pack: ErvCasePackV1, caseId: string, outcome: PublicOutcomeV1, scenario: "CONTROLLED" | "SEGREGATED_ENTERPRISE", projection: "BASELINE_SOURCE_EVIDENCE" | "CHANGED_CONFIGURATION_SOURCE_EVIDENCE"): IncomingInvoiceAp05ReceiptManifestV1["uiProducerOutputs"][number] {
  const entry = pack.cases.find((candidate) => candidate.caseId === caseId);
  if (entry === undefined) throw new ManifestError("UI_SOURCE_CASE_MISSING");
  const result = deriveIncomingInvoiceUiManifestV1({
    schemaVersion: "chimpmaera.incoming-invoice/adaptive-ui/v1",
    scenario,
    evidence: {
      outcome,
      matchingMode: entry.matchingMode,
      tolerancePolicy: entry.tolerancePolicy,
      references: entry.references.map((reference) => ({ kind: reference.body.referenceKind, referenceId: reference.body.referenceId, verified: true, evidenceRef: reference.evidence.locator })),
    },
    authority: { mode: "LOCAL_SYNTHETIC_PROOF", customerDataAuthorized: false, productiveBookingAuthorized: false, externalCallsAuthorized: false },
  });
  if (result.outcome !== "DERIVED") throw new ManifestError("UI_PRODUCER_DENIED");
  return {
    projection,
    evidenceState: outcome,
    manifestDigest: result.manifest.manifestDigest,
    identity: canonicalIdentity(result.manifest),
    fieldIds: result.manifest.fields.map(({ fieldId }) => fieldId),
    actionIds: result.manifest.actions.map(({ actionId }) => actionId),
  };
}
function outcomeCounts(decisions: readonly { outcome: PublicOutcomeV1 }[]): Record<PublicOutcomeV1, number> {
  const counts = { MATCHED: 0, CONFLICT: 0, EXCEPTION: 0, DENIED: 0 };
  for (const decision of decisions) counts[decision.outcome] += 1;
  return counts;
}
function buildReceipt(pack: ErvCasePackV1, decisions: readonly { outcome: PublicOutcomeV1; evidenceCitations: readonly { verified: boolean }[] }[]): IncomingInvoiceAp05ReceiptManifestV1["publicReceipt"] {
  const denominator = publicDenominator(pack);
  const baselineUnsigned = {
    schemaVersion: "chimpmaera.incoming-invoice/public-receipt/v1" as const,
    authority: { mode: "NONE" as const, evidenceClass: "PUBLIC_SYNTHETIC_NON_CUSTOMER" as const, customerData: false as const, externalProvider: false as const, productiveEffect: false as const },
    denominator,
    rows: decisions.map((decision, index) => ({ ordinal: index + 1, outcome: decision.outcome, verifiedReferenceCount: decision.evidenceCitations.filter(({ verified }) => verified).length, referenceCount: decision.evidenceCitations.length })),
    outcomeCounts: outcomeCounts(decisions),
  };
  const adaptedOutcome = { state: "UNKNOWN" as const, reasonCode: UNKNOWN_OUTCOME_REASON_V1 };
  const adaptedUnsigned = { denominator: { ...denominator, decisionCount: 0 }, rows: pack.cases.map((_, index) => ({ ordinal: index + 1, outcome: adaptedOutcome })), outcome: adaptedOutcome };
  return {
    schemaVersion: baselineUnsigned.schemaVersion,
    authority: baselineUnsigned.authority,
    baseline: { denominator, rows: baselineUnsigned.rows, outcomeCounts: baselineUnsigned.outcomeCounts, receiptIdentity: canonicalIdentity(baselineUnsigned) },
    adapted: { ...adaptedUnsigned, receiptIdentity: canonicalIdentity(adaptedUnsigned) },
  };
}

export function generateIncomingInvoiceAp05ReceiptManifestV1(input: IncomingInvoiceAp05ReceiptManifestInputV1): Readonly<{ manifest: IncomingInvoiceAp05ReceiptManifestV1; serialized: string }> {
  verifySetupShape(input.setup);
  const adaptiveUi = sourceByPath(input.predecessorSources, ADAPTIVE_UI_SOURCE_PATH_V1);
  const guide = sourceByPath(input.predecessorSources, APPLICATION_GUIDE_PATH_V1);
  const erv = sourceByPath(input.predecessorSources, ERV_SOURCE_PATH_V1);
  const casePackSource = sourceByPath(input.predecessorSources, CASE_PACK_PATH_V1);
  const sources = [
    sourceRecord(adaptiveUi, ADAPTIVE_UI_SOURCE_SHA256_V1, ADAPTIVE_UI_SOURCE_BYTES_V1, ["pan365-adaptive-ui-source-v1", "pan365-frozen-tolerance-source-v1"]),
    sourceRecord(guide, APPLICATION_GUIDE_SOURCE_SHA256_V1, APPLICATION_GUIDE_SOURCE_BYTES_V1, ["pan365-adaptive-ui-source-v1", "pan365-frozen-tolerance-source-v1"]),
    sourceRecord(erv, AP04_CORE_SOURCE_SHA256_V1, AP04_CORE_SOURCE_BYTES_V1, ["2026_09_05_v5"]),
    sourceRecord(casePackSource, AP04_ERV_CASE_PACK_SHA256_V1, AP04_CASE_PACK_BYTES_V1, ["2026_09_05_v5"]),
  ];
  const pack = JSON.parse(Buffer.from(casePackSource.bytes).toString("utf8")) as ErvCasePackV1;
  const coreResult = compileErvCapabilityCoreV1(pack, AP04_CLAIMED_PACK_SHA256_V1);
  if (coreResult.outcome !== "DECIDED") throw new ManifestError("AP04_CORE_DENIED");
  const setupResult: IncomingInvoiceSetupAgentResultV1 = runIncomingInvoiceSetupAgentV1(input.setup);
  if (setupResult.outcome !== "RESOLVED") throw new ManifestError("SETUP_DENIED");
  const setupInputIdentity = canonicalIdentity(input.setup);
  const transcriptIdentity = canonicalIdentity(setupResult.transcript);
  const configurationIdentity = canonicalIdentity(setupResult.configurationDelta.configuration);
  const deltaIdentity = canonicalIdentity(setupResult.configurationDelta);
  const decisions = coreResult.package.decisions;
  const sourceCase = pack.cases.find((candidate) => candidate.matchingMode.variantId === "THREE_WAY_INVOICE_PO_RECEIPT_V1" && candidate.caseId === "three-way-matched-rate-tolerance");
  if (sourceCase === undefined) throw new ManifestError("UI_SOURCE_CASE_MISSING");
  const sourceDecision = decisions.find((candidate) => candidate.caseId === sourceCase.caseId);
  if (sourceDecision === undefined) throw new ManifestError("UI_SOURCE_DECISION_MISSING");
  const publicReceipt = buildReceipt(pack, decisions);
  const unsigned: Omit<IncomingInvoiceAp05ReceiptManifestV1, "manifestIdentity" | "manifestDigest"> = {
    schemaVersion: AP05_RECEIPT_MANIFEST_SCHEMA_V1,
    manifestVersion: "1.0.0",
    taskId: "PS365-AP05-RECEIPT-MANIFEST-01",
    predecessorLineage: {
      exactHead: AP05_EXACT_HEAD_V1,
      releases: [
        { releaseId: "pan365-adaptive-ui-source-v1", releaseTag: "pan365-adaptive-ui-source-v1", mergeSha: AP05_ADAPTIVE_MERGE_SHA_V1, sourceCommit: AP05_EXACT_HEAD_V1, sourcePaths: [ADAPTIVE_UI_SOURCE_PATH_V1, APPLICATION_GUIDE_PATH_V1] },
        { releaseId: "pan365-frozen-tolerance-source-v1", releaseTag: "pan365-frozen-tolerance-source-v1", mergeSha: AP05_FROZEN_TOLERANCE_MERGE_SHA_V1, sourceCommit: AP05_EXACT_HEAD_V1, sourcePaths: [ADAPTIVE_UI_SOURCE_PATH_V1, APPLICATION_GUIDE_PATH_V1] },
        { releaseId: "ap04-erv-source-v1", releaseTag: AP04_RELEASE_TAG_V1, mergeSha: AP04_MERGE_SHA_V1, sourceCommit: AP04_MERGE_SHA_V1, sourcePaths: [ERV_SOURCE_PATH_V1, CASE_PACK_PATH_V1] },
      ],
      sources,
    },
    sourceEvidenceRelease: {
      releaseId: "pan365-ap05-receipt-manifest-source-v1",
      releaseTag: "pan365-ap05-receipt-manifest-source-v1",
      sourceCommit: AP05_EXACT_HEAD_V1,
      sourcePaths: [
        "packages/contracts/src/incoming-invoice-ap05-receipt-manifest.ts",
        "scripts/generate-incoming-invoice-ap05-receipt-manifest.mjs",
        "tests/fixtures/incoming-invoice/ap-05-frozen-setup-v1.json",
        "tests/incoming-invoice-ap05-receipt-manifest.test.ts",
        "verification/incoming-invoice-ap05-receipt-manifest-v1.json",
      ],
    },
    ap04: {
      casePack: { path: CASE_PACK_PATH_V1, identity: identity(casePackSource.bytes), canonicalSha256: coreResult.package.readback.packSha256 },
      coreOutput: { schemaVersion: coreResult.package.schemaVersion, caseCount: coreResult.package.caseCount, decisionDigest: coreResult.package.readback.decisionDigest, identity: canonicalIdentity(coreResult.package), deterministicReplay: true },
    },
    ap05Setup: {
      input: input.setup,
      answers: input.setup.answers,
      transcript: setupResult.transcript,
      transcriptIdentity,
      configurationDelta: setupResult.configurationDelta,
      configurationIdentity,
      deltaIdentity,
      inputIdentity: setupInputIdentity,
    },
    uiProducerOutputs: [
      uiProjection(pack, sourceCase.caseId, sourceDecision.outcome, "CONTROLLED", "BASELINE_SOURCE_EVIDENCE"),
      uiProjection(pack, sourceCase.caseId, sourceDecision.outcome, "SEGREGATED_ENTERPRISE", "CHANGED_CONFIGURATION_SOURCE_EVIDENCE"),
    ],
    sourceToReceiptProjectionRules: [
      "Project AP04 core decisions to ordinal, outcome, reference denominator and verification counts only.",
      "Omit source identifiers, amounts, advisor text, exception detail and all identity-bearing reference fields.",
      "Retain AP05 setup and configuration identities without treating configuration as an ERV execution result.",
      "Encode the adapted 200-bps ERV receipt as typed UNKNOWN because the released AP04 core has no such variant.",
    ],
    publicReceipt,
    acceptanceCriteria: [...CRITERIA_V1],
  };
  const manifestIdentity = canonicalIdentity(unsigned);
  const manifest = { ...unsigned, manifestIdentity, manifestDigest: manifestIdentity.sha256 } as IncomingInvoiceAp05ReceiptManifestV1;
  return { manifest, serialized: `${canonicalJson(manifest)}\n` };
}

function hasPublicProjectionLeak(value: unknown): boolean {
  const serialized = canonicalJson(value);
  return ["supplierId", "invoiceId", "referenceId", "customerId", "questionText", "credential", "password", "SYN-SUP", "INV-2026", "PO-2026", "RCV-2026"].some((token) => serialized.includes(token));
}
function errorCode(error: unknown): string { return error instanceof ManifestError ? error.code : "MANIFEST_INPUT_DENIED"; }

export function verifyIncomingInvoiceAp05ReceiptManifestV1(candidate: unknown, input: IncomingInvoiceAp05ReceiptManifestInputV1): IncomingInvoiceAp05ReceiptManifestVerificationV1 {
  if (candidate === null || typeof candidate !== "object") return { valid: false, reasonCodes: ["MANIFEST_SHAPE_DENIED"] };
  const record = candidate as Record<string, unknown>;
  if (isRecord(record.publicReceipt) && hasPublicProjectionLeak(record.publicReceipt)) return { valid: false, reasonCodes: ["PUBLIC_PROJECTION_LEAK"] };
  try {
    const expected = generateIncomingInvoiceAp05ReceiptManifestV1(input).manifest;
    if (canonicalJson(candidate) !== canonicalJson(expected)) return { valid: false, reasonCodes: ["MANIFEST_IDENTITY_MISMATCH"] };
    return { valid: true, reasonCodes: [] };
  } catch (error) {
    return { valid: false, reasonCodes: [errorCode(error)] };
  }
}
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
