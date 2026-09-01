import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { buildPartyCandidate, canonicalJson, derivePartyCandidate, renderArtifacts } from "../../src/cscl-08/party-candidate.mjs";

const root = resolve(import.meta.dirname, "../..");

test("binds the released CSCL-07 authority and exact Party denominator", async () => {
  const result = await buildPartyCandidate({ repoRoot: root });

  assert.deepEqual(result.candidate.sourceAuthority, {
    releaseTag: "2026_08_31_v4",
    releasedMain: "27488888a35fc59caa51bff12fb4ba8c0f28c31d",
    matrixPath: "verification/cscl-07-semantic-evidence-matrix-v1.json",
    matrixDigest: "d68dff995ab03e426302f593a5f73e10ffa886040217b7355e310878aa957d8d",
    evidenceReviewDigest: "779d304ff4ddc92f1bf1f1fc8471ff079ab9e89044331f098ddf0523375ccfc0",
    reviewLedgerCount: 36,
  });
  assert.equal(result.candidate.capabilityFamily, "PARTY_CUSTOMER_MANAGEMENT");
  assert.deepEqual(result.candidate.denominator, {
    rows: 12,
    cells: 60,
    systems: 5,
    relationCandidates: 12,
  });
});

test("preserves every Party classification, matrix cell, fact, and original evidence reference", async () => {
  const { candidate } = await buildPartyCandidate({ repoRoot: root });

  assert.deepEqual(candidate.classificationCounts, {
    CORE: 0,
    OPTIONAL_FEATURE: 0,
    SYSTEM_VARIANT: 49,
    PROCESS_VARIANT: 0,
    ABSENCE: 4,
    UNRESOLVED_CONFLICT: 7,
  });
  assert.deepEqual(candidate.relationCounts, { UNRESOLVED: 9, DENIED: 3 });
  assert.equal(candidate.analyses.length, 12);
  assert.deepEqual(candidate.analyses.map((analysis) => analysis.questionId), [
    "objects-roles", "relations", "operations", "inputs-outputs", "states-transitions", "events",
    "preconditions", "invariants", "exceptions-errors", "readbacks", "api-service-exposure",
    "absence-ambiguity-conflict",
  ]);

  const elements = candidate.analyses.flatMap((analysis) => analysis.elements);
  assert.equal(elements.length, 60);
  assert.equal(new Set(elements.map((element) => `${element.questionId}/${element.systemId}`)).size, 60);
  assert.ok(elements.every((element) => /^[a-f0-9]{64}$/.test(element.sourceCellDigest)));
  assert.ok(elements.every((element) => /^[a-f0-9]{64}$/.test(element.sourceProfileDigest)));
  assert.ok(elements.every((element) => element.sourceFacts.length > 0));
  assert.ok(elements.flatMap((element) => element.sourceFacts).every((fact) =>
    fact.factId && /^[a-f0-9]{64}$/.test(fact.factDigest) && fact.claim &&
      fact.exactEvidence.exactLocator && /^[a-f0-9]{64}$/.test(fact.exactEvidence.excerptSha256)
  ));
  assert.ok(elements.filter((element) => ["ABSENT", "AMBIGUOUS", "CONFLICTING"].includes(element.sourceState))
    .every((element) => element.counterevidence.length > 0));

  assert.equal(candidate.commonCore.length, 0);
  assert.equal(candidate.optionalFeatures.length, 0);
  assert.equal(candidate.processVariants.length, 0);
  assert.equal(candidate.systemVariants.length, 49);
  assert.equal(candidate.absences.length, 4);
  assert.equal(candidate.unresolvedConflicts.length, 7);
  assert.match(candidate.completeEvidenceConclusion, /zero Party VARIANT_RELATION|9 UNRESOLVED|3 DENIED/);
});

test("replays independently and denies caller, frequency, extra-field, holdout, and authority mutations", async () => {
  const first = await buildPartyCandidate({ repoRoot: root });
  const second = await buildPartyCandidate({ repoRoot: root });
  assert.equal(canonicalJson(first.candidate), canonicalJson(second.candidate));

  const matrix = JSON.parse(await readFile(resolve(root, "verification/cscl-07-semantic-evidence-matrix-v1.json"), "utf8"));
  assert.equal(canonicalJson(derivePartyCandidate(matrix)), canonicalJson(first.candidate));
  assert.equal(matrix.relationCandidates.filter((relation) => relation.state === "VARIANT_RELATION").length, 2);
  assert.equal(matrix.relationCandidates.filter((relation) => relation.capabilityFamily === "PARTY_CUSTOMER_MANAGEMENT" && relation.state === "VARIANT_RELATION").length, 0);
  assert.deepEqual(first.candidate.commonCore, []);

  const attacks = [
    ["caller label", (changed) => { changed.callerLabel = "common"; }],
    ["frequency", (changed) => { changed.frequency = "5/5"; }],
    ["extra field", (changed) => { changed.rows[0].cells[0].extra = true; }],
    ["holdout", (changed) => { changed.holdoutPath = "sealed/system"; }],
    ["authority", (changed) => { changed.Authority = "WRITE"; }],
    ["field promoted to core", (changed) => { changed.relationCandidates[0].state = "POTENTIAL_EQUIVALENCE"; }],
  ];
  for (const [label, mutate] of attacks) {
    const changed = structuredClone(matrix);
    mutate(changed);
    assert.throws(() => derivePartyCandidate(changed), /SOURCE_MATRIX_DIGEST_MISMATCH/, label);
  }
});

test("freezes deterministic candidate, receipt, and Mapping/Application Guide artifacts", async () => {
  const first = await renderArtifacts({ repoRoot: root });
  const second = await renderArtifacts({ repoRoot: root });
  assert.deepEqual(first, second);
  assert.equal(first.candidate, await readFile(resolve(root, "verification/cscl-08-party-candidate-v1.json"), "utf8"));
  assert.equal(first.receipt, await readFile(resolve(root, "verification/cscl-08-party-candidate-receipt-v1.json"), "utf8"));
  assert.equal(first.guide, await readFile(resolve(root, "docs/architecture/cscl-08-party-mapping-application-guide-v1.md"), "utf8"));

  const candidate = JSON.parse(first.candidate);
  const receipt = JSON.parse(first.receipt);
  assert.equal(candidate.status, "NON_AUTHORITATIVE_CANDIDATE_FROZEN");
  assert.equal(receipt.outcome, "FROZEN_EMPTY_CORE_WITH_SOURCE_BOUND_VARIANTS_AND_LIMITS");
  assert.equal(receipt.digests.matrix, candidate.sourceAuthority.matrixDigest);
  assert.match(first.guide, /empty common core/i);
  assert.match(first.guide, /never.*frequency|frequency.*never/i);
  assert.match(first.guide, /system variant/i);
  assert.match(first.guide, /absence/i);
  assert.match(first.guide, /unresolved/i);
  assert.match(first.guide, /non-authoritative/i);
});

test("registers the focused CSCL-08 replay command", async () => {
  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["cscl08:test"], "node --test tests/cscl-08/party-candidate.test.mjs");
});
