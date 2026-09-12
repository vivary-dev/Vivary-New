#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec node --max-old-space-size=1024 bin/start.mjs --private-proxy
