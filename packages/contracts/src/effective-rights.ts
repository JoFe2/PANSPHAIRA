import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const EFFECTIVE_RIGHTS_INPUT_API_VERSION =
  "chimpmaera.security/effective-rights-input/v1" as const;
export const EFFECTIVE_RIGHTS_RESULT_API_VERSION =
  "chimpmaera.security/effective-rights-result/v1" as const;
export const PERMISSION_XRAY_API_VERSION =
  "chimpmaera.security/permission-xray/v1" as const;

export const EFFECTIVE_RIGHTS_OPERAND_KINDS_V1 = [
  "PROFILE",
  "ASSIGNMENT",
  "CAPABILITY",
  "CONSTRAINT",
] as const;
export type EffectiveRightsOperandKindV1 =
  typeof EFFECTIVE_RIGHTS_OPERAND_KINDS_V1[number];
export type EffectiveRightsOutcomeV1 = "ALLOW" | "ESCALATE" | "DENY";

const ACTIONS = ["crm.contact.create", "erp.order.create", "employee.directory.read_own"] as const;
const RESOURCES = ["dolibarr.order", "espocrm.contact", "employee.directory.own"] as const;
const FIELDS = ["email", "name", "quantity", "sku", "displayName", "department", "jobTitle", "employeeAlias"] as const;
const PURPOSES = ["owner.review", "synthetic.demo", "employee.business.help"] as const;
const EFFECTS = ["CREATE", "READ"] as const;

export type EffectiveRightsScopeV1 = Readonly<{
  actions: readonly string[];
  resources: readonly string[];
  fields: readonly string[];
  purposes: readonly string[];
  effects: readonly string[];
}>;

export type EffectiveRightsOperandV1 = Readonly<{
  kind: EffectiveRightsOperandKindV1;
  operandId: string;
  tenant: string;
  actor: string;
  generation: number;
  profileId: string;
  profileGeneration: number;
  decisionCeiling: EffectiveRightsOutcomeV1;
  scope: EffectiveRightsScopeV1;
}>;

export type EffectiveRightsInputV1 = Readonly<{
  schemaVersion: typeof EFFECTIVE_RIGHTS_INPUT_API_VERSION;
  actor: string;
  tenant: string;
  operands: readonly EffectiveRightsOperandV1[];
}>;

export const EFFECTIVE_RIGHTS_ISSUE_CODES_V1 = [
  "EFFECTIVE_RIGHTS_BINDING_MISMATCH_DENIED",
  "EFFECTIVE_RIGHTS_EMPTY_INTERSECTION_DENIED",
  "EFFECTIVE_RIGHTS_EXPLICIT_DENY",
  "EFFECTIVE_RIGHTS_INPUT_SCHEMA_DENIED",
  "EFFECTIVE_RIGHTS_OPERAND_CONFLICT_DENIED",
  "EFFECTIVE_RIGHTS_OPERAND_DUPLICATE_DENIED",
  "EFFECTIVE_RIGHTS_OPERAND_GENERATION_STALE_DENIED",
  "EFFECTIVE_RIGHTS_OPERAND_KIND_UNKNOWN_DENIED",
  "EFFECTIVE_RIGHTS_OPERAND_MISSING_DENIED",
  "EFFECTIVE_RIGHTS_OPERAND_SCHEMA_DENIED",
  "EFFECTIVE_RIGHTS_SCOPE_UNKNOWN_DENIED",
] as const;
export type EffectiveRightsIssueCodeV1 =
  typeof EFFECTIVE_RIGHTS_ISSUE_CODES_V1[number];

export type EffectiveRightsResultV1 = Readonly<{
  schemaVersion: typeof EFFECTIVE_RIGHTS_RESULT_API_VERSION;
  inputDigest: string;
  actor: string | null;
  tenant: string | null;
  profileBinding: Readonly<{
    profileId: string | null;
    profileGeneration: number | null;
  }>;
  outcome: EffectiveRightsOutcomeV1;
  effectiveScope: EffectiveRightsScopeV1;
  ceilings: readonly Readonly<{
    kind: EffectiveRightsOperandKindV1;
    operandId: string;
    generation: number;
    decisionCeiling: EffectiveRightsOutcomeV1;
    scope: EffectiveRightsScopeV1;
    operandDigest: string;
  }>[];
  reasonFacts: readonly Readonly<{
    code: string;
    source: EffectiveRightsOperandKindV1 | "COMPILER";
    detail: string;
  }>[];
  issues: readonly EffectiveRightsIssueCodeV1[];
  informationalOnly: true;
  resultDigest: string;
}>;

