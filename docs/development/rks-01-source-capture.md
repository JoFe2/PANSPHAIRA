# RKS-01 official source capture (Run 2)

This run captures the frozen PANSPHAIRA #311 selector set as exact public official-source bytes and verifies it offline. It does **not** execute a model, build the final Run-3 Raw/typed corpora, promote truth, or grant Capability/Authority.

## Capture boundary

The immutable capture contains 47 files (11,581,509 bytes, below the 20 MiB limit):

- 20 Wikidata EntityData JSON responses. The capture first resolves each current `lastrevid`, then sequentially refetches `Special:EntityData/{QID}.json?revision={lastrevid}`. The exact JSON is retained; canonical parsing preserves every statement and normalizes only absent `qualifiers`/`references` members to empty containers. Truthy RDF is never used.
- 20 CPython RST files from tag `v3.14.7`, commit `823f0323ee6ec1402088b73bce1a38473cac36dc`, plus exact `LICENSE` and `Doc/license.rst` obligation bytes.
- OpenAPI `versions/3.2.0.md` and `LICENSE` from version `3.2.0`, commit `99710bcb26cbe4be646565eebeb04348f02374b5`.
- RFC 9987 definitive RFCXML, metadata, and errata responses as identity-byte, `UNMODIFIED_ONLY` controls.

The pinned OpenAPI repository has no `NOTICE` file (the official pinned raw URL returns 404). No NOTICE bytes are invented. The manifest instead records Apache-2.0's `RETAIN_NOTICE_IF_PRESENT` obligation alongside `RETAIN_LICENSE` and `MARK_CHANGES`.

Each manifest entry binds the canonical URL, pinned request URL, immutable revision/tag/commit, retrieval timestamp, media type, raw byte length, raw SHA-256, safe encoded artifact path, license/notice/obligations, transformation class, parser version, and canonicalizer version. Exact payloads are stored as deterministic RFC 4648 base64 (`storageEncoding: BASE64`) with 76-character LF-terminated lines. This transport prevents legitimate source conflict markers and trailing whitespace from becoming Git patch hazards; it does not normalize or change any admitted raw byte. The top-level digest seals the manifest. The decoded exact snapshots are the authority; no moving URL alone is an identity.

## Commands and network policy

Capture is an explicit, one-time network operation:

```sh
node scripts/capture-rks-01-sources.mjs --network
```

It uses a meaningful User-Agent, sequential requests, bounded retries with exponential backoff/`Retry-After` handling, and a hard 20 MiB aggregate limit. It refuses to overwrite an existing manifest or snapshot (`wx`). If an interrupted first capture leaves an incomplete snapshot directory before the manifest is written, inspect and remove only that incomplete owned directory before restarting.

Normal operation is offline and never refetches:

```sh
node scripts/capture-rks-01-sources.mjs
# equivalent explicit spelling
node scripts/capture-rks-01-sources.mjs --verify-offline
```

Offline verification reads each canonical `.b64` artifact, rejects unsafe paths, symlinks, duplicate artifact paths, and noncanonical base64, decodes before checking the exact raw length and SHA-256, enforces the frozen selector set and immutable identities, then parses the decoded raw bytes deterministically and writes `verification/rks-01-source-capture-receipt-v1.json`. The 20 MiB limit applies to decoded raw bytes, and the receipt itself declares `networkRequests: 0`.

Focused verification:

```sh
node --test tests/rks-01/source-governance.test.mjs tests/rks-01/deterministic-ingestion.test.mjs
node scripts/capture-rks-01-sources.mjs --verify-offline
```

Running offline verification twice must produce byte-identical receipt bytes and equal capture, source-set, canonical-record, and equal-source corpus-input digests.

## Deterministic projections and drift

`deterministic-ingestion.mjs` verifies and parses the immutable capture. `corpus-builder.mjs` creates only equal-source **precursor envelopes**: Raw and typed sides bind the same `sourceSetDigest` and same canonical record identities. It deliberately sets `finalCorpusBuilt: false`; Run 3 owns final corpora and typed knowledge/application-guide projection.

Changed source bytes, immutable revision, parser, or license decision produce a different proposed capture digest and `REVALIDATION_REQUIRED`. The prior capture remains byte-identical and is never overwritten. Verification fails closed for moving-only identity, source mismatch, missing obligations, unsafe path/symlink, unknown/extra/duplicate source, aggregate size overflow, parser/canonicalizer drift, fully re-digested identity substitution, and source-history mutation. RFC transformed or normalized derivative prose is denied.

## Nonclaims

- `NO_MODEL_EXECUTION`
- `NO_FINAL_RAW_OR_TYPED_CORPUS`
- `NO_TRUTH_CAPABILITY_OR_AUTHORITY_GRANT`
- Engineering source/license handling is not legal advice.
- Capture does not establish source correctness, completeness, freshness, comparative utility, model quality, promotion, or production activation.
