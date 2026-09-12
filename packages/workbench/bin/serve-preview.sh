#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${VIVARY_DATA_DIR:?Set a private persistent data directory}"
: "${PORT:?Set the preview service port}"
export NODE_ENV=production
export HOST=127.0.0.1
export DATABASE_URL="file:$VIVARY_DATA_DIR/auth.sqlite"
export VIVARY_LOCAL_AGENT_WORKSPACE="$VIVARY_DATA_DIR/workspace"
export AGENT_NATIVE_CODE_AGENTS_HOME="$VIVARY_DATA_DIR/code-runs"
export BETTER_AUTH_SECRET="$(cat "$VIVARY_DATA_DIR/auth-secret")"
export AGENT_NATIVE_DISABLED_PLUGINS=terminal
export AGENT_NATIVE_DISABLE_AUTO_DEV_ACCOUNT=1
export AUTH_SKIP_EMAIL_VERIFICATION=1
export AUTH_MAGIC_LINK=0
exec node --max-old-space-size=1024 .output/server/index.mjs
