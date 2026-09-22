import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { canonicalJson } from "../../contracts/src/canonical-json.js";
import {
  readLocalFileCorpusEditionV1,
  queryLocalFileCorpusV1,
  validateLocalFileCorpusEditionV1,
  type LocalFileCorpusEditionV1,
  type LocalFileCorpusProfileV1,
  type LocalFileCorpusQueryReceiptV1,
} from "../../contracts/src/local-file-knowledge-corpus.js";
import {
  MARGIN_THRESHOLD_METHOD_ID,
  methodGoalDigestV1,
  selectMethodsV1,
  validateMethodSpecV1,
  type KnowledgeResolutionV1,
  type KnowledgeStateV1,
  type MethodGoalV1,
  type MethodSelectionV1,
  type MethodSpecV1,
} from "./method-core.js";

/**
 * KTS-01 — nutzbare lokale Bibliothek (usable local method library).
 *
 * Combines the existing closed local-file knowledge corpus (read-only, digest
 * bound, conflict-aware) with digest-bound Fachmethode specs. It finds methods,
 * explains the required data and their fachliche Bedeutung, shows source /
 * version / preconditions / contradictions of the bound knowledge, and carries
 * a reasoned deterministic selection into the solution path. It is a
 * library, not a catalog viewer: every view is a digest-bound, verifiable
 * object that the guided adaptation path (KTS-02) consumes.
 *
 * Fail-closed: missing knowledge => ABSENT, conflicting citations => CONFLICT,
 * an edition older than the ref's staleness window => STALE, a content-drifted
 * corpus edition => TAMPERED for the refs bound to the drifted paths. Nothing
 * is invented; a method is only selectable on exact closed rules.
 */

export const METHOD_LIBRARY_SCHEMA_V1 = "pansphaira.kts/method-library/v1" as const;
export const METHOD_LIBRARY_VIEW_SCHEMA_V1 = "pansphaira.kts/method-library-view/v1" as const;
export const METHOD_LIBRARY_AUTHORITY_BOUNDARY_V1 =
  "READ_ONLY_KNOWLEDGE_AND_SPECS_NO_MODEL_EXECUTION_NO_WRITE_NO_AUTHORITY" as const;

/** Closed binding of knowledge ref ids to corpus paths + anchor query. */
export const KNOWLEDGE_REF_BINDINGS_V1 = {
  "knowledge:margin-rules-v1": {
    path: "methods/margin-rules.md",
    anchorQuery: "REGEL totalMinor floorCent",
    meaning: "Frorisierte Kanon-Regel der Methode (Kanon v1.0)",
  },
  "knowledge:margin-example-v1": {
    path: "methods/margin-worked-example.md",
    anchorQuery: "floorEur markiert Rechnung",
    meaning: "Frorisierter Beispielrenfall zur Regelverifikation",
  },
  "knowledge:invoice-total-rules-v1": {
    path: "methods/invoice-total-rules.md",
    anchorQuery: "Summe Gesamtbetraege Rechnungen",
    meaning: "Regel der Referenzmethode (Summenbildung)",
  },
} as const;
export type KnowledgeRefIdV1 = keyof typeof KNOWLEDGE_REF_BINDINGS_V1;

const sha = (value: unknown): string =>
  createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex");

export interface MethodLibrarySpecV1 {
  readonly spec: MethodSpecV1;
  readonly knowledgeStates: Readonly<Record<KnowledgeRefIdV1, KnowledgeStateV1>>;
  readonly knowledgeCitations: Readonly<Record<KnowledgeRefIdV1, readonly string[]>>;
  readonly conflicts: readonly { readonly left: string; readonly right: string; readonly kind: string }[];
}

export interface MethodLibraryV1 {
  readonly schemaVersion: typeof METHOD_LIBRARY_SCHEMA_V1;
  readonly libraryId: string;
  readonly corpusId: string;
  readonly editionId: string;
  readonly manifestDigest: string;
  readonly observedAtMs: number;
  readonly loadState: "LOADED" | "CONTENT_DRIFT_DENIED";
  readonly driftedPaths: readonly string[];
  readonly methods: readonly MethodLibrarySpecV1[];
  readonly libraryDigest: string;
}

