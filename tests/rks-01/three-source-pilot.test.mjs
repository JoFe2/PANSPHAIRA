import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadAndVerifyCapture, canonicalJson } from "../../src/rks-01/deterministic-ingestion.mjs";
import {
  COMPARISON_SOURCE_SET_DIGEST,
  buildPilotCorpora,
  exactJsonArraySlices,
  loadAdmittedSourceBytes,
  validatePilotCorpora,
} from "../../src/rks-01/knowledge-object-projector.mjs";
import { projectApplicationGuides } from "../../src/rks-01/application-guide-projector.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = resolve(repoRoot, "tests/fixtures/rks-01/source-capture-manifest-v1.json");
const expectedSourceSetDigest = "6b13a1e1a23c0a94b1a259c44ceb9a0cf8713766f5632a1a0381e7134799601d";
const sha = (value) => createHash("sha256").update(Buffer.from(canonicalJson(value))).digest("hex");
const fixture = async (name) => JSON.parse(await readFile(resolve(repoRoot, `tests/fixtures/rks-01/${name}`), "utf8"));
const capture = await loadAndVerifyCapture({ repoRoot, manifestPath });
const rawBytesBySource = await loadAdmittedSourceBytes({ capture, repoRoot });

function built() {
  return buildPilotCorpora(capture, { rawBytesBySource });
}

function validate(bundle, options = {}) {
  return validatePilotCorpora({ capture, rawBytesBySource, ...bundle, trustedSourceSetDigest: expectedSourceSetDigest, ...options });
}

test("balanced Wikidata slicing retains literal Unicode escapes that parse/stringify changes", () => {
  const raw = Buffer.from('{"claims":{"P31":[{"mainsnak":{"value":"\\u00e9"},"rank":"normal"}]}}');
  const [slice] = exactJsonArraySlices(raw, "P31");
  assert.equal(slice.text, '{"mainsnak":{"value":"\\u00e9"},"rank":"normal"}');
  assert.notEqual(JSON.stringify(JSON.parse(slice.text)), slice.text);
  assert.equal(raw.subarray(slice.start, slice.endExclusive).toString("utf8"), slice.text);
});

function mutate(bundle, corpus, callback) {
  const copy = structuredClone(bundle);
  callback(copy[corpus]);
  return copy;
}

test("offline pilot builds bounded Raw, typed Knowledge, guides and an excluded RFC control from the verified capture", () => {
  const bundle = built();
  assert.equal(bundle.raw.sourceSetDigest, expectedSourceSetDigest);
  assert.equal(bundle.typed.sourceSetDigest, expectedSourceSetDigest);
  assert.equal(bundle.guides.sourceSetDigest, expectedSourceSetDigest);
  assert.equal(bundle.raw.comparisonSourceSetDigest, COMPARISON_SOURCE_SET_DIGEST);
  assert.equal(bundle.raw.comparisonSourceSetDigest, bundle.typed.comparisonSourceSetDigest);
  assert.equal(bundle.raw.comparisonSourceSetDigest, bundle.guides.comparisonSourceSetDigest);
  assert.deepEqual(bundle.raw.counts.sources, { wikidata: 20, cpython: 20, openapi: 1, total: 41 });
  assert.deepEqual(bundle.typed.counts.sources, bundle.raw.counts.sources);
  assert.equal(bundle.raw.chunks.length > 41, true);
  assert.equal(bundle.typed.objects.length, bundle.raw.chunks.length);
  assert.equal(bundle.guides.guides.length, 41);
  assert.deepEqual(bundle.rfcControl.counts, { admittedArtifacts: 3, comparisonCorpusArtifacts: 0 });
  assert.equal(validate(bundle).outcome, "VERIFIED");
});

test("Raw chunks are verbatim bounded evidence with exact source and byte or line selectors", () => {
  for (const chunk of built().raw.chunks) {
    assert.match(chunk.id, /^evidence:/);
    assert.match(chunk.rawSha256, /^[0-9a-f]{64}$/);
    assert.ok(chunk.text.length > 0 && Buffer.byteLength(chunk.text) <= 16384);
    assert.ok(chunk.selector.byte || chunk.selector.lines);
    const sourceBytes = rawBytesBySource.get(chunk.sourceKey);
    assert.equal(sourceBytes.subarray(chunk.selector.byte.start, chunk.selector.byte.endExclusive).toString("utf8"), chunk.text);
    assert.equal(chunk.verbatim, true);
    assert.equal(Object.hasOwn(chunk, "normalizedText"), false);
  }
});

