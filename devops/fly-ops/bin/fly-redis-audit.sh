#!/usr/bin/env bash
# Read-only Redis audit: help, org list, per-DB status when --json is supported.
# Plan change stays manual: fly redis update <name> (interactive prompts).

set -euo pipefail

need_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "error: required command not found: $cmd" >&2
    exit 1
  }
}

need_cmd fly
need_cmd jq

ORG=${FLY_ORG:-}
if [[ -z "$ORG" ]]; then
  ORG=$(fly apps list --json | jq -r '
    [.[].Organization.Slug] | map(select(. != null and . != "")) | unique | .[0] // empty
  ')
fi

echo "=== fly redis update --help ==="
fly redis update --help || true
echo ""

echo "=== fly redis list ==="
if [[ -n "$ORG" ]]; then
  fly redis list -o "$ORG" || fly redis list || true
else
  fly redis list || true
fi
echo ""

RJ=$(fly redis list --json 2>/dev/null || true)
if echo "$RJ" | jq -e 'type == "array" and length > 0' >/dev/null 2>&1; then
  echo "=== fly redis status (per database) ==="
  echo "$RJ" | jq -r '.[] | .name // .Name // empty' | while read -r db; do
    [[ -z "$db" ]] && continue
    echo "--- $db ---"
    fly redis status "$db" || true
    echo ""
  done
else
  echo "Note: no JSON from 'fly redis list --json'. For each NAME in the table above run:"
  echo "  fly redis status NAME"
fi

echo ""
echo "Plan changes are interactive: fly redis update <name>"
echo "Fixed → PAYG helps mainly at low Redis command volume; queue-heavy workloads may cost more on PAYG (Fly Upstash docs)."