export interface LibraryExplanationV1 {
  readonly methodId: string;
  readonly title: string;
  readonly meaning: string;
  readonly version: string;
  readonly supportedOutcomes: readonly string[];
  readonly requiredData: readonly {
    readonly inputId: string;
    readonly meaning: string;
    readonly unit: string | null;
    readonly requiredFields: readonly string[];
  }[];
  readonly preconditions: readonly string[];
  readonly sources: readonly {
    readonly ref: KnowledgeRefIdV1;
    readonly kind: "REQUIRED" | "SUPPORTING";
    readonly path: string;
    readonly state: KnowledgeStateV1;
    readonly citations: readonly string[];
  }[];
  readonly contradictions: readonly { readonly left: string; readonly right: string; readonly kind: string }[];
}

export interface LibraryQueryHitV1 {
  readonly citationId: string;
  readonly citation: string;
  readonly path: string;
  readonly startLine: number;
  readonly text: string;
  readonly score: number;
  readonly conflictsWith: readonly string[];
}

export interface LibraryQueryResultV1 {
  readonly schemaVersion: "pansphaira.kts/method-library-query/v1";
  readonly libraryId: string;
  readonly editionId: string;
  readonly manifestDigest: string;
  readonly normalizedQuery: string;
  readonly hits: readonly LibraryQueryHitV1[];
  readonly queryDigest: string;
}

export interface MethodLibraryViewV1 {
  readonly schemaVersion: typeof METHOD_LIBRARY_VIEW_SCHEMA_V1;
  readonly libraryId: string;
  readonly manifestDigest: string;
  readonly selection: MethodSelectionV1;
  readonly explanation: LibraryExplanationV1 | null;
  readonly viewDigest: string;
}


/**
 * Load the sealed corpus edition (null when bytes drifted from the sealed
 * profile). Single entry point for CLI/tests so drift handling stays one-way.
 */
export function loadCorpusEditionV1(corpusRoot: string, profile: unknown): LocalFileCorpusEditionV1 | null {
  try {
    const edition = readLocalFileCorpusEditionV1(corpusRoot, profile);
    return validateLocalFileCorpusEditionV1(edition) ? edition : null;
  } catch {
    return null;
  }
}

const parseJson = (relative: string): unknown =>
  JSON.parse(readFileSync(relative, "utf8"));

export interface MethodRegistryEntryV1 {
  readonly path: string;
  readonly methodId: string;
  readonly specDigest: string;
}

export const METHOD_REGISTRY_SCHEMA_V1 = "pansphaira.kts/method-registry/v1" as const;

export function validateMethodRegistryV1(value: unknown, entries: readonly MethodRegistryEntryV1[]): value is { readonly registryId: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v.schemaVersion !== METHOD_REGISTRY_SCHEMA_V1 || typeof v.registryId !== "string") return false;
  if (!Array.isArray(v.specs) || v.specs.length !== entries.length || v.specs.length < 1) return false;
  const specs = v.specs;
  return entries.every((entry, index) => {
    const spec = specs[index] as Record<string, unknown> | undefined;
    return spec !== undefined && spec.path === entry.path && spec.methodId === entry.methodId && spec.specDigest === entry.specDigest;
  });
}

/**
 * Load the sealed, digest-bound method registry from the package root.
 * The registry lives OUTSIDE the closed corpus root (the corpus walk must
 * exactly match the profile) and pins every spec file to its content digest.
 */
export function loadMethodRegistryV1(packageRoot: string): {
  readonly registryId: string;
  readonly entries: readonly MethodRegistryEntryV1[];
} {
  const raw = parseJson(path.join(packageRoot, "registry", "method-registry.json"));
  const v = raw as Record<string, unknown>;
  if (v.schemaVersion !== METHOD_REGISTRY_SCHEMA_V1 || typeof v.registryId !== "string" || !Array.isArray(v.specs)) {
    throw new Error("METHOD_REGISTRY_DENIED");
  }
  const entries = v.specs.map((item) => {
    const spec = item as Record<string, unknown>;
    if (typeof spec.path !== "string" || typeof spec.methodId !== "string" || typeof spec.specDigest !== "string"
      || !/^[a-f0-9]{64}$/.test(spec.specDigest) || !/^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.json$/.test(spec.path)) {
      throw new Error("METHOD_REGISTRY_ENTRY_DENIED");
    }
    const { path: specPath, methodId, specDigest } = spec;
    const sealed = parseJson(path.join(packageRoot, specPath)) as unknown;
    if (!validateMethodSpecV1(sealed) || (sealed as MethodSpecV1).methodId !== methodId
      || (sealed as MethodSpecV1).specDigest !== specDigest) {
      throw new Error("METHOD_REGISTRY_SPEC_DENIED");
    }
    return { path: specPath, methodId, specDigest };
  });
  return { registryId: v.registryId, entries };
}

