# Offline local knowledge wiki profile

This is the explicitly selected, default-off Docker profile for PSAI107. It
contains the approved MediaWiki mini-dump importer, canonicalizer, immutable
edition lifecycle, external index publication, and read-only local query
service. It has no corpus, downloader, credentials, model, or online fallback
in the image.

The source dump is a required runtime bind mount and is mounted read-only. The
canonical lifecycle and active index are separate persistent external Docker
volumes. The container uses `network_mode: none`, a read-only root filesystem,
no added capabilities, and no write or download command.

## Run the synthetic offline pilot

From the repository root:

    docker volume create psai107-local-knowledge-wiki-canonical
    docker volume create psai107-local-knowledge-wiki-index
    docker compose -f docker/local-knowledge-wiki/docker-compose.wiki.yml \
      --profile local-knowledge-wiki up --build -d

Compose without `--profile local-knowledge-wiki` starts no service.

The service imports the mounted dump before it starts. Startup prints an
`EDITION_MANIFEST` line containing the parser version, canonicalizer version,
source/content/edition digests, and the build image digest. The persisted
`edition-manifest.json` is digest-only metadata; it does not contain pages or
passages. The immutable contract manifest remains under the canonical
lifecycle volume.

Query the already running service through its loopback network namespace:

    docker compose -f docker/local-knowledge-wiki/docker-compose.wiki.yml \
      --profile local-knowledge-wiki exec -T local-knowledge-wiki \
      /usr/local/bin/local-knowledge-wiki query \
      "first synthetic article" LOCAL_HYBRID 20

Each result in the receipt includes the exact passage, project, page ID,
revision ID, canonical URL, snapshot date, license, content digest, edition
digest, and citation. Receipts declare `network: DISABLED`, `model: DISABLED`,
and the read-only authority boundary.

The service intentionally has no HTTP host port because `network_mode: none`
blocks both outbound and inbound container networking. The HTTP query service
listens only on container loopback for an in-namespace caller; its `POST
/query` endpoint is read-only and all writer/admin paths are denied.

## Fail-closed checks

- No command or `docker compose up` without the profile starts this service.
- `import` and `serve` require a present, readable, read-only source mount.
- A `WIKI_DOWNLOAD_URL` environment variable is denied; there is no download
  command or network client.
- Missing, writable, extra, symlinked, malformed, or digest-drifted source
  material is denied by the existing closed parser.
- The external index must match the immutable canonical lifecycle before a
  query is served.
- The image build context excludes tests, XML/dump formats, corpora,
  credential-like files, `.env` files, and generated output.
