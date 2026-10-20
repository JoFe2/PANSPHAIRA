import { createHash } from "node:crypto";
import { readPan516Procurement } from "../procurement-434/bestellung-lifecycle.mjs";
import { evaluatePan516ProcurementLiabilitySnapshot } from "../procurement-434/bestellung-liability.mjs";
import { validateBrowserErvReadV1 } from "../../dist/packages/contracts/src/browser-erv-read-v1.js";

const owned = new WeakMap();
const invoiceIds = new Set(["AP-PAN516-MATCHED-01", "AP-PAN516-PARTIAL-01"]);
function exact(value, keys, reason) {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(reason);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length || Reflect.ownKeys(descriptors).some(k => typeof k !== "string" || !keys.includes(k))
    || Object.values(descriptors).some(d => !d.enumerable || !("value" in d))) throw new Error(reason);
}

// Owner-local composition on the existing P02 leading SQLite target. No new
// store, browser writer, rematcher, booking/payment grant or external provider.
export function createNativeErvReadAdapterV1(options) {
  exact(options, ["tenantId", "root"], "ERV_NATIVE_OWNER_BINDING_DENIED");
  if (typeof options.tenantId !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(options.tenantId) || typeof options.root !== "string") throw new Error("ERV_NATIVE_OWNER_BINDING_DENIED");
  const { tenantId, root } = options;
  const initial = readPan516Procurement({ root });
  const initialBinding = JSON.stringify(initial.binding);
  const reader = Object.freeze({
    read(request) {
      exact(request, ["tenantId", "objectId", "expectedRevision"], "ERV_READ_REQUEST_DENIED");
      if (request.tenantId !== tenantId) throw new Error("ERV_TENANT_BINDING_DENIED");
      if (!invoiceIds.has(request.objectId)) throw new Error("ERV_OBJECT_BINDING_DENIED");
      if (request.expectedRevision !== null && (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 1)) throw new Error("ERV_OBJECT_REVISION_STALE");
      const state = readPan516Procurement({ root });
      if (JSON.stringify(state.binding) !== initialBinding) throw new Error("ERV_NATIVE_LEADING_BINDING_DRIFT_DENIED");
      if (request.expectedRevision !== null && request.expectedRevision !== state.revision) throw new Error("ERV_OBJECT_REVISION_STALE");
      const confirmation = state.confirmations.at(-1);
      if (!confirmation) throw new Error("ERV_NATIVE_CONFIRMED_TERMS_REQUIRED");
      const liability = evaluatePan516ProcurementLiabilitySnapshot({ state, invoiceId: request.objectId, expectedConfirmationRevision: confirmation.revision });
      return validateBrowserErvReadV1({ schemaVersion: "pansphaira.browser-erv-read/v1", tenantId, invoiceId: request.objectId,
        revision: state.revision, currency: confirmation.terms.currency, leadingStore: state.leadingStore,
        orderedQuantity: liability.orderedQuantity, acceptedQuantity: liability.acceptedQuantity, invoicedQuantity: liability.invoicedQuantity,
        invoiceAmountMinor: liability.source.invoiceAmountMinor, expectedAmountMinor: liability.expectedAmountMinor, varianceMinor: liability.varianceMinor,
        status: liability.status, decisionOutcome: liability.decision.outcome, basisDigest: liability.basisDigest,
        confirmationDigest: liability.source.confirmationDigest, invoiceSourceSha256: liability.source.invoiceSource.sha256,
        readOnly: true, bookingAuthorityGranted: false, paymentOrderAuthorized: false });
    },
    // Owner-local evidence about the SAME observed native parent source. This
    // intentionally publishes no order/supplier ID and confers no field or
    // supplier-entity read grant. Protected catalog scope remains separate.
    referenceEvidence(request) {
      const invoice = reader.read(request), state = readPan516Procurement({ root });
      if (JSON.stringify(state.binding) !== initialBinding) throw new Error("ERV_NATIVE_LEADING_BINDING_DRIFT_DENIED");
      if (state.revision !== invoice.revision) throw new Error("ERV_OBJECT_REVISION_STALE");
      const draft = state.effectiveDraft, terms = state.confirmations.at(-1)?.terms;
      const reference = value => typeof value === "string" && value.length > 0 ? value : null;
      const orderReference = reference(draft?.bestellungId), supplierReference = reference(draft?.lieferantId);
      const sourceDigest = createHash("sha256").update(JSON.stringify({
        schemaVersion: "pansphaira.native-order-supplier-source-evidence/v1", tenantId,
        invoiceId: invoice.invoiceId, nativeRevision: state.revision, binding: state.binding,
        orderReference, supplierReference, quantityUnit: terms?.unit ?? null, currency: terms?.currency ?? null,
      })).digest("hex");
      return Object.freeze({
        schemaVersion: "pansphaira.native-order-supplier-source-evidence/v1", tenantId,
        invoiceId: invoice.invoiceId, nativeRevision: state.revision, sourceDigest,
        leadingStore: state.leadingStore, sourceRecordCount: draft ? 1 : 0,
        sourceFacts: Object.freeze({orderReference: orderReference === null ? "UNKNOWN" : "AVAILABLE",
          supplierReference: supplierReference === null ? "UNKNOWN" : "AVAILABLE", supplierDisplayName: "UNKNOWN", assignee: "UNAVAILABLE"}),
        readOnly: true, fieldRightsQualified: false, relationRightsQualified: false, directoryAvailable: false,
        executionAuthorityGranted: false, bookingAuthorityGranted: false, paymentOrderAuthorized: false,
      });
    },
    search(request) {
      exact(request, ["tenantId", "query"], "ERV_SEARCH_REQUEST_DENIED");
      if (request.tenantId !== tenantId) throw new Error("ERV_TENANT_BINDING_DENIED");
      if (typeof request.query !== "string" || !/^[A-Z0-9][A-Z0-9-]{0,63}$/.test(request.query)) throw new Error("ERV_SEARCH_QUERY_DENIED");
      // Enumerate only the existing code-owned authorized native invoice IDs,
      // on the SAME reader/leading state. Search introduces no SQL/filter/URL,
      // source-right, supplier metadata, second database or fabricated result.
      const invoices = [...invoiceIds].map(objectId => reader.read({ tenantId, objectId, expectedRevision: null }));
      if (new Set(invoices.map(value => value.revision)).size !== 1) throw new Error("ERV_OBJECT_REVISION_STALE");
      return Object.freeze(invoices.filter(value => value.invoiceId.includes(request.query)));
    },
  });
  owned.set(reader, tenantId); return reader;
}
// Cold bootstrap has no invoice source yet. This is the same reader owner
// presenting explicit unavailability, never synthetic invoice results or new
// business authority. Setup/configuration need no invoice prerequisite.
export function createUnconfiguredNativeErvReadAdapterV1(tenantId) {
  if(typeof tenantId!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(tenantId))throw new Error('ERV_NATIVE_OWNER_BINDING_DENIED');
  const unavailable=()=>{throw new Error('ERV_NATIVE_SOURCE_NOT_CONFIGURED');};
  const reader=Object.freeze({read:unavailable,search:unavailable,referenceEvidence:unavailable});owned.set(reader,tenantId);return reader;
}
export const isNativeErvReadAdapterV1 = (reader, tenantId) => typeof tenantId === "string" && owned.has(reader) && owned.get(reader) === tenantId;
