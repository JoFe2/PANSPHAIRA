import { createHash } from "node:crypto";

export const COMPONENT_VERSIONS = Object.freeze({
  workflowContract: "v1", functionContract: "v1", costModel: "cks-12-cost-model@v2", proofVerifier: "cks-12-proof-verifier@v1",
});
export const DENIAL_CODES = Object.freeze(["MISSING_INPUT", "VERSION_LOCK_MISMATCH", "DETERMINISM_MISMATCH", "PROOF_OBLIGATION_MISMATCH", "COST_NON_REDUCTION", "AUTHORITY_DENIED"] as const);
type DenialCode = typeof DENIAL_CODES[number];
type RecordValue = Record<string, unknown>;
export type Denied = { status: "DENIED"; reasonCodes: readonly DenialCode[]; details: readonly string[] };
export type CostParity = {
  status: "FUNCTION_COST_PARITY_RECORDED";
  replayCount: number;
  outputSha256: string;
  proofDigest: string;
  workflowCost: { reasoningTokens: number; retrievalCalls: number; verifierChecks: number };
  functionCost: { reasoningTokens: number; retrievalCalls: number; verifierChecks: number };
  authority: "NONE"; capabilityDelta: "NONE"; effect: "NONE"; executionClaimed: false; productionClaimed: false;
};

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new TypeError("non-finite number"); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("plain JSON required");
  const object = value as RecordValue;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}
export const digest = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
const record = (value: unknown): value is RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const cost = (value: unknown): value is RecordValue => record(value) && ["reasoningTokens", "retrievalCalls", "verifierChecks"].every((key) => Number.isInteger(value[key]) && (value[key] as number) >= 0);
const deny = (reasonCodes: DenialCode[], details: string[]): Denied => ({ status: "DENIED", reasonCodes: [...new Set(reasonCodes)].sort(), details });

/** Measures a closed shadow Function against the same bound Workflow input. */
export function measureDeterministicFunctionCostParity(input: unknown): CostParity | Denied {
  if (!record(input)) return deny(["MISSING_INPUT"], ["parity input must be a plain JSON object"]);
  const reasons: DenialCode[] = []; const details: string[] = [];
  const add = (code: DenialCode, detail: string) => { reasons.push(code); details.push(detail); };
  if (!record(input.componentVersions) || canonicalJson(input.componentVersions) !== canonicalJson(COMPONENT_VERSIONS)) add("VERSION_LOCK_MISMATCH", "component versions must exactly match the frozen lock");
  if (input.authorityRequested === true || input.effectRequested === true) add("AUTHORITY_DENIED", "shadow parity cannot request authority or effects");
  const workflow = input.workflow;
  if (!record(workflow) || typeof workflow.output !== "string" || !/^[0-9a-f]{64}$/.test(String(workflow.proofDigest)) || !cost(workflow.cost)) add("MISSING_INPUT", "workflow must bind output, proof digest, and integer measured cost");
  const replays = input.functionReplays;
  if (!Array.isArray(replays) || replays.length < 3 || replays.some((replay) => !record(replay) || typeof replay.output !== "string" || !/^[0-9a-f]{64}$/.test(String(replay.proofDigest)) || !cost(replay.cost))) add("MISSING_INPUT", "at least three complete Function replays are required");
  if (reasons.length) return deny(reasons, details);
  const typedWorkflow = workflow as RecordValue;
  const typedReplays = replays as RecordValue[];
  const first = typedReplays[0]!;
  if (typedReplays.some((replay) => replay.output !== first.output)) add("DETERMINISM_MISMATCH", "Function outputs differ across replays");
  if (typedReplays.some((replay) => replay.proofDigest !== typedWorkflow.proofDigest)) add("PROOF_OBLIGATION_MISMATCH", "Function proof obligations differ from the Workflow proof");
  const functionCost = first.cost as RecordValue;
  if (typedReplays.some((replay) => canonicalJson(replay.cost) !== canonicalJson(functionCost))) add("DETERMINISM_MISMATCH", "Function measured cost differs across replays");
  const workflowCost = typedWorkflow.cost as RecordValue;
  if ((functionCost.reasoningTokens as number) >= (workflowCost.reasoningTokens as number) || (functionCost.retrievalCalls as number) >= (workflowCost.retrievalCalls as number) || (functionCost.verifierChecks as number) < (workflowCost.verifierChecks as number)) add("COST_NON_REDUCTION", "Function must strictly reduce reasoning and retrieval without reducing verification");
  if (reasons.length) return deny(reasons, details);
  return Object.freeze({ status: "FUNCTION_COST_PARITY_RECORDED", replayCount: typedReplays.length, outputSha256: digest(first.output), proofDigest: typedWorkflow.proofDigest as string, workflowCost: structuredClone(workflowCost) as CostParity["workflowCost"], functionCost: structuredClone(functionCost) as CostParity["functionCost"], authority: "NONE", capabilityDelta: "NONE", effect: "NONE", executionClaimed: false, productionClaimed: false });
}
export function createReceipt(fixtureSha256: string, result: CostParity): RecordValue {
  if (!/^[0-9a-f]{64}$/.test(fixtureSha256)) throw new TypeError("fixture digest must be lowercase SHA-256");
  const body = { schemaVersion: "chimpmaera.cks/function-cost-parity-receipt/v1", receiptId: "CKS-12-FUNCTION-COST-PARITY-RECEIPT-V1", fixtureSha256, componentVersions: COMPONENT_VERSIONS, result, status: "RECORDED", authority: "NONE", capabilityDelta: "NONE", effect: "NONE" };
  return { ...body, receiptSha256: digest(body) };
}
