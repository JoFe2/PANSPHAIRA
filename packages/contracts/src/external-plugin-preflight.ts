import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const EXTERNAL_PLUGIN_PREFLIGHT_SCHEMA_V1 =
  "chimpmaera.extension-trust/external-plugin-preflight-request/v1" as const;
export const EXTERNAL_PLUGIN_PREFLIGHT_REPORT_SCHEMA_V1 =
  "chimpmaera.extension-trust/external-plugin-preflight-report/v1" as const;
export const EXTERNAL_PLUGIN_PREFLIGHT_CLAIM_BOUNDARY_V1 =
  "STATIC_EXECUTION_FREE_EVIDENCE_ONLY_NO_PROFILE_CONFORMANCE_NO_ADMISSION_NO_INSTALL_NO_ACTIVATION" as const;

export const EXTERNAL_PLUGIN_PREFLIGHT_SUPPORTED_DSH_V1 = Object.freeze({
  version: "0.1.0-rc.8",
  tag: "dsh-v0.1.0-rc.8",
  commit: "141eb6fef83422698aef7a981029e843e8161534",
  distTag: "next",
});

export const EXTERNAL_PLUGIN_PREFLIGHT_DYNAMIC_GATES_V1 = Object.freeze([
  "DYNAMIC_EXECUTION",
  "ADVERSARIAL_CONTAINMENT",
  "NETWORK_EGRESS_OBSERVATION",
  "PROCESS_EFFECT_OBSERVATION",
  "FILESYSTEM_RESIDUE_OBSERVATION",
  "UNLOAD_ROLLBACK_OBSERVATION",
]);

export type ExternalPluginFormatV1 = "DSH_BUNDLE_PROFILE" | "SKILL" | "MCP_SERVER" | "GENERIC_PACKAGE";
export type ExternalPluginFindingCodeV1 =
  | "INPUT_SCHEMA_DENIED"
  | "SOURCE_MUTABLE_DENIED"
  | "SOURCE_DIGEST_MISMATCH_DENIED"
  | "FILE_DIGEST_MISMATCH_DENIED"
  | "PATH_ESCAPE_DENIED"
  | "SYMLINK_DENIED"
  | "DUPLICATE_PATH_DENIED"
  | "PACKAGE_JSON_INVALID_DENIED"
  | "LICENCE_EVIDENCE_MISMATCH_DENIED"
  | "LOCKFILE_MISSING_DENIED"
  | "TOOLCHAIN_PIN_MISSING_DENIED"
  | "INSTALL_HOOK_DENIED"
  | "MUTABLE_DEPENDENCY_DENIED"
  | "DSH_MANIFEST_MISSING_DENIED"
  | "DSH_PATCH_MISSING_DENIED"
  | "DSH_UPSTREAM_PIN_DENIED"
  | "DYNAMIC_CORDIS_DECLARED_DENIED"
  | "MCP_EXECUTABLE_DECLARED_REVIEW"
  | "NETWORK_EFFECT_DECLARED_REVIEW"
  | "CREDENTIAL_EFFECT_DECLARED_REVIEW"
  | "PROCESS_EFFECT_DECLARED_REVIEW"
  | "FILESYSTEM_EFFECT_DECLARED_REVIEW"
  | "PERSISTENCE_EFFECT_DECLARED_REVIEW"
  | "UNKNOWN_EFFECT_SURFACE_REVIEW";

export interface ExternalPluginPreflightRequestV1 {
  readonly schemaVersion: typeof EXTERNAL_PLUGIN_PREFLIGHT_SCHEMA_V1;
  readonly subject: {
    readonly subjectId: string;
    readonly subjectVersion: string;
    readonly format: ExternalPluginFormatV1;
  };
  readonly source: {
    readonly kind: "PINNED_CONTENT";
    readonly locator: string;
    readonly mutable: false;
    readonly digest: string;
  };
  readonly licence: {
    readonly spdx: string;
    readonly evidenceRef: string;
  };
  readonly compatibility: {
    readonly kind: "NONE" | "DEEPSEEK_HARNESS";
    readonly version: string | null;
    readonly tag: string | null;
    readonly commit: string | null;
    readonly artifactDigest: string | null;
    readonly distTag: string | null;
  };
  readonly files: readonly {
    readonly path: string;
    readonly kind: "FILE" | "SYMLINK";
    readonly mediaType: "application/json" | "text/markdown" | "text/plain" | "text/yaml";
    readonly content: string;
    readonly digest: string;
  }[];
}

