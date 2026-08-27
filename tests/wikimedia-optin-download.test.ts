import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  DESTINATION_OUTSIDE_OWNED_MOUNT,
  IDENTIFYING_USER_AGENT_V1,
  POLICY_EVIDENCE_HOST_MISMATCH,
  POLICY_EVIDENCE_UNAVAILABLE,
  WIKIMEDIA_DOWNLOAD_TRANSPORT_BOUNDS_V1,
  parseOfficialDownloadUrl,
  parseWikimediaDownloadPolicyEvidence,
  validateIdentifyingUserAgent,
} from "../packages/local-knowledge/src/wikimedia-download-policy.js";
import {
  CHECKSUM_MISMATCH,
  CHECKSUM_NOT_DECLARED,
  NON_OFFICIAL_URL,
  OPTIN_MISSING,
  RATE_LIMIT_BREACH,
  REDIRECT_ESCAPE,
  RESUME_AMBIGUITY,
  UNEXPECTED_BYTE_COUNT,
  UNEXPECTED_TRANSPORT_STATUS,
  USER_AGENT_NOT_IDENTIFYING,
  WikimediaOptinDownloadSession,
} from "../packages/local-knowledge/src/wikimedia-optin-download.js";
import type {
  FakeTransportV1,
  OptinDownloadDenialCode,
  OptinDownloadDenialV1,
  OptinDownloadResultV1,
  WikimediaOptinDownloadInputV1,
} from "../packages/local-knowledge/src/wikimedia-optin-download.js";

// PSAI107-QWEN-05 (PSAI107-QWEN-05-OPTIN-DOWNLOAD-POLICY).
//
// Fully offline verification of the disabled-by-default opt-in Wikimedia
// dump harness. Every "transport" here is an in-memory fake: no socket, no
// fetch, no DNS, no bundled corpus. The ADR (ADR-PSAI107-WIKIMEDIA-M0-01)
// remains in force — these tests prove the opt-in policy (official
// metadata only, identifying User-Agent, bounded connection/rate behavior,
// byte-size plus declared-digest verification, atomic mounted exposure and
// fail-closed denials) without any real network I/O.

const here = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_PATH = path.join(here, "../../tests/fixtures/wikimedia-download/official-checksum.txt");
const evidenceRaw = readFileSync(EVIDENCE_PATH, "utf8");

const ARTICLES_FILENAME = "enwiki-20260801-pages-articles.xml.gz";
const ARTICLES_URL = `https://dumps.wikimedia.org/wikipedia/en/20260801/${ARTICLES_FILENAME}`;
const ARTICLES_BODY = Buffer.from(
  "PanSphaira-PSAI107-offline-fake-transport-bytes\n".repeat(16),
);
const ARTICLES_SHA256 = createHash("sha256").update(ARTICLES_BODY).digest("hex");

const META_FILENAME = "enwiki-20260801-site-stats.gz";
const META_URL = `https://dumps.wikimedia.org/wikipedia/en/20260801/${META_FILENAME}`;
const META_BODY = Buffer.from("PanSphaira-PSAI107-offline-fake-meta-bytes\n".repeat(4));
const META_SHA256 = createHash("sha256").update(META_BODY).digest("hex");

function makeMountRoot(t: { after(fn: () => void): void }): string {
  const root = mkdtempSync(path.join(tmpdir(), "psai107-wikimedia-"));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return root;
}

function baseInput(mountRoot: string, destination: string): WikimediaOptinDownloadInputV1 {
  return {
    optIn: true,
    url: ARTICLES_URL,
    policyEvidenceRaw: evidenceRaw,
    userAgent: IDENTIFYING_USER_AGENT_V1,
    mountRoot,
    destination,
  };
}

// A deterministic offline fake transport serving exactly one official file.
function transportFor(url: string, body: Uint8Array, finalUrl = url): FakeTransportV1 {
  return {
    name: "offline-fake-transport",
    fetch(request) {
      assert.equal(request.url, url);
      assert.equal(request.userAgent, IDENTIFYING_USER_AGENT_V1);
      assert.equal(request.resumeFromByte, 0);
      return { finalUrl, status: 200, body };
    },
  };
}

