#!/usr/bin/env bash
# Full inventory + cost estimation + manual Fly dashboard link.
set -euo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

INVENTORY_FAILED=0
echo "=== Current Resource Inventory ==="
"$DIR/fly-inventory.sh" "$@" || INVENTORY_FAILED=1

echo ""
echo "=== Cost Estimate ==="

echo "Estimated monthly costs (approximate, Fly.io may differ):"
echo ""
echo "  VM (shared-cpu-1x@1gb, always-on):"
echo "    ~\$3.65/mo (730h × \$0.005/hr)"
echo "    With auto-stop: less if idle"
echo ""
echo "  Upstash Redis (pay-as-you-go):"
echo "    ~\$5.00/mo (baseline)"
echo ""
echo "  Volumes:"
echo "    ~\$0.15/GB/mo each"
echo ""
echo "---"
echo "  With 1 VM + Redis: ~\$8-9/mo"
echo "  With 2 VMs + Redis: ~\$12-15/mo"
echo ""

echo "=== Reduce cost opportunities ==="
echo "  1. Jackett app (bold-feather-1773): if unused, saves ~\$4-6/mo"
echo "     Check: fly apps list | grep bold-feather"
echo ""
echo "  2. Try 512mb VM:"
echo "     Check peak RSS: fly ssh console -a movie-justwatch -- 'ps aux --sort=-%mem | head'"
echo "     If peak < 400mb, deploy: edit fly.toml memory = '512mb' then fly deploy"
echo "     Saves ~\$2/mo"
echo ""
echo "  3. Redis:"
echo "     Check: fly redis status movie-justwatch-redis"
echo "     Already on pay-as-you-go (minimal cost)"
echo ""
echo "  4. Unattached volumes:"
echo "     Run: $(dirname "$0")/fly-volumes-prune.sh"
echo ""
echo "=== Fly Dashboard ==="
echo "  https://fly.io/dashboard/personal/billing"
