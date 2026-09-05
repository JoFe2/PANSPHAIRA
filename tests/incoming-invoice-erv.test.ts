import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  AP04_ERV_CASE_PACK_SHA256_V1,
  INCOMING_INVOICE_ERV_CASE_PACK_V1,
  INCOMING_INVOICE_ERV_CORE_V1,
  compileErvCapabilityCoreV1,
  evaluateErvMatchingCaseV1,
  referenceContentSha256V1,
} from "../packages/contracts/src/index.js";

const AP04_ERV_CASE_PACK_CANONICAL_SHA256_V1 = "899d8dfc44be526011c35ad5aba4c2cb89bca433f1520e61fe05268d4816ad20";

const packPath = "tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json";
const packBytes = readFileSync(packPath);
const pack = JSON.parse(packBytes.toString("utf8"));

function decided(): any {
  const result = compileErvCapabilityCoreV1(pack, AP04_ERV_CASE_PACK_SHA256_V1);
  assert.equal(result.outcome, "DECIDED");
  if (result.outcome !== "DECIDED") throw new Error("expected decided ERV core");
  return result.package;
}
function byCaseId(pkg: any, caseId: string): any {
  const decision = pkg.decisions.find((item: any) => item.caseId === caseId);
  assert.ok(decision, `expected case ${caseId}`);
  return decision;
}

test("AP-04-AC01 supplier, PO, receipt and invoice evidence remain independently evidenced", () => {
  assert.equal(createHash("sha256").update(packBytes).digest("hex"), AP04_ERV_CASE_PACK_SHA256_V1);
  assert.equal(AP04_ERV_CASE_PACK_SHA256_V1, "136bbdfcb61bf48ab0043d828dbf797e9b9156f58d284cc7f9b921da59040845");
  assert.equal(pack.schemaVersion, INCOMING_INVOICE_ERV_CASE_PACK_V1);
  const kinds = new Set<string>();
  for (const reference of pack.cases.flatMap((item: any) => item.references)) kinds.add(reference.body.referenceKind);
  assert.deepEqual([...kinds].sort(), ["INVOICE", "PURCHASE_ORDER", "RECEIPT", "SUPPLIER"]);

  const pkg = decided();
  const matched = byCaseId(pkg, "two-way-matched-strict");
  assert.equal(matched.outcome, "MATCHED");
  for (const citation of matched.evidenceCitations) assert.equal(citation.verified, true);

  // the tampered invoice is unverified while its siblings remain independently verified
  const unverified = byCaseId(pkg, "two-way-unverified-reference-evidence");
  assert.equal(unverified.outcome, "EXCEPTION");
  const invoiceCitation = unverified.evidenceCitations.find((item: any) => item.referenceKind === "INVOICE");
  assert.ok(invoiceCitation);
  assert.equal(invoiceCitation.verified, false);
  for (const citation of unverified.evidenceCitations.filter((item: any) => item.referenceKind !== "INVOICE")) {
    assert.equal(citation.verified, true);
  }

  // each reference's bound contentSha256 recomputes from its own body
  const po = pack.cases[0].references.find((item: any) => item.body.referenceKind === "PURCHASE_ORDER");
  assert.equal(referenceContentSha256V1(po.body), po.evidence.contentSha256);
});

test("AP-04-AC02 two-/three-way matching and tolerance policies are versioned variants", () => {
  assert.deepEqual(pack.variants.matchingModes.map((item: any) => `${item.variantId}@${item.version}`),
    ["TWO_WAY_INVOICE_PO_V1@1.0.0", "THREE_WAY_INVOICE_PO_RECEIPT_V1@1.0.0"]);
  assert.deepEqual(pack.variants.tolerancePolicies.map((item: any) => `${item.variantId}@${item.version}`),
    ["STRICT_ZERO_V1@1.0.0", "ABS_MINOR_V1@1.0.0", "RATE_BPS_V1@1.0.0"]);

  const pkg = decided();
  const absMatched = byCaseId(pkg, "two-way-matched-abs-tolerance");
  assert.equal(absMatched.outcome, "MATCHED");
  assert.equal(absMatched.variant.tolerancePolicyId, "ABS_MINOR_V1");
  assert.equal(absMatched.variant.tolerancePolicyVersion, "1.0.0");

  // same references, a different versioned tolerance variant flips the outcome
  const absCase = pack.cases.find((item: any) => item.caseId === "two-way-matched-abs-tolerance");
  const strictView = { ...absCase, tolerancePolicy: { variantId: "STRICT_ZERO_V1", version: "1.0.0" } };
  const strictResult = evaluateErvMatchingCaseV1(strictView, pack);
  assert.equal(strictResult.outcome, "CONFLICT");
  assert.equal((strictResult as any).conflict.tolerancePolicyId, "STRICT_ZERO_V1");

  // a version not present in the frozen registry is an explicit unknown-variant exception
  const unknownVariant = byCaseId(pkg, "two-way-unknown-variant-version");
  assert.equal(unknownVariant.outcome, "EXCEPTION");
  assert.equal((unknownVariant as any).exceptionCode, "UNKNOWN_VARIANT");
});

