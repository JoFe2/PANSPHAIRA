import { createHash } from "node:crypto";

const SCHEMA_V1 = "pansphaira.cscl13/complaint/v1";
const RECEIPT_SCHEMA_V1 = "pansphaira.cscl13/complaint-receipt/v1";

const sortDeep = (value) => {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype)
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]));
  return value;
};

export const canonicalJson = (value) => JSON.stringify(sortDeep(value));

const sha = (value) => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
const isRecord = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const exactKeys = (v, keys) => isRecord(v) && canonicalJson(Object.keys(v).sort()) === canonicalJson([...keys].sort());
const isId = (v) => typeof v === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(v);

const COMPLAINT_REASONS = new Set(["QUANTITY_SHORTAGE", "DAMAGED_GOODS", "WRONG_ARTICLE", "QUALITY_DEFECT"]);
const RESOLUTION_DECISIONS = new Set(["REPLACE", "CREDIT_NOTE_REQUEST", "REJECTED"]);

// Referenzvalidierung, fail-closed: jede Abweichung von der kanonischen Referenz
// (falscher Lieferbezug, überhöhte/ungültige Menge, fehlende Pflichtangabe) endet in einem
// deterministischen Ablehnungscode. Keine Schreibwirkung auf ERP/CRM — reiner lokaler Verlauf.
export function validateDeliveryReferences(references) {
  if (!exactKeys(references, ["schemaVersion", "referenceSetId", "tenantId", "lineage", "articles", "deliveries"]))
    return { outcome: "MALFORMED", code: "REFERENCE_SCHEMA_MISMATCH" };
  if (references.schemaVersion !== "pansphaira.cscl13/delivery-references/v1")
    return { outcome: "MALFORMED", code: "REFERENCE_SCHEMA_MISMATCH" };
  if (!isId(references.referenceSetId) || !isId(references.tenantId)) return { outcome: "MALFORMED", code: "REFERENCE_SCHEMA_MISMATCH" };
  if (!exactKeys(references.lineage, ["sourceSystem", "sourceDatasetId", "extractionMode", "sourceDigest"])
    || references.lineage.sourceSystem !== "SYNTHETIC_DELIVERY"
    || !isId(references.lineage.sourceDatasetId)
    || references.lineage.extractionMode !== "SUPPORTED_EXPORT"
    || typeof references.lineage.sourceDigest !== "string" || !/^[a-f0-9]{64}$/.test(references.lineage.sourceDigest))
    return { outcome: "MALFORMED", code: "REFERENCE_SCHEMA_MISMATCH" };
  if (!Array.isArray(references.articles) || !Array.isArray(references.deliveries)) return { outcome: "MALFORMED", code: "REFERENCE_SCHEMA_MISMATCH" };

  const articleIds = new Set();
  for (const article of references.articles) {
    if (!exactKeys(article, ["articleId", "articleName", "unit"]) || !isId(article.articleId)
      || typeof article.articleName !== "string" || article.articleName.length === 0
      || !["EACH", "KG"].includes(article.unit)) return { outcome: "MALFORMED", code: "REFERENCE_SCHEMA_MISMATCH" };
    if (articleIds.has(article.articleId)) return { outcome: "MALFORMED", code: "DUPLICATE_ARTICLE" };
    articleIds.add(article.articleId);
  }

  const deliveryIds = new Set();
  const positionIds = new Set();
  for (const delivery of references.deliveries) {
    if (!exactKeys(delivery, ["deliveryId", "orderId", "customerId", "deliveredAt", "positions"])
      || !isId(delivery.deliveryId) || !isId(delivery.orderId) || !isId(delivery.customerId)
      || typeof delivery.deliveredAt !== "string" || Number.isNaN(Date.parse(delivery.deliveredAt))
      || !Array.isArray(delivery.positions)) return { outcome: "MALFORMED", code: "REFERENCE_SCHEMA_MISMATCH" };
    if (deliveryIds.has(delivery.deliveryId)) return { outcome: "MALFORMED", code: "DUPLICATE_DELIVERY" };
    deliveryIds.add(delivery.deliveryId);
    if (delivery.positions.length === 0) return { outcome: "MALFORMED", code: "EMPTY_DELIVERY" };
    for (const position of delivery.positions) {
      const article = references.articles.find((a) => a.articleId === position.articleId);
      if (!exactKeys(position, ["positionId", "articleId", "quantity", "unit"])
        || !isId(position.positionId) || !article
        || !Number.isSafeInteger(position.quantity) || position.quantity <= 0
        || position.unit !== article.unit) return { outcome: "MALFORMED", code: "REFERENCE_SCHEMA_MISMATCH" };
      if (positionIds.has(position.positionId)) return { outcome: "MALFORMED", code: "DUPLICATE_POSITION" };
      positionIds.add(position.positionId);
    }
  }
  return { outcome: "VALID" };
}

