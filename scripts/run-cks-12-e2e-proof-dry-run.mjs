#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const acceptedPackageHeadIds = ["PREREQUISITE_BIND", "EMPTY_KB_ACQUISITION", "GOVERNED_PROMOTION", "EXPERIENCE_DIVERSITY", "READONLY_KALEIDOSPHERE", "SHADOW_WORKFLOW", "FUNCTION_COST_PARITY", "DRIFT_FASTPATH"];
const canonical = (value) => { if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value); if (typeof value === "number") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`; };
const hash = (value) => createHash("sha256").update(value).digest("hex");
export function runE2eProof(manifest) {
  if (!manifest || !Array.isArray(manifest.packageHeads) || manifest.packageHeads.length !== 8) return { status: "ABORTED", reasonCodes: ["PACKAGE_HEAD_MISSING"] };
  const ids = manifest.packageHeads.map((head) => head.id);
  if (new Set(ids).size !== 8 || canonical(ids) !== canonical(acceptedPackageHeadIds)) return { status: "ABORTED", reasonCodes: ["PACKAGE_HEAD_CONFLICT"] };
  for (const head of manifest.packageHeads) {
    if (!existsSync(`${root}/${head.fixture}`) || !existsSync(`${root}/${head.receipt}`)) return { status: "ABORTED", reasonCodes: ["PACKAGE_HEAD_MISSING"] };
    const fixture = readFileSync(`${root}/${head.fixture}`);
    const receipt = JSON.parse(readFileSync(`${root}/${head.receipt}`, "utf8"));
    if (receipt.status !== "RECORDED") return { status: "ABORTED", reasonCodes: ["PACKAGE_HEAD_UNTESTED"] };
    if (receipt.fixtureSha256 !== hash(fixture)) return { status: "ABORTED", reasonCodes: ["PACKAGE_HEAD_STALE"] };
    const authority = receipt.authority ?? receipt.result?.authority ?? receipt.candidate?.authority;
    const capabilityDelta = receipt.capabilityDelta ?? receipt.result?.capabilityDelta ?? receipt.candidate?.capabilityDelta;
    const effect = receipt.effect ?? receipt.result?.effect ?? receipt.candidate?.effect;
    if (authority !== "NONE" || capabilityDelta !== "NONE" || effect !== "NONE") return { status: "ABORTED", reasonCodes: ["PACKAGE_HEAD_UNAUTHORIZED"] };
  }
  const report = JSON.parse(readFileSync(`${root}/${manifest.reportFixture}`, "utf8"));
  if (!Array.isArray(report.orderedStoryStepIds) || report.orderedStoryStepIds.length !== 23 || !Array.isArray(report.packageHeads) || canonical(report.packageHeads) !== canonical(acceptedPackageHeadIds)) return { status: "ABORTED", reasonCodes: ["STORY_STEP_COVERAGE_FAILED"] };
  return { status: "PASS_SYNTHETIC_ONLY", deliveryState: "RELEASE_REQUIRED_PENDING_DELIVERY", storyStepCount: 23, packageHeadIds: ids, authority: "NONE", capabilityDelta: "NONE", effect: "NONE", productionClaimed: false, releaseClaimed: false };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { if (process.argv.length !== 3 || process.argv[2] !== "--dry-run") { console.error("usage: node scripts/run-cks-12-e2e-proof-dry-run.mjs --dry-run"); process.exitCode = 2; } else { const fixture = readFileSync(`${root}/tests/fixtures/cks-12/e2e-proof-manifest-v1.json`); const result = runE2eProof(JSON.parse(fixture)); const body = { schemaVersion: "chimpmaera.cks/e2e-proof-readback-receipt/v1", receiptId: "CKS-12-E2E-PROOF-READBACK-RECEIPT-V1", fixtureSha256: hash(fixture), result, status: "RECORDED" }; console.log(canonical({ ...body, receiptSha256: hash(canonical(body)) })); if (result.status !== "PASS_SYNTHETIC_ONLY") process.exitCode = 1; } }
