# PAN468 — targeted impact selection and bounded historical path-scan work

Bounded, repository-local correctness and work-bound slice for the released
module-contribution impact/compare tooling (CONTRIB-01, issue #468).

## Scope

`scripts/module-contribution.mjs` is the affected entry point (`impact`,
`compare`, `check`, `release`, `verify`, `test`, `scaffold`, `graph`). This
slice corrects two behaviors and bounds the work, without new CI, new
publishing authority, or replacing the canonical full-suite CI:

1. **Contract-consumer classification (CONTRIB-01-AC01).** A module is a
   *shared semantic contract* provider only when a declared **contract** path
   changed. Declared `profiles` are internal test fixtures, not shared
   contracts, so a profile change no longer selects direct consumers. A
   contract change pulls in its direct consumers; a contract-unchanged (internal
   source) change selects only the owner. The `impact` and `compare` entry
   points both classify contracts correctly.

2. **Bounded historical path enumeration (CONTRIB-01-AC02).** `snapshot().files`
   previously performed a `git show` content read per declared path during
   enumeration. `ls-tree --full-tree` already lists blob (regular-file) entries
   with their tree modes, so a path's regular-file safety is known without a
   content read. Enumeration now relies on tree modes; a content read occurs only
   when contents are genuinely required — the descriptor and any explicitly
   requested file. Symlink (120000) historical objects are excluded from
   enumeration and denied on read; traversal and unsafe paths fail closed.

3. **Work measurement (CONTRIB-01-AC03).** Each `impact`/`compare` operation
   reports `diagnostics` (`gitCommands`, `gitContentReads`) so command count and
   content-read work are comparable on the same fixed fixture. The full canonical
   CI (`npm test` / `module:check`) remains the authority; no unmeasured pipeline
   speedup is claimed.

## Non-claims

- No new Canon, no automatic compatibility approval, no replacement CI.
- No public writes; synthetic git fixtures only; no real external effects.
- Local candidate only; independent acceptance, integration, exact-head CI,
  release and public readback remain with the delivery owner.
