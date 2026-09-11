/**
 * V001 delivery-contract intake template — focused, fail-closed structural test.
 *
 * Validates `.github/ISSUE_TEMPLATE/delivery-contract.yml` with a real YAML
 * parser (the `yaml` package), not keyword searches on the raw text. The
 * validator is a pure function of the parsed form plus a small set of
 * stable text markers (section headers, hold/claim guards, links) and returns
 * coded problems; an empty list means the template is valid.
 *
 * Coverage (AC01/AC04):
 *  - valid GitHub issue-form YAML structure (name/description/title/body);
 *  - unique field ids;
 *  - every required delivery-contract field present and `required: true`;
 *  - the four required sections (Ergebnis/DoD, Readiness, Integration/Lieferung,
 *    Fortsetzung/Nachweis);
 *  - links to the contributor guide and the release governance contract;
 *  - safe defaults: no pre-filled success / READY / approval / certification
 *    claims in any field placeholder, and the explicit hold + no-claim guards
 *    are present (removing either is a hold-/claim-removing change and fails).
 *
 * Negative probes (AC04) mutate a parsed copy and re-serialize it, then assert
 * the corresponding coded problem is raised:
 *  - missing statement boundary (non-claims) / authority / owner / reviewer;
 *  - a hold-removing change (the hold guard is removed);
 *  - a pre-filled affirmative claim smuggled into a placeholder;
 *  - a required link removed.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const TEMPLATE_PATH = ".github/ISSUE_TEMPLATE/delivery-contract.yml";

// The four required sections, detected by stable tokens in the markdown fields.
const SECTION_TOKENS = ["Ergebnis", "Readiness", "Integration", "Fortsetzung"];

// Stable guard phrases that must remain present. Removing the hold guard is a
// hold-removing change; removing the claim guard removes the statement boundary.
const HOLD_GUARD = "grants no approval and lifts no holds";
const CLAIM_GUARD = "does not assert readiness, delivery, or certification";

// Links the template must carry (contributor guide + release governance contract).
const LINKS = ["CONTRIBUTING.md", "docs/RELEASE-GOVERNANCE.md"];

// Every delivery-contract field the template must capture, each required.
// The set encodes: result + non-claims (statement boundary), acceptance class,
// hard AC with evidence type, versioned inputs/provenance, authority, technical
// prerequisites kept separate from external evidence/holds/administration,
// priority, shared integration surfaces, candidate line, delivery owner,
// independent reviewer, and the on-hold owner + resume trigger.
const REQUIRED_FIELDS = [
  "result",
  "non_claims",
  "acceptance_class",
  "hard_ac",
  "inputs_provenance",
  "authority",
  "technical_prereqs",
  "external_holds_admin",
  "priority",
  "integration_surfaces",
  "candidate_line",
  "delivery_owner",
  "independent_reviewer",
  "hold_owner",
  "resume_trigger",
  "evidence_plan",
];

// Affirmative claim tokens that must never appear pre-filled in a placeholder.
// Matched as whole words, case-insensitively, over placeholder text only.
const CLAIM_TOKENS = [
  "ready",
  "approved",
  "certified",
  "delivered",
  "freigabe",
  "freigegeben",
  "bestätigt",
];
const CLAIM_TOKEN_RE = new RegExp(`\\b(?:${CLAIM_TOKENS.join("|")})\\b`, "i");

/** Pure validator. Returns a list of coded problems; empty means valid. */
function validateDeliveryContract(source) {
  const problems = [];
  let doc;
  try {
    doc = parse(source);
  } catch {
    return ["yaml-invalid"];
  }
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return ["structure-top"];
  }

  for (const key of ["name", "description", "title"]) {
    if (typeof doc[key] !== "string" || doc[key].trim() === "") problems.push(`structure-top:${key}`);
  }
  if (!Array.isArray(doc.body) || doc.body.length === 0) {
    return [...problems, "structure-body-not-array"];
  }

  const fields = doc.body;
  const ids = new Map();
  const placeholders = [];
  let markdown = "";

  for (const [index, field] of fields.entries()) {
    if (typeof field !== "object" || field === null || Array.isArray(field)) {
      problems.push(`field-not-object:${index}`);
      continue;
    }
    if (typeof field.type !== "string" || field.type === "") problems.push(`field-missing-type:${index}`);
    const id = typeof field.id === "string" ? field.id : "";
    if (field.type !== "markdown") {
      if (id === "") problems.push(`field-missing-id:${index}`);
      else {
        const prior = ids.get(id);
        if (prior === undefined) ids.set(id, index);
        else problems.push(`duplicate-id:${id}`);
      }
    }
    const attributes =
      typeof field.attributes === "object" && field.attributes !== null && !Array.isArray(field.attributes)
        ? field.attributes
        : {};
    if (typeof attributes.placeholder === "string") placeholders.push(attributes.placeholder);
    if (field.type === "markdown" && typeof attributes.value === "string") markdown += `\n${attributes.value}`;
  }

  for (const requiredId of REQUIRED_FIELDS) {
    if (!ids.has(requiredId)) {
      problems.push(`missing-field:${requiredId}`);
      continue;
    }
    const field = fields[ids.get(requiredId)];
    const validations =
      typeof field.validations === "object" && field.validations !== null && !Array.isArray(field.validations)
        ? field.validations
        : {};
    if (validations.required !== true) problems.push(`not-required:${requiredId}`);
  }

  for (const token of SECTION_TOKENS) {
    if (!markdown.includes(token)) problems.push(`missing-section:${token}`);
  }
  if (!markdown.includes(HOLD_GUARD)) problems.push("missing-hold-guard");
  if (!markdown.includes(CLAIM_GUARD)) problems.push("missing-claim-guard");

  const fullText = source;
  for (const link of LINKS) {
    if (!fullText.includes(link)) problems.push(`missing-link:${link}`);
  }

  for (const placeholder of placeholders) {
    const match = placeholder.match(CLAIM_TOKEN_RE);
    if (match) problems.push(`pre-filled-claim:${match[0].toLowerCase()}`);
  }

  return problems;
}

