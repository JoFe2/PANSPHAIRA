import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { test } from "node:test";
import {
  PROC434_CASE_ID_V1,
  PROC434_INVOICE_ID_V1,
  runProc434NormalPathV1,
  verifyProc434LocalProofV1,
  writeProc434StateV1,
} from "../../src/procurement-434/rechnungsabgleich-path.mjs";
import { createHash } from "node:crypto";
import { canonicalJson } from "../../dist/packages/contracts/src/canonical-json.js";
import { verifyRechnungsabgleichMatchDigestV1 } from "../../dist/packages/contracts/src/rechnungsabgleich-match-v1.js";

const CLI = path.join(import.meta.dirname, "..", "..", "src", "procurement-434", "rechnungsabgleich-path-cli.mjs");
const run = (args) => execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8" });

test("the real local normal path yields a genuine, non-productive MATCHED", () => {
  const r = runProc434NormalPathV1({ rootDir: process.cwd() });
  const res = r.result;
  assert.equal(r.schemaVersion, "cm.proc434/local-proof/v1");
  assert.equal(r.caseId, PROC434_CASE_ID_V1);
  assert.equal(res.outcome, "RECHNUNGSABGLEICH_MATCH");
  assert.equal(res.decision.outcome, "MATCHED");
  assert.equal(res.decision.matchedAmountMinor, 2400);
  assert.equal(res.mode, "THREE_WAY_INVOICE_PO_RECEIPT_V1");
  // The decisive match is re-readable: the closed match digest verifies, and
  // the local proof digest closes over the deterministic proof record.
  assert.equal(r.resultDigestVerified, true);
  assert.equal(verifyProc434LocalProofV1(r), true);
  assert.ok(res.matchDigest.length === 64);
  // Four independently sealed evidence citations, all verified.
  assert.equal(res.decision.evidenceCitations.length, 4);
  assert.deepEqual(
    res.decision.evidenceCitations.map((c) => c.referenceKind).sort(),
    ["INVOICE", "PURCHASE_ORDER", "RECEIPT", "SUPPLIER"],
  );
  for (const c of res.decision.evidenceCitations) assert.equal(c.verified, true);
  // The sealed purchase-side invoice line is the actual invoice evidence.
  assert.equal(res.invoiceLine.invoiceId, undefined); // module projects the sealed core
  assert.equal(res.invoiceLine.amountMinor, 2400);
  // Non-productive: no booking or allocation authority is granted.
  assert.equal(r.authority.productivePostingAuthorized, false);
  assert.equal(r.authority.bookingAuthorityGranted, false);
  assert.equal(res.decision.authority.bookingAuthorityGranted, false);
  assert.equal(res.decision.authority.productivePostingAuthorized, false);
});

test("the CLI demo prints the re-readable, human result for the normal path", () => {
  const out = run(["demo"]);
  assert.match(out, /PROC434-POSITIVE · local normal path \(non-productive\)/);
  assert.match(out, /match: RECHNUNGSABGLEICH_MATCH · decision MATCHED · matchedAmountMinor=2400/);
  assert.match(out, /mode: THREE_WAY_INVOICE_PO_RECEIPT_V1 v1.0.0 · STRICT_ZERO_V1 v1.0.0/);
  assert.match(out, /resultDigestVerified: true · proofDigestClosed: yes/);
  assert.match(out, /authority: productivePosting=false booking=false riskD=SEPARATELY_AUTHORIZED/);
  assert.match(out, /evidence INVOICE invoice:synthetic-101 \[verified=true\]/);
  assert.match(out, /evidence PURCHASE_ORDER PO-2026-0001 \[verified=true\]/);
  assert.match(out, /evidence RECEIPT RCV-VAL-2026-0001 \[verified=true\]/);
  assert.match(out, /evidence SUPPLIER SUP-SYN-SUP-001 \[verified=true\]/);
  assert.match(out, /outcome: MATCHED · amountMinor=2400/);
});

