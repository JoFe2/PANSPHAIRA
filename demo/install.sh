#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state="$root/.chimpmaera-demo"
config="$state/config.env"
mode="${CM_DEMO_MODE:-}"
profile="${CM_AUTHORITY_PROFILE:-}"
seed="${CM_DEMO_SEED:-}"
requested_project="${CM_DEMO_PROJECT:-}"
run_owner="${CM_DEMO_RUN_OWNER:-}"

fail() {
  printf >&2 'ERROR: %s\n' "$*"
  if declare -F journal_error >/dev/null; then
    journal_error 1 "${BASH_LINENO[0]}" "validation failure"
  fi
  exit 1
}
ask() {
  local prompt="$1" default="$2" value=''
  if [ ! -t 0 ]; then printf '%s' "$default"; return; fi
  read -r -p "$prompt [$default]: " value
  printf '%s' "${value:-$default}"
}
secret() {
  openssl rand -hex 24
}
validate_loopback_binding() {
  local label="$1" binding="$2" port=''
  [[ "$binding" =~ ^127\.0\.0\.1:([0-9]{1,5})$ ]] ||
    fail "$label must use an explicit 127.0.0.1:PORT binding"
  port="${BASH_REMATCH[1]}"
  ((10#$port >= 1 && 10#$port <= 65535)) ||
    fail "$label port must be between 1 and 65535"
}

command -v jq >/dev/null || fail "jq is required"
command -v curl >/dev/null || fail "curl is required"
install -d -m 700 "$state"
# shellcheck source=demo/lib/journal.sh
source "$root/demo/lib/journal.sh"
journal_init
trap 'journal_error "$?" "$LINENO" "$BASH_COMMAND"' ERR
journal_event command_invoked running

existing_mode=''
existing_profile=''
existing_seed=''
existing_project=''
existing_chimp_port=''
existing_espo_port=''
existing_doli_port=''
existing_run_owner=''
if [ -f "$config" ]; then
  existing_mode="$(sed -n 's/^CM_DEMO_MODE=//p' "$config")"
  existing_profile="$(sed -n 's/^CM_AUTHORITY_PROFILE=//p' "$config")"
  existing_seed="$(sed -n 's/^CM_DEMO_SEED=//p' "$config")"
  existing_project="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "$config")"
  existing_chimp_port="$(sed -n 's/^CM_CHIMP_PORT=//p' "$config")"
  existing_espo_port="$(sed -n 's/^CM_ESPO_PORT=//p' "$config")"
  existing_doli_port="$(sed -n 's/^CM_DOLI_PORT=//p' "$config")"
  existing_run_owner="$(sed -n 's/^CM_DEMO_RUN_OWNER=//p' "$config")"
fi

journal_phase_start preflight "$(journal_sha_text "$(uname -s):$(uname -m)")"
[ "$(uname -s)" = Linux ] || fail "Linux is required"
[ "$(uname -m)" = x86_64 ] || fail "Linux x86_64 is required"
command -v docker >/dev/null || fail "docker is required"
docker info >/dev/null 2>&1 || fail "Docker daemon is unavailable"
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required"
command -v openssl >/dev/null || fail "openssl is required"
journal_phase_complete "$(journal_sha_text "$(docker --version):$(docker compose version --short)")"

journal_phase_start selection_resolution "$(journal_sha_text "${mode:-interactive}:${profile:-interactive}:${seed:-interactive}")"
mode="${mode:-$(ask 'Installation: complete or minimal' "${existing_mode:-complete}")}"
profile="${profile:-$(ask 'Authority profile: SAFE_GUIDED or RAMPAGE' "${existing_profile:-SAFE_GUIDED}")}"
seed="${seed:-$(ask 'Seed synthetic business data: yes or no' "${existing_seed:-yes}")}"
project="${requested_project:-${existing_project:-chimpmaera-v01-demo}}"
chimp_port="${CM_CHIMP_PORT:-${existing_chimp_port:-127.0.0.1:7780}}"
espo_port="${CM_ESPO_PORT:-${existing_espo_port:-127.0.0.1:7781}}"
doli_port="${CM_DOLI_PORT:-${existing_doli_port:-127.0.0.1:7782}}"
[ -z "$existing_project" ] || [ "$project" = "$existing_project" ] ||
  fail "existing install belongs to project $existing_project; project drift is denied"
[ -z "$run_owner" ] || [[ "$run_owner" =~ ^pansphaira-e2e-[1-9][0-9]{0,19}-[1-9][0-9]{0,5}$ ]] ||
  fail "CM_DEMO_RUN_OWNER must be an isolated scheduled/release E2E namespace"
[ -z "$run_owner" ] || [ "$run_owner" = "$project" ] ||
  fail "CM_DEMO_RUN_OWNER must equal the Compose project"
[ ! -f "$config" ] || [ "$existing_run_owner" = "$run_owner" ] ||
  fail "existing install run ownership drift is denied"
case "$mode" in complete|minimal) ;; *) fail "mode must be complete or minimal" ;; esac
case "$profile" in
  SAFE_GUIDED) ;;
  RAMPAGE)
    printf >&2 '\nDANGER: RAMPAGE removes PanSphaira approval gates inside this isolated demo only.\n'
    printf >&2 'It does not grant host privileges and services remain loopback-only.\n'
    [ "${CM_RAMPAGE_CONFIRM:-}" = I_UNDERSTAND_LOCAL_DEMO_ONLY ] ||
      fail "set CM_RAMPAGE_CONFIRM=I_UNDERSTAND_LOCAL_DEMO_ONLY to opt in"
    ;;
  *) fail "authority profile must be SAFE_GUIDED or RAMPAGE" ;;
