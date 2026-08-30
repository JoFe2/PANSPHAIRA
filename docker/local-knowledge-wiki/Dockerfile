# syntax=docker/dockerfile:1.7
FROM node:24.14.1-bookworm-slim AS build

WORKDIR /build
COPY --from=repository package.json package-lock.json tsconfig.json ./
RUN npm ci --ignore-scripts
COPY --from=repository packages ./packages
RUN npx tsc -p tsconfig.json

FROM node:24.14.1-bookworm-slim

ARG BUILD_IMAGE_DIGEST=sha256:0000000000000000000000000000000000000000000000000000000000000000
ENV WIKI_BUILD_IMAGE_DIGEST=${BUILD_IMAGE_DIGEST}
LABEL org.opencontainers.image.title="PanSphaira local knowledge wiki" \
      org.opencontainers.image.description="Default-off offline MediaWiki mini-dump importer and read-only query service" \
      org.opencontainers.image.source="https://github.com/JoFe2/PANSPHAIRA"

WORKDIR /app
COPY --from=build /build/dist/packages/contracts ./dist/packages/contracts
COPY --from=build /build/dist/packages/local-knowledge ./dist/packages/local-knowledge
COPY entrypoint.sh /usr/local/bin/local-knowledge-wiki
RUN chmod 0555 /usr/local/bin/local-knowledge-wiki \
    && mkdir -p /var/lib/local-knowledge-wiki/canonical /var/lib/local-knowledge-wiki/index \
    && chown -R node:node /var/lib/local-knowledge-wiki

USER node
ENTRYPOINT ["/usr/local/bin/local-knowledge-wiki"]
CMD ["help"]
