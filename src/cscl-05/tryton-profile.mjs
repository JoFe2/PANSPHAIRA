import { createHash, createPublicKey, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

import { freezeProtocol } from "../cscl-01/protocol.mjs";

const BOUNDARY = Object.freeze({ authorityGrant: "NONE", promotionGrant: "NONE", executionGrant: "NONE" });
const FAMILIES = Object.freeze([
  "PARTY_CUSTOMER_MANAGEMENT",
  "PRODUCT_ITEM_MANAGEMENT",
  "SALES_ORDER_MANAGEMENT",
]);
const QUESTION_IDS = Object.freeze([
  "objects-roles", "relations", "operations", "inputs-outputs",
  "states-transitions", "events", "preconditions", "invariants",
  "exceptions-errors", "readbacks", "api-service-exposure",
  "absence-ambiguity-conflict",
]);
const FIXTURE_ROOT = "tests/fixtures/cscl-05";
const OFFICIAL_BASE = "https://downloads.tryton.org/8.0/";
const OFFICIAL_KEY = "https://downloads.tryton.org/signify/8.0.pub";
const MAX_CAPTURE_BYTES = 20 * 1024 * 1024;
const NO_CANDIDATE_DIGEST = sha256Bytes(Buffer.from("NO_CANDIDATE_DERIVATION_CSCL05_SOURCE_PROFILE_ONLY"));

function encodeCanonical(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(encodeCanonical).join(",")}]`;
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => {
      if (value[key] === undefined) throw new Error("UNSAFE_CANONICAL_VALUE");
      return `${JSON.stringify(key)}:${encodeCanonical(value[key])}`;
    }).join(",")}}`;
  }
  throw new Error("UNSAFE_CANONICAL_VALUE");
}

export function canonicalJson(value) {
  return encodeCanonical(value);
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function digestRecord(record, digestField) {
  const unsigned = structuredClone(record);
  delete unsigned[digestField];
  return sha256Bytes(Buffer.from(canonicalJson(unsigned)));
}

function parseOctal(bytes) {
  const text = bytes.toString("ascii").replaceAll("\0", "").trim();
  if (!text) return 0;
  if (!/^[0-7]+$/.test(text)) throw new Error("UNSAFE_TAR_NUMERIC_FIELD");
  return Number.parseInt(text, 8);
}

function tarMembers(gzipBytes) {
  const tar = gunzipSync(gzipBytes);
  const members = [];
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const storedChecksum = parseOctal(header.subarray(148, 156));
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    const actualChecksum = checksumHeader.reduce((sum, byte) => sum + byte, 0);
    if (storedChecksum !== actualChecksum) throw new Error("UNSAFE_TAR_HEADER_CHECKSUM");
    const namePart = header.subarray(0, 100).toString("utf8").replace(/\0.*$/s, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/s, "");
    const name = prefix ? `${prefix}/${namePart}` : namePart;
    const size = parseOctal(header.subarray(124, 136));
    const type = String.fromCharCode(header[156] || 0x30);
    const linkName = header.subarray(157, 257).toString("utf8").replace(/\0.*$/s, "");
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > tar.length) throw new Error("UNSAFE_TAR_TRUNCATED_MEMBER");
    members.push({ name, size, type, linkName, bytes: tar.subarray(dataStart, dataEnd) });
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return members;
}

function assertSafeMembers(members) {
  for (const member of members) {
    if (!member.name || member.name.startsWith("/") || member.name.split("/").includes("..") || member.name.includes("\\"))
      throw new Error(`UNSAFE_ARCHIVE_TRAVERSAL:${member.name}`);
    if (!["0", "5"].includes(member.type)) throw new Error(`UNSAFE_ARCHIVE_MEMBER_TYPE:${member.name}`);
    if (member.linkName) throw new Error(`UNSAFE_ARCHIVE_LINK:${member.name}`);
  }
}

function parseSignifyPublicKey(bytes) {
  const lines = bytes.toString("utf8").trimEnd().split("\n");
  if (lines.length !== 2 || lines[0] !== "untrusted comment: signify public key") throw new Error("SIGNIFY_KEY_FORMAT_INVALID");
  const decoded = Buffer.from(lines[1], "base64");
  if (decoded.length !== 42 || decoded.subarray(0, 2).toString("ascii") !== "Ed") throw new Error("SIGNIFY_KEY_FORMAT_INVALID");
  return { keyId: decoded.subarray(2, 10), publicKey: decoded.subarray(10) };
}