export function loadMethodLibraryV1(args: {
  readonly corpusRoot: string;
  readonly packageRoot: string;
  readonly profile: unknown;
  readonly nowMs: number;
}): MethodLibraryV1 {
  const registry = loadMethodRegistryV1(args.packageRoot);
  const specFiles: readonly { readonly specPath: string; readonly methodId: string; readonly specDigest: string }[] = registry.entries.map((entry) => ({
    specPath: path.join(args.packageRoot, entry.path),
    methodId: entry.methodId,
    specDigest: entry.specDigest,
  }));
  const profile = args.profile as LocalFileCorpusProfileV1;
  let edition: LocalFileCorpusEditionV1 | null = null;
  let loadState: "LOADED" | "CONTENT_DRIFT_DENIED" = "LOADED";
  let driftedPaths: string[] = [];
  try {
    const built = readLocalFileCorpusEditionV1(args.corpusRoot, args.profile);
    if (!validateLocalFileCorpusEditionV1(built)) throw new Error("LOCAL_FILE_CORPUS_EDITION_INVALID");
    edition = built;
  } catch {
    // Fail closed: the corpus bytes drifted from the sealed profile. The
    // library stays usable for spec display but marks bound knowledge TAMPERED
    // and no method can be selected.
    loadState = "CONTENT_DRIFT_DENIED";
    const profileRecord = args.profile as Record<string, unknown>;
    const filesRaw: readonly unknown[] = Array.isArray(profileRecord.files) ? profileRecord.files : [];
    const declared: { rel: string; expected: string }[] = [];
    for (const f of filesRaw) {
      const item = f as Record<string, unknown>;
      if (typeof item.path === "string" && typeof item.expectedContentDigest === "string") {
        declared.push({ rel: item.path, expected: item.expectedContentDigest });
      }
    }
    driftedPaths = declared
      .filter((item) => {
        try {
          const bytes = readFileSync(path.join(args.corpusRoot, item.rel));
          return createHash("sha256").update(bytes).digest("hex") !== item.expected;
        } catch {
          return true;
        }
      })
      .map((item) => item.rel);
  }
  const observedAtMs = edition?.observedAtMs ?? profile.observedAtMs;
  const methods: MethodLibrarySpecV1[] = specFiles.map((entry) => {
    const spec = parseJson(entry.specPath) as unknown;
    if (!validateMethodSpecV1(spec) || (spec as MethodSpecV1).methodId !== entry.methodId
      || (spec as MethodSpecV1).specDigest !== entry.specDigest) {
      throw new Error("METHOD_REGISTRY_SPEC_DENIED");
    }
    const states: Record<string, KnowledgeStateV1> = {};
    const citations: Record<string, string[]> = {};
    const conflictsOut: { left: string; right: string; kind: string }[] = [];
    for (const ref of spec.knowledgeRefs) {
      const binding = KNOWLEDGE_REF_BINDINGS_V1[ref.ref as KnowledgeRefIdV1];
      if (binding === undefined) throw new Error("KNOWLEDGE_REF_BINDING_ABSENT");
      if (loadState === "CONTENT_DRIFT_DENIED" || edition === null) {
        states[ref.ref] = driftedPaths.includes(binding.path) ? "TAMPERED" : "ABSENT";
        citations[ref.ref] = [];
        continue;
      }
      const receipt = queryLocalFileCorpusV1(edition, binding.anchorQuery, "CURATED_READ", 8);
      const hits = receipt.results.filter((hit) => hit.path === binding.path);
      if (hits.length === 0) {
        states[ref.ref] = "ABSENT";
        citations[ref.ref] = [];
        continue;
      }
      const conflictHit = hits.find((hit) => hit.conflictsWith.length > 0);
      if (conflictHit !== undefined) {
        states[ref.ref] = "CONFLICT";
        citations[ref.ref] = hits.map((hit) => hit.citationId);
        for (const conflict of edition.conflicts) {
          if (hits.some((hit) => hit.citationId === conflict.leftCitationId
            || hit.citationId === conflict.rightCitationId)) {
            conflictsOut.push({ left: conflict.leftCitationId, right: conflict.rightCitationId, kind: conflict.kind });
          }
        }
        continue;
      }
      if (observedAtMs + ref.staleAfterMs < args.nowMs) {
        states[ref.ref] = "STALE";
        citations[ref.ref] = hits.map((hit) => hit.citationId);
        continue;
      }
      states[ref.ref] = "OK";
      citations[ref.ref] = hits.map((hit) => hit.citationId);
    }
    return {
      spec,
      knowledgeStates: states as unknown as MethodLibrarySpecV1["knowledgeStates"],
      knowledgeCitations: citations as unknown as MethodLibrarySpecV1["knowledgeCitations"],
      conflicts: conflictsOut,
    };
  });
  const unsigned = {
    schemaVersion: METHOD_LIBRARY_SCHEMA_V1,
    libraryId: "library:invoice-methods-v1",
    corpusId: edition?.corpusId ?? profile.corpusId,
    editionId: edition?.editionId ?? profile.editionId,
    manifestDigest: edition?.manifestDigest ?? sha({ state: loadState, driftedPaths }),
    observedAtMs,
    loadState,
    driftedPaths,
    methods: methods.map((m) => ({
      spec: m.spec,
      knowledgeStates: m.knowledgeStates,
      knowledgeCitations: m.knowledgeCitations,
      conflicts: m.conflicts,
    })),
  } satisfies Omit<MethodLibraryV1, "libraryDigest">;
  return { ...unsigned, libraryDigest: sha(unsigned) };
}

