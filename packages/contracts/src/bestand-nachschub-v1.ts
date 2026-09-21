import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import type { BestellentwurfV1, WareneingangLedgerV1 } from "./beschaffung-wareneingang-v1.js";
import { mengenzustandV1 } from "./beschaffung-wareneingang-v1.js";

/**
 * M3 slice (Bestand / Nachschub) — NEW fachliche concepts (no predecessor in
 * this repository; recorded in the reuse map). Deliberately narrow: one
 * inventory position identity, the separated Reservierungs-/Verfügbarkeits-
 * begriffe as a closed invariant, a versioned change ledger with dedup and
 * readback, and a replenishment (Nachschub) decision that REJECTS rather than
 * silently writes. No universal ERP metamodel; no word-heuristic grants.
 *
 * Closed identities (no word similarity as a grant):
 *   - artikelId  : `SYN-ART-*`
 *   - lagerortId : `LAGER-*`
 *   - einheit    : `STK` (Stück) is the closed unit of this slice
 *
 * Separated concepts: `physisch` (present) and `reserviert` (reserved) are
 * distinct; `verfuegbar` = physisch − reserviert is DERIVED, never stored
 * independently (closed invariant, reserviert ≤ physisch).
 *
 * Freshness and lineage (review finding F5): a stock position carries a
 * closed, RETAINED origin bundle (`herkunft`: source identity, observation
 * time, source revision) — it is never silently dropped. A versioned change
 * carries a RETAINED source-bound `beleg` (the M1 Wareneingang receipt or the
 * M2 customer order it is evidence of). The Nachschub decision is made UNDER
 * a closed freshness policy: unproven provenance yields an explicit
 * BESTANDSFRISCHHEIT_UNBEWEIST terminal, an over-age observation yields
 * BESTANDSFRISCHHEIT_VERALTET, and only a proven-and-current position reaches
 * the threshold decision. A source-bound M1->M3 receipt adapter
 * (wareneingangZuBestandsaenderungV1) maps REAL M1 received-quantity evidence
 * into a closed EINKUNFT change via an EXPLICIT identity/unit adapter —
 * never inferred, never from a rollback or a stock balance.
 */
export const BESTAND_SCHEMA_V1 = "cm.fachprofil/bestand/v1" as const;
export const NACHSCHUB_SCHEMA_V1 = "cm.fachprofil/nachschub/v1" as const;
export const BESTAND_UNIT_V1 = "STK" as const;
/** Closed fachliche upper bound for one stock quantity (STK). Decisions are
 * taken within safe-integer arithmetic; a quantity beyond this bound is a
 * closed denial, never a silently overflowed state (digest does not validate
 * quantity invariants). */
export const BESTAND_MAX_QUANTITY_V1 = 1_000_000_000 as const;
export const BESTAND_CHANGE_SCHEMA_V1 = "cm.fachprofil/bestand-aenderung/v1" as const;
export const NACHSCHUB_RECEIPT_SCHEMA_V1 = "cm.fachprofil/nachschub-receipt/v1" as const;
export const BESTANDSFRISCHE_POLITIK_SCHEMA_V1 = "cm.fachprofil/bestandsfrische-politik/v1" as const;
export const BESTANDSVERLAUF_SCHEMA_V1 = "cm.fachprofil/bestandsverlauf/v1" as const;
export const IDENTITAETSADAPTER_SCHEMA_V1 = "cm.fachprofil/artikel-identitaets-adapter/v1" as const;

/**
 * F5: a RETAINED, closed origin bundle for one stock position. Where the
 * position's numbers come from (quelle), when they were observed
 * (beobachtetAm) and at which source revision (quelleRevision). Present or
 * explicitly absent — a timeless position is representable but can never
 * reach a threshold decision (it is UNPROVEN at decision time).
 */
export interface BestandspositionHerkunftV1 {
  /** Closed source-system identity (a 3-64 char token, e.g. `synthetic-old`). */
  readonly quelle: string;
  /** Closed ISO datetime the position was observed. */
  readonly beobachtetAm: string;
  /** Closed source-revision token (which revision of the source the figure is from). */
  readonly quelleRevision: string;
}

/**
 * F5: a RETAINED, source-bound Beleg (evidence) on a versioned change — the
 * M1 Wareneingang receipt or M2 customer order this stock change is evidence
 * of. Naming a change EINKUNFT is not itself a connection to M1/M2 evidence;
 * the Beleg is the explicit, verifiable link.
 */
export interface BestandAenderungBelegV1 {
  /** Closed evidence reference id (e.g. the M1 eingangsId). */
  readonly belegId: string;
  readonly belegArt: "WARENEINGANG" | "KUNDENAUFTRAG" | "BESTELLUNG";
  /** Closed source-system identity the Beleg comes from. */
  readonly quelle: string;
  /** Closed ISO datetime the Beleg evidence occurred. */
  readonly zeitstempel: string;
}

/**
 * F5: a closed freshness policy evaluated at Nachschub decision time.
 * `maximalerAlterSekunden` is the freshness horizon; `entscheidungsZeitpunkt`
 * is the decision "now". Age = now - beobachtetAm; over horizon => STALE,
 * no herkunft => UNPROVEN, future observation => DENIED (impossible).
 */
export interface BestandsFrischePolitikV1 {
  readonly politikId: string;
  readonly version: string;
  readonly maximalerAlterSekunden: number;
  readonly entscheidungsZeitpunkt: string;
}

/** F5: a retained lineage entry for one applied change (not just the change id). */
export interface BestandsverlaufEintragV1 {
  readonly schemaVersion: typeof BESTANDSVERLAUF_SCHEMA_V1;
  readonly aenderungsId: string;
  readonly art: BestandAenderungArtV1;
  readonly zeitstempel: string;
  readonly beleg: BestandAenderungBelegV1 | null;
  readonly beforeDigest: string;
  readonly afterDigest: string;
}

/**
 * F5: an EXPLICIT identity/unit adapter (closed table) mapping an M1
 * procurement article/warehouse to the M3 inventory identity. EINK-ART-* and
 * SYN-ART-* are deliberately different closed vocabularies; a mapping exists
 * ONLY where it is listed here — it is never inferred from shared spelling.
 * The unit is identity-only (STK): no conversion factor is fabricated.
 */
export interface ArtikelIdentitaetsMappingV1 {
  readonly m1ArtikelId: string;
  readonly m3ArtikelId: string;
  readonly m3LagerortId: string;
  readonly einheit: "STK";
}
export interface ArtikelIdentitaetsAdapterV1 {
  readonly adapterId: string;
  readonly mappingen: readonly ArtikelIdentitaetsMappingV1[];
}