// A probe transport that records any fetch and then throws: it proves a
// denial happened before any transport call, i.e. before bytes could become
// usable. `calls` is a live getter so the count is read at assertion time,
// not captured at construction.
function probeTransport(): { readonly transport: FakeTransportV1; readonly calls: number } {
  let calls = 0;
  return {
    transport: {
      name: "probe",
      fetch() {
        calls += 1;
        throw new Error("transport must not be reached before bytes become usable");
      },
    },
    get calls() {
      return calls;
    },
  };
}

function expectDenial(
  result: OptinDownloadResultV1,
  code: OptinDownloadDenialCode,
): asserts result is OptinDownloadDenialV1 {
  if (result.ok) {
    assert.fail(`expected denial ${code}, got receipt`);
  }
  assert.equal(result.code, code);
}

test("fixture pins the official checksum metadata the policy core parses", () => {
  const parsed = parseWikimediaDownloadPolicyEvidence(evidenceRaw);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    return;
  }
  assert.equal(parsed.evidence.host, "dumps.wikimedia.org");
  assert.equal(parsed.evidence.maximumSourceBytes, 8_388_608);
  const articles = parsed.evidence.entryByFilename.get(ARTICLES_FILENAME);
  assert.deepEqual(articles, {
    filename: ARTICLES_FILENAME,
    sha256: ARTICLES_SHA256,
    byteSize: ARTICLES_BODY.length,
  });
  const meta = parsed.evidence.entryByFilename.get(META_FILENAME);
  assert.deepEqual(meta, { filename: META_FILENAME, sha256: META_SHA256, byteSize: META_BODY.length });
});

test("fake official transport runs only after explicit opt-in and atomically exposes the mounted candidate", (t) => {
  const mountRoot = makeMountRoot(t);
  const destination = path.join(mountRoot, ARTICLES_FILENAME);
  // A stale .partial from a previous crashed run must be replaced, not kept.
  writeFileSync(`${destination}.partial`, "stale-partial-bytes");
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(baseInput(mountRoot, destination), transportFor(ARTICLES_URL, ARTICLES_BODY));
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  // Byte size and declared digest verified before exposure: the exposed file
  // is byte-identical to the declared official body.
  assert.equal(statSync(destination).size, ARTICLES_BODY.length);
  assert.equal(createHash("sha256").update(readFileSync(destination)).digest("hex"), ARTICLES_SHA256);
  // Atomic exposure: no .partial remains in the owned mount.
  assert.deepEqual(readdirSync(mountRoot), [ARTICLES_FILENAME]);
  assert.equal(result.filename, ARTICLES_FILENAME);
  assert.equal(result.byteSize, ARTICLES_BODY.length);
  assert.equal(result.sha256, ARTICLES_SHA256);
  assert.equal(result.destination, destination);
  assert.ok(Object.isFrozen(result));
});

test("request records prove the identifying User-Agent and applied connection/rate limits", (t) => {
  const mountRoot = makeMountRoot(t);
  let now = 0;
  const session = new WikimediaOptinDownloadSession(() => now);
  const articles = session.run(
    baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)),
    transportFor(ARTICLES_URL, ARTICLES_BODY),
  );
  assert.equal(articles.ok, true);
  if (!articles.ok) {
    return;
  }
  const record = articles.requestRecords[0];
  assert.ok(record);
  assert.ok(Object.isFrozen(articles.requestRecords));
  assert.equal(record.url, ARTICLES_URL);
  assert.equal(record.userAgent, IDENTIFYING_USER_AGENT_V1);
  assert.equal(record.connectionIndex, 0);
  assert.equal(record.requestOrdinal, 1);
  assert.deepEqual(record.requestedByteRange, { from: 0, toExclusive: ARTICLES_BODY.length });
  assert.equal(record.intervalMs, WIKIMEDIA_DOWNLOAD_TRANSPORT_BOUNDS_V1.minimumRequestIntervalMs);
  assert.deepEqual(record.appliedBounds, {
    maximumConcurrentConnections: WIKIMEDIA_DOWNLOAD_TRANSPORT_BOUNDS_V1.maximumConcurrentConnections,
    maximumRequestsPerSession: WIKIMEDIA_DOWNLOAD_TRANSPORT_BOUNDS_V1.maximumRequestsPerSession,
    minimumRequestIntervalMs: WIKIMEDIA_DOWNLOAD_TRANSPORT_BOUNDS_V1.minimumRequestIntervalMs,
    maximumSourceBytes: WIKIMEDIA_DOWNLOAD_TRANSPORT_BOUNDS_V1.maximumSourceBytes,
  });
  // A second bounded request in the same session, spaced by the interval.
  now += 1_500;
  const meta = session.run(
    { ...baseInput(mountRoot, path.join(mountRoot, META_FILENAME)), url: META_URL },
    transportFor(META_URL, META_BODY),
  );
  assert.equal(meta.ok, true);
  if (!meta.ok) {
    return;
  }
  assert.equal(meta.requestRecords[0]?.requestOrdinal, 2);
});

