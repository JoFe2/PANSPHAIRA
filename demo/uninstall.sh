#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state="$root/.chimpmaera-demo"
config="$state/config.env"
[ -f "$config" ] || { printf 'No owned installation exists.\n'; exit 0; }
docker compose --env-file "$config" -f "$root/demo/compose.yaml" down --remove-orphans \
  ${1:+--volumes}
if [ "${1:-}" = --purge ]; then
  image_ref="$(sed -n 's/^CM_CHIMP_IMAGE=//p' "$config")"
  run_owner="$(sed -n 's/^CM_DEMO_RUN_OWNER=//p' "$config")"
  image_id=''
  if [ -n "$image_ref" ]; then
    image_id="$(docker image inspect "$image_ref" --format '{{.Id}}' 2>/dev/null || true)"
  fi
  if [ -n "$image_id" ]; then
    owner="$(
      docker image inspect "$image_id" \
        --format '{{index .Config.Labels "io.chimpmaera.demo.owner"}}'
    )"
    [ "$owner" = chimpmaera-v01-playable-installer ] || {
      printf >&2 'Refusing to remove runtime image without the installer ownership label.\n'
      exit 1
    }
    if [ -n "$run_owner" ]; then
      observed_run_owner="$(
        docker image inspect "$image_id" \
          --format '{{index .Config.Labels "io.chimpmaera.demo.run-owner"}}'
      )"
      [ "$observed_run_owner" = "$run_owner" ] || {
        printf >&2 'Refusing to remove runtime image without exact run ownership.\n'
        exit 1
      }
    fi
    tag_id="$(
      docker image inspect chimpmaera/v01-runtime:local \
        --format '{{.Id}}' 2>/dev/null || true
    )"
    if [ "$tag_id" = "$image_id" ]; then
      docker image rm chimpmaera/v01-runtime:local >/dev/null
    fi
    if docker image inspect "$image_ref" >/dev/null 2>&1; then
      docker image rm "$image_ref" >/dev/null
    fi
    if docker image inspect "$image_id" >/dev/null 2>&1; then
      docker image rm "$image_id" >/dev/null
    fi
  fi
  find "$state/secrets" -type f -exec shred -u {} + 2>/dev/null || true
  rm -rf -- "$state"
fi
printf 'Owned PanSphaira demo resources removed%s.\n' "$([ "${1:-}" = --purge ] && printf ' including state' || true)"
