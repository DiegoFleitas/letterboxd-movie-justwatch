#!/usr/bin/env bash
# Full inventory with volume attachment vs machine state heuristics (see --volume-risk).

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
exec "$DIR/fly-inventory.sh" --volume-risk "$@"