function parseSignifySignature(bytes) {
  const lines = bytes.toString("utf8").trimEnd().split("\n");
  if (lines.length !== 2 || lines[0] !== "untrusted comment: verify with 8.0.pub") throw new Error("SIGNATURE_FORMAT_INVALID");
  const decoded = Buffer.from(lines[1], "base64");
  if (decoded.length !== 74 || decoded.subarray(0, 2).toString("ascii") !== "Ed") throw new Error("SIGNATURE_FORMAT_INVALID");
  return { keyId: decoded.subarray(2, 10), signature: decoded.subarray(10) };
}

function verifySignify(bytes, signatureBytes, keyBytes) {
  const key = parseSignifyPublicKey(keyBytes);
  const signature = parseSignifySignature(signatureBytes);
  if (!key.keyId.equals(signature.keyId)) throw new Error("SIGNATURE_KEY_ID_MISMATCH");
  const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), key.publicKey]);
  const publicKey = createPublicKey({ key: spki, format: "der", type: "spki" });
  if (!verify(null, bytes, publicKey, signature.signature)) throw new Error("DETACHED_SIGNATURE_INVALID");
  return key.keyId.toString("hex");
}

function expectedIndexLine(indexText, name, digest) {
  const matches = indexText.split(/\r?\n/).filter((line) => line === `${digest} *${name}` || line === `${digest}  ${name}`);
  if (matches.length !== 1) throw new Error(`CHECKSUM_INDEX_ENTRY_INVALID:${name}`);
}

export async function validateTrytonCapture({ repoRoot, captureDir, sourceBaseUrl = OFFICIAL_BASE, keyUrl = OFFICIAL_KEY, testMutation = null }) {
  const manifest = await readJson(resolve(repoRoot, FIXTURE_ROOT, "source-members-v1.json"));
  if (sourceBaseUrl !== OFFICIAL_BASE || keyUrl !== OFFICIAL_KEY || testMutation === "mirror") throw new Error("OFFICIAL_MIRROR_SUBSTITUTION_DENIED");
  if (manifest.officialBaseUrl !== OFFICIAL_BASE || manifest.signifyKey.url !== OFFICIAL_KEY || manifest.mirrorPolicy !== "DENY_EVEN_BYTE_EQUIVALENT")
    throw new Error("FROZEN_OFFICIAL_SOURCE_DRIFT");

  let indexBytes = await readFile(resolve(captureDir, "SHA256"));
  let keyBytes = await readFile(resolve(captureDir, "8.0.pub"));
  if (testMutation === "indexDigest") indexBytes = Buffer.concat([indexBytes, Buffer.from("x")]);
  if (sha256Bytes(indexBytes) !== manifest.checksumIndex.sha256 || indexBytes.length !== manifest.checksumIndex.byteLength)
    throw new Error("CHECKSUM_INDEX_DIGEST_OR_LENGTH_MISMATCH");
  if (sha256Bytes(keyBytes) !== manifest.signifyKey.sha256 || keyBytes.length !== manifest.signifyKey.byteLength)
    throw new Error("SIGNIFY_KEY_DIGEST_OR_LENGTH_MISMATCH");
  if (testMutation === "wrongKey") keyBytes = Buffer.from(keyBytes.map((byte, index) => index === keyBytes.length - 2 ? byte ^ 1 : byte));

  let totalBytes = indexBytes.length + keyBytes.length;
  const verified = [];
  const archiveMembers = new Map();
  for (let index = 0; index < manifest.artifacts.length; index += 1) {
    const artifact = manifest.artifacts[index];
    if (artifact.url !== `${OFFICIAL_BASE}${artifact.name}` || artifact.signature.url !== `${OFFICIAL_BASE}${artifact.name}.sig`)
      throw new Error("OFFICIAL_ARTIFACT_URL_DRIFT");
    let bytes = await readFile(resolve(captureDir, artifact.name));
    let signatureBytes;
    try {
      signatureBytes = await readFile(resolve(captureDir, `${artifact.name}.sig`));
    } catch (error) {
      throw new Error(`CAPTURE_SIGNATURE_MISSING:${artifact.name}`, { cause: error });
    }
    if (testMutation === "missingSignature" && index === 0) throw new Error("CAPTURE_SIGNATURE_MISSING");
    if (testMutation === "artifactDigest" && index === 0) bytes = Buffer.concat([bytes, Buffer.from("x")]);
    if (testMutation === "signatureDigest" && index === 0) signatureBytes = Buffer.concat([signatureBytes, Buffer.from("x")]);
    if (bytes.length !== artifact.byteLength || sha256Bytes(bytes) !== artifact.sha256) throw new Error(`ARTIFACT_DIGEST_OR_LENGTH_MISMATCH:${artifact.name}`);
    if (signatureBytes.length !== artifact.signature.byteLength || sha256Bytes(signatureBytes) !== artifact.signature.sha256)
      throw new Error(`SIGNATURE_DIGEST_OR_LENGTH_MISMATCH:${artifact.name}`);
    const indexText = indexBytes.toString("utf8");
    expectedIndexLine(indexText, artifact.name, artifact.sha256);
    expectedIndexLine(indexText, `${artifact.name}.sig`, artifact.signature.sha256);
    if (testMutation === "signedTarball" && index === 0) bytes = Buffer.from(bytes.map((byte, position) => position === bytes.length - 1 ? byte ^ 1 : byte));
    const keyId = verifySignify(bytes, signatureBytes, keyBytes);
    let members = tarMembers(bytes);
    if (testMutation === "traversal" && index === 0) members = [...members, { name: "../escape", size: 0, type: "0", linkName: "", bytes: Buffer.alloc(0) }];
    if (testMutation === "symlink" && index === 0) members = [...members, { name: "safe-link", size: 0, type: "2", linkName: "/etc/passwd", bytes: Buffer.alloc(0) }];
    assertSafeMembers(members);
    archiveMembers.set(artifact.name, members);
    totalBytes += bytes.length + signatureBytes.length;
    verified.push({ name: artifact.name, byteLength: bytes.length, sha256: sha256Bytes(bytes), signatureSha256: sha256Bytes(signatureBytes), keyId });
  }
  if (testMutation === "cap") totalBytes = MAX_CAPTURE_BYTES + 1;
  if (totalBytes > manifest.captureCapBytes || totalBytes > MAX_CAPTURE_BYTES) throw new Error("CAPTURE_SIZE_CAP_EXCEEDED");
  return {
    schemaVersion: "pansphaira.cscl05/capture-verification/v1",
    artifacts: verified,
    signaturesVerified: verified.length,
    signatureScope: "DETACHED_SIGNATURE_OVER_EXACT_TARBALL_BYTES",
    key: manifest.signifyKey,
    checksumIndex: manifest.checksumIndex,
    totalBytes,
    mirrorSubstitution: "DENIED",
    archiveMembers,
  };
}

