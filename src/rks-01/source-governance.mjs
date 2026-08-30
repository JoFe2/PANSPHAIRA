import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(moduleDir, "../..");

export const GOVERNANCE_SCHEMA_PATHS = Object.freeze([
  "contracts/rks-01/source-profile-v1.schema.json",
  "contracts/rks-01/source-snapshot-v1.schema.json",
  "contracts/rks-01/source-admission-decision-v1.schema.json",
  "contracts/rks-01/knowledge-ingestion-candidate-v1.schema.json",
  "contracts/rks-01/knowledge-promotion-receipt-v1.schema.json",
  "contracts/rks-01/source-drift-event-v1.schema.json",
]);

const RECORD_NAMES = Object.freeze(["profile", "snapshot", "admission", "candidate", "promotion", "drift"]);
const DIGEST_FIELDS = Object.freeze({
  profile: "profileDigest",
  snapshot: "snapshotDigest",
  admission: "admissionDigest",
  candidate: "candidateDigest",
  promotion: "receiptDigest",
  drift: "eventDigest",
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Bytes(bytes) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) throw new TypeError("bytes must be a Buffer or Uint8Array");
  return createHash("sha256").update(bytes).digest("hex");
}

function recordDigest(record, field) {
  const unsigned = structuredClone(record);
  delete unsigned[field];
  return sha256Bytes(Buffer.from(canonicalJson(unsigned)));
}

function compileValidators(repoRoot = defaultRepoRoot) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return GOVERNANCE_SCHEMA_PATHS.map((path) => ajv.compile(JSON.parse(readFileSync(resolve(repoRoot, path), "utf8"))));
}

let defaultValidators;
function validatorsFor(repoRoot) {
  if (!repoRoot || repoRoot === defaultRepoRoot) return defaultValidators ??= compileValidators(defaultRepoRoot);
  return compileValidators(repoRoot);
}

export async function validateGovernanceSchemas(bundle, { repoRoot = defaultRepoRoot } = {}) {
  let validators;
  try {
    validators = validatorsFor(repoRoot);
  } catch (error) {
    return { valid: false, errors: [{ record: "schemas", message: error.message }] };
  }
  const errors = [];
  for (let index = 0; index < RECORD_NAMES.length; index += 1) {
    const valid = validators[index](bundle?.[RECORD_NAMES[index]]);
    if (!valid) {
      errors.push(...(validators[index].errors ?? []).map((error) => ({ record: RECORD_NAMES[index], instancePath: error.instancePath, keyword: error.keyword, message: error.message })));
    }
  }
  return { valid: errors.length === 0, errors };
}

function validateSchemasSync(bundle) {
  const validators = validatorsFor();
  return RECORD_NAMES.every((name, index) => validators[index](bundle?.[name]));
}

function copyLegal(target, legal) {
  target.licenseDecision ??= legal.licenseDecision;
  target.licenseId ??= legal.licenseId;
  target.transformationClass ??= legal.transformationClass;
  target.notice ??= legal.notice;
  target.attribution ??= structuredClone(legal.attribution);
  target.obligations ??= structuredClone(legal.obligations);
}

/**
 * Test/build adapter that derives every digest from canonical record content.
 * It does not admit, validate, promote, fetch, persist, or trust anything.
 */
export function sealGovernanceBundle(core, { sourceBytes, candidateBytes, preserveObservedDigest = false } = {}) {
  if (!Buffer.isBuffer(sourceBytes) || !Buffer.isBuffer(candidateBytes)) throw new TypeError("exact sourceBytes and candidateBytes Buffers are required");
  const bundle = structuredClone(core);
  const { profile, snapshot, admission, candidate, promotion, drift } = bundle;

  profile.profileDigest = recordDigest(profile, "profileDigest");

  Object.assign(snapshot, {
    profileId: profile.profileId,
    profileDigest: profile.profileDigest,
    sourceBytesSha256: sha256Bytes(sourceBytes),
    byteLength: sourceBytes.byteLength,
  });
  snapshot.snapshotDigest = recordDigest(snapshot, "snapshotDigest");

  Object.assign(admission, {
    profileId: profile.profileId,
    profileDigest: profile.profileDigest,
    snapshotId: snapshot.snapshotId,
    snapshotDigest: snapshot.snapshotDigest,
  });
  copyLegal(admission, profile.legal);
  admission.admissionDigest = recordDigest(admission, "admissionDigest");

  Object.assign(candidate, {
    profileDigest: profile.profileDigest,
    snapshotDigest: snapshot.snapshotDigest,
    admissionDigest: admission.admissionDigest,
    sourceBytesSha256: snapshot.sourceBytesSha256,
    candidateBytesSha256: sha256Bytes(candidateBytes),
  });
  copyLegal(candidate, profile.legal);
  candidate.candidateDigest = recordDigest(candidate, "candidateDigest");

  Object.assign(promotion, {
    candidateId: candidate.candidateId,
    candidateDigest: candidate.candidateDigest,
    admissionDigest: admission.admissionDigest,
    snapshotDigest: snapshot.snapshotDigest,
  });
  promotion.receiptDigest = recordDigest(promotion, "receiptDigest");

  Object.assign(drift, {
    profileDigest: profile.profileDigest,
    snapshotDigest: snapshot.snapshotDigest,
  });
  if (!preserveObservedDigest || !drift.observedSourceBytesSha256) drift.observedSourceBytesSha256 = snapshot.sourceBytesSha256;
  drift.eventDigest = recordDigest(drift, "eventDigest");
  return bundle;
}

