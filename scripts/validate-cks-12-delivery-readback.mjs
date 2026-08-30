#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const canonical = (value) => { if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value); if (typeof value === "number") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`; };
const hash = (value) => createHash("sha256").update(value).digest("hex");
export function validateDeliveryReadback(template, e2eReceipt, reportReceipt) {
  if (!template || template.expectedStatus !== "PASS_SYNTHETIC_ONLY" || template.expectedDeliveryState !== "RELEASE_REQUIRED_PENDING_DELIVERY" || template.requiredPackageHeadCount !== 8) return { status: "DENIED", reasonCodes: ["TEMPLATE_INVALID"] };
  if (!e2eReceipt || e2eReceipt.status !== "RECORDED" || e2eReceipt.result?.status !== template.expectedStatus || e2eReceipt.result?.packageHeadIds?.length !== template.requiredPackageHeadCount) return { status: "DENIED", reasonCodes: ["E2E_READBACK_MISSING"] };
  if (!reportReceipt || reportReceipt.status !== "RECORDED" || reportReceipt.result?.status !== template.expectedStatus) return { status: "DENIED", reasonCodes: ["REPORT_READBACK_MISSING"] };
  return { status: "RECORDED", deliveryState: "RELEASE_REQUIRED_PENDING_DELIVERY", packageHeadCount: template.requiredPackageHeadCount, verdict: template.expectedStatus, releaseClaimed: false, authority: "NONE", capabilityDelta: "NONE", effect: "NONE" };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { if (process.argv.length !== 3 || process.argv[2] !== "--dry-run") { console.error("usage: node scripts/validate-cks-12-delivery-readback.mjs --dry-run"); process.exitCode = 2; } else { const bytes = readFileSync(`${root}/tests/fixtures/cks-12/delivery-readback-template-v1.json`); const result = validateDeliveryReadback(JSON.parse(bytes), JSON.parse(readFileSync(`${root}/verification/cks-12/e2e-proof-readback-receipt-v1.json`, "utf8")), JSON.parse(readFileSync(`${root}/verification/cks-12/falsification-report-receipt-v1.json`, "utf8"))); const body = { schemaVersion: "chimpmaera.cks/delivery-readback-template-receipt/v1", receiptId: "CKS-12-DELIVERY-READBACK-RECEIPT-V1", fixtureSha256: hash(bytes), result, status: "RECORDED" }; console.log(canonical({ ...body, receiptSha256: hash(canonical(body)) })); if (result.status !== "RECORDED") process.exitCode = 1; } }
