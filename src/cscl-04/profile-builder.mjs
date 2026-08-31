import { createHash } from "node:crypto";

export const CAPTURE_BYTE_CAP = 20 * 1024 * 1024;
export const EXPECTED_IDENTITY = Object.freeze({
  officialRepository: "https://github.com/Dolibarr/dolibarr.git",
  selector: "refs/tags/24.0.0",
  version: "24.0.0",
  tagObject: "5dd1b29feb8014839b54bb0f48d988eeac3c61dd",
  peeledCommit: "769c7db907099643558e77d7002c109cfda919e5",
});

const SELECTOR_SET_DIGEST = "ea6029f3691b5e4ac635945541a2680b9c81eaefb712c3c936dc33fbbe724afc";
const QUESTION_INVENTORY_DIGEST = "842527ddfdc7fb706b2fd0af798be286c03aa85b37152a011a8f0affff331c28";
const EXPECTED_CAPTURE_DIGEST = "07ba842a00c7c14af4e76e462366f651f0fa57a8b2714481b72485ab5a530c1e";
const BOUNDARY = Object.freeze({ authorityGrant: "NONE", promotionGrant: "NONE", executionGrant: "NONE" });
const ABSENT_CANDIDATE_DIGEST = sha256(Buffer.from("NO_CANDIDATE_FROZEN_CSCL04", "utf8"));
const CAPABILITY_FAMILIES = Object.freeze([
  "PARTY_CUSTOMER_MANAGEMENT", "PRODUCT_ITEM_MANAGEMENT", "SALES_ORDER_MANAGEMENT",
]);
const QUESTIONS = Object.freeze([
  "objects-roles", "relations", "operations", "inputs-outputs", "states-transitions", "events",
  "preconditions", "invariants", "exceptions-errors", "readbacks", "api-service-exposure", "absence-ambiguity-conflict",
]);

const EXPECTED_FILES = Object.freeze({
  "COPYING": "e79e9c8a0c85d735ff98185918ec94ed7d175efc377012787aebcf3b80f0d90b",
  "COPYRIGHT": "fd7af4265dc91aafd0f4dd87549c45b2a21da7761211aca1af500a1ec6c76b6e",
  "htdocs/societe/class/societe.class.php": "b7ef003f25a9b416987e2ce1394832b44eb8f7f384e3d6ebfe69867027f2ceec",
  "htdocs/societe/class/api_thirdparties.class.php": "858f5dd54e7159cda929e120645a8a3bbd1746d05253f97fb347c040b2a42633",
  "htdocs/product/class/product.class.php": "e8cb3cfd0601a2d6dbcc4da1842f428cfa798dbd68c7f7a082a99a1c75def385",
  "htdocs/product/class/api_products.class.php": "911a6805929fdf2b11aad154577ad9f7205a15b4998eec6e47580da5d152ba4a",
  "htdocs/commande/class/commande.class.php": "f9ab06f8ed3fdd431f5b46111c5f3ace28749f0a2527e0788734af1b2d25e98a",
  "htdocs/commande/class/api_orders.class.php": "a8273a23f1640bbae454f8fddf75cdaa0fa7c501397e09b8e381aff7bae87ef4",
  "htdocs/install/mysql/tables/llx_societe.sql": "baa2164e02016717396fc7cde70018556bc3a379687f9c52e9db5530341b5fb6",
  "htdocs/install/mysql/tables/llx_product.sql": "a5db27acff7431ceb06e34028f49de9e2630080daee7737a5f6cf6db945ee316",
  "htdocs/install/mysql/tables/llx_commande.sql": "642b5c7a7c2d5c71585c54acaa50727ff7b642b89c10586f9151ff605e631f07",
  "htdocs/install/mysql/tables/llx_commandedet.sql": "f2609b3d9af215745e725a3f9753482948be640879f03066b8a5d6c9fad05705",
  "git-object/tag-5dd1b29feb8014839b54bb0f48d988eeac3c61dd": "d9179ad3344fa9a28131a928bda3fcd598944b1216d3d1f21993a18107b9fd1a",
  "git-object/commit-769c7db907099643558e77d7002c109cfda919e5": "c33de3da0c88e3b660522cd2a3dd9e820ad9deb78e8209ca998c3c095abcd322",
});

