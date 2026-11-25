"""Print one fixed PR test group for an exact Git diff, or 'full'. No test commands come from the diff."""
import hashlib
import json
import re
import subprocess
import sys

GRAPH = 'verification/verification-dag-v2.json'
SUMS = 'SHA256SUMS'
# Only already-tracked leaf surfaces. Shared/native implementations, new files,
# mode changes and this policy use the full proof.
GROUPS = {
    'docs': {'CONTRIBUTING.md', 'README.md', 'docs/index.md', 'docs/examples.md',
             'docs/QUICKSTART.md', 'docs/alternatives.md', 'docs/explanation/overview.md'},
    'approval': {'packages/browser-workspace/src/workspace-administration-v1.ts',
                 'packages/browser-workspace/src/workspace-administration-v1.css',
                 'tests/pan550/browser-approval.test.mjs'},
    'invocations': {'tests/pan608/browser-invocations.test.mjs',
                    'docs/architecture/model-free-native-invocations-v1.md'},
    'surfaces': {'tests/pan597/browser-pairing.test.mjs'},
    'invoice': {'tests/incoming-invoice-extraction-benchmark.test.ts'},
}


def git(*args):
    return subprocess.check_output(['git', '--no-replace-objects', *args], timeout=20)


def scope(base, head):
    if not all(re.fullmatch('[0-9a-f]{40}', sha) for sha in (base, head)):
        return 'full'
    raw = git('diff', '--raw', '-z', '--no-renames', '--no-ext-diff', base, head, '--').split(b'\0')
    changed = set()
    for metadata, name in zip(raw[0:-1:2], raw[1:-1:2], strict=True):
        old, new, _, _, status = metadata.split()
        if old != b':100644' or new != b'100644' or status != b'M':
            return 'full'
        changed.add(name.decode())
    source = changed - {GRAPH, SUMS}
    for group, files in GROUPS.items():
        if source and source <= files:
            break
    else:
        return 'full'

    # Routine edits also refresh two checked-in inventories. Admit only the
    # expected digest replacements for these exact file bytes, not new policy.
    def blob(rev, p):
        return git('cat-file', 'blob', f'{rev}:{p}')
    digests = {p: hashlib.sha256(blob(head, p)).hexdigest() for p in source}
    graph = json.loads(blob(base, GRAPH))
    for node in graph['nodes']:
        for item in node['inputs']:
            if item['path'] in digests:
                item['sha256'] = digests[item['path']]
    candidate_graph = blob(head, GRAPH)
    if (json.dumps(graph, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode() != candidate_graph:
        return 'full'
    digests[GRAPH] = hashlib.sha256(candidate_graph).hexdigest()
    expected = []
    for line in blob(base, SUMS).decode().splitlines(keepends=True):
        name = line[68:].removesuffix('\n')
        if name in digests:
            line = digests.pop(name) + line[64:]
        expected.append(line)
    if digests or ''.join(expected).encode() != blob(head, SUMS):
        return 'full'
    return group


if __name__ == '__main__':
    try:
        print(scope(*sys.argv[1:]))
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        print('full')
