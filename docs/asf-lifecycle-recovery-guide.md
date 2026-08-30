# ASF lifecycle local recovery guide

This is a local, public-safe recovery draft for the ASF synthetic lifecycle. It is not a runbook for a live system and does not claim protected delivery, release, production rollout, or public readback.

## Guardrails

1. Use only `tests/fixtures/asf-public-readback/verified.json` or another fixture that passes the same closed validation.
2. Keep authority at `LOCAL_DETERMINISTIC_HARNESS_ONLY`.
3. Treat every receipt and digest as immutable. Do not replace a missing value with a latest value, an inferred value, or a value from another source.
4. Render only with `scripts/render-asf-public-readback.mjs --dry-run`.
5. If redaction, schema, digest, lineage, claim, or nonclaim validation fails, stop. Do not retry against a provider or service.

## Dry-run procedure

```text
npm run build --silent && node --test tests/asf-public-readback.test.mjs
node scripts/render-asf-public-readback.mjs --dry-run --fixture tests/fixtures/asf-public-readback/verified.json
```

The renderer performs no network request, no process handoff, no file write, no pointer change, and no external action. Its output is a stable JSON readback containing:

- a redacted synthetic demo;
- the exact stage and lifecycle receipt digests supplied by the checked-in fixture;
- an exact-LKG-or-deny recovery template;
- a planned-versus-implemented template; and
- the explicit no-release statement.

Run the renderer again if a byte comparison is needed. A different output for the same fixture is a deterministic harness failure, not a reason to broaden scope.

## Fail-closed decision table

| Observation | Local result | Do not infer |
| --- | --- | --- |
| Missing receipt or stage | Reject | recovery success or delivery |
| Receipt digest mismatch | Reject as tampered | corrected provenance or release |
| Lifecycle digest not in the checked-in synthetic set | Reject as unverified | an equivalent live result |
| Lineage digest does not match its stage | Reject | a valid readback |
| Raw identity, token, path, host, session, job, URL, link, or credential material | Reject before projection | safe redaction after publication |
| Security finding or exploit payload | Reject | a security disclosure or remediation |
| Unsupported claim | Reject | implementation, readiness, or compatibility |
| External-action option | Reject | authorization to act |

`tests/fixtures/asf-public-readback/leak.json` intentionally exercises unsafe input rejection. It is a negative probe only; it is not a report of a live security finding.

## Recovery model

If a real implementation later adopts this shape, its recovery decision must remain separate from this local draft:

- verify the exact affected target and immutable lock;
- require an independently verified exact last-known-good receipt;
- restore that exact lock or deny and disable the smallest affected scope;
- compare the post-recovery state and receipt digests exactly; and
- retain append-only evidence without claiming success when readback is absent.

None of those live actions are implemented or exercised by this slice. The current renderer only expresses the decision boundary as text.

## Planned versus implemented readback template

Implemented in this repository slice:

- deterministic canonical digest checking;
- checked-in synthetic lifecycle receipt binding;
- redaction-first validation;
- deterministic JSON projection; and
- explicit nonclaims.

Not implemented and not claimed:

- protected delivery;
- release or publication;
- production activation or rollout;
- live provider/service compatibility;
- credential, customer-data, or external-state access;
- external action or security disclosure; and
- a public readback event.

The only safe conclusion from a passing dry run is that the local synthetic draft is internally consistent. The required nonclaim remains:

> No protected delivery, release, or public readback occurred.

## Lineage record

The projection is bound to the existing synthetic harness and its checked-in success and denied-activation receipt fixtures. The source was read at parent `43fa52d64c15a30619386491181f6ca4a4079898` on `conveyor/pansphaira-35`, compared with `origin/main` `353017c4f60e30463d0a78fd6fd2509a37d37f76`, and projected only through the allowlisted files for this task. The individual receipt bindings and digest values are recorded in `docs/asf-lifecycle-synthetic-proof.md` and in the verified fixture.