esac
case "$seed" in yes|no) ;; *) fail "seed must be yes or no" ;; esac
validate_loopback_binding CM_CHIMP_PORT "$chimp_port"
validate_loopback_binding CM_ESPO_PORT "$espo_port"
validate_loopback_binding CM_DOLI_PORT "$doli_port"
[ "$chimp_port" != "$espo_port" ] &&
  [ "$chimp_port" != "$doli_port" ] &&
  [ "$espo_port" != "$doli_port" ] ||
  fail "service port bindings must be unique"
case "$profile" in
  SAFE_GUIDED) authority_manifest_id=SAFE_GUIDED-v1 ;;
  RAMPAGE) authority_manifest_id=RAMPAGE-v1 ;;
esac
authority_manifest_sha256="$(
  sha256sum "$root/demo/manifests/authority/$authority_manifest_id.json" |
    cut -d' ' -f1
)"
catalog_manifest_id=crm-erp-playable-v1
catalog_manifest_sha256="$(
  sha256sum "$root/demo/manifests/catalog/$catalog_manifest_id.json" |
    cut -d' ' -f1
)"
admin_ai_policy_id=admin-ai-poc-policy-v1
admin_ai_policy_generation=1
admin_ai_policy_sha256="$(
  sha256sum "$root/demo/manifests/authority/$admin_ai_policy_id.json" |
    cut -d' ' -f1
)"
fixture_manifest_id=panskys-zoo-demo-v1
fixture_manifest_sha256="$(
  sha256sum "$root/demo/manifests/fixtures/$fixture_manifest_id.json" |
    cut -d' ' -f1
)"
egress_policy_manifest_id=local-default-deny-v1
egress_policy_manifest_sha256="$(
  sha256sum "$root/demo/manifests/network/local-egress-policy-v1.json" |
    cut -d' ' -f1
)"

selection="$(printf '%s\n' "mode=$mode" "profile=$profile" "seed=$seed" "dms=off" | sha256sum | cut -d' ' -f1)"
journal_phase_complete "$selection"

journal_phase_start state_materialization "$selection"
install -d -m 700 "$state/secrets" "$state/public"
if [ -f "$config" ]; then
  # Warm replay preserves credentials and rejects silent configuration drift.
  old="$(sed -n 's/^CM_SELECTION_SHA256=//p' "$config")"
else
  old=''
  umask 077
  secret > "$state/secrets/espo-db-root"
  secret > "$state/secrets/espo-db"
  secret > "$state/secrets/espo-admin"
  secret > "$state/secrets/doli-db-root"
  secret > "$state/secrets/doli-db"
  secret > "$state/secrets/doli-admin"
fi
if [ ! -s "$state/secrets/doli-api-key" ]; then
  umask 077
  secret > "$state/secrets/doli-api-key"
fi
if [ ! -s "$state/secrets/chimp-api-token" ]; then
  umask 077
  secret > "$state/secrets/chimp-api-token"
fi
if [ ! -s "$state/secrets/chimp-control-token" ]; then
  umask 077
  secret > "$state/secrets/chimp-control-token"
fi
chmod 0644 \
  "$state/secrets/chimp-api-token" \
  "$state/secrets/chimp-control-token" \
  "$state/secrets/espo-admin" \
  "$state/secrets/doli-api-key"