test("no flag denies before bytes become usable", (t) => {
  const mountRoot = makeMountRoot(t);
  const destination = path.join(mountRoot, ARTICLES_FILENAME);
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  const result = session.run({ ...baseInput(mountRoot, destination), optIn: false }, probe.transport);
  expectDenial(result, OPTIN_MISSING);
  assert.equal(result.stage, "PRE_TRANSPORT");
  assert.equal(probe.calls, 0, "transport must not be called without explicit opt-in");
  assert.equal(existsSync(destination), false);
});

test("default container invocation denies before bytes become usable", (t) => {
  const mountRoot = makeMountRoot(t);
  const destination = path.join(mountRoot, ARTICLES_FILENAME);
  // The default container invocation carries no opt-in flag at all.
  const input: WikimediaOptinDownloadInputV1 = {
    url: ARTICLES_URL,
    policyEvidenceRaw: evidenceRaw,
    userAgent: IDENTIFYING_USER_AGENT_V1,
    mountRoot,
    destination,
  };
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(input, probe.transport);
  expectDenial(result, OPTIN_MISSING);
  assert.equal(probe.calls, 0);
  assert.equal(existsSync(destination), false);
  assert.equal(existsSync(`${destination}.partial`), false);
});

test("non-official host denies", (t) => {
  const mountRoot = makeMountRoot(t);
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(
    {
      ...baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)),
      url: `https://example.com/wikipedia/en/20260801/${ARTICLES_FILENAME}`,
    },
    probe.transport,
  );
  expectDenial(result, NON_OFFICIAL_URL);
  assert.equal(result.stage, "PRE_TRANSPORT");
  assert.equal(probe.calls, 0);
});

test("non-official path on the official host denies", (t) => {
  const mountRoot = makeMountRoot(t);
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(
    {
      ...baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)),
      url: `https://dumps.wikimedia.org/random/20260801/${ARTICLES_FILENAME}`,
    },
    probe.transport,
  );
  expectDenial(result, NON_OFFICIAL_URL);
  assert.equal(probe.calls, 0);
});

test("redirect escape denies and exposes no bytes", (t) => {
  const mountRoot = makeMountRoot(t);
  const destination = path.join(mountRoot, ARTICLES_FILENAME);
  // Redirect to a non-official host.
  {
    const session = new WikimediaOptinDownloadSession();
    const result = session.run(
      baseInput(mountRoot, destination),
      transportFor(ARTICLES_URL, ARTICLES_BODY, "https://evil.example.com/escape.gz"),
    );
    expectDenial(result, REDIRECT_ESCAPE);
    assert.equal(result.stage, "POST_TRANSPORT");
    assert.equal(existsSync(destination), false);
  }
  // Redirect to a different official file (still an escape from the declared
  // metadata).
  {
    const session = new WikimediaOptinDownloadSession();
    const result = session.run(
      baseInput(mountRoot, destination),
      transportFor(ARTICLES_URL, ARTICLES_BODY, META_URL),
    );
    expectDenial(result, REDIRECT_ESCAPE);
    assert.equal(existsSync(destination), false);
  }
  // A same-host redirect to another official path is also outside the exact
  // declared URL and must not be accepted by filename alone.
  {
    const session = new WikimediaOptinDownloadSession();
    const result = session.run(
      baseInput(mountRoot, destination),
      transportFor(
        ARTICLES_URL,
        ARTICLES_BODY,
        ARTICLES_URL.replace("/20260801/", "/20260802/"),
      ),
    );
    expectDenial(result, REDIRECT_ESCAPE);
    assert.equal(existsSync(destination), false);
  }
});

