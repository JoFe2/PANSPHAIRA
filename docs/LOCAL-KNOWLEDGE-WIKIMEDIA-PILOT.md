# Wikimedia pilot evidence harness

This harness is the offline preflight and evidence boundary for the Wikimedia pilot. It preserves the existing closed mini-dump importer and read-only query path. It does not download, write, activate, or query a network service.

## Operating boundary

`WIKIMEDIA_PILOT_BOUNDARY_V1` is:

`OFFLINE_OPERATOR_MOUNTED_IMMUTABLE_SNAPSHOT_ONLY_NO_NETWORK_NO_UNMOUNTED_CLAIMS`

The repository fixture is synthetic. The `official` object in the fixture is complete metadata shape only; it is not official content and it is not a measurement. An operator must provide the bounded official snapshot later, mounted read-only, with the exact source URL, SHA-256, byte size, ISO snapshot date, license, attribution, and matching importer profile.

## Preflight

After the TypeScript build, run:

```text
node scripts/verify-wikimedia-pilot.mjs \
  --fixture tests/fixtures/wikimedia-pilot/expected-measurement-schema.json \
  --offline-dry-run
```

Preflight validates the complete manifest shape and immutable URL binding. Its output has `measurementStatus: "NOT_MEASURED"` and an empty `claims` array. It intentionally emits no storage, import-time, or query-latency number. The supplied official `byteSize` is source metadata, not a measured storage claim.

The manifest rejects closed-world violations including missing official URL, checksum, size, snapshot date, license, or attribution; unsupported projects; non-immutable URLs; invalid dates/digests; and malformed synthetic profiles.

## Synthetic evidence

`runSyntheticWikimediaPilotEvidenceV1` imports the repository's six-page mini dump twice from the same bytes, verifies the expected content and edition digests, and runs a local read-only query. The report contains:

- equal first and re-import canonical edition digests;
- a complete receipt sample;
- raw machine-readable `elapsedMs`, `bytes`, and `queryLatencyMs` fields;
- one environment identifier for every raw sample;
- no pilot claims (`claims: []`) because the snapshot is synthetic and not operator-mounted official evidence.

Every receipt result is required to carry the exact passage, project, page ID, revision ID, canonical URL, snapshot date, license, content digest, and edition digest. The underlying receipt validator additionally checks citation and digest integrity.

## Mounted pilot evidence

The later mounted path is `runMountedWikimediaPilotEvidenceV1`. It requires:

1. a manifest that passes preflight;
2. a non-symbolic mounted directory and non-symbolic source file;
3. an importer profile that exactly matches the official metadata;
4. matching source checksum and byte size;
5. two successful imports with equal immutable edition digests;
6. a complete read-only receipt sample; and
7. one measurement environment for all raw samples.

Only this path produces measured `claims` for storage bytes, import elapsed time, and query latency. Claims are derived from raw evidence in the same report. A report with mixed environments, missing raw evidence, incomplete receipts, changed bytes, or a claimed metric without evidence is rejected.

The harness never turns a synthetic result into an official pilot claim and never makes a performance, storage, or import-time assertion from preflight metadata.

## Fixture and schema

`tests/fixtures/wikimedia-pilot/expected-measurement-schema.json` is a complete, offline-safe manifest fixture. Its synthetic profile points to the existing immutable mini-dump fixture. Its official section is deliberately bounded metadata for shape validation and must not be treated as a downloaded snapshot.

The implementation is in:

`packages/local-knowledge/src/wikimedia-pilot-evidence.ts`

The focused tests cover successful preflight, deterministic double import, receipt sampling, machine-readable raw measurements, and fail-closed missing metadata, checksum, URL, project, mount, receipt, environment, and raw-evidence cases.
