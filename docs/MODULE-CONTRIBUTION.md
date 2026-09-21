# Scoped module contribution automation

Run from the repository root with Node 24. No additional dependencies are needed for the CLI.

```sh
node --test tests/module-contribution.test.mjs
node scripts/module-contribution.mjs check
node scripts/module-contribution.mjs graph
node scripts/module-contribution.mjs graph --format mermaid
node scripts/module-contribution.mjs compare --before releases/before.json --after releases/after.json
node scripts/module-contribution.mjs impact --base HEAD
npm run module:test -- --base HEAD
node scripts/module-contribution.mjs release > module-release.json
node scripts/module-contribution.mjs verify --manifest module-release.json
node scripts/module-contribution.mjs scaffold my-module
node --test examples/module-contribution/my-module/test.mjs
node scripts/module-contribution.mjs check --descriptor examples/module-contribution/my-module/modules.json
```

The integrated contributor entrypoint is `npm run module:check` (focused automation tests plus descriptor validation). `check` itself does **not** execute product tests. All successful commands emit deterministic JSON on stdout except `graph --format mermaid`, which emits plain Mermaid text; errors go to stderr and exit nonzero. `scaffold` prints a `next` command. No command executes descriptor-supplied commands. Review code before running any tests.

## What is described

The default descriptor is `examples/module-contribution/modules.json`. Every command accepts `--descriptor <repo-relative-file>` to select another catalog. Paths inside descriptors are always relative to the repository root, not the descriptor directory.

```json
{
  "schemaVersion": 1,
  "modules": [{
    "id": "example",
    "version": "1",
    "sources": ["src/example"],
    "contracts": ["contracts/example"],
    "profiles": [],
    "tests": ["tests/example.test.mjs"],
    "dependencies": {}
  }]
}
```

Declare semantic ownership, contract/profile boundaries, focused test files, and exact semantic dependency versions. These are facts that directory names and imports cannot reliably infer. Directories recursively include their regular files; lists are deduplicated and sorted. Sources and tests must be nonempty. Tests may require a separate trusted build step; the planner never builds or executes them. Dependency versions are exact opaque semantic labels, **not** an npm version solver. A dependency must refer to an existing module at the declared version. Scaffold produces a runnable greeting **template**, not an implemented business capability, and does not silently register it in the pilot catalog. Merge its semantic entry into the intended catalog when ready.

`graph` additionally reads root `package.json` workspaces (literal directories or `parent/*`) and declared local dependencies/devDependencies/peerDependencies/optionalDependencies. These npm edges preserve declared ranges; no range resolution, import analysis, semantic-test mapping, or external package inventory is claimed. Unsupported workspace patterns fail rather than silently inventing coverage. This repository currently has no root npm workspaces, which is reported explicitly.

## Optional growth relations

Descriptor schema 1 remains supported unchanged. A module may add either or both
of these fields (illustrative declarations, not requests registered by this pilot):

```json
{
  "extensionRequests": [{
    "reference": "proposal:profile-export",
    "requirement": "optional",
    "capability": "Export a profile for offline review"
  }],
  "variant": {
    "name": "compact",
    "base": { "id": "example", "version": "1" }
  }
}
```

An extension request has exactly `reference`, `requirement` (`required` or
`optional`), and `capability` intent. Text must be nonblank and contain no control
characters. The reference is opaque text: no URL is fetched, no issue is required,
and it need not name an existing module. Even a **required request is not a
resolved runtime dependency**, acceptance gate, implementation, or test result.
An absent or empty request list adds no requirement to routine fixes.

A variant has exactly `name` and an explicit `base` identity (`id`, exact `version`).
The base must be another declared module at that version for `check`/`release`.
This names a relationship, not inheritance, substitutability, or compatibility.
Use `dependencies` separately if there is a real semantic dependency. Neither
relation introduces test fanout; only existing semantic dependency edges do.
Editing relation metadata is still a descriptor change of its owner, using the
existing conservative impact rule. No recursive variant ancestry is evaluated.

JSON `graph` exposes these separately as `relations`, leaving dependency `edges`
unchanged. `graph --format mermaid` exports only the semantic view (not npm):
solid arrows are dependencies; dotted arrows are variants or extension requests.
Identifiers are generated, labels escape punctuation, and references are inert
text, never Mermaid links, directives, or raw HTML. Output is deterministic for
identical inputs; render it with your existing Mermaid viewer. Rendering is not a
new CLI dependency or a compatibility check.

## Advisory change impact

`impact --base <commit-or-ref>` compares the resolved base commit to the current working tree, including staged, unstaged, and nonignored untracked paths. It reads the base descriptor and file inventory directly from Git. Renames are treated as deletion plus addition, so old ownership is retained. Deleting files, modules, or the whole descriptor cannot silently erase old ownership.

* Internal/source/test change: own module's tests.
* Contract/profile change: own tests plus **direct** consumers' tests.
* Semantic descriptor change/removal: conservative contract change for that module.
* No recursive/transitive test fanout.

