#!/usr/bin/env bash
if [[ -z "${BASH_VERSION:-}" ]]; then
  exec /usr/bin/env bash "$0" "$@"
fi
set -euo pipefail

APP="${1:-}"
ACTION="${2:-inspect}"   # inspect | restart | scale
SCALE_COUNT="${3:-2}"

if [[ -z "$APP" ]]; then
  echo "usage: $0 <app-name> [inspect|restart|scale] [scale-count]"
  exit 1
fi

echo "== app: $APP =="
echo

# 1. list machines (json for parsing)
echo "== machines list =="
MACHINES_JSON=$(fly machines list -a "$APP" --json)
echo "$MACHINES_JSON" | jq -r '.[] | "\(.id) \(.state) \(.region)"'
echo

# 2. find machines with leases
echo "== checking leases =="
LEASED_IDS=()

for ID in $(echo "$MACHINES_JSON" | jq -r '.[].id'); do
  # fly machines status has no --json; leases view returns lease JSON (-j).
  if ! STATUS=$(fly machines leases view "$ID" -a "$APP" -j 2>/dev/null); then
    continue
  fi

  LEASE_OWNER=$(echo "$STATUS" | jq -r '(.lease.owner // .owner) // empty')
  LEASE_EXP=$(echo "$STATUS" | jq -r '(.lease.expires_at // .expires_at) // empty')

  if [[ -n "$LEASE_OWNER" ]]; then
    echo "machine $ID leased by $LEASE_OWNER until $LEASE_EXP"
    LEASED_IDS+=("$ID")
  fi
done

if [[ ${#LEASED_IDS[@]} -eq 0 ]]; then
  echo "no active leases"
fi
echo

# 3. action handlers
case "$ACTION" in
  inspect)
    echo "inspect only (no changes)"
    ;;

  restart)
    echo "== restarting leased machines =="
    for ID in "${LEASED_IDS[@]}"; do
      echo "restarting $ID"
      fly machines restart "$ID" -a "$APP"
    done
    ;;

  scale)
    echo "== scaling app to $SCALE_COUNT machines =="
    fly scale count "$SCALE_COUNT" -a "$APP"
    ;;

  *)
    echo "unknown action: $ACTION"
    exit 1
    ;;
esac

echo
echo "== recent logs =="
fly logs -a "$APP" --no-tail | tail -n 50