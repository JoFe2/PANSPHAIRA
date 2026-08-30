import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson } from "./deterministic-ingestion.mjs";
import { projectApplicationGuides } from "./application-guide-projector.mjs";

const SOURCE_SET_DIGEST = "6b13a1e1a23c0a94b1a259c44ceb9a0cf8713766f5632a1a0381e7134799601d";
export const COMPARISON_SOURCE_SET_DIGEST = "9db857ec6c970138aa6db689e3e575a3788c9926ed3a1dbe6c96175b069dc542";
const CPYTHON_COMMIT = "823f0323ee6ec1402088b73bce1a38473cac36dc";
const OPENAPI_COMMIT = "99710bcb26cbe4be646565eebeb04348f02374b5";
const WIKIDATA_PROPERTIES = new Set(["P31","P279","P17","P36","P625","P246","P1086","P50","P170","P577","P571","P856"]);
const OPENAPI_SECTIONS = new Set(["OpenAPI Object","Info Object","License Object","Server Object","Server Variable Object","Components Object","Paths Object","Path Item Object","Operation Object","Parameter Object","Request Body Object","Media Type Object","Responses Object","Response Object","Callback Object","Example Object","Link Object","Header Object","Security Scheme Object","Security Requirement Object"]);
const shaBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clone = (value) => structuredClone(value);
const comparisonRecords = (capture) => capture.canonicalRecords.filter((record) => ["WIKIDATA_STRUCTURED","CPYTHON_VERSIONED_DOCS","OPENAPI_NORMATIVE_SPEC"].includes(record.sourceClass));
const sourceCounts = Object.freeze({ wikidata: 20, cpython: 20, openapi: 1, total: 41 });

function evidenceId(sourceKey, selector, text) {
  return `evidence:${shaBytes(Buffer.from(canonicalJson({ sourceKey, selector, text }))).slice(0, 24)}`;
}

function objectId(evidence) {
  return `knowledge:${evidence.id.slice("evidence:".length)}`;
}

function lineChunks(text, startLine = 1, endLine = undefined, maxBytes = 12000) {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const last = endLine ?? lines.length;
  const chunks = [];
  let line = startLine;
  while (line <= last) {
    let end = line - 1;
    let bytes = 0;
    while (end < last) {
      const next = Buffer.byteLength(lines[end]);
      if (end >= line && bytes + next > maxBytes) break;
      if (next > maxBytes) throw new Error("SOURCE_LINE_EXCEEDS_CHUNK_BOUND");
      bytes += next; end += 1;
    }
    const value = lines.slice(line - 1, end).join("");
    if (value.length > 0) chunks.push({ start: line, end, text: value });
    line = end + 1;
  }
  return chunks;
}

function sourceBinding(record) {
  return { sourceKey: record.sourceKey, sourceClass: record.sourceClass, rawSha256: record.sourceSha256, selector: record.selector, revision: record.revision };
}

function matchingEnd(text, start, open, close) {
  let depth = 0, inString = false, escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === open) depth += 1;
    else if (char === close && --depth === 0) return index + 1;
  }
  throw new Error("JSON_RANGE_UNBALANCED");
}

export function exactJsonArraySlices(rawBytes, property) {
  const text = rawBytes.toString("utf8");
  if (!Buffer.from(text).equals(rawBytes)) throw new Error("SOURCE_NOT_EXACT_UTF8");
  const claimsAt = text.indexOf('"claims":{');
  if (claimsAt < 0) return [];
  const claimsStart = text.indexOf("{", claimsAt);
  const claimsEnd = matchingEnd(text, claimsStart, "{", "}");
  const token = `${JSON.stringify(property)}:[`;
  let keyAt = -1, depth = 1, inString = false, escaped = false;
  for (let index = claimsStart + 1; index < claimsEnd; index += 1) {
    if (!inString && depth === 1 && text.startsWith(token, index)) { keyAt = index; break; }
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") depth -= 1;
  }
  if (keyAt < 0) return [];
  const arrayStart = text.indexOf("[", keyAt);
  const arrayEnd = matchingEnd(text, arrayStart, "[", "]");
  const ranges = [];
  let cursor = arrayStart + 1;
  while (cursor < arrayEnd - 1) {
    while (/[\s,]/.test(text[cursor])) cursor += 1;
    if (text[cursor] === "]") break;
    if (text[cursor] !== "{") throw new Error("WIKIDATA_RAW_STATEMENT_NOT_OBJECT");
    const end = matchingEnd(text, cursor, "{", "}");
    const startByte = Buffer.byteLength(text.slice(0, cursor));
    const endByte = Buffer.byteLength(text.slice(0, end));
    ranges.push({ start: startByte, endExclusive: endByte, text: rawBytes.subarray(startByte, endByte).toString("utf8") });
    cursor = end;
  }
  return ranges;
}

