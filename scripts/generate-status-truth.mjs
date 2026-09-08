#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { adaptDeliveryConveyorReadbackV1 } from "../dist/packages/contracts/src/adaptive-evidence-gates.js";
import { validateRecordedPublicState } from "./verify-release-governance.mjs";
import { validateReleaseCompletion } from "./demo-current-head-e2e.mjs";

export const STATUS_TRUTH_SCHEMA = "pansphaira.status-truth/snapshot/v1";
export const STATUS_TRUTH_MANIFEST_SCHEMA = "pansphaira.status-truth/manifest/v1";
export const STATUS_TRUTH_PROVIDER_SCHEMA = "pansphaira.status-truth/provider-readback/v1";
export const STATUS_TRUTH_SOURCE = "pan380-canonical-status-truth-source-v1";

const SHA256 = /^[a-f0-9]{64}$/;
const SHA1 = /^[a-f0-9]{40}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const STATES = [
  "codePresent",
  "focusedTestsPassed",
  "runtimeObserved",
  "merged",
  "released",
  "requiredPublicReadback",
  "issuePubliclyClosed",
  "queueDone",
];
const TERMINAL_STATES = new Set(["CLOSED"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

export function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new Error("NON_CANONICAL_NUMBER");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (!isRecord(value)) throw new Error("NON_CANONICAL_VALUE");
  return `{${Object.keys(value).sort((a, b) => a.localeCompare(b, "en")).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

export function sha256(value) {
  return createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonicalJson(value)).digest("hex");
}

function deny(reasonCodes, detail = undefined) {
  const result = {
    outcome: "DENIED",
    reasonCodes: [...new Set(reasonCodes)].sort(),
    closureVerified: false,
    queueState: "BLOCKED",
    contradictions: [...new Set(reasonCodes)].sort(),
  };
  if (detail !== undefined) result.detail = detail;
  return result;
}

function pass(value) {
  return { outcome: "PASS", ...value };
}

function requireIso(value, code, issues) {
  if (typeof value !== "string" || !ISO.test(value) || !Number.isFinite(Date.parse(value))) issues.push(code);
}

function normalizeLabels(labels) {
  return [...new Set((Array.isArray(labels) ? labels : []).filter((label) => typeof label === "string").map((label) => label.toLowerCase()))].sort();
}

function bool(value) {
  return value === true;
}

function validateManifest(manifest, issues) {
  if (!isRecord(manifest) || manifest.schemaVersion !== STATUS_TRUTH_MANIFEST_SCHEMA) {
    issues.push("MANIFEST_SCHEMA_DENIED");
    return;
  }
  if (manifest.repository !== "JoFe2/PANSPHAIRA") issues.push("MANIFEST_REPOSITORY_DENIED");
  if (!Array.isArray(manifest.issues) || manifest.issues.length === 0) {
    issues.push("MANIFEST_ISSUE_ALLOWLIST_MISSING");
    return;
  }
  const numbers = manifest.issues.map((entry) => entry?.number);
  if (numbers.some((number) => !Number.isSafeInteger(number) || number <= 0) || new Set(numbers).size !== numbers.length) {
    issues.push("MANIFEST_ISSUE_ALLOWLIST_INVALID");
  }
  if (manifest.releases !== undefined && (!Array.isArray(manifest.releases)
    || manifest.releases.some((release) => typeof release?.tag !== "string" || release.tag.length === 0))) {
    issues.push("MANIFEST_RELEASE_ALLOWLIST_INVALID");
  }
}

function validateProviderEnvelope(provider, issues) {
  if (!isRecord(provider) || provider.schemaVersion !== STATUS_TRUTH_PROVIDER_SCHEMA) {
    issues.push("PROVIDER_SCHEMA_DENIED");
    return;
  }
  if (provider.repository !== "JoFe2/PANSPHAIRA") issues.push("PROVIDER_REPOSITORY_DENIED");
  const retrieval = provider.retrieval;
  if (!isRecord(retrieval)) issues.push("RETRIEVAL_BINDING_MISSING");
  else {
    requireIso(retrieval.retrievedAt, "RETRIEVAL_TIME_INVALID", issues);
    if (!Array.isArray(retrieval.sourceUrls) || retrieval.sourceUrls.length === 0
      || retrieval.sourceUrls.some((url) => typeof url !== "string" || !/^https:\/\//.test(url))) {
      issues.push("RETRIEVAL_SOURCE_URLS_INVALID");
    }
  }
  if (!Array.isArray(provider.pages) || provider.pages.length === 0) issues.push("PROVIDER_PAGINATION_MISSING");
}

function readRows(provider, issues) {
  const pages = Array.isArray(provider?.pages) ? provider.pages : [];
  if (pages.length === 0) return [];
  const ordered = [...pages].sort((a, b) => Number(a?.page) - Number(b?.page));
  const totals = new Set();
  const rows = [];
  for (const [index, page] of ordered.entries()) {
    if (!isRecord(page) || page.page !== index + 1 || typeof page.url !== "string" || !Array.isArray(page.items)) {
      issues.push("PROVIDER_PAGINATION_INCOMPLETE");
      continue;
    }
    if (!Number.isSafeInteger(page.total) || page.total < 0) issues.push("PROVIDER_DENOMINATOR_INVALID");
    else totals.add(page.total);
    if (index < ordered.length - 1 && page.nextPage !== index + 2) issues.push("PROVIDER_PAGINATION_INCOMPLETE");
    if (index === ordered.length - 1 && page.nextPage !== null) issues.push("PROVIDER_PAGINATION_INCOMPLETE");
    rows.push(...page.items);
  }
  if (totals.size !== 1 || (provider.apiTotal !== undefined && (!Number.isSafeInteger(provider.apiTotal) || !totals.has(provider.apiTotal)))) {
    issues.push("PROVIDER_DENOMINATOR_DISAGREEMENT");
  }
  const byNumber = new Map();
  for (const row of rows) {
    if (!isRecord(row) || !Number.isSafeInteger(row.number) || row.number <= 0) {
      issues.push("PROVIDER_ROW_INVALID");
      continue;
    }
    const prior = byNumber.get(row.number);
    if (prior && canonicalJson(prior) !== canonicalJson(row)) issues.push(`PROVIDER_DUPLICATE_CONTRADICTION:${row.number}`);
    else if (!prior) byNumber.set(row.number, row);
  }
  const expectedTotal = [...byNumber.keys()].length;
  if (totals.size === 1 && [...totals][0] !== expectedTotal) issues.push("PROVIDER_DENOMINATOR_DISAGREEMENT");
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

function validateLabels(row, issues) {
  const labels = normalizeLabels(row.labels);
  const labelledOpen = labels.some((label) => ["status:open", "state:open", "open"].includes(label));
  const labelledClosed = labels.some((label) => ["status:closed", "state:closed", "closed"].includes(label));
  if (labelledOpen && labelledClosed) issues.push(`LABEL_STATE_DISAGREEMENT:${row.number}`);
  if (labelledOpen && row.state !== "OPEN") issues.push(`LABEL_STATE_DISAGREEMENT:${row.number}`);
  if (labelledClosed && row.state !== "CLOSED") issues.push(`LABEL_STATE_DISAGREEMENT:${row.number}`);
  return labels;
}

function validateChecklist(row, issues) {
  const checklist = row.checklist;
  if (!isRecord(checklist)) return null;
  if (!Number.isSafeInteger(checklist.completed) || !Number.isSafeInteger(checklist.total)
    || checklist.completed < 0 || checklist.total < 0 || checklist.completed > checklist.total) {
    issues.push(`CHECKLIST_INVALID:${row.number}`);
    return null;
  }
  if (row.state === "OPEN" && checklist.total > 0 && checklist.completed === checklist.total) {
    issues.push(`OPEN_ACCEPTANCE_COMPLETE:${row.number}`);
  }
  return { completed: checklist.completed, total: checklist.total };
}

function releaseRecords(provider) {
  return new Map((Array.isArray(provider?.releases) ? provider.releases : [])
    .filter((release) => typeof release?.tag === "string")
    .map((release) => [release.tag, release]));
}

function reconcileReleases(manifest, provider, issues) {
  const records = releaseRecords(provider);
  const history = new Map();
  for (const release of records.values()) {
    if (typeof release.body !== "string") issues.push(`RELEASE_BODY_MISSING:${release.tag}`);
    const bodyDigest = typeof release.body === "string" ? sha256(release.body) : "";
    if (release.bodySha256 !== undefined && release.bodySha256 !== bodyDigest) issues.push(`RELEASE_BODY_DIGEST_MISMATCH:${release.tag}`);
    if (release.historicalBodySha256 !== undefined) {
      history.set(release.tag, release.historicalBodySha256);
      if (release.historicalBodySha256 !== bodyDigest) issues.push(`HISTORICAL_RELEASE_BODY_MUTATED:${release.tag}`);
    }
  }
  for (const historical of provider?.historicalReleases ?? []) {
    if (typeof historical?.tag !== "string" || typeof historical?.bodySha256 !== "string") {
      issues.push("HISTORICAL_RELEASE_RECORD_INVALID");
      continue;
    }
    history.set(historical.tag, historical.bodySha256);
    const current = records.get(historical.tag);
    if (current && typeof current.body === "string" && sha256(current.body) !== historical.bodySha256) {
      issues.push(`HISTORICAL_RELEASE_BODY_MUTATED:${historical.tag}`);
    }
  }
  const latest = provider?.latest;
  if (latest !== undefined) {
    if (!isRecord(latest) || typeof latest.tag !== "string" || !records.has(latest.tag)) issues.push("LATEST_RELEASE_MISSING");
    else if (latest.bodySha256 !== undefined && latest.bodySha256 !== sha256(records.get(latest.tag).body ?? "")) issues.push("LATEST_RELEASE_BODY_CONTRADICTION");
    if (latest.priorTag && records.has(latest.priorTag) && latest.tag === latest.priorTag) issues.push("LATEST_RELEASE_NOT_FORWARD");
  }
  const allowlisted = new Set((manifest?.releases ?? []).map((release) => release.tag));
  for (const tag of allowlisted) if (!records.has(tag)) issues.push(`REQUIRED_RELEASE_MISSING:${tag}`);
  return {
    direction: "FORWARD_ONLY",
    latestTag: latest?.tag ?? null,
    historicalBodyDigests: Object.fromEntries([...history].sort()),
    records: [...records.values()].map((release) => ({
      tag: release.tag,
      bodySha256: typeof release.body === "string" ? sha256(release.body) : null,
      publishedAt: release.publishedAt ?? null,
      readbackVerified: release.readbackVerified === true,
      sourceUrl: release.sourceUrl ?? null,
    })).sort((a, b) => a.tag.localeCompare(b.tag, "en")),
  };
}

function gateState(row, manifestEntry, issues) {
  const delivery = isRecord(row.delivery) ? row.delivery : {};
  const expectedHead = manifestEntry.expectedHeadSha ?? delivery.headSha ?? null;
  if (expectedHead === null) issues.push(`REQUIRED_GATE_HEAD_MISSING:${row.number}`);
  else if (!SHA1.test(expectedHead)) issues.push(`HEAD_BINDING_INVALID:${row.number}`);
  const gates = Array.isArray(delivery.requiredGates) ? delivery.requiredGates : [];
  if (manifestEntry.requiredGates !== false && gates.length === 0) issues.push(`REQUIRED_GATE_MISSING:${row.number}`);
  const names = gates.map((gate) => gate?.name);
  if (new Set(names).size !== names.length) issues.push(`REQUIRED_GATE_REPLAYED:${row.number}`);
  const runIds = gates.map((gate) => gate?.runId).filter((runId) => runId !== undefined);
  if (new Set(runIds).size !== runIds.length) issues.push(`REQUIRED_GATE_REPLAYED:${row.number}`);
  const gateResults = gates.map((gate) => ({
    name: gate?.name ?? null,
    conclusion: gate?.conclusion ?? null,
    headSha: gate?.headSha ?? null,
    treeSha: gate?.treeSha ?? null,
    source: gate?.source ?? null,
  }));
  for (const gate of gates) {
    if (gate?.replayed === true || gate?.stale === true || (Number.isFinite(delivery.nowMs) && Number.isFinite(gate?.expiresAtMs) && gate.expiresAtMs < delivery.nowMs)) {
      issues.push(`REQUIRED_GATE_STALE:${row.number}:${gate?.name ?? "unknown"}`);
    }
  }
  for (const gate of gateResults) {
    if (gate.conclusion !== "success") issues.push(`REQUIRED_GATE_RED:${row.number}:${gate.name ?? "unknown"}`);
    if (!SHA1.test(gate.headSha ?? "") || !SHA1.test(gate.treeSha ?? "")) issues.push(`REQUIRED_GATE_BINDING_INVALID:${row.number}:${gate.name ?? "unknown"}`);
    if (expectedHead !== null && gate.headSha !== expectedHead) issues.push(`REQUIRED_GATE_WRONG_HEAD:${row.number}:${gate.name ?? "unknown"}`);
    if (gate.source !== "GITHUB_ACTIONS_PROVIDER_READBACK") issues.push(`REQUIRED_GATE_NOT_PROVIDER_READBACK:${row.number}:${gate.name ?? "unknown"}`);
  }
  let completion = null;
  if (delivery.completionEnvelope !== undefined) {
    if (!SHA1.test(delivery.expectedCommitSha ?? "") || !SHA1.test(delivery.expectedTreeSha ?? "") || !Number.isFinite(delivery.nowMs)) {
      issues.push(`CURRENT_HEAD_EXPECTATION_INVALID:${row.number}`);
    } else {
      completion = validateReleaseCompletion(delivery.completionEnvelope, {
        commitSha: delivery.expectedCommitSha,
        treeSha: delivery.expectedTreeSha,
        nowMs: delivery.nowMs,
      });
      if (completion.outcome !== "PASS") issues.push(...completion.reasonCodes.map((code) => `CURRENT_HEAD_${code}:${row.number}`));
    }
  }
  return { expectedHead, gateResults, completion };
}

function deriveMaturity(row, states, issues) {
  const explicit = row.maturity;
  const maturity = explicit ?? (row.state === "CLOSED" ? "delivered" : "planned");
  if (!["planned", "delivered", "falsified"].includes(maturity)) issues.push(`MATURITY_INVALID:${row.number}`);
  if (row.state === "CLOSED" && maturity === "planned") issues.push(`CLOSED_SHOWN_PLANNED:${row.number}`);
  if (row.state === "OPEN" && maturity === "delivered") issues.push(`OPEN_SHOWN_DELIVERED:${row.number}`);
  if (maturity === "falsified" && states.queueDone) issues.push(`FALSIFIED_SHOWN_DONE:${row.number}`);
  return maturity;
}

function buildItem(entry, row, releaseMap, issues) {
  if (!TERMINAL_STATES.has(row.state) && row.state !== "OPEN") issues.push(`ISSUE_STATE_INVALID:${row.number}`);
  const expectedState = entry.expectedState ?? entry.state;
  if (expectedState && expectedState !== row.state) issues.push(`MANIFEST_STATE_CONTRADICTION:${row.number}`);
  const labels = validateLabels(row, issues);
  const checklist = validateChecklist(row, issues);
  const delivery = isRecord(row.delivery) ? row.delivery : {};
  const release = delivery.releaseTag ? releaseMap.get(delivery.releaseTag) : (isRecord(row.release) ? row.release : null);
  const states = {
    codePresent: bool(delivery.codePresent),
    focusedTestsPassed: bool(delivery.focusedTestsPassed),
    runtimeObserved: bool(delivery.runtimeObserved),
    merged: bool(delivery.merged ?? row.pullRequest?.merged),
    released: bool(delivery.released ?? release?.publishedAt ?? release?.published),
    requiredPublicReadback: bool(delivery.requiredPublicReadback ?? release?.readbackVerified),
    issuePubliclyClosed: row.state === "CLOSED",
    queueDone: delivery.queueStatus === "DONE" || bool(delivery.queueDone),
  };
  if (entry.requiredRelease === true && !release) issues.push(`REQUIRED_RELEASE_MISSING:${row.number}`);
  if (entry.requiredPublicReadback === true && !states.requiredPublicReadback) issues.push(`REQUIRED_PUBLIC_READBACK_MISSING:${row.number}`);
  const gate = gateState(row, entry, issues);
  const maturity = deriveMaturity(row, states, issues);
  const childIssues = Array.isArray(entry.children) ? entry.children : [];
  for (const child of childIssues) {
    const childRow = child.number === row.number ? row : null;
    if (childRow && child.expectedState && child.expectedState !== childRow.state) issues.push(`STALE_CHILD_CHECKLIST:${row.number}:${child.number}`);
  }
  const stateDigest = sha256({ number: row.number, state: row.state, labels, checklist, maturity, states, gate: gate.gateResults });
  return {
    number: row.number,
    title: row.title ?? entry.title ?? `Issue #${row.number}`,
    state: row.state,
    labels,
    checklist,
    maturity,
    states,
    stateDigest,
    historicalEvidence: {
      body: row.body ?? "",
      bodySha256: sha256(row.body ?? ""),
      immutable: true,
    },
    pullRequest: row.pullRequest ?? null,
    release: release ? {
      tag: release.tag ?? delivery.releaseTag ?? null,
      publishedAt: release.publishedAt ?? null,
      readbackVerified: release.readbackVerified === true,
      sourceUrl: release.sourceUrl ?? null,
    } : null,
    requiredGates: gate.gateResults,
    completion: gate.completion,
  };
}