/** Parse the template, apply `mutate` to the object, re-serialize. */
function withMutation(mutate) {
  const doc = parse(readFileSync(new URL(TEMPLATE_PATH, ROOT), "utf8"));
  mutate(doc);
  return stringify(doc);
}

const source = () => readFileSync(new URL(TEMPLATE_PATH, ROOT), "utf8");
const fieldIndex = (doc, id) => doc.body.findIndex((f) => f && f.id === id);

test("delivery-contract template is a valid GitHub form with every required field, section, guard and link", () => {
  const problems = validateDeliveryContract(source());
  assert.deepEqual(problems, []);
});

test("field ids are unique and all sixteen contract fields are required", () => {
  const problems = validateDeliveryContract(source());
  assert.equal(problems.filter((p) => p.startsWith("duplicate-id:")).length, 0);
  assert.equal(problems.filter((p) => p.startsWith("missing-field:")).length, 0);
  assert.equal(problems.filter((p) => p.startsWith("not-required:")).length, 0);
});

test("negative: removing the statement boundary (non-claims) is detected", () => {
  const mutated = withMutation((doc) => {
    doc.body.splice(fieldIndex(doc, "non_claims"), 1);
  });
  assert.ok(validateDeliveryContract(mutated).includes("missing-field:non_claims"));
});

test("negative: removing the authority field is detected", () => {
  const mutated = withMutation((doc) => {
    doc.body.splice(fieldIndex(doc, "authority"), 1);
  });
  assert.ok(validateDeliveryContract(mutated).includes("missing-field:authority"));
});

test("negative: removing the delivery owner field is detected", () => {
  const mutated = withMutation((doc) => {
    doc.body.splice(fieldIndex(doc, "delivery_owner"), 1);
  });
  assert.ok(validateDeliveryContract(mutated).includes("missing-field:delivery_owner"));
});

test("negative: removing the independent reviewer field is detected", () => {
  const mutated = withMutation((doc) => {
    doc.body.splice(fieldIndex(doc, "independent_reviewer"), 1);
  });
  assert.ok(validateDeliveryContract(mutated).includes("missing-field:independent_reviewer"));
});

test("negative: a hold-removing change (dropping the hold guard) is detected", () => {
  const mutated = withMutation((doc) => {
    for (const field of doc.body) {
      if (field.type === "markdown" && field.attributes?.value?.includes(HOLD_GUARD)) {
        field.attributes.value = field.attributes.value.replace(HOLD_GUARD, "may be treated as approved");
      }
    }
  });
  const problems = validateDeliveryContract(mutated);
  assert.ok(problems.includes("missing-hold-guard"), `expected missing-hold-guard in ${problems.join(", ")}`);
});

test("negative: removing the no-claim guard (statement boundary) is detected", () => {
  const mutated = withMutation((doc) => {
    for (const field of doc.body) {
      if (field.type === "markdown" && field.attributes?.value?.includes(CLAIM_GUARD)) {
        field.attributes.value = field.attributes.value.replace(CLAIM_GUARD, "asserts full readiness");
      }
    }
  });
  assert.ok(validateDeliveryContract(mutated).includes("missing-claim-guard"));
});

test("negative: a pre-filled READY claim in a placeholder is detected", () => {
  const mutated = withMutation((doc) => {
    const index = fieldIndex(doc, "priority");
    doc.body[index].attributes.placeholder = "Priority is READY for release.";
  });
  assert.ok(validateDeliveryContract(mutated).some((p) => p.startsWith("pre-filled-claim:")));
});

test("negative: removing a required link is detected", () => {
  const mutated = withMutation((doc) => {
    for (const field of doc.body) {
      if (field.type === "markdown" && typeof field.attributes?.value === "string") {
        field.attributes.value = field.attributes.value.split("docs/RELEASE-GOVERNANCE.md").join("");
      }
    }
  });
  assert.ok(validateDeliveryContract(mutated).includes("missing-link:docs/RELEASE-GOVERNANCE.md"));
});

test("negative: malformed YAML is rejected as invalid, not silently accepted", () => {
  assert.deepEqual(validateDeliveryContract("name: [unclosed\nbody: {"), ["yaml-invalid"]);
});