export async function buildTrytonProfile({ repoRoot, overrides = {}, memberOverrides = {} }) {
  const allowedOverrides = new Set(["selectorDigest", "questionDigest", "parserVersion", "canonicalizerVersion"]);
  for (const key of Object.keys(overrides)) if (!allowedOverrides.has(key)) throw new Error(`EXTRA_OVERRIDE_FORBIDDEN:${key}`);

  const protocol = await freezeProtocol({ repoRoot });
  const selectorDigest = protocol.digests.selectors;
  const questionDigest = protocol.digests.questions;
  const fixtureRoot = resolve(repoRoot, FIXTURE_ROOT);
  const manifest = await readJson(resolve(fixtureRoot, "source-members-v1.json"));
  const blueprint = await readJson(resolve(fixtureRoot, "profile-blueprint-v1.json"));
  const expected = { selectorDigest, questionDigest, parserVersion: blueprint.parserVersion, canonicalizerVersion: blueprint.canonicalizerVersion };
  for (const [key, value] of Object.entries(overrides)) if (value !== expected[key]) throw new Error(`FROZEN_${key.toUpperCase()}_DRIFT`);

  const capture = await validateTrytonCapture({ repoRoot, captureDir: resolve(fixtureRoot, "artifacts") });
  const memberByName = new Map();
  for (const member of manifest.members) {
    const archive = capture.archiveMembers.get(member.archive);
    const archived = archive?.find((entry) => entry.name === member.member);
    if (!archived || archived.type !== "0") throw new Error(`MEMBER_MISSING_OR_UNSAFE:${member.member}`);
    let raw = await readFile(memberOverrides[member.member] ?? resolve(fixtureRoot, member.storedAs));
    if (raw.length !== member.rawLength || sha256Bytes(raw) !== member.rawSha256) throw new Error(`MEMBER_DIGEST_OR_LENGTH_MISMATCH:${member.member}`);
    if (!raw.equals(archived.bytes)) throw new Error(`MEMBER_ARCHIVE_IDENTITY_MISMATCH:${member.member}`);
    memberByName.set(member.member, { ...member, raw });
  }

  const coordinates = new Set();
  const facts = [];
  const cells = [];
  const cellIndex = [];
  const legal = {
    licenseId: "GPL-3.0-or-later",
    licenseSha256: "8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903",
    obligations: ["PRESERVE_LICENSE_AND_COPYRIGHT_NOTICES", "LICENSE_COVERED_DERIVATIVES_UNDER_GPL", "PROVIDE_CORRESPONDING_SOURCE_WHEN_CONVEYING", "MARK_MODIFICATIONS"],
    noticeStatus: "PRESENT",
    noticeUrl: "https://downloads.tryton.org/8.0/trytond-8.0.9.tar.gz#trytond-8.0.9/COPYRIGHT",
    noticeBytes: 1034,
    noticeSha256: "9dba3cb9bcf2bdec5ef1deeef176cfc0cb47f027a8e710cfb31ba4c14458a112",
    attribution: [],
  };
  for (const spec of blueprint.cells) {
    const coordinate = `${spec.family}:${spec.questionId}`;
    if (coordinates.has(coordinate) || !FAMILIES.includes(spec.family) || !QUESTION_IDS.includes(spec.questionId)) throw new Error(`CELL_COORDINATE_INVALID:${coordinate}`);
    coordinates.add(coordinate);
    const member = memberByName.get(spec.member);
    if (!member) throw new Error(`BLUEPRINT_MEMBER_UNADMITTED:${spec.member}`);
    const needle = Buffer.from(spec.needle);
    const start = member.raw.indexOf(needle);
    if (start < 0 || member.raw.indexOf(needle, start + 1) >= 0) throw new Error(`EVIDENCE_NEEDLE_NOT_UNIQUE:${coordinate}`);
    const end = start + needle.length;
    const excerptSha256 = sha256Bytes(needle);
    const slug = spec.family.toLowerCase().replaceAll("_", "-");
    const factId = `tryton.${slug}.${spec.questionId}`;
    const artifact = manifest.artifacts.find((entry) => entry.name === member.archive);
    const fact = {
      schemaVersion: "pansphaira.cscl01/source-fact/v1",
      factId,
      systemId: "tryton",
      systemRole: "TRAINING",
      capabilityFamily: spec.family,
      questionId: spec.questionId,
      claim: spec.claim,
      sourceIdentity: {
        selectorSetDigest: selectorDigest,
        immutableSelector: `${artifact.name}@sha256:${artifact.sha256}#${member.member}`,
        sourceBytesSha256: member.rawSha256,
      },
      exactEvidence: {
        exactLocator: `${artifact.url}#${member.member}:bytes=${start}-${end}`,
        excerptSha256,
        byteStart: start,
        byteEnd: end,
      },
      legal: structuredClone(legal),
      parser: { id: "cscl05-exact-byte-parser", version: blueprint.parserVersion },
      canonicalizer: { id: "cscl05-canonical-json", version: blueprint.canonicalizerVersion },
      boundary: BOUNDARY,
      factDigest: "",
    };
    fact.factDigest = digestRecord(fact, "factDigest");
    facts.push(fact);
    const nativeMeaningSha256 = sha256Bytes(Buffer.from(spec.claim));
    const schemaCell = {
      schemaVersion: "pansphaira.cscl01/evidence-cell/v1",
      systemId: "tryton",
      questionId: spec.questionId,
      state: spec.state,
      equivalenceProof: { nativeMeaningSha256, candidateMeaningSha256: NO_CANDIDATE_DIGEST },
      evidence: [{ sourceFactId: factId, exactLocator: fact.exactEvidence.exactLocator, excerptSha256 }],
      counterexamples: spec.counterexamples,
      boundary: BOUNDARY,
    };
    const cellDigest = digestRecord(schemaCell, "cellDigest");
    cells.push(schemaCell);
    cellIndex.push({ capabilityFamily: spec.family, questionId: spec.questionId, cellDigest });
  }
  if (coordinates.size !== 36 || FAMILIES.some((family) => QUESTION_IDS.some((question) => !coordinates.has(`${family}:${question}`))))
    throw new Error("MISSING_REQUIRED_CELL");

  const firstFactByFamily = new Map(FAMILIES.map((family) => [family, facts.find((fact) => fact.capabilityFamily === family)]));
  const familyForTerm = (term) => term.startsWith("party.") || term === "Party" ? FAMILIES[0]
    : term.startsWith("product.") || ["Product Template", "Variant", "Default UoM"].includes(term) ? FAMILIES[1] : FAMILIES[2];
  const profile = {
    schemaVersion: "pansphaira.cscl01/system-profile/v1",
    profileId: "tryton.8.0.source-native-profile",
    systemId: "tryton",
    systemRole: "TRAINING",
    selectorSetDigest: selectorDigest,
    questionInventoryDigest: questionDigest,
    sourceFactDigests: facts.map((fact) => fact.factDigest).sort(),
    sourceNativeTerminology: blueprint.terminology.map(([term, meaning]) => ({ term, meaning, sourceFactDigest: firstFactByFamily.get(familyForTerm(term)).factDigest })),
    capabilityFamilies: [...FAMILIES],
    evidenceCells: cellIndex,
    holdoutIsolation: "TRAINING_PROFILE",
    boundary: BOUNDARY,
    profileDigest: "",
  };
  profile.profileDigest = digestRecord(profile, "profileDigest");
  return { facts, cells, profile, sourceMembers: manifest.members.map(({ rawLength, rawSha256, archive, member }) => ({ archive, member, rawLength, rawSha256 })) };
}
