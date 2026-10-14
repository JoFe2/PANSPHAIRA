import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

// Recorded installer interaction only. Docker/build and external bootstrap calls
// are explicit stand-ins; this fixture cannot prove any native service readiness.
function installerInteractionFixture() {
  const scratch = process.env.TMPDIR ?? process.env.RUNNER_TEMP;
  assert.ok(scratch, "The entry probe requires invocation-owned scratch, not system temp.");
  const root = mkdtempSync(join(resolve(scratch), "pan573-entry-"));
  chmodSync(root, 0o700);
  for (const dir of ["bin", "demo/lib", "packages"]) mkdirSync(join(root, dir), { recursive: true, mode: 0o700 });
  for (const path of [
    "package.json", "package-lock.json", "examples/poc-release/showcase-v1.json",
    "demo/install.sh", "demo/compose.yaml", "demo/lib/journal.sh", "demo/chimpmaera.Dockerfile",
    "demo/tsconfig.runtime.json", "demo/runtime/server.mjs", "demo/runtime/enforcement-gate.mjs",
    "demo/runtime/admin-ai-poc.mjs", "demo/runtime/admin-ai-policy.mjs",
    "demo/runtime/authoritative-approval-snapshot.mjs", "demo/runtime/policy-evaluator.mjs",
    "demo/runtime/paperless-ngx-zoo-adapter.mjs", "demo/runtime/approval-workbench.mjs",
  ]) {
    mkdirSync(dirname(join(root, path)), { recursive: true, mode: 0o700 });
    copyFileSync(path, join(root, path));
  }
  cpSync("demo/manifests", join(root, "demo/manifests"), { recursive: true });
  for (const name of ["provider-bootstrap", "identity-bootstrap", "catalog-bootstrap", "seed-and-flow"]) {
    writeFileSync(join(root, "demo", name + ".sh"), "#!/usr/bin/env bash\nset -eu\nprintf '%s\\n' '{\"scope\":\"MOCK_INSTALLER_INTERACTION_NOT_NATIVE\"}' > \"$1\"\n", { mode: 0o700 });
  }
  writeFileSync(join(root, "demo/readback.sh"), "#!/usr/bin/env bash\nprintf '%s\\n' '{\"scope\":\"MOCK_INSTALLER_INTERACTION_NOT_NATIVE\"}'\n", { mode: 0o700 });
  const calls = join(root, "mock-docker-calls.log");
  writeFileSync(calls, "", { mode: 0o600 });
  writeFileSync(join(root, "bin/docker"), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$PAN573_MOCK_DOCKER_CALLS"
case "$1 $2" in
  '--version ') printf '%s\\n' 'Docker mock interaction only' ;;
  'compose version') printf '%s\\n' '2.0.0-mock' ;;
  'image inspect') printf 'sha256:%064d\\n' 0 ;;
esac
if [ "$1" = compose ] && [[ " $* " == *' up '* ]] && [ "\${PAN573_MOCK_UP_FAIL:-0}" = 1 ]; then
  printf >&2 '%s\\n' 'MOCK port is already allocated; no native service was started'
  exit 1
fi
if [ "$1" = compose ] && [[ " $* " == *' ps '* ]]; then
  printf '%s\\n' '{"Service":"chimpmaera","State":"running","Health":"healthy"}'