function denied(...reasonCodes) {
  return { outcome: "DENIED", reasonCodes };
}

function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function digestChecks(bundle) {
  for (const name of RECORD_NAMES) {
    const field = DIGEST_FIELDS[name];
    if (recordDigest(bundle[name], field) !== bundle[name][field]) return `${name.toUpperCase()}_DIGEST_INVALID`;
  }
  return null;
}

export function verifyGovernanceBundle(bundle, options = {}) {
  if (Object.hasOwn(options, "expectedDigests")) return denied("CALLER_EXPECTED_DIGEST_FORBIDDEN");
  if (!Buffer.isBuffer(options.sourceBytes) || !Buffer.isBuffer(options.candidateBytes)) return denied("EXACT_BYTES_REQUIRED");
  if (!(options.trustedProfiles instanceof Map) || !(options.trustedAdmissions instanceof Map) || typeof options.trustedNow !== "string") return denied("TRUST_CONTEXT_REQUIRED");
  if (!validateSchemasSync(bundle)) return denied("SCHEMA_INVALID");

  const { profile, snapshot, admission, candidate, promotion, drift } = bundle;
  if (options.trustedProfiles.get(profile.profileId) !== profile.profileDigest) return denied("TRUSTED_PROFILE_DIGEST_MISMATCH");
  if (options.trustedAdmissions.get(admission.decisionId) !== admission.admissionDigest) return denied("TRUSTED_ADMISSION_DIGEST_MISMATCH");
  if (drift.previousEventDigest !== (options.trustedPreviousDriftDigest ?? null)) return denied("DRIFT_HISTORY_REWRITE");

  if (!sameJson(snapshot.immutableIdentity, profile.immutableIdentity)
      || snapshot.canonicalUrl !== profile.canonicalUrl
      || snapshot.mediaType !== profile.mediaType
      || !sameJson(snapshot.parser, profile.parser)
      || !sameJson(snapshot.canonicalizer, profile.canonicalizer)) return denied("PROFILE_SNAPSHOT_BINDING_MISMATCH");

  if (candidate.notice !== profile.legal.notice
      || !sameJson(candidate.attribution, profile.legal.attribution)
      || !sameJson(candidate.obligations, profile.legal.obligations)
      || admission.notice !== profile.legal.notice
      || !sameJson(admission.attribution, profile.legal.attribution)
      || !sameJson(admission.obligations, profile.legal.obligations)) return denied("CANDIDATE_OBLIGATION_LOSS");

  if (admission.transformationClass !== profile.legal.transformationClass) return denied("ADMISSION_TRANSFORMATION_MISMATCH");
  if (candidate.transformationClass !== admission.transformationClass) {
    return denied(profile.legal.transformationClass === "UNMODIFIED_ONLY" ? "TRANSFORMATION_CLASS_WIDENING" : "TRANSFORMATION_CLASS_MISMATCH");
  }
  if (profile.legal.transformationClass === "UNMODIFIED_ONLY" && sha256Bytes(options.candidateBytes) !== sha256Bytes(options.sourceBytes)) return denied("UNMODIFIED_BYTES_REQUIRED");

  const invalidDigest = digestChecks(bundle);
  if (invalidDigest) return denied(invalidDigest);
  if (snapshot.sourceBytesSha256 !== sha256Bytes(options.sourceBytes) || snapshot.byteLength !== options.sourceBytes.byteLength) return denied("SOURCE_BYTES_MISMATCH");
  if (candidate.candidateBytesSha256 !== sha256Bytes(options.candidateBytes)) return denied("CANDIDATE_BYTES_MISMATCH");

  if (snapshot.profileDigest !== profile.profileDigest
      || admission.profileDigest !== profile.profileDigest
      || candidate.profileDigest !== profile.profileDigest
      || drift.profileDigest !== profile.profileDigest
      || admission.snapshotDigest !== snapshot.snapshotDigest
      || candidate.snapshotDigest !== snapshot.snapshotDigest
      || promotion.snapshotDigest !== snapshot.snapshotDigest
      || drift.snapshotDigest !== snapshot.snapshotDigest
      || candidate.admissionDigest !== admission.admissionDigest
      || promotion.admissionDigest !== admission.admissionDigest
      || promotion.candidateDigest !== candidate.candidateDigest
      || promotion.candidateId !== candidate.candidateId) return denied("LINEAGE_BINDING_MISMATCH");

  if (Date.parse(options.trustedNow) > Date.parse(admission.validUntil) || Date.parse(options.trustedNow) > Date.parse(promotion.revalidateBy)) return denied("REVALIDATION_STALE");
  if (Date.parse(promotion.revalidateBy) > Date.parse(admission.validUntil)) return denied("REVALIDATION_WINDOW_WIDENED");
  if (drift.observedSourceBytesSha256 !== snapshot.sourceBytesSha256 || drift.classification === "DRIFT_DETECTED") return denied("REVALIDATION_REQUIRED");

  return {
    outcome: "VERIFIED",
    reasonCodes: ["SOURCE_GOVERNANCE_CHAIN_VERIFIED"],
    profileDigest: profile.profileDigest,
    snapshotDigest: snapshot.snapshotDigest,
    candidateDigest: candidate.candidateDigest,
    promotionReceiptDigest: promotion.receiptDigest,
    driftEventDigest: drift.eventDigest,
    replayDigest: sha256Bytes(Buffer.from(canonicalJson(bundle))),
  };
}