test("absent official checksum metadata for the requested file denies", (t) => {
  const mountRoot = makeMountRoot(t);
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(
    {
      ...baseInput(mountRoot, path.join(mountRoot, "enwiki-20260801-other.xml.gz")),
      url: "https://dumps.wikimedia.org/wikipedia/en/20260801/enwiki-20260801-other.xml.gz",
    },
    probe.transport,
  );
  expectDenial(result, CHECKSUM_NOT_DECLARED);
  assert.equal(result.stage, "PRE_TRANSPORT");
  assert.equal(probe.calls, 0);
});

test("official URL outside the checksum evidence's language/date scope denies", (t) => {
  const mountRoot = makeMountRoot(t);
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  // The basename is declared, but the URL points at a different official dump
  // directory. Filename-only metadata must not authorize that different dump.
  const result = session.run(
    {
      ...baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)),
      url: `https://dumps.wikimedia.org/wikipedia/de/20260802/${ARTICLES_FILENAME}`,
    },
    probe.transport,
  );
  expectDenial(result, CHECKSUM_NOT_DECLARED);
  assert.equal(result.stage, "PRE_TRANSPORT");
  assert.equal(probe.calls, 0);
});

test("mismatched checksum denies before bytes become usable", (t) => {
  const mountRoot = makeMountRoot(t);
  const destination = path.join(mountRoot, ARTICLES_FILENAME);
  const wrongBody = Buffer.from("X".repeat(ARTICLES_BODY.length));
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(baseInput(mountRoot, destination), transportFor(ARTICLES_URL, wrongBody));
  expectDenial(result, CHECKSUM_MISMATCH);
  assert.equal(existsSync(destination), false, "no candidate may be exposed on digest mismatch");
});

test("unexpected byte count denies before bytes become usable", (t) => {
  const mountRoot = makeMountRoot(t);
  const destination = path.join(mountRoot, ARTICLES_FILENAME);
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(baseInput(mountRoot, destination), transportFor(ARTICLES_URL, Buffer.from("short")));
  expectDenial(result, UNEXPECTED_BYTE_COUNT);
  assert.equal(existsSync(destination), false);
});

test("non-200 transport status denies", (t) => {
  const mountRoot = makeMountRoot(t);
  const destination = path.join(mountRoot, ARTICLES_FILENAME);
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(
    baseInput(mountRoot, destination),
    {
      name: "offline-fake-transport",
      fetch() {
        return { finalUrl: ARTICLES_URL, status: 404, body: ARTICLES_BODY };
      },
    },
  );
  expectDenial(result, UNEXPECTED_TRANSPORT_STATUS);
  assert.equal(existsSync(destination), false);
});

test("unavailable policy evidence denies", (t) => {
  const mountRoot = makeMountRoot(t);
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(
    { ...baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)), policyEvidenceRaw: "" },
    probe.transport,
  );
  expectDenial(result, POLICY_EVIDENCE_UNAVAILABLE);
  assert.equal(result.stage, "PRE_TRANSPORT");
  assert.equal(probe.calls, 0);
});

test("policy evidence missing the official host declaration denies", (t) => {
  const mountRoot = makeMountRoot(t);
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(
    {
      ...baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)),
      policyEvidenceRaw: evidenceRaw.replace("# host dumps.wikimedia.org\n", ""),
    },
    probe.transport,
  );
  expectDenial(result, POLICY_EVIDENCE_HOST_MISMATCH);
  assert.equal(probe.calls, 0);
});

test("missing User-Agent denies", (t) => {
  const mountRoot = makeMountRoot(t);
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(
    { ...baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)), userAgent: "" },
    probe.transport,
  );
  expectDenial(result, USER_AGENT_NOT_IDENTIFYING);
  assert.equal(result.stage, "PRE_TRANSPORT");
  assert.equal(probe.calls, 0);
});

test("non-identifying User-Agent denies", (t) => {
  const mountRoot = makeMountRoot(t);
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(
    { ...baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)), userAgent: "curl/8.5.0 (linux)" },
    probe.transport,
  );
  expectDenial(result, USER_AGENT_NOT_IDENTIFYING);
  assert.equal(probe.calls, 0);
});

test("rate interval breach denies", (t) => {
  const mountRoot = makeMountRoot(t);
  let now = 0;
  const session = new WikimediaOptinDownloadSession(() => now);
  const first = session.run(
    baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)),
    transportFor(ARTICLES_URL, ARTICLES_BODY),
  );
  assert.equal(first.ok, true);
  now += 500; // below the minimum 1000 ms interval
  const second = session.run(
    { ...baseInput(mountRoot, path.join(mountRoot, META_FILENAME)), url: META_URL },
    transportFor(META_URL, META_BODY),
  );
  expectDenial(second, RATE_LIMIT_BREACH);
  assert.equal(second.stage, "PRE_TRANSPORT");
});