fi
exit 0
`, { mode: 0o700 });
  const env = {
    ...process.env, PATH: join(root, "bin") + ":" + process.env.PATH,
    PAN573_MOCK_DOCKER_CALLS: calls, CM_DEMO_MODE: "complete", CM_AUTHORITY_PROFILE: "SAFE_GUIDED",
    CM_DEMO_SEED: "yes", CM_DEMO_PROJECT: "pansphaira-e2e-573123-1", CM_DEMO_RUN_OWNER: "pansphaira-e2e-573123-1",
  };
  for (const key of ["CM_CHIMP_PORT", "CM_ESPO_PORT", "CM_DOLI_PORT", "CM_CHIMP_IMAGE", "COMPOSE_PROJECT_NAME"]) delete env[key];
  return { root, calls, env };
}

function executeInteraction(fixture, extraEnv = {}) {
  return spawnSync("bash", [join(fixture.root, "demo/install.sh")], {
    cwd: fixture.root, env: { ...fixture.env, ...extraEnv }, encoding: "utf8", timeout: 20_000,
  });
}

test("ENTRY-AC01 actual Compose renderer binds vendor public origins and health Host to selected nonstandard ports", () => {
  const fixture = installerInteractionFixture();
  try {
    const result = executeInteraction(fixture, {
      CM_CHIMP_PORT: "127.0.0.1:43730", CM_ESPO_PORT: "127.0.0.1:43731", CM_DOLI_PORT: "127.0.0.1:43732",
    });
    assert.equal(result.status, 0, result.stderr);
    const renderEnv = { ...process.env };
    for (const key of ["CM_CHIMP_PORT", "CM_ESPO_PORT", "CM_DOLI_PORT", "CM_CHIMP_IMAGE", "COMPOSE_PROJECT_NAME"]) delete renderEnv[key];
    const rendered = spawnSync("docker", ["compose", "--env-file", join(fixture.root, ".chimpmaera-demo/config.env"),
      "-f", join(fixture.root, "demo/compose.yaml"), "config", "--format", "json"], {
      cwd: fixture.root, env: renderEnv, encoding: "utf8", timeout: 15_000,
    });
    assert.equal(rendered.error, undefined);
    assert.equal(rendered.status, 0, rendered.stderr);
    const services = JSON.parse(rendered.stdout).services;
    assert.equal(services.espocrm.environment.ESPOCRM_SITE_URL, "http://127.0.0.1:43731",
      "The actual vendor origin must not redirect a selected nonstandard binding to a default port.");
    assert.equal(services.dolibarr.environment.DOLI_URL_ROOT, "http://127.0.0.1:43732");
    assert.equal(services.chimpmaera.environment.CM_PUBLIC_ORIGIN, "http://127.0.0.1:43730");
    assert.ok(services.chimpmaera.healthcheck.test.some((arg) => arg.includes("host:'127.0.0.1:43730'")),
      "Actual selected-origin health Host must bind the configured port, not a different public origin.");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("ENTRY-AC03 actual installer interaction distinguishes absent model proof from selected local-demo success", () => {
  const fixture = installerInteractionFixture();
  try {
    const result = executeInteraction(fixture);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^READINESS_MODEL: NOT_RUN(?: |$)/m,
      "Selected demo success must not imply real model/inference evidence or global readiness.");
    assert.doesNotMatch(result.stdout, /^READINESS_MODEL: (?:PASS|READY|VERIFIED)/m);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("ENTRY-AC01 default and persisted effective bindings remain separate from overridden display defaults", () => {
  const fixture = installerInteractionFixture();
  try {
    const initial = executeInteraction(fixture);
    assert.equal(initial.status, 0, initial.stderr);
    assert.deepEqual(reportedServiceAddresses(initial.stdout), {
      PanSphaira: "http://127.0.0.1:7780", EspoCRM: "http://127.0.0.1:7781", Dolibarr: "http://127.0.0.1:7782",
    });
    const configured = executeInteraction(fixture, {
      CM_CHIMP_PORT: "127.0.0.1:43730", CM_ESPO_PORT: "127.0.0.1:43731", CM_DOLI_PORT: "127.0.0.1:43732",
    });
    assert.equal(configured.status, 0, configured.stderr);
    const persisted = executeInteraction(fixture);
    assert.equal(persisted.status, 0, persisted.stderr);
    assert.deepEqual(reportedServiceAddresses(persisted.stdout), reportedServiceAddresses(configured.stdout),
      "Warm replay must report retained actual configured ports, not silently revert to initial defaults.");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("ENTRY-AC03 recorded convergence failure does not report successful startup or active addresses", () => {
  const fixture = installerInteractionFixture();
  try {
    const result = executeInteraction(fixture, { PAN573_MOCK_UP_FAIL: "1" });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /MOCK port is already allocated/);
    assert.doesNotMatch(result.stdout, /demo is READY_VERIFIED/);
    assert.deepEqual(reportedServiceAddresses(result.stdout), {});
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("ENTRY-AC01 observed installer dispatch pins its configured project against an ambient foreign Compose name", () => {
  const fixture = installerInteractionFixture();
  try {
    const result = executeInteraction(fixture, { COMPOSE_PROJECT_NAME: "independent-control" });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    const calls = readFileSync(fixture.calls, "utf8").split("\n").filter((line) => /(?:^| )up(?: |$)|(?:^| )ps(?: |$)/.test(line));
    assert.ok(calls.length > 0);
    assert.ok(calls.every((line) => /--project-name pansphaira-e2e-573123-1(?: |$)/.test(line)),
      "Observed convergence/readback must select the configured owned project rather than ambient foreign Compose state.");
    assert.doesNotMatch(calls.join("\n"), /--project-name independent-control/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("ENTRY-AC03 installer reports six scoped evidence classes without upgrading model proof", () => {
  const fixture = installerInteractionFixture();
  try {
    const result = executeInteraction(fixture);
    assert.equal(result.status, 0, result.stderr);
    const rows = Object.fromEntries([...result.stdout.matchAll(/^READINESS_(SOURCE|BUILD|SERVICE|MODEL|TOOLS|BUSINESS): (.+)$/gm)].map((m) => [m[1], m[2]]));
    assert.deepEqual(Object.keys(rows).sort(), ["BUILD", "BUSINESS", "MODEL", "SERVICE", "SOURCE", "TOOLS"],
      "Source/build/services/model/tools/business need separate explicit evidence, not one green marker.");
    assert.match(rows.SOURCE, /^LOCAL_BUILD_INPUT_DIGEST [a-f0-9]{64}$/);
    assert.match(rows.BUILD, /^IMAGE_OBSERVED sha256:[a-f0-9]{64}$/);
    assert.match(rows.SERVICE, /^SELECTED_SEMANTIC_READBACK_COMPLETE [a-f0-9]{64}$/);
    assert.match(rows.MODEL, /^NOT_RUN /);
    assert.match(rows.TOOLS, /^NATIVE_PROVIDER_BOOTSTRAP_COMPLETE [a-f0-9]{64}; MODEL_TOOL_COMPOSITION_NOT_RUN$/);
    assert.match(rows.BUSINESS, /^SYNTHETIC_GOVERNED_FLOW_READBACK_COMPLETE [a-f0-9]{64}$/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("ENTRY-AC03 seed-disabled run does not claim a governed business effect", () => {
  const fixture = installerInteractionFixture();
  try {
    const result = executeInteraction(fixture, { CM_DEMO_SEED: "no" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^READINESS_BUSINESS: NOT_APPLICABLE_SEED_DISABLED [a-f0-9]{64}$/m,
      "A selected no-seed run must not claim the absent synthetic business effect.");
    assert.doesNotMatch(result.stdout, /^READINESS_BUSINESS: SYNTHETIC_GOVERNED_FLOW_READBACK_COMPLETE /m);
    assert.match(result.stdout, /^READINESS_MODEL: NOT_RUN /m);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("ENTRY-AC01 disabled DMS is explicitly separate from active service addresses", () => {
  const fixture = installerInteractionFixture();
  try {
    const result = executeInteraction(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^DISABLED_SERVICES: DMS=off \(no active URL\)$/m,
      "The disabled adapter must not be confused with a missing or ready active service.");
    assert.doesNotMatch(result.stdout, /^\s+(?:DMS|Paperless):\s+http:/m);
    assert.equal(Object.keys(reportedServiceAddresses(result.stdout)).length, 3);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("ENTRY-AC04 ordinary install offers non-destructive stop instead of unqualified purge", () => {
  const fixture = installerInteractionFixture();
  delete fixture.env.CM_DEMO_RUN_OWNER;
  try {
    const result = executeInteraction(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^\s+Cleanup \(stop, retains data\):\s+\.\/demo\/uninstall\.sh$/m,
      "Ordinary installer ownership cannot authorize purge; safe interruption must retain data.");
    assert.doesNotMatch(result.stdout, /^\s+Cleanup.*--purge/m);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("ENTRY-AC04 golden path binds entry prerequisites, measured identity and existing browser-first owner", () => {
  const doc = readFileSync("demo/README.md", "utf8");
  assert.match(doc, /## Effective entry and evidence handoff/,
    "Golden path must document effective configuration and the separately measured readiness scopes.");
  for (const needle of ["CM_CHIMP_PORT", "CM_ESPO_PORT", "CM_DOLI_PORT", "source commit", "tree", "observed image",
    "READINESS_MODEL", "NOT_RUN", "SOURCE_EVIDENCE_ONLY", "#562", "Docker daemon access", "eight", "./demo/uninstall.sh"]) {
    assert.ok(doc.includes(needle), "Missing bounded entry/handoff requirement: " + needle);
  }
  assert.match(doc, /native.*NOT_RUN|NOT_RUN.*native/i,
    "Documented identities must distinguish an actual native run from unavailable native proof.");
});

test("ENTRY-AC01 credential-bearing and non-loopback address inputs never materialize an active URL", () => {
  for (const binding of ["user:fixture-only-secret@127.0.0.1:43730", "http://127.0.0.1:43730", "0.0.0.0:43730", "127.0.0.1:65536"]) {
    const fixture = installerInteractionFixture();
    try {
      const result = executeInteraction(fixture, { CM_CHIMP_PORT: binding });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 1);
      assert.deepEqual(reportedServiceAddresses(result.stdout), {});
      assert.doesNotMatch(result.stdout + result.stderr, /fixture-only-secret/);
      assert.doesNotMatch(result.stdout, /demo is READY_VERIFIED/);
      assert.doesNotMatch(readFileSync(fixture.calls, "utf8"), /^build | up /m);
      assert.throws(() => readFileSync(join(fixture.root, ".chimpmaera-demo/config.env")), /ENOENT/);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  }
});

function reportedServiceAddresses(stdout) {
  return Object.fromEntries([...stdout.matchAll(/^\s+(PanSphaira|EspoCRM|Dolibarr):\s+(http:\/\/[^\s()]+)/gm)].map((m) => [m[1], m[2]]));
}

test("ENTRY-AC01 actual installer interaction reports its selected nonstandard bindings rather than default addresses", () => {
  const fixture = installerInteractionFixture();
  try {
    const result = executeInteraction(fixture, {
      CM_CHIMP_PORT: "127.0.0.1:43730", CM_ESPO_PORT: "127.0.0.1:43731", CM_DOLI_PORT: "127.0.0.1:43732",
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    const config = readFileSync(join(fixture.root, ".chimpmaera-demo/config.env"), "utf8");
    assert.match(config, /^CM_CHIMP_PORT=127\.0\.0\.1:43730$/m);
    assert.deepEqual(reportedServiceAddresses(result.stdout), {
      PanSphaira: "http://127.0.0.1:43730", EspoCRM: "http://127.0.0.1:43731", Dolibarr: "http://127.0.0.1:43732",
    }, "Reported active addresses must bind the actual selected configuration, not fixed defaults.");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