export function explainMethodV1(library: MethodLibraryV1, methodId: string): LibraryExplanationV1 | null {
  const entry = library.methods.find((m) => m.spec.methodId === methodId);
  if (entry === undefined) return null;
  const spec = entry.spec;
  return {
    methodId: spec.methodId,
    title: spec.title,
    meaning: spec.meaning,
    version: spec.version,
    supportedOutcomes: [...spec.supportedOutcomes],
    requiredData: spec.inputs.map((input) => ({
      inputId: input.inputId,
      meaning: input.meaning,
      unit: input.unit,
      requiredFields: input.requiredFields.map((f) => `${f.field}${f.nullable ? "?" : ""}`),
    })),
    preconditions: [...spec.preconditions],
    sources: spec.knowledgeRefs.map((ref) => ({
      ref: ref.ref as KnowledgeRefIdV1,
      kind: ref.kind,
      path: KNOWLEDGE_REF_BINDINGS_V1[ref.ref as KnowledgeRefIdV1].path,
      state: entry.knowledgeStates[ref.ref as KnowledgeRefIdV1] ?? "ABSENT",
      citations: entry.knowledgeCitations[ref.ref as KnowledgeRefIdV1] ?? [],
    })),
    contradictions: entry.conflicts,
  };
}

const tokenize = (query: string): string[] => [...new Set(
  query.toLowerCase().split(/[^a-z0-9äöüß]+/).filter((t) => t.length >= 3),
)].sort();

/** Deterministic token search over method specs (title/meaning/fields). */
export function searchMethodsV1(library: MethodLibraryV1, query: string): readonly { readonly methodId: string; readonly score: number }[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  return library.methods.map((m) => {
    const haystack = `${m.spec.title} ${m.spec.meaning} ${m.spec.inputs.map((i) => i.meaning).join(" ")}`.toLowerCase();
    let score = 0;
    for (const token of tokens) if (haystack.includes(token)) score += 1;
    return { methodId: m.spec.methodId, score };
  }).filter((m) => m.score > 0).sort((a, b) => b.score - a.score || a.methodId.localeCompare(b.methodId));
}

/**
 * Deterministic token search over the sealed corpus knowledge, bound to the
 * corpus receipt (digest-verified) and the library identity. The corpus
 * edition is the single source of text; this wrapper never embeds a second
 * copy of it.
 */
export function searchKnowledgeV1(args: {
  readonly library: MethodLibraryV1;
  readonly edition: LocalFileCorpusEditionV1 | null;
  readonly query: string;
  readonly maxResults?: number;
}): LibraryQueryResultV1 {
  const { library, edition, query } = args;
  const maxResults = args.maxResults ?? 10;
  if (edition === null) {
    const unsigned = {
      schemaVersion: "pansphaira.kts/method-library-query/v1",
      libraryId: library.libraryId,
      editionId: library.editionId,
      manifestDigest: library.manifestDigest,
      normalizedQuery: query,
      hits: [],
    } satisfies Omit<LibraryQueryResultV1, "queryDigest">;
    return { ...unsigned, queryDigest: sha(unsigned) };
  }
  const receipt = queryLocalFileCorpusV1(edition, query, "CURATED_READ", maxResults);
  const unsigned = {
    schemaVersion: "pansphaira.kts/method-library-query/v1",
    libraryId: library.libraryId,
    editionId: receipt.editionId,
    manifestDigest: receipt.manifestDigest,
    normalizedQuery: receipt.normalizedQuery,
    hits: receipt.results.map((hit) => ({
      citationId: hit.citationId,
      citation: hit.citation,
      path: hit.path,
      startLine: hit.startLine,
      text: hit.text,
      score: hit.score,
      conflictsWith: hit.conflictsWith,
    })),
  } satisfies Omit<LibraryQueryResultV1, "queryDigest">;
  return { ...unsigned, queryDigest: sha(unsigned) };
}

