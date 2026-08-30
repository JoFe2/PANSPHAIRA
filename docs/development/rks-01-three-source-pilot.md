# RKS-01 three-source equal-source pilot

This Run-3 artifact builds the bounded comparison corpora for PANSPHAIRA #311. It runs offline over the decoded and SHA-256-verified Run-2 Base64 snapshots. It performs no retrieval, model execution, task scoring, promotion, or production activation.

## Frozen boundary

- Admission source-set digest: `6b13a1e1a23c0a94b1a259c44ceb9a0cf8713766f5632a1a0381e7134799601d`.
- Comparison source-set digest: `9db857ec6c970138aa6db689e3e575a3788c9926ed3a1dbe6c96175b069dc542`.
- Comparison sources: 20 Wikidata entity revisions, 20 CPython v3.14.7 documents at commit `823f0323ee6ec1402088b73bce1a38473cac36dc`, and one OpenAPI 3.2.0 document at commit `99710bcb26cbe4be646565eebeb04348f02374b5`.
- The three license/notice artifacts remain bound in admission provenance but are not task content.
- The three RFC 9987 artifacts are excluded from Raw, typed, and guide comparison content. They remain an `UNMODIFIED_ONLY` admission control.

## Projections

`raw-rag-corpus-v1.json` contains bounded verbatim UTF-8 slices. Every chunk binds the Run-2 source key and raw SHA-256 plus exact byte offsets; textual sources also carry line, path, and section selectors. Wikidata uses a string/escape-aware balanced scanner over the admitted minified JSON and never uses parse/serialize output as Raw evidence. Literal Unicode escapes therefore remain byte-exact.

`typed-knowledge-corpus-v1.json` cites those Raw evidence IDs. Wikidata is limited to the frozen property whitelist and retains each separate statement's rank, datatype, mainsnak, qualifiers, references, and deprecated-state treatment. Labels and descriptions grant display/discovery value only. CPython objects retain version, commit, path, section, directive anchors, exceptions, and descriptive-only/no-execution example policy. OpenAPI objects cover only the 20 frozen object sections and retain exact excerpts, normative keywords, and field-constraint lines.

`application-guides-v1.json` contains non-answer usage checks. Each source-level guide binds all of its object and evidence IDs and states applicability checks, counterexample/exception handling, verification, and abstention. Guides grant no truth, Capability, or Authority.

`rfc9987-narrowing-control-v1.json` retains exact identity metadata and a byte-selected verbatim excerpt. Rewritten or normalized prose, silent errata incorporation, and comparison-corpus Knowledge Objects are denied.

## Determinism and denial coverage

Run:

```sh
node scripts/build-rks-01-pilot-corpora.mjs
node --test tests/rks-01/source-governance.test.mjs tests/rks-01/deterministic-ingestion.test.mjs tests/rks-01/three-source-pilot.test.mjs
```

The builder validates every Raw excerpt against the decoded admitted payload before writing canonical single-line JSON. A second build to `--output-root <empty-directory>` must produce byte-identical files.

Negative tests deny source-set/hash mismatch, invented or changed excerpts and claims, semantic reserialization presented as Raw evidence, omitted Wikidata qualifier/reference fields, omitted versions/exceptions, unsafe execution and authority/promotion fields, RFC derivative inclusion, extra or unselected sources, path/source substitution, and paired re-digestion.

## Non-claims

- No model was run and no task outcome was scored.
- Admission or typed projection does not grant truth, Capability, or Authority.
- RFC 9987 is not part of the comparative Raw/typed/application-guide corpus.
- This receipt is not a production, promotion, release, or legal-advice claim.