export type BestandAenderungArtV1 = "EINKUNFT" | "VERAUSGABE" | "RESERVIERUNG" | "RESERVIERUNG_AUFLUESEN";

export const BESTAND_AENDERUNG_ART_V1: readonly BestandAenderungArtV1[] = [
  "EINKUNFT", "VERAUSGABE", "RESERVIERUNG", "RESERVIERUNG_AUFLUESEN",
];

export interface BestandspositionV1 {
  readonly artikelId: string;
  readonly lagerortId: string;
  readonly einheit: typeof BESTAND_UNIT_V1;
  readonly physisch: number;
  readonly reserviert: number;
  /** F5: retained origin bundle (closed) — present or explicitly absent. A
   *  timeless position is representable but UNPROVEN at decision time. */
  readonly herkunft: BestandspositionHerkunftV1 | null;
}

export interface BestandslageV1 {
  readonly schemaVersion: typeof BESTAND_SCHEMA_V1;
  readonly positions: readonly BestandspositionV1[];
  /** F5: retained lineage — one entry per applied change (not just the id). */
  readonly verlauf: readonly BestandsverlaufEintragV1[];
  readonly lageDigest: string;
}

export interface BestandAenderungV1 {
  readonly schemaVersion: typeof BESTAND_CHANGE_SCHEMA_V1;
  readonly aenderungsId: string;
  readonly artikelId: string;
  readonly lagerortId: string;
  readonly einheit: typeof BESTAND_UNIT_V1;
  readonly art: BestandAenderungArtV1;
  readonly menge: number;
  readonly zeitstempel: string;
  /** F5: retained, source-bound Beleg (evidence of the M1/M2 source), or null. */
  readonly beleg: BestandAenderungBelegV1 | null;
}

export interface NachschubAnforderungV1 {
  readonly anforderungsId: string;
  readonly artikelId: string;
  readonly lagerortId: string;
  readonly einheit: typeof BESTAND_UNIT_V1;
  readonly schwellenwert: number;
  readonly nachschubmenge: number;
  readonly grund: string;
}