export function validateStatusTruth(input) {
  const issues = [];
  if (!isRecord(input)) return deny(["INPUT_SCHEMA_DENIED"]);
  validateManifest(input.manifest, issues);
  validateProviderEnvelope(input.providerReadback, issues);
  if (issues.length > 0) return deny(issues);
  const rows = readRows(input.providerReadback, issues);
  const allowlist = new Map(input.manifest.issues.map((entry) => [entry.number, entry]));
  for (const row of rows) if (!allowlist.has(row.number)) issues.push(`PROVIDER_ROW_NOT_ALLOWLISTED:${row.number}`);
  for (const number of allowlist.keys()) if (!rows.some((row) => row.number === number)) issues.push(`PROVIDER_ROW_MISSING:${number}`);
  const releaseReconciliation = reconcileReleases(input.manifest, input.providerReadback, issues);
  if (input.releaseGovernance) {
    const governanceIssues = validateRecordedPublicState(input.releaseGovernance);
    issues.push(...governanceIssues.map((code) => `RELEASE_GOVERNANCE_${code}`));
  }
  const rowMap = new Map(rows.map((row) => [row.number, row]));
  const items = [...allowlist.entries()].sort(([a], [b]) => a - b).map(([number, entry]) => buildItem(entry, rowMap.get(number) ?? { number, state: "OPEN" }, releaseRecords(input.providerReadback), issues));
  const epicViews = input.manifest.epics ?? input.manifest.issues.filter((entry) => entry.type === "epic");
  for (const epic of epicViews) {
    for (const child of epic.children ?? []) {
      const childRow = rowMap.get(child.number);
      if (!childRow || (child.expectedState && child.expectedState !== childRow.state)) issues.push(`STALE_CHILD_CHECKLIST:${epic.number ?? "epic"}:${child.number}`);
    }
  }
  return issues.length === 0 ? pass({ items, releaseReconciliation }) : deny(issues);
}