/**
 * Reasoned selection into the solution path: resolve knowledge states,
 * run the deterministic selector, and — on SELECTED — return the full
 * explanation that the guided path (KTS-02) consumes.
 */
export function buildLibraryViewV1(args: {
  readonly library: MethodLibraryV1;
  readonly goal: MethodGoalV1;
  readonly nowMs: number;
}): MethodLibraryViewV1 {
  const states = recheckKnowledgeStatesV1(args.library, args.nowMs);
  const resolution: KnowledgeResolutionV1 = { states };
  const selection = selectMethodsV1({
    goal: args.goal,
    candidates: args.library.methods.map((m) => m.spec),
    knowledge: resolution,
  });
  const explanation = selection.selected !== null
    ? explainMethodV1(args.library, selection.selected.methodId)
    : null;
  const unsigned = {
    schemaVersion: METHOD_LIBRARY_VIEW_SCHEMA_V1,
    libraryId: args.library.libraryId,
    manifestDigest: args.library.manifestDigest,
    selection,
    explanation,
  } satisfies Omit<MethodLibraryViewV1, "viewDigest">;
  return { ...unsigned, viewDigest: sha(unsigned) };
}

export { queryLocalFileCorpusV1, type LocalFileCorpusQueryReceiptV1, type LocalFileCorpusEditionV1 };
void MARGIN_THRESHOLD_METHOD_ID;
void methodGoalDigestV1;

/**
 * F4 — Wissensgültigkeitsprüfung bei Auswahl/Ausführung: the staleness
 * window of every REQUIRED knowledge ref is re-derived against the ACTUAL
 * call-time clock (`nowMs`), not the cached load-time state. A library that
 * was SELECTED at load time must become UNKNOWN once the observation is
 * older than the ref's staleAfterMs — even if the user sat on a Rückfrage
 * in between. Load-time states that are already worse (ABSENT/CONFLICT/
 * TAMPERED) are kept as-is (never re-claimed OK).
 */
export function recheckKnowledgeStatesV1(
  library: MethodLibraryV1,
  nowMs: number,
): Record<string, KnowledgeStateV1> {
  const states: Record<string, KnowledgeStateV1> = {};
  for (const entry of library.methods) {
    for (const ref of entry.spec.knowledgeRefs) {
      const cached = entry.knowledgeStates[ref.ref as KnowledgeRefIdV1] ?? "ABSENT";
      if (cached === "OK" && library.observedAtMs + ref.staleAfterMs < nowMs) {
        states[ref.ref] = "STALE";
      } else {
        states[ref.ref] = cached;
      }
    }
  }
  return states;
}

/**
 * F1/F3 — geschlossene Zielauswahl (no free-form NLP): the user picks the
 * fachliche Absicht from this closed list; the exact objective text is then
 * bound into the sealed goal. An "unknown" objective is the honest
 * representation of a goal that could not be mapped to a closed intention.
 */
export const METHOD_GOAL_OBJECTIVE_CHOICES_V1: readonly {
  readonly label: string;
  readonly objective: string;
  readonly requestedOutcome: "FLAG_RECORDS" | "COMPUTE_TOTAL";
}[] = [
  {
    label: "Rechnungen unter einem vom Nutzer bestaetigten Mindestgrenzwert markieren",
    objective: "Rechnungen unterhalb eines Mindestgrenzwerts pruefen und markieren",
    requestedOutcome: "FLAG_RECORDS",
  },
  {
    label: "Summe der Gesamtbetraege aller Rechnungen berechnen",
    objective: "Summe der Gesamtbetraege aller Rechnungen eines Datenkontexts berechnen",
    requestedOutcome: "COMPUTE_TOTAL",
  },
] as const;