export type PermissionXrayV1 = Readonly<{
  schemaVersion: typeof PERMISSION_XRAY_API_VERSION;
  title: "Permission X-ray — local synthetic facts";
  claim: "INFORMATIONAL_ONLY_NO_EXECUTABLE_AUTHORITY";
  sourceResultDigest: string;
  outcome: EffectiveRightsOutcomeV1;
  effectiveScope: EffectiveRightsScopeV1;
  ceilings: EffectiveRightsResultV1["ceilings"];
  reasonFacts: EffectiveRightsResultV1["reasonFacts"];
  issues: EffectiveRightsResultV1["issues"];
  informationalOnly: true;
}>;

type RecordValue = Record<string, unknown>;

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function isRecord(value: unknown): value is RecordValue {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, expected: readonly string[]): value is RecordValue {
  return isRecord(value)
    && canonicalJson(Object.keys(value).sort())
      === canonicalJson([...expected].sort());
}

function isBoundIdentifier(value: unknown): value is string {
  return typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/.test(value);
}

function isPositiveGeneration(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function emptyScope(): EffectiveRightsScopeV1 {
  return { actions: [], resources: [], fields: [], purposes: [], effects: [] };
}

function validateScope(
  value: unknown,
  issues: Set<EffectiveRightsIssueCodeV1>,
): EffectiveRightsScopeV1 | null {
  if (!exactKeys(value, ["actions", "effects", "fields", "purposes", "resources"])) {
    issues.add("EFFECTIVE_RIGHTS_OPERAND_SCHEMA_DENIED");
    return null;
  }
  const domains = [
    ["actions", ACTIONS],
    ["resources", RESOURCES],
    ["fields", FIELDS],
    ["purposes", PURPOSES],
    ["effects", EFFECTS],
  ] as const;
  const normalized: Record<string, string[]> = {};
  for (const [name, allowed] of domains) {
    const candidate = value[name];
    if (
      !Array.isArray(candidate)
      || candidate.length === 0
      || candidate.some((entry) => typeof entry !== "string")
    ) {
      issues.add("EFFECTIVE_RIGHTS_OPERAND_SCHEMA_DENIED");
      return null;
    }
    if (new Set(candidate).size !== candidate.length) {
      issues.add("EFFECTIVE_RIGHTS_OPERAND_CONFLICT_DENIED");
    }
    if (candidate.some((entry) => !(allowed as readonly string[]).includes(entry))) {
      issues.add("EFFECTIVE_RIGHTS_SCOPE_UNKNOWN_DENIED");
    }
    normalized[name] = sortedUnique(candidate as string[]);
  }
  return {
    actions: normalized.actions ?? [],
    resources: normalized.resources ?? [],
    fields: normalized.fields ?? [],
    purposes: normalized.purposes ?? [],
    effects: normalized.effects ?? [],
  };
}

function parseOperand(
  value: unknown,
  issues: Set<EffectiveRightsIssueCodeV1>,
): EffectiveRightsOperandV1 | null {
  if (!isRecord(value)) {
    issues.add("EFFECTIVE_RIGHTS_OPERAND_SCHEMA_DENIED");
    return null;
  }
  if (!EFFECTIVE_RIGHTS_OPERAND_KINDS_V1.includes(
    value.kind as EffectiveRightsOperandKindV1,
  )) {
    issues.add("EFFECTIVE_RIGHTS_OPERAND_KIND_UNKNOWN_DENIED");
    return null;
  }
  if (!exactKeys(value, [
    "actor", "decisionCeiling", "generation", "kind", "operandId",
    "profileGeneration", "profileId", "scope", "tenant",
  ])) {
    issues.add("EFFECTIVE_RIGHTS_OPERAND_SCHEMA_DENIED");
    return null;
  }
  if (
    !isBoundIdentifier(value.operandId)
    || !isBoundIdentifier(value.tenant)
    || !isBoundIdentifier(value.actor)
    || !isBoundIdentifier(value.profileId)
    || !["ALLOW", "ESCALATE", "DENY"].includes(value.decisionCeiling as string)
  ) {
    issues.add("EFFECTIVE_RIGHTS_OPERAND_SCHEMA_DENIED");
    return null;
  }
  if (
    !isPositiveGeneration(value.generation)
    || !isPositiveGeneration(value.profileGeneration)
  ) {
    issues.add("EFFECTIVE_RIGHTS_OPERAND_GENERATION_STALE_DENIED");
    return null;
  }
  const scope = validateScope(value.scope, issues);
  if (scope === null) return null;
  return {
    kind: value.kind as EffectiveRightsOperandKindV1,
    operandId: value.operandId,
    tenant: value.tenant,
    actor: value.actor,
    generation: value.generation,
    profileId: value.profileId,
    profileGeneration: value.profileGeneration,
    decisionCeiling: value.decisionCeiling as EffectiveRightsOutcomeV1,
    scope,
  };
}

function normalizedInput(
  input: Pick<EffectiveRightsInputV1, "actor" | "tenant">,
  operands: readonly EffectiveRightsOperandV1[],
): EffectiveRightsInputV1 {
  return {
    schemaVersion: EFFECTIVE_RIGHTS_INPUT_API_VERSION,
    actor: input.actor,
    tenant: input.tenant,
    operands: [...operands].sort((left, right) =>
      left.kind.localeCompare(right.kind)),
  };
}

function intersection(
  operands: readonly EffectiveRightsOperandV1[],
  field: keyof EffectiveRightsScopeV1,
): string[] {
  const [first, ...rest] = operands;
  if (first === undefined) return [];
  return first.scope[field]
    .filter((value) => rest.every((operand) => operand.scope[field].includes(value)))
    .sort();
}

function buildResult(
  inputDigest: string,
  actor: string | null,
  tenant: string | null,
  operands: readonly EffectiveRightsOperandV1[],
  issuesInput: ReadonlySet<EffectiveRightsIssueCodeV1>,
): EffectiveRightsResultV1 {
  const issues = new Set(issuesInput);
  const profile = operands.find(({ kind }) => kind === "PROFILE");
  const effectiveScope: EffectiveRightsScopeV1 = operands.length === 4
    ? {
        actions: intersection(operands, "actions"),
        resources: intersection(operands, "resources"),
        fields: intersection(operands, "fields"),
        purposes: intersection(operands, "purposes"),
        effects: intersection(operands, "effects"),
      }
    : emptyScope();
  if (
    operands.length === 4
    && Object.values(effectiveScope).some((values) => values.length === 0)
  ) issues.add("EFFECTIVE_RIGHTS_EMPTY_INTERSECTION_DENIED");
  if (operands.some(({ decisionCeiling }) => decisionCeiling === "DENY")) {
    issues.add("EFFECTIVE_RIGHTS_EXPLICIT_DENY");
  }
  const outcome: EffectiveRightsOutcomeV1 = issues.size > 0
    ? "DENY"
    : operands.some(({ decisionCeiling }) => decisionCeiling === "ESCALATE")
      ? "ESCALATE"
      : "ALLOW";
  const ceilings = [...operands]
    .sort((left, right) => left.kind.localeCompare(right.kind))
    .map((operand) => ({
      kind: operand.kind,
      operandId: operand.operandId,
      generation: operand.generation,
      decisionCeiling: operand.decisionCeiling,
      scope: structuredClone(operand.scope),
      operandDigest: digest(operand),
    }));
  const reasonFacts = [
    ...ceilings.map(({ kind, decisionCeiling }) => ({
      code: "EFFECTIVE_RIGHTS_CEILING_CONTRIBUTED",
      source: kind,
      detail: decisionCeiling,
    })),
    ...[...issues].sort().map((code) => ({
      code,
      source: "COMPILER" as const,
      detail: "FAIL_CLOSED",
    })),
    {
      code: `EFFECTIVE_RIGHTS_${outcome}`,
      source: "COMPILER" as const,
      detail: outcome === "ALLOW"
        ? "ALL_REQUIRED_OPERANDS_INTERSECT"
        : outcome === "ESCALATE"
          ? "RESTRICTIVE_CEILING_REQUIRES_OWNER"
          : "NO_INFORMATIONAL_ALLOW",
    },
  ];
  const core = {
    schemaVersion: EFFECTIVE_RIGHTS_RESULT_API_VERSION,
    inputDigest,
    actor,
    tenant,
    profileBinding: {
      profileId: profile?.profileId ?? null,
      profileGeneration: profile?.profileGeneration ?? null,
    },
    outcome,
    effectiveScope,
    ceilings,
    reasonFacts,
    issues: [...issues].sort(),
    informationalOnly: true as const,
  };
  return { ...core, resultDigest: digest(core) };
}

export function compileEffectiveRightsV1(input: unknown): EffectiveRightsResultV1 {
  const issues = new Set<EffectiveRightsIssueCodeV1>();
  if (!exactKeys(input, ["actor", "operands", "schemaVersion", "tenant"])) {
    issues.add("EFFECTIVE_RIGHTS_INPUT_SCHEMA_DENIED");
  }
  const record = isRecord(input) ? input : {};
  const actor = isBoundIdentifier(record.actor) ? record.actor : null;
  const tenant = isBoundIdentifier(record.tenant) ? record.tenant : null;
  if (
    record.schemaVersion !== EFFECTIVE_RIGHTS_INPUT_API_VERSION
    || actor === null
    || tenant === null
    || !Array.isArray(record.operands)
  ) issues.add("EFFECTIVE_RIGHTS_INPUT_SCHEMA_DENIED");

  const operands = Array.isArray(record.operands)
    ? record.operands.map((value) => parseOperand(value, issues))
      .filter((value): value is EffectiveRightsOperandV1 => value !== null)
    : [];
  for (const kind of EFFECTIVE_RIGHTS_OPERAND_KINDS_V1) {
    const count = operands.filter((operand) => operand.kind === kind).length;
    if (count === 0) issues.add("EFFECTIVE_RIGHTS_OPERAND_MISSING_DENIED");
    if (count > 1) issues.add("EFFECTIVE_RIGHTS_OPERAND_DUPLICATE_DENIED");
  }
  const profile = operands.find(({ kind }) => kind === "PROFILE");
  if (profile !== undefined) {
    for (const operand of operands) {
      if (
        actor !== operand.actor
        || tenant !== operand.tenant
        || operand.profileId !== profile.profileId
      ) issues.add("EFFECTIVE_RIGHTS_BINDING_MISMATCH_DENIED");
      if (operand.profileGeneration < profile.profileGeneration) {
        issues.add("EFFECTIVE_RIGHTS_OPERAND_GENERATION_STALE_DENIED");
      } else if (operand.profileGeneration !== profile.profileGeneration) {
        issues.add("EFFECTIVE_RIGHTS_BINDING_MISMATCH_DENIED");
      }
    }
  }
  const normalized = actor !== null && tenant !== null
    ? normalizedInput({ actor, tenant }, operands)
    : null;
  const inputDigest = normalized === null
    ? digest({ invalidInput: true, issues: [...issues].sort() })
    : digest(normalized);
  return buildResult(inputDigest, actor, tenant, operands, issues);
}

function validScopeShape(value: unknown): value is EffectiveRightsScopeV1 {
  return exactKeys(value, ["actions", "effects", "fields", "purposes", "resources"])
    && Object.values(value).every((entry) =>
      Array.isArray(entry) && entry.every((item) => typeof item === "string"));
}

export function verifyEffectiveRightsResultV1(
  value: unknown,
): EffectiveRightsResultV1 {
  const invalid = () => {
    throw new Error("EFFECTIVE_RIGHTS_RESULT_INVALID_DENIED");
  };
  if (!exactKeys(value, [
    "actor", "ceilings", "effectiveScope", "informationalOnly", "inputDigest",
    "issues", "outcome", "profileBinding", "reasonFacts", "resultDigest",
    "schemaVersion", "tenant",
  ])) return invalid();
  const { resultDigest, ...core } = value;
  if (
    value.schemaVersion !== EFFECTIVE_RIGHTS_RESULT_API_VERSION
    || !/^[a-f0-9]{64}$/.test(value.inputDigest as string)
    || !/^[a-f0-9]{64}$/.test(resultDigest as string)
    || !["ALLOW", "ESCALATE", "DENY"].includes(value.outcome as string)
    || value.informationalOnly !== true
    || !validScopeShape(value.effectiveScope)
    || !exactKeys(value.profileBinding, ["profileGeneration", "profileId"])
    || !Array.isArray(value.ceilings)
    || !Array.isArray(value.reasonFacts)
    || !Array.isArray(value.issues)
    || resultDigest !== digest(core)
  ) return invalid();
  const kinds = new Set<unknown>();
  for (const ceiling of value.ceilings) {
    if (!exactKeys(ceiling, [
      "decisionCeiling", "generation", "kind", "operandDigest", "operandId", "scope",
    ])
      || !EFFECTIVE_RIGHTS_OPERAND_KINDS_V1.includes(
        ceiling.kind as EffectiveRightsOperandKindV1,
      )
      || kinds.has(ceiling.kind)
      || !isBoundIdentifier(ceiling.operandId)
      || !isPositiveGeneration(ceiling.generation)
      || !["ALLOW", "ESCALATE", "DENY"].includes(ceiling.decisionCeiling as string)
      || !validScopeShape(ceiling.scope)
      || !/^[a-f0-9]{64}$/.test(ceiling.operandDigest as string)) return invalid();
    kinds.add(ceiling.kind);
  }
  for (const fact of value.reasonFacts) {
    if (!exactKeys(fact, ["code", "detail", "source"])
      || typeof fact.code !== "string"
      || typeof fact.detail !== "string"
      || ![...EFFECTIVE_RIGHTS_OPERAND_KINDS_V1, "COMPILER"].includes(
        fact.source as EffectiveRightsOperandKindV1 | "COMPILER",
      )) return invalid();
  }
  if (value.issues.some((issue) =>
    !EFFECTIVE_RIGHTS_ISSUE_CODES_V1.includes(issue as EffectiveRightsIssueCodeV1))) {
    return invalid();
  }
  return structuredClone(value) as EffectiveRightsResultV1;
}

export function renderPermissionXrayV1(
  resultInput: EffectiveRightsResultV1,
): PermissionXrayV1 {
  const result = verifyEffectiveRightsResultV1(resultInput);
  return {
    schemaVersion: PERMISSION_XRAY_API_VERSION,
    title: "Permission X-ray — local synthetic facts",
    claim: "INFORMATIONAL_ONLY_NO_EXECUTABLE_AUTHORITY",
    sourceResultDigest: result.resultDigest,
    outcome: result.outcome,
    effectiveScope: structuredClone(result.effectiveScope),
    ceilings: structuredClone(result.ceilings),
    reasonFacts: structuredClone(result.reasonFacts),
    issues: structuredClone(result.issues),
    informationalOnly: true,
  };
}

export function verifyPermissionXrayParityV1(
  view: unknown,
  result: EffectiveRightsResultV1,
): boolean {
  try {
    return canonicalJson(view) === canonicalJson(renderPermissionXrayV1(result));
  } catch {
    return false;
  }
}

export function syntheticEffectiveRightsInputV1(
  decisionOverrides: Partial<Record<EffectiveRightsOperandKindV1, EffectiveRightsOutcomeV1>> = {},
): EffectiveRightsInputV1 {
  const common = {
    tenant: "panskys-zoo-demo",
    actor: "agent:admin-ai-poc",
    profileId: "SAFE_GUIDED",
    profileGeneration: 1,
  } as const;
  const scopes: Record<EffectiveRightsOperandKindV1, EffectiveRightsScopeV1> = {
    PROFILE: {
      actions: ["crm.contact.create", "erp.order.create"],
      resources: ["dolibarr.order", "espocrm.contact"],
      fields: ["email", "name", "quantity", "sku"],
      purposes: ["owner.review", "synthetic.demo"],
      effects: ["CREATE"],
    },
    ASSIGNMENT: {
      actions: ["crm.contact.create"],
      resources: ["espocrm.contact"],
      fields: ["email", "name"],
      purposes: ["synthetic.demo"],
      effects: ["CREATE"],
    },
    CAPABILITY: {
      actions: ["crm.contact.create"],
      resources: ["espocrm.contact"],
      fields: ["email", "name"],
      purposes: ["synthetic.demo"],
      effects: ["CREATE"],
    },
    CONSTRAINT: {
      actions: ["crm.contact.create"],
      resources: ["espocrm.contact"],
      fields: ["email", "name"],
      purposes: ["synthetic.demo"],
      effects: ["CREATE"],
    },
  };
  return {
    schemaVersion: EFFECTIVE_RIGHTS_INPUT_API_VERSION,
    actor: common.actor,
    tenant: common.tenant,
    operands: EFFECTIVE_RIGHTS_OPERAND_KINDS_V1.map((kind, index) => ({
      kind,
      operandId: `synthetic.${kind.toLowerCase()}.v1`,
      ...common,
      generation: index + 1,
      decisionCeiling: decisionOverrides[kind] ?? "ALLOW",
      scope: scopes[kind],
    })),
  };
}
