#!/usr/bin/env bash
# List or destroy Fly **unattached** volumes (no machine bound). **Irreversible.**
# Default: dry-run. Matching fly redis-prune safety: --execute --yes to destroy.

set -euo pipefail

SCRIPT_NAME=$(basename "$0")
DRY_RUN=1
AUTO_YES=0
declare -a APP_FILTER=()

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [-a|--app NAME] ... [--execute] [--yes] [--dry-run] [-h|--help]

  Finds volumes where attached_machine_id is empty (dashboard \"unattached\").
  Optionally runs: fly volumes destroy <id> -a <app> -y

  With no --app, processes every app from \`fly apps list --json\`.

  By default prints only (dry-run). To destroy:
    $SCRIPT_NAME --execute --yes
    $SCRIPT_NAME -a bold-feather-1773 --execute --yes

  -a, --app   Limit to one or more apps (repeatable)
  --execute   Run fly volumes destroy for each unattached volume
  --yes       Required with --execute

  Does **not** destroy volumes still bound to a machine (even if stopped); remove or
  destroy the machine first (see fly-inventory.sh --volume-risk).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--app)
      [[ ${2+x} ]] || { echo "missing value for $1" >&2; exit 1; }
      APP_FILTER+=("$2")
      shift 2
      ;;
    --execute) DRY_RUN=0; shift ;;
    --yes)     AUTO_YES=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

need_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "error: required command not found: $cmd" >&2
    exit 1
  }
}

need_cmd fly
need_cmd jq

if [[ ${#APP_FILTER[@]} -eq 0 ]]; then
  if ! APPS_JSON=$(fly apps list --json); then
    echo "error: fly apps list --json failed" >&2
    exit 1
  fi
  mapfile -t APP_FILTER < <(echo "$APPS_JSON" | jq -r '.[] | .Name // .name // empty' | grep -v '^$' || true)
fi

if [[ ${#APP_FILTER[@]} -eq 0 ]]; then
  echo "No apps to scan."
  exit 0
fi

declare -a DESTROY_LINES=()

for app in "${APP_FILTER[@]}"; do
  [[ -n "$app" ]] || continue
  if ! vol_json=$(fly volumes list -a "$app" -j 2>&1); then
    echo "warn: fly volumes list failed for $app: $vol_json" >&2
    continue
  fi
  if ! echo "$vol_json" | jq -e 'type == "array"' >/dev/null 2>&1; then
    echo "warn: unexpected volumes JSON for $app" >&2
    continue
  fi

  while IFS= read -r row; do
    [[ -n "$row" ]] || continue
    vid=$(echo "$row" | jq -r '.id // .ID // empty')
    vname=$(echo "$row" | jq -r '.name // .Name // "?"')
    region=$(echo "$row" | jq -r '.region // .Region // "?"')
    attach=$(echo "$row" | jq -r '.attached_machine_id // .attachedMachineId // empty')
    if [[ -n "$attach" && "$attach" != "null" ]]; then
      continue
    fi
    echo "UNATTACHED  app=$app  id=$vid  name=$vname  region=$region"
    DESTROY_LINES+=("$app|$vid")
  done < <(echo "$vol_json" | jq -c '.[]?')
done

if [[ ${#DESTROY_LINES[@]} -eq 0 ]]; then
  echo ""
  echo "No unattached volumes found."
  exit 0
fi

echo ""
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry-run only (${#DESTROY_LINES[@]} volume(s)). To destroy, same scope +:"
  echo "  $SCRIPT_NAME --execute --yes"
  echo "Restrict with repeated -a <app> before --execute."
  exit 0
fi

if [[ "$AUTO_YES" -ne 1 ]]; then
  echo "error: --execute requires --yes" >&2
  exit 1
fi

for line in "${DESTROY_LINES[@]}"; do
  app="${line%%|*}"
  vid="${line#*|}"
  echo ">>> fly volumes destroy $vid -a $app -y"
  fly volumes destroy "$vid" -a "$app" -y
done

echo "Done."