test("session request cap denies", (t) => {
  const mountRoot = makeMountRoot(t);
  let now = 0;
  const session = new WikimediaOptinDownloadSession(() => now);
  const first = session.run(
    baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)),
    transportFor(ARTICLES_URL, ARTICLES_BODY),
  );
  assert.equal(first.ok, true);
  now += 2_000;
  const second = session.run(
    { ...baseInput(mountRoot, path.join(mountRoot, META_FILENAME)), url: META_URL },
    transportFor(META_URL, META_BODY),
  );
  assert.equal(second.ok, true);
  now += 2_000;
  // maximumRequestsPerSession is 2: the third request must be denied before
  // the transport is reached (the destination directory does not even exist,
  // proving the rate gate fires first).
  const third = session.run(
    baseInput(mountRoot, path.join(mountRoot, "retry", ARTICLES_FILENAME)),
    transportFor(ARTICLES_URL, ARTICLES_BODY),
  );
  expectDenial(third, RATE_LIMIT_BREACH);
  assert.equal(third.stage, "PRE_TRANSPORT");
});

test("failed transport calls consume the bounded request budget", (t) => {
  const mountRoot = makeMountRoot(t);
  let now = 0;
  const session = new WikimediaOptinDownloadSession(() => now);
  const failingTransport: FakeTransportV1 = {
    name: "offline-failing-fake-transport",
    fetch() {
      return { finalUrl: ARTICLES_URL, status: 503, body: ARTICLES_BODY };
    },
  };
  const first = session.run(
    baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)),
    failingTransport,
  );
  expectDenial(first, UNEXPECTED_TRANSPORT_STATUS);
  now += 2_000;
  const second = session.run(
    baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)),
    failingTransport,
  );
  expectDenial(second, UNEXPECTED_TRANSPORT_STATUS);
  now += 2_000;
  const third = session.run(
    baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)),
    failingTransport,
  );
  expectDenial(third, RATE_LIMIT_BREACH);
});

test("partial resume offset denies as ambiguous", (t) => {
  const mountRoot = makeMountRoot(t);
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(
    { ...baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)), resumeFromByte: ARTICLES_BODY.length / 2 },
    probe.transport,
  );
  expectDenial(result, RESUME_AMBIGUITY);
  assert.equal(result.stage, "PRE_TRANSPORT");
  assert.equal(probe.calls, 0);
});

test("resume offset beyond the declared size denies as ambiguous", (t) => {
  const mountRoot = makeMountRoot(t);
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(
    { ...baseInput(mountRoot, path.join(mountRoot, ARTICLES_FILENAME)), resumeFromByte: ARTICLES_BODY.length + 1 },
    probe.transport,
  );
  expectDenial(result, RESUME_AMBIGUITY);
  assert.equal(probe.calls, 0);
});

test("resume from a fully-complete file verifies without fetching", (t) => {
  const mountRoot = makeMountRoot(t);
  const destination = path.join(mountRoot, ARTICLES_FILENAME);
  writeFileSync(destination, ARTICLES_BODY);
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(
    { ...baseInput(mountRoot, destination), resumeFromByte: ARTICLES_BODY.length },
    probe.transport,
  );
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  assert.equal(probe.calls, 0, "a complete resume must not fetch bytes");
  assert.deepEqual(result.requestRecords, []);
  assert.equal(createHash("sha256").update(readFileSync(destination)).digest("hex"), ARTICLES_SHA256);
});

test("resume from an incomplete existing file denies without fetching", (t) => {
  const mountRoot = makeMountRoot(t);
  const destination = path.join(mountRoot, ARTICLES_FILENAME);
  writeFileSync(destination, ARTICLES_BODY.subarray(0, 10));
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  const result = session.run(
    { ...baseInput(mountRoot, destination), resumeFromByte: ARTICLES_BODY.length },
    probe.transport,
  );
  expectDenial(result, CHECKSUM_MISMATCH);
  assert.equal(result.stage, "EXPOSURE");
  assert.equal(probe.calls, 0);
});