for persona in panskys.owner panskys.sales panskys.finance; do
  for provider in espo doli; do
    if [ ! -s "$state/secrets/$provider-$persona" ]; then
      umask 077
      secret > "$state/secrets/$provider-$persona"
    fi
  done
done

[ -z "$old" ] || [ "$old" = "$selection" ] ||
  fail "existing install has different selections; run demo/uninstall.sh --purge first"
journal_phase_complete "$(journal_sha_text "$selection:owned-state-v1")"

journal_phase_start runtime_image_materialization "$(journal_sha_text "$(
  {
    sha256sum "$root/package.json" "$root/package-lock.json"
    find "$root/packages" -type f -name '*.ts' -print0 |
      sort -z | xargs -0 sha256sum
    sha256sum \
      "$root/examples/poc-release/showcase-v1.json" \
      "$root/demo/chimpmaera.Dockerfile" \
      "$root/demo/tsconfig.runtime.json" \
      "$root/demo/runtime/server.mjs" \
      "$root/demo/runtime/enforcement-gate.mjs" \
      "$root/demo/runtime/admin-ai-poc.mjs" \
      "$root/demo/runtime/admin-ai-policy.mjs" \
      "$root/demo/runtime/authoritative-approval-snapshot.mjs" \
      "$root/demo/runtime/policy-evaluator.mjs" \
      "$root/demo/runtime/paperless-ngx-zoo-adapter.mjs" \
      "$root/demo/runtime/approval-workbench.mjs"
    find "$root/demo/manifests" -type f -name '*.json' -print0 |
      sort -z | xargs -0 sha256sum
  } | sha256sum | cut -d' ' -f1
)")"
run_owner_label_args=()
if [ -n "$run_owner" ]; then
  run_owner_label_args=(--label "io.chimpmaera.demo.run-owner=$run_owner")
fi
docker build \
  --file "$root/demo/chimpmaera.Dockerfile" \
  --provenance=false \
  "${run_owner_label_args[@]}" \
  --tag chimpmaera/v01-runtime:local \
  "$root"
chimp_image="$(
  docker image inspect chimpmaera/v01-runtime:local \
    --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{else}}{{.Id}}{{end}}'
)"
case "$chimp_image" in
  chimpmaera/v01-runtime@sha256:*|sha256:*) ;;
  *) fail "runtime build did not return an immutable image reference" ;;
esac
journal_phase_complete "${chimp_image##*@sha256:}"

journal_phase_start configuration_materialization "$(journal_sha_text "$selection:$chimp_image")"
config_tmp="$(mktemp "$state/.config.env.XXXXXX")"
cat > "$config_tmp" <<EOF
COMPOSE_PROJECT_NAME=$project
CM_DEMO_RUN_OWNER=$run_owner
CM_DEMO_MODE=$mode
CM_AUTHORITY_PROFILE=$profile
CM_DEMO_SEED=$seed
CM_DMS=off
CM_SELECTION_SHA256=$selection
CM_AUTHORITY_MANIFEST_ID=$authority_manifest_id
CM_AUTHORITY_MANIFEST_SHA256=$authority_manifest_sha256
CM_CATALOG_MANIFEST_ID=$catalog_manifest_id
CM_CATALOG_MANIFEST_SHA256=$catalog_manifest_sha256
CM_ADMIN_AI_POLICY_ID=$admin_ai_policy_id
CM_ADMIN_AI_POLICY_GENERATION=$admin_ai_policy_generation
CM_ADMIN_AI_POLICY_SHA256=$admin_ai_policy_sha256
CM_FIXTURE_MANIFEST_ID=$fixture_manifest_id
CM_FIXTURE_MANIFEST_SHA256=$fixture_manifest_sha256
CM_EGRESS_POLICY_MANIFEST_ID=$egress_policy_manifest_id
CM_EGRESS_POLICY_MANIFEST_SHA256=$egress_policy_manifest_sha256
CM_CHIMP_PORT=$chimp_port
CM_ESPO_PORT=$espo_port
CM_DOLI_PORT=$doli_port
CM_CHIMP_IMAGE=$chimp_image
EOF
chmod 600 "$config_tmp"
mv -f "$config_tmp" "$config"

