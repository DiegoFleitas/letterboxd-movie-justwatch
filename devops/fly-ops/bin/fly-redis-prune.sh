#!/usr/bin/env bash
# Destroy Upstash Redis DBs on Fly for every name not in the --keep list (default: movie-justwatch-redis).
# **Irreversible.** Default is dry-run only; use --execute --yes to actually run fly redis destroy.

set -euo pipefail

SCRIPT_NAME=$(basename "$0")
ORG_ARG=""
DRY_RUN=1
AUTO_YES=0
declare -a KEEP_NAMES=()

usage() {
  cat <<EOF
Usage: $SCRIPT_NAME [--keep NAME] ... [-o|--org SLUG] [--execute] [--yes] [--dry-run]

  Removes stale Fly Upstash Redis databases, keeping one or more names you still use.

  Default keep: movie-justwatch-redis

  By default prints what would be destroyed (dry-run). To destroy for real:
    $SCRIPT_NAME --execute --yes

  --keep NAME     Keep this database (repeatable). Merged with defaults unless --no-default-keep.
  --no-default-keep   Only keep names you pass with --keep.
  -o, --org SLUG  Fly org (default: \$FLY_ORG or inferred from fly apps list)
  --execute       Run fly redis destroy for names outside the keep set
  --yes           Skip destroy confirmation (required with --execute; same as fly redis destroy -y)
  --dry-run       Only list actions (default)

  Destruction is permanent. Double-check app secrets still point at a kept Redis.
EOF
}

NO_DEFAULT_KEEP=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep)
      [[ ${2+x} ]] || { echo "missing value for --keep" >&2; exit 1; }
      KEEP_NAMES+=("$2")
      shift 2
      ;;
    --no-default-keep) NO_DEFAULT_KEEP=1; shift ;;
    -o|--org)
      [[ ${2+x} ]] || { echo "missing value for $1" >&2; exit 1; }
      ORG_ARG="$2"
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
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: required command not found: $1" >&2
    exit 1
  }
}

need_cmd fly
need_cmd jq

if [[ "$NO_DEFAULT_KEEP" -eq 0 ]]; then
  DEFAULT_KEEP=(movie-justwatch-redis)
else
  DEFAULT_KEEP=()
fi

declare -a ALL_KEEP=("${DEFAULT_KEEP[@]}" "${KEEP_NAMES[@]}")

is_kept() {
  local n="$1"
  local k
  for k in "${ALL_KEEP[@]}"; do
    [[ -n "$k" && "$n" == "$k" ]] && return 0
  done
  return 1
}

ORG="${ORG_ARG:-${FLY_ORG:-}}"
if [[ -z "$ORG" ]]; then
  ORG=$(fly apps list --json | jq -r '
    [.[].Organization.Slug] | map(select(. != null and . != "")) | unique | .[0] // empty
  ')
fi

# fly redis list: first column is tab-delimited NAME (no --json in current flyctl).
REDIS_LIST_ARGS=()
if [[ -n "$ORG" ]]; then
  REDIS_LIST_ARGS+=(-o "$ORG")
fi
if ! REDIS_TABLE_OUT=$(fly redis list "${REDIS_LIST_ARGS[@]}") 2>&1; then
  echo "error: fly redis list failed:" >&2
  echo "$REDIS_TABLE_OUT" >&2
  exit 1
fi

mapfile -t DB_NAMES < <(echo "$REDIS_TABLE_OUT" | awk -F'\t' 'NR > 1 && $1 != "" {
  gsub(/^[[:space:]]+|[[:space:]]+$/, "", $1)
  if ($1 != "") print $1
}')

if [[ ${#DB_NAMES[@]} -eq 0 ]]; then
  echo "No Redis databases returned; nothing to do."
  exit 0
fi

declare -a TO_DESTROY=()
for n in "${DB_NAMES[@]}"; do
  if is_kept "$n"; then
    continue
  fi
  TO_DESTROY+=("$n")
done

echo "Org: ${ORG:-<default>}"
echo "Keeping (${#ALL_KEEP[@]}): ${ALL_KEEP[*]}"
echo "Found (${#DB_NAMES[@]}): ${DB_NAMES[*]}"
echo ""

if [[ ${#TO_DESTROY[@]} -eq 0 ]]; then
  echo "Nothing to prune (all listed DBs are in the keep set)."
  exit 0
fi

echo "Will DESTROY (${#TO_DESTROY[@]}): ${TO_DESTROY[*]}"
echo ""

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry-run only. To destroy for real:"
  echo "  $SCRIPT_NAME --execute --yes${ORG_ARG:+ --org $ORG_ARG}"
  echo "  Use --keep NAME for each extra database that must be preserved."
  exit 0
fi

if [[ "$AUTO_YES" -ne 1 ]]; then
  echo "error: --execute requires --yes (matches fly redis destroy safety)." >&2
  exit 1
fi

for n in "${TO_DESTROY[@]}"; do
  echo ">>> fly redis destroy $n -y"
  fly redis destroy "$n" -y
done

echo "Done."
