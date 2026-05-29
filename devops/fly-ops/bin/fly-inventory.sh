#!/usr/bin/env bash
# Fly.io inventory: apps, machines, volumes, org Redis list, cost estimates.
# Requires: fly (flyctl), jq
set -euo pipefail

ACTIVAS_ONLY=0
VOLUME_RISK=0
OUTPUT_JSON=0
COST_ESTIMATE=0
ORG_OVERRIDE=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --activas-only    Only machines in started|running
  --volume-risk     Flag volumes likely unused (no attach or attached VM not running)
  --json            Output JSON (machine-readable)
  --cost            Print cost estimates (implies --json)
  -o, --org SLUG    Fly org slug (default: \$FLY_ORG or inferred)
  -h, --help        Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --activas-only) ACTIVAS_ONLY=1 ;;
    --volume-risk)  VOLUME_RISK=1 ;;
    --json)         OUTPUT_JSON=1 ;;
    --cost)         COST_ESTIMATE=1; OUTPUT_JSON=1 ;;
    -o|--org)
      [[ ${2+x} ]] || { echo "missing value for $1" >&2; exit 1; }
      ORG_OVERRIDE="$2"
      shift
      ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
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

# Check authentication before proceeding
if ! fly auth whoami &>/dev/null; then
  echo "error: flyctl is not authenticated. Run 'fly auth login' first." >&2
  if [[ "$OUTPUT_JSON" -eq 1 ]]; then
    jq -n '{org: "", generated_at: now, apps: [], summary: {total_apps: 0, total_machines: 0, total_volumes: 0, total_ram_mb: 0, total_cpus: 0, running_machines: 0, stopped_machines: 0}, error: "flyctl not authenticated"}'
  fi
  exit 1
fi

# Pricing constants
SHARED_HOURLY_PER_256MB=0.00125
VOLUME_MONTHLY_PER_GB=0.15
REDIS_PAYG_MONTHLY=5.00

# === Gather data ===
if ! APPS_JSON=$(fly apps list --json 2>&1); then
  echo "error: fly apps list --json failed (see stderr)" >&2
  exit 1
fi

if ! echo "$APPS_JSON" | jq -e 'type == "array"' >/dev/null 2>&1; then
  echo "error: apps JSON is not an array" >&2
  echo "$APPS_JSON" >&2
  exit 1
fi

