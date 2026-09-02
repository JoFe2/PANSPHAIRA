export const INCOMING_INVOICE_BLUEPRINT_SCHEMA_VERSION =
  "chimpmaera.incoming-invoice/blueprint/v1" as const;
export const INCOMING_INVOICE_SCENARIO_INPUT_VERSION =
  "chimpmaera.incoming-invoice/scenario-input/v1" as const;

export type IncomingInvoiceScenarioV1 = "LEAN" | "CONTROLLED" | "SEGREGATED_ENTERPRISE";
export type IncomingInvoiceComplexityVectorV1 = Readonly<{
  documentVariance: 0 | 1 | 2;
  approvalDepth: 0 | 1 | 2;
  integrationCount: 0 | 1 | 2;
  segregationRequired: boolean;
}>;

export type IncomingInvoiceScenarioInputV1 = Readonly<{
  schemaVersion: typeof INCOMING_INVOICE_SCENARIO_INPUT_VERSION;
  vector: IncomingInvoiceComplexityVectorV1;
  requestedAuthority: "LOCAL_SYNTHETIC_PROOF";
  requestedEffects: readonly ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF"];
}>;

export type IncomingInvoiceDenialReasonV1 =
  | "UNKNOWN_INPUT_FIELD_DENIED"
  | "UNKNOWN_VECTOR_FIELD_DENIED"
  | "VERSION_DENIED"
  | "AUTHORITY_DENIED"
  | "EFFECT_DENIED"
  | "VECTOR_FIELD_DENIED"
  | "VECTOR_VALUE_DENIED";

export type IncomingInvoiceScenarioResolutionV1 = Readonly<{
  outcome: "DENIED";
  reasonCodes: readonly [IncomingInvoiceDenialReasonV1];
}> | Readonly<{
  outcome: "ACCEPTED";
  scenario: IncomingInvoiceScenarioV1;
  derivation: Readonly<{
    ruleId: "LEAN_LOW_COMPLEXITY_V1" | "CONTROLLED_SCORE_V1" | "SEGREGATION_REQUIRED_V1";
    score: number;
    vector: IncomingInvoiceComplexityVectorV1;
  }>;
  authority: Readonly<{
    mode: "LOCAL_SYNTHETIC_PROOF";
    allowedEffects: readonly ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF"];
    customerDataAuthorized: false;
    productiveBookingAuthorized: false;
  }>;
}>;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const INCOMING_INVOICE_BLUEPRINT_V1 = deepFreeze({
  schemaVersion: INCOMING_INVOICE_BLUEPRINT_SCHEMA_VERSION,
  blueprintVersion: "1.0.0",
  claim: "LOCAL_SYNTHETIC_BLUEPRINT_ONLY_NO_CUSTOMER_DATA_NO_PRODUCTIVE_BOOKING",
  layers: [
    { ordinal: 1, layerId: "SOURCE", version: "1.0.0" },
    { ordinal: 2, layerId: "INTAKE", version: "1.0.0" },
    { ordinal: 3, layerId: "EXTRACTION", version: "1.0.0" },
    { ordinal: 4, layerId: "NORMALIZATION", version: "1.0.0" },
    { ordinal: 5, layerId: "VALIDATION", version: "1.0.0" },
    { ordinal: 6, layerId: "APPROVAL", version: "1.0.0" },
    { ordinal: 7, layerId: "BOOKING_PREVIEW", version: "1.0.0" },
    { ordinal: 8, layerId: "PROOF", version: "1.0.0" },
  ],
  complexityModel: {
    vectorVersion: "1.0.0",
    fields: ["documentVariance", "approvalDepth", "integrationCount", "segregationRequired"],
    rules: [
      { priority: 1, ruleId: "SEGREGATION_REQUIRED_V1", scenario: "SEGREGATED_ENTERPRISE", predicate: "segregationRequired === true" },
      { priority: 2, ruleId: "CONTROLLED_SCORE_V1", scenario: "CONTROLLED", predicate: "documentVariance + approvalDepth + integrationCount >= 3" },
      { priority: 3, ruleId: "LEAN_LOW_COMPLEXITY_V1", scenario: "LEAN", predicate: "otherwise" },
    ],
  },
  scopeFreeze: {
    scope: ["local synthetic incoming-invoice scenario resolution", "deterministic source-to-proof blueprint validation"],
    nonScope: ["customer data processing", "live provider calls", "productive accounting booking", "universal adaptability claims"],
    actors: ["local proof operator", "synthetic invoice fixture"],
    outcomes: ["deterministic scenario selection", "local synthetic proof contract"],
    risks: ["hidden complexity input", "unsupported effect authority", "productive booking confusion"],
    falsifiers: ["same vector resolves differently", "company size changes scenario", "customer data or productive booking becomes authorized"],
  },
  authority: {
    mode: "LOCAL_SYNTHETIC_PROOF",
    allowedEffects: ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF"],
    customerDataAuthorized: false,
    productiveBookingAuthorized: false,
    externalCallsAuthorized: false,
  },
} as const);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function denied(reason: IncomingInvoiceDenialReasonV1): IncomingInvoiceScenarioResolutionV1 {
  return deepFreeze({ outcome: "DENIED" as const, reasonCodes: [reason] as const });
}

