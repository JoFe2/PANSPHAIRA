# Scoped module contribution automation

Run from the repository root with Node 24. No additional dependencies are needed for the CLI.

```sh
node --test tests/module-contribution.test.mjs
node scripts/module-contribution.mjs check
node scripts/module-contribution.mjs graph
node scripts/module-contribution.mjs impact --base HEAD
npm run module:test -- --base HEAD
node scripts/module-contribution.mjs release > module-release.json
node scripts/module-contribution.mjs verify --manifest module-release.json
node scripts/module-contribution.mjs scaffold my-module
node --test examples/module-contribution/my-module/test.mjs
node scripts/module-contribution.mjs check --descriptor examples/module-contribution/my-module/modules.json
```

The integrated contributor entrypoint is `npm run module:check` (focused automation tests plus descriptor validation). `check` itself does **not** execute product tests. All successful commands emit deterministic JSON on stdout; errors go to stderr and exit nonzero. `scaffold` prints a `next` command. No command executes descriptor-supplied commands. Review code before running any tests.

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

The source commit labels the checkout; **dirty working-tree bytes need not be bytes from that commit**. File hashes are the exact snapshot binding. A matching or rehashed manifest is integrity evidence, **not** trusted attestation, signature, authorship, test-success evidence, compatibility proof, or semantic proof. This does not replace existing release governance or integrity artifacts.

Paths must be normalized repository-relative paths without traversal, absolute paths, backslashes, or NUL. Existing symlink components are rejected, including scaffold ancestors; scaffold never overwrites an existing directory. No descriptor shell commands run. Use a quiescent checkout: filesystem checks are not an OS sandbox against concurrent hostile filesystem replacement. The tool creates no commits, tags, releases, network requests, or privileged publishing actions.