const D = (path, lines, claim, state = "SUPPORTED", counterexamples = []) => ({ path, lines, claim, state, counterexamples });
const DEFINITIONS = Object.freeze({
  PARTY_CUSTOMER_MANAGEMENT: {
    "objects-roles": D("htdocs/install/mysql/tables/llx_societe.sql", [25, 45], "llx_societe stores a third party name and separate code_client and code_fournisseur fields."),
    relations: D("htdocs/install/mysql/tables/llx_societe.sql", [25, 40], "llx_societe has a parent field and keeps customer and supplier codes on the same llx_societe row."),
    operations: D("htdocs/societe/class/societe.class.php", [995, 1003], "Societe::create creates a third party in the database and returns a nonnegative result on success or a negative result on failure."),
    "inputs-outputs": D("htdocs/societe/class/api_thirdparties.class.php", [300, 352], "Thirdparties::post validates request_data, copies checked fields to Societe, calls Societe::create, and returns the created company id."),
    "states-transitions": D("htdocs/societe/class/societe.class.php", [642, 658], "Societe::$client uses 0=no customer, 1=customer, 2=prospect, 3=customer and prospect; $fournisseur uses 0=no supplier and 1=supplier."),
    events: D("htdocs/societe/class/societe.class.php", [1133, 1141], "Successful Societe creation calls the COMPANY_CREATE trigger unless triggers are disabled."),
    preconditions: D("htdocs/societe/class/societe.class.php", [1264, 1284], "Societe parameter verification requires a nonempty name and checks customer-code syntax, requirement, uniqueness, and prefix conditions when client is set."),
    invariants: D("htdocs/install/mysql/tables/llx_societe.sql", [25, 40], "llx_societe has a primary rowid, entity defaults to 1 and is NOT NULL, and status denotes active or closed/not open."),
    "exceptions-errors": D("htdocs/societe/class/societe.class.php", [1154, 1162], "A duplicate Societe database record yields ErrorCompanyNameAlreadyExists and a negative result; other database failure uses the database error."),
    readbacks: D("htdocs/societe/class/api_thirdparties.class.php", [372, 412], "Thirdparties::put fetches the Societe, updates it, and on success returns Thirdparties::get for the same id."),
    "api-service-exposure": D("htdocs/societe/class/api_thirdparties.class.php", [82, 105], "The Thirdparties API exposes get(id) and GET email/{email} read boundaries returning cleaned Societe data."),
    "absence-ambiguity-conflict": D("htdocs/install/mysql/tables/llx_societe.sql", [82, 90], "The llx_societe SQL comment describes client as 0/1/2 while Societe::$client separately documents 0..3, so the captured native sources conflict on the documented client value range.", "CONFLICTING", ["llx_societe.sql says client 0/1/2; societe.class.php says 0=no customer, 1=customer, 2=prospect, 3=customer and prospect."]),
  },
  PRODUCT_ITEM_MANAGEMENT: {
    "objects-roles": D("htdocs/install/mysql/tables/llx_product.sql", [25, 65], "llx_product stores ref, label, prices, tosell, tobuy, tobatch and fk_product_type; fk_product_type 0 is regular product and 1 is service."),
    relations: D("htdocs/install/mysql/tables/llx_product.sql", [92, 112], "llx_product carries fk_default_warehouse, fk_default_bom, fk_default_workstation, fk_unit and fk_project references."),
    operations: D("htdocs/product/class/product.class.php", [962, 965], "Product::create creates a product/service and returns its id on success or a negative value on failure."),
    "inputs-outputs": D("htdocs/product/class/api_products.class.php", [333, 378], "Products::post validates request_data, checks fields, calls Product::create and returns the Product id."),
    "states-transitions": D("htdocs/install/mysql/tables/llx_product.sql", [58, 66], "llx_product uses tosell and tobuy flags, tobatch, and fk_product_type values 0 regular product, 1 service, and 9 other."),
    events: D("htdocs/product/class/product.class.php", [1281, 1287], "Successful Product creation calls the PRODUCT_CREATE trigger unless triggers are disabled."),
    preconditions: D("htdocs/product/class/product.class.php", [1078, 1087], "Product::create requires label and ref; missing label records ErrorMandatoryParametersNotProvided."),
    invariants: D("htdocs/install/mysql/tables/llx_product.sql", [25, 38], "llx_product requires ref, entity and label, with rowid as primary key and entity defaulting to 1."),
    "exceptions-errors": D("htdocs/product/class/api_products.class.php", [400, 426], "Products::put rejects id below 1, missing rights, missing Product, denied resource access, and direct stock_reel update through this boundary."),
    readbacks: D("htdocs/product/class/api_products.class.php", [548, 552], "After successful Products::put, the API returns Products::get(id)."),
    "api-service-exposure": D("htdocs/product/class/api_products.class.php", [90, 121], "The Products API exposes get(id) and GET ref/{ref} read boundaries."),
    "absence-ambiguity-conflict": D("htdocs/install/mysql/tables/llx_product.sql", [92, 104], "llx_product labels stock as DENORMALIZED, fifo and lifo as TODO/not used, and hidden as not used/deprecated; these fields do not establish active operations in the captured profile.", "AMBIGUOUS", ["Field presence is not treated as evidence that fifo, lifo, or hidden behavior is implemented."]),
  },
  SALES_ORDER_MANAGEMENT: {
    "objects-roles": D("htdocs/install/mysql/tables/llx_commande.sql", [22, 44], "llx_commande stores an order header with ref, ref_client, fk_soc, dates, author/modifier/validator/closer users and fk_statut."),
    relations: D("htdocs/install/mysql/tables/llx_commandedet.sql", [23, 30], "llx_commandedet rows relate to llx_commande through fk_commande and may relate to fk_parent_line and fk_product."),
    operations: D("htdocs/commande/class/commande.class.php", [510, 513], "Commande::valid validates an order, optionally using an idwarehouse, and returns negative on failure, zero when nothing is done, or positive on success."),
    "inputs-outputs": D("htdocs/commande/class/commande.class.php", [1609, 1613], "Commande::addline takes native desc, pu_ht, qty, tax, product, discount, date, type, unit, origin and reference inputs for an order line."),
    "states-transitions": D("htdocs/commande/class/commande.class.php", [388, 415], "Commande statuses are STATUS_CANCELED=-1, STATUS_DRAFT=0, STATUS_VALIDATED=1, STATUS_SHIPMENTONPROCESS=2 and STATUS_CLOSED=3."),
    events: D("htdocs/commande/class/commande.class.php", [604, 610], "Successful validation calls the ORDER_VALIDATE trigger unless triggers are disabled."),
    preconditions: D("htdocs/commande/class/commande.class.php", [518, 525], "Commande::valid does nothing when status is already STATUS_VALIDATED."),
    invariants: D("htdocs/install/mysql/tables/llx_commande.sql", [22, 45], "llx_commande requires ref, entity and fk_soc; rowid is primary key and fk_statut defaults to 0."),
    "exceptions-errors": D("htdocs/commande/class/api_orders.class.php", [127, 141], "Orders::_fetch rejects missing read right, absent ID/ref/ref_ext, missing order and denied commande resource access with REST errors."),
    readbacks: D("htdocs/commande/class/api_orders.class.php", [384, 410], "GET {id}/lines fetches the Commande, checks read/resource access, loads getLinesArray and returns cleaned order lines."),
    "api-service-exposure": D("htdocs/commande/class/api_orders.class.php", [380, 424], "The Orders API exposes GET {id}/lines and GET {id}/lines/{lineid}."),
    "absence-ambiguity-conflict": D("htdocs/commande/class/commande.class.php", [402, 415], "STATUS_ACCEPTED=2 is retained only for backward compatibility and deprecated in favor of STATUS_SHIPMENTONPROCESS=2; the same stored value has two native constant names.", "CONFLICTING", ["STATUS_ACCEPTED and STATUS_SHIPMENTONPROCESS both equal 2, while STATUS_ACCEPTED is deprecated."]),
  },
});

