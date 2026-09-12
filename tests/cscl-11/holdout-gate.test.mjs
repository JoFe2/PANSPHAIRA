import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  buildProfileBundle,
  buildSourceCaptureReceipt,
  buildVerdictReceipts,
  buildHoldoutGate,
  CANDIDATE_MEANING_SENTINEL,
  COMMIT,
  FILES,
} from "../../src/cscl-11/holdout-gate.mjs";
import {
  CAPABILITY_FAMILIES,
  canonicalJson,
  sha256Bytes,
  validateProtocolSchemas,
  evaluateHoldoutFamily,
  deriveOverallVerdict,
} from "../../src/cscl-01/protocol.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIGEST = /^[a-f0-9]{64}$/;
const ID = /^[a-z][a-z0-9.-]{3,127}$/;

async function makeValidators() {
  const Ajv2020 = (await import("ajv/dist/2020.js")).default;
  const addFormats = (await import("ajv-formats")).default;
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  const map = {
    "source-fact": "contracts/cscl-01/source-fact-v1.schema.json",
    "evidence-cell": "contracts/cscl-01/evidence-cell-v1.schema.json",
    "system-profile": "contracts/cscl-01/system-profile-v1.schema.json",
    "mapping-receipt": "contracts/cscl-01/mapping-receipt-v1.schema.json",
    "holdout-verdict": "contracts/cscl-01/holdout-verdict-v1.schema.json",
  };
  const out = {};
  for (const [name, path] of Object.entries(map)) out[name] = ajv.compile(JSON.parse(readFileSync(resolve(REPO_ROOT, path), "utf8")));
  return out;
}

// ---- AC3: profile bundle structure + schema validity ----
test("AC3: holdout profile bundle is 36 facts / 36 cells / 1 profile, HOLDOUT, post-freeze", () => {
  const { profile, cells, sourceFacts } = buildProfileBundle();
  assert.equal(sourceFacts.length, 36);
  assert.equal(cells.length, 36);
  assert.equal(profile.systemId, "idempiere");
  assert.equal(profile.systemRole, "HOLDOUT");
  assert.equal(profile.holdoutIsolation, "HOLDOUT_PROFILE_AFTER_CANDIDATE_FREEZE");
  assert.deepEqual([...profile.capabilityFamilies].sort(), [...CAPABILITY_FAMILIES].sort());
  assert.equal(profile.evidenceCells.length, 36);
  assert.equal(profile.sourceFactDigests.length, 36);
  // 1:1 fact:cell and family-major canonical ordering
  assert.equal(profile.sourceFactDigests.every((d, i) => d === sourceFacts[i].factDigest), true);
});

test("AC3: every source-fact, evidence-cell and profile conform to the frozen schemas", async () => {
  const v = await makeValidators();
  const { profile, cells, sourceFacts } = buildProfileBundle();
  for (const f of sourceFacts) assert.ok(v["source-fact"](f), JSON.stringify(v["source-fact"].errors));
  for (const c of cells) assert.ok(v["evidence-cell"](c), JSON.stringify(v["evidence-cell"].errors));
  assert.ok(v["system-profile"](profile), JSON.stringify(v["system-profile"].errors));
});

test("AC3: digests are self-consistent (factDigest / cellDigest / profileDigest)", () => {
  const { profile, cells, sourceFacts } = buildProfileBundle();
  for (const f of sourceFacts) {
    const b = { ...f }; delete b.factDigest;
    assert.equal(sha256Bytes(Buffer.from(canonicalJson(b))), f.factDigest);
  }
  const famOrder = CAPABILITY_FAMILIES;
  cells.forEach((c, i) => {
    const fam = famOrder[Math.floor(i / 12)];
    assert.equal(profile.evidenceCells[i].capabilityFamily, fam);
    assert.equal(profile.evidenceCells[i].cellDigest, sha256Bytes(Buffer.from(canonicalJson(c))));
  });
  const pbody = { ...profile }; delete pbody.profileDigest;
  assert.equal(sha256Bytes(Buffer.from(canonicalJson(pbody))), profile.profileDigest);
  assert.equal(new Set(sourceFacts.map((f) => f.factDigest)).size, 36, "factDigests must be unique");
});

test("AC3: equivalenceProof uses sha256(claim) for native and a single constant candidate sentinel", () => {
  const { cells, sourceFacts } = buildProfileBundle();
  for (const c of cells) {
    const f = sourceFacts.find((x) => x.factId === c.evidence[0].sourceFactId);
    assert.ok(f, `source fact for cell ${c.questionId} not found`);
    assert.equal(c.equivalenceProof.nativeMeaningSha256, sha256Bytes(Buffer.from(f.claim)));
    assert.equal(c.equivalenceProof.candidateMeaningSha256, CANDIDATE_MEANING_SENTINEL);
    assert.ok(DIGEST.test(c.equivalenceProof.nativeMeaningSha256));
  }
});

