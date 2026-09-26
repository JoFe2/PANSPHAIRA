# PAN461 — read-only installation lifecycle inventory

Status: `LOCAL_SYNTHETIC_LIFECYCLE_INVENTORY_IMPLEMENTED`

This is the bounded first slice of PAN461 (parent epic #458): a **read-only**
inventory for **one declared local Linux installation**. It distinguishes
declared release metadata from observed image, schema, configuration, content
and process generations, identifies every owned persistent store / required
configuration / key reference **without exporting secret values**, and binds
installation identity, source/target artifacts and observation validity.

It is a local synthetic inventory over the **released** doctor/observer
contracts, **not** production readiness, **not** a support commitment, and
**not** a productive host-discovery / replacement platform.

## Reused actual modules (released, read-only)

| Foundation | PAN461 use | Classification |
| --- | --- | --- |
| `packages/contracts/src/update-doctor.ts` `adaptComposeDoctorObservationV1` | The narrow read-only observer adapter that produces the installation probe (running/stopped/sleeping/modification facets) and per-axis MATCHED/MISMATCH/UNAVAILABLE | REUSE |
| `packages/contracts/src/update-doctor.ts` `updateDoctorContractDigest` | Independent canonical digest of the declared release content → the installation identity's `lockDigest` | REUSE |
| `packages/contracts/src/update-doctor.ts` `runFixtureDoctorV1` / `verifyUpdateDoctorContractBundleV1` | Released doctor-contract verification reused to confirm the observation bundle is well-formed | REUSE |
| released `canonicalJson` | Canonical serialization + sha256 for every binding and generation axis | REUSE |

No second doctor, installer, runtime, provider or write mechanism is introduced.
The inventory is a thin, read-only composition over the released observer.

## Distinguishing declared vs observed (AC01)

Every generation axis (image, schema, configuration, content, process) carries a
closed `{ declared, observed, validity }` triple:

- `declared` — the value recorded in the declared release metadata (`source: DECLARED`).
- `observed` — the value produced by the released observer on the labelled
  synthetic snapshot (`source: OBSERVED`).
- `validity` — `MATCHED` (canonical equality), `DRIFTED` (a real drift fact),
  or `UNAVAILABLE` (the probe could not be read). No process generation is
  declared: the observed synthetic service-state fingerprint stays UNAVAILABLE
  for comparison, never self-compared as a declared version.

Lifecycle states are recorded from the decisive probe, and an **unavailable
decisive probe remains `UNKNOWN`, never an inferred version**:

- `RUNNING` — the installation process is observed running.
- `STOPPED` — the installation process is observed stopped.
- `PARTIALLY_INSTALLED` — a decisive required probe is unavailable (never
  guessed).
- `LOCALLY_MODIFIED` — an observed axis disagrees with the declared release.
- `SLEEPING` — the installation process is observed in the sleeping state.
- `UNKNOWN` — the decisive probe is unavailable and the state cannot be derived.

No generation value is ever inferred from a missing probe.

## Owned state without secret values (AC02)

- **Persistent stores** — every owned persistent store is listed with its kind,
  path, observed digest and a **closed** secret reference. A secret VALUE is
  never exported; only a closed reference (path + the `REDACTED` marker) appears
  and `secretExported` is always `false`.
- **Required configuration** and **key references** — each is listed with its
  role, path, required flag and closed secret reference. A required config or
  key that the observation could not confirm is **listed explicitly as
  uncovered state** (never dropped, never guessed).
- The observed snapshot is a **closed shape**: non-reference fields are rejected
  at the parse boundary before any secret value could be surfaced.

## Installation identity, artifacts and observation validity (AC03)

- **Installation identity** — the declared release content is re-digested by the
  released `updateDoctorContractDigest` (independent of any caller-supplied
  digest). A caller-rehashed `lockDigest` that does not match the content is
  **not** an accepted identity (`DECLARED_RELEASE_MALFORMED`).
- **Source/target artifacts** — every artifact is classified by role. A
  source-only `SOURCE_ARCHIVE` is **never** presented as an installable target;
  only an artifact whose observed image digest equals its source digest and
  whose role permits installation is `installable`. Carrying only a source-only
  archive yields `installableTargets: []`.
- **Observation validity** — the whole inventory is bound to a canonical
  `bindingDigest` (sha256 of the canonical binding). `rebindPan461Inventory`
  re-executes the released observer against the **retained** identity
  (declared release, observed bytes, their sha256, stores, keys, artifacts,
  decision time) carried **outside the substituted payload**; a resealed
  substituted snapshot or a wrong retained sha is refused.

Consequences (all covered by focused negatives with exact denial codes):

- A resealed substituted observed snapshot carried against an old binding is
  `DENIED / SERIALIZED_BINDING_MISMATCH`.
- A wrong retained `observedSha256` for the carried bytes is
  `DENIED / OBSERVED_BYTES_MISMATCH`.
- A missing rebind observed snapshot is `DENIED / REBIND_INPUT_REQUIRED`.
- A caller-rehashed declared `lockDigest` is `DENIED / DECLARED_RELEASE_MALFORMED`.

## Authority and serialization boundary

`rebindPan461Inventory` accepts **no caller-owned observation results at all**.
It re-executes the released observer against the independently retained
identity, and the freshly derived binding must match the carried
`binding` / `bindingDigest` exactly. A successful `REBOUND` is observation
consistency, **never** production or publication approval.

## Public entry points

- `createPan461LifecycleInventory({ declaredRelease, observed, persistentStores,
  keyRefs, artifacts, now })` — owns the actual observer execution.
- `rebindPan461Inventory({ declaredRelease, observed, observedSha256,
  persistentStores, keyRefs, artifacts, now, binding, bindingDigest })` —
  re-binds a serialized inventory against the retained identity.

## Boundary and nonclaims

- Read-only; no network, provider, runtime, model, write, approval, mutation,
  installation, update, migration, publication or public-write authority.
- No productive host discovery or replacement platform is built or claimed.
- One declared local Linux installation, synthetic fixtures only. No production
  or customer data, no credentials in output, no real external business effects.
- Synthetic evidence cannot satisfy human-only or real-environment evidence;
  those remain separately held.
- Independent review and public delivery remain owned by
  Hermes/Supervisor e2e345eb187a.

Focused proof: `node --test tests/pan461/lifecycle-inventory.test.mjs`.
Canonical command: `npm test`.