export function resolveIncomingInvoiceScenarioV1(input: unknown): IncomingInvoiceScenarioResolutionV1 {
  const inputKeys = ["requestedAuthority", "requestedEffects", "schemaVersion", "vector"] as const;
  if (!isRecord(input)) return denied("VECTOR_FIELD_DENIED");
  const unknownInput = Object.keys(input).some((key) => !inputKeys.includes(key as typeof inputKeys[number]));
  if (unknownInput) return denied("UNKNOWN_INPUT_FIELD_DENIED");
  if (!hasExactKeys(input, inputKeys)) return denied("VECTOR_FIELD_DENIED");
  if (input.schemaVersion !== INCOMING_INVOICE_SCENARIO_INPUT_VERSION) return denied("VERSION_DENIED");
  if (input.requestedAuthority !== "LOCAL_SYNTHETIC_PROOF") return denied("AUTHORITY_DENIED");
  if (!Array.isArray(input.requestedEffects)
    || input.requestedEffects.length !== 2
    || input.requestedEffects[0] !== "READ_SYNTHETIC"
    || input.requestedEffects[1] !== "WRITE_LOCAL_PROOF") return denied("EFFECT_DENIED");

  const vectorKeys = ["approvalDepth", "documentVariance", "integrationCount", "segregationRequired"] as const;
  if (!isRecord(input.vector)) return denied("VECTOR_FIELD_DENIED");
  const unknownVector = Object.keys(input.vector)
    .some((key) => !vectorKeys.includes(key as typeof vectorKeys[number]));
  if (unknownVector) return denied("UNKNOWN_VECTOR_FIELD_DENIED");
  if (!hasExactKeys(input.vector, vectorKeys)) return denied("VECTOR_FIELD_DENIED");
  const dimensions = [input.vector.documentVariance, input.vector.approvalDepth, input.vector.integrationCount];
  if (dimensions.some((value) => !Number.isInteger(value) || ![0, 1, 2].includes(value as number))
    || typeof input.vector.segregationRequired !== "boolean") return denied("VECTOR_VALUE_DENIED");

  const vector = deepFreeze(structuredClone(input.vector)) as IncomingInvoiceComplexityVectorV1;
  const score = vector.documentVariance + vector.approvalDepth + vector.integrationCount;
  const resolution = vector.segregationRequired
    ? { scenario: "SEGREGATED_ENTERPRISE" as const, ruleId: "SEGREGATION_REQUIRED_V1" as const }
    : score >= 3
      ? { scenario: "CONTROLLED" as const, ruleId: "CONTROLLED_SCORE_V1" as const }
      : { scenario: "LEAN" as const, ruleId: "LEAN_LOW_COMPLEXITY_V1" as const };
  return deepFreeze({
    outcome: "ACCEPTED" as const,
    scenario: resolution.scenario,
    derivation: { ruleId: resolution.ruleId, score, vector },
    authority: {
      mode: "LOCAL_SYNTHETIC_PROOF" as const,
      allowedEffects: ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF"] as const,
      customerDataAuthorized: false as const,
      productiveBookingAuthorized: false as const,
    },
  });
}