test("destination outside the owned mount denies", (t) => {
  const mountRoot = makeMountRoot(t);
  const probe = probeTransport();
  const session = new WikimediaOptinDownloadSession();
  // Path traversal out of the mount.
  const traversal = session.run(
    { ...baseInput(mountRoot, path.join(mountRoot, "..", "outside", ARTICLES_FILENAME)) },
    probe.transport,
  );
  expectDenial(traversal, DESTINATION_OUTSIDE_OWNED_MOUNT);
  // A wholly separate directory outside the mount.
  const otherRoot = makeMountRoot(t);
  const separate = session.run(
    { ...baseInput(mountRoot, path.join(otherRoot, ARTICLES_FILENAME)) },
    probe.transport,
  );
  expectDenial(separate, DESTINATION_OUTSIDE_OWNED_MOUNT);
  // A basename that is not the official filename.
  const renamed = session.run(
    { ...baseInput(mountRoot, path.join(mountRoot, "wrong-name.gz")) },
    probe.transport,
  );
  expectDenial(renamed, DESTINATION_OUTSIDE_OWNED_MOUNT);
  // A destination symlink must not be followed, including when its target is
  // outside the owned mount.
  const symlinked = path.join(mountRoot, ARTICLES_FILENAME);
  symlinkSync(path.join(otherRoot, "outside.gz"), symlinked);
  const symlink = session.run(
    { ...baseInput(mountRoot, symlinked) },
    probe.transport,
  );
  expectDenial(symlink, DESTINATION_OUTSIDE_OWNED_MOUNT);
  assert.equal(probe.calls, 0);
});

test("official URL gate is fail-closed on protocol, port, userinfo, query and fragment", () => {
  const valid = parseOfficialDownloadUrl(ARTICLES_URL);
  assert.equal(valid.ok, true);
  for (const bad of [
    `http://dumps.wikimedia.org/wikipedia/en/20260801/${ARTICLES_FILENAME}`,
    `https://dumps.wikimedia.org:8443/wikipedia/en/20260801/${ARTICLES_FILENAME}`,
    `https://dumps.wikimedia.org/wikipedia/en/20260801/${ARTICLES_FILENAME}?token=abc`,
    `https://user@dumps.wikimedia.org/wikipedia/en/20260801/${ARTICLES_FILENAME}`,
    `https://dumps.wikimedia.org/wikipedia/en/20260801/${ARTICLES_FILENAME}#frag`,
    "not-a-url",
  ]) {
    const parsed = parseOfficialDownloadUrl(bad);
    assert.equal(parsed.ok, false, bad);
  }
});

test("identifying User-Agent validator is fail-closed", () => {
  assert.equal(validateIdentifyingUserAgent(IDENTIFYING_USER_AGENT_V1), true);
  for (const bad of [
    "",
    "curl/8.5.0",
    "PanSphaira/1.0.0",
    "psai107/1.0.0 (x)",
    "A/1.0.0".repeat(40),
  ]) {
    assert.equal(validateIdentifyingUserAgent(bad), false, bad);
  }
});

test("policy evidence parser is fail-closed on malformed and out-of-bounds entries", () => {
  assert.equal(parseWikimediaDownloadPolicyEvidence("").ok, false);
  const noBound = parseWikimediaDownloadPolicyEvidence(
    evidenceRaw.replace("# maximumSourceBytes 8388608\n", ""),
  );
  assert.equal(noBound.ok ? false : noBound.code, "POLICY_EVIDENCE_BOUND_MISMATCH");
  const duplicate = parseWikimediaDownloadPolicyEvidence(
    `${evidenceRaw}sha256 ${ARTICLES_SHA256} 768 ${ARTICLES_FILENAME}\n`,
  );
  assert.equal(duplicate.ok ? false : duplicate.code, "POLICY_EVIDENCE_DUPLICATE_ENTRY");
  const tooLarge = parseWikimediaDownloadPolicyEvidence(evidenceRaw.replace(" 768 ", " 9999999 "));
  assert.equal(tooLarge.ok ? false : tooLarge.code, "POLICY_EVIDENCE_BYTE_SIZE_OUT_OF_BOUNDS");
  const nonAscii = parseWikimediaDownloadPolicyEvidence(evidenceRaw.replace("\n", "\n# host ü\n"));
  assert.equal(nonAscii.ok ? false : nonAscii.code, "POLICY_EVIDENCE_MALFORMED");
});