function encodeCanonical(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(encodeCanonical).join(",")}]`;
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${encodeCanonical(value[key])}`).join(",")}}`;
  throw new Error("UNSAFE_CANONICAL_VALUE");
}
export const canonicalJson = encodeCanonical;
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function digestRecord(record, digestField) { const copy = structuredClone(record); delete copy[digestField]; return sha256(Buffer.from(canonicalJson(copy))); }
function same(a, b) { return canonicalJson(a) === canonicalJson(b); }

export function validateCapture(capture) {
  const reasons = [];
  if (capture?.identity?.tagObject !== EXPECTED_IDENTITY.tagObject) reasons.push("ANNOTATED_TAG_OBJECT_MISMATCH");
  if (capture?.identity?.peeledCommit !== EXPECTED_IDENTITY.peeledCommit) reasons.push("PEELED_COMMIT_MISMATCH");
  if (capture?.identity?.officialRepository !== EXPECTED_IDENTITY.officialRepository || capture?.identity?.selector !== EXPECTED_IDENTITY.selector || capture?.identity?.version !== EXPECTED_IDENTITY.version) reasons.push("OFFICIAL_REPOSITORY_MISMATCH");
  if (capture?.legal?.licenseId !== "GPL-3.0-or-later" || capture?.legal?.licenseSha256 !== EXPECTED_FILES.COPYING || capture?.legal?.noticeSha256 !== EXPECTED_FILES.COPYRIGHT) reasons.push("LICENSE_ID_MISMATCH");
  if (!same(capture?.parser, { id: "dolibarr-source-lines", version: "1.0.0" })) reasons.push("PARSER_VERSION_MISMATCH");
  if (!same(capture?.canonicalizer, { id: "sorted-key-json", version: "1.0.0" })) reasons.push("CANONICALIZER_VERSION_MISMATCH");
  if (capture?.networkPolicy !== "OFFLINE_REPLAY_ONLY") reasons.push("OFFLINE_NETWORK_POLICY_MISMATCH");
  const files = Array.isArray(capture?.files) ? capture.files : [];
  if (!same(files.map((x) => x.path), Object.keys(EXPECTED_FILES))) reasons.push("CAPTURE_PATH_SET_MISMATCH");
  let total = 0;
  for (const file of files) {
    let bytes;
    try { bytes = file.encoding === "base64" ? Buffer.from(file.base64, "base64") : Buffer.alloc(0); } catch { bytes = Buffer.alloc(0); }
    total += bytes.length;
    if (file.encoding !== "base64" || file.byteLength !== bytes.length || file.sha256 !== sha256(bytes) || EXPECTED_FILES[file.path] !== file.sha256) reasons.push("SOURCE_BYTES_DIGEST_MISMATCH");
  }
  if (capture?.totalDecodedBytes > CAPTURE_BYTE_CAP || total > CAPTURE_BYTE_CAP) reasons.push("CAPTURE_BYTE_CAP_EXCEEDED");
  if (capture?.totalDecodedBytes !== total) reasons.push("CAPTURE_TOTAL_MISMATCH");
  const supplied = capture?.captureDigest;
  const copy = structuredClone(capture); delete copy.captureDigest;
  const actual = sha256(Buffer.from(canonicalJson(copy)));
  if (supplied !== actual || supplied !== EXPECTED_CAPTURE_DIGEST) reasons.push("CAPTURE_MANIFEST_DIGEST_MISMATCH");
  return { valid: reasons.length === 0, reasonCodes: [...new Set(reasons)] };
}

function excerpt(file, [startLine, endLine]) {
  const bytes = Buffer.from(file.base64, "base64");
  const starts = [0];
  for (let i = 0; i < bytes.length; i += 1) if (bytes[i] === 10) starts.push(i + 1);
  if (startLine < 1 || endLine < startLine || startLine > starts.length) throw new Error("EVIDENCE_LINE_RANGE_INVALID");
  const byteStart = starts[startLine - 1];
  const byteEnd = endLine < starts.length ? starts[endLine] : bytes.length;
  return { bytes: bytes.subarray(byteStart, byteEnd), byteStart, byteEnd };
}

function factFor(capture, family, questionId, definition) {
  const file = capture.files.find((item) => item.path === definition.path);
  const selected = excerpt(file, definition.lines);
  const fact = {
    schemaVersion: "pansphaira.cscl01/source-fact/v1",
    factId: `dolibarr.${family.toLowerCase().replaceAll("_", "-")}.${questionId}`,
    systemId: "dolibarr", systemRole: "TRAINING", capabilityFamily: family, questionId,
    claim: definition.claim,
    sourceIdentity: { selectorSetDigest: SELECTOR_SET_DIGEST, immutableSelector: `${EXPECTED_IDENTITY.selector}@${EXPECTED_IDENTITY.tagObject}^{}=${EXPECTED_IDENTITY.peeledCommit}`, sourceBytesSha256: file.sha256 },
    exactEvidence: {
      exactLocator: `git:${EXPECTED_IDENTITY.peeledCommit};path=${file.path};lines=${definition.lines[0]}-${definition.lines[1]};bytes=${selected.byteStart}-${selected.byteEnd}`,
      excerptSha256: sha256(selected.bytes), byteStart: selected.byteStart, byteEnd: selected.byteEnd,
    },
    legal: {
      licenseId: "GPL-3.0-or-later", licenseSha256: EXPECTED_FILES.COPYING,
      obligations: ["PRESERVE_LICENSE_AND_COPYRIGHT_NOTICES", "LICENSE_COVERED_DERIVATIVES_UNDER_GPL", "PROVIDE_CORRESPONDING_SOURCE_WHEN_CONVEYING", "RETAIN_COMPONENT_SPECIFIC_LICENSES"],
      noticeStatus: "PRESENT",
      noticeUrl: `https://raw.githubusercontent.com/Dolibarr/dolibarr/${EXPECTED_IDENTITY.peeledCommit}/COPYRIGHT`,
      noticeBytes: 6876, noticeSha256: EXPECTED_FILES.COPYRIGHT, attribution: [],
    },
    parser: capture.parser, canonicalizer: capture.canonicalizer, boundary: BOUNDARY,
  };
  fact.factDigest = digestRecord(fact, "factDigest");
  return fact;
}