test("AC3: ABSENT cells carry >=1 counterexample and SUPPORTED cells carry none", () => {
  const { cells } = buildProfileBundle();
  const absent = cells.filter((c) => c.state === "ABSENT");
  const supported = cells.filter((c) => c.state === "SUPPORTED");
  assert.equal(absent.length, 8);
  assert.equal(supported.length, 28);
  for (const c of absent) assert.ok(c.counterexamples.length >= 1);
  for (const c of supported) assert.equal(c.counterexamples.length, 0);
});

test("AC2: source-capture receipt records the 16 pinned files with byte lengths + digests", () => {
  const r = buildSourceCaptureReceipt();
  assert.equal(r.systemId, "idempiere");
  assert.equal(r.resolvedCommit, COMMIT);
  assert.equal(r.files.length, 16);
  assert.deepEqual(new Set(r.files.map((f) => f.name)), new Set(FILES.map((f) => f.name)));
  for (const f of r.files) {
    assert.ok(DIGEST.test(f.sha256));
    assert.ok(f.byteLength > 0);
    assert.ok(f.rawUrl.startsWith("https://raw.githubusercontent.com/idempiere/idempiere/"));
  }
  assert.equal(r.legal.licenseId, "GPL-2.0-or-later");
  assert.equal(r.legal.noticeStatus, "ABSENT_AT_PIN");
  assert.ok(DIGEST.test(r.receiptDigest));
});

// ---- AC4: mapping receipts (read-only over frozen candidates) ----
test("AC4: product mapping receipt is schema-valid with 1 CORE + 8 VARIANT and coreTotal=5", async () => {
  const v = await makeValidators();
  const gate = buildHoldoutGate({ repoRoot: REPO_ROOT });
  const r = gate.mappingReceipts.PRODUCT_ITEM_MANAGEMENT;
  assert.ok(v["mapping-receipt"](r), JSON.stringify(v["mapping-receipt"].errors));
  assert.equal(r.denominators.coreTotal, 5);
  assert.equal(r.denominators.mappedToCore, 1);
  assert.equal(r.denominators.mappedToVariant, 8);
  assert.equal(r.denominators.unmapped, 0);
  assert.equal(r.denominators.applicable, 9);
  const core = r.mappings.find((m) => m.classification === "CORE");
  assert.equal(core.candidateElementId, "product-item-shared-purpose");
  assert.equal(core.meaningPreserved, true);
});

test("AC4: candidateElementId uses a colon->dash slug that matches the id pattern", async () => {
  const gate = buildHoldoutGate({ repoRoot: REPO_ROOT });
  for (const family of CAPABILITY_FAMILIES) {
    for (const m of gate.mappingReceipts[family].mappings) {
      assert.ok(ID.test(m.candidateElementId), `bad candidateElementId: ${m.candidateElementId}`);
      assert.ok(!m.candidateElementId.includes(":"));
      assert.equal(m.meaningPreserved, true);
    }
  }
  assert.equal(gate.mappingReceipts.PARTY_CUSTOMER_MANAGEMENT.mappings.find((m) => m.holdoutConceptId.endsWith("objects-roles")).candidateElementId, "party-objects-roles");
});

test("AC4/AC6: party and sales mapping receipts are coreTotal=0 and FAIL the mapping-receipt schema (empty-core falsification, not patched)", async () => {
  const v = await makeValidators();
  const gate = buildHoldoutGate({ repoRoot: REPO_ROOT });
  for (const family of ["PARTY_CUSTOMER_MANAGEMENT", "SALES_ORDER_MANAGEMENT"]) {
    const r = gate.mappingReceipts[family];
    assert.equal(r.denominators.coreTotal, 0, `${family} core must be reported as empty, not fabricated`);
    assert.equal(r.denominators.mappedToCore, 0);
    assert.equal(v["mapping-receipt"](r), false, `${family} coreTotal=0 must be schema-non-conformant (minimum 1) -- the falsification signal`);
    const coreErr = (v["mapping-receipt"].errors ?? []).some((e) => e.instancePath === "/denominators/coreTotal" && e.keyword === "minimum");
    assert.ok(coreErr, "the schema failure must be specifically the coreTotal minimum:1 constraint");
  }
});

// ---- AC5: frozen-rule metrics ----
test("AC5: evaluateHoldoutFamily yields product GO, party/sales FALSIFIED with empty-core reasons", async () => {
  const gate = buildHoldoutGate({ repoRoot: REPO_ROOT });
  const p = gate.familyResults.PRODUCT_ITEM_MANAGEMENT;
  const pa = gate.familyResults.PARTY_CUSTOMER_MANAGEMENT;
  const s = gate.familyResults.SALES_ORDER_MANAGEMENT;
  assert.equal(p.verdict, "GO");
  assert.equal(p.corePreservationRatio, 1);
  assert.equal(p.mappedRatio, 1);
  assert.equal(p.unmappedRatio, 0);
  assert.equal(pa.verdict, "FALSIFIED_WITH_EVIDENCE");
  assert.ok(pa.reasonCodes.includes("INVALID_CORE_DENOMINATOR"));
  assert.ok(pa.reasonCodes.includes("CORE_IDENTITY_OR_MEANING_NOT_100_PERCENT_PRESERVED"));
  assert.equal(s.verdict, "FALSIFIED_WITH_EVIDENCE");
  assert.ok(s.reasonCodes.includes("INVALID_CORE_DENOMINATOR"));
  assert.equal(pa.corePreservationRatio, 0);
  assert.equal(s.corePreservationRatio, 0);
});

