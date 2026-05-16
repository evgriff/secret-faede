#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd -P)"
readonly CONTEXT_FILE="${REPO_ROOT}/plugins/serena/codex-context.yml"

exec serena start-mcp-server \
  --transport stdio \
  --project "${REPO_ROOT}" \
  --context "${CONTEXT_FILE}" \
  --enable-web-dashboard true \
  --open-web-dashboard false