export function buildDolibarrProfile(capture) {
  const checked = validateCapture(capture);
  if (!checked.valid) throw new Error(checked.reasonCodes.join(","));
  const sourceFacts = [];
  const cells = [];
  for (const family of CAPABILITY_FAMILIES) for (const questionId of QUESTIONS) {
    const definition = DEFINITIONS[family][questionId];
    const fact = factFor(capture, family, questionId, definition);
    sourceFacts.push(fact);
    const nativeMeaningSha256 = sha256(Buffer.from(definition.claim));
    const bareCell = {
      schemaVersion: "pansphaira.cscl01/evidence-cell/v1", systemId: "dolibarr", questionId,
      state: definition.state,
      equivalenceProof: { nativeMeaningSha256, candidateMeaningSha256: ABSENT_CANDIDATE_DIGEST },
      evidence: [{ sourceFactId: fact.factId, exactLocator: fact.exactEvidence.exactLocator, excerptSha256: fact.exactEvidence.excerptSha256 }],
      counterexamples: definition.counterexamples, boundary: BOUNDARY,
    };
    cells.push({ capabilityFamily: family, ...bareCell, cellDigest: sha256(Buffer.from(canonicalJson(bareCell))) });
  }
  const terms = [
    ["Societe", "Dolibarr class whose table_element is societe.", 0], ["client", "Societe customer/prospect role flag.", 4],
    ["fournisseur", "Societe supplier role flag.", 4], ["llx_societe", "Third-party table.", 1],
    ["Product", "Dolibarr product/service class.", 14], ["TYPE_PRODUCT", "Regular product type value 0.", 16],
    ["TYPE_SERVICE", "Service type value 1.", 16], ["llx_product", "Product/service table.", 12],
    ["Commande", "Dolibarr customer-order class.", 26], ["llx_commande", "Customer-order header table.", 24],
    ["llx_commandedet", "Customer-order detail-line table.", 25], ["STATUS_SHIPMENTONPROCESS", "Commande status value 2 when a shipment is validated.", 28],
  ].map(([term, meaning, index]) => ({ term, meaning, sourceFactDigest: sourceFacts[index].factDigest }));
  const profile = {
    schemaVersion: "pansphaira.cscl01/system-profile/v1", profileId: "dolibarr.24.0.0.source-native-profile",
    systemId: "dolibarr", systemRole: "TRAINING", selectorSetDigest: SELECTOR_SET_DIGEST,
    questionInventoryDigest: QUESTION_INVENTORY_DIGEST,
    sourceFactDigests: sourceFacts.map((fact) => fact.factDigest), sourceNativeTerminology: terms,
    capabilityFamilies: [...CAPABILITY_FAMILIES],
    evidenceCells: cells.map((cell) => ({ capabilityFamily: cell.capabilityFamily, questionId: cell.questionId, cellDigest: cell.cellDigest })),
    holdoutIsolation: "TRAINING_PROFILE", boundary: BOUNDARY,
  };
  profile.profileDigest = digestRecord(profile, "profileDigest");
  return { schemaVersion: "pansphaira.cscl04/profile-bundle/v1", captureDigest: capture.captureDigest, sourceFacts, cells, profile, counts: { capabilityFamilies: 3, questionsPerFamily: 12, cells: 36, sourceFacts: 36 } };
}

