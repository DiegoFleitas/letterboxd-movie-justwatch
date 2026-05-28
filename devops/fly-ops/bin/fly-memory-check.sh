#!/usr/bin/env bash
# Show [[vm]] memory from an app fly.toml and reminders to align CLI + file after scaling.
# Resolution order: -f/--file, $FLY_TOML, ./fly.toml (cwd), legacy ../fly.toml next to repo root if script sat under app-repo/bin/.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TOML_ARG=""

usage() {
  echo "Usage: $(basename "$0") [-f|--file PATH] [-h|--help]"
  echo ""
  echo "Resolves fly.toml in order:"
  echo "  1) -f / --file PATH"
  echo "  2) env FLY_TOML"
  echo "  3) \$PWD/fly.toml"
  echo "  4) legacy: \$(dirname \$SCRIPT_DIR)/fly.toml (one level above bin/)"
  echo ""
  echo "Examples:"
  echo "  cd /path/to/my-app && PATH=\"\$HOME/.fly/bin:\$PATH\" /path/to/fly-ops/bin/fly-memory-check.sh -f fly.toml"
  echo "  FLY_TOML=/path/to/my-app/fly.toml fly-memory-check.sh"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--file)
      [[ ${2+x} ]] || { echo "missing value for $1" >&2; exit 1; }
      TOML_ARG="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

resolve_toml() {
  local path=""
  if [[ -n "$TOML_ARG" ]]; then
    path="$TOML_ARG"
  elif [[ -n "${FLY_TOML:-}" ]]; then
    path="$FLY_TOML"
  elif [[ -f "${PWD}/fly.toml" ]]; then
    path="${PWD}/fly.toml"
  else
    local legacy
    legacy="$(cd "$SCRIPT_DIR/.." && pwd)/fly.toml"
    if [[ -f "$legacy" ]]; then
      path="$legacy"
    fi
  fi

  if [[ -z "$path" ]]; then
    return 1
  fi
  # normalize to absolute if readlink exists
  if command -v realpath >/dev/null 2>&1; then
    realpath "$path" 2>/dev/null || echo "$path"
  else
    echo "$path"
  fi
}

TOML=$(resolve_toml) || {
  echo "error: no fly.toml found. Use -f PATH, set FLY_TOML, cd to app root, or use legacy layout." >&2
  exit 1
}

if [[ ! -f "$TOML" ]]; then
  echo "error: not a file: $TOML" >&2
  exit 1
fi

app_line=$(grep -E '^app\s*=' "$TOML" | head -1 || true)
if [[ -z "$app_line" ]]; then
  APP="(set app in fly.toml)"
else
  APP=$(echo "$app_line" | sed -E "s/^app[[:space:]]*=[[:space:]]*//; s/^['\"]//; s/['\"][[:space:]]*$//")
fi

echo "fly.toml: $TOML"
echo "app: $APP"
echo ""
echo "[[vm]] memory-related lines:"
grep -n -E '^\[\[vm\]\]|memory|memory_mb|cpus|cpu_kind' "$TOML" || true
echo ""
echo "Live Fly scale (requires auth):"
echo "  fly scale show -a $APP"
echo ""
echo "After: fly scale memory <MB> -a $APP"
echo "Update memory / memory_mb under [[vm]] in fly.toml so the next deploy matches."
