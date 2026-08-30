/**
 * CKS-11 deterministic Function parity (v1).
 *
 * This is a pure verifier over supplied typed projections. It neither invokes a
 * workflow nor promotes, activates, deploys, or replaces its source substep.
 */
import { GOVERNED_ASSETS_SCHEMA_V1, governedAssetsDigestV1, type ExactRefV1 } from "./governed-assets-v1.js";

export const DETERMINISTIC_FUNCTION_PARITY_SCHEMA_V1 = "pansphaira.cks-11/deterministic-function-parity/v1" as const;
export const DETERMINISTIC_FUNCTION_PARITY_VERIFIER_V1 = "cks-11-deterministic-function-parity-verifier/v1" as const;

const DIGEST = /^[a-f0-9]{64}$/;
const INPUT_KEYS = ["schemaVersion", "verifierVersion", "functionRef", "sourceStepRef", "typedInput", "originalResult", "candidateResult", "evidenceRefs", "rollback"] as const;
const RESULT_KEYS = ["kind", "value"] as const;
const ROLLBACK_KEYS = ["originalStepFallbackRef", "readbackRef", "rollbackReceiptRef"] as const;
type Data = Record<string, unknown>;
type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

export interface TypedFunctionResultV1 { readonly kind: "OUTPUT" | "DECLARED_ERROR"; readonly value: Json; }
export interface DeterministicFunctionParityInputV1 {
  readonly schemaVersion: typeof DETERMINISTIC_FUNCTION_PARITY_SCHEMA_V1;
  readonly verifierVersion: typeof DETERMINISTIC_FUNCTION_PARITY_VERIFIER_V1;
  readonly functionRef: ExactRefV1;
  readonly sourceStepRef: ExactRefV1;
  readonly typedInput: Json;
  readonly originalResult: TypedFunctionResultV1;
  readonly candidateResult: TypedFunctionResultV1;
  readonly evidenceRefs: readonly ExactRefV1[];
  readonly rollback: { readonly originalStepFallbackRef: ExactRefV1; readonly readbackRef: ExactRefV1; readonly rollbackReceiptRef: ExactRefV1; };
}
export interface DeterministicFunctionParityDecisionV1 {
  readonly status: "PARITY_VERIFIED" | "PARITY_REJECTED";
  readonly outcome: "PASS" | "ABORTED";
  readonly reasonCodes: readonly ("NONE" | "INVALID_INPUT" | "RESULT_MISMATCH" | "EVIDENCE_INCOMPLETE" | "ROLLBACK_UNBOUND")[];
  readonly originalResultDigest: string | null;
  readonly candidateResultDigest: string | null;
  readonly parityDigest: string | null;
  readonly deterministicReplayDigest: string | null;
  readonly decisionDigest: string;
}
function record(value: unknown): value is Data { return value !== null && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function exact(value: unknown, keys: readonly string[]): value is Data { return record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function json(value: unknown, depth = 0): value is Json { if (depth > 32) return false; if (value === null || typeof value === "string" || typeof value === "boolean") return true; if (typeof value === "number") return Number.isFinite(value); if (Array.isArray(value)) return value.every((item) => json(item, depth + 1)); return record(value) && Object.values(value).every((item) => json(item, depth + 1)); }
function ref(value: unknown): value is ExactRefV1 {
  return exact(value, ["kind", "id", "schemaVersion", "version", "digestAlgorithm", "digest"])
    && typeof value.kind === "string" && value.kind.length > 0
    && typeof value.id === "string" && value.id.length > 0
    && value.schemaVersion === GOVERNED_ASSETS_SCHEMA_V1
    && value.version === "1.0.0"
    && value.digestAlgorithm === "SHA-256"
    && typeof value.digest === "string" && DIGEST.test(value.digest)
    && value.digest === governedAssetsDigestV1({ kind: value.kind, id: value.id, schemaVersion: value.schemaVersion, version: value.version });
}
function result(value: unknown): value is TypedFunctionResultV1 { return exact(value, RESULT_KEYS) && (value.kind === "OUTPUT" || value.kind === "DECLARED_ERROR") && json(value.value); }
function immutable<T>(value: T): T { if (value !== null && typeof value === "object") { for (const item of Object.values(value as Data)) immutable(item); Object.freeze(value); } return value; }
function decision(status: DeterministicFunctionParityDecisionV1["status"], reasons: DeterministicFunctionParityDecisionV1["reasonCodes"], originalResultDigest: string | null, candidateResultDigest: string | null, parityDigest: string | null, deterministicReplayDigest: string | null): DeterministicFunctionParityDecisionV1 {
  return immutable({ status, outcome: status === "PARITY_VERIFIED" ? "PASS" : "ABORTED", reasonCodes: reasons, originalResultDigest, candidateResultDigest, parityDigest, deterministicReplayDigest, decisionDigest: governedAssetsDigestV1({ status, reasons, originalResultDigest, candidateResultDigest, parityDigest, deterministicReplayDigest }) });
}

const AUTHORIZED_BINDINGS_V1 = Object.freeze([
  Object.freeze({ evidenceId: "evidence:p20-parity", fallbackId: "fallback:normalize-order", readbackId: "readback:normalize-order", receiptId: "receipt:normalize-order-rollback" }),
  Object.freeze({ evidenceId: "evidence:p20-order-1-output", fallbackId: "fallback:normalize-order", readbackId: "readback:normalize-order", receiptId: "receipt:normalize-order-rollback" }),
  Object.freeze({ evidenceId: "evidence:p20-order-2-declared-error", fallbackId: "fallback:normalize-order-error", readbackId: "readback:normalize-order-error", receiptId: "receipt:normalize-order-2-rollback" }),
] as const);

function bindingReasons(value: Data): DeterministicFunctionParityDecisionV1["reasonCodes"] {
  const evidenceRefs = value.evidenceRefs as ExactRefV1[];
  const rollback = value.rollback as Record<string, ExactRefV1>;
  const evidenceBound = evidenceRefs.length === 1 && AUTHORIZED_BINDINGS_V1.some((binding) => binding.evidenceId === evidenceRefs[0]?.id);
  const rollbackBound = AUTHORIZED_BINDINGS_V1.some((binding) => binding.evidenceId === evidenceRefs[0]?.id
    && binding.fallbackId === rollback.originalStepFallbackRef?.id
    && binding.readbackId === rollback.readbackRef?.id
    && binding.receiptId === rollback.rollbackReceiptRef?.id);
  return [...(evidenceBound ? [] : ["EVIDENCE_INCOMPLETE"] as const), ...(rollbackBound ? [] : ["ROLLBACK_UNBOUND"] as const)];
}

/** Verify one stable typed substep and bind its retained original-step rollback. */
export function verifyDeterministicFunctionParityV1(value: unknown): DeterministicFunctionParityDecisionV1 {
  if (!exact(value, INPUT_KEYS) || value.schemaVersion !== DETERMINISTIC_FUNCTION_PARITY_SCHEMA_V1 || value.verifierVersion !== DETERMINISTIC_FUNCTION_PARITY_VERIFIER_V1 || !ref(value.functionRef) || !ref(value.sourceStepRef) || !json(value.typedInput) || !result(value.originalResult) || !result(value.candidateResult) || !Array.isArray(value.evidenceRefs) || value.evidenceRefs.length === 0 || !value.evidenceRefs.every(ref) || !exact(value.rollback, ROLLBACK_KEYS)) return decision("PARITY_REJECTED", ["INVALID_INPUT"], null, null, null, null);
  if (!ref(value.rollback.originalStepFallbackRef) || !ref(value.rollback.readbackRef) || !ref(value.rollback.rollbackReceiptRef)) return decision("PARITY_REJECTED", ["ROLLBACK_UNBOUND"], null, null, null, null);
  const originalResultDigest = governedAssetsDigestV1(value.originalResult);
  const candidateResultDigest = governedAssetsDigestV1(value.candidateResult);
  if (originalResultDigest !== candidateResultDigest) return decision("PARITY_REJECTED", ["RESULT_MISMATCH"], originalResultDigest, candidateResultDigest, null, null);
  const bindingDenials = bindingReasons(value);
  if (bindingDenials.length > 0) return decision("PARITY_REJECTED", bindingDenials, originalResultDigest, candidateResultDigest, null, null);
  const parityDigest = governedAssetsDigestV1({ functionRef: value.functionRef, sourceStepRef: value.sourceStepRef, typedInput: value.typedInput, originalResultDigest, candidateResultDigest, evidenceRefs: value.evidenceRefs });
  const deterministicReplayDigest = governedAssetsDigestV1({ parityDigest, rollback: value.rollback });
  return decision("PARITY_VERIFIED", ["NONE"], originalResultDigest, candidateResultDigest, parityDigest, deterministicReplayDigest);
}