export function renderProfileArtifacts(capture) {
  const bundle = buildDolibarrProfile(capture);
  const rawCells = bundle.cells.map(({ capabilityFamily, cellDigest, ...cell }) => ({ capabilityFamily, cellDigest, cell }));
  const records = {
    "source-facts-v1.json": { schemaVersion: "pansphaira.cscl04/source-fact-set/v1", sourceFacts: bundle.sourceFacts },
    "evidence-cells-v1.json": { schemaVersion: "pansphaira.cscl04/evidence-cell-set/v1", cells: rawCells },
    "system-profile-v1.json": bundle.profile,
  };
  return Object.fromEntries(Object.entries(records).map(([name, value]) => [name, `${canonicalJson(value)}\n`]));
}

export function validateProfileBundle(bundle) {
  const reasons = [];
  const topKeys = ["schemaVersion", "captureDigest", "sourceFacts", "cells", "profile", "counts"];
  if (!same(Object.keys(bundle ?? {}).sort(), topKeys.sort())) reasons.push("EXTRA_FIELD_FORBIDDEN");
  const profileKeys = ["schemaVersion", "profileId", "systemId", "systemRole", "selectorSetDigest", "questionInventoryDigest", "sourceFactDigests", "sourceNativeTerminology", "capabilityFamilies", "evidenceCells", "holdoutIsolation", "boundary", "profileDigest"];
  if (!same(Object.keys(bundle?.profile ?? {}).sort(), profileKeys.sort())) reasons.push("EXTRA_FIELD_FORBIDDEN");
  if (!Array.isArray(bundle?.sourceFacts) || bundle.sourceFacts.length !== 36 || new Set(bundle.sourceFacts.map((x) => x.factId)).size !== 36) reasons.push("SOURCE_FACT_SET_MISMATCH");
  if (!Array.isArray(bundle?.cells) || bundle.cells.length !== 36 || new Set(bundle.cells.map((x) => `${x.capabilityFamily}/${x.questionId}`)).size !== 36 || CAPABILITY_FAMILIES.some((family) => QUESTIONS.some((q) => !bundle.cells.some((x) => x.capabilityFamily === family && x.questionId === q)))) reasons.push("MISSING_CELL");
  const facts = new Map((bundle?.sourceFacts ?? []).map((fact) => [fact.factId, fact]));
  for (const fact of bundle?.sourceFacts ?? []) if (digestRecord(fact, "factDigest") !== fact.factDigest) reasons.push("SOURCE_FACT_DIGEST_MISMATCH");
  for (const cell of bundle?.cells ?? []) {
    const { capabilityFamily, cellDigest, ...bare } = cell;
    if (sha256(Buffer.from(canonicalJson(bare))) !== cellDigest) reasons.push("CELL_DIGEST_MISMATCH");
    for (const evidence of cell.evidence ?? []) {
      const fact = facts.get(evidence.sourceFactId);
      if (!fact) reasons.push("INVENTED_SOURCE_FACT_REFERENCE");
      else if (fact.exactEvidence.exactLocator !== evidence.exactLocator || fact.exactEvidence.excerptSha256 !== evidence.excerptSha256 || fact.capabilityFamily !== capabilityFamily || fact.questionId !== cell.questionId) reasons.push("CELL_DIGEST_MISMATCH");
    }
    if (["ABSENT", "CONFLICTING"].includes(cell.state) && !(cell.counterexamples?.length > 0)) reasons.push("NEGATIVE_COUNTEREVIDENCE_OMITTED");
  }
  const expectedRefs = (bundle?.cells ?? []).map((cell) => ({ capabilityFamily: cell.capabilityFamily, questionId: cell.questionId, cellDigest: cell.cellDigest }));
  if (!same(bundle?.profile?.evidenceCells, expectedRefs) || !same(bundle?.profile?.sourceFactDigests, (bundle?.sourceFacts ?? []).map((x) => x.factDigest))) reasons.push("PROFILE_CELL_REFERENCE_MISMATCH");
  if (bundle?.profile && digestRecord(bundle.profile, "profileDigest") !== bundle.profile.profileDigest) reasons.push("PROFILE_DIGEST_MISMATCH");
  return { valid: reasons.length === 0, reasonCodes: [...new Set(reasons)] };
}