test("typed objects are closed, evidence-bound and preserve source-specific semantics", () => {
  const bundle = built();
  const evidence = new Set(bundle.raw.chunks.map((item) => item.id));
  for (const object of bundle.typed.objects) {
    assert.deepEqual(Object.keys(object).sort(), ["applicability","constraints","evidenceRefs","exceptions","id","knowledgeType","preconditions","sourceBinding","statement"].sort());
    assert.ok(object.evidenceRefs.length > 0 && object.evidenceRefs.every((id) => evidence.has(id)));
    assert.equal(object.sourceBinding.rawSha256, bundle.raw.chunks.find((item) => item.id === object.evidenceRefs[0]).rawSha256);
    assert.deepEqual(object.applicability.authority, { truth: "NONE", capability: "NONE", authority: "NONE" });
  }
  const wikidata = bundle.typed.objects.filter((item) => item.knowledgeType === "WIKIDATA_STATEMENT");
  assert.ok(wikidata.length > 20);
  assert.ok(wikidata.every((item) => ["P31","P279","P17","P36","P625","P246","P1086","P50","P170","P577","P571","P856"].includes(item.statement.property)));
  assert.ok(wikidata.every((item) => Object.hasOwn(item.statement, "rank") && Object.hasOwn(item.statement, "datatype") && Object.hasOwn(item.statement, "qualifiers") && Object.hasOwn(item.statement, "references")));
  assert.ok(wikidata.some((item) => item.statement.rank !== "normal") || wikidata.some((item) => Object.keys(item.statement.qualifiers).length > 0));

  const python = bundle.typed.objects.filter((item) => item.knowledgeType === "CPYTHON_DOCUMENT_EXCERPT");
  assert.ok(python.every((item) => item.applicability.version === "v3.14.7" && item.sourceBinding.revision === "823f0323ee6ec1402088b73bce1a38473cac36dc"));
  assert.ok(python.some((item) => item.constraints.directives.some((value) => /version(?:added|changed)|deprecated|warning|note/.test(value.kind))));
  assert.ok(python.every((item) => item.constraints.examplePolicy === "DESCRIPTIVE_ONLY_NO_EXECUTION"));

  const openapi = bundle.typed.objects.filter((item) => item.knowledgeType === "OPENAPI_NORMATIVE_EXCERPT");
  assert.equal(new Set(openapi.map((item) => item.applicability.section)).size, 20);
  assert.ok(openapi.every((item) => item.applicability.version === "3.2.0"));
  assert.ok(openapi.some((item) => item.constraints.normativeKeywords.length > 0));
});

test("application guides are non-answer checks with abstention and no grants", () => {
  const bundle = built();
  const objectIds = new Set(bundle.typed.objects.map((item) => item.id));
  const evidenceIds = new Set(bundle.raw.chunks.map((item) => item.id));
  for (const guide of bundle.guides.guides) {
    assert.deepEqual(Object.keys(guide).sort(), ["abstention","counterexamplesAndExceptions","evidenceRefs","id","objectIds","requiredChecks","sourceBinding","verification","whenApplicable"].sort());
    assert.ok(guide.objectIds.every((id) => objectIds.has(id)));
    assert.ok(guide.evidenceRefs.every((id) => evidenceIds.has(id)));
    assert.match(guide.abstention, /abstain/i);
    assert.equal(JSON.stringify(guide).includes("answer"), false);
  }
});

test("RFC 9987 is only exact unmodified admission control and derivative inclusion denies", () => {
  const bundle = built();
  assert.equal(bundle.raw.chunks.some((item) => item.sourceKey.startsWith("RFC9987_CONTROL:")), false);
  assert.equal(bundle.typed.objects.some((item) => item.sourceBinding.sourceKey.startsWith("RFC9987_CONTROL:")), false);
  assert.ok(bundle.rfcControl.artifacts.every((item) => item.transformationClass === "UNMODIFIED_ONLY" && item.identitySha256 === item.rawSha256));
  assert.ok(bundle.rfcControl.verbatimExcerpt.text.length > 0);
  assert.equal(validate(mutate(bundle, "raw", (raw) => raw.chunks.push({ ...raw.chunks[0], id: "evidence:rfc", sourceKey: "RFC9987_CONTROL:rfc9987.xml" }))).reasonCodes.includes("RFC_DERIVATIVE_INCLUSION"), true);
  const transformed = structuredClone(bundle);
  transformed.rfcControl.verbatimExcerpt.text += " rewritten";
  assert.ok(validate(transformed).reasonCodes.includes("RFC_TRANSFORMED_PROSE_DENIED"));
});