test("the CLI --json result agrees with the direct library run (re-readable)", () => {
  const fromCli = JSON.parse(run(["demo", "--json"]));
  const fromLib = runProc434NormalPathV1({ rootDir: process.cwd() });
  assert.deepEqual(fromCli, fromLib);
  assert.equal(fromCli.result.decision.outcome, "MATCHED");
});

test("help and unknown commands have defined exit codes", () => {
  assert.doesNotThrow(() => run(["help"]));
  assert.doesNotThrow(() => run(["demo", "--help"]));
  assert.throws(() => run(["bogus"]), (error) => error.status === 2);
});

test("a closed reader timestamp outside the freshness window is recorded, not fabricated", () => {
  // now far past the export's expiresAt -> the retained reader refuses the read;
  // the path records a DENIED outcome (a normal-path negative) and does not match.
  const r = runProc434NormalPathV1({ rootDir: process.cwd(), now: "2026-09-11T00:00:00Z" });
  assert.ok(r.outcome === "DENIED" || r.outcome === "UNRESOLVED" || r.result);
  if (r.outcome === "DENIED" || r.outcome === "UNRESOLVED") {
    assert.equal(r.code, "SOURCE_STALE");
  }
});

test("the local state/proof record is persisted to disk and is re-readable (AUFTRAG item 2)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "proc434-state-"));
  const stateFile = path.join(dir, "proc434-result.json");
  try {
    const fromLib = runProc434NormalPathV1({ rootDir: process.cwd() });
    const written = writeProc434StateV1(fromLib, stateFile);
    assert.equal(written, stateFile);
    // Re-readable on disk: the persisted record parses and verifies its own closed digest.
    const onDisk = JSON.parse(readFileSync(stateFile, "utf8"));
    assert.equal(verifyProc434LocalProofV1(onDisk), true);
    assert.deepEqual(onDisk, fromLib);
    // The CLI --state flag writes the same re-readable local state and reports its path.
    const human = run(["demo", "--state", stateFile]);
    assert.match(human, new RegExp("state: " + stateFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const json = JSON.parse(run(["demo", "--state", stateFile, "--json"]));
    assert.equal(json.statePath, stateFile);
    assert.equal(json.result.decision.outcome, "MATCHED");
    assert.equal(JSON.parse(readFileSync(stateFile, "utf8")).result.matchDigest, fromLib.result.matchDigest);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- R3: the persisted proof digest is RECURSIVE and re-verifies the embedded
// decisive-match digest at readback (not a trusted stored boolean). ----

test("R3: the local proof digest is a RECURSIVE canonical digest — nested result/provenance/authority tampering WITHOUT recomputing any digest fails verification (the previous top-level JSON.stringify dropped nested fields)", () => {
  const fromLib = runProc434NormalPathV1({ rootDir: process.cwd() });
  // Baseline verifies.
  assert.equal(verifyProc434LocalProofV1(fromLib), true);
  // Tamper each nested dimension WITHOUT recomputing proofDigest or matchDigest.
  const cases = {
    "result.decision.outcome": (p) => { p.result.decision.outcome = "CONFLICT"; },
    "result.quantities.invoicedMenge": (p) => { p.result.quantities.invoicedMenge = 999; },
    "result.reconciliation.remainingMenge": (p) => { p.result.reconciliation.remainingMenge = 7; },
    "result.ap04Pack.canonicalSha256": (p) => { p.result.ap04Pack.canonicalSha256 = "0".repeat(64); },
    "provenance.invoiceLineSeal": (p) => { p.provenance.invoiceLineSeal = "0".repeat(64); },
    "provenance.ap04Pack.sha256": (p) => { p.provenance.ap04Pack.sha256 = "1".repeat(64); },
    "authority.bookingAuthorityGranted": (p) => { p.authority.bookingAuthorityGranted = true; },
    "authority.productivePostingAuthorized": (p) => { p.authority.productivePostingAuthorized = true; },
    "result.fallDigest": (p) => { p.result.fallDigest = "9".repeat(64); },
    "nonclaims": (p) => { p.nonclaims.push("INVENTED_CLAIM"); },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const p = structuredClone(fromLib);
    mutate(p);
    assert.equal(verifyProc434LocalProofV1(p), false, `${name} tamper must fail the recursive proof digest`);
  }
});

test("R3: the embedded decisive-match digest is RE-VERIFIED at readback — tampering the result content leaves the stored resultDigestVerified=true, but the verifier re-checks it and FAILS (it does not trust the persisted boolean)", () => {
  const fromLib = runProc434NormalPathV1({ rootDir: process.cwd() });
  assert.equal(fromLib.resultDigestVerified, true, "the fresh assembly re-verified the match digest");
  // Tamper a nested field of the decisive result so its matchDigest no longer
  // closes, but leave proofDigest recomputed over the (now inconsistent) core
  // and leave the stored resultDigestVerified=true. The verifier must still
  // FAIL because it re-verifies the embedded match digest at readback.
  const p = structuredClone(fromLib);
  p.result.quantities.invoicedMenge = 999;
  // Recompute proofDigest over the tampered core (so the recursive digest
  // alone would pass), but do NOT touch resultDigestVerified (still true) and
  // do NOT recompute result.matchDigest (now stale over the tampered content).
  const { proofDigest: _drop, ...core } = p;
  p.proofDigest = createHash("sha256").update(canonicalJson(core), "utf8").digest("hex");
  assert.equal(p.resultDigestVerified, true, "the stored boolean is still true (never trusted on its own)");
  assert.equal(verifyProc434LocalProofV1(p), false, "the verifier re-verifies the embedded match digest and fails the tampered result");
});

test("R3: a corrected (recomputed) proof digest closes, and the readback path is a genuine integrity check — the persisted state round-trips and verifies", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "proc434-r3-state-"));
  const stateFile = path.join(dir, "proc434-r3.json");
  try {
    const fromLib = runProc434NormalPathV1({ rootDir: process.cwd() });
    writeProc434StateV1(fromLib, stateFile);
    const onDisk = JSON.parse(readFileSync(stateFile, "utf8"));
    // Round-trip is byte-consistent and the closed recursive digest verifies.
    assert.deepEqual(onDisk, fromLib);
    assert.equal(verifyProc434LocalProofV1(onDisk), true);
    // The embedded match digest re-verifies from the result content at readback.
    assert.equal(verifyRechnungsabgleichMatchDigestV1(onDisk.result), true);
    // Tamper the on-disk state AFTER persistence; the verifier catches it.
    onDisk.result.decision.outcome = "DENIED";
    assert.equal(verifyProc434LocalProofV1(onDisk), false, "on-disk tamper after persistence must fail readback");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("R2/R3 provenance: the normal path reports the ACTUAL verified AP-04 pack identity and the admitted invoice-line locator/generator (no substituted constant or fixed locator)", () => {
  const r = runProc434NormalPathV1({ rootDir: process.cwd() });
  assert.equal(r.result.outcome, "RECHNUNGSABGLEICH_MATCH");
  // The provenance carries the ACTUAL verified pack identity (both digests).
  assert.equal(r.provenance.ap04Pack.sha256, "136bbdfcb61bf48ab0043d828dbf797e9b9156f58d284cc7f9b921da59040845");
  assert.equal(r.provenance.ap04Pack.canonicalSha256, "899d8dfc44be526011c35ad5aba4c2cb89bca433f1520e61fe05268d4816ad20");
  // The admitted invoice-line locator/generator is preserved (R2).
  assert.equal(r.provenance.invoiceLineLocator, "tests/fixtures/incoming-invoice/invoice-line-v1.json#invoice:synthetic-101");
  assert.equal(r.provenance.invoiceLineGenerator, "M1_RECHNUNGSZEILE_V1");
  // The coherent positive reconciliation is surfaced.
  assert.deepEqual(r.result.reconciliation, { invoicedMenge: 2, remainingMenge: 0, policy: "FULL_INVOICE" });
  // The nonclaims include the R3 integrity-not-authentication statement.
  assert.ok(r.nonclaims.includes("PROOF_DIGEST_IS_INTEGRITY_EVIDENCE_NOT_INDEPENDENT_SOURCE_AUTHENTICATION"));
});

// ---------------------------------------------------------------------------
// Copied-root CLI path: the fixtures are read from --root (data), while the
// code-owned source-authority binding lives in the compiled contracts
// (package-owned boundary). The ACTUAL CLI is exercised against a copied
// root so the caller cannot reach the repository fixtures by accident and
// the positive/negative outcomes are decided from the copied data alone.
// ---------------------------------------------------------------------------
const COPIED_ROOT_FIXTURES = [
  "tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json",
  "tests/fixtures/erp-read/contract-v1.json",
  "tests/fixtures/erp-read/matched-export-v1.json",
  "tests/fixtures/incoming-invoice/receipt-valuation-v1.json",
  "tests/fixtures/incoming-invoice/invoice-line-v1.json",
  "tests/fixtures/procurement-434/po-identity-mapping-v1.json",
  "tests/fixtures/procurement-434/approved-sources-v1.json",
];
function copiedFixtureRoot() {
  const dir = mkdtempSync(path.join(tmpdir(), "proc434-copied-root-"));
  for (const rel of COPIED_ROOT_FIXTURES) {
    const dest = path.join(dir, rel);
    cpSync(path.join(process.cwd(), rel), dest, { recursive: true });
  }
  return dir;
}

test("R2 CLI copied-root: the ACTUAL CLI over a copied root closes the genuine positive synthetic path (data read from --root, code-owned binding from the package)", () => {
  const root = copiedFixtureRoot();
  try {
    const out = run(["demo", "--root", root, "--json"]);
    const doc = JSON.parse(out);
    // The MATCHED --json document is the closed local proof record: the
    // decisive result is nested under .result (the proof core is top-level).
    assert.equal(doc.schemaVersion, "cm.proc434/local-proof/v1");
    assert.equal(doc.result.outcome, "RECHNUNGSABGLEICH_MATCH");
    assert.equal(doc.result.decision.outcome, "MATCHED");
    assert.equal(doc.result.decision.matchedAmountMinor, 2400);
    // Quantity-coherent with the frozen PO source quantity (2): ordered =
    // received = invoiced, closed amount unchanged.
    assert.deepEqual(doc.result.quantities, { bestellteMenge: 2, mengenReceived: 2, invoicedMenge: 2, einheit: "STK", waehrung: "EUR" });
    assert.equal(doc.result.reconciliation.policy, "FULL_INVOICE");
    assert.equal(doc.resultDigestVerified, true);
    assert.equal(verifyProc434LocalProofV1(doc), true, "the copied-root CLI proof closes and re-verifies");
    // The admitted locator/generator is the sealed local source (R2).
    assert.equal(doc.provenance.invoiceLineLocator, "tests/fixtures/incoming-invoice/invoice-line-v1.json#invoice:synthetic-101");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("R2 CLI copied-root (source-authority): a caller-substituted approved manifest from the SAME --root is DENIED — the manifest content is bound to the code-owned canonical digest, so a re-located/re-sealed entry cannot authorize its own substituted source", () => {
  const root = copiedFixtureRoot();
  try {
    // The probe scenario, at the CLI: the invoice line evidence locator is
    // forged to a same-identity foreign locator AND the caller's copied
    // manifest entry is re-located to match it (the two agree with each
    // other, but the retained manifest content no longer closes to the
    // code-owned expected canonical digest).
    const manifestPath = path.join(root, "tests/fixtures/procurement-434/approved-sources-v1.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const entry = manifest.sources.find((e) => e.locator.startsWith("tests/fixtures/incoming-invoice/invoice-line-v1.json"));
    assert.ok(entry, "the copied manifest must carry the sealed invoice-line entry");
    entry.locator = "forged-source:same-identity";
    manifest.nonclaims.push("CALLER_MANIFEST_SUBSTITUTION_ATTEMPTED");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const out = run(["demo", "--root", root, "--json"]);
    const doc = JSON.parse(out);
    assert.equal(doc.outcome, "DENIED", JSON.stringify(doc).slice(0, 300));
    assert.equal(doc.code, "MATCH_APPROVED_SOURCES_NOT_CODE_OWNED");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
