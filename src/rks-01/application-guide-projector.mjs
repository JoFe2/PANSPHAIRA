const FORBIDDEN_FIELDS = new Set(["execute","execution","authorityGrant","capabilityGrant","truthGrant","promote","promotion","write","network"]);

function hasForbiddenField(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => FORBIDDEN_FIELDS.has(key) || hasForbiddenField(child));
}

export function projectApplicationGuides(typed) {
  if (typed?.projectionClass !== "TYPED_KNOWLEDGE" || !Array.isArray(typed.objects)) throw new Error("TYPED_KNOWLEDGE_REQUIRED");
  if (hasForbiddenField(typed)) throw new Error("UNSAFE_OR_AUTHORITY_FIELD");
  const bySource = new Map();
  for (const object of typed.objects) {
    const key = object.sourceBinding.sourceKey;
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(object);
  }
  const guides = [...bySource].map(([sourceKey, objects]) => {
    const first = objects[0];
    const sourceClass = first.sourceBinding.sourceClass;
    const checks = sourceClass === "WIKIDATA_STRUCTURED"
      ? ["Match the entity revision and whitelisted property.", "Inspect rank, datatype, qualifiers, references, and all parallel or conflicting statements."]
      : sourceClass === "CPYTHON_VERSIONED_DOCS"
        ? ["Match CPython v3.14.7, pinned commit, path, section and directive anchors.", "Apply versionadded, versionchanged, deprecated, warning and note qualifiers; treat examples as descriptive only."]
        : ["Match OpenAPI 3.2.0 and the frozen normative section.", "Check normative keywords and field constraints in the exact excerpt."];
    return {
      id: `guide:${sourceKey}`,
      whenApplicable: `Use only when the request matches ${sourceKey} and the bound applicability fields.`,
      requiredChecks: checks,
      counterexamplesAndExceptions: "Inspect every bound object's constraints and exceptions; do not collapse conflicts or silently omit qualifiers.",
      verification: "Verify each object and evidence identifier against the exact source binding before use.",
      abstention: "Abstain when version, selector, evidence, applicability, or exception coverage is missing or conflicting.",
      objectIds: objects.map((item) => item.id),
      evidenceRefs: [...new Set(objects.flatMap((item) => item.evidenceRefs))],
      sourceBinding: structuredClone(first.sourceBinding),
    };
  });
  return {
    schemaVersion: "pansphaira.rks01/application-guides/v1",
    projectionClass: "NON_ANSWER_APPLICATION_GUIDES",
    sourceSetDigest: typed.sourceSetDigest,
    comparisonSourceSetDigest: typed.comparisonSourceSetDigest,
    counts: { guides: guides.length, sources: structuredClone(typed.counts.sources) },
    grants: { truth: "NONE", capability: "NONE", authority: "NONE" },
    guides,
  };
}