ORG_SLUG="${ORG_OVERRIDE:-${FLY_ORG:-}}"
if [[ -z "$ORG_SLUG" ]]; then
  ORG_SLUG=$(echo "$APPS_JSON" | jq -r '
    [.[].Organization.Slug] | map(select(. != null and . != "")) | unique | .[0] // empty
  ')
fi

# === Machine/volume display helpers ===
machine_lines_fixed() {
  local json="$1"
  if [[ "$ACTIVAS_ONLY" -eq 1 ]]; then
    echo "$json" | jq -r '
      map(select(.state == "started" or .state == "running"))
      | if length == 0 then
          "  (no started|running machines)"
        else
          .[] | "  id=\(.id) region=\(.region) state=\(.state) ram=\(.config.guest.memory_mb)MB cpus=\(.config.guest.cpus)"
        end
    '
  else
    echo "$json" | jq -r '
      if length == 0 then
        "  (no machines)"
      else
        .[] | "  id=\(.id) region=\(.region) state=\(.state) ram=\(.config.guest.memory_mb)MB cpus=\(.config.guest.cpus)"
      end
    '
  fi
}

volume_lines() {
  local json="$1"
  local mach_json="$2"
  echo "$json" | jq -c '.[]?' 2>/dev/null | while read -r vol; do
    [[ -n "$vol" ]] || continue
    local id name region zone size state attached
    id=$(echo "$vol" | jq -r '.id // .ID // "?"')
    name=$(echo "$vol" | jq -r '.name // .Name // "?"')
    region=$(echo "$vol" | jq -r '.region // .Region // "?"')
    zone=$(echo "$vol" | jq -r '.zone // .Zone // "—"')
    size=$(echo "$vol" | jq -r '.sizeGb // .size_gb // .SizeGB // "?"')
    state=$(echo "$vol" | jq -r '.state // .State // "?"')
    attached=$(echo "$vol" | jq -r '
      .attachedMachine.id // .attachedMachineId // .attached_machine_id
      // .AttachedMachine.ID // .AttachedMachineId // empty
    ')
    echo "  id=$id name=$name region=$region zone=$zone size_gb=$size state=$state attached_machine=${attached:-—}"
    if [[ "$VOLUME_RISK" -eq 1 ]]; then
      if [[ -z "$attached" || "$attached" == "null" ]]; then
        echo "    [volume-risk] no attached machine id in API response"
      else
        local mstate
        mstate=$(echo "$mach_json" | jq -r --arg mid "$attached" '
          [.[]? | select(.id == $mid) | .state] | first // empty
        ')
        if [[ -z "$mstate" ]]; then
          echo "    [volume-risk] attached id $attached not present in machine list"
        elif [[ "$mstate" != "started" && "$mstate" != "running" ]]; then
          echo "    [volume-risk] attached machine state=$mstate (not started|running)"
        fi
      fi
    fi
  done
  if ! echo "$json" | jq -e 'length > 0' >/dev/null 2>&1; then
    echo "  (no volumes)"
  fi
}

# === Main processing ===
if [[ "$OUTPUT_JSON" -eq 1 ]]; then
  # JSON mode: collect objects in a temp file
  TMPFILE=$(mktemp /tmp/fly-inventory-XXXXXX)
  trap 'rm -f "$TMPFILE"' EXIT
fi

echo "$APPS_JSON" | jq -c '.[]' | while read -r row; do
  app=$(echo "$row" | jq -r '.Name // .name // empty')
  [[ -n "$app" ]] || continue
  status=$(echo "$row" | jq -r '.Status // .status // "—"')
  org_slug=$(echo "$row" | jq -r '.Organization.Slug // ""')

  if [[ "$OUTPUT_JSON" -eq 0 ]]; then
    echo "=== ${app} (app status: ${status}) ==="
  fi

  # Machines
  if ! mach_out=$(fly machines list -a "$app" --json 2>&1); then
    if [[ "$OUTPUT_JSON" -eq 0 ]]; then
      echo "  (error: fly machines list)" >&2
    fi
    mach_json="[]"
  else
    mach_json="$mach_out"
    if ! echo "$mach_json" | jq -e 'type == "array"' >/dev/null 2>&1; then
      mach_json="[]"
    fi
  fi

  if [[ "$OUTPUT_JSON" -eq 0 ]]; then
    echo "-- Machines --"
    if echo "$mach_json" | jq -e 'length == 0' >/dev/null 2>&1; then
      echo "  (no machines)"
    else
      machine_lines_fixed "$mach_json"
    fi
  fi

  # Volumes
  if ! vol_out=$(fly volumes list -a "$app" -j 2>&1); then
    if [[ "$OUTPUT_JSON" -eq 0 ]]; then
      echo "  (error: fly volumes list)" >&2
    fi
    vol_json="[]"
  else
    vol_json="$vol_out"
    if ! echo "$vol_json" | jq -e 'type == "array"' >/dev/null 2>&1; then
      vol_json="[]"
    fi
  fi

  if [[ "$OUTPUT_JSON" -eq 0 ]]; then
    echo "-- Volumes --"
    if echo "$vol_json" | jq -e 'length == 0' >/dev/null 2>&1; then
      echo "  (no volumes)"
    else
      volume_lines "$vol_json" "$mach_json"
    fi
    echo ""
  fi

  # Build JSON object for this app
  if [[ "$OUTPUT_JSON" -eq 1 ]]; then
    app_json=$(jq -n \
      --arg app "$app" \
      --arg status "$status" \
      --arg org "$org_slug" \
      --argjson machines "$(echo "$mach_json" | jq '[.[] | {
        id: .id,
        region: .region,
        state: .state,
        ram_mb: .config.guest.memory_mb,
        cpus: .config.guest.cpus
      }]')" \
      --argjson volumes "$(echo "$vol_json" | jq '[.[] | {
        id: (.id // .ID // "?"),
        name: (.name // .Name // "?"),
        region: (.region // .Region // "?"),
        size_gb: (.sizeGb // .size_gb // .SizeGB // 0),
        state: (.state // .State // "?"),
        attached_machine_id: (.attachedMachine.id // .attachedMachineId // .attached_machine_id // .AttachedMachine.ID // null)
      }]')" \
      '{app: $app, status: $status, org: $org, machines: $machines, volumes: $volumes}'
    )
    # Collect into temp file (append)
    echo "$app_json" >> "$TMPFILE"
  fi
done

# === Redis list ===
if [[ "$OUTPUT_JSON" -eq 0 ]]; then
  echo "=== Upstash Redis (org) ==="
  if [[ -n "$ORG_SLUG" ]]; then
    fly redis list -o "$ORG_SLUG" 2>&1 || fly redis list 2>&1 || true
  else
    fly redis list 2>&1 || true
  fi

  if [[ "$VOLUME_RISK" -eq 1 ]]; then
    echo ""
    echo "Note: [volume-risk] is heuristic — confirm in dashboard before: fly volumes destroy <id> -a <app> (irreversible)."
  fi
fi

# === JSON output ===
if [[ "$OUTPUT_JSON" -eq 1 ]]; then
  APPS_JSON_OUT=$(jq -s '.' "$TMPFILE" 2>/dev/null || echo "[]")

  SUMMARY=$(echo "$APPS_JSON_OUT" | jq '{
    total_apps: length,
    total_machines: ([.[].machines[]] | length),
    total_volumes: ([.[].volumes[]] | length),
    total_ram_mb: ([.[].machines[].ram_mb] | add // 0),
    total_cpus: ([.[].machines[].cpus] | add // 0),
    running_machines: ([.[].machines[] | select(.state == "started" or .state == "running")] | length),
    stopped_machines: ([.[].machines[] | select(.state != "started" and .state != "running")] | length)
  }')

  # Cost estimation
  if [[ "$COST_ESTIMATE" -eq 1 ]]; then
    VM_COST=$(echo "$APPS_JSON_OUT" | jq '
      [.[].machines[] | select(.state == "started" or .state == "running") |
      (.ram_mb / 256 * 0.00125 * 730)]
    ' | jq 'add // 0')
    VOL_COST=$(echo "$APPS_JSON_OUT" | jq '
      [.[].volumes[] | (.size_gb // 0) * 0.15]
    ' | jq 'add // 0')

    COST_EST=$(jq -n \
      --argjson vm "$VM_COST" \
      --argjson vol "$VOL_COST" \
      --argjson redis "$REDIS_PAYG_MONTHLY" \
      '{
        estimated_monthly_cost: {
          vms: $vm,
          volumes: $vol,
          redis: $redis,
          total: ($vm + $vol + $redis)
        }
      }'
    )
    SUMMARY=$(echo "$SUMMARY $COST_EST" | jq -s 'add')
  fi

  jq -n \
    --arg org "${ORG_SLUG:-unknown}" \
    --argjson apps "$APPS_JSON_OUT" \
    --argjson summary "$SUMMARY" \
    '{org: $org, generated_at: now, apps: $apps, summary: $summary}'
fi

if [[ "$COST_ESTIMATE" -eq 1 && "$OUTPUT_JSON" -eq 1 ]]; then
  TOTAL_EST=$(echo "$SUMMARY" | jq -r '.estimated_monthly_cost.total // "?"')
  echo "Cost estimate: ~\$${TOTAL_EST}/mo (all apps)" >&2
fi
