import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  acquisitionPlanDigestV1,
  knowledgeGapDigestV1,
  knowledgeNeedDigestV1,
  knowledgeSufficiencyDigestV1,
  sourceEvidenceDigestV1,
  validateAcquisitionPlanV1,
  validateKnowledgeGapV1,
  validateKnowledgeNeedV1,
  validateKnowledgeSufficiencyV1,
  validateSourceEvidenceV1,
  type KnowledgeSufficiencyV1,
  type SourceEvidenceV1,
} from "../packages/contracts/src/cks-knowledge-sufficiency.js";

const valid = JSON.parse(readFileSync("tests/fixtures/cks-07/contracts-valid-v1.json", "utf8")) as Record<string, any>;
const invalid = JSON.parse(readFileSync("tests/fixtures/cks-07/contracts-invalid-v1.json", "utf8")) as {
  cases: Array<{ caseId: string; contract: string; path: string; value: unknown }>;
};

const schemaPath = (name: string): string => `schemas/contracts/cks-${name}-v1.schema.json`;
const schemaByContract: Record<string, string> = {
  knowledgeNeed: schemaPath("knowledge-need"),
  knowledgeGap: schemaPath("knowledge-gap"),
  knowledgeGapMissing: schemaPath("knowledge-gap"),
  acquisitionPlan: schemaPath("acquisition-plan"),
  sourceEvidence: schemaPath("source-evidence"),
  knowledgeSufficiency: schemaPath("knowledge-sufficiency"),
};
const runtimeByContract: Record<string, (value: unknown) => boolean> = {
  knowledgeNeed: validateKnowledgeNeedV1,
  knowledgeGap: validateKnowledgeGapV1,
  knowledgeGapMissing: validateKnowledgeGapV1,
  acquisitionPlan: validateAcquisitionPlanV1,
  sourceEvidence: (value) => validateSourceEvidenceV1(value),
  knowledgeSufficiency: validateKnowledgeSufficiencyV1,
};

function schemaValidator(contract: string): (value: unknown) => boolean {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const path = schemaByContract[contract];
  assert.ok(path);
  return ajv.compile(JSON.parse(readFileSync(path, "utf8")));
}

function digestFor(contract: string, value: Record<string, any>): string {
  if (contract.includes("knowledge-need")) return knowledgeNeedDigestV1(value);
  if (contract.includes("knowledge-gap")) return knowledgeGapDigestV1(value);
  if (contract.includes("acquisition-plan")) return acquisitionPlanDigestV1(value);
  if (contract.includes("source-evidence")) return sourceEvidenceDigestV1(value);
  return knowledgeSufficiencyDigestV1(value);
}

function mutate(caseData: (typeof invalid.cases)[number]): unknown {
  const rootContract = caseData.contract.split("/")[0];
  const suffix = caseData.contract.split("/")[1];
  assert.ok(rootContract !== undefined);
  const result = (suffix === undefined
    ? structuredClone(valid[rootContract])
    : structuredClone(valid[rootContract][Number(suffix)])) as Record<string, any>;
  const parts = caseData.path.split("/");
  const leaf = parts.pop();
  assert.ok(leaf !== undefined);
  let parent: any = result;
  for (const part of parts) parent = parent[part];
  parent[leaf] = caseData.value;
  const digestKey = caseData.contract.startsWith("knowledgeNeed") ? "needDigest"
    : caseData.contract.startsWith("knowledgeGap") ? "gapDigest"
      : caseData.contract.startsWith("acquisitionPlan") ? "planDigest"
        : caseData.contract.startsWith("sourceEvidence") ? "evidenceDigest" : "sufficiencyDigest";
  const digestContract = schemaByContract[rootContract];
  assert.ok(digestContract !== undefined);
  result[digestKey] = digestFor(digestContract, result);
  return result;
}

test("CKS-07 valid fixture is accepted by runtime and JSON Schema contracts", () => {
  const contracts = ["knowledgeNeed", "knowledgeGap", "knowledgeGapMissing", "acquisitionPlan", "knowledgeSufficiency"];
  for (const contract of contracts) {
    const runtimeValidator = runtimeByContract[contract];
    assert.ok(runtimeValidator);
    assert.equal(runtimeValidator(valid[contract]), true, contract);
    assert.equal(schemaValidator(contract)(valid[contract]), true, contract);
  }
  for (const [index, evidence] of valid.sourceEvidence.entries()) {
    assert.equal(validateSourceEvidenceV1(evidence), true, `sourceEvidence/${index}`);
    assert.equal(schemaValidator("sourceEvidence")(evidence), true, `sourceEvidence/${index}`);
  }
});

test("CKS-07 digests are stable under object key reordering", () => {
  const contracts = [valid.knowledgeNeed, valid.knowledgeGap, valid.acquisitionPlan, ...valid.sourceEvidence, valid.knowledgeSufficiency];
  for (const contract of contracts) {
    const reordered = Object.fromEntries(Object.entries(contract).reverse());
    assert.equal(
      digestFor(String(contract.schemaVersion), reordered),
      digestFor(String(contract.schemaVersion), contract),
    );
  }
});

test("CKS-07 negative fixture cases fail closed", () => {
  for (const caseData of invalid.cases) {
    const contract = caseData.contract.split("/")[0];
    assert.ok(contract !== undefined);
    const value = mutate(caseData);
    const runtimeValidator = runtimeByContract[contract];
    assert.ok(runtimeValidator);
    assert.equal(runtimeValidator(value), false, `${caseData.caseId}: runtime`);
    const schemaResult = schemaValidator(contract)(value);
    if (caseData.caseId === "missing-with-repeated-bundle") {
      // JSON Schema cannot express equality of a nested field across array items;
      // the runtime contract validator closes this cross-item semantic gap.
      assert.equal(schemaResult, true, `${caseData.caseId}: schema limitation is explicit`);
    } else assert.equal(schemaResult, false, `${caseData.caseId}: schema`);
  }
});

test("internet and model results cannot become accepted knowledge or authority", () => {
  for (const evidence of valid.sourceEvidence as SourceEvidenceV1[]) {
    assert.notEqual(evidence.sourceClass, "ACTIVE_CURATED_KNOWLEDGE");
    assert.equal(evidence.acceptanceStatus, "NOT_ACCEPTED");
  }
  const sufficient = valid.knowledgeSufficiency as KnowledgeSufficiencyV1;
  assert.equal(sufficient.overallOutcome, "SUFFICIENT");
  const firstRequirement = sufficient.requirements[0];
  assert.ok(firstRequirement);
  assert.deepEqual(firstRequirement.sourceClasses, ["ACTIVE_CURATED_KNOWLEDGE"]);
  assert.equal(sufficient.authorityBoundary, "READ_ONLY_KNOWLEDGE_NO_CREDENTIAL_POLICY_CAPABILITY_TOOL_WRITE_OR_EXECUTION_AUTHORITY");
});