function sha(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

const ARTIKELID_RE = /^SYN-ART-[A-Z0-9-]{3,28}$/;
const LAGERORT_RE = /^LAGER-[A-Z0-9-]{2,28}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const AENDERUNGSID_RE = /^aenderung:bestand-[a-z0-9-]{3,64}$/;
const NACHSCHUBID_RE = /^nachschub:[a-z0-9-]{3,64}$/;
// F5: closed lowercase-dash token (3-64 chars) for source-system / revision ids.
const F5_TOKEN_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;
const F5_BELEGIID_RE = /^[a-z0-9][a-z0-9:-]{2,63}$/;
const F5_POLITIKID_RE = /^frische:[a-z0-9-]{3,64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

export type BestandDenialCodeV1 =
  | "POSITION_NOT_OBJECT"
  | "POSITION_TOKENS_NOT_CLOSED"
  | "POSITION_UNIT_NOT_STK"
  | "POSITION_NEGATIVE_QUANTITY"
  | "POSITION_QUANTITY_OUT_OF_BOUNDS"
  | "POSITION_HERKUNFT_NOT_CLOSED"
  | "RESERVATION_EXCEEDS_PHYSICAL"
  | "DUPLICATE_POSITION";

export type BestandResultV1 =
  | Readonly<{ outcome: "LAGE"; lage: BestandslageV1 }>
  | Readonly<{ outcome: "DENIED"; code: BestandDenialCodeV1; detail: string }>;

function positionKey(p: Pick<BestandspositionV1, "artikelId" | "lagerortId" | "einheit">): string {
  return `${p.artikelId}::${p.lagerortId}::${p.einheit}`;
}

/** F5: closed origin-bundle validation. A herkunft is present-and-closed or absent. */
function herkunftClosed(value: unknown): value is BestandspositionHerkunftV1 | null {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object" || value === null) return false;
  const h = value as Record<string, unknown>;
  if (Object.keys(h).length !== 3) return false;
  const { quelle, beobachtetAm, quelleRevision } = h;
  if (typeof quelle !== "string" || !F5_TOKEN_RE.test(quelle)) return false;
  if (typeof beobachtetAm !== "string" || !ISO_DATETIME_RE.test(beobachtetAm)) return false;
  if (typeof quelleRevision !== "string" || !F5_TOKEN_RE.test(quelleRevision)) return false;
  return true;
}

/** F5: closed Beleg (source-bound evidence) validation. Present-and-closed or null. */
function belegClosed(value: unknown): value is BestandAenderungBelegV1 | null {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object" || value === null) return false;
  const b = value as Record<string, unknown>;
  if (Object.keys(b).length !== 4) return false;
  const { belegId, belegArt, quelle, zeitstempel } = b;
  if (typeof belegId !== "string" || !F5_BELEGIID_RE.test(belegId)) return false;
  if (belegArt !== "WARENEINGANG" && belegArt !== "KUNDENAUFTRAG" && belegArt !== "BESTELLUNG") return false;
  if (typeof quelle !== "string" || !F5_TOKEN_RE.test(quelle)) return false;
  if (typeof zeitstempel !== "string" || !ISO_DATETIME_RE.test(zeitstempel)) return false;
  return true;
}

/**
 * F5: the single closed digest for a Bestandslage (its positions INCLUDING the
 * retained herkunft origin bundles, plus the retained verlauf lineage). Compute
 * and verify share this exact function so they cannot drift; a digest covers
 * the origin/time and lineage, not just the quantities.
 */
function lageDigestVonV1(positions: readonly BestandspositionV1[], verlauf: readonly BestandsverlaufEintragV1[]): string {
  const withVerfuegbar = positions.map((p) => ({ ...p, verfuegbar: p.physisch - p.reserviert }));
  return sha({ positions: withVerfuegbar, verlauf });
}

function validatePosition(p: unknown, index: number): { ok: true } | { ok: false; code: BestandDenialCodeV1; detail: string } {
  if (!isRecord(p)) return { ok: false, code: "POSITION_NOT_OBJECT", detail: `positions[${index}] is not an object.` };
  const { artikelId, lagerortId, einheit, physisch, reserviert } = p;
  if (typeof artikelId !== "string" || !ARTIKELID_RE.test(artikelId)) {
    return { ok: false, code: "POSITION_TOKENS_NOT_CLOSED", detail: `positions[${index}].artikelId ${String(artikelId)} is not a closed SYN-ART-* token.` };
  }
  if (typeof lagerortId !== "string" || !LAGERORT_RE.test(lagerortId)) {
    return { ok: false, code: "POSITION_TOKENS_NOT_CLOSED", detail: `positions[${index}].lagerortId ${String(lagerortId)} is not a closed LAGER-* token.` };
  }
  if (einheit !== BESTAND_UNIT_V1) {
    return { ok: false, code: "POSITION_UNIT_NOT_STK", detail: `positions[${index}].einheit ${String(einheit)} is not the closed unit STK.` };
  }
  const phys = p.physisch;
  const resv = p.reserviert;
  // Closed numeric bounds at initialization. A non-safe-integer quantity is
  // OUT OF BOUNDS (it leaves the safe, closed numeric domain) — it is NOT
  // "negative". A safe integer below zero is NEGATIVE. A safe integer above
  // the closed bound is OUT OF BOUNDS. Each is a distinct, accurate denial.
  if (typeof phys !== "number" || !Number.isSafeInteger(phys)) {
    return { ok: false, code: "POSITION_QUANTITY_OUT_OF_BOUNDS", detail: `positions[${index}].physisch ${String(phys)} is not a safe integer; quantities stay within the safe, closed numeric domain.` };
  }
  if (phys < 0) {
    return { ok: false, code: "POSITION_NEGATIVE_QUANTITY", detail: `positions[${index}].physisch ${phys} is negative; quantities are non-negative.` };
  }
  if (phys > BESTAND_MAX_QUANTITY_V1) {
    return { ok: false, code: "POSITION_QUANTITY_OUT_OF_BOUNDS", detail: `positions[${index}].physisch ${phys} exceeds the closed quantity bound ${BESTAND_MAX_QUANTITY_V1}; quantities stay within safe, closed bounds.` };
  }
  if (typeof resv !== "number" || !Number.isSafeInteger(resv)) {
    return { ok: false, code: "POSITION_QUANTITY_OUT_OF_BOUNDS", detail: `positions[${index}].reserviert ${String(resv)} is not a safe integer; quantities stay within the safe, closed numeric domain.` };
  }
  if (resv < 0) {
    return { ok: false, code: "POSITION_NEGATIVE_QUANTITY", detail: `positions[${index}].reserviert ${resv} is negative; quantities are non-negative.` };
  }
  if (resv > BESTAND_MAX_QUANTITY_V1) {
    return { ok: false, code: "POSITION_QUANTITY_OUT_OF_BOUNDS", detail: `positions[${index}].reserviert ${resv} exceeds the closed quantity bound ${BESTAND_MAX_QUANTITY_V1}; quantities stay within safe, closed bounds.` };
  }
  if (resv > phys) {
    return { ok: false, code: "RESERVATION_EXCEEDS_PHYSICAL", detail: `positions[${index}] reserviert ${resv} exceeds physisch ${phys}; the closed invariant is violated.` };
  }
  // F5: the origin bundle is retained, never silently dropped — but when
  // present it must be closed (source identity / ISO observation time /
  // source revision). A malformed herkunft is a denial, not a silent drop.
  if (!herkunftClosed((p as Record<string, unknown>).herkunft)) {
    return { ok: false, code: "POSITION_HERKUNFT_NOT_CLOSED", detail: `positions[${index}].herkunft is not a closed origin bundle (quelle/beobachtetAm/quelleRevision) or null.` };
  }
  return { ok: true };
}

export function bestandslageBerechnenV1(positions: readonly unknown[]): BestandResultV1 {
  const seen = new Set<string>();
  const normalized: BestandspositionV1[] = [];
  for (let i = 0; i < positions.length; i += 1) {
    const p = positions[i];
    const check = validatePosition(p, i);
    if (!check.ok) return { outcome: "DENIED", code: check.code, detail: check.detail };
    const pos = p as BestandspositionV1;
    const key = positionKey(pos);
    if (seen.has(key)) {
      return { outcome: "DENIED", code: "DUPLICATE_POSITION", detail: `Duplicate position ${key}; the closed position identity (artikel+location+unit) must be unique.` };
    }
    seen.add(key);
    normalized.push({ artikelId: pos.artikelId, lagerortId: pos.lagerortId, einheit: BESTAND_UNIT_V1, physisch: pos.physisch, reserviert: pos.reserviert, herkunft: pos.herkunft ?? null });
  }
  const lage: BestandslageV1 = {
    schemaVersion: BESTAND_SCHEMA_V1,
    positions: normalized,
    verlauf: [],
    lageDigest: lageDigestVonV1(normalized, []),
  };
  return { outcome: "LAGE", lage };
}

export function verfuegbarVonV1(position: BestandspositionV1): number {
  return position.physisch - position.reserviert;
}

type AenderungDenialCodeV1 =
  | "AENDERUNG_NOT_OBJECT"
  | "AENDERUNG_ID_NOT_CLOSED"
  | "AENDERUNG_TOKENS_NOT_CLOSED"
  | "AENDERUNG_UNIT_NOT_STK"
  | "AENDERUNG_ART_NOT_CLOSED"
  | "AENDERUNG_MENGE_NOT_POSITIVE"
  | "AENDERUNG_ZEITSTAMPF_NOT_CLOSED"
  | "AENDERUNG_POSITION_UNKNOWN"
  | "AENDERUNG_REPLAY_DENIED"
  | "AENDERUNG_INSUFFICIENT_PHYSICAL"
  | "AENDERUNG_INSUFFICIENT_AVAILABLE"
  | "AENDERING_QUANTITY_OUT_OF_BOUNDS"
  | "AENDERUNG_BELEG_NOT_CLOSED";

export interface BestandLageMitVerlaufV1 {
  readonly lage: BestandslageV1;
  readonly appliedAenderungsIds: readonly string[];
}

export type AenderungResultV1 =
  | Readonly<{ outcome: "GEAENDERT"; lage: BestandLageMitVerlaufV1; beforeDigest: string; afterDigest: string }>
  | Readonly<{ outcome: "DENIED"; code: AenderungDenialCodeV1; detail: string }>;

function positionIndexOf(lage: BestandslageV1, artikelId: string, lagerortId: string): number {
  return lage.positions.findIndex((p) => p.artikelId === artikelId && p.lagerortId === lagerortId);
}

/**
 * Apply one versioned Bestand change to a known Bestandslage with dedup and
 * readback. `appliedAenderungsIds` is the closed dedup ledger (the same
 * aenderungsId may not be applied twice). The change is a versioned fachliche
 * event; on denial the lage is unchanged (no partial writes).
 */
export function bestandAenderungAnwendenV1(
  lage: BestandslageV1,
  aenderung: unknown,
  appliedAenderungsIds: readonly string[],
): AenderungResultV1 {
  if (!isRecord(aenderung)) return { outcome: "DENIED", code: "AENDERUNG_NOT_OBJECT", detail: "Aenderung is not an object." };
  const { aenderungsId, artikelId, lagerortId, einheit, art, menge, zeitstempel } = aenderung;
  if (typeof aenderungsId !== "string" || !AENDERUNGSID_RE.test(aenderungsId)) {
    return { outcome: "DENIED", code: "AENDERUNG_ID_NOT_CLOSED", detail: `aenderungsId ${String(aenderungsId)} is not a closed aenderung:bestand-* token.` };
  }
  if (appliedAenderungsIds.includes(aenderungsId)) {
    return { outcome: "DENIED", code: "AENDERUNG_REPLAY_DENIED", detail: `aenderungsId ${aenderungsId} was already applied; versioned changes are not replayed.` };
  }
  if (typeof artikelId !== "string" || !ARTIKELID_RE.test(artikelId)) {
    return { outcome: "DENIED", code: "AENDERUNG_TOKENS_NOT_CLOSED", detail: `artikelId ${String(artikelId)} is not a closed SYN-ART-* token.` };
  }
  if (typeof lagerortId !== "string" || !LAGERORT_RE.test(lagerortId)) {
    return { outcome: "DENIED", code: "AENDERUNG_TOKENS_NOT_CLOSED", detail: `lagerortId ${String(lagerortId)} is not a closed LAGER-* token.` };
  }
  if (einheit !== BESTAND_UNIT_V1) {
    return { outcome: "DENIED", code: "AENDERUNG_UNIT_NOT_STK", detail: `einheit ${String(einheit)} is not the closed unit STK.` };
  }
  if (typeof art !== "string" || !(BESTAND_AENDERUNG_ART_V1 as readonly string[]).includes(art)) {
    return { outcome: "DENIED", code: "AENDERUNG_ART_NOT_CLOSED", detail: `art ${String(art)} is not a closed BestandAenderungArtV1.` };
  }
  if (typeof menge !== "number" || !Number.isSafeInteger(menge) || menge < 1) {
    return { outcome: "DENIED", code: "AENDERUNG_MENGE_NOT_POSITIVE", detail: `menge ${String(menge)} is not a positive integer.` };
  }
  if (typeof zeitstempel !== "string" || !ISO_DATETIME_RE.test(zeitstempel)) {
    return { outcome: "DENIED", code: "AENDERUNG_ZEITSTAMPF_NOT_CLOSED", detail: `zeitstempel ${String(zeitstempel)} is not a closed ISO datetime (YYYY-MM-DDTHH:MM:SSZ).` };
  }
  // F5: the source-bound Beleg is retained, never silently dropped; when
  // present it must be closed. Naming the change EINKUNFT is NOT itself a
  // connection to M1/M2 evidence — the Beleg is the explicit verifiable link.
  if (!belegClosed(aenderung.beleg)) {
    return { outcome: "DENIED", code: "AENDERUNG_BELEG_NOT_CLOSED", detail: `beleg is not a closed source-bound evidence bundle (belegId/belegArt/quelle/zeitstempel) or null.` };
  }
  const beleg = (aenderung.beleg ?? null) as BestandAenderungBelegV1 | null;
  const artClosed = art as BestandAenderungArtV1;
  const zeitstempelClosed = zeitstempel as string;
  const aenderungsIdClosed = aenderungsId as string;
  const idx = positionIndexOf(lage, artikelId, lagerortId);
  if (idx < 0) {
    return { outcome: "DENIED", code: "AENDERUNG_POSITION_UNKNOWN", detail: `position ${artikelId} @ ${lagerortId} is not in the Bestandslage; a change cannot apply to an unknown position.` };
  }
  const before = lage.positions[idx];
  if (before === undefined) {
    return { outcome: "DENIED", code: "AENDERUNG_POSITION_UNKNOWN", detail: `position ${artikelId} @ ${lagerortId} is not in the Bestandslage.` };
  }
  let physisch = before.physisch;
  let reserviert = before.reserviert;
  if (art === "EINKUNFT") {
    physisch += menge;
  } else if (art === "VERAUSGABE") {
    if (menge > before.physisch - before.reserviert) {
      return { outcome: "DENIED", code: "AENDERUNG_INSUFFICIENT_AVAILABLE", detail: `VERAUSGABE ${menge} exceeds verfuegbar ${before.physisch - before.reserviert}; available stock cannot go negative.` };
    }
    physisch -= menge;
  } else if (art === "RESERVIERUNG") {
    if (menge > before.physisch - before.reserviert) {
      return { outcome: "DENIED", code: "AENDERUNG_INSUFFICIENT_AVAILABLE", detail: `RESERVIERUNG ${menge} exceeds verfuegbar ${before.physisch - before.reserviert}; the closed invariant reserviert ≤ physisch would be violated.` };
    }
    reserviert += menge;
  } else {
    // RESERVIERUNG_AUFLUESEN
    if (menge > before.reserviert) {
      return { outcome: "DENIED", code: "AENDERUNG_INSUFFICIENT_PHYSICAL", detail: `RESERVIERUNG_AUFLUESEN ${menge} exceeds reserviert ${before.reserviert}.` };
    }
    reserviert -= menge;
  }
  if (reserviert > physisch) {
    return { outcome: "DENIED", code: "AENDERUNG_INSUFFICIENT_PHYSICAL", detail: `closed invariant violated: reserviert ${reserviert} > physisch ${physisch}.` };
  }
  // Closed numeric bound: the ARITHMETIC RESULT must stay within safe integer
  // bounds before any new state is emitted. A digest verifies the bytes, not
  // the quantity invariants; an overflowed state is a denial, never a state.
  if (!Number.isSafeInteger(physisch) || physisch < 0 || physisch > BESTAND_MAX_QUANTITY_V1
    || !Number.isSafeInteger(reserviert) || reserviert < 0 || reserviert > BESTAND_MAX_QUANTITY_V1) {
    return { outcome: "DENIED", code: "AENDERING_QUANTITY_OUT_OF_BOUNDS", detail: `arithmetic result physisch ${physisch} / reserviert ${reserviert} leaves the closed quantity bounds [0, ${BESTAND_MAX_QUANTITY_V1}]; no new state is emitted.` };
  }
  // A stock change does not re-source the position: the retained origin
  // bundle (herkunft) is carried through unchanged.
  const updated: BestandspositionV1 = { artikelId, lagerortId, einheit: BESTAND_UNIT_V1, physisch, reserviert, herkunft: before.herkunft };
  const positions = [...lage.positions];
  positions[idx] = updated;
  // F5: the applied change is RETAINED as lineage (not just the change id):
  // its art, timestamp, the source-bound Beleg and the before/after digests.
  // The lineage entry's afterDigest is the after-lage digest; the after-lage
  // digest covers positions + this lineage entry (computed atomically, no
  // readonly mutation).
  const verlaufBasis = [...lage.verlauf];
  const afterDigest = lageDigestVonV1(positions, verlaufBasis); // provisional lineage, digest of content
  const verlaufEintrag: BestandsverlaufEintragV1 = {
    schemaVersion: BESTANDSVERLAUF_SCHEMA_V1,
    aenderungsId: aenderungsIdClosed,
    art: artClosed,
    zeitstempel: zeitstempelClosed,
    beleg,
    beforeDigest: lage.lageDigest,
    afterDigest,
  };
  const verlauf = [...verlaufBasis, verlaufEintrag];
  const afterLageDigest = lageDigestVonV1(positions, verlauf);
  const afterLage: BestandslageV1 = { schemaVersion: BESTAND_SCHEMA_V1, positions, verlauf, lageDigest: afterLageDigest };
  // readback: recompute the applied position and verify it matches
  const readbackIdx = positionIndexOf(afterLage, artikelId, lagerortId);
  const readback = afterLage.positions[readbackIdx];
  if (readback === undefined || readback.physisch !== physisch || readback.reserviert !== reserviert) {
    return { outcome: "DENIED", code: "AENDERUNG_POSITION_UNKNOWN", detail: "readback mismatch: the applied change did not persist." };
  }
  return {
    outcome: "GEAENDERT",
    lage: { lage: afterLage, appliedAenderungsIds: [...appliedAenderungsIds, aenderungsId] },
    beforeDigest: lage.lageDigest,
    afterDigest: afterLage.lageDigest,
  };
}

type NachschubDenialCodeV1 =
  | "NACHSCHUB_NOT_OBJECT"
  | "NACHSCHUB_ID_NOT_CLOSED"
  | "NACHSCHUB_TOKENS_NOT_CLOSED"
  | "NACHSCHUB_UNIT_NOT_STK"
  | "NACHSCHUB_SCHWELLE_NOT_NONNEGATIVE"
  | "NACHSCHUB_MENGE_NOT_POSITIVE"
  | "NACHSCHUB_GRUND_EMPTY"
  | "NACHSCHUB_POSITION_UNKNOWN";

export type NachschubEntscheidungV1 =
  | Readonly<{
      outcome: "NACHSCHUB_ERFORDERLICH";
      angeforderteMenge: number;
      verfuegbar: number;
      schwellenwert: number;
      position: BestandspositionV1;
    }>
  | Readonly<{ outcome: "NACHSCHUB_NICHT_ERFORDERLICH"; verfuegbar: number; schwellenwert: number; position: BestandspositionV1 }>
  | Readonly<{ outcome: "DENIED"; code: NachschubDenialCodeV1; detail: string }>;

/**
 * A Nachschub (replenishment) DECISION. It compares the available stock
 * (verfuegbar) with the closed threshold and returns a requirement decision —
 * it REJECTS/decides rather than silently writing a purchase order. The
 * decision is a fachliche, evidence-citing result; executing the actual
 * replenishment is a separate, separately-authorized write (not granted here).
 */
export function nachschubEntscheidenV1(
  lage: BestandslageV1,
  anforderung: unknown,
): NachschubEntscheidungV1 {
  if (!isRecord(anforderung)) return { outcome: "DENIED", code: "NACHSCHUB_NOT_OBJECT", detail: "Anforderung is not an object." };
  const { anforderungsId, artikelId, lagerortId, einheit, schwellenwert, nachschubmenge, grund } = anforderung;
  if (typeof anforderungsId !== "string" || !NACHSCHUBID_RE.test(anforderungsId)) {
    return { outcome: "DENIED", code: "NACHSCHUB_ID_NOT_CLOSED", detail: `anforderungsId ${String(anforderungsId)} is not a closed nachschub:* token.` };
  }
  if (typeof artikelId !== "string" || !ARTIKELID_RE.test(artikelId)) {
    return { outcome: "DENIED", code: "NACHSCHUB_TOKENS_NOT_CLOSED", detail: `artikelId ${String(artikelId)} is not a closed SYN-ART-* token.` };
  }
  if (typeof lagerortId !== "string" || !LAGERORT_RE.test(lagerortId)) {
    return { outcome: "DENIED", code: "NACHSCHUB_TOKENS_NOT_CLOSED", detail: `lagerortId ${String(lagerortId)} is not a closed LAGER-* token.` };
  }
  if (einheit !== BESTAND_UNIT_V1) {
    return { outcome: "DENIED", code: "NACHSCHUB_UNIT_NOT_STK", detail: `einheit ${String(einheit)} is not the closed unit STK.` };
  }
  if (typeof schwellenwert !== "number" || !Number.isSafeInteger(schwellenwert) || schwellenwert < 0) {
    return { outcome: "DENIED", code: "NACHSCHUB_SCHWELLE_NOT_NONNEGATIVE", detail: `schwellenwert ${String(schwellenwert)} is not a non-negative integer.` };
  }
  if (typeof nachschubmenge !== "number" || !Number.isSafeInteger(nachschubmenge) || nachschubmenge < 1) {
    return { outcome: "DENIED", code: "NACHSCHUB_MENGE_NOT_POSITIVE", detail: `nachschubmenge ${String(nachschubmenge)} is not a positive integer.` };
  }
  if (typeof grund !== "string" || grund.length === 0) {
    return { outcome: "DENIED", code: "NACHSCHUB_GRUND_EMPTY", detail: "grund must be a non-empty fachliche reason." };
  }
  const idx = positionIndexOf(lage, artikelId, lagerortId);
  if (idx < 0) {
    return { outcome: "DENIED", code: "NACHSCHUB_POSITION_UNKNOWN", detail: `position ${artikelId} @ ${lagerortId} is not in the Bestandslage.` };
  }
  const position = lage.positions[idx];
  if (position === undefined) {
    return { outcome: "DENIED", code: "NACHSCHUB_POSITION_UNKNOWN", detail: `position ${artikelId} @ ${lagerortId} is not in the Bestandslage.` };
  }
  const verfuegbar = verfuegbarVonV1(position);
  if (verfuegbar < schwellenwert) {
    return { outcome: "NACHSCHUB_ERFORDERLICH", angeforderteMenge: nachschubmenge, verfuegbar, schwellenwert, position };
  }
  return { outcome: "NACHSCHUB_NICHT_ERFORDERLICH", verfuegbar, schwellenwert, position };
}

/** Verify a Bestandslage's closed digest against its derived content. The
 *  digest covers the retained herkunft origin bundles AND the retained
 *  verlauf lineage (F5), not just the quantities — so a stale/timeless or
 *  lineage-less state is distinguishable by its digest. */
export function verifyBestandslageDigestV1(lage: unknown): boolean {
  if (!isRecord(lage)) return false;
  if (!Array.isArray(lage.positions)) return false;
  if (!Array.isArray(lage.verlauf)) return false;
  if (typeof lage.lageDigest !== "string") return false;
  const positions = lage.positions as readonly BestandspositionV1[];
  return lage.lageDigest === lageDigestVonV1(positions, lage.verlauf as readonly BestandsverlaufEintragV1[]);
}

// ---------------------------------------------------------------------------
// F5 — freshness at decision time + source-bound lineage adapter
// ---------------------------------------------------------------------------

export type FrischeUrteilV1 =
  | Readonly<{ outcome: "BESTANDSFRISCHHEIT_BEWIESEN_AKTUELL"; alterSekunden: number; herkunft: BestandspositionHerkunftV1 }>
  | Readonly<{ outcome: "BESTANDSFRISCHHEIT_UNBEWEIST" }>
  | Readonly<{ outcome: "BESTANDSFRISCHHEIT_VERALTET"; alterSekunden: number; herkunft: BestandspositionHerkunftV1 }>
  | Readonly<{ outcome: "DENIED"; code: "FRISCHE_BEDEUTUNG_ZUKUNFT" | "FRISCHE_BEDEUTUNG_ZEITSTAMPEL_UNECHT"; detail: string }>;

/**
 * F5: evaluate the RETAINED origin bundle of one position against a closed
 * freshness policy. This is the explicit stale/unknown decision the review
 * required: a timeless position (herkunft null) is BESTANDSFRISCHHEIT_UNBEWEIST,
 * an over-age observation is BESTANDSFRISCHHEIT_VERALTET, a future observation
 * is DENIED (impossible), and only a proven-and-current position yields
 * BESTANDSFRISCHHEIT_BEWIESEN_AKTUELL with its closed age.
 */
export function bestandsfrischeBewertenV1(
  position: BestandspositionV1,
  politik: BestandsFrischePolitikV1,
): FrischeUrteilV1 {
  const herkunft = position.herkunft;
  if (herkunft === null) return { outcome: "BESTANDSFRISCHHEIT_UNBEWEIST" };
  const beobachtetMs = Date.parse(herkunft.beobachtetAm);
  const jetztMs = Date.parse(politik.entscheidungsZeitpunkt);
  if (!Number.isFinite(beobachtetMs) || !Number.isFinite(jetztMs)) {
    return { outcome: "DENIED", code: "FRISCHE_BEDEUTUNG_ZEITSTAMPEL_UNECHT", detail: "a closed ISO datetime parsed to a non-finite time; the freshness basis is not real." };
  }
  const alterSekunden = Math.round((jetztMs - beobachtetMs) / 1000);
  if (alterSekunden < 0) {
    return { outcome: "DENIED", code: "FRISCHE_BEDEUTUNG_ZUKUNFT", detail: `observation ${herkunft.beobachtetAm} is after the decision time ${politik.entscheidungsZeitpunkt}; a future observation is impossible.` };
  }
  if (alterSekunden > politik.maximalerAlterSekunden) {
    return { outcome: "BESTANDSFRISCHHEIT_VERALTET", alterSekunden, herkunft };
  }
  return { outcome: "BESTANDSFRISCHHEIT_BEWIESEN_AKTUELL", alterSekunden, herkunft };
}

export type FrischeDenialCodeV1 =
  | "FRISCHE_POLITIK_NOT_OBJECT"
  | "FRISCHE_POLITIK_ID_NOT_CLOSED"
  | "FRISCHE_POLITIK_VERSION_NOT_CLOSED"
  | "FRISCHE_POLITIK_ALTER_NOT_NONNEGATIVE"
  | "FRISCHE_POLITIK_ZEITPUNKT_NOT_CLOSED"
  | "FRISCHE_BEDEUTUNG_ZUKUNFT"
  | "FRISCHE_BEDEUTUNG_ZEITSTAMPEL_UNECHT";

export type NachschubFrischeEntscheidungV1 =
  | Readonly<{
      outcome: "NACHSCHUB_ERFORDERLICH";
      angeforderteMenge: number;
      verfuegbar: number;
      schwellenwert: number;
      position: BestandspositionV1;
      frische: FrischeUrteilV1;
      politikId: string;
      politikVersion: string;
    }>
  | Readonly<{
      outcome: "NACHSCHUB_NICHT_ERFORDERLICH";
      verfuegbar: number;
      schwellenwert: number;
      position: BestandspositionV1;
      frische: FrischeUrteilV1;
      politikId: string;
      politikVersion: string;
    }>
  | Readonly<{ outcome: "BESTANDSFRISCHHEIT_UNBEWEIST"; position: BestandspositionV1; detail: string }>
  | Readonly<{ outcome: "BESTANDSFRISCHHEIT_VERALTET"; position: BestandspositionV1; frische: FrischeUrteilV1; detail: string }>
  | Readonly<{ outcome: "DENIED"; code: NachschubDenialCodeV1 | FrischeDenialCodeV1; detail: string }>;

/**
 * F5: the Nachschub decision MADE UNDER a closed freshness policy. The
 * threshold comparison runs only on a proven-and-current position; a timeless
 * (UNBEWEIST) or over-age (VERALTET) position yields the explicit terminal —
 * no timeless stock can silently produce NACHSCHUB_NICHT_ERFORDERLICH. All
 * other denials mirror nachschubEntscheidenV1 (closed ids/units/amounts).
 */
export function nachschubEntscheidenFrischeV1(
  lage: BestandslageV1,
  anforderung: unknown,
  politik: unknown,
): NachschubFrischeEntscheidungV1 {
  if (!isRecord(anforderung)) return { outcome: "DENIED", code: "NACHSCHUB_NOT_OBJECT", detail: "Anforderung is not an object." };
  const { anforderungsId, artikelId, lagerortId, einheit, schwellenwert, nachschubmenge, grund } = anforderung;
  if (typeof anforderungsId !== "string" || !NACHSCHUBID_RE.test(anforderungsId)) {
    return { outcome: "DENIED", code: "NACHSCHUB_ID_NOT_CLOSED", detail: `anforderungsId ${String(anforderungsId)} is not a closed nachschub:* token.` };
  }
  if (typeof artikelId !== "string" || !ARTIKELID_RE.test(artikelId)) {
    return { outcome: "DENIED", code: "NACHSCHUB_TOKENS_NOT_CLOSED", detail: `artikelId ${String(artikelId)} is not a closed SYN-ART-* token.` };
  }
  if (typeof lagerortId !== "string" || !LAGERORT_RE.test(lagerortId)) {
    return { outcome: "DENIED", code: "NACHSCHUB_TOKENS_NOT_CLOSED", detail: `lagerortId ${String(lagerortId)} is not a closed LAGER-* token.` };
  }
  if (einheit !== BESTAND_UNIT_V1) {
    return { outcome: "DENIED", code: "NACHSCHUB_UNIT_NOT_STK", detail: `einheit ${String(einheit)} is not the closed unit STK.` };
  }
  if (typeof schwellenwert !== "number" || !Number.isSafeInteger(schwellenwert) || schwellenwert < 0) {
    return { outcome: "DENIED", code: "NACHSCHUB_SCHWELLE_NOT_NONNEGATIVE", detail: `schwellenwert ${String(schwellenwert)} is not a non-negative integer.` };
  }
  if (typeof nachschubmenge !== "number" || !Number.isSafeInteger(nachschubmenge) || nachschubmenge < 1) {
    return { outcome: "DENIED", code: "NACHSCHUB_MENGE_NOT_POSITIVE", detail: `nachschubmenge ${String(nachschubmenge)} is not a positive integer.` };
  }
  if (typeof grund !== "string" || grund.length === 0) {
    return { outcome: "DENIED", code: "NACHSCHUB_GRUND_EMPTY", detail: "grund must be a non-empty fachliche reason." };
  }
  // closed freshness policy
  if (!isRecord(politik)) return { outcome: "DENIED", code: "FRISCHE_POLITIK_NOT_OBJECT", detail: "the freshness policy is not an object." } as never;
  const { politikId, version, maximalerAlterSekunden, entscheidungsZeitpunkt } = politik;
  if (typeof politikId !== "string" || !F5_POLITIKID_RE.test(politikId)) {
    return { outcome: "DENIED", code: "FRISCHE_POLITIK_ID_NOT_CLOSED", detail: `politikId ${String(politikId)} is not a closed frische:* token.` } as never;
  }
  if (typeof version !== "string" || version.length === 0) {
    return { outcome: "DENIED", code: "FRISCHE_POLITIK_VERSION_NOT_CLOSED", detail: "the policy version must be a non-empty closed token." } as never;
  }
  if (typeof maximalerAlterSekunden !== "number" || !Number.isSafeInteger(maximalerAlterSekunden) || maximalerAlterSekunden < 0) {
    return { outcome: "DENIED", code: "FRISCHE_POLITIK_ALTER_NOT_NONNEGATIVE", detail: `maximalerAlterSekunden ${String(maximalerAlterSekunden)} is not a non-negative integer.` } as never;
  }
  if (typeof entscheidungsZeitpunkt !== "string" || !ISO_DATETIME_RE.test(entscheidungsZeitpunkt)) {
    return { outcome: "DENIED", code: "FRISCHE_POLITIK_ZEITPUNKT_NOT_CLOSED", detail: `entscheidungsZeitpunkt ${String(entscheidungsZeitpunkt)} is not a closed ISO datetime.` } as never;
  }
  const idx = positionIndexOf(lage, artikelId, lagerortId);
  if (idx < 0) {
    return { outcome: "DENIED", code: "NACHSCHUB_POSITION_UNKNOWN", detail: `position ${artikelId} @ ${lagerortId} is not in the Bestandslage.` };
  }
  const position = lage.positions[idx];
  if (position === undefined) {
    return { outcome: "DENIED", code: "NACHSCHUB_POSITION_UNKNOWN", detail: `position ${artikelId} @ ${lagerortId} is not in the Bestandslage.` };
  }
  const frische = bestandsfrischeBewertenV1(position, politik as unknown as BestandsFrischePolitikV1);
  if (frische.outcome === "DENIED") return frische;
  if (frische.outcome === "BESTANDSFRISCHHEIT_UNBEWEIST") {
    return { outcome: "BESTANDSFRISCHHEIT_UNBEWEIST", position, detail: "no retained origin bundle (herkunft) on the position; availability of the figure is unproven, so no threshold decision is taken." };
  }
  if (frische.outcome === "BESTANDSFRISCHHEIT_VERALTET") {
    return { outcome: "BESTANDSFRISCHHEIT_VERALTET", position, frische, detail: `the retained observation is ${frische.alterSekunden}s old, over the closed freshness horizon ${maximalerAlterSekunden}s; the figure is stale and no threshold decision is taken.` };
  }
  const verfuegbar = verfuegbarVonV1(position);
  if (verfuegbar < schwellenwert) {
    return { outcome: "NACHSCHUB_ERFORDERLICH", angeforderteMenge: nachschubmenge, verfuegbar, schwellenwert, position, frische, politikId, politikVersion: version };
  }
  return { outcome: "NACHSCHUB_NICHT_ERFORDERLICH", verfuegbar, schwellenwert, position, frische, politikId, politikVersion: version };
}

export type AdapterDenialCodeV1 =
  | "ADAPTER_NOT_OBJECT"
  | "ADAPTER_ID_NOT_CLOSED"
  | "ADAPTER_POSITIONEN_UNKONNUKT"
  | "ADAPTER_M1_LAGERORT_UNKNOWN"
  | "ADAPTER_M1_EINHEIT_MISMATCH"
  | "ADAPTER_EVIDENCE_NOT_CLOSED"
  | "ADAPTER_EVIDENCE_POSITION_UNKNOWN"
  | "ADAPTER_EVIDENCE_MENGE_NOT_POSITIVE"
  | "ADAPTER_EVIDENCE_ZEITSTAMPF_NOT_CLOSED"
  | "ADAPTER_BELEGIID_NOT_CLOSED"
  | "ADAPTER_QUELLE_NOT_CLOSED"
  | "ADAPTER_TARGET_NOT_CLOSED";

export interface WareneingangBestandsaenderungInputV1 {
  readonly adapter: ArtikelIdentitaetsAdapterV1;
  readonly m1Entwurf: BestellentwurfV1;
  readonly m1Ledger: WareneingangLedgerV1;
  readonly m1EingangsId: string;
  readonly m1Quelle: string;
  readonly m1Zeitstempel: string;
  readonly m3Ziel: Readonly<{ artikelId: string; lagerortId: string }>;
}

/**
 * F5: the SOURCE-BOUND M1 -> M3 receipt adapter. It maps the REAL received
 * quantity of a closed M1 Wareneingang (via the real `mengenzustandV1`) into a
 * closed M3 EINKUNFT change whose Beleg carries the M1 eingangsId + source +
 * time. The EINK-ART-* -> SYN-ART-* identity is taken ONLY from the explicit
 * closed adapter table (never inferred from shared spelling); the unit is
 * identity-only (STK, no conversion factor fabricated). The M1 menge must be a
 * positive integer, the M1 position must own the evidence, and the M3 target
 * must be a closed position identity. Nothing is inferred from a rollback or
 * from a stock balance.
 */
export function wareneingangZuBestandsaenderungV1(
  input: unknown,
): Readonly<{ outcome: "BELEGT"; aenderung: BestandAenderungV1 }>
  | Readonly<{ outcome: "DENIED"; code: AdapterDenialCodeV1; detail: string }> {
  if (!isRecord(input)) return { outcome: "DENIED", code: "ADAPTER_NOT_OBJECT", detail: "input is not an object." };
  const { adapter, m1Entwurf, m1Ledger, m1EingangsId, m1Quelle, m1Zeitstempel, m3Ziel } = input as Record<string, unknown>;
  if (!isRecord(adapter) || typeof adapter.adapterId !== "string" || adapter.adapterId.length < 3 || adapter.adapterId.length > 64 || !Array.isArray(adapter.mappingen)) {
    return { outcome: "DENIED", code: "ADAPTER_ID_NOT_CLOSED", detail: "adapter must carry a closed adapterId and a mappingen table." };
  }
  // closed M3 target
  if (!isRecord(m3Ziel) || typeof m3Ziel.artikelId !== "string" || !ARTIKELID_RE.test(m3Ziel.artikelId)
    || typeof m3Ziel.lagerortId !== "string" || !LAGERORT_RE.test(m3Ziel.lagerortId)) {
    return { outcome: "DENIED", code: "ADAPTER_TARGET_NOT_CLOSED", detail: "the M3 target (artikelId/lagerortId) is not a closed M3 position identity." };
  }
  // closed M1 evidence bundle
  if (!isRecord(m1Entwurf) || !isRecord(m1Ledger)) {
    return { outcome: "DENIED", code: "ADAPTER_POSITIONEN_UNKONNUKT", detail: "the M1 Bestellentwurf/Wareneingang ledger evidence is not closed objects." };
  }
  if (typeof m1EingangsId !== "string" || m1EingangsId.length < 3 || m1EingangsId.length > 64) {
    return { outcome: "DENIED", code: "ADAPTER_BELEGIID_NOT_CLOSED", detail: `the M1 eingangsId ${String(m1EingangsId)} is not a closed evidence token.` };
  }
  if (typeof m1Quelle !== "string" || !F5_TOKEN_RE.test(m1Quelle)) {
    return { outcome: "DENIED", code: "ADAPTER_QUELLE_NOT_CLOSED", detail: `the M1 source identity ${String(m1Quelle)} is not a closed token.` };
  }
  if (typeof m1Zeitstempel !== "string" || !ISO_DATETIME_RE.test(m1Zeitstempel)) {
    return { outcome: "DENIED", code: "ADAPTER_EVIDENCE_ZEITSTAMPF_NOT_CLOSED", detail: `the M1 evidence time ${String(m1Zeitstempel)} is not a closed ISO datetime.` };
  }
  // the M1 ledger must own the position; the evidence menge is the REAL
  // received (angenommene) quantity from the real M1 quantity state.
  const positionId = (m1Ledger as unknown as WareneingangLedgerV1).positionId;
  if (typeof positionId !== "string") {
    return { outcome: "DENIED", code: "ADAPTER_EVIDENCE_POSITION_UNKNOWN", detail: "the M1 ledger carries no closed positionId." };
  }
  const m1State = mengenzustandV1(m1Entwurf as unknown as BestellentwurfV1, m1Ledger as unknown as WareneingangLedgerV1);
  if (m1State.positionId !== positionId) {
    return { outcome: "DENIED", code: "ADAPTER_EVIDENCE_POSITION_UNKNOWN", detail: "the M1 quantity state does not bind to the ledger position." };
  }
  if (typeof m1State.angenommeneMenge !== "number" || !Number.isSafeInteger(m1State.angenommeneMenge) || m1State.angenommeneMenge < 1) {
    return { outcome: "DENIED", code: "ADAPTER_EVIDENCE_MENGE_NOT_POSITIVE", detail: `the M1 received quantity ${String(m1State.angenommeneMenge)} is not a positive integer; no EINKUNFT is synthesized from an unknown receipt.` };
  }
  // the EXPLICIT identity/unit adapter: the M1 position's closed artikel +
  // unit must map to the declared M3 target. Shared spelling alone proves no
  // relation — the mapping must exist in the closed table.
  const m1ArtikelId = (m1Entwurf as unknown as BestellentwurfV1).positionen.find((p) => p.positionId === positionId)?.artikelId ?? "";
  const m1Einheit = m1State.einheit;
  const mapping = (adapter.mappingen as readonly ArtikelIdentitaetsMappingV1[]).find(
    (m) => m.m1ArtikelId === m1ArtikelId && m.m3ArtikelId === m3Ziel.artikelId && m.m3LagerortId === m3Ziel.lagerortId && m.einheit === m1Einheit,
  );
  if (mapping === undefined) {
    return { outcome: "DENIED", code: "ADAPTER_M1_LAGERORT_UNKNOWN", detail: `the explicit adapter has no closed mapping from M1 article ${m1ArtikelId} / unit ${m1Einheit} to M3 ${m3Ziel.artikelId} @ ${m3Ziel.lagerortId}; an identity/unit relation is never inferred from shared spelling.` };
  }
  if (m1Einheit !== BESTAND_UNIT_V1) {
    return { outcome: "DENIED", code: "ADAPTER_M1_EINHEIT_MISMATCH", detail: `the M1 evidence unit ${m1Einheit} is not the closed M3 unit ${BESTAND_UNIT_V1}; no conversion factor is fabricated.` };
  }
  const aenderung: BestandAenderungV1 = {
    schemaVersion: BESTAND_CHANGE_SCHEMA_V1,
    aenderungsId: `aenderung:bestand-wareneingang-${m1EingangsId.replace(/[^a-z0-9-]/g, "").slice(0, 64)}`,
    artikelId: m3Ziel.artikelId,
    lagerortId: m3Ziel.lagerortId,
    einheit: BESTAND_UNIT_V1,
    art: "EINKUNFT",
    menge: m1State.angenommeneMenge,
    zeitstempel: m1Zeitstempel,
    beleg: { belegId: m1EingangsId, belegArt: "WARENEINGANG", quelle: m1Quelle, zeitstempel: m1Zeitstempel },
  };
  return { outcome: "BELEGT", aenderung };
}