// Unveränderlicher Referenzinhalt wird an Tenant und referenceSetId gebunden: jede spätere
// Abweichung (anderer Tenant, andere Lieferung/Position/Artikel/Menge) führt zu REFERENCE_DRIFT
// und lässt den gespeicherten Vorgang nicht mehr als gültig erscheinen.
const referencesDigest = (references) => sha({ schemaVersion: references.schemaVersion, referenceSetId: references.referenceSetId, tenantId: references.tenantId, lineage: references.lineage, articles: references.articles, deliveries: references.deliveries });

export function createComplaintLedger(references, options = {}) {
  const verdict = validateDeliveryReferences(references);
  if (verdict.outcome !== "VALID") {
    const denied = () => ({ outcome: "DENIED", code: verdict.code });
    return {
      select: denied, raise: denied, decide: denied, readback: denied, history: () => [],
      evidence: () => ({ reference: { outcome: "MALFORMED", code: verdict.code }, complaints: 0, decisions: 0, complaintIds: [] }),
      hydrate: () => { throw new Error(verdict.code); },
      snapshot: () => { throw new Error(verdict.code); },
    };
  }

  const positionIndex = new Map();
  for (const delivery of references.deliveries) {
    for (const position of delivery.positions) {
      positionIndex.set(position.positionId, { delivery, position });
    }
  }

  const complaints = new Map();
  const refDigest = referencesDigest(references);
  const orderBindingDigest = options.orderBinding?.bindingDigest ?? null;
  if (orderBindingDigest !== null && (typeof orderBindingDigest !== "string" || !/^[a-f0-9]{64}$/.test(orderBindingDigest))) {
    const denied = () => ({ outcome: "DENIED", code: "ORDER_BINDING_MALFORMED" });
    return { select: denied, raise: denied, decide: denied, readback: denied, history: () => [], evidence: () => ({ reference: { outcome: "MALFORMED", code: "ORDER_BINDING_MALFORMED" }, complaints: 0, decisions: 0, complaintIds: [] }), hydrate: () => { throw new Error("ORDER_BINDING_MALFORMED"); }, snapshot: () => { throw new Error("ORDER_BINDING_MALFORMED"); } };
  }

  const select = (request) => {
    if (!isRecord(request) || !exactKeys(request, ["positionId", "customerId"])
      || !isId(request.positionId) || !isId(request.customerId))
      return { outcome: "DENIED", code: "REQUEST_MALFORMED" };
    const found = positionIndex.get(request.positionId);
    if (!found) return { outcome: "DENIED", code: "POSITION_NOT_FOUND" };
    if (found.delivery.customerId !== request.customerId)
      return { outcome: "DENIED", code: "DELIVERY_REFERENCE_MISMATCH" };
    return {
      outcome: "SELECTED",
      positionId: found.position.positionId,
      articleId: found.position.articleId,
      orderId: found.delivery.orderId,
      deliveryId: found.delivery.deliveryId,
      customerId: found.delivery.customerId,
      deliveredQuantity: found.position.quantity,
      unit: found.position.unit,
      articleName: references.articles.find((a) => a.articleId === found.position.articleId)?.articleName,
    };
  };

  const raise = (request) => {
    if (!isRecord(request) || !exactKeys(request, ["customerId", "positionId", "reason", "quantity", "traceId", ...("raisedAt" in request ? ["raisedAt"] : [])])
      || !isId(request.customerId) || !isId(request.positionId)
      || !COMPLAINT_REASONS.has(request.reason)
      || !Number.isSafeInteger(request.quantity) || request.quantity <= 0
      || typeof request.traceId !== "string" || request.traceId.length === 0
      || (request.raisedAt !== undefined && (typeof request.raisedAt !== "string" || Number.isNaN(Date.parse(request.raisedAt)))))
      return { outcome: "DENIED", code: "REQUEST_MALFORMED" };

    const found = positionIndex.get(request.positionId);
    if (!found) return { outcome: "DENIED", code: "POSITION_NOT_FOUND" };
    if (found.delivery.customerId !== request.customerId)
      return { outcome: "DENIED", code: "DELIVERY_REFERENCE_MISMATCH" };
    if (request.quantity > found.position.quantity)
      return { outcome: "DENIED", code: "QUANTITY_EXCEEDS_DELIVERED" };

    // B1: positionsbezogene Mengenregel. Mehrere Gründe dürfen dieselben Waren betreffen,
    // dürfen aber keine zusätzliche Mengenberechtigung erzeugen. Kumulierte offene/bestätigte
    // Menge (REJECTED zählt nicht zur beanstandeten Ersatzmenge) darf die gelieferte Menge nie
    // übersteigen. Eine überbuchende zweite Erfassung wird hart verweigert.
    const alreadyClaimed = [...complaints.values()]
      .filter((entry) => entry.complaint.positionId === request.positionId)
      .filter((entry) => entry.decision === null || entry.decision.decision !== "REJECTED")
      .reduce((sum, entry) => sum + entry.complaint.claimedQuantity, 0);
    if (alreadyClaimed + request.quantity > found.position.quantity)
      return { outcome: "DENIED", code: "QUANTITY_EXCEEDS_DELIVERED" };

    const fingerprint = sha({ customerId: request.customerId, positionId: request.positionId, reason: request.reason });
    if ([...complaints.values()].some((c) => c.complaint.fingerprint === fingerprint))
      return { outcome: "DENIED", code: "DUPLICATE_COMPLAINT" };

    const complaintId = `complaint:${fingerprint.slice(0, 32)}`;
    const raisedAt = request.raisedAt ?? new Date().toISOString();
    const complaint = {
      complaintId,
      customerId: request.customerId,
      positionId: request.positionId,
      articleId: found.position.articleId,
      orderId: found.delivery.orderId,
      deliveryId: found.delivery.deliveryId,
      reason: request.reason,
      claimedQuantity: request.quantity,
      deliveredQuantity: found.position.quantity,
      unit: found.position.unit,
      raisedAt,
      traceId: request.traceId,
      fingerprint,
    };
    complaints.set(complaintId, { complaint, decision: null, history: [{
      at: raisedAt, kind: "RAISED", reason: request.reason, claimedQuantity: request.quantity, traceId: request.traceId,
    }] });
    return { outcome: "RAISED", complaintId, complaint };
  };

  const decide = (request) => {
    if (!isRecord(request) || !exactKeys(request, ["complaintId", "decision", "actorId", ...("at" in request ? ["at"] : [])])
      || !isId(request.complaintId) || !RESOLUTION_DECISIONS.has(request.decision)
      || typeof request.actorId !== "string" || request.actorId.length === 0
      || (request.at !== undefined && (typeof request.at !== "string" || Number.isNaN(Date.parse(request.at)))))
      return { outcome: "DENIED", code: "REQUEST_MALFORMED" };

    const entry = complaints.get(request.complaintId);
    if (!entry) return { outcome: "DENIED", code: "COMPLAINT_NOT_FOUND" };
    if (entry.decision !== null) return { outcome: "DENIED", code: "ALREADY_DECIDED" };

    const at = request.at ?? new Date().toISOString();
    const decision = { decision: request.decision, actorId: request.actorId, at };
    entry.decision = decision;
    entry.history.push({ at, kind: "DECIDED", decision: request.decision, actorId: request.actorId });
    return { outcome: "DECIDED", complaintId: request.complaintId, decision };
  };

  const readback = (request) => {
    if (!isRecord(request) || !exactKeys(request, ["complaintId"]) || !isId(request.complaintId))
      return { outcome: "DENIED", code: "REQUEST_MALFORMED" };
    const entry = complaints.get(request.complaintId);
    if (!entry) return { outcome: "DENIED", code: "COMPLAINT_NOT_FOUND" };
    return {
      outcome: "READ",
      complaint: entry.complaint,
      decision: entry.decision,
      history: entry.history.map((h) => ({ ...h })),
      readbackDigest: sha({ complaint: entry.complaint, decision: entry.decision, history: entry.history }),
    };
  };

  const history = (request) => {
    if (!isRecord(request) || !exactKeys(request, ["positionId"]) || !isId(request.positionId)) return [];
    return [...complaints.values()]
      .filter((entry) => entry.complaint.positionId === request.positionId)
      .map((entry) => ({
        complaintId: entry.complaint.complaintId,
        reason: entry.complaint.reason,
        decisions: entry.history.map((h) => ({ at: h.at, kind: h.kind })),
      }));
  };

  const snapshot = () => ({
    schemaVersion: RECEIPT_SCHEMA_V1,
    referenceSetId: references.referenceSetId,
    tenantId: references.tenantId,
    referencesDigest: refDigest,
    orderBindingDigest,
    entries: [...complaints.values()].map((entry) => ({
      complaint: entry.complaint,
      decision: entry.decision,
      history: entry.history,
    })),
    snapshotDigest: undefined,
  });

  const hydrate = (snap) => {
    if (!isRecord(snap) || snap.schemaVersion !== RECEIPT_SCHEMA_V1 || !Array.isArray(snap.entries))
      throw new Error("SNAPSHOT_MALFORMED");
    if (!isId(snap.referenceSetId) || snap.referenceSetId !== references.referenceSetId
      || !isId(snap.tenantId) || snap.tenantId !== references.tenantId
      || typeof snap.referencesDigest !== "string" || snap.referencesDigest !== refDigest)
      throw new Error("SNAPSHOT_REFERENCE_DRIFT");
    if (snap.orderBindingDigest !== orderBindingDigest) throw new Error("SNAPSHOT_ORDER_BINDING_DRIFT");

    const drank = [];
    for (const entry of snap.entries) {
      drank.push(hydrateEntry(entry));
    }
    complaints.clear();
    for (const [complaintId, hydrated] of drank) complaints.set(complaintId, hydrated);
  };

  // B2/B3: ein Snapshot-Eintrag wird nicht blind über raise/decide rekonstruiert, sondern als
  // verbindlicher Zustand geprüft. Beschwerde, Entscheidung und Ereignisverlauf müssen
  // untereinander und gegen die unveränderlichen Referenzen konsistent sein; jede Abweichung
  // (Drift, fehlende/überschüssige Historie, Identitätsänderung) wird hart abgelehnt.
  const hydrateEntry = (entry) => {
    if (!isRecord(entry) || !exactKeys(entry, ["complaint", "decision", "history"])
      || !Array.isArray(entry.history)) throw new Error("SNAPSHOT_MALFORMED");

    const complaint = entry.complaint;
    if (!isRecord(complaint) || !exactKeys(complaint, [
      "complaintId", "customerId", "positionId", "articleId", "orderId", "deliveryId",
      "reason", "claimedQuantity", "deliveredQuantity", "unit", "raisedAt", "traceId", "fingerprint",
    ])) throw new Error("SNAPSHOT_MALFORMED");

    const found = positionIndex.get(complaint.positionId);
    if (!found) throw new Error("SNAPSHOT_POSITION_NOT_FOUND");
    if (!isId(complaint.complaintId) || !complaint.complaintId.startsWith("complaint:"))
      throw new Error("SNAPSHOT_COMPLAINT_ID_MISMATCH");
    if (!isId(complaint.customerId) || complaint.customerId !== found.delivery.customerId)
      throw new Error("SNAPSHOT_REFERENCE_DRIFT");
    if (!isId(complaint.positionId)
      || complaint.articleId !== found.position.articleId
      || complaint.orderId !== found.delivery.orderId
      || complaint.deliveryId !== found.delivery.deliveryId
      || complaint.unit !== found.position.unit
      || !Number.isSafeInteger(complaint.deliveredQuantity) || complaint.deliveredQuantity !== found.position.quantity)
      throw new Error("SNAPSHOT_REFERENCE_DRIFT");

    // Identität/Fingerprint muss aus den gespeicherten fachlichen Feldern reproduzierbar sein;
    // eine still umgeschriebene complaintId darf nicht übernommen werden.
    const recomputedFingerprint = sha({ customerId: complaint.customerId, positionId: complaint.positionId, reason: complaint.reason });
    if (!/^[a-f0-9]{64}$/.test(complaint.fingerprint) || complaint.fingerprint !== recomputedFingerprint)
      throw new Error("SNAPSHOT_FINGERPRINT_MISMATCH");
    if (complaint.complaintId !== `complaint:${recomputedFingerprint.slice(0, 32)}`)
      throw new Error("SNAPSHOT_COMPLAINT_ID_MISMATCH");
    if (!COMPLAINT_REASONS.has(complaint.reason)
      || !Number.isSafeInteger(complaint.claimedQuantity) || complaint.claimedQuantity <= 0
      || complaint.claimedQuantity > complaint.deliveredQuantity)
      throw new Error("SNAPSHOT_MALFORMED");
    if (typeof complaint.raisedAt !== "string" || Number.isNaN(Date.parse(complaint.raisedAt))
      || typeof complaint.traceId !== "string" || complaint.traceId.length === 0)
      throw new Error("SNAPSHOT_MALFORMED");

    // Entscheidung: entweder null ODER vollständig und zum Verlauf konsistent.
    let decision = entry.decision;
    if (decision !== null) {
      if (!isRecord(decision) || !exactKeys(decision, ["decision", "actorId", "at"])
        || !RESOLUTION_DECISIONS.has(decision.decision)
        || typeof decision.actorId !== "string" || decision.actorId.length === 0
        || typeof decision.at !== "string" || Number.isNaN(Date.parse(decision.at)))
        throw new Error("SNAPSHOT_MALFORMED");
    }

    // Verlauf: muss mit RAISED beginnen, und jede Entscheidung (oder deren Fehlen) muss exakt
    // zum gespeicherten decision-Feld passen. Widersprüche (decision gesetzt ohne DECIDED-Eintrag,
    // DECIDED-Eintrag ohne decision, leere/überschüssige Historie) werden abgelehnt statt normalisiert.
    if (entry.history.length === 0) throw new Error("SNAPSHOT_HISTORY_MISMATCH");
    if (entry.history[0].kind !== "RAISED") throw new Error("SNAPSHOT_HISTORY_MISMATCH");
    const decidedEvents = entry.history.filter((h) => h.kind === "DECIDED");
    const raisedEvents = entry.history.filter((h) => h.kind === "RAISED");
    if (raisedEvents.length !== 1) throw new Error("SNAPSHOT_HISTORY_MISMATCH");
    for (const h of entry.history) {
      if (!isRecord(h)) throw new Error("SNAPSHOT_HISTORY_MISMATCH");
      if (h.kind !== "RAISED" && h.kind !== "DECIDED") throw new Error("SNAPSHOT_HISTORY_MISMATCH");
    }
    if (decision === null) {
      if (decidedEvents.length !== 0) throw new Error("SNAPSHOT_HISTORY_MISMATCH");
    } else {
      if (decidedEvents.length !== 1) throw new Error("SNAPSHOT_HISTORY_MISMATCH");
      const last = entry.history[entry.history.length - 1];
      if (last.kind !== "DECIDED" || last.decision !== decision.decision || last.actorId !== decision.actorId || last.at !== decision.at)
        throw new Error("SNAPSHOT_HISTORY_MISMATCH");
    }
    const raisedEvent = entry.history[0];
    if (raisedEvent.at !== complaint.raisedAt || raisedEvent.reason !== complaint.reason
      || raisedEvent.claimedQuantity !== complaint.claimedQuantity || raisedEvent.traceId !== complaint.traceId)
      throw new Error("SNAPSHOT_HISTORY_MISMATCH");

    return [complaint.complaintId, { complaint, decision, history: entry.history.map((h) => ({ ...h })) }];
  };

  const evidence = () => ({
    reference: { outcome: "VALID", referenceSetId: references.referenceSetId, deliveries: references.deliveries.length, positions: positionIndex.size },
    orderBinding: orderBindingDigest === null ? { outcome: "NOT_BOUND" } : { outcome: "BOUND", bindingDigest: orderBindingDigest },
    complaints: complaints.size,
    decisions: [...complaints.values()].filter((entry) => entry.decision !== null).length,
    complaintIds: [...complaints.keys()].sort(),
  });

  return { select, raise, decide, readback, history, evidence, hydrate, snapshot };
}
