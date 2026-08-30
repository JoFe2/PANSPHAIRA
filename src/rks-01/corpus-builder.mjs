import { createHash } from "node:crypto";
import { canonicalJson } from "./deterministic-ingestion.mjs";

const digest = (value) => createHash("sha256").update(Buffer.from(canonicalJson(value))).digest("hex");

export function buildCorpusInputs(capture, { transformRfc = false } = {}) {
  if (transformRfc) throw new Error("RFC_TRANSFORMED_PROSE_DENIED");
  if (capture?.outcome !== "VERIFIED" || !capture.digests?.sourceSetDigest) throw new Error("VERIFIED_CAPTURE_REQUIRED");
  const records = capture.canonicalRecords.filter((record) => record.sourceClass !== "RFC9987_UNMODIFIED_CONTROL" && record.sourceClass !== "LICENSE_OBLIGATION");
  const common = records.map((record) => ({ sourceKey: record.sourceKey, sourceSha256: record.sourceSha256, canonicalRecordDigest: digest(record) }));
  const raw = { projectionClass: "RAW_RAG_PRECURSOR_ONLY", sourceSetDigest: capture.digests.sourceSetDigest, records: structuredClone(common) };
  const typed = { projectionClass: "TYPED_KNOWLEDGE_PRECURSOR_ONLY", sourceSetDigest: capture.digests.sourceSetDigest, records: structuredClone(common) };
  const envelope = { schemaVersion: "pansphaira.rks01/equal-source-corpus-input/v1", finalCorpusBuilt: false, raw, typed };
  return { ...envelope, digest: digest(envelope) };
}