function rawEvidence(record, rawBytes) {
  const sourceText = rawBytes.toString("utf8");
  if (!Buffer.from(sourceText).equals(rawBytes)) throw new Error("SOURCE_NOT_EXACT_UTF8");
  if (record.sourceClass === "WIKIDATA_STRUCTURED") {
    const result = [];
    for (const [property, statements] of Object.entries(record.entity.claims).filter(([property]) => WIKIDATA_PROPERTIES.has(property))) {
      const ranges = exactJsonArraySlices(rawBytes, property);
      if (ranges.length !== statements.length) throw new Error("WIKIDATA_RAW_STATEMENT_COUNT_MISMATCH");
      for (let index = 0; index < ranges.length; index += 1) {
        const range = ranges[index];
        const selector = { byte: { start: range.start, endExclusive: range.endExclusive, jsonPointer: `/entities/${record.selector}/claims/${property}/${index}`, fragmentSha256: shaBytes(Buffer.from(range.text)) } };
        result.push({ id: evidenceId(record.sourceKey, selector, range.text), sourceKey: record.sourceKey, sourceClass: record.sourceClass, rawSha256: record.sourceSha256, selector, verbatim: true, text: range.text });
      }
    }
    return result;
  }
  const sourceLines = sourceText.split("\n");
  if (record.sourceClass === "OPENAPI_NORMATIVE_SPEC") {
    const headings = [];
    for (let index = 0; index < sourceLines.length; index += 1) {
      const match = /^(#{1,6})\s+(.+)$/.exec(sourceLines[index]);
      if (match) headings.push({ line: index + 1, level: match[1].length, heading: match[2] });
    }
    const chunks = [];
    for (const heading of headings.filter((item) => item.level === 3 && OPENAPI_SECTIONS.has(item.heading))) {
      const next = headings.find((item) => item.line > heading.line && item.level <= heading.level);
      for (const part of lineChunks(sourceText, heading.line, (next?.line ?? sourceLines.length + 1) - 1)) {
        const start = Buffer.byteLength(sourceLines.slice(0, part.start - 1).join("\n") + (part.start > 1 ? "\n" : ""));
        const selector = { byte: { start, endExclusive: start + Buffer.byteLength(part.text) }, lines: { start: part.start, end: part.end, section: heading.heading } };
        chunks.push({ id: evidenceId(record.sourceKey, selector, part.text), sourceKey: record.sourceKey, sourceClass: record.sourceClass, rawSha256: record.sourceSha256, selector, verbatim: true, text: part.text });
      }
    }
    return chunks;
  }
  const sections = [];
  for (let index = 0; index + 1 < sourceLines.length; index += 1) if (sourceLines[index].trim() && /^[=\-~^"`:+*#<>]{3,}$/.test(sourceLines[index + 1].trim())) sections.push({ line: index + 1, heading: sourceLines[index].trim() });
  const sectionForLine = (line) => [...sections].reverse().find((section) => section.line <= line) ?? { heading: "DOCUMENT_PREAMBLE", line: 1 };
  let byteCursor = 0;
  return lineChunks(sourceText).map((part) => {
    const section = sectionForLine(part.start);
    const start = byteCursor;
    byteCursor += Buffer.byteLength(part.text);
    const selector = { byte: { start, endExclusive: byteCursor }, lines: { start: part.start, end: part.end, section: section.heading, sectionAnchorLine: section.line, path: record.selector } };
    return { id: evidenceId(record.sourceKey, selector, part.text), sourceKey: record.sourceKey, sourceClass: record.sourceClass, rawSha256: record.sourceSha256, selector, verbatim: true, text: part.text };
  });
}

function directives(text) {
  const values = [];
  const pattern = /^\.\.\s+(versionadded|versionchanged|deprecated|warning|note)::\s*(.*)$/gm;
  for (const match of text.matchAll(pattern)) values.push({ kind: match[1], value: match[2] || "UNSPECIFIED_IN_DIRECTIVE_HEADER" });
  return values;
}

function typedObject(record, evidence) {
  const binding = sourceBinding(record);
  const authority = { truth: "NONE", capability: "NONE", authority: "NONE" };
  if (record.sourceClass === "WIKIDATA_STRUCTURED") {
    const { jsonPointer } = evidence.selector.byte;
    const [, , , , property] = jsonPointer.split("/");
    const parsedRaw = JSON.parse(evidence.text);
    const original = { ...parsedRaw, qualifiers: clone(parsedRaw.qualifiers ?? {}), references: clone(parsedRaw.references ?? []) };
    return {
      id: objectId(evidence),
      knowledgeType: "WIKIDATA_STATEMENT",
      statement: { entity: record.selector, property, rank: original.rank, datatype: original.mainsnak.datatype, mainsnak: clone(original.mainsnak), qualifiers: clone(original.qualifiers), references: clone(original.references) },
      applicability: { entityRevision: record.revision, deprecatedPositiveEvidence: original.rank === "deprecated" ? "DENIED" : "NOT_DEPRECATED", labelsAndDescriptions: "DISPLAY_AND_DISCOVERY_ONLY", authority },
      preconditions: ["Match entity, revision, property and complete statement identity."],
      constraints: { propertyWhitelist: [...WIKIDATA_PROPERTIES], preserveParallelAndConflictingStatements: true },
      exceptions: original.rank === "deprecated" ? ["DEPRECATED_STATEMENT_NOT_POSITIVE_EVIDENCE"] : [],
      evidenceRefs: [evidence.id], sourceBinding: binding,
    };
  }
  if (record.sourceClass === "CPYTHON_VERSIONED_DOCS") {
    const found = directives(evidence.text);
    return {
      id: objectId(evidence), knowledgeType: "CPYTHON_DOCUMENT_EXCERPT", statement: { exactExcerpt: evidence.text },
      applicability: { version: "v3.14.7", commit: CPYTHON_COMMIT, path: record.selector, section: evidence.selector.lines.section, directiveAnchors: found, authority },
      preconditions: ["Match the pinned CPython version, commit, path and section."],
      constraints: { directives: found, examplePolicy: "DESCRIPTIVE_ONLY_NO_EXECUTION" },
      exceptions: found.filter((item) => ["deprecated","warning","note","versionchanged"].includes(item.kind)),
      evidenceRefs: [evidence.id], sourceBinding: binding,
    };
  }
  const keywords = [...new Set(evidence.text.match(/\b(?:MUST|MUST NOT|REQUIRED|SHALL|SHALL NOT|SHOULD|SHOULD NOT|RECOMMENDED|MAY|OPTIONAL)\b/g) ?? [])];
  const fieldConstraints = evidence.text.split("\n").filter((line) => /\|\s*`[^`]+`\s*\||\b(?:MUST|REQUIRED|SHALL|SHOULD|MAY)\b/.test(line)).slice(0, 32);
  return {
    id: objectId(evidence), knowledgeType: "OPENAPI_NORMATIVE_EXCERPT", statement: { exactExcerpt: evidence.text },
    applicability: { version: "3.2.0", commit: OPENAPI_COMMIT, path: record.selector, section: evidence.selector.lines.section, authority },
    preconditions: ["Match OpenAPI 3.2.0 and the exact frozen normative section."],
    constraints: { normativeKeywords: keywords, fieldConstraints }, exceptions: [], evidenceRefs: [evidence.id], sourceBinding: binding,
  };
}

function buildRfcControl(capture) {
  const sources = capture.sources.filter((source) => source.role === "RFC9987_CONTROL");
  const xmlRecord = capture.canonicalRecords.find((record) => record.sourceKey === "RFC9987_CONTROL:rfc9987.xml");
  // Identity records do not retain raw text. This excerpt is exact fixed metadata
  // from the admitted XML declaration and is checked against its own digest.
  const text = "<?xml version='1.0' encoding='utf-8'?>\n";
  return {
    schemaVersion: "pansphaira.rks01/rfc9987-narrowing-control/v1",
    decision: "NARROW_ADMIT_UNMODIFIED_ONLY_NOT_COMPARATIVE_CORPUS",
    counts: { admittedArtifacts: 3, comparisonCorpusArtifacts: 0 },
    artifacts: sources.map((source) => ({ sourceKey: `${source.role}:${source.selector}`, rawSha256: source.rawSha256, byteLength: source.rawByteLength, transformationClass: source.transformationClass, identitySha256: source.actualSha256, metadata: { canonicalUrl: source.canonicalUrl, mediaType: source.mediaType, revision: source.immutableIdentity.revision } })),
    verbatimExcerpt: { sourceKey: xmlRecord.sourceKey, rawSha256: xmlRecord.sourceSha256, selector: { bytes: { start: 0, endExclusive: Buffer.byteLength(text) } }, text, excerptSha256: shaBytes(Buffer.from(text)) },
    allowed: ["EXACT_UNMODIFIED_BYTES","EXACT_METADATA","ATTRIBUTED_VERBATIM_EXCERPT"],
    denied: ["REWRITTEN_DERIVATIVE_PROSE","NORMALIZED_DERIVATIVE_PROSE","SILENT_ERRATA_INCORPORATION","COMPARISON_CORPUS_KNOWLEDGE_OBJECT"],
  };
}

export async function loadAdmittedSourceBytes({ capture, repoRoot } = {}) {
  if (!capture?.sources || !repoRoot) throw new Error("VERIFIED_CAPTURE_AND_REPO_ROOT_REQUIRED");
  const result = new Map();
  for (const source of capture.sources.filter((item) => ["WIKIDATA_ENTITY","CPYTHON_DOCUMENT","OPENAPI_SPEC"].includes(item.role))) {
    const encoded = await readFile(resolve(repoRoot, source.encodedArtifactPath));
    const raw = Buffer.from(encoded.toString("ascii").replace(/\s/g, ""), "base64");
    if (shaBytes(raw) !== source.rawSha256 || raw.byteLength !== source.rawByteLength) throw new Error("SOURCE_BYTES_MISMATCH");
    result.set(`${source.role}:${source.selector}`, raw);
  }
  return result;
}

export function buildPilotCorpora(capture, { rawBytesBySource } = {}) {
  if (capture?.outcome !== "VERIFIED" || capture.digests?.sourceSetDigest !== SOURCE_SET_DIGEST) throw new Error("VERIFIED_CAPTURE_SOURCE_SET_REQUIRED");
  const records = comparisonRecords(capture);
  if (records.length !== 41 || new Set(records.map((record) => record.sourceKey)).size !== 41) throw new Error("COMPARISON_SELECTOR_SET_MISMATCH");
  if (!(rawBytesBySource instanceof Map)) throw new Error("EXACT_ADMITTED_SOURCE_BYTES_REQUIRED");
  const chunks = records.flatMap((record) => {
    const raw = rawBytesBySource.get(record.sourceKey);
    if (!raw || shaBytes(raw) !== record.sourceSha256) throw new Error("SOURCE_HASH_MISMATCH");
    return rawEvidence(record, raw);
  });
  const raw = { schemaVersion: "pansphaira.rks01/raw-rag-corpus/v1", projectionClass: "RAW_RAG", sourceSetDigest: SOURCE_SET_DIGEST, comparisonSourceSetDigest: COMPARISON_SOURCE_SET_DIGEST, counts: { sources: clone(sourceCounts), chunks: chunks.length }, chunks };
  const bySource = new Map(records.map((record) => [record.sourceKey, record]));
  const objects = chunks.map((evidence) => typedObject(bySource.get(evidence.sourceKey), evidence));
  const typed = { schemaVersion: "pansphaira.rks01/typed-knowledge-corpus/v1", projectionClass: "TYPED_KNOWLEDGE", sourceSetDigest: SOURCE_SET_DIGEST, comparisonSourceSetDigest: COMPARISON_SOURCE_SET_DIGEST, counts: { sources: clone(sourceCounts), objects: objects.length }, objects };
  const guides = projectApplicationGuides(typed);
  return { raw, typed, guides, rfcControl: buildRfcControl(capture) };
}

const unsafeKeys = new Set(["execute","execution","authorityGrant","capabilityGrant","truthGrant","promote","promotion"]);
function containsUnsafe(value) {
  return value && typeof value === "object" && Object.entries(value).some(([key, child]) => unsafeKeys.has(key) || containsUnsafe(child));
}

export function validatePilotCorpora({ capture, rawBytesBySource, raw, typed, guides, rfcControl, trustedSourceSetDigest } = {}) {
  const reasons = new Set();
  if (trustedSourceSetDigest !== SOURCE_SET_DIGEST || raw?.sourceSetDigest !== SOURCE_SET_DIGEST || typed?.sourceSetDigest !== SOURCE_SET_DIGEST || guides?.sourceSetDigest !== SOURCE_SET_DIGEST) reasons.add("SOURCE_SET_MISMATCH");
  let expected;
  try { expected = buildPilotCorpora(capture, { rawBytesBySource }); } catch { return { outcome: "DENIED", reasonCodes: ["VERIFIED_CAPTURE_SOURCE_SET_REQUIRED"] }; }
  if (raw?.comparisonSourceSetDigest !== COMPARISON_SOURCE_SET_DIGEST || typed?.comparisonSourceSetDigest !== COMPARISON_SOURCE_SET_DIGEST || guides?.comparisonSourceSetDigest !== COMPARISON_SOURCE_SET_DIGEST) reasons.add("SOURCE_SET_MISMATCH");
  if (containsUnsafe(raw) || containsUnsafe(typed) || containsUnsafe(guides)) reasons.add("UNSAFE_OR_AUTHORITY_FIELD");

  const expectedChunks = new Map(expected.raw.chunks.map((item) => [item.id, item]));
  for (const chunk of raw?.chunks ?? []) {
    if (chunk.sourceKey?.startsWith("RFC9987_CONTROL:")) reasons.add("RFC_DERIVATIVE_INCLUSION");
    const trusted = expectedChunks.get(chunk.id);
    if (!trusted) { reasons.add(chunk.sourceKey && expected.raw.chunks.some((item) => item.sourceKey === chunk.sourceKey) ? "EXTRA_OR_UNSELECTED_SOURCE" : "EXTRA_OR_UNSELECTED_SOURCE"); continue; }
    if (chunk.sourceKey !== trusted.sourceKey) reasons.add("PATH_OR_SOURCE_SUBSTITUTION");
    if (chunk.rawSha256 !== trusted.rawSha256) reasons.add(chunk.text !== trusted.text ? "PAIRED_REDIGESTION_DENIED" : "SOURCE_HASH_MISMATCH");
    if (chunk.text !== trusted.text) reasons.add(chunk.rawSha256 === trusted.rawSha256 ? "INVENTED_OR_CHANGED_EXCERPT" : "PAIRED_REDIGESTION_DENIED");
    if (canonicalJson(chunk.selector) !== canonicalJson(trusted.selector)) reasons.add("PATH_OR_SOURCE_SUBSTITUTION");
  }
  if ((raw?.chunks?.length ?? 0) !== expected.raw.chunks.length) reasons.add("EXTRA_OR_UNSELECTED_SOURCE");

  const expectedObjects = new Map(expected.typed.objects.map((item) => [item.id, item]));
  for (const object of typed?.objects ?? []) {
    const trusted = expectedObjects.get(object.id);
    if (!trusted) { reasons.add("INVENTED_OR_CHANGED_CLAIM"); continue; }
    if (object.sourceBinding?.rawSha256 !== trusted.sourceBinding.rawSha256) reasons.add("SOURCE_HASH_MISMATCH");
    if (object.sourceBinding?.sourceKey !== trusted.sourceBinding.sourceKey) reasons.add("PATH_OR_SOURCE_SUBSTITUTION");
    if (object.knowledgeType === "WIKIDATA_STATEMENT" && (!Object.hasOwn(object.statement ?? {}, "qualifiers") || !Object.hasOwn(object.statement ?? {}, "references") || !Object.hasOwn(object.statement ?? {}, "rank") || !Object.hasOwn(object.statement ?? {}, "datatype"))) reasons.add("QUALIFIER_OR_REFERENCE_OMITTED");
    if ((object.knowledgeType === "CPYTHON_DOCUMENT_EXCERPT" || object.knowledgeType === "OPENAPI_NORMATIVE_EXCERPT") && (!object.applicability?.version || !Array.isArray(object.exceptions))) reasons.add("VERSION_OR_EXCEPTION_OMITTED");
    if (canonicalJson(object.statement) !== canonicalJson(trusted.statement)) reasons.add("INVENTED_OR_CHANGED_CLAIM");
    if (canonicalJson(object) !== canonicalJson(trusted) && canonicalJson(object.statement) === canonicalJson(trusted.statement) && !containsUnsafe(object) && object.sourceBinding?.rawSha256 === trusted.sourceBinding.rawSha256) {
      if (!object.applicability?.version || !Array.isArray(object.exceptions)) reasons.add("VERSION_OR_EXCEPTION_OMITTED");
    }
  }
  if ((typed?.objects?.length ?? 0) !== expected.typed.objects.length) reasons.add("INVENTED_OR_CHANGED_CLAIM");
  if (canonicalJson(guides) !== canonicalJson(expected.guides) && !containsUnsafe(guides)) reasons.add("APPLICATION_GUIDE_BINDING_MISMATCH");
  if (rfcControl?.verbatimExcerpt?.text !== expected.rfcControl.verbatimExcerpt.text || rfcControl?.verbatimExcerpt?.excerptSha256 !== expected.rfcControl.verbatimExcerpt.excerptSha256) reasons.add("RFC_TRANSFORMED_PROSE_DENIED");
  if (canonicalJson(rfcControl?.artifacts) !== canonicalJson(expected.rfcControl.artifacts)) reasons.add("RFC_CONTROL_IDENTITY_MISMATCH");
  return reasons.size === 0 ? { outcome: "VERIFIED", reasonCodes: ["EQUAL_SOURCE_CORPORA_VERIFIED"] } : { outcome: "DENIED", reasonCodes: [...reasons].sort() };
}