test("AP-04-AC03 exception states, missing context and conflicts remain explicit", () => {
  const pkg = decided();
  const conflict = byCaseId(pkg, "three-way-conflict-strict");
  assert.equal(conflict.outcome, "CONFLICT");
  assert.deepEqual((conflict as any).conflict, {
    minReferenceId: "RCV-2026-0001", minAmountMinor: 2350,
    maxReferenceId: "INV-2026-0001", maxAmountMinor: 2400,
    deltaMinor: 50, toleranceMinor: 0,
    tolerancePolicyId: "STRICT_ZERO_V1", tolerancePolicyVersion: "1.0.0",
  });

  const missing = byCaseId(pkg, "three-way-missing-receipt-context");
  assert.equal(missing.outcome, "EXCEPTION");
  assert.equal((missing as any).exceptionCode, "MISSING_CONTEXT");
  assert.match((missing as any).detail, /RECEIPT/);

  const threeMatched = byCaseId(pkg, "three-way-matched-rate-tolerance");
  assert.equal(threeMatched.outcome, "MATCHED");
  assert.equal(threeMatched.matchedAmountMinor, 2415);
});

test("AP-04-AC04 advisor questions cite evidence and grant no booking authority", () => {
  const pkg = decided();
  assert.equal(pkg.authority.bookingAuthorityGranted, false);
  assert.equal(pkg.authority.productivePostingAuthorized, false);
  for (const decision of pkg.decisions) {
    assert.equal(decision.authority.bookingAuthorityGranted, false);
    assert.equal(decision.authority.productivePostingAuthorized, false);
    assert.equal(decision.authority.riskDCapability, "SEPARATELY_AUTHORIZED");
    assert.ok(decision.advisor.advisorAuthority, "EVIDENCE_CITING_ONLY");
    assert.equal(decision.advisor.advisorAuthority, "EVIDENCE_CITING_ONLY");
    assert.equal(decision.advisor.bookingAuthorityGranted, false);
    assert.ok(decision.advisor.questions.length >= 1);
    for (const question of decision.advisor.questions) {
      assert.ok(question.citations.length >= 1, "every advisor question cites evidence");
      for (const citation of question.citations) {
        assert.ok(citation.referenceKind, "citation names a reference kind");
        assert.ok(citation.referenceId, "citation names a reference id");
        assert.ok(/^[a-f0-9]{64}$/.test(citation.evidenceSha256), "citation cites the bound evidence digest");
      }
    }
  }
});

test("AP-04-AC05 productive allocation/posting requires separate Risk-D authorization", () => {
  const pkg = decided();
  assert.equal(pkg.authority.riskDCapability, "SEPARATELY_AUTHORIZED");
  const denied = byCaseId(pkg, "two-way-productive-posting-denied");
  assert.equal(denied.outcome, "DENIED");
  assert.equal((denied as any).reasonCode, "RISK_D_AUTHORIZATION_REQUIRED");
  assert.match((denied as any).detail, /Risk-D/);
  assert.equal((denied as any).authority.productivePostingAuthorized, false);
  assert.equal((denied as any).authority.bookingAuthorityGranted, false);
  for (const decision of pkg.decisions) assert.equal(decision.authority.productivePostingAuthorized, false);
});

test("AP-04 deterministic readback, frozen nonclaims and schema conformance", () => {
  const resultA = compileErvCapabilityCoreV1(pack, AP04_ERV_CASE_PACK_SHA256_V1);
  const resultB = compileErvCapabilityCoreV1(pack, AP04_ERV_CASE_PACK_SHA256_V1);
  assert.equal(resultA.outcome, "DECIDED");
  assert.equal(resultB.outcome, "DECIDED");
  if (resultA.outcome !== "DECIDED" || resultB.outcome !== "DECIDED") throw new Error("expected decided ERV core");
  assert.deepEqual(resultA.package.decisions, resultB.package.decisions);
  assert.equal(resultA.package.readback.deterministicReplay, true);
  assert.equal(resultA.package.readback.packSha256, AP04_ERV_CASE_PACK_CANONICAL_SHA256_V1);
  assert.equal(resultA.package.schemaVersion, INCOMING_INVOICE_ERV_CORE_V1);
  assert.deepEqual(resultA.package.nonclaims, [
    "NO_CUSTOMER_DATA_EVALUATED",
    "NO_EXTERNAL_PROVIDER_EVALUATED",
    "NO_PRODUCTIVE_ALLOCATION_OR_POSTING_AUTHORIZED",
    "NO_BOOKING_AUTHORITY_GRANTED",
    "NO_LIVE_ERP_SYSTEM_CLAIM",
  ]);
  assert.equal(Object.isFrozen(resultA), true);

  const schema = JSON.parse(readFileSync("schemas/contracts/incoming-invoice-erv-v1.schema.json", "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(resultA), true, JSON.stringify(validate.errors));
});

test("AP-04 rejects mutated or malformed case packs instead of inventing decisions", () => {
  assert.deepEqual(compileErvCapabilityCoreV1({ ...pack, unexpected: true }, AP04_ERV_CASE_PACK_SHA256_V1), {
    outcome: "DENIED", reasonCode: "PACK_SHAPE_DENIED",
  });
  assert.deepEqual(compileErvCapabilityCoreV1(pack, "0".repeat(64)), {
    outcome: "DENIED", reasonCode: "PACK_DIGEST_DENIED",
  });
  const repack = JSON.parse(JSON.stringify(pack));
  repack.packId = "tampered-pack";
  assert.deepEqual(compileErvCapabilityCoreV1(repack, AP04_ERV_CASE_PACK_SHA256_V1), {
    outcome: "DENIED", reasonCode: "PACK_DIGEST_DENIED",
  });
});

test("AP-04 focused suite is registered exactly once in canonical pretest", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  assert.equal(packageJson.scripts["incoming-invoice-erv:test"],
    "npm run build --silent && node --test dist/tests/incoming-invoice-erv.test.js");
  assert.equal(((packageJson.scripts.pretest ?? "").match(/npm run incoming-invoice-erv:test/g) ?? []).length, 1);
});