test("mismatch, substitution, invented evidence, omission, unsafe execution, promotion and paired re-digestion deny", () => {
  const bundle = built();
  const cases = [
    [mutate(bundle, "raw", (raw) => { raw.sourceSetDigest = "0".repeat(64); }), "SOURCE_SET_MISMATCH"],
    [mutate(bundle, "typed", (typed) => { typed.objects[0].sourceBinding.rawSha256 = "f".repeat(64); }), "SOURCE_HASH_MISMATCH"],
    [mutate(bundle, "raw", (raw) => { raw.chunks[0].text += " invented"; }), "INVENTED_OR_CHANGED_EXCERPT"],
    [mutate(bundle, "raw", (raw) => { raw.chunks[0].text = JSON.stringify(JSON.parse(raw.chunks[0].text), null, 1); }), "INVENTED_OR_CHANGED_EXCERPT"],
    [mutate(bundle, "typed", (typed) => { typed.objects[0].statement = { inventedClaim: true }; }), "INVENTED_OR_CHANGED_CLAIM"],
    [mutate(bundle, "typed", (typed) => { const item = typed.objects.find((o) => o.knowledgeType === "WIKIDATA_STATEMENT"); delete item.statement.references; }), "QUALIFIER_OR_REFERENCE_OMITTED"],
    [mutate(bundle, "typed", (typed) => { const item = typed.objects.find((o) => o.knowledgeType === "CPYTHON_DOCUMENT_EXCERPT"); delete item.applicability.version; }), "VERSION_OR_EXCEPTION_OMITTED"],
    [mutate(bundle, "typed", (typed) => { typed.objects[0].execute = true; }), "UNSAFE_OR_AUTHORITY_FIELD"],
    [mutate(bundle, "guides", (guides) => { guides.guides[0].authorityGrant = "WRITE"; }), "UNSAFE_OR_AUTHORITY_FIELD"],
    [mutate(bundle, "raw", (raw) => { raw.chunks[0].sourceKey = "CPYTHON_DOCUMENT:substitute"; }), "PATH_OR_SOURCE_SUBSTITUTION"],
    [mutate(bundle, "raw", (raw) => { raw.chunks.push({ ...raw.chunks[0], id: "evidence:extra", sourceKey: "OPENAPI_SPEC:extra" }); }), "EXTRA_OR_UNSELECTED_SOURCE"],
  ];
  for (const [candidate, reason] of cases) assert.ok(validate(candidate).reasonCodes.includes(reason), reason);

  const paired = structuredClone(bundle);
  paired.raw.chunks[0].text += " attacker replacement";
  paired.raw.chunks[0].rawSha256 = sha(Buffer.from(paired.raw.chunks[0].text));
  paired.typed.objects.find((item) => item.evidenceRefs.includes(paired.raw.chunks[0].id)).sourceBinding.rawSha256 = paired.raw.chunks[0].rawSha256;
  assert.ok(validate(paired).reasonCodes.includes("PAIRED_REDIGESTION_DENIED"));
});

test("committed corpora and receipt exactly match deterministic offline construction", async () => {
  const bundle = built();
  const [raw, typed, guides, rfc, receipt] = await Promise.all([
    fixture("raw-rag-corpus-v1.json"), fixture("typed-knowledge-corpus-v1.json"), fixture("application-guides-v1.json"), fixture("rfc9987-narrowing-control-v1.json"),
    JSON.parse(await readFile(resolve(repoRoot, "verification/rks-01-corpus-equivalence-receipt-v1.json"), "utf8")),
  ]);
  assert.deepEqual({ raw, typed, guides, rfcControl: rfc }, bundle);
  assert.equal(receipt.outcome, "VERIFIED");
  assert.equal(receipt.networkRequests, 0);
  assert.deepEqual(receipt.digests, { raw: sha(raw), typed: sha(typed), guides: sha(guides), rfcControl: sha(rfc) });
  assert.equal(receipt.comparisonSourceSetDigest, COMPARISON_SOURCE_SET_DIGEST);
  assert.deepEqual(receipt.nonClaims, ["NO_MODEL_EXECUTION_OR_TASK_SCORING","NO_TRUTH_CAPABILITY_OR_AUTHORITY_GRANT","NO_RFC9987_COMPARATIVE_CORPUS_CONTENT","NO_PRODUCTION_PROMOTION"]);
});

test("guide projector rejects authority-bearing typed inputs", () => {
  const typed = built().typed;
  typed.objects[0].promote = true;
  assert.throws(() => projectApplicationGuides(typed), /UNSAFE_OR_AUTHORITY_FIELD/);
});