export interface ExternalPluginPreflightReportV1 {
  readonly schemaVersion: typeof EXTERNAL_PLUGIN_PREFLIGHT_REPORT_SCHEMA_V1;
  readonly requestDigest: string;
  readonly subjectDigest: string | null;
  readonly format: ExternalPluginFormatV1 | "UNKNOWN";
  readonly verdict: "STATIC_CLEAR" | "REVIEW" | "DENY";
  readonly reasonCodes: readonly ExternalPluginFindingCodeV1[];
  readonly evidenceRefs: readonly string[];
  readonly dynamicGates: readonly {
    readonly gateId: typeof EXTERNAL_PLUGIN_PREFLIGHT_DYNAMIC_GATES_V1[number];
    readonly outcome: "NOT_RUN";
    readonly reason: "EXECUTION_PROHIBITED_IN_STATIC_PREFLIGHT";
  }[];
  readonly etlEligibility: "STATIC_ONLY_NOT_PROFILE_CONFORMANT";
  readonly claimBoundary: typeof EXTERNAL_PLUGIN_PREFLIGHT_CLAIM_BOUNDARY_V1;
}

const DIGEST = /^[a-f0-9]{64}$/;
const ID = /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/;
const PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._@+-]+(?:\/[A-Za-z0-9._@+-]+)*$/;
const MUTABLE_RANGE = /^(?:latest|next|\*|\^|~|>=?|<=?|git\+|https?:|github:|file:|workspace:)/i;
const PACKAGE_MANAGER_PIN = /^(?:npm|pnpm|yarn|bun)@[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/;
const LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock"] as const;

const REASON_ORDER: readonly ExternalPluginFindingCodeV1[] = [
  "INPUT_SCHEMA_DENIED", "SOURCE_MUTABLE_DENIED", "SOURCE_DIGEST_MISMATCH_DENIED",
  "FILE_DIGEST_MISMATCH_DENIED", "PATH_ESCAPE_DENIED", "SYMLINK_DENIED", "DUPLICATE_PATH_DENIED",
  "PACKAGE_JSON_INVALID_DENIED", "LICENCE_EVIDENCE_MISMATCH_DENIED", "LOCKFILE_MISSING_DENIED",
  "TOOLCHAIN_PIN_MISSING_DENIED", "INSTALL_HOOK_DENIED", "MUTABLE_DEPENDENCY_DENIED",
  "DSH_MANIFEST_MISSING_DENIED", "DSH_PATCH_MISSING_DENIED", "DSH_UPSTREAM_PIN_DENIED",
  "DYNAMIC_CORDIS_DECLARED_DENIED", "MCP_EXECUTABLE_DECLARED_REVIEW",
  "NETWORK_EFFECT_DECLARED_REVIEW", "CREDENTIAL_EFFECT_DECLARED_REVIEW",
  "PROCESS_EFFECT_DECLARED_REVIEW", "FILESYSTEM_EFFECT_DECLARED_REVIEW",
  "PERSISTENCE_EFFECT_DECLARED_REVIEW", "UNKNOWN_EFFECT_SURFACE_REVIEW",
];

const DENIALS = new Set<ExternalPluginFindingCodeV1>(REASON_ORDER.filter((code) => code.endsWith("_DENIED")));

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function isSafeJsonData(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
  if (typeof value !== "object" || ancestors.has(value)) return false;
  const next = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return false;
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable
        || !isSafeJsonData(descriptor.value, next)) return false;
    }
    return keys.every((key) => key === "length" || (typeof key === "string" && /^(0|[1-9][0-9]*)$/.test(key)));
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable
      || !isSafeJsonData(descriptor.value, next)) return false;
  }
  return true;
}

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function validRequestShape(value: unknown): value is ExternalPluginPreflightRequestV1 {
  if (!isSafeJsonData(value)
    || !exact(value, ["schemaVersion", "subject", "source", "licence", "compatibility", "files"])
    || value.schemaVersion !== EXTERNAL_PLUGIN_PREFLIGHT_SCHEMA_V1
    || !exact(value.subject, ["subjectId", "subjectVersion", "format"])
    || !ID.test(String(value.subject.subjectId)) || !VERSION.test(String(value.subject.subjectVersion))
    || !["DSH_BUNDLE_PROFILE", "SKILL", "MCP_SERVER", "GENERIC_PACKAGE"].includes(String(value.subject.format))
    || !exact(value.source, ["kind", "locator", "mutable", "digest"])
    || value.source.kind !== "PINNED_CONTENT" || value.source.mutable !== false
    || typeof value.source.locator !== "string" || !/^content\+sha256:[a-f0-9]{64}$/.test(value.source.locator)
    || !DIGEST.test(String(value.source.digest))
    || !exact(value.licence, ["spdx", "evidenceRef"])
    || typeof value.licence.spdx !== "string" || !/^[A-Za-z0-9.+-]{2,40}$/.test(value.licence.spdx)
    || typeof value.licence.evidenceRef !== "string" || !/^artifact:sha256:[a-f0-9]{64}$/.test(value.licence.evidenceRef)
    || !exact(value.compatibility, ["kind", "version", "tag", "commit", "artifactDigest", "distTag"])
    || !["NONE", "DEEPSEEK_HARNESS"].includes(String(value.compatibility.kind))
    || !Array.isArray(value.files) || value.files.length === 0 || value.files.length > 512) return false;
  if (value.compatibility.kind === "NONE"
    && [value.compatibility.version, value.compatibility.tag, value.compatibility.commit,
      value.compatibility.artifactDigest, value.compatibility.distTag].some((item) => item !== null)) return false;
  if (value.compatibility.kind === "DEEPSEEK_HARNESS"
    && (typeof value.compatibility.version !== "string" || typeof value.compatibility.tag !== "string"
      || typeof value.compatibility.commit !== "string" || typeof value.compatibility.artifactDigest !== "string"
      || typeof value.compatibility.distTag !== "string")) return false;
  return value.files.every((file) => exact(file, ["path", "kind", "mediaType", "content", "digest"])
    && typeof file.path === "string" && ["FILE", "SYMLINK"].includes(String(file.kind))
    && ["application/json", "text/markdown", "text/plain", "text/yaml"].includes(String(file.mediaType))
    && typeof file.content === "string" && file.content.length <= 1_000_000 && DIGEST.test(String(file.digest)));
}

