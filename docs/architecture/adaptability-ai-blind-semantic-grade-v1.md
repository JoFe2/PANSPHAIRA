# Bounded ADB semantic checker

## Scope and historical boundary

Original615 qualifies only `benchmarks/adaptability-m0/ai-blind/evaluate.mjs`.
It does not reopen the delivered CSCL11 mapping holdout from original487, use
its private cases, execute an AI participant, measure model quality or establish
universal business equivalence. The original participant bundle and historical
benchmark record retain `PREPARED_NOT_RUN` for real AI-blind execution.

Under supported Node24.14.1, complete pinned checkouts of historical
`81de8d2cacfd6b697ebe2295aec8142812397ae8` and current planning Main
`0ea2fec4f6459f3a56a132df644b10f99439b47d` executed the original public
positive fixture, a read-field mutant, a write-field mutant and both-field
mutant. All eight original CLI results were actually `PASS`. The raw checker,
participant input, generic consumer, Builder core and second-system fixture
bytes agree across these two checkouts. This observation is retained, not
rewritten as a historical FAIL or a reproduced model run. The field variants
were constructed from the pinned public fixture; byte equality to an
unavailable old research packet is not asserted.

## Independent public expected contract

`semantic-expectation-v1.json` is a versioned, checker-owned public reference,
not a candidate's asserted answer or hidden independent-person holdout. It
requires the synthetic `zone-12` in `synthetic-warehouse` / `unknown-lighting-002`:

- Read `illuminanceLux`, unit lux, value410 without a target effect.
- Temporarily write `brightnessPct`, unit percent, value65 from prior55.
- Observe the actual complete persisted target `{illuminanceLux:410,
  brightnessPct:65}` before rollback, then its exact restored prior state.
- Permit no other target-field, entity or tenant effect.

The exact reference JSON bytes are also embedded as `semanticExpectationJson`
in the existing participant-input member. The legacy1792 payload therefore
retains its exact member set and needs no additive source-only file at module
load. A regression compares the decoded embedded bytes to the source reference.
This is one public reference with two checked representations, not a new oracle
registry or permission. The participant bundle stays `PREPARED_NOT_RUN`.

Expected fields, units, values, write destination, payload meaning and allowed
effects are never copied from a candidate result or inferred from receipt
counts, caller hashes or matching final digests. Units here are the public
synthetic named-field contract, not physical sensor observations. Legacy
absence of an explicit unit means that named-field unit; explicit units must
be exact documented aliases. No conversion is silently inferred. Correct
payload-key aliases, entity-key aliases, request IDs, capability order and
`lx` / `pct` unit aliases remain acceptable when their observed meaning agrees.

## Actual observation, not a second runtime

The frozen Builder core and generic consumer remain unchanged. The checker
uses their existing memory-store and execution callbacks to retain actual
requests, native results or exceptions, before/after targets and persisted
transitions. Temporary write state is observed before the existing core rolls
it back; a final zero-drift state cannot conceal a wrong transient field or
extra effect. Replayed calls must retain the original receipts. Reset occurs
only after independently observing the expected restored state. An unresolved
synthetic effect is not reset away to manufacture a passing result.

The fixed local qualification scenarios are `DEFAULT`,
`EXTRA_PERSISTED_EFFECT`, `ROLLBACK_PERSISTENCE_FAILURE` and
`FOREIGN_REQUEST_TENANT`. Non-default cases introduce an actual wrong in-memory
persisted value, withheld rollback persistence or a denied native request.
They are explicitly synthetic fault qualification, not real provider responses,
host-crash durability, productive effects or options for replacing the executor
or expected contract. No scenario supplies arbitrary code, target data or oracle.

## Bound result kinds

The additive result schema is
`chimpmaera.adaptability-ai-blind-evaluation/v2`.
Existing `status`, `issues` and bounded lifecycle counts remain available.

- `NOT_RUN`: unavailable/malformed input, unsupported case/scenario or source
  prerequisites prevent a qualified execution. An unavailable candidate has a
  null raw digest, never an invented digest.
- `CONTROLLED_REJECTION`: admission or actual native request denial; not a
  completed business success.
- `SEMANTIC_CONTRADICTION`: actual observations disagree with the public
  expected fields, units, values or allowed effects.
- `MANUAL_REPAIR_REQUIRED`: an actual unresolved synthetic target remains;
  reset is deliberately not attempted. The observed target drift is reported
  separately from the unchanged core-reported drift, which alone may miss a
  withheld store persistence.
- `SEMANTIC_SUCCESS`: both actual operations, temporary effect, allowed side
  effects, rollback, receipt reuse and cleanup meet this bounded reference.

Every result binds its literal case/scenario, exact raw candidate bytes when
available, checker, expected-contract, participant-input, frozen core and
consumer digests, actual runtime and observed evidence digest. These bindings
provide provenance, not independent authority or proof that every mapping is
correct. No model calls, network service or physical effects are used.

## Reproduce

Use the complete released source checkout and supported Node24.14.1, with the
existing locked dependencies installed for the retained benchmark tests:

```sh
node benchmarks/adaptability-m0/ai-blind/evaluate.mjs \
  demo/builder-agent/runtime-contract-second-system-v1.json
node --test tests/adaptability-benchmark-m0.test.mjs \
  tests/adaptability-ai-blind-semantic-grade.test.mjs
```

The existing repository-integrity owner keeps its max64 command bound. Its
source-integrity command retains all prior supply-chain cases and additionally
executes the original ADB benchmark and semantic checks; no old case or hard gate
is removed and no sixty-fifth command, new owner or runner is added.

Regression fixtures require the invocation's owned `TMPDIR` or `RUNNER_TEMP`;
they do not select a global system scratch directory. Source, local synthetic
checker qualification, actual model/AI-blind results, mandatory CI, release and
anonymous released-product execution remain separate. This source-only checker
is not a prebuilt installer, a broad research platform or new runtime authority.