public_config_tmp="$(mktemp "$state/public/.config.json.XXXXXX")"
cat > "$public_config_tmp" <<EOF
{"schemaVersion":"chimpmaera.demo/config/v1","mode":"$mode","authorityProfile":"$profile","authorityManifest":{"id":"$authority_manifest_id","sha256":"$authority_manifest_sha256"},"catalogManifest":{"id":"$catalog_manifest_id","sha256":"$catalog_manifest_sha256"},"fixtureManifest":{"id":"$fixture_manifest_id","sha256":"$fixture_manifest_sha256"},"egressPolicyManifest":{"id":"$egress_policy_manifest_id","sha256":"$egress_policy_manifest_sha256","mode":"disabled"},"seed":"$seed","dms":"off","selectionSha256":"$selection"}
EOF
chmod 600 "$public_config_tmp"
mv -f "$public_config_tmp" "$state/public/config.json"
journal_phase_complete "$(journal_sha_text "$(journal_file_sha "$config"):$(journal_file_sha "$state/public/config.json")")"

journal_phase_start service_convergence "$(journal_sha_text "$selection:$chimp_image:$(journal_file_sha "$root/demo/compose.yaml")")"
docker compose --env-file "$config" -f "$root/demo/compose.yaml" up -d --wait
journal_phase_complete "$(docker compose --env-file "$config" -f "$root/demo/compose.yaml" ps --format json | jq -sc 'sort_by(.Service)|map({service:.Service,state:.State,health:.Health})' | sha256sum | cut -d' ' -f1)"

journal_phase_start provider_bootstrap_auth "$(journal_sha_text "$selection:$(journal_file_sha "$root/demo/provider-bootstrap.sh")")"
"$root/demo/provider-bootstrap.sh" "$state/public/provider-bootstrap.json"
provider_bootstrap_digest="$(journal_file_sha "$state/public/provider-bootstrap.json")"
journal_phase_complete "$provider_bootstrap_digest"

journal_phase_start identity_role_mapping "$(journal_sha_text "$selection:$(journal_file_sha "$root/demo/identity-bootstrap.sh"):$(journal_file_sha "$root/demo/manifests/identity/panskys-zoo-v1.json")")"
"$root/demo/identity-bootstrap.sh" "$state/public/identity-bootstrap.json"
identity_bootstrap_digest="$(journal_file_sha "$state/public/identity-bootstrap.json")"
journal_phase_complete "$identity_bootstrap_digest"

journal_phase_start catalog_materialization "$(journal_sha_text "$selection:$(journal_file_sha "$root/demo/catalog-bootstrap.sh"):$catalog_manifest_sha256")"
"$root/demo/catalog-bootstrap.sh" "$state/public/catalog-bootstrap.json"
catalog_bootstrap_digest="$(journal_file_sha "$state/public/catalog-bootstrap.json")"
journal_phase_complete "$catalog_bootstrap_digest"

journal_phase_start seed_and_governed_flow "$(journal_sha_text "$selection:$(journal_file_sha "$root/demo/seed-and-flow.sh"):$fixture_manifest_sha256")"
"$root/demo/seed-and-flow.sh" "$state/public/seed-and-flow.json"
seed_flow_digest="$(journal_file_sha "$state/public/seed-and-flow.json")"
journal_phase_complete "$seed_flow_digest"

journal_phase_start semantic_readback "$(journal_sha_text "$selection:$(journal_file_sha "$root/demo/readback.sh")")"
"$root/demo/readback.sh" > "$state/readback.json"
readback_digest="$(journal_file_sha "$state/readback.json")"
journal_phase_complete "$readback_digest"
journal_event acceptance_evaluated completed "READY_VERIFIED_SINGLE_RUN"
journal_finish READY_VERIFIED "$readback_digest"
duration_ms="$(( $(journal_mono_ms) - CM_RUN_STARTED_MONO_MS ))"

printf '\nPanSphaira demo is READY_VERIFIED for this selected run in %dms.\n' "$duration_ms"
printf 'This verifies only the selected local demo run; publication remains a separate owner-controlled action.\n'
printf '  PanSphaira: http://127.0.0.1:7780\n'
printf '  Control token for guided actions: .chimpmaera-demo/secrets/chimp-api-token\n'
printf '  EspoCRM:    http://127.0.0.1:7781 (admin; password in .chimpmaera-demo/secrets/espo-admin)\n'
printf '  Dolibarr:   http://127.0.0.1:7782 (admin; password in .chimpmaera-demo/secrets/doli-admin)\n'
printf '  Readback:   %s\n' "$state/readback.json"
printf '  Journal:    %s\n' "$CM_RUN_DIR/summary.json"
printf '  Cleanup:    ./demo/uninstall.sh --purge\n'
