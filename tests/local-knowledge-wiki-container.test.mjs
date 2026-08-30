import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(new URL(".", import.meta.url).pathname, "..");
const composeFile = path.join(repositoryRoot, "docker/local-knowledge-wiki/docker-compose.wiki.yml");
const sourceMount = path.join(repositoryRoot, "tests/fixtures/local-knowledge-wiki-container/source");
const image = "pansphaira/local-knowledge-wiki:psai107-test";
const project = `psai107-container-${process.pid}`;
const canonicalVolume = `${project}-canonical`;
const indexVolume = `${project}-index`;
const credentialVolume = `${project}-credential-source`;
const buildDigest = "sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const baseEnv = {
  ...process.env,
  COMPOSE_PROJECT_NAME: project,
  LOCAL_KNOWLEDGE_WIKI_IMAGE: image,
  LOCAL_KNOWLEDGE_WIKI_CANONICAL_VOLUME: canonicalVolume,
  LOCAL_KNOWLEDGE_WIKI_INDEX_VOLUME: indexVolume,
  LOCAL_KNOWLEDGE_WIKI_BUILD_IMAGE_DIGEST: buildDigest,
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: baseEnv,
    encoding: "utf8",
    timeout: 180_000,
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}

function compose(args, options = {}) {
  return run("docker", ["compose", "-f", composeFile, ...args], options);
}

function docker(args, options = {}) {
  return run("docker", args, options);
}