test("AC5: all six governance gates are true and the overall verdict is NARROW_GO", async () => {
  const gate = buildHoldoutGate({ repoRoot: REPO_ROOT });
  for (const g of Object.values(gate.governanceGates)) assert.equal(g, true);
  assert.equal(gate.overall.verdict, "NARROW_GO");
  assert.deepEqual(gate.overall.reasonCodes, ["ONE_OR_TWO_FAMILIES_GO"]);
});

// ---- AC7: holdout-verdict receipts conform ----
test("AC7: all four holdout-verdict receipts conform to the frozen schema and are digest-self-consistent", async () => {
  const v = await makeValidators();
  const gate = buildHoldoutGate({ repoRoot: REPO_ROOT });
  const receipts = buildVerdictReceipts(gate);
  assert.equal(receipts.length, 4);
  const overall = receipts.find((r) => r.scope === "OVERALL");
  assert.equal(overall.verdict, "NARROW_GO");
  assert.equal(overall.familyVerdicts.length, 3);
  for (const r of receipts) {
    assert.ok(v["holdout-verdict"](r), JSON.stringify(v["holdout-verdict"].errors));
    const b = { ...r }; delete b.verdictDigest;
    assert.equal(sha256Bytes(Buffer.from(canonicalJson(b))), r.verdictDigest);
  }
  for (const fam of CAPABILITY_FAMILIES) {
    const fv = overall.familyVerdicts.find((x) => x.capabilityFamily === fam);
    assert.ok(fv);
    assert.ok(DIGEST.test(fv.mappingReceiptDigest));
  }
});

// ---- AC1: holdout isolation (no iDempiere semantic source consumed) ----
test("AC1: no iDempiere semantic source fact is referenced by the cscl-08/09/10 candidates", async () => {
  const gate = buildHoldoutGate({ repoRoot: REPO_ROOT });
  const iso = gate.isolation;
  assert.equal(iso.clean, true);
  assert.equal(iso.conclusion, "NO_IDEMPIERE_SEMANTIC_SOURCE_CONSUMED_BY_CSCL_01_10");
  for (const pc of iso.perCandidate) {
    assert.equal(pc.idempiereFactRefs.length, 0, `${pc.file} must not reference idempiere.* source facts`);
    assert.deepEqual(pc.nonTrainingSystemIds, []);
    assert.equal(pc.frozenDigestMatchesActual, true);
  }
});

// ---- mutation detection (frozen-candidate bytes) ----
test("mutation: tampering the frozen candidate bytes trips CANDIDATE_BYTES_MUTATED_AFTER_FREEZE", async () => {
  const gate = buildHoldoutGate({ repoRoot: REPO_ROOT });
  const fam = "PRODUCT_ITEM_MANAGEMENT";
  const receipt = gate.mappingReceipts[fam];
  const raw = readFileSync(resolve(REPO_ROOT, gate.candidates[fam].file));
  const tampered = Buffer.from(raw);
  tampered[0] = tampered[0] ^ 0x01;
  const result = evaluateHoldoutFamily({
    candidateBytes: tampered,
    frozenCandidateDigest: gate.candidates[fam].frozenDigest,
    mappings: receipt.mappings,
    coreElements: [{ id: "product-item-shared-purpose", identityPreserved: true, deleted: false, renamed: false, semanticMutation: false, contradiction: false }],
    governanceGates: gate.governanceGates,
  });
  assert.ok(result.reasonCodes.includes("CANDIDATE_BYTES_MUTATED_AFTER_FREEZE"));
});

// ---- negative control: a tampered gate forces FALSIFIED overall ----
test("negative: a failed governance gate forces deriveOverallVerdict to FALSIFIED_WITH_EVIDENCE", async () => {
  const named = CAPABILITY_FAMILIES.map((f) => ({ capabilityFamily: f, verdict: "GO" }));
  const broken = { source: true, legal: true, history: true, integrity: true, denominator: true, isolation: false };
  const r = deriveOverallVerdict(named, broken);
  assert.equal(r.verdict, "FALSIFIED_WITH_EVIDENCE");
  assert.ok(r.reasonCodes.includes("ISOLATION_HARD_GATE_FAILED"));
});

// ---- schema toolchain sanity ----
test("toolchain: all eight frozen cscl-01 schemas still compile", async () => {
  const r = await validateProtocolSchemas({ repoRoot: REPO_ROOT });
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});