Output includes `affected`, candidate `tests`, `missingTests`, and `unmapped`. It is advisory, not evidence that tests ran or that unmapped changes are safe. Broken references during a removal are tolerated by the impact planner so it can show affected consumers; `check` and `release` still reject them. A base predating the catalog conservatively treats current modules as new. The npm graph is informational and does not select tests.

`npm run module:test -- --base <base>` explicitly executes the selected JavaScript
tests with Node, without a shell or descriptor-supplied commands. Review test code
first; this is ordinary code execution, not a sandbox. Missing test files, unsupported
non-JavaScript tests, failures and a two-minute timeout fail the command. No selected
tests reports `executed: false`, not an implied pass. Native test output goes to stderr
and the scoped result to stdout. Build prerequisites and unmapped changes still need
their existing checks. CI keeps its canonical suite instead of duplicating selected
tests or weakening coverage. Generated CI views are run artifacts; the versioned
source and descriptor let maintainers regenerate them for an historical checkout.

## Actual scoped pilot

The catalog covers only the existing CSCL-01 protocol and CSCL-02 Odoo profile. CSCL-02 tests validate emitted profiles against CSCL-01 source-fact, evidence-cell, and system-profile schemas, establishing the explicit direct semantic dependency. The sources, contracts, profile fixtures, and tests are real existing repository files, not generated business implementations.

Run their focused tests explicitly:

```sh
node --test tests/cscl-01/protocol.test.mjs tests/cscl-02/odoo-profile.test.mjs
```

These tests need the repository's installed dependencies. The catalog does not claim to cover every consumer of CSCL schemas or every module in this repository; this is a bounded pilot, not a replacement for existing CI/full tests.

## Release integrity boundary

`release` binds the actual working-tree bytes of the descriptor and all declared sources, contracts, profiles, and tests, alongside exact module dependency/version facts and current Git HEAD. SHA-256 digests use recursively key-sorted compact JSON, preserving array order; the manifest `sha256` hashes the payload without that field. There are no timestamps or absolute machine paths. Redirect output outside declared directories to avoid making the manifest include itself.

`verify` rebuilds the complete expected inventory from the current descriptor and compares it with the supplied manifest. It rejects modified/missing bytes, changed inventory, missing semantic dependencies, mismatched semantic versions, and a different HEAD. Verification requires the same Git checkout HEAD and descriptor, not merely a copied standalone bundle. It does not validate external npm dependency installations.

`release` now emits release schema **2** (the descriptor stays schema 1). It binds
the exact UTF-8 descriptor text as `descriptorContent`, expanded module ownership
and optional relations, plus the existing file digests, dependency facts and HEAD.
This extra snapshot data is necessary for historical comparison without guessing
ownership from today's checkout. `verify` expects this current release format.
Old schema-1 release manifests lack ownership snapshots and are deliberately
rejected by `compare`; regenerate from the intended historical checkout with this
CLI, rather than relabeling a version-1 manifest.

### Compare two saved releases

```sh
node scripts/module-contribution.mjs compare --before releases/before.json --after releases/after.json
```

Both input paths are repository-relative. Comparison reads only those manifests;
it does not read current module sources, resolve Git refs, run tests, fetch request
references, or inspect external packages. `--descriptor` does not replace the
embedded descriptor used by comparison. Save releases outside declared source
and test directories. Each snapshot's version, payload SHA-256, descriptor digest,
file path/digest shapes, duplicate paths, exact inventory and expanded module facts
are checked against its embedded descriptor. Rehashed but inconsistent ownership
or omitted inventory entries fail; identical snapshots return empty change lists.

The advisory JSON reports `changed` file paths, `changedModules`, `affected`, and
candidate `tests` from both snapshots, plus the two manifest digests. Source/test
changes affect their owner; contract/profile changes and module declaration
changes/removals also affect direct semantic consumers from either snapshot.
Deleted test paths remain candidates; existence in today's checkout is not checked.
There is no transitive fanout and no test-success field.

**Consistency is not authentication.** A fully self-consistent attacker rewrite
(including descriptor, inventories and hashes) cannot be distinguished from an
honest snapshot by this command. It checks digest syntax and internal bindings,
not historical source bytes, provenance, signatures, or whether a directory's
inventory was honestly complete. Use trusted stored manifests and the existing
release governance; `verify` remains the separate current-checkout bytes check.

The source commit labels the checkout; **dirty working-tree bytes need not be bytes from that commit**. File hashes are the exact snapshot binding. A matching or rehashed manifest is integrity evidence, **not** trusted attestation, signature, authorship, test-success evidence, compatibility proof, or semantic proof. This does not replace existing release governance or integrity artifacts.

Paths must be normalized repository-relative paths without traversal, absolute paths, backslashes, or NUL. Existing symlink components are rejected, including scaffold ancestors; scaffold never overwrites an existing directory. No descriptor shell commands run. Use a quiescent checkout: filesystem checks are not an OS sandbox against concurrent hostile filesystem replacement. The tool creates no commits, tags, releases, network requests, or privileged publishing actions.