function assertOk(result, label) {
  assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function assertDenied(result, label) {
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded\n${result.stdout}\n${result.stderr}`);
}

function queryViaExec() {
  return compose([
    "exec", "-T", "local-knowledge-wiki", "/usr/local/bin/local-knowledge-wiki",
    "query", "first synthetic article", "LOCAL_HYBRID", "20",
  ]);
}

function waitForQuery() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = queryViaExec();
    if (result.status === 0) return result;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
  }
  return queryViaExec();
}

test("PSAI107 default-off offline container profile proves positive and fail-closed cases", { timeout: 600_000 }, () => {
  const defaultConfig = compose(["config", "--services"]);
  assertOk(defaultConfig, "default compose config");
  assert.equal(defaultConfig.stdout.trim(), "", "profiled service must not be selected by default");
  const defaultUp = compose(["up", "-d"]);
  assert.notEqual(defaultUp.status, 0, "default compose invocation must not start a profiled service");
  assert.match(`${defaultUp.stdout}${defaultUp.stderr}`, /no service selected/i);

  const profileConfig = compose(["--profile", "local-knowledge-wiki", "config", "--services"]);
  assertOk(profileConfig, "selected profile config");
  assert.match(profileConfig.stdout, /local-knowledge-wiki/);

  assertOk(docker(["volume", "create", canonicalVolume]), "canonical volume create");
  assertOk(docker(["volume", "create", indexVolume]), "index volume create");
  try {
    const built = compose(["--profile", "local-knowledge-wiki", "build"]);
    assertOk(built, "offline wiki image build");

    const started = compose(["--profile", "local-knowledge-wiki", "up", "-d"]);
    assertOk(started, "selected profile startup");
    try {
      const query = waitForQuery();
      assertOk(query, "read-only mounted-dump query");
      const receipt = JSON.parse(query.stdout);
      assert.equal(receipt.network, "DISABLED");
      assert.equal(receipt.model, "DISABLED");
      assert.ok(receipt.results.length > 0);
      for (const result of receipt.results) {
        assert.equal(typeof result.exactPassage, "string");
        assert.ok(result.exactPassage.length > 0);
        assert.equal(result.project, "wikipedia:synthetic");
        assert.equal(typeof result.pageId, "number");
        assert.equal(typeof result.revisionId, "number");
        assert.match(result.canonicalUrl, /^https:\/\//);
        assert.equal(result.snapshotDate, "2026-08-27");
        assert.equal(result.license.licence, "CC0-1.0");
        assert.match(result.contentDigest, /^[a-f0-9]{64}$/);
        assert.match(result.editionDigest, /^[a-f0-9]{64}$/);
      }

      const runtimeManifestResult = compose([
        "exec", "-T", "local-knowledge-wiki", "cat",
        "/var/lib/local-knowledge-wiki/canonical/edition-manifest.json",
      ]);
      assertOk(runtimeManifestResult, "runtime edition manifest readback");
      const runtimeManifest = JSON.parse(runtimeManifestResult.stdout);
      assert.equal(runtimeManifest.parserVersion, "mediawiki-mini-dump-parser/v1");
      assert.equal(runtimeManifest.canonicalizerVersion, "mediawiki-mini-dump-canonicalizer/v1");
      assert.equal(runtimeManifest.buildImageDigest, buildDigest);
      assert.equal(Object.hasOwn(runtimeManifest, "pages"), false);
      assert.equal(Object.hasOwn(runtimeManifest, "text"), false);

      const inspected = compose(["ps", "-q", "local-knowledge-wiki"]);
      assertOk(inspected, "running container id");
      const containerId = inspected.stdout.trim();
      const inspect = docker(["inspect", "-f", "{{.HostConfig.NetworkMode}} {{json .Mounts}}", containerId]);
      assertOk(inspect, "container isolation inspection");
      const inspectOutput = inspect.stdout.trim();
      assert.ok(inspectOutput.startsWith("none "), "container must have no network namespace");
      const mounts = JSON.parse(inspectOutput.slice("none ".length));
      const mountAt = (destination) => mounts.find((mount) => mount.Destination === destination);
      assert.deepEqual(mountAt("/mnt/source"), {
        Type: "bind",
        Source: sourceMount,
        Destination: "/mnt/source",
        Mode: "ro",
        RW: false,
        Propagation: "rprivate",
      }, "the dump must be the explicit read-only bind mount");
      assert.equal(mountAt("/var/lib/local-knowledge-wiki/canonical")?.Type, "volume");
      assert.equal(mountAt("/var/lib/local-knowledge-wiki/canonical")?.Name, canonicalVolume);
      assert.equal(mountAt("/var/lib/local-knowledge-wiki/canonical")?.RW, true);
      assert.equal(mountAt("/var/lib/local-knowledge-wiki/index")?.Type, "volume");
      assert.equal(mountAt("/var/lib/local-knowledge-wiki/index")?.Name, indexVolume);
      assert.equal(mountAt("/var/lib/local-knowledge-wiki/index")?.RW, true);

      const dnsHttp = compose([
        "exec", "-T", "local-knowledge-wiki", "node", "-e",
        "(async()=>{let bad=false;try{await fetch('http://example.com');bad=true}catch{}try{await (await import('node:dns/promises')).lookup('example.com');bad=true}catch{}process.exit(bad?1:0)})()",
      ]);
      assertOk(dnsHttp, "outbound DNS and HTTP denial");

      const writer = compose([
        "exec", "-T", "local-knowledge-wiki", "node", "-e",
        "(async()=>{const a=await fetch('http://127.0.0.1:8787/write',{method:'POST'});const b=await fetch('http://127.0.0.1:8787/query',{method:'PUT'});process.exit(a.status===405&&b.status===405?0:1)})()",
      ]);
      assertOk(writer, "writer query endpoint denial");
    } finally {
      compose(["--profile", "local-knowledge-wiki", "down"]);
    }

    const missingSource = docker([
      "run", "--rm", "--network", "none", "--read-only", "-v", "/dev/null:/mnt/source:ro",
      image, "import",
    ]);
    assertDenied(missingSource, "absent source mount");

    const writableSource = docker([
      "run", "--rm", "--network", "none", "--read-only", "-v", `${sourceMount}:/mnt/source:rw`,
      "-v", `${canonicalVolume}:/var/lib/local-knowledge-wiki/canonical:rw`,
      "-v", `${indexVolume}:/var/lib/local-knowledge-wiki/index:rw`, image, "import",
    ]);
    assertDenied(writableSource, "writable source mount");

    const downloadEnv = docker([
      "run", "--rm", "--network", "none", "-e", "WIKI_DOWNLOAD_URL=https://example.invalid/dump.xml",
      image, "serve",
    ]);
    assertDenied(downloadEnv, "download environment without opt-in command");

    assertOk(docker(["volume", "create", credentialVolume]), "credential fixture volume create");
    try {
      const populateCredentialVolume = docker([
        "run", "--rm", "--user", "root", "--entrypoint", "/bin/sh",
        "-v", `${sourceMount}:/source:ro`, "-v", `${credentialVolume}:/target:rw`, image,
        "-c", "cp -a /source/. /target/ && printf 'AWS_SECRET_ACCESS_KEY=credential-like-fixture\\n' > /target/credential-like.env",
      ]);
      assertOk(populateCredentialVolume, "credential fixture volume populate");
      const credentialFixture = docker([
        "run", "--rm", "--network", "none", "-v", `${credentialVolume}:/mnt/source:ro`,
        "-v", `${canonicalVolume}:/var/lib/local-knowledge-wiki/canonical:rw`,
        "-v", `${indexVolume}:/var/lib/local-knowledge-wiki/index:rw`, image, "import",
      ]);
      assertDenied(credentialFixture, "credential-like source fixture");
    } finally {
      docker(["volume", "rm", "-f", credentialVolume]);
    }

    const imageFiles = docker(["run", "--rm", "--entrypoint", "/bin/sh", image, "-c", "find /app -type f -print"]);
    assertOk(imageFiles, "image filesystem inspection");
    assert.doesNotMatch(imageFiles.stdout, /\.xml(?:\s|$)/);
    assert.doesNotMatch(imageFiles.stdout, /(?:positive-mini|reordered-mini|credential-like\.env|corpus-file\.txt|\.xml$)/i);
  } finally {
    compose(["--profile", "local-knowledge-wiki", "down", "-v"]);
    docker(["volume", "rm", "-f", canonicalVolume]);
    docker(["volume", "rm", "-f", indexVolume]);
    docker(["volume", "rm", "-f", credentialVolume]);
  }
});

// Keep the focused fixture assertion local to this test file so a missing
// runtime fixture cannot be mistaken for a Docker networking failure.
test("PSAI107 container fixture remains synthetic and credential-free", () => {
  const manifest = JSON.parse(readFileSync(path.join(sourceMount, "manifest.json"), "utf8"));
  assert.equal(manifest.syntheticOnly, true);
  assert.equal(manifest.networkAllowed, false);
  assert.equal(readFileSync(path.join(repositoryRoot, "tests/fixtures/local-knowledge-wiki-container/credential-like.env"), "utf8").includes("AWS_SECRET_ACCESS_KEY"), true);
});