export function externalPluginSubjectDigestV1(request: Pick<ExternalPluginPreflightRequestV1, "subject" | "files">): string {
  const files = [...request.files]
    .map(({ path, kind, mediaType, digest: fileDigest }) => ({ path, kind, mediaType, digest: fileDigest }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return digest(canonicalJson({ subject: request.subject, files }));
}

function publicDenied(code: ExternalPluginFindingCodeV1): ExternalPluginPreflightReportV1 {
  return {
    schemaVersion: EXTERNAL_PLUGIN_PREFLIGHT_REPORT_SCHEMA_V1,
    requestDigest: digest(canonicalJson({ schemaVersion: EXTERNAL_PLUGIN_PREFLIGHT_SCHEMA_V1, invalid: true })),
    subjectDigest: null,
    format: "UNKNOWN",
    verdict: "DENY",
    reasonCodes: [code],
    evidenceRefs: [],
    dynamicGates: EXTERNAL_PLUGIN_PREFLIGHT_DYNAMIC_GATES_V1.map((gateId) => ({
      gateId, outcome: "NOT_RUN", reason: "EXECUTION_PROHIBITED_IN_STATIC_PREFLIGHT",
    })),
    etlEligibility: "STATIC_ONLY_NOT_PROFILE_CONFORMANT",
    claimBoundary: EXTERNAL_PLUGIN_PREFLIGHT_CLAIM_BOUNDARY_V1,
  };
}

function scanText(text: string, add: (code: ExternalPluginFindingCodeV1) => void): void {
  if (/(?:https?:\/\/|\bfetch\s*\(|\bwebsocket\b|\bnetwork\b)/i.test(text)) add("NETWORK_EFFECT_DECLARED_REVIEW");
  if (/(?:process\.env|credential|password|secret|api[_ -]?key|bearer\s+)/i.test(text)) add("CREDENTIAL_EFFECT_DECLARED_REVIEW");
  if (/(?:child_process|\bexec(?:File)?\s*\(|\bspawn\s*\(|\bshell\b)/i.test(text)) add("PROCESS_EFFECT_DECLARED_REVIEW");
  if (/(?:\.\.\/|\bfs\.(?:write|append|rm|unlink|rename)|filesystem)/i.test(text)) add("FILESYSTEM_EFFECT_DECLARED_REVIEW");
  if (/(?:cron|daemon|autostart|startup|persistence|service\s+install)/i.test(text)) add("PERSISTENCE_EFFECT_DECLARED_REVIEW");
  if (/(?:tool-cordis|dynamic\s+cordis|model-mountable\s+cordis)/i.test(text)) add("DYNAMIC_CORDIS_DECLARED_DENIED");
}

function scanJson(value: unknown, add: (code: ExternalPluginFindingCodeV1) => void): void {
  if (Array.isArray(value)) return value.forEach((item) => scanJson(item, add));
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[ .-]+/g, "_").toLowerCase();
    if (["command", "args"].includes(normalized)) add("MCP_EXECUTABLE_DECLARED_REVIEW");
    if (["url", "uri", "endpoint"].includes(normalized)) add("NETWORK_EFFECT_DECLARED_REVIEW");
    if (["env", "environment", "headers", "authorization"].includes(normalized)) add("CREDENTIAL_EFFECT_DECLARED_REVIEW");
    scanJson(item, add);
  }
}

export function evaluateExternalPluginPreflightV1(value: unknown): ExternalPluginPreflightReportV1 {
  if (!validRequestShape(value)) return publicDenied("INPUT_SCHEMA_DENIED");
  const requestDigest = digest(canonicalJson({
    ...value,
    files: [...value.files].sort((left, right) => left.path.localeCompare(right.path)),
  }));
  const subjectDigest = externalPluginSubjectDigestV1(value);
  const reasons = new Set<ExternalPluginFindingCodeV1>();
  const add = (code: ExternalPluginFindingCodeV1): void => { reasons.add(code); };
  const paths = new Set<string>();

  if (value.source.mutable !== false) add("SOURCE_MUTABLE_DENIED");
  if (value.source.digest !== subjectDigest || value.source.locator !== `content+sha256:${subjectDigest}`) add("SOURCE_DIGEST_MISMATCH_DENIED");
  for (const file of value.files) {
    if (!PATH.test(file.path)) add("PATH_ESCAPE_DENIED");
    if (paths.has(file.path)) add("DUPLICATE_PATH_DENIED");
    paths.add(file.path);
    if (file.kind === "SYMLINK") add("SYMLINK_DENIED");
    if (digest(file.content) !== file.digest) add("FILE_DIGEST_MISMATCH_DENIED");
    scanText(file.content, add);
  }

  const files = new Map(value.files.map((file) => [file.path, file]));
  const packageFile = files.get("package.json");
  let packageJson: Record<string, unknown> | null = null;
  if (packageFile) {
    try {
      const parsed: unknown = JSON.parse(packageFile.content);
      if (!isRecord(parsed)) add("PACKAGE_JSON_INVALID_DENIED");
      else packageJson = parsed;
    } catch {
      add("PACKAGE_JSON_INVALID_DENIED");
    }
  }
  if (packageJson) {
    if (packageJson.license !== value.licence.spdx) add("LICENCE_EVIDENCE_MISMATCH_DENIED");
    if (!LOCKFILES.some((lockfile) => files.has(lockfile))) add("LOCKFILE_MISSING_DENIED");
    if (typeof packageJson.packageManager !== "string" || !PACKAGE_MANAGER_PIN.test(packageJson.packageManager)) {
      add("TOOLCHAIN_PIN_MISSING_DENIED");
    }
    const scripts = isRecord(packageJson.scripts) ? packageJson.scripts : {};
    if (["preinstall", "install", "postinstall", "prepare"].some((key) => typeof scripts[key] === "string")) add("INSTALL_HOOK_DENIED");
    for (const dependencySet of [packageJson.dependencies, packageJson.optionalDependencies, packageJson.peerDependencies]) {
      if (!isRecord(dependencySet)) continue;
      if (Object.values(dependencySet).some((version) => typeof version === "string" && MUTABLE_RANGE.test(version))) add("MUTABLE_DEPENDENCY_DENIED");
    }
    scanJson(packageJson, add);
  }

  if (value.subject.format === "DSH_BUNDLE_PROFILE") {
    if (value.compatibility.kind !== "DEEPSEEK_HARNESS"
      || value.compatibility.version !== EXTERNAL_PLUGIN_PREFLIGHT_SUPPORTED_DSH_V1.version
      || value.compatibility.tag !== EXTERNAL_PLUGIN_PREFLIGHT_SUPPORTED_DSH_V1.tag
      || value.compatibility.commit !== EXTERNAL_PLUGIN_PREFLIGHT_SUPPORTED_DSH_V1.commit
      || value.compatibility.distTag !== EXTERNAL_PLUGIN_PREFLIGHT_SUPPORTED_DSH_V1.distTag
      || !DIGEST.test(value.compatibility.artifactDigest ?? "")) add("DSH_UPSTREAM_PIN_DENIED");
    const dsh = packageJson && isRecord(packageJson.dsh) ? packageJson.dsh : null;
    const bundle = dsh && isRecord(dsh.bundle) ? dsh.bundle : null;
    const patch = bundle?.patch;
    if (typeof patch !== "string" || !PATH.test(patch.replace(/^\.\//, ""))) add("DSH_MANIFEST_MISSING_DENIED");
    else if (!files.has(patch.replace(/^\.\//, ""))) add("DSH_PATCH_MISSING_DENIED");
  }

  if (value.subject.format === "MCP_SERVER") {
    for (const file of value.files.filter(({ mediaType }) => mediaType === "application/json")) {
      try { scanJson(JSON.parse(file.content) as unknown, add); } catch { add("PACKAGE_JSON_INVALID_DENIED"); }
    }
  }
  if (value.subject.format === "SKILL" && !files.has("SKILL.md")) add("UNKNOWN_EFFECT_SURFACE_REVIEW");

  const reasonCodes = REASON_ORDER.filter((reason) => reasons.has(reason));
  const verdict = reasonCodes.some((reason) => DENIALS.has(reason)) ? "DENY"
    : reasonCodes.length > 0 ? "REVIEW" : "STATIC_CLEAR";
  return {
    schemaVersion: EXTERNAL_PLUGIN_PREFLIGHT_REPORT_SCHEMA_V1,
    requestDigest,
    subjectDigest,
    format: value.subject.format,
    verdict,
    reasonCodes,
    evidenceRefs: [`artifact:sha256:${subjectDigest}`, `artifact:sha256:${requestDigest}`],
    dynamicGates: EXTERNAL_PLUGIN_PREFLIGHT_DYNAMIC_GATES_V1.map((gateId) => ({
      gateId, outcome: "NOT_RUN", reason: "EXECUTION_PROHIBITED_IN_STATIC_PREFLIGHT",
    })),
    etlEligibility: "STATIC_ONLY_NOT_PROFILE_CONFORMANT",
    claimBoundary: EXTERNAL_PLUGIN_PREFLIGHT_CLAIM_BOUNDARY_V1,
  };
}

export function renderPublicExternalPluginPreflightV1(value: unknown): string {
  return canonicalJson(evaluateExternalPluginPreflightV1(value));
}


/** PAN591/DUI13: additive, exact closed UI graph admission. STATIC_CLEAR above
 * remains execution-free and never becomes a rights or installation grant.
 * The trusted owner supplies the separately byte-verified allowlisted graph;
 * a caller-signed digest, repo license or adapter license is not that policy.
 */
export const UI_BUILD_GRAPH_SCHEMA_V1 = "pansphaira.ui-build-admission/graph/v1" as const;
export interface UiBuildResourceV1 {
  readonly id:string; readonly kind:string; readonly version:string; readonly path:string;
  readonly sha256:string; readonly sourceRef:string; readonly licence:string;
  readonly licenceSha256:string; readonly noticeSha256:string; readonly rights:string;
  readonly distribution:string; readonly egress:readonly string[]; readonly dependsOn:readonly string[];
}
export interface UiBuildGraphV1 {
  readonly schemaVersion:typeof UI_BUILD_GRAPH_SCHEMA_V1; readonly graphId:string; readonly version:string;
  readonly base:{readonly commitSha:string;readonly treeSha:string}; readonly entrypoint:string;
  readonly operation:"PACKAGE_PINNED_SOURCE_ONLY";
  readonly network:{readonly mode:"NONE";readonly origins:readonly string[]};
  readonly resources:readonly UiBuildResourceV1[]; readonly graphDigest:string;
}
export function uiBuildGraphDigestV1(value:UiBuildGraphV1):string {
  const {graphDigest:_stored,...body}=value;
  return digest(canonicalJson(body));
}
export type UiBuildAdmissionV1 = Readonly<{outcome:"GRAPH_ADMISSIBLE"|"DENIED";reasonCodes:readonly string[];graphDigest?:string}>;
export function evaluateUiBuildAdmissionV1(value:unknown, trustedPolicy:unknown):UiBuildAdmissionV1 {
  const no=(code:string):UiBuildAdmissionV1=>Object.freeze({outcome:"DENIED",reasonCodes:Object.freeze([code])});
  try {
    if(!isSafeJsonData(value)||!exact(value,["schemaVersion","graphId","version","base","entrypoint","operation","network","resources","graphDigest"])
      ||value.schemaVersion!==UI_BUILD_GRAPH_SCHEMA_V1||typeof value.graphId!=="string"||!/^[a-z0-9.-]{3,96}$/.test(value.graphId)
      ||typeof value.version!=="string"||!exact(value.base,["commitSha","treeSha"])
      ||![value.base.commitSha,value.base.treeSha].every(x=>typeof x==="string"&&/^[a-f0-9]{40}$/.test(x))
      ||typeof value.entrypoint!=="string"||value.operation!=="PACKAGE_PINNED_SOURCE_ONLY"
      ||!exact(value.network,["mode","origins"])||!Array.isArray(value.network.origins)
      ||!Array.isArray(value.resources)||value.resources.length<1||value.resources.length>32||typeof value.graphDigest!=="string")
      return no("UI_ADMISSION_SCHEMA_DENIED");
    if(value.network.mode!=="NONE"||value.network.origins.length!==0)return no("UI_ADMISSION_EGRESS_DENIED");
    const resourceKeys=["id","kind","version","path","sha256","sourceRef","licence","licenceSha256","noticeSha256","rights","distribution","egress","dependsOn"];
    for(const r of value.resources){
      if(!exact(r,resourceKeys)||![r.id,r.kind,r.version,r.path,r.sha256,r.sourceRef,r.licence,r.rights,r.distribution].every(x=>typeof x==="string")
        ||!Array.isArray(r.egress)||!Array.isArray(r.dependsOn)||!r.dependsOn.every(x=>typeof x==="string"))return no("UI_ADMISSION_SCHEMA_DENIED");
      if(!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(r.version as string))return no("UI_ADMISSION_FLOATING_DEPENDENCY_DENIED");
      if(["MODEL_WEIGHTS","VOICE","STT","TTS","VAD"].includes(r.kind as string))return no("UI_ADMISSION_SEPARATE_MEDIA_RIGHTS_REQUIRED");
      if(!["SOURCE","DEPENDENCY","RUNTIME","FONT","ICON","ASSET"].includes(r.kind as string))return no("UI_ADMISSION_RESOURCE_KIND_DENIED");
      if(/^AGPL/i.test(r.licence as string))return no("UI_ADMISSION_AGPL_DECISION_REQUIRED");
      if(!["Apache-2.0","LicenseRef-Node24-Distribution"].includes(r.licence as string)
        ||!["OWN_SYNTHETIC_SOURCE_ONLY","EXISTING_QUALIFIED_LOCAL_EXECUTION_ONLY"].includes(r.rights as string))return no("UI_ADMISSION_RIGHTS_UNKNOWN");
      if(![r.sha256,r.licenceSha256,r.noticeSha256].every(x=>typeof x==="string"&&DIGEST.test(x)))return no("UI_ADMISSION_NOTICE_OR_LICENCE_PIN_DENIED");
      if(r.egress.length!==0)return no("UI_ADMISSION_EGRESS_DENIED");
      if((r.kind==="RUNTIME"&&(r.distribution!=="NOT_DISTRIBUTED"||r.rights!=="EXISTING_QUALIFIED_LOCAL_EXECUTION_ONLY"))
        ||(r.kind!=="RUNTIME"&&(r.distribution!=="BUNDLED_SOURCE"||r.rights!=="OWN_SYNTHETIC_SOURCE_ONLY")))return no("UI_ADMISSION_RIGHTS_SCOPE_DENIED");
    }
    const g=value as unknown as UiBuildGraphV1,ids=new Set(g.resources.map(r=>r.id));
    if(ids.size!==g.resources.length||new Set(g.resources.map(r=>r.path)).size!==g.resources.length||!ids.has(g.entrypoint)
      ||g.resources.some(r=>r.dependsOn.some(id=>!ids.has(id)||id===r.id)||new Set(r.dependsOn).size!==r.dependsOn.length))return no("UI_ADMISSION_DEPENDENCY_CLOSURE_DENIED");
    const active=new Set<string>(),visited=new Set<string>();
    const visit=(id:string):boolean=>{if(active.has(id))return false;if(visited.has(id))return true;active.add(id);for(const next of g.resources.find(r=>r.id===id)!.dependsOn)if(!visit(next))return false;active.delete(id);visited.add(id);return true;};
    if(!visit(g.entrypoint)||visited.size!==g.resources.length)return no("UI_ADMISSION_DEPENDENCY_CLOSURE_DENIED");
    if(uiBuildGraphDigestV1(g)!==g.graphDigest)return no("UI_ADMISSION_CONTENT_DIGEST_DENIED");
    if(!isSafeJsonData(trustedPolicy)||!exact(trustedPolicy,["schemaVersion","graphId","version","base","entrypoint","operation","network","resources","graphDigest"])
      ||canonicalJson(g)!==canonicalJson(trustedPolicy))return no("UI_ADMISSION_EXACT_OWNER_POLICY_DENIED");
    return Object.freeze({outcome:"GRAPH_ADMISSIBLE",reasonCodes:Object.freeze(["UI_ADMISSION_EXACT_OWN_GRAPH_QUALIFIED"]),graphDigest:g.graphDigest});
  } catch {return no("UI_ADMISSION_SCHEMA_DENIED");}
}
