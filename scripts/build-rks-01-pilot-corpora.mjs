#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, loadAndVerifyCapture } from "../src/rks-01/deterministic-ingestion.mjs";
import { buildPilotCorpora, COMPARISON_SOURCE_SET_DIGEST, loadAdmittedSourceBytes, validatePilotCorpora } from "../src/rks-01/knowledge-object-projector.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.length > 2 || (args.length && args[0] !== "--output-root")) throw new Error("UNKNOWN_BUILDER_ARGUMENT");
const outputRoot = args[0] === "--output-root" ? resolve(args[1]) : repoRoot;
const manifestPath = resolve(repoRoot, "tests/fixtures/rks-01/source-capture-manifest-v1.json");
const sourceSetDigest = "6b13a1e1a23c0a94b1a259c44ceb9a0cf8713766f5632a1a0381e7134799601d";
const sha = (value) => createHash("sha256").update(Buffer.from(canonicalJson(value))).digest("hex");
const bytes = (value) => Buffer.from(`${canonicalJson(value)}\n`);

const capture = await loadAndVerifyCapture({ repoRoot, manifestPath }); // OFFLINE_ONLY: decoded verified Run-2 snapshots.
const rawBytesBySource = await loadAdmittedSourceBytes({ capture, repoRoot });
const bundle = buildPilotCorpora(capture, { rawBytesBySource });
const validation = validatePilotCorpora({ capture, rawBytesBySource, ...bundle, trustedSourceSetDigest: sourceSetDigest });
if (validation.outcome !== "VERIFIED") throw new Error(`CORPUS_VALIDATION_FAILED:${validation.reasonCodes.join(",")}`);

const rawByKey = new Map();
for (const source of capture.sources) {
  const encoded = await readFile(resolve(repoRoot, source.encodedArtifactPath));
  rawByKey.set(`${source.role}:${source.selector}`, Buffer.from(encoded.toString("ascii").replace(/\s/g, ""), "base64"));
}
for (const chunk of bundle.raw.chunks) {
  const raw = rawByKey.get(chunk.sourceKey);
  if (!raw || !raw.includes(Buffer.from(chunk.text))) throw new Error(`INVENTED_OR_CHANGED_EXCERPT:${chunk.id}`);
}
const rfcRaw = rawByKey.get(bundle.rfcControl.verbatimExcerpt.sourceKey);
if (!rfcRaw.subarray(0, Buffer.byteLength(bundle.rfcControl.verbatimExcerpt.text)).equals(Buffer.from(bundle.rfcControl.verbatimExcerpt.text))) throw new Error("RFC_TRANSFORMED_PROSE_DENIED");
const rawKeys = [...new Set(bundle.raw.chunks.map((item) => item.sourceKey))].sort();
const typedKeys = [...new Set(bundle.typed.objects.map((item) => item.sourceBinding.sourceKey))].sort();
const guideKeys = [...new Set(bundle.guides.guides.map((item) => item.sourceBinding.sourceKey))].sort();
const sourceKeysIdentical = rawKeys.length === 41 && canonicalJson(rawKeys) === canonicalJson(typedKeys) && canonicalJson(rawKeys) === canonicalJson(guideKeys);
if (!sourceKeysIdentical) throw new Error("RAW_TYPED_GUIDE_SOURCE_SET_MISMATCH");

const outputs = [
  ["tests/fixtures/rks-01/raw-rag-corpus-v1.json", bundle.raw],
  ["tests/fixtures/rks-01/typed-knowledge-corpus-v1.json", bundle.typed],
  ["tests/fixtures/rks-01/application-guides-v1.json", bundle.guides],
  ["tests/fixtures/rks-01/rfc9987-narrowing-control-v1.json", bundle.rfcControl],
];
const receipt = {
  schemaVersion: "pansphaira.rks01/corpus-equivalence-receipt/v1",
  outcome: "VERIFIED",
  mode: "OFFLINE_DETERMINISTIC_BUILD",
  networkRequests: 0,
  sourceSetDigest,
  comparisonSourceSetDigest: COMPARISON_SOURCE_SET_DIGEST,
  sourceCounts: bundle.raw.counts.sources,
  counts: { rawChunks: bundle.raw.chunks.length, typedObjects: bundle.typed.objects.length, applicationGuides: bundle.guides.guides.length, rfcControlArtifacts: bundle.rfcControl.artifacts.length },
  digests: { raw: sha(bundle.raw), typed: sha(bundle.typed), guides: sha(bundle.guides), rfcControl: sha(bundle.rfcControl) },
  equivalence: { rawTypedGuideSourceKeysIdentical: sourceKeysIdentical, exactComparisonSources: rawKeys.length, obligationsProvenanceOnly: capture.sources.filter((item) => item.role.endsWith("OBLIGATION")).length, rfcExcludedFromComparison: rawKeys.every((key) => !key.startsWith("RFC9987_CONTROL:")), inventedEvidenceChecks: bundle.raw.chunks.length },
  nonClaims: ["NO_MODEL_EXECUTION_OR_TASK_SCORING","NO_TRUTH_CAPABILITY_OR_AUTHORITY_GRANT","NO_RFC9987_COMPARATIVE_CORPUS_CONTENT","NO_PRODUCTION_PROMOTION"],
};
outputs.push(["verification/rks-01-corpus-equivalence-receipt-v1.json", receipt]);
for (const [path, value] of outputs) {
  const destination = resolve(outputRoot, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes(value));
}
process.stdout.write(bytes(receipt));