export function generateStatusTruth(input) {
  const validation = validateStatusTruth(input);
  if (validation.outcome !== "PASS") return validation;
  const retrieval = input.providerReadback.retrieval;
  const manifestDigest = sha256(input.manifest);
  const providerDigest = sha256(input.providerReadback);
  const body = {
    schemaVersion: STATUS_TRUTH_SCHEMA,
    source: STATUS_TRUTH_SOURCE,
    repository: "JoFe2/PANSPHAIRA",
    retrieval: {
      retrievedAt: retrieval.retrievedAt,
      sourceUrls: [...retrieval.sourceUrls],
      manifestDigest,
      providerReadbackDigest: providerDigest,
    },
    items: validation.items,
    views: {
      roadmap: (input.manifest.roadmap ?? []).map((view) => ({ ...view, generatedState: "status-truth.json" })),
      epics: (input.manifest.epics ?? []).map((view) => ({ ...view, generatedState: "status-truth.json" })),
    },
    releaseReconciliation: validation.releaseReconciliation,
    contradictions: [],
  };
  const states = Object.fromEntries(validation.items.map((item) => [item.number, item.states]));
  const allStates = validation.items.every((item) => STATES.every((state) => states[item.number][state] === true));
  const closureVerified = allStates;
  return {
    outcome: "PASS",
    ...body,
    ownerStates: {
      codePresent: validation.items.every((item) => item.states.codePresent),
      focusedTestsPassed: validation.items.every((item) => item.states.focusedTestsPassed),
      runtimeObserved: validation.items.every((item) => item.states.runtimeObserved),
      merged: validation.items.every((item) => item.states.merged),
      released: validation.items.every((item) => item.states.released),
      requiredPublicReadback: validation.items.every((item) => item.states.requiredPublicReadback),
      issuePubliclyClosed: validation.items.every((item) => item.states.issuePubliclyClosed),
      queueDone: validation.items.every((item) => item.states.queueDone),
    },
    closureVerified,
    queueState: closureVerified ? "DONE" : "BLOCKED",
    snapshotDigest: sha256(body),
  };
}

export const buildStatusTruthSnapshot = generateStatusTruth;
export const renderStatusTruth = (snapshot) => `${canonicalJson(snapshot)}\n`;

function parseArgs(argv) {
  if (argv.length !== 1 || !argv[0].endsWith(".json") || argv[0].startsWith("/") || argv[0].includes("..")) {
    throw new Error("USAGE: node scripts/generate-status-truth.mjs path/to/input.json");
  }
  return argv[0];
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const input = JSON.parse(readFileSync(resolve(process.cwd(), parseArgs(process.argv.slice(2))), "utf8"));
    const result = generateStatusTruth(input);
    process.stdout.write(`${renderStatusTruth(result)}`);
    if (result.outcome === "DENIED") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
